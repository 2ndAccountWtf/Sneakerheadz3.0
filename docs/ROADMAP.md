# Sneakerhead Dope Wars — upgrade roadmap

Written 2026-09-21, after the fighter research arc. This is the whole-game
plan: what to build next, in what order, and why. The two deep PRDs
(`PRD-HOOPS-POLISH.md`, `PRD-FIGHTER-DEPTH.md`) stay where the per-game detail
lives; this document decides what gets built and when.

---

## 0. Where the game actually is

Measured, not remembered.

| | |
|---|---|
| mini-games | 16, about 18,400 lines |
| deep simulations | 5 — Hoops (4,116), Cart Race (2,794), Pizza Run (2,425), Fighter (2,279), Flight 404 (1,953) |
| light interstitials | Roulette, Mystery Box, Legit Check, Sneaker Chase, Street Ball — 100–200 lines each, and correctly so |
| tests | 46 suites, all green |
| build | clean |
| art delivered | 582 PNGs |
| **hoops art delivered** | **0 PNGs against a 209-frame spec** |

**The three gaps, ranked by how much they cost the player.**

1. **The game does not look as good as it plays.** The owner's own words are
   "Nintendo quality from 1989". `assets/art/hoops/` contains a README and no
   PNGs; every player in every state is a walk pose pushed through an `armUp`
   scalar, a `crouch` boolean and a rotation. The flagship mini-game is the one
   with no art.
2. **Nothing the game does is discoverable.** The fighter shipped a
   strike/block/grab triangle, a grab break and a juggle in one pass, and a
   player has no way to find any of it — the entire explanation is one
   paragraph of help text. Hoops has the same problem.
3. **The RPG layer barely reaches the mini-games.** Every street fight has the
   identical opponent brain; only the name and health differ. Four of twelve
   hoops roster modifiers never reach the simulation. Task #25 has been open
   throughout.

Deep mechanical work on any one mini-game is *not* on that list, which is the
main thing this roadmap is for.

---

## 1. Two tracks

Some of this needs a person with a phone, or an illustrator. That work is real
but it is not mine, so it runs in parallel rather than blocking.

**Track A — engineering, sequenced below.**

**Track B — owner, starting now and in parallel:**

- **Play it on a real phone, in landscape.** Never verified on a device. It
  gates at least three design decisions already written down, including whether
  a cross-up can be read at 320×180 with 15px fighters
  (`PRD-FIGHTER-DEPTH.md` §8.1).
- **Commission hoops art tier 1** — 43 locomotion frames, fully specified in
  `ASSETS-HOOPS-ANIMATION.md`. Tier 1 alone changes how the game reads. The
  engine work in Phase 2 lands whether or not the art arrives, and a
  half-delivered set degrades to today's look rather than to a hole.

---

## 2. Phase 1 — make what already exists findable

**Why first:** the best ratio of felt improvement to lines changed in the whole
document, it touches every mini-game, and it needs no art and no research.
Everything shipped in the last month is currently invisible.

- A **controls card** per mini-game — the moves, their inputs, one line each —
  replacing the paragraph of help text. One shared component, used by all
  sixteen.
- **Three or four 15-second drills** for the fighter: block a kick and punish
  it, grab a guard, break a grab, land the combo. Shape borrowed from the
  tutorial curriculum in `PRD-FIGHTER-DEPTH.md` §2.8.
- **Hit callouts** — "PUNISH", "BREAK", "COUNTER", "KNOCKDOWN". A fighting game
  that names what just happened teaches its own rules for free.

*Done when:* someone who has never played can find the grab, the break and the
combo without being told.

*Note:* this phase is the one the headless harness cannot grade — a bot always
knows every mechanic. It is verified by Track B.

---

## 3. Phase 2 — the engine half of the animation pipeline

**Why second:** it is the largest visible gap, and the engine side is ours and
is wanted for game feel *whether or not a single frame is ever drawn*.

- **A state → clip map.** `SpriteDef.frames` is a flat list with no named
  clips and `actor()` takes a frame index, so nothing maps "he is dribbling"
  to a range of frames. This is the thing blocking every future animation
  delivery across every mini-game, not just hoops.
- **`hoops-land` and `hoops-pivot` triggers** — landing recovery and
  direction-reversal detection in the simulation. Both are wanted for feel
  independently of art.
- Keep the `armUp` / `crouch` / `rotation` fallbacks so a partial delivery
  degrades gracefully.

*Done when:* tier-1 frames can be dropped in and wired without touching the
simulation, and landing and pivoting read differently from running even with
today's art.

---

## 4. Phase 3 — fighter feel, capped

**Why third and why capped:** the fighter is one of sixteen mini-games and has
already had a full overhaul plus six repositories of research. This takes the
two stages that matter and explicitly stops.

- **Frame-stamped input** (`PRD-FIGHTER-DEPTH.md` §12.1). Our buffer is four
  countdown timers that cannot answer "was guard pressed within three frames of
  this hit", so it blocks both items below. Do it first.
- **Counter hit** — contact during the defender's startup frames. The most
  satisfying thing in a fighting game, absent from ours, and it pays for
  reading the opponent.
- **Shake-then-knockback split** — freeze on impact, *then* slide. Part of why
  our hits read as a number going down.

**Explicitly not now:** the cross-up and air game (Stage 1, gated on Track B),
the grapple ladder (Stage 5.5), per-opponent AI (moved to Phase 4 below),
juggle proration, corner push, superpause. All specified, all waiting.

*Done when:* `proper` play gains from counters and `mashHeavy` loses to them,
with no match-length regression.

---

## 5. Phase 4 — make the RPG reach the mini-games

**Why last of the four, and why it is the most valuable long-term:** this is
what makes the world matter inside the games. Right now the bouncer and the
washed-up rapper fight identically, and half the roster stats are decorative.

- **Task #25** — roster attributes and the cousin into the hoops loop, plus the
  four modifiers that never reach the simulation (`dunkBias`, `stealMult`,
  `turboCapMult`, `turboRegenMult`).
- **Per-opponent fighter records.** Pull the four hardcoded AI constants
  (`AI_PUNISH_CHANCE`, `AI_COMBO_CHANCE`, `AI_JUGGLE_CHANCE`,
  `AI_BREAK_CHANCE`) into a per-NPC record, following `systems/hoops/roster.ts`.
- **A points budget and a validator** for both rosters
  (`PRD-FIGHTER-DEPTH.md` §12.6). Nothing currently stops an entry being strong
  at everything, which is why opponents feel the same.

*Done when:* two named opponents produce measurably different match shapes —
hits taken, block rate, match length — against the same player policy.

---

## 6. Standing method

Unchanged from the work that produced it, and it is the reason the numbers in
these documents can be trusted.

1. Measure, do not reason. Every claim is a number from a headless harness.
2. Every mechanic ships its AI half in the same change.
3. Prove the test has teeth — break the thing deliberately and watch the check
   fail with the right message.
4. Revert rather than ship something measurably worse.
5. Check the licence before borrowing. This repository is proprietary, so
   GPL and unlicensed code are both closed to us.

---

## 7. What this roadmap deliberately does not do

- **Rewrite any mini-game.** Five deep simulations work; the thin interstitials
  are thin on purpose.
- **Add a seventeenth mini-game.**
- **Read a seventh fighting-game engine.** Six were read. The bottleneck has
  not been knowing what to build for some time.
- **Chase mechanical depth in the fighter beyond Phase 3.** The PRD holds
  seven specified stages. They keep.
