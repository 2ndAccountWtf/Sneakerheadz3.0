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
import type { CrossingKind } from './crossings';

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
    /**
     * Which of the admitted kinds are the *joke* rather than the furniture, and
     * how many of them one section may hold.
     *
     * Density alone cannot express this. A tier needs enough bodies in it to
     * feel busier than the tier before — that is the escalation, and it is
     * measured on density at a fixed length — but "busier" and "weirder" are
     * not the same axis, and the `wrong` tier is precisely where they come
     * apart. Six people in a galley is correct. Two donkeys in it is not: the
     * second one answers the question the first one asked.
     *
     * So the budget stays, and the anomalies are rationed inside it. Everything
     * admitted and not listed here is a staple, and staples fill whatever the
     * ration does not. Absent means no rationing — by `shuk` the weirdness is
     * the furniture and there is nothing left to ration.
     */
    ration?: { kinds: ActorKind[]; max: number };
    /**
     * What runs through and how often, in expected seconds between arrivals.
     *
     * Separate from `admits` and from `density` because a thing that crosses is
     * not a thing that lives here — see the header of `crossings.ts`. An
     * ordinary cabin has nobody standing in it and still gets a camel every
     * twenty seconds or so, which is the difference between "this is a bazaar"
     * and "wait, was that a camel".
     *
     * This is why `plane` is no longer an empty tier while remaining a tier
     * that spends no jokes: a crossing costs nothing, because it takes the
     * evidence with it when it leaves.
     */
    crossEvery: number;
    crosses: CrossingKind[];
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
        crossEvery: 22,
        crosses: ['donkey', 'sheep', 'camel', 'goats', 'chickens', 'cart', 'tea', 'rug', 'bread', 'bicycle'],
    },

    /**
     * Still recognisably an aircraft, with exactly one thing in it that has no
     * business being there. One is the correct number: two men and a donkey is
     * a bazaar, one man and a donkey is a question.
     *
     * The cabin is fuller than the last one — that is the escalation, and it
     * has to be visible — but the extra bodies are passengers. Only one of them
     * is the joke, and the ration below is what keeps it that way. Without it
     * this tier shipped two donkeys and a coffee service, which is the next
     * tier arriving a section early and the question never being asked.
     */
    wrong: {
        reads: 'I am on a plane. Why is there a donkey.',
        admits: ['balcony', 'coffee', 'donkey', 'sweeper'],
        density: 0.9,
        dressing: ['seats', 'bins', 'galleywall', 'carpet', 'rug'],
        ration: { kinds: ['coffee', 'donkey', 'sweeper'], max: 1 },
        crossEvery: 16,
        crosses: ['donkey', 'sheep', 'camel', 'goats', 'chickens', 'cart', 'tea', 'rug', 'bread', 'bicycle'],
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
        crossEvery: 11,
        crosses: ['donkey', 'sheep', 'camel', 'goats', 'chickens', 'cart', 'tea', 'rug', 'bread', 'bicycle'],
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
        crossEvery: 7,
        crosses: ['donkey', 'sheep', 'camel', 'goats', 'chickens', 'cart', 'tea', 'rug', 'bread', 'bicycle'],
    },
};

export const admits = (c: Creep, kind: ActorKind): boolean => CREEP[c].admits.includes(kind);

/** Is this kind the joke in this tier, rather than the furniture around it? */
export const isAnomaly = (c: Creep, kind: ActorKind): boolean =>
    CREEP[c].ration?.kinds.includes(kind) ?? false;

/** How many jokes one section of this tier may hold. */
export const anomalyBudget = (c: Creep): number => CREEP[c].ration?.max ?? Infinity;

/**
 * What fills a section once its ration is spent. The staples are whatever the
 * tier admits and does not ration; a tier that rations everything it admits
 * would have nothing to fall back on, so that is a mistake worth catching here
 * rather than as an empty background at run time.
 */
/**
 * Expected seconds between crossings in this tier. Falls with the escalation,
 * so an ordinary cabin gets one now and then and the cockpit is continuous
 * traffic.
 */
export const crossEvery = (c: Creep): number => CREEP[c].crossEvery;

/** Does anything cross here? Every tier says yes, including the ordinary one. */
export const hasCrossings = (c: Creep): boolean => CREEP[c].crosses.length > 0;

export const staples = (c: Creep): ActorKind[] => {
    const rest = CREEP[c].admits.filter((k) => !isAnomaly(c, k));
    return rest.length ? rest : CREEP[c].admits;
};

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
