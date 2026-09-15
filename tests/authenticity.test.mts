/**
 * The authenticity ladder.
 *
 * `isFake` being a boolean is why the counterfeit game has never been a game:
 * a fake costs 15% of real value, so it is a discount bin rather than a scam,
 * and the margin comes from the buyer failing a dice roll instead of from
 * anything the player planned. These checks cover the ladder that replaces it
 * and — just as important — that nothing which reads the old boolean breaks
 * while it is being replaced. Twenty-nine files do.
 */
import assert from 'node:assert/strict';
import {
    AUTH_GRADES, GRADE_COST, GRADE_DIFFICULTY, GRADE_LABEL,
    gradeOf, isCounterfeit, fakeFlagFor, spotChance, gradePrice,
    claimedGradeOf, isPassedOff, leakRateFor, gradeForLeak,
    LEAK_RATE, checkChance, caughtWith, catchChance, CHECK_FLOOR, CHECK_CEILING,
    type AuthGrade,
} from '../systems/market/authenticity.ts';
import { rngFor } from '../utils/rng.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

console.log('\nthe ladder');

t('every grade is priced, weighted and named', () => {
    for (const g of AUTH_GRADES) {
        assert.ok(GRADE_COST[g] > 0, `${g} has no cost`);
        assert.ok(GRADE_DIFFICULTY[g] >= 0, `${g} has no difficulty`);
        assert.ok(GRADE_LABEL[g]?.length, `${g} has no label`);
    }
});

t('a better fake costs more and hides better', () => {
    // The two axes have to move together or the ladder has a dominant rung.
    const fakes: AuthGrade[] = ['street', 'super', 'unauthorised'];
    for (let i = 1; i < fakes.length; i++) {
        assert.ok(GRADE_COST[fakes[i]] > GRADE_COST[fakes[i - 1]],
            `${fakes[i]} is not dearer than ${fakes[i - 1]}`);
        assert.ok(GRADE_DIFFICULTY[fakes[i]] < GRADE_DIFFICULTY[fakes[i - 1]],
            `${fakes[i]} is not harder to spot than ${fakes[i - 1]}`);
    }
});

t('the real thing is never a fake and is never spotted as one', () => {
    assert.equal(isCounterfeit('retail'), false);
    assert.equal(GRADE_DIFFICULTY.retail, 0);
    for (const eye of [0, 0.5, 1]) assert.equal(spotChance(eye, 'retail'), 0);
});

t('street reps still cost exactly what they always did', () => {
    // The ladder is a superset of current behaviour, not a change to it.
    assert.equal(GRADE_COST.street, 0.15);
    assert.equal(gradePrice(1000, 'street'), 150);
});

t('an unauthorised pair is real capital at risk', () => {
    // The main brake on reps being strictly optimal: get it wrong and you have
    // lost serious money, not pocket change.
    assert.ok(GRADE_COST.unauthorised > 0.5, `${GRADE_COST.unauthorised} is not an investment`);
});

console.log('\nwho gets caught');

t('a sharp eye beats a bad fake and struggles with a good one', () => {
    const sharp = 0.45;
    assert.ok(spotChance(sharp, 'street') > spotChance(sharp, 'super'));
    assert.ok(spotChance(sharp, 'super') > spotChance(sharp, 'unauthorised'));
});

t('who you sell to is the decision', () => {
    // The whole point of the difficulty multiplier: the same pair is nearly
    // safe with a tourist and a coin toss with somebody who knows the model.
    const tourist = 0.12, collector = 0.9;
    const unauth = 'unauthorised' as const;
    assert.ok(spotChance(tourist, unauth) < 0.06, `a tourist spots it ${spotChance(tourist, unauth)}`);
    assert.ok(spotChance(collector, unauth) > 0.2, `a collector barely notices at ${spotChance(collector, unauth)}`);
});

t('nobody is ever certain', () => {
    // A wall that always catches you ends the strategy instead of pricing it.
    for (const g of AUTH_GRADES) {
        assert.ok(spotChance(50, g) <= 0.97, `${g} is a certainty at a high enough eye`);
    }
});

t('a hopeless examiner never catches anything', () => {
    for (const g of AUTH_GRADES) assert.equal(spotChance(0, g), 0);
});

console.log('\nnot breaking the twenty-nine files that read the boolean');

t('a pair from before the ladder still resolves', () => {
    assert.equal(gradeOf({ isFake: true }), 'street', 'an old fake lost its grade');
    assert.equal(gradeOf({ isFake: false }), 'retail');
    assert.equal(gradeOf({}), 'retail', 'an item with neither should be real');
});

t('an explicit grade wins over a stale boolean', () => {
    assert.equal(gradeOf({ grade: 'unauthorised', isFake: true }), 'unauthorised');
    assert.equal(gradeOf({ grade: 'retail', isFake: false }), 'retail');
});

