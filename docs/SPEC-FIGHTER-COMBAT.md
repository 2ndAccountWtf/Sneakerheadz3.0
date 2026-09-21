# Spec — combat systems

Phases 3, 4, 5, 8 and 10. Impact and the counter hit, the air game, the ground game, blocking as a roll, and dirty fighting.

Split out of `PRD-FIGHTER-DEPTH.md` on 2026-09-21, which had grown to 2,013
lines doing four jobs at once. That document is now the plan and the index;
this one is spec.

---

### Phase 8 — blocking is a roll, not a guarantee · ~M

**Decided 2026-09-21.** This replaces the stamina-tax version of the guard
economy, and it is a better answer than anything in the six references.

**The principle: the only defence that works every time is being out of range.**
A guard is an attempt, not an immunity. It usually works, sometimes it turns a
clean hit into a glancing one, and occasionally a punch, kick or elbow comes
straight through it.

That is true to fighting, and mechanically it does three jobs at once:

1. It **closes the free-advancing-guard hole** that Phase 1b opened, without a
   stamina tax bolted on — a permanent guard leaks damage on its own.
2. It gives **range a real job**. Backing out is the only clean answer, which
   is the neutral game the fighter has never really had.
3. It makes **the grapple the answer to a turtle**, alongside the leak, exactly
   as the design already intends.

#### Three outcomes, not two

`blockSucceeds()` currently returns a boolean. It becomes a roll returning one
of:

| outcome | effect |
|---|---|
| **Clean** | as today — blockstun, no damage, pushback |
| **Glancing** | partial damage (~30%), reduced blockstun, attacker keeps less advantage |
| **Breach** | it lands as though unguarded |

#### What drives the roll — and why it is not dice

The failure mode here is "I blocked and still got hit", which reads as unfair.
The answer is that **player-controlled factors dominate the roll**, and the
random part only decides the margin:

- **Stance** is the biggest term by far. Guarding low against a low attack is
  near-certain; the wrong stance stays a clean hit exactly as it does today.
- **Guard fatigue** — the longer a guard is held unbroken, the worse it gets.
  This is the piece that prices the advancing guard, and it is thematic rather
  than arbitrary: your arms get heavy.
- **Move weight** — a jab is easy to hold, a heavy or an elbow is not. A per-move
  `pierce` value, authored next to the block-freeze numbers in Phase 3.
- **Stamina**, and **`focus`**, which already scales the input buffer.
- Fresh guard, correct stance, full stamina should be *very* reliable. The roll
  should only bite when you are tired, wrong, or holding it forever.

#### It has to be legible

A roll the player cannot see is indistinguishable from a bug. Each outcome gets
its own read:

- **Clean** — the existing block spark and sound.
- **Glancing** — a different spark, the fighter rocks, a small chip of health.
- **Breach** — the full hit reaction, so it is obvious the guard failed rather
  than looking like the game dropped an input.

Guard fatigue needs a tell too — the guard arm visibly drops as it degrades,
which is also an `AnimState` the artist can key against.

#### A starting model

Concrete so it can be argued with and measured, not because these numbers are
right. Wrong stance is still a clean hit and never reaches the roll at all.

```
quality = BASE                        75
        + stance                     +30   correct height
        + stamina/100 * 15           0..15
        + focusTerm                 -5..+10
        - guardHeldFrames / 6         0..-50   capped
        - move.pierce                 jab 0, sweep 10, heavy 15, elbow 20, special 25
        clamped 0..95

roll 0..99     >= quality  ->  breach below 25, glancing below 55, else clean
```

Sanity, at the three cases that matter:

| situation | quality | reads as |
|---|---|---|
| fresh guard, right stance, full stamina, vs jab | 95 | near-certain clean |
| guard held ~3s, vs heavy, 40 stamina | ~66 | mostly clean, a third glancing, rare breach |
| guard held ~6s, vs heavy, low stamina | ~42 | leaks badly — turtling stops working |

