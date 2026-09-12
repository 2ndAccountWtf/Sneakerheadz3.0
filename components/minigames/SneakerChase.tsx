import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameShell, MiniGameResult } from './MiniGameShell';

const LANES = 3;
const TICK_MS = 90;
const TRACK_ROWS = 12;
const WIN_DISTANCE = 90;

type Cell = 'empty' | 'hazard' | 'boost';

interface Row {
    id: number;
    cells: Cell[];
    /** 0..TRACK_ROWS, counts down as the row rushes toward you. */
    y: number;
}

const HAZARD_ART = ['🚧', '🛵', '🚕', '🗑️', '🐀'];
const BOOST_ART = '💨';

/**
 * Sneaker Chase — somebody grabbed a pair and ran. Three lanes, oncoming
 * traffic, a stamina bar that drains whether you like it or not. Arrow keys,
 * A/D, or the on-screen pads.
 */
const SneakerChase: React.FC<{
    thief?: string;
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ thief = 'The Game', onFinish, onQuit }) => {
    const [lane, setLane] = useState(1);
    const [rows, setRows] = useState<Row[]>([]);
    const [distance, setDistance] = useState(0);
    const [stamina, setStamina] = useState(100);
    const [done, setDone] = useState<null | boolean>(null);
    const [flash, setFlash] = useState(false);

    const laneRef = useRef(lane);
    laneRef.current = lane;
    const rowId = useRef(0);

    const move = useCallback((dir: -1 | 1) => {
        setLane(l => Math.max(0, Math.min(LANES - 1, l + dir)));
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') { e.preventDefault(); move(-1); }
            if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') { e.preventDefault(); move(1); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [move]);

    useEffect(() => {
        if (done !== null) return;

        const interval = setInterval(() => {
            setRows(prev => {
                // Advance rows toward the runner.
                let next = prev.map(r => ({ ...r, y: r.y + 1 }));

                // Collisions resolve on the row that reaches the player.
                const hit = next.find(r => r.y === TRACK_ROWS - 1);
                if (hit) {
                    const cell = hit.cells[laneRef.current];
                    if (cell === 'hazard') {
                        setStamina(s => Math.max(0, s - 22));
                        setFlash(true);
                        setTimeout(() => setFlash(false), 180);
                    } else if (cell === 'boost') {
                        setStamina(s => Math.min(100, s + 16));
                        setDistance(d => d + 4);
                    }
                }

                next = next.filter(r => r.y < TRACK_ROWS);

                // Spawn a new row at the top, always leaving one clear lane.
                if (next.length === 0 || next[next.length - 1].y >= 2) {
                    const clear = Math.floor(Math.random() * LANES);
                    const cells: Cell[] = Array.from({ length: LANES }, (_, i) => {
                        if (i === clear) return Math.random() < 0.16 ? 'boost' : 'empty';
                        return Math.random() < 0.62 ? 'hazard' : 'empty';
                    });
                    next.push({ id: rowId.current++, cells, y: 0 });
                }

                return next;
            });

            setDistance(d => d + 1);
            setStamina(s => Math.max(0, s - 1.1));
        }, TICK_MS);

        return () => clearInterval(interval);
    }, [done]);

    useEffect(() => {
        if (done !== null) return;
        if (stamina <= 0) setDone(false);
        else if (distance >= WIN_DISTANCE) setDone(true);
    }, [stamina, distance, done]);

    if (done !== null) {
        return (
            <MiniGameShell title="Sneaker Chase" subtitle="Result">
                <MiniGameResult
                    won={done}
                    headline={done ? 'You Caught Him' : 'He Got Away'}
                    detail={done
                        ? `${thief} runs out of road and hands the box back, wheezing and apologising.`
                        : `You stop, hands on knees, in the middle of traffic. ${thief} is gone.`}
                    onClose={() => onFinish(done, done ? `You ran down ${thief}.` : `${thief} escaped.`)}
                />
            </MiniGameShell>
        );
    }

    const progress = Math.min(100, (distance / WIN_DISTANCE) * 100);

    return (
        <MiniGameShell
            title="Sneaker Chase"
            subtitle={`Chasing ${thief} — ←/→ or A/D`}
            onQuit={onQuit}
            quitLabel="Give Up"
        >
            <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <div className="flex justify-between label mb-1"><span>Distance</span><span className="numeric">{Math.round(progress)}%</span></div>
                    <div className="meter h-2"><i style={{ width: `${progress}%`, background: 'var(--accent)' }} /></div>
                </div>
                <div>
                    <div className="flex justify-between label mb-1"><span>Stamina</span><span className="numeric">{Math.round(stamina)}</span></div>
                    <div className="meter h-2"><i style={{ width: `${stamina}%`, background: stamina > 35 ? 'var(--warn)' : 'var(--bad)' }} /></div>
                </div>
            </div>

            {/* Track */}
            <div
                className={`relative panel bg-[var(--bg-sunken)] overflow-hidden mb-3 ${flash ? 'animate-shake' : ''}`}
                style={{ height: `${TRACK_ROWS * 24}px` }}
            >
                {/* Lane dividers */}
                {Array.from({ length: LANES - 1 }, (_, i) => (
                    <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-dashed border-[var(--line)]"
                        style={{ left: `${((i + 1) / LANES) * 100}%` }}
                    />
                ))}

                {rows.map(row => (
                    <div key={row.id} className="absolute left-0 right-0 flex" style={{ top: `${row.y * 24}px`, height: '24px' }}>
                        {row.cells.map((cell, i) => (
                            <div key={i} className="flex-1 flex items-center justify-center text-base leading-none">
                                {cell === 'hazard' ? HAZARD_ART[(row.id + i) % HAZARD_ART.length] : cell === 'boost' ? BOOST_ART : ''}
                            </div>
                        ))}
                    </div>
                ))}

                {/* Runner */}
                <div
                    className="absolute flex items-center justify-center text-xl transition-all duration-100"
                    style={{
                        bottom: 0, height: '24px',
                        left: `${(lane / LANES) * 100}%`,
                        width: `${100 / LANES}%`,
                        filter: flash ? 'hue-rotate(320deg) brightness(1.6)' : 'none',
                    }}
                >
                    🏃
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button className="btn !py-4 text-xl" onClick={() => move(-1)}>◀</button>
                <button className="btn !py-4 text-xl" onClick={() => move(1)}>▶</button>
            </div>
        </MiniGameShell>
    );
};

export default SneakerChase;
