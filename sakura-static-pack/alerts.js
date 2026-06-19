/* ============================================================
   SAKURA STATIC — alert engine ("lo-fi anime night")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography + copy. Auto-plays a looping DEMO on load.
   Read ?type=&name=&amount= to override the demo data/event.
   Delta-clamped rAF petal burst (transparent canvas).
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);

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
     sub    : little mono sub-line (use {name} token)
     petals : how many petals the burst spits (raid/host bigger)
     amount : true => emphasize the amount line (cheer/donation/superchat)
     amtPre : text shown before a bare numeric amount ($, bits, etc.) */
  const EVENTS = {
    follower:   { glyph: "❀", kicker: "NEW FOLLOWER",   sub: "welcome to the garden", petals: 14, amount: false },
    subscriber: { glyph: "✿", kicker: "NEW SUB",          sub: "thank you for subbing", petals: 18, amount: false },
    member:     { glyph: "✦", kicker: "NEW MEMBER",       sub: "welcome, member",        petals: 18, amount: false },
    cheer:      { glyph: "✧", kicker: "CHEER",            sub: "bits dropped",          petals: 22, amount: true,  amtPre: "" , amtSuf: " bits" },
    donation:   { glyph: "♥", kicker: "DONATION",         sub: "thank you so much",     petals: 24, amount: true,  amtPre: "$" },
    host:       { glyph: "⛩", kicker: "NOW HOSTING",      sub: "incoming friends",      petals: 30, amount: true,  amtPre: "", amtSuf: " viewers" },
    raid:       { glyph: "⛩", kicker: "RAID INCOMING",    sub: "brace for the wave",    petals: 40, amount: true,  amtPre: "", amtSuf: " raiders" },
    like:       { glyph: "❤", kicker: "NEW LIKE",         sub: "appreciated",           petals: 12, amount: false },
    share:      { glyph: "➤", kicker: "SHARED",           sub: "thanks for spreading it", petals: 16, amount: false },
    star:       { glyph: "★", kicker: "NEW STAR",         sub: "shining bright",        petals: 20, amount: true,  amtPre: "", amtSuf: " stars" },
    superchat:  { glyph: "✸", kicker: "SUPER CHAT",       sub: "message pinned",        petals: 26, amount: true,  amtPre: "$" },
    supporter:  { glyph: "✪", kicker: "NEW SUPPORTER",    sub: "you keep this going",   petals: 22, amount: false },
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
    // if the caller already included a symbol, leave it alone
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

  /* ---- petal burst on a transparent canvas (delta-clamped rAF) ---- */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const PINKS = ["#FF5E9C", "#FFD1E6", "#7B2D5E", "#FF9EC4"];
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the card's icon tile (lower-left of the stage)
  function spawnBurst(n) {
    const ox = 240, oy = H - 210;
    for (let i = 0; i < n; i++) {
      burst.push({
        x: ox + R(-40, 90), y: oy + R(-50, 40),
        vx: R(20, 180) / 60, vy: R(-150, -40) / 60,
        g: R(80, 150) / 3600, // gravity per frame-ish
        s: R(14, 30), rot: R(0, 6.28), vr: R(-2.4, 2.4) / 60,
        a: 1, life: R(1.6, 2.8),
        c: PINKS[(Math.random() < 0.5) ? 0 : 1],
      });
    }
  }

  function drawPetal(p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.a); ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 10;
    const s = p.s;
    ctx.beginPath(); ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.6, -s * 0.6, s * 0.5, s * 0.5, 0, s);
    ctx.bezierCurveTo(-s * 0.5, s * 0.5, -s * 0.6, -s * 0.6, 0, -s); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = Math.max(0, p.a) * 0.5; ctx.fillStyle = "rgba(14,10,18,0.6)";
    ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(-s * 0.12, s * 0.6); ctx.lineTo(s * 0.12, s * 0.6); ctx.closePath(); ctx.fill();
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
      drawPetal(p);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  window.__sakuraDraw = frame; // rAF-independent verification hook

  if (ctx) {
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
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "NewFriend";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    // populate
    if (glyphEl) glyphEl.textContent = cfg.glyph;
    if (kickEl) kickEl.textContent = cfg.kicker;
    if (nameEl) nameEl.textContent = name;
    if (subEl) subEl.textContent = cfg.sub.replace("{name}", name);
    if (amountEl) amountEl.textContent = amountStr;
    card.classList.toggle("has-amount", !!(cfg.amount && amountStr));

    // restart the entrance animation cleanly
    card.classList.remove("hide", "show");
    void card.offsetWidth; // force reflow so re-adding .show replays it
    card.classList.add("show");

    // petals burst (staggered a touch so it reads after the slide-in)
    setTimeout(() => spawnBurst(cfg.petals), 220);
    // raid/host get a second pop for "bigger" feel
    if (cfg.petals >= 26) setTimeout(() => spawnBurst(Math.round(cfg.petals * 0.6)), 620);

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
      name: params.get("name") || "NewFriend",
      amount: params.get("amount") != null ? params.get("amount") : "5",
    };
  }
  function startDemo() {
    // self-chaining loop: each cycle (~.62 in + 4.2 hold + .5 out) queues the
    // next from its own completion, so beats never drift or overlap.
    demoOn = true;
    play(demoData());
  }
  // kick off after a tiny delay so fonts/layout settle (not gated on rAF)
  setTimeout(startDemo, 400);
})();
