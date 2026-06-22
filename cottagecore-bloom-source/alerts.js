/* ============================================================
   COTTAGECORE BLOOM — alert engine ("Pressed-Bloom Label")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography (12 DISTINCT botanical motions) + copy. Auto-plays a
   looping DEMO on load. Reads ?type=&name=&amount= to override.
   A transparent <canvas> spits a gentle BURST of petals / dandelion
   seeds / pollen when the label lands (raid/host bigger).
   ?noname=1 => big line shows the EVENT label ("NEW FOLLOWER"), the
               viewer name is HIDDEN (this is how clips ship — the
               streamer's alert platform overlays the live name).
   ?render=1 => deterministic manual frame-stepping for headless webm
               capture via window.__renderPlay / window.__renderAdvance.
   No audio. Background TRANSPARENT. Every element null-guarded.
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
    if (iw < 10 || ih < 10) return;               // never write --scale:0
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- per-event choreography table ----
     glyph  : which pressed-flower / botanical SVG specimen to show (drawSpecimen key)
     kicker : leaf-green humanist-caps event line
     sub    : little italic serif sub-line
     motion : entrance CSS class (each event = a DISTINCT botanical motion)
     motes  : how many burst particles spawn (raid/host bigger)
     burst  : which particle flavor the burst spits ('petal'|'seed'|'pollen'|'mix')
     amount : true => show + emphasize the amount line (cheer/donation/superchat …)
     amtPre / amtSuf : decoration around a bare numeric amount */
  const EVENTS = {
    follower:   { glyph:"leaf",   kicker:"NEW SPROUT",      sub:"welcome to the garden",   motion:"m-grow",    motes:18, burst:"seed",   amount:false },
    subscriber: { glyph:"rose",   kicker:"NEW BLOOM",       sub:"a flower that returns",   motion:"m-bloom",   motes:24, burst:"petal",  amount:false },
    member:     { glyph:"daisy",  kicker:"NEW SEEDLING",    sub:"planted in the patch",    motion:"m-pot",     motes:22, burst:"mix",    amount:false },
    cheer:      { glyph:"bee",    kicker:"CHEER",           sub:"a busy little buzz",      motion:"m-flutter", motes:26, burst:"pollen", amount:true,  amtPre:"", amtSuf:" bits" },
    donation:   { glyph:"heart",  kicker:"A GIFT",          sub:"so very kind of you",     motion:"m-gift",    motes:28, burst:"petal",  amount:true,  amtPre:"$" },
    host:       { glyph:"wreath", kicker:"NOW HOSTING",     sub:"the gate swings open",    motion:"m-sweep",   motes:34, burst:"mix",    amount:true,  amtPre:"", amtSuf:" guests" },
    raid:       { glyph:"posy",   kicker:"WILDFLOWER RAID", sub:"the meadow fills at once", motion:"m-gust",    motes:48, burst:"mix",    amount:true,  amtPre:"", amtSuf:" arriving" },
    like:       { glyph:"heart",  kicker:"A LITTLE LOVE",   sub:"much obliged",            motion:"m-pop",     motes:14, burst:"petal",  amount:false },
    share:      { glyph:"seed",   kicker:"SEEDS SPREAD",    sub:"word drifts on the wind", motion:"m-carry",   motes:20, burst:"seed",   amount:false },
    star:       { glyph:"star",   kicker:"NEW STAR",        sub:"the meadow shines",       motion:"m-twinkle", motes:24, burst:"pollen", amount:true,  amtPre:"", amtSuf:" stars" },
    superchat:  { glyph:"note",   kicker:"PRESSED NOTE",    sub:"a note for the journal",  motion:"m-unfold",  motes:30, burst:"petal",  amount:true,  amtPre:"$" },
    supporter:  { glyph:"sun",    kicker:"NEW GARDENER",    sub:"you help it all grow",    motion:"m-nestle",  motes:24, burst:"mix",    amount:false },
  };
  const DEFAULT = EVENTS.follower;
  const ORDER = ["follower","subscriber","member","cheer","donation","host","raid","like","share","star","superchat","supporter"];
  // all motion classes so we can clear them cleanly between plays
  const MOTIONS = ORDER.map(k => EVENTS[k].motion).filter((v,i,a) => a.indexOf(v) === i);

  /* ---- which event did this page declare (body[data-event]) or ?type= ---- */
  function pageType() {
    const fromParam = params.get("type");
    if (fromParam && EVENTS[fromParam]) return fromParam;
    const fromBody = document.body && document.body.dataset ? document.body.dataset.event : null;
    if (fromBody && EVENTS[fromBody]) return fromBody;
    return "follower";
  }

  /* ---- format the amount string ---- */
  function fmtAmount(cfg, amount) {
    if (amount == null || amount === "") return "";
    const a = String(amount).trim();
    if (a === "") return "";
    const hasSymbol = /[$€£¥]/.test(a) || /[a-z]/i.test(a);   // caller already decorated it
    if (hasSymbol) return a;
    return (cfg.amtPre || "") + a + (cfg.amtSuf || "");
  }

  /* ---- pressed-flower / botanical SVG specimens for the glyph plate ---- */
  const SPECIMENS = {
    // a single ivy leaf
    leaf: '<svg viewBox="0 0 100 100"><g class="specimen">'
      + '<path d="M50 88 C 30 70, 14 50, 20 24 C 46 26, 78 38, 80 70 C 70 84, 58 88, 50 88z" fill="#7DA453"/>'
      + '<path d="M50 86 C 46 64, 40 42, 26 28" fill="none" stroke="#FBF6E9" stroke-width="2.4" opacity=".55"/>'
      + '<path d="M44 60 q12 -2 22 4 M40 46 q10 -2 18 2" fill="none" stroke="#5E8038" stroke-width="1.6" opacity=".5"/></g></svg>',
    // a dusty-rose pressed flower (5 petals)
    rose: '<svg viewBox="0 0 100 100"><g class="specimen">'
      + '<g fill="#E2A0B4">'
      + '<ellipse cx="50" cy="28" rx="12" ry="20"/><ellipse cx="71" cy="43" rx="12" ry="20" transform="rotate(72 71 43)"/>'
      + '<ellipse cx="63" cy="68" rx="12" ry="20" transform="rotate(144 63 68)"/><ellipse cx="37" cy="68" rx="12" ry="20" transform="rotate(216 37 68)"/>'
      + '<ellipse cx="29" cy="43" rx="12" ry="20" transform="rotate(288 29 43)"/></g>'
      + '<circle cx="50" cy="50" r="9" fill="#5E8038"/><circle cx="50" cy="50" r="5" fill="#FBF6E9"/></g></svg>',
    // a cream daisy
    daisy: '<svg viewBox="0 0 100 100"><g class="specimen">'
      + '<g fill="#FBF6E9" stroke="#E7DEC4" stroke-width="1.2">'
      + '<ellipse cx="50" cy="24" rx="7" ry="18"/><ellipse cx="68" cy="32" rx="7" ry="18" transform="rotate(45 68 32)"/>'
      + '<ellipse cx="76" cy="50" rx="18" ry="7"/><ellipse cx="68" cy="68" rx="7" ry="18" transform="rotate(-45 68 68)"/>'
      + '<ellipse cx="50" cy="76" rx="7" ry="18"/><ellipse cx="32" cy="68" rx="7" ry="18" transform="rotate(45 32 68)"/>'
      + '<ellipse cx="24" cy="50" rx="18" ry="7"/><ellipse cx="32" cy="32" rx="7" ry="18" transform="rotate(-45 32 32)"/></g>'
      + '<circle cx="50" cy="50" r="11" fill="#E8B84B"/></g></svg>',
    // a little honeybee
    bee: '<svg viewBox="0 0 100 100"><g class="specimen">'
      + '<ellipse cx="34" cy="40" rx="16" ry="11" fill="#FBF6E9" opacity=".85" transform="rotate(-24 34 40)"/>'
      + '<ellipse cx="58" cy="34" rx="16" ry="11" fill="#FBF6E9" opacity=".85" transform="rotate(24 58 34)"/>'
      + '<g transform="rotate(20 50 56)"><ellipse cx="50" cy="56" rx="24" ry="16" fill="#E8B84B"/>'
      + '<path d="M40 44 v24 M50 41 v30 M60 44 v24" stroke="#5A4A3A" stroke-width="5" fill="none"/>'
      + '<circle cx="72" cy="52" r="9" fill="#5A4A3A"/></g></g></svg>',
    // a soft heart
    heart: '<svg viewBox="0 0 100 100"><g class="specimen">'
      + '<path d="M50 82 C 18 58, 14 34, 30 24 C 42 17, 50 28, 50 34 C 50 28, 58 17, 70 24 C 86 34, 82 58, 50 82z" fill="#E2A0B4"/>'
      + '<path d="M50 76 C 30 58, 26 38, 36 30" fill="none" stroke="#FBF6E9" stroke-width="2.6" opacity=".5"/></g></svg>',
    // a leafy wreath ring
    wreath: '<svg viewBox="0 0 100 100"><g class="specimen">'
      + '<circle cx="50" cy="50" r="30" fill="none" stroke="#7DA453" stroke-width="4"/>'
      + '<g fill="#5E8038">'
      + '<ellipse cx="50" cy="20" rx="6" ry="11"/><ellipse cx="76" cy="36" rx="6" ry="11" transform="rotate(60 76 36)"/>'
      + '<ellipse cx="76" cy="64" rx="6" ry="11" transform="rotate(120 76 64)"/><ellipse cx="50" cy="80" rx="6" ry="11"/>'
      + '<ellipse cx="24" cy="64" rx="6" ry="11" transform="rotate(60 24 64)"/><ellipse cx="24" cy="36" rx="6" ry="11" transform="rotate(120 24 36)"/></g>'
      + '<circle cx="50" cy="50" r="6" fill="#E2A0B4"/></g></svg>',
    // a small posy / bouquet
    posy: '<svg viewBox="0 0 100 100"><g class="specimen">'
      + '<path d="M50 84 C 44 64, 40 50, 34 40 M50 84 C 50 62, 50 48, 50 36 M50 84 C 56 64, 60 50, 66 40" fill="none" stroke="#5E8038" stroke-width="3.4"/>'
      + '<circle cx="32" cy="36" r="11" fill="#E2A0B4"/><circle cx="32" cy="36" r="5" fill="#FBF6E9"/>'
      + '<circle cx="66" cy="36" r="11" fill="#FBF6E9" stroke="#E7DEC4" stroke-width="1.4"/><circle cx="66" cy="36" r="4.5" fill="#E8B84B"/>'
      + '<circle cx="50" cy="28" r="12" fill="#7DA453"/><circle cx="50" cy="28" r="5" fill="#FBF6E9"/></g></svg>',
    // a dandelion seed with a fluffy tuft
    seed: '<svg viewBox="0 0 100 100"><g class="specimen">'
      + '<g stroke="#FBF6E9" stroke-width="2" stroke-linecap="round" opacity=".85">'
      + '<path d="M50 44 L50 18 M50 44 L34 22 M50 44 L66 22 M50 44 L22 34 M50 44 L78 34 M50 44 L28 52 M50 44 L72 52"/></g>'
      + '<circle cx="50" cy="40" r="9" fill="none" stroke="#FBF6E9" stroke-width="1.6" opacity=".4"/>'
      + '<path d="M50 46 L50 84" stroke="#B7A98C" stroke-width="3" stroke-linecap="round"/>'
      + '<ellipse cx="50" cy="48" rx="3.4" ry="6" fill="#B7A98C"/></g></svg>',
    // a star bloom
    star: '<svg viewBox="0 0 100 100"><g class="specimen">'
      + '<path d="M50 14 L59 40 L86 40 L64 57 L72 84 L50 67 L28 84 L36 57 L14 40 L41 40 Z" fill="#E8B84B" stroke="#C9952C" stroke-width="1.4"/>'
      + '<circle cx="50" cy="52" r="6" fill="#FBF6E9"/></g></svg>',
    // a pressed note / folded paper with a sprig
    note: '<svg viewBox="0 0 100 100"><g class="specimen">'
      + '<rect x="26" y="20" width="48" height="60" rx="4" fill="#FBF6E9" stroke="#E7DEC4" stroke-width="1.6"/>'
      + '<path d="M34 36 H66 M34 46 H66 M34 56 H58" stroke="#C9BFA4" stroke-width="2.2" stroke-linecap="round"/>'
      + '<path d="M50 78 q-7 -4 -10 -10 M50 78 q7 -4 10 -10" fill="none" stroke="#7DA453" stroke-width="2.6"/>'
      + '<circle cx="50" cy="70" r="3.4" fill="#E2A0B4"/></g></svg>',
    // a little sun
    sun: '<svg viewBox="0 0 100 100"><g class="specimen">'
      + '<g stroke="#E8B84B" stroke-width="4" stroke-linecap="round">'
      + '<path d="M50 12 V24 M50 76 V88 M12 50 H24 M76 50 H88 M23 23 L31 31 M69 69 L77 77 M77 23 L69 31 M31 69 L23 77"/></g>'
      + '<circle cx="50" cy="50" r="18" fill="#E8B84B"/><circle cx="50" cy="50" r="11" fill="#FBF6E9" opacity=".5"/></g></svg>',
  };

  /* ---- the label elements ---- */
  const card = $id("alert");
  const artEl = $id("art");
  const kickEl = $id("kick-label");
  const nameEl = $id("name");
  const amountEl = $id("amount");
  const subEl = $id("sub");

  let hideTimer = null, busy = false, demoOn = false;

  /* ============================================================
     BURST on a transparent canvas — gentle petals / dandelion seeds /
     pollen rising from where the label lands. Delta-clamped rAF.
     ============================================================ */
  const cv = $(".bg");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const ROSE = "#E2A0B4", CREAM = "#F3DCC6", WHITE = "#FBF6E9", POLLEN = "#FBEFC9", LEAF = "#7DA453";
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // origin: near the label's glyph plate (lower-left of the stage)
  function spawnBurst(n, flavor) {
    const ox = 240, oy = H - 200;
    for (let i = 0; i < n; i++) {
      let kind = flavor;
      if (flavor === "mix") kind = (i % 3 === 0) ? "petal" : (i % 3 === 1) ? "seed" : "pollen";
      burst.push({
        kind,
        x: ox + R(-60, 120), y: oy + R(-70, 50),
        vx: R(-30, 150) / 60,
        vy: (kind === "petal" ? R(-60, 60) : R(-190, -60)) / 60,  // seeds/pollen rise, petals drift either way
        g: (kind === "petal" ? R(28, 70) : -R(10, 40)) / 3600,    // petals fall a touch, fluff floats up
        sway: R(0.4, 1.4), ph: R(0, 6.283),
        s: kind === "petal" ? R(8, 15) : kind === "seed" ? R(4, 7) : R(1.5, 3),
        rot: R(0, 6.28), vr: R(-2.5, 2.5) / 60,
        a: 1, life: R(1.6, 3.0),
        rose: Math.random() < 0.6,
      });
    }
  }

  function drawMote(p) {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.a);
    if (p.kind === "petal") {
      // a soft teardrop petal (echoes shared.js drawPetal)
      const sz = p.s;
      ctx.fillStyle = p.rose ? ROSE : CREAM;
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.bezierCurveTo(sz * 0.8, -sz * 0.5, sz * 0.7, sz * 0.6, 0, sz);
      ctx.bezierCurveTo(-sz * 0.7, sz * 0.6, -sz * 0.8, -sz * 0.5, 0, -sz);
      ctx.fill();
    } else if (p.kind === "seed") {
      // a dandelion fluff: short radiating filaments
      ctx.strokeStyle = WHITE; ctx.lineWidth = 1; ctx.lineCap = "round";
      const r = p.s;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * 6.283;
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); ctx.stroke();
      }
    } else {
      // pollen mote: a tiny warm speck
      ctx.fillStyle = POLLEN;
      const s = Math.max(1, Math.round(p.s));
      ctx.fillRect(-s / 2, -s / 2, s, s);
    }
    ctx.restore();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.ph += 0.05;
      p.x += p.vx + Math.sin(p.ph) * p.sway * 0.5;
      p.y += p.vy; p.vy += p.g; p.rot += p.vr;
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 60 || p.y < -60) { burst.splice(i, 1); continue; }
      drawMote(p);
    }
    ctx.globalAlpha = 1;
  }
  // rAF-independent verification hook (EXACT theme-slug-camel name)
  window.__bloomAlertDraw = frame;

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

  /* ---- populate the label's text/visuals for an event ---- */
  function populate(cfg, name, amountStr) {
    if (artEl) artEl.innerHTML = SPECIMENS[cfg.glyph] || SPECIMENS.leaf;
    const kickLine = card ? card.querySelector(".kick") : null;
    if (noname) {
      if (kickLine) kickLine.style.display = "none";
      // for the shipping noname mode the BIG line reads like an event headline
      // (the streamer's alert platform overlays the live viewer name itself)
      if (nameEl) nameEl.textContent = eventHeadline(cfg);
    } else {
      if (kickLine) kickLine.style.display = "";
      if (kickEl) kickEl.textContent = cfg.kicker;
      if (nameEl) nameEl.textContent = name;
    }
    if (subEl) subEl.textContent = cfg.sub;
    if (amountEl) amountEl.textContent = amountStr;
    if (card) {
      card.classList.toggle("has-amount", !!(cfg.amount && amountStr));
      card.classList.toggle("emph", !!(cfg.amount && amountStr));   // money events pop the amount
    }
  }

  // the big-line headline used in noname mode (reads like "NEW FOLLOWER")
  function eventHeadline(cfg) {
    // map event -> a clean headline; fall back to the kicker copy
    return cfg.kicker;
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

    populate(cfg, name, amountStr);

    // restart entrance cleanly: clear all motion/state classes, reflow, re-add
    card.classList.remove("hide", "show", "settled", ...MOTIONS);
    void card.offsetWidth;                          // force reflow so the animation replays
    card.classList.add("show", cfg.motion);

    // once the entrance lands, let the label drift gently on the breeze
    const entranceMs = 1100;
    setTimeout(() => { if (busy) card.classList.add("settled"); }, entranceMs);

    // botanical burst (staggered a touch so it reads after the arrival)
    setTimeout(() => spawnBurst(cfg.motes, cfg.burst), 240);
    if (cfg.motes >= 30) setTimeout(() => spawnBurst(Math.round(cfg.motes * 0.55), cfg.burst), 700);

    // hold, then drift away
    const HOLD = 4300;
    hideTimer = setTimeout(() => {
      card.classList.remove("show", "settled", ...MOTIONS);
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1700);
      }, 600);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then loop ---- */
  function demoData() {
    return {
      type: pageType(),
      name: params.get("name") || "NewFriend",
      amount: params.get("amount") != null ? params.get("amount") : "5",
    };
  }
  function startDemo() { demoOn = true; play(demoData()); }

  /* ============================================================
     DETERMINISTIC RENDER MODE — drive one full play via manual frame
     steps (matches the screens' __renderPlay/__renderAdvance pattern).
     We approximate each entrance motion with an eased translateY/scale
     so the captured webm is frame-exact without CSS animation.
     ============================================================ */
  let _cfg = DEFAULT, _f = 0, _b1 = false, _b2 = false;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  function renderPlay(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "NewFriend");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    populate(_cfg, name, amountStr);
    card.classList.remove("show", "hide", "settled", ...MOTIONS);
    _f = 0; _b1 = false; _b2 = false; burst = [];
  }

  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const ENTER = 900, HOLD = 4300, EXIT = 600, holdEnd = ENTER + HOLD, dur = holdEnd + EXIT;
    let ty, sc, rot, op;
    if (ms < ENTER) {
      // generic eased "rise + settle" (deterministic stand-in for the per-event CSS motion)
      const p = easeOut(Math.min(1, ms / ENTER));
      const overshoot = Math.sin(p * Math.PI) * 6;       // small settle bounce
      ty = (1 - p) * 56 - overshoot;
      sc = 0.84 + p * 0.16;
      rot = (1 - p) * -3;
      op = Math.min(1, ms / (ENTER * 0.45));
    } else if (ms < holdEnd) {
      ty = 0; sc = 1; rot = 0; op = 1;
    } else {
      const p = Math.min(1, (ms - holdEnd) / EXIT);
      ty = p * 34; sc = 1 - p * 0.06; rot = p * -2; op = 1 - p;
    }
    if (card) {
      card.style.transform = "translateY(" + ty.toFixed(2) + "px) scale(" + sc.toFixed(3) + ") rotate(" + rot.toFixed(2) + "deg)";
      card.style.opacity = op.toFixed(3);
    }
    // burst timing mirrors the live path
    if (ms >= 240 && !_b1) { _b1 = true; spawnBurst(_cfg.motes, _cfg.burst); }
    if (_cfg.motes >= 30 && ms >= 700 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.motes * 0.55), _cfg.burst); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo (skipped in render mode)
  if (!render) setTimeout(startDemo, 400);
})();
