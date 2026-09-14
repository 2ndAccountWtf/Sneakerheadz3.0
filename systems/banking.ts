/**
 * Banking
 * =======
 * Cash is cheap and fast and gets you robbed. A card is safe and slow and
 * leaves you helpless the day it's blocked. Every function in this module
 * exists to make that trade real rather than cosmetic:
 *
 *  - deposit/withdraw move money between the two pools your day-to-day
 *    spending draws from (cash: robbable, spendable at a discount; bank:
 *    safe, useless until you queue at a machine).
 *  - chargeToCredit/repayCredit/accrueInterest run the "buy now, regret it
 *    compounding daily" line separately from either pool.
 *  - blockCard/cardUsable model the card itself as a resource that can be
 *    taken away — by a skimmer, a mugger, a bar, or bad luck — independent
 *    of how much money is actually on either side of it.
 *  - robberyExposure/muggingLoss are the other half of the cash side: they
 *    don't move anything themselves, they just answer "how likely, and how
 *    much" for whatever travel event or encounter wants to ask.
 *
 * Pure functions only, no React, no reducer — this module never touches
 * `GameState`, only `Player`, the same discipline `outcomeEngine.ts` and
 * `digestion/emergency.ts` follow so the reducer stays the single writer of
 * game state and this stays trivially testable.
 */
import type { Player } from '../types';
import type { OutcomeLogEntry } from '../types/game';
import type { Bank } from '../data/banks';
import { CREDIT_DAILY_INTEREST, ROBBERY_CASH_FLOOR, STARTING_CREDIT_LIMIT } from '../constants';

