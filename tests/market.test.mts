/**
 * Market simulation checks.
 *
 * The claim this file has to defend is "you can actually trade on this market".
 * That is not one property but five, and each of them can break silently:
 *
 *   1. Cities disagree about prices, persistently, by enough to be worth a
 *      flight. (If they agree, there is no game.)
 *   2. Prices persist and drift rather than being re-rolled. (If they re-roll,
 *      nothing learned yesterday is worth anything.)
 *   3. Trends last a few days. (If they reverse nightly, they are noise.)
 *   4. Trading into a market moves it, and it heals when you leave. (If it
 *      doesn't, one good trade becomes the only strategy.)
 *   5. Nothing runs away over a full thirty-day run.
 */
import assert from 'node:assert/strict';
import { SNEAKERS } from '../data/sneakers.ts';
import { CITIES } from '../data/cities.ts';
import {
    seedWorld, advanceWorld, stepIndex, seedIndex, fairValue, relativeValue,
    applyTradePressure, trendFor, localValue, bestAsk,
} from '../systems/market/simulate.ts';
import { tagsFor } from '../systems/market/taxonomy.ts';
import { CITY_PROFILES, profileFor } from '../systems/market/cityProfiles.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

/** Deterministic PRNG so a failure is reproducible. */
function rng(seed = 12345): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

const byId = new Map(SNEAKERS.map(s => [s.id, s]));

/* ---------------- taxonomy ---------------- */

t('every sneaker gets at least one tag', () => {
    for (const s of SNEAKERS) {
        assert.ok(tagsFor(s).length > 0, `${s.id} has no tags`);
    }
});

