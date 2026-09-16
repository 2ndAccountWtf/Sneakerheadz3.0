/**
 * Playback rules for the street games' sprite sheets.
 *
 * The three bugs this module exists to kill were all found once already in the
 * Phaser game and fixed there: everything played at one flat rate, rolling
 * cycles ran on the wall clock instead of on distance travelled, and one-shots
 * looped. So the checks below are about exactly those three, plus the two
 * helpers that make them possible — a clock that restarts on a state change,
 * and a per-instance offset that stops a row of props ticking in unison.
 *
 * None of this touches a canvas, which is the point: "does the fall animation
 * stop at the bottom" should be answerable without a browser.
 */
import assert from 'node:assert/strict';
import {
    RATE, ONCE, DEFAULT_RATE, rateFor, loops, frameOf, cycleRate, fitRate,
    makeClock, frameFor, phaseOf,
} from '../components/minigames/engine/streetAnim.ts';
import {
    addBurst, stepBursts, BURST_CAP, type Burst,
} from '../components/minigames/engine/burst.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

console.log('\nnot everything moves at ten frames a second');

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

t('a sheet with no listed rate still gets one', () => {
    assert.equal(rateFor('nothing-in-the-table'), DEFAULT_RATE);
    assert.ok(DEFAULT_RATE > 0);
});

t('the rates are not all the same number', () => {
    // The whole bug was one constant applied to everything. If the table ever
    // collapses back to a single value this is the check that notices.
    const distinct = new Set(Object.values(RATE));
    assert.ok(distinct.size > 6, `only ${distinct.size} distinct rates`);
});

t('a beacon blinks slower than a bolting cat', () => {
    assert.ok(RATE['roadworks-lamp'] < RATE['cat-dart']);
    assert.ok(RATE['palm-sway'] < RATE['skateboard-ride']);
});

t('every rate is a usable frame rate', () => {
    for (const [id, r] of Object.entries(RATE)) {
        assert.ok(r > 0 && r <= 30, `${id} at ${r}fps`);
    }
});

// ---------------------------------------------------------------------------
// Looping vs one-shot
// ---------------------------------------------------------------------------

t('a loop wraps forever', () => {
    // A walk cycle ends where it started, so it is allowed to come round again.
    // Six frames at ten a second: frame 5 at half a second, back to 0 just
    // after, and still cycling much later.
    assert.equal(frameOf('dog-stray', 0, 6, 10), 0);
    assert.equal(frameOf('dog-stray', 0.5, 6, 10), 5);
    assert.equal(frameOf('dog-stray', 0.61, 6, 10), 0);
    assert.equal(frameOf('dog-stray', 12, 6, 10), 0);
    assert.equal(frameOf('dog-stray', 12.31, 6, 10), 3);
});

t('a one-shot holds on its last frame instead of standing back up', () => {
    // This is the bug in one assertion: a ten-frame fall at ten frames a second
    // is over after a second, and a rider who has fallen stays fallen.
    assert.equal(frameOf('bike-fall-off', 0, 10, 10), 0);
    assert.equal(frameOf('bike-fall-off', 0.9, 10, 10), 9);
    assert.equal(frameOf('bike-fall-off', 1.5, 10, 10), 9);
    assert.equal(frameOf('bike-fall-off', 60, 10, 10), 9);
});

t('a one-shot never plays a frame it has already passed', () => {
    // Monotonic is the property that matters; a modulo is not.
    let prev = -1;
    for (let e = 0; e < 4; e += 1 / 60) {
        const f = frameOf('skateboard-ollie', e, 10);
        assert.ok(f >= prev, `frame went backwards at ${e}s: ${prev} -> ${f}`);
        prev = f;
    }
    assert.equal(prev, 9);
});

t('the same clock on a looping sheet does go backwards', () => {
    // The teeth of the check above: if `ONCE` were empty, the assertion there
    // would fail, and here is the proof that a loop really does wrap.
    let backwards = false;
    let prev = -1;
    for (let e = 0; e < 4; e += 1 / 60) {
        const f = frameOf('skateboard-ride', e, 12);
        if (f < prev) backwards = true;
        prev = f;
    }
    assert.ok(backwards, 'a looping sheet that never wraps is not looping');
});

t('a tumble keeps tumbling but a fall does not', () => {
    // The distinction the ONCE set encodes: a slide along the tarmac is a
    // cycle, going down is not.
    assert.ok(loops('skateboard-ground-roll'));
    assert.ok(!loops('skateboard-balance-fall'));
});

t('every one-shot has an explicit rate', () => {
    // A one-shot on the default rate is a sheet nobody timed; it will either
    // truncate or hold early. Cheap to require, and it catches an id added to
    // ONCE without being thought about.
    for (const id of ONCE) {
        assert.ok(id in RATE, `${id} is a one-shot with no rate`);
    }
});

t('a single-frame sheet is always frame zero', () => {
    assert.equal(frameOf('oil-slick', 0, 1), 0);
    assert.equal(frameOf('oil-slick', 99, 1), 0);
    assert.equal(frameOf('car-door-open', 99, 1), 0);
});

t('a negative elapsed does not index off the front of a sheet', () => {
    assert.equal(frameOf('dog-stray', -3, 6), 0);
});

// ---------------------------------------------------------------------------
// Cycles that cover ground
// ---------------------------------------------------------------------------

t('a faster rider pushes faster', () => {
    const slow = cycleRate(12, 10, 28);
    const fast = cycleRate(12, 30, 28);
    assert.ok(fast > slow, `${fast} should beat ${slow}`);
});

