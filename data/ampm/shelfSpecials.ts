import type { AmpmAisle } from '../../types';
import { ampmItemsForCity, type AmpmShopItem } from '../ampmItems';
import { getStorageItem } from '../storage.mock';

/**
 * THE SHELF IS WEIRD TODAY.
 * =========================================================================
 * Every day, in every city, three items are at the front of the shop with
 * hand-written cards on them. Nobody on staff will explain the selection and
 * the prices have clearly been decided by feel.
 *
 * Design intent: a convenience store's end-cap is the only retail surface that
 * is allowed to make no sense, so this is where the catalogue's genuinely
 * stupid items get their day — the single flip-flop, the bag of ice, the one
 * extremely expensive olive at four times its normal price, with a queue.
 *
 * The selection is **deterministic in (day, cityId)**. It has to be: the shelf
 * is rendered on every re-render of the shop screen, and a shelf that reshuffles
 * while you are looking at it is not a joke, it is a bug. Same day, same city,
 * same three items, same prices, every time — and different the moment you fly
 * somewhere or the day rolls over.
 */

export interface ShelfSpecial {
    itemId: string;
    blurb: string;
    /** Multiplies the item's normal `AmpmItem.price`. Both directions are used. */
    priceMultiplier: number;
}

/**
 * What qualifies as weird enough for the front of the shop: anything on the
 * specialty or questionable shelves, anything that admits to being useless,
 * and anything else with a high enough wackiness rating in the master data.
 */
const WEIRD_AISLES: AmpmAisle[] = ['specialty', 'questionable'];
const WACKINESS_THRESHOLD = 55;

function isWeird(item: AmpmShopItem): boolean {
    if (WEIRD_AISLES.includes(item.aisle)) return true;
    const master = getStorageItem(item.id);
    if (!master) return false;
    if (master.uselessness) return true;
    return master.stats.wackiness >= WACKINESS_THRESHOLD;
}

/**
 * The card taped to the front of the shelf. Each deal pairs a multiplier with
 * the line that justifies it, because a sign reading "half price" above an item
 * that has tripled is a different and much worse shop.
 */
const DEALS: ReadonlyArray<{ multiplier: number; blurb: string }> = [
    { multiplier: 0.5, blurb: 'Half price. No reason given and none offered.' },
    { multiplier: 0.25, blurb: 'Seventy-five per cent off. The clerk wants it gone and will not say what it did.' },
    { multiplier: 0.1, blurb: 'Almost free. This is not generosity, it is disposal.' },
    { multiplier: 0.75, blurb: 'A quarter off, on a sticker taped over an older sticker that also said a quarter off.' },
    { multiplier: 0.9, blurb: 'Ten per cent off, described on the sign as a MASSIVE EVENT.' },
    { multiplier: 1, blurb: 'Exactly the normal price. It is featured anyway. It is simply featured.' },
    { multiplier: 1.5, blurb: 'Marked up and moved to eye level, facing the door.' },
    { multiplier: 2, blurb: 'Double. Demand, apparently. Nobody has seen the demand.' },
    { multiplier: 3, blurb: 'Triple, written on a card by hand and underlined twice.' },
    { multiplier: 4, blurb: 'Four times the normal price. There is a queue.' },
];

const HEADLINES: readonly string[] = [
    'THE SHELF IS WEIRD TODAY.',
    'THE SHELF IS WEIRD TODAY. NOBODY IS DISCUSSING IT.',
    "TODAY'S SHELF HAS BEEN ARRANGED BY SOMEBODY ELSE.",
    "MANAGER'S SPECIALS. THE MANAGER IS NOT IN.",
    'THESE THREE THINGS ARE AT THE FRONT NOW.',
    'SHELF RESET OVERNIGHT. THE RESULT IS THE RESULT.',
    'FEATURED ITEMS. THE CRITERIA ARE INTERNAL.',
    'THE END-CAP HAS CHANGED AND NOBODY SAW IT HAPPEN.',
    'THREE ITEMS. ONE SHELF. NO EXPLANATION.',
];

/** FNV-1a. Small, stable, and does not depend on anything at runtime. */
function hashString(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** mulberry32 — a seeded PRNG, so (day, city) always yields the same shelf. */
function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** How many items the shelf features. Three fits on a card and in a sentence. */
const SPECIAL_COUNT = 3;

/**
 * The three items at the front of this city's shop today, with their cards.
 *
 * Deterministic for a given (day, cityId): safe to call directly in render.
 * Falls back gracefully if a city somehow carries fewer than three weird items
 * — it features whatever it has rather than returning a short, confusing shelf.
 */
export function getShelfSpecials(day: number, cityId: string): { headline: string; specials: ShelfSpecial[] } {
    const rng = seeded(hashString(`ampm-shelf:${day}:${cityId}`));

    const headline = HEADLINES[Math.floor(rng() * HEADLINES.length)];

    const stock = ampmItemsForCity(cityId);
    const weird = stock.filter(isWeird);
    // If a city's shelf is somehow too sensible, fall back to its whole stock so
    // the feature never renders empty.
    const pool = weird.length >= SPECIAL_COUNT ? [...weird] : [...stock];

    const specials: ShelfSpecial[] = [];
    for (let i = 0; i < SPECIAL_COUNT && pool.length > 0; i++) {
        const item = pool.splice(Math.floor(rng() * pool.length), 1)[0];
        const deal = DEALS[Math.floor(rng() * DEALS.length)];
        specials.push({ itemId: item.id, blurb: deal.blurb, priceMultiplier: deal.multiplier });
    }

    return { headline, specials };
}

/** The featured price, rounded to whole currency. Free promo items stay free. */
export function shelfSpecialPrice(basePrice: number, multiplier: number): number {
    return Math.max(0, Math.round(basePrice * multiplier));
}
