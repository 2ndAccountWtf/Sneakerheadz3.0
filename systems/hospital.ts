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

/**
 * What it costs, and why it is not a price list.
 *
 * The first version charged a flat $400 to walk in and $260 a night. That is
 * two different games depending on when it happens: on day two it takes most of
 * your stake, and by the back half of a run — where a working trader clears
 * around $150,000 a day and finishes near four and a half million — it is a
 * rounding error you would not notice on the receipt. A flat fee in an
 * exponential economy is not a cost, it is a tax that expires.
 *
 * So the bill is a share of what you are worth, with a floor under it. This is
 * also the more honest version of the joke: nobody itemises what a procedure
 * costs, they look at your shoes and decide what you can stand. A man who
 * arrives in a four-figure pair of grails is quoted differently from a man who
 * arrives in socks, and both of them are told it is standard.
 *
 * The floor is what makes an early beating nearly run-ending, which it should
 * be. The share is what stops a late one being free.
 */

/** The least they will take, however little you are carrying. */
export const ADMISSION_FLOOR = 1_500;
export const NIGHTLY_FLOOR = 900;

/** And what they take off somebody who is visibly doing well. */
export const ADMISSION_SHARE = 0.035;
export const NIGHTLY_SHARE = 0.025;

/** Cash, bank and what is in the bag — they can see the bag. */
export const admissionFee = (worth: number): number =>
    Math.max(ADMISSION_FLOOR, Math.round(Math.max(0, worth) * ADMISSION_SHARE));

export const nightlyRate = (worth: number): number =>
    Math.max(NIGHTLY_FLOOR, Math.round(Math.max(0, worth) * NIGHTLY_SHARE));

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
    /**
     * What a night costs on this stay. Fixed when you are admitted, so getting
     * richer in a hospital bed does not raise the rate on you mid-stay.
     */
    nightly: number;
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
/**
 * `bill` is a share of that night's rate rather than a number of dollars, so a
 * padded line is still noticeable to a man worth four million. A flat ninety
 * dollars stops being a joke the moment ninety dollars stops being money.
 */
const NIGHTS = [
    { text: 'They charge you for a scan you are fairly sure did not happen.', bill: 0.7, health: 0 },
    { text: 'A doctor half your age tells you to stop doing whatever you were doing.', bill: 0, health: 0 },
    { text: 'You sleep properly for the first time in a fortnight.', bill: 0, health: 10 },
    { text: 'Somebody wheels past shouting. You do not sleep at all.', bill: 0, health: -6 },
    { text: 'The food arrives and you eat all of it without complaint.', bill: 0, health: 6 },
    { text: 'An itemised line reads "sundries". Nobody will tell you what it covers.', bill: 0.35, health: 0 },
    { text: 'Your stitches hold. Somebody seems surprised by this.', bill: 0, health: 4 },
    { text: 'A nurse recognises you from the feed and says nothing about it.', bill: 0, health: 0 },
    { text: 'Somebody at the desk asks, twice, what your shoes cost.', bill: 0.5, health: 0 },
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
/**
 * Opens a stay. `worth` is cash, bank and bag — what they can see and what they
 * can reach. Quoted once, on the way in, and the quote holds for the stay.
 */
export function admit(day: number, cause: string, worth = 0): HospitalStay {
    const { ward, neighbour } = dressing(day, cause);
    return {
        admittedOnDay: day,
        cause,
        nights: 0,
        bill: admissionFee(worth),
        nightly: nightlyRate(worth),
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
            bill: stay.bill + stay.nightly + Math.round(stay.nightly * event.bill),
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
export const atTheLimit = (stay: HospitalStay): boolean => stay.nights >= MAX_NIGHTS;

/** Everything the desk could get out of you, in the order it will try. */
export const reachableFunds = (player: Player): number =>
    player.cash
    + player.bank
    + (player.wallet.hasCredit ? Math.max(0, player.wallet.creditLimit - player.wallet.creditOwed) : 0);

/**
 * Whether they will run the bill any higher.
 *
 * Without this the settlement's mercy becomes an exploit, and the worst kind:
 * an unpayable balance is written off, so a player with nothing could take all
 * six nights, heal to full and pay nothing, while a player doing well pays six
 * figures for the same beds. Being broke would make the hospital *free*,
 * inverting the pressure at exactly the point the floor is supposed to bite
 * hardest. Measured before the fix: six nights, $7,845 run up, $0 paid,
 * discharged at 100/100.
 *
 * So they stop when the money stops, which is also simply what a private clinic
 * does. You can never refuse the ambulance — the admission lands whatever you
 * have — but nobody is giving you a week of beds on a promise.
 */
export const canStayAnother = (stay: HospitalStay, player: Player): boolean =>
    !atTheLimit(stay) && stay.bill + stay.nightly <= reachableFunds(player);

/** Out of nights, out of money, or both. */
export const mustLeave = (stay: HospitalStay, player?: Player): boolean =>
    player ? !canStayAnother(stay, player) : atTheLimit(stay);

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

/** What the next night adds before anybody pads it, so the choice is readable. */
export const nightlyEstimate = (stay: HospitalStay): number => stay.nightly;
