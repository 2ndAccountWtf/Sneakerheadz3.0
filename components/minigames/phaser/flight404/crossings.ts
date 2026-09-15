/**
 * Things that run through the cabin and are gone.
 *
 * `background.ts` holds the cast that *lives* in a section: a coffee crew, a
 * man sweeping, a shawarma spit. They stand still on purpose — "a background
 * actor that walks is a background actor the player will eventually try to
 * follow" — and their presence is what tells you the plane has stopped being a
 * plane. By the time a donkey is standing in the aisle, this is a bazaar.
 *
 * This module is the other half, and it exists because those are two different
 * jokes. A donkey *standing* in row 32 says the cabin has lost. A donkey
 * running the length of the aisle and out through the galley says something
 * much better: **wait, was that a donkey?** The second one works in an
 * ordinary cabin where nothing else is wrong, and it works precisely because
 * there is nothing to check it against — you cannot go and look, because it has
 * gone.
 *
 * So an ordinary cabin gets livestock after all. It just does not get to keep
 * any.
 *
 * ## The rules, which are the same rules
 *
 * **Nothing here knows about the player.** `stepCrossing` takes no player
 * argument, for the same reason `stepActor` does not: a camel that swerves
 * around you is a game element, and a camel that walks straight through the
 * firefight without breaking stride is the joke. Crossings have no hitbox, take
 * no damage, and block nothing.
 *
 * **Every crossing leaves.** There is no phase that does not lead to `gone`,
 * and the balk below is bounded. A crossing that stalled in the middle of the
 * aisle would quietly become a resident, which is the one thing this module
 * exists not to do.
 */
import type { Layer } from './background';

export type CrossingKind =
    | 'donkey'    // unbothered. Sets the pace for everything else here.
    | 'sheep'     // a flock, moving as one badly-organised object
    | 'camel'     // too tall for the cabin. This is the entire bit.
    | 'goats'     // faster than sheep and worse behaved
    | 'chickens'  // low, fast, and in several directions at once
    | 'cart'      // vegetables, pushed by somebody who will not be hurried
    | 'tea'       // the brass urn, pouring over his shoulder, not spilling
    | 'rug'       // a rolled carpet longer than the aisle is wide
    | 'bread'     // a tray of ka'ak carried flat on the head
    | 'bicycle';  // through an aeroplane, ringing the bell

export const CROSSING_KINDS: CrossingKind[] = [
    'donkey', 'sheep', 'camel', 'goats', 'chickens',
    'cart', 'tea', 'rug', 'bread', 'bicycle',
];

/**
 * How fast each thing crosses, px/s.
 *
 * All of them slower than the player's 88, so a crossing can be overtaken and
 * looked at. Something that outruns the player is a thing you half-see and
 * doubt; something you can walk alongside is a thing you tell people about.
 * The chickens are the exception and are supposed to be.
 */
export const CROSS_SPEED: Record<CrossingKind, number> = {
    donkey: 26, sheep: 22, camel: 20, goats: 40, chickens: 74,
    cart: 18, tea: 30, rug: 16, bread: 28, bicycle: 62,
};

/**
 * How wide the thing is, for spacing and for the art list. A flock is one
 * object as far as this module is concerned.
 */
export const CROSS_WIDTH: Record<CrossingKind, number> = {
    donkey: 26, sheep: 34, camel: 32, goats: 30, chickens: 26,
    cart: 30, tea: 20, rug: 44, bread: 22, bicycle: 26,
};

/**
 * The one thing each does mid-aisle, and the reason it is worth animating.
 *
 * Every one of these is a beat the player catches only if they happen to be
 * looking, which is correct: the whole value of a crossing is that you are not
 * sure you saw it.
 */
export const BALK: Record<CrossingKind, string> = {
    donkey: 'it stops dead, for its own reasons',
    sheep: 'the flock bunches at nothing and spreads out again',
    camel: 'it has to duck under the overhead bins, and does not enjoy it',
    goats: 'one gets up on a seat back and is removed',
    chickens: 'they scatter, regroup, and continue as one',
    cart: 'a wheel catches on the aisle runner',
    tea: 'he pours one, over his shoulder, without looking or stopping',
    rug: 'it will not fit and has to be turned, twice',
    bread: 'he adjusts the tray with one finger. Nothing falls',
    bicycle: 'he rings the bell. Nobody moves',
};

/** How long a balk lasts, and how likely one is per crossing. */
export const BALK_HOLD = 1.6;
export const BALK_CHANCE = 0.45;

