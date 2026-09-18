# Hoops — character animation spec

What to draw so the basketball game stops looking like 1989 and starts looking
like the thing it is trying to be.

---

## 0. Why this document exists

The hoops mini-game currently draws **every player, in every state, from a
16×24 sprite with four frames of animation** — and all four are walk cycle:

```
SPR_PLAYER (data/sprites/characters.ts)
  frame 0 — passing, arms level
  frame 1 — stride, right arm forward / left leg leads
  frame 2 — passing, arms swapped
  frame 3 — stride, left arm forward / right leg leads
```

`assets/art/hoops/` contains a README and zero PNGs.

Everything else the game does — jumping, dunking, shooting, getting knocked
flat on the floor — is faked by *transforming that walk pose*: an `armUp`
scalar that slides the arms up, a `crouch` boolean that drops the torso 1.5
units, a `rotation` when a player is knocked down, and `height × 0.55` to
squash him. There is no run cycle, no pivot, no gather, no landing, no
follow-through, and no separate pose for holding the ball.

A 16×24 sprite with a four-frame walk cycle **is** a 1989 console character.
The game is a faithful one. This document is the list of frames that stops it
being one.

---

## 1. The target, measured against the real thing

NBA Jam's arcade source (`historicalsource/nba-jam`, `DUNK.ASM`) defines
**54 active dunk sequences**, at **7 to 23 frames each** — around 10 frames
being typical, with the showpieces (`dunkt4_t`, `dunkt5_t`) at 23. It also
carries separate named sequences for standing, running, running *while
dribbling*, shooting, stealing, pushing and staggering (`STND_SEQ`, `RUN_SEQ`,
`RUNDRIB_SEQ`, `SHOOT_SEQ`, `STEAL_SEQ`, `PUSH_SEQ`, `STAGGER_SEQ`).

Only frame counts and sequence names were read, as factual measurements of a
released game. **No code, no data and no art from that repository is used
here, and none may be.** What follows is drawn from scratch for this game.

### What to take from that number, and what not to

Do **not** target 54 dunks. That was the marquee feature of a 1993 arcade
cabinet with a team digitising real athletes, and the dunk is on screen for
roughly **five seconds of a ninety-second game** (measured: 9.15 dunks/game at
~0.5s each).

Take the *structure* instead, which is where the quality actually lives:

1. **A single action gets ~10 frames.** Not one pose held, and not two frames
   ping-ponging. Ten frames is enough for anticipation, action and
   follow-through — and that three-beat shape is the entire difference between
   "the sprite moved" and "the player moved".
2. **Running and running-with-the-ball are different animations.** Jam keeps
   `RUN_SEQ` and `RUNDRIB_SEQ` apart. Ours uses one cycle for both, which is
   why a player carrying the ball reads exactly like a player who is not.
3. **Variety is a feature, not a garnish.** 54 dunks is why the fiftieth dunk
   still landed. We want the same property at a tenth of the cost: a handful
   of finishes dealt at random rather than one played 9 times a game.

So: **fewer sequences than Jam, the same frames per sequence.**

---

## 2. Hard technical requirements

These are not style notes. A sheet that misses any of them will not load
correctly, and §2.3 in particular is the one that has already cost this
project a full re-export once.

### 2.1 Authored size — 48 × 64 per frame

Draw every frame on a **48 wide × 64 tall** canvas, character feet-centred on
the bottom edge.

The reason is arithmetic, not taste. A player draws at `32 × sc(z)` logical
pixels, the follow-cam can punch to `2×` (`FOLLOW_MAX_ZOOM`), and the backing
store multiplies by device pixel ratio on top. So the largest a character is
ever rasterised is about **64 logical pixels tall**. Authoring at 64 means the
engine is always *shrinking* the art, never enlarging it — and shrinking is
the safe direction. Enlarging is what made the street art look like mud.

**Draw at 48×64. Do not draw larger and reduce.** One reduction, done once, by
the engine. If a frame arrives at 300px and is downsampled to 64 before
delivery, it will look soft and we will be able to measure that it did
(`scripts/check-art.mjs` counts the effective pixel grid and will flag it).

### 2.2 Palette — use the indexed palette, exactly

