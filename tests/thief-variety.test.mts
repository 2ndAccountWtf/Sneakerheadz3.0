/**
 * The thief has to stop sounding like four lines on a loop.
 *
 * Uniform picking is right for a lane and wrong for a voice. Even at thirty
 * lines, seventeen uniform draws repeat at least one of them 99% of the time,
 * and a repeat inside ten seconds is what a player hears as "he says the same
 * four things" however many he actually has. Adding lines barely moves that
 * number; dealing from a shuffled bag removes it entirely.
 *
 * So this drives real races headlessly and listens.
 */
import assert from 'node:assert/strict';
import { createRaceState, stepRace, bikeState, NO_INPUT } from '../components/minigames/CartRace.tsx';

let checks = 0;
const ok = (c: unknown, m: string) => { assert.ok(c, m); checks++; };

/** One race, recording every distinct thing he says and does. */
function run(seed: number, secs = 70) {
    const s = createRaceState({ hasBoard: true, seed });
    const lines: string[] = [];
    const states = new Set<string>();
    const crashKinds: string[] = [];
    let last = '';
    let lastKind = '';
    for (let i = 0; i < secs * 60; i++) {
        stepRace(s, { ...NO_INPUT, right: true }, 1 / 60);
        if (s.talk && s.talk !== last) { lines.push(s.talk); last = s.talk; }
        states.add(bikeState(s));
        if (s.crashT > 0 && s.crashKind !== lastKind) { crashKinds.push(s.crashKind); lastKind = s.crashKind; }
        if (s.crashT <= 0) lastKind = '';
        if (s.outcome) break;
    }
    return { lines, states, crashKinds };
}

{
    // The complaint, measured: how soon does a line come round again?
    let worstGap = Infinity;
    for (const seed of [1, 7, 42, 99, 1234]) {
        const { lines } = run(seed);
        const at = new Map<string, number>();
        for (let i = 0; i < lines.length; i++) {
            const prev = at.get(lines[i]);
            if (prev !== undefined) worstGap = Math.min(worstGap, i - prev);
            at.set(lines[i], i);
        }
    }
    // A bag of thirty cannot repeat inside thirty draws except across the seam,
    // and the seam is guarded. Ten is a long way clear of "the same four".
    ok(worstGap >= 10, `no line repeats within 10 of itself (closest was ${worstGap})`);
}
{
    // Breadth: a single race should draw on most of what he has, not a corner.
    const { lines } = run(7);
    const distinct = new Set(lines).size;
    ok(distinct >= 14, `a single race hears at least 14 distinct lines (heard ${distinct})`);
}
{
    // All three crash kinds show up, and not in a fixed order across seeds.
    const orders = new Set<string>();
    const kindsSeen = new Set<string>();
    for (const seed of [1, 7, 42, 99, 1234]) {
        const { crashKinds } = run(seed);
        for (const k of crashKinds) kindsSeen.add(k);
        orders.add(crashKinds.slice(0, 3).join(','));
    }
    for (const k of ['bin', 'wheelie', 'banana']) ok(kindsSeen.has(k), `${k} crashes happen`);
    ok(orders.size > 1, 'the order the crash kinds arrive in varies by seed');
}
{
    // And the sheets those crashes are for actually get drawn. This is the
    // whole reason the gag exists rather than three names for one animation.
    const all = new Set<string>();
    for (const seed of [1, 7, 42, 99, 1234, 5, 11]) for (const st of run(seed).states) all.add(st);
    for (const id of ['bike-ride', 'bike-fall-off', 'bike-ground-roll',
                      'bike-banana-slip', 'bike-banana-slip-pacifier-tail',
                      'bike-wheelie-sparks']) {
        ok(all.has(id), `${id} is reached in a real race`);
    }
}
{
    // Same seed, same race. The bag is fed by the seeded stream, so adding it
    // must not have made a replay stop being a replay.
    const a = run(42).lines.join('|');
    const b = run(42).lines.join('|');
    ok(a === b, 'a seed still reproduces exactly');
    ok(run(42).lines.join('|') !== run(43).lines.join('|'), 'different seeds differ');
}

console.log(`thief-variety: ${checks} checks OK`);
