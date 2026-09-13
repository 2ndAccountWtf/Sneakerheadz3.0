/**
 * FLIGHT 404 — run-and-gun cabin rescue
 * =====================================
 * Yasser Abbasfat and four of his "brothers" have hijacked a passenger jet with
 * a falafel vest, a megaphone and absolutely no plan. You board at the rear and
 * work forward: economy, the galley (the lights are out back there), business
 * class, then the cockpit, where Yasser is ranting at the autopilot.
 *
 * Structurally this is Contra with Wolfenstein's room-clearing: each section is
 * a stretch of fuselage, the forward bulkhead door only unlocks once every mook
 * in that section is horizontal, and the camera scrolls to follow you.
 *
 * Two rules shape the whole file:
 *
 *  1. Every per-frame value lives inside one mutable `World` object held in a
 *     ref. React state is reserved for things that change a few times a *game*
 *     (section name, hostage count, the result card). Re-rendering at 60Hz
 *     stalls the frame on a phone, which is where this is actually played.
 *
 *  2. The simulation is a pair of pure module-level functions — `createWorld`
 *     and `stepWorld` — that never touch React, the DOM or the canvas. That is
 *     what makes the game testable headlessly (see the harness in tests/),
 *     and it is why the drawing code is a separate pass that only reads state.
 *
 * There are no image assets in this project: the plane, the cast and the
 * knock-out stars are all rectangles, circles and emoji glyphs.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ArcadeShell, useInput, PAL, KIT,
    clear, rect, outline, circle, line, text, glyph, bar, figure, band,
    shakeOffset, banner,
} from './engine';
import { MiniGameResult } from './MiniGameShell';
import { useGame } from '../../hooks/useGame';
import { armsFor, hasWeapon, FISTS } from '../../systems/weapons';
import type { Weapon } from '../../systems/weapons';

// ---------------------------------------------------------------------------
// Geometry. A wide logical canvas suits a side-scroller; everything else is
// derived from it so the cabin layout only has to be reasoned about once.
// ---------------------------------------------------------------------------
export const VIEW_W = 352;
export const VIEW_H = 198;

const FLOOR_Y = 164;        // the aisle carpet — every character's feet line
const BIN_FEET = 58;        // feet line for a mook crouched in an open overhead bin
const SEAT_PITCH = 44;      // distance between seat rows / windows / bin doors
const GRAVITY = 620;
const JUMP_V = -218;
const RUN_SPEED = 88;
const PLAYER_H = 26;
const CROUCH_H = 15;        // short enough to duck a seltzer spray or a megaphone ring
const NOTICE_RANGE = 152;

/** Half-width of the light pool in an unpowered section. */
const DARK_R_BARE = 34;
/** ...and with the Glow-in-the-Dark Lighter out. Same section, different game. */
const DARK_R_LIT = 96;
/** Sentinel meaning "the lights are on, draw everything". */
const LIT_R = 9999;

// ---------------------------------------------------------------------------
// Voice. Lifted from data/celebrities/yasser-abbasfat/dialogue.ts so the boss
// and his cronies sound exactly like they do everywhere else in the game:
// all caps, "BROTHER", Bibi, pigeons, and threats that never once land.
// ---------------------------------------------------------------------------
const MOOK_BARKS = [
    'YESSS BROTHER, EVEN THE WIFI IS ZIONIST!',
    'THE MOON IS A DRONE, BROTHER! A DRONE!',
    'BIBI CONTROLS THE PIGEONS, CONFIRMED!',
    'THE DUNKS ARE CURSED! WE MUST CLEANSE THE DUNKS!',
    'BROTHER, WHICH ONE IS THE TRIGGER?',
    'MY VEST IS ONLY FALAFEL! IT IS FINE!',
    'WHOSE JOB WAS THE DOOR? IT WAS YOUR JOB!',
];
const TRIP_BARKS = [
    'THE FLOOR IS AN OCCUPIER!',
    'WHO PUT A CARPET THERE?!',
    'I MEANT TO DO THAT, BROTHER!',
];
const BONK_BARKS = [
    'MY OWN FALAFEL! BETRAYAL!',
    'THE FALAFEL HAS BEEN TURNED!',
];
const TROLLEY_BARKS = [
    'THE TROLLEY IS ALSO ZIONIST!',
    'I AM SAFE BEHIND THE DRINKS!',
    'IS THERE A TAHINI ONE?',
];
const PANIC_BARKS = [
    'I DID NOT SIGN UP FOR THE FRONT LINE, BROTHER!',
    'THIS IS A MANAGEMENT PROBLEM!',
];
const YASSER_RANTS = [
    'THE SKY? FAKE. THE CLOUDS? CGI.',
    'JORDAN ONCE ATE A FALAFEL IN 1988 — NEVER FORGET!',
    'THE BALD EAGLE IS A ZIONIST SPY DRONE!',
    'BIBI IS STEALING THE AIR YOU BREATHE!',
    'COFFEE IS A CRIME AGAINST FALAFELSTEEN!',
    'KANYE TEXTED ME. SAID HE IS FROM FALAFELSTEEN TOO.',
    'THIS AIRCRAFT IS PROPERTY OF THE RESISTANCE NOW!',
];
const YASSER_THROW = 'FALAFELSTEEN THROWS FIRST!';
const YASSER_SUMMON = 'BROTHERS! TO ME! BRING THE TROLLEY!';
const YASSER_CHARGE = 'I DETONATE FOR JUSTICE AND FALAFELSTEEN!';
const YASSER_WALL = 'THE WALL IS ALSO ZIONIST!';
const YASSER_MEGA = 'FREE FALAFELSTEEN OR I WILL LIBERATE YOUR WALLET!';
const YASSER_DEFEAT = [
    'THIS IS A SETUP! A ZIONIST TRAP!',
    'THE FALAFEL WILL RISE AGAIN!',
    'FREE… FALAF… AHHHHHH—',
];
/** Passengers are grateful in the least useful way available to them. */
const FREED_LINES = [
    'THANK YOU! NOW GET MY AIRPODS FROM 14C!',
    'Is the wifi back? I have a raid at nine.',
    'I filmed all of it. You look insane, by the way.',
    'God bless you. Do you have a bureka on you?',
    'Finally. Tell the pilot I asked for the chicken.',
    'My connection is in Larnaca, so, quickly please.',
];
/** ...and withering when you shoot them, which you should not do. */
const WITHERED_LINES = [
    'I PAID FOR THIS SEAT.',
    'You are the rescue? Genuinely?',
    'That was my knee. My KNEE.',
    'I am writing a review about you specifically.',
    'Sir. SIR. I have a connecting flight.',
];

// ---------------------------------------------------------------------------
// Level data. Authored rather than generated: the comedy depends on the mook
// behind the trolley being exactly where you stop being careful.
// ---------------------------------------------------------------------------
type MookKind = 'charger' | 'thrower' | 'trolley';

interface SpawnDef { kind: MookKind; x: number; perch?: boolean }
interface SectionDef {
    name: string;
    tag: string;
    length: number;
    /** Unpowered stretch — see the darkness model below. */
    dark: boolean;
    boss?: boolean;
    mooks: SpawnDef[];
    hostages: number[];
    /** Drinks trolleys parked in the aisle; double as cover for both sides. */
    trolleys: number[];
}

export const SECTIONS: SectionDef[] = [
    {
        name: 'ECONOMY',
        tag: 'ROWS 30-44 — THE SMELL IS TAHINI',
        length: 760, dark: false,
        mooks: [
            { kind: 'charger', x: 210 },
            { kind: 'thrower', x: 330, perch: true },
            { kind: 'charger', x: 455 },
            { kind: 'trolley', x: 560 },
            { kind: 'thrower', x: 660 },
        ],
        hostages: [175, 420, 690],
        trolleys: [560],
    },
    {
        name: 'THE GALLEY',
        tag: 'POWER IS OUT — SOMEONE PULLED A BREAKER',
        length: 640, dark: true,
        mooks: [
            { kind: 'trolley', x: 190 },
            { kind: 'charger', x: 300 },
            { kind: 'charger', x: 352 },
            { kind: 'thrower', x: 470, perch: true },
            { kind: 'trolley', x: 560 },
        ],
        hostages: [250, 520],
        trolleys: [190, 560],
    },
    {
        name: 'BUSINESS CLASS',
        tag: 'THE LIE-FLATS ARE FULLY OCCUPIED',
        length: 820, dark: false,
        mooks: [
            { kind: 'charger', x: 200 },
            { kind: 'thrower', x: 290, perch: true },
            { kind: 'trolley', x: 385 },
            { kind: 'charger', x: 510 },
            { kind: 'thrower', x: 600 },
            { kind: 'charger', x: 690 },
            { kind: 'thrower', x: 755, perch: true },
        ],
        hostages: [245, 465, 735],
        trolleys: [385],
    },
    {
        name: 'THE COCKPIT',
        tag: 'HE IS SHOUTING AT THE AUTOPILOT',
        length: VIEW_W, dark: false, boss: true,
        mooks: [],
        hostages: [],
        trolleys: [300],
    },
];

// ---------------------------------------------------------------------------
// World state
// ---------------------------------------------------------------------------
export interface SimInput {
    left: boolean; right: boolean; up: boolean; down: boolean;
    /** Held — every weapon is hold-to-fire, gated by its own cooldown. */
    fire: boolean;
    /** Edge-triggered: jumping off a held button would be a pogo stick. */
    jumpPressed: boolean;
    /** Test/rail hook: index into `world.weapons`. */
    switchTo?: number;
}

interface PlayerState {
    x: number; y: number; vx: number; vy: number;
    facing: 1 | -1;
    onGround: boolean;
    crouch: boolean;
    aimUp: boolean;
    hp: number;
    invuln: number;
    hurtT: number;
    stride: number;
    /** Red Bull timer — brief speed boost dropped by mooks. */
    speedT: number;
    fireCd: number;
}

interface Mook {
    id: number;
    kind: MookKind;
    x: number; y: number; vx: number; vy: number;
    hp: number; maxHp: number;
    facing: 1 | -1;
    state: string;
    t: number;
    perch: boolean;
    slowT: number;
    hurtT: number;
    hitCd: number;
    say: string; sayT: number;
    koT: number; spin: number;
    /** x of the trolley this one cowers behind, if any. */
    cover?: number;
}

interface Boss {
    x: number; y: number; vx: number; vy: number;
    hp: number; maxHp: number;
    facing: 1 | -1;
    state: string;
    t: number;
    phase: 1 | 2 | 3;
    step: number;
    hurtT: number;
    say: string; sayT: number;
    shots: number;
    vest: number;
    /** Damage he has absorbed during the current attack — see BOSS_WINDOW. */
    taken: number;
    /** Charge direction, locked when the charge starts — he commits to it. */
    dir: 1 | -1;
}