/**
 * A crossing that never balks still has to end, so this is the hard ceiling on
 * how long one may exist regardless of speed, balks or section length. Nothing
 * in this file lives forever — the same promise `projectiles.ts` makes, for the
 * same reason.
 */
export const CROSS_LIFE = 60;

export type CrossingPhase = 'crossing' | 'balked' | 'gone';

export interface CrossingDef {
    kind: CrossingKind;
    /** Which edge it entered from: -1 walks left-to-right, 1 right-to-left. */
    from: -1 | 1;
    y: number;
    layer: Layer;
}

export interface CrossingState {
    def: CrossingDef;
    x: number;
    phase: CrossingPhase;
    /** Seconds left in a balk. */
    hold: number;
    /** Whether this one has already had its beat. One each, at most. */
    balked: boolean;
    /** Seconds it has existed, against `CROSS_LIFE`. */
    age: number;
    /** Where it came in. Kept so progress can be measured from both ends. */
    startX: number;
    /** Where it stops existing. */
    exitX: number;
}

/**
 * Start one at the edge of a section, walking in.
 *
 * It begins fully off-screen and ends fully off-screen, so a player at either
 * end of the cabin sees it arrive rather than appear.
 */
export function openCrossing(
    kind: CrossingKind, length: number, y: number, layer: Layer,
    from: -1 | 1, rng: () => number = Math.random,
): CrossingState {
    const w = CROSS_WIDTH[kind];
    const startX = from < 0 ? -w : length + w;
    const exitX = from < 0 ? length + w : -w;
    return {
        def: { kind, from, y, layer },
        x: startX,
        phase: 'crossing',
        hold: 0,
        // A flat chance per crossing rather than per frame: per-frame rolls make
        // long sections balk constantly and short ones never, which is the
        // opposite of what a level designer would choose.
        balked: rng() >= BALK_CHANCE,
        age: 0,
        startX,
        exitX,
    };
}

export interface CrossingStep {
    state: CrossingState;
    /** The beat, on the single frame it starts. Pure presentation. */
    beat: string | null;
}

/**
 * Advance one crossing.
 *
 * Note the signature: state, dt, and rng. There is nowhere to put a player
 * position and that is deliberate — see the header. If this ever grows a fourth
 * parameter the bit is dead.
 */
export function stepCrossing(
    state: CrossingState, dt: number, rng: () => number = Math.random,
): CrossingStep {
    if (state.phase === 'gone') return { state, beat: null };

    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    const age = state.age + step;
    // The ceiling. Whatever else has happened, it is off the plane now.
    if (age >= CROSS_LIFE) return { state: { ...state, age, phase: 'gone' }, beat: null };

    if (state.phase === 'balked') {
        const hold = state.hold - step;
        if (hold > 0) return { state: { ...state, hold, age }, beat: null };
        return { state: { ...state, hold: 0, age, phase: 'crossing' }, beat: null };
    }

    const dir = state.def.from < 0 ? 1 : -1;
    const x = state.x + dir * CROSS_SPEED[state.def.kind] * step;

    // Out the other side. It does not turn round and it does not come back.
    const done = dir > 0 ? x >= state.exitX : x <= state.exitX;
    if (done) return { state: { ...state, x, age, phase: 'gone' }, beat: null };

    // The beat lands somewhere in the middle third, so it happens in the cabin
    // rather than in the doorway where nobody is looking.
    //
    // Progress is measured from `startX`, which is why that field exists.
    // Deriving the start from the direction instead looks equivalent and is
    // not: for a right-to-left crossing it measures the distance to the exit
    // and divides by zero, so every one of them silently never balked. Half the
    // livestock in the game crossed without doing its bit, and nothing failed.
    if (!state.balked) {
        const total = Math.abs(state.exitX - state.startX) || 1;
        const through = Math.abs(x - state.startX) / total;
        if (through > 0.33 && through < 0.66 && rng() < step * 1.6) {
            return {
                state: { ...state, x, age, balked: true, phase: 'balked', hold: BALK_HOLD },
                beat: BALK[state.def.kind],
            };
        }
    }

    return { state: { ...state, x, age }, beat: null };
}

export const crossingGone = (c: CrossingState): boolean => c.phase === 'gone';

/**
 * Deliberately the same shape as `isInteractive` in `background.ts`: a constant
 * `false` that exists to be imported by anything tempted to give one of these a
 * hitbox. Shots pass through a camel.
 */
export const isInteractive = (): false => false;
