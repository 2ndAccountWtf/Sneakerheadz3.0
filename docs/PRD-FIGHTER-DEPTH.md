# Street fight — depth PRD

A living document. The fighter got its triangle in September; this is where the
rest of the depth comes from, what we have verified, what we have not, and the
order we intend to build in. Sections get marked DONE with the measurement that
closed them. Open questions stay open in §8, the research log in §9 is
append-only, and §12 collects engineering practice rather than game mechanics.

**Companion docs.** `FIGHTER-RESEARCH.md` (2026-09-14) surveyed ten open-source
browser fighting games and concluded nine of them were shallower than what we
already had. `FIGHTER-DEPTH.md` (2026-09-21) is the write-up of the triangle
pass — what was broken, what shipped, and the numbers. This document is what
comes next.

**Scope rule.** Every item here is either a thing the game structurally cannot
express, a hand-rolled special case that wants to be data, or presentation that
is measurably thin. Anything that is a new feature for its own sake goes in §7.

---

## 0. Where the fighter is now

Shipped 2026-09-21. All of it measured headlessly — `createFight` / `stepFight`
are pure, so thousands of matches run in Node.

| shipped | measured |
|---|---|
| blockstun authored per move, not `hitstun / 2` | a blocked kick went -5 → -12; a jab punishes it |
| ordinary moves stopped chipping | blocking well cost ~30hp a round; now 0 |
| a jab cannot cancel into a jab | mashing was a true infinite: 77 unanswered hits in 10s |
| the grab, on its own button | there was nothing that beat a guard |
| launcher outlives its own recovery | juggle hits off the special: 0 → up to 2 |
| the opponent combos, juggles, punishes and grabs | correct play took 8 hits a match and won 100% |
| announce trimmed and skippable | live play 59% → 69% of running time |

Win rates over 120 seeded matches per policy:

| how you play | before | after |
|---|---|---|
| block, punish with the combo, grab a guard, spend the meter | 100% | **78%** |
| walk in, vary your buttons, block sometimes | — | **45%** |
| mash the kick, never block | 85% | 3% |
| mash the jab, never block | — | 0% |
| hold a guard forever | — | 0%, grabbed 15×/match |

45 checks in `tests/fighter.test.mts`. Sixteen deliberate breakages run against
them, fifteen caught; the survivor is an equivalent mutant.

---

## 1. The references

Three engines have been read. They are from different eras and schools and are
useful for different things, so they are kept apart below rather than merged.

| | Ikemen GO | Sakuga Engine | Schwarzerblitz |
|---|---|---|---|
| what | Go rewrite of a M.U.G.E.N-compatible engine | one person's Godot 4 / C# anime fighter framework | one person's C++/Irrlicht 3D arena fighter, shipped |
| lineage | 1999 arcade-era, Mugen data formats | 2024, Guilty Gear / BlazBlue school | 2016–2020, **Tekken / Virtua Fighter school** |
| size | ~420k lines | ~25k, of which ~12k is the engine | ~82k lines |
| licence | MIT | MIT | **BSD-3 for code; assets explicitly all-rights-reserved** |
| best for | the exhaustive checklist of what a hit *is*, and the standard state machine | the modern mechanics we are actually missing, and how to make an opponent with a personality | move *strings*, throw escapes you have to read, and teaching the player |
| read | 2026-09-21 | 2026-09-21 | 2026-09-21 |

Three further repositories were checked and are **not** in that table, because
none is a fighting game engine. They are recorded in §1d and §1e.

**Diminishing returns, stated honestly.** Three engines in, the mechanic space is
well covered and each new reference adds less than the last. Ikemen gave five
structural holes; Sakuga gave three plus the AI idea; Schwarzerblitz gave two
that matter and a pile of confirmations. **The bottleneck is no longer knowing
what to build — it is that none of it has been built or measured.** A fourth
engine is not the next move.

**Standing rule for all three.** No code, no data and no art from either repository, or
from the M.U.G.E.N content ecosystem, is used here, and none may be. The Mugen
character/stage ecosystem in particular is overwhelmingly ripped commercial
sprites — `FIGHTER-RESEARCH.md` §"The ripped-sprite problem" already flags this.
We read them for rules. Citations are `file:line` so a later session can re-find
the thing rather than trust this summary.

### 1a. Ikemen GO

`https://github.com/ikemen-engine/Ikemen-GO` (`LICENCE.txt`, MIT, Suehiro +
contributors 2016–2026).

Not transliterable: 420k lines of Go driving OpenGL/Vulkan, with netplay, Lua
scripting and the SFF/AIR sprite formats, against our 320×180 canvas in a React
modal. The value is the data model. `HitDef` (`src/char.go:589`) is a 130-field
struct — the most complete open-source specification of "what a hit is" that
exists — and `data/common1.cns.zss` is a design document in disguise, enumerating
every state a fighter needs.

### 1b. Sakuga Engine

`https://github.com/NoisyChain/Sakuga-Engine` (`LICENSE`, MIT, NoisyChain 2024).
C# on Godot 4, rollback netcode, deterministic fixed-point (`SimulationScale =
10000`), explicitly "2D 1v1 anime-style".

Small enough to read end to end, and **much closer to our problem than Ikemen**.
Where Ikemen tells us what a 1999 engine needed, Sakuga tells us what a modern
fighter considers table stakes — and several of those we do not have at all. Its
`Globals/GlobalEnums.cs` and `Globals/GlobalFlags.cs` are together a better
vocabulary check than the whole of `HitDef`, and its `GlobalVariables.cs` is a
single screen of every tunable a fighting game needs.

### 1c. Schwarzerblitz

`https://github.com/AndreaJens/SchwarzerblitzEngine` — Andrea "Jens" Demetrio,
2016–2022. C++ on a custom Irrlicht fork, SFML for audio, **Windows-only, 3D**.
The author's own README calls the code ugly and says there is no netcode.

**Licence needs care, unlike the other two.** `LICENSE.md` is BSD-3 for the
source — permissive, fine to read — but the bundled assets are stated as *"all
rights reserved ... cannot be redistributed without the owner's consent",*
covering character designs, 3D models, music, sound effects, illustrations,
stages, icons and menu art. Our standing no-assets rule already covers this; it
is recorded because this is the first of the three to draw the line explicitly.

Architecturally useless to us: it is a 3D arena fighter, so most of the move
record is tracking angles, sidestep and throw cameras. **But it is the only
reference in the Tekken school**, which is what was actually asked for, and two
of its ideas are things neither 2D engine has.

---

### 1d. Two non-engine references

Checked 2026-09-21 after the three engines. One is useful and one is refused.

**GrappleMap** — `https://github.com/Eelis/GrappleMap`. **Public domain**
(`LICENSE`: all authors released their contributions into the public domain).
Not a game: a database of 5,647 interconnected grappling positions and
transitions, animated as stick figures, with a browser viewer, an editor and a
drill runner.

Useful for exactly one idea, which none of the three engines had — see §7.
Ignored: the 3D joint-coordinate encoding, the Vrui/VR viewer, the Blender
pipeline, and essentially the entire body of real jiu-jitsu content.

**Virtual Pro-Wrestling 2** — `https://github.com/aki-club/vpw2`. **Refused, on
two independent grounds.**

The lineage is the most on-target of anything in this document: AKI Corporation
built VPW2, and AKI then built Def Jam Vendetta and Def Jam Fight for NY. This
is, genuinely, Def Jam's ancestor engine. It is still the wrong thing to use.

1. **Licensing.** It is a matching decompilation of a copyrighted commercial N64
   game. There is no licence covering the decompiled output — the only
   `UNLICENSE` in the tree applies to `tools/` — and the README requires the
   user to supply their own ROM because the assets are not distributable. This
   is the same category as the leaked NBA Jam source, which is already governed
   by a standing rule in `NBA-JAM-MECHANICS.md`: read for design rules only,
   never copy, and say so in every document that cites it.
2. **There is nothing to read.** Even setting the licence aside, the repository
   is 408 files of raw MIPS assembly against 14 C files, with auto-generated
   symbol names (`func3_800F3E88`). `docs/` is 558 lines and is entirely
   build and ROM-layout notes — `notes.txt` is thirteen lines about boot code
   and linked objects. The one design-bearing symbol found in a scan was
   `BroadAction_Leapfrog_Primary`. Design intent is not recoverable from this
   without months of reverse engineering, and the result would be a fact about
   a 2000 N64 game rather than a rule we could act on.

Recorded so the question is not reopened. **A decompilation is not a reference.**

### 1e. Virtual Pro Grappler — read the docs, touch none of the code

`https://github.com/chaotix610/VirtualProGrappler` — an open-source wrestling
game and engine "inspired by the AKI-era N64 wrestling games: WWF No Mercy,
Virtual Pro Wrestling 2, WCW/nWo Revenge". An *original implementation*, not a
decompilation — the legitimate version of what §1d refused.

**Two licence facts, and they matter more here than anywhere else in this
document.**

