# Rooftop assets — Rooftop Artillery

**Rooftop Artillery** (`components/minigames/RooftopArtillery.tsx`) is QBasic
GORILLA.BAS with a shoe in your hand: two throwers on opposite towers of a
procedurally generated night skyline, lobbing footwear at each other across a
crosswind while the buildings between them lose chunks.

**This document is written to be fed to an image generator.** Every asset is a
block with the same fields, and each field exists because it is a mistake that
cannot be corrected after generation:

- **What** — the object.
- **View** — the camera angle. Mixing angles is unfixable.
- **Faces** — which way it points, and whether the game mirrors it.
- **Ground** — which pixel row is the contact point.
- **Frames** — what changes frame by frame, and how long the loop has to run.
- **Not** — the specific wrong thing a generator will otherwise produce.

**Every number below was read out of the code, not chosen.** Where a number had
to be chosen (a tile size, a repeat pitch) it is marked *chosen* and the
measured range it has to satisfy is given next to it. Where the code could not
answer a question at all, it is in **§11 Open questions** rather than guessed.
An admitted gap is cheaper than an invented number.

---

# PART ONE — THE RULES

Read all of Part One. Every rule here has an asset below that depends on it.

## 1.1 This game is NOT drawn like the street games

`docs/ASSETS-STREET.md` describes a **20° high-angle view of a road**. Do not
carry any of that across. Rooftop Artillery is drawn the way Flight 404 is
drawn: **flat elevation, dead-on, 0°.**

Proof, from `drawBuildings` and `drawSky`:

- A building is one call — `rect(ctx, b.x0, b.roofY, bw, bh, color)`. A plain
  axis-aligned rectangle. There is no second rect for a side wall and no
  parallelogram for a roof plane. **Nothing in this scene has a top surface.**
- The street is `rect(ctx, 0, GROUND_Y, VW, VH - GROUND_Y, '#05070c')` plus one
  horizontal `line`. It is a flat band, not a receding plane.
- The moon is `circle(...)` — a circle, not an ellipse. Under the street games'
  high angle a flat disc would be squashed.
- Throwers are drawn by `actor(...)`, which bakes a 16 × 24 **side-profile**
  character grid.

So: **you are looking at the side of the city, square on, like a theatre flat.**
No vanishing point, no convergence, no foreshortening, no visible top faces, no
squashed ellipses anywhere.

If an asset would look right in a side-scrolling platformer, it is right here.

## 1.2 The screen, exactly

The component's own constants: `VW = 352`, `VH = 198`, `HUD_H = 13`,
`SKY_TOP = 13`, `GROUND_Y = 182`.

```
  y=0    ─────────────────────────────────────────────  top of canvas
         HUD bar — rgba(6,8,12,0.86), score and round
  y=13   ═════════════════════════════════════  SKY_TOP
         sky band 1 — #141a30, 60 deep                   stars live in y 13..83
  y=73   ─────────────────────────────────────
         sky band 2 — #0e1526, 40 deep
  y=113  ─────────────────────────────────────
         sky band 3 — #0a1020, down to the street
         (all three are behind the buildings)

         roof lines land anywhere in y=64..148
         the two towers' roof lines land in y=64..120

  y=178  ░░ aim HUD panel covers y=178..198 while you are aiming ░░
  y=182  ═════════════════════════════════════  GROUND_Y — street level
         street band — #05070c, 16 deep
  y=198  ─────────────────────────────────────────────  bottom of canvas
```

The whole playfield is **352 × 198 logical pixels**. There is no camera, no
scroll and no parallax — `drawArtillery` draws the entire world in world
coordinates every frame, with one global `ctx.translate` for screen shake.

## 1.3 Scale — pinned to one number

**A thrower is 24 logical pixels tall.** Measured: `actor()` is called with
`scale: 1`, and `actor` computes `px = scale = 1` logical pixel per authored
pixel against a `SPRITE_H = 24` grid. 24 × 1 = 24.

(If no sprite is registered for the id, `actor` falls back to `figure()` at
`px * SPRITE_H = 24` total height, whose hair line actually tops out at 21px.
The block fallback is therefore 3px shorter than the sprite. **24 is the
number to build to.**)

| thing | logical px | measured from |
|---|---|---|
| **a thrower, head to feet** | **24 × 16** | `actor(..., scale: 1)`, `SPRITE_W/H = 16/24` |
| thrower's hit circle | **r = 7**, centred on the **feet** | `HIT_R = 7`, `collideAt` |
| a thrown shoe | 33.6 × 16.8 | `drawSpinning(def 24×12, px = 1.4)` |
| a thrown AM/PM item | 24 × 24 | `drawSpinning(def 16×16, px = 1.5)` |
| building width | 30.0 – 54.0 | `BUILDING_MIN_W / MAX_W` |
| building height | 34.0 – 118.0 | `BUILDING_MIN_DEPTH / MAX_DEPTH` |
| the two towers' height | 62.0 – 118.0 | `TOWER_MIN_DEPTH = 62` |
| buildings on screen | 7 – 12 | `createSkyline`, x from −4 to 356 in 30–54 steps |
| a window | 3 × 5 | `rect(ctx, wx, wy, 3, 5, ...)` |
| window row pitch | **exactly 10** | `wy = b.roofY + 5 + r * 10` |
| window column pitch | 5.4 – 10.2, non-integer | `(bw - 6) / (cols - 1)` |
| crater radii | **8, 9, 10, 12, 19** | `craterR` per weapon in `PROFILES` |
| street band | 352 × 16 | `rect(0, 182, 352, 16)` |
| the moon | 20 × 20 | two circles, r = 10 and r = 9 |
| debris fleck | 2 × 2 | `rect(q.x - 1, q.y - 1, 2, 2, ...)` |
| aim hint dot | r = 0.9 | `circle(d.x, d.y, 0.9, ...)` |
| projectile trail dot | r = 0.8 | `circle(pt.x, pt.y, 0.8, ...)` |

Note the building widths and heights are **continuous floats**, not integers —
`BUILDING_MIN_W + rng() * (MAX_W - MIN_W)`. Nothing in the skyline lands on a
whole-pixel boundary, which is why the facade is asked for as a repeating tile
rather than as fixed-size building plates.

## 1.4 Delivery scale — the answer is different for two halves of this set

`ASSETS-STREET.md` asks for everything at **3×**. That is **only half true
here**, and getting it wrong is a whole day lost. There are two loaders in this
repo and they scale delivered art by completely different rules.

### Path A — the sprite registry, `systems/sprites/registry.ts`

Globs **`assets/art/**/*.png`** and keys files by **sprite id**. `bakeSprite`
asks it for an override *before* it paints the coded character grid, so
dropping `gutter-gabe.png` anywhere under `assets/art/` replaces Gutter Gabe
everywhere in the game — store cards, canvas games and the Phaser scene alike.

**This path draws the PNG at its own pixel size.** `artOverride(id, scale)`
returns the decoded image unscaled when `scale === 1`, and `drawSprite` then
draws it at `px / bakeScale`. In Rooftop Artillery, `actor(..., scale: 1)`
gives `px = 1` and `bakeScale = Math.max(1, Math.round(1)) = 1`, so the draw
scale is exactly **1 PNG pixel = 1 logical game pixel**.

> **So everything on Path A is delivered at 1×.** A thrower is a **16 × 24
> PNG**. A shoe is **24 × 12**. An item is **16 × 16**. A 3× file on this path
> draws three times too big and there is no option anywhere to correct it.

### Path B — the street art loader, `components/minigames/engine/streetArt.ts`

