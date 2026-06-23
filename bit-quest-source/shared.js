/* ============================================================
   BIT QUEST — shared engine ("16-bit JRPG Menu")
   fit() scaling, the canvas WORLD MAP field (tiled grass/water/path/
   forest pixel tiles on an integer grid drawn pixelated, a little
   AIRSHIP drifting across the sky, twinkling overworld STARS), the
   no-numbers chunky "EXP" loading bar, optional ?handle and the
   editable [data-slot] loop. Render mode (?render=1) freezes
   entrances and exposes deterministic __renderPlay()/__renderAdvance()
   so the headless pipeline captures frames to webm without virtual
   time. Runs only what a scene includes; every optional subsystem is
   null-guarded.
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

  /* ---- chunky "EXP" loading bar = hidden timer (no numbers shown) ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (fill) fill.style.width = (p * 100).toFixed(2) + "%";
  }

  /* ============================================================
     CANVAS WORLD MAP: tiled 16-bit overworld + drifting airship +
     twinkling stars. Deterministic seeded RNG so render mode is
     reproducible (no Math.random in the frame fn).
     ============================================================ */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080, life = 0;
  let map = [], stars = [], airship = null;
  const TILE = 60;                 // integer pixel tile size
  let COLS = 32, ROWS = 18;

  // tiny seeded PRNG (mulberry32) — no Math.random in the frame fn
  let _s = 0x1f2e >>> 0;
  function srnd() {
    _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
    let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const R = (a, b) => a + srnd() * (b - a);

  // tile palette (16-bit overworld). [base, hi, lo] per tile type.
  const TILES = {
    water: ["#264BB0", "#3E63E8", "#1B2C9E"],
    grass: ["#2E7D4F", "#3FA868", "#1F5B39"],
    grass2:["#256B43", "#358F58", "#194B30"],
    path:  ["#C9A86A", "#E4C98C", "#9C7E45"],
    sand:  ["#D8B26B", "#EBCE8E", "#B68C46"],
  };

  function buildField() {
    _s = 0x1f2e >>> 0;             // reset seed -> identical field every build
    life = 0; map = []; stars = [];
    if (!cv) return;
    ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    W = cv.width || 1920; H = cv.height || 1080;
    COLS = Math.ceil(W / TILE); ROWS = Math.ceil(H / TILE);

    // ---- generate the overworld tile grid ----
    // a coastline: water on the lower-left, land on the upper-right,
    // a winding path snaking across the land, sprinkled forest tiles.
    map = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        // diagonal coastline w/ a wobble so it isn't a straight line
        const coast = (c * 0.55 + r * 0.42) + Math.sin(c * 0.7) * 1.1 + Math.sin(r * 0.9) * 1.0;
        let type;
        if (coast < 9.0) type = "water";
        else if (coast < 10.4) type = "sand";
        else type = srnd() < 0.5 ? "grass" : "grass2";
        // forest tufts & flowers only on grass
        let deco = null;
        if ((type === "grass" || type === "grass2")) {
          const d = srnd();
          if (d < 0.16) deco = "tree";
          else if (d < 0.22) deco = "flower";
        }
        row.push({ type, deco, j: srnd() }); // j = per-tile jitter seed
      }
      map.push(row);
    }
    // carve a winding diagonal PATH across the land
    let pc = Math.floor(COLS * 0.42);
    for (let r = 0; r < ROWS; r++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = pc + dc;
        if (c >= 0 && c < COLS && map[r][c] && map[r][c].type !== "water" && map[r][c].type !== "sand") {
          map[r][c].type = "path"; map[r][c].deco = null;
        }
      }
      pc += srnd() < 0.5 ? 1 : (srnd() < 0.5 ? 0 : -1);
      if (pc < 2) pc = 2; if (pc > COLS - 3) pc = COLS - 3;
    }

    // ---- twinkling overworld stars (only in the upper sky band) ----
    const NST = num("stars", 40);
    stars = Array.from({ length: NST }, () => ({
      x: R(0, W), y: R(0, H * 0.42),
      s: Math.max(2, Math.round(R(2, 5))),
      ph: R(0, 6.283), tw: R(0.5, 1.5),
      c: srnd() < 0.5 ? "#FFFFFF" : "#FFCB47",
    }));

    // ---- a little AIRSHIP that drifts across the sky ----
    airship = { x: -160, y: H * 0.2, sp: R(26, 34), bob: R(0, 6.283) };
  }
  buildField();

  // draw a single chunky pixel tile at grid (c,r) with simple inner shading
  function drawTile(c, r, t) {
    const x = c * TILE, y = r * TILE;
    const pal = TILES[t.type] || TILES.grass;
    ctx.fillStyle = pal[0];
    ctx.fillRect(x, y, TILE, TILE);
    // two-tone pixel speckle for texture (deterministic via tile jitter)
    const hi = pal[1], lo = pal[2];
    const u = TILE / 6;                       // sub-pixel block
    // highlight blocks
    ctx.fillStyle = hi;
    ctx.fillRect(x + Math.round((t.j * 4) % 4) * u, y + u, u, u);
    ctx.fillRect(x + 4 * u, y + 3 * u, u, u);
    // shadow blocks
    ctx.fillStyle = lo;
    ctx.fillRect(x + 2 * u, y + 4 * u, u, u);
    ctx.fillRect(x + Math.round((t.j * 3) % 4) * u, y + 5 * u - 1, u, u);
    // animate water: a slow shifting shimmer band
    if (t.type === "water") {
      const sh = (Math.sin(life * 1.2 + (c + r) * 0.6) * 0.5 + 0.5);
      ctx.globalAlpha = 0.16 + sh * 0.18;
      ctx.fillStyle = "#9FC2FF";
      ctx.fillRect(x, y + Math.round(sh * (TILE - u)), TILE, u);
      ctx.globalAlpha = 1;
    }
  }

  // a tiny pixel tree (canopy + trunk) centered in a grass tile
  function drawTree(c, r) {
    const x = c * TILE, y = r * TILE, u = TILE / 6;
    ctx.fillStyle = "#5A3A1E";
    ctx.fillRect(x + 2.5 * u, y + 4 * u, u, 2 * u);     // trunk
    ctx.fillStyle = "#1F6B3E";
    ctx.fillRect(x + u, y + u, 4 * u, 3 * u);           // canopy
    ctx.fillStyle = "#36A05E";
    ctx.fillRect(x + 1.5 * u, y + 1.4 * u, 2 * u, 1.3 * u); // canopy highlight
  }
  // a tiny pixel flower dot
  function drawFlower(c, r) {
    const x = c * TILE, y = r * TILE, u = TILE / 6;
    ctx.fillStyle = "#FF8FB1";
    ctx.fillRect(x + 2.5 * u, y + 2.5 * u, u, u);
    ctx.fillStyle = "#FFCB47";
    ctx.fillRect(x + 3 * u, y + 3 * u, u * 0.5, u * 0.5);
  }

  // the drifting airship (balloon + gondola + fin), pixel-styled
  function drawAirship(a) {
    const x = Math.round(a.x), y = Math.round(a.y + Math.sin(a.bob) * 6);
    const u = 8;
    // balloon
    ctx.fillStyle = "#7B5CFF";
    ctx.fillRect(x, y, 13 * u, 5 * u);
    ctx.fillStyle = "#9C82FF";
    ctx.fillRect(x + u, y + u, 11 * u, u);             // hi stripe
    ctx.fillStyle = "#FFCB47";
    ctx.fillRect(x + 3 * u, y + 2 * u, 7 * u, u);      // gold band
    ctx.fillStyle = "#5A3FD6";
    ctx.fillRect(x, y + 4 * u, 13 * u, u);             // lo edge
    // gondola
    ctx.fillStyle = "#C9A86A";
    ctx.fillRect(x + 4 * u, y + 5 * u, 5 * u, 2 * u);
    ctx.fillStyle = "#8A6A3A";
    ctx.fillRect(x + 4 * u, y + 6 * u, 5 * u, u);
    // tail fin
    ctx.fillStyle = "#3AD6C5";
    ctx.fillRect(x - 2 * u, y + u, 2 * u, 3 * u);
    // a tiny propeller blink at the front
    if (Math.sin(life * 9) > 0) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x + 13 * u, y + 2 * u, u, u);
    }
  }

  function drawBg(dt) {
    if (!ctx) return;
    life += dt;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);

    // 1) the tiled overworld
    for (let r = 0; r < ROWS; r++) {
      const row = map[r]; if (!row) continue;
      for (let c = 0; c < COLS; c++) {
        const t = row[c]; if (!t) continue;
        drawTile(c, r, t);
      }
    }
    // 2) decorations on top (trees/flowers) — only outside the central band
    for (let r = 0; r < ROWS; r++) {
      const row = map[r]; if (!row) continue;
      for (let c = 0; c < COLS; c++) {
        const t = row[c]; if (!t || !t.deco) continue;
        if (t.deco === "tree") drawTree(c, r);
        else if (t.deco === "flower") drawFlower(c, r);
      }
    }

    // 3) twinkling overworld stars in the sky band
    for (const st of stars) {
      st.ph += 0.05 * dt * 60;
      const tw = 0.45 + (Math.sin(st.ph * st.tw) * 0.5 + 0.5) * 0.55;
      ctx.globalAlpha = tw;
      ctx.fillStyle = st.c;
      ctx.fillRect(Math.round(st.x), Math.round(st.y), st.s, st.s);
      // little sparkle cross when bright
      if (tw > 0.85) {
        ctx.fillRect(Math.round(st.x) - st.s, Math.round(st.y) + (st.s >> 1) - 1, st.s, 2);
        ctx.fillRect(Math.round(st.x) + st.s, Math.round(st.y) + (st.s >> 1) - 1, st.s, 2);
      }
    }
    ctx.globalAlpha = 1;

    // 4) the drifting airship
    if (airship) {
      airship.x += airship.sp * dt;
      airship.bob += 1.4 * dt;
      if (airship.x > W + 180) { airship.x = -180; airship.y = H * (0.12 + srnd() * 0.18); }
      drawAirship(airship);
    }

    // 5) a soft dark overlay behind the window zone so the menu reads cleanly
    const g = ctx.createRadialGradient(W * 0.5, H * 0.52, 120, W * 0.5, H * 0.52, 760);
    g.addColorStop(0, "rgba(27,17,48,.62)");
    g.addColorStop(1, "rgba(27,17,48,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---- timeline driver ---- */
  function tick(seconds) { setBar(seconds / barSeconds); }

  /* ---- render mode: deterministic frame stepping (1 frame = 1/30s) ---- */
  let rf = 0;
  window.__renderPlay = function () { rf = 0; buildField(); drawBg(0); tick(0); };
  window.__renderAdvance = function () {
    const t = rf / 30;             // seconds elapsed
    drawBg(1 / 30);
    tick(t);
    rf++;
    return rf * (1000 / 30);
  };
  // rAF-independent verification hook (EXACT name)
  window.__bitDraw = () => drawBg(1 / 30);

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
