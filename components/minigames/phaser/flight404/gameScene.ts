/**
 * FLIGHT 404 — the simulation scene.
 * =================================
 * Same game as `components/minigames/Flight404.tsx`: four sections of fuselage,
 * three flavours of incompetent mook, a dark galley, strapped-in passengers, and
 * Yasser Abbasfat ranting at an autopilot. Same numbers, same script, same
 * comedy. What is different is *who does the work*.
 *
 * Everything below marked `PHASER:` is a place where the engine is doing
 * something the hand-rolled build had to write out longhand. Those comments are
 * the evidence for the pilot, so they are specific about what was replaced.
 *
 * Phaser is never imported here — the namespace is a parameter.
 */
import type * as PhaserNS from 'phaser';
import { PAL } from '../../engine/palette';
import type { Weapon } from '../../../../systems/weapons';
import {
    VIEW_W, VIEW_H, FLOOR_Y, BIN_FEET, SEAT_PITCH, GRAVITY, JUMP_V, RUN_SPEED,
    PLAYER_H, CROUCH_H, NOTICE_RANGE, DARK_R_BARE, DARK_R_LIT,
    BOSS_WINDOW, BOSS_HP, BOSS_CYCLES,
    SECTIONS, MOOK_HP, GLYPH_KEY_BY_CHAR,
    MOOK_BARKS, TRIP_BARKS, BONK_BARKS, TROLLEY_BARKS, PANIC_BARKS, CLANK_BARKS,
    YASSER_RANTS, YASSER_INTRO, YASSER_THROW, YASSER_SUMMON, YASSER_CHARGE,
    YASSER_WALL, YASSER_MEGA, YASSER_FOOT, YASSER_VEST_HOLDS, YASSER_DEFEAT,
    SUMMON_ARGUMENT, THROWER_AIM, THROWER_DISMOUNT, FREED_LINES, WITHERED_LINES,
    type MookKind, type SpawnDef,
} from './content';
import { T, TG, C, MONO } from './textures';
import { makeFigureFactory, type BlockFigure, type Kit } from './figure';
import { REG, type F404Input, type F404Result } from './bridge';
import type { HudPayload } from './uiScene';

export const GAME_KEY = 'f404-game';

/** Character colourways, mirroring engine/palette.ts KIT so the cast matches
 *  the other six games. */
const KITS: Record<string, Kit> = {
    player: { main: C.accent, trim: 0x04120f, skin: C.skin },
    militant: { main: 0x3f5d3a, trim: 0x16210f, skin: C.skinDark },
    hostage: { main: 0xc9c9d4, trim: 0x5a5a66, skin: C.skin },
    boss: { main: C.bossMain, trim: C.bossTrim, skin: C.skinDark },
};

type ArcadeBody = PhaserNS.Physics.Arcade.Body;
type Img = PhaserNS.GameObjects.Image;
type Txt = PhaserNS.GameObjects.Text;

const body = (o: unknown): ArcadeBody => (o as { body: ArcadeBody }).body;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

interface MookData {
    id: number;
    kind: MookKind;
    hp: number;
    maxHp: number;
    facing: 1 | -1;
    state: string;
    t: number;
    perch: boolean;
    slowT: number;
    hurtT: number;
    hitCd: number;
    /** x of the trolley this one cowers behind, if any. */
    coverX?: number;
    ko: boolean;
    bin?: Img;
    prop?: Img;
    band?: Img;
    barBg?: Img;
    barFill?: Img;
    eyes?: Img;
    bubble?: Txt;
    bubbleT: number;
    cycle?: PhaserNS.Time.TimerEvent;
}
type Mook = BlockFigure & { md: MookData };

interface HostageData {
    freed: boolean;
    dwell: number;
    belt?: Img;
    face?: Img;
    barBg?: Img;
    barFill?: Img;
    bubble?: Txt;
    bubbleT: number;
}
type Hostage = BlockFigure & { hd: HostageData };

interface BossData {
    hp: number;
    maxHp: number;
    facing: 1 | -1;
    state: string;
    t: number;
    phase: 1 | 2 | 3;
    step: number;
    hurtT: number;
    shots: number;
    vest: number;
    /** Damage absorbed during the current attack — see BOSS_WINDOW. */
    taken: number;
    /** Charge direction, locked when the charge starts. He commits. */
    dir: 1 | -1;
    defeatStage: number;
    pips: Img[];
    mega?: Img;
    tape?: Img[];
    bubble?: Txt;
    bubbleT: number;
}
type Boss = BlockFigure & { bd: BossData };

interface ShotData {
    dmg: number;
    friendly: boolean;
    kind: string;
    pierce: boolean;
    slows: boolean;
    returns: boolean;
    weaponIdx: number;
    travel: number;
    returning: boolean;
    /** Melee hitboxes ride along with the player instead of flying. */
    attached: boolean;
    hits: Set<number>;
}
type Shot = PhaserNS.Physics.Arcade.Image & { sd: ShotData };

