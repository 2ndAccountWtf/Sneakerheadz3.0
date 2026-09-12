import { useEffect, useRef } from 'react';

/**
 * Fixed-timestep game loop on requestAnimationFrame.
 *
 * Simulation runs in fixed 1/60s steps so physics is identical on a 60Hz and a
 * 144Hz display; leftover time accumulates rather than being lost. A long stall
 * (tab backgrounded, GC pause) is clamped so the game never "catches up" by
 * teleporting everything across the screen.
 */
const STEP = 1 / 60;
const MAX_FRAME = 0.25; // seconds of catch-up we are willing to simulate

export function useGameLoop(
    onStep: (dt: number, elapsed: number) => void,
    running: boolean,
): void {
    const stepRef = useRef(onStep);
    stepRef.current = onStep;

    useEffect(() => {
        if (!running) return;

        let frame = 0;
        let last = performance.now();
        let acc = 0;
        let elapsed = 0;
        let cancelled = false;

        const tick = (now: number) => {
            if (cancelled) return;
            frame = requestAnimationFrame(tick);

            let delta = (now - last) / 1000;
            last = now;
            if (delta > MAX_FRAME) delta = MAX_FRAME;
            acc += delta;

            while (acc >= STEP) {
                elapsed += STEP;
                stepRef.current(STEP, elapsed);
                acc -= STEP;
            }
        };

        frame = requestAnimationFrame(tick);
        return () => { cancelled = true; cancelAnimationFrame(frame); };
    }, [running]);
}
