# Spec — input foundation and control scheme

Phase 1 and Phase 1b. The frame-accurate input layer, the animation contract, and the 8-way stick plus four buttons. Everything downstream depends on this.

Split out of `PRD-FIGHTER-DEPTH.md` on 2026-09-21, which had grown to 2,013
lines doing four jobs at once. That document is now the plan and the index;
this one is spec.

---

### Phase 1 — frame-accurate input and the animation contract · ~M

The foundation both the grapple and the defence game sit on.

- **A frame index** on `FightState`. We keep `elapsed` in seconds; every exact
  window wants the integer (§12.2).
- **Frame-stamped press history** replacing the four countdown timers, with
  `pressedWithin(action, start, end)`. A countdown can only say *is a press
  live now*; the grapple, the instant block and the sprawl all need to look
  backwards from a frame (§12.1).
- **Tap versus hold**, threshold around a fifth of a second. This is how weak
  and strong come off the same button, and it is what Phase 2 needs to
  distinguish a weak clinch from a strong one (§2.10).
- **The animation contract.** Every fighter carries `anim: AnimState` and a
  normalised `animT`. `AnimState` names every pose the game can be in — idle,
  walkFwd, walkBack, dash, jumpRise, jumpFall, land, crouch, jab, heavy, sweep,
  air, special, toss, grabWhiff, clinchWeak, clinchStrong, throwFwd, throwBack,
  sprawl, hitLight, hitHeavy, hitAir, knockdown, getup, blockHigh, blockLow,
  blockAir, instantBlock, ko. `drawFighter` switches on the name instead of
  inferring a pose from `move` plus an `armUp` scalar.

*Gate:* every existing buffer and focus check passes unchanged; a test asserts
every reachable fighter state maps to a declared `AnimState` with no fallback.

### Phase 1b — the control scheme: 8-way stick and four buttons

Researched 2026-09-21, rewritten twice. First draft borrowed Skullgirls and
Marvel Contest of Champions (tap / swipe / hold, two-finger block and break) —
rejected. Second draft borrowed CODM's five-button context cluster — also more
than we need. **This is the third and it is smaller than both.**

**One 8-way stick. Four buttons. Everything else derives.**

| | |
|---|---|
| **stick** | 8-way. Walk, retreat, crouch on down, and the direction read during a clinch |
| **PUNCH** | |
| **KICK** | |
| **JUMP** | |
| **BLOCK** | |

#### Why BLOCK as a button is the important change

Today the guard is *hold away from the opponent*, which welds defence to
retreat: you cannot advance behind a guard, and you cannot walk back without
guarding. Putting block on a button separates them, which is the Tekken and
Virtua Fighter model and is strictly more expressive.

It also **deletes the sprawl bug at its root.** `down + back` stops meaning two
things, because crouching is the stick and blocking is a button, and the two
are independent.

#### The grapple input

The instinct is right and it is the genre standard: **Virtua Fighter throws on
Punch + Guard, Tekken on 1+3, Dead or Alive on Free + Punch.** Two buttons
together *is* how fighting games do throws.

The catch is only on glass — two simultaneous presses in the same thumb cluster
is the same awkwardness that got the two-finger scheme rejected. So it splits
by device, and both map to one intent the simulation sees:

| device | grapple |
|---|---|
| **keyboard** | **BLOCK + PUNCH** — the Virtua Fighter convention |
| **touch** | **BLOCK held + stick toward them** — left thumb pushes in, right thumb guards |

The touch version is two thumbs each doing something natural, never two
fingers racing on one cluster. It is also thematically exact: you close the
distance behind your guard and end up tied up. Outside grab range the same
input is simply an advancing guard, which is useful on its own.

**Tap for a weak clinch, hold for a strong one**, as specced.

#### Everything else derives — no new buttons

| action | input |
|---|---|
| dash | double-tap toward on the stick |
| sweep | down + KICK |
| special | down + PUNCH at full meter |
| air attack | JUMP, then PUNCH or KICK |
| crouch-block | stick down + BLOCK |
| **clinch outcome** | **the stick direction held when the hold resolves** |
| **break** | **press BLOCK during the hold window** |
| **sprawl** | **enter crouch-block inside the timing window as their grab starts** |
| **instant block** | **press BLOCK within a few frames of the hit landing** |

Three of those deserve a note.

**The clinch outcome needs no button at all.** The fighters are frozen and the
stick is already under the thumb, so the direction you are holding when the
hold resolves picks the outcome — toward, away, down, up, or neutral. **Neutral
is the knee**, so doing nothing gives you the safe chip option rather than a
fumble. This is what the swipes and the context cluster were both reaching for,
and it costs nothing.

**The sprawl becomes a timed input rather than a held one**, which is what
stops a permanent crouch-block auto-sprawling every grab: it only counts if you
*entered* crouch-block within the window as their grab became active. Holding
it from earlier does not. That check is exactly what Phase 1's frame-stamped
history is for.

**The instant block is the same mechanic** — a defensive press judged on when
it arrived — so the two share one implementation. This is Marvel Contest of
Champions' parry, which is the one thing worth keeping from that draft.

