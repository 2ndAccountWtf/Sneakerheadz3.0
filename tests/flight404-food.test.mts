/**
 * The food field, checked as a system rather than as a pile of pieces.
 *
 * `flight404-projectiles.test.mts` already proves that one blob stops and one
 * falafel stops rattling. None of that survives contact with a level unless
 * three further claims hold, and all three are the kind that look fine on
 * screen for a week and then ruin a frame budget:
 *
 *   the floor is owned once   `stepFalafel` lands on the floor itself. If the
 *                             field also reports the floor, every landing is
 *                             two bounces at twice the volume, and the level
 *                             file is allowed to make that happen simply by
 *                             authoring the aisle as a platform. So the aisle
 *                             *is* authored as a platform in the level below,
 *                             and the test compares the field frame-for-frame
 *                             against the bare stepper.
 *   surfaces come from flags  a crate and a sign are different because the
 *                             level says so, not because someone remembered.
 *   everything terminates     five hundred pieces into a real cabin, stepped
 *                             until the field is empty, with no coordinate ever
 *                             leaving the number line.
 */
import assert from 'node:assert/strict';
import {
    openField, addHummus, addFalafel, addBowl, stepField, fieldSize, fieldEmpty,
    surfaceFor, PLAYER_ID, SLICK_LIFE, MAX_SLICKS, FIELD_CAP, FALAFEL_DAMAGE,
    type FoodField, type FoodEvent, type FieldLevel,
} from '../components/minigames/phaser/flight404/foodField.ts';
import {
    throwFalafel, stepFalafel, bounceFalafel, falafelAlive, speedOf,
    RESTITUTION, MAX_BOUNCES, BOUNCE_FLOOR, HUMMUS_FUSE, SMEAR_LIFE, BIG_BOWL,
    type FalafelState, type FalafelSurface,
} from '../components/minigames/phaser/flight404/projectiles.ts';
import { TILE, SURFACE, TIER, type PlatformDef } from '../components/minigames/phaser/flight404/terrain.ts';
import { EXPLOSIONS } from '../components/minigames/phaser/flight404/explosions.ts';
import { FLOOR_Y, PLAYER_H } from '../components/minigames/phaser/flight404/content.ts';
import { rngFor } from '../utils/rng.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const DT = 1 / 60;
/** A minute. Anything still in the field after this is a leak, not a projectile. */
const FOREVER = 60 * 60;

/** Nobody within a hundred pixels, so a test about furniture is about furniture. */
const NOBODY: Pick<FieldLevel, 'playerBox' | 'targets'> = {
    playerBox: { x: 5000, y: FLOOR_Y - PLAYER_H, w: 14, h: PLAYER_H },
    targets: [],
};

/**
 * The aisle, authored as a platform.
 *
 * This is the trap, and it is in every level a designer would plausibly write:
 * the floor is a surface, so of course it ends up in the platform list. The
 * field has to notice that a platform at floor level is the floor and leave it
 * to the stepper. Take that guard out and the very next test fails.
 */
const AISLE: PlatformDef = { x: -200, y: FLOOR_Y, w: 1200, flags: SURFACE.counter };

/** A cabin with one of everything in it, so nothing is tested in a vacuum. */
const cabin = (): FieldLevel => ({
    platforms: [
        AISLE,
        { x: 40, y: TIER.seat, w: 70, flags: SURFACE.seat },
        { x: 140, y: TIER.counter, w: 80, flags: SURFACE.counter },
        { x: 250, y: TIER.seatback, w: 60, flags: SURFACE.crate },
        { x: 340, y: TIER.bin, w: 90, flags: SURFACE.bin },
        { x: 450, y: TIER.counter, w: 70, flags: SURFACE.hummus },
        { x: 540, y: TIER.seatback, w: 50, flags: TILE.SOLID | TILE.OCCLUDES },
        { x: 620, y: TIER.seat, w: 60, flags: SURFACE.beltFwd },
    ],
    playerBox: { x: 300, y: FLOOR_Y - PLAYER_H, w: 14, h: PLAYER_H },
    targets: [
        { id: 1, box: { x: 160, y: TIER.counter - 26, w: 14, h: 26 } },
        { id: 2, box: { x: 500, y: FLOOR_Y - 26, w: 14, h: 26 } },
    ],
});

