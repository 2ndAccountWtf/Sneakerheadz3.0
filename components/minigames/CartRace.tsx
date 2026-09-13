/**
 * Cart Race — "DOWNHILL (feat. nobody)"
 * =====================================
 * The Game has your box and he is escaping down a very long hill on a stolen
 * AM/PM shopping trolley. He is not good at this. He is yelling about a mixtape.
 *
 * The whole game is one number: the gap. Close it to zero and you get the box
 * back. Let it stretch out, run out of hill, or wipe out, and he's gone.
 *
 * The heart of the design is the longboard branch. `itm-longboard` is not a
 * hidden +10% stat — it swaps your entire rig:
 *
 *   with the board   : higher top speed, sharp steering, and you can ollie, so
 *                      most street furniture becomes a ramp instead of a wall.
 *   without it       : you grabbed the *other* trolley out of the bay. Slower,
 *                      steers like a fridge, cannot leave the ground. You have
 *                      to weave everything and lean on AM/PM weapons to win.
 *
 * Both are winnable. Only one is comfortable.
 *
 * Everything below the constants is a pure simulation (`createRaceState` +
 * `stepRace`) with no React and no canvas in it, so it can be driven headlessly
 * by a script. The component is a thin shell: refs in, pixels out.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ArcadeShell, useInput, PAL, KIT,
    clear, rect, outline, circle, line, text, glyph, shadow, bar, figure, band,
    shakeOffset, banner,
} from './engine';
import type { Ctx } from './engine';
import { MiniGameResult } from './MiniGameShell';
import { useGame } from '../../hooks/useGame';
import { armsFor, hasWeapon } from '../../systems/weapons';
import type { Weapon } from '../../systems/weapons';

// ---------------------------------------------------------------------------
// Geometry. 320x180 logical pixels, four lanes of asphalt, a 3/4 side view.
// ---------------------------------------------------------------------------
const W = 320;
const H = 180;
const LANES = 4;
const ROAD_TOP = 100;
const LANE_H = 18;
const LANE_Y0 = 114;
/** The player never moves horizontally; the world moves past them. */
const PLAYER_X = 62;
/** Near-field metres -> pixels, used to place obstacles on the road. */
const PX_PER_M = 5;
/** The gap is drawn on its own, much flatter scale — he's a long way off. */
const GAP_PX = 1.0;

const laneY = (lane: number) => LANE_Y0 + lane * LANE_H;
/** Lanes further up the screen are further away, so their contents are smaller. */
const laneScale = (lane: number) => 0.80 + lane * 0.07;

// ---------------------------------------------------------------------------
// Race tuning. These numbers were settled by running the headless sim, not by
// vibes — see the balance notes on RUBBER_K below.
// ---------------------------------------------------------------------------
const START_GAP = 100;      // metres of hill between you and him at the drop-in
const LOSE_GAP = 220;       // he's over the horizon; chase over
const HILL_LENGTH = 1900;   // the hill flattens out here. Out of hill = out of luck.

/** Constant downhill pull. You are always accelerating unless something stops you. */
const HILL_ACCEL = 9;
/** Tucking leans you into the slope as well as cutting drag. */
const TUCK_GAIN = 1.34;

/** His pace at the drop-in, before the band starts reacting to you. */
const THIEF_BASE = 30;
/**
 * The rubber band. He paces *you* rather than holding an absolute speed —
 * a chase where he just drives off at a fixed speed isn't a game, it's a
 * cutscene. His target speed is your rolling average, shifted by how far ahead
 * he is: well clear, he relaxes and gloats; on your wheel, he panics.
 *
 * The two clamps are where the whole design lives:
 *   THIEF_MAX — a hard ceiling. His trolley physically will not go faster than
 *               this, and a Venice Longboard cruises *above* it. That single
 *               number is the longboard payoff: with the board you out-run the
 *               band outright, without it you never can and the gap only closes
 *               when he crashes or you land something on him.
 *   THIEF_MIN — a floor, so a disastrous run is still recoverable.
 */
const RUBBER_K = 0.045;
const THIEF_MAX = 38;
const THIEF_MIN = 17;
/**
 * How much of his target speed comes from pacing you versus just riding the
 * hill at his own stubborn pace. Pure pacing would make both rigs win at the
 * same gap and only differ in how long it took; pure absolute made the trolley
 * mathematically unable to finish. The blend is what leaves the board
 * comfortable and the trolley a real fight.
 */
const PACE_W = 0.55;
const THIEF_ABS = 30.9;

const SPAWN_AHEAD = 70;     // metres of street kept populated ahead of you
/** Thrown-weapon speeds are authored in px/s; scale them into gap-metres/s. */
const PROJ_SCALE = 0.4;

// ---------------------------------------------------------------------------
// Rigs — the longboard branch, made of whole numbers you can feel.
// ---------------------------------------------------------------------------
interface Rig {
    id: 'board' | 'trolley';
    label: string;
    glyph: string;
    /** Terminal velocity standing up, and tucked. Drag is derived from these. */
    cruise: number;
    tuckTop: number;
    /** Lanes crossed per second at full lock. */
    steer: number;
    /** m/s of speed scrubbed per second of steering — carving is your only brake. */
    carve: number;
    /** Speed at which the thing starts to shimmy and steer itself. */
    wobbleAt: number;
    canOllie: boolean;
    /** Speed added for a clean ramp landing. */
    rampBoost: number;
    /** Added to the fraction of speed kept through an impact. */
    hitKeep: number;
    /** Damage multiplier on impacts — a trolley folds, a deck pops back up. */
    hitDmg: number;
    /**
     * The trolley's one genuine advantage: it is a steel cage on wheels, so it
     * ploughs through bins, cones and dogs instead of stopping on them. It does
     * nothing against a parked car. This is what keeps the no-board run alive
     * when you cannot ollie anything.
     */
    plough: number;
    ploughDmg: number;
    note: string;
}

const BOARD: Rig = {
    id: 'board', label: 'Venice Longboard', glyph: '🛹',
    cruise: 34, tuckTop: 44, steer: 7.4, carve: 2.2, wobbleAt: 34,
    canOllie: true, rampBoost: 9, hitKeep: 0.12, hitDmg: 0.7, plough: 0, ploughDmg: 1,
    note: 'Board under your feet. You can actually catch him.',
};

const TROLLEY: Rig = {
    id: 'trolley', label: 'The Other Trolley', glyph: '🛒',
    cruise: 29, tuckTop: 34, steer: 3.1, carve: 4.6, wobbleAt: 28,
    canOllie: false, rampBoost: 1.6, hitKeep: -0.06, hitDmg: 1.15, plough: 0.3, ploughDmg: 0.45,
    note: 'No board. You took the other trolley. It steers like a fridge.',
};

// ---------------------------------------------------------------------------
// Street furniture. `clear` is what it takes to get over the thing:
//   'none'  — a wall. Weave or wear it.
//   'ollie' — a real ollie clears it. The trolley cannot.
//   'hop'   — low enough that even a panicked trolley hop clears it.
// ---------------------------------------------------------------------------
type ClearBy = 'none' | 'ollie' | 'hop';

interface ObsDef {
    kind: string;
    glyph: string;
    label: string;
    /** Half-length in metres along the hill, and half-width in lanes. */
    len: number;
    wide: number;
    clear: ClearBy;
    dmg: number;
    /** Fraction of speed kept on impact, before rig modifiers. */
    keep: number;
    weight: number;
    ramp?: boolean;
    oil?: boolean;
    /** Lanes per second of wandering (dogs, pedestrians). */
    drift?: number;
}

