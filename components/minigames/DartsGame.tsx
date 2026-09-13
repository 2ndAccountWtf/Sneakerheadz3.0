import React, { useCallback, useRef, useState } from 'react';
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
    glyph,
    shadow,
    figure,
    shakeOffset,
    banner as drawBanner,
} from './engine';

/**
 * DRUNK DARTS — 301 down, in a bar, against a man who is buying.
 *
 * The joke and the mechanic are the same object: every drink makes you
 * measurably, checkably worse, and the game shows you the numbers while it
 * happens. Nothing in here claims a drink helps with anything. Declining is
 * always on the table, costs exactly nothing mechanically, and the only
 * pressure to accept is that he will say something about it.
 *
 * The three honest degradations, all driven by one `drunk` counter (0..5):
 *
 *   1. SWAY     — swayAmp() widens the reticle's wander, ~6px sober to ~33px.
 *   2. DRIFT    — swayFreq() speeds it up, so there is less flat time at the
 *                 top of each swing to time your press against.
 *   3. LAG      — inputLag() delays the lock by up to 210ms. The reticle keeps
 *                 moving in that window, so a late lock lands wherever the
 *                 sway had already carried it. This is the one that actually
 *                 ruins you.
 *   plus a release tremor on the throw itself, and a slower aim-nudge.
 *
 * At drunk >= 2 the whole canvas starts listing; at >= 3 your own scoreboard
 * begins miscounting in your favour and he has to correct it out loud. The
 * underlying score is never wrong — only the readout, and only briefly. We are
 * making fun of the guy, not cheating for him.
 *
 * Architecture (same shape as HoopsGame / DiceGame): the entire simulation is
 * a plain object in a ref, mutated inside the 60Hz frame callback. React state
 * is only the HUD mirror and the game-over flag. `stepDarts` touches nothing
 * DOM-shaped and all randomness goes through a seeded RNG, so the whole match
 * runs headless in Node.
 */

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const VW = 280;
const VH = 180;

const CX = 92;
const CY = 84;

/** Board radii, outward. Proportional to a real board, shrunk to 280px. */
const R_BULL = 4.5;        // 50
const R_BULL_OUT = 11;     // 25
const R_TRIPLE_IN = 28;
const R_TRIPLE_OUT = 33;
const R_DOUBLE_IN = 49;
const R_SCORE = 54;        // outside this is the wire surround: nothing
const R_RING = 62;         // the black surround the numbers sit on

/** Clockwise from the top. The real board order — the whole point is that the big numbers have small neighbours. */
const WEDGES = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5] as const;
const WEDGE_ARC = (Math.PI * 2) / 20;

/** How far the aim centre may be pushed from the bullseye. */
const AIM_LIMIT = 44;

/* ------------------------------------------------------------------ */
/* Balance constants                                                   */
/* ------------------------------------------------------------------ */

const START_SCORE = 301;
const DARTS_PER_TURN = 3;
/** Hard cap so a match always ends: 8 turns each, then nearest to zero wins. */
const MAX_DARTS = 24;
const MAX_DRUNK = 5;

/**
 * Reticle sway, sober, in logical pixels. The treble ring is 5px wide, so a
 * sober hand still has to time the swing to sit in it — this is deliberately
 * wider than "guaranteed treble twenty".
 */
const BASE_AMP = 8.5;
/** Extra sway per drink. Five drinks is ~4.6x the wobble. */
const AMP_PER_DRUNK = 0.72;
/** Radians/sec of the primary sway sine, sober. */
const BASE_FREQ = 2.15;
/** Extra drift speed per drink. */
const FREQ_PER_DRUNK = 0.3;
/** Seconds of input lag added per drink — the killer. */
const LAG_PER_DRUNK = 0.042;
/**
 * Release tremor: gaussian scatter applied at the moment the dart leaves the
 * hand, after you have already committed. Everyone has a little of this; each
 * drink adds a lot.
 */
const TREMOR_BASE = 1.1;
const TREMOR_PER_DRUNK = 1.9;
/** Aim-nudge speed, px/sec, and how much of it each drink takes away. */
const NUDGE_SPEED = 48;
const NUDGE_LOSS_PER_DRUNK = 0.11;
/** Focus buys back a little steadiness. Coffee versus lager, stated in the HUD. */
const FOCUS_STEADY = 0.22;

/**
 * How wide he throws, in px of gaussian scatter. He is stone cold sober and
 * genuinely decent: at 9px he averages ~22 points a dart and checks out in
 * about 14, which is the pace a sober player has to match. Drunk, you will not.
 */
const FOE_SIGMA = 9;

const AIM_X_TIME = 6;      // he starts shouting if you stand there forever
const AIM_Y_TIME = 6;
const FLY_TIME = 0.3;
const LAND_TIME = 0.95;
const FOE_AIM_TIME = 0.6;
const FOE_LAND_TIME = 0.8;
const OFFER_TIME = 7;      // times out as a decline, because declining is the default
const INTRO_TIME = 2.4;
const MISCOUNT_HOLD = 1.7;

/* ------------------------------------------------------------------ */
/* Honest degradation curves — exported so they can be checked         */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Reticle sway amplitude in px. focus shaves a little off, and says so. */
export const swayAmp = (drunk: number, focus = 60): number =>
    BASE_AMP * (1 + clamp(drunk, 0, MAX_DRUNK) * AMP_PER_DRUNK)
    * (1 - FOCUS_STEADY * clamp(focus, 0, 100) / 100);

/** Sway angular frequency in rad/s. */
export const swayFreq = (drunk: number): number =>
    BASE_FREQ * (1 + clamp(drunk, 0, MAX_DRUNK) * FREQ_PER_DRUNK);

/** Seconds between pressing the button and the lock actually landing. */
export const inputLag = (drunk: number): number => clamp(drunk, 0, MAX_DRUNK) * LAG_PER_DRUNK;

