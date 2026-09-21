# The street fight: why it felt shallow, and what was actually wrong

Written 2026-09-21, after the complaint that it "feels worse than Mike Tyson's Punch-Out".

That complaint is fair and it is also precise. Punch-Out has one loop and the loop is
airtight: read the tell, dodge, punish. This game had more *parts* than Punch-Out —
startup/active/recovery frames, highs and lows and overheads, hitstun, blockstun, a cancel
window, chip, meter, a launcher, hit-stop — and the loop between them was broken. A pile of
mechanics is not depth. Depth is the mechanics beating each other.

Everything below was measured with a headless harness (`createFight` / `stepFight` are pure,
so thousands of matches run in Node), not reasoned about.

---

## What was wrong

### 1. Defence paid nothing

On-block frame advantage, before:

| move | startup/active/recovery | on hit | on block |
|---|---|---|---|
| jab | 4/3/6 | +6 | **0** |
| kick | 9/4/15 | +4 | **-5** |
| sweep | 8/4/18 | +6 | **-6** |
| air stomp | 4/9/6 | +10 | +2 |
| uppercut | 5/7/22 | +8 | **-7** |

Blockstun was `hitstun * 0.5` for every move, derived rather than authored. The worst thing
that could happen to you for throwing the slowest move in the game and having it guarded was
minus seven frames — not enough to be punished by anything. So blocking was a way to take
less damage and never a way to take the turn. In Tekken and in Def Jam, guessing right on
defence *hands you the turn*. Here it handed you nothing, so there was no reason to do it,
so the fight was a mashing contest with hit sparks on it.

Worse: every move chipped. A player who blocked well blocked about twenty-one swings a round
and paid roughly thirty health for the privilege — more than the hits he had avoided were
worth. **Correct defence was a slower way to lose.**

### 2. One button was the whole game

The jab was +6 on hit against its own 4 frames of startup, and it could cancel into itself.
Mashing it was a true infinite: **77 unanswered hits in ten seconds** against a standing
opponent, bled off only by combo proration.

### 3. There was no third option

Strike and block. Nothing that beat a guard. A guarding opponent was one coin flip —
high or low — repeated until somebody ran out of health. Def Jam is *built* on the grapple;
Tekken has throws with breaks. This had neither.

### 4. Two dead mechanics

- The uppercut launched a body 23px into the air on a move with 22 frames of recovery. The
  victim was back on the floor before the uppercut had put its arm down. **Measured
  follow-up hits: zero.** The launch was a visual effect with no move behind it.
- **A quarter of the running time was banners.** 4.7s of round cards and 5.4s of "K.O."
  inside a 41-second match.

---

## What changed

### The triangle

Three things beat each other, and that is the game:

- **block beats strikes** — and now pays, because a blocked kick is -12 and a blocked sweep
  is -14 against a 4-frame jab. Guessing right gives you a free hit. Ordinary moves no
  longer chip at all; only the special and a thrown weapon do.
- **grab beats block** — a new move on its own button. 5 frames of startup, 17px of reach,
  unblockable, and **22 frames of recovery on a whiff**, which is the most punishable thing
  in the game. Landing it holds the victim for 13 frames; they escape by pressing GRAB
  themselves. Thrown into a wall it does 24 damage instead of 15.
- **strike beats grab** — because a grab has startup and no armour, and because contact
  resolves in two passes: strikes first, from hitboxes captured before anything is applied
  (so two live hitboxes on the same frame is a trade, not a race), then grabs, and only for
  a fighter who was not hit out of it.

### The combo

A jab can no longer cancel into a jab — a cancel window is a window into something *else*,
which is the oldest fix in the genre and also the better game. PUNCH then KICK is the combo,
and it is a thing a player finds with their thumbs. Jab hitstun came down from 12 to 9, so
jab-into-jab is now a frame trap that loses to a block instead of an infinite.

### The launcher launches into something

The uppercut goes to -232 with recovery cut from 22 to 16. The victim is airborne for about
45 frames against 28 frames of move, so the meter now buys a juggle. Capped at two air hits
(`JUGGLE_MAX`), enforced on *all* contact and not just on the juggle rule — capping the rule
alone let a third hit through as the body fell back into ordinary hitbox range.

### The opponent plays the same game

He punishes what he blocks, cashes his own cancel window, juggles what he launches, grabs a
player who will not stop guarding, and breaks about half the grabs put on him. All of it is
off-schedule and all of it costs him his reaction, the same resource everything else he does
off-schedule costs. Before this he could not do any of it: a bot playing correctly took
**eight hits a match and won every single one.**

### The match is a match

Round card 2.4s → 1.25s and skippable with any button; K.O. 2.7s → 1.6s. Live play went from
59% of running time to about 69%.

---

## Where it landed

Win rates over 120 seeded matches per policy:

| how you play | wins |
|---|---|
| block, punish with the combo, grab a guard, spend the meter | **78%** |
| walk in, vary your buttons, block sometimes (a casual thumb) | **45%** |
| mash the kick, never block | 3% |
| mash the jab, never block | 0% |
| hold a guard forever | 0% (and grabbed 15 times a match) |

Before this pass, mashing the kick won 85% and playing properly won 100% — which is to say
the two were indistinguishable, because the opponent could punish neither.

Turtling losing 100% of the time *and* eating fifteen grabs a match is the grab doing its
job. Mashing at 3% is low, and it is deliberate: that policy never blocks once. The number
that represents an actual casual human is the 45%.

---

## Still open

- **Only five attacks on two buttons plus a grab.** Tekken's texture comes from strings per
  limb; a phone D-pad cannot express that and probably should not try. The mixups we have
  (high / low / overhead / throw) are the ones a two-button pad can carry.
- **No counter or parry.** Def Jam's signature is the blocked-move reversal. A just-block —
  guarding within a few frames of impact for a bigger punish window — would fit the existing
  block code almost exactly. Not built.
- **Nothing in the stage reacts.** The wall matters on a throw and nowhere else. There is a
  drawn crowd doing nothing.
- **`reader` — a bot that blocks everything correctly but only ever jabs — still wins 0%.**
  That is a bot with no offence rather than a flaw in the defence, but it has not been
  proven either way.

## A note on sources

Nothing here is taken from any commercial fighting game's code or data. Tekken and Def Jam
are named as design references — what a fighting game's loop is supposed to feel like — and
nothing else. No code, no data and no art from any such source is used here, and none may be.
