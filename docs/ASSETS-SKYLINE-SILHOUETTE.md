# The far skyline — a distance-drawn set

A short brief, for a human illustrator rather than an image generator. Twelve
files, all the same idea, and the idea is the whole job.

---

## 1. Why this exists

The skyline kit already delivered is good art and it is in the wrong place.

Measured off the delivered PNGs:

| | colours per building | luminance spread |
|---|---|---|
| `tower-a-wide` … `tower-f-old` | 47–56 | **104–133** |
| `lowrise-a-strip` … `lowrise-f-rooftop` | 44–57 | **132–192** |
| the sky they stand against | — | sits at **48–70** |

A building two kilometres back, seen through city air at dusk, does not have a
133-point luminance range. Air flattens contrast with distance — that is the
whole of atmospheric perspective — which is why a real skyline at this distance
is very nearly a silhouette with a couple of tones in it.

So those buildings read as cut-outs pasted in a line rather than as a city, and
no amount of dimming fixes it: dimming moves everything toward the sky evenly,
but it cannot *compress* a range that is six times too wide without making the
buildings disappear altogether.

**The detailed ones are not wasted.** They have been promoted to the mid-ground
of Downhill Racer, where they pass close enough for the detail to be the point —
the office blocks and walk-ups a residential street backs onto, every seventh
slot, roughly one every five seconds. That is where that drawing belongs.

This set is the replacement for the back.

---

## 2. What to draw

**Twelve buildings. Flat, low-contrast, near-silhouette.**

Six towers and six low-rise blocks, matching the twelve that already exist —
same building, drawn as it would look from two kilometres away.

### The contrast rule, which is the only rule that really matters

- **Three tones maximum per building.** Four if one of them is a handful of lit
  windows.
- **Total luminance spread across the whole building: 25–40.** Not 130.
- Everything sits **above** the sky it stands against, not below — the city is
  lit from within at this hour, so it is *slightly* lighter than the sky behind
  it, never darker.
- Concretely: if the sky is luminance 55, the building lives between about
  **60 and 95**. Nothing in the file should be darker than 45 or lighter than 110.

If you squint at the file and it reads as one soft shape, it is right. If you
can make out a window ledge, it is too much.

### What survives at this distance

- The **silhouette**. This is 95% of the job. Setbacks, a crown, a mast, a water
  tank on the roof, a stepped profile. The outline is what tells the buildings
  apart.
- **One or two large tonal blocks** — a face in shadow against a face in light.
  Big shapes only.
- **A sparse scatter of lit windows**, if you want them. Single pixels, not
  grids, not rows. Perhaps 10–20 across a whole tower. They may be a touch
  warmer than the rest, but keep them inside the luminance band above.

### What does not survive, and must not be drawn

- Window grids, ledges, mullions, balconies, signage, brickwork, panel joins.
- Hard black outlines. There is no dark edge on a distant building.
- Ground shadows or contact shading — these stand on a haze band the game
  paints, not on a surface you can see.
- Any colour saturation above about 20%. Distance desaturates as well as
  flattens; everything trends toward the sky's own hue.

---

## 3. Files

Same names as the existing set with `far-` on the front. That prefix is how the
game finds them, so it has to be exact — there is a test pinning the spelling.

| File | Size (game px) | Deliver at 3× |
|---|---|---|
| `far-tower-a-wide.png` | 28 × 40 | 84 × 120 |
| `far-tower-b-narrow.png` | 28 × 40 | 84 × 120 |
| `far-tower-c-stepped.png` | 28 × 40 | 84 × 120 |
| `far-tower-d-box.png` | 28 × 40 | 84 × 120 |
| `far-tower-e-crown.png` | 28 × 40 | 84 × 120 |
| `far-tower-f-old.png` | 28 × 40 | 84 × 120 |
| `far-lowrise-a-strip.png` | 36 × 26 | 108 × 78 |
| `far-lowrise-b-walkup.png` | 36 × 26 | 108 × 78 |
| `far-lowrise-c-industrial.png` | 36 × 26 | 108 × 78 |
| `far-lowrise-d-corner.png` | 36 × 26 | 108 × 78 |
| `far-lowrise-e-mixed.png` | 36 × 26 | 108 × 78 |
| `far-lowrise-f-rooftop.png` | 36 × 26 | 108 × 78 |

- **Drop them in `assets/art/street/skyline-kit/towers/` and `.../lowrise/`**,
  next to the originals. Nothing to register.
- **PNG, real alpha channel.** The sky shows through everywhere the building is
  not. No matte colour, no background rectangle.
- **Flat elevation, dead on.** No perspective, no visible roof surfaces, no
  side walls. A theatre flat.
- **Ground line at the bottom row of the image.** The building fills the frame
  to the bottom edge; the game stands it on the horizon.
- Buildings may be **mirrored** by the game, so avoid anything that reads wrong
  reversed (lettering, a clock face).

---

## 4. Pieces, not a strip — please read this one

The obvious way to draw a background skyline is one long tileable strip. **Do
not.** A strip repeats its entire contents every time it scrolls its own width,
and at this game's speed that is a visible loop every few seconds. It is the
exact fault that was reported and fixed once already.

The game deals a different building into each slot from a hash of the position,
mirrors adjacent twins, and never repeats until the pieces do. Twelve separate
files is what makes that work. Twelve is also enough: with mirroring it is
effectively twenty-four silhouettes, which at 30px spacing is a horizon that
does not visibly cycle.

---

## 5. Delivery is incremental

There is no all-or-nothing. Each file is used the moment it is in the folder,
and any building that has not been redrawn keeps using its detailed version,
dimmed. **You can send one and look at it.** That is the recommended way to
start: draw `far-tower-a-wide`, drop it in, and compare it against its five
neighbours still on the old art. The difference will be obvious in the running
game, which is a better brief than this document.

---

## 6. One thing to change afterwards

`SKY_SHADE` in `components/minigames/engine/streetArt.ts` currently pulls the
bands down to 0.22–0.30 to force the detailed art into the distance. Once these
land, that correction is fighting art that no longer needs it and the bands
should come back up to roughly **0.75–0.90** so the new drawings are seen as
drawn. `farSkylineShare()` in the same file reports how much of the set has
arrived.

---

## Checklist

- [ ] Twelve files, named `far-` + the existing id, spelled exactly
- [ ] 3× the sizes in §3
- [ ] Real alpha channel, no background rectangle
- [ ] Three tones per building, four with lit windows
- [ ] Total luminance spread 25–40, everything between 45 and 110
- [ ] Lighter than the sky, never darker
- [ ] No window grids, ledges, outlines or ground shadows
- [ ] Flat elevation, ground line on the bottom row
- [ ] Reads as one soft shape when you squint
