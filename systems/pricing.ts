/**
 * Central pricing rules. Previously each screen did its own arithmetic, which
 * is why buffs, blessings and damage tags had no effect on what the player
 * actually paid or received.
 */
import type { Player, InventoryItem, Sneaker, GameState } from '../types';
import type { MarketSignal } from '../types/news';
import { SNEAKERS } from '../data/sneakers';
import { buffMultiplier } from './outcomes/outcomeEngine';
import { localValue, scarcityFor, referenceAsk } from './market/simulate';

/**
 * How far under the posted shelf price the best available bid sits. The spread
 * a shop lives on, and the reason you cannot trade a pair back and forth for
 * free.
 */
const BID_ASK = 0.9;

/** Does this signal apply to this sneaker? */
export function signalMatches(signal: MarketSignal, sneaker: Sneaker): boolean {
    return signal.targets.some(t =>
        (t.kind === 'global') ||
        (t.kind === 'model' && t.value === sneaker.id) ||
        (t.kind === 'rarity' && t.value === sneaker.rarity),
    );
}

export function activeSignalsFor(sneaker: Sneaker, signals: MarketSignal[], day: number): MarketSignal[] {
    return signals.filter(s => s.expiresOnDay > day && signalMatches(s, sneaker));
}

/** Market price after news/scenario signals and any volatility damping. */
export function applySignals(basePrice: number, sneaker: Sneaker, signals: MarketSignal[], day: number, player?: Player): number {
    const relevant = activeSignalsFor(sneaker, signals, day);
    if (!relevant.length) return basePrice;

    // A volatility damper pulls every multiplier back toward 1.0 rather than
    // blocking signals outright, so "calm markets" reads as calm, not frozen.
    const damp = player ? buffMultiplier(player, 'volatilityDamp') : 1;
    let price = basePrice;
    for (const s of relevant) {
        const effective = 1 + (s.magnitude - 1) * damp;
        price *= effective;
    }
    return price;
}

/** What the player pays at the till, including store-discount buffs. */
export function getBuyPrice(listedPrice: number, player: Player): number {
    return Math.max(1, Math.round(listedPrice * buffMultiplier(player, 'storeDiscount')));
}

/**
 * Street cred for moving a pair over a shop counter.
 *
 * Exported rather than inlined in the reducer because it has already been got
 * wrong once by being written twice: the rule lived as a literal inside
 * `SELL_SNEAKER` with no `isFake` check, while `systems/street/selling.ts`
 * correctly paid nothing for a fake. Since a pair bought at 15% of market
 * carries the fattest profit in the game, that made running reps the *fastest*
 * way to build a name — the exact inverse of the intended rule. One definition,
 * so the reducer and anything measuring it cannot drift apart again.
 *
 * Passing off a fake makes money and earns you nothing. That is the bargain,
 * and it is what keeps the rep route locked out of everything cred gates.
 */
export function shopCredGain(item: Pick<InventoryItem, 'isFake'>, profit: number): number {
    if (item.isFake) return 0;
    return profit > 500 ? 3 : profit > 150 ? 1 : 0;
}

/** What the player is handed when selling one specific pair. */
export function getSellPrice(marketPrice: number, item: InventoryItem, player: Player): number {
    let price = marketPrice * (item.valueMultiplier ?? 1);
    if (item.condition?.includes('scuffed')) price *= 0.9;
    if (item.condition?.includes('water-damage')) price *= 0.75;
    price *= buffMultiplier(player, 'resaleBonus');
    return Math.max(1, Math.round(price));
}

/**
 * What the city will pay you for a model today — the bid, not the ask.
 *
 * This used to return `max(posted listing prices)`: the most expensive shelf in
 * town, with no scarcity, no spread, no cap, and sold-out listings still
 * counting. Since the per-tab spread is ±6%, that paid *more* than the cheapest
 * pair of the same shoe on the same day in the same city — so 19% of
 * city/model pairs could be bought in one aisle and sold back in the next for
 * up to +27%, no travel and no risk. `tests/market.test.mts` asserts that round
 * trip is impossible, and it passed the whole time, because it checks a formula
 * it defines locally rather than the function the game calls.
 *
 * The right formula was already written down here — `BID_ASK`, `localValue`,
 * `scarcityFor` and `referenceAsk` were all imported and never used. This is
 * that formula, finally wired:
 *
 *   - `localValue` is what the city thinks the model is worth, not what one
 *     shop is asking for it.
 *   - scarcity pays a premium where the shelves are bare, which is the whole
 *     reason to carry stock somewhere.
 *   - `BID_ASK` is the spread a shop lives on.
 *   - and the cap against the cheapest posted ask is what makes the round trip
 *     lose money: you can never be paid more than the shop down the road is
 *     charging, less its cut.
 *
 * Signals are applied to both sides before the cap, so a news spike lifts the
 * bid and the ask together and cannot re-open the gap.
 */
export function getCityMarketPrice(state: GameState, sneakerId: string): number | undefined {
    const market = state.markets[state.currentCityId];
    if (!market) return undefined;
    const sneaker = SNEAKERS.find(s => s.id === sneakerId);
    if (!sneaker) return undefined;

    const value = localValue(market, sneakerId);
    if (value === undefined) return undefined;

    const signalled = (n: number) =>
        applySignals(n, sneaker, state.activeMarketSignals, state.day, state.player);

    let bid = signalled(value) * scarcityFor(market, sneakerId).multiplier * BID_ASK;

    const posted = referenceAsk(market, sneakerId);
    if (posted !== undefined) bid = Math.min(bid, signalled(posted) * BID_ASK);

    return Math.max(1, Math.round(bid));
}

/** Total mark-to-market value of the player's bag. */
export function getBagValue(state: GameState): number {
    return state.player.inventory.reduce((total, item) => {
        const market = getCityMarketPrice(state, item.sneakerId);
        if (market === undefined) {
            const base = SNEAKERS.find(s => s.id === item.sneakerId)?.basePrice ?? 0;
            return total + getSellPrice(base, item, state.player);
        }
        return total + getSellPrice(market, item, state.player);
    }, 0);
}
