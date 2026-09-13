import React, { useCallback, useRef, useState } from 'react';
import { MiniGameResult } from './MiniGameShell';
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
    glyph,
    shadow,
    bar,
    actor,
    SWAP,
    band,
    shakeOffset,
    banner as drawBanner,
} from './engine';

/**
 * HOOPS — 2-on-2 street basketball, NBA Jam register.
 *
 * Replaces the old text-menu StreetBall. Side-on full court, two hoops, four
 * block humanoids, exaggerated everything. You are playing a stranger for a
 * pair of shoes; the commentator has opinions.
 *
 * Architecture notes (these matter more than the basketball):
 *  - The entire simulation lives in a plain object (`World`) held in a ref and
 *    mutated inside the 60Hz frame callback. React state is used ONLY for the
 *    HUD numbers and the game-over flag, and even those are written only when
 *    the *displayed* value changes. Re-rendering React every frame stalls the
 *    loop on a phone.
 *  - `stepWorld` and `drawWorld` are separate and `stepWorld` touches nothing
 *    DOM-shaped, so the whole game can be simulated headless in Node.
 *  - All randomness goes through a seeded RNG on the world, so a headless run
 *    is reproducible.
 */

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const VW = 352;
const VH = 198;

/** Player x bounds. The fence is at the very edge; this is the playable floor. */
const COURT_L = 34;
const COURT_R = 318;
/** Depth (z) runs 0 = far sideline, 1 = near sideline. */
const Z_MIN = 0.06;
const Z_MAX = 0.97;

const FLOOR_BACK_Y = 130;
const FLOOR_FRONT_Y = 184;
const CENTER_X = VW / 2;

/** Screen y of the floor at depth z. */
const floorY = (z: number) => FLOOR_BACK_Y + z * (FLOOR_FRONT_Y - FLOOR_BACK_Y);
/**
 * Fake perspective: everything far away is drawn slightly smaller and pulled
 * toward the centre of the screen. One scale function for positions, heights
 * and figure sizes keeps the cheat consistent.
 */
const sc = (z: number) => 0.86 + 0.14 * z;
const screenX = (x: number, z: number) => CENTER_X + (x - CENTER_X) * sc(z);
const screenY = (z: number, height: number) => floorY(z) - height * sc(z);

/**
 * Depth counts for ~70px when measuring distance, i.e. crossing the whole
 * court sideline-to-sideline is worth about a quarter of its length. Anything
 * bigger and defenders could never rotate; anything smaller and depth stops
 * mattering at all.
 */
const Z_PX = 70;
const dist2d = (ax: number, az: number, bx: number, bz: number) =>
    Math.hypot(ax - bx, (az - bz) * Z_PX);

interface Hoop { x: number; z: number; h: number; inward: 1 | -1 }
/** Rim height 46px against a ~26px player: dunkable only with an absurd leap. */
const HOOPS: [Hoop, Hoop] = [
    { x: 30, z: 0.45, h: 46, inward: 1 },
    { x: 322, z: 0.45, h: 46, inward: -1 },
];
/** Team 0 (you) attacks the right rim, team 1 attacks the left one. */
const attackHoop = (team: number) => (team === 0 ? 1 : 0);

/* ------------------------------------------------------------------ */
/* Balance constants — tuned by playing, commented so they stay honest */
/* ------------------------------------------------------------------ */

const GAME_SECONDS = 90;
const TARGET_SCORE = 21;

const BASE_SPEED = 76;          // px/s. Court is 284px wide: ~3.7s end to end.
const TURBO_MULT = 1.52;        // turbo is worth it, but the bar only lasts ~3s
const FIRE_MULT = 1.3;          // on fire you are simply faster than everyone
const TURBO_DRAIN = 0.34;       // per second of held turbo
const TURBO_REGEN = 0.22;       // per second while off — slower than the drain

const GRAVITY = 430;            // px/s^2 for loose balls. Arcade-heavy, snappy.
const JUMP_V = 168;             // apex ~33px: enough to contest, not to fly
const DUNK_RANGE = 42;          // inside this you slam instead of shoot
const CONTEST_R = 28;           // a defender this close starts hurting the shot
const BLOCK_R = 16;             // airborne defender inside this can swat it
const STEAL_R = 14;
const THREE_DIST = 118;         // beyond this a bucket is worth 3

const SHOT_CHARGE_TIME = 0.62;  // seconds for the release meter to fill
const SHOT_SWEET = 0.84;        // sweet spot near the top of the meter
const SHOT_WINDOW = 0.30;       // half-width of the window that still scores
const SHOT_COOK = 1.1;          // hold past this and the shot is "overcooked"

const AI_SKILL = 1;          // opponents are worse than a perfect release
const MATE_SKILL = 0.84;        // your teammate is worse than that. He tries.
const SHOT_CLOCK = 15;
const FIRE_STREAK = 3;          // classic: three straight makes and you ignite
const FIRE_SECONDS = 22;        // hard ceiling so a hot run can't last forever

/* ------------------------------------------------------------------ */
/* Commentary                                                          */
/* ------------------------------------------------------------------ */

const SAY = {
    make: [
        'Count it. And the trash talk.',
        'Wet. Absolutely wet.',
        'He says he plays overseas.',
        'Somebody get that man a contract.',
        'That was NOT a foul, by the way.',
    ],
    three: [
        'From the other area code!',
        'He shot that from a different zip code.',
        'Deep! Deeper than his knowledge of the rules.',
    ],
    dunk: [
        'BOOMSHAKALAKA!',
        'The rim owes him money!',
        'Somebody check on that backboard.',
        'He dunked it and then apologised. Sort of.',
    ],
    miss: [
        'Off the back iron.',
        'Bricklayer. Union card and everything.',
        'He blames the shoes. The shoes are fine.',
        'That was a pass. That was definitely a pass.',
    ],
    steal: [
        'Pickpocket!',
        'He took that like rent money.',
        'That was NOT a foul.',
    ],
    block: [
        'GET THAT OUTTA HERE!',
        'Rejected into the fence.',
        'Swatted. Into next Tuesday.',
    ],
    heat: ['He is heating up!', 'Two in a row — he is feeling it.'],
    fire: ['HE IS ON FIRE!', 'CALL THE FIRE DEPARTMENT!'],
    cold: ['The fire is out. Order restored.', 'They put him out. Barely.'],
    tip: ['Check it up. Make it take it.', 'Shoes on the line. Let us begin.'],
};

/* ------------------------------------------------------------------ */
/* World types                                                         */
/* ------------------------------------------------------------------ */

/**
 * A colourway. `main`/`trim`/`skin` are the CSS colours the block `figure()`
 * fallback uses; `sprite` + `swap` are the pixel-art equivalent. Both are kept
 * so that a missing sprite file still produces a correctly coloured player
 * rather than an empty court — see `actor()` in engine/draw.ts.
 */
interface Kit {
    main: string;
    trim: string;
    skin: string;
    /** Registered sprite id. */
    sprite: string;
    /** Palette recolour applied to that sprite. */
    swap: Record<string, string>;
}

interface Player {
    id: number;
    team: 0 | 1;
    human: boolean;
    name: string;
    kit: Kit;
    x: number; z: number;
    vx: number; vz: number;
    facing: 1 | -1;
    stride: number;
    /** Height above the floor and its velocity — used for jumps and dunks. */
    y: number; vy: number;
    turbo: number;              // 0..1
    /** Charge on the release meter; < 0 means "not shooting". */
    charge: number;
    /** Counts consecutive made buckets; FIRE_STREAK of them lights you up. */
    streak: number;
    onFire: boolean;
    fireT: number;
    /** Lockout after a steal attempt / a shot, so nothing can be spammed. */
    cool: number;
    /** Seconds since this player gained possession. Stops pass ping-pong. */
    touchT: number;
    /** Scripted dunk animation, 0 when not dunking. */
    dunkT: number;
    dunkDur: number;
    dunkFrom: { x: number; z: number };
    dunkHoop: number;
    dunkSlammed: boolean;
    aiTimer: number;            // AI re-decides on a cadence, not every frame
}

type BallMode = 'held' | 'flight' | 'loose';

interface Ball {
    x: number; z: number; y: number;
    vx: number; vz: number; vy: number;
    mode: BallMode;
    spin: number;
    /** Parametric flight (shots and passes) — a lerp plus a parabola. */
    t: number; dur: number;
    sx: number; sz: number; sy: number;
    tx: number; tz: number; ty: number;
    arc: number;
    kind: 'shot' | 'pass' | 'heave';
    made: boolean;
    pts: number;
    shooter: number;
    target: number;
    looseT: number;
    pickCool: number;
}

