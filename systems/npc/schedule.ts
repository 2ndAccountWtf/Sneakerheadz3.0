/**
 * NPC Schedule
 * ============
 * Where people are. Before this, an NPC existed only at the moment you
 * talked to them — Gutter Gabe was equally "in" a sunlit blacktop at noon and
 * a back alley at 3am, because nothing ever asked. This module answers
 * "where is X, in city Y, on day D" as a pure function, so a city screen can
 * show who's around before you walk up to them, and `reactions.ts` can ask
 * whether two rivals are about to be in the same place.
 *
 * The primary source of truth is `data/venues.ts`, which already declares
 * each venue's `regulars` and, for some, a `timeOfDay` gate — this module
 * reads that rather than re-inventing a parallel roster that could silently
 * drift out of sync with it. `ROUTINES` below only fills in the gaps: NPCs
 * with no venue at all (a world leader, a checkpoint, a media presence), and
 * a small set of hard character overrides (`RESTRICTED_TO`) for cases where
 * a venue being open around the clock doesn't mean every regular is there
 * around the clock — Gutter Gabe keeps his own hours regardless of what time
 * The Cage's doors are unlocked.
 *
 * Determinism follows `data/ampm/shelfSpecials.ts`'s exact recipe (FNV-1a
 * seed, mulberry32 PRNG) so the same (npc, city, day) always resolves to the
 * same answer — the world must not reshuffle itself on re-render.
 */
import { venuesIn, isVenueOpen, timeOfDayFor } from '../../data/venues';
import { hashString, seeded } from '../../utils/rng';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface Placement {
    venueId?: string;
    place: string;
    /** 0..1. How likely this NPC actually is here right now, not just plausible. */
    likelihood: number;
}



const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

interface RoutineSlot {
    place: string;
    likelihood: number;
}
type Routine = Partial<Record<TimeOfDay, RoutineSlot>>;

/**
 * Fallback placements for NPCs (or NPC/timeslot combinations) with no
 * matching venue regular entry. `cityIds` on `OPERATES_IN` gates where these
 * apply; omitted from a slot entirely just means "not seen at this hour".
 */
const ROUTINES: Record<string, Routine> = {
    bibi: {
        morning: { place: 'In a briefing room, treating resale prices like a security matter.', likelihood: 0.35 },
        afternoon: { place: 'Behind a podium, on every screen in the shop at once.', likelihood: 0.45 },
        evening: { place: 'At an undisclosed, extremely secure location.', likelihood: 0.2 },
        // No night slot: strength requires sleep, apparently, and he will not discuss it.
    },
    adc: {
        // She is, by design, an afternoon-only phenomenon — see RESTRICTED_TO.
        afternoon: { place: 'Outside the nearest store, mid-chant, clipboard raised.', likelihood: 0.85 },
    },
    'donald-drip': {
        morning: { place: 'On the ninth hole, narrating his own swing to nobody.', likelihood: 0.3 },
        afternoon: { place: 'Announcing a collab that legal has not signed off on.', likelihood: 0.3 },
        evening: { place: "Calling in to Bro Jogan's podcast, uninvited.", likelihood: 0.25 },
        // No night slot: "Tremendous sleep. The best sleep. Everyone says so."
    },
    'tsa-agent': {
        morning: { place: 'At the checkpoint, deeply unimpressed by your bag.', likelihood: 0.55 },
        afternoon: { place: 'At the checkpoint, deeply unimpressed by your bag.', likelihood: 0.55 },
        evening: { place: 'At the checkpoint, deeply unimpressed by your bag.', likelihood: 0.55 },
        night: { place: 'On break. There is always another agent exactly like him.', likelihood: 0.25 },
    },
    'clerk-israeli-af': {
        // The eternal post-army backpacker: this fills the cities where he
        // isn't already a listed venue regular (data/venues.ts has him in
        // tel-aviv, tokyo, paris and chicago already).
        morning: { place: 'At a hostel, arguing about the cheapest route to the next city.', likelihood: 0.25 },
        afternoon: { place: 'Wherever the cheapest falafel currently is.', likelihood: 0.3 },
        evening: { place: 'Recommending a bar to strangers who did not ask.', likelihood: 0.3 },
        night: { place: 'At whatever counts as the backpacker bar in this city.', likelihood: 0.35 },
    },
};

