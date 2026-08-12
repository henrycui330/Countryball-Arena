window.CBNetClient = (function () {
  let ws = null;
  let state = {
    connected: false,
    url: null,
    playerId: null,
    roomCode: null,
  };
  let handlers = {};
  let reconnectTimer = 0;
  let wantUrl = null;
  let pendingAction = null;
  let sessionRoomCode = null;
  let sessionJoinPayload = null;
  let sessionWasHost = false;

  function emit(name, payload) {
    const fn = handlers && handlers[name];
    if (typeof fn === "function") fn(payload || {});
  }

  function setHandlers(next) {
    handlers = next || {};
  }

  function send(type, payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify({ type: type, payload: payload || {} }));
      return true;
    } catch (err) {
      console.warn("[CBNetClient] send failed", err);
      return false;
    }
  }

  function rememberRoom(code, extra, isHost) {
    sessionRoomCode = code ? String(code).trim() : null;
    sessionJoinPayload = extra ? Object.assign({}, extra) : null;
    sessionWasHost = !!isHost;
  }

  function clearSessionRoom() {
    sessionRoomCode = null;
    sessionJoinPayload = null;
    sessionWasHost = false;
  }

  function rejoinSessionRoom() {
    if (!sessionRoomCode || !state.connected) return;
    const payload = Object.assign({}, sessionJoinPayload || {}, { code: sessionRoomCode });
    console.log("[CBNetClient] rejoin after reconnect", sessionRoomCode);
    send("join_room", payload);
  }

  function flushPending() {
    if (!pendingAction || !state.connected) return;
    const action = pendingAction;
    pendingAction = null;
    let ok = false;
    if (action.kind === "create") {
      ok = send("create_room", action.payload || {});
      console.log("[CBNetClient] pending create_room", ok);
    } else if (action.kind === "join") {
      ok = send(
        "join_room",
        Object.assign({}, action.payload || {}, { code: String(action.code || "").trim() })
      );
      console.log("[CBNetClient] pending join_room", ok, action.code);
    }
    if (!ok) {
      emit("status", {
        ok: false,
        message: "Could not send — still connecting",
        state: Object.assign({}, state),
      });
    }
  }

  function connect(url) {
    wantUrl = url || wantUrl;
    if (!wantUrl) {
      console.warn("[CBNetClient] connect missing url");
      return;
    }

    if (
      ws &&
      ws.readyState === WebSocket.OPEN &&
      state.url === wantUrl &&
      state.connected
    ) {
      flushPending();
      return;
    }

    if (ws && ws.readyState === WebSocket.CONNECTING && state.url === wantUrl) {
      console.log("[CBNetClient] already connecting", wantUrl);
      return;
    }

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      try {
        ws.close();
      } catch (_) {}
    }

    state.url = wantUrl;
    state.connected = false;
    console.log("[CBNetClient] connecting", wantUrl);
    ws = new WebSocket(wantUrl);

    ws.addEventListener("open", function () {
      state.connected = true;
      console.log("[CBNetClient] open");
      emit("status", { ok: true, message: "Online", state: Object.assign({}, state) });
      flushPending();
    });

    ws.addEventListener("close", function (ev) {
      state.connected = false;
      state.playerId = null;
      state.roomCode = null;
      console.warn("[CBNetClient] close", ev && ev.code, ev && ev.reason);
      emit("status", {
        ok: false,
        message: "Offline — retrying…",
        state: Object.assign({}, state),
      });
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(function () {
        if (wantUrl) connect(wantUrl);
      }, 1800);
    });

    ws.addEventListener("error", function () {
      console.warn("[CBNetClient] socket error", wantUrl);
      emit("status", {
        ok: false,
        message: "Connection problem — check network",
        state: Object.assign({}, state),
      });
    });

    ws.addEventListener("message", function (event) {
      let msg = null;
      try {
        msg = JSON.parse(String(event.data || ""));
      } catch (_) {
        emit("error", { message: "Bad message JSON" });
        return;
      }
      const type = msg && msg.type;
      const payload = (msg && msg.payload) || {};
      if (type === "hello") {
        state.playerId = payload.playerId || null;
        console.log("[CBNetClient] hello", state.playerId);
        if (sessionRoomCode) rejoinSessionRoom();
      }
      if (type === "room_created") {
        state.roomCode = payload.code || state.roomCode;
        rememberRoom(state.roomCode, sessionJoinPayload, true);
      }
      if (type === "room_joined" || type === "room_state") {
        state.roomCode = payload.code || state.roomCode;
        if (type === "room_joined") {
          rememberRoom(state.roomCode, sessionJoinPayload, sessionWasHost);
        }
      }
      if (type === "left_room") {
        state.roomCode = null;
        clearSessionRoom();
      }
      emit("message", { type: type, payload: payload, state: Object.assign({}, state) });
    });
  }

  function disconnect() {
    wantUrl = null;
    pendingAction = null;
    clearSessionRoom();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = 0;
    if (!ws) return;
    try {
      ws.close();
    } catch (_) {}
  }

  function createRoom(extra) {
    sessionJoinPayload = extra ? Object.assign({}, extra) : null;
    if (send("create_room", extra || {})) return true;
    pendingAction = { kind: "create", payload: extra || {} };
    connect(wantUrl || state.url);
    return false;
  }

  function joinRoom(code, extra) {
    const payload = Object.assign({}, extra || {}, { code: String(code || "").trim() });
    rememberRoom(payload.code, extra || {}, false);
    if (send("join_room", payload)) return true;
    pendingAction = { kind: "join", code: payload.code, payload: extra || {} };
    connect(wantUrl || state.url);
    return false;
  }

  function leaveRoom() {
    clearSessionRoom();
    return send("leave_room", {});
  }

  function ready(readyFlag) {
    const payload = {};
    if (typeof readyFlag === "boolean") payload.ready = readyFlag;
    return send("ready", payload);
  }

  function setLoadout(extra) {
    return send("set_loadout", extra || {});
  }

  function startMatch(extra) {
    return send("start_match", extra || {});
  }

  function sendState(snapshot) {
    return send("state", snapshot || {});
  }

  function sendInput(frame) {
    return send("input", frame || {});
  }

  function sendHit(hit) {
    return send("hit", hit || {});
  }

  function getState() {
    return Object.assign({}, state);
  }

  return {
    setHandlers: setHandlers,
    connect: connect,
    disconnect: disconnect,
    createRoom: createRoom,
    joinRoom: joinRoom,
    leaveRoom: leaveRoom,
    ready: ready,
    setLoadout: setLoadout,
    startMatch: startMatch,
    sendState: sendState,
    sendInput: sendInput,
    sendHit: sendHit,
    getState: getState,
  };
})();
