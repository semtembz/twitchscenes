/* =========================================================================
   Neon hero vs. blob — a ~15s looping mini-chase around the right panel.
   Beats: chase  ->  grab power pellet  ->  turn & chase  ->  kill (pixel pop)
          ->  celebrate  ->  pixel-vanish  ->  short gap  ->  loop.

   Self-contained: paints on its own transparent <canvas id="hero"> over the
   scene. Exposes window.heroStateAt(T) so the state machine can be verified
   without depending on the render loop.
   ========================================================================= */
(() => {
  const cv = document.getElementById('hero');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = 1920, H = 1080;

  /* ---- palette ---- */
  const NEON = '#2fe08c', MINT = '#79ffc4', BLADE = '#e8fff6';
  const MAG = '#ff3df0', MAG_SCARED = '#bfe9ff';
  const SKIN = '#e8c0a0', HAIR = '#1c130d', OUTFIT = '#0d2a20', PELLET = '#eafff5';

  /* ---- orbit path around the right-panel text ---- */
  const CX = 1401, CY = 545, RX = 448, RY = 372;
  const norm = (u) => ((u % 1) + 1) % 1;
  const getPos = (u) => {
    const a = norm(u) * Math.PI * 2 - Math.PI / 2;   // start at top
    return { x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) };
  };
  const faceLeft = (u, dir) => (getPos(u + 0.01 * dir).x - getPos(u).x) < 0;

  const GAP = 0.14;                 // how far the blob trails the hero (fraction of loop)
  const PELLET_U = 0.35;            // where the pellet sits / hero ends the chase
  const KILL_U = 0.07;              // where the hero catches the blob
  const killPos = getPos(KILL_U);

  /* ---- timeline (seconds) ---- */
  const T_INTRO = 0.8, T_CHASE = 5.8, T_POWER = 6.5, T_REVERSE = 10.0,
        T_KILL = 10.8, T_CELEB = 12.4, T_VANISH = 13.7, LOOP = 15.0;

  /* =====================================================================
     Sprite drawing (small offscreen canvases, scaled up crisp with a glow)
     ===================================================================== */
  const HW = 20, HH = 28, HERO_SCALE = 2.6;
  const BW = 16, BH = 16, BLOB_SCALE = 2.6;

  function drawHeroSprite(g, swordUp, frame) {
    g.clearRect(0, 0, HW, HH);
    // legs (2-frame run cycle)
    g.fillStyle = '#08160f';
    if (frame === 0) { g.fillRect(7, 21, 3, 6); g.fillRect(11, 22, 3, 5); }
    else { g.fillRect(7, 22, 3, 5); g.fillRect(11, 21, 3, 6); }
    g.fillStyle = NEON; g.fillRect(7, 26, 3, 1); g.fillRect(11, 26, 3, 1);   // neon shoes
    // torso
    g.fillStyle = OUTFIT; g.fillRect(6, 12, 9, 9);
    g.fillStyle = NEON; g.fillRect(6, 12, 9, 1);                              // shoulder trim
    g.fillStyle = MINT; g.fillRect(9, 13, 2, 1);                              // chain
    // face
    g.fillStyle = SKIN; g.fillRect(7, 6, 7, 6);
    // curly hair (bumpy mass + side curls)
    g.fillStyle = HAIR;
    g.fillRect(6, 3, 9, 3);
    g.fillRect(5, 4, 1, 3); g.fillRect(15, 4, 1, 3);     // sideburns
    g.fillRect(7, 2, 2, 1); g.fillRect(11, 2, 2, 1); g.fillRect(9, 1, 2, 1); // top curls
    g.fillRect(6, 6, 1, 1); g.fillRect(14, 6, 1, 1);
    // eyes + brow
    g.fillStyle = HAIR; g.fillRect(7, 7, 7, 1);          // strong brow
    g.fillStyle = '#241a12'; g.fillRect(8, 8, 1, 1); g.fillRect(12, 8, 1, 1);
    // arm + sword on leading (right) side
    g.fillStyle = SKIN;
    if (swordUp) g.fillRect(15, 8, 2, 4); else g.fillRect(15, 14, 2, 4);
    g.fillStyle = BLADE;
    if (swordUp) { g.fillRect(16, 1, 1, 8); g.fillStyle = NEON; g.fillRect(15, 8, 3, 1); }
    else { g.fillRect(17, 12, 1, 8); g.fillStyle = NEON; g.fillRect(16, 15, 3, 1); }
  }

  function drawBlobSprite(g, scared) {
    g.clearRect(0, 0, BW, BH);
    g.fillStyle = scared ? MAG_SCARED : MAG;
    g.beginPath();
    g.arc(8, 7, 6, Math.PI, 0);                          // dome
    g.lineTo(14, 14);
    g.lineTo(12, 12); g.lineTo(10, 14); g.lineTo(8, 12); g.lineTo(6, 14); g.lineTo(4, 12); g.lineTo(2, 14);
    g.lineTo(2, 7); g.closePath(); g.fill();
    g.fillStyle = '#ffffff'; g.fillRect(5, 6, 3, 3); g.fillRect(9, 6, 3, 3);
    g.fillStyle = scared ? '#1530ff' : '#33002e';
    g.fillRect(6, 7, 1, 2); g.fillRect(10, 7, 1, 2);
  }

  // live (animated) sprites + still copies used for the pixel dissolves
  const heroCv = mk(HW, HH), blobCv = mk(BW, BH);
  const heroStill = mk(HW, HH), blobStill = mk(BW, BH);
  drawHeroSprite(heroStill.getContext('2d'), false, 0);
  drawBlobSprite(blobStill.getContext('2d'), false);

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function blit(src, cx, cy, scale, faceL, glow, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = glow; ctx.shadowBlur = 14;
    ctx.translate(cx, cy);
    if (faceL) ctx.scale(-1, 1);
    const w = src.width * scale, h = src.height * scale;
    ctx.drawImage(src, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /* ---- precompute pixel-dissolve particles from the still sprites ---- */
  function buildParticles(still, scale) {
    const w = still.width, h = still.height;
    const data = still.getContext('2d').getImageData(0, 0, w, h).data;
    const parts = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 40) continue;                    // skip transparent
      parts.push({
        ox: (x - w / 2) * scale, oy: (y - h / 2) * scale,
        vx: (Math.random() * 2 - 1) * 90,
        vy: -(0.2 + Math.random() * 1.3) * 90,
        color: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`,
        size: scale,
      });
    }
    return parts;
  }
  const heroParts = buildParticles(heroStill, HERO_SCALE);
  const blobParts = buildParticles(blobStill, BLOB_SCALE);

  function drawDissolve(parts, cx, cy, localT, dur, grav) {
    const a = Math.max(0, 1 - localT / dur);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    for (const p of parts) {
      const x = cx + p.ox + p.vx * localT;
      const y = cy + p.oy + p.vy * localT + 0.5 * grav * localT * localT;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.fillRect(x, y, p.size, p.size);
    }
    ctx.restore();
  }

  /* =====================================================================
     State machine — pure function of loop-time T (verifiable via eval)
     ===================================================================== */
  function computeState(T) {
    const s = {
      phase: 'gap',
      hero: { x: 0, y: 0, vis: false, faceLeft: false, swordUp: false, power: false, alpha: 1 },
      blob: { x: 0, y: 0, vis: false, scared: false, faceLeft: false, alpha: 1 },
      pellet: false, flash: 0, killT: -1, celebT: -1, vanishT: -1,
    };
    if (T < T_INTRO) {
      s.phase = 'intro';
      const a = T / T_INTRO, hp = getPos(0), bp = getPos(-GAP);
      s.hero = { ...s.hero, x: hp.x, y: hp.y, vis: true, alpha: a };
      s.blob = { ...s.blob, x: bp.x, y: bp.y, vis: true, alpha: a };
    } else if (T < T_CHASE) {
      s.phase = 'chase';
      const ct = (T - T_INTRO) / (T_CHASE - T_INTRO);
      const hu = 1.35 * ct, bu = hu - GAP;
      const hp = getPos(hu), bp = getPos(bu);
      s.hero = { ...s.hero, x: hp.x, y: hp.y, vis: true, faceLeft: faceLeft(hu, 1) };
      s.blob = { ...s.blob, x: bp.x, y: bp.y, vis: true, faceLeft: faceLeft(bu, 1) };
      s.pellet = true;
    } else if (T < T_POWER) {
      s.phase = 'power';
      const hp = getPos(PELLET_U), bp = getPos(0.17);
      s.hero = { ...s.hero, x: hp.x, y: hp.y, vis: true, power: true };
      s.blob = { ...s.blob, x: bp.x, y: bp.y, vis: true, scared: true };
      s.flash = (T - T_CHASE) / (T_POWER - T_CHASE);
    } else if (T < T_REVERSE) {
      s.phase = 'reverse';
      const rt = (T - T_POWER) / (T_REVERSE - T_POWER), ease = rt * rt;
      const heroU = PELLET_U + (KILL_U - PELLET_U) * ease;
      const blobU = 0.17 + (KILL_U - 0.17) * rt;
      const hp = getPos(heroU), bp = getPos(blobU);
      s.hero = { ...s.hero, x: hp.x, y: hp.y, vis: true, faceLeft: faceLeft(heroU, -1), swordUp: true, power: true };
      s.blob = { ...s.blob, x: bp.x, y: bp.y, vis: true, scared: true, faceLeft: faceLeft(blobU, -1) };
    } else if (T < T_KILL) {
      s.phase = 'kill';
      s.hero = { ...s.hero, x: killPos.x, y: killPos.y, vis: true, swordUp: true, power: true };
      s.killT = T - T_REVERSE;                            // 0..0.8 -> blob death particles
    } else if (T < T_CELEB) {
      s.phase = 'celebrate';
      const ct = T - T_KILL;
      s.hero = { ...s.hero, x: killPos.x, y: killPos.y - Math.abs(Math.sin(ct * 9)) * 16, vis: true, swordUp: true, power: true };
      s.celebT = ct;
    } else if (T < T_VANISH) {
      s.phase = 'vanish';
      s.vanishT = T - T_CELEB;                            // 0..1.3 -> hero dissolves
    }
    return s;
  }
  window.heroStateAt = computeState;                      // exposed for verification

  /* ---- per-frame rendering ---- */
  function draw(T) {
    ctx.clearRect(0, 0, W, H);
    const s = computeState(T);

    if (s.pellet) {                                       // blinking power pellet
      const p = getPos(PELLET_U), r = 8 + 2.5 * Math.sin(T * 8);
      ctx.save(); ctx.shadowColor = MINT; ctx.shadowBlur = 20; ctx.fillStyle = PELLET;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (s.blob.vis) {
      drawBlobSprite(blobCv.getContext('2d'), s.blob.scared);
      blit(blobCv, s.blob.x, s.blob.y, BLOB_SCALE, s.blob.faceLeft, s.blob.scared ? MAG_SCARED : MAG, s.blob.alpha);
    }
    if (s.killT >= 0) drawDissolve(blobParts, killPos.x, killPos.y, s.killT, 0.7, 240);
    if (s.hero.vis) {
      const frame = Math.floor(T * 9) % 2;
      drawHeroSprite(heroCv.getContext('2d'), s.hero.swordUp, frame);
      blit(heroCv, s.hero.x, s.hero.y, HERO_SCALE, s.hero.faceLeft, s.hero.power ? MINT : NEON, s.hero.alpha);
    }
    if (s.flash > 0) {                                    // power-up ring
      const p = getPos(PELLET_U);
      ctx.save(); ctx.globalAlpha = 1 - s.flash; ctx.strokeStyle = MINT; ctx.lineWidth = 5;
      ctx.shadowColor = MINT; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10 + s.flash * 90, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (s.celebT >= 0) {                                  // celebration sparkles
      ctx.save(); ctx.fillStyle = MINT; ctx.shadowColor = MINT; ctx.shadowBlur = 12;
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + s.celebT * 3, rr = 30 + s.celebT * 60;
        const tw = 2 + 2 * Math.sin(s.celebT * 10 + i);
        ctx.globalAlpha = Math.max(0, 1 - s.celebT / 1.6);
        ctx.fillRect(killPos.x + Math.cos(a) * rr, killPos.y - 24 + Math.sin(a) * rr, tw, tw);
      }
      ctx.restore();
    }
    if (s.vanishT >= 0) drawDissolve(heroParts, killPos.x, killPos.y, s.vanishT, 1.3, 200);
  }

  let startTs = null;
  function loop(ts) {
    if (startTs == null) startTs = ts;
    const T = ((ts - startTs) / 1000) % LOOP;
    draw(T);
    requestAnimationFrame(loop);
  }
  window.__heroReady = true;
  requestAnimationFrame(loop);
})();
