# Hoops character brief

Four players, one sheet each, and a pose list mapped to what the engine
actually asks for. Written to be pasted prompt-by-prompt into a pixel-art
generator.

---

## Before you generate anything

**1. Make ONE base pose first, and lock it.**

Generate a single idle, side-on, full-body frame. Look at it. Fix it. *Then*
generate every other pose with that image attached as the reference. If you
prompt fifteen poses independently you will get fifteen slightly different men —
the hat moves, the chain changes length, the shorts get longer — and no amount
of cleanup afterwards will make them into one character. This is true of every
generator, PixelLab included.

**2. Silhouette beats detail at this size.**

A player is 32px tall. When two of them overlap mid-dunk, colour tells you
nothing — the shapes do. So the four characters must be distinguishable **as
black silhouettes**: different heights, different builds, different headwear
outlines. Squint at them, or literally fill them black and check. Gold chains
and sunglasses are three pixels each; the backwards cap brim and the shoulder
width are what actually read.

**3. Every pose faces RIGHT.**

The engine mirrors horizontally for left-facing. Draw right, always — a
character drawn facing left will have their jewellery and logo flip, and it
will show.

**4. Feet on the bottom edge.**

The engine anchors sprites at the feet. Airborne poses still draw with the
character's feet at the frame's bottom edge; the engine lifts the whole sprite.
Do not pre-lift a jump pose inside its frame, or your player will hover.

---

## Character 1 — YOU (teal)

**The thing:** `player-hoops-teal.png`

**Description to design from:**
> A lean, muscular streetball player in mid-90s hip-hop style, seen from the
> side. Backwards fitted cap. Oversized black sunglasses with a hard rectangular
> frame. A thick gold rope chain and a second shorter chain. Baggy mesh
> basketball vest in teal with a darker teal trim, hanging loose. Long baggy
> shorts to just below the knee. Chunky white high-top basketball sneakers with
> a visible sole stripe. Athletic but not a bodybuilder — broad shoulders,
> defined arms, narrow waist. Confident, cocky posture; he knows he is the best
> player here. Clean pixel art, hard black outline, no anti-aliasing, flat
> colours with exactly one darker shade per colour for shadow.

**Anything else:**
- **The teal is the recolour channel.** Keep the vest and shorts a single flat
  teal with one darker teal shade, and nothing else in the image teal. Skin,
  gold, white sneakers and black glasses must be their own colours, or
  recolouring will turn his teeth teal.
- Silhouette tell: **the backwards cap brim sticking out at the back of the
  head.** That is his shape. Make it read.

---

## Character 2 — BIG MIKE, your teammate (green)

**Description to design from:**
> A big, heavy-set streetball player, a head taller and much wider than the
> others, seen from the side. Shaved head, thick neck, a headband. No
> sunglasses, no jewellery — he is here to play. Plain green vest with darker
> green trim, stretched tight across a barrel chest and a belly. Knee-length
> shorts, a knee brace on one leg, low-top sneakers. Heavy, planted, slightly
> hunched posture — a man who sets screens and does not run back on defence.
> Same pixel-art treatment: hard outline, flat colours, one shade each.

**Anything else:**
- He should be **visibly the widest silhouette on the court** and about 10%
  taller. That is his entire read.
- Green is the recolour channel here; same rule as above.

---

## Character 3 — THE OPPONENT (magenta)

**Description to design from:**
> A wiry, twitchy streetball player, shortest of the four and clearly the
> fastest, seen from the side. A pick in a short afro. A gold grill and a single
> earring. Sleeveless magenta shirt with darker magenta trim, tucked in on one
> side. Compression sleeve on the shooting arm. Short shorts — noticeably
> shorter than everyone else's, deliberately retro. Low-cut sneakers. Light on
> his feet, weight forward, always about to move. Trash-talking expression.
> Same pixel-art treatment.

**Anything else:**
- This is the one the game names dynamically — he is "Wiz K" or "The Game"
  depending on who challenged you, so keep his face generic enough to be
  anybody.
- Silhouette tell: **shortest, thinnest, and the only one with bare arms and
  short shorts.**

---

## Character 4 — HIS COUSIN (gold/orange)

**Description to design from:**
> A gangly, uncoordinated streetball player, tallest of the four and far too
> thin, seen from the side. Long limbs, knobbly knees and elbows. A bucket hat.
> Glasses — normal prescription glasses, not sunglasses. An orange vest with
> darker orange trim that is clearly too big for him, and long socks pulled up
> to the knee. Old running shoes, not basketball shoes. Awkward posture, arms
> slightly out from his sides, like he is not sure he should be here. Same
> pixel-art treatment.

