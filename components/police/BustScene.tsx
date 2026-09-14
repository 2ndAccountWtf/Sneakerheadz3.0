import React, { useMemo, useState } from 'react';
import { useGame } from '../../hooks/useGame';
import { seizableCash, fakesOn, type BustState } from '../../systems/police/bust';

/**
 * The stop.
 *
 * What the player can see: his current number, and exactly what is in their
 * own pocket. What they cannot see: his ceiling, his patience, how close the
 * last offer came, or any odds at all. The uncertainty is meant to be about
 * reading a person, never about arithmetic you would obviously get right
 * standing in front of him.
 *
 * There is deliberately no "recommended" option and no preview of what
 * anything costs. The version this replaces listed three fixed prices, which
 * is exactly why it stopped being a decision after the first time.
 */

const OPENERS: Record<string, string[]> = {
    bored: [
        'Long night. Bag looks heavy.',
        'You know how this goes. Let us not make it a whole thing.',
        'I am not writing anything down yet.',
    ],
    business: [
        'Open the bag or open it at the station. Your call.',
        'I have had four of these today and I am behind on all of them.',
        'You are going to tell me it is all legitimate. Skip that part.',
    ],
    'looking-for-you': [
        'I know exactly what you have been doing. Do not insult me.',
        'Been waiting on you. Do not make it worse than it already is.',
        'I did not find you by accident.',
    ],
};

const KNOWS_YOU = 'I have heard your name more than once this week.';

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

const BustScene: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const bust = gameState.activeBust;
    const [amount, setAmount] = useState('');

    const pocket = seizableCash(gameState.player);
    const fakes = fakesOn(gameState.player);

    // Fixed for the life of this stop, so his line does not change under you.
    const opener = useMemo(() => {
        if (!bust) return '';
        const pool = OPENERS[bust.officer.temperament];
        const line = pool[Math.floor(Math.random() * pool.length)];
        return bust.officer.knowsYou ? `${line} ${KNOWS_YOU}` : line;
    }, [bust?.officer]);

    if (!bust) return null;
    const { officer, status } = bust;
    const live = status === 'negotiating';
    const value = Number(amount);
    const canOffer = live && Number.isFinite(value) && value > 0 && value <= pocket;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div className="panel w-full max-w-md p-4 border-[var(--bad)]">
                <div className="flex items-baseline justify-between mb-1">
                    <h2 className="screen-title text-[var(--bad)]">🚨 Stopped</h2>
                    <span className="label">{officer.name}</span>
                </div>

                <p className="text-sm text-[var(--ink)] leading-snug mb-3">“{opener}”</p>

                {/* His number, and yours. Nothing about his patience or his ceiling. */}
                <div className="panel p-3 mb-3 flex items-center justify-between">
                    <div>
                        <div className="label">He wants</div>
                        <div className="numeric text-xl text-[var(--bad)]">{fmt(bust.asking)}</div>
                    </div>
                    <div className="text-right">
                        <div className="label">On you</div>
                        <div className="numeric text-xl">{fmt(pocket)}</div>
                        {gameState.player.bank > 0 && (
                            <div className="label mt-0.5">{fmt(gameState.player.bank)} banked — he cannot see it</div>
                        )}
                    </div>
                </div>

                {fakes > 0 && (
                    <p className="label mb-3" style={{ color: 'var(--warn)' }}>
                        You are carrying {fakes} counterfeit {fakes === 1 ? 'pair' : 'pairs'}.
                    </p>
                )}

                {status === 'insulted' && (
                    <p className="text-sm mb-3" style={{ color: 'var(--bad)' }}>
                        He stops looking at the bag and starts looking at you.
                    </p>
                )}
                {status === 'refused' && (
                    <p className="text-sm mb-3" style={{ color: 'var(--bad)' }}>
                        “We are done talking.”
                    </p>
                )}
                {status === 'settled' && (
                    <p className="text-sm mb-3" style={{ color: 'var(--ok)' }}>
                        He puts his hand out for {fmt(bust.agreed)}.
                    </p>
                )}

                {live && (
                    <div className="flex gap-2 mb-3">
                        <input
                            inputMode="numeric"
                            value={amount}
                            onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder="Offer him…"
                            className="input flex-1 numeric"
                        />
                        <button
                            className="btn btn-primary"
                            disabled={!canOffer}
                            onClick={() => { dispatch({ type: 'BUST_OFFER', payload: { amount: value } }); setAmount(''); }}
                        >
                            Offer
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                    {status === 'settled' && (
                        <button className="btn btn-primary col-span-2"
                            onClick={() => dispatch({ type: 'BUST_RESOLVE', payload: { choice: 'pay' } })}>
                            Pay him {fmt(bust.agreed)}
                        </button>
                    )}
                    {(live || status === 'refused' || status === 'insulted') && (
                        <button className="btn btn-ghost col-span-2"
                            onClick={() => dispatch({ type: 'BUST_RESOLVE', payload: { choice: 'refuse' } })}>
                            {live ? 'Say nothing' : 'Let him search you'}
                        </button>
                    )}

                    {/* The three ways this becomes a different kind of evening.
                        No costs shown: the whole point is not knowing. */}
                    <button className="btn btn-ghost"
                        onClick={() => dispatch({ type: 'BUST_RESOLVE', payload: { choice: 'run' } })}>
                        🏃 Run
                    </button>
                    <button className="btn btn-ghost"
                        onClick={() => dispatch({ type: 'BUST_RESOLVE', payload: { choice: 'drive' } })}>
                        🛒 Take off
                    </button>
                    <button className="btn btn-ghost col-span-2" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}
                        onClick={() => dispatch({ type: 'BUST_RESOLVE', payload: { choice: 'swing' } })}>
                        🥊 Swing on him
                    </button>
                </div>

                <p className="label mt-3 text-center">
                    Nothing here tells you what he will take. That is the job.
                </p>
            </div>
        </div>
    );
};

export default BustScene;
