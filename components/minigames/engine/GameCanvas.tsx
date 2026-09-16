import React, { useRef, useEffect, useCallback } from 'react';
import { useGameLoop } from './useGameLoop';
import { PAL } from './palette';

interface GameCanvasProps {
    /** Logical resolution. Draw in these coordinates; scaling is handled here. */
    width: number;
    height: number;
    running: boolean;
    /** Called at a fixed 60Hz. Advance simulation AND draw here. */
    onFrame: (ctx: CanvasRenderingContext2D, dt: number, elapsed: number) => void;
    className?: string;
    /**
     * Grow to fill the parent instead of the page column.
     *
     * Inline, a game is as wide as its column and as tall as the aspect ratio
     * makes it. Fullscreen it should be as big as fits in *both* directions,
     * which is a different constraint: cap on width and height, let the aspect
     * ratio pick the smaller, and letterbox the remainder. Same canvas, same
     * logical resolution — only the CSS box changes.
     */
    fill?: boolean;
}

/**
 * A fixed-resolution pixel canvas that scales crisply to its container.
 *
 * Games draw at a small logical resolution (e.g. 320x180) and this scales the
 * backing store by the device pixel ratio, then letterboxes with CSS. Nearest
 * neighbour keeps the chunky arcade look instead of blurring it.
 */
export const GameCanvas: React.FC<GameCanvasProps> = ({ width, height, running, onFrame, className = '', fill = false }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    // Size the backing store to the display size so the picture stays sharp on
    // high-DPI screens without the game having to know anything about DPR.
    const resize = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const targetW = Math.round(width * dpr);
        const targetH = Math.round(height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctxRef.current = ctx;
    }, [width, height]);

    useEffect(() => {
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [resize]);

    useGameLoop((dt, elapsed) => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        onFrame(ctx, dt, elapsed);
    }, running);

    return (
        <canvas
            ref={canvasRef}
            className={`block ${fill ? '' : 'w-full h-auto border border-[var(--line-bright)]'} ${className}`}
            style={{
                imageRendering: 'pixelated',
                aspectRatio: `${width} / ${height}`,
                background: PAL.void,
                touchAction: 'none',
                // Fullscreen: take the whole box and letterbox inside it.
                //
                // `width: auto` looks like the right answer and is not: a
                // canvas is a replaced element, so `auto` resolves to its
                // intrinsic size — the backing store — and the picture sits at
                // whatever the device pixel ratio happened to make it rather
                // than growing. 640x360 in an 844x390 viewport, with black
                // bars, and no amount of max-* will push it bigger. Filling the
                // box and letting `object-fit` preserve the ratio is what
                // actually scales it up.
                ...(fill ? { width: '100%', height: '100%', objectFit: 'contain' as const } : null),
            }}
            role="img"
            aria-label="Mini-game"
        />
    );
};

export default GameCanvas;
