const ROOM_CAPACITY = 4;

function json(data, init) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...(init || {}),
  });
}

function makeRoomCode() {
  return String(10000 + Math.floor(Math.random() * 90000));
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

      let roomCode = (url.searchParams.get("room") || "").trim().toUpperCase();
      if (!roomCode) roomCode = makeRoomCode();

      const id = env.ROOMS.idFromName(roomCode);
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
    this.members = new Map();
    this.code = null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") !== "websocket") {
      return json({ ok: true, room: this.code || url.searchParams.get("room") || "unknown" });
    }

    if (this.members.size >= ROOM_CAPACITY) {
      return json({ error: "Room is full." }, { status: 409 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const roomCode = (url.searchParams.get("room") || "").trim().toUpperCase();
    this.code = roomCode || this.code || "ROOM";

    const playerId = crypto.randomUUID();
    this.ctx.acceptWebSocket(server);
    this.members.set(server, {
      id: playerId,
      ready: false,
      joinedAt: Date.now(),
    });

    server.send(
      JSON.stringify({
        type: "hello",
        payload: { playerId: playerId },
      })
    );

    this.broadcastRoomState("connect");
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, raw) {
    let msg = null;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      this.send(ws, "error", { message: "Invalid JSON." });
      return;
    }

    const type = msg && msg.type;
    const payload = (msg && msg.payload) || {};
    const peer = this.members.get(ws);
    if (!peer) return;

    if (type === "create_room") {
      this.send(ws, "room_created", { code: this.code, playerId: peer.id });
      this.broadcastRoomState("create");
      return;
    }

    if (type === "join_room") {
      this.send(ws, "room_joined", { code: this.code, playerId: peer.id });
      this.broadcastRoomState("join");
      return;
    }

    if (type === "leave_room") {
      this.send(ws, "left_room", {});
      this.members.delete(ws);
      try {
        ws.close(1000, "left");
      } catch (_) {}
      this.broadcastRoomState("leave");
      return;
    }

    if (type === "ready") {
      peer.ready = true;
      this.broadcastRoomState("ready");
      return;
    }

    if (type === "state" || type === "input") {
      this.broadcastOthers(ws, type, payload);
      return;
    }

    this.send(ws, "error", { message: `Unknown message type: ${type}` });
  }

  webSocketClose(ws) {
    this.members.delete(ws);
    this.broadcastRoomState("disconnect");
  }

  webSocketError(ws) {
    this.members.delete(ws);
    this.broadcastRoomState("disconnect");
  }

  send(ws, type, payload) {
    try {
      ws.send(JSON.stringify({ type: type, payload: payload || {} }));
    } catch (_) {}
  }

  players() {
    const list = [];
    let first = true;
    for (const [, peer] of this.members.entries()) {
      list.push({
        id: peer.id,
        isHost: first,
        ready: !!peer.ready,
      });
      first = false;
    }
    return list;
  }

  broadcastRoomState(reason) {
    const payload = {
      code: this.code,
      reason: reason || "update",
      players: this.players(),
      capacity: ROOM_CAPACITY,
    };
    for (const ws of this.members.keys()) {
      this.send(ws, "room_state", payload);
    }
  }

  broadcastOthers(sender, type, payload) {
    for (const ws of this.members.keys()) {
      if (ws === sender) continue;
      this.send(ws, type, payload || {});
    }
  }
}
