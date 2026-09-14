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
    type AuthGrade,
} from '../systems/market/authenticity.ts';

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

console.log(`\n${pass} authenticity checks passed.\n`);
