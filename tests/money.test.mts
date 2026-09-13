/**
 * Money, risk and the wallet.
 *
 * The bank screen makes the player two promises, and both of them are only
 * believable if they are true everywhere:
 *
 *   1. Under the cash floor, nobody bothers you.
 *   2. Cash in the bank cannot be taken.
 *
 * The second is structural (the robbery code never touches `bank`), but the
 * first is a probability and probabilities are exactly the kind of thing that
 * quietly stops being true after a tuning pass. These checks pin the shape of
 * the risk curve: monotonic in cash, meaningfully softened by cred and by
 * daylight, and never able to take more than you are carrying.
 */
import assert from 'node:assert/strict';
import { INITIAL_PLAYER, ROBBERY_CASH_FLOOR } from '../constants.ts';
import type { Player } from '../types.ts';
import { robberyExposure, muggingLoss, cardUsable, blockCard, accrueInterest, deposit } from '../systems/banking.ts';
import { rollStreetRobbery } from '../systems/events/streetRobbery.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const P = (over: Partial<Player> = {}): Player => ({ ...INITIAL_PLAYER, ...over });

/** Always fires; always picks the first option. */
const always = () => 0;
/** Never fires. */
const never = () => 0.999999;

t('exposure rises with cash and never reaches certainty', () => {
    const steps = [0, 100, ROBBERY_CASH_FLOOR / 2, ROBBERY_CASH_FLOOR, 5000, 50000];
    let last = -1;
    for (const cash of steps) {
        const e = robberyExposure(P({ cash }));
        assert.ok(e >= last, `exposure fell going from the previous step to $${cash}`);
        assert.ok(e < 1, `exposure hit ${e} at $${cash}`);
        last = e;
    }
});

t('pocket money is beneath notice — the floor promise holds', () => {
    // Below half the floor the roll must not even be attempted, whatever the
    // dice say. This is the one hard guarantee the bank screen makes.
    for (const cash of [0, 1, 200, ROBBERY_CASH_FLOOR / 2]) {
        const out = rollStreetRobbery(P({ cash }), 5, 'night', always);
        assert.equal(out, null, `robbed while carrying only $${cash}`);
    }
});

t('carrying real money at night gets you robbed', () => {
    const out = rollStreetRobbery(P({ cash: 12000, streetCred: 0 }), 5, 'night', always);
    assert.ok(out, 'a forced roll at $12,000 did not produce a robbery');
    assert.ok(out!.robbery.cashLost > 0);
    assert.ok(out!.player.cash < 12000);
});

t('a robbery never takes more than you are carrying, over 500 trials', () => {
    for (let i = 0; i < 500; i++) {
        const cash = 1000 + Math.floor(Math.random() * 40000);
        const out = rollStreetRobbery(P({ cash }), 5, 'night', always);
        assert.ok(out, 'forced roll produced nothing');
        assert.ok(out!.robbery.cashLost <= cash, `took $${out!.robbery.cashLost} from $${cash}`);
        assert.ok(out!.player.cash >= 0, 'cash went negative');
        assert.ok(out!.player.health >= 1, 'a mugging killed the player outright');
    }
});

t('banked money is never touched', () => {
    const banked = deposit(P({ cash: 20000 }), 15000).player;
    assert.equal(banked.bank, 15000);
    const out = rollStreetRobbery(banked, 5, 'night', always);
    assert.ok(out, 'forced roll produced nothing');
    assert.equal(out!.player.bank, 15000, 'a mugger reached into the bank account');
});

t('a name on the street makes you a worse target', () => {
    // Measured as how often a robbery lands across many rolls, since the shield
    // is a multiplier on the chance rather than on the loss.
    const rolls = (cred: number) => {
        let hits = 0;
        for (let i = 0; i < 4000; i++) {
            if (rollStreetRobbery(P({ cash: 4000, streetCred: cred }), 5, 'evening')) hits++;
        }
        return hits;
    };
    const unknown = rolls(0);
    const known = rolls(80);
    assert.ok(known < unknown * 0.8, `cred barely helped: ${known} vs ${unknown} robberies in 4000`);
    assert.ok(known > 0, 'cred made the player completely immune');
});

