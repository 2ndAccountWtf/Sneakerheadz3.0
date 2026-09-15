# Trust — design

The answer to the question `docs/REPS.md` step 3 left open.

## What the simulation said

A committed rep-runner earns **0.72×** a straight trader (median $3.23M against
$4.49M over 400 seeded 30-day runs), and cutting `GRADE_COST` cannot fix it: the
bag holds ten pairs however much each one cost, so the rep's cost advantage stops
paying the moment slots bind instead of cash. A rep returns 3.19× its cost
against a real pair's 1.71× and *still loses the run*.

The reason is on the sale side. A `securityLevel 0` counter pays full market
price and its detection works out at roughly `0 × 0.4 + heat/400` — about 0.24
even at heat 97, so against an `unauthorised` pair (difficulty 0.3) it catches
7% of the time. The rep-runner dumps 177 of 233 pairs over such a counter and is
searched about 0.4 times in thirty days. **"Who do you sell to" collapses to
"always the grimiest shop in town."** There is no decision in it.

## The fix: a store paying out for a rep is the point

Getting away with it should make you rich. What is missing is not a bigger
payout — it is a cost that accumulates, so the scam has an arc instead of being
a flat tax-free income. Three things, in order of how much they matter:

### 1. Looking and seeing are different things

Today one roll does both. Split it:

- **`checkChance`** — does anybody examine the pair at all? A property of the
  counter, the clerk, and how they feel about *you*.
- **`spotChance`** — given that they looked, do they see it? Already exists, and
  is a property of their eye against the grade.

This is the whole unlock. It gives the grimy counter a real floor (**a lax shop
still checks something like 1 in 10, a careful one nearly always**) without
making its clerk sharp-eyed, and it gives the schmooze something to target: you
distract the clerk, you do not improve their eyesight.

### 2. Trust is a scale, not a flag

`trust` on the player, from **−100 notorious** to **+100 trusted**, starting at 0
(nobody knows you). Bands, because the player needs to feel a threshold cross:

| band | range | what it means |
|---|---|---|
| `notorious` | −100…−60 | Your face is a warning. Everyone checks, nobody stretches. |
| `shady` | −59…−20 | Word has gone round. Checked often, offered less. |
| `unknown` | −19…19 | Day one. Neutral. |
| `known` | 20…59 | Good for it. Fewer checks, better numbers. |
| `trusted` | 60…100 | Waved through. The best deals are here. |

Trust moves **down** hard and **up** slowly, which is how reputation works:
getting caught is −12 and spreads; a clean sale is +1.

Two layers, because "that shop remembers" and "everyone has heard" are different
feelings:

- **`suspicion: Record<storeId, number>`** — the shop that caught you checks you
  harder, forever. Local, sharp, and the reason you burn a venue rather than a
  city.
- **`trust`** — the global number. It moves when a catch *spreads*, which is
  what turns one bad afternoon into a run-defining problem.

### 3. What trust buys, and what it costs

Trust cannot be a single dial on one screen or it is just heat with a nicer name.
It has to be felt in three places the player already goes:

- **Shops** check you more often (`checkChance`), and a shop that has caught you
  once checks you nearly always. The fine and the confiscation already exist.
- **Street buyers** doubt you: `trueMax` shrinks toward the low end, so the same
  pair fetches less from the same buyer type. Low trust is a permanent haggling
  penalty.
- **Collectors** are the wall. They are cred-gated already; below `shady` they
  stop taking meetings, which closes the channel that pays the best premium and
  is the real cost of running reps at scale.

Selling fakes already earns **no cred** (fixed today — the shop counter was
paying it). Cred and trust are deliberately different: cred is how big you are,
trust is whether your word is good. You can be a famous crook.

## The schmooze

The lever that makes the rep game *playable* rather than a dice roll: lower
`checkChance` for one visit by taking care of the clerk. Beers, a joint, a
coffee, a bureka. These come off the **AM/PM shelf**, which finally gives that
whole store a reason to exist beyond weapons and snacks.

- It costs money and a slot, so it competes with carrying stock.
- It is **per-visit**, so it cannot be stacked into permanent immunity.
- It fails sometimes, and failing *raises* suspicion — offering a bribe to the
  wrong clerk is itself a confession.
- It works worse the lower your trust: a clerk who has been warned about you is
  not taking your beer.

## Fake cash, both directions

The same mechanic pointed at money instead of shoes, and it is symmetric, which
is what makes it feel like a world rather than a feature:

- **You pay with fake bills.** A counterfeit stack is an AM/PM-shelf item. Cash
  purchases already get a discount; paying with paper makes the discount 100%
  and the risk enormous. Caught → the shop's `suspicion` spikes, trust drops,
  and this is the kind of thing that ends in a `street-brawl` or a bust.
- **You get paid in fake bills.** A street buyer or collector burns you. You do
  not find out at the sale — you find out at the **bank**, on deposit, which is
  the delayed sting that makes the player start eyeing who they sell to. Trust
  works in reverse here: a buyer is less likely to try it on someone connected.

Cash already carries robbery risk and a card carries the skim. Fake paper makes
cash genuinely a *choice* instead of a discount with a mugging attached.

## Failure modes to design against

1. **Trust becomes heat.** Two decaying penalty meters is one too many. Heat is
   the police; trust is commerce. Heat decays with quiet days, trust does not —
   it is repaired by clean dealing, which costs time you wanted to spend hustling.
2. **The schmooze becomes a tax.** If buying a six-pack before every sale is
   strictly correct, it is a click, not a decision. It has to cost a slot, and
   at high volume the slot is worth more than the risk.
3. **Low trust becomes unplayable.** `notorious` must remain a viable, hostile
   way to play — high margins, no collectors, everything checked — not a death
   spiral. Somebody should *want* to run notorious.
4. **The delayed fake-cash sting reads as a bug.** If money silently vanishes,
   it is a bug even when it is a feature. It needs a scene at the bank that
   names the buyer who burned you.

## Build order

1. **Split the roll.** `checkChance` beside `spotChance`, with the lax-shop
   floor. Pure, tested, no UI. Re-run the rep simulation: this alone should move
   0.72× a long way, and the number tells us what the rest has to do.
2. **Trust and suspicion on the player.** The scale, the bands, the two layers,
   the decay rules. Wire into `checkChance` first, since step 1 built the seam.
3. **Trust in the negotiations.** Street `trueMax`, collector access.
4. **The schmooze**, off the AM/PM shelf.
5. **Fake cash out**, then **fake cash in** with the bank scene.

Steps 1–2 are invisible and decide whether any of the rest is worth building.
Same rule as the reps ladder: simulate before anything reaches the screen.
