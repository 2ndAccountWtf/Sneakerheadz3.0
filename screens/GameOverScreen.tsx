import React, { useMemo } from 'react';
import { useGame } from '../hooks/useGame';
import ScreenHeader from '../components/ScreenHeader';
import { INITIAL_PLAYER_CASH, TOTAL_DAYS, getCredRank, CRED_RANKS } from '../constants';
import { getBagValue } from '../systems/pricing';
import { getRunGrade, gradeColor } from '../data/ranks';

/** One line of the highlight reel. `note` takes the value so zero reads as a joke, not a gap. */
interface ReelRow {
    icon: string;
    label: string;
    value: string;
    note: string;
}

const Figure: React.FC<{
    label: string;
    value: string;
    color?: string;
    subtext?: string;
}> = ({ label, value, color = 'var(--ink)', subtext }) => (
    <div className="panel p-3 min-w-0">
        <div className="label">{label}</div>
        <div className="numeric text-xl sm:text-2xl mt-0.5 break-words" style={{ color }}>{value}</div>
        {subtext && <div className="text-[10px] text-[var(--ink-faint)] font-mono mt-0.5 leading-tight">{subtext}</div>}
    </div>
);

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;

/**
 * The ending. The day counter existed for thirty days without ever arriving
 * anywhere, so this is where it lands: one page of accounting, one grade, and
 * the list of indignities that produced it.
 *
 * Everything here is derived from state at render time — the screen holds no
 * snapshot of its own, so it reports whatever the reducer last left behind.
 */
