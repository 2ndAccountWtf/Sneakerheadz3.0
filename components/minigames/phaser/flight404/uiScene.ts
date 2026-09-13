/**
 * The HUD, as its own Scene.
 * =========================
 * This is the single clearest structural win in the pilot.
 *
 * In the canvas build the HUD is drawn at the end of `drawWorld`, and getting
 * it there correctly requires care: the whole world is drawn inside a
 * `ctx.save() / ctx.translate(shakeX, shakeY) / ... / ctx.restore()` so that the
 * HUD does *not* inherit the screen shake, and every HUD coordinate is
 * hand-written in screen space while every world coordinate is hand-written in
 * world space minus `camX`. Two coordinate systems, one draw function, and the
 * only thing keeping them apart is a save/restore pair you must not forget.
 *
 * Here the HUD is a second Scene, rendered over the game Scene by the Scene
 * Manager, with its own Camera. It cannot see the world camera's scroll, so it
 * cannot drift; `cameras.main.shake()` in the game scene shakes the cabin and
 * leaves the health bar nailed down, for free. The HUD also gets to use Text
 * objects with real backgrounds and real tweens, and it can be paused
 * independently of the simulation.
 *
 * Communication is one event bus owned by the scene factory (see index.ts), so
 * neither scene holds a reference to the other.
 */
import type * as PhaserNS from 'phaser';
import { PAL } from '../../engine/palette';
import { VIEW_W, SECTIONS } from './content';
import { T, TG, C, MONO, DISPLAY } from './textures';

export interface HudPayload {
    hp: number;
    ammo: number;
    weaponGlyph: string;
    freed: number;
    hostages: number;
    kos: number;
    score: number;
    section: number;
    standing: number;
}

export interface BossPayload {
    visible: boolean;
    hp: number;
    max: number;
    phase: number;
}

export const UI_KEY = 'f404-ui';

