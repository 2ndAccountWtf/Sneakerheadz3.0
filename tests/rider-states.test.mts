/**
 * Which animation plays for which situation.
 *
 * Ten skateboard sheets were delivered and the games were using six of them,
 * because both crashes resolved to the same pair no matter what caused them.
 * A rider who trips over a wheelie bin and a rider who goes head-first into a
 * parked Camry are two different drawings, and the art exists for both.
 *
 * This is the mapping, pinned. It is pure — a state name from a state object,
 * no canvas involved — so "does a car crash use the backwards sheet" is a test
 * rather than something you catch by crashing into enough things by hand.
 */
import assert from 'node:assert/strict';
import {
    createRaceState, stepRace, boardState, bikeState, NO_INPUT as RACE_IDLE,
} from '../components/minigames/CartRace.tsx';
import {
    createRunState, riderState,
} from '../components/minigames/PizzaRun.tsx';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const race = (over: Record<string, unknown> = {}) =>
    Object.assign(createRaceState({ hasBoard: true, seed: 7, arms: [], fitness: 1 } as never), over);
const run = (over: Record<string, unknown> = {}) =>
    Object.assign(createRunState({ hasBoard: true, seed: 7, fitness: 1, focus: 1 } as never), over);

console.log('\nten sheets, ten situations');

// ---------------------------------------------------------------------------
// Downhill Racer — the player
// ---------------------------------------------------------------------------

t('rolling along is the ride cycle', () => {
    assert.equal(boardState(race()), 'skateboard-ride');
});

t('tucking is the manual, not the ride cycle sped up', () => {
    assert.equal(boardState(race({ tucking: true })), 'skateboard-manual');
});

t('a kerb hop is an ollie and real ramp air is a kickflip', () => {
    // The trick is the reward for having earned the air, so it only shows up on
    // the jump you actually worked for.
    assert.equal(boardState(race({ airT: 0.3, airBig: false })), 'skateboard-ollie');
    assert.equal(boardState(race({ airT: 0.3, airBig: true })), 'skateboard-kickflip');
});

t('tripping over street furniture pitches you forward', () => {
    assert.equal(
        boardState(race({ invT: 0.7, hitKind: 'trip' })),
        'skateboard-obstacle-trip-forward',
    );
});

t('going into a parked car throws you backwards', () => {
    assert.equal(
        boardState(race({ invT: 0.7, hitKind: 'wall' })),
        'skateboard-front-collision-backward',
    );
});

t('how you went down decides how you get up', () => {
    // Face-down off a trip, so you push up. On your back off a wall, so you
    // burpee. These two sheets were both delivered and only one was ever used.
    assert.equal(
        boardState(race({ invT: 0.1, hitKind: 'trip' })),
        'skateboard-pushup-recover',
    );
    assert.equal(
        boardState(race({ invT: 0.1, hitKind: 'wall' })),
        'skateboard-burpee-to-stand',
    );
});

t('a wipeout falls first and then slides', () => {
    assert.equal(
        boardState(race({ outcome: 'wipeout', wipe: 0.2 })),
        'skateboard-balance-fall',
    );
    assert.equal(
        boardState(race({ outcome: 'wipeout', wipe: 1.4 })),
        'skateboard-ground-roll',
    );
});

t('every delivered board sheet is reachable from some state', () => {
    // The check that would have caught the original problem: four of the ten
    // sheets were dead weight because nothing could ever select them.
    const reached = new Set<string>();
    for (const over of [
        {}, { tucking: true },
        { airT: 0.3, airBig: false }, { airT: 0.3, airBig: true },
        { invT: 0.7, hitKind: 'trip' }, { invT: 0.7, hitKind: 'wall' },
        { invT: 0.1, hitKind: 'trip' }, { invT: 0.1, hitKind: 'wall' },
        { outcome: 'wipeout', wipe: 0.2 }, { outcome: 'wipeout', wipe: 1.4 },
    ]) reached.add(boardState(race(over)));

    const DELIVERED = [
        'skateboard-ride', 'skateboard-manual', 'skateboard-ollie',
        'skateboard-kickflip', 'skateboard-obstacle-trip-forward',
        'skateboard-front-collision-backward', 'skateboard-pushup-recover',
        'skateboard-burpee-to-stand', 'skateboard-balance-fall',
        'skateboard-ground-roll',
    ];
    for (const id of DELIVERED) {
        assert.ok(reached.has(id), `${id} was drawn and nothing ever plays it`);
    }
});

// ---------------------------------------------------------------------------
// Downhill Racer — the thief
// ---------------------------------------------------------------------------

t('the thief has a state for each of his sheets too', () => {
    assert.equal(bikeState(race()), 'bike-ride');
    assert.equal(bikeState(race({ crashT: 0.4 })), 'bike-fall-off');
    assert.equal(bikeState(race({ thiefStun: 0.4 })), 'bike-banana-slip');
    assert.equal(bikeState(race({ draft: 0.2 })), 'bike-look-back');
    assert.equal(bikeState(race({ thiefSpeed: 40 })), 'bike-wheelie-sparks');
});

t('the thumb-suck is only for when he is comfortably clear', () => {
    // It is the most annoying animation in the game, so it has to be earned by
    // falling behind rather than turning up while you are on his wheel.
    assert.equal(bikeState(race({ gap: 400, thiefSpeed: 20 })), 'bike-thumb-suck');
    assert.notEqual(bikeState(race({ gap: 4, thiefSpeed: 20 })), 'bike-thumb-suck');
});

// ---------------------------------------------------------------------------
// Pizza Run
// ---------------------------------------------------------------------------

t('the pizza rider uses the same vocabulary', () => {
    assert.equal(riderState(run()), 'skateboard-ride');
    assert.equal(riderState(run({ charging: true })), 'skateboard-manual');
    assert.equal(riderState(run({ air: 0.3, airBig: true })), 'skateboard-kickflip');
    assert.equal(riderState(run({ air: 0.3, airBig: false })), 'skateboard-ollie');
});

t('a pizza crash falls the way the thing that caused it would make you fall', () => {
    assert.equal(
        riderState(run({ wipeT: 0.8, wipe: 0.1, hitKind: 'wall' })),
        'skateboard-front-collision-backward',
    );
    assert.equal(
        riderState(run({ wipeT: 0.8, wipe: 0.1, hitKind: 'trip' })),
        'skateboard-balance-fall',
    );
    assert.equal(riderState(run({ wipeT: 0.5, wipe: 0.5, hitKind: 'trip' })), 'skateboard-ground-roll');
    assert.equal(riderState(run({ wipeT: 0.1, wipe: 0.8, hitKind: 'wall' })), 'skateboard-burpee-to-stand');
    assert.equal(riderState(run({ wipeT: 0.1, wipe: 0.8, hitKind: 'trip' })), 'skateboard-pushup-recover');
});

t('no board means the BMX branch, which has its own art', () => {
    assert.equal(riderState(run({ hasBoard: false })), 'bmx');
});

console.log(`\n${pass} rider-state checks passed\n`);
