/* ============================================================
   MECHA HANGAR — shared engine ("Launch Bay 07")
   fit() scaling, the animated canvas field (welding SPARKS / embers
   rising + arcing from below, fine industrial DUST drifting in the
   raking light shafts, and a slow reactor heat-haze pulse — all on
   ONE <canvas class="bg">), the no-numbers hazard CHARGE GAUGE, and
   the status / kicker flip. Render mode (?render=1) freezes entrances
   and exposes deterministic __renderPlay()/__renderAdvance() so the
   headless pipeline captures frames to webm without virtual time.
   Deterministic seeded RNG -> reproducible field. Runs only what a
   scene includes; every optional subsystem is null-guarded.
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

  /* ---- hazard charge gauge = hidden timer (no numbers) + status flip ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) { k.textContent = k.dataset.done; k.classList.add("done"); }
      const st = $id("status");
      if (st && st.dataset.done) st.textContent = st.dataset.done;
    }
  }

  /* ============================================================
     CANVAS FIELD: rising welding SPARKS / embers + fine industrial
     DUST in the light shafts + a slow reactor heat-haze glow at the
     bottom of the bay. Deterministic seeded RNG (mulberry32) so render
     mode is reproducible — NO Math.random in the frame fn.
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let sparks = [], dust = [], haze = 0;

  let _s = 0x4D3C >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function spawnSpark() {
    // sparks erupt from the bottom seam zone, arc up + fan outward
    const fromCentre = R(0.32, 0.68);              // emitter clustered mid-bay
    return {
      x: W * fromCentre + R(-160, 160),
      y: H + R(0, 30),
      vx: R(-2.4, 2.4),
      vy: R(-13, -7.5),                            // strong upward kick
      g: R(0.10, 0.20),                            // gravity pulls it back
      life: 0, max: R(48, 104),
      heat: R(0.7, 1),                             // 1 = white-hot, ->0 amber/red
      sz: R(1.0, 2.4),
    };
  }

  function buildField() {
    _s = 0x4D3C >>> 0;                             // reset seed -> identical field
    sparks = []; dust = []; haze = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    const NS = num("sparks", 46);
    sparks = Array.from({ length: NS }, () => {
      const s = spawnSpark();
      s.life = R(0, s.max);                        // stagger so the field is full at t=0
      s.y = H - (s.life / s.max) * R(120, 760);
      return s;
    });

    // fine industrial dust caught in the raking light shafts (drifts slowly)
    const ND = num("dust", 70);
    dust = Array.from({ length: ND }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.6),
      vx: R(-3, 2) / 60, vy: R(3, 9) / 60,         // mostly settling down + slight drift
      ph: R(0, 6.283), tw: R(0.4, 1.4), a: R(0.10, 0.42),
    }));
  }
  buildField();

  function drawBg(dt) {
    if (!ctx) return;
    const f = dt * 60;                              // frames-equivalent of this step
    ctx.clearRect(0, 0, W, H);

    // --- reactor heat-haze: slow amber pulse pooled at the bay floor ---
    haze += 0.02 * f;
    const pulse = 0.5 + Math.sin(haze) * 0.5;
    const hy = H * 0.92;
    const hg = ctx.createRadialGradient(W / 2, hy, 0, W / 2, hy, 760);
    hg.addColorStop(0, `rgba(245,166,35,${(0.10 + pulse * 0.06).toFixed(3)})`);
    hg.addColorStop(0.5, `rgba(245,120,35,${(0.04 + pulse * 0.03).toFixed(3)})`);
    hg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(W / 2, hy, 760, 0, 6.2832); ctx.fill();

    // --- fine dust in the light shafts (drawn under sparks) ---
    for (const d of dust) {
      d.x += d.vx * f; d.y += d.vy * f; d.ph += 0.035 * f;
      if (d.y > H + 8) { d.y = -8; d.x = srnd() * W; }
      if (d.x < -8) d.x = W + 8; if (d.x > W + 8) d.x = -8;
      const tw = 0.5 + Math.sin(d.ph * d.tw) * 0.5;
      ctx.globalAlpha = d.a * tw * 0.8;
      ctx.fillStyle = "#C8D2D9";
      const sz = Math.max(1, Math.round(d.z * 1.4));
      ctx.fillRect(Math.round(d.x), Math.round(d.y), sz, sz);
    }
    ctx.globalAlpha = 1;

    // --- rising welding sparks / embers (additive, hot core) ---
    ctx.globalCompositeOperation = "lighter";
    for (const s of sparks) {
      s.vy += s.g * f;                              // gravity
      s.x += s.vx * f; s.y += s.vy * f;
      s.life += f;
      if (s.life >= s.max || s.y > H + 40) {
        Object.assign(s, spawnSpark());            // recycle from the floor
        continue;
      }
      const k = s.life / s.max;                     // 0..1 age
      const fade = k < 0.12 ? k / 0.12 : (1 - (k - 0.12) / 0.88);  // quick in, slow out
      const a = Math.max(0, fade) * 0.95;
      // colour: white-hot core -> amber -> deep red as it cools
      const heat = s.heat * (1 - k * 0.6);
      const cr = 255;
      const cg = Math.round(120 + heat * 130);
      const cb = Math.round(30 + heat * 90);
      const x = Math.round(s.x), y = Math.round(s.y);
      // glow
      ctx.globalAlpha = a * 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, s.sz * 5);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},0.9)`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, s.sz * 5, 0, 6.2832); ctx.fill();
      // hot core
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(x, y, Math.max(1, Math.round(s.sz)), Math.max(1, Math.round(s.sz)));
      // motion streak (trailing the velocity)
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.8)`;
      ctx.lineWidth = Math.max(1, s.sz * 0.8);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(Math.round(s.x - s.vx * 1.6), Math.round(s.y - s.vy * 1.6));
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
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
  window.__mechaDraw = () => drawBg(1 / 30);

  /* ---- free-running loop (skipped in render mode) ---- */
  if (!render) {
    let barT0 = null;
    if (fill) { setTimeout(() => { barT0 = performance.now(); }, 60); }
    let last = null, acc = 0; const FRAME = 1000 / 30;
    function loop(now) {
      requestAnimationFrame(loop);
      if (last == null) last = now;
      let dt = now - last; last = now; if (dt > 100) dt = 100;   // delta clamp
      acc += dt; if (acc < FRAME) return; const step = acc / 1000; acc = 0;
      drawBg(step);
      if (barT0 != null) tick((now - barT0) / 1000);
    }
    requestAnimationFrame(loop);
  }
})();
