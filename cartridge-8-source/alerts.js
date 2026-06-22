/* ============================================================
   CARTRIDGE 8 — alert engine ("1-UP!")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography + copy. Auto-plays a looping DEMO on load.
   Read ?type=&name=&amount= to override the demo data/event.
   Delta-clamped rAF PIXEL-BURST (chunky integer coins/blocks on
   a transparent canvas, hard pixels, no blur).
   ?noname=1  => big line shows the EVENT label, kicker hides.
   ?render=1  => deterministic manual frame-stepping for headless
                 webm capture via __renderPlay/__renderAdvance.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  // noname: render the card with NO baked viewer name (the big line shows the event
  // instead, and the streamer's Streamlabs/StreamElements overlays the live name).
  const noname = params.get("noname") === "1" || params.get("noname") === "true";
  // render mode: deterministic manual frame-stepping for headless webm capture.
  const render = params.get("render") === "1";
  const stage = $id("stage");
  if (render && stage) stage.classList.add("render");

  /* ---- fit the 1920x1080 stage to the window (defensive, mirrors shared.js) ---- */
  function fit() {
    const iw = window.innerWidth, ih = window.innerHeight;
    if (iw < 10 || ih < 10) return;
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- per-event choreography table ----
     glyph  : pixel glyph in the ?-block art tile
     kicker : deco-caps event line (also the noname big-line label)
     sub    : little pixel sub-line
     motes  : how many pixel particles the burst spits (raid/host bigger)
     amount : true => emphasize the amount/SCORE line (cheer/donation/superchat)
     amtPre/amtSuf : text wrapped around a bare numeric amount
     kind   : burst sprite kind ("coin" gold coins, "heart" red blocks,
              "star" yellow stars, "block" mixed bricks) — bespoke per event
     cls    : per-event entrance class on .alert (maps to a CSS keyframe) */
  // NOTE: each event's `sub` is an OPTIONAL flavor line, left blank so it ships
  // neutral. The streamer can fill it via their alert platform / by editing here.
  // The event `kicker`, the viewer name, and the amount are FUNCTIONAL — kept.
  const EVENTS = {
    follower:   { glyph: "+",  kicker: "NEW FOLLOWER",   sub: "",     motes: 16, amount: false, kind: "coin",  cls: "ev-follower" },
    subscriber: { glyph: "$",  kicker: "NEW SUBSCRIBER", sub: "",       motes: 22, amount: false, kind: "coin",  cls: "ev-subscriber" },
    member:     { glyph: "M",  kicker: "NEW MEMBER",     sub: "",       motes: 20, amount: false, kind: "block", cls: "ev-member" },
    cheer:      { glyph: "C",  kicker: "CHEER",          sub: "",     motes: 26, amount: true,  amtPre: "", amtSuf: " BITS", kind: "coin",  cls: "ev-cheer" },
    donation:   { glyph: "1",  kicker: "DONATION",       sub: "",          motes: 26, amount: true,  amtPre: "$", kind: "heart", cls: "ev-donation" },
    host:       { glyph: ">",  kicker: "NOW HOSTING",    sub: "",      motes: 32, amount: true,  amtPre: "", amtSuf: " GUESTS",  kind: "block", cls: "ev-host" },
    raid:       { glyph: "R",  kicker: "RAID INCOMING",  sub: "",           motes: 46, amount: true,  amtPre: "", amtSuf: " RAIDERS", kind: "block", cls: "ev-raid" },
    like:       { glyph: "<",  kicker: "NEW LIKE",       sub: "",               motes: 14, amount: false, kind: "heart", cls: "ev-like" },
    share:      { glyph: "S",  kicker: "SHARED",         sub: "",      motes: 18, amount: false, kind: "block", cls: "ev-share" },
    star:       { glyph: "*",  kicker: "NEW STAR",       sub: "",         motes: 24, amount: true,  amtPre: "", amtSuf: " STARS",   kind: "star",  cls: "ev-star" },
    superchat:  { glyph: "!",  kicker: "SUPER CHAT",     sub: "",        motes: 28, amount: true,  amtPre: "$", kind: "star",  cls: "ev-superchat" },
    supporter:  { glyph: "&",  kicker: "NEW SUPPORTER",  sub: "",         motes: 24, amount: false, kind: "coin",  cls: "ev-supporter" },
  };
  const DEFAULT = EVENTS.follower;
  const ALL_CLS = Object.keys(EVENTS).map((k) => EVENTS[k].cls);

  /* ---- read the event type the page declared (body[data-event]) or ?type= ---- */
  function pageType() {
    const fromParam = params.get("type");
    if (fromParam && EVENTS[fromParam]) return fromParam;
    const fromBody = document.body && document.body.dataset ? document.body.dataset.event : null;
    if (fromBody && EVENTS[fromBody]) return fromBody;
    return "follower";
  }

  /* ---- format the amount string for an event ---- */
  function fmtAmount(cfg, amount) {
    if (amount == null || amount === "") return "";
    const a = String(amount).trim();
    if (a === "") return "";
    // if the caller already included a symbol/letters, leave it alone
    const hasSymbol = /[$€£¥]/.test(a) || /[a-z]/i.test(a);
    if (hasSymbol) return a;
    return (cfg.amtPre || "") + a + (cfg.amtSuf || "");
  }

  /* ---- the card elements ---- */
  const card = $id("alert");
  const glyphEl = $id("glyph");
  const kickEl = $id("kick-label");
  const nameEl = $id("name");
  const amountEl = $id("amount");
  const subEl = $id("sub");

  let hideTimer = null, busy = false, demoOn = false;

  /* ---- pixel-burst on a transparent canvas (delta-clamped rAF) ---- */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const PX = 8; // base pixel unit (everything snaps to multiples of 8)
  // flat NES palettes per burst kind (no gradients)
  const PAL = {
    coin:  ["#FCD800", "#FCBC3C", "#FCFCFC", "#A85400"],
    heart: ["#E60000", "#FCFCFC", "#A80000", "#FC7C7C"],
    star:  ["#FCD800", "#FCFCFC", "#FCBC3C"],
    block: ["#C84C0C", "#FCBC3C", "#7C2800", "#FCFCFC"],
  };
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];
  let burstKind = "coin";

  // burst originates near the card's art tile (lower-left of the stage)
  function spawnBurst(n, kind) {
    burstKind = kind || "coin";
    const ox = 270, oy = H - 230;
    for (let i = 0; i < n; i++) {
      burst.push({
        x: ox + R(-40, 120), y: oy + R(-50, 40),
        vx: R(-160, 200) / 60, vy: R(-300, -120) / 60,
        g: R(420, 560) / 3600,            // gravity per frame-ish
        s: (R(2, 4) | 0) * PX,            // chunky integer size (16/24/32)
        a: 1, life: R(1.2, 2.2),
        c: PAL[burstKind][(Math.random() * PAL[burstKind].length) | 0],
        shape: burstKind,
      });
    }
  }

  // draw one chunky pixel particle (rounded to the integer grid, hard edges, no blur)
  function drawMote(p) {
    const x = Math.round(p.x / PX) * PX, y = Math.round(p.y / PX) * PX;
    const s = p.s;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.a));
    if (p.shape === "heart") {
      // a tiny 3x3-cell blocky heart
      const u = s / 4;
      ctx.fillStyle = p.c;
      ctx.fillRect(x, y + u, u, u); ctx.fillRect(x + 2 * u, y + u, u, u);
      ctx.fillRect(x, y + 2 * u, 3 * u, u);
      ctx.fillRect(x + u, y + 3 * u, u, u);
    } else if (p.shape === "star") {
      // a tiny plus/star cluster
      const u = s / 3;
      ctx.fillStyle = p.c;
      ctx.fillRect(x + u, y, u, 3 * u);
      ctx.fillRect(x, y + u, 3 * u, u);
    } else {
      // coin / block: a solid pixel square with a hard light corner
      ctx.fillStyle = p.c;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#FCFCFC";
      ctx.fillRect(x, y, s / 4, s / 4);
    }
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g;
      p.life -= 1 / 30; p.a = p.life > 1 ? 1 : Math.max(0, p.life);
      if (p.life <= 0 || p.y > H + 60) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1;
  }
  window.__cart8AlertDraw = frame; // rAF-independent verification hook

  if (ctx && !render) {
    let last = null, since = 0; const MIN = 1000 / 30;
    function loop(now) {
      requestAnimationFrame(loop);
      if (last == null) last = now;
      let dt = now - last; last = now; if (dt > 100) dt = 100;
      since += dt; if (since < MIN) return; since = 0; frame();
    }
    requestAnimationFrame(loop);
  }

  /* ---- apply the event copy/glyph to the card (shared by play + renderPlay) ---- */
  function applyCfg(cfg, name, amountStr) {
    if (glyphEl) glyphEl.textContent = cfg.glyph;
    const kickLine = card ? card.querySelector(".kick") : null;
    if (noname) {
      if (kickLine) kickLine.style.display = "none";
      if (nameEl) nameEl.textContent = cfg.kicker;
    } else {
      if (kickLine) kickLine.style.display = "";
      if (kickEl) kickEl.textContent = cfg.kicker;
      if (nameEl) nameEl.textContent = name;
    }
    if (subEl) subEl.textContent = cfg.sub;
    if (amountEl) amountEl.textContent = amountStr;
    if (card) {
      card.classList.toggle("has-amount", !!(cfg.amount && amountStr));
      // swap to the event's distinct entrance class
      card.classList.remove(...ALL_CLS);
      card.classList.add(cfg.cls);
    }
  }

  /* ---- play(): drive one alert through its choreography ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "Player1";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    applyCfg(cfg, name, amountStr);

    // restart the entrance animation cleanly
    card.classList.remove("hide", "show");
    void card.offsetWidth; // force reflow so re-adding .show replays it
    card.classList.add("show");

    // pixel burst (staggered a touch so it reads after the pop-in)
    setTimeout(() => spawnBurst(cfg.motes, cfg.kind), 180);
    // raid/host get a second pop for "bigger" feel
    if (cfg.motes >= 30) setTimeout(() => spawnBurst(Math.round(cfg.motes * 0.6), cfg.kind), 520);

    // hold, then drop out
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show");
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        // if running the demo loop, queue the next one after a short gap
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1400);
      }, 300);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then loop ---- */
  function demoData() {
    return {
      type: pageType(),
      name: params.get("name") || "Player1",
      amount: params.get("amount") != null ? params.get("amount") : "5",
    };
  }
  function startDemo() {
    demoOn = true;
    play(demoData());
  }

  /* ---- deterministic render mode: drive one full play via manual frame steps ---- */
  let _cfg = DEFAULT, _f = 0, _b1 = false, _b2 = false;
  // per-event transform sampler mirrors the CSS keyframes (stepped where the CSS is stepped).
  // returns {x,y,sc,op} for a given ms into the entrance.
  function entrance(cfg, ms) {
    const seg = (t) => t; // identity (steps are baked into the breakpoints below)
    let x = 0, y = 0, sc = 1, op = 1;
    switch (cfg.cls) {
      case "ev-follower": { // sprout .42s
        if (ms < 420) { const p = ms / 420; op = p < .001 ? 0 : 1; y = p < .001 ? 60 : p < .33 ? 40 : p < .66 ? 18 : 0; }
        break; }
      case "ev-subscriber": { // stomp .44s
        if (ms < 440) { const p = ms / 440; op = p < .001 ? 0 : 1; y = p < .40 ? -90 : p < .55 ? 0 : p < .70 ? 10 : -6; if (p >= .70) y = 0; }
        break; }
      case "ev-member": { // warp .40s
        if (ms < 400) { const p = ms / 400; op = p < .001 ? 0 : 1; sc = p < .35 ? .05 : p < .55 ? 1.0 : p < .75 ? 1.08 : .96; if (p >= .75) sc = .96; if (p >= .999) sc = 1; }
        break; }
      case "ev-cheer": { // coinpop .46s
        if (ms < 460) { const p = ms / 460; op = p < .001 ? 0 : 1; y = p < .25 ? 30 : p < .50 ? -34 : p < .72 ? -44 : 8; if (p >= .72) y = 8; if (p >= .999) y = 0; }
        break; }
      case "ev-donation": { // oneup .50s
        if (ms < 500) { const p = ms / 500; op = p < .001 ? 0 : 1; y = p < .30 ? 72 : p < .55 ? 40 : p < .78 ? 20 : 6; if (p >= .999) y = 0; }
        break; }
      case "ev-host": { // slideL .42s
        if (ms < 420) { const p = ms / 420; op = p < .001 ? 0 : 1; x = p < .33 ? -260 : p < .66 ? -120 : -40; if (p >= .66) x = -40; if (p >= .999) x = 0; }
        break; }
      case "ev-raid": { // raid shake .56s
        if (ms < 560) { const p = ms / 560; op = p < .001 ? 0 : 1;
          if (p < .20) { x = -200; }
          else if (p < .30) { x = 0; }
          else if (p < .42) { x = 14; y = -6; }
          else if (p < .54) { x = -12; y = 4; }
          else if (p < .66) { x = 10; y = -4; }
          else if (p < .78) { x = -8; y = 3; }
          else { x = 5; y = -2; }
          if (p >= .999) { x = 0; y = 0; } }
        break; }
      case "ev-like": { // blip .30s
        if (ms < 300) { const p = ms / 300; op = p < .001 ? 0 : 1; sc = p < .40 ? .7 : p < .70 ? 1.12 : .95; if (p >= .999) sc = 1; }
        break; }
      case "ev-share": { // slideR .42s
        if (ms < 420) { const p = ms / 420; op = p < .001 ? 0 : 1; x = p < .33 ? 240 : p < .66 ? 110 : 34; if (p >= .999) x = 0; }
        break; }
      case "ev-star": { // star flicker .54s
        if (ms < 540) { const p = ms / 540; y = p < .20 ? 48 : 0;
          op = p < .001 ? 0 : (p < .30 ? 1 : p < .40 ? .3 : p < .52 ? 1 : p < .64 ? .3 : p < .76 ? 1 : .4);
          if (p >= .76) op = 1; }
        break; }
      case "ev-superchat": { // arc .48s
        if (ms < 480) { const p = ms / 480; op = p < .001 ? 0 : 1;
          if (p < .30) { x = -180; y = 60; }
          else if (p < .55) { x = -90; y = -18; }
          else if (p < .78) { x = -30; y = 8; }
          else { x = -8; y = -4; }
          if (p >= .999) { x = 0; y = 0; } }
        break; }
      case "ev-supporter": { // double-bounce .58s
        if (ms < 580) { const p = ms / 580; op = p < .001 ? 0 : 1;
          y = p < .25 ? -70 : p < .40 ? 0 : p < .55 ? -26 : p < .70 ? 0 : p < .85 ? -12 : 0; }
        break; }
      default: break;
    }
    return { x, y, sc, op: seg(op) };
  }

  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "Player1");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    applyCfg(_cfg, name, amountStr);
    card.classList.remove("show", "hide");
    _f = 0; _b1 = false; _b2 = false; burst = [];
  }
  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const ENTER = 580, HOLD = 4200, EXIT = 300, holdEnd = ENTER + HOLD;
    let x = 0, y = 0, sc = 1, op = 1;
    if (ms < ENTER) { const s = entrance(_cfg, ms); x = s.x; y = s.y; sc = s.sc; op = s.op; }
    else if (ms < holdEnd) { x = 0; y = 0; sc = 1; op = 1; }
    else { // stepped drop-out (mirror cart-out)
      const p = Math.min(1, (ms - holdEnd) / EXIT);
      if (p < .50) { y = 10; op = 1; }
      else { y = 48; op = 0; }
    }
    if (card) {
      card.style.transform =
        "translate(" + x.toFixed(0) + "px," + y.toFixed(0) + "px) scale(" + sc.toFixed(3) + ")";
      card.style.opacity = op.toFixed(3);
    }
    // bursts at the same beats as live play
    if (ms >= 180 && !_b1) { _b1 = true; spawnBurst(_cfg.motes, _cfg.kind); }
    if (_cfg.motes >= 30 && ms >= 520 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.motes * 0.6), _cfg.kind); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo after a tiny delay (skipped in render mode)
  if (!render) setTimeout(startDemo, 400);
})();
