# Street assets — Downhill Racer & Pizza Run

Two games, one street. **Downhill Racer** (`CartRace.tsx`) is a daytime chase
down a Californian hill. **Pizza Run** (`PizzaRun.tsx`) is a night delivery
shift on a suburban road. They are drawn the same way and share a world, so
almost everything that is not a vehicle or a building can be one file used by
both.

**This document is written to be fed to an image generator.** Every asset is a
block with the same fields, and the fields exist because each one is a mistake
that cannot be corrected after generation:

- **View** — the camera angle. Mixing angles is unfixable.
- **Faces** — which way it points. Always right; never supply a mirror.
- **Ground** — which edge touches the road. Getting this wrong makes it float.
- **Frames** — what changes, frame by frame, and which way the motion runs.
- **Not** — what it must not look like. Generators drift toward these.

The stylisation is yours. The geometry is not, because it has to sit on a road
drawn by code.

---

# PART ONE — THE RULES

Read all of this. Every rule here has an asset below that depends on it.

## 1.1 The camera

Both games look at a **road that runs left-to-right across the screen**, from a
position **slightly above it and slightly on the near side** — about the view
from a first-floor balcony across the street.

The road's lanes are **horizontal bands stacked up the screen**. A lane higher
on screen is **further away across the street**, not further down the road.

**There is no perspective.** No vanishing point, no converging lines, no
foreshortening along the road. Depth is sold by three things only: **stacking,
scale, and haze.** An object drawn with converging sides will visibly disagree
with the road it is standing on.

## 1.2 The two view types — this is the one that ruins files

Every asset is drawn from **one of exactly two views**. There is no third, and
mixing them is the mistake that cannot be fixed afterwards.

### VIEW A — "high-angle side view" (20° above horizontal)

Used for: **everything that stands on or moves along the road.** Vehicles,
animals, people, bins, hydrants, cones, ramps, road decals.

Concretely, this means: you see the object's **side, in full profile**, plus a
**shallow sliver of its top surface** — about a fifth of the depth of the object.
On a car you see the whole flank, plus a strip of bonnet, roof and boot. **You do
not see the far side of the object, the far wheels, or any of its back.** A flat
decal lying on the road (an oil slick, a manhole) becomes a **squashed ellipse**,
roughly 1 unit tall for every 3 wide, never a circle.

### VIEW B — "flat elevation" (dead-on, 0°)

Used for: **buildings, skyline, palms, trees, fences, walls.**

Concretely: the front face only, square to camera, like a painted theatre flat.
**No side walls. No roof plane. No convergence. No visible depth at all.** A
building drawn with a receding side wall cannot be placed by the code at more
than one depth, which is the whole reason this rule exists.

## 1.3 Facing

**Everything faces right.** The game mirrors sprites horizontally for anything
travelling the other way, so never supply a left-facing version.

Two consequences:

- **Do not put text, logos or numbers on anything that moves.** They will be
  drawn backwards half the time. Signage goes on buildings, which never mirror.
- **Asymmetric details will flip.** A dent on the left flank becomes a dent on
  the right. That is fine; just do not build the read of the object on it.

## 1.4 The ground line

**For VIEW A objects and VIEW B objects on the far side of the street: the
bottom edge of the image is where the object touches the ground.** Its lowest
opaque pixel is the contact point.

**For the near row of houses in Pizza Run, this is inverted — see §5.2.** Those
are the only assets in the set whose ground line is at the top.

**Never bake a drop shadow.** The games draw their own soft ellipse under
everything. A baked one double-darkens and reads as the object hovering over a
stain.

## 1.5 Lighting — shared assets are used day AND night

Most of this set appears in a **daytime hill that warms to sunset** and in a
**sodium-lit night street**. That means:

- **Light everything with soft, near-neutral top-down ambient.** A gentle
  lighter top and darker underside, and nothing more.
- **No strong directional key light. No long cast shadows. No baked sunset or
  moonlight.** The games tint at runtime; baked colour temperature fights the
  tint and the object stops belonging to the scene.
- **No baked reflections of a specific sky**, because there are two skies.
- Assets in §7 (Downhill only) and §8 (Pizza Run only) may commit to their
  game's light. Everything else must not.

Downhill Racer's sun sits on the **right** of the screen and slides down as the
hill descends, going gold to red. Pizza Run is deep blue-black with warm amber
pools under the streetlights. Shared art has to survive both.

## 1.6 Scale — pinned to one number

**A standing adult is 22 pixels tall.** Everything is relative to that, and every
size below was derived from it. Check every object against this before exporting;
it is the only measurement that matters.

