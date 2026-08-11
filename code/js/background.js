/**
 * Arena backdrop: full-bleed map images (Plains / Icy).
 */
window.CBBackground = (function () {
  const cache = Object.create(null);

  function ensure(path) {
    if (cache[path]) return cache[path];
    const img = new Image();
    img.onload = function () {
      console.log("[CBBackground] loaded " + path);
    };
    img.onerror = function () {
      console.error("[CBBackground] failed " + path);
    };
    img.src = path;
    cache[path] = img;
    return img;
  }

  function update() {
    /* image BGs — no animated clouds */
  }

  function drawCover(ctx, img, width, height) {
    if (!img || !img.complete || !img.naturalWidth) return false;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(width / iw, height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
    return true;
  }

  /**
   * @param {string} [mapId] — "plains" | "icy"
   */
  function draw(ctx, width, height, timeSec, groundYOverride, mapId) {
    const groundY =
      typeof groundYOverride === "number" ? groundYOverride : height * 0.72;
    const id = mapId === "icy" ? "icy" : "plains";
    const path =
      id === "icy" ? "assets/icy.jpg" : "assets/plains-pixel.jpg";
    const img = ensure(path);

    if (!drawCover(ctx, img, width, height)) {
      // Fallback while loading
      ctx.fillStyle = id === "icy" ? "#8eb4c8" : "#5b8fc7";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = id === "icy" ? "#3a5f7a" : "#3a6e48";
      ctx.fillRect(0, groundY, width, height - groundY);
    }

    return groundY;
  }

  // Preload both
  ensure("assets/plains-pixel.jpg");
  ensure("assets/icy.jpg");

  return { update, draw, ensure };
})();