/** Gaussian scatter added at the moment of release, in px. */
export const tremor = (drunk: number): number =>
    TREMOR_BASE + clamp(drunk, 0, MAX_DRUNK) * TREMOR_PER_DRUNK;

/** Speed of the d-pad aim nudge, px/sec. */
export const nudgeSpeed = (drunk: number): number =>
    NUDGE_SPEED * Math.max(0.25, 1 - clamp(drunk, 0, MAX_DRUNK) * NUDGE_LOSS_PER_DRUNK);

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export interface Hit { value: number; label: string; ring: 'miss' | 'single' | 'double' | 'treble' | 'bull' }

/** Which wedge a point falls in. Index into WEDGES, clockwise from 20 at the top. */
const wedgeIndex = (dx: number, dy: number): number => {
    // Canvas angles run clockwise because y points down, which is the same
    // direction the board numbers run, so no mirroring is needed.
    const a = Math.atan2(dy, dx) + Math.PI / 2;
    const i = Math.round(a / WEDGE_ARC);
    return ((i % 20) + 20) % 20;
};

/** Scores a landing point relative to the board centre. */
export const scoreAt = (dx: number, dy: number): Hit => {
    const r = Math.hypot(dx, dy);
    if (r <= R_BULL) return { value: 50, label: 'BULL', ring: 'bull' };
    if (r <= R_BULL_OUT) return { value: 25, label: '25', ring: 'bull' };
    if (r > R_SCORE) return { value: 0, label: 'WIRE', ring: 'miss' };
    const n = WEDGES[wedgeIndex(dx, dy)];
    if (r >= R_DOUBLE_IN) return { value: n * 2, label: `D${n}`, ring: 'double' };
    if (r >= R_TRIPLE_IN && r <= R_TRIPLE_OUT) return { value: n * 3, label: `T${n}`, ring: 'treble' };
    return { value: n, label: `${n}`, ring: 'single' };
};

/** Centre of a given wedge at a given radius — used by the AI and by the hint ring. */
const wedgePoint = (n: number, r: number): [number, number] => {
    const i = WEDGES.indexOf(n as typeof WEDGES[number]);
    const a = -Math.PI / 2 + (i < 0 ? 0 : i) * WEDGE_ARC;
    return [Math.cos(a) * r, Math.sin(a) * r];
};

/* ------------------------------------------------------------------ */
/* Mouth                                                               */
/* ------------------------------------------------------------------ */

const SAY = {
    open: [
        'Three hundred and one. Straight out. No messing.',
        'Chalk is on the wall. Try not to embarrass us.',
        'Arrows up. First to nothing.',
    ],
    offer: [
        'Another one? Go on. It loosens the arm.',
        'One more. It is basically practice.',
        'You throw better after one. Everyone knows this.',
        'On me. I insist. I am being generous.',
    ],
    accepted: [
        'THERE he is. Good man.',
        'Attaboy. Straight down.',
        'Beautiful. Now hold still.',
    ],
    declined: [
        'Suit yourself, athlete.',
        'Lemonade over there if you want it.',
        'Ah. One of those. Fine. FINE.',
        'He is in training, everybody.',
    ],
    good: [
        'Oh, he can actually throw.',
        'That is a proper arrow.',
        'Lucky. Absolutely lucky.',
    ],
    bad: [
        'That hit the wall. The WALL.',
        'You aiming at the board or the barmaid?',
        'The dartboard is the round thing.',
        'I felt that one in my knees.',
    ],
    bust: [
        'BUST. All three. Sit down.',
        'Overcooked it. Classic.',
    ],
    correct: [
        'OI. That is not what that says.',
        'That is a THREE. You want to look again.',
        'Chalk does not lie, pal. Re-count.',
        'Nice try. I can see it from here.',
    ],
    foeGood: [
        'Watch and learn.',
        'That is why they call me what they call me.',
        'I have never missed. I have been misjudged.',
    ],
    foeBad: [
        'Board moved.',
        'Wrong dart. That one is bent.',
    ],
    win: [
        'Out. He is out. I want that drink back.',
        'You checked out drunk. That is worse, somehow.',
    ],
    lose: [
        'Game. Same time tomorrow?',
        'Out. Go home. Drink some water.',
    ],
};

/* ------------------------------------------------------------------ */
/* World                                                               */
/* ------------------------------------------------------------------ */

type Phase =
    | 'intro' | 'aimX' | 'aimY' | 'fly' | 'land'
    | 'foeAim' | 'foeFly' | 'foeLand' | 'offer' | 'over';

interface Side {
    score: number;
    /** Score at the start of this turn — a bust rewinds to it, as in the pub. */
    turnStart: number;
    darts: number;
    thisTurn: number;
}

interface Arrow { x: number; y: number; who: 0 | 1 }

export interface DartsWorld {
    seed: number;
    rngState: number;
    opponent: string;
    t: number;
    phase: Phase;
    phaseT: number;

    you: Side;
    foe: Side;

    /** 0..5. Every point of this is a measurable handicap and nothing else. */
    drunk: number;
    drinks: number;
    declines: number;
    empties: number;
    focus: number;

    /** Aim centre — where you are pointing, before the sway takes it away. */
    aimX: number;
    aimY: number;
    /** Locked horizontal from stage one of the aim. */
    lockX: number;
    /** Queued press: the wall-clock time at which the lock actually happens, or -1. */
    pressAt: number;
    /** Set when the dart that just landed ended the thrower's turn. */
    turnOver: boolean;

    /** In-flight dart. */
    fly: { sx: number; sy: number; tx: number; ty: number; who: 0 | 1 } | null;
    arrows: Arrow[];
    lastHit: Hit | null;

    /** What your side of the chalk currently *claims*. May briefly be wrong. */
    shown: number;
    miscount: number;
    miscountT: number;

    tilt: number;
    shake: number;
    bannerText: string;
    bannerT: number;
    bannerColor: string;
    say: string;
    sayT: number;

