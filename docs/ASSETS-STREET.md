# Street assets — Downhill Racer & Pizza Run

Two games, one street. **Downhill Racer** (`CartRace.tsx`) is a daytime chase
down a Californian hill; **Pizza Run** (`PizzaRun.tsx`) is a night delivery
shift on a suburban road. They are drawn the same way and share a world, so
almost everything that is not a vehicle or a building interior can be one file
used by both.

This document is written to be handed to an image generator. Every entry says
what the thing is, how big it is, **which direction it is seen from**, where its
origin sits, and what it has to line up with. The stylisation is yours; the
geometry is not, because it has to sit on a road drawn by code.

---

## 0. Read this before generating anything

### The camera, in one paragraph

Both games use a **3/4 rear-side view of a road that runs left-to-right across
the screen**. You are slightly above the road and slightly behind it, as if
standing on a first-floor balcony on the near side. The road's lanes are drawn
as **horizontal bands stacked up the screen**: a lane higher on screen is
*further away across the street*, not further down the road. Nothing is drawn in
true perspective — there is no vanishing point and no converging lines. Depth is
sold entirely by **stacking, scale and haze**.

**Every vehicle, animal, person and piece of street furniture is seen from the
side, in profile, facing right**, with a slight downward tilt so you can see a
little of its top surface — roughly a **20° high-angle side view**. The game
mirrors sprites for anything travelling the other way, so never draw a
left-facing variant.

**Buildings are the exception.** They are seen **flat-on, front elevation, no
perspective at all** — like a theatre flat. See §4.

### The three depth planes

| plane | what lives there | treatment |
|---|---|---|
| **far** | skyline, hills, towers | flattened, desaturated, hazy, no detail below ~4px |
| **mid** | far verge, far houses, palms | full colour, simplified, slight haze |
| **near** | road, player, traffic, near verge | full colour, full contrast, most detail |

### Scale, which is the thing that goes wrong

Everything is authored against **one standing adult = 22 pixels tall**.

| thing | pixels tall | notes |
|---|---|---|
| standing adult | **22** | the reference. Everything else is relative to this |
| one road lane, front to back | **12–18** | see the per-game note below |
| a saloon car, roof to road | **16** | it is *shorter* than a person is tall |
| a wheelie bin | **11** | chest height |
| a dog | **8** | |
| a cat | **5** | |
| a fire hydrant | **7** | |
| a palm trunk + crown | **44** | the tallest mid-plane object |
| a two-storey house facade | **46** | see §4 |

**Deliver every file at 3× these numbers.** A 22px adult is drawn 66px tall. The
games downscale by integer steps and the extra resolution survives the two
different logical resolutions below.

**The two games differ slightly and that is handled in code, not in the art:**
Downhill Racer is 320 × 180 logical with 18px lanes; Pizza Run is 352 × 198 with
12px lanes. Draw once at the sizes above and both games scale it.

### Origin and ground line — the single most common mistake

**Every ground-standing object's origin is bottom-centre, and its lowest opaque
pixel is where it touches the road.** No base shadow baked in — the games draw
their own soft ellipse, and a baked one double-darkens and looks like the object
is floating over a stain.

Trim every file to its content. No padding, no margin, no canvas border.

### Format

- **PNG, RGBA, genuinely transparent background.** Not white.
- One row per sheet, equal frame widths, zero padding.
- Sheets face **right**. The game mirrors.
- Drop at `assets/art/street/<id>.png`.

---

## 1. Traffic — both games

Seen from the side, facing right, 20° high angle so a strip of roof and bonnet
is visible. **Wheels must touch the bottom edge of the image.** No perspective
convergence: the far side of the vehicle is not visible at all.

