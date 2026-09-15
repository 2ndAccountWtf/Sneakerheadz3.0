/**
 * Pizza Run — "DOUBLE SIDED, NO CONTACT"
 * ======================================
 * Rent is due, so you picked up a delivery shift. One street, two rows of
 * houses, forty minutes of your life, and a stack of pizza boxes on the back of
 * whatever you're riding.
 *
 * It is Paperboy with garlic dip. You ride left to right down a 3/4-view street,
 * weave four lanes of traffic, and lob boxes at the doorsteps of the houses that
 * actually ordered. Houses sit on BOTH verges, so every box is a decision: which
 * side, how hard, and now or in half a second. Land one through an open upstairs
 * window and you get paid like a professional. Put one through a shut one and you
 * get paid like a defendant.
 *
 * Three things make it a game rather than a toy:
 *
 *   1. Throw power is charged, so the landing point is yours to choose. The same
 *      press from a different lane goes somewhere completely different.
 *   2. The window is *past* the doorstep. A trick shot is a deliberate overthrow
 *      whose arc happens to be at window height when it crosses the wall.
 *   3. Boxes are finite. Restock crates are on the road, in traffic, obviously.
 *
 * The longboard branch (`itm-longboard`) is not a stat nudge — it is a different
 * vehicle. See BOARD / BMX below: faster, sharper, and it can ollie the kerb and
 * ride the pavement, which is the closest thing this game has to a cheat code.
 *
 * Everything above the component is a pure simulation (`createRunState` +
 * `stepRun`) with no React and no canvas in it, so a script can drive tens of
 * thousands of frames headlessly. The component is a thin shell: refs in, pixels
 * out. Per-frame state NEVER touches React state.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ArcadeShell, useInput, PAL, KIT,
    clear, rect, outline, circle, line, text, glyph, shadow, bar, figure, band,
    shakeOffset, banner, art,
} from './engine';
import type { Ctx } from './engine';
import { MiniGameResult } from './MiniGameShell';
import { useGame } from '../../hooks/useGame';
import { hasWeapon } from '../../systems/weapons';

// ---------------------------------------------------------------------------
// Geometry. 352x198 logical pixels. Night shift, so everything is lit windows
// and sodium streetlight.
//
// The street is a horizontal band with four road lanes down the middle and a
// verge on each side. Cross-screen positions are called "cross" (they are just
// screen y) because the throw maths treats them as a single axis:
//
//    46 .. 92    far houses (facades rise UP from their ground line at 92)
//    92 .. 104   far pavement — mats / doorsteps at y=98
//   104 .. 152   road: four 12px lanes, centres at 111 / 123 / 135 / 147
//   152 .. 164   near pavement — mats / doorsteps at y=158
//   164 .. 198   near houses (facades drop DOWN from their ground line at 164)
//
// The two rows are mirrors of each other: a house owns a `dir` of -1 (far) or
// +1 (near) and every vertical offset on it is `base + dir * heightOnWall`.
// ---------------------------------------------------------------------------
const W = 352;
const H = 198;
const LANES = 4;
const LANE_H = 12;
const LANE_Y0 = 111;
const ROAD_TOP = 104;
const ROAD_BOT = 152;
const FAR_WALL = 92;      // far houses' ground line
const FAR_WALK = 98;      // far doormats
const NEAR_WALL = 164;    // near houses' ground line
const NEAR_WALK = 158;    // near doormats
/** The rider never moves horizontally; the street moves past them. */
const RIDER_X = 84;

/** Lane -1 is the far pavement and lane 4 is the near pavement: board only. */
const laneY = (lane: number) => LANE_Y0 + lane * LANE_H;

// ---------------------------------------------------------------------------
// Throw maths — the heart of the game, so it gets the long comment.
//
// A box is a projectile in two independent axes:
//
//   cross :  cy(t) = cy0 + vCross * t                (constant; no drag)
//   height:  z(t)  = z0  + vz * t - G * t^2 / 2      (parabola)
//
// It is on the ground when z = 0, which is the positive root of the parabola:
//
//   tLand = ( vz + sqrt(vz^2 + 2*G*z0) ) / G
//
// so the cross distance it covers before landing is vCross * tLand. Both vCross
// and vz scale with charge, which means landing distance grows a little faster
// than linearly with the charge bar — a light flick drops a box at your feet, a
// full wind-up clears the whole street.
//
// The trick shot falls straight out of the same two equations. A house's wall is
// a vertical plane at a known cross position, so the box reaches it at
//
//   tWall = (wallCross - cy0) / vCross
//
// and is at height z(tWall) when it gets there. If that height lands inside the
// window opening (WIN_Z0..WIN_Z1) while the window is open, the box goes in. So
// a window shot is an OVERTHROW: you have to aim past the doorstep so the
// parabola is still up at window height when it crosses the facade. Throwing at
// the apex of an ollie raises z0 and therefore raises that crossing height,
// which is why board players can window-shoot from lanes a bike rider can't.
// ---------------------------------------------------------------------------
const G = 480;            // px/s^2
const HAND_Z = 6;         // release height above the road
const CROSS_MIN = 30;     // cross velocity at zero charge (a limp underarm flick)
const CROSS_MAX = 150;    // ...and at full charge
const VZ_MIN = 64;
const VZ_MAX = 132;
const CHARGE_TIME = 0.5;  // seconds of held button to reach full power
const CHARGE_MAX = 1.15;  // auto-release, so a stuck thumb can't hold forever
/** Forward drift: a box thrown off a moving bike keeps drifting down-street. */
const BOX_LEAD = 26;
/** The window opening, as a height band on the wall. */
const WIN_Z0 = 15;
const WIN_Z1 = 31;
const WIN_HALF = 7;       // half-width of the opening, in px of street
/** Half-width of a doormat. Widened slightly by focus — steadier hands. */
const MAT_HALF = 8;

// ---------------------------------------------------------------------------
// Shift tuning. Numbers below were settled by running the headless sim, not by
// vibes; see the verification notes in the run script.
// ---------------------------------------------------------------------------
const ROUTE = 4200;       // world px of street. Reaching the end ends the shift.
const SHIFT_TIME = 78;    // ...and so does the clock, whichever comes first.
const RENT = 900;         // score needed to make rent. Everything else is tips.
const START_AMMO = 12;
const CRATE_AMMO = 6;
const START_LIVES = 4;
/** Seconds of grace when the last box leaves your hands. Find a crate. */
const DRY_GRACE = 11;

/**
 * Speed ramp. Deliberately keyed to DISTANCE down the street rather than to the
 * clock: ramping on time would mean the longboard finishes the route before it
 * ever reached its own ceiling, so the faster rig would post the lower top speed.
 * Ramping on distance means both rigs spend the back half of the street flat out.
 */
const SPEED_START = 62;
const SPEED_RAMP = 105;   // px/s of cruise added across the whole route

const SCORE_DELIVER = 100;
const SCORE_WINDOW = 250;
const PEN_WRONG = 60;     // box on a non-customer's step
const PEN_GLASS = 120;    // box through a shut window
const PEN_MISSED = 40;    // customer scrolled past undelivered — one star
const PEN_CRASH = 25;

// ---------------------------------------------------------------------------
// The two rigs. This is the longboard branch, written as whole numbers you can
// feel through the D-pad rather than a hidden multiplier.
// ---------------------------------------------------------------------------
interface Rig {
    id: 'board' | 'bmx';
    label: string;
    glyph: string;
    /** Cruise ceiling, px/s. The ramp pushes you up to it and then stops. */
    top: number;
    /** Held-right sprint multiplier on top of cruise. */
    sprint: number;
    /** Lanes crossed per second at full lock. */
    steer: number;
    /** Airtime and apex height of a hop. */
    hopDur: number;
    hopZ: number;
    /** A real ollie clears knee-high street furniture and mounts kerbs. */
    canOllie: boolean;
    /** Fraction of speed kept through a crash. */
    keep: number;
    note: string;
}

const BOARD: Rig = {
    id: 'board', label: 'Venice Longboard', glyph: '🛹',
    top: 152, sprint: 1.12, steer: 8.2, hopDur: 0.5, hopZ: 11,
    canOllie: true, keep: 0.55,
    note: 'Board under your feet. You can ollie the kerb and ride the pavement.',
};

const BMX: Rig = {
    id: 'bmx', label: 'The Shop BMX', glyph: '🚲',
    top: 118, sprint: 1.12, steer: 5.4, hopDur: 0.34, hopZ: 5,
    canOllie: false, keep: 0.42,
    note: 'A shop bike with one working brake. Bunny hops bins. Not kerbs.',
};

// ---------------------------------------------------------------------------
// Customers. Each archetype is a voice: what they say when a box lands on the
// step, what they say when one comes through the window, and the review they
// leave when you ride past them.
//
// `hold` grabs you for a moment — the grandma physically stops the bike, which
// is worth points and costs you time, and is the only "obstacle" that likes you.
// ---------------------------------------------------------------------------
interface Voice {
    id: string;
    tag: string;
    glyph: string;
    step: string[];
    win: string[];
    review: string[];
    /** Bonus points on a successful delivery, on top of the base score. */
    tip?: number;
    /** Seconds the customer physically detains you. */
    hold?: number;
}

const CUSTOMERS: Voice[] = [
    {
        id: 'hype', tag: 'HYPEBEAST', glyph: '🧢',
        step: ['Is the box a collab?', 'Bro. The BOX is the drop.', 'Does it come in a size 10?'],
        win: ['CAUGHT IT MID-AIR. That is going on the story.', 'Frisbee delivery. You are HIM.'],
        review: ['One star. Delivery guy had no drip.'],
        tip: 20,
    },
    {
        id: 'principle', tag: 'THE PRINCIPLE', glyph: '📣',
        step: [
            'I refuse to participate in the gig economy. …I am keeping it, obviously.',
            'This is exploitation. Is there garlic dip.',
            'I did not order this. I ordered it under protest.',
        ],
        win: ['You threw unpaid labour through my window. The pizza stays. The box is evidence.'],
        review: ['Zero stars. Systemic.'],
    },
    {
        id: 'ruth', tag: 'GRANDMA RUTH', glyph: '🧶',
        step: [
            'Sit! I have photographs of my husband in his Jordans.',
            'You are too thin. Come in. Come IN.',
            'Wait — take a bureka for the road. WAIT.',
        ],
        win: ['Through the window! Marvin did that in 1978!'],
        review: ['She waited by the door until eleven. One star, handwritten.'],
        tip: 50, hold: 0.85,
    },
    {
        id: 'threeam', tag: '3 AM GUY', glyph: '🥛',
        step: ['I ordered this at 3am. What day is it.', 'I do not remember this. I am going to eat all of it.'],
        win: ['It landed on the bed. Thank you. Genuinely.'],
        review: ['He ordered again nine minutes later. Still one star.'],
        tip: 25,
    },
    {
        id: 'reseller', tag: 'RESELLER', glyph: '📈',
        step: ['I am listing this as deadstock.', 'Any chance of the receipt? For provenance.'],
        win: ['Window delivery. Rare. This slice is now three forty.'],
        review: ['One star, but he screenshots it for the resale thread.'],
        tip: 15,
    },
    {
        id: 'clerk', tag: 'NIGHT CLERK', glyph: '🏪',
        step: ['Finally. Real food. The nacho machine lies to me.', 'Do not tell my manager. My manager IS the nacho machine.'],
        win: ['Straight through the shutter. That is an AM/PM record.'],
        review: ['One star and a long story about a raccoon.'],
        tip: 30,
    },
];

