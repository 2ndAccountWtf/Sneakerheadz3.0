/**
 * Scene wiring for FLIGHT 404.
 *
 * `createFlight404Scenes` is what gets handed to PhaserHost's `createScenes`
 * prop. It receives the Phaser namespace from the dynamic import and builds the
 * three scene classes inside that call — which is the entire reason no module in
 * this folder contains `import Phaser from 'phaser'`. Type-only imports are
 * erased by the compiler, so the ~382KB engine stays in its own chunk and is
 * only fetched when a player actually opens this game.
 *
 * Three scenes, not one:
 *
 *   f404-boot  bakes every procedural texture, then hands over. Separating it
 *              means the game scene's `create()` is about the game, and the
 *              texture cache is guaranteed warm before anything asks for it.
 *   f404-game  the simulation and the world camera.
 *   f404-ui    the HUD, on its own camera, immune to the world camera's shake
 *              and scroll. See uiScene.ts for why that matters.
 *
 * Only the first scene in the array auto-starts, so Boot is responsible for
 * launching the other two.
 */
import type * as PhaserNS from 'phaser';
import { bakeTextures } from './textures';
import { queueArt, installArt, buildAnims, artCount, type ArtEntry } from './artLoader';
import { SKIN_IDS } from './skin';
import { SEAT_SIDE_ROWS } from './content';
import { makeGameScene, GAME_KEY } from './gameScene';
import { makeUIScene, UI_KEY } from './uiScene';

export const BOOT_KEY = 'f404-boot';

export function createFlight404Scenes(P: typeof PhaserNS): PhaserNS.Types.Scenes.SceneType[] {
    /**
     * One event bus, owned here and closed over by both scenes, so the HUD and
     * the simulation never hold a reference to each other. (Reaching across
     * with `this.scene.get('f404-game').events` also works, but it couples the
     * HUD to the game scene's key and to its lifecycle.)
     */
    const bus = new P.Events.EventEmitter();

    class BootScene extends P.Scene {
        constructor() { super({ key: BOOT_KEY }); }

        /** Delivered PNGs, queued here and installed once the loader is done. */
        private art: ArtEntry[] = [];

        preload() {
            // Hand-drawn art for this game lives in `assets/art/flight404/`.
            // Nothing read that folder until `artLoader.ts` existed — Flight 404
            // bakes its own textures and never called `bakeSprite`, so the
            // canvas games' art registry did not reach it and delivered files
            // silently did nothing. This is the half that was missing.
            this.art = queueArt(this);
        }

        create() {
            // Placeholders first, delivered art second: an id with a PNG gets
            // overwritten, an id without one keeps the coded version. That is
            // what makes a half-delivered set a better-looking game rather than
            // a broken one.
            bakeTextures(this);
            if (this.art.length) {
                // Ids drawn by code rather than by overwriting a baked
                // placeholder. Without them the orphan check reports art that
                // is on screen: it asks whether a texture of that name already
                // exists, which is true for the 29 scenery keys and false for a
                // coded rig or a new scenery module that had no placeholder to
                // replace in the first place.
                const drawnByCode = new Set<string>([...SKIN_IDS, ...SEAT_SIDE_ROWS]);
                const report = installArt(this, this.art, drawnByCode);
                buildAnims(this, this.art);
                for (const s of report.skipped) console.warn(`[f404 art] skipped ${s.id}: ${s.why}`);
                for (const o of report.orphans) {
                    console.warn(`[f404 art] "${o}" loaded but nothing in the game draws that id — check the name against docs/ASSETS-FLIGHT404.md`);
                }
                console.info(`[f404 art] ${report.installed.length}/${artCount()} delivered sprites in use`);
            }
            // UI first so it renders above the game scene.
            this.scene.launch(UI_KEY);
            this.scene.start(GAME_KEY);
        }
    }

    return [BootScene, makeGameScene(P, bus), makeUIScene(P, bus)];
}

export { GAME_KEY, UI_KEY };