export interface BankResult {
    player: Player;
    log: OutcomeLogEntry[];
    ok: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Money is tracked to the cent so daily compounding doesn't drift. */
const round2 = (v: number) => Math.round(v * 100) / 100;

const noop = (player: Player): BankResult => ({ player, log: [], ok: false });

// --------------------------------------------------------------------------
// Cash <-> bank
// --------------------------------------------------------------------------

/** Moves cash into the bank, where muggers can't reach it. */
export function deposit(player: Player, amount: number): BankResult {
    const drop = Math.floor(amount);
    if (drop <= 0) {
        return { player, ok: false, log: [{ icon: '🏦', text: 'Enter an amount above zero.', tone: 'neutral' }] };
    }
    if (drop > player.cash) {
        return { player, ok: false, log: [{ icon: '🏦', text: `You only have $${player.cash.toLocaleString()} on you.`, tone: 'bad' }] };
    }
    return {
        player: { ...player, cash: player.cash - drop, bank: player.bank + drop },
        log: [{ icon: '🏦', text: `Deposited $${drop.toLocaleString()}. Safe from muggers, useless in a back alley.`, tone: 'good' }],
        ok: true,
    };
}

/** Reads how much has already come out of one bank/ATM today, from `player.flags`. */
const withdrawKey = (bankId: string, day: number) => `bank:withdrawn:${bankId}:${day}`;
export const withdrawnToday = (player: Player, bankId: string, day: number): number =>
    Number(player.flags[withdrawKey(bankId, day)] ?? 0);

/**
 * Pulls cash out at a given branch or ATM. Blocked cards can still work a
 * teller at a branch (they check your face, not the card) but are refused
 * outright at any ATM — which is the entire reason a blocked card matters.
 *
 * A sketchy ATM that skims you still pays out; the cost lands a moment
 * later as a blocked card, which is the point of the thing being sketchy.
 */
export function withdraw(player: Player, amount: number, atm: Bank, day: number): BankResult {
    const want = Math.floor(amount);
    if (want <= 0) {
        return { player, ok: false, log: [{ icon: '🏧', text: 'Enter an amount above zero.', tone: 'neutral' }] };
    }
    if (atm.kind !== 'branch' && !cardUsable(player, day)) {
        return {
            player, ok: false,
            log: [{ icon: '🚫', text: `Card declined — ${player.wallet.cardBlockedReason ?? 'it is blocked'}.`, tone: 'bad' }],
        };
    }

    const already = withdrawnToday(player, atm.id, day);
    const room = atm.dailyLimit - already;
    if (room <= 0) {
        return { player, ok: false, log: [{ icon: '🏧', text: `Daily limit already used up at ${atm.name}.`, tone: 'bad' }] };
    }

    const draw = Math.min(want, room);
    const total = draw + atm.fee;
    if (total > player.bank) {
        return {
            player, ok: false,
            log: [{ icon: '🏦', text: `Not enough in the bank to cover $${draw.toLocaleString()} plus the $${atm.fee} fee.`, tone: 'bad' }],
        };
    }

    let next: Player = {
        ...player,
        bank: player.bank - total,
        cash: player.cash + draw,
        flags: { ...player.flags, [withdrawKey(atm.id, day)]: already + draw },
    };

    const log: OutcomeLogEntry[] = [{
        icon: '🏧',
        text: `Withdrew $${draw.toLocaleString()}${atm.fee ? ` (-$${atm.fee} fee)` : ''} at ${atm.name}.`,
        tone: 'good',
    }];
    if (draw < want) {
        log.push({ icon: '⚠️', text: `Daily limit reached — couldn't draw the full $${want.toLocaleString()}.`, tone: 'neutral' });
    }

    if (atm.kind === 'sketchy-atm' && atm.skimRisk && Math.random() < atm.skimRisk) {
        const days = 2 + Math.floor(Math.random() * 2); // 2-3 days, discovered a beat later
        next = blockCard(next, day, `Card skimmed at ${atm.name}. The bank froze it pending a fraud review.`, days);
        log.push({ icon: '💳', text: `Something about that machine felt wrong. Your card is BLOCKED until day ${day + days}.`, tone: 'bad' });
    }

    return { player: next, log, ok: true };
}

// --------------------------------------------------------------------------
// Credit
// --------------------------------------------------------------------------

/**
 * Opens the credit line at `STARTING_CREDIT_LIMIT`. `INITIAL_PLAYER` starts
 * with `hasCredit: false` and `creditLimit: 0` — nobody is born with a line
 * of credit — so this is the one-time step that makes `chargeToCredit` mean
 * anything at all. Refuses to open a second line over an existing one.
 */
export function openCreditLine(player: Player): BankResult {
    if (player.wallet.hasCredit) {
        return { player, ok: false, log: [{ icon: '💳', text: 'Already have a line open.', tone: 'neutral' }] };
    }
    return {
        player: { ...player, wallet: { ...player.wallet, hasCredit: true, creditLimit: STARTING_CREDIT_LIMIT } },
        log: [{ icon: '💳', text: `Approved for a $${STARTING_CREDIT_LIMIT.toLocaleString()} credit line.`, tone: 'good' }],
        ok: true,
    };
}

/**
 * Puts a charge on the card. This only ever moves `wallet.creditOwed` — it's
 * the payment primitive a purchase flow reaches for instead of spending
 * cash, so it never touches `cash` itself. Refuses anything that would push
 * the balance over the limit; that refusal *is* the "getting over your
 * limit should hurt" rule; interest can still push you over it later (see
 * `accrueInterest`), which hurts in a different way.
 */
export function chargeToCredit(player: Player, amount: number): BankResult {
    const charge = Math.floor(amount);
    if (charge <= 0) return noop(player);
    if (!player.wallet.hasCredit) {
        return { player, ok: false, log: [{ icon: '💳', text: 'No credit line on this card.', tone: 'bad' }] };
    }
    const owed = round2(player.wallet.creditOwed + charge);
    if (owed > player.wallet.creditLimit) {
        return {
            player, ok: false,
            log: [{ icon: '💳', text: `That would put you over your $${player.wallet.creditLimit.toLocaleString()} limit. Declined.`, tone: 'bad' }],
        };
    }
    return {
        player: { ...player, wallet: { ...player.wallet, creditOwed: owed } },
        log: [{ icon: '💳', text: `Charged $${charge.toLocaleString()} to the card. Now owe $${owed.toLocaleString()}.`, tone: 'neutral' }],
        ok: true,
    };
}

/** Bump for paying the balance to exactly zero. Small, but it compounds like everything else here. */
const CLEAN_PAYOFF_RAISE_RATE = 0.1;
const CLEAN_PAYOFF_MIN_RAISE = 100;
/** Flat sting for letting interest carry you over your own limit. */
const OVER_LIMIT_FEE = 25;

/** Pays cash down against the credit balance. Paying it to exactly zero raises the limit. */
export function repayCredit(player: Player, amount: number): BankResult {
    const offered = Math.floor(amount);
    if (offered <= 0 || player.wallet.creditOwed <= 0) return noop(player);

    const pay = Math.min(offered, player.wallet.creditOwed, player.cash);
    if (pay <= 0) {
        return { player, ok: false, log: [{ icon: '💳', text: 'Not enough cash on hand to pay any of it down.', tone: 'bad' }] };
    }

    const owed = round2(player.wallet.creditOwed - pay);
    const log: OutcomeLogEntry[] = [{ icon: '💳', text: `Paid $${pay.toLocaleString()} toward the card. Owe $${owed.toLocaleString()}.`, tone: 'good' }];

    let creditLimit = player.wallet.creditLimit;
    if (owed === 0) {
        creditLimit += Math.max(CLEAN_PAYOFF_MIN_RAISE, Math.round(creditLimit * CLEAN_PAYOFF_RAISE_RATE));
        log.push({ icon: '📈', text: `Paid off clean. Credit limit raised to $${creditLimit.toLocaleString()}.`, tone: 'good' });
    }

    return {
        player: { ...player, cash: player.cash - pay, wallet: { ...player.wallet, creditOwed: owed, creditLimit } },
        log,
        ok: true,
    };
}

/** Called once per day advance. Compounds whatever is owed, and stings extra if that pushes you over the limit. */
export function accrueInterest(player: Player): BankResult {
    const { creditOwed, creditLimit } = player.wallet;
    if (creditOwed <= 0) return { player, ok: true, log: [] };

    const interest = round2(creditOwed * CREDIT_DAILY_INTEREST);
    let owed = round2(creditOwed + interest);
    const log: OutcomeLogEntry[] = [{
        icon: '📈',
        text: `Card interest: +$${interest.toFixed(2)} (now owe $${owed.toFixed(2)}).`,
        tone: 'bad',
    }];

    const wasUnder = creditOwed <= creditLimit;
    if (owed > creditLimit && wasUnder) {
        owed = round2(owed + OVER_LIMIT_FEE);
        log.push({ icon: '🚨', text: `Interest pushed you over your $${creditLimit.toLocaleString()} limit — a $${OVER_LIMIT_FEE} over-limit fee lands too.`, tone: 'bad' });
    }

    return { player: { ...player, wallet: { ...player.wallet, creditOwed: owed } }, log, ok: true };
}

// --------------------------------------------------------------------------
// The card itself
// --------------------------------------------------------------------------

/** Blocks the card until `day + days`. Callers own the reason text shown to the player. */
export function blockCard(player: Player, day: number, reason: string, days: number): Player {
    return {
        ...player,
        wallet: {
            ...player.wallet,
            cardBlockedUntilDay: day + Math.max(1, Math.floor(days)),
            cardBlockedReason: reason,
        },
    };
}

/** Whether the card can be used *today*. False if there was never a card, or the block hasn't cleared. */
export function cardUsable(player: Player, day: number): boolean {
    if (!player.wallet.hasCard) return false;
    const until = player.wallet.cardBlockedUntilDay;
    return until === undefined || day >= until;
}

// --------------------------------------------------------------------------
// Card-loss events
// --------------------------------------------------------------------------

/** What can take the card out of play, and for how long. Flavour text does the work. */
export interface CardLossEvent {
    id: string;
    trigger: 'random' | 'drunk' | 'mugging' | 'bathroom';
    /** Becomes `wallet.cardBlockedReason`. */
    reason: string;
    /** Logged the moment it happens. */
    line: string;
    days: number;
}

export const CARD_LOSS_EVENTS: CardLossEvent[] = [
    // --- Bad luck: no cause needed, just a day where the world wins. ---
    {
        id: 'card-lost-jacket',
        trigger: 'random',
        reason: 'Left the card in a jacket you no longer have.',
        line: 'You go to pay and realise the card is in a jacket you gave away, sold, or otherwise no longer own.',
        days: 2,
    },
    {
        id: 'card-eaten-machine',
        trigger: 'random',
        reason: 'A machine ate it and kept it.',
        line: 'The machine takes the card, thinks about it for a long moment, and keeps it.',
        days: 3,
    },
    {
        id: 'card-demagnetized',
        trigger: 'random',
        reason: 'The strip died. Nobody knows why. Nobody ever does.',
        line: 'The strip is dead. The clerk swipes it four more times out of professional courtesy, then gives up.',
        days: 1,
    },

    // --- Drunk: rolled by whatever mini-game or venue tracks a drunk counter. ---
    {
        id: 'card-bought-round',
        trigger: 'drunk',
        reason: 'You "bought a round" on it and cannot say for whom.',
        line: 'Somewhere around the fourth round you handed the card to a bartender and stopped tracking it.',
        days: 2,
    },
    {
        id: 'card-lost-bar',
        trigger: 'drunk',
        reason: 'Left it at the bar. The bar swears it never saw it.',
        line: 'You definitely had it walking in. The bar, with real conviction, disagrees.',
        days: 3,
    },
    {
        id: 'card-taxi-seat',
        trigger: 'drunk',
        reason: 'Left it in the back seat of a taxi you cannot describe.',
        line: 'The taxi. Which taxi. You genuinely do not know, and the card went with it.',
        days: 2,
    },

    // --- Mugging: the card, not just the cash, goes with the assailant. ---
    {
        id: 'card-taken-mugging',
        trigger: 'mugging',
        reason: 'Taken along with everything else in your wallet.',
        line: 'He does not stop at the cash. The card goes too.',
        days: 3,
    },
    {
        id: 'card-tossed-mugging',
        trigger: 'mugging',
        reason: 'Thrown in a storm drain so you cannot use it before he does.',
        line: 'He pockets the cash and drops the card down a storm drain, on principle.',
        days: 4,
    },

    // --- Bathroom: the emergency did not care what was in your pockets. ---
    {
        id: 'card-bathroom-floor',
        trigger: 'bathroom',
        reason: 'It came out of your pocket somewhere you are not going back to check.',
        line: 'Something came out of your pocket in there. You are choosing not to look for it.',
        days: 2,
    },
    {
        id: 'card-bathroom-soaked',
        trigger: 'bathroom',
        reason: 'It went through the wash, so to speak, and no longer reads.',
        line: 'The card takes a bath it did not ask for. It no longer reads at anything.',
        days: 1,
    },
];

/** Rolls one flavoured event for the given trigger. The caller decides *when* to roll. */
export function rollCardLossEvent(trigger: CardLossEvent['trigger']): CardLossEvent | undefined {
    const pool = CARD_LOSS_EVENTS.filter(e => e.trigger === trigger);
    if (!pool.length) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
}

// --------------------------------------------------------------------------
// Robbery
// --------------------------------------------------------------------------

/**
 * How likely a mugging is to actually target you, given what you're
 * carrying. A little pocket money is beneath notice; a wad of it makes you
 * a mark. Monotonic in cash on hand, capped well short of certainty so
 * there is always a chance to walk away clean.
 */
export function robberyExposure(player: Player): number {
    const cash = Math.max(0, player.cash);
    if (cash <= 0) return 0;

    const BASE = 0.02;               // some risk exists even with a little on you
    const UNDER_FLOOR_SLOPE = 0.05;  // gentle climb up to the floor
    const OVER_FLOOR_SLOPE = 0.16;   // steep climb once you're visibly loaded
    const CAP = 0.85;                // never a certainty

    const overFloor = Math.max(0, cash - ROBBERY_CASH_FLOOR);
    const exposure = BASE
        + (cash / ROBBERY_CASH_FLOOR) * UNDER_FLOOR_SLOPE
        + (overFloor / ROBBERY_CASH_FLOOR) * OVER_FLOOR_SLOPE;

    return clamp(exposure, 0, CAP);
}

/**
 * What a mugger actually gets: a random cut of the cash in your pocket,
 * never a cent of what's banked or on credit, and never more than you
 * are carrying.
 */
export function muggingLoss(player: Player): number {
    const cash = Math.max(0, player.cash);
    if (cash <= 0) return 0;
    const fraction = 0.4 + Math.random() * 0.5; // 40%-90% of what's on you
    return Math.min(cash, Math.round(cash * fraction));
}

/* ------------------------------------------------------------------ *
 * Skimming
 * ------------------------------------------------------------------ */

/**
 * The bank was the one safe place, and that was a problem.
 *
 * Cash gets robbed and gets you shaken down; the card only ever got *lost*
 * (see `CARD_LOSS_EVENTS`) — an availability problem for a day or two, never a
 * balance problem. Once the police stop started leaving banked money alone,
 * the mathematically correct play became bank everything the moment you have
 * it and never think about it again. A store of value with no downside is not
 * a decision, it is a formality.
 *
 * So a card can be skimmed. Somebody put a reader on the machine in the back
 * of the pachinko parlour, and you find out later. It takes a slice of the
 * balance rather than the balance: a wipe would just teach players never to
 * bank, which replaces one dominant strategy with another.
 *
 * The slice is 1-26%, which is deliberately wide. A 1% skim is an annoyance
 * and a 26% skim on a big balance is the worst thing that happens all week,
 * and not knowing which you are getting is the entire point — the same
 * variable-ratio shape as everything else worth playing here.
 */
export const SKIM_MIN_FRACTION = 0.01;
export const SKIM_MAX_FRACTION = 0.26;

/** Balances below this are not worth anybody's trouble. */
export const SKIM_FLOOR = 250;

export interface SkimResult {
    /** Money taken. Zero when the balance was not worth skimming. */
    amount: number;
    fraction: number;
    line: string;
}

const SKIM_LINES = [
    'A machine you used three days ago had a reader taped inside it.',
    'Somebody has been buying electronics in a city you have never visited.',
    'The bank calls it "unusual activity". You call it a specific amount of money.',
    'Two withdrawals, four minutes apart, from a machine you were nowhere near.',
    'A card reader in the back of a pachinko parlour got a good look at you.',
];

/**
 * Take a slice. Pure — hand it the balance and a roll, get back what was lost.
 * Returns a zero result for a balance not worth the effort, so callers do not
 * need to special-case a skim that stole four dollars.
 */
export function skimCard(bank: number, rng: () => number): SkimResult {
    if (bank < SKIM_FLOOR) return { amount: 0, fraction: 0, line: '' };
    const fraction = SKIM_MIN_FRACTION + rng() * (SKIM_MAX_FRACTION - SKIM_MIN_FRACTION);
    const amount = Math.max(1, Math.round(bank * fraction));
    return {
        amount,
        fraction,
        line: SKIM_LINES[Math.floor(rng() * SKIM_LINES.length)],
    };
}
