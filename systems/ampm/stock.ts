/**
 * What this AM/PM actually has on the shelf today.
 *
 * Every branch used to carry the entire catalogue: 82 of the 101 items are not
 * city-gated, so the shop was a wall of eighty-two rows in every city, with the
 * same eighty-two rows tomorrow. That is a spreadsheet, not a corner shop —
 * nothing is worth walking in for, nothing is worth coming back for, and the
 * handful of genuinely regional things are buried in the middle of it.
 *
 * A real convenience store is small, a bit random, and out of exactly the thing
 * you came in for. So each city now gets a shelf of roughly twenty items built
 * from four parts:
 *
 *   **Staples** — a stable core this city always carries. This is the part that
 *   matters most: if the Tel Aviv branch stocks burekas, it has to stock them
 *   tomorrow too, or the player cannot plan anything and every visit is a
 *   fresh coin-toss. Same lesson the sneaker market taught — a world that
 *   re-rolls nightly cannot be learned, and a world that cannot be learned
 *   cannot be played well.
 *
 *   **Regional** — anything gated to this city is always offered here. That is
 *   the entire reason those items were written.
 *
 *   **Rotation** — a slowly-changing set, keyed to the week rather than the day,
 *   so the shelf looks different when you come back on Thursday but has not
 *   reshuffled between two visits on Tuesday.
 *
 *   **Weapons** — one or two, because the AM/PM being where you buy a chancla
 *   before a fight is one of the better jokes in the game and it stops working
 *   if all eleven are always there.
 *
 * On top of that, one to three items are **sold out** on any given day. Sold-out
 * stock is shown struck through rather than hidden: "they are out of the good
 * hummus" is a small event, and hiding it would just look like a shorter list.
 */
import type { AmpmAisle } from '../../types';
import { AMPM_ITEMS, type AmpmShopItem } from '../../data/ampmItems';
import { WEAPONS } from '../weapons';
import { hashString, seeded } from '../../utils/rng';

/** Aisles whose contents are edible. The spine of the shop. */
const EDIBLE: AmpmAisle[] = ['food', 'drinks', 'bakery', 'snacks', 'frozen'];

/** Aisles of things you do not eat, mostly. */
const DRY_GOODS: AmpmAisle[] = ['household', 'personal-care'];

/** The back of the shop, where the decisions get worse. */
const ODDITIES: AmpmAisle[] = ['specialty', 'questionable'];

/** How many of each kind a branch carries. Small on purpose. */
const BUDGET = {
    edibleStaples: 4,
    edibleRotating: 2,
    dryGoods: 3,
    oddities: 2,
    weapons: 2,
};

/* ------------------------------------------------------------------------- *
 * How the shop is walked
 * ------------------------------------------------------------------------- */

/**
 * The nine aisles are good data — an item knows it is bakery rather than
 * snacks, and the item cards say so. They are a bad way to *walk* a shop this
 * size. A branch carries around seventeen things, so offering a pill per aisle
 * meant Bakery was one pastry, Frozen was one tub, and Personal Care was one
 * bottle of hair gel: eleven pills wrapping to three rows above the shelf, most
 * of them leading to a single row.
 *
 * So browsing collapses to the four groups a person actually shops by. This
 * lives here rather than in the screen because it is a claim about the
 * catalogue — every aisle has a home, and an item has exactly one — and claims
 * about the catalogue are the kind that should fail in a test rather than
 * quietly put a new aisle somewhere nobody looks.
 */
export type ShelfSection = 'food' | 'drinks' | 'weapons' | 'odds';

export const SECTION_ORDER: ShelfSection[] = ['food', 'drinks', 'weapons', 'odds'];

/** Every aisle in `AMPM_AISLE_ORDER` must appear here. A test enforces it. */
export const AISLE_SECTION: Record<AmpmAisle, ShelfSection> = {
    food: 'food',
    bakery: 'food',
    snacks: 'food',
    frozen: 'food',
    drinks: 'drinks',
    household: 'odds',
    'personal-care': 'odds',
    specialty: 'odds',
    questionable: 'odds',
};

/**
 * Which single group an item is browsed under. Being swingable beats whatever
 * aisle a chancla is filed under: if you can hit somebody with it, that is the
 * fact about it you walked in for.
 */
export const sectionOf = (id: string, aisle: AmpmAisle | undefined): ShelfSection => {
    if (isWeaponItem(id)) return 'weapons';
    return (aisle && AISLE_SECTION[aisle]) || 'odds';
};

/** How many days a rotation holds before the shelf changes. */
const ROTATION_DAYS = 3;

