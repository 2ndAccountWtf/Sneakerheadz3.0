/**
 * Waves, instead of a fixed gauntlet.
 *
 * Every enemy in the cabin is placed at a literal x-position, so a section is a
 * memorisable sequence: learn where they stand, and the second run is a walk.
 *
 * The Metal Slug clones do the better thing — a **spawner** is an object placed
 * in the level with an interval, a roster and an activation range, and it
 * starts producing when the player gets near. That buys three things the fixed
 * list cannot: pressure that builds while you are busy, enemies arriving from
 * behind you, and a section that plays differently depending on how fast you
 * move through it.
 *
 * Both survive: an authored `mooks` list still places the set pieces, and
 * spawners supply the pressure between them.
 */

import type { MookKind } from './content';

export interface SpawnerDef {
    /** Where it sits in the level. */
    x: number;
    /** Which side of the player they come in from. */
    side?: 'ahead' | 'behind';
    /** What it can produce, picked round-robin so a wave is readable. */
    roster: MookKind[];
    /** Seconds between spawns once it is awake. */
    interval: number;
    /** Total it will ever produce. A spawner is a wave, not a faucet. */
    total: number;
    /** How close the player has to get before it wakes up. */
    range?: number;
}

export const DEFAULT_RANGE = 150;

/** Live state for one spawner. Kept out of the scene so it can be stepped in a test. */
export interface SpawnerState {
    def: SpawnerDef;
    awake: boolean;
    produced: number;
    /** Seconds until the next one. */
    timer: number;
}

export const openSpawner = (def: SpawnerDef): SpawnerState => ({
    def,
    awake: false,
    produced: 0,
    // Staggered, so two spawners in one section do not fire in lockstep.
    timer: def.interval * 0.5,
});

export const spent = (s: SpawnerState): boolean => s.produced >= s.def.total;

export const inRange = (s: SpawnerState, playerX: number): boolean =>
    Math.abs(playerX - s.def.x) <= (s.def.range ?? DEFAULT_RANGE);

export interface SpawnerStep {
    state: SpawnerState;
    /** What to spawn this frame, if anything. */
    spawn: MookKind | null;
}

/**
 * Advances one spawner. Wakes on proximity, then produces on its interval until
 * it is spent. Never produces on the frame it wakes — arriving the instant you
 * cross an invisible line reads as a cheat rather than an ambush.
 */
export function stepSpawner(state: SpawnerState, dt: number, playerX: number): SpawnerStep {
    if (spent(state)) return { state, spawn: null };

    if (!state.awake) {
        if (!inRange(state, playerX)) return { state, spawn: null };
        return { state: { ...state, awake: true }, spawn: null };
    }

    const timer = state.timer - dt;
    if (timer > 0) return { state: { ...state, timer }, spawn: null };

    const kind = state.def.roster[state.produced % state.def.roster.length];
    return {
        state: { ...state, produced: state.produced + 1, timer: timer + state.def.interval },
        spawn: kind,
    };
}
