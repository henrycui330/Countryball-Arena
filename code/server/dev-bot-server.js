/**
 * Dev arena: fixed room 12346 + Easy Bot guest.
 *
 * Usage (from code/server):
 *   npm run dev:bot
 *
 * Then open http://127.0.0.1:5500/
 * Multiplayer → Join → 12346 → you are Host → Start.
 * Guest is an Easy Bot (Absolut-style) that fights over the same WS protocol.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CODE_ROOT = path.resolve(__dirname, "..");
const WS_PORT = Number(process.env.WS_PORT || 8080);
const HTTP_PORT = Number(process.env.HTTP_PORT || 5500);
const DEV_CODE = String(process.env.DEV_ROOM_CODE || "12346");
const ROOM_CAPACITY = 4;

const W = 960;
const H = 540;
const GROUND_Y = H * 0.72 - 6;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".md": "text/plain; charset=utf-8",
};

/** @type {Map<string, { code: string, members: Set<any>, mapId: string, started: boolean, createdAt: number }>} */
const rooms = new Map();
/** @type {Map<any, { id: string, roomCode: string|null, isAlive: boolean, ready: boolean, fighter: string, name: string, isBot?: boolean }>} */
const peers = new Map();

let botSpawnTimer = null;
let botClient = null;
let botAi = null;

function send(ws, type, payload = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
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
      isBot: !!p.isBot,
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
    stopBotAi();
    return;
  }
  room.started = false;
  broadcastRoomState(room, reason || "leave");
}

