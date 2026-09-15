/**
 * Hand-drawn art for the street games.
 *
 * Downhill Racer and Pizza Run draw with a 2D canvas, not Phaser, so they
 * cannot use `flight404/artLoader.ts` — but they have the same problem it
 * solves: PNGs arrive in a folder one at a time and have to replace the
 * code-drawn placeholder of the same id without anybody editing a manifest.
 *
 * Both games share a world, so they share a folder: `assets/art/street/`. A
 * file dropped there is used by whichever game names that id.
 *
 * ## Why this is a drop-in for `glyph`
 *
 * Almost everything in those two games is currently drawn as an emoji through
 * `glyph(ctx, '🚗', x, y, size)`. `sprite()` below takes the same shape of call
 * plus an id, and falls back to exactly that glyph when the art has not
 * arrived. So wiring a new asset is a one-word change at the call site, and a
 * half-delivered set is a game where six things look better than they did
 * yesterday rather than a game with holes in it.
 *
 * ## Loading
 *
 * Images decode asynchronously and the games draw at 60fps from frame one, so
 * nothing here blocks or awaits. `load()` starts the fetches and returns; until
 * a file has decoded, `sprite()` draws the glyph. The swap happens mid-frame
 * and nobody notices, which is the correct behaviour for something that is
 * cosmetic by definition.
 */

/**
 * Build-time file listing, resolved by Vite into path -> url. Wrapped because
 * `import.meta.glob` does not exist under plain Node, where the tests run.
 */
let FILES: Record<string, string> = {};
try {
    FILES = {
        ...import.meta.glob('../../../assets/art/street/**/*.png', {
            eager: true, query: '?url', import: 'default',
        }),
        // Characters live in their own folder because they belong to the game
        // world rather than to one game's street, but they load through the
        // same registry — an id is an id, and the two sets do not collide.
        ...import.meta.glob('../../../assets/art/characters/**/*.png', {
            eager: true, query: '?url', import: 'default',
        }),
    } as Record<string, string>;
} catch {
    FILES = {};
}

/**
 * Frame counts for sheets delivered without an `@N` in the filename.
 *
 * A multi-frame sheet loaded as one frame draws the whole strip at once, which
 * looks like a rendering fault and is a naming one. `tiny-bicycle` arrived as
 * 464 x 48 with no suffix; its ink falls on a 58px pitch, which is eight
 * frames and the same frame width as `bike-ride`.
 */
const UNMARKED_FRAMES: Record<string, number> = {
    'tiny-bicycle': 8,
};

export interface StreetSheet {
    img: HTMLImageElement;
    /** Frame count, from the `@N` in the filename. */
    frames: number;
    /** One frame's width in source pixels. */
    fw: number;
    fh: number;
}

/** Parsed once at module load: id -> url and frame count. */
export const ENTRIES: { id: string; url: string; frames: number }[] = (() => {
    const seen = new Map<string, { id: string; url: string; frames: number }>();
    for (const [path, url] of Object.entries(FILES)) {
        const base = (path.split('/').pop() ?? '').replace(/\.png$/i, '');
        const m = base.match(/^(.+?)@(\d+)$/);
        const id = m ? m[1] : base;
        const frames = m ? Math.max(1, Number(m[2])) : (UNMARKED_FRAMES[id] ?? 1);
        if (seen.has(id)) {
            console.warn(`[street art] two files claim "${id}" — using the first`);
            continue;
        }
        seen.set(id, { id, url, frames });
    }
    return [...seen.values()];
})();

const LOADED = new Map<string, StreetSheet>();
let started = false;

/**
 * Begin decoding every delivered PNG. Safe to call more than once; safe to call
 * from a component that mounts and unmounts.
 *
 * Deliberately does not return a promise to await. A game that waited for art
 * would show a blank frame on a slow connection, and the whole point of the
 * fallback is that it never has to.
 */
export function load(): void {
    if (started || typeof document === 'undefined') return;
    started = true;
    for (const e of ENTRIES) {
        const img = new Image();
        img.onload = () => {
            const fw = img.width / e.frames;
            // A sheet whose width does not divide by its frame count would
            // slice off-centre and every frame after the first would drift.
            // One wrong filename should cost the animation, not the sprite.
            if (!Number.isInteger(fw)) {
                console.warn(`[street art] ${e.id}: ${img.width}px does not divide into ${e.frames} frames — using one`);
                LOADED.set(e.id, { img, frames: 1, fw: img.width, fh: img.height });
                return;
            }
            LOADED.set(e.id, { img, frames: e.frames, fw, fh: img.height });
        };
        img.onerror = () => console.warn(`[street art] failed to load ${e.id}`);
        img.src = e.url;
    }
}

export const has = (id: string): boolean => LOADED.has(id);
export const count = (): number => LOADED.size;
export const delivered = (): number => ENTRIES.length;