const CRATE: PlatformDef = { x: 250, y: TIER.seatback, w: 60, flags: SURFACE.crate };
const SIGN: PlatformDef = { x: 250, y: TIER.seatback, w: 60, flags: TILE.SOLID | TILE.OCCLUDES };

/** Steps a field to exhaustion and keeps everything worth asserting about. */
function drain(f: FoodField, level: FieldLevel, rng: () => number, cap = FOREVER) {
    const events: FoodEvent[] = [];
    const perFrameBoings: number[] = [];
    let frames = 0, worst = 0;
    while (!fieldEmpty(f) && frames < cap) {
        const r = stepField(f, DT, level, rng);
        let boings = 0;
        for (const e of r.events) {
            events.push(e);
            if (e.kind === 'boing' || e.kind === 'clang') boings++;
        }
        perFrameBoings.push(boings);
        worst = Math.max(worst, fieldSize(r.field));
        for (const o of [...r.field.hummus, ...r.field.falafel, ...r.field.bowls]) {
            assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y),
                `a piece of food left the number line at (${o.x}, ${o.y}) on frame ${frames}`);
        }
        f = r.field;
        frames++;
    }
    return { field: f, events, frames, perFrameBoings, worst };
}

const countKind = (events: FoodEvent[], kind: FoodEvent['kind']): number =>
    events.filter(e => e.kind === kind).length;

console.log('\nthe floor, which belongs to the stepper and to nobody else');

t('a falafel landing on the plain floor bounces exactly once, not twice', () => {
    // The whole reason this module exists in the shape it does. `stepFalafel`
    // resolves `groundY` before it returns, so a field that also resolves the
    // floor doubles every landing — and because the aisle is in the platform
    // list, only the "a platform at floor level is the floor" guard prevents it.
    const level: FieldLevel = { platforms: [AISLE], ...NOBODY };

    let bare = throwFalafel(0, 60, 190, FLOOR_Y, undefined, rngFor('drop'));
    const bareRng = rngFor('step');
    const bareBounce: { x: number; y: number }[] = [];
    while (falafelAlive(bare)) {
        const s = stepFalafel(bare, DT, FLOOR_Y, bareRng);
        if (s.sound) bareBounce.push({ x: s.state.x, y: s.state.y });
        bare = s.state;
    }

    const r = drain(addFalafel(openField(), 0, 60, 190, FLOOR_Y, rngFor('drop')), level, rngFor('step'));
    const fieldBounce = r.events.filter(e => e.kind === 'boing' || e.kind === 'clang');

    assert.ok(bareBounce.length >= 2,
        `the bare stepper only bounced ${bareBounce.length} times — the fixture is not testing anything`);
    // Two ways to get this wrong, so two assertions. Resolving the floor *as
    // well as* the stepper doubles the count and puts two bounces in one frame.
    assert.equal(fieldBounce.length, bareBounce.length,
        `the field reported ${fieldBounce.length} bounces where the stepper alone reported ${bareBounce.length}`);
    assert.ok(Math.max(...r.perFrameBoings) <= 1,
        'two bounces in a single frame: the field is resolving the floor as well as the stepper');
    // Resolving it *instead of* the stepper keeps the count and quietly moves
    // the projectile, because the field bounces off the contact point with the
    // speed it had at the top of the frame. Same food, different landing.
    assert.deepEqual(
        fieldBounce.map(e => `${e.x.toFixed(6)},${e.y.toFixed(6)}`),
        bareBounce.map(e => `${e.x.toFixed(6)},${e.y.toFixed(6)}`),
        'the field bounced it somewhere the stepper did not — it has taken the floor off the stepper',
    );
    assert.ok(fieldBounce.length <= MAX_BOUNCES, `${fieldBounce.length} bounces, over the cap of ${MAX_BOUNCES}`);
});