1. **It is GPLv3.** Every other reference is MIT, BSD-3 or public domain.
   GPLv3 is copyleft: code taken from it would oblige us to release
   Sneakerhead Dope Wars under GPLv3.
2. **It is TypeScript on Vite with Vitest** — our exact stack. Every previous
   reference was Go, C#, C++ or a database, so "do not copy the code" was a
   principle nobody was tempted to break. Here the files would drop straight
   into `components/` and work.

Those two facts together make this the one reference where the no-code rule has
teeth. **Read the prose. Take the rules. Write our own numbers and our own
code.** Ideas and mechanics are not copyrightable; their expression is.

A third caution: `src/combat/reversal.ts` transcribes a reversal probability
table whose source doc (`docs/mechanics/REVERSALS.md`) cites N64 RAM addresses,
so that GPL'd file also carries data extracted from a commercial game. Both
reasons to take the shape and none of the digits.

**What is worth reading: `docs/mechanics/`, 2,163 lines of plain-English design
prose** — by some distance the best-written design material in any of the six
repositories. Findings in §2.10, §7 and the log.

**Maturity caveat.** The docs are well ahead of the code. The README says the
project is in an "early engine and tooling phase ... before full match gameplay
comes online", `src/combat/` is about 800 lines, and the blueprint's own states
(`GrappleHold`, `GrappleInitiation`, `Submission`, `Pinning`) do not appear in
the source as working states. This is good design *thinking*, not played,
validated behaviour. Treat it as a hypothesis, the way we treat our own
un-measured ideas.

### 1f. Searching for borrowable grappling code — the answer is there isn't any

Asked 2026-09-21: find wrestling/grappling code we can **borrow**, not merely
read. That makes licence the whole question, so first, our side:
`package.json` says `"private": true` and there is **no LICENSE file in this
repository**. Sneakerhead Dope Wars is proprietary, all rights reserved. So:

| licence | may we take code? |
|---|---|
| public domain | yes, freely |
| MIT / BSD-3 | yes, keeping the copyright notice |
| **GPLv3** | **no** — it would oblige us to release this game under GPLv3 |
| **no licence stated** | **no** — all rights reserved by default |

Against that, everything examined:

| project | licence | borrowable? | why not |
|---|---|---|---|
| GrappleMap | **public domain** | **yes** | but it is C++ tools plus 3D pose data, not game code |
| Ikemen GO | MIT | yes | Go, 420k lines, desktop OpenGL |
| Sakuga Engine | MIT | yes | C#, Godot resources |
| Schwarzerblitz | BSD-3 (code) | yes | C++, Irrlicht, 3D, Windows |
| Virtual Pro Grappler | **GPLv3** | **no** | copyleft, and it is the only one in our stack |
| VPW2 | none (decompilation) | **no** | §1d |
| **TUC** (`tb808/TUC`) | **none stated, `private: true`** | **no** | all rights reserved |

**The conclusion is a negative result and it is worth stating plainly: there is
no wrestling or grappling code we can lift.** The two closest matches are both
TypeScript, both excellent, and both unusable — one copyleft, one unlicensed.
Everything permissively licensed is in a language we would have to port from,
at which point we are writing our own code from someone else's design, which is
what this document has been doing all along.

The one genuinely free thing is GrappleMap's **data** (public domain): the
position/transition graph and its vocabulary. Not its C++.

### 1g. TUC — the closest design, and proof of the scope

`https://github.com/tb808/TUC` — an MMA fight sim in TypeScript with Vitest and
Playwright. **Unlicensed, so nothing is taken from it.** Read for rules only,
like everything else here.

It matters for one reason above all: **it does the entire grappling loop in 295
lines** (`src/game/combat.ts`), with the whole game in 1,204. That is an
existence proof at our scale. Its shape, as rules:

- Combat states run `idle … clinch | takedown | ground | submission | finished`,
  and ground position is a **four-rung ladder**, not a graph:
  `guard → halfGuard → sideControl → mount`, ordered by dominance.
- One object owns the whole grapple — mode, who is on top, the position, a
  timer, a progress value, and an in-flight `transition { by, direction }`.
- The escalation is a chain: clinch → takedown attempt → ground at guard →
  advance the position → mount → submission.
- **The sprawl is the counter.** During the takedown's ~0.78s window, a
  defender holding *low* guard with stamina to spend stuffs it and stuns the
  attacker. That is our triangle again: the grab beats a guard, but the *right*
  guard beats the grab.
- **Position is contested on stamina**, not on a coin flip: from guard the
  bottom man reverses if the top man is the more tired by a margin.
- Stamina gates entry (a takedown costs about twice a clinch) and barely
  regenerates while grappling.
- A ground-and-pound stoppage fires on unanswered hits plus accumulated head
  damage — a "you are not defending yourself" rule rather than a health bar.
- Rounds score `damage / grappling / control / knockdowns` separately, so
  position wins close rounds without damage.
- Difficulty carries a per-level `grappling` weight, the same shape as Sakuga's
  single prediction knob (§5).
- And once more, independently: **strikes are remapped by context** — a punch
  becomes a clinch punch or a ground punch depending on the grapple mode. Three
  unrelated codebases now solve "more moves than buttons" the same way (§2.10).

## 2. Structural gaps — things our game cannot express

These are not tuning. The mechanic does not exist and cannot be reached from the
current model. Each one names which reference it came from, because the three
references found different holes and it matters which is which. §2.8 is the odd
one out: it is not a missing mechanic but a missing way to find the mechanics,
and it is the one most likely to be worth doing first.

### 2.1 You cannot jump over your opponent

Their pushbox is `standbox` *and a separate* `airbox` (`src/char.go:355-357`,
read from `ground.front` / `ground.back` / `air.front` / `air.back`). Ours is one
symmetric `MIN_SEP = 15` (`StreetFighter.tsx:38`) and `separate()`
(`StreetFighter.tsx:1179`) never looks at `y`:

```ts
function separate(a: Fighter, b: Fighter) {
    const dx = b.x - a.x;          // no y, no airborne check
```

So both bodies are solid at all times, including mid-air. **The cross-up — jump
over them, attack from the wrong side, their guard is now backwards — is
structurally impossible.** It is one of the two or three fundamental mixups in
any 2D fighter.

It also explains why the jump feels pointless: an air attack can only ever
arrive from the front, which is exactly why the opponent reads it trivially.

*Biggest single finding in this pass. Cheap to fix.*

### 2.2 A hit has one reaction; Ikemen's has eight

From `data/common1.cns.zss`:

```
5000 shaking → 5001 knocked back          (5010/5011 crouch, 150-155 guard)
5020 air shaking → 5030 knocked away → 5035 transition
                   → 5040 recover in air  |  5050 falling
5070/5071 tripped        5080/5081 hit while already down
5100 hit the ground → 5101 BOUNCE → 5110 lying → 5120 getting up
5200/5201 tech on the ground        5210 tech in the air
```

The split that matters most is the first: **shake, then knockback.** On impact
you freeze in place for a few frames and only *then* slide. We apply damage and
velocity on the same frame, which is part of why our hits read as a number going
down rather than as contact. Ground bounce (5101) is a free juggle extender.

### 2.3 There is no air guard, and guarding is not a state

Theirs: 120 guard-start → 130 stand / 131 crouch / **132 air** → 140 guard-end.
Ours is a `blockHeld` boolean that is false whenever airborne. Combined with
§2.1, jumping is a pure commitment with no defensive option at all.

### 2.4 The jump has no startup and no landing recovery

Theirs: StateDef 40 jump-start with `ctrl:0`, 50 jump-up, 52 **jump-land** with
`ctrl:0`. Landing recovery is *the* balance lever on jump spam, and we have
none — our fighter is actionable the instant they touch the floor.

Same for the backdash: theirs is a distinct airborne state (105 hop-back) with
its own landing state (106). Ours is a reverse walk at `WALK_BACK`, symmetric
with walking forward.

### 2.5 There is no counter hit

Sakuga prices a counter as its own outcome everywhere: `CounterHitStopDuration =
20` against `SelfHitStopDuration = 12` and `OpponentHitStopDuration = 12`
(`Resources/HitboxElement.cs`), with engine defaults `DefaultBaseHitstop = 10`
and `DefaultCounterHitstop = 20` (`Globals/GlobalVariables.cs`). A counter also
gets its own callout — "Counter" and "Punish" are two of the nine hit
notifications in `HitNotifs.tres`.

Hitting someone during their startup frames is the single most satisfying thing
in a fighting game and **it does not exist in ours.** Every hit is the same hit.
This is also the mechanic that pays for reading the opponent, which is the whole
behaviour the triangle pass was trying to encourage.

Nearly free for us: we already know the defender's `state === 'attack'` and
`frame < startup` at the moment of contact.

### 2.6 Simultaneous hitboxes trade; they should be able to clash

