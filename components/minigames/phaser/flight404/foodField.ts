/**
 * The food, as a *field* rather than as individual pieces.
 *
 * `projectiles.ts` knows everything about one blob and one falafel and nothing
 * at all about the level they are in — deliberately, because that is what makes
 * a barrage runnable in a test with no scene loaded. The cost of that choice is
 * that somebody still has to own the plural: a live collection that is stepped
 * once a frame, resolves its own contacts against the furniture, and hands the
 * scene a flat list of things that happened so the scene can spend a sound, a
 * particle or a hit point on each one without knowing any physics.
 *
 * This is that owner. It holds arrays and a list of events; it holds no
 * kinematics of its own, because a second integrator is a second set of bugs.
 *
 * ## The one rule that matters
 *
 * `stepHummus` and `stepFalafel` **already own the floor**. They land on
 * `groundY` themselves, on purpose, so that "it eventually stops" stays a
 * property of the projectile rather than of the level. This module therefore
 * resolves contacts against **platforms and actors only**, and never hands a
 * floor contact back into `bounceFalafel`. Doing that once looks harmless and
 * produces food that bounces twice per landing, at twice the rate, with twice
 * the noise — a bug that reads as "the physics feels wrong" and takes an
 * afternoon to find. The guard for it is in `firstContact`, and there is a test
 * named after it.
 *
 * Nothing here imports Phaser or touches the DOM. Every function is pure, every
 * `rng` is the last parameter and defaults to `Math.random`, and every object
 * the field holds has a finite life, so a field stepped for long enough is
 * always empty at the end. That last claim is the only one a frame budget
 * actually depends on, so it is the one the tests hammer.
 */

import {
    launchHummus, throwFalafel, splat, bounceFalafel,
    stepHummus, stepFalafel, stepBowl, spillBowl, openBowl,
    hummusAlive, falafelAlive, bowlAlive, smearPatch, speedOf,
    bowlBlast, caughtInSpill, ringsOffTray, BOUNCE_FLOOR,
    type HummusState, type FalafelState, type BowlState,
    type FalafelSurface, type HummusContact,
} from './projectiles';
import { TILE, has, isFooting, type PlatformDef } from './terrain';
import { EXPLOSIONS } from './explosions';
import { FLOOR_Y } from './content';

// ---------------------------------------------------------------------------
// The level, as plain data
// ---------------------------------------------------------------------------

export interface Box { x: number; y: number; w: number; h: number }

/**
 * Everything the field needs to know about where it is, and nothing else.
 *
 * Plain data rather than a scene handle, so a level can be written down in a
 * test as an object literal. `targets` are the things food is allowed to hurt;
 * the player is separate because the scene reports damage to him differently.
 */
export interface FieldLevel {
    platforms: PlatformDef[];
    playerBox: Box;
    targets: { id: number; box: Box }[];
}

/** The id a blob wears while it is riding the player, so `stuckTo` still means something. */
export const PLAYER_ID = -1;

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------

/**
 * A patch of spilled hummus for the scene to paint with `SURFACE.hummus`
 * (`SOLID | SLIPPERY`). It expires, which is not a detail: a slick that never
 * goes away turns a ten-minute level into an ice rink by minute three, and the
 * player has no way to tell a fresh hazard from the residue of a fight he won
 * four rooms ago.
 */
export interface Slick { x: number; y: number; w: number; life: number }

export interface FoodField {
    hummus: HummusState[];
    falafel: FalafelState[];
    bowls: BowlState[];
    slicks: Slick[];
}

/** How long a slick stays slippery. */
export const SLICK_LIFE = 7;
/**
 * The most slicks a level may carry at once, oldest dropped first. The life
 * above bounds each one; this bounds how many a sustained fight can lay down
 * in the same corridor before the floor stops being a floor.
 */
export const MAX_SLICKS = 24;
/**
 * A hard ceiling on live food. Bowls spill hummus and spilled hummus can set
 * off more bowls, so the field can grow itself; without a cap that chain is
 * only bounded by how long the player is prepared to watch it.
 */
export const FIELD_CAP = 1500;
/** What a falafel does to whoever it rings off. Hummus does none: it marks. */
export const FALAFEL_DAMAGE = 4;
/** Contact slack, in pixels. One frame at speed is worth more than this. */
const SKIN = 2;

export const openField = (): FoodField => ({ hummus: [], falafel: [], bowls: [], slicks: [] });

/** Total live pieces, which is what `FIELD_CAP` is a cap on. */
export const fieldSize = (f: FoodField): number =>
    f.hummus.length + f.falafel.length + f.bowls.length;

