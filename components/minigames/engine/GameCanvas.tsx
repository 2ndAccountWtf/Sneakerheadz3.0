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
    /**
     * Fill the box by widening the world rather than letterboxing it.
     *
     * A fixed 16:9 picture on a phone held sideways is 693 CSS pixels wide in
     * an 844 pixel viewport: 151 pixels, eighteen per cent of the screen, spent
     * on black bars. `object-fit: cover` would fill it by cropping, which on a
     * side-on game takes the HUD off the top and the kerb off the bottom.
     *
     * So the height stays fixed and the width follows the box: the game keeps
     * its scale and simply sees more road. It has to opt in, because a game
     * that positions anything from the right edge or assumes a fixed world
     * width will notice — `viewWidth(ctx)` is how it reads what it actually got.
     */
    widen?: boolean;
    /** Never let the widened view get sillier than this many logical px. */
    maxWidth?: number;
}

/**
 * How much bigger than the logical grid the backing store is allowed to get.
 *
 * Beyond this there is nothing left to show: `docs/ASSETS-STREET.md` asks for
 * art at ART_EXPORT (8x the logical grid), so a store wider than 8x the logical
 * width is magnifying the art rather than revealing it, at quadratic cost. On a
 * 5K monitor that is the difference between a 5120px canvas and a 2560px one
 * for the same picture.
 */
const MAX_STORE_SCALE = 8;

/**
 * A fixed-resolution pixel canvas that scales crisply to its container.
 *
 * Games draw at a small logical resolution (e.g. 320x180); this sizes the
 * backing store to the pixels the canvas actually occupies on the display and
 * scales the drawing transform to match, so the game never has to know.
 */
export const GameCanvas: React.FC<GameCanvasProps> = ({
    width, height, running, onFrame, className = '', fill = false,
    widen = false, maxWidth,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    /**
     * Size the backing store to the pixels the canvas really occupies.
     *
     * `logical * devicePixelRatio` looks like the same thing and is not. DPR
     * describes the *screen*, not this element: a 320-wide game stretched
     * across a 693 CSS px phone in fullscreen at dpr 3 occupies 2080 device
     * pixels, but `320 * 3` is a 960px store, and the compositor then blows
     * those 960 up to 2080. That last step is a nearest-neighbour magnify --
     * measured at 1.94x inline, 2.17x fullscreen -- and it is a hard ceiling:
     * no amount of art detail can survive it, because the detail is thrown away
     * before it gets there. Driving the same pipeline with a detailed source
     * measured 32.5 mean error against an ideal resample with the old sizing
     * and 7.2 with this one.
     *
     * So: measure the box, convert to device pixels, and set the drawing
     * transform to whatever scale that implies. Games keep drawing in logical
     * coordinates and never see any of this.
     */
    const resize = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const box = canvas.getBoundingClientRect();
        // Before first layout the box is empty; fall back to the logical grid
        // so the first frame has somewhere to go.
        const cssW = box.width > 0 ? box.width : width;

        // One scale for both axes. The element is pinned to the logical aspect
        // ratio (CSS `aspect-ratio` inline, `object-fit: contain` filling), so
        // deriving height from the same number keeps the picture square with
        // itself even when the box is rounded to a fractional pixel.
        // Widening reads the box's own aspect: the scale comes from the height,
        // which is the dimension that stays fixed, and the logical width is
        // whatever that scale leaves room for.
        const cssH = box.height > 0 ? box.height : height;
        const logicalW = widen
            ? Math.min(maxWidth ?? Infinity, Math.max(width, Math.round((cssW / cssH) * height)))
            : width;
        const scale = Math.min((cssW * dpr) / logicalW, MAX_STORE_SCALE);
        const targetW = Math.max(1, Math.round(logicalW * scale));
        const targetH = Math.max(1, Math.round(height * scale));
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctxRef.current = ctx;
    }, [width, height, widen, maxWidth, fill]);

    useEffect(() => {
        resize();
        window.addEventListener('resize', resize);
        // The canvas can change size without the window doing so -- entering
        // fullscreen, a sidebar opening, the page reflowing around it -- and a
        // stale store is exactly the magnify this function exists to avoid.
        const canvas = canvasRef.current;
        let ro: ResizeObserver | undefined;
        if (canvas && typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(resize);
            ro.observe(canvas);
        }
        return () => {
            window.removeEventListener('resize', resize);
            ro?.disconnect();
        };
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
                // Inline the element is pinned to the design ratio. Filling, it
                // takes the box and the world widens to match, so pinning it
                // would re-create the bars this exists to remove.
                ...(fill && widen ? null : { aspectRatio: `${width} / ${height}` }),
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
                ...(fill
                    ? widen
                        // No `object-fit`: the backing store already matches the
                        // box's aspect, so there is nothing to fit.
                        ? { width: '100%', height: '100%' }
                        : { width: '100%', height: '100%', objectFit: 'contain' as const }
                    : null),
            }}
            role="img"
            aria-label="Mini-game"
        />
    );
};

/**
 * The logical width the game is being drawn at this frame.
 *
 * Fixed for an inline canvas, and whatever the screen allowed when `widen` is
 * on. Derived from the context rather than passed down, so a draw function deep
 * in a game can ask without every caller between here and there growing a
 * parameter.
 */
export const viewWidth = (ctx: CanvasRenderingContext2D): number => {
    // Defensive about `getTransform`: the headless suite drives the games
    // through a recording stub that implements the drawing calls and not the
    // matrix, and a draw path that throws there is a draw path no test can
    // reach. Falling back to the backing store's own width is the right answer
    // for a stub, where the two are the same number by construction.
    const k = typeof ctx.getTransform === 'function' ? (ctx.getTransform().a || 1) : 1;
    return (ctx.canvas?.width ?? 0) / k || 0;
};

export default GameCanvas;
