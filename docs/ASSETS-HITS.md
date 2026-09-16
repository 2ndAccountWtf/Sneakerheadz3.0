# Getting Hit — animation brief

Every character in every game, every object that can hit them, and what should
be drawn for each. One document, because "what happens when X hits Y" is a
question with the same shape in all four games and answering it four times in
four places is how they end up inconsistent.

**Everything below is read out of the code**, not invented: the durations are
the actual timers the simulation runs, the object lists are the actual obstacle
tables, and where a sheet already exists it is named so you do not draw it twice.
Where a number was a judgement call rather than a measurement it says so.

---

## Part One — the rules

### 1.1 The one idea

A hit animation has to answer two questions the player already knows the answer
to, or it looks wrong:

1. **Which way did I go?** Forward over the bars, or backwards over the nose.
2. **What hit me?** A wheelie bin and a parked car do not do the same thing to a
   body, and the player watched it happen.

Everything in this document follows from those two. It is why there are two
falls and two recoveries rather than one of each, and why the falls are sorted
by what caused them rather than by how much damage they did.

### 1.2 The four-beat crash

A crash in the street games runs as one continuous sequence, not one sheet:

```
  IMPACT ──► FALL ──────► SLIDE ──────► RECOVER ──► back to normal
  (effect)  (one-shot)   (loop)         (one-shot)
```

- **Impact** is an effect sheet, not a character animation — see §1.5.
- **Fall** ends on the ground. It must not loop; it plays once and holds.
- **Slide** is a cycle. It repeats for as long as the game says you are sliding,
  which varies, so it must start and end in the same pose.
- **Recover** ends standing. Plays once.

The game fits each sheet to its own slice of the crash window, so **a sheet with
the wrong number of frames is not wrong, it is just played faster or slower**.
Frame counts below are what reads well, not a hard contract.

### 1.3 Delivery

Same as `docs/ASSETS-STREET.md`, which you have already been working to:

- **3× the sizes given.** A 26px rider is delivered 78px tall.
- **`name@N.png`**, N = frame count. Frames left to right, evenly spaced, all the
  same width.
- **PNG with a real alpha channel.** No matte colour.
- Street-game files go in `assets/art/characters/`. They load automatically; no
  manifest to edit.
- **Anything not delivered keeps its current drawing.** Half a set is half an
  improvement, never a hole.

> **One exception, and it is important.** Rooftop Artillery does not use this
> loader and currently wants art at **1×**, not 3×. See `docs/ASSETS-ROOFTOP.md`
> §2 and the open question there. Do not draw rooftop characters to this
> document's scale until that is settled.

### 1.4 Ground line and facing

- **Ground line at the bottom of the frame**, at the contact point — wheels for a
  rider, feet for a figure, the body for something lying down.
- **A body on the ground still anchors at the bottom of the frame.** Do not
  recentre a fallen pose; the game draws every frame from the same origin, so a
  sheet that shifts its anchor mid-fall makes the rider jump.
- **Facing right.** The games mirror as needed.

### 1.5 Impact effects are separate

The flash, the dust, the water — those are their own sheets and they already
exist. **Do not draw them into the character frames**, or you get two of them.

| Effect | Id | Frames | Used for |
|---|---|---|---|
| Impact flash | `impact-star@5` | 5 | Every crash, both street games |
| Dust | `dust-plume@5` | 5 | Landing, ploughing into a hedge |
| Water | `splash-water@5` | 5 | Sprinkler, hydrant |
| Feathers | `feather-puff@4` | 4 | Hitting a dog or a bird |

---

## Part Two — Downhill Racer (`CartRace`)

Logical resolution 320 × 180. Rider drawn **30px tall** including the board.

### 2.1 The player: what hits him

Read from the obstacle table. `clear` is what gets you over it, and it is also
what decides which fall plays.

