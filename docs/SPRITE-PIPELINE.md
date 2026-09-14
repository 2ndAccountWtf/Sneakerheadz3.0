# Turning generated art into sprites this game can use

You have been making art and none of it has reached the screen yet. Two
reasons, and neither is the art:

1. **Raw model output is not a game asset.** The character drifts inside each
   frame — different size, different position, different foot height. Load
   those frames directly and it bobs and slides while standing still.
2. **Nothing in the hoops renderer reads a PNG.** That is a separate job, on
   my side, and it is next.

This document is about (1). It is adapted from the pipeline published in
[`chongdashu/ai-game-spritesheets`](https://github.com/chongdashu/ai-game-spritesheets)
(MIT, explicitly free to reuse). Their framing is worth repeating:

> Image gen ≈ 20% of the work. The other 80% is the pipeline.

## What the platforms actually are

Worth knowing before paying for one. Their own docs give it away: image
generation is GPT Image 2.0 or `nano-banana-2-lite`, walk cycles go through
fal.ai to a video model, background removal is Bria or remove.bg. Spriterrific
takes a FAL key and exposes `imageModelAlias` / `videoModelAlias` as plain
parameters. The model layer is commodity and swappable by design.

What you are actually paying for is the pipeline around it — frame picking
and normalization. `tools/sprite-normalize.py` in this repo does the
normalization half, offline, with no key and no credits.

Note also that their `pixelSnap` defaults to **false**, and their README has a
section on "mixels vs real pixels". Their output is downscaled AI art that
reads as pixel-ish. That is a legitimate choice, but it is not what this game
looks like, which is why our normalizer has a palette step theirs does not.

## What to generate

Our sprites are **one row, left to right, equal width, no padding** — not the
5×2 grid the source pipeline uses. `systems/sprites/registry.ts` globs
`assets/art/<category>/<id>.png`, or `<id>@<n>.png` when the frame count
differs from the coded sprite it replaces.

The rules that decide whether frames normalize cleanly:

| Rule | Why |
|---|---|
| **Flat `#FF00FF` magenta background** | Keys out to real alpha in one pass. A "looks white" background does not. |
| **One action per sheet** | idle, walk, attack, block — each its own file. Mixing them defeats scale correction. |
| **Same character, same outfit, same camera across every action** | Scale correction matches heights; it cannot fix a different character. |
| **Feet on a consistent line, full body in frame** | Foot anchoring is what stops the bobbing. A cropped ankle has nothing to anchor. |
| **Neutral pose for the anchor frame** | No weapon, no effects, no motion blur — those bake in and then flicker between frames. |
| **8–12 frames per action** | Below 6 reads as a flipbook; above 16 is work you will not see at 32px. |

Generate large and let the tool downscale — 256×256 per frame is what the
source pipeline uses and it gives the normalizer room to work. Do **not**
pre-downscale to 32×32 yourself; scaling after alignment is much cleaner than
before it.

## Running it

```bash
# a folder of frames
python3 tools/sprite-normalize.py ~/frames/ out/ \
    --id player-hoops --cell 32x32 --chroma FF00FF --palette

# one sheet laid out 5 across, 2 down
python3 tools/sprite-normalize.py attack.png out/ \
    --id fighter-attack --cell 64x64 --sheet 5x2 --chroma FF00FF --palette
```

It writes three things:

- `<id>@<n>.png` — the strip, ready for `assets/art/<category>/`
- `<id>-contact.png` — every frame side by side at 4×, for spotting drift
- `<id>-preview.gif` — the animation at real size

**Look at the contact sheet before moving anything into `assets/`.** That is
the whole point of it. If frames still jump around there, the input needs
fixing, not the tool.

## What it does, in order

Alpha-bounding-box frame recovery (never trusting the nominal grid) → chroma
key to real alpha → measure width, height, centre-x and foot baseline per
frame → scale every frame to one shared visible height → re-paste onto a fixed
cell with identical centre-x and foot baseline → pack to a single-row strip →
emit contact sheet and GIF.

`--palette` adds a step the source pipeline has no need for: snapping every
pixel to the 32 colours in `systems/sprites/palette.ts`, the same set every
coded sprite in this game already draws from. Art that skips it is the art
that looks bolted on next to the sprites around it.

Verified on deliberately broken input — six frames drifting 15px in foot
height, 14px in centre-x and 12px in body height came out at 0px spread on all
three.
