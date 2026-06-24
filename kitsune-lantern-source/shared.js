/* ============================================================
   KITSUNE LANTERN — shared engine ("Foxfire Night")
   fit() scaling, the animated canvas field (drifting FOXFIRE
   kitsune-bi wisps — small blue-violet/gold flame motes that bob
   and breathe — plus slow RISING gold embers and a few falling
   petals), the no-numbers lantern-wick loading bar. Render mode
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

  /* ---- lantern-wick loading bar = hidden timer (no numbers) ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
  }

  /* ============================================================
     CANVAS FIELD: drifting FOXFIRE wisps (kitsune-bi) + rising gold
     embers + a few slow falling petals. Deterministic seeded RNG so
     render mode is reproducible (no Math.random in the frame fn).
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let wisps = [], embers = [], petals = [], life = 0;

  // tiny seeded PRNG (mulberry32) — stable field every build
  let _s = 0x9E37 >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function buildField() {
    _s = 0x9E37 >>> 0;                 // reset seed -> identical field every build
    wisps = []; embers = []; petals = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // FOXFIRE wisps — soft flame motes that bob, breathe + slowly drift.
    // Most are violet kitsune-bi; some are warm gold to echo the lanterns.
    const NW = num("wisps", 26);
    wisps = Array.from({ length: NW }, () => {
      const warm = srnd() < 0.4;
      return {
        x: R(0, W), y: R(H * 0.18, H),
        r: R(7, 20),                   // flame radius
        drift: R(-7, 7) / 60,          // slow horizontal drift
        rise: R(4, 14) / 60,           // gentle upward bob velocity
        ph: R(0, 6.283),               // sway/breathe phase
        sw: R(0.5, 1.4),               // sway amount
        sp: R(0.5, 1.3),               // breathe speed
        a: R(0.28, 0.62),
        warm,
      };
    });

    // RISING gold embers — tiny sparks lifting off the lanterns/ground
    const NE = num("embers", 60);
    embers = Array.from({ length: NE }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.5, 1.7),
      vy: R(-22, -7) / 60,             // rise
      sway: R(0.3, 1.2), ph: R(0, 6.283), tw: R(0.6, 1.8), a: R(0.3, 0.85),
    }));

    // a few slow falling petals/embers for folklore drift
    const NP = num("petals", 12);
    petals = Array.from({ length: NP }, () => ({
      x: R(0, W), y: R(-H, H), z: R(0.7, 1.5),
      vy: R(8, 18) / 60, sway: R(0.6, 1.8), ph: R(0, 6.283), rot: R(0, 6.283),
      vr: R(-0.5, 0.5) / 60, a: R(0.18, 0.4),
    }));
  }
  buildField();

  // one foxfire flame mote: a soft radial bloom with a brighter core
  function drawWisp(w, t) {
    const breathe = 0.78 + 0.22 * Math.sin(t * w.sp * 2.4 + w.ph);
    const r = w.r * breathe;
    if (r < 0.5) return;
    const x = Math.round(w.x + Math.sin(t * 0.9 + w.ph) * w.sw * 8);
    const y = Math.round(w.y);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
    if (w.warm) {
      g.addColorStop(0.0, "rgba(255,229,170," + (w.a).toFixed(3) + ")");
      g.addColorStop(0.35, "rgba(255,106,61," + (w.a * 0.6).toFixed(3) + ")");
      g.addColorStop(1.0, "rgba(255,106,61,0)");
    } else {
      g.addColorStop(0.0, "rgba(206,196,255," + (w.a).toFixed(3) + ")");
      g.addColorStop(0.35, "rgba(123,92,255," + (w.a * 0.6).toFixed(3) + ")");
      g.addColorStop(1.0, "rgba(123,92,255,0)");
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 6.2832); ctx.fill();
    // bright core
    ctx.globalAlpha = Math.min(1, w.a * 1.4) * breathe;
    ctx.fillStyle = w.warm ? "#FFF1D6" : "#E8E2FF";
    ctx.beginPath(); ctx.arc(x, y, Math.max(1, r * 0.38), 0, 6.2832); ctx.fill();
  }

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    life += dt;

    // FOXFIRE wisps drift + slowly bob upward, wrapping the field
    ctx.shadowBlur = 0;
    for (const w of wisps) {
      w.x += w.drift * dt * 60;
      w.y -= w.rise * dt * 60;
      if (w.y < -30) { w.y = H + 30; w.x = R(0, W); }
      if (w.x < -40) w.x = W + 40; if (w.x > W + 40) w.x = -40;
      drawWisp(w, life);
    }

    // rising gold embers (tiny twinkling sparks)
    for (const e of embers) {
      e.y += e.vy * dt * 60; e.ph += 0.05 * dt * 60;
      e.x += Math.sin(e.ph) * e.sway * 0.5;
      if (e.y < -10) { e.y = H + 10; e.x = R(0, W); }
      const tw = 0.5 + Math.sin(e.ph * e.tw) * 0.5;
      ctx.globalAlpha = e.a * tw;
      ctx.fillStyle = "#FFD166"; ctx.shadowColor = "#FF6A3D"; ctx.shadowBlur = 7 * e.z;
      const sz = Math.max(1, Math.round(e.z * 1.7));
      ctx.fillRect(Math.round(e.x), Math.round(e.y), sz, sz);
    }
    ctx.shadowBlur = 0;

    // slow falling petals (soft warm diamonds)
    for (const p of petals) {
      p.y += p.vy * dt * 60; p.ph += 0.03 * dt * 60; p.rot += p.vr * dt * 60;
      p.x += Math.sin(p.ph) * p.sway * 0.6;
      if (p.y > H + 16) { p.y = -16; p.x = R(0, W); }
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y)); ctx.rotate(p.rot);
      ctx.globalAlpha = p.a;
      ctx.fillStyle = "#FF8A5C";
      const s = 4 * p.z;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
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
  window.__kitsuneDraw = () => drawBg(1 / 30);

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
