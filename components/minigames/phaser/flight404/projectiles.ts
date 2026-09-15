/**
 * The food.
 *
 * Two projectile systems, and they are deliberately **not** one projectile with
 * two sprites. That is the entire joke: hummus is soft and falafel is hard, and
 * a player has to be able to tell which one is in the air without reading the
 * pixels. The moment this collapses into `{ bounciness: 0 }` and
 * `{ bounciness: 0.6 }` the bit is dead — because a parameter is something a
 * programmer can see and a *behaviour* is something a player can see.
 *
 * So they share exactly one thing, and it is not a projectile type: they share
 * **gravity**, which belongs to the world rather than to the food. `GRAVITY`
 * comes from `content.ts` and the arc integration below is common. Everything
 * that happens *after contact* — the interesting half — is written twice, on
 * purpose, and the two halves have no branch in common:
 *
 *   hummus   arrives and stops. There is no restitution term in this file's
 *            hummus half at all. It smears, it slides down a vertical face,
 *            it can ride an NPC for a few seconds, and then it fades. Splut.
 *   falafel  arrives and leaves again. BOING → BOING → BOING, losing energy
 *            every time, until it is too tired to bounce and rolls to a stop.
 *
 * A knocked-over bowl does *not* invent a damage model. It names an explosion
 * and goes through `caughtInBlast`, same as every barrel and crate, which is
 * how a bowl going over can start a chain with no chain-specific code.
 *
 * Nothing here imports Phaser, touches the DOM, or holds a sprite. Every
 * function is pure and every stepper is a `(state, dt) -> state` so a barrage
 * can be run to completion in a test — which matters more here than anywhere
 * else in this folder, because "it eventually stops" is a claim about physics
 * and the way you check a claim about physics is arithmetic, not playtesting.
 */

import { GRAVITY, FLOOR_Y } from './content';
import { caughtInBlast, type ExplosionKind } from './explosions';

/** Kinematics, shared because gravity is the world's. Behaviour is not shared. */
export interface Arc {
    x: number;
    y: number;
    /** Pixels per second. `+y` is downward, as everywhere else in this game. */
    vx: number;
    vy: number;
}

/** One ballistic step. Semi-implicit Euler: stable, and cheap enough to spam. */
const fly = (a: Arc, dt: number): Arc => {
    const vy = a.vy + GRAVITY * dt;
    return { x: a.x + a.vx * dt, y: a.y + vy * dt, vx: a.vx, vy };
};

/**
 * The launch velocity that puts a throw at (toX, toY) in `flight` seconds.
 *
 * Solving for time rather than for angle is the right way round for a thrown
 * lunch: a fixed flight time means every throw in a barrage has the same
 * readable hang-time regardless of range, so a player learns one rhythm.
 */
export function arcVelocity(
    fromX: number, fromY: number, toX: number, toY: number, flight: number,
): { vx: number; vy: number } {
    const t = Math.max(0.05, flight);
    return {
        vx: (toX - fromX) / t,
        vy: (toY - fromY) / t - 0.5 * GRAVITY * t,
    };
}

/** How long a throw hangs. Hummus floats; falafel is thrown, not lobbed. */
export const HUMMUS_FLIGHT = 0.9;
export const FALAFEL_FLIGHT = 0.55;

/** Aim jitter, in pixels, so a barrage spreads instead of stacking. */
export const SPREAD = 14;

const jitter = (rng: () => number): number => (rng() * 2 - 1) * SPREAD;

// ---------------------------------------------------------------------------
// HUMMUS — soft. It arrives and it stops.
// ---------------------------------------------------------------------------

/**
 * What a blob is doing. Note the absence of anything resembling a bounce: the
 * only exits from `flight` are `smear` and `stuck`.
 */
export type HummusPhase = 'flight' | 'smear' | 'stuck';

/** What it hit. The scene reports this; it is not something we can work out. */
export type HummusContact =
    | { surface: 'ground' }            // floor, counter, bin lid: it sits there
    | { surface: 'vertical' }          // a sign or a wall: it smears, then slides
    | { surface: 'npc'; id: number };  // it rides him for a while

