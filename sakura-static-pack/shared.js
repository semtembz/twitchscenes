/* =========================================================================
   Sakura Static pixel-Japan overlay pack — shared engine for every screen.
   Runs only what each screen actually includes (photo, petals, bar, status),
   and scales the fixed 1920x1080 stage to fit the window (browser == OBS).
   ========================================================================= */
(() => {
  const params = new URLSearchParams(location.search);
  const num = (k, d) => Number(params.get(k)) || d;
  const $ = (s) => document.querySelector(s);
  const $id = (id) => document.getElementById(id);

  /* ---- fit the 1920x1080 stage to the window (defensive: skip degenerate viewports) ---- */
  function fit() {
    var iw = window.innerWidth, ih = window.innerHeight;
    if (iw < 10 || ih < 10) return;                        // viewport not ready / collapsed; don't write 0
    var s = Math.min(iw / 1920, ih / 1080);
    document.documentElement.style.setProperty('--scale', s);
  }
  fit();
  window.addEventListener('resize', fit);
  // Belt-and-suspenders: keep re-fitting briefly after load so we catch any late
  // viewport (some embedders set the viewport AFTER the script runs).
  var ticks = 0; var iv = setInterval(function () { fit(); if (++ticks > 10) clearInterval(iv); }, 60);

  /* ---- optional handle line ---- */
  const handle = params.get('handle'), handleEl = $id('handle');
  if (handle && handleEl) { handleEl.textContent = handle; handleEl.hidden = false; }

  /* ---- photo on the left panel (if present) ---- */
  const photoEl = $('.photo'), photoImg = $id('photoImg');
  if (photoEl && photoImg) {
    photoImg.onload = () => photoEl.classList.add('ready');
    photoImg.onerror = () => photoEl.classList.add('placeholder', 'ready');
    photoImg.src = params.get('photo') || photoImg.dataset.photo || 'assets/intro-photo.jpg';
  }

  /* ---- sakura petals (if a #petals canvas is present) ---- */
  const pcv = $id('petals');
  if (pcv) {
    const ctx = pcv.getContext('2d');
    const W = pcv.width, H = pcv.height, rightStart = W * 0.46;
    const rand = (a, b) => a + Math.random() * (b - a);
    const COLORS = ['#ff9ec4', '#ffd1e6', '#f7f2f5'];
    const spawn = (initial) => ({ x: rand(rightStart, W), y: initial ? rand(0, H) : -10, size: Math.round(rand(6, 12)), vy: rand(14, 34) / 60, sway: rand(0.4, 1.1), phase: rand(0, Math.PI * 2), drift: rand(-0.25, 0.25), color: COLORS[(Math.random() * COLORS.length) | 0], alpha: rand(0.4, 0.75) });
    const petals = Array.from({ length: num('petals', 24) }, () => spawn(true));
    (function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const p of petals) {
        p.y += p.vy; p.phase += 0.02; p.x += Math.sin(p.phase) * p.sway + p.drift;
        if (p.y > H + 12) Object.assign(p, spawn(false));
        ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        ctx.fillRect(Math.round(p.x + p.size), Math.round(p.y - p.size * 0.5), Math.round(p.size * 0.6), Math.round(p.size * 0.6));
      }
      ctx.globalAlpha = 1; requestAnimationFrame(draw);
    })();
  }

  /* ---- loading bar + status (BRB / Intermission). Done-text via data-done. ---- */
  const fill = $id('fill');
  if (fill) {
    const seconds = num('seconds', 60), bar = $('.loadbar');
    fill.style.transition = `width ${seconds}s linear`;
    setTimeout(() => { fill.style.width = '100%'; }, 60);
    setTimeout(() => {
      if (bar) bar.classList.add('done');
      const statusEn = $id('statusEn');
      if (statusEn && statusEn.dataset.done) statusEn.textContent = statusEn.dataset.done;
      const ls = $id('loadstatus'), lt = $id('loadtext');
      if (ls && lt) { ls.style.opacity = '0'; setTimeout(() => { lt.textContent = lt.dataset.done || 'READY'; ls.style.opacity = '1'; }, 560); }
    }, seconds * 1000);
  }
})();
