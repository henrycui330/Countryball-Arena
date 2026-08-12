/**
 * Cosmetics catalog — hats + weapon skins.
 */
window.CBCosmetics = (function () {
  const HATS = [
    {
      id: "none",
      name: "No hat",
      src: null,
      scale: 0,
      ox: 0,
      oy: 0,
    },
    {
      id: "officer_cap",
      name: "Officer Cap",
      src: "assets/hats/officer_cap.png",
      scale: 0.62,
      ox: 0.06,
      oy: -0.62,
    },
    {
      id: "straw",
      name: "Straw Hat",
      src: "assets/hats/straw.png",
      scale: 0.78,
      ox: 0,
      oy: -0.55,
    },
    {
      id: "usa_buddy",
      name: "Little USA",
      src: "assets/hats/usa_buddy.png",
      scale: 0.28,
      ox: 0.04,
      oy: -0.78,
    },
    {
      id: "japan_buddy",
      name: "Little Japan",
      src: "assets/hats/japan_buddy.png",
      scale: 0.28,
      ox: 0.04,
      oy: -0.78,
    },
    {
      id: "russia_buddy",
      name: "Little Russia",
      src: "assets/hats/russia_buddy.png",
      scale: 0.28,
      ox: 0.04,
      oy: -0.78,
    },
    {
      id: "kz_buddy",
      name: "Little Kazakhstan",
      src: "assets/hats/kz_buddy.png",
      scale: 0.28,
      ox: 0.04,
      oy: -0.78,
    },
    {
      id: "belarus_buddy",
      name: "Little Belarus",
      src: "assets/hats/belarus_buddy.png",
      scale: 0.28,
      ox: 0.04,
      oy: -0.78,
    },
    {
      id: "ukraine_buddy",
      name: "Little Ukraine",
      src: "assets/hats/ukraine_buddy.png",
      scale: 0.28,
      ox: 0.04,
      oy: -0.78,
    },
  ];

  /**
   * Extra hat placement per fighter (added to hat ox/oy).
   * Russia sprite sits larger / differently — nudge hats left + down.
   */
  const FIGHTER_HAT_NUDGE = {
    russia: { ox: -0.12, oy: 0.12 },
  };

  function fighterHatNudge(ballId) {
    const n = FIGHTER_HAT_NUDGE[ballId];
    return n ? { ox: n.ox, oy: n.oy } : { ox: 0, oy: 0 };
  }

  /** Fighter-locked weapon skins. null src → use fallbackSrc until art exists. */
  const WEAPONS = [
    {
      id: "none",
      name: "Default",
      fighter: null,
      src: null,
      fallbackSrc: null,
    },
    {
      id: "wpn_deagle_gold",
      name: "Gold Deagle",
      fighter: "usa",
      src: "assets/weapons/deagle_gold.png",
      fallbackSrc: "assets/deagle.png",
    },
    {
      id: "wpn_katana_blue",
      name: "Blue Katana",
      fighter: "japan",
      src: "assets/weapons/katana_blue.png",
      fallbackSrc: "assets/katana.png",
    },
    {
      id: "wpn_katana_rainbow",
      name: "Rainbow Katana",
      fighter: "japan",
      src: "assets/weapons/katana_rainbow.webp",
      fallbackSrc: "assets/katana.png",
    },
    {
      id: "wpn_absolut_ice",
      name: "Ice Absolut",
      fighter: "russia",
      src: null,
      fallbackSrc: "assets/absolut.png",
    },
  ];

  const byId = Object.create(null);
  HATS.forEach(function (h) {
    byId[h.id] = h;
  });

  const weaponById = Object.create(null);
  WEAPONS.forEach(function (w) {
    weaponById[w.id] = w;
  });

  const EFFECTS = [
    {
      id: "none",
      name: "Default",
      colors: null,
    },
    {
      id: "uncle_sam",
      name: "Uncle Sam",
      colors: ["#d7263d", "#ffffff", "#1f4ba5", "#f5f7ff", "#7a0014"],
      swatch: "#d7263d",
    },
    {
      id: "void_shroud",
      name: "Void Shroud",
      colors: ["#2a0a42", "#5f2a8a", "#a66bff", "#1a0c26", "#e2ccff"],
      swatch: "#6c3bb8",
    },
    {
      id: "solar_aegis",
      name: "Solar Aegis",
      colors: ["#f6b73c", "#ffd76a", "#fff4c2", "#c9861a", "#fff9e8"],
      swatch: "#f6b73c",
    },
    {
      id: "wrath_of_the_gods",
      name: "Wrath of the Gods",
      colors: ["#ff1a1a", "#ff4d4d", "#8b0000", "#ff6b6b", "#ffffff"],
      swatch: "#c62828",
    },
  ];

  const effectById = Object.create(null);
  EFFECTS.forEach(function (e) {
    effectById[e.id] = e;
  });

  function listHats() {
    return HATS.slice();
  }

  function getHat(id) {
    if (id == null || id === "" || id === "none" || id === "samurai") {
      return byId.none;
    }
    return byId[id] || byId.none;
  }

  function isHatId(id) {
    return !!(id && byId[id] && id !== "none");
  }

  function listWeapons() {
    return WEAPONS.slice();
  }

  function listWeaponsForFighter(fighterId) {
    return WEAPONS.filter(function (w) {
      return w.id === "none" || w.fighter === fighterId;
    });
  }

  function getWeapon(id) {
    if (id == null || id === "" || id === "none") return weaponById.none;
    return weaponById[id] || null;
  }

  function isWeaponId(id) {
    return !!(id && weaponById[id] && id !== "none");
  }

  function listEffects() {
    return EFFECTS.slice();
  }

  function getEffect(id) {
    if (id == null || id === "" || id === "none") return effectById.none;
    return effectById[id] || null;
  }

  function isEffectId(id) {
    return !!(id && effectById[id] && id !== "none");
  }

  function getEquippedEffect(ballId) {
    if (!window.CBCountryballs || !ballId) return null;
    const eid = CBCountryballs.getEffectId(ballId);
    if (!eid) return null;
    return getEffect(eid);
  }

  function weaponPreviewSrc(weapon) {
    const w = typeof weapon === "string" ? getWeapon(weapon) : weapon;
    if (!w || w.id === "none") return null;
    return w.src || w.fallbackSrc || null;
  }

  function weaponArtSrc(weapon) {
    return weaponPreviewSrc(weapon);
  }

  /**
   * Layout for drawing: center of ball at (cx,cy), radius r, facing ±1.
   * Optional ballId applies fighter-specific hat nudge (e.g. Russia).
   * Returns { x, y, w, h, flip } top-left draw box (y = top of image).
   */
  function hatDrawBox(hat, cx, cy, radius, facing, ballId) {
    const h = getHat(hat && hat.id ? hat.id : hat);
    if (!h || !h.src || h.scale <= 0) return null;
    const nudge = fighterHatNudge(ballId);
    const ox = h.ox + nudge.ox;
    const oy = h.oy + nudge.oy;
    const fx = facing < 0 ? -1 : 1;
    const w = radius * 2 * h.scale;
    const aspect = h._aspect || 1;
    const hh = w / (aspect || 1);
    const x = cx + ox * radius * fx - w / 2;
    const y = cy + oy * radius - hh / 2;
    return { x: x, y: y, w: w, h: hh, flip: fx < 0, hat: h };
  }

  function loadImg(entry, kind) {
    const src = entry.src || entry.fallbackSrc;
    if (!src) return;
    const img = new Image();
    img.onload = function () {
      if (img.naturalWidth && img.naturalHeight) {
        entry._aspect = img.naturalWidth / img.naturalHeight;
      }
      if (entry.id === "wpn_katana_blue" || entry.id === "wpn_katana_rainbow") {
        // Requested transforms:
        // - blue katana: vertical flip + 180deg
        // - rainbow katana: 180deg
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext("2d");
        if (ctx && c.width > 0 && c.height > 0) {
          ctx.translate(c.width / 2, c.height / 2);
          if (entry.id === "wpn_katana_blue") {
            ctx.scale(1, -1);
          }
          ctx.rotate(Math.PI);
          ctx.drawImage(img, -c.width / 2, -c.height / 2, c.width, c.height);
          const transformed = new Image();
          transformed.onload = function () {
            entry._img = transformed;
            if (transformed.naturalWidth && transformed.naturalHeight) {
              entry._aspect = transformed.naturalWidth / transformed.naturalHeight;
            }
            console.log("[CBCosmetics] transformed weapon " + entry.id);
          };
          transformed.src = c.toDataURL("image/png");
        }
      }
      console.log("[CBCosmetics] loaded " + kind + " " + entry.id);
    };
    img.onerror = function () {
      console.error("[CBCosmetics] failed " + src);
    };
    img.src = src;
    entry._img = img;
  }

  function preload() {
    HATS.forEach(function (h) {
      if (!h.src) return;
      loadImg(h, "hat");
    });
    WEAPONS.forEach(function (w) {
      if (w.id === "none") return;
      // Prefer real skin art; else warm fallback for picker/arena
      if (w.src) {
        loadImg(w, "weapon");
      } else if (w.fallbackSrc) {
        loadImg(w, "weapon-fallback");
      }
    });
  }

  /**
   * Image for equipped skin on a ball, or null to use ability default.
   * ballId: usa | japan | russia
   */
  function getEquippedWeaponImage(ballId) {
    if (!window.CBCountryballs || !ballId) return null;
    const wid = CBCountryballs.getWeaponId(ballId);
    if (!wid) return null;
    const w = getWeapon(wid);
    if (!w || w.id === "none") return null;
    if (w.fighter && w.fighter !== ballId) return null;
    if (w._img && w._img.complete && w._img.naturalWidth) return w._img;
    if (w._img) return w._img;
    return null;
  }

  function getEquippedWeaponPath(ballId) {
    if (!window.CBCountryballs || !ballId) return null;
    const wid = CBCountryballs.getWeaponId(ballId);
    if (!wid) return null;
    const w = getWeapon(wid);
    if (!w || w.id === "none") return null;
    if (w.fighter && w.fighter !== ballId) return null;
    return weaponArtSrc(w);
  }

  preload();

  return {
    listHats,
    getHat,
    isHatId,
    hatDrawBox,
    fighterHatNudge,
    listWeapons,
    listWeaponsForFighter,
    getWeapon,
    isWeaponId,
    listEffects,
    getEffect,
    isEffectId,
    getEquippedEffect,
    weaponPreviewSrc,
    weaponArtSrc,
    getEquippedWeaponImage,
    getEquippedWeaponPath,
    getImage: function (id) {
      const h = getHat(id);
      return h && h._img ? h._img : null;
    },
  };
})();
