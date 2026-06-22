/* ============================================================
   VENOM SURGE — shared engine ("Toxic Arena")
   fit() scaling, the animated canvas field (kinetic SURGE speed-lines
   streaking on the slash diagonal, crackling ELECTRIC ARCS that fork
   and snap, and rising venom ENERGY embers), the charging energy bar
   (no numbers) + status flip, render mode (?render=1) that freezes
   entrances and exposes deterministic __renderPlay()/__renderAdvance()
   so the headless pipeline captures frames to webm without virtual
   time. Deterministic seeded RNG so render mode is reproducible. Runs
   only what a scene includes; every optional subsystem is null-guarded.
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
    if (iw < 10 || ih < 10) return;             // never write --scale:0
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- optional handle ---- */
  const handle = params.get("handle"), handleEl = $id("handle");
  if (handle && handleEl) handleEl.textContent = handle;

  /* ---- charging energy bar = hidden timer (no numbers) + status flip ---- */
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
     CANVAS FIELD: surge speed-lines + crackling electric arcs +
     rising venom embers. Deterministic seeded RNG (mulberry32) —
     NO Math.random in the frame fn.
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let lines = [], embers = [], arcs = [], life = 0;
  const SLASH = -24 * Math.PI / 180;            // diagonal of the claw tears
  const DX = Math.cos(SLASH), DY = Math.sin(SLASH);

  let _s = 0x7A11 >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function buildField() {
    _s = 0x7A11 >>> 0;                            // reset seed -> identical field every build
    lines = []; embers = []; arcs = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // SURGE speed-lines: streak along the slash diagonal, wrap when off-frame
    const NL = num("lines", 34);
    lines = Array.from({ length: NL }, () => ({
      p: R(-0.2, 1.2),                            // position along travel 0..1
      off: R(-900, 900),                          // perpendicular offset from center
      len: R(120, 460),
      sp: R(0.10, 0.34),                          // travel speed (per second)
      w: R(1, 3),
      a: R(0.12, 0.5),
      hue: srnd(),                                // 0 venom .. 1 cyan/acid pick
    }));

    // rising venom EMBERS (energy sparks lifting + swaying)
    const NE = num("embers", 64);
    embers = Array.from({ length: NE }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.7),
      vy: R(-9, -22) / 60, sway: R(0.4, 1.5),
      ph: R(0, 6.283), a: R(0.25, 0.85),
      hue: srnd(),
    }));

    // ELECTRIC ARCS: short crackling forks that snap on/off at intervals
    const NA = num("arcs", 5);
    arcs = Array.from({ length: NA }, () => ({
      x: R(W * 0.12, W * 0.88), y: R(H * 0.12, H * 0.88),
      ang: R(0, 6.283), len: R(140, 320),
      next: R(0, 1.6),                            // time until next strike
      on: 0,                                      // remaining lit time
      seed: (srnd() * 1e9) | 0,
    }));
  }
  buildField();

  // draw one jagged lightning bolt from (x,y) along angle, deterministic per call seed
  function drawBolt(x, y, ang, len, seg, sd, col, wMul) {
    let bs = sd >>> 0;
    const rr = () => { bs = (bs + 0x9E3779B9) | 0; let t = bs ^ (bs >>> 16); t = Math.imul(t, 0x21f0aaad); t ^= t >>> 15; return ((t >>> 0) % 1000) / 1000; };
    ctx.beginPath();
    ctx.moveTo(Math.round(x), Math.round(y));
    let cx = x, cy = y;
    const step = len / seg, nx = Math.cos(ang), ny = Math.sin(ang), px = -ny, py = nx;
    for (let i = 1; i <= seg; i++) {
      const jag = (rr() - 0.5) * 38;
      cx = x + nx * step * i + px * jag;
      cy = y + ny * step * i + py * jag;
      ctx.lineTo(Math.round(cx), Math.round(cy));
      // occasional fork
      if (rr() > 0.78 && i < seg) {
        const fang = ang + (rr() - 0.5) * 1.4;
        const fl = step * (1 + rr());
        ctx.moveTo(Math.round(cx), Math.round(cy));
        ctx.lineTo(Math.round(cx + Math.cos(fang) * fl), Math.round(cy + Math.sin(fang) * fl));
        ctx.moveTo(Math.round(cx), Math.round(cy));
      }
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6 * wMul;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke();
  }

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    life += dt;
    const cxw = W / 2, cyh = H / 2;

    // SURGE speed-lines along the slash diagonal
    ctx.shadowBlur = 0;
    for (const l of lines) {
      l.p += l.sp * dt;
      if (l.p > 1.25) { l.p -= 1.5; }
      // map travel 0..1 to a long path crossing the frame on the diagonal
      const travel = (l.p - 0.5) * 2600;
      const x = cxw + DX * travel + (-DY) * l.off;
      const y = cyh + DY * travel + (DX) * l.off;
      const ex = x + DX * l.len, ey = y + DY * l.len;
      // fade in/out near travel ends
      const edge = Math.min(1, Math.min(l.p + 0.25, 1.25 - l.p) * 3);
      const g = ctx.createLinearGradient(x, y, ex, ey);
      const col = l.hue < 0.62 ? "0,255,102" : (l.hue < 0.85 ? "198,255,0" : "10,224,255");
      g.addColorStop(0, "rgba(" + col + ",0)");
      g.addColorStop(0.5, "rgba(" + col + "," + (l.a * edge).toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + col + ",0)");
      ctx.strokeStyle = g; ctx.lineWidth = l.w; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(Math.round(x), Math.round(y));
      ctx.lineTo(Math.round(ex), Math.round(ey));
      ctx.stroke();
    }

    // ELECTRIC ARCS — snap on for a short flash, then recharge
    for (const a of arcs) {
      a.next -= dt;
      if (a.on > 0) {
        a.on -= dt;
        const flick = ((a.seed + ((life * 60) | 0)) % 3);  // deterministic flicker
        const lit = 0.55 + flick * 0.18;
        ctx.globalAlpha = lit;
        ctx.shadowColor = "rgba(10,224,255,.9)"; ctx.shadowBlur = 16;
        drawBolt(a.x, a.y, a.ang, a.len, 7, a.seed ^ ((life * 30) | 0), "#0AE0FF", 1.6);
        ctx.shadowBlur = 8;
        drawBolt(a.x, a.y, a.ang, a.len, 7, a.seed ^ ((life * 30) | 0), "#EAFFF2", 0.7);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      } else if (a.next <= 0) {
        // re-strike: pick a fresh position/angle deterministically from current seed
        a.seed = (a.seed * 1103515245 + 12345) | 0;
        const r = (n) => (((a.seed = (a.seed * 1103515245 + 12345) | 0) >>> (n)) & 0xffff) / 0xffff;
        a.x = W * (0.12 + r(8) * 0.76);
        a.y = H * (0.12 + r(4) * 0.76);
        a.ang = r(2) * 6.283;
        a.len = 140 + r(6) * 200;
        a.on = 0.10 + r(10) * 0.12;
        a.next = 0.7 + r(12) * 1.8;
      }
    }

    // rising venom EMBERS
    for (const e of embers) {
      e.y += e.vy * dt * 60; e.ph += 0.05 * dt * 60;
      e.x += Math.sin(e.ph) * e.sway * 0.7;
      if (e.y < -12) { e.y = H + 12; }
      if (e.x < -12) e.x = W + 12; if (e.x > W + 12) e.x = -12;
      const tw = 0.55 + Math.sin(e.ph * 1.6) * 0.45;
      const col = e.hue < 0.6 ? "#00FF66" : (e.hue < 0.85 ? "#C6FF00" : "#0AE0FF");
      ctx.globalAlpha = e.a * tw;
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 7 * e.z;
      const sz = Math.max(1, Math.round(e.z * 1.8));
      ctx.fillRect(Math.round(e.x), Math.round(e.y), sz, sz);
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
  window.__venomDraw = () => drawBg(1 / 30);

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