export function addHummus(
    f: FoodField, fromX: number, fromY: number, toX: number, toY: number,
    size = 5, rng: () => number = Math.random,
): FoodField {
    if (fieldSize(f) >= FIELD_CAP) return f;
    return { ...f, hummus: [...f.hummus, launchHummus(fromX, fromY, toX, toY, size, undefined, rng)] };
}

export function addFalafel(
    f: FoodField, fromX: number, fromY: number, toX: number, toY: number,
    rng: () => number = Math.random,
): FoodField {
    if (fieldSize(f) >= FIELD_CAP) return f;
    return { ...f, falafel: [...f.falafel, throwFalafel(fromX, fromY, toX, toY, undefined, rng)] };
}

/**
 * A bowl going over. Bowls are not collided against anything: `stepBowl` rolls
 * one along a gradient the level hands it and breaks it when it stops or runs
 * out of time, and a bowl that also had to negotiate the furniture would need a
 * height, a footprint and a reason to care. It is a hazard for seven seconds.
 */
export function addBowl(
    f: FoodField, x: number, y: number, slope: number, size = 8, push = 0,
): FoodField {
    if (fieldSize(f) >= FIELD_CAP) return f;
    return { ...f, bowls: [...f.bowls, openBowl(x, y, slope, size, push)] };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * What happened this frame, in the order it happened.
 *
 * The scene reads this and spends sounds, sprites and hit points; it is not
 * expected to look inside the field at all. Keeping the vocabulary this small
 * is what stops the scene from growing physics opinions of its own.
 */
export type FoodEvent =
    | { kind: 'splut'; x: number; y: number }
    | { kind: 'boing' | 'clang'; x: number; y: number }
    | { kind: 'hit'; target: 'player' | number; damage: number; x: number; y: number }
    | { kind: 'slick'; x: number; y: number; w: number }
    | { kind: 'burst'; x: number; y: number; big: boolean };

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

/**
 * What a platform is made of, as far as a falafel is concerned.
 *
 * The bounciness of a thing is a property of the thing, so it is read off the
 * flags the level was authored with rather than guessed from the platform's
 * name, its size or the order it appears in the array. Precedence, highest
 * first, because a crate can also occlude and a counter can also be slippery:
 *
 *   axis `x`       whatever you meet edge-on behaves like a wall, whatever it
 *                  is made of. (`PlatformDef` has a top and no height, so the
 *                  field cannot currently produce one of these off a platform —
 *                  see the note in `firstContact`.)
 *   DESTRUCTIBLE   a stack of duty-free. Dead, dull, `crate`.
 *   OCCLUDES       the hung sheet metal you duck behind: a sign, and it rattles.
 *   everything else is a surface you stand on, so it is `floor` — including a
 *                  SLIPPERY one, because `RESTITUTION.floor` is already defined
 *                  as "aisle tiles, and whatever has already been spilled on
 *                  them". A falafel landing in hummus is the floor case.
 */
export function surfaceFor(p: PlatformDef, axis: 'x' | 'y'): FalafelSurface {
    if (axis === 'x') return 'wall';
    if (has(p.flags, TILE.DESTRUCTIBLE)) return 'crate';
    if (has(p.flags, TILE.OCCLUDES)) return 'sign';
    return 'floor';
}

/**
 * Does a blob that landed here leave a slick behind?
 *
 * Only surfaces somebody can stand on. A smear down a sign is a mark, not a
 * hazard, and a patch of hummus painted on something unwalkable is a promise
 * to the player that the game then fails to keep.
 */
const leavesSlick = (p: PlatformDef | null): boolean => p === null || isFooting(p);

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

type FieldContact =
    | { kind: 'platform'; p: PlatformDef; axis: 'y'; x: number; y: number }
    | { kind: 'actor'; id: 'player' | number; axis: 'x' | 'y'; x: number; y: number };

const inBox = (b: Box, x: number, y: number): boolean =>
    x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

/** Distance from a point to the nearest part of a box, for the blast check. */
const boxDistance = (b: Box, x: number, y: number): number => Math.hypot(
    Math.max(b.x - x, 0, x - (b.x + b.w)),
    Math.max(b.y - y, 0, y - (b.y + b.h)),
);

const actorsOf = (l: FieldLevel): { id: 'player' | number; box: Box }[] =>
    [{ id: 'player' as const, box: l.playerBox }, ...l.targets.map(t => ({ id: t.id, box: t.box }))];

/** Is there something to stand on right here? Used to un-stick settled food. */
const overFooting = (platforms: PlatformDef[], x: number, y: number): boolean =>
    platforms.some(p => isFooting(p) && Math.abs(p.y - y) <= SKIN && x >= p.x - SKIN && x <= p.x + p.w + SKIN);

/**
 * The first thing on the path from (x0,y0) to (x1,y1) that is this module's
 * business, or `null` if the frame belongs entirely to the stepper.
 *
 * **Do not add the floor to this function.** `stepHummus` and `stepFalafel`
 * resolve `groundY` themselves before they return, so the endpoint handed in
 * here is already clamped to the floor on a landing frame. Reporting a floor
 * contact from here would bounce the same falafel a second time off the same
 * tile in the same frame — the one bug this whole module is arranged to avoid.
 * The `p.y >= FLOOR_Y` filter below is that rule, written down: a platform
 * authored at or below floor level *is* the floor, and is not ours.
 *
 * Because every platform we do accept is strictly above the floor, a path that
 * crosses one crosses it before it could ever reach the floor — so taking the
 * platform and discarding the stepper's result is always the earlier of the two
 * contacts, and exactly one contact is resolved per frame either way.
 *
 * Actors are checked first: a man standing on a counter is hit before the
 * counter he is standing on, which is the order a player would predict.
 */
function firstContact(
    level: FieldLevel, x0: number, y0: number, x1: number, y1: number,
): FieldContact | null {
    // Sampled along the path rather than tested at its end, because a man is
    // about fourteen pixels wide and a falafel crosses six of them in a frame:
    // an endpoint-only test lets a fast throw pass clean through somebody at a
    // shallow angle, which reads as the collision being unreliable rather than
    // as the projectile being fast. Earliest sample wins, so the near edge of
    // the body is the one that gets hit.
    const steps = Math.min(16, Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3)));
    for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const px = x0 + (x1 - x0) * k;
        const py = y0 + (y1 - y0) * k;
        for (const a of actorsOf(level)) {
            if (!inBox(a.box, px, py)) continue;
            // Arriving from above and moving down means it landed on him; anything
            // else is a body blow, which sends it back the way it came.
            const axis: 'x' | 'y' = y1 > y0 && y0 <= a.box.y + SKIN ? 'y' : 'x';
            return { kind: 'actor', id: a.id, axis, x: px, y: axis === 'y' ? a.box.y : py };
        }
    }

    if (y1 < y0) return null;

    let best: FieldContact | null = null;
    for (const p of level.platforms) {
        // Not a surface, or it is the floor and therefore the stepper's.
        if (!isFooting(p) || p.y >= FLOOR_Y) continue;
        // It started below the top, so it is passing underneath. This test is
        // also the whole of the ONE_WAY rule: only downward crossings count, so
        // food rises through a seat back exactly the way the player does and
        // lands on it exactly the way the player does. Giving food the opposite
        // rule means a slick on a seat the player is standing on is impossible
        // to place, and a falafel stopping dead in mid-air under a seat.
        if (y0 > p.y + SKIN || y1 < p.y) continue;
        const t = y1 === y0 ? 1 : (p.y - y0) / (y1 - y0);
        const cx = x0 + (x1 - x0) * t;
        if (cx < p.x || cx > p.x + p.w) continue;
        // Falling, so the highest top crossed is the one met first.
        if (best === null || p.y < best.y) best = { kind: 'platform', p, axis: 'y', x: cx, y: p.y };
    }
    return best;
}

