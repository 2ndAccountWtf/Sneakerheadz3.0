# Characters

People and creatures that appear in more than one game, or that belong to the
game world rather than to one mini-game's street or cabin.

**Game-specific characters stay with their game:**

| where | what lives there |
|---|---|
| `assets/art/flight404/` | the player, mooks, hostages, Yasser, the six-enemy cast |
| `assets/art/street/` | traffic, animals, furniture — the shared road world |
| **`assets/art/characters/`** | **everything else: shopkeepers, buyers, celebrities, crowd** |

## Check a delivery

```
npm run art:characters
```

Reports per file whether the background is genuinely transparent, whether the
sheet divides evenly into its frames, and how the size compares with the brief.
Both ways art silently fails are invisible in a preview: a solid background
looks perfect on a white page and paints a box in the game, and a sheet that
does not divide slices off-centre so every frame after the first drifts.

## The rules

1. **Flat side elevation, facing right.** These are side-scroller characters —
   dead-on profile at 0°, not a 3/4 view. The game mirrors for left; never
   supply a left-facing twin, and put no text or numbers on anything.
2. **Bottom edge is the ground line.** Feet touch it. **No baked shadow.**
3. **A standing adult is 26 world units**, authored at **3× = 78px tall**. The
   canvas is exactly three device pixels per world unit, so art on that grid
   maps one-for-one and nothing is resampled.
4. **Soft neutral top-down light.** No hard key, no long cast shadows, no baked
   colour temperature — characters appear in a night cabin, a sunset hill and a
   shop interior, and any one of those baked in makes them wrong in the others.

## Naming and animation

| file | meaning |
|---|---|
| `shopkeeper-idle.png` | uses the frame count from the brief |
| `shopkeeper-idle@6.png` | six frames, explicit |

One row, left to right, **equal frame widths, zero gutters**.

Frame counts come from the brief — a file with no `@N` is sliced by that table,
so a four-frame walk cycle delivered without a suffix still animates instead of
drawing all four at once.

**Cut animation to the speed it will actually play at.** Idle runs at 6fps, a
run cycle is timed off the character's real ground speed, one-shots like a
flinch or a death play at 12–18fps **once and hold their last frame** — so the
final frame of a death is what lies on the floor for the rest of the level and
has to work as a still.

## Subfolders are fine

Organise however suits you — `crowd/`, `shopkeepers/`, whatever. The loader and
the checker both walk subfolders; the id is the filename alone, so
`crowd/tourist-idle@6.png` is just `tourist-idle`.

## Before you make a lot of these

**Tell me who they are and where they appear, and I will write the block-format
brief first** — the same treatment as `docs/ASSETS-STREET.md`, with view,
facing, ground line, per-frame motion and what each must not look like. Sizes
and perspective are cheap to state and expensive to redo.