export interface HummusState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    phase: HummusPhase;
    /** Radius-ish, in pixels. A bowlful makes a bigger mark than a handful. */
    size: number;
    /**
     * Seconds left in the current phase. In `flight` this is a fuse, not a
     * lifetime: a blob thrown off the top of the level that never meets a
     * surface still has to stop existing, so it splats where it is.
     */
    life: number;
    /** Downward creep, px/s, only ever non-zero after hitting something upright. */
    slide: number;
    /** Which NPC is wearing it, if any. */
    stuckTo: number | null;
}

/** How long a mark stays on the world before it is gone. */
export const SMEAR_LIFE = 4.5;
/** The tail of that, spent fading. Also the whole life of a blob peeling off. */
export const SMEAR_FADE = 1.2;
/** How long an NPC wears it. Long enough to be noticed, short enough to be a gag. */
export const STICK_LIFE = 3;
/** A blob that meets nothing still dies. Nothing in this file lives forever. */
export const HUMMUS_FUSE = 6;
/** Initial creep down a sign, px/s, and the time constant it decays on. */
export const SLIDE_SPEED = 26;
export const SLIDE_TAU = 0.8;

/**
 * Total slide is `SLIDE_SPEED * SLIDE_TAU` ≈ 21px and cannot exceed it, because
 * the creep decays exponentially. A smear that slid forever would eventually
 * leave the sign it is on, which looks like a bug rather than like hummus.
 */
export const SLIDE_REACH = SLIDE_SPEED * SLIDE_TAU;

export function launchHummus(
    fromX: number, fromY: number, toX: number, toY: number,
    size = 5, flight = HUMMUS_FLIGHT, rng: () => number = Math.random,
): HummusState {
    const v = arcVelocity(fromX, fromY, toX + jitter(rng), toY + jitter(rng), flight);
    return {
        x: fromX, y: fromY, vx: v.vx, vy: v.vy,
        phase: 'flight', size, life: HUMMUS_FUSE, slide: 0, stuckTo: null,
    };
}

/**
 * Contact. There is no velocity left afterwards and no `restitution` anywhere
 * near this function — that is the point of having written it separately from
 * the falafel one. It hits, it is now a mark on the world.
 */
export function splat(h: HummusState, c: HummusContact, rng: () => number = Math.random): HummusState {
    const spent = { ...h, vx: 0, vy: 0, slide: 0, stuckTo: null as number | null };
    if (c.surface === 'npc') {
        // Riding an NPC, so the scene parents it to him and stops asking us where
        // it is. He is not damaged by this and he does not get to shake it off.
        return { ...spent, phase: 'stuck', stuckTo: c.id, life: STICK_LIFE };
    }
    if (c.surface === 'vertical') {
        // A sign gets the good version: it clings, sags, and gives up.
        return { ...spent, phase: 'smear', life: SMEAR_LIFE, slide: SLIDE_SPEED * (0.7 + rng() * 0.6) };
    }
    return { ...spent, phase: 'smear', life: SMEAR_LIFE };
}

export interface HummusStep {
    state: HummusState;
    /** The ridiculous soft splut, this frame only. Pure presentation. */
    sound: 'splut' | null;
}

/**
 * Advances one blob.
 *
 * The floor is handled here rather than by the scene because the floor is the
 * one surface that is always there, which makes a barrage runnable — and
 * therefore checkable — with no level loaded at all.
 */
export function stepHummus(
    h: HummusState, dt: number, groundY: number = FLOOR_Y, rng: () => number = Math.random,
): HummusStep {
    if (h.life <= 0) return { state: h, sound: null };

    if (h.phase === 'flight') {
        const fuse = h.life - dt;
        const next = fly(h, dt);
        // Either it met the floor or its fuse ran out; both end the same way,
        // because a blob that simply vanished mid-air would read as a miss.
        if (next.y >= groundY || fuse <= 0) {
            const landed = { ...h, x: next.x, y: Math.min(next.y, groundY), vx: next.vx, vy: next.vy };
            return { state: splat(landed, { surface: 'ground' }, rng), sound: 'splut' };
        }
        return { state: { ...h, ...next, life: fuse }, sound: null };
    }

    const life = h.life - dt;

    if (h.phase === 'stuck') {
        if (life > 0) return { state: { ...h, life }, sound: null };
        // It peels off him and finishes fading wherever it lands. It does not
        // become a live projectile again: hummus that falls off a man and then
        // hurts you is a rule no player could ever see.
        return { state: { ...h, phase: 'smear', stuckTo: null, life: SMEAR_FADE }, sound: null };
    }

    // Smearing. The creep down a sign decays, so total travel is bounded.
    const slide = h.slide > 0 ? h.slide * Math.exp(-dt / SLIDE_TAU) : 0;
    const y = Math.min(h.y + h.slide * dt, groundY);
    return { state: { ...h, y, slide: slide < 0.5 ? 0 : slide, life: Math.max(0, life) }, sound: null };
}

