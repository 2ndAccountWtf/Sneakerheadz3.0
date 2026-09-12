import React, { useCallback, useMemo, useRef, useState } from 'react';
import { MiniGameResult } from './MiniGameShell';
import { ArcadeShell, useInput, PAL, KIT, clear, rect, outline, circle, line, text, glyph, shadow, bar, figure, band, shakeOffset, banner } from './engine';
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
        damage: 6, reach: 22, height: 'mid',
        knock: 46, hitstun: 12, hitstop: 3, shake: 1, chip: 0.18, cancel: 13,
    },
    // Slow, long, hurts. Whiffing it is a decision you regret.
    heavy: {
        label: 'Kick', startup: 9, active: 4, recovery: 15,
        damage: 13, reach: 33, height: 'mid',
        knock: 132, hitstun: 19, hitstop: 6, shake: 4, chip: 0.16, cancel: 0,
    },
    // Low: goes UNDER a standing block. Knocks down, so it never combos.
    sweep: {
        label: 'Sweep', startup: 8, active: 4, recovery: 18,
        damage: 10, reach: 30, height: 'low',
        knock: 90, hitstun: 24, hitstop: 5, shake: 3, chip: 0.14, cancel: 0,
        knockdown: true,
    },
    // Overhead: goes OVER a crouch block. The answer to a turtle.
    air: {
        label: 'Air Stomp', startup: 4, active: 9, recovery: 6,
        damage: 9, reach: 22, height: 'overhead',
        knock: 70, hitstun: 16, hitstop: 4, shake: 2, chip: 0.2, cancel: 11, air: true,
    },
    // The special. Costs the whole hype meter, launches, gets a banner.
    special: {
        label: 'Shoelace Uppercut', startup: 5, active: 7, recovery: 22,
        damage: 24, reach: 28, height: 'mid',
        knock: 170, hitstun: 30, hitstop: 10, shake: 7, chip: 0.28, cancel: 0,
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
            knock: 120 + dmg * 3,
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
    /** Diagnostics the test script leans on. */
    stats: { hitsBlocked: number; hitsLanded: number; throwsMade: number };
}

export interface AiBrain {
    /** What it is trying to do right now. */
    plan: 'neutral' | 'approach' | 'retreat' | 'block' | 'attack' | 'taunt' | 'jump';
    /** Frames until it is allowed to re-decide. */
    think: number;
    /** Committed attack for this decision, if any. */
    queued: MoveId | null;
    /** 0..1, climbs as its health drops. Drives how often it commits. */
    aggr: number;
    /** Frames of reaction delay left before it can respond to what it sees. */
    react: number;
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
        ai: { plan: 'approach', think: 20, queued: null, aggr: 0.35, react: 0 },
        stats: { hitsBlocked: 0, hitsLanded: 0, throwsMade: 0 },
    };
    return s;
}

/** Swap the player's AM/PM weapon mid-fight (the rail above the D-pad). */
export function setPlayerWeapon(s: FightState, weapon: Weapon) {
    if (s.p.weapon.id === weapon.id) return;
    s.p.weapon = weapon;
    s.p.moves = movesFor(weapon);
    s.p.ammo = weapon.uses ?? Infinity;
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
    // Vertical band by attack height — this is what block height is checked against.
    const topByHeight =
        m.height === 'low' ? f.y - 12 :
        m.height === 'overhead' ? f.y - 42 :
        f.y - 27;
    const hByHeight = m.height === 'low' ? 11 : m.height === 'overhead' ? 17 : 15;
    return { x, y: topByHeight, w: m.reach, h: hByHeight };
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
    s.combo.t = m.knockdown ? 0 : 48;
    if (m.knockdown) s.combo.count = s.combo.count; // string is over, count stays for display

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
    if (!m.air) { f.vx = 0; }
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

    const locked = f.state === 'hitstun' || f.state === 'down' || f.blockstun > 0;

    // --- intent from input ---
    const toward = other.x >= f.x ? 1 : -1;
    const wantBack = (toward === 1 && cmd.left) || (toward === -1 && cmd.right);
    const wantFwd = (toward === 1 && cmd.right) || (toward === -1 && cmd.left);

    // Blocking is "hold back": no dedicated button, so it works with the
    // on-screen D-pad on a phone with a single thumb.
    f.blockHeld = !locked && !airborne && f.state !== 'attack' && wantBack;
    if (!locked && f.state !== 'attack') f.crouch = !airborne && cmd.down;

    if (!locked) {
        // --- attacks ---
        if (cmd.aPressed) {
            // Down + A with a full meter is the special. One thumb on the pad,
            // one on the button — the only "motion" input a phone can do well.
            if (cmd.down && f.hype >= 100 && !airborne) startAttack(s, f, 'special');
            else if (airborne) startAttack(s, f, 'air');
            else startAttack(s, f, 'jab');
        }
        if (cmd.bPressed) {
            if (airborne) startAttack(s, f, 'air');
            else if (cmd.down) startAttack(s, f, 'sweep');
            else if (f.weapon.klass === 'thrown' && f.ammo > 0) startAttack(s, f, 'toss');
            else startAttack(s, f, 'heavy');
        }

        // --- movement ---
        if (f.state !== 'attack') {
            if (!airborne && cmd.upPressed && !f.crouch) {
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
                f.vx = toward * 58 * (f.slow > 0 ? 0.5 : 1);
                f.state = 'walk';
            } else if (wantBack) {
                // Walking back is slower, which is what makes cornering work.
                f.vx = -toward * 46 * (f.slow > 0 ? 0.5 : 1);
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
