/**
 * AI opponents: Easy, Medium, Hard.
 * Each has ranged shots + one melee weapon (no charged / no ult).
 * Easy = Absolut · Medium = Deagle · Hard = Katana
 */
window.CBEnemyWeapons = (function () {
  let absolutImg = null;
  let deagleImg = null;
  let katanaImg = null;

  function load(path, label) {
    const img = new Image();
    img.onload = function () {
      console.log("[CBEnemyWeapons] " + label + " loaded");
    };
    img.onerror = function () {
      console.error("[CBEnemyWeapons] failed " + path);
    };
    img.src = path;
    return img;
  }

  function ensure() {
    if (!absolutImg) absolutImg = load("assets/absolut.png", "Absolut");
    if (!deagleImg) deagleImg = load("assets/deagle.png", "Deagle");
    if (!katanaImg) katanaImg = load("assets/katana.png", "Katana");
  }
  ensure();

  const LOADOUT = {
    easy: {
      id: "absolut",
      range: 100,
      cooldown: 1.35,
      damage: 12,
      img: function () {
        return absolutImg;
      },
      bash: function (ent, player) {
        window.CBEffects.spawnDeagleBash({
          follow: ent,
          img: absolutImg,
          w: 36,
          h: 62,
          pivotX: 18,
          pivotY: 50,
          muzzleLocalX: 18,
          muzzleLocalY: 6,
          aimX: player.x,
          aimY: player.y,
          damage: 12,
          hitRadius: 36,
          reach: ent.radius + 72,
          knockback: 120,
          ownerId: ent.id,
          handDist: 0.55,
          life: 0.32,
          swingFrom: -1.15,
          swingTo: 0.5,
        });
      },
    },
    medium: {
      id: "deagle",
      range: 95,
      cooldown: 0.95,
      damage: 16,
      img: function () {
        return deagleImg;
      },
      bash: function (ent, player) {
        window.CBEffects.spawnDeagleBash({
          follow: ent,
          img: deagleImg,
          w: 58,
          h: 32,
          pivotX: 20,
          pivotY: 18,
          muzzleLocalX: 54,
          muzzleLocalY: 13,
          aimX: player.x,
          aimY: player.y,
          damage: 16,
          hitRadius: 36,
          reach: ent.radius + 70,
          knockback: 150,
          ownerId: ent.id,
          handDist: 0.52,
          life: 0.26,
          swingFrom: -1.35,
          swingTo: 0.3,
        });
      },
    },
    hard: {
      id: "katana",
      range: 110,
      cooldown: 0.7,
      damage: 20,
      img: function () {
        return katanaImg;
      },
      bash: function (ent, player) {
        window.CBEffects.spawnKatanaStrike({
          follow: ent,
          img: katanaImg,
          w: 72,
          h: 68,
          pivotX: 56,
          pivotY: 16,
          tipLocalX: 10,
          tipLocalY: 56,
          rotOffset: Math.PI,
          aimX: player.x,
          aimY: player.y,
          damage: 20,
          hitRadius: 40,
          reach: ent.radius + 82,
          knockback: 170,
          ownerId: ent.id,
          handDist: 0.48,
          life: 0.26,
          swingFrom: -1.5,
          swingTo: 0.4,
        });
      },
    },
  };

  function loadoutFor(ent) {
    const d = (ent && ent.difficulty) || "easy";
    return LOADOUT[d] || LOADOUT.easy;
  }

  /** Returns true if a melee swing was started. */
  function tryMelee(ent, player) {
    if (!ent || !player || !window.CBEffects) return false;
    if ((ent.meleeTimer || 0) > 0) return false;
    const load = loadoutFor(ent);
    const dist = Math.hypot(player.x - ent.x, player.y - ent.y);
    if (dist > load.range) return false;

    ent.aimX = player.x;
    ent.aimY = player.y;
    load.bash(ent, player);
    ent.meleeTimer = load.cooldown;
    console.log(
      "[CBEnemyWeapons] " +
        ((ent.difficulty || "easy") + " melee " + load.id + " dmg=" + load.damage)
    );
    return true;
  }

  function tick(ent, dt) {
    if (!ent) return;
    if (ent.meleeTimer > 0) ent.meleeTimer = Math.max(0, ent.meleeTimer - dt);
  }

  /** Idle weapon held at the side (hidden while swinging via effect). */
  function drawIdle(ctx, ent) {
    if (!ent || ent.hp <= 0) return;
    // Skip idle draw if a swing effect is following this enemy
    if (window.CBEffects && window.CBEffects.list) {
      for (let i = 0; i < window.CBEffects.list.length; i++) {
        const e = window.CBEffects.list[i];
        if (
          e.follow === ent &&
          (e.type === "deagleBash" || e.type === "katanaStrike")
        ) {
          return;
        }
      }
    }
    const load = loadoutFor(ent);
    const img = load.img();
    if (!img || !img.complete || !img.naturalWidth) return;

    const fx = ent.facing >= 0 ? 1 : -1;
    const hx = ent.x + fx * ent.radius * 0.55;
    const hy = ent.y + ent.radius * 0.05;

    ctx.save();
    ctx.translate(hx, hy);
    if (load.id === "katana") {
      ctx.rotate(fx >= 0 ? -0.4 + Math.PI : 0.4);
      const w = 52;
      const h = 49;
      ctx.drawImage(img, -w * 0.78, -h * 0.24, w, h);
    } else if (load.id === "absolut") {
      ctx.rotate(fx >= 0 ? 0.35 : Math.PI - 0.35);
      ctx.drawImage(img, -12, -40, 24, 48);
    } else {
      ctx.rotate(fx >= 0 ? 0.15 : Math.PI - 0.15);
      ctx.drawImage(img, -8, -12, 48, 26);
    }
    ctx.restore();
  }

  return { ensure, tryMelee, tick, drawIdle, loadoutFor };
})();

