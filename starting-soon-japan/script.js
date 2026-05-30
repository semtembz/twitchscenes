/* =========================================================================
   STREAM STARTING SOON — pixel Japan
   - Auto-pixelates your photo onto the left panel (drop any image in, no prep)
   - Gentle pixel sakura petals over the right side
   - A loading bar that fills once over `seconds` (default 60); timer is internal
   ========================================================================= */
(() => {
  const params = new URLSearchParams(location.search);
  const num = (k, d) => Number(params.get(k)) || d;

  /* ---------- optional handle ---------- */
  const handle = params.get('handle');
  if (handle) {
    const el = document.getElementById('handle');
    el.textContent = handle;
    el.hidden = false;
  }

  /* =====================================================================
     1. PHOTO — pixelate any image onto the left canvas
     ===================================================================== */
  const photoCanvas = document.getElementById('photoCanvas');
  const pctx = photoCanvas.getContext('2d');
  const PHOTO_SRC = params.get('photo') || 'assets/intro-photo.jpg';
  const DETAIL = num('pixel', 180);   // downsample width; lower = chunkier pixels

  // Draw `img` so it covers a w x h box (object-fit: cover), centered.
  function coverDraw(ctx, img, w, h) {
    const ir = img.width / img.height, tr = w / h;
    let dw, dh;
    if (ir > tr) { dh = h; dw = h * ir; } else { dw = w; dh = w / ir; }
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function pixelatePhoto(img) {
    const W = photoCanvas.width, H = photoCanvas.height;
    const dsW = DETAIL, dsH = Math.round(DETAIL * (H / W));
    // 1) downscale smoothly into a tiny offscreen canvas
    const small = document.createElement('canvas');
    small.width = dsW; small.height = dsH;
    const sctx = small.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    coverDraw(sctx, img, dsW, dsH);
    // 2) blow it back up with smoothing OFF -> clean chunky pixels
    pctx.imageSmoothingEnabled = false;
    pctx.clearRect(0, 0, W, H);
    pctx.drawImage(small, 0, 0, dsW, dsH, 0, 0, W, H);
  }

  function drawPlaceholder() {
    const W = photoCanvas.width, H = photoCanvas.height;
    pctx.fillStyle = '#141a3d'; pctx.fillRect(0, 0, W, H);
    pctx.fillStyle = 'rgba(232,179,73,.9)';
    pctx.font = '20px "Courier New", monospace';
    pctx.textAlign = 'center';
    pctx.fillText('drop your photo here:', W / 2, H / 2 - 16);
    pctx.fillStyle = '#f5ece0';
    pctx.fillText('assets/intro-photo.jpg', W / 2, H / 2 + 16);
  }

  const photo = new Image();
  photo.onload = () => pixelatePhoto(photo);
  photo.onerror = drawPlaceholder;
  photo.src = PHOTO_SRC;

  /* =====================================================================
     2. PETALS — gentle pixel sakura over the right panel
     ===================================================================== */
  const pcv = document.getElementById('petals');
  const ctx = pcv.getContext('2d');
  const W = pcv.width, H = pcv.height;
  const rightStart = W * 0.46;
  const rand = (a, b) => a + Math.random() * (b - a);
  const COLORS = ['#f2a6c0', '#f7c2d4', '#f5ece0'];

  const petals = Array.from({ length: num('petals', 24) }, () => spawn(true));
  function spawn(initial) {
    return {
      x: rand(rightStart, W),
      y: initial ? rand(0, H) : -10,
      size: Math.round(rand(6, 12)),
      vy: rand(14, 34) / 60,
      sway: rand(0.4, 1.1),
      phase: rand(0, Math.PI * 2),
      drift: rand(-0.25, 0.25),
      color: COLORS[(Math.random() * COLORS.length) | 0],
      alpha: rand(0.4, 0.75),
    };
  }

  function drawPetals() {
    ctx.clearRect(0, 0, W, H);
    for (const p of petals) {
      p.y += p.vy;
      p.phase += 0.02;
      p.x += Math.sin(p.phase) * p.sway + p.drift;
      if (p.y > H + 12) Object.assign(p, spawn(false));
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      // a little 2-block "petal" so it reads as a shape, not just a dot
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      ctx.fillRect(Math.round(p.x + p.size), Math.round(p.y - p.size * 0.5),
                   Math.round(p.size * 0.6), Math.round(p.size * 0.6));
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(drawPetals);
  }
  drawPetals();

  /* =====================================================================
     3. LOADING BAR — fills once over `seconds`; timer stays internal
     ===================================================================== */
  const seconds = num('seconds', 60);
  const fill = document.getElementById('fill');
  const bar = document.querySelector('.loadbar');

  fill.style.transition = `width ${seconds}s linear`;
  // Kick off via a short timeout (not rAF): the 0% start still gets committed first,
  // but it reliably fires even if early frames are throttled — e.g. the source loads
  // while its OBS scene is hidden, where requestAnimationFrame can be paused.
  setTimeout(() => { fill.style.width = '100%'; }, 60);

  // When it tops out, quietly flip the status to "ready" — no countdown ever shown.
  setTimeout(() => {
    bar.classList.add('done');
    document.getElementById('statusEn').textContent = 'READY';
    document.getElementById('statusJp').textContent = '準備完了';
  }, seconds * 1000);
})();
