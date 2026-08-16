window.CBMultiplayerUI = (function () {
  const FIGHTER_LABEL = { usa: "USA", japan: "Japan", russia: "Russia", france: "France", uk: "UK", china: "China", canada: "Canada" };
  const FIGHTER_SPRITE = {
    usa: "assets/usa.png",
    japan: "assets/japan.png",
    russia: "assets/russia.png",
    france: "assets/france.png",
    uk: "assets/uk.png",
    china: "assets/china.png",
    canada: "assets/canada.png",
  };

  let onStartMatch = null;
  let roomPlayers = [];
  let roomCode = null;
  let mapId = "plains";
  let fighter = "usa";
  let isHost = false;
  let myReady = false;
  let connected = false;
  let panel = "home"; // home | join | lobby

  function el(id) {
    return document.getElementById(id);
  }

  function setStatus(text, ok) {
    const node = el("mp-status");
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("is-ok", ok === true);
    node.classList.toggle("is-bad", ok === false);
    console.log("[CBMultiplayerUI] status", text, ok);
  }

  function playerName() {
    if (window.CBAuth && CBAuth.getUsername) {
      const n = CBAuth.getUsername();
      if (n) return String(n).slice(0, 16);
    }
    return "Player";
  }

  function fighterOwned(id) {
    if (id === "usa") return true;
    if (window.CBCountryballs && CBCountryballs.isCharacterOwned) {
      return CBCountryballs.isCharacterOwned(id);
    }
    return true;
  }

  function showPanel(name) {
    panel = name;
    ["mp-panel-home", "mp-panel-join", "mp-panel-lobby"].forEach(function (id) {
      const node = el(id);
      if (!node) return;
      const want =
        (id === "mp-panel-home" && name === "home") ||
        (id === "mp-panel-join" && name === "join") ||
        (id === "mp-panel-lobby" && name === "lobby");
      node.classList.toggle("screen-hidden", !want);
    });
  }

  function renderLobby() {
    const codeEl = el("mp-code-display");
    if (codeEl) codeEl.textContent = roomCode || "— — — — —";

    const list = el("mp-player-list");
    if (list) {
      list.innerHTML = "";
      roomPlayers.forEach(function (p) {
        const row = document.createElement("div");
        row.className = "mp-player-row" + (p.ready ? " is-ready" : "");
        const img = document.createElement("img");
        img.src = FIGHTER_SPRITE[p.fighter] || FIGHTER_SPRITE.usa;
        img.alt = "";
        img.width = 44;
        img.height = 44;
        const meta = document.createElement("div");
        meta.className = "mp-player-meta";
        const title = document.createElement("p");
        title.className = "mp-player-name";
        title.textContent =
          (p.name || "Player") +
          (p.isHost ? " · Host" : "") +
          (p.id === (CBNetClient.getState().playerId || "") ? " · You" : "");
        const sub = document.createElement("p");
        sub.className = "mp-player-sub";
        sub.textContent =
          (FIGHTER_LABEL[p.fighter] || p.fighter) +
          " · " +
          (p.ready ? "Ready" : "Not ready");
        meta.appendChild(title);
        meta.appendChild(sub);
        row.appendChild(img);
        row.appendChild(meta);
        list.appendChild(row);
      });
    }

    const readyBtn = el("mp-ready");
    if (readyBtn) {
      readyBtn.textContent = myReady ? "Unready" : "I'm Ready";
      readyBtn.classList.toggle("is-selected", myReady);
    }

    const startBtn = el("mp-start");
    if (startBtn) {
      startBtn.classList.toggle("screen-hidden", !isHost);
      startBtn.disabled = roomPlayers.length < 2;
      startBtn.textContent =
        roomPlayers.length < 2 ? "Waiting for friend…" : "Start Fight";
    }

    const hostHint = el("mp-host-hint");
    if (hostHint) {
      hostHint.classList.toggle("screen-hidden", !isHost);
    }

    syncFighterButtons();
    syncMapButtons();
  }

  function syncFighterButtons() {
    document.querySelectorAll("#screen-multiplayer [data-mp-fighter]").forEach(function (btn) {
      const id = btn.getAttribute("data-mp-fighter");
      const owned = fighterOwned(id);
      btn.classList.toggle("is-selected", id === fighter);
      btn.classList.toggle("is-locked", !owned);
      btn.disabled = !owned;
    });
  }

  function syncMapButtons() {
    document.querySelectorAll("#screen-multiplayer [data-mp-map]").forEach(function (btn) {
      const id = btn.getAttribute("data-mp-map");
      btn.classList.toggle("is-selected", id === mapId);
      btn.disabled = !isHost;
    });
  }

  function applyRoomState(p) {
    roomCode = p.code || roomCode;
    roomPlayers = Array.isArray(p.players) ? p.players : [];
    if (p.mapId === "plains" || p.mapId === "icy") mapId = p.mapId;
    const me = roomPlayers.find(function (pl) {
      return pl.id === CBNetClient.getState().playerId;
    });
    isHost = !!(me && me.isHost);
    myReady = !!(me && me.ready);
    if (me && me.fighter) fighter = me.fighter;
    showPanel("lobby");
    renderLobby();
    setStatus(
      "Room " +
        (roomCode || "—") +
        " · " +
        roomPlayers.length +
        "/" +
        (p.capacity || 4) +
        " players",
      true
    );
  }

  function wireClient() {
    if (!window.CBNetClient) return;
    CBNetClient.setHandlers({
      status: function (evt) {
        connected = !!evt.ok;
        setStatus(evt.message || (evt.ok ? "Online" : "Offline"), !!evt.ok);
        const badge = el("mp-online-badge");
        if (badge) {
          badge.textContent = evt.ok ? "Online" : "Offline";
          badge.classList.toggle("is-ok", !!evt.ok);
          badge.classList.toggle("is-bad", !evt.ok);
        }
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
        if (t === "room_created" || t === "room_joined") {
          roomCode = p.code || roomCode;
          isHost = t === "room_created";
          showPanel("lobby");
          renderLobby();
          setStatus(
            t === "room_created"
              ? "Room " + (roomCode || "") + " — share this code"
              : "Joined room " + (p.code || ""),
            true
          );
          console.log("[CBMultiplayerUI]", t, roomCode);
          // room_state usually follows; keep going if it does.
          return;
        }
        if (t === "room_state") {
          applyRoomState(p);
          return;
        }
        if (t === "left_room") {
          roomCode = null;
          roomPlayers = [];
          myReady = false;
          isHost = false;
          showPanel("home");
          setStatus("Left room", true);
          if (window.CBGame && CBGame.clearRemoteSnapshot) CBGame.clearRemoteSnapshot();
          return;
        }
        if (t === "start_match") {
          beginLocalMatch(p);
          return;
        }
        if (t === "state") {
          if (window.CBGame && CBGame.setRemoteSnapshot) CBGame.setRemoteSnapshot(p);
          return;
        }
        if (t === "hit") {
          if (window.CBGame && CBGame.applyRemoteHit) CBGame.applyRemoteHit(p);
          return;
        }
        if (t === "fx") {
          if (window.CBGame && CBGame.applyRemoteFx) CBGame.applyRemoteFx(p);
        }
      },
    });
  }

  function beginLocalMatch(payload) {
    const me = (payload.players || []).find(function (pl) {
      return pl.id === CBNetClient.getState().playerId;
    });
    const cfg = {
      matchType: "multiplayer",
      opponent: "multiplayer",
      mapId: payload.mapId === "icy" ? "icy" : "plains",
      lives: 3,
      fighter: (me && me.fighter) || fighter || "usa",
      roomCode: payload.code || roomCode,
      players: payload.players || [],
    };
    setStatus("Fight!", true);
    console.log("[CBMultiplayerUI] start_match", cfg);
    if (typeof onStartMatch === "function") onStartMatch(cfg);
  }

  function ensureConnected(defaultUrl) {
    const st = CBNetClient.getState ? CBNetClient.getState() : null;
    if (st && st.connected) return true;
    setStatus("Connecting to multiplayer…", false);
    CBNetClient.connect(defaultUrl);
    return false;
  }

  function syncHostJoinEnabled() {
    const hostBtn = el("mp-host");
    const joinBtn = el("mp-join");
    const openJoin = el("mp-open-join");
    // Keep clickable even offline — client queues the action.
    if (hostBtn) hostBtn.disabled = false;
    if (joinBtn) joinBtn.disabled = false;
    if (openJoin) openJoin.disabled = false;
  }

  function init(handlers) {
    onStartMatch = handlers && handlers.onStartMatch;
    const defaultUrl =
      window.CBNetProtocol && CBNetProtocol.defaultWsUrl
        ? CBNetProtocol.defaultWsUrl()
        : "ws://localhost:8080";
    console.log("[CBMultiplayerUI] ws url", defaultUrl);

    wireClient();
    showPanel("home");
    setStatus("Connecting…", true);
    CBNetClient.connect(defaultUrl);
    syncHostJoinEnabled();

    const hostBtn = el("mp-host");
    if (hostBtn) {
      hostBtn.addEventListener("click", function () {
        console.log("[CBMultiplayerUI] Host clicked", CBNetClient.getState());
        setStatus(
          ensureConnected(defaultUrl)
            ? "Creating room…"
            : "Connecting, then creating room…",
          true
        );
        const sent = CBNetClient.createRoom({
          fighter: fighter,
          mapId: mapId,
          name: playerName(),
        });
        if (sent) setStatus("Creating room…", true);
        else setStatus("Connecting, then creating room…", true);
      });
    }

    const openJoin = el("mp-open-join");
    if (openJoin) {
      openJoin.addEventListener("click", function () {
        showPanel("join");
        const input = el("mp-code");
        if (input) {
          input.value = "";
          input.focus();
        }
      });
    }

    const joinBack = el("mp-join-back");
    if (joinBack) {
      joinBack.addEventListener("click", function () {
        showPanel("home");
      });
    }

    const joinBtn = el("mp-join");
    if (joinBtn) {
      joinBtn.addEventListener("click", function () {
        const code = ((el("mp-code") && el("mp-code").value) || "").trim();
        if (!/^\d{5}$/.test(code)) {
          setStatus("Type the 5-digit code", false);
          return;
        }
        console.log("[CBMultiplayerUI] Join clicked", code, CBNetClient.getState());
        ensureConnected(defaultUrl);
        const sent = CBNetClient.joinRoom(code, {
          fighter: fighter,
          name: playerName(),
        });
        setStatus(sent ? "Joining…" : "Connecting, then joining…", true);
      });
    }

    const leaveBtn = el("mp-leave");
    if (leaveBtn) {
      leaveBtn.addEventListener("click", function () {
        if (!CBNetClient.leaveRoom()) setStatus("Not connected", false);
        showPanel("home");
      });
    }

    const readyBtn = el("mp-ready");
    if (readyBtn) {
      readyBtn.addEventListener("click", function () {
        if (!CBNetClient.ready(!myReady)) {
          setStatus("Not connected", false);
          return;
        }
      });
    }

    const startBtn = el("mp-start");
    if (startBtn) {
      startBtn.addEventListener("click", function () {
        if (!isHost) return;
        if (!CBNetClient.startMatch({ mapId: mapId })) {
          setStatus("Not connected", false);
        }
      });
    }

    const copyBtn = el("mp-copy-code");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        if (!roomCode) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(roomCode).then(
            function () {
              setStatus("Code copied!", true);
            },
            function () {
              setStatus("Code: " + roomCode, true);
            }
          );
        } else {
          setStatus("Code: " + roomCode, true);
        }
      });
    }

    document.querySelectorAll("#screen-multiplayer [data-mp-fighter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-mp-fighter");
        if (!fighterOwned(id)) return;
        fighter = id;
        syncFighterButtons();
        if (roomCode) {
          CBNetClient.setLoadout({ fighter: fighter, name: playerName() });
        }
      });
    });

    document.querySelectorAll("#screen-multiplayer [data-mp-map]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!isHost) {
          setStatus("Only host picks the map", false);
          return;
        }
        const id = btn.getAttribute("data-mp-map");
        if (id !== "plains" && id !== "icy") return;
        mapId = id;
        syncMapButtons();
        if (roomCode) CBNetClient.setLoadout({ mapId: mapId, fighter: fighter });
      });
    });

    const codeInput = el("mp-code");
    if (codeInput) {
      codeInput.addEventListener("input", function () {
        codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 5);
      });
      codeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") joinBtn && joinBtn.click();
      });
    }

    renderLobby();
  }

  function show() {
    const screen = el("screen-multiplayer");
    if (screen) screen.classList.remove("screen-hidden");
    if (!roomCode) showPanel("home");
    else showPanel("lobby");
    renderLobby();
    const st = window.CBNetClient && CBNetClient.getState ? CBNetClient.getState() : null;
    if (!st || !st.connected) {
      const url =
        (st && st.url) ||
        (window.CBNetProtocol && CBNetProtocol.defaultWsUrl && CBNetProtocol.defaultWsUrl()) ||
        null;
      setStatus("Connecting…", false);
      if (url) CBNetClient.connect(url);
    } else {
      setStatus("Online", true);
      const badge = el("mp-online-badge");
      if (badge) {
        badge.textContent = "Online";
        badge.classList.add("is-ok");
        badge.classList.remove("is-bad");
      }
    }
  }

  function hide() {
    const screen = el("screen-multiplayer");
    if (screen) screen.classList.add("screen-hidden");
  }

  return { init: init, show: show, hide: hide };
})();
