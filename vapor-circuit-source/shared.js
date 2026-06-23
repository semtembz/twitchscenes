/* ============================================================
   VAPOR CIRCUIT — shared engine ("Outrun Motherboard")
   fit() scaling, the animated canvas field (right-angle PCB
   CIRCUIT TRACES routed around the MARGINS with glowing vias/nodes
   that pulse, plus travelling data packets that run the traces —
   a living motherboard under the synthwave grid), the no-numbers
   neon loading trace, and the slot loop. Render mode (?render=1)
   freezes entrances and exposes deterministic __renderPlay()/
   __renderAdvance() so the headless pipeline captures frames to
   webm without virtual time. Runs only what a scene includes;
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

  /* ---- neon loading trace = hidden timer (no numbers) ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
  }

  /* ============================================================
     CANVAS FIELD: animated PCB circuit traces routed to the MARGINS
     (centre kept clear for text), glowing vias that pulse, and small
     data packets that travel along the traces. Deterministic seeded
     RNG so render mode is reproducible (no Math.random in frame fn).
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080, life = 0;
  let traces = [], vias = [], packets = [];

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0x7A1C >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);
  const RI = (a, b) => Math.round(R(a, b));
  const NEON = ["#FF6AD5", "#8A4BFF", "#26D6FF"];

  // grid snap for that right-angle PCB look
  const STEP = 24;
  const snap = (v) => Math.round(v / STEP) * STEP;

  // build a manhattan (right-angle) trace as a list of points, starting at
  // an edge anchor and walking inward but staying within a margin band.
  function buildTrace(side) {
    const pts = [];
    const col = NEON[(srnd() * NEON.length) | 0];
    // margin band: traces live in the outer frame; the inner rect is the
    // clear zone for text. (inner clear rect ~ x:[470,1450] y:[300,820])
    const CLEARX0 = 470, CLEARX1 = 1450, CLEARY0 = 300, CLEARY1 = 820;
    let x, y, dir; // dir: 0=right,1=down,2=left,3=up
    if (side === 0) { x = snap(R(40, W - 40)); y = snap(R(20, 90)); dir = 1; }       // top edge -> down
    else if (side === 1) { x = snap(W - R(20, 90)); y = snap(R(40, H - 40)); dir = 2; } // right -> left
    else if (side === 2) { x = snap(R(40, W - 40)); y = snap(H - R(20, 90)); dir = 3; } // bottom -> up
    else { x = snap(R(20, 90)); y = snap(R(40, H - 40)); dir = 0; }                  // left -> right
    pts.push({ x, y });
    const segs = RI(3, 6);
    for (let i = 0; i < segs; i++) {
      const len = snap(R(60, 240));
      let nx = x, ny = y;
      if (dir === 0) nx += len; else if (dir === 1) ny += len;
      else if (dir === 2) nx -= len; else ny -= len;
      // keep out of the central clear zone: if a move would enter it, clamp + turn
      if (nx > CLEARX0 && nx < CLEARX1 && ny > CLEARY0 && ny < CLEARY1) {
        if (dir === 0) nx = CLEARX0; else if (dir === 2) nx = CLEARX1;
        else if (dir === 1) ny = CLEARY0; else ny = CLEARY1;
      }
      // clamp to canvas with small margin
      nx = Math.max(24, Math.min(W - 24, nx));
      ny = Math.max(24, Math.min(H - 24, ny));
      pts.push({ x: nx, y: ny });
      x = nx; y = ny;
      // 70% turn (right-angle), 30% continue
      if (srnd() < 0.7) dir = (dir + (srnd() < 0.5 ? 1 : 3)) & 3;
    }
    // cumulative length for packet travel
    let total = 0; const lens = [];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
      lens.push(d); total += d;
    }
    return { pts, col, lens, total, born: R(0, 3) };
  }

  // point at distance d along a manhattan trace
  function ptAt(tr, d) {
    let rem = d % tr.total;
    for (let i = 0; i < tr.lens.length; i++) {
      if (rem <= tr.lens[i]) {
        const a = tr.pts[i], b = tr.pts[i + 1], f = tr.lens[i] ? rem / tr.lens[i] : 0;
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
      rem -= tr.lens[i];
    }
    return tr.pts[tr.pts.length - 1];
  }

  function buildField() {
    _s = 0x7A1C >>> 0;                 // reset seed -> identical field every build
    traces = []; vias = []; packets = []; life = 0;
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    W = cv.width || 1920; H = cv.height || 1080;

    const NT = num("traces", 16);
    for (let i = 0; i < NT; i++) traces.push(buildTrace(i % 4));

    // standalone glowing vias scattered in the margins (pulsing nodes)
    const CLEARX0 = 460, CLEARX1 = 1460, CLEARY0 = 290, CLEARY1 = 830;
    const NV = num("vias", 30);
    let guard = 0;
    while (vias.length < NV && guard++ < NV * 8) {
      const x = snap(R(40, W - 40)), y = snap(R(40, H - 40));
      if (x > CLEARX0 && x < CLEARX1 && y > CLEARY0 && y < CLEARY1) continue; // keep centre clear
      vias.push({ x, y, r: R(2.4, 5.2), c: NEON[(srnd() * NEON.length) | 0],
        ph: R(0, 6.283), ps: R(0.6, 1.5) });
    }

    // travelling data packets — one per ~2 traces
    const NP = Math.max(1, (NT / 2) | 0);
    for (let i = 0; i < NP; i++) {
      const tr = traces[(srnd() * traces.length) | 0];
      packets.push({ tr, d: R(0, tr.total), spd: R(90, 220), col: tr.col });
    }
  }
  buildField();

  function drawTrace(tr) {
    // soft draw-in: reveal length grows then holds; subtle energized glow
    const reveal = Math.min(1, Math.max(0, life - tr.born) * 0.9);
    if (reveal <= 0) return;
    const shown = tr.total * reveal;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    // base dim trace
    ctx.strokeStyle = "rgba(120,150,210,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let acc = 0;
    ctx.moveTo(Math.round(tr.pts[0].x), Math.round(tr.pts[0].y));
    for (let i = 1; i < tr.pts.length; i++) {
      if (acc >= shown) break;
      const seg = tr.lens[i - 1];
      if (acc + seg <= shown) {
        ctx.lineTo(Math.round(tr.pts[i].x), Math.round(tr.pts[i].y));
      } else {
        const f = (shown - acc) / seg;
        ctx.lineTo(Math.round(tr.pts[i - 1].x + (tr.pts[i].x - tr.pts[i - 1].x) * f),
                   Math.round(tr.pts[i - 1].y + (tr.pts[i].y - tr.pts[i - 1].y) * f));
      }
      acc += seg;
    }
    ctx.stroke();
    // neon glow pass on the same path
    ctx.strokeStyle = tr.col;
    ctx.globalAlpha = 0.32 + 0.12 * Math.sin(life * 1.6 + tr.born * 3);
    ctx.shadowColor = tr.col; ctx.shadowBlur = 8;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    // junction dots at each corner that's revealed
    acc = 0;
    for (let i = 0; i < tr.pts.length; i++) {
      if (acc > shown) break;
      const p = tr.pts[i];
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = tr.col;
      ctx.beginPath(); ctx.arc(Math.round(p.x), Math.round(p.y), 2.2, 0, 6.2832); ctx.fill();
      if (i < tr.lens.length) acc += tr.lens[i];
    }
    ctx.globalAlpha = 1;
  }

  function drawBg(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    life += dt;

    // 1) circuit traces (right-angle, margin-routed)
    for (const tr of traces) drawTrace(tr);

    // 2) pulsing vias / nodes
    for (const v of vias) {
      v.ph += v.ps * dt;
      const pulse = 0.55 + 0.45 * Math.sin(v.ph);
      const r = v.r * (0.85 + 0.4 * pulse);
      ctx.globalAlpha = 0.4 + 0.5 * pulse;
      ctx.shadowColor = v.c; ctx.shadowBlur = 14 * pulse;
      ctx.fillStyle = v.c;
      ctx.beginPath(); ctx.arc(Math.round(v.x), Math.round(v.y), r, 0, 6.2832); ctx.fill();
      // bright core
      ctx.globalAlpha = 0.9; ctx.shadowBlur = 0; ctx.fillStyle = "#FFFFFF";
      ctx.beginPath(); ctx.arc(Math.round(v.x), Math.round(v.y), Math.max(1, r * 0.4), 0, 6.2832); ctx.fill();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    // 3) travelling data packets riding the traces
    for (const pk of packets) {
      pk.d += pk.spd * dt;
      const reveal = Math.min(1, Math.max(0, life - pk.tr.born) * 0.9);
      if (reveal <= 0) continue;
      const p = ptAt(pk.tr, pk.d % (pk.tr.total * reveal || 1));
      ctx.shadowColor = pk.col; ctx.shadowBlur = 16;
      ctx.fillStyle = "#FFFFFF"; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.arc(Math.round(p.x), Math.round(p.y), 3.2, 0, 6.2832); ctx.fill();
      // short comet tail
      const tp = ptAt(pk.tr, (pk.d - 14) % (pk.tr.total * reveal || 1));
      ctx.strokeStyle = pk.col; ctx.globalAlpha = 0.5; ctx.lineWidth = 2.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(Math.round(tp.x), Math.round(tp.y));
      ctx.lineTo(Math.round(p.x), Math.round(p.y)); ctx.stroke();
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
  window.__vaporDraw = () => drawBg(1 / 30);

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
