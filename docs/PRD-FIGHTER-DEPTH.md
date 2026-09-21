# Street fight — depth PRD

A living document. The fighter got its triangle in September; this is where the
rest of the depth comes from, what we have verified, what we have not, and the
order we intend to build in. Sections get marked DONE with the measurement that
closed them. Open questions stay open in §8 and the research log in §9 is
append-only.

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

Two further repositories were checked and are **not** in that table, because
neither is a fighting game engine. They are recorded in §1d.

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

## 6. The plan

Each stage ships with its AI half, its measurement, and its mutation test.
Stages are ordered by feel-per-risk, not by size.

### Stage 0 — make what we already built visible

Added after the Schwarzerblitz read, and **promoted above everything else**,
because the fighter's problem stopped being "not enough mechanics" on
2026-09-21 and became "nobody can find the mechanics".

- A move list the player can open — seven moves, their inputs, one line each.
  Schwarzerblitz has `FK_MoveListPanel`; every fighting game has one; we have a
  paragraph of help text.
- Three or four 15-second drills, in the shape of `FK_TutorialPhase`: block a
  kick and punish it, grab a guard, break a grab, land the combo.
- The hit callouts from Stage 2 belong here too if they are cheap enough —
  "PUNISH", "BREAK", "COUNTER" is the game teaching its own rules for free.

*Gate:* this one is not measurable with the headless harness, which is exactly
why it keeps getting skipped. It needs a human playing on a phone. That is the
same open item as §8.2 and it should be closed at the same time.

### Stage 1 — make the jump a real option

- Airborne bodies pass through each other; cross-ups become possible.
- Jump startup and landing recovery, so a jump is a commitment with a cost.
- Air guard.

One coherent change that adds a whole axis to a game currently played only on
the ground. **Worth doing even if we do nothing else.**

*Gate:* the air attack's win contribution rises; jump frequency does not go to
the moon (landing recovery should price it); the opponent's jump-in read stops
being free. Guard against: a cross-up that the AI cannot ever block.

### Stage 2 — impact, and the counter hit

- **Counter hit** (§2.5): contact during the defender's startup frames is a
  counter — roughly double hitstop, more damage, more advantage. Nearly free, and
  it is the mechanic that pays for reading the opponent.
- **Hit callouts** (§4): "Counter", "Punish", "Break", "Knockdown". The cheapest
  feedback in this document, and we have three new mechanics the player currently
  has no way of knowing worked.
- Shake-then-knockback split (§2.2).
- Attacker and defender freeze as separate authored numbers; block freeze too.
- At least three reaction types, so a kick does not read like a jab.
- `EnvShake` with frequency and decay in place of the scalar.

Mostly feel. The counter hit is the one real balance change, and it should
sharpen the neutral game rather than move win rates much.

*Gate:* no match-length regression; `proper` should gain a little from counters
and `mashHeavy` should lose a little to them. Anything bigger means the counter
bonus is too large.

### Stage 3 — agency on the way down, and combos that end by themselves

- Knockdown tech (`fall.recover` / `fall.recovertime`), with a `TechingRate` on
  the opponent so it is not all-or-nothing.
- **Throw invulnerability on wake-up** as a typed frame property (§2.7). We
  shipped a grab and then left getting up defenceless against it.
- **Gravity proration replaces `JUGGLE_MAX`.** Each juggle hit adds gravity so
  the victim falls faster and the combo dies on its own. This supersedes the
  juggle-points plan: no arbitrary cap, no third hit whiffing for reasons the
  player cannot see. Delete `juggleSpent` and `JUGGLE_MAX` together.
- **Same-move proration replaces the hard ban** on cancelling a jab into a jab.
  The current rule is a hack that happens to work; scaling is the principled
  version and it generalises to every move.
- Ground bounce as a juggle extender.

*Gate:* free wake-up pressure drops without knockdowns becoming worthless;
juggle length spreads naturally to 1–3 instead of pinning at 2; mashing one
button stays as bad as it is now (3%) *without* the hard cancel ban.

### Stage 4 — the stage is a place

- Corner push, with hit and block values authored separately (the stick).
- **Corner damage scaling** — combos in the corner are worth more (the carrot).
  Sakuga runs 120% against a 100% base. Right now our corner is pure downside
  for the defender and pure upside for the attacker, with no tension either way.
