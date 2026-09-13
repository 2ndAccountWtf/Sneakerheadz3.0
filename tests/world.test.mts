/**
 * World integrity checks.
 *
 * These exist because a temporary test harness — every store reassigned to one
 * city so layouts could be swept without travelling — was committed by mistake
 * and shipped. The data looked structurally fine; it was only wrong in a way a
 * human would notice by playing. That is exactly what a test is for.
 */
import assert from 'node:assert/strict';
import { STORES_BY_CITY } from '../data/stores.ts';
import { STORE_CONFIGS } from '../data/storeConfigs.ts';
import { CITIES } from '../data/cities.ts';
import { SNEAKERS } from '../data/sneakers.ts';
import { storageMock, STARTER_STORAGE } from '../data/storage.mock.ts';
import { AMPM_ITEMS } from '../data/ampmItems.ts';
import { bathroomsIn } from '../data/bathrooms.ts';
import { getStoreSkin } from '../data/storeSkins.ts';
import { VENUES, venuesIn, isVenueOpen } from '../data/venues.ts';
import { OPPONENTS, getOpponent, effectiveSkill } from '../systems/opponents.ts';
import { INITIAL_PLAYER } from '../constants.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

t('every city has at least one shoe store', () => {
    const empty = CITIES.filter(c => !(STORES_BY_CITY[c.id] ?? []).length);
    assert.equal(empty.length, 0, `cities with no stores: ${empty.map(c => c.id).join(', ')}`);
});

t('stores are spread across cities, not piled into one', () => {
    const counts = CITIES.map(c => ({ id: c.id, n: (STORES_BY_CITY[c.id] ?? []).length }));
    const total = counts.reduce((s, c) => s + c.n, 0);
    const biggest = Math.max(...counts.map(c => c.n));
    // No single city may hold more than half the world's stores. This is the
    // assertion that would have caught the single-city harness.
    assert.ok(
        biggest <= total / 2,
        `one city holds ${biggest} of ${total} stores: ${counts.map(c => c.id + '=' + c.n).join(' ')}`,
    );
    console.log(`      (${total} stores: ${counts.map(c => c.id + '=' + c.n).join(' ')})`);
});

t('every store id is unique across the whole world', () => {
    const all = Object.values(STORES_BY_CITY).flat().map(s => s.id);
    const dupes = all.filter((id, i) => all.indexOf(id) !== i);
    assert.deepEqual(dupes, [], `duplicate store ids: ${dupes.join(', ')}`);
});

t('every listed store has a config, and every config is listed', () => {
    const listed = Object.values(STORES_BY_CITY).flat().map(s => s.id).sort();
    const configured = Object.keys(STORE_CONFIGS).sort();
    assert.deepEqual(listed, configured);
});

t('every store has at least one purchasable tab with a unique inventory group', () => {
    const groups = new Set<string>();
    for (const [id, cfg] of Object.entries(STORE_CONFIGS)) {
        assert.ok(cfg.tabs.length > 0, `${id} has no tabs`);
        const buyable = cfg.tabs.filter(tb => tb.id !== 'trade' && tb.id !== 'consignment');
        assert.ok(buyable.length > 0, `${id} has no tab you can buy from`);
        for (const tab of buyable) {
            assert.ok(
                !groups.has(tab.inventoryGroupRef),
                `${id}/${tab.id} reuses inventory group "${tab.inventoryGroupRef}" — stock would be shared`,
            );
            groups.add(tab.inventoryGroupRef);
        }
    }
});

t('every store resolves to a layout skin', () => {
    for (const [id, cfg] of Object.entries(STORE_CONFIGS)) {
        const skin = getStoreSkin(cfg.brandKey, id);
        assert.ok(skin, `${id} has no skin`);
        assert.ok(skin.accent, `${id} skin has no accent colour`);
    }
});

t('every city has bathrooms', () => {
    for (const c of CITIES) {
        assert.ok(bathroomsIn(c.id).length >= 6, `${c.id} has ${bathroomsIn(c.id).length} bathrooms`);
    }
});

