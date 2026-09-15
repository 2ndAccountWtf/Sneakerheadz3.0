/**
 * Hummus and falafel, on screen.
 *
 * `foodField.ts` runs the physics and hands back a list of what exists; this
 * draws it. Everything is pooled, because a spilled counter puts a few dozen
 * objects in the air at once and then takes them all away again, and creating a
 * GameObject per chickpea is the sort of thing that looks free until the fourth
 * minute of a section.
 */
import type * as PhaserNS from 'phaser';
import { T } from './textures';
import type { FoodField } from './foodField';
import { hummusAlpha } from './projectiles';

type Img = PhaserNS.GameObjects.Image;

export interface FoodView {
    pool: Img[];
}

export const openFoodView = (): FoodView => ({ pool: [] });

/** Which sprite a piece of food wants, given what it is doing. */
export const foodArt = (kind: string): string => T(kind);

/**
 * Draw one frame of the field.
 *
 * Takes the field rather than a list of frames because the field already *is*
 * the list: three arrays of plain objects with positions on them. Copying that
 * into a parallel shape would only create a way for the two to disagree.
 */
export function syncFood(
    scene: PhaserNS.Scene,
    view: FoodView,
    field: FoodField,
): void {
    let n = 0;
    const take = (key: string, x: number, y: number, alpha: number, angle = 0): void => {
        let img = view.pool[n];
        if (!img) { img = scene.add.image(0, 0, key).setDepth(13); view.pool.push(img); }
        if (img.texture.key !== key) img.setTexture(key);
        img.setPosition(x, y).setAlpha(alpha).setAngle(angle).setVisible(true);
        n++;
    };

    for (const h of field.hummus) {
        take(foodArt(h.phase === 'flight' ? 'hummus-blob' : h.stuckTo !== null ? 'hummus-worn' : 'hummus-smear'),
            h.x, h.y, hummusAlpha(h));
    }
    for (const f of field.falafel) {
        take(foodArt(f.settled ? 'falafel-crumb' : 'falafel-ball'), f.x, f.y, 1, f.spin * 12);
    }
    for (const b of field.bowls) {
        take(foodArt(b.broken ? 'bowl-burst' : 'bowl-roll'), b.x, b.y, 1);
    }
    for (let i = n; i < view.pool.length; i++) view.pool[i].setVisible(false);
}

export function clearFoodView(view: FoodView | null): void {
    if (!view) return;
    for (const img of view.pool) img.destroy();
    view.pool.length = 0;
}
