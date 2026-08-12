/**
 * USA abilities — mouse-aimed attacks + special/ultimate.
 * LMB tap = Deagle melee bash, hold-release = Charged Blast,
 * E = Cash toss, Q = Eagle flyby + stars (needs ult charge).
 * When foeHp is passed and attack damage will KO, effects are marked finisher.
 */
window.CBUsaAbilities = (function () {
  const COLORS = ["#b22234", "#ffffff", "#3c3b6e"];
  let deagleImg = null;
  let eagleImg = null;
  let moneyImg = null;

  function ensureDeagleLoaded() {
    if (deagleImg) return;
    deagleImg = new Image();
    deagleImg.onload = function () {
      console.log("[USA] Deagle asset loaded");
    };
    deagleImg.onerror = function () {
      console.error("[USA] Failed to load assets/deagle.png");
    };
    deagleImg.src = "assets/deagle.png";
  }

  /** Player-equipped skin if any, else starter deagle. */
  function deagleFor(player) {
    ensureDeagleLoaded();
    const ballId = (player && player.id) || "usa";
    if (window.CBCosmetics && CBCosmetics.getEquippedWeaponImage) {
      const skin = CBCosmetics.getEquippedWeaponImage(ballId);
      if (skin) return skin;
    }
    return deagleImg;
  }

  function wrathOn(player) {
    return !!(
      window.CBCountryballs &&
      CBCountryballs.hasWrath &&
      CBCountryballs.hasWrath((player && player.id) || "usa")
    );
  }

  function auraId(player) {
    if (!window.CBCountryballs || !CBCountryballs.getEffectId) return null;
    return CBCountryballs.getEffectId((player && player.id) || "usa");
  }

  function auraPalette(player, fallback) {
    const id = auraId(player);
    if (!id || id === "none" || !window.CBCosmetics || !CBCosmetics.getEffect) {
      return fallback.slice();
    }
    const fx = CBCosmetics.getEffect(id);
    if (!fx || !Array.isArray(fx.colors) || !fx.colors.length) return fallback.slice();
    return fx.colors.slice();
  }

  function ensureEagleLoaded() {
    if (eagleImg) return;
    eagleImg = new Image();
    eagleImg.onload = function () {
      console.log("[USA] Eagle asset loaded");
    };
    eagleImg.onerror = function () {
      console.error("[USA] Failed to load assets/eagle.png");
    };
    eagleImg.src = "assets/eagle.png";
  }

  function ensureMoneyLoaded() {
    if (moneyImg) return;
    moneyImg = new Image();
    moneyImg.onload = function () {
      console.log("[USA] Money asset loaded");
    };
    moneyImg.onerror = function () {
      console.error("[USA] Failed to load assets/money.png");
    };
    moneyImg.src = "assets/money.png";
  }
  ensureDeagleLoaded();
  ensureEagleLoaded();
  ensureMoneyLoaded();

  const defs = {
    freedomBlast: {
      id: "freedomBlast",
      name: "Deagle Bash",
      cooldown: 0.35,
      damage: 16,
    },
    chargedBlast: {
      id: "chargedBlast",
      name: "Deagle Spin",
      cooldown: 0.9,
      damageMin: 22,
      damageMax: 48,
    },
    eagleStrike: {
      id: "eagleStrike",
      name: "Cash Toss",
      key: "KeyE",
      cooldown: 2.4,
      stacks: 5,
      damage: 11,
    },
    starsBarrage: {
      id: "starsBarrage",
      name: "Eagle Star Drop",
      key: "KeyQ",
      cooldown: 1.0,
      ultCost: 100,
      starDamage: 10,
      drops: 24,
    },
  };

  function aimVec(player) {
    const ax = player.aimX;
    const ay = player.aimY;
    if (typeof ax === "number" && typeof ay === "number") {
      let dx = ax - player.x;
      let dy = ay - player.y;
      const len = Math.hypot(dx, dy);
      if (len > 4) return { x: dx / len, y: dy / len };
    }
    const fx = player.facing >= 0 ? 1 : -1;
    return { x: fx, y: 0 };
  }

  function willKo(damage, foeHp) {
    // Only if THIS hit alone is enough to KO (no multi-hit totals — those false-triggered)
    return typeof foeHp === "number" && foeHp > 0 && damage >= foeHp;
  }

  function castFreedomBlast(player, opts) {
    const options = opts || {};
    const dmg = defs.freedomBlast.damage;
    const finisher = willKo(dmg, options.foeHp);
    const a = aimVec(player);
    const burstCols = auraPalette(player, ["#ffffff", "#f7d354", "#b22234"]);
    window.CBEffects.spawnDeagleBash({
      follow: player,
      img: deagleFor(player),
      w: 68,
      h: 37,
      aimX: player.aimX,
      aimY: player.aimY,
      damage: dmg,
      hitRadius: 38,
      reach: player.radius + 70,
      knockback: 160,
      ownerId: player.id,
      handDist: 0.52,
      life: 0.26,
      swingFrom: -1.4,
      swingTo: 0.35,
      finisher,
      wrath: wrathOn(player),
    });
    window.CBEffects.spawnParticle(
      player.x + a.x * player.radius,
      player.y + a.y * player.radius,
      {
        vx: a.x * 60,
        vy: a.y * 60,
        life: 0.15,
        size: 4,
        color: burstCols[0] || "#ffffff",
      }
    );
    console.log("[USA] Deagle Bash" + (finisher ? " FINISHER" : ""));
    return { ok: true, finisher };
  }

  function castChargedBlast(player, charge, opts) {
    const options = opts || {};
    const t = Math.max(0, Math.min(1, charge));
    const dmg =
      defs.chargedBlast.damageMin +
      (defs.chargedBlast.damageMax - defs.chargedBlast.damageMin) * t;
    const roundDmg = Math.round(dmg);
    const finisher = willKo(roundDmg, options.foeHp);
    const spinLife = 0.45 + t * 0.12;
    const spinRate = (3 * Math.PI * 2) / spinLife;
    const speed = 720 + 260 * t;
    const aura = auraId(player);
    const wrath = aura === "wrath_of_the_gods";
    const cols = auraPalette(player, COLORS);
    window.CBEffects.spawnDeagleSpin({
      follow: player,
      spin: spinRate,
      spinLife,
      holdLife: 0.3,
      img: deagleFor(player),
      w: 68,
      h: 37,
      aimX: player.aimX,
      aimY: player.aimY,
      damage: roundDmg,
      speed,
      bulletRadius: 6 + Math.floor(t * 4),
      ownerId: player.id,
      charge: t,
      handDist: 0.55,
      finisher,
      wrath: wrath,
      bulletColors: cols,
    });
    console.log(
      "[USA] Deagle spin dmg~" + roundDmg + (finisher ? " FINISHER" : "")
    );
    return { ok: true, charge: t, finisher };
  }

  function castEagleStrike(player, opts) {
    const options = opts || {};
    const a = aimVec(player);
    const baseAng = Math.atan2(a.y, a.x);
    const count = defs.eagleStrike.stacks;
    // One cash stack must be enough — don't use ×5 total (that false-triggered)
    const finisher = willKo(defs.eagleStrike.damage, options.foeHp);
    const muzzleX = player.x + a.x * (player.radius + 6);
    const muzzleY = player.y + a.y * (player.radius + 6);

    window.CBEffects.spawnBurst(muzzleX, muzzleY, 10, auraPalette(player, [
      "#2e7d32",
      "#f7d354",
      "#ffffff",
    ]));

    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.2;
      const ang = baseAng + spread;
      const speed = 360 + Math.abs(i - 2) * 25 + Math.random() * 30;
      window.CBEffects.spawnSpriteProjectile(muzzleX, muzzleY, {
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 40,
        life: 1.6,
        radius: 24,
        damage: defs.eagleStrike.damage,
        ownerId: player.id,
        img: moneyImg,
        w: 54,
        h: 54,
        rot: ang + Math.random() * 0.4,
        spin: 5 + Math.random() * 4,
        gravity: 320,
        finisher,
      });
    }
    console.log("[USA] Cash Toss ×5" + (finisher ? " FINISHER" : ""));
    return { ok: true, finisher };
  }

  function castStarsBarrage(player, opts) {
    const options = opts || {};
    const mapW = 960;
    const speed = 300;
    const startX = -160;
    const endX = mapW + 160;
    const life = (endX - startX) / speed;
    const drops = defs.starsBarrage.drops;
    const dropEvery = life / (drops + 1);
    // One star must KO — don't use drops×damage (that made every ult a "finisher")
    const finisher = willKo(defs.starsBarrage.starDamage, options.foeHp);
    const cols = auraPalette(player, ["#f7d354", "#ffffff", "#3c3b6e"]);

    window.CBEffects.spawnEagleFlyby({
      x: startX,
      y: 85,
      vx: speed,
      vy: 18,
      life,
      img: eagleImg,
      w: 130,
      h: 130,
      facing: 1,
      dropEvery,
      dropsLeft: drops,
      starDamage: defs.starsBarrage.starDamage,
      starSize: 12,
      ownerId: player.id,
      mapSpread: true,
      bobAmp: 55,
      finisher,
    });

    for (let i = 0; i < 12; i++) {
      window.CBEffects.spawnParticle((mapW / 12) * i + 20, 40 + Math.random() * 40, {
        vx: (Math.random() - 0.5) * 40,
        vy: 60 + Math.random() * 40,
        life: 0.6,
        size: 3,
        color: cols[i % cols.length],
      });
    }
    console.log("[USA] Ultimate eagle" + (finisher ? " FINISHER" : ""));
    return { ok: true, finisher };
  }

  function tryCast(abilityId, player, cooldowns, opts) {
    const def = defs[abilityId];
    if (!def) return { ok: false, reason: "unknown" };
    const options = opts || {};

    const cd = cooldowns[abilityId] || 0;
    if (cd > 0) {
      console.log(`[USA] ${def.name} on cooldown (${cd.toFixed(2)}s)`);
      return { ok: false, reason: "cooldown" };
    }

    if (abilityId === "starsBarrage") {
      const ult = options.ultCharge || 0;
      if (ult < def.ultCost) {
        console.log(`[USA] Ultimate not charged (${ult.toFixed(0)}/${def.ultCost})`);
        return { ok: false, reason: "ult_charge" };
      }
    }

    let result;
    if (abilityId === "freedomBlast") result = castFreedomBlast(player, options);
    else if (abilityId === "chargedBlast") {
      result = castChargedBlast(player, options.charge || 0, options);
    } else if (abilityId === "eagleStrike") result = castEagleStrike(player, options);
    else if (abilityId === "starsBarrage") result = castStarsBarrage(player, options);
    else return { ok: false, reason: "unknown" };

    if (result.ok) {
      cooldowns[abilityId] = def.cooldown;
      if (abilityId === "freedomBlast") {
        cooldowns.chargedBlast = Math.max(cooldowns.chargedBlast || 0, 0.35);
      }
      if (abilityId === "chargedBlast") {
        cooldowns.freedomBlast = Math.max(cooldowns.freedomBlast || 0, 0.35);
      }
    }
    return result;
  }

  function tickEagleTrail(player) {
    if (Math.random() > 0.45) return;
    const cols = auraPalette(player, COLORS);
    window.CBEffects.spawnTrail(player.x, player.y, {
      life: 0.3,
      size: player.radius * 0.9,
      color: Math.random() > 0.5 ? cols[0] : cols[2] || cols[0],
    });
    window.CBEffects.spawnParticle(player.x, player.y, {
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
      life: 0.25,
      size: 3,
      color: cols[1] || "#ffffff",
    });
  }

  function tickChargeHold(player, charge01) {
    const t = Math.max(0, Math.min(1, charge01));
    if (Math.random() > 0.5) return;
    const cols = auraPalette(player, COLORS);
    const a = aimVec(player);
    window.CBEffects.spawnParticle(
      player.x + a.x * player.radius * 0.6,
      player.y + a.y * player.radius * 0.6,
      {
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 50 - 30,
        life: 0.25,
        size: 2 + t * 3,
        color: t > 0.7 ? cols[0] : cols[Math.floor(Math.random() * cols.length)],
      }
    );
  }

  function getMeleeWeapon(player) {
    return {
      img: deagleFor(player),
      w: 68,
      h: 37,
      pivotX: 68 * 0.34,
      pivotY: 37 * 0.58,
      muzzleLocalX: 68 * 0.94,
      muzzleLocalY: 37 * 0.4,
      handDist: 0.48,
      plungeDamage: 22,
    };
  }

  return {
    name: "USA",
    spritePath: "assets/usa.png",
    deaglePath: "assets/deagle.png",
    eaglePath: "assets/eagle.png",
    moneyPath: "assets/money.png",
    hudSpecial: "E Money",
    defs,
    tryCast,
    tickEagleTrail,
    tickChargeHold,
    aimVec,
    getMeleeWeapon,
  };
})();
