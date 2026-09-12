/**
 * Engine and content checks.
 *
 * Run with `npm test`. These cover the two things most likely to rot: the
 * OutcomeEngine's handling of every authored outcome shape, and the integrity
 * of the content itself — dangling choice targets, dead-end nodes, and outcome
 * types nothing knows how to apply.
 */
import assert from 'node:assert/strict';
import { applyOutcomes, expireBuffs, durationToDays } from '../systems/outcomes/outcomeEngine.ts';
import { getSellPrice, getBuyPrice } from '../systems/pricing.ts';
import { INITIAL_PLAYER } from '../constants.ts';
import { rollBibiEvent } from '../systems/events/bibiEvents.ts';
import { SNEAKERS } from '../data/sneakers.ts';
import { ALL_GAME_NPCS, findInteractionData } from '../data/npcs.ts';
import { resolveEventStub } from '../systems/events/eventResolver.ts';
import { weightsConfig } from '../systems/events/weights.config.ts';
import type { EventCategory } from '../systems/events/categories.ts';

const base = () => JSON.parse(JSON.stringify(INITIAL_PLAYER));
let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log(`  ok  ${name}`); };

// --- duration parsing ---
t('durations convert hours to game days', () => {
  assert.equal(durationToDays('24h'), 1);
  assert.equal(durationToDays('48h'), 2);
  assert.equal(durationToDays('72h'), 3);
  assert.equal(durationToDays('permanent'), undefined);
});

// --- the authored outcome shapes from the data files ---
t('streetCred outcome moves the stat', () => {
  const r = applyOutcomes(base(), [{ type: 'streetCred', change: 8, description: 'x' }], { day: 1 });
  assert.equal(r.player.streetCred, 8);
  assert.equal(r.log.length, 1);
});

t('inventoryChange adds and removes cash', () => {
  let r = applyOutcomes(base(), [{ type: 'inventoryChange', add: [{ kind: 'currency', value: 'cash', qty: 250 }], description: 'x' }], { day: 1 });
  assert.equal(r.player.cash, 2250);
  r = applyOutcomes(r.player, [{ type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: 500 }], description: 'x' }], { day: 1 });
  assert.equal(r.player.cash, 1750);
});

t('cash removal cannot push the player negative', () => {
  const r = applyOutcomes(base(), [{ type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: 999999 }], description: 'x' }], { day: 1 });
  assert.equal(r.player.cash, 0);
});

t('inventoryChange adds a real sneaker by id', () => {
  const r = applyOutcomes(base(), [{ type: 'inventoryChange', add: [{ kind: 'item', value: 'velocity-vipers', qty: 1 }], description: 'x' }], { day: 1 });
  assert.equal(r.player.inventory.length, 1);
  assert.equal(r.player.inventory[0].sneakerId, 'velocity-vipers');
});

t('all-fakes confiscation only takes fakes', () => {
  const p = base();
  p.inventory = [
    { instanceId: 'a', sneakerId: 'chrono-glides', purchasePrice: 10, isFake: true },
    { instanceId: 'b', sneakerId: 'chrono-glides', purchasePrice: 10, isFake: false },
  ];
  const r = applyOutcomes(p, [{ type: 'inventoryChange', remove: [{ kind: 'item', value: 'all-fakes', qty: 10 }], description: 'x' }], { day: 1 });
  assert.equal(r.player.inventory.length, 1);
  assert.equal(r.player.inventory[0].isFake, false);
});

t('statusEffect becomes a day-scoped buff', () => {
  const r = applyOutcomes(base(), [{ type: 'statusEffect', effect: 'blessed', duration: '48h', description: 'x' }], { day: 5 });
  assert.equal(r.player.buffs.length, 1);
  assert.equal(r.player.buffs[0].expiresOnDay, 7);
  assert.equal(expireBuffs(r.player, 7).buffs.length, 0);   // expires on day 7
  assert.equal(expireBuffs(r.player, 6).buffs.length, 1);   // still live on day 6
});

t('permanent status never expires', () => {
  const r = applyOutcomes(base(), [{ type: 'statusEffect', effect: 'favored', duration: 'permanent', description: 'x' }], { day: 1 });
  assert.equal(expireBuffs(r.player, 999).buffs.length, 1);
});

