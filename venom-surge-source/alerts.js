/* ============================================================
   VENOM SURGE — alert engine ("Toxic Arena")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography + copy. Auto-plays a looping DEMO on load.
   Read ?type=&name=&amount= to override the demo data/event.
   ELECTRIC-ARC + venom-ember burst on a TRANSPARENT canvas
   (delta-clamped rAF), keyed off the card's glyph tile.
   ?noname=1  => big line shows the EVENT label, kicker hides
                 (this is the shipping mode for clips).
   ?render=1  => deterministic manual frame-stepping for headless
                 webm capture via __renderPlay/__renderAdvance.
   Each event has a DISTINCT entrance motion (driven by .ev-<type>
   classes in alerts.css); the burst weight + amount emphasis vary.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  // noname: render the card with NO baked viewer name (the big line shows the
  // event label, and the streamer's alert platform overlays the live name).
  const noname = params.get("noname") === "1" || params.get("noname") === "true";
  // render mode: deterministic manual frame-stepping for headless webm capture.
  const render = params.get("render") === "1";
  const stage = $id("stage");
  if (render && stage) stage.classList.add("render");

  /* ---- fit the 1920x1080 stage to the window (defensive, mirrors shared.js) ---- */
  function fit() {
    const iw = window.innerWidth, ih = window.innerHeight;
    if (iw < 10 || ih < 10) return;               // never write --scale:0
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- per-event choreography table ----
     glyph   : icon in the hazard tile
     kicker  : skewed event tab text (also the big line in ?noname mode)
     sub     : techy mono sub-line
     motes   : how many venom embers the burst spits (raid/host bigger)
     bolts   : how many electric arcs crack on entrance
     amount  : true => emphasize the amount line (cheer/donation/superchat)
     amtPre  : text shown before a bare numeric amount ($, etc.)
     amtSuf  : text shown after a bare numeric amount (bits, raiders, etc.) */
  const EVENTS = {
    follower:   { glyph: "›",  kicker: "NEW FOLLOWER",    sub: "locked into the surge",   motes: 18, bolts: 2, amount: false },
    subscriber: { glyph: "★",  kicker: "NEW SUBSCRIBER",  sub: "powered up — welcome",    motes: 24, bolts: 3, amount: false },
    member:     { glyph: "◆",  kicker: "NEW MEMBER",      sub: "joined the squad",        motes: 24, bolts: 3, amount: false },
    cheer:      { glyph: "⚡", kicker: "CHEER",           sub: "voltage incoming",        motes: 30, bolts: 4, amount: true,  amtPre: "", amtSuf: " BITS" },
    donation:   { glyph: "$",  kicker: "DONATION",        sub: "fueling the stream",      motes: 32, bolts: 4, amount: true,  amtPre: "$" },
    host:       { glyph: "»",  kicker: "NOW HOSTING",     sub: "the gates swing open",    motes: 36, bolts: 4, amount: true,  amtPre: "", amtSuf: " VIEWERS" },
    raid:       { glyph: "⚔", kicker: "RAID INCOMING",   sub: "the arena floods",        motes: 48, bolts: 6, amount: true,  amtPre: "", amtSuf: " RAIDERS" },
    like:       { glyph: "▲",  kicker: "NEW LIKE",        sub: "charge it up",            motes: 14, bolts: 1, amount: false },
    share:      { glyph: "➤",  kicker: "SHARED",          sub: "the surge spreads",       motes: 20, bolts: 2, amount: false },
    star:       { glyph: "✦",  kicker: "NEW STAR",        sub: "the arena lights up",     motes: 26, bolts: 3, amount: true,  amtPre: "", amtSuf: " STARS" },
    superchat:  { glyph: "✸",  kicker: "SUPER CHAT",      sub: "high-voltage message",    motes: 30, bolts: 4, amount: true,  amtPre: "$" },
    supporter:  { glyph: "❖",  kicker: "NEW SUPPORTER",   sub: "keeping the power on",     motes: 26, bolts: 3, amount: false },
  };
  const DEFAULT = EVENTS.follower;
  const TYPES = Object.keys(EVENTS);

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

  let hideTimer = null, busy = false, demoOn = false, demoIdx = 0, curType = pageType();

  /* ============================================================
     ELECTRIC-ARC + venom-ember burst on a TRANSPARENT canvas
     (delta-clamped rAF). Origin = near the card's glyph tile.
     ============================================================ */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const SPARK = ["#00FF66", "#C6FF00", "#0AE0FF", "#EAFFF2"];
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];   // ember motes
  let zaps = [];    // short-lived electric arcs

  // burst originates near the card's glyph tile (lower-left of the stage)
  function originXY() { return { ox: 96 + 40 + 71, oy: H - 140 - 71 }; }

  function spawnBurst(n) {
    const { ox, oy } = originXY();
    for (let i = 0; i < n; i++) {
      burst.push({
        x: ox + R(-40, 100), y: oy + R(-70, 50),
        vx: R(30, 220) / 60, vy: R(-230, -60) / 60,
        g: R(70, 150) / 3600,
        s: R(2, 5), rot: R(0, 6.28), vr: R(-4, 4) / 60,
        a: 1, life: R(1.2, 2.4),
        c: SPARK[(Math.random() * SPARK.length) | 0],
      });
    }
  }

  // spawn a few short electric arcs near the tile / radiating from it
  function spawnZaps(n) {
    const { ox, oy } = originXY();
    for (let i = 0; i < n; i++) {
      zaps.push({
        x: ox + R(-30, 40), y: oy + R(-40, 30),
        ang: R(-1.4, 0.4),                 // mostly up-and-right
        len: R(150, 360),
        life: R(0.14, 0.26), max: 0.26,
        seed: (Math.random() * 1e9) | 0,
        c: Math.random() < 0.5 ? "#0AE0FF" : "#C6FF00",
      });
    }
  }

  // draw one jagged bolt (deterministic per call seed)
  function drawBolt(x, y, ang, len, seg, sd, col, wMul) {
    let bs = sd >>> 0;
    const rr = () => { bs = (bs + 0x9E3779B9) | 0; let t = bs ^ (bs >>> 16); t = Math.imul(t, 0x21f0aaad); t ^= t >>> 15; return ((t >>> 0) % 1000) / 1000; };
    ctx.beginPath();
    ctx.moveTo(Math.round(x), Math.round(y));
    const step = len / seg, nx = Math.cos(ang), ny = Math.sin(ang), px = -ny, py = nx;
    let cx = x, cy = y;
    for (let i = 1; i <= seg; i++) {
      const jag = (rr() - 0.5) * 34;
      cx = x + nx * step * i + px * jag;
      cy = y + ny * step * i + py * jag;
      ctx.lineTo(Math.round(cx), Math.round(cy));
      if (rr() > 0.76 && i < seg) {            // occasional fork
        const fang = ang + (rr() - 0.5) * 1.4;
        const fl = step * (1 + rr());
        ctx.moveTo(Math.round(cx), Math.round(cy));
        ctx.lineTo(Math.round(cx + Math.cos(fang) * fl), Math.round(cy + Math.sin(fang) * fl));
        ctx.moveTo(Math.round(cx), Math.round(cy));
      }
    }
    ctx.strokeStyle = col; ctx.lineWidth = 1.6 * wMul;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke();
  }

  function drawMote(p) {
    // a tiny rotated diamond — a fleck of venom spark
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.PI / 4);
    ctx.globalAlpha = Math.max(0, p.a);
    ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 10;
    ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    // arcs (drawn under the embers)
    for (let i = zaps.length - 1; i >= 0; i--) {
      const z = zaps[i];
      z.life -= 1 / 30;
      if (z.life <= 0) { zaps.splice(i, 1); continue; }
      const lit = Math.max(0, z.life / z.max);
      ctx.globalAlpha = 0.4 + lit * 0.6;
      ctx.shadowColor = z.c; ctx.shadowBlur = 16;
      drawBolt(z.x, z.y, z.ang, z.len, 7, z.seed ^ ((zaps.length + i) * 97), z.c, 1.5);
      ctx.shadowBlur = 8;
      drawBolt(z.x, z.y, z.ang, z.len, 7, z.seed ^ ((zaps.length + i) * 97), "#EAFFF2", 0.6);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // embers
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vr;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 60) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  window.__venomAlertDraw = frame; // rAF-independent verification hook

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

  /* ---- apply event class so the card uses that event's distinct motion ---- */
  function applyEventClass(type) {
    if (!card) return;
    for (const t of TYPES) card.classList.remove("ev-" + t);
    card.classList.add("ev-" + type);
  }

  /* ---- populate the card text for a type ---- */
  function populate(type, cfg, name, amountStr) {
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
  }

  /* ---- play(): drive one alert through its choreography ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "NewViewer";
    const amountStr = fmtAmount(cfg, opts.amount);

    if (!card) return;
    busy = true; curType = type;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    populate(type, cfg, name, amountStr);
    applyEventClass(type);

    // restart the entrance animation cleanly
    card.classList.remove("hide", "show");
    void card.offsetWidth; // force reflow so re-adding .show replays it
    card.classList.add("show");

    // electric arcs crack right as it lands; embers follow a beat later
    setTimeout(() => spawnZaps(cfg.bolts), 120);
    setTimeout(() => spawnBurst(cfg.motes), 220);
    // big events get a second pop
    if (cfg.motes >= 32) {
      setTimeout(() => { spawnZaps(Math.max(2, Math.round(cfg.bolts * 0.6))); spawnBurst(Math.round(cfg.motes * 0.6)); }, 620);
    }

    // hold, then snap out
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show");
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1500);
      }, 440);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then loop ----
     A single page demos its own event repeatedly. With no body[data-event]
     and no ?type=, the demo cycles through all 12 (used by previews). ---- */
  function demoData() {
    const declared = params.get("type") || (document.body && document.body.dataset ? document.body.dataset.event : null);
    let type;
    if (declared && EVENTS[declared]) {
      type = declared;
    } else {
      type = TYPES[demoIdx % TYPES.length]; demoIdx++;
    }
    const cfg = EVENTS[type] || DEFAULT;
    let amt = params.get("amount");
    if (amt == null) amt = cfg.amount ? (type === "cheer" ? "500" : type === "raid" ? "128" : type === "host" ? "42" : type === "star" ? "9" : "25") : "";
    return { type, name: params.get("name") || "NewViewer", amount: amt };
  }
  function startDemo() { demoOn = true; play(demoData()); }

  /* ============================================================
     DETERMINISTIC RENDER MODE — drive one full play via manual
     frame steps (no CSS animation / setTimeout / free rAF).
     ============================================================ */
  let _cfg = DEFAULT, _type = "follower", _f = 0, _z1 = false, _b1 = false, _z2 = false, _b2 = false;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;

  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _type = type; _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "NewViewer");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    populate(type, _cfg, name, amountStr);
    applyEventClass(type);
    card.classList.remove("show", "hide");
    _f = 0; _z1 = false; _b1 = false; _z2 = false; _b2 = false; burst = []; zaps = [];
  }

  // generic deterministic entrance solver: returns {tf, op} for the card.
  // Each event re-creates the FEEL of its CSS keyframes closely enough for capture.
  function solve(type, ms, ENTER) {
    const p = clamp01(ms / ENTER), e = easeOut(p);
    switch (type) {
      case "follower": {
        let x; if (p < 0.6) x = -1000 + easeOut(p / 0.6) * 1034; else x = 34 - ((p - 0.6) / 0.4) * 34;
        return { tf: "translateX(" + x.toFixed(1) + "px)", op: clamp01(ms / (ENTER * 0.45)) };
      }
      case "subscriber": {
        let y; if (p < 0.55) y = -680 + easeOut(p / 0.55) * 706; else if (p < 0.78) y = 26 - ((p - 0.55) / 0.23) * 38; else y = -12 + ((p - 0.78) / 0.22) * 12;
        return { tf: "translateY(" + y.toFixed(1) + "px)", op: clamp01(ms / (ENTER * 0.5)) };
      }
      case "member": {
        let y; if (p < 0.62) y = 620 - easeOut(p / 0.62) * 640; else y = -20 + ((p - 0.62) / 0.38) * 20;
        return { tf: "translateY(" + y.toFixed(1) + "px)", op: clamp01(ms / (ENTER * 0.5)) };
      }
      case "cheer": {
        const s = 0.4 + e * 0.62 + Math.sin(p * Math.PI * 3) * 0.05 * (1 - p);
        const rot = Math.sin(p * Math.PI * 4) * 1.4 * (1 - p);
        return { tf: "scale(" + s.toFixed(3) + ") rotate(" + rot.toFixed(2) + "deg)", op: clamp01(ms / (ENTER * 0.4)) };
      }
      case "donation": {
        const s = 1.9 - e * 0.94 + Math.sin(p * Math.PI) * 0.04 * (p > 0.55 ? 1 : 0);
        const blur = Math.max(0, 8 - p * 16);
        return { tf: "scale(" + s.toFixed(3) + ")", op: clamp01(ms / (ENTER * 0.4)), filter: "blur(" + blur.toFixed(1) + "px)" };
      }
      case "host": {
        const rot = -14 + e * 14, x = -260 + e * 260;
        return { tf: "rotate(" + rot.toFixed(2) + "deg) translateX(" + x.toFixed(1) + "px)", op: clamp01(ms / (ENTER * 0.45)), origin: "top left" };
      }
      case "raid": {
        let x; if (p < 0.52) x = 1400 - easeOut(p / 0.52) * 1446; else if (p < 0.72) x = -46 + ((p - 0.52) / 0.2) * 64; else x = 18 - ((p - 0.72) / 0.28) * 18;
        return { tf: "translateX(" + x.toFixed(1) + "px)", op: clamp01(ms / (ENTER * 0.4)) };
      }
      case "like": {
        let y; if (p < 0.6) y = 70 - easeOut(p / 0.6) * 78; else y = -8 + ((p - 0.6) / 0.4) * 8;
        const s = 0.86 + e * 0.14;
        return { tf: "translateY(" + y.toFixed(1) + "px) scale(" + s.toFixed(3) + ")", op: clamp01(ms / (ENTER * 0.45)) };
      }
      case "share": {
        let x; if (p < 0.7) x = 900 - easeOut(p / 0.7) * 922; else x = -22 + ((p - 0.7) / 0.3) * 22;
        return { tf: "translateX(" + x.toFixed(1) + "px)", op: clamp01(ms / (ENTER * 0.45)) };
      }
      case "star": {
        const s = 0.2 + e * 0.87, rot = -160 + e * 160;
        return { tf: "scale(" + s.toFixed(3) + ") rotate(" + rot.toFixed(1) + "deg)", op: clamp01(ms / (ENTER * 0.4)) };
      }
      case "superchat": {
        const rx = -88 + e * 88, y = -120 + e * 120;
        return { tf: "perspective(900px) rotateX(" + rx.toFixed(1) + "deg) translateY(" + y.toFixed(1) + "px)", op: clamp01(ms / (ENTER * 0.45)), origin: "center top" };
      }
      case "supporter": {
        const sx = 0.02 + e * 0.98, sy = 0.7 + e * 0.3;
        return { tf: "scaleX(" + sx.toFixed(3) + ") scaleY(" + sy.toFixed(3) + ")", op: clamp01(ms / (ENTER * 0.45)) };
      }
      default:
        return { tf: "translateX(" + (-1000 + e * 1000).toFixed(1) + "px)", op: e };
    }
  }

  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const ENTER = 680, HOLD = 4200, EXIT = 440, holdEnd = ENTER + HOLD;
    if (card) {
      let tf, op, filter = "", origin = "";
      if (ms < ENTER) {
        const s = solve(_type, ms, ENTER);
        tf = s.tf; op = s.op; filter = s.filter || ""; origin = s.origin || "";
      } else if (ms < holdEnd) {
        tf = "translateX(0)"; op = 1;
      } else {
        const p = clamp01((ms - holdEnd) / EXIT);
        tf = "translateX(" + (-1000 * easeOut(p)).toFixed(1) + "px) skewX(" + (p * 8).toFixed(1) + "deg)";
        op = 1 - p;
      }
      card.style.transformOrigin = origin || "center";
      card.style.transform = tf;
      card.style.opacity = op.toFixed(3);
      card.style.filter = filter;
    }
    // burst beats mirror the live timeline
    if (ms >= 120 && !_z1) { _z1 = true; spawnZaps(_cfg.bolts); }
    if (ms >= 220 && !_b1) { _b1 = true; spawnBurst(_cfg.motes); }
    if (_cfg.motes >= 32 && ms >= 620 && !_z2) { _z2 = true; spawnZaps(Math.max(2, Math.round(_cfg.bolts * 0.6))); }
    if (_cfg.motes >= 32 && ms >= 620 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.motes * 0.6)); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo after a tiny delay (skipped in render mode)
  if (!render) setTimeout(startDemo, 400);
})();