function ensureDevRoom(code) {
  let room = rooms.get(code);
  if (room) return room;
  room = {
    code,
    members: new Set(),
    mapId: "plains",
    started: false,
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  console.log("[DevBot] created fixed room", code);
  return room;
}

function scheduleBotSpawn(code) {
  if (botSpawnTimer) clearTimeout(botSpawnTimer);
  botSpawnTimer = setTimeout(function () {
    botSpawnTimer = null;
    spawnEasyBot(code);
  }, 350);
}

function spawnEasyBot(code) {
  const room = rooms.get(code);
  if (!room || room.started) return;
  // Already have a bot or 2+ humans
  for (const m of room.members) {
    const p = peers.get(m);
    if (p && p.isBot) return;
  }
  if (room.members.size >= 2) return;
  if (botClient && botClient.readyState === WebSocket.OPEN) {
    try {
      botClient.close();
    } catch (_) {
      /* ignore */
    }
  }

  const url = `ws://127.0.0.1:${WS_PORT}`;
  console.log("[DevBot] connecting Easy Bot guest →", url, "room", code);
  botClient = new WebSocket(url);
  botClient.on("open", function () {
    botClient.send(
      JSON.stringify({
        type: "join_room",
        payload: {
          code: code,
          fighter: "usa",
          name: "Easy Bot",
          _devBot: true,
        },
      })
    );
  });
  botClient.on("message", function (raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    onBotMessage(msg);
  });
  botClient.on("close", function () {
    console.log("[DevBot] bot socket closed");
    stopBotAi();
  });
  botClient.on("error", function (err) {
    console.error("[DevBot] bot socket error", err && err.message);
  });
}

function onBotMessage(msg) {
  const type = msg.type;
  const p = msg.payload || {};
  if (type === "hello") {
    return;
  }
  if (type === "room_joined") {
    // Ready exactly once — re-sending on every room_state caused a flood
    // (lobby flicker + lag).
    if (botClient && botClient.readyState === WebSocket.OPEN) {
      botClient.send(
        JSON.stringify({ type: "ready", payload: { ready: true } })
      );
    }
    if (botClient) {
      const peer = peers.get(botClient);
      if (peer) {
        peer.isBot = true;
        peer.name = "Easy Bot";
        peer.ready = true;
        peer.fighter = "usa";
      }
    }
    return;
  }
  if (type === "room_state") {
    // Ignore — do NOT re-ready (that loops with broadcastRoomState)
    return;
  }
  if (type === "start_match") {
    startBotAi(p);
    return;
  }
  if (type === "state" && botAi) {
    // Only track the human foe (ignore our own echo if any)
    if (p.playerId && botAi.self.id && p.playerId === botAi.self.id) return;
    botAi.foe = {
      x: typeof p.x === "number" ? p.x : botAi.foe.x,
      y: typeof p.y === "number" ? p.y : botAi.foe.y,
      hp: typeof p.hp === "number" ? p.hp : botAi.foe.hp,
      radius: typeof p.radius === "number" ? p.radius : botAi.foe.radius,
      facing: p.facing >= 0 ? 1 : -1,
      lives: typeof p.lives === "number" ? p.lives : botAi.foe.lives,
    };
    return;
  }
  if (type === "hit") {
    // Accept hits even if AI tick is late
    if (!botAi) return;
    if (botAi.roundBreak) return;
    const amount = Math.max(0, Number(p.amount) || 0);
    if (amount <= 0) return;
    botAi.self.hp = Math.max(0, botAi.self.hp - amount);
    botAi.self.flash = 0.35;
    console.log("[DevBot] took hit", amount, "hp=", botAi.self.hp.toFixed(1));
    publishBotState();
    if (botAi.self.hp <= 0 && !botAi.roundBreak) {
      beginBotRoundBreak(true);
    }
    return;
  }
  if (type === "round_ko") {
    if (!botAi) return;
    // Human died — we are not the loser
    if (p.loserPlayerId && botAi.self.id && p.loserPlayerId === botAi.self.id) {
      return;
    }
    if (typeof p.livesLeft === "number") botAi.foe.lives = p.livesLeft;
    beginBotRoundBreak(false, p.livesLeft);
    return;
  }
  if (type === "error") {
    console.error("[DevBot] server error", p.message || p);
  }
}

function stopBotAi() {
  if (botAi && botAi.interval) clearInterval(botAi.interval);
  botAi = null;
}

function startBotAi(startPayload) {
  stopBotAi();
  const players = (startPayload && startPayload.players) || [];
  const me = players.find(function (pl) {
    return pl.isBot || pl.name === "Easy Bot";
  });
  const amHost = !!(me && me.isHost);
  // Guest (normal) = left; host = right — bot should be guest
  const spawnX = amHost ? W * 0.78 : W * 0.22;
  botAi = {
    self: {
      id: me && me.id,
      x: spawnX,
      y: GROUND_Y,
      radius: 42,
      facing: amHost ? -1 : 1,
      hp: 100,
      maxHp: 100,
      lives: 3,
      fighter: "usa",
      aimX: W * 0.5,
      aimY: GROUND_Y,
      plunging: false,
      flash: 0,
    },
    foe: {
      x: amHost ? W * 0.22 : W * 0.78,
      y: GROUND_Y,
      hp: 100,
      radius: 42,
      facing: 1,
      lives: 3,
    },
    meleeCd: 0.8,
    shootCd: 1.4,
    strafeDir: 1,
    strafeTimer: 1.2,
    koTimer: 0,
    roundBreak: null,
    sendAcc: 0,
    interval: null,
    roundSeq: 0,
  };
  console.log(
    "[DevBot] Easy Bot AI started spawnX=" +
      Math.round(spawnX) +
      " host=" +
      amHost
  );
  let last = Date.now();
  botAi.interval = setInterval(function () {
    const now = Date.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tickBot(dt);
  }, 50);
}

function beginBotRoundBreak(iAmLoser, foeLivesLeft) {
  if (!botAi || botAi.roundBreak) return;
  const livesLeft = iAmLoser
    ? Math.max(0, (botAi.self.lives || 1) - 1)
    : botAi.self.lives;
  if (iAmLoser) botAi.self.lives = livesLeft;
  if (typeof foeLivesLeft === "number") botAi.foe.lives = foeLivesLeft;
  botAi.roundBreak = {
    timer: livesLeft <= 0 && iAmLoser ? 1.35 : 1.85,
    iAmLoser: !!iAmLoser,
    matchEnd: iAmLoser && livesLeft <= 0,
  };
  botAi.self.hp = Math.max(1, botAi.self.hp);
  if (iAmLoser && botClient && botClient.readyState === WebSocket.OPEN) {
    botAi.roundSeq += 1;
    send(botClient, "round_ko", {
      loserPlayerId: botAi.self.id,
      livesLeft: livesLeft,
      seq: 100000 + botAi.roundSeq,
      ts: Date.now(),
    });
    console.log("[DevBot] round_ko sent livesLeft=" + livesLeft);
  }
  console.log(
    "[DevBot] round break loser=" +
      (iAmLoser ? "bot" : "human") +
      " botLives=" +
      botAi.self.lives
  );
}

function resetBotRound() {
  if (!botAi) return;
  const spawnX = W * 0.22; // guest
  botAi.self.hp = botAi.self.maxHp;
  botAi.self.x = spawnX;
  botAi.self.y = GROUND_Y;
  botAi.self.facing = 1;
  botAi.meleeCd = 0.9;
  botAi.shootCd = 1.2;
  botAi.roundBreak = null;
  botAi.koTimer = 0;
  publishBotState();
  console.log("[DevBot] round reset lives=" + botAi.self.lives);
}

function tickBot(dt) {
  if (!botAi || !botClient || botClient.readyState !== WebSocket.OPEN) return;
  const s = botAi.self;
  const foe = botAi.foe;

  if (botAi.roundBreak) {
    botAi.roundBreak.timer -= dt;
    s.y = GROUND_Y;
    publishBotState();
    if (botAi.roundBreak.timer > 0) return;
    if (botAi.roundBreak.matchEnd) {
      s.hp = 0;
      publishBotState();
      console.log("[DevBot] match over — bot defeated");
      stopBotAi();
      return;
    }
    resetBotRound();
    return;
  }

  // Soft-cap during legacy KO path (unused if round_ko works)
  if (botAi.koTimer > 0) {
    botAi.koTimer = 0;
    beginBotRoundBreak(true);
    return;
  }

  if (s.flash > 0) s.flash = Math.max(0, s.flash - dt);

  const dx = foe.x - s.x;
  const dy = foe.y - s.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  s.facing = dx >= 0 ? 1 : -1;
  s.aimX = foe.x;
  s.aimY = foe.y;

  botAi.strafeTimer -= dt;
  if (botAi.strafeTimer <= 0) {
    botAi.strafeDir *= -1;
    botAi.strafeTimer = 1.2 + Math.random() * 1.4;
  }

  // Easy: prefer ~300px, slow walk — less jitter
  const preferred = 300;
  let mx = 0;
  if (dist > preferred + 50) mx = nx;
  else if (dist < preferred - 60) mx = -nx;
  else mx = botAi.strafeDir * 0.35;
  const speed = 85;
  s.x += mx * speed * dt;
  s.x = Math.max(s.radius + 8, Math.min(W - s.radius - 8, s.x));
  s.y = GROUND_Y;

  botAi.meleeCd = Math.max(0, botAi.meleeCd - dt);
  botAi.shootCd = Math.max(0, botAi.shootCd - dt);

  // Melee when close (Absolut ~100 range, 12 dmg, 1.35s cd)
  if (botAi.meleeCd <= 0 && dist < 100 && foe.hp > 0) {
    botAi.meleeCd = 1.35;
    botAi.shootCd = Math.max(botAi.shootCd, 0.45);
    send(botClient, "fx", {
      kind: "bash",
      playerId: s.id,
      fighter: "usa",
      x: s.x,
      y: s.y,
      aimX: foe.x,
      aimY: foe.y,
      facing: s.facing,
      ts: Date.now(),
    });
    send(botClient, "hit", {
      amount: 12,
      from: s.id,
      ts: Date.now(),
    });
    console.log("[DevBot] melee hit 12");
  } else if (botAi.shootCd <= 0 && dist < 480 && dist > 90 && foe.hp > 0) {
    // Easy ranged poke ( Absolut bottle shot ~10 dmg )
    botAi.shootCd = 1.5 + Math.random() * 0.7;
    send(botClient, "fx", {
      kind: "charged",
      playerId: s.id,
      fighter: "usa",
      x: s.x,
      y: s.y,
      aimX: foe.x,
      aimY: foe.y,
      facing: s.facing,
      ts: Date.now(),
    });
    // Only apply damage if roughly aimed (easy misses more)
    if (Math.random() > 0.35) {
      send(botClient, "hit", {
        amount: 10,
        from: s.id,
        ts: Date.now(),
      });
      console.log("[DevBot] ranged hit 10");
    }
  }

  botAi.sendAcc += dt;
  // ~12 Hz state — enough for Easy Bot without flooding
  if (botAi.sendAcc >= 0.08) {
    botAi.sendAcc = 0;
    publishBotState();
  }
}

function publishBotState() {
  if (!botAi || !botClient) return;
  const s = botAi.self;
  send(botClient, "state", {
    playerId: s.id,
    x: Math.round(s.x),
    y: Math.round(s.y),
    hp: s.hp,
    maxHp: s.maxHp,
    facing: s.facing,
    fighter: s.fighter,
    radius: s.radius,
    lives: s.lives,
    aimX: Math.round(s.aimX),
    aimY: Math.round(s.aimY),
    plunging: false,
    ts: Date.now(),
  });
}

function handleCreateRoom(ws, payload) {
  const peer = peers.get(ws);
  if (!peer) return;
  removeFromRoom(ws, "switch_room");
  // Dev: Host button also lands in fixed room so Join/Host both work
  const code = DEV_CODE;
  const room = ensureDevRoom(code);
  if (room.started) {
    send(ws, "error", { message: "Dev room match in progress — refresh bot server." });
    return;
  }
  room.members.add(ws);
  peer.roomCode = code;
  peer.ready = false;
  applyFighterName(peer, payload);
  send(ws, "room_created", { code, playerId: peer.id });
  broadcastRoomState(room, "create");
  console.log("[DevBot] human host in", code, peer.id);
  scheduleBotSpawn(code);
}

function applyFighterName(peer, payload) {
  const ok = [
    "usa",
    "japan",
    "russia",
    "france",
    "uk",
    "china",
    "canada",
  ];
  if (ok.indexOf(payload?.fighter) >= 0) peer.fighter = payload.fighter;
  if (typeof payload?.name === "string" && payload.name.trim()) {
    peer.name = String(payload.name).trim().slice(0, 16);
  }
}

function handleJoinRoom(ws, payload) {
  const peer = peers.get(ws);
  if (!peer) return;
  const code = String(payload?.code || "").trim();
  if (!/^\d{5}$/.test(code)) {
    send(ws, "error", { message: "Enter a 5-digit room code." });
    return;
  }

  // Fixed dev room: create on join so human never needs a prior Host
  let room;
  if (code === DEV_CODE) {
    room = ensureDevRoom(code);
  } else {
    room = rooms.get(code);
    if (!room) {
      send(ws, "error", { message: "Room not found. Use code " + DEV_CODE + " for Easy Bot." });
      return;
    }
  }

  if (room.started) {
    send(ws, "error", { message: "Match already started." });
    return;
  }
  if (room.members.size >= ROOM_CAPACITY) {
    send(ws, "error", { message: "Room is full." });
    return;
  }

  removeFromRoom(ws, "switch_room");
  room.members.add(ws);
  peer.roomCode = code;
  peer.ready = !!payload?._devBot;
  peer.isBot = !!payload?._devBot;
  if (peer.isBot) {
    peer.name = "Easy Bot";
    peer.fighter = "usa";
    peer.ready = true;
  } else {
    applyFighterName(peer, payload);
  }

  send(ws, "room_joined", { code, playerId: peer.id });

  // Human joiner is always Host (slot 0); Easy Bot stays Guest
  if (!peer.isBot && code === DEV_CODE) {
    const ordered = [ws];
    room.members.forEach(function (m) {
      if (m !== ws) ordered.push(m);
    });
    room.members = new Set(ordered);
  }

  broadcastRoomState(room, "join");
  console.log(
    "[DevBot] join",
    code,
    peer.isBot ? "BOT" : "human",
    peer.id,
    "members=" + room.members.size
  );

  // Human joined fixed room → spawn bot guest
  if (!peer.isBot && code === DEV_CODE) {
    scheduleBotSpawn(code);
  }
}

function handleLeaveRoom(ws) {
  const peer = peers.get(ws);
  const wasBot = peer && peer.isBot;
  removeFromRoom(ws, "leave");
  send(ws, "left_room", {});
  if (wasBot) stopBotAi();
}

function handleReady(ws, payload) {
  const peer = peers.get(ws);
  if (!peer || !peer.roomCode) {
    send(ws, "error", { message: "Join a room first." });
    return;
  }
  const next =
    typeof payload?.ready === "boolean" ? payload.ready : !peer.ready;
  if (peer.ready === next) return; // no-op — stop ready/room_state storms
  peer.ready = next;
  const room = rooms.get(peer.roomCode);
  if (room) broadcastRoomState(room, "ready");
}

function handleSetLoadout(ws, payload) {
  const peer = peers.get(ws);
  if (!peer) return;
  applyFighterName(peer, payload);
  if (!peer.roomCode) return;
  const room = rooms.get(peer.roomCode);
  if (!room || room.started) return;
  if (
    (payload?.mapId === "plains" || payload?.mapId === "icy") &&
    hostSocket(room) === ws
  ) {
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
    send(ws, "error", { message: "Need Easy Bot — wait a moment and retry." });
    return;
  }
  if (payload?.mapId === "plains" || payload?.mapId === "icy") {
    room.mapId = payload.mapId;
  }
  room.started = true;
  room.members.forEach(function (member) {
    const p = peers.get(member);
    if (p) p.ready = true;
  });
  const startPayload = {
    code: room.code,
    mapId: room.mapId,
    players: roomPlayers(room),
    seed: Date.now() % 100000,
  };
  room.members.forEach(function (member) {
    send(member, "start_match", startPayload);
  });
  broadcastRoomState(room, "start");
  console.log("[DevBot] start_match", room.code, roomPlayers(room).map((p) => p.name).join(" vs "));
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
  if (type === "state" || type === "input" || type === "hit" || type === "fx" || type === "round_ko") {
    const peer = peers.get(ws);
    if (!peer || !peer.roomCode) return;
    const room = rooms.get(peer.roomCode);
    if (!room) return;
    broadcastOthers(room, ws, type, payload);
    return;
  }
  send(ws, "error", { message: "Unknown message type: " + type });
}

// —— HTTP static (serves code/) ——
const httpServer = http.createServer(function (req, res) {
  try {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.normalize(path.join(CODE_ROOT, urlPath));
    if (!filePath.startsWith(CODE_ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err && err.message));
  }
});

httpServer.on("error", function (err) {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      "[DevBot] HTTP port " +
        HTTP_PORT +
        " already in use — a DevBot is probably already running.\n" +
        "  Open http://127.0.0.1:" +
        HTTP_PORT +
        "/  or stop the old process:\n" +
        "  lsof -nP -iTCP:" +
        HTTP_PORT +
        " -sTCP:LISTEN"
    );
    process.exit(1);
  }
  throw err;
});

