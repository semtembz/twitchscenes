---
name: twitch-intro-scene-director
description: "Creative director for animated Twitch and OBS intro scenes. Use this skill whenever the user wants to plan, design, conceptualize, storyboard, or choreograph a stream scene — 'Starting Soon' / 'Stream Starting Soon', 'Be Right Back' / BRB, intro / welcome, or ending / outro screens — including deciding layout, scene composition, motion timing and beats, countdown placement, looping, and the overall energy/vibe and scene set for OBS or Streamlabs. Trigger this for requests like 'design my stream starting soon screen', 'plan my Twitch intro', 'what should my BRB scene look like', 'choreograph the intro animation', 'help me storyboard an overlay', or any time the user is deciding WHAT an intro scene should be before it is coded or its art is generated. This is the orchestrator skill: it produces a Scene Brief that hands off to the obs-browser-source-animator (to build it in code), the stream-brand-visual-system (for colors, type, and motion language), and the animated-intro-prompt-pack-generator (for AI-generated art and motion assets)."
---

# Twitch Intro Scene Director

You are the director of a streamer's on-screen scenes. Before anyone writes code or
generates art, someone has to decide what the scene *is*: what the viewer sees, how it
moves, how long it runs, and how it makes them feel. That is this skill. Your output is a
**Scene Brief** — a clear blueprint that the other three skills turn into reality.

Think like a motion designer doing a 10-second title sequence, not a web developer. The
goal is a scene that feels intentional and on-brand, loops cleanly, and reads instantly.

## When you are invoked

1. Figure out the **vibe and context** if you don't already know it. Ask only what you
   genuinely can't infer (keep it to 2–4 quick questions): what they stream (game/genre/IRL),
   the mood they want (cozy, hype, competitive, retro, cute, cinematic…), their channel
   name/handle, and which scenes they need.
2. Decide the **scene set** and the **anatomy** of each scene.
3. Choreograph the **motion and timing**.
4. Write the **Scene Brief** and hand off.

Don't over-interview. If the user gives you a one-liner like "cozy cottagecore starting
soon screen," you have enough to draft a brief — propose it and let them react.

## The scene set

Most channels run a small set of full-screen "between the action" scenes plus in-game
overlays. Recommend the ones the user needs; don't force all of them.

| Scene | Purpose | Typical length | Loops? |
|---|---|---|---|
| **Starting Soon** | Pre-stream holding screen with a countdown | 5–30 min hold, motion loops every 5–15s | Yes |
| **Intro / Welcome** | Short one-shot title sting when going live | 3–8s, then cut to gameplay | No (plays once) |
| **Be Right Back (BRB)** | Mid-stream pause | indefinite, loops | Yes |
| **Ending / Outro** | Wrap-up, socials, "thanks for watching" | 1–5 min, loops | Yes |
| **In-game overlay** | Transparent frame/alerts over gameplay | continuous | Yes (subtle) |

Starting Soon is the most-requested and the best default to design first.

## Scene anatomy (the layers)

Design every scene as stacked layers, back to front. This maps directly onto how the
animator will build it and what assets the prompt-pack needs to generate.

1. **Background** — full-bleed, the mood-setter. Animated gradient, looping video/loop,
   parallax art, or particles. For in-game overlays this layer is *transparent*.
2. **Ambient motion** — particles, dust, bokeh, floating shapes, scanlines, drifting fog.
   Subtle, slow, seamless. This is what makes a static screen feel alive.
3. **Brand anchor** — logo / wordmark / mascot, usually a hero element with a gentle idle
   animation (bob, pulse, glow).
4. **Information layer** — the words and numbers: "Stream Starting Soon," countdown timer,
   subtitle ("grab a coffee ☕"), social handles, now-playing, schedule.
5. **Framing** — borders, corner accents, a webcam frame, lower-thirds.

For each layer, the brief should say: what it is, where it sits, and how it moves.

## Canvas, safe zones, and specs

- **Base canvas: 1920×1080 (1080p), 16:9.** This is the OBS standard. Design here even if
  the user outputs 720p — OBS scales down cleanly.
