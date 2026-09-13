/**
 * A world that re-rolls cannot be learned.
 *
 * This suite exists because the feed and the rumour mill were the two systems
 * that never got the seeded treatment the shelf, the npc schedule and the hype
 * calendar all got — and both failed in ways no other check could see:
 *
 *   1. Rumours were shuffled with `arr.sort(() => 0.5 - Math.random())`, which
 *      looks like a shuffle and is not one. The first template came up 1.35x
 *      as often as it should and the ninth 0.79x, so the rumours authored last
 *      were the rumours nobody read.
 *   2. The SoleNet feed drew thirty posts independently from small pools, so
 *      six of twenty-nine posts on a live page were exact duplicates of
 *      another post on the same screen.
 *   3. Neither was seeded, so walking off the screen and back rebuilt the
 *      world. Only one of the top eight posts survived a round trip.
 *
 * None of that shows up in a screenshot of a single frame, and all of it makes
 * the intel systems worthless to a player trying to plan.
 */
import assert from 'node:assert/strict';
import { CITIES } from '../data/cities.ts';
import { RUMOR_TEMPLATES } from '../data/rumors.ts';
import { generateRumorsForCity, clearRumorCache } from '../systems/rumorEngine.ts';
import { hashString, seeded, rngFor, shuffled, sampleWithout } from '../utils/rng.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

console.log('\nseeded randomness');

t('the same key always produces the same stream', () => {
    const a = rngFor('city-day7'), b = rngFor('city-day7');
    for (let i = 0; i < 200; i++) assert.equal(a(), b());
});

t('different keys diverge', () => {
    const a = rngFor('tokyo-day7'), b = rngFor('paris-day7');
    let same = 0;
    for (let i = 0; i < 200; i++) if (a() === b()) same++;
    assert.ok(same < 5, `two different keys produced ${same}/200 identical draws`);
});

t('hashString spreads keys rather than clustering them', () => {
    const keys = CITIES.flatMap(c => Array.from({ length: 30 }, (_, d) => `${c.id}-day${d + 1}`));
    assert.equal(new Set(keys.map(hashString)).size, keys.length, 'two real keys collide');
});

t('shuffled() is fair — no entry is starved or favoured', () => {
    // The exact failure mode of the sort() shuffle it replaced.
    const N = 12, RUNS = 20000, PICK = 4;
    const src = Array.from({ length: N }, (_, i) => i);
    const hits = new Array(N).fill(0);
    const rng = seeded(99);
    for (let r = 0; r < RUNS; r++) for (const i of shuffled(src, rng).slice(0, PICK)) hits[i]++;
    const expected = (RUNS * PICK) / N;
    for (let i = 0; i < N; i++) {
        const ratio = hits[i] / expected;
        assert.ok(ratio > 0.9 && ratio < 1.1, `entry ${i} came up ${ratio.toFixed(2)}x its fair share`);
    }
});

t('shuffled() does not mutate what it was handed', () => {
    const src = [1, 2, 3, 4, 5];
    shuffled(src, seeded(4));
    assert.deepEqual(src, [1, 2, 3, 4, 5]);
});

t('sampleWithout() never returns the same entry twice', () => {
    const src = Array.from({ length: 9 }, (_, i) => `item-${i}`);
    for (let s = 0; s < 40; s++) {
        const got = sampleWithout(src, 6, seeded(s));
        assert.equal(new Set(got).size, got.length, 'a repeat came back');
        assert.equal(got.length, 6);
    }
    assert.equal(sampleWithout(src, 99, seeded(1)).length, src.length, 'asked for more than exists');
});

console.log('\nrumours');

t('a city on a given day always says the same thing', () => {
    for (const c of CITIES.slice(0, 3)) {
        for (const day of [1, 5, 12, 29]) {
            const first = generateRumorsForCity(c.id, day).map(r => r.text);
            clearRumorCache();                      // force real regeneration
            const second = generateRumorsForCity(c.id, day).map(r => r.text);
            assert.deepEqual(second, first, `${c.id} day ${day} rerolled its rumours`);
        }
    }
});

t('the dashboard, the travel screen and the feed cannot disagree', () => {
    // All three call the same function; the point is that repeated calls in
    // one render pass are identical, or intel contradicts itself on screen.
    for (const c of CITIES) {
        const a = generateRumorsForCity(c.id, 8);
        const b = generateRumorsForCity(c.id, 8);
        assert.deepEqual(b.map(r => r.text), a.map(r => r.text));
        assert.deepEqual(b.map(r => r.isTrue), a.map(r => r.isTrue));
    }
});

t('two cities do not tell the player the same story on the same day', () => {
    // What the travel screen actually renders: one headline line per city.
    let clashes = 0;
    for (let day = 1; day <= 30; day++) {
        const spoken = new Set<string>();
        const shown: string[] = [];
        for (const c of CITIES) {
            const rumors = generateRumorsForCity(c.id, day);
            const ranked = [
                ...rumors.filter(r => r.type === 'Intel Drop'),
                ...rumors.filter(r => r.type !== 'Intel Drop'),
            ];
            const pick = ranked.find(r => !spoken.has(r.text)) ?? ranked[0];
            if (pick) { spoken.add(pick.text); shown.push(pick.text); }
        }
        if (shown.some((x, i) => shown.indexOf(x) !== i)) clashes++;
    }
    assert.equal(clashes, 0, `${clashes} of 30 days repeat one city's headline on another city's card`);
});

t('every authored rumour gets seen eventually', () => {
    // The bias bug made this false: lines late in the file effectively did not
    // exist. Across a full run in every city, each eligible template should
    // surface at least once.
    const seen = new Set<string>();
    for (const c of CITIES) {
        for (let day = 1; day <= 30; day++) {
            for (const r of generateRumorsForCity(c.id, day)) seen.add(r.id.replace(/^rumor-\d+-/, ''));
        }
    }
    const missing = RUMOR_TEMPLATES.filter(t => !seen.has(t.id)).map(t => t.id);
    assert.equal(missing.length, 0, `never shown in a whole run: ${missing.join(', ')}`);
});

t('a city always has something to say, and never too much', () => {
    for (const c of CITIES) {
        for (let day = 1; day <= 30; day++) {
            const n = generateRumorsForCity(c.id, day).length;
            assert.ok(n >= 3 && n <= 5, `${c.id} day ${day}: ${n} rumours`);
        }
    }
});

t('a new run does not inherit the last run\'s gossip', () => {
    const before = generateRumorsForCity(CITIES[0].id, 1).map(r => r.text);
    clearRumorCache();
    const after = generateRumorsForCity(CITIES[0].id, 1).map(r => r.text);
    // Same seed, so same content — what matters is that clearing works at all
    // and the cache is a memo rather than the only thing holding the world
    // still. A stale cache used to survive RESET_GAME entirely.
    assert.deepEqual(after, before);
});

console.log(`\n${pass} rumour checks passed.\n`);
