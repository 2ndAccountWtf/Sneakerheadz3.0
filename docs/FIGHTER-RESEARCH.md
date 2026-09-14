# Fighter research — what to borrow for the rebuild

Research date: 2026-09-14. Every claim was verified by cloning the repository and reading
the code, or by fetching the page. Anything I could not confirm is in the last section,
not guessed at.

---

## The short version

Ten open-source browser fighting games were examined. **Nine of them have shallower
fighting-game systems than `components/minigames/StreetFighter.tsx` already has.** Most are
not fighting games at all — they are sprite-animation demos with a health bar.

So the question is not "whose fight engine should we borrow". Ours is ahead. Counting
identifier mentions across the closest Phaser 4 competitor's whole `src/` versus our single
file: `recovery` 0 vs **18**, `hitbox` 2 vs **14**, `combo` 8 vs **24**, `cancel` 11 vs
**24**, `blockstun` 4 vs **10**, `startup` 9 vs **23**.

**The gap is animation and the art/sim contract, plus input depth.** And there is a
specific, verified explanation for why a mechanically-rich fighter can still feel lame —
see "The real gap" below. It is not a missing system. It is that the sprite can finish
before the hitbox does.

Two things are worth taking, both permissively licensed:

1. **`roiizchak/vibe-fighter`** (MIT) — the art/sim sync discipline: animation length
   *derived* from move duration, and a contact-frame measurement that phase-aligns the
   strike to the first active tick.
2. **`RyoSogawa/use-street-fighting-command`** (MIT) — a 30-line pure motion-input matcher
   covering quarter-circles, dragon punches and **charge moves**.

Everything else is design-only or legally untouchable.

Also worth stating plainly: `StreetFighter.tsx` **has no test file**. `npm test` runs twelve
suites and none touches the fighter. The pure-logic pattern is there (`createFight` /
`stepFight`, injected RNG); nothing exercises it.

---

## The real gap: why a deep fighter still feels lame

This is the most useful thing the research turned up, and it is not a mechanic.

`roiizchak/vibe-fighter` documents a bug it shipped and then fixed, in
`src/render/anim-timing.ts`:

> The authored numbers had drifted badly and it was VISIBLE, not cosmetic: every fighter's
> `attackLight` needed 0.43s of animation but the move only lasts 0.25-0.27s, so playback
> was cut off at ~60% — **the sprite showed the wind-up and snapped back to idle before it
> ever struck, which reads as "the light attack does nothing"**. `crouchHeavy` had the
> opposite skew (0.40s of art over a 0.53s move), finishing early and then freezing on its
> last frame — "the move runs too quickly".

And a second, separate defect measured by `scripts/check-attack-sync.py`:

> 13 of 18 shipped attacks had the hit box go active roughly one render frame **before** the
> sprite reached full extension, so the strike connected on a wind-up pose.

Both are *phase and duration mismatches between the animation and the frame data*. Neither
is fixed by adding a mechanic. Both produce exactly the complaint "this feels lame" from a
game whose frame data is correct on paper. **This is the first thing to check in our
fighter**, and it applies identically to code-drawn art — a `drawFighter` that picks a pose
by elapsed time rather than by the move's current frame window has the same disease.

Their two fixes are both worth copying as *approach*:

- **Derive the animation rate from the sim, never author it.** `stateFrameRate()` computes
  `rate = (frames × 60) / attackSimTicks(move)`. The sim owns the timing; the art is
  stretched to fit it. A test (`anim-timing.test.ts`) fails when the two drift apart.
- **Measure the contact frame and align it to the first active tick.** `check-attack-sync.py`
  finds the frame where the silhouette's forward reach peaks, and starts that frame on the
  first ACTIVE tick. Crucially, when the metric cannot decide (a wide stance where the
  trailing leg, not the fist, is the furthest point) **it reports INDETERMINATE and keeps
  the old timing rather than writing a guessed value.**

---

## (a) Animation and asset pipeline — is any of it worth copying?

**Yes, one project's, and only the parts above plus its QA scripts.** The two Phaser 4
fighters take opposite approaches and one is clearly better.

### chongdashu/vibe-fighter — the conventional approach

