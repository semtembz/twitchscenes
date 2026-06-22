/* ============================================================
   MIAMI DRIVE — shared engine ("Outrun Sunset Highway")
   fit() scaling, the animated canvas field (scrolling perspective
   neon GRID receding to a vanishing point + twinkling dot-stars +
   a soft sun glow on the horizon), the no-numbers loading bar, and
   the status flip. Render mode (?render=1) exposes a deterministic
   __renderPlay()/__renderAdvance() so the headless pipeline can
   capture frames to webm without virtual time. Runs only what each
   scene includes.
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

  /* ---- loading bar = hidden timer (no numbers) + status flip ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
    }
  }

  /* ============================================================
     CANVAS FIELD: perspective grid + stars + sun glow
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  // horizon Y in stage px (must match --horizon in shared.css)
  const HORIZON = num("horizon", 600);
  let stars = [], scroll = 0, twinkle = 0;
  const R = (a, b) => a + Math.random() * (b - a);

  if (cv) {
    ctx = cv.getContext("2d");
    if (ctx) {
      W = cv.width || 1920; H = cv.height || 1080;
      // dot-stars only ABOVE the horizon
      stars = Array.from({ length: num("stars", 130) }, () => ({
        x: (Math.random() * W) | 0,
        y: (Math.random() * (HORIZON - 40)) | 0,
        r: R(0.6, 2.0),
        ph: R(0, 6.28),
        sp: R(0.6, 1.8),
        c: Math.random() < 0.5 ? "#FFFFFF" : (Math.random() < 0.5 ? "#FDF06A" : "#CFE9FF"),
      }));
    }
  }

  // map a world-Z (0 at horizon .. 1 at viewer) to a screen Y below the horizon
  function rowY(t) {
    // ease so rows bunch up near the horizon (perspective foreshortening)
    return HORIZON + (H - HORIZON) * (t * t);
  }

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    twinkle += dt;

    /* ---- twinkling dot-stars ---- */
    for (const s of stars) {
      const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(twinkle * s.sp + s.ph));
      ctx.globalAlpha = a;
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x, s.y, Math.max(1, Math.round(s.r)), Math.max(1, Math.round(s.r)));
    }
    ctx.globalAlpha = 1;

    /* ---- soft sun glow blooming on the horizon ---- */
    const gx = W / 2, gy = HORIZON;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 520);
    glow.addColorStop(0, "rgba(255,122,0,0.30)");
    glow.addColorStop(0.4, "rgba(255,46,151,0.16)");
    glow.addColorStop(1, "rgba(255,46,151,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, Math.round(HORIZON - 520), W, 1040);

    /* ---- the PERSPECTIVE GRID floor ---- */
    scroll = (scroll + dt * 0.55) % 1;   // 0..1 loop of one cell of forward motion
    const vpX = W / 2;                    // vanishing point X
    const ROWS = 18;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    // horizontal rows sweeping toward the viewer
    for (let i = 0; i < ROWS; i++) {
      let t = (i + scroll) / ROWS;        // 0 (far) .. 1 (near)
      if (t <= 0.001) continue;
      const y = Math.round(rowY(t));
      const a = Math.min(1, t * 1.4) * 0.85;
      ctx.strokeStyle = "rgba(0,224,208," + a.toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(W, y);
      ctx.stroke();
    }

    // converging vertical lines (fan out from the vanishing point)
    const LINES = 24;            // half-count each side determined by spread
    const spread = W * 1.6;      // how wide the lines are at the bottom edge
    const yBot = H;
    const aV = 0.55;
    for (let i = -LINES; i <= LINES; i++) {
      const bx = vpX + (i / LINES) * spread;
      ctx.strokeStyle = "rgba(255,46,151," + aV + ")";
      ctx.beginPath();
      ctx.moveTo(Math.round(vpX), HORIZON);
      ctx.lineTo(Math.round(bx), yBot);
      ctx.stroke();
    }

    // bright neon glow pass on the center vertical + horizon meet
    ctx.strokeStyle = "rgba(170,255,247,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(vpX), HORIZON); ctx.lineTo(Math.round(vpX), yBot);
    ctx.stroke();
  }

  /* ---- timeline driver ---- */
  function tick(seconds) { setBar(seconds / barSeconds); }

  /* ---- render mode: deterministic frame stepping (1 frame = 1/30s) ---- */
  let rf = 0;
  window.__renderPlay = function () { rf = 0; scroll = 0; twinkle = 0; drawBg(0); tick(0); };
  window.__renderAdvance = function () {
    const t = rf / 30;             // seconds elapsed
    drawBg(1 / 30);
    tick(t);
    rf++;
    return rf * (1000 / 30);
  };
  // verification hook (rAF-independent)
  window.__miamiDraw = drawBg;

  /* ---- free-running loop (skipped in render mode) ---- */
  if (!render) {
    let barT0 = null;
    setTimeout(() => { barT0 = performance.now(); }, 60);
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
