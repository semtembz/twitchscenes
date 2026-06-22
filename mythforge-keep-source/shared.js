/* ============================================================
   MYTHFORGE KEEP — shared engine ("Tavern Quest-Board")
   fit() scaling, a canvas field of drifting EMBERS / ASH motes
   rising on warm candle-air (warm glowing sparks + cooler grey
   ash, with occasional soft heat-haze blooms), the forged-iron
   loading bar (no numbers) + status flip. Render mode (?render=1)
   freezes entrances and exposes deterministic
   __renderPlay()/__renderAdvance() so the headless pipeline
   captures webm without virtual time. Runs only what a scene includes.
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
    if (iw < 10 || ih < 10) return;
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- optional handle ---- */
  const handle = params.get("handle"), handleEl = $id("handle");
  if (handle && handleEl) handleEl.textContent = handle;

  /* ---- forged-iron loading bar (no numbers) + status flip ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = Math.max(0, Math.min(1, p));
    if (fill) fill.style.width = "calc(" + (p * 100).toFixed(2) + "% - 4px)";
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
    }
  }

  /* ---- canvas: drifting EMBERS / ASH rising on warm candle-air ---- */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080, embers = [], haze = [];
  if (cv) {
    ctx = cv.getContext("2d");
    W = cv.width || 1920; H = cv.height || 1080;
    const R = (a, b) => a + Math.random() * (b - a);
    // warm heat-haze blooms low on the field (candle pools)
    const HAZE = ["#C9962F", "#7A1F1F", "#8A6320"];
    haze = Array.from({ length: num("haze", 7) }, () => ({
      x: R(0, W), y: R(H * 0.45, H), r: R(180, 380), c: HAZE[(Math.random() * HAZE.length) | 0],
      a: R(0.04, 0.10), vx: R(-3, 3) / 60, vy: R(-3, -1) / 60, ph: R(0, 6.28), ps: R(0.4, 1.0),
    }));
    // rising embers + ash motes
    const mk = (initial) => {
      const ash = Math.random() < 0.34;             // ~1/3 are cool grey ash
      return {
        x: R(0, W), y: initial ? R(0, H) : R(H, H + 80),
        z: R(0.5, 1.8),                              // depth -> size + speed
        vy: -R(10, 30) / 60,                         // rise
        sway: R(0.4, 1.6), ph: R(0, 6.28), drift: R(-0.25, 0.25),
        a: R(0.3, 0.95), ash,
        // warm ember hue jitter (orange-gold) vs grey ash
        col: ash ? "200,196,188" : (Math.random() < 0.5 ? "240,206,122" : "201,120,47"),
        tws: R(0.06, 0.16),                          // twinkle speed
      };
    };
    embers = Array.from({ length: num("embers", 90) }, () => mk(true));
    window.__mkMk = mk; // internal recycler ref
  }
  function drawBg(dt) {
    if (!ctx) return;
    const f = dt * 60; // normalize to 60fps-equivalent steps
    ctx.clearRect(0, 0, W, H);

    // warm heat-haze blooms (low candle pools)
    for (const b of haze) {
      b.x += b.vx * f; b.y += b.vy * f; b.ph += 0.01 * b.ps * f;
      if (b.x < -400) b.x = W + 400; if (b.x > W + 400) b.x = -400;
      if (b.y < -200) b.y = H + 200;
      const rr = b.r * (1 + Math.sin(b.ph) * 0.1);
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
      g.addColorStop(0, b.c); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = b.a; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(Math.round(b.x), Math.round(b.y), rr, 0, 6.2832); ctx.fill();
    }

    // rising embers + ash
    const mk = window.__mkMk;
    for (const p of embers) {
      p.y += p.vy * p.z * f;
      p.ph += p.tws * f;
      p.x += (Math.sin(p.ph) * p.sway + p.drift) * f;
      if (p.y < -20 || p.x < -40 || p.x > W + 40) { if (mk) Object.assign(p, mk(false)); }
      const tw = p.ash ? (0.5 + Math.sin(p.ph * 0.8) * 0.25)
                       : (0.45 + Math.sin(p.ph * 1.9) * 0.55);
      const s = Math.max(1, Math.round(p.z * (p.ash ? 1.6 : 2.0)));
      ctx.globalAlpha = Math.max(0, p.a * tw);
      ctx.fillStyle = "rgb(" + p.col + ")";
      if (p.ash) { ctx.shadowBlur = 0; }
      else { ctx.shadowColor = "rgb(" + p.col + ")"; ctx.shadowBlur = 9 * p.z; }
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  /* ---- timeline driver ---- */
  function tick(seconds) { setBar(seconds / barSeconds); }

  // render mode: deterministic frame stepping (1 frame = 1/30s)
  let rf = 0;
  window.__renderPlay = function () { rf = 0; tick(0); };
  window.__renderAdvance = function () {
    const t = rf / 30;            // seconds
    drawBg(1 / 30);
    tick(t);
    rf++;
    return rf * (1000 / 30);
  };
  // rAF-independent verification hook (EXACT name)
  window.__mythDraw = function () { drawBg(1 / 30); };

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