`src/game/fighterCharacter.ts` registers per-action spritesheets on a shared **256×256
frame layout** (`FRAME_WIDTH`/`FRAME_HEIGHT` constants), builds one Phaser animation per
action via `makeAnimation(config.id, spec, ...)` keyed by `animationKey(id, action)`, and
ships **86 asset files** in `public/` including UI atlases with manifests.

It is clean and it is the real difference between their game and ours. But the timing
contract runs the wrong way: their frame data is attached to the sprite sheet as
`animation.bounds[]` entries of `{ frame, attack }`, and the fight logic reads its current
frame back *off the renderer* with `Number(this.sprite.frame.name)`. Art and frame data are
welded together — you cannot retune a move without touching the atlas — and the fight
becomes untestable. **Copy the layout discipline, not the direction of the dependency.**

### roiizchak/vibe-fighter — the better approach

Sheets are declared in a JSON registry as `render.sheets.<state>` with `{ frames, fps, hit }`,
and the render layer derives playback rate from the sim. The generation half of the pipeline
(Higgsfield/Seedance image-to-video, `ffmpeg` frame sampling, `scripts/build-sprites.py`,
`scripts/build-atlases.py`) is **irrelevant to us** — our art is code-defined pixel art, we
have no sheets to pack.

What *is* transferable is the **auditing layer**, which is unusually good and is MIT
(`scripts/` is explicitly inside their MIT grant):

| Script | What it enforces |
|---|---|
| `check-attack-sync.py` | the strike pose lands on the first active tick |
| `audit-animations.py` | four named failure modes: *barely-moves*, *held-frozen*, *dead frames*, *unreadable* |
| `check-sprites.py` | fails an attack sheet below a minimum motion threshold |
| `audit-boxes.py` | box geometry sanity across the roster |

The `audit-animations.py` header is a list of bugs that shipped with every gate green:
`monk/crouchLight` was "four identical squats, so the sim ran a live hit box for 16 ticks
over a still image"; two crouch-block animations shipped as four identical frames "because
nothing measured them at all"; and `brawler/attackLight` scored a perfect art/sim ratio
while spending three wind-up frames on **one tick each** — 16.7 ms, a single refresh, and
therefore invisible.

**The transferable idea: measure whether the animation actually changes, and whether each
pose gets enough ticks to be seen.** For code-drawn art that is even easier than for
sprites — we can call `drawFighter` into an offscreen canvas per tick and diff the pixels.
That is a test we could write this week, and it would catch "the move is a still image" and
"three poses flash past in 50 ms" automatically.

**Verdict on (a): copy the approach, write our own scripts. There is no asset pipeline to
lift because we have no assets — but the art/sim *contract* and its automated audits are
exactly our gap, and they are the best-documented part of any project found.**

---

## (b) Input buffer and motion inputs

The brief is right that this is a depth gap on both sides. Neither Phaser 4 fighter has
motion inputs at all. I checked `roiizchak/vibe-fighter` directly: grepping its entire
`src/` and `docs/sim-invariants.md` for `quarter|qcf|motion input|charge|236|dragon punch`
returns only CPU reaction-timer comments. **It has no quarter-circles and no charge moves.
Special is a dedicated button.**

### What vibe-fighter does have: a correct edge latch (MIT)

`src/scenes/edge-latch.ts` — 60 lines, Phaser-free by design so it can be unit-tested in
Node. It is not a lookahead buffer; it keeps a rising edge alive until the sim *actually
consumes it*, per button:

```ts
/** Clear ONLY the edges the sim actually acted on this frame (World.consumedInputs[i]). An edge the
 *  fighter could not act on — because it was locked in an attack or stun — stays buffered until it
 *  can, which is what makes a light→heavy reliable instead of dropping the heavy pressed during the
 *  light. Replaces the old "clear the whole latch on any fight tick", which threw the heavy away. */
```

**This is a bug we currently have.** `useInput.consume()` clears on read, so a button pressed
during hitstop or during our own move's recovery is discarded. That is felt directly as
"the game dropped my input", and it is another strong candidate for the "lame" complaint.
Two further details they paid for: the crouch stance is captured at the moment the edge
latches (so a buffered crouching normal does not come out standing if you release down),
and a special edge is reported consumed **even when the move was refused for empty meter**
— otherwise it fires itself the instant the bar fills.