const WEAPON_IDS = new Set(WEAPONS.map((w) => w.id));

/** True if this item is something you could swing at somebody. */
export const isWeaponItem = (id: string): boolean => WEAPON_IDS.has(id);

/* ------------------------------------------------------------------ */
/* Deterministic RNG — same recipe as data/ampm/shelfSpecials.ts        */
/* ------------------------------------------------------------------ */



/** Picks `count` distinct entries, deterministically, without mutating input. */
function pick<T>(pool: T[], count: number, rng: () => number): T[] {
    const remaining = [...pool];
    const out: T[] = [];
    while (out.length < count && remaining.length) {
        out.push(remaining.splice(Math.floor(rng() * remaining.length), 1)[0]);
    }
    return out;
}

const inAisles = (items: AmpmShopItem[], aisles: AmpmAisle[]): AmpmShopItem[] =>
    items.filter((i) => i.aisle !== undefined && aisles.includes(i.aisle) && !isWeaponItem(i.id));

/* ------------------------------------------------------------------ */
/* The shelf                                                           */
/* ------------------------------------------------------------------ */

export interface ShelfEntry {
    item: AmpmShopItem;
    /** False when the branch has run out today. Still listed, struck through. */
    inStock: boolean;
    /** Why it is here — drives the small label on the row. */
    reason: 'staple' | 'regional' | 'rotating' | 'weapon';
}

/**
 * Everything this city's branch carries, in stock or not.
 *
 * Staples are seeded on the city alone, so they never move. Rotation is seeded
 * on the city and the week. Stockouts are seeded on the city and the day, which
 * is the only part that changes between two visits on the same date.
 */
export function shelfFor(cityId: string, day: number): ShelfEntry[] {
    const local = AMPM_ITEMS.filter((i) => !i.cities || i.cities.includes(cityId));

    // Regional first — these are the reason to be in this city at all.
    const regional = local.filter((i) => i.cities?.includes(cityId));
    const claimed = new Set(regional.map((i) => i.id));
    const free = local.filter((i) => !claimed.has(i.id));

    // Staples: fixed for the whole run.
    const stapleRng = seeded(hashString(`ampm-staples:${cityId}`));
    const staples = pick(inAisles(free, EDIBLE), BUDGET.edibleStaples, stapleRng);
    staples.forEach((i) => claimed.add(i.id));

    // Rotation: changes every few days, not every day.
    const week = Math.floor((day - 1) / ROTATION_DAYS);
    const rotRng = seeded(hashString(`ampm-rotation:${cityId}:${week}`));
    const stillFree = free.filter((i) => !claimed.has(i.id));

    const rotating = [
        ...pick(inAisles(stillFree, EDIBLE), BUDGET.edibleRotating, rotRng),
        ...pick(inAisles(stillFree, DRY_GOODS), BUDGET.dryGoods, rotRng),
        ...pick(inAisles(stillFree, ODDITIES), BUDGET.oddities, rotRng),
    ];
    rotating.forEach((i) => claimed.add(i.id));

    const weapons = pick(
        local.filter((i) => isWeaponItem(i.id) && !claimed.has(i.id)),
        BUDGET.weapons,
        rotRng,
    );

    const shelf: ShelfEntry[] = [
        ...regional.map((item) => ({ item, inStock: true, reason: 'regional' as const })),
        ...staples.map((item) => ({ item, inStock: true, reason: 'staple' as const })),
        ...rotating.map((item) => ({ item, inStock: true, reason: 'rotating' as const })),
        ...weapons.map((item) => ({ item, inStock: true, reason: 'weapon' as const })),
    ];

    // Sold out: one to three things, today only. A staple can sell out — that is
    // the point of it being the thing everybody wants — but never all of them.
    const outRng = seeded(hashString(`ampm-stockout:${cityId}:${day}`));
    const outCount = 1 + Math.floor(outRng() * 3);
    const victims = new Set(pick(shelf.map((e) => e.item.id), outCount, outRng));

    return shelf.map((e) => (victims.has(e.item.id) ? { ...e, inStock: false } : e));
}

/** Just the items a player can actually buy here today. */
export const availableAt = (cityId: string, day: number): AmpmShopItem[] =>
    shelfFor(cityId, day).filter((e) => e.inStock).map((e) => e.item);

/** Aisles with something on them today, in catalogue order. */
export function aislesOnShelf(shelf: ShelfEntry[]): AmpmAisle[] {
    const present = new Set(shelf.map((e) => e.item.aisle).filter(Boolean) as AmpmAisle[]);
    return [...present];
}
