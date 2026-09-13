/**
 * Who walks up.
 * ============
 * A selling spot is just a place until someone actually stops. This module
 * generates that someone — one `StreetBuyer` (the fixed contract in
 * `types/hype.ts`) at a time — as a pure-ish function of the spot, the day,
 * and the player. "Pure-ish" because, like `systems/collectors.ts`'s
 * negotiation rolls, it uses `Math.random()` directly rather than threading a
 * seeded rng: a street corner is allowed to be different every time you visit
 * it, unlike `systems/npc/schedule.ts`'s placements, which must not reshuffle
 * on a re-render.
 *
 * The three kinds are deliberately built from different inputs so they read
 * as different people, not one generator with a dial turned:
 *
 *   - **local** — a flat 70-95% of what the pair is worth in *this* city.
 *     They live here; they are not going to be fooled into overpaying for
 *     something the local market doesn't care about.
 *   - **international** — priced off `relativeValue` in their *home* city,
 *     not this one. A buyer from a city whose taste runs hot for a shoe's
 *     tags will pay well over 100% of local value for it, which is the
 *     entire point of them — see the module doc on `relativeValue` in
 *     `systems/market/simulate.ts`.
 *   - **celebrity** — drawn from the same four names the rest of the game
 *     knows (`systems/npc/schedule.ts`'s `SCHEDULABLE_NPC_IDS`), gated by
 *     `isNpcInCity` so one never turns up somewhere they couldn't plausibly
 *     be today. Pays far over, and a clean sale moves `Player.connections`
 *     the same way a private sale does in `systems/collectors.ts`.
 *
 * A note on ids: this module's `npcId` values (`donald-drip`, `the-game`,
 * `bro-jogan`, `yasser-abbasfat`) match `systems/npc/schedule.ts`'s
 * `SCHEDULABLE_NPC_IDS` exactly, because `isNpcInCity` requires it. Two of
 * those four (`donald-drip`, `the-game`) are keyed in `data/collectors.ts`
 * under a *different* string (`celeb-donald-drip`, `celeb-the-game`) for the
 * same people. That mismatch already exists between those two files; this
 * module does not introduce it, and does not read `data/collectors.ts` at
 * all, but it does mean standing built on the street and standing built at a
 * private sale are tracked separately for those two celebrities until
 * someone reconciles the two id schemes.
 *
 * `HypeEvent` (from `types/hype.ts`) is a real, already-final type, and
 * `activeHypeEvent(day, cityId)` already exists in
 * `systems/events/hypeCalendar.ts` — so every hype-aware export here just
 * takes `hype: HypeEvent | null` as a plain argument rather than reaching
 * for the calendar itself. `screens/StreetSellScreen.tsx` is what actually
 * calls `activeHypeEvent` and passes the result in, which keeps this module
 * independent of anything calendar-shaped and easy to run headless (see the
 * verification script).
 */
import type { InventoryItem, Player, Sneaker } from '../../types';
import type { StreetBuyer, BuyerKind, HypeEvent } from '../../types/hype';
import { SNEAKERS } from '../../data/sneakers';
import { CITIES } from '../../data/cities';
import type { SellingSpot } from '../../data/sellingSpots';
import { relativeValue } from '../market/simulate';
import { profileFor, type CityProfile } from '../market/cityProfiles';
import { tagsFor, type ShoeTag } from '../market/taxonomy';
import { isNpcInCity } from '../npc/schedule';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const uid = () => Math.random().toString(36).slice(2, 10);

// --- Tunables, named so the verification script and this file agree on what they mean. ---
const LOCAL_OFFER_MIN = 0.70;
const LOCAL_OFFER_SPAN = 0.25; // 0.70 - 0.95
const INTL_OPEN_FRAC = [0.75, 0.90]; // fraction of relMult they open at
const INTL_CEIL_FRAC = [1.00, 1.30]; // fraction of relMult their real ceiling reaches
/** How much a buyer's own standing with a celebrity moves their generosity, +/-. */
const CELEB_STANDING_SWING = 0.25;

/**
 * Does this buyer actually want this pair, beyond a courtesy lowball? Mirrors
 * `systems/collectors.ts#interestedIn` — undefined wants means "anything".
 */