t('an empty level and no level at all are the same level', () => {
    // Stated as a whole trajectory rather than a bounce count: with nothing but
    // the floor under it, the field must not perturb the projectile by so much
    // as a rounding error, because everything it could add would be a second
    // opinion about the floor.
    let bare = throwFalafel(10, 40, 260, FLOOR_Y, undefined, rngFor('twin'));
    const bareRng = rngFor('twin-step');
    while (falafelAlive(bare)) bare = stepFalafel(bare, DT, FLOOR_Y, bareRng).state;

    const level: FieldLevel = { platforms: [AISLE], ...NOBODY };
    let f = addFalafel(openField(), 10, 40, 260, FLOOR_Y, rngFor('twin'));
    const rng = rngFor('twin-step');
    let last: FalafelState | null = null;
    while (f.falafel.length > 0) {
        last = f.falafel[0];
        f = stepField(f, DT, level, rng).field;
    }
    assert.ok(last !== null);
    assert.ok(Math.abs(last.x - bare.x) < 1e-9,
        `the field put it at x=${last.x.toFixed(4)}, the stepper at x=${bare.x.toFixed(4)}`);
    assert.equal(last.bounces, bare.bounces, 'the field spent a different number of bounces');
});

console.log('\nsurfaces, which come off the flags the level was authored with');

t('a crate and a sign are different because the flags say so', () => {
    assert.equal(surfaceFor(CRATE, 'y'), 'crate', 'a DESTRUCTIBLE stack is not a crate');
    assert.equal(surfaceFor(SIGN, 'y'), 'sign', 'hung sheet metal is not a sign');
    assert.equal(surfaceFor({ x: 0, y: 80, w: 10, flags: SURFACE.counter }, 'y'), 'floor');
    assert.equal(surfaceFor({ x: 0, y: 80, w: 10, flags: SURFACE.bin }, 'y'), 'floor');
    assert.equal(surfaceFor({ x: 0, y: 80, w: 10, flags: SURFACE.seat }, 'y'), 'floor');
    // A spilled slick is still the aisle: RESTITUTION.floor is documented as
    // "aisle tiles, and whatever has already been spilled on them".
    assert.equal(surfaceFor({ x: 0, y: 80, w: 10, flags: SURFACE.hummus }, 'y'), 'floor');
    // Met edge-on, everything behaves like a wall whatever it is made of.
    assert.equal(surfaceFor(CRATE, 'x'), 'wall');
    assert.equal(surfaceFor(SIGN, 'x'), 'wall');

    // And the mapping has to *matter*: the same falafel has to come off the two
    // at measurably different speeds, or the flags were read and then ignored.
    const f: FalafelState = { x: 0, y: 100, vx: 90, vy: 300, bounces: 0, settled: false, life: 5, spin: 0 };
    const off = (p: PlatformDef) => Math.abs(bounceFalafel(f, { surface: surfaceFor(p, 'y'), axis: 'y' }, () => 0.5).state.vy);
    assert.ok(off(SIGN) > off(CRATE) + 10,
        `a sign returned ${off(SIGN).toFixed(1)}px/s and a crate ${off(CRATE).toFixed(1)}px/s — too close to tell apart`);
});

t('the mapping is total, and no surface it can produce gives energy away for free', () => {
    // Every combination of the ten tile flags, both axes. "Nothing gains energy
    // from a bounce" has to hold for surfaces nobody has authored yet, because
    // the level file is where new flag combinations come from.
    const seen = new Set<FalafelSurface>();
    for (let flags = 0; flags < 1 << 10; flags++) {
        for (const axis of ['x', 'y'] as const) {
            const s = surfaceFor({ x: 0, y: 90, w: 20, flags }, axis);
            seen.add(s);
            const e = RESTITUTION[s];
            assert.ok(e !== undefined && e > 0 && e < 1, `flags ${flags}/${axis} named a nonsense surface ${s}`);
            for (const draw of [0, 0.5, 0.999999]) {
                for (const v of [60, 200, 900]) {
                    const f: FalafelState = { x: 0, y: 90, vx: v, vy: v, bounces: 0, settled: false, life: 5, spin: 0 };
                    const out = bounceFalafel(f, { surface: s, axis }, () => draw);
                    assert.ok(speedOf(out.state) < speedOf(f),
                        `flags ${flags} as ${s} on ${axis} at ${v}px/s gave it energy (draw ${draw})`);
                }
            }
        }
    }
    assert.ok(seen.has('crate') && seen.has('sign') && seen.has('floor') && seen.has('wall'),
        `the mapping cannot reach every surface it claims: ${[...seen].join(', ')}`);
});

console.log('\nseats, which food goes through the same way the player does');