Globs **`assets/art/street/**/*.png`** and **`assets/art/characters/**/*.png`**
only, and keys files by filename. Its `sprite()` / `panel()` / `strip()` scale
art to a size the game asks for in game pixels, so extra source resolution is
free and is used. `tile()` divides by an explicit `ART_SCALE = 3`.

> **So everything on Path B is delivered at 3×,** exactly as
> `ASSETS-STREET.md` says. A 24px-tall object is a 72px PNG. Every file already
> in `assets/art/street/` is 3× — `car-sedan.png` is 102 × 57 for a 34 × 19
> object — so this is confirmed by the delivered set, not only by the code.

### What to actually do

**Author on the 1× pixel grid. Export the 3× master. Produce the 1× copies for
Path A by nearest-neighbour thirding** — `scripts/prep-art.mjs in.png --scale
0.333334 --out ...` does exactly that and nothing else. A 3× master that was
drawn on the 1× grid thirds back losslessly; one that was drawn freehand at 3×
does not, and you will have to redraw it.

| asset family | path | deliver at | example |
|---|---|---|---|
| throwers, opponents | A | **1×** | `16 × 24` |
| shoes in flight | A | **1×** | `24 × 12` |
| AM/PM items in flight | A | **1×** | `16 × 16` |
| sky, moon, facades, parapet, street | B | **3×** | a 24px object is a 72px PNG |
| rooftop furniture (reused street kit) | B | **3×** | already delivered at 3× |
| effects (reused street kit) | B | **3×** | already delivered at 3× |

## 1.5 Where files go on disk

- **Path A:** anywhere under `assets/art/`. Use **`assets/art/rooftop/`** for
  anything specific to this game. The id is the filename, so
  `assets/art/rooftop/gutter-gabe.png` and `assets/art/characters/gutter-gabe.png`
  are the same id and the loader logs `two files claim the sprite id` and uses
  the first it happens to see. One file per id, across the whole tree.
- **Path B:** **`assets/art/street/` only.** `streetArt.ts`'s glob does not
  include `assets/art/rooftop/`, so a facade dropped there is invisible to
  `sprite()`, `tile()` and `strip()` no matter how correct the file is. This is
  a real trap: the file loads (the sprite registry picks it up) and still never
  draws.

## 1.6 Naming and frame counts

`name@N.png`, where **N is the frame count**. Frames are one row, left to
right, **equal widths, zero gutters**, no padding.

A file with **no `@N`** is read differently by the two loaders, which is worth
knowing before you name anything:

- **Path A** falls back to the frame count of the *coded* sprite with that id,
  or 1 if there is no coded sprite. So a 4-frame `player.png` with no suffix
  happens to slice correctly, because the coded `player` has 4 frames — and a
  2-frame one does not.
- **Path B** assumes **1 frame** unless the id is in `UNMARKED_FRAMES`.

**Always write the `@N`.** Both loaders check that the width divides by the
frame count and, when it does not, log a warning and demote the sheet to a
single frame — which draws the whole strip at once and looks like a rendering
fault rather than the naming fault it is.

## 1.7 Tiling

Two different tiling modes exist in `streetArt.ts` and they are not
interchangeable:

- **`tile()`** repeats the art **at its own authored pixel size in BOTH axes**
  (`tw = sheet.fw / 3`, `th = sheet.fh / 3`), clipped to a rectangle. Art drawn
  in this mode must be seamless **left↔right AND top↕bottom**, because the
  rectangle it fills is taller than one tile.
- **`strip()`** scales the art to the **height of a band** and repeats it
  horizontally only. Art drawn in this mode must be seamless **left↔right
  only**, and its authored height is a proportion, not a size.

In this set:

| asset | mode | seams that must be invisible |
|---|---|---|
| `roof-facade-a…d` | `tile()` | **L↔R and T↕B** — buildings are 34–118 deep and one tile is not |
| `roof-parapet` | `strip()` | L↔R |
| `roof-base-course` | `strip()` | L↔R |
| `street-band` | `strip()` | L↔R |
| `sky-rooftop-night` | neither — one plate, drawn once | none |

Keep distinctive features away from both edges of anything tileable. A strip
that repeats an obvious mark every 32px becomes a visible drumbeat the moment
there are eleven buildings wearing it.

## 1.8 Facing and mirroring

**Everything faces right.** The game mirrors.

Measured: `drawArtillery` sets `facing = side === 0 ? 1 : -1`, and `actor`
passes `flip: facing === -1` into `bakeSprite`, which mirrors the baked sheet
frame by frame. **The left thrower (you) is drawn as authored; the right
thrower (the opponent) is the same art mirrored.**

Consequences:

- **No text, numbers or logos on any character or projectile.** They are
  backwards half the time. The only things that never mirror are the sky, the
  facades, the parapet and the street band — signage belongs there.
- Asymmetric details flip. A patch on the left sleeve becomes a patch on the
  right sleeve. That is fine; just do not build the read of a character on it.

Projectiles are **not** mirrored — they are **rotated**. `drawSpinning` applies
`rotation = Math.atan2(w.proj.vy, w.proj.vx)`, the direction of travel. See
§3.0, because this is currently producing a shoe that flies heel-first.

## 1.9 Ground lines — there are two, and one of them is the trap

**For throwers and anything standing on a roof: the bottom edge of the image is
the contact point,** and it sits on the roof line. Measured: baked sprites have
`anchor = { x: 0.5, y: 1 }` (bottom-centre) and `actor` is called at
`(th.x, th.y)` where `th.y` is `building.roofY`.

**The roof line is the TOP EDGE of the building rectangle.** There is no roof
surface. A building is drawn from `roofY` down to `GROUND_Y`; the thrower's
feet are on row `roofY` exactly, which is the first row of the building. So the
scene is a figure standing on the top edge of a flat slab, seen from the side —
not a figure standing on a roof deck you can see the surface of.

This is the single most likely thing to come back wrong: a generator asked for
a "rooftop" draws a receding roof deck with an air-conditioning unit sitting on
it in three-quarter view, and **there is nowhere in this game for that to go.**

**Never bake a drop shadow.** `actor()` already draws its own soft ellipse —
`shadow(ctx, x, y, 3.2, 1.1, 0.4)`. A baked one double-darkens.

## 1.10 Lighting — a blue night with exactly one warm light in it

Read straight off `drawSky`, `drawBuildings` and `PAL`:

| element | colour |
|---|---|
| canvas clear | `#050810` |
| sky, body | `#0a1020` |
| sky, upper band (y 13–73) | `#141a30` |
| sky, mid band (y 73–113) | `#0e1526` |
| stars | `rgba(255,255,255,0.55)` |
| moon | `#e7ecf6` |
| building fills (4 shades) | `#141c25` `#182430` `#101822` `#1a222c` |
| building outline | `rgba(0,0,0,0.5)`, 1px |
| **lit window** | **`#ffcf6b`** |
| unlit window | `#232c38` |
| street | `#05070c` |
| kerb line | `#2a3340` |
| concrete debris | `#9aa4ad` |
| player accent | `#00e5c0` (teal) |
| opponent accent | `#ff2e88` (magenta) |

So: **deep blue-black city night, an hour past dusk. The only warm light in the
entire scene is window amber.** There is no sun, no sodium, no neon, no
coloured rim light.

**The game applies no tint and no distance dimming to anything.** This matters:
`streetArt.ts`'s `drawSkyline` dims its far bands to 55–78% via `SKY_SHADE`,
and Flight 404 dims its far residents to 62% — **Rooftop Artillery does
neither**. There is one skyline plane, no parallax, no depth fog. Deliver every
scenery asset at **final brightness**, dark enough to sit in that palette
already, because nothing downstream will darken it for you.

