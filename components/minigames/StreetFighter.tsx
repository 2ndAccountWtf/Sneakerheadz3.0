import React, { useCallback, useMemo, useRef, useState } from 'react';
import { MiniGameResult } from './MiniGameShell';
import { ArcadeShell, useInput, PAL, KIT, clear, rect, outline, circle, line, text, glyph, shadow, bar, actor, SWAP, band, shakeOffset, banner } from './engine';
import type { Btn } from './engine';
import { useGame } from '../../hooks/useGame';
import { armsFor, FISTS } from '../../systems/weapons';
import type { Weapon } from '../../systems/weapons';

/**
 * Street Fighter — the 2D brawler that resolves every `combat` outcome.
 *
 * The joke is the stakes: this is a full frame-data fighting game, hitboxes and
 * cancel windows and all, and the thing being fought over is a shoelace or half
 * a sandwich. So the systems are played straight and the words are not.
 *
 * Everything below the component is a PURE simulation: `createFight` plus
 * `stepFight` never touch React, the DOM or `Math.random` directly (the RNG is
 * injected). That is deliberate — it means the fight can be run headless a few
 * thousand frames in a test script to prove the invariants hold, which is the
 * only way to trust a fighter you cannot unit-test by feel.
 */

// ---------------------------------------------------------------------------
// Stage constants
// ---------------------------------------------------------------------------

/** Logical resolution. Everything is drawn in these coordinates. */
export const W = 320;
export const H = 180;

const GROUND = 152;        // y of the fighters' feet when grounded
const STAGE_L = 18;        // walls: fighters can be cornered, which matters
const STAGE_R = 302;
const GRAV = 620;          // px/s^2 — tuned so a jump lasts ~0.7s
const JUMP_V = -218;
const FIG_H = 34;          // figure height in px
const BODY_W = 15;         // hurtbox width
const MIN_SEP = 15;        // bodies push each other apart at this distance
const FPS = 60;

/**
 * Closing the gap.
 *
 * Walking was the only approach and it was slower than the knockback of a jab,
 * which is how the fighters ended up living at a distance no move could reach.
 * WALK_FWD is the sustained approach; the dash is the burst, on a double-tap
 * forward — the only "motion" input a three-button phone D-pad can express.
 */
const WALK_FWD = 70;
const WALK_BACK = 48;
const DASH_V = 138;
const DASH_FRAMES = 11;
/** How long the first forward tap waits for its partner. */
const TAP_WINDOW = 13;

const ROUND_SECONDS = 60;
const ROUNDS_TO_WIN = 2;   // best of 3

// ---------------------------------------------------------------------------
// Frame data
// ---------------------------------------------------------------------------
/**
 * Every attack is three windows measured in frames at 60Hz:
 *
 *   startup  — animating, no hitbox. This is what makes a move punishable.
 *   active   — the hitbox exists. Overlap with a hurtbox = a hit.
 *   recovery — no hitbox, still locked. This is the whiff-punish window.
 *
 * Numbers are chosen so the light attack (jab: 4f startup) beats the heavy
 * (kick: 9f) up close, the heavy out-ranges it, and a whiffed heavy leaves 14
 * frames of recovery — long enough for the AI (and the player) to punish. That
 * relationship is the whole game; the damage numbers are almost incidental.
 */
export type Height = 'low' | 'mid' | 'overhead';
export type MoveId = 'jab' | 'heavy' | 'sweep' | 'air' | 'special' | 'toss';

export interface MoveDef {
    label: string;
    startup: number;
    active: number;
    recovery: number;
    damage: number;
    /** How far past the body the hitbox extends. */
    reach: number;
    height: Height;
    /** Horizontal knockback applied to the defender, px/s. */
    knock: number;
    /** Frames the defender is locked in hitstun (this is what allows combos). */
    hitstun: number;
    /** Frames BOTH fighters freeze on impact — the "hit-stop" that sells weight. */
    hitstop: number;
    shake: number;
    /** Fraction of damage that gets through a successful block. */
    chip: number;
    /** Frames of cancel window granted on hit. 0 means the move cannot combo. */
    cancel: number;
    knockdown?: boolean;
    launch?: number;
    /** Airborne-only. */
    air?: boolean;
    /** Hype cost. */
    meter?: number;
    /** Spawns a projectile at the end of startup instead of having a hitbox. */
    throws?: boolean;
}

const BASE_MOVES: Record<MoveId, MoveDef> = {
    // Fast, short, combos into itself and into everything else.
    jab: {
        label: 'Jab', startup: 4, active: 3, recovery: 6,
        damage: 6, reach: 25, height: 'mid',
        knock: 18, hitstun: 12, hitstop: 3, shake: 1, chip: 0.10, cancel: 13,
    },
    // Slow, long, hurts. Whiffing it is a decision you regret.
    heavy: {
        label: 'Kick', startup: 9, active: 4, recovery: 15,
        damage: 13, reach: 33, height: 'mid',
        knock: 70, hitstun: 19, hitstop: 6, shake: 4, chip: 0.09, cancel: 0,
    },
    // Low: goes UNDER a standing block. Knocks down, so it never combos.
    sweep: {
        label: 'Sweep', startup: 8, active: 4, recovery: 18,
        damage: 10, reach: 31, height: 'low',
        knock: 56, hitstun: 24, hitstop: 5, shake: 3, chip: 0.08, cancel: 0,
        knockdown: true,
    },
    // Overhead: goes OVER a crouch block. The answer to a turtle.
    air: {
        label: 'Air Stomp', startup: 4, active: 9, recovery: 6,
        damage: 9, reach: 22, height: 'overhead',
        knock: 40, hitstun: 16, hitstop: 4, shake: 2, chip: 0.12, cancel: 11, air: true,
    },
    // The special. Costs the whole hype meter, launches, gets a banner.
    special: {
        label: 'Shoelace Uppercut', startup: 5, active: 7, recovery: 22,
        damage: 24, reach: 28, height: 'mid',
        knock: 120, hitstun: 30, hitstop: 10, shake: 7, chip: 0.18, cancel: 0,
        knockdown: true, launch: -190, meter: 100,
    },
    // Windup for a thrown AM/PM weapon. No hitbox of its own.
    toss: {
        label: 'Throw', startup: 6, active: 1, recovery: 11,
        damage: 0, reach: 0, height: 'mid',
        knock: 0, hitstun: 0, hitstop: 0, shake: 0, chip: 0, cancel: 0, throws: true,
    },
};

/**
 * Fold an AM/PM weapon into the move table.
 *
 * A melee weapon replaces the heavy: the crowbar is slower and longer than a
 * kick, the baguette is faster and shorter. Recovery is derived from the
 * weapon's own `cooldown` so the registry stays the single source of truth —
 * a weapon that is described as slow actually IS slow here.
 */
export function movesFor(weapon: Weapon): Record<MoveId, MoveDef> {
    const m: Record<MoveId, MoveDef> = {
        jab: { ...BASE_MOVES.jab },
        heavy: { ...BASE_MOVES.heavy },
        sweep: { ...BASE_MOVES.sweep },
        air: { ...BASE_MOVES.air },
        special: { ...BASE_MOVES.special },
        toss: { ...BASE_MOVES.toss },
    };
    if (weapon.klass === 'melee' && weapon.id !== FISTS.id) {
        // Registry damage is balanced for a text prototype (26-38 on a 70hp
        // bar), so it is scaled down here rather than one-shotting the fight.
        const dmg = Math.max(10, Math.min(21, Math.round(weapon.damage * 0.45)));
        m.heavy = {
            ...m.heavy,
            label: weapon.short,
            damage: dmg,
            reach: 33 + (weapon.damage >= 34 ? 13 : 8),
            startup: weapon.damage >= 34 ? 11 : 8,
            recovery: Math.max(11, Math.round(weapon.cooldown * FPS * 0.55)),
            knock: 62 + dmg * 1.6,
            hitstop: 7,
            shake: 5,
        };
        // A long weapon also gives the sweep a little more range — you are
        // swinging a crowbar at ankle height, which is exactly as mean as it sounds.
        m.sweep = { ...m.sweep, reach: m.sweep.reach + 6, damage: m.sweep.damage + 2 };
    }
    return m;
}

// ---------------------------------------------------------------------------
// Fighter / world state
// ---------------------------------------------------------------------------

export type FighterState = 'idle' | 'walk' | 'crouch' | 'air' | 'attack' | 'hitstun' | 'down' | 'ko';

export interface Fighter {
    isPlayer: boolean;
    name: string;
    x: number;
    y: number;            // feet
    vx: number;
    vy: number;
    facing: 1 | -1;
    hp: number;
    maxHp: number;
    state: FighterState;
    /** Current attack, and how many frames into it we are (fractional; dt-driven). */
    move: MoveId | null;
    frame: number;
    /** An attack only ever lands once, however many frames its hitbox lives. */
    hasHit: boolean;
    hitstun: number;
    blockstun: number;
    /** Set by input each frame: holding away from the opponent, on the ground. */
    blockHeld: boolean;
    crouch: boolean;
    downTimer: number;
    invuln: number;
    /** Frames left in which the current attack's recovery may be cancelled. */
    cancel: number;
    hype: number;
    /** Weapon uses left; Infinity for unlimited. */
    ammo: number;
    slow: number;
    /** Cosmetic: frames of white flash. */
    flash: number;
    blockFlash: number;
    weapon: Weapon;
    moves: Record<MoveId, MoveDef>;
    /** Damage dealt this round — decides a timeout by decision. */
    dealt: number;
    /**
     * Presses waiting for their moment, in frames of life left.
     *
     * Without this the game deletes inputs. `onFrame` consumes every button
     * every frame, and a fighter who is in hitstun, blockstun, knocked down or
     * mid-recovery cannot act on one — so the press is simply gone. Hit-stop is
     * worse: `stepFight` returns before the fighters step at all, and hit-stop
     * runs on every hit that lands. The follow-up is the most common input in a
     * fight and it was the one most likely to be thrown away.
     */
    buf: { a: number; b: number; up: number };
    /** Frames of dash momentum left. */
    dash: number;
    /** Frames left for a second forward tap to register as a dash. */
    tapWin: number;
    /** Last frame's forward-hold, so a tap is an edge and not a hold. */
    fwdWas: boolean;
}

