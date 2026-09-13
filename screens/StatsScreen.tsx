import React, { useMemo } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { getCredRank, CRED_RANKS, TOTAL_DAYS, MAX_INVENTORY_SIZE, INITIAL_PLAYER_CASH } from '../constants';
import { getBagValue } from '../systems/pricing';
import { GIFT_APPROVAL_THRESHOLD } from '../systems/events/bibiEvents';
import { getRunClock, getRunGrade, gradeColor } from '../data/ranks';

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

    // Trajectory, not just position. The rate is measured over days *completed*
    // so day 1 does not divide by zero and claim an infinite career.
    const clock = getRunClock(day, TOTAL_DAYS);
    const netChange = netWorth - INITIAL_PLAYER_CASH;
    const daysTraded = Math.max(1, day - 1);
    const perDay = netChange / daysTraded;
    const projected = Math.max(0, Math.round(netWorth + perDay * clock.daysLeft));
    const currentGrade = getRunGrade(netWorth, INITIAL_PLAYER_CASH);
    const projectedGrade = getRunGrade(projected, INITIAL_PLAYER_CASH);

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

            {/* RUN PROGRESS — where the deadline, the money and the grade meet. */}
            <section className="panel p-4">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                    <div className="min-w-0">
                        <div className="label">Run progress</div>
                        <div className="font-display text-base sm:text-lg uppercase text-white leading-tight">
                            Day {day} of {TOTAL_DAYS}
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <div className="numeric text-2xl leading-none" style={{ color: clock.color }}>
                            {clock.daysLeft === 0 ? 'LAST' : clock.daysLeft}
                        </div>
                        <div className="label">{clock.daysLeft === 0 ? 'day' : 'days left'}</div>
                    </div>
                </div>
                <div className="meter h-2 mb-3">
                    <i style={{ width: `${Math.min(100, (day / TOTAL_DAYS) * 100)}%`, background: clock.color }} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="min-w-0">
                        <div className="label">Started with</div>
                        <div className="numeric text-base mt-0.5 text-[var(--ink-dim)]">${INITIAL_PLAYER_CASH.toLocaleString()}</div>
                    </div>
                    <div className="min-w-0">
                        <div className="label">Worth now</div>
                        <div className="numeric text-base mt-0.5 text-[var(--accent)]">${netWorth.toLocaleString()}</div>
                    </div>
                    <div className="min-w-0">
                        <div className="label">Per day</div>
                        <div className="numeric text-base mt-0.5" style={{ color: perDay >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                            {perDay >= 0 ? '+' : '−'}${Math.abs(Math.round(perDay)).toLocaleString()}
                        </div>
                    </div>
                    <div className="min-w-0">
                        <div className="label">At this rate</div>
                        <div className="numeric text-base mt-0.5" style={{ color: gradeColor(projectedGrade.tone) }}>
                            ${projected.toLocaleString()}
                        </div>
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--line)] flex flex-wrap items-center gap-2">
                    <span className="chip" style={{ borderColor: gradeColor(currentGrade.tone), color: gradeColor(currentGrade.tone) }}>
                        Grade today · {currentGrade.title}
                    </span>
                    {clock.daysLeft > 0 && (
                        <span className="chip" style={{ borderColor: gradeColor(projectedGrade.tone), color: gradeColor(projectedGrade.tone) }}>
                            Day {TOTAL_DAYS} projection · {projectedGrade.title}
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-[var(--ink-faint)] leading-snug mt-2">
                    Unsold pairs are counted at market value when the books close, which is rarely what you paid.
                </p>
            </section>

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

                {/* The whole ladder, so "what is still reachable" is a fact rather
                    than a guess the player has to make from one next-rank line. */}
                <ol className="mt-3 pt-3 border-t border-[var(--line)] space-y-1">
                    {CRED_RANKS.map(r => {
                        const reached = player.streetCred >= r.min;
                        const isCurrent = r.title === rank.title;
                        return (
                            <li
                                key={r.title}
                                className="flex items-center gap-2 text-xs font-mono"
                                style={{ color: isCurrent ? 'var(--accent)' : reached ? 'var(--ink-dim)' : 'var(--ink-faint)' }}
                            >
                                <span className={`leading-none flex-shrink-0 ${reached ? '' : 'opacity-40 grayscale'}`}>{r.icon}</span>
                                <span className="truncate flex-grow">{r.title}</span>
                                <span className="numeric flex-shrink-0">
                                    {reached ? (isCurrent ? 'here' : 'cleared') : `+${r.min - player.streetCred}`}
                                </span>
                            </li>
                        );
                    })}
                </ol>
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
                    <Stat
                        label="Cleanliness"
                        value={`${Math.round(player.cleanliness)}/100`}
                        icon="🧼"
                        color={player.cleanliness < 35 ? 'var(--bad)' : 'var(--accent)'}
                        subtext={player.cleanliness < 35 ? 'People have started saying "bro…"' : 'Presentable'}
                    />
                    <Stat label="Mood" value={`${Math.round(player.mood)}/100`} icon="🙂" color="var(--legend)" />
                    <Stat label="Focus" value={`${Math.round(player.focus)}/100`} icon="🎯" color="var(--accent)" subtext="Steadies your hand in mini-games" />
                    <Stat
                        label="Digestion"
                        value={player.emergency ? 'EMERGENCY' : player.gas >= 9 ? 'Critical' : player.gas >= 6 ? 'Audible' : player.gas >= 3 ? 'Unsettled' : 'Fine'}
                        icon="🫃"
                        color={player.emergency || player.gas >= 9 ? 'var(--bad)' : player.gas >= 6 ? 'var(--warn)' : 'var(--ink-dim)'}
                        subtext={player.gas >= 6 ? 'Avoid important meetings' : 'No notes'}
                    />
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