/** Houses that did not order. The green marker is the only thing keeping you honest. */
const CIVILIANS: Voice[] = [
    { id: 'dentist', tag: 'A DENTIST', glyph: '🦷', step: ['THIS IS A DENTAL SURGERY.'], win: ['You have pizza in the waiting room.'], review: [] },
    { id: 'vegan', tag: 'VEGANS', glyph: '🥬', step: ['We are VEGAN and we are LOUD about it.'], win: ['It landed in the kombucha.'], review: [] },
    { id: 'nobody', tag: 'NOBODY', glyph: '🚫', step: ['WE DID NOT ORDER ANYTHING.'], win: ['Somebody is calling somebody.'], review: [] },
    { id: 'son', tag: 'A FATHER', glyph: '🧔', step: ['My son ordered that in 2019. He lives in Berlin now.'], win: ['You just woke the whole street up.'], review: [] },
    { id: 'manager', tag: 'YOUR MANAGER', glyph: '📋', step: ['Wrong house. Again. I know your manager. I AM your manager.'], win: ['That is coming out of your shift.'], review: [] },
];

const GLASS_LINES = [
    'THAT WAS DOUBLE GLAZING.',
    'I am filming this.',
    'That is a deposit issue now.',
    'The cat is on the roof because of you.',
];

const SPLAT_LINES = ['box in the road', 'a car got that one', 'in the gutter', 'that was the last hot one'];
const HEDGE_LINES = ['in the hedge', 'in the flowerbed', 'behind the wheelie bin', 'on the roof of a Corolla'];

// ---------------------------------------------------------------------------
// Street furniture. `clear` is what it takes to get over the thing:
//   'none'  — weave it or wear it. Cars, doors, skaters.
//   'hop'   — low enough that even a BMX bunny hop clears it.
//   'ollie' — a real ollie clears it. The BMX cannot.
// `where` decides which lanes it can spawn in: the road, the kerb lanes, or the
// pavement (pavement hazards only ever matter to a board rider).
// ---------------------------------------------------------------------------
type ClearBy = 'none' | 'hop' | 'ollie';
type Where = 'road' | 'kerb' | 'walk';

interface ObsDef {
    kind: string;
    glyph: string;
    label: string;
    /** Half-length along the street in world px, and half-width in lanes. */
    len: number;
    wide: number;
    clear: ClearBy;
    where: Where;
    weight: number;
    /** World px/s relative to the ground. Negative = coming at you. */
    vx?: number;
    /** Lanes per second of wandering. */
    drift?: number;
    /** Cycles open/shut or on/off — car doors and sprinklers. */
    cycle?: number;
}

const OBS: ObsDef[] = [
    { kind: 'car', glyph: '🚗', label: 'a slow Camry', len: 17, wide: 0.44, clear: 'none', where: 'road', weight: 16, vx: 34 },
    { kind: 'taxi', glyph: '🚕', label: 'an oncoming taxi', len: 16, wide: 0.44, clear: 'none', where: 'road', weight: 11, vx: -120 },
    { kind: 'door', glyph: '🚪', label: 'a car door', len: 11, wide: 0.4, clear: 'none', where: 'kerb', weight: 10, cycle: 2.4 },
    { kind: 'bin', glyph: '🗑️', label: 'a wheelie bin', len: 8, wide: 0.36, clear: 'hop', where: 'kerb', weight: 13 },
    { kind: 'skater', glyph: '🛹', label: 'a slower skater', len: 8, wide: 0.36, clear: 'none', where: 'road', weight: 9, vx: 48, drift: 0.34 },
    { kind: 'dog', glyph: '🐕', label: 'a loose dog', len: 7, wide: 0.34, clear: 'hop', where: 'road', weight: 10, drift: 0.85 },
    { kind: 'works', glyph: '🚧', label: 'roadworks', len: 13, wide: 0.42, clear: 'ollie', where: 'road', weight: 12 },
    { kind: 'trolley', glyph: '🛒', label: 'a runaway AM/PM trolley', len: 9, wide: 0.38, clear: 'ollie', where: 'road', weight: 8, drift: 1.0 },
    { kind: 'hydrant', glyph: '🚰', label: 'a hydrant', len: 6, wide: 0.3, clear: 'hop', where: 'kerb', weight: 6 },
    { kind: 'sprink', glyph: '💦', label: 'a sprinkler', len: 9, wide: 0.5, clear: 'ollie', where: 'walk', weight: 9, cycle: 1.8 },
    { kind: 'hedge', glyph: '🪴', label: 'somebody’s planter', len: 8, wide: 0.5, clear: 'ollie', where: 'walk', weight: 7 },
];
const OBS_TOTAL = OBS.reduce((n, o) => n + o.weight, 0);

/**
 * This game's obstacle kinds, in the shared street vocabulary.
 *
 * Downhill Racer and Pizza Run name the same objects differently, so each maps
 * its own kinds onto the asset ids in `docs/ASSETS-STREET.md`. That is what
 * lets one delivered `bin-wheelie.png` serve both games.
 */
const ART_ID: Record<string, string> = {
    car: 'car-sedan', taxi: 'car-taxi', door: 'car-door-open', bin: 'bin-wheelie',
    skater: 'skateboarder', dog: 'dog-stray', works: 'roadworks',
    trolley: 'trolley-shopping', hydrant: 'hydrant', sprink: 'sprinkler',
    hedge: 'planter',
};

/** Drawn height in game pixels, from `docs/ASSETS-STREET.md`. */
const ART_H: Record<string, number> = {
    bin: 12, dog: 9, works: 14, trolley: 16, hydrant: 8, sprink: 9, hedge: 9,
};

// ---------------------------------------------------------------------------
// State. One flat mutable object, mutated 60 times a second. Nothing in here is
// ever allowed near React state.
// ---------------------------------------------------------------------------
interface House {
    id: number;
    side: 'far' | 'near';
    /** -1 for the far row (wall rises up-screen), +1 for the near row. */
    dir: -1 | 1;
    /** Ground line of the facade, in screen y. */
    base: number;
    /** World-space centre of the facade. */
    x: number;
    w: number;
    hgt: number;
    /** Offsets from the facade centre, in px. */
    doorOff: number;
    winOff: number;
    cust: boolean;
    voice: Voice;
    openWin: boolean;
    hue: number;
    /** Delivered / already scored, so nothing double-counts. */
    done: boolean;
    missed: boolean;
    /** Customer leaning out of the window after a trick shot. */
    leanT: number;
    /** You put a box through it. It stays put through. */
    smashed: boolean;
}

interface Obs {
    id: number;
    def: ObsDef;
    x: number;
    lane: number;
    dir: number;
    phase: number;
    /** Resolved once — a 34px-long Camry must not hit you four frames running. */
    done: boolean;
    hit: boolean;
    /** 0..1 for cycling things: how open the door is, how wet the sprinkler is. */
    open: number;
}

interface Crate { id: number; x: number; lane: number; taken: boolean; bob: number; }

interface Box {
    id: number;
    /** Screen x (the street scrolls, so this only drifts by BOX_LEAD). */
    sx: number;
    /** Cross position (screen y of its shadow) and height above the ground. */
    cy: number;
    z: number;
    vCross: number;
    vz: number;
    side: 1 | -1;
    spin: number;
    /** Cross position of the wall it is flying at, for the crossing test. */
    wall: number;
}

interface Pop { x: number; y: number; vy: number; life: number; max: number; txt: string; color: string; size: number; }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; ch: string; }

export type RunOutcome = 'rent' | 'short' | 'wrecked' | 'dry';

export interface RunState {
    rig: Rig;
    hasBoard: boolean;
    /** Energy-derived fitness 0.9..1.0 — tired legs cruise slower, steer later. */
    fitness: number;
    /** Focus-derived steadiness 0..1 — widens the doormat you can actually hit. */
    steadiness: number;
    matHalf: number;
    seed: number;

    t: number;
    /** Distance down the street, in world px. The only thing that scrolls. */
    x: number;
    speed: number;
    topSpeed: number;
    cruise: number;
    laneF: number;
    /** -1 riding the far pavement, 0 on the road, 1 riding the near pavement. */
    onWalk: -1 | 0 | 1;

    air: number;
    airDur: number;
    airZ: number;
    airBig: boolean;
    invT: number;
    wipeT: number;
    wipe: number;
    /** Grandma has your handlebars. */
    holdT: number;

    lives: number;
    ammo: number;
    score: number;
    streak: number;
    mult: number;
    bestStreak: number;
    dryT: number;

    charge: number;
    charging: boolean;
    prevHold: boolean;
    /** Set when a wind-up auto-fires, so one hold cannot machine-gun the rack. */
    throwLock: boolean;
    armT: number;
    facing: 1 | -1;

    houses: House[];
    nextHouseX: number;
    sideFlip: 1 | -1;
    houseId: number;
    obs: Obs[];
    nextObsX: number;
    obsId: number;
    crates: Crate[];
    nextCrateX: number;
    crateId: number;
    boxes: Box[];
    boxId: number;

    pops: Pop[];
    sparks: Spark[];
    shake: number;
    flash: string;
    flashT: number;
    bannerTxt: string;
    bannerT: number;
    introT: number;

    outcome: RunOutcome | null;
    endT: number;

    // tallies, for the end card
    delivered: number;
    tricks: number;
    wrong: number;
    broken: number;
    missedCount: number;
    crashes: number;
    splats: number;
    thrown: number;
    crated: number;
    kerbs: number;
    reviews: string[];
}

export interface RunInput {
    up: boolean;
    down: boolean;
    /** Held: coast/brake. Useful for lining a throw up. */
    left: boolean;
    /** Held: sprint. */
    right: boolean;
    /** A held. The sim detects the release edge itself so it stays testable. */
    hold: boolean;
    /** B, edge-triggered: hop / ollie. */
    hop: boolean;
}

export const NO_INPUT: RunInput = { up: false, down: false, left: false, right: false, hold: false, hop: false };

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Deterministic LCG carried on the state, so a scripted run replays exactly. */
const rnd = (s: RunState) => {
    s.seed = (s.seed * 1664525 + 1013904223) >>> 0;
    return s.seed / 4294967296;
};
const pick = <T,>(s: RunState, arr: readonly T[]): T => arr[Math.floor(rnd(s) * arr.length) % arr.length];

/** Cross/height velocities for a given charge. Shared by the sim and the aim preview. */
export const throwVel = (power: number) => ({
    vCross: CROSS_MIN + (CROSS_MAX - CROSS_MIN) * power,
    vz: VZ_MIN + (VZ_MAX - VZ_MIN) * power,
});

