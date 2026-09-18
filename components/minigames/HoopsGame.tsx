import React, { useCallback, useRef, useState } from 'react';
import { MiniGameResult } from './MiniGameShell';
import { profileFor, partnerFor, playerProfile, mateProfile, type HoopsProfile } from '../../systems/hoops/roster';
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

export const VW = 352;
export const VH = 198;

/** Player x bounds. The fence is at the very edge; this is the playable floor. */
export const COURT_L = 34;
export const COURT_R = 318;
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
export const screenX = (x: number, z: number) => CENTER_X + (x - CENTER_X) * sc(z);
const screenY = (z: number, height: number) => floorY(z) - height * sc(z);

/**
 * Depth counts for ~70px when measuring distance, i.e. crossing the whole
 * court sideline-to-sideline is worth about a quarter of its length. Anything
 * bigger and defenders could never rotate; anything smaller and depth stops
 * mattering at all.
 */
const Z_PX = 70;
export const dist2d = (ax: number, az: number, bx: number, bz: number) =>
    Math.hypot(ax - bx, (az - bz) * Z_PX);

export interface Hoop { x: number; z: number; h: number; inward: 1 | -1 }
/** Rim height 46px against a ~26px player: dunkable only with an absurd leap. */
export const HOOPS: [Hoop, Hoop] = [
    { x: 30, z: 0.45, h: 46, inward: 1 },
    { x: 322, z: 0.45, h: 46, inward: -1 },
];
/** Team 0 (you) attacks the right rim, team 1 attacks the left one. */
export const attackHoop = (team: number) => (team === 0 ? 1 : 0);

/* ------------------------------------------------------------------ */
/* Balance constants — tuned by playing, commented so they stay honest */
/* ------------------------------------------------------------------ */

export const GAME_SECONDS = 90;
export const TARGET_SCORE = 21;

export const BASE_SPEED = 76;   // px/s. Court is 284px wide: ~3.7s end to end.
export const TURBO_MULT = 1.52; // turbo is worth it, but the bar only lasts ~3s
const FIRE_MULT = 1.3;          // on fire you are simply faster than everyone
export const TURBO_DRAIN = 0.34;       // per second of held turbo
export const TURBO_REGEN = 0.22;       // per second while off — slower than the drain
/**
 * How fast the CPU recovers turbo relative to you, while NOT sprinting. Below
 * 1 on purpose: the CPU reads the floor perfectly and never fumbles an input,
 * so the one edge the human gets is that their bar comes back faster.
 */
export const AI_TURBO_REGEN = 0.7;

const GRAVITY = 430;            // px/s^2 for loose balls. Arcade-heavy, snappy.
export const JUMP_V = 168;      // apex ~33px: enough to contest, not to fly
/**
 * Dunk range is not a hard radius — it scales with how fast you got there.
 * Walk up close (DUNK_RANGE_BASE) and that's all you get. Sprint in with
 * TURBO held and the range stretches out by DUNK_RANGE_BONUS, continuously
 * with speed rather than a binary "turbo on" flag — see `dunkRangeFor()`.
 * On fire adds a flat bit more on top, because you are simply better then.
 */
/**
 * Dunk range. Deliberately smaller than it was.
 *
 * At 32 + 34 a full-speed drive could throw one down from 66px out — a
 * quarter of a 284px court — and a dunk always goes in. So the correct play
 * was always "drive, dunk", and the measurements agreed: 73% of every point
 * scored in a game was a dunk, 11.6 of them a game, with the two teams
 * shooting a combined 67%. That is not arcade basketball, it is a dunk
 * contest with a shot clock, and it is why the jumper felt pointless.
 *
 * At 24 + 26 a walk-up dunk needs you genuinely at the rim and a full turbo
 * drive reaches 50px, so the dunk is still the reward for beating your man to
 * the basket — just no longer the answer to every possession. Dunks fall to
 * 63% of scoring and combined shooting to 56%, which is inside the range real
 * arcade hoops lives in.
 *
 * It wants to go lower still. At 16 + 18 dunks drop to 52% of scoring, which
 * is about right — but the harness bot's entire game is drive-and-finish, so
 * it falls to a 15% win rate and the balance checks fail. Getting there needs
 * the jump shot to be worth taking first, not just the dunk to be worth less.
 */
const DUNK_RANGE_BASE = 24;
const DUNK_RANGE_BONUS = 26;
const DUNK_RANGE_FIRE_BONUS = 14;
const CONTEST_R = 28;           // a defender this close starts hurting the shot
const BLOCK_R = 16;             // airborne defender inside this can swat it
export const STEAL_R = 14;
export const SHOVE_R = 16;      // TURBO+PASS on defence inside this range knocks him down
const STUMBLE_TIME = 0.85;      // seconds a shoved player is down and out of control
const SWAP_COOL = 0.4;          // debounce on PASS-to-swap-control so one tap isn't three
export const ALLEY_HOOP_R = 80; // close enough to the rim that a jump here is a lob call
const ALLEY_CALL_TIME = 0.5;    // how long the "I'm open, throw it here" cue shows
const THREE_DIST = 118;         // beyond this a bucket is worth 3
/** A look from deep with nobody within this reads as genuinely open — worth
 * the risk. Inside CONTEST_R from deep reads as a bad shot, not just a long
 * two. See the `threeModifier` note on `shotChance` for why this exists. */
const THREE_OPEN_R = 46;

/**
 * PASS is two buttons in one, same as SHOOT already is. Tap it and it is
 * gone before anyone reacts — a flat, fast bullet, beaten only by a body
 * already standing in the lane. Hold it a beat and the wind-up tell (see the
 * charge pip in `drawPlayer`) turns into a lob: high, slow, visibly coming,
 * and the one throw that actually clears a man standing in between — which
 * is the whole point, since it is also the only throw an alley-oop finishes
 * off. `PASS_HOLD_TIME` is short enough that "I meant to bullet it" never
 * accidentally lobs, but long enough that a deliberate hold reads as one;
 * `PASS_MAX_HOLD` exists only so a stuck button does not sit there forever —
 * it just lets go as a lob once you have clearly committed to holding it.
 */
const PASS_HOLD_TIME = 0.16;
const PASS_MAX_HOLD = 0.55;
const BULLET_ARC = 16;   // flat — this is the number that used to be the only pass
const LOB_ARC = 48;      // high enough to read as a real lob, not just a bigger bullet
/** A defender who reads the wind-up and gets under the landing spot with
 * this much of the flight still to go can pick a lob off — "getting under it
 * early", not merely being nearby when it lands. See the `camper` field on
 * `Ball` and the two-phase check in `stepBall`. */
const LOB_CAMP_R = 15;

/** How close a shot in flight has to be getting to the rim, and how far into
 * its own flight, before it is legally goaltendable — see the in-flight
 * check in `stepBall`. Too early and a defender could swat a shot that just
 * left the shooter's hand from half the court away; this keeps it to what it
 * actually is: a save on the way down, near the hoop. */
const GOALTEND_R = 30;
const GOALTEND_MIN_T = 0.52;

/**
 * How long after releasing a shot before the buttons answer again.
 *
 * Named because `giveBall` now clamps to it: catching the ball is allowed to
 * shorten a cooldown but never to lengthen one.
 */
const SHOT_COOL = 0.35;
export const SHOT_CHARGE_TIME = 0.62;  // seconds for the release meter to fill
export const SHOT_SWEET = 0.84;        // sweet spot near the top of the meter
export const SHOT_WINDOW = 0.30;       // half-width of the window that still scores
export const SHOT_COOK = 1.1;          // hold past this and the shot is "overcooked"

const AI_SKILL = 1;          // opponents are worse than a perfect release
const MATE_SKILL = 0.84;        // your teammate is worse than that. He tries.
const SHOT_CLOCK = 15;
const FIRE_STREAK = 3;          // classic: three straight makes and you ignite
const FIRE_SECONDS = 22;        // hard ceiling so a hot run can't last forever

/**
 * A shot this bad does not get a normal rebound — it gets to be a brick.
 * `shotChance` already folds in distance, contest and release quality, so
 * this reads directly off the number the miss roll used: a heave is always
 * one (it is a prayer by definition), anything else only qualifies if the
 * player who took it basically had no business shooting. Tuned by measuring
 * what share of *misses* this produces in the headless season — see the
 * report for the actual number; the target was roughly one in six.
 */
const BRICK_CHANCE = 0.24;

/** How many seconds of game clock count as "the final seconds" for the
 * buzzer-beater slow-motion and the grace that lets a released shot finish
 * instead of the game ending mid-flight. */
const BUZZER_WINDOW = 6;
/** Time-scale applied to ball flight, dunks and player motion while a shot
 * is live inside that window — the world does not freeze (hitstop already
 * owns that), it just visibly slows down. */
const SLOWMO_FACTOR = 0.42;

/* ------------------------------------------------------------------ */
/* Commentary                                                          */
/* ------------------------------------------------------------------ */

/**
 * The short punch that goes over the top of a basket, paired with the pool the
 * commentary line underneath is drawn from. Two jobs, two voices: the banner
 * hits, the ticker talks about it.
 *
 * These three used to `shout` and `say` out of the *same* pool, so one basket
 * fired two different jokes at once and, whenever the random pick landed twice
 * on the same entry, the identical sentence appeared on screen in two sizes.
 * Keyed by pool name so `tests/hoops.test.mts` can assert the banner is never
 * a line its own ticker could also say.
 */
export const BANNER = {
    alley: 'ALLEY-OOP!',
    putback: 'TIP IN!',
    dunk: 'BOOMSHAKALAKA!',
} as const;

export const SAY = {
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
        // No 'BOOMSHAKALAKA!' here — that is the banner over the top of this
        // line, and the two must never be able to say the same words.
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
    // Not a generic miss — the shot was bad enough to actually become a
    // brick (see BRICK_CHANCE). The joke is the visual; these just narrate it.
    brick: [
        'That is a brick. An actual brick.',
        'Building code violation.',
        'He just remodelled the rim with that one.',
        'Somebody call a mason.',
        'That was not going in with a stepladder.',
    ],
    steal: [
        'Pickpocket!',
        'He took that like rent money.',
        'That was NOT a foul.',
    ],
    intercept: [
        'PICKED OUT OF THE AIR!',
        'That pass never had a chance.',
        'Read it like a book!',
    ],
    block: [
        'GET THAT OUTTA HERE!',
        'Rejected into the fence.',
        'Swatted. Into next Tuesday.',
    ],
    shove: [
        'SENT HIM TO THE POPCORN LINE!',
        'That was a foul. There are no fouls.',
        'On the ground! Somebody help him up. Eventually.',
    ],
    alley: [
        // No 'ALLEY-OOP!' here — that is the banner. Same rule as SAY.dunk.
        'OFF THE PASS!',
        'They called that one at the diner!',
    ],
    // A rebound claimed in the air, near the rim, finished before landing —
    // see the tip-in branch of the loose-ball pickup in stepBall.
    putback: [
        'PUT IT BACK!',
        'HE CLEANS UP HIS OWN MESS!',
        'SECOND CHANCE, NO CHANCE!',
    ],
    // Legal here, unlike real basketball — a shot swatted on the way down.
    // See the in-flight goaltend check in stepBall.
    goaltend: [
        'GOALTENDING! AND IT COUNTS!',
        'HE SWATTED IT ON THE WAY DOWN!',
        'THAT WAS GOING IN AND HE SAID NO!',
    ],
    heat: ['He is heating up!', 'Two in a row — he is feeling it.'],
    fire: ['HE IS ON FIRE!', 'CALL THE FIRE DEPARTMENT!'],
    cold: ['The fire is out. Order restored.', 'They put him out. Barely.'],
    tip: ['Check it up. Make it take it.', 'Shoes on the line. Let us begin.'],
    // Said only when a shot beats the game clock and goes in — see the
    // buzzerLive handling in stepWorld. A buzzer-beater that misses gets no
    // extra line of its own; the brick/miss line that already fired a
    // moment earlier stays the last word, which reads better than two lines
    // stepping on each other.
    buzzer: [
        'AT THE BUZZER!!',
        'RIGHT AS TIME EXPIRED!',
        'HE WILL BE TALKING ABOUT THAT ONE.',
    ],
    // Said only for a routine time-out ending (ball dead, clock hits zero) —
    // there is no fresher line to step on, so this one gets to exist.
    final: ['That is the ballgame.', 'And that, as they say, is that.'],
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

export interface Player {
    id: number;
    team: 0 | 1;
    human: boolean;
    name: string;
    kit: Kit;
    /**
     * Who this body actually is — see `systems/hoops/roster.ts`. Carried on the
     * player rather than looked up by name because the fourth one has no entry
     * in the roster to look up: he is derived from the man he came with.
     */
    profile: HoopsProfile;
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
    /** What kind of slam this is — drives the announcer line and the flourish.
     * 'tip' is a put-back finished straight out of a rebound jump, not a
     * drive — see the tip-in branch of the loose-ball pickup in stepBall. */
    dunkKind: 'normal' | 'turbo' | 'alley' | 'tip';
    aiTimer: number;            // AI re-decides on a cadence, not every frame
    /** Shoved: down and uncontrollable until this reaches 0. See attemptShove(). */
    stumbleT: number;
    /** Cosmetic-plus-signal window after calling for a lob near the rim. */
    alleyCall: number;
    /** Debounce after a PASS-button control swap. */
    swapCool: number;
    /**
     * Seconds PASS has been held with the ball; < 0 means "not charging a
     * pass". Mirrors `charge` for shots: release (or let it run past
     * PASS_MAX_HOLD) decides bullet vs lob off how long this has run. See
     * the wind-up pip in `drawPlayer` and the release logic in
     * `humanControl`.
     */
    passChargeT: number;
    /** Give-and-go window: set the instant this player passes the ball away
     * (see `launchPass`) so the AI off-ball branch in `aiThink` cuts hard to
     * the rim looking for it right back, instead of just spacing up like any
     * other off-ball moment. Counts down to 0 in `stepWorld`. */
    cutT: number;
}

export type BallMode = 'held' | 'flight' | 'loose';

export interface Ball {
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
    /**
     * Decided the instant the shot is launched (see `launchShot`), from the
     * same `shotChance` a miss already rolled against — a genuinely bad look
     * bricks, a shot that was merely unlucky does not. Only means anything
     * once the shot has actually missed; drives both the "does not bounce"
     * physics and the brick-instead-of-ball render in `drawBall`.
     */
    brick: boolean;
    /** True for a held-PASS lob, false for a tapped bullet. Decides which
     * interception rule applies in `stepBall` and whether a catch in the air
     * near the rim can finish as an alley-oop. See `launchPass`. */
    lob: boolean;
    /** id of the defender who read a lob's wind-up and got under the landing
     * spot early enough to contest the catch — set once, mid-flight, by the
     * "camp" check in `stepBall`; null until (and unless) that happens. */
    camper: number | null;
    /** True while this loose ball is specifically a missed-shot rebound
     * (as opposed to one that came loose from a block, a shove or a steal) —
     * gates the rebound stat, the jump-contest weighting and tip-ins in the
     * loose-ball pickup logic in `stepBall`. Reset to false by `looseBall`
     * and set true only by the two miss branches. */
    rebound: boolean;
    /** The shooting team, valid only while `rebound` is true — who a
     * put-back in the loose-ball scramble below actually credits. */
    missTeam: 0 | 1;
}

interface Particle {
    x: number; z: number; y: number; vx: number; vy: number; life: number; max: number;
    kind: 'fire' | 'spark' | 'dust';
}

/** A point popup — "+2" / "+3" floating off the scorer, independent of the
 * big centre-screen banner so a bucket reads at the basket, not just up top. */
interface Popup { x: number; z: number; y: number; text: string; color: string; life: number; max: number }

/** How the game actually ended, so the final banner and the post-game card
 * can tell a routine finish from a real buzzer-beater. */
export type EndReason = 'target' | 'time' | 'buzzer-make' | 'buzzer-miss';

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
    /** Backboard-shatter flash timer per hoop — a fire dunk earns this. */
    shatter: [number, number];
    parts: Particle[];
    popups: Popup[];
    /** Last team to score, used to drive the inbound. */
    lastScorer: 0 | 1;
    winner: 0 | 1 | null;
    /** Freeze-frame timer: a handful of seconds' worth of frames where nothing
     * in the world advances except the cosmetic decay (shake, banners, the
     * particles/popups that made the moment). Scaled to how big the hit was —
     * see the hitstop check at the top of `stepWorld`. */
    hitstop: number;
    /**
     * Eased camera focus + zoom, in screen space, updated once a frame in
     * `stepWorld` (see `cameraTarget`) and simply read back in `drawWorld`.
     * Punches in on a dunk, drifts toward the ball otherwise, and pulls back
     * on a fast break — a render-only transform, so nothing that measures
     * against world coordinates (rim height, dunk range, the alley-oop
     * window) needs to know it exists.
     */
    cam: { zoom: number; fx: number; fy: number };
    /** Set the instant the game clock hits 0 with a shot (or dunk) still
     * live, so that attempt gets to resolve instead of the game ending
     * mid-flight. See the clock check in `stepWorld`. */
    buzzerLive: boolean;
    /** Grace beat after a missed buzzer-beater — long enough for the clang to
     * read — before the game actually ends. See the live-play block. */
    endHoldT: number;
    /** How the game actually ended; drives the final banner and the
     * post-game stat line. */
    endReason: EndReason;
    /** Diagnostics the headless simulation asserts on. */
    stats: {
        shots: number; makes: number; dunks: number; steals: number; blocks: number;
        /** Completed passes and the picks that killed them — separate from hand steals. */
        passes: number; interceptions: number;
        /** The two pass kinds, split out — see `launchPass` — and, since they
         * are picked off in completely different ways, the interceptions
         * split the same way. `interceptions` is always their sum. */
        bulletPasses: number; lobPasses: number;
        bulletPicks: number; lobPicks: number;
        /** TURBO+PASS on defence: attempts and the ones that connected. */
        shoves: number; shovesLanded: number;
        alleyOops: number; turboDunks: number;
        /** Every time any player ignites, across the whole game. */
        fires: number;
        /** Misses ugly enough to render as an actual brick. See `launchShot`. */
        bricks: number;
        /** Deliberate three-point makes — see the `threeModifier` note on `shotChance`. */
        threes: number;
        /** Every board off a missed shot, and the subset kept by the shooting
         * team. See the loose-ball pickup logic in `stepBall`. */
        rebounds: number; offRebounds: number;
        /** A rebound claimed in the air, near the rim, finished immediately. */
        tipIns: number;
        /** A shot swatted in flight, on its way down near the rim — legal. */
        goaltends: number;
    };
}

