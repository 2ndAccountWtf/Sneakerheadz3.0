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
~0.5s each). Four or five finishes dealt at random gets most of the variety
benefit — the engine deals from a list, so a sixth dunk is a file, not a code
change.

But **do not copy Jam's 23 either**, and this is the part that matters:

### The rule: frames are set by duration, not by importance

```
frames  =  duration  ×  animation fps
```

Animation frames are consumed over time. Pixel art reads well at **12–20 fps**
— below 12 it strobes, above about 20 you are paying for drawings that each
show for two game frames and nobody ever sees. Our sim runs at a fixed 60fps,
so a 20fps clip holds each frame for 3 game frames.

That makes frame count a *consequence* of how long the action lasts, and every
one of our durations is already a constant in `HoopsGame.tsx`:

| action | duration | source | @12fps | **@15fps** | @20fps |
|---|---:|---|---:|---:|---:|
| dunk (normal) | 0.72s | `dunkDur` :1198 | 9 | **11** | 14 |
| dunk (turbo) | 0.80s | `dunkDur` :1198 | 10 | **12** | 16 |
| alley-oop finish | 0.38s | `dunkDur` :1198 | 5 | **6** | 8 |
| tip-in | 0.28s | `dunkDur` :1198 | 3 | **4** | 6 |
| stagger / knocked down | 0.85s | `STUMBLE_TIME` :148 | 10 | **13** | 17 |
| shot gather | 0.32s | apex of `SHOT_JUMP` off `jumpOf` | 4 | **5** | 6 |
| jump, floor to floor | 0.77s | measured from `GRAVITY`/`JUMP_V` | 9 | **12** | 15 |
| pivot | 0.12s | must stay fast | 1 | **3** | 2 |
| landing | 0.12s | must stay fast | 1 | **3** | 2 |

So Jam's 23-frame showpieces are not a richer version of our dunk — they are a
**longer** one. Our dunk is 0.72–0.80 seconds because that is what the
gameplay wants. Twenty-three frames inside 0.8s is 29fps: each drawing would
be on screen for two game frames, and the illustrator would be paid for
roughly a dozen images no player will ever resolve.

### The trap this rule protects against

More frames on a *short* action does not make it smoother. It makes it
**longer**, and a longer action is a less responsive game.

A ten-frame pivot is a half-second pivot. Turning around would stop being
something you do and start being something you commit to, and the game would
feel worse than it does now — which is the exact opposite of the point. Pivot,
landing and skid are short **because they must be**, and they get 3–4 frames
each for that reason and no other.

Cycles play by a different rule again. A run is a loop, not a one-shot, so its
length is set by stride cadence rather than by a timer, and it wants an **even**
count because the two halves mirror each other. 8 is the classic run cycle;
10 and 12 are genuinely smoother and worth the extra drawings, because running
is what the player looks at more than anything else in the game.

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
naming one. The 10-frame run cycle is therefore `480 × 64` and named
`hoops-run@10.png`.

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

Every count below is `duration × 15fps`, rounded, using the durations in §1.
Ordered by how much screen time each gets — which is not the order of how
exciting they are. Tier 1 is most of what a player ever looks at.

### Tier 1 — locomotion (the 90%)

| sequence | frames | why that number |
|---|---:|---|
| `hoops-idle@6` | 6 | Slow loop, ~1.5s. Weight shifting, breathing. Not a freeze. |
| `hoops-run@10` | 10 | Loop, 5 per step. No ball, full stride, real arm swing, body leaned in. |
| `hoops-dribble@10` | 10 | **Separate cycle.** Ball low and to the side, off-arm out. The single most valuable sheet here — it is how you tell at a glance who has the ball. |
| `hoops-turbo@10` | 10 | Sprint. Lower stance, longer stride, more lean than `run`. |
| `hoops-pivot@3` | 3 | 0.12s. **Short on purpose** — see §1. Planting and turning the other way; this is what kills the "skating" feel. |
| `hoops-skid@4` | 4 | 0.25s. Hard stop, heels dug in. |

**Subtotal: 43 frames.** If only one batch ever gets drawn, make it this one.

### Tier 2 — the ball

