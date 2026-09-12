import React from 'react';
import type { Btn } from './useInput';

interface TouchPadProps {
    onDown: (btn: Btn, down: boolean) => void;
    /** Labels for the two action buttons, e.g. ['Shoot', 'Jump']. */
    actions?: [string, string];
    /** Hide the vertical arrows for side-on games that don't use them. */
    vertical?: boolean;
}

const Pad: React.FC<{
    btn: Btn;
    label: string;
    onDown: TouchPadProps['onDown'];
    className?: string;
    primary?: boolean;
}> = ({ btn, label, onDown, className = '', primary }) => {
    // pointer events cover mouse, touch and pen in one path; pointer capture
    // keeps a held button held if the finger drifts off it mid-press.
    const press = (e: React.PointerEvent) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        onDown(btn, true);
    };
    const release = (e: React.PointerEvent) => {
        e.preventDefault();
        onDown(btn, false);
    };

    return (
        <button
            type="button"
            aria-label={label}
            onPointerDown={press}
            onPointerUp={release}
            onPointerCancel={release}
            onPointerLeave={release}
            onContextMenu={e => e.preventDefault()}
            className={`select-none no-tap-highlight flex items-center justify-center font-mono uppercase
                        border active:brightness-150 touch-none
                        ${primary
                            ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10 text-[10px] tracking-wider'
                            : 'border-[var(--line-bright)] text-[var(--ink-dim)] bg-[var(--bg-raised)] text-base'}
                        ${className}`}
        >
            {label}
        </button>
    );
};

/**
 * On-screen controls. Always rendered — a mini-game that only works with a
 * keyboard is unplayable for anyone on a phone, which is most of them.
 */
export const TouchPad: React.FC<TouchPadProps> = ({ onDown, actions = ['A', 'B'], vertical = true }) => (
    <div className="flex items-end justify-between gap-4 mt-3 sm:mt-4">
        {/* D-pad */}
        <div className="grid grid-cols-3 grid-rows-3 gap-1 w-[132px] flex-shrink-0">
            <div />
            {vertical ? <Pad btn="up" label="▲" onDown={onDown} className="h-10" /> : <div />}
            <div />
            <Pad btn="left" label="◀" onDown={onDown} className="h-10" />
            <div />
            <Pad btn="right" label="▶" onDown={onDown} className="h-10" />
            <div />
            {vertical ? <Pad btn="down" label="▼" onDown={onDown} className="h-10" /> : <div />}
            <div />
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
            <Pad btn="b" label={actions[1]} onDown={onDown} primary className="w-16 h-16 rounded-full" />
            <Pad btn="a" label={actions[0]} onDown={onDown} primary className="w-16 h-16 rounded-full" />
        </div>
    </div>
);

export default TouchPad;
