/* ============================================================
   LO-FI CAFE — shared engine ("Rainy Window Booth")
   fit() scaling, a single <canvas class="bg"> that paints the
   rainy cafe window: soft blurred warm BOKEH of street/cafe lights
   behind foggy glass, vertical RAIN STREAKS, and DROPLETS that
   slide down leaving trails. The 60s loading bar (no numbers) +
   status flip. Render mode (?render=1) freezes entrances and
   exposes deterministic __renderPlay()/__renderAdvance() so the
   headless pipeline captures webm without virtual time. Runs only
   what each scene includes.  Bespoke look; shared engine only.
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
    if (iw < 10 || ih < 10) return; // never write --scale:0
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

  /* ---- "now brewing" loading fill (no numbers) + status flip ---- */
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

  /* ---- canvas: rainy foggy window — warm bokeh + rain + droplets ---- */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080, bokeh = [], rain = [], drops = [];
  const R = (a, b) => a + Math.random() * (b - a);
  if (cv) {
    ctx = cv.getContext("2d");
    W = cv.width || 1920; H = cv.height || 1080;
    // warm out-of-focus cafe/street lights blurred behind the glass
    const LIGHTS = ["#D9925A", "#F4EBE2", "#E8C79A", "#C9A88A", "#B57A4A"];
    bokeh = Array.from({ length: num("bokeh", 16) }, () => ({
      x: R(0, W), y: R(40, H * 0.78), r: R(90, 280),
      c: LIGHTS[(Math.random() * LIGHTS.length) | 0],
      a: R(0.06, 0.18), vx: R(-4, 4) / 60, vy: R(-2, 2) / 60, ph: R(0, 6.28), ps: R(0.3, 0.9),
    }));
    // thin vertical rain streaks falling fast on the glass
    rain = Array.from({ length: num("rain", 110) }, () => ({
      x: R(0, W), y: R(0, H), len: R(30, 96), vy: R(420, 760) / 60, w: R(1, 2.2), a: R(0.10, 0.30),
    }));
    // fat droplets that slowly slide down leaving a wet trail
    const mkDrop = (top) => ({
      x: R(0, W), y: top ? R(-40, -10) : R(0, H), r: R(3, 8),
      vy: 0, slip: R(18, 64) / 60, wob: R(-0.25, 0.25), trail: R(60, 170), a: R(0.35, 0.7),
    });
    drops = Array.from({ length: num("drops", 26) }, () => mkDrop(false));
    cv._mkDrop = mkDrop;
  }

  function drawBg(dt) {
    if (!ctx) return;
    const f = dt * 60; // per-60fps-frame factor
    ctx.clearRect(0, 0, W, H);

    // 1) warm blurred bokeh of cafe lights behind foggy glass
    for (const b of bokeh) {
      b.x += b.vx * f; b.y += b.vy * f; b.ph += 0.01 * b.ps * f;
      if (b.x < -300) b.x = W + 300; if (b.x > W + 300) b.x = -300;
      if (b.y < -300) b.y = H + 300; if (b.y > H + 300) b.y = -300;
      const rr = b.r * (1 + Math.sin(b.ph) * 0.14);
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
      g.addColorStop(0, b.c); g.addColorStop(0.45, b.c); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = b.a; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(Math.round(b.x), Math.round(b.y), rr, 0, 6.2832); ctx.fill();
    }

    // 2) vertical rain streaks on the glass
    ctx.lineCap = "round";
    for (const r of rain) {
      r.y += r.vy * f;
      if (r.y - r.len > H) { r.y = -R(0, 120); r.x = R(0, W); }
      ctx.globalAlpha = r.a;
      ctx.strokeStyle = "rgba(244,235,226,0.9)";
      ctx.lineWidth = r.w;
      const x = Math.round(r.x);
      ctx.beginPath(); ctx.moveTo(x, Math.round(r.y - r.len)); ctx.lineTo(x, Math.round(r.y)); ctx.stroke();
    }

    // 3) fat droplets sliding down, leaving a soft wet trail
    for (const d of drops) {
      // accelerate gently as it gains weight, with slight horizontal wobble
      d.vy += 0.012 * f; d.y += (d.slip + d.vy) * f; d.x += d.wob * f;
      if (d.y - d.trail > H) { Object.assign(d, cv._mkDrop(true)); }
      const x = Math.round(d.x), y = Math.round(d.y);
      // wet trail behind the droplet
      const tg = ctx.createLinearGradient(x, y - d.trail, x, y);
      tg.addColorStop(0, "rgba(244,235,226,0)");
      tg.addColorStop(1, "rgba(244,235,226," + (d.a * 0.5).toFixed(3) + ")");
      ctx.globalAlpha = 1; ctx.fillStyle = tg;
      ctx.fillRect(x - Math.round(d.r * 0.45), y - d.trail, Math.max(1, Math.round(d.r * 0.9)), d.trail);
      // the droplet head with a warm highlight
      ctx.globalAlpha = d.a;
      ctx.fillStyle = "rgba(232,213,196,0.85)";
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = d.a * 0.9; ctx.fillStyle = "rgba(255,250,244,0.95)";
      ctx.beginPath(); ctx.arc(x - Math.round(d.r * 0.3), y - Math.round(d.r * 0.3), Math.max(1, d.r * 0.32), 0, 6.2832); ctx.fill();
    }

    ctx.globalAlpha = 1;
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
  // rAF-independent verification hook (theme slug camel: cafe)
  window.__cafeDraw = function () { drawBg(1 / 30); };

  if (!render) {
    let barT0 = null;
    if (fill) { setTimeout(() => { barT0 = performance.now(); }, 60); } // don't gate on rAF
    let last = null, acc = 0; const FRAME = 1000 / 30;
    function loop(now) {
      requestAnimationFrame(loop);
      if (last == null) last = now;
      let dt = now - last; last = now; if (dt > 100) dt = 100; // delta clamp
      acc += dt; if (acc < FRAME) return; const step = acc / 1000; acc = 0;
      drawBg(step);
      if (barT0 != null) tick((now - barT0) / 1000);
    }
    requestAnimationFrame(loop);
  }
})();