interface Particle { x: number; z: number; y: number; vx: number; vy: number; life: number; max: number; kind: 'fire' | 'spark' }

export interface World {
    seed: number;
    rngState: number;
    opponent: string;
    t: number;
    clock: number;
    score: [number, number];
    players: Player[];
    ball: Ball;
    /** Index of the player holding the ball, or null if it is live. */
    possession: number | null;
    shotClock: number;
    phase: 'tip' | 'play' | 'score' | 'over';
    phaseT: number;
    shake: number;
    bannerText: string;
    bannerT: number;
    bannerColor: string;
    say: string;
    sayT: number;
    rimFlash: [number, number];
    parts: Particle[];
    /** Last team to score, used to drive the inbound. */
    lastScorer: 0 | 1;
    winner: 0 | 1 | null;
    /** Diagnostics the headless simulation asserts on. */
    stats: { shots: number; makes: number; dunks: number; steals: number; blocks: number };
}

export interface Cmd {
    left: boolean; right: boolean; up: boolean; down: boolean;
    a: boolean; b: boolean;
    aPress: boolean; bPress: boolean;
}

export const blankCmd = (): Cmd => ({
    left: false, right: false, up: false, down: false,
    a: false, b: false, aPress: false, bPress: false,
});

/* ------------------------------------------------------------------ */
/* Utility                                                             */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** mulberry32 — tiny, fast, seedable. Determinism makes the sim testable. */
const rng = (w: World) => {
    w.rngState = (w.rngState + 0x6d2b79f5) | 0;
    let t = w.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(w: World, arr: readonly T[]): T => arr[Math.floor(rng(w) * arr.length) % arr.length];

const say = (w: World, s: string) => { w.say = s; w.sayT = 3.4; };
const shout = (w: World, s: string, color: string, hold = 1.4) => {
    w.bannerText = s; w.bannerT = hold; w.bannerColor = color;
};

const teammateOf = (w: World, p: Player) => w.players.find(o => o.team === p.team && o.id !== p.id)!;
const opponentsOf = (w: World, p: Player) => w.players.filter(o => o.team !== p.team);

/** Distance from the nearest opposing player — "how open am I". */
const openness = (w: World, p: Player) => {
    let best = 999;
    for (const o of w.players) {
        if (o.team === p.team) continue;
        best = Math.min(best, dist2d(p.x, p.z, o.x, o.z));
    }
    return best;
};

const hoopDist = (p: { x: number; z: number }, h: Hoop) => dist2d(p.x, p.z, h.x, h.z);

/* ------------------------------------------------------------------ */
/* World construction                                                  */
/* ------------------------------------------------------------------ */

const mkPlayer = (
    id: number, team: 0 | 1, human: boolean, name: string, kit: Kit, x: number, z: number,
): Player => ({
    id, team, human, name, kit,
    x, z, vx: 0, vz: 0,
    facing: team === 0 ? 1 : -1,
    stride: 0, y: 0, vy: 0,
    turbo: 1, charge: -1, streak: 0, onFire: false, fireT: 0, touchT: 0,
    cool: 0, dunkT: 0, dunkDur: 0, dunkFrom: { x, z }, dunkHoop: 0, dunkSlammed: false,
    aiTimer: 0,
});

const mkBall = (): Ball => ({
    x: CENTER_X, z: 0.5, y: 10,
    vx: 0, vz: 0, vy: 0,
    mode: 'held', spin: 0,
    t: 0, dur: 1, sx: 0, sz: 0, sy: 0, tx: 0, tz: 0, ty: 0, arc: 0,
    kind: 'pass', made: false, pts: 2, shooter: 0, target: 0,
    looseT: 0, pickCool: 0,
});

/**
 * Four kits, split cool (your team) against warm (theirs) so a glance at the
 * pile tells you whose ball it is. The trims are deliberately brighter than the
 * shared KIT defaults: `figure()` draws legs in the trim colour and near-black
 * shorts simply vanish against a night-time blacktop.
 */
const KITS: Record<'you' | 'mate' | 'foe' | 'cousin', Kit> = {
    // The sprites are authored with c/C as the kit colour and s/S as skin, so
    // one 24-row character grid yields all four players. 'player' is the base
    // sprite; the two ids below it are only used if that art file landed, and
    // actor() falls back to figure() for any id nobody drew.
    you: {
        main: KIT.player.main, trim: '#0c6d5e', skin: PAL.skin,
        sprite: 'player', swap: SWAP.teal,
    },
    mate: {
        main: '#2bd07a', trim: '#1b6b45', skin: PAL.skinDark,
        sprite: 'player', swap: { ...SWAP.green, ...SWAP.skinDark },
    },
    foe: {
        main: KIT.rival.main, trim: '#8d1a4c', skin: PAL.skinDark,
        sprite: 'player', swap: { ...SWAP.magenta, ...SWAP.skinDark },
    },
    cousin: {
        main: '#ff8c3a', trim: '#8a4413', skin: PAL.skin,
        sprite: 'player', swap: SWAP.gold,
    },
};

export const createWorld = (seed: number, opponent: string): World => {
    const foeName = (opponent || 'HIM').toUpperCase().slice(0, 12);
    const w: World = {
        seed,
        rngState: seed | 0,
        opponent: foeName,
        t: 0,
        clock: GAME_SECONDS,
        score: [0, 0],
        players: [
            mkPlayer(0, 0, true, 'YOU', KITS.you, 150, 0.62),
            mkPlayer(1, 0, false, 'BIG MIKE', KITS.mate, 120, 0.3),
            mkPlayer(2, 1, false, foeName, KITS.foe, 205, 0.4),
            mkPlayer(3, 1, false, 'HIS COUSIN', KITS.cousin, 235, 0.75),
        ],
        ball: mkBall(),
        possession: 0,
        shotClock: SHOT_CLOCK,
        phase: 'tip',
        phaseT: 1.8,
        shake: 0,
        bannerText: '', bannerT: 0, bannerColor: PAL.warn,
        say: '', sayT: 0,
        rimFlash: [0, 0],
        parts: [],
        lastScorer: 1,
        winner: null,
        stats: { shots: 0, makes: 0, dunks: 0, steals: 0, blocks: 0 },
    };
    say(w, pick(w, SAY.tip));
    return w;
};

/* ------------------------------------------------------------------ */
/* Possession helpers                                                  */
/* ------------------------------------------------------------------ */

const giveBall = (w: World, id: number) => {
    w.possession = id;
    w.players[id].touchT = 0;
    w.ball.mode = 'held';
    w.ball.pickCool = 0.25;
    w.shotClock = SHOT_CLOCK;
};

const looseBall = (w: World, x: number, z: number, y: number, vx: number, vy: number, vz = 0) => {
    const b = w.ball;
    w.possession = null;
    b.mode = 'loose';
    b.x = x; b.z = z; b.y = y;
    b.vx = vx; b.vy = vy; b.vz = vz;
    b.looseT = 0;
    b.pickCool = 0.18;
};

/**
 * Reset for an inbound after a bucket. The team that got scored on takes it
 * out under the rim they just conceded at, and everybody else jogs upcourt
 * looking unbothered.
 */
const inbound = (w: World, receivingTeam: 0 | 1) => {
    const h = HOOPS[attackHoop(1 - receivingTeam as 0 | 1)];
    const inw = h.inward;
    const recv = w.players.filter(p => p.team === receivingTeam);
    const other = w.players.filter(p => p.team !== receivingTeam);

    recv[0].x = clamp(h.x + inw * 38, COURT_L, COURT_R); recv[0].z = 0.66;
    recv[1].x = clamp(h.x + inw * 78, COURT_L, COURT_R); recv[1].z = 0.26;
    other[0].x = clamp(h.x + inw * 120, COURT_L, COURT_R); other[0].z = 0.42;
    other[1].x = clamp(h.x + inw * 158, COURT_L, COURT_R); other[1].z = 0.74;

    for (const p of w.players) {
        p.vx = 0; p.vz = 0; p.y = 0; p.vy = 0;
        p.charge = -1; p.cool = 0; p.dunkT = 0;
        p.facing = p.team === receivingTeam ? (inw as 1 | -1) : (-inw as 1 | -1);
    }
    giveBall(w, recv[0].id);
};

/* ------------------------------------------------------------------ */
/* Shooting model                                                      */
/* ------------------------------------------------------------------ */

/**
 * Base make chance from distance alone: ~90% at the rim falling to a prayer
 * from the far baseline. Linear because it is easy to reason about while
 * tuning, and because nobody in this alley has a shot chart.
 */
const baseFromDist = (d: number) => clamp(0.9 - Math.max(0, d - DUNK_RANGE) * 0.0034, 0.16, 0.9);

/** How badly the nearest defender is bothering this shot. */
const contestFactor = (w: World, p: Player) => {
    let d = 999;
    let airborne = false;
    for (const o of w.players) {
        if (o.team === p.team) continue;
        const dd = dist2d(p.x, p.z, o.x, o.z);
        if (dd < d) { d = dd; airborne = o.y > 8; }
    }
    if (d >= CONTEST_R) return 1;
    // Hand in the face takes almost half the shot away; a jumping contest more.
    const base = 0.46 + 0.54 * (d / CONTEST_R);
    return airborne ? base * 0.8 : base;
};

/** Release quality from the charge meter: 1 in the sweet spot, 0 at the edges. */
const releaseQuality = (charge: number) =>
    clamp(1 - Math.abs(charge - SHOT_SWEET) / SHOT_WINDOW, 0, 1);

const shotChance = (w: World, p: Player, q: number, skill: number) => {
    const h = HOOPS[attackHoop(p.team)];
    const d = hoopDist(p, h);
    // Release quality is the biggest lever the player actually controls.
    const rel = 0.5 + 0.75 * q;
    const fire = p.onFire ? 1.42 : 1;
    return clamp(baseFromDist(d) * contestFactor(w, p) * rel * fire * skill, 0.03, p.onFire ? 0.97 : 0.93);
};

const launchShot = (w: World, p: Player, q: number, skill: number, heave = false) => {
    const b = w.ball;
    const h = HOOPS[attackHoop(p.team)];
    const d = hoopDist(p, h);
    const made = rng(w) < (heave ? 0.08 : shotChance(w, p, q, skill));

    w.stats.shots++;
    p.charge = -1;
    p.cool = 0.35;
    p.facing = h.x > p.x ? 1 : -1;

    // A defender already in the air inside the block radius can eat it. NOT a
    // certainty: an automatic block made nearly every contested possession end
    // in a swat, which is spectacular twice and then just annoying.
    for (const o of opponentsOf(w, p)) {
        if (o.y > 10 && dist2d(o.x, o.z, p.x, p.z) < BLOCK_R && rng(w) < 0.55) {
            w.stats.blocks++;
            shout(w, 'REJECTED!', PAL.bad, 1.1);
            say(w, pick(w, SAY.block));
            w.shake = Math.max(w.shake, 5);
            looseBall(w, p.x + o.facing * 10, p.z, 24, o.facing * 70 + (rng(w) - 0.5) * 20, -40, (rng(w) - 0.5) * 0.4);
            return;
        }
    }

    b.mode = 'flight';
    b.kind = heave ? 'heave' : 'shot';
    b.shooter = p.id;
    b.made = made;
    b.pts = d > THREE_DIST ? 3 : 2;
    b.t = 0;
    // Longer shots hang longer and arc higher; you can watch it and hope.
    b.dur = 0.55 + d / 260;
    b.sx = p.x; b.sz = p.z; b.sy = 20 + p.y;
    b.tx = h.x; b.tz = h.z; b.ty = h.h;
    if (!made) {
        // A miss is aimed at the rim and misses it — front iron or long side.
        b.tx += (rng(w) < 0.5 ? -1 : 1) * (6 + rng(w) * 7) * h.inward;
        b.tz += (rng(w) - 0.5) * 0.16;
        b.ty += 2;
    }
    // Arc high enough to read as a jumper, capped so a full-court heave does
    // not disappear off the top of a 198px canvas.
    b.arc = Math.min(74, 24 + d * 0.13);
    w.possession = null;
};

const launchPass = (w: World, from: Player, to: Player) => {
    const b = w.ball;
    const d = dist2d(from.x, from.z, to.x, to.z);
    b.mode = 'flight';
    b.kind = 'pass';
    b.shooter = from.id;
    b.target = to.id;
    b.made = false;
    b.t = 0;
    b.dur = 0.2 + d / 420;      // passes are fast; this is not a patient sport
    b.sx = from.x; b.sz = from.z; b.sy = 18 + from.y;
    b.tx = to.x; b.tz = to.z; b.ty = 18;
    b.arc = 7;
    from.facing = to.x > from.x ? 1 : -1;
    from.cool = 0.2;
    w.possession = null;
};

const startDunk = (w: World, p: Player) => {
    const hi = attackHoop(p.team);
    // Non-zero: dunkT > 0 IS the "I am dunking" flag, and the frame loop hands
    // the body over to stepDunk on that test. Starting it at exactly 0 would
    // leave the dunk un-run and re-triggerable every frame.
    p.dunkT = 0.0001;
    p.dunkDur = 0.72;
    p.dunkFrom = { x: p.x, z: p.z };
    p.dunkHoop = hi;
    p.dunkSlammed = false;
    p.charge = -1;
    p.facing = HOOPS[hi].x > p.x ? 1 : -1;
    w.stats.shots++;
};

/* ------------------------------------------------------------------ */
/* Scoring + the ON FIRE state machine                                 */
/* ------------------------------------------------------------------ */

/**
 * The fire rules, stated once so they stay consistent:
 *  1. Three made buckets in a row by the SAME player lights that player up.
 *  2. While lit: faster, free turbo, a big shooting bonus, flame trail.
 *  3. The fire goes out when the OTHER team scores — that is the classic rule
 *     and it is what makes a hot streak feel like something to defend — or
 *     after FIRE_SECONDS, so a runaway can't decide the whole game.
 *  4. Any bucket by the other team also resets your streak counter, which is
 *     why "he's heating up" has to be earned in one possession run.
 */
const score = (w: World, scorer: Player, pts: number, viaDunk: boolean) => {
    w.score[scorer.team] += pts;
    w.lastScorer = scorer.team;
    w.stats.makes++;
    w.rimFlash[attackHoop(scorer.team)] = 0.55;

    scorer.streak++;
    for (const o of w.players) {
        if (o.team !== scorer.team) {
            o.streak = 0;                    // rule 4
            if (o.onFire) {                  // rule 3
                o.onFire = false; o.fireT = 0;
                say(w, pick(w, SAY.cold));
            }
        }
    }

    if (!scorer.onFire && scorer.streak >= FIRE_STREAK) {
        scorer.onFire = true;
        scorer.fireT = FIRE_SECONDS;
        shout(w, `${scorer.name} IS ON FIRE!`, PAL.warn, 2);
        say(w, pick(w, SAY.fire));
        w.shake = Math.max(w.shake, 4);
    } else if (viaDunk) {
        shout(w, pick(w, SAY.dunk).replace(/[.!]$/, '!'), PAL.legend, 1.5);
        say(w, pick(w, SAY.dunk));
    } else if (pts === 3) {
        shout(w, 'THREE!', PAL.accent, 1.1);
        say(w, pick(w, SAY.three));
    } else if (scorer.streak === 2) {
        shout(w, 'HEATING UP', PAL.warn, 1.1);
        say(w, pick(w, SAY.heat));
    } else {
        say(w, pick(w, SAY.make));
    }

    w.stats.dunks += viaDunk ? 1 : 0;
    w.phase = 'score';
    w.phaseT = viaDunk ? 1.15 : 0.95;
    w.possession = null;
    w.ball.mode = 'loose';
    const h = HOOPS[attackHoop(scorer.team)];
    w.ball.x = h.x; w.ball.z = h.z; w.ball.y = h.h - 6;
    w.ball.vx = h.inward * 12; w.ball.vy = -10; w.ball.vz = 0;

    if (w.score[scorer.team] >= TARGET_SCORE) endGame(w);
};

const endGame = (w: World) => {
    w.phase = 'over';
    w.phaseT = 0;
    w.winner = w.score[0] > w.score[1] ? 0 : 1;
    shout(w, w.winner === 0 ? 'YOU WIN!' : 'YOU LOSE', w.winner === 0 ? PAL.ok : PAL.bad, 99);
};

/* ------------------------------------------------------------------ */
/* Movement                                                            */
/* ------------------------------------------------------------------ */

const speedOf = (p: Player, turbo: boolean) => {
    let s = BASE_SPEED;
    if (p.onFire) s *= FIRE_MULT;
    if (turbo) s *= TURBO_MULT;
    if (p.charge >= 0) s *= 0.45;    // gathering for a shot slows you down
    return s;
};

const applyMove = (p: Player, dx: number, dz: number, speed: number, dt: number) => {
    // dz is in z-units; convert to the same scale as x so diagonal movement
    // isn't faster than straight movement.
    const len = Math.hypot(dx, dz * Z_PX);
    if (len < 0.001) { p.vx = 0; p.vz = 0; return; }
    const nx = dx / len;
    const nz = (dz * Z_PX) / len;
    p.vx = nx * speed;
    p.vz = (nz * speed) / Z_PX;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.stride += (speed * dt) / 11;
    if (Math.abs(nx) > 0.25) p.facing = nx > 0 ? 1 : -1;
};

const clampToCourt = (p: Player) => {
    p.x = clamp(p.x, COURT_L, COURT_R);
    p.z = clamp(p.z, Z_MIN, Z_MAX);
};

/* ------------------------------------------------------------------ */
/* AI                                                                  */
/* ------------------------------------------------------------------ */

/**
 * One decision routine for all three CPU players. It is deliberately a small
 * pile of rules rather than anything clever: chase the ball, respect spacing,
 * shoot when open, gamble on a steal occasionally. The difficulty knob is the
 * `skill` multiplier on their shots plus how eagerly they gamble, so they can
 * be beaten by a human who moves without the ball.
 */
const aiThink = (w: World, p: Player, dt: number) => {
    const b = w.ball;
    const hoop = HOOPS[attackHoop(p.team)];
    const ownHoop = HOOPS[attackHoop(1 - p.team as 0 | 1)];
    const skill = p.team === 0 ? MATE_SKILL : AI_SKILL;
    const gamble = p.team === 0 ? 0.5 : 1;   // your teammate does not gamble much
    let tx = p.x;
    let tz = p.z;
    let turbo = false;

    p.aiTimer = Math.max(0, p.aiTimer - dt);

    if (w.possession === p.id) {
        /* --- with the ball --------------------------------------------- */
        const d = hoopDist(p, hoop);
        const open = openness(w, p);
        const mate = teammateOf(w, p);

        // Drive at the rim, drifting to the depth lane the defence isn't in.
        // `inward` points from the rim toward mid-court, so ADD it: subtracting
        // parks the AI behind the backboard where it can only shoot bricks.
        tx = hoop.x + hoop.inward * 16;
        const nearestFoe = opponentsOf(w, p).sort(
            (a, c) => dist2d(a.x, a.z, p.x, p.z) - dist2d(c.x, c.z, p.x, p.z),
        )[0];
        tz = nearestFoe.z > 0.5 ? 0.28 : 0.72;
        // Burn turbo to cover ground, and again to shake a defender off the hip.
        turbo = p.turbo > 0.25 && (d > 60 || open < 14);

        if (p.cool <= 0) {
            if (d < DUNK_RANGE && open > 10) {
                startDunk(w, p);
            } else if (p.aiTimer <= 0) {
                p.aiTimer = 0.18;
                const q = 0.55 + rng(w) * 0.4;     // CPU release is decent, not perfect
                const chance = shotChance(w, p, q, skill);
                const mateOpen = openness(w, mate);
                const mateChance = shotChance(w, mate, q, skill) * 0.9;
                // A defender glued to your hip caps `chance` around 0.45, so a
                // 0.52 threshold made the CPU refuse to ever shoot and the game
                // died on the shot clock. Take the contested look, and get
                // greedier as the clock runs down.
                const willing = w.shotClock < 6 ? 0.28 : 0.38;
                const pressured = open < 16;
                // A man who just caught it has to look at the rim first. Without
                // this floor the two of them relayed the ball back and forth and
                // neither ever shot.
                const canPass = p.touchT > 0.8;
                if (w.shotClock < 2.4) {
                    launchShot(w, p, q, skill, w.shotClock < 1);
                } else if (canPass && pressured && mateOpen > open + 14 && rng(w) < 0.25) {
                    launchPass(w, p, mate);
                } else if (canPass && p.touchT > 3.4 && mateChance > chance && rng(w) < 0.22) {
                    launchPass(w, p, mate);
                } else if (chance > willing && rng(w) < 0.5) {
                    launchShot(w, p, q, skill);
                }
            }
        }
    } else if (w.possession !== null && w.players[w.possession].team === p.team) {
        /* --- off the ball on offence ----------------------------------- */
        const handler = w.players[w.possession];
        // Spot up on the opposite depth lane, a comfortable jumper away from
        // the rim, and slide away from whoever is guarding you.
        const side = handler.z > 0.5 ? 0.24 : 0.76;
        tz = side;
        tx = hoop.x + hoop.inward * (58 + Math.sin(w.t * 0.7 + p.id) * 26);
        const guard = opponentsOf(w, p).sort(
            (a, c) => dist2d(a.x, a.z, p.x, p.z) - dist2d(c.x, c.z, p.x, p.z),
        )[0];
        if (dist2d(guard.x, guard.z, p.x, p.z) < 22) tx += (p.x - guard.x) * 1.4;
        turbo = p.turbo > 0.4 && dist2d(p.x, p.z, tx, tz) > 70;
    } else if (w.possession !== null) {
        /* --- defence ---------------------------------------------------- */
        const handler = w.players[w.possession];
        const mate = teammateOf(w, p);
        const iAmCloser =
            dist2d(p.x, p.z, handler.x, handler.z) <= dist2d(mate.x, mate.z, handler.x, handler.z);

        if (iAmCloser) {
            // On the ball: sit between the handler and the rim he wants.
            // 8px, not 11: the mover stops within ~3px of its target, so a
            // standoff at 11 sat exactly on STEAL_R and nobody ever reached in.
            tx = handler.x + (ownHoop.x > handler.x ? 8 : -8);
            tz = handler.z;
            // Only sprint to recover. A defender who is always on turbo can
            // never be beaten, which makes the player's turbo meaningless.
            turbo = p.turbo > 0.2 && dist2d(p.x, p.z, tx, tz) > 20;

            const dd = dist2d(p.x, p.z, handler.x, handler.z);
            // Contest: if he is gathering, jump. If he is just dribbling,
            // gamble on a poke at a cadence so it never feels like a wall.
            if (handler.charge >= 0 && dd < BLOCK_R && p.y === 0 && rng(w) < 0.018 * gamble) {
                p.vy = JUMP_V;
            } else if (dd < STEAL_R && p.cool <= 0 && p.aiTimer <= 0 && w.ball.pickCool <= 0) {
                // Steals are the easiest thing to over-tune: at a 30% gamble
                // every half second the ball never settles and neither team
                // gets to run anything. 10% behind a 1.2s lockout keeps the
                // threat real without turning the game into hot potato.
                p.aiTimer = 0.8;
                p.cool = 1.2;
                // Standing still with the ball is how you get robbed. This also
                // stops a player who puts the phone down from stalling the whole
                // possession clock.
                const lazy = Math.hypot(handler.vx, handler.vz * Z_PX) < 6 ? 2.4 : 1;
                if (rng(w) < 0.1 * gamble * lazy) {
                    w.stats.steals++;
                    giveBall(w, p.id);
                    say(w, pick(w, SAY.steal));
                    shout(w, 'STOLEN!', PAL.accent2, 0.9);
                } else {
                    say(w, 'That was NOT a foul.');
                }
            }
        } else {
            // Off the ball: deny the other man, shading toward the rim.
            const mark = opponentsOf(w, p).find(o => o.id !== handler.id)!;
            tx = mark.x + (ownHoop.x > mark.x ? 14 : -14);
            tz = mark.z + (mark.z > 0.5 ? -0.08 : 0.08);
            turbo = p.turbo > 0.5 && dist2d(p.x, p.z, tx, tz) > 60;
        }
    } else {
        /* --- loose ball: everybody crashes ------------------------------ */
        tx = b.x;
        tz = b.z;
        if (b.mode === 'flight' && b.kind === 'shot') {
            // Rebound: go where the miss is going, not where the ball is now.
            tx = b.tx + (rng(w) - 0.5) * 4;
            tz = b.tz;
        }
        turbo = p.turbo > 0.15;
    }

    const dx = tx - p.x;
    const dz = tz - p.z;
    if (Math.hypot(dx, dz * Z_PX) > 3) applyMove(p, dx, dz, speedOf(p, turbo), dt);
    else { p.vx = 0; p.vz = 0; }

    if (turbo && !p.onFire) p.turbo = clamp(p.turbo - TURBO_DRAIN * dt, 0, 1);
};

/* ------------------------------------------------------------------ */
/* Human control                                                       */
/* ------------------------------------------------------------------ */

const humanControl = (w: World, p: Player, cmd: Cmd, dt: number) => {
    const hasBall = w.possession === p.id;
    const teamHasBall = w.possession !== null && w.players[w.possession].team === p.team;
    const mate = teammateOf(w, p);

    // B is turbo on offence and a steal lunge on defence — both make you move,
    // which keeps the button meaning roughly the same thing to a thumb.
    const wantTurbo = cmd.b && (p.onFire || p.turbo > 0);
    if (wantTurbo && !p.onFire) p.turbo = clamp(p.turbo - TURBO_DRAIN * dt, 0, 1);
    else p.turbo = clamp(p.turbo + TURBO_REGEN * dt, 0, 1);

    const dx = (cmd.right ? 1 : 0) - (cmd.left ? 1 : 0);
    const dz = (cmd.down ? 1 : 0) - (cmd.up ? 1 : 0);
    if (dx || dz) applyMove(p, dx, dz * 0.35, speedOf(p, wantTurbo), dt);
    else { p.vx = 0; p.vz = 0; }

    if (p.dunkT > 0) return;   // the dunk animation owns the body

    if (hasBall) {
        const hoop = HOOPS[attackHoop(p.team)];
        const d = hoopDist(p, hoop);
        if (cmd.aPress && p.cool <= 0) {
            if (d < DUNK_RANGE) startDunk(w, p);
            else p.charge = 0;                     // start the release meter
        }
        if (p.charge >= 0) {
            p.charge += dt / SHOT_CHARGE_TIME;
            // Held too long: it leaves your hand anyway and it is ugly.
            if (p.charge > SHOT_COOK || !cmd.a) {
                launchShot(w, p, releaseQuality(Math.min(p.charge, SHOT_COOK)), 1);
            }
        }
        // Tap B with the ball while standing still-ish and a teammate open:
        // turbo doubles as a bail-out pass when you are pinned on the line.
        if (cmd.bPress && openness(w, p) < 14 && p.cool <= 0) launchPass(w, p, mate);
    } else if (teamHasBall) {
        // A calls for the rock. Your teammate will oblige, mostly.
        if (cmd.aPress && mate.cool <= 0 && w.possession === mate.id) launchPass(w, mate, p);
    } else {
        // Defence: A jumps (block / rebound), B lunges for the steal.
        if (cmd.aPress && p.y === 0) p.vy = JUMP_V;
        if (cmd.bPress && p.cool <= 0 && w.possession !== null) {
            const handler = w.players[w.possession];
            p.cool = 1.1;
            if (dist2d(p.x, p.z, handler.x, handler.z) < STEAL_R + 3 && w.ball.pickCool <= 0) {
                // Reaching from behind the handler is the high-percentage steal.
                const behind = (handler.facing === 1 && p.x > handler.x) || (handler.facing === -1 && p.x < handler.x);
                if (rng(w) < (behind ? 0.26 : 0.14)) {
                    w.stats.steals++;
                    giveBall(w, p.id);
                    shout(w, 'STRIP!', PAL.accent, 0.9);
                    say(w, pick(w, SAY.steal));
                } else {
                    say(w, 'He reaches. He misses. He complains.');
                }
            }
        }
    }
};

/* ------------------------------------------------------------------ */
/* Ball + physics                                                      */
/* ------------------------------------------------------------------ */

const stepBall = (w: World, dt: number) => {
    const b = w.ball;
    b.pickCool = Math.max(0, b.pickCool - dt);
    b.spin += dt * (b.mode === 'held' ? 4 : 12);

    if (b.mode === 'held' && w.possession !== null) {
        const p = w.players[w.possession];
        // Ball rides at hip height on the lead side, and above the head while
        // gathering, so you can see a shot coming.
        const up = p.charge >= 0 ? 30 : 16;
        b.x = p.x + p.facing * 6;
        b.z = p.z;
        b.y = p.y + up + Math.sin(p.stride * Math.PI * 2) * (p.charge >= 0 ? 0 : 2);
        return;
    }

    if (b.mode === 'flight') {
        b.t += dt / b.dur;
        const t = Math.min(1, b.t);
        b.x = b.sx + (b.tx - b.sx) * t;
        b.z = b.sz + (b.tz - b.sz) * t;
        b.y = b.sy + (b.ty - b.sy) * t + b.arc * 4 * t * (1 - t);

        // A pass can be jumped — but only once it has left the neighbourhood.
        // Checking from t=0 meant the passer's own defender, who is standing
        // 8px away by definition, intercepted every pass out of pressure.
        if (b.kind === 'pass' && b.t > 0.3) {
            const from = w.players[b.shooter];
            for (const o of w.players) {
                if (o.team === from.team) continue;
                if (b.y < 26 && dist2d(o.x, o.z, b.x, b.z) < 9) {
                    w.stats.steals++;
                    shout(w, 'PICKED OFF!', PAL.accent2, 0.9);
                    say(w, pick(w, SAY.steal));
                    giveBall(w, o.id);
                    return;
                }
            }
        }

        if (b.t >= 1) {
            if (b.kind === 'pass') {
                const to = w.players[b.target];
                giveBall(w, to.id);
            } else if (b.made) {
                score(w, w.players[b.shooter], b.pts, false);
            } else {
                // Clank. Live rebound off the iron, tipped back into the court.
                const h = HOOPS[attackHoop(w.players[b.shooter].team)];
                say(w, pick(w, SAY.miss));
                w.rimFlash[attackHoop(w.players[b.shooter].team)] = 0.2;
                looseBall(
                    w, b.x, b.z, b.y,
                    h.inward * (28 + rng(w) * 42), -70 - rng(w) * 40,
                    (rng(w) - 0.5) * 0.5,
                );
            }
            return;
        }
        return;
    }

    /* loose */
    b.looseT += dt;
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.y -= b.vy * dt;

    if (b.y <= 3) {
        b.y = 3;
        b.vy = -b.vy * 0.55;              // bounce; dies out after a few hops
        b.vx *= 0.84;
        b.vz *= 0.7;
        if (Math.abs(b.vy) < 22) { b.vy = 0; b.vx *= 0.9; }
    }
    // The fence is in play. Everything is in play.
    if (b.x < COURT_L - 6) { b.x = COURT_L - 6; b.vx = Math.abs(b.vx) * 0.7; }
    if (b.x > COURT_R + 6) { b.x = COURT_R + 6; b.vx = -Math.abs(b.vx) * 0.7; }
    if (b.z < Z_MIN) { b.z = Z_MIN; b.vz = Math.abs(b.vz) * 0.6; }
    if (b.z > Z_MAX) { b.z = Z_MAX; b.vz = -Math.abs(b.vz) * 0.6; }

    if (w.phase !== 'score' && b.pickCool <= 0) {
        // Pickup: whoever is closest and can reach it. Jumping helps.
        let best: Player | null = null;
        let bestD = 999;
        for (const p of w.players) {
            if (p.dunkT > 0) continue;
            const d = dist2d(p.x, p.z, b.x, b.z);
            const reach = 12 + (p.y > 4 ? 22 : 16);
            if (d < 13 && b.y < reach + p.y && d < bestD) { best = p; bestD = d; }
        }
        if (best) {
            giveBall(w, best.id);
            if (b.looseT > 0.4) say(w, `${best.name} comes up with it.`);
        } else if (b.looseT > 3.5) {
            // Anti-stall: nobody has scooped it, hand it to the nearest body.
            let near = w.players[0];
            let nd = 999;
            for (const p of w.players) {
                const d = dist2d(p.x, p.z, b.x, b.z);
                if (d < nd) { nd = d; near = p; }
            }
            giveBall(w, near.id);
        }
    }
};

/** Scripted dunk: a flat-out sprint into the air that ends at the rim. */
const stepDunk = (w: World, p: Player, dt: number) => {
    p.dunkT += dt;
    const t = clamp(p.dunkT / p.dunkDur, 0, 1);
    const h = HOOPS[p.dunkHoop];
    // Ease toward the rim, then fall away from it after the slam.
    const rise = t < 0.62 ? t / 0.62 : 1;
    // Land ON the court side of the rim (inward), never behind the baseline —
    // the dunk lerp is the one thing that can shove a body out of bounds.
    const landX = clamp(h.x + h.inward * 10, COURT_L, COURT_R);
    p.x = p.dunkFrom.x + (landX - p.dunkFrom.x) * Math.min(1, t / 0.62);
    p.z = p.dunkFrom.z + (h.z - p.dunkFrom.z) * Math.min(1, t / 0.62);
    p.y = t < 0.62 ? rise * (h.h - 18) : Math.max(0, (h.h - 18) * (1 - (t - 0.62) / 0.38));

    if (!p.dunkSlammed && t >= 0.62) {
        p.dunkSlammed = true;
        // A body in the air inside the block radius can still deny the dunk;
        // otherwise the arcade rule applies and a dunk always goes in.
        const denier = opponentsOf(w, p).find(o => o.y > 12 && dist2d(o.x, o.z, p.x, p.z) < 16);
        if (denier && rng(w) < 0.55) {
            w.stats.blocks++;
            shout(w, 'DENIED!', PAL.bad, 1.2);
            say(w, pick(w, SAY.block));
            w.shake = Math.max(w.shake, 6);
            looseBall(w, p.x - h.inward * 16, p.z, 26, -h.inward * 60, -50);
        } else {
            w.shake = Math.max(w.shake, 9);
            for (let i = 0; i < 10; i++) {
                w.parts.push({
                    x: h.x, z: h.z, y: h.h,
                    vx: (rng(w) - 0.5) * 120, vy: -rng(w) * 90,
                    life: 0.5, max: 0.5, kind: 'spark',
                });
            }
            score(w, p, 2, true);
        }
    }
    if (t >= 1) { p.dunkT = 0; p.y = 0; }
};

/* ------------------------------------------------------------------ */
/* The step                                                            */
/* ------------------------------------------------------------------ */

export const stepWorld = (w: World, dt: number, cmd: Cmd) => {
    if (w.phase === 'over') return;

    w.t += dt;
    w.shake = Math.max(0, w.shake - dt * 26);
    w.bannerT = Math.max(0, w.bannerT - dt);
    w.sayT = Math.max(0, w.sayT - dt);
    w.rimFlash[0] = Math.max(0, w.rimFlash[0] - dt);
    w.rimFlash[1] = Math.max(0, w.rimFlash[1] - dt);

    // Particles (flame trail + dunk sparks) live on a fixed budget.
    for (let i = w.parts.length - 1; i >= 0; i--) {
        const q = w.parts[i];
        q.life -= dt;
        q.x += q.vx * dt;
        q.y -= q.vy * dt;
        q.vy -= 40 * dt;
        if (q.life <= 0) w.parts.splice(i, 1);
    }
    if (w.parts.length > 60) w.parts.splice(0, w.parts.length - 60);

    if (w.phase === 'tip') {
        w.phaseT -= dt;
        stepBall(w, dt);
        if (w.phaseT <= 0) { w.phase = 'play'; w.shotClock = SHOT_CLOCK; }
        return;
    }

    if (w.phase === 'score') {
        w.phaseT -= dt;
        stepBall(w, dt);
        for (const p of w.players) {
            if (p.dunkT > 0) stepDunk(w, p, dt);
            clampToCourt(p);
            p.cool = Math.max(0, p.cool - dt);
            // Celebration hop for the scorer, everyone else jogs back.
            if (p.team === w.lastScorer && p.dunkT === 0 && p.y === 0 && rng(w) < 0.04) p.vy = 70;
            if (p.y > 0 || p.vy > 0) {
                p.vy -= GRAVITY * dt;
                p.y = Math.max(0, p.y + p.vy * dt);
                if (p.y === 0) p.vy = 0;
            }
        }
        if (w.phaseT <= 0) {
            inbound(w, (1 - w.lastScorer) as 0 | 1);
            w.phase = 'play';
        }
        return;
    }

    /* --- live play ---------------------------------------------------- */
    w.clock -= dt;
    if (w.clock <= 0) { w.clock = 0; endGame(w); return; }

    if (w.possession !== null) {
        w.shotClock -= dt;
        if (w.shotClock <= 0) {
            // Shot clock in street ball is enforced by people yelling. A heave
            // goes up, it almost never falls, and the game keeps moving.
            const p = w.players[w.possession];
            say(w, 'Somebody yells "SHOT CLOCK" and he throws it at the rim.');
            launchShot(w, p, 0.1, 1, true);
        }
    }

    for (const p of w.players) {
        p.cool = Math.max(0, p.cool - dt);
        p.touchT = w.possession === p.id ? p.touchT + dt : 0;
        if (!p.onFire) p.fireT = 0;
        else {
            p.fireT -= dt;
            if (p.fireT <= 0) { p.onFire = false; say(w, pick(w, SAY.cold)); }
            // Flame trail while lit — one puff every few frames, budgeted.
            if (rng(w) < 0.5) {
                w.parts.push({
                    x: p.x - p.facing * 3, z: p.z, y: 8 + rng(w) * 14,
                    vx: -p.facing * 12, vy: 16 + rng(w) * 20,
                    life: 0.4, max: 0.4, kind: 'fire',
                });
            }
        }

        if (p.dunkT > 0) { stepDunk(w, p, dt); clampToCourt(p); continue; }

        if (p.human) humanControl(w, p, cmd, dt);
        else aiThink(w, p, dt);

        // Vertical: a single arcade jump arc, no air control, no double jump.
        if (p.y > 0 || p.vy !== 0) {
            p.vy -= GRAVITY * dt;
            p.y += p.vy * dt;
            if (p.y <= 0) { p.y = 0; p.vy = 0; }
        }
        if (!p.human && !p.onFire) p.turbo = clamp(p.turbo + TURBO_REGEN * 0.7 * dt, 0, 1);
        clampToCourt(p);
    }

    // Bodies are solid-ish: push apart so four figures never occupy one pixel.
    for (let i = 0; i < w.players.length; i++) {
        for (let j = i + 1; j < w.players.length; j++) {
            const a = w.players[i];
            const c = w.players[j];
            if (a.dunkT > 0 || c.dunkT > 0) continue;
            const d = dist2d(a.x, a.z, c.x, c.z);
            if (d > 0.001 && d < 11) {
                const push = (11 - d) / 2;
                const ux = (a.x - c.x) / d;
                const uz = ((a.z - c.z) * Z_PX) / d / Z_PX;
                a.x += ux * push; c.x -= ux * push;
                a.z += uz * push * 0.5; c.z -= uz * push * 0.5;
                clampToCourt(a); clampToCourt(c);
            }
        }
    }

    stepBall(w, dt);

    if (w.score[0] >= TARGET_SCORE || w.score[1] >= TARGET_SCORE) endGame(w);
};

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

const hash = (n: number) => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
};

