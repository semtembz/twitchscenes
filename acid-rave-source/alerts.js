/* ============================================================
   ACID RAVE — alert engine ("UV Blacklight")
   Exposes window.playAlert({type,name,amount}) with a per-event
   choreography map (12 DISTINCT motions) + copy. Auto-plays a
   looping DEMO on load. Reads ?type=&name=&amount= to override.
   Delta-clamped rAF NEON-SPARK burst on a transparent canvas
   (acid/magenta/cyan glow sparks + laser shards flung from the node).
   ?noname=1 => big headline shows the EVENT label, viewer name hides
               (this is the shipping mode; the alert platform overlays
                the live viewer name).
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
     glyph  : heavy display symbol shown in the hexagonal neon node
     kicker : the acid-pill event label (also the headline in noname mode)
     sub    : quiet condensed-mono sub-line (ships EMPTY by design)
     sparks : how many neon sparks the burst spawns (raid/host bigger)
     amount : true => emphasize the amount line (cheer/donation/superchat...)
     amtPre/amtSuf : decoration for a bare numeric amount */
  const EVENTS = {
    follower:   { glyph:"+",  kicker:"NEW FOLLOWER",   sub:"", sparks:14, amount:false },
    subscriber: { glyph:"✦",  kicker:"NEW SUBSCRIBER", sub:"", sparks:20, amount:false },
    member:     { glyph:"◆",  kicker:"NEW MEMBER",     sub:"", sparks:20, amount:false },
    cheer:      { glyph:"≈",  kicker:"CHEER",          sub:"", sparks:24, amount:true,  amtPre:"", amtSuf:" BITS" },
    donation:   { glyph:"❤",  kicker:"DONATION",       sub:"", sparks:26, amount:true,  amtPre:"$" },
    host:       { glyph:"»",  kicker:"NOW HOSTING",    sub:"", sparks:30, amount:true,  amtPre:"", amtSuf:" VIEWERS" },
    raid:       { glyph:"⚡", kicker:"RAID INBOUND",   sub:"", sparks:46, amount:true,  amtPre:"", amtSuf:" RAIDERS" },
    like:       { glyph:"♥",  kicker:"NEW LIKE",       sub:"", sparks:14, amount:false },
    share:      { glyph:"➤",  kicker:"SHARED",         sub:"", sparks:18, amount:false },
    star:       { glyph:"★",  kicker:"NEW STAR",       sub:"", sparks:22, amount:true,  amtPre:"", amtSuf:" STARS" },
    superchat:  { glyph:"✸",  kicker:"SUPER CHAT",     sub:"", sparks:28, amount:true,  amtPre:"$" },
    supporter:  { glyph:"✪",  kicker:"NEW SUPPORTER",  sub:"", sparks:22, amount:false },
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
  const nameEl = $id("name-txt");
  const ghostC = $id("ghost-c");
  const ghostM = $id("ghost-m");
  const amountEl = $id("amount");
  const subEl = $id("sub");

  let hideTimer = null, busy = false, demoOn = false, curType = "follower";

  /* ============================================================
     NEON-SPARK burst on a transparent canvas (delta-clamped rAF).
     Acid/magenta/cyan/purple glow sparks + thin laser shards are
     flung outward from the glyph node, drift and fade — like UV
     confetti popping off the strobe card. Additive 'lighter' blend.
     ============================================================ */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const NEON = ["#C6FF00", "#FF14C8", "#00E5FF", "#B26BFF", "#FFFFFF"];
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the glyph node (lower-left of the stage)
  function spawnBurst(n) {
    const ox = 168, oy = H - 204;
    for (let i = 0; i < n; i++) {
      const ang = R(-Math.PI, Math.PI), sp = R(60, 320) / 60;
      burst.push({
        x: ox + R(-28, 28), y: oy + R(-28, 28),
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - R(0.6, 1.8),
        g: R(60, 150) / 3600,
        s: R(3, 9), rot: R(0, 6.28), vr: R(-4, 4) / 60,
        a: 1, life: R(1.0, 2.0),
        streak: Math.random() < 0.4,                 // laser shard vs glow spark
        c: NEON[(Math.random() * NEON.length) | 0],
      });
    }
  }

  // a glowing neon spark (or a thin laser shard streaking along its velocity)
  function drawMote(p) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.max(0, p.a);
    ctx.fillStyle = p.c; ctx.strokeStyle = p.c;
    ctx.shadowColor = p.c; ctx.shadowBlur = 12;
    if (p.streak) {
      // a thin laser shard drawn along its direction of travel
      const len = Math.min(26, 6 + Math.hypot(p.vx, p.vy) * 5);
      const m = Math.hypot(p.vx, p.vy) || 1;
      const ux = p.vx / m, uy = p.vy / m;
      ctx.lineWidth = 2.4; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x - ux * len, p.y - uy * len);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s * 0.5, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr;
      p.vx *= 0.98; p.vy *= 0.98;                   // drag — sparks slow + settle
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 60) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.globalCompositeOperation = "source-over";
  }
  window.__acidAlertDraw = frame; // rAF-independent verification hook

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
  function setName(text) {
    if (nameEl) nameEl.textContent = text;
    if (ghostC) ghostC.textContent = text;       // RGB-split clones mirror the name
    if (ghostM) ghostM.textContent = text;
  }
  function populate(type, name, amountStr) {
    const cfg = EVENTS[type] || DEFAULT;
    if (glyphEl) glyphEl.textContent = cfg.glyph;
    const kickLine = card ? card.querySelector(".kick") : null;
    if (noname) {
      // shipping mode: headline shows the EVENT; viewer name hidden
      if (kickLine) kickLine.style.display = "none";
      setName(cfg.kicker);
    } else {
      if (kickLine) kickLine.style.display = "";
      if (kickEl) kickEl.textContent = cfg.kicker;
      setName(name);
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
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "Raver";
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

    // neon-spark burst (staggered so it reads after the entrance)
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
      name: params.get("name") || "Raver",
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
        return a[1] + (b[1] - a[1]) * easeOut(seg);
      }
    }
    return stops[stops.length - 1][1];
  }

  // each motion returns a CSS transform string + opacity (+ origin/filter) for
  // a given ms. values mirror the @keyframes in alerts.css.
  const MOTIONS = {
    follower(ms, d){ const y=kf(ms,d,[[0,64],[.72,-8],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5))}; },
    subscriber(ms,d){ const s=kf(ms,d,[[0,.62],[1,1]]); const bl=kf(ms,d,[[0,9],[.6,0],[1,0]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.55)),f:`blur(${bl.toFixed(2)}px)`,org:"16% 50%"}; },
    member(ms,d){ const x=kf(ms,d,[[0,-150],[.72,16],[1,0]]); return {t:`translateX(${x.toFixed(1)}px)`,o:clamp01(ms/(d*.45))}; },
    cheer(ms,d){ const y=kf(ms,d,[[0,44],[.54,-12],[1,0]]); const s=kf(ms,d,[[0,.88],[.54,1.05],[1,1]]); return {t:`translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.45)),org:"16% 84%"}; },
    donation(ms,d){ const y=kf(ms,d,[[0,-96],[.6,13],[.82,-6],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5))}; },
    host(ms,d){ const sx=kf(ms,d,[[0,.1],[.6,1.02],[1,1]]); return {t:`scaleX(${sx.toFixed(3)})`,o:clamp01(ms/(d*.4)),org:"0% 50%"}; },
    raid(ms,d){ const x=kf(ms,d,[[0,-280],[.55,28],[.72,-13],[.86,7],[1,0]]); const s=kf(ms,d,[[0,1.05],[.55,1.02],[1,1]]); return {t:`translateX(${x.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.4))}; },
    like(ms,d){ const s=kf(ms,d,[[0,.82],[.6,1.06],[1,1]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.45)),org:"16% 50%"}; },
    share(ms,d){ const x=kf(ms,d,[[0,-130],[.7,9],[1,0]]); const sk=kf(ms,d,[[0,-10],[.7,2],[1,0]]); return {t:`translateX(${x.toFixed(1)}px) skewX(${sk.toFixed(2)}deg)`,o:clamp01(ms/(d*.45))}; },
    star(ms,d){ const y=kf(ms,d,[[0,-74],[.62,9],[1,0]]); const rz=kf(ms,d,[[0,-5],[.62,1.6],[1,0]]); return {t:`translateY(${y.toFixed(1)}px) rotate(${rz.toFixed(2)}deg)`,o:clamp01(ms/(d*.5)),org:"16% 30%"}; },
    superchat(ms,d){ const s=kf(ms,d,[[0,1.38],[.6,.97],[1,1]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.5)),org:"16% 50%"}; },
    supporter(ms,d){ const y=kf(ms,d,[[0,56],[1,0]]); const bl=kf(ms,d,[[0,7],[.6,0],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5)),f:`blur(${bl.toFixed(2)}px)`}; },
  };
  const ENTER = { follower:660, subscriber:720, member:600, cheer:580, donation:760, host:680, raid:800, like:620, share:600, star:720, superchat:700, supporter:700 };

  let _cfg = DEFAULT, _type = "follower", _f = 0, _b1 = false, _b2 = false;
  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _type = type; _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "Raver");
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
      // entrance + hold (motion settles to identity by `enter`)
      st = (MOTIONS[_type] || MOTIONS.follower)(ms, enter);
    } else {
      // exit: fade + small drop (mirrors @keyframes alert-out)
      const p = clamp01((ms - holdEnd) / EXIT);
      const y = 18 * easeOut(p), s = 1 - 0.015 * easeOut(p);
      st = { t: `translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`, o: 1 - p };
    }
    if (card) {
      card.style.transformOrigin = st.org || "50% 50%";
      card.style.transform = st.t;
      card.style.opacity = (st.o).toFixed(3);
      card.style.filter = st.f || "none";
    }
    // glyph node pop (delayed ~140ms, shared by all)
    const glyph = card && card.querySelector(".glyph");
    if (glyph) {
      const gp = clamp01((ms - 140) / 600);
      const gs = gp <= 0 ? 0.5 : (gp < 0.6 ? 0.5 + (gp / 0.6) * 0.66 : 1.16 - ((gp - 0.6) / 0.4) * 0.16);
      glyph.style.transform = `scale(${Math.max(0, gs).toFixed(3)})`;
      glyph.style.opacity = gp <= 0 ? "0" : "1";
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
