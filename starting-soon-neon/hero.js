/* =========================================================================
   Neon hero vs. blob — rectangular Pac-Man chase, RIGHT of the seam only,
   routed around (never over) the message text.

   Beats (~25s loop, ~50% slower than before):
     intro -> chase one lap eating dots -> eat BIG pellet -> power up ->
     turn & chase the blob -> kill (sword swing + pixel pop) -> flourish ->
     slash a portal -> jump through -> portal zips shut -> gap (dots fade
     back in) -> loop.

   Self-contained on <canvas id="hero">. Exposes window.heroStateAt(T).
   ========================================================================= */
(() => {
  const cv = document.getElementById('hero');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = 1920, H = 1080;

  /* ---- palette ---- */
  const NEON = '#2fe08c', MINT = '#79ffc4', BLADE = '#dffff4', PWR = '#aaffe6';
  const MAG = '#ff3df0', MAG_SCARED = '#bfe9ff';
  const SKIN = '#e6bd9a', HAIR = '#19110b', CAPE = '#0b2c1f', OUTFIT = '#0e3325', DOT = '#cfeede';

  /* ---- rectangular path (right of the seam, around the text) ---- */
  const LX = 940, RX = 1560, TY = 170, BY = 770;          // snug box wrapping the text (right pulled in, bottom up) — traced to the red box
  const Wd = RX - LX, Ht = BY - TY, PER = 2 * (Wd + Ht);
  const CENTERX = (LX + RX) / 2;
  const norm = (u) => ((u % 1) + 1) % 1;
  // u=0 at bottom-left, counter-clockwise: up left edge, across top, down right, along bottom
  function getPos(u) {
    let d = norm(u) * PER;
    if (d < Ht) return { x: LX, y: BY - d };                       // left edge (up)
    d -= Ht; if (d < Wd) return { x: LX + d, y: TY };              // top edge (right)
    d -= Wd; if (d < Ht) return { x: RX, y: TY + d };              // right edge (down)
    d -= Ht; return { x: RX - d, y: BY };                          // bottom edge (left)
  }
  function faceLeft(u, dir) {
    const a = getPos(u), b = getPos(u + 0.012 * dir);
    const dx = b.x - a.x;
    if (Math.abs(dx) > 0.5) return dx < 0;
    return a.x < CENTERX;                                           // vertical: face outward — left edge faces away from the writing on its right
  }

  /* ---- chase / dots config ---- */
  const GAP = 0.12, P_BIG = 0.98, MEET = 0.64;   // start bottom-left; after power-up the blob bolts right-then-up, caught on the right edge
  const meetPos = getPos(MEET);
  const PORTAL_X = meetPos.x, PORTAL_W = 92, PORTAL_H = 250;  // tall vertical rift at the kill spot (right edge, clear of the text)
  const PORTAL_Y = meetPos.y;
  const dots = [];
  for (let p = 0.02; p < P_BIG - 0.01; p += 0.0258) dots.push({ p, pos: getPos(p) });
  const pelletPos = getPos(P_BIG);

  /* ---- timeline (seconds) ---- */
  const T_INTRO = 1.0, T_CHASE = 10.5, T_POWER = 11.7, T_REVERSE = 16.7,
        T_KILL = 18.3, T_CELEB = 19.9, T_PCUT = 22.2, T_JUMP = 23.2, T_ZIP = 24.5, LOOP = 26.2;
  const chaseHu = (T) => ((T - T_INTRO) / (T_CHASE - T_INTRO)) * P_BIG;

  /* =====================================================================
     Sprites
     ===================================================================== */
  const HX = 24, HY = 34, HS = 2.3;        // hero sprite grid + scale
  const BX = 16, BY2 = 16, BSC = 2.4;      // blob

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // tougher hero: cape, armor, glowing eyes, curly hair (no sword — drawn full-res)
  function drawHeroBody(g, frame) {
    g.clearRect(0, 0, HX, HY);
    // cape (behind, back/left side, flared)
    g.fillStyle = CAPE;
    g.beginPath(); g.moveTo(10, 11); g.lineTo(6, 12); g.lineTo(2, 30); g.lineTo(9, 27); g.lineTo(11, 14); g.closePath(); g.fill();
    g.fillStyle = NEON; g.fillRect(2, 28, 3, 1);                    // cape neon hem
    // legs (armored, tough stance, 2-frame)
    g.fillStyle = '#07140d';
    if (frame === 0) { g.fillRect(9, 27, 4, 7); g.fillRect(15, 28, 4, 6); }
    else { g.fillRect(9, 28, 4, 6); g.fillRect(15, 27, 4, 7); }
    g.fillStyle = NEON; g.fillRect(9, 33, 4, 1); g.fillRect(15, 33, 4, 1);
    // torso (armor + neon trim + emblem)
    g.fillStyle = OUTFIT; g.fillRect(8, 15, 11, 12);
    g.fillStyle = NEON; g.fillRect(8, 15, 11, 1); g.fillRect(12, 19, 3, 3);  // shoulder line + chest emblem
    g.fillStyle = MINT; g.fillRect(11, 14, 4, 1);                  // chain
    // back arm
    g.fillStyle = OUTFIT; g.fillRect(7, 16, 2, 7);
    // head + face
    g.fillStyle = SKIN; g.fillRect(9, 7, 8, 7);
    // curly hair (bumpy mass + side curls)
    g.fillStyle = HAIR;
    g.fillRect(8, 4, 10, 4);
    g.fillRect(7, 5, 1, 3); g.fillRect(17, 5, 1, 3);
    g.fillRect(9, 3, 2, 1); g.fillRect(13, 3, 2, 1); g.fillRect(11, 2, 2, 1);
    g.fillRect(8, 7, 1, 2); g.fillRect(16, 7, 1, 2);
    g.fillStyle = HAIR; g.fillRect(9, 8, 8, 1);                    // strong brow
    // glowing eyes
    g.fillStyle = NEON; g.fillRect(10, 9, 2, 1); g.fillRect(14, 9, 2, 1);
    // front (sword) arm — raised forward
    g.fillStyle = SKIN; g.fillRect(16, 14, 3, 3); g.fillRect(18, 12, 2, 3);
  }

  function drawBlob(g, scared) {
    g.clearRect(0, 0, BX, BY2);
    g.fillStyle = scared ? MAG_SCARED : MAG;
    g.beginPath(); g.arc(8, 7, 6, Math.PI, 0); g.lineTo(14, 14);
    g.lineTo(12, 12); g.lineTo(10, 14); g.lineTo(8, 12); g.lineTo(6, 14); g.lineTo(4, 12); g.lineTo(2, 14);
    g.lineTo(2, 7); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.fillRect(5, 6, 3, 3); g.fillRect(9, 6, 3, 3);
    g.fillStyle = scared ? '#1530ff' : '#33002e'; g.fillRect(6, 7, 1, 2); g.fillRect(10, 7, 1, 2);
  }

  const heroCv = mk(HX, HY), blobCv = mk(BX, BY2), blobStill = mk(BX, BY2);
  drawBlob(blobStill.getContext('2d'), false);

  function buildParticles(still, scale) {
    const w = still.width, h = still.height, data = still.getContext('2d').getImageData(0, 0, w, h).data, parts = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (data[i + 3] < 40) continue;
      parts.push({ ox: (x - w / 2) * scale, oy: (y - h / 2) * scale, vx: (Math.random() * 2 - 1) * 80, vy: -(0.2 + Math.random()) * 130, color: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`, size: scale });
    }
    return parts;
  }
  const blobParts = buildParticles(blobStill, BSC);
  // colorful firework burst for the blob death
  const FW_COLORS = ['#ff3df0', '#2fe08c', '#79ffc4', '#ffd84a', '#ffffff', '#00e5ff'];
  const fireworkParts = Array.from({ length: 64 }, function (_, i) {
    const a = Math.random() * Math.PI * 2, sp = 130 + Math.random() * 290;
    return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70, color: FW_COLORS[i % FW_COLORS.length], size: 3 + (i % 3) };
  });

  /* ---- blitting + the full-res energy sword ---- */
  function blit(src, cx, cy, scale, faceL, glow, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = glow; ctx.shadowBlur = 14; ctx.translate(cx, cy);
    if (faceL) ctx.scale(-1, 1);
    const w = src.width * scale, h = src.height * scale;
    ctx.drawImage(src, -w / 2, -h / 2, w, h); ctx.restore();
  }

  function drawSword(hx, hy, faceL, ang, powered, T) {
    const L = 50, dir = faceL ? -1 : 1;
    ctx.save();
    ctx.translate(hx, hy); ctx.scale(dir, 1); ctx.rotate(ang);
    // powered: a glowing energy aura that hugs the blade shape (drawn behind it)
    if (powered) {
      const pulse = 0.5 + 0.5 * Math.sin(T * 8);
      ctx.save();
      ctx.shadowColor = PWR; ctx.shadowBlur = 24 + pulse * 16;
      ctx.globalAlpha = 0.40 + 0.25 * pulse; ctx.fillStyle = MINT;
      ctx.beginPath(); ctx.moveTo(-5, -1); ctx.lineTo(5, -1); ctx.lineTo(3, -L * 0.84); ctx.lineTo(0, -L - 5); ctx.lineTo(-3, -L * 0.84); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // grip
    ctx.fillStyle = '#10241b'; ctx.fillRect(-2, 0, 4, 9);
    // guard
    ctx.fillStyle = NEON; ctx.shadowColor = NEON; ctx.shadowBlur = 10; ctx.fillRect(-8, -2, 16, 4);
    // blade (tapered energy)
    ctx.shadowColor = powered ? PWR : NEON; ctx.shadowBlur = powered ? 26 : 16;
    ctx.fillStyle = BLADE;
    ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(3, -2); ctx.lineTo(2, -L * 0.82); ctx.lineTo(0, -L); ctx.lineTo(-2, -L * 0.82); ctx.closePath(); ctx.fill();
    // core highlight
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = .85; ctx.fillRect(-1, -L * 0.8, 2, L * 0.72); ctx.globalAlpha = 1;
    // power-up: rising energy motes flowing up the blade (cooler than jagged lines)
    if (powered) {
      ctx.fillStyle = '#eafff5'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 9;
      for (let i = 0; i < 3; i++) {
        const t = (T * 0.9 + i / 3) % 1;
        const yy = -8 - t * (L - 12), xx = Math.sin(T * 6 + i * 2) * 2;
        ctx.globalAlpha = 1 - t; ctx.fillRect(xx - 1.25, yy - 1.25, 2.5, 2.5);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawSlashArc(hx, hy, faceL, a0, a1, alpha) {
    const dir = faceL ? -1 : 1;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(hx, hy); ctx.scale(dir, 1);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.shadowColor = MINT; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(0, 0, 46, a0 - Math.PI / 2, a1 - Math.PI / 2); ctx.stroke();
    ctx.restore();
  }

  function drawPortal(cx, cy, w, h, T) {
    if (w < 2) return;
    const rw = Math.max(1, w / 2), rh = h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    // chromatic "torn reality" rims (offset cyan + mint) with a wide neon haze
    ctx.shadowColor = NEON; ctx.shadowBlur = 45; ctx.lineWidth = 4; ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#00ffc0'; ctx.beginPath(); ctx.ellipse(-4, 0, rw, rh, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#b6fff0'; ctx.beginPath(); ctx.ellipse(4, 0, rw, rh, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    // dark void
    ctx.fillStyle = 'rgba(2,12,9,0.94)';
    ctx.beginPath(); ctx.ellipse(0, 0, rw * 0.9, rh * 0.95, 0, 0, Math.PI * 2); ctx.fill();
    // swirling energy (clipped to the void), rotating with time
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, rw * 0.9, rh * 0.95, 0, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = MINT; ctx.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      const f = (k + 1) / 6, rot = T * 1.8 + k * 0.7;
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(T * 4 + k);
      ctx.beginPath();
      ctx.ellipse(Math.cos(rot) * rw * 0.12, Math.sin(rot) * rh * 0.12, rw * f, rh * f * 0.82, rot, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    // bright vertical core slit
    ctx.globalAlpha = 0.95; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 22; ctx.fillStyle = '#eafff5';
    ctx.beginPath(); ctx.ellipse(0, 0, Math.max(1, rw * 0.14), rh * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    // crisp white rim
    ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.shadowColor = MINT; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function dotAlpha(T, p) {
    if (T >= T_ZIP) return (T - T_ZIP) / (LOOP - T_ZIP);            // gap fade back in
    if (T <= T_INTRO) return 1;
    if (T < T_CHASE) return chaseHu(T) >= p ? 0 : 1;               // eaten once passed
    return 0;
  }

  /* =====================================================================
     State machine (pure fn of loop time) — exposed for verification
     ===================================================================== */
  function computeState(T) {
    const s = {
      phase: 'gap',
      hero: { x: 0, y: 0, vis: false, faceLeft: false, ang: 0.5, powered: false, scale: 1, alpha: 1, swing: 0 },
      blob: { x: 0, y: 0, vis: false, scared: false, faceLeft: false, alpha: 1 },
      pelletVis: false, flash: 0, killT: -1, celebT: -1, sliceT: -1,
      portal: 0, portalT: 0,
    };
    if (T < T_INTRO) {
      s.phase = 'intro';
      const a = T / T_INTRO, hp = getPos(0), bp = getPos(-GAP);
      Object.assign(s.hero, { x: hp.x, y: hp.y, vis: true, alpha: a, faceLeft: faceLeft(0, 1) });
      Object.assign(s.blob, { x: bp.x, y: bp.y, vis: true, alpha: a });
    } else if (T < T_CHASE) {
      s.phase = 'chase';
      const hu = chaseHu(T), bu = hu - GAP, hp = getPos(hu), bp = getPos(bu);
      Object.assign(s.hero, { x: hp.x, y: hp.y, vis: true, faceLeft: faceLeft(hu, 1), ang: 0.55 });
      Object.assign(s.blob, { x: bp.x, y: bp.y, vis: true, faceLeft: faceLeft(bu, 1) });
      s.pelletVis = true;
    } else if (T < T_POWER) {
      s.phase = 'power';
      const hp = getPos(P_BIG), bp = getPos(P_BIG - GAP);
      Object.assign(s.hero, { x: hp.x, y: hp.y, vis: true, powered: true, ang: -0.1 });
      Object.assign(s.blob, { x: bp.x, y: bp.y, vis: true, scared: true });
      s.flash = (T - T_CHASE) / (T_POWER - T_CHASE);
    } else if (T < T_REVERSE) {
      s.phase = 'reverse';
      const rt = (T - T_POWER) / (T_REVERSE - T_POWER);
      const hu = P_BIG + (MEET - P_BIG) * (rt * rt);                                   // hero accelerates and closes the gap late
      const bu = (P_BIG - GAP) + (MEET - (P_BIG - GAP)) * (1 - (1 - rt) * (1 - rt));   // blob bolts away FAST early (ease-out)
      const hp = getPos(hu), bp = getPos(bu);
      Object.assign(s.hero, { x: hp.x, y: hp.y, vis: true, powered: true, faceLeft: faceLeft(hu, -1), ang: 0.2 });
      Object.assign(s.blob, { x: bp.x, y: bp.y, vis: true, scared: true, faceLeft: faceLeft(bu, -1) });
    } else if (T < T_KILL) {
      s.phase = 'kill';
      // no sword slice on the blob — it just bursts into pixels (killT)
      Object.assign(s.hero, { x: meetPos.x, y: meetPos.y, vis: true, powered: true, faceLeft: false, ang: 0.35 });
      s.killT = T - T_REVERSE;
    } else if (T < T_CELEB) {
      s.phase = 'celebrate';
      const ct = T - T_KILL;
      Object.assign(s.hero, { x: meetPos.x, y: meetPos.y - Math.abs(Math.sin(ct * 7)) * 14, vis: true, powered: true, faceLeft: false, ang: -0.15 });
      s.celebT = ct;
    } else if (T < T_PCUT) {
      s.phase = 'portalCut';
      const ct = (T - T_CELEB) / (T_PCUT - T_CELEB);
      let ang;                                                       // windup -> FAST slash -> recover
      if (ct < 0.40) ang = -0.3 - 1.4 * (ct / 0.40);                 // raise the blade up/back
      else if (ct < 0.52) ang = -1.7 + 3.1 * ((ct - 0.40) / 0.12);   // whip it down through the cut
      else ang = 1.4 - 1.2 * ((ct - 0.52) / 0.48);                   // recover
      Object.assign(s.hero, { x: meetPos.x, y: meetPos.y, vis: true, powered: true, faceLeft: false, ang });
      s.sliceT = ct;                                                 // drives the epic slash visual
      const pp = Math.max(0, (ct - 0.52) / 0.48);                    // the rift tears open AFTER the slash lands
      s.portal = pp >= 1 ? 1 : 1 + 2.70158 * Math.pow(pp - 1, 3) + 1.70158 * Math.pow(pp - 1, 2);  // SNAP open (ease-out-back)
      s.portalT = T;
    } else if (T < T_JUMP) {
      s.phase = 'jump';
      const jt = (T - T_PCUT) / (T_JUMP - T_PCUT);
      Object.assign(s.hero, { x: meetPos.x + (PORTAL_X - meetPos.x) * jt, y: meetPos.y, vis: true, powered: true, faceLeft: false, ang: 0.3, scale: 1 - jt * 0.85, alpha: 1 - jt });
      s.portal = 1; s.portalT = T;
    } else if (T < T_ZIP) {
      s.phase = 'zip';
      s.portal = 1 - (T - T_JUMP) / (T_ZIP - T_JUMP); s.portalT = T;
    }
    return s;
  }
  window.heroStateAt = computeState;

  /* ---- render ---- */
  function draw(T) {
    ctx.clearRect(0, 0, W, H);
    const s = computeState(T);

    // dots
    for (const d of dots) {
      const a = dotAlpha(T, d.p); if (a <= 0.02) continue;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = DOT; ctx.shadowColor = MINT; ctx.shadowBlur = 6;
      ctx.fillRect(d.pos.x - 2, d.pos.y - 2, 4, 4); ctx.restore();
    }
    if (s.pelletVis) {
      const r = 9 + 2.5 * Math.sin(T * 7);
      ctx.save(); ctx.shadowColor = MINT; ctx.shadowBlur = 22; ctx.fillStyle = '#eafff5';
      ctx.beginPath(); ctx.arc(pelletPos.x, pelletPos.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    if (s.blob.vis) { drawBlob(blobCv.getContext('2d'), s.blob.scared); blit(blobCv, s.blob.x, s.blob.y, BSC, s.blob.faceLeft, s.blob.scared ? MAG_SCARED : MAG, s.blob.alpha); }
    if (s.killT >= 0) {
      const kt = s.killT;
      // bright burst flash at the moment of death
      if (kt < 0.28) {
        const bf = 1 - kt / 0.28; ctx.save(); ctx.globalAlpha = bf;
        const g = ctx.createRadialGradient(meetPos.x, meetPos.y, 0, meetPos.x, meetPos.y, 240);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, 'rgba(255,61,240,0.45)'); g.addColorStop(1, 'rgba(255,61,240,0)');
        ctx.fillStyle = g; ctx.fillRect(meetPos.x - 240, meetPos.y - 240, 480, 480); ctx.restore();
      }
      // bigger, colorful firework burst
      const a = Math.max(0, 1 - kt / 1.4);
      if (a > 0) {
        ctx.save();
        for (const p of fireworkParts) {
          const x = meetPos.x + p.vx * kt, y = meetPos.y + p.vy * kt + 190 * kt * kt;
          ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 9;
          ctx.fillRect(x, y, p.size, p.size);
        }
        ctx.restore();
      }
    }

    // portal behind hero during cut/jump, in front during zip
    if (s.portal > 0 && s.phase !== 'zip') drawPortal(PORTAL_X, PORTAL_Y, s.portal * PORTAL_W, PORTAL_H, s.portalT);
    if (s.phase === 'portalCut' && s.portal > 0.03 && s.portal < 1) {   // shockwave bursting out as it tears open
      const op = s.portal; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - op) * 0.85;
      ctx.strokeStyle = MINT; ctx.lineWidth = 4; ctx.shadowColor = NEON; ctx.shadowBlur = 26;
      ctx.beginPath(); ctx.ellipse(PORTAL_X, PORTAL_Y, 36 + op * 250, 48 + op * 320, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    if (s.hero.vis) {
      const frame = Math.floor(T * 7) % 2;
      drawHeroBody(heroCv.getContext('2d'), frame);
      blit(heroCv, s.hero.x, s.hero.y, HS * s.hero.scale, s.hero.faceLeft, s.hero.powered ? PWR : NEON, s.hero.alpha);
      // sword at the front hand
      const dir = s.hero.faceLeft ? -1 : 1;
      const hx = s.hero.x + dir * 15 * s.hero.scale, hy = s.hero.y - 6 * s.hero.scale;
      ctx.save(); ctx.globalAlpha = s.hero.alpha;
      drawSword(hx, hy, s.hero.faceLeft, s.hero.ang, s.hero.powered, T);
      ctx.restore();
    }

    // ---- EPIC portal slice: impact flash, blazing vertical cut-streak, sparks ----
    if (s.sliceT >= 0) {
      const ct = s.sliceT;
      if (ct > 0.40 && ct < 0.66) {                                   // radial impact flash, peaks at the slash
        const f = Math.max(0, 1 - Math.abs(ct - 0.52) / 0.13);
        ctx.save(); ctx.globalAlpha = f;
        const g = ctx.createRadialGradient(PORTAL_X, PORTAL_Y, 0, PORTAL_X, PORTAL_Y, 380);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(120,255,200,0.5)'); g.addColorStop(1, 'rgba(47,224,140,0)');
        ctx.fillStyle = g; ctx.fillRect(PORTAL_X - 380, PORTAL_Y - 380, 760, 760); ctx.restore();
      }
      if (ct > 0.46 && ct < 0.95) {                                   // blazing vertical cut-streak
        const life = (ct - 0.46) / 0.49, grow = Math.min(1, life / 0.25);
        const halfLen = 40 + grow * 260, fade = Math.max(0, 1 - Math.max(0, life - 0.25) / 0.75);
        ctx.save(); ctx.translate(PORTAL_X, PORTAL_Y); ctx.globalAlpha = fade;
        ctx.fillStyle = MINT; ctx.shadowColor = MINT; ctx.shadowBlur = 38; ctx.fillRect(-8, -halfLen, 16, halfLen * 2);
        ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 18; ctx.fillRect(-2.5, -halfLen, 5, halfLen * 2);
        ctx.restore();
      }
      if (ct > 0.46 && ct < 0.98) {                                   // sparks flung off the cut
        const life = (ct - 0.46) / 0.52;
        ctx.save(); ctx.fillStyle = '#dffff4'; ctx.shadowColor = MINT; ctx.shadowBlur = 12; ctx.globalAlpha = Math.max(0, 1 - life);
        for (let i = 0; i < 14; i++) { const sa = (i / 14) * Math.PI * 2 + 0.4, sd = life * (90 + (i % 4) * 60); ctx.fillRect(PORTAL_X + Math.cos(sa) * sd, PORTAL_Y + Math.sin(sa) * sd * 1.4, 3, 3); }
        ctx.restore();
      }
    }

    if (s.phase === 'zip') {
      drawPortal(PORTAL_X, PORTAL_Y, s.portal * PORTAL_W, PORTAL_H, s.portalT);
      if (s.portal < 0.25) { ctx.save(); ctx.globalAlpha = s.portal / 0.25; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.shadowColor = MINT; ctx.shadowBlur = 26; ctx.beginPath(); ctx.moveTo(PORTAL_X, PORTAL_Y - 90); ctx.lineTo(PORTAL_X, PORTAL_Y + 90); ctx.stroke(); ctx.restore(); }
    }
    if (s.flash > 0) { ctx.save(); ctx.globalAlpha = 1 - s.flash; ctx.strokeStyle = MINT; ctx.lineWidth = 5; ctx.shadowColor = MINT; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(pelletPos.x, pelletPos.y, 10 + s.flash * 80, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if (s.celebT >= 0) { ctx.save(); ctx.fillStyle = MINT; ctx.shadowColor = MINT; ctx.shadowBlur = 12; ctx.globalAlpha = Math.max(0, 1 - s.celebT / 1.6); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + s.celebT * 2.5, rr = 26 + s.celebT * 55, tw = 2 + 2 * Math.sin(s.celebT * 9 + i); ctx.fillRect(meetPos.x + Math.cos(a) * rr, meetPos.y - 24 + Math.sin(a) * rr, tw, tw); } ctx.restore(); }
  }

  let startTs = null;
  function loop(ts) { if (startTs == null) startTs = ts; draw(((ts - startTs) / 1000) % LOOP); requestAnimationFrame(loop); }
  window.__heroReady = true;
  requestAnimationFrame(loop);
})();
