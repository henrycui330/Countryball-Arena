/**
 * Countryballs stats viewer UI — roster, detail, hat equip.
 */
window.CBCountryballsUI = (function () {
  let selectedId = null;
  let wired = false;

  function rosterEl() {
    return document.getElementById("cb-roster");
  }

  function select(id) {
    if (!window.CBCountryballs) return;
    const ball = CBCountryballs.getBall(id);
    if (!ball || !ball.owned) return;
    selectedId = id;
    renderRoster();
    renderDetail();
    console.log("[CBCountryballsUI] selected=" + id);
  }

  function renderRoster() {
    const root = rosterEl();
    if (!root || !window.CBCountryballs) return;
    const owned = CBCountryballs.listOwned();
    root.innerHTML = "";
    owned.forEach(function (ball) {
      const stats = CBCountryballs.computeStats(ball);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "cb-roster-item" + (ball.id === selectedId ? " is-selected" : "");
      btn.setAttribute("role", "listitem");
      btn.setAttribute("data-ball-id", ball.id);
      btn.innerHTML =
        '<img class="cb-roster-thumb" src="' +
        stats.sprite +
        '" alt="" width="48" height="48" />' +
        '<span class="cb-roster-meta">' +
        '<span class="cb-roster-name">' +
        stats.name +
        "</span>" +
        '<span class="cb-roster-lv">Lv ' +
        stats.level +
        "</span>" +
        "</span>";
      btn.addEventListener("click", function () {
        select(ball.id);
      });
      root.appendChild(btn);
    });
  }

  function applyHatOverlay(hatId) {
    const hatImg = document.getElementById("cb-hat");
    if (!hatImg) return;
    const hat =
      window.CBCosmetics && CBCosmetics.getHat
        ? CBCosmetics.getHat(hatId)
        : null;
    if (!hat || !hat.src) {
      hatImg.classList.add("screen-hidden");
      hatImg.removeAttribute("src");
      return;
    }
    function place() {
      const aspect =
        hat._aspect ||
        (hatImg.naturalWidth && hatImg.naturalHeight
          ? hatImg.naturalWidth / hatImg.naturalHeight
          : 1.2);
      hat._aspect = aspect;
      const r = 90;
      const wPx = r * 2 * hat.scale;
      const nudge =
        CBCosmetics.fighterHatNudge
          ? CBCosmetics.fighterHatNudge(selectedId, hat.id)
          : { ox: 0, oy: 0 };
      hatImg.style.width = wPx + "px";
      hatImg.style.height = "auto";
      hatImg.style.left = "50%";
      hatImg.style.top = "50%";
      hatImg.style.transform =
        "translate(-50%, -50%) translate(" +
        (hat.ox + nudge.ox) * r +
        "px, " +
        (hat.oy + nudge.oy) * r +
        "px)";
    }
    hatImg.classList.remove("screen-hidden");
    hatImg.alt = hat.name;
    if (hatImg.getAttribute("src") !== hat.src) {
      hatImg.onload = place;
      hatImg.src = hat.src;
    } else {
      place();
    }
  }

  function renderHatPicker(currentHatId) {
    const root = document.getElementById("cb-hat-pick");
    if (!root || !window.CBCosmetics) return;
    root.innerHTML = "";
    CBCosmetics.listHats().forEach(function (hat) {
      const owned =
        hat.id === "none" ||
        (window.CBCountryballs && CBCountryballs.ownsHat(hat.id));
      const selected =
        hat.id === "none"
          ? !currentHatId || currentHatId === "none"
          : hat.id === currentHatId;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "cb-hat-btn" +
        (selected ? " is-selected" : "") +
        (owned ? "" : " is-locked");
      btn.setAttribute("data-hat-id", hat.id);
      btn.disabled = !owned;
      btn.title = owned ? hat.name : hat.name + " — Coming soon";
      if (hat.src) {
        btn.innerHTML =
          '<img src="' +
          hat.src +
          '" alt="' +
          hat.name +
          '" />' +
          "<span>" +
          (owned ? hat.name : "Locked") +
          "</span>";
      } else {
        btn.innerHTML = "<span>None</span>";
      }
      btn.addEventListener("click", function () {
        if (!selectedId || !owned) return;
        const id = hat.id === "none" ? null : hat.id;
        CBCountryballs.setHat(selectedId, id);
        renderDetail();
      });
      root.appendChild(btn);
    });
  }

  function renderWeaponPicker(currentWeaponId) {
    const root = document.getElementById("cb-weapon-pick");
    if (!root || !window.CBCosmetics || !selectedId) return;
    root.innerHTML = "";
    const list =
      typeof CBCosmetics.listWeaponsForFighter === "function"
        ? CBCosmetics.listWeaponsForFighter(selectedId)
        : CBCosmetics.listWeapons();
    list.forEach(function (wpn) {
      const owned =
        wpn.id === "none" ||
        (window.CBCountryballs && CBCountryballs.ownsWeapon(wpn.id));
      const selected =
        wpn.id === "none"
          ? !currentWeaponId || currentWeaponId === "none"
          : wpn.id === currentWeaponId;
      const preview =
        wpn.id === "none"
          ? null
          : CBCosmetics.weaponPreviewSrc
            ? CBCosmetics.weaponPreviewSrc(wpn)
            : wpn.src || wpn.fallbackSrc;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "cb-hat-btn" +
        (selected ? " is-selected" : "") +
        (owned ? "" : " is-locked");
      btn.setAttribute("data-weapon-id", wpn.id);
      btn.disabled = !owned;
      btn.title = owned ? wpn.name : wpn.name + " — Coming soon";
      if (preview) {
        btn.innerHTML =
          '<img src="' +
          preview +
          '" alt="' +
          wpn.name +
          '" />' +
          "<span>" +
          (owned ? wpn.name : "Locked") +
          "</span>";
      } else {
        btn.innerHTML = "<span>Default</span>";
      }
      btn.addEventListener("click", function () {
        if (!selectedId || !owned) return;
        const id = wpn.id === "none" ? null : wpn.id;
        CBCountryballs.setWeapon(selectedId, id);
        renderDetail();
      });
      root.appendChild(btn);
    });
  }

  function renderAuraPicker(currentEffectId) {
    const root = document.getElementById("cb-aura-pick");
    if (!root || !window.CBCosmetics || !selectedId) return;
    if (!CBCosmetics.listEffects) return;
    root.innerHTML = "";
    CBCosmetics.listEffects().forEach(function (fx) {
      const owned =
        fx.id === "none" ||
        (window.CBCountryballs && CBCountryballs.ownsEffect(fx.id));
      const selected =
        fx.id === "none"
          ? !currentEffectId || currentEffectId === "none"
          : fx.id === currentEffectId;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "cb-hat-btn" +
        (selected ? " is-selected" : "") +
        (owned ? "" : " is-locked");
      btn.setAttribute("data-effect-id", fx.id);
      btn.disabled = !owned;
      btn.title = owned ? fx.name : fx.name + " — Unlock later";
      if (fx.id === "none") {
        btn.innerHTML = "<span>Default</span>";
      } else {
        const swatch = fx.swatch || "#c62828";
        btn.innerHTML =
          '<span class="cb-aura-swatch" style="background:' +
          swatch +
          '"></span>' +
          "<span>" +
          (owned ? fx.name : "Locked") +
          "</span>";
      }
      btn.addEventListener("click", function () {
        if (!selectedId || !owned) return;
        const id = fx.id === "none" ? null : fx.id;
        CBCountryballs.setEffect(selectedId, id);
        renderDetail();
      });
      root.appendChild(btn);
    });
  }

  function renderDetail() {
    if (!window.CBCountryballs || !selectedId) return;
    const ball = CBCountryballs.getBall(selectedId);
    if (!ball || !ball.owned) {
      console.warn(
        "[CBCountryballsUI] renderDetail skipped unowned",
        selectedId
      );
      return;
    }
    const stats = CBCountryballs.computeStats(ball);
    if (!stats) return;

    const portrait = document.getElementById("cb-portrait");
    const name = document.getElementById("cb-name");
    const level = document.getElementById("cb-level");
    const xpFill = document.getElementById("cb-xp-fill");
    const xpLabel = document.getElementById("cb-xp-label");
    const hp = document.getElementById("cb-stat-hp");
    const atk = document.getElementById("cb-stat-atk");
    const special = document.getElementById("cb-stat-special");
    const ult = document.getElementById("cb-stat-ult");
    const blurb = document.getElementById("cb-blurb");

    if (portrait) {
      portrait.src = stats.sprite;
      portrait.alt = stats.name;
    }
    if (name) name.textContent = stats.name;
    if (level) {
      level.textContent =
        "Level " +
        stats.level +
        (stats.level >= stats.maxLevel ? " (MAX)" : "");
    }
    if (xpFill) {
      xpFill.style.width =
        Math.round((stats.xpProgress || 0) * 100) + "%";
    }
    if (xpLabel) {
      if (stats.level >= stats.maxLevel) {
        xpLabel.textContent = "Max level";
      } else {
        xpLabel.textContent = stats.xp + " / " + stats.xpToNext + " XP";
      }
    }
    if (hp) hp.textContent = String(stats.maxHp);
    if (atk) atk.textContent = String(stats.atk);
    if (special) special.textContent = stats.special;
    if (ult) ult.textContent = stats.ultimate;
    if (blurb) blurb.textContent = stats.blurb;

    applyHatOverlay(stats.hatId);
    renderHatPicker(stats.hatId);
    renderWeaponPicker(stats.weaponId);
    renderAuraPicker(stats.effectId);
  }

  function show() {
    if (!window.CBCountryballs) {
      console.error("[CBCountryballsUI] CBCountryballs missing");
      return;
    }
    CBCountryballs.ensure();
    const owned = CBCountryballs.listOwned();
    const cur = selectedId ? CBCountryballs.getBall(selectedId) : null;
    // Must be owned — getBall() still returns locked Japan/Russia stubs
    if (!cur || !cur.owned) {
      selectedId = owned[0] ? owned[0].id : null;
    }
    const coinsEl = document.getElementById("cb-coins");
    if (coinsEl) {
      coinsEl.textContent = CBCountryballs.formatCoins
        ? CBCountryballs.formatCoins(CBCountryballs.getCoins())
        : String(CBCountryballs.getCoins());
    }
    renderRoster();
    renderDetail();
    console.log(
      "[CBCountryballsUI] show selected=" +
        selectedId +
        " owned=" +
        owned
          .map(function (b) {
            return b.id;
          })
          .join(",")
    );
  }

  function init() {
    if (wired) return;
    wired = true;
    const importBtn = document.getElementById("btn-import-local");
    if (importBtn) {
      importBtn.addEventListener("click", async function () {
        if (!window.CBAuth || !CBAuth.isLoggedIn()) {
          alert("Sign in first.");
          return;
        }
        const r = await CBAuth.importLocalProgress();
        if (!r.ok) {
          alert(r.error || "Import failed");
          return;
        }
        show();
        alert("Local progress imported to your cloud account.");
      });
    }
    console.log("[CBCountryballsUI] init OK");
  }

  return { init, show, select, renderRoster, renderDetail, clearSelection: function () {
    selectedId = null;
  } };
})();
