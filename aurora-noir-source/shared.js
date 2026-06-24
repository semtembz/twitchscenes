/* ============================================================
   AURORA NOIR — shared engine ("Aurora behind Black Glass")
   fit() scaling, the animated canvas field (a slow iridescent
   AURORA BOREALIS sheen — layered mint->violet light curtains/ribbons
   that drift and breathe across a black sky, plus fine drifting light
   particles), the no-numbers thin aurora loading line. Render mode
   (?render=1) freezes entrances and exposes deterministic
   __renderPlay()/__renderAdvance() so the headless pipeline captures
   frames to webm without virtual time. Runs only what a scene
   includes; every optional subsystem is null-guarded.
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
    if (iw < 10 || ih < 10) return;           // never write --scale:0
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

  /* ---- thin iridescent aurora loading line (no numbers) ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
  }

  /* ============================================================
     CANVAS FIELD: an iridescent AURORA BOREALIS sheen behind glass.
     Several soft mint->violet light "curtains" (vertical ribbons of
     additive gradient) drift sideways and undulate, layered behind a
     veil of fine drifting light particles. Deterministic seeded RNG
     so render mode is reproducible (no Math.random in the frame fn).
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let curtains = [], motes = [], life = 0;

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0xA09A >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  // iridescent curtain tints (mint <-> violet)
  const TINTS = [
    [91, 224, 192],   // mint
    [138, 123, 255],  // violet
    [120, 200, 224],  // mint-cyan blend
    [110, 160, 240],  // violet-blue blend
  ];

  function buildField() {
    _s = 0xA09A >>> 0;                 // reset seed -> identical field every build
    curtains = []; motes = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // drifting aurora light-curtains (vertical soft ribbons)
    const NC = num("curtains", 7);
    curtains = Array.from({ length: NC }, (_, i) => {
      const tint = TINTS[(srnd() * TINTS.length) | 0];
      return {
        x: R(-0.1, 1.1) * W,            // horizontal center
        w: R(180, 420),                 // ribbon half-width
        drift: R(-10, 10) / 60,         // px/frame sideways drift
        amp: R(60, 200),                // horizontal sway amplitude
        sw: R(0.10, 0.32),              // sway speed
        ph: R(0, 6.283),                // phase
        topY: R(-0.25, 0.18) * H,       // where the curtain starts vertically
        botY: R(0.62, 1.18) * H,        // where it fades out
        a: R(0.10, 0.22),               // peak alpha (low — it's behind glass)
        bsp: R(0.18, 0.5),              // brightness breathe speed
        bph: R(0, 6.283),
        c: tint,
      };
    });

    // fine drifting light particles (the luminous dust in the air)
    const NM = num("motes", 84);
    motes = Array.from({ length: NM }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.7),
      vx: R(-3, 3) / 60, vy: R(-7, -1) / 60,   // drift gently upward
      ph: R(0, 6.283), tw: R(0.4, 1.4), a: R(0.18, 0.7),
      mint: srnd() < 0.55,
    }));
  }
  buildField();

  // draw one aurora curtain: a soft vertical additive ribbon that undulates
  // sideways and hangs from the top, fading toward the bottom. Built as a stack
  // of horizontal scan-bands so the ribbon can WAVE (each band's center shifts),
  // giving the flowing-curtain look without per-pixel work. Additive -> luminous.
  function drawCurtain(c) {
    const [r, gn, b] = c.c;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const bands = 26;                            // vertical resolution of the wave
    const span = c.botY - c.topY;
    for (let i = 0; i < bands; i++) {
      const f = i / (bands - 1);                 // 0 top .. 1 bottom
      const y = c.topY + f * span;
      // sway: base drift-position + a traveling wave down the curtain
      const wave = Math.sin(life * c.sw + c.ph + f * 3.2) * c.amp
                 + Math.sin(life * c.sw * 0.6 + c.ph * 1.7 - f * 1.6) * (c.amp * 0.4);
      const cx = c.x + wave;
      const breathe = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(life * c.bsp + c.bph));
      // vertical envelope: dim at top, brightest ~28% down, fading to 0 at bottom
      const vEnv = Math.sin(Math.min(1, f / 0.28) * Math.PI * 0.5) * (1 - f) * (1 - f * 0.3);
      const a = c.a * breathe * Math.max(0, vEnv);
      if (a <= 0.004) continue;
      const x0 = cx - c.w, x1 = cx + c.w;
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0.0, "rgba(" + r + "," + gn + "," + b + ",0)");
      g.addColorStop(0.5, "rgba(" + r + "," + gn + "," + b + "," + a.toFixed(3) + ")");
      g.addColorStop(1.0, "rgba(" + r + "," + gn + "," + b + ",0)");
      ctx.fillStyle = g;
      const bh = Math.ceil(span / bands) + 2;
      ctx.fillRect(Math.round(x0), Math.round(y), Math.round(c.w * 2), bh);
    }
    ctx.restore();
  }

  function drawBg(dt) {
    if (!ctx) return;
    life += dt;
    // base wash: deep black sky with the faintest cool floor glow
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "rgba(11,13,19,1)");
    sky.addColorStop(0.55, "rgba(8,9,13,1)");
    sky.addColorStop(1, "rgba(5,6,10,1)");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // aurora curtains (additive, drifting + breathing)
    for (const c of curtains) {
      c.x += c.drift * dt * 60;
      // wrap so curtains keep flowing across
      if (c.x < -0.3 * W) c.x = 1.3 * W;
      if (c.x > 1.3 * W) c.x = -0.3 * W;
      drawCurtain(c);
    }

    // fine drifting light particles (additive sparkle)
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 0;
    for (const p of motes) {
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.ph += 0.045 * dt * 60;
      if (p.x < -8) p.x = W + 8; if (p.x > W + 8) p.x = -8;
      if (p.y < -8) { p.y = H + 8; p.x = (srnd() * W); }
      const tw = 0.5 + Math.sin(p.ph * p.tw) * 0.5;
      ctx.globalAlpha = p.a * tw;
      ctx.fillStyle = p.mint ? "#5BE0C0" : "#8A7BFF";
      const sz = Math.max(1, Math.round(p.z * 1.7));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
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
  window.__auroraDraw = () => drawBg(1 / 30);

  /* ---- free-running loop (skipped in render mode) ---- */
  if (!render) {
    let barT0 = null;
    if (fill) { setTimeout(() => { barT0 = performance.now(); }, 60); }
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