interface Shot {
    id: number;
    x: number; y: number; vx: number; vy: number;
    w: number; h: number;
    dmg: number;
    friendly: boolean;
    kind: 'melee' | 'thrown' | 'bullet' | 'falafel' | 'seltzer' | 'ring' | 'trolley';
    glyph: string;
    life: number;
    gravity: number;
    pierce: boolean;
    slows: boolean;
    returns: boolean;
    weaponIdx: number;
    travel: number;
    returning: boolean;
    /** Melee hitboxes ride along with the player instead of flying. */
    attached: boolean;
    spin: number;
    hits: number[];
}

interface Hostage {
    x: number;
    freed: boolean;
    dwell: number;
    say: string; sayT: number;
    cheer: number;
}

interface Pickup { x: number; y: number; vy: number; kind: 'bureka' | 'redbull'; t: number }

interface Part {
    x: number; y: number; vx: number; vy: number;
    life: number; max: number;
    kind: 'star' | 'casing' | 'spark' | 'splat' | 'flash' | 'note';
    str?: string;
    color?: string;
    spin: number;
}

export interface World {
    phase: 'play' | 'outro' | 'won' | 'lost';
    pendingWin: boolean;
    outroT: number;
    time: number;
    seed: number;

    section: number;
    camX: number;
    doorOpen: boolean;

    player: PlayerState;
    mooks: Mook[];
    boss: Boss | null;
    shots: Shot[];
    hostages: Hostage[];
    pickups: Pickup[];
    parts: Part[];

    weapons: Weapon[];
    weaponIdx: number;
    /** Parallel to `weapons`. -1 means unlimited. */
    ammo: number[];
    /** Weapon id -> projectiles of that weapon currently out. Gates `returns`. */
    inFlight: Record<string, number>;

    hasLighter: boolean;
    hasEnergy: boolean;

    shake: number;
    flick: number;
    banner: { big: string; sub: string; t: number } | null;

    freed: number;
    hostageHits: number;
    kos: number;
    score: number;
    nextId: number;
}

// --- tiny helpers -----------------------------------------------------------
const clampN = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Deterministic LCG so a headless run of 10,000 frames reproduces exactly. */
const rnd = (w: World) => { w.seed = (w.seed * 1664525 + 1013904223) >>> 0; return w.seed / 4294967296; };
const pick = <T,>(w: World, list: T[]): T => list[Math.floor(rnd(w) * list.length) % list.length];
const overlap = (
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number,
) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

const MOOK_HP: Record<MookKind, number> = { charger: 30, thrower: 24, trolley: 36 };

const makeMook = (w: World, def: SpawnDef, cover?: number): Mook => ({
    id: w.nextId++,
    kind: def.kind,
    x: def.x,
    y: def.perch ? BIN_FEET : FLOOR_Y,
    vx: 0, vy: 0,
    hp: MOOK_HP[def.kind], maxHp: MOOK_HP[def.kind],
    facing: -1,
    state: def.kind === 'trolley' ? 'hidden' : 'idle',
    t: rnd(w) * 0.8,
    perch: !!def.perch,
    slowT: 0, hurtT: 0, hitCd: 0,
    say: '', sayT: 0,
    koT: 0, spin: 0,
    cover,
});

/** Load one section's cast. Called on entry and on every section transition. */
const loadSection = (w: World, idx: number) => {
    const def = SECTIONS[idx];
    w.section = idx;
    w.doorOpen = false;
    w.mooks = def.mooks.map(m => {
        // A `trolley` mook is paired with the nearest parked trolley so his
        // cover is a real object in the world, not an abstract flag.
        const cover = m.kind === 'trolley'
            ? def.trolleys.reduce((best, tx) => (Math.abs(tx - m.x) < Math.abs(best - m.x) ? tx : best), def.trolleys[0] ?? m.x)
            : undefined;
        return makeMook(w, m, cover);
    });
    w.hostages = def.hostages.map(x => ({ x, freed: false, dwell: 0, say: '', sayT: 0, cheer: 0 }));
    w.shots = [];
    w.pickups = [];
    w.player.x = 18;
    w.player.y = FLOOR_Y;
    w.player.vx = 0; w.player.vy = 0;
    w.player.facing = 1;
    w.camX = 0;
    w.banner = { big: def.boss ? 'YASSER ABBASFAT' : `SECTION ${idx + 1}`, sub: def.boss ? def.tag : `${def.name} — ${def.tag}`, t: 2.6 };
    w.boss = def.boss
        ? {
            x: def.length - 60, y: FLOOR_Y, vx: 0, vy: 0,
            hp: 280, maxHp: 280, facing: -1,
            state: 'intro', t: 0, phase: 1, step: 0,
            hurtT: 0, say: 'YOU! YES, YOU! HAND OVER THE PANDAS! THEY FUND THE OCCUPATION!', sayT: 3.2,
            shots: 0, vest: 6, taken: 0, dir: -1,
        }
        : null;
};

export interface WorldOpts {
    weapons: Weapon[];
    hasLighter?: boolean;
    hasEnergy?: boolean;
    seed?: number;
    /** Start partway in. Only used by the test harness. */
    startSection?: number;
}

export function createWorld(opts: WorldOpts): World {
    const weapons = opts.weapons.length ? opts.weapons : [FISTS];
    const w: World = {
        phase: 'play', pendingWin: false, outroT: 0, time: 0,
        seed: (opts.seed ?? 1337) >>> 0,
        section: 0, camX: 0, doorOpen: false,
        player: {
            x: 18, y: FLOOR_Y, vx: 0, vy: 0, facing: 1,
            onGround: true, crouch: false, aimUp: false,
            hp: 100, invuln: 0, hurtT: 0, stride: 0, speedT: 0, fireCd: 0,
        },
        mooks: [], boss: null, shots: [], hostages: [], pickups: [], parts: [],
        weapons,
        weaponIdx: 0,
        ammo: weapons.map(x => (x.uses === undefined ? -1 : x.uses)),
        inFlight: {},
        hasLighter: !!opts.hasLighter,
        hasEnergy: !!opts.hasEnergy,
        shake: 0, flick: 1, banner: null,
        freed: 0, hostageHits: 0, kos: 0, score: 0, nextId: 1,
    };
    loadSection(w, clampN(opts.startSection ?? 0, 0, SECTIONS.length - 1));
    return w;
}

// ---------------------------------------------------------------------------
// The darkness model
// ---------------------------------------------------------------------------
/**
 * How far you can see, in logical pixels, right now.
 *
 * In a powered section this is effectively infinite. In the galley the cabin is
 * on emergency power only: bare-handed you get a 34px pool of light around
 * yourself — less than half a screen, so a charger is on you before he is drawn
 * and a thrower's wind-up is invisible. With `itm-haunted-lighter` in your
 * storage the pool is 96px, which is far enough to see the wind-up and react.
 *
 * The renderer punches a hole of exactly this radius in a near-black overlay
 * AND the simulation reads it too: anything outside the pool is not drawn, and
 * feeling your way through the dark costs you 20% of your run speed unless the
 * lighter is out. So the item does not merely brighten the picture, it changes
 * how fast you move and whether you can see an attack coming.
 */
export function visionRadius(w: World): number {
    if (!SECTIONS[w.section].dark) return LIT_R;
    return w.hasLighter ? DARK_R_LIT : DARK_R_BARE;
}

const inLight = (w: World, x: number, y: number) => {
    const r = visionRadius(w);
    if (r >= LIT_R) return true;
    const dx = x - w.player.x;
    const dy = y - (w.player.y - 13);
    return dx * dx + dy * dy < r * r;
};

// ---------------------------------------------------------------------------
// Particles / feedback
// ---------------------------------------------------------------------------
const part = (w: World, p: Partial<Part> & { x: number; y: number; kind: Part['kind'] }) => {
    w.parts.push({
        x: p.x, y: p.y, vx: p.vx ?? 0, vy: p.vy ?? 0,
        life: p.life ?? 0.4, max: p.life ?? 0.4,
        kind: p.kind, str: p.str, color: p.color, spin: p.spin ?? 0,
    });
    if (w.parts.length > 140) w.parts.splice(0, w.parts.length - 140);
};

const stars = (w: World, x: number, y: number, n = 4) => {
    for (let i = 0; i < n; i++) {
        part(w, {
            x, y, kind: 'star', life: 0.6 + rnd(w) * 0.4,
            vx: (rnd(w) - 0.5) * 70, vy: -30 - rnd(w) * 50, spin: (rnd(w) - 0.5) * 8,
        });
    }
};

const floatText = (w: World, x: number, y: number, str: string, color: string) =>
    part(w, { x, y, kind: 'note', str, color, life: 1.1, vy: -26 });

const say = (m: Mook | Boss, line: string, t = 1.8) => { m.say = line; m.sayT = t; };

// ---------------------------------------------------------------------------
// Player boxes. Crouching is real cover: the box is 11px shorter, which is the
// whole defence against the seltzer spray and Yasser's megaphone rings — both
// of which are aimed at where a standing head would be.
// ---------------------------------------------------------------------------
const playerBox = (p: PlayerState): [number, number, number, number] => {
    const h = p.crouch ? CROUCH_H : PLAYER_H;
    return [p.x - 6, p.y - h, 12, h];
};
const mookBox = (m: Mook): [number, number, number, number] => {
    // A perched mook is wedged in an open bin with his legs out, so he is a
    // wider but shorter target than one standing in the aisle.
    const h = m.perch ? 16 : 24;
    const half = m.perch ? 9 : 6;
    return [m.x - half, m.y - h, half * 2, h];
};

const hurtPlayer = (w: World, dmg: number, fromX: number) => {
    const p = w.player;
    if (p.invuln > 0 || w.phase !== 'play') return;
    p.hp -= dmg;
    p.invuln = 1.0;
    p.hurtT = 0.32;
    p.vx = (p.x < fromX ? -1 : 1) * 95;
    p.vy = -95;
    p.onGround = false;
    w.shake = Math.max(w.shake, 4);
    floatText(w, p.x, p.y - 34, `-${dmg}`, PAL.bad);
    if (p.hp <= 0) {
        p.hp = 0;
        w.phase = 'outro';
        w.pendingWin = false;
        w.outroT = 2.0;
    }
};