#### What this deletes from earlier drafts

- The GRAB button. Four buttons, not five.
- Every two-finger input.
- Swipe recognition, and the whole class of gesture-ambiguity tests with it.
- The context-sensitive cluster as a *control* mechanism. It may still earn its
  place later as a **display** — showing the four clinch options while the hold
  is live is a readability aid, not an input.

#### Still worth taking from CODM

- **A floating stick**, appearing where the thumb lands. Measurably better than
  a fixed one (4.36 vs 4.07 ease of learning, 4.00 vs 3.85 satisfaction).
- **Customisable layout** — presets, per-button drag saved per player, size and
  opacity. Half of why CODM feels good.
- **Hit targets larger than the drawn art.**

#### Portability

This is a smaller, more general scheme than the cluster, so it ports further: an
8-way stick plus four buttons with tap/hold and button-pair inputs is a
complete vocabulary any of the sixteen games can draw from. Hoops already wants
three actions and a direction; Cart Race wants a stick and two; the runners want
a stick and one.

#### What to measure

Unit tests, not balance runs — the harness drives `FightInput` directly:

- **Pair detection**: BLOCK+PUNCH registers as a grapple and not as a block
  followed by a punch, across a realistic spread of press offsets.
- **No false positives**: a block and a punch a long way apart never read as a
  grapple.
- **Sprawl timing**: entering crouch-block inside the window sprawls; holding
  it from before the window does not.
- **Neutral default**: a clinch resolved with the stick centred always produces
  the knee.
- **Reachability**: stick and all four buttons inside the landscape thumb arc
  at the smallest supported screen.
- **Latency**: any input registers inside the existing buffer window.

---

## The animation contract — how the mechanics meet the engine

Audited 2026-09-21 by reading `components/minigames/engine/streetAnim.ts`,
`streetArt.ts` and `draw.ts`. **The engine is more capable than earlier drafts
of this plan credited it with**, and the gaps that remain are specific.

### What already exists

| need | engine |
|---|---|
| a clip that restarts when the state changes | `AnimClock { key, start }` + `frameFor(clock, id, t, frames, rate)` — **this is the state→clip machinery**, and earlier drafts wrongly said it was missing |
| once versus loop | `ONCE: Set<string>` and `loops(id)` |
| per-clip frame rate | `RATE: Record<string, number>` and `rateFor(id)` |
| **fit N frames into a duration** | `fitRate(frames, secs)` — exactly what a move needs |
| walk cycle keyed to real movement | `cycleRate(frames, speed, travel)` |
| desync repeated props | `phaseOf(id, frames)` |
| draw a sprite, or fall back | `actor()` takes `frame`, `elapsed` or `stride`, plus `facing`, `rotation`, `swap`, `hurt`, `height` — **and falls through to the procedural `figure()` with `armUp` / `crouch` when no sprite is loaded** |

So "art plugs in later" is **already real**: `actor()` draws the strip if it is
loaded and the procedural figure if it is not. A half-delivered set degrades to
today's look rather than to a hole.

**The model:** a clip *is* a sprite id — one horizontal strip per animation
state, its rate and loop flag registered in `streetAnim.ts`. `AnimState` → clip
is therefore a naming convention, not new machinery.

### What Phase 1 actually has to build

Smaller than feared:

1. `Fighter` gains `anim: AnimState` and an `AnimClock`.
2. `drawFighter` stops calling `actor()` with `frame: 0` and doing the rest
   through `armUp` / `crouch` / rotation, and starts calling `frameFor`.
3. The `AnimState` → sprite-id table, with rates and loop flags registered.

### Five real gaps, and the answers

**1. The clinch is two bodies in one pose — and the engine draws one sprite per
fighter.** This is the genuine integration problem, and it is the centrepiece
mechanic. A suplex or an armbar is a single interlocked image of two people; it
cannot be composed from two independently positioned sprites without looking
wrong. Three options:

- **Paired sprite** — one strip containing both fighters, drawn once, anchored
  to the pair. Best-looking, doubles the art per grapple move, and needs two
  palette ranges in one image so `swap` can recolour each fighter separately.
  `PaletteSwap` is already a map, so this works.
- **Authored offsets** — each grapple state carries a per-frame table placing
  the victim relative to the attacker. More flexible, much more authoring.
- **Attacker-drives** — the attacker plays a clip and the victim is posed from
  a small offset and rotation table. Cheapest, weakest.

**Recommendation: paired sprites with dual palette ranges.** It changes the art
brief, so it must be decided before anything is commissioned.

**2. Hit-stop does not freeze the animation.** `stepFight` runs
`s.elapsed += dt` **before** the hit-stop early return, and `drawFighter` reads
`s.elapsed`. So during a freeze the simulation stops and the sprite keeps
animating — which defeats the entire point of hit-stop and gets worse in Phase 3,
where freeze lengths grow and split by attacker and defender. **Animation must
run off a separate accumulator that hit-stop does not advance.** Worth checking
whether Hoops has the same bug.

