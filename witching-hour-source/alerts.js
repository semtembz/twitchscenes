/* ============================================================
   WITCHING HOUR — alert engine ("The Summons Card")
   Exposes window.playAlert({type,name,amount}) with a per-event
   choreography map (12 DISTINCT candlelit motions) + copy. Auto-
   plays a looping DEMO on load. Reads ?type=&name=&amount= to
   override the demo data/event.
   Delta-clamped rAF EMBER burst on a transparent canvas: warm gold
   embers + fine moth-dust motes bloom from the wax-seal sigil, rise
   on candle-air and fade — sparks struck off the flame.
   ?noname=1 => the big headline shows the EVENT label and the viewer
               name is hidden (the shipping mode; the alert platform
               overlays the live name).
   ?render=1 => deterministic manual frame-stepping for headless webm
               capture via __renderPlay/__renderAdvance (mirrors each
               event's CSS entrance, no CSS anim / setTimeout / free rAF).
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
     glyph  : engraved sigil shown on the wax-seal medallion
     kicker : engraved-caps event label (also the headline in noname mode)
     sub    : flavor sub-line — ships EMPTY ("") so the card is clean; the
              streamer can fill it via their alert platform's text layer
     motes  : how many ember/dust motes the burst spawns (raid/host bigger)
     amount : true => emphasize the amount line (cheer/donation/superchat...)
     amtPre/amtSuf : decoration for a bare numeric amount */
  const EVENTS = {
    follower:   { glyph:"❧", kicker:"NEW FOLLOWER",   sub:"", motes:16, amount:false },
    subscriber: { glyph:"✦", kicker:"NEW SUBSCRIBER", sub:"", motes:20, amount:false },
    member:     { glyph:"☾", kicker:"NEW MEMBER",     sub:"", motes:20, amount:false },
    cheer:      { glyph:"✧", kicker:"CHEER",          sub:"", motes:24, amount:true,  amtPre:"", amtSuf:" BITS" },
    donation:   { glyph:"♥", kicker:"DONATION",       sub:"", motes:26, amount:true,  amtPre:"$" },
    host:       { glyph:"☉", kicker:"NOW HOSTING",    sub:"", motes:34, amount:true,  amtPre:"", amtSuf:" GUESTS" },
    raid:       { glyph:"⚔", kicker:"RAID ARRIVING",  sub:"", motes:46, amount:true,  amtPre:"", amtSuf:" RAIDERS" },
    like:       { glyph:"❦", kicker:"NEW LIKE",       sub:"", motes:14, amount:false },
    share:      { glyph:"✉", kicker:"SHARED",         sub:"", motes:18, amount:false },
    star:       { glyph:"★", kicker:"NEW STAR",       sub:"", motes:22, amount:true,  amtPre:"", amtSuf:" STARS" },
    superchat:  { glyph:"✸", kicker:"SUPER CHAT",     sub:"", motes:28, amount:true,  amtPre:"$" },
    supporter:  { glyph:"⚜", kicker:"NEW SUPPORTER",  sub:"", motes:24, amount:false },
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
     EMBER burst on a transparent canvas (delta-clamped rAF).
     Warm gold embers + fine moth-dust motes bloom from the wax-seal
     sigil, drift up on candle-air with a little sway, twinkle and
     fade — sparks struck off the flame.
     ============================================================ */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const EMBER = ["#E7C878", "#C9A24B", "#FFF1C2", "#B98A38"];
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // the wax-seal sigil sits at ~ left 40+padding, vertically centred in the
  // card; the card rests at left:96, bottom:138, height ~218. Sigil centre:
  const SEAL_X = 96 + 40 + 75;          // card-left + pad-left + half-sigil
  const SEAL_Y = H - 138 - 218 / 2;     // card-bottom -> sigil centre y

  function spawnBurst(n) {
    const ox = SEAL_X, oy = SEAL_Y;
    for (let i = 0; i < n; i++) {
      const ang = R(-Math.PI, Math.PI), sp = R(20, 150) / 60;
      burst.push({
        x: ox + R(-22, 22), y: oy + R(-22, 22),
        vx: Math.cos(ang) * sp * 0.7, vy: Math.sin(ang) * sp * 0.5 - R(0.5, 1.8), // biased to rise
        g: -R(8, 26) / 3600,            // gentle negative gravity (buoyant warm air)
        sway: R(0.3, 1.2), ph: R(0, 6.28), phs: R(2, 5) / 60,
        s: R(1.6, 4.2), a: 1, life: R(1.2, 2.4),
        tw: R(0.6, 1.6),
        c: EMBER[(Math.random() * EMBER.length) | 0],
      });
    }
  }

  // a warm ember mote — a soft glowing speck that twinkles
  function drawMote(p) {
    const tw = 0.6 + Math.sin(p.ph * p.tw) * 0.4;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.a) * tw;
    ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 9;
    const s = p.s;
    ctx.beginPath();
    ctx.arc(Math.round(p.x), Math.round(p.y), s, 0, 6.2832);
    ctx.fill();
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.ph += p.phs;
      p.x += p.vx + Math.sin(p.ph) * p.sway * 0.5;
      p.y += p.vy; p.vy += p.g;
      p.vx *= 0.99;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y < -40) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  window.__witchAlertDraw = frame; // rAF-independent verification hook

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
      // shipping mode: the headline shows the EVENT; the viewer name is hidden
      if (kickLine) kickLine.style.display = "none";
      if (nameEl) nameEl.textContent = cfg.kicker;
    } else {
      if (kickLine) kickLine.style.display = "";
      if (kickEl) kickEl.textContent = cfg.kicker;
      if (nameEl) nameEl.textContent = name;
    }
    if (subEl) subEl.textContent = cfg.sub;     // ships EMPTY
    if (amountEl) amountEl.textContent = amountStr;
    if (card) card.classList.toggle("has-amount", !!(cfg.amount && amountStr));
    return cfg;
  }

  /* ---- play(): drive one alert through its choreography (live mode) ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "Wanderer";
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

    // ember burst (staggered so it reads after the entrance kindles)
    setTimeout(() => spawnBurst(cfg.motes), 220);
    if (cfg.motes >= 30) setTimeout(() => spawnBurst(Math.round(cfg.motes * 0.6)), 600);

    // hold, then exit
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show");
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1600);
      }, 500);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then self-chains ---- */
  function demoData() {
    const t = pageType();
    return {
      type: t,
      name: params.get("name") || "Wanderer",
      amount: params.get("amount") != null ? params.get("amount") : "100",
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
  // piecewise keyframe interpolation over a duration (ms), eased per segment
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
  // values mirror the @keyframes in alerts.css (1:1 with the live look).
  const MOTIONS = {
    follower(ms,d){ const y=kf(ms,d,[[0,64],[.7,-8],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5))}; },
    subscriber(ms,d){ const s=kf(ms,d,[[0,.62],[1,1]]); const bl=kf(ms,d,[[0,9],[.6,0],[1,0]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.55)),f:`blur(${bl.toFixed(2)}px)`,org:"18% 64%"}; },
    member(ms,d){ const x=kf(ms,d,[[0,-150],[.72,14],[1,0]]); return {t:`translateX(${x.toFixed(1)}px)`,o:clamp01(ms/(d*.45))}; },
    cheer(ms,d){ const y=kf(ms,d,[[0,38],[.52,-11],[1,0]]); const s=kf(ms,d,[[0,.9],[.52,1.05],[1,1]]); return {t:`translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.45)),org:"18% 86%"}; },
    donation(ms,d){ const y=kf(ms,d,[[0,-94],[.6,12],[.82,-5],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5))}; },
    host(ms,d){ const ry=kf(ms,d,[[0,-62],[.62,7],[1,0]]); return {t:`perspective(1400px) rotateY(${ry.toFixed(2)}deg)`,o:clamp01(ms/(d*.4)),org:"0% 50%"}; },
    raid(ms,d){ const x=kf(ms,d,[[0,-280],[.54,28],[.72,-13],[.86,6],[1,0]]); const s=kf(ms,d,[[0,1.04],[.54,1.02],[1,1]]); return {t:`translateX(${x.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.4))}; },
    like(ms,d){ const s=kf(ms,d,[[0,.84],[.6,1.05],[1,1]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.45)),org:"18% 50%"}; },
    share(ms,d){ const x=kf(ms,d,[[0,-128],[.7,8],[1,0]]); const sk=kf(ms,d,[[0,-9],[.7,2],[1,0]]); return {t:`translateX(${x.toFixed(1)}px) skewX(${sk.toFixed(2)}deg)`,o:clamp01(ms/(d*.45))}; },
    star(ms,d){ const y=kf(ms,d,[[0,-72],[.62,8],[1,0]]); const rz=kf(ms,d,[[0,-4.5],[.62,1.6],[1,0]]); return {t:`translateY(${y.toFixed(1)}px) rotate(${rz.toFixed(2)}deg)`,o:clamp01(ms/(d*.5)),org:"18% 30%"}; },
    superchat(ms,d){ const s=kf(ms,d,[[0,1.36],[.6,.97],[1,1]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.5)),org:"18% 50%"}; },
    supporter(ms,d){ const y=kf(ms,d,[[0,56],[1,0]]); const bl=kf(ms,d,[[0,7],[.6,0],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5)),f:`blur(${bl.toFixed(2)}px)`}; },
  };
  const ENTER = { follower:720, subscriber:800, member:640, cheer:600, donation:820, host:760, raid:860, like:660, share:640, star:760, superchat:740, supporter:760 };

  let _cfg = DEFAULT, _type = "follower", _f = 0, _b1 = false, _b2 = false;
  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _type = type; _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "Wanderer");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    populate(type, name, amountStr);
    card.classList.remove("show", "hide");
    for (const k of ORDER) card.classList.remove("ev-" + k);
    _f = 0; _b1 = false; _b2 = false; burst = [];
  }
  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const enter = ENTER[_type] || 720, HOLD = 4200, EXIT = 500, holdEnd = enter + HOLD;
    let st;
    if (ms < holdEnd) {
      // entrance + hold (motion settles to identity by `enter`)
      st = (MOTIONS[_type] || MOTIONS.follower)(ms, enter);
    } else {
      // exit: fade + small sink (mirrors @keyframes alert-out)
      const p = clamp01((ms - holdEnd) / EXIT);
      const y = 26 * easeOut(p), s = 1 - 0.015 * easeOut(p);
      st = { t: `translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`, o: 1 - p };
    }
    if (card) {
      card.style.transformOrigin = st.org || "50% 50%";
      card.style.transform = st.t;
      card.style.opacity = (st.o).toFixed(3);
      card.style.filter = st.f || "none";
    }
    // wax-seal glyph kindles in (delayed ~160ms, shared by all)
    const glyph = card && card.querySelector(".glyph");
    if (glyph) {
      const gp = clamp01((ms - 160) / 660);
      const gs = gp <= 0 ? 0.42 : (gp < 0.6 ? 0.42 + (gp / 0.6) * 0.72 : 1.14 - ((gp - 0.6) / 0.4) * 0.14);
      glyph.style.transform = `scale(${Math.max(0, gs).toFixed(3)})`;
      glyph.style.opacity = gp <= 0 ? "0" : "1";
    }
    // ember bursts staggered like live mode
    if (ms >= 220 && !_b1) { _b1 = true; spawnBurst(_cfg.motes); }
    if (_cfg.motes >= 30 && ms >= 600 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.motes * 0.6)); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo (skipped in render mode)
  if (!render) setTimeout(startDemo, 380);
})();
