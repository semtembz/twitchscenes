/* ============================================================
   PLATINUM FRAME — shared engine ("Cold Minimal Luxury")
   fit() scaling, the animated canvas field (a very fine, slow DRIFT
   of a few cold STEEL SPECKS across the charcoal void — sparse,
   weightless dust catching a cold gleam, NOT a busy particle storm),
   the no-numbers ultra-thin platinum loading line. Render mode
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

  /* ---- ultra-thin platinum loading line = hidden timer (no numbers) ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
  }

  /* ============================================================
     CANVAS FIELD: a sparse, slow drift of cold steel specks.
     Deterministic seeded RNG so render mode is reproducible — a few
     dozen weightless motes that ease across the void and twinkle
     faintly, plus the rare thin connective hairline between two near
     neighbours for a whisper of cold geometric precision.
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080, specks = [];

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0x9A07 >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function buildField() {
    _s = 0x9A07 >>> 0;                 // reset seed -> identical field every build
    specks = [];
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // a few cold steel specks — sparse + weightless, slow diagonal drift
    const NSP = num("specks", 40);
    specks = Array.from({ length: NSP }, () => ({
      x: R(0, W), y: R(0, H),
      vx: R(-3, 3) / 60, vy: R(-2.4, 2.4) / 60,   // very slow drift (px/frame)
      z: R(0.5, 1.7),                              // depth -> size + brightness
      ph: R(0, 6.283), tw: R(0.5, 1.3),            // twinkle phase + rate
      a: R(0.18, 0.6),                             // peak alpha (low, cold)
      ice: srnd() < 0.4,                           // platinum-light vs steel tint
    }));
  }
  buildField();

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // 1) rare thin connective hairlines between near neighbours (cold precision).
    //    Cheap O(n^2) over a small sparse field; very faint, only short links.
    const LINK = 200, LINK2 = LINK * LINK;
    ctx.lineWidth = 1;
    for (let i = 0; i < specks.length; i++) {
      const a = specks[i];
      for (let j = i + 1; j < specks.length; j++) {
        const b = specks[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK2) continue;
        const t = 1 - Math.sqrt(d2) / LINK;        // 1 close -> 0 at range
        ctx.globalAlpha = t * 0.10;                 // whisper-thin
        ctx.strokeStyle = "#9AA7B2";
        ctx.beginPath();
        ctx.moveTo(Math.round(a.x), Math.round(a.y));
        ctx.lineTo(Math.round(b.x), Math.round(b.y));
        ctx.stroke();
      }
    }

    // 2) the drifting specks themselves (tiny cold motes that twinkle)
    for (const p of specks) {
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.ph += 0.03 * p.tw * dt * 60;
      if (p.x < -8) p.x = W + 8; if (p.x > W + 8) p.x = -8;
      if (p.y < -8) p.y = H + 8; if (p.y > H + 8) p.y = -8;
      const tw = 0.55 + Math.sin(p.ph) * 0.45;
      ctx.globalAlpha = p.a * tw;
      ctx.fillStyle = p.ice ? "#D7DEE6" : "#9AA7B2";
      ctx.shadowColor = p.ice ? "#F4F7FA" : "#9AA7B2";
      ctx.shadowBlur = 6 * p.z;
      const sz = Math.max(1, Math.round(p.z * 1.5));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
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
  window.__platinumDraw = () => drawBg(1 / 30);

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
