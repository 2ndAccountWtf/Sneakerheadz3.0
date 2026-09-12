import React, { useState } from 'react';
import type { CelebrityProfile } from '../../types/npcs';
import type { AmbientNpcProfile } from '../../types/interactions';

interface InStoreNpcRailProps {
    ambient: AmbientNpcProfile[];
    cameo: CelebrityProfile | null;
    onNpcClick: (npc: AmbientNpcProfile | CelebrityProfile) => void;
}

const BROWSING_LINES = [
    'is browsing the shelves.',
    'is checking out the new drops.',
    'is deep in thought.',
    'is eyeing the grails.',
    'has been holding the same shoe for nine minutes.',
];

const getQuote = (npc: CelebrityProfile | AmbientNpcProfile): string | null => {
    if ('dialogue' in npc && npc.dialogue) {
        const lines = Object.values(npc.dialogue).flat();
        if (lines.length) return lines[Math.floor(Math.random() * lines.length)];
    }
    return null;
};

const canInteract = (npc: AmbientNpcProfile | CelebrityProfile): boolean => {
    if ('scenarios' in npc && npc.scenarios?.length) return true;
    if ('eventTriggers' in npc && npc.eventTriggers) return npc.eventTriggers.some(t => 'startNode' in t);
    return false;
};

/**
 * Who else is in the shop. This was a fixed-position overlay pinned to the
 * top-left of the viewport, which put it straight through the HUD on every
 * screen size; it now sits in the page flow under the stock grid.
 */
export const InStoreNpcRail: React.FC<InStoreNpcRailProps> = ({ ambient, cameo, onNpcClick }) => {
    const [open, setOpen] = useState(true);
    const all = cameo ? [cameo, ...ambient] : ambient;

    if (all.length === 0) return null;

    return (
        <div className="panel mt-5">
            <button className="panel-head w-full" onClick={() => setOpen(o => !o)}>
                <span className="label">In this store · {all.length}</span>
                <span className="label">{open ? '[ − ]' : '[ + ]'}</span>
            </button>

            {open && (
                <div className="divide-y divide-[var(--line)]">
                    {all.map(npc => {
                        const isCameo = 'bio' in npc;
                        const quote = getQuote(npc);
                        const interactive = canInteract(npc);

                        return (
                            <button
                                key={npc.id}
                                onClick={() => interactive && onNpcClick(npc)}
                                disabled={!interactive}
                                className={`w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors ${interactive ? 'hover:bg-white/[0.03]' : 'cursor-default'}`}
                            >
                                <img
                                    src={npc.portraitUrl}
                                    alt=""
                                    className="w-9 h-9 object-cover border border-[var(--line)] flex-shrink-0 saturate-50"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-sm font-semibold ${isCameo ? 'text-[var(--legend)]' : 'text-white'}`}>
                                            {npc.name}
                                        </span>
                                        {isCameo && <span className="chip !text-[9px] !py-0" style={{ borderColor: 'var(--legend)', color: 'var(--legend)' }}>CAMEO</span>}
                                        {interactive && <span className="label">tap to talk</span>}
                                    </div>
                                    <p className="text-xs text-[var(--ink-dim)] italic mt-0.5 line-clamp-2">
                                        {quote ? `“${quote}”` : BROWSING_LINES[npc.id.length % BROWSING_LINES.length]}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