The two runtime alpha changes that do exist, so you do not double them in:

- A knocked-off thrower fades to `1 - 0.35 = 0.65` alpha over the tumble.
- A projectile trail dot is drawn at 5–15% alpha.

## 1.11 What happens if only half of it arrives

Nothing breaks, and nothing waits. Both loaders decode asynchronously and the
game draws from frame one; a file swaps in mid-frame when it decodes.

**Path A is a three-level fallback**, per sprite id:

1. A PNG in `assets/art/**` under that id → drawn.
2. Otherwise the coded character grid in `data/sprites/*.ts` → baked and drawn.
3. Otherwise `figure()` — the block humanoid — so the character is still
   visible and still in the right place.

**Path B falls back to the code that is there now.** `sprite()` draws the emoji
glyph it was given; `sprite2()`, `panel()`, `tile()` and `strip()` return
`false` and the caller keeps its coloured rectangle. Today that means the flat
`rect` skyline this document is proposing to replace.

So a half-delivered set is a game where six things look better than they did
yesterday, not a game with holes in it. **Deliver in any order.**

## 1.12 Two Path-A rules that will cost you a day if you miss them

**Palette swaps are ignored by delivered PNGs.** `artOverride` returns the
image and `bakeSprite` never reaches the swap code. Two consequences:

- **The white hit-flash stops working.** `actor({ hurt: true })` is implemented
  as `HURT_SWAP`, a palette swap. A delivered thrower PNG **will not flash
  white when it is hit** — it will simply tumble in its normal colours. If the
  flash is wanted with delivered art, the character needs its own hit frames.
- **A delivered shoe replaces every colourway of that silhouette.** The 45
  sneakers in the game resolve to 10 archetype silhouettes plus a per-model
  `PaletteSwap`. Drop `shoe-lowtop.png` and all 45 low-top colourways become
  that one look, everywhere in the game. `registry.ts` provides `overrideId`
  for per-colourway files (`shoe-lowtop-panda.png`), but `drawSpinning` in this
  game passes no `variant`, so only the generic id is ever consulted. **Do not
  deliver shoe archetype PNGs unless one look for all colourways is acceptable.**

**Multi-frame character art will not animate in this game as the code stands.**
`drawArtillery` calls `actor()` without `frame`, `stride` or `elapsed`, so
`actor` computes `frameAt(baked, 0)` — **frame 0, forever**. Frames 2..N are
never shown. Any sheet below with more than one frame is flagged with what has
to change for it to play. **Frame 0 of every sheet must work as a standalone
still.**

## 1.13 Format

- **PNG, RGBA, genuinely transparent background.** Not white, not a
  checkerboard, not a matte colour. `scripts/check-art.mjs` checks this
  mechanically and it is the failure that looks perfect in a preview and paints
  a light box into a near-black city.
- Trimmed to content. No padding, no margin, no border.
- Sheets one row, equal frame widths, zero gutters, left to right in time order.
- Run `node scripts/check-art.mjs assets/art/rooftop` (and `.../street`) after a
  drop. It reports dimensions, alpha, transparency and frame division per file.

## 1.14 The animation budget — every duration the simulation actually holds

Cut loops and one-shots to these. All of them are read from the constants and
the phase machine in `stepArtillery`.

| beat | duration | measured from |
|---|---|---|
| round intro hold | **1.2 s** | `ROUND_INTRO_HOLD` |
| round intro banner | 1.4 s (1.6 s on round 1) | `shout(..., 1.4)` / `createWorld` |
| opponent "lining up" | **0.85 s** | `AI_THINK_TIME` |
| player aim | unbounded — player-controlled | `phase === 'aim'` has no timer |
| aim arm oscillation | **1.571 s** per cycle | `0.6 + 0.2 * Math.sin(w.t * 4)` → 2π/4 |
| full angle sweep, 8°→82° | 1.345 s | `(82−8) / ANGLE_RATE 55` |
| full power sweep, 4→100 | 1.067 s | `(100−4) / POWER_RATE 90` |
| projectile flight | 0.3 – **6.0 s** hard cap | `if (p.t > 6) resolveImpact(...)` |
| miss impact hold | **0.6 s** | `IMPACT_HOLD` |
| direct-hit hold | **1.7 s** | `HIT_HOLD` |
| **knockdown tumble** | **1.7 s** | `fallProgress = falling / HIT_HOLD` |
| white freeze-flash | **0.3 s**, 55% → 0% | `clamp(w.phaseT / 0.3, 0, 1)` |
| screen shake, direct hit | 0.45 s | `shake 9`, decays at 20/s |
| screen shake, building hit | 0.15 s | `shake 3` |
| screen shake, ground/out | 0.075 s | `shake 1.5` |
| debris fleck lifetime | 0.5 – 0.9 s | `life: 0.5 + rng() * 0.4` |
| direct-hit banner | 1.8 s | `shout(..., 1.8)` |
| commentary line | 2.6 s (3.0 s at match start) | `say()` / `createWorld` |

**The knockdown is worth spelling out** because it is the only real character
animation in the game and the code does most of it. Over its 1.7 s the loser is
translated **46 px sideways** (away from the shooter), **90 px down** on a
squared curve, **rotated 2.2 radians ≈ 126°**, and faded to 65% alpha. All of
that is applied by `ctx.translate` / `ctx.rotate` / `globalAlpha` around the
sprite. **Do not draw a tumble.** Draw one pose and let the code throw it.

---

# PART TWO — THE ASSETS

---

## 2. The throwers

Both figures are drawn by the same call:

```
actor(ctx, side === 0 ? 'player' : (w.opponentSpriteId ?? 'rival'), 0, 0, {
    facing, scale: 1, kit: side === 0 ? KIT.player : KIT.rival,
    armUp: w.phase === 'aim' && side === 0 ? 0.6 + 0.2 * Math.sin(w.t * 4) : 0.15,
    hurt: th.falling > 0,
});
```

So: **16 × 24, Path A, 1×, feet at bottom-centre, authored facing right.**

### 2.0 The states the simulation actually has

`type Phase = 'roundIntro' | 'aim' | 'thinking' | 'flight' | 'impact' | 'over'`,
plus a per-thrower `falling` counter. Mapped to what is on screen:

| phase | you (left) | them (right) |
|---|---|---|
| `roundIntro` | stand | stand |
| `aim` | **aim** — `armUp` rises and falls, 1.571 s cycle | stand |
| `thinking` | stand | stand — **the opponent has no aim pose at all**, `armUp` is the same 0.15 as standing |
| `flight` | stand | stand |
| `impact` | stand, or **tumble** if hit | stand, or **tumble** if hit |
| `over` | frozen on the last frame | frozen on the last frame |

**There is no fire/release state, no celebrate and no lose.** `fire()` launches
the projectile and switches straight to `'flight'` in the same tick — there is
no window to play a throw in. `'over'` returns immediately from `stepArtillery`
and the React `MiniGameResult` overlay covers the canvas, so a victory pose
would never be seen. Those three are in §2.4 under a heading that says what has
to change first; **do not draw them speculatively.**

Also: `armUp` is only read by the `figure()` block fallback. The sprite path
ignores it entirely. So today the aim wind-up is **only visible on characters
that have no art**, which is backwards and is noted in §11.

