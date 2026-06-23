/* ============================================================
   BIT QUEST — alert engine ("16-bit JRPG Menu")
   Exposes window.playAlert({type,name,amount}) with a per-event
   choreography map (12 DISTINCT motions) + copy. Auto-plays a
   looping DEMO on load. Reads ?type=&name=&amount= to override.
   Delta-clamped rAF GOLD-COIN / PIXEL-SPARK burst on a transparent
   canvas (chunky pixel coins + sparks popping from the icon plate).
   ?noname=1 => big headline shows the EVENT label, viewer name hides
               (this is the shipping mode; the alert platform overlays
                the live name).
   ?render=1 => deterministic manual frame-stepping for headless webm
               capture via __renderPlay/__renderAdvance (mirrors the
               CSS entrance per event, no CSS anim / setTimeout / free rAF).
   No audio ships.
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

  /* ---- fit the 1920x1080 stage to the window (guarded, mirrors shared.js) ---- */
  function fit() {
    const iw = window.innerWidth, ih = window.innerHeight;
    if (iw < 10 || ih < 10) return;
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- per-event choreography table ----
     glyph  : blocky pixel symbol shown in the item-icon plate
     kicker : event label (also the headline in noname mode)
     sub    : quiet pixel sub-line (ships EMPTY)
     coins  : how many gold-coin / spark pixels the burst spawns (raid/host bigger)
     amount : true => emphasize the amount line (cheer/donation/superchat...)
     amtPre/amtSuf : decoration for a bare numeric amount
     motion : CSS class suffix .ev-<type> + the deterministic render transform key */
  const EVENTS = {
    follower:   { glyph:"+",  kicker:"NEW FOLLOWER",   sub:"", coins:14, amount:false },
    subscriber: { glyph:"★",  kicker:"NEW SUBSCRIBER", sub:"", coins:18, amount:false },
    member:     { glyph:"◆",  kicker:"NEW MEMBER",     sub:"", coins:18, amount:false },
    cheer:      { glyph:"¢",  kicker:"CHEER",          sub:"", coins:24, amount:true,  amtPre:"", amtSuf:" BITS" },
    donation:   { glyph:"$",  kicker:"DONATION",       sub:"", coins:26, amount:true,  amtPre:"$" },
    host:       { glyph:"»",  kicker:"NOW HOSTING",    sub:"", coins:30, amount:true,  amtPre:"", amtSuf:" PARTY" },
    raid:       { glyph:"!",  kicker:"RAID INBOUND",   sub:"", coins:40, amount:true,  amtPre:"", amtSuf:" RAIDERS" },
    like:       { glyph:"♥",  kicker:"NEW LIKE",       sub:"", coins:14, amount:false },
    share:      { glyph:"→",  kicker:"SHARED",         sub:"", coins:16, amount:false },
    star:       { glyph:"⬆",  kicker:"LEVEL UP",       sub:"", coins:22, amount:true,  amtPre:"", amtSuf:" STARS" },
    superchat:  { glyph:"G",  kicker:"SUPER CHAT",     sub:"", coins:28, amount:true,  amtPre:"$" },
    supporter:  { glyph:"♦",  kicker:"NEW SUPPORTER",  sub:"", coins:18, amount:false },
  };
  const ORDER = ["follower","subscriber","member","cheer","donation","host","raid","like","share","star","superchat","supporter"];
  const DEFAULT = EVENTS.follower;

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

  let hideTimer = null, busy = false, demoOn = false, curType = "follower";

  /* ============================================================
     GOLD-COIN / PIXEL-SPARK burst on a transparent canvas
     (delta-clamped rAF). Chunky pixel gold coins + bright sparks
     pop from the icon plate, arc up under gravity and fade —
     16-bit "treasure get" pixels. Coords rounded so they stay
     crisp under image-rendering:pixelated.
     ============================================================ */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const GOLD = ["#FFCB47", "#FFE89A", "#C9881C", "#FFFFFF"];
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the icon plate (lower-left of the stage)
  function spawnBurst(n) {
    const ox = 162, oy = H - 206;
    for (let i = 0; i < n; i++) {
      const ang = R(-Math.PI * 0.95, -Math.PI * 0.05), sp = R(80, 320) / 60; // mostly upward fan
      burst.push({
        x: ox + R(-26, 26), y: oy + R(-26, 26),
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        g: R(140, 230) / 3600,                       // gravity per frame-ish
        s: Math.max(4, Math.round(R(5, 11))),        // chunky pixel size
        rot: 0, vr: 0,
        a: 1, life: R(1.2, 2.2),
        coin: Math.random() < 0.62,                  // gold coin square vs bright spark
        c: GOLD[(Math.random() * GOLD.length) | 0],
      });
    }
  }

  // a chunky pixel gold coin (square w/ inner highlight) or a small bright spark
  function drawMote(p) {
    const x = Math.round(p.x), y = Math.round(p.y), s = p.s;
    ctx.globalAlpha = Math.max(0, p.a);
    if (p.coin) {
      // coin body
      ctx.fillStyle = p.c;
      ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s);
      // dark pixel keyline + inner highlight (sells the 16-bit coin)
      ctx.fillStyle = "#150B2E";
      ctx.fillRect(x - (s >> 1), y + (s >> 1) - 2, s, 2);
      ctx.fillStyle = "#FFF6CC";
      ctx.fillRect(x - (s >> 1) + 1, y - (s >> 1) + 1, Math.max(2, s >> 2), Math.max(2, s >> 2));
    } else {
      // bright spark: a small plus of pixels
      const h = Math.max(2, s >> 1);
      ctx.fillStyle = p.c;
      ctx.fillRect(x - (h >> 1), y - (h >> 1) - 2, h, h + 4);
      ctx.fillRect(x - (h >> 1) - 2, y - (h >> 1), h + 4, h);
    }
    ctx.globalAlpha = 1;
  }

  function frame() {
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 60) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1;
  }
  window.__bitAlertDraw = frame; // rAF-independent verification hook

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

  /* ---- populate the card DOM for a given event ---- */
  function populate(type, name, amountStr) {
    const cfg = EVENTS[type] || DEFAULT;
    if (glyphEl) glyphEl.textContent = cfg.glyph;
    const kickLine = card ? card.querySelector(".kick") : null;
    if (noname) {
      // shipping mode: headline shows the EVENT; viewer name hidden
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

  /* ---- play(): drive one alert through its choreography (live mode) ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "Player1";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true; curType = type;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    populate(type, name, amountStr);

    // restart entrance: clear all event/state classes then re-add the matching one
    card.classList.remove("hide", "show");
    for (const k of ORDER) card.classList.remove("ev-" + k);
    void card.offsetWidth;                          // force reflow so the anim replays
    card.classList.add("ev-" + type, "show");

    // gold-coin burst (staggered so it reads after the entrance)
    setTimeout(() => spawnBurst(cfg.coins), 200);
    if (cfg.coins >= 26) setTimeout(() => spawnBurst(Math.round(cfg.coins * 0.6)), 560);

    // hold, then exit
    const HOLD = 4000;
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

  /* ---- auto DEMO on load: play once, then self-chains ---- */
  function demoData() {
    const t = pageType();
    return {
      type: t,
      name: params.get("name") || "Player1",
      amount: params.get("amount") != null ? params.get("amount") : "500",
    };
  }
  function startDemo() { demoOn = true; play(demoData()); }

  /* ============================================================
     DETERMINISTIC RENDER MODE
     Mirror each event's CSS entrance as a transform(ms) function so
     the headless pipeline reproduces the exact distinct motion.
     ============================================================ */
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  // piecewise-linear keyframe interpolation over a duration (ms)
  function kf(ms, dur, stops) {
    const t = clamp01(ms / dur);
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i];
        const seg = (t - a[0]) / (b[0] - a[0] || 1);
        const e = easeOut(seg);
        return a[1] + (b[1] - a[1]) * e;
      }
    }
    return stops[stops.length - 1][1];
  }

  // each motion returns a CSS transform string + opacity for a given ms.
  // values mirror the @keyframes in alerts.css (12 distinct motions).
  const MOTIONS = {
    follower(ms, d){ const y=kf(ms,d,[[0,22],[.62,-6],[1,0]]); const s=kf(ms,d,[[0,.6],[.62,1.05],[1,1]]); return {t:`translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.5)),org:"18% 100%"}; },
    subscriber(ms,d){ const sy=kf(ms,d,[[0,.06],[.58,1.04],[1,1]]); return {t:`scaleY(${sy.toFixed(3)})`,o:clamp01(ms/(d*.5)),org:"50% 0%"}; },
    member(ms,d){ const x=kf(ms,d,[[0,-160],[.72,14],[1,0]]); return {t:`translateX(${x.toFixed(1)}px)`,o:clamp01(ms/(d*.45))}; },
    cheer(ms,d){ const y=kf(ms,d,[[0,46],[.52,-12],[.78,4],[1,0]]); const s=kf(ms,d,[[0,.9],[.52,1.05],[1,1]]); return {t:`translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.45)),org:"18% 100%"}; },
    donation(ms,d){ const y=kf(ms,d,[[0,-110],[.58,16],[.78,-7],[1,0]]); const s=kf(ms,d,[[0,1.02],[.58,1],[1,1]]); return {t:`translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.5))}; },
    host(ms,d){ const sx=kf(ms,d,[[0,.1],[.6,1.03],[1,1]]); return {t:`scaleX(${sx.toFixed(3)})`,o:clamp01(ms/(d*.4)),org:"0% 50%"}; },
    raid(ms,d){ const x=kf(ms,d,[[0,-300],[.52,28],[.68,-14],[.82,8],[.92,-4],[1,0]]); const s=kf(ms,d,[[0,1.05],[.52,1.02],[1,1]]); return {t:`translateX(${x.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.4))}; },
    like(ms,d){ const s=kf(ms,d,[[0,.82],[.6,1.06],[1,1]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.45)),org:"18% 50%"}; },
    share(ms,d){ const x=kf(ms,d,[[0,-150],[.7,10],[1,0]]); const sk=kf(ms,d,[[0,-10],[.7,3],[1,0]]); return {t:`translateX(${x.toFixed(1)}px) skewX(${sk.toFixed(2)}deg)`,o:clamp01(ms/(d*.45))}; },
    star(ms,d){ const y=kf(ms,d,[[0,-80],[.62,9],[1,0]]); const rz=kf(ms,d,[[0,-5],[.62,2],[1,0]]); return {t:`translateY(${y.toFixed(1)}px) rotate(${rz.toFixed(2)}deg)`,o:clamp01(ms/(d*.5)),org:"18% 20%"}; },
    superchat(ms,d){ const s=kf(ms,d,[[0,1.4],[.58,.96],[1,1]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.5)),org:"18% 50%"}; },
    supporter(ms,d){ const y=kf(ms,d,[[0,60],[.66,-6],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5))}; },
  };
  const ENTER = { follower:600, subscriber:680, member:580, cheer:560, donation:740, host:660, raid:820, like:600, share:580, star:700, superchat:700, supporter:680 };

  let _cfg = DEFAULT, _type = "follower", _f = 0, _b1 = false, _b2 = false;
  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _type = type; _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "Player1");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    populate(type, name, amountStr);
    card.classList.remove("show", "hide");
    for (const k of ORDER) card.classList.remove("ev-" + k);
    _f = 0; _b1 = false; _b2 = false; burst = [];
  }
  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const enter = ENTER[_type] || 600, HOLD = 4000, EXIT = 440, holdEnd = enter + HOLD;
    let st;
    if (ms < holdEnd) {
      // entrance + hold (motion settles to identity by `enter`)
      st = (MOTIONS[_type] || MOTIONS.follower)(ms, enter);
    } else {
      // exit: drop + fade (mirrors @keyframes alert-out)
      const p = clamp01((ms - holdEnd) / EXIT);
      const y = 26 * easeOut(p), s = 1 - 0.03 * easeOut(p);
      st = { t: `translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`, o: 1 - p };
    }
    if (card) {
      card.style.transformOrigin = st.org || "50% 50%";
      card.style.transform = st.t;
      card.style.opacity = (st.o).toFixed(3);
    }
    // icon glyph pop (delayed ~140ms, shared by all)
    const glyph = card && card.querySelector(".glyph");
    if (glyph) {
      const gp = clamp01((ms - 140) / 560);
      const gs = gp <= 0 ? 0.4 : (gp < 0.6 ? 0.4 + (gp / 0.6) * 0.76 : 1.16 - ((gp - 0.6) / 0.4) * 0.16);
      glyph.style.transform = `scale(${Math.max(0, gs).toFixed(3)})`;
      glyph.style.opacity = gp <= 0 ? "0" : "1";
    }
    // bursts staggered like live mode
    if (ms >= 200 && !_b1) { _b1 = true; spawnBurst(_cfg.coins); }
    if (_cfg.coins >= 26 && ms >= 560 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.coins * 0.6)); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo (skipped in render mode)
  if (!render) setTimeout(startDemo, 360);
})();
