/**
 * Livestock, and the difference between visiting and moving in.
 *
 * The `plane` tier was built to spend no jokes: an ordinary cabin with nobody
 * odd standing in it, so that the galley landing could be the turn. Then the
 * brief changed — the regular cabin gets occasional donkeys, sheep and camels
 * running through it — and the obvious implementation is to let the ordinary
 * tier admit livestock as residents.
 *
 * That would have cost the escalation, because a donkey *standing* in row 32
 * and a donkey *running through* row 32 are not the same joke. The first one
 * says the cabin has lost. The second says "wait, was that a donkey", and it
 * works in an ordinary cabin precisely because you cannot go back and check.
 *
 * So crossings are a separate axis with a separate lifecycle, and these checks
 * exist to keep the two apart: residents are rationed and stay put, crossings
 * are frequent and always leave. If a crossing can ever become a resident — by
 * stalling, by turning round, by outliving its section — the tier system is
 * quietly back to one axis and the galley stops landing.
 */
import assert from 'node:assert/strict';
import {
    openCrossing, stepCrossing, crossingGone, isInteractive,
    CROSSING_KINDS, CROSS_SPEED, CROSS_WIDTH, BALK, BALK_HOLD, CROSS_LIFE,
    type CrossingKind,
} from '../components/minigames/phaser/flight404/crossings.ts';
import { openBackdrop, stepBackdrop } from '../components/minigames/phaser/flight404/backdrop.ts';
import { CREEP, CREEP_ORDER, crossEvery } from '../components/minigames/phaser/flight404/creep.ts';
import { SECTIONS } from '../components/minigames/phaser/flight404/content.ts';
import { rngFor } from '../utils/rng.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };
const DT = 1 / 60;

console.log('\neverything that comes in goes out again');

t('every kind, from either end, always leaves', () => {
    // The one property the whole design rests on. A crossing that can stall
    // becomes a resident, and a resident in an ordinary cabin is the bazaar
    // arriving three sections early.
    for (const kind of CROSSING_KINDS) {
        for (const from of [-1, 1] as const) {
            const rng = rngFor(`leave-${kind}-${from}`);
            let c = openCrossing(kind, 760, 164, 'mid', from, rng);
            let i = 0;
            for (; i < 60 * 120 && !crossingGone(c); i++) c = stepCrossing(c, DT, rng).state;
            assert.ok(crossingGone(c), `a ${kind} entering from ${from} was still in the cabin after two minutes`);
            assert.ok(i * DT <= CROSS_LIFE + 1, `${kind} took ${(i * DT).toFixed(0)}s, past the ${CROSS_LIFE}s ceiling`);
        }
    }
});

t('nothing turns round half way and walks back', () => {
    // A crossing that reverses is a crossing the player can follow, and then it
    // is a character rather than a glimpse.
    for (const kind of CROSSING_KINDS) {
        for (const from of [-1, 1] as const) {
            const rng = rngFor(`straight-${kind}-${from}`);
            let c = openCrossing(kind, 760, 164, 'mid', from, rng);
            const dir = from < 0 ? 1 : -1;
            let last = c.x;
            while (!crossingGone(c)) {
                c = stepCrossing(c, DT, rng).state;
                if (crossingGone(c)) break;
                const moved = (c.x - last) * dir;
                assert.ok(moved >= -0.001, `a ${kind} went backwards by ${(-moved).toFixed(2)}px`);
                last = c.x;
            }
        }
    }
});

t('a balk is a pause, not a parking space', () => {
    const rng = rngFor('balk-bound');
    for (const kind of CROSSING_KINDS) {
        let c = openCrossing(kind, 760, 164, 'mid', -1, rng);
        let longest = 0, run = 0;
        while (!crossingGone(c)) {
            const before = c.x;
            c = stepCrossing(c, DT, rng).state;
            if (crossingGone(c)) break;
            run = Math.abs(c.x - before) < 0.001 ? run + DT : 0;
            longest = Math.max(longest, run);
        }
        assert.ok(longest <= BALK_HOLD + 0.2, `a ${kind} stood still for ${longest.toFixed(1)}s`);
    }
});

console.log('\nthe beat, which half of them were silently skipping');

t('things entering from the right do their bit too', () => {
    // The regression. Progress used to be derived from the direction rather
    // than from the recorded start, which for a right-to-left crossing measured
    // the distance to the *exit* and divided by a zero-length span. Every one of
    // them failed the middle-third window forever, so half the livestock in the
    // game crossed without ever doing anything, and nothing failed or warned.
    for (const from of [-1, 1] as const) {
        let beats = 0;
        for (let n = 0; n < 60; n++) {
            const rng = rngFor(`beat-${from}-${n}`);
            let c = openCrossing('camel', 760, 164, 'mid', from, rng);
            while (!crossingGone(c)) {
                const r = stepCrossing(c, DT, rng);
                c = r.state;
                if (r.beat) beats++;
            }
        }
        assert.ok(beats > 8, `only ${beats} of 60 crossings from ${from} ever did their bit`);
    }
});

