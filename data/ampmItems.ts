import type { AmpmItem, AmpmAisle } from '../types';
import { storageMock } from './storage.mock';

/**
 * The AM/PM shop listing.
 * =========================================================================
 * This is the *shelf*: what is for sale, what it costs, and which cities carry
 * it. The item itself — stats, effects, digestive consequences — lives in
 * `data/storage.mock.ts`, and `BUY_STORAGE_ITEM` looks it up there by id.
 * Every entry below therefore has a same-id twin in the master catalogue, and
 * `verifyCatalogueSync()` at the bottom of this file exists to prove it.
 *
 * On the two taxonomies
 * --------------------
 * `category` is the store's three shopping tabs and is fixed by the `AmpmItem`
 * type in `types.ts`. `aisle` is the real one — nine shelves, matching a real
 * convenience store — and it is what the effects, synergies and shelf specials
 * actually reason about. Both are carried on every row:
 *
 *   food · drinks · bakery · snacks · frozen   → 'Food & Drinks'
 *   household · personal-care                  → 'Tools & Gear'
 *   specialty · questionable                   → 'Local Specialties'
 *
 * `AMPM_AISLE_OF` gives the same mapping as a plain id → aisle lookup for
 * callers that only have an id in hand.
 *
 * Pricing is deliberately flat and cheap. The joke does not work if a tub of
 * cottage cheese is a financial decision. The three exceptions — the olive, the
 * lighter and the last tub of ice cream — are priced as punchlines.
 */

/**
 * A shop row with its shelf attached. Assignable anywhere an `AmpmItem` is
 * expected, so nothing in `types.ts` needed touching to add the field.
 */
export interface AmpmShopItem extends AmpmItem {
    aisle: AmpmAisle;
}

