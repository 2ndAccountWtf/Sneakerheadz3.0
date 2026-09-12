import React, { useState, useEffect, useRef } from 'react';
import { MiniGameShell, MiniGameResult } from './MiniGameShell';
import { useGame } from '../../hooks/useGame';
import { getCredRank } from '../../constants';

type Move = 'jab' | 'hook' | 'block' | 'taunt';

interface MoveDef {
    label: string;
    icon: string;
    /** What this move beats. */
    beats: Move[];
    dmg: [number, number];
    hint: string;
}

const MOVES: Record<Move, MoveDef> = {
    jab:   { label: 'Jab',   icon: '👊', beats: ['taunt', 'hook'], dmg: [8, 14],  hint: 'Fast. Beats big swings and showboating.' },
    hook:  { label: 'Hook',  icon: '🥊', beats: ['block', 'taunt'], dmg: [16, 26], hint: 'Heavy. Goes through a guard.' },
    block: { label: 'Block', icon: '🛡', beats: ['jab'],            dmg: [0, 4],   hint: 'Eats jabs. Useless against a hook.' },
    taunt: { label: 'Taunt', icon: '🗣', beats: ['block'],          dmg: [4, 8],   hint: 'Risky. Wrecks a turtle and builds cred.' },
};

const ORDER: Move[] = ['jab', 'hook', 'block', 'taunt'];

const TRASH_TALK = [
    'That all you got?',
    'You flinched. I saw it.',
    'These is my streets!',
    "I'm dropping a mixtape about this.",
    'Life don\'t make sense, but this punch does.',
    'Stay down, homie.',
];

/**
 * Street Brawl — the resolver for every `combat` outcome the writers authored.
 * Deliberately shallow: read the opponent's tell, pick the counter, four
 * rounds, done. The joke is that you're fighting over a sandwich.
 */
