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

## 2. P0 — landscape and fullscreen

**Why:** it multiplies every other visual fix in this document, and it is the
one the owner named directly.

At 352×198 in portrait the players are **26 logical pixels tall**. The
follow-cam already exists and can punch to 2× (`FOLLOW_MAX_ZOOM`), but the
whole court fits on screen at 1× (`COURT_L = 34` to `COURT_R = 318` inside
`VW = 352`), so it rarely has anything to do.

Requirements:

1. Entering the mini-game asks for landscape and goes fullscreen.
2. A clear prompt if the device is held in portrait — not a broken layout.
3. Touch controls sized for thumbs at the screen edges, reusing
   `engine/TouchZones.tsx` from the street games rather than a second system.
4. Rotating back out, or leaving fullscreen, does not lose the game in
   progress.

**Deliberately not in scope:** widening the court in world units. That would
give the follow-cam real work and make the sprites bigger, but it changes
possession length, dunk range, defender rotation and the three-point line —
every number this session measured. It is its own project, listed in §7.

**Done when:** the game runs fullscreen landscape on a phone, portrait shows a
rotate prompt, and a run survives an orientation change.

**Risk:** medium. Layout and browser fullscreen APIs are fiddly on iOS Safari,
and the game is embedded in a larger app whose chrome has to get out of the way.

---

## 3. P1 — feedback the player is owed

Places where the game knows something and does not tell you, or tells you
something it decided by a mechanism nobody would guess. 3.1 and 3.2 are cheap.
3.3 to 3.5 are one connected problem with a shared fix.

### 3.1 65% of possession changes happen in silence

Measured: 2548 team possession flips over 60 games, **1652 with no banner, no
ticker line and no score change**. Almost all are loose-ball recoveries — the
"comes up with it" line is gated on `b.looseT > 0.4` (`:2381`) and fires ~0.7
times a game. Steals, picks, blocks and shoves all announce themselves; the
ball simply changing hands in a scramble — which is how most possessions
actually turn over — says nothing.

There is also no persistent "this team has the ball" marker. The `▼` marks who
you are driving, not who is holding it.

**Done when:** a scramble recovery gets a line, and possession is readable from
a still frame.

### 3.2 "HE'S HEATING UP" is suppressed 76% of the time

The `scorer.streak === 2` branch (`:1367`) sits *after* the alley / tip / dunk
branches in the same `else if` chain, and dunks are ~60% of scoring — so a
second straight bucket is usually a dunk and gets BOOMSHAKALAKA instead.
Measured: **434 streak-reaches-2 events, 104 banners = 24%.**

The iconic call, mostly missing. The streak pips in `drawPlayer` do carry the
information, which is why this is a feedback gap rather than a bug.

**Done when:** reaching a streak of 2 is announced regardless of how the bucket
was scored.

### 3.3 Goaltending is 71% of all blocking, and now we know why

The first draft of this document said goaltending was "too common" without
establishing a cause, which was not good enough. Measured, the reason is
mechanical and has nothing to do with the rate being mistuned.

**The two checks use the same conditions and get wildly different numbers of
chances to fire.** Both require an airborne defender within `BLOCK_R` (16px):

| | roll | when |
|---|---|---|
| block at release (`:1107`) | `rng < 0.55` | **once**, on the single frame the shot leaves the hand |
| goaltend in flight (`:2206`) | `rng < 0.5` | **every frame** the ball is inside `GOALTEND_R` past `GOALTEND_MIN_T` |

Measured over 25 games: a shot that enters the goaltend window stays there for
a **mean of 18.8 frames** (max 57). At 0.5 per frame, that is:

```
goaltend   P(at least one hit) over 18.8 frames  =  100.00%
block      P                                      =   55.00%,
           and only if he is already airborne at that exact instant
```

**The goaltend gets roughly 19× the rolls for the same radius and the same
rule.** It is not more common because it is tuned high. It is more common
because it is a repeated roll against a single one — so once a defender is up
and near the ball, the save is certain. That also explains the other half of
the complaint: the 53% of goaltends that erase an already-resolved make are not
a separate bug, they are the same certainty applied to shots that were going in.

### 3.4 What NBA Jam does about the same problem