export const AMPM_ITEMS: AmpmShopItem[] = [
    // =====================================================================
    // FOOD — the spine of the store. Cheap, useful, and occasionally the
    // reason your next three days go badly.
    // =====================================================================
    {
        id: 'itm-hummus',
        name: 'Hummus Flotz',
        description: 'Questionably sourced hummus with a side of stale crackers.',
        price: 7,
        effect: '+16 Energy, chance of gas',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-pita',
        name: 'Pita (Bag of Six)',
        description: 'Bread on its own is not a meal. It is a request.',
        price: 4,
        effect: '+5 Energy. Completes things.',
        category: 'Food & Drinks',
        aisle: 'bakery',
    },
    {
        id: 'itm-pita-zaatar',
        name: 'Pita with Za\'atar',
        description: 'The taste of the Mediterranean. A local favorite.',
        price: 5,
        effect: '+12 Health',
        category: 'Local Specialties',
        aisle: 'food',
        cities: ['tel-aviv'],
    },
    {
        id: 'itm-burekas',
        name: 'Burekas',
        description: 'Flaky pastry with a mysterious cheese-like filling.',
        price: 6,
        effect: '+15 Health, gas risk',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-sabich',
        name: 'Sabich (Overfilled)',
        description: 'Egg, aubergine, pickle, amba, and no structural margin whatsoever.',
        price: 14,
        effect: '+26 Energy, chance of food coma',
        category: 'Local Specialties',
        aisle: 'food',
        cities: ['tel-aviv'],
    },
    {
        id: 'itm-tuna-can',
        name: 'Tuna Can (Pull Tab)',
        description: 'Excellent protein. Your breath becomes a public matter.',
        price: 5,
        effect: '+14 Health. Smells for hours.',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-boiled-egg',
        name: 'Hard-Boiled Egg',
        description: 'Peeled, salted, and eaten in front of people who did not consent.',
        price: 2,
        effect: '+9 Energy, NPCs react',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-pickles',
        name: 'Pickles (Jar, Brine Included)',
        description: 'The brine is the product. The pickles are packaging.',
        price: 6,
        effect: '+Hydration, involuntary face',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-yogurt',
        name: 'Yogurt (Small Tub)',
        description: 'The date on the lid is a suggestion.',
        price: 3,
        effect: '+8 Health, mild gas',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-cottage-cheese',
        name: 'Cottage Cheese (250g)',
        description: 'Objectively good for you. Cannot be eaten in front of anybody.',
        price: 4,
        effect: '+12 Health, −Cred if witnessed',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-peanut-butter',
        name: 'Peanut Butter (Jar)',
        description: 'Dense, honest, and structurally committed to your fingers.',
        price: 11,
        effect: '+22 Energy, STICKY HANDS',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-banana',
        name: 'Banana',
        description: 'Bought firm. Will not be firm when you get there.',
        price: 2,
        effect: '+6 Health',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-dates',
        name: 'Medjool Dates',
        description: 'Nature\'s caramel, priced like a mineral.',
        price: 15,
        effect: '+14 Energy, unsolicited health advice',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-pistachios',
        name: 'Pistachios (Salted)',
        description: 'Priced per kilo of shell.',
        price: 12,
        effect: '+12 Energy, costs you 20 seconds',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-canned-beans',
        name: 'Beans in Tomato Sauce',
        description: 'Cheapest calories in the store. The store is not responsible.',
        price: 3,
        effect: '+20 Energy, gas +3',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-ramen-cup',
        name: 'Instant Ramen',
        description: 'A cheap way to restore some health.',
        price: 3,
        effect: '+10 Health, −Sleep',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-spicy-noodles',
        name: 'Aggressively Spicy Noodles',
        description: 'Two chilli symbols on the packet. Both of them mean it.',
        price: 5,
        effect: '+16 Energy, +Focus, real risk',
        category: 'Food & Drinks',
        aisle: 'food',
    },
    {
        id: 'itm-onigiri',
        name: 'Convenience Store Onigiri',
        description: 'A rice ball with a surprise filling. Quick and efficient.',
        price: 4,
        effect: '+10 Health',
        category: 'Local Specialties',
        aisle: 'food',
        cities: ['tokyo'],
    },
    {
        id: 'itm-deep-dish-slice',
        name: 'Single Deep-Dish Slice',
        description: 'Weighs as much as a brick. Restores a lot of health.',
        price: 8,
        effect: '+30 Health',
        category: 'Local Specialties',
        aisle: 'food',
        cities: ['chicago'],
    },

    // =====================================================================
    // DRINKS — the fridge wall. Caffeine is the stat engine here and it
    // stacks badly on purpose.
    // =====================================================================
    {
        id: 'itm-coffee',
        name: 'Filter Coffee (Large)',
        description: 'Burnt at 04:00, served at 14:00, drunk without comment.',
        price: 6,
        effect: '+22 Energy, +10 Focus, −Sleep',
        category: 'Food & Drinks',
        aisle: 'drinks',
    },
    {
        id: 'itm-energy-drink',
        name: 'Energy Drink',
        description: 'Boost your energy for a long day of hustling.',
        price: 5,
        effect: '+20 Energy, result varies',
        category: 'Food & Drinks',
        aisle: 'drinks',
    },
    {
        id: 'itm-chocmilk-bag',
        name: 'Chocolate Milk in a Bag',
        description: 'A delicacy. 💩 1/5 chance of diarrhea.',
        price: 4,
        effect: 'Restore stamina, risk debuff',
        category: 'Food & Drinks',
        aisle: 'drinks',
    },
    {
        id: 'itm-chocolate-milk',
        name: 'Chocolate Milk (Carton)',
        description: 'The respectable format. Marginally.',
        price: 4,
        effect: '+10 Energy, rare BAD CARTON',
        category: 'Food & Drinks',
        aisle: 'drinks',
    },
    {
        id: 'itm-sparkling-water',
        name: 'Sparkling Water',
        description: 'Water that has been through something.',
        price: 3,
        effect: 'Hydration. Rarely, something better.',
        category: 'Food & Drinks',
        aisle: 'drinks',
    },
    {
        id: 'itm-protein-drink',
        name: 'Protein Drink (Chalk Flavour)',
        description: 'Forty-four grams of protein and one flavour, labelled "vanilla".',
        price: 12,
        effect: '+14 Energy, gas +2',
        category: 'Food & Drinks',
        aisle: 'drinks',
    },
    {
        id: 'itm-slushie',
        name: 'Blue Slushie',
        description: 'From the machine. The one that talks.',
        price: 6,
        effect: 'Drinkable. Also throwable — slows targets.',
        category: 'Food & Drinks',
        aisle: 'drinks',
    },
    {
        id: 'itm-kombucha',
        name: 'Artisanal Kombucha',
        description: 'Tastes like wellness and regret.',
        price: 9,
        effect: '+8 Energy, gut warfare',
        category: 'Food & Drinks',
        aisle: 'drinks',
    },
    {
        id: 'itm-kale-smoothie',
        name: 'Kale Smoothie',
        description: 'For the health-conscious hustler. Tastes like grass.',
        price: 9,
        effect: '+15 Energy, -5 Morale',
        category: 'Local Specialties',
        aisle: 'drinks',
        cities: ['los-angeles'],
    },
    {
        id: 'itm-grapefruit-soda',
        name: 'Bitter Grapefruit Soda',
        description: 'The drink that decides whether you are a serious person.',
        price: 4,
        effect: '+6 Energy, +4 Focus',
        category: 'Local Specialties',
        aisle: 'drinks',
        cities: ['paris'],
    },
    {
        id: 'itm-matcha-can',
        name: 'Canned Matcha Latte',
        description: 'From the heated shelf. Warm can, cold morning, no complaints.',
        price: 4,
        effect: '+12 Energy, +8 Focus',
        category: 'Local Specialties',
        aisle: 'drinks',
        cities: ['tokyo'],
    },

    // =====================================================================
    // BAKERY — the front counter. Cheap energy, bought warm. So does the
    // baguette, a melee weapon in this game longer than it has been bread.
    // =====================================================================
    {
        id: 'itm-baguette',
        name: 'Baguette',
        description: 'Can be used as a food item or a surprisingly effective blunt weapon.',
        price: 3,
        effect: '+8 Health / +18 Melee Power',
        category: 'Local Specialties',
        aisle: 'bakery',
        cities: ['paris'],
    },
    {
        id: 'itm-croissant',
        name: 'Croissant',
        description: 'Ninety per cent butter, ten per cent air.',
        price: 4,
        effect: '+12 Energy',
        category: 'Local Specialties',
        aisle: 'bakery',
        cities: ['paris'],
    },
    {
        id: 'itm-donut',
        name: 'Glazed Donut',
        description: 'One is breakfast. Six is a personality.',
        price: 3,
        effect: '+14 Energy, −3 Focus',
        category: 'Food & Drinks',
        aisle: 'bakery',
    },
    {
        id: 'itm-rugelach',
        name: 'Chocolate Rugelach (Tray)',
        description: 'Sold by weight. Consumed by volume.',
        price: 9,
        effect: '+18 Energy',
        category: 'Local Specialties',
        aisle: 'bakery',
        cities: ['tel-aviv'],
    },
    {
        id: 'itm-bagel',
        name: 'Everything Bagel',
        description: 'Structurally a brick. Emotionally a hug.',
        price: 4,
        effect: '+14 Health, seeds in your teeth',
        category: 'Local Specialties',
        aisle: 'bakery',
        cities: ['new-york'],
    },
    {
        id: 'itm-melon-pan',
        name: 'Melon Pan',
        description: 'Contains no melon. Has never contained melon.',
        price: 3,
        effect: '+13 Energy',
        category: 'Local Specialties',
        aisle: 'bakery',
        cities: ['tokyo'],
    },
    {
        id: 'itm-day-old-muffin',
        name: 'Day-Old Muffin',
        description: 'Forty per cent off for a reason the label declines to state.',
        price: 2,
        effect: '+10 Energy',
        category: 'Food & Drinks',
        aisle: 'bakery',
    },

    // =====================================================================
    // SNACKS — nothing here is nutrition and everything here is a status
    // effect. Seeds make a mess, gum is currency, sugar is the only chaos.
    // =====================================================================
    {
        id: 'itm-sunflower-seeds',
        name: 'Sunflower Seeds (Salted)',
        description: 'A two-hour activity disguised as a snack.',
        price: 5,
        effect: '+8 Focus, SHELLS EVERYWHERE',
        category: 'Food & Drinks',
        aisle: 'snacks',
    },
    {
        id: 'itm-gum',
        name: 'Mint Gum (Pack)',
        description: 'The cheapest thing in the store that changes how people treat you.',
        price: 2,
        effect: '+6 Focus, giftable',
        category: 'Food & Drinks',
        aisle: 'snacks',
    },
    {
        id: 'itm-gummy-candy',
        name: 'Gummy Candy (Bulk Bag)',
        description: 'No drugs involved. Just sugar, and a great deal of it.',
        price: 7,
        effect: 'SUGAR RUSH',
        category: 'Food & Drinks',
        aisle: 'snacks',
    },
    {
        id: 'itm-chips',
        name: 'Paprika Chips (Family Bag)',
        description: 'Eighty per cent air, and the air is also seasoned.',
        price: 6,
        effect: '+8 Energy, −4 Health',
        category: 'Food & Drinks',
        aisle: 'snacks',
    },
    {
        id: 'itm-chocolate-bar',
        name: 'Chocolate Bar',
        description: 'Never once been a disappointment. Occasionally been a liquid.',
        price: 3,
        effect: '+12 Energy',
        category: 'Food & Drinks',
        aisle: 'snacks',
    },
    {
        id: 'itm-bamba',
        name: 'Bamba (Peanut Puffs)',
        description: 'Weighs nothing. Disappears instantly.',
        price: 4,
        effect: '+5 Energy',
        category: 'Local Specialties',
        aisle: 'snacks',
        cities: ['tel-aviv'],
    },
    {
        id: 'itm-bissli',
        name: 'Bissli (Grill Flavour)',
        description: 'Fried wheat, grill flavour, no grill involved at any stage.',
        price: 4,
        effect: '+2 Focus, dental hazard',
        category: 'Local Specialties',
        aisle: 'snacks',
        cities: ['tel-aviv'],
    },
    {
        id: 'itm-pretzels',
        name: 'Salted Pretzels',
        description: 'Dry, salty, and entirely reasonable. The beige option.',
        price: 3,
        effect: '+4 Energy',
        category: 'Food & Drinks',
        aisle: 'snacks',
    },
    {
        id: 'itm-seaweed-snack',
        name: 'Seaweed Snack (Thin Sheets)',
        description: 'Four calories and a strong opinion about the sea.',
        price: 3,
        effect: 'Almost nothing',
        category: 'Local Specialties',
        aisle: 'snacks',
        cities: ['tokyo'],
    },
    {
        id: 'itm-trail-mix',
        name: 'Trail Mix (Mostly Raisins)',
        description: 'Advertised as nuts. Delivered as raisins.',
        price: 8,
        effect: '+12 Energy',
        category: 'Food & Drinks',
        aisle: 'snacks',
    },
    {
        id: 'itm-popcorn',
        name: 'Pre-Popped Popcorn',
        description: 'A large bag containing the concept of food.',
        price: 4,
        effect: 'Volume without substance',
        category: 'Food & Drinks',
        aisle: 'snacks',
    },
    {
        id: 'itm-wafers',
        name: 'Chocolate Wafers',
        description: 'Sixty per cent structure, forty per cent brown.',
        price: 2,
        effect: '+10 Energy',
        category: 'Food & Drinks',
        aisle: 'snacks',
    },

    // =====================================================================
    // FROZEN — the humming cabinet with the broken lid. The ice cream is a
    // rarity ladder; the top of it has consequences.
    // =====================================================================
    {
        id: 'itm-ice-cream-chocolate',
        name: 'Chocolate Ice Cream (Tub)',
        description: 'The one that is always there. Loyal. Unremarkable.',
        price: 12,
        effect: '+14 Energy',
        category: 'Food & Drinks',
        aisle: 'frozen',
    },
    {
        id: 'itm-ice-cream-pistachio',
        name: 'Pistachio Ice Cream (Tub)',
        description: 'Rarely in stock. Discussed in the neighbourhood when it is.',
        price: 24,
        effect: '+16 Energy',
        category: 'Food & Drinks',
        aisle: 'frozen',
    },
    {
        id: 'itm-ice-cream-last-tub',
        name: 'THE LAST TUB',
        description: 'There is one left. There is always exactly one left, which nobody at the store will explain.',
        price: 85,
        effect: 'Causes a LOCAL ICE CREAM SHORTAGE',
        category: 'Food & Drinks',
        aisle: 'frozen',
    },
    {
        id: 'itm-frozen-pizza',
        name: 'Frozen Pizza (Single)',
        description: 'Requires an oven. You are buying this on the street.',
        price: 11,
        effect: '+18 Health, eventually',
        category: 'Local Specialties',
        aisle: 'frozen',
        cities: ['chicago'],
    },
    {
        id: 'itm-ice-pop',
        name: 'Blue Ice Pop',
        description: 'Sugar water in a plastic sleeve. Two flavours: blue and red.',
        price: 2,
        effect: '+5 Energy, blue tongue',
        category: 'Food & Drinks',
        aisle: 'frozen',
    },
    {
        id: 'itm-frozen-edamame',
        name: 'Frozen Edamame',
        description: 'The only responsible decision available in this cabinet.',
        price: 7,
        effect: '+10 Health, gas +2',
        category: 'Food & Drinks',
        aisle: 'frozen',
    },
    {
        id: 'itm-bag-of-ice',
        name: 'Bag of Ice',
        description: 'Two kilos of water you are paying a premium to carry.',
        price: 4,
        effect: 'None. It is becoming a puddle.',
        category: 'Food & Drinks',
        aisle: 'frozen',
    },

    // =====================================================================
    // HOUSEHOLD — aisle six. Nothing here is food and everything here is a
    // mechanic: repairs, resistances, composure, and one dead asset waiting
    // for the right headline.
    // =====================================================================
    {
        id: 'itm-aluminium-foil',
        name: 'Aluminium Foil (Roll)',
        description: 'Sold for wrapping food. Bought for other reasons.',
        price: 6,
        effect: 'Make a hat → CONSPIRACY RESISTANCE',
        category: 'Tools & Gear',
        aisle: 'household',
    },
    {
        id: 'itm-batteries',
        name: 'AA Batteries (4-Pack)',
        description: 'Four of them. You need two. The other two will be lost.',
        price: 9,
        effect: 'Usually nothing. Occasionally everything.',
        category: 'Tools & Gear',
        aisle: 'household',
    },
    {
        id: 'itm-duct-tape',
        name: 'Duct Tape',
        description: '+1 Fix. Applies to shoes, bags, weapons and arguments.',
        price: 12,
        effect: 'Repairs damaged items',
        category: 'Tools & Gear',
        aisle: 'household',
    },
    {
        id: 'itm-cleaning-spray',
        name: 'All-Purpose Cleaning Spray',
        description: 'Lemon-scented, industrial strength, absolutely not for skin.',
        price: 8,
        effect: 'Temporary CLEAN. +5 Focus, −2 Health',
        category: 'Tools & Gear',
        aisle: 'household',
    },
    {
        id: 'itm-toilet-paper',
        name: 'Toilet Paper (6 Rolls)',
        description: 'Takes up half your bag. Worth nothing until it is worth everything.',
        price: 10,
        effect: 'Useless until the emergency. Then 20×.',
        category: 'Tools & Gear',
        aisle: 'household',
    },
    {
        id: 'itm-sponge',
        name: 'Two-Tone Sponge',
        description: 'Soft side, green side. Everyone knows which side is the violent one.',
        price: 3,
        effect: '+3 Focus',
        category: 'Tools & Gear',
        aisle: 'household',
    },
    {
        id: 'itm-lightbulb',
        name: 'Lightbulb (Warm White)',
        description: 'A single bulb, bought without knowing the fitting.',
        price: 5,
        effect: 'It is the wrong fitting',
        category: 'Tools & Gear',
        aisle: 'household',
    },
    {
        id: 'itm-trash-bags',
        name: 'Black Trash Bags (Roll)',
        description: 'Ninety litres. Nobody asks what for, which is its own problem.',
        price: 7,
        effect: 'Waterproof, socially costly',
        category: 'Tools & Gear',
        aisle: 'household',
    },
    {
        id: 'itm-superglue',
        name: 'Superglue (Single Use)',
        description: 'Labelled single use because that is genuinely all you get.',
        price: 4,
        effect: 'One repair, two fingers',
        category: 'Tools & Gear',
        aisle: 'household',
    },
    {
        id: 'itm-crowbar',
        name: 'Ironic Crowbar',
        description: 'A "tool" for "leveraging" opportunities. Popular in gritty cityscapes.',
        price: 50,
        effect: 'Melee weapon, 38 damage',
        category: 'Tools & Gear',
        aisle: 'household',
        cities: ['new-york'],
    },

    // =====================================================================
    // PERSONAL CARE — the shelf you visit before a negotiation. Looking like
    // you have your life together is composure, and composure is focus.
    // =====================================================================
    {
        id: 'itm-deodorant',
        name: 'Deodorant (48h, Allegedly)',
        description: 'Forty-eight hour protection, in a city that does not respect the claim.',
        price: 8,
        effect: '+6 Focus. Without it: "Bro…"',
        category: 'Tools & Gear',
        aisle: 'personal-care',
    },
    {
        id: 'itm-toothbrush',
        name: 'Emergency Toothbrush',
        description: 'Sold at the till for people whose day has gone longer than planned.',
        price: 4,
        effect: '+4 Focus',
        category: 'Tools & Gear',
        aisle: 'personal-care',
    },
    {
        id: 'itm-mouthwash',
        name: 'Mouthwash (Travel Bottle)',
        description: 'Twenty seconds of pain, forty minutes of being taken seriously.',
        price: 9,
        effect: 'Large temporary social bonus',
        category: 'Tools & Gear',
        aisle: 'personal-care',
    },
    {
        id: 'itm-sunglasses',
        name: 'Cheap Sunglasses',
        description: 'From the spinning rack by the door. No UV protection mentioned.',
        price: 12,
        effect: 'Cosmetic. Some NPCs react.',
        category: 'Tools & Gear',
        aisle: 'personal-care',
    },
    {
        id: 'itm-hair-gel',
        name: 'Hair Gel (Extreme Hold)',
        description: 'Hold level: architectural.',
        price: 7,
        effect: 'DRIP +5, +4 Focus',
        category: 'Tools & Gear',
        aisle: 'personal-care',
    },
    {
        id: 'itm-wet-wipes',
        name: 'Wet Wipes (Pack)',
        description: 'The correct answer to almost everything in the food aisle.',
        price: 5,
        effect: '+3 Focus',
        category: 'Tools & Gear',
        aisle: 'personal-care',
    },
    {
        id: 'itm-sunscreen',
        name: 'Sunscreen (SPF 50)',
        description: 'Preventing a problem you will never notice you avoided.',
        price: 14,
        effect: '+6 Health, one white ear',
        category: 'Tools & Gear',
        aisle: 'personal-care',
    },
    {
        id: 'itm-bandaids',
        name: 'Plasters (Assorted)',
        description: 'The tax on wearing new shoes all day.',
        price: 4,
        effect: '+6 Health',
        category: 'Tools & Gear',
        aisle: 'personal-care',
    },
    {
        id: 'itm-comb',
        name: 'Plastic Comb',
        description: 'Costs almost nothing and snaps a tooth off immediately.',
        price: 2,
        effect: 'Tidies your hair. Nothing else.',
        category: 'Tools & Gear',
        aisle: 'personal-care',
    },

    // =====================================================================
    // SPECIALTY — the end-cap and the impulse shelf by the till. Several of
    // these are deliberately useless and say so on the card. The weapons live
    // here too, because a shop that sells one flip-flop and a dog launcher is
    // the same kind of shop.
    // =====================================================================
    {
        id: 'itm-single-flip-flop',
        name: 'One Single Flip-Flop',
        description: 'Size 43. Left foot. There is no second one.',
        price: 3,
        effect: 'WHY IS THIS HERE?',
        category: 'Local Specialties',
        aisle: 'specialty',
    },
    {
        id: 'itm-plastic-bag',
        name: 'Plastic Shopping Bag',
        description: 'Costs money now. Holds approximately three small objects.',
        price: 1,
        effect: 'Holds tiny items. Barely.',
        category: 'Local Specialties',
        aisle: 'specialty',
    },
    {
        id: 'itm-cheap-umbrella',
        name: 'Cheap Umbrella',
        description: 'Bought in rain, at a markup, from a man who knew exactly what he was doing.',
        price: 11,
        effect: 'Works once, then inverts',
        category: 'Local Specialties',
        aisle: 'specialty',
    },
    {
        id: 'itm-party-hat',
        name: 'Conical Party Hat',
        description: 'Cardboard, elastic, one size, no occasion.',
        price: 2,
        effect: 'Useless except during a PARTY EVENT',
        category: 'Local Specialties',
        aisle: 'specialty',
    },
    {
        id: 'itm-birthday-candle',
        name: 'Single Birthday Candle',
        description: 'One striped candle. Held in reserve.',
        price: 1,
        effect: 'Useless until somebody\'s birthday',
        category: 'Local Specialties',
        aisle: 'specialty',
    },
    {
        id: 'itm-disposable-camera',
        name: 'Disposable Camera (27 Shots)',
        description: 'No screen, no deleting. Every photo is a commitment.',
        price: 18,
        effect: 'Photo during encounters → collectible. +3 Focus',
        category: 'Local Specialties',
        aisle: 'specialty',
    },
    {
        id: 'itm-scratch-card',
        name: 'Promotional Scratch Card',
        description: 'Free with any purchase. Not a lottery ticket — the prize is printed under the panel at the factory and it is the same on every card.',
        price: 0,
        effect: 'Reveals a fixed prize. No stake, nothing to lose.',
        category: 'Local Specialties',
        aisle: 'specialty',
    },
    {
        id: 'itm-expensive-olive',
        name: 'One Extremely Expensive Olive',
        description: 'One olive. In its own jar. With a certificate.',
        price: 480,
        effect: 'One olive of nutrition. That is the entire offer.',
        category: 'Local Specialties',
        aisle: 'specialty',
    },
    {
        id: 'itm-chanclas',
        name: 'Chanclas (Homing)',
        description: 'Ancient guidance system, zero latency. Sold as a pair.',
        price: 14,
        effect: 'Thrown weapon — homing, returns',
        category: 'Local Specialties',
        aisle: 'specialty',
    },
    {
        id: 'itm-frisbee',
        name: 'Beach Frisbee',
        description: 'Venice Beach classic. Returns to you. Usually.',
        price: 18,
        effect: 'Thrown weapon — pierces, returns',
        category: 'Tools & Gear',
        aisle: 'specialty',
    },
    {
        id: 'itm-longboard',
        name: 'Venice Longboard',
        description: 'For when somebody steals your box and takes off downhill.',
        price: 260,
        effect: 'Lets you actually win a cart chase',
        category: 'Local Specialties',
        aisle: 'specialty',
        cities: ['los-angeles'],
    },
    {
        id: 'itm-dog-launcher',
        name: 'Chicago Dog Launcher',
        description: 'It was out of stock for a long time. Do not ask why.',
        price: 340,
        effect: 'Rapid-fire ranged weapon',
        category: 'Local Specialties',
        aisle: 'specialty',
        cities: ['chicago'],
    },
    {
        id: 'itm-haunted-lighter',
        name: 'Haunted Gold Lighter',
        description: 'Bro, you NEED this glow-in-the-dark lighter. Trust me.',
        price: 220,
        effect: 'Lights the dark. Possibly cursed.',
        category: 'Tools & Gear',
        aisle: 'specialty',
    },
    {
        id: 'itm-burner-phone',
        name: 'Burner Phone',
        description: 'For those calls you don\'t want traced.',
        price: 100,
        effect: 'Get Insider Info (Not Implemented)',
        category: 'Tools & Gear',
        aisle: 'specialty',
    },

    // =====================================================================
    // QUESTIONABLE ITEMS — the shelf by the back door with the handwritten
    // sign. Nothing here is a drug. Everything here is a sealed, legal,
    // deeply unclear consumer product whose effect you learn by using it.
    // =====================================================================
    {
        id: 'itm-soup-seasoning',
        name: 'Instant Soup Seasoning Packet',
        description: 'A foil sachet. The instructions are in a language nobody in the store reads.',
        price: 3,
        effect: 'Unknown until used',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
    {
        id: 'itm-energy-gel',
        name: 'Suspicious Energy Gel',
        description: 'Marketed at cyclists. Sold next to the batteries. No flavour named.',
        price: 9,
        effect: 'Unknown until used',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
    {
        id: 'itm-vitamin-packet',
        name: 'Unlabeled Vitamin Packet',
        description: 'Twelve tablets in a blister pack with no printing on it whatsoever.',
        price: 7,
        effect: 'Unknown until used',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
    {
        id: 'itm-definitely-normal-capsule',
        name: '"Definitely Normal" Capsule',
        description: 'The words DEFINITELY NORMAL are printed on the sleeve in a font chosen by somebody with something to prove.',
        price: 11,
        effect: 'Unknown until used',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
    {
        id: 'itm-expired-candy',
        name: 'Expired Novelty Candy',
        description: 'Best before a date that has been scratched off with a fingernail.',
        price: 2,
        effect: 'Unknown until used',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
    {
        id: 'itm-fake-cologne',
        name: 'Fake Luxury Cologne',
        description: 'The name is one letter off a house you would recognise.',
        price: 26,
        effect: 'Unknown until used',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
    {
        id: 'itm-mystery-electronics',
        name: 'Mystery Electronics Part',
        description: 'A small board, three wires, and a connector that fits nothing sold in this hemisphere.',
        price: 16,
        effect: 'Unknown. Possibly nothing.',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
    {
        id: 'itm-weird-imported-snack',
        name: 'Weird Imported Snack',
        description: 'The packet shows a cartoon animal holding a version of itself.',
        price: 6,
        effect: 'Unknown until used',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
    {
        id: 'itm-unidentified-sauce',
        name: 'Unidentified Sauce',
        description: 'A plain bottle with a handwritten label reading only: SAUCE.',
        price: 8,
        effect: 'Unknown until used',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
    {
        id: 'itm-gov-approved-sticker',
        name: '"Government Approved" Sticker',
        description: 'It does not say which government, or of what.',
        price: 5,
        effect: 'Approves nothing. Reads as approval.',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
    {
        id: 'itm-tiny-figurine',
        name: 'Tiny Plastic Figurine',
        description: 'Two centimetres of unpainted plastic depicting a character from nothing.',
        price: 3,
        effect: 'Nothing. You will keep it anyway.',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
    {
        id: 'itm-unmarked-dairy-drink',
        name: 'Unmarked Dairy Drink',
        description: 'White. Opaque. Sold at room temperature next to the cleaning products.',
        price: 4,
        effect: 'Unknown until used. Genuinely risky.',
        category: 'Local Specialties',
        aisle: 'questionable',
    },
];

// --- lookups -------------------------------------------------------------

/**
 * id → shelf, for callers holding only an id (the storage screen, the
 * synergy table, the shelf-specials picker). Built from the shop rows first
 * and then topped up from the master catalogue, so items that are not for
 * sale — the cursed totem — still resolve to an aisle.
 */
export const AMPM_AISLE_OF: Record<string, AmpmAisle> = (() => {
    const map: Record<string, AmpmAisle> = {};
    for (const item of storageMock) {
        if (item.aisle) map[item.id] = item.aisle;
    }
    for (const row of AMPM_ITEMS) {
        map[row.id] = row.aisle;
    }
    return map;
})();

/** Display order for the nine shelves, plus what to call them out loud. */
export const AMPM_AISLE_ORDER: AmpmAisle[] = [
    'food', 'drinks', 'bakery', 'snacks', 'frozen',
    'household', 'personal-care', 'specialty', 'questionable',
];

export const AMPM_AISLE_LABEL: Record<AmpmAisle, string> = {
    food: 'Food',
    drinks: 'Drinks',
    bakery: 'Bakery',
    snacks: 'Snacks',
    frozen: 'Frozen',
    household: 'Household',
    'personal-care': 'Personal Care',
    specialty: 'Specialty',
    questionable: 'Questionable Items',
};

const SHOP_BY_ID = new Map(AMPM_ITEMS.map(i => [i.id, i]));

export const getAmpmItem = (id: string): AmpmShopItem | undefined => SHOP_BY_ID.get(id);

/** What this city actually carries. Undefined `cities` means everywhere. */
export const ampmItemsForCity = (cityId: string): AmpmShopItem[] =>
    AMPM_ITEMS.filter(i => !i.cities || i.cities.includes(cityId));

/** This city's stock, grouped by shelf and in shelf order. */
export const ampmItemsByAisle = (cityId: string): Array<{ aisle: AmpmAisle; items: AmpmShopItem[] }> =>
    AMPM_AISLE_ORDER
        .map(aisle => ({ aisle, items: ampmItemsForCity(cityId).filter(i => i.aisle === aisle) }))
        .filter(group => group.items.length > 0);

/**
 * Returns the ids sold here that have no master-data twin. Must always be
 * empty: a purchase of an id missing from `storage.mock.ts` fails silently
 * with "Item not available." Exported rather than asserted at import time so
 * a content mistake surfaces in a test, not as a white screen.
 */
export function verifyCatalogueSync(): string[] {
    const masters = new Set(storageMock.map(i => i.id));
    return AMPM_ITEMS.filter(i => !masters.has(i.id)).map(i => i.id);
}
