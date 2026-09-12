import React, { useState, useMemo } from 'react';
import { useGame } from '../hooks/useGame';
import { CITIES } from '../data/cities';
import { SNEAKERS } from '../data/sneakers';
import { STORES_BY_CITY } from '../data/stores';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { generateRumorsForCity, RumorWithContext } from '../systems/rumorEngine';
import { TRAVEL_ENERGY_COST } from '../constants';
import { applySignals } from '../systems/pricing';

type Trend = 'up' | 'down' | 'flat';

const TREND_LOOK: Record<Trend, { icon: string; color: string; label: string }> = {
    up: { icon: '▲', color: 'var(--ok)', label: 'Running hot' },
    down: { icon: '▼', color: 'var(--bad)', label: 'Gone cold' },
    flat: { icon: '■', color: 'var(--warn)', label: 'Holding steady' },
};

/**
 * Departures board. Each city shows what its market is doing right now (signals
 * included), how many shops it has, and the freshest piece of intel — so the
 * choice of destination is informed rather than arbitrary.
 */
const TravelScreen: React.FC = () => {
    const { gameState, travel } = useGame();
    const { currentCityId, day, player, activeMarketSignals } = gameState;
    const [departingTo, setDepartingTo] = useState<string | null>(null);

    const cityData = useMemo(() => {
        const out: Record<string, { trend: Trend; delta: number; stores: number; volatility: number; rumor?: RumorWithContext }> = {};

        for (const city of CITIES) {
            const market = gameState.markets[city.id];
            let totalDelta = 0;
            let totalVol = 0;
            let count = 0;

            for (const listing of market?.sneakers ?? []) {
                const sneaker = SNEAKERS.find(s => s.id === listing.sneakerId);
                if (!sneaker || sneaker.basePrice <= 0 || listing.isFake) continue;
                const priced = applySignals(listing.price, sneaker, activeMarketSignals, day, player);
                totalDelta += (priced - sneaker.basePrice) / sneaker.basePrice;
                totalVol += sneaker.volatility;
                count++;
            }

            const avg = count ? totalDelta / count : 0;
            const rumors = generateRumorsForCity(city.id, day);

            out[city.id] = {
                trend: avg > 0.08 ? 'up' : avg < -0.08 ? 'down' : 'flat',
                delta: avg,
                stores: STORES_BY_CITY[city.id]?.length ?? 0,
                volatility: count ? totalVol / count : 0,
                rumor: rumors.find(r => r.type === 'Intel Drop') ?? rumors[0],
            };
        }
        return out;
    }, [gameState.markets, activeMarketSignals, day, player]);

    const handleTravel = (cityId: string) => {
        if (departingTo) return;
        setDepartingTo(cityId);
        setTimeout(() => travel(cityId), 1100);
    };

    const destination = CITIES.find(c => c.id === departingTo);
    const lowEnergy = player.energy < TRAVEL_ENERGY_COST;

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Departures <span className="accent">Board</span></>}
                subtitle={`One flight = one day = ${TRAVEL_ENERGY_COST} energy`}
                back={Screen.Dashboard}
            />

            {lowEnergy && (
                <div className="panel p-3 mb-4 flex items-center gap-2 text-sm" style={{ borderColor: 'var(--warn)' }}>
                    <span>⚠️</span>
                    <span className="text-[var(--warn)]">
                        You're running on {Math.round(player.energy)} energy. Flying now will cost you health instead. Sleep it off in your Bag.
                    </span>
                </div>
            )}

            {departingTo && (
                <div className="fixed inset-0 z-[75] bg-black/95 flex flex-col items-center justify-center">
                    <div className="absolute inset-0 scanlines opacity-40" />
                    <p className="label mb-3">Now boarding</p>
                    <h2 className="font-display text-4xl sm:text-6xl text-[var(--accent)] uppercase animate-pulse text-center px-4">
                        {destination?.name}
                    </h2>
                    <div className="meter w-48 mt-6"><i className="w-full" style={{ background: 'var(--accent)' }} /></div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {CITIES.map(city => {
                    const info = cityData[city.id];
                    const look = TREND_LOOK[info.trend];
                    const isCurrent = city.id === currentCityId;

                    return (
                        <div key={city.id} className={`panel flex flex-col ${isCurrent ? 'opacity-60' : ''}`}>
                            <div className="relative h-28 overflow-hidden">
                                <img src={city.image} alt={city.name} className="w-full h-full object-cover opacity-40 grayscale" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-panel)] to-transparent" />
                                <div className="absolute inset-0 scanlines opacity-40" />
                                <h2 className="absolute bottom-2 left-3 font-display text-lg uppercase text-white leading-none">{city.name}</h2>
                                {isCurrent && <span className="absolute top-2 right-2 chip chip-accent">You are here</span>}
                            </div>

                            <div className="p-3 flex flex-col flex-grow gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: look.color }}>
                                        <span>{look.icon}</span>{look.label}
                                    </span>
                                    <span className="numeric text-sm" style={{ color: look.color }}>
                                        {info.delta >= 0 ? '+' : ''}{(info.delta * 100).toFixed(0)}%
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    <span className="chip">👟 {info.stores} shops</span>
                                    <span className="chip">📉 vol {(info.volatility * 100).toFixed(0)}%</span>
                                </div>

                                {info.rumor && (
                                    <div className="border-l-2 pl-2.5 py-0.5" style={{ borderColor: 'var(--line-bright)' }}>
                                        <div className="label">{info.rumor.type}</div>
                                        <p className="text-xs text-[var(--ink-dim)] italic leading-snug line-clamp-2">"{info.rumor.text}"</p>
                                    </div>
                                )}

                                <button
                                    className="btn btn-primary w-full mt-auto"
                                    disabled={isCurrent || !!departingTo}
                                    onClick={() => handleTravel(city.id)}
                                >
                                    {isCurrent ? 'Current City' : `Fly — 1 Day`}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TravelScreen;
