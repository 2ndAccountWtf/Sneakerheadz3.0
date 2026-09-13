/**
 * Digestion system checks.
 *
 * The gas meter and bathroom emergencies interrupt the core loop, so their
 * probabilities and escalation thresholds are worth pinning down: a system
 * that fires too often stops being funny, and one that never fires is dead
 * code the player never sees.
 */
import assert from 'node:assert/strict';
import { gasTier, incidentChance, rollGasIncident, settleGas } from '../systems/digestion/gas.ts';
import { rollDigestiveOutcome, attemptBathroom, startEmergency, secondsLeft, hasExpired } from '../systems/digestion/emergency.ts';
import { bathroomsIn, BATHROOMS } from '../data/bathrooms.ts';
import { INITIAL_PLAYER } from '../constants.ts';

const base = (over = {}) => ({ ...JSON.parse(JSON.stringify(INITIAL_PLAYER)), ...over });
let pass = 0;
const t = (n, f) => { f(); pass++; console.log('  ok ', n); };

t('gas tiers escalate in order', () => {
  assert.equal(gasTier(0), 'silent');
  assert.equal(gasTier(4), 'audible');
  assert.equal(gasTier(7), 'noticed');
  assert.equal(gasTier(10), 'incident');
  assert.equal(gasTier(12), 'biological');
});

t('incident chance rises with tier and is zero when silent', () => {
  assert.equal(incidentChance(0), 0);
  assert.ok(incidentChance(4) < incidentChance(7));
  assert.ok(incidentChance(7) < incidentChance(10));
  assert.ok(incidentChance(12) <= 0.5, 'never a coin flip even at max');
});

t('silent gas never produces an incident', () => {
  const p = base({ gas: 1 });
  for (let i = 0; i < 500; i++) assert.equal(rollGasIncident(p, 'bibi'), null);
});

t('high gas eventually fires, relieves pressure, and costs cred publicly', () => {
  const p = base({ gas: 12 });
  let fired = null;
  for (let i = 0; i < 500 && !fired; i++) fired = rollGasIncident(p, 'bibi');
  assert.ok(fired, 'expected an incident at max gas over 500 rolls');
  assert.ok(fired.gasRelieved > 0);
  assert.ok(fired.credChange < 0, 'a biological event should cost standing');
  assert.ok(fired.line.length > 0);
});

t('each NPC reacts in their own voice', () => {
  const p = base({ gas: 12 });
  const lines = new Set();
  for (const npc of ['bibi', 'grandma-laces', 'adc', 'bro-jogan', 'the-game']) {
    for (let i = 0; i < 300; i++) {
      const r = rollGasIncident(p, npc);
      if (r) { lines.add(npc + '::' + r.line); break; }
    }
  }
  assert.equal(lines.size, 5, 'every NPC should have produced a distinct reaction');
});

t('gas settles overnight but never goes negative', () => {
  assert.equal(settleGas(1), 0);
  assert.equal(settleGas(10), 7);
});

t('zero-risk food never triggers an emergency', () => {
  const p = base();
  const safe = { name: 'Banana', digestiveRisk: 0 } as any;
  for (let i = 0; i < 500; i++) assert.equal(rollDigestiveOutcome(safe, p), null);
});

t('high-risk food triggers, and severity scales with risk', () => {
  const p = base();
  const nasty = { name: 'Chocolate Milk (Bag)', digestiveRisk: 0.9 } as any;
  let e = null;
  for (let i = 0; i < 200 && !e; i++) e = rollDigestiveOutcome(nasty, p);
  assert.ok(e, 'expected an emergency from 0.9 risk');
  assert.equal(e.severity, 3);

  const mild = { name: 'Yogurt', digestiveRisk: 0.12 } as any;
  let m = null;
  for (let i = 0; i < 2000 && !m; i++) m = rollDigestiveOutcome(mild, p);
  assert.ok(m);
  assert.equal(m.severity, 1);
});

t('a loaded stomach raises the odds', () => {
  const calm = base({ gas: 0 });
  const loaded = base({ gas: 9 });
  const item = { name: 'x', digestiveRisk: 0.2 } as any;
  const rate = (p) => {
    let hits = 0;
    for (let i = 0; i < 4000; i++) if (rollDigestiveOutcome(item, p)) hits++;
    return hits / 4000;
  };
  const a = rate(calm), b = rate(loaded);
  assert.ok(b > a, `loaded (${b.toFixed(3)}) should exceed calm (${a.toFixed(3)})`);
  console.log(`      (calm ${a.toFixed(3)} vs loaded ${b.toFixed(3)})`);
});

t('severity decides the clock', () => {
  assert.ok(secondsLeft(startEmergency('x', 3)) <= 90);
  assert.ok(secondsLeft(startEmergency('x', 1)) > 90);
  assert.equal(hasExpired(startEmergency('x', 1)), false);
});

t('every city has bathrooms, and cheap ones are less reliable', () => {
  for (const city of ['tokyo','tel-aviv','new-york','los-angeles','paris','chicago']) {
    const list = bathroomsIn(city);
    assert.ok(list.length >= 6, `${city} has only ${list.length}`);
  }
  const free = BATHROOMS.filter(b => b.price === 0);
  const paid = BATHROOMS.filter(b => b.price > 0);
  const avg = a => a.reduce((s, b) => s + b.unreliability, 0) / a.length;
  assert.ok(avg(free) > avg(paid), 'free should be less reliable than paid');
  console.log(`      (free ${avg(free).toFixed(2)} vs paid ${avg(paid).toFixed(2)} unreliability)`);
});

t('you cannot use a bathroom you cannot afford', () => {
  const broke = base({ cash: 0 });
  const pricey = BATHROOMS.find(b => b.price > 0);
  const r = attemptBathroom(pricey, broke);
  assert.equal(r.ok, false);
  assert.match(r.line, /afford/);
});

t('a reliable bathroom usually works and charges you', () => {
  const rich = base({ cash: 9999 });
  const good = BATHROOMS.find(b => b.unreliability <= 0.05 && b.price > 0);
  let ok = 0;
  for (let i = 0; i < 200; i++) if (attemptBathroom(good, rich).ok) ok++;
  assert.ok(ok > 170, `expected mostly successes, got ${ok}/200`);
  const success = attemptBathroom(good, rich);
  if (success.ok) {
    assert.ok(success.outcomes.some(o => o.type === 'inventoryChange'), 'paid bathrooms must charge');
  }
});

console.log(`\n${pass} digestion checks passed`);

