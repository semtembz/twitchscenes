/* ============================================================
   BUBBLE BATH — alert engine ("Soap & Shimmer")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography (12 DISTINCT motions) + copy. Auto-plays a looping
   DEMO on load. Read ?type=&name=&amount= to override demo data.
   Delta-clamped rAF SOAP-BUBBLE burst on a transparent canvas.
   ?noname=1  => big line shows the EVENT label, kicker hides.
   ?render=1  => deterministic manual frame-stepping for headless
                 webm capture via __renderPlay/__renderAdvance.
   Theme-agnostic plumbing copied from the shared engine convention;
   only the LOOK + the motion table are bespoke to Bubble Bath.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  // noname: render the card with NO baked viewer name (the big line shows the
  // event instead; the streamer's Streamlabs/StreamElements layer overlays the
  // live name). This is the SHIPPING mode for the clip pack.
  const noname = params.get("noname") === "1" || params.get("noname") === "true";
  // render mode: deterministic manual frame-stepping for headless webm capture
  // (no CSS animation / setTimeout / free rAF — driven by window.__renderAdvance()).
  const render = params.get("render") === "1";
  const stage = $id("stage");
  if (render && stage) stage.classList.add("render");

  /* ---- fit the 1920x1080 stage to the window (defensive, mirrors shared.js) ---- */
  function fit() {
    const iw = window.innerWidth, ih = window.innerHeight;
    if (iw < 10 || ih < 10) return;                 // never write --scale:0
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- per-event choreography table ----
     glyph  : icon in the bubble badge
     kicker : rounded-caps event line
     sub    : little soft sub-line
     motion : data-motion key -> a DISTINCT @keyframes entrance in alerts.css
     pops   : how many soap-bubble motes the burst spits (raid/host bigger)
     amount : true => show + emphasize the amount (cheer/donation/superchat)
     amtPre/amtSuf : decoration around a bare numeric amount */
  const EVENTS = {
    follower:   { glyph:"🫧", kicker:"NEW BUBBLE",     sub:"",     motion:"bubbleup",  pops:16, amount:false },
    subscriber: { glyph:"✦", kicker:"NEW SUBSCRIBER", sub:"",     motion:"squish",    pops:22, amount:false },
    member:     { glyph:"❤", kicker:"NEW MEMBER",     sub:"",    motion:"popin",     pops:22, amount:false },
    cheer:      { glyph:"✧", kicker:"CHEER",          sub:"",         motion:"fizz",      pops:26, amount:true,  amtPre:"", amtSuf:" bits" },
    donation:   { glyph:"💧", kicker:"DONATION",       sub:"",   motion:"splash",    pops:30, amount:true,  amtPre:"$" },
    host:       { glyph:"🛁", kicker:"NOW HOSTING",    sub:"",      motion:"swing",     pops:34, amount:true,  amtPre:"", amtSuf:" guests" },
    raid:       { glyph:"🌊", kicker:"RAID INCOMING",  sub:"",       motion:"surge",     pops:48, amount:true,  amtPre:"", amtSuf:" raiders" },
    like:       { glyph:"♥", kicker:"NEW LIKE",       sub:"",     motion:"heartbeat", pops:14, amount:false },
    share:      { glyph:"➤", kicker:"SHARED",         sub:"",      motion:"glide",     pops:18, amount:false },
    star:       { glyph:"★", kicker:"NEW STAR",       sub:"",        motion:"twirl",     pops:24, amount:true,  amtPre:"", amtSuf:" stars" },
    superchat:  { glyph:"💎", kicker:"SUPER CHAT",     sub:"",       motion:"zoom",      pops:30, amount:true,  amtPre:"$" },
    supporter:  { glyph:"✪", kicker:"NEW SUPPORTER",  sub:"",  motion:"wobble",    pops:24, amount:false },
  };
  const DEFAULT = EVENTS.follower;

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

  /* ---- the card elements (all null-guarded) ---- */
  const card = $id("alert");
  const glyphEl = $id("glyph");
  const kickEl = $id("kick-label");
  const nameEl = $id("name");
  const amountEl = $id("amount");
  const subEl = $id("sub");

  let hideTimer = null, settleTimer = null, busy = false, demoOn = false;

  /* ---- soap-bubble burst on a transparent canvas (delta-clamped rAF) ----
     Each mote is a tiny translucent bubble: soft body, a thin iridescent
     rim, and a white specular dot — a fleck of the bath's foam. */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const RIMS = [
    "rgba(255,183,213,A)",   // bubblegum pink
    "rgba(160,231,229,A)",   // mint aqua
    "rgba(255,244,194,A)",   // soft lemon
    "rgba(108,122,224,A)",   // periwinkle
    "rgba(189,235,251,A)",   // pale aqua
  ];
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the bubble badge (lower-left of the stage)
  function spawnBurst(n) {
    const ox = 230, oy = H - 230;
    for (let i = 0; i < n; i++) {
      burst.push({
        x: ox + R(-60, 120), y: oy + R(-70, 60),
        vx: R(-40, 120) / 60, vy: R(-220, -70) / 60,
        g: R(34, 78) / 3600,                // light "buoyant" gravity per frame
        s: R(5, 16),                        // bubble radius
        a: 1, life: R(1.4, 2.8),
        hue: (Math.random() * RIMS.length) | 0,
        ph: R(0, 6.28), sway: R(0.4, 1.4),  // gentle horizontal wobble
      });
    }
  }

  function drawMote(p) {
    // a tiny translucent soap bubble
    const x = Math.round(p.x), y = Math.round(p.y), r = p.s;
    const al = Math.max(0, p.a);
    ctx.save();
    // body
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, "rgba(255,255,255," + (al * 0.7).toFixed(3) + ")");
    g.addColorStop(0.6, "rgba(217,244,255," + (al * 0.35).toFixed(3) + ")");
    g.addColorStop(1, "rgba(160,231,229," + (al * 0.12).toFixed(3) + ")");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    // iridescent rim
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.strokeStyle = RIMS[p.hue].replace("A", (al * 0.6).toFixed(3));
    ctx.beginPath(); ctx.arc(x, y, r - ctx.lineWidth * 0.5, 0, 6.2832); ctx.stroke();
    // specular dot
    const hr = Math.max(1.4, r * 0.3);
    ctx.fillStyle = "rgba(255,255,255," + Math.min(0.95, al + 0.2).toFixed(3) + ")";
    ctx.beginPath(); ctx.arc(Math.round(x - r * 0.34), Math.round(y - r * 0.38), hr, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.ph += 0.08;
      p.x += p.vx + Math.sin(p.ph) * p.sway; p.y += p.vy; p.vy += p.g; // buoyant rise then drift
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y < -40) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }
  window.__bubbleAlertDraw = frame; // rAF-independent verification hook

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

  /* ---- populate the card DOM for a given event/config ---- */
  function populate(cfg, name, amountStr) {
    if (glyphEl) glyphEl.textContent = cfg.glyph;
    if (card) card.setAttribute("data-motion", cfg.motion || "popin");
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
    if (card) card.classList.toggle("has-amount", !!(cfg.amount && amountStr));
  }

  /* ---- play(): drive one alert through its choreography ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "NewBubble";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }

    populate(cfg, name, amountStr);

    // restart the entrance cleanly: clear states, force reflow, add .show
    card.classList.remove("hide", "show", "settled");
    void card.offsetWidth; // force reflow so re-adding .show replays the keyframes
    card.classList.add("show");
    // hand off to the gentle idle jiggle once the entrance keyframes finish
    settleTimer = setTimeout(() => {
      if (card.classList.contains("show")) card.classList.add("settled");
    }, 1050);

    // soap-bubble burst (staggered a touch so it reads after the entrance)
    setTimeout(() => spawnBurst(cfg.pops), 200);
    // raid/host get a second pop for "bigger" feel
    if (cfg.pops >= 30) setTimeout(() => spawnBurst(Math.round(cfg.pops * 0.6)), 600);

    // hold, then deflate out
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show", "settled");
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        // if running the demo loop, queue the next one after a short gap
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1700);
      }, 520);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then loop every few seconds ---- */
  function demoData() {
    return {
      type: pageType(),
      name: params.get("name") || "NewBubble",
      amount: params.get("amount") != null ? params.get("amount") : "5",
    };
  }
  function startDemo() {
    // self-chaining loop: each cycle queues the next from its own completion,
    // so beats never drift or overlap.
    demoOn = true;
    play(demoData());
  }

  /* =========================================================================
     DETERMINISTIC RENDER MODE — drive one full play via manual frame steps.
     We reproduce each named motion's transform/opacity in JS (the CSS
     entrances are frozen by #stage.render). Same timeline as the live play.
     ========================================================================= */
  let _cfg = DEFAULT, _f = 0, _b1 = false, _b2 = false;
  const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
  // a bouncy overshoot ease (~cubic-bezier(.34,1.56,.4,1)) via a damped spring shape
  function overshoot(p) {
    p = clamp01(p);
    const s = 1.70158 * 1.2;
    return 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
  }

  // each motion is a function of progress p (0..1) returning a transform string + opacity.
  // These mirror the @keyframes in alerts.css closely enough for a clean clip.
  function motionTransform(motion, p) {
    const o = clamp01(p * 1.5);                      // opacity ramps a bit faster
    const e = overshoot(p);                          // 0 -> ~1 with overshoot near the end
    let tf;
    switch (motion) {
      case "bubbleup": { const y = (1 - e) * 120; const sc = 0.7 + e * 0.3; tf = `translateY(${y.toFixed(1)}px) scale(${sc.toFixed(3)})`; break; }
      case "squish": {
        // drop, splat wide, settle
        const sx = p < 0.45 ? 0.8 + (p / 0.45) * 0.34 : 1.14 - ((p - 0.45) / 0.55) * 0.14;
        const sy = p < 0.45 ? 0.8 + (p / 0.45) * 0.02 : 0.82 + ((p - 0.45) / 0.55) * 0.18;
        const y = (1 - easeOut(p / 0.45)) * -90 * (p < 0.45 ? 1 : 0);
        tf = `translateY(${y.toFixed(1)}px) scale(${sx.toFixed(3)},${sy.toFixed(3)})`; break;
      }
      case "popin": { const sc = 0.2 + e * 0.8; tf = `scale(${sc.toFixed(3)})`; break; }
      case "fizz": { const y = (1 - easeOut(p)) * 60; const rot = Math.sin(p * 18) * (1 - p) * 2.2; const sc = 0.84 + easeOut(p) * 0.16; tf = `translateY(${y.toFixed(1)}px) scale(${sc.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`; break; }
      case "splash": { const y = (1 - e) * -160; const sc = 0.78 + e * 0.22; const bob = Math.sin(p * Math.PI) * (1 - p) * -10; tf = `translateY(${(y + bob).toFixed(1)}px) scale(${sc.toFixed(3)})`; break; }
      case "swing": { const x = (1 - e) * -260; const rot = (1 - e) * -9 + Math.sin(p * Math.PI) * 3 * (1 - p); const sc = 0.9 + e * 0.1; tf = `translateX(${x.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`; break; }
      case "surge": { const y = (1 - e) * 260; const sc = 0.62 + e * 0.38; tf = `translateY(${y.toFixed(1)}px) scale(${sc.toFixed(3)})`; break; }
      case "heartbeat": { const sc = 0.5 + easeOut(p) * 0.5 + Math.sin(p * Math.PI * 2) * (1 - p) * 0.14; tf = `scale(${sc.toFixed(3)})`; break; }
      case "glide": { const x = (1 - easeOut(p)) * 240; const sc = 0.94 + easeOut(p) * 0.06; tf = `translateX(${x.toFixed(1)}px) scale(${sc.toFixed(3)})`; break; }
      case "twirl": { const rot = (1 - e) * -26; const sc = 0.4 + e * 0.6; tf = `scale(${sc.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`; break; }
      case "zoom": { const sc = 1.6 - e * 0.6 + Math.sin(p * Math.PI) * (1 - p) * 0.06; tf = `scale(${Math.max(0.4, sc).toFixed(3)})`; break; }
      case "wobble": { const y = (1 - e) * 70; const rot = (1 - e) * -3 + Math.sin(p * 7) * (1 - p) * 2; const sc = 0.9 + e * 0.1; tf = `translateY(${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`; break; }
      default: { const sc = 0.2 + e * 0.8; tf = `scale(${sc.toFixed(3)})`; }
    }
    return { tf, op: o };
  }

  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "NewBubble");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    populate(_cfg, name, amountStr);
    card.classList.remove("show", "hide", "settled");
    card.style.transform = "scale(0.6)"; card.style.opacity = "0";
    _f = 0; _b1 = false; _b2 = false; burst = [];
  }

  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const ENTER = 950, HOLD = 4200, EXIT = 520, holdEnd = ENTER + HOLD;
    let tf, op;
    if (ms < ENTER) {                                 // entrance (per-motion)
      const r = motionTransform(_cfg.motion, ms / ENTER);
      tf = r.tf; op = r.op;
    } else if (ms < holdEnd) {                        // hold (settled)
      tf = "scale(1)"; op = 1;
    } else {                                          // exit — deflate (mirrors alert-out)
      const p = clamp01((ms - holdEnd) / EXIT);
      const sc = 1 - p * 0.38; const y = p * 26;
      tf = `scale(${sc.toFixed(3)}) translateY(${y.toFixed(1)}px)`; op = (1 - p).toFixed(3);
    }
    if (card) { card.style.transform = tf; card.style.opacity = String(op); }

    // glyph pop (independent little spring)
    const glyph = card && card.querySelector(".glyph");
    if (glyph) {
      const gp = clamp01((ms - 200) / 800);
      const gs = gp <= 0 ? 0.3 : (gp < 0.6 ? 0.3 + (gp / 0.6) * 0.86 : 1.16 - ((gp - 0.6) / 0.4) * 0.16);
      glyph.style.transform = "scale(" + Math.max(0, gs).toFixed(3) + ")"; glyph.style.opacity = gp <= 0 ? "0" : "1";
    }
    // amount pop (emphasis for cheer/donation/superchat)
    if (card && card.classList.contains("has-amount") && amountEl) {
      const ap = clamp01((ms - 500) / 900);
      const as = ap <= 0 ? 0.4 : (ap < 0.55 ? 0.4 + (ap / 0.55) * 0.78 : 1.18 - ((ap - 0.55) / 0.45) * 0.18);
      amountEl.style.transform = "scale(" + Math.max(0, as).toFixed(3) + ")"; amountEl.style.opacity = ap <= 0 ? "0" : "1";
    }

    if (ms >= 200 && !_b1) { _b1 = true; spawnBurst(_cfg.pops); }
    if (_cfg.pops >= 30 && ms >= 600 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.pops * 0.6)); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo after a tiny delay (skipped in render mode)
  if (!render) setTimeout(startDemo, 400);
})();
