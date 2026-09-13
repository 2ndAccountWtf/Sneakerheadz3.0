/**
 * The block-figure humanoid, ported to Phaser display objects.
 * ===========================================================
 * `engine/draw.ts:figure()` builds every character in the other six mini-games
 * out of ten rectangles on a 16-unit-tall grid. This reproduces that geometry
 * exactly — same unit maths, same proportions, same shoes — but each rectangle
 * is a tinted `Image` of the 1x1 `f4-px` texture inside a Container.
 *
 * Why that is better rather than merely different:
 *
 *  - **Facing is free.** The canvas version threads a `facing` multiplier
 *    through six arm/eye offsets (and gets negative widths out of it). Here the
 *    figure is authored facing right and mirrored with `scaleX = -1`.
 *  - **The figure is a tween target.** A knock-out is
 *    `tweens.add({ targets: fig.rig, angle: 720 })` plus an arcade velocity —
 *    the canvas version integrates the spin by hand and re-derives the
 *    translate/rotate/restore around every draw.
 *  - **Hurt flash is a tint,** not a second colour path through the draw call.
 *  - The whole character can be given one arcade body, so collision is the
 *    engine's problem.
 *
 * The rig is nested one level deep so rotation pivots around the *body centre*
 * while the Container's own position stays on the feet — which is what the
 * physics body and the floor both want.
 */
import type * as PhaserNS from 'phaser';
import { T, C } from './textures';

export interface Kit { main: number; trim: number; skin: number }

export interface Pose {
    /** 0..1 within a walk cycle; drives leg swing. */
    stride?: number;
    /** 0..1, raises the arms — punching, throwing, ranting into a megaphone. */
    armUp?: number;
    crouch?: boolean;
}

export interface BlockFigure extends PhaserNS.GameObjects.Container {
    /** Inner container; rotate/scale this, not the figure, to pivot mid-body. */
    rig: PhaserNS.GameObjects.Container;
    figH: number;
    setPose(pose: Pose): void;
    setFacing(facing: 1 | -1): void;
    setHurt(on: boolean): void;
    setKit(kit: Kit): void;
}

export type FigureFactory = (
    scene: PhaserNS.Scene, x: number, y: number, h: number, kit: Kit,
) => BlockFigure;

/**
 * Builds the figure class. Takes the Phaser namespace as an argument so this
 * module never statically imports Phaser (see PhaserHost).
 */
export function makeFigureFactory(P: typeof PhaserNS): FigureFactory {
    class Figure extends P.GameObjects.Container implements BlockFigure {
        rig: PhaserNS.GameObjects.Container;
        figH: number;
        private u: number;
        private kit: Kit;
        private hurt = false;

        private shade!: PhaserNS.GameObjects.Image;
        private legA!: PhaserNS.GameObjects.Image;
        private legB!: PhaserNS.GameObjects.Image;
        private shoeA!: PhaserNS.GameObjects.Image;
        private shoeB!: PhaserNS.GameObjects.Image;
        private torso!: PhaserNS.GameObjects.Image;
        private armFront!: PhaserNS.GameObjects.Image;
        private armBack!: PhaserNS.GameObjects.Image;
        private head!: PhaserNS.GameObjects.Image;
        private hair!: PhaserNS.GameObjects.Image;
        private eye!: PhaserNS.GameObjects.Image;

        constructor(scene: PhaserNS.Scene, x: number, y: number, h: number, kit: Kit) {
            super(scene, x, y);
            this.figH = h;
            this.u = h / 16;
            this.kit = kit;

            // Pivot the artwork around the body centre; the Container origin
            // (and therefore the physics body offset) stays on the feet.
            this.rig = scene.add.container(0, -h / 2);

            const px = (tint: number) => {
                const img = scene.add.image(0, 0, T('px')).setOrigin(0, 0).setTint(tint);
                this.rig.add(img);
                return img;
            };

            this.shade = scene.add.image(0, h / 2, T('shadow')).setOrigin(0.5, 0.5);
            this.shade.setDisplaySize(this.u * 6.5, this.u * 2.4);
            this.rig.add(this.shade);

            this.legA = px(kit.trim);
            this.legB = px(kit.trim);
            this.shoeA = px(C.white);
            this.shoeB = px(C.white);
            this.torso = px(kit.main);
            this.armBack = px(kit.skin);
            this.head = px(kit.skin);
            this.armFront = px(kit.skin);
            this.hair = px(kit.trim);
            this.eye = px(C.black);

            this.add(this.rig);
            scene.add.existing(this);
            this.setPose({});
        }

        /** Mirror the whole rig. Authored facing right. */
        setFacing(facing: 1 | -1) {
            this.rig.scaleX = facing;
        }

        setKit(kit: Kit) {
            this.kit = kit;
            this.setHurt(this.hurt);
        }

        /** White-out on hit. One tint pass, no second draw path. */
        setHurt(on: boolean) {
            this.hurt = on;
            const k = this.kit;
            this.legA.setTint(on ? C.white : k.trim);
            this.legB.setTint(on ? C.white : k.trim);
            this.torso.setTint(on ? C.white : k.main);
            this.armFront.setTint(on ? C.white : k.skin);
            this.armBack.setTint(on ? C.white : k.skin);
            this.head.setTint(on ? C.white : k.skin);
            this.hair.setTint(on ? C.white : k.trim);
            this.eye.setVisible(!on);
        }

        /**
         * Recomputes the ten rectangles. Identical unit maths to
         * `engine/draw.ts:figure()`, with `y` measured up from the feet and the
         * rig's +h/2 offset folded in, and with `facing` always 1 because the
         * mirror is a scale.
         */
        setPose({ stride = 0, armUp = 0, crouch = false }: Pose) {
            const u = this.u;
            const off = this.figH / 2;                 // rig is at -h/2
            const baseY = (crouch ? -u * 1.5 : 0) + off;
            const swing = Math.sin(stride * Math.PI * 2);

            const box = (
                img: PhaserNS.GameObjects.Image,
                x: number, y: number, w: number, h: number,
            ) => {
                img.setPosition(x, y);
                img.setDisplaySize(w, h);
            };

            box(this.legA, -u * 2.2 + swing * u, baseY - u * 5, u * 1.8, u * 5);
            box(this.legB, u * 0.4 - swing * u, baseY - u * 5, u * 1.8, u * 5);
            // Shoes — the whole point of the game.
            box(this.shoeA, -u * 2.6 + swing * u, baseY - u * 1.2, u * 2.6, u * 1.2);
            box(this.shoeB, u * 0.2 - swing * u, baseY - u * 1.2, u * 2.6, u * 1.2);

            const torsoH = crouch ? u * 4 : u * 5;
            box(this.torso, -u * 2.6, baseY - u * 5 - torsoH, u * 5.2, torsoH);

            const armY = baseY - u * 5 - torsoH + u * 0.6;
            const reach = armUp * u * 3;
            box(this.armFront, u * 2.6, armY - reach, u * 1.4, u * 3.4);
            box(this.armBack, -u * 3.4, armY - reach * 0.35, u * 1.4, u * 3.2);

            const headY = baseY - u * 5 - torsoH - u * 3.4;
            box(this.head, -u * 1.8, headY, u * 3.6, u * 3.4);
            box(this.hair, -u * 2, headY - u * 0.6, u * 4, u * 1.4);
            box(this.eye, u * 0.6, headY + u * 1.2, u * 0.7, u * 0.7);

            this.shade.setPosition(0, off);
        }
    }

    return (scene, x, y, h, kit) => new Figure(scene, x, y, h, kit);
}