    winner: 0 | 1 | null;
    result: 'win' | 'lose' | null;

    /** Diagnostics the headless run asserts on. */
    stats: {
        throws: number;
        /** Sum of |landing - aim centre| for player darts, and the count. */
        aimErrSum: number;
        aimErrN: number;
        scored: number;
        misses: number;
        busts: number;
        trebles: number;
        bulls: number;
        drinksTaken: number;
        declines: number;
        miscounts: number;
    };
}

export interface DartsCmd {
    left: boolean; right: boolean; up: boolean; down: boolean;
    a: boolean; b: boolean;
    aPress: boolean; bPress: boolean;
}

export const blankDartsCmd = (): DartsCmd => ({
    left: false, right: false, up: false, down: false,
    a: false, b: false, aPress: false, bPress: false,
});

/* ------------------------------------------------------------------ */
/* Utility                                                             */
/* ------------------------------------------------------------------ */

/** mulberry32 — seedable so a headless match is reproducible. */
const rng = (w: DartsWorld) => {
    w.rngState = (w.rngState + 0x6d2b79f5) | 0;
    let t = w.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** Cheap approximate normal — three uniforms is plenty for a dart. */
const gauss = (w: DartsWorld) => (rng(w) + rng(w) + rng(w) - 1.5) * 1.1547;
const pick = <T,>(w: DartsWorld, arr: readonly T[]): T => arr[Math.floor(rng(w) * arr.length) % arr.length];

const say = (w: DartsWorld, s: string) => { w.say = s; w.sayT = 3.2; };
const shout = (w: DartsWorld, s: string, color: string, hold = 1.2) => {
    w.bannerText = s; w.bannerT = hold; w.bannerColor = color;
};

const mkSide = (): Side => ({ score: START_SCORE, turnStart: START_SCORE, darts: 0, thisTurn: 0 });

export interface DartsOpts {
    opponent?: string;
    focus?: number;
    startDrunk?: number;
}

export const createDartsWorld = (seed: number, opts: DartsOpts = {}): DartsWorld => {
    const w: DartsWorld = {
        seed,
        rngState: seed | 0,
        opponent: (opts.opponent || 'Darts').toUpperCase().slice(0, 12),
        t: 0,
        phase: 'intro',
        phaseT: 0,

        you: mkSide(),
        foe: mkSide(),

        drunk: clamp(opts.startDrunk ?? 0, 0, MAX_DRUNK),
        drinks: 0,
        declines: 0,
        empties: 0,
        focus: clamp(opts.focus ?? 60, 0, 100),

        aimX: 0,
        aimY: -R_TRIPLE_IN - 2,   // everyone starts pointed at treble twenty
        lockX: 0,
        pressAt: -1,
        turnOver: false,

        fly: null,
        arrows: [],
        lastHit: null,

        shown: START_SCORE,
        miscount: 0,
        miscountT: 0,

        tilt: 0,
        shake: 0,
        bannerText: '',
        bannerT: 0,
        bannerColor: PAL.ink,
        say: '',
        sayT: 0,

        winner: null,
        result: null,

        stats: {
            throws: 0, aimErrSum: 0, aimErrN: 0, scored: 0, misses: 0, busts: 0,
            trebles: 0, bulls: 0, drinksTaken: 0, declines: 0, miscounts: 0,
        },
    };
    say(w, pick(w, SAY.open));
    return w;
};

/* ------------------------------------------------------------------ */
/* The reticle                                                         */
/* ------------------------------------------------------------------ */

/**
 * Two incommensurable sines per axis, so the path never repeats on a beat you
 * can learn. Sober that is a ~6px oval you can comfortably time; at five
 * drinks it is a ~33px figure of eight moving half again as fast, which is
 * why your grouping falls apart rather than merely shifting.
 */
export const reticleAt = (w: DartsWorld): [number, number] => {
    const a = swayAmp(w.drunk, w.focus);
    const f = swayFreq(w.drunk);
    const t = w.t;
    const sx = a * (0.62 * Math.sin(f * t) + 0.38 * Math.sin(f * 1.73 * t + 1.1));
    const sy = a * 0.72 * (0.58 * Math.sin(f * 0.83 * t + 2.3) + 0.42 * Math.sin(f * 1.31 * t + 0.4));
    // Stage two holds the horizontal it already locked; only y is still moving.
    const x = w.phase === 'aimY' || w.phase === 'fly' ? w.lockX : w.aimX + sx;
    return [x, w.aimY + sy];
};

/* ------------------------------------------------------------------ */
/* Turn flow                                                           */
/* ------------------------------------------------------------------ */

const bothOut = (w: DartsWorld) => w.you.darts >= MAX_DARTS && w.foe.darts >= MAX_DARTS;

const finish = (w: DartsWorld, winner: 0 | 1, why: string) => {
    w.winner = winner;
    w.result = winner === 0 ? 'win' : 'lose';
    w.phase = 'over';
    w.phaseT = 0;
    shout(w, why, winner === 0 ? PAL.ok : PAL.bad, 5);
    say(w, pick(w, winner === 0 ? SAY.win : SAY.lose));
};

/** Applies a dart to a side. Returns true if the turn is over. */
const applyHit = (w: DartsWorld, who: 0 | 1, hit: Hit): boolean => {
    const side = who === 0 ? w.you : w.foe;
    side.darts += 1;
    side.thisTurn += 1;
    const next = side.score - hit.value;

    if (next === 0) {
        side.score = 0;
        if (who === 0) w.shown = 0;
        finish(w, who, who === 0 ? 'CHECKED OUT' : 'HE IS OUT');
        return true;
    }
    if (next < 0) {
        // Pub rules: bust the whole turn back to where it started.
        side.score = side.turnStart;
        if (who === 0) { w.shown = side.score; w.stats.busts += 1; }
        shout(w, 'BUST', PAL.bad, 1.1);
        if (who === 0) say(w, pick(w, SAY.bust));
        return true;
    }
    side.score = next;
    if (who === 0) w.shown = next;
    // A bust can end a turn after one or two darts, so the running total is not
    // always a multiple of three — the cap has to be checked per dart, not per turn.
    return side.thisTurn >= DARTS_PER_TURN || side.darts >= MAX_DARTS;
};

/** Hands the arrows over, or ends the match if everybody is out of darts. */
const endTurn = (w: DartsWorld, who: 0 | 1) => {
    const side = who === 0 ? w.you : w.foe;
    side.thisTurn = 0;
    side.turnStart = side.score;

    if (bothOut(w)) {
        // Nobody checked out inside the cap: nearest to zero takes it, and he
        // wins a tie because he is sober and will not shut up about it.
        finish(w, w.you.score < w.foe.score ? 0 : 1,
            w.you.score < w.foe.score ? 'NEAREST — YOURS' : 'NEAREST — HIS');
        return;
    }

    if (who === 0) {
        w.arrows = w.arrows.filter(a => a.who !== 0);
        if (w.foe.darts >= MAX_DARTS) { startPlayerTurn(w); return; }
        w.phase = 'foeAim';
        w.phaseT = 0;
    } else {
        w.arrows = w.arrows.filter(a => a.who !== 1);
        // He buys between legs. Never mid-turn, so it is always a clean choice.
        if (w.drunk < MAX_DRUNK && w.you.darts < MAX_DARTS) {
            w.phase = 'offer';
            w.phaseT = 0;
            say(w, pick(w, SAY.offer));
            return;
        }
        startPlayerTurn(w);
    }
};

const startPlayerTurn = (w: DartsWorld) => {
    if (w.you.darts >= MAX_DARTS) {
        if (w.foe.darts >= MAX_DARTS) { endTurn(w, 1); return; }
        w.phase = 'foeAim';
        w.phaseT = 0;
        return;
    }
    w.phase = 'aimX';
    w.phaseT = 0;
    w.pressAt = -1;
};

/* ------------------------------------------------------------------ */
/* Throwing                                                            */
/* ------------------------------------------------------------------ */

/**
 * Releases the player's dart. The landing point is the locked reticle plus a
 * release tremor that scales with drink — the hand shake that happens after
 * you have already decided where to put it.
 */
const throwPlayerDart = (w: DartsWorld) => {
    const [rx, ry] = reticleAt(w);
    const sd = tremor(w.drunk);
    const tx = rx + gauss(w) * sd;
    const ty = ry + gauss(w) * sd;

    // Error is measured against the aim CENTRE — what you actually pointed at —
    // so the headless run can watch the grouping fall apart with each drink.
    w.stats.aimErrSum += Math.hypot(tx - w.aimX, ty - w.aimY);
    w.stats.aimErrN += 1;
    w.stats.throws += 1;

    w.fly = { sx: 258, sy: 136, tx, ty, who: 0 };   // out of your own raised hand
    w.phase = 'fly';
    w.phaseT = 0;
};

/**
 * The obvious place to aim with this score on the board: treble twenty until
 * you are under 61, then the single or double that checks you out. Deliberately
 * naive — it never sets up a finish two darts ahead — and it is what the
 * opponent uses, which is why a sober player beats him and a drunk one does not.
 */
export const aimTargetFor = (score: number): [number, number] => {
    if (score > 60) return wedgePoint(20, (R_TRIPLE_IN + R_TRIPLE_OUT) / 2);
    if (score === 50) return [0, 0];
    if (score <= 20) return wedgePoint(score, (R_TRIPLE_OUT + R_DOUBLE_IN) / 2);
    if (score % 2 === 0 && score / 2 <= 20) return wedgePoint(score / 2, (R_DOUBLE_IN + R_SCORE) / 2);
    return wedgePoint(20, (R_TRIPLE_OUT + R_DOUBLE_IN) / 2);
};

const throwFoeDart = (w: DartsWorld) => {
    const [ax, ay] = aimTargetFor(w.foe.score);
    const tx = ax + gauss(w) * FOE_SIGMA;
    const ty = ay + gauss(w) * FOE_SIGMA;
    w.fly = { sx: 196, sy: 118, tx, ty, who: 1 };   // out of his
    w.phase = 'foeFly';
    w.phaseT = 0;
};

/** The dart has arrived. Score it, stick it in the board, react. */
const landDart = (w: DartsWorld) => {
    const f = w.fly!;
    const hit = scoreAt(f.tx, f.ty);
    w.arrows.push({ x: f.tx, y: f.ty, who: f.who });
    w.lastHit = hit;
    w.fly = null;
    w.shake = Math.max(w.shake, hit.ring === 'miss' ? 1.2 : 2.6);

    if (f.who === 0) {
        if (hit.ring === 'miss') { w.stats.misses += 1; say(w, pick(w, SAY.bad)); }
        else {
            w.stats.scored += hit.value;
            if (hit.ring === 'treble') w.stats.trebles += 1;
            if (hit.ring === 'bull') w.stats.bulls += 1;
            if (hit.value >= 40) say(w, pick(w, SAY.good));
        }
    } else {
        say(w, pick(w, hit.ring === 'miss' ? SAY.foeBad : SAY.foeGood));
    }

    const turnOver = applyHit(w, f.who, hit);
    if (w.result) return;

    if (f.who === 0) {
        /**
         * Three drinks in, your own arithmetic starts flattering you. The true
         * score is already correct in `you.score`; only `shown` lies, and only
         * until he looks up from his pint.
         */
        if (w.drunk >= 3 && hit.value > 0 && rng(w) < 0.15 + w.drunk * 0.09) {
            const fudge = 3 + Math.floor(rng(w) * (5 + w.drunk * 3));
            w.miscount = fudge;
            w.miscountT = MISCOUNT_HOLD;
            w.shown = Math.max(0, w.you.score - fudge);
            w.stats.miscounts += 1;
        }
        w.phase = 'land';
        w.phaseT = 0;
    } else {
        w.phase = 'foeLand';
        w.phaseT = 0;
    }
    w.turnOver = turnOver;
    w.pressAt = -1;
};

/* ------------------------------------------------------------------ */
/* Drinks                                                              */
/* ------------------------------------------------------------------ */

const takeDrink = (w: DartsWorld) => {
    w.drunk = clamp(w.drunk + 1, 0, MAX_DRUNK);
    w.drinks += 1;
    w.stats.drinksTaken += 1;
    w.empties += 2;     // he is drinking too; his are the ones with the lipstick
    say(w, pick(w, SAY.accepted));
    shout(w, `DRUNK ${w.drunk} / ${MAX_DRUNK}`, PAL.warn, 1.4);
    w.shake = Math.max(w.shake, 3);
    startPlayerTurn(w);
};

const declineDrink = (w: DartsWorld) => {
    w.declines += 1;
    w.stats.declines += 1;
    w.empties += 1;     // he had one anyway
    say(w, pick(w, SAY.declined));
    startPlayerTurn(w);
};

/* ------------------------------------------------------------------ */
/* Step                                                                */
/* ------------------------------------------------------------------ */

export const stepDarts = (w: DartsWorld, dt: number, cmd: DartsCmd) => {
    w.t += dt;
    w.phaseT += dt;
    if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 9);
    if (w.bannerT > 0) w.bannerT -= dt;
    if (w.sayT > 0) w.sayT -= dt;

    // The room lists once he has bought you a couple. Cosmetic, but it is the
    // same counter driving the sway, so it never lies about how far gone you are.
    w.tilt = w.drunk >= 2 ? Math.sin(w.t * 0.55) * 0.0055 * (w.drunk - 1) : 0;

    // He notices the chalk is wrong and says so.
    if (w.miscountT > 0) {
        w.miscountT -= dt;
        if (w.miscountT <= 0) {
            w.miscount = 0;
            w.shown = w.you.score;
            say(w, pick(w, SAY.correct));
            shout(w, 'RE-COUNT', PAL.warn, 0.9);
        }
    }

    const aiming = w.phase === 'aimX' || w.phase === 'aimY';
    if (aiming) {
        // Nudging the aim centre is the skill you keep when sober and lose
        // slowly as you drink: the arm gets heavier, not the button.
        const sp = nudgeSpeed(w.drunk) * dt;
        if (cmd.left) w.aimX -= sp;
        if (cmd.right) w.aimX += sp;
        if (cmd.up) w.aimY -= sp;
        if (cmd.down) w.aimY += sp;
        const r = Math.hypot(w.aimX, w.aimY);
        if (r > AIM_LIMIT) { w.aimX = (w.aimX / r) * AIM_LIMIT; w.aimY = (w.aimY / r) * AIM_LIMIT; }

        /**
         * Input lag. The press is queued and only resolves `inputLag(drunk)`
         * seconds later; the reticle keeps swaying through that window, so the
         * lock lands where the dart-hand had already drifted to, not where you
         * saw it when you pressed. Sober the lag is exactly zero.
         */
        if (cmd.aPress && w.pressAt < 0) w.pressAt = w.t + inputLag(w.drunk);
        if (w.pressAt >= 0 && w.t >= w.pressAt) {
            w.pressAt = -1;
            if (w.phase === 'aimX') {
                const [rx] = reticleAt(w);
                w.lockX = rx;
                w.phase = 'aimY';
                w.phaseT = 0;
            } else {
                throwPlayerDart(w);
            }
            return;
        }
    }

    switch (w.phase) {
        case 'intro':
            if (cmd.aPress || w.phaseT >= INTRO_TIME) startPlayerTurn(w);
            break;

        case 'aimX':
            // He will not wait all night; a timeout throws it wherever it is.
            if (w.phaseT >= AIM_X_TIME) { const [rx] = reticleAt(w); w.lockX = rx; w.phase = 'aimY'; w.phaseT = 0; }
            break;

        case 'aimY':
            if (w.phaseT >= AIM_Y_TIME) throwPlayerDart(w);
            break;

        case 'fly':
        case 'foeFly':
            if (w.phaseT >= FLY_TIME) landDart(w);
            break;

        case 'land':
            if (w.phaseT >= LAND_TIME) {
                if (w.turnOver) endTurn(w, 0);
                else { w.phase = 'aimX'; w.phaseT = 0; w.pressAt = -1; }
            }
            break;

        case 'foeAim':
            if (w.phaseT >= FOE_AIM_TIME) throwFoeDart(w);
            break;

        case 'foeLand':
            if (w.phaseT >= FOE_LAND_TIME) {
                if (w.turnOver) endTurn(w, 1);
                else { w.phase = 'foeAim'; w.phaseT = 0; }
            }
            break;

        case 'offer':
            // A drinks, B declines, and running the clock out declines for you.
            if (cmd.aPress) takeDrink(w);
            else if (cmd.bPress || w.phaseT >= OFFER_TIME) declineDrink(w);
            break;

        case 'over':
        default:
            break;
    }
};