const drawBackdrop = (ctx: CanvasRenderingContext2D, w: World) => {
    clear(ctx, VW, VH, '#070b14');
    // Sky wash + a moon that has seen worse basketball.
    rect(ctx, 0, 0, VW, 96, '#0b1226');
    rect(ctx, 0, 60, VW, 36, '#101a33');
    for (let i = 0; i < 26; i++) {
        const x = hash(i) * VW;
        const y = hash(i + 99) * 60;
        circle(ctx, x, y, hash(i + 7) > 0.8 ? 1 : 0.6, 'rgba(255,255,255,0.5)');
    }
    circle(ctx, 296, 22, 8, '#e8ecf5');
    circle(ctx, 292, 20, 7, '#0b1226');

    // Skyline — two parallax rows of blunt rectangles with lit windows.
    band(ctx, 96, 44, VW, 0, 22, '#000', (c, x, y, h) => {
        const bh = 16 + hash(x) * h;
        rect(c, x, y - bh, 20, bh, '#0a0f1c');
        for (let wy = y - bh + 4; wy < y - 4; wy += 6) {
            for (let wx = x + 3; wx < x + 17; wx += 5) {
                if (hash(wx * 3 + wy) > 0.62) rect(c, wx, wy, 2, 3, 'rgba(255,190,90,0.5)');
            }
        }
    });
    band(ctx, 104, 30, VW, 0, 31, '#000', (c, x, y, h) => {
        const bh = 12 + hash(x + 5) * h;
        rect(c, x, y - bh, 26, bh, '#060a14');
        for (let wy = y - bh + 3; wy < y - 3; wy += 7) {
            for (let wx = x + 4; wx < x + 22; wx += 6) {
                if (hash(wx + wy * 2) > 0.78) rect(c, wx, wy, 2, 2, 'rgba(120,200,255,0.4)');
            }
        }
    });

    // Crowd behind the fence: bobbing silhouettes, permanently unimpressed.
    for (let i = 0; i < 22; i++) {
        const x = 6 + i * 16 + hash(i) * 6;
        const bob = Math.sin(w.t * 2.4 + i) * 1.6;
        const y = 118 + hash(i + 3) * 3 + bob;
        const c = i % 5 === 0 ? '#1c2740' : '#131b2c';
        rect(ctx, x - 4, y - 10, 8, 11, c);
        circle(ctx, x, y - 12, 3.4, c);
    }

    // Chain-link fence across the back of the court.
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let x = -10; x < VW + 10; x += 7) line(ctx, x, 96, x + 10, 128, '#2a3a52', 0.6);
    for (let x = -10; x < VW + 10; x += 7) line(ctx, x + 10, 96, x, 128, '#2a3a52', 0.6);
    ctx.restore();
    for (let x = 12; x < VW; x += 60) rect(ctx, x, 92, 2, 38, '#33465f');
    rect(ctx, 0, 92, VW, 2, '#3b506c');
};

