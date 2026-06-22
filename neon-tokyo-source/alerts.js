/* ============================================================
   NEON TOKYO — alert engine ("Midnight Akihabara")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography + copy. Auto-plays a looping DEMO on load.
   Read ?type=&name=&amount= to override the demo data/event.
   Delta-clamped rAF SPARK/RAIN burst (transparent canvas).
   ?noname=1  => big line shows the EVENT label, kicker hides.
   ?render=1  => deterministic manual frame-stepping for headless
                 webm capture via __renderPlay/__renderAdvance.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  // noname: render the chip with NO baked viewer name (the big line shows the event
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
     glyph  : icon in the tile
     kicker : mono event line
     sub    : little mono sub-line
     sparks : how many sparks the burst spits (raid/host bigger)
     amount : true => emphasize the amount line (cheer/donation/superchat)
     amtPre : text shown before a bare numeric amount ($, bits, etc.) */
  // sub: a small flavor sub-line. Neutralized to "" per the NO-CRINGE COPY
  // STANDARD — the event kicker, viewer name and amount stay (functional). A
  // streamer can drop their own line back in by setting a sub here.
  const EVENTS = {
    follower:   { glyph: "▶", kicker: "NEW FOLLOWER",  sub: "",  sparks: 16, amount: false },
    subscriber: { glyph: "◆", kicker: "NEW SUB",        sub: "",  sparks: 20, amount: false },
    member:     { glyph: "❖", kicker: "NEW MEMBER",     sub: "",  sparks: 20, amount: false },
    cheer:      { glyph: "✦", kicker: "CHEER",          sub: "",  sparks: 24, amount: true,  amtPre: "", amtSuf: " bits" },
    donation:   { glyph: "❤", kicker: "DONATION",       sub: "",  sparks: 26, amount: true,  amtPre: "$" },
    host:       { glyph: "⛩", kicker: "NOW HOSTING",    sub: "",  sparks: 34, amount: true,  amtPre: "", amtSuf: " viewers" },
    raid:       { glyph: "卍", kicker: "RAID INCOMING",  sub: "",  sparks: 46, amount: true,  amtPre: "", amtSuf: " raiders" },
    like:       { glyph: "♥", kicker: "NEW LIKE",       sub: "",  sparks: 14, amount: false },
    share:      { glyph: "➤", kicker: "SHARED",         sub: "",  sparks: 18, amount: false },
    star:       { glyph: "★", kicker: "NEW STAR",       sub: "",  sparks: 22, amount: true,  amtPre: "", amtSuf: " stars" },
    superchat:  { glyph: "✸", kicker: "SUPER CHAT",     sub: "",  sparks: 28, amount: true,  amtPre: "$" },
    supporter:  { glyph: "◈", kicker: "NEW SUPPORTER",  sub: "",  sparks: 24, amount: false },
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

  /* ---- the chip elements ---- */
  const card = $id("alert");
  const glyphEl = $id("glyph");
  const kickEl = $id("kick-label");
  const nameEl = $id("name");
  const amountEl = $id("amount");
  const subEl = $id("sub");

  let hideTimer = null, busy = false, demoOn = false;

  /* ---- spark / rain burst on a transparent canvas (delta-clamped rAF) ---- */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const SPARK = ["#00E0FF", "#FF2D95", "#FFD400", "#7A3CFF"];
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the chip's glyph tile (lower-left of the stage)
  function spawnBurst(n) {
    const ox = 250, oy = H - 210;
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      burst.push({
        x: ox + R(-50, 110), y: oy + R(-60, 50),
        vx: R(40, 260) / 60 * (dir < 0 ? -0.4 : 1), vy: R(-220, -60) / 60,
        g: R(120, 220) / 3600,            // gravity per frame-ish
        len: R(10, 26), w: R(2, 4),
        a: 1, life: R(1.1, 2.2),
        c: SPARK[(Math.random() * SPARK.length) | 0],
      });
    }
  }

  function drawSpark(p) {
    // a neon streak (like a rain shard) drawn along its velocity vector
    const sp = Math.hypot(p.vx, p.vy) || 1;
    const ux = p.vx / sp, uy = p.vy / sp;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.a);
    ctx.strokeStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 12;
    ctx.lineWidth = p.w; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - ux * p.len, p.y - uy * p.len);
    ctx.stroke();
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 60) { burst.splice(i, 1); continue; }
      drawSpark(p);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  window.__neonDraw = frame; // rAF-independent verification hook

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
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "NewUser";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

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
    if (subEl) subEl.textContent = cfg.sub;
    if (amountEl) amountEl.textContent = amountStr;
    card.classList.toggle("has-amount", !!(cfg.amount && amountStr));

    // restart the entrance animation cleanly
    card.classList.remove("hide", "show");
    void card.offsetWidth; // force reflow so re-adding .show replays it
    card.classList.add("show");

    // spark burst (staggered a touch so it reads after the slide-in)
    setTimeout(() => spawnBurst(cfg.sparks), 220);
    // raid/host get a second pop for "bigger" feel
    if (cfg.sparks >= 30) setTimeout(() => spawnBurst(Math.round(cfg.sparks * 0.6)), 620);

    // hold, then slide out
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
      name: params.get("name") || "NewUser",
      amount: params.get("amount") != null ? params.get("amount") : "5",
    };
  }
  function startDemo() {
    // self-chaining loop: each cycle (~.62 in + 4.2 hold + .5 out) queues the
    // next from its own completion, so beats never drift or overlap.
    demoOn = true;
    play(demoData());
  }

  /* ---- deterministic render mode: drive one full play via manual frame steps ---- */
  let _cfg = DEFAULT, _f = 0, _b1 = false, _b2 = false;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "NewUser");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    if (glyphEl) glyphEl.textContent = _cfg.glyph;
    const kickLine = card.querySelector(".kick");
    if (noname) { if (kickLine) kickLine.style.display = "none"; if (nameEl) nameEl.textContent = _cfg.kicker; }
    else { if (kickLine) kickLine.style.display = ""; if (kickEl) kickEl.textContent = _cfg.kicker; if (nameEl) nameEl.textContent = name; }
    if (subEl) subEl.textContent = _cfg.sub;
    if (amountEl) amountEl.textContent = amountStr;
    card.classList.toggle("has-amount", !!(_cfg.amount && amountStr));
    card.classList.remove("show", "hide");
    _f = 0; _b1 = false; _b2 = false; burst = [];
  }
  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const settle = 434, ENTER = 620, HOLD = 4200, EXIT = 520, holdEnd = ENTER + HOLD;
    let x, op;
    if (ms < settle) { const p = easeOut(ms / settle); x = -980 + p * 1002; op = Math.min(1, ms / settle); }  // slide in (overshoot to +22)
    else if (ms < ENTER) { const p = (ms - settle) / (ENTER - settle); x = 22 - p * 22; op = 1; }              // settle to 0
    else if (ms < holdEnd) { x = 0; op = 1; }                                                                   // hold
    else { const p = Math.min(1, (ms - holdEnd) / EXIT); x = -980 * easeOut(p); op = 1 - p; }                  // slide out
    if (card) { card.style.transform = "translateX(" + x.toFixed(1) + "px)"; card.style.opacity = op.toFixed(3); }
    const glyph = card && card.querySelector(".glyph");
    if (glyph) {
      const gp = (ms - 180) / 700;
      const gs = gp <= 0 ? 0.4 : gp >= 1 ? 1 : (gp < 0.6 ? 0.4 + (gp / 0.6) * 0.72 : 1.12 - ((gp - 0.6) / 0.4) * 0.12);
      glyph.style.transform = "scale(" + Math.max(0, gs).toFixed(3) + ")"; glyph.style.opacity = gp <= 0 ? "0" : "1";
    }
    if (ms >= 220 && !_b1) { _b1 = true; spawnBurst(_cfg.sparks); }
    if (_cfg.sparks >= 30 && ms >= 620 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.sparks * 0.6)); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo after a tiny delay (skipped in render mode)
  if (!render) setTimeout(startDemo, 400);
})();
