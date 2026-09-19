# Hoops — polish PRD

Everything still outstanding on the basketball mini-game, ranked, with the
measurement behind each one and what "done" means.

**Scope rule for this whole document:** no new mechanics. Every item below is
either something the game already claims to do and does not, something that
measurably feels wrong, or a guard that is supposed to stop us breaking it
again. Anything that would be a new feature is in §7 and explicitly out.

---

## 0. Where the game is now

Three audits drove the real simulation (`createWorld` / `stepWorld`) over
hundreds of games. What has already shipped, with the measured effect:

| shipped | measured |
|---|---|
| 8-way movement | diagonal was 4% of sideways speed; court crossing 91.6s → 5.3s |
| walls release you | 150–217ms of dead input → 17ms |
| shove needs real turbo | shove-only bot 94% → gated; defensive cooldown now priced by what happened |
| swap keeps the ball | 45% of swaps threw it away; 100% of them on your first press |
| dunks respect possession | 33 of 916 baskets scored after the ball was gone |
| fire needs 3 *consecutive* | a 3-for-15 player used to ignite |
| tie → sudden death | a draw was recorded as a loss, ~1 game in 12 |
| passing lane is a lane | `BULLET_ARC` 16 vs a pick ceiling of 26 — a bullet never rose above its own gate |
| contact has weight | never-passes bot 92% → 40%; **passing now beats hoarding** |
| roster wired in | `derive()` had zero call sites; every opponent played identically. **4 of 12 modifiers reach the sim; 8 still do not — see §3.5** |

Current balance, 50 games per profile:

```
never passes   win 40%   9.4 - 8.5
passes ~1/s    win 50%  16.3 -15.5
passes ~2/s    win 32%  14.1 -16.3
clumsy         win 46%  14.6 -15.6
```

1010 checks pass. The game is competitive, passing is the best strategy, and
nothing hangs. What follows is what is still wrong.

---

## 1. ~~P0~~ DONE — the test suite now guards what it claims

All nine mutations now fail the suite. Twelve stats that had no floor have one,
set from a measured season and halved so variance cannot trip them but a
mechanic going to zero always does. Three behavioural checks cover the
breakages a counter cannot see, and the constant-true turbo check measures the
world instead of restating a constant.

| mutation | now caught by |
|---|---|
| `b.pts = 2` always | `threes` floor |
| three-point threshold doubled | `threes` floor |
| `b.pts` measured off the team's own basket | "a three is only ever a three from beyond the arc" |
| `aiThink`'s `ownHoop` inverted | "defenders mark the rim they are defending" |
| ON FIRE never goes out when the other team scores | "the other team scoring puts your fire out" |
| goaltending removed | balance + `goaltends` floor |
| tip-ins removed | `tipIns` floor |
| `b.rebound` never set | `tipIns` floor |
| shot clock never expires | still open — see below |

Two stats deliberately have **no** floor, recorded in the test so their absence
is a decision:

- **`bricks`, 0.02/game.** The mechanic works — a constructed worst-case shot
  bricks 97% of the time — but the AI only shoots when its chance beats a
  threshold above `BRICK_CHANCE` by construction, so the game never produces
  the situation.