### The motion-input answer: RyoSogawa/use-street-fighting-command (MIT)

<https://github.com/RyoSogawa/use-street-fighting-command> — MIT (Copyright (c) 2025
RyoSogawa; `LICENSE` file *and* `package.json` `"license": "MIT"`), 45 commits, last commit
2025-12-14, 760 KB, 2,258 lines including tests, published on npm.

Covers hadouken (↓↘→+P), shoryuken (→↓↘+P), tatsumaki (↓↙←+K), **charge moves**
([4]6P sonic boom, [2]8K spinning bird kick) and super sequences, each with a configurable
window (500 ms default, 800 ms for supers).

The valuable part is `matchesSequence` in `src/useCommand.ts` — **about 30 lines, pure, no
React, no DOM**. It takes a buffer of `{direction, punch, kick, timestamp}`, filters to the
window, requires the button on the *last* input, and matches the directions as a
**subsequence** of what came before — which is precisely where the leniency comes from, since
intervening junk inputs do not break the motion.

Honest limitations, all easy to fix but real:

- **Wall-clock `timestamp` in milliseconds, not integer ticks.** As shipped it is not
  tick-deterministic, so it cannot go into a pure `stepFight` unmodified.
- Sequences are hardcoded per side (`sequence1P` / `sequence2P`) rather than mirrored by
  facing — the same hack `sf3js-old` used. A facing-relative mirror is cleaner.
- Button vocabulary is only `punch | kick`; we have `a`/`b`/`c`.
- The public API is React hooks bound to a keyboard listener — the wrong shape for us,
  since our input must come from a touch pad too.

**Verdict on (b): do not take the npm dependency. Read `matchesSequence`, reimplement it in
tick units against our own buffer — it is 30 lines — and pair it with vibe-fighter's
consume-what-was-acted-on latch semantics.** That combination is the whole input gap, and
both sources are MIT.

A note on the obvious alternative: **Phaser's built-in `KeyCombo`** genuinely exists in our
installed 4.2.1 (`node_modules/phaser/types/phaser.d.ts:84279`, with `maxKeyDelay`,
`resetOnMatch`, `resetOnWrongKey`). But its constructor takes a
`Phaser.Input.Keyboard.KeyboardPlugin` — **it consumes keyboard events and nothing else**,
so it cannot see a touch pad. And `sf3js-old` shows the trap in practice: it registers a
fresh `keyboard.on('keycombomatch')` listener inside a function called every frame — a
listener leak per tick.

---

## (c) Phaser or raw canvas? Raw canvas. The trade is not worth it.

Stated plainly, because the evidence is now unambiguous:

**Phaser buys animation and atlases. It buys nothing for hit detection. It costs the pure
headless `stepFight` testability.**

- **Nothing for hit detection, confirmed in both Phaser fighters.** chongdashu builds plain
  `Phaser.Geom.Rectangle`s and does its own overlap test
  (`Phaser.Geom.Intersects.RectangleToRectangle` in `MatchScene.ts`); arcade physics drove
  the jump arc and nothing else. Per-frame hitboxes, the move state machine,
  hitstun/blockstun/hitstop, cancel windows, meter, high/low blocking and pushbox
  separation are hand-rolled in **every** implementation examined, Phaser or not.
- **The one fighter-specific feature it does offer is unusable for us** — `KeyCombo` is
  keyboard-only, and we must work on a 412px phone.
- **Its animation system actively inverts the dependency.** Used the obvious way it becomes
  the timing authority (`Number(this.sprite.frame.name)`), which is what makes chongdashu's
  combat untestable: **three test files in the whole repo and zero combat tests.**
- **We have direct in-repo evidence of the cost:**

| | Flight 404 (Phaser) | Hoops (raw canvas, pure) |
|---|---|---|
| Structure | one `gameScene.ts` of **98 KB**, 62 direct scene/physics calls | `createWorld` / `stepWorld`, pure |
| Pure core | **none** (`content.ts` is constants only) | yes |
| Tests | **none** | 3 suites; `hoops.test.mts` plays **40 headless seasons** |

