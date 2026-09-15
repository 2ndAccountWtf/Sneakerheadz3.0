# Flight 404 — asset list

Everything the cabin overhaul needs, itemised. Delivery rules (format, palette,
sheet layout) are in `docs/ASSET-REQUESTS.md` — the short version:

- **PNG, RGBA, hard edges, authored at 1x on the pixel grid below.**
- **Drop at `assets/art/flight404/<id>.png`.** The build globs that folder. An
  id must match the table exactly. *(If you have seen `public/art/` written
  anywhere, that was wrong and is now corrected — the registry only reads
  `assets/art/`.)*
- **Sheets are one row, left to right, equal frame widths, zero padding.** Put
  the frame count in the filename when it differs from the table: `<id>@6.png`.
- **Partial delivery is fine.** Each file swaps in on its own and the code-drawn
  version stays until it arrives. Nothing breaks while the rest is missing.
- The cabin is a dark CRT: near-black ground, one saturated accent per piece.

The view is **352 × 198** and the player is **26px tall**, so these are small.
Sizes below are the drawn box, not the canvas — trim to content and keep the
origin at the sprite's feet (bottom-centre) unless noted.

---

## Priority 1 — the climb

The reason the game currently feels like a corridor: there is a jump button and
nothing to land on. Four rungs, 26–27px apart, floor at y=164 up to the bins at
y=58. These are the most valuable pieces on this list.

| id | size | frames | notes |
|---|---|---|---|
| `seat-row` | 34 × 30 | 1 | A double seat seen from the side. The cushion is rung 1, the top of the back is rung 2. Needs a readable flat top on both. |
| `seat-row-wrecked` | 34 × 30 | 1 | Same seat after the cabin has been fought through. Used in later sections. |
| `galley-counter` | 48 × 26 | 1 | Rung 3. Flat top, kick panel below, one open shelf. |
| `bin-closed` | 48 × 16 | 1 | Rung 4, the overhead locker. This is where the throwers perch. |
| `bin-open` | 48 × 22 | 1 | Same bin hanging open, contents spilling. Also the "destroyed" state of `bin-door`. |
| `bulkhead-ledge` | 40 × 20 | 1 | Class-divider ledge. Solid, not jump-through. |

## Priority 2 — things that break

Cover until you shoot it, which is the point: you and the throwers want the same
furniture. Every one needs **idle → hit → destroyed**, plus debris.

| id | size | frames | notes |
|---|---|---|---|
| `crate` | 20 × 20 | 1 | Duty-free cases taped into a stack. |
| `crate-hit` | 20 × 20 | 2 | One frame cracked, one frame worse. |
| `crate-debris` | 24 × 24 | 5 | Bursts apart and settles. Last frame can be empty. |
| `cart` | 22 × 26 | 1 | Parked drinks trolley. Already in the game as static cover. |
| `cart-hit` | 22 × 26 | 2 | Dented, door swinging. |
| `cart-debris` | 32 × 28 | 6 | Cans everywhere. The best explosion on the list — make it count. |
| `cooler` | 24 × 22 | 1 | Galley cooler. The toughest prop; it should look it. |
| `cooler-hit` | 24 × 22 | 2 | |
| `cooler-debris` | 30 × 26 | 5 | Ice and steam. |
| `monitor` | 12 × 10 | 1 | Seat-back screen showing the moving map. |
| `monitor-debris` | 14 × 12 | 4 | Glass. Pure joy, drops nothing. |

## Priority 3 — things that move

A level where only enemies move is a shooting gallery.

| id | size | frames | notes |
|---|---|---|---|
| `trolley-runaway` | 22 × 26 | 4 | A loose trolley rolling down the aisle. Wheels turning, slight wobble. Hurts on contact. |
| `belt-segment` | 16 × 10 | 4 | Baggage belt, tiling horizontally. Frames scroll the treads so the loop reads as motion. Carries whatever stands on it. |
| `bin-swing` | 48 × 22 | 5 | A bin door swinging open and shut. A rung that arrives on a schedule — the open frames must be unmistakably standable. |

