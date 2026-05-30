# twitchscenes

A Claude Skills package plus built OBS scenes for making **animated Twitch intro scenes**
("Stream Starting Soon", BRB, intro/welcome, ending).

## Layout
- `.claude/skills/` — four skills that work together: `twitch-intro-scene-director` (plan),
  `stream-brand-visual-system` (colors/fonts/motion), `animated-intro-prompt-pack-generator`
  (AI-art prompts), `obs-browser-source-animator` (the overlay code). They auto-trigger when
  working in this folder.
- `starting-soon-japan/` — a built scene: pixelated Japanese "Stream Starting Soon" overlay.
  Left = your photo auto-pixelated onto a canvas; right = pixel message (Silkscreen +
  DotGothic16); bottom = a loading bar that fills once over 60s (timer is internal, never
  shown). Fonts are bundled in `assets/fonts/` so OBS works offline.
- `.claude/launch.json` + `.claude/static-server.js` — local static preview server (port 5577).

## Building / editing scenes
- Overlays are **OBS Browser Sources**: 1920×1080, custom FPS 60, Local file → `index.html`.
- Keep all assets bundled locally (no CDN fonts/scripts) so the overlay never breaks if OBS
  is offline.
- Animate only `transform`/`opacity`; use one `<canvas>` for particle fields; drive timed
  things with `setTimeout`/`requestAnimationFrame` (note: rAF can be paused when a source's
  scene is hidden — don't gate one-shot starts on it).

## Git workflow
After completing a meaningful change:
1. Run `git status`
2. Run `git add .`
3. Run `git commit -m "Clear description of changes"`
4. Do NOT run `git push` unless I explicitly say: "push to GitHub"

- Never commit `.env`, `.env.local`, secrets, API keys, or tokens.
- Always check `git status` before committing.