### `roof-thrower-idle` — 16 × 24, 1 frame
- **What:** A street kid standing on a roof edge in a blue night, one sneaker held loosely at the hip, weight on the back foot, looking across the gap. Casual, not braced — this is the pose held during the round intro, during the opponent's turn and for the whole six seconds a shoe is in the air, so it has to be comfortable to look at.
- **View:** Flat side elevation, 0°. Full profile. No three-quarter turn of the shoulders, no face toward the camera.
- **Faces:** Right. **The game mirrors it for the right-hand thrower** — so nothing readable, no lettering on the shirt, no asymmetric read.
- **Ground:** Bottom edge, row 23. Both feet on it. The contact row sits on the top edge of the building slab.
- **Frames:** One. The game shows frame 0 and nothing else (§1.12).
- **Not:** Not three-quarter. Not standing on a visible roof deck — there is no deck, the building has no top surface. Not holding a weapon at the ready; not a combat stance. Not taller than 24px: the head must be inside the grid, because there is no bleed room.

### `roof-thrower-aim` — 16 × 24, 4 frames
- **What:** The same figure winding up: throwing arm drawn back and up past the ear, shoe in hand, front foot planted, torso coiled toward the target. The entire read of the aim state.
- **View / Faces / Ground:** As `roof-thrower-idle`. Right-facing, feet at the bottom edge.
- **Frames:** Four frames covering **one 1.571-second cycle** — the simulation oscillates `armUp` between 0.4 and 0.8 on `sin(t * 4)`, which is 2π/4 = 1.571 s. So: 1 arm at its lowest · 2 rising · 3 arm at its highest · 4 falling. **Seamless 4 → 1**, and the cycle is symmetric, so frames 2 and 4 are the same height going opposite ways. That is a playback rate of **2.5 fps** — slow, a breath, not a windmill.
- **Requires wiring:** `actor()` is called without `elapsed`, so only frame 1 plays today. Frame 1 must work as a still, and it should be the *low* end of the wind-up so a static aim pose does not look like a freeze on the peak.
- **Not:** Not an overhead pitcher's windup with the leg up — the figure never leaves 16px of width. Not aiming a launcher; the shoe is thrown by hand.

### `roof-thrower-hit` — 16 × 24, 1 frame
- **What:** The instant of being hit: head snapped back, arms flung out and up, knees buckling, feet leaving the roof. This is the pose the code then throws 46px sideways, 90px down and spins 126° over 1.7 seconds.
- **View:** Flat side elevation. **The figure must read upside-down and at every angle in between**, because it rotates through 126° while falling. Keep the silhouette legible from any rotation — no detail that only works the right way up.
- **Faces:** Right (mirrored for the right-hand thrower). The loser is thrown **away from the shooter**: `fallDir` is −1 for the left thrower and +1 for the right.
- **Ground:** Bottom edge, same anchor as the idle, because the rotation happens about that anchor. **Do not re-centre this one** — a different anchor makes it pivot around its ankles instead of tumbling.
- **Frames:** One. The code supplies the entire 1.7 s of motion.
- **Not:** Not a tumble sheet — the translate/rotate is already written and a baked tumble fights it. Not a death; this is knocked-off-a-roof slapstick. Not white-flashed: the flash is a palette swap that delivered PNGs bypass (§1.12), so if you want the flash it has to be *in* this file, and then it is permanent for all 1.7 s, which is probably worse.

### 2.1 The opponents — 8 files, 16 × 24 each

`systems/opponents.ts` lists exactly eight NPCs whose `games` array contains
`'rooftop-artillery'`. Each has a `spriteId` that this game passes straight to
`actor()`:

| sprite id | name | coded frames / fps | skill |
|---|---|---|---|
| `the-game` | The Game | 2 @ 8 | 0.45 |
| `gutter-gabe` | Gutter Gabe | 2 @ 5 | 0.62 |
| `wiz-k` | Wiz K | 2 @ 4 | 0.38 |
| `scalper-sid` | Scalper Sid | 2 @ 4 | 0.70 |
| `bro-jogan` | Bro Jogan | 2 @ 6 | 0.55 |
| `grandma-laces` | Grandma Laces | 2 @ 4 | 0.80 |
| `yasser` | Yasser Abbasfat | 3 @ 8 | 0.30 |
| `clerk` | The AM/PM Clerk | 2 @ 6 | 0.45 |

**All eight already exist as coded character grids** in `data/sprites/cast.ts`
and `data/sprites/characters.ts`, and they are shared with Street Brawl, Hoops,
Darts and the store. **They are a lower priority than the scenery**, and
re-rendering them is a decision about the whole game's cast, not about this
mini-game. If they are re-rendered:

- **View:** Flat side elevation, 16 × 24, feet at the bottom edge, facing right.
- **Frames:** Match the coded frame count exactly, or write the `@N`. Frame 0 is the only one this game shows.
- **Not:** Do not change the silhouette language. `cast.ts` documents the shared grid — hair rows 1–2, head 3–7 with eyes on row 5, neck 8, torso and arms 9–15, legs 16–21, shoes 22–23 — and a character that breaks it stops looking like it belongs next to the others.

### `rival` — 16 × 24, 1 frame — **currently missing**
- **What:** A generic opponent for the case where the game was started without an NPC. `drawArtillery` falls back to the id `'rival'` — and **no sprite is registered under `'rival'` anywhere in `data/sprites/`**, so "Some Guy" is always drawn as the magenta block figure while the eight named opponents get real sprites.
- **View / Faces / Ground / Frames:** Exactly as `roof-thrower-idle`. Magenta kit (`#ff2e88`) rather than teal, darker skin (`KIT.rival` uses `PAL.skinDark`), no face you would recognise.
- **Not:** Not a named character — this is the anonymous one. Nothing distinctive enough that it reads as a specific NPC when it turns up as the stand-in.

---

## 3. Projectiles

### 3.0 Read this before drawing anything that flies

`drawSpinning` rotates the projectile to `Math.atan2(vy, vx)` — its direction
of travel — and **does not mirror it**. The shoe sprites are authored **toe on
the left, heel on the right** (`data/sprites/sneakers.ts`, first line of its
header).

Work that through: when **you** throw, `vx > 0`, the rotation is near 0, and
the shoe flies **heel first, toe trailing.** When the **opponent** throws,
`vx < 0`, the rotation is near π, which both reverses it and turns it upside
down — so their shoe flies toe-first and sole-up.

That is a code bug, not an art problem, and it is recorded in §11. **Author
toe-left like every other shoe in the game.** Do not pre-compensate by drawing
a toe-right shoe; it will be wrong again the moment the rotation is fixed, and
it will be wrong in the store in the meantime.

The shoe sheets also have `fps: 0` and one frame, so **nothing tumbles.** A
projectile is one image held at an angle for the whole flight.

### `shoe-lowtop` … `shoe-slide` — 24 × 12, 1 frame each — **Path A, 1×**
- **What:** The ten sneaker silhouettes, in side profile: `shoe-lowtop`, `shoe-hightop`, `shoe-runner`, `shoe-knit`, `shoe-foam`, `shoe-chunky`, `shoe-skate`, `shoe-slipon`, `shoe-boot`, `shoe-slide`. The player's own first-inventory sneaker is the default projectile and never runs out.
- **View:** Flat side elevation, the lace side of the shoe, square to camera.
- **Faces:** **Toe LEFT, heel RIGHT** — the opposite of everything else in this document, and the existing convention across all 45 shoes in the game. Sole on the bottom rows.
- **Ground:** None — this is in the air. The sprite's anchor is forced to centre (`anchor: { x: 0.5, y: 0.5 }`) by `drawSpinning` so it rotates about its middle. Compose it so the visual mass is centred in the 24 × 12 box.
- **Frames:** One. `fps: 0`; there is no tumble.
- **Drawn at:** 33.6 × 16.8 logical px — `px = 1.4`. That is **wider than a thrower is tall**, and it is not an integer scale, so a 24 × 12 source is stretched to 1.4× and its pixels land unevenly. Draw a bold, simple silhouette; fine detail will not survive.
- **Not:** Do not deliver these unless one colourway for all 45 models is acceptable — see §1.12. Not a three-quarter view. No branding: it rotates and mirrors.

