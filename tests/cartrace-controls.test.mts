/**
 * The controls, which were pointing the wrong way.
 *
 * Four lanes of road are drawn stacked up the screen, and the original mapping
 * changed lane with left and right. That fought the picture every frame: the
 * hand said sideways, the eye said up. Worse, it left the only axis that
 * matches the layout — up and down — spent on a jump, so the two most natural
 * inputs in a downhill game, "slow down" and "drive on", had nowhere to live.
 *
 * So: up and down cross the street, left and right brake and drive, and the
 * jump moved to its own button. These checks pin that, because it is the kind
 * of thing that is obvious while playing and silent in a diff.
 */
import assert from 'node:assert/strict';
import {
    createRaceState, stepRace, NO_INPUT,
    type RaceInput,
} from '../components/minigames/CartRace.tsx';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };
const DT = 1 / 60;

const run = (over: Partial<RaceInput>, frames = 60, board = true) => {
    const s = createRaceState({ hasBoard: board, seed: 7, arms: [], fitness: 1 } as never);
    for (let i = 0; i < frames; i++) stepRace(s, { ...NO_INPUT, ...over }, DT);
    return s;
};

console.log('\ncrossing the street');

t('down moves toward the far lane and up moves back', () => {
    assert.ok(run({ down: true }).laneF > run({}).laneF, 'down did not cross the street');
    assert.ok(run({ up: true }).laneF < run({}).laneF, 'up did not cross the street');
});

t('left and right no longer change lane', () => {
    // The whole point of the remap. If these ever start steering again, the
    // brake has quietly become a swerve.
    assert.equal(run({ left: true }).laneF, run({}).laneF, 'left still steers');
    assert.equal(run({ right: true }).laneF, run({}).laneF, 'right still steers');
});

console.log('\nbraking and driving');

t('left slows you down and right speeds you up', () => {
    const coast = run({}).speed;
    assert.ok(run({ left: true }).speed < coast, 'the brake does nothing');
    assert.ok(run({ right: true }).speed > coast, 'driving does nothing');
});

t('the rider moves along the screen so you can see which you did', () => {
    // A control that changes your speed has to change the picture, or the only
    // evidence it worked is a number in the HUD.
    const back = run({ left: true }).px;
    const fwd = run({ right: true }).px;
    assert.ok(fwd > back + 20, `brake ${back} and drive ${fwd} look the same on screen`);
});

t('driving forward buys you more road to read', () => {
    // The reward for committing, and the reason it is a real decision: sitting
    // further up the screen means obstacles arrive with more warning.
    assert.ok(run({ right: true }).px > run({}).px, 'driving does not move you up the road');
});

t('the brake is useless on oil, like the steering', () => {
    const s = createRaceState({ hasBoard: true, seed: 3, arms: [], fitness: 1 } as never);
    s.oilT = 5;
    const before = s.speed;
    for (let i = 0; i < 30; i++) stepRace(s, { ...NO_INPUT, left: true }, DT);
    const onOil = before - s.speed;

    const dry = createRaceState({ hasBoard: true, seed: 3, arms: [], fitness: 1 } as never);
    const b2 = dry.speed;
    for (let i = 0; i < 30; i++) stepRace(dry, { ...NO_INPUT, left: true }, DT);
    assert.ok(onOil < (b2 - dry.speed), 'a slick should take your authority away, not just some of it');
});

console.log('\nthe jump, on its own button');

t('ollie fires from its own input and not from up', () => {
    const jumped = run({ ollie: true }, 4);
    assert.ok(jumped.airT > 0, 'the jump button does not jump');
    const crossed = run({ up: true }, 4);
    assert.equal(crossed.airT, 0, 'up is still jumping, so it cannot cross the street');
});

t('a trolley still cannot really jump', () => {
    // The longboard branch survives the remap: the joke is that the man with a
    // shopping trolley lifts it by the handle and loses speed for his trouble.
    const board = run({ ollie: true }, 4, true);
    const trolley = run({ ollie: true }, 4, false);
    assert.ok(board.airDur > trolley.airDur, 'the trolley jumps as well as the board');
});

console.log(`\n${pass} cart-race control checks passed.\n`);
