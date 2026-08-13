/**
 * Shared ball motion juice — jump/land squash only (no walk hop).
 * Gameplay x/y stay authoritative; this is draw-only.
 */
window.CBMotion = (function () {
  function ensure(ent) {
    if (!ent) return null;
    if (!ent._mot) {
      ent._mot = {
        px: ent.x,
        py: ent.y,
        visVx: 0,
        tilt: 0,
        squash: 0,
        bounce: 0,
        land: 0,
        bob: Math.random() * Math.PI * 2,
        wasGrounded: !!ent.grounded,
        ready: false,
      };
    }
    return ent._mot;
  }

  function punch(ent, opts) {
    const m = ensure(ent);
    if (!m) return;
    const o = opts || {};
    if (typeof o.squash === "number") m.squash = o.squash;
    if (typeof o.land === "number") m.land = o.land;
    if (typeof o.tilt === "number") m.tilt = o.tilt;
  }

  function tick(ent, dt) {
    if (!ent || !(dt > 0)) return;
    const m = ensure(ent);
    if (!m.ready) {
      m.px = ent.x;
      m.py = ent.y;
      m.wasGrounded = !!ent.grounded;
      m.ready = true;
    }
    const vx = (ent.x - m.px) / Math.max(0.0008, dt);
    m.visVx += (vx - m.visVx) * Math.min(1, 14 * dt);
    const dir = m.visVx >= 0 ? 1 : -1;
    m.bob += dt * 2.35;

    if (ent.grounded && !m.wasGrounded) {
      m.land = Math.min(1, 0.55 + Math.max(0, ent.y - m.py) * 0.02);
    }
    m.land = Math.max(0, m.land - dt * 5.4);

    let wantTilt = 0;
    let wantSq = 0;
    let bounce = 0;
    if (ent.plunging) {
      wantSq = -0.18;
    } else if (!ent.grounded) {
      const vy =
        typeof ent.vy === "number"
          ? ent.vy
          : (ent.y - m.py) / Math.max(0.0008, dt);
      wantSq = vy < -70 ? 0.16 : vy > 100 ? -0.13 : 0.07;
      wantTilt = dir * 0.08;
    }
    wantSq -= m.land * 0.28;
    bounce -= m.land * 8.5;

    m.tilt += (wantTilt - m.tilt) * Math.min(1, 10 * dt);
    m.squash += (wantSq - m.squash) * Math.min(1, 15 * dt);
    m.bounce += (bounce - m.bounce) * Math.min(1, 16 * dt);

    m.px = ent.x;
    m.py = ent.y;
    m.wasGrounded = !!ent.grounded;
  }

  /** After ctx.translate(x, y). Wobble + squash + hop. */
  function apply(ctx, ent) {
    const m = ent && ent._mot;
    if (!m) return 0;
    ctx.translate(0, m.bounce);
    ctx.rotate(m.tilt);
    ctx.scale(1 - m.squash * 0.92, 1 + m.squash);
    return m.bounce;
  }

  /** Wrap an absolute-coordinate draw (enemy/dummy) around the ball center. */
  function wrap(ctx, ent, drawFn) {
    if (!ent) return;
    ctx.save();
    ctx.translate(ent.x, ent.y);
    apply(ctx, ent);
    ctx.translate(-ent.x, -ent.y);
    drawFn();
    ctx.restore();
  }

  return { ensure, tick, punch, apply, wrap };
})();
