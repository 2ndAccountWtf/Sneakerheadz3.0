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
import { ZOOM, FIGURE_SCALE } from './content';
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
        // Four things used to share one flinch: a thrown item, a shoulder
        // charge, standing in a hazard and a boss hit. They are not the same
        // event, and the hardest of them read as the softest.
        hurtThrown: 'player-hurt-thrown',
        hurtBody: 'player-hurt-body',
        hurtHazard: 'player-hurt-hazard',
        trampled: 'player-trampled',
        doused: 'player-doused',
        die: 'player-die',
    },
    charger: { idle: 'mook-charger-run', run: 'mook-charger-run', die: 'mook-charger-die' },
    thrower: { idle: 'mook-thrower-idle', throw: 'mook-thrower-throw', die: 'mook-thrower-die' },
    hostage: { idle: 'hostage-tied', freed: 'hostage-freed' },
    yasser: { idle: 'yasser-idle', throw: 'yasser-throw', run: 'yasser-charge', die: 'yasser-defeat', hit: 'yasser-hit' },
    scalper: { idle: 'scalper-approach', run: 'scalper-approach', throw: 'scalper-throw', photo: 'scalper-photo', grab: 'scalper-grab', die: 'scalper-die', hit: 'scalper-hit' },
    hypebeast: { idle: 'hypebeast-stalk', run: 'hypebeast-stalk', wind: 'hypebeast-wind', charge: 'hypebeast-charge', stunned: 'hypebeast-stunned', die: 'hypebeast-die', hit: 'hypebeast-hit' },
    reseller: { idle: 'reseller-seek', run: 'reseller-seek', bag: 'reseller-bag', flee: 'reseller-flee', die: 'reseller-drop', hit: 'reseller-hit' },
    security: { idle: 'security-patrol', run: 'security-patrol', attack: 'security-baton', radio: 'security-radio', die: 'security-die', hit: 'security-hit' },
    shopOwner: { idle: 'owner-stock', run: 'owner-stock', throw: 'owner-throw', tidy: 'owner-tidy', die: 'owner-die', hit: 'owner-hit' },
    falafelGuy: { idle: 'falafel-serve', spill: 'falafel-spill', recover: 'falafel-recover' },
};

/**
 * How fast each state plays, in frames per second.
 *
 * A flat rate across every state is the single biggest thing that makes drawn
 * animation look cheap, and it was what this did: a two-frame flinch and an
 * eight-frame run cycle both ran at 10fps, so the flinch was a slow blink and
 * the run was a man wading. These are per-state because they are per-state
 * facts — a wind-up is slow so it can be read, a muzzle flash is instant
 * because it is light.
 *
 * `run` is absent on purpose: its rate comes from how fast the character is
 * actually moving. See `runRate`.
 */
export const RATE: Record<string, number> = {
    idle: 6, crouch: 6, jump: 12, shoot: 18, shootUp: 18, hurt: 14, die: 9,
    throw: 14, photo: 7, grab: 12, bag: 12, flee: 16, radio: 6, tidy: 7,
    attack: 16, wind: 9, charge: 14, stunned: 5, spill: 12, recover: 7, freed: 10,
    hit: 15, hurtThrown: 14, hurtBody: 12, hurtHazard: 8, trampled: 11, doused: 10,
};
export const DEFAULT_RATE = 8;

/**
 * States that happen once and then hold their last frame.
 *
 * Everything used to loop, so a death animation played forever and the corpse
 * twitched, a flinch strobed for as long as the invulnerability lasted, and a
 * shot kept firing after the bullet had gone. A one-shot that holds is also
 * what lets the last frame of a death be the thing left lying on the floor.
 */
export const ONCE = new Set([
    'shoot', 'shootUp', 'hurt', 'die', 'throw', 'grab', 'bag', 'spill',
    // Getting hit ends back where the idle begins, so it plays once and holds.
    // `hurtHazard` is deliberately absent: hazard damage ticks for as long as
    // you stand in it, so that one has to be a loop.
    'hit', 'hurtThrown', 'hurtBody', 'trampled', 'doused',
]);

/**
 * How fast a run cycle should play so the feet stay planted.
 *
 * A cycle covers one full stride pair, which for a figure this tall is about
 * its own height in ground distance. Tie the rate to speed and the feet stop
 * skating; leave it fixed and the character moonwalks at every speed except the
 * one it was tuned at — and this game has three (walking, crouched, carrying an
 * energy drink), so it was wrong at two of them at all times.
 */
export const runRate = (frames: number, speed: number, height: number): number =>
    Math.max(4, Math.min(30, (frames * Math.abs(speed)) / Math.max(8, height)));

