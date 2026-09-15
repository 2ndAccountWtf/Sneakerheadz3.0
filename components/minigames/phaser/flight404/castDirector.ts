/**
 * The man with the clipboard.
 *
 * `cast.ts` is six pure state machines and nothing else. Each one is handed a
 * `CastCtx` and hands back one `CastAction`, and it has no idea where it is
 * standing, how much health it has left, or whether the thing it just decided
 * to do actually reached anybody. Somebody has to build that context out of the
 * world every frame, walk the actor across the floor, and turn "I would like to
 * throw a mannequin" into an event the scene can spend. That is this file.
 *
 * It is deliberately not the scene. Phaser owns sprites, bodies, sound and the
 * camera; this owns bookkeeping, and bookkeeping is where the design quietly
 * dies. Three ways it dies, all of them invisible in a screenshot:
 *
 *  - **Damage applied directly to `hp`.** `incomingDamage` is the only reason a
 *    dodged charge is worth dodging. A director that subtracts the raw number
 *    has deleted the Hypebeast's entire design and left the animation in place.
 *  - **Movement that ignores the beats.** If the Scalper keeps closing while he
 *    photographs, the two and a half seconds cost him nothing and the joke is a
 *    sticker on a mook.
 *  - **Steering a committed charge.** The whole enemy is "he cannot stop". The
 *    machine commits him; it is the director that would un-commit him, one
 *    innocent `toPlayer` lookup at a time.
 *
 * So all three are stated once, here, with the reasoning attached, and pinned
 * in `tests/flight404-director.test.mts`.
 *
 * Phaser-free and pure, like `cast.ts`, `spawners.ts` and `background.ts`: the
 * whole roster can be run for ten simulated minutes in node. `rng` is last and
 * defaults to `Math.random`.
 */

import {
    CAST, CONTACT_RANGE, GRAB_RANGE, HYPEBEAST_BARKS,
    distracted, incomingDamage, openCast, stepCast, stolen,
    type CastCtx, type CastKind, type CastState, type StockItem,
} from './cast';
import { FLOOR_Y, SEAT_PITCH } from './content';
import { CREEP, type Creep } from './creep';
import type { DropKind } from './props';

/** One actor on the floor: a machine from `cast.ts`, plus everything it cannot know about itself. */
export interface Member {
    id: number;
    state: CastState;
    x: number;
    y: number;
    hp: number;
    /** Which way it is pointing. Locked for the duration of a Hypebeast charge. */
    facing: -1 | 1;
}

/**
 * What the scene tells the director. Plain data on purpose — same discipline as
 * `CastCtx` one layer down, for the same reason: anything the director is
 * allowed to know has to arrive through here, or the tests are simulating a
 * different game than the one that ships.
 */
export interface World {
    playerX: number;
    playerY: number;
    loot: { x: number; y: number }[];
    legendaryDropped: boolean;
    /** Damage dealt to members since the last step. Raw numbers; see `hurtFor`. */
    damage: { id: number; amount: number }[];
    /** Ids whose stand or counter was hit this frame. */
    bumps: number[];
    messy: boolean;
    /**
     * A donkey is walking past. It is passed straight through to `CastCtx` and
     * nothing downstream reads it — see the note on `CastCtx.donkey`. It is here
     * so the scene has somewhere honest to put the fact, not so the director can
     * find a use for it: the Mall Security guard reading his radio script over
     * the top of the livestock is the joke, and the first person to make him
     * notice has written a cutscene.
     */
    donkey?: boolean;
}

/** What the scene is asked to spend this frame. */
export type Effect =
    | { kind: 'throw'; from: number; item: StockItem; x: number; y: number; toX: number; toY: number; bark: string }
    | { kind: 'hurtPlayer'; from: number; amount: number }
    | { kind: 'takeLoot'; from: number; lootIndex: number }
    | { kind: 'dropLoot'; from: number; x: number; y: number; count: number }
    | { kind: 'stolen'; from: number; count: number }
    | { kind: 'spill'; from: number; x: number; y: number }
    | { kind: 'say'; from: number; text: string }
    | { kind: 'died'; from: number; drop: DropKind; x: number; y: number };

/**
 * A charge covers ground, or the wind-up was not a dodge window, it was a
 * warning about a man jogging at you. The multiplier lives here rather than in
 * `CAST` because it is a property of one phase, not of the enemy.
 */
export const CHARGE_MULT = 1.75;

/**
 * What share of the background's crowding the cast is allowed to be.
 *
 * Deriving it from `CREEP[c].density` rather than authoring a second table is
 * the point: the cabin getting busier and the cabin getting more dangerous are
 * the same dial, so a tier cannot end up crowded and empty at the same time.
 * The share is well under one because a background actor is scenery and a cast
 * member is a fight.
 */
export const CAST_SHARE = 0.3;

export const castBudget = (creep: Creep, length: number): number =>
    Math.max(1, Math.round((length / 100) * CREEP[creep].density * CAST_SHARE));

