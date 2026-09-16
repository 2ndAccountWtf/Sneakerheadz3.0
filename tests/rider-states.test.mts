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
import { loops } from '../components/minigames/engine/streetAnim.ts';

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

t('a light clip is ridden out, a heavy one puts you down', () => {
    // A six-damage wheelie bin and a fourteen-damage Camry used to play the
    // identical full wipeout, which flattened the whole damage table into one
    // event. The board stays under you for the light one.
    assert.equal(
        boardState(race({ invT: 0.7, hitLight: true, hitBy: 'bin' })),
        'skateboard-hit-stumble',
    );
    assert.equal(
        boardState(race({ invT: 0.7, hitLight: false, hitBy: 'car', hitKind: 'wall' })),
        'skateboard-front-collision-backward',
    );
});

t('going through a pedestrian is its own thing', () => {
    // The only obstacle that is a person, and the only one where two bodies go
    // down. It outranks the light/heavy split because it is about what you hit,
    // not how hard.
    assert.equal(
        boardState(race({ invT: 0.7, hitBy: 'ped', hitLight: true })),
        'skateboard-ped-collide',
    );
});

t('oil has a tell now', () => {
    // Oil does no damage and takes your steering for 1.1s. Until the sheet
    // arrived the rider kept his normal pose while the controls stopped
    // working, which reads as a bug rather than as a hazard.
    assert.equal(boardState(race({ oilT: 0.8 })), 'skateboard-oil-wobble');
    // And it is a loop, because how long you are on the slick is not fixed.
    assert.ok(loops('skateboard-oil-wobble'));
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
        { invT: 0.7, hitLight: true }, { invT: 0.7, hitBy: 'ped' }, { oilT: 0.8 },
    ]) reached.add(boardState(race(over)));

    const DELIVERED = [
        'skateboard-ride', 'skateboard-manual', 'skateboard-ollie',
        'skateboard-kickflip', 'skateboard-obstacle-trip-forward',
        'skateboard-front-collision-backward', 'skateboard-pushup-recover',
        'skateboard-burpee-to-stand', 'skateboard-balance-fall',
        'skateboard-ground-roll',
        'skateboard-hit-stumble', 'skateboard-ped-collide', 'skateboard-oil-wobble',
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
    assert.equal(bikeState(race({ draft: 0.2 })), 'bike-look-back');
    assert.equal(bikeState(race({ thiefSpeed: 40 })), 'bike-wheelie-sparks');
});

t('what he was hit with decides how he reacts to it', () => {
    // Every weapon used to fold him identically, which made a sandal and a
    // frozen slushie indistinguishable from the saddle and quietly undid the
    // point of carrying a kit.
    const hit = (id: string) => bikeState(race({ thiefStun: 0.4, thiefHitBy: id }));
    assert.equal(hit('itm-banana-peel'), 'bike-banana-slip');
    assert.equal(hit('itm-chancla'), 'bike-hit-chancla');
    assert.equal(hit('itm-slushie'), 'bike-hit-slushie');
    // Anything with mass and no sheet of its own falls to the heavy reaction
    // rather than to a sandal, which is the safe direction for a default.
    assert.equal(hit('itm-frozen-bureka'), 'bike-hit-heavy');
    assert.equal(hit(''), 'bike-hit-heavy');
});

t('the delivered reactions are all distinct states', () => {
    const seen = new Set(['itm-banana-peel', 'itm-chancla', 'itm-slushie', 'itm-anvil']
        .map(id => bikeState(race({ thiefStun: 0.4, thiefHitBy: id }))));
    assert.equal(seen.size, 4, `four weapons produced ${seen.size} reactions`);
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

t('rear-ending the slower skater is not a head-on', () => {
    // He is going the same way you are, so the pile-up is two riders and two
    // boards rather than a wall impact, and it should not look like one.
    assert.equal(
        riderState(run({ wipeT: 0.8, wipe: 0.1, hitBy: 'skater', hitKind: 'wall' })),
        'skateboard-hit-skater',
    );
});

t('a sprinkler leaves you wet rather than broken', () => {
    // It does no damage, and the soaking outlives the crash window — you get up
    // and spend a couple of seconds shaking it off.
    assert.equal(riderState(run({ soakT: 1.5 })), 'skateboard-soaked');
    assert.ok(loops('skateboard-soaked'), 'shaking it off is a cycle');
    // But being down outranks being wet.
    assert.notEqual(riderState(run({ soakT: 1.5, wipeT: 0.8, wipe: 0.1 })), 'skateboard-soaked');
});

t('no board means the BMX branch, which has its own art', () => {
    assert.equal(riderState(run({ hasBoard: false })), 'bmx');
});

console.log(`\n${pass} rider-state checks passed\n`);
