---
name: pixel-scene
description: Art-direct a scrolling pixel-art game scene — parallax depth, atmospheric perspective, skyline rhythm, sky gradients and value structure. Use when a background reads as flat, repetitive, evenly spaced, "low effort", or when layers do not separate. Covers this repo's canvas games (Downhill Racer, Pizza Run) and the Phaser scene (Flight 404).
---

# Making a scrolling pixel scene look composed

A background stops looking cheap for four reasons, and they are all measurable.
This is the checklist, in the order the eye notices them.

Every rule here has been earned on this codebase. The failures named are real
ones that shipped and were reported.

---

## 1. Rhythm — the thing people call "too evenly spaced"

**A uniform interval reads as a fence, not a city.** Nothing in a real skyline
is evenly spaced: buildings clump around a junction, then there is a car park,
then three more together.

The failure mode in this repo: `skyline.ts` had `density: 1` on the towers and
lowrise bands, meaning every single 30px slot was filled. Perfectly regular,
perfectly wrong, and the first thing anyone said about it.

### The fix

Vary fill probability with a **low-frequency** function of position, so the
clumping has a wavelength several times the slot spacing. Two layered sines with
incommensurable periods give a run of dense slots, then a thin patch, without
ever repeating:

```
clump(slot) = 0.5 + 0.34*sin(slot * 0.21) + 0.16*sin(slot * 0.073)
fill if slotHash(slot) < clump(slot)
```

Pick the periods so the pattern does not line up with the screen width. If a
band shows ~11 slots at once and your clump period is 11 slots, every screen
looks the same.

### Check it

- Count filled slots in windows of 8 across a few hundred slots. If the counts
  are all within ±1 of each other the band is still a fence.
- The run-length distribution should have runs of 1 **and** runs of 4+.

### Related

- **Gaps must reach the ground.** A gap that still has a roofline behind it is
  not a gap. Skip the slot entirely.
- **Vary height as well as presence.** Same clump function, different phase.

---

## 2. Value structure — the thing people call "a solid bar of colour"

**Flat fills are the tell.** A `rect()` of one colour across a whole band is the
single loudest signal that nobody art-directed a scene.

Canvas 2D has `createLinearGradient` and it costs nothing. This repo already
uses `createRadialGradient` in Flight 404's lighting, so there is no excuse and
no new dependency.

```js
const g = ctx.createLinearGradient(0, top, 0, bottom);
g.addColorStop(0, topColour);
g.addColorStop(1, bottomColour);
ctx.fillStyle = g;
ctx.fillRect(x, top, w, bottom - top);
```

### Where gradients belong

| Element | Direction | Why |
|---|---|---|
| Sky | light at the horizon → dark at the top | that is what sky does |
| Distant ground / haze | lighter at the top, darker toward the viewer | air thins with proximity |
| Road | darker at the top, slightly lighter at the bottom | light falls off with distance |
| Any glow | radial, never a rect | a rect of light is a rect |

### Pixel art and banding

A smooth gradient across 40px in a palette-limited scene will band. Two options,
and this repo prefers the second:

1. Let it band and choose stops so the bands land where you want them.
2. **Dither the transition** — a 1px checker of the two adjacent values over the
   boundary rows. Cheap, period-correct, and it reads as intentional texture
   rather than as a compression artefact.

Never smooth-scale pixel art to hide a gradient. `imageSmoothingEnabled` stays
`false`, always.

---

## 3. Atmospheric perspective — the thing that makes layers separate

**Contrast collapses with distance.** This is not a stylistic choice; it is what
air does, and getting it wrong is why a far layer can look pasted on.

Measured on this repo's delivered skyline kit: each tower had ~50 colours and a
luminance spread of 104–192, against a sky sitting at 48–70. That art is drawn
for close range. At two kilometres a building lives within about ±15 luminance
of the sky behind it.

### The rules

- **Further = lower contrast, lower saturation, and pulled toward the sky's own
  hue.** All three, not just one.
- Compositing a layer at alpha *a* over the sky moves it *a* of the way from the
  sky colour to its own — so alpha is a legitimate atmospheric control. A spread
  of 133 at alpha 0.28 collapses to 37.
- **Dimming is not the same as flattening.** Dimming toward black slides a range;
  it does not compress it. Blend toward the *sky*, not toward black.
- A distant city at night is *lighter* than the sky behind it. A distant hill at
  dusk is *darker*. Know which one you are drawing.

### Check it

Sample the rendered canvas and print the luminance range per band. If a far
band's range overlaps a near band's, they will not separate no matter how you
arrange them.

---

## 4. Depth ordering — the contradiction the eye catches instantly

**Draw order is depth, and parallax factor is depth.** If they disagree, the
picture contradicts itself and everyone sees it even if they cannot name it.

The failure here: landmarks were painted last — in front of the lowrise band —
while scrolling *slower* than it. A 96px sign ended up looking nearer **and**
smaller than a 36px shopfront.

### The rules

- Bands sorted by parallax factor, painted back to front. There is a test.
- **A more distant band has a higher ground line.** The horizon is up-screen.
- **Every layer's scroll rate is a fraction of one world number.** Deriving each
  from its own multiplier is how a background ends up outrunning the foreground
  — which happened here and was most of why a run felt sickening.
- Nothing may float. If a band's ground line is above the next layer's top edge,
  there is a hole, and the eye reads the buildings as hanging in the air.

---

## 5. Working method

**Measure, do not squint.** Every conclusion in this file came from
instrumentation, and every time a judgement was made by eye it was wrong.

### Look at the real thing

Node cannot decode a PNG, so a headless test proves nothing about how a scene
looks. Render it in a real browser:

1. Write a throwaway `art-probe.html` at the repo root that imports the game
   module, steps it, and draws to a canvas.
2. `npx vite --port 5199 --strictPort`
3. Drive it with Playwright (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
   `--no-sandbox`), screenshot the canvas element.
4. **Delete the probe file before committing.**

### Sample pixels, not impressions

`ctx.getImageData` in the page gives you the truth. Print a column of colours
down the screen and you will find the flat band, the void, the layer that is not
drawing.

**One trap that cost an hour:** obstacles in Downhill Racer are drawn inside the
road's rotate-and-zoom transform, so an object's world x is *not* its screen x.
Sampling at the untransformed coordinate will convince you a sprite is missing
when it is fine.

### Zoom in

A 320×180 canvas shown at 960px hides everything. Crop a 90×60 region to a
second canvas at 8× with `imageSmoothingEnabled = false` and screenshot that.

---

## 6. Constraints that are not negotiable here

- **Deterministic.** The scene is a pure function of scroll position. No
  `Math.random` in a draw path — the same world position must give the same
  picture, on every machine and every replay.
- **No new dependencies.**
- **`imageSmoothingEnabled = false`** on every drawing context, every time.
- **Delivered art is authored at 3×** for the street set (`docs/ASSETS-STREET.md`)
  and drawn at the sizes that document gives. Do not invent a size; look it up.
- **The tests stay green.** `npm test` and `npm run build`, both, before you
  claim anything.
- **Cosmetic changes must not touch the simulation.** Rendering reads state; it
  never writes it.

---

## 7. What "done" looks like

- Squint at the screenshot. Layers should separate into distinct value masses.
- No band is one flat colour.
- No interval is obviously regular.
- Nothing floats; every layer stands on something.
- A run of 10 seconds does not show the same silhouette twice in the same place.
- The numbers back it up: per-band luminance ranges that do not overlap, and a
  fill-density histogram that is not flat.
