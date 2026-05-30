# Genre Style Guide — ready-to-use palettes, type & motion

Lift these as starting points, then customize. Each entry gives a 5-color palette (bg1, bg2,
primary, accent, ink), a font pairing (display / body — all open-license, streaming-safe), and
a one-line motion personality. Hexes are drop-in for `brand-tokens.css`.

## Cozy / Cottagecore
- **Palette:** `#2b2118` `#4a3a2a` `#e8c9a0` `#f4a259` `#fff6e9`
- **Fonts:** Fraunces (display, soft serif) / Nunito Sans (body)
- **Motion:** slow, soft, long loops (12–15s); gentle eases, no snap. Warm and unhurried.
- **Notes:** low saturation, candlelight warmth, dust-mote particles, paper textures.

## Cyberpunk / Neon
- **Palette:** `#0a0a12` `#1a1030` `#b388ff` `#00e5ff` `#f5f3ff`
- **Fonts:** Orbitron or Rajdhani (display) / Inter (body)
- **Motion:** fast, snappy entrances with overshoot; glitch flickers; short loops (5–8s).
- **Notes:** high-saturation cyan/magenta on near-black, glow, scanlines, light leaks.

## Retro / Synthwave
- **Palette:** `#1b1036` `#3a1a5c` `#ff2e97` `#00f0ff` `#ffe1ff`
- **Fonts:** Monoton or Audiowide (display) / Space Grotesk (body)
- **Notes:** sunset gradients, perspective grid, chrome text, VHS grain. Medium-fast motion.

## Kawaii / Pastel
- **Palette:** `#fff0f6` `#ffd6e7` `#ff8fab` `#7ce0d3` `#3a2e3f`
- **Fonts:** Baloo 2 or Fredoka (display, rounded) / Quicksand (body)
- **Motion:** bouncy/elastic eases (back/elastic), playful, medium loops (6–10s).
- **Notes:** light backgrounds, so flip ink to a dark tone; sparkles, hearts, stars.

## Minimalist / Clean
- **Palette:** `#0e0e10` `#1c1c1f` `#e7e7ea` `#7c5cff` `#fafafa`
- **Fonts:** Clash Display or Geist (display) / Geist or Inter (body)
- **Motion:** smooth, restrained, single confident moves; medium loop, lots of negative space.
- **Notes:** type-led, one accent only, generous whitespace, subtle gradient drift.

## Esports / Aggressive
- **Palette:** `#0c0f16` `#16202e` `#e63946` `#ffd60a` `#f1faee`
- **Fonts:** Teko or Saira Condensed (display) / Barlow (body)
- **Motion:** very snappy, hard overshoot, fast wipes/stingers; short loops (4–6s); high energy.
- **Notes:** angular shapes, diagonal cuts, hex grids, motion streaks, strong contrast.

## Vaporwave
- **Palette:** `#2d1b4e` `#46327d` `#ff71ce` `#01cdfe` `#fffb96`
- **Fonts:** Monument Extended or Chillax (display) / Space Mono (body)
- **Notes:** pastel-neon, statues/grids, slow dreamy drift, soft glow.

## Dark Academia / Moody
- **Palette:** `#15110d` `#2a2018` `#b08968` `#c9a227` `#ede0d4`
- **Fonts:** Cormorant Garamond (display, serif) / EB Garamond or Lora (body)
- **Notes:** candlelit, sepia, ink textures, slow cinematic moves, long loops.

---

## How to choose
1. Start from the genre the user names (or the closest entry above).
2. Adjust the **accent** to feel personal — it's the most memorable color.
3. If the background is **light** (kawaii, some minimalist), set `--brand-ink` to a dark tone
   and lighten `--brand-scrim` accordingly so text stays legible.
4. Keep it to **2 fonts**. Confirm licenses allow streaming/broadcast; self-host the files.

## Where to get streaming-safe fonts
Google Fonts (SIL OFL) and Fontshare both offer open licenses suitable for broadcast.
Download the `.woff2` and bundle in the overlay's `fonts/` — don't depend on a live CDN in OBS.