/** Where a state falls back to when its own art has not arrived. */
const FALLBACK: Record<string, string> = {
    run: 'idle', jump: 'idle', crouch: 'idle', shoot: 'idle', shootUp: 'shoot',
    hurt: 'idle', throw: 'idle', photo: 'idle', grab: 'idle', bag: 'idle',
    flee: 'run', radio: 'idle', tidy: 'idle', attack: 'idle', wind: 'idle',
    charge: 'run', stunned: 'idle', spill: 'idle', recover: 'idle',
    freed: 'idle', die: 'idle',
    // A specific reaction degrades to the generic flinch, and only then to
    // standing there — so a half-delivered set is a game where some hits read
    // better than others, never one where a character freezes.
    hit: 'hurt',
    hurtThrown: 'hurt', hurtBody: 'hurt', hurtHazard: 'hurt',
    trampled: 'hurt', doused: 'hurt',
};

export interface Skin {
    sprite: PhaserNS.GameObjects.Sprite;
    set: SkinSet;
    state: string;
    /**
     * Play a state. Cheap to call every frame; a repeat is ignored.
     *
     * `speed` drives the run cycle's rate, and `vy` picks the jump frame — a
     * jump is not a timed loop, it is a position in an arc, so it is read from
     * the body rather than animated on a clock.
     */
    play(state: string, facing: 1 | -1, motion?: { speed?: number; vy?: number }): void;
}

/**
 * Every asset id any role can ask for.
 *
 * Exported so the loader can tell a genuinely orphaned file from one that is
 * simply drawn by a coded rig rather than by a baked placeholder. See the
 * orphan check in `artLoader.ts` — it used to ask whether a placeholder texture
 * existed under the id, which is true for scenery and has never been true for a
 * character, so it reported all 118 delivered sprites as orphans including
 * `player-idle`. A warning that fires on everything is how a real one gets
 * missed.
 */
export const SKIN_IDS: ReadonlySet<string> = new Set(
    Object.values(SKINS).flatMap((set) => Object.values(set)),
);

const has = (scene: PhaserNS.Scene, id: string): boolean => scene.textures.exists(T(id));

/**
 * Should a request for the state already showing start the sheet again?
 *
 * Only for a one-shot that has finished. A shoot sheet holds on its last frame
 * when it ends, and the state is still 'shoot' when the next trigger pull
 * arrives — so guarding purely on "the state changed" swallows every shot after
 * the first until the actor does something else. A loop is never restarted,
 * because that would reset a run cycle to frame zero on every frame.
 */
function restartable(state: string, sprite: PhaserNS.GameObjects.Sprite): boolean {
    return ONCE.has(state) && !sprite.anims.isPlaying;
}

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
        play(state: string, facing: 1 | -1, motion?: { speed?: number; vy?: number }) {
            const id = resolve(scene, set, state);
            if (!id) return;
            const key = T(id);
            const anim = scene.anims.exists(animKey(id)) ? scene.anims.get(animKey(id)) : null;
            const frames = anim ? anim.frames.length : 1;

            // A jump is a position in an arc, not a clock. Reading the frame off
            // vertical velocity means the apex pose lands at the apex however
            // long the jump took, which a timed loop can only manage for one
            // jump height.
            if (state === 'jump' && anim && motion?.vy !== undefined) {
                this.state = state;
                sprite.stop();
                sprite.setTexture(key);
                const vy = motion.vy;
                const idx = vy < -60 ? 0 : vy < 40 ? 1 : 2;
                sprite.setFrame(Math.min(frames - 1, idx));
            } else if (this.state !== state || restartable(state, sprite)) {
                this.state = state;
                // An animation exists only for multi-frame sheets; a single
                // frame is set directly rather than played, because asking
                // Phaser to play a one-frame animation logs a warning per call
                // and there is one of these per actor per frame.
                if (anim) {
                    sprite.play({
                        key: animKey(id),
                        frameRate: state === 'run'
                            ? runRate(frames, motion?.speed ?? 88, height)
                            : (RATE[state] ?? DEFAULT_RATE),
                        repeat: ONCE.has(state) ? 0 : -1,
                    }, true);
                } else { sprite.stop(); sprite.setTexture(key); }
            } else if (state === 'run' && anim && motion?.speed !== undefined) {
                // Already running: retune rather than restart, or the cycle
                // resets to frame zero every time the speed changes at all.
                sprite.anims.msPerFrame = 1000 / runRate(frames, motion.speed, height);
            }
            sprite.setFlipX(facing < 0);
            // Art may arrive at world size or at ART_SCALE. Pick whichever
            // reading puts the sprite nearest the height the game expects, so
            // both deliveries look right without a flag in the filename.
            const texH = sprite.frame.height;
            const scale = Math.abs(texH - height) <= Math.abs(texH / ZOOM - height) ? 1 : 1 / ZOOM;
            // Feet stay on the floor because the origin is the feet, so growing
            // a figure lifts its head rather than sinking it through the aisle.
            sprite.setScale(scale * FIGURE_SCALE);
        },
    };
    skin.play('idle', 1);
    return skin;
}
