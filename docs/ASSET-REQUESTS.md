# Asset requests

Everything the game currently draws is **code-defined pixel art** — sprites are
authored as rows of single characters that index `systems/sprites/palette.ts`
(see `data/sprites/*.ts`). That was the right call to get 94 sprites in without
a single binary file, and it will stay the fallback forever. But code-art has a
ceiling, and the downhill race and the rooftop artillery game are both above it.

This document is the shopping list. Anything here that arrives as a PNG gets
swapped in without touching game logic: `systems/sprites/registry.ts` resolves a
sprite id to a PNG first and falls back to the coded sprite when the PNG is
absent, so **partial delivery is fine** — one file at a time improves the game
and nothing breaks while the rest is missing.

## How to deliver

- **Format**: PNG, RGBA, no interlacing. Nearest-neighbour only — never
  bicubic-scale pixel art up.
- **Drop location**: `public/art/<category>/<sprite-id>.png`. The id must match
  the table below exactly, lowercase-with-hyphens.
- **Sprite sheets**: frames laid out **left to right in one row**, every frame
  the same width, zero padding and zero margin between frames. Name it
  `<id>.png` and put the frame count in the filename only if it differs from
  the table: `<id>@6.png`.
- **Scale**: author at **1x** (the pixel grid in the table). The engine upscales
  by integers at runtime. If you can only produce 4x, that is fine — give exact
  multiples of 4 so it downsamples cleanly.
- **Transparency**: real alpha, not magenta keying. Anti-aliased edges are
  acceptable for backgrounds, but characters and items should have hard edges.
- **Palette**: not enforced for PNGs, but the game's world is a dark CRT
  (`#07090c` ground, `#00e5c0` phosphor accent, `#ff2e88` magenta, `#ffcc4d`
  gold). Art that ignores this will read as pasted-in. Grounding every piece on
  near-black with one saturated accent is the whole look.
- **Backgrounds** are the exception to the pixel grid: deliver parallax layers
  at 960x540 or 1920x1080, each layer its own PNG with alpha.

---

## Priority 1 — the downhill race

This is the set-piece. It should look like a real game, not a canvas demo.
Everything else on this list can wait behind it.

| Id | Grid | Frames | What it is |
| --- | --- | --- | --- |
| `cart-rider` | 32x40 | 8 | Player crouched in a shopping cart, one arm out for balance. Frames: 2 neutral, 2 lean-left, 2 lean-right, 1 airborne, 1 wipeout. |
| `cart-longboard` | 32x40 | 8 | Same rider, same frame order, on a longboard. This is the upgrade path — it must read as *obviously cooler* at a glance. |
| `cart-shadow` | 24x8 | 1 | Soft ellipse. Sells the airtime. |
| `obs-cone` | 16x20 | 2 | Traffic cone. Frame 2 = knocked flat. |
| `obs-bin` | 24x28 | 3 | Trash can. Frame 2 = tipping, frame 3 = burst with rubbish out. |
| `obs-hydrant` | 16x20 | 3 | Fire hydrant. Frame 3 = spraying. |
| `obs-car` | 64x32 | 2 | Parked car, side profile. Frame 2 = door open into the road. |
| `obs-pedestrian` | 20x32 | 4 | Civilian walk cycle, oblivious. |
| `obs-grate` | 32x8 | 1 | Storm drain, flat on the road — a slow-down, not a crash. |
| `pickup-coin` | 12x12 | 6 | Spinning cash/coin. |
| `pickup-boost` | 16x16 | 4 | Energy can (reuse the AM/PM can read). |
| `road-tiles` | 32x32 | 12 in one sheet | Asphalt, centre line, crosswalk, kerb-left, kerb-right, manhole, patch, tram track, oil slick, gravel, paint arrow, pothole. |
| `bg-city-far` | 1920x1080 | 1 | Skyline silhouette, near-black, a few lit windows. |
| `bg-city-mid` | 1920x1080 | 1 | Storefronts and signage, alpha above the roofline. |
| `bg-city-near` | 1920x1080 | 1 | Parked cars, poles, bus shelters — the fast layer. |
| `bg-city-sky` | 1920x1080 | 1 | Gradient plus haze. One dusk version, one night version if you have the appetite. |

**The Game** (the NPC you are racing) needs his own rider sheet, `the-game-cart`,
same 32x40 / 8 frames, visually distinct from the player at speed — silhouette
difference, not just palette.

## Priority 2 — rooftop artillery (the Gorillas game)

| Id | Grid | Frames | What it is |
| --- | --- | --- | --- |
| `tower-block` | 48x16 | 6 | Stackable skyscraper slices, so towers build to any height. Variants: glass, brick, concrete, billboard, water-tower cap, antenna cap. |
| `tower-damage` | 48x16 | 4 | Destruction overlay, progressive — clean → cracked → holed → collapsed. |
| `arc-shoe` | 16x10 | 4 | Thrown sneaker, tumbling. |
| `explosion` | 48x48 | 9 | Single explosion sheet. This one asset does more for the feel of the game than any other on this page. |
| `smoke-puff` | 32x32 | 6 | Lingering smoke, alpha fade. |
| `debris` | 8x8 | 4 | Chunks. Cheap and very effective. |
| `wind-arrow` | 64x16 | 1 | UI, stretched horizontally by wind strength. |
| `bg-skyline-night` | 1920x1080 | 1 | Backdrop with a visible moon and gradient. |

