/**
 * The surface rules, with no Phaser in the room.
 *
 * Everything in `platforms.ts` that decides how a surface *feels* is a pure
 * function taking numbers, for one reason: the alternative is checking a belt
 * by standing on one. A conveyor that quietly does nothing, ice with the wrong
 * sign, a one-way seat you can land on from underneath — all three look like
 * ordinary code, none of them throws, and the only symptom is a player saying
 * the game feels off.
 *
 * The one-way rule is the one worth reading. Arcade physics cannot express
 * "jump up through this", so it is a process callback, and the obvious
 * implementation tests the velocity: allow the collision when falling. That is
 * wrong for exactly one frame per jump — at the apex vertical velocity passes
 * through zero, the test says "not rising, therefore landing", and the player
 * sticks to the underside of a seat back. So the rule is written against where
 * the feet *were*, and the apex case is pinned below.
 */
import assert from 'node:assert/strict';
import {
    apply, lands, harms, GRIP, SLIP, CONVEYOR_SPEED, THICKNESS, PLATFORM_HP,
} from '../components/minigames/phaser/flight404/platforms.ts';
import { TILE, SURFACE } from '../components/minigames/phaser/flight404/terrain.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

console.log('\nthe floor, and the things that are not quite floor');

t('an ordinary surface just slows you down', () => {
    assert.equal(apply(SURFACE.counter, 100, false), 100 * GRIP);
    assert.equal(apply(SURFACE.counter, 100, true), 100, 'walking should not be damped');
});

t('ice lets go of you, but does not throw you across the cabin', () => {
    assert.ok(SLIP > GRIP, 'the slippery surface has more grip than the normal one');
    assert.ok(SLIP < 1, 'a surface that keeps all your speed never stops you at all');
    // The practical question: how far do you overshoot? A body width is funny;
    // half a section is a punishment.
    let vx = 88, travelled = 0;
    for (let i = 0; i < 600 && Math.abs(vx) > 1; i++) { travelled += vx / 60; vx = apply(SURFACE.hummus, vx, false); }
    assert.ok(travelled > 14, `${travelled.toFixed(0)}px of slide is not noticeable`);
    assert.ok(travelled < 60, `${travelled.toFixed(0)}px of slide is a section, not a joke`);
});

t('a belt carries you when you are not asking it to', () => {
    // The gag only works if standing still on one moves you. A belt that only
    // applies while walking is an invisible speed modifier.
    assert.equal(apply(SURFACE.beltFwd, 0, false), CONVEYOR_SPEED);
    assert.equal(apply(SURFACE.beltBack, 0, false), -CONVEYOR_SPEED);
    assert.ok(apply(SURFACE.beltBack, 0, false) < 0, 'both belts run the same way');
});

t('walking against a belt is slower than walking with it', () => {
    const withIt = apply(SURFACE.beltFwd, 88, true);
    const against = apply(SURFACE.beltBack, 88, true);
    assert.ok(withIt > against, 'the belt direction makes no difference to a walker');
    assert.ok(against < 88, 'walking into the belt costs nothing');
    assert.ok(against > 0, 'the belt is strong enough to walk you backwards, which is not funny, it is stuck');
});

t('a hot surface hurts and an ordinary one does not', () => {
    assert.equal(harms(TILE.HURTS | TILE.SOLID), true);
    assert.equal(harms(SURFACE.counter), false);
    assert.equal(harms(SURFACE.hummus), false, 'spilled hummus is slippery, not scalding');
});

console.log('\nthe one-way rule, which has exactly one hard case');

t('a solid surface always catches you', () => {
    assert.equal(lands(SURFACE.counter, 200, 137, -100), true, 'a counter let somebody through');
    assert.equal(lands(SURFACE.counter, 100, 137, 100), true);
});

t('you land on a seat from above and pass through it from below', () => {
    // feet at 200 (below the seat top at 137), rising: must pass through.
    assert.equal(lands(SURFACE.seat, 200, 137, -140), false, 'he landed on a seat from underneath');
    // feet at 120 (above it), falling: must land.
    assert.equal(lands(SURFACE.seat, 120, 137, 140), true, 'he fell through a seat he should have landed on');
});

t('the apex of a jump does not stick you to the underside of a seat', () => {
    // THE bug this rule exists for. At the top of an arc vertical velocity
    // passes through zero while the feet are still below the seat. A
    // velocity-only test reads that frame as "not rising, therefore landing".
    assert.equal(lands(SURFACE.seat, 150, 137, 0), false,
        'at the apex under a seat, he was allowed to land on it');
    assert.equal(lands(SURFACE.seat, 150, 137, 0.5), false,
        'one frame past the apex, still under it, and he stuck to it');
});

t('a seat you are standing on keeps holding you', () => {
    // Feet exactly on the surface, falling: the ordinary standing-still frame.
    assert.equal(lands(SURFACE.seat, 137, 137, 20), true, 'he fell through the seat he was stood on');
});

console.log('\nnumbers that other files depend on');

t('a platform is thin enough to be a surface and thick enough to be a body', () => {
    assert.ok(THICKNESS >= 4, 'a body this thin is tunnelled through by anything quick');
    assert.ok(THICKNESS <= 16, 'a platform this thick has a visible underside the player bumps into');
});

t('a destructible platform takes more than one bullet', () => {
    assert.ok(PLATFORM_HP > 10, 'cover that dies to one shot is not cover');
});

t('every surface preset survives the effect table without producing nonsense', () => {
    for (const [name, flags] of Object.entries(SURFACE)) {
        for (const vx of [-200, -88, 0, 88, 200]) {
            for (const pushing of [true, false]) {
                const out = apply(flags, vx, pushing);
                assert.ok(Number.isFinite(out), `${name} produced ${out} from ${vx}`);
                assert.ok(Math.abs(out) < 400, `${name} accelerated ${vx} to ${out}`);
            }
        }
    }
});

console.log(`\n${pass} platform checks passed.\n`);