### `item-chancla` — 16 × 16, 4 frames — **Path A, 1×**
- **What:** The Chancla. Homing: `homing: 34` px/s² of constant steer toward wherever the target currently stands. Crater radius 12. Unlimited uses when carried.
- **View:** Flat, centred in a 16 × 16 box, rotated by the code to its flight direction.
- **Ground:** None. Centre it.
- **Frames:** Four, at **14 fps** (`fps: 14` on the coded def) — four 90° rotations of one asymmetric sole, so it tumbles end over end *on top of* the flight-direction rotation the code applies. Seamless 4 → 1.
- **Drawn at:** 24 × 24 logical px (`px = 1.5`).
- **Not:** Not a flip-flop seen from above. Not symmetric — the asymmetry is what sells the tumble.

### `item-frisbee` — 16 × 16, 3 frames — **Path A, 1×**
- **What:** The Frisbee. `gravityMul: 0.22` — it barely drops — `speedMul: 1.15`, and **`piercing: true`**, meaning it punches a crater through a building and keeps flying out the other side. Crater radius 8.
- **View / Ground:** Flat, centred, no ground contact.
- **Frames:** Three at **16 fps**, and the coded note explains why three rather than four: a 180° rotation of a disc is the same disc. **Wide → tilted → edge-on.** Seamless 3 → 1.
- **Not:** Not four rotations. Not a sports disc with a logo — it mirrors and rotates.

### `item-slushie` — 16 × 16, 3 frames — **Path A, 1×**
- **What:** The Slushie. `windMul: 1.9` — nearly twice the wind purchase of anything else in the bag — and **`craterR: 19`, the widest crater in the game.** 12 uses.
- **View / Ground:** Flat, centred.
- **Frames:** Three at **12 fps**. Frame 0 is the upright store-card pose (this sprite is shared with the shop, so frame 0 has to stand up straight); frames 1–2 are the cup tumbling with the straw out. Seamless.
- **Not:** Frame 0 is not a flight frame — do not tumble it. The shop draws it.

### `item-bureka` — 16 × 16, 3 frames — **Path A, 1×**
- **What:** The Bureka. `gravityMul: 1.7` — drops like a brick — `windMul: 0.5`. Crater radius 9. 15 uses.
- **View / Ground:** Flat, centred.
- **Frames:** Three at **14 fps**: point-up, point-right, point-down. Seamless.
- **Not:** Not a pastry seen from above on a plate. It is a triangle with sesame, in silhouette.

### `item-dog-launcher` — 16 × 16, 2 frames — **Path A, 1×**
- **What:** The Dog Launcher. `speedMul: 1.6` and `gravityMul: 0.55` — fast and flat, the flattest trajectory available. Crater radius 10. **40 uses**, the hard cap.
- **View / Ground:** Flat, centred.
- **Frames:** Two at **12 fps**. Frame 1 adds the muzzle flash and a dog leaving the barrel on the left, so the fire pose is a sprite swap rather than a particle system.
- **Not:** Not a gun. This is the game's one deliberately stupid object and it should look it.

**All five items already exist as coded 16 × 16 grids** in `data/sprites/items.ts`
and are shared with the store, the weapon rail and Street Brawl. Like the cast,
re-rendering them is a whole-game decision. They are listed here so the geometry
is on the record, not because this game needs them redrawn.

---

## 4. The buildings

This is the largest area of screen with no art on it and the highest-value part
of the set.

### 4.0 How the code draws a building today, and what that constrains

```
rect(ctx, b.x0, b.roofY, bw, bh, SHADE_COLORS[...]);   // one flat rectangle
...windows...                                          // 3 × 5 rects on a 10px row pitch
outline(ctx, b.x0, b.roofY, bw, bh, 'rgba(0,0,0,0.5)', 1);
...craters...                                          // destination-out arcs, clipped to the rect
```

Four hard constraints fall out of that:

1. **Widths and heights are continuous floats** — 30.0–54.0 wide, 34.0–118.0
   tall — so no fixed-size building plate can fit them. The facade has to be a
   **tile**, repeated in both axes by `tile()`.
2. **There are exactly four fill shades**, so there are four facade variants.
3. **Craters are cut with `globalCompositeOperation = 'destination-out'`,
   clipped to the building's rectangle.** Anything drawn inside that rectangle
   is erasable; anything drawn outside it is not. So a facade tile must not
   bleed past the rectangle, or the overhang will float over a hole.
4. **The code draws its own windows on top.** Their row pitch is exactly 10px
   from `roofY + 5`, but their column pitch is `(bw - 6) / (cols - 1)` — a
   different non-integer for every building. **No baked window grid can line up
   with it.**