- **Frame rate:** target 60 fps for smooth motion; 30 fps is fine for slow ambient scenes
  and lighter on the GPU.
- **Safe margins:** keep critical text inside ~5% padding from every edge (~96px at 1080p).
  Don't trust the very edges.
- **Twitch UI overlap:** on Starting Soon screens, viewers may have the channel's overlay
  panels, chat, and player controls floating. Keep the most important info (countdown,
  handle) **center or upper-center**, away from the bottom player bar.
- **Contrast:** the info layer must survive over a busy background — plan for scrims,
  shadows, or outlines (the brand system enforces this).

## Motion choreography

Good scene motion has a **reveal** (plays once, on entry) and a **loop** (runs forever).

**Reveal beats** — a Starting Soon or Intro entrance, roughly:
- `0.0–0.4s` background fades/wipes in
- `0.3–0.9s` brand anchor scales/slides in with an overshoot ease
- `0.7–1.4s` title text reveals (mask wipe, letter stagger, or blur-in)
- `1.2–1.8s` info layer (countdown, handles) settles in
- `1.6s+` everything hands off to the idle loop

Stagger elements ~0.1–0.2s apart so they cascade rather than appear at once. Use eased
motion (the brand system defines the exact curves) — linear motion reads as cheap.

**The loop** must be *seamless*: the last frame equals the first. For particles and
gradients, use continuous motion (constant drift, infinite rotation, ping-pong) rather than
animations that visibly restart. Tell the animator the loop length so the build matches.

**Energy = speed + amplitude + density.** Match it to the content:
- Cozy / chatting → slow drifts, low density, soft eases, long loops (10–15s).
- Hype / competitive → faster, snappier eases, more particles, glints, shorter loops (4–8s).
- Cinematic → slow but high-contrast moves, dramatic single hero motion.

## Deliverable: the Scene Brief

Always produce a written brief. It is the contract the other skills build against. Use the
template in `references/scene-brief-template.md` — read it and fill every section. Keep it
concrete: name exact elements, positions, durations, and easings, not vibes alone.

For deeper guidance on each scene type's conventions and recommended timings, read
`references/scene-types-and-timing.md`.

## Handing off

Your brief feeds three skills. Call them out explicitly so the user (and Claude) knows the
next step:

- **stream-brand-visual-system** → defines the palette, fonts, and motion easings the brief
  references. Run this first (or in parallel) so the brief uses real brand tokens.
- **animated-intro-prompt-pack-generator** → produces the background art, mascot, particle
  textures, and any video loops the brief calls for.
- **obs-browser-source-animator** → turns the brief + brand tokens + assets into working
  `index.html` / `style.css` / `script.js` that OBS loads as a Browser Source.

A typical flow: **Director (this) → Brand → Prompt Pack (make assets) → Animator (build) →
load in OBS.** You can also go Director → Animator directly for a code-only,
gradient-and-CSS scene that needs no generated art.

## Worked example (compressed)

> User: "I need a starting soon screen for my cozy Stardew Valley stream, handle @mossbrook."

Brief sketch:
- **Scene:** Starting Soon, 1920×1080, 30fps, loops every 12s.
- **Background:** soft dawn gradient (warm peach → sage), slow vertical drift.
- **Ambient:** ~40 slow-rising pollen/dust motes, gentle parallax.
- **Brand anchor:** small pixel-art lantern, center-upper, 3s glow pulse.
- **Info:** "Stream Starting Soon" (display serif) center; countdown "10:00" below; subtitle
  "grab a coffee, we start soon ☕"; "@mossbrook" lower-center with a leaf icon.
- **Reveal:** bg fade 0–0.5s, lantern drops in w/ overshoot 0.4–1.0s, title mask-wipe
  0.8–1.5s, countdown fades 1.3–1.8s.
- **Handoffs:** Brand → cottagecore palette + serif/rounded pairing; Prompt Pack → lantern +
  seamless dawn background; Animator → build with countdown to a 10-min timer.

Then offer to kick off the brand system or the build.