t('food rises through a ONE_WAY seat and lands on top of it', () => {
    // The decision, written down: a seat back is solid from above and air from
    // below, for food exactly as for the player. The alternative — food falling
    // straight through — makes a slick on a seat the player is standing on
    // impossible to place; the other alternative, blocking from below, stops a
    // thrown falafel dead in mid-air under a chair.
    const seat: PlatformDef = { x: -100, y: TIER.seat, w: 400, flags: SURFACE.seat };
    const level: FieldLevel = { platforms: [AISLE, seat], ...NOBODY };

    let f = addFalafel(openField(), 100, FLOOR_Y, 108, 40, rngFor('up'));
    const rng = rngFor('up-step');
    let rose = false, landedOnSeat = false;
    for (let i = 0; i < FOREVER && !fieldEmpty(f); i++) {
        const r = stepField(f, DT, level, rng);
        if (f.falafel.some(x => x.y < TIER.seat - 2)) rose = true;
        for (const e of r.events) {
            if ((e.kind === 'boing' || e.kind === 'clang') && Math.abs(e.y - TIER.seat) < 1) landedOnSeat = true;
        }
        f = r.field;
    }
    assert.ok(rose, 'it was stopped on the way up by a surface the player jumps through');
    assert.ok(landedOnSeat, 'it fell through the seat instead of landing on it');
});

console.log('\nslicks, which have to stop being slicks');

t('a smear leaves a slick, and the slick expires', () => {
    // A slick that never expires turns the level into an ice rink by minute
    // three, and the player cannot tell a live hazard from last fight's residue.
    const level: FieldLevel = { platforms: [AISLE], ...NOBODY };
    let f = addHummus(openField(), 100, 60, 130, FLOOR_Y, 6, rngFor('smear'));
    const rng = rngFor('smear-step');

    let laid: FoodEvent | null = null, frames = 0, sawSlick = 0;
    while (!fieldEmpty(f) && frames++ < FOREVER) {
        const r = stepField(f, DT, level, rng);
        for (const e of r.events) if (e.kind === 'slick') laid = e;
        if (r.field.slicks.length > 0) sawSlick++;
        f = r.field;
    }
    assert.ok(laid !== null && laid.kind === 'slick', 'a blob landed on the aisle and left nothing behind');
    assert.ok(laid.w > 6, `the slick (${laid.w.toFixed(1)}px) is narrower than the blob that made it`);
    assert.ok(sawSlick > 0, 'the slick never existed');
    assert.equal(f.slicks.length, 0, 'the slick is still there after the field emptied');
    assert.ok(frames <= (HUMMUS_FUSE + SMEAR_LIFE + SLICK_LIFE) * 60 + 4,
        `the field took ${(frames / 60).toFixed(1)}s to clear one blob`);
});

t('a hundred spills do not become a skating rink', () => {
    const level: FieldLevel = { platforms: [AISLE], ...NOBODY };
    const rng = rngFor('rink');
    let f = openField();
    for (let i = 0; i < 100; i++) f = addHummus(f, i * 6, 40, i * 6 + 4, FLOOR_Y, 5, rng);
    const step = rngFor('rink-step');
    let peak = 0, frames = 0;
    while (!fieldEmpty(f) && frames++ < FOREVER) {
        f = stepField(f, DT, level, step).field;
        peak = Math.max(peak, f.slicks.length);
    }
    assert.ok(peak > 0, 'a hundred blobs landed on the aisle and left it dry');
    assert.ok(peak <= MAX_SLICKS, `${peak} slicks at once, over the cap of ${MAX_SLICKS}`);
    assert.equal(f.slicks.length, 0);
});

console.log('\nthe bowl, whose damage is somebody else’s function');