/**
 * Who is allowed to exist at each tier, and in what order they are laid down.
 *
 * Same rule as `CREEP.admits`: a donkey in Economy spends the joke before it is
 * set up, and so does a man selling falafel in row 32. The plane tier gets the
 * two who read as ordinary mall staff; the Hypebeast and the Falafel Guy only
 * turn up once the cabin has stopped pretending. Round-robin rather than random
 * because a wave you can learn is funnier than one you cannot.
 */
export const ROSTER: Record<Creep, CastKind[]> = {
    plane: ['scalper', 'security'],
    wrong: ['scalper', 'security', 'reseller', 'shopOwner'],
    shuk: ['scalper', 'hypebeast', 'shopOwner', 'reseller', 'security', 'falafelGuy'],
    bedlam: ['hypebeast', 'scalper', 'shopOwner', 'security', 'reseller', 'falafelGuy'],
};

const pick = (list: readonly string[], rng: () => number): string =>
    list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Ids are section-local and start at zero; the scene offsets them when it
 * stitches sections together, because `World.damage` and `World.bumps` address
 * members by id and two sections numbering from zero would cross wires.
 */
export function openRoster(creep: Creep, length: number, rng: () => number = Math.random): Member[] {
    const roster = ROSTER[creep];
    const n = castBudget(creep, length);
    const gap = length / (n + 1);
    const out: Member[] = [];
    for (let i = 0; i < n; i++) {
        const kind = roster[i % roster.length];
        // Spread evenly and then nudged by up to half a seat row, so a section
        // is memorisable without looking like a shelf of identical mooks.
        const x = clamp(gap * (i + 1) + (rng() - 0.5) * SEAT_PITCH, 0, length);
        out.push({ id: i, state: openCast(kind, rng), x, y: FLOOR_Y, hp: CAST[kind].hp, facing: -1 });
    }
    return out;
}

/** Total damage addressed to one member this frame, before any multiplier. */
const rawFor = (id: number, damage: World['damage']): number => {
    let sum = 0;
    for (const d of damage) if (d.id === id) sum += d.amount;
    return sum;
};

/**
 * The only place health is ever reduced, and it goes through `incomingDamage`.
 *
 * A stunned Hypebeast takes double. That is not a bonus, it is the payment for
 * dodging — the charge is free otherwise, and an enemy whose telegraph you can
 * safely ignore is an enemy with no telegraph. Every other kind has no
 * multiplier today, which is exactly why the call has to be unconditional
 * rather than a special case somebody deletes while tidying.
 */
const takeDamage = (state: CastState, raw: number): number =>
    state.kind === 'hypebeast' ? incomingDamage(state, raw) : raw;

/** Nearest piece of loot, and how far. `index` is -1 when the floor is clean. */
const nearestLoot = (m: Member, loot: World['loot']): { index: number; dist: number } => {
    let index = -1;
    let dist = Infinity;
    for (let i = 0; i < loot.length; i++) {
        const d = Math.hypot(loot[i].x - m.x, loot[i].y - m.y);
        if (d < dist) { index = i; dist = d; }
    }
    return { index, dist };
};

/**
 * One frame for the whole floor.
 *
 * Damage is settled before anything is stepped, because the state a shot landed
 * against is the state that was on screen when the player pulled the trigger —
 * settling it afterwards means a Hypebeast who got up this frame was never
 * actually vulnerable, and the player's read of the fight and the game's
 * disagree by one frame forever.
 */
