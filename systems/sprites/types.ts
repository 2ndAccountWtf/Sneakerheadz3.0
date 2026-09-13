import type { PaletteSwap } from './palette';

/**
 * A sprite is authored as rows of single characters that index into
 * SPRITE_PALETTE. Every row in a frame must be the same length, and every
 * frame in a sprite must be the same size — `validateSprite` enforces both, so
 * a typo fails a test rather than rendering a sheared character.
 */
export interface SpriteDef {
    id: string;
    /** One entry per animation frame. Each frame is an array of pixel rows. */
    frames: string[][];
    /** Frames per second when played as an animation. 0 = static. */
    fps?: number;
    /**
     * Where the sprite's origin sits, as a fraction of its size.
     * Defaults to feet-centre (0.5, 1) because almost everything here stands
     * on the ground.
     */
    anchor?: { x: number; y: number };
    /** Human note for whoever edits it next. */
    note?: string;
}

export interface BakeOptions {
    /** Integer upscale. 1 = one palette char per device pixel. */
    scale?: number;
    /** Recolour at bake time — this is how one sprite yields a crowd. */
    swap?: PaletteSwap;
    /** Mirror horizontally, for characters that only face one way. */
    flip?: boolean;
    /** Draw a 1px outline around the silhouette in this palette char. */
    outline?: string;
    /**
     * Names the specific look being baked — a sneaker colourway, usually.
     * Only the art registry reads it: hand-drawn art is looked up as
     * `<id>-<variant>` first, so a delivered PNG can replace one colourway
     * without claiming every other colourway on the same silhouette.
     */
    variant?: string;
}

export interface BakedSprite {
    id: string;
    canvas: HTMLCanvasElement;
    /** Width/height of a single frame, in output pixels. */
    frameWidth: number;
    frameHeight: number;
    frameCount: number;
    fps: number;
    anchor: { x: number; y: number };
}

export interface SpriteValidation {
    ok: boolean;
    errors: string[];
}

/** Dimensions are derived from frame 0; everything else must match it. */
export function spriteSize(def: SpriteDef): { w: number; h: number } {
    const first = def.frames[0] ?? [];
    return { w: first[0]?.length ?? 0, h: first.length };
}

export function validateSprite(def: SpriteDef): SpriteValidation {
    const errors: string[] = [];

    if (!def.frames.length) {
        return { ok: false, errors: [`${def.id}: has no frames`] };
    }

    const { w, h } = spriteSize(def);
    if (!w || !h) errors.push(`${def.id}: frame 0 is empty`);

    def.frames.forEach((frame, fi) => {
        if (frame.length !== h) {
            errors.push(`${def.id}: frame ${fi} has ${frame.length} rows, expected ${h}`);
        }
        frame.forEach((row, ri) => {
            if (row.length !== w) {
                errors.push(`${def.id}: frame ${fi} row ${ri} is ${row.length} chars, expected ${w}`);
            }
        });
    });

    return { ok: errors.length === 0, errors };
}