/** Positive root of z0 + vz*t - G*t^2/2 = 0. See the throw maths note above. */
export const flightTime = (vz: number, z0: number) => (vz + Math.sqrt(vz * vz + 2 * G * z0)) / G;

/**
 * Where a box thrown right now would come down, and how high it would be as it
 * crossed a wall at `wall`. The renderer uses this for the aim reticle; the
 * verification script uses it to solve for the charge that hits a given target.
 *
 * `sx` / `sxWall` need the `scroll` speed, and the reason is the whole reason
 * aiming is a skill. On screen the box only creeps forward at BOX_LEAD, but the
 * street is sliding backwards underneath it at `scroll`, so in STREET terms the
 * box travels (BOX_LEAD + scroll) * t before it lands. The marker has to be
 * drawn where it will hit the street as the street is drawn right now — which is
 * a long way ahead of the rider — or the player would be aiming at a lie.
 */
export function predictThrow(cy0: number, z0: number, side: 1 | -1, power: number, wall?: number, scroll = 0) {
    const { vCross, vz } = throwVel(power);
    const tLand = flightTime(vz, z0);
    const cross = cy0 + side * vCross * tLand;
    const lead = BOX_LEAD + scroll;
    let wallZ: number | null = null;
    let sxWall: number | null = null;
    if (wall !== undefined) {
        const tWall = (wall - cy0) / (side * vCross);
        if (tWall > 0 && tWall < tLand) {
            wallZ = z0 + vz * tWall - (G * tWall * tWall) / 2;
            sxWall = RIDER_X + 6 + lead * tWall;
        }
    }
    return {
        vCross, vz, tLand, cross,
        dist: vCross * tLand,
        sx: RIDER_X + 6 + lead * tLand,
        sxWall, wallZ,
    };
}

/**
 * Geometry and tuning, re-exported in one object so the headless verification
 * script can aim throws with the same numbers the game uses instead of its own
 * copy of them.
 */
export const TUNING = {
    W, H, LANES, ROUTE, RENT, SHIFT_TIME,
    START_AMMO, CRATE_AMMO, START_LIVES, DRY_GRACE,
    FAR_WALL, FAR_WALK, NEAR_WALL, NEAR_WALK, ROAD_TOP, ROAD_BOT,
    RIDER_X, BOX_LEAD, CHARGE_TIME, CHARGE_MAX, G, HAND_Z,
    WIN_Z0, WIN_Z1, WIN_HALF, MAT_HALF,
    laneY,
} as const;

// ---------------------------------------------------------------------------
// Spawners
// ---------------------------------------------------------------------------
/**
 * Houses. They alternate sides with a coin-flip cheat so you are usually looking
 * at one verge at a time, but not reliably — a pair of opposite doorsteps 30px
 * apart is the moment the game asks whether you can count.
 *
 * Spacing shrinks slightly as the shift goes on, which together with the speed
 * ramp is the entire difficulty curve.
 */
function spawnHouses(s: RunState) {
    const AHEAD = W + 160;
    while (s.nextHouseX < s.x + AHEAD) {
        const side: 'far' | 'near' = s.sideFlip < 0 ? 'far' : 'near';
        const dir: -1 | 1 = side === 'far' ? -1 : 1;
        // ~56% of houses ordered. Below that the run stops being winnable; above
        // it the green markers stop meaning anything.
        const cust = rnd(s) < 0.56;
        const voice = cust ? pick(s, CUSTOMERS) : pick(s, CIVILIANS);
        const w = 46 + Math.floor(rnd(s) * 20);
        s.houses.push({
            id: s.houseId++, side, dir,
            base: side === 'far' ? FAR_WALL : NEAR_WALL,
            x: s.nextHouseX, w,
            // Near facades are clipped by the bottom of the screen, so they are
            // always the same height; far ones vary to break up the skyline.
            hgt: side === 'far' ? 36 + Math.floor(rnd(s) * 12) : 34,
            doorOff: Math.round((rnd(s) - 0.5) * (w * 0.36)),
            winOff: Math.round((rnd(s) - 0.5) * (w * 0.5)),
            cust, voice,
            // An open window is only a trick shot if the customer left it open.
            openWin: rnd(s) < 0.45,
            hue: Math.floor(rnd(s) * 4),
            done: false, missed: false, leanT: 0, smashed: false,
        });
        // Mostly alternate; sometimes double up on the same side.
        if (rnd(s) < 0.76) s.sideFlip = (s.sideFlip * -1) as 1 | -1;
        const squeeze = Math.min(38, s.t * 0.55);
        s.nextHouseX += 96 - squeeze * 0.5 + rnd(s) * 74;
    }
}

/**
 * Traffic. One obstacle per cluster, plus a second one at least two lanes away
 * about a third of the time, so the street tightens without ever sealing: there
 * is always a line through.
 */
function spawnObstacle(s: RunState, def: ObsDef, x: number, lane: number) {
    s.obs.push({
        id: s.obsId++, def, x, lane,
        dir: rnd(s) < 0.5 ? -1 : 1,
        phase: rnd(s) * 6.283, done: false, hit: false, open: 0,
    });
}

function laneFor(s: RunState, def: ObsDef): number {
    if (def.where === 'walk') return rnd(s) < 0.5 ? -1 : LANES;
    if (def.where === 'kerb') return rnd(s) < 0.5 ? 0 : LANES - 1;
    return Math.floor(rnd(s) * LANES);
}

function rollDef(s: RunState): ObsDef {
    let roll = rnd(s) * OBS_TOTAL;
    for (const o of OBS) { roll -= o.weight; if (roll <= 0) return o; }
    return OBS[0];
}

function spawnTraffic(s: RunState) {
    const AHEAD = W + 200;
    while (s.nextObsX < s.x + AHEAD) {
        const def = rollDef(s);
        const lane = laneFor(s, def);
        spawnObstacle(s, def, s.nextObsX, lane);

        if (def.where === 'road' && rnd(s) < 0.26) {
            const other = rollDef(s);
            if (other.where === 'road') {
                // Two lanes clear of the first, so the pair can never block more
                // than half the road.
                const far = lane <= 1 ? lane + 2 + Math.floor(rnd(s) * (LANES - lane - 2))
                                      : lane - 2 - Math.floor(rnd(s) * (lane - 1));
                spawnObstacle(s, other, s.nextObsX + (rnd(s) - 0.5) * 24, clamp(far, 0, LANES - 1));
            }
        }

        // Spacing was set headlessly: a competent dodger that never throws has
        // to survive the whole street, because the player is also busy aiming.
        const squeeze = Math.min(30, s.t * 0.5);
        s.nextObsX += 132 - squeeze + rnd(s) * 90;
    }
}

/** Restock crates, sitting in traffic because of course they are. */
function spawnCrates(s: RunState) {
    while (s.nextCrateX < s.x + W + 200) {
        s.crates.push({
            id: s.crateId++, x: s.nextCrateX,
            lane: Math.floor(rnd(s) * LANES), taken: false, bob: rnd(s) * 6.283,
        });
        s.nextCrateX += 430 + rnd(s) * 220;
    }
}

export function createRunState(opts: {
    hasBoard: boolean;
    energy?: number;
    focus?: number;
    seed?: number;
}): RunState {
    const rig = opts.hasBoard ? BOARD : BMX;
    // Energy is a tax, not a wall: dead legs cost ~10% of the ceiling, enough to
    // feel and not enough to make the shift pointless.
    const fitness = 0.9 + 0.1 * clamp((opts.energy ?? 100) / 100, 0, 1);
    const steadiness = clamp((opts.focus ?? 60) / 100, 0, 1);

    const s: RunState = {
        rig, hasBoard: opts.hasBoard, fitness, steadiness,
        matHalf: MAT_HALF + steadiness * 3,
        seed: (opts.seed ?? 0x51ce) >>> 0,

        t: 0, x: 0, speed: SPEED_START, topSpeed: SPEED_START, cruise: SPEED_START,
        laneF: 1.5, onWalk: 0,
        air: 0, airDur: rig.hopDur, airZ: 0, airBig: false,
        invT: 0, wipeT: 0, wipe: 0, holdT: 0,

        lives: START_LIVES, ammo: START_AMMO, score: 0, streak: 0, mult: 1,
        bestStreak: 0, dryT: 0,

        charge: 0, charging: false, prevHold: false, throwLock: false, armT: 0, facing: -1,

        houses: [], nextHouseX: 210, sideFlip: -1, houseId: 0,
        obs: [], nextObsX: 300, obsId: 0,
        crates: [], nextCrateX: 520, crateId: 0,
        boxes: [], boxId: 0,

        pops: [], sparks: [], shake: 0, flash: '', flashT: 0,
        bannerTxt: '', bannerT: 0, introT: 2.8,

        outcome: null, endT: 0,

        delivered: 0, tricks: 0, wrong: 0, broken: 0, missedCount: 0,
        crashes: 0, splats: 0, thrown: 0, crated: 0, kerbs: 0, reviews: [],
    };
    spawnHouses(s);
    spawnTraffic(s);
    spawnCrates(s);
    return s;
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
/** World x -> screen x. The rider sits at RIDER_X and the street slides past. */
const sxOf = (s: RunState, wx: number) => RIDER_X + (wx - s.x);

function addPop(s: RunState, x: number, y: number, txt: string, color: string, size = 6) {
    if (s.pops.length > 10) s.pops.shift();
    s.pops.push({ x: clamp(x, 40, W - 40), y, vy: -11, life: 2.1, max: 2.1, txt, color, size });
}

function addSpark(s: RunState, x: number, y: number, ch: string) {
    if (s.sparks.length > 24) return;
    s.sparks.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 50, life: 0.5 + Math.random() * 0.35, ch });
}

function say(s: RunState, h: House, txt: string, color: string) {
    // Speech floats off the doorstep for the far row and off the porch for the
    // near row, so it never covers the lane the player is actually in.
    const y = h.side === 'far' ? FAR_WALL - 6 : NEAR_WALL + 12;
    addPop(s, sxOf(s, h.x + h.doorOff), y, txt, color);
}

function breakStreak(s: RunState) {
    s.streak = 0;
    s.mult = 1;
}

/** Multiplier is one step per two consecutive successes, capped at x5. */
function bumpStreak(s: RunState) {
    s.streak++;
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    const next = Math.min(5, 1 + Math.floor((s.streak - 1) / 2));
    if (next > s.mult) {
        s.mult = next;
        s.bannerTxt = `COMBO x${next}`;
        s.bannerT = 0.8;
    }
}

function award(s: RunState, pts: number) {
    s.score = Math.max(0, s.score + pts);
}

