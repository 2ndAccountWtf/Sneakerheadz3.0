import React from 'react';
import { useGame } from '../../hooks/useGame';
import {
    canStayAnother, atTheLimit, reachableFunds, nightlyEstimate,
    COOLED_PER_NIGHT, HEALED_PER_NIGHT, MAX_NIGHTS,
} from '../../systems/hospital';
import { MAX_HEALTH } from '../../constants';

/**
 * The ward.
 *
 * A chart clipped to the end of a bed. Everything on it is legible on purpose,
 * and that is the deliberate opposite of `BustScene` — do not "fix" this to
 * match it. A police stop hides its numbers because the tension is reading a
 * person: you cannot know what he will take, and knowing would end the scene.
 * In here there is nobody to read. The tension is arithmetic you are entitled
 * to do, over the two things a thirty-day run cannot spare, and hiding the
 * nightly rate would make it a slot machine rather than a decision.
 *
 * So the player can see the bill, the rate, what a night buys back, and how
 * many days they have burned. What the game does not tell them is whether they
 * can afford the rest of the run after this — which is the actual question, and
 * the one they should be sitting there working out.
 */

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

const HospitalScene: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const stay = gameState.hospital;
    if (!stay) return null;

    const { player, day } = gameState;
    const health = Math.round(player.health);
    const pct = Math.max(0, Math.min(100, (health / MAX_HEALTH) * 100));
    const canStay = canStayAnother(stay, player);
    const outOfNights = atTheLimit(stay);
    const daysHere = day - stay.admittedOnDay;

    // What the desk can actually get out of you, in the order it will try.
    const reachable = reachableFunds(player);
    const short = stay.bill > reachable;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="panel w-full max-w-lg p-4 border-[var(--bad)]">

                <div className="flex items-baseline justify-between mb-1">
                    <h2 className="screen-title text-[var(--bad)]">🏥 Admitted</h2>
                    <span className="label">
                        Day {day}{daysHere > 0 && ` · in since day ${stay.admittedOnDay}`}
                    </span>
                </div>

                <p className="text-sm text-[var(--ink)] leading-snug mb-1">{stay.cause}</p>
                <p className="label mb-3 text-[var(--ink-faint)]">You are in {stay.ward}.</p>

                {/* The two things you are trading, side by side and unhidden. */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="panel p-3">
                        <div className="label">Condition</div>
                        <div className="numeric text-xl" style={{ color: health < 35 ? 'var(--bad)' : 'var(--ok)' }}>
                            {health}/100
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--bg-sunken)' }}>
                            <div
                                className="h-full transition-[width] duration-500"
                                style={{ width: `${pct}%`, background: health < 35 ? 'var(--bad)' : 'var(--ok)' }}
                            />
                        </div>
                    </div>
                    <div className="panel p-3 text-right">
                        <div className="label">The bill, so far</div>
                        <div className="numeric text-xl text-[var(--bad)]">{fmt(stay.bill)}</div>
                        <div className="label mt-2" style={{ color: short ? 'var(--warn)' : 'var(--ink-faint)' }}>
                            {short
                                ? 'More than you have on you and in the bank'
                                : `${fmt(reachable)} between your pocket and the bank`}
                        </div>
                    </div>
                </div>

                {/* The one piece of good news in here, stated plainly because a
                    player who never notices it never gets to use it. */}
                {player.heat > 0 && (
                    <p className="label mb-3" style={{ color: 'var(--ok)' }}>
                        🚨 Heat {Math.round(player.heat)} — nobody is looking for a man in a gown. A night takes {COOLED_PER_NIGHT} off it.
                    </p>
                )}

                {/* The chart at the end of the bed. */}
                {stay.chart.length > 0 && (
                    <div className="panel p-3 mb-3 max-h-32 overflow-y-auto" style={{ background: 'var(--bg-sunken)' }}>
                        {stay.chart.map((line, i) => (
                            <p key={i} className="text-xs text-[var(--ink-dim)] leading-relaxed">{line}</p>
                        ))}
                    </div>
                )}

                <p className="text-xs text-[var(--ink-faint)] italic mb-3">{stay.neighbour}</p>

                <div className="grid grid-cols-1 gap-2">
                    {!canStay ? (
                        <p className="label text-center mb-1" style={{ color: 'var(--warn)' }}>
                            {outOfNights
                                ? `${MAX_NIGHTS} nights. They need the bed, and they have said so twice.`
                                : 'They will not run the bill any higher. You are being discharged, and it is not because you are well.'}
                        </p>
                    ) : (
                        <button
                            className="btn btn-ghost"
                            onClick={() => dispatch({ type: 'HOSPITAL_NIGHT' })}
                        >
                            🛏 Stay another night
                            <span className="label ml-2">
                                −1 day · {fmt(nightlyEstimate(stay))} · about +{HEALED_PER_NIGHT} back
                            </span>
                        </button>
                    )}

                    <button
                        className="btn btn-primary"
                        onClick={() => dispatch({ type: 'HOSPITAL_DISCHARGE' })}
                    >
                        {canStay ? `Sign yourself out at ${health}/100` : `Settle up — ${fmt(stay.bill)}`}
                    </button>
                </div>

                <p className="label mt-3 text-center text-[var(--ink-faint)]">
                    They take it from your pocket first, then the bank, then the card.
                </p>
            </div>
        </div>
    );
};

export default HospitalScene;
