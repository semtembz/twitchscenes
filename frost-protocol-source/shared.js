/* ============================================================
   FROST PROTOCOL — shared engine ("Clean Room HUD")
   fit() scaling, the animated canvas field (slowly-CRYSTALLIZING
   hexagonal ICE shards that grow + faintly rotate, plus drifting
   frost specks — condensation forming on cold glass, NOT snow), the
   no-numbers segmented loading meter, and the status flip. Render
   mode (?render=1) freezes entrances and exposes deterministic
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

  /* ---- segmented calibration meter = hidden timer (no numbers) + status flip ---- */
  const fill = $id("fill"), head = $id("head");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    if (head) head.style.left = (p * 100).toFixed(2) + "%";
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
      const st = $id("status");
      if (st && st.dataset.done) st.textContent = st.dataset.done;
    }
  }

  /* ============================================================
     CANVAS FIELD: crystallizing hexagonal ice shards + frost specks
     Deterministic seeded RNG so render mode is reproducible.
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let shards = [], specks = [], life = 0;

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0x5151 >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function buildField() {
    _s = 0x5151 >>> 0;                 // reset seed -> identical field every build
    shards = []; specks = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // hexagonal/angular ice shards that slowly "crystallize" (grow in)
    const NSH = num("shards", 26);
    shards = Array.from({ length: NSH }, () => ({
      x: R(0, W), y: R(0, H),
      rad: R(26, 96),                  // final radius
      ph: R(0, 6.283),                 // birth phase for stagger
      spin: R(-0.06, 0.06),            // slow rotation rate (rad/s)
      rot: R(0, 6.283),
      grow: R(0.05, 0.16),             // crystallization speed
      a: R(0.05, 0.16),                // peak alpha (low)
      ice: srnd() < 0.5,               // accent vs ice-light tint
      arms: srnd() < 0.5 ? 6 : 6,      // hexagonal
    }));

    // drifting frost specks (fine condensation motes)
    const NSP = num("specks", 90);
    specks = Array.from({ length: NSP }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.6),
      vx: R(-4, 4) / 60, vy: R(-3, 6) / 60,
      ph: R(0, 6.283), tw: R(0.4, 1.4), a: R(0.2, 0.7),
    }));
  }
  buildField();

  // draw one hexagonal frost crystal (six radial arms with side branches)
  function drawShard(s, scale) {
    const r = s.rad * scale;
    if (r < 1) return;
    ctx.save();
    ctx.translate(Math.round(s.x), Math.round(s.y));
    ctx.rotate(s.rot);
    ctx.globalAlpha = s.a * Math.min(1, scale);
    ctx.strokeStyle = s.ice ? "#CFE6F2" : "#7FB4D6";
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i;
      const ex = Math.cos(ang) * r, ey = Math.sin(ang) * r;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(ex, ey);
      // side branches (dendrites) at ~0.55 and ~0.8 along the arm
      const bl = r * 0.26;
      for (const f of [0.55, 0.8]) {
        const bx = Math.cos(ang) * r * f, by = Math.sin(ang) * r * f;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(ang + 1.05) * bl, by + Math.sin(ang + 1.05) * bl);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(ang - 1.05) * bl, by + Math.sin(ang - 1.05) * bl);
      }
      ctx.stroke();
    }
    // faint hex hub
    ctx.globalAlpha = s.a * Math.min(1, scale) * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, r * 0.08), 0, 6.2832);
    ctx.fillStyle = s.ice ? "#CFE6F2" : "#7FB4D6";
    ctx.fill();
    ctx.restore();
  }

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    life += dt;

    // crystallizing ice shards (grow with an ease toward full, gentle spin)
    for (const s of shards) {
      s.rot += s.spin * dt;
      // crystallization 0..1 (eased), staggered by birth phase; breathes slowly
      const grown = 1 - Math.exp(-(life * s.grow + s.ph * 0.12));
      const breathe = 0.94 + 0.06 * Math.sin(life * 0.4 + s.ph);
      drawShard(s, grown * breathe);
    }

    // drifting frost specks
    ctx.shadowBlur = 0;
    for (const p of specks) {
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.ph += 0.04 * dt * 60;
      if (p.x < -8) p.x = W + 8; if (p.x > W + 8) p.x = -8;
      if (p.y < -8) p.y = H + 8; if (p.y > H + 8) p.y = -8;
      const tw = 0.55 + Math.sin(p.ph * p.tw) * 0.45;
      ctx.globalAlpha = p.a * tw;
      ctx.fillStyle = "#CFE6F2";
      const sz = Math.max(1, Math.round(p.z * 1.6));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
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
  window.__frostDraw = () => drawBg(1 / 30);

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
