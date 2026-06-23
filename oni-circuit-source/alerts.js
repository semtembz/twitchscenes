/* ============================================================
   ONI CIRCUIT — alert engine ("Cyber-Samurai Hannya")
   Exposes window.playAlert({type,name,amount}) with a per-event
   choreography map (12 DISTINCT motions) + copy. Auto-plays a
   looping DEMO on load. Reads ?type=&name=&amount= to override.
   Delta-clamped rAF EMBER / SPARK burst on a transparent canvas
   (oni-red + neon-teal slivers + sparks flung from the mask plate).
   ?noname=1 => big headline shows the EVENT label, viewer name hides
               (this is the shipping mode; the alert platform overlays
                the live name).
   ?render=1 => deterministic manual frame-stepping for headless webm
               capture via __renderPlay/__renderAdvance (mirrors the
               CSS entrance per event; no CSS anim / setTimeout / free rAF).
   No audio ships. Each event's flavor SUB line ships EMPTY by design.
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
     glyph  : symbol shown in the faceted oni-mask plate
     kicker : the FUNCTIONAL event label (also the headline in noname mode)
     sub    : flavor sub-line — ships EMPTY ("") by design (buyer fills via platform)
     sparks : how many ember/spark slivers the burst spawns (raid/host bigger)
     amount : true => emphasize the RED->TEAL amount line (cheer/donation/superchat...)
     amtPre/amtSuf : decoration for a bare numeric amount */
  const EVENTS = {
    follower:   { glyph:"卩", kicker:"NEW FOLLOWER",   sub:"", sparks:14, amount:false },
    subscriber: { glyph:"刃", kicker:"NEW SUBSCRIBER", sub:"", sparks:18, amount:false },
    member:     { glyph:"門", kicker:"NEW MEMBER",     sub:"", sparks:18, amount:false },
    cheer:      { glyph:"光", kicker:"CHEER",          sub:"", sparks:22, amount:true,  amtPre:"", amtSuf:" BITS" },
    donation:   { glyph:"贈", kicker:"DONATION",       sub:"", sparks:24, amount:true,  amtPre:"$" },
    host:       { glyph:"客", kicker:"INCOMING HOST",  sub:"", sparks:28, amount:true,  amtPre:"", amtSuf:" VIEWERS" },
    raid:       { glyph:"襲", kicker:"RAID INBOUND",   sub:"", sparks:40, amount:true,  amtPre:"", amtSuf:" RAIDERS" },
    like:       { glyph:"心", kicker:"NEW LIKE",       sub:"", sparks:14, amount:false },
    share:      { glyph:"伝", kicker:"SHARED",         sub:"", sparks:16, amount:false },
    star:       { glyph:"星", kicker:"NEW STAR",       sub:"", sparks:20, amount:true,  amtPre:"", amtSuf:" STARS" },
    superchat:  { glyph:"雷", kicker:"SUPER CHAT",     sub:"", sparks:26, amount:true,  amtPre:"$" },
    supporter:  { glyph:"援", kicker:"NEW SUPPORTER",  sub:"", sparks:20, amount:false },
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
     EMBER / SPARK burst on a transparent canvas (delta-clamped rAF).
     Sharp oni-red + neon-teal slivers are flung from the mask plate,
     arc out with gravity + drag, and fade — sparks off a struck blade.
     ============================================================ */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const ONI = "#FF2D4B", TEAL = "#16F0C8", LIGHT = "#E8EEF5";
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the mask plate (lower-left of the stage)
  function spawnBurst(n) {
    const ox = 210, oy = H - 218;
    for (let i = 0; i < n; i++) {
      const ang = R(-Math.PI, Math.PI), sp = R(60, 320) / 60;
      const roll = Math.random();
      const c = roll < 0.46 ? ONI : roll < 0.9 ? TEAL : LIGHT;
      burst.push({
        x: ox + R(-34, 34), y: oy + R(-34, 34),
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - R(0.4, 1.6),
        g: R(120, 240) / 3600,
        len: R(6, 18), rot: ang, vr: R(-1.6, 1.6) / 60,
        a: 1, life: R(0.9, 2.0),
        c,
      });
    }
  }

  // a sharp tapering sliver (a flung spark) aligned to its velocity
  function drawMote(p) {
    const ang = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(ang);
    ctx.globalAlpha = Math.max(0, p.a);
    ctx.strokeStyle = p.c; ctx.lineCap = "round";
    ctx.shadowColor = p.c; ctx.shadowBlur = 9;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-p.len, 0);
    ctx.lineTo(p.len * 0.5, 0);
    ctx.stroke();
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr;
      p.vx *= 0.978; p.vy *= 0.978;                 // drag
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 60) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  window.__oniAlertDraw = frame; // rAF-independent verification hook

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
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "Viewer";
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

    // ember/spark burst (staggered so it reads after the entrance)
    setTimeout(() => spawnBurst(cfg.sparks), 200);
    if (cfg.sparks >= 28) setTimeout(() => spawnBurst(Math.round(cfg.sparks * 0.6)), 540);

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
      name: params.get("name") || "Viewer",
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
  // piecewise-linear keyframe interpolation over a duration (ms), eased per segment
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

  // each motion returns a CSS transform string + opacity (+ optional origin) for a
  // given ms. Values mirror the @keyframes in alerts.css.
  const MOTIONS = {
    follower(ms,d){ const y=kf(ms,d,[[0,72],[.7,-9],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5))}; },
    subscriber(ms,d){ const x=kf(ms,d,[[0,-120],[.64,10],[1,0]]); const y=kf(ms,d,[[0,-60],[.64,6],[1,0]]); const sk=kf(ms,d,[[0,-22],[.64,4],[1,0]]); return {t:`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) skewX(${sk.toFixed(2)}deg)`,o:clamp01(ms/(d*.5))}; },
    member(ms,d){ const x=kf(ms,d,[[0,-150],[.72,15],[1,0]]); return {t:`translateX(${x.toFixed(1)}px)`,o:clamp01(ms/(d*.45))}; },
    cheer(ms,d){ const y=kf(ms,d,[[0,42],[.55,-11],[1,0]]); const s=kf(ms,d,[[0,.9],[.55,1.05],[1,1]]); return {t:`translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.45)),org:"16% 82%"}; },
    donation(ms,d){ const y=kf(ms,d,[[0,-96],[.6,13],[.82,-6],[1,0]]); return {t:`translateY(${y.toFixed(1)}px)`,o:clamp01(ms/(d*.5))}; },
    host(ms,d){ const sx=kf(ms,d,[[0,.1],[.6,1.03],[1,1]]); return {t:`scaleX(${sx.toFixed(3)})`,o:clamp01(ms/(d*.4)),org:"0% 50%"}; },
    raid(ms,d){ const x=kf(ms,d,[[0,-280],[.52,28],[.7,-14],[.85,7],[1,0]]); const s=kf(ms,d,[[0,1.05],[.52,1.02],[1,1]]); return {t:`translateX(${x.toFixed(1)}px) scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.4))}; },
    like(ms,d){ const s=kf(ms,d,[[0,.84],[.6,1.06],[1,1]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.45)),org:"16% 50%"}; },
    share(ms,d){ const x=kf(ms,d,[[0,-130],[.7,9],[1,0]]); const sk=kf(ms,d,[[0,-11],[.7,3],[1,0]]); return {t:`translateX(${x.toFixed(1)}px) skewX(${sk.toFixed(2)}deg)`,o:clamp01(ms/(d*.45))}; },
    star(ms,d){ const y=kf(ms,d,[[0,-74],[.62,9],[1,0]]); const rz=kf(ms,d,[[0,-5],[.62,2],[1,0]]); return {t:`translateY(${y.toFixed(1)}px) rotate(${rz.toFixed(2)}deg)`,o:clamp01(ms/(d*.5)),org:"16% 28%"}; },
    superchat(ms,d){ const s=kf(ms,d,[[0,1.4],[.6,.97],[1,1]]); return {t:`scale(${s.toFixed(3)})`,o:clamp01(ms/(d*.5)),org:"16% 50%"}; },
    supporter(ms,d){ const y=kf(ms,d,[[0,56],[.62,-6],[1,0]]); const sy=kf(ms,d,[[0,.92],[.62,1.02],[1,1]]); return {t:`translateY(${y.toFixed(1)}px) scaleY(${sy.toFixed(3)})`,o:clamp01(ms/(d*.5)),org:"50% 100%"}; },
  };
  const ENTER = { follower:660, subscriber:700, member:600, cheer:580, donation:780, host:680, raid:820, like:620, share:600, star:720, superchat:700, supporter:700 };

  let _cfg = DEFAULT, _type = "follower", _f = 0, _b1 = false, _b2 = false;
  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _type = type; _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "Viewer");
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
      // exit: fade + small shear-out (mirrors @keyframes alert-out)
      const p = clamp01((ms - holdEnd) / EXIT);
      const x = -46 * easeOut(p), sk = -6 * easeOut(p);
      st = { t: `translateX(${x.toFixed(1)}px) skewX(${sk.toFixed(2)}deg)`, o: 1 - p };
    }
    if (card) {
      card.style.transformOrigin = st.org || "50% 50%";
      card.style.transform = st.t;
      card.style.opacity = (st.o).toFixed(3);
    }
    // glyph plate pop (delayed ~140ms, shared by all)
    const glyph = card && card.querySelector(".glyph");
    if (glyph) {
      const gp = clamp01((ms - 140) / 600);
      const gs = gp <= 0 ? 0.4 : (gp < 0.6 ? 0.4 + (gp / 0.6) * 0.74 : 1.14 - ((gp - 0.6) / 0.4) * 0.14);
      const gr = gp <= 0 ? -8 : (gp < 0.6 ? -8 + (gp / 0.6) * 10 : 2 - ((gp - 0.6) / 0.4) * 2);
      glyph.style.transform = `scale(${Math.max(0, gs).toFixed(3)}) rotate(${gr.toFixed(2)}deg)`;
      glyph.style.opacity = gp <= 0 ? "0" : "1";
    }
    // bursts staggered like live mode
    if (ms >= 200 && !_b1) { _b1 = true; spawnBurst(_cfg.sparks); }
    if (_cfg.sparks >= 28 && ms >= 540 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.sparks * 0.6)); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo (skipped in render mode)
  if (!render) setTimeout(startDemo, 360);
})();