### `roof-facade-a` … `roof-facade-d` — 18 × 20 game px (54 × 60 PNG at 3×), 1 frame each, **tileable L↔R and T↕B**
- **What:** Four variants of plain night-time building masonry, one per fill shade: `-a` = `#141c25` (blue-grey concrete), `-b` = `#182430` (slightly lighter, more blue), `-c` = `#101822` (the darkest, near-black brick), `-d` = `#1a222c` (warm grey render). Grain, panel joints, a downpipe, a stain, a service ladder — texture, not features.
- **View:** Flat elevation, 0°, square to camera. **No side wall, no perspective, no visible depth.**
- **Faces:** Does not mirror. Signage is allowed here and nowhere else — but keep it away from the tile edges (§1.7).
- **Ground:** None — this is a wall surface, tiled across a rectangle the code decides.
- **Frames:** One.
- **Tiling:** `tile()` mode. **Seamless left↔right AND top↕bottom.** The building is 34–118px deep and one tile is 20px, so it repeats downward two to six times; a top-bottom seam becomes a horizontal stripe across every building on screen.
- **Size note:** 18 × 20 is *chosen*, and here is what it has to satisfy: the measured width range is 30–54 (so the tile is repeated 1.7–3× horizontally) and the measured window row pitch is exactly 10 (so 20 is precisely two floors and the code's window rows will always land at the same two heights within a tile). **Do not change the 20 without re-deriving it from that 10.**
- **Critical:** **No windows.** The game draws 3 × 5 window rectangles on top and their column spacing is different on every building, so baked windows will be doubled and misaligned. Leave the openings as flat wall or as unlit recesses that the code's amber rectangle can sit inside.
- **Critical:** **Dark and low contrast.** Two 24px characters, a 34px shoe and a swarm of grey debris have to read against this. If the facade is busy, the game gets harder to play.
- **Not:** Not a whole building — this is 18 × 20 of wall. Not a three-quarter view of a corner. No roof, no ground, no sky in the tile. Not brightly lit.

### `roof-parapet` — 32 × 4 game px (96 × 12 PNG at 3×), 1 frame, **tileable L↔R**
- **What:** The lip at the top of a building where a thrower stands: a low coping course, a run of ventilation grille, the odd loose brick. It is the only thing that distinguishes the top of a building from the middle of one.
- **View:** Flat elevation, 0°. **Seen edge-on, as a horizontal band.** This is the asset most likely to come back as a receding roof deck in three-quarter view; there is no roof deck in this game (§1.9).
- **Faces:** Does not mirror.
- **Ground:** **The TOP edge of the image is the roof line** — it sits on `roofY` and the art hangs downward from it. The thrower's feet are on that same row.
- **Frames:** One.
- **Tiling:** `strip()` or `tile()` mode, seamless left↔right, laid along the full width of each building.
- **Critical:** **Nothing above the top edge**, or at most 2–3px of coping (*chosen* ceiling). The thrower is drawn after the buildings so a tall parapet will not cover them, but it will bury the contact point and the figure will look like it is standing in a trough.
- **Not:** Not a roof surface. Not a ledge in perspective. No railing tall enough to hide a 24px figure's legs.

### `roof-base-course` — 32 × 6 game px (96 × 18 PNG at 3×), 1 frame, **tileable L↔R**
- **What:** Where a building meets the street: a darker plinth course, a shuttered doorway, a grate, graffiti at head height. Six pixels of visual full stop at the bottom of every building.
- **View:** Flat elevation. **Ground:** Bottom edge, on `GROUND_Y = 182`.
- **Tiling:** Seamless left↔right.
- **Critical:** **The aim HUD panel covers y = 178..198 whenever the player is aiming**, so the bottom 4 of these 6 pixels are hidden for most of the game. Put nothing load-bearing in the lower two-thirds.
- **Not:** Not a shopfront row with readable signs — at 6px tall nothing reads. Silhouette only.

### `street-band` — 32 × 16 game px (96 × 48 PNG at 3×), 1 frame, **tileable L↔R**
- **What:** Street level, the full width of the screen: wet-looking asphalt, a kerb line, a manhole, the odd painted marking, a scatter of litter. Almost black.
- **View:** Flat elevation — you are seeing the street **edge-on as a dark band**, exactly the way `dress-aisle` works in Flight 404. **This is not a road seen from above and not a road in perspective.** It is the single easiest asset in the set to get wrong by importing the street games' habit.
- **Faces:** Does not mirror.
- **Ground:** The whole asset is ground. Its **top edge sits at y = 182** (`GROUND_Y`) and it runs to the bottom of the canvas at y = 198.
- **Frames:** One.
- **Tiling:** Seamless left↔right. It is laid across the full 352px width, so a 32px tile repeats 11 times — keep any distinctive mark well away from both edges or it becomes a rhythm.
- **Critical:** The code draws a 1px `#2a3340` line along y = 182 as the kerb, and the band itself is `#05070c` — **darker than every building.** It is the floor of the picture and must stay the darkest thing on screen; a shoe that reaches it has missed, and the miss should read as falling into a hole.
- **Critical:** **The aim HUD panel covers y = 178..198 whenever the player is aiming**, which is most of the game. This asset is only fully visible while a shoe is in the air. Do not put detail here that needs to be studied.
- **Not:** Not tarmac seen from above. No lane markings running away from camera. No perspective.

### `window-lit` — 3 × 5 game px (9 × 15 PNG at 3×), 1 frame — *optional, low value*
### `window-dark` — 3 × 5 game px (9 × 15 PNG at 3×), 1 frame — *optional, low value*
- **What:** Replacements for the flat `#ffcf6b` and `#232c38` rectangles the code draws. Lit: a warm amber pane with a hint of a frame and an occupant-shaped blot. Dark: a cold `#232c38` pane with a reflection line.
- **View:** Flat elevation. **Ground:** None; the code positions them.
- **Critical:** Nine by fifteen delivered pixels is three by five drawn pixels. There is room for roughly two tones and nothing else. These are listed for completeness; the flat rectangles are already almost right and this is the last thing to spend a day on.

---

## 5. Sky

### `sky-rooftop-night` — 352 × 185 game px (1056 × 555 PNG at 3×), 1 frame
- **What:** The whole sky, as one plate: a city night an hour past dusk. Deep blue-black at the top going slightly warmer and hazier toward the horizon, a band of light pollution low down, thin cloud. This replaces the three flat `rect` bands in `drawSky`.
- **View:** Flat. It is a backdrop; there is no angle to get wrong.
- **Faces:** Does not mirror. Does not scroll — **there is no parallax in this game**, the sky is drawn once per frame in world coordinates and never moves.
- **Ground:** None. **Its top edge sits at y = 13** (`SKY_TOP`), under the HUD bar, and it runs to y = 198. The bottom 16px and everything behind a building is covered, so nothing important goes below y ≈ 120.
- **Frames:** One.
- **Critical — match the measured bands.** The code's three bands are `#141a30` from y 13 to 73, `#0e1526` from 73 to 113, and `#0a1020` below. Deliver a plate that resolves to roughly those values at those heights, or the buildings and the HUD will sit against a sky they were coloured for and lose.
- **Critical — no stars.** `drawSky` draws 30 of its own, at `r = 0.6` (every fifth at `r = 1`), `rgba(255,255,255,0.55)`, scattered through **y = 13..83**. Bake stars into the plate and the game will have two sets.
- **Not:** No moon — that is its own file, at a position the code sets. No skyline silhouette baked into it: the buildings are generated per round and a baked horizon will disagree with them every time. No sun, no sunset, no daylight, no aurora.

### `moon-crescent` — 20 × 20 game px (60 × 60 PNG at 3×), 1 frame
- **What:** A waning crescent moon, pale `#e7ecf6`, slightly cratered, with no glow halo around it.
- **View:** Flat, dead-on circle. **Not** an ellipse — this scene is a flat elevation and the moon is drawn by `circle()`.
- **Faces:** Does not mirror.
- **Ground:** None. The code places it centred at **(306, 33)** — `(VW − 46, SKY_TOP + 20)`. Centre the disc in the 20 × 20 box.
- **Frames:** One.
- **Critical — the geometry of the crescent is measured.** The code draws a `#e7ecf6` disc at r = 10 and then a `#0a1020` disc at r = 9 offset by (−4, −3). So **the lit crescent opens toward the lower-right** and is at its thickest on the bottom-right limb, about 4px thick. Match that, because the moon's position relative to the towers is fixed and a crescent facing the other way looks lit from an impossible direction.
- **Not:** Not a full moon. No halo, no lens bloom, no clouds crossing it, no face.

---

## 6. Rooftop furniture

**Almost all of this already exists.** `assets/art/street/skyline-kit/rooftop/`
and `.../watertowers/` and `.../antennas/` and `.../billboards/` were delivered
for the street games' skyline band as **flat elevations** — the same view this
game uses — and they are exactly the clutter a rooftop duel wants. See §9.

### 6.0 One rule for everything standing on a roof

**Nothing on a roof is solid.** `collideAt` tests, in order: the world bounds,
the street, the two throwers' 7px hit circles, and the building's rectangle.
There is no test against furniture, and no way to add one without also adding a
per-object collision model.

So a water tower on a roof is **scenery a shoe flies straight through**. Keep
roof furniture **short and obviously not cover** — a player who sees a chest-high
crate next to the opponent will aim to skim it and will be annoyed when the shoe
passes through. Nothing that reads as a wall, a barricade or a shield.

### `roof-clutter-a` … (new pieces, only if the reused kit is not enough) — ≤ 16 × 16 game px, 1 frame
- **What:** Small, flat, unmistakably night-time roof junk: a tar bucket, a stack of pallets, a taped-up satellite dish, a pigeon coop, a folding chair, an extractor hood.
- **View:** Flat elevation, 0°, seen from the side.
- **Faces:** Right. The game would mirror these, so no lettering.
- **Ground:** Bottom edge, sitting on the roof line.
- **Frames:** One. There is no animation clock for scenery in this game.
- **Critical:** **Max 16px tall** (*chosen* — two-thirds of a 24px thrower) so it never reads as cover and never hides a figure's legs.
- **Not:** Not seen from above. Not in three-quarter view. Not a big HVAC block that looks solid.

---

## 7. Impacts and effects

### 7.0 What the code does today

| event | code | duration |
|---|---|---|
| building hit | 10 debris flecks `#9aa4ad`, shake 3 | 0.5–0.9 s / 0.15 s |
| ground or out-of-bounds | shake 1.5, no debris | 0.075 s |
| direct hit | 22 debris flecks (`#00e5c0` if you were hit, `#ff2e88` if they were), shake 9, full-screen white flash, banner | 0.5–0.9 s / 0.45 s / 0.3 s / 1.8 s |
| crater | a `destination-out` arc plus a `rgba(0,0,0,0.5)` 1.5px rim ring | permanent |

A debris fleck is a 2 × 2 rect thrown at 30–120 px/s with a −40 px/s upward
bias, under 260 px/s² of gravity, fading by `life / max`. **That is a particle
system and it should stay one** — a sheet cannot follow a ballistic path. The
effects below are the flash-and-dust *around* the particles, not replacements
for them.

### `crater-rim-08`, `-09`, `-10`, `-12`, `-19` — 16 × 16, 18 × 18, 20 × 20, 24 × 24, 38 × 38 game px, 1 frame each
- **What:** The blasted concrete edge of a hole punched through a building: spalled render, exposed rebar, a rubble shadow at the bottom of the ring, transparent in the middle. Five files, one per measured crater radius.
- **View:** Flat elevation. **A ring, not a bowl.** The hole goes *through* the wall; you are not looking down into a depression, you are looking at a wall with a hole in it.
- **Faces:** Does not mirror, but it will be placed at arbitrary positions, so make it read from any side. Do not let it become directional.
- **Ground:** None — centre the ring in the box. The code centres its arc on the impact point.
- **Frames:** One. The crater is permanent for the rest of the round.
- **Sizes are measured, not chosen:** `craterR` is 8 (frisbee), 9 (bureka), 10 (shoe and dog launcher), 12 (chancla), 19 (slushie). Diameter = 2r, hence 16/18/20/24/38.
- **Critical:** **Fully transparent in the middle.** The code has already erased the wall there; a filled centre fills the hole back in.
- **Not:** Not a smoking hole, not a scorch mark, not a cartoon blast star. The debris and the shake do the drama; this is what is left afterwards.

### `blast-concrete@6` — 20 × 20 game px, 6 frames
- **What:** The puff at the moment a projectile bites a building: grey-white dust bursting outward and immediately falling, the colour of the `#9aa4ad` debris it accompanies.
- **View:** Flat, centred on the impact point.
- **Ground:** None — centre it.
- **Frames:** Six, expanding and thinning. **Plays once, cut to 0.6 s** — that is `IMPACT_HOLD`, the whole time the game holds on a miss before passing the turn. Six frames over 0.6 s is 10 fps.
- **Not:** Not fire, not a fireball, not an explosion. This is a shoe hitting a wall. No orange in it.

### `blast-direct@8` — 28 × 28 game px, 8 frames
- **What:** The direct hit: a hard white core going instantly to a ragged ring of dust and sparks, then falling apart.
- **View:** Flat, centred on the impact point.
- **Ground:** None.
- **Frames:** Eight, one-shot. **Cut to 1.0 s of the 1.7-second `HIT_HOLD`** so the effect is finished while the loser is still tumbling and the banner is still up — 8 frames at 8 fps. Do not fill the whole 1.7 s; the tumble is the payoff and the effect should be out of its way.
- **Critical:** The code already paints a **full-screen white flash at 55% alpha over the first 0.3 s**. Frames 1–3 will be almost invisible under it. Put the read in frames 4–8.
- **Not:** Not a fireball. Not tinted to either player's colour — the code already throws 22 teal or magenta flecks and a tinted burst on top makes it soup.

---

## 8. World-space UI

### The wind arrow — **recommend leaving as code**
`windArrow()` draws a horizontal line at **(176, 21)** whose half-length is
`8 + min(22, |wind| * 0.35)`, i.e. **8 to 25.5 px each way**, continuously
variable, with two 2px barbs, in one of three colours by magnitude
(`#8394a6` under 12, `#ffb400` under 30, `#ff4747` above). The label `WIND nn`
sits at (176, 28) at 6px.

Because the length is continuous, a single fixed sprite cannot express it, and
splitting it into a stretched shaft plus an arrowhead is more wiring than the
three lines it replaces. **No asset requested.** It is listed so it is not
mistaken for something that was missed.

One thing worth knowing if it is ever revisited: the commentary bar —
`rect(0, 13, 352, 11)` at 75% alpha — is drawn *after* the wind arrow and
covers y 13..24, which is where the arrow is. So the wind readout is partly
obscured for the first 2.6–3 seconds of every round. Recorded in §11.

---

## 9. Reuse from the street set

Reusing one file across games is an explicit goal of this project, and the
street set has already delivered, at 3×, a large amount of art in **exactly the
flat-elevation view this game needs**. From `assets/art/street/`:

### Reusable as-is — rooftop furniture

`assets/art/street/skyline-kit/rooftop/`, all **48 × 48 PNG = 16 × 16 game px**,
flat elevation, drawn in the street games as silhouette clutter on a roof line:

`roof-vent` · `hvac-box` · `satellite-dish` · `water-tank-small` ·
`antenna-thin` · `utility-mast` · `exhaust-stack` · `clustered-pipes` ·
`access-shed` · `billboard-frame`

`assets/art/street/skyline-kit/antennas/` — `antenna-a` … `antenna-f`,
**36 × 60 PNG = 12 × 20 game px**.

`assets/art/street/skyline-kit/watertowers/` — `watertower-classic`,
`watertower-conical`, `watertower-squat`, **60 × 78 PNG = 20 × 26 game px**.
These are 26px tall against a 24px thrower — the tallest thing that could stand
on a roof here, and they are right on the edge of the "do not look like cover"
rule in §6.0.

`assets/art/street/skyline-kit/billboards/` — `billboard-a` … `billboard-e`,
**78 × 60 PNG = 26 × 20 game px**.

**Caveat:** the street games draw these dimmed to 78% (`SKY_SHADE.rooftop`).
Rooftop Artillery applies no dimming at all (§1.10), so they will appear here
at full strength — brighter than they look in Downhill Racer. Whether that
reads correctly is a judgement call to be made with the files on screen, not in
advance.

### Reusable as-is — effects

| file | size (PNG / game px) | rate | duration | use here |
|---|---|---|---|---|
| `impact-star@5.png` | 36 × 36 / 12 × 12 | 22 fps | 0.227 s | direct-hit spark core, under `blast-direct` |
| `dust-plume@5.png` | 42 × 30 / 14 × 10 | 16 fps | 0.313 s | shoe landing in the street (`kind: 'ground'`) |
| `splash-water@5.png` | 42 × 30 / 14 × 10 | 18 fps | 0.278 s | the slushie's 19px splash crater |

Rates are from `RATE` in `components/minigames/engine/streetAnim.ts`; duration
is frames ÷ rate.

### Not reusable

- **`sky-towers`, `sky-lowrise`, `sky-hills`, `sky-billboard`,
  `sky-watertower`, and `skyline-kit/towers/` and `.../lowrise/`.** These are
  *daytime and dusk* Californian skyline pieces authored for a parallax band
  that scrolls behind a road. This game has no parallax and no second plane —
  the towers you can see are the towers you are standing on and shooting holes
  in, and they are generated per round at sizes the art cannot match. Using
  them would put a second, differently-lit skyline behind the first.
- **Everything in §2–§8 of `ASSETS-STREET.md` that stands on a road** —
  vehicles, animals, bins, cones, hydrants, kerbs, road markings. All of it is
  **VIEW A, 20° high angle**, and it will visibly disagree with this game's flat
  elevation. `kerb.png` in particular is authored to show a top face and a
  vertical drop, which cannot exist here.
- **`assets/art/characters/`** — the bike and skateboard sheets. Those are the
  street games' rider loops; nobody rides anything on a roof.

---

## 10. Priority

If the set arrives in pieces, this is the order that makes the game look
different fastest. Each line is independently droppable (§1.11).

1. `roof-facade-a…d`, `roof-parapet` — the largest area of flat colour on screen.
2. `sky-rooftop-night`, `moon-crescent`.
3. `roof-thrower-idle`, `roof-thrower-aim`, `roof-thrower-hit`, `rival`.
4. Wiring the reused rooftop furniture from §9 — no new art at all.
5. `crater-rim-*` — craters are permanent, so they accumulate on screen all round.
6. `roof-base-course`, `blast-concrete@6`, `blast-direct@8`.
7. `window-lit` / `window-dark`.
8. The eight opponent sprites and the five item sprites — whole-game decisions,
   not this game's.

---

## 11. Open questions — things the code could not answer

These are recorded rather than guessed. Each one changes an asset if it is
resolved the other way.

1. **Rooftop Artillery imports no art loader at all.** It uses `actor()`,
   `rect()`, `circle()` and `line()` only. The throwers, shoes and items reach
   it through Path A automatically, because `bakeSprite` consults the registry —
   but **nothing in §4, §5, §6 or §7 has a call site yet.** The facades, sky,
   moon, furniture, crater rims and blasts all need `art.tile()` / `art.sprite2()`
   / `art.strip()` calls added to `drawSky` and `drawBuildings`, plus
   `assets/art/rooftop/` added to `streetArt.ts`'s glob (or the files put in
   `assets/art/street/`). The geometry in this document is measured and will not
   move; the wiring does not exist.