t('a bowl going over hurts through explosions.ts and not through arithmetic written here', () => {
    // Routed to `caughtInBlast` wholesale, which is why a bowl that takes out a
    // crate that takes out a bowl needs no chain-reaction code anywhere.
    const near: FieldLevel = {
        platforms: [AISLE],
        playerBox: { x: 100, y: FLOOR_Y - PLAYER_H, w: 14, h: PLAYER_H },
        targets: [{ id: 7, box: { x: 5000, y: FLOOR_Y - 26, w: 14, h: 26 } }],
    };
    const r = drain(addBowl(openField(), 100, FLOOR_Y, 0, BIG_BOWL, 0), near, rngFor('bowl'));
    assert.equal(countKind(r.events, 'burst'), 1, 'a bowl burst a number of times that was not one');
    const burst = r.events.find(e => e.kind === 'burst');
    assert.ok(burst && burst.kind === 'burst' && burst.big, 'a catering tub went over like a teacup');

    const hits = r.events.filter(e => e.kind === 'hit');
    assert.equal(hits.length, 1, `${hits.length} people hurt by a bowl that only one person was standing next to`);
    assert.ok(hits[0].kind === 'hit' && hits[0].target === 'player');
    assert.ok(hits[0].kind === 'hit' && hits[0].damage === EXPLOSIONS.big.damage,
        'the bowl invented its own damage number instead of naming a blast');

    // And the spill is real hummus, which then dies like any other hummus.
    assert.ok(countKind(r.events, 'splut') >= 3, 'a tub went over and nothing came out of it');
    assert.ok(fieldEmpty(r.field), 'a bowl left something behind forever');

    const far: FieldLevel = { platforms: [AISLE], ...NOBODY };
    const clear = drain(addBowl(openField(), 100, FLOOR_Y, 0, BIG_BOWL, 0), far, rngFor('bowl'));
    assert.equal(countKind(clear.events, 'hit'), 0, 'standing clear of a spill was not safe');
});

console.log('\npeople, who are hit by the hard one and worn by the soft one');

t('falafel hurts, hummus marks', () => {
    const level: FieldLevel = {
        platforms: [AISLE],
        playerBox: { x: 5000, y: FLOOR_Y - PLAYER_H, w: 14, h: PLAYER_H },
        targets: [{ id: 9, box: { x: 180, y: FLOOR_Y - 30, w: 18, h: 30 } }],
    };
    const hard = drain(addFalafel(openField(), 0, 80, 189, FLOOR_Y - 15, rngFor('hard')), level, rngFor('hard-s'));
    const hits = hard.events.filter(e => e.kind === 'hit');
    assert.ok(hits.length >= 1, 'a falafel went through a man without touching him');
    assert.ok(hits.every(e => e.kind === 'hit' && e.target === 9 && e.damage === FALAFEL_DAMAGE));

    const soft = drain(addHummus(openField(), 0, 80, 189, FLOOR_Y - 15, 5, rngFor('hard')), level, rngFor('hard-s'));
    assert.equal(countKind(soft.events, 'hit'), 0, 'hummus hurt somebody, which is not what hummus is for');
    assert.ok(countKind(soft.events, 'splut') >= 1, 'hummus hit a man and made no noise');
    assert.ok(PLAYER_ID < 0, 'the player id collides with a real npc id');
});

console.log('\nthe whole cabin, five hundred at a time');

t('five hundred pieces of food into a real level, stepped until the field is empty', () => {
    const rng = rngFor('barrage');
    const level = cabin();
    let f = openField();
    for (let i = 0; i < 500; i++) {
        const fromX = rng() * 700 - 20, fromY = 20 + rng() * 130;
        const toX = rng() * 700, toY = 50 + rng() * 120;
        f = i % 2 === 0
            ? addHummus(f, fromX, fromY, toX, toY, 3 + rng() * 8, rng)
            : addFalafel(f, fromX, fromY, toX, toY, rng);
    }
    assert.equal(fieldSize(f), 500, 'the field refused food it had room for');
    assert.ok(500 < FIELD_CAP);

    const r = drain(f, level, rngFor('barrage-step'));
    assert.equal(r.field.hummus.length, 0, `${r.field.hummus.length} blobs are immortal`);
    assert.equal(r.field.falafel.length, 0, `${r.field.falafel.length} falafel are still rattling`);
    assert.equal(r.field.bowls.length, 0);
    assert.equal(r.field.slicks.length, 0, 'the floor is permanently slippery');
    assert.ok(fieldEmpty(r.field));
    // Every life in projectiles.ts is under 11s; nothing the field adds extends
    // one, so a whole barrage clears in a little over the longest single life.
    assert.ok(r.frames <= 20 * 60, `the cabin took ${(r.frames / 60).toFixed(1)}s to clear`);
    assert.ok(r.events.length > 500, `500 pieces of food produced only ${r.events.length} events`);
    assert.ok(Math.max(...r.perFrameBoings) < 40, 'a single frame produced an implausible wall of noise');
});

