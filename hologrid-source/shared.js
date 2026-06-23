/* ============================================================
   HOLOGRID — shared engine ("Holographic Projection Deck")
   fit() scaling, ?handle, the no-numbers SEGMENTED HOLO CHARGE METER
   + status flip, and ONE <canvas class="bg"> that paints the whole
   bespoke scene: a perspective HOLO GRID FLOOR receding to a horizon,
   holographic SCAN BEAMS rising off a base plate, concentric sweeping
   RADAR RING GAUGES, and a slowly-rotating 3D WIREFRAME GLOBE
   (lat/long points projected 3D->2D) with subtle cyan/violet/mint
   chromatic fringing. Delta-clamped 30fps rAF for live; render mode
   (?render=1) freezes entrances + exposes deterministic
   __renderPlay()/__renderAdvance() so the headless pipeline captures
   webm without virtual time. Every optional subsystem is null-guarded.
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

  /* ---- segmented holo charge meter = hidden timer (no numbers) + status flip ---- */
  const fill = $id("fill"), head = $id("head");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
    if (head) head.style.left = (p * 100).toFixed(2) + "%";
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
      const st = $id("status");
      if (st && st.dataset.done) st.textContent = st.dataset.done;
    }
  }

  /* ============================================================
     CANVAS SCENE: holographic projection deck.
     Deterministic seeded RNG so render mode is reproducible.
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let globe = [], beams = [], motes = [], life = 0;
  // projection anchor: the holo deck centre (slightly below middle)
  let CX = 960, CY = 624, GLOBE_R = 300;

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0x4A17 >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  function buildField() {
    _s = 0x4A17 >>> 0;                 // reset seed -> identical scene every build
    globe = []; beams = []; motes = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;
    /* globe sits lower + a touch smaller so its bright equator band projects
       BELOW the centered headline (clear zone for the title + bar) */
    CX = W * 0.5; CY = H * 0.70; GLOBE_R = Math.min(W, H) * 0.265;

    // GLOBE: lat/long lattice of 3D unit-sphere points (projected each frame)
    const LAT = 9, LON = 18;
    for (let i = 1; i < LAT; i++) {            // skip exact poles to avoid clutter
      const phi = (Math.PI * i) / LAT - Math.PI / 2;  // -pi/2..pi/2
      const cphi = Math.cos(phi), sphi = Math.sin(phi);
      for (let j = 0; j < LON; j++) {
        const lam = (2 * Math.PI * j) / LON;
        globe.push({
          x: cphi * Math.cos(lam), y: sphi, z: cphi * Math.sin(lam),
          lat: i, lon: j,
        });
      }
    }

    // SCAN BEAMS rising off the base plate (vertical holo light columns)
    const NB = num("beams", 7);
    beams = Array.from({ length: NB }, () => ({
      ang: R(0, Math.PI * 2),            // azimuth around the base ring
      rad: R(0.35, 1.05),                // distance from centre (in globe radii)
      h: R(0.7, 1.5),                    // height in globe radii
      ph: R(0, 6.283),                   // pulse phase
      sp: R(0.5, 1.3),                   // pulse speed
      tint: srnd(),                      // 0..1 -> cyan/violet/mint pick
    }));

    // floating data MOTES drifting up through the projection
    const NM = num("motes", 70);
    motes = Array.from({ length: NM }, () => ({
      x: R(0, W), y: R(0, H), z: R(0.4, 1.6),
      vy: R(-9, -3) / 60, sway: R(0.3, 1.1),
      ph: R(0, 6.283), a: R(0.2, 0.7), tint: srnd(),
    }));
  }
  buildField();

  function tintOf(t) {
    return t < 0.45 ? "#36C2FF" : t < 0.8 ? "#5BFFD0" : "#B66BFF";
  }

  /* ---- perspective HOLO GRID FLOOR receding toward a horizon ---- */
  function drawFloor(t) {
    const horizon = CY + GLOBE_R * 0.18;     // floor sits just under the globe
    const vpY = horizon;                      // vanishing reference
    ctx.lineWidth = 1;
    // receding horizontal rings (rows) — slow scroll for motion
    const scroll = (t * 0.10) % 1;
    ctx.strokeStyle = "rgba(54,194,255,0.16)";
    for (let i = 0; i < 16; i++) {
      const f = (i + scroll) / 16;            // 0..1 toward viewer
      const yy = vpY + f * f * (H - vpY) * 1.15;
      if (yy > H + 4) continue;
      const a = 0.05 + f * 0.18;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(yy));
      ctx.lineTo(W, Math.round(yy));
      ctx.stroke();
    }
    // converging vertical lines fanning to the vanishing point
    ctx.strokeStyle = "rgba(91,255,208,0.12)";
    for (let i = -10; i <= 10; i++) {
      const spread = i / 10;
      const bx = CX + spread * W * 0.85;       // bottom (near) x
      const tx = CX + spread * W * 0.10;       // top (far) x toward VP
      ctx.globalAlpha = 0.10 + (1 - Math.abs(spread)) * 0.10;
      ctx.beginPath();
      ctx.moveTo(Math.round(tx), Math.round(vpY));
      ctx.lineTo(Math.round(bx), H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---- base plate disc the holograms project from ---- */
  function drawBasePlate() {
    const by = CY + GLOBE_R * 0.96;
    const rx = GLOBE_R * 1.25, ry = GLOBE_R * 0.30;
    const g = ctx.createRadialGradient(CX, by, 0, CX, by, rx);
    g.addColorStop(0, "rgba(54,194,255,0.20)");
    g.addColorStop(0.6, "rgba(27,43,107,0.10)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.translate(CX, by); ctx.scale(1, ry / rx);
    ctx.globalAlpha = 1; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(91,255,208,0.45)";
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(0, 0, GLOBE_R * 0.92, 0, 6.2832); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ---- vertical SCAN BEAMS rising off the base plate ---- */
  function drawBeams(t) {
    const by = CY + GLOBE_R * 0.96, ry = 0.30;
    for (const b of beams) {
      const pulse = 0.45 + 0.55 * Math.abs(Math.sin(t * b.sp + b.ph));
      const bx = CX + Math.cos(b.ang) * b.rad * GLOBE_R;
      const baseY = by + Math.sin(b.ang) * b.rad * GLOBE_R * ry;
      const topY = baseY - b.h * GLOBE_R * pulse;
      const col = tintOf(b.tint);
      const g = ctx.createLinearGradient(0, baseY, 0, topY);
      g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.22 * pulse;
      ctx.strokeStyle = g; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.round(bx), Math.round(baseY));
      ctx.lineTo(Math.round(bx), Math.round(topY));
      ctx.stroke();
      // little climbing spark on the beam
      const sp = (t * 0.4 + b.ph) % 1;
      ctx.globalAlpha = 0.8 * pulse;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(bx) - 1, Math.round(baseY + (topY - baseY) * sp) - 1, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  /* ---- concentric RADAR RING GAUGES with sweeping arcs ---- */
  function drawRings(t) {
    const rings = [
      { r: 1.30, seg: 0.0, sp: 0.18, col: "#36C2FF", a: 0.28, dir: 1 },
      { r: 1.55, seg: 0.0, sp: -0.12, col: "#B66BFF", a: 0.22, dir: -1 },
      { r: 1.05, seg: 0.0, sp: 0.30, col: "#5BFFD0", a: 0.30, dir: 1 },
    ];
    const ry = 0.42;     // elliptical squash (deck perspective)
    ctx.save();
    ctx.translate(CX, CY); ctx.scale(1, ry);
    for (const rg of rings) {
      const RR = rg.r * GLOBE_R;
      // faint full ring
      ctx.globalAlpha = rg.a * 0.4;
      ctx.strokeStyle = rg.col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, RR, 0, 6.2832); ctx.stroke();
      // tick marks around the ring
      ctx.globalAlpha = rg.a * 0.6;
      for (let k = 0; k < 48; k++) {
        const a0 = (k / 48) * 6.2832;
        const big = k % 6 === 0;
        const r0 = RR - (big ? 12 : 6), r1 = RR + (big ? 4 : 2);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
        ctx.lineTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
        ctx.stroke();
      }
      // bright sweeping arc segment
      const start = (t * rg.sp) % 6.2832;
      ctx.globalAlpha = rg.a;
      ctx.lineWidth = 3;
      const grad = ctx.createLinearGradient(-RR, 0, RR, 0);
      grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, rg.col);
      ctx.strokeStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, RR, start, start + 1.1, false); ctx.stroke();
      // leading dot on the sweep
      ctx.globalAlpha = rg.a * 1.6;
      ctx.fillStyle = rg.col;
      const ex = Math.cos(start + 1.1) * RR, ey = Math.sin(start + 1.1) * RR;
      ctx.beginPath(); ctx.arc(ex, ey, 3, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ---- the rotating 3D WIREFRAME GLOBE (project points 3D->2D) ---- */
  function drawGlobe(t) {
    const yaw = t * 0.32;                 // slow continuous spin
    const tilt = 0.42;                    // fixed viewing tilt
    const cy = Math.cos(tilt), sy = Math.sin(tilt);
    const cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
    const fringe = 2.0;                   // chromatic split in px

    // project a unit-sphere point -> screen {sx, sy, depth(-1..1)}
    function proj(p) {
      // yaw about Y
      let x = p.x * cyaw + p.z * syaw;
      let z = -p.x * syaw + p.z * cyaw;
      let y = p.y;
      // tilt about X
      const y2 = y * cy - z * sy;
      const z2 = y * sy + z * cy;
      return { sx: CX + x * GLOBE_R, sy: CY + y2 * GLOBE_R, d: z2 };
    }

    // build projected lookup
    const LON = 18;
    const pts = globe.map(proj);

    // longitude meridians + latitude rings as connected segments
    ctx.lineWidth = 1.4;
    for (let i = 0; i < globe.length; i++) {
      const g0 = globe[i], a = pts[i];
      // connect to next point in same latitude ring (wraps)
      const sameLatNext = i - (g0.lon) + ((g0.lon + 1) % LON);
      const b = pts[sameLatNext];
      // connect downward to same longitude next latitude
      const downIdx = i + LON;
      const depth = (a.d + 1) / 2;                 // 0 back .. 1 front
      const alpha = 0.10 + depth * 0.55;
      // draw latitude segment
      if (b) {
        drawHoloSeg(a, b, alpha, fringe, depth);
      }
      if (downIdx < globe.length) {
        drawHoloSeg(a, pts[downIdx], alpha, fringe, depth);
      }
    }

    // glowing vertices (brighter on the near face)
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const depth = (a.d + 1) / 2;
      if (depth < 0.35) continue;
      ctx.globalAlpha = (depth - 0.3) * 0.9;
      ctx.fillStyle = i % 7 === 0 ? "#B66BFF" : "#5BFFD0";
      const r = depth * 2.2;
      ctx.beginPath(); ctx.arc(Math.round(a.sx), Math.round(a.sy), r, 0, 6.2832); ctx.fill();
    }

    // a bright equatorial halo ring around the globe silhouette
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "rgba(54,194,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(CX, CY, GLOBE_R * 1.001, 0, 6.2832); ctx.stroke();

    // soft core glow
    const cg = ctx.createRadialGradient(CX, CY, 0, CX, CY, GLOBE_R);
    cg.addColorStop(0, "rgba(54,194,255,0.10)");
    cg.addColorStop(0.7, "rgba(27,43,107,0.05)");
    cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 1; ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(CX, CY, GLOBE_R, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // a single holo wireframe segment with subtle cyan/violet chromatic split
  function drawHoloSeg(a, b, alpha, fringe, depth) {
    // violet ghost (offset left)
    ctx.globalAlpha = alpha * 0.45;
    ctx.strokeStyle = "#B66BFF";
    ctx.beginPath();
    ctx.moveTo(Math.round(a.sx - fringe), Math.round(a.sy));
    ctx.lineTo(Math.round(b.sx - fringe), Math.round(b.sy));
    ctx.stroke();
    // cyan ghost (offset right)
    ctx.globalAlpha = alpha * 0.45;
    ctx.strokeStyle = "#36C2FF";
    ctx.beginPath();
    ctx.moveTo(Math.round(a.sx + fringe), Math.round(a.sy));
    ctx.lineTo(Math.round(b.sx + fringe), Math.round(b.sy));
    ctx.stroke();
    // mint core line
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#5BFFD0";
    ctx.beginPath();
    ctx.moveTo(Math.round(a.sx), Math.round(a.sy));
    ctx.lineTo(Math.round(b.sx), Math.round(b.sy));
    ctx.stroke();
  }

  /* ---- floating data motes drifting up through the projection ---- */
  function drawMotes(dt, t) {
    for (const m of motes) {
      m.y += m.vy * dt * 60; m.ph += 0.04 * dt * 60;
      m.x += Math.sin(m.ph) * m.sway * 0.6;
      if (m.y < -10) { m.y = H + 10; }
      if (m.x < -10) m.x = W + 10; if (m.x > W + 10) m.x = -10;
      const tw = 0.55 + Math.sin(m.ph * 1.6) * 0.45;
      ctx.globalAlpha = m.a * tw;
      ctx.fillStyle = tintOf(m.tint);
      const sz = Math.max(1, Math.round(m.z * 1.5));
      ctx.fillRect(Math.round(m.x), Math.round(m.y), sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    life += dt;
    const t = life;
    // additive holo glow stacking
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    drawFloor(t);
    drawBasePlate();
    drawRings(t);
    drawBeams(t);
    drawGlobe(t);
    drawMotes(dt, t);
    ctx.restore();
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
  window.__holoDraw = () => drawBg(1 / 30);

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