// ---------------------------------------------------------------------------
// Weapon integration
// ---------------------------------------------------------------------------
/**
 * Fire the equipped weapon. Every field of the registry entry is honoured:
 *
 *  - `klass 'melee'`   — no projectile at all. A short, wide hitbox attached to
 *                        the player for 0.14s, so fists / baguette / crowbar
 *                        are a get-in-close game. Melee reaches *over* a
 *                        drinks trolley, which flat bullets cannot.
 *  - `klass 'thrown'`  — arcs under gravity unless it `returns` (a chancla or a
 *                        frisbee flies flat, then comes home). Arcing is a real
 *                        advantage: a lobbed bureka drops behind the trolley.
 *  - `klass 'ranged'`  — flat, fast, and spends `uses`. The Chicago Dog
 *                        Launcher's 0.16s cooldown makes it a hose.
 *  - `speed`           — projectile velocity in px/s, straight from the entry.
 *  - `cooldown`        — seconds between shots, ditto.
 *  - `uses`            — decremented per shot; at 0 the weapon is dead weight
 *                        and the rail is how you get out of trouble.
 *  - `returns`         — only one in flight at a time; catching it refunds the
 *                        use, so the chancla is infinite if you stand still and
 *                        the frisbee is infinite *and* pierces a whole row.
 *  - `piercing`        — keeps its `hits` list and passes through.
 *  - `slows`           — the slushie halves a charger's speed for 2.5s.
 */
const fire = (w: World) => {
    const p = w.player;
    const wp = w.weapons[w.weaponIdx];
    if (!wp || p.fireCd > 0) return;
    const ammo = w.ammo[w.weaponIdx];
    if (ammo === 0) {
        floatText(w, p.x, p.y - 36, 'EMPTY', PAL.warn);
        p.fireCd = 0.4;
        return;
    }
    // A weapon that comes back cannot be thrown again until it has.
    if (wp.returns && (w.inFlight[wp.id] ?? 0) > 0) return;

    p.fireCd = wp.cooldown || 0.2;
    if (ammo > 0) w.ammo[w.weaponIdx] = ammo - 1;

    const up = p.aimUp;
    const handY = p.y - (p.crouch ? 10 : 17);
    const muzzleX = p.x + p.facing * 6;

    if (wp.klass === 'melee') {
        w.shots.push({
            id: w.nextId++,
            x: up ? p.x - 9 : p.x + (p.facing > 0 ? 4 : -22),
            y: up ? p.y - PLAYER_H - 22 : handY - 8,
            vx: 0, vy: 0,
            w: up ? 18 : 18, h: up ? 26 : 16,
            dmg: wp.damage, friendly: true, kind: 'melee', glyph: wp.glyph,
            life: 0.14, gravity: 0, pierce: true, slows: !!wp.slows, returns: false,
            weaponIdx: w.weaponIdx, travel: 0, returning: false, attached: true,
            spin: 0, hits: [],
        });
        part(w, { x: muzzleX, y: handY, kind: 'flash', life: 0.08 });
        return;
    }

    const speed = wp.speed ?? 200;
    const arcs = wp.klass === 'thrown' && !wp.returns;
    // Aiming up fires near-vertically on purpose: a mook in an open overhead bin
    // is dealt with by standing underneath him, not by lobbing across the cabin.
    const vx = up ? p.facing * speed * 0.12 : p.facing * speed;
    const vy = up ? -speed * 0.95 : arcs ? -58 : 0;

    w.shots.push({
        id: w.nextId++,
        x: muzzleX, y: handY,
        vx, vy,
        w: 7, h: 7,
        dmg: wp.damage, friendly: true,
        kind: wp.klass === 'ranged' ? 'bullet' : 'thrown',
        glyph: wp.glyph,
        life: 4, gravity: arcs ? 300 : 0,
        pierce: !!wp.piercing, slows: !!wp.slows, returns: !!wp.returns,
        weaponIdx: w.weaponIdx, travel: 0, returning: false, attached: false,
        spin: (rnd(w) - 0.5) * 4,
        hits: [],
    });
    if (wp.returns) w.inFlight[wp.id] = (w.inFlight[wp.id] ?? 0) + 1;

    part(w, { x: muzzleX, y: handY, kind: 'flash', life: 0.07 });
    if (wp.klass === 'ranged') {
        part(w, {
            x: muzzleX, y: handY, kind: 'casing', life: 0.5,
            vx: -p.facing * 45, vy: -70, spin: 9,
        });
    }
};

/** Enemy / boss projectiles all funnel through here. */
const hostileShot = (
    w: World, x: number, y: number, vx: number, vy: number,
    dmg: number, kind: Shot['kind'], gly: string, gravity = 0, bw = 8, bh = 8,
) => {
    w.shots.push({
        id: w.nextId++, x, y, vx, vy, w: bw, h: bh, dmg,
        friendly: false, kind, glyph: gly, life: 5, gravity,
        pierce: false, slows: false, returns: false, weaponIdx: -1,
        travel: 0, returning: false, attached: false, spin: (rnd(w) - 0.5) * 6, hits: [],
    });
};

const dropLoot = (w: World, x: number) => {
    const r = rnd(w);
    if (r < 0.46) w.pickups.push({ x, y: FLOOR_Y - 40, vy: -30, kind: 'bureka', t: 0 });
    else if (r < 0.68) w.pickups.push({ x, y: FLOOR_Y - 40, vy: -30, kind: 'redbull', t: 0 });
};

const koMook = (w: World, m: Mook, fromX: number) => {
    m.state = 'ko';
    m.t = 0;
    m.koT = 1.7;
    m.hp = 0;
    // Comically knocked out: spinning, then sliding down the aisle on his back.
    m.vx = (m.x < fromX ? -1 : 1) * (110 + rnd(w) * 50);
    m.vy = -130;
    m.spin = 0;
    w.kos++;
    w.score += 100;
    stars(w, m.x, m.y - 24, 5);
    floatText(w, m.x, m.y - 30, '+100', PAL.legend);
    dropLoot(w, m.x);
};

const damageMook = (w: World, m: Mook, dmg: number, fromX: number) => {
    // Hitting a mook while he is on the floor or arguing with his own trolley
    // does extra — the game rewards you for being unsporting about it.
    const exposed = m.state === 'trip' || m.state === 'bonk' || m.state === 'panic';
    m.hp -= exposed ? dmg * 1.5 : dmg;
    m.hurtT = 0.16;
    part(w, { x: m.x, y: m.y - 14, kind: 'spark', life: 0.18 });
    if (m.hp <= 0) koMook(w, m, fromX);
};

// ---------------------------------------------------------------------------
// Mook state machines
// ---------------------------------------------------------------------------
/**
 * Three behaviours, all of them bad at the job:
 *
 *  charger — idle until you are within 152px, then runs at you shouting. Rolls
 *            a trip check every frame while running, so he spends a good share
 *            of the fight face-down on the carpet seeing stars (a free, 1.5x
 *            damage window). Contact costs you 8 and he stumbles back.
 *
 *  thrower — stands off and lobs a falafel on a true ballistic arc timed to
 *            land where you are. 14% of the time he throws it straight up
 *            instead and it lands on his own head, stunning him.
 *            Perched throwers sit in an open overhead bin, which is the reason
 *            aiming up exists.
 *
 *  trolley — cowers behind a drinks trolley (flat shots clank off it), pops up
 *            to spray seltzer at head height — duck it — then hides again. Walk
 *            inside 26px and he panics, shoves the trolley down the aisle at
 *            you and legs it, fully exposed, complaining about management.
 */
const stepMook = (w: World, m: Mook, dt: number) => {
    const p = w.player;
    const dx = p.x - m.x;
    const adx = Math.abs(dx);
    m.t += dt;
    m.hitCd = Math.max(0, m.hitCd - dt);
    m.hurtT = Math.max(0, m.hurtT - dt);
    m.sayT = Math.max(0, m.sayT - dt);
    if (m.slowT > 0) m.slowT -= dt;
    const slow = m.slowT > 0 ? 0.45 : 1;
    const go = (s: string) => { m.state = s; m.t = 0; };

    if (m.state === 'ko') {
        // Slides off down the aisle and out of the picture.
        m.koT -= dt;
        m.vy += GRAVITY * dt;
        m.x += m.vx * dt;
        m.y = Math.min(FLOOR_Y, m.y + m.vy * dt);
        if (m.y >= FLOOR_Y) { m.y = FLOOR_Y; m.vy = 0; m.vx *= 0.93; }
        m.spin += dt * 9;
        return;
    }

    // Perched mooks never move; everyone else obeys gravity so a knocked-back
    // mook falls back to the carpet.
    if (!m.perch) {
        m.vy += GRAVITY * dt;
        m.y = Math.min(FLOOR_Y, m.y + m.vy * dt);
        if (m.y >= FLOOR_Y) { m.y = FLOOR_Y; m.vy = 0; }
    }

    switch (m.kind) {
        case 'charger': {
            switch (m.state) {
                case 'idle':
                    m.vx = 0;
                    if (adx < NOTICE_RANGE) { go('run'); say(m, pick(w, MOOK_BARKS)); }
                    break;
                case 'run':
                    m.facing = dx > 0 ? 1 : -1;
                    m.vx = m.facing * 54 * slow;
                    // ~0.65 trips per second of running. He is not a soldier.
                    if (m.t > 0.7 && rnd(w) < 0.011) { go('trip'); say(m, pick(w, TRIP_BARKS), 1.4); }
                    break;
                case 'trip':
                    m.vx *= 0.85;
                    if (m.t === 0) stars(w, m.x, m.y - 20, 3);
                    if (m.t > 1.25) go('getup');
                    break;
                case 'getup':
                    m.vx = 0;
                    if (m.t > 0.45) go('run');
                    break;
                case 'stumble':
                    m.vx *= 0.9;
                    if (m.t > 0.5) go('run');
                    break;
            }
            break;
        }
        case 'thrower': {
            // Get underneath his open bin and he leans out for a better throw,
            // which is as far as his plan goes. Without this a player carrying
            // only melee weapons could never reach him, and the forward door
            // never unlocks.
            if (m.perch && adx < 46) {
                m.perch = false;
                m.vy = -40;
                m.hp -= 5;
                say(m, 'I AM COMING DOWN, BROTHER! ON PURPOSE!', 2.0);
                stars(w, m.x, m.y - 10, 3);
                go('rest');
                if (m.hp <= 0) { koMook(w, m, p.x); break; }
            }
            switch (m.state) {
                case 'idle':
                case 'rest':
                    m.vx = 0;
                    m.facing = dx > 0 ? 1 : -1;
                    if (adx < 215 && m.t > 1.1) go('aim');
                    break;
                case 'aim':
                    m.vx = 0;
                    if (m.t === 0) say(m, 'FALAFEL INCOMING, BROTHER!', 1.1);
                    if (m.t > 0.7) {
                        if (rnd(w) < 0.14) {
                            // Straight up. It comes straight back down.
                            go('bonk');
                            say(m, pick(w, BONK_BARKS), 1.6);
                            stars(w, m.x, m.y - 26, 4);
                            m.hp -= 6;
                            if (m.hp <= 0) koMook(w, m, m.x + 10);
                        } else {
                            // Ballistic arc solved for "lands on the player".
                            const flight = clampN(Math.abs(dx) / 115, 0.55, 1.7);
                            const vx = dx / flight;
                            const vy = -(300 * flight) / 2 - 24;
                            hostileShot(w, m.x + m.facing * 6, m.y - 20, vx, vy, 10, 'falafel', '🧆', 300);
                            go('rest');
                        }
                    }
                    break;
                case 'bonk':
                    m.vx = 0;
                    if (m.t > 1.5) go('rest');
                    break;
            }
            break;
        }
        case 'trolley': {
            const coverX = m.cover ?? m.x;
            switch (m.state) {
                case 'hidden':
                    m.vx = 0;
                    m.x += (coverX - 2 - m.x) * Math.min(1, dt * 6);
                    m.facing = dx > 0 ? 1 : -1;
                    if (m.t > 0.9 && m.sayT <= 0 && rnd(w) < 0.01) say(m, pick(w, TROLLEY_BARKS), 1.5);
                    if (m.t > 1.7 + rnd(w) * 0.7) go('pop');
                    break;
                case 'pop':
                    m.vx = 0;
                    if (m.t > 0.45 && m.t - dt <= 0.45) {
                        // Aimed at a standing head; crouch and it fizzes past.
                        hostileShot(w, m.x + m.facing * 8, m.y - 20, m.facing * 135, 0, 9, 'seltzer', '🥤', 0, 10, 6);
                    }
                    if (m.t > 0.8) go('duck');
                    break;
                case 'duck':
                    if (m.t > 0.3) go('hidden');
                    break;
                case 'panic':
                    // Runs away flailing, still complaining, fully hittable.
                    m.vx = -Math.sign(dx || 1) * 74 * slow;
                    if (m.t > 2.6) go('hidden');
                    break;
            }
            if (m.state !== 'panic' && adx < 26) {
                go('panic');
                say(m, pick(w, PANIC_BARKS), 2.0);
                hostileShot(w, m.x + Math.sign(dx || 1) * 8, FLOOR_Y - 10, Math.sign(dx || 1) * 105, 0, 12, 'trolley', '🛒', 0, 16, 18);
                w.shake = Math.max(w.shake, 2);
            }
            break;
        }
    }

    m.x += m.vx * dt;
    m.x = clampN(m.x, 8, SECTIONS[w.section].length - 8);

    // Contact damage: running into you is the charger's only real attack, and
    // he can only do it while upright.
    const upright = m.state !== 'trip' && m.state !== 'getup' && m.state !== 'ko' && m.state !== 'bonk';
    if (upright && m.hitCd <= 0 && !m.perch) {
        const [px, py, pw, ph] = playerBox(p);
        const [mx, my, mw, mh] = mookBox(m);
        if (overlap(px, py, pw, ph, mx, my, mw, mh)) {
            hurtPlayer(w, m.kind === 'charger' ? 6 : 5, m.x);
            m.hitCd = 0.9;
            m.vx = -m.facing * 70;
            if (m.kind === 'charger') { m.state = 'stumble'; m.t = 0; }
        }
    }
};

