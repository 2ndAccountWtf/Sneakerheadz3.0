/**
 * Canvas drawing primitives shared by every mini-game.
 *
 * Two ways to draw a character live here. `figure()` builds a humanoid out of
 * rectangles (the original, still used by several games), and `actor()` draws a
 * real pixel-art sprite from data/sprites, falling back to `figure()` when no
 * sprite is registered for that id. Everything else is rectangles plus emoji
 * glyphs. Keeping the primitives in one place is what makes the separately
 * built games look related.
 */
import { PAL, KIT } from './palette';
import type { SpriteDef } from '../../../systems/sprites/types';
import type { PaletteSwap } from '../../../systems/sprites/palette';
import { SPRITE_PALETTE } from '../../../systems/sprites/palette';
import { bakeSprite, drawSprite, frameAt } from '../../../systems/sprites/bake';

export type Ctx = CanvasRenderingContext2D;

export const clear = (ctx: Ctx, w: number, h: number, color: string = PAL.void) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
};

export const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

export const outline = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string, lw = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.strokeRect(Math.round(x) + lw / 2, Math.round(y) + lw / 2, Math.round(w) - lw, Math.round(h) - lw);
};

export const circle = (ctx: Ctx, x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
};

export const line = (ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, lw = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
};

export interface TextOpts {
    size?: number;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    mono?: boolean;
    bold?: boolean;
}

export const text = (ctx: Ctx, str: string, x: number, y: number, opts: TextOpts = {}) => {
    const { size = 8, color = PAL.ink, align = 'left', baseline = 'top', mono = true, bold = false } = opts;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${mono ? "'IBM Plex Mono', ui-monospace, monospace" : "'Rajdhani', system-ui, sans-serif"}`;
    ctx.fillText(str, Math.round(x), Math.round(y));
};

/** Emoji or any glyph, drawn centred on (x, y). */
export const glyph = (ctx: Ctx, ch: string, x: number, y: number, size: number, rotation = 0, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rotation) ctx.rotate(rotation);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${size}px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif`;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
};

/** Soft elliptical ground shadow. */
export const shadow = (ctx: Ctx, x: number, y: number, rx: number, ry = rx * 0.35, alpha = 0.4) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PAL.black;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
};

/** Health / stamina / charge bar. */
export const bar = (
    ctx: Ctx, x: number, y: number, w: number, h: number,
    pct: number, color: string, bg: string = PAL.panel, flip = false,
) => {
    const clamped = Math.max(0, Math.min(1, pct));
    rect(ctx, x, y, w, h, bg);
    const fw = Math.round(w * clamped);
    rect(ctx, flip ? x + w - fw : x, y, fw, h, color);
    outline(ctx, x, y, w, h, PAL.line);
};

/**
 * A humanoid figure built from blocks. Used for every character in every game
 * so the cast looks like it belongs to one world.
 */
export interface FigureOpts {
    kit: { main: string; trim: string; skin: string };
    /** -1 faces left, 1 faces right. */
    facing?: 1 | -1;
    /** 0..1 within a walk cycle; drives leg swing. */
    stride?: number;
    /** Raises the arms — punching, shooting, shooting a basketball. */
    armUp?: number;
    crouch?: boolean;
    /** Flashes white when hit. */
    hurt?: boolean;
}

