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
 * What a model fetches in the player's city — the highest posted shelf price.
 *
 * ## The Red October glitch, and why it is still here
 *
 * This takes `max(posted listing prices)`: the most expensive shelf in town, no
 * scarcity multiplier, no bid-ask spread, no cap against the cheapest ask, and
 * sold-out listings still count. The per-tab spread is ±6%, so this pays *more*
 * than the cheapest pair of the same shoe, on the same day, in the same city.
 * Buy in one aisle, sell back in the next, keep the difference. Measured over
 * five seeded worlds: 113 of 581 city/model pairs (19.4%) turn a profit on the
 * spot, the best at **+27.2%** — a Red October bought at $11,048 and sold back
 * at $13,217, repeatable, no travel and no risk.
 *
 * **This is deliberate. Do not "fix" it.** It was patched once, measured, and
 * then put back on purpose: it is a money glitch in a game about hustling, and
 * finding it is meant to feel like finding one. `tests/market.test.mts` pins it
 * — there are checks that *fail if the glitch disappears*, so a future tidy-up
 * of this function cannot quietly remove it.
 *
 * The honest sell-side formula is written out directly below and left unused.
 * `BID_ASK`, `localValue`, `scarcityFor` and `referenceAsk` are imported for it.
 * If the glitch is ever retired, `honestBid` is the function to swap in: local
 * value, times scarcity, times the spread, capped under the cheapest posted ask,
 * with signals applied to both sides so a news spike cannot re-open the gap.
 */
export function getCityMarketPrice(state: GameState, sneakerId: string): number | undefined {
    const market = state.markets[state.currentCityId];
    if (!market) return undefined;
    const sneaker = SNEAKERS.find(s => s.id === sneakerId);
    if (!sneaker) return undefined;

    const listings = market.sneakers.filter(s => s.sneakerId === sneakerId && !s.isFake);
    const pool = listings.length ? listings : market.sneakers.filter(s => s.sneakerId === sneakerId);
    if (!pool.length) return undefined;

    const best = Math.max(...pool.map(l => l.price));
    return Math.round(applySignals(best, sneaker, state.activeMarketSignals, state.day, state.player));
}

/**
 * The sell-side price with the spread closed — what `getCityMarketPrice` would
 * be if the Red October glitch above were ever retired.
 *
 * Kept exported and tested rather than deleted, so the alternative stays live
 * code rather than a paragraph of prose in a commit message. Swapping the two
 * is a one-line change in `getBagValue` and the sell paths.
 */
export function honestBid(state: GameState, sneakerId: string): number | undefined {
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
    // Defensive on the bag, because the hospital check calls this on the way in
    // and a crash in the reducer takes the whole game with it.
    return (state.player.inventory ?? []).reduce((total, item) => {
        const market = getCityMarketPrice(state, item.sneakerId);
        if (market === undefined) {
            const base = SNEAKERS.find(s => s.id === item.sneakerId)?.basePrice ?? 0;
            return total + getSellPrice(base, item, state.player);
        }
        return total + getSellPrice(market, item, state.player);
    }, 0);
}
