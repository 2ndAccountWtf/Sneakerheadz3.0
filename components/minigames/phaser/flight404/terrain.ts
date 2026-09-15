/**
 * The cabin as a place, rather than a corridor.
 *
 * Flight 404 shipped with a jump button and nothing to land on. A section was
 * `length`, `dark`, and lists of x-positions — no terrain in the data model at
 * all — so the only axis that meant anything was forward. The game already
 * *imagined* the overhead bins as a place: a perched thrower is placed at
 * `BIN_FEET` with `setAllowGravity(false)`, floating on a shelf that does not
 * exist as collision. This makes that shelf real, and adds the rungs needed to
 * climb to it.
 *
 * ## Why reachability is computed and not eyeballed
 *
 * One jump is worth exactly `JUMP_V² / (2 · GRAVITY)` = 218² / 1240 ≈ **38px**.
 * The bins are 106px above the floor. So a bin is three hops up, and a platform
 * placed 40px above its neighbour is indistinguishable from one placed 36px
 * above — until a player is standing under it, unable to get up, in a section
 * with the exit above them. That is not a bug you find by looking at the level;
 * it is a bug you find in a bug report. So the climb is arithmetic, checked by
 * `tests/flight404.test.mts` against every platform in the game.
 */

import { GRAVITY, JUMP_V, FLOOR_Y, BIN_FEET, PLAYER_H, RUN_SPEED } from './content';

/** How high one jump lifts the player's feet, in pixels. */
export const JUMP_PEAK = (JUMP_V * JUMP_V) / (2 * GRAVITY);

/**
 * The most we will ever ask of a single hop.
 *
 * Deliberately under `JUMP_PEAK`. Landing exactly at the apex means arriving
 * with zero vertical velocity on the one frame the box overlaps, which reads as
 * "the jump didn't work" about half the time. The margin is what makes a rung
 * feel like a rung.
 */
export const HOP_MARGIN = 4;
export const MAX_STEP = JUMP_PEAK - HOP_MARGIN;

/**
 * The rungs, floor upward. Every gap is inside one jump, by construction.
 *
 * The bins sit 106px above the aisle and one hop is worth 34, so the climb
 * needs four rungs, not two. The first draft of this table used three and was
 * wrong by 2px a step — caught immediately by the arithmetic below, which is
 * the entire reason it is arithmetic. Four evenly spaced rungs also happen to
 * be exactly what a cabin has in it.
 */
export const TIER = {
    /** The aisle. */
    floor: FLOOR_Y,
    /** Seat cushion and armrest — the first thing you scramble onto. */
    seat: 137,
    /** The top of a seat back. Narrow, and cover if you crouch on it. */
    seatback: 111,
    /** Galley counters and bulkhead ledges. */
    counter: 84,
    /** The overhead bins, where the throwers were already floating. */
    bin: BIN_FEET,
} as const;

export type TierName = keyof typeof TIER;

export type PlatformKind = 'bin' | 'seat' | 'counter' | 'crate';

export interface PlatformDef {
    x: number;
    /** Top surface. Feet rest here. */
    y: number;
    w: number;
    kind: PlatformKind;
    /**
     * Jump-through from below and drop through with down+jump, the way a seat
     * back works and a bulkhead does not.
     */
    oneWay?: boolean;
}

/** Can a player standing on `from` reach the top of `to`? */
export const canHop = (fromY: number, toY: number): boolean => fromY - toY <= MAX_STEP;

/** Every distinct surface height a player can be standing on in a section. */
export function surfaces(platforms: PlatformDef[]): number[] {
    return [...new Set([FLOOR_Y, ...platforms.map(p => p.y)])].sort((a, b) => b - a);
}

/**
 * Is every platform in this section climbable from the floor?
 *
 * Walks up from the floor taking any platform within one hop, then repeats
 * until nothing new is reachable — so a bin is reachable only if something
 * exists to reach it *from*. Horizontal position is checked too: a rung you
 * cannot run to is not a rung.
 */
export function unreachable(platforms: PlatformDef[]): PlatformDef[] {
    const reached: { y: number; x0: number; x1: number }[] = [
        { y: FLOOR_Y, x0: -Infinity, x1: Infinity },
    ];
    const left = [...platforms];

    for (let pass = 0; pass < platforms.length + 1; pass++) {
        let moved = false;
        for (let i = left.length - 1; i >= 0; i--) {
            const p = left[i];
            const ok = reached.some(r =>
                canHop(r.y, p.y)
                // You have to be able to stand somewhere under or beside it: the
                // run is horizontal, so the spans must overlap or touch.
                && r.x1 >= p.x - RUN_SPEED / 4
                && r.x0 <= p.x + p.w + RUN_SPEED / 4);
            if (ok) {
                reached.push({ y: p.y, x0: p.x, x1: p.x + p.w });
                left.splice(i, 1);
                moved = true;
            }
        }
        if (!moved) break;
    }
    return left;
}

/** A platform low enough to crack your head on while running under it. */
export const headroom = (p: PlatformDef): number => FLOOR_Y - p.y;
export const blocksRunning = (p: PlatformDef): boolean => headroom(p) < PLAYER_H;
