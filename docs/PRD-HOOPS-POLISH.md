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
`dunkBias`, `stealMult`, `turboCapMult`, `turboRegenMult`. (`shotWindowMult`
became `touchMult` and `deepMult` was wired when the release meter came out —
see §4.5. Eight of twelve.)

**Still open in this section:**

- ~~**The CPU has no shot tell.**~~ **Fixed — see §4.5.** The release meter is
  gone and both sides now shoot through the same wind-up.
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

## 4.5 — the release meter, removed

Asked for directly, after the question "who said there should be a release
meter?" turned out to have the answer "we did, and nobody checked".

**What it was.** `SHOT_CHARGE_TIME` / `SHOT_SWEET` / `SHOT_WINDOW` /
`SHOT_COOK`: SHOOT opened a charge bar with a green sweet-spot band, and the
release quality off that bar was the single largest term in `shotChance` —
larger than the distance, larger than the hand in the shooter's face. It was
authored here. NBA Jam has nothing like it and never did (verified in the
source; see `docs/NBA-JAM-MECHANICS.md`): the button is a plain press, the make
is one roll against a percentage built from range, defenders and the shooter's
own rating, and the tell a defender reads is the jump.

**What replaced it.** The half worth keeping was the window in which a shot
could be contested on purpose. So the window stayed and the timing went:

- `startShot` plants the shooter, puts him in the air and locks his facing.
- `stepGather` releases at the apex — 19 frames, 0.32s. Nothing to time.
- `shotChance` lost its release term and gained `touchMult` (every shot) and
  `deepMult` (beyond the arc only). What the thumb used to decide, the
  shooter's hands decide.
- **Both sides call it.** This closes §3's last open item: the CPU used to call
  `launchShot` straight out of `aiThink`, so a CPU jumper had no gather, no
  pose and nothing to read. You could not block one on purpose, only swat one
  already in the air.

**Measured** (60 games, the committed season harness, per game):

```
                 before    after
combined FG        70%      61%
blocks            2.08     3.40
dunks             8.15     7.05
rebounds          3.93     5.03
score         16.7-17.3  14.3-14.4
win rate           48%      42%
```

Blocks up 63% is the change working — shots are contestable now. 61% combined
shooting is closer to where this file already said arcade hoops lives than 70%
was. Every balance property holds: competitive, passing still beats hoarding,
every game finishes.

**Two bugs found on the way, both invisible to the suite as it stood:**

1. **The shooter drifted through his own wind-up.** `applyMove` still ran while
   gathering, so a three decided from 122px out released from 111 and scored
   two. Three-point attempts fell 1.07 → 0.43 a game. Fixed by having the
   wind-up own the body the way a dunk does. Now guarded.
2. **The three-point "open" bonus never fires.** `THREE_OPEN_R` is 46px and on
   a 2-on-2 court nobody is ever that clear — sweeping the bonus from 1.3 to
   1.7, and the radius from 46 down to 30, moved the measured three count by
   0.02 a game. It is dead content. Recorded, not fixed: the honest fix is a
   court/spacing question, not a constant.

**Where the three went.** 0.75 a game with the meter, 0.23 without — but that
is the shot moving from the thumb to the roster, not dying. The same season
against the best shooter on the blacktop measures 0.49 against a bricklayer's
0.15, a 3.3x gap where it used to be 1.6x. The bare `threes` floor was dropped
to 0.1 (it was 0.2 against a measured 0.23 — the same too-tight-guard mistake
§4 had to fix for `goaltends`) and the real signal moved to a roster check.

**Teeth.** Seven new checks (hoops 42 → 47). Seven mutations run: no wind-up
fails 3, ignoring `touchMult` fails 1, ignoring `deepMult` fails 1, the shooter
steering through the gather fails 1, the CPU shooting without a tell fails 1,
the CPU defender not reading the gather fails 1. One more — not planting the
shooter's velocity at commit — fails nothing, because position is not
integrated during the gather at all; it is kept for what the shooter does on
landing and recorded as unguarded rather than claimed.


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

