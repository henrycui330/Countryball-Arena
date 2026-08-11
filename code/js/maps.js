/**
 * Arena maps: Plains and Icy (flat ground only — no platforms).
 */
window.CBMaps = (function () {
  const W = 960;
  const H = 540;
  const GRAVITY = 1650;

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

  function floorY(map, arenaH) {
    const h = arenaH != null ? arenaH : H;
    const groundY = map && map.groundY != null ? map.groundY : h * 0.72;
    return groundY - 6;
  }

  /**
   * Clamp entity to arena + ground. No platforms.
   */
  function resolveEntity(ent, map, arenaW, arenaH) {
    if (!ent || !map) return;
    const w = arenaW != null ? arenaW : W;
    const h = arenaH != null ? arenaH : H;
    const r = ent.radius;
    const minY = r + 16;
    const maxY = floorY(map, h);

    ent.x = Math.max(r, Math.min(w - r, ent.x));
    ent.y = Math.max(minY, Math.min(maxY, ent.y));
    if (ent.y >= maxY - 0.5) {
      ent.grounded = true;
      if (ent.vy == null || ent.vy > 0) ent.vy = 0;
    }
  }

  /**
   * Gravity + floor for grounded fighters (player, bots, allies).
   */
  function applyGroundPhysics(ent, map, arenaW, arenaH, dt, opts) {
    if (!ent) return;
    const o = opts || {};
    const w = arenaW != null ? arenaW : W;
    const h = arenaH != null ? arenaH : H;
    const gravity = o.gravity != null ? o.gravity : GRAVITY;
    const r = ent.radius || 40;
    const minY = r + 16;
    const floor = floorY(map || get("plains"), h);

    if (ent.vy == null) ent.vy = 0;
    if (!o.skipGravity) {
      ent.vy += gravity * dt;
    }

    ent.y += ent.vy * dt;
    ent.x = Math.max(r, Math.min(w - r, ent.x));

    if (ent.y < minY) {
      ent.y = minY;
      if (ent.vy < 0) ent.vy = 0;
    }

    if (ent.y >= floor) {
      ent.y = floor;
      ent.vy = 0;
      ent.grounded = true;
    } else {
      ent.grounded = false;
    }
  }

  return {
    MAPS,
    GRAVITY,
    get,
    list,
    drawPlatforms,
    floorY,
    resolveEntity,
    applyGroundPhysics,
  };
})();
