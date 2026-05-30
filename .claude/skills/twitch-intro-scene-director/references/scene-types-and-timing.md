# Scene Types, Conventions & Timing

Reference for designing each standard scene. Use these as starting points, then tune to the
channel's energy.

## Starting Soon
The pre-stream holding screen. Viewers arrive early and idle here, so it must survive being
watched for several minutes without getting annoying.
- **Hero info:** a title ("Stream Starting Soon") + a **countdown**. The countdown is the
  single most valuable element — it tells viewers exactly how long to wait.
- **Secondary:** subtitle ("grab a snack, we start soon"), handle, socials, maybe a schedule
  or "today's plan."
- **Motion:** ambient and *slow*. It loops for minutes; anything fast or flashy becomes
  grating. Long loop (8–15s).
- **Reveal:** plays once when the scene loads; then settles into the ambient loop.
- **Audio:** usually a relaxed music bed (royalty-free / DMCA-safe for Twitch VODs).

## Intro / Welcome sting
A short, punchy title animation when you actually go live, then you cut to gameplay.
- **One-shot, 3–8s.** No loop. This is the place for energy: logo slam, light sweep, name
  reveal, a stinger transition out.
- In OBS, enable **"Refresh browser when scene becomes active"** so it replays every time you
  switch to the scene.
- Keep it short — viewers want the content, not a 20-second movie.

## Be Right Back (BRB)
Mid-stream pause. Similar to Starting Soon but usually no countdown (you don't know exactly).
- "Be Right Back" + reassuring subtitle ("don't go anywhere!").
- Often reuses the Starting Soon background/brand for consistency — recommend a variant, not
  a whole new look.
- Loops indefinitely; keep it calm.

## Ending / Outro
Wrap-up screen at the end of stream.
- "Thanks for watching!" + socials + "follow for next time" + maybe a raid/host note.
- Can be slightly warmer/celebratory than BRB. Loops for a minute or two while you wrap chat.

## In-game overlay
Sits transparent over gameplay continuously.
- **Background layer must be transparent** — only frames, corner accents, webcam border,
  alerts, and subtle ambient particles.
- Motion must be *very* subtle so it never distracts from gameplay; respect a generous safe
  area around the action.

## Timing cheat-sheet

| Energy | Reveal duration | Entrance ease | Loop length | Particle density |
|---|---|---|---|---|
| Cozy / chatting | 0.8–1.6s, gentle | soft overshoot | 10–15s | low |
| Hype / competitive | 0.4–0.9s, snappy | strong overshoot | 4–8s | medium–high |
| Cinematic | 1.2–2.5s, dramatic | slow ease-out | 12–20s | low, high-contrast |
| Kawaii / playful | 0.6–1.2s, bouncy | back/elastic | 6–10s | medium, cute shapes |

## Stagger
Reveal elements in a cascade, ~0.1–0.2s apart, back-to-front (background → anchor → title →
info). Simultaneous reveals look flat; a slight cascade reads as designed and intentional.

## Loop seamlessness
The loop's last frame must equal its first. Prefer **continuous** motion (constant drift,
infinite spin, ping-pong) over keyframed moves that visibly snap back. For particle systems,
recycle particles edge-to-edge rather than resetting the whole field at once. State the loop
length in the brief so the animator's keyframe timings match.
