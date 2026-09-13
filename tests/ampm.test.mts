/**
 * The AM/PM shelf.
 *
 * Every branch used to carry the whole catalogue — 82 of the 101 items are not
 * city-gated, so the shop was the same wall of eighty-two rows in every city,
 * every day. These checks hold the shape of the fix: a small shelf, stable
 * enough to plan around, varied enough to be worth checking, and genuinely
 * different between cities.
 */
import assert from 'node:assert/strict';
import { CITIES } from '../data/cities.ts';
import { AMPM_ITEMS } from '../data/ampmItems.ts';
import { shelfFor, availableAt, isWeaponItem } from '../systems/ampm/stock.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const EDIBLE = ['food', 'drinks', 'bakery', 'snacks', 'frozen'];
const ids = (city: string, day: number) => shelfFor(city, day).map(e => e.item.id).sort().join(',');

t('a branch carries a shelf, not the catalogue', () => {
    for (const c of CITIES) {
        const shelf = shelfFor(c.id, 1);
        assert.ok(shelf.length >= 10 && shelf.length <= 26,
            `${c.id} carries ${shelf.length} items — that is a warehouse, not a corner shop`);
        assert.ok(shelf.length < AMPM_ITEMS.length / 3,
            `${c.id} still carries most of the catalogue`);
    }
});

t('there is enough to eat, and something to swing', () => {
    for (const c of CITIES) {
        const shelf = shelfFor(c.id, 1);
        const edible = shelf.filter(e => EDIBLE.includes(e.item.aisle!)).length;
        const weapons = shelf.filter(e => isWeaponItem(e.item.id)).length;
        assert.ok(edible >= 7 && edible <= 14, `${c.id} has ${edible} edible items`);
        assert.ok(weapons >= 1 && weapons <= 4, `${c.id} has ${weapons} weapons`);
    }
});

t('every city-gated item is actually on the shelf in its own city', () => {
    // These items exist purely to make a city feel like itself. An item that is
    // regional to Tel Aviv and then not stocked in Tel Aviv is dead content.
    for (const item of AMPM_ITEMS.filter(i => i.cities)) {
        for (const city of item.cities!) {
            assert.ok(
                shelfFor(city, 1).some(e => e.item.id === item.id),
                `${item.id} is regional to ${city} and is not stocked there`,
            );
        }
    }
});

t('the shelf is deterministic for a given city and day', () => {
    for (const c of CITIES) {
        assert.equal(ids(c.id, 9), ids(c.id, 9), `${c.id} reshuffles between reads of the same day`);
    }
});

t('staples never move, so the player can rely on them', () => {
    // The lesson the sneaker market taught: a world that re-rolls nightly
    // cannot be learned, and one that cannot be learned cannot be played well.
    for (const c of CITIES) {
        const day1 = shelfFor(c.id, 1).filter(e => e.reason === 'staple').map(e => e.item.id);
        assert.ok(day1.length > 0, `${c.id} has no staples at all`);
        for (let day = 2; day <= 30; day++) {
            const later = new Set(shelfFor(c.id, day).filter(e => e.reason === 'staple').map(e => e.item.id));
            for (const id of day1) {
                assert.ok(later.has(id), `${c.id} dropped staple ${id} on day ${day}`);
            }
        }
    }
});

t('the shelf rotates over a week but not between two visits on one day', () => {
    assert.equal(ids('tokyo', 1), ids('tokyo', 2), 'the shelf reshuffled overnight');
    assert.notEqual(ids('tokyo', 1), ids('tokyo', 10), 'the shelf never changes at all');
});

t('something is always sold out, and never everything', () => {
    for (const c of CITIES) {
        for (let day = 1; day <= 10; day++) {
            const shelf = shelfFor(c.id, day);
            const out = shelf.filter(e => !e.inStock).length;
            assert.ok(out >= 1 && out <= 3, `${c.id} day ${day}: ${out} items sold out`);
            assert.ok(availableAt(c.id, day).length >= 8,
                `${c.id} day ${day}: only ${availableAt(c.id, day).length} things left to buy`);
        }
    }
});

t('two cities do not stock the same shop', () => {
    const shelves = CITIES.map(c => new Set(shelfFor(c.id, 1).map(e => e.item.id)));
    for (let i = 0; i < shelves.length; i++) {
        for (let j = i + 1; j < shelves.length; j++) {
            const shared = [...shelves[i]].filter(id => shelves[j].has(id)).length;
            const smaller = Math.min(shelves[i].size, shelves[j].size);
            assert.ok(shared / smaller < 0.8,
                `${CITIES[i].id} and ${CITIES[j].id} share ${shared} of ${smaller} items`);
        }
    }
});

console.log(`\n${pass} ampm checks passed.`);