The one game in this project built on Phaser is the one game with no pure core and no
tests.

**The hybrid does work** — `roiizchak/vibe-fighter` runs Phaser 4.2.1, our exact version,
purely as a render and input adapter with a Phaser-free `src/sim/`, and gets 473 Vitest
tests in Node plus 22 Playwright specs. The boundary is enforced by the test runner itself:
the sim suite runs in the `node` environment, so a stray Phaser import fails immediately.
The contract runs the right way round — `InputSnapshot` is **defined in `sim/types.ts`** and
merely *filled in* by the Phaser layer.

But it buys us nothing here, because **its single payoff is the sprite-animation system and
we have no sprites.** Our art is `ctx.fillRect` pixel art. Phaser would cost ~330 KB gzipped
lazy-loaded, a second rendering idiom alongside every other mini-game, and an ever-present
temptation to let the renderer own the clock — in exchange for an atlas player we cannot
use.

**Recommendation: keep raw canvas and build a proper sprite-animation layer of our own** —
meaning a small, pure, state-to-pose table with per-move frame counts *derived from the
frame data*, which `drawFighter` reads. That is maybe 150 lines and it is the thing that
actually closes the gap. `useGameLoop.ts` already gives us a correct fixed-60 Hz accumulator
with clamped catch-up, which is the only other piece Phaser would have replaced, and ours
is right.

---

## Licence table