| id | size | frames | description for the generator |
|---|---|---|---|
| `car-sedan` | 40 × 16 | 1 | A tired 1990s Japanese saloon, the colour of old dishwater, seen in right-facing profile from a slightly raised angle. Sun-bleached paint, a dented rear wing, one hubcap missing. Windows dark with a single specular streak. It reads as *parked and slightly abandoned*. Roof no taller than 16px so a standing adult clears it. |
| `car-taxi` | 40 × 16 | 1 | Same body and angle as `car-sedan` but a working city taxi: saturated yellow, black-and-white chequer stripe along the lower door line, a small illuminated roof sign. It drives *left*, so it will be mirrored — keep it symmetrical enough to survive that. Cleaner than the saloon, but not clean. |
| `car-door-open` | 22 × 18 | 3 | A car door swung open into the road, seen from the side, hinged at its left edge. Frame 1 is shut and flush, frame 2 is half open, frame 3 is fully open into traffic. Only the door and a sliver of the sill — **not the whole car**, which is drawn separately behind it. Interior side shows a worn grey panel and a window frame. |
| `car-van` | 48 × 20 | 1 | A blunt panel van in right-facing profile, high angle. Flat sides carrying a faded, unreadable trade sign. Two wheels, boxy roofline, tall enough to hide a person behind. Slight lean on worn suspension. |
| `car-wreck` | 42 × 14 | 1 | The saloon after a bad day: crumpled bonnet, one wheel splayed, bootlid sprung, glass gone. Same angle and footprint as `car-sedan` so it can replace it in place. Sits lower. |

---

## 2. Animals — both games

Side profile, facing right, walking. The games move them across lanes, so they
must read at a glance from their **silhouette alone** — these are small and they
are obstacles, so the player has to identify them in a fifth of a second.

| id | size | frames | description for the generator |
|---|---|---|---|
| `dog-stray` | 14 × 8 | 6 | A medium street dog trotting right, seen in flat side profile. Rangy, short-haired, ribs faintly visible, tail up and loose. Six-frame trot cycle: legs are the only thing that moves much; the body bobs about one pixel. Mongrel colouring — tan with a darker saddle. It is not menacing, it is *in the way*. |
| `dog-bark` | 15 × 9 | 4 | The same dog, planted with all four feet down, head up and barking to the right. Four frames: mouth shut, mouth open, mouth wide, mouth shut. Body does not travel. |
| `cat-street` | 10 × 5 | 6 | A lean street cat slinking right in side profile, body low and long, tail horizontal and slightly kinked. Tabby. Six-frame walk with the classic low, fluid cat gait. Smaller than everything else on the road — it must still be readable at 10px wide, so silhouette over detail. |
| `cat-dart` | 12 × 6 | 4 | The same cat at a flat-out sprint, body fully extended, tail straight back. Four frames. This is the version that crosses in front of you. |
| `pigeon-flock` | 18 × 8 | 5 | Four or five city pigeons on the ground pecking, seen from the side, then exploding upward. Frames 1–2 pecking, 3–5 the flock lifting off in a scatter. Grey with iridescent neck flecks. |
| `gull` | 10 × 6 | 4 | A herring gull in level flight, right-facing side profile, wings mid-beat. Four-frame slow flap. Drawn for the far plane — flatter and paler than everything else, almost a silhouette. |

---

## 3. Street furniture — both games

All seen from the side, facing right, 20° high angle. **Bottom edge is the
ground contact.** These are the things the player weaves, hops and ollies, so
their outline matters more than their surface.

