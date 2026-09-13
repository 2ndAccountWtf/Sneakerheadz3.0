/**
 * What kind of shoe is this, really?
 *
 * The 45 models carry a rarity and a base price and nothing else, which is
 * enough to sort them and not nearly enough for a market to have opinions. A
 * city cannot prefer skate shoes if nothing knows which ones are skate shoes.
 *
 * So this module derives a tag set per model from three signals, cheapest
 * first: an explicit override, the silhouette it was drawn on (a shoe drawn on
 * `shoe-skate` is a skate shoe), and keywords in its id. Deriving rather than
 * hand-tagging means a new sneaker added to `data/sneakers.ts` is tagged the
 * moment it gets a sprite look, instead of silently falling out of every city
 * preference until someone remembers a second table exists.
 */
import type { Sneaker } from '../../types';
import { lookForSneaker } from '../../data/sprites/sneakers';

export type ShoeTag =
    | 'basketball'  // hoops heritage — Chicago's whole personality
    | 'runner'      // dad shoes, tech runners
    | 'skate'       // vulcanised, SB-adjacent
    | 'luxury'      // fashion house money
    | 'collab'      // two names on the box
    | 'tech'        // self-lacing, "neural", future-facing
    | 'retro'       // reissues and heritage colourways
    | 'hype'        // whatever the internet is currently screaming about
    | 'casual'      // slides, slip-ons, the shoes you actually wear
    | 'workwear';   // boots

/** Silhouette → the tags that silhouette implies. */
const BY_ARCHETYPE: Record<string, ShoeTag[]> = {
    'shoe-hightop': ['basketball'],
    'shoe-lowtop': ['basketball', 'casual'],
    'shoe-runner': ['runner'],
    'shoe-knit': ['runner', 'tech'],
    'shoe-chunky': ['runner', 'luxury'],
    'shoe-foam': ['casual', 'tech'],
    'shoe-skate': ['skate'],
    'shoe-boot': ['workwear'],
    'shoe-slide': ['casual'],
    'shoe-slipon': ['casual', 'skate'],
    'shoe-grail': ['hype', 'collab'],
};

/** Substring in the model id → tags. First match does not stop the scan. */
const BY_KEYWORD: Array<[RegExp, ShoeTag[]]> = [
    [/jordan|dunk|air-force|af1/, ['basketball', 'retro']],
    [/\bsb\b|sb-|skate|vans|janoski/, ['skate']],
    [/lv|louis|balenciaga|dior|gucci|prada|off-white|luxury/, ['luxury']],
    [/travis|union|fragment|kaws|supreme|mschef|collab|x-/, ['collab', 'hype']],
    [/yeezy|y-dol|boost|red-october/, ['hype']],
    [/mag|self-lacing|neural|ai-|cyber|quantum|chrono|nano/, ['tech']],
    [/retro|og-|heritage|1985|chicago|bred/, ['retro']],
    [/boost|runner|glide|velocity|2002r|990|new-balance|nb-/, ['runner']],
    [/slide|foam|croc|clog/, ['casual']],
    [/boot|timb|duck/, ['workwear']],
];

/**
 * Models whose derivation would be wrong or merely dull. Kept short on
 * purpose — if this list grows past a dozen the derivation rules are the thing
 * that needs fixing.
 */
const OVERRIDES: Record<string, ShoeTag[]> = {
    'nike-sb-dunk-low-pigeon': ['skate', 'retro', 'hype', 'basketball'],
    'nike-mag-self-lacing': ['tech', 'hype', 'retro'],
    'balenciaga-crocs-gundam': ['luxury', 'casual', 'collab'],
    'off-white-ikea-frakta': ['collab', 'luxury', 'hype'],
    'lv-nike-af1': ['luxury', 'collab', 'basketball'],
    'mschef-satans-skateboard': ['collab', 'skate', 'hype'],
};

const cache = new Map<string, ShoeTag[]>();

export function tagsFor(sneaker: Sneaker): ShoeTag[] {
    const hit = cache.get(sneaker.id);
    if (hit) return hit;

    const tags = new Set<ShoeTag>(OVERRIDES[sneaker.id] ?? []);

    if (!OVERRIDES[sneaker.id]) {
        const archetype = lookForSneaker(sneaker.id).archetype;
        for (const t of BY_ARCHETYPE[archetype] ?? []) tags.add(t);

        const haystack = `${sneaker.id} ${sneaker.name.toLowerCase().replace(/\s+/g, '-')}`;
        for (const [pattern, add] of BY_KEYWORD) {
            if (pattern.test(haystack)) add.forEach((t) => tags.add(t));
        }

        // Legendary models are, by definition, the ones people are shouting
        // about. Rare ones are on the way there.
        if (sneaker.rarity === 'Legendary') tags.add('hype');
    }

    if (!tags.size) tags.add('casual');

    const out = [...tags];
    cache.set(sneaker.id, out);
    return out;
}

export const hasTag = (sneaker: Sneaker, tag: ShoeTag): boolean =>
    tagsFor(sneaker).includes(tag);

/** Test/hot-reload hook. */
export const clearTagCache = (): void => cache.clear();
