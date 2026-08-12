/**
 * Optional interactive tour — first account + Settings replay.
 */
window.CBTutorial = (function () {
  let active = false;
  let stepIndex = 0;
  let overlay = null;
  let hole = null;
  let card = null;
  let titleEl = null;
  let bodyEl = null;
  let progressEl = null;
  let resizeHandler = null;

  const STEPS = [
    {
      id: "welcome",
      title: "Welcome!",
      body: "Quick tour of Countryball Arena. You can skip anytime — replay later in Settings.",
      target: "#view-title .menu-brand",
      place: "bottom",
      enter: function () {
        if (window.CBMenu && CBMenu.showTitle) CBMenu.showTitle();
      },
    },
    {
      id: "quick",
      title: "Quick Match",
      body: "Jump into a fight fast. Pick an opponent and map, then battle.",
      target: "#nav-quick",
      place: "right",
      enter: function () {
        if (window.CBMenu && CBMenu.showTitle) CBMenu.showTitle();
      },
    },
    {
      id: "custom",
      title: "Custom Match",
      body: "Same fight setup, but you choose shared lives for both sides.",
      target: "#nav-custom",
      place: "right",
      enter: function () {
        if (window.CBMenu && CBMenu.showTitle) CBMenu.showTitle();
      },
    },
    {
      id: "roster",
      title: "Countryballs",
      body: "Your roster, XP, hats, weapons, and auras live here.",
      target: "#screen-countryballs .cb-page-title",
      place: "bottom",
      enter: function () {
        if (window.CBMenu && CBMenu.showCountryballs) CBMenu.showCountryballs();
      },
    },
    {
      id: "gacha",
      title: "Gacha",
      body: "Spend coins to unlock more fighters, hats, and weapons.",
      target: "#screen-gacha .gacha-title",
      place: "bottom",
      enter: function () {
        if (window.CBMenu && CBMenu.showGacha) CBMenu.showGacha();
      },
    },
    {
      id: "multi",
      title: "Multiplayer",
      body: "Host a room, share a 5-digit code, friends join. No server links needed.",
      target: "#screen-multiplayer .mp-page-title",
      place: "bottom",
      enter: function () {
        if (window.CBMenu && CBMenu.showMultiplayer) CBMenu.showMultiplayer();
      },
    },
    {
      id: "controls",
      title: "Controls",
      body: "WASD / arrows move · Space jump · LMB attack · E special · Q ultimate · S plunge.",
      target: "#view-title .menu-foot",
      place: "top",
      enter: function () {
        if (window.CBMenu && CBMenu.showTitle) CBMenu.showTitle();
      },
    },
    {
      id: "settings",
      title: "Settings",
      body: "Open Settings anytime to replay this tour. Ready to fight?",
      target: "#nav-settings",
      place: "right",
      enter: function () {
        if (window.CBMenu && CBMenu.showTitle) CBMenu.showTitle();
      },
    },
  ];

  function $(sel) {
    try {
      return document.querySelector(sel);
    } catch (_) {
      return null;
    }
  }

  function resolveTarget(step) {
    if (!step || !step.target) return null;
    const parts = String(step.target).split(",");
    for (let i = 0; i < parts.length; i++) {
      const el = $(parts[i].trim());
      if (el && el.getClientRects().length) return el;
    }
    return $(parts[0].trim());
  }

  function ensureDom() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "tutorial-overlay";
    overlay.className = "tutorial-overlay screen-hidden";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Tutorial");

    hole = document.createElement("div");
    hole.className = "tutorial-hole";
    overlay.appendChild(hole);

    card = document.createElement("div");
    card.className = "tutorial-card";
    card.innerHTML =
      '<p class="tutorial-kicker">Tutorial</p>' +
      '<h2 class="tutorial-title" id="tutorial-title"></h2>' +
      '<p class="tutorial-body" id="tutorial-body"></p>' +
      '<p class="tutorial-progress" id="tutorial-progress"></p>' +
      '<div class="tutorial-actions">' +
      '<button type="button" class="menu-btn tutorial-btn-skip" id="tutorial-skip">Skip</button>' +
      '<button type="button" class="menu-btn tutorial-btn-back" id="tutorial-back">Back</button>' +
      '<button type="button" class="menu-btn menu-btn-primary tutorial-btn-next" id="tutorial-next">Next</button>' +
      "</div>";
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    titleEl = card.querySelector("#tutorial-title");
    bodyEl = card.querySelector("#tutorial-body");
    progressEl = card.querySelector("#tutorial-progress");

    card.querySelector("#tutorial-skip").addEventListener("click", function () {
      finish(true);
    });
    card.querySelector("#tutorial-back").addEventListener("click", function () {
      go(stepIndex - 1);
    });
    card.querySelector("#tutorial-next").addEventListener("click", function () {
      if (stepIndex >= STEPS.length - 1) finish(false);
      else go(stepIndex + 1);
    });
  }

  function placeCard(rect, place) {
    const pad = 14;
    const cardW = Math.min(360, window.innerWidth - 24);
    card.style.width = cardW + "px";
    let top = pad;
    let left = Math.max(pad, (window.innerWidth - cardW) / 2);

    if (rect) {
      if (place === "right" && rect.right + cardW + 28 < window.innerWidth) {
        left = rect.right + 16;
        top = Math.max(pad, Math.min(rect.top, window.innerHeight - 220));
      } else if (place === "left" && rect.left - cardW - 28 > 0) {
        left = rect.left - cardW - 16;
        top = Math.max(pad, Math.min(rect.top, window.innerHeight - 220));
      } else if (place === "top") {
        top = Math.max(pad, rect.top - 200);
        left = Math.max(
          pad,
          Math.min(rect.left + rect.width / 2 - cardW / 2, window.innerWidth - cardW - pad)
        );
      } else {
        top = Math.min(window.innerHeight - 210, rect.bottom + 16);
        left = Math.max(
          pad,
          Math.min(rect.left + rect.width / 2 - cardW / 2, window.innerWidth - cardW - pad)
        );
      }
    }

    card.style.top = top + "px";
    card.style.left = left + "px";
  }

  function positionSpotlight() {
    if (!active || !hole) return;
    const step = STEPS[stepIndex];
    const target = resolveTarget(step);
    document.querySelectorAll(".tutorial-target").forEach(function (el) {
      el.classList.remove("tutorial-target");
    });

    if (target) {
      target.classList.add("tutorial-target");
      const r = target.getBoundingClientRect();
      const m = 8;
      hole.style.display = "block";
      hole.style.top = r.top - m + "px";
      hole.style.left = r.left - m + "px";
      hole.style.width = r.width + m * 2 + "px";
      hole.style.height = r.height + m * 2 + "px";
      placeCard(r, step.place || "bottom");
    } else {
      hole.style.display = "none";
      placeCard(null, "bottom");
    }
  }

  function renderStep() {
    const step = STEPS[stepIndex];
    if (!step) return;
    if (typeof step.enter === "function") {
      try {
        step.enter();
      } catch (err) {
        console.warn("[CBTutorial] enter failed", err);
      }
    }
    if (titleEl) titleEl.textContent = step.title;
    if (bodyEl) bodyEl.textContent = step.body;
    if (progressEl) {
      progressEl.textContent = "Step " + (stepIndex + 1) + " / " + STEPS.length;
    }
    const nextBtn = card && card.querySelector("#tutorial-next");
    if (nextBtn) {
      nextBtn.textContent = stepIndex >= STEPS.length - 1 ? "Finish" : "Next";
    }
    const backBtn = card && card.querySelector("#tutorial-back");
    if (backBtn) backBtn.disabled = stepIndex <= 0;

    // Wait a frame so screen transitions layout before measuring.
    requestAnimationFrame(function () {
      requestAnimationFrame(positionSpotlight);
    });
  }

  function go(index) {
    if (!active) return;
    stepIndex = Math.max(0, Math.min(STEPS.length - 1, index));
    renderStep();
  }

  function finish(skipped) {
    if (!active) return;
    active = false;
    document.querySelectorAll(".tutorial-target").forEach(function (el) {
      el.classList.remove("tutorial-target");
    });
    if (overlay) overlay.classList.add("screen-hidden");
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }
    if (window.CBMenu && CBMenu.showTitle) CBMenu.showTitle();
    if (window.CBCountryballs && CBCountryballs.setTutorialCompleted) {
      CBCountryballs.setTutorialCompleted(true);
    }
    if (window.CBAuth && CBAuth.pushSaveNow) CBAuth.pushSaveNow();
    console.log("[CBTutorial] finished", skipped ? "skipped" : "completed");
  }

  function start(opts) {
    ensureDom();
    const force = !!(opts && opts.force);
    if (
      !force &&
      window.CBCountryballs &&
      CBCountryballs.hasCompletedTutorial &&
      CBCountryballs.hasCompletedTutorial()
    ) {
      console.log("[CBTutorial] already completed — skip auto start");
      return false;
    }
    active = true;
    stepIndex = 0;
    overlay.classList.remove("screen-hidden");
    if (!resizeHandler) {
      resizeHandler = function () {
        positionSpotlight();
      };
      window.addEventListener("resize", resizeHandler);
    }
    renderStep();
    console.log("[CBTutorial] start", force ? "forced" : "auto");
    return true;
  }

  function isActive() {
    return active;
  }

  return { start: start, finish: finish, isActive: isActive };
})();
