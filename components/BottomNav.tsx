import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';

interface NavItem {
    label: string;
    icon: string;
    screen: Screen;
    /** Screens that should keep this tab lit while you're deeper in its flow. */
    also?: Screen[];
}

const ITEMS: NavItem[] = [
    { label: 'City', icon: '🏙', screen: Screen.Dashboard },
    { label: 'Shops', icon: '👟', screen: Screen.CityStores, also: [Screen.ShoeStore, Screen.MarketAnalysis] },
    { label: 'Bag', icon: '📦', screen: Screen.Inventory, also: [Screen.Storage] },
    { label: 'Arcade', icon: '🕹', screen: Screen.Arcade },
    { label: 'Feed', icon: '📡', screen: Screen.Social, also: [Screen.CityFeed] },
    { label: 'You', icon: '👤', screen: Screen.Stats, also: [Screen.Quests] },
];

/**
 * Six destinations instead of three. Travel and the AM/PM live on the city
 * screen because they're place-bound; everything else is always reachable.
 */
const BottomNav: React.FC = () => {
    const { gameState, changeScreen } = useGame();
    const { currentScreen, quests } = gameState;

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg)]/95 backdrop-blur-xl border-t border-[var(--line)]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
            <div className="max-w-2xl mx-auto flex items-stretch h-[var(--nav-h)]">
                {ITEMS.map(item => {
                    const isActive = currentScreen === item.screen || item.also?.includes(currentScreen);
                    const badge = item.screen === Screen.Stats && quests.length > 0 ? quests.length : 0;

                    return (
                        <button
                            key={item.screen}
                            onClick={() => changeScreen(item.screen)}
                            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 no-tap-highlight transition-colors"
                        >
                            <span
                                className={`absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
                                style={{ background: 'var(--accent)' }}
                            />
                            <span className={`text-lg leading-none transition-transform ${isActive ? 'scale-110' : 'opacity-55'}`}>
                                {item.icon}
                            </span>
                            <span
                                className={`font-mono text-[9px] uppercase tracking-[0.12em] ${isActive ? 'text-[var(--accent)]' : 'text-[var(--ink-faint)]'}`}
                            >
                                {item.label}
                            </span>
                            {badge > 0 && (
                                <span className="absolute top-1.5 right-1/2 translate-x-4 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--accent-2)] text-black text-[9px] font-bold flex items-center justify-center">
                                    {badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
