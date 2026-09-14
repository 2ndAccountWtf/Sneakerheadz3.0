# The rep economy — design

## Where we actually are

Not "fakes are labelled". Fakes are labelled **three times over**, and the
underlying model has no room for deception in it at all.

| Fact | Where |
|---|---|
| A listing is fake **iff** its tab's `inventoryGroupRef` contains `fakes` or `backroom` | `systems/market/simulate.ts:330` |
| Fakes are priced at **15%** of real value | `simulate.ts:278` |
| Every store layout renders a badge off `item.isFake` | all 13 layouts, e.g. `GalleryLayout.tsx:160` |
| `isFake` is a **boolean** | `types.ts:21` |

So the player is told by the tab name ("Super Perfects", "Back of the Truck"),
by a price at 15% of market, and by a badge. Three signposts on one fact.

What already works, and works well — this is the half worth keeping:

| Mechanism | Where |
|---|---|
| Street buyers roll an `eye` (0.1–0.45) against every fake | `street/selling.ts:328` |
| Collectors roll `fakeDetectChance` = `eye − relationship × 0.15` | `collectors.ts:333` |
| Shops roll `securityLevel × 0.4 + heat/400` | `useGame.ts:422` |
| Caught in a shop: 20% fine, `remember('caught-their-fake')`, `reputationSpread(−18)` to that clerk's allies | `useGame.ts:420+` |
| Selling a fake earns **zero** street cred | `selling.ts:341` |
| Buying fakes adds **+8 heat** | `useGame.ts:375` |
| `LegitCheck` mini-game: spot the genuine defect among plausible details | `LegitCheck.tsx` |

The risk machinery is good. The information design is the problem, and so is
the fact that `isFake` is a boolean.

## The problem, stated precisely

A fake at 15% of market is not a scam, it is a discount bin. Nobody is
deceived: not the player buying, and not the player's conscience. The margin
comes from the buyer failing a dice roll, which is a tax on them rather than a
plan by you.

The fantasy is the opposite: **you knew, they didn't.** Buy something that
looks right, price it like it's right, and find out whether the person across
from you can tell. That requires two things the model does not have.

## The model

### 1. Quality is a spectrum, not a boolean

`isFake: boolean` becomes an authenticity grade. This is the load-bearing
change; everything else follows from it.

| Grade | Costs (× real) | Detection difficulty | What it is |
|---|---|---|---|
| `retail` | 1.00 | — | The real thing |
| `unauthorised` | 0.55 | very hard | Same factory, off the books. Genuinely almost right |
| `super` | 0.30 | hard | A good rep. Wrong stitching if you know where to look |
| `street` | 0.15 | easy | What is in the discount bin today |

`street` is what exists now, so nothing is lost — it becomes the bottom rung
rather than the whole ladder. The new rungs are where the game is: an
`unauthorised` pair costs over half of real money, which means **buying reps
becomes a real investment decision with real downside**, not free money.

Detection becomes `eye × difficulty` rather than `eye`, so a good fake beats a
casual buyer and still loses to a collector who knows the model.

### 2. Truth and belief are different things

The pair has a grade. The player has an **opinion**, and the two are stored
separately. An `InventoryItem` gains a believed grade, set when you buy and
revised when you learn something.

The player is never shown the true grade until something forces it into the
open: an authentication, a buyer who spots it, or a sale that goes through
clean.

### 3. What the player reads instead of a label

Four signals, none of them conclusive, which is the point:

- **Price against local market.** We already compute `localValue`. A grail at
  55% of it is telling you something — but so is a genuine clearance.
- **Where you are.** `securityLevel` is authored per store: a shop that
  authenticates everything is unlikely to be holding reps; a man with a trunk
  is not making guarantees.
- **How the seller talks.** A line per grade per store archetype. The honest
  dealer and the liar do not describe a pair the same way.
- **Paying to be sure.** `LegitCheck` becomes the deliberate purchase of
  certainty — costs money and a slice of the day, and tells you the truth.

### 4. Fakes leak

