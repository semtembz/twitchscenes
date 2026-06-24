/* ============================================================
   NEBULA DRIFT — shared engine ("Warp Through The Veil")
   fit() scaling, the animated canvas field (a billowing NEBULA of
   layered soft radial blooms, a dense PARALLAX STARFIELD, and
   WARP-STREAK lines — stars stretched into light-streaks radiating
   from an off-centre vanishing point as if drifting at warp), the
   no-numbers warp-trail loading bar, and the editable text slots.
   Render mode (?render=1) freezes entrances and exposes deterministic
   __renderPlay()/__renderAdvance() so the headless pipeline captures
   frames to webm without virtual time. Every optional subsystem is
   null-guarded; runs only what a scene includes.
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

  /* ---- warp-trail loading bar = hidden timer (no numbers shown) ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
  }

  /* ============================================================
     CANVAS FIELD: billowing nebula + parallax starfield + warp-streaks
     Deterministic seeded RNG so render mode is reproducible.
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  // vanishing point sits off-centre (upper-right) so the centred title isn't
  // pierced by the longest warp-streaks; streaks radiate AWAY toward the edges.
  let VPX = 1330, VPY = 392;
  let blooms = [], stars = [], streaks = [], life = 0;

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0x9E37 >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  // nebula bloom palette (kept indigo/cyan/pink, low alpha, soft)
  const NEB = [
    [108, 92, 231],   // indigo
    [0, 217, 255],    // cyan
    [255, 122, 182],  // pink
  ];

  function buildField() {
    _s = 0x9E37 >>> 0;                 // reset seed -> identical field every build
    blooms = []; stars = []; streaks = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;
    VPX = W * 0.69; VPY = H * 0.36;

    // BILLOWING NEBULA — big soft radial blooms biased to the margins/corners so
    // the centred title stays dark + legible. Each breathes + drifts very slowly.
    const NB = num("blooms", 9);
    blooms = Array.from({ length: NB }, (_, i) => {
      // bias toward the edges: push x/y away from centre
      let x = R(0, W), y = R(0, H);
      const edge = R(0.55, 1);
      x = W / 2 + (x - W / 2) * edge * 1.25;
      y = H / 2 + (y - H / 2) * edge * 1.25;
      const c = NEB[i % NEB.length];
      return {
        x, y, r: R(280, 560), c,
        a: R(0.05, 0.12), vx: R(-4, 4) / 60, vy: R(-3, 3) / 60,
        ph: R(0, 6.283), ps: R(0.25, 0.6),
      };
    });

    // dense PARALLAX STARFIELD — three depth layers (z drives size + drift speed)
    const NST = num("stars", 220);
    stars = Array.from({ length: NST }, () => {
      const z = R(0.25, 1);                     // depth: small/slow .. big/fast
      const tint = srnd();
      return {
        x: R(0, W), y: R(0, H), z,
        s: 0.5 + z * 1.8,                       // size
        tw: R(0.4, 1.8), ph: R(0, 6.283),       // twinkle
        a: R(0.35, 0.95),
        col: tint < 0.18 ? "#00D9FF" : tint < 0.34 ? "#FF7AB6" : tint < 0.52 ? "#6C5CE7" : "#EAF2FF",
      };
    });

    // WARP-STREAKS — a subset of stars stretched into light-streaks radiating
    // from the vanishing point. Each has an angle + a position along its ray that
    // scrolls outward (toward the edge), looping back near the VP — the warp drift.
    const NW = num("streaks", 70);
    streaks = Array.from({ length: NW }, () => {
      const ang = R(0, 6.283);
      const col = NEB[(srnd() * 3) | 0];
      return {
        ang,
        d: R(40, 900),                          // current distance from VP along ray
        speed: R(140, 560),                     // outward speed (px/s) -> warp feel
        len: R(40, 150),                        // streak length factor
        w: R(0.8, 2.2),                         // streak width
        a: R(0.25, 0.7),
        col,
      };
    });
  }
  buildField();

  // max ray distance (so streaks recycle once well off-screen)
  function rayMax() {
    return Math.hypot(Math.max(VPX, W - VPX), Math.max(VPY, H - VPY)) + 200;
  }

  function drawBg(dt) {
    if (!ctx) return;
    life += dt;
    // hard clear to pure space (the canvas sits over the CSS gradient base)
    ctx.clearRect(0, 0, W, H);

    // --- BILLOWING NEBULA: additive soft radial blooms ---
    ctx.globalCompositeOperation = "lighter";
    for (const b of blooms) {
      b.x += b.vx * dt * 60; b.y += b.vy * dt * 60; b.ph += 0.01 * b.ps * dt * 60;
      // wrap softly so blooms keep drifting forever
      if (b.x < -620) b.x = W + 620; if (b.x > W + 620) b.x = -620;
      if (b.y < -620) b.y = H + 620; if (b.y > H + 620) b.y = -620;
      const rr = b.r * (1 + Math.sin(b.ph) * 0.14);
      const breathe = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(b.ph * 1.3));
      const cx = Math.round(b.x), cy = Math.round(b.y);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      const [r, gr, bl] = b.c;
      g.addColorStop(0, "rgba(" + r + "," + gr + "," + bl + "," + (b.a * breathe).toFixed(3) + ")");
      g.addColorStop(0.5, "rgba(" + r + "," + gr + "," + bl + "," + (b.a * breathe * 0.4).toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + r + "," + gr + "," + bl + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 6.2832); ctx.fill();
    }

    // --- WARP-STREAKS: stars stretched into light-streaks from the VP ---
    const RM = rayMax();
    ctx.lineCap = "round";
    for (const s of streaks) {
      s.d += s.speed * dt;
      if (s.d > RM) { s.d = R(20, 70); s.ang = R(0, 6.283); }   // recycle near VP
      const ca = Math.cos(s.ang), sa = Math.sin(s.ang);
      // streak grows longer the farther (faster) it is from the VP
      const grow = s.d / RM;                          // 0..1
      const len = s.len * (0.35 + grow * 1.6);
      const x1 = VPX + ca * s.d, y1 = VPY + sa * s.d;
      const x2 = VPX + ca * (s.d - len), y2 = VPY + sa * (s.d - len);
      // fade in near the VP, fade out at the very edge
      const edgeFade = 1 - Math.max(0, (grow - 0.85) / 0.15);
      const a = s.a * Math.min(1, grow * 3.2) * Math.max(0, edgeFade);
      if (a <= 0.02) continue;
      const [r, g, bl] = s.col;
      const grad = ctx.createLinearGradient(x2, y2, x1, y1);
      grad.addColorStop(0, "rgba(" + r + "," + g + "," + bl + ",0)");
      grad.addColorStop(1, "rgba(" + r + "," + g + "," + bl + "," + a.toFixed(3) + ")");
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.w * (0.6 + grow);
      ctx.beginPath();
      ctx.moveTo(Math.round(x2), Math.round(y2));
      ctx.lineTo(Math.round(x1), Math.round(y1));
      ctx.stroke();
      // bright tip
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(234,242,255," + (a * 0.9).toFixed(3) + ")";
      ctx.fillRect(Math.round(x1) - 1, Math.round(y1) - 1, 2, 2);
      ctx.globalAlpha = 1;
    }

    // --- PARALLAX STARFIELD: twinkling points, gentle outward drift from VP ---
    ctx.globalCompositeOperation = "source-over";
    for (const st of stars) {
      // very slow parallax drift radiating from the VP (deep layers move less)
      const dx = st.x - VPX, dy = st.y - VPY;
      const dist = Math.hypot(dx, dy) || 1;
      const push = (6 + st.z * 22) * dt;             // px/s outward
      st.x += (dx / dist) * push;
      st.y += (dy / dist) * push;
      st.ph += 0.05 * dt * 60;
      // recycle stars that drift off the edges back near the VP
      if (st.x < -10 || st.x > W + 10 || st.y < -10 || st.y > H + 10) {
        const na = R(0, 6.283), nd = R(20, 120);
        st.x = VPX + Math.cos(na) * nd;
        st.y = VPY + Math.sin(na) * nd;
      }
      const tw = 0.55 + Math.sin(st.ph * st.tw) * 0.45;
      const a = st.a * tw;
      ctx.globalAlpha = a;
      ctx.fillStyle = st.col;
      if (st.z > 0.78) { ctx.shadowColor = st.col; ctx.shadowBlur = 6; }
      else { ctx.shadowBlur = 0; }
      const sz = Math.max(1, Math.round(st.s));
      ctx.fillRect(Math.round(st.x) - (sz >> 1), Math.round(st.y) - (sz >> 1), sz, sz);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
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
  window.__nebulaDraw = () => drawBg(1 / 30);

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
