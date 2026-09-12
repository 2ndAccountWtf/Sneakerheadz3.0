import React, { useState } from 'react';
import { MiniGameShell, MiniGameResult } from './MiniGameShell';
import { useGame } from '../../hooks/useGame';

type Play = 'stepback' | 'cross' | 'pullup' | 'pass';

interface PlayDef {
    label: string;
    icon: string;
    /** Base chance to score against a defender who is NOT expecting it. */
    base: number;
    /** The defensive stance this play loses to. */
    losesTo: Stance;
    note: string;
}

type Stance = 'tight' | 'sagging' | 'hands-up';

const STANCES: Record<Stance, { label: string; tell: string }> = {
    tight: { label: 'Pressing you', tell: 'He is right on your hip, chest to chest.' },
    sagging: { label: 'Sagging off', tell: 'He drops two steps back, daring you to shoot.' },
    'hands-up': { label: 'Hands high', tell: 'He is straight up with both hands in your face.' },
};

const PLAYS: Record<Play, PlayDef> = {
    stepback: { label: 'Stepback', icon: '🔙', base: 0.78, losesTo: 'sagging', note: 'Creates space — wasted if he already gave you space.' },
    cross:    { label: 'Crossover', icon: '💫', base: 0.80, losesTo: 'hands-up', note: 'Blows past pressure. Useless on a set defender.' },
    pullup:   { label: 'Pull-up', icon: '🎯', base: 0.76, losesTo: 'tight', note: 'Punishes a sag. Gets swallowed under pressure.' },
    pass:     { label: 'Kick Out', icon: '🤝', base: 0.62, losesTo: 'sagging', note: 'Safe two, if the guy you pass to is awake.' },
};

const ORDER: Play[] = ['stepback', 'cross', 'pullup', 'pass'];

const SMACK = [
    'He hits a fadeaway and stares at you the whole way back.',
    'He calls a foul. There was no foul.',
    'He scores and tells the crowd he plays overseas.',
];

/**
 * Street Basketball. First to 5. Read the stance, pick the play it can't
 * handle. Your street cred is a real, modest edge — the neighbourhood plays
 * you differently once you're somebody.
 */
const StreetBall: React.FC<{
    opponent?: string;
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ opponent = 'Some Guy In Jeans', onFinish, onQuit }) => {
    const { gameState } = useGame();
    const edge = Math.min(0.14, gameState.player.streetCred / 900);

    const [you, setYou] = useState(0);
    const [them, setThem] = useState(0);
    const [stance, setStance] = useState<Stance>('tight');
    const [feed, setFeed] = useState<string[]>([`${opponent} checks the ball. "Make it take it."`]);
    const [locked, setLocked] = useState(false);
    const [done, setDone] = useState<null | boolean>(null);

    const run = (play: Play) => {
        if (locked || done !== null) return;
        setLocked(true);

        const def = PLAYS[play];
        const penalised = def.losesTo === stance;
        const chance = Math.min(0.94, (penalised ? def.base - 0.42 : def.base) + edge);
        const scored = Math.random() < chance;

        let nextYou = you;
        let nextThem = them;
        const lines: string[] = [];

        if (scored) {
            nextYou += 1;
            lines.push(`${def.icon} ${def.label} — bucket. ${nextYou}-${nextThem}.`);
        } else {
            lines.push(penalised
                ? `${def.icon} ${def.label} into exactly what he was waiting for. Stuffed.`
                : `${def.icon} ${def.label} — rimmed out. Rough.`);
            // Turnover means he gets his own look.
            if (Math.random() < 0.68) {
                nextThem += 1;
                lines.push(SMACK[Math.floor(Math.random() * SMACK.length)] + ` ${nextYou}-${nextThem}.`);
            } else {
                lines.push('He bricks it. Mercy.');
            }
        }

        setYou(nextYou);
        setThem(nextThem);
        setFeed(f => [...f.slice(-6), ...lines]);
        setStance(Object.keys(STANCES)[Math.floor(Math.random() * 3)] as Stance);

        setTimeout(() => {
            if (nextYou >= 5) setDone(true);
            else if (nextThem >= 5) setDone(false);
            else setLocked(false);
        }, 700);
    };

    if (done !== null) {
        return (
            <MiniGameShell title="Street Ball" subtitle="Final">
                <MiniGameResult
                    won={done}
                    headline={done ? `You Won ${you}-${them}` : `You Lost ${you}-${them}`}
                    detail={done
                        ? 'The court gets loud. Somebody asks where you got the shoes.'
                        : `${opponent} is already telling the next group about it.`}
                    onClose={() => onFinish(done, done ? `You beat ${opponent} on the court.` : `${opponent} cooked you.`)}
                />
            </MiniGameShell>
        );
    }

    return (
        <MiniGameShell title="Street Ball" subtitle={`First to 5 — you ${you}, him ${them}`} onQuit={onQuit} quitLabel="Forfeit">
            <div className="panel-raised p-3 mb-4 text-center">
                <div className="label mb-1">Defence: {STANCES[stance].label}</div>
                <p className="text-[var(--warn)] text-sm">{STANCES[stance].tell}</p>
            </div>

            <div className="panel p-3 h-24 overflow-y-auto mb-4 space-y-1 font-mono text-xs text-[var(--ink-dim)]">
                {feed.map((f, i) => <p key={i}>{f}</p>)}
            </div>

            <div className="grid grid-cols-2 gap-2">
                {ORDER.map(p => (
                    <button key={p} disabled={locked} onClick={() => run(p)} title={PLAYS[p].note} className="btn flex-col !py-3 !gap-1">
                        <span className="text-xl">{PLAYS[p].icon}</span>
                        <span>{PLAYS[p].label}</span>
                    </button>
                ))}
            </div>
        </MiniGameShell>
    );
};

export default StreetBall;
