import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 8080);
const ROOM_CAPACITY = 4;
const HEARTBEAT_MS = 15000;

const wss = new WebSocketServer({ port: PORT });

/** @type {Map<string, { code: string, members: Set<any>, mapId: string, started: boolean, createdAt: number }>} */
const rooms = new Map();
/** @type {Map<any, { id: string, roomCode: string|null, isAlive: boolean, ready: boolean, fighter: string, name: string }>} */
const peers = new Map();

function send(ws, type, payload = {}) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type, payload }));
}

function hostSocket(room) {
  for (const member of room.members) return member;
  return null;
}

function roomPlayers(room) {
  const players = [];
  let i = 0;
  room.members.forEach((member) => {
    const p = peers.get(member);
    if (!p) return;
    players.push({
      id: p.id,
      name: p.name || "Player",
      fighter: p.fighter || "usa",
      ready: !!p.ready,
      isHost: i === 0,
      slot: i + 1,
    });
    i += 1;
  });
  return players;
}

function broadcastRoomState(room, reason) {
  const payload = {
    code: room.code,
    reason: reason || "update",
    players: roomPlayers(room),
    capacity: ROOM_CAPACITY,
    mapId: room.mapId,
    started: !!room.started,
  };
  room.members.forEach((member) => send(member, "room_state", payload));
}

function broadcastOthers(room, sender, type, payload) {
  if (!room) return;
  room.members.forEach((member) => {
    if (member === sender) return;
    send(member, type, payload || {});
  });
}

function removeFromRoom(ws, reason) {
  const peer = peers.get(ws);
  if (!peer || !peer.roomCode) return;
  const room = rooms.get(peer.roomCode);
  peer.roomCode = null;
  peer.ready = false;
  if (!room) return;

  room.members.delete(ws);
  if (room.members.size === 0) {
    rooms.delete(room.code);
    return;
  }
  room.started = false;
  broadcastRoomState(room, reason || "leave");
}

function uniqueRoomCode() {
  for (let i = 0; i < 500; i++) {
    const code = String(10000 + Math.floor(Math.random() * 90000));
    if (!rooms.has(code)) return code;
  }
  throw new Error("Room code generation exhausted");
}

