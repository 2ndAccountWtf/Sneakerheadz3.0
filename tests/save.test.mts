/**
 * Saving has to survive the places it will actually run.
 *
 * A thirty-day run played on a phone, in a browser that may be in a private
 * window, may have site data cleared under it, may be over quota, and may hand
 * back a save written by a build from last week. The save layer is allowed to
 * lose data in all of those cases. It is not allowed to take the game down
 * with it — a crash on load is worse than never having saved.
 */
import assert from 'node:assert/strict';
import {
    saveRun, loadRun, clearRun, hasSavedRun,
    recordScore, loadScores, bestScore, clearScores,
    SAVE_VERSION, MAX_SCORES, type RunScore,
} from '../systems/persistence/save.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

/** A localStorage that behaves, and can be told to misbehave. */
function fakeStorage(mode: 'ok' | 'throws-on-write' | 'throws-on-read' | 'absent' = 'ok') {
    const map = new Map<string, string>();
    if (mode === 'absent') {
        delete (globalThis as never as { localStorage?: unknown }).localStorage;
        return map;
    }
    (globalThis as never as { localStorage: unknown }).localStorage = {
        getItem: (k: string) => { if (mode === 'throws-on-read') throw new Error('nope'); return map.get(k) ?? null; },
        setItem: (k: string, v: string) => { if (mode === 'throws-on-write') throw new Error('quota'); map.set(k, v); },
        removeItem: (k: string) => { map.delete(k); },
    };
    return map;
}

const score = (netWorth: number): RunScore => ({
    netWorth, multiple: netWorth / 2000, grade: 'B', days: 30, streetCred: 40, endedAt: Date.now(),
});

console.log('\nthe run in progress');

t('a saved run comes back exactly as it went in', () => {
    fakeStorage();
    const state = { day: 22, player: { cash: 4210, heat: 61, inventory: [{ id: 'x', isFake: true }] }, nested: { deep: [1, 2, 3] } };
    assert.equal(saveRun(state), true);
    assert.deepEqual(loadRun(), state);
});

t('no save means no run, not a crash', () => {
    fakeStorage();
    assert.equal(loadRun(), null);
    assert.equal(hasSavedRun(), false);
});

t('clearing works', () => {
    fakeStorage();
    saveRun({ day: 3 });
    assert.equal(hasSavedRun(), true);
    clearRun();
    assert.equal(hasSavedRun(), false);
    assert.equal(loadRun(), null);
});

t('a save from an older build is discarded, not half-read', () => {
    // A half-migrated save is a bug you get to debug through somebody else's
    // browser storage. Dropping it is the honest option.
    const map = fakeStorage();
    map.set('sdw:run:v1', JSON.stringify({ v: SAVE_VERSION - 1, at: Date.now(), data: { day: 9 } }));
    assert.equal(loadRun(), null);
});

t('a corrupt or hand-edited save is treated as absent', () => {
    const map = fakeStorage();
    map.set('sdw:run:v1', '{not json at all');
    assert.equal(loadRun(), null);
    map.set('sdw:run:v1', 'null');
    assert.equal(loadRun(), null);
});

console.log('\nwhen storage is hostile');

t('a private window that throws on write does not break the game', () => {
    fakeStorage('throws-on-write');
    assert.equal(saveRun({ day: 4 }), false, 'claimed to have saved into a throwing store');
    assert.equal(loadRun(), null);
    assert.doesNotThrow(() => clearRun());
    assert.doesNotThrow(() => recordScore(score(9000)));
});

t('a store that throws on read does not break the game', () => {
    fakeStorage('throws-on-read');
    assert.doesNotThrow(() => loadRun());
    assert.equal(loadRun(), null);
    assert.equal(hasSavedRun(), false);
    assert.deepEqual(loadScores(), []);
});

t('no localStorage at all is survivable', () => {
    fakeStorage('absent');
    assert.equal(saveRun({ day: 1 }), false);
    assert.equal(loadRun(), null);
    assert.equal(hasSavedRun(), false);
    assert.deepEqual(loadScores(), []);
    assert.equal(bestScore(), null);
    assert.doesNotThrow(() => clearScores());
});

console.log('\nthe runs that finished');

t('a finished run is filed and comes back', () => {
    fakeStorage();
    recordScore(score(12000));
    assert.equal(loadScores().length, 1);
    assert.equal(bestScore()!.netWorth, 12000);
});

t('the board is sorted by net worth, best first', () => {
    fakeStorage();
    for (const n of [4000, 90000, 12000, 500]) recordScore(score(n));
    assert.deepEqual(loadScores().map(s => s.netWorth), [90000, 12000, 4000, 500]);
});

t('beating your best is reported, matching it is not', () => {
    fakeStorage();
    assert.equal(recordScore(score(5000)).isBest, true, 'a first run is a best run');
    assert.equal(recordScore(score(4000)).isBest, false);
    assert.equal(recordScore(score(5000)).isBest, false, 'tying is not beating');
    assert.equal(recordScore(score(5001)).isBest, true);
});

t('the board does not grow forever', () => {
    fakeStorage();
    for (let i = 0; i < MAX_SCORES * 3; i++) recordScore(score(1000 + i));
    const scores = loadScores();
    assert.equal(scores.length, MAX_SCORES);
    assert.equal(scores[0].netWorth, 1000 + MAX_SCORES * 3 - 1, 'the best run was dropped');
});

t('a bad run still survives a great one before it', () => {
    fakeStorage();
    recordScore(score(500000));
    const r = recordScore(score(12));
    assert.equal(r.isBest, false);
    assert.equal(loadScores().length, 2, 'the bad run was thrown away');
});

console.log(`\n${pass} save checks passed.\n`);