**Anything else:**
- He is the joke of the four and should look it. **Tallest and thinnest** — the
  opposite of Big Mike, so the two never get confused.
- Silhouette tell: **the bucket hat and the long socks.**

---

## The poses

Your list, mapped against what the engine actually drives. Order matters — the
code will index these by position.

### Tier 1 — the engine uses these today

Fifteen frames, left to right, in exactly this order:

| # | Pose | Description to design from |
|---|---|---|
| 1 | `idle` | Standing, weight on the back foot, ball on the hip. Relaxed but ready. |
| 2 | `dribble-1` | Mid-dribble, ball down at knee height, body low. |
| 3 | `dribble-2` | Same, ball coming back up to the hand, opposite arm out for balance. |
| 4 | `run-1` | Running right, lead knee up, opposite arm driving forward. |
| 5 | `run-2` | Running right, legs passing, both feet near the ground. |
| 6 | `run-3` | Running right, trailing leg extended behind, full stride. |
| 7 | `crouch` | Loaded, knees deep, ball held at the chest — winding up a shot. |
| 8 | `jump-shot` | Airborne, straight up, ball released above the head, wrist flicked over, off-hand falling away. |
| 9 | `fadeaway` | Airborne, leaning backwards away from the defender, ball released high, legs kicked slightly forward. |
| 10 | `dunk-tomahawk` | Full stretch, ball cocked back behind the head in one hand, other arm out, legs tucked. |
| 11 | `dunk-power` | Two-handed, both arms up and slightly back, one leg kicked out straight to the side, the other tucked. |
| 12 | `dunk-splits` | The showboat: airborne doing the splits, tongue out, one arm forward and one arm back and down holding the ball ready to slam. Kung-fu-movie legs. |
| 13 | `block` | Airborne, reaching up and forward with one arm fully extended, palm open, other arm down. Face snarling. |
| 14 | `stumble` | Off balance, one arm windmilling, feet crossed, about to go down. |
| 15 | `down` | Flat on the floor, on one hip, propped on an elbow, looking up in disgust. |

**Anything else:**
- Frames 10, 11 and 12 map to the three dunk types the engine already tracks —
  a normal dunk, a turbo dunk and an alley-oop. So all three of the dunks you
  described get used, and which one you see depends on how you scored.
- Frame 12 is the alley-oop finish. It should be the most ridiculous of the
  three.

### Tier 2 — I need to write code for these, and it is worth it

| Pose | Description | What it needs |
|---|---|---|
| `pass-chest` | Both arms extending forward, ball leaving at chest height. | ~40 lines: the pass already exists, it just draws the idle frame. |
| `pass-lob` | One hand over the top, arm high, lobbing. | Same work; used for alley-oop passes specifically. |
| `catch` | Arms out, hands open, receiving. | Same work; a catch currently has no frame at all. |
| `steal` | Lunging low, one arm swiping across at the ball. | Same work; the steal fires but shows nothing. |
| `defensive-stance` | Wide low stance, both arms spread out, shuffling sideways. | Same work; defence currently uses the run cycle. |

**Anything else:**
- These five are the ones that would make the game *feel* different rather than
  just look different. A steal that visibly lunges is worth more than a fourth
  dunk. If you are making art anyway, make these.
- Draw them and I will write the mapper — it is one function.

### Tier 3 — flourish, only if you are enjoying yourself

`hook-shot`, `between-the-legs-dribble`, `behind-the-back-pass`,
`crossover`, `celebrate`, `hands-on-knees-exhausted`.

**Anything else:**
- The engine has nowhere to trigger these today and I would have to invent
  reasons. They are lovely and they are last.
- `celebrate` is the most useful of them — it would play on the winning bucket.

---

## What I have to do on my side

Worth being straight about: the engine currently draws a **procedural figure**
driven by continuous numbers — `armUp` is a float from 0 to 1.35, not a frame
index. Dropping in a fifteen-frame sheet means writing a state-to-frame mapper:
which frame to show given airborne height, charge level, dunk type and stumble
timer.

That is one function, roughly 60–100 lines, and it is not risky. But it does
mean **the art will not appear the moment you drop the file in** — unlike the
backgrounds in `HOOPS-ART-BRIEF.md`, which are live on arrival. Send the
backgrounds first for that reason.

---

## Order

1. **One base pose of Character 1.** Send it. I will look at it against the
   court at actual size and tell you whether the style holds at 32px before you
   make another fourteen.
2. The other fourteen Tier 1 poses for Character 1.
3. I write the frame mapper and wire him in — at that point one of the four
   players looks hand-made and the other three do not, which will tell us a lot.
4. Characters 2, 3, 4.
5. Tier 2 poses, across all four.