function deliver(s: RunState, h: House, viaWindow: boolean) {
    h.done = true;
    bumpStreak(s);
    const base = viaWindow ? SCORE_WINDOW : SCORE_DELIVER;
    const tip = h.voice.tip ?? 0;
    award(s, (base + tip) * s.mult);
    s.delivered++;
    if (viaWindow) {
        s.tricks++;
        h.leanT = 2.2;                       // the customer leans out of the window
        s.bannerTxt = 'TRICK SHOT!';
        s.bannerT = 1.1;
        say(s, h, pick(s, h.voice.win), PAL.legend);
        addSpark(s, sxOf(s, h.x + h.winOff), h.base + h.dir * 22, '✨');
    } else {
        say(s, h, pick(s, h.voice.step), PAL.ok);
    }
    // Grandma Ruth physically takes hold of the handlebars. Worth it.
    if (h.voice.hold) {
        s.holdT = h.voice.hold;
        s.flash = 'she wants to talk';
        s.flashT = 1.2;
    }
}

function wrongHouse(s: RunState, h: House, viaWindow: boolean) {
    h.done = true;
    breakStreak(s);
    s.wrong++;
    // Through a stranger's window is worse than on a stranger's step.
    award(s, -PEN_WRONG - (viaWindow ? 30 : 0));
    say(s, h, pick(s, viaWindow ? h.voice.win : h.voice.step), PAL.bad);
    s.flash = 'wrong house';
    s.flashT = 0.9;
}

function smashWindow(s: RunState, h: House) {
    h.smashed = true;
    breakStreak(s);
    s.broken++;
    award(s, -PEN_GLASS);
    s.shake = Math.max(s.shake, 5);
    addSpark(s, sxOf(s, h.x + h.winOff), h.base + h.dir * 22, '💥');
    say(s, h, pick(s, GLASS_LINES), PAL.bad);
    s.bannerTxt = 'GLASS';
    s.bannerT = 0.7;
}

/** A box that reached a facade: window, wrong window, or a thud off the brick. */
function resolveWall(s: RunState, b: Box) {
    const side: 'far' | 'near' = b.side < 0 ? 'far' : 'near';
    const h = s.houses.find(hh => hh.side === side && Math.abs(b.sx - sxOf(s, hh.x)) <= hh.w / 2);
    if (!h) {
        // Flew between two houses. Somebody's back garden has a pizza in it.
        addPop(s, b.sx, b.cy, 'into the alley', PAL.faint);
        breakStreak(s);
        return;
    }
    const inWindowX = Math.abs(b.sx - sxOf(s, h.x + h.winOff)) <= WIN_HALF;
    const atWindowZ = b.z >= WIN_Z0 && b.z <= WIN_Z1;

    if (inWindowX && atWindowZ) {
        if (!h.openWin) { smashWindow(s, h); return; }
        if (h.done) { addPop(s, b.sx, b.cy, 'they already have one', PAL.faint); breakStreak(s); return; }
        if (h.cust) deliver(s, h, true);
        else wrongHouse(s, h, true);
        return;
    }
    // Brick. The box slides down the wall in a way the customer will describe.
    addSpark(s, b.sx, b.cy, '📦');
    addPop(s, b.sx, b.cy, 'off the brickwork', PAL.faint);
    breakStreak(s);
}

/** A box that hit the deck: doorstep, garden, or road. */
function resolveGround(s: RunState, b: Box) {
    const onFarWalk = b.cy >= FAR_WALL && b.cy <= ROAD_TOP + 1;
    const onNearWalk = b.cy >= ROAD_BOT - 1 && b.cy <= NEAR_WALL;

    if (!onFarWalk && !onNearWalk) {
        s.splats++;
        breakStreak(s);
        addSpark(s, b.sx, b.cy, '🍕');
        addPop(s, b.sx, b.cy - 6, pick(s, SPLAT_LINES), PAL.faint);
        return;
    }
    const side: 'far' | 'near' = onFarWalk ? 'far' : 'near';
    const h = s.houses.find(hh =>
        hh.side === side && Math.abs(b.sx - sxOf(s, hh.x + hh.doorOff)) <= s.matHalf);

    if (!h) {
        breakStreak(s);
        addSpark(s, b.sx, b.cy, '📦');
        addPop(s, b.sx, b.cy - 6, pick(s, HEDGE_LINES), PAL.faint);
        return;
    }
    if (h.done) {
        addPop(s, b.sx, b.cy - 6, 'they already have one', PAL.faint);
        breakStreak(s);
        return;
    }
    if (h.cust) deliver(s, h, false);
    else wrongHouse(s, h, false);
}

function throwBox(s: RunState, power: number) {
    if (s.wipeT > 0) return;
    if (s.ammo <= 0) {
        s.flash = 'out of boxes — find a crate';
        s.flashT = 1;
        return;
    }
    const side = s.facing;

    // --- point blank ------------------------------------------------------
    // Riding the pavement (board only) puts you ON the path, where there is no
    // cross-distance left to throw across: the shortest possible lob would sail
    // straight over the mat and into the brickwork. So at point blank you don't
    // throw, you hand it over. That is the whole payoff for ollieing the kerb —
    // and the reason planters and sprinklers live up here.
    if (s.onWalk !== 0 && side === s.onWalk) {
        const sideName: 'far' | 'near' = side < 0 ? 'far' : 'near';
        const h = s.houses.find(hh =>
            hh.side === sideName && Math.abs(sxOf(s, hh.x + hh.doorOff) - (RIDER_X + 6)) <= s.matHalf + 6);
        if (h) {
            s.ammo--;
            s.thrown++;
            s.armT = 0.26;
            if (h.done) { addPop(s, RIDER_X, laneY(s.laneF) - 14, 'they already have one', PAL.faint); breakStreak(s); }
            else if (h.cust) { deliver(s, h, false); s.flash = 'hand delivered'; s.flashT = 0.8; }
            else wrongHouse(s, h, false);
            return;
        }
        // No doorstep under you: the box goes down on somebody's path.
        s.ammo--;
        s.thrown++;
        s.armT = 0.26;
        breakStreak(s);
        addPop(s, RIDER_X, laneY(s.laneF) - 14, pick(s, HEDGE_LINES), PAL.faint);
        return;
    }

    s.ammo--;
    s.thrown++;
    s.armT = 0.26;
    const { vCross, vz } = throwVel(power);
    s.boxes.push({
        id: s.boxId++,
        sx: RIDER_X + 6,
        cy: laneY(s.laneF),
        // Throwing at the apex of an ollie genuinely releases the box higher,
        // which raises the whole parabola and puts windows in reach from lanes
        // a rider on the ground cannot make.
        z: HAND_Z + s.airZ,
        vCross: side * vCross,
        vz,
        side,
        spin: 0,
        wall: side < 0 ? FAR_WALL : NEAR_WALL,
    });
}

function stepBoxes(s: RunState, dt: number) {
    for (let i = s.boxes.length - 1; i >= 0; i--) {
        const b = s.boxes[i];
        const prevCy = b.cy;
        b.sx += BOX_LEAD * dt;
        b.cy += b.vCross * dt;
        b.vz -= G * dt;
        b.z += b.vz * dt;
        b.spin += dt * 9;

        const crossed = b.side < 0 ? (b.cy <= b.wall && prevCy > b.wall)
                                   : (b.cy >= b.wall && prevCy < b.wall);

        if (b.z <= 0) {
            // Landed. If it got past the wall plane in the same step it was only
            // ever going to end up on the doorstep anyway.
            b.cy = crossed ? b.wall - b.side * 3 : b.cy;
            b.z = 0;
            resolveGround(s, b);
            s.boxes.splice(i, 1);
            continue;
        }
        if (crossed) {
            resolveWall(s, b);
            s.boxes.splice(i, 1);
            continue;
        }
        if (b.sx > W + 30 || b.sx < -30) s.boxes.splice(i, 1);
    }
}

function crash(s: RunState, o: Obs) {
    if (s.invT > 0 || s.wipeT > 0) return;
    o.hit = true;
    s.crashes++;
    s.lives--;
    s.invT = 1.4;
    s.wipeT = 0.85;
    s.wipe = 0;
    s.speed *= s.rig.keep;
    s.shake = 8;
    breakStreak(s);
    award(s, -PEN_CRASH);
    // A crash scatters a box off the rack. Crashing while dry costs you nothing
    // but dignity, which you can't spend.
    if (s.ammo > 0) { s.ammo--; addSpark(s, RIDER_X + 10, laneY(s.laneF) - 6, '🍕'); }
    s.flash = o.def.label;
    s.flashT = 1.1;
    addSpark(s, RIDER_X, laneY(s.laneF) - 10, '💢');
}

/** Cycling furniture: how far the car door is open, how wet the sprinkler is. */
function cycleAmt(o: Obs, t: number) {
    if (!o.def.cycle) return 0;
    return clamp(Math.sin(t * (6.283 / o.def.cycle) + o.phase) * 0.5 + 0.62, 0, 1);
}

function stepObstacles(s: RunState, dt: number) {
    for (let i = s.obs.length - 1; i >= 0; i--) {
        const o = s.obs[i];
        const d = o.def;
        o.x += (d.vx ?? 0) * dt;
        if (o.x < s.x - 140) { s.obs.splice(i, 1); continue; }
        if (o.x > s.x + W + 420) { s.obs.splice(i, 1); continue; }

        if (d.drift) {
            o.lane += o.dir * d.drift * dt;
            if (o.lane < 0 || o.lane > LANES - 1) { o.dir *= -1; o.lane = clamp(o.lane, 0, LANES - 1); }
        }
        o.open = cycleAmt(o, s.t);

        if (o.done) continue;

        // A car door swings out into the lane beside it; a sprinkler only exists
        // when it is actually spraying.
        let lane = o.lane;
        let wide = d.wide;
        if (d.kind === 'door') {
            const into = o.lane <= 0 ? 1 : -1;
            lane += into * o.open * 0.75;
            wide += o.open * 0.28;
        }
        if (d.kind === 'sprink') {
            if (o.open < 0.45) continue;
            wide += o.open * 0.45;
        }

        const near = Math.abs(o.x - s.x) < d.len + 9;
        if (!near) continue;
        if (Math.abs(lane - s.laneF) > wide + 0.32) continue;

        // Airborne clears. A bunny hop gets you over knee-high things; only a
        // real ollie clears roadworks, a runaway trolley or a planter.
        if (s.air > 0 && (d.clear === 'hop' || (d.clear === 'ollie' && s.airBig))) {
            o.done = true;
            o.hit = true;
            continue;
        }
        o.done = true;
        crash(s, o);
    }
}

function stepCrates(s: RunState) {
    for (const c of s.crates) {
        if (c.taken) continue;
        if (c.x < s.x - 120) { c.taken = true; continue; }
        if (Math.abs(c.x - s.x) < 12 && s.onWalk === 0 && Math.abs(c.lane - s.laneF) < 0.62) {
            c.taken = true;
            s.ammo += CRATE_AMMO;
            s.crated++;
            s.dryT = 0;
            s.flash = `+${CRATE_AMMO} boxes`;
            s.flashT = 1;
            addPop(s, RIDER_X, laneY(s.laneF) - 16, `RESTOCK +${CRATE_AMMO}`, PAL.accent);
        }
    }
}

