# Prompt Recipes — genre-matched, copy-paste asset sets

Each genre gives ready prompts for the four most-used assets: **background** (looping/tileable),
**mascot** (alpha), **particles** (luma-keyed), and **transition stinger** (video). Swap in the
channel's real brand hexes from the stream-brand-visual-system. Aspect ratio is 16:9 for
scenes; mascots/particles are isolated.

Conventions used below:
- `--ar 16:9` / `--tile` are Midjourney flags; for SDXL/ComfyUI enable **tiling** instead.
- "luma-keyed" = generate bright-on-pure-black, composite with CSS `mix-blend-mode: screen`.
- Always add a negative: `text, watermark, logo, signature, jpeg artifacts, busy clutter`.

---

## Cozy / Cottagecore
- **Background (tileable image):** `soft dawn sky over a quiet meadow, warm peach to sage
  gradient, painterly flat illustration, lots of empty sky, gentle haze, no focal subject —
  palette #e8c9a0 #f4a259 #2b2118 — seamless tileable --ar 16:9 --tile`
- **Mascot (alpha PNG):** `a cute hand-drawn fox holding a tiny lantern, storybook
  illustration, soft outline, front view, isolated on transparent background, full body`
- **Particles (luma):** `floating pollen and dust motes, soft round bokeh, bright warm
  specks on pure black background, no subject`  → screen-blend
- **Stinger (video, 0.8s):** `warm light wipe sweeping left to right, soft paper-grain
  dissolve, gentle, 16:9, seamless` 

## Cyberpunk / Neon
- **Background (loop video):** `dark futuristic city alley, slow forward parallax drift, neon
  cyan and magenta signage glow, light rain, volumetric haze, seamless loop, first frame
  matches last — palette #0a0a12 #b388ff #00e5ff --ar 16:9`
- **Mascot (alpha):** `sleek robot companion mascot, glowing cyan visor, clean vector,
  front view, isolated transparent background`
- **Particles (luma):** `rising digital sparks and floating data glyphs, bright cyan on pure
  black, sparse`  → screen-blend
- **Stinger (video, 0.6s):** `fast glitch RGB-split wipe, scanline flash, hard cut energy,
  16:9`

## Retro / Synthwave
- **Background (tileable/loop):** `synthwave sunset, retro perspective grid scrolling toward
  horizon, large gradient sun with scanlines, chrome reflections, 80s aesthetic, slow
  constant scroll, seamless loop — palette #1b1036 #ff2e97 #00f0ff --ar 16:9 --tile`
- **Mascot (alpha):** `chrome cassette-tape mascot with a smiling face, glossy 80s 3D render,
  isolated transparent background`
- **Particles (luma):** `slow rising neon triangles and star glints, bright pink and cyan on
  pure black`  → screen-blend
- **Stinger (video, 0.7s):** `VHS tracking-glitch wipe with chromatic aberration, retro, 16:9`

## Kawaii / Pastel
- **Background (tileable):** `soft pastel sky with fluffy clouds and tiny sparkles, light pink
  to mint gradient, cute flat illustration, airy, lots of space — palette #ffd6e7 #ff8fab
  #7ce0d3 — seamless tileable --ar 16:9 --tile`
- **Mascot (alpha):** `chubby pastel cat-bunny mascot, big sparkly eyes, rounded chibi style,
  isolated on transparent background, full body`
- **Particles (luma):** `floating hearts, stars and sparkles, bright pastel-white on pure
  black, gentle`  → screen-blend
- **Stinger (video, 0.7s):** `bouncy star-burst wipe, soft sparkle transition, playful, 16:9`

## Minimalist / Clean
- **Background (loop):** `very subtle dark gradient with a single soft moving light gradient
  blob, lots of negative space, elegant, slow drift, seamless loop — palette #0e0e10 #1c1c1f
  #7c5cff --ar 16:9`
- **Mascot:** usually none — a wordmark treatment instead: `minimalist geometric monogram
  logo, single accent color #7c5cff on transparent background, crisp vector`
- **Particles (luma):** `a few faint slow-drifting light dust specks, near-white on pure
  black, very sparse`  → screen-blend
- **Stinger (video, 0.5s):** `clean single-bar swipe wipe, smooth, minimal, 16:9`

## Esports / Aggressive
- **Background (loop):** `dark angular tech arena, diagonal red and yellow energy streaks,
  hex-grid floor, fast aggressive motion streaks, seamless loop — palette #0c0f16 #e63946
  #ffd60a --ar 16:9`
- **Mascot (alpha):** `fierce eagle esports mascot logo, bold angular vector, front view,
  isolated transparent background`
- **Particles (luma):** `fast motion streaks and sparks, bright yellow-red on pure black`
  → screen-blend
- **Stinger (video, 0.5s):** `hard diagonal slash wipe, impact flash, aggressive, 16:9`

---

## Reminders for usable output
- **Backgrounds:** low detail, low contrast, empty center — the title and mascot sit on top.
- **Seamless:** say "seamless loop, first frame matches last" (video) or "seamless tileable,
  edges wrap" (image); enable tiling in SDXL/ComfyUI for true seams.
- **Alpha:** for mascots/logos/frames ask for "isolated on transparent background, PNG"; if a
  tool can't, generate on flat green/white and key it out (GIMP MCP / rembg).
- **Particles:** generate **bright on pure black** and let the animator screen-blend — no
  alpha channel needed and it composites cleanly over any background.
- Quote the **brand hexes** every time so generated art matches the coded overlay.
