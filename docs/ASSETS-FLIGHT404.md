# Flight 404 — what is still needed

**Read this section first. It supersedes the framing notes further down.**

The cabin is now **one row of scenery standing behind the action**, and the
game is played on an **aisle in front of it**. That single change fixes the
scale problem that made the first delivery read wrong, and it changes what some
of the remaining art has to be.

```
  y=0    ───────────────────────────────────────────  top of screen
         (ceiling / dark)
  y=48   ┌─────────────────────────────────────────┐
         │  THE CABIN — one row, background         │  bg-<section>-mid
         │  windows, seat backs, overhead bins      │  bg-<section>-far
  y=128  └─────────────────────────────────────────┘  ← CABIN_BASE
         ░░░ THE AISLE — everything playable ░░░       player, enemies,
  y=164  ═════════════════════════════════════════     crates, food, livestock
         (foreground lip)                              ← FLOOR_Y
  y=198  ───────────────────────────────────────────  bottom of screen
```

**One rule the player learns: if it is on the aisle, it is real.** Anything in
the cabin band is scenery and can never be shot, tripped over or stood on. That
is why the background can be as detailed as you like without confusing anybody.

## Scale, settled

The screen is **352 × 198 world units**, drawn on a 1056 × 594 canvas, so **1
world unit = 3 device pixels**. The player is **28 units** (~175cm), which
makes **1 unit ≈ 6cm**.

| thing | world units | pixels, if you draw at 3× |
|---|---|---|
| the player, standing | 28 | 76 |
| the aisle, floor to cabin base | 36 | 98 |
| the cabin band, top to base | 80 | 218 |
| a crate on the aisle | 20 | 55 |
| a donkey crossing | 22 | 60 |

Full-width strips stay **960 × 540** and are placed by the code.

## 1. Still missing — 16 files

These are on the list already and have not arrived. The crossings are the
"random stuff that gets in your way" — they run down the aisle, in front of the
cabin, and the player has to deal with them.

**Crossings** (walk cycle + one balk beat each, facing right, mirrored in code):

| id | size | frames |
|---|---|---|
| `cross-donkey` | 26 × 22 | 6 |
| `cross-sheep` | 34 × 18 | 6 |
| `cross-camel` | 32 × 34 | 8 |
| `cross-goats` | 30 × 18 | 6 |
| `cross-chickens` | 26 × 12 | 8 |
| `cross-cart` | 30 × 24 | 6 |
| `cross-tea` | 20 × 28 | 6 |
| `cross-rug` | 44 × 26 | 6 |
| `cross-bread` | 22 × 30 | 6 |
| `cross-bicycle` | 26 × 24 | 6 |

**Background residents** (stand still in the cabin band, never react):

| id | size | frames |
|---|---|---|
| `bg-coffee-crew` | 34 × 26 | 6 |
| `bg-donkey` | 26 × 22 | 6 |
| `bg-sheep` | 30 × 18 | 6 |
| `bg-porter` | 20 × 32 | 6 |
| `bg-argument` | 28 × 26 | 6 |
| `bg-duck` | — | 3 |

## 2. Needs re-cutting — the near layer

`bg-<section>-near` as delivered is a **full row of seat backs half a screen
tall**. At this framing it stands between the camera and the aisle: the player
fights behind a wall of upholstery and cannot see what they are shooting. It is
currently **not drawn at all**, which is why the bottom of the screen is empty.

Re-cut as a **thin foreground lip**: the very tops of the nearest seat backs, no
more than **30 world units (82px)** tall, sitting along the bottom edge with
transparency above. It should read as "the row you are running past", not as a
room you are behind.

## 3. New — the aisle itself

The strip the game is played on has no art at all yet. This is the most
valuable single file on this list, because it is on screen for the entire game.

| id | size | frames | notes |
|---|---|---|---|
| `dress-aisle` | 64 × 40 | 1 | Tileable horizontally. Carpet, runner, the odd stain. The top edge is where the cabin base meets it and the bottom is the screen edge. |
| `dress-aisle-wrecked` | 64 × 40 | 1 | Same, after a section has been fought through. Used in later cabins. |

## 4. New — obstacles on the aisle

Things the player has to get around, on their own plane. Each needs a rest pose
and a knocked-over pose; the game already has the physics for spilling food.