const StreetBrawl: React.FC<{
    opponent: string;
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ opponent, onFinish, onQuit }) => {
    const { gameState } = useGame();
    const { player } = gameState;

    // Street cred and health translate into a real edge, so the stats matter.
    const credEdge = Math.min(0.25, getCredRank(player.streetCred).min / 800);
    const startHp = Math.round(60 + player.health * 0.4);

    const [playerHp, setPlayerHp] = useState(startHp);
    const [foeHp, setFoeHp] = useState(70);
    const [tell, setTell] = useState<Move>('jab');
    const [round, setRound] = useState(1);
    const [feed, setFeed] = useState<{ text: string; tone: 'good' | 'bad' | 'neutral' }[]>([
        { text: `${opponent} squares up. He is not good at this.`, tone: 'neutral' },
    ]);
    const [locked, setLocked] = useState(false);
    const [done, setDone] = useState<null | boolean>(null);
    const feedRef = useRef<HTMLDivElement>(null);

    // The "tell" is the opponent's next move, shown one beat early.
    useEffect(() => {
        setTell(ORDER[Math.floor(Math.random() * ORDER.length)]);
    }, [round]);

    useEffect(() => {
        feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
    }, [feed]);

    const push = (text: string, tone: 'good' | 'bad' | 'neutral') =>
        setFeed(f => [...f.slice(-8), { text, tone }]);

    const throwMove = (move: Move) => {
        if (locked || done !== null) return;
        setLocked(true);

        // The tell is honest 70% of the time; otherwise he does something else.
        const foeMove = Math.random() < 0.7 ? tell : ORDER[Math.floor(Math.random() * ORDER.length)];
        const def = MOVES[move];
        const foeDef = MOVES[foeMove];

        const playerWins = def.beats.includes(foeMove);
        const foeWins = foeDef.beats.includes(move);

        let nextFoe = foeHp;
        let nextPlayer = playerHp;

        if (playerWins && !foeWins) {
            const dmg = Math.round((def.dmg[0] + Math.random() * (def.dmg[1] - def.dmg[0])) * (1 + credEdge));
            nextFoe -= dmg;
            push(`${def.icon} Your ${def.label.toLowerCase()} lands clean through his ${foeDef.label.toLowerCase()}. -${dmg}`, 'good');
        } else if (foeWins && !playerWins) {
            const dmg = Math.round((foeDef.dmg[0] + Math.random() * (foeDef.dmg[1] - foeDef.dmg[0])) * (1 - credEdge));
            nextPlayer -= dmg;
            push(`${foeDef.icon} He counters your ${def.label.toLowerCase()}. "${TRASH_TALK[Math.floor(Math.random() * TRASH_TALK.length)]}" -${dmg}`, 'bad');
        } else {
            const chip = Math.round(2 + Math.random() * 5);
            nextFoe -= chip;
            nextPlayer -= chip;
            push(`Both of you swing. Both of you connect with an elbow. -${chip} each.`, 'neutral');
        }

        setFoeHp(Math.max(0, nextFoe));
        setPlayerHp(Math.max(0, nextPlayer));

        setTimeout(() => {
            if (nextFoe <= 0) {
                setDone(true);
            } else if (nextPlayer <= 0) {
                setDone(false);
            } else if (round >= 6) {
                // Decision on damage dealt.
                setDone(nextFoe <= nextPlayer);
                push('The bystanders call it. Somebody films it. Of course they do.', 'neutral');
            } else {
                setRound(r => r + 1);
                setLocked(false);
            }
        }, 620);
    };

    if (done !== null) {
        return (
            <MiniGameShell title={`Brawl — ${opponent}`} subtitle="Result">
                <MiniGameResult
                    won={done}
                    headline={done ? 'You Won The Fight' : 'You Got Dropped'}
                    detail={done
                        ? `${opponent} jogs off holding his ribs, still talking.`
                        : `You wake up on the pavement. Your phone is fine. Your pride isn't.`}
                    onClose={() => onFinish(done, done ? `You beat ${opponent}.` : `${opponent} beat you.`)}
                />
            </MiniGameShell>
        );
    }

    return (
        <MiniGameShell
            title={`Brawl — ${opponent}`}
            subtitle={`Round ${round} of 6`}
            onQuit={onQuit}
            quitLabel="Run Away"
        >
            {/* Health bars */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                    <div className="flex justify-between label mb-1"><span>You</span><span className="numeric">{playerHp}</span></div>
                    <div className="meter h-2"><i style={{ width: `${(playerHp / startHp) * 100}%`, background: 'var(--ok)' }} /></div>
                </div>
                <div>
                    <div className="flex justify-between label mb-1"><span className="truncate">{opponent}</span><span className="numeric">{foeHp}</span></div>
                    <div className="meter h-2"><i style={{ width: `${(foeHp / 70) * 100}%`, background: 'var(--bad)' }} /></div>
                </div>
            </div>

            {/* Tell */}
            <div className="panel-raised p-3 mb-4 text-center">
                <div className="label mb-1">He's winding up for a…</div>
                <div className="font-display text-lg text-[var(--warn)]">
                    {MOVES[tell].icon} {MOVES[tell].label}
                </div>
                <div className="text-[11px] text-[var(--ink-faint)] mt-1">He telegraphs it. Mostly.</div>
            </div>

            {/* Feed */}
            <div ref={feedRef} className="panel p-3 h-28 overflow-y-auto mb-4 space-y-1 font-mono text-xs">
                {feed.map((f, i) => (
                    <p key={i} style={{ color: f.tone === 'good' ? 'var(--ok)' : f.tone === 'bad' ? 'var(--bad)' : 'var(--ink-dim)' }}>
                        {f.text}
                    </p>
                ))}
            </div>

            {/* Moves */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ORDER.map(m => (
                    <button
                        key={m}
                        disabled={locked}
                        onClick={() => throwMove(m)}
                        title={MOVES[m].hint}
                        className="btn flex-col !py-3 !gap-1 disabled:opacity-40"
                    >
                        <span className="text-xl">{MOVES[m].icon}</span>
                        <span>{MOVES[m].label}</span>
                    </button>
                ))}
            </div>
            <p className="label text-center mt-3">{MOVES[tell].hint}</p>
        </MiniGameShell>
    );
};

export default StreetBrawl;