2. **The facade tile size (18 × 20) is chosen, not measured.** The 20 is derived
   from the measured 10px window row pitch, and the 18 is a guess at a good
   horizontal repeat against a measured 30–54px width range. If the wiring uses
   `panel()` (stretch to fit) instead of `tile()` (repeat at authored size), the
   whole asset changes shape and this number is wrong.
3. **Whether the code should keep drawing windows.** This brief assumes yes, and
   therefore asks for window-free facades, because the column pitch
   `(bw − 6) / (cols − 1)` is a different non-integer per building and cannot be
   matched by baked art. If the window drawing is removed instead, the facades
   need windows on a fixed pitch and are a different asset.
4. **The maximum height of roof furniture (16px) is chosen.** The constraint it
   satisfies is real — nothing on a roof has collision — but the number is a
   judgement about readability, not a measurement.
5. **Whether reused street rooftop clutter looks right undimmed.** The street
   games draw it at 78%; this game will draw it at 100%. Cannot be decided from
   the code.
6. **Whether `roof-thrower-*` should replace `player` or be new ids.**
   `drawArtillery` hardcodes `actor(ctx, 'player', ...)`. Delivering the aim
   pose as `player.png` would change the player character in every other game,
   which is certainly wrong; using new ids needs a state switch written into
   `drawArtillery`, which does not exist. The frames are specified either way,
   but the filenames depend on that decision.
