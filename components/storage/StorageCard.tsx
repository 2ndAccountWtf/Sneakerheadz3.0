
import React, { useState } from 'react';
import type { StorageItem } from '../../types';
import { storageTheme } from './storage.theme';

interface StorageCardProps {
    item: StorageItem;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onUseItem: (itemId: string) => void;
}

const RarityIndicator: React.FC<{ rarity: StorageItem['rarity'] }> = ({ rarity }) => (
    <div 
        className="h-full w-1"
        style={{ backgroundColor: storageTheme.rarityColors[rarity], boxShadow: `0 0 5px ${storageTheme.rarityColors[rarity]}` }}
    />
);

const getActions = (item: StorageItem) => {
    let primaryAction: string;
    switch (item.type) {
        case 'food':
            primaryAction = 'Eat';
            break;
        case 'drinks':
            primaryAction = 'Drink';
            break;
        case 'weapons':
        case 'tools':
            primaryAction = 'Equip';
            break;
        case 'oddities':
        default:
            primaryAction = 'Use';
    }

    const overflowActions: string[] = ['Inspect', 'Drop'];
    if (item.stackable && item.qty > 1) {
        overflowActions.unshift('Split');
    }

    return { primaryAction, overflowActions };
};

export const StorageCard: React.FC<StorageCardProps> = ({ item, isExpanded, onToggleExpand, onUseItem }) => {
    const typeColor = storageTheme.typeColors[item.type];
    const { primaryAction } = getActions(item);
    const isConsumable = ['Eat', 'Drink', 'Use'].includes(primaryAction);
    
    const [consumptionState, setConsumptionState] = useState<'idle' | 'consuming' | 'done'>('idle');

    const handlePrimaryAction = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isConsumable) {
            // Start animation
            setConsumptionState('consuming');
            
            // Duration of animation (matches CSS)
            setTimeout(() => {
                setConsumptionState('done');
                // Trigger logic shortly after visual completion
                setTimeout(() => {
                     onUseItem(item.id);
                     setConsumptionState('idle');
                }, 100);
            }, 1000);
        } else {
            alert(`Function [${primaryAction.toUpperCase()}] not yet implemented for ${item.name}.`);
        }
    };

    const isConsuming = consumptionState === 'consuming';

    const css = `
        @keyframes glitch-anim-1 {
            0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px, 1px); }
            20% { clip-path: inset(60% 0 10% 0); transform: translate(2px, -1px); }
            40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px, 2px); }
            60% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -2px); }
            80% { clip-path: inset(10% 0 70% 0); transform: translate(-1px, 1px); }
            100% { clip-path: inset(30% 0 50% 0); transform: translate(1px, -1px); }
        }
        @keyframes scan-sweep {
            0% { top: -20%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 120%; opacity: 0; }
        }
        @keyframes progress-fill {
            0% { width: 0%; }
            100% { width: 100%; }
        }
        .glitch-effect {
            animation: glitch-anim-1 0.2s infinite linear alternate-reverse;
            filter: contrast(1.5) brightness(1.2);
        }
        .scanline {
            position: absolute;
            left: 0;
            right: 0;
            height: 20px;
            background: linear-gradient(to bottom, transparent, ${storageTheme.colors.volt}, transparent);
            z-index: 20;
            opacity: 0;
            pointer-events: none;
        }
        .consuming .scanline {
            animation: scan-sweep 1s linear forwards;
        }
    `;

    return (
        <div 
            className={`
                group relative flex flex-col bg-[#111] border border-[#222] hover:border-[#444] transition-all duration-200 overflow-hidden
                ${isExpanded ? 'col-span-1 md:col-span-2 row-span-2 z-10 shadow-[0_0_30px_rgba(0,0,0,0.8)] border-[#ccff00]' : 'hover:-translate-y-1 hover:shadow-lg'}
                ${isConsuming ? 'consuming border-[#ccff00]' : ''}
            `}
            style={{ minHeight: isExpanded ? 'auto' : '140px' }}
            onClick={onToggleExpand}
        >
            <style>{css}</style>

            {/* Scanline Overlay */}
            <div className="scanline"></div>

            {/* Rarity Strip */}
            <div className="absolute left-0 top-0 bottom-0 w-1">
                <RarityIndicator rarity={item.rarity} />
            </div>

            {/* Header / Collapsed View */}
            <div className="pl-5 p-4 flex items-start justify-between w-full relative">
                <div className="flex-grow relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-1 bg-[#222] text-[#888]" style={{ fontFamily: storageTheme.fonts.mono }}>
                            {item.type}
                        </span>
                        {item.qty > 1 && (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-1 bg-[#ccff00] text-black" style={{ fontFamily: storageTheme.fonts.mono }}>
                                x{item.qty}
                            </span>
                        )}
                    </div>
                    <h3 className="text-lg font-bold leading-tight text-white uppercase truncate pr-2" style={{ fontFamily: storageTheme.fonts.body }}>
                        {item.name}
                    </h3>
                </div>
                
                {/* Thumbnail */}
                <div className={`w-12 h-12 bg-[#000] border border-[#333] p-0.5 flex-shrink-0 relative overflow-hidden ${isConsuming ? 'glitch-effect' : ''}`}>
                    <img 
                        src={item.img} 
                        alt={item.name} 
                        className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all" 
                    />
                    {isConsuming && <div className="absolute inset-0 bg-[#ccff00] mix-blend-multiply opacity-50"></div>}
                </div>
            </div>

            {/* Stats Mini (Collapsed) */}
            {!isExpanded && (
                <div className="mt-auto pl-5 p-4 pt-0">
                     <div className="flex gap-4 text-[10px] text-[#555] font-mono">
                        {item.stats.energy > 0 && <span>NRG {item.stats.energy}</span>}
                        {item.stats.power > 0 && <span>PWR {item.stats.power}</span>}
                        {item.stats.risk > 0 && <span>RSK {item.stats.risk}</span>}
                     </div>
                </div>
            )}

            {/* Expanded Content */}
            {isExpanded && (
                <div className="pl-5 p-4 pt-0 flex flex-col h-full animate-fade-in">
                    <div className="w-full h-[1px] bg-[#333] mb-4"></div>
                    
                    <p className="text-sm text-[#999] italic mb-4 border-l-2 border-[#333] pl-3">
                        "{item.flavor}"
                    </p>
                    
                    <div className="grid grid-cols-3 gap-2 mb-6">
                        {Object.entries(item.stats).map(([key, value]) => (
                            (value as number) > 0 && (
                                <div key={key} className="bg-[#080808] border border-[#222] p-2 flex flex-col items-center justify-center">
                                    <span className="text-[9px] text-[#555] uppercase tracking-wider" style={{ fontFamily: storageTheme.fonts.mono }}>{key}</span>
                                    <span className="text-lg font-bold text-[#ccff00]" style={{ fontFamily: storageTheme.fonts.mono }}>{value as number}</span>
                                </div>
                            )
                        ))}
                    </div>

                    <div className="mt-auto flex gap-2">
                        <button
                            onClick={handlePrimaryAction}
                            disabled={item.qty === 0 || isConsuming}
                            className={`
                                relative flex-1 py-3 font-bold uppercase tracking-widest text-sm transition-colors flex items-center justify-center gap-2 overflow-hidden
                                ${isConsuming ? 'bg-black text-[#ccff00] border border-[#ccff00]' : 'bg-[#ccff00] hover:bg-white text-black'}
                            `}
                            style={{ fontFamily: storageTheme.fonts.header }}
                        >
                            {isConsuming && (
                                <div 
                                    className="absolute inset-0 bg-[#ccff00] opacity-20"
                                    style={{ animation: 'progress-fill 1s linear forwards', transformOrigin: 'left' }}
                                />
                            )}
                            <span className="relative z-10">
                                {isConsuming ? 'DIGESTING...' : primaryAction}
                            </span>
                        </button>
                        
                        <button
                            onClick={(e) => { e.stopPropagation(); /* Placeholder */ }}
                            className="w-12 bg-[#222] hover:bg-[#333] text-[#666] border border-[#333] flex items-center justify-center"
                        >
                            <span className="text-xl">⋮</span>
                        </button>
                    </div>
                    
                    <div className="mt-2 text-right">
                        <span className="text-[9px] text-[#444] font-mono">ID: {item.id.toUpperCase()}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
