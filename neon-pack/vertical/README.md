# Vertical Overlays — Green / Neon

Animated **1080 × 1920 (9:16 portrait)** overlays for TikTok, YouTube Shorts,
and vertical streams, in the green-neon theme. All scenes share an animated
topographic background — green contour ribbons that flow and drift continuously.

Open `index.html` in a browser for a live preview gallery of every scene.

## Contents

| File | Type | Use it for |
|---|---|---|
| `starting.html` | Full takeover | "STREAM IS / STARTING" pre-stream screen |
| `pause.html` | Full takeover | "I'LL BE RIGHT BACK / PAUSE" break screen |
| `ending.html` | Full takeover | "STREAM IS / ENDING" outro screen |
| `cam-single.html` | Topo bg + frame | Single full-vertical webcam frame |
| `cams-stacked.html` | Topo bg + frames | Two stacked cam frames (2-cam) |
| `cams-square.html` | Topo bg + frames | Big square + small square (PiP) |
| `hud-cam-top.html` | Transparent HUD | In-game — webcam frame at top |
| `hud-cam-bottom.html` | Transparent HUD | In-game — webcam frame at bottom |
| `hud-cam-chat.html` | Transparent HUD | In-game — top cam + bottom CHAT box |

Shared engine (don't edit per-scene): `vertical.css` (visual tokens, frame /
text styles, entrance animations), `vertical-bg.js` (animated topographic
background canvas + viewport fit).

## Loading into OBS

1. **Sources → + → Browser → Create new → OK**
2. Check **Local file**, browse to the scene HTML.
3. **⚠ Width 1080, Height 1920** — set this in the source properties.
   OBS defaults to 800×600; if you skip this, the scene renders tiny and
   scaling it up on canvas looks blurry. Set the source size to the native
   1080×1920 so it renders pixel-sharp.
4. Check **Use custom frame rate → 60**.
5. Recommended: **Refresh browser when scene becomes active** (replays the
   intro reveal each time you switch to the scene).
6. Recommended: **Shutdown source when not visible** (frees GPU off-scene).

### Layering cam frames in OBS

The cam-frame scenes show **where to place your webcam**. In OBS:

1. Add your **Video Capture Device** (webcam) source to the scene.
2. Add the overlay **Browser Source** ABOVE the webcam in the source list,
   so the glowing frame sits on top.
3. Position / scale the webcam so it fills the area inside the glowing frame.

### Transparency (HUD scenes)

`hud-cam-*.html` have **transparent backgrounds** — drop them on top of your
game capture and only the glowing frames + chat-box border render. The rest
shows through to whatever's below.

## Customization

- **Handle**: each scene has a `<div class="handle">@SEMTEMBZ</div>` — edit
  per scene, or do a project-wide find-and-replace.
- **Text** on takeover scenes is in the `<div class="text-block">` block —
  swap `.kicker`, `.title`, `.subtitle` to taste.
- **Frame positions**: cam-frame scenes use inline `style="left/top/width/height"`
  on each `.frame`. Edit the numbers (all in the 1080×1920 design grid) to
  reshape, move, or add frames.
- **Topo speed / density**: top of `vertical-bg.js` — `RIBBONS` count, `amp1`,
  `freq1`, `speed1` etc. Lower `RIBBONS` for a lighter look, higher `speed1`
  for faster drift.
