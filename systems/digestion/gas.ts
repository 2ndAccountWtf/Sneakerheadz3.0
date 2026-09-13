/**
 * The Gas System
 * ==============
 * Hummus does not print "FART +1". It adds to a hidden meter, and the meter
 * expresses itself through escalating public consequences at the worst
 * possible moment — mid-negotiation, mid-audience-with-the-prime-minister.
 *
 * The player is never shown the number. They learn it the way you learn it in
 * life: symptoms first.
 */
import type { Player } from '../../types';
import { GAS_THRESHOLDS } from '../../constants';

export type GasTier = 'silent' | 'audible' | 'noticed' | 'incident' | 'biological';

export function gasTier(gas: number): GasTier {
    if (gas >= GAS_THRESHOLDS.biological) return 'biological';
    if (gas >= GAS_THRESHOLDS.incident) return 'incident';
    if (gas >= GAS_THRESHOLDS.noticed) return 'noticed';
    if (gas >= GAS_THRESHOLDS.audible) return 'audible';
    return 'silent';
}

/**
 * Chance of an incident firing during any given dialogue node.
 *
 * Deliberately low per-node even at high pressure: the gag lands because it is
 * rare and badly timed, not because it happens every third line.
 */
export function incidentChance(gas: number): number {
    const tier = gasTier(gas);
    switch (tier) {
        case 'silent': return 0;
        case 'audible': return 0.08;
        case 'noticed': return 0.18;
        case 'incident': return 0.3;
        case 'biological': return 0.45;
    }
}

/** How much pressure an event releases. Bigger events clear more. */
const RELIEF: Record<GasTier, number> = {
    silent: 0,
    audible: 2,
    noticed: 3,
    incident: 5,
    biological: 8,
};

/** Per-NPC reactions. Everyone in this world responds in character. */
const REACTIONS: Record<string, Partial<Record<GasTier, string[]>>> = {
    'grandma-laces': {
        audible: ['She pretends not to have heard, which is worse.'],
        noticed: ['"WHO DID THAT?" She looks directly at where The Game would be standing, if he were here.'],
        incident: ['"WAS THAT THE GAME? IT WAS, WASN\'T IT." She is already telling someone.'],
        biological: ['She opens a window with surprising speed for a woman of her age, and blames The Game by name.'],
    },
    'bro-jogan': {
        audible: ['"Honestly? There\'s probably some science behind that."'],
        noticed: ['"That\'s your gut biome talking, man. That\'s data."'],
        incident: ['"See, THIS is what happens when you eat processed food. I\'m not judging. I\'m observing."'],
        biological: ['He asks, genuinely, whether you would come on the podcast and talk about it.'],
    },
    adc: {
        audible: ['"That odour is a consequence of capitalist food systems."'],
        noticed: ['"Do not apologise. You have been failed by a supply chain."'],
        incident: ['She begins drafting a demand for mandatory ventilation in retail environments.'],
        biological: ['"This is exactly what I have been saying." She has not been saying this.'],
    },
    'yasser-abbasfat': {
        audible: ['"THEY PUT IT IN THE HUMMUS!"'],
        noticed: ['"THIS IS WHAT THEY DO! THIS! IS! WHAT! THEY! DO!"'],
        incident: ['He declares it an act of aggression and demands an emergency session.'],
        biological: ['He evacuates, loudly, narrating the evacuation as he performs it.'],
    },
    bibi: {
        audible: ['He pauses for exactly one second and continues as though nothing occurred.'],
        noticed: ['"...We will return to this." He does not return to this.'],
        incident: ['"Meeting adjourned." He is already leaving.'],
        biological: ['Security steps forward. Bibi waves them off, with great dignity, from the doorway.'],
    },
    'the-game': {
        audible: ['"Man, that\'s nasty."'],
        noticed: ['"Yo. YO. We\'re outside. How is that even possible out HERE?"'],
        incident: ['He backs away with his shirt over his face, still asking for the five dollars.'],
        biological: ['He leaves. He comes back for the five dollars. He leaves again, faster.'],
    },
    'donald-drip': {
        audible: ['"Was that you? That was you. Tremendous."'],
        noticed: ['"People are saying it was the greatest one they\'ve ever heard. Very sad."'],
        incident: ['He tells the room he has smelled worse, from better people, in nicer buildings.'],
        biological: ['He calls it a hoax and leaves.'],
    },
};

const GENERIC: Record<GasTier, string[]> = {
    silent: [],
    audible: [
        'A sound occurs. Nobody acknowledges it. The conversation continues, changed.',
        'You shift your weight. It does not help.',
    ],
    noticed: [
        'They stop mid-sentence. "Bro… what was that?"',
        'Somebody looks at the floor, then at you, then very deliberately away.',
    ],
    incident: [
        'Heads turn. Several of them. The negotiation does not recover from this.',
        'A nearby shopper relocates to a different part of the store entirely.',
    ],
    biological: [
        'The immediate area clears. An employee announces they are taking their break now.',
        'Somebody props open a door. Nobody says anything. Everybody knows.',
    ],
};

export interface GasIncident {
    tier: GasTier;
    line: string;
    /** Cred is only lost once it becomes public. */
    credChange: number;
    gasRelieved: number;
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/**
 * Rolls for an incident during an interaction with `npcId`. Returns null on the
 * overwhelming majority of nodes.
 */
export function rollGasIncident(player: Player, npcId: string): GasIncident | null {
    const tier = gasTier(player.gas);
    if (tier === 'silent') return null;
    if (Math.random() > incidentChance(player.gas)) return null;

    const npcLines = REACTIONS[npcId]?.[tier];
    const line = npcLines?.length ? pick(npcLines) : pick(GENERIC[tier]);

    // Only a public incident actually costs you standing.
    const credChange = tier === 'biological' ? -6 : tier === 'incident' ? -3 : 0;

    return { tier, line, credChange, gasRelieved: RELIEF[tier] };
}

/** Gas dissipates slowly across days so it never becomes a permanent state. */
export const settleGas = (gas: number): number => Math.max(0, gas - 3);
