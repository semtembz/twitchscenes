/* ============================================================
   COTTAGECORE BLOOM — shared engine ("Pressed-Flower Herbarium")
   fit() scaling, the animated canvas MEADOW field (drifting
   DANDELION SEEDS with little tufts, fine POLLEN motes, and a few
   slow-tumbling PETALS, all carried gently upward + sideways on a
   soft breeze), the no-numbers GROWING-VINE loading bar (a stem that
   fills with a little leaf at the tip) + the status flip. Render mode
   (?render=1) freezes entrances and exposes deterministic
   __renderPlay()/__renderAdvance() so the headless pipeline captures
   frames to webm without virtual time. Every optional subsystem is
   null-guarded; runs only what a scene includes.
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

  /* ---- growing-vine loading bar (no numbers) + status/kicker flip ---- */
  const fill = $id("fill"), tip = $id("leaftip");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    if (tip) tip.style.left = (p * 100).toFixed(2) + "%";
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
      const st = $id("status");
      if (st && st.dataset.done) st.textContent = st.dataset.done;
    }
  }

  /* ============================================================
     CANVAS FIELD: dandelion seeds + pollen motes + drifting petals
     on a soft breeze. Deterministic seeded RNG so render mode is
     reproducible (NO Math.random in the frame fn).
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let seeds = [], pollen = [], petals = [], life = 0;

  // tiny seeded PRNG (mulberry32) — deterministic field
  let _s = 0xC07A >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function buildField() {
    _s = 0xC07A >>> 0;                 // reset seed -> identical field every build
    seeds = []; pollen = []; petals = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // drifting dandelion seeds (a seed body + a fluffy tuft of fine filaments)
    const NSE = num("seeds_n", 16);
    seeds = Array.from({ length: NSE }, () => ({
      x: R(0, W), y: R(0, H),
      vy: -R(7, 16) / 60,             // slow upward drift
      sway: R(0.5, 1.6),              // sideways breeze amplitude
      ph: R(0, 6.283), ps: R(0.5, 1.1),
      rot: R(0, 6.283), spin: R(-0.5, 0.5) / 60,
      sz: R(0.7, 1.5),                // scale
      a: R(0.55, 0.92),
    }));

    // fine pollen / dust motes (warm sunlit specks)
    const NPO = num("pollen", 90);
    pollen = Array.from({ length: NPO }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.7),
      vy: -R(3, 11) / 60, sway: R(0.3, 1.1),
      ph: R(0, 6.283), tw: R(0.5, 1.5), a: R(0.25, 0.7),
      warm: srnd() < 0.7,
    }));

    // a few slow-tumbling petals (dusty rose / cream)
    const NPE = num("petals", 9);
    petals = Array.from({ length: NPE }, () => ({
      x: R(0, W), y: R(0, H),
      vy: R(6, 14) / 60,              // petals drift gently DOWN
      sway: R(0.8, 2.2), ph: R(0, 6.283), ps: R(0.4, 0.9),
      rot: R(0, 6.283), spin: R(-0.8, 0.8) / 60,
      sz: R(9, 18), a: R(0.5, 0.85),
      rose: srnd() < 0.6,
    }));
  }
  buildField();

  // one dandelion seed: a slim seed body with a radiating fluffy tuft
  function drawSeed(s) {
    const sc = s.sz;
    ctx.save();
    ctx.translate(Math.round(s.x), Math.round(s.y));
    ctx.rotate(s.rot);
    ctx.globalAlpha = s.a;
    // the tuft (fine filaments radiating from the top)
    ctx.strokeStyle = "#FBF6E9";
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    const tuftR = 9 * sc;
    for (let i = 0; i < 11; i++) {
      const ang = -Math.PI / 2 + (i - 5) * 0.20;
      ctx.globalAlpha = s.a * 0.55;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * tuftR, Math.sin(ang) * tuftR - 2 * sc);
      ctx.stroke();
    }
    // a soft halo on the tuft
    ctx.globalAlpha = s.a * 0.30;
    ctx.fillStyle = "#FFFDF4";
    ctx.beginPath();
    ctx.arc(0, -tuftR * 0.45, tuftR * 0.6, 0, 6.2832);
    ctx.fill();
    // the seed body (a slim stroke hanging below)
    ctx.globalAlpha = s.a;
    ctx.strokeStyle = "#B7A98C";
    ctx.lineWidth = 1.6 * sc;
    ctx.beginPath();
    ctx.moveTo(0, 1 * sc);
    ctx.lineTo(0, 7 * sc);
    ctx.stroke();
    ctx.restore();
  }

  // one petal: a soft rounded teardrop, lightly tumbling
  function drawPetal(p) {
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    ctx.rotate(p.rot);
    // foreshorten as it tumbles for a little life
    const sx = 0.6 + 0.4 * Math.abs(Math.cos(p.ph));
    ctx.scale(sx, 1);
    ctx.globalAlpha = p.a;
    ctx.fillStyle = p.rose ? "#E2A0B4" : "#F3DCC6";
    ctx.beginPath();
    ctx.moveTo(0, -p.sz);
    ctx.bezierCurveTo(p.sz * 0.8, -p.sz * 0.5, p.sz * 0.7, p.sz * 0.6, 0, p.sz);
    ctx.bezierCurveTo(-p.sz * 0.7, p.sz * 0.6, -p.sz * 0.8, -p.sz * 0.5, 0, -p.sz);
    ctx.fill();
    // faint mid vein
    ctx.globalAlpha = p.a * 0.4;
    ctx.strokeStyle = p.rose ? "#C77F95" : "#D9BE9E";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -p.sz * 0.7); ctx.lineTo(0, p.sz * 0.7); ctx.stroke();
    ctx.restore();
  }

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    life += dt;
    const breeze = Math.sin(life * 0.35) * 0.6 + 0.5;   // 0..~1 gentle gusts

    // pollen motes (drawn first, behind)
    ctx.shadowBlur = 0;
    for (const m of pollen) {
      m.ph += 0.045 * dt * 60;
      m.y += m.vy * dt * 60;
      m.x += (Math.sin(m.ph) * m.sway + breeze * 0.5) * dt * 60 * 0.6;
      if (m.y < -10) { m.y = H + 10; m.x = R(0, W); }
      if (m.x < -10) m.x = W + 10; if (m.x > W + 10) m.x = -10;
      const tw = 0.55 + Math.sin(m.ph * m.tw) * 0.45;
      ctx.globalAlpha = m.a * tw;
      ctx.fillStyle = m.warm ? "#FBEFC9" : "#FBF6E9";
      const sz = Math.max(1, Math.round(m.z * 1.6));
      ctx.fillRect(Math.round(m.x), Math.round(m.y), sz, sz);
    }

    // drifting petals
    for (const p of petals) {
      p.ph += 0.03 * p.ps * dt * 60;
      p.rot += p.spin * dt * 60;
      p.y += p.vy * dt * 60;
      p.x += (Math.sin(p.ph) * p.sway + breeze * 0.8) * dt * 60 * 0.5;
      if (p.y > H + 24) { p.y = -24; p.x = R(0, W); }
      if (p.x < -24) p.x = W + 24; if (p.x > W + 24) p.x = -24;
      drawPetal(p);
    }

    // dandelion seeds (drawn last, in front, floating up)
    for (const s of seeds) {
      s.ph += 0.02 * s.ps * dt * 60;
      s.rot += s.spin * dt * 60;
      s.y += s.vy * dt * 60;
      s.x += (Math.sin(s.ph) * s.sway + breeze * 0.7) * dt * 60 * 0.5;
      if (s.y < -30) { s.y = H + 30; s.x = R(0, W); }
      if (s.x < -30) s.x = W + 30; if (s.x > W + 30) s.x = -30;
      drawSeed(s);
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
  window.__bloomDraw = () => drawBg(1 / 30);

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
