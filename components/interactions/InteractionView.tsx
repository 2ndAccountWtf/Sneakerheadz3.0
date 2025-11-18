
import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../../hooks/useGame';
import { findInteractionData } from '../../data/npcs';
import { ScenarioNode } from '../../types/interactions';

// --- TYPEWRITER HOOK ---
const useTypewriter = (text: string, speed: number = 30) => {
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
                setDisplayedText((prev) => prev + text.charAt(index.current));
                index.current++;
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

const InteractionView: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const { activeInteraction } = gameState;

    // If activeInteraction is null, render nothing
    if (!activeInteraction) return null;

    const { npcId, scenarioId, currentNodeId } = activeInteraction;
    const { npc, scenario } = findInteractionData(npcId, scenarioId);
    const node: ScenarioNode | undefined = scenario?.nodes[currentNodeId];

    // Ensure hook is called unconditionally at the top level
    // We'll handle the 'loading/error' state inside the rendering logic
    // But first, resolve the text.
    
    let resolvedLine = "";
    if (node) {
        resolvedLine = node.npcLine;
        // Handle dynamic random greetings
        if (resolvedLine === "{{random_greeting}}" && npc && 'dialogue' in npc) {
             // Aggregate all dialogue lines to ensure variety, as 'greeting' might be missing or limited
             // This unlocks the full library of text for characters like Bro Jogan and Yasser
             const allLines = Object.values(npc.dialogue).flat();
             if (allLines.length > 0) {
                resolvedLine = allLines[Math.floor(Math.random() * allLines.length)];
             } else {
                resolvedLine = "...";
             }
        }
    }

    // Use the hook
    const { displayedText, isComplete, complete } = useTypewriter(resolvedLine || "...", 20);

    if (!npc || !scenario || !node) {
        console.error("Interaction data missing!", activeInteraction);
        dispatch({ type: 'END_INTERACTION' });
        return null;
    }

    const handleChoice = (nextNodeId: string) => {
        dispatch({ type: 'PROGRESS_INTERACTION', payload: { nextNodeId } });
    };

    const handleEnd = () => {
        dispatch({ type: 'END_INTERACTION' });
    };

    const handleBackdropClick = () => {
        if (!isComplete) {
            complete();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={handleBackdropClick}>
            {/* Main Container */}
            <div 
                className="relative w-full max-w-3xl bg-[#09090b] border-2 border-cyan-500/60 shadow-[0_0_50px_rgba(0,255,247,0.15)] overflow-hidden flex flex-col md:flex-row"
                onClick={(e) => e.stopPropagation()}
                style={{ minHeight: '400px', clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%)' }}
            >
                {/* Background Grid FX */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-5 pointer-events-none"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 opacity-50"></div>

                {/* LEFT: Portrait Section */}
                <div className="relative md:w-1/3 w-full h-48 md:h-auto bg-gradient-to-b from-gray-900 to-black border-b-2 md:border-b-0 md:border-r-2 border-cyan-500/30 flex items-center justify-center overflow-hidden group">
                    {/* Scanline overlay on image */}
                    <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,255,247,0.05)_50%)] bg-[length:100%_4px] pointer-events-none z-10"></div>
                    
                    <img 
                        src={npc.portraitUrl || 'https://picsum.photos/seed/placeholder/300'} 
                        alt={npc.name} 
                        className="w-full h-full object-cover object-top opacity-90 group-hover:scale-105 transition-transform duration-1000 filter contrast-125" 
                    />
                    
                    {/* Name Tag */}
                    <div className="absolute bottom-0 left-0 w-full bg-black/80 backdrop-blur-sm border-t border-cyan-500/30 p-3 z-20">
                        <h2 className="text-xl font-['Orbitron'] font-bold text-cyan-400 tracking-wider uppercase drop-shadow-[0_0_5px_rgba(0,255,247,0.5)]">
                            {npc.name}
                        </h2>
                         <div className="text-[10px] text-gray-500 font-mono uppercase tracking-[0.2em] flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Online
                        </div>
                    </div>
                </div>

                {/* RIGHT: Dialogue Section */}
                <div className="flex-1 flex flex-col p-6 relative">
                    {/* Text Area */}
                    <div 
                        className="flex-grow mb-6 font-['Space_Mono'] text-lg text-gray-100 leading-relaxed cursor-pointer"
                        onClick={handleBackdropClick}
                    >
                        <span className="text-cyan-500 font-bold mr-2">{'>'}</span>
                        {displayedText}
                        {!isComplete && <span className="inline-block w-2 h-5 bg-cyan-500 ml-1 animate-pulse align-middle"></span>}
                    </div>

                    {/* Choices Container */}
                    <div className="flex flex-col gap-3 mt-auto">
                        <div className={`transition-opacity duration-500 ${isComplete ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            {node.choices && node.choices.map((choice, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleChoice(choice.next)}
                                    className="group w-full text-left px-4 py-3 bg-gray-800/50 border border-gray-700 hover:bg-cyan-900/20 hover:border-cyan-500/50 transition-all duration-200 relative overflow-hidden"
                                >
                                    <div className="absolute left-0 top-0 h-full w-1 bg-gray-600 group-hover:bg-cyan-400 transition-colors"></div>
                                    <span className="text-sm text-gray-400 group-hover:text-cyan-300 font-mono uppercase mr-3 opacity-50 group-hover:opacity-100 transition-opacity">0{index + 1}</span>
                                    <span className="text-gray-200 font-bold group-hover:text-white">{choice.playerLine}</span>
                                </button>
                            ))}

                            {node.outcomes && (
                                <button
                                    onClick={handleEnd}
                                    className="group w-full text-center px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-black font-bold uppercase tracking-widest clip-corner-br transition-colors shadow-[0_0_15px_rgba(0,255,247,0.3)]"
                                    style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                                >
                                    End Transmission
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {/* Decorative Tech Elements */}
                    <div className="absolute top-2 right-2 flex gap-1">
                        <div className="w-1 h-1 bg-gray-700"></div>
                        <div className="w-1 h-1 bg-gray-700"></div>
                        <div className="w-1 h-1 bg-gray-700"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InteractionView;
