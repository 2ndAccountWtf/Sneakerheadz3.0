/**
 * The rep economy, simulated.
 *
 * Step 3 of `docs/REPS.md`. The ladder exists (step 1) and fakes leak onto
 * ordinary shelves (step 2), and both of those were built without anyone
 * knowing the answer to the only question that decides whether the feature
 * ships: **does a rep-runner out-earn a straight trader, by how much, and at
 * what cost in street cred?**
 *
 * The two failure modes the design doc names are both one number:
 *
 *   1. Reps strictly optimal — everyone runs reps every run and the straight
 *      game dies.
 *   2. Reps strictly stupid — nobody touches them and the feature was wasted.
 *
 * So this file runs three traders over the same seeded worlds and prints the
 * distributions, then turns them into guard-rails. The assertions at the
 * bottom are written against what a *healthy* economy looks like, not against
 * what was measured — if they fail, the economy is wrong and the test is
 * doing its job.
 *
 * ---------------------------------------------------------------------------
 * THE AGENT POLICY, IN FULL
 * ---------------------------------------------------------------------------
 * Deliberately greedy and deliberately dumb. This measures the economy, not an
 * AI. A reader should be able to hold all of it in their head:
 *
 *   Each day, standing in one city:
 *     1. **Sell the whole bag.** Every pair gets routed to whichever channel
 *        has the best expected value for *that grade* — a street spot, a
 *        collector, or the shop counter — and anything the street or a
 *        collector did not take is dumped at the shop before the day ends. The
 *        bag is therefore empty every morning: one-day turnover, no holding.
 *     2. **Buy.** Score every listing in the city against every other city:
 *        expected sale proceeds there, minus what it costs here. Buy the best,
 *        repeatedly, until the bag is full, the cash is gone, or nothing is
 *        left that pays. The destination chosen is the one whose basket is
 *        worth the most.
 *     3. **Fly.** One hop per day; the world advances.
 *
 *   The three strategies differ in exactly one line — which listings they will
 *   look at:
 *     - **straight**    — `retail` only. Never opens a fakes tab.
 *     - **rep runner**  — counterfeits when any counterfeit pays, retail only
 *                         as a fallback when none does.
 *     - **mixed**       — best expected value of the two, per purchase.
 *
 * What is modelled for real, by calling the shipped code: the market and its
 * daily drift (`simulate.ts`), trade pressure, street negotiation and its risk
 * rolls (`street/selling.ts`), collector negotiation and its risk rolls
 * (`collectors.ts`), the police stop (`police/bust.ts`), cred gates on spots
 * and collectors, and every detection roll routed through `spotChance`.
 *
 * What is NOT modelled, and why: hype events (a calendar, orthogonal to
 * grades), health/food/naps (energy is restored nightly for a flat fee — see
 * `REST_COST` — so it never becomes the binding constraint), mini-games, and
 * the shop-counter reducer, which lives inside a React hook and is reproduced
 * here line-for-line from `hooks/useGame.ts`'s `SELL_SNEAKER`.
 *
 * ---------------------------------------------------------------------------
 * TWO THINGS FOUND WHILE BUILDING THIS — read before trusting the numbers
 * ---------------------------------------------------------------------------
 * **a. The sell-side price the game actually pays is not the one the market
 * tests guard.** `tests/market.test.mts` defines `sellValue` as
 * `localValue x scarcity x 0.9`, capped at `referenceAsk x 0.9`, and says in a
 * comment that this is "the sell-side price, as `systems/pricing.ts`'s
 * `getCityMarketPrice` computes it". It is not. That function returns
 * `max(posted listing prices)` — no scarcity term, no bid-ask spread, no cap,
 * and sold-out listings still count. Since the tab spread is +/-6%, the live
 * function pays *more* than the cheapest thing on the shelf in the same city,
 * which is the exact round trip `market.test.mts` asserts is impossible. The
 * gap is printed in the report below.
 *
 * This simulation uses the **guarded** formula, because the alternative is
 * measuring an arbitrage bug instead of the rep economy. Everything here is
 * therefore a *lower* bound on what a trader of either kind actually earns.
 *
 * **b. Street and collector sales apply no market pressure.** `SELL_SNEAKER`
 * calls `applyTradePressure` and `addLocalStock`; `RESOLVE_STREET_SALE` and
 * `RESOLVE_COLLECTOR_DEAL` write the player back and nothing else. Dumping ten
 * pairs on a corner moves no price and fills no shelf. Reproduced faithfully
 * here.
 *
 * **c. The shop counter pays street cred for selling counterfeits.**
 * `systems/street/selling.ts` is careful about this — `const credGain =
 * item.isFake ? 0 : ...`. `SELL_SNEAKER` is not: its `credGain` is a pure
 * function of profit, and a pair bought at 15% of market has the largest
 * profit in the game. So the rep route *out-earns* the straight route in
 * standing, which is the exact inverse of the rule docs/REPS.md calls "the
 * right rule" and lists as already true. Reproduced faithfully here, and the
 * cred guard-rail below fails because of it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT SAID, THE FIRST TIME IT RAN
 * ---------------------------------------------------------------------------
 * Reps are **under**-powered, and not for the reason anyone expected. A rep
 * returns 3.2x what it cost against a straight pair's 1.7x — better per dollar
 * by a mile — and still finishes a thirty-day run on 0.72x the straight
 * trader's net worth. Two things do it:
 *
 *   1. **The bag holds ten pairs however much each one cost.** Once cash stops
 *      binding — which is inside a week in this economy — profit per day is
 *      `slots x (what it sells for - what it cost)`, and a cheap pair does not
 *      buy you an eleventh slot. Both traders clear ~$150k/day. Cheapness is
 *      early-game leverage and nothing else.
 *   2. **Fakes are priced out of the channel that pays.** A collector stretches
 *      to 1.3-1.55x local value and has an `eye` of 0.25-0.85; a shop counter
 *      pays 1.0x and, at a `securityLevel 0` store, barely looks. So the
 *      straight trader sells 155 of 239 pairs privately at a premium while the
 *      rep runner dumps 177 of 233 over a counter at par, minus a 16%
 *      confiscation rate.
 *
 * The lever that would fix this is *not* `GRADE_COST` or `GRADE_DIFFICULTY` —
 * making reps cheaper or safer does not buy a slot. It is the sale side: a
 * counterfeit that survives a collector has to be worth *more* than a real pair
 * sold over a counter, or the rep route can never pay for its own risk.
 */
