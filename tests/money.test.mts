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
import { pay, priceFor, paymentBlocked } from '../systems/payment.ts';
import { getNetWorth, reachableAssets } from '../systems/pricing.ts';
import { getRunGrade, getRunRate } from '../data/ranks.ts';
import { INITIAL_PLAYER_CASH } from '../constants.ts';
import type { GameState } from '../types.ts';

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

/* ---------------- paying for things ---------------- */

t('cash is cheaper than card at any price worth the distinction', () => {
    for (const sticker of [20, 120, 2500, 68000]) {
        const cash = priceFor(sticker, 'cash');
        const card = priceFor(sticker, 'card');
        assert.ok(cash < card, `at $${sticker}: cash $${cash} vs card $${card}`);
        assert.ok(cash <= sticker && card >= sticker, `the discount and surcharge are the wrong way round at $${sticker}`);
    }
});

t('a one-dollar item costs a dollar either way', () => {
    // Both methods floor at $1, so the cheapest things in the AM/PM collapse to
    // the same price. That is correct — a 8% discount on a dollar is not a
    // thing — and it is asserted so nobody "fixes" it into a free item.
    assert.equal(priceFor(1, 'cash'), 1);
    assert.equal(priceFor(1, 'card'), 1);
});

t('cash you do not have is refused, and costs nothing', () => {
    const broke = P({ cash: 50 });
    const out = pay(broke, 'cash', 500, 1);
    assert.equal(out.ok, false);
    assert.equal(out.paid, 0);
    assert.equal(out.player, broke, 'a refused payment still changed the player');
    assert.ok(out.log.length > 0, 'refused silently');
});

t('a card with no credit line is refused', () => {
    const p = P({ wallet: { ...INITIAL_PLAYER.wallet, hasCard: true, hasCredit: false } });
    assert.ok(paymentBlocked(p, 'card', 100, 1), 'a card with no line was accepted');
    assert.equal(pay(p, 'card', 100, 1).ok, false);
});

t('a card purchase becomes debt rather than spending cash', () => {
    const p = P({ cash: 5000, wallet: { ...INITIAL_PLAYER.wallet, hasCard: true, hasCredit: true, creditLimit: 2500, creditOwed: 0 } });
    const out = pay(p, 'card', 900, 1);
    assert.equal(out.ok, true);
    assert.equal(out.player.cash, 5000, 'a card purchase took cash as well');
    assert.equal(out.player.wallet.creditOwed, 900);
});

t('the limit is a real wall', () => {
    const p = P({ wallet: { ...INITIAL_PLAYER.wallet, hasCard: true, hasCredit: true, creditLimit: 1000, creditOwed: 900 } });
    assert.ok(paymentBlocked(p, 'card', 200, 1), 'spent past the limit');
    assert.equal(pay(p, 'card', 200, 1).player.wallet.creditOwed, 900, 'a refused charge still moved the balance');
    assert.equal(pay(p, 'card', 100, 1).ok, true, 'a charge exactly to the limit was refused');
});

t('a blocked card cannot buy anything, and says why', () => {
    const p = blockCard(
        P({ wallet: { ...INITIAL_PLAYER.wallet, hasCard: true, hasCredit: true, creditLimit: 5000 } }),
        3, 'You left it in a bathroom in Tel Aviv.', 2,
    );
    const why = paymentBlocked(p, 'card', 100, 3);
    assert.ok(why, 'a blocked card was accepted');
    assert.match(why!, /bathroom/i, `the reason given was "${why}" — it should be the actual reason`);
    // And cash still works, which is the whole point of carrying some.
    assert.equal(paymentBlocked(P({ cash: 500 }), 'cash', 100, 3), null);
});

t('paymentBlocked and pay never disagree', () => {
    // The screen greys out a button using `paymentBlocked` and the reducer
    // charges using `pay`. If those two ever disagree the player either sees a
    // decline they could not predict, or walks out with free shoes.
    const wallets = [
        { hasCard: false, hasCredit: false, creditOwed: 0, creditLimit: 0 },
        { hasCard: true, hasCredit: false, creditOwed: 0, creditLimit: 0 },
        { hasCard: true, hasCredit: true, creditOwed: 0, creditLimit: 2500 },
        { hasCard: true, hasCredit: true, creditOwed: 2400, creditLimit: 2500 },
    ];
    for (const wallet of wallets) {
        for (const cash of [0, 100, 9000]) {
            for (const total of [1, 99, 2400, 100000]) {
                for (const method of ['cash', 'card'] as const) {
                    const p = P({ cash, wallet });
                    const blocked = paymentBlocked(p, method, total, 1);
                    const result = pay(p, method, total, 1);
                    assert.equal(
                        result.ok, blocked === null,
                        `disagreement: method=${method} cash=${cash} total=${total} wallet=${JSON.stringify(wallet)}`,
                    );
                }
            }
        }
    }
});

