/* ============================================================
   MECHA HANGAR — alert engine ("Bay Comms")
   Exposes window.playAlert({type,name,amount}) with per-event
   choreography + copy. Auto-plays a looping DEMO on load.
   Read ?type=&name=&amount= to override the demo data/event.
   Welding-SPARK burst on a TRANSPARENT canvas (delta-clamped rAF):
   white-hot core cooling to amber/red, gravity arcs.
   ?noname=1  => big line shows the EVENT label, kicker hides
                 (the shipping mode — alert platform overlays the name).
   ?render=1  => deterministic manual frame-stepping for headless
                 webm capture via __renderPlay/__renderAdvance.
   Each of the 12 events gets a DISTINCT entrance (.m-<event>) +
   distinct spark profile. Donation/cheer/superchat emphasize amount.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  // noname: render the pod with NO baked viewer name (the big line shows the event;
  // the streamer's Streamlabs/StreamElements overlays the live name).
  const noname = params.get("noname") === "1" || params.get("noname") === "true";
  // render mode: deterministic manual frame-stepping for headless webm capture.
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
     glyph  : icon stamped on the steel tile
     kicker : stencil event line ("NEW FOLLOWER" etc.)
     sub    : mono telemetry sub-line
     motes  : how many welding sparks the burst throws (raid/host bigger)
     amount : true => emphasize the amber AMOUNT readout (cheer/donation/superchat)
     amtPre / amtSuf : decorate a bare numeric amount
     anim   : the .m-<event> entrance class (distinct motion per event)
     hot    : 0..1 spark "heat" — higher = hotter/whiter/faster sparks */
  // sub: per-event flavor SUB-LINE is intentionally EMPTY (no-cringe standard) —
  // the streamer fills it via ?sub=Your%20text (editable slot); blank ships clean.
  const EVENTS = {
    follower:   { glyph:"⊕", kicker:"NEW FOLLOWER",  sub:"",  motes:18, amount:false, anim:"m-follower",  hot:.55 },
    subscriber: { glyph:"✦", kicker:"NEW SUBSCRIBER",sub:"",  motes:24, amount:false, anim:"m-subscriber",hot:.7  },
    member:     { glyph:"◈", kicker:"NEW MEMBER",    sub:"",  motes:22, amount:false, anim:"m-member",    hot:.6  },
    cheer:      { glyph:"✸", kicker:"CHEER",         sub:"",  motes:30, amount:true,  anim:"m-cheer",     hot:.85, amtPre:"", amtSuf:" BITS" },
    donation:   { glyph:"❖", kicker:"DONATION",      sub:"",  motes:34, amount:true,  anim:"m-donation",  hot:.9,  amtPre:"$" },
    host:       { glyph:"⛨", kicker:"NOW HOSTING",   sub:"",  motes:40, amount:true,  anim:"m-host",      hot:.75, amtPre:"", amtSuf:" CREW" },
    raid:       { glyph:"⚑", kicker:"INCOMING RAID", sub:"",  motes:54, amount:true,  anim:"m-raid",      hot:1,   amtPre:"", amtSuf:" INBOUND" },
    like:       { glyph:"▲", kicker:"NEW LIKE",      sub:"",  motes:16, amount:false, anim:"m-like",      hot:.5  },
    share:      { glyph:"➤", kicker:"SHARED",        sub:"",  motes:20, amount:false, anim:"m-share",     hot:.6  },
    star:       { glyph:"★", kicker:"NEW STAR",      sub:"",  motes:26, amount:true,  anim:"m-star",      hot:.8,  amtPre:"", amtSuf:" STARS" },
    superchat:  { glyph:"✉", kicker:"SUPER CHAT",    sub:"",  motes:32, amount:true,  anim:"m-superchat", hot:.85, amtPre:"$" },
    supporter:  { glyph:"✚", kicker:"NEW SUPPORTER", sub:"",  motes:24, amount:false, anim:"m-supporter", hot:.65 },
  };
  // optional buyer-supplied sub-line override (?sub=...), shared by live + render paths
  const SUB_OVERRIDE = params.get("sub");
  const subText = (cfg) => (SUB_OVERRIDE != null ? SUB_OVERRIDE : cfg.sub);
  const DEFAULT = EVENTS.follower;
  const ANIMS = Object.keys(EVENTS).map((k) => EVENTS[k].anim);

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

  /* ---- the pod elements ---- */
  const card = $id("alert");
  const glyphEl = $id("glyph");
  const kickEl = $id("kick-label");
  const nameEl = $id("name");
  const amountEl = $id("amount");
  const subEl = $id("sub");

  let hideTimer = null, busy = false, demoOn = false;

  /* ---- welding-spark burst on a transparent canvas (delta-clamped rAF) ----
     white-hot core cooling to amber then red; gravity arcs; motion is recycled
     from the pod's mount point in the lower-left of the bay. */
  const cv = $(".fx");
  const ctx = cv ? cv.getContext("2d") : null;
  const W = cv ? (cv.width || 1920) : 1920;
  const H = cv ? (cv.height || 1080) : 1080;
  const R = (a, b) => a + Math.random() * (b - a);
  let burst = [];

  // hot-to-cool ramp for a spark by its remaining life fraction (1 = fresh/white)
  function sparkColor(f) {
    if (f > 0.72) return "#FFF3D6";        // white-hot
    if (f > 0.5)  return "#FFE08A";
    if (f > 0.32) return "#F5A623";        // amber
    if (f > 0.16) return "#D2641A";
    return "#FF4D2E";                       // cooling red ember
  }

  // burst originates near the pod's glyph tile (lower-left of the stage)
  function spawnBurst(n, hot) {
    hot = hot == null ? 0.7 : hot;
    const ox = 250, oy = H - 220;
    const speed = 0.6 + hot * 0.9;          // hotter events throw faster/farther
    for (let i = 0; i < n; i++) {
      const life = R(0.9, 1.9) + hot * 0.5;
      burst.push({
        x: ox + R(-60, 130), y: oy + R(-70, 40),
        vx: R(20, 230) / 60 * speed, vy: R(-260, -70) / 60 * speed,
        g: R(150, 280) / 3600,              // gravity per frame-ish (sparks arc + fall)
        s: R(1.4, 3.6) + hot * 1.2,
        a: 1, life, life0: life,
        // a short motion-streak tail along the velocity vector
        streak: R(3, 9) + hot * 5,
      });
    }
  }

  function drawSpark(p) {
    const f = p.life / p.life0;             // 1 -> 0 over the spark's life
    const col = sparkColor(f);
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    // motion streak (additive-ish glow trail behind the head)
    const len = p.streak;
    const sx = p.x - p.vx * len, sy = p.y - p.vy * len;
    ctx.lineWidth = Math.max(1, p.s * 0.6);
    ctx.beginPath();
    ctx.moveTo(Math.round(sx), Math.round(sy));
    ctx.lineTo(Math.round(p.x), Math.round(p.y));
    ctx.stroke();
    // hot head
    ctx.beginPath();
    ctx.arc(Math.round(p.x), Math.round(p.y), Math.max(0.5, p.s * 0.6), 0, 6.283);
    ctx.fill();
  }

  function frame() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // additive — sparks read as hot light
    for (let i = burst.length - 1; i >= 0; i--) {
      const p = burst[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g;
      p.vx *= 0.992;                          // a touch of air drag
      p.life -= 1 / 30; p.a = Math.min(1, Math.max(0, p.life));
      if (p.life <= 0 || p.y > H + 60) { burst.splice(i, 1); continue; }
      drawSpark(p);
    }
    ctx.restore();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  window.__mechaAlertDraw = frame; // rAF-independent verification hook

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

  // strip any per-event entrance modifier classes off the pod
  function clearAnims() {
    if (!card) return;
    for (const a of ANIMS) card.classList.remove(a);
  }

  /* ---- play(): drive one alert through its choreography ---- */
  function play(opts) {
    opts = opts || {};
    const type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    const cfg = EVENTS[type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : "NewPilot";
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
    if (subEl) subEl.textContent = subText(cfg);
    if (amountEl) amountEl.textContent = amountStr;
    card.classList.toggle("has-amount", !!(cfg.amount && amountStr));

    // restart the entrance animation cleanly with this event's distinct motion
    card.classList.remove("hide", "show");
    clearAnims();
    void card.offsetWidth; // force reflow so re-adding .show replays it
    card.classList.add(cfg.anim);
    card.classList.add("show");

    // welding-spark burst (staggered a touch so it reads after the slide-in)
    setTimeout(() => spawnBurst(cfg.motes, cfg.hot), 200);
    // raid/host/donation get a second pop for "bigger" feel
    if (cfg.motes >= 32) setTimeout(() => spawnBurst(Math.round(cfg.motes * 0.6), cfg.hot), 560);

    // hold, then slide out
    const HOLD = 4200;
    hideTimer = setTimeout(() => {
      card.classList.remove("show");
      clearAnims();
      card.classList.add("hide");
      hideTimer = setTimeout(() => {
        busy = false;
        // if running the demo loop, queue the next one after a short gap
        if (demoOn) hideTimer = setTimeout(() => { if (demoOn && !busy) play(demoData()); }, 1700);
      }, 480);
    }, HOLD);
  }
  window.playAlert = play;

  /* ---- auto DEMO on load: play once, then loop every few seconds ---- */
  function demoData() {
    return {
      type: pageType(),
      name: params.get("name") || "NewPilot",
      amount: params.get("amount") != null ? params.get("amount") : "5",
    };
  }
  function startDemo() {
    // self-chaining loop: each cycle queues the next from its own completion so
    // the beats never drift or overlap.
    demoOn = true;
    play(demoData());
  }

  /* ---- deterministic render mode: drive one full play via manual frame steps ----
     mirrors each per-event entrance with an explicit transform so the headless
     webm pipeline captures the SAME distinct motion as the live CSS. */
  let _cfg = DEFAULT, _type = "follower", _f = 0, _b1 = false, _b2 = false;
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeMech = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; // ~cubic-bezier(.85,0,.15,1)

  function renderPlay(opts) {
    opts = opts || {};
    _type = (opts.type && EVENTS[opts.type]) ? opts.type : pageType();
    _cfg = EVENTS[_type] || DEFAULT;
    const name = (opts.name != null && opts.name !== "") ? String(opts.name) : (params.get("name") || "NewPilot");
    const amountStr = fmtAmount(_cfg, opts.amount != null ? opts.amount : params.get("amount"));
    if (!card) return;
    if (glyphEl) glyphEl.textContent = _cfg.glyph;
    const kickLine = card.querySelector(".kick");
    if (noname) { if (kickLine) kickLine.style.display = "none"; if (nameEl) nameEl.textContent = _cfg.kicker; }
    else { if (kickLine) kickLine.style.display = ""; if (kickEl) kickEl.textContent = _cfg.kicker; if (nameEl) nameEl.textContent = name; }
    if (subEl) subEl.textContent = subText(_cfg);
    if (amountEl) amountEl.textContent = amountStr;
    card.classList.toggle("has-amount", !!(_cfg.amount && amountStr));
    card.classList.remove("show", "hide");
    clearAnims();
    _f = 0; _b1 = false; _b2 = false; burst = [];
  }

  // compute the pod transform for a given event + entrance progress (0..1) + ms
  function entranceTransform(type, p, ms) {
    // p = 0..1 across the entrance; returns {t, op, extra}
    let t = "translateX(0)", op = 1;
    switch (type) {
      case "subscriber": { // drop from above + settle
        const e = easeMech(p);
        let y = -560 + e * 560;
        if (p > 0.68) y = 26 - ((p - 0.68) / 0.32) * 26; // settle (26 -> 0 region, simplified)
        t = "translateY(" + y.toFixed(1) + "px)"; op = Math.min(1, p * 2); break;
      }
      case "member": { // rise from the floor
        const e = easeOut(p); const y = 420 - e * 438; // overshoot to -18 then 0
        t = "translateY(" + (p < 0.7 ? y : (-18 + ((p - 0.7) / 0.3) * 18)).toFixed(1) + "px)"; op = Math.min(1, p * 2); break;
      }
      case "cheer": { // punch zoom from small
        const e = easeMech(p); const s = 0.55 + e * 0.5; const sc = p < 0.6 ? 0.55 + (p / 0.6) * 0.5 : 1.05 - ((p - 0.6) / 0.4) * 0.05;
        t = "scale(" + sc.toFixed(3) + ")"; op = Math.min(1, p * 2); break;
      }
      case "donation": { // overshoot slam + recoil
        let x;
        if (p < 0.56) x = -980 + easeMech(p / 0.56) * 1026;       // -980 -> +46
        else if (p < 0.74) x = 46 - ((p - 0.56) / 0.18) * 60;     // +46 -> -14
        else x = -14 + ((p - 0.74) / 0.26) * 14;                  // -14 -> 0
        t = "translateX(" + x.toFixed(1) + "px)"; op = Math.min(1, p * 2.2); break;
      }
      case "host": { // wide unfold (scaleX)
        const e = easeOut(p); const sx = p < 0.62 ? 0.12 + (e / easeOut(0.62)) * 0.92 : 1.04 - ((p - 0.62) / 0.38) * 0.04;
        t = "scaleX(" + Math.max(0.12, sx).toFixed(3) + ")"; op = Math.min(1, p * 2); break;
      }
      case "raid": { // hard shake-in
        let x = 0;
        if (p < 0.48) x = -980 + easeMech(p / 0.48) * 980;
        else { const q = (p - 0.48) / 0.52; x = Math.cos(q * Math.PI * 5) * 22 * (1 - q); }
        t = "translateX(" + x.toFixed(1) + "px)"; op = Math.min(1, p * 2.4); break;
      }
      case "like": { // light bounce
        const x = p < 0.62 ? -980 + easeOut(p / 0.62) * 980 : 0;
        let y = 0; if (p >= 0.62) { const q = (p - 0.62) / 0.38; y = -16 * Math.sin(q * Math.PI); }
        t = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)"; op = Math.min(1, p * 2); break;
      }
      case "share": { // diagonal slide from lower-left
        const e = easeOut(p); const x = -760 + e * 760; const y = 560 - e * 560;
        t = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)"; op = Math.min(1, p * 2); break;
      }
      case "star": { // spin-in + settle
        const e = easeMech(p); const rot = -7 + e * 7; const sc = 0.7 + e * 0.3;
        t = "rotate(" + rot.toFixed(2) + "deg) scale(" + sc.toFixed(3) + ")"; op = Math.min(1, p * 2); break;
      }
      case "superchat": { // slide down from top + lock
        const e = easeMech(p); let y = -620 + e * 620; if (p > 0.66) y = 22 - ((p - 0.66) / 0.34) * 22;
        t = "translateY(" + y.toFixed(1) + "px)"; op = Math.min(1, p * 2); break;
      }
      case "supporter": { // calm push from left
        const e = easeOut(p); const x = -220 + e * 220;
        t = "translateX(" + x.toFixed(1) + "px)"; op = Math.min(1, p * 1.6); break;
      }
      case "follower":
      default: { // bolt-slam from the left dock
        let x;
        if (p < 0.72) x = -980 + easeOut(p / 0.72) * 1002; // -980 -> +22
        else x = 22 - ((p - 0.72) / 0.28) * 22;            // +22 -> 0
        t = "translateX(" + x.toFixed(1) + "px)"; op = Math.min(1, p * 2); break;
      }
    }
    return { t, op };
  }

  function renderAdvance() {
    const ms = _f * (1000 / 30);
    const ENTER = 700, HOLD = 4200, EXIT = 480, holdEnd = ENTER + HOLD;
    let t, op;
    if (ms < ENTER) { const r = entranceTransform(_type, ms / ENTER, ms); t = r.t; op = r.op; }
    else if (ms < holdEnd) { t = "translateX(0)"; op = 1; }
    else { const p = Math.min(1, (ms - holdEnd) / EXIT); t = "translateX(" + (-980 * easeMech(p)).toFixed(1) + "px)"; op = 1 - p; }
    if (card) { card.style.transform = t; card.style.opacity = op.toFixed(3); }

    // glyph stamp
    const glyph = card && card.querySelector(".glyph");
    if (glyph) {
      const gp = (ms - 140) / 600;
      let gs;
      if (gp <= 0) gs = 1.5; else if (gp >= 1) gs = 1;
      else gs = gp < 0.55 ? 1.5 - (gp / 0.55) * 0.58 : 0.92 + ((gp - 0.55) / 0.45) * 0.08;
      glyph.style.transform = "scale(" + gs.toFixed(3) + ")"; glyph.style.opacity = gp <= 0 ? "0" : "1";
    }
    // amount charge-in (if shown)
    const amt = card && card.querySelector(".amount");
    if (amt && card.classList.contains("has-amount")) {
      const ap = (ms - 260) / 700;
      const ao = ap <= 0 ? 0 : ap >= 1 ? 1 : ap;
      const ay = (1 - easeMech(Math.max(0, Math.min(1, ap)))) * 8;
      amt.style.opacity = ao.toFixed(3); amt.style.transform = "translateY(" + ay.toFixed(2) + "px)";
    }
    // charge bar sweep (starts ~.55s, runs 4s)
    const lvl = card && card.querySelector(".charge .lvl");
    if (lvl) {
      const cp = (ms - 550) / 4000; lvl.style.width = (Math.max(0, Math.min(1, cp)) * 100).toFixed(2) + "%";
    }

    if (ms >= 200 && !_b1) { _b1 = true; spawnBurst(_cfg.motes, _cfg.hot); }
    if (_cfg.motes >= 32 && ms >= 560 && !_b2) { _b2 = true; spawnBurst(Math.round(_cfg.motes * 0.6), _cfg.hot); }
    if (ctx) frame();
    _f++;
    return ms;
  }
  window.__renderPlay = renderPlay;
  window.__renderAdvance = renderAdvance;

  // kick off the live demo after a tiny delay (skipped in render mode)
  if (!render) setTimeout(startDemo, 400);
})();
