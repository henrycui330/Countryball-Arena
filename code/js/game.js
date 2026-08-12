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
  let plungeWrathTimer = 0;
  let plungeTrailTimer = 0;
  let plungeHitStop = null;
  let foeKoAnim = null;
  let auraAmbientTimer = 0;
  let netSendTimer = 0;
  let remoteGhost = null;
  let mpFoe = null;
  let mpPendingHit = 0;

  function playerHasWrath() {
    return !!(
      player &&
      window.CBCountryballs &&
      CBCountryballs.hasWrath &&
      CBCountryballs.hasWrath(player.id)
    );
  }

  function playerAuraId() {
    if (!player || !window.CBCountryballs || !CBCountryballs.getEffectId) return null;
    return CBCountryballs.getEffectId(player.id);
  }

  function playerAuraColors(fallback) {
    const auraId = playerAuraId();
    if (!auraId || auraId === "none" || !window.CBCosmetics || !CBCosmetics.getEffect) {
      return fallback.slice();
    }
    const fx = CBCosmetics.getEffect(auraId);
    if (!fx || !Array.isArray(fx.colors) || !fx.colors.length) return fallback.slice();
    return fx.colors.slice();
  }

  function auraFacingRot() {
    if (!player) return 0;
    return player.facing < 0 ? -0.32 : 0.32;
  }

  function drawAuraGlow(cx, cy, rx, ry, rot, stops) {
    const base = Math.max(rx, ry);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(rx / base, ry / base);
    const g = ctx.createRadialGradient(0, 0, base * 0.14, 0, 0, base);
    stops.forEach(function (s) {
      g.addColorStop(s[0], s[1]);
    });
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, base, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function traceAuraBlob(cx, cy, rx, ry, rot, wobble, segments) {
    const segs = segments || 36;
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      const wob = 1 + wobble * Math.sin(t * 3 + timeSec * 3.6);
      const lx = Math.cos(t) * rx * wob;
      const ly = Math.sin(t) * ry * wob;
      const x = cx + lx * Math.cos(rot) - ly * Math.sin(rot);
      const y = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function strokeAuraBlob(cx, cy, rx, ry, rot, wobble, color, lineWidth) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    traceAuraBlob(cx, cy, rx, ry, rot, wobble, 36);
    ctx.stroke();
  }

  function fillAuraBlob(cx, cy, rx, ry, rot, wobble, color) {
    ctx.fillStyle = color;
    traceAuraBlob(cx, cy, rx, ry, rot, wobble, 28);
    ctx.fill();
  }

  function auraOrbit(cx, cy, ang, rx, ry, yOff) {
    return {
      x: cx + Math.cos(ang) * rx,
      y: cy + (yOff || 0) + Math.sin(ang) * ry,
    };
  }

  function normalizeConfig(cfg) {
    const c = cfg || {};
    const isMp = c.matchType === "multiplayer" || c.opponent === "multiplayer";
    const opponent = isMp
      ? "multiplayer"
      : c.opponent === "hard"
        ? "hard"
        : c.opponent === "medium"
          ? "medium"
          : c.opponent === "easy"
            ? "easy"
            : "dummy";
    const mapId = c.mapId === "icy" ? "icy" : "plains";
    const matchType = isMp
      ? "multiplayer"
      : c.matchType === "custom"
        ? "custom"
        : "quick";
    const fighter =
      c.fighter === "japan"
        ? "japan"
        : c.fighter === "russia"
          ? "russia"
          : "usa";
    let lives = null;
    if (matchType === "custom" || matchType === "multiplayer") {
      lives = Math.max(1, Math.min(100, Math.floor(c.lives || 3)));
    }
    return {
      matchType,
      opponent,
      mapId,
      lives,
      fighter,
      roomCode: c.roomCode || null,
      players: Array.isArray(c.players) ? c.players : [],
    };
  }

  function isMultiplayer() {
    return matchConfig.matchType === "multiplayer" || matchConfig.opponent === "multiplayer";
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

  function fighterImgById(id) {
    if (id === "japan") return japanImg;
    if (id === "russia") return russiaImg;
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
    mpFoe = null;
    mpPendingHit = 0;
    remoteGhost = null;
    if (isMultiplayer()) {
      const meId =
        window.CBNetClient && CBNetClient.getState
          ? CBNetClient.getState().playerId
          : null;
      const roster = matchConfig.players || [];
      let mySlot = 0;
      for (let i = 0; i < roster.length; i++) {
        if (roster[i].id === meId) {
          mySlot = i;
          break;
        }
      }
      // Spread hosts/guests so they don't spawn on top of each other.
      player.x = W * (0.18 + mySlot * 0.18);
      player.facing = mySlot % 2 === 0 ? 1 : -1;
      mpFoe = {
        id: "remote",
        x: W * 0.72,
        y: spawnY,
        radius: 42,
        hp: 100,
        maxHp: 100,
        flash: 0,
        vy: 0,
        grounded: true,
        facing: -1,
        fighter: "usa",
      };
    } else if (matchConfig.opponent === "dummy") {
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
    foeKoAnim = null;
    plungeHitStop = null;
    plungeTrailTimer = 0;
    remoteGhost = null;
    netSendTimer = 0;
    const mapName = map.name || matchConfig.mapId;
    statusMsg = isMultiplayer()
      ? "Online · " + mapName + (playerLives != null ? " · " + playerLives + " lives" : "")
      : (matchConfig.matchType === "custom" ? "Custom" : "Quick") +
        " · " +
        mapName +
        (playerLives != null ? " · " + playerLives + " lives" : "");
    statusTimer = 1.8;
    if (window.CBCamera) window.CBCamera.reset(W, H);
    if (window.CBEffects) window.CBEffects.clear();
    if (window.CBAllies) window.CBAllies.clear();
  }

  function foe() {
    if (isMultiplayer()) return mpFoe;
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
        ? abilities().getMeleeWeapon(player)
        : null;
    if (!wpn || !window.CBEffects || !window.CBEffects.spawnPlungeAttack) {
      console.warn("[CBGame] plunge weapon missing");
      return false;
    }

    player.plunging = true;
    player.vy = PLUNGE_VY;
    clearPlungeFx();
    const plungeCols = playerAuraColors(["#ffffff", "#f7d354", "#b22234"]);
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
      trailColor: "rgba(255,255,255,0.42)",
      sparkColor: plungeCols[0] || "#ffffff",
    });
    plungeWrathTimer = 0;
    plungeTrailTimer = 0;
    auraAmbientTimer = 0;
    if (playerHasWrath() && window.CBEffects.spawnWrathLightning) {
      window.CBEffects.spawnWrathLightning(player.x, player.y, { count: 4 });
    }
    if (window.CBCamera) {
      window.CBCamera.focusOn(player.x, player.y + 55, 1.3, 0.5);
      window.CBCamera.addShake(0.22);
    }
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
        ? abilities().getMeleeWeapon(player)
        : {};
    const dmg = wpn.plungeDamage || 22;
    const target = foe();
    const hitY = player.y + player.radius * 0.35;
    let landedHit = false;

    if (window.CBEffects) {
      const wrath = playerHasWrath();
      const cols = playerAuraColors(["#ffffff", "#f7d354", "#b22234"]);
      const auraId = playerAuraId();
      let waveCol = "rgba(255,255,255,0.72)";
      if (auraId === "uncle_sam") waveCol = "rgba(31,75,165,0.72)";
      else if (auraId === "void_shroud") waveCol = "rgba(166,107,255,0.68)";
      else if (auraId === "solar_aegis") waveCol = "rgba(255,215,106,0.72)";
      else if (wrath) waveCol = "rgba(255,50,50,0.75)";

      if (window.CBEffects.spawnShockwave) {
        window.CBEffects.spawnShockwave(player.x, hitY, {
          maxRadius: 150,
          color: waveCol,
          width: 4,
        });
        window.CBEffects.spawnShockwave(player.x, hitY, {
          maxRadius: 95,
          radius: 12,
          color: "rgba(255,255,255,0.5)",
          width: 2.2,
          life: 0.28,
        });
      }
      window.CBEffects.spawnBurst(
        player.x,
        hitY,
        22,
        wrath ? ["#ff1a1a", "#ff4d4d", "#8b0000", "#ffffff"] : cols
      );
      window.CBEffects.spawnParticle(player.x, hitY, {
        vx: 0,
        vy: -120,
        life: 0.32,
        size: 10,
        color: wrath ? "#ff1a1a" : cols[0] || "#ffffff",
      });
      if (wrath && window.CBEffects.spawnWrathLightning) {
        window.CBEffects.spawnWrathLightning(player.x, hitY, { count: 8 });
      }
    }

    if (target && target.hp > 0) {
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.hypot(dx, dy);
      const reach = PLUNGE_HIT_RADIUS + (target.radius || 30);
      if (dist < reach) {
        landedHit = true;
        const foeHpBefore = target.hp;
        const finisher = dmg >= target.hp;
        target.hp = Math.max(0, target.hp - dmg);
        target.flash = 0.45;
        const nx = dist > 1 ? dx / dist : player.facing || 1;
        target.x += nx * (finisher ? 52 : 34);
        if (target.vy != null) target.vy = finisher ? -340 : -260;
        else target.y -= finisher ? 28 : 18;
        if (window.CBMaps && map) {
          window.CBMaps.resolveEntity(target, map, W, H);
        } else {
          clampEntity(target);
        }
        console.log(
          "[CBGame] plunge hit dmg=" + dmg + " foeHp=" + target.hp
        );
        plungeHitStop = { timer: 0.1, scale: 0.08 };
        if (window.CBCamera) {
          window.CBCamera.focusOn(
            (player.x + target.x) * 0.5,
            (hitY + target.y) * 0.5,
            1.78,
            0.75
          );
          window.CBCamera.addShake(finisher ? 0.72 : 0.55);
        }
        if (finisher && !isMultiplayer()) startFinisherSloMo("plunge");
        if (isMultiplayer()) {
          flushMpHits(foeHpBefore);
        } else if (target.hp <= 0) {
          handleFoeKo(target, isBotOpponent() ? "enemy" : "dummy", {
            knockDir: { x: nx, y: -0.42 },
            power: 1.7,
            vy: -390,
          });
        }
      } else {
        console.log("[CBGame] plunge miss dist=" + dist.toFixed(0));
      }
    }

    if (!landedHit && window.CBCamera) {
      window.CBCamera.focusOn(player.x, hitY, 1.48, 0.4);
      window.CBCamera.addShake(0.42);
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

  function tickPlungeFx(dt) {
    if (!player || !player.plunging) return;
    plungeTrailTimer -= dt;
    if (plungeTrailTimer <= 0 && window.CBEffects) {
      plungeTrailTimer = 0.035;
      const cols = playerAuraColors(["#ffffff", "#f7d354", "#b22234"]);
      window.CBEffects.spawnTrail(player.x, player.y - player.radius * 0.15, {
        life: 0.24,
        size: player.radius * 0.95,
        color: cols[Math.floor(Math.random() * cols.length)],
      });
    }
    if (!playerHasWrath()) return;
    plungeWrathTimer -= dt;
    if (plungeWrathTimer <= 0) {
      plungeWrathTimer = 0.12;
      if (window.CBEffects && window.CBEffects.spawnWrathLightning) {
        window.CBEffects.spawnWrathLightning(player.x, player.y - 10, {
          count: 2,
        });
      }
    }
  }

  function tickAuraAmbient(dt) {
    if (!player || !window.CBEffects) return;
    const auraId = playerAuraId();
    if (!auraId || auraId === "none") return;
    auraAmbientTimer -= dt;
    if (auraAmbientTimer > 0) return;

    if (auraId === "uncle_sam") {
      auraAmbientTimer = 0.045;
      const ang = Math.random() * Math.PI * 2;
      const rx = player.radius * (0.95 + Math.random() * 1.0);
      const ry = player.radius * (0.58 + Math.random() * 0.62);
      const px = player.x + Math.cos(ang) * rx;
      const py = player.y - 4 + Math.sin(ang) * ry;
      window.CBEffects.spawnTrail(px, py, {
        life: 0.22,
        size: 10 + Math.random() * 12,
        color: Math.random() > 0.5 ? "rgba(31,75,165,0.45)" : "rgba(215,38,61,0.45)",
      });
      if (Math.random() > 0.55) {
        window.CBEffects.spawnParticle(px, py, {
          vx: (Math.random() - 0.5) * 70,
          vy: -20 - Math.random() * 60,
          life: 0.26,
          size: 2 + Math.random() * 2,
          color: "#ffffff",
        });
      }
    } else if (auraId === "void_shroud") {
      auraAmbientTimer = 0.06;
      const ang = Math.random() * Math.PI * 2;
      const rx = player.radius * (1.05 + Math.random() * 0.85);
      const ry = player.radius * (0.5 + Math.random() * 0.48);
      const px = player.x + Math.cos(ang) * rx;
      const py = player.y - 2 + Math.sin(ang) * ry;
      window.CBEffects.spawnTrail(px, py, {
        life: 0.28,
        size: 11 + Math.random() * 10,
        color: "rgba(86,32,131,0.42)",
      });
      if (Math.random() > 0.72) {
        window.CBEffects.spawnParticle(px, py, {
          vx: (Math.random() - 0.5) * 35,
          vy: -10 - Math.random() * 35,
          life: 0.24,
          size: 2 + Math.random() * 2.4,
          color: "rgba(226,204,255,0.92)",
        });
      }
    } else if (auraId === "solar_aegis") {
      auraAmbientTimer = 0.05;
      const ang = Math.random() * Math.PI * 2;
      const rx = player.radius * (0.72 + Math.random() * 0.82);
      const ry = player.radius * (0.95 + Math.random() * 1.05);
      const px = player.x + Math.cos(ang) * rx;
      const py = player.y - 5 + Math.sin(ang) * ry;
      window.CBEffects.spawnTrail(px, py, {
        life: 0.24,
        size: 10 + Math.random() * 11,
        color: "rgba(246,183,60,0.44)",
      });
      if (Math.random() > 0.62) {
        window.CBEffects.spawnParticle(px, py, {
          vx: (Math.random() - 0.5) * 45,
          vy: -25 - Math.random() * 55,
          life: 0.27,
          size: 2 + Math.random() * 2,
          color: "rgba(255,249,232,0.94)",
        });
      }
    } else {
      auraAmbientTimer = 0.09;
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

  function buildFoeRespawn(kind) {
    let pending;
    if (foeLives != null) {
      foeLives -= 1;
      console.log("[CBGame] foe life lost →", foeLives);
      pending =
        foeLives <= 0
          ? { kind: "matchWin", timer: 1.15 }
          : {
              kind: kind === "enemy" ? "enemy" : "dummy",
              timer: kind === "enemy" ? 1.3 : 1.1,
            };
    } else {
      pending = {
        kind: kind === "enemy" ? "enemy" : "dummy",
        timer: kind === "enemy" ? 1.2 : 1.05,
      };
    }
    return pending;
  }

  function beginFoeKo(entity, kind, opts) {
    const o = opts || {};
    if (!entity || foeKoAnim) return;
    const px = player ? player.x : entity.x - 50;
    const py = player ? player.y : entity.y;
    let nx = entity.x - px;
    let ny = entity.y - py - 16;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    if (o.knockDir) {
      nx = o.knockDir.x;
      ny = o.knockDir.y;
      const dl = Math.hypot(nx, ny) || 1;
      nx /= dl;
      ny /= dl;
    }
    const power = o.power || 1;
    const duration = o.duration || 0.8;
    foeKoAnim = {
      kind: kind,
      x: entity.x,
      y: entity.y,
      radius: entity.radius || 38,
      vx: nx * (260 + 140 * power),
      vy: o.vy != null ? o.vy : -300 - 90 * power,
      rot: 0,
      spin: (Math.random() > 0.5 ? 1 : -1) * (9 + 5 * power),
      scale: 1,
      alpha: 1,
      timer: duration,
      maxTimer: duration,
      flash: 0.55,
      isBot: kind === "enemy",
      enemySnapshot: kind === "enemy" ? Object.assign({}, entity) : null,
      pending: o.pending || buildFoeRespawn(kind),
    };
    if (window.CBCamera) {
      window.CBCamera.focusOn(entity.x, entity.y, 1.9, 1.0);
      window.CBCamera.addShake(0.55);
    }
    if (sloMo) {
      sloMo.endReal = Math.max(sloMo.endReal || 0, 1.0);
    } else {
      startFinisherSloMo("ko");
    }
    console.log("[CBGame] foe KO launch", kind);
  }

  function completeFoeKo() {
    if (!foeKoAnim) return;
    const anim = foeKoAnim;
    foeKoAnim = null;
    triggerKoExplosion(anim.kind, anim.x, anim.y);
    if (anim.pending) respawnEvent = anim.pending;
  }

  function updateFoeKo(dt) {
    if (!foeKoAnim) return;
    const a = foeKoAnim;
    a.timer -= dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.vy += GRAVITY * 0.48 * dt;
    a.rot += a.spin * dt;
    a.flash = Math.max(0, a.flash - dt * 1.5);
    const prog = 1 - Math.max(0, a.timer) / (a.maxTimer || 0.8);
    if (prog > 0.5) a.scale = Math.max(0.12, 1 - (prog - 0.5) * 1.15);
    if (prog > 0.62) a.alpha = Math.max(0, 1 - (prog - 0.62) / 0.38);

    a.x = Math.max(a.radius * a.scale, Math.min(W - a.radius * a.scale, a.x));
    const minY = a.radius * a.scale + 16;
    const maxY = floorY() + 36;
    a.y = Math.max(minY, Math.min(maxY, a.y));

    if (a.enemySnapshot) {
      a.enemySnapshot.x = a.x;
      a.enemySnapshot.y = a.y;
      a.enemySnapshot.radius = a.radius * a.scale;
      a.enemySnapshot.flash = a.flash;
    }

    if (window.CBCamera) {
      window.CBCamera.focusOn(a.x, a.y - 10, 1.85 + prog * 0.15, 0.2);
    }

    if (window.CBEffects && Math.random() > 0.45) {
      window.CBEffects.spawnParticle(a.x, a.y, {
        vx: (Math.random() - 0.5) * 110,
        vy: (Math.random() - 0.5) * 110,
        life: 0.24,
        size: 2 + Math.random() * 3,
        color: a.kind === "enemy" ? "#ffca28" : "#dddddd",
      });
    }

    if (a.timer <= 0) completeFoeKo();
  }

  function drawFoeKo(sil) {
    if (!foeKoAnim || sil) return;
    const a = foeKoAnim;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a.alpha);
    if (a.isBot && a.enemySnapshot) {
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      const snap = Object.assign({}, a.enemySnapshot, {
        x: 0,
        y: 0,
        radius: a.radius * a.scale,
      });
      enemyApi().draw(ctx, snap);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = Math.max(0, a.alpha);
    } else {
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      const r = a.radius * a.scale;
      drawEntityCircle({ x: 0, y: 0, radius: r }, "#6b6b6b");
      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.arc(-12, -8, 5, 0, Math.PI * 2);
      ctx.arc(12, -8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = Math.max(0, a.alpha);
    }
    if (a.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, a.flash * 2.2)})`;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius * a.scale * 1.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function handleFoeKo(entity, kind, opts) {
    if (!entity || foeKoAnim) return;
    statusMsg = kind === "enemy" ? "Enemy KO!" : "Dummy KO!";
    statusTimer = 1.6;
    if (window.CBCountryballs && CBCountryballs.awardFoeKo) {
      const award = CBCountryballs.awardFoeKo(matchConfig);
      if (award) {
        statusMsg = award.summary;
        statusTimer = award.levelsGained > 0 ? 2.8 : 2.0;
      }
    }
    beginFoeKo(entity, kind, opts);
    if (kind === "dummy") dummy = null;
    else if (kind === "enemy") enemy = null;
  }

  function triggerKoExplosion(kind, x, y) {
    const wrathFinisher =
      playerHasWrath() && sloMo && kind !== "player";
    const red = ["#ff1a1a", "#ff4d4d", "#8b0000", "#ffffff", "#bf360c"];
    const colors = wrathFinisher
      ? red
      : kind === "enemy"
        ? ["#c62828", "#ffca28", "#ffffff", "#bf360c", "#f7d354"]
        : kind === "player"
          ? ["#b22234", "#3c3b6e", "#ffffff", "#f7d354"]
          : ["#888", "#ccc", "#444", "#fff"];

    function boom() {
      if (window.CBEffects.spawnExplosion) {
        window.CBEffects.spawnExplosion(x, y, {
          power: kind === "enemy" ? 1.85 : kind === "dummy" ? 1.45 : 1.2,
          colors: colors,
        });
      } else {
        window.CBEffects.spawnBurst(x, y, 24, colors);
      }
      if (window.CBCamera) {
        window.CBCamera.focusOn(x, y, 1.6, 1.15);
        window.CBCamera.addShake(0.55);
      }
      console.log("[CBGame] KO explosion", kind, Math.round(x), Math.round(y));
    }

    if (
      wrathFinisher &&
      window.CBEffects.spawnFinisherCross
    ) {
      window.CBEffects.spawnFinisherCross({
        x: x,
        y: y,
        radius: 52,
        colors: red,
        onDone: boom,
      });
      console.log("[CBGame] Wrath finisher cross");
    } else {
      boom();
    }
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
    tickPlungeFx(dt);
    tickAuraAmbient(dt);
    updateFoeKo(dt);

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
    if (isMultiplayer()) syncMpFoeFromRemote();
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
    if (isMultiplayer()) flushMpHits(foeHpBefore);

    if (target && target.hp < foeHpBefore && !isMultiplayer()) {
      addUlt((foeHpBefore - target.hp) * ULT_PER_DAMAGE);
    }
    if (isMultiplayer() && mpPendingHit > 0) {
      addUlt(mpPendingHit * ULT_PER_DAMAGE);
      mpPendingHit = 0;
    }

    if ((isBotOpponent() || isMultiplayer()) && player.hp < playerHpBefore) {
      invulnTimer = Math.max(invulnTimer, 0.35);
      player.invuln = true;
      console.log("[CBGame] player hit hp=" + player.hp);
    }

    // —— KO: launch away from player, then explode ——
    if (!respawnEvent && !matchOver && !foeKoAnim) {
      if (matchConfig.opponent === "dummy" && dummy && dummy.hp <= 0) {
        handleFoeKo(dummy, "dummy");
      }

      if (isBotOpponent() && enemy && enemy.hp <= 0) {
        handleFoeKo(enemy, "enemy");
      }

      if (isMultiplayer() && mpFoe && remoteGhost) {
        if (remoteGhost.hp <= 0 && !mpFoe._koLatched) {
          mpFoe._koLatched = true;
          statusMsg = "Rival KO!";
          statusTimer = 1.4;
          if (window.CBCamera) window.CBCamera.addShake(0.4);
          console.log("[CBGame] remote KO flash");
        }
        if (remoteGhost.hp > 0) mpFoe._koLatched = false;
        if (typeof remoteGhost.lives === "number" && remoteGhost.lives <= 0 && !matchOver) {
          endMatch(true);
          return;
        }
      }

      if ((isBotOpponent() || isMultiplayer()) && player.hp <= 0) {
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

    publishMultiplayerState(dt);

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

  function publishMultiplayerState(dt) {
    if (!isMultiplayer() || !window.CBNetClient || !player) return;
    const net = CBNetClient.getState ? CBNetClient.getState() : null;
    if (!net || !net.connected || !net.roomCode) return;
    netSendTimer -= dt;
    if (netSendTimer > 0) return;
    netSendTimer = 0.05;
    if (CBNetClient.sendState) {
      CBNetClient.sendState({
        playerId: net.playerId,
        x: player.x,
        y: player.y,
        hp: player.hp,
        maxHp: player.maxHp,
        facing: player.facing,
        fighter: player.id,
        radius: player.radius,
        lives: playerLives,
        ts: Date.now(),
      });
    }
  }

  function syncMpFoeFromRemote() {
    if (!isMultiplayer() || !mpFoe || !remoteGhost) return;
    mpFoe.x = remoteGhost.x;
    mpFoe.y = remoteGhost.y;
    mpFoe.radius = remoteGhost.radius || mpFoe.radius;
    mpFoe.facing = remoteGhost.facing;
    mpFoe.fighter = remoteGhost.fighter || mpFoe.fighter;
    mpFoe.maxHp = remoteGhost.maxHp || mpFoe.maxHp;
    // Authoritative HP comes from the remote player snapshot.
    mpFoe.hp = Math.max(0, remoteGhost.hp);
    if (mpFoe.flash > 0) mpFoe.flash -= 0.05;
  }

  function setRemoteSnapshot(snapshot) {
    const s = snapshot || {};
    if (typeof s.x !== "number" || typeof s.y !== "number") return;
    const myId =
      window.CBNetClient && CBNetClient.getState
        ? CBNetClient.getState().playerId
        : null;
    if (s.playerId && myId && s.playerId === myId) return;
    remoteGhost = {
      x: s.x,
      y: s.y,
      hp: typeof s.hp === "number" ? s.hp : 100,
      maxHp: typeof s.maxHp === "number" ? s.maxHp : 100,
      facing: s.facing >= 0 ? 1 : -1,
      fighter: s.fighter || "usa",
      radius: typeof s.radius === "number" ? s.radius : 42,
      lives: typeof s.lives === "number" ? s.lives : null,
      playerId: s.playerId || null,
      ts: typeof s.ts === "number" ? s.ts : Date.now(),
    };
    if (typeof s.lives === "number") foeLives = s.lives;
  }

  function applyRemoteHit(payload) {
    if (!isMultiplayer() || !player || matchOver) return;
    const amount = Math.max(0, Number(payload && payload.amount) || 0);
    if (amount <= 0) return;
    if (invulnTimer > 0 || player.invuln) return;
    const before = player.hp;
    player.hp = Math.max(0, player.hp - amount);
    player.flash = 0.35;
    invulnTimer = Math.max(invulnTimer, 0.28);
    player.invuln = true;
    console.log(
      "[CBGame] remote hit dmg=" + amount + " hp " + before + "->" + player.hp
    );
  }

  function flushMpHits(foeHpBefore) {
    if (!isMultiplayer() || !mpFoe || !window.CBNetClient) return;
    if (!(mpFoe.hp < foeHpBefore)) return;
    const amount = foeHpBefore - mpFoe.hp;
    mpPendingHit += amount;
    // Restore local proxy HP; peer applies damage on their machine.
    mpFoe.hp = foeHpBefore;
    mpFoe.flash = 0.4;
    if (CBNetClient.sendHit) {
      CBNetClient.sendHit({
        amount: amount,
        from:
          window.CBNetClient.getState && CBNetClient.getState().playerId
            ? CBNetClient.getState().playerId
            : null,
        ts: Date.now(),
      });
    }
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

    if (remoteGhost && !sil && !isMultiplayer()) {
      const ageMs = Date.now() - (remoteGhost.ts || 0);
      if (ageMs < 2200) {
        const gImg = fighterImgById(remoteGhost.fighter);
        const gx = remoteGhost.x;
        const gy = remoteGhost.y;
        const gr = remoteGhost.radius || 42;
        if (gImg && gImg.complete) {
          const sz = gr * 2;
          ctx.save();
          ctx.globalAlpha = 0.82;
          ctx.translate(gx, gy);
          if (remoteGhost.facing < 0) ctx.scale(-1, 1);
          ctx.drawImage(gImg, -sz / 2, -sz / 2, sz, sz);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = 0.82;
          drawEntityCircle({ x: gx, y: gy, radius: gr, flash: 0 }, "#8aa0c7");
          ctx.restore();
        }
        drawHpBar(
          {
            x: gx,
            y: gy,
            radius: gr,
            hp: Math.max(0, remoteGhost.hp || 0),
            maxHp: remoteGhost.maxHp || 100,
          },
          "Remote"
        );
      }
    }

    if (isMultiplayer() && mpFoe && !sil) {
      const ageOk = !remoteGhost || Date.now() - (remoteGhost.ts || 0) < 2500;
      if (ageOk) {
        const gImg = fighterImgById(mpFoe.fighter || (remoteGhost && remoteGhost.fighter));
        const gx = mpFoe.x;
        const gy = mpFoe.y;
        const gr = mpFoe.radius || 42;
        if (gImg && gImg.complete) {
          const sz = gr * 2;
          ctx.save();
          ctx.translate(gx, gy);
          if ((mpFoe.facing || -1) < 0) ctx.scale(-1, 1);
          ctx.drawImage(gImg, -sz / 2, -sz / 2, sz, sz);
          ctx.restore();
        } else {
          drawEntityCircle(mpFoe, "#8aa0c7");
        }
        if (mpFoe.flash > 0) {
          ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, mpFoe.flash * 4)})`;
          ctx.beginPath();
          ctx.arc(gx, gy, gr, 0, Math.PI * 2);
          ctx.fill();
        }
        drawHpBar(mpFoe, "Rival");
      }
    }

    drawFoeKo(sil);

    if (window.CBAllies && !sil) {
      window.CBAllies.draw(ctx);
    }

    // Hide USA sprite briefly while player KO explosion plays
    const hidePlayer =
      respawnEvent && respawnEvent.kind === "player" && player.hp < 1;
    if (!hidePlayer) {
      const auraId = !sil ? playerAuraId() : null;
      const auraOn = !!(auraId && auraId !== "none");
      let floatY = 0;
      if (auraOn) {
        const floatAmp =
          auraId === "void_shroud" ? 2.1 : auraId === "solar_aegis" ? 1.8 : 2.5;
        const floatBase =
          auraId === "void_shroud" ? -5 : auraId === "solar_aegis" ? -4 : -7;
        const floatSpeed =
          auraId === "uncle_sam" ? 3.6 : auraId === "void_shroud" ? 2.5 : 3.1;
        floatY = floatBase + Math.sin(timeSec * floatSpeed) * floatAmp;
      }
      if (auraOn) {
        ctx.save();
        const cy = player.y + floatY;
        const r = player.radius;
        const rot = auraFacingRot();
        if (auraId === "uncle_sam") {
          drawAuraGlow(player.x, cy, r * 2.75, r * 1.82, rot, [
            [0, "rgba(255, 255, 255, 0.34)"],
            [0.36, "rgba(31, 75, 165, 0.24)"],
            [0.68, "rgba(215, 38, 61, 0.21)"],
            [1, "rgba(122, 0, 20, 0)"],
          ]);
          strokeAuraBlob(
            player.x,
            cy,
            r * (1.36 + 0.05 * Math.sin(timeSec * 6.4)),
            r * 0.9,
            rot,
            0.06,
            "rgba(255,255,255,0.45)",
            2.2
          );
          strokeAuraBlob(
            player.x,
            cy,
            r * (1.68 + 0.06 * Math.cos(timeSec * 5.2)),
            r * 1.08,
            rot + 0.18,
            0.05,
            "rgba(215,38,61,0.42)",
            2.6
          );
          for (let i = 0; i < 6; i++) {
            const ang = timeSec * 2.2 + (Math.PI * 2 * i) / 6;
            const p = auraOrbit(player.x, cy, ang, r * 1.12, r * 0.68);
            ctx.fillStyle = i % 2 ? "rgba(31,75,165,0.9)" : "rgba(255,255,255,0.95)";
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 2.2, 1.4, rot, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (auraId === "void_shroud") {
          drawAuraGlow(player.x, cy, r * 2.55, r * 1.62, rot + 0.45, [
            [0, "rgba(226, 204, 255, 0.22)"],
            [0.42, "rgba(95, 42, 138, 0.23)"],
            [0.8, "rgba(42, 10, 66, 0.2)"],
            [1, "rgba(16, 8, 24, 0)"],
          ]);
          strokeAuraBlob(
            player.x,
            cy,
            r * (1.5 + 0.08 * Math.sin(timeSec * 4.2)),
            r * 0.82,
            rot + 0.55,
            0.08,
            "rgba(166,107,255,0.28)",
            2
          );
          for (let i = 0; i < 4; i++) {
            const ang = timeSec * 1.4 + i * 1.7;
            const p = auraOrbit(player.x, cy, ang, r * 0.95, r * 0.5);
            fillAuraBlob(
              p.x,
              p.y,
              r * (0.34 + i * 0.04),
              r * (0.22 + i * 0.03),
              rot + i * 0.4,
              0.1,
              "rgba(166, 107, 255, 0.16)"
            );
          }
        } else if (auraId === "solar_aegis") {
          drawAuraGlow(player.x, cy, r * 2.15, r * 2.65, rot - 0.15, [
            [0, "rgba(255, 249, 232, 0.4)"],
            [0.45, "rgba(255, 215, 106, 0.26)"],
            [0.78, "rgba(246, 183, 60, 0.2)"],
            [1, "rgba(201, 134, 26, 0)"],
          ]);
          strokeAuraBlob(
            player.x,
            cy,
            r * (1.42 + 0.06 * Math.sin(timeSec * 5.1)),
            r * 1.22,
            rot - 0.1,
            0.05,
            "rgba(255,249,232,0.42)",
            2.1
          );
          strokeAuraBlob(
            player.x,
            cy,
            r * (1.82 + 0.05 * Math.cos(timeSec * 4.7)),
            r * 1.48,
            rot + 0.12,
            0.04,
            "rgba(246,183,60,0.34)",
            2.8
          );
          for (let i = 0; i < 5; i++) {
            const ang = timeSec * 1.9 + i * 1.2;
            const rise = (timeSec * 18 + i * 10) % 22;
            const p = auraOrbit(player.x, cy - rise, ang, r * 0.88, r * 1.05);
            ctx.fillStyle = i % 2 ? "rgba(255, 215, 106, 0.85)" : "rgba(255, 249, 232, 0.85)";
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 1.8, 2.6, rot, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          drawAuraGlow(player.x, cy, r * 2.5, r * 1.75, rot, [
            [0, "rgba(255, 50, 50, 0.4)"],
            [0.55, "rgba(200, 0, 0, 0.18)"],
            [1, "rgba(180, 0, 0, 0)"],
          ]);
          strokeAuraBlob(
            player.x,
            cy,
            r * 1.55,
            r * 1.02,
            rot + 0.25,
            0.07,
            "rgba(255,80,80,0.35)",
            2.2
          );
        }
        ctx.restore();
      }
      if (fighterImg && fighterImg.complete) {
        const size = player.radius * 2;
        ctx.save();
        ctx.translate(player.x, player.y + floatY);
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
            const nudge =
              CBCosmetics.fighterHatNudge
                ? CBCosmetics.fighterHatNudge(player.id)
                : { ox: 0, oy: 0 };
            const hx = (hat.ox + nudge.ox) * player.radius - w / 2;
            const hy = (hat.oy + nudge.oy) * player.radius - hh / 2;
            ctx.drawImage(himg, hx, hy, w, hh);
          }
        }
        ctx.filter = "none";
        ctx.restore();
        if (player.flash > 0 && !sil) {
          ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, player.flash * 3)})`;
          ctx.beginPath();
          ctx.arc(player.x, player.y + floatY, player.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        drawEntityCircle(
          { x: player.x, y: player.y + floatY, radius: player.radius },
          sil ? "#000" : "#b22234"
        );
      }
      if (!sil) {
        drawHpBar(
          { x: player.x, y: player.y + floatY, radius: player.radius, hp: player.hp, maxHp: player.maxHp },
          fighterLabel()
        );
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
    let updateDt = sloMo ? rawDt * sloMo.scale : rawDt;
    let camDt = rawDt;
    if (plungeHitStop) {
      plungeHitStop.timer -= rawDt;
      updateDt *= plungeHitStop.scale;
      camDt *= plungeHitStop.scale;
      if (plungeHitStop.timer <= 0) plungeHitStop = null;
    }
    update(updateDt, camDt);
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

  return {
    init,
    start,
    stop,
    setRemoteSnapshot: setRemoteSnapshot,
    applyRemoteHit: applyRemoteHit,
    clearRemoteSnapshot: function () {
      remoteGhost = null;
      mpFoe = null;
    },
  };
})();
