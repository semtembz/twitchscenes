/* ============================================================
   MYTHFORGE KEEP — alert engine ("The Quest Notice")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography + copy. Auto-plays a looping DEMO on load.
   Read ?type=&name=&amount= to override the demo data/event.
   Delta-clamped rAF EMBER/ASH burst (transparent canvas).
   ?noname=1  => big line shows the EVENT label, kicker hides
                 the viewer name (this is how clips ship).
   ?render=1  => deterministic manual frame-stepping for headless
                 webm capture via __renderPlay/__renderAdvance.
   Each of the 12 events has a DISTINCT entrance motion (CSS in
   live mode via data-anim; mirrored deterministically in render
   mode here). Donation / cheer / superchat emphasize the amount.
   No audio ships.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  // noname: render the card with NO baked viewer name (the big line shows the event
  // instead, and the streamer's Streamlabs/StreamElements overlays the live name).
  const noname = params.get("noname") === "1" || params.get("noname") === "true";
  // render mode: deterministic manual frame-stepping for headless webm capture.
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
     glyph  : sigil struck into the iron seal-plate
     kicker : engraved event line ("NEW FOLLOWER", etc.)
     sub    : little aged-italic sub-line
     motes  : how many ember/ash motes the burst spits (raid/host bigger)
     amount : true => emphasize the amount line (cheer/donation/superchat/etc.)
     amtPre/amtSuf : decoration for a bare numeric amount
     anim   : the CSS data-anim key (distinct entrance per event) */
  const EVENTS = {
    follower:   { glyph: "❧", kicker: "NEW FOLLOWER",   sub: "a new traveler joins the party", motes: 18, amount: false, anim: "follower" },
    subscriber: { glyph: "✠", kicker: "NEW SUBSCRIBER", sub: "sworn to the keep",              motes: 24, amount: false, anim: "subscriber" },
    member:     { glyph: "❖", kicker: "NEW MEMBER",     sub: "pledged to the order",           motes: 24, amount: false, anim: "member" },
    cheer:      { glyph: "✦", kicker: "CHEER",          sub: "coin tossed in your honor",      motes: 28, amount: true,  amtPre: "", amtSuf: " bits", anim: "cheer" },
    donation:   { glyph: "♦", kicker: "DONATION",       sub: "a bounty for the quest",         motes: 30, amount: true,  amtPre: "$", anim: "donation" },
    host:       { glyph: "⚜", kicker: "NOW HOSTING",    sub: "the gates swing open",           motes: 36, amount: true,  amtPre: "", amtSuf: " guests", anim: "host" },
    raid:       { glyph: "⚔", kicker: "RAID INCOMING",  sub: "the horde storms the keep",      motes: 50, amount: true,  amtPre: "", amtSuf: " raiders", anim: "raid" },
    like:       { glyph: "❤", kicker: "NEW LIKE",       sub: "favor granted",                  motes: 14, amount: false, anim: "like" },
    share:      { glyph: "➤", kicker: "SHARED",         sub: "the tale is carried onward",     motes: 18, amount: false, anim: "share" },
    star:       { glyph: "★", kicker: "NEW STAR",       sub: "a banner raised on high",        motes: 24, amount: true,  amtPre: "", amtSuf: " stars", anim: "star" },
    superchat:  { glyph: "✸", kicker: "SUPER CHAT",     sub: "a sealed message for the hall",  motes: 30, amount: true,  amtPre: "$", anim: "superchat" },
    supporter:  { glyph: "✪", kicker: "NEW SUPPORTER",  sub: "you keep the hearth burning",    motes: 24, amount: false, anim: "supporter" },
  };
  const DEFAULT = EVENTS.follower;
  const ORDER = ["follower","subscriber","member","cheer","donation","host","raid","like","share","star","superchat","supporter"];

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

  /* ---- the notice elements ---- */
  const card = $id("alert");
  const glyphEl = $id("glyph");
  const kickEl = $id("kick-label");
  const nameEl = $id("name");
  const amountEl = $id("amount");
  const subEl = $id("sub");

  let hideTimer = null, busy = false, demoOn = false;

  /* ---- ember/ash burst on a transparent canvas (delta-clamped rAF) ---- */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  // warm embers (gold/orange) + cooler grey ash, like shared.js
  const EMBER = ["240,206,122", "201,150,47", "201,120,47"];
  const ASH = "200,196,188";
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // burst originates near the iron seal-plate (lower-left of the stage, behind the notice)
  function spawnBurst(n) {
    const ox = 230, oy = H - 230;
    for (let i = 0; i < n; i++) {
      const ash = Math.random() < 0.33;
      burst.push({
        x: ox + R(-60, 120), y: oy + R(-70, 60),
        vx: R(-40, 120) / 60, vy: R(-220, -60) / 60,
        g: R(60, 120) / 3600,                  // slight gravity, embers mostly rise
        s: R(2, 5), a: 1, life: R(1.6, 3.0),
        ash, ph: R(0, 6.28), tws: R(0.06, 0.16),
        col: ash ? ASH : EMBER[(Math.random() * EMBER.length) | 0],
      });
    }
  }

  function drawMote(p) {
    // a tiny rising ember (warm, glowing) or cool grey ash fleck
    const tw = p.ash ? (0.5 + Math.sin(p.ph * 0.8) * 0.25) : (0.45 + Math.sin(p.ph * 1.9) * 0.55);
    ctx.globalAlpha = Math.max(0, p.a * tw);
    ctx.fillStyle = "rgb(" + p.col + ")";
    if (p.ash) { ctx.shadowBlur = 0; }
    else { ctx.shadowColor = "rgb(" + p.col + ")"; ctx.shadowBlur = 10; }
    const s = Math.max(1, Math.round(p.s));
    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.ph += p.tws;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y < -60) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  window.__mythAlertDraw = frame; // rAF-independent verification hook

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

  /* ---- populate the notice DOM for an event ---- */
  function populate(type, name, amountStr) {
    const cfg = EVENTS[type] || DEFAULT;
    if (glyphEl) glyphEl.textContent = cfg.glyph;
    const kickLine = card.querySelector(".kick");
    if (noname) {
      // shipping mode: big line shows the EVENT label, hide the viewer name + kicker line
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
    if (card) card.setAttribute("data-anim", cfg.anim || "supporter");
    return cfg;
  }

  /* ---- play(): drive one alert through its choreography ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "NewHero";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    populate(type, name, amountStr);

    // restart the entrance animation cleanly
    card.classList.remove("hide", "show");
    void card.offsetWidth; // force reflow so re-adding .show replays it
    card.classList.add("show");

    // ember/ash burst (staggered a touch so it reads after the entrance)
    setTimeout(() => spawnBurst(cfg.motes), 200);
    // raid/host get a second pop for "bigger" feel
    if (cfg.motes >= 34) setTimeout(() => spawnBurst(Math.round(cfg.motes * 0.6)), 600);

    // hold, then exit
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show");
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        // if running the demo loop, queue the next one after a short gap
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1600);
      }, 520);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then loop ---- */
  function demoData() {
    return {
      type: pageType(),
      name: params.get("name") || "NewHero",
      amount: params.get("amount") != null ? params.get("amount") : "5",
    };
  }
  function startDemo() {
    demoOn = true;
    play(demoData());
  }

  /* ============================================================
     DETERMINISTIC RENDER MODE
     Drive one full play via manual 1/30s frame steps. CSS entrance
     animations are frozen in render mode, so we reproduce each
     event's DISTINCT motion here as a function of elapsed ms.
     ============================================================ */
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  // settle/overshoot helper: 0..1 progress -> eased value that overshoots to `over` near `peak`
  function overshoot(p, peak, over) {
    if (p <= 0) return 0; if (p >= 1) return 1;
    if (p < peak) return easeOut(p / peak) * (1 + over);
    return (1 + over) - easeOut((p - peak) / (1 - peak)) * over;
  }

  // produce the inline transform/opacity for a given event at progress p (0..1 of the entrance)
  function entranceStyle(anim, p) {
    let t = "", op = Math.min(1, p / 0.5); // most reach full opacity by halfway
    switch (anim) {
      case "follower": { // drop in from above + settle
        const v = overshoot(p, 0.62, 0.12); // 0->1 overshoot
        const y = -120 + v * 120; const r = -3 + v * 3;
        t = `translateY(${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg)`; break;
      }
      case "subscriber": { // heraldic rise + scale
        const v = overshoot(p, 0.64, 0.03);
        const y = 90 - v * 90; const s = 0.86 + v * 0.14;
        t = `translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`; break;
      }
      case "member": { // oath unfurl (rotateY)
        const v = overshoot(p, 0.70, 0.11);
        const ry = -72 + v * 72;
        t = `perspective(1200px) rotateY(${ry.toFixed(2)}deg)`; break;
      }
      case "cheer": { // coin-toss flip (rotateX)
        const v = overshoot(p, 0.66, 0.12);
        const rx = 86 - v * 86; const y = -30 + v * 30;
        t = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) translateY(${y.toFixed(1)}px)`; break;
      }
      case "donation": { // treasure drop with weighty bounce
        let y, s = 1;
        if (p < 0.58) { y = -160 + easeOut(p / 0.58) * 160; s = 1.06 - (p / 0.58) * 0.06; }
        else if (p < 0.72) { const q = (p - 0.58) / 0.14; y = -16 * Math.sin(q * Math.PI); s = 1; }
        else { y = 0; s = 1; }
        t = `translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)})`; break;
      }
      case "host": { // gates swing from lower-left hinge
        const v = overshoot(p, 0.68, 0.17);
        const r = -14 + v * 14; const x = -90 + v * 90;
        t = `rotate(${r.toFixed(2)}deg) translateX(${x.toFixed(1)}px)`; break;
      }
      case "raid": { // hard charge from off-left + skew overshoot
        const v = overshoot(p, 0.74, 0.031);
        const x = -1100 + v * 1100; const sk = 10 - v * 10;
        t = `translateX(${x.toFixed(1)}px) skewX(${sk.toFixed(2)}deg)`; break;
      }
      case "like": { // soft bloom
        const v = easeOut(p); const s = 0.78 + v * 0.22;
        t = `scale(${s.toFixed(3)})`; op = easeOut(p); break;
      }
      case "share": { // diagonal glide from lower-left
        const v = overshoot(p, 0.72, 0.01);
        const x = -160 + v * 160; const y = 120 - v * 120; const s = 0.92 + v * 0.08;
        t = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(3)})`; break;
      }
      case "star": { // marquee strike zoom-down stamp
        const v = overshoot(p, 0.56, 0.04);
        const s = 1.5 - v * 0.5; const r = 6 - v * 6;
        t = `scale(${s.toFixed(3)}) rotate(${r.toFixed(2)}deg)`; break;
      }
      case "superchat": { // banner sweep from the right
        const v = overshoot(p, 0.72, 0.052);
        const x = 420 - v * 420; const s = 0.97 + v * 0.03;
        t = `translateX(${x.toFixed(1)}px) scale(${s.toFixed(3)})`; break;
      }
      case "supporter":
      default: { // steady vertical lift
        const v = easeOut(p); const y = 64 - v * 64;
        t = `translateY(${y.toFixed(1)}px)`; break;
      }
    }
    return { transform: t, opacity: Math.min(1, op).toFixed(3) };
  }

  let _cfg = DEFAULT, _anim = "supporter", _f = 0, _b1 = false, _b2 = false;
  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[type] || DEFAULT;
    _anim = _cfg.anim || "supporter";
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "NewHero");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    populate(type, name, amountStr);
    card.classList.remove("show", "hide");
    _f = 0; _b1 = false; _b2 = false; burst = [];
    // freeze the burst-driven sub-elements to final state (CSS .render handles statics)
  }
  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const ENTER = 720, HOLD = 4200, EXIT = 520, holdEnd = ENTER + HOLD;
    if (card) {
      if (ms < ENTER) {
        const st = entranceStyle(_anim, ms / ENTER);
        card.style.transform = st.transform; card.style.opacity = st.opacity;
      } else if (ms < holdEnd) {
        card.style.transform = "none"; card.style.opacity = "1";
      } else { // shared exit
        const p = Math.min(1, (ms - holdEnd) / EXIT);
        const y = 46 * easeOut(p); const s = 1 - 0.05 * p; const r = -1 * p;
        card.style.transform = `translateY(${y.toFixed(1)}px) scale(${s.toFixed(3)}) rotate(${r.toFixed(2)}deg)`;
        card.style.opacity = (1 - p).toFixed(3);
      }
    }
    // ember/ash bursts (staggered like live JS)
    if (ms >= 200 && !_b1) { _b1 = true; spawnBurst(_cfg.motes); }
    if (_cfg.motes >= 34 && ms >= 600 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.motes * 0.6)); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo after a tiny delay (skipped in render mode)
  if (!render) setTimeout(startDemo, 400);

  // expose the event order for the export driver
  window.__alertOrder = ORDER;
})();