**A standing adult is 23 pixels tall.** That is measured, not chosen: Pizza Run
draws its rider at 23 and Downhill Racer draws its player at 26 on the nearest
lane, scaling to 21 on the furthest. 23 is the number both games agree on.

| thing | px tall | px wide | sanity check |
|---|---|---|---|
| **standing adult** | **23** | ~10 | **the reference** |
| saloon car, road to roof | **19** | 34 | **shorter than a person** |
| panel van | **23** | 42 | exactly head height |
| wheelie bin | **12** | 10 | half a person — chest height |
| traffic cone | **7** | 6 | knee height |
| fire hydrant | **8** | 6 | knee height |
| dog | **9** | 15 | above the knee |
| cat | **6** | 11 | ankle to mid-shin |
| single-storey house | **34** | 44 | 1.5 people |
| two-storey house | **46** | 44 | 2 people |
| palm, trunk and crown | **44** | 18 | 2 people |
| one road lane, near to far | **12–18** | — | a car is wider than one lane |

**A note on the vehicle proportions.** 34 × 19 is a **deliberately stubby,
arcade-proportioned car** — about 1.8 : 1. A real saloon is closer to 3 : 1, and
a generator left to itself will draw the realistic one. It will look wrong here,
because it will be nearly a third of the screen wide. Every vehicle in this set
is squashed toward square on purpose.

**Deliver every file at 3×.** A 23px adult is drawn 69px tall. The two games run
at different logical resolutions (320 × 180 and 352 × 198) and currently
disagree slightly about vehicle scale; the extra resolution lets both use one
file. **Author to the table above and the code will fit it.**

## 1.7 Tiling

Anything marked **tileable** must be seamless **left-to-right**: the right edge
continues into the left edge with no visible join.

**Three of them also tile top-to-bottom**, because the game lays them down as a
surface rather than as a strip: `road-asphalt`, `pavement` and `grass-verge`.
The road is deeper than one tile of asphalt, so the code repeats it downward as
well — which means the bottom edge has to continue into the top edge too, or
there will be a horizontal seam every 18px across the tarmac. Everything else
marked tileable repeats horizontally only.

These surfaces are drawn **at their own pixel size**, never stretched: a 64 × 18
patch of asphalt is laid down as 64 × 18 game pixels however deep the road is.
So author them at the sizes given and they will land exactly as drawn. (Objects
— a hedge, a fence run, a horizon strip — are the same: authored size, repeated,
not scaled to fit a band.)

Keep the tiling pattern irregular. A strip that repeats an obvious feature every
32px turns into a visible drumbeat once it scrolls.

## 1.8 Format

- **PNG, RGBA, genuinely transparent background.** Not white. Not a checkerboard.
- Trimmed to content — no padding, no margin, no border.
- Sheets are **one row**, left to right, **equal frame widths, zero gutters**.
- Drop at `assets/art/street/<id>.png`.
- Multi-frame files may be named `<id>@6.png`; if the frame count matches this
  document, the suffix is optional.

---

# PART TWO — THE ASSETS

Every block below uses the same fields. **View**, **Faces** and **Ground** are
the three that cannot be fixed after generation — if only three lines get read,
read those.

---

## 2. Traffic

### `car-sedan` — 34 × 19, 1 frame
- **What:** A tired 1990s Japanese saloon the colour of old dishwater. Sun-bleached paint, a dented rear wing, one hubcap missing, windows dark with a single specular streak. It reads as *parked and slightly abandoned*, not as a car about to drive off.
- **View:** A — 20° high-angle side view. Full flank visible, plus a shallow strip of bonnet, roof and boot. The far side of the car and its far wheels are **not visible at all**.
- **Faces:** Right. Bonnet at the right edge, boot at the left.
- **Ground:** Bottom edge. Both visible wheels touch it.
- **Not:** Not realistic car proportions — 1.8 : 1, deliberately stubby. Not shiny or new. No text or badges anywhere (it gets mirrored). No cast shadow.

### `car-taxi` — 34 × 19, 1 frame
- **What:** A working city taxi. Saturated yellow, black-and-white chequer stripe along the lower door line, small illuminated roof sign, cleaner than the saloon but not clean.
- **View:** A — identical angle and footprint to `car-sedan`, so the two can swap in place.
- **Faces:** Right. **This one drives left in the game and is mirrored**, so keep the silhouette readable either way and put nothing directional on it.
- **Ground:** Bottom edge, both wheels.
- **Not:** No readable "TAXI" lettering — the game draws its own, and yours would be backwards half the time.

