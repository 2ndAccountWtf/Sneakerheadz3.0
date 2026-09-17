/**
 * Does the foreground row look like the inside of an aeroplane?
 *
 * It did not. The modules were laid end to end from the front of the section to
 * the back, which is a wall of upholstery rather than a cabin. A real one is
 * even seat pitch interrupted in two places, and both are the absence of a seat:
 * the overwing exit, where two seat positions are given up, and the bulkhead at
 * the front of a block, where the row starts late.
 *
 * The layout is pure geometry, so it is tested as such rather than by looking at
 * a screenshot — which is exactly how the unbroken version passed the first time.
 */
import assert from 'node:assert/strict';
import {
    cabinPlan, SEATS_PER_MODULE, MODULES_PER_BLOCK, EXIT_GAP_SEATS, BULKHEAD_GAP_SEATS,
} from '../components/minigames/phaser/flight404/cabinPlan.ts';

let checks = 0;
const ok = (c: unknown, m: string) => { assert.ok(c, m); checks++; };
const eq = (a: unknown, b: unknown, m: string) => { assert.deepEqual(a, b, m); checks++; };

const MOD = 72;                       // the delivered module, in world units
const SEAT = MOD / SEATS_PER_MODULE;  // 24

{
    // The economy section, which is the one the player sees first.
    const plan = cabinPlan(760, MOD);
    ok(plan.length > 6, `a 760-unit cabin gets a real row (${plan.length} modules)`);

    // The row starts late — that is the wall a front lavatory backs onto.
    eq(plan[0].x, BULKHEAD_GAP_SEATS * SEAT, 'the row starts at the bulkhead, not at x=0');

    // Gaps between consecutive modules: either flush, or one exit.
    const gaps = plan.slice(1).map((s, i) => s.x - (plan[i].x + MOD));
    const distinct = [...new Set(gaps.map(g => Math.round(g)))].sort((a, b) => a - b);
    eq(distinct, [0, EXIT_GAP_SEATS * SEAT],
        'every join is either flush seating or one double-width exit');

    // And the exits are actually spaced, not clustered.
    const exitAt = gaps.flatMap((g, i) => (g > 0 ? [i] : []));
    ok(exitAt.length >= 1, 'a 760-unit cabin has at least one exit row');
    for (let i = 1; i < exitAt.length; i++) {
        eq(exitAt[i] - exitAt[i - 1], MODULES_PER_BLOCK, 'exits come at a fixed block length');
    }
    eq(exitAt[0] + 1, MODULES_PER_BLOCK, 'the first exit comes after a full block');
}
{
    // Even pitch is the "for the most part": inside a block, modules butt up
    // against each other so three seats and the next three read as six.
    const plan = cabinPlan(760, MOD);
    let flush = 0;
    for (let i = 1; i < plan.length; i++) if (plan[i].x - plan[i - 1].x === MOD) flush++;
    ok(flush >= plan.length * 0.6, `most joins are flush (${flush} of ${plan.length - 1})`);
}
{
    // The seat positions given up at an exit really are two seats wide, in the
    // art's own units. This is the number that makes it read as an exit rather
    // than as a mistake.
    const plan = cabinPlan(760, MOD);
    const gap = plan.slice(1).map((s, i) => s.x - (plan[i].x + MOD)).find(g => g > 0)!;
    eq(gap / SEAT, EXIT_GAP_SEATS, 'an exit is exactly two seat positions');
}
{
    // Modules never overlap, ever. Two banks of seats drawn on top of each
    // other is the artefact a reader would most easily mistake for bad art.
    for (const len of [200, 400, 760, 1200, 2000]) {
        const plan = cabinPlan(len, MOD);
        for (let i = 1; i < plan.length; i++) {
            ok(plan[i].x >= plan[i - 1].x + MOD, `no overlap at ${len} units, slot ${i}`);
        }
    }
}
{
    // Indices are consecutive from zero, because the variant picker hashes
    // them: a gap in the sequence would bias which seats appear.
    const plan = cabinPlan(760, MOD);
    eq(plan.map(s => s.i), plan.map((_, i) => i), 'slot indices are consecutive');
}
{
    // Degenerate inputs return nothing rather than looping forever, which a
    // zero module width would do.
    eq(cabinPlan(0, MOD), [], 'a zero-length section has no seats');
    eq(cabinPlan(760, 0), [], 'a zero-width module places nothing');
    eq(cabinPlan(-5, MOD), [], 'a negative length places nothing');
}
{
    // A short section still gets seats rather than being all bulkhead.
    const plan = cabinPlan(150, MOD);
    ok(plan.length >= 1, 'even a short section seats somebody');
    ok(plan[0].x < 150, 'and the first module starts inside it');
}

console.log(`cabin-plan: ${checks} checks OK`);
