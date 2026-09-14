/**
 * Getting stopped has to be a real decision.
 *
 * The version this replaces was three buttons with three known prices, so
 * after one raid the player knew the cheapest and every later raid was
 * paperwork. These checks are mostly about uncertainty and about the rules
 * that stop uncertainty becoming unfairness — above all the two guards on
 * losing a day, which is the most expensive thing that can happen in a
 * thirty-day run.
 */
import assert from 'node:assert/strict';
import {
    rollOfficer, openBust, offer, resolveBust, temperamentFor,
    seizableCash, fakesOn, resolveEscape, JAIL_MIN_DAY, JAIL_MIN_HEAT,
} from '../systems/police/bust.ts';
import { seeded } from '../utils/rng.ts';
import type { Player } from '../types.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const mk = (over: Partial<Player> = {}): Player => ({
    cash: 3000, bank: 0, inventory: [], storage: [], statusEffects: [],
    stats: {} as never, health: 100, energy: 100, cleanliness: 100, mood: 60,
    focus: 60, gas: 0, streetCred: 20, heat: 30, bibiApproval: 50, flags: {},
    buffs: [], emergency: null, wallet: {} as never, connections: {},
    ...over,
} as Player);

const pair = (isFake: boolean, i = 0) => ({
    instanceId: `i${i}${isFake}`, sneakerId: 's', purchasePrice: 300, isFake,
});

console.log('\nthe stop');

t('heat decides what kind of stop this is, not just whether one happens', () => {
    assert.equal(temperamentFor(10), 'bored');
    assert.equal(temperamentFor(40), 'business');
    assert.equal(temperamentFor(80), 'looking-for-you');
});

t('he leans harder on somebody carrying more', () => {
    const light = rollOfficer(mk({ cash: 400 }), 15, seeded(1));
    const heavy = rollOfficer(mk({ cash: 9000, inventory: [pair(false), pair(false, 2)] }), 15, seeded(1));
    assert.ok(heavy.trueMax > light.trueMax * 2, `light ${light.trueMax} vs heavy ${heavy.trueMax}`);
});

t('what is in the bank is invisible to him', () => {
    // The whole reason banking is about to matter: he prices you off what he
    // can see, and he cannot see a bank balance.
    const pocket = rollOfficer(mk({ cash: 6000, bank: 0 }), 15, seeded(4));
    const banked = rollOfficer(mk({ cash: 6000, bank: 50000 }), 15, seeded(4));
    assert.equal(banked.trueMax, pocket.trueMax);
    assert.equal(seizableCash(mk({ cash: 6000, bank: 50000 })), 6000);
});

t('counterfeits in the bag make him more interested', () => {
    const clean = rollOfficer(mk({ inventory: [pair(false), pair(false, 2)] }), 15, seeded(9));
    const dirty = rollOfficer(mk({ inventory: [pair(true), pair(true, 2)] }), 15, seeded(9));
    assert.ok(dirty.trueMax > clean.trueMax, `${clean.trueMax} vs ${dirty.trueMax}`);
    assert.equal(fakesOn(mk({ inventory: [pair(true), pair(false, 2)] })), 1);
});

console.log('\nthe negotiation');

t('he opens above what he will actually take', () => {
    for (let s = 0; s < 30; s++) {
        const o = rollOfficer(mk({ heat: 20 + s }), 15, seeded(s));
        assert.ok(o.demand > o.trueMax, `opened at ${o.demand}, ceiling ${o.trueMax}`);
    }
});

t('meeting his ceiling settles it', () => {
    const o = rollOfficer(mk(), 15, seeded(3));
    const s = offer(openBust(o), o.trueMax, seeded(1));
    assert.equal(s.status, 'settled');
    assert.equal(s.agreed, o.trueMax);
});

t('a lowball is not merely refused — it makes things worse', () => {
    const o = rollOfficer(mk(), 15, seeded(3));
    const s = offer(openBust(o), Math.floor(o.insultBelow * 0.5), seeded(1));
    assert.equal(s.status, 'insulted');
});

