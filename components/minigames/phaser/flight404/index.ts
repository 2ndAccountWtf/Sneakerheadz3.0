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

        create() {
            bakeTextures(this);
            // UI first so it renders above the game scene.
            this.scene.launch(UI_KEY);
            this.scene.start(GAME_KEY);
        }
    }

    return [BootScene, makeGameScene(P, bus), makeUIScene(P, bus)];
}

export { GAME_KEY, UI_KEY };