const GameOverScreen: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const { player, day } = gameState;

    const bagValue = useMemo(() => getBagValue(gameState), [gameState]);
    const netWorth = player.cash + bagValue;
    const netChange = netWorth - INITIAL_PLAYER_CASH;
    const grade = getRunGrade(netWorth, INITIAL_PLAYER_CASH);
    const accent = gradeColor(grade.tone);
    const rank = getCredRank(player.streetCred);
    const rankIndex = CRED_RANKS.indexOf(rank);

    // Naps and hospital stays can burn extra days, so a run can overrun the
    // deadline. Saying so is cheaper than pretending it always ends on day 30.
    const daysUsed = Math.max(day, TOTAL_DAYS);

    const badges = Object.entries(player.flags)
        .filter(([key, value]) => key.startsWith('badge-') && value)
        .map(([key]) => key.replace('badge-', '').replace(/-/g, ' '));

    const s = player.stats;
    const reel: ReelRow[] = [
        {
            icon: '🥙',
            label: 'Hummus eaten',
            value: `${s.hummusEaten}`,
            note: s.hummusEaten >= 8 ? 'Tubs. Not servings. Tubs.'
                : s.hummusEaten > 0 ? 'Enough to explain most of what follows.'
                : 'None at all, which explains nothing else on this page.',
        },
        {
            icon: '💨',
            label: 'Times farted',
            value: `${s.timesFarted}`,
            note: s.timesFarted >= 10 ? 'A body of work. Witnesses remain.'
                : s.timesFarted > 0 ? 'Within tolerance. Barely.'
                : 'Recorded as zero. The meter disagrees.',
        },
        {
            icon: '😴',
            label: 'Naps taken',
            value: `${s.napsTaken}`,
            note: s.napsTaken > 0 ? 'Each one a wager you agreed to make.'
                : 'You never lay down once. It is visible in the other numbers.',
        },
        {
            icon: '📦',
            label: 'Boxes opened',
            value: `${s.boxesOpened}`,
            note: s.boxesOpened > 0 ? 'Most of them contained a shoe.'
                : 'Everything stayed sealed. Arguably the correct play.',
        },
        {
            icon: '🥊',
            label: 'Fights',
            value: `${s.fightsWon}W · ${s.fightsLost}L`,
            note: s.fightsWon + s.fightsLost === 0 ? 'You talked your way out of all of it.'
                : s.fightsWon > s.fightsLost ? 'The street has updated its notes on you.'
                : 'The street has also updated its notes on you.',
        },
        {
            icon: '🎁',
            label: 'Gifts from Bibi',
            value: `${s.giftsFromBibi}`,
            note: s.giftsFromBibi > 0 ? 'Accepted in full view of the cameras.'
                : 'He never sent anything. He knew you were there.',
        },
        {
            icon: '🗺',
            label: 'Odd jobs finished',
            value: `${s.questsCompleted}`,
            note: s.questsCompleted > 0 ? 'None of them paid what was implied.'
                : 'Every errand still open. Somebody is waiting.',
        },
        {
            icon: '🔪',
            label: 'Times robbed',
            value: `${s.timesRobbed}`,
            note: s.timesRobbed > 0 ? 'They took the pair you liked.' : 'Nobody got close enough.',
        },
        {
            icon: '🥐',
            label: 'Spent on burekas',
            value: money(s.moneyWastedOnBurekas),
            note: s.moneyWastedOnBurekas > 0 ? 'Filed under pastry. Unrecoverable.' : 'Not one bureka. Remarkable restraint.',
        },
        {
            icon: '🕹',
            label: 'Arcade sessions',
            value: `${s.minigamesPlayed}`,
            note: s.minigamesPlayed > 0 ? 'Energy spent on games instead of margin.' : 'You never touched a cabinet.',
        },
    ];

    return (
        <div className="flex flex-col gap-5 pb-6">
            <ScreenHeader
                title={<>The Books <span className="accent">Close</span></>}
                subtitle={`Day ${daysUsed} of ${TOTAL_DAYS} · final accounting`}
                back={null}
            />

            {/* VERDICT */}
            <section className="crt-panel p-4 sm:p-6 relative overflow-hidden">
                <div className="absolute inset-0 scanlines opacity-30 pointer-events-none" />
                <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: accent }} />
                <div className="relative">
                    <div className="label mb-1.5">Final grade</div>
                    <h2 className="font-display text-2xl sm:text-4xl uppercase leading-none" style={{ color: accent }}>
                        {grade.title}
                    </h2>
                    <p className="text-sm text-[var(--ink-dim)] leading-snug mt-2 max-w-2xl">{grade.verdict}</p>

                    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mt-5">
                        <div>
                            <div className="label">Final net worth</div>
                            <div className="numeric text-3xl sm:text-4xl leading-none" style={{ color: accent }}>
                                {money(netWorth)}
                            </div>
                        </div>
                        <div>
                            <div className="label">Against a {money(INITIAL_PLAYER_CASH)} stake</div>
                            <div
                                className="numeric text-xl sm:text-2xl leading-none"
                                style={{ color: netChange >= 0 ? 'var(--ok)' : 'var(--bad)' }}
                            >
                                {signed(netChange)}
                                <span className="text-sm ml-2 text-[var(--ink-faint)]">
                                    ×{(netWorth / INITIAL_PLAYER_CASH).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* THE NUMBERS */}
            <section>
                <h2 className="label mb-2 pb-1 border-b border-[var(--line)]">The numbers</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Figure label="Cash on hand" value={money(player.cash)} color="var(--ok)" subtext="Liquid, spendable, gone" />
                    <Figure
                        label="Unsold bag"
                        value={money(bagValue)}
                        color={bagValue > 0 ? 'var(--legend)' : 'var(--ink-faint)'}
                        subtext={player.inventory.length === 0 ? 'You cleared it out' : `${player.inventory.length} pairs you never moved`}
                    />
                    <Figure
                        label="Realised on sales"
                        value={signed(s.totalProfit)}
                        color={s.totalProfit >= 0 ? 'var(--ok)' : 'var(--bad)'}
                        subtext={`${s.sneakersSold} pairs sold`}
                    />
                    <Figure
                        label="Street cred"
                        value={`${rank.icon} ${player.streetCred}`}
                        color="var(--accent)"
                        subtext={`${rank.title} · rung ${rankIndex + 1} of ${CRED_RANKS.length}`}
                    />
                </div>
            </section>

            {/* BADGES */}
            <section className="panel p-4">
                <div className="label mb-2">Badges earned</div>
                {badges.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {badges.map(badge => (
                            <span key={badge} className="chip chip-accent capitalize">🏅 {badge}</span>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-[var(--ink-dim)] leading-snug">
                        None. You got through a month of this without doing anything anyone wrote down.
                    </p>
                )}
            </section>

            {/* HIGHLIGHT REEL */}
            <section className="panel">
                <div className="panel-head">
                    <span className="label">Highlight reel</span>
                    <span className="label">The part nobody asks about</span>
                </div>
                <div className="divide-y divide-[var(--line)]">
                    {reel.map(row => {
                        const isZero = row.value === '0' || row.value === '$0' || row.value === '0W · 0L';
                        return (
                            <div key={row.label} className="flex items-center gap-3 px-3 py-2.5">
                                <span className={`text-lg leading-none flex-shrink-0 ${isZero ? 'opacity-30' : ''}`}>{row.icon}</span>
                                <div className="min-w-0 flex-grow">
                                    <div className="text-sm text-[var(--ink)] leading-tight">{row.label}</div>
                                    <div className="text-[11px] text-[var(--ink-faint)] leading-snug">{row.note}</div>
                                </div>
                                <span
                                    className="numeric text-base sm:text-lg flex-shrink-0"
                                    style={{ color: isZero ? 'var(--ink-faint)' : 'var(--ink)' }}
                                >
                                    {row.value}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* RESTART */}
            <section className="panel p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-grow">
                    <div className="font-display text-sm uppercase text-white">Thirty more days</div>
                    <p className="text-[11px] text-[var(--ink-faint)] leading-snug mt-0.5">
                        New markets, new rumours, the same hummus.
                    </p>
                </div>
                {/* RESET_GAME re-seeds state and regenerates the markets, so a new run
                    starts on a fresh world without reloading the page. */}
                <button className="btn btn-primary w-full sm:w-auto" onClick={() => dispatch({ type: 'RESET_GAME' })}>
                    Run it back
                </button>
            </section>
        </div>
    );
};

export default GameOverScreen;
