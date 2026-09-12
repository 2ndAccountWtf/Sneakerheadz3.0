import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { STORES_BY_CITY } from '../data/stores';
import { STORE_CONFIGS } from '../data/storeConfigs';
import { CITIES } from '../data/cities';

const BRAND_LOOK: Record<string, { label: string; color: string; icon: string }> = {
    neon: { label: 'Neon Outlet', color: 'var(--accent-2)', icon: '🌸' },
    arcade: { label: 'Arcade', color: 'var(--accent)', icon: '🕹' },
    cyberpunk: { label: 'Night Market', color: '#8C52FF', icon: '🌧' },
    gallery: { label: 'Gallery', color: 'var(--legend)', icon: '🖼' },
    luxury: { label: 'Luxury', color: 'var(--legend)', icon: '🥂' },
    lofi: { label: 'Lo-Fi', color: '#7bd88f', icon: '🎧' },
    retro: { label: 'Retro', color: 'var(--warn)', icon: '📻' },
    plug: { label: 'Plug', color: 'var(--ok)', icon: '🔌' },
    shady: { label: 'Illegal', color: 'var(--bad)', icon: '⚠️' },
    consignment: { label: 'Consignment', color: 'var(--accent)', icon: '📋' },
    boutique: { label: 'Boutique', color: 'var(--accent)', icon: '✨' },
    outlet: { label: 'Outlet', color: 'var(--accent)', icon: '🏷' },
    raffle: { label: 'Raffle', color: 'var(--warn)', icon: '🎟' },
};

const SECURITY_LABEL = ['No questions asked', 'Casual legit check', 'Full authentication'];

/**
 * Shop directory. Each card now previews what the store actually is — how it
 * authenticates, what it stocks, how risky it is — so choosing where to walk in
 * is a decision instead of a coin flip.
 */
const CityStoresScreen: React.FC = () => {
    const { gameState, selectStore } = useGame();
    const { currentCityId, player } = gameState;

    const storesInCity = STORES_BY_CITY[currentCityId] || [];
    const cityName = CITIES.find(c => c.id === currentCityId)?.name ?? 'this city';

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Shops in <span className="accent">{cityName}</span></>}
                subtitle={`${storesInCity.length} open · ${player.heat >= 40 ? 'your heat is high, mind the legit checks' : 'you are clean'}`}
                back={Screen.Dashboard}
            />

            {storesInCity.length === 0 ? (
                <div className="panel p-10 text-center">
                    <div className="text-4xl mb-3">🚪</div>
                    <p className="text-[var(--ink-dim)]">No notable sneaker stores here. Try another city.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {storesInCity.map(store => {
                        const config = STORE_CONFIGS[store.id];
                        const brand = BRAND_LOOK[config?.brandKey ?? 'boutique'] ?? BRAND_LOOK.boutique;
                        const security = config?.behavior.securityLevel ?? 1;
                        const tabs = config?.tabs ?? [];
                        const risky = config?.brandKey === 'shady';

                        return (
                            <button
                                key={store.id}
                                onClick={() => selectStore(store.id)}
                                className="panel text-left flex flex-col hover:border-[var(--line-bright)] transition-colors group"
                            >
                                <span className="h-[3px] w-full" style={{ background: brand.color }} />
                                <div className="p-4 flex flex-col flex-grow">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <h2 className="font-display text-sm uppercase text-white leading-tight">{store.name}</h2>
                                        <span className="chip flex-shrink-0" style={{ borderColor: brand.color, color: brand.color }}>
                                            {brand.icon} {brand.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--ink-dim)] leading-snug mb-3">{store.description}</p>

                                    <div className="flex flex-wrap gap-1.5 mt-auto">
                                        {tabs.map(t => <span key={t.id} className="chip">{t.label}</span>)}
                                        <span className={`chip ${security === 2 ? 'chip-bad' : security === 0 ? 'chip-accent' : ''}`}>
                                            🔍 {SECURITY_LABEL[security]}
                                        </span>
                                        {risky && <span className="chip chip-bad">🚔 Raid risk</span>}
                                    </div>

                                    <span className="label mt-3 group-hover:text-[var(--accent)] transition-colors">Enter →</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CityStoresScreen;
