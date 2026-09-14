/**
 * The street fight: does pressing the button do the thing?
 *
 * This is the only mini-game with real mechanics — startup/active/recovery
 * frames, hitstun, blockstun, cancel windows, hit-stop — and it shipped with no
 * tests at all. It also feels bad to play, and the reason is not the mechanics:
 * it is that the game throws presses away.
 *
 * `onFrame` calls `consume('a')` every single frame, which clears the pressed
 * flag whether or not the fighter could act on it. `stepFighter` then drops the
 * press on the floor whenever the fighter is locked — hitstun, blockstun,
 * knocked down, mid-recovery — and `stepFight` returns early during hit-stop
 * before the fighters step at all. Hit-stop runs on *every hit that lands*, for
 * 3 to 10 frames. So during the exact moments a fighting game is most demanding
 * of your inputs, the game is deleting them.
 *
 * Every real fighting game buffers: a press a few frames early comes out the
 * instant you recover. These checks pin that down, and the rest cover the
 * mechanics that had nothing guarding them.
 */
import assert from 'node:assert/strict';
import {
    createFight, stepFight, startAttack, blankInput, seeded,
    hitbox, hurtbox, movesFor,
    type FightState, type FightInput, type Fighter,
} from '../components/minigames/StreetFighter.tsx';
import { FISTS } from '../systems/weapons.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const DT = 1 / 60;

/** Widens the literal type so `assert` comparisons read as plain state checks. */
const stateOf = (f: Fighter): string => f.state;

/** A fight already past the announce, so the fighters actually act. */
function liveFight(seed = 7): FightState {
    const s = createFight({ opponent: 'Test Foe', weapon: FISTS, rng: seeded(seed) });
    while (s.phase === 'intro') stepFight(s, blankInput(), DT);
    return s;
}

const press = (btn: 'a' | 'b' | 'up'): FightInput => ({
    ...blankInput(),
    [btn]: true,
    [`${btn}Pressed`]: true,
} as FightInput);

/** Steps n frames with nothing held, the way a player who let go would. */
const idleFor = (s: FightState, n: number) => {
    for (let i = 0; i < n; i++) stepFight(s, blankInput(), DT);
};

console.log('\nthe fight starts');

t('the announce ends and both fighters are alive and standing', () => {
    const s = liveFight();
    assert.equal(s.phase, 'fight');
    assert.ok(s.p.hp > 0 && s.f.hp > 0);
    assert.equal(s.p.state, 'idle');
});

t('a jab on an idle fighter comes out immediately', () => {
    const s = liveFight();
    stepFight(s, press('a'), DT);
    assert.equal(s.p.state, 'attack', 'a free jab did not come out');
    assert.equal(s.p.move, 'jab');
});

console.log('\nthe game must not eat your presses');

t('a press during hit-stop is not thrown away', () => {
    // Hit-stop freezes the simulation for a few frames on every landed hit, and
    // `stepFight` returns before the fighters step. A press in that window is
    // the single most common input in a real fight — the follow-up.
    const s = liveFight();
    s.hitstop = 5;
    stepFight(s, press('a'), DT);
    assert.equal(stateOf(s.p), 'idle', 'the fighter moved during hit-stop');

    // Hit-stop passes; the press the player already made should arrive.
    let started = false;
    for (let i = 0; i < 8 && !started; i++) {
        stepFight(s, blankInput(), DT);
        if (s.p.state === 'attack') started = true;
    }
    assert.ok(started, 'the press made during hit-stop was swallowed');
});

t('a press during hitstun comes out the moment you recover', () => {
    const s = liveFight();
    s.p.state = 'hitstun';
    s.p.hitstun = 4;
    stepFight(s, press('a'), DT);
    assert.notEqual(stateOf(s.p), 'attack', 'the fighter attacked out of hitstun');

    let started = false;
    for (let i = 0; i < 10 && !started; i++) {
        stepFight(s, blankInput(), DT);
        if (stateOf(s.p) === 'attack') started = true;
    }
    assert.ok(started, 'the press made during hitstun was swallowed');
});

