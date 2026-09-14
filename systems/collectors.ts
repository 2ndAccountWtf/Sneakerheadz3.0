/**
 * Private sales.
 * ===============
 * A shop pays the listed price and nothing can go wrong. A collector pays
 * more — sometimes a lot more — because there is no receipt, no security
 * camera, and no guarantee either side is who they say they are. This module
 * is the whole mechanism behind that trade: who's buying, what they'll open
 * with, how the haggling actually moves, and what can happen once a price is
 * agreed and you actually show up.
 *
 * Pure functions only, same house rule as `systems/opponents.ts` and
 * `systems/digestion/emergency.ts` — the reducer in `hooks/useGame.ts` is the
 * only thing allowed to write `GameState`. Everything here takes a `Player`
 * (and friends) in and hands a new one back, plus a receipt.
 *
 * ---------------------------------------------------------------------------
 * THE RELATIONSHIP NUMBER
 * ---------------------------------------------------------------------------
 * Almost everything below is driven by one derived value, `relationshipFactor`,
 * folding `Connection.standing` (-100..100) and `Connection.deals` together
 * into a single -1..1 score. Standing carries roughly 2.3x the weight of deal
 * count because standing is the only one of the two that can go *negative* —
 * a collector who actively dislikes you is a different (and worse) situation
 * than one you simply haven't done business with yet, and the maths should
 * reflect that asymmetry rather than only ever reward you for volume.
 *
 * ---------------------------------------------------------------------------
 * THE NEGOTIATION
 * ---------------------------------------------------------------------------
 * A collector's opening offer is always a lowball — literally always below
 * their own secret ceiling for this particular deal (`trueMax`), even at
 * perfect standing — because the opening number being a lowball is the
 * entire premise of a negotiation. How far below scales with the
 * relationship: a stranger opens near their absolute floor, a trusted
 * regular opens much closer to (but still under) what they'd actually pay.
 *
 * The player counters with an ask. Whether that ask is accepted is not a
 * coin flip *from the player's point of view* — `acceptChance` is exported so
 * the screen can show a real, readable number before committing ("they'll
 * probably take that" vs "that's a stretch"), even though the collector's
 * exact `trueMax` stays hidden. Asking for wildly more than they'd ever pay
 * risks the whole meeting collapsing outright (the "insult" check) rather
 * than just another round of haggling — a real negotiation has a way to lose
 * by pushing too hard, not just a way to take too long.
 *
 * Negotiation is capped at `MAX_ROUNDS`. A collector's counter always moves
 * *toward their own true ceiling*, never toward the player's ask beyond it,
 * so the sequence is geometrically convergent by construction — it cannot
 * cycle. If the cap is hit without agreement the deal is forced to a verdict
 * (accept if the last gap was small, otherwise the meeting ends) so the
 * player is never stuck haggling forever.
 *
 * ---------------------------------------------------------------------------
 * THE RISK
 * ---------------------------------------------------------------------------
 * Once a price is agreed, `resolveDeal` runs the actual meet, in order:
 *   1. Robbery — scales up with the deal's cash value and down with standing.
 *   2. Your fake gets checked — scales with the collector's `eye`.
 *   3. Their cash gets checked — scales with the collector's `trust`, with a
 *      player-side skill check (focus + street cred) to catch it live.
 * Walking away never reaches this function with anything to lose — a walked
 * or dead negotiation resolves to a no-op receipt, so the item is never at
 * risk unless a price was actually agreed.
 */
import type { Player, InventoryItem } from '../types';
import type { OutcomeLogEntry } from '../types/game';
import { SNEAKERS } from '../data/sneakers';
import { COLLECTORS, type Collector } from '../data/collectors';
import { MAX_HEAT } from '../constants';
import { spotChance, gradeOf } from './market/authenticity';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const round = (n: number) => Math.round(n);

// --- Tunables, named so the verification script and this file agree on what they mean. ---
const MAX_ROUNDS = 6;
/** How far over trueMax an ask can go before there's a chance it kills the deal outright. */
const INSULT_THRESHOLD = 0.5;
/** Ceiling on how angry an outrageous ask can make the insult check. */
const INSULT_CHANCE_CAP = 0.85;
/** How many completed deals it takes before deal-count stops helping (diminishing, not infinite). */
const DEALS_SOFT_CAP = 20;

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

