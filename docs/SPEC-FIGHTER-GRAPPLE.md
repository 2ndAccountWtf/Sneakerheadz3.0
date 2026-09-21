# Spec — the grapple system

Phase 2 and 2a. Entry, the clinch rungs, the move list, the defender's four answers, stamina, and the eight decisions that must be answered before a line is written.

Split out of `PRD-FIGHTER-DEPTH.md` on 2026-09-21, which had grown to 2,013
lines doing four jobs at once. That document is now the plan and the index;
this one is spec.

---

### Phase 2 — the grapple system · ~L

The centrepiece, and the thing three references independently point at. Our
grab is one move with one outcome; this makes it a game.

**Entry, and its cost.**
- GRAB tapped is a **weak clinch**; GRAB held is a **strong clinch** — slower
  startup, more turbo, better options. Same button (§2.10, and Phase 1's
  tap/hold).
- Entry drains **stamina**, a new resource — the fighter has `hype` and nothing
  else, so there is currently no reason not to mash. See §6 Phase 2a.

**Inside the hold — the AKI slot model, at our scale.**
- The hold freezes both fighters. During it the D-pad picks the outcome:
  neutral, up, down, toward. Four outcomes from a weak clinch, four different
  ones from a strong clinch. **No new button.**
- One outcome on each does not finish — it **advances a rung** to a dominant
  position with its own four outcomes, and reopens the defender's escape.
  Two rungs, not four.

**The defender's side, which is what makes it a game rather than a coin flip.**
- **The sprawl.** Holding down-and-back during the grab's *startup* stuffs it
  outright and leaves the grabber punishable. A specific read, not any block.
  This closes the triangle in both directions: strike beats grab, grab beats
  block, block beats strike, and the right low guard beats the grab.
- **The break.** One press inside the window. Mashing does not help — ours
  currently rewards it, which means the break is not a decision. The *window*
  scales with `focus`, the way the input buffer already does.
- **The contest.** While held, both sides bleed turbo; the defender's escape
  window widens as the holder tires. Position is contested continuously, not
  decided once.

**Outcomes.**
- Forward throw carries into the wall for bonus damage (we have this).
- Back throw switches sides — the corner-escape tool, and a real reason to pick
  a direction.

**Animation.** Every rung, transition, throw and escape is its own `AnimState`
from Phase 1. Art for a clinch drops in without touching any of this.

*Gate:* the grab's usage rises without its win contribution rising — a tool,
not a trump. A bot that always grabs stays beatable by a bot that reads the
sprawl. Turbo spent on dashes measurably weakens your grapple defence.

### Phase 2a — the grapple move list

**Correction:** the Phase 2 sketch above said the clinch is contested on turbo
"which already exists". It does not — `turbo` is a hoops field. The fighter
carries `hype` (the special meter) and nothing else, so the contest needs a
real resource. See *Stamina* below.

**The rule for what gets in.** A grapple move earns its place only by doing
something no other move does. Six mechanical roles, and everything below fills
exactly one:

| role | what it is for |
|---|---|
| **chip** | small damage that *keeps* the hold — makes the clinch a place, not a menu |
| **burst** | big damage, hard knockdown, hold ends — the payoff |
| **position** | no damage, better options next — the rung up, or a side switch |
| **drain** | damage over time while both are locked — a contest, not an outcome |
| **exit** | leave on your terms with advantage — stops the ground being all-in |
| **debuff** | a status rather than damage — the role Phase 10's dirty moves add |

---

#### Entry

| input | move | startup | on whiff | cost |
|---|---|---|---|---|
| tap GRAB | weak clinch | 5f | −22 | 8 stamina |
| hold GRAB (~12f) | strong clinch | 9f | −28 | 18 stamina |
| dash + GRAB | running clinch | 7f | −30 | 20 stamina |

The running clinch reaches further and is harder to break, and the sprawl
punishes it hardest. Tap-versus-hold comes from Phase 1.

#### Rung 1 — the clinch. Direction is read **during** the hold, not at entry

**Input, settled in §6 Phase 1b:** the outcome is **the stick direction held
when the hold resolves** — no button, no swipe, no extra cluster. The fighters
are frozen and the thumb is already on the stick. **Neutral is the knee**, so
doing nothing gives you the safe chip option rather than a fumble.

Weak set — 16-frame hold:

