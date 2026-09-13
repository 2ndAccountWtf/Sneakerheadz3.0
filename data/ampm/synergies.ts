import type { ScenarioOutcome } from '../../types/interactions';

/**
 * AM/PM item synergies.
 * =========================================================================
 * Two items are a shopping list. Two *specific* items are a plan. This table
 * is what the store does when it notices you have bought a combination — the
 * hummus and the pita stop being ingredients and become a meal; the baguette
 * and the duct tape stop being groceries entirely.
 *
 * Design rules, learned the hard way:
 *
 *  - A synergy is a **reading of what you are holding**, not a recipe you
 *    execute. Nothing is consumed here. The player gets told what they have
 *    accidentally become.
 *  - Requirements are ids from `data/storage.mock.ts`. If an id here does not
 *    exist there, the synergy can never fire and nobody will ever find out,
 *    which is the worst possible failure mode. `verifySynergyIds()` at the
 *    bottom exists so a test can catch it.
 *  - `outcomes` may only use the `ScenarioOutcomeType` values that
 *    `systems/outcomes/outcomeEngine.ts` actually switches on. Anything else
 *    is silently dropped into the default branch and becomes a bare log line.
 *    The types used below are: notification, stat_change, streetCred,
 *    statusEffect, heat, flag, freebie, priceMarkup and bibiApproval.
 *  - Most payoffs are small. A synergy that hands you $400 is a loot table; a
 *    synergy that tells you the bottom fell out of your sabich is a joke, and
 *    jokes are what the shop is for.
 */
export interface Synergy {
    id: string;
    /** Shown in caps, because the store shouts. */
    name: string;
    /** Item ids that must ALL be present in storage. */
    requires: string[];
    /** What the player is told the moment it fires. */
    blurb: string;
    /** Applied through `applyOutcomes`. Handled types only. */
    outcomes: ScenarioOutcome[];
    /**
     * True when the listed requirements are a floor rather than the whole
     * combination — the foil works with literally anything else, so it needs
     * one other item in the bag and does not care which.
     */
    plusAnything?: boolean;
    /**
     * A situation tag that must also be active: 'bro-jogan-encounter',
     * 'party-event', 'toilet-paper-emergency'. Context-gated synergies never
     * fire from the bag alone, which is the point of them.
     */
    context?: string;
}