- **`bulletPicks`, 0.00/game.** This is the cost of having a passing game at
  all, and it was measured three ways before being accepted:

  | rule | bullets picked | passing bot win |
  |---|---|---|
  | height ceiling 18 | 0% | 48% |
  | height ceiling 20 | 16% | 25% |
  | position only, no height gate | 53–71% | 0–3% |
  | in the lane at release (the lob's own rule) | 42–50% | 0–8% |

  A bullet is flat by design and peaks around y=19, so a height gate on it is
  binary — there is no value between 18 and 20. Position alone is worse in the
  other direction, because a defender is within 16px of the handler on 83% of
  frames. Even requiring the defender to have been in the passing lane at
  release still picked 42–50%: on a court this small, somebody is near the ball
  most of the time. **Lobs still get picked 1.13 times a game and carry the
  risk.** Bullets being safe is what makes 2-on-2 playable.

**Still open from this section:** the shot clock cannot be made to expire in
normal play (possessions average 1.38s against a 15s clock), so a violation
floor would fail honestly. Either shorten the clock until it bites or delete
the violation branch and its authored line as dead content. A decision, not a
bug.

**The turbo check.** It now measures the human's real drain and regen by
stepping the world — hold turbo and read the bar, let go and read it again —
and asserts the drain is a drain, the regen is a regen, and the drain is the
larger. Two attempts at also measuring the CPU's sprint endurance were
discarded: counting frames where a CPU player gained turbo above 1.05x base
flagged 18.4% of legitimate coasting, and tightening to 1.4x is now confounded
by the contact system, which can push a body above that speed while it is
legitimately regenerating. Whether the CPU can outlast you is guarded
statistically by "there is always a way out of a defender", which is the check
that caught that regression when it was live.

## 2. ~~P0~~ DONE — landscape and fullscreen

Most of this turned out to already exist, built for the street games:
`useFullscreen`, `TouchZones` (thumb controls that float over the picture in
the bottom corners rather than sitting in a row below it), and a fullscreen
toggle in `ArcadeShell` that hoops already inherits. Three real gaps closed.

**A rotate prompt.** `screen.orientation.lock` is honoured by Chrome on Android
and does not exist on iOS, so a phone cannot be made to turn — it has to be
asked. `useOrientation` reports the aspect by comparing window dimensions
rather than reading `screen.orientation`, which is absent on older iOS and
reports the *device* rather than the window (wrong in a split view, wrong in a
desktop browser being resized). The rule is a pure function, `shouldPromptRotate`,
so it is testable without a browser: interrupt only when the player has already
asked for fullscreen *and* is holding the phone upright. Portrait while the
game is inline in the page is the player looking at the rest of the app, which
is not a mistake. The game keeps running under the prompt — pausing a
90-second game on a rotation is worse than a few lost seconds.

**`widen` was an undeclared prop.** `ArcadeShell` destructured it with a
default and passed it to `GameCanvas`, but it was not in `ArcadeShellProps`.
Now declared, with the reason hoops must never set it.

**Why hoops does not widen.** The street games read their view width from the
canvas every frame and genuinely gain road by filling a landscape box. Hoops
pins everything to absolute coordinates — `COURT_L`/`COURT_R` and the two rims
at x=30 and x=322 — so a wider view adds empty floor past the baselines rather
than more court. Widening hoops means moving the rims, which is §7.

**What fullscreen is actually worth**, letterboxed at 352x198:

| | viewport | canvas | scale | player height (cam 1x / 2x) |
|---|---|---|---|---|
| inline in the page | 352 wide | 352x198 | 1.00x | 32px |
| iPhone 14 portrait | 390x844 | 390x219 | 1.11x | 35px / 71px |
| **iPhone 14 landscape** | 844x390 | 693x390 | **1.97x** | **63px / 126px** |
| Pixel 7 landscape | 915x412 | 732x412 | 2.08x | 67px / 133px |
| iPad landscape | 1180x820 | 1180x664 | 3.35x | 107px / 215px |

Turning the phone is worth **1.97x** on its own, before the camera does
anything — and it is why the animation spec authors at 48x64 rather than the
current 16x24, since the largest a body is ever rasterised is ~64 logical px.

**Not verified on a real device.** The arithmetic above is computed from the
letterbox rule, and `shouldPromptRotate` is unit-tested, but nobody has held a
phone. iOS Safari fullscreen in particular is the part most likely to disagree.

## 3. ~~P1~~ MOSTLY DONE — feedback the player is owed

**3.1 Scramble recoveries now say so.** The "comes up with it" line was gated
on `b.looseT > 0.4` and fired ~0.7 times a game, while 65% of all possession
changes (1652 of 2548 over 60 games) happened with no banner, no ticker line
and no score change. The gate is 0.12s now — low enough to catch a real
scramble, high enough that a clean catch off a pass is not narrated.

**3.2 "HEATING UP" now always lands. Measured 24% → 100%.** The
`scorer.streak === 2` branch sat *after* the alley / tip / dunk branches in the
same `else if` chain, and dunks are ~60% of scoring, so the second bucket of a
run usually took BOOMSHAKALAKA instead. The banner still belongs to the dunk —
it is the bigger moment — but the ticker line underneath is the streak's.
Pinned by a check that fails at 72% when the dunk call takes it back.

**3.3 Goaltending: 71% → 43% of all blocking**, 3.83 → 1.10 per game.

The cause was mechanical, not a mistuned rate. The block at release and the
goaltend in flight ask the same question — an airborne defender inside
`BLOCK_R` — and got wildly different numbers of chances to answer it: the block
rolls **once**, on the frame the shot leaves the hand; the goaltend rolled
**every frame** the ball was in the window, and a shot that enters it stays
~18.8 frames. At 0.5 a frame that is a 100.00% chance against a single 55% —
roughly 19× the rolls for the same rule. It is now **one roll per shot, only on
a descending ball, scaled by `blockMult`**, at a base chance of 0.3.

Balance after, 50 games per profile:

```
never passes   win 28%   8.7-11.1     goaltends 0.38/g
passes ~1/s    win 44%  16.8-17.0     goaltends 1.10/g   (43% of blocking)
clumsy         win 44%  16.8-17.0
```

Passing still beats hoarding, which is the property that matters.

**3.5 Two more modifiers wired.** `blockMult` — the one §3.4 called for, and
exactly what NBA Jam scales its own 1–25% block chance by — and `accelMult`.
Six of twelve now reach the simulation, up from four. Still unread:
`dunkBias`, `shotWindowMult`, `deepMult`, `stealMult`, `turboCapMult`,
`turboRegenMult`.

**Still open in this section:**

- **The CPU has no shot tell.** `aiThink` calls `launchShot` directly, so
  `p.charge` is never set for a CPU shooter (0.086% of AI frames). A CPU jumper
  therefore gives nothing away before the ball leaves, and cannot be blocked on
  purpose — only swatted in flight. This is the other half of why blocking felt
  arbitrary and it is untouched.

  **Do not fix this by giving the CPU a release meter.** Checked against the
  leaked NBA Jam source (design rules only; no code, data or art from it is used
  here): Jam has no release-timing mechanic at all. The shoot button is a plain
  press, the make/miss is a single 0-999 roll at launch against an accumulated
  spatial percentage, and the only thing hold duration decides is whether the
  quick-shot animation plays instead of the normal one. The tell a defender
  reads there is **the jump** — you are airborne, you are committed, and the
  window is the flight of the ball. See `docs/NBA-JAM-MECHANICS.md`.

  So there are two separable questions, and they are the user's call, not a
  polish task:

  1. **Does our release meter stay?** `SHOT_CHARGE_TIME` / `SHOT_SWEET` /
     `SHOT_WINDOW` / `SHOT_COOK` are ours — authored into this game, not
     inherited. Removing them is a design change, not a fix, and it would make
     the jumper a pure spatial roll the way Jam's is.
  2. **Either way, the CPU needs a gather.** Even with the meter gone, a shooter
     who launches on the same frame they decide to is unreadable. The fix is a
     visible wind-up on the CPU — a gather pose and a few frames before release
     — not a meter drawn over its head.
- **No persistent "this team has the ball" marker.** The `▼` marks who you are
  driving, not who is holding it.
- **Three mutations still pass.** Removing the descending-ball condition,
  reading `blockMult` in one of its two sites, and one of the streak-call sites
  all survive. The first two are refinements whose absence changes nothing a
  player would notice; recorded rather than papered over.

## 4. P1 — input buffering — DONE

A first attempt was built and **reverted** in this session. Recording why, so
nobody repeats it.

The measured problem is real. Presses were consumed by the frame whether or not
anything could act on them: `stepWorld` returns early during hitstop, and the
dunk and stumble branches `continue` before `humanControl` runs. Drops
measured at **51 consecutive frames during a stumble, 17–48 during a dunk, up
to 8 on a hit.** And there was no buffer, so pressing SHOOT two frames before
landing did nothing — the press was gone by the frame the jump could start.

The reverted attempt banked every press at the top of `stepWorld` and cleared
it as soon as `humanControl` *ran*. That is wrong in both directions:

- It **queued actions through hitstop** — you press during the frozen frames
  and the action fires on recovery, executing a decision made 100ms ago in a
  situation that no longer exists. Those presses were being dropped correctly.
- It **never fixed the landing case**, which is the one that matters.
  `humanControl` does run while you are airborne; the jump branch declines the
  press because `p.y !== 0`; "it ran, so the press is spent" then threw it away.

### What shipped

`PRESS_BUFFER = 6/60`, a `w.buf` of two countdowns, and one rule: **a press
survives being declined and clears only when it is acted upon.** Each branch of
`humanControl` that does something calls `tookA()`/`tookB()`; every branch that
declines simply does not, and the press is still there next frame. No return
value, no refactor of the 200-line function — the consumption is local to the
branch that earns it, which is where the knowledge lives anyway.

Three things a press must *not* survive, each of them as much the spec as the
frames it must:

- **A hit.** Cleared explicitly in the hitstop branch. The buffer is not aged
  during the frozen frames, so without that clear a press banked one frame
  before the hit comes out on recovery with its whole window unspent.
- **The body of a stumble or a dunk.** No special case needed: those last 0.28s
  to 0.85s and the window is 0.1s, so a press thrown at the *start* expires
  while a press in the last few frames comes out as the body recovers. That
  falls out of the window being short, which is why it is short.
- **A change of who has the ball.** This one was not in the original plan and is
  the reason the first measurement looked bad. Both buttons mean completely
  different things per role — PASS is a steal on defence, a swap off-ball, a
  pass with the ball — so `w.buf` stamps the role each press was made in
  (`aRole`/`bRole`) and drops it if the role changed. Without the stamp, a reach
  at a loose ball came out as handing over the man you were driving.

### Measured

An intent-blind thumb model: the bot decides to press, the button goes down for
four frames, and the edge happens once whether or not the game can use it. 400
games at each of three thumb speeds, before and after.

```
press rate   presses answered        win rate
             before   after      before   after
3 Hz          48%      51%         6%      6%
5 Hz          39%      42%        10%     10%
8 Hz          32%      35%        15%     15%
```

Responsiveness up three points at every speed, win rate identical at every
speed. That is the result the section asked for.

The role stamp is what made it that. Without it, 8 Hz fell from 15% to **7%**:
a buffered PASS press that outlived a possession change became an unwanted
pass, passes went 24.1 to 29.1 a game, and the existing `passing is not a
losing strategy` check failed outright at 22%. Buffering SHOOT alone measured
14% — close to baseline — which is how the pass button was identified as the
culprit rather than the buffer.

One number moved in the committed suite and it moved for a good reason.
Goaltending fell from 1.08 to 0.90 a game while **alley-oops rose from 0.77 to
1.15**: a player whose lob call actually comes out finishes at the rim instead
of leaving a descending ball for someone to swat. The `goaltends` floor was
stale anyway — it was set at 1 against a measured 3.83, and §3 had already
walked the real number down to 1.10 without moving the floor with it, leaving a
guard sitting 10% under the thing it guarded. Now 0.4, with the history in the
comment.

### Teeth

Seven new checks (hoops 35 → 42; suite 1020 → 1027). Six mutations run:

```
no buffer at all (read the raw edge)      3 checks fail
buffer never expires                      2 fail (+1 existing)
hitstop no longer clears it               1 fail
no role stamp                             1 fail (+2 existing)
v1 semantics (cleared because it ran)     4 fail
bank before the hitstop early return      0 fail  — not observable
```

The last one is honest bookkeeping: with the explicit clear in place, moving
the banking above the early return changes no behaviour, so the check that
claimed to guard it was vacuous and was deleted rather than kept as decoration.

---

## 5. P2 — the animation delivery

Fully specified in `docs/ASSETS-HOOPS-ANIMATION.md`. Summarised here because it
is the largest single change to how the game looks and it is the owner's actual
complaint ("Nintendo quality from 1989").

Every player, in every state, is a **16×24 sprite with 4 frames of animation,
all walk cycle**. `assets/art/hoops/` holds a README and no PNGs. Jumping,
dunking, shooting and being knocked flat are that walk pose put through an
`armUp` scalar, a `crouch` boolean, a `rotation` and a height multiplier.

**209 frames across 5 tiers**, every count derived as `duration × 15fps` from
the durations already in `HoopsGame.tsx`. Delivery in tier order; tier 1
(locomotion, 43 frames) moves the game before a single dunk is drawn.

Engine work, which is ours and not the illustrator's:

- A **state → clip map**. `SpriteDef.frames` is a flat list with no named
  clips and `actor()` takes a frame index, so nothing currently maps "he is
  dribbling" to a range of frames.
- `hoops-land` and `hoops-pivot` need trigger conditions in the sim — landing
  recovery and direction-reversal detection. **Both are wanted for game feel
  whether or not the art ever lands.**
- The `armUp` / `crouch` / `rotation` hacks come out only as their real
  sequences arrive. `figure()` stays untouched so a half-delivered set degrades
  to today's look rather than to a hole.

**Done when:** tier 1 is delivered, wired, and the game reads as running rather
than sliding.

**Risk:** low technically, long in calendar time. Blocked on the illustrator.

---

## 6. P3 — small and true

Worth doing, none of them urgent.

- **The brick is dead content.** `BRICK_CHANCE = 0.24`, measured at **3 bricks
  in 3,913 shots (0.08%)** across 150 games, zero in AI-vs-AI. Five authored
  lines, a custom no-bounce physics path, the 🧱 render, a dust puff and a
  stats counter that no player will ever see. The mechanic works — a
  constructed worst-case shot bricks 97% of the time — the game just never
  produces that situation. Either raise the chance or accept it as an easter
  egg, but decide knowingly.
- **A shot-clock violation during a dunk fires a heave *and* the dunk still
  scores.** One possession produces two `stats.shots`, a second ball in flight
  that is silently clobbered, and 2 points despite the violation. Guard the
  heave with `p.dunkT === 0`, or reset the clock in `startDunk`.
- **`AI_SKILL = 1` is a no-op knob** whose comment says "opponents are worse
  than a perfect release". Measured: moving it 1 → 0.88 barely shifts the win
  rate, because ~60% of scoring is dunks, which bypass shot chance. Either
  make it mean something or delete it and the comment.
- **A zero-length draw call.** `HoopsGame.tsx:2880` draws a line from `x` to
  `x - h.inward * 0` — the same point. One net strand renders nothing.
- **The AI ball handler yo-yos across the depth lanes**, 96 mid-line crossings
  a game, because the handler targets the far lane from the nearest defender
  while that defender targets the handler's lane. Nothing breaks; it reads as
  jitter. Hysteresis settles it.
- **The anti-stall fallback can hand the ball to a downed player.** The
  loose-ball candidate loop filters `stumbleT > 0`; the 3.5s fallback does not.
  Believed unreachable in play (a stumble always expires first) but it is a
  two-word guard.
- **62% of rebounds are offensive.** Missing is barely punished, and there are
  1.27 tip-ins a game on top. A tuning call, not a defect.

---

## 7. Explicitly out of scope

Listed so they are decisions rather than omissions.

- **Sound.** `sfx()` is a documented no-op with **17 named cues already
  wired**. For a game in this register it is the largest single sensory gap —
  and it is a content project, not polish.
- **Widening the court.** Would make the follow-cam earn its keep and the
  sprites bigger, but it invalidates every number measured this session. Do it
  deliberately, after §2, or not at all.
- **Porting to Phaser.** Investigated and rejected. Hoops is a three-axis game
  (`screenY` is a projection of both depth and height); Phaser's Arcade physics
  is strictly 2D, so its gravity would pull a jumping player toward the near
  sideline and its AABB would collide players who are 70px apart in depth. Only
  ~36 lines of 3,219 are integration anyway, and adopting it would cost the
  headless sim that every measurement in this document depends on.
- **More NBA Jam parity.** 54 dunk sequences, a deeper roster, secret
  characters. Features, not polish.

---

## 8. Order of work

```
1. §1  test teeth            ← DONE
2. §2  landscape/fullscreen  ← DONE (unverified on a real device)
3. §3  feedback              ← DONE except the CPU shot tell (needs a design call)
4. §4  input buffering       ← DONE
5. §5  animation             ← as the art lands, tier by tier
6. §6  small and true
```

§5 runs in parallel with everything from the moment the illustrator starts.

## 9. How we know it worked

Re-run the §0 balance table after each item. The game stays competitive
(no profile outside roughly 30–70%), passing stays at or above hoarding, every
game still finishes, and no frame carries a non-finite number. Those are the
four properties this session established and the ones any of this work could
plausibly break.
