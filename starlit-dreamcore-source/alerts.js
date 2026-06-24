/* ============================================================
   STARLIT DREAMCORE — alert engine ("Sleeping Sky")
   Exposes window.playAlert({type,name,amount}) with a DISTINCT
   sleepy ENTRANCE motion per event + clean functional copy. Auto-
   plays a looping DEMO on load. Reads ?type=&name=&amount= to
   override the demo data. Delta-clamped rAF STAR-DUST burst on a
   TRANSPARENT canvas.
   ?noname=1  => big line shows the EVENT label, kicker hides.
   ?render=1  => deterministic manual frame-stepping for headless
                 webm capture via __renderPlay/__renderAdvance.

   12 DISTINCT MOTIONS (transform/opacity/filter only): each event
   maps to a `motion` keyword that sets a #stage.m-<motion> class
   (CSS @keyframes drive the live entrance) AND a matching numeric
   path in render mode so capture reproduces the exact entrance.
   donation/cheer/superchat add #stage.amt-emph so the AMOUNT reads
   as the headline. Long viewer names are clamped to one line.
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
     glyph  : icon in the star plate
     kicker : soft-caps event line (FUNCTIONAL label — kept)
     sub    : ships "" so the card is clean (no flavor text)
     motion : the DISTINCT entrance keyword (drives #stage.m-<motion> +
              the matching render-mode path) — every event differs
     motes  : how many star-dust motes the burst spits (raid/host bigger)
     amount : true => show + emphasize the amount line (cheer/donation/superchat)
     amtPre/amtSuf : wraps a bare numeric amount ($ / bits / raiders / etc.) */
  const EVENTS = {
    follower:   { glyph: "✦", kicker: "NEW FOLLOWER",   sub: "", motion: "driftleft",  motes: 16, amount: false },
    subscriber: { glyph: "✧", kicker: "NEW SUBSCRIBER", sub: "", motion: "bloom",      motes: 22, amount: false },
    member:     { glyph: "❂", kicker: "NEW MEMBER",     sub: "", motion: "descend",    motes: 20, amount: false },
    cheer:      { glyph: "✺", kicker: "CHEER",          sub: "", motion: "rise",       motes: 24, amount: true,  amtPre: "", amtSuf: " bits" },
    donation:   { glyph: "♡", kicker: "DONATION",       sub: "", motion: "zoom",       motes: 26, amount: true,  amtPre: "$" },
    host:       { glyph: "☾", kicker: "NOW HOSTING",    sub: "", motion: "driftright", motes: 34, amount: true,  amtPre: "", amtSuf: " viewers" },
    raid:       { glyph: "✷", kicker: "INCOMING RAID",  sub: "", motion: "sweep",      motes: 48, amount: true,  amtPre: "", amtSuf: " raiders" },
    like:       { glyph: "❤", kicker: "NEW LIKE",       sub: "", motion: "pop",        motes: 14, amount: false },
    share:      { glyph: "➤", kicker: "SHARED",         sub: "", motion: "glidetilt",  motes: 18, amount: false },
    star:       { glyph: "★", kicker: "NEW STAR",       sub: "", motion: "twinkle",    motes: 22, amount: true,  amtPre: "", amtSuf: " stars" },
    superchat:  { glyph: "✸", kicker: "SUPER CHAT",     sub: "", motion: "drop",       motes: 28, amount: true,  amtPre: "$" },
    supporter:  { glyph: "✪", kicker: "NEW SUPPORTER",  sub: "", motion: "unfold",     motes: 24, amount: false },
  };
  const DEFAULT = EVENTS.follower;
  const MOTIONS = ["driftleft","bloom","descend","rise","zoom","driftright","sweep","pop","glidetilt","twinkle","drop","unfold"];

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

  /* ---- swap the per-event motion class on #stage (live CSS picks the @keyframes) ---- */
  function setMotionClass(motion) {
    if (!stage) return;
    for (const m of MOTIONS) stage.classList.remove("m-" + m);
    stage.classList.add("m-" + (motion || "driftleft"));
  }

  /* ---- the card elements ---- */
  const card = $id("alert");
  const glyphEl = $id("glyph");
  const kickEl = $id("kick-label");
  const nameEl = $id("name");
  const amountEl = $id("amount");
  const subEl = $id("sub");

  let hideTimer = null, busy = false, demoOn = false;

  /* ---- star-dust burst on a transparent canvas (delta-clamped rAF) ---- */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const TINT = ["#FFFFFF", "#F2C6FF", "#B8A4FF", "#D9CCFF"];
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the card's glyph plate (lower-left of the stage)
  function spawnBurst(n) {
    const ox = 250, oy = H - 210;
    for (let i = 0; i < n; i++) {
      burst.push({
        x: ox + R(-50, 110), y: oy + R(-60, 50),
        vx: R(10, 150) / 60, vy: R(-180, -40) / 60,
        g: R(50, 120) / 3600,             // gentle drift (dreamy, not gravity-heavy)
        s: R(2, 5), rot: R(0, 6.28), vr: R(-3, 3) / 60,
        a: 1, life: R(1.6, 2.8), tw: R(0.8, 2.0), ph: R(0, 6.28),
        c: TINT[(Math.random() * TINT.length) | 0],
      });
    }
  }

  function drawMote(p) {
    // a tiny soft star diamond — a fleck of star-dust
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    const tw = 0.6 + Math.sin(p.ph) * 0.4;
    ctx.globalAlpha = Math.max(0, p.a) * tw;
    ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 10;
    const s = p.s;
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr; p.ph += 0.12;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 60) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  window.__dreamAlertDraw = frame; // rAF-independent verification hook

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

  /* ---- shared populate: set glyph / kicker / name / amount / sub + amount class ---- */
  function populate(cfg, name, amountStr) {
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
    if (subEl) subEl.textContent = cfg.sub || "";
    if (amountEl) amountEl.textContent = amountStr;
    const showAmt = !!(cfg.amount && amountStr);
    card.classList.toggle("has-amount", showAmt);
    // amount-emphasis events (cheer/donation/superchat) bump the amount via #stage.amt-emph
    if (stage) stage.classList.toggle("amt-emph", showAmt && (cfg.motion === "rise" || cfg.motion === "zoom" || cfg.motion === "drop"));
  }

  /* ---- play(): drive one alert through its DISTINCT choreography ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "NewStar";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    setMotionClass(cfg.motion);
    populate(cfg, name, amountStr);

    // restart the entrance animation cleanly
    card.classList.remove("hide", "show");
    void card.offsetWidth; // force reflow so re-adding .show replays it
    card.classList.add("show");

    // star-dust burst (staggered a touch so it reads after the entrance)
    setTimeout(() => spawnBurst(cfg.motes), 240);
    // raid/host get a second pop for "bigger" feel
    if (cfg.motes >= 30) setTimeout(() => spawnBurst(Math.round(cfg.motes * 0.6)), 660);

    // hold, then dissolve out
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show");
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1700);
      }, 540);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then loop every few seconds ---- */
  function demoData() {
    return {
      type: pageType(),
      name: params.get("name") || "NewStar",
      amount: params.get("amount") != null ? params.get("amount") : "5",
    };
  }
  function startDemo() {
    demoOn = true;
    play(demoData());
  }

  /* ============================================================
     DETERMINISTIC RENDER MODE
     Reproduce each DISTINCT entrance numerically (no CSS animation):
     a per-motion from-state {x,y,sx,sy,rot,blur} eased to rest, then
     a shared dissolve-out. Mirrors the @keyframes closely enough for
     a clean capture. 1 frame = 1/30s.
     ============================================================ */
  let _cfg = DEFAULT, _f = 0, _b1 = false, _b2 = false, _dur = 720;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  // each motion: entrance duration (ms) + a function(p) -> {x,y,sx,sy,rot,blur,op}
  // p is 0..1 eased progress. Resting state is x=0,y=0,sx=1,sy=1,rot=0,blur=0,op=1.
  const MOTION_FN = {
    driftleft:  { dur: 720, f: (p) => ({ x: -720 * (1 - p) + 28 * Math.sin(p * Math.PI), op: Math.min(1, p * 1.5), blur: 7 * (1 - p) }) },
    bloom:      { dur: 860, f: (p) => ({ sx: 0.7 + 0.3 * p + 0.05 * Math.sin(p * Math.PI), sy: 0.7 + 0.3 * p + 0.05 * Math.sin(p * Math.PI), op: Math.min(1, p * 1.6), blur: 12 * (1 - p) }) },
    descend:    { dur: 820, f: (p) => ({ y: -300 * (1 - p) + 22 * Math.sin(p * Math.PI), op: Math.min(1, p * 1.5), blur: 8 * (1 - p) }) },
    rise:       { dur: 800, f: (p) => ({ y: 320 * (1 - p) - 22 * Math.sin(p * Math.PI), op: Math.min(1, p * 1.5), blur: 8 * (1 - p) }) },
    zoom:       { dur: 860, f: (p) => ({ sx: 1.32 - 0.32 * p + 0.03 * Math.sin(p * Math.PI), sy: 1.32 - 0.32 * p + 0.03 * Math.sin(p * Math.PI), op: Math.min(1, p * 1.7), blur: 14 * (1 - p) }) },
    driftright: { dur: 760, f: (p) => ({ x: 720 * (1 - p) - 28 * Math.sin(p * Math.PI), op: Math.min(1, p * 1.5), blur: 7 * (1 - p) }) },
    sweep:      { dur: 780, f: (p) => ({ x: -940 * (1 - p) + 46 * Math.sin(p * Math.PI), sx: 1 + 0.04 * (1 - p), sy: 1 + 0.04 * (1 - p), op: Math.min(1, p * 1.7), blur: 9 * (1 - p) }) },
    pop:        { dur: 700, f: (p) => ({ sx: 0.82 + 0.18 * p + 0.07 * Math.sin(p * Math.PI), sy: 0.82 + 0.18 * p + 0.07 * Math.sin(p * Math.PI), op: Math.min(1, p * 1.8), blur: 6 * (1 - p) }) },
    glidetilt:  { dur: 800, f: (p) => ({ x: -90 * (1 - p) + 8 * Math.sin(p * Math.PI), y: 80 * (1 - p) - 8 * Math.sin(p * Math.PI), rot: -3 * (1 - p) + 1.2 * Math.sin(p * Math.PI), op: Math.min(1, p * 1.5), blur: 8 * (1 - p) }) },
    twinkle:    { dur: 840, f: (p) => ({ sx: 0.4 + 0.6 * p + 0.05 * Math.sin(p * Math.PI), sy: 0.4 + 0.6 * p + 0.05 * Math.sin(p * Math.PI), rot: -8 * (1 - p) + 2 * Math.sin(p * Math.PI), op: Math.min(1, p * 1.6), blur: 12 * (1 - p) }) },
    drop:       { dur: 820, f: (p) => ({ y: -360 * (1 - p) + 20 * Math.sin(p * Math.PI), op: Math.min(1, p * 1.6), blur: 7 * (1 - p) }) },
    unfold:     { dur: 820, f: (p) => ({ sx: 0.16 + 0.84 * p + 0.03 * Math.sin(p * Math.PI), sy: 0.86 + 0.14 * p, op: Math.min(1, p * 1.6), blur: 10 * (1 - p) }) },
  };

  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "NewStar");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    setMotionClass(_cfg.motion);
    populate(_cfg, name, amountStr);
    _dur = (MOTION_FN[_cfg.motion] || MOTION_FN.driftleft).dur;
    card.classList.remove("show", "hide");
    _f = 0; _b1 = false; _b2 = false; burst = [];
  }

  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const ENTER = _dur, HOLD = 4200, EXIT = 540, holdEnd = ENTER + HOLD;
    const mfn = (MOTION_FN[_cfg.motion] || MOTION_FN.driftleft).f;

    let x = 0, y = 0, sx = 1, sy = 1, rot = 0, blur = 0, op = 1;
    if (ms < ENTER) {
      const p = easeOut(ms / ENTER);
      const st = mfn(p);
      x = st.x || 0; y = st.y || 0;
      sx = (st.sx == null) ? 1 : st.sx; sy = (st.sy == null) ? 1 : st.sy;
      rot = st.rot || 0; blur = st.blur || 0;
      op = (st.op == null) ? 1 : st.op;
    } else if (ms < holdEnd) {
      x = 0; y = 0; sx = 1; sy = 1; rot = 0; blur = 0; op = 1;
    } else {
      const p = Math.min(1, (ms - holdEnd) / EXIT);
      y = 26 * easeOut(p); sx = 1 - 0.02 * p; sy = sx; blur = 4 * p; op = 1 - p;
    }
    if (card) {
      card.style.transform =
        "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" +
        sx.toFixed(3) + "," + sy.toFixed(3) + ") rotate(" + rot.toFixed(2) + "deg)";
      card.style.opacity = op.toFixed(3);
      card.style.filter = blur > 0.05 ? "blur(" + blur.toFixed(2) + "px)" : "none";
    }
    // glyph pop (mirrors the CSS glyph-pop)
    const glyph = card && card.querySelector(".glyph");
    if (glyph) {
      const gp = (ms - 180) / 700;
      const gs = gp <= 0 ? 0.4 : gp >= 1 ? 1 : (gp < 0.6 ? 0.4 + (gp / 0.6) * 0.72 : 1.12 - ((gp - 0.6) / 0.4) * 0.12);
      glyph.style.transform = "scale(" + Math.max(0, gs).toFixed(3) + ")"; glyph.style.opacity = gp <= 0 ? "0" : "1";
    }
    if (ms >= 240 && !_b1) { _b1 = true; spawnBurst(_cfg.motes); }
    if (_cfg.motes >= 30 && ms >= 660 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.motes * 0.6)); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo after a tiny delay (skipped in render mode)
  if (!render) setTimeout(startDemo, 400);
})();