window.CBEasyEnemy = (function () {
  const MOVE_SPEED = 95;
  const PREFERRED_DIST = 200;
  const SHOT_CD_MIN = 1.35;
  const SHOT_CD_MAX = 2.0;
  const PROJECTILE_SPEED = 240;
  const PROJECTILE_DAMAGE = 8;
  const MELEE_APPROACH = 95;

  function create() {
    return {
      id: "enemy",
      difficulty: "easy",
      x: 720,
      y: 335,
      radius: 40,
      facing: -1,
      hp: 80,
      maxHp: 80,
      flash: 0,
      shootTimer: 1.2,
      meleeTimer: 0.6,
      strafeDir: 1,
      strafeTimer: 1.5,
      thinkTimer: 0,
      burstLeft: 0,
      stunTimer: 0,
      aimX: 0,
      aimY: 0,
    };
  }

  function clamp(ent, W, H) {
    const groundY = H * 0.72;
    const minY = ent.radius + 20;
    const maxY = groundY - 8;
    ent.x = Math.max(ent.radius, Math.min(W - ent.radius, ent.x));
    ent.y = Math.max(minY, Math.min(maxY, ent.y));
  }

  function update(ent, player, dt, W, H) {
    if (!ent || ent.hp <= 0) return;
    window.CBEnemyWeapons.ensure();

    if (ent.flash > 0) ent.flash = Math.max(0, ent.flash - dt);
    window.CBEnemyWeapons.tick(ent, dt);
    if (ent.stunTimer > 0) {
      ent.stunTimer = Math.max(0, ent.stunTimer - dt);
      return;
    }

    const dx = player.x - ent.x;
    const dy = player.y - ent.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    ent.facing = dx >= 0 ? 1 : -1;
    ent.aimX = player.x;
    ent.aimY = player.y;

    ent.strafeTimer -= dt;
    if (ent.strafeTimer <= 0) {
      ent.strafeDir *= -1;
      ent.strafeTimer = 1.2 + Math.random() * 1.4;
    }

    let mx = 0;
    let my = 0;
    // Close in for Absolut bash when nearby
    if (dist > PREFERRED_DIST + 40) {
      mx = nx;
      my = ny;
    } else if (dist < MELEE_APPROACH) {
      mx = nx * 0.35;
      my = ny * 0.35;
    } else if (dist < PREFERRED_DIST - 50) {
      mx = -nx;
      my = -ny;
    } else {
      mx = -ny * ent.strafeDir;
      my = nx * ent.strafeDir;
    }

    const len = Math.hypot(mx, my) || 1;
    ent.x += (mx / len) * MOVE_SPEED * dt;
    ent.y += (my / len) * MOVE_SPEED * dt;
    clamp(ent, W, H);

    if (window.CBEnemyWeapons.tryMelee(ent, player)) {
      ent.shootTimer = Math.max(ent.shootTimer, 0.45);
      return;
    }

    ent.shootTimer -= dt;
    if (ent.shootTimer <= 0 && dist < 520 && dist > MELEE_APPROACH * 0.85) {
      ent.shootTimer = SHOT_CD_MIN + Math.random() * (SHOT_CD_MAX - SHOT_CD_MIN);
      const muzzleX = ent.x + nx * (ent.radius + 6);
      const muzzleY = ent.y + ny * (ent.radius + 6);
      const jitter = (Math.random() - 0.5) * 0.18;
      const ang = Math.atan2(ny, nx) + jitter;
      window.CBEffects.spawnProjectile(muzzleX, muzzleY, {
        vx: Math.cos(ang) * PROJECTILE_SPEED,
        vy: Math.sin(ang) * PROJECTILE_SPEED,
        life: 2.2,
        radius: 9,
        colors: ["#c62828", "#ff8a80", "#4a0000"],
        damage: PROJECTILE_DAMAGE,
        ownerId: ent.id,
      });
      window.CBEffects.spawnBurst(muzzleX, muzzleY, 6, ["#c62828", "#fff"]);
      console.log("[CBEasyEnemy] shot at player");
    }
  }

  function draw(ctx, ent) {
    if (!ent) return;
    ctx.beginPath();
    ctx.arc(ent.x, ent.y, ent.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#8b1e1e";
    ctx.fill();
    ctx.fillStyle = "#f7d354";
    ctx.beginPath();
    ctx.arc(ent.x - 10 * ent.facing, ent.y - 8, 5, 0, Math.PI * 2);
    ctx.arc(ent.x + 8 * ent.facing, ent.y - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(ent.x - 10 * ent.facing, ent.y - 8, 2.2, 0, Math.PI * 2);
    ctx.arc(ent.x + 8 * ent.facing, ent.y - 8, 2.2, 0, Math.PI * 2);
    ctx.fill();
    window.CBEnemyWeapons.drawIdle(ctx, ent);
    if (ent.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, ent.flash * 4)})`;
      ctx.beginPath();
      ctx.arc(ent.x, ent.y, ent.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { create, update, draw };
})();

window.CBMediumEnemy = (function () {
  const MOVE_SPEED = 160;
  const PREFERRED_DIST = 165;
  const SHOT_CD_MIN = 0.7;
  const SHOT_CD_MAX = 1.15;
  const PROJECTILE_SPEED = 390;
  const PROJECTILE_DAMAGE = 12;
  const BURST_GAP = 0.14;
  const MELEE_APPROACH = 90;

  function create() {
    return {
      id: "enemy",
      difficulty: "medium",
      x: 720,
      y: 335,
      radius: 40,
      facing: -1,
      hp: 110,
      maxHp: 110,
      flash: 0,
      shootTimer: 0.85,
      meleeTimer: 0.4,
      strafeDir: 1,
      strafeTimer: 0.9,
      burstLeft: 0,
      burstTimer: 0,
      stunTimer: 0,
      aimX: 0,
      aimY: 0,
    };
  }

  function clamp(ent, W, H) {
    const groundY = H * 0.72;
    const minY = ent.radius + 20;
    const maxY = groundY - 8;
    ent.x = Math.max(ent.radius, Math.min(W - ent.radius, ent.x));
    ent.y = Math.max(minY, Math.min(maxY, ent.y));
  }

  function fireShot(ent, player) {
    const dx = player.x - ent.x;
    const dy = player.y - ent.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const muzzleX = ent.x + nx * (ent.radius + 6);
    const muzzleY = ent.y + ny * (ent.radius + 6);
    const lead = 0.12;
    const lx = nx + (player.facing || 0) * lead * 0.15;
    const ly = ny;
    const len = Math.hypot(lx, ly) || 1;
    const jitter = (Math.random() - 0.5) * 0.06;
    const ang = Math.atan2(ly / len, lx / len) + jitter;
    window.CBEffects.spawnProjectile(muzzleX, muzzleY, {
      vx: Math.cos(ang) * PROJECTILE_SPEED,
      vy: Math.sin(ang) * PROJECTILE_SPEED,
      life: 2.0,
      radius: 10,
      colors: ["#ef6c00", "#ffcc80", "#bf360c"],
      damage: PROJECTILE_DAMAGE,
      ownerId: ent.id,
    });
    window.CBEffects.spawnBurst(muzzleX, muzzleY, 8, ["#ef6c00", "#fff"]);
  }

  function update(ent, player, dt, W, H) {
    if (!ent || ent.hp <= 0) return;
    window.CBEnemyWeapons.ensure();

    if (ent.flash > 0) ent.flash = Math.max(0, ent.flash - dt);
    window.CBEnemyWeapons.tick(ent, dt);
    if (ent.stunTimer > 0) {
      ent.stunTimer = Math.max(0, ent.stunTimer - dt);
      return;
    }

    const dx = player.x - ent.x;
    const dy = player.y - ent.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    ent.facing = dx >= 0 ? 1 : -1;
    ent.aimX = player.x;
    ent.aimY = player.y;

    ent.strafeTimer -= dt;
    if (ent.strafeTimer <= 0) {
      ent.strafeDir *= -1;
      ent.strafeTimer = 0.7 + Math.random() * 0.9;
    }

    let mx = 0;
    let my = 0;
    if (dist > PREFERRED_DIST + 35) {
      mx = nx;
      my = ny;
    } else if (dist < MELEE_APPROACH) {
      mx = nx * 0.5;
      my = ny * 0.5;
    } else if (dist < PREFERRED_DIST - 40) {
      mx = -nx * 1.1;
      my = -ny * 1.1;
    } else {
      mx = -ny * ent.strafeDir * 1.15;
      my = nx * ent.strafeDir * 1.15;
    }

    const len = Math.hypot(mx, my) || 1;
    ent.x += (mx / len) * MOVE_SPEED * dt;
    ent.y += (my / len) * MOVE_SPEED * dt;
    clamp(ent, W, H);

    if (window.CBEnemyWeapons.tryMelee(ent, player)) {
      ent.burstLeft = 0;
      ent.shootTimer = Math.max(ent.shootTimer, 0.35);
      return;
    }

    if (ent.burstLeft > 0) {
      ent.burstTimer -= dt;
      if (ent.burstTimer <= 0) {
        fireShot(ent, player);
        ent.burstLeft -= 1;
        ent.burstTimer = BURST_GAP;
        console.log("[CBMediumEnemy] burst shot");
      }
      return;
    }

    ent.shootTimer -= dt;
    if (ent.shootTimer <= 0 && dist < 560 && dist > MELEE_APPROACH * 0.8) {
      ent.shootTimer = SHOT_CD_MIN + Math.random() * (SHOT_CD_MAX - SHOT_CD_MIN);
      fireShot(ent, player);
      if (Math.random() < 0.4) {
        ent.burstLeft = 1;
        ent.burstTimer = BURST_GAP;
      }
      console.log("[CBMediumEnemy] shot at player");
    }
  }

  function draw(ctx, ent) {
    if (!ent) return;
    ctx.beginPath();
    ctx.arc(ent.x, ent.y, ent.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#c62828";
    ctx.fill();
    ctx.strokeStyle = "#ef6c00";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ent.x, ent.y, ent.radius - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffe082";
    ctx.beginPath();
    ctx.arc(ent.x - 10 * ent.facing, ent.y - 8, 5, 0, Math.PI * 2);
    ctx.arc(ent.x + 8 * ent.facing, ent.y - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(ent.x - 10 * ent.facing, ent.y - 8, 2.4, 0, Math.PI * 2);
    ctx.arc(ent.x + 8 * ent.facing, ent.y - 8, 2.4, 0, Math.PI * 2);
    ctx.fill();
    window.CBEnemyWeapons.drawIdle(ctx, ent);
    if (ent.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, ent.flash * 4)})`;
      ctx.beginPath();
      ctx.arc(ent.x, ent.y, ent.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { create, update, draw };
})();

window.CBHardEnemy = (function () {
  const MOVE_SPEED = 215;
  const PREFERRED_DIST = 140;
  const SHOT_CD_MIN = 0.42;
  const SHOT_CD_MAX = 0.72;
  const PROJECTILE_SPEED = 480;
  const PROJECTILE_DAMAGE = 15;
  const BURST_GAP = 0.1;
  const MELEE_APPROACH = 100;

  function create() {
    return {
      id: "enemy",
      difficulty: "hard",
      x: 720,
      y: 335,
      radius: 40,
      facing: -1,
      hp: 145,
      maxHp: 145,
      flash: 0,
      shootTimer: 0.55,
      meleeTimer: 0.25,
      strafeDir: 1,
      strafeTimer: 0.55,
      burstLeft: 0,
      burstTimer: 0,
      stunTimer: 0,
      dashTimer: 0,
      dashVx: 0,
      dashVy: 0,
      aimX: 0,
      aimY: 0,
    };
  }

  function clamp(ent, W, H) {
    const groundY = H * 0.72;
    const minY = ent.radius + 20;
    const maxY = groundY - 8;
    ent.x = Math.max(ent.radius, Math.min(W - ent.radius, ent.x));
    ent.y = Math.max(minY, Math.min(maxY, ent.y));
  }

  function fireShot(ent, player, angOffset) {
    const dx = player.x - ent.x;
    const dy = player.y - ent.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const muzzleX = ent.x + nx * (ent.radius + 6);
    const muzzleY = ent.y + ny * (ent.radius + 6);
    const lead = 0.28;
    let lx = nx + (player.facing || 0) * lead * 0.35;
    let ly = ny;
    const len = Math.hypot(lx, ly) || 1;
    lx /= len;
    ly /= len;
    const jitter = (Math.random() - 0.5) * 0.025;
    const ang = Math.atan2(ly, lx) + jitter + (angOffset || 0);
    window.CBEffects.spawnProjectile(muzzleX, muzzleY, {
      vx: Math.cos(ang) * PROJECTILE_SPEED,
      vy: Math.sin(ang) * PROJECTILE_SPEED,
      life: 1.85,
      radius: 11,
      colors: ["#6a1b9a", "#e040fb", "#1a001a"],
      damage: PROJECTILE_DAMAGE,
      ownerId: ent.id,
    });
    window.CBEffects.spawnBurst(muzzleX, muzzleY, 7, ["#6a1b9a", "#fff"]);
  }

  function update(ent, player, dt, W, H) {
    if (!ent || ent.hp <= 0) return;
    window.CBEnemyWeapons.ensure();

    if (ent.flash > 0) ent.flash = Math.max(0, ent.flash - dt);
    window.CBEnemyWeapons.tick(ent, dt);
    if (ent.stunTimer > 0) {
      ent.stunTimer = Math.max(0, ent.stunTimer - dt);
      return;
    }

    const dx = player.x - ent.x;
    const dy = player.y - ent.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    ent.facing = dx >= 0 ? 1 : -1;
    ent.aimX = player.x;
    ent.aimY = player.y;

    if (ent.dashTimer > 0) {
      ent.dashTimer -= dt;
      ent.x += ent.dashVx * dt;
      ent.y += ent.dashVy * dt;
      clamp(ent, W, H);
    } else {
      ent.strafeTimer -= dt;
      if (ent.strafeTimer <= 0) {
        ent.strafeDir *= -1;
        ent.strafeTimer = 0.45 + Math.random() * 0.55;
        if (Math.random() < 0.35) {
          ent.dashTimer = 0.18;
          ent.dashVx = -ny * ent.strafeDir * 520;
          ent.dashVy = nx * ent.strafeDir * 520;
        }
      }

      let mx = 0;
      let my = 0;
      if (dist > PREFERRED_DIST + 30) {
        mx = nx * 1.15;
        my = ny * 1.15;
      } else if (dist < MELEE_APPROACH) {
        mx = nx * 0.85;
        my = ny * 0.85;
      } else if (dist < PREFERRED_DIST - 35) {
        mx = -nx * 1.25;
        my = -ny * 1.25;
      } else {
        mx = -ny * ent.strafeDir * 1.35;
        my = nx * ent.strafeDir * 1.35;
      }

      const len = Math.hypot(mx, my) || 1;
      ent.x += (mx / len) * MOVE_SPEED * dt;
      ent.y += (my / len) * MOVE_SPEED * dt;
      clamp(ent, W, H);
    }

    if (window.CBEnemyWeapons.tryMelee(ent, player)) {
      ent.burstLeft = 0;
      ent.shootTimer = Math.max(ent.shootTimer, 0.25);
      return;
    }

    if (ent.burstLeft > 0) {
      ent.burstTimer -= dt;
      if (ent.burstTimer <= 0) {
        fireShot(ent, player, 0);
        ent.burstLeft -= 1;
        ent.burstTimer = BURST_GAP;
        console.log("[CBHardEnemy] burst shot");
      }
      return;
    }

    ent.shootTimer -= dt;
    if (ent.shootTimer <= 0 && dist < 620 && dist > MELEE_APPROACH * 0.75) {
      ent.shootTimer = SHOT_CD_MIN + Math.random() * (SHOT_CD_MAX - SHOT_CD_MIN);
      if (Math.random() < 0.25) {
        fireShot(ent, player, -0.14);
        fireShot(ent, player, 0);
        fireShot(ent, player, 0.14);
        console.log("[CBHardEnemy] fan shot");
      } else {
        fireShot(ent, player, 0);
        if (Math.random() < 0.55) {
          ent.burstLeft = 2;
          ent.burstTimer = BURST_GAP;
        }
        console.log("[CBHardEnemy] shot at player");
      }
    }
  }

  function draw(ctx, ent) {
    if (!ent) return;
    ctx.beginPath();
    ctx.arc(ent.x, ent.y, ent.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#4a148c";
    ctx.fill();
    ctx.strokeStyle = "#e040fb";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(ent.x, ent.y, ent.radius - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#f3e5f5";
    ctx.beginPath();
    ctx.arc(ent.x - 10 * ent.facing, ent.y - 8, 5, 0, Math.PI * 2);
    ctx.arc(ent.x + 8 * ent.facing, ent.y - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(ent.x - 10 * ent.facing, ent.y - 8, 2.5, 0, Math.PI * 2);
    ctx.arc(ent.x + 8 * ent.facing, ent.y - 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    window.CBEnemyWeapons.drawIdle(ctx, ent);
    if (ent.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, ent.flash * 4)})`;
      ctx.beginPath();
      ctx.arc(ent.x, ent.y, ent.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { create, update, draw };
})();
