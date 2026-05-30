# OBS Browser Source — Setup & Troubleshooting

## Adding a scene as a Browser Source
1. In OBS, **Sources → + → Browser**.
2. Choose **Local file** and browse to your `index.html` (or paste a hosted URL).
   - On Windows a local URL looks like `file:///C:/Users/you/Desktop/twitchscenes/scene/index.html`.
   - To pass config, you must use the **URL** field (not Local file) so you can append a
     query string: `file:///C:/.../index.html?title=Stream%20Starting%20Soon&minutes=10&handle=@you`.
3. Set **Width 1920**, **Height 1080**.
4. Check **Use custom frame rate** and set **60** (or 30 for slow scenes).
5. Optional but recommended:
   - **Shutdown source when not visible** — frees GPU when the scene is hidden.
   - **Refresh browser when scene becomes active** — replays one-shot intro reveals every
     time you switch to the scene.
6. **OK**, then position/scale to fill the canvas.

## Refreshing after edits
CEF caches hard. After you change files, right-click the source → **Refresh** (or **Interact**
and Ctrl+R). If changes still don't show, toggle the source off/on, or re-add it.

## Transparency
- OBS injects `body { background-color: rgba(0,0,0,0); ... }`, so pages are transparent by
  default. For **in-game overlays**, do NOT set an opaque `body`/`html` background and don't
  paint a full-canvas opaque element.
- For **full-screen scenes** (Starting Soon/BRB), an opaque background is correct — paint it
  on a dedicated background element, not by removing the default CSS.
- Use `rgba()`/`transparent` for anything meant to show the layers beneath in OBS.

## Troubleshooting

**Overlay is black / a black box appears**
- You painted an opaque background on an overlay meant to be transparent. Remove the opaque
  `body`/`html`/full-canvas background; let the default transparent CSS through.

**Overlay is laggy / drops stream FPS**
- You're animating layout/paint properties. Animate only `transform` and `opacity`.
- Too many DOM particles → move them to a single `<canvas>`.
- Drop the source to 30 fps; thin the particle count; shrink oversized images to display size.
- Check OBS **Stats** dock for browser render time.

**Animation doesn't replay when I switch scenes**
- Enable **Refresh browser when scene becomes active** on the source. One-shot reveals only
  play on (re)load.

**Countdown is wrong / frozen**
- A `?until=` value must be valid ISO and in the *future*. Frozen usually means it hit 0
  (shows "LIVE NOW") or the tab was throttled — drive it with `requestAnimationFrame`, which
  the template does.

**Fonts look wrong / fall back to a system font**
- You relied on a Google Fonts `<link>` and OBS had no internet (or the CDN was slow).
  Self-host the `.woff2` in `fonts/` with `@font-face`. Confirm the `font-family` name matches.

**Edits don't appear**
- CEF cache. Refresh the source; hard-reload via **Interact** + Ctrl+R; as a last resort
  re-add the source.

**Video background doesn't autoplay**
- Use `<video autoplay muted loop playsinline>`. Browsers (and CEF) block autoplay of
  unmuted video; it must be muted to start on its own.

**It looks right in Chrome but not in OBS**
- Chrome and OBS share the engine, but check: the source size matches 1920×1080, the file
  path/query string is correct, and you refreshed after the last save.

## Performance quick rules
- `transform` + `opacity` only for per-frame animation.
- One `<canvas>` for particle fields.
- `requestAnimationFrame`, never high-frequency `setInterval`.
- `will-change: transform` on moving layers, sparingly.
- Bundle assets locally; size images to display resolution.
