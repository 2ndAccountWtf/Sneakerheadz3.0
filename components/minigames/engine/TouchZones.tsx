import React, { useCallback, useRef } from 'react';
import type { Btn } from './useInput';

/**
 * Fullscreen controls for a phone: a thumb-stick you can start anywhere, and
 * action buttons in the opposite corner.
 *
 * The d-pad is right for an inline canvas sitting in a page, where it has its
 * own row and nothing is behind it. Over a fullscreen picture it is the wrong
 * shape twice over. It occupies a fixed 132px square of the *game* -- on an
 * 844px-wide phone the player rides at about x=134, which is inside it -- and
 * it asks a thumb to find a 40px target it cannot see under its own hand,
 * while the thing it is steering is underneath.
 *
 * So the left half of the screen is the stick. Touch it anywhere and that point
 * becomes the centre; drag from there and the direction is the offset. Nothing
 * to aim at, nothing covering the player, and the thumb never has to travel
 * back to a home position. The faint ring drawn at the touch point is feedback,
 * not a target -- it appears where the thumb already is.
 *
 * Buttons stay buttons on the right. A fire button wants a place, not a
 * direction, and a thumb finds a corner without looking.
 */

/** How far from the touch origin counts as a full deflection, in CSS px. */
const THROW_PX = 34;
/** Inside this, the stick is centred and nothing is pressed. */
const DEAD_PX = 11;

type Dir = { left: boolean; right: boolean; up: boolean; down: boolean };
const NONE: Dir = { left: false, right: false, up: false, down: false };

export const TouchZones: React.FC<{
    onDown: (btn: Btn, down: boolean) => void;
    actions?: [string, string] | [string, string, string];
    /** Side-on games do not use up/down; the stick reports only left/right. */
    vertical?: boolean;
}> = ({ onDown, actions = ['A', 'B'], vertical = true }) => {
    const origin = useRef<{ id: number; x: number; y: number } | null>(null);
    const held = useRef<Dir>(NONE);
    const ringRef = useRef<HTMLDivElement>(null);

    /** Send only what changed, or the input layer sees a press every frame. */
    const apply = useCallback((next: Dir) => {
        const prev = held.current;
        (['left', 'right', 'up', 'down'] as const).forEach((d) => {
            if (next[d] !== prev[d]) onDown(d as Btn, next[d]);
        });
        held.current = next;
    }, [onDown]);

    const showRing = (x: number, y: number, on: boolean) => {
        const el = ringRef.current;
        if (!el) return;
        el.style.opacity = on ? '1' : '0';
        if (on) { el.style.left = `${x}px`; el.style.top = `${y}px`; }
    };

    const start = (e: React.PointerEvent) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        origin.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
        showRing(e.clientX - box.left, e.clientY - box.top, true);
    };

    const move = (e: React.PointerEvent) => {
        const o = origin.current;
        if (!o || o.id !== e.pointerId) return;
        e.preventDefault();
        const dx = e.clientX - o.x;
        const dy = e.clientY - o.y;
        // Past a full deflection the origin follows the thumb, so a long drag
        // does not run out of stick and stick there.
        const len = Math.hypot(dx, dy);
        if (len > THROW_PX * 2) {
            o.x = e.clientX - (dx / len) * THROW_PX * 2;
            o.y = e.clientY - (dy / len) * THROW_PX * 2;
        }
        const on = (v: number) => Math.abs(v) > DEAD_PX;
        apply({
            left: on(dx) && dx < 0,
            right: on(dx) && dx > 0,
            up: vertical && on(dy) && dy < 0,
            down: vertical && on(dy) && dy > 0,
        });
    };

    const end = (e: React.PointerEvent) => {
        if (origin.current && origin.current.id !== e.pointerId) return;
        e.preventDefault();
        origin.current = null;
        apply(NONE);
        showRing(0, 0, false);
    };

    const press = (btn: Btn) => ({
        onPointerDown: (e: React.PointerEvent) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            onDown(btn, true);
        },
        onPointerUp: (e: React.PointerEvent) => { e.preventDefault(); onDown(btn, false); },
        onPointerCancel: (e: React.PointerEvent) => { e.preventDefault(); onDown(btn, false); },
        onLostPointerCapture: (e: React.PointerEvent) => { e.preventDefault(); onDown(btn, false); },
        onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    });

    const btns: [Btn, string][] = [['a', actions[0]], ['b', actions[1]]];
    if (actions[2]) btns.push(['c', actions[2]]);

    return (
        <>
            {/* The stick. Transparent on purpose — it is a region, not a widget. */}
            <div
                className="absolute inset-y-0 left-0 w-1/2 z-10 touch-none no-tap-highlight select-none"
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onLostPointerCapture={end}
                onContextMenu={e => e.preventDefault()}
                aria-label="Steer"
                role="application"
            >
                <div
                    ref={ringRef}
                    aria-hidden
                    className="absolute w-[76px] h-[76px] -ml-[38px] -mt-[38px] rounded-full
                               border-2 border-[var(--accent)]/45 bg-[var(--accent)]/5
                               transition-opacity duration-150 pointer-events-none"
                    style={{ opacity: 0 }}
                />
            </div>

            {/* Actions. A place, not a direction. */}
            <div className="absolute right-0 bottom-0 z-20 flex items-end gap-3
                            p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
                            pr-[max(0.75rem,env(safe-area-inset-right))] pointer-events-none">
                {btns.map(([btn, label]) => (
                    <button
                        key={btn}
                        type="button"
                        aria-label={label}
                        {...press(btn)}
                        className="pointer-events-auto touch-none no-tap-highlight select-none
                                   w-[62px] h-[62px] rounded-full font-mono uppercase text-[10px] tracking-wider
                                   border-2 border-[var(--accent)]/70 text-[var(--accent)]
                                   bg-black/35 backdrop-blur-[1px] active:bg-[var(--accent)]/30"
                    >
                        {label}
                    </button>
                ))}
            </div>
        </>
    );
};

export default TouchZones;
