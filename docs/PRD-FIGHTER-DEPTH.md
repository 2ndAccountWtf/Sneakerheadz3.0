# Fighter — the plan

The index and the build order for the street-fight mini-game. Detail lives in
the four documents this one points at; nothing is duplicated.

| document | what it is for |
|---|---|
| **this one** | where the fighter is, what gets built in what order, what is out of scope, what is still unknown |
| `SPEC-FIGHTER-CONTROLS.md` | Phase 1 and 1b — input foundation, animation contract, the stick and four buttons |
| `SPEC-FIGHTER-GRAPPLE.md` | Phase 2 — the grapple, and the eight decisions that gate it |
| `SPEC-FIGHTER-COMBAT.md` | Phases 3, 4, 5, 8, 10 — block roll, impact, air, ground, dirty fighting |
| `FIGHTER-REFERENCES.md` | the six engines read, the licence position on each, the gap tables, the research log |
| `FIGHTER-ENGINEERING.md` | practices worth borrowing, and the standing rules that keep these numbers trustworthy |

Two older documents remain: `FIGHTER-RESEARCH.md` (2026-09-14, ten browser
fighting games) and `FIGHTER-DEPTH.md` (the write-up of the triangle pass that
shipped).

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

---

## 1. The build order

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

### The dependency graph

Read top to bottom; an arrow means *cannot start until*.

```
  1  input + animation contract
     ├── 1b  controls: stick + four buttons  (needs press timing)
     │    └── 8  block is a roll             (opened by block-on-a-button)
     ├── 2  grapple                          (needs tap/hold + press timing)
     │    ├── 2a move list
     │    └── 10 dirty fighting              (headbutt lives in the clinch)
     ├── 3  impact / counter hit             (independent, could go first)
     └── 5  ground game                      (needs typed frame properties)
              └── 10 stomp                   (same typed-property mechanism)

  4  air game        — needs 1b (crouch off the stick) and 3 (reactions)
  6  opponent records — needs 2, 3, 5, 8, 10; the AI learns them all at once
  7  corner + camera  — independent
  9  the fight is an event — independent of all of it; pure integration
```

**Three things fall out of that graph:**

- **Phase 1 gates almost everything.** Frame-stamped input and the animation
  contract are underneath the controls, the grapple, the sprawl, the instant
  block and the block roll.
- **Phase 9 is independent.** The RPG integration touches `onFinish` and the
  systems around it, not the simulation. It could be built at any time by
  anyone, in parallel.
- **Phase 6 must come last among the mechanical phases**, because the AI has to
  learn every mechanic in one change or we recreate the bug where correct play
  beat the opponent 100–0.

### Per-phase engineering detail

What each phase actually touches. Near phases in detail, later ones in outline.

**Phase 1 — input and animation contract**
- `StreetFighter.tsx`: `FightState` gains `frame: number`; the four `buf.*`
  countdowns are replaced by a press history; `Fighter` gains `anim: AnimState`
  and `animT`.
- `bufferPresses` / `decayBuffer` / `canAct` / `tryLight` / `tryHeavy` all read
  the history instead of the counters.
- `drawFighter` switches on `anim` rather than inferring a pose from `move`
  plus `armUp`.
- New: `pressedWithin(action, start, end)`, `heldFor(action)`.
- Tests: every existing buffer and focus check passes unchanged; every
  reachable fighter state maps to a declared `AnimState` with no fallback;
  `pressedWithin` answers correctly across a frame boundary.

**Phase 1b — controls**
- `components/minigames/engine/`: the floating stick, the four-button layout,
  layout persistence. Shared, not fighter-local.
- `FightInput` gains `block`; `blockHeld` stops deriving from `wantBack`.
- Pair detection (BLOCK+PUNCH) lives in the fighter, not the engine, because
  only the fighter has that meaning.
- Tests: pair detection across a spread of press offsets; no false positives;
  reachability at the smallest supported screen.

**Phase 2 — grapple**
- `Fighter` gains `stamina`, and the clinch state machine.
- `MoveDef` gains the clinch outcome table.
- `resolveContact` grows a clinch branch; `resolveHold` becomes rung-aware.
- The eight open decisions in §Phase 2a must be answered **before** this starts.
- Tests: each clinch outcome reachable and distinct; the sprawl beats a grab
  and only inside its window; the break cannot be mashed; stamina gates entry.

