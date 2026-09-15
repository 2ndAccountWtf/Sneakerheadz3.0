/**
 * Procedural texture baking.
 * =========================
 * There are no image assets in this project, so every pixel in this game is
 * generated at boot — exactly like the canvas builds, which redraw the same
 * rectangles from `engine/draw.ts` every single frame.
 *
 * The difference, and the first concrete Phaser win in this pilot, is that here
 * the drawing happens **once**. `Graphics.generateTexture()` bakes a shape into
 * a GPU texture and from then on the cabin is drawn by the batcher as quads.
 * The canvas build re-issues roughly 40 `fillRect` / `strokeRect` calls per seat
 * row per frame just to draw the fuselage; this build issues one draw call for a
 * TileSprite that covers the whole thing and scrolls itself.
 *
 * Phaser is NOT imported here. The namespace arrives as a parameter so the
 * dynamic-import code split in PhaserHost stays intact.
 */
import type * as PhaserNS from 'phaser';
import { PAL } from '../../engine/palette';
import {
    SEAT_PITCH, FLOOR_Y, VIEW_W, GLYPHS, DARK_TEX_W, DARK_TEX_H,
    DARK_R_BARE, DARK_R_LIT, type GlyphKey,
} from './content';

/** Palette strings are CSS hex; Phaser tints and fills want numbers. */
export const hexNum = (css: string): number => {
    const m = /^#([0-9a-f]{6})$/i.exec(css.trim());
    return m ? parseInt(m[1], 16) : 0xffffff;
};

export const C = {
    void: hexNum(PAL.void),
    bg: hexNum(PAL.bg),
    panel: hexNum(PAL.panel),
    raised: hexNum(PAL.raised),
    ink: hexNum(PAL.ink),
    dim: hexNum(PAL.dim),
    faint: hexNum(PAL.faint),
    line: hexNum(PAL.line),
    accent: hexNum(PAL.accent),
    accent2: hexNum(PAL.accent2),
    warn: hexNum(PAL.warn),
    ok: hexNum(PAL.ok),
    bad: hexNum(PAL.bad),
    legend: hexNum(PAL.legend),
    violet: hexNum(PAL.violet),
    skin: hexNum(PAL.skin),
    skinDark: hexNum(PAL.skinDark),
    denimDark: hexNum(PAL.denimDark),
    white: 0xffffff,
    black: 0x000000,
    sky: 0x0a1a2a,
    windowGlass: 0x0b2438,
    vest: 0xb4813f,
    /** Yasser's surplus-jacket green. Same values the canvas build uses. */
    bossMain: 0x4b6b3d,
    bossTrim: 0x241a10,
} as const;

/** Texture key prefix, so nothing collides with another Phaser game's atlas. */
export const T = (name: string) => `f4-${name}`;
export const TG = (g: GlyphKey) => `f4-g-${g}`;

/** Font stack matching styles/theme.css so HUD text looks native to the app. */
export const MONO = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";
export const DISPLAY = "'Bungee', Impact, system-ui, sans-serif";

type Scene = PhaserNS.Scene;

/**
 * Bake one Graphics object into a texture and throw the Graphics away.
 * `generateTexture` is the whole trick: after this call the shape costs nothing
 * to draw again, at any position, at any rotation, tinted any colour.
 */
const bake = (scene: Scene, key: string, w: number, h: number, draw: (g: PhaserNS.GameObjects.Graphics) => void) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
};

/** Canvas-backed texture, for the two things Graphics genuinely cannot do:
 *  radial gradients and emoji glyphs. */
const bakeCanvas = (
    scene: Scene, key: string, w: number, h: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
    smooth = false,
) => {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    if (ctx) draw(ctx);
    tex.refresh();
    // Emoji and gradients are not pixel art; let them filter smoothly even
    // though the game is globally NEAREST.
    if (smooth) tex.setFilter(2 as unknown as PhaserNS.Textures.FilterMode);
};

