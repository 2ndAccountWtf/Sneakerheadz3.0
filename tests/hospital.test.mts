/**
 * The hospital.
 *
 * `Player.health` promised this in its own doc comment — "Hits zero and you
 * wake up in a hospital lighter by a day and a wad of cash" — and there was no
 * hospital. No check on `health <= 0` existed anywhere in the codebase. Health
 * was the currency the fighter, the busts and the muggings all spent, and
 * spending all of it cost nothing.
 *
 * These checks hold the floor of the game: that hitting zero costs you, that it
 * is a decision rather than a cutscene, that it always terminates, and that it
 * can never take more than a person actually has.
 */
import assert from 'node:assert/strict';
import {
    admit, stabilise, nightIn, settle, mustLeave,
    ADMISSION_FEE, NIGHTLY_RATE, STABILISED_AT, HEALED_PER_NIGHT, COOLED_PER_NIGHT, MAX_NIGHTS,
    type HospitalStay,
} from '../systems/hospital.ts';
import { INITIAL_PLAYER, MAX_HEALTH, MAX_HEAT } from '../constants.ts';
import { rngFor } from '../utils/rng.ts';
import type { GameState, Player } from '../types.ts';
import { gameReducer } from '../hooks/useGame.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const hurt = (over: Partial<Player> = {}): Player => ({
    ...INITIAL_PLAYER,
    health: 0,
    cash: 5000,
    bank: 5000,
    heat: 80,
    ...over,
});

console.log('\nthey bring you in');

t('a stay opens with the door charge and nothing else', () => {
    const s = admit(7, 'Lost a fight behind a laundromat.');
    assert.equal(s.admittedOnDay, 7);
    assert.equal(s.bill, ADMISSION_FEE);
    assert.equal(s.nights, 0);
    assert.equal(s.chart.length, 0, 'you have not been here a night yet');
});

t('the ward does not redecorate itself between renders', () => {
    // Same admission, same room and same man in the next bed. A re-render that
    // reshuffles the furniture reads as a bug even when nothing is wrong.
    const a = admit(7, 'Lost a fight behind a laundromat.');
    const b = admit(7, 'Lost a fight behind a laundromat.');
    assert.equal(a.ward, b.ward);
    assert.equal(a.neighbour, b.neighbour);
});

t('two different beatings do not land in the same bed', () => {
    const a = admit(3, 'Mugged on the way to the station.');
    const b = admit(19, 'The police caught up on the corner.');
    assert.ok(a.ward !== b.ward || a.neighbour !== b.neighbour, 'every stay is identical');
});

t('being stabilised puts you above zero, so this cannot become a loop', () => {
    // The important one. If a discharge could put you back on the street at
    // zero, the next scratch re-admits you and the game is a revolving door
    // rather than a consequence.
    const p = stabilise(hurt());
    assert.ok(p.health >= STABILISED_AT, `discharged at ${p.health}`);
    assert.ok(p.health > 0);
});

t('being stabilised never makes a healthier player worse', () => {
    const p = stabilise(hurt({ health: 60 }));
    assert.equal(p.health, 60, 'the hospital took health off somebody who walked in');
});

console.log('\nthe night, and the choice');

t('a night costs a day of money and buys health back', () => {
    const before = hurt({ health: STABILISED_AT });
    const { stay, player } = nightIn(admit(2, 'x'), before, rngFor('night-a'));
    assert.equal(stay.nights, 1);
    assert.ok(stay.bill >= ADMISSION_FEE + NIGHTLY_RATE, `the bill only reached ${stay.bill}`);
    assert.ok(player.health > before.health, 'a night in a bed healed nothing');
});

t('heat cools while you are in here, which is the only good news', () => {
    const before = hurt({ heat: 80, health: STABILISED_AT });
    const { player } = nightIn(admit(2, 'x'), before, rngFor('night-b'));
    assert.equal(player.heat, before.heat - COOLED_PER_NIGHT);
});

t('nobody heals past full, or cools past zero', () => {
    let stay = admit(1, 'x');
    let player = hurt({ health: MAX_HEALTH - 2, heat: 3 });
    for (let i = 0; i < 4; i++) ({ stay, player } = nightIn(stay, player, rngFor(`cap-${i}`)));
    assert.ok(player.health <= MAX_HEALTH, `healed to ${player.health}`);
    assert.ok(player.heat >= 0, `cooled to ${player.heat}`);
    assert.ok(player.heat <= MAX_HEAT);
});