| sequence | frames | why that number |
|---|---:|---|
| `hoops-gather@5` | 5 | The wind-up is 0.32s — plant, rise, ball over the head — and it ends at the apex, where `hoops-jumper` takes over. It was 9 frames against a 0.62s release meter; the meter is gone and the clock moved, so the frame count moves with it. It is currently a boolean. |
| `hoops-jumper@9` | 9 | Rise, release, **follow-through with the wrist held**. The follow-through is not optional; it is what makes a shot feel shot. |
| `hoops-pass@5` | 5 | ~0.3s. Chest, sharp, weight forward. |
| `hoops-lob@5` | 5 | Two hands, up and over. Must read differently from `pass` at a glance. |
| `hoops-layup@8` | 8 | ~0.5s. Off one foot, ball up off the glass. |

**Subtotal: 32 frames.**

### Tier 3 — the spectacle

| sequence | frames | why that number |
|---|---:|---|
| `hoops-dunk-a@11` | 11 | 0.72s `dunkDur`. One-hand tomahawk. |
| `hoops-dunk-b@11` | 11 | 0.72s. Two-hand, knees tucked. |
| `hoops-dunk-c@11` | 11 | 0.72s. 360. |
| `hoops-dunk-d@12` | 12 | 0.80s — the turbo dunk is the long one. Something anatomically indefensible. This is the one people screenshot. |
| `hoops-dunk-e@12` | 12 | 0.80s. Second turbo finish, so the big one is not always the same big one. |
| `hoops-alley@6` | 6 | 0.38s — an alley finish is *half the length of a dunk*. Catch in the air and slam. Starts with empty hands, so it cannot reuse a dunk. |
| `hoops-tip@4` | 4 | 0.28s, the shortest action in the game. Put-back off the rim. |

**Subtotal: 67 frames.** Five finishes plus the two short ones. The engine
deals from a list, so a sixth dunk is a file drop, not a code change.

### Tier 4 — contact and defence

| sequence | frames | why that number |
|---|---:|---|
| `hoops-block@8` | 8 | ~0.5s of the 0.77s jump. Vertical, arm fully extended, ugly and committed. |
| `hoops-steal@5` | 5 | ~0.3s. The reach-in. |
| `hoops-shove@6` | 6 | ~0.35s. Wind-up, contact, recovery. |
| `hoops-stagger@13` | 13 | `STUMBLE_TIME` is **0.85s** — the longest single action in the game and currently the walk pose rotated. Off balance, arms wheeling, going down. Worth every frame: this is the payoff of the signature move. |
| `hoops-down@2` | 2 | Held on the floor. The tail of `stagger`, so it is cheap. |
| `hoops-getup@6` | 6 | ~0.4s. Pushing back up. Sells the time you are out of the play. |
| `hoops-land@3` | 3 | 0.12s. **Short on purpose.** Three frames of absorbed weight is the difference between landing and teleporting. |

**Subtotal: 43 frames.**

### Tier 5 — flavour

| sequence | frames | why that number |
|---|---:|---|
| `hoops-celebrate@8` | 8 | ~0.5s. After a bucket. |
| `hoops-gassed@6` | 6 | Loop. Hands on knees, empty turbo bar. The game has a GASSED state and nothing shows it. |
| `hoops-fire-idle@6` | 6 | Loop. On fire. The flames themselves are code; this is the stance. |

**Subtotal: 20 frames.**

---

## 4. Totals, and a delivery order

| tier | frames |
|---|---:|
| 1 — locomotion | 43 |
| 2 — the ball | 32 |
| 3 — spectacle | 67 |
| 4 — contact | 43 |
| 5 — flavour | 20 |
| **total** | **205** |

205 frames against the 4 that exist today.

Note what the duration rule did to the first draft of this table: the gather
went from 4 frames to 9 and the stagger from 6 to 13, because both are long
actions that were being under-drawn; the alley-oop came *down* from 10 to 6,
because it is a 0.38s move that was being over-drawn. Frames follow the clock.

And then the clock moved. The release meter was removed — it was ours, not
Jam's — and the gather stopped being a 0.62s charge bar and became a 0.32s
plant-and-rise that ends at the apex of the jump. So the gather went 9 → 5 and
the total 209 → 205, by the same rule that had put it at 9 in the first place.
That is the rule working: the frame count is a consequence of the duration, so
when the duration changes the count is not renegotiated, it is recomputed.

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
> `hoops-<action>@<frames>.png` — the number in the filename is the frame
> count and it is not negotiable, because each one is that action's real
> duration times 15fps. Every action gets anticipation, action and
> follow-through. Exaggerate everything — at 32 pixels on a phone, subtle
> reads as broken.
