# Flight 404 — what is still needed

**This supersedes the framing notes in `ASSETS-FLIGHT404.md`.** That document is
the full catalogue and still holds for the 107 files already delivered. This one
covers what is outstanding, and it is written in the same block format as
`ASSETS-STREET.md`, to be fed to an image generator.

Every number below was read off the running scene, not chosen. Where the code
and the old brief disagreed, the code won and the brief was corrected.

---

# PART ONE — THE RULES

## 1.1 This game is NOT drawn like the street games

`ASSETS-STREET.md` describes a 3/4 high-angle view of a road. **Flight 404 is
not that.** Do not carry the street rules across.

**Flight 404 is a flat side elevation — a cutaway of an aeroplane, seen dead-on
at 0°.** You are looking straight at the side of the cabin, as though the
fuselage wall nearest you has been removed. There is no high angle, no visible
top surfaces, no squashed ellipses, and no perspective of any kind.

- **Characters** are drawn in **flat side profile**, standing upright, feet on a
  flat floor line.
- **Cabin fittings** — windows, seats, bins, counters — are **flat elevations**,
  square to camera.
- **Objects lying on the floor** are still drawn in **side elevation**, not from
  above. A spilled tray is seen edge-on, not as an ellipse.

If an asset would look right in a side-scrolling platformer, it is right here.

## 1.2 The three bands of the screen

The screen is **352 × 198 world units**, rendered on a **960 × 540 canvas**, so
**1 world unit = 2.727 device pixels**.

```
  y=0    ─────────────────────────────────────────────  top of screen
         ceiling — dark, empty
  y=48   ┌───────────────────────────────────────────┐
         │  THE CABIN BAND — background scenery      │  windows, seat backs,
         │  nothing here can be shot or stood on     │  overhead bins
  y=128  └───────────────────────────────────────────┘  ← CABIN_BASE
         ░░░ THE AISLE — 36 units deep ░░░░░░░░░░░░░░    everything playable
  y=164  ═══════════════════════════════════════════     ← FLOOR_Y
         foreground lip
  y=198  ─────────────────────────────────────────────  bottom of screen
```

**The player learns one rule: if it is on the aisle, it is real.** Everything in
the cabin band is scenery and can never be shot, tripped over or stood on. That
is what lets the background be as detailed as you like.

## 1.3 The aisle is 36 units deep — this is a hard ceiling

Anything standing on the aisle floor at y=164 has **36 world units of headroom**
before it overlaps the cabin band.

That is not a guideline. A crossing taller than 36 units will visually pass
*through* the seat backs behind it and the depth illusion collapses.

**The camel is deliberately 34 units** — it fits by two units, which is exactly
why its gag is that it has to duck under the overhead bins. Nothing else on this
list should come close to that.

## 1.4 Where things stand, exactly

| what | y | depth | brightness | drawn |
|---|---|---|---|---|
| far residents | **111** | 1 | **62%** | dimmed, hazy, in the cabin |
| near residents | **128** | 4 | 100% | full colour, in the cabin |
| **crossings** | **164** | 5 | 100% | **on the player's aisle** |
| the player | 164 | 10 | 100% | on the aisle |
| props, crates | 164 | 12 | 100% | on the aisle |

**Far residents are drawn at 62% brightness by the game.** Do not pre-dim them —
deliver them at full strength and the tint is applied at runtime. A pre-dimmed
file gets dimmed twice and disappears.

## 1.5 Facing

**Everything faces right.** The game mirrors horizontally for anything moving the
other way, which for crossings is half the time.

- **No text, numbers or logos on anything that moves.** It will be backwards half
  the time.
- Background **residents** are also mirrored now — a section places some facing
  each way — so the same rule applies to them.

## 1.6 Ground line

**The bottom edge of the image is where the thing touches the floor.** Its lowest
opaque pixel is the contact point. No baked shadow; the game draws its own.