export function interestedIn(buyer: StreetBuyer, item: InventoryItem): boolean {
    const sneaker = SNEAKERS.find(s => s.id === item.sneakerId);
    if (!sneaker) return false;
    if (buyer.wantsSneakerId) return buyer.wantsSneakerId === item.sneakerId;
    if (buyer.wantsRarity) return buyer.wantsRarity === sneaker.rarity;
    if (buyer.wantsTag) return tagsFor(sneaker).includes(buyer.wantsTag as ShoeTag);
    return true;
}

/* ------------------------------------------------------------------ *
 * Local
 * ------------------------------------------------------------------ */

const LOCAL_NAMES = [
    'Jamie', 'Marcus', 'Priya', 'Kenji', 'Diego', 'Leah', 'Rocco', 'Aisha',
    'Theo', 'Mika', 'Deshawn', 'Yuki', 'Sofia', 'Omar',
];

const LOCAL_OPENERS = [
    "Yo, what you got? I'm not trying to overpay for it.",
    'Let me see the box first. I know what these actually go for.',
    "Real talk, I'll take it off your hands right now, cash.",
    "I've bought like this a dozen times. Don't waste my time.",
    "How much you want? And don't say retail.",
    "I'm not a collector, I just need a pair that fits.",
    'Quick look, quick price — I got somewhere to be.',
    'Everybody around here knows what these cost. Do not try me.',
];

function buildLocalBuyer(priceMult: number): StreetBuyer {
    const offerPct = clamp((LOCAL_OFFER_MIN + Math.random() * LOCAL_OFFER_SPAN) * priceMult, 0.4, 1.15);
    const ceilingPct = clamp(offerPct + (0.03 + Math.random() * 0.07), offerPct + 0.02, 1.25);
    // Volume trade: often anything goes, sometimes they're specifically after
    // whatever's cheap and easy to flip again.
    const wantsRarity = Math.random() < 0.4 ? pick<Sneaker['rarity']>(['Common', 'Uncommon']) : undefined;

    return {
        id: uid(),
        kind: 'local',
        name: pick(LOCAL_NAMES),
        opener: pick(LOCAL_OPENERS),
        wantsRarity,
        offerPct,
        ceilingPct,
        eye: 0.15 + Math.random() * 0.2,
        danger: 0.02 + Math.random() * 0.06,
        patience: 20 + Math.random() * 25,
    };
}

/* ------------------------------------------------------------------ *
 * International
 * ------------------------------------------------------------------ */

const INTL_NAMES = [
    'Astrid', 'Lucas', 'Fatima', 'Ingrid', 'Mateo', 'Sana', 'Owen', 'Camille',
    'Bjorn', 'Nadia', 'Hiro', 'Giulia',
];

const INTERNATIONAL_OPENERS = [
    'Just got in from {home}. Back home this would move in a day — what do you want for it?',
    "I'm only here for the week, flew in from {home}. Show me what you've got.",
    "Back in {home} we'd already be arguing about this. Let's skip to the number.",
    'My flight from {home} landed two hours ago and this is already what I\'m doing.',
    "I don't know your prices here — I know {home}'s. Convince me it's the same shoe.",
];

/** The tag this city's taste runs hottest for, straight off its affinity table. */
function topAffinityTag(profile: CityProfile): ShoeTag {
    let best: ShoeTag = 'casual';
    let bestVal = -Infinity;
    for (const [tag, val] of Object.entries(profile.affinity)) {
        if ((val as number) > bestVal) {
            bestVal = val as number;
            best = tag as ShoeTag;
        }
    }
    return best;
}

/**
 * How hot `cityId` runs for `tag`, averaged over every model that actually
 * carries it — one stable number per (tag, city) rather than one noisy roll
 * off a single random model, so the same home city reads the same way from
 * one international buyer to the next.
 */
function averageRelativeValue(tag: ShoeTag, cityId: string): number {
    const pool = SNEAKERS.filter(s => tagsFor(s).includes(tag));
    const list = pool.length ? pool : SNEAKERS;
    return list.reduce((sum, s) => sum + relativeValue(s, cityId), 0) / list.length;
}

