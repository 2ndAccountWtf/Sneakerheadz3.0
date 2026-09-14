# Granny Laces — generation pack

Everything needed to generate her sprites, ordered so the first four actions
are the ones the game can already show. Written against the character brief,
the `ai-game-spritesheets` pipeline (MIT) and `tools/sprite-normalize.py`.

## Run it from your machine, not from here

The Spriterrific API is unreachable from this session — the sandbox network
policy answers `403` to `CONNECT` for both `courteous-mouse-611.convex.site`
and `app.spriterrific.com`. Only npm, PyPI, crates, Go and Anthropic are on
this environment's allowlist, so the generation half has to run where you are.

```bash
git clone https://github.com/chongdashu/spriterrific-skills
export SPRITERRIFIC_API_KEY=sk_...          # never commit this
```

Then point Claude Code at the checkout and ask it to use the
`spriterrific-api` skill with the prompts below. Bring the results back here
as PNGs and `tools/sprite-normalize.py` takes them from there.

## What the renderer can actually show

`drawPlayer` in `components/minigames/HoopsGame.tsx` picks a pose from live
state. There are six, and east is a horizontal flip of west, so nothing needs
generating twice:

| Pose | Driven by | Frames |
|---|---|---|
| idle | default | 6-8 |
| run | `p.stride` | 6-8 |
| shot wind-up → release | `p.charge` 0→1 | 8-10 |
| airborne | `p.y > 6` | 4 |
| dunk | `p.dunkT > 0` | 8-10 |
| knocked down | `p.stumbleT > 0` | 4-6 |

Generating more than this is fine for later, but it will sit in the folder
doing nothing until the renderer grows a state for it.

## Priority order

**1. Granny Shot (the shot wind-up).** Her marquee asset and the one the
stat block demands: `range: 0.97` is the highest on the roster. Two hands
underneath, knees bent, push from below, completely serious expression, eyes
never on the basket. This maps to `p.charge` rising 0→1, so the frames must
read as one continuous gather-and-push — frame 1 is a standing hold, the last
frame is full extension.

**2. Idle.** Slightly hunched, purse in one hand, weight on one hip. The
brief's "Glasses Adjustment" and "Arms Crossed" make good idle variants later,
but the base idle has to be neutral — no purse swing, no spoon, nothing baked
in that will flicker when it loops.

**3. Run.** Short legs, compact, unhurried. The joke is that she never looks
like she is hurrying even at full speed, so keep the stride small and the
upper body still. `speed: 0.40` — she is slow, and she should look it.

**4. Knocked down.** She gets shoved like anyone else. Keep the glasses on.

**5. Airborne.** `jump: 0.10`, the lowest on the roster — barely leaves the
floor. Four frames, minimal air.

**6. Dunk — hold this one.** See the conflict noted below before spending
credits on it.

## The dunk conflict

The brief makes the front-flip dunk her cinematic signature. Her roster entry
is `jump: 0.10, dunk: 0.03` with the style line "Never runs, never jumps,
never comes off the floor." Those cannot both be true, and as the game stands
today she will never dunk, so the animation would never be seen.

Either keep her grounded and spend the frames on the granny shot and the ball
steal, or make the dunk a deliberate rare special — a low-probability trigger
so it lands once a game as a shock. The second is funnier and is gameplay
work, not an art decision.

## Prompt skeleton

Fill the placeholders per action. The constants exist because
`tools/sprite-normalize.py` depends on them — a different background colour or
an inconsistent camera breaks the alignment step, not just the look.

```
An elderly Russian-Jewish immigrant grandmother, late 70s, Miami Beach style.
Small compact face, prominent cheekbones, deep laugh lines, strong expressive
eyebrows, pursed skeptical mouth — perpetually judging whatever is happening.
Gray-blonde hair, short-to-medium, voluminous salon blowout, carefully teased.

HUGE oversized gold prescription glasses: thick metallic-gold frames,
oversized lenses, slight cat-eye rounded-square shape, gold temples. They sit
prominently and NEVER shift position, in any frame, no matter what she is
doing.

Silky button-down blouse in a bright tropical print (turquoise / coral /
cream), sleeves pushed up, over it a cream lightweight cardigan. White
high-waisted capri trousers. Gold jewellery: thick chain necklace, hoop
earrings, several rings, bracelet, watch. An enormous structured cream leather
handbag with heavy gold hardware, oversized to the point of looking absurd,
slightly overstuffed.

Retro running sneakers, chunky supportive sole, off-white with turquoise and
gold accents, meticulously maintained — with unusually prominent, slightly
mismatched laces.

Short and compact. Narrow shoulders, compact torso, short legs, slightly
hunched elderly posture, strong hands and forearms. Rounded grandmotherly
silhouette. She is NOT frail.

NO headscarf, NO babushka, NO Soviet or peasant clothing, NO folk dress.

ACTION: {ACTION_DESCRIPTION}

Full body, feet flat on a consistent ground line, entire figure inside frame.
Side-on three-quarter view, camera at chest height, identical camera and
identical outfit in every frame. Flat #FF00FF magenta background, no shadow
cast onto the background, no ground plane drawn. {N} frames, one action only.
```

`{ACTION_DESCRIPTION}` per action:

- **granny-shot** — "Underhand two-handed granny free throw. Frame 1 standing
  upright holding the ball at waist height; knees progressively bend and the
  ball lowers between them; final frames push upward from below with both arms
  extending. Expression completely serious throughout. She never looks up at
  the basket."
- **idle** — "Standing at rest, weight on one hip, handbag held in one hand,
  slight breathing motion only. Neutral — no gestures, no props raised."
- **run** — "Walking briskly, small unhurried stride, upper body almost still,
  handbag swinging slightly. She does not look like she is rushing."
- **down** — "Knocked off balance and falling backward, landing seated,
  indignant rather than hurt. Glasses stay perfectly in place."
- **air** — "A small hop, both feet barely off the ground, arms raised only
  slightly. Minimal elevation."

## Normalizing what comes back

```bash
python3 tools/sprite-normalize.py ~/granny-shot-frames/ out/ \
    --id grandma-laces-shot --cell 32x32 --chroma FF00FF --palette
```

Check `grandma-laces-shot-contact.png` for drift and the GIF for motion before
moving the strip into `assets/art/hoops/`. Frame count goes in the filename —
`grandma-laces-shot@10.png` — and `systems/sprites/registry.ts` picks it up
from there with nothing to register.

Generate at 256x256 per frame and let the normalizer downscale. Do not
pre-shrink to 32x32; scaling after alignment is far cleaner than before it.
