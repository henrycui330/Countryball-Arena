/**
 * Smash-style win celebration: plains BG, character zoom, weapon flourish, #1.
 * USA — deagle twirl ×3 then barrel down.
 * Japan — twirl katana ×3 then raise in triumph.
 * Russia — Absolut twirl ×3 then tip down (same timing as USA).
 */
window.CBWinCelebration = (function () {
  const W = 960;
  const H = 540;

  let canvas = null;
  let ctx = null;
  let running = false;
  let rafId = 0;
  let lastTs = 0;
  let t = 0;
  let onDone = null;
  let fighter = "usa";

  let plainsImg = null;
  let usaImg = null;
  let japanImg = null;
  let russiaImg = null;
  let franceImg = null;
  let ukImg = null;
  let deagleImg = null;
  let katanaImg = null;
  let absolutImg = null;
  let baguetteImg = null;
  let umbrellaImg = null;

  let camZoom = 1;
  let camX = W / 2;
  let camY = H / 2;
  let shake = 0;

  let ballX = W * 0.5;
  let ballY = H * 0.7;
  let ballR = 96;
  const GRASS_Y = H * 0.7;

  // USA gun / Russia bottle angle
  let gunAngle = 0;
  let gunDip = 0;
  let drinkBob = 0;
  const GUN_POSE_ANGLE = Math.PI * (68 / 180);

  // Japan katana — tipAim is where the blade tip points (radians)
  let tipAim = -0.4;
  const KATANA = {
    w: 123,
    h: 116,
    pivotX: 96,
    pivotY: 27,
    tipX: 17,
    tipY: 96,
    rotOffset: Math.PI,
  };

  let showOne = false;
  let oneScale = 0.2;
  let oneAlpha = 0;

  const USA_PHASE = {
    INTRO: 0.4,
    TWIRL_END: 0.4 + 0.72,
    POSE_END: 0.4 + 0.72 + 0.35,
    ONE_SLAM: 0.4 + 0.72 + 0.35 + 0.3,
  };

  const JP_PHASE = {
    TWIRL_END: 0.85, // exactly 3 spins
    RAISE_END: 0.85 + 0.4, // swing up into triumph
    ONE_SLAM: 0.85 + 0.4 + 0.28,
  };

  const RU_PHASE = {
    LIFT_END: 0.45,
    DRINK_END: 0.45 + 1.1, // tip up and gulp
    HOLD_END: 0.45 + 1.1 + 0.35,
    ONE_SLAM: 0.45 + 1.1 + 0.35 + 0.28,
  };

  function ensureAssets() {
    if (!plainsImg) {
      plainsImg = new Image();
      plainsImg.src = "assets/plains-pixel.jpg";
      plainsImg.onload = function () {
        console.log("[CBWin] plains bg loaded");
      };
    }
    if (!usaImg) {
      usaImg = new Image();
      usaImg.src =
        (window.CBUsaAbilities && window.CBUsaAbilities.spritePath) ||
        "assets/usa.png";
    }
    if (!japanImg) {
      japanImg = new Image();
      japanImg.src =
        (window.CBJapanAbilities && window.CBJapanAbilities.spritePath) ||
        "assets/japan.png";
    }
    if (!deagleImg) {
      deagleImg = new Image();
      deagleImg.src =
        (window.CBUsaAbilities && window.CBUsaAbilities.deaglePath) ||
        "assets/deagle.png";
    }
    if (!katanaImg) {
      katanaImg = new Image();
      katanaImg.src =
        (window.CBJapanAbilities && window.CBJapanAbilities.katanaPath) ||
        "assets/katana.png";
    }
    if (!russiaImg) {
      russiaImg = new Image();
      russiaImg.src =
        (window.CBRussiaAbilities && window.CBRussiaAbilities.spritePath) ||
        "assets/russia.png";
    }
    if (!absolutImg) {
      absolutImg = new Image();
      absolutImg.src =
        (window.CBRussiaAbilities && window.CBRussiaAbilities.absolutPath) ||
        "assets/absolut.png";
    }
    if (!franceImg) {
      franceImg = new Image();
      franceImg.src =
        (window.CBFranceAbilities && window.CBFranceAbilities.spritePath) ||
        "assets/france.png";
    }
    if (!baguetteImg) {
      baguetteImg = new Image();
      baguetteImg.src =
        (window.CBFranceAbilities && window.CBFranceAbilities.baguettePath) ||
        "assets/baguette.webp";
    }
    if (!ukImg) {
      ukImg = new Image();
      ukImg.src =
        (window.CBUKAbilities && window.CBUKAbilities.spritePath) ||
        "assets/uk.png";
    }
    if (!umbrellaImg) {
      umbrellaImg = new Image();
      umbrellaImg.src =
        (window.CBUKAbilities && window.CBUKAbilities.umbrellaPath) ||
        "assets/umbrella.webp";
    }
    // Prefer equipped skin for win flourish
    if (window.CBCosmetics && CBCosmetics.getEquippedWeaponPath) {
      const usaPath = CBCosmetics.getEquippedWeaponPath("usa");
      if (usaPath) {
        deagleImg = new Image();
        deagleImg.src = usaPath;
      }
      const jpPath = CBCosmetics.getEquippedWeaponPath("japan");
      if (jpPath) {
        katanaImg = new Image();
        katanaImg.src = jpPath;
      }
      const ruPath = CBCosmetics.getEquippedWeaponPath("russia");
      if (ruPath) {
        absolutImg = new Image();
        absolutImg.src = ruPath;
      }
    }
  }

  function start(opts) {
    ensureAssets();
    canvas = document.getElementById("win-canvas");
    if (!canvas) {
      console.error("[CBWin] missing #win-canvas");
      if (opts && opts.onDone) opts.onDone();
      return;
    }
    ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = H;
    onDone = opts && opts.onDone;
    const f = opts && opts.fighter;
    fighter =
      f === "japan" || f === "russia" || f === "france" || f === "uk" ? f : "usa";
    ballR = fighter === "russia" ? 108 : 96;

    t = 0;
    lastTs = 0;
    ballY = GRASS_Y - ballR * 0.12;
    camZoom = 1.05;
    camX = ballX;
    camY = ballY - 10;
    shake = 0.4;
    gunAngle = -0.4;
    gunDip = 0;
    drinkBob = 0;
    tipAim = 0.35;
    showOne = false;
    oneScale = 0.15;
    oneAlpha = 0;
    running = true;

    const screen = document.getElementById("screen-win");
    const game = document.getElementById("screen-game");
    const result = document.getElementById("screen-result");
    if (game) game.classList.add("screen-hidden");
    if (result) result.classList.add("screen-hidden");
    if (screen) screen.classList.remove("screen-hidden");

    console.log("[CBWin] celebration start — fighter=" + fighter);
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function finish() {
    stop();
    console.log("[CBWin] celebration done");
    if (typeof onDone === "function") onDone();
  }

  function updateUsa(dt) {
    if (t < USA_PHASE.INTRO) {
      gunAngle = -0.5 + t * 0.4;
    } else if (t < USA_PHASE.TWIRL_END) {
      const u = (t - USA_PHASE.INTRO) / (USA_PHASE.TWIRL_END - USA_PHASE.INTRO);
      gunAngle = -0.3 + u * Math.PI * 2 * 3;
      gunDip = 0;
    } else if (t < USA_PHASE.POSE_END) {
      const u =
        (t - USA_PHASE.TWIRL_END) / (USA_PHASE.POSE_END - USA_PHASE.TWIRL_END);
      const ease = 1 - Math.pow(1 - u, 3);
      const from = (-0.3 + Math.PI * 2 * 3) % (Math.PI * 2);
      gunAngle = from + (GUN_POSE_ANGLE - from) * ease;
      gunDip = 22 * ease;
    } else {
      gunAngle = GUN_POSE_ANGLE;
      gunDip = 22;
    }

    if (t >= USA_PHASE.POSE_END) {
      showOne = true;
      const u = Math.min(1, (t - USA_PHASE.POSE_END) / 0.35);
      oneScale = u < 1 ? 1.35 - Math.pow(1 - u, 2) * 0.55 : 1;
      oneAlpha = Math.min(1, u * 1.4);
      if (u < 0.2) shake = Math.max(shake, 0.55);
    }
  }

  function updateJapan(dt) {
    const UP = -Math.PI / 2;
    const startAim = 0.35;

    if (t < JP_PHASE.TWIRL_END) {
      const u = t / JP_PHASE.TWIRL_END;
      tipAim = startAim + u * Math.PI * 2 * 3;
    } else if (t < JP_PHASE.RAISE_END) {
      const u =
        (t - JP_PHASE.TWIRL_END) / (JP_PHASE.RAISE_END - JP_PHASE.TWIRL_END);
      const ease = 1 - Math.pow(1 - u, 3);
      const twirlEnd = startAim + Math.PI * 2 * 3;
      let from = twirlEnd;
      while (from > UP + Math.PI) from -= Math.PI * 2;
      while (from < UP - Math.PI) from += Math.PI * 2;
      tipAim = from + (UP - from) * ease;
      if (u > 0.75) shake = Math.max(shake, 0.3);
    } else {
      tipAim = UP;
    }

    if (t >= JP_PHASE.RAISE_END) {
      showOne = true;
      const u = Math.min(1, (t - JP_PHASE.RAISE_END) / 0.35);
      oneScale = u < 1 ? 1.35 - Math.pow(1 - u, 2) * 0.55 : 1;
      oneAlpha = Math.min(1, u * 1.4);
      if (u < 0.2) shake = Math.max(shake, 0.55);
    }
  }

  function updateRussia(dt) {
    // Lift bottle → tip up to "drink" → hold triumph gulp → #1
    if (t < RU_PHASE.LIFT_END) {
      const u = t / RU_PHASE.LIFT_END;
      const ease = 1 - Math.pow(1 - u, 2);
      gunAngle = 0.2 + (-1.15 - 0.2) * ease;
      gunDip = -18 * ease;
      drinkBob = 0;
    } else if (t < RU_PHASE.DRINK_END) {
      const u =
        (t - RU_PHASE.LIFT_END) / (RU_PHASE.DRINK_END - RU_PHASE.LIFT_END);
      // Tip further up and bob like gulping
      gunAngle = -1.15 - 0.35 * Math.min(1, u * 1.2);
      gunDip = -18 - 8 * Math.sin(u * Math.PI * 4);
      drinkBob = Math.sin(u * Math.PI * 5) * 4;
      if (u > 0.15 && u < 0.85 && Math.random() > 0.7) {
        // occasional tiny shake while drinking
        shake = Math.max(shake, 0.12);
      }
    } else if (t < RU_PHASE.HOLD_END) {
      gunAngle = -1.45;
      gunDip = -22;
      drinkBob = 0;
    } else {
      gunAngle = -1.45;
      gunDip = -22;
      drinkBob = 0;
    }

    if (t >= RU_PHASE.HOLD_END) {
      showOne = true;
      const u = Math.min(1, (t - RU_PHASE.HOLD_END) / 0.35);
      oneScale = u < 1 ? 1.35 - Math.pow(1 - u, 2) * 0.55 : 1;
      oneAlpha = Math.min(1, u * 1.4);
      if (u < 0.2) shake = Math.max(shake, 0.55);
    }
  }

  function update(dt) {
    t += dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 1.2);

    const oneAt =
      fighter === "japan"
        ? JP_PHASE.ONE_SLAM
        : fighter === "russia"
          ? RU_PHASE.ONE_SLAM
          : USA_PHASE.ONE_SLAM;
    const targetZoom = t < oneAt ? 1.45 : 1.58;
    camZoom += (targetZoom - camZoom) * Math.min(1, 5 * dt);
    camX += (ballX - camX) * Math.min(1, 6 * dt);
    camY += (ballY - 8 - camY) * Math.min(1, 6 * dt);

    if (fighter === "japan") updateJapan(dt);
    else if (fighter === "russia") updateRussia(dt);
    else updateUsa(dt);
  }

  function drawBg() {
    if (plainsImg && plainsImg.complete && plainsImg.naturalWidth) {
      const iw = plainsImg.naturalWidth;
      const ih = plainsImg.naturalHeight;
      const scale = Math.max(W / iw, H / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(plainsImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#5ec8f0";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3cb043";
      ctx.fillRect(0, H * 0.7, W, H * 0.3);
    }
  }

  function drawGun() {
    const useBottle = fighter === "russia";
    const useBread = fighter === "france";
    const useBrolly = fighter === "uk";
    const handX = ballX + ballR * (useBottle ? 0.42 : 0.55);
    const handY =
      ballY +
      ballR * (useBottle ? -0.15 : useBrolly ? -0.05 : 0.08) +
      gunDip +
      (useBottle ? drinkBob : 0);
    const gw = useBottle ? 58 : useBread ? 130 : useBrolly ? 48 : 110;
    const gh = useBottle ? 100 : useBread ? 42 : useBrolly ? 110 : 60;
    const pivotX = useBottle ? gw * 0.5 : useBrolly ? gw * 0.5 : gw * 0.34;
    const pivotY = useBottle ? gh * 0.82 : useBrolly ? gh * 0.88 : gh * 0.58;
    const img = useBottle
      ? absolutImg
      : useBread
        ? baguetteImg
        : useBrolly
          ? umbrellaImg
          : deagleImg;

    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(gunAngle);
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, -pivotX, -pivotY, gw, gh);
    } else {
      ctx.fillStyle = "#aaa";
      ctx.fillRect(-pivotX, -pivotY, gw, gh);
    }
    ctx.restore();
  }

  function drawKatana() {
    const triumph = t >= JP_PHASE.TWIRL_END;
    const handX = ballX + ballR * 0.48;
    const handY = ballY + ballR * (triumph ? -0.55 : 0.05);

    const rot = tipAim + KATANA.rotOffset;

    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(rot);
    if (katanaImg && katanaImg.complete && katanaImg.naturalWidth) {
      ctx.drawImage(
        katanaImg,
        -KATANA.pivotX,
        -KATANA.pivotY,
        KATANA.w,
        KATANA.h
      );
    } else {
      ctx.fillStyle = "#ccc";
      ctx.fillRect(-KATANA.pivotX, -KATANA.pivotY, KATANA.w, KATANA.h);
    }
    ctx.restore();
  }

  function drawBall() {
    const img =
      fighter === "japan"
        ? japanImg
        : fighter === "russia"
          ? russiaImg
          : fighter === "france"
            ? franceImg
            : fighter === "uk"
              ? ukImg
              : usaImg;
    ctx.save();
    ctx.translate(ballX, ballY);
    if (img && img.complete && img.naturalWidth) {
      const size = ballR * 2;
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle =
        fighter === "japan"
          ? "#bc002d"
          : fighter === "russia"
            ? "#0039a6"
            : fighter === "france"
              ? "#002395"
              : fighter === "uk"
                ? "#012169"
                : "#b22234";
      ctx.beginPath();
      ctx.arc(0, 0, ballR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOne() {
    if (!showOne) return;
    ctx.save();
    ctx.globalAlpha = oneAlpha;
    ctx.translate(W * 0.5, H * 0.28);
    ctx.scale(oneScale, oneScale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.font = "bold 160px Impact, Haettenschweiler, Arial Black, sans-serif";
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 18;
    ctx.strokeText("#1", 0, 0);
    ctx.fillStyle =
      fighter === "japan"
        ? "#bc002d"
        : fighter === "russia"
          ? "#0039a6"
          : "#f7d354";
    ctx.fillText("#1", 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = oneAlpha * 0.35;
    ctx.fillText("#1", -4, -4);
    ctx.restore();
  }

  function drawHint() {
    const oneAt =
      fighter === "japan"
        ? JP_PHASE.ONE_SLAM
        : fighter === "russia"
          ? RU_PHASE.ONE_SLAM
          : USA_PHASE.ONE_SLAM;
    if (t < oneAt + 0.4) return;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#fff";
    ctx.font = "16px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Click Main Menu when ready", W / 2, H - 28);
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    let sx = 0;
    let sy = 0;
    if (shake > 0) {
      sx = (Math.random() - 0.5) * shake * 12;
      sy = (Math.random() - 0.5) * shake * 12;
    }
    ctx.translate(W / 2 + sx, H / 2 + sy);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-camX, -camY);

    drawBg();
    drawBall();
    if (fighter === "japan") drawKatana();
    else drawGun();
    ctx.restore();

    drawOne();
    drawHint();
  }

  function frame(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    draw();
    rafId = requestAnimationFrame(frame);
  }

  return { start, stop, finish, ensureAssets };
})();