| dir | move | role | effect |
|---|---|---|---|
| neutral | **Knee** | chip | ~6 dmg, **keeps the clinch**, builds hype. Same-move proration bleeds it fast, and every knee reopens their break window — so staying is a gamble |
| forward | **Body slam** | burst | ~15, hard knockdown, wall bonus |
| back | **Judo trip** | position | ~10, **switches sides**. Less damage is the price of the corner escape |
| down | **Takedown** | position | 0 dmg, both to the floor, you on top → Rung 2 |

Strong set — 20-frame hold:

| dir | move | role | effect |
|---|---|---|---|
| neutral | **Standing guillotine** | drain | ~1.5 dmg/frame while held, both locked, drains their stamina hard. They mash out, you hold. Escape leaves you −14 |
| forward | **Suplex** | burst | ~24, hard knockdown, heavy hitstop, wall bonus |
| back | **Back drop** | burst + position | ~18, side switch, they land behind you |
| up | **Shoulder throw** | burst + setup | ~12 and it **launches** — the only grapple that feeds the juggle system |

#### Rung 2 — ground, you on top

| dir | move | role | effect |
|---|---|---|---|
| neutral | **Ground and pound** | chip | ~5 a hit, scales down, builds hype. Each hit reopens their reversal |
| forward | **Advance to mount** | position | no damage; their escape gets harder, your options get better |
| down | **Armbar** | drain | ~2 dmg/frame. Bigger payoff than the guillotine, bigger risk |
| back | **Stand up** | exit | disengage with frame advantage — bank it and reset |

#### The defender — four answers, each beating a different thing

1. **Sprawl** — down-and-back during the grab's *startup*. Stuffs it outright
   and leaves the grabber −20. This is the **read**, and it is what closes the
   triangle: strike beats grab, grab beats block, block beats strike, and the
   right low guard beats the grab.
2. **Break** — **press BLOCK** during the hold window (§6 Phase 1b). Both
   shoved apart, neutral. The window scales with `focus`, and only the first
   press inside it counts, so mashing buys nothing. This is the **reaction**.
3. **Buck** — on the ground, direction plus button, contested on stamina.
   Reverses top and bottom. This is the **contest**.
4. **Ride it out** — take the throw and keep your stamina. Sometimes correct:
   a failed escape into a submission costs more than the slam would have.

**Submissions are the deliberate exception: mashing *is* correct there.** You
are already caught, so it is a struggle rather than a read. Keeping that
distinct from the break is what stops "mash everything" being the whole
defensive game.

#### Stamina — the resource the fighter is missing

One new field, and it pays for more than the grapple. Starts 100. Regenerates
quickly standing, slowly in a clinch, **not at all** inside a submission.

- Entry costs as tabled; sprawl 12, break 10, buck 14.
- Below ~20 you cannot initiate a grapple and your escape windows narrow.
- Dashes and jumps draw on it too, so movement and grappling compete.

This is also the fighter's missing answer to "why not mash" in general.

#### Environment

The wall bonus exists. Add **one hazard per venue** — a dumpster, a parked car,
the ice machine — that a throw can send someone into for bonus damage and its
own animation state. It is Def Jam's signature move and it ties the fighter to
the venue system the game already has.

#### Weapons

**You cannot grapple with a melee weapon in hand.** Grabbing drops it to the
floor, where either fighter can pick it up. That is a real decision — keep the
crowbar, or take the grapple — and it needs no new art beyond a dropped-weapon
state.

#### Deliberately not included

- **More submissions** (kimura, leg lock, triangle). More animations, identical
  mechanics. Two — one standing, one ground — cover the drain role.
- **Guard / half-guard / side control as separate rungs.** TUC runs four; we
  run two. More rungs is more to learn inside a thirty-second fight.
- **Air grabs.** Unreadable at 320×180 and they break the anti-air game.
- **Pins.** No referee. It is a car park.

#### Open decisions — Phase 2 cannot start until these are answered

Audited 2026-09-21 against the question *could someone build this without
asking anything?* They could not. What follows are decisions, not research.

**1. The sprawl conflicts with crouch-block. This is a bug in the spec above.**

`StreetFighter.tsx:1044-1045` already defines the guard as two independent
holds:

```ts
f.blockHeld = !locked && !airborne && f.state !== 'attack' && wantBack;
f.crouch    = !airborne && cmd.down;
```

So **down-and-back is already crouch-block**. A sprawl that fires on
"holding down-back during the grab's startup" would therefore fire on *every*
low block, making it free and automatic — and the grab would never beat a
guard again, which destroys the entire triangle.

