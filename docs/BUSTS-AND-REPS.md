# Busts, haggling, and the rep economy

Three connected builds, in order. Each ships on its own and is playable before
the next starts. The rule this time is one at a time, finished, rather than
four things at 70%.

The thread running through all three: **stop telling the player the answer.**
Every system below already exists in some form and fails the same way — the
outcome is known before the choice is made, so there is no choice.

---

## Build 1 — The bust

### What is wrong now

`ShoeStore.tsx` rolls `0.18 + heat/500` when inventory grows in a shady store
and fires the `police-raid` scenario. That scenario is three fixed buttons:
run (lose 1 random pair), bribe (lose $500), surrender (lose all fakes).

Every outcome is known in advance, none is uncertain, and none depends on
anything the player did. You learn the cheapest option once and every
subsequent raid is paperwork. Heat only changes whether the box appears — once
it does, the number the HUD has shown you all game expresses nothing.

### What it becomes

A negotiation, using the engine already proven in `systems/street/selling.ts`
(`trueMax`, `patience` → `maxRounds`, `acceptChance`, and the `'dead'` status
with its `KILL_THRESHOLD`). Inverted: he names a number, you offer up.

The officer's hidden state:

| | driven by |
|---|---|
| `trueMax` — what he will actually settle for | heat, city, whether he came looking for you |
| `patience` — rounds before he stops entertaining it | his own temperament, your cred |
| the `'dead'` threshold — the lowball that makes it worse | how insulted he is by the gap |

So: maybe he takes it. Maybe he refuses. Maybe he takes it and asks for more
next time, because he now knows you pay. A lowball to the wrong officer turns
a shakedown into a real problem.

### What it drags in that already exists and currently does not matter

- **Banking.** Cash on you is seizable; banked cash is not. The distinction is
  built and nothing currently punishes ignoring it.
- **Inventory size.** Two pairs is a misunderstanding. Ten is a case.
- **Cred and `remember()`.** Whether he has heard of you, and from whom.
- **City.** Tel Aviv should not read like Tokyo.
- **Fakes.** Carrying counterfeits changes what he is even interested in.

### Mini-game links

Wire the hooks now, improve the games later — they are stubs into games that
already exist, not new games:

- **Run** → `SneakerChase` (foot chase)
- **Drive off** → `CartRace`
- **Swing on him** → `street-brawl` (catastrophic if you lose, and it should be)

Each link is one dispatch. The bust must be fully playable with none of them,
so that a weak chase never blocks the bust from shipping.

### Where busts can happen

Not only shady stores. Street selling already tracks heat per spot and already
has `shutdownChance`. A bust at a selling spot is the natural second site.

---

## Build 2 — Haggling and rivals, in three stores only

Not all thirteen. Three, chosen so the mechanic reads as character rather than
as a new universal tax:

- one where haggling is expected and refusing to is the mistake
- one where it is faintly insulting and costs you standing
- one where the shopkeeper enjoys it and respects you for trying

Same negotiation engine again, third use. The shopkeeper's ceiling is shaped
by whether he knows you, how that model is moving in this city, and whether
you have lowballed him before — all of which `remember()` already records.

**Rival buyers, occasionally.** The stores already render ambient NPCs who do
nothing. One of them wanting the same pair — and taking it if you haggle too
long — turns a price tag into a decision with a clock.

---

## Build 3 — The rep economy

### The one thing that is wrong

Everything else is already built:

- `StreetBuyer.eye` — `if (item.isFake && Math.random() < buyer.eye)`
- `fakeDetectChance(collector, player)` for private sales
- `securityLevel * 0.4 + heat/400` for shop sales
- caught: 20% fine, `remember('caught-their-fake')`, `reputationSpread(-18)`
  across everyone allied with them
- buying fakes: +8 heat; selling them: zero cred

And then every store layout renders a badge straight off `item.isFake`. The
game built a hidden-information economy and printed the answer on the label.

### What changes

**Truth and belief become separate things.** The pair is or is not real; what
the player has is an opinion. Form it from readable signals, never a flag:

- **Price against market.** A grail at 60% of local value is telling you
  something.
- **Where you are.** Store reputation and `securityLevel` are already authored.
- **The seller.** Tells in dialogue — an honest dealer and a liar should not
  describe a pair the same way.
- **Paying to be sure.** `LegitCheck` exists as a mini-game. Authentication
  costs money and time and is the deliberate way to buy certainty.

**Buying reps stays possible and becomes a strategy.** The `fakes` tab already
exists in the store type union. Some places sell reps openly and cheap — that
is the honest version, and the margin on passing them off is the reward for
the risk that is already implemented.

### Why this is the cheapest of the three

It is mostly deletion. The risk machinery, the detection rolls, the reputation
spread and the memory are all written and working. What is missing is the
absence of a label and a handful of signals to read instead.

---

## Order and why

Busts first: it is self-contained, needs no art, and gives heat teeth — the
stat the HUD has been showing all game while meaning almost nothing.

Haggling second: third use of a proven engine, and it fixes the oddity that
you can haggle a stranger on a street corner but not a shopkeeper standing in
front of you.

Reps third: cheapest and highest leverage per line changed, but it reads best
once busts exist, because carrying counterfeits into a police stop is the
moment the whole thing locks together.
