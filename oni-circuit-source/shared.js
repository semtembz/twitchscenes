/* ============================================================
   ONI CIRCUIT — shared engine ("Cyber-Samurai Hannya")
   fit() scaling, the animated canvas field (a large angular HANNYA /
   ONI MASK glowing oni-RED with neon-TEAL edge light + a crawling
   cyber CIRCUIT etching across its planes; a diagonal NEON BLADE
   slash with a sharp travelling glint; drifting red + teal embers),
   the no-numbers blade-edge loading bar, and the status flip. Render
   mode (?render=1) freezes entrances and exposes deterministic
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

  /* ---- blade-edge loading bar = hidden timer (no numbers) + status flip ---- */
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
     CANVAS FIELD — drawn deterministically (seeded RNG, no
     Math.random in the frame fn). Composition (all in the margins,
     clear of the centered title/bar/slots):
       - a large HANNYA / ONI MASK to the right of center, oni-red
         glow + teal edge light + a crawling circuit etching;
       - a diagonal NEON BLADE slash behind it w/ a travelling glint;
       - drifting red + teal embers rising through the void.
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080, life = 0;
  let embers = [], circuit = [];

  // tiny seeded PRNG (mulberry32) — deterministic field every build
  let _s = 0x4f4e >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  // mask anchor — pushed RIGHT + slightly down so the center column stays clear
  let MX = 1372, MY = 556, MS = 1;

  function buildField() {
    _s = 0x4f4e >>> 0;                 // reset seed -> identical field
    embers = []; circuit = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;
    MX = W * 0.775; MY = H * 0.5; MS = Math.min(W / 1920, H / 1080);

    // drifting embers (red + teal sparks rising)
    const NE = num("embers", 70);
    embers = Array.from({ length: NE }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.7),
      vy: R(-10, -3) / 60, sway: R(0.3, 1.3),
      ph: R(0, 6.283), tw: R(0.5, 1.5), a: R(0.25, 0.85),
      teal: srnd() < 0.42,
    }));

    // crawling circuit traces etched across the mask region (right side)
    const NC = num("traces", 16);
    circuit = Array.from({ length: NC }, () => {
      const pts = [];
      let px = MX + R(-260, 260) * MS, py = MY + R(-300, 300) * MS;
      const segs = 3 + ((srnd() * 4) | 0);
      pts.push([px, py]);
      for (let i = 0; i < segs; i++) {
        if (srnd() < 0.5) px += R(-150, 150) * MS; else py += R(-150, 150) * MS;
        pts.push([px, py]);
      }
      return { pts, teal: srnd() < 0.5, sp: R(0.4, 1.1), off: R(0, 1) };
    });
  }
  buildField();

  /* ---- ONI MASK path: angular hannya — horns, fierce brow, fanged grin.
     Drawn in a local coordinate space (~ -240..240 x, -300..300 y) then
     translated/scaled to the anchor. Returns nothing; strokes/fills inline. */
  function maskPath(p) {
    // p: object to receive subpaths via ctx calls already translated/scaled
    // outer face (angular jaw + cheeks)
    ctx.beginPath();
    ctx.moveTo(0, -150);            // brow center
    ctx.lineTo(150, -120);          // right brow ridge
    ctx.lineTo(196, -40);           // right cheek
    ctx.lineTo(150, 120);           // right jaw
    ctx.lineTo(64, 232);            // chin right
    ctx.lineTo(0, 256);             // chin point
    ctx.lineTo(-64, 232);
    ctx.lineTo(-150, 120);
    ctx.lineTo(-196, -40);
    ctx.lineTo(-150, -120);
    ctx.closePath();
  }
  function browPath(side) {            // fierce angled brow (side = 1 right / -1 left)
    ctx.beginPath();
    ctx.moveTo(side * 30, -120);
    ctx.lineTo(side * 150, -96);
    ctx.lineTo(side * 138, -52);
    ctx.lineTo(side * 44, -78);
    ctx.closePath();
  }
  function eyePath(side) {             // narrow menacing eye slit
    ctx.beginPath();
    ctx.moveTo(side * 46, -56);
    ctx.lineTo(side * 128, -40);
    ctx.lineTo(side * 110, -8);
    ctx.lineTo(side * 50, -24);
    ctx.closePath();
  }
  function grinPath() {                // fanged grin
    ctx.beginPath();
    ctx.moveTo(-118, 70);
    ctx.lineTo(118, 70);
    ctx.lineTo(86, 120);
    ctx.lineTo(48, 96);                // upper fang notch
    ctx.lineTo(20, 132);
    ctx.lineTo(-20, 132);
    ctx.lineTo(-48, 96);
    ctx.lineTo(-86, 120);
    ctx.closePath();
  }
  function hornPath(side) {            // sweeping horn rising from the brow
    ctx.beginPath();
    ctx.moveTo(side * 96, -132);
    ctx.lineTo(side * 150, -250);
    ctx.lineTo(side * 196, -316);
    ctx.lineTo(side * 168, -244);
    ctx.lineTo(side * 132, -150);
    ctx.closePath();
  }

  function drawMask(intensity) {
    if (!ctx) return;
    ctx.save();
    ctx.translate(Math.round(MX), Math.round(MY));
    ctx.scale(MS, MS);
    // slow menacing breathe
    const br = 1 + Math.sin(life * 0.5) * 0.012;
    ctx.scale(br, br);

    const pulse = 0.78 + Math.sin(life * 1.1) * 0.22; // glow pulse

    // ---- face fill: deep oni-red core, soft ----
    const fg = ctx.createRadialGradient(0, -10, 20, 0, -10, 300);
    fg.addColorStop(0, "rgba(255,45,75," + (0.16 * intensity).toFixed(3) + ")");
    fg.addColorStop(0.6, "rgba(255,45,75," + (0.07 * intensity).toFixed(3) + ")");
    fg.addColorStop(1, "rgba(255,45,75,0)");
    maskPath();
    ctx.fillStyle = fg; ctx.fill();

    // ---- horns ----
    for (const s of [1, -1]) {
      hornPath(s);
      ctx.fillStyle = "rgba(255,45,75," + (0.12 * intensity).toFixed(3) + ")";
      ctx.fill();
      ctx.lineWidth = 2.4; ctx.lineJoin = "miter";
      ctx.strokeStyle = "rgba(255,45,75," + (0.55 * intensity * pulse).toFixed(3) + ")";
      ctx.shadowColor = "#FF2D4B"; ctx.shadowBlur = 22 * intensity;
      ctx.stroke();
    }

    // ---- face outline: oni-red stroke w/ teal edge light ----
    maskPath();
    ctx.lineWidth = 3; ctx.lineJoin = "miter";
    ctx.strokeStyle = "rgba(255,45,75," + (0.7 * intensity * pulse).toFixed(3) + ")";
    ctx.shadowColor = "#FF2D4B"; ctx.shadowBlur = 26 * intensity;
    ctx.stroke();
    // teal rim light, offset slightly up-left
    ctx.save();
    ctx.translate(-3, -3);
    maskPath();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(22,240,200," + (0.5 * intensity).toFixed(3) + ")";
    ctx.shadowColor = "#16F0C8"; ctx.shadowBlur = 16 * intensity;
    ctx.stroke();
    ctx.restore();

    // ---- brows (angry) ----
    for (const s of [1, -1]) {
      browPath(s);
      ctx.fillStyle = "rgba(255,45,75," + (0.5 * intensity * pulse).toFixed(3) + ")";
      ctx.shadowColor = "#FF2D4B"; ctx.shadowBlur = 18 * intensity;
      ctx.fill();
    }

    // ---- eyes: teal glowing slits ----
    for (const s of [1, -1]) {
      eyePath(s);
      const eg = ctx.createLinearGradient(0, -56, 0, -8);
      eg.addColorStop(0, "rgba(22,240,200," + (0.95 * intensity * pulse).toFixed(3) + ")");
      eg.addColorStop(1, "rgba(22,240,200," + (0.4 * intensity).toFixed(3) + ")");
      ctx.fillStyle = eg;
      ctx.shadowColor = "#16F0C8"; ctx.shadowBlur = 24 * intensity * pulse;
      ctx.fill();
    }

    // ---- fanged grin: teal outline, dark interior ----
    grinPath();
    ctx.fillStyle = "rgba(5,8,12," + (0.55 * intensity).toFixed(3) + ")";
    ctx.shadowBlur = 0; ctx.fill();
    grinPath();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "rgba(22,240,200," + (0.6 * intensity * pulse).toFixed(3) + ")";
    ctx.shadowColor = "#16F0C8"; ctx.shadowBlur = 14 * intensity;
    ctx.stroke();

    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // crawling circuit etching across the mask region
  function drawCircuit() {
    if (!ctx) return;
    ctx.save();
    ctx.lineWidth = 1.4; ctx.lineJoin = "miter"; ctx.lineCap = "round";
    for (const c of circuit) {
      const col = c.teal ? "22,240,200" : "255,45,75";
      ctx.beginPath();
      ctx.moveTo(Math.round(c.pts[0][0]), Math.round(c.pts[0][1]));
      for (let i = 1; i < c.pts.length; i++) ctx.lineTo(Math.round(c.pts[i][0]), Math.round(c.pts[i][1]));
      ctx.strokeStyle = "rgba(" + col + ",0.14)";
      ctx.shadowBlur = 0; ctx.stroke();
      // a bright data pulse crawling along the trace
      const segCount = c.pts.length - 1;
      if (segCount < 1) continue;
      const t = ((life * c.sp + c.off) % 1) * segCount;
      const si = Math.min(segCount - 1, t | 0);
      const f = t - si;
      const a = c.pts[si], b = c.pts[si + 1];
      const gx = a[0] + (b[0] - a[0]) * f, gy = a[1] + (b[1] - a[1]) * f;
      ctx.beginPath();
      ctx.arc(Math.round(gx), Math.round(gy), 2.4, 0, 6.2832);
      ctx.fillStyle = "rgba(" + col + ",0.95)";
      ctx.shadowColor = c.teal ? "#16F0C8" : "#FF2D4B"; ctx.shadowBlur = 12;
      ctx.fill();
      // node at the trace origin
      ctx.beginPath();
      ctx.arc(Math.round(c.pts[0][0]), Math.round(c.pts[0][1]), 2, 0, 6.2832);
      ctx.fillStyle = "rgba(" + col + ",0.4)"; ctx.shadowBlur = 0; ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // diagonal neon BLADE slash crossing the void behind the mask, w/ a
  // sharp glint travelling along its length (kept to the margins).
  function drawBlade() {
    if (!ctx) return;
    // blade line from lower-left toward upper-right, well off the center column
    const x1 = W * 0.02, y1 = H * 0.94, x2 = W * 0.98, y2 = H * 0.10;
    ctx.save();
    // soft teal body
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, "rgba(22,240,200,0)");
    grad.addColorStop(0.5, "rgba(22,240,200,0.16)");
    grad.addColorStop(1, "rgba(255,45,75,0.05)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#16F0C8"; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

    // travelling glint: a bright short segment sweeping x1->x2 every ~4.5s
    const t = (life % 4.5) / 4.5;
    const gx = x1 + (x2 - x1) * t, gy = y1 + (y2 - y1) * t;
    const ux = (x2 - x1), uy = (y2 - y1);
    const ul = Math.hypot(ux, uy) || 1;
    const dx = ux / ul, dy = uy / ul;
    const half = 64;
    ctx.strokeStyle = "rgba(232,238,245,0.95)";
    ctx.lineWidth = 3.4; ctx.lineCap = "round";
    ctx.shadowColor = "#E8EEF5"; ctx.shadowBlur = 26;
    ctx.beginPath();
    ctx.moveTo(gx - dx * half, gy - dy * half);
    ctx.lineTo(gx + dx * half, gy + dy * half);
    ctx.stroke();
    // glint core dot
    ctx.beginPath();
    ctx.arc(Math.round(gx), Math.round(gy), 3, 0, 6.2832);
    ctx.fillStyle = "#fff"; ctx.shadowBlur = 30; ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function drawEmbers(dt) {
    if (!ctx) return;
    for (const e of embers) {
      e.y += e.vy * dt * 60;
      e.ph += 0.04 * dt * 60;
      e.x += Math.sin(e.ph) * e.sway * 0.6;
      if (e.y < -12) { e.y = H + 12; e.x = ((srnd() * W) | 0); }
      const tw = 0.5 + Math.sin(e.ph * e.tw) * 0.5;
      ctx.globalAlpha = e.a * tw;
      const col = e.teal ? "#16F0C8" : "#FF2D4B";
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 7 * e.z;
      const sz = Math.max(1, Math.round(e.z * 1.8));
      ctx.fillRect(Math.round(e.x), Math.round(e.y), sz, sz);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    life += dt;
    drawBlade();                 // slash behind the mask
    drawMask(1);                 // the oni mask
    drawCircuit();               // circuit etching crawling across it
    drawEmbers(dt);              // rising sparks on top
  }

  /* ---- timeline driver ---- */
  function tick(seconds) { setBar(seconds / barSeconds); }

  /* ---- render mode: deterministic frame stepping (1 frame = 1/30s) ---- */
  let rf = 0;
  window.__renderPlay = function () { rf = 0; buildField(); drawBg(0); tick(0); };
  window.__renderAdvance = function () {
    const t = rf / 30;           // seconds elapsed
    drawBg(1 / 30);
    tick(t);
    rf++;
    return rf * (1000 / 30);
  };
  // rAF-independent verification hook (EXACT name)
  window.__oniDraw = () => drawBg(1 / 30);

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