const OBS: ObsDef[] = [
    { kind: 'car', glyph: '🚗', label: 'parked Camry', len: 3.2, wide: 0.6, clear: 'none', dmg: 14, keep: 0.55, weight: 18 },
    { kind: 'door', glyph: '🚪', label: 'car door', len: 1.8, wide: 0.55, clear: 'none', dmg: 12, keep: 0.5, weight: 9 },
    { kind: 'bay', glyph: '🛒', label: 'AM/PM trolley bay', len: 3.6, wide: 1.05, clear: 'none', dmg: 13, keep: 0.5, weight: 6 },
    { kind: 'ped', glyph: '🚶', label: 'pedestrian', len: 1.4, wide: 0.5, clear: 'none', dmg: 9, keep: 0.62, weight: 9, drift: 0.35 },
    { kind: 'works', glyph: '🚧', label: 'roadworks', len: 2.0, wide: 0.55, clear: 'ollie', dmg: 8, keep: 0.66, weight: 14 },
    { kind: 'bin', glyph: '🗑️', label: 'wheelie bin', len: 1.6, wide: 0.5, clear: 'ollie', dmg: 6, keep: 0.72, weight: 13 },
    { kind: 'dog', glyph: '🐕', label: 'loose dog', len: 1.4, wide: 0.5, clear: 'ollie', dmg: 7, keep: 0.7, weight: 10, drift: 0.9 },
    { kind: 'oil', glyph: '🛢️', label: 'oil slick', len: 3.0, wide: 0.7, clear: 'hop', dmg: 0, keep: 0.9, weight: 10, oil: true },
    { kind: 'ramp', glyph: '', label: 'plywood ramp', len: 2.2, wide: 0.6, clear: 'none', dmg: 0, keep: 1, weight: 12, ramp: true },
];
/** Whatever he grabs off his own trolley and lobs back at you. */
const JUNK: ObsDef = { kind: 'junk', glyph: '🥫', label: 'thrown garbage', len: 1.3, wide: 0.5, clear: 'ollie', dmg: 6, keep: 0.74, weight: 0 };

const OBS_TOTAL = OBS.reduce((n, o) => n + o.weight, 0);

/** A stand-in so nobody is ever left with nothing to press. */
const POCKET: Weapon = {
    id: 'pocket-litter',
    name: 'Whatever Was In Your Pocket',
    short: 'Pocket',
    glyph: '🪙',
    klass: 'thrown',
    damage: 7,
    cooldown: 0.7,
    speed: 150,
    uses: 9,
    games: ['cart-race'],
    flavor: 'Lint, a lighter, three shekels. It still stings.',
};

// ---------------------------------------------------------------------------
// His voice. Lifted from data/celebrities/the-game — the mixtape, the grind,
// and the fact that he once mugged somebody for half a sandwich.
// ---------------------------------------------------------------------------
const TALK = [
    "Life don't make sense, homie!",
    'These is my streets!',
    "I'm droppin' a mixtape about this!",
    'Respect the grind!',
    'This cart is a RENTAL!',
    'I only took ONE lace before!',
    "Don't stare too long, blood!",
    'Premium Unleaded — out now!',
    'Ayo, the wheels is square!',
    'Stay dangerous!',
];
const TALK_CRASH = [
    'MY MIXTAPE!',
    'THAT WAS A BIN!',
    'Aight, that was on purpose.',
    'The cart did that, not me!',
    "Life don't make— OW!",
];
const TALK_HIT = [
    'AYO, WHO YOU CALLIN A BUSTER?!',
    'Not the face, blood!',
    "That's a AM/PM item! I know the clerk!",
    'You wastin good food!',
    'I felt that in my SOUL!',
];
const TALK_WIN = ['Aight. Aight. Take it. Respect the grind.', "Blood, I was gonna give it back."];

// ---------------------------------------------------------------------------
// State. One flat mutable object — the loop touches it 60 times a second, so
// nothing in here is ever allowed near React state.
// ---------------------------------------------------------------------------
interface Obs {
    id: number;
    def: ObsDef;
    z: number;
    lane: number;
    /** Wander direction for drifting obstacles. */
    dir: number;
    /** Resolved once, so a long parked car cannot hit you four frames running. */
    done: boolean;
    /** Cosmetic: knocked-over / opened / cleared. */
    hit: boolean;
    phase: number;
}

interface Shot {
    id: number;
    wid: string;
    /** Metres of gap covered so far. */
    travel: number;
    lane: number;
    /** Where it bonks off a car instead of reaching him, or Infinity. */
    stopAt: number;
    back: boolean;
    spin: number;
}

interface Spark {
    x: number; y: number; vx: number; vy: number; life: number; ch: string;
}

export type RaceOutcome = 'caught' | 'lost' | 'wipeout' | 'flat';

export interface RaceState {
    rig: Rig;
    hasBoard: boolean;
    /** Energy-derived fitness, 0.9..1.0. Tired legs cruise slower and steer later. */
    fitness: number;
    seed: number;

    t: number;
    z: number;
    speed: number;
    topSpeed: number;
    laneF: number;
    drag: number;
    dragTuck: number;
    tucking: boolean;
    wob: number;
    health: number;
    gap: number;

    airT: number;
    airDur: number;
    airH: number;
    /** A real ollie clears 'ollie' obstacles; a trolley hop only clears 'hop'. */
    airBig: boolean;
    airFromRamp: boolean;
    invT: number;
    oilT: number;

    thiefLane: number;
    thiefSpeed: number;
    /** Rolling average of your speed — what the rubber band tracks. */
    pace: number;
    thiefStun: number;
    thiefSlow: number;
    /** Anti-stun-lock window: no new stagger while this is running. */
    thiefGuard: number;
    /** His own crashes — a deeper scrub than anything you can throw. */
    crashT: number;
    rattle: number;
    crashIn: number;
    throwIn: number;
    talk: string;
    talkT: number;

    obstacles: Obs[];
    nextZ: number;
    obsId: number;
    shots: Shot[];
    shotId: number;

    weapons: Record<string, Weapon>;
    ammo: Record<string, number>;
    cool: number;

    shake: number;
    sparks: Spark[];
    introT: number;
    flash: string;
    flashT: number;

    outcome: RaceOutcome | null;
    endT: number;
    wipe: number;

    hits: number;
    airs: number;
    cleanLandings: number;
    /** Total m/s handed back by ramp landings — the longboard's other payoff. */
    rampGain: number;
    thiefHits: number;
    thrown: number;
}

export interface RaceInput {
    left: boolean;
    right: boolean;
    /** Held: B or down. */
    tuck: boolean;
    /** Edge-triggered: up. */
    ollie: boolean;
    /** Edge-triggered: A. */
    fire: boolean;
    weapon: string;
}

export const NO_INPUT: RaceInput = { left: false, right: false, tuck: false, ollie: false, fire: false, weapon: '' };

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Deterministic LCG kept on the state, so a scripted run replays exactly. */
const rnd = (s: RaceState) => {
    s.seed = (s.seed * 1664525 + 1013904223) >>> 0;
    return s.seed / 4294967296;
};
const pick = <T,>(s: RaceState, arr: readonly T[]) => arr[Math.floor(rnd(s) * arr.length) % arr.length];