t('priceMarkup under 1 discounts, over 1 boosts resale', () => {
  const disc = applyOutcomes(base(), [{ type: 'priceMarkup', multiplier: 0.9, duration: '24h', description: 'x' }], { day: 1 });
  assert.equal(getBuyPrice(100, disc.player), 90);
  const boost = applyOutcomes(base(), [{ type: 'priceMarkup', multiplier: 1.2, duration: '24h', description: 'x' }], { day: 1 });
  const item = { instanceId: 'a', sneakerId: 'chrono-glides', purchasePrice: 0 };
  assert.equal(getSellPrice(100, item, boost.player), 120);
});

t('scuffed condition shaves 10% off resale', () => {
  const item = { instanceId: 'a', sneakerId: 'chrono-glides', purchasePrice: 0, condition: ['scuffed'] };
  assert.equal(getSellPrice(100, item, base()), 90);
});

t('valueMultiplier from a blessing raises resale', () => {
  const item = { instanceId: 'a', sneakerId: 'chrono-glides', purchasePrice: 0, valueMultiplier: 5 };
  assert.equal(getSellPrice(100, item, base()), 500);
});

t('marketSignal targeting global emits a global signal', () => {
  const r = applyOutcomes(base(), [{ type: 'marketSignal', effect: 'surge', magnitude: 1.35, target: { kind: 'model', value: 'global' }, description: 'x' }], { day: 3 });
  assert.equal(r.signals.length, 1);
  assert.equal(r.signals[0].targets[0].kind, 'global');
  assert.equal(r.signals[0].expiresOnDay, 4);
});

t('combat outcome launches the brawl and carries win/lose payloads', () => {
  const r = applyOutcomes(base(), [
    { type: 'combat', result: 'fight-roll', description: 'x' },
    { type: 'streetCred', condition: 'win', change: 3, description: 'x' },
    { type: 'reputation', condition: 'lose', change: -5, description: 'x' },
  ], { day: 1, sourceName: 'The Game' });
  assert.equal(r.miniGame?.game, 'street-brawl');
  assert.equal(r.miniGame?.onWin?.length, 1);
  assert.equal(r.miniGame?.onLose?.length, 1);
  assert.equal(r.player.streetCred, 0, 'conditional outcomes must not apply immediately');
});

t('miniGame outcome launches the requested game', () => {
  const r = applyOutcomes(base(), [{ type: 'miniGame', game: 'hypecast-roulette', title: 'T', description: 'x' }], { day: 1 });
  assert.equal(r.miniGame?.game, 'hypecast-roulette');
});

t('bibiApproval clamps to 0..100', () => {
  let r = applyOutcomes(base(), [{ type: 'bibiApproval', change: 500, description: 'x' }], { day: 1 });
  assert.equal(r.player.bibiApproval, 100);
  r = applyOutcomes(base(), [{ type: 'bibiApproval', change: -500, description: 'x' }], { day: 1 });
  assert.equal(r.player.bibiApproval, 0);
});

t('health and energy clamp to 0..100', () => {
  const r = applyOutcomes(base(), [
    { type: 'stat_change', payload: { stat: 'health', value: -500 }, description: 'x' },
    { type: 'stat_change', payload: { stat: 'energy', value: 500 }, description: 'x' },
  ], { day: 1 });
  assert.equal(r.player.health, 0);
  assert.equal(r.player.energy, 100);
});

t('inventoryMultiplier scales every pair in the bag', () => {
  const p = base();
  p.inventory = [{ instanceId: 'a', sneakerId: 'chrono-glides', purchasePrice: 10 }];
  const r = applyOutcomes(p, [{ type: 'inventoryMultiplier', min: 5, max: 10, description: 'x' }], { day: 1 });
  const m = r.player.inventory[0].valueMultiplier;
  assert.ok(m >= 5 && m <= 10, `multiplier ${m} out of range`);
});

t('bookkeeping flags produce no log noise', () => {
  const r = applyOutcomes(base(), [{ type: 'flag', key: 'last-bibi-gift-day', value: 3, description: '' }], { day: 3 });
  assert.equal(r.log.length, 0);
  assert.equal(r.player.flags['last-bibi-gift-day'], 3);
});

