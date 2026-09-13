/**
 * Central pricing rules. Previously each screen did its own arithmetic, which
 * is why buffs, blessings and damage tags had no effect on what the player
 * actually paid or received.
 */
import type { Player, InventoryItem, Sneaker, GameState } from '../types';
import type { MarketSignal } from '../types/news';
import { SNEAKERS } from '../data/sneakers';
import { buffMultiplier } from './outcomes/outcomeEngine';
import { localValue } from './market/simulate';

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

/** What the player is handed when selling one specific pair. */
export function getSellPrice(marketPrice: number, item: InventoryItem, player: Player): number {
    let price = marketPrice * (item.valueMultiplier ?? 1);
    if (item.condition?.includes('scuffed')) price *= 0.9;
    if (item.condition?.includes('water-damage')) price *= 0.75;
    price *= buffMultiplier(player, 'resaleBonus');
    return Math.max(1, Math.round(price));
}

/** Best current market price for a model in the player's city, signals applied. */
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
