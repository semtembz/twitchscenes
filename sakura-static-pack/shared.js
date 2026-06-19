/* ============================================================
   SAKURA STATIC — shared engine ("lo-fi anime night")
   fit() scaling, bokeh + soft petal + grain canvas field,
   the seek-bar timer, status flip. Runs only what a scene includes.
   ============================================================ */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const num = (k, d) => Number(params.get(k)) || d;
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);

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

  /* ---- decorative waveform behind the seek bar (if present) ---- */
  const wave = $id("wave");
  if (wave) {
    let html = "";
    for (let i = 0; i < 64; i++) {
      const h = 3 + Math.abs(Math.sin(i * 0.7)) * 9 + (i % 5);
      html += '<i style="height:' + h.toFixed(0) + 'px"></i>';
    }
    wave.innerHTML = html;
  }

  /* ---- seek bar = hidden timer (no numbers). status flip on done. ---- */
  const fill = $id("fill"), knob = $id("knob");
  if (fill) {
    const seconds = num("seconds", 60);
    fill.style.transition = "width " + seconds + "s linear";
    if (knob) knob.style.transition = "left " + seconds + "s linear";
    setTimeout(() => { fill.style.width = "100%"; if (knob) knob.style.left = "100%"; }, 80);
    setTimeout(() => {
      const k = $id("kicker");
      if (k && k.dataset.done) k.textContent = k.dataset.done;
    }, seconds * 1000);
  }

  /* ---- canvas field: bokeh blooms + soft drifting petals ---- */
  const cv = $(".bg");
  if (cv) {
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = cv.width || 1920, H = cv.height || 1080;
    const PINKS = ["#FF5E9C", "#FFD1E6", "#7B2D5E", "#FF9EC4"];
    const R = (a, b) => a + Math.random() * (b - a);
    const BOKEH = num("bokeh", 13), PETALS = num("petals", 18);

    const bokeh = Array.from({ length: BOKEH }, () => ({
      x: R(0, W), y: R(0, H), r: R(70, 210), c: PINKS[(Math.random() * PINKS.length) | 0],
      a: R(0.05, 0.16), vx: R(-6, 6) / 60, vy: R(-5, 3) / 60, ph: R(0, 6.28), ps: R(0.4, 1.0),
    }));
    const mk = (initial) => ({
      x: R(0, W), y: initial ? R(0, H) : R(-80, -10), s: R(16, 34), vy: R(16, 34) / 60,
      sway: R(0.5, 1.4), ph: R(0, 6.28), drift: R(-0.3, 0.3), rot: R(0, 6.28),
      vr: R(-0.6, 0.6) / 60, a: R(0.35, 0.8), c: PINKS[(Math.random() < 0.5) ? 0 : 1],
    });
    const petals = Array.from({ length: PETALS }, () => mk(true));

    function drawPetal(p) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 10;
      const s = p.s;
      ctx.beginPath(); ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.6, -s * 0.6, s * 0.5, s * 0.5, 0, s);
      ctx.bezierCurveTo(-s * 0.5, s * 0.5, -s * 0.6, -s * 0.6, 0, -s); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = p.a * 0.5; ctx.fillStyle = "rgba(14,10,18,0.6)";
      ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(-s * 0.12, s * 0.6); ctx.lineTo(s * 0.12, s * 0.6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (const b of bokeh) {
        b.x += b.vx; b.y += b.vy; b.ph += 0.01 * b.ps;
        if (b.x < -260) b.x = W + 260; if (b.x > W + 260) b.x = -260;
        if (b.y < -260) b.y = H + 260; if (b.y > H + 260) b.y = -260;
        const rr = b.r * (1 + Math.sin(b.ph) * 0.12);
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr);
        g.addColorStop(0, b.c); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = b.a; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const p of petals) {
        p.y += p.vy; p.ph += 0.02; p.rot += p.vr; p.x += Math.sin(p.ph) * p.sway + p.drift;
        if (p.y > H + 40 || p.x < -60 || p.x > W + 60) Object.assign(p, mk(false));
        drawPetal(p);
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    window.__sakuraDraw = frame; // rAF-independent verification hook

    let last = null, since = 0; const MIN = 1000 / 30;
    function loop(now) {
      requestAnimationFrame(loop);
      if (last == null) last = now;
      let dt = now - last; last = now; if (dt > 100) dt = 100;
      since += dt; if (since < MIN) return; since = 0; frame();
    }
    requestAnimationFrame(loop);
  }
})();