export const hummusAlive = (h: HummusState): boolean => h.life > 0;

/** 1 while it is wet, ramping to 0 over the last `SMEAR_FADE` seconds. */
export const hummusAlpha = (h: HummusState): number =>
    h.phase === 'flight' ? 1 : Math.max(0, Math.min(1, h.life / SMEAR_FADE));

/**
 * The slick a smear leaves on a walkable surface, for the scene to paint with
 * `SURFACE.hummus` (`SOLID | SLIPPERY`). Wider than the blob, because a patch
 * you can see and not slip on is worse than no patch at all.
 */
export const smearPatch = (h: HummusState): { x: number; y: number; w: number } => ({
    x: h.x - h.size * 1.5, y: h.y, w: h.size * 3,
});

// ---------------------------------------------------------------------------
// FALAFEL — hard. It arrives and it leaves again.
// ---------------------------------------------------------------------------

/** What it rang off. Each has its own bounciness; the tray has its own sound. */
export type FalafelSurface = 'floor' | 'wall' | 'crate' | 'sign' | 'enemy' | 'tray';

/** Which way the surface faces. `y` is a floor or a lid, `x` is upright. */
export interface FalafelContact { surface: FalafelSurface; axis: 'x' | 'y' }

/**
 * How much speed survives a bounce. All strictly below 1, which together with
 * the tangential friction below is the whole termination argument: every
 * bounce is strictly slower than the one before it, so the energy floor is
 * always reached, and `MAX_BOUNCES` is a belt on top of those braces.
 */
export const RESTITUTION: Record<FalafelSurface, number> = {
    floor: 0.5,   // aisle tiles, and whatever has already been spilled on them
    wall: 0.55,
    crate: 0.46,
    sign: 0.62,   // sheet metal, and it rattles
    enemy: 0.34,  // a man absorbs most of it, and objects to the rest
    tray: 0.7,    // the shawarma guy's tray. The best bounce in the market.
};

/** Sideways speed kept across a bounce. Below 1, so a skid always decays. */
export const BOUNCE_FRICTION = 0.82;
/** Below this much speed into the surface, it has nothing left. It settles. */
export const BOUNCE_FLOOR = 42;
/** A hard cap, so a pathological surface cannot produce an infinite rattle. */
export const MAX_BOUNCES = 8;
/** Seconds it may exist at all, and how long it lingers once it has stopped. */
export const FALAFEL_LIFE = 5;
export const SETTLE_LIFE = 1.4;
/** Rolling drag once it is down, px/s². It stops; it does not glide off-screen. */
export const ROLL_DRAG = 260;

export interface FalafelState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    /** How many times it has rung off something. Caps at `MAX_BOUNCES`. */
    bounces: number;
    /** It has stopped bouncing. It may still be rolling to a stop. */
    settled: boolean;
    /** Seconds left before it despawns. Always finite. */
    life: number;
    /** Cosmetic spin, rad/s, so it reads as a hard little object in flight. */
    spin: number;
}

export function throwFalafel(
    fromX: number, fromY: number, toX: number, toY: number,
    flight = FALAFEL_FLIGHT, rng: () => number = Math.random,
): FalafelState {
    const v = arcVelocity(fromX, fromY, toX + jitter(rng), toY + jitter(rng), flight);
    return {
        x: fromX, y: fromY, vx: v.vx, vy: v.vy,
        bounces: 0, settled: false, life: FALAFEL_LIFE, spin: (rng() * 2 - 1) * 12,
    };
}

