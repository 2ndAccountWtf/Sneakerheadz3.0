import { useMemo } from 'react';
import { SNEAKERS } from '../data/sneakers';
import type { PriceHistoryData } from '../types';

export function useSneakerHistory(sneakerId: string | null, days: number = 60): PriceHistoryData[] {
    return useMemo(() => {
        if (!sneakerId) return [];

        const sneaker = SNEAKERS.find(s => s.id === sneakerId);
        if (!sneaker) return [];

        const history: PriceHistoryData[] = [];
        let lastClose = sneaker.basePrice * (1 + (Math.random() - 0.5) * sneaker.volatility);

        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - i));

            const open = lastClose;
            
            const volatilitySwing = sneaker.volatility * open * 1.5;
            const close = open + (Math.random() - 0.5) * volatilitySwing;
            
            const highWick = Math.random() * volatilitySwing * 0.5;
            const lowWick = Math.random() * volatilitySwing * 0.5;

            const high = Math.max(open, close) + highWick;
            const low = Math.min(open, close) - lowWick;

            const volume = Math.floor(Math.random() * 5000) + 500;

            history.push({
                date,
                open: Math.round(open),
                high: Math.round(high),
                low: Math.round(low),
                close: Math.round(close),
                volume,
            });

            lastClose = close;
        }

        return history;
    }, [sneakerId, days]);
}
