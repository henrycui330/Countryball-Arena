(function () {
  function hideAllOverlayScreens() {
    ["screen-result", "screen-win", "screen-game", "screen-auth"].forEach(
      function (id) {
        const el = document.getElementById(id);
        if (el) el.classList.add("screen-hidden");
      }
    );
  }

  function syncTitleUser() {
    const wrap = document.getElementById("title-user");
    const name = document.getElementById("title-username");
    const loggedIn = window.CBAuth && CBAuth.isLoggedIn();
    if (wrap) wrap.classList.toggle("screen-hidden", !loggedIn);
    if (name) name.textContent = loggedIn ? CBAuth.getUsername() || "—" : "—";
  }

  function enterApp(opts) {
    hideAllOverlayScreens();
    syncTitleUser();
    window.CBMenu.show();
    const startTut =
      opts &&
      opts.startTutorial &&
      window.CBTutorial &&
      CBTutorial.start;
    if (startTut) {
      setTimeout(function () {
        CBTutorial.start({ force: true });
      }, 280);
    }
  }

  function showAuth() {
    window.CBGame.stop();
    if (window.CBWinCelebration) window.CBWinCelebration.stop();
    hideAllOverlayScreens();
    const menu = document.getElementById("screen-menu");
    if (menu) menu.classList.add("screen-hidden");
    if (window.CBAuthUI) CBAuthUI.show();
  }

  function leaveMpSession(reason, opts) {
    if (window.CBMultiplayerUI && CBMultiplayerUI.leaveSession) {
      CBMultiplayerUI.leaveSession(reason || "menu", opts || {});
    }
  }

  function goTitleDisconnect() {
    window.CBGame.stop();
    if (window.CBWinCelebration) window.CBWinCelebration.stop();
    leaveMpSession("main_menu_disconnect", { disconnect: true });
    hideAllOverlayScreens();
    if (window.CBAuth && !CBAuth.isLoggedIn()) {
      showAuth();
      return;
    }
    syncTitleUser();
    window.CBMenu.show();
    if (window.CBMenu.showTitle) window.CBMenu.showTitle();
    console.log("[CBMain] Main Menu (disconnect)");
  }

  function showMenu() {
    goTitleDisconnect();
  }

  function startGame(cfg) {
    if (window.CBAuth && !CBAuth.isLoggedIn()) {
      showAuth();
      return;
    }
    if (window.CBTutorial && CBTutorial.isActive && CBTutorial.isActive()) {
      return;
    }
    if (window.CBWinCelebration) window.CBWinCelebration.stop();
    hideAllOverlayScreens();
    window.CBMenu.hide();
    window.CBGame.start(cfg || window.CBMenu.getConfig());
  }

  function showDefeat(result) {
    const screen = document.getElementById("screen-result");
    const title = document.getElementById("result-title");
    const sub = document.getElementById("result-sub");
    const game = document.getElementById("screen-game");
    if (game) game.classList.add("screen-hidden");
    if (screen) screen.classList.remove("screen-hidden");
    if (title) title.textContent = result && result.won ? "Victory" : "Defeat";
    if (sub) {
      sub.textContent =
        result && result.won ? "You win!" : "You ran out of lives.";
    }
    console.log("[CBMain] defeat", result);
  }

  function fillWinReward() {
    const el = document.getElementById("win-reward");
    if (!el) return;
    const award =
      window.CBCountryballs && CBCountryballs.getLastAward
        ? CBCountryballs.getLastAward()
        : null;
    if (!award) {
      el.textContent = "";
      return;
    }
    el.textContent = award.summary || "";
    el.classList.toggle("is-levelup", !!award.levelsGained);
  }

  function onMatchEnd(result) {
    // Do NOT leave the room yet — player picks an exit on win/defeat
    if (window.CBMultiplayerUI && CBMultiplayerUI.markMatchOver) {
      CBMultiplayerUI.markMatchOver();
    }

    if (result && result.won) {
      fillWinReward();
      if (window.CBAuth && CBAuth.isLoggedIn() && CBAuth.pushSaveNow) {
        CBAuth.pushSaveNow();
      }
      if (window.CBWinCelebration) {
        window.CBWinCelebration.start({
          fighter:
            (result.config && result.config.fighter) ||
            (window.CBMenu && window.CBMenu.getConfig().fighter) ||
            "usa",
          onDone: function () {
            /* stay on win screen until exit buttons */
          },
        });
      } else {
        showDefeat({ won: true });
      }
    } else {
      if (window.CBWinCelebration) window.CBWinCelebration.stop();
      const win = document.getElementById("screen-win");
      if (win) win.classList.add("screen-hidden");
      const reward = document.getElementById("win-reward");
      if (reward) reward.textContent = "";
      showDefeat(result);
    }
    console.log("[CBMain] match end", result);
  }

  window.CBMenu.init({ onPlay: startGame });
  window.CBGame.init({
    onExitToMenu: showMenu,
    onMatchEnd: onMatchEnd,
  });
  window.CBAuthUI.init({
    onReady: function (result) {
      enterApp({
        startTutorial: !!(result && result.isNewAccount),
      });
    },
  });

  if (window.CBMultiplayerUI && CBMultiplayerUI.init) {
    CBMultiplayerUI.init({ onStartMatch: startGame });
  }

  const winMenu = document.getElementById("btn-win-menu");
  if (winMenu) {
    winMenu.addEventListener("click", function () {
      goTitleDisconnect();
    });
  }

  const resultMenu = document.getElementById("btn-result-menu");
  if (resultMenu) {
    resultMenu.addEventListener("click", function () {
      goTitleDisconnect();
    });
  }

  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {
      if (window.CBCountryballsUI && CBCountryballsUI.clearSelection) {
        CBCountryballsUI.clearSelection();
      }
      if (window.CBAuth) await CBAuth.logout();
      showAuth();
    });
  }

  const settingsLogout = document.getElementById("btn-settings-logout");
  if (settingsLogout) {
    settingsLogout.addEventListener("click", async function () {
      if (window.CBCountryballsUI && CBCountryballsUI.clearSelection) {
        CBCountryballsUI.clearSelection();
      }
      if (window.CBAuth) await CBAuth.logout();
      showAuth();
    });
  }

  if (window.CBWinCelebration) window.CBWinCelebration.ensureAssets();

  (async function boot() {
    if (window.CBVersion) {
      const verEl = document.getElementById("game-version");
      if (verEl) verEl.textContent = CBVersion.label;
      document.title = "Countryball PVP — " + CBVersion.label;
      console.log("[CBMain]", CBVersion.label);
    }
    const menu = document.getElementById("screen-menu");
    if (menu) menu.classList.add("screen-hidden");
    if (window.CBAuth) {
      const res = await CBAuth.init({
        onAuthChange: function () {
          syncTitleUser();
        },
      });
      if (res && res.loggedIn) {
        enterApp();
      } else {
        showAuth();
      }
    } else {
      enterApp();
    }
    console.log("[CBMain] boot — auth + cloud saves");
  })();
})();