// --- Bibi gating ---
t('gift scenes never fire below the approval threshold', () => {
  const p = base();
  p.bibiApproval = 10;
  for (let i = 0; i < 400; i++) {
    const e = rollBibiEvent(p, 3);           // day 3 is before the collab window
    assert.equal(e, null);
  }
});

t('gift scenes do fire at high approval, and respect the cooldown', () => {
  const p = base();
  p.bibiApproval = 90;
  let fired = 0;
  for (let i = 0; i < 400; i++) if (rollBibiEvent(p, 3)) fired++;
  assert.ok(fired > 0, 'expected at least one gift over 400 rolls');
  const cooled = { ...p, flags: { 'last-bibi-gift-day': 3 } };
  for (let i = 0; i < 200; i++) assert.equal(rollBibiEvent(cooled, 4), null, 'cooldown must suppress');
});

// --- content integrity: every scenario referenced anywhere must exist ---
t('every NPC scenario has a reachable intro node and valid choice targets', () => {
  let scenarios = 0, nodes = 0;
  for (const npc of ALL_GAME_NPCS) {
    const list = ('scenarios' in npc && npc.scenarios) ? npc.scenarios
      : ('eventTriggers' in npc && npc.eventTriggers) ? npc.eventTriggers.filter(s => 'startNode' in s) : [];
    for (const sc of list) {
      scenarios++;
      assert.ok(sc.nodes?.intro, `${npc.id}/${sc.id} has no intro node`);
      for (const [nodeId, node] of Object.entries(sc.nodes)) {
        nodes++;
        for (const c of node.choices ?? []) {
          assert.ok(sc.nodes[c.next], `${npc.id}/${sc.id}: node "${nodeId}" points at missing node "${c.next}"`);
        }
        // A node must either offer choices or end the conversation.
        assert.ok(node.choices?.length || node.outcomes, `${npc.id}/${sc.id}/${nodeId} is a dead end`);
      }
    }
  }
  console.log(`      (${scenarios} scenarios, ${nodes} nodes checked)`);
  assert.ok(scenarios > 30, `expected plenty of scenarios, found ${scenarios}`);
});

t('every outcome in every scenario is a type the engine handles', () => {
  const handled = new Set(['combat','inventoryChange','notification','streetCred','statusEffect','reputation','priceMarkup','freebie','marketSignal','stat_change','flag','bibiApproval','heat','miniGame','inventoryMultiplier','quest']);
  let count = 0;
  for (const npc of ALL_GAME_NPCS) {
    const list = ('scenarios' in npc && npc.scenarios) ? npc.scenarios
      : ('eventTriggers' in npc && npc.eventTriggers) ? npc.eventTriggers.filter(s => 'startNode' in s) : [];
    for (const sc of list)
      for (const node of Object.values(sc.nodes))
        for (const o of node.outcomes ?? []) {
          count++;
          assert.ok(handled.has(o.type), `${npc.id}/${sc.id}: unhandled outcome type "${o.type}"`);
        }
  }
  console.log(`      (${count} authored outcomes, all handled)`);
  assert.ok(count > 100, `expected 100+ outcomes, found ${count}`);
});

t('every scenario the travel resolver can reach actually exists', () => {
  // Every category must resolve to a real, playable scenario in at least one
  // city — a bad reference used to open an empty dialogue modal.
  const cities = ['tokyo', 'tel-aviv', 'new-york', 'los-angeles', 'paris', 'chicago'];
  const categories = weightsConfig.categories.map(c => c.id as EventCategory)
    .concat(weightsConfig.rare.map(c => c.id as EventCategory));

  for (const category of categories) {
    const resolvedSomewhere = cities.some(toCity => {
      const r = resolveEventStub({ id: `stub-${category}`, category, rarity: 'standard' }, { fromCity: 'tokyo', toCity, timeOfDay: 'night' });
      if (!r) return false;
      const { scenario } = findInteractionData(r.npcId, r.scenarioId);
      return !!scenario;
    });
    assert.ok(resolvedSomewhere, `category "${category}" resolves to nothing playable in any city`);
  }
  console.log(`      (${categories.length} travel categories all resolve)`);
});

console.log(`\n${pass} checks passed`);
