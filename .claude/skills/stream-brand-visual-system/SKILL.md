---
name: stream-brand-visual-system
description: "Defines the visual identity and design system for a streamer's scenes so every overlay looks cohesive and on-brand. Use this skill whenever the user is choosing or refining colors, fonts / typography, motion language (easing curves, signature transitions), logo / wordmark usage, or text legibility over gameplay — or wants a reusable brand kit or design tokens for their channel. Trigger for 'pick a color palette for my channel', 'what fonts should my stream use', 'make my scenes look consistent', 'build a brand kit for my Twitch channel', 'I want a cozy / cyberpunk / retro / kawaii vibe', 'make my overlay text readable over gameplay', or any request about the LOOK and feel of a stream rather than the layout or the code. Produces a brand token sheet (CSS :root variables in assets/brand-tokens.css) plus usage guidelines that the obs-browser-source-animator consumes directly and that the animated-intro-prompt-pack-generator references for color and style."
---

# Stream Brand Visual System

You are the art director. A channel feels professional when its Starting Soon, BRB, intro,
overlays, and panels all clearly belong to the same family. This skill defines that family
as a small set of **design tokens** — colors, type, spacing, and motion — that every other
skill consumes so the look stays consistent without anyone re-deciding it each time.

The deliverable is a **brand token sheet**: CSS custom properties in `:root`, plus short
usage rules. Code (the animator) imports it verbatim; prompts (the prompt pack) reference
the palette and mood. One source of truth.

## When you are invoked

1. Establish the **vibe** in plain words (cozy, cyberpunk/neon, retro/synthwave, minimalist,
   kawaii/pastel, esports/aggressive, dark academia, vaporwave, IRL-clean…). Ask the genre
   they stream and one or two adjectives if you don't have them.
2. Build the **palette**, **type pairing**, and **motion language**.
3. Write `brand-tokens.css` (start from `assets/brand-tokens.css` and customize) plus a short
   guidelines note.
4. Tell the animator and prompt-pack skills which tokens to use.

For ready-made, genre-matched palettes, font pairings, and easing sets you can lift directly,
read `references/genre-style-guide.md`.

## The token model

Organize the system into four groups. Keep names stable — the animator's template expects
these.

```css
:root {
  /* ---- Color ---- */
  --brand-bg-1: #1a1030;        /* background gradient start */
  --brand-bg-2: #3a1a5c;        /* background gradient end   */
  --brand-primary: #b388ff;     /* main brand hue            */
  --brand-accent: #00e5ff;      /* high-energy highlight     */
  --brand-ink: #f5f3ff;         /* primary text on dark bg   */
  --brand-ink-dim: #b9b3d6;     /* secondary text            */
  --brand-scrim: rgba(10,5,25,.55); /* legibility wash behind text */

  /* ---- Type ---- */
  --font-display: "Clash Display", system-ui, sans-serif; /* titles */
  --font-body: "Inter", system-ui, sans-serif;            /* labels/handles */
  --font-mono: "JetBrains Mono", monospace;               /* countdown digits */

  /* ---- Space / shape ---- */
  --pad-safe: 96px;             /* 5% safe margin at 1080p */
  --radius: 18px;
  --stroke: 2px;

  /* ---- Motion ---- */
  --ease-snap: cubic-bezier(.2, .9, .2, 1);   /* overshoot entrance */
  --ease-smooth: cubic-bezier(.4, 0, .2, 1);  /* soft settle        */
  --dur-reveal: 700ms;          /* one-shot entrance beat */
  --dur-loop: 12s;              /* ambient loop length    */
}
```

## Color: build for legibility over motion

Overlays sit on top of gameplay and animated backgrounds, so contrast is a *functional*
requirement, not just taste.

- Pick a **palette of ~5**: two background tones (for a gradient), one primary, one accent,
  and neutral ink. Optionally a second accent for alerts.
- Ensure text **ink vs. background** clears **WCAG AA (4.5:1)**. On busy or video
  backgrounds you can't guarantee the background, so always pair text with a **scrim**
  (semi-transparent wash), a **drop shadow**, or an **outline/stroke**. Define a
  `--brand-scrim` token and use it behind every text block.
- Reserve the **accent** for one or two things (the countdown, a glow). Accents lose punch
  if everything is accent-colored.
- Match palette psychology to the vibe: warm low-saturation = cozy; high-saturation
  cyan/magenta on near-black = neon/cyber; muted earth tones = cottagecore; pastel + white =
  kawaii.

## Typography: pair a voice with a workhorse

- **Display font** for titles ("Stream Starting Soon"): this carries the personality —
  rounded, serif, condensed, pixel, techno, etc.
- **Body font** for labels, handles, subtitles: a clean, highly legible sans.
- **Mono or tabular font** for the **countdown**: digits should be **tabular/monospaced** so
  the timer doesn't jitter as numbers change width. (Many sans fonts offer
  `font-variant-numeric: tabular-nums` — use it if you keep one font.)
- Pair by contrast: distinctive display + neutral body. Two fonts is plenty; three max.
- **Licensing matters for streaming.** Prefer open licenses (SIL OFL / Google Fonts) that
  permit commercial/broadcast use, and **self-host** the files (the animator bundles them).

## Motion language

Motion is part of the brand. Define a small, reusable set of easing curves and durations so
every scene moves with the same "hand."

- **Entrance ease** (`--ease-snap`): a slight overshoot for energetic reveals.
- **Settle ease** (`--ease-smooth`): for things easing to rest and for loops.
- **Reveal duration** and **loop length** tokens so timings are consistent across scenes.
- The *personality* lives here: cozy = slow, soft, long loops; hype = fast, snappy, short
  loops; cinematic = slow but high-contrast single moves. Encode that choice in the duration
  and easing values, then the director's beats and the animator's keyframes inherit it.

## Logo / wordmark / mascot usage

If the channel has (or wants) a mark:
- Specify **clear space** (keep a logo-height of padding around it) and **minimum size**.
- Define on-dark and on-light variants.
- Note its **idle motion** (gentle bob, glow pulse, blink) so the animator gives it life
  without distraction.
- If they need the mark *created*, hand that to the animated-intro-prompt-pack-generator
  with the palette and vibe from here.

## Deliverable: `brand-tokens.css` + guidelines

1. Copy `assets/brand-tokens.css`, fill in real values for this channel, keep the variable
   names.
2. Add a short **guidelines** block (can live as comments in the CSS or a sibling note):
   palette swatches with hex, font names + where to get them + license, the one-line motion
   personality, and the legibility rule (always scrim/shadow behind text).
3. State the **handoffs**:
   - **obs-browser-source-animator** imports this file's `:root` block directly into
     `style.css`.
   - **animated-intro-prompt-pack-generator** uses the palette hexes and vibe adjectives to
     steer AI art so generated backgrounds/mascots match the coded UI.
   - **twitch-intro-scene-director** references the motion tokens when writing beat timings.

Keep the system small. A tight set of 5 colors, 2 fonts, and 2 easings used consistently
looks far more professional than a sprawling style guide nobody follows.
