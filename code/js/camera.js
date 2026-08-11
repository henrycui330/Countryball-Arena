/**
 * Smooth follow camera with zoom and temporary dramatic focus.
 * World space → screen: screen = (world - cam) * zoom + viewCenter
 */
window.CBCamera = (function () {
  const state = {
    x: 480,
    y: 270,
    zoom: 1,
    focusTimer: 0,
    focusX: 480,
    focusY: 270,
    focusZoom: 1.35,
    shake: 0,
    strikeFollow: false,
  };

  function reset(W, H) {
    state.x = W / 2;
    state.y = H / 2;
    state.zoom = 1;
    state.focusTimer = 0;
    state.shake = 0;
    state.strikeFollow = false;
  }

  /** Punch focus onto a world point for `duration` seconds */
  function focusOn(x, y, zoom, duration) {
    state.strikeFollow = false;
    state.focusX = x;
    state.focusY = y;
    state.focusZoom = zoom || 1.4;
    state.focusTimer = duration || 1;
    state.shake = Math.max(state.shake, 0.35);
    console.log(
      "[CBCamera] focusOn",
      Math.round(x),
      Math.round(y),
      "z=" + state.focusZoom.toFixed(2),
      "t=" + state.focusTimer.toFixed(2)
    );
  }

  /** Lock camera onto a moving finisher strike (call each frame) */
  function followStrike(x, y, zoom) {
    state.strikeFollow = true;
    state.focusX = x;
    state.focusY = y;
    state.focusZoom = zoom || 1.75;
    state.focusTimer = 0.25;
  }

  function clearStrikeFollow() {
    state.strikeFollow = false;
  }

  function addShake(amount) {
    state.shake = Math.max(state.shake, amount || 0.25);
  }

  function update(dt, opts) {
    const o = opts || {};
    const W = o.W || 960;
    const H = o.H || 540;
    const player = o.player;
    const target = o.target; // foe or null

    let desiredX = player ? player.x : W / 2;
    let desiredY = player ? player.y : H / 2;
    let desiredZoom = 1;

    if (state.strikeFollow || state.focusTimer > 0) {
      if (state.focusTimer > 0) state.focusTimer -= dt;
      desiredX = state.focusX;
      desiredY = state.focusY;
      desiredZoom = state.focusZoom;
      if (!state.strikeFollow && state.focusTimer < 0.35 && player && target) {
        const u = 1 - state.focusTimer / 0.35;
        desiredX = state.focusX + (0.5 * (player.x + target.x) - state.focusX) * u;
        desiredY = state.focusY + (0.5 * (player.y + target.y) - state.focusY) * u;
      }
    } else if (player && target) {
      desiredX = (player.x + target.x) * 0.5;
      desiredY = (player.y + target.y) * 0.5;
      const dist = Math.hypot(player.x - target.x, player.y - target.y);
      const t = Math.min(1, Math.max(0, (dist - 100) / 520));
      desiredZoom = 1.32 - t * 0.58;
    } else if (player) {
      desiredX = player.x;
      desiredY = player.y;
      desiredZoom = 1.05;
    }

    const follow = state.strikeFollow ? 14 : state.focusTimer > 0 ? 10 : 5.5;
    const zFollow = state.strikeFollow ? 10 : state.focusTimer > 0 ? 8 : 4;
    const a = 1 - Math.exp(-follow * dt);
    const za = 1 - Math.exp(-zFollow * dt);
    state.x += (desiredX - state.x) * a;
    state.y += (desiredY - state.y) * a;
    state.zoom += (desiredZoom - state.zoom) * za;

    const halfW = W / (2 * state.zoom);
    const halfH = H / (2 * state.zoom);
    const pad = 40;
    state.x = Math.max(halfW - pad, Math.min(W - halfW + pad, state.x));
    state.y = Math.max(halfH - pad, Math.min(H - halfH + pad, state.y));

    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 1.8);
    }
  }

  function apply(ctx, W, H) {
    let sx = 0;
    let sy = 0;
    if (state.shake > 0) {
      const m = state.shake * 10;
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
    }
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-state.x, -state.y);
  }

  function screenToWorld(sx, sy, W, H) {
    return {
      x: (sx - W / 2) / state.zoom + state.x,
      y: (sy - H / 2) / state.zoom + state.y,
    };
  }

  return {
    state,
    reset,
    focusOn,
    followStrike,
    clearStrikeFollow,
    addShake,
    update,
    apply,
    screenToWorld,
  };
})();