| Object | Damage | Clear by | Lane | Fall it causes |
|---|---|---|---|---|
| Parked Camry / van / wreck | 14 | nothing | kerb | **wall** |
| Car door | 12 | nothing | kerb | **wall** |
| AM/PM trolley bay | 13 | nothing | kerb | **wall** |
| Pedestrian | 9 | nothing | any | **wall** |
| Roadworks | 8 | ollie | any | trip |
| Wheelie bin | 6 | ollie | kerb | trip |
| Loose dog | 7 | ollie | any | trip |
| Thrown garbage (he lobs it back) | 6 | ollie | his lane | trip |
| Oil slick | 0 | hop | any | *no fall* — you lose steering, see §2.4 |
| Plywood ramp | 0 | — | any | *not a hazard* — it launches you |

**The rule the code uses:** anything you cannot clear at all is a **wall**.
Anything you could have hopped or ollied is a **trip**. That is the whole
distinction and it is deliberately simple, because the player can see it.

### 2.2 The player: sheets

Already delivered and in use — **do not redraw**:

`skateboard-obstacle-trip-forward@12`, `skateboard-front-collision-backward@12`,
`skateboard-balance-fall@10`, `skateboard-ground-roll@10`,
`skateboard-pushup-recover@8`, `skateboard-burpee-to-stand@10`.

Timings the game actually runs, so you know how long each is on screen:

| Beat | Window | Sheet |
|---|---|---|
| Trip fall | **0.50s** (first 66% of a 0.75s hit window) | `skateboard-obstacle-trip-forward` |
| Wall fall | **0.50s** | `skateboard-front-collision-backward` |
| Recover from a trip | **0.26s** (last 34%) | `skateboard-pushup-recover` |
| Recover from a wall | **0.26s** | `skateboard-burpee-to-stand` |
| Wipeout fall (run over) | **0.90s** | `skateboard-balance-fall` |
| Wipeout slide | until the end card | `skateboard-ground-roll` |

### 2.3 The player: what is still missing

#### `skateboard-hit-stumble@8` — 30 × 30, 8 frames
- **What:** Clipped, not felled. Board stays under him, one foot comes off, arms
  windmill, he gets it back. The cheap version of a crash.
- **Why:** Every contact currently costs a full 0.75s crash. A 6-damage wheelie
  bin and a 14-damage Camry look identical, which flattens the whole damage
  table into one event. This is the low-damage outcome.
- **Ground:** Wheels, bottom of frame. The board must stay on the road.
- **Frames:** 1 clip, 2–4 foot off and arms out, 5–6 worst of the wobble, 7–8
  back on the deck. Ends exactly where `skateboard-ride` frame 0 begins.
- **Not:** not a fall — he never touches the ground. Not a trick either.

#### `skateboard-ped-collide@12` — 34 × 30, 12 frames
- **What:** You and a pedestrian, both going down, tangled. Two bodies.
- **Why:** A pedestrian is the only obstacle that is a *person*, and hitting one
  currently plays the same animation as hitting a bin. It is also the joke.
- **Ground:** Bottom of frame, shared. The pair ends up in a heap.
- **Frames:** 1–2 contact, 3–6 both airborne and tangled, 7–9 landing, 10–12 the
  heap settling. The pedestrian may be a silhouette; he is not a recurring
  character and does not need a face.
- **Not:** not the pedestrian bouncing off unharmed — he goes down too.

#### `skateboard-oil-wobble@10` — 30 × 30, 10 frames, **loop**
- **What:** On the slick. Board squirrelling, knees loose, arms out for balance,
  going wherever it wants. Survivable, undignified.
- **Why:** Oil does 0 damage and takes your steering for **1.1s**, and right now
  nothing on screen says that has happened — the rider keeps his normal ride
  pose while the controls stop working, which reads as a bug.
- **Frames:** A cycle. Board slides left, right, left. Must loop seamlessly since
  the duration is fixed but the phase is not.
- **Not:** not a fall, not a crouch. He is fighting it and winning.

### 2.4 The thief (The Game, on the BMX)

