window.CBMultiplayerUI = (function () {
  const keyState = Object.create(null);
  const btnState = { mouse: false, special: false, ult: false };
  let inputSeq = 0;
  let inputTimer = 0;

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const node = el(id);
    if (node) node.textContent = text;
  }

  function setStatus(text, ok) {
    const node = el("mp-status");
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("is-ok", !!ok);
    node.classList.toggle("is-bad", !ok);
  }

  function wireClient() {
    if (!window.CBNetClient) return;
    CBNetClient.setHandlers({
      status: function (evt) {
        setStatus(evt.message || "Status", !!evt.ok);
        if (!evt.ok) setText("mp-room", "Room: —");
      },
      error: function (evt) {
        setStatus(evt.message || "Network error", false);
      },
      message: function (evt) {
        const t = evt.type;
        const p = evt.payload || {};
        if (t === "error") {
          setStatus(p.message || "Server error", false);
          return;
        }
        if (t === "room_created") {
          setText("mp-room", "Room: " + (p.code || "—") + " (host)");
          setStatus("Room created", true);
          return;
        }
        if (t === "room_joined") {
          setText("mp-room", "Room: " + (p.code || "—") + " (joined)");
          setStatus("Joined room", true);
          return;
        }
        if (t === "room_state") {
          const players = Array.isArray(p.players) ? p.players.length : 0;
          const cap = typeof p.capacity === "number" ? p.capacity : 2;
          setText("mp-room", "Room: " + (p.code || "—") + " · players " + players + "/" + cap);
          setStatus("Lobby updated", true);
          return;
        }
        if (t === "left_room") {
          setText("mp-room", "Room: —");
          setStatus("Left room", true);
          if (window.CBGame && CBGame.clearRemoteSnapshot) CBGame.clearRemoteSnapshot();
          return;
        }
        if (t === "state") {
          if (window.CBGame && CBGame.setRemoteSnapshot) {
            CBGame.setRemoteSnapshot(p);
          }
        }
      },
    });
  }

  function pumpInput() {
    if (!window.CBNetClient || !CBNetClient.sendInput) return;
    const st = CBNetClient.getState ? CBNetClient.getState() : null;
    if (!st || !st.connected || !st.roomCode) return;
    CBNetClient.sendInput({
      seq: ++inputSeq,
      keys: {
        left: !!keyState.KeyA || !!keyState.ArrowLeft,
        right: !!keyState.KeyD || !!keyState.ArrowRight,
        jump: !!keyState.KeyW || !!keyState.ArrowUp || !!keyState.Space,
      },
      buttons: {
        mouse: !!btnState.mouse,
        special: !!btnState.special,
        ult: !!btnState.ult,
      },
      ts: Date.now(),
    });
    btnState.special = false;
    btnState.ult = false;
  }

  function init() {
    const panelBtn = el("nav-multiplayer");
    const panel = el("mp-panel");
    const codeInput = el("mp-code");

    if (panelBtn && panel) {
      panelBtn.addEventListener("click", function () {
        panel.classList.toggle("screen-hidden");
      });
    }

    const defaultUrl =
      window.CBNetProtocol && CBNetProtocol.defaultWsUrl
        ? CBNetProtocol.defaultWsUrl()
        : "ws://localhost:8080";

    wireClient();
    setStatus("Connecting...", true);
    CBNetClient.connect(defaultUrl);

    const hostBtn = el("mp-host");
    if (hostBtn) {
      hostBtn.addEventListener("click", function () {
        const st = CBNetClient.getState ? CBNetClient.getState() : null;
        if (!st || !st.connected) {
          setStatus("Reconnecting...", false);
          CBNetClient.connect(defaultUrl);
          return;
        }
        if (!CBNetClient.createRoom()) {
          setStatus("Try again in 1 sec", false);
        }
      });
    }

    const joinBtn = el("mp-join");
    if (joinBtn) {
      joinBtn.addEventListener("click", function () {
        const code = (codeInput && codeInput.value.trim()) || "";
        if (!/^\d{5}$/.test(code)) {
          setStatus("Enter 5-digit code", false);
          return;
        }
        const st = CBNetClient.getState ? CBNetClient.getState() : null;
        if (!st || !st.connected) {
          setStatus("Reconnecting...", false);
          CBNetClient.connect(defaultUrl);
          return;
        }
        if (!CBNetClient.joinRoom(code)) {
          setStatus("Try again in 1 sec", false);
        }
      });
    }

    const leaveBtn = el("mp-leave");
    if (leaveBtn) {
      leaveBtn.addEventListener("click", function () {
        if (!CBNetClient.leaveRoom()) {
          setStatus("Not connected", false);
        }
      });
    }

    const readyBtn = el("mp-ready");
    if (readyBtn) {
      readyBtn.addEventListener("click", function () {
        if (!CBNetClient.ready()) {
          setStatus("Not connected", false);
          return;
        }
        setStatus("Ready sent", true);
      });
    }

    window.addEventListener("keydown", function (e) {
      keyState[e.code] = true;
      if (e.code === "KeyE") btnState.special = true;
      if (e.code === "KeyQ") btnState.ult = true;
    });
    window.addEventListener("keyup", function (e) {
      keyState[e.code] = false;
    });
    window.addEventListener("mousedown", function (e) {
      if (e.button === 0) btnState.mouse = true;
    });
    window.addEventListener("mouseup", function (e) {
      if (e.button === 0) btnState.mouse = false;
    });

    setInterval(function () {
      inputTimer += 1;
      if (inputTimer >= 1) {
        inputTimer = 0;
        pumpInput();
      }
    }, 50);
  }

  return { init: init };
})();
