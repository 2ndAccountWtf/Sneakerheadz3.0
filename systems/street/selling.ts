/**
 * Street selling.
 * ===============
 * The negotiation and the risk model for a `StreetBuyer` (the fixed contract
 * in `types/hype.ts`), written in the same shape as `systems/collectors.ts`:
 * pure functions only, no React, nothing here is allowed to write `GameState`
 * directly — `hooks/useGame.ts` is another agent's file, and the one action
 * it needs to add (`RESOLVE_STREET_SALE`) is documented on `resolveSale`
 * below, mirroring `RESOLVE_COLLECTOR_DEAL` exactly.
 *
 * The negotiation itself borrows `systems/collectors.ts`'s shape directly —
 * an opening lowball, a player counter, concession toward a hidden ceiling,
 * a capped round count — but with two differences that come straight from
 * `StreetBuyer` being a stranger you will likely never see again rather than
 * a relationship you're building:
 *
 *   - there is no `relationshipFactor`. A buyer's `offerPct`/`ceilingPct` are
 *     already the whole story (see `systems/street/buyers.ts`), so the band
 *     between them stands in for the same thing standing does for a
 *     collector: how much room there is to move somebody.
 *   - the round cap comes from `StreetBuyer.patience` (roughly one round per
 *     15 seconds they'll stand there) rather than a flat constant, so an
 *     impatient local and a browsing international genuinely haggle
 *     differently, not just at different starting numbers.
 *
 * `resolveSale` is where the risk model actually lives, checked in a fixed
 * order every time a price is agreed (a walked or dead negotiation never
 * reaches it — see `noop` — so nothing is ever at risk unless there was
 * really a deal on the table):
 *
 *   1. **Shutdown.** Heat-driven, not buyer-driven — a patrol car, a shop
 *      owner, somebody who was never a customer. Scales with the player's
 *      *existing* `heat` and the spot's own `heatRate`, and with a hype
 *      event's `heatMultiplier` if one is running. A fake pair caught this
 *      way is confiscated on the spot; a real one just costs you the sale
 *      and the moment.
 *   2. **The buyer's own `danger`.** This specific person was never here to
 *      buy — they grab the pair and go. Independent of heat: a dead-quiet
 *      spot can still hand you a bad buyer.
 *   3. **Fake detection**, off the buyer's `eye`, exactly as instructed.
 *   4. **A real sale** — cash changes hands, heat ticks up a little just for
 *      having done business in public, and if the buyer is a celebrity,
 *      `Player.connections` moves the same way it does after a private sale
 *      in `systems/collectors.ts`.
 *
 * Money only ever moves upward here (a sale pays; nothing in this module
 * ever charges the player anything), and every branch that ends without a
 * deal — walked away, insulted off, shut down, robbed, caught — returns
 * `amount: 0` and never invents a negative number anywhere.
 */
import type { InventoryItem, Player } from '../../types';
import type { OutcomeLogEntry } from '../../types/game';
import type { StreetBuyer, HypeEvent } from '../../types/hype';
import type { SellingSpot } from '../../data/sellingSpots';
import { MAX_HEAT, MAX_ENERGY } from '../../constants';
import { interestedIn } from './buyers';
import { gradeOf, caughtWith } from '../market/authenticity';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// --- Tunables, named so the verification script and this file agree on what they mean. ---
/** How far over trueMax an ask can go before there's a chance it kills the deal outright. */
const INSULT_THRESHOLD = 0.5;
const INSULT_CHANCE_CAP = 0.8;
/** Seconds of patience it takes to earn one more round of haggling. */
const SECONDS_PER_ROUND = 15;

/* ------------------------------------------------------------------ *
 * Arriving at a spot
 * ------------------------------------------------------------------ */

export interface ArriveResult {
    player: Player;
    log: OutcomeLogEntry[];
    ok: boolean;
}

/**
 * Sets up at a spot for the day: checks cred and hours, then spends the
 * energy. Returns the *same* `player` reference, untouched, whenever it
 * refuses — nothing is ever lost by finding a spot closed or out of reach.
 */