export const speedOf = (f: FalafelState): number => Math.hypot(f.vx, f.vy);

export interface FalafelStep {
    state: FalafelState;
    /** BOING, or CLANG off the tray. Nobody in the background looks up. */
    sound: 'boing' | 'clang' | null;
}

/**
 * One bounce.
 *
 * The random wobble is always ≤ 1, never above, so a bounce can be scruffier
 * than the table says but never livelier. A projectile that can gain energy
 * from a random number is a projectile that can rattle in a corner forever.
 */
export function bounceFalafel(
    f: FalafelState, c: FalafelContact, rng: () => number = Math.random,
): FalafelStep {
    if (f.settled || f.life <= 0) return { state: f, sound: null };

    const e = RESTITUTION[c.surface] * (0.88 + rng() * 0.12);
    const into = Math.abs(c.axis === 'y' ? f.vy : f.vx);
    const bounces = f.bounces + 1;

    // Out of energy, or out of patience. Either way it is done bouncing.
    if (into * e < BOUNCE_FLOOR || bounces >= MAX_BOUNCES) {
        return {
            state: {
                ...f,
                vx: c.axis === 'x' ? 0 : f.vx * BOUNCE_FRICTION,
                vy: 0,
                bounces, settled: true,
                life: Math.min(f.life, SETTLE_LIFE),
            },
            sound: null,
        };
    }

    const state: FalafelState = c.axis === 'y'
        ? { ...f, vy: -Math.abs(f.vy) * e, vx: f.vx * BOUNCE_FRICTION, bounces }
        : { ...f, vx: -f.vx * e, vy: f.vy * BOUNCE_FRICTION, bounces };
    // He does not react. That is his entire part in this.
    return { state, sound: c.surface === 'tray' ? 'clang' : 'boing' };
}

/**
 * Advances one falafel, bouncing it off the floor itself for the same reason
 * the hummus stepper lands on the floor itself: so a storm of them can be run
 * to its last frame without a scene. Walls, crates, signs, enemies and the
 * shawarma guy's tray are the scene's business — it calls `bounceFalafel`.
 */
export function stepFalafel(
    f: FalafelState, dt: number, groundY: number = FLOOR_Y, rng: () => number = Math.random,
): FalafelStep {
    if (f.life <= 0) return { state: f, sound: null };
    const life = Math.max(0, f.life - dt);

    if (f.settled) {
        // Rolling to a stop. Linear drag, so it reaches exactly zero in finite
        // time rather than approaching it forever.
        const drag = ROLL_DRAG * dt;
        const vx = Math.abs(f.vx) <= drag ? 0 : f.vx - Math.sign(f.vx) * drag;
        return { state: { ...f, x: f.x + vx * dt, vx, life }, sound: null };
    }

    const next = fly(f, dt);
    if (next.y >= groundY) {
        const landed = { ...f, x: next.x, y: groundY, vx: next.vx, vy: next.vy, life };
        return bounceFalafel(landed, { surface: 'floor', axis: 'y' }, rng);
    }
    return { state: { ...f, ...next, life }, sound: null };
}

export const falafelAlive = (f: FalafelState): boolean => f.life > 0;

/**
 * Does this one go past the game and into the background?
 *
 * Rare on purpose. The tray gag is funny once a run and furniture by the
 * fourth time, exactly like `BEAT_EVERY` in `background.ts`.
 */
export const TRAY_CHANCE = 0.06;
export const ringsOffTray = (rng: () => number = Math.random): boolean => rng() < TRAY_CHANCE;

// ---------------------------------------------------------------------------
// The bowl. A hazard, briefly, and then somebody else's problem.
// ---------------------------------------------------------------------------

export interface BowlState {
    x: number;
    y: number;
    /** Along the floor, px/s. */
    vx: number;
    /**
     * The gradient under it, roughly tan(angle), clamped to ±1. Positive rolls
     * it to the right. A market floor is never flat and that is free comedy.
     */
    slope: number;
    /** Radius. Past `BIG_BOWL` it is a catering tub and it goes off like one. */
    size: number;
    /** Seconds left. It is a *temporary* hazard; see the comment below. */
    life: number;
    broken: boolean;
}