The shape to defend is that **the first three seconds of a correct guard are
almost free, and the sixth second is not.**

#### Determinism

The roll goes through the existing seeded RNG, so the headless harness and the
"same seed fights the same fight twice" check keep working unchanged. Add a
draw counter (§12.7) in the same change — this is the first mechanic that
consumes RNG every time a hit connects, and without a counter a tuning change
will silently shift every measurement in the balance matrix.

*Gate:* a bot that walks forward permanently guarding must lose to a mixed bot,
and lose harder than it does today. A bot that guards **correctly and briefly**
must still be rewarded — if short, well-timed guards are unreliable, the roll is
tuned wrong. And `proper` must not drop more than a few points: this is a
neutral-game change, not a difficulty change.


---

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


---

### Phase 10 — dirty fighting and street texture · ~M

Restored 2026-09-21. The cheap shots stay; only the *social* price was wrong.
Nothing in this fighter should punish the player for fighting like it is a
street fight. Dirty moves are ordinary moves, balanced on frames and damage.

#### The price, and why it is not moralising

Every dirty move **builds the opponent's hype** on top of the usual gain. You
rake his eyes, he gets angrier and gets to his special sooner. That is a real,
mechanical, reversible cost with no judgement attached — and it is thematically
exactly right.

They are also all **badly punishable on whiff**, in the grab's range of −18 to
−22. A cheap shot that misses is the worst position in the game.

#### The moves

These introduce a **sixth mechanical role: debuff.** Nothing else in the
fighter applies a status, which is what makes these worth adding rather than
being reskinned jabs.

| move | input | frames | role | effect |
|---|---|---|---|---|
| **Eye rake** | back + PUNCH | 3 startup — the fastest thing in the game | debuff | ~2 damage, applies **blinded** for ~1.5s: their block roll takes a heavy penalty (§Phase 8) and the AI's reaction slows. Their hype +25. −18 on whiff |
| **Groin kick** | back + KICK | 6 startup | burst | ~9 damage and a counter-hit-sized stun, but **whiffs entirely against a crouching opponent** — you have to catch them standing. A high/low mixup running the opposite way to the sweep. Their hype +20. −20 on whiff |
| **Headbutt** | in the clinch, up + PUNCH | — | exit | ~8 to them, ~3 to **you**, and it breaks the clinch with you at advantage. Distinct from *stand up*: that exit is clean, this one costs blood |
| **Stomp** | on a downed opponent, down + KICK | 9 startup | position | low damage, but it **delays their getup and denies the tech** (§Phase 5). The wake-up pressure tool. −22 on whiff, so a missed stomp hands them a free getup punish |

#### The stomp needs a rule change

`hittable()` currently excludes `down` outright — *"You cannot hit someone who
is already on the floor."* The stomp is a deliberate exception and the only
one: a single move that may strike a downed fighter, gated on its own long
recovery. Everything else still cannot.

This wants a typed frame property rather than a special case, which is the same
mechanism Phase 5 needs for throw invulnerability on wake-up. Build once.

#### Blinded — the first status effect

- Duration ~90 frames, ticking down, visible as a tell on the fighter.
- **Block roll penalty** — the single biggest reason it is worth doing.
- **AI reaction slows** — its `react` window widens for the duration.
- Does not stack; a second rake refreshes rather than doubles.

It needs its own `AnimState` and its own HUD read, because an invisible status
is indistinguishable from the game misbehaving — the same rule as the block
roll.

#### The rest of the texture

Lower priority than the moves above, and not load-bearing:

- **The weapon on the floor.** Phase 2 drops a melee weapon when you grapple.
  Leaving it lying there makes it a scramble either fighter can win.
- **The crowd does something.** Ten drawn figures currently doing nothing.
- **Getting jumped.** Two on one exists in this world and the fighter cannot
  express it. Large; named so it is not discovered late.
