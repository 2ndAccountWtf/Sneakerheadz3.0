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
    snapshotMarket, intelConfidence,
    scarcityFor, localStock, referenceAsk, addLocalStock,
} from '../systems/market/simulate.ts';
import { tagsFor } from '../systems/market/taxonomy.ts';
import { getCityMarketPrice, getSellPrice } from '../systems/pricing.ts';
import { gameReducer } from '../hooks/useGame.ts';
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
    // Started from fair value rather than from a seeded price. A market that
    // happens to be sitting on its floor cannot be pushed any lower, so seeding
    // one and hoping it has room is a test that passes or fails by luck.
    const world = seedWorld(rng(56));
    const s = SNEAKERS[6];
    const fair = fairValue(s, 'new-york');
    const atFair = {
        ...world['new-york'],
        index: { ...world['new-york'].index, [s.id]: { value: fair, momentum: 0, previous: fair } },
    };

    const five = applyTradePressure(atFair, s.id, 5, -1).index[s.id].value;
    const twenty = applyTradePressure(atFair, s.id, 20, -1).index[s.id].value;

    const dropFive = fair - five;
    const dropTwenty = fair - twenty;
    assert.ok(dropFive > 0, 'selling five pairs did not move a market sitting at fair value');
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

/* ---------------- what the player knows ---------------- */

t('a snapshot records every model at the price it was on that day', () => {
    const world = seedWorld(rng(101));
    const intel = snapshotMarket(world['paris'], 7);
    assert.equal(intel.cityId, 'paris');
    assert.equal(intel.day, 7);
    for (const s of SNEAKERS) {
        assert.equal(intel.prices[s.id], localValue(world['paris'], s.id), `${s.id} snapshotted wrong`);
    }
});

t('a snapshot does not move when the city does', () => {
    // This is the whole point of intel: it is a memory, not a live feed. If the
    // snapshot aliased the market the cross-city table would silently become a
    // cheat sheet.
    const r = rng(102);
    const world = seedWorld(r);
    const intel = snapshotMarket(world['tokyo'], 1);
    const before = { ...intel.prices };

    let moved = world;
    for (let i = 0; i < 5; i++) moved = advanceWorld(moved, r);

    for (const s of SNEAKERS) {
        assert.equal(intel.prices[s.id], before[s.id], `${s.id} intel changed under us`);
    }
    // And the live market really did move, so the check above means something.
    const drifted = SNEAKERS.filter(s => localValue(moved['tokyo'], s.id) !== before[s.id]).length;
    assert.ok(drifted > SNEAKERS.length / 2, `only ${drifted} prices moved in five days`);
});

t('confidence in a remembered price decays and bottoms out at zero', () => {
    const world = seedWorld(rng(103));
    const intel = snapshotMarket(world['chicago'], 10);
    assert.equal(intel.day, 10);
    assert.ok(intelConfidence(intel, 10) > 0.99, 'a price seen today is not trusted');
    assert.ok(intelConfidence(intel, 13) < intelConfidence(intel, 11), 'confidence does not decay');
    assert.equal(intelConfidence(intel, 40), 0, 'a month-old price is still trusted');
    assert.equal(intelConfidence(undefined, 5), 0, 'never having been somewhere reads as confidence');
});

t('a city keeps a readable price history from day one', () => {
    const world = seedWorld(rng(104));
    for (const s of SNEAKERS.slice(0, 10)) {
        const series = world['new-york'].history[s.id];
        assert.ok(series, `${s.id} has no history`);
        assert.ok(series.length > 10, `${s.id} has only ${series.length} points — a chart needs a shape`);
        assert.ok(series.every(v => v > 0 && Number.isFinite(v)), `${s.id} history has a bad value`);
        // The series must end where the simulation currently is, or the chart
        // disagrees with the shop.
        assert.equal(series[series.length - 1], localValue(world['new-york'], s.id), `${s.id} chart ends somewhere else`);
    }
    assert.ok(world['new-york'].preRunDays > 0, 'no invented past is marked as invented');
});

