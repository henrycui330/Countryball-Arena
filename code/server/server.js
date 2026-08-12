import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 8080);
const ROOM_CAPACITY = 4;
const HEARTBEAT_MS = 15000;

const wss = new WebSocketServer({ port: PORT });

/** @type {Map<string, { code: string, members: Set<any>, createdAt: number }>} */
const rooms = new Map();
/** @type {Map<any, { id: string, roomCode: string|null, isAlive: boolean }>} */
const peers = new Map();

function send(ws, type, payload = {}) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ type, payload }));
}

function roomPlayers(room) {
  const players = [];
  room.members.forEach((member) => {
    const p = peers.get(member);
    if (!p) return;
    players.push({
      id: p.id,
      isHost: room.members.values().next().value === member,
    });
  });
  return players;
}

function broadcastRoomState(room, reason) {
  const payload = {
    code: room.code,
    reason: reason || "update",
    players: roomPlayers(room),
    capacity: ROOM_CAPACITY,
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
  if (!room) return;

  room.members.delete(ws);
  if (room.members.size === 0) {
    rooms.delete(room.code);
    return;
  }
  broadcastRoomState(room, reason || "leave");
}

function uniqueRoomCode() {
  for (let i = 0; i < 500; i++) {
    const code = String(10000 + Math.floor(Math.random() * 90000));
    if (!rooms.has(code)) return code;
  }
  throw new Error("Room code generation exhausted");
}

function handleCreateRoom(ws) {
  const peer = peers.get(ws);
  if (!peer) return;

  removeFromRoom(ws, "switch_room");
  const code = uniqueRoomCode();
  const room = {
    code,
    members: new Set([ws]),
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  peer.roomCode = code;

  send(ws, "room_created", { code, playerId: peer.id });
  broadcastRoomState(room, "create");
  console.log("[WS] room created", code, "host=", peer.id);
}

function handleJoinRoom(ws, payload) {
  const peer = peers.get(ws);
  if (!peer) return;
  const code = String(payload?.code || "").trim().toUpperCase();
  if (!code) {
    send(ws, "error", { message: "Missing room code." });
    return;
  }
  const room = rooms.get(code);
  if (!room) {
    send(ws, "error", { message: "Room not found." });
    return;
  }
  if (room.members.size >= ROOM_CAPACITY) {
    send(ws, "error", { message: "Room is full." });
    return;
  }

  removeFromRoom(ws, "switch_room");
  room.members.add(ws);
  peer.roomCode = code;
  send(ws, "room_joined", { code, playerId: peer.id });
  broadcastRoomState(room, "join");
  console.log("[WS] room joined", code, "peer=", peer.id);
}

function handleLeaveRoom(ws) {
  removeFromRoom(ws, "leave");
  send(ws, "left_room", {});
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

  if (type === "create_room") return handleCreateRoom(ws);
  if (type === "join_room") return handleJoinRoom(ws, payload);
  if (type === "leave_room") return handleLeaveRoom(ws);
  if (type === "ready") {
    const peer = peers.get(ws);
    if (!peer || !peer.roomCode) return;
    const room = rooms.get(peer.roomCode);
    if (!room) return;
    broadcastRoomState(room, "ready");
    return;
  }
  if (type === "state" || type === "input") {
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
  peers.set(ws, { id, roomCode: null, isAlive: true });
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