export const SYNERGIES: Synergy[] = [
    // --- the food ones ---------------------------------------------------
    {
        id: 'syn-authentic-meal',
        name: 'AUTHENTIC MEAL',
        requires: ['itm-hummus', 'itm-pita'],
        blurb: 'Hummus and pita. You have stopped eating snacks and started eating lunch. Your posture changes.',
        outcomes: [
            { type: 'notification', description: 'You eat it properly: torn pita, scooped, no cutlery, no conversation.' },
            { type: 'stat_change', description: 'A real meal, for once.', stat: 'energy', value: 22 },
            { type: 'stat_change', description: 'Actual food.', stat: 'health', value: 10 },
            { type: 'statusEffect', description: 'Well fed and slightly smug.', effect: 'lucky', duration: '24h', label: 'Properly Fed' },
        ],
    },
    {
        id: 'syn-gas-critical',
        name: 'GAS CRITICAL',
        requires: ['itm-hummus', 'itm-canned-beans'],
        blurb: 'Chickpeas and beans in the same hour. Two legumes. No supervision. The meter you cannot see has an opinion.',
        outcomes: [
            { type: 'notification', description: 'GAS CRITICAL. You should not be indoors. You are indoors.' },
            { type: 'stat_change', description: 'Calories, at a cost.', stat: 'energy', value: 18 },
            { type: 'streetCred', description: 'The room clears and everyone knows why.', change: -2 },
            { type: 'statusEffect', description: 'Nine hours of low-frequency consequence.', effect: 'cursed', duration: '24h', label: 'Legume Overload' },
        ],
    },
    {
        id: 'syn-stomach-betrayal',
        name: 'STOMACH BETRAYAL',
        requires: ['itm-chocolate-milk', 'itm-unmarked-dairy-drink'],
        blurb: 'Two dairy products, one of which has no label and was stored at room temperature next to the bleach.',
        outcomes: [
            { type: 'notification', description: 'STOMACH BETRAYAL. Something down there has switched sides.' },
            { type: 'stat_change', description: 'Your body files an objection.', stat: 'health', value: -14 },
            { type: 'flag', description: 'You will be thinking about a bathroom for a while.', key: 'digestive-alert', value: true },
            { type: 'statusEffect', description: 'Do not travel. Do not negotiate. Do not speak.', effect: 'cursed', duration: '24h', label: 'Stomach Betrayal' },
        ],
    },
    {
        id: 'syn-absolute-regret',
        name: 'ABSOLUTE REGRET',
        requires: ['itm-spicy-noodles', 'itm-unmarked-dairy-drink'],
        blurb: 'You ate the noodles. Then you reached for the unmarked white drink to put the fire out. Both decisions were yours.',
        outcomes: [
            { type: 'notification', description: 'ABSOLUTE REGRET. The milk did not help. The milk has made itself part of this.' },
            { type: 'stat_change', description: 'Chemistry, happening internally.', stat: 'health', value: -18 },
            { type: 'stat_change', description: 'Adrenaline counts as energy, technically.', stat: 'energy', value: 8 },
            { type: 'statusEffect', description: 'A long evening with a known ending.', effect: 'cursed', duration: '48h', label: 'Absolute Regret' },
        ],
    },
    {
        id: 'syn-bad-decision',
        name: 'BAD DECISION',
        requires: ['itm-chocmilk-bag', 'itm-weird-imported-snack'],
        blurb: 'Chocolate milk from a bag, and a snack whose packet shows a cartoon animal holding a version of itself.',
        outcomes: [
            { type: 'notification', description: 'BAD DECISION. Not a catastrophe. A decision. You made it at 2 AM in a lit shop.' },
            { type: 'stat_change', description: 'Sugar, briefly.', stat: 'energy', value: 12 },
            { type: 'stat_change', description: 'And then the other thing.', stat: 'health', value: -8 },
            { type: 'notification', description: 'The clerk watched you buy both and said nothing, which was itself a comment.' },
        ],
    },
    {
        id: 'syn-tuna-incident',
        name: 'THE TUNA INCIDENT',
        requires: ['itm-tuna-can', 'itm-boiled-egg'],
        blurb: 'A can of tuna and a hard-boiled egg, in public, consecutively. There is no defence available to you.',
        outcomes: [
            { type: 'notification', description: 'THE TUNA INCIDENT. Two separate people relocate. One of them was sitting down.' },
            { type: 'stat_change', description: 'Nutritionally, a triumph.', stat: 'health', value: 18 },
            { type: 'streetCred', description: 'Socially, the opposite of a triumph.', change: -3 },
        ],
    },
    {
        id: 'syn-french-breakfast',
        name: 'FRENCH BREAKFAST',
        requires: ['itm-croissant', 'itm-coffee'],
        blurb: 'A croissant and a black coffee, standing up, before nine. For eleven minutes you are a person with a life.',
        outcomes: [
            { type: 'notification', description: 'You do not look at your phone once. Nobody sees this but it happened.' },
            { type: 'stat_change', description: 'Butter and caffeine, in the correct order.', stat: 'energy', value: 20 },
            { type: 'statusEffect', description: 'Composed, briefly.', effect: 'lucky', duration: '24h', label: 'Civilised Morning' },
        ],
    },

    // --- the caffeine one ------------------------------------------------
    {
        id: 'syn-caffeine-incident',
        name: 'CAFFEINE INCIDENT',
        requires: ['itm-coffee', 'itm-energy-drink'],
        blurb: 'A large filter coffee and an energy drink, inside the same hour, on an empty stomach. This is not a buff. This is an incident.',
        outcomes: [
            { type: 'notification', description: 'CAFFEINE INCIDENT. Your hands are ahead of you. So is your mouth.' },
            { type: 'stat_change', description: 'Everything at once.', stat: 'energy', value: 40 },
            { type: 'stat_change', description: 'Your heart has notes.', stat: 'health', value: -10 },
            { type: 'statusEffect', description: 'Fast, loud, and not entirely in control of the sentence.', effect: 'lucky', duration: '24h', label: 'Caffeine Overdrive' },
            { type: 'notification', description: 'You have said three things in a row that you would not have said seated.' },
        ],
    },

    // --- the gear ones ---------------------------------------------------
    {
        id: 'syn-tactical-baguette',
        name: 'TACTICAL BAGUETTE',
        requires: ['itm-baguette', 'itm-duct-tape'],
        blurb: 'Bread, reinforced. The tape runs the full length in a spiral, the way somebody on the internet demonstrated.',
        outcomes: [
            { type: 'notification', description: '"Is that bread?" "It\'s tactical."' },
            { type: 'streetCred', description: 'Nobody laughs. That is the tell.', change: 2 },
            { type: 'statusEffect', description: 'The crust no longer negotiates.', effect: 'lucky', duration: '48h', label: 'Tactical Baguette' },
            { type: 'flag', description: 'The baguette is now load-bearing.', key: 'tactical-baguette', value: true },
        ],
    },
    {
        id: 'syn-conspiracy-mode',
        name: 'CONSPIRACY MODE',
        requires: ['itm-aluminium-foil'],
        plusAnything: true,
        blurb: 'Foil, and anything else at all. It does not matter what the other thing is. The foil will find a use for it.',
        outcomes: [
            { type: 'notification', description: 'CONSPIRACY RESISTANCE active. Nothing can get in. Nothing was trying.' },
            { type: 'statusEffect', description: 'Shielded from a threat that has not been specified.', effect: 'protection', duration: '48h', label: 'Conspiracy Resistance' },
            { type: 'heat', description: 'The police see the hat and reclassify you as not worth the paperwork.', change: -4 },
            { type: 'notification', description: 'You have wrapped the other item in foil as well. You will not explain why.' },
        ],
    },
    {
        id: 'syn-signal-rig',
        name: 'THE RIG',
        requires: ['itm-aluminium-foil', 'itm-batteries', 'itm-mystery-electronics'],
        blurb: 'Foil, four AA batteries and a circuit board that fits nothing. You have assembled something. Nobody asked you to.',
        outcomes: [
            { type: 'notification', description: 'The LED comes on. It has never come on before. You do not touch anything else.' },
            { type: 'statusEffect', description: 'The rig is doing something. Possibly nothing. Possibly something.', effect: 'guidance', duration: '48h', label: 'The Rig' },
            { type: 'flag', description: 'It is in your bag and it is warm.', key: 'the-rig', value: true },
            { type: 'streetCred', description: 'Two people have asked what it is. You said "nothing".', change: 1 },
        ],
    },
    {
        id: 'syn-mom-energy',
        name: 'MOM ENERGY',
        requires: ['itm-chanclas', 'itm-cleaning-spray'],
        blurb: 'A pair of chanclas and a bottle of lemon cleaner. The combination is recognised instantly across every city in this game.',
        outcomes: [
            { type: 'notification', description: 'MOM ENERGY. Three separate strangers straighten up without being told to.' },
            { type: 'streetCred', description: 'Unquestioned authority, acquired for under twenty dollars.', change: 3 },
            { type: 'statusEffect', description: 'Nobody is going to try anything.', effect: 'protection', duration: '24h', label: 'Mom Energy' },
        ],
    },

    // --- the social ones -------------------------------------------------
    {
        id: 'syn-tel-aviv-final-boss',
        name: 'TEL AVIV FINAL BOSS',
        requires: ['itm-deodorant', 'itm-sunglasses', 'itm-baguette'],
        blurb: 'Deodorant, cheap sunglasses, and a baguette under one arm. You are no longer a customer. You are a local legend with groceries.',
        outcomes: [
            { type: 'notification', description: 'TEL AVIV FINAL BOSS. You walk past the queue. Nobody stops you. The clerk salutes with a bureka.' },
            { type: 'streetCred', description: 'The full package, correctly assembled.', change: 5 },
            { type: 'statusEffect', description: 'Untouchable in a linen-adjacent way.', effect: 'favored', duration: '48h', label: 'Final Boss' },
            { type: 'priceMarkup', description: 'Nobody is charging you full price today.', multiplier: 0.85, duration: '24h' },
        ],
    },
    {
        id: 'syn-business-casual',
        name: 'BUSINESS CASUAL',
        requires: ['itm-mouthwash', 'itm-deodorant', 'itm-comb'],
        blurb: 'Mouthwash, deodorant and a plastic comb, applied in a petrol station bathroom. You look like a man with an appointment.',
        outcomes: [
            { type: 'notification', description: 'You are taken seriously by three people who have no reason to take you seriously.' },
            { type: 'streetCred', description: 'Presentation is a skill.', change: 2 },
            { type: 'priceMarkup', description: 'Sellers quote you the better number first.', multiplier: 1.08, duration: '24h' },
        ],
    },
    {
        id: 'syn-bro-jogan-approves',
        name: 'BRO JOGAN APPROVES',
        requires: ['itm-protein-drink'],
        context: 'bro-jogan-encounter',
        blurb: 'You are holding a forty-four gram protein drink in front of Bro Jogan. He looks at the bottle. He looks at you. He nods.',
        outcomes: [
            { type: 'notification', description: '"Bro." That is the whole conversation and it went extremely well.' },
            { type: 'streetCred', description: 'Recognised by the only authority that was ever going to matter here.', change: 4 },
            { type: 'statusEffect', description: 'Endorsed at a chemical level.', effect: 'favored', duration: '48h', label: 'Bro Jogan Approves' },
            { type: 'bibiApproval', description: 'Word travels. It travels to strange places.', change: 3 },
        ],
    },
    {
        id: 'syn-party-ready',
        name: 'SOMEBODY\'S BIRTHDAY',
        requires: ['itm-party-hat', 'itm-birthday-candle', 'itm-ice-cream-chocolate'],
        context: 'party-event',
        blurb: 'A party hat, one striped candle and a tub of chocolate ice cream, on the exact day somebody needed all three.',
        outcomes: [
            { type: 'notification', description: 'You produce all three items in sequence. The room reassesses you entirely.' },
            { type: 'streetCred', description: 'You were prepared for this and nobody can prove it was an accident.', change: 4 },
            { type: 'freebie', description: 'Somebody hands you money and will not explain why.', cash: 120 },
            { type: 'statusEffect', description: 'Guest of honour by accident.', effect: 'blessed', duration: '24h', label: 'Somebody\'s Birthday' },
        ],
    },
    {
        id: 'syn-shortage-profiteer',
        name: 'THE SHORTAGE',
        requires: ['itm-toilet-paper', 'itm-trash-bags'],
        context: 'toilet-paper-emergency',
        blurb: 'Six rolls and a box of ninety-litre bags, on the morning the news uses the word "shortage" without irony.',
        outcomes: [
            { type: 'notification', description: 'NATIONAL TOILET PAPER EMERGENCY. The dead asset is awake and it has brought friends.' },
            { type: 'freebie', description: 'You sell four rolls at a price you will not repeat out loud.', cash: 400 },
            { type: 'priceMarkup', description: 'Everything you are holding is worth more this morning.', multiplier: 1.2, duration: '48h' },
            { type: 'streetCred', description: 'Foresight, or hoarding. History decides later.', change: 2 },
        ],
    },

    // --- the ones that are just funny ------------------------------------
    {
        id: 'syn-loitering-package',
        name: 'THE LOITERING PACKAGE',
        requires: ['itm-sunflower-seeds', 'itm-slushie'],
        blurb: 'Seeds and a slushie. You now have a two-hour activity and no reason to go anywhere. A plastic chair appears.',
        outcomes: [
            { type: 'notification', description: 'You are outside the shop. You are not leaving the shop. This is a third state.' },
            { type: 'stat_change', description: 'Rest, of a kind.', stat: 'energy', value: 14 },
            { type: 'statusEffect', description: 'Focused in the way of a man with nothing to do.', effect: 'calm-markets', duration: '24h', label: 'Loitering' },
            { type: 'notification', description: 'SHELLS EVERYWHERE. The shells are a map of how long you have been here.' },
        ],
    },
    {
        id: 'syn-documented',
        name: 'FULLY DOCUMENTED',
        requires: ['itm-disposable-camera', 'itm-gov-approved-sticker'],
        blurb: 'A disposable camera and a holographic seal reading GOVERNMENT APPROVED. Together they constitute, technically, a paperwork system.',
        outcomes: [
            { type: 'notification', description: 'You photograph the shoes and put the sticker on the box. The box is now evidence of itself.' },
            { type: 'flag', description: 'Everything you sell today looks authenticated.', key: 'fully-documented', value: true },
            { type: 'priceMarkup', description: 'Buyers stop asking the second question.', multiplier: 1.12, duration: '24h' },
            { type: 'heat', description: 'Somebody official may eventually want a word about the seal.', change: 3 },
        ],
    },
    {
        id: 'syn-one-flip-flop',
        name: 'STILL ONLY ONE',
        requires: ['itm-single-flip-flop', 'itm-duct-tape'],
        blurb: 'You have taped the single flip-flop to your other foot. It is not a pair. It has never been a pair.',
        outcomes: [
            { type: 'notification', description: 'You are wearing one flip-flop and one flip-flop-shaped arrangement of tape. You can walk. Evenly, even.' },
            { type: 'streetCred', description: 'Somebody films this. It does not go viral, which is worse.', change: -1 },
            { type: 'notification', description: 'WHY IS THIS HERE? The question remains open and now it is on your foot.' },
        ],
    },
];