Every colour must be one of the hexes in `systems/sprites/palette.ts`. Not
"close to". Exactly, to the byte.

This is what makes one sheet become four players. The engine recolours by
remapping palette entries (`swap: { c: 'm', C: 'M' }` turns the teal kit
magenta), so the same run cycle serves you, your team-mate and both
opponents. An off-palette colour cannot be remapped and that player's kit will
be wrong.

The kit colours to draw with:

| role | base | shade |
|---|---|---|
| jersey / shorts | `c` `#00e5c0` | `C` `#0b8d78` |
| skin | `s` `#f0c49a` | `S` `#c98f63` |
| hair | `h` `#2a2119` | `H` `#584434` |
| shoes | `W` `#ffffff` | `w` `#d7dee6` |
| outline | `o` `#05070a` | `O` `#12171f` |

Draw the whole cast in the teal kit. We recolour.

### 2.3 Sheet format and naming

One horizontal strip per sequence, frames left to right, evenly spaced, no
padding between frames, transparent background.

```
assets/art/hoops/<sequence>@<frames>.png
```

The `@N` suffix is the frame count and the loader reads it — a sheet without
it is drawn as one enormous frame, which looks like a rendering fault and is a
naming one. A 8-frame run cycle is therefore `384 × 64` and named
`hoops-run@8.png`.

### 2.4 Silhouette and readability

At 32 logical pixels on a phone, silhouette is all the player has.

- **Every frame must read as its action from the silhouette alone.** Squint
  until the colours blur; if you cannot tell the gather from the release, the
  pose is not extreme enough.
- **Exaggerate.** This is an arcade basketball game about a man who catches
  fire. A dunk should be physically ridiculous. Real reference will read as
  timid at this size.
- **One pixel of outline** in `o` around the whole silhouette, so a player
  never disappears against the court or another body.
- **Keep the head large.** Roughly 1/4 of total height. It is the fastest
  thing the eye finds.

### 2.5 Registration

Every frame in a sequence must be registered to the same ground point: feet
centred horizontally, standing on the bottom row. If the character leaves the
ground (jump, dunk), keep him drawn at his real height *within the 64px
canvas* — the engine positions by feet and applies its own vertical offset, so
a jump frame drawn floating will float twice.

Characters face **right** in every frame. The engine mirrors for left.

---

## 3. The frame list

Ordered by how much screen time each gets, which is not the order of how
exciting they are. Tier 1 is most of what a player ever looks at.

### Tier 1 — locomotion (the 90%)

| sequence | frames | notes |
|---|---:|---|
| `hoops-idle@4` | 4 | Standing, weight shifting, breathing. Not a freeze. |
| `hoops-run@8` | 8 | No ball. Full stride, real arm swing, body leaned into it. |
| `hoops-dribble@8` | 8 | **Separate cycle.** Ball low and to the side, off-arm out. The single most valuable sheet in this document — it is how you tell at a glance who has the ball. |
| `hoops-turbo@8` | 8 | Sprint. Lower stance, longer stride, more lean than `run`. |
| `hoops-pivot@3` | 3 | Planting and turning the other way. This is what kills the "skating" feel; without it a reversal is a mirror flip. |
| `hoops-skid@3` | 3 | Hard stop, heels dug in, dust. Plays when velocity dies fast. |

**Subtotal: 34 frames.** If only one batch ever gets drawn, make it this one.

### Tier 2 — the ball

| sequence | frames | notes |
|---|---:|---|
| `hoops-gather@4` | 4 | Shot wind-up, the crouch before the jumper. Anticipation — the defender needs to be able to read it. Currently a boolean. |
| `hoops-jumper@6` | 6 | Rise, release, **follow-through with the wrist held**. The follow-through is not optional; it is what makes a shot feel shot. |
| `hoops-pass@4` | 4 | Bullet. Chest, sharp, weight forward. |
| `hoops-lob@4` | 4 | Two hands, up and over. Must read differently from `pass` at a glance. |
| `hoops-layup@6` | 6 | Off one foot, ball up off the glass. |

**Subtotal: 24 frames.**

### Tier 3 — the spectacle

