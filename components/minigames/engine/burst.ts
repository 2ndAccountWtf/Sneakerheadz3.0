/**
 * One-shot effect sheets: a puff of dust, a star of impact, a spray of water.
 *
 * ## Why these are not sparks
 *
 * Both street games already have a particle list — `sparks` — which throws a
 * handful of emoji outward under gravity and fades them. That is the right
 * model for confetti and the wrong one for a drawn effect: a delivered
 * `dust-plume@5` is one animation that plays once, in one place, and ends. It
 * has no velocity, no gravity and no fade; it has five frames and a rate, and
 * when it reaches the last frame it is over.
 *
 * So a burst is a sheet, a position, and a clock. It carries `vx` only so an
 * effect on a moving world can stay put relative to the road rather than
 * relative to the screen, which is not physics so much as bookkeeping.
 *
 * The simulation here is pure — no canvas, no images — so how long an effect
 * lives and when it is cleaned up is testable. Drawing stays at the call sites,
 * where the game already knows how it scales and layers its own world.
 */
import { rateFor } from './streetAnim';

export interface Burst {
    /** Asset id of the sheet to play. */
    id: string;
    x: number;
    y: number;
    /** Drawn height in game pixels. */
    size: number;
    /** Seconds since it started. */
    t: number;
    /** Seconds it runs for: its frame count over its frame rate. */
    life: number;
    /** Drift, for an effect pinned to a world that is scrolling under it. */
    vx: number;
}

/** The most effects either game will hold at once. Past this, new ones are dropped. */
export const BURST_CAP = 14;

/**
 * Start an effect. `frames` comes from the delivered sheet, so an effect whose
 * art has not arrived (one frame) lasts one frame's worth of time and vanishes
 * rather than sitting on screen as nothing for half a second.
 */
export function addBurst(
    list: Burst[],
    id: string,
    x: number,
    y: number,
    size: number,
    frames: number,
    vx = 0,
    cap = BURST_CAP,
): void {
    if (list.length >= cap) return;
    const n = Math.max(1, Math.floor(frames));
    list.push({ id, x, y, size, t: 0, life: n / Math.max(1, rateFor(id)), vx });
}

/**
 * Advance every effect and drop the finished ones. Iterates backwards so
 * removing one does not skip the next.
 */
export function stepBursts(list: Burst[], dt: number): void {
    for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        b.t += dt;
        b.x += b.vx * dt;
        if (b.t >= b.life) list.splice(i, 1);
    }
}