Today a tab is all-fake or all-real. Instead: **a small share of ordinary
listings carry a grade**, weighted by the store's own rigour. A `securityLevel
2` shop almost never has one; the bodega backroom usually does. That single
change is what makes every purchase carry a question, and it is why hiding the
badge is not enough on its own — with tab-determined fakes, hiding the badge
just moves the tell to the tab name.

## Detection, end to end

```
sold to           detection roll
────────────────────────────────────────────────────────────
street buyer      eye (0.10–0.45) × gradeDifficulty × (1 + heat pressure)
collector         (eye − relationship × 0.15) × gradeDifficulty
shop              (securityLevel × 0.4 + heat/400) × gradeDifficulty
```

`gradeDifficulty`: `street` 1.0, `super` 0.55, `unauthorised` 0.3.

So an `unauthorised` pair sold to a casual street buyer is near-safe, and the
same pair sold to a collector who knows that model is a coin toss. **Who you
sell to becomes the decision**, which is the part that makes this a game
rather than a dice roll.

## Consequences (mostly already built)

- Caught in a shop: fine, that clerk remembers, reputation spreads to allies.
- Caught by a collector: `caughtCounterfeit` already exists in `DealResultKind`.
- Caught on the street: **this is where the fighter earns its place.** Selling
  a knowing fake to the wrong person is exactly the kind of thing that becomes
  a `street-brawl`.
- Selling fakes never earns cred. Already true, and it is the right rule: the
  rep game makes money and costs standing.
- Police: carrying counterfeits already raises bust interest and they are
  confiscated on a search. Already wired.

## Failure modes to design against

1. **Reps become strictly optimal.** If margin beats risk, everyone runs reps
   every run and the straight game dies. Mitigated by `unauthorised` costing
   55% — real capital at risk — and by cred being unobtainable through fakes,
   so the rep route locks you out of cred-gated spots and collectors.
2. **Reps become strictly stupid.** If detection is too likely, nobody ever
   touches them and this was all wasted. The grade ladder is the dial; tune it
   by simulating, not by feel.
3. **Mystery becomes noise.** If the player can never form a view, it is a
   coin flip wearing a costume. The four signals have to be genuinely readable
   — this is the part most likely to be wrong on the first attempt, and the
   part to playtest hardest.
4. **The player loses track.** Ten pairs of unknown provenance in a bag is
   admin, not tension. The bag needs to show what you *believe* about each pair
   and how you came to believe it.

## Build order

1. **The grade.** `AuthGrade` type, grade on listings and inventory, pricing
   off it, `gradeDifficulty` in all three detection rolls. Pure, testable, no
   UI. The game plays exactly as now. ✅ *Done.*
2. **Leak fakes into ordinary tabs**, weighted by store rigour. Still labelled,
   so it is observable and tunable before anything is hidden. ✅ *Done.*
   Measured on a seeded world: 23.6% of listings at a `securityLevel 0` stall,
   7.4% at an ordinary shop, 3.4% at a gallery. `claimed` now sits beside
   `grade` — what the seller says versus what it is — and is equal to it while
   the badge stays honest, which is what makes step 4 a one-line change.

   **Finding that changes step 4.** The first draft gave a leak a keen sticker,
   because "price against local market" is the first of the four signals below.
   That needs genuine clearance on real pairs to exist too, or a markdown is
   just the word *fake* with extra steps. Measuring it killed the idea: this
   economy already runs at a **244% best cross-city margin against a 260%
   guard**, so any real pair listed below its rate blows the arbitrage ceiling —
   a 7% discount is enough to do it. Cheaper real stock is the one thing there
   is no room for. **Signal 1 is therefore unavailable**, and the mystery has to
   rest on the other three: store rigour, how the seller talks, and a paid
   `LegitCheck`. If step 3 says the player still cannot form a view, the answer
   is more seller dialogue, not a cheaper sticker.
3. **Simulate the economy.** Headless: does a rep-runner out-earn a straight
   trader? By how much? At what cred cost? Tune before a single label moves.
4. **Hide the truth.** Remove the badge, add believed-grade, add the four
   signals, wire `LegitCheck` as paid certainty.
5. **The bag.** Show belief and its source per pair.
6. **The brawl.** Getting caught by the wrong buyer goes physical.

Steps 1–3 are invisible to the player and make step 4 safe. Doing step 4 first
is how this ships as a coin flip.