### `car-van` — 42 × 23, 1 frame
- **What:** A blunt panel van. Flat slab sides carrying a faded, **unreadable** trade graphic — shapes and a colour block, no letters. Boxy roofline, worn suspension giving it a slight nose-down lean.
- **View:** A — 20° high angle. Flank plus a strip of roof.
- **Faces:** Right.
- **Ground:** Bottom edge. Exactly head height on an adult — a person standing behind it is hidden to the shoulders.
- **Not:** Not a box truck. Not taller than 23px.

### `car-door-open` — 20 × 16, 3 frames
- **What:** A car door swung out into the road. **Only the door and a sliver of the sill** — the car body behind it is a separate asset. Interior face shows a worn grey panel, a window frame and an armrest.
- **View:** A — 20° high angle, hinged at its **left** edge so it opens toward the right, into oncoming traffic.
- **Faces:** Right.
- **Ground:** Bottom edge — the door's lower corner tracks just above the road.
- **Frames:** 1 shut and flush with the sill · 2 half open, about 45° · 3 fully open across the lane. **The swing runs 1 → 3; the game plays it backwards for closing.**
- **Not:** Do not include the car. Do not draw the outside face of the door — we only ever see the inside of it.

### `car-wreck` — 36 × 16, 1 frame
- **What:** `car-sedan` after a bad day: crumpled bonnet, one wheel splayed outward, bootlid sprung, glass gone, sitting lower on its springs.
- **View:** A. Same angle and roughly the same footprint as `car-sedan` so it can replace it in place.
- **Faces:** Right.
- **Ground:** Bottom edge. Sits 3px lower than the intact car.
- **Not:** Not burning, not smoking — the game adds its own effects.

---

## 3. Animals

These are small, fast obstacles. The player has about a fifth of a second to
identify them, so **silhouette beats surface detail every time**.

### `dog-stray` — 15 × 9, 6 frames
- **What:** A rangy medium street mongrel, short-haired, ribs faintly showing, tail up and loose. Tan with a darker saddle. Not menacing — *in the way*.
- **View:** A — 20° high angle side view. Both near legs fully visible, far legs only as a darker suggestion behind them.
- **Faces:** Right, trotting.
- **Ground:** Bottom edge. All four paws at or near it through the whole cycle.
- **Frames:** A six-frame trot, **left to right in time order**. Legs do nearly all the work; the body rises and falls about 1px total. Frame 1 and frame 4 are the two contact poses. **Must loop seamlessly 6 → 1.**
- **Not:** Not a breed dog. Not sitting. Not cute.

### `dog-bark` — 16 × 10, 4 frames
- **What:** The same dog planted, all four feet down, head up, barking to the right.
- **View:** A. **Ground:** Bottom edge. **Faces:** Right.
- **Frames:** 1 mouth shut · 2 mouth open · 3 mouth wide, head tilted back · 4 mouth shut. **The body does not travel at all** — only the head and chest move.
- **Not:** No speech bubble, no sound lines. The game draws those.

### `cat-street` — 11 × 6, 6 frames
- **What:** A lean tabby street cat, body low and long, tail horizontal with a slight kink.
- **View:** A — 20° high angle side view.
- **Faces:** Right, slinking.
- **Ground:** Bottom edge.
- **Frames:** Six-frame walk with the fluid low cat gait, left to right in time order, seamless loop. **At 11px wide the legs are 1px — resolve this as a silhouette, not as anatomy.**
- **Not:** Not fluffy. Not a house cat. Not upright or arched.

### `cat-dart` — 13 × 6, 4 frames
- **What:** The same cat flat out, body fully extended, tail straight back. This is the one that crosses in front of you.
- **View:** A. **Faces:** Right. **Ground:** Bottom edge, though at full stretch it may leave it by 1px on frames 2–3.
- **Frames:** Four-frame sprint, left to right, seamless.
- **Not:** Not a blur — it must stay readable as a cat.

### `pigeon-flock` — 18 × 9, 5 frames
- **What:** Four or five city pigeons on the ground, pecking, then exploding upward. Grey, iridescent neck flecks.
- **View:** A for frames 1–2 (on the ground, high-angle side view); frames 3–5 lift, so the birds rotate toward a side-on flight profile.
- **Faces:** Right, though scattered birds may face slightly apart.
- **Ground:** Bottom edge on frames 1–2. Frames 3–5 leave it — **the flock exits upward, out of the top of the frame.**
- **Frames:** 1 pecking · 2 pecking, one head up · 3 all heads up, wings opening · 4 lifting, wings down-stroke · 5 nearly clear of frame. **Plays once, does not loop.**
- **Not:** Not a neat V formation. It is a panicked scatter.