## Priority 3 — the shoes themselves

45 models currently resolve to **10 side-profile silhouettes** plus a palette
swap, which is how a real sneaker line works. If you have better shoe art, the
swap-in is trivial: keep the side profile, toe on the **left**, heel on the
right, sole on the bottom rows.

| Id | Grid | What it is |
| --- | --- | --- |
| `shoe-lowtop` | 24x12 | AF1 / Dunk |
| `shoe-hightop` | 24x12 | Jordan 1 |
| `shoe-runner` | 24x12 | Dad-shoe runner |
| `shoe-chunky` | 24x12 | Overbuilt chunky trainer |
| `shoe-foam` | 24x12 | Foam clog |
| `shoe-knit` | 24x12 | Knit sock-runner |
| `shoe-skate` | 24x12 | Flat vulcanised skate shoe |
| `shoe-boot` | 24x12 | Work boot |
| `shoe-slide` | 24x12 | Slide |
| `shoe-slipon` | 24x12 | Slip-on |
| `shoe-grail` | 24x12 | The one legendary silhouette — it may break the rules |
| `shoe-box` | 24x20 | Shoe box, lid on |

If you deliver these at **48x24** instead (2x), say so and they will be wired at
2x — bigger shoe art is a straight upgrade to every store card in the game.

A **hero render** per legendary model (128x64, 3/4 view rather than flat side)
would let the acquisition moment for a grail actually land. Six of those beats
forty-five flat ones.

## Priority 4 — the cast

Currently 16x24 portraits. Named characters who carry scenes and would gain the
most from real art, in order:

`bibi`, `donald-drip`, `adc`, `bro-jogan`, `the-game`, `yasser`, `wiz-k`,
`gutter-gabe`, `scalper-sid`, `grandma-laces`, `clerk`, `cop`, `tsa`, `hostage`,
`crowd-a`, `crowd-b`, `mook-charger`, `mook-thrower`, `player`.

Two useful sizes:
- **`portrait/<id>.png` — 64x80, 1 frame.** Dialogue bust. This is the high-value
  one: every conversation in the game shows it.
- **`actor/<id>.png` — 24x32, 6 frames** (2 idle, 2 walk, 1 react, 1 down) for
  anyone who appears in a mini-game.

## Priority 5 — per-store identity

Each of the 17 stores has its own layout, palette and fonts already. What would
push them over the line, per store id (see `data/stores.ts`):

- **`sign-<store-id>.png`, 256x64** — the shop's own signage, in its own type.
- **`bg-<store-id>.png`, 960x540** — interior backdrop at low contrast; the UI
  sits on top of it, so it must stay dark and quiet.

Highest impact first: the Tokyo and Tel Aviv stores, then LA.

## Priority 6 — the other arcade games

Lower priority because these already read acceptably, but each would take a jump:

- **`street-ball`** — `court-floor` (64x64 tile), `hoop` (48x48, 4 frames for the
  net), `ball` (12x12, 4 frames), `crowd-row` (256x32, 3 frames).
- **`street-brawl`** — two fighter sheets at 48x56, 10 frames (idle x2, walk x2,
  punch, kick, block, hit, KO, taunt), plus `bg-alley` (960x540).
- **`flight-404`** — `cabin-tiles` (32x32 sheet: seats, aisle, overhead bin,
  galley, cockpit door, window), `soldier` and `hostage` actors at 24x32.
- **`pizza-run`** — `iso-street` (64x32 iso tiles), `house` (64x64, 3 variants),
  `pizza-box` (12x12, 4 frames spinning), `custy` (20x28, 4 frames).

## Audio

No audio at all right now, which is the single largest gap between this and
something that feels like an arcade game.

- **SFX**, mono WAV or OGG, short: `coin`, `cash-register`, `buy`, `sell`,
  `deny`, `menu-move`, `menu-select`, `punch`, `hit`, `ko`, `whistle`,
  `crowd-cheer`, `crowd-groan`, `swish`, `rim`, `explosion`, `crash`,
  `car-horn`, `sneaker-squeak`, `skate-roll` (loop), `cart-rattle` (loop),
  `wind` (loop), `siren`, `phone-buzz`, `toilet-flush`, `fart` (yes), `door`,
  `alarm`.
- **Music**, OGG, seamless loops, 60-120s each: a boom-bap overworld loop, a
  synthwave travel loop, a tense loop for Flight 404, a downhill-race driving
  loop, a lounge loop for the podcast, and one 10-second victory sting.

Deliver into `public/audio/sfx/` and `public/audio/music/`.

## Fonts

The game uses Bungee, Press Start 2P, Rajdhani and IBM Plex Mono. If you want
per-store type identity, what is needed is **2-4 additional display faces** with
open licences (OFL or public domain), in these registers: a chunky graffiti
face, a condensed 80s sportswear face, a brushy Japanese-signage-adjacent face,
and a deliberately ugly corporate face for the ADC's paperwork. Drop TTF/WOFF2
into `public/fonts/` and name the family in the request — wiring is one line per
face.

---

## What is NOT needed

To save you effort: do not produce UI chrome, panels, borders, buttons, meters
or icons. All of that is CSS from `styles/theme.css` and is deliberately vector
so it stays sharp at every size. Art is only wanted for **the world**: shoes,
people, places, and the mini-games.