httpServer.listen(HTTP_PORT, "127.0.0.1", function () {
  console.log("[DevBot] game  http://127.0.0.1:" + HTTP_PORT + "/");
});

const wss = new WebSocketServer({ port: WS_PORT, host: "127.0.0.1" });
wss.on("error", function (err) {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      "[DevBot] WS port " +
        WS_PORT +
        " already in use — stop the other server first:\n" +
        "  lsof -nP -iTCP:" +
        WS_PORT +
        " -sTCP:LISTEN"
    );
    process.exit(1);
  }
  throw err;
});
wss.on("connection", function (ws) {
  const id = randomUUID();
  peers.set(ws, {
    id,
    roomCode: null,
    isAlive: true,
    ready: false,
    fighter: "usa",
    name: "Player",
    isBot: false,
  });
  send(ws, "hello", { playerId: id, server: "dev-bot", roomHint: DEV_CODE });
  ws.on("message", function (raw) {
    handleMessage(ws, raw);
  });
  ws.on("close", function () {
    const peer = peers.get(ws);
    if (peer && peer.isBot) stopBotAi();
    removeFromRoom(ws, "disconnect");
    peers.delete(ws);
  });
});

console.log("[DevBot] ws    ws://127.0.0.1:" + WS_PORT);
console.log("[DevBot] room  " + DEV_CODE + "  (Join → you = Host, Easy Bot = Guest)");
console.log("[DevBot] tip   Open the HTTP URL above (localhost → auto ws://localhost:8080)");