export function arriveAtSpot(spot: SellingSpot, player: Player, day: number, isOpen: boolean): ArriveResult {
    if (spot.minCred !== undefined && player.streetCred < spot.minCred) {
        return { player, ok: false, log: [{ icon: '🚫', text: 'You need more of a reputation before this corner takes you seriously.', tone: 'bad' }] };
    }
    if (!isOpen) {
        return { player, ok: false, log: [{ icon: '🚫', text: spot.closedLine ?? 'Closed right now.', tone: 'neutral' }] };
    }
    if (player.energy < spot.energyCost) {
        return { player, ok: false, log: [{ icon: '😴', text: 'Too worn out to post up here today.', tone: 'bad' }] };
    }

    const next = { ...player, energy: clamp(player.energy - spot.energyCost, 0, MAX_ENERGY) };
    return { player: next, ok: true, log: [{ icon: spot.icon, text: `You post up at ${spot.name}.`, tone: 'neutral' }] };
}

/* ------------------------------------------------------------------ *
 * The negotiation
 * ------------------------------------------------------------------ */

export interface StreetOffer {
    by: 'buyer' | 'player';
    amount: number;
}

export interface StreetNegotiation {
    buyer: StreetBuyer;
    item: InventoryItem;
    /** What this exact pair is worth in the city you're standing in. */
    localValue: number;
    history: StreetOffer[];
    currentOffer: number;
    round: number;
    /** Derived once from `buyer.patience` and frozen for the negotiation. */
    maxRounds: number;
    status: 'negotiating' | 'accepted' | 'walked' | 'dead';
    /** The buyer's real ceiling. Secret from the player narratively; plain data here. */
    trueMax: number;
}

/**
 * A buyer's first number. Always below their own `trueMax` (never at or
 * above it — see `systems/collectors.ts` for why that's the whole premise of
 * a negotiation), penalised further if the pair shown isn't what they
 * actually came for.
 */
export function openingOffer(buyer: StreetBuyer, item: InventoryItem, localValue: number): StreetNegotiation {
    const wanted = interestedIn(buyer, item);
    const interestPenalty = wanted ? 1 : 0.65;

    const opening = Math.max(1, Math.round(localValue * buyer.offerPct * interestPenalty));
    const trueMax = Math.max(opening + 1, Math.round(localValue * buyer.ceilingPct * interestPenalty));
    const maxRounds = clamp(Math.round(buyer.patience / SECONDS_PER_ROUND), 2, 6);

    return {
        buyer, item, localValue,
        history: [{ by: 'buyer', amount: opening }],
        currentOffer: opening,
        round: 1,
        maxRounds,
        status: 'negotiating',
        trueMax,
    };
}

/**
 * Readable odds this buyer takes a given ask right now — the number a screen
 * should show, not `trueMax` itself. 1.0 at or under their ceiling; above it,
 * the tolerance band comes from how wide their own offer-to-ceiling spread
 * was to begin with (a buyer willing to move a long way for the right pair
 * tolerates a bold ask better than one who barely had room at all), and
 * narrows every round they've already had to argue.
 */
export function acceptChance(state: StreetNegotiation, ask: number): number {
    if (ask <= state.trueMax) return 1;
    const overshoot = (ask - state.trueMax) / state.trueMax;
    const band = Math.max(0.08, state.buyer.ceilingPct - state.buyer.offerPct);
    const tolerance = (band * 0.9) / (1 + (state.round - 1) * 0.4);
    return clamp(1 - overshoot / tolerance, 0, 1);
}

/**
 * The player's counter-ask, resolved exactly like
 * `systems/collectors.ts#counterOffer`: accepted if the roll clears
 * `acceptChance`, dead if an outrageous ask fails an "insult" check, or a
 * fresh buyer counter that concedes toward `trueMax` and never past it —
 * geometrically convergent by construction, so it cannot loop. Capped at
 * `state.maxRounds` (from the buyer's own patience), past which the deal is
 * forced to a verdict rather than haggled forever.
 */