/** Customers you rode past leave a review. That is the whole punishment. */
function stepHouses(s: RunState, dt: number) {
    for (let i = s.houses.length - 1; i >= 0; i--) {
        const h = s.houses[i];
        if (h.leanT > 0) h.leanT -= dt;
        if (!h.done && !h.missed && h.cust && h.x < s.x - 26) {
            h.missed = true;
            s.missedCount++;
            breakStreak(s);
            award(s, -PEN_MISSED);
            if (h.voice.review.length) s.reviews.push(h.voice.review[0]);
            say(s, h, '★☆☆☆☆', PAL.bad);
            s.flash = `${h.voice.tag} is writing a review`;
            s.flashT = 1.2;
        }
        if (h.x < s.x - 260) s.houses.splice(i, 1);
    }
}

function finish(s: RunState, outcome: RunOutcome) {
    if (s.outcome) return;
    s.outcome = outcome;
    s.endT = 1.8;
    s.shake = outcome === 'wrecked' ? 10 : 5;
    s.bannerTxt = '';
    s.bannerT = 0;
}

/**
 * One fixed 1/60s step. Mutates `s`; returns nothing. Pure apart from the LCG it
 * carries, which is the point — a script can drive tens of thousands of these.
 */
export function stepRun(s: RunState, inp: RunInput, dt: number): void {
    if (s.outcome) {
        s.endT = Math.max(0, s.endT - dt);
        s.wipe += dt;
        s.shake = Math.max(0, s.shake - dt * 22);
        stepPops(s, dt);
        return;
    }

    s.t += dt;
    s.introT = Math.max(0, s.introT - dt);
    s.invT = Math.max(0, s.invT - dt);
    s.flashT = Math.max(0, s.flashT - dt);
    s.bannerT = Math.max(0, s.bannerT - dt);
    s.armT = Math.max(0, s.armT - dt);
    s.holdT = Math.max(0, s.holdT - dt);
    if (s.wipeT > 0) { s.wipeT -= dt; s.wipe += dt; } else s.wipe = 0;

    // --- speed ------------------------------------------------------------
    // Cruise ramps with the shift and is capped by the rig. Holding right is a
    // sprint, holding left is the only brake you have and the main way to buy
    // yourself another half second to line a doorstep up.
    s.cruise = Math.min(s.rig.top * s.fitness, SPEED_START + (s.x / ROUTE) * SPEED_RAMP);
    let target = s.cruise;
    if (s.wipeT > 0) target = 26;                       // sliding down the road
    else if (inp.right) target = s.cruise * s.rig.sprint;
    else if (inp.left) target = s.cruise * 0.6;
    if (s.holdT > 0) target = Math.min(target, 34);     // Grandma Ruth, talking
    if (s.onWalk !== 0) target *= 0.88;                 // pavement is slower going
    s.speed += (target - s.speed) * 3.4 * dt;
    s.speed = Math.max(10, s.speed);
    if (s.speed > s.topSpeed) s.topSpeed = s.speed;

    // --- steering ---------------------------------------------------------
    const dirV = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (s.wipeT <= 0) {
        if (s.onWalk === 0) {
            const steer = s.rig.steer * s.fitness * (s.air > 0 ? 0.7 : 1);
            s.laneF = clamp(s.laneF + dirV * steer * dt, 0, LANES - 1);

            // --- the kerb, which is the loudest half of the longboard branch --
            // Airborne and pushed hard against a kerb: a board pops up onto the
            // pavement, where the doorsteps are point blank. A shop BMX hits the
            // kerb with its front wheel and says so.
            if (s.air > 0 && s.airBig && dirV < 0 && s.laneF < 0.25) {
                s.onWalk = -1; s.laneF = -1; s.kerbs++;
                s.flash = 'KERB — far pavement';
                s.flashT = 0.9;
            } else if (s.air > 0 && s.airBig && dirV > 0 && s.laneF > LANES - 1.25) {
                s.onWalk = 1; s.laneF = LANES; s.kerbs++;
                s.flash = 'KERB — near pavement';
                s.flashT = 0.9;
            } else if (!s.rig.canOllie && ((dirV < 0 && s.laneF <= 0.01) || (dirV > 0 && s.laneF >= LANES - 1.01))) {
                if (s.flashT <= 0) { s.flash = 'the shop bike does not do kerbs'; s.flashT = 0.7; }
            }
        } else if (s.onWalk === -1) {
            // On the far pavement. Steering back down drops you off the kerb.
            s.laneF = -1;
            if (dirV > 0) { s.onWalk = 0; s.laneF = 0.12; s.speed *= 0.9; }
        } else {
            s.laneF = LANES;
            if (dirV < 0) { s.onWalk = 0; s.laneF = LANES - 1.12; s.speed *= 0.9; }
        }
    }

    // --- hop / ollie ------------------------------------------------------
    if (inp.hop && s.air <= 0 && s.wipeT <= 0) {
        s.air = s.rig.hopDur;
        s.airDur = s.rig.hopDur;
        s.airBig = s.rig.canOllie;
        s.speed -= s.rig.canOllie ? 1.5 : 4;
    }
    if (s.air > 0) {
        s.air -= dt;
        const p = 1 - clamp(s.air / s.airDur, 0, 1);
        s.airZ = Math.sin(p * Math.PI) * s.rig.hopZ;
        if (s.air <= 0) s.airZ = 0;
    } else s.airZ = 0;

    // --- aim + throw ------------------------------------------------------
    // Facing is "whichever verge you are nearest", overridable by holding a
    // direction as you let go. That is the two-sided decision, made with the
    // same thumb that steers.
    s.facing = inp.up ? -1 : inp.down ? 1 : (s.laneF < (LANES - 1) / 2 ? -1 : 1);
    if (inp.hold && !s.throwLock && s.wipeT <= 0) {
        s.charging = true;
        s.charge = Math.min(CHARGE_MAX, s.charge + dt);
    }
    const released = s.prevHold && !inp.hold;
    const overCharged = s.charging && s.charge >= CHARGE_MAX;
    if ((released || overCharged) && s.charging) {
        throwBox(s, clamp(s.charge / CHARGE_TIME, 0, 1));
        s.charging = false;
        s.charge = 0;
        // An auto-fired wind-up locks the button until the thumb comes off, so a
        // resting finger lobs one box rather than the whole rack.
        if (overCharged) s.throwLock = true;
    }
    if (!inp.hold) { s.charging = false; s.charge = 0; s.throwLock = false; }
    s.prevHold = inp.hold;

    // --- the street -------------------------------------------------------
    s.x += s.speed * dt;
    spawnHouses(s);
    spawnTraffic(s);
    spawnCrates(s);

    stepBoxes(s, dt);
    stepObstacles(s, dt);
    stepCrates(s);
    stepHouses(s, dt);
    stepPops(s, dt);
    s.shake = Math.max(0, s.shake - dt * 24);

    // --- out of pizza -----------------------------------------------------
    // Running dry is a real fail state, not a shrug: dispatch gives you a few
    // seconds to reach a crate before the shift is called off.
    if (s.ammo <= 0 && s.boxes.length === 0) {
        if (s.dryT <= 0) {
            s.dryT = DRY_GRACE;
            s.bannerTxt = 'OUT OF PIZZA';
            s.bannerT = 1;
        }
        s.dryT -= dt;
        if (s.dryT <= 0) { finish(s, 'dry'); return; }
    } else if (s.ammo > 0) s.dryT = 0;

    // --- endings ----------------------------------------------------------
    if (s.lives <= 0) { finish(s, 'wrecked'); return; }
    if (s.x >= ROUTE || s.t >= SHIFT_TIME) finish(s, s.score >= RENT ? 'rent' : 'short');
}

function stepPops(s: RunState, dt: number) {
    for (let i = s.pops.length - 1; i >= 0; i--) {
        const p = s.pops[i];
        p.life -= dt;
        p.y += p.vy * dt;
        p.vy *= 0.94;
        // Speech is pinned to the street, so it slides away with the house.
        p.x -= s.speed * dt;
        if (p.life <= 0) s.pops.splice(i, 1);
    }
    for (let i = s.sparks.length - 1; i >= 0; i--) {
        const k = s.sparks[i];
        k.life -= dt;
        if (k.life <= 0) { s.sparks.splice(i, 1); continue; }
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        k.vy += 200 * dt;
    }
}

// ---------------------------------------------------------------------------
// Rendering. Nothing below mutates the simulation.
// ---------------------------------------------------------------------------
const SKY = ['#070c18', '#0c1426', '#131e35', '#1b2942'];
const HOUSE_BODY = ['#3a3346', '#2f3b4a', '#45362f', '#333f38'];
const HOUSE_TRIM = ['#544a63', '#425264', '#5e4a3e', '#47584e'];
const ROAD = '#1a1e25';

/** Pizza box: a squashed brown square with a lid seam and a grease stripe. */
const drawBox = (ctx: Ctx, x: number, y: number, spin: number, sc = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    rect(ctx, -4 * sc, -3 * sc, 8 * sc, 6 * sc, '#b9793f');
    rect(ctx, -4 * sc, -3 * sc, 8 * sc, 1.6 * sc, '#d79a5c');
    line(ctx, -4 * sc, 0, 4 * sc, 0, '#7d4f26');
    rect(ctx, -1.2 * sc, -2 * sc, 2.4 * sc, 1.4 * sc, PAL.accent2);
    ctx.restore();
};

/** The shop BMX: two wheels, a frame, and a milk crate of pizza on the back. */
const drawBike = (ctx: Ctx, x: number, y: number, lean: number, ammo: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);
    circle(ctx, -7, -4, 4.2, '#11151b');
    circle(ctx, -7, -4, 2.1, '#39424f');
    circle(ctx, 8, -4, 4.2, '#11151b');
    circle(ctx, 8, -4, 2.1, '#39424f');
    line(ctx, -7, -4, 2, -10, '#8d3a46', 2);
    line(ctx, 2, -10, 8, -4, '#8d3a46', 2);
    line(ctx, 2, -10, 0, -4, '#8d3a46', 1.5);
    line(ctx, 8, -4, 9, -13, '#c9ced6', 1.5);          // fork + bars
    line(ctx, 6, -14, 12, -13, '#c9ced6', 1.5);
    // The rack. Boxes on it are the ammo counter you can see from the saddle.
    rect(ctx, -12, -14, 9, 3, '#4a5260');
    for (let i = 0; i < Math.min(4, Math.ceil(ammo / 3)); i++) {
        rect(ctx, -12, -16 - i * 2, 9, 2, i % 2 ? '#b9793f' : '#d79a5c');
    }
    ctx.restore();
};

