import { timeOfDayFor } from './venues';
import { activeHypeEvent } from '../systems/events/hypeCalendar';

/**
 * Street selling spots.
 *
 * The trade counter pays 45-65% of market and nothing can go wrong. The bag's
 * "Sell" button pays full market and nothing can go wrong either. Neither has
 * a pulse. A selling spot is the third option: you set up somewhere real in a
 * city, and whoever walks past decides what your pair is worth today.
 *
 * Written in the same register as `data/venues.ts` — flat data, dry voice, no
 * logic here. Everything that turns a spot into buyers and offers lives in
 * `systems/street/buyers.ts` and `systems/street/selling.ts`.
 *
 * The trade-off every spot makes is footfall against exposure: a subway exit
 * sees five buyers to a flea market's one, but every one of those buyers is
 * also a witness, and `heatRate` says so. A quiet flea-market table or a 2am
 * doorway sees far fewer people, richer ones, and nobody in a uniform.
 */
export interface BuyerMix {
    /** Relative weight, not required to sum to 1 — normalised at generation time. */
    local: number;
    international: number;
    celebrity: number;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface SellingSpot {
    id: string;
    cityId: string;
    name: string;
    blurb: string;
    icon: string;
    /** 1 (dead) to 5 (packed). How many people pass, and how many eyes are on you. */
    footfall: 1 | 2 | 3 | 4 | 5;
    /** Who shows up here, as relative weights. */
    buyerMix: BuyerMix;
    /** Heat added per buyer dealt with here, before any hype heatMultiplier. */
    heatRate: number;
    /** Street cred needed before it's even worth setting up here. */
    minCred?: number;
    /** Energy spent just to post up, win or lose. */
    energyCost: number;
    /** Gated to one slot of the day % 4 cycle — omit for always open. */
    timeOfDay?: TimeOfDay;
    /** Shown instead of the spot when it's shut. */
    closedLine?: string;
}

export const SELLING_SPOTS: SellingSpot[] = [
    // --- TOKYO ---
    {
        id: 'tokyo-shibuya-exit',
        cityId: 'tokyo',
        name: 'Shibuya Scramble, Hachikō Exit',
        blurb: 'A thousand people cross every two minutes. Somebody always looks at your bag — most of them are just curious.',
        icon: '🚇',
        footfall: 5,
        buyerMix: { local: 0.55, international: 0.4, celebrity: 0.05 },
        heatRate: 5,
        energyCost: 8,
    },
    {
        id: 'tokyo-ameyoko-row',
        cityId: 'tokyo',
        name: 'Ameyoko Under the Tracks',
        blurb: 'A market alley wedged under the rail line. The stall owners on both sides pretend not to notice you.',
        icon: '🏮',
        footfall: 3,
        buyerMix: { local: 0.4, international: 0.45, celebrity: 0.15 },
        heatRate: 3,
        energyCost: 6,
    },
    {
        id: 'tokyo-dome-exit',
        cityId: 'tokyo',
        name: 'Outside Tokyo Dome, Final Whistle',
        blurb: 'The gates just opened and everyone is still wearing whatever they bought inside twenty minutes ago.',
        icon: '🏟',
        footfall: 5,
        buyerMix: { local: 0.6, international: 0.3, celebrity: 0.1 },
        heatRate: 5,
        energyCost: 10,
        timeOfDay: 'evening',
        closedLine: 'No game tonight. Just a locked gate and a security guard reading his phone.',
    },
    {
        id: 'tokyo-nakano-broadway',
        cityId: 'tokyo',
        name: 'Nakano Broadway, Third Floor Landing',
        blurb: 'Collectors who know exactly what they are looking at, and exactly what they will pay for it.',
        icon: '🧩',
        footfall: 2,
        buyerMix: { local: 0.25, international: 0.45, celebrity: 0.3 },
        heatRate: 1,
        minCred: 15,
        energyCost: 5,
    },
    {
        id: 'tokyo-golden-gai-corner',
        cityId: 'tokyo',
        name: 'Golden Gai, 2AM Corner',
        blurb: 'Six bars deep in neon and nobody left sober enough to haggle properly.',
        icon: '🌃',
        footfall: 2,
        buyerMix: { local: 0.3, international: 0.5, celebrity: 0.2 },
        heatRate: 6,
        minCred: 10,
        energyCost: 12,
        timeOfDay: 'night',
        closedLine: 'Shuttered and dark. Even the neon is off.',
    },

    // --- TEL AVIV ---
    {
        id: 'tlv-dizengoff-steps',
        cityId: 'tel-aviv',
        name: 'Dizengoff Center Steps',
        blurb: 'Everyone in Tel Aviv passes through here eventually. So does the odd bored security guard.',
        icon: '🚶',
        footfall: 5,
        buyerMix: { local: 0.6, international: 0.3, celebrity: 0.1 },
        heatRate: 5,
        energyCost: 8,
    },
    {
        id: 'tlv-gordon-boardwalk',
        cityId: 'tel-aviv',
        name: 'Gordon Beach Boardwalk',
        blurb: 'Sunset, paddleball, and tourists carrying more cash than sense.',
        icon: '🏖',
        footfall: 3,
        buyerMix: { local: 0.3, international: 0.55, celebrity: 0.15 },
        heatRate: 2,
        energyCost: 7,
    },
    {
        id: 'tlv-shuk-back-entrance',
        cityId: 'tel-aviv',
        name: 'Carmel Market, Back Entrance',
        blurb: 'Past the spice stalls, where the crates nobody is supposed to move actually get moved.',
        icon: '🌶',
        footfall: 3,
        buyerMix: { local: 0.45, international: 0.4, celebrity: 0.15 },
        heatRate: 3,
        energyCost: 6,
    },
    {
        id: 'tlv-florentin-club-door',
        cityId: 'tel-aviv',
        name: 'Outside a Florentin Club, 2AM',
        blurb: 'The bouncer stopped caring an hour ago. Everyone still inside has money and no judgment left.',
        icon: '🎧',
        footfall: 2,
        buyerMix: { local: 0.25, international: 0.5, celebrity: 0.25 },
        heatRate: 6,
        minCred: 10,
        energyCost: 12,
        timeOfDay: 'night',
        closedLine: "Line's not out yet. Come back when the place is actually open.",
    },
    {
        id: 'tlv-levinsky-alley',
        cityId: 'tel-aviv',
        name: 'Levinsky Spice Alley',
        blurb: "Quiet, slow, and the kind of buyer who already knew what he was carrying home before you showed up.",
        icon: '🧂',
        footfall: 2,
        buyerMix: { local: 0.3, international: 0.4, celebrity: 0.3 },
        heatRate: 1,
        minCred: 20,
        energyCost: 5,
    },

    // --- NEW YORK ---
    {
        id: 'ny-union-square-exit',
        cityId: 'new-york',
        name: 'Union Square Subway Exit',
        blurb: 'Four train lines empty onto this corner all day. Cameras everywhere, cops occasionally.',
        icon: '🚇',
        footfall: 5,
        buyerMix: { local: 0.6, international: 0.3, celebrity: 0.1 },
        heatRate: 6,
        energyCost: 8,
    },
    {
        id: 'ny-msg-exit',
        cityId: 'new-york',
        name: 'Outside the Garden, Final Buzzer',
        blurb: 'The whole building empties in under ten minutes. So does everyone\'s patience.',
        icon: '🏟',
        footfall: 5,
        buyerMix: { local: 0.55, international: 0.3, celebrity: 0.15 },
        heatRate: 5,
        energyCost: 10,
        timeOfDay: 'evening',
        closedLine: 'Dark marquee. Nothing playing tonight.',
    },
    {
        id: 'ny-canal-street-tables',
        cityId: 'new-york',
        name: 'Canal Street Folding Tables',
        blurb: "Out here it's just you, a milk crate, and whoever slows down.",
        icon: '📦',
        footfall: 3,
        buyerMix: { local: 0.4, international: 0.45, celebrity: 0.15 },
        heatRate: 4,
        energyCost: 6,
    },
    {
        id: 'ny-meatpacking-door',
        cityId: 'new-york',
        name: 'Meatpacking District, 2AM Door',
        blurb: 'Velvet rope, cobblestones, and a crowd that tips in more than dollars.',
        icon: '🚪',
        footfall: 2,
        buyerMix: { local: 0.2, international: 0.55, celebrity: 0.25 },
        heatRate: 6,
        minCred: 15,
        energyCost: 13,
        timeOfDay: 'night',
        closedLine: "Rope's up, line's not down yet. Try later.",
    },
    {
        id: 'ny-flatbush-corner',
        cityId: 'new-york',
        name: 'Flatbush Avenue Corner',
        blurb: 'Everybody knows everybody out here. That cuts both ways.',
        icon: '🏙',
        footfall: 4,
        buyerMix: { local: 0.65, international: 0.25, celebrity: 0.1 },
        heatRate: 4,
        minCred: 5,
        energyCost: 7,
    },

    // --- LOS ANGELES ---
    {
        id: 'la-venice-boardwalk',
        cityId: 'los-angeles',
        name: 'Venice Beach Boardwalk',
        blurb: 'Skaters, tourists, and a guy selling incense who has definitely seen a fight before.',
        icon: '🛹',
        footfall: 4,
        buyerMix: { local: 0.35, international: 0.5, celebrity: 0.15 },
        heatRate: 3,
        energyCost: 8,
    },
    {
        id: 'la-arena-exit',
        cityId: 'los-angeles',
        name: 'Outside the Arena, Postgame',
        blurb: 'Purple and gold as far as you can see. Somebody famous always slips out this exact door.',
        icon: '🏟',
        footfall: 5,
        buyerMix: { local: 0.45, international: 0.3, celebrity: 0.25 },
        heatRate: 5,
        energyCost: 10,
        timeOfDay: 'evening',
        closedLine: 'No game. Just a locked loading dock and a parking attendant.',
    },
    {
        id: 'la-melrose-trading-post',
        cityId: 'los-angeles',
        name: 'Melrose Trading Post',
        blurb: 'Sunday flea market energy, available seven days a week if you know where to stand.',
        icon: '🛍',
        footfall: 3,
        buyerMix: { local: 0.35, international: 0.4, celebrity: 0.25 },
        heatRate: 2,
        energyCost: 6,
    },
    {
        id: 'la-sunset-strip-door',
        cityId: 'los-angeles',
        name: 'Sunset Strip, 2AM Door',
        blurb: 'Valets, velvet ropes, and someone always filming something for reasons nobody explains.',
        icon: '🌴',
        footfall: 2,
        buyerMix: { local: 0.2, international: 0.45, celebrity: 0.35 },
        heatRate: 6,
        minCred: 15,
        energyCost: 13,
        timeOfDay: 'night',
        closedLine: 'Dead block. Even the paparazzi went home.',
    },
    {
        id: 'la-fairfax-line',
        cityId: 'los-angeles',
        name: 'Fairfax Ave Drop Line',
        blurb: "The line for a shoe that isn't even out yet, and everyone in it is a customer.",
        icon: '👟',
        footfall: 4,
        buyerMix: { local: 0.4, international: 0.35, celebrity: 0.25 },
        heatRate: 3,
        minCred: 10,
        energyCost: 7,
    },

    // --- PARIS ---
    {
        id: 'paris-chatelet-exit',
        cityId: 'paris',
        name: 'Châtelet–Les Halles Exit',
        blurb: "Europe's busiest metro interchange. Also, apparently, its most surveilled.",
        icon: '🚇',
        footfall: 5,
        buyerMix: { local: 0.55, international: 0.35, celebrity: 0.1 },
        heatRate: 6,
        energyCost: 8,
    },
    {
        id: 'paris-puces-saint-ouen',
        cityId: 'paris',
        name: 'Les Puces de Saint-Ouen',
        blurb: 'The largest flea market in the world. Somewhere in here is exactly the buyer you need.',
        icon: '🕰',
        footfall: 3,
        buyerMix: { local: 0.3, international: 0.45, celebrity: 0.25 },
        heatRate: 2,
        energyCost: 6,
    },
    {
        id: 'paris-quai-seine',
        cityId: 'paris',
        name: 'Quai de Seine, Evening Stroll',
        blurb: 'Wine, a view, and buyers who take their time deciding they want something.',
        icon: '🥖',
        footfall: 2,
        buyerMix: { local: 0.2, international: 0.55, celebrity: 0.25 },
        heatRate: 1,
        energyCost: 6,
        timeOfDay: 'evening',
        closedLine: "Empty quay. Everyone's inside, out of the cold.",
    },
    {
        id: 'paris-parc-des-princes-exit',
        cityId: 'paris',
        name: 'Outside Parc des Princes, Full Time',
        blurb: 'Scarves everywhere, tempers occasionally, cash in hand either way.',
        icon: '⚽',
        footfall: 5,
        buyerMix: { local: 0.55, international: 0.3, celebrity: 0.15 },
        heatRate: 5,
        energyCost: 10,
        timeOfDay: 'evening',
        closedLine: 'No match today. Just a locked turnstile.',
    },
    {
        id: 'paris-pigalle-door',
        cityId: 'paris',
        name: 'Pigalle, 2AM Doorway',
        blurb: 'Neon, a bouncer with an earpiece, and a crowd that came out specifically to spend money.',
        icon: '💃',
        footfall: 2,
        buyerMix: { local: 0.2, international: 0.5, celebrity: 0.3 },
        heatRate: 6,
        minCred: 20,
        energyCost: 13,
        timeOfDay: 'night',
        closedLine: "Doors closed. The bouncer isn't even out here yet.",
    },

    // --- CHICAGO ---
    {
        id: 'chi-red-line-exit',
        cityId: 'chicago',
        name: 'Red Line, Roosevelt Exit',
        blurb: 'The train dumps a crowd every four minutes. So do the transit cops.',
        icon: '🚇',
        footfall: 5,
        buyerMix: { local: 0.65, international: 0.25, celebrity: 0.1 },
        heatRate: 6,
        energyCost: 8,
    },
    {
        id: 'chi-united-center-exit',
        cityId: 'chicago',
        name: 'Outside the United Center, Postgame',
        blurb: 'Red everywhere, and a lot of people who know exactly what a Jordan is worth.',
        icon: '🏟',
        footfall: 5,
        buyerMix: { local: 0.65, international: 0.2, celebrity: 0.15 },
        heatRate: 5,
        energyCost: 10,
        timeOfDay: 'evening',
        closedLine: 'No game tonight. The plaza is just wind and pigeons.',
    },
    {
        id: 'chi-maxwell-street-row',
        cityId: 'chicago',
        name: 'Maxwell Street Market Row',
        blurb: 'Seventy years of exactly this kind of business happening on exactly this block.',
        icon: '🌭',
        footfall: 3,
        buyerMix: { local: 0.5, international: 0.35, celebrity: 0.15 },
        heatRate: 3,
        energyCost: 6,
    },
    {
        id: 'chi-navy-pier-boardwalk',
        cityId: 'chicago',
        name: 'Navy Pier Boardwalk',
        blurb: 'Lake wind, tourists, and a Ferris wheel nobody selling shoes has ever actually ridden.',
        icon: '🎡',
        footfall: 3,
        buyerMix: { local: 0.3, international: 0.5, celebrity: 0.2 },
        heatRate: 2,
        energyCost: 7,
    },
    {
        id: 'chi-river-north-door',
        cityId: 'chicago',
        name: 'River North, 2AM Door',
        blurb: 'Everybody out here either just made money or is about to lose some.',
        icon: '🌆',
        footfall: 2,
        buyerMix: { local: 0.25, international: 0.45, celebrity: 0.3 },
        heatRate: 6,
        minCred: 15,
        energyCost: 12,
        timeOfDay: 'night',
        closedLine: "Bar's closed, door's locked, block is dead quiet.",
    },
];

/**
 * The corners you can work in a city — plus, on the days it runs, the event
 * itself. The event is listed first because it is the reason you came.
 */
export const spotsIn = (cityId: string, day?: number): SellingSpot[] => {
    const fixed = SELLING_SPOTS.filter(s => s.cityId === cityId);
    if (day === undefined) return fixed;
    const live = activeHypeEvent(day, cityId);
    return live ? [eventSpot(live), ...fixed] : fixed;
};

/** True for the spot that only exists because an event is on. */
export const isEventSpot = (spot: SellingSpot): boolean => spot.id.startsWith('event-');

export const isSpotOpen = (spot: SellingSpot, day: number): boolean =>
    !spot.timeOfDay || spot.timeOfDay === timeOfDayFor(day);

/* ------------------------------------------------------------------ *
 * The event floor
 * ------------------------------------------------------------------ */

/**
 * A hype event, as somewhere you can actually stand.
 *
 * The calendar has been announcing these for a while — "Marché aux Puces
 * Sneaker Row, happening here right now" — and when you arrived there was
 * nowhere to go. The event was a set of invisible multipliers on the corners
 * you could already sell from: prices up, footfall up, more chance of somebody
 * famous. Real effects, no destination. You were told a market was on and then
 * sold shoes outside a station as usual.
 *
 * So the event becomes a spot of its own, derived from its own numbers, and it
 * shows up at the top of Set Up Shop on the days it runs. Everything about it
 * falls out of the event rather than being authored twice:
 *
 *   - `footfallMultiplier` decides how packed it is,
 *   - a crowd that travelled for this leans international, and the celebrity
 *     chance is the event's own,
 *   - `heatMultiplier` sets how watched it is — a convention floor with a
 *     security line is not a quiet alley, and the whole point of a market is
 *     that everybody can see you.
 *
 * No cred gate: the door is open, that is what a market is. The cost is energy
 * and exposure.
 */
export function eventSpot(event: {
    id: string; cityId: string; name: string; blurb: string; icon: string;
    footfallMultiplier: number; celebrityChance: number; heatMultiplier?: number;
}): SellingSpot {
    const footfall = Math.max(1, Math.min(5, Math.round(3 * event.footfallMultiplier))) as 1 | 2 | 3 | 4 | 5;
    const celeb = Math.min(0.5, event.celebrityChance);
    return {
        id: `event-${event.id}`,
        cityId: event.cityId,
        name: event.name,
        blurb: event.blurb,
        icon: event.icon,
        footfall,
        // People came here on purpose, and a lot of them came a long way.
        buyerMix: { local: 0.35, international: 0.65 - celeb, celebrity: celeb },
        // Busy, legitimate, and comprehensively observed.
        heatRate: Math.round(4 * (event.heatMultiplier ?? 1)),
        energyCost: 12,
    };
}