Read as design rules only. **No code, data or art from that repository is used
here, and none may be.** These came back as summaries of TMS34010 assembly
rather than a line-by-line reading, so treat them as strong indications:

- **Block chance is 1% to 25%, scaled by the defender's skill attribute.**
  Ours is 50% and 55%, scaled by nothing.
- The percentage appears to gate whether the defender **tries** the block, not
  whether a met condition succeeds — a meaningful difference from ours, where
  the roll decides the outcome.
- **Trajectory matters:** the code distinguishes a player still going up from
  one coming down, and blocks are described as more effective on the descent.
  We check height (`o.y > 10`) but never direction.
- A blocked ball is deflected with velocity away from the hoop and possession
  goes to the defender. That part we already do.

So the shape of the fix is Jam's, not a number we invent: **a much lower
chance, scaled by the attribute we already compute and do not read, with
trajectory as a condition.**

### 3.5 Six roster modifiers are still unread

Directly relevant to the above, and an honest correction to what shipped
earlier in the session. `derive()` is wired in now and four of its twelve
multipliers reach the simulation. Eight do not:

```
speedMult       read        accelMult       UNREAD
jumpMult        read        dunkBias        UNREAD
dunkRangeMult   read        shotWindowMult  UNREAD
stealResist     read        deepMult        UNREAD
                            stealMult       UNREAD
                            blockMult       UNREAD
                            turboCapMult    UNREAD
                            turboRegenMult  UNREAD
```

**`blockMult` is the one §3.4 wants.** Wiring it is what turns the block from a
flat coin-flip into the attribute-scaled thing Jam describes, and it is the
difference between a good defender and a bad one actually meaning something on
a contest.

**Done when:** the goaltend is a chance rather than a certainty — one roll per
shot, or a per-frame chance low enough that a full window does not approach
100% — scaled by `blockMult`; trajectory is a condition; a CPU jumper has a
readable wind-up; and blocking a shot on purpose is possible. Re-measure the
balance table in §0 afterwards, because this moves scoring.

**Risk:** medium — 3.3 moves scoring. Re-measure the balance table in §0.

---

## 4. P1 — input buffering, done properly

A first attempt was built and **reverted** in this session. Recording why, so
the second attempt does not repeat it.

The measured problem is real. Presses are consumed by the frame whether or not
anything can act on them: `stepWorld` returns early during hitstop, and the
dunk and stumble branches `continue` before `humanControl` runs. Drops
measured at **51 consecutive frames during a stumble, 17–48 during a dunk, up
to 8 on a hit.** And there is no buffer, so pressing SHOOT two frames before
landing does nothing — the press is gone by the frame the jump could start.

The reverted attempt banked every press at the top of `stepWorld` and cleared
it as soon as `humanControl` *ran*. That is wrong in both directions:

- It **queued actions through hitstop** — you press during the frozen frames
  and the action fires on recovery, executing a decision made 100ms ago in a
  situation that no longer exists. Those presses were being dropped correctly.
- It **never fixed the landing case**, which is the one that matters.
  `humanControl` does run while you are airborne; the jump branch declines the
  press because `p.y !== 0`; "it ran, so the press is spent" then threw it away.

Measured cost, three human thumb speeds, 40 games each:

```
press rate   with buffer   without
3 Hz             15%         18%
5 Hz             15%         25%
8 Hz             20%         23%
```

Passes went 43 → 49 a game, past the measured optimum. It lost at every rate,
so this was not an artefact of the test bot mashing.

**The correct semantics:** a press survives being *declined* and clears only
when it is *acted upon*. That needs `humanControl` to report what it consumed,
which is a refactor of a ~200-line function rather than a patch.

**Done when:** pressing an action up to ~6 frames early makes it come out on
the first frame it is legal; no action ever fires from a press given during a
stumble or a dunk that has since ended; the balance table in §0 is unchanged.

**Risk:** medium-high. Touches every input path. Do it after §1 so the guards
exist first.

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
2. §2  landscape/fullscreen  ← biggest felt change for the effort
3. §3  feedback              ← 3.1/3.2 cheap; 3.3-3.5 are one job
4. §4  input buffering       ← needs §1's guards to be safe
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