t('a press late in recovery comes out as the next move', () => {
    // The buffer is a forgiveness window, not a queue: pressing near the end of
    // your own jab should chain, pressing at the start of it should not still be
    // pending twenty frames later. This is the chaining half.
    const s = liveFight();
    const jab = movesFor(FISTS).jab;
    stepFight(s, press('a'), DT);
    assert.equal(stateOf(s.p), 'attack');

    // Run to a few frames short of the end of recovery, then press.
    const total = jab.startup + jab.active + jab.recovery;
    while (s.p.state === 'attack' && s.p.frame < total - 3) stepFight(s, blankInput(), DT);
    stepFight(s, press('a'), DT);

    let cameOut = false;
    for (let i = 0; i < 10 && !cameOut; i++) {
        stepFight(s, blankInput(), DT);
        if (s.p.state === 'attack' && s.p.frame < 2) cameOut = true;
    }
    assert.ok(cameOut, 'a press at the end of recovery did not chain into the next move');
});

t('a press at the very start of a move does not fire long afterwards', () => {
    // The forgetting half. Seven frames of forgiveness, not a stored command.
    const s = liveFight();
    stepFight(s, press('a'), DT);
    stepFight(s, press('a'), DT);        // one frame in — far too early to chain
    idleFor(s, 60);
    assert.notEqual(stateOf(s.p), 'attack', 'a press from the start of the last move fired');
});

t('the buffer forgets, so an old press is not a ghost input', () => {
    // A press has to expire. Otherwise being held down for a second and then
    // recovering would fire an attack the player has long stopped wanting.
    const s = liveFight();
    s.p.state = 'hitstun';
    s.p.hitstun = 90;           // a very long lockout
    stepFight(s, press('a'), DT);
    idleFor(s, 120);
    assert.notEqual(stateOf(s.p), 'attack', 'a press from two seconds ago fired');
});

console.log('\nthe mechanics nothing was guarding');

t('a jab that connects takes health off', () => {
    const s = liveFight();
    s.p.x = s.f.x - 22;         // inside jab range
    const before = s.f.hp;
    for (let i = 0; i < 20; i++) stepFight(s, i === 0 ? press('a') : blankInput(), DT);
    assert.ok(s.f.hp < before, `the jab did nothing: ${before} -> ${s.f.hp}`);
});

t('you cannot attack while knocked down', () => {
    const s = liveFight();
    s.p.state = 'down';
    s.p.downTimer = 30;
    assert.equal(startAttack(s, s.p, 'jab'), false);
});

t('the special costs meter and will not fire without it', () => {
    const s = liveFight();
    s.p.hype = 0;
    assert.equal(startAttack(s, s.p, 'special'), false, 'the special fired on an empty meter');
    s.p.hype = 100;
    assert.equal(startAttack(s, s.p, 'special'), true, 'a full meter would not spend');
    assert.ok(s.p.hype < 100, 'the special was free');
});

t('a move has a hitbox only while it is active', () => {
    const s = liveFight();
    const m = movesFor(FISTS).jab;
    startAttack(s, s.p, 'jab');
    s.p.frame = 0;
    assert.equal(hitbox(s.p), null, 'the jab hit during startup');
    s.p.frame = m.startup + 0.5;
    assert.ok(hitbox(s.p), 'the jab has no hitbox while active');
    s.p.frame = m.startup + m.active + 0.5;
    assert.equal(hitbox(s.p), null, 'the jab was still hitting during recovery');
});

t('a fighter always has a hurtbox', () => {
    const s = liveFight();
    for (const f of [s.p, s.f] as Fighter[]) {
        const b = hurtbox(f);
        assert.ok(b.w > 0 && b.h > 0, `${f.name} cannot be hit`);
    }
});

t('the same seed fights the same fight twice', () => {
    const run = () => {
        const s = liveFight(99);
        for (let i = 0; i < 300; i++) stepFight(s, i % 17 === 0 ? press('a') : blankInput(), DT);
        return `${s.p.hp}/${s.f.hp}/${s.p.x.toFixed(2)}/${s.f.x.toFixed(2)}`;
    };
    assert.equal(run(), run(), 'the fight is not reproducible');
});

console.log(`\n${pass} fighter checks passed.\n`);
