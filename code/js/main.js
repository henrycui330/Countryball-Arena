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

  function enterApp() {
    hideAllOverlayScreens();
    syncTitleUser();
    window.CBMenu.show();
  }

  function showAuth() {
    window.CBGame.stop();
    if (window.CBWinCelebration) window.CBWinCelebration.stop();
    hideAllOverlayScreens();
    const menu = document.getElementById("screen-menu");
    if (menu) menu.classList.add("screen-hidden");
    if (window.CBAuthUI) CBAuthUI.show();
  }

  function showMenu() {
    window.CBGame.stop();
    if (window.CBWinCelebration) window.CBWinCelebration.stop();
    hideAllOverlayScreens();
    if (window.CBAuth && !CBAuth.isLoggedIn()) {
      showAuth();
      return;
    }
    syncTitleUser();
    window.CBMenu.show();
  }

  function startGame(cfg) {
    if (window.CBAuth && !CBAuth.isLoggedIn()) {
      showAuth();
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
    if (title) title.textContent = "Defeat";
    if (sub) sub.textContent = "You ran out of lives.";
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
            /* stay on win screen until Main Menu */
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
    onReady: function () {
      enterApp();
    },
  });

  if (window.CBMultiplayerUI && CBMultiplayerUI.init) {
    CBMultiplayerUI.init();
  }

  const winMenu = document.getElementById("btn-win-menu");
  if (winMenu) {
    winMenu.addEventListener("click", function () {
      showMenu();
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