/** The Venice Longboard: a wide deck, big soft wheels, violet on the underside. */
const drawDeck = (ctx: Ctx, x: number, y: number, lean: number, ammo: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);
    circle(ctx, -8, -2.2, 2.4, PAL.legend);
    circle(ctx, 8, -2.2, 2.4, PAL.legend);
    rect(ctx, -13, -5.4, 26, 2.6, PAL.violet);
    rect(ctx, -13, -5.4, 26, 0.9, PAL.accent);
    rect(ctx, -13, -3.2, 26, 0.8, '#1b1030');
    // Pizza bag slung across the back.
    rect(ctx, -17, -13, 8, 8, '#b9793f');
    outline(ctx, -17, -13, 8, 8, '#7d4f26');
    text(ctx, `${Math.min(99, ammo)}`, -13, -9.5, { size: 5, color: PAL.ink, align: 'center', baseline: 'middle' });
    ctx.restore();
};

const drawHouse = (ctx: Ctx, s: RunState, h: House) => {
    const sx = sxOf(s, h.x);
    if (sx < -70 || sx > W + 70) return;
    const { dir, base } = h;
    const x0 = Math.round(sx - h.w / 2);
    const ty = dir < 0 ? base - h.hgt : base;
    const body = HOUSE_BODY[h.hue];
    const trim = HOUSE_TRIM[h.hue];

    rect(ctx, x0, ty, h.w, h.hgt, body);
    outline(ctx, x0, ty, h.w, h.hgt, '#0a0d12');

    // Eaves: a roof line on the far row, an awning over the porch on the near.
    if (dir < 0) {
        rect(ctx, x0 - 3, ty - 3, h.w + 6, 4, trim);
        rect(ctx, x0 + h.w - 14, ty - 9, 5, 7, trim);              // chimney
    } else {
        rect(ctx, x0 - 3, base, h.w + 6, 4, trim);
    }

    // Ambient lit windows. It is late; most of the street is awake.
    for (let i = 0; i < 2; i++) {
        const zz = 8 + i * 14;
        const wx = x0 + 6 + ((h.id * 13 + i * 23) % Math.max(6, h.w - 16));
        if (Math.abs(wx - (sx + h.winOff)) < 12) continue;
        const yy = base + dir * zz - (dir < 0 ? 6 : 0);
        rect(ctx, wx, yy, 6, 6, (h.id + i) % 3 ? '#2a3242' : PAL.warn);
    }

    // --- the target window ------------------------------------------------
    const wx = sx + h.winOff;
    const wy = Math.min(base + dir * WIN_Z0, base + dir * WIN_Z1);
    const wh = WIN_Z1 - WIN_Z0;
    if (h.smashed) {
        rect(ctx, wx - WIN_HALF, wy, WIN_HALF * 2, wh, '#0a0d12');
        line(ctx, wx - WIN_HALF, wy, wx + WIN_HALF, wy + wh, PAL.bad);
        line(ctx, wx + WIN_HALF, wy, wx - WIN_HALF, wy + wh, PAL.bad);
    } else if (h.openWin) {
        // An open window is a hole with a warm room behind it, and a frame that
        // has been pushed up — the only visual tell for the trick shot.
        rect(ctx, wx - WIN_HALF, wy, WIN_HALF * 2, wh, '#120d08');
        rect(ctx, wx - WIN_HALF, wy, WIN_HALF * 2, 3, '#3a2d1c');
        rect(ctx, wx - WIN_HALF + 1, wy + wh - 5, WIN_HALF * 2 - 2, 4, PAL.warn);
        outline(ctx, wx - WIN_HALF - 1, wy - 1, WIN_HALF * 2 + 2, wh + 2, PAL.legend);
        if (h.leanT > 0) {
            // Leaning out, holding the pizza, delighted.
            glyph(ctx, h.voice.glyph, wx, wy + wh / 2, 9);
            glyph(ctx, '🍕', wx + 8, wy + wh / 2 + 2, 7, 0.4);
        }
    } else {
        rect(ctx, wx - WIN_HALF, wy, WIN_HALF * 2, wh, '#2b3d52');
        line(ctx, wx - WIN_HALF, wy + wh, wx + WIN_HALF, wy, 'rgba(255,255,255,0.18)', 2);
        outline(ctx, wx - WIN_HALF, wy, WIN_HALF * 2, wh, '#141a22');
    }

    // --- door + doormat ---------------------------------------------------
    const dx = sx + h.doorOff;
    const dy = Math.min(base, base + dir * 16);
    rect(ctx, dx - 5, dy, 10, 16, '#20262f');
    rect(ctx, dx - 5, dy, 10, 1.5, trim);
    circle(ctx, dx + 3, dy + 8, 0.9, PAL.legend);
    // Porch light, because you need to see the number at this hour.
    rect(ctx, dx + 7, dy + (dir < 0 ? 2 : 10), 2, 2, PAL.warn);

    const matY = base - dir * 6;
    const matC = !h.cust ? '#4a3a3a' : h.done ? '#2f5c3b' : PAL.ok;
    rect(ctx, dx - 9, matY - 2.5, 18, 5, matC);
    outline(ctx, dx - 9, matY - 2.5, 18, 5, '#0a0d12');
    if (h.done) drawBox(ctx, dx, matY, 0.2, 0.8);

    // --- the marker -------------------------------------------------------
    // Green pizza pin = they ordered. Red = they did not, and they will say so.
    const pinY = dir < 0 ? base - h.hgt - 12 : base - 13;
    const pinC = h.cust ? (h.done ? PAL.faint : PAL.ok) : PAL.bad;
    if (!h.done || h.cust) {
        line(ctx, dx, pinY + 3, dx, pinY + 7, pinC, 1);
        circle(ctx, dx, pinY, 4.6, pinC);
        circle(ctx, dx, pinY, 3.4, '#0a0d12');
        glyph(ctx, h.cust ? '🍕' : '🚫', dx, pinY, 5);
    }
    if (h.missed) text(ctx, '★☆☆☆☆', dx, matY + dir * 9, { size: 5, color: PAL.bad, align: 'center' });
};

const drawObstacle = (ctx: Ctx, s: RunState, o: Obs) => {
    const x = sxOf(s, o.x);
    if (x < -50 || x > W + 50) return;
    const y = laneY(o.lane);
    const d = o.def;

    if (d.kind === 'car' || d.kind === 'taxi') {
        const col = d.kind === 'taxi' ? '#c8a52d' : '#6d2f3a';
        shadow(ctx, x, y + 4, 15, 4, 0.4);
        rect(ctx, x - 15, y - 7, 30, 11, col);
        rect(ctx, x - 9, y - 12, 17, 6, d.kind === 'taxi' ? '#e0bd48' : '#8b4150');
        rect(ctx, x - 7, y - 11, 13, 4, '#1b2430');
        circle(ctx, x - 9, y + 4, 2.6, PAL.black);
        circle(ctx, x + 9, y + 4, 2.6, PAL.black);
        // Headlights face the way it is going, which is how you read the taxi.
        const nose = (d.vx ?? 0) < 0 ? -1 : 1;
        rect(ctx, x + nose * 15 - 2, y - 4, 3, 3, (d.vx ?? 0) < 0 ? PAL.warn : PAL.bad);
        if (d.kind === 'taxi') text(ctx, 'TAXI', x, y - 16, { size: 5, color: PAL.warn, align: 'center' });
        return;
    }
    if (d.kind === 'door') {
        rect(ctx, x - 11, y - 6, 22, 9, '#2d4a6b');
        rect(ctx, x - 6, y - 10, 11, 5, '#3d5c80');
        circle(ctx, x - 6, y + 3, 2.3, PAL.black);
        circle(ctx, x + 6, y + 3, 2.3, PAL.black);
        const into = o.lane <= 0 ? 1 : -1;
        // The door itself, swung out into your lane. Every single time.
        rect(ctx, x - 2, y + (into > 0 ? 2 : -6), 8, into * Math.max(1, o.open * 11), '#cfd6de');
        outline(ctx, x - 2, y + (into > 0 ? 2 : -6), 8, into * Math.max(1, o.open * 11), '#5d6874');
        return;
    }
    if (d.kind === 'works') {
        rect(ctx, x - 13, y - 2, 26, 4, '#3a2a12');
        for (let i = -1; i <= 1; i++) glyph(ctx, '🚧', x + i * 9, y - 5, 11);
        return;
    }
    if (d.kind === 'sprink') {
        const on = o.open > 0.45;
        glyph(ctx, '🚿', x, y + 2, 8, 1.2, 0.9);
        if (on) {
            ctx.save();
            ctx.globalAlpha = 0.5 + o.open * 0.3;
            for (let i = 0; i < 5; i++) {
                const a = (i / 4) * Math.PI - Math.PI / 2;
                line(ctx, x, y, x + Math.cos(a) * 11 * o.open, y - 9 * o.open + Math.sin(a) * 4, PAL.accent);
            }
            ctx.restore();
        }
        return;
    }
    shadow(ctx, x, y + 3, 6, 2.2, 0.35);
    const bob = d.drift ? Math.sin(s.t * 7 + o.phase) * 1.6 : 0;
    // Delivered art first, emoji second. See `ART_ID` for why this game's own
    // obstacle names are mapped onto shared street asset ids.
    art.sprite(ctx, ART_ID[d.kind] ?? d.kind, d.glyph, x, y + 2 + bob, 13, {
        frame: Math.floor(s.t * 10),
        flip: (d.vx ?? 0) < 0,
        rotation: o.hit ? 1.3 : 0,
        height: ART_H[d.kind] ?? 13,
    });
};