Ours resolves both hits (`resolveContact`, `StreetFighter.tsx:1651`), deliberately
— the comment says trades are symmetric. Sakuga has `ClashHitStopDuration = 20`
and a per-box `Priority`, so two hitboxes meeting can *clash*: neither lands,
both recoil, everyone is back to neutral with a bang. That reads better than two
people simultaneously taking damage, and it is a real moment rather than a
double-hit nobody can parse.

### 2.7 Invulnerability is one number, not a set of types

`FrameProperties { DAMAGE_IMUNITY, THROW_IMUNITY, PROJECTILE_IMUNITY, LOCK_MOVE }`
(`Globals/GlobalFlags.cs`). We have a single `invuln` frame count.

**Throw invulnerability specifically matters to us now**, because we shipped a
grab. Wake-up is currently a flat 12 invulnerable frames against everything;
without a typed version there is no way to say "getting up is safe from grabs
but not from strikes", which is the standard answer to a grab-spamming opponent.

### 2.8 The player has no way to learn any of this

Schwarzerblitz ships a numbered tutorial — `FK_TutorialPhase` in
`FK_SceneGameTutorial.h` runs to 23+ phases, one mechanic each: MovementForward,
Crouching, StandingGuard, Punch, Kick, TechThrow, FlowCombo, GroundRecovery,
Backstep, **ThrowEscape**, CrouchedGuard, JumpAttacks, Projectiles… Each phase
carries its own message, required input and pass condition. It also ships
`FK_MoveListPanel` — the game shows you your own moves.

We have **one paragraph of help text**, and we just added three mechanics
(grab, break, juggle) plus a whole triangle that the player has no way to
discover. A player who never presses GRAB never learns that a guard is
beatable, and nothing in the game tells them.

This is arguably the highest-value finding in the whole document *for our
situation specifically*, because our problem stopped being "not enough
mechanics" on 2026-09-21. It is now "the mechanics are invisible". A move list
and four or five 15-second drills would do more for how the fighter feels than
Stages 4 and 5 combined.

### 2.10 Two buttons are not the ceiling — context is

Recorded here rather than in §7 because it overturns a decision this document
made twice. Move strings were parked on the grounds that "with two attack
buttons the vocabulary is A-A, A-B, B-A, B-B and little else". **That was the
wrong frame.**

AKI's answer is not strings, it is **context × direction × button**
(`docs/mechanics/move-slot-overview.md`). The same two buttons mean different
things depending on where you are:

```
position   front grapple | back grapple | standing | running | ground | turnbuckle
strength   weak | strong
direction  neutral | left-right | up | down
button     A | B
```

`front-weak-grapple-3` is front grapple, weak, D-pad up, A. That is eight moves
per grapple position from two buttons, and it is how an N64 controller carries
a few hundred moves.

**We already do a thin version of this** — `down + B` is the sweep, `down + A`
is the special, airborne `A` is the air attack. What we do not have is a
*position* that counts as a context. The grab is the obvious one: it already
holds both fighters still for thirteen frames and currently has exactly one
outcome.

See §7 for the scoped version. It costs no new button and no new state.

### 2.9 There is no superpause

`setSuperPauseTime(pausetime, movetime, unhittable, p2defmul)`
(`src/char.go:9393`). The world freezes when a super starts; the attacker gets a
head start (`movetime`); the victim is briefly unhittable and their defence is
multiplied. Our special just comes out. This is the cheapest "this move is a big
deal" effect in the genre.

---

## 3. Data-model gaps — special cases that want to be data

We hand-rolled each of these, usually as a predicate. Their version is a field.

| concern | Ikemen | ours |
|---|---|---|
| what a hit can touch | `hitflag`: stand / crouch / air / lying / falling (`char.go:10990`) | `hittable`, `grabbable`, `juggleSpent` — three predicates (`:600`, `:608`, `:619`) |
| what stops a hit | `guardflag`: H / L / A (`char.go:11300`) | `height`, doing this job *and* placing the box |
| juggle limit | `air_juggle` points, per-defender budget, default 15 (`char.go:341`, `:5891`) | `JUGGLE_MAX = 2`, every hit costs 1 (`:597`) |
| juggle damage | `fall.defence_up 50`, `fall.defence_mul 1.5` (`char.go:337-339`) | combo proration only |
| freeze on contact | `pausetime[2]` + `guard_pausetime[2]` — attacker and defender freeze for *different* lengths, block authored separately | one `hitstop`, ×0.6 on block |
| reaction look | `animtype`: Light / Medium / Hard / Back / Up / DiagUp (`char.go:559-568`) | every hit looks identical |
| ground reaction | `HitType`: None / High / Low / **Trip** (`char.go:571-578`) | a `knockdown` boolean |
| corner | attacker eats the push when the defender is walled (`char.go:9954`) | nothing; `separate()` gives the whole shove to whoever is off the wall |
| knockdown recovery | `fall.recover` / `fall.recovertime` (defaults `true` / `4`, `char.go:850-851`) | flat 38–42 frames on the floor, no agency |
| input buffer | `time` vs `buffer.time`, plus per-command `buffer.hitpause` and `buffer.pauseend` (`data/common.cmd`) | one 4–10 frame window; both flags hand-rolled as global rules |
| throws | `p2stateno` + `bindToTarget` (`char.go:8609`) — the attacker takes over the victim's state machine; `unhittabletime` afterwards (`char.go:724`) | bespoke `holdT` / `grabT` pair |

And from Sakuga, which is closer to how we would actually build it:

| concern | Sakuga | ours |
|---|---|---|
| ending a juggle | **gravity proration**: `CurrentGravityProration` + `GravityDecayFactor`, `GravityDecay = 2500` — each juggle hit makes them fall faster until the combo dies on its own | hard `JUGGLE_MAX = 2` cap, so the third hit whiffs for no visible reason |
| long combos | `CurrentHitstunProration` + `HitstunDecayMinCombo = 8`, `MinHitstun = 8` — hitstun shrinks after eight hits, so links get harder | nothing |
| repeating a move | `CurrentSameMoveProration` — the same move again in a combo scales harder | `if (f.cancel > 0 && f.move === id) return false` — a hard ban, which is the hack version of this |
| the corner is worth something | `CornerMaxDamageScaling = 120` vs `BaseMaxDamageScaling = 100` (mins 45 vs 35) — corner combos do *more* | nothing; the corner is currently pure downside for the defender and pure upside for the attacker |
| cancels | `MoveCancelSettings { MoveIndex, Conditions, FrameThreshold }` with `CancelCondition { WHIFF, HIT, BLOCK, KARA }` — per-target, per-outcome, per-window | one `cancel` number, on hit only. No block-cancel, so no blockstrings |
| hitstun kinds | `HitstunType { NONE, BASIC, KNOCKDOWN, HARD_KNOCKDOWN, DIZZINESS, STAGGERED, GRABBED }` — note **GRABBED is a hitstun type** | `hitstun` / `down` / a bespoke `grabbed` state |
| knockback | a `Vector2I` + gravity + **duration**, authored separately for ground-hit / ground-block / air-hit / air-block | one velocity, then friction |
| entering guard | `HitboxType.PROXIMITY_BLOCK` — a box that puts you in guard when genuinely threatened | holding back is always "blocking", even at full screen |
| block on reaction | `InstantBlockWindow = 3` — guarding within 3 frames of impact is a just-defend | nothing |
| buffer length | `MoveBufferLength = 10` | 4–10, focus-scaled, baseline 7 — **independent confirmation we are in the right range** |
| block freeze | `DefaultBlockHitstop = 6` against `DefaultBaseHitstop = 10` | `hitstop * 0.6` — **exactly the same ratio, arrived at independently** |

And from Schwarzerblitz, the Tekken-school items neither 2D engine has
(`FK_Move.h`, `FK_MoveListMove.h`):

| concern | Schwarzerblitz | ours |
|---|---|---|
| move strings | `followupMoves` **and** `cancelIntoMoves` as two separate lists, plus `followupOnly` (a move that exists only as a string continuation) and `isMultiChainable`. `FK_MoveListMove` is a trie node | seven flat moves and one `cancel` number. **This is the Tekken texture that was originally asked for** — see §7 for why it is still parked |
| breaking a throw | `escapeInput` is **per throw** (`FK_ThrowMove`), so which button breaks it depends on which throw it is — you have to *read* the animation | one GRAB button, so our break is a reaction test and never a read |
| minimum range | `moveMinRange` as well as `moveMaxRange` — some moves whiff if you are too close | max reach only |
| properties over time | `attackTypeAtFrame` — a vector, so a move's attack type changes frame by frame; `invincibilityType` and `armorType` are vectors of attack type, so a move can be invincible to lows but not mids | one `invuln` counter |
| keeping a launcher worth it | `maximumDamageScaling` **per move** — a move can cap how far its own combo scales | global proration only |
| AI hints on the move | `AIflag_onlyDuringOpponentAttack` — the move record tells the AI when it is appropriate | four global constants |
| trade | `movePriority` | symmetric trade |
| targeting | `antiAirOnlyFlag`, `vsGroundedOpponentFlag` | nothing |
| execution as a skill | `requiresPreciseInputFlag` — just-frame moves | nothing |

