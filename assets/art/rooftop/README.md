# Rooftop Artillery art

**Drop PNGs straight into this folder.** Nothing to register, no manifest to
edit — a file that lands here is picked up on the next build.

The brief is **[`docs/ASSETS-ROOFTOP.md`](../../../docs/ASSETS-ROOFTOP.md)**.
Read §1.1 (this game is *not* drawn like the street games — flat elevation, 0°)
and §1.4 (two loaders, two delivery scales) before drawing anything.

## The two-minute version

| | |
|---|---|
| **Screen** | 352 × 198 logical pixels |
| **Camera** | Flat elevation, dead on. No perspective, no visible roof tops. |
| **Naming** | `name.png`, or `name@N.png` where N is the frame count |
| **Frames** | Left to right, evenly spaced, all the same width |
| **Format** | PNG with a real alpha channel. No matte colour. |
| **Ground line** | Bottom row of the image |
| **Facing** | Right. The game mirrors as needed. |

## Scale — the one thing to get right

There are **two loaders with opposite rules**, and §1.4 of the brief has the
detail. Short version:

- **Characters, shoes and thrown items → 1×.** A thrower is a **16 × 24** PNG.
  These go through the sprite registry, which draws a PNG at one image pixel per
  game pixel. A 3× file draws three times too big and there is no knob to fix it.
- **Scenery — facades, parapets, sky, roof furniture → 3×**, like the street
  set. A 20px-tall object is a 60px PNG.

If in doubt, ask before you draw a set. Getting this backwards costs a day.

## Partial deliveries are fine

Every file is used the moment it is here. Anything not yet drawn keeps its coded
placeholder, so there is never a hole — just fewer rectangles each time.

## Two known traps

1. **The id is the filename, across the whole `assets/art` tree.** A
   `gutter-gabe.png` here and another in `assets/art/characters/` are the same
   id; the loader warns and picks one arbitrarily. One file per id.
2. **Scenery must be 3× and characters 1×.** See above. They are different
   loaders with different maths.