export function counterOffer(state: StreetNegotiation, ask: number): StreetNegotiation {
    if (state.status !== 'negotiating') return state;

    const history: StreetOffer[] = [...state.history, { by: 'player', amount: ask }];
    const chance = acceptChance(state, ask);

    if (Math.random() < chance) {
        return { ...state, history, currentOffer: ask, round: state.round + 1, status: 'accepted' };
    }

    const overshoot = (ask - state.trueMax) / state.trueMax;
    if (overshoot > INSULT_THRESHOLD) {
        const insultChance = clamp((overshoot - INSULT_THRESHOLD) * 2, 0, INSULT_CHANCE_CAP);
        if (Math.random() < insultChance) {
            return { ...state, history, status: 'dead' };
        }
    }

    if (state.round >= state.maxRounds) {
        const closeEnough = overshoot <= 0.08;
        return closeEnough
            ? { ...state, history, currentOffer: state.trueMax, round: state.round + 1, status: 'accepted' }
            : { ...state, history, status: 'dead' };
    }

    const concessionStep = clamp(0.3 + state.round * 0.12, 0.3, 0.85);
    const nextOffer = Math.round(state.currentOffer + (state.trueMax - state.currentOffer) * concessionStep);
    return {
        ...state,
        history: [...history, { by: 'buyer', amount: nextOffer }],
        currentOffer: nextOffer,
        round: state.round + 1,
        status: 'negotiating',
    };
}

/** Take the number on the table. Always succeeds — it's already their offer. */
export function acceptOffer(state: StreetNegotiation): StreetNegotiation {
    return { ...state, status: 'accepted' };
}

/** Walk. Nothing is at risk once this is called — see `resolveSale`. */
export function walkAway(state: StreetNegotiation): StreetNegotiation {
    return { ...state, status: 'walked' };
}

/* ------------------------------------------------------------------ *
 * Risk model
 * ------------------------------------------------------------------ */

/**
 * Odds this exact encounter gets shut down before it finishes — a patrol
 * car, a shop owner who's had enough, somebody who was never a customer.
 * Driven by the player's *existing* heat (repeated street selling makes
 * every subsequent sale more dangerous, same logic as everywhere else heat
 * gates outcomes), the spot's own `heatRate`, and a hype event's
 * `heatMultiplier` when one is running.
 */
export function shutdownChance(spot: SellingSpot, player: Player, hype: HypeEvent | null = null): number {
    const heatPressure = clamp(player.heat / MAX_HEAT, 0, 1);
    const base = 0.02 + heatPressure * 0.4;
    const spotFactor = 1 + (spot.heatRate - 3) * 0.08;
    const hypeFactor = hype?.heatMultiplier ?? 1;
    return clamp(base * spotFactor * hypeFactor, 0.01, 0.65);
}

/**
 * Heat picked up from one clean, completed sale. `heatRate` is the spot's own
 * eyes-on-you baseline and is weighted heavily on purpose — it's what keeps a
 * quiet, expensive spot (Nakano Broadway, `heatRate` 1) actually quieter than
 * a subway exit (`heatRate` 6) even when the quiet spot's sale happens to be
 * huge; `visibility` only adds a smaller premium for a genuinely large payday
 * on top of that, rather than being allowed to swamp it the way it would at
 * an even weight.
 */
function heatFromSale(spot: SellingSpot, price: number, hype: HypeEvent | null): number {
    const visibility = Math.sqrt(price / 500);
    const hypeFactor = hype?.heatMultiplier ?? 1;
    return Math.max(1, Math.round((spot.heatRate * 1.1 + visibility * 0.6) * hypeFactor));
}

export type StreetSaleResultKind =
    | 'sold'
    | 'walked'
    | 'dead'
    | 'shutdown'
    | 'shutdownBusted'
    | 'robbed'
    | 'caughtFake';

export interface StreetSaleOutcome {
    player: Player;
    log: OutcomeLogEntry[];
    result: StreetSaleResultKind;
    /** Real cash that landed in the player's pocket. 0 unless result is 'sold'. */
    amount: number;
}

