# Scene Brief Template

Fill every section. The brief is the contract the other three skills build against, so be
concrete — name exact elements, positions (use a 3×3 grid or px), durations in seconds, and
easings. Vague briefs cause rework.

```
# Scene Brief: <Scene name, e.g. "Starting Soon">

## Context
- Channel / handle:
- Streams (game / genre / IRL):
- Vibe (2-3 adjectives):
- Scene type: Starting Soon | Intro/Welcome | BRB | Ending | In-game overlay
- Needs generated art? yes/no   Needs audio? yes/no

## Canvas
- Resolution: 1920x1080 (16:9)
- Frame rate: 60 (or 30 for slow ambient)
- Background: full-screen opaque  |  transparent (in-game overlay)
- Loops: yes (length: __s)  |  no (one-shot)

## Layers (back to front)
1. Background:        <what it is> | <motion> | <opaque/transparent>
2. Ambient motion:    <particles/fog/etc.> | <density> | <speed>
3. Brand anchor:      <logo/mascot> | <position> | <idle motion>
4. Information:        <title text> / <countdown?> / <subtitle> / <handle> / <socials>
                       <position of each>
5. Framing:           <border/corner accents/webcam frame> | <where>

## Motion choreography
- Reveal (one-shot on entry), beat by beat with times + easing:
  - 0.0-0.4s  ...
  - 0.3-0.9s  ...
  - 0.7-1.4s  ...
- Loop (runs forever): <what moves, how, loop length, why it's seamless>
- Energy: cozy/slow | hype/snappy | cinematic — reflected in speeds + easings

## Information content (exact copy)
- Title:
- Subtitle:
- Countdown: duration <Nmin> | target time <ISO>  | none
- Handle / socials:
- Now-playing / schedule (optional):

## Brand tokens used (from stream-brand-visual-system)
- Palette: <hexes>
- Display font / body font / countdown font:
- Easings: --ease-snap / --ease-smooth  | durations:

## Assets needed (hand to animated-intro-prompt-pack-generator)
- [ ] <asset> — <format: opaque bg / alpha PNG / luma particles / looping video>
- [ ] ...

## Build notes (hand to obs-browser-source-animator)
- Configurable params: title, subtitle, handle, minutes/until, accent
- OBS settings: 1920x1080, FPS 60, Refresh-when-active <on/off>, Shutdown-when-hidden on
- Special behavior: <e.g., switch to "LIVE NOW" at 0; replay reveal each scene activation>
```

## Quick checklist before you hand off
- Does every text element have a legibility plan (scrim/shadow/outline)?
- Is the most important info center/upper, clear of Twitch's bottom player bar?
- Is the loop genuinely seamless (no visible restart)?
- Did you list exactly the assets the scene needs — and no extras?
- Did you name which brand tokens to use, not just colors-in-prose?
