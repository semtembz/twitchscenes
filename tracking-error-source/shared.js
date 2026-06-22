/* ============================================================
   TRACKING ERROR — shared engine ("Please Stand By")
   fit() scaling, the animated canvas field (analog VHS NOISE: a moving
   field of fine luminance snow, intermittent white DROPOUT streaks that
   tear across the picture, and a soft chroma-shifted scan smear that
   rolls down — the visual signature of a tape losing tracking), the
   no-numbers tape-progress loading strap, and the status flip. Render
   mode (?render=1) freezes entrances and exposes deterministic
   __renderPlay()/__renderAdvance() so the headless pipeline captures
   frames to webm without virtual time. Runs only what a scene includes;
   every optional subsystem is null-guarded.
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

  /* ---- tape-progress strap = hidden timer (no numbers) + status flip ---- */
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
     CANVAS FIELD: analog VHS noise. A persistent low bed of fine
     luminance snow, occasional white DROPOUT streaks tearing across the
     image, and a horizontal chroma-shift SMEAR band that rolls slowly
     down (the tracking error). Deterministic seeded RNG so render mode
     is reproducible (NO Math.random in the frame fn).
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let snow = [], streaks = [], smearY = 0, frame = 0;

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0x54450F >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function buildField() {
    _s = 0x54450F >>> 0;                // reset seed -> identical field every build
    snow = []; streaks = []; smearY = -120; frame = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    // a sparse persistent pool of "snow" specks we re-roll each frame for shimmer
    const NS = num("snow", 520);
    snow = Array.from({ length: NS }, () => ({
      x: R(0, W), y: R(0, H), s: R(1, 3), a: R(0.05, 0.32), j: R(0, 1),
    }));

    // dropout streaks: short bright horizontal tears that fire intermittently
    const NK = num("streaks", 9);
    streaks = Array.from({ length: NK }, () => ({
      y: R(0, H), x: R(-200, W), w: R(120, 520), h: R(1, 3),
      life: 0, period: R(40, 180) | 0, off: (R(0, 180)) | 0,
      cyan: srnd() > 0.5,
    }));
  }
  buildField();

  function drawBg(dt) {
    if (!ctx) return;
    const steps = dt * 60;             // normalize motion to 60fps units
    frame++;

    // base wash: a faint dark grey video bed (NOT a clear — gives tube depth)
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(15,15,15,0.42)";
    ctx.fillRect(0, 0, W, H);
    // fade previous noise so we don't fully clear (subtle persistence/ghost)
    // (the fill above doubles as the clear with slight motion-trail feel)

    // ---- fine luminance SNOW (re-rolled each frame) ----
    for (const p of snow) {
      // jitter position a touch each frame for shimmer
      p.x += (srnd() - 0.5) * 6 * steps;
      p.y += (srnd() - 0.5) * 6 * steps;
      if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
      if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
      const v = 0.18 + srnd() * 0.82;          // luminance flicker
      ctx.globalAlpha = p.a * v;
      // mostly white snow, with a hint of chroma fringe on a fraction
      ctx.fillStyle = "#E8E8E8";
      const sz = Math.max(1, Math.round(p.s));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }

    // ---- chroma-shift SMEAR band rolling slowly down (the tracking error) ----
    smearY += 1.4 * steps;
    if (smearY > H + 160) smearY = -160;
    const bandH = 150;
    // cyan ghost a few px right, red ghost a few px left, low alpha, additive
    ctx.globalCompositeOperation = "lighter";
    const drawGhost = (color, ox, alpha) => {
      const g = ctx.createLinearGradient(0, smearY, 0, smearY + bandH);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.5, color.replace("ALPHA", alpha.toFixed(3)));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(Math.round(ox), Math.round(smearY), W, bandH);
    };
    drawGhost("rgba(25,195,255,ALPHA)", 9, 0.10);
    drawGhost("rgba(255,0,51,ALPHA)", -9, 0.09);
    // a faint bright tear line at the band's leading edge
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#E8E8E8";
    ctx.fillRect(0, Math.round(smearY + bandH * 0.5), W, 2);
    ctx.globalCompositeOperation = "source-over";

    // ---- white DROPOUT streaks: short bright tears firing intermittently ----
    for (const k of streaks) {
      // each streak fires on its own period, then decays
      if ((frame + k.off) % k.period === 0) {
        k.life = 1;
        k.y = (srnd() * H) | 0;
        k.x = (srnd() * W - k.w * 0.5) | 0;
        k.w = (120 + srnd() * 420) | 0;
        k.cyan = srnd() > 0.5;
      }
      if (k.life > 0) {
        // slide + fade
        k.x += 26 * steps;
        ctx.globalAlpha = k.life * 0.85;
        // bright white core
        ctx.fillStyle = "#E8E8E8";
        ctx.fillRect(Math.round(k.x), Math.round(k.y), Math.round(k.w), Math.round(k.h));
        // chroma fringe on the leading edge
        ctx.globalAlpha = k.life * 0.5;
        ctx.fillStyle = k.cyan ? "#19C3FF" : "#FF0033";
        ctx.fillRect(Math.round(k.x + k.w), Math.round(k.y), 10, Math.round(k.h));
        k.life -= 0.10 * steps;
        if (k.life < 0) k.life = 0;
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
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
  window.__vhsDraw = () => drawBg(1 / 30);

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
