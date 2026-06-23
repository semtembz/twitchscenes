/* ============================================================
   CHAMPAGNE MONO — shared engine ("The Invitation")
   fit() scaling, the animated canvas field (fine drifting GOLD-DUST
   motes on the LIGHT ivory bg — low alpha, soft, like champagne
   particles catching light), the no-numbers ultra-thin loading line,
   and the editable-slot loop. Render mode (?render=1) freezes
   entrances and exposes deterministic __renderPlay()/__renderAdvance()
   so the headless pipeline captures frames to webm without virtual
   time. Runs only what a scene includes; every optional subsystem is
   null-guarded.
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

  /* ---- ultra-thin champagne loading line (no numbers) + status flip ---- */
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
     CANVAS FIELD: fine drifting champagne GOLD-DUST motes on the
     light ivory bg. Low alpha, soft glow, gentle upward+sway drift —
     particles catching light in an airy room, never busy. Plus a few
     very faint large warm "bloom" discs that breathe to keep the
     ivory feeling lit, not flat. Deterministic seeded RNG so render
     mode is reproducible (no Math.random in the frame fn).
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let motes = [], blooms = [], life = 0;

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0xC9A8 >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function buildField() {
    _s = 0xC9A8 >>> 0;                 // reset seed -> identical field every build
    motes = []; blooms = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // fine gold-dust motes — drift gently upward with a slow sway
    const NM = num("motes", 84);
    motes = Array.from({ length: NM }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.7),
      vy: R(-9, -2) / 60,              // mostly rising, airy
      sway: R(0.3, 1.3), ph: R(0, 6.283), tw: R(0.6, 1.5),
      a: R(0.12, 0.5),                  // LOW alpha on the light bg
      warm: srnd() < 0.4,               // deep-gold vs champagne tint
    }));

    // a few faint, large warm bloom discs (breathe slowly, keep bg lit)
    const NB = num("blooms", 5);
    blooms = Array.from({ length: NB }, () => ({
      x: R(0.1 * W, 0.9 * W), y: R(0.1 * H, 0.9 * H),
      r: R(220, 420), a: R(0.035, 0.075),
      ph: R(0, 6.283), ps: R(0.3, 0.7),
    }));
  }
  buildField();

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    life += dt;

    // faint warm bloom discs (multiply-ish warmth without darkening the page)
    ctx.globalCompositeOperation = "source-over";
    for (const b of blooms) {
      b.ph += b.ps * dt;
      const rr = b.r * (1 + Math.sin(b.ph) * 0.08);
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
      g.addColorStop(0, "rgba(201,168,106," + (b.a * (0.85 + 0.15 * Math.sin(b.ph))).toFixed(3) + ")");
      g.addColorStop(1, "rgba(201,168,106,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(Math.round(b.x), Math.round(b.y), rr, 0, 6.2832); ctx.fill();
    }

    // drifting gold-dust motes (soft glow, low alpha)
    for (const m of motes) {
      m.y += m.vy * dt * 60; m.ph += 0.035 * dt * 60;
      m.x += Math.sin(m.ph) * m.sway * 0.55;
      if (m.y < -12) { m.y = H + 12; m.x = R(0, W); }
      if (m.x < -12) m.x = W + 12; if (m.x > W + 12) m.x = -12;
      const tw = 0.5 + Math.sin(m.ph * m.tw) * 0.5;
      ctx.globalAlpha = m.a * tw;
      ctx.fillStyle = m.warm ? "#9C8458" : "#C9A86A";
      ctx.shadowColor = "#C9A86A";
      ctx.shadowBlur = 5 * m.z;
      const sz = Math.max(1, Math.round(m.z * 1.6));
      ctx.fillRect(Math.round(m.x), Math.round(m.y), sz, sz);
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
  window.__champDraw = () => drawBg(1 / 30);

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
