/**
 * France abilities — baguette melee, thrown baguette, wine spill, guided slams.
 * Same slot IDs as USA/Japan/Russia so the game loop stays shared.
 */
window.CBFranceAbilities = (function () {
  const COLORS = ["#002395", "#ffffff", "#ed2939"];
  let baguetteImg = null;
  let wineImg = null;

  function load(path, label) {
    const img = new Image();
    img.onload = function () {
      console.log("[France] loaded " + label);
    };
    img.onerror = function () {
      console.error("[France] failed " + path);
    };
    img.src = path;
    return img;
  }

  baguetteImg = load("assets/baguette.webp", "Baguette");
  wineImg = load("assets/wine.png", "Wine");

  const BAGUETTE = {
    w: 96,
    h: 32,
    pivotX: 22,
    pivotY: 16,
    tipX: 90,
    tipY: 16,
    rotOffset: 0,
    handDist: 0.5,
  };

  const WINE = {
    w: 42,
    h: 72,
    pivotX: 21,
    pivotY: 62,
  };

  const defs = {
    freedomBlast: {
      id: "freedomBlast",
      name: "Baguette Strike",
      cooldown: 0.38,
      damage: 17,
    },
    chargedBlast: {
      id: "chargedBlast",
      name: "Baguette Throw",
      cooldown: 1.05,
      damageMin: 26,
      damageMax: 48,
    },
    eagleStrike: {
      id: "eagleStrike",
      name: "Wine Spill",
      key: "KeyE",
      cooldown: 2.8,
      duration: 5,
      radius: 130,
      slow: 0.5,
    },
    starsBarrage: {
      id: "starsBarrage",
      name: "Guided Baguettes",
      key: "KeyQ",
      cooldown: 1.0,
      ultCost: 100,
      count: 3,
      damage: 38,
      hitChance: 0.9,
    },
  };

  function baguetteFor(player) {
    const ballId = (player && player.id) || "france";
    if (window.CBCosmetics && CBCosmetics.getEquippedWeaponImage) {
      const skin = CBCosmetics.getEquippedWeaponImage(ballId);
      if (skin) return skin;
    }
    return baguetteImg;
  }

  function wrathOn(player) {
    return !!(
      window.CBCountryballs &&
      CBCountryballs.hasWrath &&
      CBCountryballs.hasWrath((player && player.id) || "france")
    );
  }

  function auraId(player) {
    if (!window.CBCountryballs || !CBCountryballs.getEffectId) return null;
    return CBCountryballs.getEffectId((player && player.id) || "france");
  }

  function auraPalette(player, fallback) {
    const id = auraId(player);
    if (!id || id === "none" || !window.CBCosmetics || !CBCosmetics.getEffect) {
      return fallback.slice();
    }
    const fx = CBCosmetics.getEffect(id);
    if (!fx || !Array.isArray(fx.colors) || !fx.colors.length) {
      return fallback.slice();
    }
    return fx.colors.slice();
  }

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
    return typeof foeHp === "number" && foeHp > 0 && damage >= foeHp;
  }

  function castFreedomBlast(player, opts) {
    const options = opts || {};
    const dmg = defs.freedomBlast.damage;
    const finisher = willKo(dmg, options.foeHp);
    const cols = auraPalette(player, COLORS);
    window.CBEffects.spawnDeagleBash({
      follow: player,
      img: baguetteFor(player),
      w: BAGUETTE.w,
      h: BAGUETTE.h,
      pivotX: BAGUETTE.pivotX,
      pivotY: BAGUETTE.pivotY,
      muzzleLocalX: BAGUETTE.tipX,
      muzzleLocalY: BAGUETTE.tipY,
      aimX: player.aimX,
      aimY: player.aimY,
      damage: dmg,
      hitRadius: 40,
      reach: player.radius + 82,
      knockback: 160,
      ownerId: player.id,
      handDist: BAGUETTE.handDist,
      life: 0.28,
      swingFrom: -1.35,
      swingTo: 0.4,
      finisher: finisher,
      wrath: wrathOn(player),
      burstColors: cols,
    });
    console.log("[France] Baguette Strike" + (finisher ? " FINISHER" : ""));
    return { ok: true, finisher: finisher };
  }

  function castChargedBlast(player, charge, opts) {
    const options = opts || {};
    const t = Math.max(0, Math.min(1, charge));
    const dmg = Math.round(
      defs.chargedBlast.damageMin +
        (defs.chargedBlast.damageMax - defs.chargedBlast.damageMin) * t
    );
    const finisher = willKo(dmg, options.foeHp);
    const a = aimVec(player);
    const muzzleX = player.x + a.x * (player.radius + 10);
    const muzzleY = player.y + a.y * (player.radius + 6);
    const spd = 420 + 220 * t;
    window.CBEffects.spawnSpriteProjectile(muzzleX, muzzleY, {
      vx: a.x * spd,
      vy: a.y * spd - 40,
      life: 1.35,
      radius: 22,
      damage: dmg,
      ownerId: player.id,
      img: baguetteFor(player),
      w: 88,
      h: 28,
      rot: Math.atan2(a.y, a.x),
      spin: 8 + t * 6,
      gravity: 380,
      homing: false,
      finisher: finisher,
    });
    window.CBEffects.spawnBurst(muzzleX, muzzleY, 8, auraPalette(player, COLORS));
    console.log(
      "[France] Baguette Throw dmg=" + dmg + (finisher ? " FINISHER" : "")
    );
    return { ok: true, charge: t, finisher: finisher };
  }

  function castEagleStrike(player, opts) {
    const fx = player.facing >= 0 ? 1 : -1;
    const px = player.x + fx * 78;
    const py = player.y + player.radius * 0.55;
    window.CBEffects.spawnDrinkPose({
      follow: player,
      img: wineImg,
      w: WINE.w,
      h: WINE.h,
      pivotX: WINE.pivotX,
      pivotY: WINE.pivotY,
      life: 0.5,
    });
    if (window.CBEffects.spawnWineSpill) {
      window.CBEffects.spawnWineSpill({
        x: px,
        y: py,
        rx: defs.eagleStrike.radius,
        ry: 38,
        life: defs.eagleStrike.duration,
        ownerId: player.id,
      });
    }
    window.CBEffects.spawnBurst(
      px,
      py,
      10,
      auraPalette(player, ["#6b0f1a", "#ed2939", "#4a0c14"])
    );
    console.log("[France] Wine Spill at", Math.round(px), Math.round(py));
    return { ok: true, finisher: false, lockTime: 0.35 };
  }

  function ultImpactX(foe, player, a, i) {
    if (foe && Math.random() < defs.starsBarrage.hitChance) {
      return foe.x + (i - 1) * 22;
    }
    if (foe) {
      const miss =
        foe.x + (Math.random() > 0.5 ? 1 : -1) * (90 + Math.random() * 80);
      console.log("[France] ult baguette " + (i + 1) + " MISS lock x=" + Math.round(miss));
      return miss;
    }
    return player.x + a.x * (180 + i * 30);
  }

  function castStarsBarrage(player, opts) {
    const options = opts || {};
    const dmg = defs.starsBarrage.damage;
    const finisher = willKo(dmg, options.foeHp);
    const foe = options.foe && options.foe.hp > 0 ? options.foe : null;
    const a = aimVec(player);
    const count = defs.starsBarrage.count;
    const groundY =
      typeof options.groundY === "number"
        ? options.groundY
        : player.y + (player.radius || 42) * 0.2;

    if (!window.CBEffects.spawnBaguetteMissile) {
      console.error("[France] spawnBaguetteMissile missing");
      return { ok: false, reason: "no_missile" };
    }

    for (let i = 0; i < count; i++) {
      const impactX = ultImpactX(foe, player, a, i);
      window.CBEffects.spawnBaguetteMissile({
        x: impactX + (i - 1) * 18,
        y: -30 - i * 55,
        vx: (Math.random() - 0.5) * 60,
        vy: 240 + i * 50,
        impactX: impactX,
        groundY: groundY,
        delay: i * 0.14,
        img: baguetteFor(player),
        w: 150,
        h: 50,
        damage: dmg,
        ownerId: player.id,
        finisher: finisher,
        radius: 64,
      });
    }
    window.CBEffects.spawnBurst(
      player.x,
      player.y - player.radius,
      14,
      auraPalette(player, COLORS)
    );
    console.log("[France] Guided Baguettes ×3 slam" + (finisher ? " FINISHER" : ""));
    return { ok: true, finisher: finisher };
  }

  function tryCast(abilityId, player, cooldowns, opts) {
    const def = defs[abilityId];
    if (!def) return { ok: false, reason: "unknown" };
    const options = opts || {};
    const cd = cooldowns[abilityId] || 0;
    if (cd > 0) {
      console.log("[France] " + def.name + " on cooldown (" + cd.toFixed(2) + "s)");
      return { ok: false, reason: "cooldown" };
    }
    if (abilityId === "starsBarrage") {
      const ult = options.ultCharge || 0;
      if (ult < def.ultCost) {
        console.log(
          "[France] Ultimate not charged (" + ult.toFixed(0) + "/" + def.ultCost + ")"
        );
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

  function tickEagleTrail() {}

  function tickChargeHold(player, charge01) {
    const t = Math.max(0, Math.min(1, charge01));
    if (Math.random() > 0.55) return;
    const cols = auraPalette(player, COLORS);
    const a = aimVec(player);
    window.CBEffects.spawnParticle(
      player.x + a.x * player.radius * 0.7,
      player.y + a.y * player.radius * 0.7,
      {
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40 - 20,
        life: 0.22,
        size: 2 + t * 3,
        color: cols[Math.floor(Math.random() * cols.length)],
      }
    );
  }

  function getMeleeWeapon(player) {
    return {
      img: baguetteFor(player),
      w: BAGUETTE.w,
      h: BAGUETTE.h,
      pivotX: BAGUETTE.pivotX,
      pivotY: BAGUETTE.pivotY,
      muzzleLocalX: BAGUETTE.tipX,
      muzzleLocalY: BAGUETTE.tipY,
      handDist: BAGUETTE.handDist,
      plungeDamage: 22,
    };
  }

  return {
    name: "France",
    spritePath: "assets/france.png",
    baguettePath: "assets/baguette.webp",
    winePath: "assets/wine.png",
    hudSpecial: "E Wine",
    defs: defs,
    tryCast: tryCast,
    tickEagleTrail: tickEagleTrail,
    tickChargeHold: tickChargeHold,
    aimVec: aimVec,
    getMeleeWeapon: getMeleeWeapon,
  };
})();