/**
 * What he would actually have paid, said out loud once he has gone.
 *
 * `trueMax` has existed since street selling shipped and the player has never
 * been told it. A buyer walked, you learned nothing, and the next haggle was
 * the same coin-toss as the last one. That is the difference between a
 * mechanic you get better at and one you just endure.
 *
 * It is also the cheapest tension in the game. The near-miss — two cherries
 * and a third just past the line — is the single most reliable hook there is,
 * and we were already computing the number and throwing it away. Forty dollars
 * short stings in a way that a blank refusal never does, and it sends you into
 * the next negotiation with an actual opinion.
 *
 * Always revealed, never conditionally. If it only appeared on close calls the
 * player would learn that seeing it means it was close, and the information
 * would stop being information.
 */
export interface NearMiss {
    /** His real ceiling. */
    wouldHavePaid: number;
    /** What you were holding out for. */
    youWanted: number;
    /** The gap. Zero when you were actually under his ceiling. */
    missedBy: number;
    /** True when it was close enough to hurt. */
    agonising: boolean;
}

export function nearMiss(state: StreetNegotiation): NearMiss | null {
    if (state.status !== 'walked' && state.status !== 'dead') return null;
    const youWanted = [...state.history].reverse().find(o => o.by === 'player')?.amount
        ?? state.currentOffer;
    const missedBy = Math.max(0, youWanted - state.trueMax);
    return {
        wouldHavePaid: state.trueMax,
        youWanted,
        missedBy,
        agonising: missedBy > 0 && missedBy <= state.trueMax * 0.15,
    };
}

/** The line the log shows. Deliberately plain: the number does the work. */
export function nearMissLine(miss: NearMiss): string {
    if (miss.missedBy <= 0) {
        return `He had $${miss.wouldHavePaid.toLocaleString()} on him. You never asked for it.`;
    }
    if (miss.agonising) {
        return `He would have gone to $${miss.wouldHavePaid.toLocaleString()}. You were $${miss.missedBy.toLocaleString()} over.`;
    }
    return `He was never going past $${miss.wouldHavePaid.toLocaleString()}.`;
}

const noop = (player: Player, result: StreetSaleResultKind, text: string): StreetSaleOutcome => ({
    player,
    log: [{ icon: '🚶', text, tone: 'neutral' }],
    result,
    amount: 0,
});

/**
 * Runs the actual sale. Only ever touches the player when a price was agreed
 * — a walked-away or collapsed negotiation is a pure no-op returning the same
 * `player` reference, so nothing is ever at risk unless there was really a
 * deal to execute. This is the one function the reducer needs to wire up —
 * see the module doc for the exact action shape.
 */