### `gull` — 11 × 6, 4 frames
- **What:** A herring gull in level flight.
- **View:** A, but drawn for the **far plane**: flatter, paler, lower contrast — nearly a silhouette against sky.
- **Faces:** Right.
- **Ground:** None — this never touches ground. Centre the bird in the frame.
- **Frames:** A slow four-frame flap: 1 wings level · 2 wings up · 3 wings level · 4 wings down. Seamless loop.
- **Not:** No feather detail. At this size and distance it is a shape.

---

## 4. Street furniture

Everything here is something the player weaves, hops or ollies, so the
**outline matters more than the surface**.

### `bin-wheelie` — 10 × 12, 1 frame
- **What:** A domestic wheelie bin, lid shut, two small wheels. Municipal dark green, scuffed, a peeling house-number sticker.
- **View:** A — 20° high angle. Side of the bin plus a shallow strip of the closed lid.
- **Faces:** Right (the lid hinge is at the left, the handle at the right).
- **Ground:** Bottom edge, both wheels touching.
- **Not:** No taller than 12px — **chest height on an adult, not shoulder height**.

### `bin-wheelie-down` — 15 × 8, 1 frame
- **What:** The same bin knocked onto its side, lid sprung open, a small spill of rubbish at the open end.
- **View:** A. **Faces:** Right, with the open end to the right. **Ground:** Bottom edge, lying along it.
- **Not:** Not an explosion of rubbish — a modest spill.

### `roadworks` — 24 × 14, 1 frame
- **What:** Two orange-and-white striped barriers and a cluster of cones, placed in a hurry. One barrier leaning. An amber lamp on top, unlit.
- **View:** A — 20° high angle, seen along the run so the barriers overlap slightly.
- **Faces:** Right. **Ground:** Bottom edge; every barrier foot and cone base touches it.
- **Not:** Not neat. Not symmetrical.

### `roadworks-lamp` — 24 × 14, 4 frames
- **What:** Identical to `roadworks`, with the amber lamp flashing.
- **Frames:** 1 unlit · 2 lit with a small warm pool on the tarmac at its base · 3 lit, brighter · 4 unlit. **Only the lamp and its pool change — the barriers are pixel-identical across all four frames.** Seamless loop.

### `cone` — 6 × 7, 1 frame
- **What:** A single traffic cone, orange with a grubby white reflective band, tipped very slightly.
- **View:** A. **Faces:** Right (the tip leans right). **Ground:** Bottom edge, the square base flat on it.

### `hydrant` — 6 × 8, 1 frame
- **What:** An American fire hydrant, squat and heavy, one side valve visible. Municipal red gone chalky, rust bloom at the base.
- **View:** A. **Faces:** Right (the visible side valve points right). **Ground:** Bottom edge.

### `hydrant-blown` — 18 × 22, 5 frames
- **What:** The same hydrant with its cap off, throwing water up and to the right.
- **View:** A. **Faces:** Right. **Ground:** Bottom edge — the hydrant's base, not the water's.
- **Frames:** Five-frame loop of the plume only; **the hydrant is pixel-identical in every frame.** Water rises and falls back. Pale blue-white with visible droplet scatter.
- **Not:** Not a smooth glassy jet. Not a fountain — it is a burst pipe.

### `sprinkler` — 14 × 9, 6 frames
- **What:** A garden sprinkler on a verge, head tiny, sweeping a fan of water.
- **View:** A. **Faces:** Right at the start of the sweep. **Ground:** Bottom edge, the head's base.
- **Frames:** One full sweep across six frames — **frames 1–3 sweep right to left, frames 4–6 sweep back left to right.** Seamless loop. The water is most of the image; the sprinkler head barely moves.

### `planter` — 10 × 9, 1 frame
- **What:** A terracotta planter with an overgrown shrub spilling out. Somebody's pride and a hazard.
- **View:** A. **Ground:** Bottom edge. **Faces:** Right (the shrub leans right).

### `hedge-low` — 24 × 9, 1 frame, **tileable L↔R**
- **What:** A low clipped hedge, dusty green, flat top, a gap where something drove into it.
- **View:** A — 20° high angle, so a shallow strip of the flat top is visible.
- **Ground:** Bottom edge. **Tiling:** Right edge must continue into the left edge seamlessly.

### `mailbox` — 8 × 11, 1 frame
- **What:** An American kerbside mailbox on a wooden post, flag down, dented.
- **View:** A. **Faces:** Right (the door and flag are on the right). **Ground:** Bottom edge, post foot.

