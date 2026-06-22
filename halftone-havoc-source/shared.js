/* ============================================================
   HALFTONE HAVOC — shared engine ("Inkstorm")
   The ONLY light (white paper) theme. fit() scaling, a generative
   comic-page canvas field (a regular HALFTONE DOT grid in red/blue/
   yellow + black ink whose dot SIZES pulse with a travelling wave,
   radial SPEED / focus LINES bursting from the page centre, and a
   few inky action specks), the no-numbers "charge" loading bar +
   status flip. Render mode (?render=1) freezes entrances and exposes
   deterministic __renderPlay()/__renderAdvance() so the headless
   pipeline captures frames to webm without virtual time. Every
   optional subsystem is null-guarded; runs only what a scene includes.
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
    if (iw < 10 || ih < 10) return;            // never write --scale:0
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

  /* ---- inked "charge" loading bar = hidden timer (no numbers) + status flip ---- */
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
      if (stage) stage.classList.add("done");
    }
  }

  /* ============================================================
     CANVAS FIELD: a comic-book PAGE in motion.
       (1) a regular HALFTONE dot grid in ink + the three pop colours,
           dot RADIUS modulated by a travelling diagonal wave so the
           page "breathes" like printed ink;
       (2) radial SPEED / focus lines bursting from the page centre,
           rotating very slowly, their length flickering;
       (3) a sparse drift of inky action specks (POW grit).
     Deterministic seeded RNG so render mode is reproducible (NO
     Math.random in the frame fn).
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let specks = [], spokes = [];
  let phase = 0;            // travelling halftone-wave phase (advances with dt)
  let spin = 0;            // slow rotation of the speed-line burst

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0x48414C >>> 0;   // "HAL"
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  // halftone ink colours (paper white is the page itself — never drawn)
  const INK = "#111111", YEL = "#FFD400", RED = "#FF3B30", BLU = "#1E63FF";
  const GRID = num("grid", 46);          // halftone cell pitch in px
  const MAXR = GRID * 0.62;              // largest dot radius
  let CX = W / 2, CY = H / 2;

  function buildField() {
    _s = 0x48414C >>> 0;                 // reset seed -> identical field every build
    specks = []; spokes = [];
    phase = 0; spin = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;
    CX = W / 2; CY = H / 2;

    // radial speed / focus lines bursting from centre (uneven, hand-inked feel)
    const NS = num("spokes", 60);
    let ang = 0;
    for (let i = 0; i < NS; i++) {
      ang += (6.2832 / NS) * R(0.55, 1.45);     // jittered angular spacing
      spokes.push({
        a: ang,
        wob: R(0, 6.283),                 // length-flicker phase
        ws: R(0.6, 1.8),                  // flicker speed
        w: R(1.5, 6.5),                   // line thickness
        inner: R(0.40, 0.60),             // where the line starts (frac of reach)
        len: R(0.55, 1.05),               // length scale toward the edge
      });
    }

    // inky action specks drifting outward (grit / impact debris)
    const NP = num("specks", 40);
    specks = Array.from({ length: NP }, () => {
      const a = R(0, 6.2832), sp = R(40, 150) / 60;
      return {
        x: R(0, W), y: R(0, H),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        s: R(2, 7), rot: R(0, 6.283), vr: R(-3, 3) / 60, a2: R(0.18, 0.5),
      };
    });
  }
  buildField();

  // pick a halftone dot colour from a deterministic cell hash (stable per cell)
  function cellColour(ix, iy) {
    const h = ((ix * 73856093) ^ (iy * 19349663)) >>> 0;
    const m = h % 100;
    if (m < 58) return INK;        // mostly black ink
    if (m < 73) return RED;
    if (m < 88) return BLU;
    return YEL;
  }

  function drawBg(dt) {
    if (!ctx) return;
    // advance motion
    phase += dt * 1.7;             // travelling halftone wave
    spin += dt * 0.06;            // very slow burst rotation

    ctx.clearRect(0, 0, W, H);

    /* (2) radial SPEED / focus lines from centre — drawn first, behind dots.
       Faint ink so the white page stays the star; they read as motion. */
    const reach = Math.sqrt(CX * CX + CY * CY) + 40;
    ctx.lineCap = "round";
    for (const s of spokes) {
      s.wob += s.ws * dt;
      const a = s.a + spin;
      const ca = Math.cos(a), sa = Math.sin(a);
      const flick = 0.5 + Math.sin(s.wob) * 0.5;       // 0..1 length flicker
      const r0 = reach * s.inner;
      const r1 = reach * (s.inner + (s.len - s.inner < 0 ? 0.4 : (1 - s.inner)) * (0.55 + flick * 0.45)) * s.len;
      const x0 = Math.round(CX + ca * r0), y0 = Math.round(CY + sa * r0);
      const x1 = Math.round(CX + ca * Math.max(r0 + 30, r1)), y1 = Math.round(CY + sa * Math.max(r0 + 30, r1));
      ctx.strokeStyle = "rgba(17,17,17," + (0.05 + flick * 0.07).toFixed(3) + ")";
      ctx.lineWidth = s.w;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }

    /* (1) HALFTONE dot grid. Dot radius is driven by a travelling diagonal
       wave + a soft radial falloff from centre (denser ink toward the edges,
       open white page in the middle where the title sits). */
    for (let iy = 0, gy = GRID / 2; gy < H + GRID; gy += GRID, iy++) {
      for (let ix = 0, gx = GRID / 2; gx < W + GRID; gx += GRID, ix++) {
        // travelling wave term
        const wv = 0.5 + Math.sin((gx + gy) * 0.012 - phase) * 0.5;
        // radial falloff: small dots near centre, full near edges
        const dx = (gx - CX) / W, dy = (gy - CY) / H;
        const rad = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 1.7);
        const amt = (0.18 + wv * 0.45) * (0.30 + rad * 0.90);
        const r = amt * MAXR;
        if (r < 0.6) continue;
        ctx.globalAlpha = Math.min(1, 0.22 + rad * 0.7);
        ctx.fillStyle = cellColour(ix, iy);
        ctx.beginPath();
        ctx.arc(Math.round(gx), Math.round(gy), r, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    /* (3) inky action specks — little ink chips tumbling outward */
    ctx.fillStyle = INK;
    for (const p of specks) {
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.rot += p.vr * dt * 60;
      if (p.x < -12) p.x = W + 12; if (p.x > W + 12) p.x = -12;
      if (p.y < -12) p.y = H + 12; if (p.y > H + 12) p.y = -12;
      ctx.globalAlpha = p.a2;
      const c = Math.cos(p.rot) * p.s, s2 = Math.sin(p.rot) * p.s;
      const x = Math.round(p.x), y = Math.round(p.y);
      // a small rotated ink diamond
      ctx.beginPath();
      ctx.moveTo(x + c, y + s2);
      ctx.lineTo(x - s2, y + c);
      ctx.lineTo(x - c, y - s2);
      ctx.lineTo(x + s2, y - c);
      ctx.closePath(); ctx.fill();
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
  window.__halftoneDraw = () => drawBg(1 / 30);

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
