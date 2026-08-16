window.CBNetProtocol = (function () {
  // Set this once for production so players never need to paste URLs.
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
    SET_LOADOUT: "set_loadout",
    START_MATCH: "start_match",
    STATE: "state",
    INPUT: "input",
    HIT: "hit",
    ROUND_KO: "round_ko",
  };

  function defaultWsUrl() {
    if (window.CB_MULTIPLAYER_WS_URL) {
      return String(window.CB_MULTIPLAYER_WS_URL).trim();
    }
    // Local pages must hit the local WS (DevBot / server.js), not production.
    // Use 127.0.0.1 so we don't land on a different process bound to localhost/:8080.
    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocal) return "ws://127.0.0.1:8080";
    if (FIXED_MULTIPLAYER_WS_URL) return FIXED_MULTIPLAYER_WS_URL;
    return window.location.origin.replace(/^http/, "ws") + "/ws";
  }

  return {
    TYPES: TYPES,
    defaultWsUrl: defaultWsUrl,
  };
})();