export function createRaceState(opts: {
    hasBoard: boolean;
    energy?: number;
    weapons?: Weapon[];
    seed?: number;
}): RaceState {
    const rig = opts.hasBoard ? BOARD : TROLLEY;
    // Energy is a small tax rather than a wall: dead legs cost you ~10% of your
    // ceiling, which is enough to feel and not enough to make the run pointless.
    const fitness = 0.9 + 0.1 * clamp((opts.energy ?? 100) / 100, 0, 1);
    const weapons: Record<string, Weapon> = {};
    const ammo: Record<string, number> = {};
    const list = opts.weapons && opts.weapons.length ? opts.weapons : [POCKET];
    for (const w of list) {
        weapons[w.id] = w;
        if (w.uses !== undefined) ammo[w.id] = w.uses;
    }

    const s: RaceState = {
        rig, hasBoard: opts.hasBoard, fitness,
        seed: (opts.seed ?? 0x5eed) >>> 0,
        t: 0, z: 0, speed: 17, topSpeed: 17, laneF: 1.5,
        // Quadratic drag tuned so the rig's stated cruise / tuck speeds are its
        // actual terminal velocities. Tucking raises the ceiling by lowering
        // drag, so the gain is a real physics change and not a bolt-on bonus.
        drag: HILL_ACCEL / Math.pow(rig.cruise * fitness, 2),
        dragTuck: (HILL_ACCEL * TUCK_GAIN) / Math.pow(rig.tuckTop * fitness, 2),
        tucking: false, wob: 0,
        health: 100, gap: START_GAP,
        airT: 0, airDur: 0.5, airH: 0, airBig: false, airFromRamp: false,
        invT: 0, oilT: 0,
        thiefLane: 1.5, thiefSpeed: THIEF_BASE, pace: THIEF_BASE, thiefStun: 0, thiefSlow: 0,
        thiefGuard: 0, crashT: 0, rattle: 0, crashIn: 3.2, throwIn: 6,
        talk: opts.hasBoard ? 'Nah, not the skateboard kid!' : 'You on a TROLLEY? Blood, please.',
        talkT: 3.4,
        obstacles: [], nextZ: 40, obsId: 0, shots: [], shotId: 0,
        weapons, ammo, cool: 0,
        shake: 0, sparks: [], introT: 2.6, flash: '', flashT: 0,
        outcome: null, endT: 0, wipe: 0,
        hits: 0, airs: 0, cleanLandings: 0, rampGain: 0, thiefHits: 0, thrown: 0,
    };
    fillStreet(s);
    return s;
}

/** The first weapon in the rail, so the component and the sim agree on a default. */
export const defaultWeaponId = (s: RaceState) => Object.keys(s.weapons)[0] ?? '';

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
function spawnObstacle(s: RaceState, def: ObsDef, z: number, lane: number) {
    s.obstacles.push({
        id: s.obsId++, def, z, lane,
        dir: rnd(s) < 0.5 ? -1 : 1, done: false, hit: false, phase: rnd(s) * 6.28,
    });
}

function fillStreet(s: RaceState) {
    while (s.nextZ < s.z + SPAWN_AHEAD) {
        let roll = rnd(s) * OBS_TOTAL;
        let def = OBS[0];
        for (const o of OBS) { roll -= o.weight; if (roll <= 0) { def = o; break; } }

        const lane = Math.floor(rnd(s) * LANES);
        spawnObstacle(s, def, s.nextZ, def.wide > 1 ? clamp(lane, 1, LANES - 2) : lane);

        // A second obstacle two lanes away sometimes, so you have to actually
        // pick a line. Never enough to seal the street — one lane is always open.
        if (def.wide <= 1 && rnd(s) < 0.34) {
            const far = lane <= 1 ? lane + 2 + Math.floor(rnd(s) * (LANES - lane - 2)) : lane - 2 - Math.floor(rnd(s) * (lane - 1));
            let roll2 = rnd(s) * OBS_TOTAL;
            let def2 = OBS[0];
            for (const o of OBS) { roll2 -= o.weight; if (roll2 <= 0) { def2 = o; break; } }
            if (def2.wide <= 1) spawnObstacle(s, def2, s.nextZ + (rnd(s) - 0.5) * 3, clamp(far, 0, LANES - 1));
        }

        // The street tightens as the hill gets steeper.
        const squeeze = Math.min(11, s.t * 0.16);
        s.nextZ += 27 - squeeze + rnd(s) * 26;
    }
}

const overlaps = (s: RaceState, o: Obs) =>
    Math.abs(o.z - s.z) < o.def.len + 1.1 && Math.abs(o.lane - s.laneF) < o.def.wide + 0.22;

/** Anything currently underneath the player, cleared or not. */
function under(s: RaceState): Obs | null {
    for (const o of s.obstacles) if (!o.def.ramp && !o.def.oil && overlaps(s, o)) return o;
    return null;
}

function addSpark(s: RaceState, x: number, y: number, ch: string) {
    if (s.sparks.length > 26) return;
    s.sparks.push({ x, y, vx: -40 - rnd(s) * 70, vy: -30 - rnd(s) * 60, life: 0.5 + rnd(s) * 0.4, ch });
}

function crash(s: RaceState, o: Obs) {
    if (s.invT > 0) return;
    o.hit = true;
    s.invT = 0.75;
    s.hits++;
    // Low street furniture is a plough job for a trolley and a non-event for a
    // board that ollied it; a parked Camry is a wall for both.
    const low = o.def.clear !== 'none';
    s.speed *= clamp(o.def.keep + s.rig.hitKeep + (low ? s.rig.plough : 0), 0.2, 0.97);
    s.health -= o.def.dmg * s.rig.hitDmg * (low ? s.rig.ploughDmg : 1);
    // An impact also knocks your line out, which is how a bad hit snowballs
    // into a second one.
    s.laneF = clamp(s.laneF + (rnd(s) < 0.5 ? -0.35 : 0.35), 0, LANES - 1);
    s.shake = Math.min(9, 4 + o.def.dmg * 0.3);
    s.flash = o.def.label;
    s.flashT = 0.9;
    s.airT = 0;
    s.airH = 0;
    addSpark(s, PLAYER_X + 8, laneY(s.laneF) - 8, '💢');
}

function land(s: RaceState) {
    s.airT = 0;
    s.airH = 0;
    const blocker = under(s);
    if (blocker && !blocker.done) {
        blocker.done = true;
        crash(s, blocker);
        return;
    }
    if (s.airFromRamp) {
        // Landing clean off a ramp is the biggest free speed in the game and
        // most of why the longboard wins. Note the wobble check: come into the
        // ramp flat out and you land sketchy and get a third of it, so ramps
        // are a reason to come *out* of the tuck.
        const clean = s.wob < 0.6;
        const gain = s.rig.rampBoost * (clean ? 1 : 0.35);
        s.speed += gain;
        s.rampGain += gain;
        if (clean) s.cleanLandings++;
        // A trolley does not land. It arrives. The axles take it every time.
        if (!s.rig.canOllie) {
            s.health -= 4;
            s.shake = Math.max(s.shake, 4);
            s.flash = 'the trolley bottoms out';
        } else {
            s.flash = clean ? 'CLEAN LANDING' : 'sketchy landing';
        }
        s.flashT = 0.8;
        addSpark(s, PLAYER_X, laneY(s.laneF), '💨');
    }
    s.airFromRamp = false;
}

function launch(s: RaceState, dur: number, big: boolean, fromRamp: boolean) {
    s.airT = dur;
    s.airDur = dur;
    s.airBig = big;
    s.airFromRamp = fromRamp;
    s.airs++;
}

