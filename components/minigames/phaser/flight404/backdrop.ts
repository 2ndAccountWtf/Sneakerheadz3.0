/**
 * The background of a section, as a cast rather than as a pile of sprites.
 *
 * `background.ts` says what one actor *does* and `creep.ts` says what a tier
 * *allows*, and between them there was nothing that turned "section two is the
 * `wrong` tier and 640px long" into people standing in places. The scene was
 * going to do it inline, which is how a rule becomes a suggestion: the tier
 * gate lives in one file, the placement loop lives in another, and the first
 * time somebody needs a donkey in Economy for a screenshot there is nothing to
 * stop them. So the gate and the loop are the same function, and the function
 * is tested.
 *
 * Three rules are load-bearing here, and all three are the joke rather than
 * the engineering:
 *
 * **Only what the tier admits.** `populate` reads its cast list out of
 * `CREEP[creep].admits` and cannot be asked for anything else. There is no
 * override parameter, deliberately — a plane section is nearly empty because
 * that is what makes the galley land.
 *
 * **Nothing in here can see the player.** `stepActor` takes no player
 * argument, and neither does `stepBackdrop`; the only way to perturb the cast
 * is `shockwave`, which is a blast going off at an x, not the scenery noticing
 * you standing at one. If this module ever grows a `stepBackdrop(b, dt,
 * playerX)` the bit is dead, and the arity of this function is pinned in the
 * tests for exactly that reason.
 *
 * **Spread, not clustered.** Actors are dealt one per slot along the section
 * instead of drawn from a uniform x, because uniform x over sixteen actors
 * reliably produces two huddles and a gap, and a player walking 760px should
 * meet the background steadily rather than trip over all of it at once.
 */

import {
    openActor, stepActor, blastNear,
    type ActorDef, type ActorKind, type ActorState, type Layer,
} from './background';
import { CREEP, actorBudget, isAnomaly, anomalyBudget, staples, type Creep } from './creep';
import { FLOOR_Y } from './content';
import { TIER } from './terrain';
import { shuffled } from '../../../../utils/rng';

export type { Layer };

/**
 * Where the gameplay starts, mirrored from `gameScene.ts` — props are added at
 * depth 12, mooks at 8, the player at 10. It is here as a number to compare
 * against, not to draw with: the only thing this module promises is that every
 * background actor sorts underneath all of it.
 */
export const GAMEPLAY_DEPTH = 12;

/**
 * The two planes, far and near.
 *
 * Both sit above the parallax strips the scene paints at negative depths and
 * below every figure that can be shot, so the background reads as being in the
 * room without ever being mistaken for something in the fight.
 */
export const DEPTH: Record<Layer, number> = { back: 1, mid: 4 };

/**
 * Feet lines. Further away is higher up the screen, which is the entire trick
 * that makes a flat cabin look deep.
 *
 * Every `back` value has to stay above `FLOOR_Y` by a clear margin or the two
 * planes interleave and the illusion collapses into a crowd of people standing
 * on each other.
 */
export const LAYER_Y: Record<Layer, number> = { back: TIER.seatback, mid: FLOOR_Y };

/** Balcony spectators are leaning over something, so they start higher again. */
const PERCH: Partial<Record<ActorKind, number>> = { balcony: TIER.counter };

/**
 * How much light the plane gets. Distance is sold with haze as much as with
 * size; a back-layer actor drawn at full strength reads as a mid-layer actor
 * who happens to be standing on a shelf.
 */
export const SHADE: Record<Layer, number> = { back: 0.62, mid: 1 };

/**
 * Kinds that only make sense on one plane.
 *
 * Spectators are by definition watching from somewhere else, and a flock needs
 * enough distance that you can see it is a flock. The shawarma spit and the
 * sweeper go the other way: both are gags that depend on the player reading a
 * face, and a face at 62% brightness on the far plane is a smudge. Everything
 * not listed here can live on either plane, which is what keeps a shuk from
 * looking like two tidy rows.
 */
const HOME: Partial<Record<ActorKind, Layer>> = {
    balcony: 'back',
    sheep: 'back',
    shawarma: 'mid',
    sweeper: 'mid',
};

/** Roughly what share of the free-to-choose kinds go to the far plane. */
const BACK_SHARE = 0.4;

/** Kept clear at both ends, so nobody is half off the edge of the section. */
const EDGE = 24;

/**
 * Fraction of a slot left empty at each end.
 *
 * This is what guarantees two actors never land on the same x: each one is
 * jittered strictly inside its own slot, so the ordering is fixed by
 * construction rather than by a retry loop that might not terminate in a
 * crowded `bedlam` section.
 */
const SLOT_INSET = 0.18;

export interface Placement {
    def: ActorDef;
    x: number;
    y: number;
    layer: Layer;
    /** Sorts under everything in `gameScene.ts` that can be shot. */
    depth: number;
    /** Brightness multiplier. Further away is darker. */
    shade: number;
}

const layerFor = (kind: ActorKind, rng: () => number): Layer =>
    HOME[kind] ?? (rng() < BACK_SHARE ? 'back' : 'mid');