/* ------------------------------------------------------------------------- *
 * What the run is worth
 *
 * Every screen used to compute `cash + bagValue` inline, and the two things it
 * left out both pointed the same way: toward telling the player something false
 * about their own money. Banked cash stopped being theirs; borrowed cash became
 * theirs. The bank screen actively tells you to deposit, so the game was
 * punishing its own advice.
 * ------------------------------------------------------------------------- */

/** A game state thin enough for the worth functions, which only read the bag. */
const S = (p: Partial<Player>): GameState => ({
    player: P(p),
    markets: {},
    currentCityId: 'tokyo',
    day: 1,
    activeMarketSignals: [],
} as unknown as GameState);

t('moving cash into the bank does not change what the run is worth', () => {
    // The headline bug. Deposit is a location change, not a loss.
    const before = S({ cash: 10000, bank: 0 });
    const after = S({ cash: 1000, bank: 9000 });
    assert.equal(getNetWorth(before), 10000);
    assert.equal(getNetWorth(after), 10000, 'banking your winnings made you poorer');
    // And the grade follows the number, so it cannot drift back apart.
    assert.equal(
        getRunGrade(getNetWorth(after), INITIAL_PLAYER_CASH).title,
        getRunGrade(getNetWorth(before), INITIAL_PLAYER_CASH).title,
    );
});

t('a deposit through the real banking path is worth-neutral too', () => {
    // Against the actual reducer rather than a hand-built pair of states, so a
    // future change to `deposit` cannot slip past the check above.
    const start = P({ cash: 10000, bank: 0 });
    const moved = deposit(start, 9000);
    assert.ok(moved.ok);
    assert.equal(getNetWorth(S(start)), getNetWorth(S(moved.player)));
});

t('money drawn on the card is not profit', () => {
    // $2,500 of credit against a $2,000 stake: bigger than the whole starting
    // bankroll, and it used to count as winnings because nothing scored `owed`.
    const maxed = S({ cash: 2000 + 2500, wallet: { hasCard: true, hasCredit: true, creditOwed: 2500, creditLimit: 2500 } });
    assert.equal(getNetWorth(maxed), 2000, 'borrowing $2,500 counted as earning it');
    assert.equal(getRunGrade(getNetWorth(maxed), INITIAL_PLAYER_CASH).title,
        getRunGrade(INITIAL_PLAYER_CASH, INITIAL_PLAYER_CASH).title);
});

t('the hospital bills what it can reach, which is not net worth', () => {
    // Deliberately different from `getNetWorth`. A debt does not reduce what an
    // emergency room can charge you, so `reachableAssets` ignores `creditOwed`
    // and the two functions are allowed to disagree by exactly that much.
    const broke = S({ cash: 5000, bank: 1000, wallet: { hasCard: true, hasCredit: true, creditOwed: 3000, creditLimit: 3000 } });
    assert.equal(reachableAssets(broke), 6000);
    assert.equal(getNetWorth(broke), 3000);
    assert.equal(reachableAssets(broke) - getNetWorth(broke), 3000, 'the gap must be exactly what is owed');
});

/* ------------------------------------------------------------------------- *
 * The rate, and the day it does not exist
 * ------------------------------------------------------------------------- */

t('day one has no rate and makes no projection', () => {
    // The screenshot bug: on day 1 the old code divided by `max(1, day - 1)`,
    // turning one morning of paper movement into "+$800 per day" and a
    // projected $26,000 before a single day had closed.
    const r = getRunRate(2800, INITIAL_PLAYER_CASH, 1, 29);
    assert.equal(r.daysTraded, 0);
    assert.equal(r.perDay, null, 'day 1 reported a daily rate with no days behind it');
    assert.equal(r.projected, null, 'day 1 projected a final total from nothing');
});

t('the rate appears on day two and is divided by real days', () => {
    const d2 = getRunRate(2800, INITIAL_PLAYER_CASH, 2, 28);
    assert.equal(d2.daysTraded, 1);
    assert.equal(d2.perDay, 800);
    assert.equal(d2.projected, 2800 + 800 * 28);
    // Same net worth, later day: the same gain spread over more days is a
    // smaller rate. The old clamp got this right from day 3 and wrong before it.
    const d5 = getRunRate(2800, INITIAL_PLAYER_CASH, 5, 25);
    assert.equal(d5.daysTraded, 4);
    assert.equal(d5.perDay, 200);
    assert.ok(d5.perDay < d2.perDay);
});

t('a projection is never negative, however badly it is going', () => {
    // Losing $500 a day for 29 more days projects well past zero; the panel
    // should say you end with nothing, not with minus eleven thousand dollars.
    const r = getRunRate(1500, INITIAL_PLAYER_CASH, 2, 28);
    assert.ok(r.perDay !== null && r.perDay < 0);
    assert.equal(r.projected, 0);
});

console.log(`\n${pass} money checks passed.`);
