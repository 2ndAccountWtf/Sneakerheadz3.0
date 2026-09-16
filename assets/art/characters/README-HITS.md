# Hit and crash animations

**Drop PNGs straight into this folder** alongside the existing rider sheets.
Nothing to register — a file that lands here is picked up on the next build, and
the game starts using it immediately.

The brief is **[`docs/ASSETS-HITS.md`](../../../docs/ASSETS-HITS.md)**: every
character, every object that can hit them, and the exact windows the simulation
gives each animation.

## The two-minute version

| | |
|---|---|
| **Scale** | **3×** the sizes in the brief. A 26px rider is a 78px PNG. |
| **Naming** | `name@N.png`, N = the real frame count |
| **Frames** | Left to right, evenly spaced, all the same width |
| **Format** | PNG with a real alpha channel. No matte colour. |
| **Ground line** | Bottom row, at the contact point — wheels, feet, or the body for something lying down |
| **Facing** | Right. The game mirrors as needed. |

## The rules that are specific to hits

- **A fallen pose still anchors at the bottom of the frame.** Do not recentre it;
  every frame is drawn from the same origin, so a sheet that shifts its anchor
  mid-fall makes the rider jump.
- **One-shots must end where the next state begins.** A get-up sheet ends in the
  ride cycle's first pose, or the return to normal snaps.
- **Loops must start and end in the same pose** — the slide is a cycle and the
  game does not know how long it will run.
- **No impact flash, dust or water in the character frames.** Those are their own
  sheets (`impact-star@5`, `dust-plume@5`, `splash-water@5`, `feather-puff@4`)
  and drawing them in gives you two of everything.

## Where to start

The brief ends with a priority list. The top of it is
`skateboard-hit-stumble@8` — a clipped-but-recovered stumble, which is what
makes a 6-damage wheelie bin look different from a 14-damage Camry. Right now
they are identical.

## A note on the existing sheets

The rider sheets already here came in smaller than the brief asked —
`skateboard-ride` is authored 13 × 10 where the brief's 23px-adult reference
puts a rider on a board at about 26 — so the game draws them at roughly three
times their own size to compensate. New sheets drawn to the brief will look
sharper than the old ones. That is the right direction; the old ones are the
ones that will eventually want redrawing.
