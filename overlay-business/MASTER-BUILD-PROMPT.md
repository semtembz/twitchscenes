# THE MASTER BUILD-PROMPT — Overlay Pack Production Spec v1

**Purpose.** The single, reusable, copy-pasteable specification for producing one complete, consistent, sellable overlay pack in our engine. Hand a builder **one approved theme** (the Per-Theme Parameter Block, §3) plus this document, and they have everything needed to ship a pack mirroring the reference manifest (StreamSpell *ESports Collision*), minus Tutorials.

**Core principle — engine and brand are decoupled.** One engine + N token sets = N themes. Structure, layout, motion, particle fields, reveal timing, export pipeline, and OBS scaling (`#stage` transform-scale + `fit()`) are 100% theme-agnostic and live in `shared.css` / `shared.js` / `vertical-bg.js`. A "theme" is one `:root` token block + one bundled font folder + a few motif choices. **Never fork the engine per theme — only swap tokens, fonts, and motif art.**

---

## 0. How to use this document
1. Get **one approved theme** as a filled-in Per-Theme Parameter Block (§3).
2. Duplicate the reference pack folder (`red-gold-pack/`) to the new pack folder (§5 naming).
3. Replace `:root` in `shared.css` with the theme palette/geometry tokens; drop the theme font(s) into `assets/fonts/` and rewrite `@font-face`.
4. Swap motif art in the canvas fields (petals → theme motif) in `shared.js` / `hero.js` / `vertical-bg.js`.
5. Build the per-deliverable files per the Manifest (§1), following Engine Conventions (§2).
6. Run the QA Checklist (§4) on every horizontal (1920×1080) and vertical (1080×1920) deliverable.
7. Package + write the README and OBS note (§5).

---

## 1. FILE / FOLDER MANIFEST (every pack ships this — Tutorials EXCLUDED)

Top-level folders mirror the reference: **Screens, Alerts, Transition, Overlays, Panels, Social Media, Icons, Fonts**, plus **README** + **OBS setup note**.

**Production method legend**
- **[BS]** Self-contained OBS Browser Source: `index.html` + bundled CSS/JS, scaled `#stage`, runs live. Ship the runnable source.
- **[PNG-GEN]** On-canvas PNG generator page that draws on `<canvas>` and downloads via `toDataURL`. Ship the generator page **and** the exported flat `.png`.
- **[WEBM]** Animated HTML source → recorded to transparent `.webm` via the in-browser MediaRecorder export page (`*-export.html`, `canvas.captureStream(60)` → VP9/VP8). Ship the `.webm` (and the export page as "source").

### `/` (root)
| File | Method | Notes |
|---|---|---|
| `README.txt` | — | Product name, contents, quick-start, license (§5). |
| `OBS Setup.txt` | — | Per-source OBS instructions (size, FPS, transparency, stinger point). |
| `shared.css`, `shared.js` | [BS] | Engine: tokens + `fit()`. Theme-agnostic except `:root`. |
| `vertical.css`, `vertical-bg.js` | [BS] | Vertical engine (1080×1920). |
| `assets/fonts/…` | — | Bundled theme font(s), OFL/embed-licensed only. |

### `/Screens` — animated full-screen scenes (16:9 + 9:16 twins)
| File | Method |
|---|---|
| `starting-soon/index.html` (+ css/js/hero/assets) | **[BS]** live; **[WEBM]** `StartingScreen.webm` |
| `brb.html` | [BS] + [WEBM] `BeRightBack.webm` |
| `intermission.html` (1–3 variants) | [BS] + [WEBM] |
| `ending.html` | [BS] + [WEBM] `EndingScreen.webm` |
| `offline.html` (renders 1920×1080 still) | **[PNG-GEN]** → `OfflineScreen.png` |
| Vertical twins: `vertical/starting.html`, `pause.html`, `ending.html` | [BS] (1080×1920) |