const yFor = (kind: ActorKind, layer: Layer): number => PERCH[kind] ?? LAYER_Y[layer];

/**
 * Deal a section's worth of background actors.
 *
 * Kinds come out of a bag that is reshuffled when it empties, rather than by
 * drawing independently each time. Independent draws give you five donkeys in
 * a row about as often as you would expect, and five donkeys in a row is not
 * randomness to a player, it is a bug — while a bag guarantees the tier's
 * whole cast list appears before any of it repeats.
 */
export function populate(creep: Creep, length: number, rng: () => number = Math.random): Placement[] {
    const n = actorBudget(creep, length);
    const span = Math.max(1, length - EDGE * 2);
    const slot = span / n;

    const out: Placement[] = [];
    let bag: ActorKind[] = [];
    let staple: ActorKind[] = [];
    let odd = 0;

    for (let i = 0; i < n; i++) {
        if (bag.length === 0) bag = shuffled(CREEP[creep].admits, rng);
        let kind = bag.pop()!;

        // The tier's ration, spent. Anything further that would have been the
        // joke becomes one of the passengers instead — the section keeps the
        // body count that makes it busier than the last one, and keeps exactly
        // one thing in it that has no business being there. See `ration` in
        // `creep.ts` for why the two cannot be the same number.
        if (isAnomaly(creep, kind)) {
            if (odd >= anomalyBudget(creep)) {
                if (staple.length === 0) staple = shuffled(staples(creep), rng);
                kind = staple.pop()!;
            } else {
                odd++;
            }
        }
        const layer = layerFor(kind, rng);
        const y = yFor(kind, layer);
        const x = EDGE + slot * (i + SLOT_INSET + rng() * (1 - SLOT_INSET * 2));
        const facing: -1 | 1 = rng() < 0.5 ? -1 : 1;

        out.push({ def: { kind, x, y, layer, facing }, x, y, layer, depth: DEPTH[layer], shade: SHADE[layer] });
    }
    return out;
}

/**
 * A whole section's background, in one object the scene can hold.
 *
 * `actors` and `placements` are parallel by index and stay that way: nothing
 * in here moves, because a background actor that walks is a background actor
 * the player will eventually try to follow.
 */
export interface Backdrop {
    actors: ActorState[];
    placements: Placement[];
}

export function openBackdrop(creep: Creep, length: number, rng: () => number = Math.random): Backdrop {
    const placements = populate(creep, length, rng);
    // Opened from the same stream, so the staggering `openActor` does is part
    // of the same seed — one key reproduces the entire section, positions and
    // performance schedules together.
    return { placements, actors: placements.map(p => openActor(p.def, rng)) };
}

/**
 * What one actor is doing this frame. Pure presentation: a renderer needs the
 * position every frame anyway, so the frame carries it rather than making the
 * caller index back into `placements` and get the two lists out of step.
 */
export interface BackdropFrame {
    index: number;
    kind: ActorKind;
    /** A beat to play this frame, or null — which is almost always. */
    beat: string | null;
    ducking: boolean;
    x: number;
    y: number;
    layer: Layer;
    depth: number;
    shade: number;
}

/**
 * Advance the whole background one frame.
 *
 * Note what is not in this signature. There is no player position, no camera,
 * no list of live enemies, and no section state — because every one of those
 * is a door to the scenery noticing you, and the moment it notices you it
 * stops being scenery and starts being a game element nobody can shoot.
 */
export function stepBackdrop(
    b: Backdrop,
    dt: number,
    rng: () => number = Math.random,
): { backdrop: Backdrop; frames: BackdropFrame[] } {
    const actors: ActorState[] = [];
    const frames: BackdropFrame[] = [];

    for (let i = 0; i < b.actors.length; i++) {
        const r = stepActor(b.actors[i], dt, rng);
        const p = b.placements[i];
        actors.push(r.state);
        frames.push({
            index: i,
            kind: p.def.kind,
            beat: r.beat,
            ducking: r.state.ducking > 0,
            x: p.x, y: p.y, layer: p.layer, depth: p.depth, shade: p.shade,
        });
    }
    return { backdrop: { actors, placements: b.placements }, frames };
}

/**
 * A blast went off at `x`. The one sanctioned way to touch the background.
 *
 * It takes a position and a radius because that is what a blast is — it would
 * do the same thing if the player were not in the room. `blastNear` decides
 * who actually flinches, which is where the shawarma guy's exemption lives:
 * he is in range and he does not care, and that is funnier than anything he
 * could do instead.
 */
export function shockwave(
    b: Backdrop,
    x: number,
    radius: number,
    rng: () => number = Math.random,
): Backdrop {
    const actors = b.actors.map((a, i) =>
        Math.abs(b.placements[i].x - x) <= radius ? blastNear(a, rng) : a);
    return { actors, placements: b.placements };
}

/** How far apart the two nearest actors ended up. Diagnostics, and tests. */
export const tightestGap = (placements: Placement[]): number => {
    const xs = placements.map(p => p.x).sort((a, b) => a - b);
    let min = Infinity;
    for (let i = 1; i < xs.length; i++) min = Math.min(min, xs[i] - xs[i - 1]);
    return min;
};