function buildInternationalBuyer(spot: SellingSpot, priceMult: number): StreetBuyer {
    const others = CITIES.map(c => c.id).filter(id => id !== spot.cityId);
    const homeCityId = pick(others);
    const homeName = CITIES.find(c => c.id === homeCityId)?.name ?? homeCityId;
    const topTag = topAffinityTag(profileFor(homeCityId));
    const relMult = averageRelativeValue(topTag, homeCityId);

    const openFrac = INTL_OPEN_FRAC[0] + Math.random() * (INTL_OPEN_FRAC[1] - INTL_OPEN_FRAC[0]);
    const ceilFrac = INTL_CEIL_FRAC[0] + Math.random() * (INTL_CEIL_FRAC[1] - INTL_CEIL_FRAC[0]);

    const offerPct = clamp(relMult * openFrac * priceMult, 0.5, 2.2);
    const ceilingPct = clamp(relMult * ceilFrac * priceMult, offerPct + 0.08, 2.8);

    return {
        id: uid(),
        kind: 'international',
        name: pick(INTL_NAMES),
        opener: pick(INTERNATIONAL_OPENERS).replace('{home}', homeName),
        homeCityId,
        wantsTag: topTag,
        offerPct,
        ceilingPct,
        eye: 0.1 + Math.random() * 0.2,
        danger: 0.04 + Math.random() * 0.09,
        patience: 40 + Math.random() * 45,
    };
}

/* ------------------------------------------------------------------ *
 * Celebrity
 * ------------------------------------------------------------------ */

interface CelebrityStreetProfile {
    /** Matches `systems/npc/schedule.ts`'s `SCHEDULABLE_NPC_IDS` — see module doc. */
    npcId: string;
    name: string;
    openers: string[];
    wantsRarities: Sneaker['rarity'][];
    wantsModels?: string[];
    eye: number;
    danger: number;
    openMultiplier: number;
    ceilingMultiplier: number;
}

/**
 * The four celebrities who plausibly turn up on a street corner rather than
 * only ever indoors. Numbers are hand-tuned for this channel (not read off
 * `data/collectors.ts` at runtime — see the module doc on why) but land in
 * the same neighbourhood as that file's `eye`/`danger` for the same people,
 * so a character does not feel different depending on which channel you met
 * them through.
 */
const CELEBRITY_STREET_PROFILES: CelebrityStreetProfile[] = [
    {
        npcId: 'donald-drip',
        name: 'Donald Drip',
        openers: [
            'This better be tremendous. I only deal in tremendous.',
            'Nobody has an eye for this like I do. Nobody.',
            "I'm buying this right here, on this sidewalk. Best sidewalk, honestly.",
        ],
        wantsRarities: ['Legendary'],
        wantsModels: ['donald-drip-gold-standards'],
        eye: 0.35,
        danger: 0.03,
        openMultiplier: 0.9,
        ceilingMultiplier: 2.1,
    },
    {
        npcId: 'the-game',
        name: 'The Game',
        openers: [
            'Yo. Let me see it. Right here, right now.',
            "Respect the grind that got you on this block. Now let's talk numbers.",
            'This ain\'t a store. This is better. Show me.',
        ],
        wantsRarities: ['Rare', 'Legendary'],
        eye: 0.45,
        danger: 0.12,
        openMultiplier: 0.75,
        ceilingMultiplier: 1.8,
    },
    {
        npcId: 'bro-jogan',
        name: 'Bro Jogan',
        openers: [
            'Dude. Dude. Is that real? We have to talk about this on air.',
            'This is happening on a sidewalk and it feels extremely important.',
            'I need this for the podcast. Also just for me, honestly.',
        ],
        wantsRarities: ['Legendary', 'Rare'],
        wantsModels: ['bro-jogan-af1-alpha-whites', 'bro-jogan-tesla-cyber-forces'],
        eye: 0.3,
        danger: 0.05,
        openMultiplier: 0.8,
        ceilingMultiplier: 1.9,
    },
    {
        npcId: 'yasser-abbasfat',
        name: 'Yasser Abbasfat',
        openers: [
            'THIS IS A DEAL! IT IS PART OF THE STRUGGLE!',
            'I WILL PAY FAIRLY! IT IS A GIFT FROM ME TO YOU!',
            'HAND IT OVER — I MEAN, I WILL BUY IT! CALMLY!',
        ],
        wantsRarities: ['Common', 'Uncommon', 'Rare', 'Legendary'],
        eye: 0.2,
        danger: 0.3,
        openMultiplier: 0.65,
        ceilingMultiplier: 1.65,
    },
];