/** What `splat` should be told about a contact the field resolved. */
const hummusContact = (c: FieldContact): HummusContact =>
    c.kind === 'actor'
        ? { surface: 'npc', id: c.id === 'player' ? PLAYER_ID : c.id }
        : { surface: 'ground' };

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

/**
 * One frame of every piece of food in the level.
 *
 * Bowls go first, because a bowl that comes apart this frame should spray
 * hummus that the player sees on the same frame as the blast rather than on the
 * next one. Nothing else in here depends on order.
 */
export function stepField(
    f: FoodField, dt: number, level: FieldLevel, rng: () => number = Math.random,
): { field: FoodField; events: FoodEvent[] } {
    const events: FoodEvent[] = [];
    const hummus: HummusState[] = [];
    const falafel: FalafelState[] = [];
    const bowls: BowlState[] = [];
    /** Laid down this frame. Kept apart so the surviving ones stay in front of
     * them: the array is oldest-first, which is what makes the cap below drop
     * the stalest patch instead of the one that was just spilled. */
    const fresh: Slick[] = [];

    const slick = (x: number, y: number, w: number) => {
        fresh.push({ x, y, w, life: SLICK_LIFE });
        events.push({ kind: 'slick', x, y, w });
    };

    for (const b of f.bowls) {
        const r = stepBowl(b, dt);
        if (r.burst) {
            const kind = bowlBlast(r.state);
            events.push({ kind: 'burst', x: r.state.x, y: r.state.y, big: kind === 'big' });
            // Damage is `explosions.ts`'s job and nobody else's: a bowl goes off
            // through the same radial check as a crate, which is why a bowl that
            // takes out a crate that takes out a bowl needs no chain-reaction code.
            for (const a of actorsOf(level)) {
                if (caughtInSpill(r.state, boxDistance(a.box, r.state.x, r.state.y))) {
                    events.push({
                        kind: 'hit', target: a.id, damage: EXPLOSIONS[kind].damage,
                        x: r.state.x, y: r.state.y,
                    });
                }
            }
            for (const blob of spillBowl(r.state, rng)) {
                if (hummus.length + f.hummus.length < FIELD_CAP) hummus.push(blob);
            }
        } else if (bowlAlive(r.state)) {
            bowls.push(r.state);
        }
    }

    for (const h of f.hummus) {
        if (!hummusAlive(h)) continue;
        const r = stepHummus(h, dt, FLOOR_Y, rng);

        // Already a mark on the world: it has no path left to collide along.
        if (h.phase !== 'flight') {
            if (hummusAlive(r.state)) hummus.push(r.state);
            continue;
        }

        const c = firstContact(level, h.x, h.y, r.state.x, r.state.y);
        if (c) {
            const at = { ...h, x: c.x, y: c.y, life: Math.max(0, h.life - dt) };
            const blob = splat(at, hummusContact(c), rng);
            events.push({ kind: 'splut', x: c.x, y: c.y });
            if (c.kind === 'platform' && leavesSlick(c.p)) {
                const patch = smearPatch(blob);
                slick(patch.x, patch.y, patch.w);
            }
            if (hummusAlive(blob)) hummus.push(blob);
            continue;
        }

        // No platform and no actor, so whatever happened was the floor, and the
        // floor was resolved inside `stepHummus`. We only report it.
        if (r.sound === 'splut') {
            events.push({ kind: 'splut', x: r.state.x, y: r.state.y });
            const patch = smearPatch(r.state);
            slick(patch.x, patch.y, patch.w);
        }
        if (hummusAlive(r.state)) hummus.push(r.state);
    }

    for (const raw of f.falafel) {
        if (!falafelAlive(raw)) continue;
        // It came to rest on a platform and has since rolled off the end of it.
        // Letting it keep rolling along thin air for the rest of `SETTLE_LIFE`
        // is the one place a settled projectile can look broken, and un-settling
        // it costs nothing: it falls, meets the floor, and settles again with a
        // bounce count that is already at the cap.
        const fa = raw.settled && raw.y < FLOOR_Y - SKIN && !overFooting(level.platforms, raw.x, raw.y)
            ? { ...raw, settled: false }
            : raw;

        const r = stepFalafel(fa, dt, FLOOR_Y, rng);
        const c = fa.settled ? null : firstContact(level, fa.x, fa.y, r.state.x, r.state.y);

        if (c) {
            let surface: FalafelSurface = c.kind === 'actor' ? 'enemy' : surfaceFor(c.p, c.axis);
            // The shawarma guy's tray is hung sheet metal like every other sign
            // in the market, and once in a while a falafel finds it instead. Rare
            // on purpose: the gag is funny once a run and furniture by the fourth.
            if (surface === 'sign' && ringsOffTray(rng)) surface = 'tray';

            // The impact speed used here is the speed at the *start* of the frame
            // rather than after this frame's gravity. It is short by a fifth of a
            // pixel per second at 60Hz, and it is short in the safe direction: a
            // bounce computed from too little speed can only ever lose energy.
            const at = { ...fa, x: c.x, y: c.y, life: Math.max(0, fa.life - dt) };
            const b = bounceFalafel(at, { surface, axis: c.axis }, rng);
            if (b.sound) events.push({ kind: b.sound, x: c.x, y: c.y });
            if (c.kind === 'actor' && speedOf(fa) > BOUNCE_FLOOR) {
                events.push({ kind: 'hit', target: c.id, damage: FALAFEL_DAMAGE, x: c.x, y: c.y });
            }
            if (falafelAlive(b.state)) falafel.push(b.state);
            continue;
        }

        if (r.sound) events.push({ kind: r.sound, x: r.state.x, y: r.state.y });
        if (falafelAlive(r.state)) falafel.push(r.state);
    }

    const slicks: Slick[] = [];
    for (const s of f.slicks) {
        const life = s.life - dt;
        if (life > 0) slicks.push({ ...s, life });
    }
    slicks.push(...fresh);

    return {
        field: {
            hummus, falafel, bowls,
            slicks: slicks.length > MAX_SLICKS ? slicks.slice(slicks.length - MAX_SLICKS) : slicks,
        },
        events,
    };
}

/** Nothing left to step. The field always reaches this, given enough frames. */
export const fieldEmpty = (f: FoodField): boolean => fieldSize(f) === 0 && f.slicks.length === 0;
