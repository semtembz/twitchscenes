/* =========================================================================
   Starting Soon — behavior
   - Reads config from the URL query string (so one file is reusable)
   - Smooth countdown via requestAnimationFrame (self-correcting, no drift)
   - Seamless particle field on a single <canvas> (cheap, recycles edge-to-edge)
   ========================================================================= */
(() => {
  const params = new URLSearchParams(location.search);
  const $ = (sel) => document.querySelector(sel);

  /* ---------- 1. Apply text/brand config ---------- */
  const setText = (sel, value) => { if (value != null) $(sel).textContent = value; };
  setText('#title',    params.get('title'));
  setText('#subtitle', params.get('subtitle'));
  setText('#handle',   params.get('handle'));

  // Accent override: pass ?accent=%2300e5ff  (# must be url-encoded as %23)
  const accent = params.get('accent');
  if (accent) document.documentElement.style.setProperty('--brand-accent', accent);

  /* ---------- 2. Countdown ----------
     Mode A (target time):  ?until=2026-05-30T18:00:00
     Mode B (duration):     ?minutes=10   (default 10)
     At zero, shows the "live" label and recolors. */
  const liveLabel = params.get('live') || 'LIVE NOW';
  const cd = $('#countdown');

  const until = params.get('until');
  const target = until
    ? new Date(until).getTime()
    : Date.now() + (Number(params.get('minutes')) || 10) * 60_000;

  function renderCountdown() {
    const remaining = Math.max(0, target - Date.now());
    if (remaining <= 0) {
      cd.textContent = liveLabel;
      cd.classList.add('live');
      return; // stop ticking
    }
    const totalSec = Math.floor(remaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    cd.textContent = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    requestAnimationFrame(renderCountdown);
  }
  renderCountdown();

  /* ---------- 3. Particle field ----------
     One canvas, rAF loop, transform-free (we paint, not animate DOM).
     Particles drift upward slowly and recycle from top back to bottom,
     so the motion never visibly "restarts" — it's a seamless loop. */
  const canvas = $('.particles');
  const ctx = canvas.getContext('2d');
  const W = 1920, H = 1080;
  canvas.width = W; canvas.height = H;

  const COUNT = Number(params.get('particles')) || 60; // lower this if OBS render time climbs
  const accentColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--brand-accent').trim() || '#00e5ff';

  // Deterministic-ish spread without Math.random dependence on first frame
  const rand = (min, max) => min + Math.random() * (max - min);
  const particles = Array.from({ length: COUNT }, () => ({
    x: rand(0, W),
    y: rand(0, H),
    r: rand(1.2, 3.6),
    vy: rand(6, 22) / 60,        // px per frame upward
    drift: rand(-0.3, 0.3),
    alpha: rand(0.15, 0.6),
    tw: rand(0.5, 1.5),          // twinkle speed
    phase: rand(0, Math.PI * 2),
  }));

  function drawParticles() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.y -= p.vy;
      p.x += p.drift;
      p.phase += 0.02 * p.tw;
      // recycle: when it leaves the top, wrap to just below the bottom
      if (p.y < -5) { p.y = H + 5; p.x = rand(0, W); }
      if (p.x < -5) p.x = W + 5;
      if (p.x > W + 5) p.x = -5;

      const a = p.alpha * (0.6 + 0.4 * Math.sin(p.phase)); // gentle twinkle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(accentColor, a);
      ctx.shadowBlur = 8;
      ctx.shadowColor = accentColor;
      ctx.fill();
    }
    requestAnimationFrame(drawParticles);
  }

  // Accept #rgb / #rrggbb and return an rgba() string at the given alpha.
  function withAlpha(hex, a) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
    const n = parseInt(c, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  }

  drawParticles();
})();
