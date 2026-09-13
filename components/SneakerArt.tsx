import React, { useEffect, useMemo, useRef } from 'react';
import Img from './Img';
import { SNEAKERS } from '../data/sneakers';
import { getSpriteDef, pickSprite } from './minigames/engine/draw';
import { bakeSprite } from '../systems/sprites/bake';
import { spriteSize } from '../systems/sprites/types';
import type { SpriteDef } from '../systems/sprites/types';
import type { PaletteSwap } from '../systems/sprites/palette';

/**
 * A sneaker rendered as pixel art instead of a placeholder photo.
 *
 * ---------------------------------------------------------------------------
 * Fallback strategy
 * ---------------------------------------------------------------------------
 * The shoe sprites live in `data/sprites/sneakers.ts`, which is authored
 * separately and may not exist. NOTHING IN THIS FILE IMPORTS IT BY NAME. It is
 * reached two ways, both build-time globs that evaluate to nothing when the
 * file is absent:
 *
 *   - the sprite registry in `minigames/engine/draw.ts`, which globs every
 *     `data/sprites/*.ts` and registers whatever SpriteDefs it finds;
 *   - `lookForSneaker`, that file's own sneaker-id -> (archetype, colourway)
 *     resolver, duck-typed out of the module if it is there (see below).
 *
 * Resolution order, ending in the old behaviour:
 *   1. The art file's resolver: 45 models onto ~10 archetype silhouettes plus a
 *      palette swap. This is how the shoes are actually authored.
 *   2. A sprite registered under a per-sneaker id, for a future bespoke pair.
 *   3. A generic shoe sprite, if only one exists yet.
 *   4. Nothing at all -> the existing <Img> placeholder photo, exactly as
 *      SneakerCard renders today.
 *
 * So this component is safe to drop in anywhere right now: it can only ever
 * improve on the photo, never replace it with a hole.
 */

/**
 * The art file's own sneaker-id -> (archetype, colourway) resolver, if it has
 * one, reached WITHOUT importing the file by name.
 *
 * `import.meta.glob` is resolved by Vite at build time against what is on disk,
 * so a pattern matching one file yields either that module or nothing at all —
 * an absent `data/sprites/sneakers.ts` is simply an empty object, never an
 * unresolved import. The shape is duck-typed for the same reason: this file
 * must not break if the art pass renames its helper.
 */
type LookResolver = (id: string) => { archetype: string; swap?: PaletteSwap } | undefined;

const lookResolver: LookResolver | null = (() => {
    try {
        const mods = (import.meta as unknown as {
            glob: (p: string, o: { eager: boolean }) => Record<string, Record<string, unknown>>;
        }).glob('../data/sprites/sneakers.ts', { eager: true });
        for (const mod of Object.values(mods)) {
            const fn = mod.lookForSneaker;
            if (typeof fn === 'function') return fn as LookResolver;
        }
    } catch {
        // Not running under Vite, or no such file. Fall through to id probing.
    }
    return null;
})();

/** What to draw for a sneaker: a registered sprite plus an optional recolour. */
export interface ResolvedSneakerArt {
    def: SpriteDef;
    swap?: PaletteSwap;
}

/**
 * Three resolution strategies, tried in order, then the photo.
 *
 *   1. The art file's own resolver — 45 models onto ~10 archetypes plus a
 *      colourway swap, which is how the shoes are actually authored.
 *   2. A sprite registered under a per-sneaker id, in case someone later draws
 *      a bespoke pair. Probed under several naming conventions so this file is
 *      not coupled to one.
 *   3. A generic shoe sprite, if only one exists yet.
 */
export function resolveSneakerArt(sneakerId: string): ResolvedSneakerArt | undefined {
    const look = lookResolver?.(sneakerId);
    const fromLook = look && getSpriteDef(look.archetype);
    if (fromLook) return { def: fromLook, swap: look?.swap };

    const id = pickSprite(
        `sneaker-${sneakerId}`,
        `shoe-${sneakerId}`,
        sneakerId,
        // Generic shoe, if the art pass shipped one before it shipped 45 pairs.
        'sneaker-generic',
        'sneaker',
        'shoe',
        'shoe-lowtop',
    );
    const def = id ? getSpriteDef(id) : undefined;
    return def ? { def } : undefined;
}

export interface SneakerArtProps {
    sneakerId: string;
    /** Box size in CSS pixels. The sprite is upscaled to the nearest fit. */
    size?: number;
    className?: string;
    /** Overrides the alt text derived from the sneaker catalogue. */
    alt?: string;
}

export const SneakerArt: React.FC<SneakerArtProps> = ({
    sneakerId, size = 64, className = '', alt,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const art = useMemo(() => resolveSneakerArt(sneakerId), [sneakerId]);
    const sneaker = useMemo(() => SNEAKERS.find(s => s.id === sneakerId), [sneakerId]);
    const label = alt ?? sneaker?.name ?? sneakerId;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !art) return;
        const { def, swap } = art;

        const { w, h } = spriteSize(def);
        if (!w || !h) return;

        // Integer upscale only — a fractional one would smear the pixel grid.
        const scale = Math.max(1, Math.floor(size / Math.max(w, h)));
        // `variant` is the sneaker's own id, so a hand-drawn
        // `shoe-lowtop-panda.png` can replace one colourway without claiming
        // every other shoe built on the same silhouette.
        const baked = bakeSprite(def, { scale, swap, variant: sneakerId });

        canvas.width = baked.frameWidth;
        canvas.height = baked.frameHeight;
        // Letterbox inside the requested box rather than stretching: shoe
        // sprites are wide, character sprites are tall, and neither should be
        // squashed to fit a square card slot.
        const fit = Math.min(size / baked.frameWidth, size / baked.frameHeight);
        canvas.style.width = `${Math.round(baked.frameWidth * fit)}px`;
        canvas.style.height = `${Math.round(baked.frameHeight * fit)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Frame 0 only: a store card is a still life, not an animation.
        ctx.drawImage(baked.canvas, 0, 0, baked.frameWidth, baked.frameHeight, 0, 0, baked.frameWidth, baked.frameHeight);
    }, [art, size]);

    // Outcome 3: no art authored for this sneaker yet. Keep the old behaviour.
    if (!art) {
        return (
            <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
                <Img
                    src={sneaker?.imageUrl}
                    alt={label}
                    loading="lazy"
                    className="max-w-full max-h-full w-full h-full object-contain"
                />
            </div>
        );
    }

    return (
        <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
            <canvas
                ref={canvasRef}
                role="img"
                aria-label={label}
                className="block"
                style={{ imageRendering: 'pixelated' }}
            />
        </div>
    );
};

export default SneakerArt;
