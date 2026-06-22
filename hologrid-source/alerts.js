/* ============================================================
   HOLOGRID — alert engine ("Projection Deck Hails")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography + copy. Auto-plays a looping DEMO on load.
   Read ?type=&name=&amount= to override the demo data/event.
   Delta-clamped rAF HOLO-PARTICLE burst (transparent canvas).
   ?noname=1  => big line shows the EVENT label, kicker hides.
   ?render=1  => deterministic manual frame-stepping for headless
                 webm capture via __renderPlay/__renderAdvance.
   Each of the 12 events has a DISTINCT entrance motion (the CSS
   keyframe is selected by data-anim; render mode reproduces the
   same motion via a per-event JS transform fn).
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  // noname: render the card with NO baked viewer name (the big line shows the event
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

  /* ---- per-event choreography table ----
     glyph  : icon projected in the node tile
     kicker : spaced mono-caps event line
     sub    : little mono sub-line
     motes  : how many holo particles the burst spits (raid/host bigger)
     amount : true => emphasize the amount readout (cheer/donation/superchat)
     amtPre : text shown before a bare numeric amount ($, bits, etc.)
     col    : burst tint pick (cyan/violet/mint accent for the event)
     anim   : the distinct entrance keyword (also set as data-anim for CSS) */
  const EVENTS = {
    follower:   { glyph:"⬡", kicker:"NEW FOLLOWER",   sub:"",     motes:18, amount:false, anim:"follower",   col:"cyan"   },
    subscriber: { glyph:"❖", kicker:"NEW SUBSCRIBER", sub:"",      motes:24, amount:false, anim:"subscriber", col:"mint"   },
    member:     { glyph:"◈", kicker:"NEW MEMBER",     sub:"",      motes:22, amount:false, anim:"member",     col:"violet" },
    cheer:      { glyph:"✦", kicker:"CHEER",          sub:"",       motes:30, amount:true,  anim:"cheer",      col:"cyan",   amtPre:"", amtSuf:" bits" },
    donation:   { glyph:"◆", kicker:"DONATION",       sub:"",        motes:34, amount:true,  anim:"donation",   col:"mint",   amtPre:"$" },
    host:       { glyph:"⊞", kicker:"NOW HOSTING",    sub:"",        motes:36, amount:true,  anim:"host",       col:"cyan",   amtPre:"", amtSuf:" viewers" },
    raid:       { glyph:"⟁", kicker:"INCOMING RAID",  sub:"",   motes:52, amount:true,  anim:"raid",       col:"violet", amtPre:"", amtSuf:" inbound" },
    like:       { glyph:"♥", kicker:"NEW LIKE",       sub:"",         motes:14, amount:false, anim:"like",       col:"violet" },
    share:      { glyph:"⇗", kicker:"SHARED",         sub:"",         motes:20, amount:false, anim:"share",      col:"mint"   },
    star:       { glyph:"★", kicker:"NEW STAR",       sub:"",           motes:26, amount:true,  anim:"star",       col:"cyan",   amtPre:"", amtSuf:" stars" },
    superchat:  { glyph:"✷", kicker:"SUPER CHAT",     sub:"",       motes:32, amount:true,  anim:"superchat",  col:"mint",   amtPre:"$" },
    supporter:  { glyph:"⬢", kicker:"NEW SUPPORTER",  sub:"",        motes:26, amount:false, anim:"supporter",  col:"violet" },
  };
  const DEFAULT = EVENTS.follower;
  const TINT = { cyan:"#36C2FF", mint:"#5BFFD0", violet:"#B66BFF" };
  const HOLO = ["#36C2FF", "#5BFFD0", "#B66BFF", "#EAF2FF"];

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
  const holo = card ? card.querySelector(".holo") : null;
  const glyphEl = $id("glyph");
  const kickEl = $id("kick-label");
  const nameEl = $id("name");
  const amountEl = $id("amount");
  const subEl = $id("sub");

  let hideTimer = null, busy = false, demoOn = false;

  /* ---- holo-particle burst on a transparent canvas (delta-clamped rAF) ---- */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the node tile (lower-left of the stage, over the card)
  function spawnBurst(n, tintKey) {
    const ox = 96 + 40 + 75, oy = H - 140 - 113;     // node centre-ish on the deck
    const accent = TINT[tintKey] || "#36C2FF";
    for (let i = 0; i < n; i++) {
      // 70% themed accent, 30% mixed holo palette for variety
      const c = Math.random() < 0.7 ? accent : HOLO[(Math.random() * HOLO.length) | 0];
      burst.push({
        x: ox + R(-46, 70), y: oy + R(-50, 50),
        vx: R(-40, 220) / 60, vy: R(-210, -40) / 60,
        g: R(60, 130) / 3600,
        s: R(2, 4.5), rot: R(0, 6.28), vr: R(-3, 3) / 60,
        a: 1, life: R(1.3, 2.4),
        shape: Math.random() < 0.5 ? 0 : 1,    // 0 = diamond fleck, 1 = thin streak
        c,
      });
    }
  }

  function drawMote(p) {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.a);
    ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 10;
    if (p.shape === 0) {
      // a tiny rotated holo diamond
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
    } else {
      // a thin data streak
      ctx.fillRect(-p.s, -0.8, p.s * 2.4, 1.6);
    }
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 60) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  window.__holoAlertDraw = frame; // rAF-independent verification hook

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
  function populate(type, name, amountStr) {
    const cfg = EVENTS[type] || DEFAULT;
    if (!card) return cfg;
    card.setAttribute("data-anim", cfg.anim);
    if (glyphEl) glyphEl.textContent = cfg.glyph;
    const kickLine = card.querySelector(".kick");
    if (noname) {
      if (kickLine) kickLine.style.display = "none";
      if (nameEl) { nameEl.textContent = cfg.kicker; nameEl.setAttribute("data-t", cfg.kicker); }
    } else {
      if (kickLine) kickLine.style.display = "";
      if (kickEl) kickEl.textContent = cfg.kicker;
      if (nameEl) { nameEl.textContent = name; nameEl.setAttribute("data-t", name); }
    }
    if (subEl) subEl.textContent = cfg.sub;
    if (amountEl) amountEl.textContent = amountStr;
    const showAmt = !!(cfg.amount && amountStr);
    card.classList.toggle("has-amount", showAmt);
    card.classList.toggle("amt", showAmt);   // amount-emphasis pulse
    return cfg;
  }

  /* ---- play(): drive one alert through its choreography ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "NewViewer";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card || !holo) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    populate(type, name, amountStr);

    // restart the entrance animation cleanly
    card.classList.remove("hide", "show");
    void holo.offsetWidth; // force reflow so re-adding .show replays it
    card.classList.add("show");

    // holo-particle burst (staggered a touch so it reads after the entrance)
    setTimeout(() => spawnBurst(cfg.motes, cfg.col), 200);
    // raid/host get a second pop for "bigger" feel
    if (cfg.motes >= 34) setTimeout(() => spawnBurst(Math.round(cfg.motes * 0.6), cfg.col), 560);

    // hold, then de-resolve
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show");
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        // if running the demo loop, queue the next one after a short gap
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1500);
      }, 520);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then loop ----
     A page (alerts/<event>.html) fires its own event; alerts-export drives
     each by ?type=. With no body[data-event] + no ?type= we cycle ALL 12 so
     a bare alerts.js preview shows the whole set. */
  const DEMO_ORDER = ["follower","subscriber","member","cheer","donation","host","raid","like","share","star","superchat","supporter"];
  let demoIx = 0;
  const pageBound = !!((document.body && document.body.dataset && EVENTS[document.body.dataset.event]) || (params.get("type") && EVENTS[params.get("type")]));
  function demoData() {
    let type;
    if (pageBound) { type = pageType(); }
    else { type = DEMO_ORDER[demoIx % DEMO_ORDER.length]; demoIx++; }
    const cfg = EVENTS[type] || DEFAULT;
    // give amount events a believable sample number for the demo
    const sample = cfg.amount ? (params.get("amount") != null ? params.get("amount")
      : (type === "donation" || type === "superchat") ? "25" : type === "raid" ? "142"
        : type === "host" ? "58" : type === "cheer" ? "500" : "12") : (params.get("amount") || "");
    return {
      type,
      name: params.get("name") || "NewViewer",
      amount: sample,
    };
  }
  function startDemo() { demoOn = true; play(demoData()); }

  /* ---- deterministic render mode: drive one full play via manual frame steps ----
     Each event reproduces its CSS entrance via a per-event transform fn so the
     headless webm matches what OBS shows. */
  let _cfg = DEFAULT, _f = 0, _b1 = false, _b2 = false;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const lerp = (a, b, p) => a + (b - a) * p;
  // overshoot helper: 0 -> 1 with a settle past 1 around mid
  function overshoot(p) { return p < 0.66 ? easeOut(p / 0.66) * 1.06 : 1 + (1.06 - 1) * (1 - (p - 0.66) / 0.34) - 0.06 * ((p - 0.66) / 0.34); }

  // per-event deterministic transform for render mode. p in 0..1 across the ENTER window.
  // returns a CSS transform + opacity + filter string set.
  function entrance(anim, p) {
    const e = easeOut(p);
    let t = "none", op = 1, fil = "none";
    switch (anim) {
      case "follower": { // boot: scaleY 0->1 with bright flash
        const sy = p < 0.4 ? lerp(0.02, 1.06, e / easeOut(0.4)) : p < 0.7 ? lerp(1.06, 0.97, (p - 0.4) / 0.3) : lerp(0.97, 1, (p - 0.7) / 0.3);
        t = "scaleY(" + sy.toFixed(3) + ")"; op = Math.min(1, p / 0.4); fil = "brightness(" + lerp(2, 1, e).toFixed(2) + ")"; break;
      }
      case "subscriber": { // phase: blur + lift
        const y = lerp(26, 0, e), s = lerp(0.94, 1, e), b = Math.max(0, lerp(8, 0, Math.min(1, p / 0.6)));
        t = "translateY(" + y.toFixed(1) + "px) scale(" + s.toFixed(3) + ")"; op = Math.min(1, p / 0.5); fil = "blur(" + b.toFixed(2) + "px) brightness(" + lerp(1.4, 1, e).toFixed(2) + ")"; break;
      }
      case "member": { // stamp: punch from large
        const s = p < 0.55 ? lerp(1.4, 0.96, easeOut(p / 0.55)) : p < 0.78 ? lerp(0.96, 1.02, (p - 0.55) / 0.23) : lerp(1.02, 1, (p - 0.78) / 0.22);
        t = "scale(" + s.toFixed(3) + ")"; op = Math.min(1, p / 0.4); fil = "brightness(" + lerp(1.8, 1, e).toFixed(2) + ")"; break;
      }
      case "cheer": { // data rain: drop from above + bounce
        const y = p < 0.55 ? lerp(-120, 14, easeOut(p / 0.55)) : p < 0.78 ? lerp(14, -6, (p - 0.55) / 0.23) : lerp(-6, 0, (p - 0.78) / 0.22);
        t = "translateY(" + y.toFixed(1) + "px)"; op = Math.min(1, p / 0.4); fil = "brightness(" + lerp(1.5, 1, e).toFixed(2) + ")"; break;
      }
      case "donation": { // glitch: stepped flicker resolve
        const steps = [[-10,0],[8,.6],[-6,.2],[4,.85],[-3,.4],[2,1],[-1,.9],[0,1]];
        const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
        t = "translateX(" + steps[idx][0] + "px)"; op = steps[idx][1]; break;
      }
      case "host": { // wipe from left
        const x = p < 0.68 ? lerp(-560, 20, easeOut(p / 0.68)) : lerp(20, 0, (p - 0.68) / 0.32);
        t = "translateX(" + x.toFixed(1) + "px)"; op = Math.min(1, p / 0.4); break;
      }
      case "raid": { // inbound from right w/ skew
        let x, sk;
        if (p < 0.6) { x = lerp(680, -24, easeOut(p / 0.6)); sk = lerp(-8, 2, easeOut(p / 0.6)); }
        else if (p < 0.82) { x = lerp(-24, 8, (p - 0.6) / 0.22); sk = lerp(2, 0, (p - 0.6) / 0.22); }
        else { x = lerp(8, 0, (p - 0.82) / 0.18); sk = 0; }
        t = "translateX(" + x.toFixed(1) + "px) skewX(" + sk.toFixed(2) + "deg)"; op = Math.min(1, p / 0.45); fil = "brightness(" + lerp(1.6, 1, e).toFixed(2) + ")"; break;
      }
      case "like": { // ping pop
        const s = p < 0.6 ? lerp(0.78, 1.04, easeOut(p / 0.6)) : lerp(1.04, 1, (p - 0.6) / 0.4);
        t = "scale(" + s.toFixed(3) + ")"; op = Math.min(1, p / 0.45); break;
      }
      case "share": { // diagonal beam from lower-left
        const x = p < 0.65 ? lerp(-90, 8, easeOut(p / 0.65)) : lerp(8, 0, (p - 0.65) / 0.35);
        const y = p < 0.65 ? lerp(60, -4, easeOut(p / 0.65)) : lerp(-4, 0, (p - 0.65) / 0.35);
        const s = p < 0.65 ? lerp(0.92, 1.01, easeOut(p / 0.65)) : lerp(1.01, 1, (p - 0.65) / 0.35);
        t = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + s.toFixed(3) + ")"; op = Math.min(1, p / 0.5); break;
      }
      case "star": { // spin-in
        let r, s;
        if (p < 0.62) { r = lerp(-7, 2, easeOut(p / 0.62)); s = lerp(0.7, 1.03, easeOut(p / 0.62)); }
        else { r = lerp(2, 0, (p - 0.62) / 0.38); s = lerp(1.03, 1, (p - 0.62) / 0.38); }
        t = "rotate(" + r.toFixed(2) + "deg) scale(" + s.toFixed(3) + ")"; op = Math.min(1, p / 0.45); fil = "brightness(" + lerp(1.6, 1, e).toFixed(2) + ")"; break;
      }
      case "superchat": { // uplink rise from below
        const y = p < 0.6 ? lerp(120, -10, easeOut(p / 0.6)) : lerp(-10, 0, (p - 0.6) / 0.4);
        const s = lerp(0.97, 1, e);
        t = "translateY(" + y.toFixed(1) + "px) scale(" + s.toFixed(3) + ")"; op = Math.min(1, p / 0.45); fil = "brightness(" + lerp(1.5, 1, e).toFixed(2) + ")"; break;
      }
      case "supporter": { // unfold scaleX iris
        const sx = p < 0.45 ? lerp(0.02, 1.05, easeOut(p / 0.45)) : p < 0.72 ? lerp(1.05, 0.98, (p - 0.45) / 0.27) : lerp(0.98, 1, (p - 0.72) / 0.28);
        t = "scaleX(" + sx.toFixed(3) + ")"; op = Math.min(1, p / 0.4); fil = "brightness(" + lerp(1.8, 1, e).toFixed(2) + ")"; break;
      }
      default: t = "none"; op = Math.min(1, p / 0.4);
    }
    return { t, op, fil };
  }
  // exit de-resolve (mirrors .holo holo-out) p in 0..1
  function exit(p) {
    if (p < 0.55) { const q = p / 0.55; return { t: "translateY(" + (-4 * q).toFixed(1) + "px) scaleY(" + lerp(1, 0.9, q).toFixed(3) + ")", op: lerp(1, 0.6, q), fil: "none" }; }
    const q = (p - 0.55) / 0.45;
    return { t: "translateY(" + lerp(-4, -8, q).toFixed(1) + "px) scaleX(" + lerp(1, 1.04, q).toFixed(3) + ") scaleY(" + lerp(0.9, 0.02, q).toFixed(3) + ")", op: lerp(0.6, 0, q), fil: "brightness(" + lerp(1, 1.6, q).toFixed(2) + ")" };
  }

  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "NewViewer");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    populate(type, name, amountStr);
    card.classList.remove("show", "hide");
    // deterministic charge underline: drive its width in JS (CSS anim frozen in render)
    _f = 0; _b1 = false; _b2 = false; burst = [];
    if (holo) { holo.style.transform = "none"; holo.style.opacity = "0"; holo.style.filter = "none"; }
  }
  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const ENTER = 620, HOLD = 4200, EXIT = 520, holdEnd = ENTER + HOLD;
    let st;
    if (ms < ENTER) st = entrance(_cfg.anim, ms / ENTER);
    else if (ms < holdEnd) st = { t: "none", op: 1, fil: "none" };
    else st = exit(Math.min(1, (ms - holdEnd) / EXIT));
    if (holo) { holo.style.transform = st.t; holo.style.opacity = st.op.toFixed(3); holo.style.filter = st.fil; }
    // deterministic charge underline width (0->100% over ~4.6s like the CSS)
    const cl = card && card.querySelector(".chargeline");
    if (cl) {
      const p = Math.min(1, ms / 4600);
      cl.style.setProperty("--cw", (p * 100).toFixed(2) + "%");
    }
    // bursts (staggered like the live JS)
    if (ms >= 200 && !_b1) { _b1 = true; spawnBurst(_cfg.motes, _cfg.col); }
    if (_cfg.motes >= 34 && ms >= 560 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.motes * 0.6), _cfg.col); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo after a tiny delay (skipped in render mode)
  if (!render) setTimeout(startDemo, 400);
})();