| id | size | frames | description for the generator |
|---|---|---|---|
| `bin-wheelie` | 12 × 11 | 1 | A domestic wheelie bin in right-facing side profile, lid shut, two small wheels touching the ground. Municipal dark green, scuffed, a peeling house-number sticker. Chest height on an adult — no taller than 11px. |
| `bin-wheelie-down` | 16 × 8 | 1 | The same bin on its side after being hit, lid sprung, a small spill of rubbish at the open end. Same width footprint. |
| `roadworks` | 20 × 12 | 1 | A short run of roadworks: two orange-and-white striped barriers with a cluster of traffic cones, seen from the side. Slightly haphazard, as if placed in a hurry. One barrier leaning. A small amber lamp on top, unlit. |
| `roadworks-lamp` | 20 × 12 | 4 | Identical to `roadworks` but the amber lamp flashes: frames alternate unlit and lit, with the lit frames casting a small warm pool on the tarmac at its base. |
| `cone` | 6 × 7 | 1 | A single traffic cone, right-facing side profile. Orange with a grubby white reflective band. Slightly tipped. |
| `hydrant` | 6 × 7 | 1 | An American fire hydrant in side profile, squat and heavy, one side valve visible. Municipal red going chalky, a rust bloom at the base. |
| `hydrant-blown` | 18 × 20 | 5 | The same hydrant with its cap off, throwing a column of water up and to the right. Five-frame loop of the plume: the hydrant itself does not move. Water is a pale blue-white with visible droplet scatter, not a smooth jet. |
| `sprinkler` | 14 × 8 | 6 | A garden sprinkler on a verge, seen from the side, sweeping a fan of water right to left and back. Six frames covering one full sweep. The sprinkler head is tiny; the water is most of the image. |
| `planter` | 10 × 8 | 1 | A terracotta planter with an overgrown shrub, side profile, sitting on a pavement. Somebody's pride and a hazard. |
| `hedge-low` | 24 × 9 | 1 | A low clipped hedge running horizontally, side profile, tileable left-to-right so several can sit end to end. Dusty green, flat top. |
| `mailbox` | 8 × 10 | 1 | An American kerbside mailbox on a wooden post, side profile, flag down. Dented. |
| `streetlight` | 12 × 46 | 1 | A sodium streetlight: plain tapering post with a single cobra-head lamp cantilevered to the **right**. Bottom of the post is the ground contact. The lamp head is at the very top. Unlit version — the glow is drawn by code. |
| `trash-pile` | 16 × 7 | 1 | A heap of bin bags and loose rubbish against a kerb, side profile. Three or four black bags, a burst one, scattered paper. |
| `oil-slick` | 30 × 6 | 1 | A flat iridescent oil slick lying **on** the road, seen at the same high angle as everything else, so it is a squashed ellipse rather than a circle. Dark with a petrol-rainbow sheen at the edges. No height — it is a decal. |
| `manhole` | 12 × 5 | 1 | A cast-iron manhole cover set flush in the tarmac, squashed ellipse, seen at the road's angle. Worn tread pattern. |
| `skate-ramp` | 22 × 10 | 1 | A homemade plywood kicker ramp, side profile, ramp surface rising to the **right**. Raw ply with visible screw heads and one spray-painted tag. Low and wide — it is a launch, not a wall. |

---

## 4. Buildings — flat elevations, no perspective

**These are the exception to the 3/4 rule.** Buildings are drawn as **flat front
elevations, dead-on, zero perspective**, like painted theatre flats. They never
show a side wall, never converge, and never have a visible roof plane. This is
what lets the code stack them at any depth without them disagreeing with each
other.

Pizza Run puts houses on **both** verges. The far row rises **up** from its
ground line; the near row hangs **down** from its ground line and is seen from
slightly below. Draw each house **once, upright**, with its ground line at the
bottom edge — the code flips and positions them.

| id | size | frames | description for the generator |
|---|---|---|---|
| `house-bungalow` | 44 × 34 | 1 | A single-storey Californian bungalow, flat front elevation, dead-on. Stucco wall, a shallow pitched roof seen edge-on as a simple band, one front door centred, a window either side. A porch light beside the door. Modest, slightly shabby, lived-in. Ground line at the bottom edge — no lawn, no path, no shadow. |
| `house-twostorey` | 44 × 46 | 1 | The same street, two floors. Flat front elevation, dead-on. Front door and one window at ground level, two windows above. Clapboard or stucco. The upstairs windows must be **clearly separated and individually readable**, because the game throws pizza boxes through them. |
| `house-apartment` | 48 × 52 | 1 | A small three-storey walk-up. Flat elevation, external stair rising across the front, a row of identical windows per floor, air-conditioning units under some of them. Slightly grimmer than the houses. |
| `window-lit` | 10 × 10 | 1 | A single lit window as a standalone overlay: warm interior light, a suggestion of curtains or a blind, drawn to sit **on top of** any of the house facades above. Transparent everywhere outside the window frame. |
| `window-open` | 10 × 10 | 2 | The same window with the sash pushed up and a dark opening beneath it — the target for a trick shot. Frame 1 shut, frame 2 open. The opening has to be unmistakably *open* at a glance. |
| `door-front` | 10 × 14 | 2 | A front door as a standalone overlay for the facades. Frame 1 shut, frame 2 ajar with warm light spilling out. |
| `doormat` | 12 × 4 | 1 | A doormat lying flat on a doorstep, seen at the road's high angle so it is a squashed rectangle. This is the delivery target — it must be obvious and slightly comic. Coir brown, a worn unreadable word on it. |
| `garage-door` | 28 × 20 | 1 | A sectional garage door, flat elevation, four horizontal panels, one dented. |
| `fence-picket` | 24 × 10 | 1 | A run of picket fence, flat elevation, tileable left-to-right. Paint going. |
| `wall-breeze` | 24 × 12 | 1 | A run of breeze-block garden wall, flat elevation, tileable. Bare grey block, one patch of graffiti. |