export function resolveSale(
    state: StreetNegotiation,
    player: Player,
    spot: SellingSpot,
    day: number,
    hype: HypeEvent | null = null,
): StreetSaleOutcome {
    // A dead deal now tells you what it was worth. See `nearMiss`.
    if (state.status === 'walked' || state.status === 'dead') {
        const kind: StreetSaleResultKind = state.status;
        const text = state.status === 'walked'
            ? `"Whatever." ${state.buyer.name} is already looking past you.`
            : `"Yeah, no." ${state.buyer.name} walks off, unimpressed.`;
        const out = noop(player, kind, text);
        const miss = nearMiss(state);
        if (miss) {
            out.log.push({
                icon: miss.agonising ? '😖' : '💭',
                text: nearMissLine(miss),
                tone: miss.agonising ? 'bad' : 'neutral',
            });
        }
        return out;
    }

    const { buyer, item } = state;
    const price = state.currentOffer;
    const log: OutcomeLogEntry[] = [];

    // --- 1. Shut down before it finishes — heat, not this buyer, did it. ---
    if (Math.random() < shutdownChance(spot, player, hype)) {
        if (item.isFake) {
            const busted: Player = {
                ...player,
                inventory: player.inventory.filter(i => i.instanceId !== item.instanceId),
                heat: clamp(player.heat + 20, 0, MAX_HEAT),
                streetCred: Math.max(0, player.streetCred - 8),
            };
            log.push({ icon: '🚔', text: 'A patrol slows down, takes one look at the pair, and it\'s evidence now.', tone: 'bad' });
            log.push({ icon: '📉', text: 'Word gets around. Street cred takes a hit.', tone: 'bad' });
            return { player: busted, log, result: 'shutdownBusted', amount: 0 };
        }
        const interrupted: Player = { ...player, heat: clamp(player.heat + 10, 0, MAX_HEAT) };
        log.push({ icon: '🚨', text: `A patrol car slows down. ${buyer.name} is gone before it even stops.`, tone: 'bad' });
        return { player: interrupted, log, result: 'shutdown', amount: 0 };
    }

    // --- 2. This particular buyer was never here to buy. ---
    if (Math.random() < buyer.danger) {
        const withoutItem: Player = {
            ...player,
            inventory: player.inventory.filter(i => i.instanceId !== item.instanceId),
            heat: clamp(player.heat + 6, 0, MAX_HEAT),
            stats: { ...player.stats, timesRobbed: player.stats.timesRobbed + 1 },
        };
        log.push({ icon: '🏃', text: `${buyer.name} grabs the pair and is gone before you can react.`, tone: 'bad' });
        return { player: withoutItem, log, result: 'robbed', amount: 0 };
    }

    // --- 3. Do they clock the fake before paying for it? ---
    // A street buyer is not a counter with a policy — he is one man deciding
    // whether to turn the shoe over in his hands. His `eye` says how good he is
    // at it; how often he bothers scales with the same eye, because someone who
    // knows what to look for is someone who looks. See `docs/TRUST.md`.
    if (caughtWith(
        item,
        { securityLevel: buyer.eye * 2, heat: player.heat },
        buyer.eye,
    )) {
        const flagged: Player = {
            ...player,
            heat: clamp(player.heat + 8, 0, MAX_HEAT),
            streetCred: Math.max(0, player.streetCred - 3),
        };
        log.push({ icon: '👀', text: `"...this isn't real." ${buyer.name} backs off loudly enough that people look over.`, tone: 'bad' });
        return { player: flagged, log, result: 'caughtFake', amount: 0 };
    }

    // --- 4. A real sale. ---
    const soldOut = { ...player, inventory: player.inventory.filter(i => i.instanceId !== item.instanceId) };
    const heatGain = heatFromSale(spot, price, hype);
    const credGain = item.isFake ? 0 : Math.min(6, 1 + Math.round(price / 2000));

    let settled: Player = {
        ...soldOut,
        cash: soldOut.cash + price,
        heat: clamp(soldOut.heat + heatGain, 0, MAX_HEAT),
        streetCred: soldOut.streetCred + credGain,
        stats: {
            ...soldOut.stats,
            totalProfit: soldOut.stats.totalProfit + (price - item.purchasePrice),
            sneakersSold: soldOut.stats.sneakersSold + 1,
        },
    };
    log.push({ icon: '💵', text: `Paid on the spot. $${price.toLocaleString()}.`, tone: 'good' });

    // A celebrity sale builds standing exactly the way a private sale does in
    // systems/collectors.ts — the whole reason street selling shares
    // Player.connections with that channel at all.
    if (buyer.kind === 'celebrity' && buyer.npcId) {
        const conn = player.connections[buyer.npcId] ?? {
            npcId: buyer.npcId, standing: 0, deals: 0, burnedYou: false, youBurnedThem: false, lastDealDay: 0,
        };
        settled = {
            ...settled,
            connections: {
                ...settled.connections,
                [buyer.npcId]: {
                    ...conn,
                    standing: clamp(conn.standing + 8, -100, 100),
                    deals: conn.deals + 1,
                    lastDealDay: day,
                },
            },
        };
        log.push({ icon: '🤝', text: `${buyer.name} remembers this. Standing improves.`, tone: 'good' });
    }

    return { player: settled, log, result: 'sold', amount: price };
}
