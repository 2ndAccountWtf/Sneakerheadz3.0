# Street art — Downhill Racer & Pizza Run

Drop PNGs here. Both games read this folder, because they share a world:
traffic, animals, street furniture, buildings, skyline, palms and the road
surface are one set used by each.

**The full brief is `docs/ASSETS-STREET.md`** — every asset has a block giving
its view, facing, ground line, frame-by-frame motion and what it must *not* look
like. Read that before generating; this file is only the drop point.

## Check a delivery before you trust it

```
npm run art:street
```

Reports per file: whether the background is genuinely transparent, whether the
sheet divides evenly into its frames, and how the size compares with the brief.
Both of the ways art silently fails are invisible in a preview — a solid
background looks perfect on a white page and paints a box in the game, and a
sheet that does not divide slices off-centre so every frame after the first
drifts sideways as it animates.

If a sheet needs straightening first:

```
npm run art:prep -- <folder-of-raw-art>
```

Finds the frames, centres each in a uniform cell, trims dead canvas and keys a
solid background to transparent.

## The four rules that cannot be fixed afterwards

1. **Two views, never mixed.** Anything that stands on the road is a **20°
   high-angle side view**. Buildings, skyline and palms are **flat dead-on
   elevations**. See §1.2 of the brief.
2. **Everything faces right.** The game mirrors; never supply a left-facing twin.
   Nothing that mirrors may carry text, numbers or logos.
3. **The bottom edge is the ground line** — except the `-near` houses, whose
   ground line is the **top** edge. See §5.2 of the brief.
4. **A standing adult is 23px**, authored at 3× (so 69px). Every object is
   measured against that and nothing else.

No baked drop shadows, and no baked directional light on anything shared — it
appears in both a sunset hill and a sodium night street.

## Naming

| file | meaning |
|---|---|
| `car-sedan.png` | one frame |
| `dog-stray@6.png` | six frames, left to right, equal widths, no gutters |

The id must match the brief exactly. An id nothing draws yet will load without
complaint and never appear — `npm run art:street` will say so.

## Note on wiring

These two games still draw with emoji glyphs and code-drawn shapes. The loader
that makes dropped PNGs appear — the one Flight 404 uses — is **not built for
them yet**. Files can land here safely in the meantime; nothing will break, and
nothing will show up until that is wired.
