/**
 * Getting robbed for carrying cash.
 *
 * The authored muggings in `data/celebrities/the-game` are jokes — The Game
 * wants one shoelace, or five dollars for gas — and they should stay jokes.
 * They are not, and were never meant to be, the thing that makes the bank
 * matter. Nothing did: you could walk around with thirty thousand dollars in
 * your pocket for a month and the only consequence was a rapper asking for a
 * lace.
 *
 * This is the consequence. Once you are carrying more than pocket money, every
 * flight is a chance that somebody takes most of it, and the fix is sitting on
 * the city screen with a deposit box. Two things soften it, both of them things
 * the player earns rather than buys: a name on the street (people who know who
 * you are pick someone else) and daylight.
 *
 * `robberyExposure` is a *per-encounter* likelihood, not a daily one — used raw
 * it would rob a rich player four days in five. ENCOUNTER_ODDS converts it into
 * "does an encounter even happen today", which lands a well-off player at
 * roughly one robbery a week and a paranoid one at almost none.
 */
import type { Player } from '../../types';
import type { OutcomeLogEntry } from '../../types/game';
import { ROBBERY_CASH_FLOOR } from '../../constants';
import { robberyExposure, muggingLoss, blockCard, rollCardLossEvent, cardUsable } from '../banking';

/** Fraction of per-encounter exposure that becomes a real encounter on a travel day. */
const ENCOUNTER_ODDS = 0.32;

/** Street cred worth its full protective value. Above this it stops helping. */
const CRED_SHIELD_CAP = 60;

/** How much of the risk a fully-known face removes. */
const CRED_SHIELD_MAX = 0.45;

/** Night is when this happens. Mornings are close to safe. */
const TIME_MULTIPLIER: Record<string, number> = {
    morning: 0.5,
    afternoon: 0.7,
    evening: 1.15,
    night: 1.5,
};

export interface StreetRobbery {
    cashLost: number;
    /** Set when they took the wallet with the card in it. */
    cardBlockedDays?: number;
    line: string;
    log: OutcomeLogEntry[];
}

const OPENERS: string[] = [
    'Two of them, one street corner, no conversation.',
    'Somebody walks past you, then turns around. That is the whole warning you get.',
    'A moped slows down next to you. It does not stop, exactly.',
    'Someone asks you for the time in a way that is not about the time.',
    'A hand on your shoulder, extremely friendly, going through your jacket.',
    'Three kids. You are embarrassed about how quickly it is over.',
    'It happens on a crowded street, in daylight, and nobody looks up.',
];

/**
 * Rolls the day's robbery. Returns null the overwhelming majority of the time —
 * this is only ever meant to be the tax on carrying too much.
 */
export function rollStreetRobbery(
    player: Player,
    day: number,
    timeOfDay: string,
    rng: () => number = Math.random,
): { player: Player; robbery: StreetRobbery } | null {
    // Pocket money is beneath everyone's notice, and that floor is the promise
    // the bank screen makes to the player. It has to hold.
    if (player.cash <= ROBBERY_CASH_FLOOR / 2) return null;

    const shield = 1 - (Math.min(CRED_SHIELD_CAP, player.streetCred) / CRED_SHIELD_CAP) * CRED_SHIELD_MAX;
    const chance = robberyExposure(player)
        * ENCOUNTER_ODDS
        * (TIME_MULTIPLIER[timeOfDay] ?? 1)
        * shield;

    if (rng() >= chance) return null;

    const cashLost = muggingLoss(player);
    const log: OutcomeLogEntry[] = [];
    let next: Player = {
        ...player,
        cash: Math.max(0, player.cash - cashLost),
        health: Math.max(1, player.health - Math.round(4 + rng() * 8)),
        stats: { ...player.stats, timesRobbed: player.stats.timesRobbed + 1 },
    };

    const line = OPENERS[Math.floor(rng() * OPENERS.length)];
    log.push({
        icon: '🔪',
        text: `${line} They take $${cashLost.toLocaleString()}.`,
        tone: 'bad',
    });

    // They took the whole wallet a third of the time, which is worse than the
    // cash: it means no card either, so you cannot simply draw more out.
    let cardBlockedDays: number | undefined;
    if (cardUsable(next, day) && rng() < 0.34) {
        const event = rollCardLossEvent('mugging');
        cardBlockedDays = event?.days ?? 2;
        next = blockCard(
            next,
            day,
            event?.reason ?? 'They took the wallet, card and all.',
            cardBlockedDays,
        );
        log.push({
            icon: '💳',
            text: `The wallet went with it. No card for ${cardBlockedDays} day${cardBlockedDays === 1 ? '' : 's'}.`,
            tone: 'bad',
        });
    }

    // Being robbed in public is not neutral. It is a small, deserved knock.
    if (next.streetCred > 0) {
        next = { ...next, streetCred: Math.max(0, next.streetCred - 2) };
        log.push({ icon: '📉', text: 'People saw. −2 cred.', tone: 'bad' });
    }

    return { player: next, robbery: { cashLost, cardBlockedDays, line, log } };
}