/** Current standing with an npc, or 0 for someone never dealt with. */
export function standingWith(player: Player, npcId: string): number {
    return player.connections[npcId]?.standing ?? 0;
}

/**
 * The one number almost everything else is built on. -1 (they resent you and
 * have never done business with you) to 1 (loyal regular, long history).
 * See the module comment for why standing outweighs deal count.
 */
export function relationshipFactor(player: Player, npcId: string): number {
    const conn = player.connections[npcId];
    const standing = clamp(conn?.standing ?? 0, -100, 100) / 100;      // -1..1
    const deals = Math.min(conn?.deals ?? 0, DEALS_SOFT_CAP) / DEALS_SOFT_CAP; // 0..1
    return clamp(standing * 0.7 + deals * 0.3, -1, 1);
}

function getConnection(player: Player, npcId: string) {
    return player.connections[npcId] ?? { npcId, standing: 0, deals: 0, burnedYou: false, youBurnedThem: false, lastDealDay: 0 };
}

/** Applies a standing/deals/flag delta to one connection, immutably. */
function patchConnection(
    player: Player,
    npcId: string,
    patch: Partial<{ standing: number; deals: number; burnedYou: boolean; youBurnedThem: boolean; lastDealDay: number }>,
): Player {
    const current = getConnection(player, npcId);
    const next = {
        ...current,
        ...patch,
        standing: patch.standing !== undefined ? clamp(patch.standing, -100, 100) : current.standing,
    };
    return { ...player, connections: { ...player.connections, [npcId]: next } };
}

// ---------------------------------------------------------------------------
// Who's available, and what they want
// ---------------------------------------------------------------------------

/**
 * Collectors present in this city, given who the player is right now.
 * Filters out anyone gated by street cred, and anyone who caught you passing
 * a fake — that relationship is over, not on a cooldown. It is the one piece
 * of real, permanent consequence `burnedYou` carries.
 */
export function collectorsIn(cityId: string, player: Player): Collector[] {
    return COLLECTORS.filter(c => {
        if (!c.cities.includes(cityId)) return false;
        if (c.minCred !== undefined && player.streetCred < c.minCred) return false;
        if (player.connections[c.npcId]?.burnedYou) return false;
        return true;
    });
}

/** Does this collector actually want this pair, beyond a courtesy lowball? */
export function interestedIn(collector: Collector, item: InventoryItem): boolean {
    const sneaker = SNEAKERS.find(s => s.id === item.sneakerId);
    if (!sneaker) return false;
    if (collector.wantsModels?.includes(item.sneakerId)) return true;
    return collector.wantsRarities.includes(sneaker.rarity);
}

// ---------------------------------------------------------------------------
// Negotiation
// ---------------------------------------------------------------------------

export interface Offer {
    /** Who made it: the collector's opening/counter, or the player's ask. */
    by: 'collector' | 'player';
    amount: number;
}

export interface NegotiationState {
    collector: Collector;
    item: InventoryItem;
    marketPrice: number;
    /** Every offer made, in order, opening offer first. */
    history: Offer[];
    /** The number currently on the table. */
    currentOffer: number;
    round: number;
    status: 'negotiating' | 'accepted' | 'walked' | 'dead';
    /**
     * The collector's real ceiling for this specific deal. Secret from the
     * player narratively, but plain data here — screens should surface
     * `acceptChance`, not this number, to keep the odds readable rather than
     * the haggling solved.
     */
    trueMax: number;
    /** relationshipFactor at the moment the negotiation opened, frozen for its duration. */
    rel: number;
}

/** Fraction of the way from openMultiplier to ceilingMultiplier, given relationship -1..1. */
function lerp(lo: number, hi: number, t01: number) {
    return lo + (hi - lo) * clamp(t01, 0, 1);
}

/**
 * A collector's first number. Always a lowball relative to their own
 * `trueMax` for this deal — see module comment — with the gap narrowing as
 * relationship improves. An item outside what they collect gets penalised
 * before any of this: they'll still make an offer, just a worse one.
 */
