/* ============================================================
   STUDIO NOIR — shared engine ("Cold Open")
   fit() scaling, the animated canvas field (a slow, far-back bokeh of
   OUT-OF-FOCUS STUDIO LIGHTS drifting through cool depth + a faint haze
   of fine dust caught in the key-light — restrained, expensive, NOT
   busy), the no-numbers amber broadcast loading strap, and the status
   flip. Render mode (?render=1) freezes entrances and exposes
   deterministic __renderPlay()/__renderAdvance() so the headless
   pipeline captures frames to webm without virtual time. Runs only what
   a scene includes; every optional subsystem is null-guarded.
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

  /* ---- amber broadcast loading strap = hidden timer (no numbers) + status flip ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
      const st = $id("status");
      if (st && st.dataset.done) st.textContent = st.dataset.done;
    }
  }

  /* ============================================================
     CANVAS FIELD: far-back bokeh of out-of-focus studio lights drifting
     through cool depth + a faint drift of key-light dust. Deterministic
     seeded RNG so render mode is reproducible (NO Math.random in frame).
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let lights = [], dust = [];

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0x4E01 >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function buildField() {
    _s = 0x4E01 >>> 0;                 // reset seed -> identical field every build
    lights = []; dust = [];
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // out-of-focus studio light bokeh — large, soft, low alpha, cool with
    // a few amber accents; biased toward the upper area (the "rig" above).
    const NL = num("lights", 13);
    const TINTS = [
      [192, 198, 204], [192, 198, 204], [192, 198, 204], // cool steel (majority)
      [120, 150, 178],                                   // cooler blue depth
      [227, 178, 60],                                    // a rare amber practical
    ];
    lights = Array.from({ length: NL }, () => {
      const c = TINTS[(srnd() * TINTS.length) | 0];
      return {
        x: R(0, W), y: R(-40, H * 0.78),
        r: R(120, 320),
        c,
        a: R(0.05, 0.13),
        vx: R(-3.4, 3.4) / 60, vy: R(-2.2, 2.2) / 60,
        ph: R(0, 6.283), ps: R(0.25, 0.7),     // slow breathe of focus/intensity
      };
    });

    // fine dust caught in the raking key-light (sparse, drifts slowly down-right)
    const ND = num("dust", 64);
    dust = Array.from({ length: ND }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.5),
      vx: R(2, 7) / 60, vy: R(2, 6) / 60,
      ph: R(0, 6.283), tw: R(0.5, 1.5), a: R(0.12, 0.5),
    }));
  }
  buildField();

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // far-back out-of-focus studio light bokeh
    ctx.globalCompositeOperation = "lighter";
    for (const L of lights) {
      L.x += L.vx * dt * 60; L.y += L.vy * dt * 60; L.ph += L.ps * dt;
      if (L.x < -360) L.x = W + 360; if (L.x > W + 360) L.x = -360;
      if (L.y < -360) L.y = H + 360; if (L.y > H + 360) L.y = -360;
      const breathe = 0.84 + Math.sin(L.ph) * 0.16;     // focus/intensity drift
      const rr = L.r * (0.92 + Math.sin(L.ph * 0.7) * 0.08);
      const a = L.a * breathe;
      const [cr, cg, cb] = L.c;
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, rr);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${a.toFixed(3)})`);
      g.addColorStop(0.55, `rgba(${cr},${cg},${cb},${(a * 0.32).toFixed(3)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(Math.round(L.x), Math.round(L.y), rr, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // fine key-light dust
    for (const d of dust) {
      d.x += d.vx * dt * 60; d.y += d.vy * dt * 60; d.ph += 0.04 * dt * 60;
      if (d.x > W + 8) { d.x = -8; d.y = srnd() * H; }
      if (d.y > H + 8) { d.y = -8; d.x = srnd() * W; }
      const tw = 0.5 + Math.sin(d.ph * d.tw) * 0.5;
      ctx.globalAlpha = d.a * tw;
      ctx.fillStyle = "#C0C6CC";
      const sz = Math.max(1, Math.round(d.z * 1.5));
      ctx.fillRect(Math.round(d.x), Math.round(d.y), sz, sz);
    }
    ctx.globalAlpha = 1;
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
  window.__noirDraw = () => drawBg(1 / 30);

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
