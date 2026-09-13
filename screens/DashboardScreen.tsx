import React, { useMemo, useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import { CITIES } from '../data/cities';
import { STORES_BY_CITY } from '../data/stores';
import { getCredRank, TOTAL_DAYS, INITIAL_PLAYER_CASH, TRAVEL_ENERGY_COST } from '../constants';
import { getBagValue } from '../systems/pricing';
import { generateRumorsForCity } from '../systems/rumorEngine';
import { venuesIn, isVenueOpen } from '../data/venues';
import { collectorsIn } from '../systems/collectors';
import { getRunClock } from '../data/ranks';
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
    const { gameState, changeScreen, rollCityEvent } = useGame();
    const { player, currentCityId, day, quests, activeMarketSignals } = gameState;

    const currentCity = CITIES.find(city => city.id === currentCityId);
    const storeCount = STORES_BY_CITY[currentCityId]?.length ?? 0;
    const rank = getCredRank(player.streetCred);
    const bagValue = useMemo(() => getBagValue(gameState), [gameState]);
    const netWorth = player.cash + bagValue;
    const netChange = netWorth - INITIAL_PLAYER_CASH;
    const clock = getRunClock(day, TOTAL_DAYS);

    // Two tiers of tired. Below the travel cost you are actually stuck; above
    // it you are simply about to be, which is when telling the player is useful.
    const cannotFly = player.energy < TRAVEL_ENERGY_COST;
    const lowEnergy = player.energy < 40;

    const headline = useMemo(() => {
        const rumors = generateRumorsForCity(currentCityId, day);
        return rumors.find(r => r.type === 'Intel Drop') ?? rumors[0];
    }, [currentCityId, day]);

    const liveSignals = activeMarketSignals.filter(s => s.expiresOnDay > day);

    const openVenues = useMemo(
        () => venuesIn(currentCityId).filter(v => isVenueOpen(v, day)).length,
        [currentCityId, day],
    );

    const collectorCount = useMemo(
        () => collectorsIn(currentCityId, player).length,
        [currentCityId, player],
    );

    // The bank tile earns its badge two ways: a debt you are being charged
    // interest on, or a card you cannot currently use. Both are things you want
    // to find out from the city screen rather than at a till.
    const bankBadge = player.wallet.cardBlockedUntilDay && player.wallet.cardBlockedUntilDay > day
        ? 'Card blocked'
        : player.wallet.creditOwed > 0
            ? `Owe $${Math.round(player.wallet.creditOwed).toLocaleString()}`
            : player.bank > 0
                ? `$${Math.round(player.bank).toLocaleString()} banked`
                : undefined;

    // Give the arrival notification a beat to clear, then see whether anything
    // is happening. Keyed on city+day so it fires once per arrival, not on
    // every re-render.
    useEffect(() => {
        const t = setTimeout(() => rollCityEvent(), 1200);
        return () => clearTimeout(t);
    }, [currentCityId, day, rollCityEvent]);

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
                    {/* The deadline gets the urgency colour here and the full
                        count in the run-clock panel below; repeating the words
                        in both wraps badly on a phone. */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
                        <span className="label" style={{ color: clock.color }}>Day {day} of {TOTAL_DAYS}</span>
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

            {/* RUN CLOCK — the day counter is a deadline now, so it gets to say so. */}
            <section className="panel p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 items-start">
                <div className="min-w-0">
                    <div className="label">Days left</div>
                    <div className="numeric text-2xl leading-none mt-0.5" style={{ color: clock.color }}>
                        {clock.daysLeft === 0 ? 'LAST' : clock.daysLeft}
                    </div>
                    <div className="meter mt-2">
                        <i style={{ width: `${Math.min(100, (day / TOTAL_DAYS) * 100)}%`, background: clock.color }} />
                    </div>
                </div>

                <div className="min-w-0">
                    <div className="label">Net worth</div>
                    <div className="numeric text-2xl leading-none mt-0.5 text-[var(--accent)]">
                        ${netWorth.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-mono mt-1.5 leading-tight" style={{ color: netChange >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                        {netChange >= 0 ? '+' : '−'}${Math.abs(netChange).toLocaleString()} on ${INITIAL_PLAYER_CASH.toLocaleString()}
                    </div>
                </div>

                <div className="min-w-0">
                    <div className="label">Energy</div>
                    <div className="numeric text-2xl leading-none mt-0.5" style={{ color: cannotFly ? 'var(--bad)' : lowEnergy ? 'var(--warn)' : 'var(--ok)' }}>
                        {Math.round(player.energy)}
                    </div>
                    <div className="meter mt-2">
                        <i style={{ width: `${player.energy}%`, background: cannotFly ? 'var(--bad)' : 'var(--warn)' }} />
                    </div>
                </div>

                <div className="min-w-0">
                    <div className="label">Cred</div>
                    <div className="numeric text-2xl leading-none mt-0.5 text-[var(--legend)]">{player.streetCred}</div>
                    <div className="text-[10px] font-mono mt-1.5 leading-tight text-[var(--ink-faint)] truncate">{rank.title}</div>
                </div>
            </section>

            {clock.urgent && (
                <div className="panel p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3" style={{ borderColor: clock.color }}>
                    <span className="text-sm leading-snug flex-grow" style={{ color: clock.color }}>
                        {clock.daysLeft === 0
                            ? `Day ${TOTAL_DAYS}. Whatever is still in your bag is worth what it is worth when the books close — sell it or own it.`
                            : `${clock.daysLeft} ${clock.daysLeft === 1 ? 'day' : 'days'} of trading left. Unsold pairs count at market value at the end, not at what you hoped for.`}
                    </span>
                    <button className="btn btn-sm flex-shrink-0" onClick={() => changeScreen(Screen.Inventory)}>
                        Check the bag
                    </button>
                </div>
            )}

            {/* The Arcade and the Departures board quietly lock themselves when you
                run dry. Naming the two fixes is the difference between a system
                and a wall the player walks into. */}
            {lowEnergy && (
                <div className="panel p-3" style={{ borderColor: cannotFly ? 'var(--bad)' : 'var(--warn)' }}>
                    <div className="flex items-start gap-2.5">
                        <span className="text-lg leading-none flex-shrink-0">{cannotFly ? '🪫' : '⚡'}</span>
                        <div className="min-w-0">
                            <div className="label" style={{ color: cannotFly ? 'var(--bad)' : 'var(--warn)' }}>
                                {cannotFly ? `Under ${TRAVEL_ENERGY_COST} energy` : 'Running low'}
                            </div>
                            <p className="text-sm text-[var(--ink-dim)] leading-snug mt-0.5">
                                {cannotFly
                                    ? `A flight costs ${TRAVEL_ENERGY_COST} energy and takes the shortfall out of your health instead. Most of the Arcade is already locked.`
                                    : `Flights cost ${TRAVEL_ENERGY_COST}; Arcade games cost 4 to 25. You will hit the floor in two or three moves.`}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <button className="btn btn-sm btn-accent" onClick={() => changeScreen(Screen.Inventory)}>
                            😴 Nap in your bag
                        </button>
                        <button className="btn btn-sm" onClick={() => changeScreen(Screen.Storage)}>
                            🍱 Eat from storage
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => changeScreen(Screen.Ampm)}>
                            🏪 Buy food at AM/PM
                        </button>
                    </div>
                </div>
            )}

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
                    badge={`1 day · ⚡${TRAVEL_ENERGY_COST}`}
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
                    label="Around Town"
                    sublabel="Courts, bars, alleys — and who is in them"
                    icon="📍"
                    accent="var(--accent)"
                    onClick={() => changeScreen(Screen.Venues)}
                    badge={openVenues ? `${openVenues} open` : 'All shut'}
                />
                <Tile
                    label="Odd Jobs"
                    sublabel="Errands that rarely pay what they should"
                    icon="🗺"
                    onClick={() => changeScreen(Screen.Quests)}
                    badge={quests.length ? `${quests.length} active` : undefined}
                />
                <Tile
                    label="Collectors"
                    sublabel="Private sales. No receipts, no protection"
                    icon="🤝"
                    accent="var(--accent-2)"
                    onClick={() => changeScreen(Screen.Collectors)}
                    badge={collectorCount ? `${collectorCount} buying` : 'Nobody here'}
                />
                <Tile
                    label="Bank"
                    sublabel="Cash gets you robbed, cards get left behind"
                    icon="🏦"
                    accent="var(--ok)"
                    onClick={() => changeScreen(Screen.Bank)}
                    badge={bankBadge}
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
