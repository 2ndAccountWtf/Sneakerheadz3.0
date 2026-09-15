/**
 * The food, checked as physics rather than as vibes.
 *
 * Two claims run through this whole file, and neither of them is the sort of
 * thing you confirm by playing for five minutes:
 *
 *   they are different       hummus never bounces, falafel always does, and no
 *                            amount of tuning either one turns it into the
 *                            other. If those two ever converge the joke dies
 *                            quietly and nobody notices for a month.
 *   they all stop            every blob, every falafel and every bowl reaches
 *                            an end in bounded time, from any launch. "It
 *                            eventually settles" is arithmetic, and a rattle
 *                            that never terminates is a frame budget spent on
 *                            a lentil.
 */
import assert from 'node:assert/strict';
import {
    arcVelocity, launchHummus, splat, stepHummus, hummusAlive, hummusAlpha, smearPatch,
    throwFalafel, stepFalafel, bounceFalafel, falafelAlive, speedOf, ringsOffTray,
    openBowl, stepBowl, bowlAlive, bowlBlast, caughtInSpill, spillBowl,
    RESTITUTION, BOUNCE_FRICTION, BOUNCE_FLOOR, MAX_BOUNCES, FALAFEL_LIFE, SETTLE_LIFE,
    SMEAR_LIFE, SMEAR_FADE, STICK_LIFE, HUMMUS_FUSE, SLIDE_REACH, TRAY_CHANCE,
    BOWL_LIFE, BIG_BOWL, ROLL_MAX,
    type HummusState, type FalafelState, type FalafelSurface,
} from '../components/minigames/phaser/flight404/projectiles.ts';
import { EXPLOSIONS, caughtInBlast } from '../components/minigames/phaser/flight404/explosions.ts';
import { GRAVITY, FLOOR_Y } from '../components/minigames/phaser/flight404/content.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

/** A seeded generator, so "the same throw twice" is a thing we can even ask. */
const lcg = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
};

const DT = 1 / 60;
/** Long enough that anything still moving at the end of it is a bug. */
const FOREVER = 60 * 60;

console.log('\nthe arc, which is the only thing the two share');

t('a throw lands where it was aimed, under the gravity the game already has', () => {
    // Solved for flight time rather than angle, so every throw in a barrage has
    // the same hang time and a player learns one rhythm instead of five.
    const v = arcVelocity(20, 120, 220, FLOOR_Y, 1);
    let x = 20, y = 120, vy = v.vy;
    for (let i = 0; i < 60; i++) { vy += GRAVITY * DT; x += v.vx * DT; y += vy * DT; }
    assert.ok(Math.abs(x - 220) < 1, `landed at x=${x.toFixed(1)}, aimed at 220`);
    assert.ok(Math.abs(y - FLOOR_Y) < 6, `landed at y=${y.toFixed(1)}, aimed at ${FLOOR_Y}`);
});

t('the same seed throws the same throw twice', () => {
    // The aim is jittered so a barrage spreads; jittered is not the same as
    // unrepeatable, and a level that cannot be replayed cannot be debugged.
    assert.deepEqual(
        launchHummus(0, 100, 200, FLOOR_Y, 5, undefined, lcg(7)),
        launchHummus(0, 100, 200, FLOOR_Y, 5, undefined, lcg(7)),
    );
    assert.deepEqual(
        throwFalafel(0, 100, 200, FLOOR_Y, undefined, lcg(19)),
        throwFalafel(0, 100, 200, FLOOR_Y, undefined, lcg(19)),
    );
    assert.notDeepEqual(
        throwFalafel(0, 100, 200, FLOOR_Y, undefined, lcg(19)),
        throwFalafel(0, 100, 200, FLOOR_Y, undefined, lcg(20)),
        'the spread does not depend on the rng at all',
    );
});

console.log('\nhummus, which arrives and stops');

/** Runs a blob to its end and reports everything worth knowing about the trip. */
function runHummus(h: HummusState, rng = lcg(3)) {
    const alphas: number[] = [];
    const phases = new Set<string>();
    let spluts = 0, frames = 0, rose = false;
    let prevY = h.y;
    while (hummusAlive(h) && frames < FOREVER) {
        const r = stepHummus(h, DT, FLOOR_Y, rng);
        if (r.sound === 'splut') spluts++;
        // "Rose" means it went back up after being at rest — i.e. it bounced.
        if (r.state.phase !== 'flight' && r.state.y < prevY - 0.001) rose = true;
        prevY = r.state.y;
        h = r.state;
        phases.add(h.phase);
        alphas.push(hummusAlpha(h));
        frames++;
    }
    return { end: h, spluts, frames, phases, rose, alphas };
}