| Project | Code licence | Asset licence | Status |
|---|---|---|---|
| **RyoSogawa/use-street-fighting-command** | **MIT** (LICENSE + package.json field) | n/a | **MAY USE** |
| **roiizchak/vibe-fighter** | **MIT** (author's own; covers `src/`, `scripts/`, `e2e/`, `vite/`, `docs/`) | Proprietary, all rights reserved (explicit separate file) | **MAY USE code** (provenance caveat below). Assets: **MAY NOT** |
| **Pyxus/fray** | MIT | n/a | MAY USE — but GDScript, not portable. **Reference only** in practice |
| **ikemen-engine/Ikemen-GO** | MIT engine / CC-BY 3.0 screenpack | Clean | MAY USE — but Go, no web build. **Reference only** in practice |
| **chongdashu/vibe-fighter** | **NONE** → all rights reserved | **NONE stated** | **REFERENCE ONLY** |
| **samurai-js/sf3js-old** | MIT file is Phaser's template (©2017 Richard Davey), not a grant over the game code | **Ripped Capcom SF3** | **MAY NOT USE** — design ideas only |
| **zkfazal/phaser-games** (Brutal Brawl) | MIT file says "Copyright (c) 2024 **Phaser**" — the template's | **Ripped Capcom** (Ryu, Cammy, Chun-Li) | **MAY NOT USE** |
| **stevengregory/street-fighter-demo** | **NONE** | **Ripped Capcom SF3** (Dudley) | **MAY NOT USE** |
| **mkhandotnet/StreetPhyter** | None found | **Ripped Capcom** SF2 + Alpha 3 | **MAY NOT USE** |
| **alfredang/street-fighter-game** | **NONE** | AI-generated (no Capcom risk, no grant either) | **MAY NOT USE** |
| **jdotrjs/phaser3-hadoken** | **CC BY-NC 3.0 — non-commercial only** | n/a | **MAY NOT USE** |
| **jonathanneels/Fist-First** | "Creator's Clause" — commercial use owes a royalty | n/a | **MAY NOT USE** |

**Provenance caveat on roiizchak/vibe-fighter.** Its own `prompts.txt` says the build began
from a "Free pack from VibeGameDev" and its Phase 00 docs say the starter's per-frame box
system was "reused, not rewritten". `vibegamedev.com` is egress-blocked here, so I could not
read that pack's terms and cannot fully confirm the author had the right to place the
inherited portion under MIT. This does not affect using it as a design reference. It does
affect copying its code verbatim — which, given the recommendation is to copy *approach*,
is not something we need to do.

### The ripped-sprite problem, specifically

Four of the Street Fighter clones ship **Capcom's actual sprites**, and none says so in its
licence. The evidence is concrete, not inferred:

- **Brutal Brawl** — its own `references.html` links
  `spriters-resource.com/snes/supersf2/sheet/5557/` as the source of `Ryu_spritesheet.png`.
  Atlas frames are named `Cammy_60_01..07`; `chunli.png` is a 1926×1446 sheet of 640×480
  `anim0XX` frames. Ryu, Cammy and Chun-Li are Capcom characters.
- **street-fighter-demo** — `src/assets/character/dudley.png`, with sprites named
  `jet-uppercut.png` and `corkscrew-blow.png`. Dudley is a Capcom SF3 character and those
  are his actual move names.
- **sf3js-old** — Akuma stage layers, SF3 super-art and fireball atlases.
- **StreetPhyter** — README states outright it uses "Street Fighter 2 and Street Fighter
  Alpha 3 sprites".

An MIT `LICENSE` file in the repo root launders none of this. **In three of the four cases
the MIT file is not even the author's** — it is the unmodified Phaser starter template,
still carrying Phaser's or Richard Davey's copyright line. Check who the copyright holder
is, not just that a licence file exists.

---

## Candidate notes

### chongdashu/vibe-fighter — reference only

<https://github.com/chongdashu/vibe-fighter> · 2 commits · last 2026-06-05 · 33 MB ·
11,733 lines TS · Phaser 4.0.0, Vite 8, TypeScript 6

> **Name collision warning.** A *different repository* from `roiizchak/vibe-fighter` despite
> the identical name. They are **not** forks of each other — I compared them file by file
> (different architectures, different `InputSnapshot` shapes, `fighter.ts` 366 lines pure vs
> 1,098 lines Phaser-fused). One is MIT; one has no licence. Do not let anyone conflate them.

No-licence finding confirmed three ways: no `LICENSE`/`COPYING`/`NOTICE` anywhere in the
tree, no `license` field in `package.json` (the package is named `vgd-phaser-starter` v0.3.0),
and no licence statement in the README. Default copyright applies.

Architecture, which is why it is worth reading: fight logic fused to Phaser
(`import * as Phaser from 'phaser'` atop `fighter.ts`, ~60 direct Phaser references);
Phaser's animation system as the frame-timing authority; hand-rolled rectangles for hit
detection; frame data welded to the sprite sheet; **timing in float seconds, not integer
ticks** (`BLOCKSTUN_SECONDS = 0.14`, `KNOCKBACK_FRICTION = 720` px/s²); and an
`InputSnapshot` that is still a *platformer's* (`run`, `jump`, `attack`, `confirm`, `cancel`,
`pointerDown`) — the fighter was bolted onto a platformer starter and it shows. Three test
files, zero combat tests.

### roiizchak/vibe-fighter — the one good one

<https://github.com/roiizchak/vibe-fighter> · 48 commits · last 2026-08-03 · 43 MB (almost
all art) · ~14,750 lines TS · Phaser 4.2.1, Vite, TS strict, Vitest + Playwright

Purity verified, not taken on trust: grepping `src/sim/` for `Phaser`, `Math.random`,
`Date.now`, `document.`, `window.` returns **only comments stating those are not used**, plus
a seeded xorshift32 in the CPU. ~2,400 lines of pure sim carrying **473 Vitest tests across
24 files in the `node` environment**.

Mechanics: 19 states incl. `block`/`blockCrouch`/`hitstun`/`blockstun`/`knockdown`/`ko`;
seven attack slots (ground/air/crouch × light/heavy + meter special); per-attack
startup/active/recovery/damage/hitstun/blockstun/hitstop/knockback/chip; **per-frame box
sets** (`hurt[]`, `push`, `hit[]`, `guardStand[]`, `guardCrouch[]`); **high/low decided by
box geometry, not labels**; multi-hit via per-window `hitId` dedup with `repeat {count, gap}`;
a `freeze` super-freeze distinct from `hitstop`; pushboxes with corner resolution; a
documented, test-enforced `tick()` step order.