t('night is dangerous and morning is not', () => {
    const rolls = (time: string) => {
        let hits = 0;
        for (let i = 0; i < 4000; i++) {
            if (rollStreetRobbery(P({ cash: 4000, streetCred: 0 }), 5, time)) hits++;
        }
        return hits;
    };
    const morning = rolls('morning');
    const night = rolls('night');
    assert.ok(night > morning * 1.8, `night ${night} vs morning ${morning} — time of day barely matters`);
});

t('a rich player is not robbed every single day', () => {
    // The failure mode this guards against is using the per-encounter exposure
    // as a daily probability, which robs a well-off player four days in five and
    // makes the game unplayable rather than tense.
    let hits = 0;
    const trials = 4000;
    for (let i = 0; i < trials; i++) {
        if (rollStreetRobbery(P({ cash: 8000, streetCred: 20 }), 5, 'afternoon')) hits++;
    }
    const rate = hits / trials;
    assert.ok(rate < 0.3, `an $8,000 player is robbed ${(rate * 100).toFixed(0)}% of travel days`);
    assert.ok(rate > 0.02, `an $8,000 player is robbed only ${(rate * 100).toFixed(1)}% of the time — no teeth`);
});

t('losing the wallet actually blocks the card, and it clears', () => {
    let hits = 0;
    let blocked = 0;
    for (let i = 0; i < 2000; i++) {
        const out = rollStreetRobbery(P({ cash: 9000, wallet: { ...INITIAL_PLAYER.wallet, hasCard: true } }), 10, 'night', always);
        if (!out) continue;
        hits++;
        if (out.robbery.cardBlockedDays) {
            blocked++;
            assert.equal(cardUsable(out.player, 10), false, 'card still usable the day it was taken');
            const days = out.robbery.cardBlockedDays;
            assert.equal(cardUsable(out.player, 10 + days), true, `card still blocked after ${days} days`);
        }
    }
    assert.ok(hits > 0, 'no robberies at all');
    // `always` returns 0, which is below the 0.34 wallet threshold, so every
    // forced robbery should also take the wallet.
    assert.equal(blocked, hits, `${blocked} of ${hits} robberies took the wallet`);
});

t('a robbery with no card to take does not claim to take one', () => {
    const noCard = P({ cash: 9000, wallet: { ...INITIAL_PLAYER.wallet, hasCard: false } });
    const out = rollStreetRobbery(noCard, 4, 'night', always);
    assert.ok(out);
    assert.equal(out!.robbery.cardBlockedDays, undefined);
});

t('a blocked card stays blocked until its day, then works', () => {
    const p = blockCard(P({ wallet: { ...INITIAL_PLAYER.wallet, hasCard: true } }), 7, 'Left it in a taxi.', 3);
    assert.equal(cardUsable(p, 7), false);
    assert.equal(cardUsable(p, 9), false);
    assert.equal(cardUsable(p, 10), true);
});

t('interest compounds and is reported', () => {
    let p = P({ wallet: { ...INITIAL_PLAYER.wallet, hasCredit: true, creditOwed: 1000, creditLimit: 5000 } });
    const first = accrueInterest(p);
    assert.ok(first.player.wallet.creditOwed > 1000, 'nothing accrued');
    assert.ok(first.log.length > 0, 'interest was charged silently');
    p = first.player;
    const second = accrueInterest(p);
    assert.ok(
        second.player.wallet.creditOwed - p.wallet.creditOwed > first.player.wallet.creditOwed - 1000,
        'interest is not compounding',
    );
});

t('no debt means no interest and no noise', () => {
    const clean = accrueInterest(P());
    assert.equal(clean.log.length, 0, 'charged interest on a zero balance');
});

t('an unlucky roll is possible but nothing is forced when the dice say no', () => {
    assert.equal(rollStreetRobbery(P({ cash: 100000 }), 5, 'night', never), null);
    assert.ok(muggingLoss(P({ cash: 0 })) === 0, 'mugged a player with no cash');
});

console.log(`\n${pass} money checks passed.`);