### `streetlight` — 12 × 46, 1 frame
- **What:** A sodium streetlight: a plain tapering post with a single cobra-head lamp cantilevered out.
- **View:** B — **flat elevation**, dead-on, because a post has no meaningful side view.
- **Faces:** The lamp head cantilevers **right**.
- **Ground:** Bottom edge, the post foot. The lamp is at the very top of the frame.
- **Not:** **Unlit.** No glow, no light cone, no bulb bloom — the game draws the glow as a separate additive layer and a baked one will double up.

### `trash-pile` — 16 × 8, 1 frame
- **What:** A heap of bin bags against a kerb: three or four black bags, one burst, scattered paper.
- **View:** A. **Ground:** Bottom edge. **Faces:** Right (the burst bag and its spill are to the right).

### `oil-slick` — 30 × 7, 1 frame
- **What:** A flat iridescent slick lying **on** the road. Dark, with a petrol-rainbow sheen at the edges.
- **View:** A, flat on the ground — so it is a **squashed ellipse, roughly 4 : 1**, never a circle.
- **Ground:** The whole asset is the ground. No height, no thickness, no rim.
- **Not:** Not a puddle with a visible edge lip. Not circular.

### `manhole` — 12 × 5, 1 frame
- **What:** A cast-iron cover set flush in the tarmac, worn tread pattern.
- **View:** A, flat on the ground — a squashed ellipse, about 2.5 : 1.
- **Not:** Not raised, not open, not casting a shadow.

### `skate-ramp` — 22 × 10, 1 frame
- **What:** A homemade plywood kicker. Raw ply, visible screw heads, one spray-painted tag.
- **View:** A — seen from the side so the wedge profile is unmistakable.
- **Faces:** Right — **the ramp surface rises left-to-right**, so you hit the low end first. This is the single most important thing about this asset: a ramp facing the wrong way reads as a wall.
- **Ground:** Bottom edge, along its whole length.
- **Not:** Not a quarter-pipe, not curved. A straight wedge.

---

## 5. Buildings — VIEW B, and the near row is upside-down

Buildings are **flat front elevations, dead-on, zero perspective**, like painted
theatre flats. No side wall, no roof plane, no convergence. This is what lets the
code place them at any depth without them disagreeing with each other.

### 5.1 The far row — ground line at the BOTTOM

Standard. The facade **rises up** from its ground line, the roof is at the top of
the image, and the bottom edge sits on the far pavement.

### 5.2 The near row — ground line at the TOP

**This is the one asset class in the whole set that is inverted, and it is not a
vertical flip.**

Pizza Run puts houses on both verges. The near row stands between the camera and
the road, and the code draws it **descending from its ground line**: the wall
starts at the pavement and extends **downward** toward the bottom of the screen,
which is toward the viewer.

So for every `-near` house:

- **The ground line is the TOP edge of the image.** The top edge is where the
  wall meets the near pavement.
- The facade extends **downward** from there.
- **The awning or eave runs along the TOP edge**, not the bottom — it is the
  part nearest the camera.
- **Windows, doors and details stay the right way up.** Do not flip the artwork.
  A door is still a door with its handle at normal height; it is simply placed
  measuring down from the top edge rather than up from the bottom.
- There is **no roof** on a near house. You are looking at it from above and
  behind; the roof is out of frame past the bottom edge.

Supply far and near as **separate files**. They are not mirrors of each other.

### `house-bungalow-far` — 44 × 34, 1 frame
- **What:** A single-storey Californian bungalow. Stucco wall, shallow pitched roof seen edge-on as a simple band, front door centred, a window either side, a porch light beside the door. Modest and lived-in.
- **View:** B — flat elevation, dead-on, no perspective.
- **Ground:** **Bottom** edge. No lawn, no path, no shadow below it.
- **Not:** No side wall. No roof plane. No driveway.

### `house-bungalow-near` — 44 × 34, 1 frame
- **What:** The same bungalow from the near verge.
- **View:** B. **Ground:** **TOP** edge — see §5.2.
- **Detail:** A porch awning runs along the **top** edge. Windows and door sit below it, right way up. No roof anywhere in the image.

### `house-twostorey-far` — 44 × 46, 1 frame
- **What:** Two floors. Front door and one window at ground level, **two clearly separated windows above**. Clapboard or stucco.
- **View:** B. **Ground:** **Bottom** edge.
- **Critical:** The upstairs windows are **throw targets** — the player lobs pizza boxes through them. They must be individually readable at a glance and clearly separated from each other.

### `house-twostorey-near` — 44 × 46, 1 frame
- **What:** The same, from the near verge. **View:** B. **Ground:** **TOP** edge.
- **Critical:** Upstairs windows are now the ones **furthest from the top edge**. Same readability requirement.