t('he concedes toward his ceiling and never past it', () => {
    const o = rollOfficer(mk(), 15, seeded(5));
    let s = openBust(o);
    const asks = [s.asking];
    for (let i = 0; i < 3 && s.status === 'negotiating'; i++) {
        s = offer(s, o.insultBelow + 1, seeded(100 + i));
        asks.push(s.asking);
    }
    for (let i = 1; i < asks.length; i++) assert.ok(asks[i] <= asks[i - 1], 'his ask went up');
    assert.ok(asks[asks.length - 1] >= o.trueMax, 'he conceded below his own ceiling');
});

t('his patience runs out', () => {
    const o = rollOfficer(mk({ heat: 80 }), 15, seeded(7));
    let s = openBust(o);
    for (let i = 0; i < 12 && s.status === 'negotiating'; i++) s = offer(s, o.insultBelow + 1, seeded(200 + i));
    assert.notEqual(s.status, 'negotiating', 'he haggled forever');
    assert.ok(s.round <= o.maxRounds + 1, `took ${s.round} rounds against a patience of ${o.maxRounds}`);
});

t('the same offer does not always get the same answer', () => {
    // The point of the whole rewrite: you cannot learn one number and be done.
    const outcomes = new Set<string>();
    for (let s = 0; s < 40; s++) {
        const o = rollOfficer(mk({ heat: 30 + (s % 50) }), 15, seeded(s));
        outcomes.add(offer(openBust(o), Math.round(o.trueMax * 0.9), seeded(s * 7)).status);
    }
    assert.ok(outcomes.size > 1, `every offer produced the same result: ${[...outcomes]}`);
});

console.log('\nwhat it costs');

t('paying up costs the agreed money and cools him off', () => {
    const p = mk({ cash: 5000, heat: 40 });
    const o = rollOfficer(p, 15, seeded(2));
    const s = offer(openBust(o), o.trueMax, seeded(2));
    const out = resolveBust(s, 'pay', p, seeded(2));
    assert.equal(out.player.cash, 5000 - s.agreed);
    assert.ok(out.player.heat < 40, 'paying him did not cool anything');
    assert.equal(out.daysLost, 0);
});

t('refusing costs pocket cash and every fake, and never the bank', () => {
    const p = mk({ cash: 2000, bank: 40000, heat: 40, inventory: [pair(true), pair(false, 2)] });
    const o = rollOfficer(p, 15, seeded(6));
    const out = resolveBust({ ...openBust(o), status: 'refused' }, 'refuse', p, seeded(6));
    assert.ok(out.player.cash < 2000, 'he took nothing');
    assert.equal(out.player.bank, 40000, 'he reached into the bank');
    assert.equal(out.player.inventory.filter(i => i.isFake).length, 0, 'fakes survived');
    assert.equal(out.player.inventory.length, 1, 'a real pair was confiscated');
    assert.ok(out.player.heat > 40);
});

console.log('\nthe night in a cell');

t('refusing to pay never costs a day, at any heat, on any day', () => {
    // Declining a shakedown is expensive but it is not a crime. Jailing
    // somebody for it would have the game punishing its one honest option.
    for (const day of [1, 11, 20, 29]) {
        for (const heat of [0, 50, 100]) {
            const p = mk({ heat, cash: 3000 });
            const o = rollOfficer(p, day, seeded(day + heat));
            for (const status of ['refused', 'insulted'] as const) {
                for (let s = 0; s < 8; s++) {
                    const out = resolveBust({ ...openBust(o), status }, 'refuse', p, seeded(s));
                    assert.equal(out.daysLost, 0, `day ${day} heat ${heat} (${status}) cost a day for refusing`);
                }
            }
        }
    }
});