---

## 5. The far skyline — flat, hazy, tileable

All of these are **flat elevations** like the buildings, but flattened further:
low contrast, desaturated toward the sky colour, and **no detail smaller than
2px**. They sit behind everything and scroll slowly.

| id | size | frames | description for the generator |
|---|---|---|---|
| `sky-towers` | 96 × 54 | 1 | A downtown cluster of five or six office towers of differing heights, flat dead-on elevation, **tileable left-to-right**. Windows as regular grids of small rectangles, most dark, a scatter lit. Silhouette-dominant: this reads as a shape on the horizon, not as architecture. Bottom edge is where the mid-ground meets it. |
| `sky-lowrise` | 96 × 30 | 1 | The nearer, lower band of the city: two- and three-storey commercial blocks, water tanks, roof aerials, a billboard frame. Flat elevation, tileable, slightly more contrast than `sky-towers`. |
| `sky-hills` | 128 × 26 | 1 | A soft ridge of dry Californian hills, tileable left-to-right. No detail at all — one flat mass with a slightly darker band along the top ridge. This is the furthest thing in either game. |
| `sky-billboard` | 26 × 20 | 1 | A roadside billboard on two legs, flat elevation, seen dead-on. The board itself is **blank** — the game draws its own copy onto it. Rusted frame, one working floodlight. |
| `sky-watertower` | 20 × 26 | 1 | A classic American water tower on splayed legs, flat elevation. Tank, ladder, a faded unreadable town name. |

---

## 6. Palms and planting

Palms are the signature of the hill. They are **flat elevations** too — a palm
has no meaningful side view.

| id | size | frames | description for the generator |
|---|---|---|---|
| `palm-tall` | 18 × 44 | 1 | A Californian fan palm, dead-on flat elevation. Bare scaly trunk with a slight lean to the right, a crown of eight or nine fronds, a skirt of dead brown fronds under the green. Trunk base is the ground contact at the bottom edge. |
| `palm-short` | 16 × 26 | 1 | A younger, squatter palm. Same treatment, thicker trunk, denser crown. |
| `palm-sway` | 18 × 44 | 4 | `palm-tall` with the crown moving in wind — four frames, trunk essentially static, fronds lifting and settling. Loop must be seamless. |
| `tree-street` | 20 × 32 | 1 | A generic municipal street tree — dusty, over-pruned, a metal guard around the base. Flat elevation. |
| `grass-verge` | 32 × 6 | 1 | A strip of dry verge grass, seen at the road's high angle, tileable left-to-right. Patchy, more dust than lawn. |

---

## 7. Road surface and markings

Seen at the road's own high angle. All tileable **left-to-right**.

| id | size | frames | description for the generator |
|---|---|---|---|
| `road-asphalt` | 64 × 18 | 1 | One lane's width of worn asphalt, tileable in both directions. Patchy repairs, a tar seam, faint tyre polish. Dark and low contrast — traffic has to read against it. |
| `road-centreline` | 32 × 3 | 1 | A dashed white centre line at the road's angle, tileable. Worn, not crisp. |
| `road-edgeline` | 32 × 2 | 1 | A solid edge line, tileable, more worn than the centre line. |
| `road-crack` | 24 × 6 | 1 | A patch of cracked and patched tarmac as a decal overlay, transparent around the damage. |
| `kerb` | 32 × 5 | 1 | A concrete kerb running left-to-right at the road's angle, tileable, showing the top face and the vertical drop to the road. Chipped. |
| `pavement` | 32 × 8 | 1 | Paving slabs at the road's angle, tileable, with visible joints and one cracked slab. |
| `drain-grate` | 10 × 4 | 1 | A kerbside gutter drain, squashed ellipse, seen at the road's angle. |

