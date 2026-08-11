window.CBGame = (function () {
  const W = 960;
  const H = 540;
  const MOVE_SPEED = 260;
  const GRAVITY = 1650;
  const JUMP_VY = -560;
  const PLUNGE_VY = 980;
  const PLUNGE_HIT_RADIUS = 58;
  const HOLD_TAP_MAX = 0.22;
  const HOLD_FULL = 1.05;
  const ULT_MAX = 100;
  const ULT_PASSIVE = 3.5;
  const ULT_PER_DAMAGE = 1.8;

  let canvas = null;
  let ctx = null;
  let running = false;
  let rafId = 0;
  let lastTs = 0;
  let timeSec = 0;
  let usaImg = null;
  let japanImg = null;
  let russiaImg = null;
  let fighterImg = null;
  let onExitToMenu = null;
  let onMatchEnd = null;
  let matchConfig = {
    matchType: "quick",
    opponent: "dummy",
    mapId: "plains",
    lives: null,
    fighter: "usa",
  };
  let abilityLock = 0;
  let speedBuff = null; // { mult, timer }
  let map = null;
  let playerLives = null; // null = unlimited
  let foeLives = null;
  let matchOver = false;

  const keys = Object.create(null);

  let player = null;
  let dummy = null;
  let enemy = null;
  let cooldowns = null;
  let dashTimer = 0;
  let dashVx = 0;
  let dashVy = 0;
  let invulnTimer = 0;
  let ultCharge = 0;
  let statusMsg = "";
  let statusTimer = 0;
  let respawnEvent = null;
  let ultCamFollowUp = null;
  let sloMo = null;

  let mouse = { x: W * 0.7, y: H * 0.5, down: false };
  let holdTime = 0;
  let holdingAttack = false;
  let plungeFx = null;

  function normalizeConfig(cfg) {
    const c = cfg || {};
    const opponent =
      c.opponent === "hard"
        ? "hard"
        : c.opponent === "medium"
          ? "medium"
          : c.opponent === "easy"
            ? "easy"
            : "dummy";
    const mapId = c.mapId === "icy" ? "icy" : "plains";
    const matchType = c.matchType === "custom" ? "custom" : "quick";
    const fighter =
      c.fighter === "japan"
        ? "japan"
        : c.fighter === "russia"
          ? "russia"
          : "usa";
    let lives = null;
    if (matchType === "custom") {
      lives = Math.max(1, Math.min(100, Math.floor(c.lives || 3)));
    }
    return { matchType, opponent, mapId, lives, fighter };
  }

  function isBotOpponent() {
    return (
      matchConfig.opponent === "easy" ||
      matchConfig.opponent === "medium" ||
      matchConfig.opponent === "hard"
    );
  }

  function enemyApi() {
    if (matchConfig.opponent === "hard" && window.CBHardEnemy) {
      return window.CBHardEnemy;
    }
    if (matchConfig.opponent === "medium" && window.CBMediumEnemy) {
      return window.CBMediumEnemy;
    }
    return window.CBEasyEnemy;
  }

  function enemyHudLabel() {
    if (matchConfig.opponent === "hard") return "Hard Bot";
    if (matchConfig.opponent === "medium") return "Medium Bot";
    return "Easy Bot";
  }

  function abilities() {
    if (matchConfig.fighter === "japan" && window.CBJapanAbilities) {
      return window.CBJapanAbilities;
    }
    if (matchConfig.fighter === "russia" && window.CBRussiaAbilities) {
      return window.CBRussiaAbilities;
    }
    return window.CBUsaAbilities;
  }

  function fighterLabel() {
    return abilities().name || "USA";
  }

  function pickFighterImg() {
    if (matchConfig.fighter === "japan") return japanImg;
    if (matchConfig.fighter === "russia") return russiaImg;
    return usaImg;
  }

  function resetState() {
    map = window.CBMaps ? window.CBMaps.get(matchConfig.mapId) : { groundY: H * 0.72, platforms: [] };
    const spawnY = (map.groundY || H * 0.72) - 6;

    fighterImg = pickFighterImg();
    player = {
      id:
        matchConfig.fighter === "japan"
          ? "japan"
          : matchConfig.fighter === "russia"
            ? "russia"
            : "usa",
      x: W * 0.22,
      y: spawnY,
      radius: matchConfig.fighter === "russia" ? 50 : 42,
      facing: 1,
      hp: 100,
      maxHp: 100,
      flash: 0,
      aimX: W * 0.7,
      aimY: H * 0.5,
      invuln: false,
      vy: 0,
      grounded: true,
      plunging: false,
    };
    plungeFx = null;
    abilityLock = 0;
    speedBuff = null;
    dummy = null;
    enemy = null;
    if (matchConfig.opponent === "dummy") {
      dummy = {
        id: "dummy",
        x: W * 0.72,
        y: spawnY,
        radius: 38,
        hp: 100,
        maxHp: 100,
        flash: 0,
        vy: 0,
        grounded: true,
      };
    } else {
      enemy = enemyApi().create();
      enemy.y = spawnY;
    }

    // Equal lives only — never uneven
    if (matchConfig.lives != null) {
      playerLives = matchConfig.lives;
      foeLives = matchConfig.lives;
    } else {
      playerLives = null;
      foeLives = null;
    }
    matchOver = false;

    cooldowns = {
      freedomBlast: 0,
      chargedBlast: 0,
      eagleStrike: 0,
      starsBarrage: 0,
    };
    dashTimer = 0;
    dashVx = 0;
    dashVy = 0;
    invulnTimer = 0;
    ultCharge = 0;
    holdTime = 0;
    holdingAttack = false;
    mouse.down = false;
    timeSec = 0;
    respawnEvent = null;
    ultCamFollowUp = null;
    sloMo = null;
    const mapName = map.name || matchConfig.mapId;
    statusMsg =
      (matchConfig.matchType === "custom" ? "Custom" : "Quick") +
      " · " +
      mapName +
      (playerLives != null ? " · " + playerLives + " lives" : "");
    statusTimer = 1.8;
    if (window.CBCamera) window.CBCamera.reset(W, H);
    if (window.CBEffects) window.CBEffects.clear();
    if (window.CBAllies) window.CBAllies.clear();
  }

  function foe() {
    return isBotOpponent() ? enemy : dummy;
  }

  function foeHp() {
    const t = foe();
    return t && t.hp > 0 ? t.hp : 0;
  }

  function startFinisherSloMo(label) {
    sloMo = { scale: 0.22, endReal: null };
    statusMsg = "FINISHING BLOW";
    statusTimer = 2.5;
    if (window.CBCamera) window.CBCamera.addShake(0.3);
    console.log("[CBGame] Finisher slo-mo start", label || "");
  }

  function clearFinisherSloMo() {
    if (!sloMo) return;
    sloMo = null;
    if (window.CBCamera) window.CBCamera.clearStrikeFollow();
    console.log("[CBGame] Finisher slo-mo end");
  }

  function castOpts(extra) {
    const o = Object.assign({ foeHp: foeHp(), foe: foe() }, extra || {});
    return o;
  }

  function applyCastExtras(result) {
    if (!result || !result.ok) return;
    if (result.lockTime) {
      abilityLock = Math.max(abilityLock, result.lockTime);
    }
    if (result.invulnTime) {
      invulnTimer = Math.max(invulnTimer, result.invulnTime);
    }
    if (result.speedMult && result.buffTime) {
      speedBuff = {
        mult: result.speedMult,
        timer: result.buffTime,
      };
      statusMsg = "Absolut rush!";
      statusTimer = 1.2;
      console.log(
        "[CBGame] speed buff ×" + result.speedMult + " for " + result.buffTime + "s"
      );
    }
  }

  function noteCastResult(result, label) {
    if (!result || !result.ok || !result.finisher) return;
    if (foeHp() <= 0) return;
    startFinisherSloMo(label);
  }

  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const sy = ((e.clientY - rect.top) / rect.height) * canvas.height;
    if (window.CBCamera) {
      return window.CBCamera.screenToWorld(sx, sy, W, H);
    }
    return { x: sx, y: sy };
  }

  function updateAimFromMouse() {
    player.aimX = mouse.x;
    player.aimY = mouse.y;
    const dx = mouse.x - player.x;
    if (Math.abs(dx) > 6) player.facing = dx > 0 ? 1 : -1;
  }

  function clampEntity(ent) {
    if (window.CBMaps && map) {
      window.CBMaps.resolveEntity(ent, map, W, H);
    } else {
      const groundY = H * 0.72;
      const minY = ent.radius + 20;
      const maxY = groundY - 8;
      ent.x = Math.max(ent.radius, Math.min(W - ent.radius, ent.x));
      ent.y = Math.max(minY, Math.min(maxY, ent.y));
    }
  }

  function floorY() {
    const groundY = map && map.groundY != null ? map.groundY : H * 0.72;
    return groundY - 6;
  }

  function clearPlungeFx() {
    if (plungeFx) {
      plungeFx.life = 0;
      plungeFx = null;
    }
  }

  function startPlunge() {
    if (!player || player.plunging || player.grounded) return false;
    const cinema = window.CBEffects && window.CBEffects.getCinema
      ? window.CBEffects.getCinema()
      : null;
    if (abilityLock > 0 || (cinema && cinema.lockControl)) return false;

    holdingAttack = false;
    holdTime = 0;
    mouse.down = false;

    const wpn =
      typeof abilities().getMeleeWeapon === "function"
        ? abilities().getMeleeWeapon()
        : null;
    if (!wpn || !window.CBEffects || !window.CBEffects.spawnPlungeAttack) {
      console.warn("[CBGame] plunge weapon missing");
      return false;
    }

    player.plunging = true;
    player.vy = PLUNGE_VY;
    clearPlungeFx();
    plungeFx = window.CBEffects.spawnPlungeAttack({
      follow: player,
      img: wpn.img,
      w: wpn.w,
      h: wpn.h,
      pivotX: wpn.pivotX,
      pivotY: wpn.pivotY,
      muzzleLocalX: wpn.muzzleLocalX,
      muzzleLocalY: wpn.muzzleLocalY,
      handDist: wpn.handDist ?? 0.48,
      life: 2.5,
    });
    cooldowns.freedomBlast = Math.max(cooldowns.freedomBlast || 0, 0.35);
    statusMsg = "Plunge!";
    statusTimer = 0.6;
    console.log("[CBGame] plunge start");
    return true;
  }

  function plungeImpact() {
    if (!player || !player.plunging) return;
    player.plunging = false;
    clearPlungeFx();

    const wpn =
      typeof abilities().getMeleeWeapon === "function"
        ? abilities().getMeleeWeapon()
        : {};
    const dmg = wpn.plungeDamage || 22;
    const target = foe();
    const hitY = player.y + player.radius * 0.35;

    if (window.CBEffects) {
      window.CBEffects.spawnBurst(player.x, hitY, 18, [
        "#ffffff",
        "#f7d354",
        "#b22234",
      ]);
      window.CBEffects.spawnParticle(player.x, hitY, {
        vx: 0,
        vy: -80,
        life: 0.25,
        size: 8,
        color: "#ffffff",
      });
    }
    if (window.CBCamera) window.CBCamera.addShake(0.35);

    if (target && target.hp > 0) {
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.hypot(dx, dy);
      const reach = PLUNGE_HIT_RADIUS + (target.radius || 30);
      if (dist < reach) {
        const finisher = dmg >= target.hp;
        target.hp = Math.max(0, target.hp - dmg);
        target.flash = 0.25;
        const nx = dist > 1 ? dx / dist : player.facing || 1;
        target.x += nx * 28;
        if (target.vy != null) target.vy = -260;
        else target.y -= 18;
        if (window.CBMaps && map) {
          window.CBMaps.resolveEntity(target, map, W, H);
        } else {
          clampEntity(target);
        }
        console.log(
          "[CBGame] plunge hit dmg=" + dmg + " foeHp=" + target.hp
        );
        if (finisher) startFinisherSloMo("plunge");
      } else {
        console.log("[CBGame] plunge miss dist=" + dist.toFixed(0));
      }
    }
  }

  function tryJump() {
    if (!player || !player.grounded || player.plunging) return;
    const cinema = window.CBEffects && window.CBEffects.getCinema
      ? window.CBEffects.getCinema()
      : null;
    if (abilityLock > 0 || (cinema && cinema.lockControl)) return;
    player.vy = JUMP_VY;
    player.grounded = false;
    console.log("[CBGame] jump");
  }

  function applyPlayerPhysics(dt) {
    if (!player) return;
    const r = player.radius;
    const minY = r + 16;
    const floor = floorY();

    if (player.plunging) {
      player.vy = PLUNGE_VY;
    } else {
      player.vy += GRAVITY * dt;
    }

    player.y += player.vy * dt;
    player.x = Math.max(r, Math.min(W - r, player.x));

    if (player.y < minY) {
      player.y = minY;
      if (player.vy < 0) player.vy = 0;
    }

    if (player.y >= floor) {
      player.y = floor;
      if (player.plunging) plungeImpact();
      player.vy = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
    }
  }

  function endMatch(won) {
    if (matchOver) return;
    matchOver = true;
    running = false;
    clearFinisherSloMo();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    console.log("[CBGame] match over won=" + won);
    if (typeof onMatchEnd === "function") {
      onMatchEnd({ won: !!won, config: matchConfig });
    }
  }

  function addUlt(amount) {
    ultCharge = Math.min(ULT_MAX, ultCharge + amount);
  }

  function releaseAttack() {
    if (!holdingAttack) return;
    holdingAttack = false;
    const t = holdTime;
    holdTime = 0;

    const cinema = window.CBEffects && window.CBEffects.getCinema
      ? window.CBEffects.getCinema()
      : null;
    if (abilityLock > 0 || (cinema && cinema.lockControl)) return;
    if (player && (player.plunging || !player.grounded)) return;

    updateAimFromMouse();

    if (t < HOLD_TAP_MAX) {
      const result = abilities().tryCast(
        "freedomBlast",
        player,
        cooldowns,
        castOpts()
      );
      applyCastExtras(result);
      noteCastResult(result, "bash");
    } else {
      const charge = Math.min(1, (t - HOLD_TAP_MAX) / (HOLD_FULL - HOLD_TAP_MAX));
      const result = abilities().tryCast(
        "chargedBlast",
        player,
        cooldowns,
        castOpts({ charge: Math.max(0.15, charge) })
      );
      applyCastExtras(result);
      noteCastResult(result, "charged");
    }
  }

  function castSpecial() {
    const cinema = window.CBEffects && window.CBEffects.getCinema
      ? window.CBEffects.getCinema()
      : null;
    if (abilityLock > 0 || (cinema && cinema.lockControl)) return;
    updateAimFromMouse();
    const result = abilities().tryCast(
      "eagleStrike",
      player,
      cooldowns,
      castOpts()
    );
    applyCastExtras(result);
    noteCastResult(result, "special");
    if (result.ok && result.dashTime) {
      dashTimer = result.dashTime;
      dashVx = result.dashVx || 0;
      dashVy = result.dashVy || 0;
      invulnTimer = result.invulnTime || 0;
    }
  }

  function castUltimate() {
    const cinema = window.CBEffects && window.CBEffects.getCinema
      ? window.CBEffects.getCinema()
      : null;
    if (abilityLock > 0 || (cinema && cinema.lockControl)) return;
    updateAimFromMouse();
    const result = abilities().tryCast(
      "starsBarrage",
      player,
      cooldowns,
      castOpts({ ultCharge })
    );
    if (result.ok) {
      ultCharge = 0;
      applyCastExtras(result);
      if (result.finisher) {
        noteCastResult(result, "ult");
      } else if (window.CBCamera) {
        window.CBCamera.focusOn(player.x, player.y, 1.55, 0.75);
        window.CBCamera.addShake(0.45);
        ultCamFollowUp = { timer: 0.7 };
      }
      if (result.cinema && window.CBCamera) {
        window.CBCamera.focusOn(player.x, player.y, 1.7, 1.2);
        window.CBCamera.addShake(0.35);
      }
      console.log("[CBGame] Ultimate spent — charge reset");
    }
  }

  function triggerKoExplosion(kind, x, y) {
    const colors =
      kind === "enemy"
        ? ["#c62828", "#ffca28", "#ffffff", "#bf360c", "#f7d354"]
        : kind === "player"
          ? ["#b22234", "#3c3b6e", "#ffffff", "#f7d354"]
          : ["#888", "#ccc", "#444", "#fff"];
    if (window.CBEffects.spawnExplosion) {
      window.CBEffects.spawnExplosion(x, y, { power: kind === "enemy" ? 1.5 : 1.2, colors });
    } else {
      window.CBEffects.spawnBurst(x, y, 24, colors);
    }
    if (window.CBCamera) {
      window.CBCamera.focusOn(x, y, 1.6, 1.15);
      window.CBCamera.addShake(0.55);
    }
    console.log("[CBGame] KO explosion", kind, Math.round(x), Math.round(y));
  }

  function onKeyDown(e) {
    if (!running) return;
    keys[e.code] = true;

    if (e.code === "Escape") {
      e.preventDefault();
      stop();
      if (typeof onExitToMenu === "function") onExitToMenu();
      return;
    }

    if (e.code === "KeyE") {
      e.preventDefault();
      if (!e.repeat) castSpecial();
    }
    if (e.code === "KeyQ") {
      e.preventDefault();
      if (!e.repeat) castUltimate();
    }
    if (
      (e.code === "Space" || e.code === "KeyW" || e.code === "ArrowUp") &&
      !e.repeat
    ) {
      e.preventDefault();
      tryJump();
    }
  }

  function onKeyUp(e) {
    keys[e.code] = false;
  }

  function onMouseMove(e) {
    if (!canvas) return;
    const p = canvasCoords(e);
    mouse.x = p.x;
    mouse.y = p.y;
    if (running && player) updateAimFromMouse();
  }

  function onMouseDown(e) {
    if (!running || !canvas || e.button !== 0) return;
    if (e.target !== canvas) return;
    e.preventDefault();
    const p = canvasCoords(e);
    mouse.x = p.x;
    mouse.y = p.y;
    updateAimFromMouse();

    if (player && !player.grounded && !player.plunging) {
      if (startPlunge()) return;
    }

    mouse.down = true;
    holdingAttack = true;
    holdTime = 0;
  }

  function onMouseUp(e) {
    if (e.button !== 0) return;
    mouse.down = false;
    if (running && holdingAttack) releaseAttack();
  }

  function onContextMenu(e) {
    if (e.target === canvas) e.preventDefault();
  }

  function update(dt, rawDt) {
    timeSec += dt;
    if (statusTimer > 0) statusTimer = Math.max(0, statusTimer - dt);

    for (const k of Object.keys(cooldowns)) {
      if (cooldowns[k] > 0) cooldowns[k] = Math.max(0, cooldowns[k] - dt);
    }

    if (player.flash > 0) player.flash = Math.max(0, player.flash - dt);
    if (invulnTimer > 0) invulnTimer = Math.max(0, invulnTimer - dt);
    player.invuln = invulnTimer > 0;
    if (abilityLock > 0) abilityLock = Math.max(0, abilityLock - dt);
    if (speedBuff) {
      speedBuff.timer -= dt;
      if (speedBuff.timer <= 0) speedBuff = null;
    }

    const cinema = window.CBEffects && window.CBEffects.getCinema
      ? window.CBEffects.getCinema()
      : null;
    const controlsLocked =
      abilityLock > 0 || (cinema && cinema.lockControl);

    addUlt(ULT_PASSIVE * dt);

    if (holdingAttack && !controlsLocked && player.grounded && !player.plunging) {
      holdTime += dt;
      if (holdTime > HOLD_TAP_MAX) {
        const charge = Math.min(
          1,
          (holdTime - HOLD_TAP_MAX) / (HOLD_FULL - HOLD_TAP_MAX)
        );
        abilities().tickChargeHold(player, charge);
      }
    }

    const moveMult = speedBuff ? speedBuff.mult : 1;

    if (dashTimer > 0) {
      dashTimer -= dt;
      player.x += dashVx * dt;
      player.y += dashVy * dt;
      if (Math.abs(dashVx) > 10) player.facing = dashVx >= 0 ? 1 : -1;
      abilities().tickEagleTrail(player);
      // Dashing overrides gravity briefly — still clamp to arena
      clampEntity(player);
      player.grounded = player.y >= floorY() - 0.5;
      if (player.grounded) player.vy = 0;
    } else if (!controlsLocked) {
      let mx = 0;
      if (keys.KeyA || keys.ArrowLeft) mx -= 1;
      if (keys.KeyD || keys.ArrowRight) mx += 1;
      if (mx !== 0) {
        const airMul = player.grounded ? 1 : 0.9;
        const plungeMul = player.plunging ? 0.45 : 1;
        player.x += mx * MOVE_SPEED * moveMult * airMul * plungeMul * dt;
        player.facing = mx > 0 ? 1 : -1;
      }
      applyPlayerPhysics(dt);
    } else {
      applyPlayerPhysics(dt);
    }

    updateAimFromMouse();

    if (isBotOpponent() && enemy && enemy.hp > 0) {
      enemyApi().update(enemy, player, dt, W, H, map);
      // Physics already applied in bot update — keep x in arena only if needed
      if (window.CBMaps && map) {
        enemy.x = Math.max(
          enemy.radius,
          Math.min(W - enemy.radius, enemy.x)
        );
      } else {
        clampEntity(enemy);
      }
    }

    if (window.CBBackground.update) {
      window.CBBackground.update(dt, W);
    }

    const target = foe();
    const foeHpBefore = target ? target.hp : 0;

    if (window.CBAllies) {
      window.CBAllies.update(dt, target, W, H, map);
    }

    if (dummy && dummy.hp > 0) {
      if (window.CBMaps && window.CBMaps.applyGroundPhysics) {
        window.CBMaps.applyGroundPhysics(dummy, map, W, H, dt);
      } else {
        clampEntity(dummy);
      }
    }

    const hitList = [];
    if (target && target.hp > 0) hitList.push(target);
    if (isBotOpponent()) hitList.push(player);
    if (window.CBAllies) {
      const allies = window.CBAllies.getList();
      for (let i = 0; i < allies.length; i++) {
        if (allies[i].hp > 0) hitList.push(allies[i]);
      }
    }

    const playerHpBefore = player.hp;
    window.CBEffects.update(dt, hitList);
    if (target) clampEntity(target);

    if (target && target.hp < foeHpBefore) {
      addUlt((foeHpBefore - target.hp) * ULT_PER_DAMAGE);
    }

    if (isBotOpponent() && player.hp < playerHpBefore) {
      invulnTimer = Math.max(invulnTimer, 0.35);
      player.invuln = true;
      console.log("[CBGame] player hit hp=" + player.hp);
    }

    // —— KO: explode, camera focus, delayed respawn / lose life ——
    if (!respawnEvent && !matchOver) {
      if (matchConfig.opponent === "dummy" && dummy && dummy.hp <= 0) {
        statusMsg = "Dummy KO!";
        statusTimer = 1.2;
        triggerKoExplosion("dummy", dummy.x, dummy.y);
        dummy = null;
        if (foeLives != null) {
          foeLives -= 1;
          console.log("[CBGame] foe life lost →", foeLives);
          respawnEvent =
            foeLives <= 0
              ? { kind: "matchWin", timer: 1.0 }
              : { kind: "dummy", timer: 1.0 };
        } else {
          respawnEvent = { kind: "dummy", timer: 1.0 };
        }
        if (sloMo) sloMo.endReal = 0.85;
        if (window.CBCountryballs && CBCountryballs.awardFoeKo) {
          const award = CBCountryballs.awardFoeKo(matchConfig);
          if (award) {
            statusMsg = award.summary;
            statusTimer = award.levelsGained > 0 ? 2.8 : 2.0;
          }
        }
      }

      if (isBotOpponent() && enemy && enemy.hp <= 0) {
        statusMsg = "Enemy KO!";
        statusTimer = 1.4;
        triggerKoExplosion("enemy", enemy.x, enemy.y);
        enemy = null;
        if (foeLives != null) {
          foeLives -= 1;
          console.log("[CBGame] foe life lost →", foeLives);
          respawnEvent =
            foeLives <= 0
              ? { kind: "matchWin", timer: 1.1 }
              : { kind: "enemy", timer: 1.15 };
        } else {
          respawnEvent = { kind: "enemy", timer: 1.15 };
        }
        if (sloMo) sloMo.endReal = 0.85;
        if (window.CBCountryballs && CBCountryballs.awardFoeKo) {
          const award = CBCountryballs.awardFoeKo(matchConfig);
          if (award) {
            statusMsg = award.summary;
            statusTimer = award.levelsGained > 0 ? 2.8 : 2.0;
          }
        }
      }

      if (isBotOpponent() && player.hp <= 0) {
        statusMsg = "You were KO'd!";
        statusTimer = 1.6;
        triggerKoExplosion("player", player.x, player.y);
        respawnEvent = null;
        player.hp = 0.01;
        player.invuln = true;
        invulnTimer = 99;
        player.plunging = false;
        player.vy = 0;
        clearPlungeFx();
        clearFinisherSloMo();
        if (playerLives != null) {
          playerLives -= 1;
          console.log("[CBGame] player life lost →", playerLives);
          respawnEvent =
            playerLives <= 0
              ? { kind: "matchLose", timer: 1.2 }
              : { kind: "player", timer: 1.2 };
        } else {
          respawnEvent = { kind: "player", timer: 1.2 };
        }
      }
    }

    if (respawnEvent) {
      respawnEvent.timer -= dt;
      if (respawnEvent.timer <= 0) {
        const spawnY = (map && map.groundY != null ? map.groundY : H * 0.72) - 6;
        if (respawnEvent.kind === "matchWin") {
          respawnEvent = null;
          endMatch(true);
          return;
        }
        if (respawnEvent.kind === "matchLose") {
          respawnEvent = null;
          endMatch(false);
          return;
        }
        if (respawnEvent.kind === "dummy") {
          dummy = {
            id: "dummy",
            x: W * 0.72,
            y: spawnY,
            radius: 38,
            hp: 100,
            maxHp: 100,
            flash: 0,
            vy: 0,
            grounded: true,
          };
        } else if (respawnEvent.kind === "enemy") {
          enemy = enemyApi().create();
          enemy.y = spawnY;
        } else if (respawnEvent.kind === "player") {
          player.hp = player.maxHp;
          player.x = W * 0.22;
          player.y = spawnY;
          player.vy = 0;
          player.grounded = true;
          player.plunging = false;
          clearPlungeFx();
          invulnTimer = 1.6;
          player.invuln = true;
          statusMsg =
            playerLives != null ? "Lives left: " + playerLives : "Respawned";
          statusTimer = 1.2;
        }
        console.log("[CBGame] respawn", respawnEvent && respawnEvent.kind);
        respawnEvent = null;
      }
    }

    if (ultCamFollowUp && !sloMo) {
      ultCamFollowUp.timer -= dt;
      if (ultCamFollowUp.timer <= 0) {
        const t = foe();
        if (t && window.CBCamera) {
          window.CBCamera.focusOn(t.x, t.y, 1.35, 0.9);
        } else if (window.CBCamera) {
          window.CBCamera.focusOn(W * 0.5, H * 0.35, 0.82, 1.4);
        }
        ultCamFollowUp = null;
      }
    }

    // Finisher slo-mo: track the killing strike / projectile
    if (sloMo) {
      const strike = window.CBEffects.getPrimaryFinisher(foe());
      if (strike && window.CBCamera) {
        window.CBCamera.followStrike(strike.x, strike.y, 1.8);
      }
      if (sloMo.endReal != null) {
        sloMo.endReal -= rawDt;
        if (sloMo.endReal <= 0) clearFinisherSloMo();
      } else if (!strike && !respawnEvent) {
        // Missed / expired without KO
        sloMo.endReal = 0.15;
      }
    }

    if (window.CBCamera) {
      window.CBCamera.update(rawDt, {
        W,
        H,
        player,
        target: foe(),
      });
    }

    updateHud();
  }

  function updateHud() {
    const el = document.getElementById("hud-abilities");
    if (!el) return;
    const eCd = cooldowns.eagleStrike;
    const specialName = abilities().hudSpecial || "E Money";
    const eLabel = eCd > 0 ? `E(${eCd.toFixed(1)})` : specialName;
    const qReady = ultCharge >= ULT_MAX;
    const qLabel = qReady ? "Q Ult READY" : `Q Ult ${Math.floor(ultCharge)}%`;
    let atk = "LMB";
    if (player && player.plunging) {
      atk = "PLUNGE";
    } else if (holdingAttack && holdTime >= HOLD_TAP_MAX) {
      const c = Math.min(1, (holdTime - HOLD_TAP_MAX) / (HOLD_FULL - HOLD_TAP_MAX));
      atk = `Charging ${Math.floor(c * 100)}%`;
    } else if (player && !player.grounded) {
      atk = "LMB Plunge";
    }
    const target = foe();
    const foeLabel = isBotOpponent()
      ? `Enemy ${target ? Math.ceil(Math.max(0, target.hp)) : 0}`
      : `Dummy ${target ? Math.ceil(target.hp) : 0}`;
    const bits = [fighterLabel(), atk, eLabel, qLabel, foeLabel];
    if (isBotOpponent()) bits.push(`You ${Math.ceil(player.hp)}`);
    if (playerLives != null) {
      bits.push(`Lives ${playerLives}-${foeLives}`);
    }
    if (sloMo) bits.unshift("SLOW-MO");
    const cinema = window.CBEffects && window.CBEffects.getCinema
      ? window.CBEffects.getCinema()
      : null;
    if (cinema && cinema.active) bits.unshift("CINEMA");
    if (speedBuff) bits.push("Buff");
    if (window.CBAllies && window.CBAllies.getList().length) {
      bits.push("Allies " + window.CBAllies.getList().length);
    }
    el.textContent = bits.join(" · ");
  }

  function drawEntityCircle(ent, fill) {
    ctx.beginPath();
    ctx.arc(ent.x, ent.y, ent.radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (ent.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, ent.flash * 4)})`;
      ctx.fill();
    }
  }

  function drawHpBar(ent, label) {
    const maxHp = ent.maxHp || 100;
    const bw = 70;
    const bh = 8;
    const x = ent.x - bw / 2;
    const y = ent.y - ent.radius - 18;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = ent.hp / maxHp > 0.3 ? "#3ecf6e" : "#e94560";
    ctx.fillRect(x, y, bw * Math.max(0, ent.hp / maxHp), bh);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = "#fff";
    ctx.font = "12px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, ent.x, y - 4);
  }

  function drawUltBar() {
    const bw = 120;
    const bh = 10;
    const x = 24;
    const y = H - 36;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y, bw, bh);
    const ready = ultCharge >= ULT_MAX;
    ctx.fillStyle = ready ? "#f7d354" : "#3c3b6e";
    ctx.fillRect(x, y, bw * (ultCharge / ULT_MAX), bh);
    ctx.strokeStyle = ready ? "#f7d354" : "rgba(255,255,255,0.5)";
    ctx.lineWidth = ready ? 2 : 1;
    ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = "#fff";
    ctx.font = "12px Trebuchet MS, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(ready ? "ULT READY (Q)" : "ULT", x, y - 4);
  }

  function drawChargeRing() {
    if (!holdingAttack || holdTime < HOLD_TAP_MAX) return;
    const charge = Math.min(1, (holdTime - HOLD_TAP_MAX) / (HOLD_FULL - HOLD_TAP_MAX));
    ctx.save();
    ctx.strokeStyle = charge > 0.85 ? "#f7d354" : "#b22234";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(
      player.x,
      player.y,
      player.radius + 12,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * charge
    );
    ctx.stroke();
    const a = abilities().aimVec(player);
    ctx.strokeStyle = "rgba(247, 211, 84, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(
      player.x + a.x * (player.radius + 8),
      player.y + a.y * (player.radius + 8)
    );
    ctx.lineTo(
      player.x + a.x * (player.radius + 40 + charge * 50),
      player.y + a.y * (player.radius + 40 + charge * 50)
    );
    ctx.stroke();
    ctx.restore();
  }

  function drawStatus() {
    if (statusTimer <= 0 || !statusMsg) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, statusTimer * 2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(W / 2 - 140, 18, 280, 32);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(statusMsg, W / 2, 40);
    ctx.restore();
  }

  function drawWorld() {
    const gy = map && map.groundY != null ? map.groundY : H * 0.72;
    const cinema = window.CBEffects && window.CBEffects.getCinema
      ? window.CBEffects.getCinema()
      : null;

    if (cinema && cinema.white > 0.05) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-40, -40, W + 80, H + 80);
      if (cinema.floorBlack) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(-40, gy, W + 80, H - gy + 40);
      }
    } else {
      window.CBBackground.draw(ctx, W, H, timeSec, gy, matchConfig.mapId);
      if (window.CBMaps) window.CBMaps.drawPlatforms(ctx, map);
    }

    const sil = cinema && cinema.silhouette;

    if (matchConfig.opponent === "dummy" && dummy) {
      if (sil) {
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(dummy.x, dummy.y, dummy.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawEntityCircle(dummy, "#6b6b6b");
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.arc(dummy.x - 12, dummy.y - 8, 5, 0, Math.PI * 2);
        ctx.arc(dummy.x + 12, dummy.y - 8, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!sil) drawHpBar(dummy, "Dummy");
    }

    if (isBotOpponent() && enemy) {
      if (sil) {
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        enemyApi().draw(ctx, enemy);
        drawHpBar(enemy, enemyHudLabel());
      }
    }

    if (window.CBAllies && !sil) {
      window.CBAllies.draw(ctx);
    }

    // Hide USA sprite briefly while player KO explosion plays
    const hidePlayer =
      respawnEvent && respawnEvent.kind === "player" && player.hp < 1;
    if (!hidePlayer) {
      if (fighterImg && fighterImg.complete) {
        const size = player.radius * 2;
        ctx.save();
        ctx.translate(player.x, player.y);
        if (player.facing < 0) ctx.scale(-1, 1);
        if (invulnTimer > 0 && !sil) {
          ctx.globalAlpha = 0.55 + Math.sin(timeSec * 30) * 0.25;
        }
        if (sil) ctx.filter = "brightness(0)";
        ctx.drawImage(fighterImg, -size / 2, -size / 2, size, size);
        // Equipped hat (layout in unflipped space, then same facing)
        if (
          !sil &&
          window.CBCosmetics &&
          window.CBCountryballs &&
          CBCountryballs.getHatId
        ) {
          const hatId = CBCountryballs.getHatId(player.id);
          const hat = CBCosmetics.getHat(hatId);
          const himg = hat && hat._img;
          if (hat && himg && himg.complete && himg.naturalWidth) {
            const aspect = himg.naturalWidth / himg.naturalHeight;
            hat._aspect = aspect;
            const w = player.radius * 2 * hat.scale;
            const hh = w / aspect;
            const hx = hat.ox * player.radius - w / 2;
            const hy = hat.oy * player.radius - hh / 2;
            ctx.drawImage(himg, hx, hy, w, hh);
          }
        }
        ctx.filter = "none";
        ctx.restore();
        if (player.flash > 0 && !sil) {
          ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, player.flash * 3)})`;
          ctx.beginPath();
          ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        drawEntityCircle(player, sil ? "#000" : "#b22234");
      }
      if (!sil) {
        drawHpBar(player, fighterLabel());
        drawChargeRing();
      }
    }

    window.CBEffects.draw(ctx);

    // White flash overlay (screen punch)
    if (cinema && cinema.white > 0 && cinema.white < 0.98) {
      ctx.fillStyle = `rgba(255,255,255,${cinema.white * 0.15})`;
      ctx.fillRect(-40, -40, W + 80, H + 80);
    }
  }

  function draw() {
    // Clear in screen space
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (window.CBCamera) window.CBCamera.apply(ctx, W, H);
    drawWorld();
    ctx.restore();

    // Screen-space HUD
    drawUltBar();
    drawStatus();
  }

  function frame(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    let rawDt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (rawDt > 0.05) rawDt = 0.05;
    const gameDt = sloMo ? rawDt * sloMo.scale : rawDt;
    update(gameDt, rawDt);
    draw();
    rafId = requestAnimationFrame(frame);
  }

  function start(cfg) {
    if (!canvas || !ctx) {
      console.error("[CBGame] not initialized");
      return;
    }
    matchConfig = normalizeConfig(cfg);
    resetState();
    running = true;
    lastTs = 0;
    const gameScreen = document.getElementById("screen-game");
    const result = document.getElementById("screen-result");
    if (result) result.classList.add("screen-hidden");
    if (gameScreen) gameScreen.classList.remove("screen-hidden");
    console.log("[CBGame] arena start", matchConfig);
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    holdingAttack = false;
    mouse.down = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    lastTs = 0;
    console.log("[CBGame] arena stop");
  }

  function init(handlers) {
    canvas = document.getElementById("game-canvas");
    onExitToMenu = handlers && handlers.onExitToMenu;
    onMatchEnd = handlers && handlers.onMatchEnd;
    if (!canvas) {
      console.error("[CBGame] missing canvas");
      return;
    }
    ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = H;

    usaImg = new Image();
    usaImg.onload = function () {
      console.log("[CBGame] USA sprite loaded");
    };
    usaImg.onerror = function () {
      console.error("[CBGame] failed to load assets/usa.png");
    };
    usaImg.src = "assets/usa.png";

    japanImg = new Image();
    japanImg.onload = function () {
      console.log("[CBGame] Japan sprite loaded");
    };
    japanImg.onerror = function () {
      console.error("[CBGame] failed to load assets/japan.png");
    };
    japanImg.src = "assets/japan.png";

    russiaImg = new Image();
    russiaImg.onload = function () {
      console.log("[CBGame] Russia sprite loaded");
    };
    russiaImg.onerror = function () {
      console.error("[CBGame] failed to load assets/russia.png");
    };
    russiaImg.src = "assets/russia.png";
    fighterImg = usaImg;

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("blur", function () {
      mouse.down = false;
      if (holdingAttack) releaseAttack();
    });
    canvas.addEventListener("contextmenu", onContextMenu);

    const menuBtn = document.getElementById("btn-menu");
    if (menuBtn) {
      menuBtn.addEventListener("click", function () {
        stop();
        if (typeof onExitToMenu === "function") onExitToMenu();
      });
    }

    console.log("[CBGame] init OK");
  }

  return { init, start, stop };
})();
