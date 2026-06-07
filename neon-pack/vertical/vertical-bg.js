/* ============================================================================
   Vertical Overlays — animated topographic background + viewport fit
   ----------------------------------------------------------------------------
   Each .topo-canvas element gets a flowing field of green contour ribbons:
   ~42 horizontal lines, each driven by two sine harmonics with independent
   phase drift, so the field looks like a flowing topographic map. Designed
   for 1080×1920 at 60fps without taxing OBS.
   ============================================================================ */

(function () {
  function startTopo(canvas) {
    // The canvas's bitmap is 1080×1920 (set via width/height attrs in HTML).
    const W = canvas.width  || 1080;
    const H = canvas.height || 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;   // context unavailable (GPU reset / refused) — fail safe, don't throw

    const RIBBONS = 42;
    const ribbons = [];
    for (let i = 0; i < RIBBONS; i++) {
      ribbons.push({
        baseY:        (i / (RIBBONS - 1)) * H,
        amp1:         62 + Math.sin(i * 0.73) * 32,
        freq1:        0.0050 + Math.cos(i * 0.37) * 0.0020,
        phase1:       i * 0.61,
        amp2:         34 + Math.cos(i * 0.49) * 18,
        freq2:        0.0135 + Math.sin(i * 0.93) * 0.0040,
        phase2:       i * 0.42,
        speed1:       0.18 + ((i * 13) % 7) * 0.04,
        speed2:      -0.26 + ((i * 17) % 5) * 0.05,
        driftAmp:     20 + Math.sin(i * 0.27) * 9,
        driftSpeed:   0.06 + ((i * 11) % 9) * 0.012,
        alpha:        0.12 + (i % 3) * 0.04,   // floor raised so lines survive stream compression
      });
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1.7;
      ctx.strokeStyle = "#2fe08c";
      ctx.lineCap = "round";

      const step = 16;   // 16px segments; curves are low-frequency so this is visually identical, ~2x cheaper
      for (const r of ribbons) {
        const yShift = r.driftAmp * Math.sin(t * r.driftSpeed + r.phase1);
        ctx.globalAlpha = r.alpha;
        ctx.beginPath();
        for (let x = 0; x <= W; x += step) {
          const y = r.baseY + yShift
                  + r.amp1 * Math.sin(x * r.freq1 + r.phase1 + t * r.speed1)
                  + r.amp2 * Math.sin(x * r.freq2 + r.phase2 + t * r.speed2);
          if (x === 0) ctx.moveTo(x, y);
          else         ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Advance an animation clock by CLAMPED real time, then throttle drawing to
    // ~30fps. The clamp matters because OBS pauses rAF while a source's scene is
    // hidden; without it, returning to the scene would fast-forward `t` by the whole
    // hidden duration and snap every ribbon to a new phase in one frame. The 30fps
    // cap roughly halves cost (with step=16, ~4x cheaper total) — imperceptible for
    // slow contour drift, and leaves headroom for a game running alongside OBS.
    // Verification hook: render a specific frame on demand (rAF-independent).
    if (!window.__topoDraw) window.__topoDraw = draw;

    let last = null, t = 0, since = 0;
    const MIN_DT = 1000 / 30;
    function loop(now) {
      requestAnimationFrame(loop);
      if (last == null) last = now;
      let dt = now - last; last = now;
      if (dt > 100) dt = 100;        // clamp hidden-scene resume / long GC stalls
      t += dt / 1000;                // motion stays real-time, framerate-independent
      since += dt;
      if (since < MIN_DT) return;    // ~30fps draw throttle
      since = 0;
      draw(t);
    }
    requestAnimationFrame(loop);
  }

  /* ---- Fit the 1080x1920 stage into the viewport (browser == OBS) ---- */
  function fit() {
    var iw = window.innerWidth, ih = window.innerHeight;
    if (iw < 10 || ih < 10) return;
    document.documentElement.style.setProperty(
      "--scale", Math.min(iw / 1080, ih / 1920)
    );
  }
  fit();
  window.addEventListener("resize", fit);
  // Belt-and-suspenders: catch a late-arriving viewport in some embedders.
  var ticks = 0;
  var iv = setInterval(function () { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  function init() {
    document.querySelectorAll(".topo-canvas").forEach(startTopo);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