/** A bowl this big or bigger goes out on the big blast. */
export const BIG_BOWL = 11;
/** How much of gravity a round bowl converts into roll. */
export const ROLL_GRIP = 0.42;
/** It is a hazard, not a vehicle; past this it just looks silly. */
export const ROLL_MAX = 140;
/** Rolling resistance, px/s². Guarantees a flat floor stops it. */
export const BOWL_DRAG = 34;
/** Under this it has stopped, and stopping is what breaks it open. */
export const ROLL_STOP = 6;
/**
 * The hard ceiling on a bowl's existence.
 *
 * A downhill bowl is accelerating, so friction alone will never stop one on a
 * real slope — without this, a bowl on a long enough ramp is an immortal
 * hazard leaving the level. It breaks when the timer runs out, which is also
 * the funnier ending.
 */
export const BOWL_LIFE = 7;

/** `push` is the shove that knocked it over; on a flat floor it is all it gets. */
export const openBowl = (x: number, y: number, slope: number, size = 8, push = 0): BowlState => ({
    x, y, vx: push,
    slope: Math.max(-1, Math.min(1, slope)),
    size, life: BOWL_LIFE, broken: false,
});

/** Which shared blast it goes out on. Never `tiny` — a tiny blast cannot hurt. */
export const bowlBlast = (b: Pick<BowlState, 'size'>): ExplosionKind =>
    b.size >= BIG_BOWL ? 'big' : 'small';

/**
 * Damage, borrowed wholesale from `explosions.ts` rather than reinvented.
 *
 * This is the one that matters: a bowl going over runs through exactly the same
 * radial check as a crate, so a bowl that takes out a crate that takes out a
 * bowl is a chain reaction nobody wrote any chain-reaction code for.
 */
export const caughtInSpill = (b: Pick<BowlState, 'size'>, distance: number): boolean =>
    caughtInBlast(bowlBlast(b), distance);

export interface BowlStep {
    state: BowlState;
    /** It just came apart this frame — spend the blast and the spray. */
    burst: boolean;
}

/** Rolls it downhill. Every exit from this function is an ending. */
export function stepBowl(b: BowlState, dt: number): BowlStep {
    if (b.broken) return { state: b, burst: false };

    const life = b.life - dt;
    if (life <= 0) return { state: { ...b, life: 0, broken: true }, burst: true };

    const drag = BOWL_DRAG * dt;
    let vx = b.vx + b.slope * GRAVITY * ROLL_GRIP * dt;
    vx = Math.abs(vx) <= drag ? 0 : vx - Math.sign(vx) * drag;
    vx = Math.max(-ROLL_MAX, Math.min(ROLL_MAX, vx));

    // It came to rest on the flat, which is how a bowl ends up on its side.
    if (Math.abs(vx) < ROLL_STOP && Math.abs(b.slope) * GRAVITY * ROLL_GRIP < BOWL_DRAG) {
        return { state: { ...b, vx: 0, life, broken: true }, burst: true };
    }
    return { state: { ...b, x: b.x + vx * dt, vx, life }, burst: false };
}

export const bowlAlive = (b: BowlState): boolean => !b.broken && b.life > 0;

/**
 * What comes out of a bowl going over: a fan of arcs, scaled by how much bowl
 * there was. Fed straight back into `stepHummus`, so a spill and a thrown
 * handful are the same substance — which they had better be.
 */
export function spillBowl(b: BowlState, rng: () => number = Math.random): HummusState[] {
    const count = Math.max(3, Math.round(b.size * 0.7));
    const out: HummusState[] = [];
    for (let i = 0; i < count; i++) {
        // Fanned across the roll direction, so a spill reads as a spill and not
        // as somebody firing hummus out of a bowl.
        const lead = b.vx >= 0 ? 1 : -1;
        const reach = 18 + rng() * 46;
        out.push(launchHummus(
            b.x, b.y, b.x + lead * reach, b.y - 8 - rng() * 22,
            Math.max(3, b.size * 0.4), HUMMUS_FLIGHT * (0.7 + rng() * 0.5), rng,
        ));
    }
    return out;
}
