/**
 * Cosmetics catalog — hats for now (weapons/auras later).
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

  const byId = Object.create(null);
  HATS.forEach(function (h) {
    byId[h.id] = h;
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

  /**
   * Layout for drawing: center of ball at (cx,cy), radius r, facing ±1.
   * Returns { x, y, w, h, flip } top-left draw box (y = top of image).
   */
  function hatDrawBox(hat, cx, cy, radius, facing) {
    const h = getHat(hat && hat.id ? hat.id : hat);
    if (!h || !h.src || h.scale <= 0) return null;
    const fx = facing < 0 ? -1 : 1;
    const w = radius * 2 * h.scale;
    const aspect = h._aspect || 1;
    const hh = w / (aspect || 1);
    const x = cx + h.ox * radius * fx - w / 2;
    const y = cy + h.oy * radius - hh / 2;
    return { x: x, y: y, w: w, h: hh, flip: fx < 0, hat: h };
  }

  function preload() {
    HATS.forEach(function (h) {
      if (!h.src) return;
      const img = new Image();
      img.onload = function () {
        if (img.naturalWidth && img.naturalHeight) {
          h._aspect = img.naturalWidth / img.naturalHeight;
          h._img = img;
        }
        console.log("[CBCosmetics] loaded " + h.id);
      };
      img.onerror = function () {
        console.error("[CBCosmetics] failed " + h.src);
      };
      img.src = h.src;
      h._img = img;
    });
  }

  preload();

  return {
    listHats,
    getHat,
    isHatId,
    hatDrawBox,
    getImage: function (id) {
      const h = getHat(id);
      return h && h._img ? h._img : null;
    },
  };
})();
