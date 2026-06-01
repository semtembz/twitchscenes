# Red / Gold Overlay Pack

Self-contained streaming graphics in a pixel-Japanese **red + gold + indigo** palette,
matching `starting-soon-japan/`. Drop the folder anywhere and open files in a browser
(or point OBS at them). No internet required.

## Contents

| File | Use it for | Type |
|---|---|---|
| `brb.html` | Be Right Back scene | OBS Browser Source (full screen) |
| `intermission.html` | Intermission / break scene | OBS Browser Source |
| `ending.html` | Stream ending / "thanks for watching" | OBS Browser Source |
| `transition.html` | Blade-slash transition stinger | OBS Browser Source (or record to .webm) |
| `panels.html` | Twitch panel image generator (12 PNGs) | Open in browser, click Download |

Shared engine (don't change): `shared.css` (visual tokens, layout), `shared.js`
(photo, petals, hidden timer, status-flip).

## Loading a screen into OBS

For `brb.html`, `intermission.html`, `ending.html`, or `transition.html`:

1. **Sources → + → Browser → Create new → OK**
2. Check **Local file**, browse to the HTML file
3. **⚠ Width 1920, Height 1080** — this is the most important setting. OBS defaults
   new Browser Sources to **800×600**, which makes the scene render at a smaller
   internal resolution. If you then scale the source bigger on the OBS canvas, OBS
   upscales blurry pixels. **Always set 1920×1080 in the source properties**, then
   the rendered output is already canvas-sized and pixel-sharp.
4. Check **Use custom frame rate → 60**
5. Recommended: **Refresh browser when scene becomes active** (replays the intro reveal
   and resets the timer each time you switch to the scene)
6. Recommended: **Shutdown source when not visible** (frees GPU when off-scene)

## URL knobs (append to the file path in OBS's URL field)

Works on `brb.html`, `intermission.html`, `ending.html`:

```
?seconds=120        hidden timer length (default 60) — BRB/intermission only
&handle=@yourname   handle line shown under the message
&photo=assets/x.jpg use a different photo
```

`transition.html`:

```
?ms=1200            total duration
&loop=1             loop it for preview
```

## Replacing the photo

Drop your image in `assets/intro-photo.jpg` (any size — it auto-crops the tall left
panel). Each scene already references it.

## Twitch panels

1. Open `panels.html` in your browser.
2. Click **Download all** (or per-panel Download links).
3. Twitch: **twitch.tv/&lt;you&gt;/about → Edit Panels → +** and upload each PNG.
   They're sized at the standard 320 × 100 px.

## Transition stinger → .webm (optional)

OBS Stinger transitions need a video file, not a web page. Easiest path:
- Drop `transition.html` as a Browser Source on a brief "transition" scene and just use it
  there, OR
- Use OBS's built-in **Recording** while the page plays once (`?ms=1200`), save the
  result as a `.webm`, then **Settings → Scene Transitions → + → Stinger** and set the
  transition point ~50% of the duration.
