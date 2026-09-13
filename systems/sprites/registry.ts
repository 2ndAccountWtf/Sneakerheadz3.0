/**
 * The art registry — hand-drawn PNGs taking over from code-defined sprites.
 *
 * Every sprite in this game is authored as a character grid (see
 * `data/sprites/*.ts`), which was the only way to get a cast of ninety-odd
 * sprites in without a single binary file. It has a ceiling, though, and the
 * set-piece mini-games are above it.
 *
 * This module is the ramp off that ceiling. Drop a PNG into
 * `assets/art/<category>/<sprite-id>.png` and it silently replaces the coded
 * sprite of the same id everywhere in the game — store cards, canvas games and
 * the Phaser scene alike — because `bakeSprite` consults this registry before
 * it paints anything. Nothing is imported by hand and no manifest is edited:
 * the glob below is resolved at build time, so the delivery workflow is
 * literally "put the file in the folder".
 *
 * That matters because art arrives one file at a time. A half-delivered set is
 * not a broken build; it is a game where six things look better than they did
 * yesterday and everything else is exactly as it was.
 *
 * FILE NAMING
 *   <id>.png      frame count comes from the coded sprite's frame count, or 1
 *                 if there is no coded sprite by that id
 *   <id>@6.png    six frames, explicitly — use this when the PNG has more (or
 *                 fewer) frames than the coded version it replaces
 *
 * Frames must be laid out left to right in a single row with no padding.
 */
import type { BakedSprite, SpriteDef } from './types';

/**
 * Build-time file listing. Vite rewrites this call into a plain object of
 * path -> url; under plain Node (the test runner) `import.meta.glob` does not
 * exist and the call throws, which is why it is wrapped. Tests do not have a
 * DOM to bake into anyway, so an empty registry there is correct.
 */
let ART_FILES: Record<string, string> = {};
try {
    ART_FILES = import.meta.glob('../../assets/art/**/*.png', {
        eager: true,
        query: '?url',
        import: 'default',
    }) as Record<string, string>;
} catch {
    ART_FILES = {};
}

interface ArtEntry {
    id: string;
    url: string;
    /** Explicit frame count from an `@N` filename suffix, if present. */
    frames?: number;
}

/** Parsed from the glob once, at module load. */
const ENTRIES: Map<string, ArtEntry> = (() => {
    const map = new Map<string, ArtEntry>();
    for (const [path, url] of Object.entries(ART_FILES)) {
        const file = path.split('/').pop() ?? '';
        const base = file.replace(/\.png$/i, '');
        const match = base.match(/^(.+?)@(\d+)$/);
        const id = match ? match[1] : base;
        const frames = match ? Number(match[2]) : undefined;
        // A duplicate id in two folders is a mistake worth surfacing rather
        // than resolving arbitrarily by directory order.
        if (map.has(id)) {
            console.warn(`[art] two files claim the sprite id "${id}" — using the first`);
            continue;
        }
        map.set(id, { id, url, frames });
    }
    return map;
})();

/** Loaded, drawn-to-canvas art, keyed by sprite id. Populated by `loadArt`. */
const LOADED = new Map<string, BakedSprite>();

/** True once `loadArt` has finished, successfully or not. */
let loadComplete = false;

export const hasArt = (id: string): boolean => LOADED.has(id);

/** The number of PNGs sitting in `assets/art`, whether or not they loaded. */
export const artCount = (): number => ENTRIES.size;

/**
 * The override `bakeSprite` asks for. Returns null when there is no PNG for
 * this id, which is the normal case and not an error.
 *
 * Overrides deliberately ignore palette swaps: a hand-drawn shoe has its own
 * colourway and remapping palette characters into it would be meaningless.
 * That means a delivered `shoe-lowtop.png` replaces *every* low-top colourway
 * with one look — so shoes should be delivered per colourway
 * (`shoe-lowtop-panda.png`) or not at all. `overrideId` below builds that key.
 */
export function artOverride(id: string, scale: number): BakedSprite | null {
    const hit = LOADED.get(id);
    if (!hit) return null;
    if (scale === 1) return hit;

    // Upscaling a PNG is still nearest-neighbour: this is pixel art and it must
    // stay on its grid.
    const key = `${id}|${scale}`;
    const cached = LOADED.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = hit.canvas.width * scale;
    canvas.height = hit.canvas.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(hit.canvas, 0, 0, canvas.width, canvas.height);

    const scaled: BakedSprite = {
        ...hit,
        canvas,
        frameWidth: hit.frameWidth * scale,
        frameHeight: hit.frameHeight * scale,
    };
    LOADED.set(key, scaled);
    return scaled;
}

/**
 * The id a swapped sprite looks for. A colourway-specific PNG wins over the
 * generic one, so `shoe-lowtop` with the Panda swap checks `shoe-lowtop-panda`
 * first and falls back to the shared silhouette.
 */
export const overrideId = (id: string, variant?: string): string =>
    variant ? `${id}-${variant}` : id;

/**
 * Loads every PNG in `assets/art` and bakes each into a canvas, so that from
 * here on the PNG path and the coded path produce the identical `BakedSprite`
 * shape and every downstream renderer stays unchanged.
 *
 * Call once at app start and await it before the first frame; a failed image
 * is logged and skipped rather than thrown, because one bad file should cost
 * one sprite, not the game.
 */
export async function loadArt(defs: SpriteDef[] = []): Promise<number> {
    if (loadComplete) return LOADED.size;
    loadComplete = true;
    if (!ENTRIES.size || typeof document === 'undefined') return 0;

    const byId = new Map(defs.map((d) => [d.id, d]));

    await Promise.all(
        [...ENTRIES.values()].map(async (entry) => {
            try {
                const img = await loadImage(entry.url);
                const coded = byId.get(entry.id);
                const frameCount = entry.frames ?? coded?.frames.length ?? 1;
                if (frameCount < 1 || img.width % frameCount !== 0) {
                    console.warn(
                        `[art] ${entry.id}: ${img.width}px wide does not divide into ` +
                        `${frameCount} frames — treating it as a single frame`,
                    );
                }
                const usable = img.width % frameCount === 0 ? frameCount : 1;

                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d')!;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0);

                LOADED.set(entry.id, {
                    id: entry.id,
                    canvas,
                    frameWidth: img.width / usable,
                    frameHeight: img.height,
                    frameCount: usable,
                    fps: coded?.fps ?? (usable > 1 ? 8 : 0),
                    anchor: coded?.anchor ?? { x: 0.5, y: 1 },
                });
            } catch {
                console.warn(`[art] failed to load ${entry.id} (${entry.url})`);
            }
        }),
    );

    return LOADED.size;
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(url));
        img.src = url;
    });
}

/** Test/hot-reload hook. */
export const resetArt = (): void => {
    LOADED.clear();
    loadComplete = false;
};
