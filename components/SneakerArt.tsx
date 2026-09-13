import React, { useEffect, useMemo, useRef } from 'react';
import Img from './Img';
import { SNEAKERS } from '../data/sneakers';
import { getSpriteDef, pickSprite } from './minigames/engine/draw';
import { bakeSprite } from '../systems/sprites/bake';
import { spriteSize } from '../systems/sprites/types';

/**
 * A sneaker rendered as pixel art instead of a placeholder photo.
 *
 * ---------------------------------------------------------------------------
 * Fallback strategy
 * ---------------------------------------------------------------------------
 * The shoe sprites live in `data/sprites/sneakers.ts`, which is authored
 * separately and may not exist yet. Nothing in this file imports it. Instead it
 * asks the sprite registry in `minigames/engine/draw.ts` for a sprite by id,
 * and that registry is populated by a build-time glob over whatever is actually
 * in `data/sprites/` (see `autoRegisterSpriteFiles` there).
 *
 * So there are three outcomes, in order:
 *   1. A sprite is registered for this sneaker -> bake it and draw pixel art.
 *   2. No per-sneaker sprite but a generic shoe sprite exists -> draw that.
 *   3. Nothing at all -> render the existing <Img> placeholder photo, exactly
 *      as SneakerCard does today.
 *
 * That means this component is safe to drop in anywhere right now: it can only
 * ever improve on the photo, never replace it with a hole.
 *
 * Sprite ids are probed in preference order rather than being hard-coded to one
 * naming scheme, because whoever authors `sneakers.ts` may reasonably namespace
 * them (`sneaker-chrono-glides`) or not (`chrono-glides`).
 */

/** Candidate sprite ids for a sneaker, most specific first. */
export function sneakerSpriteId(sneakerId: string): string | undefined {
    return pickSprite(
        `sneaker-${sneakerId}`,
        `shoe-${sneakerId}`,
        sneakerId,
        // Generic shoe, if the art pass shipped one before it shipped 45 pairs.
        'sneaker-generic',
        'sneaker',
        'shoe',
    );
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
    const spriteId = useMemo(() => sneakerSpriteId(sneakerId), [sneakerId]);
    const sneaker = useMemo(() => SNEAKERS.find(s => s.id === sneakerId), [sneakerId]);
    const label = alt ?? sneaker?.name ?? sneakerId;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !spriteId) return;
        const def = getSpriteDef(spriteId);
        if (!def) return;

        const { w, h } = spriteSize(def);
        if (!w || !h) return;

        // Integer upscale only — a fractional one would smear the pixel grid.
        const scale = Math.max(1, Math.floor(size / Math.max(w, h)));
        const baked = bakeSprite(def, { scale });

        canvas.width = baked.frameWidth;
        canvas.height = baked.frameHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Frame 0 only: a store card is a still life, not an animation.
        ctx.drawImage(baked.canvas, 0, 0, baked.frameWidth, baked.frameHeight, 0, 0, baked.frameWidth, baked.frameHeight);
    }, [spriteId, size]);

    // Outcome 3: no art authored for this sneaker yet. Keep the old behaviour.
    if (!spriteId) {
        return (
            <Img
                src={sneaker?.imageUrl}
                alt={label}
                loading="lazy"
                className={`object-contain ${className}`}
                style={{ width: size, height: size }}
            />
        );
    }

    return (
        <canvas
            ref={canvasRef}
            role="img"
            aria-label={label}
            className={`block ${className}`}
            style={{
                width: size,
                height: size,
                imageRendering: 'pixelated',
                objectFit: 'contain',
            }}
        />
    );
};

export default SneakerArt;