export function makeUIScene(P: typeof PhaserNS, bus: PhaserNS.Events.EventEmitter) {
    return class UIScene extends P.Scene {
        private hpFill!: PhaserNS.GameObjects.Image;
        private weaponIcon!: PhaserNS.GameObjects.Image;
        private ammoText!: PhaserNS.GameObjects.Text;
        private freedText!: PhaserNS.GameObjects.Text;
        private koText!: PhaserNS.GameObjects.Text;
        private scoreText!: PhaserNS.GameObjects.Text;
        private sectionText!: PhaserNS.GameObjects.Text;
        private leftText!: PhaserNS.GameObjects.Text;
        private bossGroup!: PhaserNS.GameObjects.Container;
        private bossFill!: PhaserNS.GameObjects.Image;
        private bossPhase!: PhaserNS.GameObjects.Text;
        private bannerBig!: PhaserNS.GameObjects.Text;
        private bannerSub!: PhaserNS.GameObjects.Text;

        constructor() {
            super({ key: UI_KEY });
        }

        /** A tinted 1x1 stretched to a rectangle — same atom the figures use. */
        private box(x: number, y: number, w: number, h: number, tint: number, alpha = 1) {
            const img = this.add.image(x, y, T('px')).setOrigin(0, 0).setTint(tint);
            img.setDisplaySize(w, h);
            img.setAlpha(alpha);
            return img;
        }

        private label(x: number, y: number, str: string, size: number, color: string, align: 'left' | 'right' | 'center' = 'left') {
            const t = this.add.text(x, y, str, { fontFamily: MONO, fontSize: `${size}px`, color });
            t.setOrigin(align === 'right' ? 1 : align === 'center' ? 0.5 : 0, 0);
            t.setResolution(3); // 6px mono text needs supersampling to stay legible
            return t;
        }

        create() {
            // --- top strip
            this.box(0, 0, VIEW_W, 16, C.void, 0.85);
            this.box(0, 16, VIEW_W, 1, C.line);

            this.label(4, 5, 'HP', 6, PAL.dim);
            this.box(16, 4, 62, 7, C.panel);
            this.hpFill = this.box(16, 4, 62, 7, C.ok);

            this.weaponIcon = this.add.image(88, 8, TG('fist')).setDisplaySize(9, 9);
            this.ammoText = this.label(96, 5, '∞', 6, PAL.ink);

            this.add.image(126, 8, TG('person')).setDisplaySize(9, 9);
            this.freedText = this.label(134, 5, '0/0', 6, PAL.accent);

            this.add.image(166, 8, TG('sleep')).setDisplaySize(9, 9);
            this.koText = this.label(174, 5, '0', 6, PAL.ink);

            this.scoreText = this.label(206, 5, '0', 6, PAL.legend);
            this.sectionText = this.label(VIEW_W - 4, 5, SECTIONS[0].name, 6, PAL.accent2, 'right');
            this.leftText = this.label(VIEW_W - 4, 20, '', 5, PAL.dim, 'right');

            // --- boss bar, hidden until Yasser stops hiding behind the door
            this.bossGroup = this.add.container(0, 0).setVisible(false);
            const bossName = this.label(VIEW_W / 2, 20, 'YASSER ABBASFAT', 6, PAL.accent2, 'center');
            const bossBg = this.box(60, 28, VIEW_W - 120, 5, C.panel);
            this.bossFill = this.box(60, 28, VIEW_W - 120, 5, C.accent2);
            this.bossPhase = this.label(VIEW_W / 2, 35, 'PHASE 1', 5, PAL.dim, 'center');
            this.bossGroup.add([bossName, bossBg, this.bossFill, this.bossPhase]);

            // --- section banner. A tween, not an alpha ramp sampled per frame.
            this.bannerBig = this.add.text(VIEW_W / 2, 76, '', {
                fontFamily: DISPLAY, fontSize: '22px', color: PAL.legend,
                stroke: PAL.black, strokeThickness: 3,
            }).setOrigin(0.5, 0.5).setResolution(2).setAlpha(0);
            this.bannerSub = this.label(VIEW_W / 2, 92, '', 6, PAL.ink, 'center').setAlpha(0);

            bus.on('hud', this.onHud, this);
            bus.on('boss', this.onBoss, this);
            bus.on('banner', this.onBanner, this);
            // The bus outlives the scene (it belongs to the factory), so every
            // listener has to come off or a second run double-fires.
            this.events.once(P.Scenes.Events.SHUTDOWN, () => {
                bus.off('hud', this.onHud, this);
                bus.off('boss', this.onBoss, this);
                bus.off('banner', this.onBanner, this);
            });
        }

        private onHud = (h: HudPayload) => {
            const pct = Math.max(0, Math.min(1, h.hp / 100));
            this.hpFill.setDisplaySize(Math.max(0, 62 * pct), 7);
            this.hpFill.setTint(h.hp > 35 ? C.ok : C.bad);

            this.weaponIcon.setTexture(h.weaponGlyph);
            this.ammoText.setText(h.ammo < 0 ? '∞' : String(h.ammo));
            this.ammoText.setColor(h.ammo === 0 ? PAL.bad : h.ammo >= 0 && h.ammo < 8 ? PAL.warn : PAL.ink);

            this.freedText.setText(`${h.freed}/${h.hostages}`);
            this.koText.setText(String(h.kos));
            this.scoreText.setText(String(h.score));
            this.sectionText.setText(SECTIONS[h.section]?.name ?? '');
            this.leftText.setText(h.standing > 0 ? `${h.standing} LEFT` : '');
        };

        private onBoss = (b: BossPayload) => {
            this.bossGroup.setVisible(b.visible);
            if (!b.visible) return;
            const pct = Math.max(0, Math.min(1, b.hp / b.max));
            this.bossFill.setDisplaySize(Math.max(0, (VIEW_W - 120) * pct), 5);
            this.bossPhase.setText(`PHASE ${b.phase}`);
        };

        private onBanner = ({ big, sub, ms = 2600 }: { big: string; sub: string; ms?: number }) => {
            // `tweens.chain()` reads better here, but removing a chain that has
            // already completed throws inside Phaser
            // (`TweenManager.remove -> Array.Remove -> null.indexOf`), and a
            // banner is re-fired every time a section changes. Two plain tweens
            // killed by target are the version that cannot crash.
            this.tweens.killTweensOf(this.bannerBig);
            this.tweens.killTweensOf(this.bannerSub);

            this.bannerBig.setText(big).setColor(PAL.legend).setY(76).setAlpha(1).setScale(0.7);
            this.bannerSub.setText(sub).setAlpha(1).setScale(1);

            // Punch in, hold, fade out.
            this.tweens.add({ targets: this.bannerBig, scale: 1, duration: 180, ease: 'Back.easeOut' });
            this.tweens.add({
                targets: [this.bannerBig, this.bannerSub],
                alpha: 0, duration: 320, delay: Math.max(0, ms - 320), ease: 'Quad.easeIn',
            });
        };

        /** Big red centred word, used for the loss. */
        showLoss(str: string) {
            this.tweens.killTweensOf(this.bannerBig);
            this.tweens.killTweensOf(this.bannerSub);
            this.bannerBig.setText(str).setColor(PAL.bad).setAlpha(1).setScale(1).setY(100);
            this.bannerSub.setAlpha(0);
        }
    };
}