// ---------------------------------------------------------------------------
// Yasser Abbasfat — the boss pattern
// ---------------------------------------------------------------------------
/**
 * He is a buffoon, so the fight is built out of things that go wrong for him.
 * A fixed cycle per phase, each entry a state with its own timer:
 *
 *   phase 1 (hp > 66%)  rant -> throw -> summon -> charge
 *   phase 2 (33-66%)    rant -> throw -> megaphone -> charge -> throw
 *   phase 3 (< 33%)     charge -> megaphone -> throw -> rant -> charge
 *
 *   rant       stands centre stage shouting a line straight out of his
 *              dialogue file. He is fully exposed — this is your damage window,
 *              and the joke is that he cannot stop talking.
 *   throw      three falafels on ballistic arcs. In phase 3 one of them drops
 *              on his own foot and staggers him.
 *   summon     "BROTHERS! TO ME!" — two mooks walk in from the cockpit door,
 *              immediately start arguing about whose job the door was.
 *   charge     sprints at you with the falafel vest flapping; 16 damage on
 *              contact, but if he misses he runs into the bulkhead, which
 *              staggers him for 1.6s and rains falafel balls everywhere.
 *   megaphone  three expanding rings of amplified ranting at head height.
 *              Crouch under them. Shakes the screen.
 *   stagger    dazed, stars, takes 1.5x. Entered from a missed charge or a
 *              self-inflicted falafel.
 *
 * Beating him is not violent: the trolley rolls over his foot, the oxygen masks
 * drop on his head, he spins, and the cabin crew tape him to a jump seat while
 * passengers photograph him. See `stepBossDefeat`.
 */
/**
 * Most damage he will absorb during any single attack before the vest simply
 * holds. Without this the fight collapses: stand on him with the Dog Launcher
 * and he dies inside one rant, and nobody ever sees the pattern. With it, he
 * always takes at least eight windows to beat, so the whole routine plays out —
 * which is the joke. It also kills the degenerate "hug him and hose" strategy.
 */
const BOSS_WINDOW = 36;

const BOSS_CYCLES: Record<number, string[]> = {
    1: ['rant', 'throw', 'summon', 'charge'],
    2: ['rant', 'throw', 'megaphone', 'charge', 'throw'],
    3: ['charge', 'megaphone', 'throw', 'rant', 'charge'],
};

const bossNext = (w: World, b: Boss) => {
    const frac = b.hp / b.maxHp;
    const phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    // A new phase restarts its cycle from the top rather than carrying the old
    // index across, so no attack in a phase can be skipped entirely.
    if (phase !== b.phase) { b.phase = phase; b.step = -1; }
    const cycle = BOSS_CYCLES[b.phase];
    b.step = (b.step + 1) % cycle.length;
    b.state = cycle[b.step];
    b.t = 0;
    b.shots = 0;
    b.taken = 0;
    if (b.state === 'rant') say(b, pick(w, YASSER_RANTS), b.phase === 3 ? 1.4 : 2.2);
    if (b.state === 'throw') say(b, YASSER_THROW, 1.2);
    if (b.state === 'summon') say(b, YASSER_SUMMON, 2.0);
    if (b.state === 'charge') {
        // Locked in the moment he starts running. Jumping over him means he
        // keeps going all the way into the bulkhead, which is the whole trick.
        b.dir = w.player.x > b.x ? 1 : -1;
        say(b, YASSER_CHARGE, 1.6);
    }
    if (b.state === 'megaphone') say(b, YASSER_MEGA, 2.0);
};

const stepBossDefeat = (w: World, b: Boss, dt: number) => {
    b.t += dt;
    b.hurtT = 0;
    // 0.0-1.2  the trolley rolls over his foot, he hops, spinning
    // 1.2-2.4  the oxygen masks drop on his head
    // 2.4-4.0  taped to the jump seat, passengers photograph him
    if (b.t < 1.2) {
        b.x -= 20 * dt;
        if (b.sayT <= 0) say(b, YASSER_DEFEAT[0], 1.2);
        if (rnd(w) < 0.25) stars(w, b.x, b.y - 34, 1);
    } else if (b.t < 2.4) {
        if (b.say !== YASSER_DEFEAT[1]) say(b, YASSER_DEFEAT[1], 1.2);
        if (rnd(w) < 0.2) part(w, { x: b.x + (rnd(w) - 0.5) * 26, y: 40, kind: 'splat', life: 1.0, vy: 60, str: '😷' });
    } else {
        if (b.say !== YASSER_DEFEAT[2]) say(b, YASSER_DEFEAT[2], 1.6);
        if (rnd(w) < 0.35) part(w, { x: b.x + (rnd(w) - 0.5) * 60, y: FLOOR_Y - 40 - rnd(w) * 30, kind: 'flash', life: 0.12 });
    }
    b.sayT = Math.max(0, b.sayT - dt);
};

const defeatBoss = (w: World, b: Boss) => {
    if (b.state === 'defeat') return;
    b.hp = 0;
    b.state = 'defeat';
    b.t = 0;
    b.sayT = 0;
    b.vx = 0;
    w.score += 1000;
    w.shake = 6;
    w.banner = { big: 'CABIN SECURED', sub: 'HE IS TAPED TO A JUMP SEAT', t: 4.0 };
    w.phase = 'outro';
    w.pendingWin = true;
    w.outroT = 4.2;
};

