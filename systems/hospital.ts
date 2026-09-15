/**
 * The hospital.
 *
 * `Player.health` has carried this comment since it was written — *"Hits zero
 * and you wake up in a hospital lighter by a day and a wad of cash"* — and
 * there was no hospital. No check on `health <= 0` existed anywhere. Health was
 * the currency the fighter, the busts and the muggings all spent, and spending
 * all of it cost nothing: you could sit at zero and keep trading.
 *
 * So this is the floor of the game. Everything that hurts you now leads
 * somewhere.
 *
 * ## What it is, as a decision
 *
 * Being admitted is not a cutscene you watch. The bill runs while you lie
 * there, and every morning you choose: take another night, or sign yourself out
 * and go back to work half-mended. Staying is expensive in the two things a
 * thirty-day run cannot spare — days and money — and leaving early means the
 * next thing that hits you starts from a worse place.
 *
 * The one mercy, and it is deliberate: **heat cools while you are in here.**
 * Nobody is looking for a man in a gown. A bad beating is the cheapest way to
 * go quiet, which is not a reason to want one but is a reason not to despair
 * when it happens.
 */

import type { Player } from '../types';
import { MAX_HEALTH, MAX_HEAT } from '../constants';
import { rngFor } from '../utils/rng';

/** Through the door, before anybody has looked at you. */
export const ADMISSION_FEE = 400;
/** Per night, on top. */
export const NIGHTLY_RATE = 260;

/**
 * Where they stabilise you to.
 *
 * Above zero on purpose. If a discharge could put you back on the street at
 * zero health you would be re-admitted by the next scratch, and the game would
 * be a loop rather than a consequence.
 */
export const STABILISED_AT = 12;

/** What a night in a bed is worth. Three nights is most of the way back. */
export const HEALED_PER_NIGHT = 30;

/** What a night off the street is worth, which is the only good news in here. */
export const COOLED_PER_NIGHT = 14;

/** How many nights before they want the bed back. */
export const MAX_NIGHTS = 6;

export interface HospitalStay {
    /** The day they brought you in. */
    admittedOnDay: number;
    /** What put you here, in plain words. */
    cause: string;
    /** Nights slept so far. Zero on the first morning. */
    nights: number;
    /** What the bill has reached, before anybody argues about it. */
    bill: number;
    /** Stable for the whole stay, so a re-render never redecorates the ward. */
    ward: string;
    neighbour: string;
    /** One line per night, oldest first. The record of what it cost you. */
    chart: string[];
}

const WARDS = [
    'a curtained bay in a corridor that is technically a ward',
    'a bed on the third floor, where the lift does not stop after nine',
    'a two-bed room with one working blind',
    'the observation bay, under a light nobody can turn off',
    'a bed by the window, which they will tell you is lucky',
];

const NEIGHBOURS = [
    'The man in the next bed is on the phone to his brother about a van.',
    'The man in the next bed has not spoken and has not stopped watching the door.',
    'The woman opposite is doing a crossword in pen and getting it right.',
    'The man in the next bed wants to know, sincerely, what your shoes cost.',
    'Nobody is in the next bed. The sheets are still folded.',
    'The man in the next bed came in the same night you did and looks worse.',
];

/**
 * Things that happen on a night, so "one more night?" is not pure arithmetic.
 * Padding the bill is the common one, because of course it is.
 */
const NIGHTS = [
    { text: 'They charge you for a scan you are fairly sure did not happen.', bill: 180, health: 0 },
    { text: 'A doctor half your age tells you to stop doing whatever you were doing.', bill: 0, health: 0 },
    { text: 'You sleep properly for the first time in a fortnight.', bill: 0, health: 10 },
    { text: 'Somebody wheels past shouting. You do not sleep at all.', bill: 0, health: -6 },
    { text: 'The food arrives and you eat all of it without complaint.', bill: 0, health: 6 },
    { text: 'An itemised line reads "sundries". It is ninety dollars.', bill: 90, health: 0 },
    { text: 'Your stitches hold. Somebody seems surprised by this.', bill: 0, health: 4 },
    { text: 'A nurse recognises you from the feed and says nothing about it.', bill: 0, health: 0 },
];

