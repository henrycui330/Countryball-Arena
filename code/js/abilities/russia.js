/**
 * Russia abilities — Absolut bash, stun barrage, vodka drink, ally summon ult.
 * Shared ability slot IDs with USA/Japan.
 */
window.CBRussiaAbilities = (function () {
  const COLORS = ["#ffffff", "#0039a6", "#d52b1e"];
  let absolutImg = null;
  let kzImg = null;
  let byImg = null;
  let uaImg = null;

  function load(path, label) {
    const img = new Image();
    img.onload = function () {
      console.log("[Russia] loaded " + label);
    };
    img.onerror = function () {
      console.error("[Russia] failed " + path);
    };
    img.src = path;
    return img;
  }

  absolutImg = load("assets/absolut.png", "Absolut");
  kzImg = load("assets/kazakhstan.png", "Kazakhstan");
  byImg = load("assets/belarus.png", "Belarus");
  uaImg = load("assets/ukraine.png", "Ukraine");

  const BOTTLE = {
    w: 42,
    h: 72,
    pivotX: 21,
    pivotY: 58,
    tipX: 21,
    tipY: 8,
    rotOffset: 0,
    handDist: 0.55,
  };

  const defs = {
    freedomBlast: {
      id: "freedomBlast",
      name: "Absolut Bash",
      cooldown: 0.4,
      damage: 17,
    },
    chargedBlast: {
      id: "chargedBlast",
      name: "Vodka Barrage",
      cooldown: 1.35,
      damageMin: 6,
      damageMax: 10,
      hitsMin: 5,
      hitsMax: 8,
    },
    eagleStrike: {
      id: "eagleStrike",
      name: "Drink Absolut",
      key: "KeyE",
      cooldown: 5.5,
      heal: 24,
      speedMult: 1.32,
      buffTime: 4.5,
    },
    starsBarrage: {
      id: "starsBarrage",
      name: "Brotherhood Summon",
      key: "KeyQ",
      cooldown: 1.0,
      ultCost: 100,
      allyLife: 30,
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
    return typeof foeHp === "number" && foeHp > 0 && damage >= foeHp;
  }

  function castFreedomBlast(player, opts) {
    const options = opts || {};
    const dmg = defs.freedomBlast.damage;
    const finisher = willKo(dmg, options.foeHp);
    const a = aimVec(player);
    window.CBEffects.spawnDeagleBash({
      follow: player,
      img: absolutImg,
      w: BOTTLE.w,
      h: BOTTLE.h,
      pivotX: BOTTLE.pivotX,
      pivotY: BOTTLE.pivotY,
      muzzleLocalX: BOTTLE.tipX,
      muzzleLocalY: BOTTLE.tipY,
      aimX: player.aimX,
      aimY: player.aimY,
      damage: dmg,
      hitRadius: 40,
      reach: player.radius + 78,
      knockback: 150,
      ownerId: player.id,
      handDist: BOTTLE.handDist,
      life: 0.28,
      swingFrom: -1.2,
      swingTo: 0.55,
      finisher,
    });
    window.CBEffects.spawnParticle(
      player.x + a.x * player.radius,
      player.y + a.y * player.radius,
      { vx: a.x * 50, vy: a.y * 50, life: 0.12, size: 3, color: "#0039a6" }
    );
    console.log("[Russia] Absolut Bash" + (finisher ? " FINISHER" : ""));
    return { ok: true, finisher };
  }

  function castChargedBlast(player, charge, opts) {
    const options = opts || {};
    const t = Math.max(0, Math.min(1, charge));
    const hits = Math.round(
      defs.chargedBlast.hitsMin +
        (defs.chargedBlast.hitsMax - defs.chargedBlast.hitsMin) * t
    );
    const perHit = Math.round(
      defs.chargedBlast.damageMin +
        (defs.chargedBlast.damageMax - defs.chargedBlast.damageMin) * t
    );
    const finisher = willKo(perHit, options.foeHp);
    const target = options.foe && options.foe.hp > 0 ? options.foe : null;
    const duration = 0.55 + hits * 0.12;

    window.CBEffects.spawnVodkaBarrage({
      follow: player,
      target: target,
      img: absolutImg,
      w: BOTTLE.w,
      h: BOTTLE.h,
      pivotX: BOTTLE.pivotX,
      pivotY: BOTTLE.pivotY,
      tipLocalX: BOTTLE.tipX,
      tipLocalY: BOTTLE.tipY,
      damage: perHit,
      hits: hits,
      ownerId: player.id,
      handDist: BOTTLE.handDist,
      duration: duration,
      finisher,
    });
    console.log(
      "[Russia] Barrage hits=" + hits + " dmg/hit=" + perHit + (finisher ? " FINISHER" : "")
    );
    return { ok: true, charge: t, finisher, lockTime: duration + 0.05 };
  }

  function castEagleStrike(player, opts) {
    const options = opts || {};
    const heal = defs.eagleStrike.heal;
    const maxHp = player.maxHp || 100;
    const before = player.hp;
    player.hp = Math.min(maxHp, player.hp + heal);
    const gained = player.hp - before;

    window.CBEffects.spawnBurst(player.x, player.y - player.radius * 0.4, 14, [
      "#0039a6",
      "#ffffff",
      "#d52b1e",
    ]);
    // Tip-up drink pose
    window.CBEffects.spawnDrinkPose({
      follow: player,
      img: absolutImg,
      w: BOTTLE.w,
      h: BOTTLE.h,
      pivotX: BOTTLE.pivotX,
      pivotY: BOTTLE.pivotY,
      life: 0.55,
    });

    console.log(
      "[Russia] Drink heal +" + gained.toFixed(0) + " hp=" + player.hp.toFixed(0)
    );
    return {
      ok: true,
      finisher: false,
      speedMult: defs.eagleStrike.speedMult,
      buffTime: defs.eagleStrike.buffTime,
      healed: gained,
    };
  }

  function castStarsBarrage(player, opts) {
    const options = opts || {};
    const target = options.foe && options.foe.hp > 0 ? options.foe : null;
    if (!window.CBAllies) {
      console.error("[Russia] CBAllies missing");
      return { ok: false, reason: "no_allies" };
    }
    window.CBAllies.spawnBrotherhood({
      owner: player,
      target: target,
      life: defs.starsBarrage.allyLife,
      allies: [
        { id: "ally-kz", name: "Kazakhstan", img: kzImg },
        { id: "ally-by", name: "Belarus", img: byImg },
        { id: "ally-ua", name: "Ukraine", img: uaImg },
      ],
    });
    window.CBEffects.spawnBurst(player.x, player.y, 16, COLORS);
    console.log("[Russia] Brotherhood summon ×3");
    return { ok: true, finisher: false };
  }

  function tryCast(abilityId, player, cooldowns, opts) {
    const def = defs[abilityId];
    if (!def) return { ok: false, reason: "unknown" };
    const options = opts || {};
    const cd = cooldowns[abilityId] || 0;
    if (cd > 0) {
      console.log(`[Russia] ${def.name} on cooldown (${cd.toFixed(2)}s)`);
      return { ok: false, reason: "cooldown" };
    }
    if (abilityId === "starsBarrage") {
      const ult = options.ultCharge || 0;
      if (ult < def.ultCost) {
        console.log(
          `[Russia] Ultimate not charged (${ult.toFixed(0)}/${def.ultCost})`
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
    if (Math.random() > 0.5) return;
    const a = aimVec(player);
    window.CBEffects.spawnParticle(
      player.x + a.x * player.radius * 0.5,
      player.y + a.y * player.radius * 0.5,
      {
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40 - 20,
        life: 0.2,
        size: 2 + t * 2,
        color: COLORS[Math.floor(Math.random() * 3)],
      }
    );
  }

  function getMeleeWeapon() {
    return {
      img: absolutImg,
      w: BOTTLE.w,
      h: BOTTLE.h,
      pivotX: BOTTLE.pivotX,
      pivotY: BOTTLE.pivotY,
      muzzleLocalX: BOTTLE.tipX,
      muzzleLocalY: BOTTLE.tipY,
      handDist: BOTTLE.handDist,
      plungeDamage: 23,
    };
  }

  return {
    name: "Russia",
    spritePath: "assets/russia.png",
    absolutPath: "assets/absolut.png",
    hudSpecial: "E Drink",
    defs,
    tryCast,
    tickEagleTrail,
    tickChargeHold,
    aimVec,
    getMeleeWeapon,
  };
})();
