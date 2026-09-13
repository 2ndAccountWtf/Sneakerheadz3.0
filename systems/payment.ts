/**
 * How you pay for things.
 *
 * The bank screen has been promising the player a cash discount and a card
 * surcharge since it shipped, and nothing implemented either: every purchase
 * took the sticker price out of `cash`, the credit line could be opened and
 * then never spent, and `chargeToCredit` had no caller. That made the entire
 * bank a decoration — deposits with no reason to make them, a card with no
 * reason to carry it.
 *
 * This is the piece that closes the loop, and it is deliberately a fork with
 * teeth on both sides:
 *
 *   **Cash** is cheaper, because a shop taking cash is a shop not paying a
 *   processor and not writing anything down. The price of that discount is that
 *   you have to be carrying the cash, and cash on you is what gets taken off
 *   you on the street (`systems/events/streetRobbery.ts`).
 *
 *   **Card** costs a few percent more and does not need you to be carrying
 *   anything — but it is debt at six percent a day, it can be declined at the
 *   limit, and it can be face-down in a bathroom you did not reach in time.
 *
 * Neither is correct. That is the mechanic.
 */
import type { Player } from '../types';
import type { OutcomeLogEntry } from '../types/game';
import { CASH_DISCOUNT, CARD_SURCHARGE } from '../constants';
import { chargeToCredit, cardUsable } from './banking';

export type PaymentMethod = 'cash' | 'card';

/** What this method actually costs, for a given sticker price. */
export const priceFor = (sticker: number, method: PaymentMethod): number =>
    Math.max(1, Math.round(sticker * (method === 'cash' ? CASH_DISCOUNT : CARD_SURCHARGE)));

export interface PaymentResult {
    ok: boolean;
    player: Player;
    /** What was actually charged. Zero on a refusal. */
    paid: number;
    log: OutcomeLogEntry[];
}

/**
 * Whether this method is available at all right now, and why not if it isn't.
 *
 * Separated from `pay` so the UI can grey out a button and *say the reason* on
 * the card rather than letting the player press it and receive a refusal. A
 * declined card the player could have predicted is a bug in the screen, not a
 * mechanic.
 */
export function paymentBlocked(
    player: Player,
    method: PaymentMethod,
    total: number,
    day: number,
): string | null {
    if (method === 'cash') {
        return player.cash >= total ? null : 'Not enough cash on you.';
    }
    if (!player.wallet.hasCard) return 'You do not have a card.';
    if (!cardUsable(player, day)) {
        return player.wallet.cardBlockedReason ?? 'The card is not working right now.';
    }
    if (!player.wallet.hasCredit) return 'No credit line on the card — open one at the bank.';
    if (player.wallet.creditOwed + total > player.wallet.creditLimit) {
        return `Over your $${player.wallet.creditLimit.toLocaleString()} limit.`;
    }
    return null;
}

/**
 * Takes the money. Returns the player unchanged with `ok: false` when it
 * cannot, so a caller can treat a refusal exactly like a failed purchase and
 * never has to unwind a half-applied transaction.
 */
export function pay(
    player: Player,
    method: PaymentMethod,
    total: number,
    day: number,
): PaymentResult {
    const blocked = paymentBlocked(player, method, total, day);
    if (blocked) {
        return { ok: false, player, paid: 0, log: [{ icon: method === 'cash' ? '💵' : '💳', text: blocked, tone: 'bad' }] };
    }

    if (method === 'cash') {
        return {
            ok: true,
            player: { ...player, cash: player.cash - total },
            paid: total,
            log: [],
        };
    }

    const charged = chargeToCredit(player, total);
    // `paymentBlocked` already ruled out every refusal `chargeToCredit` can
    // return, so this branch means the two disagree — which is worth failing
    // loudly rather than silently handing over goods for free.
    if (!charged.ok) {
        return { ok: false, player, paid: 0, log: charged.log };
    }
    return { ok: true, player: charged.player, paid: total, log: charged.log };
}

/** For the UI: "pay cash and save $84" / "on the card, +$31". */
export function priceDelta(sticker: number, quantity = 1): { cash: number; card: number; saving: number } {
    const cash = priceFor(sticker, 'cash') * quantity;
    const card = priceFor(sticker, 'card') * quantity;
    return { cash, card, saving: card - cash };
}
