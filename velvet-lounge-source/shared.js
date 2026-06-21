/* ============================================================
   VELVET LOUNGE — shared engine ("The Gilt Room")
   fit() scaling, warm bokeh haze + drifting gold dust motes on a
   canvas field, a single thin brass loading line (no numbers),
   status flip. Render mode (?render=1) freezes entrances and
   exposes deterministic __renderPlay()/__renderAdvance() so the
   headless pipeline captures webm without virtual time.
   Runs only what each scene includes.
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
    if (iw < 10 || ih < 10) return;
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- optional handle ---- */
  const handle = params.get("handle"), handleEl = $id("handle");
  if (handle && handleEl) handleEl.textContent = handle;

  /* ---- thin brass loading line (no numbers) + status flip ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = Math.max(0, Math.min(1, p));
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
    }
  }

  /* ---- canvas: warm bokeh haze + drifting gold dust motes ---- */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080, bokeh = [], dust = [];
  if (cv) {
    ctx = cv.getContext("2d");
    W = cv.width || 1920; H = cv.height || 1080;
    const R = (a, b) => a + Math.random() * (b - a);
    const HAZE = ["#3A1B33", "#B5894E", "#5A2C4C", "#E6C98C"];
    bokeh = Array.from({ length: num("bokeh", 14) }, () => ({
      x: R(0, W), y: R(0, H), r: R(120, 320), c: HAZE[(Math.random() * HAZE.length) | 0],
      a: R(0.05, 0.14), vx: R(-5, 5) / 60, vy: R(-4, 3) / 60, ph: R(0, 6.28), ps: R(0.4, 1.0),
    }));
    dust = Array.from({ length: num("dust", 70) }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.6), vy: R(-7, 9) / 60, sway: R(0.3, 1.2),
      ph: R(0, 6.28), a: R(0.25, 0.85),
    }));
  }
  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    // warm bokeh haze
    for (const b of bokeh) {
      b.x += b.vx * dt * 60; b.y += b.vy * dt * 60; b.ph += 0.01 * b.ps * dt * 60;
      if (b.x < -340) b.x = W + 340; if (b.x > W + 340) b.x = -340;
      if (b.y < -340) b.y = H + 340; if (b.y > H + 340) b.y = -340;
      const rr = b.r * (1 + Math.sin(b.ph) * 0.12);
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
      g.addColorStop(0, b.c); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = b.a; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(Math.round(b.x), Math.round(b.y), rr, 0, 6.2832); ctx.fill();
    }
    // drifting gold dust motes
    for (const d of dust) {
      d.y += d.vy * dt * 60; d.ph += 0.03 * dt * 60; d.x += Math.sin(d.ph) * d.sway * 0.6;
      if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
      if (d.y > H + 10) { d.y = -10; d.x = Math.random() * W; }
      const tw = 0.55 + Math.sin(d.ph * 1.7) * 0.45;
      ctx.globalAlpha = d.a * tw;
      ctx.fillStyle = "#E6C98C"; ctx.shadowColor = "#E6C98C"; ctx.shadowBlur = 6 * d.z;
      const s = Math.max(1, Math.round(d.z * 1.7));
      ctx.fillRect(Math.round(d.x), Math.round(d.y), s, s);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  /* ---- timeline driver ---- */
  function tick(seconds) { setBar(seconds / barSeconds); }

  // render mode: deterministic frame stepping (1 frame = 1/30s)
  let rf = 0;
  window.__renderPlay = function () { rf = 0; tick(0); };
  window.__renderAdvance = function () {
    const t = rf / 30;            // seconds
    drawBg(1 / 30);
    tick(t);
    rf++;
    return rf * (1000 / 30);
  };
  // rAF-independent verification hook
  window.__velvetDraw = function () { drawBg(1 / 30); };

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
