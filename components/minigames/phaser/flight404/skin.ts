/**
 * Hand-drawn characters, over the top of the block figures.
 *
 * Every actor in this game is a `BlockFigure`: a Container with an arcade body,
 * holding a rig of coloured rectangles that `setPose` animates. That rig is
 * what made a cast of twenty possible with no art at all, and it is also the
 * thing the delivered sprites replace.
 *
 * **The Container stays.** It carries the physics body, the depth, the speech
 * bubble anchor and every position the scene has ever set, so replacing a
 * figure means hiding the rectangles inside it and adding one Sprite in their
 * place — not swapping the object. Nothing outside this file learns that a
 * figure is drawn differently, which is why `stepPlayer` and `stepMook` are
 * untouched by all of this.
 *
 * ## States, not frames
 *
 * The scene already knows what an actor is doing — running, mid-jump, winding
 * up a throw — because it has to, to pose the rig. So a skin takes that same
 * state name and finds the animation for it. A state with no delivered art
 * falls back to the nearest one that has some, and a role with no art at all
 * returns null and leaves the rig alone: a half-delivered cast is a cabin where
 * the player is drawn and the mooks are still blocks, which is exactly what
 * should happen while art is still arriving.
 */
import type * as PhaserNS from 'phaser';
import { T } from './textures';
import { animKey } from './artLoader';
import { ZOOM } from './content';
import type { BlockFigure } from './figure';

/** What each role can be doing, and the sprite id for it. */
export type SkinSet = Record<string, string>;

/**
 * The state vocabulary, per role.
 *
 * Keys are the scene's words for what is happening, values are asset-list ids.
 * Adding a state here is how a new animation gets used; nothing else changes.
 */
export const SKINS: Record<string, SkinSet> = {
    player: {
        idle: 'player-idle',
        run: 'player-run',
        jump: 'player-jump',
        crouch: 'player-crouch',
        shoot: 'player-shoot',
        shootUp: 'player-shoot-up',
        hurt: 'player-hurt',
        die: 'player-die',
    },
    charger: { idle: 'mook-charger-run', run: 'mook-charger-run', die: 'mook-charger-die' },
    thrower: { idle: 'mook-thrower-idle', throw: 'mook-thrower-throw', die: 'mook-thrower-die' },
    hostage: { idle: 'hostage-tied', freed: 'hostage-freed' },
    yasser: { idle: 'yasser-idle', throw: 'yasser-throw', run: 'yasser-charge', die: 'yasser-defeat' },
    scalper: { idle: 'scalper-approach', run: 'scalper-approach', throw: 'scalper-throw', photo: 'scalper-photo', grab: 'scalper-grab', die: 'scalper-die' },
    hypebeast: { idle: 'hypebeast-stalk', run: 'hypebeast-stalk', wind: 'hypebeast-wind', charge: 'hypebeast-charge', stunned: 'hypebeast-stunned', die: 'hypebeast-die' },
    reseller: { idle: 'reseller-seek', run: 'reseller-seek', bag: 'reseller-bag', flee: 'reseller-flee', die: 'reseller-drop' },
    security: { idle: 'security-patrol', run: 'security-patrol', attack: 'security-baton', radio: 'security-radio', die: 'security-die' },
    shopOwner: { idle: 'owner-stock', run: 'owner-stock', throw: 'owner-throw', tidy: 'owner-tidy', die: 'owner-die' },
    falafelGuy: { idle: 'falafel-serve', spill: 'falafel-spill', recover: 'falafel-recover' },
};

/** Where a state falls back to when its own art has not arrived. */
const FALLBACK: Record<string, string> = {
    run: 'idle', jump: 'idle', crouch: 'idle', shoot: 'idle', shootUp: 'shoot',
    hurt: 'idle', throw: 'idle', photo: 'idle', grab: 'idle', bag: 'idle',
    flee: 'run', radio: 'idle', tidy: 'idle', attack: 'idle', wind: 'idle',
    charge: 'run', stunned: 'idle', spill: 'idle', recover: 'idle',
    freed: 'idle', die: 'idle',
};

export interface Skin {
    sprite: PhaserNS.GameObjects.Sprite;
    set: SkinSet;
    state: string;
    /** Play a state. Cheap to call every frame; a repeat is ignored. */
    play(state: string, facing: 1 | -1): void;
}

const has = (scene: PhaserNS.Scene, id: string): boolean => scene.textures.exists(T(id));

/** Walk the fallback chain until something has been delivered. */
function resolve(scene: PhaserNS.Scene, set: SkinSet, state: string): string | null {
    const seen = new Set<string>();
    let s: string | undefined = state;
    while (s && !seen.has(s)) {
        seen.add(s);
        const id = set[s];
        if (id && has(scene, id)) return id;
        s = FALLBACK[s];
    }
    // Nothing in the chain: take whatever this role does have, so a delivered
    // `die` sheet still beats a blank.
    for (const id of Object.values(set)) if (has(scene, id)) return id;
    return null;
}

/**
 * Give a figure a drawn skin, if there is art for its role.
 *
 * Returns null when there is not, and the caller keeps its rig. The rig is only
 * hidden once a sprite is definitely going to replace it, so a missing file can
 * never leave an invisible character.
 */
export function attachSkin(
    scene: PhaserNS.Scene,
    figure: BlockFigure,
    role: string,
    height: number,
): Skin | null {
    const set = SKINS[role];
    if (!set) return null;
    const first = resolve(scene, set, 'idle');
    if (!first) return null;

    const sprite = scene.add.sprite(0, 0, T(first)).setOrigin(0.5, 1);
    figure.add(sprite);
    figure.rig.setVisible(false);

    const skin: Skin = {
        sprite,
        set,
        state: '',
        play(state: string, facing: 1 | -1) {
            const id = resolve(scene, set, state);
            if (!id) return;
            const key = T(id);
            if (this.state !== state) {
                this.state = state;
                // An animation exists only for multi-frame sheets; a single
                // frame is set directly rather than played, because asking
                // Phaser to play a one-frame animation logs a warning per call
                // and there is one of these per actor per frame.
                if (scene.anims.exists(animKey(id))) sprite.play(animKey(id), true);
                else { sprite.stop(); sprite.setTexture(key); }
            }
            sprite.setFlipX(facing < 0);
            // Art may arrive at world size or at ART_SCALE. Pick whichever
            // reading puts the sprite nearest the height the game expects, so
            // both deliveries look right without a flag in the filename.
            const texH = sprite.frame.height;
            const scale = Math.abs(texH - height) <= Math.abs(texH / ZOOM - height) ? 1 : 1 / ZOOM;
            sprite.setScale(scale);
        },
    };
    skin.play('idle', 1);
    return skin;
}
