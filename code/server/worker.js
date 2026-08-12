const ROOM_CAPACITY = 4;
const ROOM_TTL_MS = 30 * 60 * 1000; // 30 min
const REGISTRY_KEY = "room_registry";

function json(data, init) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...(init || {}),
  });
}

function makeRoomCode(registry) {
  for (let i = 0; i < 500; i++) {
    const code = String(10000 + Math.floor(Math.random() * 90000));
    if (!registry[code]) return code;
  }
  throw new Error("Room code generation exhausted");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "countryball-arena-multiplayer" });
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const id = env.ROOMS.idFromName("arena-lobby");
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    return json({
      ok: true,
      usage: {
        websocket: "/ws",
        health: "/health",
      },
    });
  },
};

export class RoomServer {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    /** @type {Map<string, { code: string, members: Set<WebSocket>, mapId: string, started: boolean }>} */
    this.rooms = new Map();
    /** @type {Map<WebSocket, { id: string, roomCode: string|null, ready: boolean, fighter: string, name: string, mapId?: string }>} */
    this.peers = new Map();
    this.registryCache = null;
    this.loaded = false;
    this.restoreFromHibernation();
  }

  async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    await this.pruneRegistry();
    const registry = await this.loadRegistry();
    const now = Date.now();
    for (const code of Object.keys(registry)) {
      if (this.rooms.has(code)) continue;
      const entry = registry[code];
      if (!entry || now - (entry.createdAt || 0) > ROOM_TTL_MS) continue;
      this.rooms.set(code, {
        code: code,
        members: new Set(),
        mapId: entry.mapId === "icy" ? "icy" : "plains",
        started: !!entry.started,
      });
    }
  }

  restoreFromHibernation() {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      const peer = this.readAttachment(ws);
      if (!peer) continue;
      this.peers.set(ws, peer);
    }
    for (const [ws, peer] of this.peers.entries()) {
      if (!peer.roomCode) continue;
      this.attachToRoom(ws, peer.roomCode, peer.mapId || "plains");
    }
  }

  readAttachment(ws) {
    let meta = null;
    try {
      meta = ws.deserializeAttachment();
    } catch (_) {
      meta = null;
    }
    if (!meta || !meta.id) return null;
    return {
      id: meta.id,
      roomCode: meta.roomCode || null,
      ready: !!meta.ready,
      fighter: meta.fighter || "usa",
      name: meta.name || "Player",
      mapId: meta.mapId || "plains",
    };
  }

  persistPeer(ws, peer) {
    this.peers.set(ws, peer);
    try {
      ws.serializeAttachment({
        id: peer.id,
        roomCode: peer.roomCode,
        ready: !!peer.ready,
        fighter: peer.fighter || "usa",
        name: peer.name || "Player",
        mapId: peer.mapId || "plains",
      });
    } catch (_) {}
  }

  ensurePeer(ws) {
    let peer = this.peers.get(ws);
    if (peer) return peer;
    peer = this.readAttachment(ws);
    if (!peer) return null;
    this.peers.set(ws, peer);
    if (peer.roomCode) {
      this.attachToRoom(ws, peer.roomCode, peer.mapId || "plains");
    }
    return peer;
  }

  attachToRoom(ws, code, mapId) {
    let room = this.rooms.get(code);
    if (!room) {
      room = {
        code: code,
        members: new Set(),
        mapId: mapId === "icy" ? "icy" : "plains",
        started: false,
      };
      this.rooms.set(code, room);
    }
    room.members.add(ws);
  }

  async loadRegistry() {
    if (this.registryCache) return this.registryCache;
    const stored = await this.ctx.storage.get(REGISTRY_KEY);
    this.registryCache = stored && typeof stored === "object" ? stored : {};
    return this.registryCache;
  }

  async saveRegistry() {
    await this.ctx.storage.put(REGISTRY_KEY, this.registryCache || {});
  }

  async registerRoom(code, mapId, started) {
    const registry = await this.loadRegistry();
    registry[code] = {
      mapId: mapId === "icy" ? "icy" : "plains",
      createdAt: Date.now(),
      started: !!started,
    };
    this.registryCache = registry;
    await this.saveRegistry();
  }

  async unregisterRoom(code) {
    const registry = await this.loadRegistry();
    if (registry[code]) {
      delete registry[code];
      this.registryCache = registry;
      await this.saveRegistry();
    }
  }

  async pruneRegistry() {
    const registry = await this.loadRegistry();
    const now = Date.now();
    let changed = false;
    for (const code of Object.keys(registry)) {
      const entry = registry[code];
      if (!entry || now - (entry.createdAt || 0) > ROOM_TTL_MS) {
        delete registry[code];
        changed = true;
      }
    }
    if (changed) {
      this.registryCache = registry;
      await this.saveRegistry();
    }
  }

  async roomExists(code) {
    await this.ensureLoaded();
    if (this.rooms.has(code)) return true;
    const registry = await this.loadRegistry();
    const entry = registry[code];
    if (!entry) return false;
    if (Date.now() - (entry.createdAt || 0) > ROOM_TTL_MS) return false;
    return true;
  }

  async getOrCreateRoom(code, fallbackMapId) {
    await this.ensureLoaded();
    let room = this.rooms.get(code);
    if (room) return room;
    const registry = await this.loadRegistry();
    const entry = registry[code];
    if (!entry) return null;
    if (Date.now() - (entry.createdAt || 0) > ROOM_TTL_MS) return null;
    room = {
      code: code,
      members: new Set(),
      mapId: entry.mapId || fallbackMapId || "plains",
      started: !!entry.started,
    };
    this.rooms.set(code, room);
    return room;
  }

  async fetch(request) {
    await this.ensureLoaded();
    if (request.headers.get("Upgrade") !== "websocket") {
      const registry = await this.loadRegistry();
      return json({
        ok: true,
        lobby: true,
        rooms: this.rooms.size,
        peers: this.peers.size,
        registry: Object.keys(registry).length,
      });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const playerId = crypto.randomUUID();

    this.ctx.acceptWebSocket(server);
    this.persistPeer(server, {
      id: playerId,
      roomCode: null,
      ready: false,
      fighter: "usa",
      name: "Player",
      mapId: "plains",
    });

    this.send(server, "hello", { playerId: playerId });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    await this.ensureLoaded();
    let msg = null;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      this.send(ws, "error", { message: "Invalid JSON." });
      return;
    }

    const type = msg && msg.type;
    const payload = (msg && msg.payload) || {};
    const peer = this.ensurePeer(ws);
    if (!peer) {
      this.send(ws, "error", { message: "Session expired. Refresh and try again." });
      return;
    }

    if (type === "create_room") {
      await this.handleCreateRoom(ws, peer, payload);
      return;
    }
    if (type === "join_room") {
      await this.handleJoinRoom(ws, peer, payload);
      return;
    }
    if (type === "leave_room") {
      await this.removeFromRoom(ws, "leave", true);
      this.send(ws, "left_room", {});
      return;
    }
    if (type === "ready") {
      if (!peer.roomCode) {
        this.send(ws, "error", { message: "Join a room first." });
        return;
      }
      if (typeof payload.ready === "boolean") peer.ready = payload.ready;
      else peer.ready = !peer.ready;
      this.persistPeer(ws, peer);
      this.broadcastRoomState(peer.roomCode, "ready");
      return;
    }
    if (type === "set_loadout") {
      if (payload.fighter === "usa" || payload.fighter === "japan" || payload.fighter === "russia") {
        peer.fighter = payload.fighter;
      }
      if (typeof payload.name === "string" && payload.name.trim()) {
        peer.name = String(payload.name).trim().slice(0, 16);
      }
      if (peer.roomCode) {
        const room = this.rooms.get(peer.roomCode);
        if (room && !room.started && (payload.mapId === "plains" || payload.mapId === "icy")) {
          const hostWs = this.hostSocket(room);
          if (hostWs === ws) {
            room.mapId = payload.mapId;
            peer.mapId = payload.mapId;
            await this.registerRoom(peer.roomCode, room.mapId, room.started);
          }
        }
        this.persistPeer(ws, peer);
        this.broadcastRoomState(peer.roomCode, "loadout");
      } else {
        this.persistPeer(ws, peer);
      }
      return;
    }
    if (type === "start_match") {
      await this.handleStartMatch(ws, peer, payload);
      return;
    }
    if (type === "state" || type === "input" || type === "hit") {
      if (!peer.roomCode) return;
      this.broadcastOthers(peer.roomCode, ws, type, payload);
      return;
    }

    this.send(ws, "error", { message: `Unknown message type: ${type}` });
  }

  async webSocketClose(ws) {
    await this.removeFromRoom(ws, "disconnect", false);
    this.peers.delete(ws);
  }

  async webSocketError(ws) {
    await this.removeFromRoom(ws, "disconnect", false);
    this.peers.delete(ws);
  }

  async handleCreateRoom(ws, peer, payload) {
    await this.removeFromRoom(ws, "switch_room", false);
    const registry = await this.loadRegistry();
    const code = makeRoomCode(registry);
    const mapId = payload.mapId === "icy" ? "icy" : "plains";
    const room = {
      code: code,
      members: new Set([ws]),
      mapId: mapId,
      started: false,
    };
    this.rooms.set(code, room);
    peer.roomCode = code;
    peer.ready = false;
    peer.mapId = mapId;
    if (payload.fighter === "usa" || payload.fighter === "japan" || payload.fighter === "russia") {
      peer.fighter = payload.fighter;
    }
    if (typeof payload.name === "string" && payload.name.trim()) {
      peer.name = String(payload.name).trim().slice(0, 16);
    }
    this.persistPeer(ws, peer);
    await this.registerRoom(code, mapId, false);
    this.send(ws, "room_created", { code: code, playerId: peer.id });
    this.broadcastRoomState(code, "create");
    console.log("[RoomServer] create", code, "registry=", Object.keys(registry).length + 1);
  }

  async handleJoinRoom(ws, peer, payload) {
    const code = String(payload.code || "").trim();
    if (!/^\d{5}$/.test(code)) {
      this.send(ws, "error", { message: "Enter a 5-digit room code." });
      return;
    }

    const exists = await this.roomExists(code);
    if (!exists) {
      this.send(ws, "error", { message: "Room not found. Check the code or ask host to create again." });
      console.warn("[RoomServer] join miss", code);
      return;
    }

    const room = await this.getOrCreateRoom(code, payload.mapId === "icy" ? "icy" : "plains");
    if (!room) {
      this.send(ws, "error", { message: "Room expired. Ask host to create a new room." });
      return;
    }
    if (room.started) {
      this.send(ws, "error", { message: "Match already started." });
      return;
    }
    if (room.members.size >= ROOM_CAPACITY && !room.members.has(ws)) {
      this.send(ws, "error", { message: "Room is full (max 4)." });
      return;
    }

    await this.removeFromRoom(ws, "switch_room", false);
    room.members.add(ws);
    peer.roomCode = code;
    peer.ready = false;
    peer.mapId = room.mapId;
    if (payload.fighter === "usa" || payload.fighter === "japan" || payload.fighter === "russia") {
      peer.fighter = payload.fighter;
    }
    if (typeof payload.name === "string" && payload.name.trim()) {
      peer.name = String(payload.name).trim().slice(0, 16);
    }
    this.persistPeer(ws, peer);
    this.send(ws, "room_joined", { code: code, playerId: peer.id });
    this.broadcastRoomState(code, "join");
    console.log("[RoomServer] join ok", code, "members=", room.members.size);
  }

  async handleStartMatch(ws, peer, payload) {
    if (!peer.roomCode) {
      this.send(ws, "error", { message: "Join a room first." });
      return;
    }
    const room = this.rooms.get(peer.roomCode);
    if (!room) return;
    const hostWs = this.hostSocket(room);
    if (hostWs !== ws) {
      this.send(ws, "error", { message: "Only the host can start." });
      return;
    }
    if (room.members.size < 2) {
      this.send(ws, "error", { message: "Need at least 2 players." });
      return;
    }
    if (payload.mapId === "plains" || payload.mapId === "icy") {
      room.mapId = payload.mapId;
    }
    room.started = true;
    await this.registerRoom(room.code, room.mapId, true);
    for (const member of room.members) {
      const p = this.ensurePeer(member);
      if (p) {
        p.ready = true;
        this.persistPeer(member, p);
      }
    }
    const startPayload = {
      code: room.code,
      mapId: room.mapId,
      players: this.players(room),
      seed: Date.now() % 100000,
    };
    for (const member of room.members) {
      this.send(member, "start_match", startPayload);
    }
    this.broadcastRoomState(room.code, "start");
  }

  hostSocket(room) {
    for (const ws of room.members) return ws;
    return null;
  }

  async removeFromRoom(ws, reason, explicitLeave) {
    const peer = this.ensurePeer(ws);
    if (!peer || !peer.roomCode) return;
    const code = peer.roomCode;
    const room = this.rooms.get(code);
    peer.roomCode = null;
    peer.ready = false;
    this.persistPeer(ws, peer);
    if (!room) return;
    room.members.delete(ws);
    if (room.members.size === 0) {
      this.rooms.delete(code);
      if (explicitLeave) {
        await this.unregisterRoom(code);
      }
      return;
    }
    room.started = false;
    this.broadcastRoomState(code, reason || "leave");
  }

  players(room) {
    const list = [];
    let i = 0;
    for (const ws of room.members) {
      const p = this.ensurePeer(ws);
      if (!p) continue;
      list.push({
        id: p.id,
        name: p.name || "Player",
        fighter: p.fighter || "usa",
        ready: !!p.ready,
        isHost: i === 0,
        slot: i + 1,
      });
      i += 1;
    }
    return list;
  }

  broadcastRoomState(code, reason) {
    const room = this.rooms.get(code);
    if (!room) return;
    const payload = {
      code: room.code,
      reason: reason || "update",
      players: this.players(room),
      capacity: ROOM_CAPACITY,
      mapId: room.mapId,
      started: !!room.started,
    };
    for (const ws of room.members) {
      this.send(ws, "room_state", payload);
    }
  }

  broadcastOthers(code, sender, type, payload) {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const ws of room.members) {
      if (ws === sender) continue;
      this.send(ws, type, payload || {});
    }
  }

  send(ws, type, payload) {
    try {
      ws.send(JSON.stringify({ type: type, payload: payload || {} }));
    } catch (_) {}
  }
}
