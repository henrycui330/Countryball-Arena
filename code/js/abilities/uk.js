/**
 * UK abilities — umbrella melee, teacup throw, acid rain, warship ride-through.
 * Same slot IDs as USA/Japan/Russia/France so the game loop stays shared.
 */
window.CBUKAbilities = (function () {
  const COLORS = ["#012169", "#ffffff", "#c8102e"];
  let umbrellaImg = null;
  let teaImg = null;
  let shipImg = null;

  function load(path, label) {
    const img = new Image();
    img.onload = function () {
      console.log("[UK] loaded " + label);
    };
    img.onerror = function () {
      console.error("[UK] failed " + path);
    };
    img.src = path;
    return img;
  }

  umbrellaImg = load("assets/umbrella.webp", "Umbrella");
  teaImg = load("assets/tea.webp", "Tea");
  shipImg = load("assets/warship.png", "Warship");

  const UMBRELLA = {
    w: 42,
    h: 90,
    pivotX: 21,
    pivotY: 82,
    tipX: 21,
    tipY: 8,
    handDist: 0.52,
  };

  const defs = {
    freedomBlast: {
      id: "freedomBlast",
      name: "Umbrella Bash",
      cooldown: 0.38,
      damage: 16,
    },
    chargedBlast: {
      id: "chargedBlast",
      name: "Teacup Toss",
      cooldown: 1.05,
      damageMin: 24,
      damageMax: 46,
    },
    eagleStrike: {
      id: "eagleStrike",
      name: "Acid Rain",
      key: "KeyE",
      cooldown: 3.0,
      duration: 5,
      tick: 0.38,
      tickDmg: 7,
      rx: 155,
      ry: 110,
    },
    starsBarrage: {
      id: "starsBarrage",
      name: "Warship",
      key: "KeyQ",
      cooldown: 1.0,
      ultCost: 100,
      hpPct: 0.8,
    },
  };

  function umbrellaFor(player) {
    const ballId = (player && player.id) || "uk";
    if (window.CBCosmetics && CBCosmetics.getEquippedWeaponImage) {
      const skin = CBCosmetics.getEquippedWeaponImage(ballId);
      if (skin) return skin;
    }
    return umbrellaImg;
  }

  function wrathOn(player) {
    return !!(
      window.CBCountryballs &&
      CBCountryballs.hasWrath &&
      CBCountryballs.hasWrath((player && player.id) || "uk")
    );
  }

  function auraId(player) {
    if (!window.CBCountryballs || !CBCountryballs.getEffectId) return null;
    return CBCountryballs.getEffectId((player && player.id) || "uk");
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
    window.CBEffects.spawnDeagleBash({
      follow: player,
      img: umbrellaFor(player),
      w: UMBRELLA.w,
      h: UMBRELLA.h,
      pivotX: UMBRELLA.pivotX,
      pivotY: UMBRELLA.pivotY,
      muzzleLocalX: UMBRELLA.tipX,
      muzzleLocalY: UMBRELLA.tipY,
      aimX: player.aimX,
      aimY: player.aimY,
      damage: dmg,
      hitRadius: 38,
      reach: player.radius + 88,
      knockback: 155,
      ownerId: player.id,
      handDist: UMBRELLA.handDist,
      life: 0.3,
      swingFrom: -1.5,
      swingTo: 0.35,
      finisher: finisher,
      wrath: wrathOn(player),
    });
    console.log("[UK] Umbrella Bash" + (finisher ? " FINISHER" : ""));
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
    const muzzleY = player.y + a.y * (player.radius + 4);
    const spd = 400 + 200 * t;
    window.CBEffects.spawnSpriteProjectile(muzzleX, muzzleY, {
      vx: a.x * spd,
      vy: a.y * spd - 50,
      life: 1.4,
      radius: 20,
      damage: dmg,
      ownerId: player.id,
      img: teaImg,
      w: 44,
      h: 40,
      rot: 0,
      spin: 10 + t * 6,
      gravity: 420,
      homing: false,
      finisher: finisher,
    });
    window.CBEffects.spawnBurst(muzzleX, muzzleY, 7, auraPalette(player, COLORS));
    console.log("[UK] Teacup Toss dmg=" + dmg + (finisher ? " FINISHER" : ""));
    return { ok: true, charge: t, finisher: finisher };
  }

  function castEagleStrike(player, opts) {
    const fx = player.facing >= 0 ? 1 : -1;
    const px = player.x + fx * 70;
    const py = player.y - 20;
    if (!window.CBEffects.spawnAcidRain) {
      console.error("[UK] spawnAcidRain missing");
      return { ok: false, reason: "no_rain" };
    }
    window.CBEffects.spawnAcidRain({
      x: px,
      y: py,
      rx: defs.eagleStrike.rx,
      ry: defs.eagleStrike.ry,
      life: defs.eagleStrike.duration,
      tick: defs.eagleStrike.tick,
      damage: defs.eagleStrike.tickDmg,
      ownerId: player.id,
    });
    console.log("[UK] Acid Rain at", Math.round(px), Math.round(py));
    return { ok: true, finisher: false, lockTime: 0.28 };
  }

  function castStarsBarrage(player, opts) {
    const options = opts || {};
    const foe = options.foe;
    const baseHp = (foe && foe.maxHp) || 100;
    const dmg = Math.max(1, Math.round(baseHp * (defs.starsBarrage.hpPct || 0.8)));
    const finisher = willKo(dmg, options.foeHp);
    const dir = player.facing >= 0 ? 1 : -1;
    const groundY =
      typeof options.groundY === "number"
        ? options.groundY
        : player.y + (player.radius || 42) * 0.15;
    if (!window.CBEffects.spawnWarship) {
      console.error("[UK] spawnWarship missing");
      return { ok: false, reason: "no_ship" };
    }
    const w = 2240;
    const h = 840;
    const startX = dir > 0 ? -w * 0.45 : 960 + w * 0.45;
    window.CBEffects.spawnWarship({
      x: startX,
      groundY: groundY,
      vx: dir * 430,
      w: w,
      h: h,
      img: shipImg,
      facing: dir,
      damage: dmg,
      ownerId: player.id,
      finisher: finisher,
      hitH: 92,
    });
    window.CBEffects.spawnBurst(
      player.x,
      player.y - 20,
      16,
      auraPalette(player, COLORS)
    );
    console.log(
      "[UK] Warship ride-through dmg=" +
        dmg +
        " (80% of maxHp " +
        baseHp +
        ")" +
        (finisher ? " FINISHER" : "")
    );
    return { ok: true, finisher: finisher, lockTime: 0.2 };
  }

  function tryCast(abilityId, player, cooldowns, opts) {
    const def = defs[abilityId];
    if (!def) return { ok: false, reason: "unknown" };
    const options = opts || {};
    const cd = cooldowns[abilityId] || 0;
    if (cd > 0) {
      console.log("[UK] " + def.name + " on cooldown (" + cd.toFixed(2) + "s)");
      return { ok: false, reason: "cooldown" };
    }
    if (abilityId === "starsBarrage") {
      const ult = options.ultCharge || 0;
      if (ult < def.ultCost) {
        console.log(
          "[UK] Ultimate not charged (" + ult.toFixed(0) + "/" + def.ultCost + ")"
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
      img: umbrellaFor(player),
      w: UMBRELLA.w,
      h: UMBRELLA.h,
      pivotX: UMBRELLA.pivotX,
      pivotY: UMBRELLA.pivotY,
      muzzleLocalX: UMBRELLA.tipX,
      muzzleLocalY: UMBRELLA.tipY,
      handDist: UMBRELLA.handDist,
      plungeDamage: 22,
    };
  }

  return {
    name: "UK",
    spritePath: "assets/uk.png",
    umbrellaPath: "assets/umbrella.webp",
    teaPath: "assets/tea.webp",
    shipPath: "assets/warship.png",
    hudSpecial: "E Acid Rain",
    defs: defs,
    tryCast: tryCast,
    tickEagleTrail: tickEagleTrail,
    tickChargeHold: tickChargeHold,
    aimVec: aimVec,
    getMeleeWeapon: getMeleeWeapon,
    getTeaImage: function () {
      return teaImg;
    },
    getShipImage: function () {
      return shipImg;
    },
  };
})();
