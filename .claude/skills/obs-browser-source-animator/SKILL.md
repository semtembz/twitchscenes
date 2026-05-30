---
name: obs-browser-source-animator
description: "Builds the actual animated overlay code for an OBS (or Streamlabs) Browser Source — HTML, CSS, and JavaScript that renders a Twitch 'Starting Soon', BRB, intro, or ending scene. Use this skill whenever the user wants to CODE, build, implement, wire up, or debug a browser-source overlay: animated backgrounds, countdown timers, social-handle tickers, particle effects, looping motion, text reveals, Lottie / After-Effects playback, or transparent in-game overlays. Trigger for 'code an animated starting soon overlay', 'build me an OBS browser source', 'make a countdown timer for my stream', 'animate this in HTML/CSS for OBS', 'my overlay is not transparent / is laggy in OBS', 'how do I loop this animation in OBS', or any request to turn an intro-scene design into working browser-source files. Produces ready-to-run index.html / style.css / script.js you point OBS at, plus the exact OBS source settings (size, FPS, transparency, refresh-on-activate, performance)."
---

# OBS Browser Source Animator

You build the overlay itself: a self-contained web page that OBS renders as a layer in a
scene. Your job is to take a Scene Brief (from the twitch-intro-scene-director) plus brand
tokens (from the stream-brand-visual-system) and ship working, performant, OBS-friendly
code.

## How an OBS Browser Source actually works

- OBS embeds **Chromium (CEF)**. A Browser Source is a headless web page rendered to a
  texture at a fixed size and frame rate. It has no address bar, no scrollbars, no clicks
  (unless you enable interaction).
- You give it either a **URL** (hosted) or a **Local file** (a path to `index.html`).
- It renders at the **Width × Height** you set (use **1920×1080**) and a frame rate you set.
- It injects default **Custom CSS** that makes the page background transparent:
  ```css
  body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }
  ```
  That is why overlays are transparent by default — *don't* paint an opaque `body`
  background unless the scene is meant to be full-screen (Starting Soon / BRB usually are;
  in-game overlays must stay transparent).

### Source settings you should always specify to the user
- **Width / Height:** 1920 / 1080.
- **Use custom frame rate → 60** (or 30 for slow ambient scenes to save GPU).
- **Shutdown source when not visible:** ON saves GPU when the scene isn't showing.
- **Refresh browser when scene becomes active:** ON makes a one-shot **intro reveal replay
  every time you switch to the scene** — essential for "Intro/Welcome" stings.
- **Custom CSS:** leave the default unless you need to tweak it.
- After editing files, click **Refresh** on the source (CEF caches aggressively).

## Project structure

Keep every scene self-contained and **offline-capable** — OBS may not have reliable
internet, and a CDN that fails to load means a blank overlay on stream. Bundle everything.

```
scene-name/
├── index.html        # structure
├── style.css         # brand tokens + animation keyframes
├── script.js         # countdown, particles, config
├── fonts/            # self-hosted @font-face files (don't rely on Google Fonts CDN)
└── assets/           # generated backgrounds, mascot, particle PNGs, Lottie JSON
```

A complete, runnable **Starting Soon** scene ships with this skill at
`assets/starting-soon-template/`. **Read those three files and adapt them** rather than
writing a new scene from scratch — they already implement a transparent-safe layout, an
animated gradient, a Canvas particle field, a configurable countdown, brand-token CSS
variables, and a staggered reveal. Copy the folder, swap the tokens and text, and you have
a working overlay.

## Performance rules (CEF is not your gaming GPU's friend)

A laggy overlay drops the whole stream's frame rate. Animate cheaply:

- **Only animate `transform` and `opacity`.** These are GPU-composited and don't trigger
  layout/paint. Animating `top`, `left`, `width`, `box-shadow`, or `filter` per-frame will
  stutter.
- Promote moving layers with `will-change: transform, opacity;` (sparingly).
- Prefer **CSS keyframes** for predictable looping motion; use **`requestAnimationFrame`**
  for anything driven by JS (particles, countdown ticks). Never animate with `setInterval`
  at high frequency.
- For lots of particles, draw them on a single **`<canvas>`** — one element, not hundreds of
  DOM nodes.