const stepBoss = (w: World, b: Boss, dt: number) => {
    // Any route to zero counts: shot, wall, or his own lunch. Checked here so a
    // self-inflicted hit can never leave him alive on negative health.
    if (b.hp <= 0 && b.state !== 'defeat') { defeatBoss(w, b); return; }
    const p = w.player;
    const dx = p.x - b.x;
    b.t += dt;
    b.sayT = Math.max(0, b.sayT - dt);
    b.hurtT = Math.max(0, b.hurtT - dt);
    b.facing = dx > 0 ? 1 : -1;

    b.vy += GRAVITY * dt;
    b.y = Math.min(FLOOR_Y, b.y + b.vy * dt);
    if (b.y >= FLOOR_Y) { b.y = FLOOR_Y; b.vy = 0; }

    switch (b.state) {
        case 'intro':
            b.vx = 0;
            if (b.t > 3.0) bossNext(w, b);
            break;
        case 'rant': {
            b.vx = 0;
            // Phase 3 he rants so hard the vest sheds.
            if (b.phase === 3 && rnd(w) < 0.05 && b.vest > 0) {
                b.vest--;
                part(w, { x: b.x, y: b.y - 24, kind: 'splat', life: 0.9, vx: (rnd(w) - 0.5) * 60, vy: -40, str: '🧆' });
            }
            if (b.t > (b.phase === 3 ? 1.5 : 2.3)) bossNext(w, b);
            break;
        }
        case 'throw': {
            b.vx = 0;
            const gap = b.phase === 3 ? 0.4 : 0.55;
            if (b.t > 0.35 + b.shots * gap && b.shots < 3) {
                b.shots++;
                if (b.phase === 3 && b.shots === 2) {
                    // Drops one on his own foot.
                    say(b, 'MY FOOT! THE FALAFEL BETRAYS ME!', 1.6);
                    stars(w, b.x, b.y - 8, 4);
                    b.hp -= 8;
                    b.state = 'stagger';
                    b.t = 0;
                    break;
                }
                const flight = clampN(Math.abs(dx) / 120, 0.6, 1.6);
                hostileShot(w, b.x + b.facing * 8, b.y - 26, dx / flight, -(300 * flight) / 2 - 30, 12, 'falafel', '🧆', 300, 9, 9);
            }
            if (b.shots >= 3 && b.t > 0.35 + 3 * gap + 0.5) bossNext(w, b);
            break;
        }
        case 'summon': {
            b.vx = 0;
            if (b.t > 0.6 && b.shots === 0) {
                b.shots = 1;
                const len = SECTIONS[w.section].length;
                const a = makeMook(w, { kind: 'charger', x: len - 24 });
                const c = makeMook(w, { kind: 'thrower', x: len - 40 });
                say(a, 'WHOSE JOB WAS THE DOOR? IT WAS YOUR JOB!', 2.2);
                say(c, 'IT WAS NOT MY JOB, BROTHER!', 2.2);
                w.mooks.push(a, c);
            }
            if (b.t > 1.8) bossNext(w, b);
            break;
        }
        case 'charge': {
            const speed = b.phase === 3 ? 158 : 132;
            b.vx = b.dir * speed;
            b.facing = b.dir;
            w.shake = Math.max(w.shake, 1.6);
            const [px, py, pw, ph] = playerBox(p);
            if (overlap(px, py, pw, ph, b.x - 9, b.y - 34, 18, 34)) {
                hurtPlayer(w, 16, b.x);
                w.shake = 7;
                bossNext(w, b);
                break;
            }
            // Ran out of cabin. The bulkhead wins.
            const len = SECTIONS[w.section].length;
            if (b.x < 26 || b.x > len - 18) {
                say(b, YASSER_WALL, 1.8);
                w.shake = 8;
                stars(w, b.x, b.y - 34, 6);
                for (let i = 0; i < 4; i++) {
                    part(w, { x: b.x, y: b.y - 26, kind: 'splat', life: 0.9, vx: (rnd(w) - 0.5) * 120, vy: -90 - rnd(w) * 40, str: '🧆' });
                }
                b.state = 'stagger';
                b.t = 0;
            }
            if (b.t > 4) bossNext(w, b);
            break;
        }
        case 'megaphone': {
            b.vx = 0;
            const gap = 0.45;
            if (b.t > 0.5 + b.shots * gap && b.shots < 3) {
                b.shots++;
                w.shake = Math.max(w.shake, 5);
                hostileShot(w, b.x + b.facing * 10, b.y - 22, b.facing * 118, 0, 12, 'ring', '📢', 0, 12, 9);
            }
            if (b.shots >= 3 && b.t > 0.5 + 3 * gap + 0.6) bossNext(w, b);
            break;
        }
        case 'stagger':
            b.vx *= 0.86;
            if (b.t > 1.6) bossNext(w, b);
            break;
    }

    b.x = clampN(b.x + b.vx * dt, 22, SECTIONS[w.section].length - 14);
};

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------
const stepShots = (w: World, dt: number) => {
    const p = w.player;
    const len = SECTIONS[w.section].length;

    for (let i = w.shots.length - 1; i >= 0; i--) {
        const s = w.shots[i];
        s.life -= dt;
        let dead = s.life <= 0;
        // Where it was before this frame. Collisions test the whole span it
        // covered, not just where it ended up: a Dog Launcher round crosses 5px
        // a frame and a point-blank shot starts on the far side of the target,
        // both of which would otherwise sail straight through.
        const px0 = s.x, py0 = s.y;

        if (s.attached) {
            // Melee hitbox rides the player.
            s.x = p.aimUp ? p.x - 9 : p.x + (p.facing > 0 ? 4 : -22);
            s.y = p.aimUp ? p.y - PLAYER_H - 22 : p.y - (p.crouch ? 10 : 17) - 8;
        } else if (s.returning) {
            // Homing return leg: the chancla has always worked like this.
            const tx = p.x, ty = p.y - 16;
            const dx = tx - s.x, dy = ty - s.y;
            const d = Math.hypot(dx, dy) || 1;
            const sp = (w.weapons[s.weaponIdx]?.speed ?? 200) * 1.15;
            s.vx = (dx / d) * sp;
            s.vy = (dy / d) * sp;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            if (d < 13) {
                // Caught. Refund the use — that is what `returns` buys you.
                dead = true;
                const wp = w.weapons[s.weaponIdx];
                if (wp) {
                    w.inFlight[wp.id] = Math.max(0, (w.inFlight[wp.id] ?? 1) - 1);
                    if (w.ammo[s.weaponIdx] >= 0) w.ammo[s.weaponIdx]++;
                }
                s.hits = [];
            }
        } else {
            s.vy += s.gravity * dt;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.travel += Math.abs(s.vx) * dt + Math.abs(s.vy) * dt;
            s.spin += dt * 10;

            if (s.returns && (s.travel > 150 || s.x < 6 || s.x > len - 6 || s.y < 30)) {
                s.returning = true;
                s.hits = [];
            } else if (!s.returns) {
                if (s.x < -20 || s.x > len + 20) dead = true;
                // Arcing things splat on the carpet.
                if (s.y > FLOOR_Y - 2 && (s.gravity > 0 || s.kind === 'falafel')) {
                    part(w, { x: s.x, y: FLOOR_Y, kind: 'splat', life: 0.5, str: s.glyph });
                    dead = true;
                }
                if (s.y > FLOOR_Y + 6) dead = true;
            }
        }

        // The swept box for every test below.
        const hx = Math.min(px0, s.x);
        const hy = Math.min(py0, s.y);
        const hw = Math.abs(s.x - px0) + s.w;
        const hh = Math.abs(s.y - py0) + s.h;

        if (!dead && s.friendly) {
            // --- friendly vs mooks
            for (const m of w.mooks) {
                if (m.state === 'ko' || s.hits.includes(m.id)) continue;
                const [mx, my, mw, mh] = mookBox(m);
                if (!overlap(hx, hy, hw, hh, mx, my, mw, mh)) continue;

                // The drinks trolley is real cover. A flat shot clanks off it;
                // a lobbed weapon (anything still falling) drops in behind, and
                // melee simply reaches over the top. This is the one place the
                // arcing thrown weapons beat the Dog Launcher outright.
                const behindCover = m.kind === 'trolley' && (m.state === 'hidden' || m.state === 'duck');
                const overTheTop = s.kind === 'melee' || s.vy > 30;
                if (behindCover && !overTheTop) {
                    floatText(w, m.x, m.y - 26, 'CLANK', PAL.dim);
                    if (m.sayT <= 0) say(m, 'THE TROLLEY HOLDS, BROTHER!', 1.2);
                    if (!s.pierce) dead = true;
                    s.hits.push(m.id);
                    break;
                }

                damageMook(w, m, s.dmg, s.x);
                if (s.slows) {
                    m.slowT = 2.5;
                    floatText(w, m.x, m.y - 34, 'BRAIN FREEZE', PAL.accent);
                }
                s.hits.push(m.id);
                if (!s.pierce) { dead = true; break; }
            }

            // --- friendly vs boss
            const b = w.boss;
            if (!dead && b && !s.hits.includes(-99)) {
                if (overlap(hx, hy, hw, hh, b.x - 9, b.y - 34, 18, 34) && b.state !== 'intro') {
                    // He is only properly hittable when he stops to shout or
                    // when he has just run into a bulkhead. The rest of the time
                    // the falafel vest eats most of it — which is what turns the
                    // fight into a pattern-reading exercise instead of a hose.
                    const mult = b.state === 'stagger' ? 1.6
                        : b.state === 'rant' ? 1.4
                        : b.state === 'charge' ? 0.3
                        : 0.7;
                    const room = BOSS_WINDOW - b.taken;
                    const dealt = Math.min(s.dmg * mult, Math.max(0, room));
                    b.taken += dealt;
                    b.hp -= dealt;
                    if (dealt <= 0.01 && rnd(w) < 0.15) floatText(w, b.x, b.y - 40, 'THE VEST HOLDS!', PAL.dim);
                    b.hurtT = 0.14;
                    part(w, { x: s.x, y: s.y, kind: 'spark', life: 0.18 });
                    s.hits.push(-99);
                    if (!s.pierce) dead = true;
                    if (b.hp <= 0) defeatBoss(w, b);
                }
            }

            // --- friendly vs passengers. Never do this.
            if (!dead) {
                for (const h of w.hostages) {
                    if (!overlap(hx, hy, hw, hh, h.x - 7, FLOOR_Y - 22, 14, 22)) continue;
                    w.hostageHits++;
                    w.score -= 150;
                    h.say = pick(w, WITHERED_LINES);
                    h.sayT = 2.6;
                    floatText(w, h.x, FLOOR_Y - 30, '-150', PAL.bad);
                    w.shake = Math.max(w.shake, 2);
                    dead = true;
                    break;
                }
            }
        } else if (!dead && !s.friendly) {
            const [px, py, pw, ph] = playerBox(p);
            if (overlap(hx, hy, hw, hh, px, py, pw, ph)) {
                hurtPlayer(w, s.dmg, s.x);
                part(w, { x: s.x, y: s.y, kind: 'splat', life: 0.5, str: s.glyph });
                dead = true;
            }
        }

        if (dead) {
            if (s.returns && !s.attached) {
                const wp = w.weapons[s.weaponIdx];
                // Lost in the seats. Release the in-flight lock either way, or
                // the weapon would be bricked for the rest of the game.
                if (wp) w.inFlight[wp.id] = Math.max(0, (w.inFlight[wp.id] ?? 1) - 1);
            }
            w.shots.splice(i, 1);
        }
    }
};

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
const stepPlayer = (w: World, input: SimInput, dt: number) => {
    const p = w.player;
    const def = SECTIONS[w.section];

    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.speedT = Math.max(0, p.speedT - dt);

    p.crouch = input.down && p.onGround;
    p.aimUp = input.up;

    // Speed: base, +15% if an Energy Drink is in storage (a passive from the
    // weapon registry's utility class), +40% while a Red Bull pickup is live,
    // -20% while groping through an unlit section without the lighter.
    let speed = RUN_SPEED;
    if (w.hasEnergy) speed *= 1.15;
    if (p.speedT > 0) speed *= 1.4;
    if (def.dark && !w.hasLighter) speed *= 0.8;
    if (p.crouch) speed *= 0.45;

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0) {
        p.vx = dir * speed;
        p.facing = dir > 0 ? 1 : -1;
        p.stride = (p.stride + dt * 2.4) % 1;
    } else {
        p.vx *= p.onGround ? 0.72 : 0.94;
        p.stride = 0;
    }

    if (input.jumpPressed && p.onGround && !p.crouch) {
        p.vy = JUMP_V;
        p.onGround = false;
    }

    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.y >= FLOOR_Y) { p.y = FLOOR_Y; p.vy = 0; p.onGround = true; }
    // Level bounds: you cannot back out of the aeroplane.
    p.x = clampN(p.x, 10, def.length - 10);

    if (input.fire) fire(w);

    // Pickups
    for (let i = w.pickups.length - 1; i >= 0; i--) {
        const k = w.pickups[i];
        k.t += dt;
        k.vy += GRAVITY * 0.5 * dt;
        k.y = Math.min(FLOOR_Y - 6, k.y + k.vy * dt);
        if (k.y >= FLOOR_Y - 6) { k.y = FLOOR_Y - 6; k.vy = 0; }
        if (Math.abs(k.x - p.x) < 12 && Math.abs(k.y - (p.y - 12)) < 20) {
            if (k.kind === 'bureka') {
                p.hp = Math.min(100, p.hp + 25);
                floatText(w, p.x, p.y - 34, '+25 BUREKA', PAL.ok);
            } else {
                p.speedT = 6;
                floatText(w, p.x, p.y - 34, 'RED BULL!', PAL.warn);
            }
            w.pickups.splice(i, 1);
        } else if (k.t > 14) {
            w.pickups.splice(i, 1);
        }
    }

    // Hostages: stand in front of one for 0.45s to unbuckle them.
    for (const h of w.hostages) {
        h.sayT = Math.max(0, h.sayT - dt);
        if (h.freed) { h.cheer += dt; continue; }
        if (Math.abs(h.x - p.x) < 13) {
            h.dwell += dt;
            if (h.dwell > 0.45) {
                h.freed = true;
                w.freed++;
                w.score += 250;
                h.say = pick(w, FREED_LINES);
                h.sayT = 3.0;
                floatText(w, h.x, FLOOR_Y - 34, '+250', PAL.accent);
            }
        } else {
            h.dwell = Math.max(0, h.dwell - dt);
        }
    }
};