t('getting away with it costs nothing but the heat', () => {
    for (const choice of ['run', 'drive', 'swing'] as const) {
        const p = mk({ heat: 95, cash: 4000, inventory: [pair(true), pair(false, 2)] });
        const o = rollOfficer(p, 25, seeded(2));
        const out = resolveEscape(o, choice, true, p);
        assert.equal(out.daysLost, 0, `${choice} cost a day despite getting away`);
        assert.equal(out.player.cash, 4000, 'he took money off somebody who outran him');
        assert.equal(out.player.inventory.length, 2, 'he confiscated from somebody who got away');
    }
});

t('never in the first ten days, however badly it goes', () => {
    for (let day = 1; day <= JAIL_MIN_DAY; day++) {
        const p = mk({ heat: 100 });
        const o = rollOfficer(p, day, seeded(day));
        assert.equal(o.canJail, false, `day ${day} at max heat could still jail`);
        for (const choice of ['run', 'drive', 'swing'] as const) {
            assert.equal(resolveEscape(o, choice, false, p).daysLost, 0, `day ${day}: ${choice} cost a day`);
        }
    }
});

t('never at low heat, however late in the run', () => {
    for (const heat of [0, 30, JAIL_MIN_HEAT - 1]) {
        const p = mk({ heat });
        const o = rollOfficer(p, 28, seeded(heat));
        assert.equal(o.canJail, false, `heat ${heat} on day 28 could jail`);
        for (const choice of ['run', 'drive', 'swing'] as const) {
            assert.equal(resolveEscape(o, choice, false, p).daysLost, 0);
        }
    }
});

t('losing a chase late in a hot run is what books you', () => {
    const p = mk({ heat: 90, cash: 4000, inventory: [pair(true)] });
    const o = rollOfficer(p, 22, seeded(11));
    assert.equal(o.canJail, true);
    for (const choice of ['run', 'drive', 'swing'] as const) {
        const out = resolveEscape(o, choice, false, p);
        assert.equal(out.daysLost, 1, `${choice} did not book you`);
        assert.ok(out.player.cash < 4000, 'caught and kept the cash');
        assert.equal(out.player.inventory.filter(i => i.isFake).length, 0, 'caught and kept the fakes');
    }
});

t('paying him never costs a day, however hot', () => {
    const p = mk({ heat: 100, cash: 90000 });
    const o = rollOfficer(p, 29, seeded(13));
    const s = offer(openBust(o), o.trueMax, seeded(13));
    assert.equal(resolveBust(s, 'pay', p, seeded(13)).daysLost, 0);
});

console.log('\nmaking it physical');

t('each escape hands off to a game that already exists', () => {
    const p = mk();
    const o = rollOfficer(p, 15, seeded(8));
    const s = openBust(o);
    assert.equal(resolveBust(s, 'run', p, seeded(1)).minigame, 'sneaker-chase');
    assert.equal(resolveBust(s, 'drive', p, seeded(1)).minigame, 'cart-race');
    assert.equal(resolveBust(s, 'swing', p, seeded(1)).minigame, 'street-brawl');
});

t('swinging on him is the most expensive way to start', () => {
    const p = mk({ heat: 20 });
    const o = rollOfficer(p, 15, seeded(8));
    const run = resolveBust(openBust(o), 'run', p, seeded(1));
    const swing = resolveBust(openBust(o), 'swing', p, seeded(1));
    assert.ok(swing.player.heat > run.player.heat);
});

t('promising money you do not have goes badly', () => {
    const p = mk({ cash: 20 });
    const o = rollOfficer(mk({ cash: 9000 }), 15, seeded(3));   // priced for a richer man
    const s = { ...openBust(o), status: 'settled' as const, agreed: 5000 };
    const out = resolveBust(s, 'pay', p, seeded(3));
    assert.ok(out.player.heat > p.heat, 'no consequence for bluffing him');
    assert.ok(out.player.cash < 20 || out.player.cash === 0);
});

console.log(`\n${pass} bust checks passed.\n`);
