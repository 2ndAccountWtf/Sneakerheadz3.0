/**
 * The blast library.
 *
 * Named, shared explosions rather than one authored per object — the pattern
 * the Metal Slug clones use (`medium_explosion`, `big_explosion` referenced by
 * every obstacle). Five props and two blasts means the heavy things read as
 * heavy without five bespoke effects, and a new prop costs nothing to dress.
 */

export type ExplosionKind = 'tiny' | 'small' | 'big';

export interface ExplosionDef {
    /** Sprite id in `assets/art/flight404/`. */
    art: string;
    frames: number;
    /** Seconds for the whole sequence. */
    duration: number;
    /** Screen shake, in the same units the scene already uses. */
    shake: number;
    /** Radius within which the blast itself hurts. Zero means cosmetic only. */
    hurtRadius: number;
    damage: number;
}

export const EXPLOSIONS: Record<ExplosionKind, ExplosionDef> = {
    tiny: { art: 'monitor-debris', frames: 4, duration: 0.28, shake: 0.5, hurtRadius: 0, damage: 0 },
    small: { art: 'explosion-small', frames: 7, duration: 0.42, shake: 2, hurtRadius: 14, damage: 6 },
    big: { art: 'explosion-big', frames: 9, duration: 0.6, shake: 5, hurtRadius: 26, damage: 14 },
};

/** Does standing here get you hurt by this blast? */
export const caughtInBlast = (kind: ExplosionKind, distance: number): boolean => {
    const e = EXPLOSIONS[kind];
    return e.hurtRadius > 0 && distance <= e.hurtRadius;
};
