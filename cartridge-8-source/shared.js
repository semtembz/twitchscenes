/* ============================================================
   CARTRIDGE 8 — shared engine ("WORLD 1-1")
   fit() scaling, a chunky pixel POWER-METER loading bar (no
   numbers) + status flip, and ONE <canvas class="bg"> that draws
   the bespoke NES platformer scene: blocky drifting pixel clouds
   on a flat sky, a tiled ground row (brick / question-blocks /
   green pipes / dirt strip), and a bobbing pixel coin sprite.
   Everything is integer-grid, hard pixels, no blur/gradients.
   Render mode (?render=1) freezes entrances and exposes
   deterministic __renderPlay()/__renderAdvance() so the headless
   pipeline captures webm without virtual time.
   Runs only what each scene includes.
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

  /* ---- chunky pixel POWER-METER (no numbers) + status flip ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  function setBar(p) {
    p = Math.max(0, Math.min(1, p));
    // snap to discrete power blocks (track is 744px wide, ~44px per block step)
    if (fill) {
      const W = 744;
      const blocks = Math.round((W / 44));         // total slots
      const litW = Math.round(p * blocks) * 44;    // snap to block boundaries
      fill.style.width = Math.min(W, Math.max(0, litW)) + "px";
    }
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
    }
  }

  /* ---- canvas: NES platformer scene (clouds + ground tilemap + coin) ---- */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080;
  let clouds = [], coinT = 0;
  const night = stage && stage.classList.contains("night");
  // flat palette (must match shared.css tokens)
  const COL = {
    sky: night ? "#1A1A2E" : "#5C94FC",
    cloud: "#FCFCFC",
    cloudEdge: night ? "#9090C0" : "#B8D0FC",
    brick: "#C84C0C", brickDk: "#7C2800",
    q: "#FCBC3C", qDk: "#A85400",
    ground: "#9C4A00", groundDk: "#5C2800", groundTop: "#C84C0C",
    pipe: "#00B800", pipeDk: "#006800", pipeLt: "#80D010",
    coin: "#FCD800", coinHi: "#FCFCFC", coinDk: "#A85400",
    black: "#000000",
  };
  const PX = 8; // base pixel unit (everything snaps to multiples of 8)

  if (cv) {
    ctx = cv.getContext("2d");
    W = cv.width || 1920; H = cv.height || 1080;
    const R = (a, b) => a + Math.random() * (b - a);
    // blocky drifting pixel clouds (each is a small rect cluster), slow horizontal drift
    clouds = Array.from({ length: num("clouds", 6) }, () => ({
      x: R(0, W), y: R(70, 460), s: (R(3, 6) | 0), v: R(6, 14) / 60,
    }));
  }

  // draw one blocky pixel cloud at integer grid (cluster of rects)
  function drawCloud(x, y, s) {
    const u = PX * s;            // cloud cell size
    x = Math.round(x / PX) * PX; y = Math.round(y / PX) * PX;
    // body cells (classic 3-lump cloud)
    const cells = [
      [0, 1, 4, 1], [1, 0, 2, 1], [0, 1, 1, 1] /*pad*/,
    ];
    // simpler explicit lumps:
    const lumps = [
      [0 * u, 1 * u, 5 * u, 1 * u],   // base row
      [1 * u, 0 * u, 1 * u, 1 * u],   // small top-left bump
      [2 * u, -1 * u, 1 * u, 1 * u],  // top bump
      [3 * u, 0 * u, 1 * u, 1 * u],   // top-right bump
    ];
    ctx.fillStyle = COL.cloud;
    for (const [dx, dy, w, h] of lumps) {
      ctx.fillRect(x + dx, y + dy, w, h);
    }
    // a darker bottom edge line for the 8-bit shaded look
    ctx.fillStyle = COL.cloudEdge;
    ctx.fillRect(x, y + 1 * u + (1 * u - PX), 5 * u, PX);
  }

  // draw a single q-block / brick tile (16-grid) at integer x,y, size t
  function drawBlock(x, y, t, kind) {
    const fillC = kind === "q" ? COL.q : COL.brick;
    const dk = kind === "q" ? COL.qDk : COL.brickDk;
    ctx.fillStyle = fillC; ctx.fillRect(x, y, t, t);
    // hard inset shadow on right + bottom
    ctx.fillStyle = dk;
    ctx.fillRect(x, y + t - PX, t, PX);
    ctx.fillRect(x + t - PX, y, PX, t);
    // black border
    ctx.fillStyle = COL.black;
    ctx.fillRect(x, y, t, PX / 2);
    ctx.fillRect(x, y, PX / 2, t);
    if (kind === "q") {
      // a little "?" pixel dot block in the middle
      ctx.fillStyle = COL.black;
      ctx.fillRect(x + t / 2 - PX, y + PX * 2, PX * 2, PX);
      ctx.fillRect(x + t / 2, y + PX * 3, PX, PX);
      ctx.fillRect(x + t / 2, y + PX * 5, PX, PX);
    } else {
      // brick mortar lines
      ctx.fillStyle = dk;
      ctx.fillRect(x, y + t / 2 - PX / 2, t, PX / 2);
      ctx.fillRect(x + t / 2 - PX / 2, y, PX / 2, t / 2);
      ctx.fillRect(x + t / 2 - PX / 2, y + t / 2, PX / 2, t / 2);
    }
  }

  // draw a green pixel pipe at integer x, given top y and height
  function drawPipe(x, topY, h) {
    const lipW = 128, lipH = 56, bodyW = 96;
    const bx = x + (lipW - bodyW) / 2;
    // body
    ctx.fillStyle = COL.pipe; ctx.fillRect(bx, topY + lipH, bodyW, h - lipH);
    ctx.fillStyle = COL.pipeLt; ctx.fillRect(bx + PX, topY + lipH, PX * 2, h - lipH);
    ctx.fillStyle = COL.pipeDk; ctx.fillRect(bx + bodyW - PX * 2, topY + lipH, PX * 2, h - lipH);
    // lip
    ctx.fillStyle = COL.pipe; ctx.fillRect(x, topY, lipW, lipH);
    ctx.fillStyle = COL.pipeLt; ctx.fillRect(x + PX, topY + PX, PX * 2, lipH - PX * 2);
    ctx.fillStyle = COL.pipeDk; ctx.fillRect(x + lipW - PX * 3, topY + PX, PX * 2, lipH - PX * 2);
    // black outline
    ctx.fillStyle = COL.black;
    ctx.fillRect(x, topY, lipW, PX / 2);
    ctx.fillRect(x, topY, PX / 2, lipH);
    ctx.fillRect(x + lipW - PX / 2, topY, PX / 2, lipH);
    ctx.fillRect(bx, topY + lipH, PX / 2, h - lipH);
    ctx.fillRect(bx + bodyW - PX / 2, topY + lipH, PX / 2, h - lipH);
  }

  // 8x8-ish bobbing pixel coin sprite, centered at cx, baseline by, bob phase t
  function drawCoin(cx, by, t) {
    const u = PX * 2;                      // coin pixel unit (chunky)
    const bob = Math.round(Math.sin(t * 3) * 1.5) * PX; // integer bob
    const x = Math.round(cx / PX) * PX, y = Math.round((by + bob) / PX) * PX;
    // simple coin: outer ring + inner shine column
    // shape grid (6 wide x 8 tall) using fills, hard pixels
    const O = COL.coinDk, C = COL.coin, Hh = COL.coinHi, K = COL.black;
    const px = (gx, gy, col) => { ctx.fillStyle = col; ctx.fillRect(x + gx * u, y + gy * u, u, u); };
    // rows of the coin (null = transparent)
    const grid = [
      [0,0,K,K,0,0],
      [0,K,O,C,K,0],
      [K,O,C,Hh,C,K],
      [K,O,C,Hh,C,K],
      [K,O,C,Hh,C,K],
      [K,O,C,Hh,C,K],
      [0,K,O,C,K,0],
      [0,0,K,K,0,0],
    ];
    for (let gy = 0; gy < grid.length; gy++)
      for (let gx = 0; gx < grid[gy].length; gx++) {
        const c = grid[gy][gx];
        if (c) px(gx - 3, gy - 4, c);   // center the 6x8 grid
      }
  }

  function drawBg(dt) {
    if (!ctx) return;
    const d = dt * 60;
    // flat sky
    ctx.fillStyle = COL.sky; ctx.fillRect(0, 0, W, H);

    // drifting blocky clouds
    for (const c of clouds) {
      c.x += c.v * d;
      const span = c.s * PX * 6 + 80;
      if (c.x > W + span) c.x = -span;
      drawCloud(c.x, c.y, c.s);
    }

    // ---- ground tilemap row across the bottom ----
    const TILE = 96;                       // tile size
    const groundY = H - TILE * 2;          // top of the 2-row dirt strip
    // floating block row (bricks + question-blocks) sitting above ground
    const blockY = groundY - TILE * 3;
    const pattern = ["b", "q", "b", "b", "q", "b"]; // repeating layout
    // place a short floating cluster left-of-center and right-of-center
    const clusters = [W * 0.16, W * 0.66];
    for (const startX of clusters) {
      for (let i = 0; i < pattern.length; i++) {
        const bx = Math.round((startX + i * TILE) / PX) * PX;
        drawBlock(bx, blockY, TILE, pattern[i]);
      }
    }

    // green pipes
    drawPipe(Math.round(W * 0.40 / PX) * PX, groundY - 224, 224);
    drawPipe(Math.round(W * 0.84 / PX) * PX, groundY - 160, 160);

    // dirt ground strip (2 tiles tall)
    ctx.fillStyle = COL.ground; ctx.fillRect(0, groundY, W, TILE * 2);
    // top grass-edge line (brick orange to match NES ground)
    ctx.fillStyle = COL.groundTop; ctx.fillRect(0, groundY, W, PX * 2);
    // dirt brick texture: vertical dark seams every TILE
    ctx.fillStyle = COL.groundDk;
    for (let gx = 0; gx <= W; gx += TILE) ctx.fillRect(gx, groundY + PX * 2, PX, TILE * 2 - PX * 2);
    // a horizontal seam between the two dirt rows
    for (let gx = 0; gx <= W; gx += TILE) ctx.fillRect(gx + TILE / 2, groundY + TILE, PX, TILE);

    // bobbing coin sprite hovering above the left block cluster
    coinT += dt;
    drawCoin(W * 0.16 + TILE * 5.5, blockY - 60, coinT);
  }

  /* ---- timeline driver ---- */
  function tick(seconds) { setBar(seconds / barSeconds); }

  // render mode: deterministic frame stepping (1 frame = 1/30s)
  let rf = 0;
  window.__renderPlay = function () { rf = 0; coinT = 0; tick(0); };
  window.__renderAdvance = function () {
    const t = rf / 30;            // seconds
    drawBg(1 / 30);
    tick(t);
    rf++;
    return rf * (1000 / 30);
  };
  // rAF-independent verification hook (EXACT name required)
  window.__cart8Draw = function () { drawBg(1 / 30); };

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
