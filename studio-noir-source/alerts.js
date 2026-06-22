/* ============================================================
   STUDIO NOIR — alert engine ("Lower-Third Bug")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography + copy. Auto-plays a looping DEMO on load.
   Read ?type=&name=&amount= to override the demo data/event.
   Delta-clamped rAF KEY-LIGHT DUST burst (transparent canvas).
   ?noname=1  => big line shows the EVENT label, kicker hides
                 (this is how the shipped clips are recorded).
   ?render=1  => deterministic manual frame-stepping for headless
                 webm capture via __renderPlay/__renderAdvance.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  // noname: render the bug with NO baked viewer name (the big line shows the event
  // instead, and the streamer's Streamlabs/StreamElements overlays the live name).
  const noname = params.get("noname") === "1" || params.get("noname") === "true";
  // render mode: deterministic manual frame-stepping for headless webm capture
  // (no CSS animation / setTimeout / free rAF — driven by window.__renderAdvance()).
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

  /* ---- editable text slots: any [data-slot] ships a muted "[ your text here ]"
     placeholder the buyer edits or deletes. ?slotname=Text sets it at render
     time; ?slotname=- (or empty/none/off) removes it entirely. (The #sub line
     is driven by the per-event table instead, so it is not a data-slot.) ---- */
  document.querySelectorAll("[data-slot]").forEach((sl) => {
    const v = params.get(sl.dataset.slot);
    if (v == null) return;
    if (v === "-" || v === "" || v === "none" || v === "off") { sl.remove(); return; }
    sl.textContent = v;
    sl.classList.remove("is-slot");
  });

  /* ---- per-event choreography table ----
     glyph  : condensed-grotesque mark in the left chip
     kicker : small steel caps event line (also the noname headline)
     sub    : neutral-sans sub line
     motion : the per-event entrance class (.m-<motion>) + the matching
              deterministic transform used in render mode (see renderAdvance)
     motes  : how many key-light dust motes the burst spits (raid/host bigger)
     amount : true => emphasize the amount line (cheer/donation/superchat)
     amtPre/amtSuf : decoration around a bare numeric amount */
  // kicker = the FUNCTIONAL event headline (kept). sub = an editable flavor slot:
  // ships a neutral "[ your text here ]" placeholder the buyer edits or removes.
  const EVENTS = {
    follower:   { glyph:"+",  kicker:"NEW FOLLOWER",  sub:"[ your text here ]",   motion:"follower",   motes:18, amount:false },
    subscriber: { glyph:"▲", kicker:"NEW SUBSCRIBER", sub:"[ your text here ]", motion:"subscriber", motes:22, amount:false },
    member:     { glyph:"◈", kicker:"NEW MEMBER", sub:"[ your text here ]",        motion:"member",     motes:22, amount:false },
    cheer:      { glyph:"◆", kicker:"CHEER",      sub:"[ your text here ]",        motion:"cheer",      motes:26, amount:true,  amtPre:"", amtSuf:" BITS" },
    donation:   { glyph:"■", kicker:"DONATION",   sub:"[ your text here ]",       motion:"donation",   motes:28, amount:true,  amtPre:"$" },
    host:       { glyph:"▶", kicker:"NOW HOSTING", sub:"[ your text here ]",         motion:"host",       motes:34, amount:true,  amtPre:"", amtSuf:" VIEWERS" },
    raid:       { glyph:"»", kicker:"INCOMING RAID", sub:"[ your text here ]", motion:"raid",      motes:48, amount:true,  amtPre:"", amtSuf:" RAIDERS" },
    like:       { glyph:"♥", kicker:"NEW LIKE",   sub:"[ your text here ]",           motion:"like",       motes:14, amount:false },
    share:      { glyph:"↗", kicker:"SHARED",     sub:"[ your text here ]",         motion:"share",      motes:18, amount:false },
    star:       { glyph:"★", kicker:"NEW STAR",   sub:"[ your text here ]",         motion:"star",       motes:24, amount:true,  amtPre:"", amtSuf:" STARS" },
    superchat:  { glyph:"◉", kicker:"SUPER CHAT", sub:"[ your text here ]",        motion:"superchat",  motes:30, amount:true,  amtPre:"$" },
    supporter:  { glyph:"❖", kicker:"NEW SUPPORTER", sub:"[ your text here ]",  motion:"supporter",  motes:24, amount:false },
  };
  const DEFAULT = EVENTS.follower;
  const ALL_MOTIONS = Object.keys(EVENTS).map((k) => "m-" + EVENTS[k].motion);

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

  /* ---- the bug elements ---- */
  const card = $id("alert");
  const glyphEl = $id("glyph");
  const kickEl = $id("kick-label");
  const nameEl = $id("name");
  const amountEl = $id("amount");
  const subEl = $id("sub");
  const kickLine = card ? card.querySelector(".kick") : null;

  let hideTimer = null, busy = false, demoOn = false;

  /* ---- key-light dust burst on a transparent canvas (delta-clamped rAF) ---- */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const DUST = ["#E3B23C", "#C0C6CC", "#F5F7F9", "#9c7620"];
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the bug's amber rule / glyph chip (lower-left of the stage)
  function spawnBurst(n) {
    const ox = 180, oy = H - 250;
    for (let i = 0; i < n; i++) {
      burst.push({
        x: ox + R(-40, 140), y: oy + R(-70, 70),
        vx: R(30, 230) / 60, vy: R(-180, -40) / 60,
        g: R(80, 150) / 3600,
        s: R(1, 4), rot: R(0, 6.28), vr: R(-3, 3) / 60,
        a: 1, life: R(1.2, 2.4),
        c: DUST[(Math.random() * DUST.length) | 0],
      });
    }
  }

  function drawMote(p) {
    // a tiny rotated chip of key-light dust
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y)); ctx.rotate(p.rot + Math.PI / 4);
    ctx.globalAlpha = Math.max(0, p.a);
    ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 8;
    ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 60) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  window.__noirAlertDraw = frame; // rAF-independent verification hook

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

  /* ---- shared: populate the bug copy for an event ---- */
  function populate(type, name, amountStr) {
    const cfg = EVENTS[type] || DEFAULT;
    if (glyphEl) glyphEl.textContent = cfg.glyph;
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
    if (card) card.classList.toggle("has-amount", !!(cfg.amount && amountStr));
    return cfg;
  }

  /* ---- play(): drive one alert through its choreography ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "NewViewer";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    populate(type, name, amountStr);

    // restart the entrance: clear all motion classes, force reflow, add the event's motion
    card.classList.remove("hide", "show", ...ALL_MOTIONS);
    void card.offsetWidth; // force reflow so re-adding replays the keyframes
    card.classList.add("show", "m-" + cfg.motion);

    // key-light dust burst (staggered a touch so it reads after the slab lands)
    setTimeout(() => spawnBurst(cfg.motes), 200);
    // raid/host get a second pop for "bigger" feel
    if (cfg.motes >= 30) setTimeout(() => spawnBurst(Math.round(cfg.motes * 0.55)), 560);

    // hold, then cut out
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show", ...ALL_MOTIONS);
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        // if running the demo loop, queue the next one after a short gap
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1500);
      }, 440);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then loop every few seconds ---- */
  function demoData() {
    return {
      type: pageType(),
      name: params.get("name") || "NewViewer",
      amount: params.get("amount") != null ? params.get("amount") : "5",
    };
  }
  function startDemo() {
    demoOn = true;
    play(demoData());
  }

  /* ============================================================
     DETERMINISTIC RENDER MODE — drive one full play via manual frame
     steps. Each motion's transform is replicated in JS (no CSS), so the
     headless pipeline captures identical frames every run.
     ============================================================ */
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  // per-motion transform as a function of entrance progress p (0..1)
  // returns a CSS transform string + an opacity multiplier
  function motionTransform(motion, p) {
    const e = easeOut(p);
    let tf = "none", op = Math.min(1, p / 0.5);
    switch (motion) {
      case "follower":   tf = "translateX(" + (-120 + e * 120).toFixed(1) + "px)"; break;
      case "subscriber": tf = "translateY(" + (96 - e * 96).toFixed(1) + "px)"; break;
      case "member":     tf = "scaleX(" + (0.02 + e * 0.98).toFixed(3) + ")"; break;
      case "cheer":      tf = "scale(" + (0.72 + e * 0.28).toFixed(3) + ")"; break;
      case "donation":   tf = "translateY(" + (-110 + e * 110).toFixed(1) + "px)"; break;
      case "host":       tf = "rotate(" + (-7 + e * 7).toFixed(2) + "deg) translateX(" + (-70 + e * 70).toFixed(1) + "px)"; break;
      case "raid":       tf = "translateX(" + (-240 + e * 240).toFixed(1) + "px) scale(" + (1.04 - e * 0.04).toFixed(3) + ")"; break;
      case "like":       tf = "translateY(" + (22 - e * 22).toFixed(1) + "px)"; break;
      case "share":      tf = "translateX(" + (-140 + e * 140).toFixed(1) + "px) skewX(" + (10 - e * 10).toFixed(2) + "deg)"; break;
      case "star":       tf = "scale(" + (1.18 - e * 0.18).toFixed(3) + ")"; break;
      case "superchat":  tf = "translateY(" + (70 - e * 70).toFixed(1) + "px) scale(" + (0.9 + e * 0.1).toFixed(3) + ")"; break;
      case "supporter":  tf = "scale(" + (0.92 + e * 0.08).toFixed(3) + ")"; break;
      default:           tf = "translateX(" + (-120 + e * 120).toFixed(1) + "px)"; break;
    }
    return { tf, op };
  }

  let _cfg = DEFAULT, _f = 0, _b1 = false, _b2 = false;
  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "NewViewer");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    populate(type, name, amountStr);
    card.classList.remove("show", "hide", ...ALL_MOTIONS);
    if (card) { card.style.transform = ""; card.style.opacity = "0"; }
    _f = 0; _b1 = false; _b2 = false; burst = [];
  }
  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const ENTER = 700, HOLD = 4200, EXIT = 420, holdEnd = ENTER + HOLD;
    let tf, op;
    if (ms < ENTER) {
      const m = motionTransform(_cfg.motion, ms / ENTER);
      tf = m.tf; op = m.op;
    } else if (ms < holdEnd) {
      tf = "none"; op = 1;
    } else {
      const p = Math.min(1, (ms - holdEnd) / EXIT);
      tf = "translateY(" + (p * 18).toFixed(1) + "px) scale(" + (1 - p * 0.015).toFixed(4) + ")";
      op = 1 - p;
    }
    if (card) { card.style.transform = tf; card.style.opacity = op.toFixed(3); }
    // staggered dust bursts (mirror the live play timings)
    if (ms >= 200 && !_b1) { _b1 = true; spawnBurst(_cfg.motes); }
    if (_cfg.motes >= 30 && ms >= 560 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.motes * 0.55)); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo after a tiny delay (skipped in render mode)
  if (!render) setTimeout(startDemo, 400);
})();