### `/Alerts` — 12 event scenes
Reference set: **Follower, Subscriber, Member, Cheer, Donation, Host, Raid, Like, Share, Star, Superchat, Supporter**.
| File | Method |
|---|---|
| `alerts/<event>.html` ×12 (shared `alerts.css` + `alerts.js`) | **[BS]** event-parameterized; **[WEBM]** `NEW <EVENT>.webm` per event |
| `alerts-export.html` | [WEBM] export driver |

> Alerts are **event-fired**, not load-fired, and carry **dynamic text** (name + amount). Biggest build slot — budget the most time here.

### `/Transition` — stinger
`transition.html` (canvas corner-collapse, alpha) → `transition-export.html` → `Transition.webm` [WEBM].

### `/Overlays` — in-game frame + webcam frame (16:9)
| File | Method |
|---|---|
| `overlay-slot.html` (transparent HUD frame) | [BS] + [WEBM] `Overlay Slot.webm` |
| `webcam.html` (transparent webcam frame) | [BS] + [WEBM] `Webcam.webm` |
| Vertical: `vertical/cam-single.html`, `cams-square.html`, `cams-stacked.html`, `hud-cam-top/bottom/chat.html` | [BS] |

### `/Panels` — Twitch profile panels (320×100 each)
`panels.html` [PNG-GEN] + one `.png` per panel. Ship the reference set (~40 labels): About, Schedule, Rules, Donations, Discord, Twitter, YouTube, Instagram, Merch, PC Specs, Gear, Sponsors, Subscribe, Top Donators, Steam, Community, FAQ, Setup, Links, …

### `/Social Media` — banners
`banner.html` [PNG-GEN] (profile banner 1920×480 w/ safe-zone guide + video banner) → `PROFILE.png`, `TWITCH.png`, `TWITTER.png`, `YOUTUBE.png`, `FACEBOOK.png`.

### `/Icons` — standalone transparent-PNG set
`icons.html` [PNG-GEN] → one transparent `.png` per icon. Reference coverage = **44 icons** (17 social + 27 stream-label). Ship the full set; thin coverage is a known competitive gap.

### `/Fonts`
Theme font family file(s), **embed-licensed (OFL or equivalent)**. Same file bundled in `assets/fonts/` and `/Fonts`.