// ---------------------------------------------------------------------------
// The step function. Pure: no React, no canvas, no DOM, no clock.
// ---------------------------------------------------------------------------
export function stepWorld(w: World, input: SimInput, dt: number): void {
    w.time += dt;
    // Emergency lighting hum — cosmetic, but shared by the darkness overlay.
    w.flick = 0.82 + 0.18 * Math.sin(w.time * 9) * Math.sin(w.time * 3.7);
    w.shake = Math.max(0, w.shake - dt * 9);
    if (w.banner) { w.banner.t -= dt; if (w.banner.t <= 0) w.banner = null; }

    for (let i = w.parts.length - 1; i >= 0; i--) {
        const q = w.parts[i];
        q.life -= dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        if (q.kind === 'star' || q.kind === 'casing' || q.kind === 'splat') q.vy += GRAVITY * 0.5 * dt;
        if (q.life <= 0) w.parts.splice(i, 1);
    }

    if (w.phase === 'won' || w.phase === 'lost') return;

    if (w.phase === 'outro') {
        w.outroT -= dt;
        if (w.boss && w.boss.state === 'defeat') stepBossDefeat(w, w.boss, dt);
        if (w.outroT <= 0) w.phase = w.pendingWin ? 'won' : 'lost';
        return;
    }

    if (input.switchTo !== undefined && input.switchTo !== w.weaponIdx) {
        w.weaponIdx = clampN(input.switchTo, 0, w.weapons.length - 1);
    }

    stepPlayer(w, input, dt);

    for (let i = w.mooks.length - 1; i >= 0; i--) {
        const m = w.mooks[i];
        stepMook(w, m, dt);
        if (m.state === 'ko' && m.koT <= 0) w.mooks.splice(i, 1);
    }

    if (w.boss) stepBoss(w, w.boss, dt);

    stepShots(w, dt);

    // Camera. Follows the player, clamped so it never shows past the bulkheads.
    const def = SECTIONS[w.section];
    const target = clampN(w.player.x - VIEW_W / 2, 0, Math.max(0, def.length - VIEW_W));
    w.camX += (target - w.camX) * Math.min(1, dt * 8);

    // Room-clearing: the forward door stays sealed while anyone is still up.
    const standing = w.mooks.filter(m => m.state !== 'ko').length;
    if (!def.boss) {
        if (standing === 0 && !w.doorOpen) {
            w.doorOpen = true;
            w.banner = { big: 'DOOR UNLOCKED', sub: 'FORWARD, TO THE NEXT CABIN', t: 1.8 };
        }
        if (w.doorOpen && w.player.x > def.length - 18) {
            if (w.section + 1 < SECTIONS.length) loadSection(w, w.section + 1);
        }
    }
}

/** Mooks still on their feet in this section. Exposed for the test harness. */
export const standingMooks = (w: World) => w.mooks.filter(m => m.state !== 'ko').length;

// ---------------------------------------------------------------------------
// Rendering. Reads the world, never writes it.
// ---------------------------------------------------------------------------
const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    circle(ctx, x, y, s, 'rgba(180,205,230,0.5)');
    circle(ctx, x + s * 0.9, y + 1, s * 0.75, 'rgba(180,205,230,0.4)');
    circle(ctx, x - s * 0.8, y + 2, s * 0.6, 'rgba(180,205,230,0.35)');
};

const drawCabin = (ctx: CanvasRenderingContext2D, w: World) => {
    const def = SECTIONS[w.section];
    const cam = w.camX;
    const emerg = def.dark ? PAL.bad : PAL.ok;

    // Ceiling
    rect(ctx, 0, 16, VIEW_W, 20, PAL.raised);
    for (let x = -((cam * 0.9) % 30) - 30; x < VIEW_W + 30; x += 30) {
        line(ctx, x, 16, x, 36, PAL.line);
    }
    // Reading lights
    for (let x = -((cam * 0.9) % SEAT_PITCH); x < VIEW_W + SEAT_PITCH; x += SEAT_PITCH) {
        circle(ctx, x + 12, 26, 1.6, def.dark ? PAL.faint : PAL.warn);
    }

    // Overhead bins — a mook in an open bin is drawn with the cast, not here.
    rect(ctx, 0, 36, VIEW_W, 26, PAL.panel);
    band(ctx, 36, 26, VIEW_W, cam, SEAT_PITCH, PAL.panel, (c, x, y, h) => {
        outline(c, x + 2, y + 2, SEAT_PITCH - 4, h - 6, PAL.line);
        rect(c, x + SEAT_PITCH / 2 - 4, y + h - 9, 8, 2, PAL.faint);
    });
    rect(ctx, 0, 60, VIEW_W, 2, PAL.line);

    // Window wall with clouds crawling past at a slower parallax than the cabin
    rect(ctx, 0, 62, VIEW_W, 42, PAL.bg);
    if (def.boss) {
        // Cockpit: one big windscreen and a bank of instruments.
        rect(ctx, 150, 64, 190, 38, '#0a1a2a');
        for (let i = 0; i < 4; i++) {
            drawCloud(ctx, 170 + ((w.time * 11 + i * 60) % 190), 74 + (i % 2) * 14, 5);
        }
        outline(ctx, 150, 64, 190, 38, PAL.line);
        line(ctx, 245, 64, 245, 102, PAL.line);
        rect(ctx, 250, 106, 90, 20, PAL.raised);
        for (let i = 0; i < 12; i++) {
            circle(ctx, 256 + (i % 6) * 14, 112 + Math.floor(i / 6) * 9,
                1.8, i % 3 === 0 ? PAL.bad : i % 3 === 1 ? PAL.warn : PAL.ok);
        }
        text(ctx, 'AUTOPILOT: ENGAGED', 254, 130, { size: 5, color: PAL.dim });
    } else {
        band(ctx, 62, 42, VIEW_W, cam, SEAT_PITCH, PAL.bg, (c, x) => {
            rect(c, x + 12, 70, 20, 24, '#0b2438');
            if (!def.dark) {
                drawCloud(c, x + 22 + ((w.time * 7) % 16) - 8, 82, 4);
            }
            outline(c, x + 12, 70, 20, 24, PAL.line);
            rect(c, x + 12, 70, 20, 3, PAL.raised);
        });
    }

    if (def.boss) {
        // Flight deck: two pilot seats facing the windscreen, a jump seat, and
        // the crew rest bunk Yasser ends the game strapped into.
        for (const [sx2, w2] of [[196, 30], [240, 30]] as [number, number][]) {
            rect(ctx, sx2, 128, w2, 36, PAL.raised);
            rect(ctx, sx2, 122, w2, 8, PAL.violet);
            outline(ctx, sx2, 122, w2, 42, PAL.line);
        }
        rect(ctx, 24, 132, 22, 32, PAL.raised);
        outline(ctx, 24, 132, 22, 32, PAL.warn);
        text(ctx, 'JUMP', 26, 124, { size: 4, color: PAL.warn });
        // The cabin door he came through.
        rect(ctx, 96, 66, 30, 98, PAL.panel);
        outline(ctx, 96, 66, 30, 98, PAL.line);
        glyph(ctx, '🚪', 111, 116, 12);
    } else {
        // Seat rows behind the aisle. Crouching drops you below the headrests,
        // which is what "take cover behind a seat row" means here.
        band(ctx, 104, 60, VIEW_W, cam, SEAT_PITCH, PAL.raised, (c, x) => {
            rect(c, x + 6, 130, 32, 34, PAL.raised);
            rect(c, x + 6, 124, 32, 8, PAL.denimDark);
            outline(c, x + 6, 124, 32, 40, PAL.line);
            rect(c, x + 38, 140, 3, 24, PAL.panel);
        });
    }

    // Carpet + floor path lighting
    rect(ctx, 0, FLOOR_Y, VIEW_W, VIEW_H - FLOOR_Y, PAL.panel);
    line(ctx, 0, FLOOR_Y, VIEW_W, FLOOR_Y, PAL.line);
    for (let x = -((cam) % 16); x < VIEW_W + 16; x += 16) {
        rect(ctx, x, FLOOR_Y + 4, 5, 1.5, def.dark ? emerg : PAL.faint);
    }

    // Parked trolleys — cover for both sides.
    for (const tx of def.trolleys) {
        const sx = tx - cam;
        if (sx < -40 || sx > VIEW_W + 40) continue;
        if (!inLight(w, tx, FLOOR_Y - 10)) continue;
        rect(ctx, sx - 11, FLOOR_Y - 22, 22, 22, PAL.raised);
        outline(ctx, sx - 11, FLOOR_Y - 22, 22, 22, PAL.line);
        rect(ctx, sx - 9, FLOOR_Y - 19, 18, 5, PAL.faint);
        glyph(ctx, '🥤', sx - 4, FLOOR_Y - 27, 7);
        glyph(ctx, '☕', sx + 5, FLOOR_Y - 27, 7);
        circle(ctx, sx - 7, FLOOR_Y - 1, 2, PAL.black);
        circle(ctx, sx + 7, FLOOR_Y - 1, 2, PAL.black);
    }

    // Forward bulkhead door.
    if (!def.boss) {
        const sx = def.length - 6 - cam;
        rect(ctx, sx - 20, 62, 26, FLOOR_Y - 62, w.doorOpen ? '#08140f' : PAL.raised);
        outline(ctx, sx - 20, 62, 26, FLOOR_Y - 62, w.doorOpen ? PAL.ok : PAL.bad, 2);
        if (w.doorOpen) {
            text(ctx, 'GO', sx - 14, 100, { size: 7, color: PAL.ok, bold: true });
        } else {
            glyph(ctx, '🔒', sx - 7, 110, 10);
            text(ctx, 'SEALED', sx - 20, 126, { size: 5, color: PAL.bad });
        }
    }
};

