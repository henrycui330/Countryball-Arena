/**
 * Shared ball motion juice — countryball hop, wobble, squash.
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
    const speed = Math.abs(m.visVx);
    const run = !!(ent.grounded && speed > 50);
    const dir = m.visVx >= 0 ? 1 : -1;
    m.bob += dt * (run ? 10.6 : 2.35);

    const hop = Math.abs(Math.sin(m.bob));
    // Rock like a sticker, not a runner lean
    let wantTilt =
      Math.sin(m.bob) * (run ? 0.18 : 0.07) * dir +
      Math.sin(m.bob * 0.5) * 0.04;
    if (!ent.grounded) {
      wantTilt = dir * 0.08 + Math.sin(m.bob) * 0.05;
    }
    if (ent.plunging) wantTilt *= 0.2;
    m.tilt += (wantTilt - m.tilt) * Math.min(1, 10 * dt);

    if (ent.grounded && !m.wasGrounded) {
      m.land = Math.min(1, 0.55 + Math.max(0, ent.y - m.py) * 0.02);
    }
    m.land = Math.max(0, m.land - dt * 5.4);

    let wantSq = 0;
    if (ent.plunging) {
      wantSq = -0.18;
    } else if (!ent.grounded) {
      const vy =
        typeof ent.vy === "number"
          ? ent.vy
          : (ent.y - m.py) / Math.max(0.0008, dt);
      wantSq = vy < -70 ? 0.16 : vy > 100 ? -0.13 : 0.07;
    } else if (run) {
      wantSq = (hop - 0.5) * 0.28;
    } else {
      wantSq = Math.sin(m.bob) * 0.045;
    }
    wantSq -= m.land * 0.28;
    m.squash += (wantSq - m.squash) * Math.min(1, 15 * dt);

    let bounce = run ? hop * 7.8 : Math.sin(m.bob) * 2.2;
    bounce -= m.land * 8.5;
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