| id | size | frames | notes |
|---|---|---|---|
| `aisle-crate` | 20 × 20 | 1 | Cover you can shoot away. `crate.png` already delivered — this is the aisle-scale version if it reads too small. |
| `aisle-luggage` | 24 × 18 | 1 | A case somebody abandoned. Trip hazard. |
| `aisle-cart` | 22 × 26 | 1 | Parked drinks trolley. Already delivered as `cart.png`. |
| `aisle-spill` | 30 × 8 | 3 | A slick you slide on. The hummus system already draws one; this is the authored version. |
| `aisle-crate-broken` | 24 × 20 | 4 | Bursting apart. |
| `aisle-luggage-open` | 28 × 18 | 4 | Contents everywhere. |

## Frame counts: what you have is enough

The delivered frame counts are fine and do not need increasing. An 8-frame run
and a 4-frame idle are in the range the arcade games this is aiming at used.
When animation looked bad it was playback, not frames:

- Every state played at a flat 10fps, so a 2-frame flinch and an 8-frame run
  ran at the same rate.
- The run cycle was on a fixed clock instead of the character's actual speed,
  so the feet skated at every speed except the one it happened to suit.
- One-shot actions looped, so deaths animated forever and flinches strobed.
- The jump was a timed loop rather than a position in an arc.

All four are fixed in `skin.ts`, and these are the rates each state now plays
at. **Cut animations to read well at these speeds**, not at some other rate:

| state | fps | notes |
|---|---|---|
| idle, crouch, radio, tidy | 6–7 | slow enough to read as waiting |
| run | **speed-driven**, 4–30 | one cycle per stride pair; feet stay planted |
| jump | frame picked by velocity | 4 frames: rise, apex, fall, land |
| shoot, attack, flee | 16–18 | plays **once** and holds |
| hurt, throw, grab | 12–14 | plays **once** |
| die | 9 | plays **once**; the last frame is what stays on the floor |
| wind (telegraph) | 9 | deliberately slow — the player has to read it |
| stunned | 5 | |

Two consequences worth drawing to:

**The last frame of a one-shot is a resting pose.** A death's final frame is the
body lying there for the rest of the level, so it should work as a still.

**A run cycle should loop seamlessly at its midpoint** as well as its end, since
the rate varies with speed and the player will see it at all of them.

## What is already delivered and working

107 files, all loading. The cabins, the characters, the props, the drops, the
explosions, the food and the enemy cast are in the game and animating. Run
`npm run art` after any drop to see what landed.

---

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

Sections are `economy`, `galley`, `business`, `first`, `cockpit`.

### The framing rule, which is the thing to get right

**One plate is one screenful, and one screenful is 352 × 198 world units.** So
the scale is fixed: a thing drawn `N` pixels tall in a 540px plate is
`N × 198 / 540` world units in the game, and it has to agree with the sprite of
the same object.

That is the check worth doing before rendering fifteen of these. The player is
**28 world units** — about 175cm — so one world unit is roughly **6cm**, and
everything follows:

| object | world units | pixels in a 540px plate |
|---|---|---|
| the player, standing | 28 | **76** |
| an economy seat back | ~18 | **49** |
| a cabin window | ~14 | **38** |
| floor to overhead bins | ~106 | **289** |

A plate framed so the seats are twice that size is a plate where the player
reads as knee-high, which is not something you can see while drawing the plate —
there is no character in it to compare against. The first delivered set was
drawn about **2.3× too zoomed in**, measured against the same artist's own
`seat-row.png`: the seat sprite is 30 world units and the seats inside
`bg-economy-near.png` are about 70. Same object, two files, 2.3× apart.

**Rule of thumb: a 960 × 540 plate should show roughly 25 windows across.** If
it shows eight, it is framed for a cutscene rather than for a run-and-gun.


## Priority 8 — the cast

Six enemies, and every one of them is sold on a comedy beat that takes it out
of the fight. **The beat is the mechanic**, so the animation for it is not
decoration: if a player cannot tell at a glance that the Scalper has stopped
fighting to photograph a drop, the enemy is just a man who sometimes stops
shooting for no reason.