**3. Held states need struggle progress, not just a loop.** A clinch is 16–20
frames but a choke lasts as long as it lasts. `loops()` handles the repeat;
what it cannot express is *how close to escaping* — arms shaking harder as the
break nears. `actor()` has no progress input. Answer: pass `frame` explicitly,
driven by the struggle value, instead of by the clock.

**4. Some poses are parameters, not clips.** Guard fatigue is the arm visibly
dropping — continuous, not discrete. The procedural `figure()` already takes
`armUp: number` and does exactly this, but a sprite strip cannot interpolate.
Answer: author the guard as a short strip where **frame index is the fatigue
level**, and drive `frame` directly. Same shape as (3). `blinded` is probably a
tint or overlay rather than a clip at all.

**5. Contact frames must align to the frame data.** A jab is 4 startup / 3
active / 6 recovery; the clip has to show the arm extended on frames 4–6, not
wherever the artist felt like it. `fitRate` scales a clip to a duration but
knows nothing about *which* frame is the hit. **The contract must record a
contact-frame index per clip** so it can be phase-aligned to `startup` — the
discipline `FIGHTER-RESEARCH.md` flagged from vibe-fighter and which nothing
has used yet.

### The contract, stated

Every `AnimState` declares:

| field | meaning |
|---|---|
| `clip` | sprite id, or null to use the procedural fallback |
| `loop` | repeat, or hold the last frame |
| `drive` | `clock` (wall time), `fit` (stretched to the move's duration), `param` (frame index driven by a value — struggle, fatigue) |
| `contact` | frame index of the impact, for phase alignment against `startup` |
| `paired` | whether this is a two-fighter interlocked pose |

That table is what an artist is briefed against and what the engine reads. It
is the thing that must exist before a single frame is commissioned.

---

## Sprites, or 3D? — decided 2026-09-21

**Stay 2D sprites at runtime. Use Blender as an authoring tool, not as an
engine. Do not go to Unity or Unreal.**

### Why not Unity or Unreal

**It means leaving the web app, and that breaks the product.** The fighter is
not a standalone game — it is one of sixteen mini-games sharing live player
state: health, street cred, heat, inventory, the hospital system, banking.
Unity WebGL builds are tens of megabytes and take many seconds to start;
Unreal removed HTML5 entirely in UE5 and has no meaningful web target at all.
Either route means a separate application or a heavy embedded blob with a state
bridge, loading **every time the player gets into a fight**. In a game where you
might fight three times in a session, that is fatal on its own.

**Consistency.** Fifteen other mini-games are pixel art at a small authored
scale (`ART_SCALE = 3`, figures around 24px tall). A real-time-3D fighter would
read as a different game bolted onto this one. Fixing that means redoing all
sixteen, which is a scope jump of a completely different order.

**We have already paid the expensive part.** `SPRITE-PIPELINE.md` puts it
bluntly, quoting the source it was adapted from: *"Image gen ≈ 20% of the work.
The other 80% is the pipeline."* We built that pipeline — frame normalisation
for drift, the PNG override registry, `check-art.mjs`, `ENTRIES`, `actor()`,
`streetAnim`. Starting a Unity project throws away the part that was hard and
keeps the part that was easy.

### The honest argument for 3D, which is real

**The grapple.** Two bodies in one interlocked pose is the single thing 3D
genuinely does better. Rig two figures in Blender, animate the interaction
once, and it is correct from any angle for any pairing. In sprites every
grapple move is bespoke art, and the move list has eight of them.

That argument is strong enough that it should not be waved away — but it does
not require a 3D *runtime*.

### Two ways to use Blender without changing the runtime

**(a) Render to sprites.** Model and rig in Blender, animate including the
two-body grapples, render each frame to a PNG strip, feed the existing
pipeline. **Zero runtime change** — it is still PNGs into `actor()`. This is
what Schwarzerblitz does, what Sakuga's README advertises ("supports 3D sprites
and 3D models"), and what Donkey Kong Country did thirty years ago. Cost: it
needs rigging skill rather than pixel skill, and the pre-rendered look is
distinctive enough to clash with hand-drawn art elsewhere in the game.

**(b) Blender as a posing and reference tool only.** Block the interlocked
grapple poses in 3D, render them as flat reference, and the pixel artist draws
over them. Keeps the art style exactly consistent, solves *how do two bodies
fit together* for the artist, and costs almost nothing.

### The recommendation

**(b), for the grapple poses specifically. Everything else stays hand-authored
2D.**

The art-consistency argument is the strongest one in this section, and (b)
takes the benefit of 3D — correct interlocked two-body poses — without taking
its cost. The grapple is the only place the problem exists.

**And the decision is reversible.** The runtime does not care where a PNG came
from, so if we later want the full render-to-sprite path in (a), nothing in the
engine changes. That is worth knowing before committing either way.

### One note on rendering headroom

If the *renderer* ever becomes the limit — it is not today — the in-family
upgrade is **Phaser 4, already a dependency** and already piloted on Flight
404. Not Unity. But two figures at 320×180 are nowhere near a draw-call
ceiling: our problems are design and animation source, not rendering.
