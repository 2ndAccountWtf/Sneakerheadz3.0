/**
 * The market, simulated.
 *
 * The game used to throw away every price in the world on each travel and roll
 * six fresh cities of pure noise around each model's base price. That has one
 * fatal consequence: nothing the player learns on Tuesday is worth anything on
 * Wednesday. You cannot buy low and sell high in a world with no memory — you
 * can only buy and then look at a new random number. Every other system in the
 * game (rumours, market signals, the analysis screen, Bro Jogan pumping a
 * model on air) was quietly pointless for the same reason.
 *
 * So prices persist now. Each city keeps a per-model **index**: a multiplier
 * against the model's base price, carried from day to day, pushed around by
 * four forces:
 *
 *   1. **The city's own fair value.** Chicago wants Jordans, Paris wants
 *      luxury. The index is always drifting back toward what *this* city
 *      thinks the shoe is worth — see `cityProfiles.ts`. That permanent gap
 *      between cities is the arbitrage the whole game is built on.
 *   2. **Momentum.** Shocks do not land and vanish; they decay over about
 *      three or four days. A model that jumped yesterday is probably still
 *      climbing today, which is what makes a trend readable — and therefore
 *      tradeable — instead of a coin flip.
 *   3. **Noise**, scaled by the model's own volatility and the city's churn.
 *      Tel Aviv thrashes; Paris barely moves.
 *   4. **The player.** Buying out a city's stock drives its price up; dumping
 *      forty pairs drives it down. This is the thing that stops the optimal
 *      strategy from being "find the one good trade and run it thirty times":
 *      the trade decays as you work it, and recovers while you are away.
 *
 * Mean reversion is deliberately gentle (about 18% of the gap per day) so a
 * dumped market takes several days to heal. That gives the map a shape — cities
 * you have strip-mined and cities you have not touched yet.
 */
import type { CityMarket, MarketSneaker, PriceIndex, Sneaker } from '../../types';
import { SNEAKERS } from '../../data/sneakers';
import { STORES_BY_CITY } from '../../data/stores';
import { STORE_CONFIGS } from '../../data/storeConfigs';
import { CITIES } from '../../data/cities';
import { profileFor } from './cityProfiles';
import { tagsFor } from './taxonomy';

/** How much of the gap to fair value closes each day. */
const REVERSION = 0.18;
/** How much of last night's move carries into tonight. */
const MOMENTUM_DECAY = 0.62;
/** Base overnight noise, before per-model volatility and per-city churn. */
const NOISE = 0.09;
/**
 * Hard rails on the index, as a fraction of the city's fair value.
 *
 * Deliberately tight. These bands and the FAIR bands below multiply together to
 * set the widest arbitrage the game can ever show, and the first tuning pass
 * got that wrong by a mile: compounding three tag affinities against a rarity
 * bias and a cost-of-living gave Paris a luxury collab at 4.6x base while
 * Chicago had the same shoe at 0.6x, and the loose index bands then turned that
 * into a 1265% flip. A thirty-day game where one flight pays 12x is over on day
 * three. These four numbers multiply out to a hard ceiling of about 2.9x
 * between the cheapest ask anywhere and the best bid anywhere, and
 * `tests/market.test.mts` asserts it — so a future affinity tweak cannot
 * quietly re-open that hole.
 */
const FLOOR = 0.86;
const CEILING = 1.2;

/**
 * And the same rails on fair value itself.
 *
 * Clamping alone was not enough: with affinities compounding freely, Paris and
 * Chicago both pinned to the ceiling on a Jordan and the cities stopped
 * disagreeing at all — the clamp flattened exactly the differences it was
 * supposed to preserve. So the compounded demand is first *compressed* toward
 * 1.0 by FAIR_COMPRESS (a power below one keeps the ordering while pulling the
 * extremes in), and only then clamped. The clamp is now a backstop that almost
 * never fires instead of the main mechanism.
 */
const FAIR_FLOOR = 0.78;
const FAIR_CEILING = 1.4;
const FAIR_COMPRESS = 0.4;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const SNEAKER_BY_ID = new Map(SNEAKERS.map((s) => [s.id, s]));

/**
 * Usable volatility.
 *
 * `Sneaker.volatility` was documented as "0.1 = 10% price swing", and then the
 * catalogue expansion shipped models at 4.5, 5.0 and 6.0 — six hundred percent.
 * Taken literally those shoes price at zero or at ten times base on the first
 * roll, which is how seeding managed to produce a negative index.
 *
 * Rather than rewrite 45 hand-tuned numbers (and lose the ordering somebody
 * intended), this compresses the whole range logarithmically: the relative
 * ranking survives, 0.15 stays calm, and 6.0 becomes "the wildest thing in the
 * game" instead of "arithmetically broken".
 */
