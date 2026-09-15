# Flight 404 — drop art here

Put a PNG in this folder and it replaces the coded placeholder of the same id
the next time the game boots. Nothing is imported by hand and no manifest is
edited: `artLoader.ts` globs this folder at build time, so the workflow is
literally "put the file in the folder".

**Check a delivery before you trust it:**

```
node scripts/check-art.mjs
```

That reports, per file, whether the background is genuinely transparent,
whether the sheet divides evenly into its frames, and how the size compares
with what `docs/ASSETS-FLIGHT404.md` asked for. Both of the ways art silently
fails here — a solid background that looks perfect on a white page and paints a
box in a near-black cabin, and a sheet that slices off-centre so every frame
after the first drifts — are invisible in a preview and obvious to that script.

## Naming

| file | meaning |
|---|---|
| `seat-row.png` | one frame |
| `cross-camel@8.png` | eight frames, left to right, equal widths, no padding |

The id must match the asset list exactly. An id nothing draws yet will load
without complaint and simply never appear.

## Rules

- **RGBA with a real transparent background.** Not white. The cabin is nearly
  black and a white matte reads as a box.
- **One row per sheet**, frames equal width, zero padding — the sheet is sliced
  arithmetically as `width / frames`.
- **Walk cycles face right.** The game mirrors them for the other direction.
- **Partial delivery is fine.** Each file swaps in on its own and the coded
  version stays until it arrives, so a half-delivered set is a game where six
  things look better than they did yesterday.