**Phase 8 — block roll**
- `blockSucceeds` returns a quality rather than a boolean; `applyHit` grows a
  glancing branch; `Fighter` gains `guardHeld`.
- `MoveDef` gains `pierce`.
- Tests: fresh correct guard is near-certain clean; a long-held guard leaks; a
  permanently-guarding bot loses harder than today; a short correct guard is
  still rewarded.

**Phase 3 — impact** · `applyHit` splits shake from knockback; `MoveDef` gains
separate attacker/defender freeze and a reaction type.

**Phase 10 — dirty fighting** · four moves, the `blinded` status, and the typed
frame property that lets the stomp hit a downed fighter.

**Phase 5 — ground game** · tech, wake-up attack, typed throw invulnerability,
gravity and same-move proration replacing both hard caps.

**Phase 4 — air game** · `separate()` learns about `y`; jump gains startup and
landing states; air guard.

**Phase 6 — opponent records** · the four AI constants become a per-NPC record
with a budget and a validator; the AI learns phases 2, 3, 5, 8 and 10.

**Phase 7 — corner and camera** · corner push authored per move; corner damage
scaling; auto-zoom.

**Phase 9 — the fight is an event** · `onFinish` returns a result object;
wiring to `systems/hospital`, `systems/police`, `banking.ts`,
`systems/opponents.ts`.

### The phases, in build order

Each links to its spec. Gates are the measurement that closes the phase.

**1 · Input foundation and the animation contract** · ~M ·
`SPEC-FIGHTER-CONTROLS.md`
A frame index, frame-stamped press history replacing the four countdown
timers, tap-versus-hold, and the named animation states art will plug into.
**Gates almost everything else.**
*Gate:* every existing buffer and focus check passes unchanged; every reachable
fighter state maps to a declared `AnimState` with no fallback.

**1b · The control scheme** · ~M · `SPEC-FIGHTER-CONTROLS.md`
One 8-way stick, four buttons — punch, kick, jump, block. Everything else
derives. Block moving to a button is the important change and it opens Phase 8.
*Gate:* pair detection across a realistic spread of press offsets; reachability
at the smallest supported screen.

**8 · Blocking is a roll** · ~M · `SPEC-FIGHTER-COMBAT.md`
A guard is an attempt, not an immunity: clean, glancing or breach. Closes the
free-advancing-guard hole Phase 1b opens, and gives range a real job.
**Not optional if 1b ships.**
*Gate:* a permanently-guarding bot loses harder than today; a short correct
guard is still rewarded; `proper` moves by only a few points.

**2 · The grapple system** · ~L · `SPEC-FIGHTER-GRAPPLE.md`
Entry at a stamina cost, two clinch rungs, the outcome picked by the stick
direction, and four distinct defensive answers including the sprawl.
*Gate:* the grab's usage rises without its win contribution rising; an
always-grabbing bot stays beatable by one that reads the sprawl.

**3 · Impact and the counter hit** · ~M · `SPEC-FIGHTER-COMBAT.md`
Contact during the defender's startup, shake-then-knockback, separate
attacker/defender freeze, reaction types, shake with decay.
*Gate:* no match-length regression; `proper` gains from counters and
`mashHeavy` loses to them, neither by much.

**10 · Dirty fighting** · ~M · `SPEC-FIGHTER-COMBAT.md`
Eye rake, groin kick, headbutt, stomp. Priced in the opponent's hype rather
than socially, and they add a sixth mechanical role: debuff.
*Gate:* each is used and none dominates; the blind is felt without being
frustrating.

**5 · The ground game** · ~M · `SPEC-FIGHTER-COMBAT.md`
Knockdown tech, wake-up attack, typed throw invulnerability, and proration
replacing both the hard juggle cap and the hard jab-into-jab ban.
*Gate:* free wake-up pressure drops without knockdowns becoming worthless;
juggle length spreads to 1–3.

**4 · The air game** · ~L · `SPEC-FIGHTER-COMBAT.md`
Airborne bodies pass through each other so cross-ups exist at all; jump startup
and landing recovery; air guard; the instant block.
*Gate:* the air attack's win contribution rises; jump frequency does not run
away; a cross-up beats a held guard and can still be learned.

**7 · The stage and the camera** · ~M
Corner push authored per move, corner damage scaling, camera auto-zoom.
*Gate:* damage taken while cornered drops, time cornered does not go to zero.