const volOf = (sneaker: Sneaker): number =>
    Math.min(1.5, 0.15 + Math.log1p(Math.max(0, sneaker.volatility)) * 0.5);

/* ------------------------------------------------------------------ *
 * Fair value
 * ------------------------------------------------------------------ */

/**
 * What this city thinks this model is worth, as a multiple of base price.
 * Pure and cheap — it is the anchor every other calculation reverts to, so it
 * must not itself wobble.
 */
export function fairValue(sneaker: Sneaker, cityId: string): number {
    const profile = profileFor(cityId);
    const tags = tagsFor(sneaker);

    // Tags compound, but with diminishing returns: a shoe that is luxury AND
    // collab AND hype in Paris should be expensive, not absurd.
    let demand = 1;
    let weight = 1;
    for (const tag of tags) {
        const pull = profile.affinity[tag];
        if (pull === undefined) continue;
        demand *= 1 + (pull - 1) * weight;
        weight *= 0.6;
    }

    const rarity = profile.rarityBias[sneaker.rarity] ?? 1;

    // Deep local supply softens price; thin supply firms it. Half-weighted,
    // because supply also shows up directly as stock quantity.
    const scarcity = 1 / (1 + (profile.supply - 1) * 0.5);

    const raw = demand * rarity * scarcity * profile.costOfLiving;
    return clamp(Math.pow(raw, FAIR_COMPRESS), FAIR_FLOOR, FAIR_CEILING);
}

/**
 * How this city rates a shoe against everything else it sells.
 *
 * Absolute fair value mixes two different things: taste ("Chicago loves a
 * Jordan") and cost of living ("Paris is expensive"). Paris can therefore pay
 * more in dollars for a shoe it actively looks down on, which makes a raw
 * price comparison a bad way to ask what a city *wants*. This divides taste out
 * of the general price level, so 1.2 means "a fifth above what this city pays
 * for a typical pair" no matter how pricey the city is.
 */
export function relativeValue(sneaker: Sneaker, cityId: string): number {
    const mean = cityMean(cityId);
    return mean > 0 ? fairValue(sneaker, cityId) / mean : 1;
}

const meanCache = new Map<string, number>();
function cityMean(cityId: string): number {
    const hit = meanCache.get(cityId);
    if (hit !== undefined) return hit;
    const mean = SNEAKERS.reduce((a, s) => a + fairValue(s, cityId), 0) / Math.max(1, SNEAKERS.length);
    meanCache.set(cityId, mean);
    return mean;
}

/* ------------------------------------------------------------------ *
 * The day step
 * ------------------------------------------------------------------ */

