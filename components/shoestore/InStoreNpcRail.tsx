
import React, { useState } from 'react';
import type { CelebrityProfile } from '../../types/npcs';
import type { AmbientNpcProfile } from '../../types/interactions';
import { Scenario } from '../../types/interactions';

interface InStoreNpcRailProps {
    ambient: AmbientNpcProfile[];
    cameo: CelebrityProfile | null;
    onNpcClick: (npc: AmbientNpcProfile | CelebrityProfile) => void;
}

const getRandomQuote = (npc: CelebrityProfile | AmbientNpcProfile): string => {
    // Check if the NPC has a dialogue property (Celebrities always do, updated Ambient NPCs might)
    if ('dialogue' in npc && npc.dialogue) {
        const allLines = Object.values(npc.dialogue).flat();
        if (allLines.length > 0) {
            return allLines[Math.floor(Math.random() * allLines.length)];
        }
    }
    // Fallback for basic Ambient NPCs without custom dialogue
    return `...is staring intently at a shoe wall.`;
};

const BROWSING_LINES = [
    'is browsing the shelves.',
    'is checking out the new drops.',
    'is deep in thought.',
    'is eyeing the grails.',
];
const getRandomLine = () => BROWSING_LINES[Math.floor(Math.random() * BROWSING_LINES.length)];

const hasInteractions = (npc: AmbientNpcProfile | CelebrityProfile): boolean => {
    if ('scenarios' in npc && npc.scenarios && npc.scenarios.length > 0) {
        return true;
    }
    if ('eventTriggers' in npc && npc.eventTriggers) {
        return npc.eventTriggers.some(trigger => 'startNode' in trigger);
    }
    return false;
};

export const InStoreNpcRail: React.FC<InStoreNpcRailProps> = ({ ambient, cameo, onNpcClick }) => {
    const [isMinimized, setIsMinimized] = useState(false);

    const allNpcs = cameo ? [cameo, ...ambient] : ambient;

    if (allNpcs.length === 0) {
        return null;
    }

    return (
        <div className="fixed top-4 left-4 bg-gray-900/80 p-3 border-2 border-cyan-500/50 rounded-lg shadow-lg w-64 z-30 backdrop-blur-sm flex flex-col gap-2 transition-all duration-300">
            <div className="flex justify-between items-center border-b border-gray-600 mb-1 pb-2">
                <h4 className="text-sm font-bold uppercase tracking-wider text-cyan-400">In Store ({allNpcs.length})</h4>
                <button 
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="text-cyan-400 hover:text-white text-lg font-mono"
                    aria-label={isMinimized ? "Expand NPC list" : "Minimize NPC list"}
                >
                    {isMinimized ? '[+]' : '[—]'}
                </button>
            </div>
            
            {!isMinimized && allNpcs.map(npc => {
                const isCameo = 'bio' in npc;
                const hasCustomDialogue = 'dialogue' in npc && npc.dialogue;
                const canInteract = hasInteractions(npc);

                return (
                    <button 
                        key={npc.id}
                        onClick={() => canInteract && onNpcClick(npc)}
                        disabled={!canInteract}
                        className={`w-full text-left p-2 rounded transition-colors duration-200 ${canInteract ? 'hover:bg-cyan-500/20 cursor-pointer' : 'cursor-default'}`}
                    >
                        {isCameo ? (
                            <div className="text-yellow-300 animate-pulse">
                                <p className="font-bold">{npc.name} is here!</p>
                                <p className="text-xs text-gray-300 mt-1 italic">"{getRandomQuote(npc)}"</p>
                            </div>
                        ) : (
                             <div className="text-sm text-gray-400">
                                <span className="font-semibold text-white">{npc.name}</span>
                                {hasCustomDialogue ? (
                                     <p className="text-xs text-gray-500 mt-1 italic">"{getRandomQuote(npc)}"</p>
                                ) : (
                                     <span className="ml-1">{getRandomLine()}</span>
                                )}
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
};
