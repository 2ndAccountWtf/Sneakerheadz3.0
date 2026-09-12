import React, { useMemo } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { getCredRank, CRED_RANKS, TOTAL_DAYS, MAX_INVENTORY_SIZE } from '../constants';
import { getBagValue } from '../systems/pricing';
import { GIFT_APPROVAL_THRESHOLD } from '../systems/events/bibiEvents';

const Stat: React.FC<{
    label: string;
    value: string | number;
    icon?: string;
    color?: string;
    subtext?: string;
    currency?: boolean;
}> = ({ label, value, icon, color = 'var(--ink)', subtext, currency }) => (
    <div className="panel p-3 relative overflow-hidden">
        {icon && <span className="absolute top-2 right-2.5 text-2xl opacity-10">{icon}</span>}
        <div className="label">{label}</div>
        <div className="numeric text-xl sm:text-2xl mt-0.5" style={{ color }}>
            {currency ? '$' : ''}{typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {subtext && <div className="text-[10px] text-[var(--ink-faint)] font-mono mt-0.5 leading-tight">{subtext}</div>}
    </div>
);

/**
 * The Dossier. Financials, the rank ladder that used to read "(Rank system
 * offline)", the biological indignities, and where you stand with the Prime
 * Minister — which now decides whether the gift scenes can fire at all.
 */
const StatsScreen: React.FC = () => {
    const { gameState, changeScreen } = useGame();
    const { player, day, quests } = gameState;

    const bagValue = useMemo(() => getBagValue(gameState), [gameState]);
    const netWorth = player.cash + bagValue;
    const rank = getCredRank(player.streetCred);
    const nextRank = CRED_RANKS.find(r => r.min > player.streetCred);
    const toNext = nextRank ? nextRank.min - player.streetCred : 0;
    const rankProgress = nextRank
        ? ((player.streetCred - rank.min) / (nextRank.min - rank.min)) * 100
        : 100;

    const badges = Object.entries(player.flags)
        .filter(([k, v]) => k.startsWith('badge-') && v)
        .map(([k]) => k.replace('badge-', '').replace(/-/g, ' '));

    const approvalMood =
        player.bibiApproval >= GIFT_APPROVAL_THRESHOLD ? 'He speaks of you warmly. Gifts are possible.'
        : player.bibiApproval >= 45 ? 'Cordial. Watchful.'
        : player.bibiApproval >= 20 ? "He knows your name. That's all."
        : 'You are, in his view, part of the chaos.';

    return (
        <div className="flex flex-col gap-5 pb-6">
            <ScreenHeader
                title={<><span className="accent">Dossier</span></>}
                subtitle={`Day ${day} of ${TOTAL_DAYS}`}
                back={Screen.Dashboard}
                actions={
                    <button className="btn btn-sm" onClick={() => changeScreen(Screen.Quests)}>
                        Odd Jobs{quests.length ? ` (${quests.length})` : ''}
                    </button>
                }
            />

            {/* RANK */}
            <section className="panel p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-3xl leading-none">{rank.icon}</span>
                        <div className="min-w-0">
                            <div className="label">Street Standing</div>
                            <div className="font-display text-base sm:text-lg uppercase text-white leading-tight truncate">{rank.title}</div>
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <div className="numeric text-2xl text-[var(--accent)]">{player.streetCred}</div>
                        <div className="label">cred</div>
                    </div>
                </div>
                <div className="meter h-2 mb-1.5">
                    <i style={{ width: `${Math.min(100, rankProgress)}%`, background: 'var(--accent)' }} />
                </div>
                <p className="label">
                    {nextRank ? `${toNext} more to reach ${nextRank.title}` : 'Top of the ladder. Nowhere left to climb.'}
                </p>
                {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[var(--line)]">
                        {badges.map(b => <span key={b} className="chip chip-accent capitalize">🏅 {b}</span>)}
                    </div>
                )}
            </section>

            {/* FINANCIALS */}
            <section>
                <h2 className="label mb-2 pb-1 border-b border-[var(--line)]">Financials</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat label="Liquid Cash" value={player.cash} icon="💵" color="var(--ok)" currency />
                    <Stat label="Net Worth" value={netWorth} icon="🏦" color="var(--accent)" subtext="Cash + live bag value" currency />
                    <Stat label="Bag Value" value={bagValue} icon="👟" color={bagValue > 0 ? 'var(--legend)' : 'var(--ink-faint)'} subtext={`${player.inventory.length}/${MAX_INVENTORY_SIZE} slots`} currency />
                    <Stat label="Lifetime Profit" value={player.stats.totalProfit} icon="📈" color={player.stats.totalProfit >= 0 ? 'var(--ok)' : 'var(--bad)'} subtext={`${player.stats.sneakersSold} pairs sold`} currency />
                </div>
            </section>

            {/* CONDITION */}
            <section>
                <h2 className="label mb-2 pb-1 border-b border-[var(--line)]">Condition</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat label="Health" value={`${Math.round(player.health)}/100`} icon="❤️" color="var(--bad)" />
                    <Stat label="Energy" value={`${Math.round(player.energy)}/100`} icon="⚡" color="var(--warn)" subtext="Travel costs 15" />
                    <Stat label="Police Heat" value={`${Math.round(player.heat)}/100`} icon="🚨" color={player.heat > 50 ? 'var(--bad)' : 'var(--ink-dim)'} subtext={player.heat > 50 ? 'Legit checks are catching you' : 'Below the radar'} />
                    <Stat label="Active Effects" value={player.buffs.length} icon="✦" color="var(--accent)" subtext={player.buffs.map(b => b.label).join(', ') || 'None'} />
                </div>
            </section>

            {/* BIBI */}
            <section className="panel p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                        <div className="label">Bibi Approval</div>
                        <p className="text-sm text-[var(--ink-dim)] mt-0.5">{approvalMood}</p>
                    </div>
                    <div className="numeric text-2xl flex-shrink-0" style={{ color: player.bibiApproval >= GIFT_APPROVAL_THRESHOLD ? 'var(--accent)' : 'var(--ink-dim)' }}>
                        {player.bibiApproval}
                    </div>
                </div>
                <div className="meter h-2 relative">
                    <i style={{ width: `${player.bibiApproval}%`, background: player.bibiApproval >= GIFT_APPROVAL_THRESHOLD ? 'var(--accent)' : 'var(--ink-faint)' }} />
                    <span
                        className="absolute top-0 bottom-0 w-px bg-[var(--legend)]"
                        style={{ left: `${GIFT_APPROVAL_THRESHOLD}%` }}
                        title={`Gift threshold: ${GIFT_APPROVAL_THRESHOLD}`}
                    />
                </div>
                <p className="label mt-1.5">Gift scenes unlock at {GIFT_APPROVAL_THRESHOLD} · {player.stats.giftsFromBibi} received</p>
            </section>

            {/* THE REAL STATS */}
            <section>
                <h2 className="label mb-2 pb-1 border-b border-[var(--line)]" style={{ color: 'var(--accent-2)' }}>
                    Biologicals & Regrets
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    <Stat label="Hummus Eaten" value={player.stats.hummusEaten} icon="🥙" color="#e8c88a" subtext="Too much" />
                    <Stat label="Times Farted" value={player.stats.timesFarted} icon="💨" color="var(--ok)" subtext="Silent but deadly" />
                    <Stat label="Bureka Waste" value={player.stats.moneyWastedOnBurekas} icon="🥐" color="var(--bad)" currency subtext="Money, gone" />
                    <Stat label="Times Robbed" value={player.stats.timesRobbed} icon="🔪" color="var(--bad)" />
                    <Stat label="Naps Taken" value={player.stats.napsTaken} icon="😴" color="var(--ink-dim)" />
                    <Stat label="Fights Won" value={player.stats.fightsWon} icon="🥊" color="var(--ok)" subtext={`${player.stats.fightsLost} lost`} />
                    <Stat label="Mini-Games" value={player.stats.minigamesPlayed} icon="🕹" color="var(--accent)" />
                    <Stat label="Boxes Opened" value={player.stats.boxesOpened} icon="📦" color="var(--legend)" />
                    <Stat label="Jobs Done" value={player.stats.questsCompleted} icon="🗺" color="var(--accent)" />
                    <Stat label="Bibi Gifts" value={player.stats.giftsFromBibi} icon="🎁" color="var(--legend)" />
                </div>
            </section>
        </div>
    );
};

export default StatsScreen;