/** Box-Muller, so shocks are normally distributed instead of uniformly flat. */
function gauss(rng: () => number): number {
    const u = Math.max(1e-9, rng());
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Advances one model in one city by a day. */
export function stepIndex(
    index: PriceIndex,
    sneaker: Sneaker,
    cityId: string,
    rng: () => number = Math.random,
): PriceIndex {
    const profile = profileFor(cityId);
    const fair = fairValue(sneaker, cityId);

    const gap = fair - index.value;
    const shock = gauss(rng) * NOISE * volOf(sneaker) * profile.churn * fair;

    // Momentum carries, then takes this night's push. Reversion enters through
    // momentum rather than being applied to the value directly, which is what
    // makes a recovering market overshoot slightly and feel alive instead of
    // gliding back to fair value on rails.
    const momentum = index.momentum * MOMENTUM_DECAY + gap * REVERSION + shock;
    const value = clamp(index.value + momentum, fair * FLOOR, fair * CEILING);

    return { value, momentum, previous: index.value };
}

/** A fresh index sitting at fair value, give or take. */
export function seedIndex(
    sneaker: Sneaker,
    cityId: string,
    rng: () => number = Math.random,
): PriceIndex {
    const fair = fairValue(sneaker, cityId);
    const value = clamp(
        fair * (1 + (rng() - 0.5) * volOf(sneaker)),
        fair * FLOOR,
        fair * CEILING,
    );
    return { value, momentum: 0, previous: value };
}

/* ------------------------------------------------------------------ *
 * Player pressure
 * ------------------------------------------------------------------ */

/**
 * Moves a city's price because the player traded into it.
 *
 * Impact is per-pair and scaled against the city's supply depth, so clearing
 * three pairs out of a thin Paris boutique moves the needle harder than
 * clearing three out of a Tel Aviv pile. `direction` is +1 for buying (you are
 * competing for stock, price rises) and -1 for selling (you are the stock now).
 *
 * The move lands on `value` and not on `momentum`, so it does not snowball —
 * it is a level shift that then decays back at the normal reversion rate.
 */
export function applyTradePressure(
    market: CityMarket,
    sneakerId: string,
    quantity: number,
    direction: 1 | -1,
): CityMarket {
    const sneaker = SNEAKER_BY_ID.get(sneakerId);
    const index = market.index[sneakerId];
    if (!sneaker || !index || quantity <= 0) return market;

    const profile = profileFor(market.cityId);
    const fair = fairValue(sneaker, market.cityId);

    // ~4% per pair in a normal market, damped by depth, and sub-linear in
    // quantity so selling twenty pairs is punishing without being ruinous.
    const perPair = 0.04 / Math.max(0.5, profile.supply);
    const magnitude = perPair * Math.sqrt(quantity) * Math.sqrt(Math.max(1, quantity)) * fair;

    const value = clamp(index.value + direction * magnitude, fair * FLOOR, fair * CEILING);

    return {
        ...market,
        index: { ...market.index, [sneakerId]: { ...index, value } },
        sneakers: repriceListings(market.sneakers, { ...market.index, [sneakerId]: { ...index, value } }),
    };
}

/* ------------------------------------------------------------------ *
 * Listings
 * ------------------------------------------------------------------ */

/**
 * Listings keep their identity across days — the same store tab stocks the
 * same models — and only their price and quantity move. That stability is the
 * point: "the pigeon dunks at Atmos" has to still be there tomorrow for the
 * player to have come back for it.
 */
function priceListing(listing: MarketSneaker, index: Record<string, PriceIndex>): number {
    const sneaker = SNEAKER_BY_ID.get(listing.sneakerId);
    const idx = index[listing.sneakerId];
    if (!sneaker || !idx) return listing.price;

    let price = sneaker.basePrice * idx.value;
    // A fake costs what a fake costs. The markup on a *convincing* fake is the
    // player's problem, handled at the point of sale.
    if (listing.isFake) price *= 0.15;
    // Per-listing spread, stable because it is derived from the listing's own
    // group rather than rolled: two tabs in one city are not the same price.
    price *= 1 + spreadFor(listing) ;
    return Math.max(1, Math.round(price));
}

/** A stable ±6% per-tab spread, hashed from the group name. */
function spreadFor(listing: MarketSneaker): number {
    let h = 0;
    const key = `${listing.group}:${listing.sneakerId}`;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    return ((h % 1000) / 1000 - 0.5) * 0.12;
}

export const repriceListings = (
    listings: MarketSneaker[],
    index: Record<string, PriceIndex>,
): MarketSneaker[] => listings.map((l) => ({ ...l, price: priceListing(l, index) }));

/** Overnight restock: stock creeps back toward the city's natural depth. */
function restock(listing: MarketSneaker, supply: number, rng: () => number): number {
    const target = Math.max(1, Math.round((2 + rng() * 4) * supply));
    if (listing.quantity >= target) return listing.quantity;
    return Math.min(target, listing.quantity + 1 + Math.floor(rng() * 2));
}

/* ------------------------------------------------------------------ *
 * World construction and advance
 * ------------------------------------------------------------------ */

/**
 * Builds the world once, at new game. The roster of which models sit in which
 * store tab is fixed here for the whole run — that is what makes the map
 * learnable.
 */
export function seedWorld(rng: () => number = Math.random): Record<string, CityMarket> {
    const markets: Record<string, CityMarket> = {};

    for (const city of CITIES) {
        const profile = profileFor(city.id);
        const listings: MarketSneaker[] = [];
        const index: Record<string, PriceIndex> = {};

        for (const sneaker of SNEAKERS) index[sneaker.id] = seedIndex(sneaker, city.id, rng);

        for (const storeInfo of STORES_BY_CITY[city.id] ?? []) {
            const config = STORE_CONFIGS[storeInfo.id];
            if (!config) continue;

            for (const tab of config.tabs) {
                if (tab.id === 'trade' || tab.id === 'consignment') continue;
                const isFakeTab =
                    tab.inventoryGroupRef.includes('fakes') || tab.inventoryGroupRef.includes('backroom');

                // Which models a tab stocks is weighted by the city's taste, so
                // Chicago's shelves are visibly full of basketball shoes rather
                // than merely pricing them differently.
                const count = 3 + Math.floor(rng() * 6);
                for (const sneaker of weightedPick(SNEAKERS, count, city.id, rng)) {
                    listings.push({
                        sneakerId: sneaker.id,
                        price: 0, // set by repriceListings below
                        quantity: Math.max(1, Math.round((1 + rng() * 4) * profile.supply)),
                        group: tab.inventoryGroupRef,
                        isFake: isFakeTab,
                    });
                }
            }
        }

        if (!listings.length) {
            for (const sneaker of weightedPick(SNEAKERS, 10, city.id, rng)) {
                listings.push({
                    sneakerId: sneaker.id,
                    price: 0,
                    quantity: 5,
                    group: 'general',
                });
            }
        }

        markets[city.id] = {
            cityId: city.id,
            index,
            sneakers: repriceListings(listings, index),
        };
    }

    return markets;
}

/** Picks `count` distinct models, favouring the ones this city cares about. */
function weightedPick(pool: Sneaker[], count: number, cityId: string, rng: () => number): Sneaker[] {
    const remaining = [...pool];
    const picked: Sneaker[] = [];
    while (picked.length < count && remaining.length) {
        const weights = remaining.map((s) => Math.max(0.15, fairValue(s, cityId)));
        const total = weights.reduce((a, b) => a + b, 0);
        let roll = rng() * total;
        let i = 0;
        while (i < remaining.length - 1 && roll > weights[i]) { roll -= weights[i]; i++; }
        picked.push(remaining.splice(i, 1)[0]);
    }
    return picked;
}

/**
 * One day passes everywhere — including the cities the player is not in, which
 * is the other half of arbitrage: the deal you saw in Tokyo is still moving
 * while you are in Paris deciding whether to go back for it.
 */
export function advanceWorld(
    markets: Record<string, CityMarket>,
    rng: () => number = Math.random,
): Record<string, CityMarket> {
    const next: Record<string, CityMarket> = {};

    for (const [cityId, market] of Object.entries(markets)) {
        const profile = profileFor(cityId);
        const index: Record<string, PriceIndex> = {};

        for (const [sneakerId, idx] of Object.entries(market.index)) {
            const sneaker = SNEAKER_BY_ID.get(sneakerId);
            index[sneakerId] = sneaker ? stepIndex(idx, sneaker, cityId, rng) : idx;
        }

        const restocked = market.sneakers.map((l) => ({ ...l, quantity: restock(l, profile.supply, rng) }));

        next[cityId] = { ...market, index, sneakers: repriceListings(restocked, index) };
    }

    return next;
}

/* ------------------------------------------------------------------ *
 * Reading the market
 * ------------------------------------------------------------------ */

export interface Trend {
    /** Percentage move since yesterday. */
    changePct: number;
    direction: 'up' | 'down' | 'flat';
    /** Where the price sits against this city's fair value, as a percentage. */
    vsFairPct: number;
    /** True when momentum and the move agree — the trend is likely to hold. */
    running: boolean;
}

export function trendFor(market: CityMarket | undefined, sneakerId: string): Trend | undefined {
    const idx = market?.index?.[sneakerId];
    const sneaker = SNEAKER_BY_ID.get(sneakerId);
    if (!idx || !sneaker || !market) return undefined;

    const changePct = idx.previous ? ((idx.value - idx.previous) / idx.previous) * 100 : 0;
    const fair = fairValue(sneaker, market.cityId);
    return {
        changePct,
        direction: changePct > 0.75 ? 'up' : changePct < -0.75 ? 'down' : 'flat',
        vsFairPct: ((idx.value - fair) / fair) * 100,
        running: Math.sign(idx.momentum) === Math.sign(changePct) && Math.abs(changePct) > 0.75,
    };
}

/** Cheapest live listing for a model in a city, ignoring fakes. */
export function bestAsk(market: CityMarket | undefined, sneakerId: string): number | undefined {
    const live = market?.sneakers.filter((s) => s.sneakerId === sneakerId && !s.isFake && s.quantity > 0);
    if (!live?.length) return undefined;
    return Math.min(...live.map((l) => l.price));
}

/** What a city would pay for a model, before condition and buffs. */
export function localValue(market: CityMarket | undefined, sneakerId: string): number | undefined {
    const idx = market?.index?.[sneakerId];
    const sneaker = SNEAKER_BY_ID.get(sneakerId);
    if (!idx || !sneaker) return undefined;
    return Math.max(1, Math.round(sneaker.basePrice * idx.value));
}
