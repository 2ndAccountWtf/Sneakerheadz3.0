import React, { useState } from 'react';
import { MiniGameShell } from '../MiniGameShell';
import { GameCanvas } from './GameCanvas';
import { TouchPad } from './TouchPad';
import type { Btn } from './useInput';
import type { Weapon } from '../../../systems/weapons';

interface ArcadeShellProps {
    title: string;
    subtitle?: string;
    width: number;
    height: number;
    running: boolean;
    onFrame: (ctx: CanvasRenderingContext2D, dt: number, elapsed: number) => void;
    onInput: (btn: Btn, down: boolean) => void;
    actions?: [string, string];
    vertical?: boolean;
    onQuit?: () => void;
    quitLabel?: string;
    /** Weapons the player brought; rendered as a selectable rail. */
    loadout?: Weapon[];
    selectedWeapon?: string;
    onSelectWeapon?: (id: string) => void;
    /** Rendered above the canvas — score, timer, etc. */
    hud?: React.ReactNode;
    /** Overlay shown on top of the canvas (results, "get ready"). */
    overlay?: React.ReactNode;
    help?: string;
}

/**
 * The cabinet every canvas game sits in: framed title bar, the pixel canvas,
 * on-screen controls, and the AM/PM weapon rail. Individual games only worry
 * about what happens inside `onFrame`.
 */
export const ArcadeShell: React.FC<ArcadeShellProps> = ({
    title, subtitle, width, height, running, onFrame, onInput,
    actions = ['A', 'B'], vertical = true, onQuit, quitLabel,
    loadout = [], selectedWeapon, onSelectWeapon, hud, overlay, help,
}) => {
    const [showHelp, setShowHelp] = useState(false);

    return (
        <MiniGameShell title={title} subtitle={subtitle} onQuit={onQuit} quitLabel={quitLabel}>
            {hud && <div className="mb-2">{hud}</div>}

            <div className="relative">
                <GameCanvas width={width} height={height} running={running} onFrame={onFrame} />
                {overlay && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]">
                        {overlay}
                    </div>
                )}
            </div>

            {/* AM/PM weapon rail */}
            {loadout.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto scrollbar-hide">
                    <span className="label flex-shrink-0">Kit</span>
                    {loadout.map(w => (
                        <button
                            key={w.id}
                            onClick={() => onSelectWeapon?.(w.id)}
                            title={`${w.name} — ${w.flavor}`}
                            className={`chip flex-shrink-0 ${selectedWeapon === w.id ? 'chip-accent' : ''}`}
                        >
                            <span>{w.glyph}</span>
                            <span>{w.short}</span>
                        </button>
                    ))}
                </div>
            )}

            <TouchPad onDown={onInput} actions={actions} vertical={vertical} />

            {help && (
                <div className="mt-2">
                    <button className="label hover:text-[var(--ink)]" onClick={() => setShowHelp(h => !h)}>
                        {showHelp ? '▾ Controls' : '▸ Controls'}
                    </button>
                    {showHelp && <p className="text-[11px] text-[var(--ink-dim)] font-mono mt-1 leading-snug">{help}</p>}
                </div>
            )}
        </MiniGameShell>
    );
};

export default ArcadeShell;