Every state below is a real state in `cast.ts` with a real duration, listed
here so an animation can be cut to length. Where a duration is given, that is
how long the sprite is on screen doing that and nothing else.

### Scalper — cannot help himself
Throws shoeboxes until something better lands on the floor.

| id | size | frames | notes |
|---|---|---|---|
| `scalper-approach` | 20 × 26 | 6 | Walk. Phone already half out. |
| `scalper-throw` | 22 × 26 | 5 | Readable wind-up, same as the thrower mook. |
| `scalper-photo` | 22 × 26 | 6 | **2.4s.** Both hands on the phone, crouched over the drop, back to the gunfight. The single most important animation in this tier — it is the whole character. |
| `scalper-grab` | 20 × 26 | 4 | **0.5s.** Stoops, pockets it, straightens. |
| `scalper-die` | 24 × 26 | 5 | |

### Hypebeast — commitment as a character flaw
Winds up, commits, and cannot steer out of it.

| id | size | frames | notes |
|---|---|---|---|
| `hypebeast-stalk` | 22 × 28 | 6 | Sizing you up. |
| `hypebeast-wind` | 24 × 28 | 3 | **0.45s.** The telegraph. The player is supposed to read this and move — make it unmistakable and make it the same length every time. |
| `hypebeast-charge` | 26 × 28 | 4 | **1.1s.** Head down, arms back, no steering. |
| `hypebeast-stunned` | 28 × 22 | 4 | **2.6s.** Face-down in a storefront, legs up. He takes **double damage** here, so this must look like an invitation. |
| `hypebeast-die` | 26 × 28 | 5 | |

### Reseller — the only one who can rob you
Fast — the fastest thing in the level, deliberately. Bags loot and runs.

| id | size | frames | notes |
|---|---|---|---|
| `reseller-seek` | 20 × 26 | 8 | Quick, low, scanning the floor. |
| `reseller-bag` | 20 × 26 | 4 | **0.6s.** Snatches, into the backpack. |
| `reseller-flee` | 22 × 26 | 8 | Sprint. Backpack visibly full. The player has **8 seconds** to shoot him before the loot is gone for good, so he must read as "that man is leaving with your things" instantly. |
| `reseller-drop` | 24 × 26 | 5 | Shot: the bag bursts and everything comes back out. The payoff for paying attention. |

### Mall Security — over-serious
Narrates the firefight to Control instead of ending it.

| id | size | frames | notes |
|---|---|---|---|
| `security-patrol` | 22 × 28 | 6 | Slow. Hands behind back where possible. |
| `security-baton` | 24 × 28 | 4 | |
| `security-radio` | 22 × 28 | 5 | **1.8s.** Radio to mouth, eyes middle-distance. A donkey may walk past behind him during this and **he must not react** — that is the joke and the code enforces it. |
| `security-die` | 26 × 28 | 5 | |

### Angry Shop Owner — the shelf wins
Throws his own stock at you, then turns his back to straighten a display.

| id | size | frames | notes |
|---|---|---|---|
| `owner-stock` | 22 × 28 | 4 | Behind the counter, furious. |
| `owner-throw` | 24 × 28 | 5 | Four throw props below, in a fixed order — the player learns the mannequin is coming and it still lands. |
| `owner-tidy` | 22 × 28 | 6 | **2s.** Back fully turned, squaring up a shelf, mid-firefight. |
| `owner-die` | 26 × 28 | 5 | |
| `throw-shoebox` | 12 × 8 | 1 | |
| `throw-mannequin` | 10 × 26 | 2 | Tumbling. The funny one. |
| `throw-display` | 14 × 12 | 2 | |
| `throw-basket` | 14 × 10 | 2 | |

### Falafel Guy — not an enemy, and the art must say so
He has no attack and the code makes one impossible. He must never read as a
target, or players will shoot him and feel cheated when nothing happens.

| id | size | frames | notes |
|---|---|---|---|
| `falafel-serve` | 22 × 26 | 6 | Working. Entirely uninterested in the gunfight. |
| `falafel-spill` | 30 × 26 | 6 | **1.2s.** Somebody hits the stand, the counter goes over, food is airborne. |
| `falafel-recover` | 26 × 26 | 6 | **3s.** Picking it all up, muttering. |

