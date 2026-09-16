# Flight 404 — Remaining Assets

This folder contains the 29 deliverables from the superseding “what is still
needed” document. Existing files in the parent `flight404` folder were not
overwritten.

## Geometry contract

- Sprite-sheet dimensions are the listed logical cell size multiplied by the
  exact frame count, in one horizontal row with equal cells and zero gutters.
- Every crossing faces right and is mirrored by game code.
- Sprite feet, hooves, wheels, and aisle obstacles share the bottom ground line.
- `dress-aisle` and `dress-aisle-wrecked` are 64 × 40 and seamless left-to-right.
- Every `bg-*-near` strip remains 960 × 540. Only its bottom 82 pixels contain
  the foreground lip; all pixels above y=458 are transparent.
- `aisle-crate` and `aisle-cart` are exact, non-destructive copies of the already
  delivered correctly-sized parent assets.

The supplied list intentionally leaves `bg-duck` dimensions unspecified. The
generic shared reaction is delivered as three 20 × 28 cells, matching the
established adult cabin-character scale.

See `asset-manifest.json` for exact file dimensions, cell sizes, frame counts,
tiling flags, and source aliases.