const strokeRect = (
    g: PhaserNS.GameObjects.Graphics,
    x: number, y: number, w: number, h: number, color: number, lw = 1, alpha = 1,
) => {
    g.lineStyle(lw, color, alpha);
    g.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
};

const fillRect = (
    g: PhaserNS.GameObjects.Graphics,
    x: number, y: number, w: number, h: number, color: number, alpha = 1,
) => {
    g.fillStyle(color, alpha);
    g.fillRect(x, y, w, h);
};

// ---------------------------------------------------------------------------
// Emoji
// ---------------------------------------------------------------------------
/**
 * Emoji baked into textures rather than drawn as Text objects.
 *
 * The canvas build calls `ctx.fillText` per emoji per frame — roughly 30-60
 * shaped-text rasterisations a frame at peak. Baked once, an emoji becomes a
 * quad that can be pooled into a particle emitter, tweened, rotated and
 * batched. This is what lets the knock-out stars, the falafel splats and the
 * muzzle flash be real Phaser particle emitters instead of a hand-rolled
 * particle array.
 */
const bakeGlyphs = (scene: Scene) => {
    const S = 40;
    for (const [key, ch] of Object.entries(GLYPHS) as [GlyphKey, string][]) {
        bakeCanvas(scene, TG(key), S, S, ctx => {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `${Math.round(S * 0.82)}px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`;
            ctx.fillText(ch, S / 2, S / 2 + 1);
        }, true);
    }
};

// ---------------------------------------------------------------------------
// The darkness overlay
// ---------------------------------------------------------------------------
/**
 * A big opaque black plate with a soft hole punched in the middle.
 *
 * Two are baked — one at the bare-handed radius, one at the radius the
 * Glow-in-the-Dark Lighter buys you — and the galley crossfades between them.
 * Centring the plate on the player gives the light pool for free: no per-frame
 * gradient construction (the canvas build rebuilds a `createRadialGradient`
 * every frame), and because it is a plain Image it can be tweened, so the
 * emergency-lighting flicker is a looping alpha/scale tween instead of a
 * sine wave sampled in the draw call.
 */
