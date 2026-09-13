import type { MiniGameId } from '../types/game';

/**
 * Venues.
 *
 * Cities previously held shoe stores, an AM/PM and a list of toilets. Games
 * lived in an Arcade menu that exists nowhere in particular. Venues put the
 * games in the world: a blacktop with regulars, a bar where a man keeps buying
 * rounds, an alley where somebody is always crouched over a chalk circle.
 *
 * A venue is defined by where it is, what it hosts, and who is usually there —
 * the regulars are drawn from the real NPC roster in systems/opponents.ts, so
 * the person you beat at darts is the same person who sells you hummus.
 */
export interface Venue {
    id: string;
    cityId: string;
    name: string;
    blurb: string;
    icon: string;
    /** Games playable here, in the order they should be offered. */
    games: MiniGameId[];
    /** NPC ids who turn up here. The opponent is drawn from this list. */
    regulars: string[];
    /** Street cred needed to get in or be taken seriously. */
    minCred?: number;
    /** Energy cost just to be here and play. */
    energyCost: number;
    /** Only open at this point in the day cycle (day % 4). Omit for always. */
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    /** Shown instead of the play buttons when it is shut. */
    closedLine?: string;
}

export const VENUES: Venue[] = [
    // --- TOKYO ---
    {
        id: 'tokyo-yoyogi-court',
        cityId: 'tokyo',
        name: 'Yoyogi Park Court',
        blurb: 'Floodlit until midnight. The regulars are better than they look and know it.',
        icon: '🏀',
        games: ['street-ball'],
        regulars: ['wiz-k', 'the-game'],
        energyCost: 10,
    },
    {
        id: 'tokyo-golden-gai',
        cityId: 'tokyo',
        name: 'Golden Gai Back Bar',
        blurb: 'Six seats, one board, and a man who has decided you are friends now.',
        icon: '🎯',
        games: ['drunk-darts', 'street-dice'],
        regulars: ['clerk-israeli-af', 'grandma-laces'],
        energyCost: 6,
        timeOfDay: 'night',
        closedLine: 'Shuttered. A handwritten sign gives an opening time in a script you cannot read.',
    },
    {
        id: 'tokyo-akiba-arcade',
        cityId: 'tokyo',
        name: 'Akihabara Cabinet Row',
        blurb: 'Three floors of machines. Two of them work.',
        icon: '🕹',
        games: ['street-ball', 'pizza-run'],
        regulars: ['wiz-k'],
        energyCost: 8,
    },

    // --- TEL AVIV ---
    {
        id: 'tlv-gordon-court',
        cityId: 'tel-aviv',
        name: 'Gordon Beach Court',
        blurb: 'Sand on the court, argument on the sideline, nobody keeping score correctly.',
        icon: '🏀',
        games: ['street-ball'],
        regulars: ['clerk-israeli-af', 'the-game'],
        energyCost: 10,
    },
    {
        id: 'tlv-florentin-alley',
        cityId: 'tel-aviv',
        name: 'Florentin Back Alley',
        blurb: 'A chalk circle, a milk crate, and somebody who is always already here.',
        icon: '🎲',
        games: ['street-dice', 'mystery-box'],
        regulars: ['gutter-gabe', 'scalper-sid', 'grandma-laces'],
        energyCost: 4,
        timeOfDay: 'night',
        closedLine: 'Empty. Just bins and a folded crate leaning against the wall.',
    },
    {
        id: 'tlv-shuk-tables',
        cityId: 'tel-aviv',
        name: 'Carmel Market Tables',
        blurb: 'Between the spice stalls. Everybody has an opinion about your shoes.',
        icon: '🔍',
        games: ['legit-check', 'street-dice'],
        regulars: ['scalper-sid', 'grandma-laces'],
        energyCost: 5,
    },

    // --- NEW YORK ---
    {
        id: 'ny-cage',
        cityId: 'new-york',
        name: 'The Cage, West 4th',
        blurb: 'The fence is the point. So is the crowd. Losing here follows you.',
        icon: '🏀',
        games: ['street-ball'],
        regulars: ['the-game', 'gutter-gabe'],
        minCred: 15,
        energyCost: 12,
    },
    {
        id: 'ny-canal-alley',
        cityId: 'new-york',
        name: 'Canal Street Side Door',
        blurb: 'Boxes, a folding table, and a lamp pointed at whatever you brought.',
        icon: '📦',
        games: ['mystery-box', 'legit-check'],
        regulars: ['scalper-sid', 'gutter-gabe'],
        energyCost: 4,
    },
    {
        id: 'ny-pizza-shift',
        cityId: 'new-york',
        name: 'Vinny\'s — Night Shift',
        blurb: 'They are short-handed. They are always short-handed. The bike is out back.',
        icon: '🍕',
        games: ['pizza-run'],
        regulars: [],
        energyCost: 14,
        timeOfDay: 'night',
        closedLine: 'Closed. A man inside mops the same square metre repeatedly.',
    },
    {
        id: 'ny-laundromat',
        cityId: 'new-york',
        name: 'Behind the Laundromat',
        blurb: 'No ring, no rules, no ambulance on standby. The purse is real.',
        icon: '🥊',
        games: ['street-brawl'],
        regulars: ['the-game', 'yasser-abbasfat'],
        minCred: 25,
        energyCost: 15,
        timeOfDay: 'night',
        closedLine: 'Just a laundromat right now. A woman is folding towels and watching you.',
    },

    // --- LOS ANGELES ---
    {
        id: 'la-venice-courts',
        cityId: 'los-angeles',
        name: 'Venice Beach Courts',
        blurb: 'Tourists filming. Somebody says they went pro overseas. Somebody always does.',
        icon: '🏀',
        games: ['street-ball'],
        regulars: ['wiz-k', 'bro-jogan'],
        energyCost: 10,
    },
    {
        id: 'la-boardwalk-hill',
        cityId: 'los-angeles',
        name: 'The Boardwalk Hill',
        blurb: 'A long, steep, badly surfaced run down to the sea. Perfect for exactly one thing.',
        icon: '🛹',
        games: ['cart-race', 'sneaker-chase'],
        regulars: ['the-game'],
        energyCost: 16,
    },
    {
        id: 'la-podcast-garage',
        cityId: 'los-angeles',
        name: 'The Garage Studio',
        blurb: 'Foam on the walls, a cold plunge in the corner, the ON AIR light permanently on.',
        icon: '🎙',
        games: ['hypecast-roulette'],
        regulars: ['bro-jogan', 'adc'],
        energyCost: 8,
    },

    // --- PARIS ---
    {
        id: 'paris-quai-tables',
        cityId: 'paris',
        name: 'Quai Tables',
        blurb: 'Folding chairs by the water. Older men who play for very small amounts, seriously.',
        icon: '🎲',
        games: ['street-dice'],
        regulars: ['grandma-laces', 'gutter-gabe'],
        energyCost: 4,
    },
    {
        id: 'paris-cave-bar',
        cityId: 'paris',
        name: 'Cave Bar, Rue Oberkampf',
        blurb: 'Down a staircase built for smaller people. The board is older than the building.',
        icon: '🎯',
        games: ['drunk-darts'],
        regulars: ['adc', 'clerk-israeli-af'],
        energyCost: 6,
        timeOfDay: 'evening',
        closedLine: 'The grille is down. Somebody inside is definitely there and definitely ignoring you.',
    },

    // --- CHICAGO ---
    {
        id: 'chi-south-court',
        cityId: 'chicago',
        name: 'South Side Blacktop',
        blurb: 'Cold, cracked, and the best run in the city. Winners hold the court.',
        icon: '🏀',
        games: ['street-ball'],
        regulars: ['the-game', 'gutter-gabe'],
        minCred: 10,
        energyCost: 12,
    },
    {
        id: 'chi-bar-back',
        cityId: 'chicago',
        name: 'Sports Bar, Back Hallway',
        blurb: 'Past the dartboard, left at the trophy case. Somebody keeps buying rounds.',
        icon: '🎯',
        games: ['drunk-darts', 'street-dice'],
        regulars: ['clerk-israeli-af', 'grandma-laces', 'wiz-k'],
        energyCost: 6,
    },
    {
        id: 'chi-loading-dock',
        cityId: 'chicago',
        name: 'The Loading Dock',
        blurb: 'Where the dog launcher was last seen. Nobody talks about the scooter gang.',
        icon: '🥊',
        games: ['street-brawl', 'mystery-box'],
        regulars: ['yasser-abbasfat', 'gutter-gabe'],
        energyCost: 15,
    },

    // --- ROOFTOPS ---
    // Six of them, one per city, because the artillery game needs somewhere to
    // happen and "two people on opposite roofs at dusk" is a place, not a menu
    // item. Every one is evening or night: nobody does this at eleven in the
    // morning.
    {
        id: 'tokyo-shinjuku-roof',
        cityId: 'tokyo',
        name: 'Shinjuku Rooftop, 11th Floor',
        blurb: 'A service door somebody wedged open years ago. The gap to the next building is exactly wide enough to be a bad idea.',
        icon: '\u{1F3D9}',
        games: ['rooftop-artillery'],
        regulars: ['wiz-k', 'clerk-israeli-af'],
        energyCost: 8,
        timeOfDay: 'evening',
        closedLine: 'The service door is locked in daylight. Come back when nobody is checking.',
    },
    {
        id: 'tel-aviv-water-tanks',
        cityId: 'tel-aviv',
        name: 'The Water Tanks, Allenby',
        blurb: 'Flat roof, four solar heaters, and a view of every other flat roof doing exactly the same thing.',
        icon: '\u{1F3D9}',
        games: ['rooftop-artillery'],
        regulars: ['gutter-gabe', 'yasser-abbasfat'],
        energyCost: 8,
        timeOfDay: 'night',
        closedLine: "Somebody is doing laundry up there. You are not throwing shoes past a stranger's sheets.",
    },
    {
        id: 'new-york-tar-beach',
        cityId: 'new-york',
        name: 'Tar Beach, Lower East',
        blurb: 'Six floors up a fire escape everyone agrees is fine. The wind between the buildings has opinions.',
        icon: '\u{1F3D9}',
        games: ['rooftop-artillery'],
        regulars: ['scalper-sid', 'the-game'],
        minCred: 10,
        energyCost: 9,
        timeOfDay: 'evening',
        closedLine: 'The super is on the stoop. Nobody is getting past him to the roof.',
    },
    {
        id: 'los-angeles-parking-roof',
        cityId: 'los-angeles',
        name: 'Level 7, Parking Structure B',
        blurb: 'Empty after six, warm until ten, open on every side. Somebody has already painted a target on the far wall.',
        icon: '\u{1F3D9}',
        games: ['rooftop-artillery'],
        regulars: ['the-game', 'bro-jogan'],
        energyCost: 7,
        timeOfDay: 'evening',
        closedLine: 'Still full of cars. Come back when the offices empty out.',
    },
    {
        id: 'paris-zinc-roofs',
        cityId: 'paris',
        name: 'The Zinc Roofs, 11th',
        blurb: 'Grey metal at forty degrees, a chimney to hold on to, and a drop nobody discusses. Extremely beautiful. Extremely stupid.',
        icon: '\u{1F3D9}',
        games: ['rooftop-artillery'],
        regulars: ['grandma-laces', 'adc'],
        minCred: 25,
        energyCost: 11,
        timeOfDay: 'night',
        closedLine: 'Wet zinc. Even the people who do this for a living are not doing this today.',
    },
    {
        id: 'chicago-el-roof',
        cityId: 'chicago',
        name: 'Above the Green Line',
        blurb: 'Three storeys over the tracks. Every ninety seconds the whole roof shakes and you wait it out.',
        icon: '\u{1F3D9}',
        games: ['rooftop-artillery'],
        regulars: ['wiz-k', 'scalper-sid'],
        energyCost: 9,
        timeOfDay: 'evening',
        closedLine: 'Track maintenance. There are men in orange vests exactly where you wanted to stand.',
    },
];

export const venuesIn = (cityId: string): Venue[] => VENUES.filter(v => v.cityId === cityId);

/** The day cycle drives time of day, the same way travel events do. */
export const timeOfDayFor = (day: number): Venue['timeOfDay'] =>
    (['morning', 'afternoon', 'evening', 'night'] as const)[day % 4];

export const isVenueOpen = (venue: Venue, day: number): boolean =>
    !venue.timeOfDay || venue.timeOfDay === timeOfDayFor(day);
