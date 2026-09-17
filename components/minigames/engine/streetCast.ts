/**
 * The neighbourhood both street games share.
 *
 * Downhill Racer and Pizza Run look at the same road from the same angle — a
 * first-floor balcony across the street, lanes stacked up the screen, no
 * vanishing point (`docs/ASSETS-STREET.md` §1.1). So the people on the pavement
 * are the same people, and they live here rather than in one game's file.
 *
 * They are scenery. Every one of them is behind the kerb, so none can ever be
 * something you hit — which is the only reason they are allowed to be this
 * close to the racing line and this varied.
 */

export interface CastMember {
    id: string;
    /**
     * What to draw if the sheet is missing.
     *
     * Both games fall back to a glyph rather than a gap when art has not landed
     * yet, and a person and a pile of belongings should not fall back to the
     * same character. Carried on the member so the caller does not have to know
     * which list it came from.
     */
    glyph: string;
    /**
     * Drawn height in game pixels — not the frame's.
     *
     * The sheets are padded differently: a kettlebell swing needs room for the
     * arc, a podcast needs room for the mic. Normalising on the frame would make
     * the ones with the most air the smallest people.
     */
    h: number;
}

/**
 * People. A standing adult is 23 game pixels close up, and these are across the
 * street, so they sit around 17.
 */
export const STREET_CAST: readonly CastMember[] = [
    { id: 'granny-walk', h: 18, glyph: '🚶' },
    { id: 'granny-sit', h: 16, glyph: '🚶' },
    { id: 'granny-purse-smack', h: 18, glyph: '🚶' },
    { id: 'granny-basketball', h: 19, glyph: '🚶' },
    { id: 'granny-duck', h: 15, glyph: '🚶' },
    { id: 'podcaster-podcast', h: 19, glyph: '🚶' },
    { id: 'podcaster-kettlebell', h: 19, glyph: '🚶' },
    { id: 'podcaster-eat-mushroom', h: 18, glyph: '🚶' },
    { id: 'unhoused-neighbor-a', h: 17, glyph: '🚶' },
    { id: 'unhoused-neighbor-b', h: 17, glyph: '🚶' },
    { id: 'cart-pusher-walk', h: 18, glyph: '🚶' },
    { id: 'elote-vendor-walk', h: 18, glyph: '🚶' },
    { id: 'influencer-selfie-walk', h: 18, glyph: '🚶' },
    { id: 'tiny-bicycle', h: 16, glyph: '🚲' },
];

/**
 * Things somebody left on the pavement. Same band, different slots.
 *
 * An encampment is a fact of the street this game is set on, drawn as what it
 * is — somebody's belongings, kept together — rather than as a joke or as
 * rubble. It sits on the verge with the rest of the neighbourhood.
 */
export const STREET_STUFF: readonly CastMember[] = [
    { id: 'encampment-a', h: 16, glyph: '🛒' },
    { id: 'encampment-b', h: 17, glyph: '🛒' },
    { id: 'shopping-cart-belongings', h: 14, glyph: '🛒' },
];

/**
 * Who does something different when you come past.
 *
 * The cat already works this way: it bolts when you are close and otherwise
 * sits. It is the cheapest thing in either game that makes the street feel
 * aware of you, because the alternative — a loop that happens to be playing —
 * reads as a loop however good the art is.
 *
 * The influencer is the one the delivery clearly intends it for: she walks, and
 * when you are alongside she turns and poses.
 */
export const NEAR_SWAP: Record<string, string> = {
    'influencer-selfie-walk': 'influencer-selfie-turn-pose',
};

/** How close counts as worth reacting to, in game pixels. */
export const NEAR_PX = 52;

/**
 * A finalising bit mixer (the splitmix32 tail).
 *
 * `slot` is a counter, so a single multiply leaves neighbouring hashes a fixed
 * stride apart and the bits of one correlated with the bits of the next. The
 * shift-xor-multiply rounds destroy that, which is what lets `castAt` read two
 * independent decisions out of one number.
 */
function mix(n: number): number {
    let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
}

/**
 * Who stands in this slot.
 *
 * Deterministic from the slot index, so the street is the same street every
 * time you ride down it, and hashed rather than taken modulo so neighbours
 * differ instead of marching in a repeating order.
 */
export function castAt(slot: number, playerX: number, slotX: number): CastMember {
    const h = mix(slot);
    // One slot in four is somebody's belongings rather than somebody.
    //
    // The two decisions read disjoint bit fields. Taking both off the low end
    // of a plain multiplicative hash — `h % 4` for the list and `h % 14` for
    // the member — correlates them, because both depend on bit 1, and the
    // street comes out clumpy: measurably more side-by-side duplicates than
    // chance. `mix` decorrelates the bits so the fields are independent.
    const list = (h & 3) === 3 ? STREET_STUFF : STREET_CAST;
    const base = list[(h >>> 8) % list.length];
    const near = Math.abs(slotX - playerX) < NEAR_PX;
    const swapped = near ? NEAR_SWAP[base.id] : undefined;
    return swapped ? { ...base, id: swapped } : base;
}