export interface Projectile {
    x: number;
    y: number;
    vx: number;
    dmg: number;
    glyph: string;
    spin: number;
    fromPlayer: boolean;
    returning: boolean;
    travelled: number;
    returns: boolean;
    piercing: boolean;
    slows: boolean;
    dead: boolean;
    /** Hit registration, so a piercing frisbee cannot hit the same body twice. */
    hitOnce: boolean;
}

export interface Spark { x: number; y: number; t: number; big: boolean; }

export type Phase = 'intro' | 'fight' | 'ko' | 'over';

export interface FightState {
    p: Fighter;
    f: Fighter;
    projectiles: Projectile[];
    sparks: Spark[];
    phase: Phase;
    /** Seconds left on the current phase banner (intro / ko). */
    phaseT: number;
    round: number;
    roundClock: number;
    wins: number;         // rounds the player has taken
    losses: number;
    /** Filled on 'over'. */
    matchWon: boolean | null;
    banner: { text: string; t: number; color: string } | null;
    talk: { text: string; t: number } | null;
    combo: { count: number; byPlayer: boolean; t: number };
    hitstop: number;
    shake: number;
    elapsed: number;
    credEdge: number;
    rng: () => number;
    ai: AiBrain;
    /**
     * Remaining uses per weapon id, so swapping on the rail mid-fight cannot
     * refill a half-spent bag of slushies. `uses` is per game, not per round.
     */
    ammoBank: Record<string, number>;
    /** Diagnostics the test script leans on. */
    stats: { hitsBlocked: number; hitsLanded: number; throwsMade: number };
}

export interface AiBrain {
    /** What it is trying to do right now. */
    plan: 'neutral' | 'approach' | 'retreat' | 'block' | 'attack' | 'taunt' | 'jump';
    /** Frames until it is allowed to re-decide. */
    think: number;
    /** Committed attack for this decision. 'jumpin' means "jump at them first". */
    queued: MoveId | 'jumpin' | null;
    /** 0..1, climbs as its health drops. Drives how often it commits. */
    aggr: number;
    /** Frames of reaction delay left before it can respond to what it sees. */
    react: number;
    /** Whether the current guard is a crouch block. */
    guardLow: boolean;
    /** Frame counter, used to shape the forward hold into a double tap. */
    tick: number;
}

export interface FightInput {
    left: boolean; right: boolean; up: boolean; down: boolean; a: boolean; b: boolean;
    aPressed: boolean; bPressed: boolean; upPressed: boolean;
}

export const blankInput = (): FightInput => ({
    left: false, right: false, up: false, down: false, a: false, b: false,
    aPressed: false, bPressed: false, upPressed: false,
});

