/**
 * Things that break.
 *
 * Metal Slug's real texture is not its terrain, it is that *everything reacts*:
 * every crate, barrel, sign and vehicle comes apart with its own animation. The
 * cabin had exactly one interactive object — a parked drinks trolley used as
 * static cover — and nothing in the game could be destroyed at all.
 *
 * A prop is cover until you shoot it, which is the point: you and the throwers
 * want the same piece of furniture, and only one of you can remove it.
 *
 * The three-state shape (`idle → hit → explosion`) is lifted from how the
 * Metal Slug clones model obstacles, and it is better than the single
 * "destroyed" event this started as: a car that visibly takes damage before it
 * goes is readable, and naming the explosion instead of authoring one per prop
 * means five props share two blasts and the heavy ones read as heavy for free.
 */

import type { ExplosionKind } from './explosions';

export type PropKind =
    | 'crate'      // duty-free cases stacked in the aisle
    | 'cart'       // a parked drinks trolley
    | 'cooler'     // galley cooler, heavy, takes a beating
    | 'binDoor'    // a bin door hanging open — breaks into a gap you can climb
    | 'monitor';   // a seat-back screen, cosmetic, pure joy to destroy

export type DropKind = 'ammo' | 'health' | 'speed' | 'lighter' | null;

export interface PropDef {
    x: number;
    /** Top surface, if it is something you can stand on. Defaults to the floor. */
    y?: number;
    kind: PropKind;
    /**
     * Whether it holds you up until it breaks. A destroyed solid prop takes its
     * platform away with it, which is a real decision when it was your rung.
     */
    solid?: boolean;
    drop?: DropKind;
}

/** Hit points per kind. */
export const PROP_HP: Record<PropKind, number> = {
    crate: 18,
    cart: 34,
    cooler: 52,
    binDoor: 12,
    monitor: 6,
};

/** How likely each kind is to be hiding something, absent an authored drop. */
export const PROP_DROP_CHANCE: Record<PropKind, number> = {
    crate: 0.55,
    cart: 0.4,
    cooler: 0.7,
    binDoor: 0.25,
    monitor: 0,
};

/** Which blast it goes out on. Shared, not per-prop. */
export const PROP_BLAST: Record<PropKind, ExplosionKind> = {
    crate: 'small',
    cart: 'big',
    cooler: 'big',
    binDoor: 'small',
    monitor: 'tiny',
};

/** Sprite ids, so the art list and the scene cannot drift apart. */
export const PROP_ART: Record<PropKind, { idle: string; hit: string }> = {
    crate: { idle: 'crate', hit: 'crate-hit' },
    cart: { idle: 'cart', hit: 'cart-hit' },
    cooler: { idle: 'cooler', hit: 'cooler-hit' },
    binDoor: { idle: 'bin-open', hit: 'bin-open' },
    monitor: { idle: 'monitor', hit: 'monitor' },
};

/** Past this share of its health gone, it visibly stops being intact. */
export const HIT_AT = 0.5;

export const isHurt = (kind: PropKind, hp: number): boolean =>
    hp <= PROP_HP[kind] * HIT_AT;

export const artFor = (kind: PropKind, hp: number): string =>
    isHurt(kind, hp) ? PROP_ART[kind].hit : PROP_ART[kind].idle;