const BY_ID = new Map(SYNERGIES.map(s => [s.id, s]));

export const getSynergy = (id: string): Synergy | undefined => BY_ID.get(id);

/**
 * Every synergy the given bag satisfies.
 *
 * `context` carries the situation tags that are true right now — the Bro Jogan
 * encounter, a party event, a toilet paper emergency. Context-gated synergies
 * stay silent without it, so the default call (bag only) never fires them by
 * accident.
 */
export function findSynergies(itemIds: string[], context: string[] = []): Synergy[] {
    const held = new Set(itemIds);
    return SYNERGIES.filter(syn => {
        if (syn.context && !context.includes(syn.context)) return false;
        if (!syn.requires.every(id => held.has(id))) return false;
        // 'plusAnything' means the listed items are a floor: the foil needs one
        // other thing in the bag and genuinely does not care which.
        if (syn.plusAnything && held.size <= syn.requires.length) return false;
        return true;
    });
}

/**
 * Ids referenced by the table that do not exist in the master catalogue.
 * Always empty. A typo here produces a synergy that can never fire, which no
 * player will ever report because they will never see it.
 */
export function verifySynergyIds(catalogueIds: string[]): string[] {
    const known = new Set(catalogueIds);
    const missing = new Set<string>();
    for (const syn of SYNERGIES) {
        for (const id of syn.requires) if (!known.has(id)) missing.add(id);
    }
    return [...missing];
}