One hard-won geometry detail worth writing down: a guard box's `x` span **must cover the
body** (`x -32, w 90`), not sit as a thin forward slab — a forward-only guard box left every
attack unblockable at the separations where pushboxes touch, i.e. exactly where the match is
actually played, while still passing every test that measured blocking from poking range.

### samurai-js/sf3js-old — design only

<https://github.com/samurai-js/sf3js-old> · 60 commits · last 2021-04-26 (**dead**) · 14 MB ·
1,303 lines JS · Phaser 3

Legally worthless (template MIT, Capcom art), but its **per-move data model is the best
found** and beats ours in three specific ways:

```js
{ name: 'smp', hitbox: { start: 2, active: 3, hits: [5], damage: 50, stun: 15,
  onBlk: 1, onHit: 6, push: 15, atklvl: 'h' } }
```

1. **Frame advantage as `onHit` / `onBlk`** rather than absolute hitstun — how people who
   balance fighting games actually express it.
2. **Per-state hurtbox overrides** — `crouch` carries its own
   `hurtbox: { x: 0, y: 20, width: 40, height: 60 }`. Ours is fixed, so crouching is
   currently cosmetic.
3. **`hits: [5]` / `[6,7]` / `[7,8,9]`** — multi-hit as the list of connecting frames.

Characters also carry `health`, `stun` and `power` as three separate resources, so dizzy and
super meter are distinct systems.

### Rejected

- **zkfazal/phaser-games ("Brutal Brawl")** — the owner sent this. **It is not a game.** 654
  lines, 7 commits, dead since 2024-06-26. Grepping all of `src/` for
  `hitbox|hurtbox|damage|health|combo|block|attack|punch|kick|state` returns exactly two
  hits, both a variable named `attackAnimationConfig` used to build the **idle** animation.
  `Game.ts` has no `update()` at all: it draws a background and one idle-looping sprite. No
  second fighter, no health, no collision, no attack. Matter.js debug rendering still on.
  Final commit message: "Fixed the first player sprite, so now it actually shows a person
  with a correct bounding box."
- **stevengregory/street-fighter-demo** — alive, on our stack, 562 lines. Grepping for
  `collision|hitbox|opponent|damage|player2|hurt` returns **nothing**. No hit detection, no
  second character. A one-player animation showcase with Capcom's Dudley and no licence.
- **alfredang/street-fighter-game** — 1,008 lines, AI art so no Capcom risk, but no licence.
  One `attackBox` vs a whole-body rect, flat `health -= 20`, no blocking, no frame windows;
  "combo" is a hit counter in a DOM element.
- **mkhandotnet/StreetPhyter** — dead since 2020, ripped SF2/Alpha 3 sprites, and its README
  lists "a sophisticated hitbox and hurtbox system" and "blockstun" as *planned future work*.
- **jdotrjs/phaser3-hadoken** — a motion-input matcher, exactly the right idea, but
  **CC BY-NC 3.0** and Phaser 3, untested against Phaser 3.16's input rewrite.
- **jonathanneels/Fist-First-Fighting-Engine** — real features, but a bespoke "Creator's
  Clause" requiring a commercial royalty. Not open source.

### The ecosystem is genuinely empty

Worth stating because it shapes the recommendation. A GitHub search for TypeScript
repositories containing hitbox/hurtbox/frame-data code with more than 5 stars returns **zero
results**. `topic:fighting-game language:TypeScript` returns 28 repositories, mostly
combo-notation tools, MUGEN utilities, Three.js projects and API wrappers — not 2D fighters.
There is no well-trodden, well-licensed browser fighter to stand on.

---

## Recommendation

### (a) Rebuild in place. Borrow approach, not code.

Keep `StreetFighter.tsx`'s simulation — it is better than almost everything published — and
spend the effort on the animation contract and the input layer, which is where the game
actually feels bad. Do not adopt anyone's engine: seven candidates are legally unusable, and
the two clean ones are a Godot addon and a sprite-based Phaser game whose renderer has
nothing in common with ours.

Priority order:

1. **Fix the art/sim phase and duration.** Derive each move's on-screen pose count from its
   `startup + active + recovery`, and make sure the strike pose lands on the **first active
   frame**, not before it and not after the move has ended. This is the likeliest single
   cause of "lame".