### `house-apartment-far` — 48 × 52, 1 frame
- **What:** A small three-storey walk-up. External stair rising across the front, a row of identical windows per floor, air-conditioning units under some. Grimmer than the houses.
- **View:** B. **Ground:** **Bottom** edge.

### `house-apartment-near` — 48 × 52, 1 frame
- **What:** As above, from the near verge. **View:** B. **Ground:** **TOP** edge.

### `window-lit` — 10 × 10, 1 frame
- **What:** A single lit window as a **standalone overlay** to be composited onto any facade above: warm interior light, a suggestion of a curtain or blind.
- **View:** B. **Ground:** None — this is an overlay.
- **Critical:** **Transparent everywhere outside the window frame**, including the wall around it. The frame is centred in the 10 × 10 box.

### `window-open` — 10 × 10, 2 frames
- **What:** The same window with the sash pushed up and a dark opening beneath it. This is the **trick-shot target**.
- **Frames:** 1 shut · 2 open. **Frame 2 must be unmistakably open at a glance** — a dark void, a raised sash edge, a warm rim of room light. If a player cannot tell frames 1 and 2 apart in a moving game, the mechanic does not exist.

### `door-front` — 10 × 14, 2 frames
- **What:** A front door overlay for the facades.
- **Frames:** 1 shut · 2 ajar with warm light spilling out to the **right**.
- **Critical:** Transparent outside the door frame.

### `doormat` — 12 × 4, 1 frame
- **What:** A coir doormat with a worn, **unreadable** word on it. This is the **delivery target** and should be slightly comic.
- **View:** A — it lies flat on the ground, so it is a **squashed rectangle**, about 3 : 1, not a rectangle seen square-on.
- **Ground:** The whole asset is the ground.

### `garage-door` — 28 × 20, 1 frame
- **What:** A sectional garage door, four horizontal panels, one dented.
- **View:** B, flat elevation. **Ground:** Bottom edge.

### `fence-picket` — 24 × 10, 1 frame, **tileable L↔R**
- **What:** A run of picket fence, paint going, one picket missing.
- **View:** B. **Ground:** Bottom edge. **Tiling:** seamless left to right — **and keep the missing picket away from either edge**, or the gap doubles at every join.

### `wall-breeze` — 24 × 12, 1 frame, **tileable L↔R**
- **What:** A run of breeze-block garden wall, bare grey block, one patch of graffiti.
- **View:** B. **Ground:** Bottom edge. **Tiling:** seamless; keep the graffiti off both edges.

---

## 6. The far skyline — VIEW B, flattened further

Flat elevations like §5, but **pushed back**: low contrast, desaturated toward
the sky, **no detail smaller than 2px**. These scroll slowly behind everything.

### `sky-towers` — 96 × 40, 1 frame, **tileable L↔R**
- **What:** A downtown cluster of five or six office towers at differing heights. Windows are regular grids of small rectangles, most dark, a scatter lit.
- **View:** B, flat, dead-on. **Silhouette-dominant** — this reads as a shape on the horizon, not as architecture.
- **Ground:** Bottom edge, where the mid-ground meets it.
- **Tiling:** Seamless left to right. **Vary the tower heights across the strip** so the repeat is not obvious.
- **Not:** No individual building detail. No street level. No ground clutter.

### `sky-lowrise` — 96 × 26, 1 frame, **tileable L↔R**
- **What:** The nearer, lower band of city: two- and three-storey commercial blocks, water tanks, roof aerials, a billboard frame in silhouette.
- **View:** B. Slightly more contrast than `sky-towers` — it is one plane closer.
- **Ground:** Bottom edge. **Tiling:** seamless.

### `sky-hills` — 128 × 24, 1 frame, **tileable L↔R**
- **What:** A soft ridge of dry Californian hills. **One flat mass** with a slightly darker band along the top ridge, and nothing else.
- **View:** B. This is the furthest thing in either game.
- **Ground:** Bottom edge. **Tiling:** seamless — avoid a distinctive peak near either edge.
- **Not:** No trees, no texture, no detail whatsoever. If it has detail it will fight the foreground.

### `sky-billboard` — 26 × 20, 1 frame
- **What:** A roadside billboard on two legs. Rusted frame, one working floodlight on a bracket.
- **View:** B, flat, dead-on. **Ground:** Bottom edge, both legs.
- **Critical:** **The board face is blank** — a flat neutral panel. The game draws its own copy onto it, and any artwork you put there will be covered or will show through.

