/* ============================================================
   TRACKING ERROR — alert engine ("Signal Insert")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography + copy. Auto-plays a looping DEMO on load.
   Read ?type=&name=&amount= to override the demo data/event.
   Transparent-canvas analog NOISE / chroma-smear burst (delta-clamped rAF).
   ?noname=1  => big line shows the EVENT label (e.g. "NEW FOLLOWER"),
                 the small kicker hides, and the live viewer name is left
                 to the streamer's alert platform (this is the ship mode).
   ?render=1  => deterministic manual frame-stepping for headless webm
                 capture via window.__renderPlay / window.__renderAdvance.
   No audio ships. Animations touch only transform / opacity / filter.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  const noname = params.get("noname") === "1" || params.get("noname") === "true";
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
     glyph  : OSD glyph in the tile
     kicker : caution-chip event line + the noname headline
     sub    : little OSD caption line
     cls    : the entrance class (a DISTINCT motion per event, in alerts.css)
     specks : how many analog noise specks the burst spits (raid/host bigger)
     amount : true => emphasize the amount line (cheer/donation/superchat/etc.)
     amtPre / amtSuf : decoration around a bare numeric amount */
  /* NOTE: the per-event flavor SUB-LINE has been neutralized to "" (no cheesy
     copy ships). The functional kicker / viewer name / amount are kept. To add
     your own caption, type it into the .sub line in alerts/<event>.html (or pass
     a string here); an empty sub is simply hidden by populate(). */
  const EVENTS = {
    follower:   { glyph:"+", kicker:"NEW FOLLOWER",   sub:"", cls:"ev-follower",   specks:60,  amount:false },
    subscriber: { glyph:"▲", kicker:"NEW SUBSCRIBER", sub:"", cls:"ev-subscriber", specks:80,  amount:false },
    member:     { glyph:"◆", kicker:"NEW MEMBER",     sub:"", cls:"ev-member",     specks:80,  amount:false },
    cheer:      { glyph:"¤", kicker:"CHEER",          sub:"", cls:"ev-cheer",      specks:120, amount:true,  amtPre:"", amtSuf:" BITS" },
    donation:   { glyph:"$", kicker:"DONATION",       sub:"", cls:"ev-donation",   specks:130, amount:true,  amtPre:"$" },
    host:       { glyph:"▶", kicker:"NOW HOSTING",    sub:"", cls:"ev-host",       specks:150, amount:true,  amtPre:"", amtSuf:" VIEWERS" },
    raid:       { glyph:"»", kicker:"INCOMING RAID",  sub:"", cls:"ev-raid",       specks:220, amount:true,  amtPre:"", amtSuf:" RAIDERS" },
    like:       { glyph:"♥", kicker:"NEW LIKE",       sub:"", cls:"ev-like",       specks:50,  amount:false },
    share:      { glyph:"«", kicker:"SHARED",         sub:"", cls:"ev-share",      specks:70,  amount:false },
    star:       { glyph:"★", kicker:"NEW STAR",       sub:"", cls:"ev-star",       specks:90,  amount:true,  amtPre:"", amtSuf:" STARS" },
    superchat:  { glyph:"§", kicker:"SUPER CHAT",     sub:"", cls:"ev-superchat",  specks:130, amount:true,  amtPre:"$" },
    supporter:  { glyph:"✱", kicker:"NEW SUPPORTER",  sub:"", cls:"ev-supporter",  specks:90,  amount:false },
  };
  const DEFAULT = EVENTS.follower;
  const ORDER = ["follower","subscriber","member","cheer","donation","host","raid","like","share","star","superchat","supporter"];

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

  /* ---- analog NOISE / chroma-smear burst on a transparent canvas ----
     A short burst of fine luminance specks + chroma-fringed dropout streaks
     bloom out behind the card when it splices in (the tape "tearing"). */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const R = (a, b) => a + Math.random() * (b - a);
  let specks = [], tears = [];

  // burst originates over the card region (lower-left of the stage)
  function spawnBurst(n) {
    const ox = 96 + 434, oy = H - 128 - 92;   // card center-ish
    for (let i = 0; i < n; i++) {
      const cyan = Math.random() > 0.55, red = !cyan && Math.random() > 0.5;
      specks.push({
        x: ox + R(-470, 470), y: oy + R(-130, 130),
        vx: R(-120, 120) / 60, vy: R(-90, 90) / 60,
        s: R(1, 4) | 0, a: 1, life: R(0.5, 1.3),
        c: cyan ? "#19C3FF" : red ? "#FF0033" : "#E8E8E8",
      });
    }
    // a few horizontal dropout tears that streak across the card band
    const nt = Math.max(2, Math.round(n / 26));
    for (let i = 0; i < nt; i++) {
      tears.push({
        x: ox + R(-480, -120), y: oy + R(-110, 110),
        w: R(160, 560), h: R(1, 3) | 0, vx: R(280, 620) / 60,
        a: 1, life: R(0.35, 0.8), cyan: Math.random() > 0.5,
      });
    }
  }

  function drawSpeck(p) {
    ctx.globalAlpha = Math.max(0, p.a);
    ctx.fillStyle = p.c;
    const s = Math.max(1, p.s);
    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }
  function drawTear(t) {
    ctx.globalAlpha = Math.max(0, t.a) * 0.8;
    ctx.fillStyle = "#E8E8E8";
    ctx.fillRect(Math.round(t.x), Math.round(t.y), Math.round(t.w), Math.max(1, t.h));
    ctx.globalAlpha = Math.max(0, t.a) * 0.55;
    ctx.fillStyle = t.cyan ? "#19C3FF" : "#FF0033";
    ctx.fillRect(Math.round(t.x + t.w), Math.round(t.y), 12, Math.max(1, t.h));
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = specks.length - 1; i >= 0; i--) {
      const p = specks[i];
      p.x += p.vx; p.y += p.vy;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life * 1.4));
      if (p.life <= 0) { specks.splice(i, 1); continue; }
      drawSpeck(p);
    }
    for (let i = tears.length - 1; i >= 0; i--) {
      const t = tears[i];
      t.x += t.vx;
      t.life -= 1 / 30; t.a = Math.min(1, Math.max(0, t.life * 1.6));
      if (t.life <= 0 || t.x > W + 60) { tears.splice(i, 1); continue; }
      drawTear(t);
    }
    ctx.globalAlpha = 1;
  }
  window.__vhsAlertDraw = frame; // rAF-independent verification hook

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

  /* ---- populate the card DOM for an event (shared by live + render) ---- */
  let _activeCls = "";
  function populate(type, name, amountStr) {
    const cfg = EVENTS[type] || DEFAULT;
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
    if (subEl) { subEl.textContent = cfg.sub || ""; subEl.style.display = cfg.sub ? "" : "none"; }
    if (amountEl) amountEl.textContent = amountStr;
    if (card) card.classList.toggle("has-amount", !!(cfg.amount && amountStr));
    // swap the per-event motion class
    if (card) {
      if (_activeCls) card.classList.remove(_activeCls);
      _activeCls = cfg.cls;
      card.classList.add(_activeCls);
    }
    return cfg;
  }

  /* ---- play(): drive one alert through its choreography ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "Viewer";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    populate(type, name, amountStr);

    // restart the entrance + underline-fill animations cleanly
    card.classList.remove("hide", "show");
    void card.offsetWidth;                       // force reflow so re-adding replays
    const ubarFill = card.querySelector(".ubar i");
    if (ubarFill) { ubarFill.style.animation = "none"; void ubarFill.offsetWidth; ubarFill.style.animation = ""; }
    card.classList.add("show");

    // analog noise burst (slightly delayed so it reads with the splice-in)
    setTimeout(() => spawnBurst(cfg.specks), 120);
    if (cfg.specks >= 140) setTimeout(() => spawnBurst(Math.round(cfg.specks * 0.5)), 360);

    // hold, then splice out
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show");
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1500);
      }, 440);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then loop ---- */
  function demoData() {
    return {
      type: pageType(),
      name: params.get("name") || "Viewer",
      amount: params.get("amount") != null ? params.get("amount") : "500",
    };
  }
  function startDemo() { demoOn = true; play(demoData()); }

  /* ============================================================
     DETERMINISTIC RENDER MODE: drive one full play via manual frame
     steps. Each event has a DISTINCT transform timeline mirroring the
     CSS keyframes, plus the underline fill, plus the canvas burst.
     ============================================================ */
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // per-event transform as a function of entrance progress p in 0..1.
  // returns a CSS transform string (these mirror the alerts.css keyframes).
  function entranceTransform(type, p) {
    const e = easeOut(p);
    switch (type) {
      case "subscriber": {                          // drop with landing bounce
        let y;
        if (p < 0.6) y = lerp(-260, 18, easeOut(p / 0.6));
        else if (p < 0.8) y = lerp(18, -8, (p - 0.6) / 0.2);
        else y = lerp(-8, 0, (p - 0.8) / 0.2);
        return "translateY(" + y.toFixed(1) + "px)";
      }
      case "member": {                              // zoom punch from small
        let s = p < 0.6 ? lerp(0.4, 1.05, easeOut(p / 0.6)) : lerp(1.05, 1, (p - 0.6) / 0.4);
        return "scale(" + s.toFixed(3) + ")";
      }
      case "cheer": {                               // glitch-stutter slide
        const pts = [[0,-180],[.12,40],[.24,-30],[.38,22],[.54,-14],[.70,8],[.86,-3],[1,0]];
        let x = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          if (p >= pts[i][0] && p <= pts[i + 1][0]) { x = pts[i][1]; break; }   // steps(1,end) feel
          if (p > pts[pts.length - 1][0]) x = 0;
        }
        if (p >= 1) x = 0;
        return "translateX(" + x.toFixed(1) + "px)";
      }
      case "donation": {                            // chroma shear skew-in
        let x, sk;
        if (p < 0.55) { const q = easeOut(p / 0.55); x = lerp(-90, 10, q); sk = lerp(14, -4, q); }
        else { const q = (p - 0.55) / 0.45; x = lerp(10, 0, q); sk = lerp(-4, 0, q); }
        return "translateX(" + x.toFixed(1) + "px) skewX(" + sk.toFixed(2) + "deg)";
      }
      case "host": {                                // horizontal wipe open
        let s = p < 0.6 ? lerp(0.02, 1.03, easeOut(p / 0.6)) : lerp(1.03, 1, (p - 0.6) / 0.4);
        return "scaleX(" + s.toFixed(3) + ")";
      }
      case "raid": {                                // slam from right + recoil
        const pts = [[0,760],[.46,-26],[.58,16],[.68,-10],[.78,6],[.88,-3],[1,0]];
        let x = 0, sc = p < 0.46 ? lerp(1.12, 1, easeOut(p / 0.46)) : 1;
        if (p < 0.46) x = lerp(760, -26, easeOut(p / 0.46));
        else { for (let i = 1; i < pts.length - 1; i++) { if (p >= pts[i][0] && p < pts[i + 1][0]) { x = lerp(pts[i][1], pts[i + 1][1], (p - pts[i][0]) / (pts[i + 1][0] - pts[i][0])); break; } } if (p >= 1) x = 0; }
        return "translateX(" + x.toFixed(1) + "px) scale(" + sc.toFixed(3) + ")";
      }
      case "like": {                                // float up settle
        let y, s;
        if (p < 0.7) { const q = easeOut(p / 0.7); y = lerp(120, -10, q); s = lerp(0.96, 1, q); }
        else { y = lerp(-10, 0, (p - 0.7) / 0.3); s = 1; }
        return "translateY(" + y.toFixed(1) + "px) scale(" + s.toFixed(3) + ")";
      }
      case "share": {                               // push + blur clear
        let x, s;
        if (p < 0.7) { const q = easeOut(p / 0.7); x = lerp(-120, 8, q); s = lerp(0.94, 1, q); }
        else { x = lerp(8, 0, (p - 0.7) / 0.3); s = 1; }
        return "translateX(" + x.toFixed(1) + "px) scale(" + s.toFixed(3) + ")";
      }
      case "star": {                                // vertical roll-down snap
        const pts = [[0,-200],[.20,60],[.40,-30],[.55,40],[.70,-12],[.85,6],[1,0]];
        let y = 0;
        for (let i = 0; i < pts.length - 1; i++) { if (p >= pts[i][0] && p < pts[i + 1][0]) { y = pts[i][1]; break; } }
        if (p >= 1) y = 0;
        return "translateY(" + y.toFixed(1) + "px)";
      }
      case "superchat": {                           // zoom from huge slam down
        let s;
        if (p < 0.55) s = lerp(1.6, 0.96, easeOut(p / 0.55));
        else if (p < 0.78) s = lerp(0.96, 1.02, (p - 0.55) / 0.23);
        else s = lerp(1.02, 1, (p - 0.78) / 0.22);
        return "scale(" + s.toFixed(3) + ")";
      }
      case "supporter": {                           // diagonal flip-in
        let x, y, r;
        if (p < 0.6) { const q = easeOut(p / 0.6); x = lerp(-80, 8, q); y = lerp(80, -6, q); r = lerp(-6, 1.5, q); }
        else { const q = (p - 0.6) / 0.4; x = lerp(8, 0, q); y = lerp(-6, 0, q); r = lerp(1.5, 0, q); }
        return "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + r.toFixed(2) + "deg)";
      }
      case "follower":
      default: {                                    // splice scaleY snap open
        let s;
        if (p < 0.55) s = lerp(0.04, 1.06, easeOut(p / 0.55));
        else if (p < 0.8) s = lerp(1.06, 0.98, (p - 0.55) / 0.25);
        else s = lerp(0.98, 1, (p - 0.8) / 0.2);
        return "scaleY(" + s.toFixed(3) + ")";
      }
    }
  }
  // entrance duration per event (ms) — matches the alerts.css animation lengths
  const ENTER_MS = {
    follower:500, subscriber:560, member:500, cheer:600, donation:620, host:560,
    raid:700, like:580, share:560, star:660, superchat:560, supporter:600,
  };

  let _type = "follower", _cfg = DEFAULT, _rf = 0, _b1 = false, _b2 = false;
  function renderPlay(opts) {
    opts = opts || {};
    _type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[_type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "Viewer");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    populate(_type, name, amountStr);
    card.classList.remove("show", "hide");
    _rf = 0; _b1 = false; _b2 = false; specks = []; tears = [];
  }
  function renderAdvance() {
    const ms = _rf * (1000 / 30);
    const ENTER = ENTER_MS[_type] || 560, HOLD = 4200, EXIT = 440, holdEnd = ENTER + HOLD;
    let tf, op;
    if (ms < ENTER) {                              // entrance (per-event motion)
      const p = clamp01(ms / ENTER);
      tf = entranceTransform(_type, p);
      op = Math.min(1, p / 0.25);
    } else if (ms < holdEnd) {                     // hold
      tf = "none"; op = 1;
    } else {                                       // splice-out (scaleY collapse)
      const p = clamp01((ms - holdEnd) / EXIT);
      const s = p < 0.4 ? lerp(1, 0.06, p / 0.4) : lerp(0.06, 0.02, (p - 0.4) / 0.6);
      const ty = p < 0.4 ? 0 : lerp(0, 8, (p - 0.4) / 0.6);
      tf = "scaleY(" + s.toFixed(3) + ") translateY(" + ty.toFixed(1) + "px)";
      op = 1 - clamp01((p - 0.4) / 0.6);
    }
    if (card) { card.style.transform = tf; card.style.opacity = op.toFixed(3); }
    // underline tape-progress fill (4.6s like the CSS, clamped to the visible window)
    const ubar = card && card.querySelector(".ubar i");
    if (ubar) ubar.style.width = (clamp01(ms / 4600) * 100).toFixed(2) + "%";
    // canvas burst (mirrors live timing)
    if (ms >= 120 && !_b1) { _b1 = true; spawnBurst(_cfg.specks); }
    if (_cfg.specks >= 140 && ms >= 360 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.specks * 0.5)); }
    if (ctx) frame();
    _rf++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // expose the event order for the export driver
  window.__alertEvents = ORDER.slice();

  // kick off the live demo (skipped in render mode)
  if (!render) setTimeout(startDemo, 350);
})();