t('the cycle rate is the distance one, not the clock one', () => {
    // Twelve frames over twenty-eight metres at twenty-eight metres a second is
    // twelve frames a second. Stated as arithmetic so the relationship cannot
    // drift into something that merely rises with speed.
    assert.equal(cycleRate(12, 28, 28), 12);
    assert.equal(cycleRate(12, 14, 28), 6);
});

t('a standstill does not strobe and a sprint does not blur', () => {
    assert.ok(cycleRate(12, 0, 28) >= 3);
    assert.ok(cycleRate(12, 4000, 28) <= 28);
});

t('direction does not matter, only pace', () => {
    assert.equal(cycleRate(4, -120, 100), cycleRate(4, 120, 100));
});

t('fitting a sheet to a duration lands the last frame at the end', () => {
    // The ollie case: hang time is decided by the rig, and the sheet has to be
    // exactly that long or the rider holds a pose in the air or snaps straight
    // at the apex.
    const frames = 10;
    const dur = 0.5;
    const r = fitRate(frames, dur);
    assert.equal(frameOf('skateboard-ollie', dur * 0.999, frames, r), frames - 1);
    assert.ok(frameOf('skateboard-ollie', dur * 0.5, frames, r) < frames - 1);
});

t('fitting to a zero duration does not divide by zero', () => {
    assert.ok(Number.isFinite(fitRate(10, 0)));
    assert.ok(Number.isFinite(fitRate(10, -4)));
});

// ---------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------

t('a state change restarts the sheet', () => {
    const c = makeClock();
    // Play a fall right through, then crash again a long time later.
    assert.equal(frameFor(c, 'bike-fall-off', 10, 10, 10), 0);
    assert.equal(frameFor(c, 'bike-fall-off', 10.9, 10, 10), 9);
    frameFor(c, 'bike-ride', 12, 12);
    assert.equal(frameFor(c, 'bike-fall-off', 40, 10, 10), 0);
});

t('without the restart the second fall would open mid-air', () => {
    // The teeth: indexing a one-shot straight off the world clock — which is
    // what both games did — puts the second crash on the last frame instantly.
    assert.equal(frameOf('bike-fall-off', 40, 10, 10), 9);
});

t('the clock does not restart while the state holds', () => {
    const c = makeClock();
    frameFor(c, 'skateboard-ride', 5, 12);
    const start = c.start;
    frameFor(c, 'skateboard-ride', 9, 12);
    assert.equal(c.start, start);
});

// ---------------------------------------------------------------------------
// Per-instance offsets
// ---------------------------------------------------------------------------

t('an offset is always a real frame of the sheet', () => {
    for (let id = 0; id < 400; id++) {
        const p = phaseOf(id, 6);
        assert.ok(Number.isInteger(p) && p >= 0 && p < 6, `id ${id} -> ${p}`);
    }
    assert.equal(phaseOf(7, 1), 0);
});

t('the same prop gets the same offset every frame', () => {
    assert.equal(phaseOf(41, 8), phaseOf(41, 8));
});

t('a row of props does not step in lockstep', () => {
    // Six bins in a row landing on one frame is what the eye reads as a fault.
    const seen = new Set<number>();
    for (let id = 0; id < 12; id++) seen.add(phaseOf(id, 6));
    assert.ok(seen.size >= 4, `only ${seen.size} distinct offsets across 12 props`);
});

// ---------------------------------------------------------------------------
// One-shot effects
// ---------------------------------------------------------------------------

console.log('\neffects that end');

t('an effect lasts exactly as long as its sheet', () => {
    const l: Burst[] = [];
    addBurst(l, 'dust-plume', 10, 20, 8, 5);
    assert.equal(l.length, 1);
    assert.equal(l[0].life, 5 / RATE['dust-plume']);
});

t('an effect whose art never arrived expires instead of lingering', () => {
    // `art.frames` reports 1 for an id with no PNG, and a one-frame effect is
    // over almost at once rather than sitting invisible for half a second.
    const l: Burst[] = [];
    addBurst(l, 'dust-plume', 0, 0, 8, 1);
    assert.ok(l[0].life < 1 / 10);
});

t('an effect is cleaned up when it finishes', () => {
    const l: Burst[] = [];
    addBurst(l, 'impact-star', 0, 0, 12, 5);
    const life = l[0].life;
    stepBursts(l, life * 0.5);
    assert.equal(l.length, 1);
    stepBursts(l, life);
    assert.equal(l.length, 0);
});

t('finishing one effect does not skip the next', () => {
    // The classic splice-while-iterating bug, which would leave an effect on
    // screen forever and is invisible until it happens.
    const l: Burst[] = [];
    for (let i = 0; i < 5; i++) addBurst(l, 'impact-star', i, 0, 12, 5);
    stepBursts(l, 10);
    assert.equal(l.length, 0);
});

t('an effect drifts with the road it happened on', () => {
    const l: Burst[] = [];
    addBurst(l, 'dust-plume', 100, 50, 8, 5, -60);
    stepBursts(l, 0.1);
    assert.ok(Math.abs(l[0].x - 94) < 1e-9, `x is ${l[0].x}`);
    assert.equal(l[0].y, 50);
});

t('a pile-up cannot fill the list without limit', () => {
    const l: Burst[] = [];
    for (let i = 0; i < 200; i++) addBurst(l, 'impact-star', i, 0, 12, 5);
    assert.equal(l.length, BURST_CAP);
});

console.log(`\n${pass} passed\n`);
