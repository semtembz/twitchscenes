/* ============================================================
   WITCHING HOUR — shared engine ("The Candlelit Study")
   fit() scaling, the animated canvas field (drifting MOTHS that
   flutter toward the candle-glow with a small wing-flap motion +
   floating gold embers/dust rising on warm air), the no-numbers
   candle-WICK loading bar, and the optional handle. Render mode
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

  /* ---- candle-wick loading bar = hidden timer (no numbers) ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
  }

  /* ============================================================
     CANVAS FIELD: drifting MOTHS fluttering toward the candle-glow
     + floating gold embers/dust rising on warm air.
     Deterministic seeded RNG so render mode is reproducible.
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let moths = [], embers = [], life = 0;
  // the candlelight the moths are drawn toward (centre, a touch high)
  const FLAME_X = 960, FLAME_Y = 470;

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0x7717 >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function buildField() {
    _s = 0x7717 >>> 0;                 // reset seed -> identical field every build
    moths = []; embers = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // MOTHS: each orbits the candle-glow on a slow loose ellipse, edging inward
    // and out again (drawn toward the light but never landing on the title), with
    // a fast wing-flap. Kept to the margins by large orbit radii.
    const NM = num("moths", 7);
    moths = Array.from({ length: NM }, () => {
      const side = srnd() < 0.5 ? -1 : 1;
      return {
        // orbit centre biased to the left/right margins around the flame
        cx: FLAME_X + side * R(360, 720),
        cy: FLAME_Y + R(-200, 320),
        rx: R(120, 260), ry: R(80, 170),     // loose elliptical wander
        ang: R(0, 6.283), spd: R(0.10, 0.24) * (srnd() < 0.5 ? -1 : 1),
        wob: R(0, 6.283), wobs: R(0.5, 1.1),  // slow radius wobble (drift toward light)
        flap: R(0, 6.283), flaps: R(15, 22),  // wing-flap rate
        size: R(11, 19), a: R(0.5, 0.85),
        pale: srnd() < 0.4,                    // pale luna vs dusty-brown moth
      };
    });

    // EMBERS / gold dust: fine motes rising on warm candle air, twinkling
    const NE = num("embers", 64);
    embers = Array.from({ length: NE }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.7),
      vy: R(-13, -3) / 60, sway: R(0.3, 1.2),
      ph: R(0, 6.283), tw: R(0.5, 1.5), a: R(0.25, 0.8),
    }));
  }
  buildField();

  // draw one moth: a fuzzy body + two flapping wings, dusted gold by candlelight
  function drawMoth(m, x, y, heading) {
    const flap = 0.32 + Math.abs(Math.sin(m.flap)) * 0.95;   // 0.32..1.27 wing spread
    const s = m.size;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(heading + Math.PI / 2);                       // nose along travel
    ctx.globalAlpha = m.a;
    const wingCol = m.pale ? "rgba(232,224,204,0.85)" : "rgba(201,162,75,0.82)";
    const wingEdge = m.pale ? "rgba(231,200,120,0.9)" : "rgba(231,200,120,0.7)";
    ctx.shadowColor = "rgba(231,200,120,0.5)"; ctx.shadowBlur = 8;
    // two upper + two lower wings, scaled in X by the flap
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side * flap, 1);
      ctx.fillStyle = wingCol; ctx.strokeStyle = wingEdge; ctx.lineWidth = 1;
      // upper forewing
      ctx.beginPath();
      ctx.ellipse(s * 0.62, -s * 0.18, s * 0.62, s * 0.42, -0.5, 0, 6.2832);
      ctx.fill(); ctx.stroke();
      // lower hindwing
      ctx.beginPath();
      ctx.ellipse(s * 0.5, s * 0.4, s * 0.46, s * 0.34, 0.4, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }
    // fuzzy body
    ctx.shadowBlur = 4;
    ctx.fillStyle = m.pale ? "rgba(216,206,180,0.95)" : "rgba(120,92,52,0.95)";
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.16, s * 0.55, 0, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    life += dt;

    // rising gold embers / dust
    for (const e of embers) {
      e.y += e.vy * dt * 60; e.ph += 0.035 * dt * 60; e.x += Math.sin(e.ph) * e.sway * 0.6;
      if (e.y < -12) { e.y = H + 12; e.x = (e.x + 137) % W; }
      const tw = 0.55 + Math.sin(e.ph * e.tw) * 0.45;
      ctx.globalAlpha = e.a * tw;
      ctx.fillStyle = "#E7C878";
      ctx.shadowColor = "#E7C878"; ctx.shadowBlur = 6 * e.z;
      const sz = Math.max(1, Math.round(e.z * 1.6));
      ctx.fillRect(Math.round(e.x), Math.round(e.y), sz, sz);
    }
    ctx.shadowBlur = 0;

    // moths fluttering toward the candle-glow
    for (const m of moths) {
      m.ang += m.spd * dt;
      m.wob += m.wobs * dt;
      m.flap += m.flaps * dt;
      // radius breathes in toward the light (warm pull) then eases out
      const pull = 0.78 + 0.22 * Math.sin(m.wob);
      const x = m.cx + Math.cos(m.ang) * m.rx * pull;
      const y = m.cy + Math.sin(m.ang) * m.ry * pull;
      // heading = tangent of the ellipse (direction of travel)
      const hx = -Math.sin(m.ang) * m.rx * m.spd;
      const hy = Math.cos(m.ang) * m.ry * m.spd;
      const heading = Math.atan2(hy, hx);
      drawMoth(m, x, y, heading);
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
  window.__witchDraw = () => drawBg(1 / 30);

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
