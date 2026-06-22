/* ============================================================
   HALFTONE HAVOC — alert engine ("Inkstorm Alerts")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography + copy. Auto-plays a looping DEMO on load.
   Read ?type=&name=&amount= to override the demo data/event.
   Delta-clamped rAF speed-line + ink-fleck burst (transparent canvas).
   ?noname=1  => big line shows the EVENT label, kicker hides (ship mode).
   ?render=1  => deterministic manual frame-stepping for headless webm
                 capture via window.__renderPlay/__renderAdvance.
   Every optional element is null-guarded. No audio ships.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  // noname: render the card with NO baked viewer name (the big line shows the
  // event label instead; the streamer's alert platform overlays the live name).
  const noname = params.get("noname") === "1" || params.get("noname") === "true";
  // render mode: deterministic manual frame-stepping for headless webm capture.
  const render = params.get("render") === "1";
  const stage = $id("stage");
  if (render && stage) stage.classList.add("render");

  /* ---- fit the 1920x1080 stage to the window (mirrors shared.js) ---- */
  function fit() {
    const iw = window.innerWidth, ih = window.innerHeight;
    if (iw < 10 || ih < 10) return;            // never write --scale:0
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- ink colours (mirror shared.js / shared.css tokens, in lockstep) ---- */
  const INK = "#111111", YEL = "#FFD400", RED = "#FF3B30", BLU = "#1E63FF", PAPER = "#FFFFFF";

  /* ---- per-event choreography table ----
     glyph  : comic icon inside the starburst tile
     kicker : spaced comic-caps event line (and the noname headline)
     sub    : little inked sub-line
     tone   : card accent — "blue" | "red" | "yellow" (corner wedge, name shadow,
              starburst fill, amount chip, kicker dot)
     fx     : burst flavour drawn on the canvas — "lines" | "flecks" | "both"
     bits   : how many fleck/streak particles spit (raid/host bigger)
     amount : true => emphasise the amount chip (cheer/donation/superchat/etc.)
     amtPre / amtSuf : decoration around a bare numeric amount */
  const EVENTS = {
    follower:   { glyph: "✚", kicker: "NEW FOLLOWER",  sub: "",   tone: "blue",   fx: "both",   bits: 26, amount: false },
    subscriber: { glyph: "★", kicker: "NEW SUBSCRIBER",sub: "",            tone: "yellow", fx: "flecks", bits: 30, amount: false },
    member:     { glyph: "◆", kicker: "NEW MEMBER",    sub: "",       tone: "blue",   fx: "flecks", bits: 28, amount: false },
    cheer:      { glyph: "✦", kicker: "CHEER!",        sub: "",         tone: "yellow", fx: "both",   bits: 34, amount: true,  amtPre: "", amtSuf: " BITS" },
    donation:   { glyph: "$", kicker: "DONATION!",     sub: "",     tone: "red",    fx: "both",   bits: 38, amount: true,  amtPre: "$" },
    host:       { glyph: "▶", kicker: "NOW HOSTING",   sub: "",  tone: "blue",   fx: "lines",  bits: 40, amount: true,  amtPre: "", amtSuf: " VIEWERS" },
    raid:       { glyph: "⚑", kicker: "RAID INCOMING", sub: "",      tone: "red",    fx: "lines",  bits: 52, amount: true,  amtPre: "", amtSuf: " RAIDERS" },
    like:       { glyph: "♥", kicker: "NEW LIKE",      sub: "",      tone: "red",    fx: "flecks", bits: 22, amount: false },
    share:      { glyph: "➤", kicker: "SHARED!",       sub: "",     tone: "blue",   fx: "lines",  bits: 24, amount: false },
    star:       { glyph: "✪", kicker: "NEW STAR",      sub: "",    tone: "yellow", fx: "both",   bits: 30, amount: true,  amtPre: "", amtSuf: " STARS" },
    superchat:  { glyph: "❝", kicker: "SUPER CHAT",    sub: "",  tone: "red",    fx: "both",   bits: 32, amount: true,  amtPre: "$" },
    supporter:  { glyph: "✜", kicker: "NEW SUPPORTER", sub: "",tone: "blue", fx: "flecks", bits: 28, amount: false },
  };
  const DEFAULT = EVENTS.follower;
  const TONES = { blue: BLU, red: RED, yellow: YEL };

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
  const amountEl = $id("amount-val");
  const subEl = $id("sub");

  let hideTimer = null, busy = false, demoOn = false;

  /* ---- speed-line + ink-fleck burst on a transparent canvas ---- */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const R = (a, b) => a + Math.random() * (b - a);
  const FLECK_COLS = [INK, INK, RED, BLU, YEL];   // mostly ink, splashes of pop
  let flecks = [], lines = [];

  // origin near the card's starburst tile (lower-left of the stage)
  const OX = 310, OY = H - 252;

  function spawnBurst(cfg) {
    const n = cfg.bits | 0;
    if (cfg.fx === "flecks" || cfg.fx === "both") {
      for (let i = 0; i < n; i++) {
        const a = R(-2.5, 0.6);                    // mostly up + outward
        const sp = R(80, 420) / 60;
        flecks.push({
          x: OX + R(-40, 90), y: OY + R(-50, 50),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          g: R(120, 220) / 3600, s: R(4, 12) | 0,
          rot: R(0, 6.28), vr: R(-5, 5) / 60,
          a: 1, life: R(1.2, 2.4),
          c: FLECK_COLS[(Math.random() * FLECK_COLS.length) | 0],
        });
      }
    }
    if (cfg.fx === "lines" || cfg.fx === "both") {
      const nl = cfg.fx === "lines" ? n : Math.round(n * 0.5);
      for (let i = 0; i < nl; i++) {
        const a = R(0, 6.283);
        lines.push({
          a, r0: R(40, 120), len: R(80, 260),
          spd: R(700, 1500) / 60, w: R(2, 7),
          a2: 1, life: R(0.45, 0.9),
          c: Math.random() < 0.7 ? INK : TONES[cfg.tone] || INK,
        });
      }
    }
  }

  function drawFleck(p) {
    // a small rotated ink chip (comic grit)
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, Math.min(1, p.a));
    ctx.fillStyle = p.c;
    const s = p.s;
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    // speed-line streaks shooting out from the tile
    ctx.lineCap = "round";
    for (let i = lines.length - 1; i >= 0; i--) {
      const L = lines[i];
      L.r0 += L.spd; L.life -= 1 / 30; L.a2 = Math.max(0, Math.min(1, L.life * 1.6));
      if (L.life <= 0) { lines.splice(i, 1); continue; }
      const ca = Math.cos(L.a), sa = Math.sin(L.a);
      const x0 = Math.round(OX + ca * L.r0), y0 = Math.round(OY + sa * L.r0);
      const x1 = Math.round(OX + ca * (L.r0 + L.len)), y1 = Math.round(OY + sa * (L.r0 + L.len));
      ctx.globalAlpha = L.a2 * 0.85; ctx.strokeStyle = L.c; ctx.lineWidth = L.w;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    // ink flecks
    for (let i = flecks.length - 1; i >= 0; i--) {
      const p = flecks[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 60) { flecks.splice(i, 1); continue; }
      drawFleck(p);
    }
    ctx.globalAlpha = 1;
  }
  // rAF-independent verification hook (EXACT name, matches drawHook)
  window.__halftoneAlertDraw = frame;

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

  /* ---- apply the per-event look (tone + motion class) to the card ---- */
  function applyEvent(type, cfg) {
    if (!card) return;
    // motion class: ev-<type>; tone class: tone-<tone>; noname sizing class
    card.className = "alert"; // reset to base, then add modifiers
    card.classList.add("ev-" + type);
    card.classList.add("tone-" + cfg.tone);
    if (noname) card.classList.add("noname");
  }

  /* ---- populate the card's text ---- */
  function populate(type, cfg, name, amountStr) {
    if (glyphEl) glyphEl.textContent = cfg.glyph;
    const kickLine = card ? card.querySelector(".kick") : null;
    if (noname) {
      if (kickLine) kickLine.style.display = "none";
      if (nameEl) nameEl.textContent = cfg.kicker;       // big line = event label
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
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "NewViewer";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    applyEvent(type, cfg);
    populate(type, cfg, name, amountStr);

    // restart the entrance cleanly (force reflow so re-adding .show replays it)
    card.classList.remove("hide", "show");
    void card.offsetWidth;
    card.classList.add("show");

    // burst, staggered a touch so it reads after the slam-in
    setTimeout(() => spawnBurst(cfg), 180);
    // raid/host get a second pop for the "bigger" feel
    if (cfg.bits >= 38) setTimeout(() => spawnBurst({ ...cfg, bits: Math.round(cfg.bits * 0.55) }), 560);

    // hold, then snap out
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show");
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1500);
      }, 460);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then loop ---- */
  function demoData() {
    return {
      type: pageType(),
      name: params.get("name") || "NewViewer",
      amount: params.get("amount") != null ? params.get("amount") : "500",
    };
  }
  function startDemo() { demoOn = true; play(demoData()); }

  /* ============================================================
     DETERMINISTIC RENDER MODE: drive one full play via manual
     frame steps (1 frame = 1/30s). Mirrors the live choreography
     numerically so the headless webm matches what viewers see.
     ============================================================ */
  let _cfg = DEFAULT, _type = "follower", _f = 0, _b1 = false, _b2 = false;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  // overshoot helper approximating var(--pop) cubic-bezier(.2,1.6,.35,1)
  function overshoot(p) {
    if (p <= 0) return 0; if (p >= 1) return 1;
    const c = 1.6;
    return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
  }

  function renderPlay(opts) {
    opts = opts || {};
    _type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[_type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "NewViewer");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    applyEvent(_type, _cfg);
    populate(_type, _cfg, name, amountStr);
    card.classList.remove("show", "hide");
    _f = 0; _b1 = false; _b2 = false; flecks = []; lines = [];
  }

  // resting transform per event family so the frozen final state matches CSS
  function restingRot() { return -2; }

  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const ENTER = 660, HOLD = 4200, EXIT = 460, holdEnd = ENTER + HOLD;
    let tr = "", op = 1;
    const baseRot = restingRot();

    if (ms < ENTER) {
      // generic overshoot entrance toward the resting transform; the exact
      // axis differs per event but a scale+translate overshoot reads correctly
      const p = overshoot(ms / ENTER);
      op = Math.min(1, ms / (ENTER * 0.5));
      // pick a dominant axis by event so frozen mid-frames look on-theme
      let tx = 0, ty = 0, rot = baseRot, sc = 1;
      switch (_type) {
        case "follower":   tx = -1100 * (1 - p); break;
        case "host":       tx = 1100 * (1 - p); break;
        case "subscriber": ty = -560 * (1 - p); sc = 1 + 0.5 * (1 - p); break;
        case "superchat":  ty = -620 * (1 - p); break;
        case "cheer":      ty = 420 * (1 - p); break;
        case "share":      ty = 360 * (1 - p); rot = baseRot + (-18) * (1 - p); break;
        case "donation":   sc = 0.18 + (1 - 0.18) * p; break;
        case "like":       sc = 0.4 + (1 - 0.4) * p; break;
        case "star":       sc = 0.3 + (1 - 0.3) * p; rot = baseRot + 18 * (1 - p); break;
        case "member":     tx = -120 * (1 - p); ty = 120 * (1 - p); rot = baseRot + (-24) * (1 - p); break;
        case "raid":       tx = -900 * (1 - p); ty = -120 * (1 - p); break;
        case "supporter":  tx = -680 * (1 - p); ty = 560 * (1 - p); rot = baseRot + (-10) * (1 - p); break;
        default:           tx = -1100 * (1 - p);
      }
      tr = "rotate(" + rot.toFixed(2) + "deg) translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + sc.toFixed(3) + ")";
    } else if (ms < holdEnd) {
      tr = "rotate(" + baseRot + "deg) translate(0,0) scale(1)"; op = 1;
    } else {
      const p = easeOut(Math.min(1, (ms - holdEnd) / EXIT));
      tr = "rotate(" + baseRot + "deg) translate(" + (-60 * p).toFixed(1) + "px," + (90 * p).toFixed(1) + "px) scale(" + (1 - 0.08 * p).toFixed(3) + ")";
      op = 1 - p;
    }
    if (card) { card.style.transform = tr; card.style.opacity = op.toFixed(3); }

    // glyph pop (staggered .16s)
    const glyph = card && card.querySelector(".glyph");
    if (glyph) {
      const gp = (ms - 160) / 500;
      let gs;
      if (gp <= 0) gs = 0.3; else if (gp >= 1) gs = 1; else gs = gp < 0.6 ? 0.3 + (gp / 0.6) * 0.88 : 1.18 - ((gp - 0.6) / 0.4) * 0.18;
      glyph.style.transform = "rotate(-4deg) scale(" + Math.max(0, gs).toFixed(3) + ")";
      glyph.style.opacity = gp <= 0 ? "0" : "1";
    }

    if (ms >= 180 && !_b1) { _b1 = true; spawnBurst(_cfg); }
    if (_cfg.bits >= 38 && ms >= 560 && !_b2) { _b2 = true; spawnBurst({ ..._cfg, bits: Math.round(_cfg.bits * 0.55) }); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo after a tiny delay (skipped in render mode)
  if (!render) setTimeout(startDemo, 360);
})();
