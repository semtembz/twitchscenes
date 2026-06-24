/* ============================================================
   ACID RAVE — shared engine ("UV Blacklight")
   fit() scaling, ONE animated <canvas> field (smoothly PULSING
   blacklight glow blobs + sweeping corner LASER beams + a bottom
   row of dancing EQUALIZER bars), the no-numbers loading meter, and
   the editable-slot loop. Render mode (?render=1) freezes CSS
   entrances and exposes deterministic __renderPlay()/__renderAdvance()
   so the headless pipeline captures frames to webm without virtual
   time. Deterministic seeded RNG -> no Math.random in the frame fn,
   so render mode is reproducible. Every subsystem is null-guarded.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const num = (k, d) => Number(params.get(k)) || d;
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  const render = params.get("render") === "1";
  const stage = $id("stage");
  if (render && stage) stage.classList.add("render");

  /* ---- fit the 1920x1080 stage to the window (guarded) ---- */
  function fit() {
    const iw = window.innerWidth, ih = window.innerHeight;
    if (iw < 10 || ih < 10) return;            // never write --scale:0
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- optional handle ---- */
  const handle = params.get("handle"), handleEl = $id("handle");
  if (handle && handleEl) handleEl.textContent = handle;

  /* ---- editable text slots: any [data-slot] ships a muted "[ your text here ]"
     placeholder the buyer edits or deletes. ?slotname=Text sets it at render
     time; ?slotname=- (or empty/none/off) removes it entirely. ---- */
  document.querySelectorAll("[data-slot]").forEach((el) => {
    const v = params.get(el.dataset.slot);
    if (v == null) return;
    if (v === "-" || v === "" || v === "none" || v === "off") { el.remove(); return; }
    el.textContent = v;
    el.classList.remove("is-slot");
  });

  /* ---- glowing EQ/laser loading bar = hidden timer (no numbers) ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
  }

  /* ============================================================
     CANVAS FIELD: blacklight glow blobs + corner lasers + EQ bars
     Deterministic seeded RNG (mulberry32) so render mode reproduces.
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let blobs = [], bars = [], life = 0;

  let _s = 0xACED >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  const ACID = [198, 255, 0], MAG = [255, 20, 200], CYAN = [0, 229, 255], PURP = [178, 107, 255];
  const PAL = [ACID, MAG, CYAN, PURP];

  function buildField() {
    _s = 0xACED >>> 0;                 // reset seed -> identical field every build
    blobs = []; bars = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // smoothly pulsing blacklight glow blobs — kept toward the edges so the
    // centred title/bar stay legible (avoid the central clear zone).
    const NB = num("blobs", 9);
    blobs = Array.from({ length: NB }, (_, i) => {
      // bias positions outward: pick an edge band, never dead-centre
      const edge = i % 4;
      let x, y;
      if (edge === 0) { x = R(0, W * 0.32); y = R(0, H); }
      else if (edge === 1) { x = R(W * 0.68, W); y = R(0, H); }
      else if (edge === 2) { x = R(0, W); y = R(0, H * 0.3); }
      else { x = R(0, W); y = R(H * 0.72, H); }
      return {
        x, y, r: R(260, 520),
        c: PAL[(srnd() * PAL.length) | 0],
        base: R(0.10, 0.20),           // base alpha (low — UV haze)
        amp: R(0.05, 0.12),            // pulse amplitude
        sp: R(0.5, 1.3),               // pulse speed
        ph: R(0, 6.283),               // pulse phase
        dx: R(-6, 6) / 60, dy: R(-5, 5) / 60,
      };
    });

    // bottom EQUALIZER bars — a full row hugging the bottom edge
    const NE = num("eq", 64);
    const gap = 3, bw = (W / NE) - gap;
    bars = Array.from({ length: NE }, (_, i) => ({
      x: i * (bw + gap), w: bw,
      // each bar bounces on its own sine — two stacked freqs for a lively dance
      f1: R(2.2, 5.5), f2: R(0.6, 1.6),
      ph: R(0, 6.283), ph2: R(0, 6.283),
      max: R(0.45, 1.0),
      c: PAL[(srnd() * PAL.length) | 0],
    }));
  }
  buildField();

  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")"; }

  // sweeping corner LASER beams — thin bright lines that fan out from the four
  // corners and slowly rake across the void. Deterministic in `life`.
  function drawLasers() {
    const corners = [
      { x: 0, y: 0, base: 0.20, c: ACID },
      { x: W, y: 0, base: -Math.PI / 2 - 0.20, c: MAG },
      { x: 0, y: H, base: Math.PI / 2 + 0.20, c: CYAN },
      { x: W, y: H, base: Math.PI + 0.20, c: PURP },
    ];
    const L = Math.hypot(W, H) * 1.1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    let k = 0;
    for (const cor of corners) {
      for (let j = 0; j < 2; j++) {
        // slow oscillating sweep angle; each beam offset so they don't overlap
        const sweep = Math.sin(life * (0.18 + j * 0.05) + k * 1.7) * 0.42;
        const spread = (cor.x === 0 ? 1 : -1) * (j === 0 ? 0.16 : 0.44);
        const ang = cor.base + spread + sweep;
        const ex = cor.x + Math.cos(ang) * L;
        const ey = cor.y + Math.sin(ang) * L;
        const pulse = 0.5 + 0.5 * Math.sin(life * 1.1 + k * 2.0);
        // soft wide wash
        ctx.globalAlpha = (0.07 + pulse * 0.06);
        ctx.strokeStyle = rgba(cor.c, 1);
        ctx.lineWidth = 26;
        ctx.beginPath(); ctx.moveTo(cor.x, cor.y); ctx.lineTo(ex, ey); ctx.stroke();
        // bright thin core
        ctx.globalAlpha = (0.22 + pulse * 0.22);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cor.x, cor.y); ctx.lineTo(ex, ey); ctx.stroke();
        k++;
      }
    }
    ctx.restore();
  }

  // bottom equalizer row — smooth dancing bars hugging the bottom edge
  function drawEq() {
    const baseY = H, maxH = 230;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of bars) {
      const v = (0.5 + 0.5 * Math.sin(life * b.f1 + b.ph)) * 0.7
              + (0.5 + 0.5 * Math.sin(life * b.f2 + b.ph2)) * 0.3;
      const h = 14 + v * b.max * maxH;
      const x = Math.round(b.x), w = Math.max(2, Math.round(b.w));
      const g = ctx.createLinearGradient(0, baseY, 0, baseY - h);
      g.addColorStop(0, rgba(b.c, 0.0));
      g.addColorStop(0.25, rgba(b.c, 0.30));
      g.addColorStop(1, rgba(b.c, 0.85));
      ctx.fillStyle = g;
      ctx.fillRect(x, Math.round(baseY - h), w, Math.ceil(h));
      // bright tip cap
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = rgba(b.c, 0.9);
      ctx.fillRect(x, Math.round(baseY - h), w, 3);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawBg(dt) {
    if (!ctx) return;
    life += dt;
    ctx.clearRect(0, 0, W, H);

    // smoothly pulsing blacklight glow blobs (additive radial lights)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of blobs) {
      b.x += b.dx * dt * 60; b.y += b.dy * dt * 60;
      if (b.x < -b.r) b.x = W + b.r; if (b.x > W + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = H + b.r; if (b.y > H + b.r) b.y = -b.r;
      const a = b.base + b.amp * Math.sin(life * b.sp + b.ph);   // smooth pulse, no strobe
      const rr = b.r * (1 + 0.06 * Math.sin(life * b.sp * 0.7 + b.ph));
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
      g.addColorStop(0, rgba(b.c, Math.max(0, a)));
      g.addColorStop(0.5, rgba(b.c, Math.max(0, a) * 0.35));
      g.addColorStop(1, rgba(b.c, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(Math.round(b.x), Math.round(b.y), rr, 0, 6.2832); ctx.fill();
    }
    ctx.restore();

    drawLasers();
    drawEq();

    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }

  /* ---- timeline driver ---- */
  function tick(seconds) { setBar(seconds / barSeconds); }

  /* ---- render mode: deterministic frame stepping (1 frame = 1/30s) ---- */
  let rf = 0;
  window.__renderPlay = function () { rf = 0; buildField(); drawBg(0); tick(0); };
  window.__renderAdvance = function () {
    const t = rf / 30;            // seconds elapsed
    drawBg(1 / 30);
    tick(t);
    rf++;
    return rf * (1000 / 30);
  };
  // rAF-independent verification hook (EXACT name)
  window.__acidDraw = () => drawBg(1 / 30);

  /* ---- free-running loop (skipped in render mode) ---- */
  if (!render) {
    let barT0 = null;
    if (fill) { setTimeout(() => { barT0 = performance.now(); }, 60); }  // one-shot start, NOT gated on rAF
    let last = null, acc = 0; const FRAME = 1000 / 30;
    function loop(now) {
      requestAnimationFrame(loop);
      if (last == null) last = now;
      let dt = now - last; last = now; if (dt > 100) dt = 100;
      acc += dt; if (acc < FRAME) return; const step = acc / 1000; acc = 0;
      drawBg(step);
      if (barT0 != null) tick((now - barT0) / 1000);
    }
    requestAnimationFrame(loop);
  }
})();
