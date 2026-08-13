/**
 * Shared effect pool: projectiles, particles, trails, stars.
 * Effects self-remove when life <= 0.
 */
window.CBEffects = (function () {
  const list = [];
  let nextId = 1;
  /** Japan ult cinematic overlay state (read by game draw) */
  let cinema = null;

  function add(effect) {
    effect.id = effect.id || nextId++;
    list.push(effect);
    return effect;
  }

  function clear() {
    list.length = 0;
    cinema = null;
  }

  function getCinema() {
    return cinema;
  }

  /** Active finisher strikes/projectiles (for slo-mo camera follow) */
  function getFinishers() {
    return list.filter(function (e) {
      return (
        e.finisher &&
        e.life > 0 &&
        !e.hit &&
        (e.type === "projectile" ||
          e.type === "star" ||
          e.type === "spriteProjectile" ||
          e.type === "deagleBash" ||
          e.type === "deagleSpin" ||
          e.type === "eagleFly" ||
          e.type === "warship" ||
          e.type === "katanaStrike" ||
          e.type === "katanaCharge" ||
          e.type === "japanUlt" ||
          e.type === "vodkaBarrage" ||
          (e.type === "baguetteMissile" && e.phase === "dive"))
      );
    });
  }

  function getPrimaryFinisher(toward) {
    const fins = getFinishers();
    if (!fins.length) return null;
    if (!toward) return fins[0];
    let best = fins[0];
    let bestD = Infinity;
    for (let i = 0; i < fins.length; i++) {
      const e = fins[i];
      const d = Math.hypot(e.x - toward.x, e.y - toward.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  function spawnParticle(x, y, opts) {
    const o = opts || {};
    return add({
      type: "particle",
      x,
      y,
      vx: o.vx ?? (Math.random() - 0.5) * 120,
      vy: o.vy ?? (Math.random() - 0.5) * 120,
      life: o.life ?? 0.5,
      maxLife: o.life ?? 0.5,
      size: o.size ?? 4,
      color: o.color || "#fff",
      gravity: o.gravity ?? 0,
    });
  }

  function spawnProjectile(x, y, opts) {
    const o = opts || {};
    return add({
      type: "projectile",
      x,
      y,
      vx: o.vx ?? 400,
      vy: o.vy ?? 0,
      life: o.life ?? 1.2,
      maxLife: o.life ?? 1.2,
      radius: o.radius ?? 10,
      colors: o.colors || ["#b22234", "#ffffff", "#3c3b6e"],
      damage: o.damage ?? 10,
      ownerId: o.ownerId || null,
      hit: false,
      finisher: !!o.finisher,
    });
  }

  function spawnTrail(x, y, opts) {
    const o = opts || {};
    return add({
      type: "trail",
      x,
      y,
      life: o.life ?? 0.35,
      maxLife: o.life ?? 0.35,
      size: o.size ?? 28,
      color: o.color || "rgba(178, 34, 52, 0.45)",
    });
  }

  function spawnStar(x, y, opts) {
    const o = opts || {};
    return add({
      type: "star",
      x,
      y,
      vx: o.vx ?? 0,
      vy: o.vy ?? 220,
      life: o.life ?? 1.4,
      maxLife: o.life ?? 1.4,
      size: o.size ?? 12,
      rot: Math.random() * Math.PI,
      spin: o.spin ?? 4,
      damage: o.damage ?? 8,
      ownerId: o.ownerId || null,
      hit: false,
      finisher: !!o.finisher,
    });
  }

  function spawnBurst(x, y, count, colors) {
    const palette = colors || ["#b22234", "#ffffff", "#3c3b6e", "#f7d354"];
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.2;
      const spd = 80 + Math.random() * 160;
      spawnParticle(x, y, {
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.35 + Math.random() * 0.35,
        size: 3 + Math.random() * 4,
        color: palette[i % palette.length],
        gravity: 80,
      });
    }
  }

  /** Big KO / impact explosion */
  function spawnExplosion(x, y, opts) {
    const o = opts || {};
    const power = o.power ?? 1;
    const colors = o.colors || ["#ff5252", "#ffca28", "#ffffff", "#bf360c", "#f7d354"];
    const rings = 3 + Math.floor(power * 2);
    for (let r = 0; r < rings; r++) {
      spawnBurst(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, 14 + Math.floor(power * 10), colors);
    }
    for (let i = 0; i < 20 + Math.floor(power * 18); i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 280 * power;
      spawnParticle(x, y, {
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        life: 0.45 + Math.random() * 0.55,
        size: 4 + Math.random() * 6 * power,
        color: colors[i % colors.length],
        gravity: 120,
      });
    }
    console.log("[CBEffects] explosion at", Math.round(x), Math.round(y), "power=" + power);
  }

  /** Particles rush inward (Void KO). */
  function spawnImplosion(x, y, opts) {
    const o = opts || {};
    const power = o.power ?? 1;
    const colors = o.colors || ["#2a0a42", "#5f2a8a", "#a66bff", "#1a0c26", "#e2ccff"];
    const n = 28 + Math.floor(power * 16);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 36 + Math.random() * 95 * power;
      const px = x + Math.cos(ang) * dist;
      const py = y + Math.sin(ang) * dist;
      spawnParticle(px, py, {
        vx: (x - px) * 3.4,
        vy: (y - py) * 3.4,
        life: 0.32 + Math.random() * 0.28,
        size: 3 + Math.random() * 4,
        color: colors[i % colors.length],
        gravity: 0,
      });
    }
    spawnShockwave(x, y, {
      color: o.ring || "rgba(166,107,255,0.55)",
      maxRadius: 88 * power,
      life: 0.34,
    });
    console.log("[CBEffects] implosion at", Math.round(x), Math.round(y));
  }

  /** Star-like burst (Uncle Sam KO). */
  function spawnStarBurst(x, y, opts) {
    const o = opts || {};
    const colors = o.colors || ["#d7263d", "#ffffff", "#1f4ba5", "#f5f7ff"];
    const n = o.count ?? 20;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const spd = 150 + Math.random() * 200;
      spawnParticle(x, y, {
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 50,
        life: 0.45 + Math.random() * 0.35,
        size: 3 + Math.random() * 4,
        color: colors[i % colors.length],
        gravity: 50,
      });
    }
  }

  /** Expanding impact ring (plunge / heavy hits). */
  function spawnShockwave(x, y, opts) {
    const o = opts || {};
    const life = o.life ?? 0.42;
    return add({
      type: "shockwave",
      x,
      y,
      life,
      maxLife: life,
      radius: o.radius ?? 18,
      maxRadius: o.maxRadius ?? 130,
      color: o.color || "rgba(255,255,255,0.75)",
      width: o.width ?? 3.5,
    });
  }

  /** Floor puddle — slows anyone standing in it except France (checked by caller). */
  function spawnWineSpill(opts) {
    const o = opts || {};
    const life = o.life ?? 5;
    console.log(
      "[CBEffects] wine spill at",
      Math.round(o.x || 0),
      Math.round(o.y || 0)
    );
    return add({
      type: "winePuddle",
      x: o.x ?? 0,
      y: o.y ?? 0,
      rx: o.rx ?? 130,
      ry: o.ry ?? 38,
      life: life,
      maxLife: life,
      ownerId: o.ownerId || null,
    });
  }

  function wineSlowAt(x, y) {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.type !== "winePuddle" || e.life <= 0) continue;
      const dx = (x - e.x) / (e.rx || 130);
      const dy = (y - e.y) / (e.ry || 38);
      if (dx * dx + dy * dy <= 1) return true;
    }
    return false;
  }

  function inAcidRain(x, y) {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.type !== "acidRain" || e.life <= 0) continue;
      const dx = (x - e.x) / (e.rx || 155);
      const dy = (y - e.y) / (e.ry || 110);
      if (dx * dx + dy * dy <= 1) return true;
    }
    return false;
  }

  function spawnAcidRain(opts) {
    const o = opts || {};
    const life = o.life ?? 5;
    console.log("[CBEffects] acid rain at", Math.round(o.x || 0), Math.round(o.y || 0));
    return add({
      type: "acidRain",
      x: o.x ?? 0,
      y: o.y ?? 0,
      rx: o.rx ?? 155,
      ry: o.ry ?? 110,
      life: life,
      maxLife: life,
      tick: o.tick ?? 0.38,
      tickLeft: 0.12,
      damage: o.damage ?? 7,
      ownerId: o.ownerId || null,
      drops: [],
    });
  }

  function spawnWarship(opts) {
    const o = opts || {};
    const w = o.w ?? 2240;
    const h = o.h ?? 840;
    const vx = o.vx ?? 420;
    const life =
      o.life != null
        ? o.life
        : (960 + w) / Math.max(180, Math.abs(vx)) + 0.8;
    console.log("[CBEffects] warship vx=" + vx + " size=" + w + "x" + h);
    return add({
      type: "warship",
      x: o.x ?? -1000,
      y: (o.groundY ?? 360) - h * 0.18,
      groundY: o.groundY ?? 360,
      vx: vx,
      vy: 0,
      w: w,
      h: h,
      hitH: o.hitH ?? 92,
      facing: o.facing >= 0 ? 1 : -1,
      img: o.img || null,
      life: life,
      maxLife: life,
      damage: o.damage ?? 80,
      ownerId: o.ownerId || null,
      finisher: !!o.finisher,
      hitIds: {},
    });
  }

  const WRATH_RED = ["#ff1a1a", "#ff4d4d", "#8b0000", "#ff6b6b", "#ffffff"];

  /** Jagged red lightning bolts around a point (plunge / ambient). */
  function spawnWrathLightning(x, y, opts) {
    const o = opts || {};
    const count = o.count ?? 3;
    const colors = o.colors || WRATH_RED;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const len = 40 + Math.random() * 70;
      const segments = [];
      let px = x + (Math.random() - 0.5) * 30;
      let py = y - 20 - Math.random() * 50;
      segments.push({ x: px, y: py });
      const steps = 4 + Math.floor(Math.random() * 3);
      for (let s = 0; s < steps; s++) {
        px += Math.cos(ang) * (len / steps) + (Math.random() - 0.5) * 22;
        py += Math.sin(ang) * (len / steps) + (Math.random() - 0.5) * 22;
        segments.push({ x: px, y: py });
      }
      add({
        type: "wrathBolt",
        segments: segments,
        life: 0.18 + Math.random() * 0.16,
        maxLife: 0.28,
        color: colors[i % colors.length],
        width: 2 + Math.random() * 2,
      });
      spawnParticle(px, py, {
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        life: 0.2,
        size: 2 + Math.random() * 2,
        color: colors[0],
      });
    }
  }

  /**
   * Finisher: 3 red lines cross foe, then callback (explode).
   */
  function spawnFinisherCross(opts) {
    const o = opts || {};
    const x = o.x ?? 0;
    const y = o.y ?? 0;
    const life = o.life ?? 0.38;
    console.log("[CBEffects] Wrath finisher cross at", Math.round(x), Math.round(y));
    return add({
      type: "finisherCross",
      x: x,
      y: y,
      life: life,
      maxLife: life,
      radius: o.radius ?? 48,
      colors: o.colors || WRATH_RED,
      onDone: o.onDone || null,
      done: false,
      angles: [-0.55, 0.15, 1.05],
    });
  }

  function wrathTrailAt(x, y) {
    spawnParticle(x, y, {
      vx: (Math.random() - 0.5) * 40,
      vy: -30 - Math.random() * 40,
      life: 0.22 + Math.random() * 0.15,
      size: 3 + Math.random() * 3,
      color: WRATH_RED[Math.floor(Math.random() * 3)],
      gravity: -20,
    });
  }

  /**
   * Melee pistol-whip: Deagle swings on the hand and smacks anything in reach.
   */
  function spawnDeagleBash(opts) {
    const o = opts || {};
    const w = o.w ?? 68;
    const h = o.h ?? 37;
    const life = o.life ?? 0.28;
    return add({
      type: "deagleBash",
      follow: o.follow || null,
      handX: o.x || 0,
      handY: o.y || 0,
      rot: 0,
      life,
      maxLife: life,
      img: o.img || null,
      w,
      h,
      pivotX: o.pivotX ?? w * 0.34,
      pivotY: o.pivotY ?? h * 0.58,
      muzzleX: o.muzzleLocalX ?? w * 0.94,
      muzzleY: o.muzzleLocalY ?? h * 0.4,
      aimX: o.aimX ?? 0,
      aimY: o.aimY ?? 0,
      damage: o.damage ?? 14,
      hitRadius: o.hitRadius ?? 36,
      reach: o.reach ?? 78,
      knockback: o.knockback ?? 140,
      ownerId: o.ownerId || null,
      handDist: o.handDist ?? 0.5,
      hit: false,
      finisher: !!o.finisher,
      // Swing from raised to forward (radians offset from aim)
      swingFrom: o.swingFrom ?? -1.35,
      swingTo: o.swingTo ?? 0.25,
      wrath: !!o.wrath,
    });
  }

  /**
   * Finger-spin Deagle on the ball's "hand", then fire a bullet (gun stays, does not throw).
   * Phases: spin → aim+shoot → brief hold/recoil → remove.
   */
  function spawnDeagleSpin(opts) {
    const o = opts || {};
    const spinLife = o.spinLife ?? 0.42;
    const holdLife = o.holdLife ?? 0.28;
    const w = o.w ?? 68;
    const h = o.h ?? 37;
    return add({
      type: "deagleSpin",
      phase: "spin", // spin | hold
      follow: o.follow || null,
      handX: o.x || 0,
      handY: o.y || 0,
      rot: o.angle ?? 0,
      spin: o.spin ?? 22,
      // life counts down within current phase
      life: spinLife,
      maxLife: spinLife,
      spinLife,
      holdLife,
      img: o.img || null,
      w,
      h,
      // Trigger-guard pivot in sprite pixels (from top-left); gun faces right
      pivotX: o.pivotX ?? w * 0.34,
      pivotY: o.pivotY ?? h * 0.58,
      // Muzzle tip in sprite pixels (from top-left)
      muzzleX: o.muzzleLocalX ?? w * 0.94,
      muzzleY: o.muzzleLocalY ?? h * 0.4,
      aimX: o.aimX ?? 0,
      aimY: o.aimY ?? 0,
      damage: o.damage ?? 30,
      speed: o.speed ?? 780,
      bulletRadius: o.bulletRadius ?? 7,
      ownerId: o.ownerId || null,
      charge: o.charge ?? 1,
      fired: false,
      recoil: 0,
      handDist: o.handDist ?? 0.52, // fraction of body radius toward aim
      onFire: o.onFire || null,
      finisher: !!o.finisher,
      wrath: !!o.wrath,
      bulletColors: o.bulletColors || null,
    });
  }

  function aimFromFollow(e) {
    const cx = e.follow ? e.follow.x : e.handX;
    const cy = e.follow ? e.follow.y : e.handY;
    if (e.follow && typeof e.follow.aimX === "number") {
      e.aimX = e.follow.aimX;
      e.aimY = e.follow.aimY;
    }
    let dx = e.aimX - cx;
    let dy = e.aimY - cy;
    const len = Math.hypot(dx, dy);
    if (len < 4) return { cx, cy, dx: 1, dy: 0, ang: 0 };
    dx /= len;
    dy /= len;
    return { cx, cy, dx, dy, ang: Math.atan2(dy, dx) };
  }

  function updateDeagleHand(e) {
    const a = aimFromFollow(e);
    const bodyR = (e.follow && e.follow.radius) || 42;
    e.handX = a.cx + a.dx * bodyR * e.handDist;
    e.handY = a.cy + a.dy * bodyR * e.handDist;
    return a;
  }

  /** Local sprite offset from pivot → world */
  function deagleLocalToWorld(e, localX, localY) {
    const lx = localX - e.pivotX;
    const ly = localY - e.pivotY;
    const c = Math.cos(e.rot);
    const s = Math.sin(e.rot);
    return {
      x: e.handX + lx * c - ly * s,
      y: e.handY + lx * s + ly * c,
    };
  }

  function fireDeagleBullet(e) {
    if (e.fired) return;
    e.fired = true;

    const a = updateDeagleHand(e);
    e.rot = a.ang - e.recoil;

    const muzzle = deagleLocalToWorld(e, e.muzzleX, e.muzzleY);

    spawnBurst(muzzle.x, muzzle.y, 14 + Math.floor((e.charge || 0) * 8), [
      "#f7d354",
      "#ffffff",
      "#c0c0c0",
      "#b22234",
    ]);

    // Hot muzzle flash streaks
    for (let i = 0; i < 10; i++) {
      spawnParticle(muzzle.x, muzzle.y, {
        vx: a.dx * (220 + Math.random() * 180) + (Math.random() - 0.5) * 50,
        vy: a.dy * (220 + Math.random() * 180) + (Math.random() - 0.5) * 50,
        life: 0.12 + Math.random() * 0.12,
        size: 2 + Math.random() * 3,
        color: e.wrath
          ? i % 2
            ? "#ff1a1a"
            : "#ff6b6b"
          : i % 2
            ? "#f7d354"
            : "#fff7d6",
      });
    }

    // Bullet (not the gun)
    spawnProjectile(muzzle.x, muzzle.y, {
      vx: a.dx * e.speed,
      vy: a.dy * e.speed,
      life: 1.1,
      radius: e.bulletRadius,
      colors: e.bulletColors || ["#f7d354", "#ffffff", "#888888"],
      damage: e.damage,
      ownerId: e.ownerId,
      finisher: !!e.finisher,
    });

    e.recoil = 0.35; // radians kick
    console.log("[CBEffects] Deagle hand-spin → fired bullet dmg=" + e.damage);
    if (typeof e.onFire === "function") e.onFire(e);
  }

  /**
   * Eagle flies across the arena and periodically drops damaging stars.
   */
  function spawnEagleFlyby(opts) {
    const o = opts || {};
    const life = o.life ?? 2.6;
    return add({
      type: "eagleFly",
      x: o.x ?? 0,
      y: o.y ?? 120,
      vx: o.vx ?? 380,
      vy: o.vy ?? 0,
      life,
      maxLife: life,
      img: o.img || null,
      w: o.w ?? 120,
      h: o.h ?? 120,
      facing: o.facing ?? 1,
      bob: 0,
      bobAmp: o.bobAmp ?? 28,
      dropEvery: o.dropEvery ?? 0.15,
      dropTimer: 0.02, // drop soon after spawn
      dropsLeft: o.dropsLeft ?? 8,
      starDamage: o.starDamage ?? 8,
      starSize: o.starSize ?? 11,
      ownerId: o.ownerId || null,
      mapSpread: o.mapSpread ?? false,
      finisher: !!o.finisher,
    });
  }

  /** Thrown sprite (money stacks, etc.) */
  function spawnSpriteProjectile(x, y, opts) {
    const o = opts || {};
    return add({
      type: "spriteProjectile",
      x,
      y,
      vx: o.vx ?? 400,
      vy: o.vy ?? 0,
      life: o.life ?? 1.4,
      maxLife: o.life ?? 1.4,
      radius: o.radius ?? 22,
      damage: o.damage ?? 12,
      ownerId: o.ownerId || null,
      hit: false,
      img: o.img || null,
      w: o.w ?? 56,
      h: o.h ?? 56,
      rot: o.rot ?? 0,
      spin: o.spin ?? 6,
      gravity: o.gravity ?? 280,
      homing: !!o.homing,
      target: o.target || null,
      turnRate: o.turnRate ?? 5,
      finisher: !!o.finisher,
    });
  }

  function badFuse() {
    const r = Math.random();
    if (r < 0.12) return 1.7 + Math.random() * 0.7; // almost a dud, then pops
    if (r < 0.45) return 0.22 + Math.random() * 0.28; // hair-trigger
    return 0.55 + Math.random() * 0.85;
  }

  /**
   * Dive into the floor, stick like a missile, then explode after a bad fuse.
   */
  function spawnBaguetteMissile(opts) {
    const o = opts || {};
    const fuse = o.fuse != null ? o.fuse : badFuse();
    const delay = o.delay || 0;
    console.log(
      "[CBEffects] baguette missile fuse=" + fuse.toFixed(2) + "s delay=" + delay.toFixed(2)
    );
    return add({
      type: "baguetteMissile",
      phase: delay > 0 ? "wait" : "dive",
      wait: delay,
      x: o.x ?? 0,
      y: o.y ?? 0,
      vx: o.vx ?? 0,
      vy: o.vy ?? 260,
      impactX: o.impactX ?? o.x ?? 0,
      groundY: o.groundY ?? 360,
      life: 5.5,
      maxLife: 5.5,
      fuse: fuse,
      fuseLeft: fuse,
      img: o.img || null,
      w: o.w ?? 150,
      h: o.h ?? 48,
      rot: Math.PI * 0.55,
      radius: o.radius ?? 62,
      damage: o.damage ?? 38,
      ownerId: o.ownerId || null,
      finisher: !!o.finisher,
      bury: 0,
      shake: 0,
      hit: false,
    });
  }

  /**
   * Katana melee swing (same timing as deagle bash; tip hit + 180° sprite flip).
   */
  function spawnKatanaStrike(opts) {
    const o = opts || {};
    const w = o.w ?? 82;
    const h = o.h ?? 77;
    const life = o.life ?? 0.28;
    return add({
      type: "katanaStrike",
      follow: o.follow || null,
      handX: o.x || 0,
      handY: o.y || 0,
      rot: 0,
      life,
      maxLife: life,
      img: o.img || null,
      w,
      h,
      pivotX: o.pivotX ?? w * 0.78,
      pivotY: o.pivotY ?? h * 0.24,
      muzzleX: o.tipLocalX ?? w * 0.12,
      muzzleY: o.tipLocalY ?? h * 0.82,
      rotOffset: o.rotOffset ?? Math.PI,
      aimX: o.aimX ?? 0,
      aimY: o.aimY ?? 0,
      damage: o.damage ?? 18,
      hitRadius: o.hitRadius ?? 42,
      reach: o.reach ?? 90,
      knockback: o.knockback ?? 175,
      ownerId: o.ownerId || null,
      handDist: o.handDist ?? 0.48,
      hit: false,
      finisher: !!o.finisher,
      swingFrom: o.swingFrom ?? -1.55,
      swingTo: o.swingTo ?? 0.45,
      silhouette: false,
      wrath: !!o.wrath,
    });
  }

  /**
   * Charged: shove foe across arena, then abdomen stab.
   */
  function spawnKatanaCharge(opts) {
    const o = opts || {};
    const shoveTime = o.shoveTime ?? 0.55;
    const stabTime = o.stabTime ?? 0.38;
    const life = shoveTime + stabTime;
    const w = o.w ?? 82;
    const h = o.h ?? 77;
    return add({
      type: "katanaCharge",
      phase: "shove",
      follow: o.follow || null,
      target: o.target || null,
      handX: 0,
      handY: 0,
      rot: 0,
      life,
      maxLife: life,
      shoveTime,
      stabTime,
      phaseLife: shoveTime,
      img: o.img || null,
      w,
      h,
      pivotX: o.pivotX ?? w * 0.78,
      pivotY: o.pivotY ?? h * 0.24,
      muzzleX: o.tipLocalX ?? w * 0.12,
      muzzleY: o.tipLocalY ?? h * 0.82,
      rotOffset: o.rotOffset ?? Math.PI,
      dirX: o.dirX ?? 1,
      dirY: o.dirY ?? 0,
      damage: o.damage ?? 40,
      charge: o.charge ?? 1,
      ownerId: o.ownerId || null,
      handDist: o.handDist ?? 0.48,
      arenaW: o.arenaW ?? 960,
      arenaH: o.arenaH ?? 540,
      hit: false,
      finisher: !!o.finisher,
      thrust: 0,
      wrath: !!o.wrath,
    });
  }

  /**
   * Russia charged: rapid Absolut strikes; locks foe (stun) during barrage.
   */
  function spawnVodkaBarrage(opts) {
    const o = opts || {};
    const duration = o.duration ?? 1.0;
    const hits = Math.max(1, o.hits ?? 6);
    const w = o.w ?? 42;
    const h = o.h ?? 72;
    const target = o.target || null;
    if (target) {
      target.stunTimer = Math.max(target.stunTimer || 0, duration + 0.05);
    }
    return add({
      type: "vodkaBarrage",
      follow: o.follow || null,
      target: target,
      img: o.img || null,
      w,
      h,
      pivotX: o.pivotX ?? w * 0.5,
      pivotY: o.pivotY ?? h * 0.8,
      muzzleX: o.tipLocalX ?? w * 0.5,
      muzzleY: o.tipLocalY ?? h * 0.1,
      handX: 0,
      handY: 0,
      rot: 0,
      life: duration,
      maxLife: duration,
      hitsLeft: hits,
      hitEvery: duration / (hits + 0.5),
      hitTimer: 0.08,
      damage: o.damage ?? 8,
      ownerId: o.ownerId || null,
      handDist: o.handDist ?? 0.55,
      finisher: !!o.finisher,
      hit: false,
      swing: 0,
      wrath: !!o.wrath,
    });
  }

  /** Brief bottle tip-up while drinking. */
  function spawnDrinkPose(opts) {
    const o = opts || {};
    const life = o.life ?? 0.55;
    const w = o.w ?? 42;
    const h = o.h ?? 72;
    return add({
      type: "drinkPose",
      follow: o.follow || null,
      img: o.img || null,
      w,
      h,
      pivotX: o.pivotX ?? w * 0.5,
      pivotY: o.pivotY ?? h * 0.8,
      handX: 0,
      handY: 0,
      rot: -1.2,
      life,
      maxLife: life,
      handDist: 0.4,
    });
  }

  /**
   * Aerial plunge: weapon tip-down while diving; removed when life ends (game lands).
   */
  function spawnPlungeAttack(opts) {
    const o = opts || {};
    const life = o.life ?? 2.5;
    const w = o.w ?? 68;
    const h = o.h ?? 37;
    return add({
      type: "plungeAttack",
      follow: o.follow || null,
      img: o.img || null,
      w,
      h,
      pivotX: o.pivotX ?? w * 0.34,
      pivotY: o.pivotY ?? h * 0.58,
      muzzleX: o.muzzleLocalX ?? w * 0.94,
      muzzleY: o.muzzleLocalY ?? h * 0.4,
      rotOffset: o.rotOffset ?? 0,
      handX: 0,
      handY: 0,
      rot: Math.PI / 2 + (o.rotOffset || 0),
      life,
      maxLife: life,
      handDist: o.handDist ?? 0.45,
      tipDown: true,
      trailColor: o.trailColor || "rgba(255,255,255,0.35)",
      sparkColor: o.sparkColor || "#ffffff",
    });
  }

  /**
   * Ult: white screen, black silhouettes, lightning dash past foe, fatal stab.
   */
  function spawnJapanCinemaUlt(opts) {
    const o = opts || {};
    const life = 2.35;
    const w = o.w ?? 82;
    const h = o.h ?? 77;
    cinema = {
      active: true,
      white: 0,
      silhouette: false,
      floorBlack: false,
      lockControl: true,
    };
    console.log("[CBEffects] Japan cinema ult start");
    return add({
      type: "japanUlt",
      phase: "flashIn",
      life,
      maxLife: life,
      phaseLife: 0.22,
      player: o.player || null,
      foe: o.foe || null,
      img: o.katanaImg || null,
      w,
      h,
      pivotX: o.pivotX ?? w * 0.78,
      pivotY: o.pivotY ?? h * 0.24,
      muzzleX: o.tipLocalX ?? w * 0.12,
      muzzleY: o.tipLocalY ?? h * 0.82,
      rotOffset: o.rotOffset ?? Math.PI,
      handX: 0,
      handY: 0,
      rot: 0,
      handDist: 0.5,
      damage: o.damage ?? 120,
      ownerId: o.ownerId || null,
      finisher: !!o.finisher,
      hit: false,
      stabbed: false,
      arenaW: o.arenaW ?? 960,
      arenaH: o.arenaH ?? 540,
      dashFromX: 0,
      dashFromY: 0,
      dashToX: 0,
      dashToY: 0,
      thrust: 0,
    });
  }

  function weaponLocalToWorld(e, localX, localY) {
    const lx = localX - e.pivotX;
    const ly = localY - e.pivotY;
    const c = Math.cos(e.rot);
    const s = Math.sin(e.rot);
    return {
      x: e.handX + lx * c - ly * s,
      y: e.handY + lx * s + ly * c,
    };
  }

  /** Place hand so a local tip point lands at world (tipX, tipY) with current rot. */
  function handForTipAt(e, tipX, tipY) {
    const lx = e.muzzleX - e.pivotX;
    const ly = e.muzzleY - e.pivotY;
    const c = Math.cos(e.rot);
    const s = Math.sin(e.rot);
    return {
      x: tipX - (lx * c - ly * s),
      y: tipY - (lx * s + ly * c),
    };
  }

  function updateWeaponHand(e) {
    const a = aimFromFollow(e);
    const bodyR = (e.follow && e.follow.radius) || 42;
    e.handX = a.cx + a.dx * bodyR * (e.handDist || 0.5);
    e.handY = a.cy + a.dy * bodyR * (e.handDist || 0.5);
    return a;
  }

  function drawWeaponSprite(ctx, e) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.translate(e.handX, e.handY);
    ctx.rotate(e.rot);
    if (cinema && cinema.silhouette) {
      ctx.filter = "brightness(0)";
    }
    if (e.img && e.img.complete && e.img.naturalWidth) {
      ctx.drawImage(e.img, -e.pivotX, -e.pivotY, e.w, e.h);
    } else {
      ctx.fillStyle = cinema && cinema.silhouette ? "#000" : "#aaa";
      ctx.fillRect(-e.pivotX, -e.pivotY, e.w, e.h);
    }
    ctx.filter = "none";
    ctx.restore();
  }

  function steerHoming(e, dt) {
    if (!e.homing || !e.target || e.target.hp <= 0) return;
    const tx = e.target.x - e.x;
    const ty = e.target.y - e.y;
    const desired = Math.atan2(ty, tx);
    const speed = Math.hypot(e.vx, e.vy) || 360;
    let cur = Math.atan2(e.vy, e.vx);
    let diff = desired - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = (e.turnRate || 5) * dt;
    if (diff > maxTurn) diff = maxTurn;
    if (diff < -maxTurn) diff = -maxTurn;
    cur += diff;
    e.vx = Math.cos(cur) * speed;
    e.vy = Math.sin(cur) * speed;
  }

  function update(dt, hitTargets) {
    const targets = hitTargets || [];

    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.life -= dt;

      if (e.type === "deagleBash") {
        const a = updateDeagleHand(e);
        e.x = e.handX;
        e.y = e.handY;
        const progress = 1 - Math.max(0, e.life) / (e.maxLife || 0.28);
        // Ease-in smash
        const eased = progress * progress;
        e.rot = a.ang + e.swingFrom + (e.swingTo - e.swingFrom) * eased;
        if (e.wrath && Math.random() > 0.35) {
          wrathTrailAt(e.handX, e.handY);
        }

        // Impact window ~ mid-late swing
        if (!e.hit && progress >= 0.55) {
          e.hit = true;
          const tip = deagleLocalToWorld(e, e.muzzleX, e.muzzleY);
          // Also push strike point along aim for solid reach
          const strikeX = tip.x;
          const strikeY = tip.y;
          spawnBurst(strikeX, strikeY, 12, [
            "#c0c0c0",
            "#ffffff",
            "#b22234",
            "#f7d354",
          ]);
          for (const t of targets) {
            if (t.id === e.ownerId || t.hp <= 0) continue;
            if (t.ownerId && t.ownerId === e.ownerId) continue;
          if (t.invuln) continue;
            const dx = t.x - strikeX;
            const dy = t.y - strikeY;
            const rr = e.hitRadius + (t.radius || 30);
            // Also allow hit if target is within arm reach of player in aim cone
            const pdx = t.x - a.cx;
            const pdy = t.y - a.cy;
            const along = pdx * a.dx + pdy * a.dy;
            const dist = Math.hypot(dx, dy);
            const inSwing =
              dist <= rr ||
              (along > 0 &&
                along < e.reach &&
                Math.hypot(pdx - a.dx * along, pdy - a.dy * along) < e.hitRadius + 10);
            if (inSwing) {
              t.hp = Math.max(0, t.hp - e.damage);
              t.flash = 0.25;
              t.x += a.dx * (e.knockback * 0.08);
              t.y += a.dy * (e.knockback * 0.08);
              spawnBurst(t.x, t.y, 10, ["#fff", "#c0c0c0", "#b22234"]);
              console.log(
                `[CBEffects] Deagle bash hit ${t.id} for ${e.damage} (hp=${t.hp})`
              );
            }
          }
          console.log("[CBEffects] Deagle bash impact");
        }
      }

      if (e.type === "katanaStrike") {
        const a = updateWeaponHand(e);
        e.x = e.handX;
        e.y = e.handY;
        const progress = 1 - Math.max(0, e.life) / (e.maxLife || 0.28);
        const eased = progress * progress;
        e.rot =
          a.ang +
          (e.rotOffset || 0) +
          e.swingFrom +
          (e.swingTo - e.swingFrom) * eased;
        if (e.wrath && Math.random() > 0.35) {
          wrathTrailAt(e.handX, e.handY);
        }

        if (!e.hit && progress >= 0.5) {
          e.hit = true;
          const tip = weaponLocalToWorld(e, e.muzzleX, e.muzzleY);
          spawnBurst(tip.x, tip.y, 14, ["#bc002d", "#ffffff", "#888", "#111"]);
          for (const t of targets) {
            if (t.id === e.ownerId || t.hp <= 0) continue;
            if (t.ownerId && t.ownerId === e.ownerId) continue;
            if (t.invuln) continue;
            const dx = t.x - tip.x;
            const dy = t.y - tip.y;
            const rr = e.hitRadius + (t.radius || 30);
            const pdx = t.x - a.cx;
            const pdy = t.y - a.cy;
            const along = pdx * a.dx + pdy * a.dy;
            const dist = Math.hypot(dx, dy);
            const inSwing =
              dist <= rr ||
              (along > 0 &&
                along < e.reach &&
                Math.hypot(pdx - a.dx * along, pdy - a.dy * along) <
                  e.hitRadius + 12);
            if (inSwing) {
              t.hp = Math.max(0, t.hp - e.damage);
              t.flash = 0.25;
              t.x += a.dx * (e.knockback * 0.09);
              t.y += a.dy * (e.knockback * 0.09);
              spawnBurst(t.x, t.y, 12, ["#fff", "#bc002d", "#333"]);
              console.log(
                `[CBEffects] Katana strike hit ${t.id} for ${e.damage} (hp=${t.hp})`
              );
            }
          }
          console.log("[CBEffects] Katana strike impact");
        }
      }

      if (e.type === "katanaCharge") {
        const p = e.follow;
        const t = e.target;
        const ang = Math.atan2(e.dirY, e.dirX);
        e.phaseLife -= dt;

        if (e.phase === "shove") {
          const shoveSpeed = 520 + (e.charge || 0) * 180;

          if (t && t.hp > 0 && p) {
            // Drive foe; keep tip planted on their front (abdomen line)
            t.x += e.dirX * shoveSpeed * dt;
            t.y += e.dirY * shoveSpeed * 0.45 * dt;
            const tr = t.radius || 38;
            t.x = Math.max(tr + 8, Math.min(e.arenaW - tr - 8, t.x));
            t.y = Math.max(tr + 24, Math.min(e.arenaH * 0.78, t.y));
            t.flash = Math.max(t.flash || 0, 0.08);

            const contactX = t.x - e.dirX * tr * 0.88;
            const contactY = t.y + tr * 0.12;
            // Blade aimed along shove; tip locked to contact on foe
            const pushAng = Math.atan2(e.dirY, e.dirX);
            e.rot = pushAng + (e.rotOffset || 0);

            const hand = handForTipAt(e, contactX, contactY);
            e.handX = hand.x;
            e.handY = hand.y;

            // Seat player behind the hilt so the blade bridges into the foe
            const dx = Math.cos(pushAng);
            const dy = Math.sin(pushAng);
            p.x = e.handX - dx * p.radius * (e.handDist || 0.48);
            p.y = e.handY - dy * p.radius * (e.handDist || 0.48);
            p.facing = dx >= 0 ? 1 : -1;

            if (Math.random() > 0.45) {
              spawnParticle(contactX, contactY, {
                vx: -e.dirX * 50 + (Math.random() - 0.5) * 30,
                vy: (Math.random() - 0.5) * 50,
                life: 0.18,
                size: 2 + Math.random() * 2,
                color: Math.random() > 0.5 ? "#bc002d" : "#ffffff",
              });
            }
          } else if (p) {
            // No target — lunge with tip extended along aim
            p.x += e.dirX * shoveSpeed * 0.7 * dt;
            p.y += e.dirY * shoveSpeed * 0.4 * dt;
            p.facing = e.dirX >= 0 ? 1 : -1;
            e.rot = ang + (e.rotOffset || 0);
            e.handX = p.x + e.dirX * (p.radius * e.handDist + 18);
            e.handY = p.y + e.dirY * (p.radius * e.handDist + 10);
          }

          if (e.phaseLife <= 0) {
            e.phase = "stab";
            e.phaseLife = e.stabTime;
            e.thrust = 0;
            console.log("[CBEffects] Katana charge → stab phase");
          }
        } else if (e.phase === "stab") {
          const stabProg = 1 - Math.max(0, e.phaseLife) / (e.stabTime || 0.38);
          e.thrust = Math.sin(Math.min(1, stabProg) * Math.PI) * 22;
          if (p && t && t.hp > 0) {
            const tr = t.radius || 38;
            const abdomenX = t.x;
            const abdomenY = t.y + tr * 0.15;
            const aimAng = Math.atan2(abdomenY - p.y, abdomenX - p.x);
            e.rot = aimAng + (e.rotOffset || 0);
            // Tip digs deeper into abdomen as thrust rises
            const dig = tr * (0.35 + e.thrust / 40);
            const tipX = abdomenX - Math.cos(aimAng) * (tr - dig);
            const tipY = abdomenY - Math.sin(aimAng) * (tr - dig);
            const hand = handForTipAt(e, tipX, tipY);
            e.handX = hand.x;
            e.handY = hand.y;
            const dx = Math.cos(aimAng);
            const dy = Math.sin(aimAng);
            p.x = e.handX - dx * p.radius * (e.handDist || 0.48);
            p.y = e.handY - dy * p.radius * (e.handDist || 0.48);
            p.facing = dx >= 0 ? 1 : -1;
          } else if (p) {
            e.handX = p.x + e.dirX * (p.radius * e.handDist + e.thrust);
            e.handY = p.y + e.dirY * (p.radius * e.handDist + e.thrust * 0.35);
            e.rot = ang + (e.rotOffset || 0);
          }

          if (!e.hit && stabProg >= 0.45) {
            e.hit = true;
            if (t && t.hp > 0) {
              t.hp = Math.max(0, t.hp - e.damage);
              t.flash = 0.35;
              spawnBurst(t.x, t.y + (t.radius || 30) * 0.15, 18, [
                "#bc002d",
                "#ffffff",
                "#111",
                "#888",
              ]);
              console.log(
                `[CBEffects] Katana abdomen stab ${t.id} for ${e.damage} (hp=${t.hp})`
              );
            } else {
              const tip = weaponLocalToWorld(e, e.muzzleX, e.muzzleY);
              spawnBurst(tip.x, tip.y, 10, ["#bc002d", "#fff"]);
              console.log("[CBEffects] Katana charge stab (no target)");
            }
          }
        }
        e.x = e.handX;
        e.y = e.handY;
        if (e.wrath && Math.random() > 0.45) {
          wrathTrailAt(e.handX, e.handY);
        }
      }

      if (e.type === "vodkaBarrage") {
        const p = e.follow;
        const t = e.target;
        e.hitTimer -= dt;
        e.swing += dt * 18;
        if (t && t.hp > 0) {
          t.stunTimer = Math.max(t.stunTimer || 0, e.life);
        }
        if (p && t && t.hp > 0) {
          const dx = t.x - p.x;
          const dy = t.y - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          const nx = dx / dist;
          const ny = dy / dist;
          // Stay pressed on the foe
          const want = p.radius + (t.radius || 38) + 8;
          if (dist > want + 6) {
            p.x += nx * 320 * dt;
            p.y += ny * 280 * dt;
          }
          p.facing = nx >= 0 ? 1 : -1;
          const ang = Math.atan2(ny, nx);
          e.handX = p.x + nx * p.radius * e.handDist;
          e.handY = p.y + ny * p.radius * e.handDist;
          e.rot = ang - 0.9 + Math.sin(e.swing) * 1.1;
        } else if (p) {
          const a = updateDeagleHand(e);
          e.handX = a.cx + a.dx * ((p.radius || 42) * e.handDist);
          e.handY = a.cy + a.dy * ((p.radius || 42) * e.handDist);
          e.rot = a.ang - 0.9 + Math.sin(e.swing) * 1.1;
        }

        if (e.hitsLeft > 0 && e.hitTimer <= 0) {
          e.hitTimer = e.hitEvery;
          e.hitsLeft -= 1;
          if (t && t.hp > 0) {
            t.hp = Math.max(0, t.hp - e.damage);
            t.flash = 0.2;
            t.x += (p && p.facing >= 0 ? 1 : -1) * 4;
            spawnBurst(t.x, t.y, 8, ["#0039a6", "#fff", "#d52b1e"]);
            console.log(
              `[CBEffects] Vodka barrage hit ${t.id} for ${e.damage} (hp=${t.hp}) hitsLeft=${e.hitsLeft}`
            );
          } else if (p) {
            spawnBurst(e.handX, e.handY, 5, ["#0039a6", "#fff"]);
          }
          e.hit = e.hitsLeft <= 0;
        }
        e.x = e.handX;
        e.y = e.handY;
        if (e.wrath && Math.random() > 0.4) {
          wrathTrailAt(e.handX, e.handY);
        }
      }

      if (e.type === "drinkPose") {
        const a = updateDeagleHand(e);
        const bodyR = (e.follow && e.follow.radius) || 42;
        e.handX = a.cx - a.dy * bodyR * 0.35;
        e.handY = a.cy - bodyR * 0.55;
        const u = 1 - Math.max(0, e.life) / (e.maxLife || 0.55);
        e.rot = -0.4 - u * 1.35; // tip up
        e.x = e.handX;
        e.y = e.handY;
      }

      if (e.type === "plungeAttack") {
        const p = e.follow;
        if (p) {
          e.handX = p.x;
          e.handY = p.y + p.radius * (e.handDist || 0.45);
          // Rotate so local tip points straight down (works for deagle / katana / bottle)
          const lx = (e.muzzleX || 0) - (e.pivotX || 0);
          const ly = (e.muzzleY || 0) - (e.pivotY || 0);
          e.rot = Math.PI / 2 - Math.atan2(ly, lx);
          if (Math.random() > 0.42) {
            spawnTrail(p.x, p.y - p.radius * 0.2, {
              life: 0.2,
              size: p.radius * 0.75,
              color: e.trailColor || "rgba(255,255,255,0.35)",
            });
          }
          if (Math.random() > 0.55) {
            spawnParticle(p.x + (Math.random() - 0.5) * p.radius, p.y, {
              vx: (Math.random() - 0.5) * 60,
              vy: 120 + Math.random() * 80,
              life: 0.18,
              size: 2 + Math.random() * 2,
              color: e.sparkColor || "#ffffff",
            });
          }
        }
        e.x = e.handX;
        e.y = e.handY;
      }

      if (e.type === "japanUlt") {
        e.phaseLife -= dt;
        const p = e.player;
        const foe = e.foe;

        if (e.phase === "flashIn") {
          if (cinema) {
            cinema.white = Math.min(1, 1 - e.phaseLife / 0.22);
            cinema.silhouette = false;
            cinema.floorBlack = false;
          }
          if (e.phaseLife <= 0) {
            e.phase = "dash";
            e.phaseLife = 0.28;
            if (cinema) {
              cinema.white = 1;
              cinema.silhouette = true;
              cinema.floorBlack = true;
            }
            if (p) {
              e.dashFromX = p.x;
              e.dashFromY = p.y;
              const fx = foe && foe.hp > 0 ? foe.x : p.x + p.facing * 200;
              const fy = foe && foe.hp > 0 ? foe.y : p.y;
              const dx = fx - p.x;
              const dy = fy - p.y;
              const len = Math.hypot(dx, dy) || 1;
              const nx = dx / len;
              const ny = dy / len;
              // Land past the enemy
              e.dashToX = fx + nx * 95;
              e.dashToY = fy + ny * 20;
              e.dashToX = Math.max(
                p.radius + 20,
                Math.min(e.arenaW - p.radius - 20, e.dashToX)
              );
              // Lightning bolt trail
              for (let i = 0; i < 16; i++) {
                const u = i / 15;
                spawnParticle(
                  e.dashFromX + (e.dashToX - e.dashFromX) * u +
                    (Math.random() - 0.5) * 18,
                  e.dashFromY + (e.dashToY - e.dashFromY) * u +
                    (Math.random() - 0.5) * 18,
                  {
                    vx: (Math.random() - 0.5) * 80,
                    vy: (Math.random() - 0.5) * 80,
                    life: 0.25,
                    size: 2 + Math.random() * 3,
                    color: i % 2 ? "#111" : "#fff",
                  }
                );
              }
            }
            console.log("[CBEffects] Japan ult dash");
          }
        } else if (e.phase === "dash") {
          if (cinema) {
            cinema.white = 1;
            cinema.silhouette = true;
            cinema.floorBlack = true;
          }
          const prog = 1 - Math.max(0, e.phaseLife) / 0.28;
          const ease = prog * prog;
          if (p) {
            p.x = e.dashFromX + (e.dashToX - e.dashFromX) * ease;
            p.y = e.dashFromY + (e.dashToY - e.dashFromY) * ease;
            if (foe) p.facing = foe.x >= p.x ? 1 : -1;
            e.handX = p.x + (p.facing >= 0 ? 1 : -1) * p.radius * 0.55;
            e.handY = p.y;
            e.rot = (p.facing >= 0 ? 0 : Math.PI) + (e.rotOffset || 0);
            spawnTrail(p.x, p.y, {
              life: 0.18,
              size: p.radius,
              color: "rgba(0,0,0,0.55)",
            });
          }
          if (e.phaseLife <= 0) {
            e.phase = "stab";
            e.phaseLife = 0.45;
            e.thrust = 0;
            console.log("[CBEffects] Japan ult stab");
          }
        } else if (e.phase === "stab") {
          if (cinema) {
            cinema.white = 1;
            cinema.silhouette = true;
            cinema.floorBlack = true;
          }
          const stabProg = 1 - Math.max(0, e.phaseLife) / 0.45;
          e.thrust = Math.sin(Math.min(1, stabProg) * Math.PI) * 36;
          if (p) {
            let aimAng = p.facing >= 0 ? 0 : Math.PI;
            if (foe && foe.hp > 0) {
              aimAng = Math.atan2(
                foe.y + (foe.radius || 30) * 0.12 - p.y,
                foe.x - p.x
              );
              p.facing = foe.x >= p.x ? 1 : -1;
            }
            const dx = Math.cos(aimAng);
            const dy = Math.sin(aimAng);
            e.handX = p.x + dx * (p.radius * 0.5 + e.thrust);
            e.handY = p.y + dy * (p.radius * 0.5 + e.thrust * 0.4);
            e.rot = aimAng + (e.rotOffset || 0);
          }
          if (!e.stabbed && stabProg >= 0.4) {
            e.stabbed = true;
            e.hit = true;
            if (foe && foe.hp > 0) {
              foe.hp = Math.max(0, foe.hp - e.damage);
              foe.flash = 0.5;
              spawnBurst(foe.x, foe.y, 28, ["#000", "#fff", "#bc002d", "#444"]);
              console.log(
                `[CBEffects] Japan cinema stab ${foe.id} for ${e.damage} (hp=${foe.hp})`
              );
            }
          }
          if (e.phaseLife <= 0) {
            e.phase = "hold";
            e.phaseLife = 0.85;
          }
        } else if (e.phase === "hold") {
          if (cinema) {
            cinema.white = 1;
            cinema.silhouette = true;
            cinema.floorBlack = true;
          }
          if (e.phaseLife <= 0) {
            e.phase = "fade";
            e.phaseLife = 0.35;
          }
        } else if (e.phase === "fade") {
          const fade = Math.max(0, e.phaseLife) / 0.35;
          if (cinema) {
            cinema.white = fade;
            cinema.silhouette = fade > 0.15;
            cinema.floorBlack = fade > 0.15;
          }
          if (e.phaseLife <= 0 && cinema) {
            cinema = null;
            console.log("[CBEffects] Japan cinema ult end");
          }
        }
        e.x = e.handX;
        e.y = e.handY;
      }

      if (e.type === "deagleSpin") {
        const a = updateDeagleHand(e);
        e.x = e.handX;
        e.y = e.handY;

        if (e.phase === "spin") {
          e.rot += e.spin * dt;
          if (e.wrath && Math.random() > 0.4) {
            wrathTrailAt(e.handX, e.handY);
          }
          if (e.life <= 0) {
            // Snap to aim and shoot; keep gun for hold pose
            e.phase = "hold";
            e.life = e.holdLife;
            e.maxLife = e.holdLife;
            e.rot = a.ang;
            fireDeagleBullet(e);
          }
        } else if (e.phase === "hold") {
          // Recoil settles back toward aim
          e.recoil = Math.max(0, e.recoil - dt * 1.6);
          e.rot = a.ang - e.recoil;
        }
      }

      if (e.type === "eagleFly") {
        e.bob += dt * 5;
        e.x += e.vx * dt;
        e.y += e.vy * dt + Math.sin(e.bob) * (e.bobAmp || 28) * dt;
        e.dropTimer -= dt;
        if (e.dropsLeft > 0 && e.dropTimer <= 0) {
          e.dropTimer = e.dropEvery;
          e.dropsLeft -= 1;
          // Spread drops across map width/depth, not just under the bird
          const spreadX = e.mapSpread ? (Math.random() - 0.5) * 120 : (Math.random() - 0.5) * 24;
          const spreadFall = e.mapSpread ? 40 + Math.random() * 200 : 0;
          const dropX = e.x + spreadX;
          const dropY = e.y + e.h * 0.2;
          spawnStar(dropX, dropY, {
            vx: (Math.random() - 0.5) * (e.mapSpread ? 90 : 40) + e.vx * 0.05,
            vy: 140 + Math.random() * 100 + spreadFall * 0.15,
            life: e.mapSpread ? 2.2 : 1.6,
            size: e.starSize + Math.random() * 5,
            damage: e.starDamage,
            ownerId: e.ownerId,
            finisher: !!e.finisher,
          });
          // Extra companion stars for full-map ult coverage
          if (e.mapSpread && Math.random() > 0.35) {
            spawnStar(dropX + (Math.random() - 0.5) * 180, dropY - 10, {
              vx: (Math.random() - 0.5) * 70,
              vy: 120 + Math.random() * 140,
              life: 2.0,
              size: e.starSize * 0.85,
              damage: Math.max(6, e.starDamage - 2),
              ownerId: e.ownerId,
              finisher: !!e.finisher,
            });
          }
          spawnParticle(dropX, dropY, {
            vx: (Math.random() - 0.5) * 30,
            vy: 40,
            life: 0.3,
            size: 3,
            color: "#f7d354",
          });
        }
      }

      if (e.type === "acidRain") {
        e.tickLeft = (e.tickLeft || 0) - dt;
        if (!e.drops) e.drops = [];
        for (let n = 0; n < 5; n++) {
          if (e.drops.length >= 56) break;
          e.drops.push({
            x: e.x + (Math.random() - 0.5) * e.rx * 1.9,
            y: e.y - e.ry - 8 - Math.random() * 70,
            vx: (Math.random() - 0.5) * 22,
            vy: 320 + Math.random() * 220,
            len: 10 + Math.random() * 16,
          });
        }
        for (let i = e.drops.length - 1; i >= 0; i--) {
          const d = e.drops[i];
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          if (d.y > e.y + e.ry * 0.55) e.drops.splice(i, 1);
        }
        if (Math.random() > 0.45) {
          const px = e.x + (Math.random() - 0.5) * e.rx * 1.6;
          spawnParticle(px, e.y + e.ry * 0.35, {
            vx: (Math.random() - 0.5) * 24,
            vy: -20 - Math.random() * 30,
            life: 0.28,
            size: 2 + Math.random() * 2,
            color: Math.random() > 0.5 ? "#b8ff3a" : "#7ad318",
            gravity: 40,
          });
        }
        if (e.tickLeft <= 0) {
          e.tickLeft = e.tick || 0.38;
          for (const t of targets) {
            if (t.id === e.ownerId || t.id === "uk" || t.hp <= 0) continue;
            if (t.ownerId && t.ownerId === e.ownerId) continue;
            if (t.invuln) continue;
            const dx = (t.x - e.x) / (e.rx || 155);
            const dy = (t.y - e.y) / (e.ry || 110);
            if (dx * dx + dy * dy > 1) continue;
            t.hp = Math.max(0, t.hp - (e.damage || 7));
            t.flash = 0.16;
            spawnParticle(t.x, t.y - 8, {
              vx: (Math.random() - 0.5) * 30,
              vy: -40,
              life: 0.22,
              size: 3,
              color: "#b8ff3a",
            });
            console.log(
              "[CBEffects] acid rain tick " + t.id + " hp=" + t.hp
            );
          }
        }
      }

      if (e.type === "warship") {
        e.x += e.vx * dt;
        const visHalf = (e.w || 2240) * 0.5;
        if (
          window.CBCamera &&
          CBCamera.addShake &&
          e.x + visHalf > 0 &&
          e.x - visHalf < 960
        ) {
          CBCamera.addShake(0.72);
        }
        const halfW = (e.w || 2240) * 0.42;
        const left = e.x - halfW;
        const right = e.x + halfW;
        const top = e.groundY - (e.hitH || 92);
        const bot = e.groundY + 18;
        if (!e.hitIds) e.hitIds = {};
        for (const t of targets) {
          if (t.id === e.ownerId || t.hp <= 0) continue;
          if (t.ownerId && t.ownerId === e.ownerId) continue;
          if (t.invuln) continue;
          if (e.hitIds[t.id]) continue;
          const tx = t.x;
          const ty = t.y;
          if (tx < left || tx > right) continue;
          if (ty + (t.radius || 30) < top) continue;
          if (ty - (t.radius || 30) > bot) continue;
          e.hitIds[t.id] = true;
          t.hp = Math.max(0, t.hp - (e.damage || 80));
          t.flash = 0.4;
          t.x += (e.vx >= 0 ? 1 : -1) * 48;
          spawnBurst(t.x, t.y, 18, ["#c8102e", "#012169", "#ffffff", "#888"]);
          spawnShockwave(t.x, e.groundY, {
            color: "rgba(1,33,105,0.55)",
            maxRadius: 90,
            life: 0.3,
          });
          if (window.CBCamera && CBCamera.addShake) CBCamera.addShake(0.95);
          console.log(
            "[CBEffects] warship hit " + t.id + " for " + e.damage + " (hp=" + t.hp + ")"
          );
        }
      }

      if (e.type === "finisherCross") {
        /* drawn only; onDone fires on expire */
      }

      if (e.type === "baguetteMissile") {
        if (e.phase === "wait") {
          e.wait -= dt;
          if (e.wait <= 0) e.phase = "dive";
        } else if (e.phase === "dive") {
          const tx = e.impactX - e.x;
          const ty = e.groundY - 8 - e.y;
          const desired = Math.atan2(ty, tx);
          const speed = Math.max(320, Math.hypot(e.vx, e.vy) + 900 * dt);
          let cur = Math.atan2(e.vy, e.vx);
          let diff = desired - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const maxTurn = 8 * dt;
          if (diff > maxTurn) diff = maxTurn;
          if (diff < -maxTurn) diff = -maxTurn;
          cur += diff;
          e.vx = Math.cos(cur) * speed;
          e.vy = Math.sin(cur) * speed;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.rot = cur;
          if (e.y >= e.groundY - 6) {
            e.x = e.impactX + (Math.random() - 0.5) * 10;
            e.y = e.groundY + 4;
            e.vx = 0;
            e.vy = 0;
            e.phase = "stuck";
            e.rot = 1.05 + (Math.random() - 0.5) * 0.5;
            e.bury = 0;
            spawnShockwave(e.x, e.groundY, {
              color: "rgba(120, 72, 32, 0.7)",
              maxRadius: 70,
              life: 0.28,
            });
            spawnBurst(e.x, e.groundY, 10, ["#6b3f1f", "#c4a574", "#3d2412"]);
            console.log(
              "[CBEffects] baguette planted x=" +
                Math.round(e.x) +
                " fuse=" +
                e.fuseLeft.toFixed(2)
            );
          }
        } else if (e.phase === "stuck") {
          e.bury = Math.min(1, (e.bury || 0) + dt * 2.8);
          e.y = e.groundY + 6 + e.bury * 22;
          e.fuseLeft -= dt;
          const tick = e.fuseLeft < 0.35 ? 28 : 10;
          e.shake = Math.sin((e.fuse || 1) * 40 + e.fuseLeft * tick) * (e.fuseLeft < 0.3 ? 5 : 1.5);
          if (Math.random() > 0.7) {
            spawnParticle(e.x + (Math.random() - 0.5) * 12, e.groundY - 4, {
              vx: (Math.random() - 0.5) * 20,
              vy: -20 - Math.random() * 30,
              life: 0.2,
              size: 2,
              color: "#c4a574",
              gravity: 80,
            });
          }
          if (e.fuseLeft <= 0) {
            e.phase = "boom";
            e.hit = true;
            const boomX = e.x;
            const boomY = e.groundY - 8;
            if (typeof spawnExplosion === "function") {
              spawnExplosion(boomX, boomY, {
                power: 1.15,
                colors: ["#ed2939", "#6b0f1a", "#c4a574", "#ffffff", "#002395"],
              });
            } else {
              spawnBurst(boomX, boomY, 22, ["#ed2939", "#ffffff", "#6b3f1f"]);
            }
            spawnShockwave(boomX, boomY, {
              color: "rgba(237,41,57,0.7)",
              maxRadius: 120,
              life: 0.38,
            });
            for (const t of targets) {
              if (t.id === e.ownerId || t.hp <= 0) continue;
              if (t.ownerId && t.ownerId === e.ownerId) continue;
              if (t.invuln) continue;
              const dx = t.x - boomX;
              const dy = t.y - boomY;
              const rr = (e.radius || 62) + (t.radius || 30);
              if (dx * dx + dy * dy <= rr * rr) {
                t.hp = Math.max(0, t.hp - (e.damage || 0));
                t.flash = 0.28;
                console.log(
                  "[CBEffects] baguette fuse hit " +
                    t.id +
                    " for " +
                    e.damage +
                    " (hp=" +
                    t.hp +
                    ")"
                );
              }
            }
            e.life = 0;
          }
        }
      }

      if (
        e.type === "particle" ||
        e.type === "projectile" ||
        e.type === "star" ||
        e.type === "spriteProjectile"
      ) {
        if (e.type === "spriteProjectile") steerHoming(e, dt);
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.gravity) e.vy += e.gravity * dt;
      }

      if (e.type === "star") e.rot += e.spin * dt;
      if (e.type === "spriteProjectile" && e.spin) e.rot += e.spin * dt;

      if (
        (e.type === "projectile" ||
          e.type === "star" ||
          e.type === "spriteProjectile") &&
        !e.hit
      ) {
        const r = e.type === "star" ? e.size : e.radius;
        for (const t of targets) {
          if (t.id === e.ownerId || t.hp <= 0) continue;
          if (t.ownerId && t.ownerId === e.ownerId) continue;
          if (t.invuln) continue;
          const dx = e.x - t.x;
          const dy = e.y - t.y;
          const rr = r + (t.radius || 30);
          if (dx * dx + dy * dy <= rr * rr) {
            e.hit = true;
            e.life = Math.min(e.life, 0.05);
            t.hp = Math.max(0, t.hp - (e.damage || 0));
            t.flash = 0.2;
            spawnBurst(e.x, e.y, 12);
            console.log(
              `[CBEffects] hit ${t.id} for ${e.damage} (hp=${t.hp})`
            );
            break;
          }
        }
      }

      if (e.life <= 0) {
        if (e.type === "finisherCross" && !e.done) {
          e.done = true;
          if (typeof e.onDone === "function") {
            try {
              e.onDone(e);
            } catch (err) {
              console.warn("[CBEffects] finisherCross onDone", err);
            }
          }
        }
        if (e.type === "japanUlt" && cinema) {
          cinema = null;
          console.log("[CBEffects] Japan cinema cleared on expire");
        }
        list.splice(i, 1);
      }
    }
  }

  function drawStarPath(ctx, x, y, spikes, outer, inner) {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(x, y - outer);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(x + Math.cos(rot) * outer, y + Math.sin(rot) * outer);
      rot += step;
      ctx.lineTo(x + Math.cos(rot) * inner, y + Math.sin(rot) * inner);
      rot += step;
    }
    ctx.closePath();
  }

  function draw(ctx) {
    for (const e of list) {
      const alpha = Math.max(0, Math.min(1, e.life / (e.maxLife || 1)));

      if (e.type === "particle") {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === "trail") {
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === "projectile") {
        ctx.globalAlpha = alpha;
        const bands = e.colors;
        for (let b = 0; b < bands.length; b++) {
          ctx.fillStyle = bands[b];
          ctx.beginPath();
          ctx.arc(e.x - b * 6, e.y, e.radius - b * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // Glow core
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === "star") {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(e.x, e.y);
        ctx.rotate(e.rot);
        ctx.fillStyle = "#f7d354";
        ctx.strokeStyle = "#3c3b6e";
        ctx.lineWidth = 2;
        drawStarPath(ctx, 0, 0, 5, e.size, e.size * 0.45);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (e.type === "deagleSpin" || e.type === "deagleBash") {
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.translate(e.handX, e.handY);
        ctx.rotate(e.rot);
        if (e.img && e.img.complete && e.img.naturalWidth) {
          ctx.drawImage(e.img, -e.pivotX, -e.pivotY, e.w, e.h);
        } else {
          ctx.fillStyle = "#aaa";
          ctx.fillRect(-e.pivotX, -e.pivotY, e.w, e.h);
        }
        ctx.restore();
      } else if (e.type === "vodkaBarrage" || e.type === "drinkPose" || e.type === "plungeAttack") {
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.translate(e.handX, e.handY);
        ctx.rotate(e.rot);
        if (e.img && e.img.complete && e.img.naturalWidth) {
          ctx.drawImage(e.img, -e.pivotX, -e.pivotY, e.w, e.h);
        } else {
          ctx.fillStyle = "#9ec9f0";
          ctx.fillRect(-e.pivotX, -e.pivotY, e.w, e.h);
        }
        ctx.restore();
      } else if (
        e.type === "katanaStrike" ||
        e.type === "katanaCharge" ||
        e.type === "japanUlt"
      ) {
        if (e.type === "japanUlt" && e.phase === "flashIn") {
          /* katana appears after flash */
        } else {
          drawWeaponSprite(ctx, e);
        }
      } else if (e.type === "eagleFly") {
        ctx.save();
        ctx.globalAlpha = Math.min(1, e.life / 0.25);
        ctx.translate(e.x, e.y);
        if (e.facing < 0) ctx.scale(-1, 1);
        if (e.img && e.img.complete && e.img.naturalWidth) {
          ctx.drawImage(e.img, -e.w / 2, -e.h / 2, e.w, e.h);
        } else {
          ctx.fillStyle = "#8b6914";
          ctx.beginPath();
          ctx.ellipse(0, 0, e.w * 0.4, e.h * 0.25, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (e.type === "acidRain") {
        const fade = Math.min(1, e.life / 0.5);
        ctx.save();
        ctx.globalAlpha = 0.22 * fade;
        ctx.fillStyle = "rgba(140, 220, 40, 0.5)";
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.75 * fade;
        ctx.strokeStyle = "#c6ff4a";
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        const drops = e.drops || [];
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + d.vx * 0.03, d.y + (d.len || 12));
          ctx.stroke();
        }
        ctx.restore();
      } else if (e.type === "warship") {
        ctx.save();
        ctx.globalAlpha = 0.32 * Math.min(1, e.life / 0.35);
        ctx.fillStyle = "rgba(170, 205, 230, 0.85)";
        ctx.beginPath();
        ctx.ellipse(e.x, e.groundY + 8, (e.w || 560) * 0.4, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = Math.min(1, e.life / 0.35);
        ctx.translate(e.x, e.y);
        if (e.facing < 0) ctx.scale(-1, 1);
        if (e.img && e.img.complete && e.img.naturalWidth) {
          ctx.drawImage(e.img, -e.w / 2, -e.h / 2, e.w, e.h);
        } else {
          ctx.fillStyle = "#555";
          ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
        }
        ctx.restore();
      } else if (e.type === "spriteProjectile" || e.type === "baguetteMissile") {
        ctx.save();
        ctx.globalAlpha = alpha;
        const ox = e.type === "baguetteMissile" ? e.shake || 0 : 0;
        ctx.translate(e.x + ox, e.y);
        ctx.rotate(e.rot);
        if (e.img && e.img.complete && e.img.naturalWidth) {
          ctx.drawImage(e.img, -e.w / 2, -e.h / 2, e.w, e.h);
        } else {
          ctx.fillStyle = "#c4a574";
          ctx.fillRect(-e.w / 2, -e.h / 2, e.w, e.h);
        }
        ctx.restore();
        if (e.type === "baguetteMissile" && e.phase === "stuck") {
          ctx.save();
          ctx.globalAlpha = 0.55 * alpha;
          ctx.fillStyle = "#5a3a1c";
          ctx.beginPath();
          ctx.ellipse(e.x, e.groundY + 2, 18 + e.bury * 10, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (e.type === "wrathBolt") {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = e.color || "#ff1a1a";
        ctx.lineWidth = e.width || 2.5;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowColor = "#ff1a1a";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        const segs = e.segments || [];
        if (segs.length) {
          ctx.moveTo(segs[0].x, segs[0].y);
          for (let i = 1; i < segs.length; i++) {
            ctx.lineTo(segs[i].x, segs[i].y);
          }
        }
        ctx.stroke();
        ctx.restore();
      } else if (e.type === "finisherCross") {
        const prog = 1 - Math.max(0, e.life) / (e.maxLife || 0.38);
        const len = (e.radius || 48) * (0.6 + prog * 1.4);
        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha * 1.2);
        ctx.lineCap = "round";
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 12;
        (e.angles || []).forEach(function (ang, i) {
          ctx.strokeStyle = (e.colors && e.colors[i % e.colors.length]) || "#ff1a1a";
          ctx.lineWidth = 3 + i;
          ctx.beginPath();
          ctx.moveTo(e.x - Math.cos(ang) * len, e.y - Math.sin(ang) * len);
          ctx.lineTo(e.x + Math.cos(ang) * len, e.y + Math.sin(ang) * len);
          ctx.stroke();
        });
        ctx.restore();
      } else if (e.type === "winePuddle") {
        const fade = Math.min(1, e.life / 0.6);
        const born = 1 - Math.max(0, e.life) / (e.maxLife || 5);
        const grow = Math.min(1, born * 4);
        ctx.save();
        ctx.globalAlpha = 0.72 * fade;
        ctx.translate(e.x, e.y);
        ctx.scale(grow, grow);
        ctx.fillStyle = "rgba(90, 12, 24, 0.82)";
        ctx.beginPath();
        ctx.ellipse(0, 0, e.rx, e.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(140, 20, 40, 0.7)";
        ctx.beginPath();
        ctx.ellipse(-e.rx * 0.15, -e.ry * 0.12, e.rx * 0.62, e.ry * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(40, 6, 12, 0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, e.rx, e.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (e.type === "shockwave") {
        const prog = 1 - Math.max(0, e.life) / (e.maxLife || 0.42);
        const rr = e.radius + (e.maxRadius - e.radius) * prog;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha * (1 - prog * 0.85));
        ctx.strokeStyle = e.color || "rgba(255,255,255,0.75)";
        ctx.lineWidth = e.width || 3.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  return {
    add,
    clear,
    spawnParticle,
    spawnProjectile,
    spawnTrail,
    spawnStar,
    spawnBurst,
    spawnExplosion,
    spawnImplosion,
    spawnStarBurst,
    spawnShockwave,
    spawnWineSpill,
    wineSlowAt,
    spawnAcidRain,
    inAcidRain,
    spawnWarship,
    spawnWrathLightning,
    spawnFinisherCross,
    spawnDeagleSpin,
    spawnDeagleBash,
    spawnKatanaStrike,
    spawnKatanaCharge,
    spawnVodkaBarrage,
    spawnDrinkPose,
    spawnPlungeAttack,
    spawnJapanCinemaUlt,
    spawnEagleFlyby,
    spawnSpriteProjectile,
    spawnBaguetteMissile,
    getCinema,
    getFinishers,
    getPrimaryFinisher,
    update,
    draw,
    WRATH_RED,
    get list() {
      return list;
    },
  };
})();