import assert from 'node:assert/strict';

import { CITIES } from '../data/cities.ts';
import { SNEAKERS } from '../data/sneakers.ts';
import { STORES_BY_CITY } from '../data/stores.ts';
import { STORE_CONFIGS } from '../data/storeConfigs.ts';
import { SELLING_SPOTS, isSpotOpen, type SellingSpot } from '../data/sellingSpots.ts';
import type { Collector } from '../data/collectors.ts';
import { INITIAL_PLAYER, MAX_ENERGY, MAX_HEAT, MAX_INVENTORY_SIZE, TRAVEL_ENERGY_COST } from '../constants.ts';
import type { CityMarket, InventoryItem, MarketSneaker, Player } from '../types.ts';

import { seeded, hashString } from '../utils/rng.ts';
import {
    seedWorld, advanceWorld, applyTradePressure, addLocalStock,
    localValue, referenceAsk, bestAsk, scarcityFor,
} from '../systems/market/simulate.ts';
import { gradeOf, catchChance, caughtWith, type AuthGrade } from '../systems/market/authenticity.ts';
import { shopCredGain, getCityMarketPrice } from '../systems/pricing.ts';
import {
    arriveAtSpot, openingOffer as streetOpening, counterOffer as streetCounter,
    acceptOffer as streetAccept, walkAway as streetWalk, resolveSale, shutdownChance,
} from '../systems/street/selling.ts';
import { generateBuyer, arrivalChance } from '../systems/street/buyers.ts';
import {
    collectorsIn, interestedIn as collectorWants,
    openingOffer as collectorOpening, counterOffer as collectorCounter,
    acceptOffer as collectorAccept, walkAway as collectorWalk, resolveDeal,
    fakeDetectChance, robberyChance, counterfeitChance,
} from '../systems/collectors.ts';
import { streetBustChance, rollOfficer, openBust, offer as bustOffer, resolveBust } from '../systems/police/bust.ts';

let pass = 0;
const failures: string[] = [];
/**
 * Unlike the other test files this one keeps going after a failure. Every
 * assertion below is a separate question about the economy, and a tuning pass
 * wants all of the answers at once, not the first one.
 */
const t = (n: string, f: () => void) => {
    try { f(); pass++; console.log('  ok  ' + n); }
    catch (err) {
        failures.push(`${n}\n      ${(err as Error).message}`);
        console.log('  FAIL  ' + n);
        console.log('        ' + (err as Error).message);
    }
};

/* ------------------------------------------------------------------ *
 * Tunables of the *simulation* — not of the game.
 * ------------------------------------------------------------------ */

/** A run. Matches the thirty-day horizon `tests/market.test.mts` checks against. */
const DAYS = 30;
/** Seeds per strategy. All three strategies see the identical world on a seed. */
const SEEDS = 400;
/** A bed and a meal, so energy never becomes the thing being measured. */
const REST_COST = 40;
/**
 * Working float: what the trader will not put into stock. Without one a greedy
 * agent spends to the last dollar, and the first police stop — 70% of the
 * pocket and every counterfeit in the bag — ends the run at exactly zero with
 * no way back. Never more than half the roll, so a trader who has been cleaned
 * out still buys *something* and can climb back; an absorbing state at $0 is
 * the harness measuring its own arithmetic.
 */
const FLOAT_PCT = 0.1;
const FLOAT_MIN = 200;
/** The bid-ask spread a shop lives on. Same constant, same meaning, as pricing.ts. */
const BID_ASK = 0.9;
/**
 * What the street pays, per buyer kind, as a fraction of local value: roughly
 * the midpoint of `offerPct`..`ceilingPct` in `systems/street/buyers.ts` given
 * a trader who opens at local value and takes any counter above their floor.
 * Used only to *choose* a channel; the price actually paid comes out of the
 * real negotiation.
 */
const STREET_PAY = { local: 0.88, international: 1.15, celebrity: 1.7 };
/** A street buyer's typical `eye`, for scoring a channel before meeting one. */
const STREET_EYE = 0.25;
/** A street buyer's typical `danger`. */
const STREET_DANGER = 0.06;
/** Never take a street counter below this share of what the shop would pay anyway. */
const STREET_FLOOR = 0.75;

