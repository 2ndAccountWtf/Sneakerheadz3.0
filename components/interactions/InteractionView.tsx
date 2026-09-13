import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../hooks/useGame';
import { refusesYou } from '../../systems/npc/reactions';
import { callback } from '../../systems/npc/memory';
import { findInteractionData } from '../../data/npcs';
import { ScenarioNode } from '../../types/interactions';
import Img from '../Img';

// --- TYPEWRITER HOOK ---
const useTypewriter = (text: string, speed: number = 22) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const index = useRef(0);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        setDisplayedText('');
        setIsComplete(false);
        index.current = 0;

        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = window.setInterval(() => {
            if (index.current < text.length) {
                // Reveal a few characters per tick so long speeches don't drag.
                const step = text.length > 220 ? 3 : 1;
                setDisplayedText(text.slice(0, index.current + step));
                index.current += step;
            } else {
                setIsComplete(true);
                if (timerRef.current) clearInterval(timerRef.current);
            }
        }, speed);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [text, speed]);

    const complete = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setDisplayedText(text);
        setIsComplete(true);
    };

    return { displayedText, isComplete, complete };
};

const TONE_STYLES: Record<string, string> = {
    good: 'text-[var(--ok)] border-[var(--ok)]',
    bad: 'text-[var(--bad)] border-[var(--bad)]',
    neutral: 'text-[var(--ink-dim)] border-[var(--line)]',
};

/**
 * The one placeholder authored dialogue may contain. Exported so
 * `tests/content.test.mts` checks against the literal this file actually
 * resolves, rather than against a copy of it that could drift.
 */
export const GREETING_TOKEN = '{{random_greeting}}';

