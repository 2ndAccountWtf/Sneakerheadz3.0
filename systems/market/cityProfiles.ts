/**
 * What each city actually wants.
 *
 * Six cities that price everything identically are one city with six
 * backdrops. The whole trading game lives in the gap between what Chicago pays
 * for a Jordan and what Paris pays for the same box, so this file is where
 * that gap is declared.
 *
 * Each profile answers four questions:
 *   - **affinity**  which kinds of shoe this city pays over the odds for, and
 *                   which it shrugs at. 1.0 is "the world price".
 *   - **rarityBias** how much the city cares about scarcity as such. Tokyo
 *                   pays for the grail; Tel Aviv would rather have four pairs.
 *   - **supply**    how deep the local stock is. Deep supply means low prices
 *                   and room to buy; thin supply means the city is a place to
 *                   sell, not to shop.
 *   - **risk**      fakes on the shelf, and how twitchy prices are day to day.
 *
 * The numbers are deliberately loud. A 15% edge is invisible across a
 * thirty-day run; a 60% edge is a reason to get on a plane.
 */
import type { ShoeTag } from './taxonomy';

export interface CityProfile {
    cityId: string;
    /** One line, in the city's own voice, for the market screen. */
    character: string;
    /** Demand multipliers by tag. Absent tag = 1.0. */
    affinity: Partial<Record<ShoeTag, number>>;
    rarityBias: Record<'Common' | 'Uncommon' | 'Rare' | 'Legendary', number>;
    /** Stock depth multiplier. >1 = shelves are full, prices soften. */
    supply: number;
    /** Share of listings in fake-tagged tabs that are actually convincing. */
    fakeRate: number;
    /** Daily volatility multiplier — how far prices can move overnight. */
    churn: number;
    /** Everything costs this much more just for being here. */
    costOfLiving: number;
}

export const CITY_PROFILES: Record<string, CityProfile> = {
    tokyo: {
        cityId: 'tokyo',
        character: 'Pays anything for the right pair, and nothing for the wrong one.',
        affinity: { hype: 1.55, tech: 1.4, collab: 1.35, retro: 1.2, luxury: 1.1, workwear: 0.75, casual: 0.8 },
        rarityBias: { Common: 0.85, Uncommon: 1.0, Rare: 1.3, Legendary: 1.7 },
        supply: 0.8,
        fakeRate: 0.1,
        churn: 1.2,
        costOfLiving: 1.15,
    },
    'tel-aviv': {
        cityId: 'tel-aviv',
        character: 'Everything is negotiable and half of it is not real.',
        affinity: { casual: 1.35, skate: 1.15, runner: 1.05, luxury: 0.7, hype: 0.85, collab: 0.8 },
        rarityBias: { Common: 1.2, Uncommon: 1.1, Rare: 0.9, Legendary: 0.75 },
        supply: 1.35,
        fakeRate: 0.42,
        churn: 1.45,
        costOfLiving: 0.85,
    },
    'new-york': {
        cityId: 'new-york',
        character: 'The reference price. Everywhere else is a bet against this.',
        affinity: { basketball: 1.15, hype: 1.15, collab: 1.1, retro: 1.05 },
        rarityBias: { Common: 1.0, Uncommon: 1.0, Rare: 1.05, Legendary: 1.1 },
        supply: 1.15,
        fakeRate: 0.22,
        churn: 1.0,
        costOfLiving: 1.1,
    },
    'los-angeles': {
        cityId: 'los-angeles',
        character: 'Whatever was on a podcast Tuesday is gone by Thursday.',
        affinity: { skate: 1.45, hype: 1.35, casual: 1.2, collab: 1.15, workwear: 0.7, basketball: 0.95 },
        rarityBias: { Common: 0.95, Uncommon: 1.05, Rare: 1.15, Legendary: 1.3 },
        supply: 1.2,
        fakeRate: 0.2,
        churn: 1.5,
        costOfLiving: 1.0,
    },
    paris: {
        cityId: 'paris',
        character: 'Sells shoes the way a gallery sells paintings, at those prices.',
        affinity: { luxury: 1.75, collab: 1.3, casual: 0.85, skate: 0.8, basketball: 0.85, workwear: 0.65, runner: 0.9 },
        rarityBias: { Common: 0.8, Uncommon: 0.95, Rare: 1.25, Legendary: 1.55 },
        supply: 0.75,
        fakeRate: 0.12,
        churn: 0.85,
        costOfLiving: 1.25,
    },
    chicago: {
        cityId: 'chicago',
        character: 'Knows exactly what a Jordan is worth and will not be told otherwise.',
        affinity: { basketball: 1.6, retro: 1.4, workwear: 1.15, runner: 1.0, luxury: 0.65, tech: 0.8, hype: 0.9 },
        rarityBias: { Common: 1.05, Uncommon: 1.05, Rare: 1.1, Legendary: 1.15 },
        supply: 1.1,
        fakeRate: 0.25,
        churn: 0.95,
        costOfLiving: 0.9,
    },
};

/** Neutral profile, so an unknown city id degrades to "world price". */
export const NEUTRAL_PROFILE: CityProfile = {
    cityId: 'unknown',
    character: 'A market like any other.',
    affinity: {},
    rarityBias: { Common: 1, Uncommon: 1, Rare: 1, Legendary: 1 },
    supply: 1,
    fakeRate: 0.2,
    churn: 1,
    costOfLiving: 1,
};

export const profileFor = (cityId: string): CityProfile =>
    CITY_PROFILES[cityId] ?? NEUTRAL_PROFILE;
