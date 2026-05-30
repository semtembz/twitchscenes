---
name: animated-intro-prompt-pack-generator
description: "Generates ready-to-paste prompt packs for AI image, video, and 3D tools to create the visual and motion ASSETS used in a Twitch/OBS intro scene — looping animated backgrounds, mascots/characters, logo treatments, transparent particle and overlay textures, frames/borders, and transition stingers. Use this skill whenever the user needs PROMPTS or asset generation for an intro / Starting Soon / BRB / outro scene: 'write Midjourney prompts for a stream background', 'generate a looping animated background for my intro', 'I need a mascot for my channel', 'prompts for particle overlays or a transition stinger', 'make AI assets for my OBS scene', or wants to use Midjourney, DALL-E, Stable Diffusion / Flux, ComfyUI, Sora, Runway, Kling, Luma, or Pika for stream art. Produces a structured Prompt Pack organized by asset, tuned for 16:9, seamless loops, alpha / transparency, and the channel's brand palette. Ties generated assets back to the stream-brand-visual-system and hands them to the obs-browser-source-animator to wire into the scene."
---

# Animated Intro Prompt Pack Generator

You turn a Scene Brief into the **art and motion assets** that fill it, by writing precise,
tool-ready prompts (and, when a local generator is connected, generating the assets
directly). Your output is a **Prompt Pack**: one organized document with a prompt block per
asset, each tuned for the right tool, aspect ratio, loopability, and transparency, all
steered by the channel's brand palette.

## Asset inventory for an intro scene

Work from the brief's layers. A typical Starting Soon / intro scene needs some subset of:

| Asset | Tool type | Key requirements |
|---|---|---|
| **Looping background** | image *or* video | 16:9, seamless loop, slow motion, brand palette |
| **Tileable texture** (noise, grid, paper) | image | seamless/tileable, subtle |
| **Mascot / character** | image (→ optional rig) | transparent PNG, clean silhouette, on-brand |
| **Logo / wordmark treatment** | image | transparent PNG, crisp edges |
| **Particle / overlay textures** (bokeh, dust, sparks, smoke) | image | **transparent alpha**, white-on-black if luminance-keyed |
| **Frame / border / corner accents** | image | transparent center, 16:9 |
| **Transition stinger** | video | short (0.5–1.5s), alpha or luma-matte, fast |
| **Background music / SFX sting** | audio | loopable bed or one-shot stinger |

## Prompt anatomy