t('history grows by exactly one point a day and stays bounded', () => {
    const r = rng(105);
    let world = seedWorld(r);
    const s = SNEAKERS[3];
    const start = world['tokyo'].history[s.id].length;

    world = advanceWorld(world, r);
    assert.equal(world['tokyo'].history[s.id].length, start + 1, 'a day did not add exactly one close');

    for (let i = 0; i < 200; i++) world = advanceWorld(world, r);
    assert.ok(world['tokyo'].history[s.id].length <= 96, 'history grew without bound');
    assert.ok(world['tokyo'].preRunDays >= 0, 'the invented-past marker went negative');
});

/* ---------------- liquidity ---------------- */

t('every pair is worth something in every city', () => {
    // The bug this guards against made the game feel broken rather than hard.
    // Value used to be read off shop *listings*, and a city stocks three to
    // eight models per tab out of forty-five — so about half of what you were
    // carrying had no price wherever you stood, the Sell button was disabled,
    // and in Paris a ten-pair bag had one sellable pair in it. Players read that
    // as "you cannot sell anything", which is exactly what it was.
    const world = seedWorld(rng(4242));
    for (const c of CITIES) {
        for (const s of SNEAKERS) {
            const value = localValue(world[c.id], s.id);
            assert.ok(
                value !== undefined && value > 0,
                `${s.id} has no value in ${c.id} — it cannot be sold there`,
            );
        }
    }
});

t('a city with nothing on the shelf still knows what a shoe is worth', () => {
    // Supply and valuation are different questions. A city having none in stock
    // says something about buying, and nothing about whether anyone there would
    // give you money for the pair on your feet.
    const world = seedWorld(rng(4243));
    let citiesWithGaps = 0;
    for (const c of CITIES) {
        const listed = new Set(world[c.id].sneakers.map(l => l.sneakerId));
        const unlisted = SNEAKERS.filter(s => !listed.has(s.id));
        if (!unlisted.length) continue;
        citiesWithGaps++;
        for (const s of unlisted) {
            assert.ok(localValue(world[c.id], s.id)! > 0, `${c.id} cannot value the unstocked ${s.id}`);
        }
    }
    assert.ok(citiesWithGaps > 0, 'every city stocked every model — the test proves nothing');
});

/* ---------------- scarcity ---------------- */

/**
 * The sell-side price: index, times the scarcity multiplier, capped just under
 * the posted shelf price. Duplicated here rather than imported because
 * `pricing.ts` takes a whole GameState and most of these checks only have a
 * market.
 *
 * A duplicate is a liability, and this one already cost us. For a long time
 * `getCityMarketPrice` did something else entirely — `max(posted price)`, no
 * scarcity, no spread, no cap — so the same-city round trip these checks call
 * impossible was live in the game at up to +27%. They passed throughout,
 * because they were only ever testing this local copy. The section at the end
 * of this file drives the actual function, and that is the one that would have
 * caught it.
 */
const BID_ASK = 0.9;
const sellValue = (market: ReturnType<typeof seedWorld>[string], sneakerId: string): number => {
    const raw = localValue(market, sneakerId)! * scarcityFor(market, sneakerId).multiplier * BID_ASK;
    const posted = referenceAsk(market, sneakerId);
    return Math.max(1, Math.round(posted === undefined ? raw : Math.min(raw, posted * BID_ASK)));
};

t('an empty shelf pays a premium only where the city wants the thing', () => {
    // Supply and demand, both halves. A city with none in stock *because nobody
    // there wants any* is not scarce, it is uninterested — paying a bonus there
    // would reward carrying junk to the one city least interested in it.
    const world = seedWorld(rng(31));
    let unwantedAndEmpty = 0;

    for (const c of CITIES) {
        for (const s of SNEAKERS) {
            const scarcity = scarcityFor(world[c.id], s.id);
            if (localStock(world[c.id], s.id) !== 0) continue;
            if (relativeValue(s, c.id) >= 1) continue;
            unwantedAndEmpty++;
            assert.ok(
                scarcity.multiplier <= 1.001,
                `${c.id} pays ${scarcity.multiplier.toFixed(2)}x for a ${s.id} it has none of and does not want`,
            );
        }
    }
    assert.ok(unwantedAndEmpty > 10, `only ${unwantedAndEmpty} empty-and-unwanted cases — the check proves little`);
});

