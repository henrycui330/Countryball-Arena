(function () {
  function hideAllOverlayScreens() {
    ["screen-result", "screen-win", "screen-game"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.classList.add("screen-hidden");
    });
  }

  function showMenu() {
    window.CBGame.stop();
    if (window.CBWinCelebration) window.CBWinCelebration.stop();
    hideAllOverlayScreens();
    window.CBMenu.show();
  }

  function startGame(cfg) {
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

  function onMatchEnd(result) {
    if (result && result.won) {
      // Smash-style win celeb on plains BG
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
      showDefeat(result);
    }
    console.log("[CBMain] match end", result);
  }

  window.CBMenu.init({ onPlay: startGame });
  window.CBGame.init({
    onExitToMenu: showMenu,
    onMatchEnd: onMatchEnd,
  });

  const winMenu = document.getElementById("btn-win-menu");
  if (winMenu) {
    winMenu.addEventListener("click", function () {
      showMenu();
    });
  }

  if (window.CBWinCelebration) window.CBWinCelebration.ensureAssets();

  window.CBMenu.show();
  console.log("[CBMain] boot — Quick / Custom + win celebration");
})();