t('a bad night can cost you sleep without ever killing you', () => {
    // Some nights are negative. None of them may put you back on the floor,
    // because a stay that can kill you is a trap rather than a recovery.
    let stay = admit(1, 'x');
    let player = hurt({ health: 1 });
    for (let i = 0; i < 40; i++) {
        ({ stay, player } = nightIn(stay, player, rngFor(`bad-${i}`)));
        assert.ok(player.health >= 1, `a night took the player to ${player.health}`);
    }
});

t('the bill only ever goes up', () => {
    let stay = admit(1, 'x');
    let player = hurt();
    let last = stay.bill;
    for (let i = 0; i < 10; i++) {
        ({ stay, player } = nightIn(stay, player, rngFor(`up-${i}`)));
        assert.ok(stay.bill > last, `the bill went ${last} -> ${stay.bill}`);
        last = stay.bill;
    }
});

t('the chart records every night, in order', () => {
    let stay = admit(1, 'x');
    let player = hurt();
    for (let i = 0; i < 3; i++) ({ stay, player } = nightIn(stay, player, rngFor(`chart-${i}`)));
    assert.equal(stay.chart.length, 3);
    stay.chart.forEach((line, i) => assert.ok(line.startsWith(`Night ${i + 1}.`), `out of order: ${line}`));
});

t('they want the bed back eventually', () => {
    // A stay has to terminate. Without a ceiling a player could hide in here
    // for the rest of the run, cooling off for a flat nightly fee.
    let stay = admit(1, 'x');
    let player = hurt();
    assert.equal(mustLeave(stay), false);
    for (let i = 0; i < MAX_NIGHTS; i++) ({ stay, player } = nightIn(stay, player, rngFor(`out-${i}`)));
    assert.equal(mustLeave(stay), true, `still allowed to stay after ${MAX_NIGHTS} nights`);
});

console.log('\nsettling up');

const billOf = (n: number): HospitalStay => ({ ...admit(1, 'x'), bill: n });

t('the pocket goes first, then the bank', () => {
    const s = settle(billOf(3000), hurt({ cash: 1000, bank: 9000 }));
    assert.equal(s.fromCash, 1000);
    assert.equal(s.fromBank, 2000);
    assert.equal(s.player.cash, 0);
    assert.equal(s.player.bank, 7000);
});

t('what is left goes on the card, if there is a card', () => {
    const p = hurt({ cash: 0, bank: 0 });
    p.wallet = { ...p.wallet, hasCredit: true, creditOwed: 0, creditLimit: 2000 };
    const s = settle(billOf(1500), p);
    assert.equal(s.onCredit, 1500);
    assert.equal(s.player.wallet.creditOwed, 1500);
    assert.equal(s.forgiven, 0);
});

t('a card that is already full does not stretch', () => {
    const p = hurt({ cash: 0, bank: 0 });
    p.wallet = { ...p.wallet, hasCredit: true, creditOwed: 1800, creditLimit: 2000 };
    const s = settle(billOf(1500), p);
    assert.equal(s.onCredit, 200, 'the card went over its own limit');
    assert.equal(s.forgiven, 1300);
});

t('a player with nothing is not held prisoner over a bill', () => {
    // Debtors' prison is not a mechanic anybody wants to play. They take
    // everything there is and the rest is written off.
    const p = hurt({ cash: 0, bank: 0 });
    p.wallet = { ...p.wallet, hasCredit: false, creditOwed: 0, creditLimit: 0 };
    const s = settle(billOf(5000), p);
    assert.equal(s.forgiven, 5000);
    assert.equal(s.player.cash, 0);
    assert.equal(s.player.wallet.creditOwed, 0);
});

t('settling can never leave anybody owing more than the bill', () => {
    const p = hurt({ cash: 400, bank: 400 });
    p.wallet = { ...p.wallet, hasCredit: true, creditOwed: 0, creditLimit: 10000 };
    const bill = 5000;
    const s = settle(billOf(bill), p);
    assert.equal(s.fromCash + s.fromBank + s.onCredit + s.forgiven, bill, 'the arithmetic does not close');
});

t('nobody is ever taken below zero anywhere', () => {
    for (const [cash, bank, bill] of [[0, 0, 100], [50, 0, 900], [0, 50, 900], [10, 10, 10]]) {
        const p = hurt({ cash, bank });
        const s = settle(billOf(bill), p);
        assert.ok(s.player.cash >= 0, `cash went to ${s.player.cash}`);
        assert.ok(s.player.bank >= 0, `bank went to ${s.player.bank}`);
        assert.ok(s.player.wallet.creditOwed >= 0);
    }
});

t('a settled bill always says what happened to the money', () => {
    const s = settle(billOf(3000), hurt({ cash: 1000, bank: 500 }));
    assert.ok(s.log.length > 0, 'the money moved and nobody said so');
    assert.ok(s.log.join(' ').includes('1,000'), 'the log does not name what came out of the pocket');
});

