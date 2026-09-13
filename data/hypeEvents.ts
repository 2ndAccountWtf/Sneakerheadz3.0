import type { HypeEvent } from '../types/hype';

/**
 * Hype events — the authored content.
 *
 * Every entry here is a template: a real-feeling occasion in a specific city,
 * with a voice, a scale, and a crowd that wants something specific. What it
 * does NOT have is a date — `systems/events/hypeCalendar.ts` decides, per run,
 * which of these fire and when, so the same event can land on day 9 in one
 * playthrough and day 22 in the next. Keeping dates out of this file is what
 * keeps the calendar's scheduling logic (spread, no overlaps, nothing before
 * day 3) in exactly one place instead of half-authored here and half-enforced
 * there.
 *
 * `hotTags` are drawn from `ShoeTag` in `systems/market/taxonomy.ts` — real
 * tags only, nothing invented, so a street-selling buyer who wants "whatever
 * this event is hungry for" can just intersect a shoe's tags against it.
 *
 * Scale is deliberately uneven: a three-day expo and a one-afternoon swap
 * behind a laundromat are both on this list, because they should read as
 * completely different animals on the calendar, not the same event with a
 * different name.
 */
export type HypeEventTemplate = Omit<HypeEvent, 'startDay'>;

export const HYPE_EVENT_TEMPLATES: HypeEventTemplate[] = [
    // --- TOKYO ---
    {
        id: 'tokyo-harajuku-grail-weekend',
        cityId: 'tokyo',
        name: 'Harajuku Grail Weekend',
        blurb: 'Two days of pop-up booths down Takeshita Street. Every third stall is somebody\'s "personal collection," priced like it isn\'t.',
        icon: '🎌',
        days: 2,
        priceMultiplier: 1.4,
        footfallMultiplier: 1.9,
        hotTags: ['luxury', 'collab', 'hype'],
        celebrityChance: 0.09,
        heatMultiplier: 1.35,
    },
    {
        id: 'tokyo-akiba-midnight-drop',
        cityId: 'tokyo',
        name: 'Akihabara Midnight Drop',
        blurb: 'A re-release nobody confirmed is happening until the line is already six hours long. It is happening.',
        icon: '🌙',
        days: 1,
        priceMultiplier: 1.3,
        footfallMultiplier: 1.6,
        hotTags: ['tech', 'collab', 'hype'],
        celebrityChance: 0.05,
        heatMultiplier: 1.25,
    },

    // --- TEL AVIV ---
    {
        id: 'tlv-jaffa-flea-row',
        cityId: 'tel-aviv',
        name: 'Jaffa Flea Row',
        blurb: 'One afternoon behind the shuk, folding tables and a generator running a single string of lights. Cash only and everyone knows it.',
        icon: '🧦',
        days: 1,
        priceMultiplier: 1.15,
        footfallMultiplier: 1.3,
        hotTags: ['retro', 'casual'],
        celebrityChance: 0.02,
        heatMultiplier: 1.1,
    },
    {
        id: 'tlv-gordon-beach-shuk',
        cityId: 'tel-aviv',
        name: 'Gordon Beach Sneaker Shuk',
        blurb: 'Two days of stalls along the promenade. Tourists in sandals somehow still have opinions about resell value.',
        icon: '🏖',
        days: 2,
        priceMultiplier: 1.28,
        footfallMultiplier: 1.55,
        hotTags: ['runner', 'casual', 'skate'],
        celebrityChance: 0.05,
        heatMultiplier: 1.2,
    },

    // --- NEW YORK ---
    {
        id: 'ny-soho-sample-sale',
        cityId: 'new-york',
        name: 'SoHo Sample Sale Stampede',
        blurb: 'Two days, one warehouse, and a door that opens onto what can only be described as a controlled stampede.',
        icon: '🛍',
        days: 2,
        priceMultiplier: 1.45,
        footfallMultiplier: 2.0,
        hotTags: ['luxury', 'collab', 'hype'],
        celebrityChance: 0.11,
        heatMultiplier: 1.5,
    },
    {
        id: 'ny-orchard-street-hustle',
        cityId: 'new-york',
        name: 'Orchard Street Hustle Market',
        blurb: 'Folding tables, milk crates, and men who will absolutely tell you a box is deadstock. It is one day. It is always one day.',
        icon: '🗽',
        days: 1,
        priceMultiplier: 1.25,
        footfallMultiplier: 1.55,
        hotTags: ['retro', 'workwear', 'casual'],
        celebrityChance: 0.04,
        heatMultiplier: 1.3,
    },

    // --- LOS ANGELES ---
    {
        id: 'la-long-beach-expo',
        cityId: 'los-angeles',
        name: 'Long Beach Sneakerheadz Expo',
        blurb: 'The big one. Three days, a convention floor, a raffle nobody trusts, and a security line that treats every duffel bag as a threat.',
        icon: '🎪',
        days: 3,
        priceMultiplier: 1.5,
        footfallMultiplier: 2.15,
        hotTags: ['basketball', 'retro', 'collab', 'hype'],
        celebrityChance: 0.16,
        heatMultiplier: 1.55,
    },
    {
        id: 'la-fairfax-line-camp',
        cityId: 'los-angeles',
        name: 'Fairfax Line Camp',
        blurb: 'An overnight camp-out for a drop that has not been officially announced by anyone who works there.',
        icon: '⛺',
        days: 1,
        priceMultiplier: 1.3,
        footfallMultiplier: 1.65,
        hotTags: ['collab', 'skate', 'hype'],
        celebrityChance: 0.08,
        heatMultiplier: 1.3,
    },
    {
        id: 'la-laundromat-lot-swap',
        cityId: 'los-angeles',
        name: 'Laundromat Lot Swap',
        blurb: 'A single afternoon in the parking lot behind a laundromat that has hosted this for years and advertises it nowhere.',
        icon: '🧺',
        days: 1,
        priceMultiplier: 1.12,
        footfallMultiplier: 1.25,
        hotTags: ['casual', 'runner'],
        celebrityChance: 0.02,
        heatMultiplier: 1.05,
    },

    // --- PARIS ---
    {
        id: 'paris-sneaker-week-satellite',
        cityId: 'paris',
        name: 'Sneaker Week Satellite Show',
        blurb: 'Three days of overflow from Fashion Week proper — the houses did not send their best, but the crowd cannot tell and will not ask.',
        icon: '🥐',
        days: 3,
        priceMultiplier: 1.48,
        footfallMultiplier: 2.05,
        hotTags: ['luxury', 'collab', 'hype'],
        celebrityChance: 0.14,
        heatMultiplier: 1.5,
    },
    {
        id: 'paris-puces-sneaker-row',
        cityId: 'paris',
        name: 'Marché aux Puces Sneaker Row',
        blurb: 'Two days folded into the regular flea market. Some of the boxes are older than the sneakers inside them.',
        icon: '🕰',
        days: 2,
        priceMultiplier: 1.27,
        footfallMultiplier: 1.5,
        hotTags: ['retro', 'workwear', 'casual'],
        celebrityChance: 0.04,
        heatMultiplier: 1.2,
    },

    // --- CHICAGO ---
    {
        id: 'chi-lower-wacker-kicks-market',
        cityId: 'chicago',
        name: 'Lower Wacker Kicks Market',
        blurb: 'Two days under the viaduct. Card tables, work lights, and a market that has been "unofficial" for eleven years running.',
        icon: '🏙',
        days: 2,
        priceMultiplier: 1.3,
        footfallMultiplier: 1.6,
        hotTags: ['basketball', 'retro', 'workwear'],
        celebrityChance: 0.05,
        heatMultiplier: 1.25,
    },
    {
        id: 'chi-united-center-retro-night',
        cityId: 'chicago',
        name: 'United Center Retro Night',
        blurb: 'One night, one bred colorway, and forty thousand people who will act like they were there in 1996.',
        icon: '🐂',
        days: 1,
        priceMultiplier: 1.35,
        footfallMultiplier: 1.75,
        hotTags: ['basketball', 'retro', 'hype'],
        celebrityChance: 0.1,
        heatMultiplier: 1.35,
    },
];
