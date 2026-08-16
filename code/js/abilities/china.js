/**
 * China abilities — calligraphy bash, dumpling throw, dumpling C4, social-credit ult.
 * Same slot IDs as USA/Japan/Russia/France/UK so the game loop stays shared.
 */
window.CBChinaAbilities = (function () {
  const COLORS = ["#de2910", "#ffde00", "#ffffff", "#8b0000"];
  let brushImg = null;
  let dumplingImg = null;
  let socialImg = null;

  function load(path, label) {
    const img = new Image();
    img.onload = function () {
      console.log("[China] loaded " + label);
    };
    img.onerror = function () {
      console.error("[China] failed " + path);
    };
    img.src = path;
    return img;
  }

  brushImg = load("assets/calligraphy.png", "Calligraphy");
  dumplingImg = load("assets/dumpling.webp", "Dumpling");
  socialImg = load("assets/social_credit.gif", "Social Credit");
  // Keep GIF frames advancing for canvas drawImage
  (function hostGif() {
    if (!socialImg) return;
    socialImg.addEventListener("load", function () {
      if (socialImg._cbHosted) return;
      try {
        socialImg.style.cssText =
          "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
        document.body.appendChild(socialImg);
        socialImg._cbHosted = true;
      } catch (err) {
        /* ignore */
      }
    });
  })();

  const BRUSH = {
    w: 108,
    h: 82,
    pivotX: 92,
    pivotY: 28,
    tipX: 14,
    tipY: 68,
    handDist: 0.5,
  };

  const defs = {
    freedomBlast: {
      id: "freedomBlast",
      name: "Calligraphy Bash",
      cooldown: 0.38,
      damage: 17,
    },
    chargedBlast: {
      id: "chargedBlast",
      name: "Dumpling Toss",
      cooldown: 1.05,
      damageMin: 24,
      damageMax: 46,
    },
    eagleStrike: {
      id: "eagleStrike",
      name: "Dumpling C4",
      key: "KeyE",
      cooldown: 2.4,
      damage: 42,
      radius: 118,
      plantLife: 18,
    },
    starsBarrage: {
      id: "starsBarrage",
      name: "Social Credit",
      key: "KeyQ",
      cooldown: 1.2,
      ultCost: 100,
    },
  };

  function brushFor(player) {
    const ballId = (player && player.id) || "china";
    if (window.CBCosmetics && CBCosmetics.getEquippedWeaponImage) {
      const skin = CBCosmetics.getEquippedWeaponImage(ballId);
      if (skin) return skin;
    }
    return brushImg;
  }

  function wrathOn(player) {
    return !!(
      window.CBCountryballs &&
      CBCountryballs.hasWrath &&
      CBCountryballs.hasWrath((player && player.id) || "china")
    );
  }

  function auraId(player) {
    if (!window.CBCountryballs || !CBCountryballs.getEffectId) return null;
    return CBCountryballs.getEffectId((player && player.id) || "china");
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
      img: brushFor(player),
      w: BRUSH.w,
      h: BRUSH.h,
      pivotX: BRUSH.pivotX,
      pivotY: BRUSH.pivotY,
      muzzleLocalX: BRUSH.tipX,
      muzzleLocalY: BRUSH.tipY,
      aimX: player.aimX,
      aimY: player.aimY,
      damage: dmg,
      hitRadius: 40,
      reach: player.radius + 92,
      knockback: 150,
      ownerId: player.id,
      handDist: BRUSH.handDist,
      life: 0.3,
      swingFrom: -1.4,
      swingTo: 0.4,
      finisher: finisher,
      wrath: wrathOn(player),
    });
    console.log("[China] Calligraphy Bash" + (finisher ? " FINISHER" : ""));
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
    const spd = 380 + 180 * t;
    window.CBEffects.spawnSpriteProjectile(muzzleX, muzzleY, {
      vx: a.x * spd,
      vy: a.y * spd - 40,
      life: 1.35,
      radius: 22,
      damage: dmg,
      ownerId: player.id,
      img: dumplingImg,
      w: 48,
      h: 48,
      rot: 0,
      spin: 8 + t * 5,
      gravity: 400,
      homing: false,
      finisher: finisher,
    });
    window.CBEffects.spawnBurst(muzzleX, muzzleY, 7, auraPalette(player, COLORS));
    console.log("[China] Dumpling Toss dmg=" + dmg + (finisher ? " FINISHER" : ""));
    return { ok: true, charge: t, finisher: finisher };
  }

  function castEagleStrike(player, opts) {
    if (!window.CBEffects || !CBEffects.spawnDumplingMine) {
      console.error("[China] dumpling C4 missing");
      return { ok: false, reason: "no_mine" };
    }
    const existing =
      typeof CBEffects.getDumplingMine === "function"
        ? CBEffects.getDumplingMine(player.id)
        : null;
    if (existing) {
      const det = CBEffects.detonateDumplingMine(existing, {
        damage: defs.eagleStrike.damage,
        radius: defs.eagleStrike.radius,
      });
      console.log("[China] Dumpling C4 DETONATE");
      return {
        ok: true,
        finisher: !!(det && det.finisher),
        lockTime: 0.18,
        noCooldown: true,
      };
    }
    const fx = player.facing >= 0 ? 1 : -1;
    window.CBEffects.spawnDumplingMine({
      x: player.x + fx * 28,
      y: player.y + (player.radius || 42) * 0.55,
      img: dumplingImg,
      w: 52,
      h: 52,
      life: defs.eagleStrike.plantLife,
      ownerId: player.id,
      damage: defs.eagleStrike.damage,
      radius: defs.eagleStrike.radius,
    });
    console.log("[China] Dumpling C4 planted");
    return { ok: true, finisher: false, lockTime: 0.22 };
  }

  function castStarsBarrage(player, opts) {
    const options = opts || {};
    const foe = options.foe;
    if (!foe || foe.hp <= 0) {
      console.log("[China] Social Credit needs a living foe");
      return { ok: false, reason: "no_foe" };
    }
    if (!window.CBEffects.spawnSocialCredit) {
      console.error("[China] spawnSocialCredit missing");
      return { ok: false, reason: "no_ult" };
    }
    const killDmg = Math.max(foe.hp, foe.maxHp || 100) + 50;
    window.CBEffects.spawnSocialCredit({
      follow: foe,
      img: socialImg,
      ownerId: player.id,
      damage: killDmg,
      life: 1.65,
      executeAt: 0.55,
    });
    if (window.CBCamera) {
      window.CBCamera.focusOn(foe.x, foe.y, 1.7, 1.2);
      window.CBCamera.addShake(0.85);
    }
    console.log("[China] SOCIAL CREDIT DOWN — execute");
    return { ok: true, finisher: true, lockTime: 0.85 };
  }

  function tryCast(abilityId, player, cooldowns, opts) {
    const def = defs[abilityId];
    if (!def) return { ok: false, reason: "unknown" };
    const options = opts || {};
    const cd = cooldowns[abilityId] || 0;
    if (cd > 0 && abilityId !== "eagleStrike") {
      console.log("[China] " + def.name + " on cooldown (" + cd.toFixed(2) + "s)");
      return { ok: false, reason: "cooldown" };
    }
    // Plant respects CD; detonate always allowed
    if (abilityId === "eagleStrike" && cd > 0) {
      const mine =
        window.CBEffects && CBEffects.getDumplingMine
          ? CBEffects.getDumplingMine(player.id)
          : null;
      if (!mine) {
        console.log("[China] Dumpling C4 on cooldown (" + cd.toFixed(2) + "s)");
        return { ok: false, reason: "cooldown" };
      }
    }
    if (abilityId === "starsBarrage") {
      const ult = options.ultCharge || 0;
      if (ult < def.ultCost) {
        console.log(
          "[China] Ultimate not charged (" + ult.toFixed(0) + "/" + def.ultCost + ")"
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
      if (!result.noCooldown) {
        cooldowns[abilityId] = def.cooldown;
      }
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
      img: brushFor(player),
      w: BRUSH.w,
      h: BRUSH.h,
      pivotX: BRUSH.pivotX,
      pivotY: BRUSH.pivotY,
      muzzleLocalX: BRUSH.tipX,
      muzzleLocalY: BRUSH.tipY,
      handDist: BRUSH.handDist,
      plungeDamage: 24,
    };
  }

  return {
    name: "China",
    spritePath: "assets/china.png",
    brushPath: "assets/calligraphy.png",
    dumplingPath: "assets/dumpling.webp",
    socialPath: "assets/social_credit.gif",
    hudSpecial: "E Dumpling C4",
    /** Harder ult fill vs default (game.js reads these). */
    ultPassive: 1.05,
    ultPerDamage: 0.55,
    defs: defs,
    tryCast: tryCast,
    tickEagleTrail: tickEagleTrail,
    tickChargeHold: tickChargeHold,
    aimVec: aimVec,
    getMeleeWeapon: getMeleeWeapon,
    getDumplingImage: function () {
      return dumplingImg;
    },
    getBrushImage: function () {
      return brushImg;
    },
    getSocialImage: function () {
      return socialImg;
    },
  };
})();