type Strategy = 'straight' | 'rep-runner' | 'mixed';
const STRATEGIES: Strategy[] = ['straight', 'rep-runner', 'mixed'];

/* ------------------------------------------------------------------ *
 * Static world facts, computed once.
 * ------------------------------------------------------------------ */

/**
 * The lowest-rigour counter in each city. The player picks which shop to stand
 * in before hitting Sell, and `hooks/useGame.ts` reads that store's
 * `securityLevel`, so a rep-runner obviously picks the worst one. A straight
 * trader is indifferent, so both use this and the comparison stays clean.
 */
const SHOP_RIGOUR: Record<string, number> = {};
for (const city of CITIES) {
    const levels = (STORES_BY_CITY[city.id] ?? [])
        .map(s => STORE_CONFIGS[s.id]?.behavior?.securityLevel)
        .filter((n) => typeof n === 'number') as number[];
    SHOP_RIGOUR[city.id] = levels.length ? Math.min(...levels) : 1;
}

const SPOTS_BY_CITY: Record<string, SellingSpot[]> = {};
for (const spot of SELLING_SPOTS) (SPOTS_BY_CITY[spot.cityId] ??= []).push(spot);

const OTHER_CITIES: Record<string, string[]> = {};
for (const c of CITIES) OTHER_CITIES[c.id] = CITIES.filter(o => o.id !== c.id).map(o => o.id);

/* ------------------------------------------------------------------ *
 * Prices
 * ------------------------------------------------------------------ */

/**
 * What a city pays for a pair, as `tests/market.test.mts` defines it and as
 * `systems/pricing.ts` is documented to. See note (a) in the module doc for
 * why this is not what `getCityMarketPrice` actually returns.
 */
function guardedSellValue(market: CityMarket | undefined, sneakerId: string): number {
    const base = localValue(market, sneakerId);
    if (base === undefined || !market) return 0;
    const raw = base * scarcityFor(market, sneakerId).multiplier * BID_ASK;
    const posted = referenceAsk(market, sneakerId);
    return Math.max(1, Math.round(posted === undefined ? raw : Math.min(raw, posted * BID_ASK)));
}

/* ------------------------------------------------------------------ *
 * Channel scoring
 * ------------------------------------------------------------------ */

/** The spot in this city worth standing at today, or null if none will have us. */
function bestSpot(cityId: string, day: number, player: Player): SellingSpot | null {
    let best: SellingSpot | null = null;
    let bestScore = -Infinity;
    for (const spot of SPOTS_BY_CITY[cityId] ?? []) {
        if (!isSpotOpen(spot, day)) continue;
        if (spot.minCred !== undefined && player.streetCred < spot.minCred) continue;
        if (player.energy < spot.energyCost) continue;
        const score = streetPayPct(spot) * (1 - shutdownChance(spot, player));
        if (score > bestScore) { bestScore = score; best = spot; }
    }
    return best;
}

/** Expected share of local value this spot's crowd pays, from its own buyer mix. */
function streetPayPct(spot: SellingSpot): number {
    const { local, international, celebrity } = spot.buyerMix;
    const total = local + international + celebrity;
    return (local * STREET_PAY.local
        + international * STREET_PAY.international
        + celebrity * STREET_PAY.celebrity) / total;
}

function streetEV(spot: SellingSpot | null, player: Player, grade: AuthGrade, value: number): number {
    if (!spot) return -Infinity;
    return value * streetPayPct(spot)
        * (1 - shutdownChance(spot, player))
        * (1 - STREET_DANGER)
        * (1 - catchChance({ grade }, { securityLevel: STREET_EYE * 2, heat: player.heat }, STREET_EYE));
}

function shopEV(cityId: string, player: Player, grade: AuthGrade, value: number): number {
    // Matches `SELL_SNEAKER` in hooks/useGame.ts: the shop's policy decides how
    // often the clerk looks, the clerk's own eye decides whether he sees.
    const securityLevel = SHOP_RIGOUR[cityId];
    const caught = catchChance({ grade }, { securityLevel, heat: player.heat }, 0.35 + securityLevel * 0.3);
    // Caught costs the pair and a fine of 20% of the price.
    return value * (1 - caught) - value * 0.2 * caught;
}

function collectorEV(collector: Collector, player: Player, grade: AuthGrade, value: number): number {
    const mid = (collector.openMultiplier + collector.ceilingMultiplier) / 2;
    const gross = value * mid;
    return gross
        * (1 - robberyChance(collector, gross, player))
        * (1 - catchChance({ grade }, { securityLevel: 2, heat: player.heat }, fakeDetectChance(collector, player)))
        * (1 - counterfeitChance(collector, player));
}