const InteractionView: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const { activeInteraction, outcomeLog, activeMiniGame } = gameState;
    const emergency = gameState.player.emergency;

    const npcId = activeInteraction?.npcId ?? '';
    const scenarioId = activeInteraction?.scenarioId ?? '';
    const currentNodeId = activeInteraction?.currentNodeId ?? '';

    const { npc, scenario } = activeInteraction
        ? findInteractionData(npcId, scenarioId)
        : { npc: null, scenario: null };
    const node: ScenarioNode | undefined = scenario?.nodes[currentNodeId];

    // Resolve the line once per node so the typewriter doesn't reshuffle a
    // random greeting on every render.
    const [resolvedLine, setResolvedLine] = useState('');
    useEffect(() => {
        if (!node) {
            setResolvedLine('');
            return;
        }
        let line = node.npcLine;
        // Matched as a token anywhere in the line, not by whole-string
        // equality. The equality check worked only while every author wrote
        // the placeholder completely bare — one line reading
        // "{{random_greeting}} Long time." or carrying a stray trailing space
        // would have shipped the raw braces to the player with nothing to
        // catch it. `tests/content.test.mts` now also fails the build if any
        // authored line contains a {{token}} nothing knows how to resolve.
        if (line.includes(GREETING_TOKEN)) {
            // The authored pool stays the base, because that is where the
            // character's actual voice lives — a generic attitude tier would
            // flatten Bro Jogan and ADC into the same person. What memory adds
            // is a second sentence: the callback to whatever passed between you
            // ("You still owe me five dollars. Separately from the OTHER five
            // dollars."), and, if they have stopped dealing with you entirely,
            // why.
            let base = '...';
            if (npc && 'dialogue' in npc && npc.dialogue) {
                const allLines = Object.values(npc.dialogue).flat();
                if (allLines.length) base = allLines[Math.floor(Math.random() * allLines.length)];
            }

            const memory = callback(gameState.player, npcId);
            const refusal = refusesYou(gameState.player, npcId);
            const greeting = [
                base,
                memory,
                refusal.refuses && refusal.reason !== memory ? refusal.reason : null,
            ].filter(Boolean).join(' ');
            line = line.split(GREETING_TOKEN).join(greeting).trim();
        }
        setResolvedLine(line);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, npcId, scenarioId, currentNodeId]);

    const { displayedText, isComplete, complete } = useTypewriter(resolvedLine || '...', 22);

    // Apply the node's authored outcomes exactly once, on arrival. Until now
    // these were rendered as flavour and then discarded.
    const appliedRef = useRef<string>('');
    useEffect(() => {
        if (!activeInteraction || !node) return;
        const key = `${npcId}:${scenarioId}:${currentNodeId}`;
        if (appliedRef.current === key) return;
        appliedRef.current = key;

        if (node.outcomes && node.outcomes.length > 0) {
            dispatch({
                type: 'APPLY_OUTCOMES',
                payload: { outcomes: node.outcomes, sourceName: npc?.name },
            });
        }

        // The gas meter expresses itself at the worst possible moment. Rolled
        // per node, deliberately rare, and every NPC reacts in character.
        dispatch({ type: 'GAS_INCIDENT', payload: { npcId } });
    }, [activeInteraction, node, npcId, scenarioId, currentNodeId, npc, dispatch]);

    // A mini-game takes the stage; the conversation waits behind it.
    if (activeMiniGame) return null;
    if (!activeInteraction) return null;

    if (!npc || !scenario || !node) {
        return null;
    }

    const handleChoice = (nextNodeId: string) => {
        dispatch({ type: 'PROGRESS_INTERACTION', payload: { nextNodeId } });
    };

    const handleEnd = () => dispatch({ type: 'END_INTERACTION' });

    const handleBackdropClick = () => {
        if (!isComplete) complete();
    };

    const isTerminal = !node.choices || node.choices.length === 0;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6"
            onClick={handleBackdropClick}
        >
            <div
                className="crt-panel relative w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col sm:flex-row"
                onClick={e => e.stopPropagation()}
            >
                {/* PORTRAIT */}
                <div className="relative sm:w-1/3 w-full h-32 sm:h-auto sm:min-h-[26rem] bg-black border-b-2 sm:border-b-0 sm:border-r-2 border-[var(--line)] overflow-hidden flex-shrink-0">
                    <div className="absolute inset-0 scanlines pointer-events-none z-10" />
                    <Img
                        fallback="🧍"
                        src={npc.portraitUrl || 'https://picsum.photos/seed/placeholder/300'}
                        alt={npc.name}
                        className="w-full h-full object-cover object-top opacity-90 contrast-125 saturate-50"
                    />
                    <div className="absolute bottom-0 left-0 w-full bg-black/85 border-t border-[var(--line)] px-3 py-2 z-20">
                        <h2 className="font-display text-base sm:text-lg text-[var(--accent)] tracking-wider uppercase leading-tight truncate">
                            {npc.name}
                        </h2>
                        <div className="text-[9px] text-[var(--ink-dim)] font-mono uppercase tracking-[0.2em] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-[var(--ok)] rounded-full animate-pulse" />
                            Transmitting
                        </div>
                    </div>
                </div>

                {/* DIALOGUE */}
                <div className="flex-1 flex flex-col p-4 sm:p-5 min-h-0">
                    <div
                        className="flex-grow overflow-y-auto mb-4 font-mono text-sm sm:text-base text-[var(--ink)] leading-relaxed cursor-pointer whitespace-pre-line"
                        onClick={handleBackdropClick}
                    >
                        <span className="text-[var(--accent)] font-bold mr-2">{'>'}</span>
                        {displayedText}
                        {!isComplete && <span className="inline-block w-2 h-4 bg-[var(--accent)] ml-1 animate-pulse align-middle" />}
                    </div>

                    {/* You are not at your best right now, and it shows. */}
                    {emergency && (
                        <div
                            className="mb-2 px-3 py-1.5 border text-[11px] font-mono flex items-center gap-2 flex-shrink-0"
                            style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}
                        >
                            <span>🚨</span>
                            <span>You are visibly distracted. They have noticed and are choosing not to mention it.</span>
                        </div>
                    )}

                    {/* OUTCOME RECEIPT */}
                    {isComplete && outcomeLog.length > 0 && (
                        <div className="mb-3 border border-[var(--line)] bg-black/50 divide-y divide-[var(--line)] max-h-40 overflow-y-auto flex-shrink-0">
                            {outcomeLog.map((entry, i) => (
                                <div
                                    key={i}
                                    className={`flex items-start gap-2 px-3 py-1.5 text-xs font-mono ${TONE_STYLES[entry.tone]}`}
                                >
                                    <span className="flex-shrink-0">{entry.icon}</span>
                                    <span className="flex-1">{entry.text}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={`flex flex-col gap-2 mt-auto flex-shrink-0 transition-opacity duration-300 ${isComplete ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        {node.choices?.map((choice, index) => (
                            <button
                                key={index}
                                onClick={() => handleChoice(choice.next)}
                                className="group w-full text-left px-3 py-2.5 bg-white/[0.03] border border-[var(--line)] hover:bg-[var(--accent)]/10 hover:border-[var(--accent)] transition-colors"
                            >
                                <span className="text-[10px] text-[var(--ink-dim)] group-hover:text-[var(--accent)] font-mono mr-2">
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <span className="text-sm text-[var(--ink)] group-hover:text-white">{choice.playerLine}</span>
                            </button>
                        ))}

                        {isTerminal && (
                            <button onClick={handleEnd} className="btn-primary w-full">
                                End Transmission
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InteractionView;