export function drawRun(ctx: Ctx, s: RunState) {
    const [shx, shy] = shakeOffset(s.shake);

    // --- sky --------------------------------------------------------------
    clear(ctx, W, H, SKY[0]);
    for (let i = 0; i < SKY.length; i++) rect(ctx, 0, i * 13, W, 14, SKY[i]);
    // Stars from a fixed hash so they do not shimmer between frames.
    for (let i = 0; i < 26; i++) {
        const hx = (i * 71) % W;
        const hy = (i * 37) % 42;
        rect(ctx, hx, hy, 1, 1, i % 4 ? '#33415c' : '#7d8ba6');
    }
    circle(ctx, 292, 20, 9, '#e8e2c8');
    circle(ctx, 288, 17, 7, SKY[1]);

    ctx.save();
    ctx.translate(shx, shy);

    // --- parallax: far towers, then the skyline, then the street ----------
    band(ctx, 60, 30, W, s.x * 0.08, 96, PAL.panel, (c, x, y) => {
        rect(c, x + 4, y - 26, 22, 30, '#111a28');
        rect(c, x + 34, y - 16, 16, 20, '#0e1622');
        rect(c, x + 58, y - 32, 26, 36, '#121b2a');
        for (let i = 0; i < 5; i++) rect(c, x + 62 + (i % 3) * 7, y - 28 + Math.floor(i / 3) * 9, 3, 4, i % 2 ? '#26344a' : '#c9a23f');
    });
    band(ctx, 64, 24, W, s.x * 0.22, 68, PAL.panel, (c, x, y) => {
        rect(c, x, y - 18, 28, 22, '#16202f');
        rect(c, x + 31, y - 26, 18, 30, '#101825');
        rect(c, x + 52, y - 12, 12, 16, '#18222f');
        for (let i = 0; i < 4; i++) rect(c, x + 4 + i * 6, y - 14, 3, 3, i % 2 ? '#243247' : PAL.warn);
    });

    // Far verge: slabs, then the houses that are actually part of the game.
    rect(ctx, 0, FAR_WALL, W, ROAD_TOP - FAR_WALL, '#2b3038');
    band(ctx, FAR_WALL, 12, W, s.x, 22, PAL.line, (c, x, y) => {
        line(c, x, y, x, y + 12, '#232830');
    });
    for (const h of s.houses) if (h.side === 'far') drawHouse(ctx, s, h);

    // --- the road ---------------------------------------------------------
    rect(ctx, 0, ROAD_TOP, W, ROAD_BOT - ROAD_TOP, ROAD);
    rect(ctx, 0, ROAD_TOP - 2, W, 2, '#454c57');                    // far kerb lip
    rect(ctx, 0, ROAD_BOT, W, 2, '#454c57');                        // near kerb lip
    for (let l = 1; l < LANES; l++) {
        const y = laneY(l) - LANE_H / 2;
        const col = l === 2 ? PAL.warn : '#4c545f';
        band(ctx, y, 2, W, s.x, 30, PAL.faint, (c, x, yy) => {
            rect(c, x, yy - 0.8, l === 2 ? 30 : 14, 1.6, col);
        });
    }

    // Near verge slabs (drawn before the actors standing on them).
    rect(ctx, 0, ROAD_BOT + 2, W, NEAR_WALL - ROAD_BOT - 2, '#2b3038');
    band(ctx, ROAD_BOT + 2, 10, W, s.x, 22, PAL.line, (c, x, y) => {
        line(c, x, y, x, y + 10, '#232830');
    });

    // --- restock crates ---------------------------------------------------
    for (const c of s.crates) {
        if (c.taken) continue;
        const x = sxOf(s, c.x);
        if (x < -30 || x > W + 30) continue;
        const y = laneY(c.lane);
        const bob = Math.sin(s.t * 4 + c.bob) * 1.5;
        shadow(ctx, x, y + 3, 8, 3, 0.4);
        rect(ctx, x - 8, y - 10 + bob, 16, 11, '#8a5a2b');
        rect(ctx, x - 8, y - 10 + bob, 16, 3, '#b9793f');
        outline(ctx, x - 8, y - 10 + bob, 16, 11, PAL.accent);
        text(ctx, 'AM/PM', x, y - 6 + bob, { size: 4, color: PAL.accent, align: 'center' });
    }

    // --- actors, far lanes first so nearer things overlap them ------------
    const acts = s.obs.slice().sort((a, b) => a.lane - b.lane);
    let riderDrawn = false;
    const drawRider = () => {
        if (riderDrawn) return;
        riderDrawn = true;
        const gy = laneY(s.laneF);
        const ry = gy - s.airZ;
        if (s.airZ > 1) shadow(ctx, RIDER_X, gy + 2, 8, 3, 0.35);
        const tumble = s.wipeT > 0 ? s.wipe * 7 : 0;
        const lean = tumble || (s.charging ? 0.05 * s.facing : 0);
        ctx.save();
        if (tumble) {
            ctx.translate(RIDER_X, ry);
            ctx.rotate(tumble);
            ctx.translate(-RIDER_X, -ry);
        }
        if (s.hasBoard) drawDeck(ctx, RIDER_X, ry, lean, s.ammo);
        else drawBike(ctx, RIDER_X, ry, lean, s.ammo);
        figure(ctx, RIDER_X, ry - (s.hasBoard ? 4 : 6), 23, {
            kit: KIT.player,
            facing: 1,
            stride: s.t * 3,
            armUp: s.armT > 0 ? 1 : s.charging ? 0.55 : 0,
            crouch: s.charging || s.air > 0,
            hurt: s.invT > 0.9,
        });
        ctx.restore();

        // Facing chevron. Which verge a throw would go to is the single most
        // important thing on screen, so it is drawn on the rider at all times
        // rather than only while winding up.
        const fy = ry + s.facing * 13;
        const fc = s.charging ? PAL.legend : PAL.accent;
        line(ctx, RIDER_X + 9, fy, RIDER_X + 13, fy + s.facing * 4, fc);
        line(ctx, RIDER_X + 17, fy, RIDER_X + 13, fy + s.facing * 4, fc);
    };

    for (const o of acts) {
        if (!riderDrawn && o.lane > s.laneF) drawRider();
        drawObstacle(ctx, s, o);
    }
    drawRider();

    // Near houses sit in front of everything on the street.
    for (const h of s.houses) if (h.side === 'near') drawHouse(ctx, s, h);

    // Streetlights on the near kerb, in front of the road, behind nothing.
    band(ctx, ROAD_BOT, 0, W, s.x, 132, PAL.faint, (c, x, y) => {
        rect(c, x, y - 34, 2, 34, '#39414b');
        rect(c, x - 1, y - 36, 12, 3, '#39414b');
        circle(c, x + 10, y - 33, 2.2, PAL.warn);
        ctx.save();
        ctx.globalAlpha = 0.10;
        c.beginPath();
        c.moveTo(x + 10, y - 32);
        c.lineTo(x - 12, y - 2);
        c.lineTo(x + 32, y - 2);
        c.closePath();
        c.fillStyle = PAL.warn;
        c.fill();
        ctx.restore();
    });

    // --- boxes in flight --------------------------------------------------
    for (const b of s.boxes) {
        shadow(ctx, b.sx, b.cy, 4, 1.6, 0.3);
        drawBox(ctx, b.sx, b.cy - b.z, b.spin);
    }

    // --- aim preview ------------------------------------------------------
    // The dotted arc is the throw maths, drawn. It is also the tutorial: you can
    // see the parabola pass over the doorstep and into the window.
    if (s.charging && s.ammo > 0 && s.wipeT <= 0) {
        const power = clamp(s.charge / CHARGE_TIME, 0, 1);
        const cy0 = laneY(s.laneF);
        const z0 = HAND_Z + s.airZ;
        const side = s.facing;
        const wall = side < 0 ? FAR_WALL : NEAR_WALL;
        const p = predictThrow(cy0, z0, side, power, wall, s.speed);
        // The guide is drawn in street space (see predictThrow): it shows the
        // point of pavement the box will hit, not the pixel it will occupy.
        for (let i = 1; i <= 9; i++) {
            const tt = (i / 9) * p.tLand;
            const px = RIDER_X + 6 + (BOX_LEAD + s.speed) * tt;
            const pz = z0 + p.vz * tt - (G * tt * tt) / 2;
            rect(ctx, px, cy0 + side * p.vCross * tt - pz, 1.4, 1.4, 'rgba(230,237,243,0.45)');
        }
        // Reticle turns green over a customer's mat and red over anyone else's.
        const onWalkBand = (p.cross >= FAR_WALL && p.cross <= ROAD_TOP) || (p.cross >= ROAD_BOT && p.cross <= NEAR_WALL);
        const side2: 'far' | 'near' = side < 0 ? 'far' : 'near';
        const target = onWalkBand
            ? s.houses.find(h => h.side === side2 && Math.abs(p.sx - sxOf(s, h.x + h.doorOff)) <= s.matHalf)
            : undefined;
        const col = target ? (target.cust && !target.done ? PAL.ok : PAL.bad) : PAL.faint;
        outline(ctx, p.sx - 5, p.cross - 3, 10, 6, col);
        line(ctx, p.sx - 7, p.cross, p.sx - 5, p.cross, col);
        line(ctx, p.sx + 5, p.cross, p.sx + 7, p.cross, col);

        // If this arc would clear the doorstep and cross the facade inside an
        // open window, ring the window. It is the only way anybody would ever
        // work out that overthrowing on purpose is the highest-scoring shot.
        if (p.wallZ !== null && p.sxWall !== null && p.wallZ >= WIN_Z0 && p.wallZ <= WIN_Z1) {
            const wx = p.sxWall;
            const hit = s.houses.find(h => h.side === side2 && Math.abs(wx - sxOf(s, h.x + h.winOff)) <= WIN_HALF);
            if (hit) {
                const wy = Math.min(hit.base + hit.dir * WIN_Z0, hit.base + hit.dir * WIN_Z1);
                outline(ctx, sxOf(s, hit.x + hit.winOff) - WIN_HALF - 2, wy - 2, WIN_HALF * 2 + 4, WIN_Z1 - WIN_Z0 + 4,
                    hit.openWin ? PAL.legend : PAL.bad, 1);
            }
        }
        // Power bar, stuck to the rider.
        bar(ctx, RIDER_X - 12, laneY(s.laneF) - 26, 24, 3, power, power > 0.85 ? PAL.legend : PAL.accent);
    }

    // --- speed lines ------------------------------------------------------
    if (s.speed > s.rig.top * 0.62) {
        const n = 4 + Math.round((s.speed / s.rig.top) * 6);
        ctx.save();
        ctx.globalAlpha = 0.22;
        for (let i = 0; i < n; i++) {
            const y = ROAD_TOP + ((s.t * 500 + i * 97) % (ROAD_BOT - ROAD_TOP));
            line(ctx, 0, y, 18 + ((i * 61) % 46), y, PAL.ink, 1);
        }
        ctx.restore();
    }

    for (const k of s.sparks) glyph(ctx, k.ch, k.x, k.y, 9, 0, clamp(k.life * 2, 0, 1));

    // --- floating customer lines -----------------------------------------
    for (const p of s.pops) {
        const a = clamp(p.life / 0.6, 0, 1);
        const tw = Math.min(190, p.txt.length * 3.6 + 10);
        ctx.save();
        ctx.globalAlpha = a;
        rect(ctx, p.x - tw / 2, p.y - 6, tw, 11, 'rgba(4,6,10,0.82)');
        outline(ctx, p.x - tw / 2, p.y - 6, tw, 11, p.color);
        text(ctx, p.txt, p.x, p.y - 3.5, { size: p.size, color: p.color, align: 'center' });
        ctx.restore();
    }

    ctx.restore();

    // --- HUD --------------------------------------------------------------
    rect(ctx, 0, 0, W, 19, 'rgba(4,6,10,0.74)');
    line(ctx, 0, 19, W, 19, PAL.line);

    text(ctx, 'RENT', 5, 3, { size: 6, color: PAL.dim });
    bar(ctx, 27, 3, 86, 6, s.score / RENT, s.score >= RENT ? PAL.ok : PAL.accent);
    text(ctx, `$${s.score}`, 116, 3, { size: 6, color: s.score >= RENT ? PAL.ok : PAL.ink });
    text(ctx, `of $${RENT}`, 116, 11, { size: 5, color: PAL.faint });

    // Boxes left, drawn as boxes — you should never have to read a number.
    for (let i = 0; i < Math.min(12, s.ammo); i++) rect(ctx, 158 + i * 4, 4, 3, 5, i < 3 ? PAL.bad : PAL.legend);
    text(ctx, `${s.ammo}`, 158 + Math.min(12, s.ammo) * 4 + 3, 3, { size: 6, color: s.ammo <= 2 ? PAL.bad : PAL.dim });
    text(ctx, s.mult > 1 ? `COMBO x${s.mult}` : `${s.delivered} delivered`, 158, 11, {
        size: 5, color: s.mult > 1 ? PAL.legend : PAL.faint,
    });

    for (let i = 0; i < START_LIVES; i++) {
        glyph(ctx, i < s.lives ? '❤️' : '🖤', 236 + i * 11, 8, 8, 0, i < s.lives ? 1 : 0.4);
    }

    glyph(ctx, s.rig.glyph, 278, 7, 9);
    text(ctx, s.hasBoard ? 'LONGBOARD' : 'SHOP BMX', 287, 3, { size: 6, color: s.hasBoard ? PAL.accent : PAL.warn });
    text(ctx, `${Math.round(s.speed * 0.22)} MPH${s.onWalk !== 0 ? ' · PAVEMENT' : ''}`, 287, 11, { size: 5, color: PAL.faint });

    // Route + clock, as one thin line under the HUD.
    bar(ctx, 0, 20, W, 2, clamp(s.x / ROUTE, 0, 1), PAL.accent2, 'rgba(255,255,255,0.06)');

    if (s.flashT > 0) {
        text(ctx, s.flash.toUpperCase(), W / 2, H - 10, { size: 7, color: PAL.legend, align: 'center' });
    }
    if (s.dryT > 0) {
        text(ctx, `NO BOXES — CRATE IN ${s.dryT.toFixed(1)}s`, W / 2, 26, { size: 7, color: PAL.bad, align: 'center' });
    }
    if (s.bannerT > 0 && s.bannerTxt) {
        ctx.save();
        ctx.globalAlpha = clamp(s.bannerT * 2, 0, 1);
        banner(ctx, s.bannerTxt, W, 52, s.bannerTxt === 'TRICK SHOT!' ? PAL.legend : PAL.accent, 22);
        ctx.restore();
    }

    // --- intro + endings --------------------------------------------------
    if (s.introT > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(s.introT / 0.7, 0, 1);
        rect(ctx, 0, 44, W, 46, 'rgba(4,6,10,0.72)');
        banner(ctx, s.hasBoard ? 'LONGBOARD SHIFT' : 'BIKE SHIFT', W, 58, s.hasBoard ? PAL.accent : PAL.warn, 18);
        text(ctx, s.rig.note, W / 2, 72, { size: 7, color: PAL.ink, align: 'center' });
        text(ctx, `Green pin = they ordered. Make $${RENT} before the street runs out.`, W / 2, 82, {
            size: 6, color: PAL.dim, align: 'center',
        });
        ctx.restore();
    }
    if (s.outcome === 'rent') banner(ctx, 'RENT MADE', W, 70, PAL.ok, 26);
    if (s.outcome === 'short') banner(ctx, 'SHIFT OVER', W, 70, PAL.bad, 26);
    if (s.outcome === 'wrecked') banner(ctx, 'WRECKED', W, 70, PAL.bad, 26);
    if (s.outcome === 'dry') banner(ctx, 'OUT OF PIZZA', W, 70, PAL.bad, 24);
}