function hitThief(s: RaceState, w: Weapon) {
    s.thiefHits++;
    s.rattle = Math.min(100, s.rattle + w.damage * 0.8);
    // Stun scales with damage: the chancla folds him, a hot bureka just annoys.
    // `thiefGuard` is the anti-stun-lock rule — he is already staggered, so a
    // second hit inside the window adds rattle and slow but no fresh stagger.
    // Without it, a fast weapon simply freezes him and there is no race.
    if (s.thiefGuard <= 0) {
        s.thiefStun = Math.max(s.thiefStun, 0.25 + w.damage * 0.008);
        s.thiefGuard = 2.2;
    }
    if (w.slows) s.thiefSlow = Math.max(s.thiefSlow, 2.6);
    // A rattled driver clips the next bin sooner. Chip damage compounds.
    s.crashIn = Math.min(s.crashIn, 0.9 + rnd(s) * 0.9);
    s.talk = pick(s, TALK_HIT);
    s.talkT = 1.6;
    const tx = clamp(PLAYER_X + s.gap * GAP_PX, PLAYER_X + 14, 302);
    addSpark(s, tx, laneY(s.thiefLane) - 10, w.glyph);
}

function fire(s: RaceState, id: string) {
    const w = s.weapons[id] ?? s.weapons[defaultWeaponId(s)];
    if (!w) return;
    // You own one chancla and one frisbee. Until it comes back, you are
    // empty-handed — which is the only thing stopping a homing weapon with no
    // ammo count from trivialising the whole chase.
    if (w.returns && s.shots.some(sh => sh.wid === w.id)) {
        s.flash = `${w.short.toLowerCase()} still out there`;
        s.flashT = 0.5;
        return;
    }
    const left = s.ammo[w.id];
    if (left !== undefined && left <= 0) {
        s.flash = `out of ${w.short.toLowerCase()}`;
        s.flashT = 0.8;
        return;
    }
    if (left !== undefined) s.ammo[w.id] = left - 1;
    s.cool = w.cooldown;
    s.thrown++;

    // Non-piercing throws get eaten by whatever is parked between you and him.
    // The frisbee is the whole reason `piercing` exists in the registry.
    let stopAt = Infinity;
    if (!w.piercing) {
        for (const o of s.obstacles) {
            const ahead = o.z - s.z;
            if (ahead > 1 && ahead < 16 && Math.abs(o.lane - s.laneF) < o.def.wide + 0.3 && o.def.clear === 'none') {
                // Converted into gap-metres so the bonk lands on the drawn car.
                stopAt = Math.min(stopAt, (ahead * PX_PER_M) / GAP_PX);
            }
        }
    }
    s.shots.push({ id: s.shotId++, wid: w.id, travel: 0, lane: s.laneF, stopAt, back: false, spin: 0 });
}

function stepShots(s: RaceState, dt: number) {
    for (let i = s.shots.length - 1; i >= 0; i--) {
        const sh = s.shots[i];
        const w = s.weapons[sh.wid];
        if (!w) { s.shots.splice(i, 1); continue; }
        const v = (w.speed ?? 180) * PROJ_SCALE;
        sh.spin += dt * 14;

        if (sh.back) {
            // Returning weapons fly home and hand you the use back — that's what
            // makes the chancla and the frisbee effectively unlimited.
            sh.travel -= v * 1.5 * dt;
            if (sh.travel <= 0) {
                if (s.ammo[w.id] !== undefined) s.ammo[w.id] = (s.ammo[w.id] ?? 0) + 1;
                s.shots.splice(i, 1);
            }
            continue;
        }

        sh.travel += v * dt;

        if (sh.travel >= sh.stopAt) {
            addSpark(s, PLAYER_X + sh.travel * GAP_PX, laneY(sh.lane) - 6, '✖');
            if (w.returns) { sh.back = true; sh.travel = sh.stopAt; } else s.shots.splice(i, 1);
            continue;
        }

        if (sh.travel >= s.gap) {
            // `returns && !piercing` is the chancla: ancient guidance system,
            // zero latency, does not need you to pick the right lane.
            const homing = !!w.returns && !w.piercing;
            // A frisbee cuts a line across the street, so it forgives a bad
            // read of his weave; everything else has to be thrown at the lane
            // he'll actually be in by the time it lands.
            const window = w.piercing ? 1.7 : 1.2;
            const onTarget = homing || Math.abs(s.thiefLane - sh.lane) < window;
            if (onTarget) hitThief(s, w);
            if (w.returns) { sh.back = true; sh.travel = s.gap; } else s.shots.splice(i, 1);
        }
    }
}

function stepThief(s: RaceState, dt: number) {
    // He weaves because he cannot steer, not because he's evasive. Two sines of
    // different periods read as "drunk" rather than "patterned".
    s.thiefLane = clamp(1.5 + Math.sin(s.t * 1.2) * 1.35 + Math.sin(s.t * 0.47) * 0.5, 0, LANES - 1);

    // Rolling average rather than instantaneous speed, so he reacts to how the
    // run is going and not to every single carve and pothole.
    s.pace += (s.speed - s.pace) * dt * 0.35;
    const anchor = PACE_W * s.pace + (1 - PACE_W) * THIEF_ABS;
    let ts = clamp(anchor + (START_GAP - s.gap) * RUBBER_K, THIEF_MIN, THIEF_MAX);
    // Rattle is cumulative weapon chip: a battered thief never gets back to pace.
    // Rattle is cumulative chip damage from AM/PM items. It saturates at 100,
    // so twenty chanclas are not twenty times better than five — weapons open
    // the door, they don't win the race on their own.
    ts *= 1 - s.rattle * 0.0004;
    // He is on a hill, so nothing you throw can stop him — it only scrubs him.
    // His own crashes scrub harder than any weapon, which is the joke.
    if (s.crashT > 0) ts *= 0.75;
    if (s.thiefStun > 0) ts *= 0.88;
    else if (s.thiefSlow > 0) ts *= 0.78;
    s.thiefSpeed = Math.max(4, ts);

    s.thiefStun = Math.max(0, s.thiefStun - dt);
    s.thiefSlow = Math.max(0, s.thiefSlow - dt);
    s.thiefGuard = Math.max(0, s.thiefGuard - dt);
    s.crashT = Math.max(0, s.crashT - dt);

    // He hits things. Constantly. It is the only reason he is catchable.
    s.crashIn -= dt;
    if (s.crashIn <= 0) {
        s.crashT = Math.max(s.crashT, 0.65 + rnd(s) * 0.35);
        s.talk = pick(s, TALK_CRASH);
        s.talkT = 1.5;
        const tx = clamp(PLAYER_X + s.gap * GAP_PX, PLAYER_X + 14, 302);
        addSpark(s, tx, laneY(s.thiefLane) - 6, '🗑️');
        s.crashIn = (3.6 + rnd(s) * 3.6) * (1 - s.rattle / 400);
    }

    // And he throws his own garbage back at you, which becomes your problem.
    s.throwIn -= dt;
    if (s.throwIn <= 0) {
        spawnObstacle(s, JUNK, s.z + 48 + rnd(s) * 14, Math.round(s.thiefLane));
        s.talk = 'CATCH, blood!';
        s.talkT = 1.2;
        s.throwIn = 5 + rnd(s) * 4.5;
    }

    s.talkT -= dt;
    if (s.talkT <= 0) {
        s.talk = pick(s, TALK);
        s.talkT = 2.2 + rnd(s) * 2.4;
    }
}

function finish(s: RaceState, outcome: RaceOutcome) {
    s.outcome = outcome;
    s.endT = 1.7;
    s.shake = outcome === 'wipeout' ? 10 : 6;
    if (outcome === 'caught') { s.talk = pick(s, TALK_WIN); s.talkT = 4; }
}

