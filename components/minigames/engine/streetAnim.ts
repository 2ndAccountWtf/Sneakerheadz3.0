/**
 * Playback rules for the street games' delivered sprite sheets.
 *
 * ## Why this exists
 *
 * Flight 404 runs on Phaser, which has a real animation system: you register a
 * key once with its own frame rate and repeat count, and `sprite.play(key)`
 * does the rest. The two street games draw straight onto a 2D canvas, which has
 * nothing of the sort — a sheet is a wide PNG and the only question each frame
 * is "which slice". Both games answered that with `Math.floor(t * 10)`, which
 * is three separate bugs wearing one expression:
 *
 *   1. Every sheet played at the same speed, so a sprinkler and a sprinting dog
 *      ticked over at an identical rate.
 *   2. A rolling cycle ran on the wall clock rather than on distance travelled,
 *      so the rider's feet skated: same push rate at 4 km/h and at 60.
 *   3. Everything looped. A ten-frame fall played its fall, then stood the
 *      rider back up and threw him down again, forever.
 *
 * All three were found and fixed once already, in `flight404/skin.ts`. This is
 * the same discipline for the canvas side: a per-sheet frame rate, a one-shot
 * set that holds on its last frame, and a helper that derives a cycle rate from
 * how fast the thing is actually moving.
 *
 * Nothing here touches a canvas or an image, so it is all testable headlessly —
 * which is the point, because "did the animation look right" is otherwise a
 * question only a human staring at a browser can answer.
 */

/**
 * Frames per second, per asset id.
 *
 * Chosen from what the sheet depicts, not from a house default: a beacon lamp
 * blinks about twice a second, a startled cat crosses the road in a blur, a
 * palm frond moves barely at all. Ids absent from here get `DEFAULT_RATE`.
 *
 * Cycles that travel — the two ride loops, the tiny bicycle — are listed for
 * completeness but are normally overridden per-frame by `cycleRate` below,
 * because their correct rate depends on the speed of the thing, not on a
 * constant.
 */
export const RATE: Record<string, number> = {
    // --- riders: loops -----------------------------------------------------
    'skateboard-ride': 12,
    'skateboard-manual': 7,        // a held balance, not a pumping cycle
    'bike-ride': 12,
    'bike-look-back': 7,           // glance over the shoulder and back
    'bike-wheelie-sparks': 14,
    'bike-thumb-suck': 6,          // taunt idle
    'skateboard-ground-roll': 13,  // tumbling along the tarmac, keeps rolling
    'tiny-bicycle': 12,

    // --- riders: one-shots -------------------------------------------------
    'skateboard-ollie': 16,
    'skateboard-kickflip': 20,
    'skateboard-balance-fall': 11,
    'skateboard-obstacle-trip-forward': 14,
    'skateboard-front-collision-backward': 14,
    'skateboard-burpee-to-stand': 10,
    'skateboard-pushup-recover': 8,
    'bike-fall-off': 11,
    'bike-banana-slip': 13,

    // --- animals -----------------------------------------------------------
    'dog-stray': 8,
    'dog-bark': 10,
    'cat-street': 7,
    'cat-dart': 16,
    'gull': 6,
    'pigeon-flock': 12,
    'feather-puff': 14,

    // --- street furniture and effects --------------------------------------
    'sprinkler': 9,
    'roadworks-lamp': 2.5,         // amber beacon, roughly twice a second
    'hydrant-blown': 15,
    'splash-water': 18,
    'dust-plume': 16,
    'impact-star': 22,
    'speed-lines': 20,
    'palm-sway': 2.5,              // fronds in a breeze, not a gale
    'trolley-shopping': 9,
    'pizza-box': 14,               // end over end through the air
    'car-door-open': 9,
    'window-open': 7,
    'door-front': 7,
    'bmx': 10,
    'longboard': 10,
};

/** For a sheet nobody has given a rate. Slow enough to read, fast enough to live. */
export const DEFAULT_RATE = 8;

/**
 * Sheets that play once and hold on their last frame.
 *
 * The test is whether the sheet ends somewhere different from where it began.
 * A fall ends on the ground; a walk cycle ends where it started, which is what
 * makes it a cycle. Looping the first kind is the bug described at the top of
 * this file — the rider getting up so he can be knocked down again.
 *
 * `skateboard-ground-roll` is deliberately not here: it is a tumble that is
 * meant to keep tumbling for as long as the slide lasts.
 */
