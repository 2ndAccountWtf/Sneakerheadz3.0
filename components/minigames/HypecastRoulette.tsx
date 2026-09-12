import React, { useState, useEffect, useRef } from 'react';
import { MiniGameShell, MiniGameResult } from './MiniGameShell';
import Img from '../Img';

type Reaction = 'agree' | 'disagree' | 'mock';

interface Statement {
    text: string;
    /** The reaction the live chat rewards. */
    correct: Reaction;
    why: string;
}

/**
 * Hypecast Roulette — Bro Jogan's live episode. He says something. You have a
 * few seconds to react the way the chat wants. Read the statement: a flat
 * conspiracy wants agreement, a factual claim wants pushback, and pure
 * nonsense wants to be laughed at.
 */
const STATEMENTS: Statement[] = [
    { text: 'Reps are just a social construct, bro.', correct: 'mock', why: 'The chat clipped it. Obviously they clipped it.' },
    { text: 'StockX is a CIA front laundering resale money through Antarctica.', correct: 'agree', why: 'Never disagree with the Antarctica bit. It is his favourite bit.' },
    { text: 'Triple whites are basically DMT for your feet.', correct: 'agree', why: 'Primal footwear. You get it.' },
    { text: 'Cold plunging before a raffle statistically improves your odds.', correct: 'disagree', why: 'He respects a man who pushes back on the numbers. Briefly.' },
    { text: 'If you deadlift in Panda Dunks your testosterone goes up 12%.', correct: 'mock', why: 'Even he laughed. The clip does 4 million views.' },
    { text: 'The bots are sentient and they choose who wins drops.', correct: 'agree', why: 'He leans back. "Exactly. EXACTLY."' },
    { text: 'Sambas are the path to inner peace, a monk told me.', correct: 'agree', why: 'The monk is real. Allegedly.' },
    { text: 'Foam Runners will be worth more than gold by next year.', correct: 'disagree', why: 'He pretends that was a test. It was not a test.' },
    { text: 'I bench-pressed elk antlers this morning. In AF1s.', correct: 'mock', why: 'Chat goes feral. You made the episode.' },
    { text: 'AI already runs every sneaker drop on earth.', correct: 'agree', why: 'He points at you. "This guy gets it."' },
];

const REACTIONS: { id: Reaction; label: string; icon: string }[] = [
    { id: 'agree', label: 'Agree', icon: '🙌' },
    { id: 'disagree', label: 'Disagree', icon: '✋' },
    { id: 'mock', label: 'Mock', icon: '😂' },
];

const ROUNDS = 5;
const TIME_PER_ROUND = 4200;
const WIN_THRESHOLD = 3;

const HypecastRoulette: React.FC<{
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ onFinish, onQuit }) => {
    const [deck] = useState(() => [...STATEMENTS].sort(() => 0.5 - Math.random()).slice(0, ROUNDS));
    const [round, setRound] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(TIME_PER_ROUND);
    const [verdict, setVerdict] = useState<null | { ok: boolean; text: string }>(null);
    const [done, setDone] = useState(false);
    const startedAt = useRef(Date.now());

    const current = deck[round];

    // Countdown for the live round.
    useEffect(() => {
        if (verdict || done) return;
        startedAt.current = Date.now();
        setTimeLeft(TIME_PER_ROUND);

        const tick = setInterval(() => {
            const remaining = TIME_PER_ROUND - (Date.now() - startedAt.current);
            if (remaining <= 0) {
                clearInterval(tick);
                setVerdict({ ok: false, text: 'Dead air. He moves on without you. Brutal.' });
            } else {
                setTimeLeft(remaining);
            }
        }, 60);

        return () => clearInterval(tick);
    }, [round, verdict, done]);

    // Advance after showing the verdict.
    useEffect(() => {
        if (!verdict) return;
        const t = setTimeout(() => {
            if (round + 1 >= deck.length) setDone(true);
            else { setRound(r => r + 1); setVerdict(null); }
        }, 1500);
        return () => clearTimeout(t);
    }, [verdict, round, deck.length]);

    const react = (reaction: Reaction) => {
        if (verdict || done) return;
        const ok = reaction === current.correct;
        if (ok) setScore(s => s + 1);
        setVerdict({ ok, text: ok ? current.why : 'Wrong energy. The chat turns on you instantly.' });
    };

    if (done) {
        const won = score >= WIN_THRESHOLD;
        return (
            <MiniGameShell title="Hypecast Roulette" subtitle="Episode over">
                <MiniGameResult
                    won={won}
                    headline={won ? `${score}/${deck.length} — Certified Guest` : `${score}/${deck.length} — Blocked`}
                    detail={won
                        ? 'He hands you a market tip on the way out, unprompted, at length.'
                        : 'He blocks you mid-episode and tells the chat you have low vibrational energy.'}
                    onClose={() => onFinish(won, won ? 'Bro Jogan vouched for you.' : 'Bro Jogan blocked you.')}
                />
            </MiniGameShell>
        );
    }

    const pct = (timeLeft / TIME_PER_ROUND) * 100;

    return (
        <MiniGameShell
            title="Hypecast Roulette"
            subtitle={`Round ${round + 1}/${deck.length} · Score ${score} · Need ${WIN_THRESHOLD}`}
            onQuit={onQuit}
            quitLabel="Leave Set"
        >
            <div className="flex items-center gap-3 mb-4">
                <Img
                    fallback="🎙"
                    src="https://picsum.photos/seed/brojogan/120"
                    alt=""
                    className="w-12 h-12 object-cover border border-[var(--line-bright)] saturate-50"
                />
                <div>
                    <div className="label">Live · Bro Jogan Experience</div>
                    <div className="flex items-center gap-1.5 text-[var(--bad)] text-xs font-mono">
                        <span className="w-2 h-2 rounded-full bg-[var(--bad)] animate-pulse" /> ON AIR
                    </div>
                </div>
            </div>

            <div className="panel-raised p-4 sm:p-5 mb-3 min-h-[6.5rem] flex items-center">
                <p className="text-base sm:text-xl text-white leading-snug">“{current.text}”</p>
            </div>

            <div className="meter h-1.5 mb-4">
                <i style={{ width: `${pct}%`, background: pct > 40 ? 'var(--accent)' : 'var(--bad)', transition: 'width .06s linear' }} />
            </div>

            {verdict ? (
                <div
                    className="panel p-3 text-sm font-mono animate-rise"
                    style={{ color: verdict.ok ? 'var(--ok)' : 'var(--bad)', borderColor: verdict.ok ? 'var(--ok)' : 'var(--bad)' }}
                >
                    {verdict.ok ? '✓ ' : '✗ '}{verdict.text}
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-2">
                    {REACTIONS.map(r => (
                        <button key={r.id} onClick={() => react(r.id)} className="btn flex-col !py-3 !gap-1">
                            <span className="text-xl">{r.icon}</span>
                            <span>{r.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </MiniGameShell>
    );
};

export default HypecastRoulette;