t('hummus never bounces, from any height, at any speed', () => {
    for (const drop of [1, 20, 60, 140]) {
        for (const speed of [0, 90, 240, 600]) {
            const h: HummusState = {
                x: 0, y: FLOOR_Y - drop, vx: speed, vy: speed,
                phase: 'flight', size: 5, life: HUMMUS_FUSE, slide: 0, stuckTo: null,
            };
            const r = runHummus(h);
            assert.equal(r.rose, false, `a blob dropped ${drop}px at ${speed}px/s came back up`);
            assert.equal(r.spluts, 1, `one contact, one splut — got ${r.spluts}`);
            assert.equal(r.end.phase, 'smear');
            assert.equal(r.end.vx, 0, 'it kept moving after it landed');
            assert.equal(r.end.vy, 0);
        }
    }
});

t('a blob that meets nothing still dies', () => {
    // Fired up and out of the level. Without the fuse this is a live object
    // travelling away from the game forever.
    const up = launchHummus(0, FLOOR_Y, 4000, -9000, 5, 0.9, lcg(1));
    const r = runHummus(up);
    assert.ok(r.frames <= (HUMMUS_FUSE + SMEAR_LIFE) * 60 + 2, `it lived ${(r.frames / 60).toFixed(1)}s`);
    assert.equal(r.spluts, 1, 'it left the level without ever landing');
});

t('a smear always fades, and the fade always finishes', () => {
    const r = runHummus(launchHummus(0, 100, 60, FLOOR_Y, 5, 0.6, lcg(2)));
    assert.equal(hummusAlive(r.end), false, 'the mark is still on the wall');
    assert.equal(hummusAlpha(r.end), 0, 'it died at full opacity, which is a pop, not a fade');
    const tail = r.alphas.slice(-Math.round(SMEAR_FADE * 60));
    for (let i = 1; i < tail.length; i++) {
        assert.ok(tail[i] <= tail[i - 1], 'the fade went back up');
    }
    assert.ok(tail[0] > 0 && tail[0] <= 1, 'there was no fade at all, only a disappearance');
});

t('it slides down a sign, and the slide is bounded', () => {
    // Bounded by construction: the creep decays exponentially, so total travel
    // can never exceed speed x time-constant however long the mark lasts.
    const stuck = splat(
        { x: 40, y: 60, vx: 120, vy: -30, phase: 'flight', size: 5, life: HUMMUS_FUSE, slide: 0, stuckTo: null },
        { surface: 'vertical' }, lcg(5),
    );
    assert.ok(stuck.slide > 0, 'it hit a sign and did not sag at all');
    let h = stuck, frames = 0;
    while (hummusAlive(h) && frames++ < FOREVER) h = stepHummus(h, DT, FLOOR_Y, lcg(5)).state;
    const slid = h.y - stuck.y;
    assert.ok(slid > 1, `it did not slide (${slid.toFixed(1)}px)`);
    assert.ok(slid <= SLIDE_REACH * 1.4, `it slid ${slid.toFixed(1)}px, past the ${SLIDE_REACH}px ceiling`);
    assert.ok(frames <= (SMEAR_LIFE + 1) * 60, 'the sign kept it forever');
});

t('a blob on the floor does not slide anywhere', () => {
    const flat = splat(launchHummus(0, 100, 10, FLOOR_Y, 5, 0.5, lcg(8)), { surface: 'ground' }, lcg(8));
    assert.equal(flat.slide, 0);
});

t('it sticks to an NPC, then peels off and finishes fading', () => {
    // He wears it for a few seconds and it is gone. It does not become live
    // again on the way down: hummus that falls off a man and then hurts you is
    // a rule no player could ever see.
    let h = splat(launchHummus(0, 100, 40, 120, 5, 0.5, lcg(4)), { surface: 'npc', id: 12 }, lcg(4));
    assert.equal(h.phase, 'stuck');
    assert.equal(h.stuckTo, 12);
    assert.equal(h.life, STICK_LIFE);

    let frames = 0, peeled = 0;
    while (hummusAlive(h) && frames++ < FOREVER) {
        h = stepHummus(h, DT, FLOOR_Y, lcg(4)).state;
        if (h.phase === 'smear' && !peeled) peeled = frames;
    }
    assert.ok(peeled > 0, 'it never came off him');
    assert.equal(h.stuckTo, null, 'it is still wearing him after it died');
    assert.ok(Math.abs(peeled / 60 - STICK_LIFE) < 0.1, `it came off after ${(peeled / 60).toFixed(2)}s`);
    assert.ok(frames <= (STICK_LIFE + SMEAR_FADE) * 60 + 2, 'a stuck blob outlived its welcome');
});