// ---------------------------------------------------------------------------
// Result copy
// ---------------------------------------------------------------------------
const RESULTS: Record<RunOutcome, { headline: string; detail: (s: RunState) => string }> = {
    rent: {
        headline: 'Rent Made',
        detail: s => s.tricks > 0
            ? `${s.delivered} deliveries, ${s.tricks} of them through an open window. Dispatch has never seen numbers like it and is already talking about "the pizza guy who throws".`
            : `${s.delivered} deliveries, every one on the mat. Boring, correct, paid.`,
    },
    short: {
        headline: 'Short On Rent',
        detail: s => s.reviews.length
            ? `The street ran out before the money did. ${s.missedCount} customer${s.missedCount === 1 ? '' : 's'} left a review. One of them reads: "${s.reviews[0]}"`
            : `The street ran out before the money did. You were $${Math.max(0, RENT - s.score)} light.`,
    },
    wrecked: {
        headline: 'Wrecked',
        detail: s => `Three crashes and the ${s.hasBoard ? 'board' : 'bike'} goes one way, ${s.ammo + 1} boxes go the other. A man films the whole thing from a balcony and does not offer to help.`,
    },
    dry: {
        headline: 'Out Of Pizza',
        detail: () => `No boxes, no crate, no shift. Dispatch tells you to come back in, then tells you the ride back is not paid time.`,
    },
};

interface Hud {
    score: number; ammo: number; lives: number; route: number; mult: number;
    delivered: number; dry: number; mph: number;
}
const readHud = (s: RunState): Hud => ({
    score: s.score,
    ammo: s.ammo,
    lives: s.lives,
    route: Math.round(clamp(s.x / ROUTE, 0, 1) * 100),
    mult: s.mult,
    delivered: s.delivered,
    dry: s.dryT,
    mph: Math.round(s.speed * 0.22),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const PizzaRun: React.FC<{
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ onFinish, onQuit }) => {
    const { gameState } = useGame();
    const { player } = gameState;

    // The whole longboard branch hangs off one item in the player's cache.
    const hasBoard = useMemo(() => hasWeapon(player, 'itm-longboard'), [player]);

    const { input, set, consume } = useInput(true);

    // The entire simulation lives in a ref. Nothing in here may become React
    // state: this object is mutated 60 times a second.
    const runRef = useRef<RunState | null>(null);
    if (!runRef.current) {
        runRef.current = createRunState({
            hasBoard,
            energy: player.energy,
            focus: player.focus,
            seed: (Date.now() ^ 0x9e3779b9) >>> 0,
        });
    }

    const [hud, setHud] = useState<Hud>(() => readHud(runRef.current!));
    const [done, setDone] = useState<RunOutcome | null>(null);
    const doneRef = useRef(false);
    const finishedRef = useRef(false);
    const hudClock = useRef(0);

    // Delivered street art starts decoding as the game mounts. Nothing waits on
    // it: until a file is ready `art.sprite` draws the emoji, so a slow
    // connection is a game that looks like it used to rather than a blank
    // frame. See `engine/streetArt.ts`.
    useMemo(() => art.load(), []);

    const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
        const s = runRef.current!;
        const i = input.current;

        // Throw is HELD (the charge), so it is passed through raw and the sim
        // finds the release edge itself. Hop is edge-triggered so a resting
        // thumb on a phone does not pogo the whole street.
        stepRun(s, {
            up: i.up,
            down: i.down,
            left: i.left,
            right: i.right,
            hold: i.a,
            hop: consume('b'),
        }, dt);

        drawRun(ctx, s);

        // The HUD is the only thing crossing back into React, at ~7Hz.
        hudClock.current += dt;
        if (hudClock.current >= 0.14) {
            hudClock.current = 0;
            setHud(readHud(s));
        }

        if (s.outcome && s.endT <= 0 && !doneRef.current) {
            doneRef.current = true;
            setDone(s.outcome);
        }
    }, [input, consume]);

    const s = runRef.current;
    const won = done === 'rent';

    const close = () => {
        if (finishedRef.current) return;   // onFinish fires exactly once
        finishedRef.current = true;
        const bits: string[] = [];
        if (s.delivered) bits.push(`${s.delivered} delivered`);
        if (s.tricks) bits.push(`${s.tricks} through a window`);
        if (s.broken) bits.push(`${s.broken} window${s.broken === 1 ? '' : 's'} broken`);
        if (s.wrong) bits.push(`${s.wrong} wrong house${s.wrong === 1 ? '' : 's'}`);
        if (s.crashes) bits.push(`${s.crashes} crash${s.crashes === 1 ? '' : 'es'}`);
        const tail = bits.length ? ` (${bits.join(', ')})` : '';
        onFinish(
            won,
            won
                ? `You made rent on a pizza shift — $${s.score} on the ${hasBoard ? 'longboard' : 'shop bike'}${tail}.`
                : `The pizza shift ended $${Math.max(0, RENT - s.score)} short${tail}.`,
        );
    };

    return (
        <ArcadeShell
            title="Pizza Run"
            subtitle={`Rent night · two-sided street · ${hasBoard ? '🛹 Venice Longboard' : '🚲 the shop BMX'}`}
            width={W}
            height={H}
            running={done === null}
            onFrame={onFrame}
            onInput={set}
            actions={['Throw', hasBoard ? 'Ollie' : 'Bunny Hop']}
            vertical
            onQuit={onQuit}
            quitLabel="Clock Off"
            hud={
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <div className="flex justify-between label mb-1">
                            <span>Rent</span>
                            <span className="numeric">${hud.score}<span className="text-[var(--ink-faint)]">/{RENT}</span></span>
                        </div>
                        <div className="meter h-2">
                            <i style={{
                                width: `${Math.min(100, (hud.score / RENT) * 100)}%`,
                                background: hud.score >= RENT ? 'var(--ok)' : 'var(--accent)',
                            }} />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between label mb-1">
                            <span>{hud.dry > 0 ? 'No Boxes!' : 'Boxes'}</span>
                            <span className="numeric">{hud.ammo}</span>
                        </div>
                        <div className="meter h-2">
                            <i style={{
                                width: `${Math.min(100, (hud.ammo / START_AMMO) * 100)}%`,
                                background: hud.ammo <= 2 ? 'var(--bad)' : 'var(--warn)',
                            }} />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between label mb-1">
                            <span>Street</span>
                            <span className="numeric">{'❤'.repeat(Math.max(0, hud.lives))}{hud.mult > 1 ? ` x${hud.mult}` : ''}</span>
                        </div>
                        <div className="meter h-2"><i style={{ width: `${hud.route}%`, background: 'var(--accent-2)' }} /></div>
                    </div>
                </div>
            }
            overlay={done !== null ? (
                <MiniGameResult
                    won={won}
                    headline={RESULTS[done].headline}
                    detail={RESULTS[done].detail(s)}
                    onClose={close}
                    closeLabel={won ? 'Cash Out' : 'Hand The Bag Back'}
                />
            ) : undefined}
            help={
                `▲ ▼ steer across four lanes. The side you are nearest is the side you throw at — hold ▲ or ▼ as you let go to throw across the street instead. `
                + `◀ brakes (your only way to buy time), ▶ sprints. `
                + `HOLD THROW to wind up and release: the dotted arc shows where the box lands. Green reticle = they ordered, red = they did not. `
                + `Overthrow slightly and the arc passes through an open upstairs window — that is a trick shot and pays two and a half times. Hit a shut one and you are paying for glass. `
                + (hasBoard
                    ? `OLLIE clears roadworks, trolleys and planters, and pressing ▲ or ▼ at the top of one pops you over the kerb onto the pavement — up there THROW hands the box straight over, but so do the sprinklers and the planters. `
                    : `BUNNY HOP clears bins, dogs and hydrants. It does not clear roadworks, and the shop bike does not do kerbs. `)
                + `Ride over AM/PM crates to restock. Run out of boxes and the shift gets called off.`
            }
        />
    );
};

export default PizzaRun;
