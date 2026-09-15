/**
 * Things that move on their own.
 *
 * A level where only the enemies move is a shooting gallery. A trolley rolling
 * down the aisle at you is a different problem from a man walking down it, and
 * a belt that carries you is a rung that arrives on a schedule.
 *
 * `moverAt` is deliberately a pure function of time rather than integrated
 * state, so a level can be checked without a scene: a belt whose timing never
 * lines up with the rung it feeds is a level that cannot be finished, and that
 * is not something to discover by playing.
 */

export type MoverKind =
    | 'runaway'    // a trolley loose in the aisle, rolling, hurts on contact
    | 'belt'       // baggage belt: carries whatever stands on it
    | 'binSwing';  // a bin door swinging open and shut — a rung with timing

export interface MoverDef {
    kind: MoverKind;
    /** The span it travels along, in world x. */
    from: number;
    to: number;
    /** Resting height. A belt and a swinging door are platforms; a runaway is not. */
    y?: number;
    /** Pixels per second. */
    speed: number;
    /** Seconds to wait at each end, so timing is readable rather than frantic. */
    dwell?: number;
}

/** A mover you can stand on, as opposed to one that just hits you. */
export const isRideable = (m: MoverDef): boolean => m.kind !== 'runaway';

/** How long one there-and-back takes, including both dwells. */
export function cycleTime(m: MoverDef): number {
    const span = Math.abs(m.to - m.from);
    if (span === 0 || m.speed <= 0) return 0;
    return (span / m.speed + (m.dwell ?? 0)) * 2;
}

/** Where a mover is at time `t`. */
export function moverAt(m: MoverDef, t: number): number {
    const span = Math.abs(m.to - m.from);
    if (span === 0 || m.speed <= 0) return m.from;
    const travel = span / m.speed;
    const dwell = m.dwell ?? 0;
    const cycle = (travel + dwell) * 2;
    const phase = ((t % cycle) + cycle) % cycle;

    if (phase < travel) return m.from + (m.to - m.from) * (phase / travel);
    if (phase < travel + dwell) return m.to;
    const back = phase - travel - dwell;
    if (back < travel) return m.to + (m.from - m.to) * (back / travel);
    return m.from;
}