**6 · Opponents who fight differently** · ~M
The four AI constants become a per-opponent record with a points budget and a
validator, and **the AI learns every mechanic from 2, 3, 5, 8 and 10 in the
same change.** Last among the mechanical phases for that reason.
*Gate:* two named opponents produce measurably different match shapes against
the same player policy.

**9 · The fight is an event** · ~M · *independent of everything above*
`onFinish` returns a result object instead of a boolean and a sentence, wired
to `systems/hospital`, `systems/police`, `banking.ts` and
`systems/opponents.ts`. Touches no simulation code, so it can be built in
parallel at any time.
*Gate:* two fights with identical mechanical outcomes but different
circumstances produce materially different consequences in the world.

### ~~Phase 11 — how a fight ends~~ · **CUT 2026-09-21**

Proposed five endings — give up, the cops, someone breaks it up, running,
submission. **Cut by decision: there are two endings, K.O. and a timeout on
health.** Keeping it to two keeps the fight readable and keeps the consequences
in Phase 9 simple to reason about.

Note for Phase 2: a choke or armbar that empties the health bar is therefore a
K.O., not a separate submission ending.

### Match shape — a question, not a decision

Best-of-three sixty-second rounds is arcade convention and it is worth asking
whether it fits. Measured: **31% of a match's running time is not play**, and
much of that is round structure.

The alternative is **one fight, no round resets, ended on a knockdown count** —
boxing-shaped rather than arcade-shaped, which keeps a comeback structure
without the banner overhead and reads as a street fight rather than a bout.

Against it: rounds reset health, which is forgiving in a game where the damage
now follows you out (Phase 9). Not decided here; it should be decided before
Phase 9 rather than after.

---

### What is deliberately last, not skipped

**Discoverability** — a move list, drills, hit callouts. Real, and it belongs
after the mechanics are in, because there is no point teaching a grapple system
we have not built. It is not a phase in front of the engine work.

---

**The build order, flattened:** 1 → 1b → 8 → 2 (+2a) → 3 → 10 → 5 → 4 → 7 → 6,
with 9 slotted in wherever there is room, because nothing gates it.

**If only two phases happen, make them 1 and 2.** One is the foundation
everything else needs; the other is the grapple system, which is the largest
single gap between what this is and what was asked for.

**But Phase 8 is not optional if Phase 1b ships.** Moving block to a button
opens the free-advancing-guard hole, and the block roll is what closes it —
shipping the control change without it makes the neutral game worse than it is
today. It is also the single change most likely to make the fighter feel like a
fight rather than a frame-data exercise.

**And Phase 9 is the one most likely to be underrated.** Everything else in
this document makes the fighting better. Phase 9 is the only thing that makes
*this game's* fighter rather than a good generic one — a fight that costs you
health you keep, puts you in hospital, draws heat, and is remembered by the
person you beat.

---

## 2. Explicitly out of scope

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

## 3. Still to research

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
14. ~~**THE ONE REAL RESEARCH GAP: nobody has looked at a fighting game built
    for a touchscreen.**~~ **CLOSED 2026-09-21 — see §6 Phase 1b.** Skullgirls
    Mobile and Marvel Contest of Champions converged on the same grammar (tap /
    swipe / hold / two-finger / timed defence), and a swipe carries a direction
    in one thumb motion, which is what the grapple's four-way read needed. The
    original question, kept for the record: Six engines were read and every one assumed a
    controller — Ikemen, Sakuga, Schwarzerblitz, VPG, TUC and the whole AKI
    lineage take a d-pad, four-plus face buttons and no input latency as given.

    **We are a phone game with three buttons and a thumb.** Phase 2 asks a
    player to pick one of four directions inside a sixteen-frame window while
    holding a button down. That may simply not be possible with a thumb, and no
    amount of further engine reading will say.

    Worth looking at how mobile-native fighting games solved input on glass —
    the Skullgirls, Injustice, Shadow Fight and UFC mobile lineages each
    answered it differently, some tap-only, some with swipes, some by removing
    the directional pad altogether. **Platform research, not another engine**,
    and it decides whether Phase 2's four-way read ships as written or becomes
    a swipe, a two-way choice, or a hold-and-release.

    **This is the only outstanding research item in this document.** Everything
    else above is a decision to make or a number to measure.
15. **Other references not yet read.** Skullgirls' and Rivals of Aether's public
    design writing; the Street Fighter III parry literature. **None of these
    should be read before Phase 2 ships** — see the scope note in §6.

---

---

## 4. How we know it worked

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

