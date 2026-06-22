/* ============================================================
   NEON TOKYO — shared engine ("Midnight Akihabara")
   fit() scaling, rain + parallax skyline canvas, segmented loading
   bar, status flip. Render mode (?render=1) exposes a deterministic
   __renderAdvance() so the headless pipeline can capture webm without
   virtual time. Runs only what each scene includes.
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

  /* ---- fit the 1920x1080 stage to the window ---- */
  function fit() {
    const iw = window.innerWidth, ih = window.innerHeight;
    if (iw < 10 || ih < 10) return;
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- handle ---- */
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

  /* ---- segmented loading bar (no numbers) + status flip ---- */
  const bar = $(".bar");
  let barSegs = [], barTotal = 0, barT0 = null, barSeconds = num("seconds", 60);
  if (bar) {
    const N = num("segs", 28);
    let html = ""; for (let i = 0; i < N; i++) html += "<i></i>";
    bar.innerHTML = html;
    barSegs = [...bar.querySelectorAll("i")]; barTotal = barSegs.length;
  }
  function setBar(p) {
    const on = Math.round(p * barTotal);
    for (let i = 0; i < barTotal; i++) barSegs[i].classList.toggle("on", i < on);
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
    }
  }

  /* ---- canvas: rain streaks + parallax skyline ---- */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080, rain = [], sky = [], NEON = [];
  if (cv) {
    ctx = cv.getContext("2d");
    W = cv.width || 1920; H = cv.height || 1080;
    const R = (a, b) => a + Math.random() * (b - a);
    rain = Array.from({ length: num("rain", 150) }, () => ({
      x: R(0, W), y: R(0, H), len: R(14, 46), v: R(700, 1300) / 60, sk: R(1.5, 3.2),
    }));
    // skyline: layered building blocks (two parallax bands)
    function band(baseY, h, n, col, speed) {
      const arr = []; let x = -100;
      while (x < W + 100) { const bw = R(60, 180), bh = R(h * 0.4, h); arr.push({ x, y: baseY - bh, w: bw, h: bh, col }); x += bw + R(6, 26); }
      return { blocks: arr, speed, off: 0 };
    }
    sky = [band(H, 240, 0, "rgba(20,18,40,0.95)", 4 / 60), band(H, 360, 0, "rgba(10,8,24,0.98)", 8 / 60)];
    // a few neon windows per building (just dots)
    NEON = ["#00E0FF", "#FF2D95", "#FFD400", "#7A3CFF"];
  }
  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    // skyline (back to front)
    for (const b of sky) {
      b.off = (b.off + b.speed * dt) % 99999;
      for (const blk of b.blocks) {
        const x = blk.x - (b.off % (W + 200));
        ctx.fillStyle = blk.col;
        ctx.fillRect(Math.round(x), Math.round(blk.y), Math.ceil(blk.w), Math.ceil(blk.h + 4));
        // sparse neon windows
        for (let wy = blk.y + 10; wy < blk.y + blk.h - 6; wy += 22) {
          if ((Math.round(x + wy) % 5) !== 0) continue;
          ctx.fillStyle = NEON[(Math.round(x + wy)) % NEON.length];
          ctx.globalAlpha = 0.5; ctx.fillRect(Math.round(x + 8), Math.round(wy), 6, 6); ctx.globalAlpha = 1;
        }
      }
    }
    // rain
    ctx.strokeStyle = "rgba(120,200,255,0.30)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath();
    for (const d of rain) {
      d.y += d.v * dt; d.x += d.sk * dt * 0.4;
      if (d.y > H) { d.y = -20; d.x = Math.random() * W; }
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.sk, d.y - d.len);
    }
    ctx.stroke();
  }

  /* ---- timeline driver ---- */
  function tick(seconds) { if (barTotal) setBar(Math.min(1, seconds / barSeconds)); }

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

  if (!render) {
    if (bar) { setTimeout(() => { barT0 = performance.now(); }, 60); }
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