## Priority 4 — feedback

Small, and they do more for "feel" than anything else here.

| id | size | frames | notes |
|---|---|---|---|
| `muzzle-flash` | 12 × 10 | 3 | |
| `impact-spark` | 10 × 10 | 4 | Bullet on metal. |
| `explosion-small` | 24 × 24 | 7 | Prop destruction. |
| `explosion-big` | 40 × 40 | 9 | The cart, and the boss. |
| `dust-puff` | 12 × 8 | 4 | Landing from a jump. Sells the weight of the climb. |
| `pickup-shine` | 16 × 16 | 6 | Loops under a dropped item. |

## Priority 5 — drops

| id | size | frames | notes |
|---|---|---|---|
| `drop-ammo` | 12 × 12 | 2 | Gentle bob. |
| `drop-health` | 12 × 12 | 2 | |
| `drop-speed` | 12 × 14 | 2 | An energy drink can. |
| `drop-lighter` | 10 × 12 | 2 | Already meaningful — it lights the dark sections. |

## Priority 6 — the characters

Not required for the cabin work to ship, and **this is the tier that decides
whether the game looks like Metal Slug.** That game's grunts have dozens of
frames and die differently depending on what killed them. Frame counts here are
the honest minimum; more is better on every row.

| id | size | frames | notes |
|---|---|---|---|
| `player-idle` | 20 × 28 | 4 | Breathing. |
| `player-run` | 22 × 28 | 8 | The one everybody sees most. |
| `player-jump` | 22 × 28 | 4 | Rise, apex, fall, land. |
| `player-crouch` | 20 × 16 | 2 | Crouch height is 15px — real cover. |
| `player-shoot` | 24 × 28 | 3 | Standing. Needs an aim-up variant. |
| `player-shoot-up` | 22 × 30 | 3 | |
| `player-hurt` | 22 × 28 | 2 | |
| `player-die` | 26 × 28 | 6 | |
| `mook-charger-run` | 20 × 26 | 6 | Runs at you. |
| `mook-charger-die` | 24 × 26 | 5 | |
| `mook-thrower-idle` | 20 × 24 | 4 | Perches on the bins. |
| `mook-thrower-throw` | 22 × 24 | 5 | **Needs a readable wind-up** — the telegraph is what makes a death feel fair. |
| `mook-thrower-die` | 24 × 24 | 5 | |
| `hostage-tied` | 16 × 26 | 3 | Struggling. |
| `hostage-freed` | 18 × 26 | 5 | Runs off cheering. |
| `yasser-idle` | 34 × 40 | 4 | The boss. |
| `yasser-throw` | 40 × 40 | 6 | |
| `yasser-charge` | 40 × 40 | 6 | |
| `yasser-defeat` | 44 × 40 | 8 | |

## Priority 7 — backgrounds

Parallax layers, not on the pixel grid — deliver at 960 × 540 with alpha, each
layer its own file. One set per section (`economy`, `galley`, `business`,
`first`, `cockpit`).

| id | notes |
|---|---|
| `bg-<section>-far` | Windows, and whatever is outside them. Scrolls slowest. |
| `bg-<section>-mid` | Cabin walls, lockers, signage. |
| `bg-<section>-near` | Foreground seat rows the player passes behind. |

---

## What we are building against this

The terrain model, reachability maths and the mover/destructible definitions are
already in `components/minigames/phaser/flight404/terrain.ts`, with 21 checks in
`tests/flight404.test.mts`. The climb is arithmetic: one jump lifts 38.3px, no
rung asks for more than 34.3, and every platform in every section is verified
climbable from the floor. So the levels can be built and played as code-drawn
blocks **now**, and each PNG above upgrades them in place as it lands.
