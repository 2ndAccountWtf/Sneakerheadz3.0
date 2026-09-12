import React, { useEffect } from 'react';
import { useGame } from '../../hooks/useGame';
import { NewsItem } from '../../types/news';

const SEVERITY: Record<NonNullable<NewsItem['severity']>, { color: string; label: string }> = {
    low: { color: 'var(--line-bright)', label: 'Filler' },
    med: { color: 'var(--warn)', label: 'Notable' },
    high: { color: 'var(--bad)', label: 'Breaking' },
    wtf: { color: 'var(--accent-2)', label: 'What' },
};

/**
 * Newsflash toast. Sits above the HUD, below modals, and out of the way of the
 * bottom nav on phones.
 */
export const NewsModal: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const { activeNewsItem } = gameState;

    useEffect(() => {
        if (!activeNewsItem) return;
        const timer = setTimeout(() => dispatch({ type: 'HIDE_NEWS_ITEM' }), 7000);
        return () => clearTimeout(timer);
    }, [activeNewsItem, dispatch]);

    if (!activeNewsItem) return null;

    const sev = SEVERITY[activeNewsItem.severity ?? 'low'];

    return (
        <div
            className="fixed left-3 right-3 sm:left-auto sm:right-4 top-[calc(var(--header-h)+12px)] sm:w-80 z-[60] panel p-3 animate-slide-in"
            style={{ borderColor: sev.color }}
            role="status"
        >
            <div className="flex items-start gap-2.5">
                <span className="text-xl leading-none flex-shrink-0">{activeNewsItem.icon ?? '🔔'}</span>
                <div className="min-w-0 flex-1">
                    <div className="label mb-0.5" style={{ color: sev.color }}>{sev.label}</div>
                    <h3 className="text-sm font-semibold text-white leading-snug">{activeNewsItem.title}</h3>
                    <p className="text-xs text-[var(--ink-dim)] mt-1 leading-snug">{activeNewsItem.body}</p>
                </div>
                <button
                    onClick={() => dispatch({ type: 'HIDE_NEWS_ITEM' })}
                    className="label hover:text-white flex-shrink-0"
                    aria-label="Dismiss"
                >✕</button>
            </div>
        </div>
    );
};

export default NewsModal;
