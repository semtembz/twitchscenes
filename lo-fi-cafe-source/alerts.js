/* ============================================================
   LO-FI CAFE — alert engine ("Rainy Window Booth")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography + copy. Auto-plays a looping DEMO on load.
   Read ?type=&name=&amount= to override the demo data/event.
   Delta-clamped rAF warm-light BURST on a transparent canvas
   (soft amber bokeh motes + thin rain glints — the cafe signature).
   ?noname=1  => big line shows the EVENT label, kicker hides.
   ?render=1  => deterministic manual frame-stepping for headless
                 webm capture via __renderPlay/__renderAdvance.
   Engine plumbing copied verbatim from velvet-lounge; LOOK is
   100% bespoke to Lo-Fi Cafe.
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
     glyph  : mug-coaster icon
     kicker : spaced-caps event line
     sub    : little italic sub-line
     motes  : how many warm bokeh motes the burst spits (raid/host bigger)
     amount : true => emphasize the amount line (cheer/donation/superchat)
     amtPre : text shown before a bare numeric amount ($, bits, etc.)
     The DISTINCT entrance MOTION per event is set in alerts.css via
     body[data-event]; render mode replays each one through MOTION below. */
  /* sub: cheesy flavor sub-lines are intentionally EMPTY ("" = no baked copy).
     The static markup ships a muted "[ your text here ]" placeholder slot the
     buyer edits; an empty sub here leaves that placeholder untouched (see play). */
  const EVENTS = {
    follower:   { glyph: "☕", kicker: "NEW FOLLOWER",  sub: "", motes: 16, amount: false },
    subscriber: { glyph: "🥐", kicker: "NEW SUB",       sub: "", motes: 20, amount: false },
    member:     { glyph: "🍪", kicker: "NEW MEMBER",    sub: "", motes: 20, amount: false },
    cheer:      { glyph: "✨", kicker: "CHEER",         sub: "", motes: 24, amount: true,  amtPre: "", amtSuf: " bits" },
    donation:   { glyph: "🧁", kicker: "DONATION",      sub: "", motes: 26, amount: true,  amtPre: "$" },
    host:       { glyph: "🫖", kicker: "NOW HOSTING",   sub: "", motes: 34, amount: true,  amtPre: "", amtSuf: " guests" },
    raid:       { glyph: "🌧", kicker: "RAID INCOMING", sub: "", motes: 46, amount: true,  amtPre: "", amtSuf: " arriving" },
    like:       { glyph: "♡", kicker: "NEW LIKE",      sub: "", motes: 14, amount: false },
    share:      { glyph: "🍃", kicker: "SHARED",        sub: "", motes: 18, amount: false },
    star:       { glyph: "★", kicker: "NEW STAR",      sub: "", motes: 22, amount: true,  amtPre: "", amtSuf: " stars" },
    superchat:  { glyph: "💬", kicker: "SUPER CHAT",    sub: "", motes: 28, amount: true,  amtPre: "$" },
    supporter:  { glyph: "🤎", kicker: "NEW SUPPORTER", sub: "", motes: 24, amount: false },
  };
  const DEFAULT = EVENTS.follower;

  /* ---- per-event DETERMINISTIC render-mode motion (mirrors the CSS keyframes).
     Each returns {x,y,s,rot} for a normalized progress p in 0..1 on the way IN.
     The exit always falls back down (translateY) regardless of entrance. ---- */
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const lerp = (a, b, p) => a + (b - a) * p;
  // small keyframed sampler: pts = [[p, val], ...] sorted by p
  function kf(pts, p) {
    if (p <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (p <= pts[i][0]) {
        const t = (p - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return lerp(pts[i - 1][1], pts[i][1], t);
      }
    }
    return pts[pts.length - 1][1];
  }
  const MOTION = {
    follower:   (p) => ({ x: 0, y: kf([[0,120],[.72,-10],[1,0]], p), s: 1, rot: 0 }),
    subscriber: (p) => ({ x: kf([[0,-680],[.74,18],[1,0]], p), y: 0, s: 1, rot: 0 }),
    member:     (p) => ({ x: 0, y: 0, s: kf([[0,.6],[.7,1.04],[1,1]], p), rot: 0 }),
    cheer:      (p) => ({ x: 0, y: kf([[0,160],[.55,-26],[.78,8],[1,0]], p), s: 1, rot: 0 }),
    donation:   (p) => ({ x: 0, y: kf([[0,110],[.72,-8],[1,0]], p), s: 1, rot: kf([[0,-5],[.72,2],[1,0]], p) }),
    host:       (p) => ({ x: 0, y: kf([[0,-220],[.74,12],[1,0]], p), s: 1, rot: 0 }),
    raid:       (p) => ({ x: kf([[0,-760],[.6,26],[.82,-10],[1,0]], p), y: 0, s: 1, rot: kf([[0,-6],[.6,2],[.82,-1],[1,0]], p) }),
    like:       (p) => ({ x: 0, y: 0, s: kf([[0,.82],[.6,1.05],[1,1]], p), rot: 0 }),
    share:      (p) => ({ x: kf([[0,680],[.74,-18],[1,0]], p), y: 0, s: 1, rot: 0 }),
    star:       (p) => ({ x: 0, y: 0, s: kf([[0,.5],[.55,1.1],[.78,.98],[1,1]], p), rot: kf([[0,8],[.55,-3],[.78,1.5],[1,0]], p) }),
    superchat:  (p) => ({ x: 0, y: kf([[0,180],[.5,-22],[.7,10],[.86,-5],[1,0]], p), s: 1, rot: 0 }),
    supporter:  (p) => ({ x: 0, y: kf([[0,90],[.72,-6],[1,0]], p), s: kf([[0,.92],[.72,1.02],[1,1]], p), rot: 0 }),
  };

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

  /* ---- warm-light burst on a transparent canvas (delta-clamped rAF) ----
     soft amber/cream bokeh motes that float up + fade, plus a few thin
     rain glints — the cafe-window signature in miniature. ---- */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const WARM = ["#D9925A", "#F4EBE2", "#E8C79A", "#C9A88A", "#E8AE72"];
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the card's coaster tile (lower-left of the stage)
  function spawnBurst(n) {
    const ox = 240, oy = H - 200;
    for (let i = 0; i < n; i++) {
      burst.push({
        x: ox + R(-60, 120), y: oy + R(-50, 60),
        vx: R(-40, 60) / 60, vy: R(-150, -40) / 60,
        g: R(-30, 10) / 3600,            // near-buoyant: warm motes drift gently up
        s: R(6, 18), rot: R(0, 6.28), vr: R(-1.5, 1.5) / 60,
        a: 1, life: R(1.6, 3.0),
        c: WARM[(Math.random() * WARM.length) | 0],
      });
    }
  }

  function drawMote(p) {
    // a soft round out-of-focus bokeh fleck (warm cafe light)
    ctx.save();
    ctx.translate(p.x, p.y);
    const alpha = Math.max(0, p.a) * 0.5;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.s);
    g.addColorStop(0, p.c);
    g.addColorStop(0.5, p.c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y < -80) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1;
  }
  window.__cafeAlertDraw = frame; // rAF-independent verification hook

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

  /* ---- play(): drive one alert through its choreography ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "NewRegular";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    // make sure the body data-event drives the right CSS entrance for this play
    if (document.body) document.body.dataset.event = type;

    // populate (noname: big line = the event label; hide the small kicker; leave the
    // live viewer name to the alert platform's text layer)
    if (glyphEl) glyphEl.textContent = cfg.glyph;
    const kickLine = card.querySelector(".kick");
    if (noname) {
      if (kickLine) kickLine.style.display = "none";
      if (nameEl) nameEl.textContent = cfg.kicker;
    } else {
      if (kickLine) kickLine.style.display = "";
      if (kickEl) kickEl.textContent = cfg.kicker;
      if (nameEl) nameEl.textContent = name;
    }
    // sub is an editable slot: only overwrite when a non-empty flavor line is
    // configured; an empty cfg.sub leaves the markup's placeholder slot intact.
    if (subEl && cfg.sub) { subEl.textContent = cfg.sub; subEl.classList.remove("is-slot"); }
    if (amountEl) amountEl.textContent = amountStr;
    card.classList.toggle("has-amount", !!(cfg.amount && amountStr));

    // restart the entrance animation cleanly
    card.classList.remove("hide", "show");
    void card.offsetWidth; // force reflow so re-adding .show replays it
    card.classList.add("show");

    // warm-light burst (staggered a touch so it reads after the drift-in)
    setTimeout(() => spawnBurst(cfg.motes), 240);
    // raid/host get a second pop for "bigger" feel
    if (cfg.motes >= 30) setTimeout(() => spawnBurst(Math.round(cfg.motes * 0.6)), 640);

    // hold, then settle back down
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show");
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
      name: params.get("name") || "NewRegular",
      amount: params.get("amount") != null ? params.get("amount") : "5",
    };
  }
  function startDemo() {
    // self-chaining loop: each cycle (~.66 in + 4.2 hold + .5 out) queues the
    // next from its own completion, so beats never drift or overlap.
    demoOn = true;
    play(demoData());
  }

  /* ---- deterministic render mode: drive one full play via manual frame steps ---- */
  let _cfg = DEFAULT, _type = "follower", _f = 0, _b1 = false, _b2 = false;
  function renderPlay(opts) {
    opts = opts || {};
    _type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[_type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "NewRegular");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    if (document.body) document.body.dataset.event = _type;
    if (glyphEl) glyphEl.textContent = _cfg.glyph;
    const kickLine = card.querySelector(".kick");
    if (noname) { if (kickLine) kickLine.style.display = "none"; if (nameEl) nameEl.textContent = _cfg.kicker; }
    else { if (kickLine) kickLine.style.display = ""; if (kickEl) kickEl.textContent = _cfg.kicker; if (nameEl) nameEl.textContent = name; }
    if (subEl && _cfg.sub) { subEl.textContent = _cfg.sub; subEl.classList.remove("is-slot"); }
    if (amountEl) amountEl.textContent = amountStr;
    card.classList.toggle("has-amount", !!(_cfg.amount && amountStr));
    card.classList.remove("show", "hide");
    _f = 0; _b1 = false; _b2 = false; burst = [];
  }
  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const ENTER = 700, HOLD = 4200, EXIT = 520, holdEnd = ENTER + HOLD;
    const motion = MOTION[_type] || MOTION.follower;
    let tf, op;
    if (ms < ENTER) {                                  // entrance: per-event distinct motion
      const p = easeOut(ms / ENTER);
      const m = motion(p);
      tf = "translate(" + m.x.toFixed(1) + "px," + m.y.toFixed(1) + "px) scale(" + m.s.toFixed(3) + ") rotate(" + m.rot.toFixed(2) + "deg)";
      op = Math.min(1, ms / (ENTER * 0.55));
    } else if (ms < holdEnd) {                         // hold
      tf = "translate(0,0) scale(1) rotate(0deg)"; op = 1;
    } else {                                           // exit: settle back down
      const p = easeOut(Math.min(1, (ms - holdEnd) / EXIT));
      tf = "translate(0," + (120 * p).toFixed(1) + "px) scale(1) rotate(0deg)"; op = 1 - p;
    }
    if (card) { card.style.transform = tf; card.style.opacity = op.toFixed(3); }
    // glyph pop (mirrors glyph-pop, delayed .2s)
    const glyph = card && card.querySelector(".glyph");
    if (glyph) {
      const gp = (ms - 200) / 720;
      const gs = gp <= 0 ? 0.4 : gp >= 1 ? 1 : (gp < 0.6 ? 0.4 + (gp / 0.6) * 0.74 : 1.14 - ((gp - 0.6) / 0.4) * 0.14);
      glyph.style.transform = "scale(" + Math.max(0, gs).toFixed(3) + ")"; glyph.style.opacity = gp <= 0 ? "0" : "1";
    }
    if (ms >= 240 && !_b1) { _b1 = true; spawnBurst(_cfg.motes); }
    if (_cfg.motes >= 30 && ms >= 640 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.motes * 0.6)); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo after a tiny delay (skipped in render mode)
  if (!render) setTimeout(startDemo, 400);
})();