t('the boolean and the ladder never disagree', () => {
    for (const g of AUTH_GRADES) {
        assert.equal(fakeFlagFor(g), isCounterfeit(g), `${g} disagrees with itself`);
        assert.equal(gradeOf({ grade: g, isFake: fakeFlagFor(g) }), g, `${g} does not round-trip`);
    }
});

t('an old fake prices the same as it used to', () => {
    // Nothing a player already owns silently changes value under them.
    assert.equal(gradePrice(2400, gradeOf({ isFake: true })), Math.round(2400 * 0.15));
});

console.log('\nthe leak');

t('an honest listing claims exactly what it is', () => {
    for (const g of AUTH_GRADES) {
        assert.equal(claimedGradeOf({ grade: g }), g, `${g} misreports itself`);
        assert.equal(isPassedOff({ grade: g }), false, `${g} is lying about nothing`);
    }
    // And a listing from before any of this resolves the same way.
    assert.equal(claimedGradeOf({ isFake: true }), 'street');
    assert.equal(claimedGradeOf({}), 'retail');
});

t('passing off is claiming to be worth more than you are', () => {
    assert.equal(isPassedOff({ grade: 'super', claimed: 'retail' }), true);
    assert.equal(isPassedOff({ grade: 'street', claimed: 'retail' }), true);
    // Honest in the other direction: a real pair on a rep table is not a scam,
    // it is a bargain, and it must never be counted as one.
    assert.equal(isPassedOff({ grade: 'retail', claimed: 'street' }), false);
});

t('the careful shop leaks least and the trunk leaks most', () => {
    assert.ok(leakRateFor(0) > leakRateFor(1), 'a stall should be worse than a shop');
    assert.ok(leakRateFor(1) > leakRateFor(2), 'a shop should be worse than a gallery');
    // Nowhere is clean. If the gallery were airtight it would be the only
    // place anyone ever shopped, and the question would stop being a question.
    assert.ok(leakRateFor(2) > 0, 'somewhere is airtight');
    assert.ok(leakRateFor(0) < 0.5, 'more than half fake is not a shop, it is a rep table');
});

t('an unknown rigour is treated as an ordinary shop', () => {
    assert.equal(leakRateFor(7), LEAK_RATE[1]);
    assert.equal(leakRateFor(-1), LEAK_RATE[1]);
});

t('an obvious rep never survives a gallery intake', () => {
    const rng = rngFor('leak-grades');
    for (let i = 0; i < 400; i++) {
        assert.notEqual(gradeForLeak(2, rng), 'street', 'a gallery is holding an obvious rep');
    }
});

t('the worse the shop, the worse the paper it will carry', () => {
    const count = (level: number) => {
        const rng = rngFor(`leak-mix-${level}`);
        let bad = 0;
        for (let i = 0; i < 2000; i++) if (gradeForLeak(level, rng) === 'street') bad++;
        return bad / 2000;
    };
    const stall = count(0);
    const shop = count(1);
    assert.ok(stall > shop, `stall ${stall} should carry more junk than shop ${shop}`);
    assert.ok(shop > 0, 'an ordinary shop never carrying junk makes rigour meaningless');
});

t('every leak is a fake, and never the real thing', () => {
    const rng = rngFor('leak-is-fake');
    for (const level of [0, 1, 2]) {
        for (let i = 0; i < 300; i++) {
            const g = gradeForLeak(level, rng);
            assert.equal(isCounterfeit(g), true, `level ${level} leaked a real pair`);
        }
    }
});

t('a leak is listed at the price of what it claims to be', () => {
    // No discount, no tell. Measured: this economy has no room for cheaper real
    // stock, so the price signal was cut and the mystery rests on rigour, seller
    // talk and a paid LegitCheck instead. See the note in authenticity.ts.
    assert.equal(GRADE_COST[claimedGradeOf({ grade: 'super', claimed: 'retail' })], GRADE_COST.retail);
});

console.log('\nlooking is not the same as seeing');

t('even the laziest counter in the game gives it a look', () => {
    // The whole reason reps did not pay: a securityLevel 0 counter worked out at
    // a 7% chance of catching an unauthorised pair, so a rep-runner was searched
    // 0.4 times in thirty simulated days. A floor puts the risk back.
    const lazy = checkChance({ securityLevel: 0 });
    assert.ok(lazy >= CHECK_FLOOR, `a trunk checks ${lazy}, under the floor`);
    assert.ok(lazy <= 0.2, `a trunk checks ${lazy} — that is not a trunk, that is a shop`);
});

t('the better the shop, the more often it looks', () => {
    const a = checkChance({ securityLevel: 0 });
    const b = checkChance({ securityLevel: 1 });
    const c = checkChance({ securityLevel: 2 });
    assert.ok(a < b && b < c, `not monotonic in rigour: ${a}, ${b}, ${c}`);
    assert.ok(c > 0.8, `a gallery only checks ${c} of the time`);
});