### `sky-watertower` — 20 × 26, 1 frame
- **What:** A classic American water tower on splayed legs, with a ladder and a faded **unreadable** town name.
- **View:** B. **Ground:** Bottom edge, all legs.

---

## 7. Palms and planting — VIEW B

A palm has no meaningful side view, so these are flat elevations too.

### `palm-tall` — 18 × 44, 1 frame
- **What:** A Californian fan palm. Bare scaly trunk with a slight lean to the **right**, a crown of eight or nine fronds, and a skirt of dead brown fronds hanging under the green.
- **View:** B, flat elevation, dead-on.
- **Ground:** Bottom edge, the trunk base.
- **Not:** Not a coconut palm. No coconuts. Not symmetrical — a symmetrical palm reads as a logo.

### `palm-short` — 16 × 26, 1 frame
- **What:** A younger, squatter palm: thicker trunk, denser crown, less dead skirt.
- **View:** B. **Ground:** Bottom edge.

### `palm-sway` — 18 × 44, 4 frames
- **What:** `palm-tall` moving in wind.
- **Frames:** Four frames. **The trunk is essentially static — only the fronds lift and settle.** Frame 1 rest, 2 fronds lifted, 3 rest, 4 fronds dropped. Seamless loop.
- **Not:** Do not sway the whole tree. A palm trunk barely moves.

### `tree-street` — 20 × 32, 1 frame
- **What:** A dusty, over-pruned municipal street tree with a metal guard around the base.
- **View:** B. **Ground:** Bottom edge.

### `grass-verge` — 32 × 6, 1 frame, **tileable L↔R and T↕B**
- **What:** A strip of dry verge grass — patchy, more dust than lawn.
- **View:** A — lying flat, seen at the road's high angle.
- **Ground:** The whole asset is ground. **Tiling:** seamless.

---

## 8. Road surface and markings

All **VIEW A, lying flat**, and all **tileable left-to-right**.

### `road-asphalt` — 64 × 18, 1 frame, **tileable L↔R and T↕B**
- **What:** One lane's width of worn asphalt: patchy repairs, a tar seam, faint tyre polish down the wheel tracks.
- **View:** A, flat. **Tiling:** seamless left to right.
- **Critical:** **Dark and low-contrast.** Traffic and obstacles have to read against it, and a busy road surface makes every sprite harder to see.

### `road-centreline` — 32 × 3, 1 frame, **tileable L↔R**
- **What:** A dashed white centre line, worn rather than crisp. **View:** A, flat. **Tiling:** seamless, and **the dash rhythm must continue across the join**.

### `road-edgeline` — 32 × 2, 1 frame, **tileable L↔R**
- **What:** A solid edge line, more worn than the centre line. **View:** A, flat.

### `road-crack` — 24 × 6, 1 frame
- **What:** A patch of cracked and tar-patched tarmac, as a **decal overlay** — transparent everywhere except the damage.
- **View:** A, flat. Not tileable; it is a one-off patch.

### `kerb` — 32 × 5, 1 frame, **tileable L↔R**
- **What:** A concrete kerb, chipped, showing the **top face and the vertical drop** to the road.
- **View:** A — the high angle is what makes both faces visible. **Tiling:** seamless.
- **Critical:** The road is at the **bottom**, the pavement at the **top**. Getting this inverted turns the kerb into a step up out of the screen.

### `pavement` — 32 × 8, 1 frame, **tileable L↔R and T↕B**
- **What:** Paving slabs with visible joints and one cracked slab. **View:** A, flat. **Tiling:** seamless — **keep the cracked slab away from both edges.**

### `drain-grate` — 10 × 4, 1 frame
- **What:** A kerbside gutter drain. **View:** A, flat — a squashed ellipse or rectangle, about 2.5 : 1.

---

## 9. Downhill Racer only

These may commit to the game's warm daylight, unlike everything above.

### `trolley-shopping` — 20 × 16, 4 frames
- **What:** A supermarket trolley, empty, four small castors. **Chrome wire drawn as an open lattice, not a solid box** — the road must show through it.
- **View:** A — 20° high angle, side of the basket plus a strip of its open top.
- **Faces:** Right (handle at the left, nose at the right).
- **Ground:** Bottom edge, all visible castors.
- **Frames:** Four frames of castors spinning and the basket rattling by 1px. Seamless loop.

### `longboard` — 22 × 5, 4 frames
- **What:** A pintail longboard, deck near horizontal, two trucks, four wheels. Worn graphic on the underside. **This is the good vehicle and should look it** — cleaner and more deliberate than the trolley.
- **View:** A. **Faces:** Right. **Ground:** Bottom edge, wheels touching.
- **Frames:** Four frames of wheel rotation only. The deck does not move.