const bubble = (ctx: CanvasRenderingContext2D, str: string, x: number, y: number, color: string = PAL.ink, lane = 0) => {
    const size = 5;
    // `lane` staggers bubbles vertically: three mooks shouting at once in the
    // same row would otherwise print one unreadable line across the cabin.
    y -= (lane % 3) * 9;
    const wide = Math.min(132, str.length * 2.9 + 6);
    const bx = clampN(x - wide / 2, 2, VIEW_W - wide - 2);
    rect(ctx, bx, y - 9, wide, 11, 'rgba(4,6,10,0.88)');
    outline(ctx, bx, y - 9, wide, 11, PAL.line);
    text(ctx, str.length > 44 ? `${str.slice(0, 43)}…` : str, bx + 3, y - 6, { size, color });
};

const drawMook = (ctx: CanvasRenderingContext2D, w: World, m: Mook) => {
    const sx = m.x - w.camX;
    if (sx < -30 || sx > VIEW_W + 30) return;
    if (!inLight(w, m.x, m.y - 12)) {
        // In the dark you get two eyes and a bad feeling.
        circle(ctx, sx - 2, m.y - 20, 1, 'rgba(255,180,0,0.55)');
        circle(ctx, sx + 2, m.y - 20, 1, 'rgba(255,180,0,0.55)');
        return;
    }

    const h = m.perch ? 16 : 24;
    if (m.perch) {
        // Open bin he is crouched inside.
        rect(ctx, sx - 14, 36, 28, 24, PAL.bg);
        outline(ctx, sx - 14, 36, 28, 24, PAL.warn);
    }

    if (m.state === 'ko') {
        ctx.save();
        ctx.translate(sx, m.y - 6);
        ctx.rotate(m.spin);
        figure(ctx, 0, 0, h, { kit: KIT.militant, facing: m.facing, crouch: true });
        ctx.restore();
        glyph(ctx, '⭐', sx - 8, m.y - 26, 7, m.spin);
        glyph(ctx, '💫', sx + 8, m.y - 30, 7, -m.spin);
        return;
    }

    const down = m.state === 'trip';
    if (down) {
        ctx.save();
        ctx.translate(sx, m.y - 4);
        ctx.rotate(Math.PI / 2 * m.facing * -1);
        figure(ctx, 0, 0, h, { kit: KIT.militant, facing: m.facing, hurt: m.hurtT > 0 });
        ctx.restore();
    } else {
        figure(ctx, sx, m.y, h, {
            kit: KIT.militant,
            facing: m.facing,
            stride: m.state === 'run' || m.state === 'panic' ? (w.time * 3) % 1 : 0,
            armUp: m.state === 'aim' ? 1 : m.state === 'panic' ? 0.8 : m.state === 'pop' ? 0.6 : 0,
            crouch: m.state === 'hidden' || m.state === 'duck' || m.perch,
            hurt: m.hurtT > 0,
        });
    }

    // Kit: a keffiyeh band and whatever he is about to fumble.
    if (!down) {
        rect(ctx, sx - 4, m.y - h - 6, 8, 2, PAL.accent2);
        if (m.kind === 'thrower') glyph(ctx, '🧆', sx + m.facing * 8, m.y - h + (m.state === 'aim' ? -6 : 2), 7);
        if (m.kind === 'charger') glyph(ctx, '🥖', sx + m.facing * 9, m.y - h + 4, 8);
    }
    if (m.state === 'bonk') glyph(ctx, '🧆', sx, m.y - h - 8, 8);

    // Health pip, only once he has been hit — keeps the picture clean.
    if (m.hp < m.maxHp && m.hp > 0) bar(ctx, sx - 9, m.y - h - 12, 18, 2, m.hp / m.maxHp, PAL.bad, PAL.panel);
    if (m.sayT > 0) bubble(ctx, m.say, sx, m.y - h - 15, PAL.warn, m.id);
};

const drawBoss = (ctx: CanvasRenderingContext2D, w: World, b: Boss) => {
    const sx = b.x - w.camX;
    const h = 34;
    const lean = b.state === 'charge' ? 0.25 * b.facing : b.state === 'stagger' ? -0.2 : 0;

    ctx.save();
    ctx.translate(sx, b.y);
    if (lean) ctx.rotate(lean);
    figure(ctx, 0, 0, h, {
        kit: { main: '#4b6b3d', trim: '#241a10', skin: PAL.skinDark },
        facing: b.facing,
        stride: b.state === 'charge' ? (w.time * 5) % 1 : 0,
        armUp: b.state === 'rant' || b.state === 'megaphone' ? 1 : b.state === 'throw' ? 0.7 : 0,
        hurt: b.hurtT > 0,
    });
    ctx.restore();

    // The falafel vest. It sheds as he loses his temper.
    for (let i = 0; i < b.vest; i++) {
        const col = i % 2, row = Math.floor(i / 2);
        circle(ctx, sx - 4 + col * 8, b.y - 24 + row * 6, 2.4, '#b4813f');
    }
    if (b.state === 'megaphone') glyph(ctx, '📢', sx + b.facing * 12, b.y - 28, 12);
    if (b.state === 'stagger') { glyph(ctx, '⭐', sx - 9, b.y - h - 6, 8); glyph(ctx, '💫', sx + 9, b.y - h - 9, 8); }
    if (b.state === 'defeat') {
        glyph(ctx, '📸', sx - 26, b.y - 30, 9);
        glyph(ctx, '📱', sx + 28, b.y - 26, 9);
        if (b.t > 2.4) {
            rect(ctx, sx - 14, b.y - 26, 28, 4, PAL.warn);
            rect(ctx, sx - 14, b.y - 16, 28, 4, PAL.warn);
            text(ctx, 'DUCT TAPE', sx - 13, b.y - 25, { size: 4, color: PAL.black, bold: true });
        }
    }
    if (b.sayT > 0) bubble(ctx, b.say, sx, b.y - h - 14, PAL.accent2);
};

const drawHostage = (ctx: CanvasRenderingContext2D, w: World, h: Hostage) => {
    const sx = h.x - w.camX;
    if (sx < -30 || sx > VIEW_W + 30) return;
    if (!inLight(w, h.x, FLOOR_Y - 12)) return;

    figure(ctx, sx, FLOOR_Y - 1, 22, {
        kit: KIT.hostage,
        facing: 1,
        crouch: !h.freed,
        armUp: h.freed ? 0.9 + Math.sin(h.cheer * 8) * 0.1 : 0,
    });
    if (!h.freed) {
        // Seatbelt and duct tape.
        rect(ctx, sx - 8, FLOOR_Y - 14, 16, 2, PAL.warn);
        glyph(ctx, '😰', sx, FLOOR_Y - 24, 8);
        if (h.dwell > 0) bar(ctx, sx - 9, FLOOR_Y - 34, 18, 2, h.dwell / 0.45, PAL.accent, PAL.panel);
        else text(ctx, 'HOLD', sx - 7, FLOOR_Y - 34, { size: 4, color: PAL.dim });
    } else {
        glyph(ctx, '🙌', sx, FLOOR_Y - 28, 8);
    }
    if (h.sayT > 0) bubble(ctx, h.say, sx, FLOOR_Y - 38, h.freed ? PAL.ok : PAL.bad);
};

const drawShots = (ctx: CanvasRenderingContext2D, w: World) => {
    for (const s of w.shots) {
        const sx = s.x - w.camX;
        if (sx < -20 || sx > VIEW_W + 20) continue;
        if (!inLight(w, s.x, s.y)) continue;
        if (s.kind === 'melee') {
            // A swing arc rather than a box, so it reads as a swing.
            ctx.save();
            ctx.globalAlpha = 0.55;
            rect(ctx, sx, s.y, s.w, s.h, PAL.white);
            ctx.restore();
            glyph(ctx, s.glyph, sx + s.w / 2, s.y + s.h / 2, 12);
        } else if (s.kind === 'ring') {
            ctx.save();
            ctx.globalAlpha = 0.8;
            outline(ctx, sx, s.y - 2, s.w + 4, s.h + 4, PAL.accent2, 2);
            outline(ctx, sx + 3, s.y + 1, s.w - 2, s.h - 2, PAL.warn, 1);
            ctx.restore();
        } else if (s.kind === 'trolley') {
            rect(ctx, sx - 8, s.y - 18, 16, 18, PAL.raised);
            outline(ctx, sx - 8, s.y - 18, 16, 18, PAL.line);
            glyph(ctx, '🥤', sx, s.y - 22, 7);
        } else {
            glyph(ctx, s.glyph, sx + s.w / 2, s.y + s.h / 2, s.kind === 'bullet' ? 8 : 10, s.spin);
            if (s.returning) circle(ctx, sx + s.w / 2, s.y + s.h / 2, 6, 'rgba(0,229,192,0.18)');
        }
    }
};

const drawParts = (ctx: CanvasRenderingContext2D, w: World) => {
    for (const q of w.parts) {
        const sx = q.x - w.camX;
        if (sx < -20 || sx > VIEW_W + 20) continue;
        const a = clampN(q.life / q.max, 0, 1);
        switch (q.kind) {
            case 'star': glyph(ctx, '⭐', sx, q.y, 7, q.spin * q.life, a); break;
            case 'casing': rect(ctx, sx, q.y, 2, 1.5, PAL.legend); break;
            case 'spark': glyph(ctx, '💥', sx, q.y, 9, 0, a); break;
            case 'splat': glyph(ctx, q.str ?? '🧆', sx, q.y - 4, 9, 0, a); break;
            case 'flash':
                circle(ctx, sx, q.y, 5 * a + 2, `rgba(255,220,120,${0.8 * a})`);
                break;
            case 'note':
                text(ctx, q.str ?? '', sx, q.y, { size: 6, color: q.color ?? PAL.ink, align: 'center', bold: true });
                break;
        }
    }
};

