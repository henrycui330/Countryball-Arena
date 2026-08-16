window.CBMenu = (function () {
  let onPlay = null;

  const state = {
    matchType: "quick",
    opponent: "dummy",
    mapId: "plains",
    lives: 3,
    fighter: "usa",
    view: "title", // title | setup | countryballs | gacha | multiplayer | settings
  };

  const MATCH_DESC = {
    quick: "Pick opponent + map, then fight. Unlimited lives.",
    custom: "Full setup — choose shared lives for you and them.",
  };

  const MAP_DESC = {
    plains: "Pixel plains — open grass arena.",
    icy: "Frozen alpine ice field.",
  };

  const FIGHTER_LABEL = {
    usa: "USA",
    japan: "Japan",
    russia: "Russia",
    france: "France",
    uk: "UK",
    china: "China",
    canada: "Canada",
  };

  const FIGHTER_SPRITE = {
    usa: "assets/usa.png",
    japan: "assets/japan.png",
    russia: "assets/russia.png",
    france: "assets/france.png",
    uk: "assets/uk.png",
    china: "assets/china.png",
    canada: "assets/canada.png",
  };

  const LIVES_MIN = 1;
  const LIVES_MAX = 100;

  function hideGachaScreen() {
    const gacha = document.getElementById("screen-gacha");
    if (gacha) gacha.classList.add("screen-hidden");
  }

  function hideCountryballsScreen() {
    const balls = document.getElementById("screen-countryballs");
    if (balls) balls.classList.add("screen-hidden");
  }

  function hideMultiplayerScreen() {
    if (window.CBMultiplayerUI && CBMultiplayerUI.hide) CBMultiplayerUI.hide();
    else {
      const mp = document.getElementById("screen-multiplayer");
      if (mp) mp.classList.add("screen-hidden");
    }
  }

  function hideSettingsScreen() {
    const s = document.getElementById("screen-settings");
    if (s) s.classList.add("screen-hidden");
  }

  function show() {
    const menu = document.getElementById("screen-menu");
    const game = document.getElementById("screen-game");
    const result = document.getElementById("screen-result");
    const win = document.getElementById("screen-win");
    hideGachaScreen();
    hideCountryballsScreen();
    hideMultiplayerScreen();
    hideSettingsScreen();
    if (menu) menu.classList.remove("screen-hidden");
    if (game) game.classList.add("screen-hidden");
    if (result) result.classList.add("screen-hidden");
    if (win) win.classList.add("screen-hidden");
    showTitle();
    console.log("[CBMenu] main menu", JSON.stringify(state));
  }

  function hide() {
    const menu = document.getElementById("screen-menu");
    if (menu) menu.classList.add("screen-hidden");
    hideGachaScreen();
    hideCountryballsScreen();
    hideMultiplayerScreen();
    hideSettingsScreen();
  }

  function hideAllViews() {
    const title = document.getElementById("view-title");
    const setup = document.getElementById("view-setup");
    if (title) title.classList.add("screen-hidden");
    if (setup) setup.classList.add("screen-hidden");
  }

  function showTitle() {
    state.view = "title";
    hideGachaScreen();
    hideCountryballsScreen();
    hideMultiplayerScreen();
    hideSettingsScreen();
    hideAllViews();
    const menu = document.getElementById("screen-menu");
    if (menu) menu.classList.remove("screen-hidden");
    const title = document.getElementById("view-title");
    if (title) title.classList.remove("screen-hidden");
  }

  function showSetup(matchType) {
    if (matchType === "quick" || matchType === "custom") {
      state.matchType = matchType;
    }
    state.view = "setup";
    hideGachaScreen();
    hideCountryballsScreen();
    hideMultiplayerScreen();
    hideSettingsScreen();
    hideAllViews();
    const menu = document.getElementById("screen-menu");
    if (menu) menu.classList.remove("screen-hidden");
    const setup = document.getElementById("view-setup");
    if (setup) setup.classList.remove("screen-hidden");
    const heading = document.getElementById("setup-heading");
    if (heading) {
      heading.textContent =
        state.matchType === "custom" ? "Custom Match" : "Quick Match";
    }
    syncAll();
    console.log("[CBMenu] setup view", state.matchType);
  }

  function showCountryballs() {
    state.view = "countryballs";
    hideGachaScreen();
    hideMultiplayerScreen();
    hideSettingsScreen();
    hideAllViews();
    const menu = document.getElementById("screen-menu");
    if (menu) menu.classList.add("screen-hidden");
    const balls = document.getElementById("screen-countryballs");
    if (balls) balls.classList.remove("screen-hidden");
    if (window.CBCountryballsUI) CBCountryballsUI.show();
    console.log("[CBMenu] countryballs screen");
  }

  function showGacha() {
    if (window.CBGacha && CBGacha.ENABLED === false) {
      console.log("[CBMenu] gacha disabled — staying on title");
      showTitle();
      return;
    }
    state.view = "gacha";
    hideCountryballsScreen();
    hideMultiplayerScreen();
    hideSettingsScreen();
    hideAllViews();
    const menu = document.getElementById("screen-menu");
    if (menu) menu.classList.add("screen-hidden");
    const gacha = document.getElementById("screen-gacha");
    if (gacha) gacha.classList.remove("screen-hidden");
    if (window.CBGachaUI) CBGachaUI.show();
    console.log("[CBMenu] gacha view");
  }

  function showMultiplayer() {
    state.view = "multiplayer";
    hideGachaScreen();
    hideCountryballsScreen();
    hideSettingsScreen();
    hideAllViews();
    const menu = document.getElementById("screen-menu");
    if (menu) menu.classList.add("screen-hidden");
    if (window.CBMultiplayerUI && CBMultiplayerUI.show) CBMultiplayerUI.show();
    console.log("[CBMenu] multiplayer screen");
  }

  function showSettings() {
    state.view = "settings";
    hideGachaScreen();
    hideCountryballsScreen();
    hideMultiplayerScreen();
    hideAllViews();
    const menu = document.getElementById("screen-menu");
    if (menu) menu.classList.add("screen-hidden");
    const settings = document.getElementById("screen-settings");
    if (settings) settings.classList.remove("screen-hidden");
    const uname = document.getElementById("settings-username");
    if (uname) {
      uname.textContent =
        window.CBAuth && CBAuth.getUsername ? CBAuth.getUsername() || "—" : "—";
    }
    console.log("[CBMenu] settings screen");
  }

  function syncButtons(attr, value) {
    document.querySelectorAll("[" + attr + "]").forEach(function (btn) {
      btn.classList.toggle("is-selected", btn.getAttribute(attr) === value);
    });
  }

  function fighterOwned(id) {
    if (id === "usa") return true;
    if (window.CBCountryballs && CBCountryballs.isCharacterOwned) {
      return CBCountryballs.isCharacterOwned(id);
    }
    return true;
  }

  function syncLivesUi() {
    const row = document.getElementById("lives-row");
    const val = document.getElementById("lives-value");
    if (row) {
      row.classList.toggle("screen-hidden", state.matchType !== "custom");
    }
    if (val) val.textContent = String(state.lives);
  }

  function syncFighterUi() {
    if (!fighterOwned(state.fighter)) {
      state.fighter = "usa";
    }
    document.querySelectorAll("[data-fighter]").forEach(function (btn) {
      const id = btn.getAttribute("data-fighter");
      const owned = fighterOwned(id);
      btn.classList.toggle("is-selected", id === state.fighter);
      btn.classList.toggle("is-locked", !owned);
      btn.disabled = !owned;
      btn.title = owned
        ? FIGHTER_LABEL[id] || id
        : "Coming soon";
    });
    const name = document.getElementById("setup-fighter-name");
    if (name) name.textContent = FIGHTER_LABEL[state.fighter] || "USA";
    const hero = document.getElementById("title-hero-img");
    if (hero) hero.src = FIGHTER_SPRITE[state.fighter] || FIGHTER_SPRITE.usa;
  }

  function syncAll() {
    syncButtons("data-opponent", state.opponent);
    syncButtons("data-map", state.mapId);
    const matchDesc = document.getElementById("match-desc");
    if (matchDesc) matchDesc.textContent = MATCH_DESC[state.matchType] || "";
    const mapDesc = document.getElementById("map-desc");
    if (mapDesc) mapDesc.textContent = MAP_DESC[state.mapId] || "";
    const heading = document.getElementById("setup-heading");
    if (heading && state.view === "setup") {
      heading.textContent =
        state.matchType === "custom" ? "Custom Match" : "Quick Match";
    }
    syncLivesUi();
    syncFighterUi();
  }

  function setOpponent(o) {
    if (o !== "dummy" && o !== "easy" && o !== "medium" && o !== "hard") return;
    state.opponent = o;
    syncAll();
  }

  function setMap(id) {
    if (id !== "plains" && id !== "icy") return;
    state.mapId = id;
    syncAll();
  }

  function setFighter(id) {
    if (id !== "usa" && id !== "japan" && id !== "russia" && id !== "france" && id !== "uk" && id !== "china" && id !== "canada") return;
    if (!fighterOwned(id)) {
      console.warn("[CBMenu] fighter locked:", id);
      return;
    }
    state.fighter = id;
    syncAll();
    console.log("[CBMenu] fighter=" + state.fighter);
  }

  function setLives(n) {
    state.lives = Math.max(LIVES_MIN, Math.min(LIVES_MAX, Math.floor(n)));
    syncLivesUi();
    console.log("[CBMenu] lives (shared)=" + state.lives);
  }

  function getConfig() {
    if (!fighterOwned(state.fighter)) {
      state.fighter = "usa";
    }
    return {
      matchType: state.matchType,
      opponent: state.opponent,
      mapId: state.mapId,
      lives: state.matchType === "custom" ? state.lives : null,
      fighter: state.fighter,
    };
  }

  function init(handlers) {
    onPlay = handlers && handlers.onPlay;

    document.querySelectorAll("[data-open-setup]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showSetup(btn.getAttribute("data-open-setup"));
      });
    });

    const back = document.getElementById("btn-back-title");
    if (back) {
      back.addEventListener("click", function () {
        showTitle();
      });
    }

    const backBalls = document.getElementById("btn-back-countryballs");
    if (backBalls) {
      backBalls.addEventListener("click", function () {
        showTitle();
      });
    }

    const navBalls = document.getElementById("nav-countryballs");
    if (navBalls) {
      navBalls.addEventListener("click", function () {
        showCountryballs();
      });
    }

    const navGacha = document.getElementById("nav-gacha");
    if (navGacha) {
      if (window.CBGacha && CBGacha.ENABLED === false) {
        navGacha.classList.add("screen-hidden");
        navGacha.setAttribute("hidden", "");
      } else {
        navGacha.addEventListener("click", function () {
          showGacha();
        });
      }
    }

    const backGacha = document.getElementById("btn-gacha-back");
    if (backGacha) {
      backGacha.addEventListener("click", function () {
        showTitle();
      });
    }

    const navMp = document.getElementById("nav-multiplayer");
    if (navMp) {
      navMp.addEventListener("click", function () {
        showMultiplayer();
      });
    }

    const backMp = document.getElementById("btn-back-multiplayer");
    if (backMp) {
      backMp.addEventListener("click", function () {
        showTitle();
      });
    }

    const navSettings = document.getElementById("nav-settings");
    if (navSettings) {
      navSettings.addEventListener("click", function () {
        showSettings();
      });
    }

    const backSettings = document.getElementById("btn-back-settings");
    if (backSettings) {
      backSettings.addEventListener("click", function () {
        showTitle();
      });
    }

    const replayTut = document.getElementById("btn-replay-tutorial");
    if (replayTut) {
      replayTut.addEventListener("click", function () {
        if (window.CBTutorial && CBTutorial.start) {
          CBTutorial.start({ force: true });
        }
      });
    }

    if (window.CBCountryballsUI) CBCountryballsUI.init();
    if (window.CBGachaUI && !(window.CBGacha && CBGacha.ENABLED === false)) {
      CBGachaUI.init();
    }

    document.querySelectorAll("[data-opponent]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setOpponent(btn.getAttribute("data-opponent"));
      });
    });
    document.querySelectorAll("[data-map]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setMap(btn.getAttribute("data-map"));
      });
    });
    document.querySelectorAll("[data-fighter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setFighter(btn.getAttribute("data-fighter"));
      });
    });

    const minus = document.getElementById("lives-minus");
    const plus = document.getElementById("lives-plus");
    if (minus) {
      minus.addEventListener("click", function () {
        setLives(state.lives - 1);
      });
    }
    if (plus) {
      plus.addEventListener("click", function () {
        setLives(state.lives + 1);
      });
    }

    const play = document.getElementById("btn-play");
    if (!play) {
      console.error("[CBMenu] #btn-play missing");
      return;
    }
    play.addEventListener("click", function () {
      const cfg = getConfig();
      console.log("[CBMenu] Fight!", cfg);
      hide();
      if (typeof onPlay === "function") onPlay(cfg);
    });

    syncAll();
    showTitle();
    console.log("[CBMenu] init OK — title screen");
  }

  return {
    init,
    show,
    hide,
    getConfig,
    showTitle,
    showSetup,
    showCountryballs,
    showGacha,
    showMultiplayer,
    showSettings,
    setOpponent,
    setMap,
    setFighter,
    setLives,
  };
})();