t('every ward reads correctly after "You are in"', () => {
    // The scene prints "You are in {ward}." A ward phrased as "the third floor"
    // makes that sentence ungrammatical, which is the kind of thing that is
    // invisible in the data file and obvious on screen.
    const seen = new Set<string>();
    for (let d = 1; d <= 60; d++) seen.add(admit(d, `cause-${d}`).ward);
    assert.ok(seen.size > 1, 'only one ward is ever used');
    for (const ward of seen) {
        assert.ok(/^(a|an|the observation)/.test(ward), `"You are in ${ward}" does not read as English`);
    }
});

console.log('\nthe floor under the whole game');

/** A live-ish state the reducer will accept, one bad outcome from the floor. */
const onTheEdge = (over: Partial<Player> = {}): GameState => ({
    player: hurt({ health: 4, ...over }),
    day: 9,
    hospital: null,
    activeBust: null,
    outcomeLog: [],
} as unknown as GameState);

t('hitting zero puts you in a bed, whatever action did it', () => {
    // The check lives in the reducer wrapper rather than at each place that
    // takes health off. There are six of those and there will be more; a rule
    // that must be remembered at every new call site is one that gets
    // forgotten, which is exactly how this came to be missing.
    const floored = { ...onTheEdge(), player: hurt({ health: 0 }) };
    const after = gameReducer(floored, { type: 'SET_NOTIFICATION', payload: null } as never);
    assert.ok(after.hospital, 'health hit zero and nothing happened');
    assert.ok(after.player.health > 0, 'discharged straight back through the floor');
});

t('a healthy player is never admitted', () => {
    const fine = { ...onTheEdge(), player: hurt({ health: 70 }) };
    const after = gameReducer(fine, { type: 'SET_NOTIFICATION', payload: null } as never);
    assert.equal(after.hospital, null, 'admitted somebody who was walking around fine');
});

t('a stop cannot carry on while you are being loaded into an ambulance', () => {
    const mid = { ...onTheEdge(), player: hurt({ health: 0 }), activeBust: { some: 'stop' } } as unknown as GameState;
    const after = gameReducer(mid, { type: 'SET_NOTIFICATION', payload: null } as never);
    assert.equal(after.activeBust, null, 'the officer is still negotiating with an unconscious man');
    assert.ok(after.hospital);
});

t('you are not re-admitted every turn while you are already in one', () => {
    const inBed = gameReducer(
        { ...onTheEdge(), player: hurt({ health: 0 }) },
        { type: 'SET_NOTIFICATION', payload: null } as never,
    );
    const again = gameReducer(inBed, { type: 'SET_NOTIFICATION', payload: null } as never);
    assert.equal(again.hospital!.admittedOnDay, inBed.hospital!.admittedOnDay, 'a second admission opened on top of the first');
    assert.equal(again.hospital!.bill, inBed.hospital!.bill, 'the door charge was taken twice');
});

t('a night in the ward costs a day of the run', () => {
    const inBed = gameReducer(
        { ...onTheEdge(), player: hurt({ health: 0 }) },
        { type: 'SET_NOTIFICATION', payload: null } as never,
    );
    const after = gameReducer(inBed, { type: 'HOSPITAL_NIGHT' } as never);
    assert.equal(after.day, inBed.day + 1, 'a night in hospital did not burn a day');
    assert.equal(after.hospital!.nights, 1);
});

t('signing out settles the bill and puts you back on the street', () => {
    const inBed = gameReducer(
        { ...onTheEdge(), player: hurt({ health: 0, cash: 9000 }) },
        { type: 'SET_NOTIFICATION', payload: null } as never,
    );
    const bill = inBed.hospital!.bill;
    const out = gameReducer(inBed, { type: 'HOSPITAL_DISCHARGE' } as never);
    assert.equal(out.hospital, null, 'still in the bed after signing out');
    assert.equal(out.player.cash, 9000 - bill, `cash went ${9000} -> ${out.player.cash} against a ${bill} bill`);
    assert.ok(out.outcomeLog.length > 0, 'walked out and nobody said what it cost');
});

t('the ward stops taking nights once they want the bed back', () => {
    let s = gameReducer({ ...onTheEdge(), player: hurt({ health: 0 }) }, { type: 'SET_NOTIFICATION', payload: null } as never);
    for (let i = 0; i < MAX_NIGHTS + 3; i++) s = gameReducer(s, { type: 'HOSPITAL_NIGHT' } as never);
    assert.equal(s.hospital!.nights, MAX_NIGHTS, `slept ${s.hospital!.nights} nights past the limit`);
});

console.log(`\n${pass} hospital checks passed.\n`);