> **Excluded:** `/Tutorials`. **Known packaging gap (disclose, don't fake):** reference ships layered `.psd` sources; our "source" is the runnable HTML/JS generator. README states this honestly.

---

## 2. ENGINE CONVENTIONS (follow exactly)

### 2.1 Scaled `#stage`
Fixed **1920×1080** (horizontal) / **1080×1920** (vertical). `#stage` is `position:absolute; top/left:50%; transform: translate(-50%,-50%) scale(var(--scale,1))`; every layer is an absolute child so text + animation share one coordinate system (browser view == OBS view). `fit()` sets `--scale = Math.min(innerWidth/1920, innerHeight/1080)`. **Guard:** if `innerWidth<10 || innerHeight<10` → return (never write `--scale:0`). Re-fit on `resize` + ~10× on an interval after load.

### 2.2 Brand-token `:root` (exact names — re-skinning replaces this block)
```css
:root {
  --green-deep: #______;  /* deepest background  */
  --green-mid:  #______;  /* lifted background   */
  --green-line: #______;  /* pattern lines       */
  --neon:       #______;  /* primary accent — frame, beam, bar */
  --neon-dark:  #______;  /* deep primary — edges, shadow      */
  --mint:       #______;  /* secondary accent — studs, rule    */
  --mint-soft:  #______;  /* lightest accent — kicker, handle  */
  --text:       #______;  /* primary text        */
  --text-dim:   #______;  /* muted text          */
  --panel-x:    46%;      /* photo/message seam  */
  --bar-h:      30px;     /* loading bar height  */
  --frame-inset:0px;
  --font-pixel: "<ThemeDisplay>", "Courier New", monospace;
  --font-jp:    system-ui, "Segoe UI", Roboto, sans-serif;
}
```
> Keep token **names** stable across themes even when the value isn't literally neon/gold — the engine references names, not meaning (proven by the neon twin reusing the red-gold file with only hexes swapped).

### 2.3 Bundled local fonts (no CDN)
`@font-face` from `assets/fonts/` for Regular + Bold, `font-display:swap`. Embed-licensed only (OFL). Bundle the same file in `assets/fonts/` and `/Fonts`. No remote fonts/scripts — must work with OBS offline.

### 2.4 Animation rules
Animate **only `transform`/`opacity`** in CSS. **One `<canvas>`** per scene for particle/line fields, driven by `requestAnimationFrame`. One-shot reveals (Starting/BRB/Intermission/Ending) = staggered CSS `@keyframes` with incremental delays. **Do not gate one-shot starts on rAF** (OBS pauses rAF when a source's scene is hidden) — use `setTimeout`/CSS so they fire on load.

### 2.5 Defensive guards (everywhere)
Null-guard every optional subsystem (`if (fill){…}`, `if (pcv){…}`). One `shared.js` runs across all screens; each only includes the markup it needs. Image `onload`→`.ready`, `onerror`→`.placeholder .ready`. Param config `const num=(k,d)=>Number(params.get(k))||d;` — support `?seconds`, `?handle`, `?photo`; garbage falls back to defaults.

### 2.6 60s loading bar
`.loadbar > .loadbar__track > .loadbar__fill`, no numbers shown. `seconds=num('seconds',60)`; `fill.style.transition='width '+seconds+'s linear'`; kick `width:100%` after a 60ms tick.

### 2.7 Status-flip
After `seconds*1000`: add `.done`; flip status text from live value to `dataset.done` (e.g. "BOOTING UP"→"READY") via fade-out → swap → fade-in (~560ms). Guard `statusEn`, `loadstatus`, `loadtext`.

### 2.8 webm export page (per animated deliverable)
Standalone `*-export.html` mirrors the live scene onto a 1920×1080 (or 1080×1920) canvas: `cv.captureStream(60)` → `MediaRecorder({mimeType, videoBitsPerSecond:12_000_000})`. **Mime chain:** `video/webm;codecs=vp9` → `vp8` → `video/webm`. **Alpha only survives in VP9/VP8 webm — never mp4.** Pad clear frames at start/end; download via `<a download>` blob. Include the `.mov` path: `ffmpeg -i in.webm -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le out.mov`. Caveat: export is manual + Chromium-only, foreground-tab, one clip at a time.

### 2.9 Alert runtime (different from screens)
Event-fired, not load-fired. Shared `alerts.js` exposes `play({name, amount})` + per-event choreography. Live BS path binds to the platform event (Streamlabs/StreamElements custom HTML, or OBS) and injects dynamic text; baked `.webm` path renders placeholder text and records one clip per event. Make each event's motion distinct. **Audio out of scope — no SFX ships.**

### 2.10 Accessibility / performance
Cap FPS to source FPS. **Clamp delta-time:** `dt=Math.min(now-last, 1/30s)` and advance state by clamped `dt`, so a hidden→shown OBS scene never teleports particles. Modest, `?`-configurable particle counts. Round canvas coords to integers. `pointer-events:none` on particle layers. Legible contrast: `--text` over `--green-deep`; glow must not wash the headline.

### 2.11 Copy standard — NO cringe flavor text (added 2026-06)
Real streamers do not want cheesy themed taglines. Hard rules for ALL screens + overlays:
- **Titles** are clean + universal: `STARTING SOON` / `BE RIGHT BACK` / `SHORT BREAK` (or `INTERMISSION`) / `THANKS FOR WATCHING`. Never themed-cringe ("QUICK RINSE", "THANKS FOR SPLASHING BY", "DRAINING THE TUB").
- **Every flavor text position** (themed kicker, subtitle, tagline, corner brand tag, offline/banner blurb) is an **editable slot**: an element with `class="is-slot" data-slot="<name>"` whose visible text is `[ your text here ]`; multiple slots per screen where the design has them. CSS: `.is-slot{opacity:.5;font-style:italic;}`. `shared.js` loops `[data-slot]` (after the handle block): `?name=Text` fills it (and un-dims), `?name=-`/empty/`none`/`off` removes it. There is **no** themed kicker status-flip (supersedes §2.7 for the kicker text).
- **Alert sub-lines** ship EMPTY (`sub:""` in the EVENTS table + the alerts-export mirror + an empty baked `<p id="sub"></p>`); keep the functional event headline + viewer name + amount. Buyers re-add via the EVENTS table.
- offline/banner draw text on canvas → use a literal `[ your text here ]` placeholder STRING for taglines; keep functional labels (OFFLINE, @handle, twitch.tv). Don't break `__exportAssets`.
- Reference implementation: `bubble-bath-source/`. Memory: `overlay-copy-no-cringe`.

---

## 3. PER-THEME PARAMETER BLOCK (fill one per approved theme)
```yaml
# ============ THEME PARAMETER BLOCK ============
theme_name:        "<Display name, e.g. 'Neon Arena'>"
folder_slug:       "<kebab, e.g. neon-arena-pack>"
price_tier:        "<Standard | Premium>"

# ---- PALETTE (9 hexes -> :root) ----
green_deep:  "#______"   # deepest bg
green_mid:   "#______"   # lifted bg
green_line:  "#______"   # pattern lines
neon:        "#______"   # primary accent
neon_dark:   "#______"   # deep primary
mint:        "#______"   # secondary accent
mint_soft:   "#______"   # lightest accent
text:        "#______"   # primary text
text_dim:    "#______"   # muted text

# ---- TYPOGRAPHY ----
display_font:    "<name>"   # assets/fonts/<File>-{Regular,Bold}.ttf
display_license: "<OFL / embeddable>"
subtitle_font:   "system-ui stack (default) or bundled <name>"

# ---- MOTION LANGUAGE ----
ease:           "cubic-bezier(.2,.9,.2,1)"
reveal_rise_px: 22
stagger_ms:     "150 / 300 / 380 / 480 / 580 / 720"
breathing_glow: "<element + period, e.g. 'SOON', 3.4s>"

# ---- MOTIF / TEXTURE ----
particle_motif:   "<sakura petals | neon sparks | topo ribbons | embers>"
particle_colors:  ["#______", "#______", "#______"]
particle_count:   24
bg_texture:       "<dot-grid | scanlines | hexes | topo lines>"
hero_field:       "<hero-vs-blob chase | orbiting glyphs | none>"
frame_style:      "<solid 6px --neon + inset --neon-dark | dashed | corner-cut>"
icon_glyph_style: "<pixel | line | filled>   # must yield 44 consistent icons"

# ---- ALERT CHOREOGRAPHY (keep all 12) ----
alert_followsub:   "<entrance + accent burst>"
alert_raidhost:    "<bigger, multi-element>"
alert_donation:    "<name + amount emphasis, amount color = --mint-soft>"
alert_misc:        "<like/share/star/etc. lightweight>"
alert_duration_ms: 4000

# ---- TRANSITION ----
transition_motion:   "<corner-collapse | wipe | shatter>"
transition_dur_ms:   1344
transition_point_ms: 672   # half of duration -> OBS stinger transition point

# ---- COPY / WORDING ----
starting_kicker:   "<e.g. 'STREAM STARTS'>"
starting_title:    "<3 lines, last = accent, e.g. STARTING / VERY / SOON>"
starting_sub:      "<subtitle>"
brb_copy:          "<e.g. BE RIGHT / BACK>"
intermission_copy: "<...>"
ending_copy:       "<e.g. THANKS FOR / WATCHING>"
status_live:       "BOOTING UP"
status_done:       "READY"
handle_default:    "@yourhandle"
# ===============================================
```

---

## 4. QA / VERIFICATION CHECKLIST (text-based — screenshots time out on animated canvas)
- [ ] **No overflow/cutoff @ 1920×1080** — no child rect exceeds stage bounds; 3-line+accent title fully inside the frame (past vertical-title cutoff bug — re-verify).
- [ ] **No overflow/cutoff @ 1080×1920** (vertical twins).
- [ ] **`fit()` sane** — `--scale > 0` at several window sizes; tiny viewport (<10px) never writes `--scale:0`.
- [ ] **Transparency correct** for alerts/overlay-slot/webcam/transition — no opaque full-bleed bg; sample corner canvas pixel alpha = 0. Screens may be opaque by design.
- [ ] **Fonts load offline** — `document.fonts.check('700 84px "<ThemeDisplay>"')` true; `.title` resolves to bundled face, no CDN request.
- [ ] **webm has alpha** — transparent regions show the checker; codec VP9/VP8; non-trivial file size.
- [ ] **Fits OBS at native source size** — fills edge-to-edge, `--scale==1`, no letterbox.
- [ ] **Loading bar + status** — fills once over `?seconds` (default 60), no numbers; `.done` set + status flips at completion.
- [ ] **Param config** — `?seconds`/`?handle`/`?photo` apply; garbage falls back.
- [ ] **Defensive guards** — remove an optional element → no console error; missing `?photo` → placeholder.
- [ ] **Hidden-scene rAF safety** — simulate a long gap: particles don't snap (delta clamp holds).
- [ ] **Alerts** — 12 distinct motions; name/amount inject + don't overflow at long names.
- [ ] **Panels/Icons/Banners** — correct sizes (panel 320×100, banner 1920×480, icons transparent, count==44).
- [ ] **Token isolation** — no hardcoded theme hexes outside `:root`/JS constant block (a second colorway re-skins from tokens alone).
- [ ] **No CDN / no secrets** — no remote font/script links; no `.env`/keys committed.

---

## 5. NAMING + PACKAGING & FAST COLORWAY TWIN

**Naming.** Product: `<Theme Name> — Animated Stream Overlay Pack`. Folder: `<theme-slug>-pack/` (kebab). Internal file names match reference labels (`StartingScreen.webm`, `NEW FOLLOWER.webm`, `OfflineScreen.png`, etc.) so buyers recognize them.

**README contents.** (1) product name + theme summary; (2) what's inside, folder by folder; (3) quick start (live `.html` OR baked `.webm`/`.png`); (4) customization (`?seconds`/`?handle`/`?photo`; tokens in `shared.css :root`); (5) OBS settings — Browser Source 1920×1080 (vertical 1080×1920), Custom FPS 60, Local file → index.html, transparency on, Stinger Transition Point ≈ `transition_point_ms`; (6) honest notes (HTML/JS generators as editable source not `.psd`; webm export Chromium-only/manual; `.mov` via ffmpeg; no audio); (7) license.

**Price tiers.** *Standard* = Screens + Transition + Panels + Social + Fonts (fully-solved set). *Premium* = Standard + Alerts(12) + Overlays(slot+webcam) + 44-icon set + vertical 9:16 set (the real per-theme work).

**Spin a colorway twin fast (proven):** `cp -r <base>-pack <twin>-pack`; replace the **9 palette hexes** in `shared.css :root` and the same hexes used as JS constants in the generators/export pages; optionally swap particle motif colors; re-run full QA; rename + rewrite README; ship.

> **Honest caveat:** the token swap fully covers **color + type**. **Motif art** (petals vs ribbons vs sparks), mascots, the 44-icon set, and any **new deliverable category** (alerts, horizontal webcam frame) are incremental design/engineering per theme — not a free flip. No automated build step yet, so each re-skin is a manual pass. A colorway twin is **hours**; a brand-new motif theme is **days**.

---

### Engine source-of-truth files (do not fork per theme)
`shared.css` (tokens + layout), `shared.js` (`fit()` + guards + bar/status + particle field), `vertical.css` + `vertical-bg.js`, `transition.html` + `transition-export.html` (clone the export pattern for every `*-export.html`), and the PNG generators `panels.html` / `offline.html` / `banner.html` / `icons.html`. Everything theme-specific lives in `:root`, `assets/fonts/`, and motif art constants.
