/**
 * Gacha screen UI — flip-card reveal
 */
window.CBGachaUI = (function () {
  const CARD_BACK = "assets/polandball.webp";
  let wired = false;
  let lastPayload = null;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function refreshCoins() {
    const el = $("gacha-coins");
    if (el && window.CBCountryballs) {
      el.textContent = CBCountryballs.formatCoins
        ? CBCountryballs.formatCoins(CBCountryballs.getCoins())
        : String(CBCountryballs.getCoins());
    }
  }

  function resolveArt(r) {
    if (!r) return null;
    if (r.type === "cosmetic" && window.CBCosmetics) {
      const hat = CBCosmetics.getHat(r.id);
      return hat && hat.src ? hat.src : null;
    }
    if (r.type === "character") {
      if (r.id === "japan") return "assets/japan.png";
      if (r.id === "russia") return "assets/russia.png";
      if (r.id === "usa") return "assets/usa.png";
      if (r.id === "france") return "assets/france.png";
      if (r.id === "uk") return "assets/uk.png";
      if (r.id === "china") return "assets/china.png";
      if (r.id === "canada") return "assets/canada.png";
    }
    if (r.type === "weapon") {
      if (r.id === "wpn_deagle_gold") return "assets/weapons/deagle_gold.png";
      if (r.id === "wpn_katana_blue") return "assets/weapons/katana_blue.png";
      if (r.id === "wpn_katana_rainbow") return "assets/weapons/katana_rainbow.webp";
      if (window.CBCosmetics && CBCosmetics.weaponPreviewSrc) {
        const preview = CBCosmetics.weaponPreviewSrc(r.id);
        if (preview) return preview;
      }
      if (r.id.indexOf("deagle") >= 0) return "assets/deagle.png";
      if (r.id.indexOf("katana") >= 0) return "assets/katana.png";
      if (r.id.indexOf("absolut") >= 0) return "assets/absolut.png";
    }
    return null;
  }

  function typeLabel(type) {
    if (type === "cosmetic") return "Hat";
    if (type === "character") return "Fighter";
    if (type === "weapon") return "Weapon";
    return type || "";
  }

  function setRevealControls(visible, flippedCount, total) {
    const bar = $("gacha-reveal-bar");
    const hint = $("gacha-hint");
    const flipAll = $("btn-gacha-flip-all");
    if (bar) bar.classList.toggle("screen-hidden", !visible);
    if (hint) {
      if (!visible) {
        hint.textContent = "Pull to deal cards — click a card to flip it.";
      } else if (flippedCount >= total) {
        hint.textContent = "All revealed!";
      } else {
        hint.textContent =
          "Click cards to flip · " + flippedCount + " / " + total + " revealed";
      }
    }
    if (flipAll) {
      flipAll.disabled = !visible || flippedCount >= total;
      flipAll.textContent =
        flippedCount >= total ? "All flipped" : "Flip all";
    }
  }

  function countFlipped(box) {
    if (!box) return 0;
    return box.querySelectorAll(".gacha-flip.is-flipped").length;
  }

  function flipCard(el) {
    if (!el || el.classList.contains("is-flipped")) return;
    el.classList.add("is-flipped");
    el.setAttribute("aria-pressed", "true");
    const box = $("gacha-results");
    const total = box ? box.querySelectorAll(".gacha-flip").length : 0;
    setRevealControls(total > 0, countFlipped(box), total);
  }

  function flipAll() {
    const box = $("gacha-results");
    if (!box) return;
    const cards = box.querySelectorAll(".gacha-flip:not(.is-flipped)");
    cards.forEach(function (el, i) {
      window.setTimeout(function () {
        flipCard(el);
      }, i * 90);
    });
  }

  function wireCard(el) {
    el.addEventListener("click", function () {
      flipCard(el);
    });
    el.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        flipCard(el);
      }
    });
  }

  function showResults(payload) {
    const box = $("gacha-results");
    if (!box) return;
    lastPayload = payload;

    if (!payload || !payload.ok) {
      box.innerHTML =
        '<p class="gacha-msg gacha-msg-err">' +
        escapeHtml((payload && payload.error) || "Pull failed") +
        "</p>";
      setRevealControls(false, 0, 0);
      return;
    }

    const spentLabel = payload.infinite
      ? "Dev pull"
      : "Spent " + payload.cost + " coins";
    let html =
      '<p class="gacha-msg">' +
      escapeHtml(spentLabel) +
      " · " +
      payload.count +
      " card" +
      (payload.count > 1 ? "s" : "") +
      " dealt — tap to reveal</p>" +
      '<div class="gacha-grid" role="list">';

    payload.results.forEach(function (r, i) {
      const art = resolveArt(r);
      const tag = r.duplicate
        ? '<span class="gacha-dup">DUP +' + r.refund + "</span>"
        : '<span class="gacha-new">NEW</span>';
      const artHtml = art
        ? '<img class="gacha-reveal-art" src="' +
          escapeHtml(art) +
          '" alt="" draggable="false" />'
        : '<div class="gacha-reveal-fallback">' +
          escapeHtml((r.name || "?").charAt(0)) +
          "</div>";

      html +=
        '<div class="gacha-flip" role="button" tabindex="0" aria-pressed="false" aria-label="Mystery card ' +
        (i + 1) +
        ' — click to reveal" style="--deal-i:' +
        i +
        '">' +
        '<div class="gacha-flip-inner">' +
        '<div class="gacha-flip-face gacha-flip-back">' +
        '<img class="gacha-back-art" src="' +
        CARD_BACK +
        '" alt="Card back" draggable="false" />' +
        '<span class="gacha-back-mark" aria-hidden="true">?</span>' +
        "</div>" +
        '<div class="gacha-flip-face gacha-flip-front gacha-front-' +
        escapeHtml(r.type) +
        '">' +
        artHtml +
        '<span class="gacha-card-type">' +
        escapeHtml(typeLabel(r.type)) +
        "</span>" +
        '<span class="gacha-card-name">' +
        escapeHtml(r.name) +
        "</span>" +
        tag +
        "</div>" +
        "</div>" +
        "</div>";
    });

    html += "</div>";
    box.innerHTML = html;
    box.querySelectorAll(".gacha-flip").forEach(wireCard);
    setRevealControls(true, 0, payload.results.length);
    console.log("[CBGachaUI] dealt", payload.results.length, "cards");
  }

  function doPull(n) {
    if (!window.CBGacha) return;
    const res = n === 10 ? CBGacha.pullTen() : CBGacha.pullOne();
    if (res && res.ok && window.CBCountryballs && CBCountryballs.hasInfiniteCoins) {
      res.infinite = !!CBCountryballs.hasInfiniteCoins();
    }
    refreshCoins();
    showResults(res);
  }

  function showIdle() {
    const box = $("gacha-results");
    if (!box) return;
    box.innerHTML =
      '<div class="gacha-idle">' +
      '<img class="gacha-idle-ball" src="' +
      CARD_BACK +
      '" alt="" />' +
      '<p class="gacha-msg">Pull to deal mystery cards. Click each card to flip it over.</p>' +
      "</div>";
    setRevealControls(false, 0, 0);
  }

  function show() {
    refreshCoins();
    if (!lastPayload || !lastPayload.ok) {
      showIdle();
    }
    console.log(
      "[CBGachaUI] show coins=" +
        (window.CBCountryballs && CBCountryballs.getCoins())
    );
  }

  function init() {
    if (wired) return;
    wired = true;
    const one = $("btn-gacha-one");
    const ten = $("btn-gacha-ten");
    if (one) {
      one.addEventListener("click", function () {
        doPull(1);
      });
    }
    if (ten) {
      ten.addEventListener("click", function () {
        doPull(10);
      });
    }
    const flipAllBtn = $("btn-gacha-flip-all");
    if (flipAllBtn) {
      flipAllBtn.addEventListener("click", flipAll);
    }
    // Warm card-back image
    const warm = new Image();
    warm.src = CARD_BACK;
    console.log("[CBGachaUI] init OK (flip cards)");
  }

  return { init, show, refreshCoins, flipAll };
})();