### `trolley-bay` — 36 × 18, 1 frame
- **What:** A steel trolley corral with six or seven nested trolleys.
- **View:** A. **Faces:** Right. **Ground:** Bottom edge.
- **Critical:** **This is a wall.** It must read as solid and unjumpable — dense, dark, and clearly taller than the player can hop.

### `dust-plume` — 14 × 10, 5 frames
- **What:** A puff of dry roadside dust kicked up by a wheel. Warm grey-brown.
- **View:** A. **Ground:** Bottom edge — it starts at road level.
- **Frames:** Five frames expanding and thinning. **Plays once.**
- **Not:** Not white. Not smoke.

### `sun-low` — 40 × 40, 1 frame
- **What:** A sun disc with a soft halo, for the far plane.
- **Critical:** **Deliver neutral white.** The game tints it from gold to red as the hill descends, and any baked colour will fight the tint.

---

## 10. Pizza Run only

These may commit to the game's night palette.

### `bmx` — 18 × 14, 4 frames
- **What:** A beaten BMX: pegs, one brake missing, a milk crate bungeed over the back wheel.
- **View:** A. **Faces:** Right. **Ground:** Bottom edge, both wheels.
- **Frames:** Four frames of wheel rotation only; the frame does not move.

### `pizza-box` — 8 × 8, 4 frames
- **What:** A flat cardboard box in mid-flight, grease-spotted, an unreadable logo.
- **View:** A three-quarter tumble — it must read as **a flat object spinning**, not as a square rotating. Its thinness has to show.
- **Ground:** None — this is in the air. Centre it.
- **Frames:** Four frames of one full rotation, **tumbling forward (top edge moving right)**. Seamless loop.

### `pizza-box-landed` — 10 × 5, 1 frame
- **What:** The same box lying flat, slightly askew.
- **View:** A, flat on the ground — a squashed rectangle, about 2 : 1.

### `pizza-stack` — 10 × 12, 1 frame
- **What:** Four or five boxes stacked, for the rider's rack and the HUD.
- **View:** A. **Ground:** Bottom edge.

### `restock-crate` — 14 × 12, 1 frame
- **What:** A wooden crate of pizza boxes in the road, lid off, boxes visible inside.
- **View:** A. **Ground:** Bottom edge.
- **Critical:** **This must read as "pick me up", not "avoid me".** Brighter, cleaner and warmer than every hazard in §4. If it looks like an obstacle, players will swerve around the thing that refills their ammunition.

### `streetlight-glow` — 40 × 40, 1 frame
- **What:** A soft circular sodium glow, warm amber, fading to fully transparent at the edge.
- **Critical:** **No lamp in it.** This is an additive overlay that sits under `streetlight`, which is delivered unlit.

---

## 11. Shared effects

### `impact-star` — 12 × 12, 5 frames
- **What:** A ragged cartoon impact burst, white-hot core going to warm orange.
- **Ground:** None — centre it. **Frames:** Five, expanding and fading. **Plays once.**

### `skid-mark` — 20 × 4, 1 frame, **tileable L↔R**
- **What:** A black rubber skid decal. **View:** A, flat, transparent around it.

### `speed-lines` — 32 × 12, 3 frames
- **What:** Horizontal motion streaks for the screen edges at speed. Nearly transparent.
- **Ground:** None. **Frames:** Three, streaks travelling **right to left**. Seamless loop.

### `splash-water` — 14 × 10, 5 frames
- **What:** A shallow splash from riding through water. Pale blue-white.
- **View:** A. **Ground:** Bottom edge. **Frames:** Five, rising and falling. **Plays once.**

### `feather-puff` — 10 × 8, 4 frames
- **What:** The feathers left behind when you clip the pigeons.
- **Ground:** None. **Frames:** Four, drifting **downward**. **Plays once.**

---

## Delivery checklist

- [ ] **View A or View B** — checked per asset against its block above.
- [ ] **Everything faces right.** No left-facing twins supplied.
- [ ] **Ground line at the bottom edge** — except the `-near` houses in §5.2, whose ground line is at the **top**.
- [ ] **No baked drop shadows.**
- [ ] **No baked directional light, sunset or moonlight** on anything in §2–§8.
- [ ] **No text, logos or numbers** on anything that mirrors.
- [ ] Transparent background, trimmed to content, no padding.
- [ ] **Authored at 3× the sizes given.**
- [ ] Sheets one row, equal frame widths, no gutters.
- [ ] Tileable assets seamless left-to-right, with distinctive features kept away from both edges.
- [ ] **A standing adult is 23px.** Every object checked against that before export.