Ignored as 3D-only: tracking angles, sidestep, throw cameras, ring-out.

---

## 4. Presentation gaps

| | Ikemen | ours |
|---|---|---|
| camera | auto-zoom on fighter distance, with `zoomindelay` / `zoominspeed` / `zoomoutspeed` (`src/camera.go:32-42`) | fixed 320×180; fighters range 18–302 apart |
| screen shake | `EnvShake{time, freq, ampl, phase, mul, dir, diradd, decay}` (`system.go:6676`) | a scalar counting down |
| flash / trails | PalFX and AfterImage as first-class time-driven effects | a `flash` frame counter |
| guard break | a set piece: shockwave, glass shards, blue screen flash, dedicated sound (`data/guardbreak.zss`) | n/a — we have no guard meter |

Two more from Sakuga:

| | Sakuga | ours |
|---|---|---|
| telling the player what happened | nine callouts — First Strike, Counter, Punish, Just, Escaped, Recovered, Knockdown, Hard Knockdown, Invalid (`HitNotifs.tres`) | a combo counter |
| frame data | `CombatTracker` computes `FrameAdvantage = HitFrame - StunAtHit` live, every hit | our test harness computes it by hand, off the move table |

The callouts are the cheapest feedback in this entire document. A fighting game
that says "PUNISH" when you punish is teaching you its own rules for free — and
we have just added three mechanics (grab, break, juggle) that the player has no
way of knowing worked.

Putting frame advantage in the sim rather than in the harness would also make it
assertable, which is worth something on its own.

The camera is the one to take seriously. On a phone at 320×180 a camera that
pushes in during a close exchange is probably worth more than any single
mechanic in §2 or §3, and we already did this work on hoops.

---

## 5. The opponent — where we stand against each

The two references disagree here, and the disagreement is the useful part.

**Ikemen's generic AI is a random button-jammer**, and we are well ahead of it.
`AiInput.Update(level)` (`src/input.go:1863`) picks a random direction and mashes
buttons at `chance = (-11.25*level + 165) * 7`, plus a "cheat" that fires a
random command off the character's list when `RandF32(0, aiLevel/2+32) > 32`
(`src/char.go:13612`). Real Mugen AI is hand-written per character in CNS — there
is no general AI in that repo at all. Ours (reaction delay, whiff punish, guard
reading, block→punish, combo and juggle follow-ups) is a better opponent than
anything shipped there.

**Sakuga's is structurally better than ours**, and this is the most valuable
single idea in either repository.

`AIBehavior` (`Resources/AI/AIBehavior.cs`) is a data resource:

```
DecisionRateFree   a RANGE, not a constant — how often it re-decides when idle
DecisionRateBusy   … and while committed to something
InputRandomness    a range applied to its own inputs
BlockingRate       how often it guards
TechingRate        how often it techs a knockdown
PredictionQuality  0-10: how often it correctly READS your current state
LowHealth          below this it flips to defensive
```

plus four action packs by distance band (`NearActions` / `MidActions` /
`FarActions` / `DistantActions`), each a list of `AICondition { Distance,
UseOnGround, UseOnAir, SuperGaugeRequired, Probability, ActionMode, CounterFlags }`.
`CounterFlags` is matched against the *opponent's* current state
(`AIFlags { HITSTUN_STATE, BLOCKSTUN_STATE, ATTACK_STATE, KNOCKED_DOWN,
INVULNERABLE, HIGH_ACTION, LOW_ACTION, CLOSE_ACTION, … }`), so a condition reads
"when they are doing this, at this range, with this much meter, do one of these,
with probability P" (`Components/AIBrain.cs:240-270`).

Two things fall out of that shape which we do not have:

1. **One difficulty knob.** `PredictionQuality` is how often the bot reads you
   correctly. Ours is four separate hardcoded constants — `AI_PUNISH_CHANCE`,
   `AI_COMBO_CHANCE`, `AI_JUGGLE_CHANCE`, `AI_BREAK_CHANCE` — tuned by hand and
   not exposed anywhere. They enumerate `BotDifficulty { BEGINNER, EASY, MEDIUM,
   HARD, VERY_HARD, PRO }`.
2. **Personality.** `BotMode { AGGRESSIVE, DEFENSIVE }` selects different action
   packs from the same brain.