For residents, "the floor" is the cabin floor at their own y, not the aisle.
Same rule: bottom edge.

## 1.7 Lighting

This cabin is a **night interior**: near-black navy, warm amber pools from the
overhead lights, cold blue from the windows.

- Light everything with **soft top-down ambient**, warm.
- **No hard directional key, no long cast shadows, no baked window light** on
  characters — they walk past the windows and the light would be wrong instantly.
- Far residents: full strength, the game dims them.

## 1.8 Scale

**The player's body is 26 world units tall.** Everything is relative to that.

| thing | world units tall | device px at 2.727× |
|---|---|---|
| **the player** | **26** | **71** |
| a mook | 24–26 | 65–71 |
| a crossing donkey | 22 | 60 |
| a crossing camel | **34** | **93** — the tallest thing allowed |
| aisle headroom | **36** | 98 — the hard ceiling |
| the cabin band | 80 | 218 |

**Deliver at either 1× world units or 2.727×.** The loader accepts both and picks
whichever reading lands nearest the size the game expects. **2.727× is sharper**
and is what the canvas can actually show.

## 1.9 Format

- PNG, RGBA, genuinely transparent background. Not white.
- Trimmed to content. No padding.
- Sheets are **one row**, equal frame widths, zero gutters, facing right.
- Drop at `assets/art/flight404/`.
- **Frame counts come from this document** — a file with no `@N` is sliced by the
  table in `sheets.ts`, which is generated from the brief. An `@N` in the
  filename overrides it.
- Run `npm run art` after a drop; it reports transparency, frame division and
  size against this brief.

---

# PART TWO — THE ASSETS

## 2. Crossings — 10 files

These run the **aisle**, at the player's feet, left to right or right to left.
They are the "random stuff that gets in your way".

**All of them:** VIEW flat side elevation · FACES right · GROUND bottom edge ·
**max 36 units tall** · walk cycle loops seamlessly · one balk beat.

**The balk** is the one thing each does mid-aisle. It holds for 1.6s, fires at
most once per crossing, and the body does not travel during it. It is the beat a
player only catches if they happen to be looking, which is the whole value of
these — deliver it as **extra frames appended to the walk sheet is wrong**;
supply it as its own file (`<id>-balk`) unless the table says otherwise.

### `cross-donkey` — 26 × 22, 6 frames
- **What:** A working donkey in flat side profile, walking right. Dusty grey-brown, a worn blanket or pannier strap across its back, ears back, entirely unbothered. This is the anchor of the whole gag set — it should look like it belongs on a road, which is why it is funny on a plane.
- **Frames:** Six-frame walk, left to right in time order, seamless 6 → 1. Head bobs slightly counter to the stride.
- **Not:** Not a cartoon donkey. Not braying. Not cute.

### `cross-donkey-balk` — 26 × 22, 4 frames
- **What:** The same donkey stopping dead in the aisle for its own reasons.
- **Frames:** 1 mid-stride · 2 planted, all four feet · 3 planted, head turning slightly · 4 planted. **The body does not move forward at all.** Holds on frame 4.

### `cross-sheep` — 34 × 18, 6 frames
- **What:** Three or four sheep moving as one badly-organised object, flat side profile. Dirty cream fleece, thin legs, heads down. They overlap — this is one sprite of a small flock, not one animal.
- **Frames:** Six-frame walk, seamless. The flock's outline should ripple rather than move as a rigid block.

### `cross-camel` — 32 × 34, 8 frames
- **What:** A single dromedary camel in flat side profile, walking right. Sand-coloured, one hump, a rope halter, an expression of total contempt. **This is the tallest thing in the game at 34 units** and it must look it — its head should be near the top of its frame.
- **Frames:** Eight-frame walk, seamless. The classic camel pacing gait, both legs on one side moving together.
- **Not:** Not two humps. Not a cartoon. Not shorter than 34 — the joke depends on its height.

