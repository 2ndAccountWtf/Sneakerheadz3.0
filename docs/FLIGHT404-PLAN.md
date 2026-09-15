# Flight 404 — the market that refuses to take this seriously

The design in one line: **the player is in a serious arcade shooter, inside a
world that will not acknowledge it.** Every laugh comes from the gap between
those two things. That is the rule every decision below is checked against — if
a piece of chaos *reacts* to the player, it is probably wrong.

## What already exists

More than you would think. This is an expansion, not a rewrite.

| already in the game | where |
|---|---|
| Abbasfat, and his three-phase cycle | `BOSS_CYCLES` — `rant / throw / summon / charge`, `megaphone` in phase 2, all of it in phase 3 |
| His rants, barks, intro and defeat lines | `content.ts` |
| Three enemy kinds, hostages, trolleys as cover | `content.ts`, `gameScene.ts` |
| Five sections with parallax strips and a darkness model | `buildScenery`, `buildDarkness` |
| The climb: four rungs, reachability proved | `terrain.ts` + 35 checks |
| Destructibles, blasts, movers, wave spawners | `props.ts`, `explosions.ts`, `movers.ts`, `spawners.ts` |

So the boss fight's *skeleton* is built. What is missing is the cast, the
background that ignores them, and the physics comedy.

## What we are borrowing, and from where

Nothing is copied. Every repo below is either unlicensed or its licence does not
cover its art; these are ideas, re-implemented.

**Per-tile attribute flags — from Hurrican** (`Tileengine.hpp`). Twenty-four
orthogonal behaviours as a bitmask on a tile rather than a subclass per terrain
type: solid, *solid-for-enemies-only*, one-way, destructible, damaging,
conveyor-left/right, slippery, sink, occludes-the-player, turnaround-point. Two
of those are worth the whole exercise:

- `GEGNERWAND` (solid for enemies only) solves "the enemy walked off the ledge"
  with a painted invisible wall instead of AI raycasts. The designer controls it.
- `WENDEPUNKT` (turnaround point) puts a moving platform's patrol bounds *in the
  level*, so the platform AI is a handful of lines that flip velocity on a flag.

Our `PlatformDef` currently has `kind` and `oneWay` — two behaviours as an enum
where this wants a flag set. **Convert before any section is authored**, because
afterwards it is a data migration.

Also from Hurrican: **moving platforms are just enemies** with `destroyable =
false`, so there is one entity system and one collision path; and **every entity
caches `blockUp/Down/Left/Right`** once per frame from the tile flags, which is
why 86 of their enemy AIs each fit in ~150 lines. That is the mechanism that
makes a cast this size affordable.
*Licence: no LICENSE file; the author's release says "as long as you don't charge
any money for it" and asks to be contacted for commercial use of assets. Read
only.*

**Wave spawning with a mercy rule — from hivefall.** Its `meleeZone` has a live
cap, alternates which side they come from, and **suppresses spawning behind you
when you are pinned near the screen edge**. That last rule is the difference
between pressure and cheap deaths, and our spawners do not have it yet.
Also its `eachSolid()` visitor: static ground, one-way platforms and *live
bridge segments* all yielded through one callback, so destructible terrain is
simply an entry that stops being yielded — no special case in the collision
layer. *Licence: none. Ideas only.*

**One radial-damage function — from rusted-cannon.** `explodeAt(x, y, r, dmg,
from)` applied to every collection including the player, and destroyed barrels
call it in turn, so **chain reactions fall out for free** with no chain-specific
code. Exactly right for a market full of hummus bowls. Its other rule is worth
adopting verbatim: never create a non-colliding copy of a prop that elsewhere is
destructible, or the player learns to distrust the scenery.
*Licence: MIT and it does cover art — but the art is AI-generated with
byte-identical "animation" frames. Pattern only.*

**Levels validated in CI — from Zora and Blastix.** Throw on a malformed level
chunk rather than silently shifting the map; write the jump budget into the level
file; derive reachable arc from the physics constants. We already compute
reachability — this extends it to the authored sections.

## The three worlds

The design's most important structural idea. Three layers that do not talk to
each other:

**Foreground** — the game. Player, enemies, platforms, crates, explosions.
**Midground** — the market. Stalls, carts, tables, signs, vehicles, falling
objects. Interactive: it can be destroyed, knocked into, or set off.
**Background** — pure comedy, *never interactive*. Coffee crew, the shawarma
guy, donkey traffic, sheep, balcony spectators, the man sweeping the same patch
of pavement.

The discipline: **background actors must never react to the player.** A coffee
crew that flinches when you shoot is a game element. A coffee crew that carries
on is the joke. The one exception is the authored rare beat — everybody ducks
at an explosion, and is back to coffee two seconds later.

## The cast

Each enemy needs a *behaviour that is funny on its own*, not a reskin.

| enemy | the mechanic | the joke |
|---|---|---|
| **Scalper** | runs at you, throws shoe boxes, grabs dropped power-ups | stops mid-fight to photograph a legendary drop, then remembers you |
| **Hypebeast** | body-check charge, no weapon | misses and crashes into a storefront |
| **Reseller** | avoids you, collects dropped loot into a backpack | ignore him too long and he genuinely steals your pickups |
| **Mall Security** | over-serious, radios his partner constantly | narrates "we have a situation" while a donkey runs past unacknowledged |
| **Angry Shop Owner** | throws stock: boxes, mannequins, displays, baskets | stops attacking to straighten merchandise. "THAT'S IMPORTED!" |
| **Falafel Guy** | neutral until knocked into | his counter going over is a physics event, not an attack |

The Reseller is the best mechanic in the list: an enemy whose threat is
*economic*, which fits a game about sneaker trading exactly.

## Physics comedy

Two distinct systems, deliberately not one.

**Hummus** — soft. Launches in arcs, smears on impact, slides down signs, sticks
to an NPC for a few seconds, then fades. Splut. A large bowl can roll downhill as
a temporary hazard.
**Falafel** — hard. Bounces. `BOING → BOING → BOING` off walls, enemies, crates,
signs. Occasionally reaches the background and rings off the shawarma guy's tray.
He does not react.

Both route through the same radial-damage function as explosions, which is how a
knocked-over bowl can start a chain.

## The boss

The existing three-phase cycle already maps onto the design. What it needs is
the *background continuing* through all of it — that is the entire gag, and
right now the arena is empty.

- **Phase 1, the rant.** He is deadly serious. The screen is a food fight.
- **Phase 2, market chaos.** Hummus barrage, falafel storm, donkey charge, sheep
  stampede. The animals are not attacking anybody; they are inconvenient.
- **Phase 3, everything at once.** Every enemy type, every background actor,
  every projectile system, simultaneously.
- **The gag on defeat.** Everything stops. Silence. A sheep walks across. The
  coffee crew resumes. The shawarma guy resumes. A donkey walks past Abbasfat.
  They look at each other. Cut to black, then the score.

That silence is the most important half-second in the mini-game and it should be
built as a scripted beat, not an emergent one.

## Build order

Mechanics first, because none of it needs art to be playable or testable — the
existing code-drawn blocks stand in until PNGs land.

1. **Tile flags.** Convert `PlatformDef` to a bitmask now, before sections exist.
2. **The background layer.** An actor system with one rule: no player awareness.
   Cheapest big win in the whole list, and it is what makes the world read.
3. **The cast.** One enemy at a time, each with its own module and its comedy
   beat, so `gameScene.ts` does not grow.
4. **Hummus and falafel** on the shared radial-damage path.
5. **Animals** — donkeys and sheep as background actors that occasionally cross
   into play.
6. **The boss arena**, reusing all of the above, plus the scripted ending.
7. **Level validation in CI**, extending the reachability checks to real sections.

`gameScene.ts` is 2,077 lines across fifteen sections and must not absorb any of
this. Every item above is its own module; the scene orchestrates.

## The art

`docs/ASSETS-FLIGHT404.md` is the itemised list. It covers the climb,
destructibles, movers, effects and drops; **it does not yet cover this cast or
the background**, and needs a second pass once the behaviours are built and the
frame counts are known from what the animations actually do.