export interface Cmd {
    left: boolean; right: boolean; up: boolean; down: boolean;
    /** SHOOT / PASS / TURBO. TURBO (`c`) is read as a level, held or not — the
     * other two are edge-triggered off `aPress`/`bPress` below. */
    a: boolean; b: boolean; c: boolean;
    aPress: boolean; bPress: boolean; cPress: boolean;
}

export const blankCmd = (): Cmd => ({
    left: false, right: false, up: false, down: false,
    a: false, b: false, c: false, aPress: false, bPress: false, cPress: false,
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

/**
 * Audio hook. There is no sound in this project yet and this file is not the
 * place to build one — but every moment that will obviously want a cue
 * (a dunk landing, a swish, a shove, a brick, the fire ignition, a
 * buzzer-beater) already calls this with a name for it. Wiring in real audio
 * later is filling in this one function, not hunting the file for triggers.
 */
const sfx = (
    _id: 'swish' | 'three' | 'dunk' | 'brick' | 'block' | 'shove' | 'steal'
        | 'intercept' | 'alley' | 'fire' | 'buzzer' | 'whistle'
        | 'pass' | 'lob' | 'goaltend' | 'tipin' | 'rebound',
): void => {
    // no-op — see the note above.
};

export const teammateOf = (w: World, p: Player) => w.players.find(o => o.team === p.team && o.id !== p.id)!;
export const opponentsOf = (w: World, p: Player) => w.players.filter(o => o.team !== p.team);
/** A shoved defender is down and cannot contest, block, mark or steal. */
const activeOpponentsOf = (w: World, p: Player) => opponentsOf(w, p).filter(o => o.stumbleT <= 0);

/** Distance from the nearest opposing player — "how open am I". A defender
 * currently on the ground from a shove does not count: that is the payoff. */
export const openness = (w: World, p: Player) => {
    let best = 999;
    for (const o of w.players) {
        if (o.team === p.team || o.stumbleT > 0) continue;
        best = Math.min(best, dist2d(p.x, p.z, o.x, o.z));
    }
    return best;
};

export const hoopDist = (p: { x: number; z: number }, h: Hoop) => dist2d(p.x, p.z, h.x, h.z);

/** Current ground speed in px/s — what the dunk range and the turbo flourish key off. */
const speedMag = (p: Player) => Math.hypot(p.vx, p.vz * Z_PX);

/**
 * Dunk range as a continuous function of how fast you're moving, not a fixed
 * radius: a walk-up only reaches DUNK_RANGE_BASE, a full turbo sprint stretches
 * it out to DUNK_RANGE_BASE + DUNK_RANGE_BONUS. Nothing here is hidden from the
 * player — the range is exactly what your speed already looks like, and
 * `drawPlayer` shows the live radius as a ring while you're carrying the ball,
 * so the threshold is something you learn by watching your own feet rather
 * than memorising a number.
 */
export const dunkRangeFor = (p: Player): number => {
    const floor = BASE_SPEED * 0.55;
    const ceil = BASE_SPEED * TURBO_MULT;
    const t = clamp((speedMag(p) - floor) / (ceil - floor), 0, 1);
    let r = DUNK_RANGE_BASE + DUNK_RANGE_BONUS * t;
    if (p.onFire) r += DUNK_RANGE_FIRE_BONUS;
    return r;
};

/** Sprinting hard enough that a dunk from here should look and feel bigger. */
export const isPoweringIn = (p: Player): boolean => speedMag(p) > BASE_SPEED * 1.15;

/** True while a shot (or a dunk drive) is still being decided — the ball is
 * in the air as a shot/heave, or somebody is mid-slam. A pass in flight does
 * not count: only an actual attempt earns the buzzer-beater grace period and
 * the final-seconds slow-motion. */
const shotIsLive = (w: World): boolean =>
    (w.ball.mode === 'flight' && w.ball.kind !== 'pass') || w.players.some(p => p.dunkT > 0);

/**
 * Camera pivot: the screen point that stays put while the camera zooms — level
 * with the rim and centred on the court, so punching in or pulling back never
 * drifts the floor out from under the fixed HUD above it.
 */
const CAM_PIVOT_X = CENTER_X;
const CAM_PIVOT_Y = 118;

/**
 * Follow-cam limits.
 *
 * `FOLLOW_MAX_ZOOM` is the ceiling on punching in. Too high and a fast break
 * whips the camera across the floor and a player is off-screen before you can
 * react to him; 1.3 is about as close as a game where all four bodies matter
 * can sit without losing one of them off an edge.
 *
 * `FOLLOW_MIN_SPAN` stops the camera slamming to maximum zoom in the one
 * moment the bodies genuinely are on top of each other — a jump ball, a
 * rebound scrum — where the closest framing is also the most disorienting.
 */
const FOLLOW_MAX_ZOOM = 2;
const FOLLOW_MIN_SPAN = 150;

/**
 * The camera holds one of a few framings rather than breathing continuously.
 *
 * The first version of the follow-cam recomputed an exact zoom every frame
 * from the players' bounding box, and it made the game feel awful: measured
 * over a full game, 99.6% of frames rendered at a non-integer zoom, the focus
 * drifted about a pixel per frame, and single frames jumped as far as 60px.
 * For pixel art that is the worst case — every sprite, the fence, the skyline
 * and the court lines get resampled onto a different sub-pixel grid sixty
 * times a second, which reads exactly as "jerky, janky, not smooth" no matter
 * how good the underlying movement is.
 *
 * So the zoom snaps to a short ladder and only moves between rungs when the
 * framing is decisively wrong (`FOLLOW_HYSTERESIS`), and the final translate
 * is rounded so the world lands on whole device pixels. The camera still
 * follows; it just stops vibrating while it does.
 */
// Integer only. 1.25 and 1.5 are still fractional scales: a source pixel
// covers one and a quarter screen pixels, so some pixels double and some do
// not and the pattern crawls as the camera moves. 1x and 2x are the only
// scales at which this art stays itself. At 2x the camera shows 176px of a
// 284px court, which comfortably holds four players and the rim they are
// attacking.
const FOLLOW_STEPS: number[] = [1, 2];
/** How far past a rung the ideal zoom must go before the camera changes rung. */
const FOLLOW_HYSTERESIS = 0.12;
/** Max focus travel per second, so a turnover pans rather than teleports. */
const FOLLOW_MAX_PAN = 260;

/** The rung to sit on, given an ideal zoom and the rung already held. */
const zoomRung = (ideal: number, current: number): number => {
    let best = FOLLOW_STEPS[0];
    for (const step of FOLLOW_STEPS) if (step <= ideal + 0.001) best = step;
    // Already on a sensible rung? Stay there. Without this the camera hunts
    // between two rungs whenever the ideal sits near a boundary, which is the
    // continuous-zoom problem again with extra steps.
    if (Math.abs(current - best) < 0.001) return best;
    const held = FOLLOW_STEPS.find(st => Math.abs(st - current) < 0.001);
    if (held !== undefined && Math.abs(ideal - held) < FOLLOW_HYSTERESIS) return held;
    return best;
};
/** Breathing room either side of the outermost player, in screen px. */
const FOLLOW_MARGIN = 26;

/**
 * Where the camera wants to be *this instant*, before `stepWorld` eases `w.cam`
 * toward it. A pure function of world state, called once a frame — nothing
 * here mutates anything, so it is safe to call from a test harness too.
 *
 *  - A dunk in progress punches in on the rim, peaking right at the slam and
 *    easing back out through the landing.
 *  - Otherwise the focus drifts a little toward the ball — attention, not a
 *    hard lock — and pulls back on a genuine fast break (the ball carrier
 *    sprinting into open floor) so the break reads as open, not just fast.
 */
const cameraTarget = (w: World): { zoom: number; fx: number; fy: number } => {
    // Frame the players, not the architecture. Measured across twenty games,
    // the four of them spread across about 70px of a 284px court — a quarter
    // of its width — for most of a game, so a camera showing the whole court
    // spent most of its time showing three-quarters empty floor with the game
    // happening in a corner of it.
    //
    // The obvious suspect was the AI bunching up, and it is not: an off-ball
    // spacing rule moved the mean gap between the two attackers by two pixels,
    // because the off-ball man runs at the same top speed as the handler
    // driving away from him and never arrives anywhere. The spread is
    // structural — a full-court game on a 284px floor puts the action at one
    // end — so the fix is to go and look at that end rather than to make four
    // sprites stand further apart than the court has room for.
    //
    // So: zoom to fit the bodies, ease toward them, and never past the point
    // where the floor runs out.
    const xs = w.players.map(p => screenX(p.x, p.z));
    // The rim being attacked is part of the shot. Framing the bodies alone
    // punched in far enough that the basket left the screen, which is a
    // basketball game you cannot aim: you could see four players beautifully
    // and not the thing all four of them were running at. So the hoop joins
    // the group the camera has to keep in view.
    if (w.possession !== null) {
        const target = HOOPS[attackHoop(w.players[w.possession].team)];
        xs.push(screenX(target.x, target.z));
    }
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const span = Math.max(right - left, FOLLOW_MIN_SPAN) + FOLLOW_MARGIN * 2;

    let zoom = zoomRung(clamp(VW / span, 1, FOLLOW_MAX_ZOOM), w.cam.zoom);
    // The existing fast-break pull-back wins over the follow: a break should
    // read as open floor, which is the one moment the empty court is the point.
    let breaking = false;
    if (w.possession !== null) {
        const p = w.players[w.possession];
        if (speedMag(p) > BASE_SPEED * 1.2 && openness(w, p) > 55) { zoom = 0.93; breaking = true; }
    }

    // Focus between the middle of the bodies and the ball, so attention still
    // leads toward the play rather than sitting on the group's centroid.
    const ballX = screenX(w.ball.x, w.ball.z);
    const mid = (left + right) / 2;
    let fx = breaking
        ? CAM_PIVOT_X + (ballX - CAM_PIVOT_X) * 0.22
        : mid + (ballX - mid) * 0.35;

    let fy = CAM_PIVOT_Y;

    // The dunk punch rides on top of the follow framing rather than replacing
    // it. It used to return an absolute zoom of 1.0-1.24, which was a punch in
    // when the camera sat at 1.0 and — once the camera started following the
    // play at about 1.5 — a pull *back* at the exact moment the game most
    // wants to lean in. Layered as a multiplier, a slam reads as a slam at any
    // framing the follow-cam happens to be holding.
    const dunker = w.players.find(p => p.dunkT > 0);
    if (dunker) {
        const t = clamp(dunker.dunkT / dunker.dunkDur, 0, 1);
        const h = HOOPS[dunker.dunkHoop];
        const punch = t < 0.62 ? t / 0.62 : Math.max(0, 1 - (t - 0.62) / 0.38);
        // One rung closer, not a continuous multiplier. Dunks are 70% of all
        // scoring in this game, so a punch that scaled smoothly would have the
        // screen resampling through every intermediate zoom on most baskets —
        // the exact shimmer the rung ladder exists to stop.
        if (punch > 0.35) {
            const at = FOLLOW_STEPS.indexOf(zoom);
            zoom = FOLLOW_STEPS[Math.min(FOLLOW_STEPS.length - 1, (at < 0 ? 0 : at) + 1)];
        }
        fx += (screenX(h.x, h.z) - fx) * (0.55 * punch);
        fy += (screenY(h.z, h.h * 0.5) - fy) * (0.4 * punch);
    }

    // Never show past the edge of the world: at zoom z about the pivot the
    // visible strip is fx ± VW/(2z), so keep that inside [0, VW].
    const half = VW / (2 * zoom);
    if (half < VW / 2) fx = clamp(fx, half, VW - half);
    else fx = CAM_PIVOT_X;

    return { zoom, fx, fy };
};

/* ------------------------------------------------------------------ */
/* World construction                                                  */
/* ------------------------------------------------------------------ */

const mkPlayer = (
    id: number, team: 0 | 1, human: boolean, name: string, kit: Kit, x: number, z: number,
    profile: HoopsProfile,
): Player => ({
    id, team, human, name, kit, profile,
    x, z, vx: 0, vz: 0,
    facing: team === 0 ? 1 : -1,
    stride: 0, y: 0, vy: 0,
    turbo: 1, charge: -1, streak: 0, onFire: false, fireT: 0, touchT: 0,
    cool: 0, dunkT: 0, dunkDur: 0, dunkFrom: { x, z }, dunkHoop: 0, dunkSlammed: false,
    dunkKind: 'normal', aiTimer: 0, stumbleT: 0, alleyCall: 0, swapCool: 0,
    passChargeT: -1, cutT: 0,
});

const mkBall = (): Ball => ({
    x: CENTER_X, z: 0.5, y: 10,
    vx: 0, vz: 0, vy: 0,
    mode: 'held', spin: 0,
    t: 0, dur: 1, sx: 0, sz: 0, sy: 0, tx: 0, tz: 0, ty: 0, arc: 0,
    kind: 'pass', made: false, pts: 2, shooter: 0, target: 0,
    looseT: 0, pickCool: 0, brick: false,
    lob: false, camper: null, rebound: false, missTeam: 0,
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

export const createWorld = (seed: number, opponent: string, foe: HoopsProfile = profileFor(undefined, 0.5)): World => {
    const foeName = (opponent || 'HIM').toUpperCase().slice(0, 12);
    // The fourth body on the floor. He was a colour palette and a hard-coded
    // string — the same nobody in every matchup — while `partnerFor` sat there
    // deriving a real one from whoever you challenged and never being called.
    // Pure function of the foe, so the same challenge always brings the same
    // cousin and the pair can be learned rather than re-rolled at you.
    const cousin = partnerFor(foe);
    const w: World = {
        seed,
        rngState: seed | 0,
        opponent: foeName,
        t: 0,
        clock: GAME_SECONDS,
        score: [0, 0],
        players: [
            mkPlayer(0, 0, true, 'YOU', KITS.you, 150, 0.62, playerProfile()),
            mkPlayer(1, 0, false, 'BIG MIKE', KITS.mate, 120, 0.3, mateProfile()),
            // The name on the vest is the one the challenge came under, not the
            // one in the roster: the player knows him as whoever they just
            // agreed to play.
            mkPlayer(2, 1, false, foeName, KITS.foe, 205, 0.4, foe),
            mkPlayer(3, 1, false, cousin.name.toUpperCase(), KITS.cousin, 235, 0.75, cousin),
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
        shatter: [0, 0],
        parts: [],
        popups: [],
        lastScorer: 1,
        winner: null,
        hitstop: 0,
        cam: { zoom: 1, fx: CAM_PIVOT_X, fy: CAM_PIVOT_Y },
        buzzerLive: false,
        endHoldT: 0,
        endReason: 'target',
        stats: {
            shots: 0, makes: 0, dunks: 0, steals: 0, blocks: 0,
            passes: 0, interceptions: 0, bulletPasses: 0, lobPasses: 0,
            bulletPicks: 0, lobPicks: 0,
            shoves: 0, shovesLanded: 0,
            alleyOops: 0, turboDunks: 0, fires: 0, bricks: 0,
            threes: 0, rebounds: 0, offRebounds: 0, tipIns: 0, goaltends: 0,
        },
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
    w.players[id].passChargeT = -1;
    // Two meters that outlive the possession they belong to.
    //
    // `charge` is only advanced inside the `hasBall` branch, so losing the ball
    // mid-gather froze it at whatever it had reached. `speedOf` halves you
    // while `charge >= 0`, so the victim ran at 34px/s instead of 76 with no
    // meter and no way to clear it — and the moment the ball came back,
    // `humanControl` saw `!cmd.a` against a live charge and fired a shot
    // nobody asked for. (`attemptShove` already cleared it; the asymmetry was
    // the tell.)
    //
    // `cool` is set to 1.1s on *any* defensive press, before the game knows
    // whether the steal landed. Land one and you caught the ball with both
    // buttons dead for 66 frames and nothing on screen saying why.
    w.players[id].charge = -1;
    w.players[id].cool = Math.min(w.players[id].cool, SHOT_COOL);
    w.ball.mode = 'held';
    w.ball.pickCool = 0.25;
    w.ball.brick = false;         // caught clean — whatever it was, it isn't one anymore
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
    // Default to "not a brick" — the one call site that wants it (a bad miss,
    // in stepBall) sets it back to true right after calling this.
    b.brick = false;
    // Default to "not a rebound" — only the two miss branches in stepBall set
    // this true right after calling looseBall, same pattern as brick above.
    // A ball loose from a block, a shove or a steal is not a rebound battle.
    b.rebound = false;
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
        p.stumbleT = 0; p.alleyCall = 0; p.passChargeT = -1; p.cutT = 0;
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
const baseFromDist = (d: number) => clamp(0.9 - Math.max(0, d - DUNK_RANGE_BASE) * 0.0034, 0.16, 0.9);

/** How badly the nearest defender is bothering this shot. Someone shoved onto
 * the ground a moment ago is not contesting anything. */
const contestFactor = (w: World, p: Player) => {
    let d = 999;
    let airborne = false;
    for (const o of w.players) {
        if (o.team === p.team || o.stumbleT > 0) continue;
        const dd = dist2d(p.x, p.z, o.x, o.z);
        if (dd < d) { d = dd; airborne = o.y > 8; }
    }
    if (d >= CONTEST_R) return 1;
    // Hand in the face takes almost half the shot away; a jumping contest more.
    const base = 0.46 + 0.54 * (d / CONTEST_R);
    return airborne ? base * 0.8 : base;
};

/** Release quality from the charge meter: 1 in the sweet spot, 0 at the edges. */
export const releaseQuality = (charge: number) =>
    clamp(1 - Math.abs(charge - SHOT_SWEET) / SHOT_WINDOW, 0, 1);

/**
 * A three is barely a decision on its own: `baseFromDist` is a single line
 * all the way out, so a deep shot is just "a longer two" with worse odds —
 * nothing about it is a genuinely different choice. This is the sharpening:
 * a look from behind the arc with real space (nobody within THREE_OPEN_R) is
 * meaningfully BETTER than the plain distance falloff says, because that
 * space is exactly what you traded the closer, safer two for — and a three
 * taken with a hand already in your face is meaningfully WORSE, because nothing
 * about being 20 feet out instead of 15 makes a bad, contested look a good
 * idea. Two-point shots are untouched; this only ever multiplies a shot that
 * is already beyond THREE_DIST.
 */
const threeModifier = (w: World, p: Player, d: number) => {
    if (d <= THREE_DIST) return 1;
    const open = openness(w, p);
    if (open >= THREE_OPEN_R) return 1.3;
    if (open < CONTEST_R) return 0.6;
    return 1;
};

const shotChance = (w: World, p: Player, q: number, skill: number) => {
    const h = HOOPS[attackHoop(p.team)];
    const d = hoopDist(p, h);
    // Release quality is the biggest lever the player actually controls.
    const rel = 0.5 + 0.75 * q;
    const fire = p.onFire ? 1.42 : 1;
    return clamp(
        baseFromDist(d) * contestFactor(w, p) * threeModifier(w, p, d) * rel * fire * skill,
        0.03, p.onFire ? 0.97 : 0.93,
    );
};

const launchShot = (w: World, p: Player, q: number, skill: number, heave = false) => {
    const b = w.ball;
    const h = HOOPS[attackHoop(p.team)];
    const d = hoopDist(p, h);
    const chance = heave ? 0.08 : shotChance(w, p, q, skill);
    const made = rng(w) < chance;
    // A brick is decided off the exact same number the miss just rolled
    // against: a heave is always one (it is a prayer by definition), and
    // anything else only qualifies if this was a genuinely bad look — a shot
    // that was merely unlucky does not turn into a joke on the rebound.
    const brick = !made && (heave || chance < BRICK_CHANCE);

    w.stats.shots++;
    p.charge = -1;
    p.cool = SHOT_COOL;
    p.facing = h.x > p.x ? 1 : -1;

    // A defender already in the air inside the block radius can eat it. NOT a
    // certainty: an automatic block made nearly every contested possession end
    // in a swat, which is spectacular twice and then just annoying. A defender
    // currently on the ground from a shove obviously cannot jump to block it.
    for (const o of activeOpponentsOf(w, p)) {
        if (o.y > 10 && dist2d(o.x, o.z, p.x, p.z) < BLOCK_R && rng(w) < 0.55) {
            w.stats.blocks++;
            shout(w, 'REJECTED!', PAL.bad, 1.1);
            say(w, pick(w, SAY.block));
            w.shake = Math.max(w.shake, 5);
            w.hitstop = Math.max(w.hitstop, 0.07);
            sfx('block');
            looseBall(w, p.x + o.facing * 10, p.z, 24, o.facing * 70 + (rng(w) - 0.5) * 20, -40, (rng(w) - 0.5) * 0.4);
            return;
        }
    }

    b.mode = 'flight';
    b.kind = heave ? 'heave' : 'shot';
    b.shooter = p.id;
    b.made = made;
    b.brick = brick;
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

/**
 * A pass leads the receiver rather than throwing at where they stood when it
 * left your hands — a real "pass that matters" has to account for both
 * players moving. It also means a pass thrown well ahead of a teammate who
 * then stops, or a lazy pass across the whole court while a defender sits in
 * the lane, is genuinely more interceptable: see the pick check in
 * `stepBall`, which samples the ball's actual interpolated position, not the
 * receiver's.
 *
 * Two kinds, chosen by how long PASS was held (see `humanControl`) or by
 * which situation the AI is reading (an explicit `{ lob: true }` for a
 * deliberate alley-oop feed, nothing for the everyday bullet):
 *
 *  - A **bullet** (`lob` false) is fast and flat. It has to get over a
 *    standing defender or it is not a pass at all — see the long note this
 *    replaced below on why the arc sits at BULLET_ARC and not lower. It is
 *    genuinely interceptable by a body already in the passing lane, which is
 *    exactly the risk a tap-pass is supposed to carry.
 *  - A **lob** (`lob` true) is slower and arcs high enough that it sails
 *    clean over anyone standing in between — the trade is that it is
 *    telegraphed (see the wind-up pip in `drawPlayer`), so a defender who
 *    reads it and gets under the landing spot early enough can still take it
 *    away. See the two-phase "camp" check in `stepBall`. It is also the only
 *    pass kind that finishes as an alley-oop if it lands on a man already up
 *    over the rim — a bullet arriving on a jumping teammate is just a catch.
 *
 * This was one pass for everything, at a fixed dur/arc regardless of which
 * you meant to throw — see the interception-rate history in `stepBall`'s
 * pick check for why that flattened the whole passing game and how the
 * numbers were actually measured.
 */
const launchPass = (w: World, from: Player, to: Player, opts: { lob?: boolean } = {}) => {
    const b = w.ball;
    const lob = !!opts.lob;
    const d = dist2d(from.x, from.z, to.x, to.z);
    // A bullet is fast — this is not a patient sport. A lob deliberately
    // hangs longer over the same distance: that extra time in the air is the
    // whole reason it is readable, and why holding for one over a short gap
    // (where the receiver is basically already open) barely costs anything,
    // while holding one over a long gap gives the defence real time to close.
    const dur = lob ? 0.34 + d / 300 : 0.2 + d / 420;
    // Lead by where the receiver will be when the ball actually arrives.
    const leadX = clamp(to.x + to.vx * dur, COURT_L, COURT_R);
    const leadZ = clamp(to.z + to.vz * dur, Z_MIN, Z_MAX);
    b.mode = 'flight';
    b.kind = 'pass';
    b.lob = lob;
    b.camper = null;
    b.shooter = from.id;
    b.target = to.id;
    b.made = false;
    b.t = 0;
    b.dur = dur;
    b.sx = from.x; b.sz = from.z; b.sy = 18 + from.y;
    b.tx = leadX; b.tz = leadZ; b.ty = 18;
    // A bullet has to get over a standing defender, or it is not a pass.
    //
    // This was 7, which puts the ball's mid-flight peak at y≈25 against an
    // interception ceiling of y<26 — so every pass flew flat, a single pixel
    // under the bar, for its entire flight, and anyone standing anywhere near
    // the line picked it off. Measured: 13 of 15 passes intercepted, 87%, and a
    // bot that never passed beat a bot that did 100% to 3%. Passing is the
    // whole reason this game grew a third button; it has to be the safe
    // default, the way it is in Jam.
    //
    // At 16 the ball peaks around y≈34 and clears the ceiling through the
    // middle of its flight, so it can only be picked near the release and near
    // the catch. A long pass is still the risky one — `dur` scales with
    // distance, so it spends longer hanging over the receiver with defenders
    // converging, which is exactly the lazy cross-court ball that should be
    // punished. A lob goes much higher still (LOB_ARC) — high enough that the
    // in-lane pick below never applies to it at all; its risk is the entirely
    // separate "camp the landing spot" check.
    b.arc = lob ? LOB_ARC : BULLET_ARC;
    from.facing = to.x > from.x ? 1 : -1;
    from.cool = 0.2;
    // Give-and-go: you just gave the ball up — cut to the rim looking for it
    // right back instead of standing around spacing up like any other
    // off-ball moment. Not for a lob: that throw is already the deliberate
    // alley-oop feed, and the passer there is not the one who should cut.
    if (!lob) from.cutT = 0.9;
    w.possession = null;
    w.stats.passes++;
    if (lob) w.stats.lobPasses++; else w.stats.bulletPasses++;
    sfx(lob ? 'lob' : 'pass');
};

const startDunk = (w: World, p: Player, opts: { kind?: 'normal' | 'turbo' | 'alley' | 'tip' } = {}) => {
    const hi = attackHoop(p.team);
    // Non-zero: dunkT > 0 IS the "I am dunking" flag, and the frame loop hands
    // the body over to stepDunk on that test. Starting it at exactly 0 would
    // leave the dunk un-run and re-triggerable every frame.
    p.dunkT = 0.0001;
    // An alley-oop or a tip-in both start from wherever the player already is
    // (airborne, near the rim) so the finish is quick; a drive gets the full
    // wind-up. A tip is the quickest of all — it is a ball already at the rim
    // being redirected, not a body travelling to meet one.
    p.dunkDur = opts.kind === 'tip' ? 0.28 : opts.kind === 'alley' ? 0.38 : opts.kind === 'turbo' ? 0.8 : 0.72;
    p.dunkFrom = { x: p.x, z: p.z };
    p.dunkHoop = hi;
    p.dunkSlammed = false;
    p.dunkKind = opts.kind ?? 'normal';
    p.charge = -1;
    p.alleyCall = 0;
    p.facing = HOOPS[hi].x > p.x ? 1 : -1;
    w.stats.shots++;
};

/**
 * The signature move: TURBO+PASS on defence. No timing minigame, no chance to
 * whiff into nothing — hold turbo, get close, press PASS, and the ball
 * carrier goes down and the ball comes loose. The real cost is committed
 * turbo and a defender who is briefly a non-participant if it's read (nothing
 * stops the shover from being shoved right back once they're this close).
 */
const attemptShove = (w: World, defender: Player, handler: Player) => {
    w.stats.shoves++;
    defender.turbo = clamp(defender.turbo - 0.3, 0, 1);
    // Landing it is the common case — that is what makes it the signature
    // move — but it is not free: a handler already airborne (mid-shot, or
    // already leaping to save one) is too committed to knock down cleanly.
    if (handler.y > 6 || rng(w) < 0.08) {
        say(w, 'He shoves at air. That is somehow worse.');
        return;
    }
    w.stats.shovesLanded++;
    handler.stumbleT = STUMBLE_TIME;
    handler.charge = -1;
    handler.passChargeT = -1;
    const dir = handler.x >= defender.x ? 1 : -1;
    handler.vx = dir * 130;
    handler.vz = (rng(w) - 0.5) * 0.6;
    shout(w, 'KNOCKED DOWN!', PAL.bad, 1);
    say(w, pick(w, SAY.shove));
    w.shake = Math.max(w.shake, 7);
    w.hitstop = Math.max(w.hitstop, 0.05);
    sfx('shove');
    looseBall(w, handler.x, handler.z, 12, dir * 60 + (rng(w) - 0.5) * 30, -30, (rng(w) - 0.5) * 0.5);
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
const score = (w: World, scorer: Player, pts: number, dunkKind: 'none' | 'normal' | 'turbo' | 'alley' | 'tip' = 'none') => {
    // 'tip' is its own thing: a put-back finished straight out of a rebound
    // jump, not a drive to the rim — it gets the announcer beat and the
    // hitstop of a real highlight, but it is not a "dunk" for the box score
    // or for the backboard-shatter/turbo-dunk counters below.
    const viaDunk = dunkKind === 'normal' || dunkKind === 'turbo' || dunkKind === 'alley';
    const viaTip = dunkKind === 'tip';
    w.score[scorer.team] += pts;
    w.lastScorer = scorer.team;
    w.stats.makes++;
    if (pts === 3) w.stats.threes++;
    w.rimFlash[attackHoop(scorer.team)] = 0.55;
    sfx(dunkKind === 'alley' ? 'alley' : viaTip ? 'tipin' : viaDunk ? 'dunk' : pts === 3 ? 'three' : 'swish');

    // Points, popping off the scorer rather than only up in the corner —
    // a bucket should read at the basket, where you were looking.
    w.popups.push({
        x: scorer.x, z: scorer.z, y: 30 + scorer.y,
        text: `+${pts}`, color: viaDunk ? PAL.legend : pts === 3 ? PAL.accent : PAL.ok,
        life: 0.9, max: 0.9,
    });

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

    const ignited = !scorer.onFire && scorer.streak >= FIRE_STREAK;
    if (ignited) {
        scorer.onFire = true;
        scorer.fireT = FIRE_SECONDS;
        w.stats.fires++;
        shout(w, `${scorer.name} IS ON FIRE!`, PAL.warn, 2);
        say(w, pick(w, SAY.fire));
        w.shake = Math.max(w.shake, 8);
        w.hitstop = Math.max(w.hitstop, 0.08);
        sfx('fire');
        // The ignition gets its own burst on top of the flame trail that
        // starts ticking once `onFire` is true — a whoosh, not a fade-in.
        for (let i = 0; i < 12; i++) {
            w.parts.push({
                x: scorer.x, z: scorer.z, y: 8 + rng(w) * 16,
                vx: (rng(w) - 0.5) * 90, vy: 40 + rng(w) * 70,
                life: 0.55, max: 0.55, kind: 'fire',
            });
        }
    } else if (dunkKind === 'alley') {
        // Banner and ticker are two different jobs — the banner is the punch,
        // the ticker is the commentary on it. These three used to draw both
        // from the same pool, which meant two jokes fired at once for one
        // basket and, whenever `pick` happened to land twice on the same
        // entry, the identical sentence appeared in two sizes on one screen.
        // Everywhere else in this function already does it the right way
        // ('THREE!' over the top, a different line underneath); these are now
        // consistent with it.
        shout(w, BANNER.alley, PAL.legend, 1.6);
        say(w, pick(w, SAY.alley));
    } else if (viaTip) {
        shout(w, BANNER.putback, PAL.ok, 1.2);
        say(w, pick(w, SAY.putback));
    } else if (viaDunk) {
        shout(w, BANNER.dunk, PAL.legend, 1.5);
        say(w, pick(w, SAY.dunk));
    } else if (scorer.streak === 2) {
        // "Heating up" is the tension cue — it beats the plain three-point
        // call for the one shot where they'd otherwise collide, so it never
        // goes unsaid just because the second make of a run was from deep.
        shout(w, pts === 3 ? 'HEATING UP FROM DEEP' : 'HEATING UP', PAL.warn, 1.1);
        say(w, pick(w, SAY.heat));
    } else if (pts === 3) {
        shout(w, 'THREE!', PAL.accent, 1.1);
        say(w, pick(w, SAY.three));
    } else {
        say(w, pick(w, SAY.make));
    }

    w.stats.dunks += viaDunk ? 1 : 0;
    if (dunkKind === 'turbo') w.stats.turboDunks++;
    if (dunkKind === 'alley') w.stats.alleyOops++;
    if (viaTip) w.stats.tipIns++;

    // Hitstop on a made dunk, scaled to how big a deal it is — a plain slam
    // barely registers, a fire dunk is the biggest freeze in the game (see
    // the backboard-shatter block just below, which stacks its own on top).
    // A tip-in is a hustle play, not a highlight — a much smaller punch.
    if (viaDunk) {
        w.hitstop = Math.max(w.hitstop, dunkKind === 'alley' ? 0.09 : dunkKind === 'turbo' ? 0.08 : 0.06);
    } else if (viaTip) {
        w.hitstop = Math.max(w.hitstop, 0.05);
    }

    // Backboard shatter: earned, not cheap — only a dunk landed by a player
    // who is already (or just now) on fire cracks the glass.
    if (viaDunk && scorer.onFire) {
        const hi = attackHoop(scorer.team);
        w.shatter[hi] = 1.1;
        w.shake = Math.max(w.shake, 11);
        w.hitstop = Math.max(w.hitstop, 0.14);
        for (let i = 0; i < 14; i++) {
            w.parts.push({
                x: HOOPS[hi].x, z: HOOPS[hi].z, y: HOOPS[hi].h - 6,
                vx: (rng(w) - 0.5) * 150, vy: -rng(w) * 100,
                life: 0.6, max: 0.6, kind: 'spark',
            });
        }
    }

    w.phase = 'score';
    w.phaseT = (viaDunk || viaTip) ? 1.15 : 0.95;
    w.possession = null;
    w.ball.mode = 'loose';
    w.ball.brick = false;
    const h = HOOPS[attackHoop(scorer.team)];
    w.ball.x = h.x; w.ball.z = h.z; w.ball.y = h.h - 6;
    w.ball.vx = h.inward * 12; w.ball.vy = -10; w.ball.vz = 0;

    // Whether this bucket also ends the game (target reached, or the clock
    // already ran out under it) is decided once the score-phase celebration
    // above has had its moment — see the 'score' phase branch in stepWorld.
    // That is what gives the winning bucket its held beat instead of the
    // "make" banner being clobbered by "YOU WIN!" on the very same frame.
};

const endGame = (w: World, reason: EndReason = 'target') => {
    w.phase = 'over';
    w.phaseT = 0;
    w.endReason = reason;
    w.winner = w.score[0] > w.score[1] ? 0 : 1;
    const youWin = w.winner === 0;
    sfx('whistle');

    if (reason === 'buzzer-make') {
        // The screenshot moment: hold on it hard.
        shout(w, 'BUZZER BEATER!!', PAL.legend, 99);
        w.hitstop = Math.max(w.hitstop, 0.1);
        w.shake = Math.max(w.shake, 6);
        sfx('buzzer');
        say(w, pick(w, SAY.buzzer));
        for (let i = 0; i < 10; i++) {
            w.parts.push({
                x: w.ball.x, z: w.ball.z, y: 10 + rng(w) * 20,
                vx: (rng(w) - 0.5) * 120, vy: 30 + rng(w) * 80,
                life: 0.7, max: 0.7, kind: 'spark',
            });
        }
        return;
    }

    shout(w, youWin ? 'YOU WIN!' : 'YOU LOSE', youWin ? PAL.ok : PAL.bad, 99);
    // A plain time-out gets its own line; a target-reached win already had
    // the winning bucket's own call a moment ago, and a missed buzzer-beater
    // already had the brick/miss line — either would just be talking over
    // itself.
    if (reason === 'time') say(w, pick(w, SAY.final));
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

/**
 * Movement has weight. `applyMove` used to assign velocity directly — a body
 * went from a dead stop to full speed, or full speed to a dead stop, in one
 * frame, and a player sprinting one way could reverse into the other
 * direction just as instantly. Nothing about that reads as a body; it reads
 * as a cursor. Real acceleration fixes three things at once:
 *
 *  - Starting to move ramps up rather than snapping to top speed.
 *  - Letting go of the stick coasts to a stop (`MOVE_FRICTION`) rather than
 *    braking dead — a beaten defender can still get run through for a beat.
 *  - Reversing direction costs something for free: the ramp has to cross
 *    zero on the way to the new target, so a hard cut the other way is
 *    measurably slower to complete than starting from a stand-still. That is
 *    the whole mechanism that makes a hard cut able to beat a defender who
 *    committed the wrong way — nothing else has to model it separately.
 *
 * TURBO does not just raise the speed ceiling — `MOVE_ACCEL_TURBO` raises the
 * accel too, so it reads as a burst off the mark and not merely "everything
 * is faster now". It is deliberately a bigger multiplier than `TURBO_MULT`
 * (2.4 against 1.52): matching them would mean turbo reached its higher top
 * speed in the same time walking reached its lower one, which is a number
 * going up rather than an explosion off the mark.
 *
 * The friction number is the one that decides whether any of this is felt at
 * all. At 780 px/s^2 a walking stop slid 3px — a fifth of a body width, on a
 * 284px court. Technically momentum, invisible in play. At 300 a walking stop
 * slides about two-thirds of a body and a turbo stop slides a body and a
 * half, which is enough that you plan the stop instead of discovering it.
 *
 * Slower stopping is a cost, and the turbo burst is what pays for it: with
 * the skid lengthened and turbo left alone, the harness bot drops from 48%
 * to 35% and the game gets worse. With both, it holds 48% quiet / 42% busy
 * / 18% clumsy — better than the snappier build on two of the three — and
 * dunks per game go up, because a burst that actually bursts gets people to
 * the rim. The pair is the change; neither half is it on its own.
 */
const MOVE_ACCEL = 560;          // px/s^2 ramping toward the target velocity
const MOVE_ACCEL_TURBO = 2.4;    // turbo explodes off the line
const MOVE_FRICTION = 300;       // px/s^2 coasting to a stop once input lets go

const stepToward = (cur: number, target: number, maxDelta: number) =>
    cur < target ? Math.min(cur + maxDelta, target) : Math.max(cur - maxDelta, target);

const applyMove = (p: Player, dx: number, dz: number, speed: number, dt: number, turbo = false) => {
    // dz is in z-units; convert to the same scale as x so diagonal movement
    // isn't faster than straight movement, and so accel/friction — both
    // flat px/s^2 numbers — apply evenly in both directions.
    const len = Math.hypot(dx, dz * Z_PX);
    let tvx = 0, tvzScaled = 0;
    if (len > 0.001) {
        const nx = dx / len;
        const nzScaled = (dz * Z_PX) / len;
        tvx = nx * speed;
        tvzScaled = nzScaled * speed;
        if (Math.abs(nx) > 0.25) p.facing = nx > 0 ? 1 : -1;
    }
    // No input (or already on target) coasts down under friction instead of
    // ramping toward zero at the accel rate — letting go should feel like
    // letting go, not like braking as hard as you were just sprinting.
    const rate = (len > 0.001 ? MOVE_ACCEL * (turbo ? MOVE_ACCEL_TURBO : 1) : MOVE_FRICTION) * dt;
    const vzScaled = p.vz * Z_PX;
    p.vx = stepToward(p.vx, tvx, rate);
    p.vz = stepToward(vzScaled, tvzScaled, rate) / Z_PX;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    // Stride tracks the body's actual speed now, not the speed it is merely
    // headed toward — a player still ramping up visibly still looks like it.
    const speedNow = Math.hypot(p.vx, p.vz * Z_PX);
    p.stride += (speedNow * dt) / 11;
};

const clampToCourt = (p: Player) => {
    // Clamping the position without the velocity leaves you standing on the
    // wall still holding the speed you arrived with, and peeling off has to
    // spend the whole reversal ramp bleeding it off first: 9 frames (150ms) of
    // completely dead input walking, 13 (217ms) off a turbo run. Both rims sit
    // against these bounds, so that was the entire scoring area.
    const cx = clamp(p.x, COURT_L, COURT_R);
    const cz = clamp(p.z, Z_MIN, Z_MAX);
    if (cx !== p.x) p.vx = 0;
    if (cz !== p.z) p.vz = 0;
    p.x = cx;
    p.z = cz;
};

/**
 * A defender who has actually cut off the driving lane — not merely
 * "somewhere nearby", but sitting between the ball handler and the rim they
 * want — slows the drive down. `contestFactor` already punishes the shot at
 * the *end* of a drive; without this, standing in the lane on the way there
 * did nothing at all, which is exactly the gap that makes defence feel like
 * a thing you do while waiting for the ball back rather than a way to win.
 * Only ever applies to the ball handler — everyone else's speed is
 * untouched — and only to defenders standing between them and their own
 * hoop, not a body trailing the play from behind.
 */
const LANE_BLOCK_FLOOR = 0.82;
const LANE_BLOCK_R = 22;

export const laneBlockFactor = (w: World, p: Player, turbo: boolean): number => {
    if (w.possession !== p.id) return 1;
    // Sprinting powers through. This is the whole reason the button exists:
    // without an escape the slow-down is not defensive pressure, it is a trap.
    if (turbo) return 1;
    const hoop = HOOPS[attackHoop(p.team)];
    let worst = 1;
    for (const o of w.players) {
        if (o.team === p.team || o.stumbleT > 0) continue;
        const d = dist2d(p.x, p.z, o.x, o.z);
        if (d >= LANE_BLOCK_R) continue;
        const towardHoop = (hoop.x - p.x) * (o.x - p.x) > 0;
        if (!towardHoop) continue;
        worst = Math.min(worst, LANE_BLOCK_FLOOR + (1 - LANE_BLOCK_FLOOR) * (d / LANE_BLOCK_R));
    }
    return worst;
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
        const range = dunkRangeFor(p);

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
            // Alley-oop: a teammate already in the air near the rim is a free
            // dunk. Check it every frame, ahead of the normal decision cadence
            // below — the jump only hangs for a fraction of a second, and
            // waiting for the next 0.18s tick would miss it more often than not.
            if (mate.y > 6 && mate.dunkT === 0 && hoopDist(mate, hoop) < ALLEY_HOOP_R) {
                // Always a lob — this is the deliberate alley-oop feed, and
                // only a lob finishes as one (see the arrival check in
                // stepBall). A bullet thrown at a jumping man is just a catch.
                launchPass(w, p, mate, { lob: true });
            } else if (d < range && open > 10) {
                startDunk(w, p, { kind: isPoweringIn(p) ? 'turbo' : 'normal' });
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
        const guard = opponentsOf(w, p).sort(
            (a, c) => dist2d(a.x, a.z, p.x, p.z) - dist2d(c.x, c.z, p.x, p.z),
        )[0];
        if (p.cutT > 0) {
            // Give-and-go: you just gave the ball up (see the cutT note on
            // launchPass) — cut hard to the rim looking for the return pass
            // instead of spacing up like any other off-ball moment. A
            // teammate who only ever floats to a spot is not really playing
            // with you; one who cuts after every pass is worth guarding.
            tx = hoop.x + hoop.inward * 22;
            tz = handler.z > 0.5 ? 0.3 : 0.7;
            turbo = p.turbo > 0.35;
        } else {
            // Spot up on the opposite depth lane, a comfortable jumper away
            // from the rim, and slide away from whoever is guarding you.
            const side = handler.z > 0.5 ? 0.24 : 0.76;
            tz = side;
            tx = hoop.x + hoop.inward * (58 + Math.sin(w.t * 0.7 + p.id) * 26);
            if (dist2d(guard.x, guard.z, p.x, p.z) < 22) tx += (p.x - guard.x) * 1.4;

            turbo = p.turbo > 0.4 && dist2d(p.x, p.z, tx, tz) > 70;
        }

        // Alley-oop cut: slip backdoor and go up for the lob when the rim is
        // close, nobody's tight on you, and the handler still has time to see
        // it. This is what makes the mechanic show up without a human ever
        // asking for it — the AI teammate (and the opposing pair) sets these
        // up on their own.
        const guardClose = dist2d(guard.x, guard.z, p.x, p.z) < 14;
        if (
            p.y === 0 && p.aiTimer <= 0 && !guardClose && handler.cool <= 0
            && hoopDist(p, hoop) < ALLEY_HOOP_R && rng(w) < 0.05
        ) {
            p.vy = JUMP_V;
            p.alleyCall = ALLEY_CALL_TIME;
            p.aiTimer = 1.2;
        }
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
            } else if (
                dd < SHOVE_R && p.turbo > 0.35 && p.cool <= 0 && p.aiTimer <= 0
                && handler.y <= 2 && rng(w) < 0.012 * gamble
            ) {
                // The shove. Rarer than a steal gamble — it burns real turbo —
                // but real: the CPU commits to it, not just the player.
                p.aiTimer = 0.9;
                p.cool = 0.9;
                turbo = true;
                attemptShove(w, p, handler);
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
                    sfx('steal');
                } else {
                    say(w, 'That was NOT a foul.');
                }
            }
        } else {
            // Off the ball: normally deny the other man, shading toward the
            // rim. But if your own partner has actually been beaten off the
            // dribble — not just "not the closest", genuinely lost the
            // handler — staying glued to a man who is not the one hurting
            // you is a way to lose cleanly. Rotate over to help contain the
            // drive instead; a teammate who denies the pass but never covers
            // for a beaten partner is a defence in name only.
            const mark = opponentsOf(w, p).find(o => o.id !== handler.id)!;
            // Genuinely beaten, not just "not glued to him": real separation,
            // AND the handler is actually somewhere the separation matters —
            // a defender thirty feet from the ball near midcourt is not a
            // crisis, and treating it as one had the second man abandoning
            // his own mark constantly, which just traded one open man for
            // another instead of actually shoring up the defence.
            const beaten = dist2d(mate.x, mate.z, handler.x, handler.z) > 40 && hoopDist(handler, ownHoop) < 140;
            if (beaten) {
                tx = ownHoop.x + ownHoop.inward * 24;
                tz = handler.z;
                turbo = p.turbo > 0.3 && dist2d(p.x, p.z, tx, tz) > 30;
            } else {
                tx = mark.x + (ownHoop.x > mark.x ? 14 : -14);
                tz = mark.z + (mark.z > 0.5 ? -0.08 : 0.08);
                turbo = p.turbo > 0.5 && dist2d(p.x, p.z, tx, tz) > 60;
            }
        }
    } else {
        /* --- loose ball: everybody crashes ------------------------------ */
        tx = b.x;
        tz = b.z;
        if (b.mode === 'flight' && b.kind === 'shot') {
            // Rebound: go where the miss is going, not where the ball is now.
            tx = b.tx + (rng(w) - 0.5) * 4;
            tz = b.tz;
        } else if (b.mode === 'flight' && b.kind === 'pass' && p.id === b.target) {
            // Meet the pass. The rebound case already knew to run to where the
            // ball is going; a pass fell through to chasing where the ball
            // currently *is*, so the intended receiver trailed it the whole way
            // and arrived after it did. Any defender converging on the landing
            // spot got there first, which is why a third of all completed
            // passes were being picked at the catch.
            tx = b.tx;
            tz = b.tz;
            turbo = true;
        }
        turbo = turbo || p.turbo > 0.15;

        // Goaltending: a shot already in flight, well into its back half and
        // closing on the rim, is legal to swat — see the check in stepBall.
        // Without this, no defender ever gets there in time to try: the AI
        // otherwise only jumps to contest a shot before it leaves the hand.
        // Gated on already being right on top of the ball's actual current
        // spot (the same radius the resolution check itself uses), not just
        // "somewhere near the rim" — a defender who has not actually beaten
        // the shot back to the hoop should not get a free swing at it just
        // because the rim is nearby.
        if (
            b.mode === 'flight' && b.kind === 'shot' && p.team !== w.players[b.shooter].team
            && p.y === 0 && p.aiTimer <= 0 && b.t > GOALTEND_MIN_T - 0.08
            && dist2d(p.x, p.z, b.x, b.z) < BLOCK_R + 4 && rng(w) < 0.05
        ) {
            p.vy = JUMP_V;
            p.aiTimer = 0.4;
        }

        // Crash the boards: a real rebound (not a block/steal/shove) coming
        // down nearby is worth jumping for, not just walking under — height
        // is what wins the contest in the pickup weighting in stepBall.
        if (
            b.rebound && b.mode === 'loose' && p.y === 0 && p.aiTimer <= 0
            && dist2d(p.x, p.z, b.x, b.z) < 24 && b.y > 8 && b.y < 60
        ) {
            const willing = p.team === b.missTeam ? 0.16 : 0.1;   // offence crashes harder
            if (rng(w) < willing) { p.vy = JUMP_V; p.aiTimer = 0.4; }
        }
    }

    const atTarget = Math.hypot(tx - p.x, (tz - p.z) * Z_PX) <= 3;
    const speed = speedOf(p, turbo) * laneBlockFactor(w, p, turbo);
    applyMove(p, atTarget ? 0 : tx - p.x, atTarget ? 0 : tz - p.z, speed, dt, turbo);

    // Turbo costs the CPU exactly what it costs you.
    //
    // This used to drain here and then regenerate again, unconditionally, in
    // the movement pass — `if (!p.human) p.turbo += TURBO_REGEN * 0.7 * dt`,
    // with no check for whether the player had just spent any. A sprinting
    // defender therefore paid 0.34/s and got 0.154/s straight back, a net
    // 0.186, while you paid the full 0.34 with your regen locked out behind an
    // `else`. In seconds of sustained sprint from a full bar: you 2.9, him
    // 5.4.
    //
    // That is the whole "he steals it from me every time" complaint. He did
    // not need to gamble or read you. He simply stayed in your pocket at top
    // speed for almost twice as long as you could run, and the steal check
    // fires every 1.2s from inside 14px. Your only escape — outrun him —
    // expired first, every single possession.
    if (turbo && !p.onFire) p.turbo = clamp(p.turbo - TURBO_DRAIN * dt, 0, 1);
    else if (!p.onFire) p.turbo = clamp(p.turbo + TURBO_REGEN * AI_TURBO_REGEN * dt, 0, 1);
};

/* ------------------------------------------------------------------ */
/* Human control                                                       */
/* ------------------------------------------------------------------ */

/**
 * The NBA Jam layout: three buttons, and the last two swap meaning with the
 * ball.
 *
 *              WITH BALL          WITHOUT BALL, OFFENCE   WITHOUT BALL, DEFENCE
 *   SHOOT (a)  shoot / dunk       cut to the rim, call     jump: block / swat
 *   PASS  (b)  pass to teammate   swap control              steal attempt
 *   TURBO (c)  held: sprint, extends dunk range and is free while on fire
 *
 * Plus the two combinations: TURBO+PASS on defence is the shove (the
 * signature move — see `attemptShove`), and TURBO+SHOOT with the ball just
 * means the dunk you get from `dunkRangeFor` is the big, sprinting one.
 */
const humanControl = (w: World, p: Player, cmd: Cmd, dt: number) => {
    const hasBall = w.possession === p.id;
    const teamHasBall = w.possession !== null && w.players[w.possession].team === p.team;
    const mate = teammateOf(w, p);

    const wantTurbo = cmd.c && (p.onFire || p.turbo > 0);
    if (wantTurbo && !p.onFire) p.turbo = clamp(p.turbo - TURBO_DRAIN * dt, 0, 1);
    else p.turbo = clamp(p.turbo + TURBO_REGEN * dt, 0, 1);

    const dx = (cmd.right ? 1 : 0) - (cmd.left ? 1 : 0);
    const dz = (cmd.down ? 1 : 0) - (cmd.up ? 1 : 0);
    // `applyMove` wants dz in z-units and multiplies by Z_PX internally to put
    // it on the same scale as x. Passing `dz * 0.35` put the depth term into
    // the hypot as 0.35 x 70 = 24.5 against a sideways term of 1, so a
    // diagonal came out at vx=3.10 against vz*70=75.94 — an 88-degree "
    // diagonal" that crossed the court in 91.6s instead of 5.3s, and an nx of
    // 0.041 that never cleared the 0.25 gate that flips `facing`. The CPU at
    // :1789 always passed raw z-units and was unaffected, so the opponent
    // could move diagonally and the player could not.
    applyMove(p, dx, dz / Z_PX, speedOf(p, wantTurbo) * laneBlockFactor(w, p, wantTurbo), dt, wantTurbo);

    if (p.dunkT > 0) return;   // the dunk animation owns the body

    if (hasBall) {
        const hoop = HOOPS[attackHoop(p.team)];
        const d = hoopDist(p, hoop);
        if (cmd.aPress && p.cool <= 0) {
            // Dunk range is live and speed-driven (see dunkRangeFor): walk it
            // in and you need to be underneath the rim, sprint in on TURBO and
            // the same button slams it from well outside that.
            if (d < dunkRangeFor(p)) startDunk(w, p, { kind: isPoweringIn(p) ? 'turbo' : 'normal' });
            else p.charge = 0;                     // start the release meter
        }
        if (p.charge >= 0) {
            p.charge += dt / SHOT_CHARGE_TIME;
            // Held too long: it leaves your hand anyway and it is ugly.
            if (p.charge > SHOT_COOK || !cmd.a) {
                launchShot(w, p, releaseQuality(Math.min(p.charge, SHOT_COOK)), 1);
            }
        }
        // PASS always passes — no openness gate. A lazy one across the whole
        // court is exactly the pass that gets read and picked off; a sharp
        // one to a teammate who broke open is how you actually use this.
        //
        // Tap it and it is gone the instant you let go: a bullet. Hold it
        // and — once PASS_HOLD_TIME has passed — it becomes a lob instead,
        // released on the eventual let-go (or on PASS_MAX_HOLD, so a stuck
        // button cannot hold the ball forever). Mirrors the shot-charge meter
        // just above it: `cmd.b` read as a level, not the edge, is what lets
        // this tell a tap from a hold at all.
        if (cmd.bPress && p.cool <= 0 && p.passChargeT < 0) p.passChargeT = 0;
        if (p.passChargeT >= 0) {
            p.passChargeT += dt;
            if (!cmd.b || p.passChargeT > PASS_MAX_HOLD) {
                launchPass(w, p, mate, { lob: p.passChargeT >= PASS_HOLD_TIME });
                p.passChargeT = -1;
            }
        }
    } else if (teamHasBall) {
        const hoop = HOOPS[attackHoop(p.team)];
        const nearHoop = hoopDist(p, hoop) < ALLEY_HOOP_R;
        if (cmd.aPress) {
            if (nearHoop && p.y === 0) {
                // Cut, right now, under the rim: jump and call for the lob.
                // The teammate AI/human holding the ball recognises an
                // airborne man this close to the hoop and can hit the alley.
                p.vy = JUMP_V;
                p.alleyCall = ALLEY_CALL_TIME;
            } else if (mate.cool <= 0 && w.possession === mate.id) {
                // Too far out for a lob: just call for the rock, grounded.
                launchPass(w, mate, p);
            }
        }
        // PASS without the ball, on offence, swaps which of your two guys you
        // are driving — straight out of the arcade original.
        if (cmd.bPress && p.swapCool <= 0 && mate.swapCool <= 0) {
            p.human = false;
            mate.human = true;
            p.swapCool = SWAP_COOL;
            mate.swapCool = SWAP_COOL;
        }
    } else {
        // Defence: SHOOT jumps (block / contest), PASS steals. Hold TURBO and
        // PASS becomes the shove instead — the read is "am I close enough and
        // willing to burn turbo", same as it is for the CPU.
        if (cmd.aPress && p.y === 0) p.vy = JUMP_V;
        if (cmd.bPress && p.cool <= 0 && w.possession !== null) {
            const handler = w.players[w.possession];
            p.cool = 1.1;
            const dd = dist2d(p.x, p.z, handler.x, handler.z);
            if (wantTurbo && dd < SHOVE_R) {
                attemptShove(w, p, handler);
            } else if (dd < STEAL_R + 3 && w.ball.pickCool <= 0) {
                // Reaching from behind the handler is the high-percentage steal.
                const behind = (handler.facing === 1 && p.x > handler.x) || (handler.facing === -1 && p.x < handler.x);
                if (rng(w) < (behind ? 0.26 : 0.14)) {
                    w.stats.steals++;
                    giveBall(w, p.id);
                    shout(w, 'STRIP!', PAL.accent, 0.9);
                    say(w, pick(w, SAY.steal));
                    sfx('steal');
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

        // A bullet can be jumped — but only once it has left the
        // neighbourhood. Checking from t=0 meant the passer's own defender,
        // who is standing 8px away by definition, intercepted every pass out
        // of pressure. A lazy cross-court pass spends a lot longer in this
        // window than a sharp one, which is exactly the punishment the brief
        // asked for. None of this applies to a lob — it flies high enough to
        // clear a defender standing anywhere in between; see the camp check
        // just below instead.
        if (b.kind === 'pass' && !b.lob && b.t > 0.4) {
            const from = w.players[b.shooter];
            const to = w.players[b.target];
            for (const o of w.players) {
                if (o.team === from.team || o.stumbleT > 0) continue;
                // You have to actually be in front of him, not just marking
                // him. Without this test, a defender standing beside the
                // receiver took the ball at the moment it arrived — so any
                // covered team-mate was an automatic turnover and passing cost
                // you the game: measured at 40-46% of all passes picked off,
                // against a bot that never passed winning 100% of its games.
                const defenderToBall = dist2d(o.x, o.z, b.x, b.z);
                if (defenderToBall >= dist2d(to.x, to.z, b.x, b.z)) continue;
                if (b.y < 26 && defenderToBall < 5.5) {
                    w.stats.interceptions++;
                    w.stats.bulletPicks++;
                    shout(w, 'PICKED OFF!', PAL.accent2, 0.9);
                    say(w, pick(w, SAY.intercept));
                    sfx('intercept');
                    giveBall(w, o.id);
                    return;
                }
            }
        }

        // A lob is telegraphed (see the wind-up pip in drawPlayer) and sails
        // clean over anyone it passes above, so it is never picked mid-air
        // the way a bullet is. Its risk is entirely about the landing spot:
        // a defender who reads the wind-up and gets there EARLY — sampled
        // here, mid-flight, well before the ball itself arrives — has jumped
        // the route. Whether that read actually pays off is settled once,
        // at the catch, below; this just records who qualified.
        if (b.kind === 'pass' && b.lob && b.camper === null && b.t > 0.3 && b.t < 0.75) {
            const from = w.players[b.shooter];
            for (const o of w.players) {
                if (o.team === from.team || o.stumbleT > 0) continue;
                if (dist2d(o.x, o.z, b.tx, b.tz) < LOB_CAMP_R) { b.camper = o.id; break; }
            }
        }

        // Goaltending: legal here, the way it is in Jam — a shot already in
        // flight, on its way down toward the rim, can be swatted clean out of
        // the air. This is deliberately separate from the pre-release block
        // in `launchShot` (a defender already up as the ball leaves the
        // shooter's hand): this one is for a defender who recovers, gets back
        // under the rim, and rejects it late. Gated to the back half of the
        // flight and close to the hoop so it reads as a save at the rim, not
        // a swat from half the court away.
        if (b.kind === 'shot' && t > GOALTEND_MIN_T) {
            const shooterP = w.players[b.shooter];
            const h = HOOPS[attackHoop(shooterP.team)];
            if (dist2d(b.x, b.z, h.x, h.z) < GOALTEND_R) {
                for (const o of w.players) {
                    if (o.team === shooterP.team || o.stumbleT > 0) continue;
                    if (o.y > 10 && dist2d(o.x, o.z, b.x, b.z) < BLOCK_R && rng(w) < 0.5) {
                        w.stats.goaltends++;
                        w.stats.blocks++;
                        shout(w, 'GOALTENDING!', PAL.bad, 1.1);
                        say(w, pick(w, SAY.goaltend));
                        w.shake = Math.max(w.shake, 6);
                        w.hitstop = Math.max(w.hitstop, 0.08);
                        sfx('block');
                        looseBall(
                            w, b.x + o.facing * 8, b.z, h.h - 4,
                            o.facing * 75 + (rng(w) - 0.5) * 20, -45, (rng(w) - 0.5) * 0.4,
                        );
                        return;
                    }
                }
            }
        }

        if (b.t >= 1) {
            if (b.kind === 'pass') {
                const to = w.players[b.target];
                // A lob's landing-spot risk resolves right here: if someone
                // camped it (see the mid-flight check above) and is still
                // there at the catch, the read pays off more often than not —
                // but getting under the spot early is no guarantee, since the
                // offence can still see it coming too and crowd back in.
                if (b.lob && b.camper !== null) {
                    const camper = w.players[b.camper];
                    if (
                        camper.stumbleT <= 0
                        && dist2d(camper.x, camper.z, b.tx, b.tz) < LOB_CAMP_R * 1.4
                        && rng(w) < 0.65
                    ) {
                        w.stats.interceptions++;
                        w.stats.lobPicks++;
                        shout(w, 'READ THE LOB!', PAL.accent2, 0.9);
                        say(w, pick(w, SAY.intercept));
                        sfx('intercept');
                        giveBall(w, camper.id);
                        return;
                    }
                }
                // Alley-oop: a LOB arrives while the receiver is already in
                // the air near their own rim — instead of catching it, they
                // finish it. Gated to a lob and not a bullet: this is the
                // mechanic you call for on purpose by holding the button, not
                // something that just happens to land on a jumping teammate.
                const hoop = HOOPS[attackHoop(to.team)];
                giveBall(w, to.id);
                if (b.lob && to.y > 6 && to.dunkT === 0 && hoopDist(to, hoop) < ALLEY_HOOP_R) {
                    startDunk(w, to, { kind: 'alley' });
                }
            } else if (b.made) {
                score(w, w.players[b.shooter], b.pts, 'none');
            } else if (b.brick) {
                // Not a metaphor. A shot this bad does not get a live rebound
                // — it becomes an actual brick, clangs, and drops dead. See
                // `drawBall` for the swap and the no-bounce physics below.
                say(w, pick(w, SAY.brick));
                w.rimFlash[attackHoop(w.players[b.shooter].team)] = 0.35;
                w.stats.bricks++;
                w.shake = Math.max(w.shake, 6);
                w.hitstop = Math.max(w.hitstop, 0.07);
                sfx('brick');
                looseBall(w, b.x, b.z, b.y, 0, -30, 0);
                w.ball.brick = true;
                // A rebound battle, same as the clean miss below — see the
                // pickup logic further down for the jump contest and tip-ins.
                w.ball.rebound = true;
                w.ball.missTeam = w.players[b.shooter].team;
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
                w.ball.rebound = true;
                w.ball.missTeam = w.players[b.shooter].team;
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
        if (b.brick) {
            // A brick does not bounce. That is the entire joke: it thuds and
            // sits there. A puff of dust on the one frame it actually lands,
            // then dead stop.
            if (b.vy !== 0 || Math.abs(b.vx) > 0.5 || Math.abs(b.vz) > 0.01) {
                for (let i = 0; i < 5; i++) {
                    w.parts.push({
                        x: b.x, z: b.z, y: 2, vx: (rng(w) - 0.5) * 30, vy: 10 + rng(w) * 18,
                        life: 0.35, max: 0.35, kind: 'dust',
                    });
                }
            }
            b.vy = 0; b.vx = 0; b.vz = 0;
        } else {
            b.vy = -b.vy * 0.55;          // bounce; dies out after a few hops
            b.vx *= 0.84;
            b.vz *= 0.7;
            if (Math.abs(b.vy) < 22) { b.vy = 0; b.vx *= 0.9; }
        }
    }
    // The fence is in play. Everything is in play.
    if (b.x < COURT_L - 6) { b.x = COURT_L - 6; b.vx = Math.abs(b.vx) * 0.7; }
    if (b.x > COURT_R + 6) { b.x = COURT_R + 6; b.vx = -Math.abs(b.vx) * 0.7; }
    if (b.z < Z_MIN) { b.z = Z_MIN; b.vz = Math.abs(b.vz) * 0.6; }
    if (b.z > Z_MAX) { b.z = Z_MAX; b.vz = -Math.abs(b.vz) * 0.6; }

    if (w.phase !== 'score' && b.pickCool <= 0) {
        // Pickup: everybody in reach is a candidate — a real scramble, not a
        // strict nearest-wins. Jumping helps, and a shoved player on the deck
        // is out of it. Two bodies both in reach is resolved as a weighted
        // coin flip rather than a deterministic tie so a contested loose ball
        // is actually winnable by either side, not just whichever array index
        // happens to be first.
        //
        // A genuine rebound (see `Ball.rebound`) gets an extra factor on top
        // of plain proximity: how high you got matters, not just how close
        // you were standing — this is the actual "contested jump" the board
        // is fought over. Anything else that goes loose (a block, a shove, a
        // steal) stays the plain distance scramble it always was.
        const candidates: { p: Player; w: number }[] = [];
        for (const p of w.players) {
            if (p.dunkT > 0 || p.stumbleT > 0) continue;
            const d = dist2d(p.x, p.z, b.x, b.z);
            const reach = 12 + (p.y > 4 ? 22 : 16);
            if (d < 13 && b.y < reach + p.y) {
                const jump = b.rebound ? 1 + clamp(p.y / 26, 0, 1) * 1.5 : 1;
                candidates.push({ p, w: jump / (d + 1.5) });
            }
        }
        let best: Player | null = null;
        if (candidates.length === 1) {
            best = candidates[0].p;
        } else if (candidates.length > 1) {
            const total = candidates.reduce((n, c) => n + c.w, 0);
            let roll = rng(w) * total;
            for (const c of candidates) { roll -= c.w; if (roll <= 0) { best = c.p; break; } }
            best ??= candidates[candidates.length - 1].p;
        }
        if (best) {
            const wasRebound = b.rebound;
            if (wasRebound) {
                w.stats.rebounds++;
                if (best.team === b.missTeam) w.stats.offRebounds++;
            }
            giveBall(w, best.id);
            // Tip-in: an offensive board claimed IN THE AIR, near the rim,
            // finishes immediately instead of making the player land first —
            // the board and the put-back are the same motion, not two. Only
            // the team that missed gets this; a defensive rebounder up near
            // the wrong hoop is just boxing out, not finishing anything.
            const hoop = HOOPS[attackHoop(best.team)];
            if (wasRebound && best.team === b.missTeam && best.y > 8 && hoopDist(best, hoop) < ALLEY_HOOP_R) {
                sfx('tipin');
                startDunk(w, best, { kind: 'tip' });
            } else if (b.looseT > 0.4) {
                say(w, `${best.name} comes up with it.`);
                if (wasRebound) sfx('rebound');
            }
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
        // otherwise the arcade rule applies and a dunk always goes in. Someone
        // currently on the ground from a shove cannot contest anything.
        const denier = activeOpponentsOf(w, p).find(o => o.y > 12 && dist2d(o.x, o.z, p.x, p.z) < 16);
        if (denier && rng(w) < 0.55) {
            w.stats.blocks++;
            shout(w, 'DENIED!', PAL.bad, 1.2);
            say(w, pick(w, SAY.block));
            w.shake = Math.max(w.shake, 6);
            w.hitstop = Math.max(w.hitstop, 0.07);
            sfx('block');
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
            score(w, p, 2, p.dunkKind);
        }
    }
    if (t >= 1) { p.dunkT = 0; p.y = 0; }
};

/* ------------------------------------------------------------------ */
/* The step                                                            */
/* ------------------------------------------------------------------ */

/**
 * The decay every frame owes the cosmetic state — shake, banners, the
 * commentator ticker, rim flash, backboard shatter, and the particle/popup
 * budgets. Pulled out on its own because hitstop needs to run it too: the
 * whole point of a freeze-frame is that the world stops but the flourish
 * that triggered it (sparks, dust, the flash) keeps animating, or the freeze
 * just reads as a pause screen instead of an impact.
 */
const stepCosmetics = (w: World, dt: number) => {
    w.shake = Math.max(0, w.shake - dt * 26);
    w.bannerT = Math.max(0, w.bannerT - dt);
    w.sayT = Math.max(0, w.sayT - dt);
    w.rimFlash[0] = Math.max(0, w.rimFlash[0] - dt);
    w.rimFlash[1] = Math.max(0, w.rimFlash[1] - dt);
    w.shatter[0] = Math.max(0, w.shatter[0] - dt);
    w.shatter[1] = Math.max(0, w.shatter[1] - dt);

    for (let i = w.parts.length - 1; i >= 0; i--) {
        const q = w.parts[i];
        q.life -= dt;
        q.x += q.vx * dt;
        q.y -= q.vy * dt;
        q.vy -= 40 * dt;
        if (q.life <= 0) w.parts.splice(i, 1);
    }
    if (w.parts.length > 60) w.parts.splice(0, w.parts.length - 60);

    for (let i = w.popups.length - 1; i >= 0; i--) {
        const q = w.popups[i];
        q.life -= dt;
        q.y += 16 * dt;          // floats up
        if (q.life <= 0) w.popups.splice(i, 1);
    }
    if (w.popups.length > 10) w.popups.splice(0, w.popups.length - 10);
};

export const stepWorld = (w: World, dt: number, cmd: Cmd) => {
    if (w.phase === 'over') return;

    // Hitstop: a handful of frozen frames on a big hit — a monster dunk, a
    // swatted block, a landed shove, a brick clanging home — sells the
    // weight of the moment far better than shake alone. Nothing about the
    // world advances while it runs except this cosmetic decay, so it costs
    // nothing in the physics the balance tests depend on.
    if (w.hitstop > 0) {
        w.hitstop = Math.max(0, w.hitstop - dt);
        stepCosmetics(w, dt);
        return;
    }

    w.t += dt;
    stepCosmetics(w, dt);

    // Camera: eased toward wherever `cameraTarget` wants it this instant, so
    // a dunk punch-in or a fast-break pull-back arrives as a motion rather
    // than a cut. Pure render-side state — nothing below reads `w.cam`.
    const camT = cameraTarget(w);
    const camEase = clamp(dt * 8, 0, 1);
    // Zoom is assigned, never eased. Hysteresis already makes rung changes
    // rare, and easing between two rungs is precisely what put 94% of frames
    // on a fractional scale — the camera spent its life in between the only
    // two values that actually look right.
    //
    // A rung change is a cut, so the focus arrives with it rather than panning
    // in afterwards: at 2x the frame is only 176px wide, and a focus still
    // crawling toward its mark at the pan limit leaves the rim off-screen for
    // the handful of frames right after the change — which is exactly when a
    // player is looking for it.
    const rungChanged = w.cam.zoom !== camT.zoom;
    w.cam.zoom = camT.zoom;
    if (rungChanged) {
        w.cam.fx = camT.fx;
        w.cam.fy = camT.fy;
    } else {
    // Ease, then clamp the travel. Easing alone still moved the focus as much
    // as 60px in a single frame when possession flipped to the far end, which
    // reads as the court being yanked out from under you rather than as a
    // camera following the play.
        const maxPan = FOLLOW_MAX_PAN * dt;
        w.cam.fx += clamp((camT.fx - w.cam.fx) * camEase, -maxPan, maxPan);
        w.cam.fy += clamp((camT.fy - w.cam.fy) * camEase, -maxPan, maxPan);
    }

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
            // Whether this bucket also ends the game is decided here, once
            // its own celebration has had its full beat — not the instant it
            // went in. That is what gives the winning shot a held moment
            // instead of "YOU WIN!" clobbering "BOOMSHAKALAKA" on one frame.
            const gameOver = w.clock <= 0 || w.score[0] >= TARGET_SCORE || w.score[1] >= TARGET_SCORE;
            if (gameOver) {
                endGame(w, w.buzzerLive ? 'buzzer-make' : 'target');
            } else {
                inbound(w, (1 - w.lastScorer) as 0 | 1);
                w.phase = 'play';
            }
        }
        return;
    }

    /* --- live play ---------------------------------------------------- */
    w.clock -= dt;
    if (w.clock <= 0) {
        w.clock = 0;
        // Let a shot (or a dunk drive) that was already live finish instead
        // of the game ending mid-air — the classic "shot released before the
        // buzzer still counts" rule. Only the FIRST frame the clock hits zero
        // makes this call: once `buzzerLive` is set, every later frame falls
        // straight through and lets the endHoldT/'score'-phase machinery
        // below decide when the game actually ends, instead of re-triggering
        // this check and ending it the instant the shot stops being "live".
        if (!w.buzzerLive) {
            if (!shotIsLive(w)) { endGame(w, 'time'); return; }
            w.buzzerLive = true;
        }
    }

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

    // Final-seconds slow motion: a shot (or dunk) still live with the clock
    // inside BUZZER_WINDOW visibly slows down — the ball hangs, the reach
    // stretches out — without the game clock or cooldowns themselves
    // slowing, so nothing about pacing or termination changes, only how the
    // moment plays out on screen.
    const slowmo = w.clock <= BUZZER_WINDOW && shotIsLive(w);
    const simDt = slowmo ? dt * SLOWMO_FACTOR : dt;

    for (const p of w.players) {
        p.cool = Math.max(0, p.cool - dt);
        p.swapCool = Math.max(0, p.swapCool - dt);
        if (p.charge >= 0 && w.possession !== p.id) p.charge = -1;
        p.alleyCall = Math.max(0, p.alleyCall - dt);
        p.cutT = Math.max(0, p.cutT - dt);
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

        if (p.dunkT > 0) { stepDunk(w, p, simDt); clampToCourt(p); continue; }

        // Shoved: down and sliding, no input reaches this body until it ends.
        if (p.stumbleT > 0) {
            p.stumbleT = Math.max(0, p.stumbleT - dt);
            p.x += p.vx * simDt;
            p.z += p.vz * simDt;
            p.vx *= 0.86; p.vz *= 0.86;
            clampToCourt(p);
            continue;
        }

        if (p.human) humanControl(w, p, cmd, simDt);
        else aiThink(w, p, simDt);

        // A burst worth spending TURBO on should be readable on screen, not
        // just a faster number under the hood — a kicked-up dust puff at the
        // feet while genuinely sprinting (the same speed band `isPoweringIn`
        // already calls "powering in" for a dunk) reads as a burst without
        // needing a dedicated "turbo on" flag threaded down here.
        if (p.y === 0 && isPoweringIn(p) && rng(w) < 0.3) {
            w.parts.push({
                x: p.x - p.facing * 4, z: p.z, y: 1,
                vx: -p.facing * 26 + (rng(w) - 0.5) * 10, vy: 12 + rng(w) * 10,
                life: 0.25, max: 0.25, kind: 'dust',
            });
        }

        // Vertical: a single arcade jump arc, no air control, no double jump.
        if (p.y > 0 || p.vy !== 0) {
            p.vy -= GRAVITY * simDt;
            p.y += p.vy * simDt;
            if (p.y <= 0) { p.y = 0; p.vy = 0; }
        }
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

    stepBall(w, simDt);

    // A buzzer shot that resolved as a make routes through the 'score' phase
    // above (and gets its held beat there). One that resolved as a miss (or a
    // dunk that got denied) never enters that phase at all — it just goes
    // loose — so it gets a short grace of its own here: long enough for the
    // clang or the brick's dust puff to read before the final whistle.
    if (w.buzzerLive && w.phase === 'play' && w.endHoldT <= 0 && !shotIsLive(w)) {
        w.endHoldT = 0.5;
    }
    if (w.endHoldT > 0) {
        w.endHoldT -= dt;
        if (w.endHoldT <= 0) { endGame(w, 'buzzer-miss'); return; }
    }
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

    // Crowd behind the fence — no longer bobbing on a fixed sine regardless
    // of what just happened. `hype` is a cheap read of "something big just
    // occurred" off state the sim already tracks (shake magnitude covers
    // dunks, blocks and shoves alike, since all three set it) rather than a
    // dedicated crowd-energy field; `losing` quiets them down when nothing
    // is popping off and the human is getting beaten on the scoreboard.
    const hype = clamp(w.shake / 10, 0, 1);
    const fired = w.players.some(p => p.onFire);
    const losing = w.score[1] - w.score[0] >= 4;
    const energy = clamp((hype * 1.4 + (fired ? 0.35 : 0)) * (losing ? 0.4 : 1), 0, 1.5);
    for (let i = 0; i < 22; i++) {
        const x = 6 + i * 16 + hash(i) * 6;
        const jitter = hash(i + 50);
        const amp = 1.6 + energy * 5 * (0.4 + jitter);
        const speed = 2.4 + energy * 3;
        const bob = Math.sin(w.t * speed + i) * amp;
        // A surge rises (the crowd is on its feet); a quiet stretch sinks
        // and shrinks a touch, reading as a crowd that has sat back down.
        const y = 118 + hash(i + 3) * 3 + bob - energy * jitter * 3 + (losing && energy < 0.15 ? 1.5 : 0);
        const quiet = losing && energy < 0.15;
        const c = quiet ? '#0c1120' : i % 5 === 0 ? '#1c2740' : '#131b2c';
        rect(ctx, x - 4, y - 10, 8, quiet ? 9 : 11, c);
        circle(ctx, x, y - 12, 3.4, c);
        if (energy > 0.55 && i % 3 === 0) glyph(ctx, '🙌', x, y - 19, 6 + energy * 3, 0, clamp(energy, 0, 1));
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

    // Backboard shatter — earned by a fire dunk, not cheap. A jagged crack
    // across the glass plus a hot glow that fades over about a second.
    const sh = w.shatter[idx];
    if (sh > 0) {
        const bx = poleX + h.inward * 1.5;
        ctx.save();
        ctx.globalAlpha = clamp(sh, 0, 1);
        ctx.strokeStyle = '#fff8e6';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx - h.inward * 1, rimY - 22);
        ctx.lineTo(bx + h.inward * 1, rimY - 14);
        ctx.lineTo(bx - h.inward * 2, rimY - 9);
        ctx.moveTo(bx, rimY - 18);
        ctx.lineTo(bx + h.inward * 2.4, rimY - 6);
        ctx.stroke();
        ctx.restore();
        circle(ctx, bx, rimY - 14, 10 * sh + 2, `rgba(255,220,150,${0.3 * sh})`);
    }
};

const drawPlayer = (ctx: CanvasRenderingContext2D, w: World, p: Player) => {
    const x = screenX(p.x, p.z);
    const feet = floorY(p.z) - p.y * sc(p.z);
    const h = 32 * sc(p.z);
    const isShooting = p.charge >= 0 || p.dunkT > 0;
    const armUp = p.dunkT > 0 ? 1.35 : p.charge >= 0 ? clamp(p.charge, 0, 1) : p.y > 6 ? 1 : 0;
    const down = p.stumbleT > 0;

    // Dunk range, made visible: a ring under the ball handler's feet that
    // shows exactly how close they need to be right now — which grows as they
    // pick up speed. Watching your own outline stretch is how the range is
    // meant to be learned, not a number in a manual.
    if (w.possession === p.id && p.charge < 0 && p.dunkT === 0 && !down) {
        const hoop = HOOPS[attackHoop(p.team)];
        const inRange = hoopDist(p, hoop) < dunkRangeFor(p);
        const rr = (6 + dunkRangeFor(p) * 0.14) * sc(p.z);
        ctx.save();
        ctx.globalAlpha = inRange ? 0.5 : 0.22;
        ctx.strokeStyle = inRange ? PAL.legend : PAL.accent;
        ctx.lineWidth = inRange ? 1.4 : 1;
        ctx.beginPath();
        ctx.ellipse(x, floorY(p.z), rr, rr * 0.36, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Behind the arc, made visible: this is the one number a real
        // shot-selection decision hinges on (see `threeModifier`), so it
        // does not stay a hidden distance check — a plain "3" over your own
        // head the moment you cross the line, brighter once you're actually
        // open enough for it to be the good look rather than the bad one.
        if (hoopDist(p, hoop) > THREE_DIST) {
            const openLook = openness(w, p) >= THREE_OPEN_R;
            ctx.save();
            ctx.globalAlpha = openLook ? 1 : 0.55;
            text(ctx, '3', x, floorY(p.z) - h - 30, {
                size: 7, color: openLook ? PAL.ok : PAL.accent2, align: 'center', bold: true,
            });
            ctx.restore();
        }
    }

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
        height: down ? h * 0.55 : h,
        facing: p.facing,
        // Walk cycle is driven by position, as before — stride picks the frame.
        stride: p.stride,
        swap: p.kit.swap,
        kit: p.kit,
        armUp,
        crouch: down || (p.charge > 0.15 && p.charge < 0.6),
        hurt: down && p.stumbleT > STUMBLE_TIME * 0.6,
        // The heat haze / jump shadow above already handles the ground contact.
        shadow: p.y <= 2,
        rotation: down ? p.facing * 1.15 : 0,
    });

    // Streak pips: the tension the "heating up" line only announces once —
    // this is what lets you watch a run build toward FIRE_STREAK in real
    // time, for whoever is on it, teammate or opponent.
    if (p.streak > 0 && !p.onFire) {
        const pw = 5;
        const baseX = x - (FIRE_STREAK * pw) / 2;
        const baseY = feet - h - 20;
        for (let i = 0; i < FIRE_STREAK; i++) {
            rect(ctx, baseX + i * pw, baseY, pw - 1, 3, i < p.streak ? PAL.warn : 'rgba(255,255,255,0.15)');
        }
    }
    if (p.onFire) glyph(ctx, '🔥', x - p.facing * 7, feet - h - 4, 9 + Math.sin(w.t * 14) * 1.5);
    // Alley-oop cue: this man is up, near the rim, ready to catch a lob.
    if (p.alleyCall > 0 || (p.y > 6 && hoopDist(p, HOOPS[attackHoop(p.team)]) < ALLEY_HOOP_R)) {
        glyph(ctx, '🙌', x, feet - h - 12, 10 + Math.sin(w.t * 16) * 1.5);
    }
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

    // Pass wind-up tell: the whole reason a lob is a fair trade for a bullet
    // is that it is telegraphed — this pip is that tell. It fills at the same
    // rate PASS is being held and flips colour the instant it crosses
    // PASS_HOLD_TIME, which is exactly the moment the defence should start
    // reacting to a lob instead of a bullet.
    if (p.passChargeT >= 0) {
        const willLob = p.passChargeT >= PASS_HOLD_TIME;
        const mx = x - 9;
        const my = feet - h - 15;
        bar(
            ctx, mx, my, 18, 2.5,
            Math.min(1, p.passChargeT / PASS_HOLD_TIME),
            willLob ? PAL.legend : PAL.accent2, PAL.panel,
        );
    }
};

const drawBall = (ctx: CanvasRenderingContext2D, w: World) => {
    const b = w.ball;
    const x = screenX(b.x, b.z);
    const y = screenY(b.z, b.y);

    // A pass in flight gets a fading streak back to where it left the hand —
    // it's the one ball state that's easy to lose in a scramble otherwise.
    if (b.mode === 'flight' && b.kind === 'pass') {
        const sx = screenX(b.sx, b.sz);
        const sy = screenY(b.sz, b.sy);
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = PAL.accent;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        line(ctx, sx, sy, x, y, PAL.accent, 1);
        ctx.restore();
    }

    // A shot hanging in the final seconds gets a comet of faint echoes
    // behind it — the one visual that makes "everything just slowed down"
    // read on the ball itself, not just on how fast the legs are moving.
    if (b.mode === 'flight' && b.kind !== 'pass' && w.clock <= BUZZER_WINDOW) {
        for (const back of [0.06, 0.12, 0.18]) {
            const et = Math.max(0, b.t - back);
            const ex = b.sx + (b.tx - b.sx) * et;
            const ez = b.sz + (b.tz - b.sz) * et;
            const ey = b.sy + (b.ty - b.sy) * et + b.arc * 4 * et * (1 - et);
            glyph(ctx, '●', screenX(ex, ez), screenY(ez, ey), 4 * sc(ez), 0, 0.16);
        }
    }

    // A brick renders as exactly that, from the instant it clangs off the
    // rim (see the miss handling in stepBall) until somebody scoops it up.
    if (b.mode === 'loose' && b.brick) {
        shadow(ctx, x, floorY(b.z), 3.2, 1.3, 0.45);
        glyph(ctx, '🧱', x, y - 2, 9 * sc(b.z));
        return;
    }

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

/**
 * The post-game stat line — the box score `World.stats` was tracking the
 * whole time, condensed into one sentence for the result card. Only mentions
 * a stat that actually happened, so a quiet game gets a quiet line instead
 * of a wall of zeroes.
 */
const statLine = (w: World): string => {
    const s = w.stats;
    const pct = s.shots > 0 ? Math.round((s.makes / s.shots) * 100) : 0;
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const bits = [
        `${s.makes}-for-${s.shots} shooting (${pct}%)`,
        s.threes > 0 ? `${plural(s.threes, 'three')}` : null,
        s.dunks > 0 ? `${plural(s.dunks, 'dunk')}${s.turboDunks > 0 ? ` (${s.turboDunks} turbo)` : ''}` : null,
        s.alleyOops > 0 ? `${plural(s.alleyOops, 'alley-oop')}` : null,
        s.tipIns > 0 ? `${plural(s.tipIns, 'tip-in')}` : null,
        s.rebounds > 0 ? `${plural(s.rebounds, 'rebound')}${s.offRebounds > 0 ? ` (${s.offRebounds} offensive)` : ''}` : null,
        s.bricks > 0 ? `${plural(s.bricks, 'brick')}` : null,
        s.steals > 0 ? `${plural(s.steals, 'steal')}` : null,
        s.blocks > 0 ? `${plural(s.blocks, 'block')}${s.goaltends > 0 ? ` (${s.goaltends} goaltended)` : ''}` : null,
        s.shovesLanded > 0 ? `${plural(s.shovesLanded, 'shove')} landed` : null,
        s.fires > 0 ? `caught fire ${s.fires}x` : null,
    ].filter((b): b is string => b !== null);
    return bits.join(', ') + '.';
};

/**
 * `banner()` (the shared engine helper `shout()` feeds `w.bannerText` into)
 * draws one line at whatever size it is given and does not measure it
 * against the canvas — fine for a short shout like "THREE!", not for the
 * longer `SAY` lines that also become banner text (a made dunk can pick
 * "He dunked it and then apologised. Sort of.", 44 characters, and at the
 * banner's normal size that is wider than the whole 352px canvas — centred
 * text that wide clips at both edges with neither its start nor its end on
 * screen). `banner()` lives in the shared engine and is not this file's to
 * change, so the fit happens on this side: measure in the exact font it
 * uses and shrink the size handed to it until the string actually fits.
 */
const fitBannerSize = (ctx: CanvasRenderingContext2D, str: string, want: number, maxW = VW - 20): number => {
    let size = want;
    ctx.save();
    ctx.font = `bold ${size}px 'Bungee', Impact, system-ui, sans-serif`;
    while (size > 8 && ctx.measureText(str).width > maxW) {
        size -= 1;
        ctx.font = `bold ${size}px 'Bungee', Impact, system-ui, sans-serif`;
    }
    ctx.restore();
    return size;
};

/**
 * Same problem for the small commentator ticker (`say()` / `w.say`): shrink
 * first, and only truncate with an ellipsis if it still will not fit even at
 * the smallest legible size — the SAY table has some genuinely long lines
 * mixed in with the short ones, and it will only grow.
 */
const fitTickerText = (ctx: CanvasRenderingContext2D, str: string, want: number, maxW = VW - 12): { text: string; size: number } => {
    const font = (s: number) => `${s}px 'IBM Plex Mono', ui-monospace, monospace`;
    ctx.save();
    let size = want;
    ctx.font = font(size);
    while (size > 5 && ctx.measureText(str).width > maxW) {
        size -= 0.5;
        ctx.font = font(size);
    }
    let out = str;
    if (ctx.measureText(out).width > maxW) {
        while (out.length > 1 && ctx.measureText(out + '…').width > maxW) out = out.slice(0, -1);
        out = out + '…';
    }
    ctx.restore();
    return { text: out, size };
};

export const drawWorld = (ctx: CanvasRenderingContext2D, w: World) => {
    // Cleared once at identity, before the camera transform below: zoomed out
    // on a fast break, the transformed scene is smaller than the physical
    // canvas, and without this the corners it no longer reaches would show
    // whatever the previous frame left there instead of empty court-void.
    clear(ctx, VW, VH, '#070b14');

    ctx.save();
    const [sx, sy] = shakeOffset(w.shake);
    ctx.translate(sx, sy);
    // Camera: punches in on a dunk, drifts toward the ball, pulls back on a
    // fast break (see `cameraTarget` / the easing in `stepWorld`). Mapping
    // `w.cam.fx/fy` onto the fixed pivot is what makes this "look at that
    // point, zoomed" rather than "zoom from the corner" — everything that
    // draws in world coordinates (screenX/screenY, hoop rim height, dunk
    // range) is completely unaware this transform exists.
    // Snap the camera onto whole pixels before drawing. A world point lands at
    // (x - fx) * zoom + pivot, so rounding `fx * zoom` is what puts the floor,
    // the fence and every sprite on the same pixel grid two frames running.
    // Without it the whole scene resampled onto a different sub-pixel offset
    // sixty times a second and shimmered, which no amount of movement tuning
    // underneath can make feel smooth.
    const camZ = w.cam.zoom;
    const snapX = Math.round(w.cam.fx * camZ) / camZ;
    const snapY = Math.round(w.cam.fy * camZ) / camZ;
    ctx.translate(CAM_PIVOT_X, CAM_PIVOT_Y);
    ctx.scale(camZ, camZ);
    ctx.translate(-snapX, -snapY);

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
        } else if (q.kind === 'dust') {
            rect(ctx, px, py, 2 * a + 1, 2 * a + 1, `rgba(170,150,130,${0.5 * a})`);
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

    // Point popups: "+2"/"+3" off the scorer, on top of everything else in
    // world space so it never disappears into the pile the way the HUD
    // score in the corner can.
    for (const q of w.popups) {
        const a = clamp(q.life / q.max, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        text(ctx, q.text, screenX(q.x, q.z), screenY(q.z, q.y), {
            size: 10, color: q.color, align: 'center', bold: true,
        });
        ctx.restore();
    }

    // Camera + shake end here: the HUD, banners and ticker below are fixed
    // screen furniture and must never swim with either of them.
    ctx.restore();

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
    // Whichever of your two guys you're currently driving — PASS-to-swap can
    // move this off player 0, so the HUD has to follow, not assume.
    // Running dry used to be a silent stat change you'd only notice once you
    // were already caught — a bar reading a number is not a warning. Below
    // GASSED_T it visibly flashes instead, the same beat the shot-clock digit
    // already uses when it turns urgent, so "you are about to be slow" is
    // something you see coming, not something you find out.
    const you = w.players.find(p => p.human) ?? w.players[0];
    const gassed = !you.onFire && you.turbo < 0.15;
    const turboColor = you.onFire ? PAL.warn : gassed ? PAL.bad : PAL.accent;
    const turboFlash = gassed && Math.sin(w.t * 14) > 0;
    bar(ctx, 6, VH - 10, 48, 4, you.onFire ? 1 : you.turbo, turboFlash ? PAL.bad : turboColor, PAL.panel);
    text(ctx, you.onFire ? 'ON FIRE' : gassed ? 'GASSED' : 'TURBO', 58, VH - 11, {
        size: 6, color: you.onFire ? PAL.warn : gassed ? PAL.bad : PAL.faint,
    });

    // Commentator ticker. Shrinks (or, failing that, truncates) so a long
    // SAY line never runs past the edges of a 352px canvas — see fitTickerText.
    if (w.sayT > 0) {
        const a = clamp(w.sayT / 0.6, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        rect(ctx, 0, VH - 24, VW, 11, 'rgba(4,6,10,0.78)');
        const fit = fitTickerText(ctx, `🎙 ${w.say}`, 7);
        text(ctx, fit.text, VW / 2, VH - 19, { size: fit.size, color: PAL.warn, align: 'center', baseline: 'middle' });
        ctx.restore();
    }

    if (w.bannerT > 0) {
        const pop = w.phase === 'over' ? 20 : 16 + Math.sin(w.t * 22) * 2;
        // Same fix, for the big centred banner — see fitBannerSize: a long
        // SAY line lands here too (any dunk/alley/ignition shout) and this
        // one is bold and much bigger, so it is the one that actually clips.
        drawBanner(ctx, w.bannerText, VW, 66, w.bannerColor, fitBannerSize(ctx, w.bannerText, pop));
    }
    // A buzzer-beater's big banner is the hype line, not the score — spell
    // out who actually won underneath it so the card still reads at a glance.
    if (w.phase === 'over' && w.endReason === 'buzzer-make') {
        text(ctx, w.winner === 0 ? 'YOU WIN' : 'YOU LOSE', VW / 2, 88, {
            size: 9, color: w.winner === 0 ? PAL.ok : PAL.bad, align: 'center', bold: true,
        });
    }
    if (w.phase === 'tip') {
        const pop = 14 + clamp((1.8 - w.phaseT) / 0.35, 0, 1) * 6;
        drawBanner(ctx, 'CHECK IT UP', VW, 42, PAL.accent, pop);
        text(ctx, 'YOU & BIG MIKE', VW / 2 - 5, 55, { size: 7, color: PAL.accent, align: 'right', bold: true });
        text(ctx, 'VS', VW / 2, 55, { size: 6, color: PAL.dim, align: 'center' });
        const cousin = w.players[3];
        text(ctx, `${w.opponent} & ${cousin.name}`, VW / 2 + 5, 55, { size: 7, color: PAL.accent2, align: 'left', bold: true });
        text(ctx, `First to ${TARGET_SCORE} — shoes on the line`, VW / 2, 67, {
            size: 7, color: PAL.dim, align: 'center',
        });
        // The cousin's own line, which is written off the foe he came with —
        // `style` has been authored for exactly this moment since the roster
        // shipped and has never been shown to anybody. Fitted like the ticker,
        // because a long foe name pushes it past 352px.
        const tipFit = fitTickerText(ctx, `${cousin.name}: ${cousin.profile.style}`, 6);
        text(ctx, tipFit.text, VW / 2, 78, { size: tipFit.size, color: PAL.faint, align: 'center' });
    }

    // Hitstop punch: a bright single-frame flash right as the freeze lands —
    // cheap, sells the weight of the hit, and belongs on top of absolutely
    // everything, HUD included.
    if (w.hitstop > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(w.hitstop / 0.14, 0, 1) * 0.5;
        rect(ctx, 0, 0, VW, VH, '#ffffff');
        ctx.restore();
    }
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const HoopsGame: React.FC<{
    opponent?: string;
    onFinish: (won: boolean, note: string) => void;
    /** 0..1 rating from `systems/opponents.ts`. Drives the opponent's profile. */
    skill?: number;
    /** Which named NPC this is, so their attribute profile can be looked up. */
    opponentNpcId?: string;
    onQuit: () => void;
}> = ({ opponent = 'Guy In Jeans', skill, opponentNpcId, onFinish, onQuit }) => {
    const [done, setDone] = useState<null | boolean>(null);
    const { input, set, consume } = useInput(done === null);

    // The whole simulation lives here. React never sees it.
    const worldRef = useRef<World | null>(null);
    if (!worldRef.current) {
        // Tests call `createWorld` directly with a fixed seed, so the shipped
        // component needs no escape hatch for them — a `window.__HOOPS_SEED__`
        // hook lived here and was removed.
        worldRef.current = createWorld((Date.now() ^ 0x9e3779b9) | 0, opponent, profileFor(opponentNpcId, skill ?? 0.5));
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
                a: s.a, b: s.b, c: s.c,
                aPress: consume('a'), bPress: consume('b'), cPress: consume('c'),
            });
        }
        drawWorld(ctx, w);

        const clock = Math.ceil(w.clock);
        const fire = (w.players.find(p => p.human) ?? w.players[0]).onFire;
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
    const buzzer = w.endReason === 'buzzer-make' || w.endReason === 'buzzer-miss';

    return (
        <ArcadeShell
            title="Hoops — 2 on 2"
            subtitle={`You & Big Mike vs ${opponent} & his cousin`}
            width={VW}
            height={VH}
            running={done === null}
            onFrame={onFrame}
            onInput={set}
            actions={['SHOOT', 'PASS', 'TURBO']}
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
                        headline={
                            (buzzer ? 'Buzzer Beater — ' : '')
                            + (done ? `You Win ${hud.you}-${hud.them}` : `You Lose ${hud.you}-${hud.them}`)
                        }
                        detail={
                            (done
                                ? `${dunks > 0 ? 'The rim needs a doctor. ' : ''}${opponent} says the court was uneven and that he plays overseas.`
                                : `${opponent} hits one more after the whistle, just to be sure everybody saw it.`)
                            + ` ${statLine(w)}`
                        }
                        onClose={finish}
                        closeLabel={done ? 'Collect' : 'Walk Off'}
                    />
                )
            }
            help={
                '◀ ▶ run the court, ▲ ▼ slide in and out. With the ball: SHOOT charges a jumper (release in the green — behind the arc, a "3" over your head, and it only pays off if you\'re actually open) or dunks if you\'re in range — hold TURBO while you drive and that range stretches way out. Tap PASS for a fast, flat bullet; hold it a beat for a lob that clears anyone standing in the way — and it\'s the only throw that finishes an alley-oop. Without the ball on offence: SHOOT cuts to the rim and calls for a lob — catch it in the air near the hoop for an alley-oop — PASS swaps which guy you\'re running. On defence: SHOOT jumps to block, goaltend a shot on its way down, or crash the boards for a rebound — grab an offensive one in the air near the rim and it tips straight back in — PASS pokes for a steal, and TURBO+PASS up close is the shove — no fouls, ball comes loose. Three straight buckets and you\'re ON FIRE until they score, and a fire dunk cracks the backboard.'
            }
        />
    );
};

export default HoopsGame;
