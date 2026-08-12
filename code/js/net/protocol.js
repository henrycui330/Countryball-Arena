window.CBNetProtocol = (function () {
  // Set this once for production so players never need to paste URLs.
  // Example: "wss://countryball-arena-multiplayer.yourname.workers.dev/ws"
  const FIXED_MULTIPLAYER_WS_URL =
    "wss://countryball-arena-multiplayer.henrycui330.workers.dev/ws";

  const TYPES = {
    HELLO: "hello",
    ERROR: "error",
    ROOM_CREATED: "room_created",
    ROOM_JOINED: "room_joined",
    LEFT_ROOM: "left_room",
    ROOM_STATE: "room_state",
    CREATE_ROOM: "create_room",
    JOIN_ROOM: "join_room",
    LEAVE_ROOM: "leave_room",
    READY: "ready",
  };

  function defaultWsUrl() {
    if (window.CB_MULTIPLAYER_WS_URL) {
      return String(window.CB_MULTIPLAYER_WS_URL).trim();
    }
    if (FIXED_MULTIPLAYER_WS_URL) return FIXED_MULTIPLAYER_WS_URL;
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocal) return "ws://localhost:8080";
    return window.location.origin.replace(/^http/, "ws") + "/ws";
  }

  return {
    TYPES: TYPES,
    defaultWsUrl: defaultWsUrl,
  };
})();