export function openingOffer(collector: Collector, item: InventoryItem, marketPrice: number, player: Player): NegotiationState {
    const rel = relationshipFactor(player, collector.npcId);
    const wanted = interestedIn(collector, item);
    const band = collector.ceilingMultiplier - collector.openMultiplier;

    // Opening sits 0%-40% of the way up the band as relationship goes -1..1.
    const openFrac = lerp(0, 0.4, (rel + 1) / 2);
    // Their real ceiling sits 55%-100% of the way up the band as relationship goes -1..1 —
    // always meaningfully above the opening, so there is always room to haggle.
    const maxFrac = lerp(0.55, 1.0, (rel + 1) / 2);

    const interestPenalty = wanted ? 1 : 0.6; // they'll still buy, just less enthusiastically
    const openMult = (collector.openMultiplier + band * openFrac) * interestPenalty;
    const maxMult = (collector.openMultiplier + band * maxFrac) * interestPenalty;

    const opening = Math.max(1, round(marketPrice * openMult));
    const trueMax = Math.max(opening + 1, round(marketPrice * maxMult));

    return {
        collector, item, marketPrice,
        history: [{ by: 'collector', amount: opening }],
        currentOffer: opening,
        round: 1,
        status: 'negotiating',
        trueMax,
        rel,
    };
}

/**
 * Readable odds the collector accepts a given ask right now, without
 * revealing `trueMax` outright. 1.0 for anything at or under their true
 * ceiling. Above it, the odds fall off over a tolerance band that widens
 * with relationship and narrows every round they've already had to argue —
 * this is the number a screen should show the player, not `trueMax` itself.
 */
export function acceptChance(state: NegotiationState, ask: number): number {
    if (ask <= state.trueMax) return 1;
    const overshoot = (ask - state.trueMax) / state.trueMax;
    const tolerance = 0.25 * (1 + state.rel * 0.5) / (1 + (state.round - 1) * 0.35);
    return clamp(1 - overshoot / tolerance, 0, 1);
}

/**
 * The player's counter-ask. Resolves in one of three ways:
 *  - accepted, if the ask clears `acceptChance`'s roll (guaranteed if at/under trueMax)
 *  - dead, if an outrageous ask rolls the "insult" check
 *  - negotiating, with a fresh collector counter that concedes toward trueMax
 * Rounds are capped at MAX_ROUNDS: past that, the deal is forced to a verdict
 * so haggling cannot loop forever.
 */
export function counterOffer(state: NegotiationState, ask: number): NegotiationState {
    if (state.status !== 'negotiating') return state;

    const history = [...state.history, { by: 'player' as const, amount: ask }];
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

    if (state.round >= MAX_ROUNDS) {
        // Forced verdict: close the gap if it's small, otherwise the meeting ends.
        const closeEnough = overshoot <= 0.08;
        return closeEnough
            ? { ...state, history, currentOffer: state.trueMax, round: state.round + 1, status: 'accepted' }
            : { ...state, history, status: 'dead' };
    }

    // Concede toward trueMax, never toward the player's ask beyond it — this is
    // what guarantees geometric convergence instead of a loop. Concessions grow
    // each round because a collector's patience for re-litigating shrinks.
    const concessionStep = clamp(0.3 + state.round * 0.12, 0.3, 0.85);
    const nextOffer = round(state.currentOffer + (state.trueMax - state.currentOffer) * concessionStep);
    return {
        ...state,
        history: [...history, { by: 'collector', amount: nextOffer }],
        currentOffer: nextOffer,
        round: state.round + 1,
        status: 'negotiating',
    };
}

/** Take the number currently on the table. Always succeeds — it's already their offer. */
export function acceptOffer(state: NegotiationState): NegotiationState {
    return { ...state, status: 'accepted' };
}

/** Walk. Nothing is at risk once this is called — see resolveDeal. */
export function walkAway(state: NegotiationState): NegotiationState {
    return { ...state, status: 'walked' };
}

// ---------------------------------------------------------------------------
// Risk model
// ---------------------------------------------------------------------------

/**
 * Robbery odds for this specific meet. Rises with how much cash is actually
 * on the table (a bigger bag draws bigger risk) and falls with standing —
 * someone who trusts you has less reason to set you up. `valueFactor` is
 * floored so cheap deals are never truly zero-risk and capped so a
 * legendary-grade deal doesn't approach certainty.
 */
