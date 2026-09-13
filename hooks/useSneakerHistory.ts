import { useMemo } from 'react';
import { SNEAKERS } from '../data/sneakers';
import type { PriceHistoryData } from '../types';
import { useGame } from './useGame';

/**
 * The price chart's data, from the actual market.
 *
 * This used to generate sixty days of random candles on every mount. It looked
 * like a trading terminal and meant nothing: the numbers had no relationship to
 * the prices in the shop two screens away, they were different every time you
 * opened the panel, and no decision could be made from them. Reading a chart
 * that lies is worse than having no chart, because the player trusts it.
 *
 * Now it reads `market.history` — the real daily closes the simulation records
 * for this city, including the invented pre-run past that gives day one a shape
 * (see `backfillHistory` in systems/market/simulate.ts). Open, high and low are
 * derived from the neighbouring closes and the model's own volatility, because
 * the simulation has one price per day rather than an intraday tape; that is
 * presentation, not invention, and the close is always the real number.
 */
export function useSneakerHistory(sneakerId: string | null, days = 60): PriceHistoryData[] {
    const { gameState } = useGame();
    const { markets, currentCityId, day } = gameState;

    return useMemo(() => {
        if (!sneakerId) return [];

        const sneaker = SNEAKERS.find(s => s.id === sneakerId);
        if (!sneaker) return [];

        const series = markets[currentCityId]?.history?.[sneakerId] ?? [];
        if (!series.length) return [];

        const window = series.slice(-days);
        // Day indices counted back from today so the last candle is today.
        const firstDay = day - (window.length - 1);

        return window.map((close, i) => {
            const open = i === 0 ? close : window[i - 1];
            // A plausible intraday range, scaled to the day's actual move and
            // the model's volatility. Deterministic, so the chart does not
            // twitch when the screen re-renders.
            const move = Math.abs(close - open);
            const wick = Math.max(1, move * 0.6 + close * 0.01 * Math.min(2, sneaker.volatility));
            const jitter = pseudo(`${sneakerId}:${firstDay + i}`);

            return {
                // The chart labels axes with dates; the game counts days, so a
                // day number is mapped onto a date only for display.
                date: dayToDate(firstDay + i),
                open: Math.round(open),
                high: Math.round(Math.max(open, close) + wick * jitter),
                low: Math.max(1, Math.round(Math.min(open, close) - wick * (1 - jitter))),
                close: Math.round(close),
                // Volume stands in for how much the price moved, which is the
                // only thing the simulation actually knows about interest.
                volume: Math.round(400 + move * 40),
            };
        });
    }, [sneakerId, days, markets, currentCityId, day]);
}

/** Stable 0..1 from a string, so the wicks never change between renders. */
function pseudo(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 1000) / 1000;
}

/** Day 1 of the run is "today"; earlier days walk backwards from it. */
function dayToDate(gameDay: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + (gameDay - 1));
    return d;
}