/* ------------------------------------------------------------------ */
/* Draw                                                                */
/* ------------------------------------------------------------------ */

const sector = (
    ctx: CanvasRenderingContext2D, r0: number, r1: number, a0: number, a1: number, color: string,
) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(CX, CY, r1, a0, a1);
    ctx.arc(CX, CY, r0, a1, a0, true);
    ctx.closePath();
    ctx.fill();
};

const CREAM = '#ded3b6';
const BLACKW = '#15130f';
const REDW = '#bf332c';
const GREENW = '#2f7d4a';

const drawBoard = (ctx: CanvasRenderingContext2D) => {
    // Surround and number ring.
    circle(ctx, CX, CY, R_RING + 2, '#0a0b0d');
    circle(ctx, CX, CY, R_RING, '#1b1713');
    circle(ctx, CX, CY, R_SCORE, BLACKW);

    for (let i = 0; i < 20; i++) {
        const a0 = -Math.PI / 2 + (i - 0.5) * WEDGE_ARC;
        const a1 = a0 + WEDGE_ARC;
        const light = i % 2 === 1;
        const single = light ? CREAM : BLACKW;
        const ring = light ? GREENW : REDW;
        sector(ctx, R_TRIPLE_OUT, R_DOUBLE_IN, a0, a1, single);
        sector(ctx, R_BULL_OUT, R_TRIPLE_IN, a0, a1, single);
        sector(ctx, R_TRIPLE_IN, R_TRIPLE_OUT, a0, a1, ring);
        sector(ctx, R_DOUBLE_IN, R_SCORE, a0, a1, ring);
    }

    // Wire: spider legs and ring circles, thin and grey like the real thing.
    ctx.save();
    ctx.strokeStyle = 'rgba(190,198,206,0.55)';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 20; i++) {
        const a = -Math.PI / 2 + (i - 0.5) * WEDGE_ARC;
        ctx.beginPath();
        ctx.moveTo(CX + Math.cos(a) * R_BULL_OUT, CY + Math.sin(a) * R_BULL_OUT);
        ctx.lineTo(CX + Math.cos(a) * R_SCORE, CY + Math.sin(a) * R_SCORE);
        ctx.stroke();
    }
    for (const r of [R_BULL_OUT, R_TRIPLE_IN, R_TRIPLE_OUT, R_DOUBLE_IN, R_SCORE]) {
        ctx.beginPath();
        ctx.arc(CX, CY, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();

    circle(ctx, CX, CY, R_BULL_OUT, GREENW);
    circle(ctx, CX, CY, R_BULL, REDW);

    // Numbers on the surround.
    for (let i = 0; i < 20; i++) {
        const a = -Math.PI / 2 + i * WEDGE_ARC;
        text(ctx, String(WEDGES[i]), CX + Math.cos(a) * 58, CY + Math.sin(a) * 58, {
            size: 6, color: CREAM, align: 'center', baseline: 'middle', bold: true,
        });
    }
};

const drawArrow = (ctx: CanvasRenderingContext2D, x: number, y: number, who: 0 | 1) => {
    const c = who === 0 ? PAL.accent : PAL.accent2;
    shadow(ctx, x + 1, y + 1, 2, 1.2, 0.5);
    line(ctx, x, y, x + 7, y - 7, '#c9cdd2', 1.4);   // barrel, coming at you
    line(ctx, x + 6, y - 6, x + 10, y - 10, c, 2.4); // flight
    circle(ctx, x, y, 1.1, '#f2f4f6');               // point
};

const drawBar = (ctx: CanvasRenderingContext2D, w: DartsWorld) => {
    clear(ctx, VW, VH, '#0a0a0d');
    // Wall, papered in whatever this is.
    rect(ctx, 0, 0, VW, VH, '#171318');
    for (let x = 0; x < VW; x += 9) line(ctx, x, 0, x, 150, 'rgba(0,0,0,0.18)', 1);
    rect(ctx, 0, 150, VW, VH - 150, '#0e0c10');
    line(ctx, 0, 150, VW, 150, '#241f28', 1);

    // The one light in the place, hanging over the board.
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = PAL.warn;
    ctx.beginPath();
    ctx.moveTo(CX - 7, 0);
    ctx.lineTo(CX + 7, 0);
    ctx.lineTo(CX + 74, 150);
    ctx.lineTo(CX - 74, 150);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    rect(ctx, CX - 8, 0, 16, 5, '#2b2630');

    drawBoard(ctx);

    /* --- chalk scoreline --------------------------------------------- */
    const bx = 172;
    rect(ctx, bx, 16, 100, 62, '#0c0e12');
    outline(ctx, bx, 16, 100, 62, '#3a3f48');
    ctx.save();
    ctx.globalAlpha = 0.88;
    text(ctx, '301', bx + 50, 20, { size: 7, color: PAL.white, align: 'center' });
    line(ctx, bx + 50, 29, bx + 50, 72, 'rgba(255,255,255,0.35)', 1);
    line(ctx, bx + 6, 30, bx + 94, 30, 'rgba(255,255,255,0.35)', 1);
    text(ctx, 'YOU', bx + 25, 33, { size: 6, color: PAL.accent, align: 'center' });
    text(ctx, w.opponent.slice(0, 8), bx + 75, 33, { size: 6, color: PAL.accent2, align: 'center' });
    // The left-hand number is the one you are writing, so it is the one that lies.
    const wrong = w.miscount > 0;
    text(ctx, String(w.shown), bx + 25, 44, {
        size: 16, color: wrong ? PAL.warn : PAL.white, align: 'center', bold: true,
    });
    text(ctx, String(w.foe.score), bx + 75, 44, { size: 16, color: PAL.white, align: 'center', bold: true });
    if (wrong) text(ctx, '?', bx + 42, 46, { size: 9, color: PAL.bad });
    text(ctx, `${MAX_DARTS - w.you.darts} left`, bx + 25, 64, { size: 6, color: PAL.dim, align: 'center' });
    text(ctx, `${MAX_DARTS - w.foe.darts} left`, bx + 75, 64, { size: 6, color: PAL.dim, align: 'center' });
    ctx.restore();

    /* --- him, and the table of evidence ------------------------------- */
    figure(ctx, 186, 150, 50, {
        kit: KIT.rival,
        facing: -1,
        armUp: w.phase === 'foeAim' || w.phase === 'foeFly' ? 0.85 : 0.1,
        stride: 0,
    });

    const tx = 206;
    rect(ctx, tx, 148, 74, 4, '#2a2229');
    rect(ctx, tx + 30, 152, 8, 26, '#201a20');
    for (let i = 0; i < Math.min(w.empties, 12); i++) {
        const ex = tx + 5 + (i % 6) * 9;
        const ey = 148 - Math.floor(i / 6) * 0;
        const tall = i % 3 !== 0;
        // Bottles and cans, leaning slightly, because the table is not level.
        rect(ctx, ex, ey - (tall ? 13 : 9), 5, tall ? 13 : 9, i % 2 ? '#3f6b3a' : '#6b4a2a');
        if (tall) rect(ctx, ex + 1.5, ey - 17, 2, 4, '#3f6b3a');
        rect(ctx, ex, ey - (tall ? 13 : 9), 5, 2, 'rgba(255,255,255,0.16)');
    }
    if (w.empties > 0) {
        text(ctx, `${w.empties}`, tx + 70, 140, { size: 6, color: PAL.faint, align: 'right' });
    }
};

const PROMPT: Record<Phase, (w: DartsWorld) => string> = {
    intro: () => 'A — THROW   ✛ MOVE YOUR AIM',
    aimX: () => 'A — LOCK SIDE TO SIDE',
    aimY: () => 'A — LOCK HEIGHT AND THROW',
    fly: () => '',
    land: () => '',
    foeAim: () => '',
    foeFly: () => '',
    foeLand: () => '',
    offer: w => `A — TAKE IT (DRUNK ${w.drunk + 1})    B — NO THANKS`,
    over: () => '',
};

export const drawDarts = (ctx: CanvasRenderingContext2D, w: DartsWorld) => {
    const scene = (alpha: number, dx: number) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        const [sx, sy] = shakeOffset(w.shake);
        ctx.translate(VW / 2 + sx + dx, VH / 2 + sy);
        if (w.tilt) ctx.rotate(w.tilt);
        ctx.translate(-VW / 2, -VH / 2);

        drawBar(ctx, w);

        /* --- darts already in the board --- */
        for (const a of w.arrows) drawArrow(ctx, CX + a.x, CY + a.y, a.who);

        /* --- dart in flight: it comes from behind you, so it grows --- */
        if (w.fly) {
            const p = clamp(w.phaseT / FLY_TIME, 0, 1);
            const x = w.fly.sx + (CX + w.fly.tx - w.fly.sx) * p;
            const y = w.fly.sy + (CY + w.fly.ty - w.fly.sy) * p - Math.sin(p * Math.PI) * 9;
            const len = 10 - 6 * p;
            line(ctx, x, y, x + len, y - len, '#c9cdd2', 1.6);
        }

        /* --- reticle --- */
        if (w.phase === 'aimX' || w.phase === 'aimY') {
            const [rx, ry] = reticleAt(w);
            const px = CX + rx;
            const py = CY + ry;
            const c = w.drunk >= 4 ? PAL.bad : w.drunk >= 2 ? PAL.warn : PAL.accent;
            ctx.save();
            ctx.globalAlpha = 0.9;
            // Locked axis goes solid; the live axis is the one still moving.
            if (w.phase === 'aimY') line(ctx, px, CY - R_RING, px, CY + R_RING, c, 0.8);
            else line(ctx, px, py - 9, px, py + 9, c, 1);
            line(ctx, px - 9, py, px + 9, py, c, 1);
            ctx.strokeStyle = c;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, 5.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            // Where you are actually pointing, under all that wobble.
            circle(ctx, CX + w.aimX, CY + w.aimY, 1, 'rgba(255,255,255,0.4)');
        }

        /* --- your arm, bottom right --- */
        // You, at the oche, far right so the empties stay visible beside you.
        figure(ctx, 266, 176, 50, {
            kit: KIT.player,
            facing: -1,
            armUp: w.phase === 'aimY' || w.phase === 'fly' ? 0.95 : 0.35,
        });

        ctx.restore();
    };

    // Four drinks in, everything has an edge on it.
    scene(1, 0);
    if (w.drunk >= 4) scene(0.16 + (w.drunk - 4) * 0.06, 1.6);

    /* --- HUD that does not tilt, so the numbers stay readable --------- */
    rect(ctx, 0, 0, VW, 12, 'rgba(6,6,9,0.78)');
    text(ctx, `YOU ${w.shown}`, 5, 2, {
        size: 8, color: w.miscount > 0 ? PAL.warn : PAL.accent, bold: true,
    });
    text(ctx, `${w.opponent} ${w.foe.score}`, VW - 5, 2, { size: 8, color: PAL.accent2, align: 'right', bold: true });

    // Drink meter, with the cost printed next to it. No hidden handicap.
    const meterX = VW / 2 - 26;
    for (let i = 0; i < MAX_DRUNK; i++) {
        rect(ctx, meterX + i * 8, 3, 6, 6, i < w.drunk ? PAL.warn : 'rgba(255,255,255,0.12)');
    }
    text(ctx, `±${Math.round(swayAmp(w.drunk, w.focus))}px ${Math.round(inputLag(w.drunk) * 1000)}ms`,
        VW / 2 + 18, 3, { size: 6, color: w.drunk ? PAL.warn : PAL.faint });

    if (w.lastHit && (w.phase === 'land' || w.phase === 'foeLand')) {
        const c = w.lastHit.ring === 'miss' ? PAL.bad : w.lastHit.value >= 40 ? PAL.legend : PAL.ink;
        text(ctx, w.lastHit.ring === 'miss' ? 'NO SCORE' : `${w.lastHit.label} — ${w.lastHit.value}`,
            CX, CY + R_RING + 8, { size: 8, color: c, align: 'center', bold: true });
    }

    if (w.sayT > 0) {
        const a = clamp(w.sayT / 0.7, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        rect(ctx, 0, VH - 24, VW, 11, 'rgba(6,6,9,0.8)');
        text(ctx, `"${w.say}"`, VW / 2, VH - 19, { size: 7, color: PAL.accent2, align: 'center', baseline: 'middle' });
        ctx.restore();
    }

    const prompt = PROMPT[w.phase](w);
    if (prompt) {
        rect(ctx, 0, VH - 11, VW, 11, 'rgba(6,6,9,0.82)');
        text(ctx, prompt, VW / 2, VH - 6, {
            size: 7, color: w.phase === 'offer' ? PAL.warn : PAL.accent, align: 'center', baseline: 'middle',
        });
    }

    if (w.phase === 'offer') {
        glyph(ctx, '🍺', CX, CY, 26, Math.sin(w.t * 3) * 0.1, 0.92);
    }

    if (w.bannerT > 0) {
        const size = w.phase === 'over' ? 20 : 15 + Math.sin(w.t * 20) * 1.5;
        drawBanner(ctx, w.bannerText, VW, 62, w.bannerColor, size);
    }
    if (w.phase === 'intro') {
        drawBanner(ctx, 'DRUNK DARTS', VW, 60, PAL.accent, 18);
        text(ctx, '301 down. He is buying. You do not have to drink it.', VW / 2, 76, {
            size: 7, color: PAL.dim, align: 'center',
        });
    }
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const DartsGame: React.FC<{
    opponent?: string;
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ opponent = 'Big Ron', onFinish, onQuit }) => {
    const { gameState } = useGame();
    const { player } = gameState;

    const [done, setDone] = useState<null | boolean>(null);
    const { input, set, consume } = useInput(done === null);

    const worldRef = useRef<DartsWorld | null>(null);
    if (!worldRef.current) {
        worldRef.current = createDartsWorld((Date.now() ^ 0x2f6e1d3b) | 0, {
            opponent,
            focus: player.focus,
        });
    }

    // HUD mirror: only written when a *displayed* value changes.
    const hudRef = useRef({ you: START_SCORE, foe: START_SCORE, drunk: 0, darts: MAX_DARTS });
    const [hud, setHud] = useState(hudRef.current);
    const doneRef = useRef(false);
    const finishedRef = useRef(false);

    const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
        const w = worldRef.current!;
        if (!doneRef.current) {
            const s = input.current;
            stepDarts(w, dt, {
                left: s.left, right: s.right, up: s.up, down: s.down,
                a: s.a, b: s.b,
                aPress: consume('a'), bPress: consume('b'),
            });
        }
        drawDarts(ctx, w);

        const h = hudRef.current;
        const left = MAX_DARTS - w.you.darts;
        if (h.you !== w.shown || h.foe !== w.foe.score || h.drunk !== w.drunk || h.darts !== left) {
            hudRef.current = { you: w.shown, foe: w.foe.score, drunk: w.drunk, darts: left };
            setHud(hudRef.current);
        }
        if (w.result && !doneRef.current) {
            doneRef.current = true;
            setDone(w.result === 'win');
        }
    }, [input, consume]);

    // onFinish must fire exactly once no matter how many times the card is hit.
    const finish = () => {
        if (finishedRef.current || done === null) return;
        finishedRef.current = true;
        const w = worldRef.current!;
        const sober = w.drinks === 0;
        onFinish(
            done,
            done
                ? sober
                    ? `You beat ${opponent} at 301 stone cold sober, which he is taking badly.`
                    : `You beat ${opponent} at 301 with ${w.drinks} of his pints in you.`
                : `${opponent} took the 301. You finished on ${w.you.score} and ${w.drinks} pints.`,
        );
    };

    const w = worldRef.current;

    return (
        <ArcadeShell
            title="Drunk Darts"
            subtitle={`${opponent} — 301 down, and he is buying`}
            width={VW}
            height={VH}
            running={done === null}
            onFrame={onFrame}
            onInput={set}
            actions={['THROW', 'NO']}
            vertical
            onQuit={done === null ? onQuit : undefined}
            quitLabel="Settle Up"
            hud={
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="chip">
                        YOU <b className="numeric text-[var(--accent)] ml-1">{hud.you}</b>
                    </span>
                    <span
                        className="label flex items-center gap-1"
                        title={`Every drink is a measurable handicap: sway ±${Math.round(swayAmp(hud.drunk, player.focus))}px, input lag ${Math.round(inputLag(hud.drunk) * 1000)}ms, release tremor ${tremor(hud.drunk).toFixed(1)}px`}
                    >
                        <span className="text-[var(--warn)]">{'🍺'.repeat(hud.drunk) || '—'}</span>
                        <span className="numeric">±{Math.round(swayAmp(hud.drunk, player.focus))}px</span>
                        <span className="numeric opacity-70">{Math.round(inputLag(hud.drunk) * 1000)}ms</span>
                        <span className="opacity-60">{hud.darts} darts</span>
                    </span>
                    <span className="chip">
                        <b className="numeric text-[var(--accent2)] mr-1">{hud.foe}</b> {opponent.toUpperCase().slice(0, 10)}
                    </span>
                </div>
            }
            overlay={
                done === null ? undefined : (
                    <MiniGameResult
                        won={done}
                        headline={done ? 'Checked Out' : 'He Took The Board'}
                        detail={
                            done
                                ? `${opponent} inspects the board, inspects your glass, and decides the board is warped.`
                                : `${opponent} buys you one more. For the road. He says it will help.`
                        }
                        onClose={finish}
                        closeLabel={done ? 'Collect' : 'Settle Up'}
                    />
                )
            }
            help={
                '301 down, first to exactly nothing; go under and the whole turn busts back. ✛ moves where you are pointing. A locks the side-to-side, A again locks the height and throws — two presses, both of them skill. '
                + `Between legs he buys a round: A takes it, B (or just waiting) refuses, and refusing costs you nothing but his opinion. Each drink is a printed handicap — sway goes from ±${Math.round(swayAmp(0, player.focus))}px to ±${Math.round(swayAmp(MAX_DRUNK, player.focus))}px, the drift speeds up, and your button gets up to ${Math.round(inputLag(MAX_DRUNK) * 1000)}ms of lag so the lock lands late. `
                + `Past three pints your own chalk starts flattering you until he re-counts it out loud. Your focus (${Math.round(player.focus)}) takes a little off the sway and nothing off the beer.`
            }
        />
    );
};

export default DartsGame;