2. **Fix input consumption.** Replace `useInput.consume()`'s clear-on-read with
   clear-on-*acted-upon*, per button, so a press during hitstop or during our own recovery
   survives. Capture the crouch stance at the moment the edge latches.
3. **Per-state hurtboxes** (from sf3js) — crouching should shrink you.
4. **Per-frame guard boxes, geometric high/low** (from vibe-fighter), with the guard box
   spanning the body rather than a forward slab.
5. **Motion inputs** — a tick-based reimplementation of `matchesSequence` (~30 lines),
   plus charge moves. Only after 1 and 2; motion inputs on top of a dropped-input layer
   will feel worse, not better.
6. **`onHit` / `onBlk` frame advantage** (from sf3js) replacing absolute hitstun.
7. **Multi-hit via per-window `hitId` dedup** (from vibe-fighter).

### (b) Raw canvas. See (c) above — the Phaser trade buys an atlas player we cannot use.

### (c) First concrete step: `tests/fighter.test.mts`, before changing any gameplay

Add it to the `npm test` chain, driving `createFight` / `stepFight` headlessly with the
injected RNG that already exists. Assert what ought to hold today:

- A few thousand AI-vs-AI fights all terminate — no deadlocks, nothing runs past the timer
- HP never negative or above max; meter stays in `[0, 100]`
- A jab (4f startup) beats a kick (9f) when both start on the same frame
- A whiffed heavy leaves exactly 14 recoverable frames
- A sweep is not blocked standing; an air stomp is not blocked crouching
- Hitstop freezes both fighters and does not advance the round clock
- Fighters never overlap or leave `[STAGE_L, STAGE_R]`
- **An input pressed during hitstun or our own recovery is still acted on afterwards** —
  this one will fail today, and it is finding #2 above

Then add the animation audit as a second test: render each move to an offscreen canvas tick
by tick and assert that the drawn pixels actually change, and that no pose gets fewer than
~3 ticks. That is `audit-animations.py`'s four failure modes, reimplemented for code-drawn
art in a fraction of the code.

The brief notes that headless testing "has caught every real bug in this project" — and the
fighter, the one game the owner is unhappy with, is also the one substantial game with no
tests. That is very unlikely to be a coincidence.

---

## Could not verify

- **`https://hater-zade.vercel.app/`** — the domain is blocked by this container's egress
  proxy. Searches for "hater-zade" / "haterzade" return nothing relevant, and a GitHub
  repository search for the name finds no matching project. **I do not know what this site
  is or whether it has public source.** Someone on an unrestricted network should open it.
- **VibeGameDev starter terms** — `vibegamedev.com` is egress-blocked. See the provenance
  caveat in the licence table. I could not confirm whether roiizchak had the right to
  relicense the inherited per-frame box system under MIT.
- **Which starter each `vibe-fighter` began from.** I established they are not copies of
  each other. Three same-named files have close line counts (`input.ts` 95 vs 96, `types.ts`
  282 vs 299, `MatchScene.ts` 727 vs 749), but I read `input.ts` in both and the content is
  entirely different. Both likely descend from some common VibeGameDev pack; I could not
  determine which.
- **`prompts.pdf` in chongdashu/vibe-fighter** — its text is drawn as vector outlines rather
  than real text, so it cannot be extracted without OCR, which is unavailable here. Not
  attempted, per the coordinator.
- **Celia Wagar's "How to Code Fighting Game Motion Inputs"** (critpoints.net, Feb 2025) —
  surfaced in search as a substantive reference on motion inputs and input buffers, but the
  domain is egress-blocked. I make no claim about its contents; it looks worth reading on an
  unrestricted network.
- **`roundonejs/roundonejs`** (25 stars, TypeScript, "Run M.U.G.E.N games in browser",
  updated 2026-07) — found late, not examined. Likely a design reference at best, since
  running M.U.G.E.N. content means third-party assets, but it is the one unexamined
  candidate with real activity.
- **Exact commit counts for `Not-Street-Fighter` and `StreetPhyter`** — GitHub's rendered
  pages did not expose full metadata to the fetch tool and I did not clone them, both having
  already been ruled out on assets and licence.
