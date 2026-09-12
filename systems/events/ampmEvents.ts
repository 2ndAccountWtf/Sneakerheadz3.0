/**
 * AM/PM store events: night mode, the register glitch, the raccoon, and the
 * "vibe check" freebies the Tel Aviv clerk hands out at 3am.
 */
import type { ScenarioOutcome } from '../../types/interactions';
import { ampmRandomEvent } from '../../data/ampm/dialogue';

export interface AmpmEvent {
    text: string;
    outcomes: ScenarioOutcome[];
    tone: 'good' | 'bad' | 'neutral';
}

/**
 * Party mode: Tel Aviv only, late in the day cycle, 1-in-5. The store becomes a
 * club and the clerk starts giving things away.
 */
export function isPartyMode(cityId: string, day: number): boolean {
    if (cityId !== 'tel-aviv') return false;
    // timeOfDay cycles morning/afternoon/evening/night with the day counter;
    // night is when day % 4 === 3.
    const isNight = day % 4 === 3;
    if (!isNight) return false;
    // Stable per day so the store doesn't flicker in and out of a rave.
    return (day * 2654435761) % 100 < 34;
}

const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

const EVENTS: { weight: number; build: () => AmpmEvent }[] = [
    {
        weight: 26,
        build: () => ({ text: ampmRandomEvent(), tone: 'neutral', outcomes: [] }),
    },
    {
        weight: 16,
        build: () => ({
            text: 'The register glitches mid-transaction. The clerk stares at it, then at you, then shrugs.',
            tone: 'good',
            outcomes: [{ type: 'inventoryChange', add: [{ kind: 'currency', value: 'cash', qty: rand(20, 120) }], description: 'The drawer opens and nobody claims it.' }],
        }),
    },
    {
        weight: 14,
        build: () => ({
            text: 'Someone spills a slushie across aisle three. Your shoes are in aisle three.',
            tone: 'bad',
            outcomes: [{ type: 'statusEffect', effect: 'scuffed', description: 'A pair takes blue syrup damage.' }],
        }),
    },
    {
        weight: 14,
        build: () => ({
            text: 'The clerk decides you have "bureka energy" and refuses to charge you for something.',
            tone: 'good',
            outcomes: [
                { type: 'stat_change', payload: { stat: 'energy', value: rand(8, 20) }, description: 'Free food is the best food.' },
                { type: 'streetCred', change: 1, description: 'The regulars nod at you now.' },
            ],
        }),
    },
    {
        weight: 12,
        build: () => ({
            text: 'A man sprints through screaming about a rare drop in the alley behind the store.',
            tone: 'neutral',
            outcomes: [{ type: 'statusEffect', effect: 'lucky', duration: '24h', label: 'Alley Tip-Off', description: 'You believed him, and maybe you were right.' }],
        }),
    },
    {
        weight: 10,
        build: () => ({
            text: 'Two scooter guys start arguing at the counter. One of them takes something out of your hand and leaves with it.',
            tone: 'bad',
            outcomes: [{ type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: rand(15, 70) }], description: 'He also took your change.' }],
        }),
    },
    {
        weight: 8,
        build: () => ({
            text: 'The nacho cheese machine says something. You do not repeat it. It was specific.',
            tone: 'good',
            outcomes: [{ type: 'statusEffect', effect: 'guidance', duration: '24h', label: 'Cheese Prophecy', description: 'The machine named a model. You wrote it down.' }],
        }),
    },
];

/** Party mode is where the clerk starts giving away actual merchandise. */
const PARTY_EVENTS: { weight: number; build: () => AmpmEvent }[] = [
    {
        weight: 30,
        build: () => ({
            text: '"Lady, lady, you take the bureka, no pay. Why? Because your eyes are… like… bureka, hot, fresh, perfect." He is talking to a mannequin.',
            tone: 'good',
            outcomes: [{ type: 'stat_change', payload: { stat: 'energy', value: rand(12, 25) }, description: 'Free bureka. Somehow the best one.' }],
        }),
    },
    {
        weight: 24,
        build: () => ({
            text: 'A hora circle forms around the slushie machine using Red Bull cans. You are pulled in. You do not resist.',
            tone: 'good',
            outcomes: [
                { type: 'streetCred', change: rand(3, 7), description: 'Somebody filmed the circle. You are in it, dancing.' },
                { type: 'stat_change', payload: { stat: 'energy', value: -8 }, description: 'That was more cardio than expected.' },
            ],
        }),
    },
    {
        weight: 18,
        build: () => ({
            text: '"Someone send me 10 shekel and I Bit you back double, I promise." His app is frozen. It stays frozen.',
            tone: 'bad',
            outcomes: [{ type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: 10 }], description: 'You will not be Bit back.' }],
        }),
    },
    {
        weight: 16,
        build: () => ({
            text: 'He turns the music up, points at you, and declares a 40% discount "for the vibe". Nobody challenges him.',
            tone: 'good',
            outcomes: [{ type: 'priceMarkup', multiplier: 0.6, duration: '24h', description: 'Vibe discount: 40% off everywhere, one day.' }],
        }),
    },
    {
        weight: 12,
        build: () => ({
            text: 'The speaker gets unplugged. He threatens the entire store on his grandmother\'s bureka. Police arrive within four minutes.',
            tone: 'bad',
            outcomes: [{ type: 'heat', change: 12, description: 'You were standing next to him when they walked in.' }],
        }),
    },
];

export function rollAmpmEvent(partyMode: boolean): AmpmEvent {
    const table = partyMode ? PARTY_EVENTS : EVENTS;
    const total = table.reduce((s, e) => s + e.weight, 0);
    let point = Math.random() * total;
    for (const entry of table) {
        if (point < entry.weight) return entry.build();
        point -= entry.weight;
    }
    return table[0].build();
}

/** How often an ambient event fires on entering or buying. */
export const AMPM_EVENT_CHANCE = 0.3;
export const AMPM_PARTY_EVENT_CHANCE = 0.55;
