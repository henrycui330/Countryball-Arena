window.CBNetClient = (function () {
  let ws = null;
  let state = {
    connected: false,
    url: null,
    playerId: null,
    roomCode: null,
  };
  let handlers = {};

  function emit(name, payload) {
    const fn = handlers && handlers[name];
    if (typeof fn === "function") fn(payload || {});
  }

  function setHandlers(next) {
    handlers = next || {};
  }

  function send(type, payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: type, payload: payload || {} }));
    return true;
  }

  function connect(url) {
    if (ws && ws.readyState <= WebSocket.OPEN) {
      try {
        ws.close();
      } catch (_) {}
    }
    state.url = url;
    ws = new WebSocket(url);

    ws.addEventListener("open", function () {
      state.connected = true;
      emit("status", { ok: true, message: "Connected", state: Object.assign({}, state) });
    });

    ws.addEventListener("close", function () {
      state.connected = false;
      state.playerId = null;
      state.roomCode = null;
      emit("status", { ok: false, message: "Disconnected", state: Object.assign({}, state) });
    });

    ws.addEventListener("error", function () {
      emit("status", { ok: false, message: "Socket error", state: Object.assign({}, state) });
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
      }
      if (type === "room_created" || type === "room_joined" || type === "room_state") {
        state.roomCode = payload.code || state.roomCode;
      }
      if (type === "left_room") {
        state.roomCode = null;
      }
      emit("message", { type: type, payload: payload, state: Object.assign({}, state) });
    });
  }

  function disconnect() {
    if (!ws) return;
    try {
      ws.close();
    } catch (_) {}
  }

  function createRoom(extra) {
    return send("create_room", extra || {});
  }

  function joinRoom(code) {
    return send("join_room", { code: String(code || "").trim().toUpperCase() });
  }

  function leaveRoom() {
    return send("leave_room", {});
  }

  function ready() {
    return send("ready", {});
  }

  function sendState(snapshot) {
    return send("state", snapshot || {});
  }

  function sendInput(frame) {
    return send("input", frame || {});
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
    sendState: sendState,
    sendInput: sendInput,
    getState: getState,
  };
})();
