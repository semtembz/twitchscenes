/* ============================================================
   COIN RIOT — alert engine ("Insert Coin")
   Exposes window.playAlert({type,name,amount}) with a per-event
   choreography map (12 DISTINCT motions) + copy. Auto-plays a
   looping DEMO on load. Reads ?type=&name=&amount= to override.
   Delta-clamped rAF COIN-SPARKLE burst on a transparent canvas
   (spinning coin chips + 4-point glints bursting from the token).
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
     glyph  : symbol shown on the spinning $-coin token
     kicker : arcade-caps event label (also the headline in noname mode)
     sub    : quiet mono sub-line (ships "" — no flavor text)
     sparks : how many coin-sparkle chips the burst spawns (raid/host bigger)
     amount : true => emphasize the amount line (cheer/donation/superchat...)
     amtPre/amtSuf : decoration for a bare numeric amount */
  const EVENTS = {
    follower:   { glyph:"$", kicker:"NEW FOLLOWER",   sub:"", sparks:14, amount:false },
    subscriber: { glyph:"★", kicker:"NEW SUBSCRIBER", sub:"", sparks:18, amount:false },
    member:     { glyph:"◆", kicker:"NEW MEMBER",     sub:"", sparks:18, amount:false },
    cheer:      { glyph:"¢", kicker:"CHEER",          sub:"", sparks:22, amount:true,  amtPre:"", amtSuf:" BITS" },
    donation:   { glyph:"$", kicker:"DONATION",       sub:"", sparks:24, amount:true,  amtPre:"$" },
    host:       { glyph:"►", kicker:"NOW HOSTING",    sub:"", sparks:28, amount:true,  amtPre:"", amtSuf:" VIEWERS" },
    raid:       { glyph:"⚑", kicker:"RAID INCOMING",  sub:"", sparks:40, amount:true,  amtPre:"", amtSuf:" RAIDERS" },
    like:       { glyph:"♥", kicker:"NEW LIKE",       sub:"", sparks:14, amount:false },
    share:      { glyph:"➤", kicker:"SHARED",         sub:"", sparks:16, amount:false },
    star:       { glyph:"✦", kicker:"NEW STAR",       sub:"", sparks:20, amount:true,  amtPre:"", amtSuf:" STARS" },
    superchat:  { glyph:"$", kicker:"SUPER CHAT",     sub:"", sparks:26, amount:true,  amtPre:"$" },
    supporter:  { glyph:"✪", kicker:"NEW SUPPORTER",  sub:"", sparks:22, amount:false },
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

  let hideTimer = null, busy = false, demoOn = false;

  /* ============================================================
     COIN-SPARKLE burst on a transparent canvas (delta-clamped rAF).
     Spinning coin chips (squashed ellipses) + 4-point glints burst
     from the token plate, fly out + tumble + fade.
     ============================================================ */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const COINS = ["#FFD400", "#FF3B3B", "#16E0FF", "#7D00FF", "#FFFFFF"];
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the token plate (lower-left of the stage)
  function spawnBurst(n) {
    const ox = 210, oy = H - 200;
    for (let i = 0; i < n; i++) {
      const ang = R(-Math.PI, Math.PI), sp = R(40, 250) / 60;
      burst.push({
        x: ox + R(-34, 34), y: oy + R(-34, 34),
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - R(0.4, 1.6),
        g: R(50, 120) / 3600,
        s: R(4, 11), rot: R(0, 6.28), vr: R(-5, 5) / 60,
        a: 1, life: R(1.1, 2.2),
        coin: Math.random() < 0.5,
        c: COINS[(Math.random() * COINS.length) | 0],
      });
    }
  }

  // a spinning coin chip (squashed ellipse) or a 4-point sparkle glint
  function drawMote(p) {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.a);
    ctx.shadowColor = p.c; ctx.shadowBlur = 12;
    if (p.coin) {
      const sx = Math.abs(Math.cos(p.rot * 1.4)) * 0.85 + 0.15;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.ellipse(0, 0, p.s * sx, p.s, 0, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = Math.max(0, p.a) * 0.5; ctx.fillStyle = "#FFFFFF";
      ctx.beginPath(); ctx.ellipse(-p.s * 0.2 * sx, -p.s * 0.25, p.s * 0.3 * sx, p.s * 0.3, 0, 0, 6.2832); ctx.fill();
    } else {
      ctx.fillStyle = p.c;
      const a = p.s, b = p.s * 0.32;
      ctx.beginPath();
      ctx.moveTo(0, -a); ctx.lineTo(b, -b); ctx.lineTo(a, 0); ctx.lineTo(b, b);
      ctx.lineTo(0, a); ctx.lineTo(-b, b); ctx.lineTo(-a, 0); ctx.lineTo(-b, -b);
      ctx.closePath(); ctx.fill();
    }
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
  window.__coinAlertDraw = frame; // rAF-independent verification hook

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
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "Player";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    populate(type, name, amountStr);

    // restart entrance: clear all event/state classes then re-add the matching one
    card.classList.remove("hide", "show");
    for (const k of ORDER) card.classList.remove("ev-" + k);
    void card.offsetWidth;                          // force reflow so the anim replays
    card.classList.add("ev-" + type, "show");

    // coin-sparkle burst (staggered so it reads after the entrance)
    setTimeout(() => spawnBurst(cfg.sparks), 200);
    if (cfg.sparks >= 28) setTimeout(() => spawnBurst(Math.round(cfg.sparks * 0.6)), 560);

    // hold, then exit
    const HOLD = 4000;
    hideTimer = setTimeout(() => {
      card.classList.remove("show");
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1500);
      }, 480);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then self-chains ---- */
  function demoData() {
    const t = pageType();
    return {
      type: t,
      name: params.get("name") || "Player",
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
  // piecewise keyframe interpolation over a duration (ms)
  function kf(ms, dur, stops) {
    const t = clamp01(ms / dur);
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i];
        const seg = (t - a[0]) / (b[0] - a[0] || 1);
        return a[1] + (b[1] - a[1]) * easeOut(seg);
      }
    }
    return stops[stops.length - 1][1];
  }

  // each motion returns a CSS transform string + opacity for a given ms.
  // values mirror the @keyframes in alerts.css.
  const MOTIONS = {
    follower(ms, d){ const y=kf(ms,d,[[0,70],[.7,-8],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5))}; },
    subscriber(ms,d){ const sx=kf(ms,d,[[0,.2],[.6,1.04],[1,1]]); const s=kf(ms,d,[[0,.7],[.6,1.02],[1,1]]); return {t:`scaleX(${sx.toFixed(3)}) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.55)),org:"16% 50%"}; },
    member(ms,d){ const x=kf(ms,d,[[0,-160],[.72,16],[1,0]]); return {t:`translateX(${x.toFixed(1)}px)`,o:clamp01(ms/(d*.45))}; },
    cheer(ms,d){ const y=kf(ms,d,[[0,44],[.55,-12],[1,0]]); const s=kf(ms,d,[[0,.88],[.55,1.05],[1,1]]); return {t:`translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.45)),org:"16% 80%"}; },
    donation(ms,d){ const y=kf(ms,d,[[0,-96],[.6,14],[.82,-6],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5))}; },
    host(ms,d){ const sx=kf(ms,d,[[0,.12],[.6,1.02],[1,1]]); return {t:`scaleX(${sx.toFixed(3)})`,o:clamp01(ms/(d*.4)),org:"0% 50%"}; },
    raid(ms,d){ const x=kf(ms,d,[[0,-280],[.55,28],[.72,-12],[.86,7],[1,0]]); const s=kf(ms,d,[[0,1.05],[.55,1.02],[1,1]]); return {t:`translateX(${x.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.4))}; },
    like(ms,d){ const s=kf(ms,d,[[0,.82],[.6,1.06],[1,1]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.45)),org:"16% 50%"}; },
    share(ms,d){ const x=kf(ms,d,[[0,-130],[.7,9],[1,0]]); const sk=kf(ms,d,[[0,-9],[.7,2],[1,0]]); return {t:`translateX(${x.toFixed(1)}px) skewX(${sk.toFixed(2)}deg)`,o:clamp01(ms/(d*.45))}; },
    star(ms,d){ const y=kf(ms,d,[[0,-72],[.62,9],[1,0]]); const rz=kf(ms,d,[[0,-4],[.62,1.5],[1,0]]); return {t:`translateY(${y.toFixed(1)}px) rotate(${rz.toFixed(2)}deg)`,o:clamp01(ms/(d*.5)),org:"16% 30%"}; },
    superchat(ms,d){ const s=kf(ms,d,[[0,1.38],[.6,.97],[1,1]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.5)),org:"16% 50%"}; },
    supporter(ms,d){ const y=kf(ms,d,[[0,58],[.6,-6],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5))}; },
  };
  const ENTER = { follower:660, subscriber:720, member:600, cheer:580, donation:760, host:680, raid:800, like:620, share:600, star:720, superchat:700, supporter:700 };

  let _cfg = DEFAULT, _type = "follower", _f = 0, _b1 = false, _b2 = false;
  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _type = type; _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "Player");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    populate(type, name, amountStr);
    card.classList.remove("show", "hide");
    for (const k of ORDER) card.classList.remove("ev-" + k);
    _f = 0; _b1 = false; _b2 = false; burst = [];
  }
  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const enter = ENTER[_type] || 660, HOLD = 4000, EXIT = 480, holdEnd = enter + HOLD;
    let st;
    if (ms < holdEnd) {
      st = (MOTIONS[_type] || MOTIONS.follower)(ms, enter);
    } else {
      const p = clamp01((ms - holdEnd) / EXIT);
      const x = -60 * easeOut(p), s = 1 - 0.015 * easeOut(p);
      st = { t: `translateX(${x.toFixed(1)}px) scale(${s.toFixed(3)})`, o: 1 - p };
    }
    if (card) {
      card.style.transformOrigin = st.org || "50% 50%";
      card.style.transform = st.t;
      card.style.opacity = (st.o).toFixed(3);
    }
    // bursts staggered like live mode
    if (ms >= 200 && !_b1) { _b1 = true; spawnBurst(_cfg.sparks); }
    if (_cfg.sparks >= 28 && ms >= 560 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.sparks * 0.6)); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo (skipped in render mode)
  if (!render) setTimeout(startDemo, 360);
})();
