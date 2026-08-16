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
  let franceImg = null;
  let ukImg = null;
  let chinaImg = null;
  let canadaImg = null;
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
  let mpFxHideWeaponUntil = 0;
  let lastCosmeticsSent = null;
  let lastStateSent = null; // skip tiny pose deltas
  let netByteAcc = 0;
  let netByteTimer = 0;
  let roundBreak = null; // { timer, iAmLoser, matchEnd, title, sub }
  let mpRound = 1;
  let mpRoundSeq = 0;
  let mpAmHost = false;
  let lastRoundKoSeq = -1;

  function q1(n) {
    return Math.round(Number(n) || 0);
  }

  function noteNetBytes(obj) {
    try {
      netByteAcc += JSON.stringify(obj).length;
    } catch (_) {
      /* ignore */
    }
  }

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
          : c.fighter === "france"
            ? "france"
            : c.fighter === "uk"
              ? "uk"
              : c.fighter === "china"
                ? "china"
                : c.fighter === "canada"
                  ? "canada"
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
    if (matchConfig.fighter === "france" && window.CBFranceAbilities) {
      return window.CBFranceAbilities;
    }
    if (matchConfig.fighter === "uk" && window.CBUKAbilities) {
      return window.CBUKAbilities;
    }
    if (matchConfig.fighter === "china" && window.CBChinaAbilities) {
      return window.CBChinaAbilities;
    }
    if (matchConfig.fighter === "canada" && window.CBCanadaAbilities) {
      return window.CBCanadaAbilities;
    }
    return window.CBUsaAbilities;
  }

  function fighterLabel() {
    return abilities().name || "USA";
  }

  function pickFighterImg() {
    if (matchConfig.fighter === "japan") return japanImg;
    if (matchConfig.fighter === "russia") return russiaImg;
    if (matchConfig.fighter === "france") return franceImg;
    if (matchConfig.fighter === "uk") return ukImg;
    if (matchConfig.fighter === "china") return chinaImg;
    if (matchConfig.fighter === "canada") return canadaImg;
    return usaImg;
  }

  function fighterImgById(id) {
    if (id === "japan") return japanImg;
    if (id === "russia") return russiaImg;
    if (id === "france") return franceImg;
    if (id === "uk") return ukImg;
    if (id === "china") return chinaImg;
    if (id === "canada") return canadaImg;
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
            : matchConfig.fighter === "france"
              ? "france"
              : matchConfig.fighter === "uk"
                ? "uk"
                : matchConfig.fighter === "china"
                  ? "china"
                  : matchConfig.fighter === "canada"
                    ? "canada"
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
      moveVx: 0,
      grounded: true,
      plunging: false,
      freezeTimer: 0,
    };
    plungeFx = null;
    abilityLock = 0;
    speedBuff = null;
    dummy = null;
    enemy = null;
    mpFoe = null;
    mpPendingHit = 0;
    mpFxHideWeaponUntil = 0;
    lastCosmeticsSent = null;
    lastStateSent = null;
    netByteAcc = 0;
    netByteTimer = 0;
    remoteGhost = null;
    roundBreak = null;
    mpRound = 1;
    mpRoundSeq = 0;
    lastRoundKoSeq = -1;
    mpAmHost = false;
    if (isMultiplayer()) {
      const meId =
        window.CBNetClient && CBNetClient.getState
          ? CBNetClient.getState().playerId
          : null;
      const roster = matchConfig.players || [];
      const me = roster.find(function (pl) {
        return pl.id === meId;
      });
      const amHost = !!(me && me.isHost);
      mpAmHost = amHost;
      // Host on the right, guest(s) on the left — face each other.
      player.x = amHost ? W * 0.78 : W * 0.22;
      player.facing = amHost ? -1 : 1;
      mpFoe = {
        id: "remote",
        x: amHost ? W * 0.22 : W * 0.78,
        y: spawnY,
        radius: 42,
        hp: 100,
        maxHp: 100,
        flash: 0,
        vy: 0,
        grounded: true,
        facing: amHost ? 1 : -1,
        fighter: "usa",
        aimX: amHost ? W * 0.22 : W * 0.78,
        aimY: spawnY,
        hatId: null,
        weaponId: null,
        effectId: null,
        freezeTimer: 0,
        _tx: null,
        _ty: null,
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
    // Local time-scale desyncs MP clocks — never slow-mo online
    if (isMultiplayer()) {
      if (sloMo) clearFinisherSloMo();
      console.log("[CBGame] Finisher slo-mo skipped (MP)", label || "");
      return;
    }
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

  function clearArenaForRound() {
    if (window.CBEffects && CBEffects.clear) CBEffects.clear();
    if (window.CBAllies && CBAllies.clear) CBAllies.clear();
    clearPlungeFx();
    clearFinisherSloMo();
    if (player) {
      player.freezeTimer = 0;
      player._syrup = null;
      player.plunging = false;
      player.vy = 0;
      player.moveVx = 0;
      player.stunTimer = 0;
    }
    if (mpFoe) {
      mpFoe.freezeTimer = 0;
      mpFoe._syrup = null;
      mpFoe.plunging = false;
      mpFoe._hpHoldUntil = 0;
    }
    dashTimer = 0;
    holdingAttack = false;
    holdTime = 0;
    speedBuff = null;
  }

  function publishRoundKo(extra) {
    if (!isMultiplayer() || !window.CBNetClient || !CBNetClient.sendRoundKo) return;
    const net = CBNetClient.getState ? CBNetClient.getState() : null;
    if (!net || !net.connected || !net.roomCode) return;
    mpRoundSeq += 1;
    const payload = Object.assign(
      {
        loserPlayerId: net.playerId,
        livesLeft: playerLives,
        seq: mpRoundSeq,
        round: mpRound,
        ts: Date.now(),
      },
      extra || {}
    );
    lastRoundKoSeq = payload.seq;
    CBNetClient.sendRoundKo(payload);
    console.log(
      "[CBGame] round_ko sent livesLeft=" +
        payload.livesLeft +
        " seq=" +
        payload.seq
    );
  }

  function beginRoundBreak(opts) {
    const o = opts || {};
    if (!isMultiplayer() || matchOver) return;
    if (roundBreak) return;
    clearArenaForRound();
    const livesLeft = typeof o.livesLeft === "number" ? o.livesLeft : 0;
    const iAmLoser = !!o.iAmLoser;
    const matchEnd = livesLeft <= 0;
    const nextRound = mpRound + (matchEnd ? 0 : 1);
    roundBreak = {
      timer: matchEnd ? 1.35 : 1.85,
      iAmLoser: iAmLoser,
      matchEnd: matchEnd,
      title: iAmLoser ? "YOU WERE KO'D" : "RIVAL KO'D",
      sub: matchEnd
        ? iAmLoser
          ? "Defeat…"
          : "Victory!"
        : "Round " + nextRound + "  ·  Lives " + playerLives + "–" + foeLives,
    };
    statusMsg = roundBreak.title;
    statusTimer = roundBreak.timer + 0.2;
    invulnTimer = 99;
    abilityLock = 99;
    if (player) {
      player.hp = Math.max(0.01, player.hp);
      player.invuln = true;
      player.moveVx = 0;
      player.vy = 0;
    }
    if (window.CBCamera) window.CBCamera.addShake(0.35);
    console.log(
      "[CBGame] round_ko break loser=" +
        (iAmLoser ? "me" : "rival") +
        " livesLeft=" +
        livesLeft +
        " matchEnd=" +
        matchEnd
    );
  }

  function resetRoundSpawns() {
    const spawnY = (map && map.groundY != null ? map.groundY : H * 0.72) - 6;
    clearArenaForRound();
    mpRound += 1;
    if (player) {
      player.hp = player.maxHp;
      player.x = mpAmHost ? W * 0.78 : W * 0.22;
      player.y = spawnY;
      player.facing = mpAmHost ? -1 : 1;
      player.vy = 0;
      player.moveVx = 0;
      player.grounded = true;
      player.plunging = false;
      player.freezeTimer = 0;
      player._syrup = null;
      player.flash = 0;
    }
    if (mpFoe) {
      mpFoe.hp = mpFoe.maxHp || 100;
      mpFoe.x = mpAmHost ? W * 0.22 : W * 0.78;
      mpFoe.y = spawnY;
      mpFoe.facing = mpAmHost ? 1 : -1;
      mpFoe._tx = mpFoe.x;
      mpFoe._ty = mpFoe.y;
      mpFoe.freezeTimer = 0;
      mpFoe._syrup = null;
      mpFoe._hpHoldUntil = 0;
      mpFoe._koLatched = false;
      mpFoe.flash = 0;
    }
    if (remoteGhost) {
      remoteGhost.hp = remoteGhost.maxHp || 100;
      remoteGhost.x = mpFoe ? mpFoe.x : remoteGhost.x;
      remoteGhost.y = spawnY;
    }
    invulnTimer = 1.35;
    abilityLock = 0;
    if (player) player.invuln = true;
    statusMsg = "Round " + mpRound + " — Fight!";
    statusTimer = 1.4;
    console.log("[CBGame] round reset → Round " + mpRound);
  }

  function tickRoundBreak(dt) {
    if (!roundBreak) return;
    roundBreak.timer -= dt;
    if (player) {
      player.moveVx = 0;
      player.vy = 0;
    }
    if (roundBreak.timer > 0) return;
    const rb = roundBreak;
    roundBreak = null;
    if (rb.matchEnd) {
      endMatch(!rb.iAmLoser);
      return;
    }
    resetRoundSpawns();
  }

  function applyRemoteRoundKo(payload) {
    if (!isMultiplayer() || matchOver) return;
    const p = payload || {};
    const myId =
      window.CBNetClient && CBNetClient.getState
        ? CBNetClient.getState().playerId
        : null;
    if (typeof p.seq === "number") {
      if (p.seq === lastRoundKoSeq) return;
      lastRoundKoSeq = p.seq;
    }
    // We already started the break as the loser
    if (myId && p.loserPlayerId === myId) return;
    if (roundBreak) return;
    if (typeof p.livesLeft === "number") foeLives = p.livesLeft;
    beginRoundBreak({
      iAmLoser: false,
      livesLeft: typeof p.livesLeft === "number" ? p.livesLeft : foeLives,
    });
  }

  function castOpts(extra) {
    const o = Object.assign(
      { foeHp: foeHp(), foe: foe(), groundY: floorY() },
      extra || {}
    );
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
    if (!result || !result.ok) return;
    if (isMultiplayer()) {
      const extra = {};
      if (result.c4Action) extra.c4Action = result.c4Action;
      publishFx(label || "bash", extra);
    }
    if (!result.finisher) return;
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
    if (player.freezeTimer > 0) return false;
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
    if (window.CBMotion) CBMotion.punch(player, { squash: -0.18 });
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
    if (isMultiplayer()) publishFx("plunge");
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
    if (player.freezeTimer > 0) return;
    const cinema = window.CBEffects && window.CBEffects.getCinema
      ? window.CBEffects.getCinema()
      : null;
    if (abilityLock > 0 || (cinema && cinema.lockControl)) return;
    player.vy = JUMP_VY;
    player.grounded = false;
    if (window.CBMotion) CBMotion.punch(player, { squash: 0.18, land: 0 });
    console.log("[CBGame] jump");
  }

  function stepMove(dt, mx, moveMult) {
    if (!player) return;
    if (typeof player.moveVx !== "number") player.moveVx = 0;
    const airMul = player.grounded ? 1 : 0.9;
    const plungeMul = player.plunging ? 0.45 : 1;
    const cap = MOVE_SPEED * moveMult * airMul * plungeMul;
    const accel = player.grounded ? 3600 : 2200;
    const friction = player.grounded ? 3200 : 700;
    if (mx !== 0) {
      player.moveVx += mx * accel * dt;
      player.moveVx = Math.max(-cap, Math.min(cap, player.moveVx));
      player.facing = mx > 0 ? 1 : -1;
    } else {
      const fr = friction * dt;
      if (Math.abs(player.moveVx) <= fr) player.moveVx = 0;
      else player.moveVx -= Math.sign(player.moveVx) * fr;
      if (Math.abs(player.moveVx) > cap) {
        player.moveVx = Math.max(-cap, Math.min(cap, player.moveVx));
      }
    }
    player.x += player.moveVx * dt;
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

  function ultPassiveRate() {
    const ab = abilities();
    return ab && typeof ab.ultPassive === "number" ? ab.ultPassive : ULT_PASSIVE;
  }

  function ultDamageRate() {
    const ab = abilities();
    return ab && typeof ab.ultPerDamage === "number"
      ? ab.ultPerDamage
      : ULT_PER_DAMAGE;
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
    if (player && player.freezeTimer > 0) return;
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
    if (player && player.freezeTimer > 0) return;
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
    if (player && player.freezeTimer > 0) return;
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

  function koStyleId() {
    const id = playerAuraId();
    if (!id || id === "none") return "default";
    if (id === "wrath_of_the_gods") return "wrath";
    if (id === "uncle_sam") return "sam";
    if (id === "void_shroud") return "void";
    if (id === "solar_aegis") return "solar";
    return "default";
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
    const style = o.style || koStyleId();
    let vx = nx * (260 + 140 * power);
    let vy = o.vy != null ? o.vy : -300 - 90 * power;
    let spin = (Math.random() > 0.5 ? 1 : -1) * (9 + 5 * power);
    let duration = o.duration || 0.8;
    if (style === "wrath") {
      vx = 0;
      vy = 0;
      spin = 0;
      duration = o.duration || 0.72;
    } else if (style === "void") {
      vx = 0;
      vy = 0;
      spin = 0;
      duration = o.duration || 0.75;
    } else if (style === "solar") {
      vx = 0;
      vy = o.vy != null ? o.vy : -95;
      spin = 1.15;
      duration = o.duration || 0.85;
    } else if (style === "sam") {
      vx = 0;
      vy = 0;
      spin = 0;
      duration = o.duration || 0.78;
    }
    foeKoAnim = {
      kind: kind,
      style: style,
      x: entity.x,
      y: entity.y,
      originX: entity.x,
      originY: entity.y,
      radius: entity.radius || 38,
      vx: vx,
      vy: vy,
      rot: 0,
      spin: spin,
      scale: 1,
      alpha: 1,
      timer: duration,
      maxTimer: duration,
      flash: style === "wrath" ? 0.9 : 0.55,
      fxTimer: 0,
      isBot: kind === "enemy",
      enemySnapshot: kind === "enemy" ? Object.assign({}, entity) : null,
      pending: o.pending || buildFoeRespawn(kind),
    };
    if (window.CBCamera) {
      window.CBCamera.focusOn(entity.x, entity.y, 1.9, 1.0);
      window.CBCamera.addShake(style === "wrath" ? 0.72 : 0.55);
    }
    if (sloMo) {
      sloMo.endReal = Math.max(sloMo.endReal || 0, 1.0);
    } else {
      startFinisherSloMo("ko");
    }
    console.log("[CBGame] foe KO launch", kind, "style=" + style);
  }

  function completeFoeKo() {
    if (!foeKoAnim) return;
    const anim = foeKoAnim;
    foeKoAnim = null;
    triggerKoExplosion(anim.kind, anim.x, anim.y, anim.style);
    if (anim.pending) respawnEvent = anim.pending;
  }

  function updateFoeKo(dt) {
    if (!foeKoAnim) return;
    const a = foeKoAnim;
    const style = a.style || "default";
    a.timer -= dt;
    a.fxTimer = (a.fxTimer || 0) - dt;
    const prog = 1 - Math.max(0, a.timer) / (a.maxTimer || 0.8);

    if (style === "wrath") {
      a.x = a.originX + Math.sin(prog * 48) * 2.4;
      a.y = a.originY + Math.cos(prog * 36) * 1.6;
      a.rot = 0;
      a.spin = 0;
      a.scale = prog > 0.78 ? Math.max(0.2, 1 - (prog - 0.78) * 4) : 1;
      a.alpha = prog > 0.82 ? Math.max(0, 1 - (prog - 0.82) / 0.18) : 1;
      a.flash = 0.45 + Math.sin(prog * 22) * 0.25;
      if (a.fxTimer <= 0 && window.CBEffects && CBEffects.spawnWrathLightning) {
        a.fxTimer = 0.11;
        CBEffects.spawnWrathLightning(a.x, a.y, { count: 2 });
      }
    } else if (style === "void") {
      a.x = a.originX;
      a.y = a.originY;
      a.rot = 0;
      a.scale = Math.max(0.06, 1 - prog * 0.94);
      a.alpha = Math.max(0.15, 1 - prog * 0.55);
      a.flash = 0.2;
      if (window.CBEffects && Math.random() > 0.35) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 28 + Math.random() * 50;
        CBEffects.spawnParticle(
          a.x + Math.cos(ang) * dist,
          a.y + Math.sin(ang) * dist,
          {
            vx: Math.cos(ang) * -90,
            vy: Math.sin(ang) * -90,
            life: 0.22,
            size: 2 + Math.random() * 3,
            color: ["#a66bff", "#5f2a8a", "#e2ccff"][Math.floor(Math.random() * 3)],
            gravity: 0,
          }
        );
      }
    } else if (style === "sam") {
      a.x = a.originX;
      a.y = a.originY;
      a.rot = 0;
      a.spin = 0;
      a.scale = 1 + Math.sin(prog * Math.PI) * 0.18;
      a.alpha = prog > 0.72 ? Math.max(0, 1 - (prog - 0.72) / 0.28) : 1;
      a.flash = 0.35 + Math.sin(prog * 18) * 0.3;
      if (a.fxTimer <= 0 && window.CBEffects) {
        a.fxTimer = 0.07;
        const cols = ["#d7263d", "#ffffff", "#1f4ba5", "#f5f7ff"];
        const ang = Math.random() * Math.PI * 2;
        const spd = 70 + Math.random() * 90;
        CBEffects.spawnParticle(a.x, a.y, {
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 20,
          life: 0.32,
          size: 3 + Math.random() * 3,
          color: cols[Math.floor(Math.random() * cols.length)],
          gravity: 20,
        });
      }
    } else if (style === "solar") {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.spin * dt;
      a.scale = 1 + prog * 0.22;
      a.alpha = prog > 0.7 ? Math.max(0, 1 - (prog - 0.7) / 0.3) : 1;
      a.flash = 0.25 + prog * 0.45;
      if (window.CBEffects && Math.random() > 0.4) {
        CBEffects.spawnParticle(a.x, a.y + 8, {
          vx: (Math.random() - 0.5) * 40,
          vy: 40 + Math.random() * 50,
          life: 0.28,
          size: 2 + Math.random() * 3,
          color: ["#ffd76a", "#fff4c2", "#f6b73c"][Math.floor(Math.random() * 3)],
          gravity: -20,
        });
      }
    } else {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vy += GRAVITY * 0.48 * dt;
      a.rot += a.spin * dt;
      a.flash = Math.max(0, a.flash - dt * 1.5);
      if (prog > 0.5) a.scale = Math.max(0.12, 1 - (prog - 0.5) * 1.15);
      if (prog > 0.62) a.alpha = Math.max(0, 1 - (prog - 0.62) / 0.38);
      if (window.CBEffects && Math.random() > 0.45) {
        CBEffects.spawnParticle(a.x, a.y, {
          vx: (Math.random() - 0.5) * 110,
          vy: (Math.random() - 0.5) * 110,
          life: 0.24,
          size: 2 + Math.random() * 3,
          color: a.kind === "enemy" ? "#ffca28" : "#dddddd",
        });
      }
    }

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
      const tint =
        a.style === "wrath"
          ? "255,40,40"
          : a.style === "void"
            ? "140,80,255"
            : a.style === "solar"
              ? "255,220,100"
              : a.style === "sam"
                ? "255,255,255"
                : "255,255,255";
      ctx.fillStyle =
        "rgba(" + tint + "," + Math.min(0.9, a.flash * 2.2) + ")";
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

  function triggerKoExplosion(kind, x, y, style) {
    const FX = window.CBEffects;
    if (!FX) return;
    const st = style || (kind === "player" ? "default" : koStyleId());
    const power = kind === "enemy" ? 1.85 : kind === "dummy" ? 1.45 : 1.2;
    const red = ["#ff1a1a", "#ff4d4d", "#8b0000", "#ffffff", "#bf360c"];
    const defaultCols =
      kind === "enemy"
        ? ["#c62828", "#ffca28", "#ffffff", "#bf360c", "#f7d354"]
        : kind === "player"
          ? ["#b22234", "#3c3b6e", "#ffffff", "#f7d354"]
          : ["#888", "#ccc", "#444", "#fff"];

    function shake() {
      if (window.CBCamera) {
        window.CBCamera.focusOn(x, y, 1.6, 1.15);
        window.CBCamera.addShake(st === "wrath" ? 0.72 : 0.55);
      }
    }

    function boom(colors, pwr) {
      if (FX.spawnExplosion) {
        FX.spawnExplosion(x, y, { power: pwr || power, colors: colors });
      } else {
        FX.spawnBurst(x, y, 24, colors);
      }
      shake();
      console.log("[CBGame] KO explosion", kind, "style=" + st, Math.round(x), Math.round(y));
    }

    if (st === "wrath" && kind !== "player" && FX.spawnFinisherCross) {
      FX.spawnFinisherCross({
        x: x,
        y: y,
        radius: 52,
        colors: red,
        onDone: function () {
          boom(red, power);
        },
      });
      console.log("[CBGame] Wrath finisher cross");
      return;
    }
    if (st === "void" && kind !== "player") {
      if (FX.spawnImplosion) FX.spawnImplosion(x, y, { power: power });
      else boom(["#2a0a42", "#5f2a8a", "#a66bff", "#e2ccff"], 0.7);
      shake();
      console.log("[CBGame] KO void", kind, Math.round(x), Math.round(y));
      return;
    }
    if (st === "sam" && kind !== "player") {
      const rwb = ["#d7263d", "#ffffff", "#1f4ba5", "#f5f7ff", "#7a0014"];
      if (FX.spawnStarBurst) {
        FX.spawnStarBurst(x, y, { colors: rwb, count: 28 });
        FX.spawnStarBurst(x, y, { colors: rwb, count: 16 });
      } else {
        FX.spawnBurst(x, y, 28, rwb);
      }
      if (FX.spawnShockwave) {
        FX.spawnShockwave(x, y, {
          color: "rgba(215,38,61,0.75)",
          maxRadius: 150,
          life: 0.42,
        });
        FX.spawnShockwave(x, y, {
          color: "rgba(31,75,165,0.55)",
          maxRadius: 110,
          life: 0.36,
        });
      }
      shake();
      console.log("[CBGame] KO uncle sam stars", kind, Math.round(x), Math.round(y));
      return;
    }
    if (st === "solar" && kind !== "player") {
      const gold = ["#f6b73c", "#ffd76a", "#fff4c2", "#c9861a", "#ffffff"];
      boom(gold, power * 1.05);
      if (FX.spawnShockwave) {
        FX.spawnShockwave(x, y, {
          color: "rgba(255,215,106,0.8)",
          maxRadius: 160,
          life: 0.45,
        });
      }
      return;
    }
    boom(defaultCols, power);
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
      abilityLock > 0 ||
      (cinema && cinema.lockControl) ||
      !!(player && player.freezeTimer > 0) ||
      !!roundBreak;

    if (player && player.freezeTimer > 0) {
      player.moveVx = 0;
      if (player.plunging) {
        player.plunging = false;
        clearPlungeFx();
      }
    }

    addUlt(ultPassiveRate() * dt);

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

    const moveMult =
      (speedBuff ? speedBuff.mult : 1) *
      (player.id !== "france" &&
      window.CBEffects &&
      CBEffects.wineSlowAt &&
      CBEffects.wineSlowAt(player.x, player.y)
        ? 0.5
        : 1);

    if (dashTimer > 0) {
      dashTimer -= dt;
      player.x += dashVx * dt;
      player.y += dashVy * dt;
      player.moveVx = dashVx;
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
      stepMove(dt, mx, moveMult);
      applyPlayerPhysics(dt);
    } else {
      stepMove(dt, 0, moveMult);
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
    if (isMultiplayer()) syncMpFoeFromRemote(dt);
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

    if (window.CBMotion) {
      CBMotion.tick(player, dt);
      if (dummy) CBMotion.tick(dummy, dt);
      if (enemy) CBMotion.tick(enemy, dt);
      if (mpFoe) CBMotion.tick(mpFoe, dt);
    }

    const hitList = [];
    if (target && target.hp > 0) hitList.push(target);
    // Bot + MP: local human must be in hitList so remote syrup/wine zones can CC them
    if (isBotOpponent() || isMultiplayer()) hitList.push(player);
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
      addUlt((foeHpBefore - target.hp) * ultDamageRate());
    }
    if (isMultiplayer() && mpPendingHit > 0) {
      addUlt(mpPendingHit * ultDamageRate());
      mpPendingHit = 0;
    }

    if ((isBotOpponent() || isMultiplayer()) && player.hp < playerHpBefore) {
      invulnTimer = Math.max(invulnTimer, 0.35);
      player.invuln = true;
      console.log("[CBGame] player hit hp=" + player.hp);
    }

    // —— KO: launch away from player, then explode ——
    if (!respawnEvent && !matchOver && !foeKoAnim && !roundBreak) {
      if (matchConfig.opponent === "dummy" && dummy && dummy.hp <= 0) {
        handleFoeKo(dummy, "dummy");
      }

      if (isBotOpponent() && enemy && enemy.hp <= 0) {
        handleFoeKo(enemy, "enemy");
      }

      // Multiplayer: round break instead of soft solo respawn
      if (isMultiplayer() && player.hp <= 0) {
        triggerKoExplosion("player", player.x, player.y);
        player.hp = 0.01;
        player.invuln = true;
        invulnTimer = 99;
        player.plunging = false;
        player.vy = 0;
        player.moveVx = 0;
        clearPlungeFx();
        clearFinisherSloMo();
        if (playerLives != null) playerLives -= 1;
        console.log("[CBGame] player life lost →", playerLives);
        publishRoundKo({ livesLeft: playerLives });
        beginRoundBreak({
          iAmLoser: true,
          livesLeft: playerLives != null ? playerLives : 0,
        });
      } else if (isBotOpponent() && player.hp <= 0) {
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

    tickRoundBreak(dt);

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
    if (roundBreak || matchOver) return;
    const net = CBNetClient.getState ? CBNetClient.getState() : null;
    if (!net || !net.connected || !net.roomCode) return;
    netByteTimer += dt;
    if (netByteTimer >= 1) {
      if (netByteAcc > 0) {
        console.log("[CBGame] MP ~" + netByteAcc + " B/s outbound");
      }
      netByteAcc = 0;
      netByteTimer = 0;
    }
    netSendTimer -= dt;
    if (netSendTimer > 0) return;
    netSendTimer = 0.06; // ~16 Hz — lighter than 22 Hz
    const ballId = player.id;
    const hatId =
      window.CBCountryballs && CBCountryballs.getHatId
        ? CBCountryballs.getHatId(ballId)
        : null;
    const weaponId =
      window.CBCountryballs && CBCountryballs.getWeaponId
        ? CBCountryballs.getWeaponId(ballId)
        : null;
    const effectId =
      window.CBCountryballs && CBCountryballs.getEffectId
        ? CBCountryballs.getEffectId(ballId)
        : null;
    const cosKey = String(hatId || "") + "|" + String(weaponId || "") + "|" + String(effectId || "");
    const sendCosmetics = lastCosmeticsSent !== cosKey;
    if (sendCosmetics) lastCosmeticsSent = cosKey;

    const qx = q1(player.x);
    const qy = q1(player.y);
    const qhp = q1(player.hp);
    const qAimX = q1(player.aimX);
    const qAimY = q1(player.aimY);
    const plunging = !!player.plunging;
    const facing = player.facing >= 0 ? 1 : -1;
    const prev = lastStateSent;
    const poseIdle =
      prev &&
      !sendCosmetics &&
      Math.abs(prev.x - qx) < 2 &&
      Math.abs(prev.y - qy) < 2 &&
      prev.hp === qhp &&
      prev.lives === playerLives &&
      prev.facing === facing &&
      prev.plunging === plunging &&
      Math.abs(prev.aimX - qAimX) < 8 &&
      Math.abs(prev.aimY - qAimY) < 8;
    if (poseIdle) return;

    const payload = {
      playerId: net.playerId,
      x: qx,
      y: qy,
      hp: qhp,
      maxHp: q1(player.maxHp),
      facing: facing,
      fighter: player.id,
      radius: q1(player.radius),
      lives: playerLives,
      aimX: qAimX,
      aimY: qAimY,
      plunging: plunging,
      ts: Date.now(),
    };
    if (sendCosmetics) {
      payload.hatId = hatId;
      payload.weaponId = weaponId;
      payload.effectId = effectId;
      payload.cosmetics = true;
    }
    lastStateSent = {
      x: qx,
      y: qy,
      hp: qhp,
      lives: playerLives,
      facing: facing,
      plunging: plunging,
      aimX: qAimX,
      aimY: qAimY,
    };
    noteNetBytes(payload);
    if (CBNetClient.sendState) CBNetClient.sendState(payload);
  }

  function publishFx(kind, extra) {
    if (!isMultiplayer() || !window.CBNetClient || !CBNetClient.sendFx || !player) return;
    if (roundBreak || matchOver) return;
    const net = CBNetClient.getState ? CBNetClient.getState() : null;
    if (!net || !net.connected || !net.roomCode) return;
    // Slim FX: peer already has pose from state; cosmetics already synced separately
    const payload = Object.assign(
      {
        kind: kind,
        playerId: net.playerId,
        fighter: player.id,
        aimX: q1(player.aimX),
        aimY: q1(player.aimY),
        facing: player.facing >= 0 ? 1 : -1,
        ts: Date.now(),
      },
      extra || {}
    );
    noteNetBytes(payload);
    CBNetClient.sendFx(payload);
  }

  function remoteWeaponImg(fighterId, weaponId) {
    if (window.CBCosmetics && weaponId) {
      const w = CBCosmetics.getWeapon(weaponId);
      if (w && w._img && w._img.complete && w._img.naturalWidth) return w._img;
    }
    // Fall back to ability default art via a temporary follow entity cast path
    if (fighterId === "japan" && window.CBJapanAbilities && CBJapanAbilities.getMeleeWeapon) {
      const wpn = CBJapanAbilities.getMeleeWeapon({ id: "japan" });
      return (wpn && wpn.img) || null;
    }
    if (fighterId === "russia" && window.CBRussiaAbilities && CBRussiaAbilities.getMeleeWeapon) {
      const wpn = CBRussiaAbilities.getMeleeWeapon({ id: "russia" });
      return (wpn && wpn.img) || null;
    }
    if (fighterId === "france" && window.CBFranceAbilities && CBFranceAbilities.getMeleeWeapon) {
      const wpn = CBFranceAbilities.getMeleeWeapon({ id: "france" });
      return (wpn && wpn.img) || null;
    }
    if (fighterId === "uk" && window.CBUKAbilities && CBUKAbilities.getMeleeWeapon) {
      const wpn = CBUKAbilities.getMeleeWeapon({ id: "uk" });
      return (wpn && wpn.img) || null;
    }
    if (fighterId === "china" && window.CBChinaAbilities && CBChinaAbilities.getMeleeWeapon) {
      const wpn = CBChinaAbilities.getMeleeWeapon({ id: "china" });
      return (wpn && wpn.img) || null;
    }
    if (fighterId === "canada" && window.CBCanadaAbilities && CBCanadaAbilities.getMeleeWeapon) {
      const wpn = CBCanadaAbilities.getMeleeWeapon({ id: "canada" });
      return (wpn && wpn.img) || null;
    }
    if (window.CBUsaAbilities && CBUsaAbilities.getMeleeWeapon) {
      const wpn = CBUsaAbilities.getMeleeWeapon({ id: fighterId || "usa" });
      return (wpn && wpn.img) || null;
    }
    return null;
  }

  function syncMpFoeFromRemote(dt) {
    if (!isMultiplayer() || !mpFoe || !remoteGhost) return;
    if (roundBreak) return;
    if (mpFxHideWeaponUntil > 0) {
      mpFxHideWeaponUntil = Math.max(0, mpFxHideWeaponUntil - (dt || 0));
    }
    const tx = remoteGhost.x;
    const ty = remoteGhost.y;
    mpFoe._tx = tx;
    mpFoe._ty = ty;
    // While syrup-frozen, hold pose (peer is also locked on their client)
    if (!(mpFoe.freezeTimer > 0)) {
      const k = Math.min(1, (dt || 0.016) * 14);
      mpFoe.x += (tx - mpFoe.x) * k;
      mpFoe.y += (ty - mpFoe.y) * k;
    }
    mpFoe.radius = remoteGhost.radius || mpFoe.radius;
    mpFoe.facing = remoteGhost.facing;
    mpFoe.fighter = remoteGhost.fighter || mpFoe.fighter;
    mpFoe.maxHp = remoteGhost.maxHp || mpFoe.maxHp;
    const remoteHp = Math.max(0, remoteGhost.hp);
    const hold =
      mpFoe._hpHoldUntil && Date.now() < mpFoe._hpHoldUntil && mpFoe.hp < remoteHp;
    mpFoe.hp = hold ? mpFoe.hp : remoteHp;
    if (!hold) mpFoe._hpHoldUntil = 0;
    mpFoe.aimX = typeof remoteGhost.aimX === "number" ? remoteGhost.aimX : mpFoe.x + mpFoe.facing * 80;
    mpFoe.aimY = typeof remoteGhost.aimY === "number" ? remoteGhost.aimY : mpFoe.y;
    if (remoteGhost.hatId !== undefined) mpFoe.hatId = remoteGhost.hatId || null;
    if (remoteGhost.weaponId !== undefined) mpFoe.weaponId = remoteGhost.weaponId || null;
    if (remoteGhost.effectId !== undefined) mpFoe.effectId = remoteGhost.effectId || null;
    mpFoe.plunging = !!remoteGhost.plunging;
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
    const prev = remoteGhost;
    remoteGhost = {
      x: s.x,
      y: s.y,
      hp: typeof s.hp === "number" ? s.hp : prev && typeof prev.hp === "number" ? prev.hp : 100,
      maxHp: typeof s.maxHp === "number" ? s.maxHp : prev && prev.maxHp ? prev.maxHp : 100,
      facing: s.facing >= 0 ? 1 : -1,
      fighter: s.fighter || (prev && prev.fighter) || "usa",
      radius: typeof s.radius === "number" ? s.radius : prev && prev.radius ? prev.radius : 42,
      lives: typeof s.lives === "number" ? s.lives : prev ? prev.lives : null,
      playerId: s.playerId || null,
      aimX: typeof s.aimX === "number" ? s.aimX : s.x,
      aimY: typeof s.aimY === "number" ? s.aimY : s.y,
      hatId: s.cosmetics ? s.hatId || null : prev ? prev.hatId : s.hatId || null,
      weaponId: s.cosmetics ? s.weaponId || null : prev ? prev.weaponId : s.weaponId || null,
      effectId: s.cosmetics ? s.effectId || null : prev ? prev.effectId : s.effectId || null,
      plunging: !!s.plunging,
      ts: typeof s.ts === "number" ? s.ts : Date.now(),
    };
    // Also accept cosmetics if fields present without flag (compat)
    if (!s.cosmetics) {
      if (s.hatId !== undefined) remoteGhost.hatId = s.hatId || null;
      if (s.weaponId !== undefined) remoteGhost.weaponId = s.weaponId || null;
      if (s.effectId !== undefined) remoteGhost.effectId = s.effectId || null;
    }
    if (typeof s.lives === "number") foeLives = s.lives;
    if (mpFoe && mpFoe._tx == null) {
      mpFoe.x = s.x;
      mpFoe.y = s.y;
      mpFoe._tx = s.x;
      mpFoe._ty = s.y;
      if (s.fighter) mpFoe.fighter = s.fighter;
    }
  }

  function applyRemoteHit(payload) {
    if (!isMultiplayer() || !player || matchOver || roundBreak) return;
    const amount = Math.max(0, Number(payload && payload.amount) || 0);
    if (amount <= 0) return;
    if (invulnTimer > 0 || player.invuln) return;
    const before = player.hp;
    player.hp = Math.max(0, player.hp - amount);
    player.flash = 0.35;
    invulnTimer = Math.max(invulnTimer, 0.28);
    player.invuln = true;
    if (window.CBEffects && window.CBEffects.spawnShockwave) {
      window.CBEffects.spawnShockwave(player.x, player.y, {
        maxRadius: 70,
        color: "rgba(255,255,255,0.45)",
        width: 2.4,
        life: 0.22,
      });
    }
    console.log(
      "[CBGame] remote hit dmg=" + amount + " hp " + before + "->" + player.hp
    );
  }

  function applyRemoteFx(payload) {
    if (!isMultiplayer() || !mpFoe || !window.CBEffects || roundBreak) return;
    const p = payload || {};
    const kind = p.kind;
    if (!kind) return;
    // Aim / cosmetics only — do NOT snap x/y (that fights lerp and looks laggy)
    if (typeof p.aimX === "number") mpFoe.aimX = p.aimX;
    if (typeof p.aimY === "number") mpFoe.aimY = p.aimY;
    if (typeof p.facing === "number") mpFoe.facing = p.facing >= 0 ? 1 : -1;
    if (p.fighter) mpFoe.fighter = p.fighter;
    if (p.weaponId) mpFoe.weaponId = p.weaponId;
    if (p.effectId) mpFoe.effectId = p.effectId;

    const fighter = mpFoe.fighter || "usa";
    const img = remoteWeaponImg(fighter, mpFoe.weaponId);
    const aimX = mpFoe.aimX;
    const aimY = mpFoe.aimY;
    const follow = mpFoe;
    const remoteOwnerId = p.playerId
      ? "remote:" + String(p.playerId)
      : "remote-fx";

    // Hide idle weapon while swing FX owns the sprite
    if (kind === "bash" || kind === "charged" || kind === "plunge") {
      mpFxHideWeaponUntil = Math.max(mpFxHideWeaponUntil, 0.55);
    }

    if (kind === "bash") {
      if (fighter === "japan" && CBEffects.spawnKatanaStrike) {
        CBEffects.spawnKatanaStrike({
          follow: follow,
          img: img,
          aimX: aimX,
          aimY: aimY,
          damage: 0,
          ownerId: "remote-fx",
        });
      } else if (CBEffects.spawnDeagleBash) {
        CBEffects.spawnDeagleBash({
          follow: follow,
          img: img,
          aimX: aimX,
          aimY: aimY,
          damage: 0,
          ownerId: "remote-fx",
        });
      }
      return;
    }
    if (kind === "charged") {
      if (fighter === "japan" && CBEffects.spawnKatanaCharge) {
        CBEffects.spawnKatanaCharge({
          follow: follow,
          img: img,
          aimX: aimX,
          aimY: aimY,
          damage: 0,
          ownerId: "remote-fx",
        });
        mpFxHideWeaponUntil = Math.max(mpFxHideWeaponUntil, 0.85);
      } else if (
        (fighter === "france" || fighter === "uk" || fighter === "china" || fighter === "canada") &&
        CBEffects.spawnSpriteProjectile
      ) {
        const dx = (aimX || mpFoe.x + 80) - mpFoe.x;
        const dy = (aimY || mpFoe.y) - mpFoe.y;
        const len = Math.hypot(dx, dy) || 1;
        const throwImg =
          fighter === "uk" && window.CBUKAbilities && CBUKAbilities.getTeaImage
            ? CBUKAbilities.getTeaImage()
            : fighter === "china" &&
                window.CBChinaAbilities &&
                CBChinaAbilities.getDumplingImage
              ? CBChinaAbilities.getDumplingImage()
              : fighter === "canada" &&
                  window.CBCanadaAbilities &&
                  CBCanadaAbilities.getPuckImage
                ? CBCanadaAbilities.getPuckImage()
                : img;
        CBEffects.spawnSpriteProjectile(mpFoe.x, mpFoe.y, {
          vx: (dx / len) * 480,
          vy: (dy / len) * 480 - 40,
          life: 1.2,
          radius: 20,
          damage: 0,
          ownerId: "remote-fx",
          img: throwImg,
          w: fighter === "uk" ? 44 : fighter === "china" ? 48 : fighter === "canada" ? 34 : 88,
          h: fighter === "uk" ? 40 : fighter === "china" ? 48 : fighter === "canada" ? 34 : 28,
          rot: Math.atan2(dy, dx),
          spin: 8,
          gravity: 380,
        });
        mpFxHideWeaponUntil = Math.max(mpFxHideWeaponUntil, 0.55);
      } else if (CBEffects.spawnDeagleSpin) {
        CBEffects.spawnDeagleSpin({
          follow: follow,
          img: img,
          aimX: aimX,
          aimY: aimY,
          damage: 0,
          ownerId: "remote-fx",
        });
        mpFxHideWeaponUntil = Math.max(mpFxHideWeaponUntil, 0.85);
      }
      return;
    }
    if (kind === "special") {
      if (fighter === "france" && CBEffects.spawnWineSpill) {
        const fx = (mpFoe.facing || 1) >= 0 ? 1 : -1;
        CBEffects.spawnWineSpill({
          x: mpFoe.x + fx * 78,
          y: mpFoe.y + (mpFoe.radius || 42) * 0.55,
          rx: 130,
          ry: 38,
          life: 5,
          ownerId: "remote-fx",
        });
      } else if (fighter === "uk" && CBEffects.spawnAcidRain) {
        const fx = (mpFoe.facing || 1) >= 0 ? 1 : -1;
        CBEffects.spawnAcidRain({
          x: mpFoe.x + fx * 70,
          y: mpFoe.y - 20,
          rx: 155,
          ry: 110,
          life: 5,
          damage: 0,
          ownerId: "remote-fx",
        });
      } else if (fighter === "canada" && CBEffects.spawnSyrupSpill) {
        const fx = (mpFoe.facing || 1) >= 0 ? 1 : -1;
        const syrupImg =
          window.CBCanadaAbilities && CBCanadaAbilities.getSyrupImage
            ? CBCanadaAbilities.getSyrupImage()
            : null;
        CBEffects.spawnSyrupSpill({
          x: mpFoe.x + fx * 78,
          y: mpFoe.y + (mpFoe.radius || 42) * 0.55,
          rx: 140,
          ry: 42,
          life: 16,
          ownerId: remoteOwnerId,
          img: syrupImg,
        });
      } else if (fighter === "china" && CBEffects.spawnDumplingMine) {
        const fx = (mpFoe.facing || 1) >= 0 ? 1 : -1;
        const dumpImg =
          window.CBChinaAbilities && CBChinaAbilities.getDumplingImage
            ? CBChinaAbilities.getDumplingImage()
            : null;
        const existing =
          typeof CBEffects.getDumplingMine === "function"
            ? CBEffects.getDumplingMine(remoteOwnerId)
            : null;
        const action = p.c4Action || null;
        if (action === "detonate" || (!action && existing)) {
          if (existing && CBEffects.detonateDumplingMine) {
            CBEffects.detonateDumplingMine(existing, { damage: 0, radius: 118 });
          }
        } else {
          if (existing) {
            // Stale mine from a dropped detonate packet — clear before re-plant
            existing.armed = false;
            existing.life = 0;
          }
          CBEffects.spawnDumplingMine({
            x: mpFoe.x + fx * 28,
            y: mpFoe.y + (mpFoe.radius || 42) * 0.55,
            img: dumpImg,
            w: 52,
            h: 52,
            life: 18,
            ownerId: remoteOwnerId,
            damage: 0,
            radius: 118,
          });
        }
      } else if (CBEffects.spawnBurst) {
        CBEffects.spawnBurst(aimX, aimY, 10, ["#ffffff", "#f0c43a", "#b22234"]);
      }
      return;
    }
    if (kind === "ult") {
      if (fighter === "france" && CBEffects.spawnBaguetteMissile) {
        const gy = typeof mpFoe.y === "number" ? mpFoe.y + 8 : 360;
        for (let i = 0; i < 3; i++) {
          CBEffects.spawnBaguetteMissile({
            x: mpFoe.x + (i - 1) * 22,
            y: -30 - i * 50,
            vx: (Math.random() - 0.5) * 40,
            vy: 260,
            impactX: mpFoe.x + (i - 1) * 22,
            groundY: gy,
            delay: i * 0.14,
            img: img,
            w: 150,
            h: 50,
            damage: 0,
            ownerId: "remote-fx",
          });
        }
      } else if (fighter === "uk" && CBEffects.spawnWarship) {
        const dir = (mpFoe.facing || 1) >= 0 ? 1 : -1;
        const gy = typeof mpFoe.y === "number" ? mpFoe.y + 8 : 360;
        const shipImg =
          window.CBUKAbilities && CBUKAbilities.getShipImage
            ? CBUKAbilities.getShipImage()
            : img;
        CBEffects.spawnWarship({
          x: dir > 0 ? -1000 : 1960,
          groundY: gy,
          vx: dir * 430,
          w: 2240,
          h: 840,
          img: shipImg,
          facing: dir,
          damage: 0,
          ownerId: "remote-fx",
          hitH: 92,
        });
      } else if (fighter === "canada" && CBEffects.spawnSyrupBomb) {
        const syrupImg =
          window.CBCanadaAbilities && CBCanadaAbilities.getSyrupImage
            ? CBCanadaAbilities.getSyrupImage()
            : null;
        const gy = typeof mpFoe.y === "number" ? mpFoe.y + 8 : 360;
        for (let i = 0; i < 9; i++) {
          CBEffects.spawnSyrupBomb({
            x: mpFoe.x + (i - 4) * 55,
            y: -40 - i * 40,
            vy: 340,
            groundY: gy,
            delay: i * 0.1,
            img: syrupImg,
            damage: 0,
            ownerId: "remote-fx",
          });
        }
      } else if (fighter === "china" && CBEffects.spawnSocialCredit) {
        const socialImg =
          window.CBChinaAbilities && CBChinaAbilities.getSocialImage
            ? CBChinaAbilities.getSocialImage()
            : null;
        CBEffects.spawnSocialCredit({
          follow: player,
          img: socialImg,
          ownerId: "remote-fx",
          damage: 0,
          life: 1.65,
          executeAt: 99,
        });
      } else if (CBEffects.spawnBurst) {
        CBEffects.spawnBurst(mpFoe.x, mpFoe.y, 16, ["#f0c43a", "#ffffff", "#ff4d4d"]);
      }
      return;
    }
    if (kind === "plunge") {
      if (CBEffects.spawnPlungeAttack) {
        CBEffects.spawnPlungeAttack({
          follow: follow,
          img: img,
          aimX: mpFoe.x,
          aimY: mpFoe.y + 40,
          damage: 0,
          ownerId: "remote-fx",
        });
      }
    }
  }

  function flushMpHits(foeHpBefore) {
    if (!isMultiplayer() || !mpFoe || !window.CBNetClient) return;
    if (!(mpFoe.hp < foeHpBefore)) return;
    const amount = foeHpBefore - mpFoe.hp;
    mpPendingHit += amount;
    // Keep optimistic HP so the rival visibly takes damage (authority catches up via state)
    const nextHp = Math.max(0, foeHpBefore - amount);
    mpFoe.hp = nextHp;
    mpFoe.flash = 0.4;
    mpFoe._hpHoldUntil = Date.now() + 450;
    if (remoteGhost) remoteGhost.hp = nextHp;
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
    console.log("[CBGame] MP hit sent dmg=" + amount.toFixed(1) + " foeHp→" + nextHp.toFixed(1));
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

  function drawRemoteRival(sil) {
    if (!mpFoe) return;
    const gx = mpFoe.x;
    const gy = mpFoe.y;
    const gr = mpFoe.radius || 42;
    const facing = mpFoe.facing >= 0 ? 1 : -1;
    const auraId = mpFoe.effectId;
    const auraOn = !!(auraId && auraId !== "none");
    let floatY = 0;
    if (auraOn) {
      floatY = -3 + Math.sin(timeSec * 2.8) * 1.2;
    }
    const cy = gy + floatY;
    const gImg = fighterImgById(mpFoe.fighter || "usa");
    const spriteOk = !!(gImg && gImg.complete && gImg.naturalWidth > 0);

    // Soft aura BEHIND sprite — low alpha so Japan isn't a light blob
    if (auraOn && !sil) {
      ctx.save();
      ctx.globalAlpha = 0.38;
      const rot = facing < 0 ? -0.2 : 0.2;
      if (auraId === "uncle_sam") {
        drawAuraGlow(gx, cy, gr * 1.9, gr * 1.35, rot, [
          [0, "rgba(255, 255, 255, 0.2)"],
          [0.45, "rgba(31, 75, 165, 0.18)"],
          [1, "rgba(122, 0, 20, 0)"],
        ]);
      } else if (auraId === "void_shroud") {
        drawAuraGlow(gx, cy, gr * 1.85, gr * 1.25, rot, [
          [0, "rgba(226, 204, 255, 0.18)"],
          [0.5, "rgba(95, 42, 138, 0.16)"],
          [1, "rgba(16, 8, 24, 0)"],
        ]);
      } else if (auraId === "solar_aegis") {
        drawAuraGlow(gx, cy, gr * 1.7, gr * 1.9, rot, [
          [0, "rgba(255, 249, 232, 0.22)"],
          [0.5, "rgba(255, 215, 106, 0.14)"],
          [1, "rgba(201, 134, 26, 0)"],
        ]);
      } else if (auraId === "wrath_of_the_gods") {
        drawAuraGlow(gx, cy, gr * 1.85, gr * 1.3, rot, [
          [0, "rgba(255, 50, 50, 0.22)"],
          [0.55, "rgba(200, 0, 0, 0.12)"],
          [1, "rgba(180, 0, 0, 0)"],
        ]);
      }
      ctx.restore();
    }

    if (spriteOk) {
      const sz = gr * 2;
      ctx.save();
      ctx.translate(gx, cy);
      if (window.CBMotion) CBMotion.apply(ctx, mpFoe);
      if (facing < 0) ctx.scale(-1, 1);
      if (sil) ctx.filter = "brightness(0)";
      ctx.drawImage(gImg, -sz / 2, -sz / 2, sz, sz);
      if (!sil && window.CBCosmetics && mpFoe.hatId) {
        const hat = CBCosmetics.getHat(mpFoe.hatId);
        const himg = hat && hat._img;
        if (hat && himg && himg.complete && himg.naturalWidth) {
          const aspect = himg.naturalWidth / himg.naturalHeight;
          const w = gr * 2 * hat.scale;
          const hh = w / aspect;
          const nudge =
            CBCosmetics.fighterHatNudge
              ? CBCosmetics.fighterHatNudge(mpFoe.fighter, mpFoe.hatId)
              : { ox: 0, oy: 0 };
          const hx = (hat.ox + nudge.ox) * gr - w / 2;
          const hy = (hat.oy + nudge.oy) * gr - hh / 2;
          ctx.drawImage(himg, hx, hy, w, hh);
        }
      }
      ctx.filter = "none";
      ctx.restore();
    } else {
      // Quiet fallback — no glowing circle
      ctx.save();
      ctx.globalAlpha = 0.9;
      drawEntityCircle({ x: gx, y: cy, radius: gr, flash: 0 }, "#6b7a94");
      ctx.restore();
      console.warn(
        "[CBGame] remote sprite not ready fighter=" +
          (mpFoe.fighter || "?") +
          " complete=" +
          !!(gImg && gImg.complete) +
          " w=" +
          (gImg && gImg.naturalWidth)
      );
    }

    // Idle weapon only when FX swing is not owning the weapon
    if (!sil && !mpFoe.plunging && mpFxHideWeaponUntil <= 0) {
      const img = remoteWeaponImg(mpFoe.fighter, mpFoe.weaponId);
      if (img && img.complete && img.naturalWidth) {
        const aimX = typeof mpFoe.aimX === "number" ? mpFoe.aimX : gx + facing * 80;
        const aimY = typeof mpFoe.aimY === "number" ? mpFoe.aimY : cy;
        const ang = Math.atan2(aimY - cy, aimX - gx);
        const handDist = gr * 0.5;
        const hx = gx + Math.cos(ang) * handDist;
        const hy = cy + Math.sin(ang) * handDist;
        const ww =
          mpFoe.fighter === "japan"
            ? 78
            : mpFoe.fighter === "france"
              ? 90
              : mpFoe.fighter === "uk"
                ? 36
                : mpFoe.fighter === "china"
                  ? 88
                  : mpFoe.fighter === "canada"
                    ? 96
                    : 68;
        const wh =
          mpFoe.fighter === "japan"
            ? 22
            : mpFoe.fighter === "russia"
              ? 52
              : mpFoe.fighter === "france"
                ? 30
                : mpFoe.fighter === "uk"
                  ? 78
                  : mpFoe.fighter === "china"
                    ? 66
                    : mpFoe.fighter === "canada"
                      ? 36
                      : 37;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(ang);
        ctx.drawImage(img, -ww * 0.34, -wh * 0.55, ww, wh);
        ctx.restore();
      }
    }

    if (mpFoe.flash > 0 && !sil) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, mpFoe.flash * 2.5)})`;
      ctx.beginPath();
      ctx.arc(gx, cy, gr, 0, Math.PI * 2);
      ctx.fill();
    }
    if (mpFoe.freezeTimer > 0 && !sil) {
      ctx.fillStyle = "rgba(180, 230, 255, 0.45)";
      ctx.beginPath();
      ctx.arc(gx, cy, gr + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(220, 245, 255, 0.9)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (!sil) {
      const label =
        mpFoe.fighter === "japan"
          ? "Japan"
          : mpFoe.fighter === "russia"
            ? "Russia"
            : mpFoe.fighter === "france"
              ? "France"
              : mpFoe.fighter === "uk"
                ? "UK"
                : mpFoe.fighter === "china"
                  ? "China"
                : mpFoe.fighter === "canada"
                  ? "Canada"
                : mpFoe.fighter === "usa"
                ? "USA"
                : "Rival";
      drawHpBar({ x: gx, y: cy, radius: gr, hp: mpFoe.hp, maxHp: mpFoe.maxHp }, label);
    }
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
    if (roundBreak) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, H * 0.28, W, 120);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 36px Trebuchet MS, sans-serif";
      ctx.fillText(roundBreak.title || "KO", W / 2, H * 0.28 + 48);
      ctx.font = "18px Trebuchet MS, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillText(roundBreak.sub || "", W / 2, H * 0.28 + 82);
      ctx.restore();
      return;
    }
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
      } else if (window.CBMotion) {
        CBMotion.wrap(ctx, dummy, function () {
          drawEntityCircle(dummy, "#6b6b6b");
          ctx.fillStyle = "#222";
          ctx.beginPath();
          ctx.arc(dummy.x - 12, dummy.y - 8, 5, 0, Math.PI * 2);
          ctx.arc(dummy.x + 12, dummy.y - 8, 5, 0, Math.PI * 2);
          ctx.fill();
        });
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
        if (window.CBMotion) {
          CBMotion.wrap(ctx, enemy, function () {
            enemyApi().draw(ctx, enemy);
          });
        } else {
          enemyApi().draw(ctx, enemy);
        }
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
        drawRemoteRival(sil);
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
        if (window.CBMotion) CBMotion.apply(ctx, player);
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
                ? CBCosmetics.fighterHatNudge(player.id, hatId)
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
        if (player.freezeTimer > 0 && !sil) {
          ctx.fillStyle = "rgba(180, 230, 255, 0.45)";
          ctx.beginPath();
          ctx.arc(player.x, player.y + floatY, player.radius + 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(220, 245, 255, 0.9)";
          ctx.lineWidth = 3;
          ctx.stroke();
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

    franceImg = new Image();
    franceImg.onload = function () {
      console.log("[CBGame] France sprite loaded");
    };
    franceImg.onerror = function () {
      console.error("[CBGame] failed to load assets/france.png");
    };
    franceImg.src = "assets/france.png";

    ukImg = new Image();
    ukImg.onload = function () {
      console.log("[CBGame] UK sprite loaded");
    };
    ukImg.onerror = function () {
      console.error("[CBGame] failed to load assets/uk.png");
    };
    ukImg.src = "assets/uk.png";

    chinaImg = new Image();
    chinaImg.onload = function () {
      console.log("[CBGame] China sprite loaded");
    };
    chinaImg.onerror = function () {
      console.error("[CBGame] failed to load assets/china.png");
    };
    chinaImg.src = "assets/china.png";

    canadaImg = new Image();
    canadaImg.onload = function () {
      console.log("[CBGame] Canada sprite loaded");
    };
    canadaImg.onerror = function () {
      console.error("[CBGame] failed to load assets/canada.png");
    };
    canadaImg.src = "assets/canada.png";
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
    applyRemoteFx: applyRemoteFx,
    applyRemoteRoundKo: applyRemoteRoundKo,
    clearRemoteSnapshot: function () {
      remoteGhost = null;
      mpFoe = null;
    },
  };
})();