Delivered and in use: `bike-ride@12`, `bike-fall-off@10`, `bike-banana-slip@12`,
`bike-look-back@8`, `bike-wheelie-sparks@10`, `bike-thumb-suck@8`.

He is hit by **AM/PM items you throw at him**. These are the weapons in the
game's own table, and each one currently plays `bike-banana-slip` regardless.

#### `bike-hit-chancla@10` — 34 × 30, 10 frames
- **What:** A sandal to the back of the head. Head snaps forward, hands come off
  the bars for a moment, bike weaves, he recovers and keeps going.
- **Frames:** 1 impact, 2–3 head forward, 4–7 the weave, 8–10 back on the bars.
- **Not:** he does not fall. Weapons scrub his speed; they do not stop him.

#### `bike-hit-slushie@10` — 34 × 30, 10 frames
- **What:** Wearing it. One hand off the bars wiping his eyes, riding blind and
  one-handed, shaking the hand off.
- **Frames:** 1 impact, 2–4 hand to face, 5–8 riding blind, 9–10 shaking it off.
- **Not:** not the same as the chancla — this one blinds him rather than hitting
  him, and the difference should be legible.

#### `bike-hit-heavy@12` — 34 × 30, 12 frames
- **What:** Something with real mass connects. Front wheel slews, he goes up onto
  the pedals fighting it, nearly loses it, saves it.
- **Use:** the shared "big weapon" reaction for anything the chancla and slushie
  sheets do not cover.
- **Not:** not `bike-fall-off` — that one is reserved for his own crashes, which
  are the only thing that genuinely stops him.

---

## Part Three — Pizza Run

Logical resolution 320 × 180. Rider drawn **30px tall**.

### 3.1 What hits the player

| Object | Clear by | Fall it causes |
|---|---|---|
| Slow Camry | nothing | **wall** |
| Oncoming taxi | nothing | **wall** |
| Car door | nothing | **wall** |
| Slower skater | nothing | **wall** |
| Wheelie bin | hop | trip |
| Loose dog | hop | trip |
| Hydrant | hop | trip |
| Roadworks | ollie | trip |
| Runaway trolley | ollie | trip |
| Sprinkler | ollie | trip |
| Planter | ollie | trip |

The crash window is **0.85s**: fall 0.34s, slide 0.26s, recover 0.25s. Same
sheets as Downhill Racer — the rider is the same person on the same board, and
sharing them is deliberate.

### 3.2 Still missing

#### `skateboard-hit-skater@12` — 38 × 30, 12 frames
- **What:** Two skaters, both down, two boards loose. You went into the back of
  somebody slower.
- **Why:** it is the only obstacle in this game that is another rider, and it is
  the one crash that should look embarrassing rather than painful.
- **Frames:** 1–2 contact, 3–6 both up and tangled, 7–9 down, 10–12 two boards
  rolling away in different directions.
- **Not:** not a wall impact — he is moving the same way you are, so this is a
  rear-ending, not a head-on.

#### `skateboard-soaked@8` — 30 × 30, 8 frames, **loop**
- **What:** Riding on, drenched, shaking water off. No crash.
- **Why:** a sprinkler is a nuisance rather than a hazard and there is nothing on
  screen saying you got wet.
- **Not:** not a crash. Board never leaves the ground.

#### `pizza-bag-spill@6` — 20 × 16, 6 frames
- **What:** Boxes leaving the bag and hitting the deck. Prop only, no rider.
- **Why:** a crash costs you a box — the simulation decrements your ammo — and
  the box currently just disappears from the counter.
- **Ground:** Bottom, where the boxes land.

---

## Part Four — Flight 404

Logical resolution 352 × 198. This game runs on Phaser and has a real animation
system: a state named here becomes a playable animation automatically.

### 4.1 The player (26px tall)

`player-hurt` is delivered and plays at **14fps** for every source of damage:
a thrown item, a body check, standing in a hazard, a boss hit. Four different
things, one reaction.