### `cross-camel-balk` — 32 × 34, 5 frames
- **What:** **The best gag in the set.** The camel has to duck under the overhead bins and does not enjoy it.
- **Frames:** 1 walking upright · 2 head starting down · 3 head and neck fully lowered, body hunched · 4 lowered, one slow blink · 5 beginning to rise. **The body must visibly compress** — this is the frame where it is obviously too tall for an aeroplane.

### `cross-goats` — 30 × 18, 6 frames
- **What:** Two or three goats, flat side profile, faster and worse behaved than the sheep. Mixed brown and white, horns, alert.
- **Frames:** Six-frame trot, seamless, quicker read than the sheep.

### `cross-chickens` — 26 × 12, 8 frames
- **What:** Four or five chickens at a flat run, low and fast, flat side profile. Brown and white, necks extended, wings half out for balance. **The fastest thing in the level** — faster than the player.
- **Frames:** Eight-frame run, seamless, legs a blur of overlap.
- **Not:** Not flying. Not neat.

### `cross-cart` — 30 × 24, 6 frames
- **What:** A hand-pushed vegetable cart with a man behind it, flat side profile, moving right. Two large spoked wheels, a canopy pole, crates of produce. He will not be hurried.
- **Frames:** Six frames — **the wheels rotate and the man walks; the cart body stays rigid.** Seamless.
- **Not:** No readable signage on the cart — it mirrors.

### `cross-tea` — 20 × 28, 6 frames
- **What:** A tea seller walking right, flat side profile, with a large ornate **brass urn strapped to his back**, tilted forward over his shoulder. Small glasses on a belt rack.
- **Frames:** Six-frame walk, seamless. The urn is rigid; he leans under its weight.

### `cross-tea-balk` — 24 × 28, 4 frames
- **What:** He pours one over his shoulder without looking and without stopping.
- **Frames:** 1 walking · 2 glass raised behind him · 3 a thin amber stream arcing from the urn spout into the glass · 4 glass lowered. **He never looks back and never breaks stride.**

### `cross-rug` — 44 × 26, 6 frames
- **What:** A man carrying a **rolled carpet that is longer than he is tall and longer than the aisle is wide**, flat side profile, held across his body. At 44 units this is the widest thing in the set, and that is the entire point of it.
- **Frames:** Six-frame walk, seamless. The rug sags and springs slightly.

### `cross-rug-balk` — 48 × 26, 5 frames
- **What:** It will not fit, and he has to turn it. Twice.
- **Frames:** 1 walking · 2 stopped, rug beginning to rotate toward the camera · 3 rug end-on, nearly vertical, foreshortened to a stubby cylinder · 4 rotating back the other way · 5 level again. **The rug's apparent width changes dramatically across these frames** — that is the read.

### `cross-bread` — 22 × 30, 6 frames
- **What:** A man walking right with a **large flat tray of ka'ak and bread rings balanced on his head**, flat side profile, one hand steadying it or not. Tall and narrow.
- **Frames:** Six-frame walk, seamless. **The tray stays perfectly level while the body moves under it** — that contrast is the whole character.

### `cross-bread-balk` — 22 × 30, 4 frames
- **What:** He adjusts the tray with one finger. Nothing falls.
- **Frames:** 1 walking, tray tilting slightly · 2 tray tilting further, clearly about to go · 3 one finger up, correcting it · 4 level again, walking on. **Nothing ever actually falls.**

### `cross-bicycle` — 26 × 24, 6 frames
- **What:** A man riding a battered bicycle down the aisle of an aeroplane, flat side profile. Upright frame, basket on the front, entirely matter-of-fact about it.
- **Frames:** Six frames — **wheels and legs rotate, the frame and rider stay rigid.** Seamless.

---

## 3. Background residents — 6 files

These **stand still in the cabin band** and never react to the player. That is
the rule the whole background rests on: a bystander who flinches is a game
element; one who carries on is the joke.

