# Fighter engineering — practices and standing rules

How the fighter gets built and measured: the practices worth borrowing from other codebases, and the rules that keep the numbers in these documents trustworthy.

Split out of `PRD-FIGHTER-DEPTH.md` on 2026-09-21, which had grown to 2,013
lines doing four jobs at once. That document is now the plan and the index;
this one is fighter engineering.

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