/** Which of the four could plausibly be standing in this city, today. */
function eligibleCelebrities(spot: SellingSpot, day: number, player: Player): string[] {
    return CELEBRITY_STREET_PROFILES
        .map(p => p.npcId)
        .filter(npcId => !player.connections[npcId]?.burnedYou && isNpcInCity(npcId, spot.cityId, day));
}

function buildCelebrityBuyer(npcId: string, player: Player, priceMult: number): StreetBuyer {
    const profile = CELEBRITY_STREET_PROFILES.find(p => p.npcId === npcId);
    // Defensive fallback only — eligibleCelebrities() can only hand back an id
    // that came from this same table, so this never actually fires.
    if (!profile) return buildLocalBuyer(priceMult);

    // Standing swings how generous they feel by up to +/-25%, same shape as
    // `relationshipFactor` in systems/collectors.ts, without importing it —
    // a raw standing read is all this needs.
    const rel = clamp((player.connections[npcId]?.standing ?? 0) / 100, -1, 1);
    const relBoost = 1 + rel * CELEB_STANDING_SWING;

    const wantsSpecific = profile.wantsModels?.length && Math.random() < 0.5
        ? pick(profile.wantsModels)
        : undefined;

    const offerPct = clamp(profile.openMultiplier * relBoost * priceMult, 0.5, 2.6);
    const ceilingPct = clamp(profile.ceilingMultiplier * relBoost * priceMult, offerPct + 0.15, 3.2);

    return {
        id: uid(),
        kind: 'celebrity',
        name: profile.name,
        opener: pick(profile.openers),
        npcId: profile.npcId,
        wantsSneakerId: wantsSpecific,
        wantsRarity: wantsSpecific ? undefined : pick(profile.wantsRarities),
        offerPct,
        ceilingPct,
        eye: profile.eye,
        danger: profile.danger,
        patience: 45 + Math.random() * 40,
    };
}

/* ------------------------------------------------------------------ *
 * Kind selection and the public entry point
 * ------------------------------------------------------------------ */

function rollKind(
    spot: SellingSpot,
    day: number,
    player: Player,
    hype: HypeEvent | null,
): { kind: BuyerKind; celebNpcId?: string } {
    const celebBoost = hype?.celebrityChance ?? 0;
    const celebWeight = spot.buyerMix.celebrity + celebBoost;
    const total = spot.buyerMix.local + spot.buyerMix.international + celebWeight;

    if (Math.random() * total < celebWeight) {
        const eligible = eligibleCelebrities(spot, day, player);
        if (eligible.length > 0) return { kind: 'celebrity', celebNpcId: pick(eligible) };
        // Nobody famous is actually in town today — falls through to the
        // ordinary crowd below instead of forcing a celebrity that can't exist.
    }

    const localShare = spot.buyerMix.local / (spot.buyerMix.local + spot.buyerMix.international);
    return { kind: Math.random() < localShare ? 'local' : 'international' };
}

/**
 * Odds somebody actually stops this time you check, rather than the corner
 * staying empty a little longer. This is `footfall`'s one piece of real
 * mechanics: a packed subway exit (5) produces a buyer almost every time you
 * look up, a quiet flea-market table (2) genuinely makes you wait for it —
 * the "busy-but-watched vs quiet-but-rich" trade-off has to cost real time,
 * not just be a line of flavour text.
 */
export function arrivalChance(spot: SellingSpot, hype: HypeEvent | null = null): number {
    const base = 0.35 + spot.footfall * 0.11;
    const hypeFactor = hype?.footfallMultiplier ?? 1;
    return clamp(base * hypeFactor, 0.1, 0.97);
}

/**
 * One person, generated for this exact moment at this spot. Never returns
 * null — a celebrity roll that finds nobody plausible in town just falls
 * back to the ordinary crowd (see `rollKind`).
 */
export function generateBuyer(
    spot: SellingSpot,
    day: number,
    player: Player,
    hype: HypeEvent | null = null,
): StreetBuyer {
    const { kind, celebNpcId } = rollKind(spot, day, player, hype);
    const priceMult = hype?.priceMultiplier ?? 1;

    if (kind === 'celebrity' && celebNpcId) return buildCelebrityBuyer(celebNpcId, player, priceMult);
    if (kind === 'international') return buildInternationalBuyer(spot, priceMult);
    return buildLocalBuyer(priceMult);
}
