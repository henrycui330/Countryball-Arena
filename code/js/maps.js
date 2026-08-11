/**
 * Arena maps: Plains and Icy (flat ground only — no platforms).
 */
window.CBMaps = (function () {
  const W = 960;
  const H = 540;

  const MAPS = {
    plains: {
      id: "plains",
      name: "Plains",
      groundY: H * 0.66,
      platforms: [],
      bgId: "plains",
    },
    icy: {
      id: "icy",
      name: "Icy",
      groundY: H * 0.70,
      platforms: [],
      bgId: "icy",
    },
  };

  function get(id) {
    if (id === "flat") return MAPS.plains; // legacy
    if (id === "platform") return MAPS.plains;
    return MAPS[id] || MAPS.plains;
  }

  function list() {
    return Object.keys(MAPS).map(function (k) {
      return { id: k, name: MAPS[k].name };
    });
  }

  function drawPlatforms() {
    /* platforms removed */
  }

  /**
   * Clamp entity to arena + ground. No platforms.
   */
  function resolveEntity(ent, map, W, H) {
    if (!ent || !map) return;
    const groundY = map.groundY != null ? map.groundY : H * 0.72;
    const r = ent.radius;
    const minY = r + 16;
    const maxY = groundY - 6;

    ent.x = Math.max(r, Math.min(W - r, ent.x));
    ent.y = Math.max(minY, Math.min(maxY, ent.y));
  }

  return {
    MAPS,
    get,
    list,
    drawPlatforms,
    resolveEntity,
  };
})();