const bakeDarkness = (scene: Scene) => {
    const plate = (key: string, r: number, warm: boolean) => {
        bakeCanvas(scene, key, DARK_TEX_W, DARK_TEX_H, ctx => {
            const cx = DARK_TEX_W / 2, cy = DARK_TEX_H / 2;
            ctx.fillStyle = 'rgba(2,2,4,0.975)';
            ctx.fillRect(0, 0, DARK_TEX_W, DARK_TEX_H);
            // Carve the pool out of the plate.
            ctx.globalCompositeOperation = 'destination-out';
            const g = ctx.createRadialGradient(cx, cy, Math.max(3, r * 0.34), cx, cy, r);
            g.addColorStop(0, 'rgba(0,0,0,1)');
            g.addColorStop(0.55, 'rgba(0,0,0,0.52)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            if (warm) {
                // A warm rim, so the lighter reads as the reason you can see.
                const wg = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
                wg.addColorStop(0, 'rgba(255,170,60,0.16)');
                wg.addColorStop(1, 'rgba(255,120,0,0)');
                ctx.fillStyle = wg;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }, true);
    };
    plate(T('dark-bare'), DARK_R_BARE, false);
    plate(T('dark-lit'), DARK_R_LIT, true);
};

// ---------------------------------------------------------------------------
// Everything else
// ---------------------------------------------------------------------------
export function bakeTextures(scene: Scene) {
    // --- the atom. Every block-figure limb, every bar, every panel is this
    // one white pixel, tinted and stretched. One texture, one batch.
    bake(scene, T('px'), 1, 1, g => fillRect(g, 0, 0, 1, 1, C.white));

    // Soft ground shadow (gradient => canvas).
    bakeCanvas(scene, T('shadow'), 24, 10, ctx => {
        const g = ctx.createRadialGradient(12, 5, 1, 12, 5, 12);
        g.addColorStop(0, 'rgba(0,0,0,0.5)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(12, 5, 12, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }, true);

    // --- Parallax strips. Each is exactly one seat pitch wide so a TileSprite
    // tiles it seamlessly down a 820px cabin. The canvas build loops a `band()`
    // helper and re-draws every row every frame; these scroll by assigning
    // `tilePositionX`, which costs nothing.
    bake(scene, T('ceiling'), SEAT_PITCH, 20, g => {
        fillRect(g, 0, 0, SEAT_PITCH, 20, C.raised);
        fillRect(g, 0, 0, 1, 20, C.line);
        fillRect(g, SEAT_PITCH / 2, 0, 1, 20, C.line);
        // reading light
        g.fillStyle(C.warn, 1);
        g.fillCircle(12, 10, 1.6);
    });
    bake(scene, T('ceiling-dark'), SEAT_PITCH, 20, g => {
        fillRect(g, 0, 0, SEAT_PITCH, 20, C.panel);
        fillRect(g, 0, 0, 1, 20, C.line);
        g.fillStyle(C.faint, 1);
        g.fillCircle(12, 10, 1.4);
    });

    bake(scene, T('bins'), SEAT_PITCH, 26, g => {
        fillRect(g, 0, 0, SEAT_PITCH, 26, C.panel);
        strokeRect(g, 2, 2, SEAT_PITCH - 4, 20, C.line);
        fillRect(g, SEAT_PITCH / 2 - 4, 17, 8, 2, C.faint);
        fillRect(g, 0, 24, SEAT_PITCH, 2, C.line);
    });

    // Wall with a transparent window aperture. A sky TileSprite scrolling at a
    // slower rate sits behind it, so clouds crawl past the windows for free —
    // two layers instead of the canvas build's per-window cloud bookkeeping.
    bake(scene, T('windowwall'), SEAT_PITCH, 42, g => {
        fillRect(g, 0, 0, SEAT_PITCH, 8, C.bg);
        fillRect(g, 0, 32, SEAT_PITCH, 10, C.bg);
        fillRect(g, 0, 8, 12, 24, C.bg);
        fillRect(g, 32, 8, SEAT_PITCH - 32, 24, C.bg);
        strokeRect(g, 12, 8, 20, 24, C.line);
        fillRect(g, 12, 8, 20, 3, C.raised);
    });
    // The galley has no windows — ovens, coffee makers and a pulled breaker.
    bake(scene, T('galleywall'), SEAT_PITCH, 42, g => {
        fillRect(g, 0, 0, SEAT_PITCH, 42, C.panel);
        strokeRect(g, 3, 5, 18, 30, C.line);
        strokeRect(g, 24, 5, 17, 14, C.line);
        fillRect(g, 26, 9, 13, 2, C.faint);
        strokeRect(g, 24, 22, 17, 13, C.line);
        g.fillStyle(C.bad, 1);
        g.fillCircle(32, 28, 1.4);
    });
    bakeCanvas(scene, T('sky'), 88, 42, ctx => {
        ctx.fillStyle = '#0a1a2a';
        ctx.fillRect(0, 0, 88, 42);
        const cloud = (x: number, y: number, s: number) => {
            ctx.fillStyle = 'rgba(180,205,230,0.45)';
            ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(180,205,230,0.35)';
            ctx.beginPath(); ctx.arc(x + s * 0.9, y + 1, s * 0.75, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x - s * 0.8, y + 2, s * 0.6, 0, Math.PI * 2); ctx.fill();
        };
        cloud(18, 14, 5);
        cloud(58, 28, 4);
        cloud(76, 10, 3);
    }, true);

    // Seat rows behind the aisle. Crouching drops you below the headrests.
    bake(scene, T('seats'), SEAT_PITCH, 60, g => {
        fillRect(g, 0, 0, SEAT_PITCH, 60, C.raised);
        fillRect(g, 6, 26, 32, 34, C.raised);
        fillRect(g, 6, 20, 32, 8, C.denimDark);
        strokeRect(g, 6, 20, 32, 40, C.line);
        fillRect(g, 38, 36, 3, 24, C.panel);
    });
    bake(scene, T('lieflats'), SEAT_PITCH, 60, g => {
        // Business class: a shell rather than a row, and taller.
        fillRect(g, 0, 0, SEAT_PITCH, 60, C.raised);
        fillRect(g, 4, 14, 36, 46, C.panel);
        fillRect(g, 4, 14, 36, 6, C.violet);
        strokeRect(g, 4, 14, 36, 46, C.line);
        fillRect(g, 8, 26, 28, 2, C.line);
    });

    bake(scene, T('carpet'), 16, 34, g => {
        fillRect(g, 0, 0, 16, 34, C.panel);
        fillRect(g, 0, 0, 16, 1, C.line);
        fillRect(g, 0, 4, 5, 2, C.faint);
    });
    bake(scene, T('carpet-dark'), 16, 34, g => {
        fillRect(g, 0, 0, 16, 34, C.panel);
        fillRect(g, 0, 0, 16, 1, C.line);
        fillRect(g, 0, 4, 5, 2, C.ok);
    });

    // Foreground seat tops, so you run *down* an aisle rather than past a wall.
    bake(scene, T('fore'), SEAT_PITCH, 16, g => {
        fillRect(g, 4, 0, 34, 16, C.void);
        fillRect(g, 4, 0, 34, 2, C.line);
    });

    // --- Furniture you can stand on.
    //
    // Deliberately flat, hard-topped and one pixel of highlight along the top
    // edge: a platform whose landing surface is ambiguous is a platform the
    // player misses, and in a cabin drawn in near-blacks the top edge is the
    // only thing saying "here, this line, this is the floor now".
    bake(scene, T('bulkhead-ledge'), 16, 8, g => {
        fillRect(g, 0, 0, 16, 8, C.raised);
        fillRect(g, 0, 0, 16, 1, C.line);
    });
    bake(scene, T('seat-row'), 16, 8, g => {
        // One-way, and it has to look it: the underside is open so that jumping
        // up through it reads as intended rather than as a collision bug.
        fillRect(g, 0, 0, 16, 3, C.raised);
        fillRect(g, 0, 0, 16, 1, C.accent);
        fillRect(g, 2, 4, 12, 1, C.faint);
    });
    bake(scene, T('hangingcloth'), 16, 26, g => {
        fillRect(g, 0, 0, 16, 26, C.warn);
        fillRect(g, 0, 0, 16, 2, C.line);
        fillRect(g, 3, 4, 2, 20, C.bg);
        fillRect(g, 11, 4, 2, 20, C.bg);
    });


    // --- The background, and the traffic through it.
    //
    // Eighteen silhouettes, deliberately flat and readable at 20-34px rather
    // than detailed: these draw at 62% brightness on the far plane and behind
    // everything in the fight, so shape is the only thing that survives. Each
    // is a placeholder with a real footprint — the sizes match
    // `docs/ASSETS-FLIGHT404.md`, so a delivered PNG drops straight in through
    // the art registry and the layout does not move.
    const blob = (
        key: string, w: number, h: number,
        parts: [number, number, number, number, number][],
    ) => bake(scene, T(key), w, h, g => { for (const [x, y, pw, ph, col] of parts) fillRect(g, x, y, pw, ph, col); });

    // Residents — they stand still and never look at you.
    blob('bg-coffee-crew', 34, 26, [[2,10,7,16,C.dim],[12,8,7,18,C.dim],[22,11,7,15,C.dim],[14,20,6,3,C.warn],[16,17,2,3,C.faint]]);
    blob('bg-shawarma', 24, 30, [[9,2,6,20,C.warn],[8,22,8,8,C.dim],[2,14,5,16,C.dim],[18,20,4,10,C.faint]]);
    blob('bg-sweeper', 18, 26, [[6,4,6,22,C.dim],[3,18,3,10,C.faint],[1,24,14,2,C.line]]);
    blob('bg-balcony', 30, 24, [[3,8,6,16,C.dim],[13,6,6,18,C.dim],[22,9,6,15,C.dim],[0,20,30,4,C.raised]]);
    blob('bg-porter', 20, 32, [[6,16,8,16,C.dim],[3,0,14,6,C.raised],[4,7,12,6,C.raised],[5,13,10,4,C.raised]]);
    blob('bg-argument', 28, 26, [[3,6,7,20,C.dim],[17,5,7,21,C.dim],[10,10,3,2,C.warn],[15,13,3,2,C.warn]]);
    blob('bg-donkey', 26, 22, [[3,6,18,10,C.dim],[2,2,6,7,C.dim],[4,16,3,6,C.faint],[17,16,3,6,C.faint],[21,7,4,2,C.faint]]);
    blob('bg-sheep', 30, 18, [[1,5,12,9,C.faint],[15,6,12,8,C.faint],[3,14,2,4,C.dim],[24,14,2,4,C.dim]]);

    // Crossings — they walk through and they are gone. Drawn facing right; the
    // scene mirrors them, which is why nothing here is asymmetric by accident.
    blob('cross-donkey', 26, 22, [[3,6,18,10,C.dim],[19,2,6,7,C.dim],[4,16,3,6,C.faint],[17,16,3,6,C.faint],[1,7,3,2,C.faint]]);
    blob('cross-sheep', 34, 18, [[1,5,14,9,C.faint],[17,6,14,8,C.faint],[3,14,2,4,C.dim],[28,14,2,4,C.dim]]);
    // The camel is drawn tall on purpose: the bit is that it does not fit.
    blob('cross-camel', 32, 34, [[5,12,20,10,C.warn],[9,6,7,8,C.warn],[16,8,7,6,C.warn],[24,4,7,9,C.warn],[6,22,4,12,C.dim],[20,22,4,12,C.dim]]);
    blob('cross-goats', 30, 18, [[2,6,11,8,C.dim],[16,7,11,7,C.dim],[11,3,3,4,C.faint],[25,4,3,4,C.faint]]);
    blob('cross-chickens', 26, 12, [[1,4,7,7,C.white],[10,5,7,6,C.white],[19,3,6,8,C.white],[6,1,2,3,C.bad]]);
    blob('cross-cart', 30, 24, [[2,8,20,10,C.raised],[4,4,16,5,C.ok],[3,18,5,5,C.line],[16,18,5,5,C.line],[23,6,6,18,C.dim]]);
    blob('cross-tea', 20, 28, [[6,8,8,20,C.dim],[1,6,7,12,C.legend],[14,12,5,3,C.legend],[7,3,6,5,C.skin]]);
    // 44px wide because it does not fit down the aisle, which is its whole bit.
    blob('cross-rug', 44, 26, [[0,6,44,7,C.violet],[16,13,8,13,C.dim],[18,1,5,5,C.skin]]);
    blob('cross-bread', 22, 30, [[7,10,8,20,C.dim],[1,4,20,5,C.legend],[8,4,6,4,C.skin]]);
    blob('cross-bicycle', 26, 24, [[2,16,7,7,C.line],[17,16,7,7,C.line],[6,10,14,3,C.raised],[9,2,7,10,C.dim]]);

    // --- Props
    bake(scene, T('trolley'), 24, 26, g => {
        fillRect(g, 1, 0, 22, 22, C.raised);
        strokeRect(g, 1, 0, 22, 22, C.line);
        fillRect(g, 3, 3, 18, 5, C.faint);
        fillRect(g, 3, 12, 18, 1, C.line);
        g.fillStyle(C.black, 1);
        g.fillCircle(5, 23, 2);
        g.fillCircle(19, 23, 2);
    });
    bake(scene, T('bin-open'), 30, 24, g => {
        fillRect(g, 0, 0, 30, 24, C.bg);
        strokeRect(g, 0, 0, 30, 24, C.warn);
        fillRect(g, 2, 21, 26, 2, C.raised);
    });
    bake(scene, T('door-sealed'), 26, 102, g => {
        fillRect(g, 0, 0, 26, 102, C.raised);
        strokeRect(g, 0, 0, 26, 102, C.bad, 2);
        fillRect(g, 4, 46, 18, 2, C.line);
    });
    bake(scene, T('door-open'), 26, 102, g => {
        fillRect(g, 0, 0, 26, 102, 0x08140f);
        strokeRect(g, 0, 0, 26, 102, C.ok, 2);
    });
    bake(scene, T('ring'), 20, 15, g => {
        strokeRect(g, 0, 0, 20, 15, C.accent2, 2);
        strokeRect(g, 4, 3, 12, 9, C.warn, 1);
    });
    bake(scene, T('belt'), 18, 2, g => fillRect(g, 0, 0, 18, 2, C.warn));
    bake(scene, T('tape'), 28, 4, g => fillRect(g, 0, 0, 28, 4, C.warn));
    bake(scene, T('eyes'), 9, 3, g => {
        g.fillStyle(0xffb400, 0.6);
        g.fillCircle(1.5, 1.5, 1.2);
        g.fillCircle(7.5, 1.5, 1.2);
    });
    bake(scene, T('casing'), 2, 2, g => fillRect(g, 0, 0, 2, 2, C.legend));
    bakeCanvas(scene, T('muzzle'), 16, 16, ctx => {
        const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        g.addColorStop(0, 'rgba(255,240,190,0.95)');
        g.addColorStop(0.4, 'rgba(255,200,90,0.6)');
        g.addColorStop(1, 'rgba(255,160,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 16, 16);
    }, true);
    bakeCanvas(scene, T('glow'), 24, 24, ctx => {
        const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
        g.addColorStop(0, 'rgba(0,229,192,0.5)');
        g.addColorStop(1, 'rgba(0,229,192,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 24, 24);
    }, true);

    // --- The flight deck. One 352-wide texture rather than 30 draw calls, with
    // the windscreen left transparent so the sky layer shows through it.
    bake(scene, T('cockpit'), VIEW_W, FLOOR_Y - 16, g => {
        const top = 16;
        const px = (y: number) => y - top;
        fillRect(g, 0, px(16), VIEW_W, px(62) - px(16), C.panel);
        fillRect(g, 0, px(62), VIEW_W, px(FLOOR_Y) - px(62), C.bg);
        // Windscreen aperture: nothing drawn between x150..340, y64..102.
        fillRect(g, 0, px(62), 150, px(FLOOR_Y) - px(62), C.bg);
        fillRect(g, 340, px(62), VIEW_W - 340, px(FLOOR_Y) - px(62), C.bg);
        fillRect(g, 150, px(62), 190, 2, C.bg);
        fillRect(g, 150, px(102), 190, px(FLOOR_Y) - px(102), C.bg);
        strokeRect(g, 150, px(64), 190, 38, C.line);
        fillRect(g, 245, px(64), 1, 38, C.line);
        // Instrument bank
        fillRect(g, 250, px(106), 90, 20, C.raised);
        strokeRect(g, 250, px(106), 90, 20, C.line);
        for (let i = 0; i < 12; i++) {
            g.fillStyle(i % 3 === 0 ? C.bad : i % 3 === 1 ? C.warn : C.ok, 1);
            g.fillCircle(256 + (i % 6) * 14, px(112) + Math.floor(i / 6) * 9, 1.8);
        }
        // Pilot seats
        for (const sx of [196, 240]) {
            fillRect(g, sx, px(128), 30, 36, C.raised);
            fillRect(g, sx, px(122), 30, 8, C.violet);
            strokeRect(g, sx, px(122), 30, 42, C.line);
        }
        // The jump seat he ends up taped to
        fillRect(g, 24, px(132), 22, 32, C.raised);
        strokeRect(g, 24, px(132), 22, 32, C.warn);
        // The cabin door he came through
        fillRect(g, 96, px(66), 30, 98, C.panel);
        strokeRect(g, 96, px(66), 30, 98, C.line);
    });

    bakeGlyphs(scene);
    bakeDarkness(scene);
}