t('scarcity is bounded and does pay where it is real', () => {
    const world = seedWorld(rng(32));
    let premium = 0;
    let best = 1;
    for (const c of CITIES) {
        for (const s of SNEAKERS) {
            const m = scarcityFor(world[c.id], s.id).multiplier;
            assert.ok(m > 0.7 && m < 1.45, `${c.id}/${s.id}: scarcity multiplier ${m}`);
            if (m > 1.02) premium++;
            best = Math.max(best, m);
        }
    }
    assert.ok(premium > 20, `only ${premium} models anywhere command a scarcity premium`);
    assert.ok(best > 1.15, `the best scarcity premium is only ${best.toFixed(2)}x — not worth a flight`);
});

t('no price effect goes unexplained on screen', () => {
    // A premium the player cannot see is not a mechanic, it is a number that
    // moves for no visible reason. The first cut only spoke up above an 8%
    // effect, which left 53 of 270 model/city pairs quietly paying over with
    // nothing on screen and put a note on 7% of the models actually in stock —
    // which is to say, almost none of the ones anybody ever looks at.
    const world = seedWorld(rng(1));
    let silent = 0;
    let stocked = 0;
    let stockedWithNote = 0;

    for (const c of CITIES) {
        for (const s of SNEAKERS) {
            const sc = scarcityFor(world[c.id], s.id);
            if (!sc.note && Math.abs(sc.multiplier - 1) > 0.02) silent++;
            if (localStock(world[c.id], s.id) > 0) {
                stocked++;
                if (sc.note) stockedWithNote++;
            }
        }
    }

    assert.equal(silent, 0, `${silent} model/city pairs move the price with nothing said about it`);
    assert.ok(
        stockedWithNote / stocked > 0.25,
        `only ${(100 * stockedWithNote / stocked).toFixed(0)}% of in-stock models say anything about supply`,
    );
});

t('you cannot buy the last pair and sell it straight back for a profit', () => {
    // The exploit scarcity creates if nothing guards it: clear the last pairs
    // out of a city, the empty shelf pays a premium, sell one back to the city
    // you just bought it from. Measured before the bid-ask cap existed, 29 of
    // 32 such round trips turned a profit and the best of them was 66%.
    const world = seedWorld(rng(31));
    let tested = 0;
    let profitable = 0;
    let best = -Infinity;

    for (const c of CITIES) {
        for (const s of SNEAKERS) {
            const ask = bestAsk(world[c.id], s.id);
            if (ask === undefined) continue;
            const stock = localStock(world[c.id], s.id);
            if (stock > 2) continue;

            tested++;
            let cleared = applyTradePressure(world[c.id], s.id, stock, 1);
            cleared = {
                ...cleared,
                sneakers: cleared.sneakers.map(l =>
                    l.sneakerId === s.id && !l.isFake ? { ...l, quantity: 0 } : l),
            };

            const edge = (sellValue(cleared, s.id) - ask) / ask;
            if (edge > 0) profitable++;
            best = Math.max(best, edge);
        }
    }

    assert.ok(tested > 10, `only ${tested} clearable models — the check proves little`);
    assert.equal(profitable, 0, `${profitable} of ${tested} buy-out round trips turned a profit`);
    assert.ok(best < 0, `the best round trip made ${(best * 100).toFixed(1)}%`);
});

t('nothing can be flipped in the same city on the same day', () => {
    // The general form of the rule: a buyer never pays more than the shop down
    // the road is charging, so buy-and-immediately-sell always loses the spread.
    const world = seedWorld(rng(33));
    let tested = 0;
    let profitable = 0;

    for (const c of CITIES) {
        for (const s of SNEAKERS) {
            const ask = bestAsk(world[c.id], s.id);
            if (ask === undefined) continue;
            tested++;
            if (sellValue(world[c.id], s.id) > ask) profitable++;
        }
    }

    assert.ok(tested > 50, `only ${tested} buyable models`);
    assert.equal(profitable, 0, `${profitable} of ${tested} models could be flipped on the spot`);
});

t('the trade that pays is still the flight, not the shelf', () => {
    // Scarcity must not overtake geography. Cross-city arbitrage is the game;
    // scarcity is a reason to prefer one destination over another.
    const world = seedWorld(rng(34));
    let opportunities = 0;
    let best = 0;

    for (const s of SNEAKERS) {
        for (const from of CITIES) {
            const ask = bestAsk(world[from.id], s.id);
            if (ask === undefined) continue;
            for (const to of CITIES) {
                if (to.id === from.id) continue;
                const margin = (sellValue(world[to.id], s.id) - ask) / ask;
                if (margin > 0.2) opportunities++;
                best = Math.max(best, margin);
            }
        }
    }

    assert.ok(opportunities >= 20, `only ${opportunities} flights beat a 20% margin`);
    assert.ok(best < 2.6, `the best flight on the board pays ${(best * 100).toFixed(0)}% — that is a bug, not a deal`);
});