export const ONCE: ReadonlySet<string> = new Set([
    'skateboard-ollie',
    'skateboard-kickflip',
    'skateboard-balance-fall',
    'skateboard-obstacle-trip-forward',
    'skateboard-front-collision-backward',
    'skateboard-burpee-to-stand',
    'skateboard-pushup-recover',
    'bike-fall-off',
    'bike-banana-slip',
    'car-door-open',
    'window-open',
    'door-front',
    'splash-water',
    'dust-plume',
    'impact-star',
    'feather-puff',
    'cat-dart',
]);

export const rateFor = (id: string): number => RATE[id] ?? DEFAULT_RATE;
export const loops = (id: string): boolean => !ONCE.has(id);

/**
 * Which frame of `id` is showing `elapsed` seconds after it started.
 *
 * Looping sheets wrap; one-shots clamp to the last frame and stay there. Pass
 * `rate` to override the table — that is how a cycle gets a speed-derived rate
 * and how a one-shot gets stretched to fit an event whose length the game
 * already knows.
 */
export function frameOf(id: string, elapsed: number, frames: number, rate?: number): number {
    const n = Math.max(1, Math.floor(frames));
    if (n === 1) return 0;
    const fps = Math.max(0, rate ?? rateFor(id));
    const i = Math.floor(Math.max(0, elapsed) * fps);
    if (ONCE.has(id)) return Math.min(i, n - 1);
    return i % n;
}

/**
 * Frame rate for a cycle that covers ground, so the art matches the motion.
 *
 * `travel` is how far the thing moves in one full cycle of the sheet, in the
 * same units as `speed` — one push of a longboard, one revolution of the
 * pedals. Below the floor the animation would strobe frame to frame at a
 * standstill; above the ceiling it is a blur nobody can read, and both look
 * worse than being slightly wrong about the distance.
 */
export function cycleRate(frames: number, speed: number, travel: number): number {
    const n = Math.max(1, frames);
    const raw = (n * Math.abs(speed)) / Math.max(1, travel);
    return Math.max(3, Math.min(28, raw));
}

/**
 * Frame rate that fits a whole sheet into `secs`.
 *
 * For a one-shot whose duration the simulation already fixed — the hang time of
 * an ollie, the length of a wipeout — so the last frame lands exactly as the
 * state ends rather than early with a held pose or late with a truncated one.
 */
export const fitRate = (frames: number, secs: number): number =>
    Math.max(1, frames) / Math.max(0.05, secs);

/**
 * Remembers when the current state began.
 *
 * A one-shot needs a start time, and the canvas games only have a running clock
 * and a state name. Handing them this means a state change restarts its sheet —
 * two falls in a row each play from frame one instead of the second picking up
 * wherever the modulo happened to leave the first.
 *
 * One clock per animated thing that has states. Props that only ever loop do
 * not need one; they can index straight off the world clock.
 */
export interface AnimClock {
    /** The state currently playing, or '' before the first frame. */
    key: string;
    /** World time the state began. */
    start: number;
}

export const makeClock = (): AnimClock => ({ key: '', start: 0 });

/**
 * Frame index for `id` at world time `t`, restarting the sheet if the state has
 * changed since the last call. Mutates the clock; call it once per draw.
 */
export function frameFor(
    c: AnimClock,
    id: string,
    t: number,
    frames: number,
    rate?: number,
): number {
    if (c.key !== id) {
        c.key = id;
        c.start = t;
    }
    return frameOf(id, t - c.start, frames, rate);
}

/**
 * A stable per-instance offset, so a row of identical props does not animate in
 * lockstep.
 *
 * Six bins delivered from one sheet all stepping on the same frame reads as a
 * rendering artefact; the eye picks up the sync instantly. Derived from the
 * instance id rather than randomised, so a given bin animates the same way
 * every frame it is on screen and across a replay of the same seed.
 */
export function phaseOf(id: number, frames: number): number {
    const n = Math.max(1, Math.floor(frames));
    // Knuth's multiplicative hash, kept in 32-bit range.
    return (Math.imul(id | 0, 2654435761) >>> 0) % n;
}