const drawPlayer = (ctx: CanvasRenderingContext2D, w: World) => {
    const p = w.player;
    const sx = p.x - w.camX;
    const wp = w.weapons[w.weaponIdx];
    const blink = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0;

    if (!blink) {
        figure(ctx, sx, p.y, PLAYER_H, {
            kit: KIT.player,
            facing: p.facing,
            stride: p.onGround ? p.stride : 0.25,
            armUp: p.aimUp ? 1 : p.fireCd > 0.03 ? 0.45 : 0,
            crouch: p.crouch,
            hurt: p.hurtT > 0,
        });
        // Whatever is in your hands, held in your hands.
        if (wp) {
            const hy = p.y - (p.crouch ? 12 : 19) - (p.aimUp ? 12 : 0);
            glyph(ctx, wp.glyph, sx + p.facing * (p.aimUp ? 4 : 10), hy, 9);
        }
    }
    if (p.speedT > 0) glyph(ctx, '⚡', sx - p.facing * 10, p.y - 26, 8, 0, 0.8);
    // The lighter is visibly out in the dark, which is also why you can see.
    if (w.hasLighter && SECTIONS[w.section].dark) {
        glyph(ctx, '🔦', sx + p.facing * 12, p.y - 22, 9, 0, 0.9);
    }
};

/** Near-black overlay with a hole punched around the player. See visionRadius. */
const drawDarkness = (ctx: CanvasRenderingContext2D, w: World) => {
    const r = visionRadius(w);
    if (r >= LIT_R) return;
    const px = w.player.x - w.camX;
    const py = w.player.y - 13;
    const g = ctx.createRadialGradient(px, py, Math.max(3, r * 0.32), px, py, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.55, `rgba(0,0,0,${0.5 * w.flick})`);
    g.addColorStop(1, `rgba(2,2,4,${0.965 * w.flick})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (w.hasLighter) {
        // A warm rim, so the lighter reads as the reason you can see.
        circle(ctx, px + w.player.facing * 12, py, 4, 'rgba(255,170,60,0.30)');
    }
};

const drawHud = (ctx: CanvasRenderingContext2D, w: World) => {
    const p = w.player;
    const wp = w.weapons[w.weaponIdx];
    const def = SECTIONS[w.section];

    rect(ctx, 0, 0, VIEW_W, 16, 'rgba(4,6,10,0.85)');
    line(ctx, 0, 16, VIEW_W, 16, PAL.line);

    text(ctx, 'HP', 4, 5, { size: 6, color: PAL.dim });
    bar(ctx, 16, 4, 62, 7, p.hp / 100, p.hp > 35 ? PAL.ok : PAL.bad, PAL.panel);

    const ammo = w.ammo[w.weaponIdx];
    glyph(ctx, wp?.glyph ?? '👊', 88, 8, 9);
    text(ctx, ammo < 0 ? '∞' : String(ammo), 96, 5,
        { size: 6, color: ammo === 0 ? PAL.bad : ammo >= 0 && ammo < 8 ? PAL.warn : PAL.ink });

    glyph(ctx, '🧍', 126, 8, 9);
    text(ctx, `${w.freed}/${def.hostages.length}`, 134, 5, { size: 6, color: PAL.accent });

    glyph(ctx, '💤', 166, 8, 9);
    text(ctx, String(w.kos), 174, 5, { size: 6, color: PAL.ink });

    text(ctx, `${w.score}`, 206, 5, { size: 6, color: PAL.legend });

    text(ctx, def.name, VIEW_W - 4, 5, { size: 6, color: PAL.accent2, align: 'right' });

    // Boss bar
    if (w.boss && w.boss.state !== 'intro') {
        text(ctx, 'YASSER ABBASFAT', VIEW_W / 2, 20, { size: 6, color: PAL.accent2, align: 'center' });
        bar(ctx, 60, 28, VIEW_W - 120, 5, w.boss.hp / w.boss.maxHp, PAL.accent2, PAL.panel);
        text(ctx, `PHASE ${w.boss.phase}`, VIEW_W / 2, 35, { size: 5, color: PAL.dim, align: 'center' });
    }

    if (!SECTIONS[w.section].boss) {
        const standing = standingMooks(w);
        if (standing > 0) {
            text(ctx, `${standing} LEFT`, VIEW_W - 4, 20, { size: 5, color: PAL.dim, align: 'right' });
        }
    }

    if (w.banner) {
        const a = clampN(w.banner.t, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.65 * a;
        banner(ctx, w.banner.big, VIEW_W, 76, PAL.legend, 22);
        text(ctx, w.banner.sub, VIEW_W / 2, 94, { size: 6, color: PAL.ink, align: 'center' });
        ctx.restore();
    }

    if (w.phase === 'outro' && !w.pendingWin) {
        banner(ctx, 'CABIN LOST', VIEW_W, 100, PAL.bad, 22);
    }
};

/** Exported so the headless harness can render frames against a mock context. */
export const drawWorld = (ctx: CanvasRenderingContext2D, w: World) => {
    clear(ctx, VIEW_W, VIEW_H, PAL.bg);
    const [ox, oy] = shakeOffset(w.shake);
    ctx.save();
    ctx.translate(ox, oy);

    drawCabin(ctx, w);
    for (const k of w.pickups) {
        const sx = k.x - w.camX;
        if (!inLight(w, k.x, k.y)) continue;
        glyph(ctx, k.kind === 'bureka' ? '🥟' : '🧃', sx, k.y + Math.sin(k.t * 5) * 2, 10);
    }
    for (const h of w.hostages) drawHostage(ctx, w, h);
    for (const m of w.mooks) drawMook(ctx, w, m);
    if (w.boss) drawBoss(ctx, w, w.boss);
    drawPlayer(ctx, w);
    drawShots(ctx, w);
    drawParts(ctx, w);

    // Foreground seat row, so you are running *down* an aisle, not past a wall.
    band(ctx, 182, 16, VIEW_W, w.camX * 1.12, SEAT_PITCH, PAL.void, (c, x) => {
        rect(c, x + 4, 182, 34, 16, PAL.void);
        rect(c, x + 4, 182, 34, 2, PAL.line);
    });

    drawDarkness(ctx, w);
    ctx.restore();

    drawHud(ctx, w);
};

// ---------------------------------------------------------------------------
// The React component
// ---------------------------------------------------------------------------
const Flight404: React.FC<{
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ onFinish, onQuit }) => {
    const { gameState } = useGame();
    const { player } = gameState;

    // The loadout comes straight out of the weapons registry: everything the
    // player is carrying that works in this game, plus bare hands so an empty
    // Dog Launcher never leaves them with nothing to press.
    const loadout = useMemo<Weapon[]>(() => {
        const arms = armsFor(player, 'flight-404');
        return arms.length ? [...arms, FISTS] : [FISTS];
    }, [player]);
    const hasLighter = useMemo(() => hasWeapon(player, 'itm-haunted-lighter'), [player]);
    const hasEnergy = useMemo(() => hasWeapon(player, 'itm-energy-drink'), [player]);

    const worldRef = useRef<World | null>(null);
    if (!worldRef.current) {
        worldRef.current = createWorld({
            weapons: loadout,
            hasLighter,
            hasEnergy,
            seed: (Math.random() * 0xffffffff) >>> 0,
        });
    }

    const { input, set, consume } = useInput(true);

    // React state is for things that change a handful of times per run.
    const [sel, setSel] = useState(0);
    const [hud, setHud] = useState({ section: 0, freed: 0, score: 0 });
    const hudRef = useRef(hud);
    const [done, setDone] = useState<{ won: boolean; note: string } | null>(null);
    const finished = useRef(false);

    const selectWeapon = useCallback((id: string) => {
        const idx = loadout.findIndex(x => x.id === id);
        if (idx < 0) return;
        setSel(idx);
        const w = worldRef.current;
        if (w) w.weaponIdx = idx;
    }, [loadout]);

    const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
        const w = worldRef.current;
        if (!w) return;
        const s = input.current;

        // dt is always 1/60 from the loop, but the simulation multiplies through
        // by it anyway so nothing silently depends on the frame rate.
        stepWorld(w, {
            left: s.left, right: s.right, up: s.up, down: s.down,
            fire: s.a,
            jumpPressed: consume('b'),
        }, dt);
        // 'a' is hold-to-fire; clear its edge flag so it cannot queue up.
        consume('a');

        drawWorld(ctx, w);

        // Cheap HUD mirror — only when a value actually changed.
        if (w.section !== hudRef.current.section || w.freed !== hudRef.current.freed || w.score !== hudRef.current.score) {
            hudRef.current = { section: w.section, freed: w.freed, score: w.score };
            setHud(hudRef.current);
        }
        if ((w.phase === 'won' || w.phase === 'lost') && !done) {
            const won = w.phase === 'won';
            const note = won
                ? `You cleared Flight 404 — ${w.freed} passengers freed, ${w.kos} brothers horizontal, Yasser duct-taped to a jump seat.`
                : `You went down somewhere over Cyprus. Yasser is still shouting about the pigeons.`;
            setDone({ won, note });
        }
    }, [input, consume, done]);

    const w = worldRef.current;
    const sectionName = SECTIONS[hud.section].name;

    const finish = () => {
        if (finished.current || !done) return;
        finished.current = true;
        onFinish(done.won, done.note);
    };

    return (
        <ArcadeShell
            title="Flight 404"
            subtitle={done ? 'Result' : `${sectionName} — ${hud.freed} saved`}
            width={VIEW_W}
            height={VIEW_H}
            running={!done}
            onFrame={onFrame}
            onInput={set}
            actions={['Fire', 'Jump']}
            vertical
            onQuit={done ? undefined : onQuit}
            quitLabel="Pull Chute"
            loadout={loadout}
            selectedWeapon={loadout[sel]?.id}
            onSelectWeapon={selectWeapon}
            hud={
                <div className="flex items-center gap-3 label">
                    <span>Sec {hud.section + 1}/{SECTIONS.length}</span>
                    <span className="text-[var(--accent)]">🧍 {hud.freed}</span>
                    <span className="text-[var(--legend)] numeric">{hud.score}</span>
                    {hasLighter
                        ? <span className="text-[var(--warn)]">🔦 lighter</span>
                        : <span className="text-[var(--ink-faint)]">no lighter</span>}
                </div>
            }
            overlay={done
                ? <MiniGameResult
                    won={done.won}
                    headline={done.won ? 'Cabin Secured' : 'Cabin Lost'}
                    detail={done.won
                        ? `${w?.freed ?? 0} passengers freed, ${w?.kos ?? 0} brothers asleep in the aisle. Yasser is taped to a jump seat still insisting the clouds are CGI. Score ${w?.score ?? 0}.`
                        : 'You slide down the aisle. A passenger films it. Yasser announces a victory over the PA and then asks how the PA works.'}
                    onClose={finish}
                    closeLabel={done.won ? 'Collect' : 'Deplane'}
                />
                : undefined}
            help="◀ ▶ run · ▼ crouch behind a seat · ▲ aim at the overhead bins · Fire · Jump. Stand in front of a strapped-in passenger to unbuckle them. Do not shoot them. The galley has no power — the Glow-in-the-Dark Lighter is the difference between seeing a charge coming and not."
        />
    );
};

export default Flight404;