export function robberyChance(collector: Collector, dealValue: number, player: Player): number {
    const rel = relationshipFactor(player, collector.npcId);
    // Square-root, not linear: sneakers range from $50 to $60,000, and a
    // linear scale saturates instantly at the top of that range, erasing the
    // difference between "a lot of money" and "an obscene amount of money".
    // sqrt keeps mid-range deals ($500-$5000, where most sales happen)
    // spread out while still capping so a legendary-grade deal doesn't
    // approach certainty on danger alone.
    const valueFactor = clamp(Math.sqrt(dealValue / 500), 0.3, 3);
    const standingRelief = rel * 0.4; // ±40% swing
    const raw = collector.danger * valueFactor * (1 - standingRelief);
    return clamp(raw, 0.01, 0.85);
}

/** Odds the cash handed over is counterfeit. Driven by trust, softened by standing. */
export function counterfeitChance(collector: Collector, player: Player): number {
    const rel = relationshipFactor(player, collector.npcId);
    const base = 1 - collector.trust;
    const standingRelief = rel * 0.5;
    return clamp(base * (1 - standingRelief) * 0.7, 0, 0.75);
}

/** Odds you notice the counterfeit cash during the meet rather than after. A skill check, not luck. */
export function liveCounterfeitDetectChance(player: Player): number {
    return clamp(0.15 + player.focus / 250 + player.streetCred / 500, 0.1, 0.65);
}

/** Odds a collector clocks a fake before paying for it. Their `eye`, lightly softened by trust in you. */
export function fakeDetectChance(collector: Collector, player: Player): number {
    const rel = relationshipFactor(player, collector.npcId);
    return clamp(collector.eye - rel * 0.15, 0.05, 0.97);
}

export type DealResultKind =
    | 'paidStraight'
    | 'paidCounterfeit'
    | 'caughtCounterfeit'
    | 'robbed'
    | 'caughtFake'
    | 'walked'
    | 'dead';

export interface DealOutcome {
    player: Player;
    log: OutcomeLogEntry[];
    result: DealResultKind;
    /** Real cash that actually landed in the player's pocket. 0 unless result is 'paidStraight'. */
    amount: number;
}

const noop = (player: Player, result: DealResultKind, text: string): DealOutcome => ({
    player,
    log: [{ icon: '🚶', text, tone: 'neutral' }],
    result,
    amount: 0,
});

/**
 * Runs the actual meet. Only ever touches the player/item/connection when a
 * price was agreed — a walked-away or collapsed negotiation is a pure no-op,
 * so the item is never at risk unless there was really a deal to execute.
 */