t('a smear leaves a slick wider than itself', () => {
    // It pairs with SURFACE.hummus (SOLID | SLIPPERY) in terrain.ts. A patch you
    // can see and cannot slip on is worse than no patch at all.
    const p = smearPatch({ x: 100, y: FLOOR_Y, vx: 0, vy: 0, phase: 'smear', size: 6, life: 1, slide: 0, stuckTo: null });
    assert.ok(p.w > 6, 'the slick is narrower than the blob that made it');
    assert.equal(p.x + p.w / 2, 100, 'the slick is not centred on the blob');
});

console.log('\nfalafel, which arrives and leaves again');

/** Drops one and records the speed into the floor at every BOING. */
function runFalafel(f: FalafelState, rng = lcg(11)) {
    const boings: number[] = [];
    let frames = 0, clangs = 0;
    while (falafelAlive(f) && frames < FOREVER) {
        const before = Math.abs(f.vy);
        const r = stepFalafel(f, DT, FLOOR_Y, rng);
        if (r.sound === 'boing') boings.push(before);
        if (r.sound === 'clang') clangs++;
        f = r.state;
        frames++;
    }
    return { end: f, boings, clangs, frames };
}

t('falafel always bounces, where hummus never did', () => {
    // The same drop, the same gravity, deliberately opposite behaviour. If this
    // ever comes out as one bounce for both of them, the two systems have
    // collapsed into one and the bit is dead.
    const r = runFalafel(throwFalafel(0, 40, 120, FLOOR_Y, 0.6, lcg(12)));
    assert.ok(r.boings.length >= 2, `it went BOING ${r.boings.length} time(s)`);
    assert.equal(runHummus(launchHummus(0, 40, 120, FLOOR_Y, 5, 0.6, lcg(12))).rose, false);
});

t('every bounce is strictly slower than the one before it', () => {
    // The termination argument: restitution and friction are both below 1, and
    // the random wobble only ever scruffs a bounce down, never up.
    for (const seed of [1, 2, 3, 13, 99]) {
        const r = runFalafel(throwFalafel(0, 20, 200, FLOOR_Y, 0.7, lcg(seed)), lcg(seed));
        for (let i = 1; i < r.boings.length; i++) {
            assert.ok(r.boings[i] < r.boings[i - 1],
                `seed ${seed}: bounce ${i} came off at ${r.boings[i].toFixed(1)} after ${r.boings[i - 1].toFixed(1)}`);
        }
    }
});

t('it settles in finite time and then despawns', () => {
    const r = runFalafel(throwFalafel(0, 20, 200, FLOOR_Y, 0.7, lcg(6)), lcg(6));
    assert.equal(falafelAlive(r.end), false, 'it is still on the floor');
    assert.equal(r.end.settled, true, 'it despawned mid-bounce instead of coming to rest');
    assert.equal(r.end.vx, 0, `it was still rolling at ${r.end.vx.toFixed(1)}px/s when it despawned`);
    assert.ok(r.boings.length <= MAX_BOUNCES, `${r.boings.length} bounces, over the cap of ${MAX_BOUNCES}`);
    assert.ok(r.frames <= FALAFEL_LIFE * 60 + 2, `it lived ${(r.frames / 60).toFixed(1)}s`);
});

t('nothing rattles forever, however it is thrown', () => {
    for (const seed of [1, 4, 8, 17, 42, 101]) {
        for (const flight of [0.3, 0.55, 1.2]) {
            const f = throwFalafel(0, 10, 300, FLOOR_Y, flight, lcg(seed));
            const r = runFalafel(f, lcg(seed));
            assert.equal(falafelAlive(r.end), false, `seed ${seed}/${flight} never stopped`);
            assert.ok(r.frames < FALAFEL_LIFE * 60 + 4, `seed ${seed}/${flight} lived too long`);
        }
    }
});