#### `player-hurt-thrown@6` — 26 × 26, 6 frames
- **What:** Something hit you from a distance. Recoil away from it, arm up late.
- **Faces:** The recoil direction is set by the game, so draw it taking the hit
  from **screen right** and it will be mirrored when it comes from the left.

#### `player-hurt-body@8` — 26 × 26, 8 frames
- **What:** Shoulder-charged. Knocked bodily off your line, feet leave the floor,
  you land on your feet still moving.
- **Why:** the hypebeast charge is the hardest hit in the game at 14 damage and
  it plays the same 5-damage flinch as a thrown shoe.

#### `player-hurt-hazard@6` — 26 × 26, 6 frames, **loop**
- **What:** Standing in something. Hopping, one foot then the other, arms out.
- **Why:** hazard damage ticks at 4 a time for as long as you stand there, so
  unlike every other hit this one repeats and must loop.

### 4.2 The cast: what is missing

Every enemy has `die`. **None of them has a non-fatal hit reaction**, so a
27-damage scalper absorbing a shot and a scalper dying both look like nothing
until he falls over. One sheet each, 4–6 frames, ~14fps:

| Id | Size | Frames | What |
|---|---|---|---|
| `scalper-hit@5` | 24 × 26 | 5 | Staggers, camera swings on its strap |
| `hypebeast-hit@5` | 28 × 30 | 5 | Barely notices, half a step back, angrier |
| `security-hit@5` | 26 × 28 | 5 | Absorbs it on the vest, baton drops to guard |
| `owner-hit@5` | 26 × 26 | 5 | Flinches behind his arms, still shouting |
| `reseller-hit@4` | 22 × 26 | 4 | Clutches the bag first, himself second |
| `yasser-hit@6` | 30 × 34 | 6 | Megaphone swings wide, recovers into a pose |

- **Faces:** right, recoiling **leftward** — struck from the front.
- **Not:** not a death. Every one of these ends back in the pose its `idle` sheet
  starts from, or the return to normal snaps.

### 4.3 Livestock crossings hitting the player

Ten things cross the cabin. If one reaches you, nothing happens — there is no
animation and arguably no collision. Two sheets cover all ten:

#### `player-trampled@10` — 30 × 26, 10 frames
- **What:** Put on the floor by something with legs. Use for donkey, sheep,
  camel, goats, bicycle.
- **Frames:** 1–2 contact, 3–5 going down, 6–8 flat while it passes over, 9–10
  sitting up.

#### `player-doused@8` — 26 × 26, 8 frames
- **What:** Wearing the tea, or the bread tray, or the contents of the cart.
  Use for tea, bread, cart, chickens, rug.
- **Not:** not a fall. Indignity, not damage.

---

## Part Five — priority

If you draw them in this order, each one is the biggest remaining visible gap:

1. `skateboard-hit-stumble@8` — makes the damage table legible in both street games
2. `scalper-hit@5`, `hypebeast-hit@5`, `security-hit@5`, `owner-hit@5` — Flight 404 has no hit reactions at all
3. `skateboard-oil-wobble@10` — an active bug: controls change with no visual tell
4. `bike-hit-chancla@10`, `bike-hit-slushie@10` — makes your weapons feel different from each other
5. `player-hurt-body@8` — the hardest hit in Flight 404 reads as the softest
6. `skateboard-ped-collide@12`, `skateboard-hit-skater@12` — the two crashes that are jokes
7. Everything else

---

## Checklist

- [ ] Authored at **3×** the sizes given (street games; **not** Rooftop — see §1.3)
- [ ] `name@N.png`, N = the real frame count
- [ ] Frames evenly spaced, all the same width
- [ ] Real alpha channel, no matte
- [ ] Ground line at the bottom of the frame, same anchor in every frame
- [ ] Facing right
- [ ] One-shots end where the following state begins
- [ ] Loops start and end in the same pose
- [ ] No impact flash, dust or water drawn into the character frames
