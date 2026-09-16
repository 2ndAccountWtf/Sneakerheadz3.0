/**
 * The cabin's furniture, as physics.
 *
 * `layout.ts` authors where every surface is and `terrain.ts` says what each
 * one does; this is the third of the three, and the only one that knows Phaser
 * exists. It takes a list of `PlatformDef` and produces bodies, colliders and
 * the per-frame effects the flags imply, so `gameScene.ts` gains an upstairs
 * by calling two functions rather than by growing another four hundred lines.
 *
 * ## Why the flags are handled here and not in the scene
 *
 * Every one of these behaviours is a two-line temptation at the call site. A
 * conveyor is "add velocity while standing on it"; slippery is "use a smaller
 * friction number"; one-way is "skip the collision when moving up". Written
 * inline they are two lines each and they are also six special cases in the
 * player update, invisible to the enemies, and impossible to test without a
 * running game.
 *
 * Written here they are one table. `apply` below is the whole of it, it takes
 * plain numbers, and `tests/flight404-platforms.test.mts` runs it with no
 * Phaser in the room at all.
 *
 * ## The one-way rule
 *
 * Arcade physics has no notion of a platform you can jump up through, so it is
 * a process callback: the collision is allowed only when the body is falling
 * *and* its feet were above the surface at the start of the frame. Checking the
 * velocity alone is the bug everybody writes — at the apex of a jump velocity
 * is zero for one frame, the collision is allowed, and the player lands on a
 * seat back from underneath.
 */
import type * as PhaserNS from 'phaser';
import {
    TILE, has, isFooting, conveyorDir,
    type PlatformDef,
} from './terrain';
import { FLOOR_Y, ART_SCALE } from './content';
import { T } from './textures';

/** How thick a platform body is. The top surface is what matters; this is depth. */
export const THICKNESS = 8;

/** Sideways pull of a belt, px/s. Enough to notice, not enough to be a ride. */
export const CONVEYOR_SPEED = 46;

/**
 * Ground friction, as the fraction of horizontal speed kept each frame when the
 * player is not pushing. The ordinary value is the scene's own 0.72.
 *
 * Ice is the classic way to make a surface feel bad rather than funny, so this
 * is deliberately close to 1 but not at it: you overshoot by about a body width,
 * which is a joke, rather than sliding into the next section, which is a
 * punishment.
 */
export const GRIP = 0.72;
export const SLIP = 0.955;

/** How much a destructible platform takes before it comes apart. */
export const PLATFORM_HP = 30;

export interface PlatformBody {
    def: PlatformDef;
    img: PhaserNS.GameObjects.Image;
    hp: number;
}

/**
 * What the surface under the player's feet does to them this frame.
 *
 * Pure, and deliberately so: this is the part that is easy to get wrong and
 * impossible to check by playing. It takes the flags and the current horizontal
 * velocity and returns the new one.
 */
export function apply(flags: number, vx: number, pushing: boolean): number {
    const drag = has(flags, TILE.SLIPPERY) ? SLIP : GRIP;
    const belt = conveyorDir(flags) * CONVEYOR_SPEED;
    // A belt moves you whether or not you are walking; friction only applies to
    // what you are not doing yourself. Adding the belt after the drag is what
    // makes standing still on one carry you, which is the entire gag.
    return (pushing ? vx : vx * drag) + belt;
}

/** Does standing here hurt? */
export const harms = (flags: number): boolean => has(flags, TILE.HURTS);

/**
 * May a body land on this surface right now?
 *
 * `feetWere` is the body's bottom edge at the *start* of the frame, which is
 * the only reliable way to tell "fell onto it" from "jumped up into it".
 */
export function lands(flags: number, feetWere: number, top: number, vy: number): boolean {
    if (!has(flags, TILE.ONE_WAY)) return true;
    return vy > 0 && feetWere <= top + 1;
}

export interface PlatformSet {
    solid: PhaserNS.Physics.Arcade.StaticGroup;
    /** Seats and other jump-through surfaces, which need the process callback. */
    oneWay: PhaserNS.Physics.Arcade.StaticGroup;
    /** Solid to enemies only. The player never learns these exist. */
    fences: PhaserNS.Physics.Arcade.StaticGroup;
    /** Drawn over the player, holding nobody up. */
    drapes: PhaserNS.GameObjects.Image[];
    bodies: PlatformBody[];
}

/**
 * Build one section's furniture.
 *
 * Static bodies live in their own R-tree, which the broadphase searches
 * separately — writing `body.position` moves the body but not its entry in that
 * tree, so the collider silently never fires. `updateFromGameObject` is the
 * only safe way to place one, and it is called on every body below for exactly
 * that reason. The same trap already cost this file's neighbour a bug; see the
 * trolley loop in `gameScene.ts`.
 */
