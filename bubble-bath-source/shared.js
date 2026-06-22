/* ============================================================
   BUBBLE BATH — shared engine ("Soap & Shimmer")
   fit() scaling, an optional handle, the no-numbers loading TUBE +
   status flip, and a single <canvas class="bg"> field of rising
   IRIDESCENT BUBBLES (translucent circles w/ a soap-film rainbow rim +
   a white specular highlight dot; slow rise + gentle wobble + the
   occasional pop) plus tiny sparkle/twinkle accents. Delta-clamped
   30fps rAF in normal use; render mode (?render=1) freezes entrances
   and exposes deterministic __renderPlay()/__renderAdvance() so the
   headless pipeline captures webm without virtual time. Seeded RNG so
   render mode is reproducible (NO Math.random in the frame fn). Every
   optional subsystem is null-guarded. Theme-agnostic plumbing only;
   the LOOK lives in shared.css.
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
    if (iw < 10 || ih < 10) return;               // never write --scale:0
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

  /* ---- loading TUBE = hidden timer (no numbers) + status flip ---- */
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
     CANVAS FIELD: rising iridescent soap bubbles + sparkle twinkles.
     Deterministic seeded RNG (mulberry32) so render mode reproduces.
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let bubbles = [], sparkles = [];

  // tiny seeded PRNG — no Math.random in the frame fn
  let _s = 0xB0BB1E >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  // soap-film rim hues (iridescent) sampled per bubble
  const RIMS = [
    "rgba(255,183,213,A)",   // bubblegum pink
    "rgba(160,231,229,A)",   // mint aqua
    "rgba(255,244,194,A)",   // soft lemon
    "rgba(108,122,224,A)",   // periwinkle
    "rgba(189,235,251,A)",   // pale aqua
  ];

  function makeBubble(startBelow) {
    const r = R(14, 78);
    return {
      x: R(0, W),
      y: startBelow ? R(H + 20, H + 360) : R(-40, H + 40),
      r,
      vy: -(R(10, 34) + r * 0.18) / 60,        // bigger -> faster rise
      ph: R(0, 6.283), ps: R(0.5, 1.4),         // wobble phase / speed
      sway: R(8, 30),                            // horizontal wobble amplitude
      x0: 0,
      hue: (srnd() * RIMS.length) | 0,
      a: R(0.30, 0.62),                          // body alpha
      pop: 0,                                     // 0 = whole; >0 = popping
      life: R(0, 1),
    };
  }

  function buildField() {
    _s = 0xB0BB1E >>> 0;                          // reset seed -> identical field
    bubbles = []; sparkles = [];
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    const NB = num("bubbles", 30);
    bubbles = Array.from({ length: NB }, () => {
      const b = makeBubble(false);
      b.x0 = b.x;
      return b;
    });

    const NS = num("sparkles", 34);
    sparkles = Array.from({ length: NS }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.5, 1.6),
      ph: R(0, 6.283), tw: R(0.6, 1.7), a: R(0.25, 0.85),
      drift: R(-4, 4) / 60,
    }));
  }
  buildField();

  function drawBubble(b) {
    const x = Math.round(b.x), y = Math.round(b.y), r = b.r;
    // translucent body — soft aqua/white fill
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${(b.a * 0.55).toFixed(3)})`);
    g.addColorStop(0.55, `rgba(217,244,255,${(b.a * 0.30).toFixed(3)})`);
    g.addColorStop(1, `rgba(160,231,229,${(b.a * 0.10).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();

    // soap-film rainbow rim (two arcs of different iridescent hues)
    const rimA = (0.55 * b.a).toFixed(3);
    ctx.lineWidth = Math.max(1.4, r * 0.06);
    ctx.strokeStyle = RIMS[b.hue].replace("A", rimA);
    ctx.beginPath(); ctx.arc(x, y, r - ctx.lineWidth * 0.5, 0.4, 3.6); ctx.stroke();
    ctx.strokeStyle = RIMS[(b.hue + 2) % RIMS.length].replace("A", rimA);
    ctx.beginPath(); ctx.arc(x, y, r - ctx.lineWidth * 0.5, 3.4, 6.2, false); ctx.stroke();

    // crisp outer ring
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `rgba(255,255,255,${(b.a * 0.5).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke();

    // white specular highlight dot (upper-left)
    const hx = Math.round(x - r * 0.36), hy = Math.round(y - r * 0.4);
    const hr = Math.max(2, r * 0.18);
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    hg.addColorStop(0, `rgba(255,255,255,${Math.min(0.95, b.a + 0.35).toFixed(3)})`);
    hg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 6.2832); ctx.fill();
  }

  function drawPop(b) {
    // a quick burst ring of tiny dots as the bubble pops
    const x = Math.round(b.x), y = Math.round(b.y);
    const prog = b.pop;                            // 0..1
    const rr = b.r * (1 + prog * 1.1);
    const a = (1 - prog) * b.a * 0.9;
    ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.2832); ctx.stroke();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 6.2832 + b.ph;
      const dx = Math.round(x + Math.cos(ang) * rr);
      const dy = Math.round(y + Math.sin(ang) * rr);
      ctx.fillStyle = RIMS[(b.hue + i) % RIMS.length].replace("A", (a).toFixed(3));
      ctx.beginPath(); ctx.arc(dx, dy, Math.max(1.5, b.r * 0.08 * (1 - prog)), 0, 6.2832); ctx.fill();
    }
  }

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // rising iridescent bubbles
    for (const b of bubbles) {
      if (b.pop > 0) {
        b.pop += dt * 3.0;                         // pop animation speed
        b.ph += dt * 2;
        if (b.pop >= 1) {                          // respawn from below
          Object.assign(b, makeBubble(true));
          b.x0 = b.x;
        } else {
          drawPop(b);
        }
        continue;
      }
      b.y += b.vy * dt * 60;
      b.ph += b.ps * dt;
      b.x = b.x0 + Math.sin(b.ph) * b.sway;
      // chance to pop near the top of the bath (deterministic-ish via phase)
      if (b.y < H * 0.22 && srnd() < 0.012 * dt * 60) { b.pop = 0.001; continue; }
      if (b.y < -b.r - 30) { Object.assign(b, makeBubble(true)); b.x0 = b.x; continue; }
      drawBubble(b);
    }

    // tiny sparkle / twinkle accents
    for (const s of sparkles) {
      s.ph += 0.05 * dt * 60;
      s.x += s.drift * dt * 60;
      if (s.x < -6) s.x = W + 6; if (s.x > W + 6) s.x = -6;
      const tw = 0.45 + Math.sin(s.ph * s.tw) * 0.55;
      const a = s.a * tw;
      if (a <= 0.04) continue;
      const x = Math.round(s.x), y = Math.round(s.y);
      const len = Math.max(2, s.z * 4);
      ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.lineWidth = Math.max(1, s.z);
      ctx.beginPath();
      ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
      ctx.moveTo(x, y - len); ctx.lineTo(x, y + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }

  /* ---- timeline driver ---- */
  function tick(seconds) { setBar(seconds / barSeconds); }

  /* ---- render mode: deterministic frame stepping (1 frame = 1/30s) ---- */
  let rf = 0;
  window.__renderPlay = function () { rf = 0; buildField(); drawBg(0); tick(0); };
  window.__renderAdvance = function () {
    const t = rf / 30;                              // seconds elapsed
    drawBg(1 / 30);
    tick(t);
    rf++;
    return rf * (1000 / 30);
  };
  // rAF-independent verification hook (EXACT name)
  window.__bubbleDraw = () => drawBg(1 / 30);

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