t('the taxonomy is not degenerate — no single tag covers everything', () => {
    const counts = new Map<string, number>();
    for (const s of SNEAKERS) for (const tag of tagsFor(s)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    // At least five distinct tags in play, and none on more than 80% of models.
    assert.ok(counts.size >= 5, `only ${counts.size} tags in use`);
    for (const [tag, n] of counts) {
        assert.ok(n <= SNEAKERS.length * 0.8, `tag "${tag}" is on ${n}/${SNEAKERS.length} models`);
    }
});

t('the Jordans are basketball shoes and the luxury collabs are luxury', () => {
    const jordan = byId.get('jordan-1-retro-high-chicago');
    assert.ok(jordan, 'the Chicago 1 is missing from the catalogue');
    assert.ok(tagsFor(jordan!).includes('basketball'));

    const lv = byId.get('lv-nike-af1');
    assert.ok(lv, 'the LV AF1 is missing from the catalogue');
    assert.ok(tagsFor(lv!).includes('luxury'));
});

/* ---------------- city character ---------------- */

t('every city in the game has a market profile', () => {
    for (const c of CITIES) {
        assert.ok(CITY_PROFILES[c.id], `${c.id} has no market profile`);
    }
});

// Taste is measured relatively, against each city's own average, because
// absolute price conflates two different things: what a city wants, and how
// expensive it is. Paris can pay more dollars for a shoe it looks down on.
t('Chicago rates a Jordan well above its own average; Paris does not', () => {
    const jordan = byId.get('jordan-1-retro-high-chicago')!;
    const chi = relativeValue(jordan, 'chicago');
    const par = relativeValue(jordan, 'paris');
    assert.ok(chi > 1.1, `Chicago rates the Chicago 1 at only ${chi.toFixed(2)}x its own average`);
    assert.ok(chi > par * 1.15, `Chicago ${chi.toFixed(2)} vs Paris ${par.toFixed(2)} — not enough of a gap`);
});

t('Paris rates a luxury collab well above its own average; Chicago does not', () => {
    const lv = byId.get('lv-nike-af1')!;
    const par = relativeValue(lv, 'paris');
    const chi = relativeValue(lv, 'chicago');
    assert.ok(par > 1.1, `Paris rates the LV AF1 at only ${par.toFixed(2)}x its own average`);
    assert.ok(par > chi * 1.15, `Paris ${par.toFixed(2)} vs Chicago ${chi.toFixed(2)} — not enough of a gap`);
});

t('every model has a real spread between its best and worst city', () => {
    // This is the whole game: for any shoe, somewhere is cheap and somewhere
    // pays. A model with no spread anywhere is dead inventory by construction.
    let thin = 0;
    for (const s of SNEAKERS) {
        const values = CITIES.map(c => fairValue(s, c.id));
        const spread = Math.max(...values) / Math.min(...values);
        if (spread < 1.15) thin++;
    }
    assert.ok(thin === 0, `${thin} models have under a 15% spread across all six cities`);
});

t('no city is strictly better than another for everything', () => {
    // If one city beat another on all 45 models there would be no reason to
    // ever sell in the loser.
    for (const a of CITIES) {
        for (const b of CITIES) {
            if (a.id === b.id) continue;
            const aWins = SNEAKERS.filter(s => fairValue(s, a.id) > fairValue(s, b.id)).length;
            assert.ok(
                aWins > 0 && aWins < SNEAKERS.length,
                `${a.id} beats ${b.id} on ${aWins}/${SNEAKERS.length} models`,
            );
        }
    }
});

/* ---------------- persistence and drift ---------------- */

t('a seeded world gives every city an index for every model', () => {
    const world = seedWorld(rng());
    for (const c of CITIES) {
        const market = world[c.id];
        assert.ok(market, `${c.id} has no market`);
        for (const s of SNEAKERS) {
            assert.ok(market.index[s.id], `${c.id} has no index for ${s.id}`);
            assert.ok(market.index[s.id].value > 0, `${c.id}/${s.id} indexed at zero`);
        }
    }
});

t('every listing is priced above zero and references a real model', () => {
    const world = seedWorld(rng());
    for (const c of CITIES) {
        for (const l of world[c.id].sneakers) {
            assert.ok(byId.has(l.sneakerId), `${c.id} lists unknown model ${l.sneakerId}`);
            assert.ok(l.price > 0, `${c.id}/${l.sneakerId} priced at ${l.price}`);
            assert.ok(l.quantity > 0, `${c.id}/${l.sneakerId} stocked at ${l.quantity}`);
        }
    }
});

t('advancing a day moves prices but does not re-roll them', () => {
    const world = seedWorld(rng(7));
    const next = advanceWorld(world, rng(99));

    const before = Object.values(world['tokyo'].index).map(i => i.value);
    const after = Object.values(next['tokyo'].index).map(i => i.value);

    // Something moved...
    const moved = before.filter((v, i) => Math.abs(after[i] - v) > 1e-9).length;
    assert.ok(moved > before.length * 0.5, `only ${moved}/${before.length} prices moved overnight`);

    // ...but it is the same market, not a new one. A re-roll would give a
    // typical move far larger than this.
    const meanMove = before.reduce((acc, v, i) => acc + Math.abs(after[i] - v) / v, 0) / before.length;
    assert.ok(meanMove < 0.25, `mean overnight move was ${(meanMove * 100).toFixed(1)}% — that is a re-roll, not a drift`);
    assert.ok(meanMove > 0.002, `mean overnight move was ${(meanMove * 100).toFixed(3)}% — the market is frozen`);
});

t('listing identity survives a day — the same shops stock the same models', () => {
    const world = seedWorld(rng(3));
    const next = advanceWorld(world, rng(4));
    const key = (m: typeof world['tokyo']) => m.sneakers.map(l => `${l.group}:${l.sneakerId}`).join('|');
    for (const c of CITIES) {
        assert.equal(key(next[c.id]), key(world[c.id]), `${c.id} rearranged its shelves overnight`);
    }
});

t('the previous value is carried so the UI can show a delta', () => {
    const world = seedWorld(rng(11));
    const next = advanceWorld(world, rng(12));
    const s = SNEAKERS[0];
    assert.equal(next['paris'].index[s.id].previous, world['paris'].index[s.id].value);
    const trend = trendFor(next['paris'], s.id);
    assert.ok(trend, 'no trend produced');
    assert.ok(['up', 'down', 'flat'].includes(trend!.direction));
});

t('trends persist for more than one night', () => {
    // Momentum has to survive long enough to be actionable. Measured as: after
    // a day that moved up, the next day is more likely to move up than down.
    const r = rng(2024);
    let world = seedWorld(r);
    let sameDirection = 0;
    let total = 0;

    let prev = advanceWorld(world, r);
    for (let day = 0; day < 40; day++) {
        const next = advanceWorld(prev, r);
        // Compare the sign of consecutive nightly moves.
        for (const c of CITIES) {
            for (const s of SNEAKERS) {
                const d1 = prev[c.id].index[s.id].value - prev[c.id].index[s.id].previous;
                const d2 = next[c.id].index[s.id].value - next[c.id].index[s.id].previous;
                if (Math.abs(d1) < 1e-6 || Math.abs(d2) < 1e-6) continue;
                total++;
                if (Math.sign(d1) === Math.sign(d2)) sameDirection++;
            }
        }
        world = prev;
        prev = next;
    }

    const persistence = sameDirection / total;
    assert.ok(
        persistence > 0.55,
        `consecutive moves agreed only ${(persistence * 100).toFixed(1)}% of the time — trends are noise`,
    );
    assert.ok(
        persistence < 0.97,
        `consecutive moves agreed ${(persistence * 100).toFixed(1)}% of the time — prices are on rails`,
    );
});

/* ---------------- player pressure ---------------- */

t('buying pushes the local price up and selling pushes it down', () => {
    const world = seedWorld(rng(55));
    const s = SNEAKERS[5];
    const start = world['new-york'].index[s.id].value;

    const bought = applyTradePressure(world['new-york'], s.id, 5, 1);
    assert.ok(bought.index[s.id].value > start, 'buying five pairs did not move the price');

    const sold = applyTradePressure(world['new-york'], s.id, 5, -1);
    assert.ok(sold.index[s.id].value < start, 'selling five pairs did not move the price');
});

t('pressure is sub-linear — twenty pairs is not four times five pairs', () => {
    const world = seedWorld(rng(56));
    const s = SNEAKERS[6];
    const base = world['new-york'].index[s.id].value;

    const five = applyTradePressure(world['new-york'], s.id, 5, -1).index[s.id].value;
    const twenty = applyTradePressure(world['new-york'], s.id, 20, -1).index[s.id].value;

    const dropFive = base - five;
    const dropTwenty = base - twenty;
    assert.ok(dropTwenty > dropFive, 'dumping more did not hurt more');
    assert.ok(
        dropTwenty < dropFive * 4,
        `twenty pairs cost ${(dropTwenty / dropFive).toFixed(2)}x five pairs — pressure is not damped`,
    );
});

t('pressure also reprices the listings, not just the index', () => {
    const world = seedWorld(rng(57));
    const s = world['tokyo'].sneakers.find(l => !l.isFake)!;
    const before = world['tokyo'].sneakers.filter(l => l.sneakerId === s.sneakerId).map(l => l.price);
    const after = applyTradePressure(world['tokyo'], s.sneakerId, 8, 1)
        .sneakers.filter(l => l.sneakerId === s.sneakerId).map(l => l.price);
    assert.ok(after.some((p, i) => p > before[i]), 'the shelf price did not follow the index');
});

t('a dumped market heals over a few days away, but not instantly', () => {
    // Measured across every model rather than one, because a single model's
    // recovery is genuinely noisy — it can be back at the floor on day 7 and a
    // few percent over fair on day 8. The property that matters is the average.
    const r = rng(777);
    const world = seedWorld(r);
    const fairOf = (id: string) => fairValue(byId.get(id)!, 'chicago');

    let overnight = 0;
    let afterAWeek = 0;
    let dumpedAt = 0;
    const sample = SNEAKERS.slice(0, 20);

    for (const s of sample) {
        let market = world['chicago'];
        for (let i = 0; i < 6; i++) market = applyTradePressure(market, s.id, 6, -1);
        const fair = fairOf(s.id);
        dumpedAt += market.index[s.id].value / fair;

        let idx = stepIndex(market.index[s.id], s, 'chicago', r);
        overnight += idx.value / fair;

        for (let i = 0; i < 7; i++) idx = stepIndex(idx, s, 'chicago', r);
        afterAWeek += idx.value / fair;
    }

    const n = sample.length;
    dumpedAt /= n; overnight /= n; afterAWeek /= n;

    assert.ok(dumpedAt < 0.9, `dumping 36 pairs only reached ${dumpedAt.toFixed(3)}x fair on average`);
    assert.ok(overnight < 0.97, `a dumped market averaged ${overnight.toFixed(3)}x fair after one night — too quick`);
    assert.ok(
        afterAWeek > dumpedAt + 0.04,
        `after a week the average was ${afterAWeek.toFixed(3)}x fair, barely up from ${dumpedAt.toFixed(3)}x`,
    );
});

/* ---------------- a full run ---------------- */

t('nothing runs away over a thirty-day run', () => {
    const r = rng(31337);
    let world = seedWorld(r);
    for (let day = 0; day < 30; day++) world = advanceWorld(world, r);

    for (const c of CITIES) {
        for (const s of SNEAKERS) {
            const value = world[c.id].index[s.id].value;
            const fair = fairValue(s, c.id);
            assert.ok(Number.isFinite(value), `${c.id}/${s.id} went non-finite`);
            assert.ok(value > fair * 0.4, `${c.id}/${s.id} collapsed to ${(value / fair).toFixed(2)}x fair`);
            assert.ok(value < fair * 2.5, `${c.id}/${s.id} ran to ${(value / fair).toFixed(2)}x fair`);
        }
        for (const l of world[c.id].sneakers) {
            assert.ok(l.price >= 1 && Number.isFinite(l.price), `${c.id}/${l.sneakerId} priced at ${l.price}`);
            assert.ok(l.quantity >= 0, `${c.id}/${l.sneakerId} went to ${l.quantity} stock`);
        }
    }
});

t('there is a profitable flight available on a typical day', () => {
    // The playability check. On a freshly seeded world, at least a handful of
    // models should be buyable in one city and sellable in another for a real
    // margin — otherwise the core loop has nothing in it.
    const world = seedWorld(rng(2001));
    let opportunities = 0;
    let best = 0;

    for (const s of SNEAKERS) {
        for (const from of CITIES) {
            const ask = bestAsk(world[from.id], s.id);
            if (ask === undefined) continue;
            for (const to of CITIES) {
                if (to.id === from.id) continue;
                const bid = localValue(world[to.id], s.id);
                if (bid === undefined) continue;
                const margin = (bid - ask) / ask;
                if (margin > 0.2) opportunities++;
                best = Math.max(best, margin);
            }
        }
    }

    assert.ok(opportunities >= 20, `only ${opportunities} trades beat a 20% margin`);
    assert.ok(best > 0.5, `the best trade on the board was only ${(best * 100).toFixed(0)}%`);
    // The upper bound is the important half. A single flight that pays 5x ends a
    // thirty-day run on day three, which is exactly what the first tuning pass
    // shipped: see the band comments in simulate.ts.
    assert.ok(best < 2.0, `the best trade on the board was ${(best * 100).toFixed(0)}% — that is a bug, not a deal`);
});

t('fakes are cheap and real pairs are not', () => {
    const world = seedWorld(rng(42));
    for (const c of CITIES) {
        const market = world[c.id];
        for (const s of SNEAKERS) {
            const fakes = market.sneakers.filter(l => l.sneakerId === s.id && l.isFake);
            const reals = market.sneakers.filter(l => l.sneakerId === s.id && !l.isFake);
            if (!fakes.length || !reals.length) continue;
            const maxFake = Math.max(...fakes.map(l => l.price));
            const minReal = Math.min(...reals.map(l => l.price));
            assert.ok(maxFake < minReal, `${c.id}: a fake ${s.id} costs more than a real one`);
        }
    }
});

t('Tel Aviv is the cheap deep market and Paris is the thin expensive one', () => {
    assert.ok(profileFor('tel-aviv').supply > profileFor('paris').supply);
    assert.ok(profileFor('paris').costOfLiving > profileFor('tel-aviv').costOfLiving);
    assert.ok(profileFor('tel-aviv').fakeRate > profileFor('paris').fakeRate);
});

console.log(`\n${pass} market checks passed.`);