export const figure = (ctx: Ctx, x: number, y: number, h: number, opts: FigureOpts) => {
    const { kit, facing = 1, stride = 0, armUp = 0, crouch = false, hurt = false } = opts;
    const u = h / 16;                      // one "pixel" unit of the 16-unit tall figure
    const bodyColor = hurt ? PAL.white : kit.main;
    const skinColor = hurt ? PAL.white : kit.skin;
    const trimColor = hurt ? PAL.white : kit.trim;

    const baseY = crouch ? y - u * 1.5 : y;
    const swing = Math.sin(stride * Math.PI * 2);

    shadow(ctx, x, y + u * 0.5, u * 3);

    // Legs
    rect(ctx, x - u * 2.2 + swing * u, baseY - u * 5, u * 1.8, u * 5, trimColor);
    rect(ctx, x + u * 0.4 - swing * u, baseY - u * 5, u * 1.8, u * 5, trimColor);
    // Shoes — the whole point of the game
    rect(ctx, x - u * 2.6 + swing * u, baseY - u * 1.2, u * 2.6, u * 1.2, PAL.white);
    rect(ctx, x + u * 0.2 - swing * u, baseY - u * 1.2, u * 2.6, u * 1.2, PAL.white);

    // Torso
    const torsoH = crouch ? u * 4 : u * 5;
    rect(ctx, x - u * 2.6, baseY - u * 5 - torsoH, u * 5.2, torsoH, bodyColor);

    // Arms
    const armY = baseY - u * 5 - torsoH + u * 0.6;
    const reach = armUp * u * 3;
    rect(ctx, x + facing * u * 2.6, armY - reach, u * 1.4 * facing, u * 3.4, skinColor);
    rect(ctx, x - facing * u * 3.4, armY - reach * 0.35, u * 1.4 * facing, u * 3.2, skinColor);

    // Head
    const headY = baseY - u * 5 - torsoH - u * 3.4;
    rect(ctx, x - u * 1.8, headY, u * 3.6, u * 3.4, skinColor);
    // Hair / cap
    rect(ctx, x - u * 2, headY - u * 0.6, u * 4, u * 1.4, trimColor);
    // Eye
    if (!hurt) rect(ctx, x + facing * u * 0.6, headY + u * 1.2, u * 0.7, u * 0.7, PAL.black);
};

/** Scrolling parallax band — sky, skyline, road, whatever. */
export const band = (
    ctx: Ctx, y: number, h: number, w: number,
    offset: number, spacing: number, color: string,
    draw: (ctx: Ctx, x: number, y: number, h: number) => void,
) => {
    const start = -((offset % spacing) + spacing) % spacing;
    for (let x = start; x < w + spacing; x += spacing) {
        draw(ctx, x, y, h);
    }
};