**All of them:** VIEW flat side elevation · FACES right (mirrored by the game) ·
GROUND bottom edge · **stationary — the body never travels** · seamless loop.

Two placements, and the art is the same file for both: **far** residents are
drawn at y=111 and **dimmed to 62% by the game**, near ones at y=128 at full
strength. **Deliver at full strength.**

### `bg-coffee-crew` — 34 × 26, 6 frames
- **What:** Three or four men sitting around a **fingjan on a small burner**, flat side profile, tiny cups in hand. Total calm. They are having coffee in the middle of a firefight and it is not worth mentioning.
- **Frames:** Six-frame idle loop: the pot goes round, a cup is raised, somebody shifts. **Nobody stands up and nobody looks out of frame.** Seamless.
- **Not:** No reaction to anything. No looking toward the viewer.

### `bg-donkey` — 26 × 22, 6 frames
- **What:** The same donkey as `cross-donkey`, but **standing still** — tethered or simply parked in the cabin.
- **Frames:** Six-frame idle: a tail flick, an ear twitch, a weight shift. **The feet never move.** Seamless.

### `bg-sheep` — 30 × 18, 6 frames
- **What:** A small standing flock, heads down, flat side profile.
- **Frames:** Six-frame idle: heads lift and lower out of sync. **No travel.** Seamless.

### `bg-porter` — 20 × 32, 6 frames
- **What:** A man carrying **an impossible stack of boxes taller than he is**, flat side profile, standing still and swaying under it. Tallest of the residents.
- **Frames:** Six-frame idle — **the stack wobbles and does not fall.** The wobble is the whole animation; his feet are planted. Seamless.

### `bg-argument` — 28 × 26, 6 frames
- **What:** Two men in a disagreement that will not be resolved, flat side profile, facing each other. Hands up, leaning in.
- **Frames:** Six-frame idle loop of gesticulation. **They face each other, not the viewer**, and neither ever wins.
- **Note:** This is the one asset where the two figures face opposite ways. The game mirrors the pair as a unit, which is fine.

### `bg-duck` — 3 frames, per-kind or one generic
- **What:** The **one sanctioned reaction** in the entire background: a blast goes off nearby and everybody drops for two seconds, then carries on.
- **Frames:** 1 upright · 2 crouching · 3 fully down. The game plays it forward to duck and backward to rise, so **it must read in both directions**.
- **Supply as:** either one generic crouch that can stand in for any resident, or a matching 3-frame duck per resident kind if you would rather they were specific.
- **Critical:** **The shawarma seller is exempt and must never duck.** He is already delivered; do not supply a duck for him. Everybody else flinching while one man keeps slicing is the joke.

---

## 4. The near layer — needs re-cutting, 5 files

`bg-<section>-near` as delivered is **a full row of seat backs half a screen
tall**. At the current framing it stands between the camera and the aisle: the
player fights behind a wall of upholstery and cannot see what they are shooting.
**It is currently not drawn at all**, which is why the bottom of the screen is
empty.

### `bg-<section>-near` — 960 × 540, 1 frame each
Sections: `economy`, `galley`, `business`, `first`, `cockpit`.

- **What:** The very tops of the nearest row of seat backs, running along the
  bottom of the frame — the row you are running past, not a room you are behind.
- **View:** Flat side elevation, same as everything else.
- **Critical:** **No more than 30 world units tall — about 82px in a 540px
  plate.** Everything above that must be fully transparent. The player stands at
  y=164 and is 26 units tall; anything taller than 30 in this layer covers them.
- **Not:** Not whole seats. Not a wall. A lip.

---

## 5. The aisle — 2 files, and the most valuable thing on this list

The strip the game is played on **has no art at all**. It is on screen for the
entire game.

