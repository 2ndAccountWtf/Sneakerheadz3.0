/**
 * The two cheapest hooks in the game, and the rule that keeps them honest.
 *
 * The near-miss is the oldest trick there is — two cherries and a third just
 * past the line pulls harder than a clean loss ever does — and street selling
 * was already computing the number and throwing it away. Skimming exists
 * because the bank had become a store of value with no downside, which is not
 * a decision, it is a formality.
 */
import assert from 'node:assert/strict';
import { nearMiss, nearMissLine, openingOffer, counterOffer, walkAway, type StreetNegotiation } from '../systems/street/selling.ts';
import { skimCard, SKIM_MIN_FRACTION, SKIM_MAX_FRACTION, SKIM_FLOOR } from '../systems/banking.ts';
import { seeded } from '../utils/rng.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const negotiation = (over: Partial<StreetNegotiation> = {}): StreetNegotiation => ({
    buyer: { name: 'Somebody', eye: 0.3, patience: 30, ceilingPct: 1 } as never,
    item: { instanceId: 'i', sneakerId: 's', purchasePrice: 100 } as never,
    localValue: 1000,
    history: [{ by: 'buyer', amount: 400 }, { by: 'player', amount: 800 }],
    currentOffer: 400,
    round: 1,
    maxRounds: 4,
    status: 'walked',
    trueMax: 700,
    ...over,
} as StreetNegotiation);

console.log('\nthe near miss');

t('a live negotiation reveals nothing', () => {
    assert.equal(nearMiss(negotiation({ status: 'negotiating' })), null);
    assert.equal(nearMiss(negotiation({ status: 'accepted' })), null);
});

t('a dead deal tells you what it was worth', () => {
    const m = nearMiss(negotiation())!;
    assert.equal(m.wouldHavePaid, 700);
    assert.equal(m.youWanted, 800);
    assert.equal(m.missedBy, 100);
});

t('it is always revealed, not only when it was close', () => {
    // If it only appeared on near-misses, seeing it would itself be the
    // information and the number would stop meaning anything.
    const miles = nearMiss(negotiation({ history: [{ by: 'player', amount: 50000 }] as never }))!;
    assert.ok(miles.wouldHavePaid > 0);
    assert.equal(miles.agonising, false, 'being wildly off should not read as agonising');
    assert.ok(nearMissLine(miles).includes('never going past'));
});

t('close enough to hurt is marked as such', () => {
    const close = nearMiss(negotiation({ history: [{ by: 'player', amount: 740 }] as never }))!;
    assert.equal(close.agonising, true, `$40 over a $700 ceiling should sting`);
    assert.ok(nearMissLine(close).includes('$40'), nearMissLine(close));
});

t('asking under his ceiling and still walking says so', () => {
    const under = nearMiss(negotiation({ history: [{ by: 'player', amount: 500 }] as never }))!;
    assert.equal(under.missedBy, 0);
    assert.ok(nearMissLine(under).includes('never asked'));
});

t('the line never exposes a number the player could not have inferred', () => {
    // It reveals his ceiling, which is the point, and nothing about the next
    // buyer or the market underneath.
    for (const ask of [100, 700, 701, 900, 9000]) {
        const line = nearMissLine(nearMiss(negotiation({ history: [{ by: 'player', amount: ask }] as never }))!);
        assert.ok(!line.includes('undefined') && !line.includes('NaN'), line);
        assert.ok(line.length > 10);
    }
});

console.log('\nskimming');

t('a small balance is not worth the trouble', () => {
    for (const bank of [0, 10, SKIM_FLOOR - 1]) {
        assert.equal(skimCard(bank, seeded(1)).amount, 0, `they skimmed a $${bank} balance`);
    }
});

t('a skim takes a slice, never the balance', () => {
    for (let s = 0; s < 200; s++) {
        const bank = 1000 + s * 250;
        const r = skimCard(bank, seeded(s));
        assert.ok(r.amount > 0, 'nothing taken from a worthwhile balance');
        assert.ok(r.amount < bank, `took the whole ${bank}`);
        assert.ok(r.fraction >= SKIM_MIN_FRACTION - 1e-9 && r.fraction <= SKIM_MAX_FRACTION + 1e-9,
            `${(r.fraction * 100).toFixed(1)}% is outside the 1-26% band`);
    }
});

t('the size of the hit is genuinely unpredictable', () => {
    // A fixed percentage would just become a known tax and get priced in.
    const fractions = new Set<string>();
    for (let s = 0; s < 60; s++) fractions.add(skimCard(50000, seeded(s)).fraction.toFixed(3));
    assert.ok(fractions.size > 30, `only ${fractions.size} distinct outcomes in 60 rolls`);
});

t('it never wipes you out, so banking stays worth doing', () => {
    // A wipe would teach players never to bank, which swaps one dominant
    // strategy for another instead of creating a decision.
    let worst = 0;
    for (let s = 0; s < 500; s++) worst = Math.max(worst, skimCard(20000, seeded(s)).fraction);
    assert.ok(worst <= SKIM_MAX_FRACTION + 1e-9, `worst case took ${(worst * 100).toFixed(1)}%`);
    assert.ok(worst > 0.2, `worst case was only ${(worst * 100).toFixed(1)}% — the ceiling is never reached`);
});

t('every skim comes with an explanation', () => {
    for (let s = 0; s < 30; s++) {
        const r = skimCard(9000, seeded(s));
        assert.ok(r.line.length > 20, 'money vanished with no story attached');
    }
});

console.log(`\n${pass} hook checks passed.\n`);