/** Screen shake offset helper; call inside ctx.save()/restore(). */
export const shakeOffset = (intensity: number): [number, number] =>
    intensity <= 0 ? [0, 0] : [(Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity];

/** Big centred arcade banner ("KO!", "DUNK!", "MISSION COMPLETE"). */
export const banner = (ctx: Ctx, str: string, w: number, y: number, color: string, size = 20) => {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${size}px 'Bungee', Impact, system-ui, sans-serif`;
    ctx.lineWidth = Math.max(2, size / 7);
    ctx.strokeStyle = PAL.black;
    ctx.strokeText(str, w / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(str, w / 2, y);
    ctx.restore();
};

export { PAL, KIT };

/* ================================================================== *
 * Sprite-backed actors                                               *
 * ================================================================== *
 *
 * `figure()` above is the original block humanoid. It stays exactly as it was
 * because several games still call it, and because it is the FALLBACK for the
 * sprite path below.
 *
 * The sprite path works like this:
 *
 *   1. Art lives in `data/sprites/*.ts` as `SpriteDef` character grids.
 *   2. Everything found there is registered into a small id -> SpriteDef map.
 *   3. Game code says `actor(ctx, 'player', x, y, {...})` — a STRING id, never
 *      an import. That is the decoupling: a game never names the file that drew
 *      its cast, so art files can land, move or be renamed without touching
 *      gameplay code.
 *   4. If nothing is registered under that id, `actor()` draws `figure()`
 *      instead. So a missing, unwritten or mid-rewrite art file degrades to the
 *      old block figure rather than to an invisible character.
 *
 * Discovery is deliberately defensive (see `autoRegisterSpriteFiles` below):
 * `data/sprites/cast.ts`, `sneakers.ts` and `items.ts` are authored
 * independently and may not exist at all. Nothing here imports them by name.
 */


/** Authored sprite dimensions. Every character grid in data/sprites is this size. */
export const SPRITE_W = 16;
export const SPRITE_H = 24;

/**
 * Default logical pixels per authored pixel.
 *
 * The games draw at 320x180 / 352x198, and the block figures they replace stood
 * roughly 32-34 logical px tall. 24 authored rows * 1.42 lands in that band, so
 * a sprite occupies the same slice of the screen its block ancestor did and no
 * game geometry has to move. Games that already track a figure height should
 * pass `height` instead and let this be derived.
 */
export const ACTOR_SCALE = 34 / SPRITE_H;

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const spriteRegistry = new Map<string, SpriteDef>();

/** Anything with an id and a grid of rows is treated as a sprite. */
const looksLikeSprite = (v: unknown): v is SpriteDef => {
    if (!v || typeof v !== 'object') return false;
    const d = v as Partial<SpriteDef>;
    return typeof d.id === 'string'
        && Array.isArray(d.frames)
        && d.frames.length > 0
        && Array.isArray(d.frames[0])
        && typeof d.frames[0][0] === 'string';
};

/**
 * Adds sprites to the registry. Accepts an array, a map, or a whole ES module
 * namespace — the last one is what lets a data file be picked up without this
 * module knowing a single export name inside it.
 */
export function registerSprites(defs: SpriteDef[] | Record<string, unknown>): void {
    const values = Array.isArray(defs) ? defs : Object.values(defs);
    for (const v of values) {
        if (looksLikeSprite(v)) {
            spriteRegistry.set(v.id, v);
        } else if (Array.isArray(v)) {
            // Barrel exports such as `CHARACTER_SPRITES: SpriteDef[]`.
            for (const inner of v) if (looksLikeSprite(inner)) spriteRegistry.set(inner.id, inner);
        }
    }
}

/** The SpriteDef registered under `id`, or undefined if nobody authored one. */
export function getSpriteDef(id: string): SpriteDef | undefined {
    return spriteRegistry.get(id);
}

/** Cheap existence check for callers that want to choose their own fallback. */
export function hasSprite(id: string): boolean {
    return spriteRegistry.has(id);
}

/** First id that actually has art. Lets callers pass a preference order. */
export function pickSprite(...ids: (string | undefined | null)[]): string | undefined {
    for (const id of ids) if (id && spriteRegistry.has(id)) return id;
    return undefined;
}

/** Every registered id. Useful for previews and tests. */
export function registeredSpriteIds(): string[] {
    return [...spriteRegistry.keys()].sort();
}

/**
 * Pulls in every sprite file that exists, without naming any of them.
 *
 * `import.meta.glob` is resolved by Vite at BUILD time against the files
 * actually on disk, so `data/sprites/cast.ts`, `sneakers.ts` and `items.ts` are
 * picked up if present and simply absent from the result if not — no import to
 * fail, no build to break. Under plain Node (the test runner) `import.meta.glob`
 * does not exist at all, hence the try/catch: tests get an empty registry and
 * `actor()` falls through to `figure()`, which is exactly the intended
 * degradation.
 */
function autoRegisterSpriteFiles(): void {
    try {
        const mods = (import.meta as unknown as {
            glob: (p: string, o: { eager: boolean }) => Record<string, Record<string, unknown>>;
        }).glob('../../../data/sprites/*.ts', { eager: true });
        for (const mod of Object.values(mods)) registerSprites(mod);
    } catch {
        // Not running under Vite. Nothing to discover; figure() covers it.
    }
}

autoRegisterSpriteFiles();

/* ------------------------------------------------------------------ */
/* Hurt flash                                                          */
/* ------------------------------------------------------------------ */

/**
 * The white hit-flash, as a palette swap: every colour becomes white except the
 * outline chars, so the silhouette survives and the character reads as "struck"
 * rather than "deleted". Built once; bakeSprite caches per swap so the flashed
 * variant is baked at most once per sprite.
 */
const HURT_SWAP: PaletteSwap = Object.keys(SPRITE_PALETTE).reduce<PaletteSwap>((acc, ch) => {
    if (ch !== '.' && ch !== ' ' && ch !== 'o' && ch !== 'O') acc[ch] = 'W';
    return acc;
}, {});

const mergeSwap = (base: PaletteSwap | undefined, hurt: boolean): PaletteSwap | undefined => {
    if (!hurt) return base;
    // Hurt wins: the flash is applied on top of whatever kit swap was in play.
    return { ...base, ...HURT_SWAP };
};

/* ------------------------------------------------------------------ */
/* actor()                                                             */
/* ------------------------------------------------------------------ */

/** Positive modulo — JS `%` keeps the sign of the dividend, which we never want here. */
const wrap = (n: number, m: number): number => (m <= 0 ? 0 : ((n % m) + m) % m);

export interface ActorOpts {
    /** -1 faces left, 1 faces right. Sprites are authored facing right. */
    facing?: 1 | -1;
    /** Explicit frame index. Wins over `stride` and `elapsed`. */
    frame?: number;
    /** Animation clock in seconds; used with the sprite's own fps. */
    elapsed?: number;
    /** 0..1 within a walk cycle. Picks a frame when `frame` is not given. */
    stride?: number;
    /** Logical pixels per authored pixel. Defaults to ACTOR_SCALE. */
    scale?: number;
    /** Target height in logical px. Overrides `scale` — scale = height / 24. */
    height?: number;
    /** Colours for the figure() fallback only; sprites recolour via `swap`. */
    kit?: FigureOpts['kit'];
    /** White hit-flash. */
    hurt?: boolean;
    /** Palette recolour, e.g. { c: 'm', C: 'M' } to turn a teal kit magenta. */
    swap?: PaletteSwap;
    alpha?: number;
    /** Radians, about the sprite's anchor. Used for knockdowns. */
    rotation?: number;
    /** Palette char for a 1px silhouette outline. */
    outline?: string;
    /** Ground shadow, as figure() draws. On by default. */
    shadow?: boolean;
    /* --- passed straight through to figure() when there is no sprite --- */
    armUp?: number;
    crouch?: boolean;
}

/**
 * Draws a registered sprite by id, falling back to `figure()` if it is missing.
 *
 * (x, y) is the character's FEET, matching `figure()` — sprites anchor at
 * feet-centre by default, so the two paths are interchangeable and a game can
 * be flipped between them without moving anything.
 */
export function actor(ctx: Ctx, spriteId: string, x: number, y: number, opts: ActorOpts = {}): void {
    const {
        facing = 1, frame, elapsed = 0, stride, scale, height,
        kit, hurt = false, swap, alpha = 1, rotation = 0, outline: outlineChar,
        shadow: withShadow = true, armUp = 0, crouch = false,
    } = opts;

    const def = getSpriteDef(spriteId);
    const px = height !== undefined ? height / SPRITE_H : (scale ?? ACTOR_SCALE);

    if (!def) {
        // No art for this id — draw the block humanoid so the character is
        // still visible and still in the right place. This is the whole reason
        // figure() is untouched.
        figure(ctx, x, y, px * SPRITE_H, {
            kit: kit ?? KIT.player,
            facing, stride: stride ?? 0, armUp, crouch, hurt,
        });
        return;
    }

    // Bake at an integer scale (crisp pixels in the source texture), then let
    // drawSprite cover the fractional remainder. Hoops scales its cast
    // continuously with depth, so a fractional draw scale is unavoidable there.
    const bakeScale = Math.max(1, Math.round(px));
    const baked = bakeSprite(def, {
        scale: bakeScale,
        swap: mergeSwap(swap, hurt),
        flip: facing === -1,
        outline: outlineChar,
    });

    if (withShadow) shadow(ctx, x, y, px * 3.2, px * 1.1, 0.4);

    // Frame choice, in priority order. Wrapped with a POSITIVE modulo: games
    // hand over strides like `Math.sin(t) * 0.02`, which go negative, and a
    // negative frame index would make drawImage sample outside the sheet and
    // silently draw nothing at all.
    let f = 0;
    if (frame !== undefined) f = Math.floor(frame);
    else if (stride !== undefined && baked.frameCount > 1) f = Math.floor(stride * baked.frameCount);
    else f = frameAt(baked, elapsed);

    drawSprite(ctx, baked, x, y, wrap(f, baked.frameCount), {
        alpha,
        rotation,
        scale: px / bakeScale,
    });
}

/**
 * Kit colour -> palette swap. Sprites are authored with c/C as the kit colour
 * and s/S as skin, by convention, so a whole cast recolours from one table.
 * This is how HoopsGame and StreetFighter keep their old colourways: the player
 * stays teal (c/C is already teal, hence the empty swap) and the rival magenta.
 */
export const SWAP: Record<string, PaletteSwap> = {
    teal: {},
    magenta: { c: 'm', C: 'M' },
    green: { c: 'n', C: 'N' },
    gold: { c: 'y', C: 'Y' },
    violet: { c: 'p', C: 'P' },
    red: { c: 'r', C: 'R' },
    denim: { c: 'b', C: 'B' },
    /** Darker skin, combinable with any of the above via spread. */
    skinDark: { s: 'k', S: 'K' },
};

export type { SpriteDef, PaletteSwap };