## 6. P3 — small and true — DONE

Seven items, none of them a headline, all of them invisible to the suite.

- **The brick was dead content — raised, knowingly.** Three bricks in 3,913
  shots across 150 games (0.08%), for five authored lines, a custom no-bounce
  physics path, a render, a dust puff and a stats counter. NBA Jam's own
  equivalent, the airball, fires on roughly 1.5–3% of shots. `BRICK_CHANCE`
  0.24 measured 0.9% of shots here after the meter came out; **0.32 measures
  2.1%**, inside that band, and leaves makes and the rebound split alone. 0.40
  gives 5.5%, which is too often for a joke. It now has a floor of 0.2 a game,
  which is what the old no-floor note literally instructed whoever brought it
  back to life to do.
- **A shot-clock violation over a live dunk fired a heave as well — fixed.**
  One possession produced two `stats.shots`, a second ball in flight that the
  dunk silently clobbered, and two points *despite* the violation. The clock
  now checks whether the possession has already committed to a shot — a dunk or
  a gather — and lets it finish. Guarded.
- **`AI_SKILL = 1` — deleted.** An identity element dressed as a difficulty
  knob, whose comment measured it against a "perfect release" that no longer
  exists. Opponent quality comes from the profile and always did. `MATE_SKILL`
  stays, and now carries the comment explaining that it is the only shooting
  asymmetry on the court.
- **The zero-length draw call — fixed.** It ran from `x` to `x - h.inward * 0`,
  the same point twice, so the net's bottom hem drew nothing. It now joins the
  two outermost strands.
- **The AI lane yo-yo — fixed and measured.** The handler wants the depth lane
  his man is not in; his man wants the lane the handler is in. Decided every
  frame, that is a feedback loop, and it measured like one: **1.51 mid-line
  crossings per CPU possession, 30% of possessions with two or more, one
  possession with thirty.** `LANE_DWELL = 0.8s` turns the loop into a decision:
  **0.61 crossings a possession, 13% with two or more.** 0.5s was not enough
  (0.76) and 1.2s bought almost nothing on top (0.56). Guarded at both ends —
  a handler who never changed lanes at all would also be wrong.
- **The anti-stall could hand the ball to a downed player — fixed.** The
  pickup scramble skips `stumbleT > 0`; the 3.5s fallback did not, and a prone
  player reads no input at all. Still believed unreachable in play, since a
  stumble is 0.85s and always expires first, so the check is constructed and
  says so.
- **62% of rebounds were offensive — now 52%, and accepted.** Two-on-two with
  the shooter and his man both at the rim makes this close to a coin flip by
  construction, and punishing misses harder would make games longer rather than
  better. Recorded with the number so the next person is deciding, not
  inheriting.

**One more found on the way.** Mutating the lane fix — not the shot code —
tripped `no player ever holds a gather without the ball`. The ball can leave a
shooter's hands *after* the top-of-loop clear and before `stepGather` runs, on
the same frame, when a player later in the array steals it. The clear catches
it a frame too late; by then the wind-up has released a shot from a man holding
nothing. `stepGather` now checks possession itself. Not separately guarded —
the between-frame half is already covered and the intra-frame half needs a
mid-loop steal to construct — but re-running the mutation with the guard in
place makes that failure disappear, which is the evidence it does something.

**Two test fixtures were trusting a seed rather than setting up their state,**
and the lane change broke both by moving the whole simulation. `turbo costs the
CPU exactly what it costs the player` read 0.000/s because frame 240 of seed 31
stopped being live play and became a basket celebration — `score`, `tip`, `over`
and hitstop all return before the player loop. Both now assert the state they
need every frame instead of assuming it.

---

## 6.5 — the dribble game — DONE

Reported as "it is still impossible to dribble and move around the computer
defender". It was true, and it had never worked.