Three ways out, and one has to be picked before any of this is built:

- **(a) The sprawl is a press, not a hold** — tap down while already holding
  back, inside the startup window. Costs stamina, so a wrong guess is paid for.
  Needs Phase 1's frame-stamped input to judge.
- **(b) The sprawl is its own input** — GRAB pressed during their grab startup,
  i.e. grab-beats-grab. Simple and readable; loses the "the right guard beats
  it" flavour.
- **(c) No sprawl; the grab is simply unblockable** — what we ship today. Keeps
  the triangle three-sided and gives up the fourth answer.

- **(d) BLOCK becomes a button** (§6 Phase 1b). Crouching stays on the stick,
  guarding moves to a button, and the two become independent — so `down + back`
  stops meaning two things at once. The sprawl is then **entering crouch-block
  inside the timing window** as their grab goes active; holding it from earlier
  does not count, which is what stops a permanent crouch auto-sprawling.

**Resolved: (d).** It removes the ambiguity at its source rather than papering
over it, it costs no extra button, and the timing check is the same one the
instant block needs — one implementation, two mechanics.

**2. Grabbing someone in blockstun is currently legal and undefined.**
`grabbable()` excludes `hitstun` but not `blockstun`, so a tick throw — poke,
they block, grab them before they recover — works today by accident. That is a
real and legitimate tool in fighting games, but it has to be a decision: either
allow it and price it, or exclude blockstun the way hitstun is excluded.

**3. Two grabs on the same frame.** Undefined. Ikemen randomises the winner.
Options: both whiff and both recoil (a clash — readable), or the faster startup
wins, or coin-flip. Pick one.

**4. The round ending mid-hold.** `endRound` knows nothing about `holdT` or
`grabT`, so a timeout during a clinch leaves both fighters in a hold state
through the K.O. banner. Needs an explicit release.

**5. A projectile arriving mid-hold.** We have thrown weapons. Does a flying
bureka interrupt a clinch, hit the held fighter for free, or pass through?

**6. The special during a clinch.** With a full meter, can you uppercut out of
being held? If yes it is a reversal and the meter gets a second use; if no, say
so. Ikemen's answer is that the super has invulnerable startup and *is* the
reversal.

**7. Stalling.** Knee keeps the clinch and ground-and-pound repeats. What stops
two cautious players sitting in a clinch for the whole round? Options: a hold
timer that force-releases, or proration that makes chip worthless quickly, or
stamina drain that makes holding unaffordable. Probably all three, lightly.

**8. Grabbing a rising opponent.** `hittable()` excludes `down`, but rising has
12 invulnerable frames. Is a grab on wake-up allowed? This is the reason
§Phase 5 lists throw invulnerability as a *typed* frame property.

#### The animation contract is named but not specified

Phase 1 lists the `AnimState` names. It does not define the interface art will
be authored against, and that must be pinned **before anyone draws a frame**:

- Does each state declare a fixed frame count, or a duration the sim drives?
- Which states loop and which play once?
- What is the anchor — feet, centre, or the existing 15px body box?
- What does a state do when its clip is missing? (Today's procedural draw is
  the fallback, and it has to stay the fallback.)
- Do held states — clinch, choke, armbar — expose a separate *struggle*
  progress for the artist to key against?

Until that is written down, "art plugs in later" is an intention rather than a
contract.

#### The numbers in this document are invented

Every figure above — stamina costs, hold lengths, damage, the −20 on a stuffed
grab — is a starting guess. They are not research questions; they are
measurement questions, and each needs a named harness policy that proves it:

| number | proven by |
|---|---|
| hold length | a bot that always breaks vs one that never does |
| break window | break rate lands near 50% at baseline `focus` |
| stamina costs | a grab-spam bot must run itself out of stamina |
| sprawl advantage | a sprawl bot beats a grab-spam bot and loses to a striker |
| chip proration | a knee-only bot must lose to a mixed bot |

#### The AI half is a stub

"The AI learns every mechanic" is not a spec. It needs: how the opponent
chooses among four clinch outcomes, when it prefers a rung-up over a throw,
its sprawl rate, its break rate, and whether it can be made to *stall* by a
defensive record. That is the same shape as §5's behaviour table and should be
written as one.

#### If we build a subset first

The weak clinch's four, the sprawl, the break, and the existing wall slam.
That is the entire triangle working end to end. The strong set and Rung 2 are
the second pass.
