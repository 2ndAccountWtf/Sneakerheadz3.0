import React from 'react';
import { useGame } from '../hooks/useGame';
import { CITIES } from '../data/cities';
import { MAX_INVENTORY_SIZE, TOTAL_DAYS, getCredRank } from '../constants';

const Gauge: React.FC<{ label: string; value: number; max: number; color: string; icon: string }> = ({
    label, value, max, color, icon,
}) => (
    <div className="flex items-center gap-1.5" title={`${label}: ${value}/${max}`}>
        <span className="text-[11px] leading-none">{icon}</span>
        <div className="meter w-10 sm:w-14">
            <i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
        </div>
    </div>
);

/**
 * The persistent HUD. Cash and day were the only things surfaced before; the
 * new survival and reputation stats need to be readable at a glance or the
 * systems driving them are invisible.
 */
const Header: React.FC = () => {
    const { gameState } = useGame();
    const { player, currentCityId, day } = gameState;

    const currentCity = CITIES.find(city => city.id === currentCityId);
    const rank = getCredRank(player.streetCred);
    const activeBuffs = player.buffs.length;

    return (
        <header className="sticky top-0 z-40 w-full bg-[var(--bg)]/92 backdrop-blur-md border-b border-[var(--line)]">
            <div className="max-w-6xl mx-auto px-3 sm:px-5 h-[var(--header-h)] flex items-center justify-between gap-3">
                {/* Location */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="font-display text-[var(--accent)] text-sm sm:text-base leading-none hidden xs:inline">SDW</span>
                    <div className="h-6 w-px bg-[var(--line)] hidden sm:block" />
                    <div className="min-w-0">
                        <div className="label leading-none">Day {day}/{TOTAL_DAYS}</div>
                        <div className="text-sm sm:text-base font-semibold text-white uppercase tracking-wide leading-tight truncate">
                            {currentCity?.name}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                    <div className="hidden md:flex items-center gap-3">
                        <Gauge label="Health" value={player.health} max={100} color="var(--bad)" icon="❤️" />
                        <Gauge label="Energy" value={player.energy} max={100} color="var(--warn)" icon="⚡" />
                        {player.heat > 0 && <Gauge label="Heat" value={player.heat} max={100} color="var(--accent-2)" icon="🚨" />}
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 chip chip-accent" title={`${rank.title} — ${player.streetCred} street cred`}>
                        <span>{rank.icon}</span>
                        <span className="numeric">{player.streetCred}</span>
                    </div>

                    {activeBuffs > 0 && (
                        <div className="chip chip-warn hidden lg:flex" title={player.buffs.map(b => b.label).join(' · ')}>
                            ✦ {activeBuffs}
                        </div>
                    )}

                    <div className="text-right leading-none">
                        <div className="label hidden sm:block">Cash</div>
                        <div className="numeric text-base sm:text-lg text-[var(--ok)]">
                            ${player.cash.toLocaleString()}
                        </div>
                    </div>

                    <div className="text-right leading-none hidden sm:block">
                        <div className="label">Bag</div>
                        <div className="numeric text-base text-[var(--ink)]">
                            {player.inventory.length}/{MAX_INVENTORY_SIZE}
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact mobile stat strip */}
            <div className="md:hidden flex items-center gap-3 px-3 pb-1.5">
                <Gauge label="Health" value={player.health} max={100} color="var(--bad)" icon="❤️" />
                <Gauge label="Energy" value={player.energy} max={100} color="var(--warn)" icon="⚡" />
                <Gauge label="Bag" value={player.inventory.length} max={MAX_INVENTORY_SIZE} color="var(--accent)" icon="📦" />
                <span className="chip chip-accent ml-auto">{rank.icon} {player.streetCred}</span>
            </div>
        </header>
    );
};

export default Header;