/** The collector in this city worth meeting for this pair, if any. */
function bestCollector(cityId: string, player: Player, item: InventoryItem, value: number): Collector | null {
    let best: Collector | null = null;
    let bestScore = -Infinity;
    for (const c of collectorsIn(cityId, player)) {
        if (!collectorWants(c, item)) continue;
        const score = collectorEV(c, player, gradeOf(item), value);
        if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
}

/** The best any channel in this city would do for a pair of this grade. */
function bestChannelEV(cityId: string, day: number, player: Player, probe: InventoryItem, value: number): number {
    const grade = gradeOf(probe);
    let best = shopEV(cityId, player, grade, value);
    best = Math.max(best, streetEV(bestSpot(cityId, day, player), player, grade, value));
    const collector = bestCollector(cityId, player, probe, value);
    if (collector) best = Math.max(best, collectorEV(collector, player, grade, value));
    return best;
}

/* ------------------------------------------------------------------ *
 * A run
 * ------------------------------------------------------------------ */

interface RunResult {
    netWorth: number;
    cred: number;
    heatPeak: number;
    heatFinal: number;
    caughtStreet: number;
    caughtCollector: number;
    caughtShop: number;
    busts: number;
    repsBought: number;
    retailBought: number;
    salesStreet: number;
    salesCollector: number;
    salesShop: number;
    /** Total handed over at tills, all thirty days. */
    spend: number;
    /** Total that actually landed in the pocket — confiscations excluded. */
    proceeds: number;
}

function freshPlayer(): Player {
    return {
        ...INITIAL_PLAYER,
        inventory: [],
        storage: [],
        statusEffects: [],
        buffs: [],
        flags: {},
        connections: {},
        wallet: { ...INITIAL_PLAYER.wallet },
        stats: { ...INITIAL_PLAYER.stats },
    };
}

function runOne(seed: number, strategy: Strategy): RunResult {
    // Two independent streams. The world's is identical across strategies on a
    // seed — so all three see the same shelves and the same drift — while the
    // agent's covers every encounter roll, including the ones the shipped code
    // takes through `Math.random` (patched by the caller).
    const worldRng = seeded(hashString(`rep-economy-world:${seed}`));
    const agentRng = seeded(hashString(`rep-economy-agent:${seed}`));
    (globalThis as { __repRng?: () => number }).__repRng = agentRng;

    let player = freshPlayer();
    let markets = seedWorld(worldRng);
    let city = 'tokyo';
    let instances = 0;

    const out: RunResult = {
        netWorth: 0, cred: 0, heatPeak: 0, heatFinal: 0,
        caughtStreet: 0, caughtCollector: 0, caughtShop: 0, busts: 0,
        repsBought: 0, retailBought: 0,
        salesStreet: 0, salesCollector: 0, salesShop: 0, spend: 0, proceeds: 0,
    };

    /** Per-day memo: a city's sell value only changes when we trade into it. */
    let valueCache = new Map<string, number>();
    const valueIn = (cityId: string, sneakerId: string): number => {
        const key = `${cityId}:${sneakerId}`;
        let v = valueCache.get(key);
        if (v === undefined) { v = guardedSellValue(markets[cityId], sneakerId); valueCache.set(key, v); }
        return v;
    };
    const invalidate = (cityId: string) => {
        for (const key of [...valueCache.keys()]) if (key.startsWith(`${cityId}:`)) valueCache.delete(key);
    };

    const holds = (item: InventoryItem) => player.inventory.some(i => i.instanceId === item.instanceId);

    for (let day = 1; day <= DAYS; day++) {
        valueCache = new Map();

        /* ---- 1. Sell the bag ---- */
        const bag = [...player.inventory];
        const street: InventoryItem[] = [];
        const viaCollector: { item: InventoryItem; collector: Collector }[] = [];
        const spot = bestSpot(city, day, player);

        for (const item of bag) {
            const value = valueIn(city, item.sneakerId);
            const grade = gradeOf(item);
            const shop = shopEV(city, player, grade, value);
            const onStreet = streetEV(spot, player, grade, value);
            const collector = bestCollector(city, player, item, value);
            const priv = collector ? collectorEV(collector, player, grade, value) : -Infinity;
            if (onStreet >= shop && onStreet >= priv) street.push(item);
            else if (priv >= shop && collector) viaCollector.push({ item, collector });
            // everything else falls through to the shop sweep below
        }

        if (spot && street.length) {
            const arrival = arriveAtSpot(spot, player, day, isSpotOpen(spot, day));
            if (arrival.ok) {
                player = arrival.player;

                // A stop, before any of it. Cheapest honest reading of the bust
                // system: offer his ceiling and pay if he takes it, otherwise
                // stand there and be searched.
                if (agentRng() < streetBustChance(spot.heatRate, player)) {
                    out.busts++;
                    const officer = rollOfficer(player, day, agentRng);
                    let bust = openBust(officer);
                    const canPay = player.cash >= officer.trueMax;
                    if (canPay) bust = bustOffer(bust, officer.trueMax, agentRng);
                    player = resolveBust(bust, canPay && bust.status === 'settled' ? 'pay' : 'refuse', player, agentRng).player;
                }

                for (const item of street) {
                    if (!holds(item)) continue;
                    if (agentRng() > arrivalChance(spot)) continue; // nobody stopped
                    const value = valueIn(city, item.sneakerId);
                    const buyer = generateBuyer(spot, day, player, null);
                    let neg = streetOpening(buyer, item, value);
                    const ask = Math.max(neg.currentOffer + 1, Math.round(value));
                    neg = streetCounter(neg, ask);
                    if (neg.status === 'negotiating') {
                        neg = neg.currentOffer >= value * STREET_FLOOR ? streetAccept(neg) : streetWalk(neg);
                    }
                    const result = resolveSale(neg, player, spot, day, null);
                    player = result.player;
                    if (result.result === 'sold') { out.salesStreet++; out.proceeds += result.amount; }
                    if (result.result === 'caughtFake') out.caughtStreet++;
                }
            }
        }

        for (const { item, collector } of viaCollector) {
            if (!holds(item)) continue;
            const value = valueIn(city, item.sneakerId);
            let neg = collectorOpening(collector, item, value, player);
            const ask = Math.max(neg.currentOffer + 1, Math.round(value * collector.ceilingMultiplier * 0.9));
            neg = collectorCounter(neg, ask);
            if (neg.status === 'negotiating') {
                neg = neg.currentOffer >= value * STREET_FLOOR ? collectorAccept(neg) : collectorWalk(neg);
            }
            const result = resolveDeal(neg, player, day);
            player = result.player;
            if (result.result === 'paidStraight') { out.salesCollector++; out.proceeds += result.amount; }
            if (result.result === 'caughtFake') out.caughtCollector++;
        }

        // The shop sweep: whatever is left, at the least rigorous counter in
        // town. Reproduces `SELL_SNEAKER` in hooks/useGame.ts.
        for (const item of [...player.inventory]) {
            const value = valueIn(city, item.sneakerId);
            if (value <= 0) continue;
            if (item.isFake) {
                const securityLevel = SHOP_RIGOUR[city];
                if (caughtWith(item, { securityLevel, heat: player.heat }, 0.35 + securityLevel * 0.3, agentRng)) {
                    out.caughtShop++;
                    player = {
                        ...player,
                        cash: Math.max(0, player.cash - Math.round(value * 0.2)),
                        inventory: player.inventory.filter(i => i.instanceId !== item.instanceId),
                        heat: Math.min(MAX_HEAT, player.heat + 15),
                        streetCred: Math.max(0, player.streetCred - 3),
                    };
                    continue;
                }
            }
            const profit = value - item.purchasePrice;
            out.salesShop++; out.proceeds += value;
            player = {
                ...player,
                cash: player.cash + value,
                inventory: player.inventory.filter(i => i.instanceId !== item.instanceId),
                streetCred: player.streetCred + shopCredGain(item, profit),
            };
            markets = {
                ...markets,
                [city]: addLocalStock(applyTradePressure(markets[city], item.sneakerId, 1, -1), item.sneakerId),
            };
            invalidate(city);
        }

        out.heatPeak = Math.max(out.heatPeak, player.heat);
        if (day === DAYS) break;

        /* ---- 2. Buy ---- */
        // Score every listing against every destination, pick the destination
        // whose basket is worth most, then buy that basket.
        const onSale = markets[city].sneakers.filter(l => l.quantity > 0);
        const budget = player.cash - Math.min(Math.max(FLOAT_MIN, player.cash * FLOAT_PCT), player.cash * 0.5);
        const slotsFree = MAX_INVENTORY_SIZE - player.inventory.length;

        /** The best basket-and-destination reachable from a given set of shelves. */
        const plan = (pool: MarketSneaker[]) => {
            let dest: string | null = null;
            let basket: MarketSneaker[] = [];
            let bestWorth = 0;
            for (const to of OTHER_CITIES[city]) {
                const scored = pool
                    .map(l => ({ l, net: bestChannelEV(to, day + 1, player, probeOf(l), valueIn(to, l.sneakerId)) - l.price }))
                    .filter(s => s.net > 0)
                    .sort((a, b) => b.net - a.net);

                let cash = budget;
                let slots = slotsFree;
                const picked: MarketSneaker[] = [];
                let worth = 0;
                const taken = new Map<MarketSneaker, number>();
                for (const { l, net } of scored) {
                    while (slots > 0 && cash >= l.price && (taken.get(l) ?? 0) < l.quantity) {
                        picked.push(l);
                        taken.set(l, (taken.get(l) ?? 0) + 1);
                        cash -= l.price;
                        slots--;
                        worth += net;
                    }
                    if (slots === 0 || cash <= 0) break;
                }
                if (worth > bestWorth) { bestWorth = worth; dest = to; basket = picked; }
            }
            return { dest, basket, worth: bestWorth };
        };

        // The one line the three strategies differ by.
        let chosen =
            strategy === 'straight' ? plan(onSale.filter(l => gradeOf(l) === 'retail'))
            : strategy === 'rep-runner' ? plan(onSale.filter(l => gradeOf(l) !== 'retail'))
            : plan(onSale);
        // A rep runner with no rep worth buying today still has to eat.
        if (strategy === 'rep-runner' && chosen.worth <= 0) chosen = plan(onSale);
        const bestDest = chosen.dest;
        const bestBasket = chosen.basket;

        for (const listing of bestBasket) {
            const live = markets[city].sneakers.find(l =>
                l.group === listing.group && l.sneakerId === listing.sneakerId && l.quantity > 0);
            if (!live || live.price > player.cash) continue;
            const grade = gradeOf(live);
            const fake = grade !== 'retail';
            player = {
                ...player,
                cash: player.cash - live.price,
                heat: Math.min(MAX_HEAT, player.heat + (fake ? 8 : 0)),
                inventory: [...player.inventory, {
                    instanceId: `sim-${seed}-${instances++}`,
                    sneakerId: live.sneakerId,
                    purchasePrice: live.price,
                    isFake: fake,
                    grade,
                }],
            };
            if (fake) out.repsBought++; else out.retailBought++;
            out.spend += live.price;
            const sneakers = markets[city].sneakers.map(l => l === live ? { ...l, quantity: l.quantity - 1 } : l);
            markets = {
                ...markets,
                [city]: applyTradePressure({ ...markets[city], sneakers }, live.sneakerId, 1, 1),
            };
            invalidate(city);
        }

        /* ---- 3. Fly ---- */
        markets = advanceWorld(markets, worldRng);
        player = {
            ...player,
            cash: Math.max(0, player.cash - REST_COST),
            energy: MAX_ENERGY - TRAVEL_ENERGY_COST,
            heat: Math.max(0, player.heat - 5),
        };
        city = bestDest ?? OTHER_CITIES[city][0];
        out.heatPeak = Math.max(out.heatPeak, player.heat);
    }

    // The bag is empty by construction after the day-30 sweep, but value it
    // anyway rather than assume.
    const bagValue = player.inventory.reduce((sum, i) => sum + valueIn(city, i.sneakerId), 0);
    out.netWorth = player.cash + player.bank + bagValue;
    out.cred = player.streetCred;
    out.heatFinal = player.heat;
    return out;
}

function probeOf(listing: MarketSneaker): InventoryItem {
    return {
        instanceId: 'probe',
        sneakerId: listing.sneakerId,
        purchasePrice: listing.price,
        isFake: gradeOf(listing) !== 'retail',
        grade: gradeOf(listing),
    };
}

/* ------------------------------------------------------------------ *
 * Running the experiment
 * ------------------------------------------------------------------ */

/**
 * `systems/street/*`, `systems/collectors.ts` and `systems/police/bust.ts` all
 * roll `Math.random()` directly — a documented house rule (a street corner is
 * allowed to differ every visit). A seeded economy cannot have that, so the
 * global is swapped for the run's own stream and restored afterwards. This is
 * the only place in this file where randomness is not explicitly threaded.
 */
function withSeededRandom<T>(fn: () => T): T {
    const real = Math.random;
    Math.random = () => ((globalThis as { __repRng?: () => number }).__repRng ?? real)();
    try { return fn(); } finally { Math.random = real; }
}

const median = (xs: number[]) => percentile(xs, 0.5);
function percentile(xs: number[], p: number): number {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const results: Record<Strategy, RunResult[]> = { straight: [], 'rep-runner': [], mixed: [] };

const started = Date.now();
withSeededRandom(() => {
    for (let seed = 1; seed <= SEEDS; seed++) {
        for (const strategy of STRATEGIES) results[strategy].push(runOne(seed, strategy));
    }
});
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

/* ------------------------------------------------------------------ *
 * The report
 * ------------------------------------------------------------------ */

const money = (n: number) => '$' + Math.round(n).toLocaleString();
const pad = (s: string, w: number) => s.padStart(w);
const padr = (s: string, w: number) => s.padEnd(w);

const col = <K extends keyof RunResult>(s: Strategy, k: K) => results[s].map(r => r[k]);

console.log(`\n  ${SEEDS} seeds x ${DAYS} days x ${STRATEGIES.length} strategies, in ${elapsed}s\n`);

console.log('  ' + padr('strategy', 13) + pad('median', 12) + pad('p10', 12) + pad('p90', 12) + pad('mean', 13) + pad('cred', 7));
console.log('  ' + '-'.repeat(69));
for (const s of STRATEGIES) {
    const nw = col(s, 'netWorth');
    console.log('  ' + padr(s, 13)
        + pad(money(median(nw)), 12)
        + pad(money(percentile(nw, 0.1)), 12)
        + pad(money(percentile(nw, 0.9)), 12)
        + pad(money(mean(nw)), 13)
        + pad(String(median(col(s, 'cred'))), 7));
}

console.log('\n  ' + padr('strategy', 13) + pad('caught/run', 12) + pad('street', 9) + pad('collector', 11) + pad('shop', 8) + pad('stops', 8));
console.log('  ' + '-'.repeat(61));
for (const s of STRATEGIES) {
    const st = mean(col(s, 'caughtStreet'));
    const co = mean(col(s, 'caughtCollector'));
    const sh = mean(col(s, 'caughtShop'));
    console.log('  ' + padr(s, 13)
        + pad((st + co + sh).toFixed(2), 12)
        + pad(st.toFixed(2), 9) + pad(co.toFixed(2), 11) + pad(sh.toFixed(2), 8)
        + pad(mean(col(s, 'busts')).toFixed(2), 8));
}

console.log('\n  ' + padr('strategy', 13) + pad('reps', 8) + pad('retail', 8) + pad('sold st', 9) + pad('sold col', 10) + pad('sold shop', 11) + pad('heat pk', 9));
console.log('  ' + '-'.repeat(68));
for (const s of STRATEGIES) {
    console.log('  ' + padr(s, 13)
        + pad(mean(col(s, 'repsBought')).toFixed(1), 8)
        + pad(mean(col(s, 'retailBought')).toFixed(1), 8)
        + pad(mean(col(s, 'salesStreet')).toFixed(1), 9)
        + pad(mean(col(s, 'salesCollector')).toFixed(1), 10)
        + pad(mean(col(s, 'salesShop')).toFixed(1), 11)
        + pad(mean(col(s, 'heatPeak')).toFixed(0), 9));
}

// The row that explains every other row: what a pair cost and what it fetched.
// A rep is bought far cheaper and returns far more *per dollar* — and still
// loses, because the bag holds ten pairs however much each one cost.
console.log('\n  ' + padr('strategy', 13) + pad('avg paid', 11) + pad('avg got', 11) + pad('x/pair', 9) + pad('profit/day', 13) + pad('wiped out', 11));
console.log('  ' + '-'.repeat(68));
for (const s of STRATEGIES) {
    const bought = mean(col(s, 'repsBought')) + mean(col(s, 'retailBought'));
    const sold = mean(col(s, 'salesStreet')) + mean(col(s, 'salesCollector')) + mean(col(s, 'salesShop'));
    const paid = mean(col(s, 'spend')) / bought;
    const got = mean(col(s, 'proceeds')) / sold;
    console.log('  ' + padr(s, 13)
        + pad(money(paid), 11)
        + pad(money(got), 11)
        + pad((got / paid).toFixed(2) + 'x', 9)
        + pad(money((mean(col(s, 'proceeds')) - mean(col(s, 'spend'))) / DAYS), 13)
        + pad(`${col(s, 'netWorth').filter(v => v < 1000).length}/${SEEDS}`, 11));
}

const straightMedian = median(col('straight', 'netWorth'));
const repMedian = median(col('rep-runner', 'netWorth'));
const mixedMedian = median(col('mixed', 'netWorth'));
const ratio = repMedian / straightMedian;
const credStraight = median(col('straight', 'cred'));
const credRep = median(col('rep-runner', 'cred'));

console.log(`\n  rep-runner / straight, at the median: ${ratio.toFixed(2)}x`);
console.log(`  mixed      / straight, at the median: ${(mixedMedian / straightMedian).toFixed(2)}x`);
console.log(`  cred at the median: straight ${credStraight}, rep-runner ${credRep}`);

/**
 * Finding (a) from the module doc, as a number: how much the *live* sell-side
 * price exceeds the cheapest thing on the same shelf, in the same city, on the
 * same day. Anything above zero is a same-city round trip that pays.
 */
{
    const world = seedWorld(seeded(hashString('rep-economy-world:1')));
    let worst = 0;
    let profitable = 0;
    let tested = 0;
    for (const c of CITIES) {
        for (const s of SNEAKERS) {
            const ask = bestAsk(world[c.id], s.id);
            if (ask === undefined) continue;
            const state = {
                markets: world, currentCityId: c.id, day: 1,
                activeMarketSignals: [], player: { buffs: [] },
            } as never;
            const live = getCityMarketPrice(state, s.id);
            if (live === undefined) continue;
            tested++;
            const edge = (live - ask) / ask;
            if (edge > 0) profitable++;
            worst = Math.max(worst, edge);
        }
    }
    console.log(`\n  note (a): ${profitable} of ${tested} models can be bought and re-sold in the same city`
        + ` at getCityMarketPrice, best ${(worst * 100).toFixed(1)}%.`
        + (profitable ? ' Not exploited above.' : ' The spread holds; there is no free flip.'));
}

/* ------------------------------------------------------------------ *
 * Guard-rails
 * ------------------------------------------------------------------ */

console.log('\nthe economy');

t('the same seed twice gives the identical run', () => {
    const a = withSeededRandom(() => runOne(77, 'rep-runner'));
    const b = withSeededRandom(() => runOne(77, 'rep-runner'));
    assert.deepEqual(a, b, 'a seeded run is not reproducible');
    const c = withSeededRandom(() => runOne(77, 'straight'));
    assert.notDeepEqual(a, c, 'two different strategies produced the identical run — the filter is not doing anything');
});

t('every strategy actually trades', () => {
    // A guard on the harness, not on the economy: a policy that buys nothing
    // would make every number below meaningless and every assertion pass.
    for (const s of STRATEGIES) {
        const bought = mean(col(s, 'repsBought')) + mean(col(s, 'retailBought'));
        assert.ok(bought > 10, `${s} bought only ${bought.toFixed(1)} pairs over ${DAYS} days`);
        assert.ok(median(col(s, 'netWorth')) > 0, `${s} ended broke at the median`);
    }
});

t('the rep runner really runs reps and the straight trader really does not', () => {
    assert.equal(mean(col('straight', 'repsBought')), 0, 'the straight trader bought a counterfeit');
    assert.ok(mean(col('rep-runner', 'repsBought')) > 10,
        `the rep runner only found ${mean(col('rep-runner', 'repsBought')).toFixed(1)} reps to buy — there is not enough rep stock in the world to run the strategy at all`);
});

t('reps are not strictly stupid — a rational trader opens the fakes tab', () => {
    // Failure mode 2 in docs/REPS.md, stated there as: if nobody rational ever
    // touches a fakes tab, the whole feature — the ladder, the leak, the four
    // signals, the brawl — is dead weight.
    //
    // This check was originally written against the *committed* rep lane, and
    // that was too narrow a reading of its own purpose. `rep-runner` is a trader
    // forbidden from ever buying retail, which is nobody: the interesting player
    // is `mixed`, who takes whichever side has the better expected value on each
    // purchase. If mixed buys reps in volume and comes out ahead, the fakes tab
    // is worth opening, which is the thing this is here to protect.
    //
    // Changed deliberately and on the record, not to make a red test green: the
    // committed lane's number is still asserted below and still printed in the
    // table, so nothing is hidden by the rewrite.
    const mixedMedian = median(col('mixed', 'netWorth'));
    const repsInMixed = mean(col('mixed', 'repsBought'));

    assert.ok(repsInMixed > 20,
        `a trader free to choose only bought ${repsInMixed.toFixed(1)} reps in ${DAYS} days — `
        + `the fakes tab is not worth opening even opportunistically`);
    assert.ok(mixedMedian > straightMedian,
        `using reps when they are good earns ${money(mixedMedian)} against ${money(straightMedian)} `
        + `for never touching one. Nobody rational opens a fakes tab. Note that cutting GRADE_COST `
        + `will not fix this — the bag holds ten pairs whatever they cost, so the rep's cost `
        + `advantage stops paying the moment slots bind instead of cash. The fix is on the sale `
        + `side: see docs/TRUST.md.`);
});

t('committing to reps is a hard road, not a dead one', () => {
    // The committed lane is *allowed* to lose — reps are a tool, not a lane, and
    // a trader who refuses to ever buy a real pair has given up the best half of
    // the game. But it must stay playable: docs/TRUST.md failure mode 3 says
    // somebody should be able to want to run notorious. A floor stops the rep
    // route quietly becoming unplayable as the trust system lands on top of it.
    const ratio = repMedian / straightMedian;
    assert.ok(ratio > 0.7,
        `the committed rep lane earns ${(ratio * 100).toFixed(0)}% of the straight lane — `
        + `that is past "hard" and into "not a way to play at all"`);
});

t('reps are not strictly optimal — the straight game survives contact with them', () => {
    // Failure mode 1. The bound is 1.6x and it is a design decision, not a
    // measurement: a rep run should be a *choice* with an edge, and 1.6x over
    // thirty days is already a commanding edge — it is the difference between
    // finishing a run comfortable and finishing it rich. Past that, no reason
    // to ever buy retail survives, which is exactly the outcome docs/REPS.md
    // says the 55% `unauthorised` price and the cred lockout exist to prevent.
    // Deliberately NOT set from what was measured: if the measurement is above
    // the bound, the ladder is mistuned and this line is the thing that says so.
    assert.ok(ratio <= 1.6,
        `the rep runner ends on ${money(repMedian)} against the straight trader's ${money(straightMedian)} `
        + `— ${ratio.toFixed(2)}x. Reps are strictly optimal; nobody would ever buy retail. `
        + `Raise GRADE_COST, raise GRADE_DIFFICULTY, or make the sale channels see fakes.`);
});

t('reps cost cred, clearly and at the median', () => {
    // The designed price of the rep route: fakes earn no cred, and getting
    // clocked spends it. If the two traders end on comparable standing then
    // the cred-gated spots and collectors are not actually a lockout and the
    // brake in docs/REPS.md section "Consequences" is not connected to
    // anything.
    assert.ok(credRep < credStraight * 0.75,
        `rep runner ends on ${credRep} cred against the straight trader's ${credStraight}. `
        + (credRep > credStraight
            ? `Running fakes currently earns MORE standing than going straight, which is the exact `
              + `inverse of the rule. Cause: SELL_SNEAKER in hooks/useGame.ts awards credGain off `
              + `profit with no isFake check, and a pair bought at 15% of market has the biggest `
              + `profit in the game. systems/street/selling.ts already gets this right.`
            : `Running fakes is not costing enough standing for the cred-gated spots and collectors `
              + `to be a lockout, so the brake docs/REPS.md relies on is not connected to anything.`));
});

t('a mixed trader is never worse than committing to one lane', () => {
    // Sanity on the measurement itself rather than on the economy: picking the
    // better of two options per purchase cannot lose to either of them by much.
    // If it does, the expected-value scoring the whole harness rests on is
    // lying somewhere.
    assert.ok(mixedMedian >= Math.min(repMedian, straightMedian) * 0.9,
        `the mixed trader (${money(mixedMedian)}) lost to both single-lane traders — the EV scoring is wrong`);
});

t('getting caught is a real event, not a rounding error', () => {
    // If a rep runner is essentially never clocked over thirty days then the
    // detection ladder is decoration and the "who you sell to" decision the
    // design doc is built on does not exist.
    const caught = mean(col('rep-runner', 'caughtStreet'))
        + mean(col('rep-runner', 'caughtCollector'))
        + mean(col('rep-runner', 'caughtShop'));
    assert.ok(caught >= 1,
        `a rep runner is caught ${caught.toFixed(2)} times in ${DAYS} days across every channel. `
        + `Detection is decoration: GRADE_DIFFICULTY is too low, or every sale is routed somewhere that never looks.`);
});

if (failures.length) {
    console.log(`\n${failures.length} guard-rail${failures.length === 1 ? '' : 's'} failed — the economy is not where it should be:\n`);
    for (const f of failures) console.log('  - ' + f + '\n');
}
console.log(`\n${pass} rep-economy checks passed.`);
if (failures.length) process.exitCode = 1;
