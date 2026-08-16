/**
 * Canada abilities — hockey stick bash, puck throw, maple syrup freeze, syrup bombs.
 * Same slot IDs as other fighters so the game loop stays shared.
 */
window.CBCanadaAbilities = (function () {
  const COLORS = ["#ff0000", "#ffffff", "#d52b1e", "#c4a574"];
  let stickImg = null;
  let puckImg = null;
  let syrupImg = null;

  function load(path, label, onReady) {
    const img = new Image();
    img.onload = function () {
      console.log("[Canada] loaded " + label);
      if (onReady) onReady(img);
    };
    img.onerror = function () {
      console.error("[Canada] failed " + path);
    };
    img.src = path;
    return img;
  }

  /** Horizontal flip only (mirror), not a rotation. */
  function bakeHFlip(srcImg, label) {
    const c = document.createElement("canvas");
    c.width = srcImg.naturalWidth || srcImg.width;
    c.height = srcImg.naturalHeight || srcImg.height;
    const ctx = c.getContext("2d");
    if (!ctx || c.width <= 0) return srcImg;
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(srcImg, 0, 0);
    const out = new Image();
    out.onload = function () {
      console.log("[Canada] h-flipped " + label);
    };
    out.src = c.toDataURL("image/png");
    return out;
  }

  stickImg = load("assets/hockey.webp", "Hockey stick", function (img) {
    stickImg = bakeHFlip(img, "Hockey stick");
  });
  puckImg = load("assets/puck.png", "Puck");
  syrupImg = load("assets/maple_syrup.png", "Maple syrup");

  const STICK = {
    w: 118,
    h: 44,
    pivotX: 20,
    pivotY: 22,
    tipX: 108,
    tipY: 22,
    handDist: 0.52,
  };

  const defs = {
    freedomBlast: {
      id: "freedomBlast",
      name: "Hockey Slap",
      cooldown: 0.38,
      damage: 17,
    },
    chargedBlast: {
      id: "chargedBlast",
      name: "Puck Toss",
      cooldown: 1.0,
      damageMin: 24,
      damageMax: 46,
    },
    eagleStrike: {
      id: "eagleStrike",
      name: "Maple Syrup",
      key: "KeyE",
      cooldown: 3.2,
      duration: 16,
      rx: 140,
      ry: 42,
      freeze: 5,
      watch: 5,
    },
    starsBarrage: {
      id: "starsBarrage",
      name: "Syrup Bombs",
      key: "KeyQ",
      cooldown: 1.0,
      ultCost: 100,
      count: 9,
      damage: 26,
    },
  };

  function stickFor(player) {
    const ballId = (player && player.id) || "canada";
    if (window.CBCosmetics && CBCosmetics.getEquippedWeaponImage) {
      const skin = CBCosmetics.getEquippedWeaponImage(ballId);
      if (skin) return skin;
    }
    return stickImg;
  }

  function wrathOn(player) {
    return !!(
      window.CBCountryballs &&
      CBCountryballs.hasWrath &&
      CBCountryballs.hasWrath((player && player.id) || "canada")
    );
  }

  function auraId(player) {
    if (!window.CBCountryballs || !CBCountryballs.getEffectId) return null;
    return CBCountryballs.getEffectId((player && player.id) || "canada");
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
      img: stickFor(player),
      w: STICK.w,
      h: STICK.h,
      pivotX: STICK.pivotX,
      pivotY: STICK.pivotY,
      muzzleLocalX: STICK.tipX,
      muzzleLocalY: STICK.tipY,
      aimX: player.aimX,
      aimY: player.aimY,
      damage: dmg,
      hitRadius: 40,
      reach: player.radius + 95,
      knockback: 165,
      ownerId: player.id,
      handDist: STICK.handDist,
      life: 0.3,
      swingFrom: -1.35,
      swingTo: 0.45,
      finisher: finisher,
      wrath: wrathOn(player),
    });
    console.log("[Canada] Hockey Slap" + (finisher ? " FINISHER" : ""));
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
    const spd = 520 + 220 * t;
    window.CBEffects.spawnSpriteProjectile(muzzleX, muzzleY, {
      vx: a.x * spd,
      vy: a.y * spd - 30,
      life: 1.25,
      radius: 16,
      damage: dmg,
      ownerId: player.id,
      img: puckImg,
      w: 34,
      h: 34,
      rot: 0,
      spin: 14 + t * 8,
      gravity: 280,
      homing: false,
      finisher: finisher,
    });
    window.CBEffects.spawnBurst(muzzleX, muzzleY, 6, auraPalette(player, COLORS));
    console.log("[Canada] Puck Toss dmg=" + dmg + (finisher ? " FINISHER" : ""));
    return { ok: true, charge: t, finisher: finisher };
  }

  function castEagleStrike(player, opts) {
    if (!window.CBEffects.spawnSyrupSpill) {
      console.error("[Canada] spawnSyrupSpill missing");
      return { ok: false, reason: "no_syrup" };
    }
    const fx = player.facing >= 0 ? 1 : -1;
    window.CBEffects.spawnSyrupSpill({
      x: player.x + fx * 78,
      y: player.y + (player.radius || 42) * 0.55,
      rx: defs.eagleStrike.rx,
      ry: defs.eagleStrike.ry,
      life: defs.eagleStrike.duration,
      freeze: defs.eagleStrike.freeze,
      watch: defs.eagleStrike.watch,
      ownerId: player.id,
      img: syrupImg,
    });
    console.log("[Canada] Maple syrup spill");
    return { ok: true, finisher: false, lockTime: 0.28 };
  }

  function castStarsBarrage(player, opts) {
    const options = opts || {};
    const foe = options.foe;
    const dmg = defs.starsBarrage.damage;
    const finisher = willKo(dmg * 2, options.foeHp);
    if (!window.CBEffects.spawnSyrupBomb) {
      console.error("[Canada] spawnSyrupBomb missing");
      return { ok: false, reason: "no_bombs" };
    }
    const count = defs.starsBarrage.count;
    const baseX = foe && foe.hp > 0 ? foe.x : player.x + player.facing * 120;
    const groundY =
      typeof options.groundY === "number"
        ? options.groundY
        : player.y + (player.radius || 42) * 0.2;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 70 + (Math.random() - 0.5) * 36;
      window.CBEffects.spawnSyrupBomb({
        x: baseX + spread,
        y: -40 - i * 55 - Math.random() * 40,
        vy: 320 + Math.random() * 80,
        vx: (Math.random() - 0.5) * 40,
        groundY: groundY,
        delay: i * 0.11,
        img: syrupImg,
        w: 56,
        h: 78,
        damage: dmg,
        radius: 78,
        ownerId: player.id,
        finisher: finisher && i === 0,
      });
    }
    window.CBEffects.spawnBurst(
      player.x,
      player.y - 20,
      14,
      auraPalette(player, COLORS)
    );
    console.log("[Canada] Syrup bomb rain ×" + count);
    return { ok: true, finisher: finisher, lockTime: 0.35 };
  }

  function tryCast(abilityId, player, cooldowns, opts) {
    const def = defs[abilityId];
    if (!def) return { ok: false, reason: "unknown" };
    const options = opts || {};
    const cd = cooldowns[abilityId] || 0;
    if (cd > 0) {
      console.log("[Canada] " + def.name + " on cooldown (" + cd.toFixed(2) + "s)");
      return { ok: false, reason: "cooldown" };
    }
    if (abilityId === "starsBarrage") {
      const ult = options.ultCharge || 0;
      if (ult < def.ultCost) {
        console.log(
          "[Canada] Ultimate not charged (" + ult.toFixed(0) + "/" + def.ultCost + ")"
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
      img: stickFor(player),
      w: STICK.w,
      h: STICK.h,
      pivotX: STICK.pivotX,
      pivotY: STICK.pivotY,
      muzzleLocalX: STICK.tipX,
      muzzleLocalY: STICK.tipY,
      handDist: STICK.handDist,
      plungeDamage: 24,
    };
  }

  return {
    name: "Canada",
    spritePath: "assets/canada.png",
    stickPath: "assets/hockey.webp",
    puckPath: "assets/puck.png",
    syrupPath: "assets/maple_syrup.png",
    hudSpecial: "E Maple Syrup",
    defs: defs,
    tryCast: tryCast,
    tickEagleTrail: tickEagleTrail,
    tickChargeHold: tickChargeHold,
    aimVec: aimVec,
    getMeleeWeapon: getMeleeWeapon,
    getStickImage: function () {
      return stickImg;
    },
    getPuckImage: function () {
      return puckImg;
    },
    getSyrupImage: function () {
      return syrupImg;
    },
  };
})();