t('nobody is ever a certainty', () => {
    // A ceiling below 1 means there is always a shop worth trying, which keeps
    // "notorious" a hostile way to play rather than a dead end.
    const worst = checkChance({ securityLevel: 2, suspicion: 1, heat: 100 });
    assert.ok(worst <= CHECK_CEILING, `the worst case is ${worst}, a certainty`);
});

t('a shop that has caught you before stops being lazy', () => {
    const cold = checkChance({ securityLevel: 0 });
    const burned = checkChance({ securityLevel: 0, suspicion: 1 });
    assert.ok(burned > cold * 3, `being remembered only moved it ${cold} -> ${burned}`);
    assert.ok(burned > 0.8, `a shop that caught you still only checks ${burned}`);
});

t('heat leans on it without deciding it', () => {
    const cool = checkChance({ securityLevel: 1, heat: 0 });
    const hot = checkChance({ securityLevel: 1, heat: 100 });
    assert.ok(hot > cool, 'heat did nothing');
    assert.ok(hot - cool < 0.3, 'heat is doing the shop rigour\'s job');
});

t('a distracted clerk checks less, but somebody always glances', () => {
    const sober = checkChance({ securityLevel: 2 });
    const beered = checkChance({ securityLevel: 2, distraction: 0.6 });
    assert.ok(beered < sober, 'the beers did nothing');
    // Never a cloak: a full distraction must not reach zero, or the schmooze
    // becomes permanent immunity and the rep game stops being a gamble.
    const blackout = checkChance({ securityLevel: 2, distraction: 1 });
    assert.ok(blackout > 0, 'a schmooze bought total immunity');
});

t('the real thing is never caught, however hard they look', () => {
    const always = () => 0;   // every roll succeeds
    assert.equal(caughtWith({ grade: 'retail' }, { securityLevel: 2, suspicion: 1 }, 1, always), false);
    assert.equal(caughtWith({}, { securityLevel: 2, suspicion: 1 }, 1, always), false);
});

t('a fake is only caught when they both look and see', () => {
    const never = () => 0.999;  // every roll fails
    const always = () => 0;
    assert.equal(caughtWith({ grade: 'street' }, { securityLevel: 2 }, 1, always), true);
    assert.equal(caughtWith({ grade: 'street' }, { securityLevel: 2 }, 1, never), false);
    // Looked but could not see: a perfect eye is wasted on a grade it cannot read.
    assert.equal(caughtWith({ grade: 'unauthorised' }, { securityLevel: 2 }, 0, always), false);
});

t('the grimy counter is no longer a free dump', () => {
    // The number the simulation complained about. Passing an unauthorised pair
    // over the worst counter in the game used to be caught ~7% of the time.
    let caught = 0;
    const rng = rngFor('grimy-counter');
    for (let i = 0; i < 4000; i++) {
        if (caughtWith({ grade: 'unauthorised' }, { securityLevel: 0, heat: 20 }, 0.5, rng)) caught++;
    }
    const rate = caught / 4000;
    // Still the safest channel — that is correct, it is why you would use it —
    // but no longer free.
    assert.ok(rate > 0.01, `only ${(rate * 100).toFixed(1)}% caught; still a free dump`);
    assert.ok(rate < 0.2, `${(rate * 100).toFixed(1)}% caught; the grimy shop is no longer worth using`);
});

t('who you sell to is still the decision', () => {
    // The point of the whole ladder. The same pair, over two counters.
    const run = (securityLevel: number, eye: number) => {
        const rng = rngFor(`channel-${securityLevel}`);
        let caught = 0;
        for (let i = 0; i < 4000; i++) {
            if (caughtWith({ grade: 'super' }, { securityLevel }, eye, rng)) caught++;
        }
        return caught / 4000;
    };
    const trunk = run(0, 0.3);
    const gallery = run(2, 0.8);
    assert.ok(gallery > trunk * 4, `the gallery (${gallery}) is barely worse than the trunk (${trunk})`);
});

t('the odds and the roll agree', () => {
    // `catchChance` is the number, `caughtWith` is the roll. They must not be
    // allowed to drift: a second hand-written copy of check x spot is exactly
    // how the single-roll bug survived three call sites.
    const look = { securityLevel: 1, heat: 30 };
    const eye = 0.6;
    const p = catchChance({ grade: 'super' }, look, eye);
    const rng = rngFor('odds-vs-roll');
    let caught = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (caughtWith({ grade: 'super' }, look, eye, rng)) caught++;
    const observed = caught / N;
    assert.ok(Math.abs(observed - p) < 0.02, `stated ${p.toFixed(3)} but rolled ${observed.toFixed(3)}`);
});

t('the real thing has no odds against it at all', () => {
    assert.equal(catchChance({ grade: 'retail' }, { securityLevel: 2, suspicion: 1 }, 1), 0);
});

console.log(`\n${pass} authenticity checks passed.\n`);
