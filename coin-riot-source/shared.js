/* ============================================================
   COIN RIOT — shared engine ("Insert Coin")
   fit() scaling, ?handle, the 60s bulb-row loading METER (no
   numbers — a row of marquee lamps lights up left->right), ONE
   <canvas class="bg"> running a coin-sparkle confetti field +
   drifting starfield with a deterministic seeded RNG, delta-
   clamped 30fps rAF, and render mode (?render=1) that freezes
   entrances and exposes deterministic __renderPlay()/
   __renderAdvance() + window.__coinDraw so the headless pipeline
   captures webm without virtual time. Runs only what a scene
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

  /* ---- 60s loading METER = a row of marquee bulbs lighting up left->right
     (no numbers shown). The hidden #fill keeps the engine's % math available;
     the visible lamps are .meter .lamp nodes lit when their threshold passes. ---- */
  const fill = $id("fill");
  const lamps = Array.prototype.slice.call(document.querySelectorAll(".meter .lamp"));
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    if (lamps.length) {
      const lit = Math.round(p * lamps.length);
      for (let i = 0; i < lamps.length; i++) lamps[i].classList.toggle("on", i < lit);
    }
  }

  /* ============================================================
     CANVAS FIELD: a slow drifting arcade STARFIELD + coin-sparkle
     confetti that pops in time. Deterministic seeded RNG so render
     mode is reproducible (no Math.random in the frame fn).
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let stars = [], sparks = [], life = 0, popClock = 0;

  // tiny seeded PRNG (mulberry32) — seed "coin" -> 0x7A1d
  let _s = 0x7A1d >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);
  const COINS = ["#FFD400", "#FF3B3B", "#16E0FF", "#7D00FF", "#FFFFFF"];

  function buildField() {
    _s = 0x7A1d >>> 0;                 // reset seed -> identical field every build
    stars = []; sparks = []; life = 0; popClock = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // drifting neon starfield (small pulsing dots that float up-left slowly)
    const NST = num("stars", 90);
    stars = Array.from({ length: NST }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.7),
      vx: R(-7, 3) / 60, vy: R(-6, 4) / 60,
      ph: R(0, 6.283), tw: R(0.5, 1.6), a: R(0.18, 0.7),
      c: COINS[(srnd() * COINS.length) | 0],
    }));
  }
  buildField();

  // spawn a coin-sparkle confetti burst (spinning chips + a glint)
  function spawnSpark(n, ox, oy) {
    for (let i = 0; i < n; i++) {
      sparks.push({
        x: ox + R(-W * 0.34, W * 0.34), y: oy + R(-H * 0.10, H * 0.10),
        vx: R(-40, 40) / 60, vy: R(-70, -20) / 60, g: R(40, 90) / 3600,
        s: R(4, 11), rot: R(0, 6.283), vr: R(-5, 5) / 60,
        life: R(1.1, 2.2), a: 1, c: COINS[(srnd() * COINS.length) | 0],
        coin: srnd() < 0.5,
      });
    }
  }

  // a spinning coin chip (squashed ellipse) or a 4-point sparkle glint
  function drawSpark(p) {
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.a);
    ctx.shadowColor = p.c; ctx.shadowBlur = 12;
    if (p.coin) {
      // a coin chip: ellipse squashed on X by a spin factor
      const sx = Math.abs(Math.cos(p.rot * 1.4)) * 0.85 + 0.15;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.s * sx, p.s, 0, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = Math.max(0, p.a) * 0.5;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.ellipse(-p.s * 0.2 * sx, -p.s * 0.25, p.s * 0.3 * sx, p.s * 0.3, 0, 0, 6.2832);
      ctx.fill();
    } else {
      // a 4-point sparkle glint
      ctx.fillStyle = p.c;
      const a = p.s, b = p.s * 0.32;
      ctx.beginPath();
      ctx.moveTo(0, -a); ctx.lineTo(b, -b); ctx.lineTo(a, 0); ctx.lineTo(b, b);
      ctx.lineTo(0, a); ctx.lineTo(-b, b); ctx.lineTo(-a, 0); ctx.lineTo(-b, -b);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    life += dt;

    // drifting neon starfield
    for (const s of stars) {
      s.x += s.vx * dt * 60; s.y += s.vy * dt * 60; s.ph += 0.05 * dt * 60;
      if (s.x < -8) s.x = W + 8; if (s.x > W + 8) s.x = -8;
      if (s.y < -8) s.y = H + 8; if (s.y > H + 8) s.y = -8;
      const tw = 0.5 + Math.sin(s.ph * s.tw) * 0.5;
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = s.c; ctx.shadowColor = s.c; ctx.shadowBlur = 6 * s.z;
      const sz = Math.max(1, Math.round(s.z * 2.1));
      ctx.fillRect(Math.round(s.x), Math.round(s.y), sz, sz);
    }
    ctx.shadowBlur = 0;

    // periodic coin-sparkle confetti pops (deterministic cadence, NOT rAF-gated)
    popClock += dt;
    if (popClock >= 1.5) {
      popClock -= 1.5;
      // bursts originate from the upper band, raining across the sign
      spawnSpark(10, W * 0.5, H * 0.30);
    }
    // advance + draw sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.vy += p.g * dt * 60;
      p.rot += p.vr * dt * 60; p.life -= dt; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 40) { sparks.splice(i, 1); continue; }
      drawSpark(p);
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
  window.__coinDraw = () => drawBg(1 / 30);

  /* ---- free-running loop (skipped in render mode) ---- */
  if (!render) {
    let barT0 = null;
    if (fill || lamps.length) { setTimeout(() => { barT0 = performance.now(); }, 60); }
    let last = null, acc = 0; const FRAME = 1000 / 30;
    function loop(now) {
      requestAnimationFrame(loop);
      if (last == null) last = now;
      let dt = now - last; last = now; if (dt > 100) dt = 100;
      acc += dt; if (acc < FRAME) return; const step = acc / 1000; acc = 0;
      drawBg(step);
      if (barT0 != null) tick((now - barT0) / 1000);   // one-shot bar is NOT gated on rAF cadence
    }
    requestAnimationFrame(loop);
  }
})();
