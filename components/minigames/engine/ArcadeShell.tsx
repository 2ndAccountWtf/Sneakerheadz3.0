import React, { useState, useEffect, useRef } from 'react';
import { MiniGameShell } from '../MiniGameShell';
import { GameCanvas } from './GameCanvas';
import { TouchPad } from './TouchPad';
import { useFullscreen } from './useFullscreen';
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
    actions?: [string, string] | [string, string, string];
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

    // Fullscreen. The ref goes on the cabinet rather than on the canvas, so the
    // controls come with it — a fullscreen canvas with the d-pad left behind on
    // a page underneath is worse than not going fullscreen at all.
    const cabinetRef = useRef<HTMLDivElement | null>(null);
    const fs = useFullscreen(cabinetRef);

    // When the game ends, bring the result into view. The board sits inline in
    // a long scrolling page (the Arcade lists a dozen games below it), so on a
    // phone the card announcing you lost could easily be above or below the
    // fold at the moment it appeared.
    const boardRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (overlay) boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [overlay]);

    /**
     * Fullscreen is a different cabinet, not a bigger one.
     *
     * Inline, everything stacks: HUD, canvas, kit rail, d-pad, help. Stack that
     * on a landscape phone and the canvas gets whatever is left after four
     * other rows, which is a strip. So in fullscreen the canvas takes the whole
     * viewport and the controls float on top of it in the bottom corners, where
     * thumbs already are. Same components, same inputs — only the box changes.
     */
    const zone = fs.active
        ? 'fixed inset-0 z-50 flex flex-col bg-black'
        : '';

    const fsButton = fs.supported && (
        <button
            type="button"
            onClick={fs.toggle}
            aria-label={fs.active ? 'Leave fullscreen' : 'Play fullscreen'}
            title={fs.active ? 'Leave fullscreen' : 'Play fullscreen — turn your phone sideways'}
            className={fs.active
                ? 'absolute top-2 right-2 z-20 w-9 h-9 rounded bg-black/55 text-[var(--ink)] text-sm leading-none'
                : 'chip flex-shrink-0'}
        >
            {fs.active ? '✕' : '⛶ Full'}
        </button>
    );

    return (
        <MiniGameShell title={title} subtitle={subtitle} onQuit={onQuit} quitLabel={quitLabel}>
            <div ref={cabinetRef} className={zone}>
            {hud && !fs.active && <div className="mb-2">{hud}</div>}

            <div
                className={fs.active
                    ? 'relative flex-1 min-h-0 flex items-center justify-center'
                    : 'relative'}
                ref={boardRef}
            >
                <GameCanvas
                    width={width}
                    height={height}
                    running={running}
                    onFrame={onFrame}
                    fill={fs.active}
                />
                {/* Inline, the button lives in the footer row with the help
                    toggle; fullscreen there is no footer, so it sits over the
                    top-right corner of the picture. */}
                {fs.active && fsButton}
                {/* The controls ride over the picture in fullscreen: a phone
                    held sideways has no spare rows to give them, and the
                    bottom corners are where the thumbs already are. */}
                {fs.active && !overlay && (
                    <div className="absolute inset-x-0 bottom-0 z-10 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none">
                        <div className="pointer-events-auto opacity-90">
                            <TouchPad onDown={onInput} actions={actions} vertical={vertical} />
                        </div>
                    </div>
                )}
                {overlay && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]">
                        {overlay}
                    </div>
                )}
            </div>

            {/* AM/PM weapon rail */}
            {!overlay && !fs.active && loadout.length > 0 && (
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

            {/* The pad disappears with the game.

                It used to stay on screen under the result card, fully rendered
                and fully clickable, with the rest of the page scrolling below
                it — so a finished game looked like a live one with dead
                controls, and the only way out was a button you had to go and
                find. Reported as being stuck on the walk-off screen, and it
                was a fair description of what it looked like. */}
            {!overlay && !fs.active && <TouchPad onDown={onInput} actions={actions} vertical={vertical} />}

            {!overlay && !fs.active && (
                <div className="flex items-center gap-2 mt-2">
                    {help && (
                        <button className="label hover:text-[var(--ink)]" onClick={() => setShowHelp(h => !h)}>
                            {showHelp ? '▾ Controls' : '▸ Controls'}
                        </button>
                    )}
                    <span className="flex-1" />
                    {fsButton}
                </div>
            )}
            {!overlay && !fs.active && showHelp && help && (
                <p className="text-[11px] text-[var(--ink-dim)] font-mono mt-1 leading-snug">{help}</p>
            )}
            </div>
        </MiniGameShell>
    );
};

export default ArcadeShell;
