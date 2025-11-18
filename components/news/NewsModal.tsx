import React, { useEffect } from 'react';
import { useGame } from '../../hooks/useGame';
import { NewsItem } from '../../types/news';

export const NewsModal: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const { activeNewsItem } = gameState;

    useEffect(() => {
        if (activeNewsItem) {
            const timer = setTimeout(() => {
                dispatch({ type: 'HIDE_NEWS_ITEM' });
            }, 7000); // Auto-dismiss after 7 seconds
            return () => clearTimeout(timer);
        }
    }, [activeNewsItem, dispatch]);

    if (!activeNewsItem) {
        return null;
    }

    const severityStyles: Record<NonNullable<NewsItem['severity']>, string> = {
        low: 'border-gray-500',
        med: 'border-yellow-500 animate-pulse',
        high: 'border-red-500 animate-pulse',
        wtf: 'border-fuchsia-500 animate-pulse',
    };
    const severityClass = severityStyles[activeNewsItem.severity || 'low'];

    const css = `
        @keyframes slide-in-from-right {
            from { transform: translateX(110%); }
            to { transform: translateX(0); }
        }
        .animate-slide-in { 
            animation: slide-in-from-right 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; 
        }
    `;

    return (
        <div className={`fixed top-5 right-5 w-full max-w-sm bg-gray-900/90 border-2 ${severityClass} text-white p-4 rounded-lg shadow-2xl shadow-cyan-500/20 z-50 backdrop-blur-sm animate-slide-in`}>
            <style>{css}</style>
            <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0 mt-1">{activeNewsItem.icon || '🔔'}</div>
                <div className="flex-grow">
                    <h3 className="font-bold text-lg text-cyan-300">{activeNewsItem.title}</h3>
                    <p className="text-sm text-gray-300 mt-1">{activeNewsItem.body}</p>
                </div>
                <button
                    onClick={() => dispatch({ type: 'HIDE_NEWS_ITEM' })}
                    className="absolute top-1 right-2 text-2xl text-gray-500 hover:text-white transition-colors"
                    aria-label="Close news alert"
                >
                    &times;
                </button>
            </div>
        </div>
    );
};

export default NewsModal;
