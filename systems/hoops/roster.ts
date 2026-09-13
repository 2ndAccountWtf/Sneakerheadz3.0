/**
 * Who you are actually playing against.
 *
 * The four players on the blacktop were palette swaps of one body. Same top
 * speed, same vertical, same dunk range, same shooting touch — the only
 * difference between them was the colour of the vest. And the opponent's skill
 * rating, which `systems/opponents.ts` has carried all along (Grandma Laces
 * 0.80, Scalper Sid 0.70, Yasser Abbasfat 0.30), was computed, threaded through
 * the venue screen and the mini-game host, and then dropped on the floor: the
 * component never destructured it. Every challenge in the game played
 * identically.
 *
 * That is the single biggest thing between this and an arcade basketball game
 * you remember. NBA Jam's roster mattered because a 9-dunk 3-speed bruiser
 * played nothing like a 9-three-point 4-dunk shooter, and you could feel which
 * one you had picked within about four seconds.
 *
 * So: seven attributes, each 0..1 with 0.5 meaning "an ordinary person", and a
 * profile per named NPC. The rules for these numbers:
 *
 *   1. **Every attribute must be felt, not read.** If turning `range` up does
 *      not visibly change how somebody plays, it is a stat block, not a
 *      character. Each one is wired to something the player can see happening.
 *   2. **Nobody is good at everything.** A profile's attributes should sum to
 *      roughly the same budget, so a 0.8 somewhere is paid for by a 0.3
 *      elsewhere. The `skill` rating sets the budget; the archetype spends it.
 *   3. **The extremes are the point.** A shooter who genuinely cannot dunk is
 *      more interesting than four people who are all a bit above average.
 */

/** Each 0..1. 0.5 is unremarkable; 0.9 is the best on any blacktop. */
export interface Attributes {
    /** Top running speed, and how much turbo adds on top. */
    speed: number;
    /** Vertical leap — contest height, rebound reach, hang time. */
    jump: number;
    /** Dunk range, and how willing they are to go up rather than pull up. */
    dunk: number;
    /** Shooting touch from distance. Drives the three-point game. */
    range: number;
    /** Ball security: resistance to steals, shoves and pass interception. */
    handles: number;
    /** Block and steal success on defence. */
    defense: number;
    /** Turbo capacity and how fast it comes back. */
    stamina: number;
}

export interface HoopsProfile {
    /** Must be a real id from the NPC roster, or 'generic'. */
    npcId: string;
    name: string;
    attributes: Attributes;
    /** One line on how they play. Shown before tip-off. */
    style: string;
    /**
     * The one thing they do that nobody else does, as a short label — the
     * announcer and the pre-game card both use it.
     */
    signature: string;
}

/** A body with no opinions. Every profile is a deviation from this. */
export const BASELINE: Attributes = {
    speed: 0.5, jump: 0.5, dunk: 0.5, range: 0.5,
    handles: 0.5, defense: 0.5, stamina: 0.5,
};

/** The total any profile is allowed to spend, before the skill adjustment. */
export const ATTRIBUTE_BUDGET = 3.5;

/**
 * A profile for an NPC. Falls back to a competent nobody built from the raw
 * skill rating, so an unknown id still plays sensibly rather than throwing.
 */
export function profileFor(npcId: string | undefined, skill = 0.5): HoopsProfile {
    const known = npcId ? ROSTER[npcId] : undefined;
    if (known) return known;
    return {
        npcId: npcId ?? 'generic',
        name: 'Some Guy',
        attributes: spread(skill),
        style: 'Plays like somebody who plays a lot.',
        signature: 'Nothing special',
    };
}

/**
 * Turns a single skill rating into a flat attribute set. Used for unnamed
 * opponents and as the starting point when authoring a profile.
 */
export function spread(skill: number): Attributes {
    const v = 0.25 + Math.max(0, Math.min(1, skill)) * 0.5;
    return { speed: v, jump: v, dunk: v, range: v, handles: v, defense: v, stamina: v };
}

/** Sums an attribute set, for the budget check the tests enforce. */
export const total = (a: Attributes): number =>
    a.speed + a.jump + a.dunk + a.range + a.handles + a.defense + a.stamina;

/**
 * The named roster. Filled in against the real NPC ids in
 * `systems/opponents.ts` — every key here must be one of them.
 */
export const ROSTER: Record<string, HoopsProfile> = {};
