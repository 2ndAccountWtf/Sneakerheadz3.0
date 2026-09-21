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

## 1. The reference: Ikemen GO

`https://github.com/ikemen-engine/Ikemen-GO` — a Go rewrite of Ikemen, itself a
M.U.G.E.N-compatible engine. Read on 2026-09-21 at a shallow clone of `main`.

**Licence: MIT** (`LICENCE.txt`, Suehiro + contributors 2016–2026). So copying
would be legally fine. We are not going to, for two reasons that have nothing to
do with licensing:

1. It is ~420k lines of Go driving OpenGL/Vulkan, with netplay, Lua scripting
   and the SFF/AIR sprite formats. We are a 320×180 canvas in a React modal
   with procedurally-drawn fighters and three buttons. Nothing transliterates.
2. The value is the **data model**, not the implementation. `HitDef`
   (`src/char.go:589`) is a 130-field struct that is the most complete
   open-source specification of "what a hit is" that exists, and
   `data/common1.cns.zss` is a design document in disguise — it enumerates every
   state a fighter needs.

**Standing rule for this document.** No code, no data and no art from that
repository, or from the M.U.G.E.N content ecosystem around it, is used here, and
none may be. The Mugen character/stage ecosystem in particular is overwhelmingly
ripped commercial sprites — `FIGHTER-RESEARCH.md` §"The ripped-sprite problem"
already flags this. We read it for rules. Citations below are `file:line` so a
later session can re-find the thing rather than trust this summary.

---

## 2. Structural gaps — things our game cannot express

These are not tuning. The mechanic does not exist and cannot be reached from the
current model.

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

### 2.2 A hit has one reaction; theirs has eight

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

### 2.5 There is no superpause

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

---

## 4. Presentation gaps

| | Ikemen | ours |
|---|---|---|
| camera | auto-zoom on fighter distance, with `zoomindelay` / `zoominspeed` / `zoomoutspeed` (`src/camera.go:32-42`) | fixed 320×180; fighters range 18–302 apart |
| screen shake | `EnvShake{time, freq, ampl, phase, mul, dir, diradd, decay}` (`system.go:6676`) | a scalar counting down |
| flash / trails | PalFX and AfterImage as first-class time-driven effects | a `flash` frame counter |
| guard break | a set piece: shockwave, glass shards, blue screen flash, dedicated sound (`data/guardbreak.zss`) | n/a — we have no guard meter |

The camera is the one to take seriously. On a phone at 320×180 a camera that
pushes in during a close exchange is probably worth more than any single
mechanic in §2 or §3, and we already did this work on hoops.

---

## 5. Where we are ahead — do not copy

**Their generic AI is a random button-jammer.** `AiInput.Update(level)`
(`src/input.go:1863`) picks a random direction and mashes buttons at
`chance = (-11.25*level + 165) * 7`, plus a "cheat" that fires a random command
off the character's list when `RandF32(0, aiLevel/2+32) > 32`
(`src/char.go:13612`). Real Mugen AI is hand-written per character in CNS, which
is to say there is no general AI in that repo at all.

Ours — reaction delay, whiff punish, guard reading, block→punish, combo and
juggle follow-ups — is a better opponent than anything shipped there. Leave it
alone except to teach it each new mechanic (see §10).

Also out on grounds of "needs art data we do not have": CNS/ZSS state scripting,
the SFF/AIR sprite formats, and multiple CLSN boxes per animation frame.

---

## 6. The plan

Each stage ships with its AI half, its measurement, and its mutation test.
Stages are ordered by feel-per-risk, not by size.

### Stage 1 — make the jump a real option

- Airborne bodies pass through each other; cross-ups become possible.
- Jump startup and landing recovery, so a jump is a commitment with a cost.
- Air guard.

One coherent change that adds a whole axis to a game currently played only on
the ground. **Worth doing even if we do nothing else.**

*Gate:* the air attack's win contribution rises; jump frequency does not go to
the moon (landing recovery should price it); the opponent's jump-in read stops
being free. Guard against: a cross-up that the AI cannot ever block.

### Stage 2 — impact

- Shake-then-knockback split.
- Attacker and defender freeze as separate authored numbers; block freeze too.
- At least three reaction types, so a kick does not read like a jab.
- `EnvShake` with frequency and decay in place of the scalar.

Pure feel, no balance change intended.

*Gate:* no match-length regression, no win-rate movement outside noise.

### Stage 3 — agency on the way down

- Knockdown tech (`fall.recover` / `fall.recovertime`).
- Ground bounce as a juggle extender.
- Juggle points replacing `JUGGLE_MAX`; delete `juggleSpent`.

*Gate:* free wake-up pressure drops without knockdowns becoming worthless;
juggle length spreads to 1–3 instead of pinning at 2.

### Stage 4 — the stage is a place

- Corner push, with hit and block values authored separately.
- Camera auto-zoom.

*Gate:* damage taken while cornered drops, but time cornered does not go to
zero.

### Stage 5 — the special is a big deal

- Superpause: world freeze, attacker head start, victim unhittable window.

*Gate:* the special's hit rate rises; its win contribution does not double.

**Scope honesty.** Five stages is a lot for one of twelve mini-games. Stop after
Stage 2 and look at it before committing to 3–5.

---

## 7. Explicitly out of scope

Good ideas, deliberately not being built yet. Each one adds a rule to explain
and most add a HUD element, on a phone, in a mini-game.

- **Guard meter / guard crush.** A second answer to turtling besides the grab.
  Competes with the grab for the same slot; wait until the grab has been played.
- **Dizzy / stun.** One meter too many.
- **Parry / ReversalDef.** Def Jam's signature. Also competes with the grab.
- **Red life** (recoverable damage). Noise in a three-round mini-game.
- **The `hitflag` / `guardflag` refactor as a standalone change.** It is the
  right model and it deletes three predicates, but on its own it is a large diff
  with zero visible difference. Fold it into Stage 3 only as far as it pays.
- **Generalising the throw into custom states.** Our bespoke hold works.
- **More attacks.** Tekken's texture comes from strings per limb. A phone D-pad
  cannot express that and should not try; high / low / overhead / throw is what
  two buttons can carry.

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
   guard stance. Read but not understood; may or may not matter for us.
7. **Their trade resolution** (`priority` + `prioritytype` Hit/Miss/Dodge,
   `char.go:11085`). We resolve trades symmetrically. Is theirs better, or just
   more configurable?
8. **What does `hitshaketime` vs `hittime` vs `slidetime` buy** that a single
   stun number does not? Stage 2 assumes the split is worth it. Verify first.
9. **Other references not yet read.** Skullgirls' and Rivals of Aether's public
   design writing; the Street Fighter III parry literature; anything on throw
   tech windows on touchscreens.

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

---

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
5. **No code, no data, no art from Ikemen GO or the M.U.G.E.N ecosystem.**

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