7. **How many frames the throwers should eventually have.** Today the answer is
   one, because `actor()` is called without an animation clock (§1.12). The
   4-frame aim sheet is specified against the measured 1.571 s oscillation the
   simulation already runs, on the assumption that `elapsed: w.t` will be
   passed. If it is not, frames 2–4 are wasted work.
8. **There is no throw animation and nowhere to put one.** `fire()` launches and
   switches to `'flight'` in the same tick. A release beat needs a new phase and
   a new timer before any art for it is worth drawing. **Do not draw it yet.**
9. **There is no win or lose animation and nowhere to put one.** `'over'`
   returns immediately from `stepArtillery` and the React result card covers the
   canvas. A celebration would never be seen. **Do not draw it yet.**
10. **What a crater should show through.** The `destination-out` erase clears the
    canvas to full transparency, so a hole shows the page background
    (`PAL.void`, `#04060a`) rather than the sky behind the building. Whether that
    is intended is not decidable from the code, and it changes whether
    `crater-rim-*` should have a dark interior wash or stay fully transparent.
11. **Whether the opponent should have an aim pose.** The state exists
    (`'thinking'`, 0.85 s) but the draw code gives side 1 the same `armUp: 0.15`
    it uses for standing, so there is nothing to animate. An opponent wind-up
    would be a real improvement and is a two-line change, but as written the
    state has no art requirement.

---

## Delivery checklist

- [ ] **Flat elevation, 0°.** Not the 20° high angle used by the street games.
      No top surfaces, no receding walls, no squashed ellipses.
- [ ] **Path A files (throwers, opponents, shoes, items) delivered at 1×** —
      16 × 24, 24 × 12, 16 × 16. A 3× file draws three times too big.
- [ ] **Path B files (sky, moon, facades, parapet, street, furniture, effects)
      delivered at 3×.**
- [ ] **Path B files are in `assets/art/street/`**, not `assets/art/rooftop/` —
      the street loader's glob does not see the rooftop folder.
- [ ] **Everything faces right.** No left-facing twins; the game mirrors.
- [ ] **Shoes are the exception: toe LEFT, heel right**, matching every other
      shoe in the game.
- [ ] **Ground line at the bottom edge** — except `roof-parapet`, whose contact
      line is its **top** edge.
- [ ] **No baked drop shadows.** `actor()` draws its own ellipse.
- [ ] **No baked directional key light, no sunset, no daylight.** Deep blue
      night; the only warm light is window amber `#ffcf6b`.
- [ ] **Deliver at final brightness** — this game applies no distance dimming
      and no runtime tint to anything.
- [ ] **No text, numbers or logos** on anything that mirrors or rotates.
      Signage only on facades and the base course.
- [ ] `roof-facade-*` seamless **left↔right AND top↕bottom**; `roof-parapet`,
      `roof-base-course`, `street-band` seamless left↔right.
- [ ] **No windows baked into the facades.** The code draws its own on a pitch
      no baked grid can match.
- [ ] **No stars and no skyline baked into the sky plate.** The code draws 30
      stars and generates the skyline per round.
- [ ] `crater-rim-*` fully transparent in the middle.
- [ ] Transparent RGBA background, trimmed to content, no padding.
- [ ] Sheets one row, equal frame widths, no gutters, `@N` in every multi-frame
      filename.
- [ ] **Frame 0 of every sheet works as a standalone still** — the game shows
      only frame 0 today.
- [ ] Animation lengths cut to the table in §1.14 — 1.2 s round intro, 0.85 s
      opponent think, 0.6 s miss hold, 1.7 s hit hold, 1.571 s aim cycle.
- [ ] **A thrower is 24 logical pixels tall.** Everything checked against it
      before export.
- [ ] `node scripts/check-art.mjs assets/art/street` (and `.../rooftop`) run
      after the drop, clean.
