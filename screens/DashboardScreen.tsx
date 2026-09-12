import React, { useMemo } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import { CITIES } from '../data/cities';
import { STORES_BY_CITY } from '../data/stores';
import { getCredRank, TOTAL_DAYS } from '../constants';
import { getBagValue } from '../systems/pricing';
import { generateRumorsForCity } from '../systems/rumorEngine';
import Img from '../components/Img';

const Tile: React.FC<{
    label: string;
    sublabel: string;
    icon: string;
    onClick: () => void;
    accent?: string;
    badge?: string;
}> = ({ label, sublabel, icon, onClick, accent = 'var(--accent)', badge }) => (
    <button
        onClick={onClick}
        className="group relative panel p-4 text-left overflow-hidden transition-colors hover:border-[var(--line-bright)] no-tap-highlight"
        style={{ minHeight: '112px' }}
    >
        <span
            className="absolute left-0 top-0 h-full w-[3px] transition-all group-hover:w-[5px]"
            style={{ background: accent }}
        />
        <div className="absolute -right-3 -bottom-4 text-7xl opacity-[0.06] select-none pointer-events-none">{icon}</div>
        <div className="relative flex flex-col h-full">
            <span className="text-2xl leading-none mb-2">{icon}</span>
            <span className="font-display text-xs sm:text-sm uppercase text-white leading-tight">{label}</span>
            <span className="text-[11px] text-[var(--ink-dim)] mt-1 leading-snug">{sublabel}</span>
            {badge && <span className="chip chip-accent mt-2 self-start">{badge}</span>}
        </div>
    </button>
);

/**
 * The city hub. Replaces the old grid-of-six-with-a-"More Apps Soon"-hole with
 * a live briefing: what your bag is worth right now, what the street is
 * saying, and what state you're in.
 */
const DashboardScreen: React.FC = () => {
    const { gameState, changeScreen } = useGame();
    const { player, currentCityId, day, quests, activeMarketSignals } = gameState;

    const currentCity = CITIES.find(city => city.id === currentCityId);
    const storeCount = STORES_BY_CITY[currentCityId]?.length ?? 0;
    const rank = getCredRank(player.streetCred);
    const bagValue = useMemo(() => getBagValue(gameState), [gameState]);

    const headline = useMemo(() => {
        const rumors = generateRumorsForCity(currentCityId, day);
        return rumors.find(r => r.type === 'Intel Drop') ?? rumors[0];
    }, [currentCityId, day]);

    const liveSignals = activeMarketSignals.filter(s => s.expiresOnDay > day);

    if (!currentCity) return <div className="label">Loading city…</div>;

    return (
        <div className="flex flex-col gap-4 sm:gap-5 pb-6">
            {/* HERO */}
            <section className="relative panel overflow-hidden">
                <div className="absolute inset-0">
                    <Img
                        fallback="🏙"
                        src={currentCity.image}
                        alt={currentCity.name}
                        className="w-full h-full object-cover opacity-25 grayscale contrast-125"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/75 to-transparent" />
                    <div className="absolute inset-0 scanlines opacity-40" />
                </div>
                <div className="relative p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="label" style={{ color: 'var(--accent)' }}>Day {day} of {TOTAL_DAYS}</span>
                        <span className="w-1 h-1 rounded-full bg-[var(--ink-faint)]" />
                        <span className="label">{rank.icon} {rank.title}</span>
                    </div>
                    <h1 className="font-display text-3xl sm:text-5xl uppercase text-white leading-none mb-2">
                        {currentCity.name}
                    </h1>
                    <p className="text-[var(--ink-dim)] text-sm max-w-xl leading-snug">{currentCity.description}</p>

                    <div className="flex flex-wrap gap-2 mt-4">
                        <span className="chip chip-accent">👟 {storeCount} shops</span>
                        <span className="chip">📦 Bag worth ${bagValue.toLocaleString()}</span>
                        {liveSignals.length > 0 && <span className="chip chip-warn">📊 {liveSignals.length} live signal{liveSignals.length > 1 ? 's' : ''}</span>}
                        {player.heat >= 40 && <span className="chip chip-bad">🚨 Heat {Math.round(player.heat)}</span>}
                        {player.buffs.slice(0, 2).map(b => (
                            <span key={b.id} className="chip chip-accent">✦ {b.label}</span>
                        ))}
                    </div>
                </div>
            </section>

            {/* STREET INTEL TICKER */}
            {headline && (
                <button
                    onClick={() => changeScreen(Screen.CityFeed)}
                    className="panel p-3 text-left flex items-start gap-3 hover:border-[var(--line-bright)] transition-colors"
                >
                    <span className="text-lg leading-none flex-shrink-0">📡</span>
                    <div className="min-w-0">
                        <div className="label mb-0.5">Street Intel · {headline.type}</div>
                        <p className="text-sm text-[var(--ink)] leading-snug line-clamp-2">{headline.text}</p>
                    </div>
                    <span className="label flex-shrink-0 self-center">More →</span>
                </button>
            )}

            {/* ACTIONS */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Tile
                    label="Shops"
                    sublabel="Buy low, sell high, get legit-checked"
                    icon="👟"
                    accent="var(--ok)"
                    onClick={() => changeScreen(Screen.CityStores)}
                    badge={storeCount ? `${storeCount} open` : 'None here'}
                />
                <Tile
                    label="Travel"
                    sublabel="Next city, next day, next problem"
                    icon="✈️"
                    accent="var(--accent-2)"
                    onClick={() => changeScreen(Screen.Travel)}
                    badge={`⚡ costs 15`}
                />
                <Tile
                    label="AM/PM"
                    sublabel="Burekas, weapons, questionable hummus"
                    icon="🏪"
                    accent="var(--warn)"
                    onClick={() => changeScreen(Screen.Ampm)}
                />
                <Tile
                    label="Arcade"
                    sublabel="Brawls, chases, boxes, blacktop"
                    icon="🕹"
                    accent="var(--legend)"
                    onClick={() => changeScreen(Screen.Arcade)}
                />
                <Tile
                    label="Odd Jobs"
                    sublabel="Errands that rarely pay what they should"
                    icon="🗺"
                    onClick={() => changeScreen(Screen.Quests)}
                    badge={quests.length ? `${quests.length} active` : undefined}
                />
                <Tile
                    label="SoleNet"
                    sublabel="The feed, the DMs, the lies"
                    icon="📱"
                    accent="var(--accent-2)"
                    onClick={() => changeScreen(Screen.Social)}
                />
            </div>
        </div>
    );
};

export default DashboardScreen;