---

## 8. Downhill Racer only

| id | size | frames | description for the generator |
|---|---|---|---|
| `trolley-shopping` | 20 × 16 | 4 | A supermarket trolley in right-facing side profile at the road's high angle, seen **empty and from the side**, four small castors. Four frames of the castors spinning and the basket rattling. Chrome wire — drawn as a light open lattice, not a solid box, so the road shows through it. |
| `longboard` | 22 × 5 | 4 | A pintail longboard in right-facing side profile, deck almost horizontal, two trucks and four wheels. Four frames of wheel rotation. Deck underside carries a worn graphic. This is the *good* vehicle and should look it. |
| `ramp-plywood` | 22 × 10 | 1 | See `skate-ramp` in §3 — same asset, listed here because this game leans on it. |
| `trolley-bay` | 36 × 18 | 1 | A supermarket trolley bay: a steel corral with six or seven nested trolleys, right-facing side profile. This is a **wall** — it must read as solid and unjumpable. |
| `dust-plume` | 14 × 10 | 5 | A puff of dry roadside dust kicked up by a wheel, five frames expanding and thinning. Warm grey-brown, not white. |
| `sun-low` | 40 × 40 | 1 | A low sun disc with a soft halo, for the far plane. The game recolours it from gold to red as the hill descends, so deliver it **white and neutral** — any baked colour will fight the tint. |

---

## 9. Pizza Run only

| id | size | frames | description for the generator |
|---|---|---|---|
| `bmx` | 18 × 14 | 4 | A beaten BMX in right-facing side profile at the road's high angle. Four frames of wheel rotation. Pegs, one brake missing, a milk-crate rack bungeed over the back wheel. |
| `pizza-box` | 8 × 8 | 4 | A flat cardboard pizza box in mid-flight, tumbling. Four frames of rotation, seen from a three-quarter angle so it reads as a *flat object spinning* rather than a square. Grease-spotted, an unreadable logo. |
| `pizza-box-landed` | 10 × 5 | 1 | The same box lying flat on a doormat, seen at the road's high angle. Slightly askew. |
| `pizza-stack` | 10 × 12 | 1 | Four or five boxes stacked, side profile, for the rider's back rack and the HUD. |
| `restock-crate` | 14 × 12 | 1 | A wooden crate of pizza boxes sitting in the road, side profile, lid off, boxes visible inside. Must read as *pick this up* rather than *avoid this* — brighter and cleaner than the hazards. |
| `streetlight-glow` | 40 × 40 | 1 | A soft circular sodium glow as a standalone additive overlay, warm amber, fading to fully transparent at the edge. No lamp in it — this sits under `streetlight`. |

---

## 10. Shared effects

| id | size | frames | description for the generator |
|---|---|---|---|
| `impact-star` | 12 × 12 | 5 | A cartoon impact burst — a ragged star expanding and fading. Five frames. White-hot core going to warm orange. |
| `skid-mark` | 20 × 4 | 1 | A black rubber skid decal at the road's angle, transparent around it, tileable end to end. |
| `speed-lines` | 32 × 12 | 3 | Horizontal motion streaks for the edges of the screen at speed. Three frames. Nearly transparent. |
| `splash-water` | 14 × 10 | 5 | A shallow splash from riding through water, five frames rising and falling. Pale blue-white. |
| `feather-puff` | 10 × 8 | 4 | The puff of feathers left when you clip the pigeons. Four frames drifting down. |

---

## Delivery checklist

- [ ] Right-facing. The game mirrors; never supply a left-facing twin.
- [ ] Bottom edge is the ground contact, for everything that stands on the road.
- [ ] No baked drop shadow.
- [ ] Buildings, skyline and palms are **flat dead-on elevations**. Everything
      else is a **20° high-angle side view**.
- [ ] Transparent background, trimmed to content, no padding.
- [ ] Authored at 3× the sizes in this document.
- [ ] Sheets are one row, equal frame widths, no gutters.
- [ ] A standing adult is 22px (66px at 3×). Check every object against that
      before exporting — it is the only measurement that matters.
