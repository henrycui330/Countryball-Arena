/**
 * Japanball abilities — katana melee, shove-stab charge, guided shuriken, cinema ult.
 * Uses same ability slot IDs as USA so the game loop stays shared.
 */
window.CBJapanAbilities = (function () {
  const COLORS = ["#ffffff", "#bc002d", "#111111"];
  let katanaImg = null;
  let shurikenImg = null;

  function ensureKatanaLoaded() {
    if (katanaImg) return;
    katanaImg = new Image();
    katanaImg.onload = function () {
      console.log("[Japan] Katana asset loaded");
    };
    katanaImg.onerror = function () {
      console.error("[Japan] Failed to load assets/katana.png");
    };
    katanaImg.src = "assets/katana.png";
  }

  function ensureShurikenLoaded() {
    if (shurikenImg) return;
    shurikenImg = new Image();
    shurikenImg.onload = function () {
      console.log("[Japan] Shuriken asset loaded");
    };
    shurikenImg.onerror = function () {
      console.error("[Japan] Failed to load assets/shuriken.png");
    };
    shurikenImg.src = "assets/shuriken.png";
  }

  ensureKatanaLoaded();
  ensureShurikenLoaded();

  const KATANA = {
    w: 82,
    h: 77,
    // Sprite: tip ~bottom-left, hilt ~top-right; flip 180° so tip follows aim
    pivotX: 64,
    pivotY: 18,
    tipX: 11,
    tipY: 64,
    rotOffset: Math.PI,
    handDist: 0.48,
  };

  const defs = {
    freedomBlast: {
      id: "freedomBlast",
      name: "Katana Strike",
      cooldown: 0.38,
      damage: 18,
    },
    chargedBlast: {
      id: "chargedBlast",
      name: "Shove Stab",
      cooldown: 1.05,
      damageMin: 28,
      damageMax: 55,
    },
    eagleStrike: {
      id: "eagleStrike",
      name: "Guided Shuriken",
      key: "KeyE",
      cooldown: 2.6,
      count: 3,
      damage: 14,
    },
    starsBarrage: {
      id: "starsBarrage",
      name: "White Flash Stab",
      key: "KeyQ",
      cooldown: 1.0,
      ultCost: 100,
      damage: 120,
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
    window.CBEffects.spawnKatanaStrike({
      follow: player,
      img: katanaImg,
      w: KATANA.w,
      h: KATANA.h,
      pivotX: KATANA.pivotX,
      pivotY: KATANA.pivotY,
      tipLocalX: KATANA.tipX,
      tipLocalY: KATANA.tipY,
      rotOffset: KATANA.rotOffset,
      aimX: player.aimX,
      aimY: player.aimY,
      damage: dmg,
      hitRadius: 42,
      reach: player.radius + 86,
      knockback: 175,
      ownerId: player.id,
      handDist: KATANA.handDist,
      life: 0.28,
      swingFrom: -1.55,
      swingTo: 0.45,
      finisher,
    });
    window.CBEffects.spawnParticle(
      player.x + a.x * player.radius,
      player.y + a.y * player.radius,
      { vx: a.x * 80, vy: a.y * 80, life: 0.12, size: 3, color: "#bc002d" }
    );
    console.log("[Japan] Katana Strike" + (finisher ? " FINISHER" : ""));
    return { ok: true, finisher };
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
    const target = options.foe && options.foe.hp > 0 ? options.foe : null;

    window.CBEffects.spawnKatanaCharge({
      follow: player,
      target: target,
      img: katanaImg,
      w: KATANA.w,
      h: KATANA.h,
      pivotX: KATANA.pivotX,
      pivotY: KATANA.pivotY,
      tipLocalX: KATANA.tipX,
      tipLocalY: KATANA.tipY,
      rotOffset: KATANA.rotOffset,
      aimX: player.aimX,
      aimY: player.aimY,
      dirX: a.x,
      dirY: a.y,
      damage: dmg,
      charge: t,
      ownerId: player.id,
      handDist: KATANA.handDist,
      shoveTime: 0.5 + t * 0.15,
      stabTime: 0.38,
      arenaW: 960,
      arenaH: 540,
      finisher,
    });
    console.log(
      "[Japan] Shove Stab dmg~" + dmg + (finisher ? " FINISHER" : "")
    );
    return { ok: true, charge: t, finisher, lockTime: 0.95 + t * 0.15 };
  }

  function castEagleStrike(player, opts) {
    const options = opts || {};
    const a = aimVec(player);
    const count = defs.eagleStrike.count;
    const finisher = willKo(defs.eagleStrike.damage, options.foeHp);
    const muzzleX = player.x + a.x * (player.radius + 8);
    const muzzleY = player.y + a.y * (player.radius + 8);
    const target = options.foe && options.foe.hp > 0 ? options.foe : null;

    window.CBEffects.spawnBurst(muzzleX, muzzleY, 8, [
      "#bc002d",
      "#ffffff",
      "#888888",
    ]);

    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.55;
      const ang = Math.atan2(a.y, a.x) + spread;
      const speed = 340 + i * 35;
      window.CBEffects.spawnSpriteProjectile(muzzleX, muzzleY, {
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: 2.4,
        radius: 20,
        damage: defs.eagleStrike.damage,
        ownerId: player.id,
        img: shurikenImg,
        w: 48,
        h: 48,
        rot: ang,
        spin: 14 + i * 2,
        gravity: 0,
        homing: true,
        target: target,
        turnRate: 6.5 + i * 1.2,
        finisher,
      });
    }
    console.log("[Japan] Guided Shuriken ×3" + (finisher ? " FINISHER" : ""));
    return { ok: true, finisher };
  }

  function castStarsBarrage(player, opts) {
    const options = opts || {};
    const dmg = defs.starsBarrage.damage;
    const finisher = willKo(dmg, options.foeHp);
    const target = options.foe && options.foe.hp > 0 ? options.foe : null;

    window.CBEffects.spawnJapanCinemaUlt({
      player: player,
      foe: target,
      katanaImg: katanaImg,
      damage: dmg,
      ownerId: player.id,
      finisher: finisher,
      arenaW: 960,
      arenaH: 540,
      w: KATANA.w,
      h: KATANA.h,
      pivotX: KATANA.pivotX,
      pivotY: KATANA.pivotY,
      tipLocalX: KATANA.tipX,
      tipLocalY: KATANA.tipY,
      rotOffset: KATANA.rotOffset,
    });

    console.log("[Japan] Cinema Ult" + (finisher ? " FINISHER" : ""));
    return {
      ok: true,
      finisher: finisher,
      lockTime: 2.35,
      invulnTime: 2.35,
      cinema: true,
    };
  }

  function tryCast(abilityId, player, cooldowns, opts) {
    const def = defs[abilityId];
    if (!def) return { ok: false, reason: "unknown" };
    const options = opts || {};

    const cd = cooldowns[abilityId] || 0;
    if (cd > 0) {
      console.log(`[Japan] ${def.name} on cooldown (${cd.toFixed(2)}s)`);
      return { ok: false, reason: "cooldown" };
    }

    if (abilityId === "starsBarrage") {
      const ult = options.ultCharge || 0;
      if (ult < def.ultCost) {
        console.log(
          `[Japan] Ultimate not charged (${ult.toFixed(0)}/${def.ultCost})`
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

  function tickEagleTrail(player) {
    if (Math.random() > 0.4) return;
    window.CBEffects.spawnTrail(player.x, player.y, {
      life: 0.22,
      size: player.radius * 0.75,
      color: "rgba(188,0,45,0.35)",
    });
  }

  function tickChargeHold(player, charge01) {
    const t = Math.max(0, Math.min(1, charge01));
    if (Math.random() > 0.45) return;
    const a = aimVec(player);
    window.CBEffects.spawnParticle(
      player.x + a.x * player.radius * 0.55,
      player.y + a.y * player.radius * 0.55,
      {
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40 - 25,
        life: 0.22,
        size: 2 + t * 3,
        color: t > 0.7 ? "#bc002d" : COLORS[Math.floor(Math.random() * 3)],
      }
    );
  }

  return {
    name: "Japan",
    spritePath: "assets/japan.png",
    katanaPath: "assets/katana.png",
    shurikenPath: "assets/shuriken.png",
    hudSpecial: "E Shuriken",
    defs,
    tryCast,
    tickEagleTrail,
    tickChargeHold,
    aimVec,
  };
})();
