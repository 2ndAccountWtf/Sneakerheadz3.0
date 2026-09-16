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
        // Rooftop Artillery's scenery. Added because the trap otherwise is
        // silent and expensive: the sprite registry globs all of `assets/art`,
        // so a facade dropped in the rooftop folder loads perfectly well and
        // then never draws, because this loader — the one that actually renders
        // scenery — could not see it. A file that loads and does nothing is
        // harder to diagnose than one that fails.
        ...import.meta.glob('../../../assets/art/rooftop/**/*.png', {
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

/** Frame count declared by the filename, known before the PNG has decoded. */
const ENTRY_FRAMES = new Map(ENTRIES.map((e) => [e.id, e.frames]));

/**
 * How many frames `id` has, for `streetAnim` to index against.
 *
 * Reads the decoded sheet when there is one so a file whose width did not
 * divide cleanly reports the 1 frame it was demoted to rather than the count
 * its name claimed. Unknown ids report 1, which pins their frame at 0 — the
 * right answer for something that is about to draw a fallback glyph anyway.
 */
export const frames = (id: string): number =>
    LOADED.get(id)?.frames ?? ENTRY_FRAMES.get(id) ?? 1;

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
    ctx.imageSmoothingEnabled = smoothFor(ctx, sheet.fw, w);
    ctx.drawImage(sheet.img, f * sheet.fw, 0, sheet.fw, sheet.fh, -w / 2, -h, w, h);
    ctx.restore();
}

/**
 * Like `sprite`, but returns whether it drew anything instead of falling back
 * to an emoji.
 *
 * Some call sites have a fallback richer than one glyph — a palm has a coded
 * trunk under it, roadworks are three cones in a row — and those cannot be
 * expressed as a single character. This lets the caller keep its own.
 */
export function sprite2(
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    y: number,
    size: number,
    opts: SpriteOpts = {},
): boolean {
    if (!LOADED.has(id)) return false;
    sprite(ctx, id, '', x, y, size, opts);
    return true;
}

/**
 * Draw a sheet stretched into an explicit rectangle, top-left anchored.
 *
 * `sprite` keeps the art's own aspect ratio, which is right for anything that
 * stands on the ground and wrong for a house facade: the game decides how wide
 * and how tall a given house is, and the drawing has to fill exactly that wall
 * or the door and window the game draws on top of it will not line up.
 *
 * Returns false when the art has not arrived, so the caller can fall back to
 * its coloured rectangle.
 */
export function panel(
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { frame?: number; flip?: boolean; alpha?: number } = {},
): boolean {
    const sheet = LOADED.get(id);
    if (!sheet) return false;
    const { frame = 0, flip = false, alpha = 1 } = opts;
    const f = ((frame % sheet.frames) + sheet.frames) % sheet.frames;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = smoothFor(ctx, sheet.fw, w);
    if (flip) {
        ctx.translate(x + w / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(x + w / 2), 0);
    }
    ctx.drawImage(sheet.img, f * sheet.fw, 0, sheet.fw, sheet.fh, x, y, w, h);
    ctx.restore();
    return true;
}

/**
 * Should this draw be filtered, or snapped to the nearest source pixel?
 *
 * Nearest neighbour is right for pixel art and for magnifying: it keeps hard
 * edges hard and gives the chunky look the coded sprites already have. It is
 * badly wrong for *shrinking* a detailed illustration, because it simply drops
 * whichever source rows do not line up and keeps the rest -- a 400px car
 * squeezed into 220 device pixels loses 45% of its rows outright, which reads
 * as the jagged, half-dissolved edges that made the delivered art look worse in
 * game than it does in a file browser.
 *
 * So decide per draw, by comparing the source against the *device* pixels it is
 * headed for. `destW` is in logical units, so it has to go through the current
 * transform first -- the same logical rect is 68 device pixels in a column and
 * 220 in fullscreen, and only one of those is a downscale.
 *
 * The 2% slack keeps a 1:1 draw (the case the asset brief aims for) on the
 * nearest-neighbour side, where rounding cannot smear it.
 */
export function smoothFor(ctx: CanvasRenderingContext2D, srcW: number, destW: number): boolean {
    const k = ctx.getTransform().a || 1;
    return destW * k < srcW * 0.98;
}

/**
 * How much bigger delivered art is than the game's own pixels.
 *
 * `docs/ASSETS-STREET.md` asks for every file at a fixed multiple of the game's
 * logical grid, so a wheelie bin twelve game pixels tall arrives as a PNG this
 * many times larger. Anything drawn at its natural size has to divide by it or
 * it comes out that many times too big — which for a tileable surface means one
 * flagstone filling half the road.
 *
 * Only a fallback now; see `TILE_SIZE`.
 */
export const ART_SCALE = 3;

/**
 * The logical size each tiling surface was authored at.
 *
 * A tile is the one kind of art whose on-screen size is not chosen by the
 * caller: `strip` and `sprite` are told how big to draw, but asphalt is laid
 * down at its own size however deep the road is, so the code has to work that
 * size out from the file. It used to do that by dividing by a single global
 * `ART_SCALE`, which quietly made the export multiple part of the engine: move
 * the brief from 3× to 8× and every road surface silently becomes 2.7× too
 * coarse, one flagstone per lane, with nothing failing.
 *
 * Naming the logical size instead makes the file size irrelevant. A 192px
 * asphalt and a 512px asphalt both describe the same 64 game pixels of road, so
 * either can be dropped in and the road looks the same — only sharper.
 *
 * These are the sizes in `docs/ASSETS-STREET.md`; an id missing here falls back
 * to `ART_SCALE`, which is right for anything still delivered at the old
 * multiple.
 */
const TILE_SIZE: Record<string, readonly [number, number]> = {
    'road-asphalt': [64, 18],
    'road-centreline': [32, 3],
    'road-edgeline': [32, 2],
    kerb: [32, 5],
    pavement: [32, 8],
    'grass-verge': [32, 6],
    'fence-picket': [24, 10],
    'hedge-low': [24, 9],
    'wall-breeze': [24, 12],
};

/** The logical size of one tile of `id`, however large the delivered file is. */
export function tileSize(id: string, fw: number, fh: number): [number, number] {
    const known = TILE_SIZE[id];
    if (known) return [known[0], known[1]];
    return [fw / ART_SCALE, fh / ART_SCALE];
}

/**
 * Tile a surface across a rectangle at its own pixel size.
 *
 * The difference from `strip` is what "one tile" means. `strip` scales the art
 * to the height of the band, which is right for a horizon: the drawing is a
 * picture of a thing and the band decides how tall that thing is. It is wrong
 * for tarmac. Asphalt is a texture — a 64x18 patch meant to repeat — and
 * stretching one patch over a 44px-deep road turns the grain into masonry.
 *
 * So this repeats in both axes at 1:1 with the art's own pixels, clipped to the
 * rect, scrolled by `offset`. Returns false when the art has not arrived.
 */
export function tile(
    ctx: CanvasRenderingContext2D,
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    offset = 0,
    alpha = 1,
): boolean {
    const sheet = LOADED.get(id);
    if (!sheet) return false;

    const [tw, th] = tileSize(id, sheet.fw, sheet.fh);
    ctx.save();
    ctx.globalAlpha = alpha;
    // Nearest, even when this is a downscale. `smoothFor` is right for a
    // sprite and wrong for anything that repeats: a filtered draw samples
    // past the edge of the source rect, so every seam between two copies
    // picks up the clamped edge colour and the surface gains a ruled line at
    // the tile pitch. A visible grid is worse than a slightly harsh texture.
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    // Modulo twice so a negative scroll still lands in range; both games run
    // their world backwards past the camera, so that is the normal case.
    const sx0 = -(((offset % tw) + tw) % tw);
    for (let ty = 0; ty < h; ty += th) {
        for (let sx = sx0; sx < w; sx += tw) {
            ctx.drawImage(sheet.img, 0, 0, sheet.fw, sheet.fh, x + sx, y + ty, tw, th);
        }
    }
    ctx.restore();
    return true;
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
    // Nearest — same seam argument as `tile`; this repeats too.
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
import { layoutSkyline, slotHash, BANDS, type BandName } from './skyline';

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
/**
 * How much of each band survives the air between you and it.
 *
 * This is alpha, so a band is composited over the sky and comes out that
 * fraction of the way from the sky colour to its own — which is exactly what
 * atmospheric perspective does, and the reason these numbers are so low.
 *
 * They used to be 0.55/0.78/0.78/0.66 and that was far too much. The delivered
 * kit is close-range art: around fifty colours per building and a luminance
 * spread of 104 to 192, against a sky sitting at 48 to 70. At 0.78 a lowrise
 * roof came out near-white and brighter than anything else on screen at that
 * depth, which is what "these buildings aren't working as skyline" was
 * describing. A spread of 133 at alpha 0.28 collapses to 37 — about what a
 * building two kilometres back through city air actually looks like.
 *
 * Note this is a *correction*, not the destination. The right fix is art drawn
 * for the distance in the first place — see `docs/ASSETS-SKYLINE-SILHOUETTE.md`.
 * Until that arrives, flattening the detailed kit is the closest thing to it,
 * and it doubles as a preview of what the silhouette set should look like.
 */
export const SKY_SHADE: Record<BandName, number> = {
    towers: 0.22, lowrise: 0.30, rooftop: 0.26, landmarks: 0.26,
};

/**
 * How much of itself a building keeps when it was *drawn* for the distance.
 *
 * `SKY_SHADE` above is a correction applied to art that does not belong on a
 * horizon — around fifty colours a building and a luminance spread of 104 to
 * 192. Flattening that hard was the only way to make it sit back, and it cost
 * every bit of detail somebody had drawn.
 *
 * The `far-*` set does not need it. Measured on delivery: two or three colours
 * a building, a spread of 10 to 22, everything between luminance 70 and 92 —
 * flatter than the brief asked for, which is the safe side of the target. Art
 * like that is already the right distance, and correcting it again would only
 * wash it into the sky.
 *
 * So the amount is chosen per piece rather than per band. A building using its
 * distance drawing is left nearly alone; one still falling back to the detailed
 * kit keeps the heavy correction. That is what makes the delivery incremental
 * in practice and not just in principle: one file at a time, each landing at
 * the right strength the moment it arrives.
 */
export const FAR_SHADE: Record<BandName, number> = {
    towers: 0.90, lowrise: 0.92, rooftop: 0.26, landmarks: 0.26,
};

/**
 * Multiplies `SKY_SHADE` for a scene whose sky is not the one those numbers
 * were tuned against.
 *
 * `SKY_SHADE` is alpha, so a band comes out that fraction of the way from the
 * sky colour to its own. That makes the right value depend on the sky — and
 * these two games are at different times of day. Downhill Racer descends into
 * dusk, luminance 25 to 156; Pizza Run runs at night, 12 to 40. At the 0.22
 * tuned for dusk, a building over Pizza Run's sky lands between luminance 19
 * and 54 against a sky of 20: a ghost. Its skyline was very nearly invisible
 * and the one thing you could see up there was the dusk hills asset, which is
 * why it read as a pink bar with nothing around it.
 *
 * Night wants more of the building and less of the air, because at night a
 * distant city is genuinely brighter than the sky behind it — lit windows are
 * the whole reason you can see a skyline at all.
 */
/**
 * A copy of a sheet tinted toward `fog`, kept fully opaque.
 *
 * This exists because alpha is not haze, and using it as haze was wrong.
 *
 * Compositing a building at `globalAlpha = 0.3` does move its colour toward the
 * sky, which is why it looked like atmospheric perspective in a swatch. What it
 * also does is make the building *see-through*: the sky's own dither pattern
 * showed straight through a skyscraper, two overlapping towers showed through
 * each other, and everything on the horizon read as a decal rather than as a
 * solid object. Real air does not make a building transparent. It shifts its
 * colour and leaves it opaque.
 *
 * So each sheet is painted once into an offscreen canvas, flooded with the sky
 * colour through `source-atop` — which respects the sprite's alpha, so the
 * shape is untouched and only the lit pixels move — and cached. Drawing is then
 * a plain opaque blit.
 *
 * The cache key quantises the amount, because the tint colour in Downhill Racer
 * moves continuously with the descent and a key per frame would be a leak.
 */
const FOG_CACHE = new Map<string, HTMLCanvasElement>();

function fogged(sheet: StreetSheet, id: string, fog: string, amount: number): CanvasImageSource {
    if (amount <= 0.01 || typeof document === 'undefined') return sheet.img;
    const step = Math.round(amount * 12) / 12;
    const key = `${id}|${fog}|${step}`;
    const hit = FOG_CACHE.get(key);
    if (hit) return hit;

    const c = document.createElement('canvas');
    c.width = sheet.img.width;
    c.height = sheet.img.height;
    const cx = c.getContext('2d');
    if (!cx) return sheet.img;
    cx.imageSmoothingEnabled = false;
    cx.drawImage(sheet.img, 0, 0);
    // `source-atop` paints only where the sprite already has pixels, so the
    // silhouette and its soft edges survive exactly.
    cx.globalCompositeOperation = 'source-atop';
    cx.globalAlpha = step;
    cx.fillStyle = fog;
    cx.fillRect(0, 0, c.width, c.height);
    FOG_CACHE.set(key, c);
    return c;
}

/** Test/hot-reload hook, and a way to drop the tint cache when a palette moves. */
export const clearFogCache = (): void => { FOG_CACHE.clear(); };

export interface SkylineOpts {
    salt?: number;
    /** Scales `SKY_SHADE` for a scene whose sky is not the one it was tuned to. */
    shade?: number;
    /**
     * The colour the air is. Buildings are tinted toward it and stay opaque.
     * Without it they fall back to alpha, which is the old wrong behaviour and
     * is kept only so a caller that has not been updated still draws something.
     */
    fog?: string;
}

export function drawSkyline(
    ctx: CanvasRenderingContext2D,
    scroll: number,
    screenW: number,
    opts: SkylineOpts = {},
): boolean {
    const { salt = 0, shade = 1, fog } = opts;
    let drew = false;
    for (const { band, placements } of layoutSkyline(scroll, screenW, salt)) {
        for (const p of placements) {
            /**
             * A per-building nudge to how far away it is.
             *
             * Six lowrise pieces get dealt into the eight slots a screen shows,
             * so by pigeonhole the same building appears twice at once — nearly
             * two identical pairs per screen, measured. Mirroring only protects
             * *adjacent* twins, and mirroring a near-symmetrical shopfront does
             * not disguise it anyway.
             *
             * A band is not one plane, though. Some of those buildings are a
             * street further back, and a few percent more air in front of one
             * copy than the other is enough for the eye to file them as two
             * buildings rather than one repeated. Hashed off the slot, so a
             * given building keeps its depth as it crosses the screen.
             */
            const depth = fog ? (slotHash(p.slot, 77) - 0.5) * 0.26 : 0;
            // A building drawn for the distance wins over the detailed one, and
            // "wins" means nothing more than being present in the folder. See
            // `Piece.far` in `skyline.ts` for why there are two of each.
            const farSheet = p.piece.far ? LOADED.get(p.piece.far) : undefined;
            const sheet = farSheet ?? LOADED.get(p.piece.id);
            if (!sheet) continue;
            drew = true;
            // Drawn for the distance, or corrected into it? See `FAR_SHADE`.
            const keep = farSheet
                ? FAR_SHADE[band]
                : Math.min(1, SKY_SHADE[band] * shade);
            const bandHaze = Math.max(0, Math.min(0.95, 1 - keep));
            const img = fog
                ? fogged(sheet, farSheet ? p.piece.far! : p.piece.id, fog,
                    Math.max(0, Math.min(0.95, bandHaze + depth)))
                : sheet.img;
            ctx.save();
            if (!fog) ctx.globalAlpha = keep;
            ctx.imageSmoothingEnabled = smoothFor(ctx, sheet.fw, p.w);
            if (p.flip) {
                ctx.translate(p.x + p.w / 2, 0);
                ctx.scale(-1, 1);
                ctx.translate(-(p.x + p.w / 2), 0);
            }
            // `p.w`/`p.h`, not `p.piece.w`/`p.piece.h`: a band with `vary` deals
            // its pieces at a range of sizes, which is what stops the roofline
            // being one ruled edge across the screen.
            ctx.drawImage(
                img, 0, 0, sheet.fw, sheet.fh,
                p.x, p.y - p.h, p.w, p.h,
            );
            ctx.restore();
        }
    }
    return drew;
}

/** Has enough of the skyline kit arrived to be worth drawing? */
export const hasSkyline = (): boolean =>
    BANDS.towers.pieces.some((p) => LOADED.has(p.id) || (p.far ? LOADED.has(p.far) : false));

/**
 * How much of the horizon has been redrawn for the distance, 0..1.
 *
 * Once this reaches 1 the atmospheric correction in `SKY_SHADE` is fighting art
 * that no longer needs it, and those numbers should go back up. Exposed so that
 * is a thing somebody can check rather than a thing somebody remembers.
 */
export const farSkylineShare = (): number => {
    const pieces = [...BANDS.towers.pieces, ...BANDS.lowrise.pieces];
    const drawn = pieces.filter((p) => p.far && LOADED.has(p.far)).length;
    return pieces.length ? drawn / pieces.length : 0;
};
