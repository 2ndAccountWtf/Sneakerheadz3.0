import React, { useCallback, useMemo, useRef, useState } from 'react';
import { MiniGameResult } from './MiniGameShell';
import { useGame } from '../../hooks/useGame';
import {
    ArcadeShell,
    useInput,
    PAL,
    KIT,
    clear,
    rect,
    outline,
    circle,
    line,
    text,
    actor,
    shakeOffset,
    banner as drawBanner,
} from './engine';
import type { PaletteSwap, SpriteDef } from './engine';
import { bakeSprite, drawSprite, frameAt } from '../../systems/sprites/bake';
import {
    SPR_ITEM_CHANCLA, SPR_ITEM_FRISBEE, SPR_ITEM_SLUSHIE, SPR_ITEM_BUREKA, SPR_ITEM_DOG_LAUNCHER,
} from '../../data/sprites/items';
import { archetypeSprite, lookForSneaker, FALLBACK_LOOK } from '../../data/sprites/sneakers';
import { getWeapon, type Weapon } from '../../systems/weapons';
import { getOpponent, effectiveSkill, challengeLine, lossLine, winLine, type Opponent } from '../../systems/opponents';
import type { Player } from '../../types';

/**
 * ROOFTOP ARTILLERY — QBasic GORILLA.BAS, faithfully, with a shoe in your hand.
 * ========================================================================
 * Two throwers on a procedurally generated skyline. Set an angle and a power,
 * lob a projectile on a gravity arc, wind blows it off course, a direct hit
 * wins the round, buildings take a bite out of themselves wherever anything
 * lands on them. First to three direct hits takes the match. That is the
 * whole game, same as it was on a 1991 monochrome monitor, and it is still
 * the whole game here.
 *
 * ARCHITECTURE — same shape as HoopsGame / DartsGame:
 *  - The entire simulation is a plain object (`World`) in a ref, mutated in
 *    the 60Hz frame callback. React state is only the HUD mirror and the
 *    game-over flag.
 *  - Ballistics, the AI's ranging and the skyline/crater model are all plain
 *    functions on plain numbers with no DOM in them, exported so a headless
 *    Node script can fire thousands of shots through them and check the
 *    physics, the wind, the destruction and the AI convergence directly —
 *    see the comments over each section for what it means and why.
 */

/* ==================================================================== *
 * Geometry & balance constants                                         *
 * ==================================================================== */

const VW = 352;
const VH = 198;

const HUD_H = 13;
/** Street level: building bases sit here, and it is also the "hit the ground" line. */
export const GROUND_Y = 182;
const SKY_TOP = HUD_H;

/**
 * Gravity, in logical px/s^2 (canvas-down-positive: bigger y is further down
 * the screen, same convention the physics and the AI's analytic solver both
 * use throughout this file — no sign flip anywhere, which is the whole reason
 * the solver below is short).
 */
export const GRAVITY = 200;
/** Magnitude wind is drawn from, per round. Sign is a coin flip. */
export const WIND_MAX = 50;

/**
 * Power slider maps 0..100 onto this launch-speed range, in px/s.
 *
 * MAX_SPEED has to comfortably clear the worst realistic shot geometry, not
 * just the average one: the two towers can end up ~300px apart with one
 * ~55px taller than the other (see `pickTowers`), and the closed-form solver
 * says a 48-degree arc across that needs v≈268px/s. Anything lower than that
 * silently clamps every such shot to the same max-power undershoot no matter
 * how well aimed it is — that clamp is what the proof harness caught (a
 * "perfect" analytic shot and the AI's ranging both landing short by the same
 * amount every time, because they were never actually reaching the speed the
 * geometry required). 300 leaves real headroom above that worst case.
 */
export const MIN_SPEED = 95;
export const MAX_SPEED = 300;
export const ANGLE_MIN = 8;
export const ANGLE_MAX = 82;
export const POWER_MIN = 4;
export const POWER_MAX = 100;

/** How fast holding a direction moves the aim, per second. */
const ANGLE_RATE = 55;
const POWER_RATE = 90;

/** Radius of a thrower's hit-circle — this is what "direct hit" tests against. */
const HIT_R = 7;
/** Standing offset: the hand releases this far up and forward of the feet. */
const HAND_UP = 14;
const HAND_FWD = 9;

const TARGET_HITS = 3;
/** Safety valve: if nobody has connected in this many throws, the round is a
 *  wash (new skyline, new wind) rather than going on forever. */
const MAX_SHOTS_PER_ROUND = 14;
/** Second safety valve for the headless harness: a match cannot run forever
 *  even in a pathological seed. Ordinary play never gets close to this. */
const MAX_ROUNDS = 25;

/* ==================================================================== *
 * RNG — mulberry32, same recipe as every other mini-game here so a      *
 * seeded run is reproducible and the whole thing can be simulated       *
 * headless in Node.                                                     *
 * ==================================================================== */