**Why this matters to us specifically.** We shipped venues and NPC opponents
(task #16). Every street fight in the game currently has the *identical* brain,
and the only thing that differs between opponents is their name and health. Our
four AI constants are exactly the thing that should be per-opponent data, and we
already have the pattern for it in `systems/hoops/roster.ts`. A washed-up rapper
and a bouncer should not fight the same way, and right now they cannot fight
differently even in principle.

**Still out of both**, on grounds of needing per-frame art data we do not have:
CNS/ZSS state scripting, the SFF/AIR sprite formats, multiple collision boxes
per animation frame, and Sakuga's whole Godot resource/editor layer.

---

## 6. The build order

Rewritten 2026-09-21, second pass. The first attempt led with a move list and
drills and gated the air game on whether art would read. Both were wrong: this
is an engine and mechanics plan, and nothing in it waits on a picture.

**The rule that runs through every phase:** every state we add is a *named*
animation state carrying normalised progress. The renderer maps name → clip.
Today's procedural drawing becomes one implementation of that contract, and
delivered frames become another. **Art plugs in later without the simulation
changing.** Building the mechanics now is what makes good graphics droppable
later, not the other way round.

Sizes are estimates against a 2,279-line file.

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

### Phase 2 — the grapple system · ~L

The centrepiece, and the thing three references independently point at. Our
grab is one move with one outcome; this makes it a game.

**Entry, and its cost.**
- GRAB tapped is a **weak clinch**; GRAB held is a **strong clinch** — slower
  startup, more turbo, better options. Same button (§2.10, and Phase 1's
  tap/hold).
- Entry drains **stamina**, a new resource — the fighter has `hype` and nothing
  else, so there is currently no reason not to mash. See §6 Phase 2a.

**Inside the hold — the AKI slot model, at our scale.**
- The hold freezes both fighters. During it the D-pad picks the outcome:
  neutral, up, down, toward. Four outcomes from a weak clinch, four different
  ones from a strong clinch. **No new button.**
- One outcome on each does not finish — it **advances a rung** to a dominant
  position with its own four outcomes, and reopens the defender's escape.
  Two rungs, not four.

**The defender's side, which is what makes it a game rather than a coin flip.**
- **The sprawl.** Holding down-and-back during the grab's *startup* stuffs it
  outright and leaves the grabber punishable. A specific read, not any block.
  This closes the triangle in both directions: strike beats grab, grab beats
  block, block beats strike, and the right low guard beats the grab.
- **The break.** One press inside the window. Mashing does not help — ours
  currently rewards it, which means the break is not a decision. The *window*
  scales with `focus`, the way the input buffer already does.
- **The contest.** While held, both sides bleed turbo; the defender's escape
  window widens as the holder tires. Position is contested continuously, not
  decided once.

**Outcomes.**
- Forward throw carries into the wall for bonus damage (we have this).
- Back throw switches sides — the corner-escape tool, and a real reason to pick
  a direction.

**Animation.** Every rung, transition, throw and escape is its own `AnimState`
from Phase 1. Art for a clinch drops in without touching any of this.

*Gate:* the grab's usage rises without its win contribution rising — a tool,
not a trump. A bot that always grabs stays beatable by a bot that reads the
sprawl. Turbo spent on dashes measurably weakens your grapple defence.

### Phase 2a — the grapple move list

**Correction:** the Phase 2 sketch above said the clinch is contested on turbo
"which already exists". It does not — `turbo` is a hoops field. The fighter
carries `hype` (the special meter) and nothing else, so the contest needs a
real resource. See *Stamina* below.

**The rule for what gets in.** A grapple move earns its place only by doing
something no other move does. Five mechanical roles, and everything below fills
exactly one:

| role | what it is for |
|---|---|
| **chip** | small damage that *keeps* the hold — makes the clinch a place, not a menu |
| **burst** | big damage, hard knockdown, hold ends — the payoff |
| **position** | no damage, better options next — the rung up, or a side switch |
| **drain** | damage over time while both are locked — a contest, not an outcome |
| **exit** | leave on your terms with advantage — stops the ground being all-in |

---

#### Entry

| input | move | startup | on whiff | cost |
|---|---|---|---|---|
| tap GRAB | weak clinch | 5f | −22 | 8 stamina |
| hold GRAB (~12f) | strong clinch | 9f | −28 | 18 stamina |
| dash + GRAB | running clinch | 7f | −30 | 20 stamina |

The running clinch reaches further and is harder to break, and the sprawl
punishes it hardest. Tap-versus-hold comes from Phase 1.

#### Rung 1 — the clinch. Direction is read **during** the hold, not at entry

Weak set — 16-frame hold:

| dir | move | role | effect |
|---|---|---|---|
| neutral | **Knee** | chip | ~6 dmg, **keeps the clinch**, builds hype. Same-move proration bleeds it fast, and every knee reopens their break window — so staying is a gamble |
| forward | **Body slam** | burst | ~15, hard knockdown, wall bonus |
| back | **Judo trip** | position | ~10, **switches sides**. Less damage is the price of the corner escape |
| down | **Takedown** | position | 0 dmg, both to the floor, you on top → Rung 2 |

Strong set — 20-frame hold:

| dir | move | role | effect |
|---|---|---|---|
| neutral | **Standing guillotine** | drain | ~1.5 dmg/frame while held, both locked, drains their stamina hard. They mash out, you hold. Escape leaves you −14 |
| forward | **Suplex** | burst | ~24, hard knockdown, heavy hitstop, wall bonus |
| back | **Back drop** | burst + position | ~18, side switch, they land behind you |
| up | **Shoulder throw** | burst + setup | ~12 and it **launches** — the only grapple that feeds the juggle system |

#### Rung 2 — ground, you on top

| dir | move | role | effect |
|---|---|---|---|
| neutral | **Ground and pound** | chip | ~5 a hit, scales down, builds hype. Each hit reopens their reversal |
| forward | **Advance to mount** | position | no damage; their escape gets harder, your options get better |
| down | **Armbar** | drain | ~2 dmg/frame. Bigger payoff than the guillotine, bigger risk |
| back | **Stand up** | exit | disengage with frame advantage — bank it and reset |

#### The defender — four answers, each beating a different thing

1. **Sprawl** — down-and-back during the grab's *startup*. Stuffs it outright
   and leaves the grabber −20. This is the **read**, and it is what closes the
   triangle: strike beats grab, grab beats block, block beats strike, and the
   right low guard beats the grab.
2. **Break** — one press of GRAB inside the hold window. Both shoved apart,
   neutral. The window scales with `focus`. **Mashing does not help.** This is
   the **reaction**.
3. **Buck** — on the ground, direction plus button, contested on stamina.
   Reverses top and bottom. This is the **contest**.
4. **Ride it out** — take the throw and keep your stamina. Sometimes correct:
   a failed escape into a submission costs more than the slam would have.

**Submissions are the deliberate exception: mashing *is* correct there.** You
are already caught, so it is a struggle rather than a read. Keeping that
distinct from the break is what stops "mash everything" being the whole
defensive game.

#### Stamina — the resource the fighter is missing

One new field, and it pays for more than the grapple. Starts 100. Regenerates
quickly standing, slowly in a clinch, **not at all** inside a submission.

- Entry costs as tabled; sprawl 12, break 10, buck 14.
- Below ~20 you cannot initiate a grapple and your escape windows narrow.
- Dashes and jumps draw on it too, so movement and grappling compete.

This is also the fighter's missing answer to "why not mash" in general.

#### Environment

The wall bonus exists. Add **one hazard per venue** — a dumpster, a parked car,
the ice machine — that a throw can send someone into for bonus damage and its
own animation state. It is Def Jam's signature move and it ties the fighter to
the venue system the game already has.

#### Weapons

**You cannot grapple with a melee weapon in hand.** Grabbing drops it to the
floor, where either fighter can pick it up. That is a real decision — keep the
crowbar, or take the grapple — and it needs no new art beyond a dropped-weapon
state.

#### Deliberately not included

- **More submissions** (kimura, leg lock, triangle). More animations, identical
  mechanics. Two — one standing, one ground — cover the drain role.
- **Guard / half-guard / side control as separate rungs.** TUC runs four; we
  run two. More rungs is more to learn inside a thirty-second fight.
- **Air grabs.** Unreadable at 320×180 and they break the anti-air game.
- **Pins.** No referee. It is a car park.

#### If we build a subset first

The weak clinch's four, the sprawl, the break, and the existing wall slam.
That is the entire triangle working end to end. The strong set and Rung 2 are
the second pass.

### Phase 3 — impact · ~M

Where "feels worse than Punch-Out" gets answered. Punch-Out's hits feel
enormous; ours read as a number going down.

- **Counter hit** — contact during the defender's startup, roughly double
  hitstop and more advantage. Absent entirely, and it is what pays for reading
  the opponent.
- **Shake, then knockback** — freeze in place on impact, *then* slide. We apply
  damage and velocity on the same frame.
- Attacker and defender freeze as **separate authored numbers**; block freeze
  authored rather than `hitstop * 0.6`.
- Reaction types — light, heavy, launch — so a kick does not read like a jab.
  Each is an `AnimState`.
- Screen shake with frequency and decay instead of a scalar.

*Gate:* no match-length regression; `proper` gains from counters, `mashHeavy`
loses to them, neither by more than a few points.

### Phase 4 — the air game · ~L

Not gated on anything. If a cross-up is hard to read, that is an engine problem
with engine answers — a facing flip, a side-swap marker, the Phase 7 camera —
not a reason to leave the mechanic out.

- **Airborne bodies pass through each other.** Today `separate()` never looks at
  `y`, so both fighters are solid in mid-air and **the cross-up is structurally
  impossible** (§2.1). It is one of the two or three fundamental mixups in any
  2D fighter.
- **Jump startup and landing recovery**, so a jump is a commitment with a cost.
  This is the balance lever on jump spam and we have none.
- **Air guard**, so jumping is not a pure gamble.
- **Instant block** (§7, now unblocked by Phase 1) — guarding within a few
  frames of impact for a bigger punish window.

*Gate:* the air attack's win contribution rises; jump frequency does not run
away once landing recovery prices it; a cross-up beats a held guard and the
opponent can still learn to block it.

### Phase 5 — the ground game · ~M

Getting up is currently our only completely optionless moment.

- **Knockdown tech**, with a teching rate on the opponent so it is not
  all-or-nothing.
- **A wake-up attack** with its own reversal window.
- **Throw invulnerability on wake-up**, as a typed frame property. We shipped a
  grab and left getting up defenceless against it.
- **Gravity proration replaces `JUGGLE_MAX`** — each juggle hit makes them fall
  faster until the combo ends itself, instead of a third hit whiffing for
  reasons the player cannot see. Deletes `juggleSpent`.
- **Same-move proration replaces the hard ban** on jab-into-jab. Ours is a hack
  that works; scaling is the principled version and it generalises.

*Gate:* free wake-up pressure drops without knockdowns becoming worthless;
juggle length spreads to 1–3 rather than pinning at 2; mashing one button stays
as bad as it is now **without** the hard cancel ban.

### Phase 6 — opponents who fight differently · ~M

Every street fight currently has the identical brain; only the name and health
differ.

- Pull `AI_PUNISH_CHANCE`, `AI_COMBO_CHANCE`, `AI_JUGGLE_CHANCE` and
  `AI_BREAK_CHANCE` into a per-opponent record: decision-rate *ranges*, a
  blocking rate, a teching rate, a sprawl rate, a single prediction knob for
  difficulty, and an aggressive/defensive lean (§5).
- A **points budget and a validator**, so nothing is strong at everything
  (§12.6).
- The AI learns every mechanic from Phases 2–5 in the same change. An opponent
  that cannot grapple, tech or sprawl is a tutorial, not a fight.

*Gate:* two named opponents produce measurably different match shapes — hits
taken, block rate, grapple rate, match length — against the same player policy.

### Phase 7 — the stage and the camera · ~M

- **Corner push**, hit and block valued separately: the attacker slides back
  when the defender is walled, so cornering someone is pressure with a rhythm
  rather than a free win.
- **Corner damage scaling** — combos in the corner are worth more. Ours is
  currently all stick and no carrot.
- **Camera auto-zoom** — push in on a close exchange, pull out at range. On a
  320×180 canvas this is the single biggest readability gain available, and it
  is the engine answer to anything Phase 4 makes hard to see.

*Gate:* damage taken while cornered drops, time cornered does not go to zero,
and getting someone cornered stays worth doing.

---

### What is deliberately last, not skipped

**Discoverability** — a move list, drills, hit callouts. Real, and it belongs
after the mechanics are in, because there is no point teaching a grapple system
we have not built. It is not a phase in front of the engine work.

---

**If only two phases happen, make them 1 and 2.** One is the foundation
everything else needs; the other is the grapple system, which is the largest
single gap between what this is and what was asked for.

## 7. Explicitly out of scope

Good ideas, deliberately not being built yet. Each one adds a rule to explain
and most add a HUD element, on a phone, in a mini-game.

- **Guard meter / guard crush.** A second answer to turtling besides the grab.
  Competes with the grab for the same slot; wait until the grab has been played.
  Both engines have it — Sakuga as per-move `GuardCrush` / `GuardCrushDamage`
  with a `GuardCrushState` and `GuardCrushHitstun = 40`, Ikemen as `guardpoints`
  plus a whole set-piece in `data/guardbreak.zss`. Well specified whenever we
  want it.
- **Dizzy / stun.** One meter too many.
- ~~**Parry / ReversalDef.**~~ **Reclassified — no longer out.** Parked after the
  Ikemen read on the assumption it was a whole new move competing with the grab.
  Sakuga shows it does not have to be: `InstantBlockWindow = 3`
  (`Globals/GlobalVariables.cs`) makes a just-defend a **3-frame window on the
  block you already have**, not a separate input. It rewards reading without
  touching the grab's slot, and it gives the "Just" callout something to
  announce.

  **Corrected 2026-09-21 by §12.1.** This was written as "a handful of lines on
  top of `blockSucceeds`". It is not, with the buffer we have: judging a
  just-defend means looking *backwards* from the hit frame, and our countdown
  timers keep no record of *when* a press happened. It needs §12.1 first.
  It lands **inside Phase 4**, once Phase 1's frame-stamped input exists.
- **Red life** (recoverable damage). Noise in a three-round mini-game.
- **The `hitflag` / `guardflag` refactor as a standalone change.** It is the
  right model and it deletes three predicates, but on its own it is a large diff
  with zero visible difference. Fold it into Phase 5 only as far as it pays.
- **Generalising the throw into custom states.** Our bespoke hold works. Worth
  noting Sakuga models it as `HitstunType.GRABBED` — a *kind of hitstun* rather
  than a separate state — which is probably how ours should have been built and
  is cheap to change if we ever touch it.
- **The grapple as a position graph.** The one idea from GrappleMap (§1d), and
  the only answer in this whole document to "what would a Def Jam grapple
  actually be".

  All three engines model a throw as a *single move*: Sakuga as
  `HitstunType.GRABBED`, Schwarzerblitz as an `FK_ThrowMove` with a target
  animation, Ikemen as `p2stateno` + `bindToTarget`. **GrappleMap models
  grappling as a graph**: positions are nodes carrying a tagged state vocabulary
  (161 tags — `bottom_supine`, `top_kneeling`, `top_underhook`, `crossface`,
  `back`, `turtle`, `half_guard`), and transitions are edges between them. A
  drill in `drills/*.script` is literally a path through that graph, which is
  also the shape the drills want, whenever they come.

  That is the Def Jam grapple: you clinch, and from the position you end up in a
  *different set of options* is available.

  Parked, and the scale is why. GrappleMap has 5,647 positions; our entire
  fighter is about 2,000 lines.

  **Superseded by a cheaper shape — see §2.10.** Virtual Pro Grappler's
  AKI-derived move-slot model gets the same "a grapple is more than one move"
  payoff without a graph at all: the hold already freezes both fighters for
  thirteen frames, so *reading the D-pad during that hold* gives four outcomes
  — neutral, up, down, toward — off the buttons and stick we already have. No
  new state, no new node type, no new button. That is the version to build if
  we build one, and it is perhaps thirty lines rather than sixty.

  **Superseded again, and promoted out of §7: this is now Phase 2, the
  centrepiece of the build order.** TUC
  (§1g) showed the whole loop costs about 300 lines, which removes the scale
  objection that kept it parked.
- **The AKI reversal model, as rules rather than numbers.** From
  `docs/mechanics/REVERSALS.md`: the defender presses **once** and mashing
  explicitly does not improve the odds; the input must land **before the
  attacker has chosen their move**, so it is a race rather than a reaction to a
  specific animation; success is probabilistic, scaled by a stamina stat in
  bands; and finisher mode disables reversals unless both sides have it.

  Two of those are worth having and one is not. "One press, before commitment"
  is a better rule than ours — **our break currently rewards mashing**, which is
  a thing we should fix whatever else happens. The dice are the part to leave:
  probabilistic reversals are a known frustration in the AKI games ("I pressed
  it and nothing happened"), and a deterministic thirteen-frame window is the
  better design for a thirty-second mini-game. Stat-scaling the *window* rather
  than the *odds* is the version that fits us, and we already do exactly that
  for the input buffer via `focus`.
- **Clash** (§2.6). Nice, readable, and a real moment. Not urgent: our
  symmetric trade is defensible and simultaneous hitboxes are rare.
- **Proximity block boxes** (`HitboxType.PROXIMITY_BLOCK`). Fixes "holding back
  at full screen counts as blocking". Ours is a cosmetic wrinkle at most, since
  blocking at range costs nothing now that chip is gone.
- **More attacks, and move strings.** Tekken's texture comes from strings per
  limb, and Schwarzerblitz shows the data shape exactly: `followupMoves` and
  `cancelIntoMoves` as separate lists, with a trie of follow-ups hanging off each
  move. This is the closest thing in any of the three references to what was
  originally asked for.

  Still parked, and the reason is the thumb, not the model. A string means
  pressing the same button again on a rhythm you learned; with two attack
  buttons the vocabulary is A-A, A-B, B-A, B-B and little else before it stops
  being legible on a 320×180 phone screen. **Revisit after Phase 2**: if a
  move list exists and players do learn the seven moves we have, a second tier
  of strings becomes a reasonable ask. Before that it is more depth nobody can
  see.
- **Reading a throw to break it.** Schwarzerblitz gives every throw its own
  `escapeInput`, so breaking one is a read, not a reaction. Ours cannot be:
  there is one grab, so there is nothing to read. Needs at least two grabs with
  visibly different animations before it means anything.
- **Per-move damage-scaling caps, minimum range, frame-varying attack types,
  just-frame inputs.** All real, all from `FK_Move.h`, all refinements of
  systems we have not built yet. Recorded so they are not rediscovered.

---

## 8. Still to research

The part of this document that keeps it alive. Nothing below has been verified.

1. **Does a cross-up read at 320×180?** *No longer a gate* — Phase 4 ships the
   mechanic and Phase 7's camera plus a side-swap marker are the engine answers
   if it is hard to see. The question is how much help it needs, not whether
   to build it. Originally phrased as a blocker, which was wrong: the
   player being able to *see* which side they are on. Our fighters are 15px
   wide. Needs a prototype before the mechanic is worth building.
2. **What actually happens on a phone with three buttons plus a d-pad?**
   Landscape and fullscreen have never been verified on a real device — the same
   open item the hoops PRD carries.
3. **Is `reader` (a bot that blocks everything correctly but only ever jabs)
   winning 0% a defence problem or a no-offence problem?** Asserted in
   `FIGHTER-DEPTH.md` as the latter. Not proven either way.
4. **How do the AM/PM weapons interact with all of this?** `movesFor()` folds a
   melee weapon into `heavy`. Nothing in this plan has been thought through
   against an armed fighter, and `toss` / projectiles are barely tested.
5. **Is the balance harness sample size honest?** Same question the hoops PRD
   has open: 120 seeded matches against thresholds a few points wide.
6. **Ikemen's `guard_dist_x`** — the range at which a defender is forced into a
   guard stance. Read but not understood. Sakuga's `PROXIMITY_BLOCK` box is the
   same idea in a cleaner form; see §7.
7. **Is a 3-frame instant-block window usable on a phone?** Sakuga targets a
   controller at 60Hz. Touch latency is worse and variable. Our focus stat
   already scales the input buffer 4–10 frames, so there is a precedent for
   making the window a player stat rather than a constant — but that needs
   measuring, not assuming. *Partly answered: §12.1 shows we cannot even
   implement it until the input buffer records press frames, so the question is
   now second in line behind that.*
8. **Does the counter hit need to be visible to work?** Phase 3 pairs it with a
   callout on that assumption. Untested.
9. **Per-opponent AI records: how many knobs before it is unmaintainable?**
   Sakuga carries seven plus four action packs. We have four constants. The
   right number for twelve NPCs in a mini-game is probably nearer four than
   eleven, but that is a guess.
10. **Trade resolution.** Ikemen has `priority` + `prioritytype`
    (Hit/Miss/Dodge, `char.go:11085`); Sakuga has `Priority` plus a clash
    outcome. We resolve symmetrically. Is either better, or just more
    configurable?
11. **What does `hitshaketime` vs `hittime` vs `slidetime` buy** that a single
    stun number does not? Phase 3 assumes the split is worth it. Verify first.
12. **Does a move list and a drill actually change how it feels?** Discoverability is
    built on the claim that invisibility is now the bottleneck. That claim is
    reasoning, not measurement, and the headless harness cannot test it — a bot
    always knows every mechanic. Needs a human.
13. **Would a three-node grapple graph read on a phone?** The scoped version in
    §7 asks the player to make a directional choice inside a 13-frame hold. That
    may be unreadable at 320×180 with 15px fighters, which is the same doubt as
    §8.1 and probably has the same answer.
14. **Other references not yet read.** Skullgirls' and Rivals of Aether's public
    design writing; the Street Fighter III parry literature; anything on throw
    tech windows on touchscreens. **None of these should be read before Phase 2
    ships** — see the scope note in §6.

---

## 9. Research log

Append-only. Date, what was read, what came out of it.

*Entries below predate the §6 rewrite of 2026-09-21 and refer to the old
"Stage" numbering. They are left as written; §6 is the current order.*

### 2026-09-14 — ten open-source browser fighters
See `FIGHTER-RESEARCH.md`. Nine of ten were shallower than what we already had.
Two things worth taking, both MIT: `roiizchak/vibe-fighter`'s art/sim sync
discipline, and `RyoSogawa/use-street-fighting-command`'s motion-input matcher.
Neither has been used yet.

### 2026-09-21 — the triangle pass
See `FIGHTER-DEPTH.md`. Diagnosed and fixed: defence paid nothing, one button
was the whole game, there was no third option. Found while testing: the juggle
cap bounded only the juggle rule, so a third hit came through the ordinary
overlap on the way down.

### 2026-09-21 — Ikemen GO
This document, §1–§5. Headline finds, in the order they surprised us:

- Airborne bodies are solid in our game; cross-ups are impossible (§2.1).
- A hit reaction is one state for us and eight for them; the shake/knockback
  split is the one that matters (§2.2).
- Their generic AI is a random button-jammer — we are ahead there (§5).
- `HitDef` is a 130-field checklist; roughly a dozen of those fields are things
  we hand-rolled as predicates (§3).

Read but not yet mined: `src/bytecode.go` (the whole state-controller
vocabulary — 420k lines, likely more findings in it), `src/anim.go` (the
art/sim contract), `data/dizzy.zss`, `data/score.zss`, `data/training.zss`
(what diagnostics a fighting game considers essential — may be worth aligning
the test harness to), `data/tag.zss`.

### 2026-09-21 — Sakuga Engine

MIT, C#/Godot 4, ~25k lines of which ~12k is engine. A 2024 anime fighter rather
than a 1999 arcade one, and **closer to our problem than Ikemen on almost every
axis**. Read: `Globals/GlobalEnums.cs`, `Globals/GlobalFlags.cs`,
`Globals/GlobalVariables.cs`, `Resources/HitboxElement.cs`,
`Resources/BlockSettings.cs`, `Resources/MoveCancelSettings.cs`,
`Components/SakugaProrations.cs`, `Components/CombatTracker.cs`,
`Resources/AI/*`, `Components/AIBrain.cs`, `HitNotifs.tres`.

Headline finds, in the order they surprised us:

- **We have no counter hit.** Not mentioned once in the Ikemen pass because
  Ikemen buries it; Sakuga prices it in five places. Every hit in our game is
  the same hit (§2.5).
- **Gravity proration is how a juggle should end** — the victim gets heavier
  until the combo dies, instead of a hard cap making the third hit whiff for
  invisible reasons. Supersedes the juggle-points plan (§3, Stage 3).
- **Same-move proration is the principled version** of the hard "a jab cannot
  cancel into a jab" ban we shipped. Ours is a hack that happens to work.
- **The corner should pay both ways** — they scale corner combos to 120%
  against a 100% base. Ours is all stick and no carrot (Stage 4).
- **Cancels are per-target, per-outcome, per-window**, with block-cancel as a
  first-class flag. No block-cancel means no blockstrings.
- **Their AI is data, and better shaped than ours** (§5). Decision rates as
  ranges, a single `PredictionQuality` difficulty knob, aggressive/defensive
  personalities, action packs per distance band. This is the one idea in either
  repo that reaches outside the fighter — it is what would make our twelve NPC
  opponents fight differently. Added as Stage 6.
- **A parry need not be a new move.** `InstantBlockWindow = 3` is a window on
  the block you already have. Reclassified out of §7.
- **Two independent confirmations we got something right**: their input buffer
  is 10 frames against our 4–10 (baseline 7), and their block hitstop is 6
  against a base of 10 — the same 0.6 ratio we picked by hand.

Read but not yet mined: `Resources/FrameDataEvents/` (a move as a list of
condition→action events — 24 conditions, 35 actions; an architecture worth
understanding even if we never adopt it), `Collision/PhysicsWorld.cs`,
`Components/StanceManager.cs`, `Components/SakugaSuperArmor.cs`,
`Utils/ChecksumCalculator.cs` (determinism verification — possibly useful to the
test suite), `Components/FighterCamera.cs`.

---

### 2026-09-21 — Schwarzerblitz

BSD-3 code, all-rights-reserved assets, ~82k lines of C++/Irrlicht, Windows,
3D. A shipped game rather than a framework, from the Tekken/Virtua Fighter
school — the only one of the three in that lineage, and therefore the only one
aimed at what was originally asked for. Read: `FK_Move.h`,
`FK_MoveListMove.h`, `FK_SceneGameTutorial.h`, `FK_AIManager.h`, `LICENSE.md`.

Two finds that matter:

- **The player cannot learn our game.** Their tutorial is a numbered curriculum
  of 23+ phases, one mechanic each, and they ship a move list panel. We have a
  paragraph of help text and three mechanics added last week that nothing
  announces. Promoted to Stage 0, above every other stage (§2.8).
- **Move strings as a trie** — `followupMoves` and `cancelIntoMoves` as two
  distinct lists, `followupOnly` moves, `isMultiChainable`. This is the Tekken
  texture, specified. Still parked, on thumb grounds rather than model grounds
  (§7).

Smaller finds, all logged in §3: per-throw escape inputs, `moveMinRange`,
`attackTypeAtFrame`, per-move `maximumDamageScaling`, per-move AI hints,
`movePriority`, just-frame inputs.

Confirmations rather than finds: their AI is likelihood knobs per behaviour
(`getGuardLikelihood`, `getThrowEscapeLikelihood`, `getChainLikelihood`,
`getJumpLikelihood`, `getAfterMoveCooldown`), which is the same family as
Sakuga's and validates the Stage 6 shape without adding to it.

**Returns are clearly diminishing.** Ikemen gave five structural holes, Sakuga
three plus the AI idea, this one two. Three engines read, nothing built. The
next move is Stage 0, not a fourth repository.

### 2026-09-21 — GrappleMap, and a refusal

Two repositories checked, neither a fighting game engine. Full notes in §1d.

**GrappleMap** (public domain) is a 5,647-position database of grappling
positions and transitions. One idea worth having, and it is one no engine in
this document had: **a grapple is a graph, not a move.** Positions are nodes
with a tagged state vocabulary, transitions are edges, and a training drill is a
path through it. That is the Def Jam grapple described precisely. Parked in §7
with a scoped three-node version costing roughly sixty lines, because 5,647
nodes against our 2,000-line fighter is not a proposal.

**Virtual Pro-Wrestling 2** is refused. It is AKI Corporation's engine and AKI
went on to build Def Jam Vendetta and Fight for NY, so the lineage is the most
on-target thing anyone has pointed at. It is still wrong on two independent
grounds: it is an unlicensed matching decompilation of a copyrighted commercial
game (the NBA Jam category, already governed by a standing rule), and there is
nothing in it to read — 408 files of auto-named MIPS assembly and 558 lines of
docs that are entirely about ROM layout. A decompilation is not a reference.

**Count so far: five repositories examined, zero lines of fighter code written
since the triangle pass.** The scope note in §6 stands and now applies to
non-engine references too.

### 2026-09-21 — Virtual Pro Grappler

An original AKI-inspired wrestling engine — the legitimate version of what §1d
refused. **GPLv3, and TypeScript on Vite: our exact stack.** First reference
where the no-code rule is a real constraint rather than a formality, because
these files would drop straight into `components/` and relicense the product.
Its `src/combat/reversal.ts` also transcribes a probability table whose source
doc cites N64 RAM addresses. Prose yes, code and digits no.

The value is `docs/mechanics/` — 2,163 lines of plain-English design writing,
the best-written material in any of the six repositories. Three finds:

- **Two buttons are not the ceiling; context is** (§2.10). This overturns a call
  this document made twice. Strings were parked because two buttons run out of
  combinations — but AKI's answer was never strings, it is position × strength
  × direction × button. Eight moves per grapple position from two buttons. Our
  grab already freezes both fighters for thirteen frames with one outcome;
  reading the D-pad during that hold gives four, for no new button and no new
  state (§7).
- **The reversal model** — one press, before the attacker commits, mashing
  explicitly no help. Ours rewards mashing, which is a decision-free mechanic
  and now a Stage 3 item. Their probabilistic roll is the part to leave; we
  scale the *window* by `focus`, not the odds.
- **A wake-up attack with its own reversal window** (`Rising` →
  `RecoveringAttack`). Getting up is our only fully optionless moment. Added to
  Stage 3.

Also noted, not findings: an `InteractionRegion` as the single source of truth
for spatial context (we recompute distance and facing in several places);
`Parameters.md` has a "What Parameters Do Not Affect" section, which is a
discipline worth copying while four of twelve hoops roster modifiers still do
not reach the sim; and `state-vocabulary-stress-test.md` stress-tests a
proposed vocabulary against six real moves, marking each CLEAN / STRAINS /
BLOCKED — the same propose-then-break-it method this session has been using,
which is a pleasing independent confirmation of the process if not of any
mechanic.

**Six repositories examined. Still nothing shipped since the triangle pass.**

### 2026-09-21 — the hunt for borrowable grappling code

Asked for wrestling and grappling code we can **borrow** rather than read.
Checked our own position first: `private: true`, no LICENSE, proprietary.

**Negative result, and the important one in this log: there is none.** Full
table in §1f. The two closest matches are both TypeScript, both good, and both
unusable — Virtual Pro Grappler is GPLv3 and would relicense this game, and
`tb808/TUC` states no licence at all, which means all rights reserved. Every
permissively licensed project is in a language we would port from, which is
writing our own code from someone else's design — exactly what this document
has been doing for six repositories.

The only freely usable artefact found anywhere is GrappleMap's public-domain
**data**, not its code.

Read TUC anyway, for rules (§1g). Worth it: it runs a complete
clinch → takedown → ground → submission loop in **295 lines**, which kills the
scale objection that had the grapple parked in §7 through three research
passes. Promoted to **Stage 5.5** with a design sized for our three buttons,
taking the sprawl — a specific defensive read that beats a grab outright — as
the piece that finally closes our triangle.

Also a third independent confirmation of §2.10: TUC remaps a punch into a
clinch punch or a ground punch by context. AKI slots, VPG slot data and TUC all
solve "more moves than buttons" the same way, and none of them does it with
strings.

## 10. Standing rules

1. **Measure, do not reason.** Every claim in this document that is not a
   citation is a number from the headless harness.
2. **Every mechanic ships its AI half in the same change.** The bug found on
   2026-09-21 was exactly "the opponent cannot do the thing the game teaches
   you": correct play took eight hits a match and won every one.
3. **Prove the test has teeth.** Break the thing deliberately and watch the
   check fail with the right message. Four first-draft checks in the triangle
   pass did not discriminate and were rewritten rather than kept.
4. **Revert rather than ship something measurably worse.**
5. **No code, no data, no art from any reference in §1.** That covers Ikemen GO
   and the M.U.G.E.N ecosystem, Sakuga Engine, Schwarzerblitz (whose assets are
   explicitly all-rights-reserved), GrappleMap and Virtual Pro Grappler. Rules
   and shapes only.
5b. **This repository is proprietary** — `private: true`, no LICENSE file. That
   is what makes GPLv3 fatal rather than inconvenient, and it is why a
   repository with no stated licence (all rights reserved by default) is just
   as closed to us as a commercial one. Checked before borrowing, every time.
5a. **Virtual Pro Grappler is GPLv3 and is written in our own stack.** Copying
   from it would oblige us to release this game under GPLv3, and unlike every
   other reference the code is copy-paste compatible. Read its prose, write our
   own code, pick our own numbers. This is the one licence in the set that
   changes what we may ship, not merely what is polite.
6. **A decompilation of a commercial game is not a reference.** Established over
   the leaked NBA Jam source and reaffirmed for Virtual Pro-Wrestling 2 (§1d).
   Do not reopen either.
7. **Stop reading and build.** Five repositories have been examined and nothing
   has shipped since 2026-09-21. No further reference — engine or otherwise —
   before Stage 0 is in the game.

---

## 11. How we know it worked

The fighter is done when, over a stable seeded sample:

- Playing correctly beats mashing by a wide and stable margin (currently 78% vs
  3%, and the gap is the point, not the endpoints).
- A casual thumb sits near even (currently 45%).
- No single strategy — mash, turtle, jump, grab — exceeds ~55% on its own.
- Live play is above 70% of running time.
- Every mechanic in the help text is one a bot can be written to use, and that
  bot beats one that ignores it.
- And — the one the harness cannot check — a person who has never played it can
  find the grab, the break and the combo without being told by us. Three engines
  were read to decide what to build next; none of that matters if the thing we
  already built stays invisible.

---

## 12. Engineering practices worth borrowing

From a second pass over Virtual Pro Grappler, reading the **source** rather than
the design docs. These are not fighting-game mechanics; they are ways of
building a simulation, and several of them answer problems this session hit
directly. GPLv3 still applies (§1e, rule 5a): the ideas below are described so
we can write our own versions, and none of their code is used.

### 12.1 Record when presses happened; do not just count down

**The find that changes a decision.** Our buffer is four countdown timers —
`f.buf.a`, `.b`, `.up`, `.c` — decremented each frame and zeroed when a move fires
(`StreetFighter.tsx:764`, `:780`, `:1063`). It answers exactly one question: *is
there a live press right now?*

Theirs (`src/sim/InputBuffer.ts`) keeps a frame-stamped history of press events
— action, start frame, release frame, tap-or-hold — and exposes
`pressedWithin(action, start, end)`.

The consequence is concrete. **A countdown buffer cannot express an instant
block**, because judging one means looking *backwards* from the hit frame: "was
guard pressed in the three frames ending here?" By the time our hit resolves,
the press has been consumed or has decayed, and nothing records *when* it
happened. §7 currently claims a just-defend is "a handful of lines on top of
`blockSucceeds`". **That is wrong**, and only reading their code showed it.

The same history gives tap-versus-hold for free (they use ~0.2s), which is the
input half of §2.10 that the doc pass missed: weak and strong come off the
*same button* held for different lengths. We have no hold concept at all.

### 12.2 The simulation should know what frame it is

We track `s.elapsed` in seconds (`StreetFighter.tsx:1681`). They keep an integer
`frameIndex`. Everything frame-exact wants the integer: input windows, per-move
reversal windows, and tests that want to assert real frame advantage rather than
deriving it from the move table.

Their `MoveData` carries `hitFrames: number[]` and an optional
`reversalWindow: {start, end}` — per-move, not global. Our active window is one
contiguous block, which is fine until a move needs to hit twice.

### 12.3 Calculations should return their working

The best idea in the repository. `DamageBreakdown` carries `factor1`, `factor2`,
`factor3`, `subtotal` and each derived total; `ReversalOdds` carries `base`,
`afterWeight`, `afterHealth`, `probability`. Their comment: *"Each step of the
calculation, so a debug view can show the working."*

Ours return bare numbers — `shotChance()` in hoops, damage computed inline in
`applyHit`. When a check fails we get `expected > 0.4, got 0.23` and no idea
which factor moved. Every time this session narrowed a number down, it was by
writing a throwaway script to recompute the intermediate steps by hand.

### 12.4 Log every exchange, including why it missed

`ExchangeLog { frame, attacker, moveName, connected, missReason, breakdown }`,
kept as a history and surfaced in a debug overlay.

Three separate scratch harnesses were written this session to answer "why did
that not connect" — the juggle that whiffed above 30px, the grab that a live AI
kept jabbing out of, the shooter who drifted through his own wind-up in hoops.
A miss reason inside the sim answers that permanently, and makes it assertable
instead of eyeballed.

### 12.5 Move selection is a table, not a ternary chain

Our selection is nested ternaries (`StreetFighter.tsx:1053-1098`): airborne
picks `air`, `down` plus meter picks `special`, otherwise `jab`. That is a slot
resolver written by hand, and it will stop being readable the moment §2.10 adds
a grapple context.

Their `data/moves/move-slots.json` makes a slot the tuple
*(actor_state × target_state × range × input_pattern)*, where `input_pattern`
covers simultaneous buttons, either-or groups, d-pad direction, a
`tap | hold | rapid_tap` modifier, and fire-on-release.

The half we do not have at all is **`target_state`**: not one of our moves cares
what the opponent is currently doing.

### 12.6 Give roster stats a budget and a validator

`PARAMETER_BUDGET = 30` across ten values, with `validateProfile()` returning
structured errors, and a design note that leaving points unspent is legitimate
because it marks a real weakness.

This lands on two open items at once: Stage 6's per-opponent records, and the
long-standing hoops roster work (task #25). Our hoops modifiers have spans but
**no budget**, so nothing stops a roster entry being strong at everything. A
budget plus a validator turns "is the roster balanced?" from a judgement into a
test.

### 12.7 Count the random draws

Their `Rng` carries a `drawCount` "for debugging desyncs", plus
`snapshot()` / `restore()`.

This session hit exactly that pain: changing `AI_PUNISH_CHANCE` from 0.7 to 0.45
moved *every* number in the balance matrix, because the RNG stream consumption
changed rather than because the game changed. A draw count makes that visible
instead of mysterious. Snapshot/restore would let a test branch two ways from
one common state.

### 12.8 Data files that document their own fields

Their move-slot JSON opens with a `field_definitions` block explaining every key
inline, so the file is readable without hunting for the schema.

### What we already do — recorded so it is not mistaken for a gap

- **Clamping a long frame.** `useGameLoop.ts` already caps delta (`MAX_FRAME`)
  so a backgrounded tab cannot hand the sim a huge step. Theirs caps steps per
  frame and discards the backlog. Same protection, different shape.
- **A seeded, reproducible RNG**, and a test that the same seed fights the same
  fight twice.
- **Referential integrity on content.** `scripts/check-art.mjs` already checks
  art references the way their `tools/validate-data.mjs` checks assets. Their
  one refinement worth copying: an asset may be declared *pending* and reported
  as a note rather than an error — which is precisely the state our 205
  animation frames are in.
