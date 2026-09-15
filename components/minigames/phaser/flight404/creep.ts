/**
 * How far this part of the plane has stopped being a plane.
 *
 * The level is a gradient, and the gradient *is* the joke. You board a normal
 * aircraft — seats, overhead bins, windows, the smell of tahini. A few rows
 * later there is a man brewing coffee on a fingjan next to his donkey, and the
 * cabin has not otherwise changed, which is the moment the player goes *wait,
 * what*. Keep walking and the lie-flats have become market stalls with cloth
 * hung between them, a shawarma spit, a falafel stand, and a great many people
 * who would like a word.
 *
 * The escalation is the entire mechanism. If the first section is already a
 * bazaar there is no "wait, what" to have — the player just accepts a weird
 * game and nothing lands afterwards. So this is a dial with a rule attached:
 * **it only ever goes up.** `neverRetreats()` below is not a nicety, it is the
 * structural requirement, and it is tested.
 *
 * The tiers gate three things: which background kinds may appear at all, how
 * crowded it gets, and which scenery the section is dressed with. A donkey in
 * Economy would spend the joke before it was set up.
 */

import type { ActorKind } from './background';

export type Creep = 'plane' | 'wrong' | 'shuk' | 'bedlam';

/** Ordered, because "it only goes up" needs something to compare. */
export const CREEP_ORDER: Creep[] = ['plane', 'wrong', 'shuk', 'bedlam'];
export const creepRank = (c: Creep): number => CREEP_ORDER.indexOf(c);

export interface CreepTier {
    /** What the player should be thinking. Kept here as the design intent. */
    reads: string;
    /** Background kinds allowed to exist at this tier. */
    admits: ActorKind[];
    /** Roughly how many background actors per 100px of section. */
    density: number;
    /** Scenery strips this tier dresses the cabin with. */
    dressing: string[];
}

export const CREEP: Record<Creep, CreepTier> = {
    /**
     * A plane. Nothing is wrong. This tier exists so the next one can be
     * wrong — spend no jokes here.
     */
    plane: {
        reads: 'I am on a plane.',
        admits: ['balcony'],           // passengers, staring over seat backs
        density: 0.4,
        dressing: ['seats', 'bins', 'windowwall', 'carpet'],
    },

    /**
     * Still recognisably an aircraft, with exactly one thing in it that has no
     * business being there. One is the correct number: two men and a donkey is
     * a bazaar, one man and a donkey is a question.
     */
    wrong: {
        reads: 'I am on a plane. Why is there a donkey.',
        admits: ['balcony', 'coffee', 'donkey', 'sweeper'],
        density: 0.9,
        dressing: ['seats', 'bins', 'galleywall', 'carpet', 'rug'],
    },

    /**
     * The cabin has lost. Cloth hung between the lie-flats, a shawarma spit
     * where the galley was, stalls in the aisle, and everybody talking.
     */
    shuk: {
        reads: 'This is a market. I am also still on a plane.',
        admits: ['coffee', 'shawarma', 'sweeper', 'porter', 'argument', 'donkey', 'sheep', 'balcony'],
        density: 2.0,
        dressing: ['awning', 'hangingcloth', 'stalls', 'lamps', 'rug', 'carpet'],
    },

    /**
     * The boss arena. Everything at once, and the background carries on
     * regardless — which is the whole point of the fight.
     */
    bedlam: {
        reads: 'Everyone is here and nobody is helping.',
        admits: ['coffee', 'shawarma', 'sweeper', 'porter', 'argument', 'donkey', 'sheep', 'balcony'],
        density: 3.2,
        dressing: ['awning', 'hangingcloth', 'stalls', 'lamps', 'rug', 'carpet', 'bunting'],
    },
};

export const admits = (c: Creep, kind: ActorKind): boolean => CREEP[c].admits.includes(kind);

/** How many background actors a section of this length should carry. */
export const actorBudget = (c: Creep, length: number): number =>
    Math.max(1, Math.round((length / 100) * CREEP[c].density));

/**
 * The rule the joke depends on: the weirdness never retreats.
 *
 * Going back to a normal cabin after a shuk does not read as variety, it reads
 * as the level forgetting itself — and it spends the escalation you cannot get
 * back. Equal is allowed (two shuk sections in a row is a longer shuk); a step
 * down is not.
 */
export function neverRetreats(order: Creep[]): boolean {
    for (let i = 1; i < order.length; i++) {
        if (creepRank(order[i]) < creepRank(order[i - 1])) return false;
    }
    return true;
}

/** Where the "wait, what" lands — the first step up from a plain cabin. */
export const firstTurn = (order: Creep[]): number =>
    order.findIndex(c => creepRank(c) > creepRank('plane'));