t('a beat fires at most once per crossing', () => {
    for (const kind of CROSSING_KINDS) {
        const rng = rngFor(`once-${kind}`);
        let c = openCrossing(kind, 760, 164, 'mid', -1, rng);
        let beats = 0;
        while (!crossingGone(c)) { const r = stepCrossing(c, DT, rng); c = r.state; if (r.beat) beats++; }
        assert.ok(beats <= 1, `a ${kind} did its bit ${beats} times in one crossing`);
    }
});

t('every kind has a bit to do, and it is the one it is named for', () => {
    for (const kind of CROSSING_KINDS) {
        assert.ok(BALK[kind] && BALK[kind].length > 10, `${kind} has nothing to do mid-aisle`);
        assert.ok(CROSS_SPEED[kind] > 0, `${kind} does not move`);
        assert.ok(CROSS_WIDTH[kind] > 0, `${kind} has no size`);
    }
    assert.match(BALK.camel, /bins/, 'the camel is not too tall for the cabin, which was the entire point of it');
});

console.log('\nthe ordinary cabin, which now has a camel in it');

t('a plain aeroplane gets livestock through it', () => {
    // The brief, checked directly: the regular cabin, with nothing wrong in it,
    // still gets things running through.
    const rng = rngFor('ordinary');
    let b = openBackdrop('plane', 760, rng);
    const seen = new Set<CrossingKind>();
    for (let i = 0; i < 60 * 240; i++) {
        const r = stepBackdrop(b, DT, rng);
        b = r.backdrop;
        for (const c of r.crossings) seen.add(c.kind);
    }
    assert.ok(seen.size >= 5, `only ${seen.size} kinds crossed an ordinary cabin in four minutes`);
    for (const beast of ['donkey', 'sheep', 'camel'] as const) {
        assert.ok(CREEP.plane.crosses.includes(beast), `an ordinary cabin cannot get a ${beast}`);
    }
});

t('but nothing ever moves in', () => {
    // The line the residents/crossings split exists to hold. An ordinary cabin
    // may be walked through by anything and must still contain nobody odd.
    const rng = rngFor('no-residents');
    const b = openBackdrop('plane', 760, rng);
    assert.deepEqual(b.crossings, [], 'the cabin opened with something already standing in it');
    for (const p of b.placements) {
        assert.ok(CREEP.plane.admits.includes(p.def.kind), `a ${p.def.kind} has moved into an ordinary cabin`);
    }
});

t('the traffic gets heavier as the plane stops being a plane', () => {
    let last = Infinity;
    for (const c of CREEP_ORDER) {
        const every = crossEvery(c);
        assert.ok(every < last, `${c} (${every}s) is no busier than the tier before it (${last}s)`);
        assert.ok(every > 0, `${c} never gets any traffic`);
        last = every;
    }
});

t('an ordinary cabin is traffic, not a stampede', () => {
    // "Occasional" is the whole specification. One at a time reads as an
    // aeroplane with a donkey on it; six at once reads as a farm.
    const rng = rngFor('peak');
    let b = openBackdrop('plane', 760, rng);
    let peak = 0;
    for (let i = 0; i < 60 * 300; i++) {
        const r = stepBackdrop(b, DT, rng);
        b = r.backdrop;
        peak = Math.max(peak, r.crossings.length);
    }
    assert.ok(peak >= 1, 'nothing crossed at all in five minutes');
    assert.ok(peak <= 3, `${peak} things in an ordinary aisle at once is a farm, not a glimpse`);
});

t('every authored section can carry traffic', () => {
    for (const s of SECTIONS) {
        assert.ok(CREEP[s.creep].crosses.length > 0, `${s.name} gets nothing walking through it`);
        assert.ok(crossEvery(s.creep) > 0, `${s.name} has no crossing rate`);
    }
});

console.log('\nthe rules that are the same rules');

t('a crossing cannot be told where the player is', () => {
    // `stepActor` takes no player argument and neither does this. A camel that
    // swerves around you is a game element; one that walks straight through the
    // firefight is the joke.
    assert.equal(stepCrossing.length, 2, 'stepCrossing has grown a parameter that could carry the player');
    assert.equal(isInteractive(), false);
});

t('a crossing is deterministic from its seed', () => {
    const path = (seed: string) => {
        const rng = rngFor(seed);
        let c = openCrossing('donkey', 760, 164, 'mid', -1, rng);
        const xs: number[] = [];
        while (!crossingGone(c)) { c = stepCrossing(c, DT, rng).state; xs.push(Math.round(c.x)); }
        return xs;
    };
    assert.deepEqual(path('same-donkey'), path('same-donkey'), 'the same seed walked a different path');
    assert.notDeepEqual(path('donkey-a'), path('donkey-b'), 'every seed walks the same path');
});

t('a bad frame time cannot move anything', () => {
    const rng = rngFor('badtime');
    const c = openCrossing('camel', 760, 164, 'mid', -1, rng);
    for (const dt of [0, -1, NaN, Infinity]) {
        const r = stepCrossing(c, dt as number, rng);
        assert.ok(Number.isFinite(r.state.x), `dt=${dt} produced ${r.state.x}`);
        assert.equal(r.state.x, c.x, `dt=${dt} moved it anyway`);
    }
});

console.log(`\n${pass} crossing checks passed.\n`);
