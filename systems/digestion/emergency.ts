/**
 * Bathroom Emergencies
 * ====================
 * The point of this system is that it is not an animation — it interrupts the
 * core Dope Wars loop. While an emergency is active you cannot travel, stores
 * get uncomfortable, and a real-time clock is running. Resolving it means
 * choosing a bathroom, and the cheap ones are the unreliable ones.
 *
 * Everything here is cartoonish. Nothing is described in detail. The comedy is
 * entirely in the logistics and the timing.
 */
import type { Player, BathroomEmergency, StorageItem } from '../../types';
import type { ScenarioOutcome } from '../../types/interactions';
import type { Bathroom } from '../../data/bathrooms';
import { EMERGENCY_SECONDS } from '../../constants';

let seq = 0;

const OPENERS: Record<1 | 2 | 3, string[]> = {
    1: [
        'Something is wrong. Not urgently wrong. But wrong.',
        'A quiet note of concern arrives from somewhere below your ribs.',
    ],
    2: [
        'The situation has developed. You should probably deal with this.',
        'Your body sends a second, firmer message.',
    ],
    3: [
        'THE CHOCOLATE MILK WAS A MISTAKE.',
        'STOMACH: NO.',
        'Your body has rejected this purchase. Loudly. Internally. For now.',
    ],
};

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/** Builds an emergency from the item that caused it. */
export function startEmergency(cause: string, severity: 1 | 2 | 3): BathroomEmergency {
    const now = Date.now();
    return {
        id: `emg-${now.toString(36)}-${seq++}`,
        cause,
        startedAt: now,
        deadline: now + EMERGENCY_SECONDS[severity] * 1000,
        severity,
    };
}

export const emergencyHeadline = (e: BathroomEmergency): string => pick(OPENERS[e.severity]);

export const secondsLeft = (e: BathroomEmergency): number =>
    Math.max(0, Math.ceil((e.deadline - Date.now()) / 1000));

export const hasExpired = (e: BathroomEmergency): boolean => Date.now() >= e.deadline;

/**
 * Rolls whether consuming an item starts an emergency.
 *
 * Risk compounds: the more recently-risky things in your system, the worse the
 * odds. Severity scales with the item's own risk so the chocolate milk bag is
 * always the dramatic one.
 */
export function rollDigestiveOutcome(item: StorageItem, player: Player): BathroomEmergency | null {
    const risk = item.digestiveRisk ?? 0;
    if (risk <= 0) return null;

    // A stomach already under load is more likely to give up entirely.
    const loaded = player.gas >= 6 ? 1.35 : 1;
    if (Math.random() > risk * loaded) return null;

    const severity: 1 | 2 | 3 = risk >= 0.35 ? 3 : risk >= 0.2 ? 2 : 1;
    return startEmergency(item.name, severity);
}

export interface BathroomAttempt {
    ok: boolean;
    line: string;
    outcomes: ScenarioOutcome[];
}

/**
 * Attempting a bathroom. Failure costs you the travel time and leaves the
 * emergency running, which is the entire tension of the system.
 */
export function attemptBathroom(bathroom: Bathroom, player: Player): BathroomAttempt {
    if (player.cash < bathroom.price) {
        return {
            ok: false,
            line: `You cannot afford the ${bathroom.price}. You are turned away at the counter.`,
            outcomes: [],
        };
    }

    if (Math.random() < bathroom.unreliability) {
        return {
            ok: false,
            line: bathroom.closedLine,
            outcomes: bathroom.price > 0
                ? []  // you don't pay for one you never got into
                : [],
        };
    }

    // Cleanliness recovered scales with how civilised the facility was.
    const cleanliness = [0, 6, 14, 24, 34, 44][bathroom.dignity];

    return {
        ok: true,
        line: `Resolved. ${bathroom.dignity >= 4 ? 'With dignity, even.' : 'Barely. But resolved.'}`,
        outcomes: [
            ...(bathroom.price > 0
                ? [{ type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: bathroom.price }], description: `${bathroom.name}: ${bathroom.price}.` } as ScenarioOutcome]
                : []),
            { type: 'stat_change', payload: { stat: 'energy', value: -6 }, description: 'That took something out of you.' },
        ],
    };
}

/** What happens when the clock runs out. Cartoonish, and genuinely costly. */
export function disasterOutcomes(): { line: string; outcomes: ScenarioOutcome[] } {
    return {
        line: 'You did not make it. We will not dwell on it. Everyone else will.',
        outcomes: [
            { type: 'streetCred', change: -14, description: 'This will be referenced for some time.' },
            { type: 'stat_change', payload: { stat: 'energy', value: -25 }, description: 'The day is effectively over.' },
            { type: 'notification', message: 'You buy replacement clothing from a tourist shop. It says I ♥ this city.', description: '' },
        ],
    };
}