t('working the best trade thins it out', () => {
    // The number above is a *first pair* margin, and on its own it would be
    // alarming. What keeps it honest is that it decays as the bag empties: each
    // sale walks the index down and puts a pair on the local shelf, which is
    // what collapses the shortage premium. Before selling registered as stock,
    // a dry city stayed dry for ever and paid the shortage premium on the tenth
    // pair as happily as the first — ten pairs realised 219%, barely under the
    // 269% first pair.
    const world = seedWorld(rng(34));

    let bestMargin = -Infinity;
    let pick: { id: string; from: string; to: string; ask: number } | null = null;
    for (const s of SNEAKERS) {
        for (const from of CITIES) {
            const ask = bestAsk(world[from.id], s.id);
            if (ask === undefined) continue;
            for (const to of CITIES) {
                if (to.id === from.id) continue;
                const margin = (sellValue(world[to.id], s.id) - ask) / ask;
                if (margin > bestMargin) { bestMargin = margin; pick = { id: s.id, from: from.id, to: to.id, ask }; }
            }
        }
    }
    assert.ok(pick, 'no tradeable model found at all');

    const realised = (qty: number): number => {
        let dst = world[pick!.to];
        let revenue = 0;
        for (let i = 0; i < qty; i++) {
            revenue += sellValue(dst, pick!.id);
            dst = addLocalStock(applyTradePressure(dst, pick!.id, 1, -1), pick!.id);
        }
        return (revenue - pick!.ask * qty) / (pick!.ask * qty);
    };

    const one = realised(1);
    const ten = realised(10);
    assert.ok(ten < one * 0.7, `ten pairs realised ${(ten * 100).toFixed(0)}% against ${(one * 100).toFixed(0)}% for one — barely any decay`);
    assert.ok(ten < 1.6, `a full bag through the best trade on the board realised ${(ten * 100).toFixed(0)}%`);
    assert.ok(ten > 0.1, `a full bag realised only ${(ten * 100).toFixed(0)}% — the decay has eaten the whole trade`);
});