t('every shop listing has a master item record', () => {
    const masters = new Set(storageMock.map(i => i.id));
    const orphans = AMPM_ITEMS.filter(i => !masters.has(i.id)).map(i => i.id);
    assert.deepEqual(orphans, [], `shop listings with no master record: ${orphans.join(', ')}`);
    console.log(`      (${AMPM_ITEMS.length} listings against ${storageMock.length} master items)`);
});

t('the starter kit is a small subset, not the whole catalogue', () => {
    assert.ok(STARTER_STORAGE.length > 0, 'starter kit is empty');
    assert.ok(
        STARTER_STORAGE.length < storageMock.length / 3,
        `starter kit holds ${STARTER_STORAGE.length} of ${storageMock.length} items — the player should not start with the shop`,
    );
    const masters = new Set(storageMock.map(i => i.id));
    for (const item of STARTER_STORAGE) assert.ok(masters.has(item.id), `starter item ${item.id} is not a real item`);
});

t('no item double-counts a stat in both deltas and an effect', () => {
    // useGame applies both, so an overlap would silently apply twice.
    const offenders: string[] = [];
    for (const item of storageMock) {
        if (!item.deltas || !item.effects) continue;
        for (const effect of item.effects) {
            if (effect.type !== 'stat_change') continue;
            const stat = effect.payload?.stat;
            if (stat && (item.deltas as Record<string, number>)[stat] !== undefined) {
                offenders.push(`${item.id}:${stat}`);
            }
        }
    }
    assert.deepEqual(offenders, [], `double-counted stats: ${offenders.join(', ')}`);
});

t('sneaker ids are unique and every rarity tier is populated', () => {
    const ids = SNEAKERS.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate sneaker ids');
    for (const tier of ['Common', 'Uncommon', 'Rare', 'Legendary']) {
        assert.ok(SNEAKERS.some(s => s.rarity === tier), `no ${tier} sneakers`);
    }
    console.log(`      (${SNEAKERS.length} models)`);
});

t('every city has venues, and each is reachable at some point in the day cycle', () => {
    for (const c of CITIES) {
        const list = venuesIn(c.id);
        assert.ok(list.length >= 2, `${c.id} has ${list.length} venues`);
        for (const v of list) {
            const openSomeDay = [0, 1, 2, 3].some(d => isVenueOpen(v, d));
            assert.ok(openSomeDay, `${v.id} is never open`);
        }
    }
    console.log(`      (${VENUES.length} venues across ${CITIES.length} cities)`);
});

t('every venue hosts a game and names regulars who will play it', () => {
    for (const v of VENUES) {
        assert.ok(v.games.length > 0, `${v.id} hosts nothing`);
        // A venue with regulars must have at least one who plays something here,
        // or the challenge generator silently falls back to a stranger.
        if (v.regulars.length) {
            const willing = v.regulars
                .map(getOpponent)
                .filter(Boolean)
                .some(o => o!.games.some(g => v.games.includes(g)));
            assert.ok(willing, `${v.id}: no regular plays any of its games`);
        }
        for (const id of v.regulars) {
            assert.ok(getOpponent(id), `${v.id} lists unknown regular "${id}"`);
        }
    }
});

t('every game offered anywhere has at least one willing opponent', () => {
    const offered = new Set(VENUES.flatMap(v => v.games));
    // Solo activities have no opponent by design.
    const solo = new Set(['mystery-box', 'pizza-run', 'flight-404', 'sneaker-chase', 'legit-check']);
    for (const game of offered) {
        if (solo.has(game)) continue;
        const willing = OPPONENTS.filter(o => o.games.includes(game));
        assert.ok(willing.length > 0, `no opponent plays "${game}"`);
    }
});

t('rivalry raises an opponent skill but never past the cap', () => {
    const o = OPPONENTS[0];
    const fresh = { ...INITIAL_PLAYER, flags: {} };
    const veteran = { ...INITIAL_PLAYER, flags: { [`rival-${o.npcId}`]: 50 } };
    const a = effectiveSkill(o, fresh as any);
    const b = effectiveSkill(o, veteran as any);
    assert.ok(b > a, 'a repeat opponent should be harder');
    assert.ok(b <= 0.92, `skill ran away to ${b}`);
    console.log(`      (${o.name}: ${a.toFixed(2)} fresh -> ${b.toFixed(2)} after many meetings)`);
});

console.log(`\n${pass} world checks passed`);