- Keep total moving elements modest. Test the OBS **Stats** dock; if render time climbs,
  drop the frame rate to 30 or thin out particles.
- Don't ship uncompressed 4K PNGs for a 1080p canvas. Size assets to display size.

## Countdown timer (the most-requested feature)

Two modes — support both via query params:
- **Duration:** count down N minutes from when the scene loads (`?minutes=10`).
- **Target time:** count down to a wall-clock time (`?until=2026-05-30T18:00:00`).

Core logic (already implemented in the template's `script.js`):

```js
const params = new URLSearchParams(location.search);
const el = document.querySelector('#countdown');

// Pick a target: explicit time wins, else now + minutes.
const target = params.get('until')
  ? new Date(params.get('until')).getTime()
  : Date.now() + (Number(params.get('minutes')) || 10) * 60_000;

function tick() {
  const remaining = Math.max(0, target - Date.now());
  const m = String(Math.floor(remaining / 60_000)).padStart(2, '0');
  const s = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0');
  el.textContent = remaining > 0 ? `${m}:${s}` : "LIVE NOW";
  requestAnimationFrame(tick);   // self-correcting, smooth
}
tick();
```

## Make scenes configurable without editing code

Read settings from the URL query string so the user can reuse one overlay with different
text. OBS lets you append `?title=...&handle=@you&minutes=15&accent=%2300ffa3` to the file
URL. The template demonstrates `title`, `subtitle`, `handle`, `minutes`/`until`, and
`accent`. This is how you turn a one-off into a reusable tool.

## Animation toolbox (pick the lightest thing that works)

- **Pure CSS keyframes / transitions** — best default. Gradients, idle bobs, glows, text
  reveals, infinite drifts. Zero dependencies, GPU-friendly.
- **Canvas 2D** — particle fields, confetti, starfields, noise. One canvas, rAF loop.
- **Lottie** (`lottie-web`) — play designer-made After Effects animations from JSON. Great
  for logo stings and mascots. Bundle the lib + JSON locally.
- **GSAP / anime.js** — only when you need complex timeline choreography that CSS makes
  painful. Bundle locally; don't pull from a CDN at stream time.
- **WebGL / three.js** — reserve for genuinely 3D or shader-heavy scenes; heaviest option.

Default to CSS + a Canvas particle layer. That combination covers the vast majority of
Starting Soon / BRB / intro scenes and stays smooth.

## Seamless looping

A loop that visibly "jumps" looks broken. Techniques:
- **Continuous transforms:** infinite rotation, constant-velocity drift, or
  `animation-direction: alternate` ping-pong — no perceptible restart.
- **Match first and last keyframe** exactly for any non-continuous loop.
- For particles, recycle them off one edge to the other rather than resetting all at once.
- For background video loops, the generated clip must be authored to loop (see the
  prompt-pack skill) and play with `<video loop muted autoplay playsinline>`.

## Fonts

Self-host with `@font-face` pointing at files in `fonts/`. Google Fonts via `<link>` works
*only if OBS has internet and the CDN responds* — a flaky dependency for something on
stream. Download the `.woff2` and bundle it. Respect license terms for streaming use.

## Testing workflow

1. **Open `index.html` in Chrome first.** It renders the same engine as OBS. Iterate here —
   it's far faster than round-tripping through OBS. Use DevTools, set the window to 1920×1080.
2. Add `?title=...&minutes=1` to dry-run the countdown quickly.
3. In OBS: add a **Browser Source → Local file → index.html**, set 1920×1080, custom FPS 60.
4. Hit **Refresh**. For one-shot intros, toggle the scene to confirm the reveal replays
   (with "Refresh when active" on).
5. Watch OBS **Stats** for render-time spikes.

For OBS setup details, transparency gotchas, caching, and a troubleshooting checklist
("my overlay is black / laggy / not updating / fonts missing"), read
`references/obs-setup-and-troubleshooting.md`.

## Handing off / pulling in

- Pull **brand tokens** from the stream-brand-visual-system into `style.css` `:root` so the
  scene matches the channel. The template's variables are named to line up with
  `brand-tokens.css`.
- Pull **art/loops** from the animated-intro-prompt-pack-generator into `assets/`.
- If the user hasn't defined the scene yet, suggest starting with the
  twitch-intro-scene-director to get a brief first — building blind leads to rework.
