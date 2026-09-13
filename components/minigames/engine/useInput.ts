import { useEffect, useRef, useCallback } from 'react';

/**
 * Three action buttons, not two.
 *
 * `c` was added for Hoops, which needs the NBA Jam layout — Turbo held, Pass,
 * Shoot — where the second two swap meaning between offence and defence. Two
 * buttons could not express it: the game had no way to pass the ball at all,
 * because the only spare binding was already doing double duty.
 *
 * Every other game ignores `c` and is unaffected: it is simply never pressed
 * when a game declares only two actions.
 */
export type Btn = 'left' | 'right' | 'up' | 'down' | 'a' | 'b' | 'c';

export interface InputState {
    left: boolean; right: boolean; up: boolean; down: boolean;
    a: boolean; b: boolean; c: boolean;
    /** Edge-triggered; read with consume() so a press fires exactly once. */
    pressed: Record<Btn, boolean>;
}

const KEYMAP: Record<string, Btn> = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
    ' ': 'a', j: 'a', J: 'a', z: 'a', Z: 'a', Enter: 'a',
    k: 'b', K: 'b', x: 'b', X: 'b', Shift: 'b',
    // No modifier keys here: `preventDefault` on Control would swallow the
    // browser's own shortcuts while a game has focus.
    l: 'c', L: 'c', c: 'c', C: 'c',
};

const blank = (): InputState => ({
    left: false, right: false, up: false, down: false, a: false, b: false, c: false,
    pressed: { left: false, right: false, up: false, down: false, a: false, b: false, c: false },
});

/**
 * Unified keyboard + touch input.
 *
 * State lives in a ref rather than React state: the game loop reads it 60 times
 * a second and re-rendering on every keypress would stall the frame.
 */
export function useInput(active: boolean = true) {
    const input = useRef<InputState>(blank());

    const set = useCallback((btn: Btn, down: boolean) => {
        const s = input.current;
        if (down && !s[btn]) s.pressed[btn] = true;
        s[btn] = down;
    }, []);

    /** Returns true once per physical press. */
    const consume = useCallback((btn: Btn): boolean => {
        if (input.current.pressed[btn]) {
            input.current.pressed[btn] = false;
            return true;
        }
        return false;
    }, []);

    const reset = useCallback(() => { input.current = blank(); }, []);

    useEffect(() => {
        if (!active) return;

        const down = (e: KeyboardEvent) => {
            const btn = KEYMAP[e.key];
            if (!btn) return;
            // Stop arrows and space from scrolling the page under the game.
            e.preventDefault();
            set(btn, true);
        };
        const up = (e: KeyboardEvent) => {
            const btn = KEYMAP[e.key];
            if (!btn) return;
            e.preventDefault();
            set(btn, false);
        };
        // Losing focus mid-hold would otherwise leave the player running forever.
        const blur = () => reset();

        window.addEventListener('keydown', down, { passive: false });
        window.addEventListener('keyup', up, { passive: false });
        window.addEventListener('blur', blur);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('blur', blur);
            reset();
        };
    }, [active, set, reset]);

    return { input, set, consume, reset };
}