/** Which cities a fallback-only routine is allowed to fire in. `'anywhere'`
 *  is for genuinely global, checkpoint, or roaming presences. NPCs who
 *  already have real venues (see data/venues.ts) and no entry here simply
 *  aren't around in a city where they have no venue and no routine. */
const OPERATES_IN: Record<string, string[] | 'anywhere'> = {
    bibi: 'anywhere',
    adc: 'anywhere',
    'donald-drip': 'anywhere',
    'tsa-agent': 'anywhere',
    'clerk-israeli-af': 'anywhere',
};

/**
 * Hard per-character time constraints, layered on top of whatever
 * data/venues.ts's own `timeOfDay` gate says. A venue happening to have no
 * `timeOfDay` (always open) does not mean every one of its regulars keeps a
 * day job — Gutter Gabe is a regular at the always-open Cage and Canal
 * Street spot, but "Gutter Gabe only exists after dark" is a stronger,
 * funnier, and more specific truth about him than the venue's own hours.
 */
const RESTRICTED_TO: Partial<Record<string, TimeOfDay[]>> = {
    'gutter-gabe': ['night'],
    adc: ['afternoon'],
};

const JITTER = 0.15;

/** Where an NPC plausibly is, given a city and the day (day % 4 = time of day,
 *  matching data/venues.ts's own `timeOfDayFor`). Deterministic: same inputs,
 *  same answer, every time — never re-rolls on a re-render. */
export function whereIs(npcId: string, cityId: string, day: number): Placement {
    const timeOfDay = timeOfDayFor(day) as TimeOfDay;
    const rng = seeded(hashString(`npc-schedule:${npcId}:${cityId}:${day}`));

    const restriction = RESTRICTED_TO[npcId];
    if (restriction && !restriction.includes(timeOfDay)) {
        return { place: 'Not seen out at this hour.', likelihood: 0 };
    }

    const candidates = venuesIn(cityId).filter(v => v.regulars.includes(npcId) && isVenueOpen(v, day));
    if (candidates.length > 0) {
        const chosen = candidates.length === 1 ? candidates[0] : candidates[Math.floor(rng() * candidates.length)];
        // A venue gated to this exact slot is a real appointment; one that's
        // simply always open is just one of several places they might be.
        const base = chosen.timeOfDay ? 0.75 : 0.45;
        const likelihood = clamp01(base + (rng() - 0.5) * JITTER);
        return { venueId: chosen.id, place: chosen.name, likelihood };
    }

    const slot = ROUTINES[npcId]?.[timeOfDay];
    const scope = OPERATES_IN[npcId];
    const inScope = scope === 'anywhere' || (Array.isArray(scope) && scope.includes(cityId));
    if (slot && inScope) {
        const likelihood = clamp01(slot.likelihood + (rng() - 0.5) * JITTER);
        return { place: slot.place, likelihood };
    }

    return { place: `Nobody has seen them in ${cityId} today.`, likelihood: 0 };
}

const PRESENCE_THRESHOLD = 0.2;

export function isNpcInCity(npcId: string, cityId: string, day: number): boolean {
    return whereIs(npcId, cityId, day).likelihood >= PRESENCE_THRESHOLD;
}

/** Every NPC this module can place. Kept here rather than in
 *  data/npcRelations.ts because scheduling covers NPCs with no authored
 *  social relations at all (tsa-agent, the clerk) as well as ones that do. */
export const SCHEDULABLE_NPC_IDS: readonly string[] = [
    'bibi', 'adc', 'grandma-laces', 'wiz-k', 'gutter-gabe', 'scalper-sid',
    'clerk-israeli-af', 'tsa-agent', 'the-game', 'bro-jogan', 'yasser-abbasfat', 'donald-drip',
];

/** Everyone plausibly in this city right now, for a city screen's ambient
 *  cast list. Order follows `SCHEDULABLE_NPC_IDS`, not likelihood, so it's
 *  stable to render. */
export function whoIsAround(cityId: string, day: number): string[] {
    return SCHEDULABLE_NPC_IDS.filter(id => isNpcInCity(id, cityId, day));
}
