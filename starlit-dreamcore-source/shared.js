/* ============================================================
   STARLIT DREAMCORE — shared engine ("Sleeping Sky")
   fit() scaling, the animated canvas field (a hazy night sky:
   TWINKLING stars of varied sizes fading in/out, gentle floating
   SPARKLES, the occasional slow SHOOTING STAR streaking across,
   and a faint soft bloom drifting through), the no-numbers 60s
   loading bar (a glowing star-trail line), and the editable slots.
   Render mode (?render=1) freezes CSS entrances and exposes
   deterministic __renderPlay()/__renderAdvance() so the headless
   pipeline captures frames to webm without virtual time. Runs only
   what a scene includes; every optional subsystem is null-guarded.
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

  /* ---- 60s loading bar = hidden timer (no numbers) ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
  }

  /* ============================================================
     CANVAS FIELD: a hazy dreamcore night sky.
       - twinkling stars (varied sizes, fade in/out)
       - gentle floating sparkles (drift + soft glints)
       - the occasional slow SHOOTING STAR (deterministic schedule)
     Deterministic seeded RNG so render mode is reproducible (no
     Math.random in the frame fn).
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let stars = [], sparks = [], shooters = [], life = 0;

  // tiny seeded PRNG (mulberry32-style) — no Math.random in the frame fn
  let _s = 0x5747 >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function buildField() {
    _s = 0x5747 >>> 0;                 // reset seed -> identical field every build
    stars = []; sparks = []; shooters = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // twinkling stars — varied sizes, each on its own slow twinkle cycle
    const NST = num("stars", 150);
    const TINT = ["#FFFFFF", "#F2C6FF", "#B8A4FF", "#FFFFFF", "#D9CCFF"];
    stars = Array.from({ length: NST }, () => ({
      x: R(0, W), y: R(0, H),
      r: R(0.6, 2.6),                  // size
      base: R(0.18, 0.6),              // base brightness
      amp: R(0.3, 0.8),                // twinkle amplitude
      sp: R(0.5, 1.8),                 // twinkle speed
      ph: R(0, 6.283),                 // phase offset
      c: TINT[(srnd() * TINT.length) | 0],
      big: srnd() < 0.14,              // a few get cross-glints
    }));

    // gentle floating sparkles — soft motes drifting upward, slow sway
    const NSP = num("sparks", 46);
    sparks = Array.from({ length: NSP }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.5, 1.7),
      vy: R(-6, -1) / 60, sway: R(0.2, 0.9),
      ph: R(0, 6.283), tw: R(0.6, 1.6), a: R(0.2, 0.6),
      c: srnd() < 0.5 ? "#F2C6FF" : "#B8A4FF",
    }));

    // shooting stars — slow, occasional; a deterministic stagger so at most
    // one or two streak at a time across the upper sky.
    const NSH = num("shooters", 3);
    shooters = Array.from({ length: NSH }, (_, i) => ({
      x0: R(W * 0.30, W * 0.95),       // start x (upper sky)
      y0: R(H * 0.05, H * 0.42),       // start y
      ang: R(2.55, 2.95),              // heading (down-left, radians)
      len: R(180, 320),                // streak length
      dur: R(1.1, 1.8),                // seconds to cross
      period: R(11, 17),               // seconds between appearances
      offset: R(0, 1) * 14 + i * 5.5,  // staggered start
      sp: R(620, 900),                 // px/s travel
    }));
  }
  buildField();

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    life += dt;

    // a faint soft bloom that drifts slowly through the sky (dreamy haze)
    const bx = W * 0.5 + Math.sin(life * 0.12) * W * 0.12;
    const by = H * 0.42 + Math.cos(life * 0.09) * H * 0.10;
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, 560);
    bg.addColorStop(0, "rgba(184,164,255,0.06)");
    bg.addColorStop(0.5, "rgba(108,92,224,0.04)");
    bg.addColorStop(1, "rgba(108,92,224,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // twinkling stars
    for (const s of stars) {
      const tw = s.base + s.amp * (0.5 + 0.5 * Math.sin(life * s.sp + s.ph));
      const a = tw < 0 ? 0 : tw > 1 ? 1 : tw;
      const x = Math.round(s.x), y = Math.round(s.y);
      ctx.globalAlpha = a;
      ctx.fillStyle = s.c;
      ctx.shadowColor = s.c;
      ctx.shadowBlur = s.r * 4;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, 6.2832);
      ctx.fill();
      // a few bright stars get a soft cross-glint
      if (s.big && a > 0.5) {
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = s.c;
        ctx.lineWidth = 1;
        const g = s.r * 5;
        ctx.beginPath();
        ctx.moveTo(x - g, y); ctx.lineTo(x + g, y);
        ctx.moveTo(x, y - g); ctx.lineTo(x, y + g);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;

    // gentle floating sparkles
    for (const p of sparks) {
      p.y += p.vy * dt * 60; p.ph += 0.03 * dt * 60; p.x += Math.sin(p.ph) * p.sway * 0.5;
      if (p.y < -10) { p.y = H + 10; p.x = R(0, W); }
      if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
      const tw = 0.5 + Math.sin(p.ph * p.tw) * 0.5;
      ctx.globalAlpha = p.a * tw;
      ctx.fillStyle = p.c;
      ctx.shadowColor = p.c;
      ctx.shadowBlur = 8 * p.z;
      const sz = Math.max(1, Math.round(p.z * 1.7));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    // occasional slow shooting stars
    for (const sh of shooters) {
      const local = ((life + sh.offset) % sh.period);
      if (local > sh.dur) continue;            // dormant most of the time
      const k = local / sh.dur;                // 0..1 across its streak
      const dx = Math.cos(sh.ang), dy = Math.sin(sh.ang);
      const travel = sh.sp * sh.dur;
      const hx = sh.x0 + dx * travel * k;
      const hy = sh.y0 + dy * travel * k;
      const tx = hx - dx * sh.len;
      const ty = hy - dy * sh.len;
      const fade = Math.sin(k * Math.PI);      // fade in + out over the streak
      const grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, "rgba(242,198,255,0)");
      grad.addColorStop(1, "rgba(255,255,255," + (0.85 * fade).toFixed(3) + ")");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.shadowColor = "#F2C6FF";
      ctx.shadowBlur = 14 * fade;
      ctx.beginPath();
      ctx.moveTo(Math.round(tx), Math.round(ty));
      ctx.lineTo(Math.round(hx), Math.round(hy));
      ctx.stroke();
      // bright head
      ctx.globalAlpha = fade;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(Math.round(hx), Math.round(hy), 2.4, 0, 6.2832);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
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
  window.__dreamDraw = () => drawBg(1 / 30);

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
