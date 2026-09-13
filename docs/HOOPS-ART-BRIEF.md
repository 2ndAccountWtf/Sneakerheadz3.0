# Hoops art brief

Everything the 2-on-2 blacktop game draws, in the order it is worth doing, with
a description you can paste into an image generator and the constraints that
will actually bite.

---

## Read this first — it changes what you should generate

The game renders at **352 × 198 pixels**. A player on screen is **32px tall**.
The ball is **7px across**.

That matters more than anything else in this document, because **AI image
generators cannot produce a usable 32px character.** You will get a beautiful
600px basketball player, and every downscale of it — bicubic, Lanczos,
nearest — turns into six brown smudges. Characters at this size have to be
drawn on the pixel grid deliberately, by a person or by a pixel-art-specific
tool.

What AI generation *is* excellent at here is **everything behind the players**:
skyline, sky, crowd, fence, blacktop texture. Those are large, soft, and read
fine when downscaled. That is where your effort will show up.

So there are two routes, and it is worth picking one before you make anything:

**Route A — keep 352 × 198 (no code change).**
You generate backgrounds; characters stay as the current pixel art or get
hand-pixelled later. Fast, zero risk, and the game will look noticeably better
because the backdrop is 60% of the screen.

**Route B — I double the internal resolution to 704 × 396.**
Players become 64px, the ball 14px. That is the smallest size where
AI-generated characters start to survive a downscale, and it makes every asset
below viable from a generator. It is a contained change on my side — the
viewport, the perspective maths and the hitbox constants all scale together —
but it touches every draw call in the file and needs a fresh balance pass,
because a bigger court in the same screen space changes how far things feel.

**My recommendation: start with Route A.** Do the four background pieces first.
They are the biggest visible win, they cost me nothing to wire, and they will
tell us whether the look is going in the right direction before anyone commits
to a resolution change.

---

## Formats — the short version

**Send me whatever you have.** I have Pillow available locally and can slice
sheets, strip backgrounds to real alpha, downscale on the pixel grid, and pack
frame strips myself. You do not need to get this right.

If you want to get it right anyway:

| | |
|---|---|
| Format | PNG, RGBA |
| Animation | Frames left→right in **one row**, equal width, no padding or margin |
| Naming | `<id>.png`, or `<id>@6.png` if the frame count differs from the table |
| Where | `assets/art/hoops/` — the build globs the folder, nothing to register |
| Scaling | Author at 1× on the grid, or an exact multiple (2×, 4×). Never 1.5× |
| Background | Real alpha. Failing that, a **flat #FF00FF magenta** I can key out |

**Do not** anti-alias character edges. Backgrounds may be as soft as you like.

The palette the rest of the game lives in: near-black ground `#07090c`,
phosphor accent `#00e5c0`, magenta `#ff2e88`, gold `#ffcc4d`. The court is lit
at night. Anything that ignores this will read as pasted in.

---

## 1. The backdrop — night sky and skyline

**The thing:** `bg-hoops-sky.png` — 352 × 130, the whole area above the court.

**Description to design from:**
> A wide night sky over a city, seen from a floodlit outdoor basketball court.
> Deep blue-black gradient, darkest at the top, warming very slightly toward
> the horizon. A scatter of small stars. A pale moon in the upper right, about
> a fifth of the way down. Behind the horizon, two overlapping rows of blunt
> city buildings in near-silhouette — the far row almost black, the near row
> slightly lighter — with small warm-yellow and cold-blue lit windows scattered
> across them, maybe one window in three. Flat, graphic, no lens flare, no
> perspective vanishing point. Muted and cold; the court lighting comes later.

**Anything else:**
- The moon currently sits at x≈296, y≈22 and is 16px across. Keep it right of
  centre and high, or the scoreboard overlaps it.
- The bottom 35px of this image sit behind a chain-link fence and a crowd, so
  do not put detail you care about there.
- If you can give me this as **three separate layers** — sky, far buildings,
  near buildings — I will parallax them as the camera shifts, which is a
  significant upgrade for no extra art. Name them `@far`, `@mid`, `@near`.

---

## 2. The blacktop

**The thing:** `bg-hoops-court.png` — 352 × 70, the playing surface.

**Description to design from:**
> A worn outdoor asphalt basketball court at night, seen from a low front-on
> angle so the surface is a wide shallow trapezoid — narrower at the back,
> wider at the front. Faded white painted lines: two key rectangles at left and
> right, a centre circle, sidelines. The paint is chipped and patchy, the
> asphalt is grey-black with lighter patches where it has been resurfaced, a
> few cracks, a drain cover. Pools of cold floodlight falling across it from
> above, leaving the corners darker. No people, no ball, no hoops.

**Anything else:**
- Playable width runs x=34 to x=318; the court should extend a little past both
  so it does not end mid-play. Depth runs y=130 (back) to y=184 (front).
- The trapezoid is subtle — the far edge is about 86% the width of the near
  edge, not a dramatic perspective.
- Keep it **dark**. Four players, a ball, shadows, arcs and meters all draw on
  top of this, and a bright court makes every one of them unreadable.

---

## 3. The crowd and the fence

**The thing:** `bg-hoops-crowd.png` — 352 × 40, and `bg-hoops-fence.png` —
352 × 40, both with alpha.

