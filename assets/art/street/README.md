# Street Art — Downhill Racer & Pizza Run

Production PNG assets generated from the supplied Street Assets manifest and
style guide. The manifest remains the geometry contract; the artwork does not
reinterpret camera, dimensions, grounding, facing, frame count, animation
order, or tiling behavior.

## Delivery rules

- Every asset is RGBA PNG at exactly 3x its logical manifest size.
- Animated assets use a single horizontal row, equal frame widths, zero gutters,
  and the manifest's left-to-right frame order.
- Moving and road-standing assets face right unless the manifest says otherwise.
- Ground contact is at the bottom edge except `house-*-near`, whose ground line
  is intentionally at the top edge.
- Files flagged as tileable have pixel-identical left and right boundary columns.
- No baked drop shadows are included.

`asset-manifest.json` records the logical size, delivered size, frame count,
ground rule, and tiling flag for every required asset.

## Skyline kit

The two required skyline strips were assembled from reusable modules under
`skyline-kit/`: six towers, six low-rise buildings, rooftop clutter, five
billboards, three water towers, and six antennas. Landmark modules live under
`skyline-kit/landmarks/`.

## Visual identity

Premium handcrafted modern pixel art with late-1990s arcade silhouettes,
1990s skate-video and hip-hop energy, graffiti and sneakerhead color sense,
sun-faded wear, and slightly stupid suburban street comedy. The set deliberately
avoids military styling, guns, tactical motifs, realistic war-game palettes,
readable moving-object branding, and direct reproduction of other games.