/** Deterministic per admission, so nothing reshuffles under the player. */
const dressing = (day: number, cause: string) => {
    const rng = rngFor(`hospital:${day}:${cause}`);
    return {
        ward: WARDS[Math.floor(rng() * WARDS.length)],
        neighbour: NEIGHBOURS[Math.floor(rng() * NEIGHBOURS.length)],
    };
};

/** Opens a stay. The door charge lands immediately; the rest accrues. */
export function admit(day: number, cause: string): HospitalStay {
    const { ward, neighbour } = dressing(day, cause);
    return {
        admittedOnDay: day,
        cause,
        nights: 0,
        bill: ADMISSION_FEE,
        ward,
        neighbour,
        chart: [],
    };
}

/** Stabilised, and no longer bleeding out on the pavement. */
export const stabilise = (player: Player): Player => ({
    ...player,
    health: Math.max(player.health, STABILISED_AT),
});

export interface NightResult {
    stay: HospitalStay;
    player: Player;
    /** What happened, for the chart on the wall. */
    line: string;
}

/**
 * One more night. Costs a day and the nightly rate, buys back health, and cools
 * the heat that brought most people here in the first place.
 */
export function nightIn(stay: HospitalStay, player: Player, rng: () => number = Math.random): NightResult {
    const event = NIGHTS[Math.floor(rng() * NIGHTS.length)];
    const nights = stay.nights + 1;
    const line = `Night ${nights}. ${event.text}`;

    return {
        stay: {
            ...stay,
            nights,
            bill: stay.bill + NIGHTLY_RATE + event.bill,
            chart: [...stay.chart, line],
        },
        player: {
            ...player,
            health: Math.max(1, Math.min(MAX_HEALTH, player.health + HEALED_PER_NIGHT + event.health)),
            heat: Math.max(0, Math.min(MAX_HEAT, player.heat - COOLED_PER_NIGHT)),
        },
        line,
    };
}

/** They want the bed back. */
export const mustLeave = (stay: HospitalStay): boolean => stay.nights >= MAX_NIGHTS;

export interface Settlement {
    player: Player;
    /** Taken from the pocket. */
    fromCash: number;
    /** Taken from the bank. */
    fromBank: number;
    /** Put on the card, because there was nothing left to take. */
    onCredit: number;
    /** Written off, because there was nothing left at all. */
    forgiven: number;
    log: string[];
}

/**
 * Settling up.
 *
 * Pocket first, then the bank, then the card. A player with no card and no
 * money does not get held prisoner over a bill — the rest is written off, they
 * walk out with nothing, and that is punishment enough. A debtor's prison is
 * not a mechanic anybody wants to play.
 */
export function settle(stay: HospitalStay, player: Player): Settlement {
    const log: string[] = [];
    let owed = stay.bill;

    const fromCash = Math.min(player.cash, owed);
    owed -= fromCash;
    const fromBank = Math.min(player.bank, owed);
    owed -= fromBank;

    const w = player.wallet;
    const room = w.hasCredit ? Math.max(0, w.creditLimit - w.creditOwed) : 0;
    const onCredit = Math.min(room, owed);
    owed -= onCredit;
    const forgiven = owed;

    if (fromCash) log.push(`They take $${fromCash.toLocaleString()} out of your pocket at the desk.`);
    if (fromBank) log.push(`$${fromBank.toLocaleString()} comes straight off the card, from the bank.`);
    if (onCredit) log.push(`$${onCredit.toLocaleString()} goes on credit. It will find you.`);
    if (forgiven) log.push(`$${forgiven.toLocaleString()} is written off. The clerk does not look up.`);

    return {
        player: {
            ...player,
            cash: player.cash - fromCash,
            bank: player.bank - fromBank,
            wallet: { ...w, creditOwed: w.creditOwed + onCredit },
        },
        fromCash,
        fromBank,
        onCredit,
        forgiven,
        log,
    };
}

/** What the next night would add, so the player can read the choice. */
export const nightlyEstimate = (): number => NIGHTLY_RATE;