### `dress-aisle` — 64 × 40, 1 frame, tileable L↔R
- **What:** The aeroplane aisle floor and the seat bases either side of it: worn carpet runner, a metal trim strip, the odd stain and scuff.
- **View:** Flat side elevation — this is the **face** of the floor strip, not a top-down view of carpet. You are seeing the aisle the way you see everything else here: from the side.
- **Ground:** The whole asset is floor. Its **top edge sits at y=164** and it runs down to the bottom of the screen.
- **Tiling:** Seamless left to right. Keep any distinctive stain away from both edges.
- **Critical:** **Dark and low contrast.** The player, six enemies, food and livestock all have to read against it.

### `dress-aisle-wrecked` — 64 × 40, 1 frame, tileable L↔R
- **What:** The same strip after a section has been fought through: scorch marks, spilled food ground in, a torn runner, scattered debris. Used in later cabins.
- Same view, ground, tiling and contrast rules.

---

## 6. Aisle obstacles — a new category

**These do not exist in the game yet, in art or in code.** They are the things
the player has to get around, on the player's own plane. I will build the
collision for them; this is what they need to look like.

**All of them:** VIEW flat side elevation · FACES right · GROUND bottom edge ·
**max 36 units tall** · must read as *interactive*, not as scenery.

### `aisle-luggage` — 24 × 18, 1 frame
- **What:** A hard-shell suitcase abandoned on its side in the aisle, one wheel missing, a luggage tag hanging off it. A trip hazard.
- **Not:** No airline branding or readable tag text — it mirrors.

### `aisle-luggage-open` — 28 × 18, 4 frames
- **What:** The same case burst open with clothes spilling out.
- **Frames:** Four frames of it bursting: 1 shut · 2 lid springing · 3 contents erupting · 4 settled. **Plays once, holds on 4** — frame 4 is what stays on the floor for the rest of the level, so it has to work as a still.

### `aisle-crate` — 20 × 20, 1 frame
- **What:** A duty-free crate taped shut, used as cover. Already delivered as `crate.png` — **only re-supply if it reads too small** against the new aisle.

### `aisle-spill` — 30 × 8, 3 frames
- **What:** A slick of spilled food on the aisle floor that the player slides on.
- **View:** Flat side elevation — seen **edge-on as a low glossy smear**, not from above as an ellipse. This is the one that is easiest to get wrong by importing the street-game habit.
- **Frames:** Three frames of a slow wet shimmer. Seamless loop.
- **Critical:** **Visible enough to be fair.** A slick the player cannot see is a slick the player resents.

### `aisle-cart` — 22 × 26, 1 frame
- **What:** A parked drinks trolley. Already delivered as `cart.png`; re-supply only if scale is off.

---

## 7. What is already delivered

**107 files, all loading and animating.** The cabins, characters, props, drops,
explosions, food and the six-enemy cast are in the game. `npm run art` reports
what landed and what still needs a pass.

**Do not re-render the characters.** Their frame counts are correct — 8-frame
run, 4-frame idle. When the animation looked bad it was playback, and that is
fixed. See the rate table in `ASSETS-FLIGHT404.md` for the speed each state
plays at, and cut new animation to read at those speeds.

---

## Delivery checklist

- [ ] **Flat side elevation, 0°.** Not the 3/4 view used by the street games.
- [ ] **Everything faces right.** No left-facing twins.
- [ ] **Ground line at the bottom edge.** No baked shadow.
- [ ] **Nothing on the aisle exceeds 36 world units tall** — the camel is 34 and
      is the ceiling.
- [ ] **The near layer is no taller than 30 units**, transparent above.
- [ ] Far residents delivered at **full brightness** — the game dims them.
- [ ] No text, numbers or logos on anything that mirrors.
- [ ] No baked window light or directional key on characters.
- [ ] Transparent background, trimmed, no padding.
- [ ] Sheets one row, equal widths, no gutters.
- [ ] **The player is 26 world units.** Check everything against it.
- [ ] **The shawarma seller gets no duck frames.**
