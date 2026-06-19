# Sakura Static — Animated Stream Overlay Pack

A complete, self-contained stream overlay pack in a **"lo-fi anime night"** style —
moody plum night, soft pink bokeh, drifting cherry-blossom petals, faint VHS scanlines,
frosted "now-playing" cards, and a `CH 03 · LO-FI` dead-channel motif. Built for
**Twitch / YouTube / Kick** with **OBS / Streamlabs / StreamElements**.

Everything runs as a local HTML browser source or exports to PNG/WebM — **no internet,
no CDN, no subscriptions**. Fonts are system/bundled, so it never breaks if OBS is offline.

---

## What's inside

| Folder / file | What it is | How to use |
|---|---|---|
| `starting-soon.html` | "Stream Starting Soon" scene | Browser Source (1920×1080) |
| `brb.html` | "Be Right Back" scene | Browser Source |
| `intermission.html` | Intermission / break scene | Browser Source |
| `ending.html` | "Thanks for watching" outro | Browser Source |
| `transition.html` | Petal / VHS-glitch stinger transition | Browser Source, or record → `transition-export.html` |
| `overlay-slot.html` | In-game overlay (handle bar + accents) | Browser Source (transparent, over gameplay) |
| `webcam.html` | Webcam frame (rounded magenta border) | Browser Source (transparent; put your cam behind it) |
| `alerts/*.html` | 12 animated alerts (follow, sub, member, cheer, donation, host, raid, like, share, star, superchat, supporter) | Browser Source per event, or record → `alerts-export.html` |
| `panels.html` | 12 Twitch panel PNG generator | Open in browser → Download |
| `offline.html` | Offline image (1920×1080) PNG generator | Open → Download → upload as Video Player Banner |
| `banner.html` | Profile banner (1920×480) PNG generator | Open → Download → upload as Profile Banner |
| `icons.html` | 18 transparent PNG icons (social + event) | Open → Download |
| `shared.css` / `shared.js` | The pack's design engine (scaling, bokeh/petal field, timer) | don't edit unless recoloring |
| `assets/fonts/` | Bundled font(s) | leave in place |

---

## Loading a scene into OBS / Streamlabs

For any `*.html` scene (`starting-soon`, `brb`, `intermission`, `ending`, `transition`,
`overlay-slot`, `webcam`, `alerts/*`):

1. **Sources → + → Browser → Create new → OK**
2. Check **Local file**, browse to the `.html`
3. **⚠ Set Width 1920, Height 1080** (OBS defaults to 800×600 — leave it and the scene
   renders small/blurry when you scale it up). Always set the real source size.
4. **Use custom frame rate → 60**
5. For the screens: enable **Refresh browser when scene becomes active** (replays the
   reveal + restarts the loading bar each time you switch in).
6. **Transparent by design:** `overlay-slot`, `webcam`, `alerts/*`, and `transition` have a
   transparent background, so they composite over your game/cam. The four screens are opaque.

**Stinger transition:** Settings → Scene Transitions → **+ → Stinger** → pick the recorded
`transition.webm` → set **Transition Point ≈ 650 ms** (about half the ~1300 ms clip — the
full-cover moment when OBS swaps scenes).

---

## URL knobs (append to the file path in OBS's URL field)

```
?handle=@yourname     handle shown on screens / overlay / webcam
?seconds=120          hidden loading-bar length (default 60) — starting-soon/brb/intermission
?petals=24            petal density on canvas scenes
alerts/*.html         ?type= ?name= ?amount=  (e.g. ?name=Kira&amount=10)
transition.html       ?ms=1300  total duration   ·  ?loop=1  loop for preview
```

## PNG generators (panels / offline / banner / icons)

Open the page in Chrome/Edge, click **Download** (or "Download all"). Then upload:
- **Panels** (320×100) → Twitch: your channel → **About → Edit Panels → +**
- **Offline image** (1920×1080) → Twitch: Settings → Channel → Brand → **Video Player Banner**
- **Profile banner** (1920×480) → Twitch: Settings → Channel → Brand → **Profile Banner**
- **Icons** (transparent PNGs) → use in your panels, descriptions, or socials

## Animated deliverables → .webm (for portable clips / Stinger)

`transition-export.html` and `alerts-export.html` record the live animation to a
**transparent .webm** (click Record in a foreground Chrome/Edge tab). Alpha survives only in
VP9/VP8 webm — not mp4. For a ProRes `.mov` with alpha:
```
ffmpeg -i in.webm -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le out.mov
```

## Customizing the look

This whole pack reads its palette from `:root` in `shared.css` (and matching JS color
constants in the generators). Swap those hex values to recolor the entire pack at once.

## Notes
- **Editable source** is the runnable HTML/JS generators (not layered `.psd`).
- **No audio** ships with the alerts (visuals only).
- WebM export is manual + Chromium-only (foreground tab; background tabs drop frames).

## License
Bundled fonts are OFL (open-license). You may use this pack for your own channels.