t('a bounce off anything in the market loses energy', () => {
    const kinds: FalafelSurface[] = ['floor', 'wall', 'crate', 'sign', 'enemy', 'tray'];
    for (const k of kinds) {
        assert.ok(RESTITUTION[k] > 0 && RESTITUTION[k] < 1, `${k} has a nonsense bounciness`);
        const f: FalafelState = { x: 0, y: 100, vx: 200, vy: 200, bounces: 0, settled: false, life: FALAFEL_LIFE, spin: 0 };
        const r = bounceFalafel(f, { surface: k, axis: 'y' }, lcg(21));
        assert.ok(speedOf(r.state) < speedOf(f), `a ${k} bounce gave it energy`);
    }
    assert.ok(BOUNCE_FRICTION < 1, 'a skid along a surface never slows down');
    assert.ok(RESTITUTION.tray > RESTITUTION.enemy, 'a man is bouncier than sheet metal');
});

t('an upright surface sends it back the other way', () => {
    const f: FalafelState = { x: 0, y: 100, vx: 300, vy: -40, bounces: 0, settled: false, life: FALAFEL_LIFE, spin: 0 };
    const r = bounceFalafel(f, { surface: 'wall', axis: 'x' }, lcg(31));
    assert.ok(r.state.vx < 0, 'it went through the wall');
    assert.equal(r.sound, 'boing');
});

t('the shawarma guy gets a CLANG, and nothing else happens', () => {
    // background.ts is emphatic: he never reacts. All this system is allowed to
    // do is make the noise.
    const f: FalafelState = { x: 0, y: 40, vx: 120, vy: 300, bounces: 0, settled: false, life: FALAFEL_LIFE, spin: 0 };
    assert.equal(bounceFalafel(f, { surface: 'tray', axis: 'y' }, lcg(41)).sound, 'clang');
    assert.equal(bounceFalafel(f, { surface: 'crate', axis: 'y' }, lcg(41)).sound, 'boing');
    assert.ok(TRAY_CHANCE > 0 && TRAY_CHANCE < 0.2, 'the tray gag became furniture');
    assert.equal(ringsOffTray(() => 0.99), false);
    assert.equal(ringsOffTray(() => 0), true);
});

t('a tired falafel goes quiet instead of buzzing on the floor', () => {
    // Under the energy floor there is no sound and no bounce — otherwise a
    // settling projectile emits a BOING every frame for the rest of its life.
    const tired: FalafelState = {
        x: 0, y: FLOOR_Y, vx: 30, vy: BOUNCE_FLOOR * 0.5,
        bounces: 2, settled: false, life: FALAFEL_LIFE, spin: 0,
    };
    const r = bounceFalafel(tired, { surface: 'floor', axis: 'y' }, lcg(51));
    assert.equal(r.sound, null, 'it made a noise it did not have the energy for');
    assert.equal(r.state.settled, true);
    assert.ok(r.state.life <= SETTLE_LIFE, 'a dead falafel lingers as long as a live one');
    assert.equal(stepFalafel(r.state, DT, FLOOR_Y, lcg(51)).sound, null, 'a settled falafel started up again');
});

console.log('\nthe bowl, which is a hazard and then somebody else’s problem');

/** Rolls a bowl until it comes apart, and says how long that took. */
function runBowl(slope: number, size = 8, push = 0) {
    let b = openBowl(0, FLOOR_Y, slope, size, push);
    let frames = 0, bursts = 0;
    while (bowlAlive(b) && frames < FOREVER) {
        const r = stepBowl(b, DT);
        if (r.burst) bursts++;
        b = r.state;
        frames++;
    }
    return { end: b, frames, bursts };
}

t('a bowl always comes apart, on any slope', () => {
    for (let slope = -1; slope <= 1.0001; slope += 0.1) {
        const r = runBowl(Math.round(slope * 10) / 10, 8, 40);
        assert.equal(r.end.broken, true, `a bowl on slope ${slope.toFixed(1)} rolled forever`);
        assert.equal(r.bursts, 1, 'a bowl burst more than once');
        assert.ok(r.frames <= BOWL_LIFE * 60 + 2, `slope ${slope.toFixed(1)} took ${(r.frames / 60).toFixed(1)}s`);
    }
});