const drawCourt = (ctx: CanvasRenderingContext2D, w: World) => {
    // Blacktop as a trapezoid: back edge narrower than the front edge.
    const bl = screenX(COURT_L - 16, 0), br = screenX(COURT_R + 16, 0);
    const fl = screenX(COURT_L - 16, 1), fr = screenX(COURT_R + 16, 1);
    ctx.fillStyle = '#1b2029';
    ctx.beginPath();
    ctx.moveTo(bl, FLOOR_BACK_Y);
    ctx.lineTo(br, FLOOR_BACK_Y);
    ctx.lineTo(fr, FLOOR_FRONT_Y);
    ctx.lineTo(fl, FLOOR_FRONT_Y);
    ctx.closePath();
    ctx.fill();
    rect(ctx, 0, FLOOR_FRONT_Y, VW, VH - FLOOR_FRONT_Y, '#11151c');

    // Faded paint: sidelines, half court, the two keys, a centre circle.
    const paint = 'rgba(190,205,225,0.22)';
    line(ctx, bl, FLOOR_BACK_Y + 1, br, FLOOR_BACK_Y + 1, paint, 1);
    line(ctx, fl, FLOOR_FRONT_Y - 1, fr, FLOOR_FRONT_Y - 1, paint, 1);
    line(ctx, screenX(CENTER_X, 0), FLOOR_BACK_Y, screenX(CENTER_X, 1), FLOOR_FRONT_Y, paint, 1);
    ctx.save();
    ctx.strokeStyle = paint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(CENTER_X, floorY(0.5), 26, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (const h of HOOPS) {
        const kx = h.x + h.inward * 52;
        ctx.beginPath();
        ctx.moveTo(screenX(h.x, 0.2), floorY(0.2));
        ctx.lineTo(screenX(kx, 0.2), floorY(0.2));
        ctx.lineTo(screenX(kx, 0.75), floorY(0.75));
        ctx.lineTo(screenX(h.x, 0.75), floorY(0.75));
        ctx.stroke();
        // Three point arc, rendered as the ellipse it looks like from here.
        ctx.beginPath();
        ctx.ellipse(screenX(h.x, h.z), floorY(h.z), THREE_DIST * 0.78, 30, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
    // Grime.
    for (let i = 0; i < 30; i++) {
        const z = hash(i + 40);
        rect(ctx, screenX(30 + hash(i) * 280, z), floorY(z), 2, 1, 'rgba(0,0,0,0.3)');
    }
};

const drawHoop = (ctx: CanvasRenderingContext2D, w: World, idx: 0 | 1) => {
    const h = HOOPS[idx];
    const x = screenX(h.x, h.z);
    const rimY = screenY(h.z, h.h);
    const flash = w.rimFlash[idx];
    const poleX = x - h.inward * 14;

    rect(ctx, poleX - 1, rimY - 26, 3, floorY(h.z) - rimY + 26, '#4a5566');
    // Backboard
    rect(ctx, poleX - h.inward * 2, rimY - 24, h.inward * 3, 30, '#7c8899');
    rect(ctx, poleX + h.inward * 1, rimY - 20, h.inward * 1, 22, 'rgba(255,255,255,0.25)');
    outline(ctx, Math.min(poleX + h.inward * 2, poleX + h.inward * 10) - 1, rimY - 12, 10, 9,
        flash > 0 ? PAL.warn : '#aab4c2', 1);

    // Rim as a squashed ellipse + net strands.
    const rimColor = flash > 0 ? PAL.warn : '#ff6a2a';
    ctx.save();
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = flash > 0 ? 2 : 1.4;
    ctx.beginPath();
    ctx.ellipse(x, rimY, 8, 2.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    for (let i = -3; i <= 3; i++) {
        const nx = x + i * 2.4;
        line(ctx, nx, rimY + 1, x + i * 1.3, rimY + 9, 'rgba(230,237,243,0.55)', 0.7);
    }
    line(ctx, x, rimY + 9, x - h.inward * 0, rimY + 9, 'rgba(230,237,243,0.4)', 0.7);
    if (flash > 0) {
        circle(ctx, x, rimY, 12 * flash + 4, `rgba(255,180,0,${0.35 * flash})`);
    }
};

const drawPlayer = (ctx: CanvasRenderingContext2D, w: World, p: Player) => {
    const x = screenX(p.x, p.z);
    const feet = floorY(p.z) - p.y * sc(p.z);
    const h = 32 * sc(p.z);
    const isShooting = p.charge >= 0 || p.dunkT > 0;
    const armUp = p.dunkT > 0 ? 1.35 : p.charge >= 0 ? clamp(p.charge, 0, 1) : p.y > 6 ? 1 : 0;

    if (p.onFire) {
        // Heat haze under the on-fire player so you can find him instantly.
        circle(ctx, x, floorY(p.z), 12, 'rgba(255,120,0,0.18)');
        circle(ctx, x, floorY(p.z), 7, 'rgba(255,190,0,0.22)');
    }
    if (p.y > 2) shadow(ctx, x, floorY(p.z), 5 * sc(p.z), 2 * sc(p.z), 0.35);

    // Pixel-art cast. `height` keeps the sprite the exact size the block figure
    // was, so every hitbox, arrow and meter below still lines up. If no sprite
    // is registered under p.kit.sprite (the art file is absent or renamed),
    // actor() draws the old figure() with the same kit colours instead.
    actor(ctx, p.kit.sprite, x, feet, {
        height: h,
        facing: p.facing,
        // Walk cycle is driven by position, as before — stride picks the frame.
        stride: p.stride,
        swap: p.kit.swap,
        kit: p.kit,
        armUp,
        crouch: p.charge > 0.15 && p.charge < 0.6,
        hurt: false,
        // The heat haze / jump shadow above already handles the ground contact.
        shadow: p.y <= 2,
    });

    if (p.onFire) glyph(ctx, '🔥', x - p.facing * 7, feet - h - 4, 9 + Math.sin(w.t * 14) * 1.5);
    if (p.human) {
        // The "that's you" arrow, because four block men look alike in a pile.
        // glyph() paints with the current fillStyle, so set one explicitly.
        const bob = Math.sin(w.t * 6) * 1.2;
        ctx.fillStyle = p.onFire ? PAL.warn : PAL.accent;
        glyph(ctx, '▼', x, feet - h - 7 + bob, 9);
    }
    if (isShooting && p.charge >= 0) {
        // Release meter above the shooter: green band is the sweet spot.
        const mx = x - 12;
        const my = feet - h - 18;
        bar(ctx, mx, my, 24, 3, Math.min(1, p.charge / SHOT_COOK), p.onFire ? PAL.warn : PAL.accent, PAL.panel);
        const zs = ((SHOT_SWEET - SHOT_WINDOW * 0.45) / SHOT_COOK) * 24;
        const ze = ((SHOT_SWEET + SHOT_WINDOW * 0.45) / SHOT_COOK) * 24;
        rect(ctx, mx + zs, my - 2, ze - zs, 1.5, PAL.ok);
    }
};

const drawBall = (ctx: CanvasRenderingContext2D, w: World) => {
    const b = w.ball;
    const x = screenX(b.x, b.z);
    const y = screenY(b.z, b.y);
    shadow(ctx, screenX(b.x, b.z), floorY(b.z), 3.2, 1.3, 0.45);
    const r = 3.4 * sc(b.z);
    circle(ctx, x, y, r + 0.6, '#0b0705');
    circle(ctx, x, y, r, '#e8752a');
    // Seams — two arcs that spin so the ball reads as a ball at 3px.
    ctx.save();
    ctx.strokeStyle = '#3a1a08';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(x, y, r, b.spin, b.spin + Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.stroke();
    ctx.restore();

    const holder = w.possession !== null ? w.players[w.possession] : null;
    if (holder?.onFire || (b.mode === 'flight' && w.players[b.shooter]?.onFire)) {
        glyph(ctx, '🔥', x, y - 4, 8 + Math.sin(w.t * 18) * 2, 0, 0.9);
    }
};

const fmtClock = (s: number) => {
    const t = Math.max(0, Math.ceil(s));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export const drawWorld = (ctx: CanvasRenderingContext2D, w: World) => {
    ctx.save();
    const [sx, sy] = shakeOffset(w.shake);
    ctx.translate(sx, sy);

    drawBackdrop(ctx, w);
    drawCourt(ctx, w);
    drawHoop(ctx, w, 0);
    drawHoop(ctx, w, 1);

    // Particles behind the cast so flames read as a trail, not a mask.
    for (const q of w.parts) {
        const a = clamp(q.life / q.max, 0, 1);
        const px = screenX(q.x, q.z);
        const py = screenY(q.z, q.y);
        if (q.kind === 'fire') {
            circle(ctx, px, py, 3.2 * a + 0.6, `rgba(255,${90 + 120 * a | 0},0,${0.6 * a})`);
        } else {
            rect(ctx, px, py, 1.6, 1.6, `rgba(255,220,120,${a})`);
        }
    }

    // Painter's algorithm on depth so near bodies overlap far ones. The ball
    // is the exception and is drawn last, on top of everybody: at 3px across it
    // vanishes behind a body in a scramble, and a ball you cannot find is the
    // one thing this game is not allowed to do.
    for (const p of [...w.players].sort((a, b) => a.z - b.z)) drawPlayer(ctx, w, p);
    drawBall(ctx, w);

    /* --- on-canvas furniture ------------------------------------------ */
    rect(ctx, 0, 0, VW, 13, 'rgba(4,6,10,0.72)');
    text(ctx, `YOU ${w.score[0]}`, 6, 3, { size: 8, color: PAL.accent, bold: true });
    text(ctx, fmtClock(w.clock), VW / 2, 3, { size: 8, color: w.clock < 15 ? PAL.bad : PAL.ink, align: 'center', bold: true });
    text(ctx, `${w.score[1]} ${w.opponent}`, VW - 6, 3, { size: 8, color: PAL.accent2, align: 'right', bold: true });

    if (w.phase === 'play' && w.possession !== null) {
        const sc2 = Math.ceil(w.shotClock);
        text(ctx, String(sc2), VW / 2, 15, { size: 7, color: sc2 <= 4 ? PAL.bad : PAL.faint, align: 'center' });
    }

    // Turbo bar for the human, bottom-left, with a fire label when lit.
    const you = w.players[0];
    bar(ctx, 6, VH - 10, 48, 4, you.onFire ? 1 : you.turbo, you.onFire ? PAL.warn : PAL.accent, PAL.panel);
    text(ctx, you.onFire ? 'ON FIRE' : 'TURBO', 58, VH - 11, { size: 6, color: you.onFire ? PAL.warn : PAL.faint });

    // Commentator ticker.
    if (w.sayT > 0) {
        const a = clamp(w.sayT / 0.6, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        rect(ctx, 0, VH - 24, VW, 11, 'rgba(4,6,10,0.78)');
        text(ctx, `🎙 ${w.say}`, VW / 2, VH - 19, { size: 7, color: PAL.warn, align: 'center', baseline: 'middle' });
        ctx.restore();
    }

    if (w.bannerT > 0) {
        const pop = w.phase === 'over' ? 20 : 16 + Math.sin(w.t * 22) * 2;
        drawBanner(ctx, w.bannerText, VW, 66, w.bannerColor, pop);
    }
    if (w.phase === 'tip') {
        drawBanner(ctx, 'CHECK IT UP', VW, 48, PAL.accent, 18);
        text(ctx, `First to ${TARGET_SCORE} — shoes on the line`, VW / 2, 62, {
            size: 7, color: PAL.dim, align: 'center',
        });
    }

    ctx.restore();
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const HoopsGame: React.FC<{
    opponent?: string;
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ opponent = 'Guy In Jeans', onFinish, onQuit }) => {
    const [done, setDone] = useState<null | boolean>(null);
    const { input, set, consume } = useInput(done === null);

    // The whole simulation lives here. React never sees it.
    const worldRef = useRef<World | null>(null);
    if (!worldRef.current) {
        worldRef.current = createWorld((Date.now() ^ 0x9e3779b9) | 0, opponent);
    }

    // HUD mirror: written only when a *displayed* value actually changes, so
    // React renders a handful of times a game instead of 5,400.
    const hudRef = useRef({ you: 0, them: 0, clock: GAME_SECONDS, fire: false });
    const [hud, setHud] = useState(hudRef.current);
    const doneRef = useRef(false);
    const finishedRef = useRef(false);

    const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
        const w = worldRef.current!;
        if (!doneRef.current) {
            const s = input.current;
            stepWorld(w, dt, {
                left: s.left, right: s.right, up: s.up, down: s.down,
                a: s.a, b: s.b,
                aPress: consume('a'), bPress: consume('b'),
            });
        }
        drawWorld(ctx, w);

        const clock = Math.ceil(w.clock);
        const fire = w.players[0].onFire;
        const h = hudRef.current;
        if (h.you !== w.score[0] || h.them !== w.score[1] || h.clock !== clock || h.fire !== fire) {
            hudRef.current = { you: w.score[0], them: w.score[1], clock, fire };
            setHud(hudRef.current);
        }
        if (w.phase === 'over' && !doneRef.current) {
            doneRef.current = true;
            setDone(w.score[0] > w.score[1]);
        }
    }, [input, consume]);

    // onFinish must fire exactly once no matter how many times the card is hit.
    const finish = () => {
        if (finishedRef.current || done === null) return;
        finishedRef.current = true;
        const w = worldRef.current!;
        onFinish(
            done,
            done
                ? `You took ${opponent} ${w.score[0]}-${w.score[1]} on the blacktop.`
                : `${opponent} beat you ${w.score[1]}-${w.score[0]}. He is still talking about it.`,
        );
    };

    const w = worldRef.current;
    const dunks = w.stats.dunks;

    return (
        <ArcadeShell
            title="Hoops — 2 on 2"
            subtitle={`You & Big Mike vs ${opponent} & his cousin`}
            width={VW}
            height={VH}
            running={done === null}
            onFrame={onFrame}
            onInput={set}
            actions={['SHOOT', 'TURBO']}
            vertical
            onQuit={done === null ? onQuit : undefined}
            quitLabel="Forfeit"
            hud={
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="chip">
                        YOU <b className="numeric text-[var(--accent)] ml-1">{hud.you}</b>
                    </span>
                    <span className="label flex items-center gap-1">
                        {hud.fire && <span>🔥</span>}
                        <span className="numeric">{fmtClock(hud.clock)}</span>
                        <span className="opacity-60">/ to {TARGET_SCORE}</span>
                    </span>
                    <span className="chip">
                        <b className="numeric text-[var(--accent2)] mr-1">{hud.them}</b> {opponent.toUpperCase().slice(0, 12)}
                    </span>
                </div>
            }
            overlay={
                done === null ? undefined : (
                    <MiniGameResult
                        won={done}
                        headline={done ? `You Win ${hud.you}-${hud.them}` : `You Lose ${hud.you}-${hud.them}`}
                        detail={
                            done
                                ? `${dunks > 0 ? 'The rim needs a doctor. ' : ''}${opponent} says the court was uneven and that he plays overseas.`
                                : `${opponent} hits one more after the whistle, just to be sure everybody saw it.`
                        }
                        onClose={finish}
                        closeLabel={done ? 'Collect' : 'Walk Off'}
                    />
                )
            }
            help={
                '◀ ▶ run the court, ▲ ▼ slide in and out. SHOOT: hold with the ball to charge — release in the green for a pure look, or get inside and tap it for a dunk. Without the ball SHOOT calls for the pass, or jumps to block on defence. TURBO: sprint with the ball, poke for a steal without it. Three straight buckets and you are ON FIRE until they score.'
            }
        />
    );
};

export default HoopsGame;