function handleCreateRoom(ws, payload) {
  const peer = peers.get(ws);
  if (!peer) return;

  removeFromRoom(ws, "switch_room");
  const code = uniqueRoomCode();
  const room = {
    code,
    members: new Set([ws]),
    mapId: payload?.mapId === "icy" ? "icy" : "plains",
    started: false,
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  peer.roomCode = code;
  peer.ready = false;
  if (payload?.fighter === "usa" || payload?.fighter === "japan" || payload?.fighter === "russia") {
    peer.fighter = payload.fighter;
  }
  if (typeof payload?.name === "string" && payload.name.trim()) {
    peer.name = String(payload.name).trim().slice(0, 16);
  }

  send(ws, "room_created", { code, playerId: peer.id });
  broadcastRoomState(room, "create");
  console.log("[WS] room created", code, "host=", peer.id);
}

function handleJoinRoom(ws, payload) {
  const peer = peers.get(ws);
  if (!peer) return;
  const code = String(payload?.code || "").trim();
  if (!/^\d{5}$/.test(code)) {
    send(ws, "error", { message: "Enter a 5-digit room code." });
    return;
  }
  const room = rooms.get(code);
  if (!room) {
    send(ws, "error", { message: "Room not found. Ask the host for a new code." });
    return;
  }
  if (room.started) {
    send(ws, "error", { message: "Match already started." });
    return;
  }
  if (room.members.size >= ROOM_CAPACITY) {
    send(ws, "error", { message: "Room is full (max 4)." });
    return;
  }

  removeFromRoom(ws, "switch_room");
  room.members.add(ws);
  peer.roomCode = code;
  peer.ready = false;
  if (payload?.fighter === "usa" || payload?.fighter === "japan" || payload?.fighter === "russia") {
    peer.fighter = payload.fighter;
  }
  if (typeof payload?.name === "string" && payload.name.trim()) {
    peer.name = String(payload.name).trim().slice(0, 16);
  }
  send(ws, "room_joined", { code, playerId: peer.id });
  broadcastRoomState(room, "join");
  console.log("[WS] room joined", code, "peer=", peer.id);
}

function handleLeaveRoom(ws) {
  removeFromRoom(ws, "leave");
  send(ws, "left_room", {});
}

function handleReady(ws, payload) {
  const peer = peers.get(ws);
  if (!peer || !peer.roomCode) {
    send(ws, "error", { message: "Join a room first." });
    return;
  }
  if (typeof payload?.ready === "boolean") peer.ready = payload.ready;
  else peer.ready = !peer.ready;
  const room = rooms.get(peer.roomCode);
  if (room) broadcastRoomState(room, "ready");
}

function handleSetLoadout(ws, payload) {
  const peer = peers.get(ws);
  if (!peer) return;
  if (payload?.fighter === "usa" || payload?.fighter === "japan" || payload?.fighter === "russia") {
    peer.fighter = payload.fighter;
  }
  if (typeof payload?.name === "string" && payload.name.trim()) {
    peer.name = String(payload.name).trim().slice(0, 16);
  }
  if (!peer.roomCode) return;
  const room = rooms.get(peer.roomCode);
  if (!room || room.started) return;
  if ((payload?.mapId === "plains" || payload?.mapId === "icy") && hostSocket(room) === ws) {
    room.mapId = payload.mapId;
  }
  broadcastRoomState(room, "loadout");
}

function handleStartMatch(ws, payload) {
  const peer = peers.get(ws);
  if (!peer || !peer.roomCode) {
    send(ws, "error", { message: "Join a room first." });
    return;
  }
  const room = rooms.get(peer.roomCode);
  if (!room) return;
  if (hostSocket(room) !== ws) {
    send(ws, "error", { message: "Only the host can start." });
    return;
  }
  if (room.members.size < 2) {
    send(ws, "error", { message: "Need at least 2 players." });
    return;
  }
  if (payload?.mapId === "plains" || payload?.mapId === "icy") {
    room.mapId = payload.mapId;
  }
  room.started = true;
  room.members.forEach((member) => {
    const p = peers.get(member);
    if (p) p.ready = true;
  });
  const startPayload = {
    code: room.code,
    mapId: room.mapId,
    players: roomPlayers(room),
    seed: Date.now() % 100000,
  };
  room.members.forEach((member) => send(member, "start_match", startPayload));
  broadcastRoomState(room, "start");
  console.log("[WS] start_match", room.code);
}

function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(String(raw));
  } catch {
    send(ws, "error", { message: "Invalid JSON." });
    return;
  }
  const type = msg?.type;
  const payload = msg?.payload || {};

  if (type === "create_room") return handleCreateRoom(ws, payload);
  if (type === "join_room") return handleJoinRoom(ws, payload);
  if (type === "leave_room") return handleLeaveRoom(ws);
  if (type === "ready") return handleReady(ws, payload);
  if (type === "set_loadout") return handleSetLoadout(ws, payload);
  if (type === "start_match") return handleStartMatch(ws, payload);
  if (type === "state" || type === "input" || type === "hit") {
    const peer = peers.get(ws);
    if (!peer || !peer.roomCode) return;
    const room = rooms.get(peer.roomCode);
    if (!room) return;
    broadcastOthers(room, ws, type, payload);
    return;
  }
  send(ws, "error", { message: `Unknown message type: ${type}` });
}

wss.on("connection", (ws) => {
  const id = randomUUID();
  peers.set(ws, {
    id,
    roomCode: null,
    isAlive: true,
    ready: false,
    fighter: "usa",
    name: "Player",
  });
  send(ws, "hello", { playerId: id });
  console.log("[WS] connect", id);

  ws.on("pong", () => {
    const p = peers.get(ws);
    if (p) p.isAlive = true;
  });
  ws.on("message", (raw) => handleMessage(ws, raw));
  ws.on("close", () => {
    const p = peers.get(ws);
    removeFromRoom(ws, "disconnect");
    peers.delete(ws);
    console.log("[WS] disconnect", p?.id || "unknown");
  });
  ws.on("error", (err) => {
    console.warn("[WS] socket error", err?.message || err);
  });
});

setInterval(() => {
  peers.forEach((peer, ws) => {
    if (!peer.isAlive) {
      ws.terminate();
      return;
    }
    peer.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_MS);

console.log(`[WS] listening on ws://localhost:${PORT}`);