**What it was.** A scripted full-turbo 200px drive, one man on the handler:

```
                frames   peak gap   avg gap   open   goalside
straight          240      13.5px    11.0px    0%       0%     (never reached the rim)
weave, per rhythm 8f..48f  13.5px    11.0-11.8 0%      69-84%
```

Peak separation **13.5px at every cut rhythm from 8 frames to 48** — a flat
line. Nothing the player did with the stick changed anything, because `aiThink`
re-read the handler's exact position every frame at the same top speed with
perfect information. That is a mirror, not a defender: there is nothing for a
change of direction to punish because he is never wrong. In real games the
player was inside a defender's reach on 76% of the frames he held the ball.

**The escape test was arithmetic.** `there is always a way out of a defender —
sprinting is it` ended on
`BASE_SPEED * TURBO_MULT * sprinting > BASE_SPEED`: a sprinter beating a
*walking* defender. Ours never walks. Replaced, first, with the measurement
above, so the change had a guard before it landed.

### The mechanism

Read `DRONE.ASM` for the design rules only — written up in
`docs/NBA-JAM-MECHANICS.md`. **No code, no data and no art from that repository
is used here, and none may be.** What shipped is ours, and it is three things:

1. **A reaction time (`MARK_REACT`, 0.30s at a level score).** The on-ball
   defender commits to one spot and drives to it; while the timer runs he is
   driving to a spot that may already be wrong.
2. **A velocity lead (`MARK_LEAD`, 0.34s).** The spot is not where you are, it
   is where he thinks you are *going*. That is what makes him capable of being
   wrong in the first place.
3. **A backpedal penalty (`BACKPEDAL`, 0.84).** The piece without which neither
   of the others mattered, and it took a measurement to see: the lane block
   costs the man with the ball 7% of his speed, and costs the man guarding him
   nothing, so **the defender's top speed was 8% higher than his man's,
   permanently.** No reaction lag survives that — he simply reels you back in,
   and the measured average gap sat at 15px whatever the handler did. A defender
   staying goalside is retreating while squared up, so he pays for it. It is a
   rule about bodies, not a handicap on the CPU; it never bites the human
   because a human's facing follows his own movement.