/** Tiny LCG so a test run is reproducible; the game itself passes Math.random. */
export function seeded(seed: number): () => number {
    let s = seed >>> 0 || 1;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

export const TRASH_TALK = [
    "Life don't make sense, but this punch does.",
    "I'm dropping a mixtape about this.",
    'That shoelace was PROMISED to me.',
    'These is my streets!',
    'You flinched. I saw it.',
    "Half a sandwich. That's what this is. Half.",
    'I was on a Tiny Desk. Look it up.',
    'Stay down, homie.',
    'My manager is gonna hear about this.',
    'This is for the culture. Allegedly.',
];

const HIT_TALK = [
    'Mixtape bar!',
    'Skrrt!',
    'Thats a feature!',
    'Ow. Ow!',
    'Unsigned hype!',
];

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export interface FightConfig {
    opponent: string;
    weapon: Weapon;
    /** Player max health, derived from the player's real health stat. */
    playerHp?: number;
    foeHp?: number;
    /** 0..0.2. Street cred buys a modest real edge, as the text version did. */
    credEdge?: number;
    rng?: () => number;
}

function makeFighter(isPlayer: boolean, name: string, x: number, hp: number, weapon: Weapon): Fighter {
    return {
        isPlayer, name, x, y: GROUND, vx: 0, vy: 0,
        facing: isPlayer ? 1 : -1,
        hp, maxHp: hp,
        state: 'idle', move: null, frame: 0, hasHit: false,
        hitstun: 0, blockstun: 0, blockHeld: false, crouch: false,
        downTimer: 0, invuln: 0, cancel: 0, hype: 0,
        ammo: weapon.uses ?? Infinity,
        slow: 0, flash: 0, blockFlash: 0,
        weapon, moves: movesFor(weapon), dealt: 0,
        buf: { a: 0, b: 0, up: 0 },
        dash: 0, tapWin: 0, fwdWas: false,
    };
}

export function createFight(cfg: FightConfig): FightState {
    const rng = cfg.rng ?? Math.random;
    const pHp = Math.round(cfg.playerHp ?? 100);
    const fHp = Math.round(cfg.foeHp ?? 100);
    const s: FightState = {
        p: makeFighter(true, 'You', 108, pHp, cfg.weapon),
        f: makeFighter(false, cfg.opponent, 212, fHp, FISTS),
        projectiles: [], sparks: [],
        phase: 'intro', phaseT: 2.4,
        round: 1, roundClock: ROUND_SECONDS,
        wins: 0, losses: 0, matchWon: null,
        banner: { text: 'ROUND 1 — FIGHT!', t: 2.4, color: PAL.warn },
        talk: { text: TRASH_TALK[Math.floor(rng() * TRASH_TALK.length)], t: 2.4 },
        combo: { count: 0, byPlayer: true, t: 0 },
        hitstop: 0, shake: 0, elapsed: 0,
        credEdge: Math.max(0, Math.min(0.2, cfg.credEdge ?? 0)),
        rng,
        ai: { plan: 'approach', think: 20, queued: null, aggr: 0.35, react: 0, guardLow: false, tick: 0 },
        ammoBank: { [cfg.weapon.id]: cfg.weapon.uses ?? Infinity },
        stats: { hitsBlocked: 0, hitsLanded: 0, throwsMade: 0 },
    };
    return s;
}

/** Swap the player's AM/PM weapon mid-fight (the rail above the D-pad). */
export function setPlayerWeapon(s: FightState, weapon: Weapon) {
    if (s.p.weapon.id === weapon.id) return;
    s.ammoBank[s.p.weapon.id] = s.p.ammo;                       // bank what is left
    s.p.weapon = weapon;
    s.p.moves = movesFor(weapon);
    if (!(weapon.id in s.ammoBank)) s.ammoBank[weapon.id] = weapon.uses ?? Infinity;
    s.p.ammo = s.ammoBank[weapon.id];                           // and pick up where you left off
}

// ---------------------------------------------------------------------------
// Boxes
// ---------------------------------------------------------------------------

export interface Box { x: number; y: number; w: number; h: number; }

const overlaps = (a: Box, b: Box) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Hurtbox: one box per fighter. Crouching shrinks it, which is the entire
 * reason a crouch block can duck an overhead's follow-up and why the sweep
 * exists at all.
 */
export function hurtbox(f: Fighter): Box {
    const h = f.state === 'down' ? 12 : f.crouch ? 23 : FIG_H;
    return { x: f.x - BODY_W / 2, y: f.y - h, w: BODY_W, h };
}

/** Hitbox: exists only during a move's active window. */
export function hitbox(f: Fighter): Box | null {
    if (f.state !== 'attack' || !f.move) return null;
    const m = f.moves[f.move];
    if (m.throws) return null;
    if (f.frame < m.startup || f.frame >= m.startup + m.active) return null;
    const front = f.x + f.facing * (BODY_W / 2);
    const x = f.facing === 1 ? front : front - m.reach;
    // Vertical band by attack height. 'overhead' is measured DOWNWARD from the
    // attacker's feet because the only overhead is an air attack: the box has to
    // hang below a jumping fighter to land on a grounded one, which is also why
    // it is the answer to a crouch block.
    const top =
        m.height === 'low' ? f.y - 12 :
        m.height === 'overhead' ? f.y - 6 :
        f.y - 27;
    const h = m.height === 'low' ? 11 : m.height === 'overhead' ? 20 : 15;
    return { x, y: top, w: m.reach, h };
}

// ---------------------------------------------------------------------------
// Hit resolution
// ---------------------------------------------------------------------------

/**
 * Block rules, and why they are asymmetric:
 *
 *   standing block  stops 'mid' and 'overhead', LOSES to 'low'
 *   crouch block    stops 'mid' and 'low',      LOSES to 'overhead'
 *
 * So a turtle is always beatable — sweep the stander, stomp the croucher —
 * which keeps the AI from being able to just hold back forever and keeps the
 * player from doing the same.
 */
/** You cannot hit someone who is already on the floor — wait for the getup. */
const hittable = (f: Fighter) => f.state !== 'down' && f.state !== 'ko';

function blockSucceeds(def: Fighter, m: MoveDef): boolean {
    if (!def.blockHeld) return false;
    if (def.state === 'attack' || def.state === 'hitstun' || def.state === 'down' || def.state === 'air') return false;
    if (m.height === 'mid') return true;
    if (m.height === 'low') return def.crouch;
    return !def.crouch; // overhead
}

function spark(s: FightState, x: number, y: number, big: boolean) {
    s.sparks.push({ x, y, t: big ? 12 : 8, big });
    if (s.sparks.length > 24) s.sparks.shift();
}

function applyHit(s: FightState, atk: Fighter, def: Fighter, m: MoveDef, at: Box) {
    const cx = at.x + at.w / 2;
    const cy = at.y + at.h / 2;

    if (blockSucceeds(def, m)) {
        // Chip damage: blocking is good, not free. Guarding also builds hype,
        // so playing defence still charges the special.
        const chip = Math.max(1, Math.round(m.damage * m.chip));
        def.hp = Math.max(0, def.hp - chip);
        def.blockstun = Math.round(m.hitstun * 0.5);
        def.blockFlash = 6;
        def.vx = -def.facing * m.knock * 0.35;
        def.hype = Math.min(100, def.hype + 3);
        atk.hype = Math.min(100, atk.hype + 2);
        atk.dealt += chip;
        s.hitstop = Math.max(s.hitstop, Math.round(m.hitstop * 0.6));
        s.shake = Math.max(s.shake, m.shake * 0.4);
        s.stats.hitsBlocked++;
        spark(s, cx, cy, false);
        return;
    }

    if (def.invuln > 0) return;

    // Combo proration: each extra hit in a string does less, so a cancel chain
    // is rewarding without being a death sentence.
    const chaining = s.combo.count > 0 && s.combo.byPlayer === atk.isPlayer && s.combo.t > 0;
    const prorate = chaining ? Math.pow(0.85, s.combo.count) : 1;
    // Street cred: the player hits a little harder and takes a little less.
    const edge = atk.isPlayer ? 1 + s.credEdge : 1 - s.credEdge * 0.6;
    const dmg = Math.max(1, Math.round(m.damage * prorate * edge));

    def.hp = Math.max(0, def.hp - dmg);
    atk.dealt += dmg;
    def.hitstun = m.hitstun;
    def.blockstun = 0;
    def.state = 'hitstun';
    def.move = null;
    def.frame = 0;
    def.flash = 5;
    def.crouch = false;
    def.vx = -def.facing * m.knock;
    if (m.launch) { def.vy = m.launch; def.y = Math.min(def.y, GROUND - 1); }
    if (m.knockdown) { def.downTimer = 38; }

    atk.hype = Math.min(100, atk.hype + dmg * 1.1);
    def.hype = Math.min(100, def.hype + dmg * 0.7);

    s.hitstop = Math.max(s.hitstop, m.hitstop);
    s.shake = Math.max(s.shake, m.shake);
    s.stats.hitsLanded++;
    spark(s, cx, cy, m.shake >= 4);

    // Combo bookkeeping. A knockdown ends the string by definition.
    if (chaining) s.combo.count++;
    else { s.combo.count = 1; s.combo.byPlayer = atk.isPlayer; }
    // A knockdown ends the string by definition — there is nothing to cancel into.
    s.combo.t = m.knockdown ? 0 : 48;

    // Cancel window: landing a light attack lets the attacker skip its own
    // recovery and start another move. This is the combo system, in one line.
    atk.cancel = m.cancel;
    atk.hasHit = true;

    if (!atk.isPlayer && s.rng() < 0.28) {
        s.talk = { text: HIT_TALK[Math.floor(s.rng() * HIT_TALK.length)], t: 1.1 };
    }
}

// ---------------------------------------------------------------------------
// Attack starting
// ---------------------------------------------------------------------------

/**
 * How long a press waits for its moment, in frames. Seven is ~117ms at 60Hz —
 * long enough that a human aiming for the end of hitstun is forgiven, short
 * enough that a press you have given up on does not fire on its own later.
 */
export const BUFFER_FRAMES = 7;

/** Remember a press so it can fire the first frame the fighter is able to act. */
export function bufferPresses(f: Fighter, cmd: FightInput) {
    if (cmd.aPressed) f.buf.a = BUFFER_FRAMES;
    if (cmd.bPressed) f.buf.b = BUFFER_FRAMES;
    if (cmd.upPressed) f.buf.up = BUFFER_FRAMES;
}

/**
 * Buffers age only while the world is moving. Deliberately not called during
 * hit-stop: those frames are frozen for everyone, and spending a player's
 * buffer on a freeze they cannot act through is the bug, not the fix.
 */
function decayBuffer(f: Fighter, df: number) {
    if (f.buf.a > 0) f.buf.a = Math.max(0, f.buf.a - df);
    if (f.buf.b > 0) f.buf.b = Math.max(0, f.buf.b - df);
    if (f.buf.up > 0) f.buf.up = Math.max(0, f.buf.up - df);
}

function canAct(f: Fighter): boolean {
    if (f.state === 'hitstun' || f.state === 'down' || f.state === 'ko') return false;
    if (f.blockstun > 0) return false;
    if (f.state === 'attack') {
        // Only cancellable during a granted cancel window (after a light hit).
        return f.cancel > 0;
    }
    return true;
}

export function startAttack(s: FightState, f: Fighter, id: MoveId): boolean {
    const m = f.moves[id];
    if (!m) return false;
    if (!canAct(f)) return false;
    const airborne = f.y < GROUND - 0.5;
    if (m.air && !airborne) return false;
    if (!m.air && airborne) return false;
    if (m.meter && f.hype < m.meter) return false;
    if (m.throws && f.ammo <= 0) return false;

    if (m.meter) {
        f.hype -= m.meter;
        f.invuln = Math.max(f.invuln, m.startup); // startup armour, so it works as a reversal
        s.banner = {
            text: f.isPlayer ? 'SHOELACE UPPERCUT!!' : 'MIXTAPE DROP!!',
            t: 1.3,
            color: f.isPlayer ? PAL.accent : PAL.accent2,
        };
    }
    f.state = 'attack';
    f.move = id;
    f.frame = 0;
    f.hasHit = false;
    f.cancel = 0;
    f.crouch = id === 'sweep';
    if (!m.air) { f.vx = 0; f.dash = 0; f.tapWin = 0; }
    return true;
}

function throwWeapon(s: FightState, f: Fighter) {
    const wp = f.weapon;
    const dmg = Math.max(4, Math.min(18, Math.round(wp.damage * 0.5)));
    s.projectiles.push({
        x: f.x + f.facing * 10,
        y: f.y - 22,
        vx: f.facing * (wp.speed ?? 190),
        dmg,
        glyph: wp.glyph,
        spin: 0,
        fromPlayer: f.isPlayer,
        returning: false,
        travelled: 0,
        returns: !!wp.returns,
        piercing: !!wp.piercing,
        slows: !!wp.slows,
        dead: false,
        hitOnce: false,
    });
    if (f.ammo !== Infinity) f.ammo -= 1;
    s.stats.throwsMade++;
}

// ---------------------------------------------------------------------------
// Per-fighter step
// ---------------------------------------------------------------------------

function stepFighter(s: FightState, f: Fighter, other: Fighter, cmd: FightInput, dt: number) {
    const df = dt * FPS; // frames elapsed — dt is always 1/60 but never assumed
    const airborne = f.y < GROUND - 0.5;

    // Only reached on frames the world actually advanced: hit-stop returns from
    // stepFight above this, so a freeze costs a buffered press nothing.
    decayBuffer(f, df);

    // Always face the opponent unless committed to a move or airborne.
    if (f.state !== 'attack' && !airborne && f.state !== 'down' && f.state !== 'hitstun') {
        f.facing = other.x >= f.x ? 1 : -1;
    }

    if (f.flash > 0) f.flash -= df;
    if (f.blockFlash > 0) f.blockFlash -= df;
    if (f.invuln > 0) f.invuln -= df;
    if (f.slow > 0) f.slow -= df;
    if (f.cancel > 0) f.cancel -= df;

    // --- stun / knockdown ---
    if (f.state === 'hitstun') {
        f.hitstun -= df;
        if (f.downTimer > 0) {
            // Stay down until the getup, then a few invulnerable frames so you
            // are not immediately re-swept where you lie.
            if (!airborne) {
                f.downTimer -= df;
                f.state = 'down';
            }
        } else if (f.hitstun <= 0 && !airborne) {
            f.state = 'idle';
        }
    } else if (f.state === 'down') {
        f.downTimer -= df;
        f.vx *= 0.82;
        if (f.downTimer <= 0) { f.state = 'idle'; f.invuln = 12; }
    }

    if (f.blockstun > 0) f.blockstun -= df;

    // 'ko' counts as locked: otherwise the movement branch below would set the
    // state back to 'idle' and the loser would stand up during their own K.O.
    const locked = f.state === 'hitstun' || f.state === 'down' || f.state === 'ko' || f.blockstun > 0;

    // --- intent from input ---
    const toward = other.x >= f.x ? 1 : -1;
    const wantBack = (toward === 1 && cmd.left) || (toward === -1 && cmd.right);
    const wantFwd = (toward === 1 && cmd.right) || (toward === -1 && cmd.left);

    // Double-tap forward = dash. Detected on the rising edge of the forward
    // hold, so holding forward walks and tapping it twice bursts. The window is
    // deliberately short: a player alternating taps to walk should not skate.
    if (f.tapWin > 0) f.tapWin = Math.max(0, f.tapWin - df);
    if (f.dash > 0) f.dash = Math.max(0, f.dash - df);
    const fwdEdge = wantFwd && !f.fwdWas;
    f.fwdWas = wantFwd;
    if (fwdEdge && !locked && !airborne && f.state !== 'attack' && !f.crouch) {
        if (f.tapWin > 0) { f.dash = DASH_FRAMES; f.tapWin = 0; }
        else f.tapWin = TAP_WINDOW;
    }
    if (!wantFwd || locked) f.dash = 0;

    // Blocking is "hold back": no dedicated button, so it works with the
    // on-screen D-pad on a phone with a single thumb.
    f.blockHeld = !locked && !airborne && f.state !== 'attack' && wantBack;
    if (!locked && f.state !== 'attack') f.crouch = !airborne && cmd.down;

    if (!locked) {
        // --- attacks ---
        // A buffered press is cleared only once it actually produces a move, so
        // one that still cannot come out — mid-recovery, say — keeps waiting
        // out the rest of its window instead of being spent on a refusal.
        const tryLight = () => {
            if (f.buf.a <= 0) return;
            // Down + A with a full meter is the special. One thumb on the pad,
            // one on the button — the only "motion" input a phone can do well.
            // The direction is read live: what you are holding when it fires is
            // what you get, which is how a player reads their own hands.
            const fired = cmd.down && f.hype >= 100 && !airborne
                ? startAttack(s, f, 'special')
                : airborne
                  ? startAttack(s, f, 'air')
                  : startAttack(s, f, 'jab');
            if (fired) f.buf.a = 0;
        };
        const tryHeavy = () => {
            if (f.buf.b <= 0) return;
            const fired = airborne
                ? startAttack(s, f, 'air')
                : cmd.down
                  ? startAttack(s, f, 'sweep')
                  : f.weapon.klass === 'thrown' && f.ammo > 0
                    ? startAttack(s, f, 'toss')
                    : startAttack(s, f, 'heavy');
            if (fired) f.buf.b = 0;
        };
        /**
         * The NEWER press goes first — a buffer counts down, so the bigger
         * number is the more recent one.
         *
         * Order used to be fixed, light before heavy, and that quietly deleted
         * the game's only combo: press punch, then kick to cash in the cancel
         * window, and the punch press was still sitting in the buffer with a
         * few frames left, so it won the check and jabbed again. Measured over
         * fifty matches, a "jab then heavy" policy landed exactly zero heavies.
         */
        if (f.buf.b > f.buf.a) { tryHeavy(); tryLight(); }
        else { tryLight(); tryHeavy(); }

        // --- movement ---
        if (f.state !== 'attack') {
            if (!airborne && f.buf.up > 0 && !f.crouch) {
                f.buf.up = 0;
                f.vy = JUMP_V;
                f.y -= 1;
                if (wantFwd) f.vx = toward * 74;
                else if (wantBack) f.vx = -toward * 66;
                else f.vx = 0;
                f.state = 'air';
            } else if (airborne) {
                f.state = 'air';
            } else if (f.crouch) {
                f.vx = 0;
                f.state = 'crouch';
            } else if (wantFwd) {
                const speed = f.dash > 0 ? DASH_V : WALK_FWD;
                f.vx = toward * speed * (f.slow > 0 ? 0.5 : 1);
                f.state = 'walk';
            } else if (wantBack) {
                // Walking back is slower, which is what makes cornering work.
                f.vx = -toward * WALK_BACK * (f.slow > 0 ? 0.5 : 1);
                f.state = 'walk';
            } else {
                f.vx = 0;
                f.state = 'idle';
            }
        }
    }

    // --- attack frame advance ---
    if (f.state === 'attack' && f.move) {
        const m = f.moves[f.move];
        f.frame += df;
        if (m.throws && !f.hasHit && f.frame >= m.startup) {
            throwWeapon(s, f);
            f.hasHit = true;
        }
        if (f.frame >= m.startup + m.active + m.recovery) {
            f.state = airborne ? 'air' : 'idle';
            f.move = null;
            f.frame = 0;
            f.hasHit = false;
            f.cancel = 0;
        }
    }

    // --- physics ---
    if (airborne || f.vy < 0) {
        f.vy += GRAV * dt;
        f.y += f.vy * dt;
        if (f.y >= GROUND) {
            f.y = GROUND;
            f.vy = 0;
            f.vx *= 0.3;
            if (f.state === 'air' || (f.state === 'attack' && f.move && f.moves[f.move].air)) {
                f.state = 'idle';
                f.move = null;
                f.frame = 0;
            }
            if (f.state === 'hitstun' && f.downTimer <= 0) f.downTimer = 22;
        }
    } else {
        f.vy = 0;
    }

    f.x += f.vx * dt;
    // Knockback and blockstun pushback decay so nobody slides forever.
    if (locked || f.state === 'attack') f.vx *= Math.pow(0.86, df);

    if (f.x < STAGE_L) { f.x = STAGE_L; f.vx = 0; }
    if (f.x > STAGE_R) { f.x = STAGE_R; f.vx = 0; }
}

/** Bodies are solid on the ground; cornering someone is a real advantage. */
function separate(a: Fighter, b: Fighter) {
    const dx = b.x - a.x;
    const d = Math.abs(dx);
    if (d >= MIN_SEP) return;
    const push = (MIN_SEP - d) / 2;
    const dir = dx >= 0 ? 1 : -1;
    a.x -= dir * push;
    b.x += dir * push;
    // If one of them is against a wall, the other eats the whole push.
    if (a.x < STAGE_L) { const over = STAGE_L - a.x; a.x = STAGE_L; b.x += over; }
    if (a.x > STAGE_R) { const over = a.x - STAGE_R; a.x = STAGE_R; b.x -= over; }
    if (b.x < STAGE_L) { const over = STAGE_L - b.x; b.x = STAGE_L; a.x += over; }
    if (b.x > STAGE_R) { const over = b.x - STAGE_R; b.x = STAGE_R; a.x -= over; }
    a.x = Math.max(STAGE_L, Math.min(STAGE_R, a.x));
    b.x = Math.max(STAGE_L, Math.min(STAGE_R, b.x));
}

// ---------------------------------------------------------------------------
// Projectiles — the AM/PM thrown weapons
// ---------------------------------------------------------------------------

/** Synthetic move data so a flying bureka goes through the same block check. */
const PROJECTILE_MOVE = (dmg: number): MoveDef => ({
    label: 'Thrown', startup: 0, active: 1, recovery: 0,
    damage: dmg, reach: 0, height: 'mid',
    knock: 58, hitstun: 16, hitstop: 5, shake: 3, chip: 0.09, cancel: 0,
});

const RETURN_DIST = 120;

function stepProjectiles(s: FightState, dt: number) {
    for (const pr of s.projectiles) {
        if (pr.dead) continue;
        pr.x += pr.vx * dt;
        pr.travelled += Math.abs(pr.vx) * dt;
        pr.spin += dt * 13;

        const owner = pr.fromPlayer ? s.p : s.f;
        const target = pr.fromPlayer ? s.f : s.p;

        // A returning weapon turns around on its own. The chancla has always
        // been a homing weapon and this is the part where that pays off.
        if (pr.returns && !pr.returning && (pr.travelled > RETURN_DIST || pr.x < STAGE_L - 6 || pr.x > STAGE_R + 6)) {
            pr.returning = true;
            pr.vx *= -1;
            pr.hitOnce = false; // it gets to hit you again on the way home
        }

        if (pr.returning && Math.abs(pr.x - owner.x) < 11) {
            // Caught. A returning weapon costs nothing in the long run, it is
            // just slow — you have to wait for your flip-flop to come back.
            pr.dead = true;
            if (owner.ammo !== Infinity) owner.ammo += 1;
            continue;
        }

        if (!pr.returns && (pr.x < STAGE_L - 12 || pr.x > STAGE_R + 12)) { pr.dead = true; continue; }
        if (pr.travelled > 900) { pr.dead = true; continue; }

        if (!pr.hitOnce && hittable(target)) {
            const box: Box = { x: pr.x - 5, y: pr.y - 5, w: 10, h: 10 };
            if (overlaps(box, hurtbox(target))) {
                applyHit(s, owner, target, PROJECTILE_MOVE(pr.dmg), box);
                pr.hitOnce = true;
                if (pr.slows) target.slow = 100;
                // Piercing keeps flying (the frisbee "cuts through a whole row
                // of people"); anything else stops dead — or starts coming back.
                if (!pr.piercing) {
                    if (pr.returns && !pr.returning) { pr.returning = true; pr.vx *= -1; pr.hitOnce = false; }
                    else pr.dead = true;
                }
            }
        }
    }
    s.projectiles = s.projectiles.filter(pr => !pr.dead);
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
/**
 * The opponent is a small state machine with a reaction delay.
 *
 *   approach — walk in until he is at his own range
 *   attack   — commit to a move chosen from what he can SEE you doing
 *   block    — hold back (blocking is the same "hold away" input the player uses)
 *   retreat  — walk out of range, which also means he is guarding
 *   taunt    — stand there talking, because he is a washed-up rapper
 *
 * Two things stop him being a punching bag: he watches for the recovery frames
 * of your whiffed attacks and punishes them, and he reads your guard height —
 * hold a standing block and he will sweep you, crouch and he will jump on you.
 * Two things stop him being unfair: `react` frames of delay before he can
 * respond to anything, and `aggr` rising only as his own health drops, so the
 * fight gets more desperate rather than starting that way.
 */
function aiInput(s: FightState, dt: number): FightInput {
    const cmd = blankInput();
    const ai = s.ai;
    const f = s.f;
    const p = s.p;
    const df = dt * FPS;

    ai.think -= df;
    ai.react -= df;
    ai.tick = (ai.tick + df) % 4200;
    // Ramps as he loses; the player's street cred takes a little off the top.
    ai.aggr = Math.max(0.15, Math.min(0.95, 0.32 + (1 - f.hp / f.maxHp) * 0.55 - s.credEdge * 0.5));

    const toward: 1 | -1 = p.x >= f.x ? 1 : -1;
    const dist = Math.abs(p.x - f.x);
    const pm = p.move ? p.moves[p.move] : null;
    const playerAttacking = p.state === 'attack' && !!pm && !pm.throws;
    const playerRecovering = playerAttacking && !!pm && p.frame >= pm.startup + pm.active;
    const incoming = s.projectiles.find(pr =>
        !pr.dead && pr.fromPlayer && Math.sign(pr.vx) === (f.x > p.x ? 1 : -1) && Math.abs(pr.x - f.x) < 80);

    // --- decide ---
    if (ai.think <= 0 && ai.react <= 0) {
        const r = s.rng();
        ai.queued = null;
        const reach = f.moves.heavy.reach;

        if (incoming && r < 0.72) {
            ai.plan = 'block';
            ai.guardLow = s.rng() < 0.35;
            ai.think = 16;
        } else if (playerRecovering && dist < reach + BODY_W + 10) {
            // Whiff punish: this is the single thing that makes him feel alive.
            // Inside jab range the jab is the punish — 4 frames of startup beats
            // the heavy's 9, and a whiff window is only ever a dozen frames wide.
            ai.plan = 'attack';
            ai.queued = dist <= f.moves.jab.reach + BODY_W + 5 ? 'jab' : 'heavy';
            ai.think = 16;
        } else if (f.hype >= 100 && dist < 40 && r < 0.55) {
            // Above the guard branch on purpose. The special has invulnerable
            // startup — it is his reversal, the answer to being held down by a
            // string of safe pokes — and while it sat below "they are attacking,
            // block" he could never spend a meter he only earned by being hit.
            ai.plan = 'attack';
            ai.queued = 'special';
            ai.think = 22;
        } else if (playerAttacking && dist < reach + 18 && r < 0.5 + ai.aggr * 0.2) {
            ai.plan = 'block';
            // Guess the height. He is wrong often enough to be beatable.
            ai.guardLow = pm!.height === 'low' ? s.rng() < 0.7 : s.rng() < 0.3;
            ai.think = 14;
        } else if (dist > 50) {
            if (r < 0.12 && f.hp > f.maxHp * 0.6) { ai.plan = 'taunt'; ai.think = 40; }
            else { ai.plan = 'approach'; ai.think = 14; }
        } else if (dist > 32) {
            if (r < ai.aggr) { ai.plan = 'approach'; ai.think = 12; }
            else { ai.plan = r < 0.6 ? 'neutral' : 'retreat'; ai.think = 18; }
        } else if (dist > 16) {
            if (r < ai.aggr + 0.18) {
                ai.plan = 'attack';
                // Read the guard: sweep a stander, stomp a croucher.
                if (p.blockHeld && !p.crouch) ai.queued = s.rng() < 0.5 ? 'sweep' : 'heavy';
                else if (p.blockHeld && p.crouch) ai.queued = s.rng() < 0.45 ? 'jumpin' : 'heavy';
                else { const k = s.rng(); ai.queued = k < 0.38 ? 'jab' : k < 0.72 ? 'heavy' : 'sweep'; }
                ai.think = 14;
            } else { ai.plan = r < 0.5 ? 'block' : 'neutral'; ai.guardLow = s.rng() < 0.4; ai.think = 16; }
        } else {
            if (r < 0.62) { ai.plan = 'attack'; ai.queued = 'jab'; ai.think = 12; }
            else { ai.plan = 'retreat'; ai.think = 14; }
        }
        // Reaction delay before the NEXT read — an opening stays open for a beat.
        ai.react = 4 + Math.floor(s.rng() * 7);
    }

    /**
     * Reflex guard — the one thing he is allowed to do off-schedule.
     *
     * His decision timer runs at 12-22 frames and a heavy is a 28-frame move,
     * so a purely scheduled read walks face-first into a hitbox about half the
     * time. That is what made mashing the long button a solved strategy. He
     * still has to have his reaction available, and he still guesses the height,
     * so mashing is *good* against him rather than free.
     */
    if (playerAttacking && pm && ai.react <= 2 && ai.plan !== 'block' && ai.queued !== 'special'
        && dist < pm.reach + BODY_W + 8
        && p.frame >= pm.startup - 7 && p.frame < pm.startup + pm.active + 2
        && s.rng() < 0.64) {
        ai.plan = 'block';
        ai.queued = null;
        ai.guardLow = pm.height === 'low' ? s.rng() < 0.55 : s.rng() < 0.25;
        ai.think = 6;
        ai.react = 3 + Math.floor(s.rng() * 4);
    }

    /**
     * Forward, optionally with a dash in it.
     *
     * He has no private movement code: the dash is the same double-tap the
     * player's pad produces, so releasing forward for one frame in seven is
     * literally him tapping twice. Without it he could set a punish up and then
     * fail to arrive — measured at eight-odd frames short of a jab on a blocked
     * heavy, which is the whole reason a mashed long button used to be free.
     */
    const forward = (burst: boolean) => {
        if (burst && Math.floor(ai.tick) % 7 === 0) return;
        if (toward === 1) cmd.right = true; else cmd.left = true;
    };
    /** Only sprints when there is ground to make up: into a punish, or from afar. */
    const burst = dist > 58 || (ai.plan === 'attack' && playerRecovering);

    // --- execute ---
    switch (ai.plan) {
        case 'approach': forward(burst); break;
        case 'retreat':
            // Retreat has a floor. Walking backwards until nothing reaches is
            // exactly the drift that emptied the neutral game; past his own
            // heavy's range he holds ground instead.
            if (dist < f.moves.heavy.reach + BODY_W + 6) {
                if (toward === 1) cmd.left = true; else cmd.right = true;
            }
            break;
        case 'block':
            if (toward === 1) cmd.left = true; else cmd.right = true;
            if (ai.guardLow) cmd.down = true;
            break;
        case 'jump':
            cmd.upPressed = true; cmd.up = true;
            if (toward === 1) cmd.right = true; else cmd.left = true;
            ai.plan = 'neutral';
            break;
        default: break;
    }

    if (ai.plan === 'attack' && ai.queued) {
        if (ai.queued === 'jumpin') {
            // Jump-in on a crouching turtle — an overhead beats a low guard.
            if (f.y >= GROUND - 0.5) {
                cmd.upPressed = true; cmd.up = true;
                if (toward === 1) cmd.right = true; else cmd.left = true;
            } else if (dist < 30) {
                cmd.aPressed = true; cmd.a = true;
                ai.queued = null; ai.plan = 'neutral';
            }
        } else {
            // Walk into range first; commit once the move can actually reach.
            // The margin is INSIDE the reach, not at the lip of it: a move
            // started at the exact edge spends its startup frames there and the
            // hitbox arrives in empty air. Swinging at the edge was most of what
            // he did, and it is why mashing a long button beat him for free.
            const want = f.moves[ai.queued];
            // A target stuck in recovery, hitstun or blockstun cannot walk out
            // of it, so against one he commits at the lip of his range; against
            // a free opponent he steps inside it first.
            const frozen = playerRecovering || p.state === 'hitstun' || p.blockstun > 0;
            if (dist <= want.reach + BODY_W - (frozen ? 1 : 5)) {
                if (ai.queued === 'jab' || ai.queued === 'special') { cmd.aPressed = true; cmd.a = true; }
                else { cmd.bPressed = true; cmd.b = true; }
                // Sweep and special are both "down + button" inputs, same as the player's.
                if (ai.queued === 'sweep' || ai.queued === 'special') cmd.down = true;
                ai.queued = null;
                ai.plan = 'neutral';
            } else forward(burst);
        }
    }

    return cmd;
}

// ---------------------------------------------------------------------------
// Round flow
// ---------------------------------------------------------------------------

function resetRound(s: FightState) {
    const keepHype = (f: Fighter) => Math.min(60, f.hype * 0.5);
    const reset = (f: Fighter, x: number, facing: 1 | -1) => {
        const hype = keepHype(f);
        f.x = x; f.y = GROUND; f.vx = 0; f.vy = 0; f.facing = facing;
        f.hp = f.maxHp;                     // health resets PER ROUND, by design
        f.state = 'idle'; f.move = null; f.frame = 0; f.hasHit = false;
        f.hitstun = 0; f.blockstun = 0; f.blockHeld = false; f.crouch = false;
        f.downTimer = 0; f.invuln = 0; f.cancel = 0; f.slow = 0;
        f.flash = 0; f.blockFlash = 0; f.dealt = 0;
        f.dash = 0; f.tapWin = 0; f.fwdWas = false;
        f.hype = hype;                      // ammo deliberately NOT reset: uses are per game
    };
    reset(s.p, 108, 1);
    reset(s.f, 212, -1);
    s.projectiles = [];
    s.sparks = [];
    s.combo = { count: 0, byPlayer: true, t: 0 };
    s.roundClock = ROUND_SECONDS;
    s.hitstop = 0;
    s.shake = 0;
    s.ai = { plan: 'approach', think: 24, queued: null, aggr: 0.32, react: 0, guardLow: false, tick: 0 };
}

function endRound(s: FightState, playerWon: boolean | null, byKo: boolean) {
    s.phase = 'ko';
    s.phaseT = 2.7;
    if (playerWon === true) s.wins++;
    else if (playerWon === false) s.losses++;

    const loser = playerWon === true ? s.f : playerWon === false ? s.p : null;
    if (loser && byKo) { loser.state = 'ko'; loser.downTimer = 999; }

    s.banner = byKo
        ? { text: 'K.O.!', t: 2.7, color: PAL.bad }
        : { text: 'TIME UP', t: 2.7, color: PAL.warn };
    s.shake = Math.max(s.shake, byKo ? 7 : 2);
    s.talk = playerWon === false
        ? { text: TRASH_TALK[Math.floor(s.rng() * TRASH_TALK.length)], t: 2.4 }
        : { text: 'Yo that was a warm-up. WARM-UP!', t: 2.4 };
}

function advanceAfterKo(s: FightState) {
    // A dead-even timeout awards the round to nobody, which in theory could run
    // a best-of-3 forever. After five rounds the bystanders call it, the way
    // they always do, and whoever has more rounds (ties to the player) takes it.
    const exhausted = s.round >= 5;
    if (exhausted || s.wins >= ROUNDS_TO_WIN || s.losses >= ROUNDS_TO_WIN) {
        s.matchWon = exhausted ? s.wins >= s.losses : s.wins >= ROUNDS_TO_WIN;
        s.phase = 'over';
        // Hold the final banner for a beat before the result card appears.
        s.phaseT = 1.9;
        s.banner = s.matchWon
            ? { text: 'YOU WIN', t: 1.9, color: PAL.ok }
            : { text: 'YOU LOSE', t: 1.9, color: PAL.bad };
        return;
    }
    s.round++;
    resetRound(s);
    s.phase = 'intro';
    s.phaseT = 2.3;
    s.banner = { text: `ROUND ${s.round} — FIGHT!`, t: 2.3, color: PAL.warn };
    s.talk = { text: TRASH_TALK[Math.floor(s.rng() * TRASH_TALK.length)], t: 2.3 };
}

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

/**
 * One fixed 1/60s tick of the whole fight. Pure: same state + same inputs +
 * same RNG => same result, which is what lets the test script run 3000 frames
 * headless and assert the invariants.
 */
export function stepFight(s: FightState, cmd: FightInput, dt: number) {
    const df = dt * FPS;
    s.elapsed += dt;

    // Before anything can return early. Hit-stop bails out below without the
    // fighters ever stepping, and that is exactly when a player is pressing the
    // follow-up — so the press is recorded first and acted on when the world
    // starts moving again. Gated to a live round so a press during the announce
    // still cannot turn into a pre-swing on "FIGHT!".
    if (s.phase === 'fight') bufferPresses(s.p, cmd);

    // Cosmetics tick even during hit-stop, so sparks still animate while the
    // fighters are frozen — that contrast is what sells the impact.
    if (s.shake > 0) s.shake = Math.max(0, s.shake - 14 * dt);
    for (const sp of s.sparks) sp.t -= df;
    s.sparks = s.sparks.filter(sp => sp.t > 0);
    if (s.banner) { s.banner.t -= dt; if (s.banner.t <= 0) s.banner = null; }
    if (s.talk) { s.talk.t -= dt; if (s.talk.t <= 0) s.talk = null; }
    // Runs negative on purpose: the counter lingers on screen for a beat after
    // the string ends, then clears.
    s.combo.t -= df;
    if (s.combo.count > 0 && s.combo.t < -40) s.combo.count = 0;

    /**
     * Hit-stop: on impact both fighters freeze for a few frames. Nothing about
     * the simulation advances — not physics, not frame counters — so a heavy
     * hit reads as a heavy hit instead of a number going down.
     */
    if (s.hitstop > 0) { s.hitstop -= df; return; }

    if (s.phase === 'intro') {
        s.phaseT -= dt;
        // Both fighters idle during the announce; keeps them from pre-swinging.
        stepFighter(s, s.p, s.f, blankInput(), dt);
        stepFighter(s, s.f, s.p, blankInput(), dt);
        separate(s.p, s.f);
        if (s.phaseT <= 0) { s.phase = 'fight'; s.banner = null; }
        return;
    }

    if (s.phase === 'ko') {
        s.phaseT -= dt;
        const idle = blankInput();
        stepFighter(s, s.p, s.f, idle, dt);
        stepFighter(s, s.f, s.p, idle, dt);
        separate(s.p, s.f);
        stepProjectiles(s, dt);
        if (s.phaseT <= 0) advanceAfterKo(s);
        return;
    }

    if (s.phase === 'over') { s.phaseT -= dt; return; }

    // --- live round ---
    s.roundClock = Math.max(0, s.roundClock - dt);

    const foeCmd = aiInput(s, dt);
    bufferPresses(s.f, foeCmd);
    stepFighter(s, s.p, s.f, cmd, dt);
    stepFighter(s, s.f, s.p, foeCmd, dt);
    separate(s.p, s.f);

    // Attacks resolve after both fighters have moved, so trades are symmetric:
    // if both hitboxes are live on the same frame, both land. The move defs are
    // captured first because the first hit may cancel the other fighter's move
    // out from under us.
    const pBox = hitbox(s.p);
    const fBox = hitbox(s.f);
    const pMove = s.p.move ? s.p.moves[s.p.move] : null;
    const fMove = s.f.move ? s.f.moves[s.f.move] : null;
    if (pBox && pMove && !s.p.hasHit && hittable(s.f) && overlaps(pBox, hurtbox(s.f))) {
        applyHit(s, s.p, s.f, pMove, pBox);
    }
    if (fBox && fMove && !s.f.hasHit && hittable(s.p) && overlaps(fBox, hurtbox(s.p))) {
        applyHit(s, s.f, s.p, fMove, fBox);
    }

    stepProjectiles(s, dt);
    s.ammoBank[s.p.weapon.id] = s.p.ammo;   // keep the bank in step with the hand

    if (s.f.hp <= 0 && s.p.hp <= 0) endRound(s, null, true);
    else if (s.f.hp <= 0) endRound(s, true, true);
    else if (s.p.hp <= 0) endRound(s, false, true);
    else if (s.roundClock <= 0) {
        // Timeout is decided on remaining health, like every fighter ever.
        const pPct = s.p.hp / s.p.maxHp;
        const fPct = s.f.hp / s.f.maxHp;
        endRound(s, Math.abs(pPct - fPct) < 0.01 ? null : pPct > fPct, false);
    }
}

// ---------------------------------------------------------------------------
// Rendering — procedural, no assets
// ---------------------------------------------------------------------------

/** Deterministic alley crowd. Built once so they don't twitch between frames. */
const CROWD = Array.from({ length: 10 }, (_, i) => ({
    x: 62 + i * 21 + (i % 3) * 4,
    c: ['#4b3f5c', '#5c4436', '#36445c', '#3f5040', '#5c5236'][i % 5],
    skin: i % 2 ? PAL.skinDark : PAL.skin,
    p: i * 0.83,
}));

/** Deterministic skyline, same reason. */
const SKYLINE = Array.from({ length: 14 }, (_, i) => ({
    x: i * 24,
    w: 16 + (i % 4) * 5,
    h: 10 + ((i * 37) % 23),
}));

const STARS = Array.from({ length: 22 }, (_, i) => ({ x: (i * 61) % W, y: (i * 29) % 44 }));

function drawBackdrop(ctx: CanvasRenderingContext2D, s: FightState) {
    // Night sky over the AM/PM parking lot.
    rect(ctx, 0, 0, W, 56, '#0a0e1c');
    for (const st of STARS) rect(ctx, st.x, st.y, 1, 1, 'rgba(230,237,243,0.55)');
    circle(ctx, 272, 16, 7, '#e9e4c9');
    circle(ctx, 269, 14, 6, '#0a0e1c');

    for (const b of SKYLINE) {
        rect(ctx, b.x, 56 - b.h, b.w, b.h, '#0f1424');
        // A couple of lit windows each, always the same ones.
        for (let wy = 56 - b.h + 3; wy < 54; wy += 5) {
            if ((b.x + wy) % 3 === 0) rect(ctx, b.x + 3, wy, 2, 2, 'rgba(255,180,0,0.35)');
        }
    }

    // Brick wall.
    rect(ctx, 0, 56, W, GROUND - 58, '#1b1218');
    ctx.globalAlpha = 0.5;
    // Courses every 6px, vertical joints on alternate rows only — it reads as
    // brick from two feet away and halves the stroke count per frame.
    let course = 0;
    for (let y = 58; y < GROUND - 2; y += 6, course++) {
        line(ctx, 0, y, W, y, '#241a20');
        if (course % 2) continue;
        for (let x = 7; x < W; x += 14) line(ctx, x, y, x, y + 6, '#241a20');
    }
    ctx.globalAlpha = 1;

    // Graffiti. The wall has opinions.
    text(ctx, 'AM/PM 4 LIFE', 8, 66, { size: 9, color: 'rgba(255,46,136,0.5)', mono: false, bold: true });
    text(ctx, 'FREE THE SHOELACE', 196, 64, { size: 6, color: 'rgba(0,229,192,0.4)' });
    text(ctx, 'HE STILL OWES ME', 200, 74, { size: 6, color: 'rgba(255,180,0,0.3)' });

    // Dumpster + bags, stage left.
    rect(ctx, 2, 122, 42, 28, '#25402f');
    rect(ctx, 2, 120, 42, 4, '#2f5039');
    outline(ctx, 2, 122, 42, 28, '#16281e');
    rect(ctx, 8, 128, 8, 3, '#1b3024');
    circle(ctx, 50, 146, 5, '#161a1e');
    circle(ctx, 57, 147, 4, '#161a1e');

    // Streetlight, stage right, doing the heavy lifting on the mood.
    rect(ctx, 296, 58, 3, 92, '#232a31');
    rect(ctx, 286, 58, 14, 4, '#232a31');
    circle(ctx, 292, 62, 3, PAL.warn);
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = PAL.warn;
    ctx.beginPath();
    ctx.moveTo(292, 62);
    ctx.lineTo(250, GROUND);
    ctx.lineTo(W, GROUND);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Crowd behind the rail. Everybody is filming. Of course they are.
    for (const c of CROWD) {
        const bob = Math.sin(s.elapsed * 3.4 + c.p) * 1.4;
        const y = 139 + bob;
        rect(ctx, c.x - 4, y - 11, 8, 11, c.c);          // torso
        rect(ctx, c.x - 3, y - 17, 6, 6, c.skin);        // head
        rect(ctx, c.x - 3.5, y - 18, 7, 2, '#12151a');   // cap
        // One in three is holding a phone up.
        if ((c.x | 0) % 3 === 0) {
            rect(ctx, c.x + 3, y - 20, 3, 5, '#0c0f13');
            rect(ctx, c.x + 3.5, y - 19.5, 2, 4, 'rgba(140,82,255,0.75)');
        }
    }
    // Rail
    line(ctx, 52, 141, 288, 141, '#2b333c');
    for (let x = 56; x < 288; x += 26) line(ctx, x, 141, x, GROUND - 2, '#232a31');

    // Asphalt.
    rect(ctx, 0, GROUND - 2, W, H - GROUND + 2, '#15181d');
    line(ctx, 0, GROUND - 2, W, GROUND - 2, '#232a31');
    ctx.globalAlpha = 0.5;
    band(ctx, GROUND + 6, 1, W, 0, 37, '#1d2126', (c, x, y) => rect(c, x, y, 18, 1, '#1d2126'));
    ctx.globalAlpha = 1;
    // A puddle, because it is always just after rain in a fighting game.
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = PAL.accent;
    ctx.beginPath();
    ctx.ellipse(92, 170, 26, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/**
 * Sprite ids for the two fighters.
 *
 * These are STRING ids looked up in the engine's sprite registry, never
 * imports — the art files under data/sprites are authored separately and any of
 * them may be absent. `actor()` resolves the id at draw time and falls back to
 * the old block `figure()` with the same kit colours if nobody drew it, so the
 * fight never renders an empty stage.
 *
 * The colourways are preserved as palette swaps: sprites are authored with c/C
 * as the kit colour, c/C is already the teal accent, so the player needs no
 * swap and the rival becomes magenta with { c: 'm', C: 'M' }.
 */
const FIGHTER_SPRITE = { player: 'player', rival: 'player' } as const;

function drawFighter(ctx: CanvasRenderingContext2D, s: FightState, f: Fighter) {
    const kit = f.isPlayer ? KIT.player : KIT.rival;
    const spriteId = f.isPlayer ? FIGHTER_SPRITE.player : FIGHTER_SPRITE.rival;
    const swap = f.isPlayer ? SWAP.teal : { ...SWAP.magenta, ...SWAP.skinDark };
    const airborne = f.y < GROUND - 0.5;
    const hurt = f.flash > 0;

    // Knocked down / K.O. — tip the whole figure over.
    if (f.state === 'down' || f.state === 'ko') {
        shadow(ctx, f.x, GROUND + 1, 16, 4, 0.4);
        ctx.save();
        ctx.translate(f.x + f.facing * 6, GROUND);
        ctx.rotate((-f.facing * Math.PI) / 2);
        actor(ctx, spriteId, 0, 0, {
            height: FIG_H, facing: 1, frame: 0, swap, kit, hurt, shadow: false,
        });
        ctx.restore();
        if (f.state === 'ko') glyph(ctx, '💫', f.x, GROUND - 38 + Math.sin(s.elapsed * 4) * 2, 9);
        return;
    }

    const m = f.state === 'attack' && f.move ? f.moves[f.move] : null;
    const phase: 'startup' | 'active' | 'recovery' | null = !m ? null
        : f.frame < m.startup ? 'startup'
        : f.frame < m.startup + m.active ? 'active'
        : 'recovery';
    const ext = phase === 'active' ? 1 : phase === 'startup' ? 0.3 : 0.55;

    // Walk cycle is driven by position, so the legs match the actual movement.
    const walking = f.state === 'walk';
    const stride = walking ? ((f.x * 0.055) % 1) : airborne ? 0.25 : Math.sin(s.elapsed * 2) * 0.02;
    const armUp = m ? (m.height === 'low' ? 0 : f.move === 'special' ? 1.3 : f.move === 'toss' ? 1.1 : 0.85) * (phase === 'startup' ? 0.6 : 1) : 0;

    ctx.save();
    if (f.invuln > 0 && Math.floor(s.elapsed * 30) % 2 === 0) ctx.globalAlpha = 0.55;

    // Hype aura at full meter: you can see the special is available.
    if (f.hype >= 100) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(s.elapsed * 9) * 0.15;
        circle(ctx, f.x, f.y - 17, 20, f.isPlayer ? 'rgba(0,229,192,0.25)' : 'rgba(255,46,136,0.25)');
        ctx.restore();
    }

    // `height: FIG_H` makes the sprite exactly as tall as the hurtbox the sim
    // uses, so what you see is still what gets hit. Everything drawn after this
    // (guard arm, attack limbs, thrown objects) is unchanged and still keyed off
    // f.x / f.y / BODY_W, so the frame data and the picture stay in sync.
    actor(ctx, spriteId, f.x, f.y, {
        height: FIG_H, facing: f.facing, stride, swap, kit, armUp,
        crouch: f.crouch || f.state === 'crouch', hurt,
    });

    const fwd = f.facing;
    const front = f.x + fwd * (BODY_W / 2);
    const skin = hurt ? PAL.white : kit.skin;

    // Guard pose — a forearm across the face, low or high.
    if (f.blockHeld || f.blockstun > 0) {
        const gy = f.crouch ? f.y - 18 : f.y - 26;
        rect(ctx, front - (fwd === 1 ? 0 : 4), gy, 4, 11, skin);
        if (f.blockFlash > 0) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            for (let i = 0; i < 3; i++) {
                line(ctx, front + fwd * 4, gy + i * 4, front + fwd * 9, gy + 1 + i * 4, PAL.ink);
            }
            ctx.restore();
        }
    }

    // Attack limbs. Length tracks the real hitbox, so what you see is what hits.
    if (m && phase) {
        const len = m.reach * ext;
        if (f.move === 'sweep') {
            rect(ctx, fwd === 1 ? front : front - len, f.y - 7, len, 5, kit.trim);
            rect(ctx, fwd === 1 ? front + len - 5 : front - len, f.y - 8, 5, 4, PAL.white);
        } else if (f.move === 'air') {
            rect(ctx, fwd === 1 ? front : front - len, f.y - 14, len, 5, kit.trim);
            rect(ctx, fwd === 1 ? front + len - 5 : front - len, f.y - 15, 5, 4, PAL.white);
        } else if (f.move === 'special') {
            // Rising uppercut: an arc of knuckles going up and through.
            for (let i = 0; i < 4; i++) {
                const t = i / 3;
                circle(ctx, front + fwd * (6 + t * 16), f.y - 24 - t * 18, 3.4 - t, i % 2 ? PAL.warn : (f.isPlayer ? PAL.accent : PAL.accent2));
            }
            rect(ctx, fwd === 1 ? front : front - 10, f.y - 34, 10, 5, skin);
            glyph(ctx, '👟', front + fwd * 16, f.y - 44, 9, fwd * 0.6);
        } else if (f.move === 'toss') {
            rect(ctx, fwd === 1 ? front - 2 : front - 4, f.y - 32, 6, 4, skin);
            if (phase === 'startup') glyph(ctx, f.weapon.glyph, front + fwd * 3, f.y - 35, 9);
        } else if (f.move === 'heavy' && f.weapon.klass === 'melee' && f.weapon.id !== FISTS.id) {
            // Swinging an actual object: arm, then the object at the far end.
            rect(ctx, fwd === 1 ? front : front - len * 0.6, f.y - 25, len * 0.6, 4, skin);
            glyph(ctx, f.weapon.glyph, front + fwd * len * 0.85, f.y - 24, 13, fwd * (phase === 'active' ? 0.2 : -0.9));
        } else if (f.move === 'heavy') {
            rect(ctx, fwd === 1 ? front : front - len, f.y - 18, len, 6, kit.trim);
            rect(ctx, fwd === 1 ? front + len - 6 : front - len, f.y - 19, 6, 5, PAL.white);
        } else {
            // Jab.
            rect(ctx, fwd === 1 ? front : front - len, f.y - 26, len, 4, skin);
            rect(ctx, fwd === 1 ? front + len - 4 : front - len, f.y - 27, 4, 5, kit.main);
        }
    }
    ctx.restore();
}

function drawProjectiles(ctx: CanvasRenderingContext2D, s: FightState) {
    for (const pr of s.projectiles) {
        // A returning weapon gets a little trail so you can see it coming back.
        ctx.save();
        ctx.globalAlpha = 0.3;
        glyph(ctx, pr.glyph, pr.x - Math.sign(pr.vx) * 7, pr.y, 9, -pr.spin * 0.6);
        ctx.restore();
        glyph(ctx, pr.glyph, pr.x, pr.y, 12, pr.spin * (pr.returning ? -1 : 1));
    }
}

function drawSparks(ctx: CanvasRenderingContext2D, s: FightState) {
    for (const sp of s.sparks) {
        const t = Math.max(0, sp.t) / (sp.big ? 12 : 8);
        if (sp.big) {
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + (1 - t) * 0.8;
                const r = 5 + (1 - t) * 12;
                line(ctx, sp.x, sp.y, sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r, i % 2 ? PAL.warn : PAL.white, 1.5);
            }
            circle(ctx, sp.x, sp.y, 3 + t * 4, PAL.white);
        } else {
            circle(ctx, sp.x, sp.y, 1.5 + t * 3, t > 0.5 ? PAL.white : PAL.warn);
        }
    }
}

function hpColor(pct: number) {
    return pct > 0.5 ? PAL.ok : pct > 0.25 ? PAL.warn : PAL.bad;
}

function drawHud(ctx: CanvasRenderingContext2D, s: FightState) {
    const BW = 118;
    // Player, top-left.
    text(ctx, 'YOU', 6, 3, { size: 6, color: PAL.dim });
    bar(ctx, 6, 11, BW, 8, s.p.hp / s.p.maxHp, hpColor(s.p.hp / s.p.maxHp));
    // Opponent, top-right — bar drains toward the outside edge.
    text(ctx, s.f.name.toUpperCase().slice(0, 22), W - 6, 3, { size: 6, color: PAL.dim, align: 'right' });
    bar(ctx, W - 6 - BW, 11, BW, 8, s.f.hp / s.f.maxHp, hpColor(s.f.hp / s.f.maxHp), PAL.panel, true);

    // Round pips.
    for (let i = 0; i < ROUNDS_TO_WIN; i++) {
        rect(ctx, 6 + i * 7, 22, 5, 5, s.wins > i ? PAL.legend : PAL.panel);
        outline(ctx, 6 + i * 7, 22, 5, 5, PAL.line);
        rect(ctx, W - 11 - i * 7, 22, 5, 5, s.losses > i ? PAL.legend : PAL.panel);
        outline(ctx, W - 11 - i * 7, 22, 5, 5, PAL.line);
    }

    // Clock.
    const secs = Math.ceil(s.roundClock);
    text(ctx, String(secs).padStart(2, '0'), W / 2, 4, {
        size: 15, bold: true, align: 'center',
        color: secs <= 10 ? PAL.bad : PAL.ink,
    });

    // Hype meter + the special prompt, so the input is discoverable.
    const full = s.p.hype >= 100;
    text(ctx, 'HYPE', 6, 31, { size: 5, color: PAL.faint });
    bar(ctx, 26, 31, 56, 4, s.p.hype / 100, full ? PAL.legend : PAL.accent2);
    if (full && Math.floor(s.elapsed * 4) % 2 === 0) {
        text(ctx, '▼ + PUNCH = UPPERCUT', 86, 30, { size: 6, color: PAL.legend });
    }

    // Weapon in hand + remaining uses.
    glyph(ctx, s.p.weapon.glyph, 11, 44, 10);
    const ammoTxt = s.p.ammo === Infinity ? '∞' : `x${Math.max(0, s.p.ammo)}`;
    text(ctx, `${s.p.weapon.short} ${ammoTxt}`, 19, 41, {
        size: 6, color: s.p.ammo === 0 ? PAL.bad : PAL.dim,
    });

    // Combo counter.
    if (s.combo.count > 1) {
        const x = s.combo.byPlayer ? 8 : W - 8;
        text(ctx, `${s.combo.count} HIT COMBO`, x, 54, {
            size: 8, bold: true, align: s.combo.byPlayer ? 'left' : 'right',
            color: s.combo.byPlayer ? PAL.accent : PAL.accent2,
        });
    }

    // Trash talk, from the mouth of a man who had one song.
    if (s.talk) {
        const tw = s.talk.text.length * 3.5 + 10;
        const bx = Math.min(W - 6 - tw, 168);
        rect(ctx, bx, 84, tw, 14, 'rgba(7,9,12,0.85)');
        outline(ctx, bx, 84, tw, 14, PAL.accent2);
        text(ctx, s.talk.text, bx + 5, 88, { size: 6, color: PAL.ink });
        rect(ctx, bx + tw - 14, 98, 4, 4, PAL.accent2);
    }

    if (s.banner) {
        const size = s.banner.text.length > 14 ? 15 : 22;
        banner(ctx, s.banner.text, W, 70, s.banner.color, size);
    }
}

/** Draw one frame of the fight. Reads state, mutates nothing. */
export function renderFight(ctx: CanvasRenderingContext2D, s: FightState) {
    clear(ctx, W, H, PAL.void);
    ctx.save();
    // Screen shake moves the world but never the HUD — shaking the health bars
    // reads as a bug rather than as impact.
    const [sx, sy] = shakeOffset(s.shake);
    ctx.translate(sx, sy);
    drawBackdrop(ctx, s);
    // Back fighter first so the front one overlaps correctly.
    const order = s.p.x <= s.f.x ? [s.f, s.p] : [s.p, s.f];
    drawFighter(ctx, s, order[0]);
    drawFighter(ctx, s, order[1]);
    drawProjectiles(ctx, s);
    drawSparks(ctx, s);
    ctx.restore();
    drawHud(ctx, s);
}

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

const RESULT_WIN = [
    'jogs off holding his ribs, still talking. Somebody films it. Of course they do.',
    'concedes the shoelace. He says it was never about the shoelace.',
    'asks if you want to be on the mixtape. You are already on the mixtape.',
];
const RESULT_LOSS = [
    'stands over you explaining his release schedule. Your phone is fine. Your pride is not.',
    'takes the sandwich. Half the sandwich. He only ever wanted half.',
    'helps you up, then takes your shoelace anyway.',
];

/**
 * Street Fighter — best of 3, 60 second rounds, one-on-one in the AM/PM lot.
 *
 * All per-frame state lives in `fight` (a ref). React state is only the two
 * things that change rarely: which AM/PM weapon is selected, and whether the
 * match is over. Re-rendering React at 60Hz would stall the frame, so the
 * canvas is the only thing that updates during play.
 */
const StreetFighter: React.FC<{
    opponent?: string;
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ opponent = 'Some Guy', onFinish, onQuit }) => {
    const { gameState } = useGame();
    const { player } = gameState;

    // Everything the player is carrying that works in a brawl, fists first so
    // there is always something on the rail to switch back to.
    const loadout = useMemo(
        () => [FISTS, ...armsFor(player, 'street-brawl')],
        [player.storage],
    );
    const [weaponId, setWeaponId] = useState(FISTS.id);
    const weapon = loadout.find(w => w.id === weaponId) ?? FISTS;

    const fight = useRef<FightState | null>(null);
    if (!fight.current) {
        fight.current = createFight({
            opponent,
            weapon,
            // Health carries in: showing up at 30hp means a shorter round 1.
            playerHp: Math.round(72 + player.health * 0.38),
            foeHp: 100,
            // Street cred is a modest real edge, exactly as the text version did.
            credEdge: Math.min(0.2, player.streetCred / 1000),
        });
    }

    const { input, set, consume } = useInput(true);
    const [done, setDone] = useState<boolean | null>(null);
    const settled = useRef(false);   // guards the single setState at match end
    const finished = useRef(false);  // guards onFinish against double-firing

    const selectWeapon = useCallback((id: string) => {
        const w = loadout.find(x => x.id === id) ?? FISTS;
        setWeaponId(w.id);
        if (fight.current) setPlayerWeapon(fight.current, w);
    }, [loadout]);

    const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
        const s = fight.current!;
        const i = input.current;
        // Edge-triggered buttons are consumed every frame so a press fires once
        // even if several simulation steps run inside one animation frame.
        const cmd: FightInput = {
            left: i.left, right: i.right, up: i.up, down: i.down, a: i.a, b: i.b,
            aPressed: consume('a'), bPressed: consume('b'), upPressed: consume('up'),
        };
        stepFight(s, cmd, dt);
        renderFight(ctx, s);

        if (s.phase === 'over' && s.phaseT <= 0 && !settled.current) {
            settled.current = true;
            setDone(!!s.matchWon);
        }
    }, [input, consume]);

    const onInput = useCallback((btn: Btn, down: boolean) => set(btn, down), [set]);

    const s = fight.current;
    const won = done === true;
    // Picked once and kept in a ref so a re-render cannot reshuffle the end card.
    const flavorIdx = useRef(Math.floor(Math.random() * 3));
    const flavor = (won ? RESULT_WIN : RESULT_LOSS)[flavorIdx.current];

    const heavyLabel = weapon.klass === 'thrown' ? 'Throw' : weapon.id === FISTS.id ? 'Kick' : weapon.short;

    return (
        <ArcadeShell
            title={`Street Fight — ${opponent}`}
            subtitle={weapon.id === FISTS.id ? 'Best of 3 · 60s rounds' : `Best of 3 · armed with a ${weapon.short.toLowerCase()}`}
            width={W}
            height={H}
            running={done === null}
            onFrame={onFrame}
            onInput={onInput}
            actions={['Punch', heavyLabel]}
            vertical
            onQuit={done === null ? onQuit : undefined}
            quitLabel="Run Away"
            loadout={loadout}
            selectedWeapon={weaponId}
            onSelectWeapon={selectWeapon}
            help={
                '◀ ▶ walk · double-tap FORWARD to dash in · ▲ jump · ▼ crouch · hold BACK (away from him) to block — ' +
                'standing block stops highs, crouch block stops lows. ' +
                'PUNCH is fast and combos into itself; ' + heavyLabel.toUpperCase() + ' is slow, long and hurts. ' +
                '▼ + ' + heavyLabel.toUpperCase() + ' sweeps low (goes under a standing block); jump + PUNCH comes down over a crouch block. ' +
                'Fill the HYPE bar then ▼ + PUNCH for the Shoelace Uppercut. Thrown AM/PM weapons use the ' + heavyLabel.toUpperCase() + ' button.'
            }
            overlay={done !== null && s ? (
                <MiniGameResult
                    won={won}
                    headline={won ? 'You Won The Fight' : 'You Got Dropped'}
                    detail={`${s.wins}–${s.losses}. ${opponent} ${flavor}`}
                    onClose={() => {
                        if (finished.current) return;
                        finished.current = true;
                        onFinish(
                            won,
                            won
                                ? `You beat ${opponent} ${s.wins}–${s.losses} in the AM/PM lot.`
                                : `${opponent} beat you ${s.losses}–${s.wins}. There is footage.`,
                        );
                    }}
                />
            ) : undefined}
        />
    );
};

export default StreetFighter;