- Camera auto-zoom.

*Gate:* damage taken while cornered drops, but time cornered does not go to
zero, and getting someone cornered is still clearly worth doing.

### Stage 5 — the special is a big deal

- Superpause: world freeze, attacker head start, victim unhittable window.

*Gate:* the special's hit rate rises; its win contribution does not double.

### Stage 6 — opponents who fight differently

Pull our four hardcoded AI constants (`AI_PUNISH_CHANCE`, `AI_COMBO_CHANCE`,
`AI_JUGGLE_CHANCE`, `AI_BREAK_CHANCE`) out into a per-opponent behaviour record,
in the shape Sakuga uses (§5): decision-rate ranges, blocking rate, teching rate,
a single `prediction` difficulty knob, a low-health threshold, and an
aggressive/defensive lean. Wire it to the NPC roster we already have, following
`systems/hoops/roster.ts`.

This is the only stage that is a *product* change rather than a fighter change:
it is what makes fighting the bouncer different from fighting the washed-up
rapper, which is currently impossible even in principle.

*Gate:* two opponents with different records produce measurably different match
shapes — hits taken, block rate, match length — against the same player policy.
If they do not, the record is not doing anything.

**Scope honesty, revised.** Seven stages is far too many for one of twelve
mini-games, and the list has now grown twice from reading rather than from
playing. Three engines have been read and nothing has been built.

If only two stages ever happen they should be **Stage 0 and Stage 2** — make the
existing mechanics visible, and make hits feel like hits. Stage 1 (the cross-up)
is the most interesting change here and it is still gated on §8.1, which nobody
has answered.

**Do not read a fourth engine before shipping Stage 0.**

---

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
  block you already have**, not a separate input. That is a handful of lines on
  top of `blockSucceeds`, it rewards reading without touching the grab's slot,
  and it gives the "Just" callout something to announce. Candidate for Stage 2
  or a Stage 2.5; needs a decision.
- **Red life** (recoverable damage). Noise in a three-round mini-game.
- **The `hitflag` / `guardflag` refactor as a standalone change.** It is the
  right model and it deletes three predicates, but on its own it is a large diff
  with zero visible difference. Fold it into Stage 3 only as far as it pays.
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
  also the shape Stage 0's tutorial drills want.

  That is the Def Jam grapple: you clinch, and from the position you end up in a
  *different set of options* is available.

  Parked, and the scale is why. GrappleMap has 5,647 positions; our entire
  fighter is about 2,000 lines. But the shape does not need 5,647 nodes — it
  needs three. **The scoped version, if we ever want it:** the grab catches into
  a clinch; from the clinch, forward-plus-button and back-plus-button lead to two
  different positions; each position has its own finish and its own escape.
  That is roughly one extra state and two extra branches on the hold we already
  have, and it turns the grab from one move into a small read. Perhaps sixty
  lines. Revisit only after Stage 0 — a grab nobody can find does not need a
  second layer.
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
  being legible on a 320×180 phone screen. **Revisit only after Stage 0**: if a
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

1. **Does a cross-up even read at 320×180?** The whole of Stage 1 rests on the
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
   measuring, not assuming.
8. **Does the counter hit need to be visible to work?** Stage 2 pairs it with a
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
    stun number does not? Stage 2 assumes the split is worth it. Verify first.
12. **Does a move list and a drill actually change how it feels?** Stage 0 is
    built on the claim that invisibility is now the bottleneck. That claim is
    reasoning, not measurement, and the headless harness cannot test it — a bot
    always knows every mechanic. Needs a human.
13. **Would a three-node grapple graph read on a phone?** The scoped version in
    §7 asks the player to make a directional choice inside a 13-frame hold. That
    may be unreadable at 320×180 with 15px fighters, which is the same doubt as
    §8.1 and probably has the same answer.
14. **Other references not yet read.** Skullgirls' and Rivals of Aether's public
    design writing; the Street Fighter III parry literature; anything on throw
    tech windows on touchscreens. **None of these should be read before Stage 0
    ships** — see the scope note in §6.

---

## 9. Research log

Append-only. Date, what was read, what came out of it.

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
   explicitly all-rights-reserved), and GrappleMap. Rules and shapes only.
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