export const mulberry32 = (seed: number) => {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
/** Cheap approximate normal via three uniforms — plenty for a lobbed shoe. */
const gauss = (rng: () => number) => (rng() + rng() + rng() - 1.5) * 1.1547;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const pick = <T,>(rng: () => number, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

/* ==================================================================== *
 * Ballistics                                                            *
 * ==================================================================== *
 *
 * Everything below is in canvas coordinates (x right, y DOWN), and every
 * angle is measured up from the horizontal in the thrower's own facing
 * direction. That single choice is why there is no sign-juggling anywhere
 * in this file: "up" is consistently "smaller y" and "gravity pulls toward
 * bigger y" everywhere, in the sim and in the solver alike.
 *
 * Launch decomposition, given angle theta (deg) and speed v (px/s), thrown
 * in direction `dir` (+1 right, -1 left):
 *   vx0 = dir * v * cos(theta)
 *   vy0 =       -v * sin(theta)      (negative = initially moving UP)
 *
 * Per-step integration (semi-implicit Euler, matches the fixed 1/60s game
 * loop exactly so a headless replay at the same dt lands on the same pixel):
 *   vx += windAccel * dt
 *   vy += gravity   * dt
 *   x  += vx * dt
 *   y  += vy * dt
 */

export const powerToSpeed = (power: number, speedMul: number): number =>
    (MIN_SPEED + (clamp(power, POWER_MIN, POWER_MAX) / 100) * (MAX_SPEED - MIN_SPEED)) * speedMul;

export const speedToPower = (speed: number, speedMul: number): number =>
    clamp(((speed / speedMul - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100, POWER_MIN, POWER_MAX);

/**
 * The closed-form solution the AI reasons with: "at this angle, what speed
 * clears a no-wind arc from (0,0) to (dx,dy)?"
 *
 * Standard range-with-elevation-change equation, rearranged for v with y-down:
 *   dy = -dx*tan(theta) + (g*dx^2) / (2*v^2*cos^2(theta))
 *   =>  v = sqrt( g*dx^2 / (2*cos^2(theta) * (dy + dx*tan(theta))) )
 *
 * The bracket must be positive — physically, "the arc actually climbs high
 * enough at this angle to still be above the target when it gets there
 * horizontally." A shallow angle aimed at a target much higher up the
 * skyline has no solution at all (you cannot loft a flat throw uphill),
 * and the caller falls back to a steeper angle when this returns null.
 * This is also the function the proof harness checks the whole ballistic
 * model against: feed its (angle, v) back into the stepper with zero wind
 * and the projectile must land within a pixel of (dx, dy).
 */
export const solveSpeedForAngle = (dx: number, dy: number, angleDeg: number, gravity: number): number | null => {
    const theta = (angleDeg * Math.PI) / 180;
    const denom = 2 * Math.cos(theta) * Math.cos(theta) * (dy + dx * Math.tan(theta));
    if (!(denom > 1e-6) || dx <= 0) return null;
    const v2 = (gravity * dx * dx) / denom;
    if (!(v2 > 0) || !isFinite(v2)) return null;
    return Math.sqrt(v2);
};

/* ==================================================================== *
 * Skyline & craters                                                     *
 * ==================================================================== */

export interface Crater { cx: number; cy: number; r: number }
export interface Building {
    x0: number; x1: number; roofY: number;
    shade: number;                 // picks a fill tone, just for visual variety
    windows: boolean[];            // precomputed lit/unlit so it doesn't flicker
    cols: number; rows: number;
    craters: Crater[];
}

const BUILDING_MIN_W = 30;
const BUILDING_MAX_W = 54;
const BUILDING_MIN_DEPTH = 34;
const BUILDING_MAX_DEPTH = 118;
const TOWER_MIN_DEPTH = 62;        // the two stand-buildings are never a shack

/** A full-width, contiguous, gapless skyline — same idea as the original's
 *  wall of rectangles, just parameterised instead of hand-tiled. */
export const createSkyline = (rng: () => number): Building[] => {
    const buildings: Building[] = [];
    let x = -4;
    while (x < VW + 4) {
        const w = BUILDING_MIN_W + rng() * (BUILDING_MAX_W - BUILDING_MIN_W);
        const depth = BUILDING_MIN_DEPTH + rng() * (BUILDING_MAX_DEPTH - BUILDING_MIN_DEPTH);
        const roofY = GROUND_Y - depth;
        const cols = Math.max(2, Math.floor(w / 9));
        const rows = Math.max(2, Math.floor((GROUND_Y - roofY) / 11));
        const windows: boolean[] = [];
        for (let i = 0; i < cols * rows; i++) windows.push(rng() < 0.4);
        buildings.push({ x0: x, x1: x + w, roofY, shade: rng(), windows, cols, rows, craters: [] });
        x += w;
    }
    return buildings;
};

/** The building whose footprint contains this x, or null past either edge. */
export const buildingAt = (buildings: Building[], x: number): Building | null => {
    for (const b of buildings) if (x >= b.x0 && x < b.x1) return b;
    return null;
};

/** True if (x,y) has already been excavated out of this building. */
const inCrater = (b: Building, x: number, y: number): boolean =>
    b.craters.some(c => Math.hypot(x - c.cx, y - c.cy) <= c.r);

/** Picks the two buildings the throwers stand on: one in the left third of
 *  the skyline, one in the right third, forced tall enough to read as a
 *  tower and pulled apart so the shot genuinely has to travel. */
const pickTowers = (buildings: Building[], rng: () => number): [number, number] => {
    const leftCandidates = buildings
        .map((b, i) => i)
        .filter(i => (buildings[i].x0 + buildings[i].x1) / 2 < VW * 0.32 && (buildings[i].x0 + buildings[i].x1) / 2 > 28);
    const rightCandidates = buildings
        .map((b, i) => i)
        .filter(i => (buildings[i].x0 + buildings[i].x1) / 2 > VW * 0.68 && (buildings[i].x0 + buildings[i].x1) / 2 < VW - 28);
    const li = leftCandidates.length ? leftCandidates[Math.floor(rng() * leftCandidates.length)] : 1;
    const ri = rightCandidates.length
        ? rightCandidates[Math.floor(rng() * rightCandidates.length)]
        : buildings.length - 2;
    for (const i of [li, ri]) {
        if (GROUND_Y - buildings[i].roofY < TOWER_MIN_DEPTH) buildings[i].roofY = GROUND_Y - TOWER_MIN_DEPTH;
    }
    return [li, Math.max(ri, li + 1)];
};

/* ==================================================================== *
 * Weapon flight profiles                                                *
 * ==================================================================== *
 *
 * This is the whole "throw shoes or special weapons if you have em" twist,
 * expressed as flight-model multipliers rather than new code paths: every
 * projectile runs through the exact same stepper, and a weapon is just a
 * different (gravityMul, windMul, speedMul, homing) tuple plus a crater size
 * and a sprite. That keeps the physics honest — nothing gets a secret hitbox
 * or a scripted path, it all still obeys the one stepper the proof harness
 * checks.
 */
export interface ProjectileProfile {
    id: string;
    name: string;
    glyph: string;
    gravityMul: number;
    windMul: number;
    speedMul: number;
    /** px/s^2 of steering toward the live target — 0 for everything but the chancla. */
    homing: number;
    piercing: boolean;
    craterR: number;
    uses?: number;
}

/** id -> flight profile. 'shoe' is always available and never runs out. */
export const PROFILES: Record<string, ProjectileProfile> = {
    shoe: {
        id: 'shoe', name: 'Your Own Shoe', glyph: '👟',
        gravityMul: 1, windMul: 1, speedMul: 1, homing: 0, piercing: false, craterR: 10,
    },
    'itm-chanclas': {
        // "Ancient guidance system, zero latency." A small constant steer
        // toward wherever the target currently stands — subtle, not a laser.
        id: 'itm-chanclas', name: 'Chancla', glyph: '🩴',
        gravityMul: 1, windMul: 1, speedMul: 0.95, homing: 34, piercing: false, craterR: 12, uses: undefined,
    },
    'itm-frisbee': {
        // Barely affected by gravity, cuts flatter — piercing carries through
        // to here as "keeps flying after it bites a building."
        id: 'itm-frisbee', name: 'Frisbee', glyph: '🥏',
        gravityMul: 0.22, windMul: 0.75, speedMul: 1.15, homing: 0, piercing: true, craterR: 8,
    },
    'itm-slushie': {
        // Light and slushy: wind pushes it around far more than anything
        // else in the bag, and it splashes a wide, shallow crater.
        id: 'itm-slushie', name: 'Slushie', glyph: '🥤',
        gravityMul: 1.05, windMul: 1.9, speedMul: 0.85, homing: 0, piercing: false, craterR: 19, uses: 12,
    },
    'itm-burekas': {
        // Heavy and drops fast: high gravity multiplier, low wind purchase.
        id: 'itm-burekas', name: 'Bureka', glyph: '🥟',
        gravityMul: 1.7, windMul: 0.5, speedMul: 0.9, homing: 0, piercing: false, craterR: 9, uses: 15,
    },
    'itm-dog-launcher': {
        // Fast and flat: high speed, low gravity, and a hard cap on shots.
        id: 'itm-dog-launcher', name: 'Dog Launcher', glyph: '🌭',
        gravityMul: 0.55, windMul: 0.4, speedMul: 1.6, homing: 0, piercing: false, craterR: 10, uses: 40,
    },
};

const THROWN_WEAPON_IDS = ['itm-chanclas', 'itm-frisbee', 'itm-slushie', 'itm-burekas', 'itm-dog-launcher'] as const;

/**
 * The AM/PM weapons the player is carrying that this game knows how to throw.
 *
 * `armsFor`/`loadoutFor` in systems/weapons.ts gate on a weapon's `games`
 * list, which is authored per mini-game id — a new game id is not something
 * this file can add to that shared registry. So this reads the player's
 * storage directly against the five ids this game supports, independent of
 * that list. If a future pass adds 'rooftop-artillery' to weapons.ts, this
 * still works unchanged; it just becomes a stricter check than it needs to be.
 */
const rooftopLoadout = (player: Player): Weapon[] =>
    player.storage
        .filter(item => item.qty > 0 && (THROWN_WEAPON_IDS as readonly string[]).includes(item.id))
        .map(item => getWeapon(item.id))
        .filter((w): w is Weapon => !!w);

/* ==================================================================== *
 * Projectile stepping — the pure core the proof harness drives directly *
 * ==================================================================== */

export interface Projectile {
    x: number; y: number; vx: number; vy: number;
    profileId: string;
    dir: 1 | -1;
    t: number;
    trail: { x: number; y: number }[];
}

export const launchProjectile = (
    x: number, y: number, angleDeg: number, power: number, dir: 1 | -1, profile: ProjectileProfile,
): Projectile => {
    const v = powerToSpeed(power, profile.speedMul);
    const theta = (angleDeg * Math.PI) / 180;
    return {
        x, y,
        vx: dir * v * Math.cos(theta),
        vy: -v * Math.sin(theta),
        profileId: profile.id,
        dir, t: 0, trail: [],
    };
};

/**
 * Advances one projectile by one physics step. This is gravity, wind and
 * (for the chancla only) homing, applied in that order, then Euler-integrated
 * — nothing else touches vx/vy. `target` is only read when `homing > 0`.
 */
export const tickProjectile = (
    p: Projectile, dt: number, gravity: number, windAccel: number, profile: ProjectileProfile,
    target?: { x: number; y: number },
): void => {
    if (profile.homing > 0 && target) {
        // Steer velocity toward the target at a constant acceleration — a
        // *nudge*, not a lock: it is easily overpowered by a real gravity arc
        // or a strong crosswind, which is what "homes slightly" means here.
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * profile.homing * dt;
        p.vy += (dy / d) * profile.homing * dt;
    }
    p.vx += windAccel * profile.windMul * dt;
    p.vy += gravity * profile.gravityMul * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.t += dt;
};

export type ImpactKind = 'bounds' | 'ground' | 'building' | 'hit';
export interface ImpactResult { kind: ImpactKind; x: number; y: number; hitSide?: 0 | 1 }

/**
 * One frame's collision test, checked in this order: fly off the world edge,
 * hit the street, hit a thrower (either one — see the module doc on why
 * self-hits are always live), then hit solid building material. A point that
 * falls inside a building's rect but inside an already-dug crater is empty
 * air and does not collide — that is the whole crater-persistence mechanic.
 */
export const collideAt = (
    x: number, y: number, buildings: Building[], throwers: [{ x: number; y: number }, { x: number; y: number }],
): ImpactResult | null => {
    if (x < -16 || x > VW + 16) return { kind: 'bounds', x, y };
    if (y >= GROUND_Y + 4) return { kind: 'ground', x, y: GROUND_Y };
    for (let side = 0; side < 2; side++) {
        const t = throwers[side as 0 | 1];
        if (Math.hypot(x - t.x, y - t.y) <= HIT_R) return { kind: 'hit', x, y, hitSide: side as 0 | 1 };
    }
    const b = buildingAt(buildings, x);
    if (b && y >= b.roofY && y <= GROUND_Y && !inCrater(b, x, y)) return { kind: 'building', x, y };
    return null;
};

/* ==================================================================== *
 * Standalone throw simulation — for the proof harness and for anything  *
 * that wants "what happens if I throw this" without the game's phase     *
 * machine.                                                               *
 * ==================================================================== */

export interface ThrowResult {
    impact: ImpactResult;
    frames: number;
    craterBuilding?: Building;
}

/**
 * Runs one projectile to completion against a fixed world. `graceT` is the
 * short window right after release where the thrower's OWN hit-circle is not
 * tested — without it, every single throw would register as an instant
 * self-hit at the release point, since that is exactly where the projectile
 * starts. After the grace window, both hit-circles are live, which is what
 * lets a genuinely bad low-angle throw curve back and clip its own thrower.
 */
export const simulateThrow = (
    p: Projectile, gravity: number, windAccel: number, profile: ProjectileProfile,
    buildings: Building[], throwers: [{ x: number; y: number }, { x: number; y: number }],
    shooterSide: 0 | 1, target: { x: number; y: number },
    dt = 1 / 60, maxT = 6, graceT = 0.05,
): ThrowResult => {
    let frames = 0;
    for (; p.t < maxT; frames++) {
        tickProjectile(p, dt, gravity, windAccel, profile, target);
        // Only the shooter's own hit-circle is suppressed during the grace
        // window — the target is live from frame one.
        const testThrowers: [{ x: number; y: number }, { x: number; y: number }] = [throwers[0], throwers[1]];
        if (p.t < graceT) testThrowers[shooterSide] = { x: -9999, y: -9999 };
        const hit = collideAt(p.x, p.y, buildings, testThrowers);
        if (hit) {
            if (hit.kind === 'building') {
                const b = buildingAt(buildings, hit.x)!;
                b.craters.push({ cx: hit.x, cy: hit.y, r: profile.craterR });
                if (profile.piercing) continue;   // punches through, keeps flying
                return { impact: hit, frames, craterBuilding: b };
            }
            return { impact: hit, frames };
        }
    }
    return { impact: { kind: 'ground', x: p.x, y: GROUND_Y }, frames };
};

/* ==================================================================== *
 * AI ranging                                                            *
 * ==================================================================== *
 *
 * The AI reasons entirely in terms of "where do I think the target is" (an
 * aim point in x), converts that to an (angle, power) via the closed-form
 * solver above — which assumes zero wind — and then corrects the aim point
 * itself, shot to shot, from where its own last shot actually landed. That
 * mirrors the original's crude-but-effective ranging and is also *why* it
 * ranges in at all: the solver can't see the wind, but the feedback loop
 * eventually cancels it out anyway, because a constant wind produces a
 * roughly constant landing bias that a proportional corrector converges on
 * geometrically. Two knobs make `skill` matter:
 *   - noise: how far the very first guess is thrown off, shrinking each shot
 *     (SIGMA_DECAY) — first shot wild, later shots tighter.
 *   - correctionGain: how much of last shot's miss gets folded into the next
 *     aim point — a sharp shooter corrects almost all of it at once, a weak
 *     one only nibbles at it.
 * Both are driven by `skill`, so a high-skill opponent both starts closer and
 * closes the gap faster — "genuinely dangerous by shot three."
 */
export interface AiRangingState { biasX: number; shotIndex: number }
export const freshAiRanging = (): AiRangingState => ({ biasX: 0, shotIndex: 0 });

const aiSigma = (skill: number, shotIndex: number): number => {
    const sigma0 = 14 + (1 - skill) * 95;      // wild on shot one for a low-skill foe
    const floor = 3 + (1 - skill) * 9;         // never quite a laser, even maxed out
    const decayed = sigma0 * Math.pow(0.5, shotIndex);
    return Math.max(floor, decayed);
};
const aiCorrectionGain = (skill: number): number => 0.35 + skill * 0.55;

export interface AiShotPlan { angleDeg: number; power: number; aimX: number }

export const planAiShot = (
    thrower: { x: number; y: number }, target: { x: number; y: number }, dir: 1 | -1,
    skill: number, ranging: AiRangingState, rng: () => number, gravity: number,
): AiShotPlan => {
    const sigma = aiSigma(skill, ranging.shotIndex);
    const aimX = target.x - ranging.biasX + gauss(rng) * sigma;
    const dx = Math.max(20, Math.abs(aimX - thrower.x));
    const dy = target.y - thrower.y;

    // A lob clears more of the skyline than a line drive; if the arithmetic
    // says that angle can't reach this elevation change, steepen and try once
    // more rather than firing something with no real solution.
    let angle = 48;
    let v = solveSpeedForAngle(dx, dy, angle, gravity);
    if (v === null) { angle = 68; v = solveSpeedForAngle(dx, dy, angle, gravity); }
    if (v === null) { angle = 48; v = MAX_SPEED; }

    return { angleDeg: angle, power: speedToPower(clamp(v, MIN_SPEED, MAX_SPEED * 1.3), 1), aimX };
};

/**
 * Feeds the real landing spot back into the ranging state. Call once per AI
 * shot, once its landing spot is known.
 *
 * This corrects toward the TRUE target position, not toward where the AI
 * itself aimed — that distinction is the whole mechanism. `biasX` is meant to
 * converge on "how much the world (wind, mostly) is bending my shots away
 * from where I actually want them to land," which is a property of the
 * target and the wind, not of this shot's own (possibly very noisy) aim
 * point. Correcting against the aim point instead very nearly cancels itself
 * out step to step and never converges on the target at all — that was the
 * bug the proof harness caught here: error was measurably GROWING shot over
 * shot instead of shrinking, because the feedback was chasing the wrong
 * quantity, and no gain tuning fixes a feedback loop closed on the wrong
 * error term.
 */
export const learnFromLanding = (ranging: AiRangingState, skill: number, targetX: number, landX: number): void => {
    ranging.biasX += aiCorrectionGain(skill) * (landX - targetX);
    ranging.shotIndex += 1;
};

/* ==================================================================== *
 * Game world                                                            *
 * ==================================================================== */

type Phase = 'roundIntro' | 'aim' | 'thinking' | 'flight' | 'impact' | 'over';

export interface Thrower {
    x: number; y: number;
    angle: number; power: number;
    hits: number;
    falling: number;       // 0 = standing; >0 drives the tumble-off-the-roof animation
    fallDir: 1 | -1;
}

export interface World {
    rngState: number;
    opponentName: string;
    skill: number;
    t: number;
    round: number;
    shotsThisRound: number;
    buildings: Building[];
    wind: number;               // px/s^2, signed
    turn: 0 | 1;                // 0 = you, 1 = them
    phase: Phase;
    phaseT: number;
    throwers: [Thrower, Thrower];
    proj: Projectile | null;
    profileId: string;
    ammo: Record<string, number>;   // remaining uses per weapon id, Infinity = unlimited
    ai: AiRangingState;
    /** Render-only hints the physics never reads: which NPC sprite to draw,
     *  and which of the player's own sneakers is being thrown. Kept on World
     *  rather than a parallel type so the component has one ref to manage. */
    opponentSpriteId?: string;
    playerSneaker?: { archetype: string; swap: PaletteSwap };
    shake: number;
    parts: { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string }[];
    hintDots: { x: number; y: number }[];
    lastImpact: ImpactResult | null;
    bannerText: string; bannerT: number; bannerColor: string;
    say: string; sayT: number;
    winner: 0 | 1 | null;
    result: 'win' | 'lose' | null;
    stats: {
        shots: number; hits: number; selfHits: number; buildingHits: number;
        aiShots: number; craters: number; roundsPlayed: number;
    };
}

const mkThrower = (x: number, y: number): Thrower => ({ x, y, angle: 45, power: 55, hits: 0, falling: 0, fallDir: 1 });

const BANTER = {
    start: ['Rooftops. Bring your own shoes.', "Don't hit the buildings. Actually, do. It's funny."],
    playerHit: ['THAT is a direct hit.', 'Right in the chest. Unbelievable.', 'He is not getting up from that.'],
    playerMiss: ['Grazed the water tower. Close.', 'That was never going to land.', 'The building took one for the team.'],
    selfHit: ["He hit HIMSELF.", 'He just... threw it into his own face.', 'Physics is undefeated.'],
    aiHit: ['Ohhh. That is going to leave a mark.', 'He found the range.', 'Wind read perfectly. Somehow.'],
    aiMiss: ['Short. Way short.', 'That one is going in the crater column.', 'He is guessing now.'],
    roundStart: (n: number) => `ROUND ${n}`,
};

export const createWorld = (seed: number, opponentName: string, skill: number): World => {
    const rng = mulberry32(seed);
    const buildings = createSkyline(rng);
    const [li, ri] = pickTowers(buildings, rng);
    const you = mkThrower((buildings[li].x0 + buildings[li].x1) / 2, buildings[li].roofY);
    const foe = mkThrower((buildings[ri].x0 + buildings[ri].x1) / 2, buildings[ri].roofY);
    return {
        rngState: seed | 0,
        opponentName, skill: clamp(skill, 0, 1),
        t: 0, round: 1, shotsThisRound: 0,
        buildings,
        wind: (rng() * 2 - 1) * WIND_MAX,
        turn: 0,
        phase: 'roundIntro', phaseT: 0,
        throwers: [you, foe],
        proj: null,
        profileId: 'shoe',
        ammo: {},
        ai: freshAiRanging(),
        shake: 0, parts: [], hintDots: [],
        lastImpact: null,
        bannerText: BANTER.roundStart(1), bannerT: 1.6, bannerColor: PAL.accent,
        say: pick(rng, BANTER.start), sayT: 3,
        winner: null, result: null,
        stats: { shots: 0, hits: 0, selfHits: 0, buildingHits: 0, aiShots: 0, craters: 0, roundsPlayed: 1 },
    };
};

const rng = (w: World) => {
    w.rngState = (w.rngState + 0x6d2b79f5) | 0;
    let t = w.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const say = (w: World, s: string) => { w.say = s; w.sayT = 2.6; };
const shout = (w: World, s: string, color: string, hold = 1.3) => { w.bannerText = s; w.bannerT = hold; w.bannerColor = color; };

const startRound = (w: World, roundNum: number) => {
    const rngFn = () => rng(w);
    w.buildings = createSkyline(rngFn);
    const [li, ri] = pickTowers(w.buildings, rngFn);
    w.throwers[0] = mkThrower((w.buildings[li].x0 + w.buildings[li].x1) / 2, w.buildings[li].roofY);
    w.throwers[1] = mkThrower((w.buildings[ri].x0 + w.buildings[ri].x1) / 2, w.buildings[ri].roofY);
    w.wind = (rngFn() * 2 - 1) * WIND_MAX;
    w.round = roundNum;
    w.shotsThisRound = 0;
    w.turn = (roundNum % 2 === 1 ? 0 : 1) as 0 | 1;
    w.ai = freshAiRanging();
    w.proj = null;
    w.phase = 'roundIntro';
    w.phaseT = 0;
    w.lastImpact = null;
    shout(w, BANTER.roundStart(roundNum), PAL.accent, 1.4);
    w.stats.roundsPlayed = roundNum;
};

const endMatch = (w: World, winner: 0 | 1) => {
    w.winner = winner;
    w.result = winner === 0 ? 'win' : 'lose';
    w.phase = 'over';
    w.phaseT = 0;
};

const beginAim = (w: World) => {
    w.phase = w.turn === 0 ? 'aim' : 'thinking';
    w.phaseT = 0;
};

/** Explosion + debris, shared by every kind of impact so it always feels physical. */
const spawnDebris = (w: World, x: number, y: number, n: number, color: string) => {
    for (let i = 0; i < n; i++) {
        const a = rng(w) * Math.PI * 2;
        const sp = 30 + rng(w) * 90;
        w.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5 + rng(w) * 0.4, max: 0.9, color });
    }
};

const profileFor = (w: World): ProjectileProfile => PROFILES[w.profileId] ?? PROFILES.shoe;

const fire = (w: World, side: 0 | 1) => {
    const th = w.throwers[side];
    const dir: 1 | -1 = side === 0 ? 1 : -1;
    const profile = side === 0 ? profileFor(w) : PROFILES.shoe;   // the house never carries AM/PM kit
    const hx = th.x + dir * HAND_FWD;
    const hy = th.y - HAND_UP;
    w.proj = launchProjectile(hx, hy, th.angle, th.power, dir, profile);
    w.stats.shots += 1;
    if (side === 1) w.stats.aiShots += 1;
    if (side === 0 && profile.uses !== undefined) {
        w.ammo[profile.id] = Math.max(0, (w.ammo[profile.id] ?? profile.uses) - 1);
        if (w.ammo[profile.id] <= 0) w.profileId = 'shoe';   // depleted — back to bare feet
    }
    w.phase = 'flight';
    w.phaseT = 0;
    w.shotsThisRound += 1;
};

const resolveImpact = (w: World, result: ThrowResult, shooterSide: 0 | 1) => {
    w.lastImpact = result.impact;
    const { impact } = result;

    if (impact.kind === 'building') {
        w.stats.buildingHits += 1;
        w.stats.craters += 1;
        w.shake = Math.max(w.shake, 3);
        spawnDebris(w, impact.x, impact.y, 10, '#9aa4ad');
        say(w, pick(() => rng(w), shooterSide === 0 ? BANTER.playerMiss : BANTER.aiMiss));
        w.phase = 'impact';
        w.phaseT = 0;
        return;
    }
    if (impact.kind === 'ground' || impact.kind === 'bounds') {
        w.shake = Math.max(w.shake, 1.5);
        say(w, pick(() => rng(w), shooterSide === 0 ? BANTER.playerMiss : BANTER.aiMiss));
        w.phase = 'impact';
        w.phaseT = 0;
        return;
    }

    // A direct hit — on someone. hitSide is who got hit; the OTHER side scores,
    // which is what makes a self-hit cost you the round instead of being a
    // no-op: it is simply a hit whose victim happens to be the shooter.
    const victim = impact.hitSide!;
    const scorer = (1 - victim) as 0 | 1;
    w.stats.hits += 1;
    if (victim === shooterSide) w.stats.selfHits += 1;
    w.throwers[victim].falling = 0.001;
    w.throwers[victim].fallDir = victim === 0 ? -1 : 1;
    w.shake = Math.max(w.shake, 9);
    spawnDebris(w, impact.x, impact.y, 22, victim === 0 ? '#00e5c0' : '#ff2e88');

    if (victim === shooterSide) say(w, pick(() => rng(w), BANTER.selfHit));
    else say(w, pick(() => rng(w), scorer === 0 ? BANTER.playerHit : BANTER.aiHit));

    w.throwers[scorer].hits += 1;
    shout(w, scorer === 0 ? 'DIRECT HIT!' : `${w.opponentName.toUpperCase()} SCORES!`, scorer === 0 ? PAL.ok : PAL.bad, 1.8);
    w.phase = 'impact';
    w.phaseT = 0;
};

/** Ends the current throw and decides what happens next: someone won the
 *  match, the round ended in a hit, or play passes to the other thrower. */
const afterImpact = (w: World) => {
    const hitSomeone = w.lastImpact?.kind === 'hit';
    if (hitSomeone) {
        const victim = w.lastImpact!.hitSide!;
        const scorer = (1 - victim) as 0 | 1;
        if (w.throwers[scorer].hits >= TARGET_HITS) { endMatch(w, scorer); return; }
        if (w.round >= MAX_ROUNDS) { endMatch(w, w.throwers[0].hits >= w.throwers[1].hits ? 0 : 1); return; }
        startRound(w, w.round + 1);
        return;
    }
    if (w.shotsThisRound >= MAX_SHOTS_PER_ROUND) {
        if (w.round >= MAX_ROUNDS) { endMatch(w, w.throwers[0].hits >= w.throwers[1].hits ? 0 : 1); return; }
        startRound(w, w.round + 1);
        return;
    }
    w.turn = (1 - w.turn) as 0 | 1;
    w.proj = null;
    beginAim(w);
};

/** A few ghost dots right off the hand — enough to read initial direction
 *  and speed, nowhere near enough to see where it lands. Computed WITHOUT
 *  wind on purpose: wind is the thing you have to learn by feel, not read
 *  off a dotted line, so the hint deliberately lies about it a little. */
const computeHint = (w: World): { x: number; y: number }[] => {
    const th = w.throwers[0];
    const profile = profileFor(w);
    const p = launchProjectile(th.x + HAND_FWD, th.y - HAND_UP, th.angle, th.power, 1, profile);
    const dots: { x: number; y: number }[] = [];
    const dt = 1 / 22;
    for (let i = 0; i < 7; i++) {
        tickProjectile(p, dt, GRAVITY, 0, profile);
        dots.push({ x: p.x, y: p.y });
    }
    return dots;
};

/* ------------------------------------------------------------------ */
/* Step                                                                 */
/* ------------------------------------------------------------------ */

export interface Cmd {
    left: boolean; right: boolean; up: boolean; down: boolean;
    a: boolean; b: boolean;
    aPress: boolean; bPress: boolean;
}
export const blankCmd = (): Cmd => ({
    left: false, right: false, up: false, down: false, a: false, b: false, aPress: false, bPress: false,
});

const AI_THINK_TIME = 0.85;
const IMPACT_HOLD = 0.6;
const HIT_HOLD = 1.7;               // the slow-motion beat on a direct hit
const ROUND_INTRO_HOLD = 1.2;

export const stepArtillery = (w: World, dt: number, cmd: Cmd) => {
    w.t += dt;
    w.phaseT += dt;
    w.shake = Math.max(0, w.shake - dt * 20);
    w.bannerT = Math.max(0, w.bannerT - dt);
    w.sayT = Math.max(0, w.sayT - dt);
    for (const t of w.throwers) if (t.falling > 0) t.falling += dt;

    for (let i = w.parts.length - 1; i >= 0; i--) {
        const q = w.parts[i];
        q.life -= dt;
        q.vy += 260 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        if (q.life <= 0) w.parts.splice(i, 1);
    }

    if (w.phase === 'over') return;

    if (w.phase === 'roundIntro') {
        if (w.phaseT >= ROUND_INTRO_HOLD) beginAim(w);
        return;
    }

    if (w.phase === 'aim') {
        const th = w.throwers[0];
        if (cmd.up) th.angle = clamp(th.angle + ANGLE_RATE * dt, ANGLE_MIN, ANGLE_MAX);
        if (cmd.down) th.angle = clamp(th.angle - ANGLE_RATE * dt, ANGLE_MIN, ANGLE_MAX);
        if (cmd.right) th.power = clamp(th.power + POWER_RATE * dt, POWER_MIN, POWER_MAX);
        if (cmd.left) th.power = clamp(th.power - POWER_RATE * dt, POWER_MIN, POWER_MAX);
        w.hintDots = computeHint(w);

        if (cmd.bPress) {
            // Cycle weapons: shoe -> each carried AM/PM weapon with ammo left -> shoe.
            // `w.ammo` is seeded (once, by the React wrapper) with exactly the
            // weapons this player is actually carrying this match, so this
            // needs no separate "what do I own" check.
            const carried = ['shoe', ...Object.keys(w.ammo).filter(id => (w.ammo[id] ?? 0) > 0)];
            const at = carried.indexOf(w.profileId);
            w.profileId = carried[(at + 1) % carried.length] ?? 'shoe';
        }
        if (cmd.aPress) fire(w, 0);
        return;
    }

    if (w.phase === 'thinking') {
        if (w.phaseT >= AI_THINK_TIME) {
            const th = w.throwers[1];
            const target = w.throwers[0];
            const plan = planAiShot(th, target, -1, w.skill, w.ai, () => rng(w), GRAVITY);
            th.angle = plan.angleDeg;
            th.power = plan.power;
            fire(w, 1);
        }
        return;
    }

    if (w.phase === 'flight') {
        const p = w.proj!;
        // The profile the shot was *launched* with, not whatever the player has
        // selected right now.
        //
        // `fire()` is careful about this — the house throws a plain shoe, never
        // your AM/PM kit — and then this read it straight back off the world and
        // threw that care away. Equip the frisbee and the opponent's shoe became
        // piercing with a fifth of the gravity; equip the chancla and it homed
        // on you. The AI silently got harder the better your loadout was, which
        // is precisely backwards, and nothing on screen explained it.
        //
        // `profileId` has been on the projectile since it was launched. Use it.
        const profile = PROFILES[p.profileId] ?? PROFILES.shoe;
        const target = w.turn === 0 ? w.throwers[1] : w.throwers[0];
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 40) p.trail.shift();
        tickProjectile(p, dt, GRAVITY, w.wind, profile, target);

        const shooterSide = w.turn;
        const skipSelf = p.t < 0.05;
        const testThrowers: [{ x: number; y: number }, { x: number; y: number }] = [
            skipSelf && shooterSide === 0 ? { x: -9999, y: -9999 } : w.throwers[0],
            skipSelf && shooterSide === 1 ? { x: -9999, y: -9999 } : w.throwers[1],
        ];
        const hit = collideAt(p.x, p.y, w.buildings, testThrowers);
        if (hit) {
            if (hit.kind === 'building') {
                const b = buildingAt(w.buildings, hit.x)!;
                b.craters.push({ cx: hit.x, cy: hit.y, r: profile.craterR });
                if (w.turn === 1) {
                    // The AI just learned exactly what it needed to for next
                    // time: how far this shot landed from the REAL target
                    // (the player's rooftop), not from its own noisy aim.
                    learnFromLanding(w.ai, w.skill, w.throwers[0].x, hit.x);
                }
                if (profile.piercing) return;   // keeps flying through the hole it just made
            }
            if (hit.kind === 'ground' && w.turn === 1) {
                learnFromLanding(w.ai, w.skill, w.throwers[0].x, hit.x);
            }
            resolveImpact(w, { impact: hit, frames: 0 }, shooterSide);
            return;
        }
        if (p.t > 6) resolveImpact(w, { impact: { kind: 'ground', x: p.x, y: GROUND_Y }, frames: 0 }, shooterSide);
        return;
    }

    if (w.phase === 'impact') {
        const dramatic = w.lastImpact?.kind === 'hit';
        if (w.phaseT >= (dramatic ? HIT_HOLD : IMPACT_HOLD)) afterImpact(w);
        return;
    }
};

/* ==================================================================== *
 * Drawing                                                               *
 * ==================================================================== */

const SHADE_COLORS = ['#141c25', '#182430', '#101822', '#1a222c'];

/** Local helper: bakes a SpriteDef with a forced centre anchor so an item can
 *  be rotated around its middle in flight, instead of `actor()`'s feet
 *  anchor which is right for a standing character and wrong for a tumbling
 *  frisbee. Everything else about the bake/draw pipeline is unchanged. */
const drawSpinning = (
    ctx: CanvasRenderingContext2D, def: SpriteDef, x: number, y: number,
    px: number, rotation: number, elapsed: number, swap?: PaletteSwap,
) => {
    const centred: SpriteDef = { ...def, anchor: { x: 0.5, y: 0.5 } };
    const bakeScale = Math.max(1, Math.round(px));
    const baked = bakeSprite(centred, { scale: bakeScale, swap });
    drawSprite(ctx, baked, x, y, frameAt(baked, elapsed), { rotation, scale: px / bakeScale });
};

const itemDefFor = (id: string): SpriteDef => {
    switch (id) {
        case 'itm-chanclas': return SPR_ITEM_CHANCLA;
        case 'itm-frisbee': return SPR_ITEM_FRISBEE;
        case 'itm-slushie': return SPR_ITEM_SLUSHIE;
        case 'itm-burekas': return SPR_ITEM_BUREKA;
        case 'itm-dog-launcher': return SPR_ITEM_DOG_LAUNCHER;
        default: return SPR_ITEM_CHANCLA;
    }
};

const drawSky = (ctx: CanvasRenderingContext2D, w: World) => {
    clear(ctx, VW, VH, '#050810');
    rect(ctx, 0, SKY_TOP, VW, VH - SKY_TOP, '#0a1020');
    // Gradient-ish dusk band via a couple of flat bands — cheap and reads fine at this size.
    rect(ctx, 0, SKY_TOP, VW, 60, '#141a30');
    rect(ctx, 0, SKY_TOP + 60, VW, 40, '#0e1526');
    for (let i = 0; i < 30; i++) {
        const hx = ((i * 53.7) % VW);
        const hy = SKY_TOP + ((i * 29.3) % 70);
        circle(ctx, hx, hy, (i % 5 === 0) ? 1 : 0.6, 'rgba(255,255,255,0.55)');
    }
    circle(ctx, VW - 46, SKY_TOP + 20, 10, '#e7ecf6');
    circle(ctx, VW - 50, SKY_TOP + 17, 9, '#0a1020');
};

const drawBuildings = (ctx: CanvasRenderingContext2D, w: World) => {
    for (const b of w.buildings) {
        const bw = b.x1 - b.x0;
        const bh = GROUND_Y - b.roofY;
        const color = SHADE_COLORS[Math.floor(b.shade * SHADE_COLORS.length) % SHADE_COLORS.length];
        rect(ctx, b.x0, b.roofY, bw, bh, color);

        for (let r = 0; r < b.rows; r++) {
            for (let c = 0; c < b.cols; c++) {
                const wx = b.x0 + 3 + c * (bw - 6) / Math.max(1, b.cols - 1 || 1);
                const wy = b.roofY + 5 + r * 10;
                if (wy > GROUND_Y - 4) continue;
                const lit = b.windows[r * b.cols + c];
                rect(ctx, wx, wy, 3, 5, lit ? '#ffcf6b' : '#232c38');
            }
        }
        outline(ctx, b.x0, b.roofY, bw, bh, 'rgba(0,0,0,0.5)', 1);

        if (b.craters.length) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(b.x0, b.roofY, bw, bh);
            ctx.clip();
            ctx.globalCompositeOperation = 'destination-out';
            for (const c of b.craters) {
                ctx.beginPath();
                ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            // A dark rim reads better than a hard cutout against the sky.
            ctx.save();
            ctx.beginPath();
            ctx.rect(b.x0, b.roofY, bw, bh);
            ctx.clip();
            for (const c of b.craters) {
                ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        }
    }
    rect(ctx, 0, GROUND_Y, VW, VH - GROUND_Y, '#05070c');
    line(ctx, 0, GROUND_Y, VW, GROUND_Y, '#2a3340', 1);
};

const windArrow = (ctx: CanvasRenderingContext2D, x: number, y: number, wind: number) => {
    const mag = Math.abs(wind);
    const len = 8 + Math.min(22, mag * 0.35);
    const dir = wind >= 0 ? 1 : -1;
    const color = mag < 12 ? PAL.dim : mag < 30 ? PAL.warn : PAL.bad;
    line(ctx, x - dir * len, y, x + dir * len, y, color, 2);
    line(ctx, x + dir * len, y, x + dir * (len - 4), y - 3, color, 2);
    line(ctx, x + dir * len, y, x + dir * (len - 4), y + 3, color, 2);
};

export const drawArtillery = (ctx: CanvasRenderingContext2D, w: World, weaponMeta: Record<string, Weapon>) => {
    ctx.save();
    const [sx, sy] = shakeOffset(w.shake);
    ctx.translate(sx, sy);

    drawSky(ctx, w);
    drawBuildings(ctx, w);

    // Throwers.
    for (let sideN = 0; sideN <= 1; sideN++) {
        const side = sideN as 0 | 1;
        const th = w.throwers[side];
        const facing: 1 | -1 = side === 0 ? 1 : -1;
        const fallProgress = th.falling > 0 ? clamp(th.falling / HIT_HOLD, 0, 1) : 0;
        const fx = th.x + th.fallDir * fallProgress * 46;
        const fy = th.y + fallProgress * fallProgress * 90;
        const rot = fallProgress * th.fallDir * 2.2;
        ctx.save();
        ctx.globalAlpha = 1 - fallProgress * 0.35;
        ctx.translate(fx, fy);
        if (rot) ctx.rotate(rot);
        actor(ctx, side === 0 ? 'player' : (w.opponentSpriteId ?? 'rival'), 0, 0, {
            facing,
            scale: 1,
            kit: side === 0 ? KIT.player : KIT.rival,
            armUp: w.phase === 'aim' && side === 0 ? 0.6 + 0.2 * Math.sin(w.t * 4) : 0.15,
            hurt: th.falling > 0,
        });
        ctx.restore();
    }

    // Wind readout.
    windArrow(ctx, VW / 2, HUD_H + 8, w.wind);
    text(ctx, `WIND ${Math.round(Math.abs(w.wind))}`, VW / 2, HUD_H + 15, {
        size: 6, color: PAL.dim, align: 'center',
    });

    // Aim hint: a handful of ghost dots right off the release, nothing more.
    if (w.phase === 'aim') {
        for (const d of w.hintDots) circle(ctx, d.x, d.y, 0.9, 'rgba(255,255,255,0.4)');
    }

    // In-flight projectile + its trail.
    if (w.proj) {
        for (let i = 0; i < w.proj.trail.length; i++) {
            const pt = w.proj.trail[i];
            circle(ctx, pt.x, pt.y, 0.8, `rgba(255,255,255,${0.05 + 0.1 * (i / w.proj.trail.length)})`);
        }
        const profile = profileFor(w);
        const rotation = Math.atan2(w.proj.vy, w.proj.vx);
        if (profile.id === 'shoe') {
            const sneaker = w.playerSneaker ?? FALLBACK_LOOK;
            const def = archetypeSprite(sneaker.archetype);
            if (def) drawSpinning(ctx, def, w.proj.x, w.proj.y, 1.4, rotation, w.t, sneaker.swap);
        } else if (w.turn === 0) {
            drawSpinning(ctx, itemDefFor(profile.id), w.proj.x, w.proj.y, 1.5, rotation, w.t);
        } else {
            const def = archetypeSprite(FALLBACK_LOOK.archetype)!;
            drawSpinning(ctx, def, w.proj.x, w.proj.y, 1.4, rotation, w.t, FALLBACK_LOOK.swap);
        }
    }

    // Debris.
    for (const q of w.parts) {
        ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
        rect(ctx, q.x - 1, q.y - 1, 2, 2, q.color);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    /* --- HUD chrome (outside the shake transform, so text never jitters) --- */
    rect(ctx, 0, 0, VW, HUD_H, 'rgba(6,8,12,0.86)');
    text(ctx, `YOU ${w.throwers[0].hits}`, 4, 2, { size: 8, color: PAL.accent, bold: true });
    text(ctx, `${w.opponentName.slice(0, 10).toUpperCase()} ${w.throwers[1].hits}`, VW - 4, 2, {
        size: 8, color: PAL.accent2, align: 'right', bold: true,
    });
    text(ctx, `RD ${w.round}`, VW / 2, 2, { size: 7, color: PAL.dim, align: 'center' });

    if (w.phase === 'aim') {
        const meta = weaponMeta[w.profileId];
        const ammoLeft = w.ammo[w.profileId];
        const wpnLabel = w.profileId === 'shoe' ? 'SHOE' : (meta?.short ?? profileFor(w).name).toUpperCase();
        rect(ctx, 0, VH - 20, VW, 20, 'rgba(6,8,12,0.86)');
        text(ctx, `∠ ${Math.round(w.throwers[0].angle)}°`, 6, VH - 17, { size: 8, color: PAL.ink });
        text(ctx, `PWR ${Math.round(w.throwers[0].power)}`, 70, VH - 17, { size: 8, color: PAL.ink });
        text(ctx, `${wpnLabel}${ammoLeft !== undefined ? ` x${ammoLeft}` : ''}`, VW - 6, VH - 17, {
            size: 8, color: PAL.legend, align: 'right',
        });
        text(ctx, '▲▼ ANGLE   ◀▶ POWER   A THROW   B WEAPON', VW / 2, VH - 8, {
            size: 6, color: PAL.dim, align: 'center',
        });
    } else if (w.phase === 'thinking') {
        rect(ctx, 0, VH - 11, VW, 11, 'rgba(6,8,12,0.86)');
        text(ctx, `${w.opponentName} is lining up${'.'.repeat(1 + Math.floor(w.t * 2) % 3)}`, VW / 2, VH - 6, {
            size: 7, color: PAL.accent2, align: 'center', baseline: 'middle',
        });
    }

    if (w.sayT > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(w.sayT / 0.6, 0, 1);
        rect(ctx, 0, HUD_H, VW, 11, 'rgba(6,8,12,0.75)');
        text(ctx, `"${w.say}"`, VW / 2, HUD_H + 5, { size: 7, color: PAL.ink, align: 'center', baseline: 'middle' });
        ctx.restore();
    }

    if (w.bannerT > 0) {
        drawBanner(ctx, w.bannerText, VW, 70, w.bannerColor, w.phase === 'over' ? 20 : 16);
    }

    if (w.phase === 'impact' && w.lastImpact?.kind === 'hit') {
        // The slow-motion beat: a bright freeze-flash held for the dramatic pause.
        const p = clamp(w.phaseT / 0.3, 0, 1);
        if (p < 1) {
            ctx.save();
            ctx.globalAlpha = (1 - p) * 0.55;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, VW, VH);
            ctx.restore();
        }
    }
};

/* ==================================================================== *
 * React component                                                       *
 * ==================================================================== */

const RooftopArtillery: React.FC<{
    opponent?: string;
    skill?: number;
    opponentNpcId?: string;
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ opponent = 'Some Guy', skill, opponentNpcId, onFinish, onQuit }) => {
    const { gameState } = useGame();
    const { player } = gameState;

    const npc: Opponent | undefined = opponentNpcId ? getOpponent(opponentNpcId) : undefined;
    const resolvedSkill = npc ? effectiveSkill(npc, player) : (skill ?? 0.5);
    const opponentName = npc?.name ?? opponent;

    const loadout = useMemo(() => rooftopLoadout(player), [player]);
    const weaponMeta = useMemo(() => {
        const m: Record<string, Weapon> = {};
        for (const w of loadout) m[w.id] = w;
        return m;
    }, [loadout]);

    const [done, setDone] = useState<null | boolean>(null);
    const { input, set, consume } = useInput(done === null);
    const [selectedWeapon, setSelectedWeapon] = useState('shoe');

    const worldRef = useRef<World | null>(null);
    if (!worldRef.current) {
        const w = createWorld((Date.now() ^ 0x726f6f66) | 0, opponentName, resolvedSkill);
        w.opponentSpriteId = npc?.spriteId;
        const sneaker = player.inventory[0]?.sneakerId;
        w.playerSneaker = sneaker ? lookForSneaker(sneaker) : FALLBACK_LOOK;
        for (const wpn of loadout) w.ammo[wpn.id] = wpn.uses ?? Infinity;
        if (npc) { w.say = challengeLine(npc); w.sayT = 3; }
        worldRef.current = w;
    }

    const hudRef = useRef({ you: 0, foe: 0, round: 1 });
    const [hud, setHud] = useState(hudRef.current);
    const doneRef = useRef(false);
    const finishedRef = useRef(false);

    const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
        const w = worldRef.current!;
        if (!doneRef.current) {
            const s = input.current;
            stepArtillery(w, dt, {
                left: s.left, right: s.right, up: s.up, down: s.down,
                a: s.a, b: s.b, aPress: consume('a'), bPress: consume('b'),
            });
            // The B button (inside stepArtillery) is the authority on the live
            // weapon while aiming; mirror it back so the rail's highlight and
            // the button cycle never fight over which chip is "selected".
            if (w.profileId !== selectedWeapon) setSelectedWeapon(w.profileId);
        }
        drawArtillery(ctx, w, weaponMeta);

        const h = hudRef.current;
        if (h.you !== w.throwers[0].hits || h.foe !== w.throwers[1].hits || h.round !== w.round) {
            hudRef.current = { you: w.throwers[0].hits, foe: w.throwers[1].hits, round: w.round };
            setHud(hudRef.current);
        }
        if (w.result && !doneRef.current) {
            doneRef.current = true;
            setDone(w.result === 'win');
        }
    }, [input, consume, selectedWeapon, weaponMeta]);

    const finish = () => {
        if (finishedRef.current || done === null) return;
        finishedRef.current = true;
        const w = worldRef.current!;
        const selfInflicted = w.stats.selfHits > 0 && !done;
        const line = done
            ? (npc ? winLineFlip(npc) : `You put ${opponentName} off the roof, ${w.throwers[0].hits}-${w.throwers[1].hits}.`)
            : selfInflicted
                ? `You hit yourself off your own roof at least once. ${opponentName} will never let this go.`
                : (npc ? lossLine(npc) : `${opponentName} finished the match ${w.throwers[1].hits}-${w.throwers[0].hits}.`);
        onFinish(done, line);
    };
    // winLine() is written for "they beat you"; flip the frame for a player win.
    const winLineFlip = (o: Opponent) => `You beat ${o.name}. ${winLine(o)}`;

    const w = worldRef.current!;
    const railLoadout = loadout.filter(wpn => (w.ammo[wpn.id] ?? 0) > 0);

    const selectWeapon = (id: string) => {
        // Tapping the rail only takes effect while actually aiming, and only
        // for something still in stock — same rule the B-button cycle follows.
        if (w.phase === 'aim' && (id === 'shoe' || (w.ammo[id] ?? 0) > 0)) w.profileId = id;
        setSelectedWeapon(id);
    };

    return (
        <ArcadeShell
            title="Rooftop Artillery"
            subtitle={`vs ${opponentName} — first to ${TARGET_HITS} direct hits`}
            width={VW}
            height={VH}
            running={done === null}
            onFrame={onFrame}
            onInput={set}
            actions={['THROW', 'WEAPON']}
            vertical
            onQuit={done === null ? onQuit : undefined}
            quitLabel="Climb Down"
            loadout={railLoadout}
            selectedWeapon={selectedWeapon}
            onSelectWeapon={selectWeapon}
            hud={
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="chip">
                        YOU <b className="numeric text-[var(--accent)] ml-1">{hud.you}</b>
                    </span>
                    <span className="label">Round {hud.round}</span>
                    <span className="chip">
                        <b className="numeric text-[var(--accent2)] mr-1">{hud.foe}</b> {opponentName.toUpperCase().slice(0, 10)}
                    </span>
                </div>
            }
            overlay={
                done === null ? undefined : (
                    <MiniGameResult
                        won={done}
                        headline={done ? 'Rooftop Cleared' : 'Knocked Off The Roof'}
                        detail={
                            done
                                ? `${w.throwers[0].hits} direct hits to ${w.throwers[1].hits}.`
                                : `${opponentName} finished it ${w.throwers[1].hits}-${w.throwers[0].hits}.`
                        }
                        onClose={finish}
                        closeLabel={done ? 'Collect' : 'Climb Down'}
                    />
                )
            }
            help={
                `Up/Down sets the angle, Left/Right sets the power, A throws. Wind is shown top-centre as an arrow and a number — `
                + `it pushes your shot sideways the whole flight, so aim upwind of where you actually want to land. The dotted arc `
                + `by the release only shows the first instant of flight on purpose: it tells you the launch, not the landing. `
                + `A hit carves a real hole in whatever it lands on, and that hole is still there next throw — tunnel through a `
                + `building instead of arcing all the way over it if that is the shot. First to ${TARGET_HITS} direct hits wins. `
                + 'Hitting your own building — or, memorably, yourself — counts against you, so a wild low-angle shot is a real risk, not a wasted turn. '
                + `B cycles through anything you are carrying — the chancla nudges itself toward the target, the frisbee barely drops and can punch through a building, `
                + 'the slushie gets thrown around by the wind and splashes a wide crater, the bureka drops like a brick, and the dog launcher fires fast and flat but runs out.'
            }
        />
    );
};

export default RooftopArtillery;
