/**
 * Drawing the world that refuses to acknowledge the gunfight.
 *
 * `backdrop.ts` decides who is in a section and what they are doing; this puts
 * them on screen. It is the same split as `layout.ts` / `platforms.ts`, for the
 * same reason: the population rules are worth testing without a browser, and
 * the sprite bookkeeping is not worth testing at all.
 *
 * ## Residents are made once, traffic is pooled
 *
 * The standing cast is fixed for the life of a section, so each one gets a
 * sprite at build time and keeps it. Crossings arrive and leave continuously —
 * a `bedlam` cabin runs about one every seven seconds — so they come out of a
 * pool. Creating and destroying a GameObject per donkey is the kind of thing
 * that looks free in a profile until a section has been open for four minutes.
 *
 * ## Why nothing here has a body
 *
 * No physics, no groups, no colliders: these are images at a depth below the
 * fight. A player who discovers the scenery is shootable will spend the level
 * shooting scenery, and the one thing this whole subsystem is selling is that
 * none of it is about them.
 */
import type * as PhaserNS from 'phaser';
import { T } from './textures';
import type { BackdropFrame, CrossingFrame } from './backdrop';

type Img = PhaserNS.GameObjects.Image;

/** Resident ids are their kind; the coffee crew's art is one sprite, not three. */
const residentTexture = (kind: string): string =>
    T(kind === 'coffee' ? 'bg-coffee-crew' : `bg-${kind}`);

const crossingTexture = (kind: string): string => T(`cross-${kind}`);

export interface BackdropView {
    residents: Img[];
    /** Reused across crossings; `active` marks the ones on screen this frame. */
    pool: Img[];
}

export const openView = (): BackdropView => ({ residents: [], pool: [] });

/**
 * Build the standing cast. Called once per section, after `openBackdrop`.
 */
export function buildResidents(
    scene: PhaserNS.Scene,
    view: BackdropView,
    frames: BackdropFrame[],
): void {
    for (const f of frames) {
        const img = scene.add.image(f.x, f.y, residentTexture(f.kind))
            .setOrigin(0.5, 1)
            // Residents get a facing picked when they are placed, and it used
            // to be computed and thrown away — so every coffee crew in the game
            // faced the same way and a section read as a wallpaper repeat.
            .setFlipX(f.facing < 0)
            .setDepth(f.depth)
            // Distance is sold with haze as much as with size. A far-plane actor
            // at full strength reads as a near one standing on a shelf.
            .setTint(shadeTint(f.shade))
            .setAlpha(0.92);
        view.residents.push(img);
    }
}

/**
 * A grey multiplier as a tint. Phaser multiplies the texture by this, so an
 * even grey darkens without shifting hue — which matters in a cabin drawn in
 * near-blacks, where a colour cast reads as a different object.
 */
export function shadeTint(shade: number): number {
    const v = Math.max(0, Math.min(255, Math.round(shade * 255)));
    return (v << 16) | (v << 8) | v;
}

/** Update the standing cast. They do not move; only the duck changes. */
export function stepResidents(view: BackdropView, frames: BackdropFrame[]): void {
    for (let i = 0; i < frames.length && i < view.residents.length; i++) {
        const img = view.residents[i];
        const f = frames[i];
        // Ducking is the one sanctioned reaction, and it is two seconds of
        // being lower. Squashing rather than translating keeps their feet on
        // the floor line, which is what stops it reading as a lift.
        img.setScale(1, f.ducking ? 0.72 : 1);
    }
}

/**
 * Draw this frame's traffic, growing the pool only when more is on screen at
 * once than ever has been before.
 */
export function stepCrossings(
    scene: PhaserNS.Scene,
    view: BackdropView,
    crossings: CrossingFrame[],
): void {
    for (let i = 0; i < crossings.length; i++) {
        const c = crossings[i];
        let img = view.pool[i];
        if (!img) {
            img = scene.add.image(0, 0, crossingTexture(c.kind)).setOrigin(0.5, 1);
            view.pool.push(img);
        }
        img.setTexture(crossingTexture(c.kind));
        img.setPosition(c.x, c.y);
        img.setDepth(c.depth);
        // Art is authored walking left to right, so the other direction is a
        // mirror. Nothing in the set is asymmetric by accident.
        img.setFlipX(c.facing < 0);
        // A balked crossing is standing still doing its bit; a shrug of scale
        // is enough to say "this one has stopped" without an extra sprite.
        img.setScale(c.balked ? 1.04 : 1, c.balked ? 0.96 : 1);
        img.setVisible(true);
    }
    // Anything the pool is still holding beyond this frame's traffic is hidden
    // rather than destroyed — it is the next donkey.
    for (let i = crossings.length; i < view.pool.length; i++) view.pool[i].setVisible(false);
}

/** Tear down a section's background. */
export function clearView(view: BackdropView | null): void {
    if (!view) return;
    for (const r of view.residents) r.destroy();
    for (const p of view.pool) p.destroy();
    view.residents.length = 0;
    view.pool.length = 0;
}