export function resolveDeal(state: NegotiationState, player: Player, day: number): DealOutcome {
    const { collector, item } = state;

    if (state.status === 'walked') return noop(player, 'walked', pick(collector.lines.walkAway));
    if (state.status === 'dead') return noop(player, 'dead', pick(collector.lines.walkAway));

    const price = state.currentOffer;
    const log: OutcomeLogEntry[] = [];

    // --- 1. Did they even come to buy? ---
    if (Math.random() < robberyChance(collector, price, player)) {
        const withoutItem = {
            ...player,
            inventory: player.inventory.filter(i => i.instanceId !== item.instanceId),
            heat: clamp(player.heat + 4, 0, MAX_HEAT),
            stats: { ...player.stats, timesRobbed: player.stats.timesRobbed + 1 },
        };
        const robbed = patchConnection(withoutItem, collector.npcId, {
            standing: standingWith(player, collector.npcId) - 10,
            lastDealDay: day,
        });
        log.push({ icon: '🔫', text: pick(collector.lines.doubleCross), tone: 'bad' });
        log.push({ icon: '👟', text: `They walk off with the pair. No payment.`, tone: 'bad' });
        return { player: robbed, log, result: 'robbed', amount: 0 };
    }

    // --- 2. Do they clock the fake before paying for it? ---
    if (item.isFake && Math.random() < spotChance(fakeDetectChance(collector, player), gradeOf(item))) {
        const confiscated = {
            ...player,
            inventory: player.inventory.filter(i => i.instanceId !== item.instanceId),
            heat: clamp(player.heat + 18, 0, MAX_HEAT),
            streetCred: Math.max(0, player.streetCred - 10),
        };
        // Flat reset, not a delta off whatever standing was — getting caught
        // passing a fake is catastrophic regardless of how good things were
        // a minute ago, and burnedYou means collectorsIn() locks them out
        // entirely from here on anyway.
        let burned = patchConnection(confiscated, collector.npcId, {
            standing: -60,
            burnedYou: true,
            lastDealDay: day,
        });
        // It spreads: word gets around, so every other connection cools off a
        // little too, not just this one — the "should spread" requirement.
        burned = spreadHeat(burned, collector.npcId, day);
        log.push({ icon: '🚨', text: pick(collector.lines.doubleCross), tone: 'bad' });
        log.push({ icon: '📉', text: `They will not deal with you again. Word gets around — other collectors cool off too.`, tone: 'bad' });
        log.push({ icon: '🚔', text: `Police heat +18.`, tone: 'bad' });
        return { player: burned, log, result: 'caughtFake', amount: 0 };
    }

    // --- 3. Is the cash they hand over real? ---
    const soldOut = { ...player, inventory: player.inventory.filter(i => i.instanceId !== item.instanceId) };

    if (Math.random() < counterfeitChance(collector, player)) {
        if (Math.random() < liveCounterfeitDetectChance(player)) {
            // Caught it in their hand. Deal never actually completes — you keep the pair.
            const caught = patchConnection(player, collector.npcId, {
                youBurnedThem: true,
                standing: standingWith(player, collector.npcId) - 15,
                lastDealDay: day,
            });
            const withCred = { ...caught, streetCred: caught.streetCred + 2 };
            log.push({ icon: '🧐', text: `You catch it before it leaves your hand — counterfeit.`, tone: 'good' });
            log.push({ icon: '📈', text: `+2 Street Cred for the catch. They don't try that again.`, tone: 'good' });
            return { player: withCred, log, result: 'caughtCounterfeit', amount: 0 };
        }
        // Didn't catch it. The pair is gone; the "cash" is worth nothing.
        const scammed = patchConnection(soldOut, collector.npcId, {
            standing: standingWith(player, collector.npcId) - 5,
            lastDealDay: day,
        });
        log.push({ icon: '💸', text: pick(collector.lines.doubleCross), tone: 'bad' });
        log.push({ icon: '🧾', text: `The pair is gone. The cash is paper.`, tone: 'bad' });
        return { player: scammed, log, result: 'paidCounterfeit', amount: 0 };
    }

    // --- 4. A real deal. ---
    const conn = getConnection(player, collector.npcId);
    const paid = {
        ...soldOut,
        cash: soldOut.cash + price,
        stats: { ...soldOut.stats, totalProfit: soldOut.stats.totalProfit + (price - item.purchasePrice), sneakersSold: soldOut.stats.sneakersSold + 1 },
    };
    let settled = patchConnection(paid, collector.npcId, {
        standing: conn.standing + 6,
        deals: conn.deals + 1,
        lastDealDay: day,
    });

    log.push({ icon: '🤝', text: `Paid in full. $${price.toLocaleString()}.`, tone: 'good' });
    log.push({ icon: '📈', text: `Standing with ${collector.name} improves.`, tone: 'good' });

    // Bibi specifically: a clean private sale reads as loyalty, same channel
    // as the scenarios in data/npcs/bibi.ts that move bibiApproval directly.
    if (collector.npcId === 'bibi') {
        const bump = clamp(4 + Math.round(price / 2000), 4, 12);
        settled = { ...settled, bibiApproval: clamp(settled.bibiApproval + bump, 0, 100) };
        log.push({ icon: '🇮🇱', text: `Bibi's approval rises (+${bump}). Order, apparently, includes footwear.`, tone: 'good' });
    }

    // Celebrities specifically: a strong connection unlocks a tip-off, once,
    // the first time standing crosses the threshold on this very deal.
    if (collector.kind === 'celebrity') {
        const before = conn.standing;
        const after = settled.connections[collector.npcId].standing;
        const flagKey = `collector-tipoff-${collector.npcId}`;
        if (before < 60 && after >= 60 && !settled.flags[flagKey]) {
            settled = { ...settled, flags: { ...settled.flags, [flagKey]: true } };
            log.push({ icon: '📞', text: `${collector.name} is properly in your corner now. Expect a call before the next big move.`, tone: 'good' });
        }
    }

    return { player: settled, log, result: 'paidStraight', amount: price };
}

/** A caught fake costs you a little standing with everyone else too — word travels. */
function spreadHeat(player: Player, caughtByNpcId: string, day: number): Player {
    const others = Object.keys(player.connections).filter(id => id !== caughtByNpcId);
    let next = player;
    for (const id of others) {
        const conn = next.connections[id];
        next = patchConnection(next, id, { standing: conn.standing - 5, lastDealDay: conn.lastDealDay });
    }
    void day;
    return next;
}