export function makeGameScene(P: typeof PhaserNS, bus: PhaserNS.Events.EventEmitter) {
    const mkFigure = makeFigureFactory(P);

    return class GameScene extends P.Scene {
        // --- config handed in from React through the registry
        private weapons: Weapon[] = [];
        private ammo: number[] = [];
        private weaponIdx = 0;
        private inFlight: Record<string, number> = {};
        private hasLighter = false;
        private hasEnergy = false;
        private touch!: F404Input;

        // --- actors
        private player!: BlockFigure;
        private playerProp!: Img;
        private torch?: Img;
        private boltIcon?: Img;
        private mooks!: PhaserNS.GameObjects.Group;
        private hostages!: PhaserNS.GameObjects.Group;
        private shots!: PhaserNS.Physics.Arcade.Group;
        private melee!: PhaserNS.Physics.Arcade.Group;
        private hostiles!: PhaserNS.Physics.Arcade.Group;
        private pickups!: PhaserNS.Physics.Arcade.Group;
        private trolleys!: PhaserNS.Physics.Arcade.StaticGroup;
        private boss: Boss | null = null;

        // --- scenery
        private layers: PhaserNS.GameObjects.TileSprite[] = [];
        private cockpit?: Img;
        private doorImg?: Img;
        private doorLock?: Img;
        private darkness?: Img;
        private sparks?: PhaserNS.GameObjects.Particles.ParticleEmitter;

        // --- particle emitters (created once, fired all game)
        private pMuzzle!: PhaserNS.GameObjects.Particles.ParticleEmitter;
        private pCasing!: PhaserNS.GameObjects.Particles.ParticleEmitter;
        private pStars!: PhaserNS.GameObjects.Particles.ParticleEmitter;
        private pSwirl!: PhaserNS.GameObjects.Particles.ParticleEmitter;
        private pSplat!: PhaserNS.GameObjects.Particles.ParticleEmitter;
        private pBoom!: PhaserNS.GameObjects.Particles.ParticleEmitter;

        // --- player state
        private pFacing: 1 | -1 = 1;
        private pHp = 100;
        private pInvuln = 0;
        private pHurt = 0;
        private pCrouch = false;
        private pAimUp = false;
        private pStride = 0;
        private pSpeedT = 0;
        private pFireCd = 0;

        // --- run state
        private sectionIdx = 0;
        private doorOpen = false;
        private freed = 0;
        private hostageHits = 0;
        private kos = 0;
        private score = 0;
        private nextId = 1;
        private over = false;
        private rng!: PhaserNS.Math.RandomDataGenerator;
        private keys!: Record<string, PhaserNS.Input.Keyboard.Key>;
        private cursors!: PhaserNS.Types.Input.Keyboard.CursorKeys;
        private hudSig = '';

        constructor() {
            super({ key: GAME_KEY });
        }

        // ==================================================================
        // Setup
        // ==================================================================
        create() {
            const reg = this.registry;
            this.weapons = (reg.get(REG.weapons) as Weapon[]) ?? [];
            this.ammo = this.weapons.map(w => (w.uses === undefined ? -1 : w.uses));
            this.hasLighter = !!reg.get(REG.hasLighter);
            this.hasEnergy = !!reg.get(REG.hasEnergy);
            this.touch = reg.get(REG.input) as F404Input;
            this.rng = new P.Math.RandomDataGenerator([String(reg.get(REG.seed) ?? 1337)]);

            // PHASER: keyboard is the engine's job. The hand-rolled build ships
            // its own `useInput` hook with a keymap, focus/blur reset and an
            // edge-trigger buffer; here it is two calls, and the on-screen
            // TouchPad is OR-ed in below (see `readInput`).
            this.cursors = this.input.keyboard!.createCursorKeys();
            this.keys = this.input.keyboard!.addKeys(
                'W,A,S,D,SPACE,J,K,Z,X,ENTER,SHIFT,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN',
            ) as Record<string, PhaserNS.Input.Keyboard.Key>;
            // Stop arrows and space from scrolling the modal under the game.
            this.input.keyboard!.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');

            // --- groups.
            this.mooks = this.add.group();
            this.hostages = this.add.group();
            this.trolleys = this.physics.add.staticGroup();
            // PHASER: pooled physics groups. `group.get()` recycles a dead body
            // instead of allocating, so a Dog Launcher firing 6/s never churns
            // the heap. The canvas build pushes and splices a plain array.
            this.shots = this.physics.add.group({ allowGravity: false });
            this.melee = this.physics.add.group({ allowGravity: false });
            this.hostiles = this.physics.add.group({ allowGravity: false });
            this.pickups = this.physics.add.group();

            this.buildParticles();
            this.buildPlayer();
            this.buildColliders();
            this.loadSection(0);

            // PHASER: `startFollow` + `setDeadzone` + `setBounds`. The camera
            // lerps, clamps at the bulkheads and holds a dead zone so small
            // steps do not swim the whole cabin. In the canvas build this is a
            // hand-written `camX += (target - camX) * dt * 8` with a manual
            // clamp, and there is no dead zone at all.
            const cam = this.cameras.main;
            cam.startFollow(this.player, true, 0.14, 0.14, 0, -18);
            cam.setDeadzone(48, VIEW_H);

            this.events.once(P.Scenes.Events.SHUTDOWN, () => {
                this.time.removeAllEvents();
                this.tweens.killAll();
            });
        }

        /**
         * PHASER: six emitters, created once, reused for the whole run.
         *
         * The canvas build maintains its own particle array (`Part[]`), its own
         * integrator, its own lifetime bookkeeping, its own 140-particle cap and
         * a switch statement in the renderer for the six kinds. All of that is
         * replaced by these declarations plus `emitParticleAt`.
         */
        private buildParticles() {
            this.pMuzzle = this.add.particles(0, 0, T('muzzle'), {
                lifespan: 90, speed: { min: 10, max: 40 }, scale: { start: 0.55, end: 0 },
                alpha: { start: 0.95, end: 0 }, emitting: false, blendMode: 'ADD',
            }).setDepth(20);

            this.pCasing = this.add.particles(0, 0, T('casing'), {
                lifespan: 520, speedX: { min: -60, max: -20 }, speedY: { min: -90, max: -40 },
                gravityY: 340, rotate: { start: 0, end: 360 }, emitting: false,
            }).setDepth(20);

            // Comically knocked out: stars, never anything graphic.
            this.pStars = this.add.particles(0, 0, TG('star'), {
                lifespan: 850, speed: { min: 30, max: 80 }, angle: { min: 200, max: 340 },
                gravityY: 300, scale: { start: 0.2, end: 0.1 },
                rotate: { min: -180, max: 180 }, alpha: { start: 1, end: 0 }, emitting: false,
            }).setDepth(22);

            this.pSwirl = this.add.particles(0, 0, TG('swirl'), {
                lifespan: 900, speed: { min: 10, max: 34 }, angle: { min: 230, max: 310 },
                scale: { start: 0.2, end: 0.08 }, rotate: { min: -220, max: 220 },
                alpha: { start: 1, end: 0 }, emitting: false,
            }).setDepth(22);

            this.pSplat = this.add.particles(0, 0, TG('falafel'), {
                lifespan: 900, speed: { min: 40, max: 130 }, angle: { min: 200, max: 340 },
                gravityY: 420, scale: { start: 0.24, end: 0.18 },
                rotate: { min: -180, max: 180 }, alpha: { start: 1, end: 0.2 }, emitting: false,
            }).setDepth(21);

            this.pBoom = this.add.particles(0, 0, TG('boom'), {
                lifespan: 200, speed: 6, scale: { start: 0.26, end: 0.06 },
                alpha: { start: 1, end: 0 }, emitting: false,
            }).setDepth(21);
        }

        private buildPlayer() {
            this.player = mkFigure(this, 18, FLOOR_Y, PLAYER_H, KITS.player);
            this.player.setDepth(10);
            // PHASER: a Container can carry an arcade body, so the whole
            // block-figure is one collidable thing. Feet are the origin, hence
            // the negative offset.
            this.physics.add.existing(this.player);
            const b = body(this.player);
            b.setSize(12, PLAYER_H, false);
            b.setOffset(-6, -PLAYER_H);
            b.setCollideWorldBounds(true);
            b.setMaxVelocity(260, 520);

            // Whatever is in your hands, held in your hands.
            this.playerProp = this.add.image(0, 0, TG('fist')).setDisplaySize(9, 9).setDepth(11);
            this.torch = this.add.image(0, 0, TG('torch')).setDisplaySize(9, 9).setDepth(11).setVisible(false);
            this.boltIcon = this.add.image(0, 0, TG('bolt')).setDisplaySize(8, 8).setDepth(11).setVisible(false);
        }

        /**
         * PHASER: every interaction in the game, declared once.
         *
         * The canvas build's `stepShots` is ~130 lines of nested loops that
         * sweep each projectile's box against every mook, then the boss, then
         * every passenger, with a hand-written `overlap()` AABB helper and a
         * hand-written swept-box because a fast bullet would otherwise tunnel.
         * All of it collapses into these seven declarations plus small handlers.
         */
        private buildColliders() {
            this.physics.add.overlap(this.shots, this.mooks, this.onShotMook, undefined, this);
            this.physics.add.overlap(this.melee, this.mooks, this.onShotMook, undefined, this);
            this.physics.add.overlap(this.shots, this.hostages, this.onShotHostage, undefined, this);
            this.physics.add.overlap(this.hostiles, this.player, this.onHostileHitsPlayer, undefined, this);
            this.physics.add.overlap(this.player, this.pickups, this.onPickup, undefined, this);
            this.physics.add.overlap(this.player, this.mooks, this.onMookTouch, this.mookCanTouch, this);

            /**
             * PHASER: the drinks trolley is *real cover*, expressed as geometry
             * rather than as a special case.
             *
             * A parked trolley is a 22x22 static body on the carpet. Flat shots
             * are in `this.shots`, which collides with it — they clank off. A
             * lobbed weapon (bureka, choc milk, slushie) is in the same group
             * but arcs over the top of a 22px box and lands behind it, so the
             * physics decides whether cover worked. Melee lives in a separate
             * group with no trolley collider, so a baguette reaches over.
             *
             * The canvas build has to encode all three cases as a predicate
             * (`behindCover && !(s.kind === 'melee' || s.vy > 30)`), which means
             * a lob that is still rising counts as blocked and a lob that is
             * barely falling counts as clear, regardless of where it actually
             * is. Here it is just where it actually is.
             */
            this.physics.add.collider(this.shots, this.trolleys, this.onShotTrolley, undefined, this);
        }

        // ==================================================================
        // Section loading
        // ==================================================================
        private loadSection(idx: number) {
            const def = SECTIONS[idx];
            this.sectionIdx = idx;
            this.doorOpen = false;

            // Timers and tweens belong to the section that made them.
            this.time.removeAllEvents();
            this.tweens.killAll();

            this.mooks.clear(true, true);
            this.hostages.clear(true, true);
            this.trolleys.clear(true, true);
            this.shots.clear(true, true);
            this.hostiles.clear(true, true);
            this.melee.clear(true, true);
            this.pickups.clear(true, true);
            this.boss?.destroy();
            this.boss = null;
            this.layers.forEach(l => l.destroy());
            this.layers = [];
            this.cockpit?.destroy(); this.cockpit = undefined;
            this.doorImg?.destroy(); this.doorImg = undefined;
            this.doorLock?.destroy(); this.doorLock = undefined;
            this.darkness?.destroy(); this.darkness = undefined;
            this.sparks?.destroy(); this.sparks = undefined;
            this.inFlight = {};

            // PHASER: the world's bottom edge *is* the aisle carpet. Setting
            // bounds once gives every actor a floor, gives the player level
            // bounds ("you cannot back out of the aeroplane"), and gives the
            // boss a bulkhead to run into — with an event when he does.
            this.physics.world.setBounds(6, -200, def.length - 12, FLOOR_Y + 200);
            this.cameras.main.setBounds(0, 0, def.length, VIEW_H);

            this.buildScenery(def.length, idx);

            for (const tx of def.trolleys) {
                const img = this.trolleys.create(tx, FLOOR_Y, T('trolley')) as Img;
                img.setOrigin(0.5, 1).setDepth(12);
                const sb = img.body as unknown as PhaserNS.Physics.Arcade.StaticBody;
                sb.setSize(22, 22);
                sb.position.set(tx - 11, FLOOR_Y - 26);
                sb.updateCenter();
            }

            for (const m of def.mooks) this.spawnMook(m, def.trolleys);
            for (const hx of def.hostages) this.spawnHostage(hx);
            if (def.boss) this.spawnBoss(def.length);

            // Player back to the rear door of the new cabin.
            this.player.setPosition(18, FLOOR_Y);
            const b = body(this.player);
            b.setVelocity(0, 0);
            this.pFacing = 1;
            this.player.setFacing(1);

            bus.emit('banner', {
                big: def.boss ? 'YASSER ABBASFAT' : `SECTION ${idx + 1}`,
                sub: def.boss ? def.tag : `${def.name} — ${def.tag}`,
                ms: 2600,
            });
            bus.emit('boss', { visible: false, hp: 0, max: 1, phase: 1 });

            // PHASER: a camera flash sells the cabin change. One call.
            this.cameras.main.flash(260, 8, 12, 18);
            this.hudSig = '';
        }

        /**
         * PHASER: the whole fuselage is six TileSprites.
         *
         * Each strip texture is exactly one seat pitch wide, so a TileSprite
         * tiles it forever; scrolling is `tilePositionX = scrollX * factor`,
         * which is one assignment per layer per frame and one draw call per
         * layer. The canvas build loops its `band()` helper over every visible
         * row of every layer and re-issues the seat, the bin, the window frame
         * and the rib lines as individual fills — roughly 250 canvas ops a frame
         * before a single character is drawn.
         *
         * The window wall has a transparent aperture and a slower sky layer
         * behind it, so clouds crawl past the windows for free. The canvas build
         * draws one cloud per window and offsets each by hand.
         */
        private buildScenery(len: number, idx: number) {
            const def = SECTIONS[idx];
            const strip = (
                key: string, y: number, h: number, factor: number, depth: number,
            ) => {
                const ts = this.add.tileSprite(0, y, VIEW_W, h, key).setOrigin(0, 0);
                ts.setScrollFactor(0).setDepth(depth);
                ts.setData('factor', factor);
                this.layers.push(ts);
                return ts;
            };

            if (def.boss) {
                // Flight deck: one baked 352-wide plate, with the windscreen
                // left transparent so the sky shows through it.
                strip(T('sky'), 62, 42, 0.15, -8);
                this.cockpit = this.add.image(0, 16, T('cockpit')).setOrigin(0, 0)
                    .setScrollFactor(0).setDepth(-6);
                this.add.text(254, 130, 'AUTOPILOT: ENGAGED', {
                    fontFamily: MONO, fontSize: '5px', color: PAL.dim,
                }).setScrollFactor(0).setDepth(-5).setResolution(3);
                this.add.image(111, 116, TG('door')).setDisplaySize(12, 12)
                    .setScrollFactor(0).setDepth(-5);
                strip(T('carpet'), FLOOR_Y, VIEW_H - FLOOR_Y, 1, -4);
                strip(T('fore'), 182, 16, 1.12, 50);
                return;
            }

            strip(def.dark ? T('ceiling-dark') : T('ceiling'), 16, 20, 0.9, -6);
            strip(T('bins'), 36, 26, 1, -6);
            if (def.dark) {
                strip(T('galleywall'), 62, 42, 1, -5);
            } else {
                strip(T('sky'), 62, 42, 0.32, -6);
                strip(T('windowwall'), 62, 42, 1, -5);
            }
            strip(idx === 2 ? T('lieflats') : T('seats'), 104, 60, 1, -4);
            strip(def.dark ? T('carpet-dark') : T('carpet'), FLOOR_Y, VIEW_H - FLOOR_Y, 1, -4);
            strip(T('fore'), 182, 16, 1.12, 50);

            // The forward bulkhead door.
            this.doorImg = this.add.image(len - 20, 62, T('door-sealed')).setOrigin(0, 0).setDepth(-3);
            this.doorLock = this.add.image(len - 7, 110, TG('lock')).setDisplaySize(10, 10).setDepth(-2);

            if (def.dark) {
                this.buildDarkness();
                // PHASER: the galley's pulled breaker, sparking continuously.
                // A live emitter parked in the world, not a frame-by-frame
                // scattering of one-shot particles.
                this.sparks = this.add.particles(324, 92, T('casing'), {
                    lifespan: 420, frequency: 140, quantity: 2,
                    speed: { min: 30, max: 90 }, angle: { min: 20, max: 160 },
                    gravityY: 300, scale: { start: 1.4, end: 0.4 },
                    tint: [C.warn, C.legend, C.white], alpha: { start: 1, end: 0 },
                }).setDepth(30);
            }
        }

        // ==================================================================
        // The darkness model
        // ==================================================================
        /**
         * How far you can see in the galley, and why `itm-haunted-lighter` is
         * not cosmetic.
         *
         * Bare-handed the pool is 34px — less than a fifth of the screen, so a
         * charger is on you before he is drawn and a thrower's wind-up is
         * invisible. With the lighter it is 96px, far enough to see the wind-up
         * and react. On top of that, feeling your way through an unlit section
         * costs 20% of run speed unless the lighter is out (see `stepPlayer`),
         * and anything outside the pool is culled from the display entirely, so
         * mooks are two amber eyes and a bad feeling.
         *
         * PHASER: this is a baked plate Image parked on the player at depth 95.
         * The canvas build rebuilds a `createRadialGradient` and repaints a
         * full-screen rect every single frame, and its flicker is a pair of
         * sine waves sampled in the draw call. Here the flicker is one looping
         * tween, which also means it keeps running while the simulation is
         * paused — which is what you want for an emergency light.
         */
        private buildDarkness() {
            const key = this.hasLighter ? T('dark-lit') : T('dark-bare');
            this.darkness = this.add.image(this.player.x, FLOOR_Y - 13, key).setDepth(95);
            this.tweens.add({
                targets: this.darkness,
                alpha: { from: 0.93, to: 1 },
                scale: { from: 1.0, to: 1.035 },
                duration: 520,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
        }

        private visionRadius(): number {
            if (!SECTIONS[this.sectionIdx].dark) return Infinity;
            return this.hasLighter ? DARK_R_LIT : DARK_R_BARE;
        }

        private inLight(x: number, y: number): boolean {
            const r = this.visionRadius();
            if (r === Infinity) return true;
            const dx = x - this.player.x;
            const dy = y - (this.player.y - 13);
            return dx * dx + dy * dy < r * r;
        }

        // ==================================================================
        // Spawning
        // ==================================================================
        private spawnMook(def: SpawnDef, trolleys: number[]) {
            const y = def.perch ? BIN_FEET : FLOOR_Y;
            const h = def.perch ? 16 : 24;
            const fig = mkFigure(this, def.x, y, h, KITS.militant) as Mook;
            fig.setDepth(8);
            // A `trolley` mook is paired with the nearest parked trolley and
            // stands just *behind* it relative to the player's approach, so the
            // static body is genuinely between the two of them.
            const coverX = def.kind === 'trolley' && trolleys.length
                ? trolleys.reduce((best, tx) => (Math.abs(tx - def.x) < Math.abs(best - def.x) ? tx : best), trolleys[0])
                : undefined;
            fig.md = {
                id: this.nextId++,
                kind: def.kind,
                hp: MOOK_HP[def.kind], maxHp: MOOK_HP[def.kind],
                facing: -1,
                state: def.kind === 'trolley' ? 'hidden' : 'idle',
                t: this.rng.frac() * 0.8,
                perch: !!def.perch,
                slowT: 0, hurtT: 0, hitCd: 0,
                coverX,
                ko: false,
                bubbleT: 0,
            };
            fig.setFacing(-1);

            this.physics.add.existing(fig);
            const b = body(fig);
            const half = def.perch ? 9 : 6;
            b.setSize(half * 2, h, false);
            b.setOffset(-half, -h);
            // Perched mooks are wedged in a bin and do not fall out — until you
            // walk underneath, which is what `aim up` is for.
            b.setAllowGravity(!def.perch);
            b.setCollideWorldBounds(true);
            this.mooks.add(fig);

            if (def.perch) {
                fig.md.bin = this.add.image(def.x, 36, T('bin-open')).setOrigin(0.5, 0).setDepth(7);
            }
            // Kit: a keffiyeh band and whatever he is about to fumble.
            fig.md.band = this.add.image(0, 0, T('px')).setTint(C.accent2).setDepth(9);
            fig.md.band.setDisplaySize(8, 2);
            const propKey = def.kind === 'thrower' ? TG('falafel') : def.kind === 'charger' ? TG('baguette') : TG('seltzer');
            fig.md.prop = this.add.image(0, 0, propKey).setDisplaySize(8, 8).setDepth(9);
            fig.md.eyes = this.add.image(0, 0, T('eyes')).setDepth(9).setVisible(false);
            fig.md.barBg = this.add.image(0, 0, T('px')).setTint(C.panel).setOrigin(0, 0).setDepth(9).setVisible(false);
            fig.md.barBg.setDisplaySize(18, 2);
            fig.md.barFill = this.add.image(0, 0, T('px')).setTint(C.bad).setOrigin(0, 0).setDepth(9).setVisible(false);

            // PHASER: the trolley mook's pop-up cycle is a looping TimerEvent,
            // not a float compared against a moving threshold every frame.
            if (def.kind === 'trolley') {
                fig.md.cycle = this.time.addEvent({
                    delay: 2200, loop: true, callback: () => this.trolleyPop(fig),
                });
            }
            return fig;
        }

        private spawnHostage(x: number) {
            const fig = mkFigure(this, x, FLOOR_Y - 1, 22, KITS.hostage) as Hostage;
            fig.setDepth(6);
            fig.hd = { freed: false, dwell: 0, bubbleT: 0 };
            fig.setPose({ crouch: true });
            this.physics.add.existing(fig);
            const b = body(fig);
            b.setSize(14, 22, false);
            b.setOffset(-7, -22);
            b.setAllowGravity(false);
            b.setImmovable(true);
            this.hostages.add(fig);

            // Seatbelt, duct tape and a face about it.
            fig.hd.belt = this.add.image(x, FLOOR_Y - 14, T('belt')).setDepth(7);
            fig.hd.face = this.add.image(x, FLOOR_Y - 24, TG('scared')).setDisplaySize(8, 8).setDepth(7);
            fig.hd.barBg = this.add.image(x - 9, FLOOR_Y - 34, T('px')).setTint(C.panel)
                .setOrigin(0, 0).setDepth(7).setVisible(false);
            fig.hd.barBg.setDisplaySize(18, 2);
            fig.hd.barFill = this.add.image(x - 9, FLOOR_Y - 34, T('px')).setTint(C.accent)
                .setOrigin(0, 0).setDepth(7).setVisible(false);
            return fig;
        }

        private spawnBoss(len: number) {
            const fig = mkFigure(this, len - 60, FLOOR_Y, 34, KITS.boss) as Boss;
            fig.setDepth(9);
            fig.bd = {
                hp: BOSS_HP, maxHp: BOSS_HP, facing: -1, state: 'intro', t: 0,
                phase: 1, step: 0, hurtT: 0, shots: 0, vest: 6, taken: 0, dir: -1,
                defeatStage: 0, pips: [], bubbleT: 0,
            };
            this.physics.add.existing(fig);
            const b = body(fig);
            b.setSize(18, 34, false);
            b.setOffset(-9, -34);
            // PHASER: `onWorldBounds` is how "he ran into the bulkhead" happens.
            // The canvas build compares his x against two hand-picked numbers.
            b.setCollideWorldBounds(true, 0, 0, true);
            this.physics.world.on('worldbounds', this.onWorldBounds, this);

            // The falafel vest. It sheds as he loses his temper.
            for (let i = 0; i < 6; i++) {
                const pip = this.add.image(0, 0, T('px')).setTint(C.vest).setDepth(10);
                pip.setDisplaySize(4.6, 4.6);
                fig.bd.pips.push(pip);
            }
            fig.bd.mega = this.add.image(0, 0, TG('mega')).setDisplaySize(12, 12).setDepth(10).setVisible(false);
            this.boss = fig;
            this.say(fig as unknown as Mook, YASSER_INTRO, 3200, PAL.accent2, 0);
            this.time.delayedCall(3000, () => this.bossNext());
            return fig;
        }

        // ==================================================================
        // Talking
        // ==================================================================
        /**
         * PHASER: a speech bubble is one Text object with a background colour
         * and padding. The canvas build measures the string, draws a rect,
         * strokes an outline, then draws clipped text at a hand-staggered
         * vertical "lane" so three mooks shouting at once are readable.
         */
        private say(actor: { md?: MookData; bd?: BossData }, line: string, ms: number, color: string, lane = 0) {
            const d = (actor.md ?? actor.bd)!;
            d.bubble?.destroy();
            const t = this.add.text(0, 0, line.length > 46 ? `${line.slice(0, 45)}…` : line, {
                fontFamily: MONO, fontSize: '5px', color,
                backgroundColor: 'rgba(4,6,10,0.88)', padding: { x: 3, y: 3 },
                wordWrap: { width: 128 },
            }).setOrigin(0.5, 1).setDepth(60).setResolution(3);
            t.setData('lane', lane % 3);
            d.bubble = t;
            d.bubbleT = ms / 1000;
        }

        /** Floating score/damage number. A tween, then it deletes itself. */
        private float(x: number, y: number, str: string, color: string) {
            const t = this.add.text(x, y, str, {
                fontFamily: MONO, fontSize: '6px', color, fontStyle: 'bold',
            }).setOrigin(0.5, 1).setDepth(62).setResolution(3);
            this.tweens.add({
                targets: t, y: y - 16, alpha: 0, duration: 1100, ease: 'Quad.easeOut',
                onComplete: () => t.destroy(),
            });
        }

        // ==================================================================
        // Weapons
        // ==================================================================
        private glyphTex(ch: string) {
            const k = GLYPH_KEY_BY_CHAR[ch];
            return k ? TG(k) : TG('boom');
        }

        /**
         * Fire the equipped weapon. Every field of the registry entry in
         * systems/weapons.ts is honoured, exactly as in the canvas build:
         *
         *  - `klass 'melee'`  — no projectile. A wide hitbox attached to the
         *                       player for 0.14s, in a group with no trolley
         *                       collider so it reaches over the drinks cart.
         *  - `klass 'thrown'` — arcs under gravity unless it `returns`, in which
         *                       case it flies flat and comes home.
         *  - `klass 'ranged'` — flat, fast, spends `uses`.
         *  - `speed`          — projectile velocity, straight from the entry.
         *  - `cooldown`       — seconds between shots, ditto.
         *  - `uses`           — decremented per shot; at 0 the weapon is dead
         *                       weight and the rail is how you get out of it.
         *  - `returns`        — one in flight at a time; catching it refunds the
         *                       use, so the chancla is infinite if you stand
         *                       still and the frisbee is infinite *and* pierces.
         *  - `piercing`       — keeps a hit set and passes through.
         *  - `slows`          — the slushie halves a charger's speed for 2.5s.
         */
        private fire() {
            const wp = this.weapons[this.weaponIdx];
            if (!wp || this.pFireCd > 0) return;
            const ammo = this.ammo[this.weaponIdx];
            if (ammo === 0) {
                this.float(this.player.x, this.player.y - 36, 'EMPTY', PAL.warn);
                this.pFireCd = 0.4;
                return;
            }
            if (wp.returns && (this.inFlight[wp.id] ?? 0) > 0) return;

            this.pFireCd = wp.cooldown || 0.2;
            if (ammo > 0) this.ammo[this.weaponIdx] = ammo - 1;

            const up = this.pAimUp;
            const handY = this.player.y - (this.pCrouch ? 10 : 17);
            const muzzleX = this.player.x + this.pFacing * 6;

            if (wp.klass === 'melee') {
                const hit = this.melee.get(muzzleX, handY, T('px')) as Shot;
                if (!hit) return;
                hit.setActive(true).setVisible(true).setAlpha(0.4).setTint(C.white).setDepth(19);
                hit.setDisplaySize(18, up ? 26 : 16);
                body(hit).setEnable(true);
                body(hit).setSize(18, up ? 26 : 16, true);
                body(hit).setAllowGravity(false);
                body(hit).setVelocity(0, 0);
                hit.sd = {
                    dmg: wp.damage, friendly: true, kind: 'melee', pierce: true,
                    slows: !!wp.slows, returns: false, weaponIdx: this.weaponIdx,
                    travel: 0, returning: false, attached: true, hits: new Set(),
                };
                // PHASER: the swing lives exactly 140ms, then removes itself.
                this.time.delayedCall(140, () => this.killShot(hit));
                this.pMuzzle.emitParticleAt(muzzleX, handY, 1);
                // A short reach-and-recover, so a swing reads as a swing.
                this.tweens.add({
                    targets: this.player.rig, x: this.pFacing * 2, duration: 70, yoyo: true,
                });
                return;
            }

            const speed = wp.speed ?? 200;
            const arcs = wp.klass === 'thrown' && !wp.returns;
            // Aiming up fires near-vertically on purpose: a mook in an open
            // overhead bin is dealt with by standing underneath him.
            const vx = up ? this.pFacing * speed * 0.12 : this.pFacing * speed;
            const vy = up ? -speed * 0.95 : arcs ? -58 : 0;

            const s = this.shots.get(muzzleX, handY, this.glyphTex(wp.glyph)) as Shot;
            if (!s) return;
            s.setActive(true).setVisible(true).setAlpha(1).setTint(C.white).setDepth(18);
            s.setDisplaySize(wp.klass === 'ranged' ? 8 : 10, wp.klass === 'ranged' ? 8 : 10);
            const b = body(s);
            b.setEnable(true);
            b.setSize(7, 7, true);
            b.setAllowGravity(arcs);
            if (arcs) b.setGravityY(300 - GRAVITY);   // world gravity is 620
            else b.setGravityY(0);
            b.setVelocity(vx, vy);
            s.sd = {
                dmg: wp.damage, friendly: true,
                kind: wp.klass === 'ranged' ? 'bullet' : 'thrown',
                pierce: !!wp.piercing, slows: !!wp.slows, returns: !!wp.returns,
                weaponIdx: this.weaponIdx, travel: 0, returning: false,
                attached: false, hits: new Set(),
            };
            if (wp.returns) this.inFlight[wp.id] = (this.inFlight[wp.id] ?? 0) + 1;
            // PHASER: a thrown thing tumbles because the tween manager spins it.
            this.tweens.add({ targets: s, angle: 360, duration: 520, repeat: -1 });

            this.pMuzzle.emitParticleAt(muzzleX, handY, 2);
            if (wp.klass === 'ranged') this.pCasing.emitParticleAt(muzzleX, handY, 1);
        }

        /** Enemy projectiles all funnel through here. */
        private hostileShot(
            x: number, y: number, vx: number, vy: number, dmg: number,
            kind: string, tex: string, gravity = 0, w = 8, h = 8,
        ) {
            const s = this.hostiles.get(x, y, tex) as Shot;
            if (!s) return;
            s.setActive(true).setVisible(true).setAlpha(1).setDepth(18);
            s.setDisplaySize(w + 2, h + 2);
            const b = body(s);
            b.setEnable(true);
            b.setSize(w, h, true);
            b.setAllowGravity(gravity > 0);
            b.setGravityY(gravity > 0 ? gravity - GRAVITY : 0);
            b.setVelocity(vx, vy);
            s.sd = {
                dmg, friendly: false, kind, pierce: false, slows: false, returns: false,
                weaponIdx: -1, travel: 0, returning: false, attached: false, hits: new Set(),
            };
            if (kind !== 'ring') this.tweens.add({ targets: s, angle: 360, duration: 700, repeat: -1 });
            else {
                // PHASER: a megaphone ring expands as it travels. Scale tween.
                s.setScale(0.6);
                this.tweens.add({ targets: s, scaleX: 1.5, scaleY: 1.5, duration: 900 });
            }
            return s;
        }

        private killShot(s: Shot) {
            if (!s || !s.active) return;
            const sd = s.sd;
            if (sd?.returns) {
                const wp = this.weapons[sd.weaponIdx];
                // Release the in-flight lock either way, or the weapon is
                // bricked for the rest of the game.
                if (wp) this.inFlight[wp.id] = Math.max(0, (this.inFlight[wp.id] ?? 1) - 1);
            }
            this.tweens.killTweensOf(s);
            s.setAngle(0).setScale(1);
            body(s).setEnable(false);
            s.setActive(false).setVisible(false);
        }

        // ==================================================================
        // Collision handlers
        // ==================================================================
        private onShotTrolley = (obj: unknown) => {
            const s = obj as Shot;
            if (!s.active || !s.sd) return;
            this.float(s.x, s.y - 10, 'CLANK', PAL.dim);
            this.pBoom.emitParticleAt(s.x, s.y, 1);
            // Whichever brother is hiding behind it is delighted.
            const near = (this.mooks.getChildren() as Mook[])
                .find(m => m.active && m.md.kind === 'trolley' && Math.abs(m.x - s.x) < 26 && m.md.bubbleT <= 0);
            if (near) this.say(near, this.rng.pick(CLANK_BARKS), 1200, PAL.warn, near.md.id);
            if (!s.sd.pierce) this.killShot(s);
        };

        private onShotMook = (a: unknown, b: unknown) => {
            const s = a as Shot;
            const m = b as Mook;
            if (!s.active || !m.active || !s.sd || m.md.ko) return;
            if (s.sd.hits.has(m.md.id)) return;
            s.sd.hits.add(m.md.id);
            this.damageMook(m, s.sd.dmg, s.x);
            if (s.sd.slows) {
                m.md.slowT = 2.5;
                this.float(m.x, m.y - 34, 'BRAIN FREEZE', PAL.accent);
            }
            if (!s.sd.pierce) this.killShot(s);
        };

        /** Never do this. */
        private onShotHostage = (a: unknown, b: unknown) => {
            const s = a as Shot;
            const h = b as Hostage;
            if (!s.active || !h.active || !s.sd) return;
            this.hostageHits++;
            this.score -= 150;
            this.say(h as unknown as Mook, this.rng.pick(WITHERED_LINES), 2600, PAL.bad, 0);
            this.float(h.x, FLOOR_Y - 30, '-150', PAL.bad);
            this.cameras.main.shake(120, 0.006);
            this.killShot(s);
        };

        private onHostileHitsPlayer = (a: unknown, b: unknown) => {
            // Argument order follows the collider declaration, but Phaser can
            // hand them either way round when one side is a Container.
            const s = ((a as Shot).sd ? a : b) as Shot;
            if (!s.active || !s.sd) return;
            this.hurtPlayer(s.sd.dmg, s.x);
            this.pSplat.emitParticleAt(s.x, s.y, 2);
            this.killShot(s);
        };

        /** Running into you is the charger's only real attack. */
        private mookCanTouch = (a: unknown, b: unknown) => {
            const m = ((a as Mook).md ? a : b) as Mook;
            if (!m.md) return false;
            const upright = !m.md.ko && m.md.state !== 'trip' && m.md.state !== 'getup' && m.md.state !== 'bonk';
            return upright && m.md.hitCd <= 0 && !m.md.perch;
        };

        private onMookTouch = (a: unknown, b: unknown) => {
            const m = ((a as Mook).md ? a : b) as Mook;
            this.hurtPlayer(m.md.kind === 'charger' ? 6 : 5, m.x);
            m.md.hitCd = 0.9;
            body(m).setVelocityX(-m.md.facing * 70);
            if (m.md.kind === 'charger') { m.md.state = 'stumble'; m.md.t = 0; }
        };

        private onPickup = (a: unknown, b: unknown) => {
            const k = ((a as Img).getData?.('kind') ? a : b) as Img;
            const kind = k.getData('kind');
            if (kind === 'bureka') {
                this.pHp = Math.min(100, this.pHp + 25);
                this.float(this.player.x, this.player.y - 34, '+25 BUREKA', PAL.ok);
            } else {
                this.pSpeedT = 6;
                this.float(this.player.x, this.player.y - 34, 'RED BULL!', PAL.warn);
            }
            k.destroy();
        };

        private onWorldBounds = (b: unknown, _up: boolean, _down: boolean, left: boolean, right: boolean) => {
            const boss = this.boss;
            if (!boss || boss.bd.state !== 'charge') return;
            if (body(boss) !== b) return;
            if (!left && !right) return;
            // Ran out of cabin. The bulkhead wins.
            this.say(boss as unknown as Mook, YASSER_WALL, 1800, PAL.accent2, 0);
            this.cameras.main.shake(340, 0.02);
            this.pStars.emitParticleAt(boss.x, boss.y - 34, 6);
            this.pSplat.emitParticleAt(boss.x, boss.y - 26, 4);
            this.bossStagger();
        };

        // ==================================================================
        // Damage
        // ==================================================================
        private hurtPlayer(dmg: number, fromX: number) {
            if (this.pInvuln > 0 || this.over) return;
            this.pHp -= dmg;
            this.pInvuln = 1.0;
            this.pHurt = 0.32;
            const b = body(this.player);
            b.setVelocity((this.player.x < fromX ? -1 : 1) * 95, -95);
            // PHASER: camera shake and a red flash, from the camera, on the
            // world camera only. The HUD scene does not move.
            this.cameras.main.shake(150, 0.012);
            this.cameras.main.flash(90, 120, 20, 20);
            this.float(this.player.x, this.player.y - 34, `-${dmg}`, PAL.bad);
            if (this.pHp <= 0) {
                this.pHp = 0;
                this.lose();
            }
        }

        private damageMook(m: Mook, dmg: number, fromX: number) {
            // Hitting a mook while he is face-down or arguing with his own
            // trolley does extra — the game rewards being unsporting.
            const exposed = m.md.state === 'trip' || m.md.state === 'bonk' || m.md.state === 'panic';
            m.md.hp -= exposed ? dmg * 1.5 : dmg;
            m.md.hurtT = 0.16;
            m.setHurt(true);
            this.pBoom.emitParticleAt(m.x, m.y - 14, 1);
            if (m.md.hp <= 0) this.koMook(m, fromX);
        }

        /**
         * Comically knocked out: spinning, then sliding down the aisle on his
         * back, then gone.
         *
         * PHASER: two tweens and an arcade velocity. The canvas build carries
         * `koT`, `spin`, and a bespoke branch in both the step function and the
         * renderer (save / translate / rotate / figure / restore) to do this.
         */
        private koMook(m: Mook, fromX: number) {
            if (m.md.ko) return;
            m.md.ko = true;
            m.md.hp = 0;
            m.md.cycle?.remove();
            m.setHurt(false);
            m.setPose({ crouch: true });
            const b = body(m);
            b.setAllowGravity(true);
            b.setVelocity((m.x < fromX ? -1 : 1) * (110 + this.rng.frac() * 50), -130);
            m.md.bin?.setVisible(false);
            m.md.prop?.setVisible(false);
            m.md.band?.setVisible(false);
            m.md.barBg?.setVisible(false);
            m.md.barFill?.setVisible(false);

            this.tweens.add({ targets: m.rig, angle: 900, duration: 1700, ease: 'Quad.easeOut' });
            this.tweens.add({ targets: m, alpha: 0, delay: 1200, duration: 500,
                onComplete: () => { this.despawnMook(m); } });

            this.kos++;
            this.score += 100;
            this.pStars.emitParticleAt(m.x, m.y - 24, 5);
            this.pSwirl.emitParticleAt(m.x, m.y - 28, 2);
            this.float(m.x, m.y - 30, '+100', PAL.legend);
            this.dropLoot(m.x);
        }

        private despawnMook(m: Mook) {
            m.md.bubble?.destroy();
            m.md.bin?.destroy();
            m.md.prop?.destroy();
            m.md.band?.destroy();
            m.md.eyes?.destroy();
            m.md.barBg?.destroy();
            m.md.barFill?.destroy();
            m.md.cycle?.remove();
            this.mooks.remove(m, true, true);
        }

        private dropLoot(x: number) {
            const r = this.rng.frac();
            if (r > 0.68) return;
            const kind = r < 0.46 ? 'bureka' : 'redbull';
            const k = this.pickups.get(x, FLOOR_Y - 40, kind === 'bureka' ? TG('bureka') : TG('juice')) as Img;
            if (!k) return;
            k.setActive(true).setVisible(true).setDepth(12);
            k.setDisplaySize(10, 10);
            k.setData('kind', kind);
            const b = body(k);
            b.setEnable(true);
            b.setSize(12, 12, true);
            b.setAllowGravity(true);
            b.setVelocity(0, -30);
            b.setBounce(0.3);
            b.setCollideWorldBounds(true);
            // A gentle bob so it reads as pickup-able. Tween, not a sine sample.
            this.tweens.add({ targets: k, scaleX: k.scaleX * 1.15, scaleY: k.scaleY * 1.15,
                duration: 380, yoyo: true, repeat: -1 });
            this.time.delayedCall(14000, () => k.destroy());
        }

        // ==================================================================
        // Mook behaviour
        // ==================================================================
        /** Popped from a looping TimerEvent, not polled. */
        private trolleyPop(m: Mook) {
            if (!m.active || m.md.ko || m.md.state === 'panic') return;
            m.md.state = 'pop';
            m.md.t = 0;
            this.time.delayedCall(450, () => {
                if (!m.active || m.md.ko || m.md.state !== 'pop') return;
                // Aimed at a standing head; crouch and it fizzes past.
                this.hostileShot(m.x + m.md.facing * 8, m.y - 20, m.md.facing * 135, 0,
                    9, 'seltzer', TG('seltzer'), 0, 10, 6);
            });
            this.time.delayedCall(800, () => {
                if (!m.active || m.md.ko || m.md.state !== 'pop') return;
                m.md.state = 'hidden';
                m.md.t = 0;
            });
        }

        /**
         * Three behaviours, all of them bad at the job. Identical tuning to the
         * canvas build; the difference is that movement is
         * `body.setVelocityX()` and gravity, contact is a declared overlap, and
         * the comedy beats (tripping, bonking, panicking) are tweens.
         */
        private stepMook(m: Mook, dt: number) {
            const md = m.md;
            const b = body(m);
            const dx = this.player.x - m.x;
            const adx = Math.abs(dx);
            md.t += dt;
            md.hitCd = Math.max(0, md.hitCd - dt);
            if (md.hurtT > 0) {
                md.hurtT -= dt;
                if (md.hurtT <= 0) m.setHurt(false);
            }
            if (md.slowT > 0) md.slowT -= dt;
            const slow = md.slowT > 0 ? 0.45 : 1;
            const go = (s: string) => { md.state = s; md.t = 0; };

            if (md.ko) {
                b.setVelocityX(b.velocity.x * 0.985);
                return;
            }

            switch (md.kind) {
                case 'charger': {
                    switch (md.state) {
                        case 'idle':
                            b.setVelocityX(0);
                            if (adx < NOTICE_RANGE) {
                                go('run');
                                this.say(m, this.rng.pick(MOOK_BARKS), 1800, PAL.warn, md.id);
                            }
                            break;
                        case 'run':
                            md.facing = dx > 0 ? 1 : -1;
                            b.setVelocityX(md.facing * 54 * slow);
                            // ~0.65 trips per second of running. Not a soldier.
                            if (md.t > 0.7 && this.rng.frac() < 0.011) {
                                go('trip');
                                this.say(m, this.rng.pick(TRIP_BARKS), 1400, PAL.warn, md.id);
                                this.pStars.emitParticleAt(m.x, m.y - 20, 3);
                                // PHASER: he actually falls over. One tween.
                                this.tweens.add({ targets: m.rig, angle: -90 * md.facing, duration: 200, ease: 'Bounce.easeOut' });
                            }
                            break;
                        case 'trip':
                            b.setVelocityX(b.velocity.x * 0.85);
                            if (md.t > 1.25) {
                                go('getup');
                                this.tweens.add({ targets: m.rig, angle: 0, duration: 300, ease: 'Back.easeOut' });
                            }
                            break;
                        case 'getup':
                            b.setVelocityX(0);
                            if (md.t > 0.45) go('run');
                            break;
                        case 'stumble':
                            b.setVelocityX(b.velocity.x * 0.9);
                            if (md.t > 0.5) go('run');
                            break;
                    }
                    break;
                }

                case 'thrower': {
                    // Get underneath his open bin and he leans out for a better
                    // throw, which is as far as his plan goes. Without this a
                    // melee-only player could never reach him and the forward
                    // door would never unlock.
                    if (md.perch && adx < 46) {
                        md.perch = false;
                        b.setAllowGravity(true);
                        b.setVelocityY(-40);
                        md.hp -= 5;
                        md.bin?.setVisible(false);
                        this.say(m, THROWER_DISMOUNT, 2000, PAL.warn, md.id);
                        this.pStars.emitParticleAt(m.x, m.y - 10, 3);
                        go('rest');
                        if (md.hp <= 0) { this.koMook(m, this.player.x); break; }
                    }
                    switch (md.state) {
                        case 'idle':
                        case 'rest':
                            b.setVelocityX(0);
                            md.facing = dx > 0 ? 1 : -1;
                            if (adx < 215 && md.t > 1.1) {
                                go('aim');
                                this.say(m, THROWER_AIM, 1100, PAL.warn, md.id);
                            }
                            break;
                        case 'aim':
                            b.setVelocityX(0);
                            if (md.t > 0.7) {
                                if (this.rng.frac() < 0.14) {
                                    // Straight up. It comes straight back down.
                                    go('bonk');
                                    this.say(m, this.rng.pick(BONK_BARKS), 1600, PAL.warn, md.id);
                                    this.pStars.emitParticleAt(m.x, m.y - 26, 4);
                                    this.pSplat.emitParticleAt(m.x, m.y - 30, 1);
                                    md.hp -= 6;
                                    if (md.hp <= 0) this.koMook(m, m.x + 10);
                                } else {
                                    // Ballistic arc solved for "lands on the
                                    // player" — the one bit of maths physics
                                    // cannot do for you.
                                    const flight = clamp(adx / 115, 0.55, 1.7);
                                    this.hostileShot(
                                        m.x + md.facing * 6, m.y - 20,
                                        dx / flight, -(300 * flight) / 2 - 24,
                                        10, 'falafel', TG('falafel'), 300, 9, 9,
                                    );
                                    go('rest');
                                }
                            }
                            break;
                        case 'bonk':
                            b.setVelocityX(0);
                            if (md.t > 1.5) go('rest');
                            break;
                    }
                    break;
                }

                case 'trolley': {
                    const coverX = md.coverX ?? m.x;
                    md.facing = dx > 0 ? 1 : -1;
                    if (md.state === 'hidden') {
                        // Slide back in behind the drinks. The trolley's static
                        // body sits between him and anyone approaching.
                        const target = coverX + (dx > 0 ? -7 : 7);
                        b.setVelocityX((target - m.x) * 5);
                        if (md.t > 0.9 && md.bubbleT <= 0 && this.rng.frac() < 0.01) {
                            this.say(m, this.rng.pick(TROLLEY_BARKS), 1500, PAL.warn, md.id);
                        }
                    } else if (md.state === 'pop') {
                        b.setVelocityX(0);
                    } else if (md.state === 'panic') {
                        // Runs away flailing, still complaining, fully hittable.
                        b.setVelocityX(-Math.sign(dx || 1) * 74 * slow);
                        if (md.t > 2.6) go('hidden');
                    }
                    if (md.state !== 'panic' && adx < 26) {
                        go('panic');
                        this.say(m, this.rng.pick(PANIC_BARKS), 2000, PAL.warn, md.id);
                        // He shoves the trolley down the aisle at you and legs it.
                        this.hostileShot(
                            m.x + Math.sign(dx || 1) * 8, FLOOR_Y - 10,
                            Math.sign(dx || 1) * 105, 0, 12, 'trolley', TG('cart'), 0, 16, 18,
                        );
                        this.cameras.main.shake(120, 0.008);
                    }
                    break;
                }
            }

            // --- pose + attachments
            m.setFacing(md.facing);
            const running = md.state === 'run' || md.state === 'panic';
            const h = md.perch ? 16 : 24;
            m.setPose({
                stride: running ? (this.time.now / 340) % 1 : 0,
                armUp: md.state === 'aim' ? 1 : md.state === 'panic' ? 0.8 : md.state === 'pop' ? 0.6 : 0,
                crouch: md.state === 'hidden' || md.state === 'pop' || md.perch,
            });
            md.band?.setPosition(m.x, m.y - h - 5);
            if (md.prop) {
                md.prop.setPosition(
                    m.x + md.facing * 8,
                    m.y - h + (md.state === 'aim' ? -6 : md.state === 'bonk' ? -14 : 2),
                );
                md.prop.setVisible(md.state !== 'trip');
            }

            // Health pip, only once he has been hit — keeps the picture clean.
            const show = md.hp < md.maxHp && md.hp > 0;
            md.barBg?.setVisible(show).setPosition(m.x - 9, m.y - h - 12);
            if (md.barFill) {
                md.barFill.setVisible(show).setPosition(m.x - 9, m.y - h - 12);
                md.barFill.setDisplaySize(Math.max(0, 18 * (md.hp / md.maxHp)), 2);
            }
        }

        // ==================================================================
        // Yasser Abbasfat
        // ==================================================================
        /**
         * He is a buffoon, so the fight is built out of things that go wrong for
         * him. A fixed cycle per phase:
         *
         *   phase 1 (hp > 66%)  rant -> throw -> summon -> charge
         *   phase 2 (33-66%)    rant -> throw -> megaphone -> charge -> throw
         *   phase 3 (< 33%)     charge -> megaphone -> throw -> rant -> charge
         *
         *   rant       stands centre stage shouting a line from his dialogue
         *              file, fully exposed. Your damage window; the joke is he
         *              cannot stop talking.
         *   throw      three falafels on ballistic arcs. In phase 3 one drops on
         *              his own foot and staggers him.
         *   summon     "BROTHERS! TO ME!" — two mooks walk in from the cockpit
         *              door and immediately argue about whose job the door was.
         *   charge     sprints at you with the vest flapping; 16 on contact, but
         *              a miss puts him into the bulkhead for 1.6s and rains
         *              falafel everywhere.
         *   megaphone  three expanding rings of amplified ranting at head
         *              height. Crouch under them.
         *   stagger    dazed, stars, takes 1.5x.
         *
         * PHASER: each attack is scheduled with `time.delayedCall` /
         * `time.addEvent({ repeat })` instead of comparing an accumulator
         * against `0.35 + shots * gap` every frame, and each telegraph is a
         * tween. The state machine reads like the design doc above.
         */
        private bossNext() {
            const bd = this.boss?.bd;
            if (!this.boss || !bd || bd.state === 'defeat' || this.over) return;
            const frac = bd.hp / bd.maxHp;
            const phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
            // A new phase restarts its cycle from the top, so no attack in a
            // phase can be skipped entirely.
            if (phase !== bd.phase) { bd.phase = phase as 1 | 2 | 3; bd.step = -1; }
            const cycle = BOSS_CYCLES[bd.phase];
            bd.step = (bd.step + 1) % cycle.length;
            bd.state = cycle[bd.step];
            bd.t = 0;
            bd.shots = 0;
            bd.taken = 0;
            body(this.boss).setVelocityX(0);

            switch (bd.state) {
                case 'rant': {
                    this.say(this.boss as unknown as Mook, this.rng.pick(YASSER_RANTS),
                        bd.phase === 3 ? 1400 : 2200, PAL.accent2, 0);
                    this.time.delayedCall(bd.phase === 3 ? 1500 : 2300, () => this.bossNext());
                    break;
                }
                case 'throw': {
                    this.say(this.boss as unknown as Mook, YASSER_THROW, 1200, PAL.accent2, 0);
                    const gap = bd.phase === 3 ? 400 : 550;
                    this.time.addEvent({
                        delay: gap, startAt: gap - 350, repeat: 2,
                        callback: () => this.bossThrow(),
                    });
                    this.time.delayedCall(350 + 3 * gap + 500, () => {
                        if (this.boss?.bd.state === 'throw') this.bossNext();
                    });
                    break;
                }
                case 'summon': {
                    this.say(this.boss as unknown as Mook, YASSER_SUMMON, 2000, PAL.accent2, 0);
                    this.time.delayedCall(600, () => this.bossSummon());
                    this.time.delayedCall(1800, () => {
                        if (this.boss?.bd.state === 'summon') this.bossNext();
                    });
                    break;
                }
                case 'charge': {
                    // Locked the moment he starts running. Jumping over him
                    // means he keeps going into the bulkhead, which is the trick.
                    bd.dir = this.player.x > this.boss.x ? 1 : -1;
                    bd.facing = bd.dir;
                    this.say(this.boss as unknown as Mook, YASSER_CHARGE, 1600, PAL.accent2, 0);
                    // PHASER: a real telegraph — he squashes and flashes before
                    // he goes. The canvas build has no telegraph at all.
                    this.boss.setHurt(false);
                    this.tweens.add({
                        targets: this.boss.rig,
                        scaleX: bd.dir * 1.18, scaleY: 0.86,
                        duration: 170, yoyo: true, ease: 'Quad.easeOut',
                    });
                    this.time.delayedCall(4000, () => {
                        if (this.boss?.bd.state === 'charge') this.bossNext();
                    });
                    break;
                }
                case 'megaphone': {
                    this.say(this.boss as unknown as Mook, YASSER_MEGA, 2000, PAL.accent2, 0);
                    bd.mega?.setVisible(true);
                    this.time.addEvent({
                        delay: 450, startAt: 0, repeat: 2, callback: () => this.bossRing(),
                    });
                    this.time.delayedCall(500 + 3 * 450 + 600, () => {
                        bd.mega?.setVisible(false);
                        if (this.boss?.bd.state === 'megaphone') this.bossNext();
                    });
                    break;
                }
            }
        }

        private bossThrow() {
            const b = this.boss;
            if (!b || b.bd.state !== 'throw') return;
            b.bd.shots++;
            if (b.bd.phase === 3 && b.bd.shots === 2) {
                // Drops one on his own foot.
                this.say(b as unknown as Mook, YASSER_FOOT, 1600, PAL.accent2, 0);
                this.pStars.emitParticleAt(b.x, b.y - 8, 4);
                b.bd.hp -= 8;
                this.bossStagger();
                return;
            }
            const dx = this.player.x - b.x;
            const flight = clamp(Math.abs(dx) / 120, 0.6, 1.6);
            this.hostileShot(b.x + b.bd.facing * 8, b.y - 26, dx / flight,
                -(300 * flight) / 2 - 30, 12, 'falafel', TG('falafel'), 300, 9, 9);
        }

        private bossSummon() {
            const b = this.boss;
            if (!b || b.bd.state !== 'summon') return;
            const len = SECTIONS[this.sectionIdx].length;
            const a = this.spawnMook({ kind: 'charger', x: len - 24 }, []);
            const c = this.spawnMook({ kind: 'thrower', x: len - 40 }, []);
            this.say(a, SUMMON_ARGUMENT[0], 2200, PAL.warn, a.md.id);
            this.say(c, SUMMON_ARGUMENT[1], 2200, PAL.warn, c.md.id);
        }

        private bossRing() {
            const b = this.boss;
            if (!b || b.bd.state !== 'megaphone') return;
            this.cameras.main.shake(180, 0.014);
            this.hostileShot(b.x + b.bd.facing * 10, b.y - 22, b.bd.facing * 118, 0,
                12, 'ring', T('ring'), 0, 12, 9);
        }

        private bossStagger() {
            const b = this.boss;
            if (!b || b.bd.state === 'defeat') return;
            b.bd.state = 'stagger';
            b.bd.t = 0;
            body(b).setVelocityX(0);
            this.tweens.add({ targets: b.rig, angle: { from: 0, to: -18 }, duration: 200, yoyo: true, repeat: 3 });
            if (b.bd.hp <= 0) { this.defeatBoss(); return; }
            this.time.delayedCall(1600, () => {
                if (this.boss?.bd.state === 'stagger') this.bossNext();
            });
        }

        private stepBoss(dt: number) {
            const b = this.boss;
            if (!b) return;
            const bd = b.bd;
            if (bd.hp <= 0 && bd.state !== 'defeat') { this.defeatBoss(); return; }
            bd.t += dt;
            if (bd.hurtT > 0) {
                bd.hurtT -= dt;
                if (bd.hurtT <= 0) b.setHurt(false);
            }

            if (bd.state === 'defeat') { this.stepBossDefeat(dt); return; }

            if (bd.state !== 'charge') bd.facing = this.player.x > b.x ? 1 : -1;
            b.setFacing(bd.facing);

            if (bd.state === 'charge') {
                const speed = bd.phase === 3 ? 158 : 132;
                body(b).setVelocityX(bd.dir * speed);
                this.cameras.main.shake(60, 0.004);
                // Contact is 16 and ends the charge.
                const pb = body(this.player);
                if (P.Geom.Intersects.RectangleToRectangle(
                    body(b).getBounds(new P.Geom.Rectangle()) as PhaserNS.Geom.Rectangle,
                    pb.getBounds(new P.Geom.Rectangle()) as PhaserNS.Geom.Rectangle,
                )) {
                    this.hurtPlayer(16, b.x);
                    this.cameras.main.shake(300, 0.02);
                    this.bossNext();
                }
            } else if (bd.state === 'rant' && bd.phase === 3 && this.rng.frac() < 0.05 && bd.vest > 0) {
                // Phase 3 he rants so hard the vest sheds.
                bd.vest--;
                this.pSplat.emitParticleAt(b.x, b.y - 24, 1);
            }

            b.setPose({
                stride: bd.state === 'charge' ? (this.time.now / 200) % 1 : 0,
                armUp: bd.state === 'rant' || bd.state === 'megaphone' ? 1 : bd.state === 'throw' ? 0.7 : 0,
            });

            // Vest pips, shed as he loses his temper.
            bd.pips.forEach((pip, i) => {
                pip.setVisible(i < bd.vest);
                pip.setPosition(b.x - 4 + (i % 2) * 8, b.y - 24 + Math.floor(i / 2) * 6);
            });
            bd.mega?.setPosition(b.x + bd.facing * 12, b.y - 28);

            if (bd.state === 'stagger') {
                this.pSwirl.emitParticleAt(b.x + (this.rng.frac() - 0.5) * 16, b.y - 40, 1);
            }

            bus.emit('boss', { visible: bd.state !== 'intro', hp: bd.hp, max: bd.maxHp, phase: bd.phase });
        }

        /**
         * Beating him is not violent: the trolley rolls over his foot, the
         * oxygen masks drop on his head, he spins, and the cabin crew tape him
         * to a jump seat while passengers photograph him.
         */
        private defeatBoss() {
            const b = this.boss;
            if (!b || b.bd.state === 'defeat') return;
            b.bd.hp = 0;
            b.bd.state = 'defeat';
            b.bd.t = 0;
            b.bd.bubbleT = 0;
            body(b).setVelocityX(0);
            this.time.removeAllEvents();
            this.tweens.killTweensOf(b.rig);
            this.score += 1000;
            this.cameras.main.shake(400, 0.02);
            bus.emit('banner', { big: 'CABIN SECURED', sub: 'HE IS TAPED TO A JUMP SEAT', ms: 4000 });

            // Stage 1: the trolley rolls over his foot and he hops, spinning.
            this.say(b as unknown as Mook, YASSER_DEFEAT[0], 1400, PAL.accent2, 0);
            this.tweens.add({ targets: b.rig, angle: 360 * 2, duration: 1200, ease: 'Sine.easeOut' });
            this.tweens.add({ targets: b, x: b.x - 24, duration: 1200 });

            // Stage 2: the oxygen masks drop on his head.
            this.time.delayedCall(1200, () => {
                if (!this.boss) return;
                this.say(this.boss as unknown as Mook, YASSER_DEFEAT[1], 1400, PAL.accent2, 0);
                for (let i = 0; i < 5; i++) {
                    const mask = this.add.image(this.boss.x + (i - 2) * 13, 40, TG('mask'))
                        .setDisplaySize(9, 9).setDepth(40);
                    this.tweens.add({
                        targets: mask, y: FLOOR_Y - 20, angle: 200, duration: 900,
                        delay: i * 90, ease: 'Quad.easeIn',
                        onComplete: () => this.tweens.add({ targets: mask, alpha: 0, duration: 400, onComplete: () => mask.destroy() }),
                    });
                }
            });

            // Stage 3: taped to the jump seat, passengers photograph him.
            this.time.delayedCall(2400, () => {
                const bb = this.boss;
                if (!bb) return;
                this.say(bb as unknown as Mook, YASSER_DEFEAT[2], 1800, PAL.accent2, 0);
                bb.bd.tape = [
                    this.add.image(bb.x, bb.y - 26, T('tape')).setDepth(11),
                    this.add.image(bb.x, bb.y - 16, T('tape')).setDepth(11),
                ];
                const cam = this.add.image(bb.x - 26, bb.y - 30, TG('camera')).setDisplaySize(9, 9).setDepth(11);
                const phone = this.add.image(bb.x + 28, bb.y - 26, TG('phone')).setDisplaySize(9, 9).setDepth(11);
                this.tweens.add({ targets: [cam, phone], y: '-=3', duration: 300, yoyo: true, repeat: -1 });
                // Flashbulbs.
                this.time.addEvent({ delay: 220, repeat: 8, callback: () => {
                    this.pMuzzle.emitParticleAt(bb.x + (this.rng.frac() - 0.5) * 60, bb.y - 40, 2);
                } });
            });

            this.time.delayedCall(4200, () => this.win());
        }

        private stepBossDefeat(_dt: number) {
            const b = this.boss!;
            b.bd.pips.forEach((pip, i) => pip.setVisible(i < b.bd.vest)
                && pip.setPosition(b.x - 4 + (i % 2) * 8, b.y - 24 + Math.floor(i / 2) * 6));
            b.bd.tape?.forEach((t, i) => t.setPosition(b.x, b.y - 26 + i * 10));
            b.setPose({ armUp: 0.2 });
        }

        // ==================================================================
        // Player
        // ==================================================================
        /** Keyboard (Phaser) OR the on-screen TouchPad (React). */
        private readInput() {
            const k = this.keys;
            const c = this.cursors;
            const t = this.touch;
            const left = c.left.isDown || k.A.isDown || t.left;
            const right = c.right.isDown || k.D.isDown || t.right;
            const up = c.up.isDown || k.W.isDown || t.up;
            const down = c.down.isDown || k.S.isDown || t.down;
            const fire = c.space.isDown || k.J.isDown || k.Z.isDown || k.ENTER.isDown || t.fire;
            // Edge-triggered: jumping off a held button would be a pogo stick.
            const jump = P.Input.Keyboard.JustDown(k.K) || P.Input.Keyboard.JustDown(k.X)
                || P.Input.Keyboard.JustDown(k.SHIFT) || t.jump;
            t.jump = false;
            return { left, right, up, down, fire, jump };
        }

        private stepPlayer(dt: number) {
            const def = SECTIONS[this.sectionIdx];
            const b = body(this.player);
            const inp = this.readInput();

            this.pInvuln = Math.max(0, this.pInvuln - dt);
            this.pFireCd = Math.max(0, this.pFireCd - dt);
            this.pSpeedT = Math.max(0, this.pSpeedT - dt);
            if (this.pHurt > 0) {
                this.pHurt -= dt;
                if (this.pHurt <= 0) this.player.setHurt(false);
                else this.player.setHurt(true);
            }

            const onGround = b.blocked.down || b.touching.down;
            const wasCrouch = this.pCrouch;
            this.pCrouch = inp.down && onGround;
            this.pAimUp = inp.up;
            if (this.pCrouch !== wasCrouch) {
                // Crouching is real cover: the body is 11px shorter, which is
                // the whole defence against seltzer and megaphone rings, both
                // aimed at where a standing head would be.
                const h = this.pCrouch ? CROUCH_H : PLAYER_H;
                b.setSize(12, h, false);
                b.setOffset(-6, -h);
            }

            // Speed: base, +15% with an Energy Drink in storage (a passive from
            // the weapon registry's utility class), +40% on a Red Bull pickup,
            // -20% groping through an unlit section without the lighter.
            let speed = RUN_SPEED;
            if (this.hasEnergy) speed *= 1.15;
            if (this.pSpeedT > 0) speed *= 1.4;
            if (def.dark && !this.hasLighter) speed *= 0.8;
            if (this.pCrouch) speed *= 0.45;

            const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
            if (dir !== 0) {
                b.setVelocityX(dir * speed);
                this.pFacing = dir > 0 ? 1 : -1;
                this.pStride = (this.pStride + dt * 2.4) % 1;
            } else {
                b.setVelocityX(b.velocity.x * (onGround ? 0.72 : 0.94));
                this.pStride = 0;
            }
            if (inp.jump && onGround && !this.pCrouch) b.setVelocityY(JUMP_V);
            if (inp.fire) this.fire();

            // --- pose
            this.player.setFacing(this.pFacing);
            this.player.setPose({
                stride: onGround ? this.pStride : 0.25,
                armUp: this.pAimUp ? 1 : this.pFireCd > 0.03 ? 0.45 : 0,
                crouch: this.pCrouch,
            });
            // Blink while invulnerable.
            this.player.setAlpha(this.pInvuln > 0 && Math.floor(this.pInvuln * 14) % 2 === 0 ? 0.25 : 1);

            // Whatever is in your hands, held in your hands.
            const wp = this.weapons[this.weaponIdx];
            this.playerProp.setTexture(this.glyphTex(wp?.glyph ?? '👊'));
            this.playerProp.setPosition(
                this.player.x + this.pFacing * (this.pAimUp ? 4 : 10),
                this.player.y - (this.pCrouch ? 12 : 19) - (this.pAimUp ? 12 : 0),
            );
            this.playerProp.setAlpha(this.player.alpha);
            // The lighter is visibly out in the dark, which is also why you can see.
            this.torch?.setVisible(this.hasLighter && def.dark)
                .setPosition(this.player.x + this.pFacing * 12, this.player.y - 22);
            this.boltIcon?.setVisible(this.pSpeedT > 0)
                .setPosition(this.player.x - this.pFacing * 10, this.player.y - 26);
        }

        private stepHostages(dt: number) {
            for (const obj of this.hostages.getChildren() as Hostage[]) {
                const h = obj as Hostage;
                if (!h.active) continue;
                const hd = h.hd;
                if (hd.freed) continue;
                // Stand in front of one for 0.45s to unbuckle them.
                if (Math.abs(h.x - this.player.x) < 13) {
                    hd.dwell += dt;
                    if (hd.dwell > 0.45) {
                        hd.freed = true;
                        this.freed++;
                        this.score += 250;
                        hd.belt?.destroy(); hd.belt = undefined;
                        hd.barBg?.setVisible(false);
                        hd.barFill?.setVisible(false);
                        hd.face?.setTexture(TG('cheer'));
                        h.setPose({ crouch: false, armUp: 0.95 });
                        // PHASER: relief is a bounce tween, not a sine wave.
                        this.tweens.add({
                            targets: h, y: FLOOR_Y - 5, duration: 260,
                            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                        });
                        this.say(h as unknown as Mook, this.rng.pick(FREED_LINES), 3000, PAL.ok, 0);
                        this.float(h.x, FLOOR_Y - 34, '+250', PAL.accent);
                        continue;
                    }
                } else {
                    hd.dwell = Math.max(0, hd.dwell - dt);
                }
                const show = hd.dwell > 0;
                hd.barBg?.setVisible(show);
                if (hd.barFill) {
                    hd.barFill.setVisible(show);
                    hd.barFill.setDisplaySize(Math.max(0, 18 * (hd.dwell / 0.45)), 2);
                }
            }
        }

        // ==================================================================
        // Projectile upkeep that physics cannot do for us
        // ==================================================================
        private stepShots(dt: number) {
            const len = SECTIONS[this.sectionIdx].length;
            for (const obj of [...this.shots.getChildren(), ...this.melee.getChildren(), ...this.hostiles.getChildren()]) {
                const s = obj as Shot;
                if (!s.active || !s.sd) continue;
                const sd = s.sd;

                if (sd.attached) {
                    // Melee hitbox rides the player.
                    s.setPosition(
                        this.pAimUp ? this.player.x : this.player.x + this.pFacing * 13,
                        this.pAimUp ? this.player.y - PLAYER_H - 9 : this.player.y - (this.pCrouch ? 10 : 17),
                    );
                    body(s).reset(s.x, s.y);
                    continue;
                }

                if (sd.returning) {
                    // PHASER: the homing return leg is `moveToObject`. The
                    // canvas build normalises the vector by hand.
                    this.physics.moveTo(s, this.player.x, this.player.y - 16,
                        (this.weapons[sd.weaponIdx]?.speed ?? 200) * 1.15);
                    if (P.Math.Distance.Between(s.x, s.y, this.player.x, this.player.y - 16) < 13) {
                        // Caught. Refund the use — that is what `returns` buys.
                        const wp = this.weapons[sd.weaponIdx];
                        if (wp && this.ammo[sd.weaponIdx] >= 0) this.ammo[sd.weaponIdx]++;
                        this.float(this.player.x, this.player.y - 40, 'CAUGHT', PAL.accent);
                        this.killShot(s);
                    }
                    continue;
                }

                sd.travel += (Math.abs(body(s).velocity.x) + Math.abs(body(s).velocity.y)) * dt;

                if (sd.returns && (sd.travel > 150 || s.x < 8 || s.x > len - 8 || s.y < 30)) {
                    sd.returning = true;
                    sd.hits.clear();
                    body(s).setAllowGravity(false);
                    continue;
                }
                if (s.x < -24 || s.x > len + 24) { this.killShot(s); continue; }
                // Arcing things splat on the carpet.
                if (s.y > FLOOR_Y - 2 && (body(s).allowGravity || sd.kind === 'falafel')) {
                    this.pSplat.emitParticleAt(s.x, FLOOR_Y - 4, 1);
                    this.killShot(s);
                    continue;
                }
                if (s.y > FLOOR_Y + 8) this.killShot(s);
            }
        }

        // ==================================================================
        // Bubbles, culling, doors
        // ==================================================================
        private stepBubbles(dt: number) {
            const follow = (d: MookData | BossData | HostageData, x: number, topY: number) => {
                if (!d.bubble) return;
                d.bubbleT -= dt;
                if (d.bubbleT <= 0) { d.bubble.destroy(); d.bubble = undefined; return; }
                // `lane` staggers bubbles vertically: three mooks shouting in
                // the same row would otherwise print one unreadable line.
                const lane = (d.bubble.getData('lane') as number) ?? 0;
                d.bubble.setPosition(
                    clamp(x, this.cameras.main.scrollX + 70, this.cameras.main.scrollX + VIEW_W - 70),
                    topY - lane * 10,
                );
            };
            for (const obj of this.mooks.getChildren() as Mook[]) {
                follow(obj.md, obj.x, obj.y - (obj.md.perch ? 16 : 24) - 14);
            }
            for (const obj of this.hostages.getChildren() as Hostage[]) {
                follow(obj.hd, obj.x, FLOOR_Y - 40);
            }
            if (this.boss) follow(this.boss.bd, this.boss.x, this.boss.y - 50);
        }

        /**
         * In an unlit section anything outside the light pool is hidden — a mook
         * out there is two amber eyes and a bad feeling.
         *
         * PHASER: `setVisible(false)` removes it from the render list entirely.
         * The canvas build has to guard every single draw call with an
         * `inLight()` check because there is no display list to remove it from.
         */
        private stepDarkness() {
            if (!this.darkness) return;
            this.darkness.setPosition(this.player.x, this.player.y - 13);
            for (const obj of this.mooks.getChildren() as Mook[]) {
                const lit = this.inLight(obj.x, obj.y - 12);
                obj.setVisible(lit);
                obj.md.band?.setVisible(lit && !obj.md.ko);
                obj.md.prop?.setVisible(lit && !obj.md.ko && obj.md.state !== 'trip');
                obj.md.bin?.setVisible(lit && obj.md.perch);
                obj.md.eyes?.setVisible(!lit && !obj.md.ko)
                    .setPosition(obj.x, obj.y - (obj.md.perch ? 12 : 20));
                if (!lit) { obj.md.barBg?.setVisible(false); obj.md.barFill?.setVisible(false); }
            }
            for (const obj of this.hostages.getChildren() as Hostage[]) {
                const lit = this.inLight(obj.x, FLOOR_Y - 12);
                obj.setVisible(lit);
                obj.hd.belt?.setVisible(lit);
                obj.hd.face?.setVisible(lit);
                if (!lit) { obj.hd.barBg?.setVisible(false); obj.hd.barFill?.setVisible(false); }
            }
        }

        private standing() {
            return (this.mooks.getChildren() as Mook[]).filter(m => m.active && !m.md.ko).length;
        }

        /** Room clearing: the forward door stays sealed while anyone is up. */
        private stepDoor() {
            const def = SECTIONS[this.sectionIdx];
            if (def.boss) return;
            if (!this.doorOpen && this.standing() === 0) {
                this.doorOpen = true;
                this.doorLock?.destroy();
                this.doorLock = undefined;
                bus.emit('banner', { big: 'DOOR UNLOCKED', sub: 'FORWARD, TO THE NEXT CABIN', ms: 1800 });
                if (this.doorImg) {
                    // PHASER: the door slides. The canvas build swaps a colour.
                    this.doorImg.setTexture(T('door-open'));
                    this.tweens.add({
                        targets: this.doorImg, x: this.doorImg.x + 9, alpha: 0.45,
                        duration: 420, ease: 'Cubic.easeOut',
                    });
                }
            }
            if (this.doorOpen && this.player.x > def.length - 18) {
                if (this.sectionIdx + 1 < SECTIONS.length) {
                    // PHASER: fade out, swap the level, fade back in — the
                    // camera owns the transition.
                    const next = this.sectionIdx + 1;
                    this.doorOpen = false;
                    this.cameras.main.fadeOut(220, 4, 6, 10);
                    this.cameras.main.once(P.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                        this.loadSection(next);
                        this.cameras.main.fadeIn(260, 4, 6, 10);
                    });
                }
            }
        }

        // ==================================================================
        // End of run
        // ==================================================================
        private lose() {
            if (this.over) return;
            this.over = true;
            this.cameras.main.shake(500, 0.02);
            bus.emit('banner', { big: 'CABIN LOST', sub: 'YASSER IS STILL SHOUTING ABOUT THE PIGEONS', ms: 2200 });
            this.tweens.add({ targets: this.player.rig, angle: 90, duration: 500, ease: 'Bounce.easeOut' });
            this.time.delayedCall(1800, () => this.finish(false));
        }

        private win() {
            if (this.over) return;
            this.over = true;
            this.finish(true);
        }

        private finish(won: boolean) {
            const result: F404Result = {
                won, freed: this.freed, kos: this.kos,
                score: this.score, hostageHits: this.hostageHits,
            };
            // PHASER: the simulation stops but the scene stays on screen behind
            // the React result card — `scene.pause()` rather than a `running`
            // flag threaded through the loop.
            this.scene.pause();
            const done = this.registry.get(REG.onDone) as ((r: F404Result) => void) | undefined;
            done?.(result);
        }

        // ==================================================================
        // The frame
        // ==================================================================
        update(_time: number, delta: number) {
            const dt = Math.min(delta, 50) / 1000;
            if (this.over) return;

            // Weapon rail selection, driven from React.
            const want = clamp(this.touch.weaponIdx | 0, 0, Math.max(0, this.weapons.length - 1));
            if (want !== this.weaponIdx) this.weaponIdx = want;
            for (let i = 1; i <= 7 && i <= this.weapons.length; i++) {
                const key = this.keys[['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'][i - 1]];
                if (key && P.Input.Keyboard.JustDown(key)) { this.weaponIdx = i - 1; this.touch.weaponIdx = i - 1; }
            }

            this.stepPlayer(dt);
            for (const obj of this.mooks.getChildren() as Mook[]) {
                if (obj.active) this.stepMook(obj, dt);
            }
            if (this.boss) this.stepBoss(dt);
            this.stepShots(dt);
            this.stepHostages(dt);
            this.stepBubbles(dt);
            this.stepDarkness();
            this.stepDoor();

            // PHASER: one assignment per parallax layer. That is the scroll.
            const sx = this.cameras.main.scrollX;
            for (const l of this.layers) {
                const f = l.getData('factor') as number;
                l.tilePositionX = sx * f + (l.texture.key === T('sky') ? this.time.now * 0.006 : 0);
            }

            this.pushHud();
        }

        private pushHud() {
            const def = SECTIONS[this.sectionIdx];
            const wp = this.weapons[this.weaponIdx];
            const payload: HudPayload = {
                hp: this.pHp,
                ammo: this.ammo[this.weaponIdx] ?? -1,
                weaponGlyph: this.glyphTex(wp?.glyph ?? '👊'),
                freed: this.freed,
                hostages: def.hostages.length,
                kos: this.kos,
                score: this.score,
                section: this.sectionIdx,
                standing: def.boss ? 0 : this.standing(),
            };
            const sig = `${payload.hp}|${payload.ammo}|${payload.weaponGlyph}|${payload.freed}|${payload.kos}|${payload.score}|${payload.section}|${payload.standing}`;
            if (sig === this.hudSig) return;
            this.hudSig = sig;
            bus.emit('hud', payload);
            // React only hears about it when something it displays changed.
            const onHud = this.registry.get(REG.onHud) as ((h: unknown) => void) | undefined;
            onHud?.({ section: this.sectionIdx, freed: this.freed, score: this.score, kos: this.kos });
        }
    };
}