t('a pair sold into a city is on a shelf in that city afterwards', () => {
    const world = seedWorld(rng(35));
    const dry = SNEAKERS.find(s => localStock(world['paris'], s.id) === 0);
    assert.ok(dry, 'Paris stocks every model, so there is nothing to check');

    const after = addLocalStock(world['paris'], dry!.id);
    assert.equal(localStock(after, dry!.id), 1, 'selling a pair into a dry city left it dry');
    assert.ok(
        scarcityFor(after, dry!.id).multiplier <= scarcityFor(world['paris'], dry!.id).multiplier,
        'the shortage premium did not soften after the shortage was eased',
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

console.log('\nthe real sell price, not a copy of it');

t('you cannot buy a pair and sell it back in the same city for a profit', () => {
    // The check that matters, against the function the game actually calls.
    // `getCityMarketPrice` is what every sell path reads — the bag's Sell
    // button, the street screen, the collectors screen — so this is the rule as
    // the player meets it, not as a test helper restates it.
    let tested = 0;
    let profitable = 0;
    let best = -Infinity;

    for (const seed of [33, 34, 7, 2001, 99]) {
        const markets = seedWorld(rng(seed));
        for (const c of CITIES) {
            const state = {
                markets, currentCityId: c.id, day: 1,
                activeMarketSignals: [], player: { buffs: [], inventory: [] },
            } as never;

            for (const sn of SNEAKERS) {
                const ask = bestAsk(markets[c.id], sn.id);
                if (ask === undefined) continue;
                const bid = getCityMarketPrice(state, sn.id);
                if (bid === undefined) continue;
                const got = getSellPrice(bid, { sneakerId: sn.id, purchasePrice: ask } as never, { buffs: [] } as never);
                tested++;
                if (got > ask) profitable++;
                best = Math.max(best, (got - ask) / ask);
            }
        }
    }

    assert.ok(tested > 300, `only ${tested} buyable models — the check proves little`);
    assert.equal(profitable, 0, `${profitable} of ${tested} models flip on the spot for a profit`);
    assert.ok(best < 0, `the best same-city round trip makes ${(best * 100).toFixed(1)}%`);
});

t('the bid is never above the cheapest shelf in town', () => {
    // The structural half of the same rule: whatever scarcity is doing, nobody
    // pays you more than the shop down the road is charging.
    const markets = seedWorld(rng(34));
    for (const c of CITIES) {
        const state = {
            markets, currentCityId: c.id, day: 1,
            activeMarketSignals: [], player: { buffs: [], inventory: [] },
        } as never;

        for (const sn of SNEAKERS) {
            const posted = referenceAsk(markets[c.id], sn.id);
            if (posted === undefined) continue;
            const bid = getCityMarketPrice(state, sn.id);
            if (bid === undefined) continue;
            assert.ok(bid <= posted, `${c.id}/${sn.id}: bid ${bid} beats the ${posted} shelf`);
        }
    }
});

t('every model is worth something everywhere', () => {
    // The old implementation returned undefined when no listing existed, so a
    // model nobody in town stocks was worth nothing at all. The index knows.
    const markets = seedWorld(rng(12));
    const state = {
        markets, currentCityId: CITIES[0].id, day: 1,
        activeMarketSignals: [], player: { buffs: [], inventory: [] },
    } as never;
    for (const sn of SNEAKERS) {
        assert.ok((getCityMarketPrice(state, sn.id) ?? 0) > 0, `${sn.id} is worth nothing anywhere`);
    }
});

console.log('\nselling privately still moves the market');

t('a street or collector sale walks the local price down', () => {
    // The shop counter has always applied trade pressure. The street and the
    // collectors did not, so a corner was a pressure-free dump: you could work
    // one spot for a month and the price you were getting never budged. Both
    // private paths now push on the city they happened in.
    const markets = seedWorld(rng(71));
    const cityId = CITIES[0].id;
    const model = SNEAKERS[0].id;
    const state = {
        markets, currentCityId: cityId, day: 3,
        player: {} as never, outcomeLog: [],
    } as unknown as Parameters<typeof gameReducer>[0];

    const before = localValue(markets[cityId], model)!;
    const after = gameReducer(state, {
        type: 'RESOLVE_STREET_SALE',
        payload: { player: {} as never, log: [], soldId: model },
    } as never);
    const now = localValue(after.markets[cityId], model)!;

    assert.ok(now < before, `selling on the street left the price at ${now} (was ${before})`);
});

t('a deal that fell through moves nothing', () => {
    // `soldId` is absent when nobody bought anything — a walked negotiation, a
    // bust, a robbery. None of those are supply hitting the city.
    const markets = seedWorld(rng(71));
    const cityId = CITIES[0].id;
    const model = SNEAKERS[0].id;
    const state = {
        markets, currentCityId: cityId, day: 3,
        player: {} as never, outcomeLog: [],
    } as unknown as Parameters<typeof gameReducer>[0];

    const before = localValue(markets[cityId], model)!;
    const after = gameReducer(state, {
        type: 'RESOLVE_COLLECTOR_DEAL',
        payload: { player: {} as never, log: [] },
    } as never);

    assert.equal(localValue(after.markets[cityId], model)!, before, 'a walked deal moved the price');
});

t('a private sale does not put the pair on a retail shelf', () => {
    // A shop sale calls `addLocalStock` as well, because the pair really is on
    // that shop's shelf afterwards. A man on a corner is not a shop, so the
    // scarcity premium must survive the sale.
    const markets = seedWorld(rng(71));
    const cityId = CITIES[0].id;
    const model = SNEAKERS[0].id;
    const state = {
        markets, currentCityId: cityId, day: 3,
        player: {} as never, outcomeLog: [],
    } as unknown as Parameters<typeof gameReducer>[0];

    const before = localStock(markets[cityId], model);
    const after = gameReducer(state, {
        type: 'RESOLVE_STREET_SALE',
        payload: { player: {} as never, log: [], soldId: model },
    } as never);

    assert.equal(localStock(after.markets[cityId], model), before, 'a street sale restocked a shop');
});

console.log(`\n${pass} market checks passed.`);