## Priority 9 — food, which is a weapon now

Hummus and falafel are separate physics objects because they are separate
jokes. Hummus arrives and stops; falafel arrives and leaves again.

| id | size | frames | notes |
|---|---|---|---|
| `hummus-blob` | 10 × 10 | 4 | In flight. Wobbling, not spinning — it is soft. |
| `hummus-splat` | 16 × 12 | 5 | Contact. Ends as the mark it leaves. |
| `hummus-smear` | 20 × 14 | 3 | Sitting on a surface, **4.5s**, fading over the last 1.2. The floor version is a **slick that the player slides on**, so it must be visible enough to be fair. |
| `hummus-drip` | 8 × 16 | 4 | The version that clings to a sign and sags. Total sag is ~21px. |
| `hummus-worn` | 14 × 10 | 2 | Riding an NPC's head, **3s**. He does not get to shake it off. |
| `falafel-ball` | 8 × 8 | 4 | Spins. Hard little object — it must not read as soft. |
| `falafel-bounce` | 10 × 10 | 3 | Squash on contact. Up to 8 bounces, each slower than the last. |
| `falafel-crumb` | 12 × 8 | 4 | Where it finally stops. |
| `bowl-roll` | 16 × 12 | 6 | A bowl rolling along the floor, looking for a slope. |
| `bowl-burst` | 28 × 22 | 7 | It stops, and stopping is what opens it. Catering-tub size gets the big version. |
| `tray-clang` | 20 × 16 | 3 | The shawarma guy's tray, rung. **He does not look up.** |

## Priority 10 — the background that ignores you

Eight kinds of people who are *structurally incapable* of noticing the player —
`stepActor` in `background.ts` takes no player argument at all, so awareness is
not merely discouraged, it cannot be expressed. Everything here must animate
like it is in a different film from the gunfight happening in front of it.

These are the "wait, why is there a donkey on this plane" tier, and they are
what turns a corridor shooter into the thing described in the brief. Each needs
an idle loop plus its beats; the beats fire every 12–34 seconds depending on
the kind, so they are noticed once and then become furniture, which is correct.

| id | size | frames | notes |
|---|---|---|---|
| `bg-coffee-crew` | 34 × 26 | 6 | Men round a fingjan on a burner. Beats: one points at the player *without urgency*; the pot goes round; one leans back to see past the fighting, then leans in again. |
| `bg-shawarma` | 24 × 30 | 6 | The spit and the man. **He never ducks** — everybody else does, and he does not. Keep his loop unbroken through explosions. |
| `bg-sweeper` | 18 × 26 | 6 | Sweeping the same patch. Beats: sweeps it again; examines it, unsatisfied. |
| `bg-balcony` | 30 × 24 | 4 | People leaning out to watch. Beats: somebody leans further; a second arrives; they go back inside, bored. |
| `bg-porter` | 20 × 32 | 6 | Carrying a stack taller than he is. Beats: the stack wobbles and does not fall; he adds one more; he peers around it. |
| `bg-argument` | 28 × 26 | 6 | Two men, then briefly three. Nothing is resolved. |
| `bg-donkey` | 26 × 22 | 6 | Walks. Beats: stops dead in the aisle; **stares at an enemy until he walks around it**; kicks a gate open. |
| `bg-sheep` | 30 × 18 | 6 | A small flock. Beats: one looks directly at the camera; one goes the wrong way; the flock bunches, then spills. |
| `bg-duck` | — | 3 | The one sanctioned reaction, shared: everybody drops for **2s** after a nearby blast, then carries on. Deliver as a duck/hold/rise for each kind above, or as one generic crouch if that is cheaper. |

## Priority 11 — dressing, by how wrong the plane has gone

The level walks through four tiers and never goes back: it starts as a plane,
stops making sense, becomes a market, and ends in bedlam. Dressing is how that
lands before a single line is read. Tiers are declared per section in
`content.ts`; the turn happens at section two.

| tier | reads as | dressing ids |
|---|---|---|
| `plane` | "I am on a plane." | `dress-seats`, `dress-bins`, `dress-windowwall`, `dress-carpet` |
| `wrong` | "I am on a plane. Why is there a donkey." | the above plus `dress-galleywall`, `dress-rug` |
| `shuk` | "This is a market. I am also still on a plane." | `dress-awning`, `dress-hangingcloth`, `dress-stalls`, `dress-lamps`, `dress-rug`, `dress-carpet` |
| `bedlam` | "Everyone is here and nobody is helping." | all of the above plus `dress-bunting` |