| sequence | frames | notes |
|---|---:|---|
| `hoops-dunk-a@10` | 10 | One-hand tomahawk. |
| `hoops-dunk-b@10` | 10 | Two-hand, knees tucked. |
| `hoops-dunk-c@12` | 12 | 360. |
| `hoops-dunk-d@12` | 12 | Something anatomically indefensible. This is the one people screenshot. |
| `hoops-alley@10` | 10 | Catch in the air and finish. Separate from the dunks: it starts with empty hands. |

**Subtotal: 54 frames.** Four dunks dealt at random gets most of the variety
benefit of Jam's fifty-four, at 7% of the cost. More can be added later — the
engine deals from a list, so a fifth dunk is a file, not a code change.

### Tier 4 — contact and defence

| sequence | frames | notes |
|---|---:|---|
| `hoops-block@6` | 6 | Vertical, arm fully extended, ugly and committed. |
| `hoops-steal@4` | 4 | The reach-in. |
| `hoops-shove@5` | 5 | The push. Wind-up, contact, recovery. |
| `hoops-stagger@6` | 6 | Taking the shove: off balance, arms wheeling, going down. |
| `hoops-down@2` | 2 | On the floor. Currently the walk pose rotated and squashed. |
| `hoops-getup@4` | 4 | Pushing back up. Sells the 0.85s you are out of the play. |
| `hoops-land@3` | 3 | Absorbing a landing. Three frames of weight, and the reason jumping will stop feeling weightless. |

**Subtotal: 30 frames.**

### Tier 5 — flavour

| sequence | frames | notes |
|---|---:|---|
| `hoops-celebrate@6` | 6 | After a bucket. |
| `hoops-gassed@4` | 4 | Hands on knees, empty turbo bar. The game has a GASSED state and nothing shows it. |
| `hoops-fire-idle@4` | 4 | On fire. Can be the idle with a different stance; the flame FX is code. |

**Subtotal: 14 frames.**

---

## 4. Totals, and a delivery order

| tier | frames |
|---|---:|
| 1 — locomotion | 34 |
| 2 — the ball | 24 |
| 3 — spectacle | 54 |
| 4 — contact | 30 |
| 5 — flavour | 14 |
| **total** | **156** |

156 frames against the 4 that exist today.

For scale: that is roughly what NBA Jam spent on **fifteen of its fifty-four
dunks**. We are not out-drawing a 1993 arcade cabinet on volume. We are
spending the frames where the game actually looks at them, which that cabinet
did not have to care about because it was not also a shoe-trading game.

### Batch order

Deliver in tiers, and we wire each batch as it lands — the same cadence that
worked for the street re-export.

1. **Tier 1** — the single biggest change. Run, dribble and pivot alone move
   the game from "1989" to "modern", before a single dunk is drawn.
2. **Tier 4** — contact. Makes the game feel physical.
3. **Tier 2** — the ball. Makes shooting readable.
4. **Tier 3** — spectacle. The payoff, once the fundamentals read.
5. **Tier 5** — flavour.

---

## 5. What the engine needs from us (not the illustrator)

Recorded here so the wiring is not mistaken for art work.

- `SpriteDef.frames` is a flat list with no named clips, and `actor()` takes
  either an explicit `frame` index or a `stride`. A **state → clip map** is
  needed so `dribble` plays while `possession === p.id`, `land` plays for 3
  frames after touchdown, and so on. That is ours to write.
- The `armUp` / `crouch` / `rotation` transform hacks in `drawPlayer` come out
  as their real sequences arrive. They stay until then — a half-delivered set
  must degrade to the current look, never to a hole.
- `figure()` stays exactly as it is. It is the fallback when a sheet is
  missing and it is the reason a partial delivery is safe.
- `hoops-land` and `hoops-pivot` need their trigger conditions added to the
  sim (landing lag, direction-reversal detection). Both are wanted for game
  feel regardless of whether the art ever lands.

---

## 6. The one-line brief

> Draw a 48×64 pixel basketball player, facing right, in the palette from
> `systems/sprites/palette.ts`, one horizontal strip per action, named
> `hoops-<action>@<frames>.png`. Every action gets anticipation, action and
> follow-through. Exaggerate everything — at 32 pixels on a phone, subtle
> reads as broken.