Build every image prompt from these slots (drop any that don't apply). Being explicit beats
being flowery — generators reward concrete nouns and constraints.

1. **Subject** — what it is ("a glowing pixel-art lantern," "an abstract synthwave grid").
2. **Style** — medium and art direction ("flat vector," "3D render, soft studio light,"
   "cel-shaded anime," "32-bit pixel art," "risograph print").
3. **Composition** — framing and negative space ("centered, lots of empty space around it,"
   "full-bleed background, no focal subject," "symmetrical border, empty center").
4. **Color** — *quote the brand hexes/names* from the stream-brand-visual-system so assets
   match the coded UI ("palette: deep indigo #1a1030, violet #b388ff, cyan accent #00e5ff").
5. **Lighting / mood** — ("soft dawn glow," "neon rim light, dark ambient," "high-key").
6. **Motion** (video only) — ("slow parallax drift left, gentle particle float, looping").
7. **Technical** — aspect ratio (**16:9 / `--ar 16:9`**), resolution, and any flags.
8. **Loop / tile / alpha** hints — see below.
9. **Negative prompt** — what to exclude ("no text, no watermark, no busy clutter, no faces"
   for backgrounds).

## Seamless loops and tileable assets

This is what separates "AI picture" from "usable stream asset."

- **Tileable image backgrounds:** ask for "seamless tileable texture, edges wrap, no visible
  seams." In Stable Diffusion/ComfyUI, enable **tiling/circular padding** for true seamless
  output. The animator can then slow-pan it infinitely.
- **Looping video backgrounds:** prompt for **continuous, constant-velocity motion** (drift,
  rotation, flow) and the words "seamless loop, first frame matches last frame." Avoid
  prompts implying a beginning/end event (no "explosion," "reveal"). Keep clips short
  (4–8s) and let the overlay loop them. If a tool can't truly loop, generate slightly long
  and crossfade the ends in editing.
- **Ambient over hero:** for backgrounds, prefer low-contrast, low-detail, lots of negative
  space — text and the mascot sit on top and need breathing room.

## Transparency / alpha workflow

OBS overlays need real transparency. Three ways to get it:

1. **Native alpha:** some image tools export transparent PNGs directly (ask for "transparent
   background, isolated subject, PNG with alpha"). Best for mascots, logos, frames.
2. **Background removal:** generate on a flat removable background ("solid chroma green
   background" or "pure white") and key/cut it out afterward (e.g., in GIMP via the connected
   MCP, or rembg).
3. **Luminance keying for particles/smoke/sparks:** generate the effect as **bright on pure
   black**, then the animator blends it with CSS `mix-blend-mode: screen` (black drops out)
   — no alpha channel needed. This is the cleanest path for dust, bokeh, embers, and light
   leaks.

State which method applies in each prompt block so the animator knows how to composite it.

## Tool-specific notes

- **Midjourney** — append `--ar 16:9`; use `--tile` for seamless textures; `--style raw` for
  less stylization; `--no text watermark` as negatives.
- **DALL·E / GPT image** — natural-language, explicit "transparent background" supported for
  isolated assets; weaker at seamless tiling.
- **Stable Diffusion / Flux (incl. ComfyUI)** — best control: enable **tiling** for seamless
  backgrounds, use **ControlNet** for logo/shape conditioning, **IP-Adapter** for style
  consistency across a set, and LoRAs for a locked art style. A ComfyUI MCP may be connected
  in this environment — see "Local generation" below to render directly.
- **Video — Sora / Runway / Kling / Luma / Pika** — describe motion + camera + "seamless
  loop"; keep subjects simple; generate 16:9; expect to trim/crossfade for a clean loop.

## Local generation (when an MCP is connected)

If a generation server is available in the session, you can produce assets directly instead
of only handing prompts to the user:
- **ComfyUI** (`mcp__comfyui__*`) — generate images/backgrounds, enable tiling for seamless
  textures, use ControlNet/IP-Adapter workflows, and pull outputs for the scene's `assets/`.
- **GIMP** (`mcp__GIMP__*`) — cut out backgrounds to alpha, export optimized PNGs, batch
  resize to display resolution.
- **Blender** (`mcp__Blender__*`) — 3D mascots/logos and rendered loop frames.
- **ElevenLabs** (`mcp__ElevenLabs__*`) — generate the intro music bed or a stinger SFX.

Search for these with ToolSearch before assuming they're unavailable. If none are connected,
just deliver the Prompt Pack for the user to run in their tool of choice.

## Deliverable: the Prompt Pack

Produce one document, **one block per asset**, each ready to paste:

```
### Asset: Looping background  (tool: SDXL/ComfyUI or Midjourney)
Prompt: abstract synthwave horizon, scrolling neon grid, distant sun, flat retro vector,
  full-bleed, lots of empty sky, soft glow — palette: indigo #1a1030, violet #b388ff,
  cyan #00e5ff — seamless tileable, no text, no watermark  --ar 16:9 --tile
Negative: text, watermark, people, clutter, busy foreground
Loop/Alpha: tileable; pan horizontally in the overlay for infinite scroll
Composite: full background layer (opaque) for Starting Soon
```

For genre-matched, copy-paste recipe sets (cozy, cyberpunk, retro/synthwave, kawaii,
minimalist, esports) covering background + mascot + particles + stinger, read
`references/prompt-recipes.md`.

## Handing off / pulling in

- Pull the **palette and vibe** from the stream-brand-visual-system so every asset matches
  the coded scene — always quote the real hex values in prompts.
- Take the **asset list** from the twitch-intro-scene-director's Scene Brief so you generate
  exactly what the scene needs (no more, no less).
- Deliver finished files into the scene's `assets/` folder and tell the
  obs-browser-source-animator how each one composites (opaque bg / alpha PNG / screen-blend
  luma / looping video).
