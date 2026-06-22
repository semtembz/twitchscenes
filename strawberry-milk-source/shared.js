/* ============================================================
   STRAWBERRY MILK — shared engine ("Sticker Journal Cafe")
   fit() scaling, a sweet canvas field (boba pearls + strawberry
   slices + little hearts drifting UP + tiny sparkles), and a CUTE
   progress styled as a glass FILLING with pink milk (hidden timer,
   no numbers). Render mode (?render=1) exposes a deterministic
   __renderAdvance() so the headless pipeline can capture webm
   without virtual time. Runs only what each scene includes.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const num = (k, d) => Number(params.get(k)) || d;
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);
  const render = params.get("render") === "1";
  const stage = $id("stage");
  if (render && stage) stage.classList.add("render");

  /* ---- fit the 1920x1080 stage to the window (defensive) ---- */
  function fit() {
    const iw = window.innerWidth, ih = window.innerHeight;
    if (iw < 10 || ih < 10) return;
    document.documentElement.style.setProperty("--scale", Math.min(iw / 1920, ih / 1080));
  }
  fit(); window.addEventListener("resize", fit);
  let ticks = 0; const iv = setInterval(() => { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- optional handle ---- */
  const handle = params.get("handle"), handleEl = $id("handle");
  if (handle && handleEl) handleEl.textContent = handle;

  /* ---- editable text slots: any [data-slot] ships a muted "[ your text here ]"
     placeholder the buyer edits or deletes. ?slotname=Text sets it at render
     time; ?slotname=- (or empty/none/off) removes it entirely. ---- */
  document.querySelectorAll("[data-slot]").forEach((el) => {
    const v = params.get(el.dataset.slot);
    if (v == null) return;
    if (v === "-" || v === "" || v === "none" || v === "off") { el.remove(); return; }
    el.textContent = v;
    el.classList.remove("is-slot");
  });

  /* ---- glass fill = hidden timer (no numbers). status flip on done. ---- */
  const fill = $id("fill");
  const barSeconds = num("seconds", 60);
  let barT0 = null;
  function setBar(p) {
    if (fill) fill.style.height = Math.max(0, Math.min(1, p)) * 100 + "%";
    if (p >= 1) {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
    }
  }

  /* ---- canvas field: boba pearls + strawberry slices + hearts UP + sparkles ---- */
  const cv = $(".bg");
  let ctx = null, W = 1920, H = 1080, items = [], spark = [];
  if (cv) {
    ctx = cv.getContext("2d");
    if (ctx) {
      W = cv.width || 1920; H = cv.height || 1080;
      const R = (a, b) => a + Math.random() * (b - a);
      const HEART = ["#FF8FAB", "#FFB3C6", "#FFFFFF"];
      const BEAD = ["#C98AA0", "#A45D6E", "#7A4453"];
      const N = num("drift", 26);

      // kinds: 0 = boba pearl, 1 = strawberry slice, 2 = heart
      const mk = (initial) => {
        const kind = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? 1 : 2);
        return {
          kind,
          x: R(0, W),
          y: initial ? R(0, H) : H + R(20, 120),
          s: kind === 2 ? R(16, 30) : (kind === 1 ? R(18, 34) : R(8, 16)),
          vy: R(22, 46) / 30,                 // drift UP (px per 1/30s)
          sway: R(8, 26), ph: R(0, 6.28), vph: R(0.6, 1.4) / 30,
          rot: R(0, 6.28), vr: R(-0.5, 0.5) / 30,
          a: R(0.55, 0.95),
          c: kind === 2 ? HEART[(Math.random() * HEART.length) | 0] : BEAD[(Math.random() * BEAD.length) | 0],
        };
      };
      items = Array.from({ length: N }, () => mk(true));
      spark = Array.from({ length: num("sparkles", 22) }, () => ({
        x: R(0, W), y: R(0, H), s: R(2, 6), ph: R(0, 6.28), vph: R(1.2, 2.6) / 30,
      }));

      window.__smDraw = drawBg; // verification hook
    }
  }

  /* ---- shape helpers (only meaningful when the canvas exists) ---- */
  function heart(x, y, s, rot, a, c) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a; ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.34);
    ctx.bezierCurveTo(s * 0.9, -s * 0.55, s * 0.55, -s * 1.05, 0, -s * 0.5);
    ctx.bezierCurveTo(-s * 0.55, -s * 1.05, -s * 0.9, -s * 0.55, 0, s * 0.34);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function strawberry(x, y, s, rot, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a;
    ctx.fillStyle = "#FF8FAB";
    ctx.beginPath(); ctx.arc(0, 0, s, 0, 6.2832); ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.18); ctx.strokeStyle = "#FFE3EC";
    ctx.beginPath(); ctx.arc(0, 0, s - ctx.lineWidth * 0.5, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = "#FFF1F4";
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * 6.2832, rr = s * 0.55;
      ctx.beginPath(); ctx.arc(Math.round(Math.cos(ang) * rr), Math.round(Math.sin(ang) * rr), Math.max(1, s * 0.09), 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
  function pearl(x, y, s, a, c) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y, s, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = a * 0.5; ctx.fillStyle = "#FFFFFF";
    ctx.beginPath(); ctx.arc(x - s * 0.3, y - s * 0.3, s * 0.32, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  function drawBg(dt) {
    if (!ctx) return;
    const f = dt * 30; // normalize: 1.0 == one 1/30s step
    ctx.clearRect(0, 0, W, H);
    // sparkles (twinkle)
    for (const sp of spark) {
      sp.ph += sp.vph * f;
      const tw = (Math.sin(sp.ph) + 1) * 0.5;
      ctx.globalAlpha = 0.25 + tw * 0.6; ctx.fillStyle = "#FFFFFF";
      const r = sp.s * (0.5 + tw * 0.7);
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y - r); ctx.lineTo(sp.x + r * 0.32, sp.y - r * 0.32);
      ctx.lineTo(sp.x + r, sp.y); ctx.lineTo(sp.x + r * 0.32, sp.y + r * 0.32);
      ctx.lineTo(sp.x, sp.y + r); ctx.lineTo(sp.x - r * 0.32, sp.y + r * 0.32);
      ctx.lineTo(sp.x - r, sp.y); ctx.lineTo(sp.x - r * 0.32, sp.y - r * 0.32);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // drifting sweets (rise UP)
    for (const it of items) {
      it.y -= it.vy * f; it.ph += it.vph * f; it.rot += it.vr * f;
      const x = Math.round(it.x + Math.sin(it.ph) * it.sway), y = Math.round(it.y);
      if (it.y < -60) {
        it.x = Math.random() * W; it.y = H + 20 + Math.random() * 100; it.ph = Math.random() * 6.28;
        continue;
      }
      if (it.kind === 2) heart(x, y, it.s, it.rot, it.a, it.c);
      else if (it.kind === 1) strawberry(x, y, it.s, it.rot, it.a);
      else pearl(x, y, it.s, it.a, it.c);
    }
    ctx.globalAlpha = 1;
  }

  /* ---- timeline driver ---- */
  function tick(seconds) { setBar(Math.min(1, seconds / barSeconds)); }

  /* ---- render mode: deterministic frame stepping (1 frame = 1/30s) ---- */
  let rf = 0;
  window.__renderPlay = function () { rf = 0; tick(0); };
  window.__renderAdvance = function () {
    const t = rf / 30;            // seconds
    drawBg(1 / 30);
    tick(t);
    rf++;
    return rf * (1000 / 30);
  };

  /* ---- free-running mode ---- */
  if (!render) {
    setTimeout(() => { barT0 = performance.now(); }, 80);
    let last = null, acc = 0; const FRAME = 1000 / 30;
    function loop(now) {
      requestAnimationFrame(loop);
      if (last == null) last = now;
      let dt = now - last; last = now; if (dt > 100) dt = 100;
      acc += dt; if (acc < FRAME) return; const step = acc / 1000; acc = 0;
      drawBg(step);
      if (barT0 != null) tick((now - barT0) / 1000);
    }
    requestAnimationFrame(loop);
  }
})();
