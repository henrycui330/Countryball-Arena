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
      hatImg.style.width = wPx + "px";
      hatImg.style.height = "auto";
      hatImg.style.left = "50%";
      hatImg.style.top = "50%";
      hatImg.style.transform =
        "translate(-50%, -50%) translate(" +
        hat.ox * r +
        "px, " +
        hat.oy * r +
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
      btn.title = owned ? hat.name : hat.name + " — Unlock in Gacha";
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

  function renderDetail() {
    if (!window.CBCountryballs || !selectedId) return;
    const ball = CBCountryballs.getBall(selectedId);
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
  }

  function show() {
    if (!window.CBCountryballs) {
      console.error("[CBCountryballsUI] CBCountryballs missing");
      return;
    }
    CBCountryballs.ensure();
    const owned = CBCountryballs.listOwned();
    if (!selectedId || !CBCountryballs.getBall(selectedId)) {
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
    console.log("[CBCountryballsUI] show selected=" + selectedId);
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

  return { init, show, select, renderRoster, renderDetail };
})();
