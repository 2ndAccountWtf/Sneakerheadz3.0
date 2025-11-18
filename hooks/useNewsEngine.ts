import { useEffect } from 'react';
import { useGame } from './useGame';
import { NewsItem, MarketSignal } from '../types/news';
import { SNEAKERS } from '../data/sneakers';

// FIX: Add 'as const' to infer the narrowest possible types for the templates.
// This ensures that properties like 'severity' are typed as specific string literals
// (e.g., 'med', 'high') rather than the general 'string' type, resolving the type errors below.
const NEWS_TEMPLATES = {
    'market-surge': {
        title: (model: string) => `🔥 Sudden Surge: ${model} spiking!`,
        body: (model: string, cause: string, pct: number) => `After ${cause}, ${model} is up ${pct}% for a limited time.`,
        icon: '🔥',
        severity: 'med',
    },
    'production-surge': {
        title: (model: string) => `📦 Mass Restock: ${model} flooding shelves`,
        body: (model: string, units: string, pct: number) => `Manufacturer announced ${units} more pairs shipping. Rarity falling; prices sliding ${pct}%.`,
        icon: '📉',
        severity: 'high',
    },
    'donald-drip': {
        title: (quip: string) => `🧱 Donald Drip: "${quip}"`,
        body: (body: string) => body,
        icon: '🧱',
        severity: 'wtf',
    },
    'odd-news': {
        title: (title: string) => `🦆 ${title}`,
        body: (body: string) => body,
        icon: '🦆',
        severity: 'low',
    }
} as const;

const DRIP_QUIPS = ["People don’t know this, but I invented the drop.", "Pandas? Best ever, folks. Perfect shoe.", "We’re launching DripTower. It’s huge."];
const ODD_NEWS = [{title: "City Duck Elected Night Mayor", body: "Platform includes free slushies after 2 AM."},{title: "Local seagull opens AMPM", body: "Staff applauds."}];
const SURGE_CAUSES = ["a celebrity sighting", "a podcast mention", "a production shortage"];

export const useNewsEngine = () => {
    const { dispatch } = useGame();

    useEffect(() => {
        const tick = () => {
            // Simple probability check each tick. In a real game, this would use the more complex logic from the spec.
            if (Math.random() > 0.1) { // 10% chance per tick
                return;
            }

            const newsKinds: NewsItem['kind'][] = ['market-surge', 'production-surge', 'donald-drip', 'odd-news'];
            const kind = newsKinds[Math.floor(Math.random() * newsKinds.length)];
            
            let newsItem: NewsItem | null = null;
            let marketSignal: MarketSignal | null = null;
            
            const newsId = `news-${Date.now()}`;

            if (kind === 'market-surge') {
                const sneaker = SNEAKERS[Math.floor(Math.random() * SNEAKERS.length)];
                const cause = SURGE_CAUSES[Math.floor(Math.random() * SURGE_CAUSES.length)];
                const magnitude = 1 + (Math.random() * 0.4 + 0.1); // 10% to 50% surge
                const durationHrs = Math.floor(Math.random() * 12) + 6; // 6 to 18 hours

                const template = NEWS_TEMPLATES['market-surge'];
                newsItem = {
                    id: newsId,
                    kind: 'market-surge',
                    title: template.title(sneaker.name),
                    body: template.body(sneaker.name, cause, Math.round((magnitude - 1) * 100)),
                    icon: template.icon,
                    severity: template.severity,
                    marketSignalId: `signal-${newsId}`,
                };

                marketSignal = {
                    id: `signal-${newsId}`,
                    effect: 'surge',
                    magnitude,
                    expiresAt: Date.now() + durationHrs * 60 * 60 * 1000,
                    targets: [{ kind: 'model', value: sneaker.id }],
                    sourceNewsId: newsId,
                };
            } else if (kind === 'production-surge') {
                const sneaker = SNEAKERS[Math.floor(Math.random() * SNEAKERS.length)];
                const magnitude = 1 - (Math.random() * 0.3 + 0.1); // 10% to 40% price drop
                const durationHrs = Math.floor(Math.random() * 24) + 12; // 12 to 36 hours
                const units = ((Math.random() * 5 + 1) * 100000).toLocaleString();

                const template = NEWS_TEMPLATES['production-surge'];
                newsItem = {
                    id: newsId,
                    kind: 'production-surge',
                    title: template.title(sneaker.name),
                    body: template.body(sneaker.name, units, Math.round((1 - magnitude) * 100)),
                    icon: template.icon,
                    severity: template.severity,
                    marketSignalId: `signal-${newsId}`,
                };

                marketSignal = {
                    id: `signal-${newsId}`,
                    effect: 'collapse',
                    magnitude,
                    expiresAt: Date.now() + durationHrs * 60 * 60 * 1000,
                    targets: [{ kind: 'model', value: sneaker.id }],
                    sourceNewsId: newsId,
                };
            } else if (kind === 'donald-drip') {
                const quip = DRIP_QUIPS[Math.floor(Math.random() * DRIP_QUIPS.length)];
                const template = NEWS_TEMPLATES['donald-drip'];
                newsItem = {
                    id: newsId,
                    kind: 'donald-drip',
                    title: template.title(quip),
                    body: "He just tweeted again. The market is... confused.",
                    icon: template.icon,
                    severity: template.severity,
                };
            } else if (kind === 'odd-news') {
                 const oddity = ODD_NEWS[Math.floor(Math.random() * ODD_NEWS.length)];
                 const template = NEWS_TEMPLATES['odd-news'];
                 newsItem = {
                     id: newsId,
                     kind: 'odd-news',
                     title: template.title(oddity.title),
                     body: oddity.body,
                     icon: template.icon,
                     severity: template.severity,
                 };
            }

            if (newsItem) {
                dispatch({ type: 'SHOW_NEWS_ITEM', payload: newsItem });
                if (marketSignal) {
                    dispatch({ type: 'APPLY_MARKET_SIGNAL', payload: marketSignal });
                }
            }
        };

        const interval = setInterval(tick, 5000); // Check every 5 seconds
        return () => clearInterval(interval);
    }, [dispatch]);
};
