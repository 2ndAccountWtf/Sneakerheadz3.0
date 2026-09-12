# Sneakerhead Dope Wars

A sneaker-trading game in the shape of the old Dope Wars loop — buy low in one
city, fly, sell high in another — with a much louder world bolted on top:
celebrity market manipulation, street encounters that turn into mini-games,
and a Prime Minister who may or may not hand you a titanium wallet.

## Run locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build to dist/
npm test         # engine + content checks
```

No environment variables or API keys are required.

## How the game is put together

```
systems/                Game logic, framework-free and testable
  outcomes/             The OutcomeEngine — turns authored `outcomes` into state
  events/               Travel rolls, Bibi cutscenes, naps, AM/PM chaos
  quests/               Modular side-quest generator
  pricing.ts            One place that decides what anything costs or fetches
  rumorEngine.ts        Daily per-city rumour generation
data/                   All content: sneakers, cities, stores, NPCs, dialogue
hooks/useGame.ts        The reducer — the single writer of game state
components/minigames/   Mini-games, behind one host and one shared shell
screens/                One screen per Screen enum member
```

### The OutcomeEngine

Dialogue in `data/npcs` and `data/celebrities` is authored with `outcomes`
arrays:

```ts
outcomes: [
  { type: 'combat', result: 'fight-roll', description: 'Fight over a lace.' },
  { type: 'streetCred', condition: 'win', change: 3, description: '…' },
]
```

`systems/outcomes/outcomeEngine.ts` is the only thing that interprets these. It
returns the new player state, a plain-language receipt shown to the player, and
optionally a mini-game to hand control to. Outcomes tagged
`condition: 'win' | 'lose'` are withheld and applied by whichever mini-game the
same node launched — which is how a `combat` outcome becomes a playable fight
whose stakes were written in the dialogue file.

To add content, write a scenario; you do not need to touch any engine code.

### Tests

`npm test` covers the two things most likely to rot:

1. The OutcomeEngine's handling of every authored outcome shape — clamping,
   day-scoped expiry, conditional win/lose payloads, pricing knock-ons.
2. The integrity of the content itself. It walks all ~100 scenarios and asserts
   there are no dangling choice targets, no dead-end nodes, and no outcome type
   the engine cannot apply. Adding dialogue that references a node you forgot to
   write fails the suite rather than shipping an empty modal.

### Time

A day is one flight. Buffs and market signals expire on a **game day**, not a
wall-clock timestamp, so a "24h" effect lasts exactly one trip.

### Design system

All visual tokens, panels, buttons, chips and meters live in the `<style>` block
in `index.html`. Screens compose those classes; stores add personality through
`data/storeSkins.ts` rather than by rebuilding the layout.