Each `dress-*` is a horizontally tileable strip with alpha, 64px wide, height to
suit. The important ones are `dress-hangingcloth` and `dress-awning`: they are
what make a fuselage read as a market while the seats are still visible behind
them. **The plane must never fully disappear** — the joke only works if you can
still tell you are on an aeroplane.


## Priority 12 — things that run through the cabin

The other half of the background, and the half that reaches the ordinary
cabin. A donkey **standing** in row 32 says the plane has lost; a donkey
**running the length of the aisle and out through the galley** says something
better — *wait, was that a donkey?* — and it works in an ordinary cabin
precisely because you cannot go back and check. It has gone.

So the regular cabin gets livestock after all. It just never gets to keep any.

Every one of these enters off-screen, crosses, and exits off-screen. They have
no hitbox, take no damage, and walk through a firefight without breaking
stride — a crossing that swerved around the player would be a game element
instead of a glimpse. All of them move slower than the player's 88px/s except
the chickens, so you can overtake one and look at it.

**Each needs a walk cycle and a balk** — the one thing it does mid-aisle,
listed below. The balk holds for 1.6s and fires at most once per crossing, so
it is the beat a player only catches if they happen to be looking, which is the
whole value of it. A delivered walk cycle with no balk is a sprite with the
joke removed.

| id | size | frames | speed | the balk — 1.6s, once per crossing |
|---|---|---|---|---|
| `cross-donkey` | 26 × 22 | 6 | 26 | It stops dead, for its own reasons. |
| `cross-sheep` | 34 × 18 | 6 | 22 | The flock bunches at nothing and spreads out again. |
| `cross-camel` | 32 × 34 | 8 | 20 | **It has to duck under the overhead bins, and does not enjoy it.** Too tall for the cabin is the entire bit — draw it at a height that makes the duck necessary. |
| `cross-goats` | 30 × 18 | 6 | 40 | One gets up on a seat back and is removed. |
| `cross-chickens` | 26 × 12 | 8 | 74 | They scatter, regroup, and continue as one. The only thing here faster than the player. |
| `cross-cart` | 30 × 24 | 6 | 18 | A wheel catches on the aisle runner. Vegetables, pushed by somebody who will not be hurried. |
| `cross-tea` | 20 × 28 | 6 | 30 | He pours one, over his shoulder, without looking or stopping. The brass urn on his back. |
| `cross-rug` | 44 × 26 | 6 | 16 | **It will not fit and has to be turned, twice.** The rolled carpet is longer than the aisle is wide — that is why it is 44px and why the balk is the best one on this list. |
| `cross-bread` | 22 × 30 | 6 | 28 | He adjusts the tray with one finger. Nothing falls. A tray of ka'ak carried flat on the head. |
| `cross-bicycle` | 26 × 24 | 6 | 62 | He rings the bell. Nobody moves. Through an aeroplane. |

Facing: deliver each walking **left to right**; the game mirrors it for the
other direction, and both directions happen equally often.

---

## What we are building against this

The terrain model, reachability maths and the mover/destructible definitions are
already in `components/minigames/phaser/flight404/terrain.ts`, with 21 checks in
`tests/flight404.test.mts`. The climb is arithmetic: one jump lifts 38.3px, no
rung asks for more than 34.3, and every platform in every section is verified
climbable from the floor.

Priorities 8–12 are in the same state. The six enemies are built and tested in
`cast.ts`, the food physics in `projectiles.ts`, the eight background kinds in
`background.ts`, the four-tier escalation in `creep.ts`, and the traffic in `crossings.ts` —
every duration
quoted above is read off a constant in one of those files rather than proposed
here, so an animation cut to the length given will match the game exactly.

Which means none of this is blocking. The levels can be built and played as
code-drawn blocks **now**, and each PNG above upgrades them in place as it
lands, one file at a time, with no code change and no manifest to edit. A
half-delivered set is not a broken build; it is a game where six things look
better than they did yesterday.