export function buildPlatforms(
    scene: PhaserNS.Scene,
    defs: PlatformDef[],
): PlatformSet {
    const set: PlatformSet = {
        solid: scene.physics.add.staticGroup(),
        oneWay: scene.physics.add.staticGroup(),
        fences: scene.physics.add.staticGroup(),
        drapes: [],
        bodies: [],
    };

    for (const def of defs) {
        // Cloth holds nobody up: it is a picture with a high depth and no body.
        if (!isFooting(def) && !has(def.flags, TILE.ENEMY_WALL)) {
            const drape = scene.add.image(def.x + def.w / 2, def.y, T('hangingcloth'))
                .setDisplaySize(def.w, 26)
                .setOrigin(0.5, 0)
                .setDepth(14)
                .setAlpha(0.9);
            set.drapes.push(drape);
            continue;
        }

        const group = has(def.flags, TILE.ENEMY_WALL) && !isFooting(def) ? set.fences
            : has(def.flags, TILE.ONE_WAY) ? set.oneWay
            : set.solid;

        // These ids are the ones published in `docs/ASSETS-FLIGHT404.md`, and
        // they have to stay that way: a delivered PNG is matched to a texture by
        // this exact string. The pair drifted once already — the list said
        // `seat-row` and the code said `seatrow`, so the art loaded correctly,
        // installed correctly, and was drawn by nothing at all.
        const key = has(def.flags, TILE.DESTRUCTIBLE) ? T('crate')
            : has(def.flags, TILE.ONE_WAY) ? T('seat-row')
            : T('bulkhead-ledge');

        const img = group.create(def.x + def.w / 2, def.y, key) as PhaserNS.GameObjects.Image;
        img.setOrigin(0.5, 0);

        // What you see and what you stand on are different rectangles.
        //
        // The body is always the authored span by `THICKNESS`, because that is
        // what the reachability maths and every test are written against. The
        // *picture* is whatever the art actually is: a drawn seat row is 34x30
        // world units of upholstery whose top 8 are the standing surface, and
        // stretching all 30 into the collision box turns it into a smear.
        //
        // Delivered art therefore draws at its own size, derived from the
        // texture and the canvas zoom, hanging below the surface it sits on.
        // A coded placeholder has no such size and keeps filling the box.
        const src = img.texture.getSourceImage() as { width: number; height: number };
        const frames = Math.max(1, img.texture.frameTotal - 1);
        const natural = src && src.width ? { w: src.width / frames / ART_SCALE, h: src.height / ART_SCALE } : null;
        if (natural && natural.h > THICKNESS * 1.5) {
            img.setDisplaySize(Math.max(def.w, natural.w), natural.h);
        } else {
            img.setDisplaySize(def.w, THICKNESS);
        }
        // A fence is a rule, not a thing. The player must never see one.
        img.setVisible(!(has(def.flags, TILE.ENEMY_WALL) && !isFooting(def)));
        img.setDepth(11);
        img.setData('flags', def.flags);

        const sb = img.body as unknown as PhaserNS.Physics.Arcade.StaticBody;
        sb.setSize(def.w, THICKNESS, false);
        sb.position.set(def.x, def.y);
        sb.updateFromGameObject();
        sb.setSize(def.w, THICKNESS, false);
        // A fence is taller than a ledge or a charger steps over it.
        if (has(def.flags, TILE.ENEMY_WALL) && !isFooting(def)) {
            sb.setSize(4, FLOOR_Y - def.y + 30, false);
        }

        set.bodies.push({ def, img, hp: PLATFORM_HP });
    }

    return set;
}

/** Tear a section's furniture down. Called before the next one is built. */
export function clearPlatforms(set: PlatformSet | null): void {
    if (!set) return;
    set.solid.clear(true, true);
    set.oneWay.clear(true, true);
    set.fences.clear(true, true);
    for (const d of set.drapes) d.destroy();
    set.drapes.length = 0;
    set.bodies.length = 0;
}

/** The flags of whatever a body is standing on, or 0 for the plain aisle. */
export function footingFlags(
    set: PlatformSet | null,
    x: number,
    feet: number,
): number {
    if (!set) return 0;
    for (const b of set.bodies) {
        if (!isFooting(b.def)) continue;
        if (x < b.def.x || x > b.def.x + b.def.w) continue;
        if (Math.abs(feet - b.def.y) <= 2) return b.def.flags;
    }
    return 0;
}
