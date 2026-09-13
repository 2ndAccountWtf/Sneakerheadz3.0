import React, { useState, useMemo } from 'react';
import { useGame } from '../hooks/useGame';
import { CITIES } from '../data/cities';
import { SNEAKERS } from '../data/sneakers';
import { STORES_BY_CITY } from '../data/stores';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { generateRumorsForCity, RumorWithContext } from '../systems/rumorEngine';
import { TRAVEL_ENERGY_COST, TOTAL_DAYS } from '../constants';
import { applySignals } from '../systems/pricing';
import { getRunClock } from '../data/ranks';
import Img from '../components/Img';

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

        // Plenty of rumour templates are generic — they are eligible in every
        // city — so two cards independently picking "the Intel Drop, else the
        // first one" landed on the same sentence about a quarter of the time.
        // On the one screen whose entire job is telling six cities apart, two
        // of them quoting the same line word for word reads as a bug. So each
        // card takes the best line nobody else has already used, and only
        // falls back to a repeat if this city genuinely has nothing else.
        const spoken = new Set<string>();
        const headlineRumor = (rumors: RumorWithContext[]): RumorWithContext | undefined => {
            const ranked = [
                ...rumors.filter(r => r.type === 'Intel Drop'),
                ...rumors.filter(r => r.type !== 'Intel Drop'),
            ];
            const pick = ranked.find(r => !spoken.has(r.text)) ?? ranked[0];
            if (pick) spoken.add(pick.text);
            return pick;
        };

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
                rumor: headlineRumor(rumors),
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
    const clock = getRunClock(day, TOTAL_DAYS);
    // A flight is the only thing that advances the calendar, so on the last day
    // the Departures board is where the run actually ends.
    const isLastFlight = clock.daysLeft <= 0;

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Departures <span className="accent">Board</span></>}
                subtitle={`One flight = one day = ${TRAVEL_ENERGY_COST} energy`}
                back={Screen.Dashboard}
            />

            {/* FARE — the price of a flight, spelled out. With a hard deadline the
                day is the expensive half, and it used to be a line of subtitle. */}
            <section className="panel p-3 mb-4 grid grid-cols-3 gap-3">
                <div className="min-w-0">
                    <div className="label">Costs</div>
                    <div className="numeric text-lg sm:text-xl leading-none mt-0.5 text-[var(--warn)]">1 day</div>
                    <div className="text-[10px] font-mono text-[var(--ink-faint)] mt-1 leading-tight">
                        Day {day} → {day + 1}
                    </div>
                </div>
                <div className="min-w-0">
                    <div className="label">Energy</div>
                    <div
                        className="numeric text-lg sm:text-xl leading-none mt-0.5"
                        style={{ color: lowEnergy ? 'var(--bad)' : 'var(--warn)' }}
                    >
                        −{TRAVEL_ENERGY_COST}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--ink-faint)] mt-1 leading-tight">
                        You have {Math.round(player.energy)}
                    </div>
                </div>
                <div className="min-w-0">
                    <div className="label">Deadline</div>
                    <div className="numeric text-lg sm:text-xl leading-none mt-0.5" style={{ color: clock.color }}>
                        {isLastFlight ? 'LAST' : clock.daysLeft}
                    </div>
                    <div className="text-[10px] font-mono text-[var(--ink-faint)] mt-1 leading-tight">
                        of {TOTAL_DAYS} days
                    </div>
                </div>
            </section>

            {isLastFlight ? (
                <div className="panel p-3 mb-4 flex items-start gap-2 text-sm" style={{ borderColor: 'var(--bad)' }}>
                    <span className="flex-shrink-0">🛬</span>
                    <span className="text-[var(--bad)] leading-snug">
                        Day {TOTAL_DAYS} of {TOTAL_DAYS}. Board this flight and the run is over when it lands — sell what you want counted as cash first.
                    </span>
                </div>
            ) : clock.urgent && (
                <div className="panel p-3 mb-4 flex items-start gap-2 text-sm" style={{ borderColor: clock.color }}>
                    <span className="flex-shrink-0">⏳</span>
                    <span className="leading-snug" style={{ color: clock.color }}>
                        {clock.daysLeft} {clock.daysLeft === 1 ? 'flight' : 'flights'} and the month is gone. Each one is a day you are not selling in.
                    </span>
                </div>
            )}

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
                                <Img fallback="🏙" src={city.image} alt={city.name} className="w-full h-full object-cover opacity-40 grayscale" />
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
                                    className={`btn w-full mt-auto ${isLastFlight ? 'btn-danger' : 'btn-primary'}`}
                                    disabled={isCurrent || !!departingTo}
                                    onClick={() => handleTravel(city.id)}
                                >
                                    {isCurrent
                                        ? 'Current City'
                                        : isLastFlight
                                            ? 'Fly · ends the run'
                                            : `Fly · 1 day · ⚡${TRAVEL_ENERGY_COST}`}
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
