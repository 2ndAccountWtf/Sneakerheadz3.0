import React, { useEffect, useState } from 'react';
import { useGame } from '../../hooks/useGame';

const KIND_STYLE: Record<string, { ring: string; glow: string; tint: string }> = {
    'bibi-gift': { ring: 'var(--accent)', glow: 'rgba(0,229,192,0.35)', tint: 'from-[#00e5c0]/15' },
    'collab': { ring: 'var(--legend)', glow: 'rgba(255,204,77,0.4)', tint: 'from-[#ffcc4d]/20' },
    'disaster': { ring: 'var(--bad)', glow: 'rgba(255,71,71,0.4)', tint: 'from-[#ff4747]/20' },
};

const TONE_COLOR: Record<string, string> = {
    good: 'var(--ok)',
    bad: 'var(--bad)',
    neutral: 'var(--ink-dim)',
};

/**
 * Full-screen takeover for the rare, loud events. Lines land one at a time so
 * they read like a scene rather than a wall of text, and the payoff panel
 * spells out exactly what changed — the same receipt the dialogue modal uses.
 */
const CutsceneView: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const scene = gameState.activeCutscene;

    const [revealed, setRevealed] = useState(1);
    const [showEffects, setShowEffects] = useState(false);

    useEffect(() => {
        if (!scene) {
            setRevealed(1);
            setShowEffects(false);
            return;
        }
        setRevealed(1);
        setShowEffects(false);
    }, [scene?.id]);

    useEffect(() => {
        if (!scene) return;
        if (revealed >= scene.lines.length) {
            const t = setTimeout(() => setShowEffects(true), 500);
            return () => clearTimeout(t);
        }
        const t = setTimeout(() => setRevealed(r => r + 1), 1700);
        return () => clearTimeout(t);
    }, [scene, revealed]);

    if (!scene) return null;

    const style = KIND_STYLE[scene.kind] ?? KIND_STYLE['bibi-gift'];
    const isDisaster = scene.kind === 'disaster';

    const skip = () => {
        if (revealed < scene.lines.length) {
            setRevealed(scene.lines.length);
            setShowEffects(true);
        } else {
            setShowEffects(true);
        }
    };

    return (
        <div
            className={`fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6 bg-black/95 ${isDisaster ? 'animate-shake' : ''}`}
            onClick={skip}
        >
            {/* Radial stage light */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% 35%, ${style.glow}, transparent 65%)` }}
            />
            <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />

            <div
                className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto crt-panel p-5 sm:p-7"
                style={{ borderColor: style.ring }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start gap-4 mb-5">
                    {scene.portraitUrl && (
                        <img
                            src={scene.portraitUrl}
                            alt=""
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover border-2 flex-shrink-0 saturate-50 contrast-125"
                            style={{ borderColor: style.ring }}
                        />
                    )}
                    <div className="min-w-0">
                        <div className="label" style={{ color: style.ring }}>
                            {isDisaster ? 'Global Event' : scene.kind === 'collab' ? 'Ultra-Rare Event' : 'Rare Event'}
                        </div>
                        <h2
                            className="font-display text-xl sm:text-3xl uppercase leading-none mt-1"
                            style={{ color: style.ring, textShadow: `0 0 24px ${style.glow}` }}
                        >
                            {scene.title}
                        </h2>
                        {scene.subtitle && (
                            <p className="text-[var(--ink-dim)] text-sm mt-1.5 italic">{scene.subtitle}</p>
                        )}
                    </div>
                </div>

                {/* Script */}
                <div className="space-y-3 mb-5 min-h-[7rem]">
                    {scene.lines.slice(0, revealed).map((line, i) => (
                        <div key={i} className="animate-rise">
                            {line.speaker && (
                                <div className="label mb-0.5" style={{ color: style.ring }}>{line.speaker}</div>
                            )}
                            <p className={`leading-snug ${line.speaker ? 'text-base sm:text-lg text-white' : 'text-sm text-[var(--ink-dim)] italic'}`}>
                                {line.speaker ? `“${line.text}”` : line.text}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Payoff */}
                {showEffects && (
                    <div className="animate-rise">
                        <div className="label mb-2 border-t border-[var(--line)] pt-3">The Damage</div>
                        <div className="panel divide-y divide-[var(--line)] mb-5">
                            {scene.effects.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-[var(--ink-dim)] font-mono">Nothing measurable. Somehow.</div>
                            ) : scene.effects.map((e, i) => (
                                <div key={i} className="flex items-start gap-2.5 px-3 py-2 text-sm font-mono" style={{ color: TONE_COLOR[e.tone] }}>
                                    <span>{e.icon}</span>
                                    <span className="flex-1">{e.text}</span>
                                </div>
                            ))}
                        </div>
                        <button className="btn btn-primary w-full" onClick={() => dispatch({ type: 'HIDE_CUTSCENE' })}>
                            Continue
                        </button>
                    </div>
                )}

                {!showEffects && (
                    <p className="label text-center">Tap to skip</p>
                )}
            </div>
        </div>
    );
};

export default CutsceneView;
