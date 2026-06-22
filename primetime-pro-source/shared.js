/* ============================================================
   PRIMETIME PRO — shared engine ("network sports broadcast")
   fit() scaling, a stadium light-sweep + drifting spark/particle
   field canvas, the broadcast progress chip (hidden 60s timer, no
   numbers), status flip, and the ticker. Render mode (?render=1)
   exposes a deterministic __renderAdvance() so the headless pipeline
   can capture webm without virtual time. Runs only what a scene includes.
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

  /* ---- fit the 1920x1080 stage to the window (defensive) ---- */
  function fit() {
    const iw = window.innerWidth, ih = window.innerHeight;
    if (iw < 10 || ih < 10) return;
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- handle ---- */
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

  /* ---- broadcast progress chip (no numbers) + status flip ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  let barT0 = null;
  function setProg(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
    }
  }

  /* ---- canvas: stadium light sweeps + drifting sparks ---- */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080, sweeps = [], sparks = [];
  if (cv) {
    ctx = cv.getContext("2d");
    W = cv.width || 1920; H = cv.height || 1080;
    const R = (a, b) => a + Math.random() * (b - a);
    // moving stadium light beams (broad soft cones swinging across)
    const BEAMS = num("beams", 4);
    sweeps = Array.from({ length: BEAMS }, (_, i) => ({
      cx: R(0, W), w: R(220, 460),
      col: i % 2 === 0 ? "22,184,255" : "255,90,31",
      a: R(0.05, 0.12), v: R(18, 46) / 60 * (Math.random() < 0.5 ? -1 : 1), ph: R(0, 6.28),
    }));
    // drifting sparks / dust motes rising in the stadium air
    const SPARKS = num("sparks", 60);
    sparks = Array.from({ length: SPARKS }, () => ({
      x: R(0, W), y: R(0, H), r: R(1, 3), vy: R(-26, -8) / 60, vx: R(-6, 6) / 60,
      a: R(0.15, 0.6), ph: R(0, 6.28), ps: R(0.6, 1.4),
      col: Math.random() < 0.78 ? "245,247,250" : "22,184,255",
    }));
  }
  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    // soft turf glow gradient floor
    const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
    g.addColorStop(0, "rgba(22,184,255,0)");
    g.addColorStop(1, "rgba(16,58,94,0.35)");
    ctx.fillStyle = g; ctx.fillRect(0, Math.round(H * 0.55), W, Math.round(H * 0.45));
    // swinging light beams from above
    for (const s of sweeps) {
      s.cx += s.v * dt * 60; s.ph += 0.6 * dt;
      if (s.cx < -s.w) s.cx = W + s.w; if (s.cx > W + s.w) s.cx = -s.w;
      const swing = Math.sin(s.ph) * 90;
      const topX = Math.round(s.cx + swing), topY = -40;
      const halfBottom = s.w;
      const grad = ctx.createLinearGradient(topX, topY, topX, H);
      grad.addColorStop(0, "rgba(" + s.col + "," + s.a.toFixed(3) + ")");
      grad.addColorStop(1, "rgba(" + s.col + ",0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(topX - 60, topY);
      ctx.lineTo(topX + 60, topY);
      ctx.lineTo(Math.round(topX + halfBottom), H);
      ctx.lineTo(Math.round(topX - halfBottom), H);
      ctx.closePath(); ctx.fill();
    }
    // rising sparks
    for (const p of sparks) {
      p.y += p.vy * dt * 60; p.x += p.vx * dt * 60 + Math.sin(p.ph) * 0.4; p.ph += p.ps * dt;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
      const tw = 0.5 + 0.5 * Math.sin(p.ph * 2);
      ctx.globalAlpha = p.a * tw;
      ctx.fillStyle = "rgba(" + p.col + ",1)";
      ctx.beginPath(); ctx.arc(Math.round(p.x), Math.round(p.y), p.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---- timeline driver ---- */
  function tick(seconds) { setProg(seconds / barSeconds); }

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

  if (!render) {
    if (fill) { setTimeout(() => { barT0 = performance.now(); }, 80); }
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
