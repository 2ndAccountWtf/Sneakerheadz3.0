/**
 * The Nap micro-event engine.
 *
 * Sleeping is never just "+40 energy". You lie down and the game rolls on a
 * table; most of the time you simply wake up rested, and sometimes The Game
 * has taken your left shoe.
 */
import type { Player } from '../../types';
import type { ScenarioOutcome } from '../../types/interactions';
import { buffMultiplier } from '../outcomes/outcomeEngine';

export interface NapResult {
    text: string;
    energyRestored: number;
    healthRestored: number;
    daysLost: number;
    outcomes: ScenarioOutcome[];
}

interface NapEntry {
    weight: number;
    build: (player: Player) => NapResult;
    /** Good outcomes get boosted by a luck buff. */
    good?: boolean;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const r = (min: number, max: number) => Math.round(rand(min, max));

const NAP_TABLE: NapEntry[] = [
    {
        weight: 30,
        good: true,
        build: () => ({
            text: 'You sleep like a normal person. Revolutionary.',
            energyRestored: r(45, 70),
            healthRestored: r(5, 15),
            daysLost: 0,
            outcomes: [],
        }),
    },
    {
        weight: 14,
        good: true,
        build: () => ({
            text: 'You dream of a warehouse where every pair is your size. You wake up inspired.',
            energyRestored: r(50, 75),
            healthRestored: 5,
            daysLost: 0,
            outcomes: [
                { type: 'statusEffect', effect: 'lucky', duration: '24h', label: 'Prophetic Dream', description: 'Something good is coming.' },
            ],
        }),
    },
    {
        weight: 12,
        build: () => ({
            text: 'You oversleep catastrophically. An entire day is gone.',
            energyRestored: 90,
            healthRestored: 20,
            daysLost: 1,
            outcomes: [],
        }),
    },
    {
        weight: 10,
        build: () => ({
            text: 'You wake up smelling like a closed gym. People give you space.',
            energyRestored: r(30, 45),
            healthRestored: 0,
            daysLost: 0,
            outcomes: [
                { type: 'streetCred', change: -2, description: 'Nobody wants to negotiate with that smell.' },
            ],
        }),
    },
    {
        weight: 9,
        build: () => ({
            text: 'Someone photographs you asleep in ridiculous shoes. It does numbers online.',
            energyRestored: r(35, 55),
            healthRestored: 5,
            daysLost: 0,
            outcomes: [
                { type: 'streetCred', change: r(4, 9), description: 'The photo goes viral. You look unhinged and expensive.' },
            ],
        }),
    },
    {
        weight: 8,
        build: () => ({
            text: 'You wake to find your bag lighter. Somebody went through it while you snored.',
            energyRestored: r(30, 50),
            healthRestored: 0,
            daysLost: 0,
            outcomes: [
                { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: r(40, 260) }], description: 'Cash taken while you slept.' },
            ],
        }),
    },
    {
        weight: 7,
        build: () => ({
            text: 'The Game steals your left shoe. Only the left one. He leaves a note that says "equity".',
            energyRestored: r(30, 50),
            healthRestored: 0,
            daysLost: 0,
            outcomes: [
                { type: 'statusEffect', effect: 'scuffed', description: 'A pair is now missing something important.' },
                { type: 'notification', message: 'The note is written on the back of a mixtape flyer.', description: '' },
            ],
        }),
    },
    {
        weight: 6,
        good: true,
        build: () => ({
            text: 'You wake up and there is a random item next to you. No explanation is offered.',
            energyRestored: r(40, 60),
            healthRestored: 5,
            daysLost: 0,
            outcomes: [
                { type: 'inventoryChange', add: [{ kind: 'currency', value: 'cash', qty: r(60, 300) }], description: 'There was cash in the pillowcase.' },
            ],
        }),
    },
    {
        weight: 5,
        build: () => ({
            text: 'Grandma Laces is sitting at the foot of the bed when you wake. She will not say how she got in.',
            energyRestored: r(35, 55),
            healthRestored: 10,
            daysLost: 0,
            outcomes: [
                { type: 'notification', message: '"Your arches are collapsing, bubbeleh. I could hear it."', description: '' },
                { type: 'streetCred', change: 1, description: 'She approves of something. Unclear what.' },
            ],
        }),
    },
    {
        weight: 4,
        good: true,
        build: () => ({
            text: 'A dream of total market clarity. You wake up knowing things.',
            energyRestored: r(55, 80),
            healthRestored: 10,
            daysLost: 0,
            outcomes: [
                { type: 'statusEffect', effect: 'guidance', duration: '24h', label: 'Dream Clarity (market insight)', description: 'You can read the market for a day.' },
            ],
        }),
    },
];

export function rollNapEvent(player: Player, _day: number): NapResult {
    const luck = buffMultiplier(player, 'luck', 1);
    const hasLuck = luck !== 1 || player.buffs.some(b => b.kind === 'luck');

    const weighted = NAP_TABLE.map(e => ({
        ...e,
        // A luck buff roughly doubles the pull of the pleasant outcomes.
        effective: e.good && hasLuck ? e.weight * 2 : e.weight,
    }));

    const total = weighted.reduce((sum, e) => sum + e.effective, 0);
    let point = Math.random() * total;
    for (const entry of weighted) {
        if (point < entry.effective) return entry.build(player);
        point -= entry.effective;
    }
    return weighted[0].build(player);
}