/**
 * One fixed 1/60s step. Mutates `s`; returns nothing. Pure apart from the LCG
 * it carries, which is the point — a script can drive thousands of these.
 */
export function stepRace(s: RaceState, inp: RaceInput, dt: number): void {
    // Post-race: keep the wipeout / banner animation ticking, freeze the race.
    if (s.outcome) {
        s.endT = Math.max(0, s.endT - dt);
        s.wipe += dt;
        s.shake = Math.max(0, s.shake - dt * 22);
        stepSparks(s, dt);
        return;
    }

    s.t += dt;
    s.introT = Math.max(0, s.introT - dt);
    s.cool = Math.max(0, s.cool - dt);
    s.invT = Math.max(0, s.invT - dt);
    s.oilT = Math.max(0, s.oilT - dt);
    s.flashT = Math.max(0, s.flashT - dt);

    // --- momentum ---------------------------------------------------------
    // The hill accelerates you every single frame. Quadratic drag is what sets
    // the ceiling, so the tuck (less drag, more lean) genuinely raises top
    // speed rather than adding a flat bonus. There are no brakes on a stolen
    // trolley: carving, crashing and standing up are the only ways to slow.
    const tuck = inp.tuck && s.oilT <= 0 && s.airT <= 0;
    s.tucking = tuck;
    const pull = HILL_ACCEL * (tuck ? TUCK_GAIN : 1);
    const drag = tuck ? s.dragTuck : s.drag;
    s.speed += (pull - drag * s.speed * s.speed) * dt;
    s.speed = Math.max(3, s.speed);
    if (s.speed > s.topSpeed) s.topSpeed = s.speed;

    // --- handling ---------------------------------------------------------
    // Wobble is the risk side of the tuck: past the rig's threshold the thing
    // shimmies, steering goes soft and the deck starts choosing lanes for you.
    s.wob = clamp((s.speed - s.rig.wobbleAt * s.fitness) / 12, 0, 1);
    let steer = s.rig.steer * s.fitness;
    if (tuck) steer *= 0.42;                 // the trade-off, in one number
    steer *= 1 - s.wob * 0.45;
    if (s.oilT > 0) steer *= 0.18;           // oil = no steering at all
    if (s.airT > 0) steer *= 0.55;

    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir !== 0) {
        s.laneF += dir * steer * dt;
        if (s.airT <= 0) s.speed -= s.rig.carve * dt * (tuck ? 1.5 : 1);
    }
    if (s.wob > 0) s.laneF += (rnd(s) - 0.5) * s.wob * 3.6 * dt;
    s.laneF = clamp(s.laneF, 0, LANES - 1);

    // --- ollie ------------------------------------------------------------
    // The loudest half of the longboard branch. With a deck, `up` is a real
    // ollie that clears most street furniture and doubles your ramp airtime.
    // With a trolley, `up` is a man lifting a trolley by the handle: it clears
    // an oil slick, costs you speed, and is mostly there to be funny.
    if (inp.ollie && s.airT <= 0) {
        if (s.rig.canOllie) {
            launch(s, 0.55, true, false);
            s.speed -= 0.7;
            s.flash = 'OLLIE';
            s.flashT = 0.5;
        } else {
            launch(s, 0.2, false, false);
            s.speed -= 2.6;
            s.flash = 'trolleys do not jump';
            s.flashT = 0.9;
        }
    }
    if (s.airT > 0) {
        s.airT -= dt;
        const p = 1 - clamp(s.airT / s.airDur, 0, 1);
        s.airH = Math.sin(p * Math.PI) * (s.airBig ? 15 : 5);
        if (s.airT <= 0) land(s);
    }

    // --- weapons ----------------------------------------------------------
    if (inp.fire && s.cool <= 0) fire(s, inp.weapon || defaultWeaponId(s));
    stepShots(s, dt);

    // --- the street -------------------------------------------------------
    s.z += s.speed * dt;
    fillStreet(s);

    for (let i = s.obstacles.length - 1; i >= 0; i--) {
        const o = s.obstacles[i];
        if (o.z < s.z - 20) { s.obstacles.splice(i, 1); continue; }
        if (o.def.drift) {
            o.lane += o.dir * o.def.drift * dt;
            if (o.lane < 0 || o.lane > LANES - 1) { o.dir *= -1; o.lane = clamp(o.lane, 0, LANES - 1); }
        }
        if (o.done || !overlaps(s, o)) continue;

        if (o.def.ramp) {
            o.done = true;
            o.hit = true;
            // Everyone gets air off a ramp; only a board gets *useful* air.
            launch(s, s.rig.canOllie ? 0.78 : 0.42, s.rig.canOllie, true);
            s.flash = 'AIR';
            s.flashT = 0.6;
            continue;
        }
        if (o.def.oil) {
            if (s.airT > 0) continue;        // hop it and you're fine
            o.done = true;
            s.oilT = 1.1;
            s.speed *= 0.92;
            s.flash = 'OIL — no steering';
            s.flashT = 1;
            continue;
        }
        // Airborne clears: a hop gets over low stuff, an ollie gets over the
        // rest, and nothing gets you over a parked Camry.
        if (s.airT > 0 && (o.def.clear === 'hop' || (o.def.clear === 'ollie' && s.airBig))) {
            o.done = true;
            o.hit = true;
            continue;
        }
        o.done = true;
        crash(s, o);
    }

    // --- him --------------------------------------------------------------
    stepThief(s, dt);
    s.gap += (s.thiefSpeed - s.speed) * dt;

    stepSparks(s, dt);
    s.shake = Math.max(0, s.shake - dt * 26);

    // --- endings ----------------------------------------------------------
    if (s.gap <= 0) finish(s, 'caught');
    else if (s.gap >= LOSE_GAP) finish(s, 'lost');
    else if (s.health <= 0) { s.health = 0; finish(s, 'wipeout'); }
    else if (s.z >= HILL_LENGTH) finish(s, 'flat');
}