Two smaller pieces: his turbo is now for **recovering goalside position or
getting back in transition**, not for staying attached (the old "sprint whenever
the gap exceeds 20px" erased every cut the instant it happened), and the on-ball
defender now **squares up to his man** rather than facing his own direction of
travel, which is both why the backpedal applies and how it reads on screen.

### Measured

```
                    frames   peak gap   avg gap   open   goalside
mashing      (8f)     180      20.6px    11.6px    0%       6%
committed   (48f)     111      31.2px    20.7px   18%      84%
straight              186      13.6px    11.0px    0%       0%
```

**Rhythm matters now**, which is the whole point and the thing that fails
hardest against a mirror. Committing to a direction long enough for him to buy
it and then leaving is worth 20.7px of daylight and 84% of the drive spent
goalside; rattling the stick is worth 11.6px and 6%, and takes 62% longer to
reach the rim. A straight line still gets you nowhere — he holds that line 100%
of the time, as he should.

In real games the player is now clear of a contest on **20% of ball-holding
frames (was 16%)** and inside a reach on **68% (was 76%)**.

### What it cost, and what paid for it

Loosening the defence moved the balance hard, exactly as this section warned:

```
                  before   after the defender   + dunk range 18+20, slope 0.05
quiet  (pass 1/s)   54%           70%                        58%
busy   (pass 2/s)   38%           52%                        58%
clumsy (35% idle)   30%           52%                        44%
```

Two knobs paid for it, both of which the code was already waiting on:

- **Dunk range 24+26 → 18+20.** The comment on `DUNK_RANGE_BASE` has said since
  the overhaul that it "wants to go lower still — at 16+18 dunks drop to 52% of
  scoring, which is about right — but the harness bot's entire game is
  drive-and-finish, so it falls to a 15% win rate". That was true *because the
  bot could not beat its man*. It can now, so the reduction is finally
  affordable. Dunks 7.8 → 6.7 a game.
- **The catch-up slope (`MARK_REACT_SLOPE`, 0.05/point).** The reaction time
  scales with the scoreboard, so it is the difficulty knob and the rubber band
  in one object: a defender who is ahead is slower, one who is behind is
  sharper. That is a fairer band than inflating his shooting, because it is
  something you can watch happening and play against.

**Quiet and busy now sit on the same number**, which is the property this file
has cared about all along: passing and driving are equally viable. The honest
note is that the game is **easier than it was** — 58% against 54%, and a clumsy
bot 44% against 30% — and the opponent roster, not this, is the difficulty axis
(Yasser at 0.30 skill scores 5 a game; Grandma at 0.80 scores 15). If it needs
tightening after a human has actually played it, `MARK_REACT` and the slope are
the two dials, and neither of them re-glues the defender.

### Teeth

Four new checks (hoops 50 → 53). Four mutations, all caught: making him a mirror
again fails 2, removing the reaction time fails 2, removing the velocity lead
fails 1, removing the backpedal fails 1. Each of the three mechanisms is
individually load-bearing.

**And a third fragile fixture.** `park()` — shared by every movement check in
the file — assumed frame 240 of a fixed seed was live play. Giving the defender
a reaction time moved the whole simulation, that frame became a basket
celebration, fifteen "frames" of held input became far fewer real ones, the
acceleration ramp never finished, and a check about *diagonals* failed. The pin
is in the shared helper now, which is where it should have gone the first time.

## 6.6 — the guard is not always right

Follow-up, asked for directly: "the guard can't always be right. Nor should his
reaction or reverse direction time always be flat — if he was moving in turbo
the reversal time should be higher. And the reversal and the velocity lead
should not be flat, make them ranges that can get even worse. The defender also
needs to decide if he wants to guard a player without the ball or double team on
the ball — that can put him even further out of position."

Also, correctly: **the game being easier than it was is the fix, not a cost.**
Before, a drive was impossible. §6.5 hedged about that and should not have.

**Four things.**

1. **The reaction is a roll, not a constant.** 0.6x to 1.9x the score-scaled
   base, so at a level score it runs 0.18s to 0.57s. A flat reaction is a
   defender you learn once and then stop thinking about.
2. **The read is a roll too.** 0.45x to 1.85x of `MARK_LEAD`. Under 1 he
   under-reads your speed and trails; over 1 he has bought a stride more than
   you are giving him, and can be stopped dead and watched running past.
3. **Reversing a sprint costs extra**, on top of the reaction: up to 0.26s for a
   dead-180 at full speed, scaled by both how sharply he has to turn and how
   fast he was going when he decided to. This is what makes the best move in the
   game a bait — get him running, then go back the other way. A body at a
   standstill pays nothing.
4. **The second defender chooses**: stay home, or leave his man and go
   two-on-one at the ball, committed for 0.8–1.5s.

**The double took three attempts and two of them were measurably wrong.**

- *Re-rolled every reaction.* He spent the whole window travelling and never
  arrived: **26.2px from his own man while "doubling" against 26.9px at home** —
  identical. Not a choice, a twitch. Fixed with a commitment window.
- *At 38% of off-ball frames.* Now it worked — worth about 18 points of win rate
  — but it **punished passing**, because a body standing on the ball is standing
  in the lane out of it. The bot that passed twice a second fell to 26% against
  50% for the one that hardly passed. That inverts the one property this file
  has defended all session.
- *At 13%* (5% base, 14% when the ball is a threat) the two sit level again, and
  leaving genuinely costs him: **17.8px off his man at home, 27.6px while
  doubling.**

**A shot going up ends the double** whatever is left on the commitment — he
turns and finds a body. Without it the helper was still standing on the ball
when the miss came off the rim and the offence took 66% of its own boards with
2.8 tip-ins a game. The wind-up from §4.5 is what makes this readable: he reacts
to a gather he can *see*.

**Measured**, six seeds per rhythm (the rolls mean a single drive can come out
either way):

```
rhythm        8f   16f   24f   32f   40f   48f
peak gap    28.8  29.4  32.9  34.7  32.9  39.2
open         18%    7%   20%   28%   37%   33%
to the rim   118   108   105   107   104    98  frames
```

Balance holds and the level is where §6.5 left it: **quiet 58%, busy 54%, clumsy
42%.** In real games the player is now clear of a contest on **23% of
ball-holding frames** (16% before any of this) and inside a reach on **63%**
(76%).

**Two things found on the way.**

- **The offence has no spacing.** The two attackers stand **33.7px apart on
  average** on a 284px court. A spacing rule that pushes the off-ball man 74px
  clear of the ball changed that number by 0.3px — he never arrives inside a
  2.5s possession. It is left in because it costs nothing and helps the boards
  slightly, but the real fix is an off-ball offence that establishes position,
  and until that exists the double-team is a weaker mechanic than it should be.
  **This is the next real piece of work on this game.**
- **A gather could outlive its possession by a frame.** `giveBall` cleared the
  wind-up on the receiver but not on the man it was taken *from*, and the player
  loop had already passed him. Harmless until the second defender started
  doubling, at which point steals during a gather got common enough to trip the
  invariant. Cleared in `giveBall` and `looseBall` now.

**Teeth.** Three new checks (hoops 53 → 56). Five mutations, all caught:
flattening the reaction fails 1, flattening the read fails 2, making reversal
free fails 2, never doubling fails 1, and a double committed for a single
reaction fails 2. The reaction check needed fixing first — flattening the roll
left it green, because the score-based slope spreads the numbers on its own, so
it now only counts decisions taken at a level score.

### 6.6b — the double is a trigger, not a roll

Pushback, and it was right: *"maybe that's the cost of double teaming. Again I
recommend you check how the original deals with this."*

The section above dialled the double down to 5% because at 38% it punished
passing. That was treating a symptom. **Their off-ball defender does not roll
for it at all** — it picks between its own man and the ball carrier on a chain
of conditions (see `docs/NBA-JAM-MECHANICS.md`): ball too far from the basket it
defends, stay home; partner on the floor, take the ball; partner no longer
between the man with the ball and the basket, take the ball.

Help defence with a trigger. It fires precisely when the offence has already won
the on-ball matchup — which is what makes the contested pass out of it correct
rather than a problem. A random double is something the defence *spends* and it
lands on you as bad luck. A triggered one is something you **earned** by beating
your man, and the price of having two defenders on you is that the pass out is
hard and the reward is that one of theirs is alone.

Same numbers, the other way up:

```
                  random @38%   random @5%   triggered
quiet  (pass 1/s)     50%           58%         54%
busy   (pass 2/s)     26%           54%         64%
clumsy (35% idle)     24%           42%         46%
```

**Passing is now the better strategy, not the worse one** — which is the
property this file has defended all session, and the roll had inverted it.

**Two pieces of the first attempt did not survive measurement.**

- **A perpendicular "how far has my partner drifted off the lane" test.**
  Removing it moved offensive rebounds from 2.90 to 2.90 a game and all three
  balance win rates by zero. Deleted rather than kept as unguarded machinery.
  The "is he behind the ball" test and the distance check already cover it.
- **"A shot going up ends the double"** was kept, but *for the wrong reason*. It
  was justified by offensive rebounds, where it measures as nothing (2.90
  against 2.75 without). What it actually does is the passing game: leave the
  helper standing on the ball while a shot goes up and he is in the lane at the
  moment the offence wants to move it. With it, busy 64% / quiet 54%; without,
  54% / 60%. Load-bearing, now guarded by a comparison rather than a floor.

**The balance check needed strengthening to see that.** `passing is not a losing
strategy` asserted two absolute floors, and both of them survive passing being
simply the worse of the two strategies. It now compares the two directly.

**Teeth.** One new check (hoops 56 → 57, suite 1042). Four mutations: never
doubling fails 3, always doubling fails 2, dropping the shot clause fails the
new comparison, and dropping the lane test fails nothing — which is why the lane
test is gone.

### 6.6c — spacing: a table of spots, and the thing that caps it

*"You're probably not going to outsmart the original. What you could do is think
you're smarter and design a worse game. How does the original deal with this?"*

Fair. §6.6 ended by naming spacing as the blocker and inventing a rule for it —
push the off-ball man 74px clear of the ball — which moved the measured spacing
by **0.3px**. So: go and read.

**They do not compute a position.** `DRONE.ASM` holds a table of **sixteen
hand-placed spots** as offsets from the rim being attacked, in three groups —
seven behind the arc, seven at jump-shot range, two at the rim. The drone picks
one, walks to it, and stands there for **half a second to two seconds**. **On
fire, it rolls only over the first seven**, which is the whole of "the hot man
spaces out behind the arc" in one line. Spacing there is authored, not emergent.

Ours was a single formula: a fixed distance off the rim, on the depth lane the
ball was not on, oscillating a little. One place to be, and both attackers
always in it.

**Ported** — twelve spots, ours, scaled to a court where `THREE_DIST` is 118 and
a rim is only ~146 from midcourt:

```
                       before   after
three-point attempts     1.03    1.38
quiet  (pass 1/s)         54%     58%
busy   (pass 2/s)         64%     65%
clumsy (35% idle)         46%     60%
```

Passing still beats hoarding, and the three-point game is up a third. The table
is load-bearing for both: pinning everyone to a single spot flips passing back
to the worse play (56% against 62%) as well as failing the spot checks.

**Their exact sprint rule does not port.** Their drone only burns turbo getting
to a spot when it is on fire. Ours has to sprint whenever it is far, because —
see below — it otherwise never arrives: with their rule the numbers come out
quiet 74% / busy 58%, which is passing punished again.

**And now the real finding, which is bigger than the table.**

The spot table did **not** fix spacing. Two attackers still stand 33.8px apart
on a 284px court, and measured directly:

```
he is 69.2px from the spot he chose
he is standing on it        14% of frames
his distance from the rim he is attacking   149.9px
```

That last number is past the deepest spot in the table — he is in his own half.
**The offence never gets set, because almost all of it is transition.** The
court is 284px, players move at 76–116px/s so crossing it takes 2.5–3.7s, and a
possession here lasts about 2s. The whistle goes before anybody arrives
anywhere. That is why the 74px spacing rule did nothing, why the double-team is
a weaker mechanic than it should be, and why the three-point shot is thin no
matter how the spots are placed.

**It is not fixable by choosing better targets, and the next person should not
try.** The candidates are structural, and all three are real work:

1. **A shorter court.** Everything gets closer in fewer seconds. Cheapest, and
   it changes every distance constant in the file.
2. **Longer possessions** — the AI shoots fast and possessions average ~2s
   against a 15s shot clock. Slower decisions give the offence time to set.
3. **Set-up on the inbound**: put the attackers on their spots when a
   possession starts, instead of making them run there. Least faithful, but the
   only one that does not re-tune the whole game.

**Teeth.** Two new checks (hoops 57 → 59). Three mutations, all caught: one spot
for everybody fails 3 (including the passing comparison), letting a man on fire
pick from the whole table fails 1, and removing the dwell fails 2.

**A fourth fragile fixture, and this one was a genuine test bug.** `a tie is
played out` demanded overtime unconditionally once the clock hit zero level —
but the clock can hit zero with a shot already in the air, and `buzzerLive`
exists precisely so that attempt resolves. Seed 7 had simply never produced a
buzzer beater at that frame before; giving the defender a reaction time changed
which frame it was. It now only demands overtime if the scores are *still*
level.

### 6.6d — three things found by playing it, none of them shipped

Reported from an actual game, which is worth more than the thousand headless
ones behind everything above: *"sometimes the CPU teammate should handle the
inbound. Teammate needs to pass the ball more. Defense is still on top of me all
the time and I can't run past him, which is crazy."*

All three are real. None of them shipped, because each one breaks the
`passing is not a losing strategy` comparison, and weakening a check to land a
change is the failure mode this whole document exists to avoid. What follows is
the diagnosis so the next attempt does not start from zero.

**1. You cannot run past him because bodies are solid, and this is the big one.**

Every pair of players inside 11px is shoved apart every frame, and the on-ball
defender's standoff is 8px — **he parks inside the radius at which he physically
blocks you.** There is no gap to go through and none to go around. Measured on a
straight-line full-turbo drive:

```
                    solid    not solid
peak separation     13.6px     35.4px
clear of a contest     0%        22%
spent goalside         0%        65%
frames to the rim      182         98
```

It is all or nothing: a push radius of **4px restores the wall completely**
(13.6 / 0% / 0% again), and moving the standoff out to 13 or 16px does not help
either — the blocker is in front of you and any separation at all keeps you
behind him. The original does not make bodies solid; players run through each
other and contact is an *action* (the shove, the push-off) rather than geometry.

Removing it is the fix and it works. What it costs: driving becomes the best
play, `busy` falls behind `quiet` (70% against 78%), and the read mechanic from
§6.6 flattens — a committed cut stops being worth more than mashing, because
separation now comes from speed rather than from the defender committing
wrongly. Dunk range, the lane block, the reaction time and a steal bonus for
running *through* a man were all tried as the counterweight; each moved the
absolute level and none restored the ordering.

**2. The inbound always goes to you.** Literally `recv[0]`, the lower id, every
possession of every game — your partner has never once brought the ball in.
Alternating it (a third of the time) is worth about **+20 points of win rate to
the hoarding bot** and flips the passing comparison. It is not the forty pixels
of court position between the two inbound spots; making the positions follow the
ball rather than the slot changes nothing. Cause not yet understood.

**3. Your partner already passes.** He feeds you **13.2 times a game and shoots
1.4**. The complaint is not volume, it is *delay*: `canPass` makes him hold the
ball 0.8s before he will give it up, which on a 3.6s possession is a fifth of it
spent watching him dribble. Dropping it to 0.5s reads much better and
**reintroduces the relay loop that floor exists to prevent** — 1 game in 120
never ended. 0.6 and 0.7 are stall-free and both flip the passing comparison.

**The meta-finding: the balance sits on a narrow ledge.** Three unrelated
changes, all of them defensible, all of them tripping the same check. Either the
game genuinely is that finely poised, or `season(50)` is too small a sample for a
5-point threshold — the two seasons move 6–8 points between code variants and
that is the same order as the margin being defended. **Before the next balance
change, settle that question**, because right now it is not possible to tell a
real regression from a resample. Raising both seasons to ~120 games is the
cheap version.

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
1. §1   test teeth            ← DONE
2. §2   landscape/fullscreen  ← DONE (unverified on a real device)
3. §3   feedback              ← DONE
4. §4   input buffering       ← DONE
5. §4.5 release meter out     ← DONE
6. §6   small and true        ← DONE
7. §6.5 the dribble game      ← DONE
8. §6.6 the guard is human    ← DONE
9. §5   animation             ← as the art lands, tier by tier
10. spacing                   ← NOT STARTED, and the next real piece: see §6.6
```

§5 runs in parallel with everything from the moment the illustrator starts.

## 9. How we know it worked

Re-run the §0 balance table after each item. The game stays competitive
(no profile outside roughly 30–70%), passing stays at or above hoarding, every
game still finishes, and no frame carries a non-finite number. Those are the
four properties this session established and the ones any of this work could
plausibly break.