t('a bowl on the flat rolls to a stop, a bowl on a hill runs out of time', () => {
    // Friction alone never stops a bowl that is accelerating downhill, which is
    // exactly why the lifetime exists as well as the drag.
    const flat = runBowl(0, 8, 90);
    assert.ok(flat.end.x > 20, `it was shoved and barely moved (${flat.end.x.toFixed(1)}px)`);
    assert.ok(flat.frames < BOWL_LIFE * 60, 'the flat floor never stopped it — the drag is not working');
    assert.equal(flat.end.vx, 0);

    const hill = runBowl(0.8, 8, 0);
    assert.ok(hill.frames >= BOWL_LIFE * 60 - 2, 'a downhill bowl stopped by itself, which gravity forbids');
    assert.ok(Math.abs(hill.end.vx) <= ROLL_MAX, `it hit ${hill.end.vx.toFixed(0)}px/s — past the speed cap`);
});

t('a bowl rolls downhill, not up it', () => {
    assert.ok(runBowl(0.5).end.x > 0, 'a bowl on a right-hand slope went left');
    assert.ok(runBowl(-0.5).end.x < 0, 'a bowl on a left-hand slope went right');
});

t('a bowl hurts people through the same radial check as everything else', () => {
    // The whole point of routing it here: a bowl that takes out a crate that
    // takes out a bowl is a chain reaction nobody wrote chain-reaction code for.
    for (const size of [4, 8, BIG_BOWL, 16]) {
        const kind = bowlBlast({ size });
        assert.ok(EXPLOSIONS[kind], `a size-${size} bowl names a blast that does not exist`);
        assert.ok(EXPLOSIONS[kind].hurtRadius > 0, `a size-${size} bowl going over cannot hurt anybody`);
        const r = EXPLOSIONS[kind].hurtRadius;
        assert.equal(caughtInSpill({ size }, r - 1), caughtInBlast(kind, r - 1));
        assert.equal(caughtInSpill({ size }, r + 1), false, 'standing clear of a spill was not safe');
    }
    assert.equal(bowlBlast({ size: BIG_BOWL }), 'big', 'a catering tub went over like a teacup');
    assert.equal(bowlBlast({ size: BIG_BOWL - 1 }), 'small');
});

t('what comes out of a bowl is the same hummus, and all of it dies', () => {
    const b = openBowl(100, FLOOR_Y - 20, 0.3, 14, 60);
    const spray = spillBowl(b, lcg(77));
    assert.ok(spray.length >= 3, `a tub of hummus produced ${spray.length} blobs`);
    assert.deepEqual(spillBowl(b, lcg(77)), spray, 'the same spill twice came out different');
    for (const blob of spray) {
        assert.equal(blob.phase, 'flight');
        const r = runHummus(blob);
        assert.equal(r.rose, false, 'a spilled blob bounced');
        assert.equal(hummusAlive(r.end), false, 'a spilled blob is still on the floor');
        assert.ok(r.frames <= (HUMMUS_FUSE + SMEAR_LIFE) * 60 + 2, 'a spilled blob outlived the fuse');
    }
});

console.log('\nthe two systems, side by side');

t('nothing in this file lives forever', () => {
    // One sweep over everything, because "it terminates" is the only property
    // here that a frame budget actually depends on.
    const rng = lcg(404);
    for (let i = 0; i < 40; i++) {
        const h = runHummus(launchHummus(0, 20 + rng() * 120, rng() * 400 - 200, FLOOR_Y, 5, 0.4 + rng(), rng));
        assert.equal(hummusAlive(h.end), false, `blob ${i} survived a minute`);
        const f = runFalafel(throwFalafel(0, 20 + rng() * 120, rng() * 400 - 200, FLOOR_Y, 0.3 + rng(), rng), rng);
        assert.equal(falafelAlive(f.end), false, `falafel ${i} survived a minute`);
        const b = runBowl(rng() * 2 - 1, 4 + rng() * 12, rng() * 100);
        assert.equal(bowlAlive(b.end), false, `bowl ${i} survived a minute`);
    }
});

t('the hard one outlives and outruns the soft one', () => {
    // The contrast, stated as numbers: from the same throw the falafel is still
    // going after the hummus has stopped, and it ends up somewhere else.
    const h = runHummus(launchHummus(0, 60, 150, FLOOR_Y, 5, 0.7, lcg(50)));
    const f = runFalafel(throwFalafel(0, 60, 150, FLOOR_Y, 0.7, lcg(50)), lcg(50));
    assert.ok(f.end.x > h.end.x, `the falafel stopped at ${f.end.x.toFixed(0)}, the hummus at ${h.end.x.toFixed(0)}`);
    assert.ok(f.boings.length > 0 && h.spluts === 1, 'one of them is behaving like the other');
});

console.log(`\n${pass} projectile checks passed.\n`);
