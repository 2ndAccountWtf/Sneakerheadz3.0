/**
 * Hype events and street selling — the shared contract.
 *
 * Two things are being built against these types at once: the calendar that
 * decides when and where a sneaker event happens, and the street-selling layer
 * that gets busier and richer when one is on. They meet here and nowhere else,
 * so neither has to know how the other works.
 */

/** What a city's sneaker scene is doing today. */
export interface HypeEvent {
    id: string;
    cityId: string;
    /** "Long Beach Sneaker Expo". Shown on the dashboard days in advance. */
    name: string;
    blurb: string;
    icon: string;
    /** First day it runs, inclusive. */
    startDay: number;
    /** How many days it runs. Most are one or two; a big expo is three. */
    days: number;
    /** Multiplier on what buyers offer. 1.4 means everyone is overpaying 40%. */
    priceMultiplier: number;
    /** How much busier the street is. Drives how many buyers you see. */
    footfallMultiplier: number;
    /**
     * Tags the crowd is specifically feverish about — see ShoeTag in
     * `systems/market/taxonomy.ts`. A shoe matching one of these gets a further
     * bump on top of `priceMultiplier`.
     */
    hotTags: string[];
    /** Chance per buyer that somebody famous walks up instead. 0..1. */
    celebrityChance: number;
    /** Extra attention from people who are not there to buy. 0..1 per session. */
    heatMultiplier: number;
}

/** The three kinds of person who will buy a pair off you on a pavement. */
export type BuyerKind = 'local' | 'international' | 'celebrity';

/** One person, generated for one moment, who wants to buy something. */
export interface StreetBuyer {
    id: string;
    kind: BuyerKind;
    name: string;
    /** One line, in their voice, when they walk up. */
    opener: string;
    /**
     * For an international buyer, the city whose taste they price by — the
     * whole point of them. A Chicago tourist in Paris pays Chicago money for a
     * Jordan, which is what makes a city's character worth learning.
     */
    homeCityId?: string;
    /** Set for a celebrity: which NPC this is, so a sale builds a connection. */
    npcId?: string;
    /** What they are after. Undefined means they will look at anything. */
    wantsSneakerId?: string;
    wantsTag?: string;
    wantsRarity?: string;
    /** Their opening offer as a fraction of what the pair is worth locally. */
    offerPct: number;
    /** How far they will come up if pushed, as a fraction. */
    ceilingPct: number;
    /** 0..1. How likely they are to spot a fake. */
    eye: number;
    /** 0..1. How likely this goes wrong in a way that costs you. */
    danger: number;
    /** How long they will stand there, in seconds. */
    patience: number;
}