**Description to design from:**
> *Crowd:* a row of about twenty people standing shoulder to shoulder watching
> a street game at night, drawn as near-flat silhouettes in two or three very
> dark blue-greys — no faces, no detail, just heads and shoulders at slightly
> different heights. A couple of them lighter than the rest so the row does not
> read as a single mass. Transparent everywhere else.
>
> *Fence:* a chain-link fence in cold grey-blue, diamond mesh, with vertical
> posts roughly every 60px and a horizontal rail along the top. Seen straight
> on. Mostly transparent — this sits over the crowd.

**Anything else:**
- Deliver these as two files, not one. The crowd bobs; the fence does not.
- The fence currently draws at 50% opacity. If yours is already semi-transparent
  in the PNG, say so and I will stop double-dimming it.

---

## 4. The hoops

**The thing:** `hoop-left.png` and `hoop-right.png` — 40 × 60 each, alpha.

**Description to design from:**
> A street basketball hoop seen from the side and slightly in front: a square
> backboard on a single pole, a bent orange rim, and a chain net. Weathered —
> the backboard is scuffed plywood or scratched perspex, the pole has rust at
> the base. Night lighting from above. The left-hand one faces right; the
> right-hand one faces left.

**Anything else:**
- The rim sits **46px above the floor** and that number is load-bearing — dunk
  range, block height and the alley-oop window all measure against it. Put the
  rim at the right height in the image and I will align to it; do not centre it.
- A **chain** net is better than a rope one at this size. Rope disappears; chain
  catches the light and reads.
- If you want to earn your money: a **second frame with the net flicked
  outward**, for the moment a shot goes through. `hoop-left@2.png`.

---

## 5. The players — only if we go Route B

**The thing:** `player-hoops.png` — a sheet at **32 × 32 per frame, 10 frames**
(Route A) or **64 × 64 per frame** (Route B).

Frame order, and this order matters because the code indexes it:
`idle, run1, run2, run3, jump, shoot, dunk, land, stumble, down`

**Description to design from:**
> A basketball player in a simple vest and shorts, seen from the side, drawn as
> clean pixel art with a hard outline and no anti-aliasing. Chunky proportions —
> big head, short limbs, exaggerated poses — in the style of a 90s arcade
> basketball cabinet. The vest and shorts should be a single flat colour with
> one darker shade for folds, so the kit can be recoloured. Frames: standing
> idle; three frames of a running cycle; a jump with both arms up; a jump shot
> with the ball released; a two-handed dunk at full stretch; a landing crouch;
> a stumble; and flat on the floor.

**Anything else:**
- All four players share one sheet and are recoloured in code. So keep the kit
  a **flat, easily-isolated colour** — one mid tone and one shade — and the skin
  and shoes separate from it.
- If you want the four to look genuinely different rather than recoloured, send
  four sheets named `player-hoops-teal.png`, `-green.png`, `-magenta.png`,
  `-gold.png`. I will need to add per-kit variant lookup, which is about ten
  lines.
- **Do not attempt this from a generator at 32px.** At 64px it is borderline.
  This is the asset that most wants a human pixel artist, or a pass through a
  pixel-art-specific tool.

---

## 6. The ball

**The thing:** `ball-hoops.png` — 8 × 8, 4 frames of rotation.

**Description to design from:**
> A basketball at tiny pixel size: a burnt-orange circle with a dark outline and
> two darker seam lines, rotating a quarter turn per frame.

**Anything else:**
- Genuinely 8px. The current one is drawn with two arcs and honestly looks fine;
  this is the lowest-value item on the list. Skip it unless the rest is done.

---

## 7. Sound — the thing nobody thinks of and everyone notices

Not art, but it will do more for this game than items 5 and 6 combined. There
is currently **no audio at all**.

Short mono WAV or OGG: `dribble`, `swish`, `rim-clank`, `backboard`,
`dunk-slam`, `backboard-shatter`, `sneaker-squeak`, `whistle`, `crowd-oooh`,
`crowd-cheer`, `steal`, `shove-thud`, `buzzer`. Plus one loopable 60-second
track — boom-bap, sparse, something that sounds like a hot evening.

Drop into `public/audio/sfx/` and `public/audio/music/`.

---

## Where sprite-gen fits

`aldegad/sprite-gen` is a Python CLI — *"one drawing in, game-ready sprites
out"*. Its useful half for us is the **post-processing**: chroma-key to real
alpha, frame extraction, atlas packing, and a `manifest.json` of frame layout.

That half I can also do with Pillow, which is already installed here. So
sprite-gen is worth it if **you** want to run it on your machine against Nano
Banana output before sending files over — it will save you the manual cropping.
It is not needed on my side.

The workflow either way:

1. You generate in Nano Banana, at whatever size it gives you.
2. Either run sprite-gen locally, or just send me the raw images.
3. I strip, slice, downscale on the grid, name and place them.
4. They are live — the build globs `assets/art/`, there is no registry to edit.

---

## Suggested order

1. **Backdrop sky + skyline** (item 1) — biggest visible change, lowest risk.
2. **Blacktop** (item 2) — second biggest.
3. **Crowd + fence** (item 3) — cheap, and sells the place.
4. **Hoops** (item 4) — small but they are on screen constantly.
5. **Sound** (item 7) — punches above its weight.
6. **Players** (item 5) — only after deciding on Route A or B.
7. **Ball** (item 6) — skip until last.

Send item 1 alone and I will wire it, screenshot it and show you before you
make anything else. That is a much better use of your time than making all
seven and finding out the palette is wrong.