/** Test/hot-reload hook. */
export const reset = (): void => { LOADED.clear(); started = false; };

export interface SpriteOpts {
    /** Which frame to draw. Wraps, so a caller can pass a rising counter. */
    frame?: number;
    /** Mirror horizontally. The art is authored facing right. */
    flip?: boolean;
    rotation?: number;
    alpha?: number;
    /**
     * Height to draw at, in game pixels. The width follows the art's own
     * aspect ratio, so a delivered file is never stretched to a guess.
     */
    height?: number;
}

/**
 * Draw a delivered sprite, or the glyph if it has not arrived.
 *
 * `x, y` is the **bottom-centre** — the ground contact — because that is where
 * every asset's origin is and because it is what the games already pass to
 * `glyph` for anything standing on the road.
 */
export function sprite(
    ctx: CanvasRenderingContext2D,
    id: string,
    fallbackGlyph: string,
    x: number,
    y: number,
    size: number,
    opts: SpriteOpts = {},
): void {
    const sheet = LOADED.get(id);
    const { frame = 0, flip = false, rotation = 0, alpha = 1 } = opts;

    if (!sheet) {
        // The emoji is centred rather than bottom-aligned, which is how the
        // games have always drawn it; keep that so a fallback looks like it
        // used to rather than jumping when the art lands.
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y - size / 2);
        if (rotation) ctx.rotate(rotation);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${size}px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif`;
        ctx.fillText(fallbackGlyph, 0, 0);
        ctx.restore();
        return;
    }

    const h = opts.height ?? size;
    const w = h * (sheet.fw / sheet.fh);
    const f = ((frame % sheet.frames) + sheet.frames) % sheet.frames;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rotation) ctx.rotate(rotation);
    if (flip) ctx.scale(-1, 1);
    // Pixel art: never smooth it. The canvas default is bilinear, which turns
    // a hand-drawn sprite into a smudge at any scale but 1.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet.img, f * sheet.fw, 0, sheet.fw, sheet.fh, -w / 2, -h, w, h);
    ctx.restore();
}

/**
 * Draw a horizontally tiling strip — road surface, kerb, hedge, skyline.
 *
 * `offset` scrolls it; the strip repeats to fill `width`. Returns false when
 * the art has not arrived, so the caller can fall back to its coded band.
 */
export function strip(
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    offset = 0,
): boolean {
    const sheet = LOADED.get(id);
    if (!sheet) return false;

    const w = height * (sheet.fw / sheet.fh);
    // Modulo twice so a negative offset still lands in range — a scroll that
    // runs backwards is the normal case in both of these games.
    let sx = -(((offset % w) + w) % w);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    for (; sx < width; sx += w) {
        ctx.drawImage(sheet.img, 0, 0, sheet.fw, sheet.fh, x + sx, y, w, height);
    }
    ctx.restore();
    return true;
}

// ---------------------------------------------------------------------------
// The skyline
// ---------------------------------------------------------------------------
import { layoutSkyline, BANDS, type BandName } from './skyline';

/**
 * Draw the assembled skyline.
 *
 * `skyline.ts` decides what goes where and this puts it down, so the question
 * "does the horizon visibly repeat" is answered by a test rather than by
 * staring at it. Returns false when the kit has not been delivered, so a caller
 * can fall back to its coded bands and a half-delivered set is still a game.
 *
 * Bands are drawn back to front and dimmed by distance — the far towers are
 * flattened toward the sky colour, which is the only thing selling depth on a
 * flat horizon.
 */
export const SKY_SHADE: Record<BandName, number> = {
    towers: 0.55, lowrise: 0.78, rooftop: 0.78, landmarks: 0.66,
};

export function drawSkyline(
    ctx: CanvasRenderingContext2D,
    scroll: number,
    screenW: number,
    salt = 0,
): boolean {
    let drew = false;
    for (const { band, placements } of layoutSkyline(scroll, screenW, salt)) {
        for (const p of placements) {
            const sheet = LOADED.get(p.piece.id);
            if (!sheet) continue;
            drew = true;
            ctx.save();
            ctx.globalAlpha = SKY_SHADE[band];
            ctx.imageSmoothingEnabled = false;
            if (p.flip) {
                ctx.translate(p.x + p.piece.w / 2, 0);
                ctx.scale(-1, 1);
                ctx.translate(-(p.x + p.piece.w / 2), 0);
            }
            ctx.drawImage(
                sheet.img, 0, 0, sheet.fw, sheet.fh,
                p.x, p.y - p.piece.h, p.piece.w, p.piece.h,
            );
            ctx.restore();
        }
    }
    return drew;
}

/** Has enough of the skyline kit arrived to be worth drawing? */
export const hasSkyline = (): boolean =>
    BANDS.towers.pieces.some((p) => LOADED.has(p.id));
