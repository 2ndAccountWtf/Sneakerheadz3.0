/**
 * The sprite baker.
 *
 * Turns a character-grid SpriteDef into a real texture. One source of truth
 * feeds both renderers: the six hand-rolled canvas games draw the returned
 * canvas with `ctx.drawImage`, and the Phaser game registers the same canvas
 * via `scene.textures.addCanvas()`.
 *
 * Bakes are cached by a key covering every option that affects pixels, so
 * drawing forty mooks costs one bake, not forty.
 */
import type { SpriteDef, BakeOptions, BakedSprite } from './types';
import { spriteSize, validateSprite } from './types';
import { resolveColor } from './palette';

const cache = new Map<string, BakedSprite>();

const cacheKey = (def: SpriteDef, opts: BakeOptions): string =>
    [
        def.id,
        opts.scale ?? 1,
        opts.flip ? 'f' : '',
        opts.outline ?? '',
        opts.swap ? Object.entries(opts.swap).sort().map(([k, v]) => k + v).join('') : '',
    ].join('|');

/**
 * Bakes every frame side by side into one strip, which is what both renderers
 * want: a horizontal sheet you index into by frame number.
 */
export function bakeSprite(def: SpriteDef, opts: BakeOptions = {}): BakedSprite {
    const key = cacheKey(def, opts);
    const hit = cache.get(key);
    if (hit) return hit;

    const validation = validateSprite(def);
    if (!validation.ok) {
        // Fail loudly in development rather than silently drawing a sheared
        // character that is hard to trace back to its definition.
        throw new Error(`Invalid sprite: ${validation.errors.join('; ')}`);
    }

    const scale = Math.max(1, Math.floor(opts.scale ?? 1));
    const { w, h } = spriteSize(def);
    const frameCount = def.frames.length;

    const canvas = document.createElement('canvas');
    canvas.width = w * scale * frameCount;
    canvas.height = h * scale;

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    def.frames.forEach((frame, fi) => {
        const ox = fi * w * scale;

        for (let y = 0; y < h; y++) {
            const row = frame[y];
            for (let x = 0; x < w; x++) {
                const char = row[opts.flip ? w - 1 - x : x];
                const color = resolveColor(char, opts.swap);
                if (!color) continue;
                ctx.fillStyle = color;
                ctx.fillRect(ox + x * scale, y * scale, scale, scale);
            }
        }

        // Silhouette outline: any transparent pixel orthogonally adjacent to a
        // filled one gets painted. Done after the fill so it never overwrites
        // interior detail.
        if (opts.outline) {
            const outlineColor = resolveColor(opts.outline, opts.swap);
            if (outlineColor) {
                ctx.fillStyle = outlineColor;
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const at = (px: number, py: number): boolean => {
                            if (px < 0 || py < 0 || px >= w || py >= h) return false;
                            const c = frame[py][opts.flip ? w - 1 - px : px];
                            return resolveColor(c, opts.swap) !== null;
                        };
                        if (at(x, y)) continue;
                        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
                            ctx.fillRect(ox + x * scale, y * scale, scale, scale);
                        }
                    }
                }
            }
        }
    });

    const baked: BakedSprite = {
        id: def.id,
        canvas,
        frameWidth: w * scale,
        frameHeight: h * scale,
        frameCount,
        fps: def.fps ?? 0,
        anchor: def.anchor ?? { x: 0.5, y: 1 },
    };

    cache.set(key, baked);
    return baked;
}

/** Which frame should be showing at this moment. */
export function frameAt(baked: BakedSprite, elapsedSeconds: number): number {
    if (baked.frameCount <= 1 || baked.fps <= 0) return 0;
    return Math.floor(elapsedSeconds * baked.fps) % baked.frameCount;
}

/**
 * Draws a baked sprite into a 2D context, honouring its anchor.
 * `frame` may be an explicit index or omitted to use the animation clock.
 */
export function drawSprite(
    ctx: CanvasRenderingContext2D,
    baked: BakedSprite,
    x: number,
    y: number,
    frame = 0,
    opts: { alpha?: number; rotation?: number; scale?: number } = {},
): void {
    const { alpha = 1, rotation = 0, scale = 1 } = opts;
    const fw = baked.frameWidth;
    const fh = baked.frameHeight;
    const dw = fw * scale;
    const dh = fh * scale;
    const dx = -dw * baked.anchor.x;
    const dy = -dh * baked.anchor.y;
    const sx = (frame % baked.frameCount) * fw;

    ctx.save();
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (rotation) ctx.rotate(rotation);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(baked.canvas, sx, 0, fw, fh, Math.round(dx), Math.round(dy), dw, dh);
    ctx.restore();
}

/** Clears the bake cache. Only needed by tests and hot-reload. */
export const clearSpriteCache = (): void => { cache.clear(); };

/**
 * Registers a baked sprite with a Phaser scene as a spritesheet, so the Phaser
 * game and the canvas games render from the identical source.
 * Typed loosely to avoid importing Phaser, which must stay code-split.
 */
export function registerWithPhaser(
    scene: { textures: { exists(k: string): boolean; addSpriteSheet(k: string, src: HTMLCanvasElement, cfg: { frameWidth: number; frameHeight: number }): unknown } },
    key: string,
    baked: BakedSprite,
): void {
    if (scene.textures.exists(key)) return;
    scene.textures.addSpriteSheet(key, baked.canvas, {
        frameWidth: baked.frameWidth,
        frameHeight: baked.frameHeight,
    });
}