export function stepDirector(
    members: Member[], dt: number, world: World, rng: () => number = Math.random,
): { members: Member[]; effects: Effect[] } {
    const out: Member[] = [];
    const effects: Effect[] = [];
    // A pair on the floor can only be picked up by one person, however many
    // machines decided to stoop for it on the same frame.
    const claimed = new Set<number>();
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;

    for (const m of members) {
        const raw = rawFor(m.id, world.damage);
        const hp = m.hp - (raw > 0 ? takeDamage(m.state, raw) : 0);

        if (hp <= 0) {
            // `died` is emitted here and the member is not copied into `out`, so
            // it cannot fire twice however much overkill arrived: all of one
            // frame's damage is summed above, and there is no member left for
            // the next frame to kill again.
            if (m.state.kind === 'reseller' && m.state.held > 0 && !stolen(m.state)) {
                // cast.ts's rule is that *any* damage shakes the bag loose. Dying
                // is damage; the bag does not go in the ground with him.
                //
                // Unless he has already left, which is why `stolen` is checked:
                // `held` survives on a `gone` reseller as the record of what he
                // walked off with, not as a bag still on his back. Shooting the
                // space where he was standing would otherwise hand the player
                // back loot the game has already told them is gone for good.
                effects.push({ kind: 'dropLoot', from: m.id, x: m.x, y: m.y, count: m.state.held });
            }
            effects.push({ kind: 'died', from: m.id, drop: CAST[m.state.kind].drop, x: m.x, y: m.y });
            continue;
        }

        const dx = world.playerX - m.x;
        const near = nearestLoot(m, world.loot);
        const toPlayer: -1 | 0 | 1 = dx < 0 ? -1 : dx > 0 ? 1 : 0;
        const ctx: CastCtx = {
            dist: Math.hypot(dx, world.playerY - m.y),
            toPlayer,
            loot: world.loot.length,
            lootDist: near.dist,
            legendary: world.legendaryDropped,
            hurt: raw > 0,
            bumped: world.bumps.includes(m.id),
            messy: world.messy,
            donkey: world.donkey,
        };

        const { state, action } = stepCast(m.state, step, ctx, rng);

        // ------------------------------------------------------------------
        // Where it ends up
        // ------------------------------------------------------------------
        const def = CAST[state.kind];
        const charging = state.kind === 'hypebeast' && state.phase === 'charge';
        let facing = m.facing;
        let dir: -1 | 0 | 1 = 0;
        let speed = def.speed;

        if (charging) {
            // The direction is read once, on the frame he commits, and then it
            // is simply his facing until he hits something. Consulting
            // `toPlayer` again anywhere below would hand him steering, and a
            // Hypebeast who can correct mid-charge never crashes, never gets
            // stunned, and is a mook with a wind-up animation.
            if (action?.type === 'charge' && toPlayer !== 0) facing = toPlayer;
            dir = facing;
            speed *= CHARGE_MULT;
        } else if (distracted(state)) {
            // The beats have to cost ground. A Scalper who keeps closing while
            // he photographs, or a guard who patrols through his own radio call,
            // is an enemy playing an animation over business as usual — and the
            // player has been given a window that is not one.
            //
            // This sits above the Reseller because his stoop is a beat like any
            // other: a man who bags a pair without breaking stride is not
            // catchable, and catching him is the entire point of him.
            dir = 0;
        } else if (state.kind === 'reseller') {
            // Everyone else is chasing the player. He is not — he is here for
            // what is on the floor, and once he has it he is leaving. That is
            // why he is the fastest thing in the level and why he is the only
            // one who can cost you something permanently.
            dir = stolen(state) ? 0
                : state.phase === 'flee' || state.held > 0 ? (toPlayer === 0 ? m.facing : (-toPlayer as -1 | 1))
                : near.index >= 0 ? (near.dist < 0.5 ? 0 : world.loot[near.index].x < m.x ? -1 : 1)
                : (toPlayer === 0 ? m.facing : (-toPlayer as -1 | 1));
        } else if (ctx.dist > CONTACT_RANGE) {
            // He stops when he is on top of you rather than walking through you;
            // the last few pixels are the scene's collision, not the AI's.
            dir = toPlayer;
        }

        if (!charging && dir !== 0) facing = dir;
        const x = m.x + dir * speed * step;

        // ------------------------------------------------------------------
        // What the scene is told
        // ------------------------------------------------------------------
        const say = (text: string) => effects.push({ kind: 'say', from: m.id, text });
        const lift = () => {
            if (near.index < 0 || near.dist > GRAB_RANGE || claimed.has(near.index)) return;
            claimed.add(near.index);
            effects.push({ kind: 'takeLoot', from: m.id, lootIndex: near.index });
        };

        if (action) {
            switch (action.type) {
                case 'attack':
                    // Gated on the definition, not on the kind. The Falafel Guy
                    // and the Reseller are `hostile: false`, so no route exists
                    // from either of them to the player's health bar — the
                    // caterer stays incapable of hurting anybody even if
                    // somebody one day teaches his machine to swing.
                    if (def.hostile) effects.push({ kind: 'hurtPlayer', from: m.id, amount: action.damage });
                    break;
                case 'throw':
                    if (def.hostile) {
                        effects.push({
                            kind: 'throw', from: m.id, item: action.item,
                            x: m.x, y: m.y, toX: world.playerX, toY: world.playerY, bark: action.bark,
                        });
                    }
                    break;
                case 'charge': say(pick(HYPEBEAST_BARKS, rng)); break;
                case 'grab': lift(); break;
                case 'bag': lift(); break;
                case 'drop':
                    effects.push({ kind: 'dropLoot', from: m.id, x: m.x, y: m.y, count: action.freed });
                    break;
                case 'steal':
                    // Authoritative: once this is on the wire the pairs are gone
                    // and no later frame gives them back. He stops moving and
                    // never acts again, and the scene despawns him on this —
                    // the director will not quietly delete an actor, because
                    // `died` is the only removal it ever reports.
                    effects.push({ kind: 'stolen', from: m.id, count: action.taken });
                    say(action.bark);
                    break;
                case 'spill':
                    effects.push({ kind: 'spill', from: m.id, x: m.x, y: m.y });
                    say(action.bark);
                    break;
                case 'photograph': say(action.bark); break;
                case 'radio': say(action.line); break;
                case 'tidy': say(action.bark); break;
                case 'stunned': say(action.bark); break;
            }
        }

        out.push({ id: m.id, state, x, y: m.y, hp, facing });
    }

    return { members: out, effects };
}