function stepSparks(s: RaceState, dt: number) {
    for (let i = s.sparks.length - 1; i >= 0; i--) {
        const p = s.sparks[i];
        p.life -= dt;
        if (p.life <= 0) { s.sparks.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 180 * dt;
    }
}

// ---------------------------------------------------------------------------
// Rendering. Nothing here mutates the simulation.
// ---------------------------------------------------------------------------
const SKY = ['#10203a', '#1b3357', '#2f4a6e', '#4a6483'];
const TILT = 0.055;   // radians. The road slopes away to the right: downhill.

const drawTrolley = (ctx: Ctx, x: number, y: number, sc: number, main: string, roll: number) => {
    const w = 18 * sc, h = 10 * sc;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(roll);
    rect(ctx, -w / 2, -h - 3 * sc, w, h, main);
    // Wire mesh, because it's a trolley and that's the only thing that sells it.
    for (let i = 1; i < 4; i++) line(ctx, -w / 2 + (w / 4) * i, -h - 3 * sc, -w / 2 + (w / 4) * i, -3 * sc, PAL.line);
    line(ctx, -w / 2, -h / 2 - 3 * sc, w / 2, -h / 2 - 3 * sc, PAL.line);
    outline(ctx, -w / 2, -h - 3 * sc, w, h, PAL.faint);
    rect(ctx, w / 2 - 1, -h - 9 * sc, 2 * sc, 7 * sc, PAL.faint);   // handle
    circle(ctx, -w / 2 + 3 * sc, -1.5 * sc, 2 * sc, PAL.black);
    circle(ctx, w / 2 - 3 * sc, -1.5 * sc, 2 * sc, PAL.black);
    ctx.restore();
};

const drawBoard = (ctx: Ctx, x: number, y: number, sc: number, roll: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(roll);
    rect(ctx, -11 * sc, -3 * sc, 22 * sc, 2.4 * sc, PAL.violet);
    rect(ctx, -11 * sc, -3 * sc, 22 * sc, 0.8 * sc, PAL.accent);
    circle(ctx, -7 * sc, -0.6 * sc, 1.7 * sc, PAL.legend);
    circle(ctx, 7 * sc, -0.6 * sc, 1.7 * sc, PAL.legend);
    ctx.restore();
};

const drawObstacle = (ctx: Ctx, o: Obs, x: number, y: number, sc: number, t: number) => {
    const d = o.def;
    if (d.ramp) {
        // Plywood wedge, drawn rather than glyphed so it reads as a ramp.
        ctx.fillStyle = o.hit ? PAL.legend : '#8a5a2b';
        ctx.beginPath();
        ctx.moveTo(x - 9 * sc, y);
        ctx.lineTo(x + 9 * sc, y);
        ctx.lineTo(x + 9 * sc, y - 9 * sc);
        ctx.closePath();
        ctx.fill();
        line(ctx, x - 9 * sc, y, x + 9 * sc, y - 9 * sc, PAL.warn);
        return;
    }
    if (d.oil) {
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#1b1024';
        ctx.beginPath();
        ctx.ellipse(x, y - 1, 13 * sc, 4 * sc, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        glyph(ctx, '🛢️', x + 10 * sc, y - 5 * sc, 8 * sc);
        return;
    }
    if (d.kind === 'car') {
        shadow(ctx, x, y, 13 * sc, 4 * sc, 0.4);
        rect(ctx, x - 12 * sc, y - 9 * sc, 24 * sc, 7 * sc, '#7b2f3a');
        rect(ctx, x - 7 * sc, y - 13 * sc, 13 * sc, 4.5 * sc, '#9c4250');
        rect(ctx, x - 5 * sc, y - 12 * sc, 9 * sc, 3 * sc, '#22303f');
        circle(ctx, x - 7 * sc, y - 1.5 * sc, 2.4 * sc, PAL.black);
        circle(ctx, x + 7 * sc, y - 1.5 * sc, 2.4 * sc, PAL.black);
        return;
    }
    if (d.kind === 'door') {
        // Swings open right as you arrive. Every time.
        rect(ctx, x - 10 * sc, y - 8 * sc, 20 * sc, 6 * sc, '#2f4a6e');
        const swing = o.hit ? 1 : clamp(Math.sin(t * 2 + o.phase) * 0.5 + 0.7, 0, 1);
        ctx.save();
        ctx.translate(x - 8 * sc, y - 8 * sc);
        ctx.rotate(-swing * 0.9);
        rect(ctx, 0, -9 * sc, 3 * sc, 9 * sc, '#d8dde3');
        ctx.restore();
        glyph(ctx, '🚪', x + 2 * sc, y - 12 * sc, 7 * sc, 0, 0.9);
        return;
    }
    if (d.kind === 'bay') {
        outline(ctx, x - 14 * sc, y - 14 * sc, 28 * sc, 14 * sc, PAL.warn, 1);
        for (let i = 0; i < 3; i++) drawTrolley(ctx, x - 8 * sc + i * 7 * sc, y - 2 * sc, sc * 0.7, PAL.dim, 0);
        text(ctx, 'AM/PM', x, y - 18 * sc, { size: 5, color: PAL.warn, align: 'center' });
        return;
    }
    shadow(ctx, x, y, 6 * sc, 2.4 * sc, 0.35);
    const bob = d.drift ? Math.sin(t * 6 + o.phase) * 1.4 : 0;
    glyph(ctx, d.glyph, x, y - 7 * sc + bob, 13 * sc, o.hit ? 1.2 : 0);
};

export function drawRace(ctx: Ctx, s: RaceState, thiefName: string) {
    const [sx, sy] = shakeOffset(s.shake);

    // --- sky (barely moves) ----------------------------------------------
    clear(ctx, W, H, SKY[0]);
    for (let i = 0; i < SKY.length; i++) rect(ctx, 0, i * 26, W, 27, SKY[i]);
    circle(ctx, 268, 26, 12, '#ffb347');
    circle(ctx, 268, 26, 18, 'rgba(255,179,71,0.12)');

    // Far ridge, then the skyline, then palms: three speeds of parallax.
    band(ctx, 74, 12, W, s.z * 0.9, 90, PAL.panel, (c, x, y) => {
        rect(c, x, y, 60, 14, '#243a55');
        rect(c, x + 44, y - 6, 26, 20, '#1d3049');
    });
    band(ctx, 62, 40, W, s.z * 2.6, 54, PAL.panel, (c, x, y) => {
        rect(c, x, y + 6, 20, 36, '#16202e');
        rect(c, x + 24, y - 4, 14, 46, '#101923');
        rect(c, x + 41, y + 12, 11, 30, '#18222f');
        for (let wy = 0; wy < 4; wy++) rect(c, x + 3, y + 10 + wy * 7, 3, 3, wy % 2 ? '#2a3a4d' : PAL.warn);
    });
    band(ctx, 60, 40, W, s.z * 4.4, 88, PAL.panel, (c, x, y) => {
        rect(c, x + 6, y + 8, 2, 34, '#2a3a2a');
        glyph(c, '🌴', x + 7, y + 6, 15);
    });

    // --- the hill ---------------------------------------------------------
    ctx.save();
    ctx.translate(sx, sy);
    ctx.translate(W / 2, ROAD_TOP);
    ctx.rotate(TILT);
    ctx.translate(-W / 2, -ROAD_TOP);

    rect(ctx, -50, ROAD_TOP - 8, W + 100, 8, '#3b3f34');                  // verge
    band(ctx, ROAD_TOP - 8, 8, W + 60, s.z * PX_PER_M, 34, PAL.line, (c, x, y) => {
        rect(c, x - 30, y - 2, 3, 10, PAL.faint);
        glyph(c, '🗑️', x - 12, y + 1, 8, 0, 0.85);
    });
    rect(ctx, -50, ROAD_TOP, W + 100, H + 50 - ROAD_TOP, '#20242b');      // asphalt
    rect(ctx, -50, ROAD_TOP, W + 100, 2, '#2e343d');                      // kerb lip

    // Lane markings. Scrolling these at the real speed is most of the
    // sensation of speed at low velocity.
    for (let l = 1; l < LANES; l++) {
        const y = laneY(l) - LANE_H / 2;
        band(ctx, y, 2, W + 60, s.z * PX_PER_M, 26, PAL.faint, (c, x, yy) => {
            rect(c, x - 30, yy, 12, 1.6, '#4a535e');
        });
    }
    band(ctx, H - 4, 4, W + 60, s.z * PX_PER_M, 40, PAL.faint, (c, x, y) => {
        rect(c, x - 30, y, 20, 3, '#39414b');
    });

    // --- obstacles (far lanes first so nearer things overlap them) --------
    const sorted = s.obstacles.slice().sort((a, b) => a.lane - b.lane);
    for (const o of sorted) {
        const x = PLAYER_X + (o.z - s.z) * PX_PER_M;
        if (x < -40 || x > W + 46) continue;
        drawObstacle(ctx, o, x, laneY(o.lane), laneScale(o.lane), s.t);
    }

    // --- him --------------------------------------------------------------
    const tx = clamp(PLAYER_X + s.gap * GAP_PX, PLAYER_X + 14, 302);
    const ty = laneY(s.thiefLane);
    const tsc = laneScale(s.thiefLane);
    const rattled = s.thiefStun > 0 || s.crashT > 0;
    const lurch = Math.sin(s.t * 7) * 0.09 + (rattled ? Math.sin(s.t * 30) * 0.22 : 0);
    drawTrolley(ctx, tx, ty, tsc * 1.05, '#6b3340', lurch);
    figure(ctx, tx - 2 * tsc, ty - 7 * tsc, 25 * tsc, {
        kit: KIT.rival, facing: 1,
        stride: s.t * 2,
        armUp: rattled ? 1 : 0.35,
        crouch: s.crashT > 0,
        hurt: s.thiefStun > 0.35 || s.crashT > 0.35,
    });
    glyph(ctx, '📦', tx - 8 * tsc, ty - 26 * tsc, 9 * tsc, Math.sin(s.t * 5) * 0.3);

    // --- you --------------------------------------------------------------
    const py = laneY(s.laneF);
    const psc = laneScale(s.laneF);
    const wipe = s.outcome === 'wipeout' ? Math.min(1.6, s.wipe * 2.4) : 0;
    ctx.save();
    if (wipe > 0) {
        ctx.translate(PLAYER_X, py);
        ctx.rotate(wipe * 1.5);
        ctx.translate(-PLAYER_X, -py);
    }
    if (s.airH > 1) shadow(ctx, PLAYER_X, py + 1, 9 * psc, 3 * psc, 0.3);
    const ry = py - s.airH;
    const roll = s.wob * Math.sin(s.t * 26) * 0.07;
    if (s.hasBoard) drawBoard(ctx, PLAYER_X, ry, psc, roll);
    else drawTrolley(ctx, PLAYER_X, ry, psc, '#3d4a58', roll);
    figure(ctx, PLAYER_X, ry - (s.hasBoard ? 3 : 7) * psc, 26 * psc, {
        kit: KIT.player, facing: 1,
        stride: s.t * 2.4,
        armUp: s.cool > 0.2 ? 1 : 0,
        crouch: s.tucking,
        hurt: s.invT > 0.45,
    });
    ctx.restore();

    // --- projectiles ------------------------------------------------------
    for (const sh of s.shots) {
        const w = s.weapons[sh.wid];
        if (!w) continue;
        const x = PLAYER_X + sh.travel * GAP_PX;
        const arc = Math.sin(clamp(sh.travel / Math.max(1, s.gap), 0, 1) * Math.PI) * 12;
        glyph(ctx, w.glyph, x, laneY(sh.lane) - 10 - arc, 9, sh.spin * (sh.back ? -1 : 1));
    }

    for (const p of s.sparks) glyph(ctx, p.ch, p.x, p.y, 9, 0, clamp(p.life * 2, 0, 1));
    ctx.restore();

    // --- speed lines ------------------------------------------------------
    if (s.wob > 0.05 || s.speed > s.rig.cruise * 0.8) {
        const n = Math.round(3 + s.wob * 9);
        ctx.save();
        ctx.globalAlpha = 0.25 + s.wob * 0.45;
        for (let i = 0; i < n; i++) {
            const y = ROAD_TOP + ((s.t * 400 + i * 137) % (H - ROAD_TOP));
            const len = 20 + ((i * 53) % 60);
            line(ctx, 0, y, len, y, PAL.ink, 1);
        }
        ctx.restore();
    }

    // --- his mouth --------------------------------------------------------
    if (s.talkT > 0 && s.talk) {
        const bx = clamp(tx, 46, W - 46);
        const by = ty - 38;
        const tw = Math.min(150, s.talk.length * 4.4 + 8);
        rect(ctx, bx - tw / 2, by - 6, tw, 12, 'rgba(4,6,10,0.85)');
        outline(ctx, bx - tw / 2, by - 6, tw, 12, PAL.accent2);
        text(ctx, s.talk, bx, by - 3, { size: 6, color: PAL.accent2, align: 'center' });
    }

    // --- HUD --------------------------------------------------------------
    rect(ctx, 0, 0, W, 22, 'rgba(4,6,10,0.72)');

    // The gap meter is the whole game, so it gets the width.
    text(ctx, 'GAP', 5, 3, { size: 6, color: PAL.dim });
    const gp = 1 - clamp(s.gap / LOSE_GAP, 0, 1);
    bar(ctx, 25, 3, 120, 6, gp, s.gap < 40 ? PAL.ok : s.gap > 180 ? PAL.bad : PAL.accent);
    line(ctx, 25 + 120 * (1 - START_GAP / LOSE_GAP), 2, 25 + 120 * (1 - START_GAP / LOSE_GAP), 10, PAL.faint);
    text(ctx, `${Math.round(s.gap)}m`, 148, 3, { size: 6, color: PAL.ink });

    text(ctx, 'HILL', 5, 12, { size: 6, color: PAL.dim });
    bar(ctx, 25, 12, 120, 4, clamp(s.z / HILL_LENGTH, 0, 1), PAL.warn);
    text(ctx, `${Math.max(0, Math.round((HILL_LENGTH - s.z)))}m`, 148, 12, { size: 6, color: PAL.dim });

    // Rig readout — you should never have to guess what you're riding.
    glyph(ctx, s.rig.glyph, 188, 7, 10);
    text(ctx, s.rig.label.toUpperCase(), 196, 3, { size: 6, color: s.hasBoard ? PAL.accent : PAL.warn });
    text(ctx, `${Math.round(s.speed * 2.2)} MPH${s.tucking ? '  TUCK' : ''}`, 196, 12, {
        size: 6, color: s.wob > 0.6 ? PAL.bad : PAL.dim,
    });

    bar(ctx, W - 42, 3, 38, 5, s.health / 100, s.health > 35 ? PAL.ok : PAL.bad);
    text(ctx, `HP ${Math.max(0, Math.round(s.health))}`, W - 42, 12, { size: 6, color: PAL.dim });

    if (s.wob > 0.55) text(ctx, 'SPEED WOBBLE', W / 2, 26, { size: 7, color: PAL.bad, align: 'center' });
    if (s.flashT > 0) text(ctx, s.flash.toUpperCase(), W / 2, H - 12, { size: 7, color: PAL.legend, align: 'center' });

    // --- banners ----------------------------------------------------------
    if (s.introT > 0) {
        const a = clamp(s.introT / 0.6, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        banner(ctx, s.hasBoard ? 'LONGBOARD' : 'NO BOARD', W, 62, s.hasBoard ? PAL.accent : PAL.warn, 22);
        text(ctx, s.rig.note, W / 2, 80, { size: 7, color: PAL.ink, align: 'center' });
        text(ctx, `${thiefName} has your box. Get it back.`, W / 2, 90, { size: 6, color: PAL.dim, align: 'center' });
        ctx.restore();
    }
    if (s.outcome === 'caught') banner(ctx, 'CAUGHT HIM!', W, 64, PAL.ok, 26);
    if (s.outcome === 'lost') banner(ctx, "HE'S GONE", W, 64, PAL.bad, 26);
    if (s.outcome === 'flat') banner(ctx, 'OUT OF HILL', W, 64, PAL.bad, 24);
    if (s.outcome === 'wipeout') {
        banner(ctx, 'WIPEOUT', W, 64, PAL.bad, 26);
        glyph(ctx, '💥', PLAYER_X + 6, laneY(s.laneF) - 10, 22);
    }
}

// ---------------------------------------------------------------------------
// Result copy
// ---------------------------------------------------------------------------
const RESULTS: Record<RaceOutcome, { headline: string; detail: (t: string, board: boolean) => string }> = {
    caught: {
        headline: 'Box Recovered',
        detail: (t, board) => board
            ? `You carve in front of the trolley at the bottom of the hill. ${t} hands the box over, wheezing, and asks if the longboard is for sale.`
            : `Two trolleys, one hill, and you had the better wheel. ${t} hands the box back and calls it "a collab".`,
    },
    lost: {
        headline: 'He Got Away',
        detail: (t, board) => board
            ? `${t} makes the turn at the bottom and vanishes. You hear "respect the grind" echoing off a parking structure.`
            : `The trolley tops out at a brisk jog. ${t} is a rumour by the third block.`,
    },
    wipeout: {
        headline: 'Wipeout',
        detail: t => `You meet a parked Camry at speed. ${t} does not look back. Somebody films you. Of course they do.`,
    },
    flat: {
        headline: 'Out Of Hill',
        detail: t => `The road flattens out and so does your speed. ${t} keeps rolling, still yelling about a mixtape called DOWNHILL.`,
    },
};

interface Hud {
    gap: number; speed: number; health: number; hill: number; wob: number;
    ammo: Record<string, number>;
}
const readHud = (s: RaceState): Hud => ({
    gap: Math.round(s.gap),
    speed: Math.round(s.speed * 2.2),
    health: Math.max(0, Math.round(s.health)),
    hill: Math.round(clamp(s.z / HILL_LENGTH, 0, 1) * 100),
    wob: s.wob,
    ammo: { ...s.ammo },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const CartRace: React.FC<{
    thief?: string;
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ thief = 'The Game', onFinish, onQuit }) => {
    const { gameState } = useGame();
    const { player } = gameState;

    const hasBoard = useMemo(() => hasWeapon(player, 'itm-longboard'), [player]);
    const arms = useMemo(() => {
        const a = armsFor(player, 'cart-race');
        return a.length ? a : [POCKET];
    }, [player]);

    const [sel, setSel] = useState(arms[0].id);
    const selRef = useRef(sel);
    selRef.current = sel;

    const { input, set, consume } = useInput(true);

    // The entire simulation lives in a ref. Nothing in here may become React
    // state: this object is mutated 60 times a second.
    const raceRef = useRef<RaceState | null>(null);
    if (!raceRef.current) {
        raceRef.current = createRaceState({
            hasBoard,
            energy: player.energy,
            weapons: arms,
            seed: (Date.now() ^ 0x9e3779b9) >>> 0,
        });
    }

    const [hud, setHud] = useState<Hud>(() => readHud(raceRef.current!));
    const [done, setDone] = useState<RaceOutcome | null>(null);
    const doneRef = useRef(false);
    const finishedRef = useRef(false);
    const hudClock = useRef(0);

    const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
        const s = raceRef.current!;
        const i = input.current;

        // Tuck is held (B or down); ollie and throw are edge-triggered so a held
        // finger on a phone doesn't machine-gun the weapon rail.
        stepRace(s, {
            left: i.left,
            right: i.right,
            tuck: i.b || i.down,
            ollie: consume('up'),
            fire: consume('a'),
            weapon: selRef.current,
        }, dt);

        drawRace(ctx, s, thief);

        // HUD is the only thing crossing back into React, at ~7Hz.
        hudClock.current += dt;
        if (hudClock.current >= 0.14) {
            hudClock.current = 0;
            setHud(readHud(s));
        }

        if (s.outcome && s.endT <= 0 && !doneRef.current) {
            doneRef.current = true;
            setDone(s.outcome);
        }
    }, [input, consume, thief]);

    const s = raceRef.current;
    const won = done === 'caught';

    const close = () => {
        if (finishedRef.current) return;   // onFinish fires exactly once
        finishedRef.current = true;
        const bits: string[] = [];
        if (s.thiefHits) bits.push(`${s.thiefHits} hit${s.thiefHits === 1 ? '' : 's'} landed`);
        if (s.cleanLandings) bits.push(`${s.cleanLandings} clean landing${s.cleanLandings === 1 ? '' : 's'}`);
        if (s.hits) bits.push(`${s.hits} crash${s.hits === 1 ? '' : 'es'}`);
        const tail = bits.length ? ` (${bits.join(', ')})` : '';
        onFinish(
            won,
            won
                ? `You ran ${thief} down on a ${hasBoard ? 'longboard' : 'shopping trolley'}${tail}.`
                : `${thief} escaped downhill with your box${tail}.`,
        );
    };

    const selWeapon = arms.find(w => w.id === sel);
    const ammoLeft = selWeapon && selWeapon.uses !== undefined ? hud.ammo[selWeapon.id] ?? 0 : undefined;

    return (
        <ArcadeShell
            title="Cart Race"
            subtitle={`${thief} · downhill · ${hasBoard ? '🛹 Venice Longboard' : '🛒 the other trolley'}`}
            width={W}
            height={H}
            running={done === null}
            onFrame={onFrame}
            onInput={set}
            actions={['Throw', 'Tuck']}
            vertical
            onQuit={onQuit}
            quitLabel="Let Him Go"
            loadout={arms}
            selectedWeapon={sel}
            onSelectWeapon={setSel}
            /* Three short columns so the whole strip still fits at 390px. */
            hud={
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="min-w-0">
                        <div className="flex justify-between gap-1 label mb-1">
                            <span className="truncate">Gap</span>
                            <span className="numeric flex-shrink-0">{hud.gap}m</span>
                        </div>
                        <div className="meter h-2">
                            <i style={{
                                width: `${Math.max(0, 100 - (hud.gap / LOSE_GAP) * 100)}%`,
                                background: hud.gap < 40 ? 'var(--ok)' : hud.gap > 180 ? 'var(--bad)' : 'var(--accent)',
                            }} />
                        </div>
                    </div>
                    <div className="min-w-0">
                        <div className="flex justify-between gap-1 label mb-1">
                            <span className="truncate">Hill</span>
                            <span className="numeric flex-shrink-0">{100 - hud.hill}%</span>
                        </div>
                        <div className="meter h-2"><i style={{ width: `${100 - hud.hill}%`, background: 'var(--warn)' }} /></div>
                    </div>
                    <div className="min-w-0">
                        <div className="flex justify-between gap-1 label mb-1">
                            <span className="truncate">{hud.speed}mph</span>
                            <span className="numeric flex-shrink-0">{hud.health}hp</span>
                        </div>
                        <div className="meter h-2">
                            <i style={{ width: `${hud.health}%`, background: hud.health > 35 ? 'var(--ok)' : 'var(--bad)' }} />
                        </div>
                    </div>
                </div>
            }
            overlay={done !== null ? (
                <MiniGameResult
                    won={won}
                    headline={RESULTS[done].headline}
                    detail={RESULTS[done].detail(thief, hasBoard)}
                    onClose={close}
                    closeLabel={won ? 'Take The Box' : 'Walk Home'}
                />
            ) : undefined}
            help={
                `◀ ▶ steer across four lanes (turning scrubs speed — it is your only brake). `
                + `▼ or TUCK to go faster with worse steering. `
                + (hasBoard
                    ? `▲ ollies bins, cones, dogs and roadworks, and doubles your ramp air — clean landings are free speed. `
                    : `▲ is a man lifting a trolley: it clears an oil slick and nothing else. Weave everything. `)
                + `THROW hurls the selected AM/PM item at him${ammoLeft !== undefined ? ` (${ammoLeft} left)` : ''}. `
                + `Slushie slows him, the chancla homes in and comes back, the frisbee cuts through parked cars, the dog launcher is rapid fire.`
            }
        />
    );
};

export default CartRace;