t('a field that is full stops accepting food instead of growing', () => {
    // Bowls spill hummus and spilled hummus can set off bowls, so the field can
    // feed itself. The cap is what stops that being unbounded.
    const rng = rngFor('cap');
    let f = openField();
    for (let i = 0; i < FIELD_CAP + 50; i++) f = addFalafel(f, 0, 40, 100, FLOOR_Y, rng);
    assert.equal(fieldSize(f), FIELD_CAP, `the field grew to ${fieldSize(f)}`);
});

console.log('\nreplay, because a level you cannot replay you cannot debug');

t('the same seed plays the same barrage, frame for frame', () => {
    const play = (seed: string) => {
        const rng = rngFor(seed);
        const level = cabin();
        let f = openField();
        for (let i = 0; i < 40; i++) {
            f = i % 3 === 0
                ? addBowl(f, rng() * 600, FLOOR_Y, rng() * 2 - 1, 4 + rng() * 10, rng() * 80)
                : i % 3 === 1
                    ? addHummus(f, rng() * 600, 30 + rng() * 90, rng() * 600, 60 + rng() * 100, 4 + rng() * 6, rng)
                    : addFalafel(f, rng() * 600, 30 + rng() * 90, rng() * 600, 60 + rng() * 100, rng);
        }
        const step = rngFor(seed + '-step');
        const trace: FoodEvent[] = [];
        for (let i = 0; i < 900 && !fieldEmpty(f); i++) {
            const r = stepField(f, DT, level, step);
            trace.push(...r.events);
            f = r.field;
        }
        return { trace, field: f };
    };
    assert.deepEqual(play('take-one'), play('take-one'), 'the same seed played a different barrage');
    assert.notDeepEqual(play('take-one').trace, play('take-two').trace,
        'two different seeds played the identical barrage, so the seed does nothing');
});

console.log('\ntermination, which is the only property a frame budget depends on');

t('nothing in the field lives forever, from any throw, in any level', () => {
    const rng = rngFor('forever');
    for (let round = 0; round < 25; round++) {
        const level = cabin();
        let f = openField();
        for (let i = 0; i < 12; i++) {
            const fx = rng() * 900 - 150, fy = rng() * 200 - 40;
            const tx = rng() * 900 - 150, ty = rng() * 220 - 40;
            f = addHummus(f, fx, fy, tx, ty, 3 + rng() * 9, rng);
            f = addFalafel(f, fx, fy, tx, ty, rng);
        }
        f = addBowl(f, rng() * 600, FLOOR_Y, rng() * 2 - 1, 4 + rng() * 12, rng() * 120);
        const r = drain(f, level, rng);
        assert.ok(fieldEmpty(r.field), `round ${round} left ${fieldSize(r.field)} pieces of food alive`);
        assert.ok(r.frames < FOREVER, `round ${round} never cleared`);
    }
});

t('a falafel that settles on a shelf does not roll off it along thin air', () => {
    // The one place a settled projectile can look broken. It is cheap to fix and
    // it terminates anyway: the piece falls, meets the floor, and settles again
    // with its bounce count already at the cap.
    const shelf: PlatformDef = { x: 120, y: TIER.counter, w: 40, flags: SURFACE.counter };
    const level: FieldLevel = { platforms: [AISLE, shelf], ...NOBODY };
    const r = drain(addFalafel(openField(), 40, 30, 150, TIER.counter, rngFor('shelf')), level, rngFor('shelf-s'));
    assert.ok(fieldEmpty(r.field), 'it is still up there');
    for (const e of r.events) {
        assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
    }
    assert.ok(countKind(r.events, 'boing') >= 1, 'it never touched the shelf at all');
});

t('a tired falafel stops making noise, in a level as well as out of one', () => {
    // Otherwise a settling projectile emits a BOING every frame until it dies,
    // which in a barrage is the whole sound budget.
    const level = cabin();
    const r = drain(addFalafel(openField(), 0, 20, 200, FLOOR_Y, rngFor('quiet')), level, rngFor('quiet-s'));
    const noises = countKind(r.events, 'boing') + countKind(r.events, 'clang');
    assert.ok(noises <= MAX_BOUNCES, `one falafel made ${noises} noises, over the cap of ${MAX_BOUNCES}`);
    assert.ok(BOUNCE_FLOOR > 0);
    // The tail of its life is silent: it has settled and is rolling to a stop.
    assert.equal(r.perFrameBoings.slice(-20).reduce((a, b) => a + b, 0), 0,
        'it was still ringing on the frame it despawned');
});

console.log(`\n${pass} food checks passed.\n`);
