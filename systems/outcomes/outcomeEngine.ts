/**
 * OutcomeEngine
 * =============
 * The content in `data/npcs` and `data/celebrities` was authored with rich
 * `outcomes` arrays long before anything read them. This module is the reader:
 * given a player state and a list of authored outcomes, it returns the new
 * state, a human-readable receipt, and optionally a mini-game to hand control
 * to.
 *
 * It is deliberately pure — no React, no dispatch — so the reducer stays the
 * single writer of game state and the whole thing stays testable.
 */
import type { GameState, Player, InventoryItem, StatusEffect, StorageItem } from '../../types';
import type { ScenarioOutcome } from '../../types/interactions';
import type { Buff, BuffKind, OutcomeLogEntry, MiniGameRequest } from '../../types/game';
import type { MarketSignal } from '../../types/news';
import { SNEAKERS } from '../../data/sneakers';
import { storageMock } from '../../data/storage.mock';
import { MAX_HEALTH, MAX_ENERGY, MAX_HEAT, MAX_INVENTORY_SIZE } from '../../constants';

export interface ApplyResult {
    player: Player;
    signals: MarketSignal[];
    log: OutcomeLogEntry[];
    miniGame: MiniGameRequest | null;
    /** Cutscene-worthy events the caller may want to surface loudly. */
    loud: boolean;
}

let uid = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(uid++).toString(36)}`;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]): T | undefined => arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;

/**
 * Authored durations arrive as '24h', '48h', 'permanent', or a bare hour count.
 * A day in this game is one flight, so 24h == 1 day.
 */
export function durationToDays(duration: unknown): number | undefined {
    if (duration === undefined || duration === null) return 1;
    if (duration === 'permanent') return undefined; // never expires
    if (typeof duration === 'number') return Math.max(1, Math.ceil(duration / 24));
    if (typeof duration === 'string') {
        const m = duration.match(/^(\d+)\s*h/i);
        if (m) return Math.max(1, Math.ceil(parseInt(m[1], 10) / 24));
        const d = duration.match(/^(\d+)\s*d/i);
        if (d) return Math.max(1, parseInt(d[1], 10));
    }
    return 1;
}

/**
 * Maps the status tags authored in dialogue onto real mechanical buffs.
 * Anything not listed still lands as a cosmetic status so the text isn't lost.
 */
const STATUS_TAG_BUFFS: Record<string, { kind: BuffKind; magnitude: number; label: string }> = {
    'calm-markets': { kind: 'volatilityDamp', magnitude: 0.75, label: 'Calm Markets' },
    'stable': { kind: 'volatilityDamp', magnitude: 0.8, label: 'Stabilised Market' },
    'blessed': { kind: 'luck', magnitude: 0.25, label: "Bibi's Blessing" },
    'guidance': { kind: 'marketInsight', magnitude: 1, label: 'Bibi Guidance' },
    'favored': { kind: 'resaleBonus', magnitude: 1.1, label: 'Bibi Favored' },
    'protection': { kind: 'travelSafety', magnitude: 0.5, label: 'PM Protection Detail' },
    'lucky': { kind: 'luck', magnitude: 0.2, label: 'Feeling Lucky' },
    'cursed': { kind: 'curse', magnitude: 1.5, label: 'Cursed' },
    'hunted': { kind: 'curse', magnitude: 1.75, label: 'Hunted' },
};

function addBuff(player: Player, day: number, tag: string, duration: unknown, label?: string): { player: Player; entry: OutcomeLogEntry } {
    const known = STATUS_TAG_BUFFS[tag];
    const days = durationToDays(duration);
    const buff: Buff = {
        id: nextId('buff'),
        kind: known?.kind ?? 'luck',
        label: label ?? known?.label ?? tag,
        magnitude: known?.magnitude ?? 1,
        expiresOnDay: days === undefined ? undefined : day + days,
        source: tag,
    };
    // A buff of the same kind and label replaces the older one rather than stacking
    // into absurdity.
    const buffs = player.buffs.filter(b => !(b.kind === buff.kind && b.label === buff.label));
    const until = buff.expiresOnDay ? `until day ${buff.expiresOnDay}` : 'permanently';
    return {
        player: { ...player, buffs: [...buffs, buff] },
        entry: {
            icon: known?.kind === 'curse' ? '☠️' : '✨',
            text: `${buff.label} active ${until}.`,
            tone: known?.kind === 'curse' ? 'bad' : 'good',
        },
    };
}

function makeInventoryItem(sneakerId: string, price: number): InventoryItem {
    return {
        instanceId: nextId('item'),
        sneakerId,
        purchasePrice: price,
        isFake: false,
    };
}

/** Resolves the symbolic sneaker references used in authored content. */
function resolveSneakerId(value: string): string | null {
    if (SNEAKERS.some(s => s.id === value)) return value;
    if (value === 'random-sneaker' || value === 'random') return pick(SNEAKERS)!.id;
    if (value === 'random-legendary' || value === 'legendary') {
        const legendaries = SNEAKERS.filter(s => s.rarity === 'Legendary');
        return (pick(legendaries) ?? pick(SNEAKERS)!).id;
    }
    if (value === 'random-rare') {
        const rares = SNEAKERS.filter(s => s.rarity === 'Rare' || s.rarity === 'Legendary');
        return (pick(rares) ?? pick(SNEAKERS)!).id;
    }
    return null;
}

function applyInventoryChange(
    player: Player,
    outcome: ScenarioOutcome,
    log: OutcomeLogEntry[],
): Player {
    let next = { ...player };

    const adds: any[] = outcome.add ?? [];
    const removes: any[] = outcome.remove ?? [];

    for (const a of adds) {
        const qty = typeof a.qty === 'number' ? a.qty : 1;
        if (a.kind === 'currency') {
            next = { ...next, cash: next.cash + qty };
            log.push({ icon: '💵', text: `+$${qty.toLocaleString()}`, tone: 'good' });
            continue;
        }
        const sneakerId = resolveSneakerId(String(a.value));
        if (sneakerId) {
            if (next.inventory.length >= MAX_INVENTORY_SIZE) {
                log.push({ icon: '📦', text: `No room in your bag — the pair is left behind.`, tone: 'bad' });
                continue;
            }
            const sneaker = SNEAKERS.find(s => s.id === sneakerId)!;
            const batch: InventoryItem[] = [];
            for (let i = 0; i < qty && next.inventory.length + batch.length < MAX_INVENTORY_SIZE; i++) {
                batch.push(makeInventoryItem(sneakerId, 0));
            }
            next = { ...next, inventory: [...next.inventory, ...batch] };
            log.push({ icon: '👟', text: `Acquired ${batch.length}x ${sneaker.name} for free.`, tone: 'good' });
            continue;
        }
        // Fall back to the AM/PM storage catalogue.
        const master = storageMock.find(i => i.id === a.value || i.name.toLowerCase().includes(String(a.value)));
        if (master) {
            next = { ...next, storage: mergeStorage(next.storage, master, qty) };
            log.push({ icon: '🎒', text: `Received ${master.name}.`, tone: 'good' });
        } else {
            log.push({ icon: '❓', text: `You received something called "${a.value}". Unclear what it does.`, tone: 'neutral' });
        }
    }

    for (const r of removes) {
        const qty = typeof r.qty === 'number' ? r.qty : 1;
        if (r.kind === 'currency') {
            const taken = Math.min(next.cash, Math.round(qty));
            next = { ...next, cash: next.cash - taken };
            log.push({ icon: '💸', text: taken > 0 ? `-$${taken.toLocaleString()}` : `They tried to take $${qty} you don't have.`, tone: 'bad' });
            continue;
        }
        if (r.value === 'all-fakes') {
            const fakes = next.inventory.filter(i => i.isFake);
            if (fakes.length === 0) {
                log.push({ icon: '😇', text: `They find no fakes. You are, technically, clean.`, tone: 'good' });
            } else {
                next = { ...next, inventory: next.inventory.filter(i => !i.isFake) };
                log.push({ icon: '🚔', text: `${fakes.length} counterfeit pair(s) confiscated.`, tone: 'bad' });
            }
            continue;
        }
        if (r.value === 'random-sneaker' || resolveSneakerId(String(r.value))) {
            const target = r.value === 'random-sneaker'
                ? pick(next.inventory)
                : next.inventory.find(i => i.sneakerId === r.value);
            if (!target) {
                log.push({ icon: '🤷', text: `Nothing in your bag to take.`, tone: 'neutral' });
            } else {
                const name = SNEAKERS.find(s => s.id === target.sneakerId)?.name ?? 'a pair';
                next = { ...next, inventory: next.inventory.filter(i => i.instanceId !== target.instanceId) };
                log.push({ icon: '👟', text: `Lost ${name}.`, tone: 'bad' });
            }
            continue;
        }
        // Storage item, or one of the joke props the writers invented.
        const idx = next.storage.findIndex(i => i.id === r.value || i.name.toLowerCase().includes(String(r.value).replace(/-/g, ' ')));
        if (idx >= 0) {
            const item = next.storage[idx];
            const storage = [...next.storage];
            if (item.qty > 1) storage[idx] = { ...item, qty: item.qty - 1 };
            else storage.splice(idx, 1);
            next = { ...next, storage };
            log.push({ icon: '🎒', text: `Lost ${item.name}.`, tone: 'bad' });
        } else if (r.value === 'shoe-lace') {
            // Scuff whatever you're wearing instead — the joke still lands.
            const target = pick(next.inventory);
            if (target) {
                next = {
                    ...next,
                    inventory: next.inventory.map(i => i.instanceId === target.instanceId
                        ? { ...i, condition: [...(i.condition ?? []), 'scuffed'] }
                        : i),
                };
                log.push({ icon: '🥿', text: `A lace is gone. That pair is now SCUFFED (-10% resale).`, tone: 'bad' });
            } else {
                log.push({ icon: '🥿', text: `He takes a lace from the shoes you're wearing. You feel violated.`, tone: 'neutral' });
            }
        } else {
            log.push({ icon: '🥪', text: `You don't actually have a ${String(r.value).replace(/-/g, ' ')}. He takes the thought of one.`, tone: 'neutral' });
        }
    }

    return next;
}

function mergeStorage(storage: StorageItem[], master: StorageItem, qty: number): StorageItem[] {
    const idx = storage.findIndex(i => i.id === master.id);
    if (idx >= 0) {
        const next = [...storage];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
    }
    return [...storage, { ...master, qty, addedAgo: 'Just now' }];
}

function buildSignal(outcome: ScenarioOutcome, day: number): MarketSignal {
    const target = outcome.target ?? { kind: 'model', value: 'global' };
    let targets: MarketSignal['targets'];

    if (target.value === 'global' || target.kind === 'global') {
        targets = [{ kind: 'global', value: '*' }];
    } else if (target.value === 'random') {
        if (target.kind === 'rarity') {
            targets = [{ kind: 'model', value: pick(SNEAKERS)!.id }];
        } else {
            targets = [{ kind: 'model', value: pick(SNEAKERS)!.id }];
        }
    } else {
        targets = [{ kind: target.kind === 'rarity' ? 'rarity' : 'model', value: String(target.value) }];
    }

    const magnitude = typeof outcome.magnitude === 'number' ? outcome.magnitude : 1.1;
    const days = durationToDays(outcome.duration ?? outcome.durationHrs ?? '24h') ?? 1;

    return {
        id: nextId('signal'),
        effect: outcome.effect === 'collapse' || magnitude < 1 ? 'collapse' : 'surge',
        magnitude,
        expiresOnDay: day + days,
        targets,
        sourceNewsId: outcome.sourceNewsId ?? 'scenario',
        label: outcome.description,
    };
}

export interface ApplyOpts {
    day: number;
    /** Label used for the mini-game handoff, usually the NPC's name. */
    sourceName?: string;
}

/**
 * Applies a node's outcomes. Outcomes tagged `condition: 'win' | 'lose'` are
 * withheld and attached to the mini-game the same node launched, so the
 * already-authored "Win = +3 street cred" lines drive real results.
 */
export function applyOutcomes(
    player: Player,
    outcomes: ScenarioOutcome[] | undefined,
    opts: ApplyOpts,
): ApplyResult {
    const log: OutcomeLogEntry[] = [];
    const signals: MarketSignal[] = [];
    let next: Player = player;
    let miniGame: MiniGameRequest | null = null;
    let loud = false;

    if (!outcomes || outcomes.length === 0) {
        return { player: next, signals, log, miniGame, loud };
    }

    const onWin = outcomes.filter(o => o.condition === 'win');
    const onLose = outcomes.filter(o => o.condition === 'lose');
    const immediate = outcomes.filter(o => !o.condition);

    const combat = immediate.find(o => o.type === 'combat');
    const requested = immediate.find(o => o.type === 'miniGame');

    for (const outcome of immediate) {
        switch (outcome.type) {
            case 'notification':
                log.push({ icon: '💬', text: outcome.message ?? outcome.description, tone: 'neutral' });
                break;

            case 'streetCred':
            case 'reputation': {
                const change = Math.round(outcome.change ?? 0);
                if (change === 0) break;
                next = { ...next, streetCred: Math.max(0, next.streetCred + change) };
                log.push({
                    icon: change > 0 ? '📈' : '📉',
                    text: `${change > 0 ? '+' : ''}${change} Street Cred`,
                    tone: change > 0 ? 'good' : 'bad',
                });
                break;
            }

            case 'bibiApproval': {
                const change = Math.round(outcome.change ?? 0);
                next = { ...next, bibiApproval: clamp(next.bibiApproval + change, 0, 100) };
                log.push({
                    icon: change > 0 ? '🤝' : '🙅',
                    text: `Bibi's approval ${change > 0 ? 'rises' : 'falls'} (${change > 0 ? '+' : ''}${change}).`,
                    tone: change > 0 ? 'good' : 'bad',
                });
                break;
            }

            case 'heat': {
                const change = Math.round(outcome.change ?? 0);
                next = { ...next, heat: clamp(next.heat + change, 0, MAX_HEAT) };
                log.push({
                    icon: '🚨',
                    text: `Police heat ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}.`,
                    tone: change > 0 ? 'bad' : 'good',
                });
                break;
            }

            case 'stat_change': {
                const stat = outcome.payload?.stat ?? outcome.stat;
                const value = Math.round(outcome.payload?.value ?? outcome.value ?? 0);
                if (stat === 'health') {
                    next = { ...next, health: clamp(next.health + value, 0, MAX_HEALTH) };
                    log.push({ icon: value > 0 ? '❤️' : '🩸', text: `${value > 0 ? '+' : ''}${value} Health`, tone: value > 0 ? 'good' : 'bad' });
                } else if (stat === 'energy') {
                    next = { ...next, energy: clamp(next.energy + value, 0, MAX_ENERGY) };
                    log.push({ icon: value > 0 ? '⚡' : '🥱', text: `${value > 0 ? '+' : ''}${value} Energy`, tone: value > 0 ? 'good' : 'bad' });
                } else {
                    log.push({ icon: '💬', text: outcome.description, tone: 'neutral' });
                }
                break;
            }

            case 'inventoryChange':
                next = applyInventoryChange(next, outcome, log);
                break;

            case 'statusEffect': {
                const tag = outcome.effect ?? outcome.apply?.tag ?? 'lucky';
                const duration = outcome.duration ?? outcome.apply?.durationHrs ?? '24h';
                if (tag === 'scuffed') {
                    // Damage a pair rather than debuffing the player globally.
                    const target = pick(next.inventory);
                    if (target) {
                        next = {
                            ...next,
                            inventory: next.inventory.map(i => i.instanceId === target.instanceId
                                ? { ...i, condition: [...(i.condition ?? []), 'scuffed'] }
                                : i),
                        };
                        log.push({ icon: '🥿', text: `A pair is now SCUFFED (-10% resale).`, tone: 'bad' });
                    }
                    break;
                }
                const res = addBuff(next, opts.day, tag, duration, outcome.label);
                next = res.player;
                log.push(res.entry);
                break;
            }

            case 'priceMarkup': {
                const multiplier = typeof outcome.multiplier === 'number' ? outcome.multiplier : 1;
                const days = durationToDays(outcome.duration) ?? 1;
                const isDiscount = multiplier < 1;
                const buff: Buff = {
                    id: nextId('buff'),
                    kind: isDiscount ? 'storeDiscount' : 'resaleBonus',
                    label: isDiscount
                        ? `${Math.round((1 - multiplier) * 100)}% Store Discount`
                        : `+${Math.round((multiplier - 1) * 100)}% Resale`,
                    magnitude: multiplier,
                    expiresOnDay: opts.day + days,
                    source: 'priceMarkup',
                };
                next = { ...next, buffs: [...next.buffs.filter(b => b.kind !== buff.kind), buff] };
                log.push({ icon: isDiscount ? '🏷️' : '💰', text: `${buff.label} for ${days} day(s).`, tone: 'good' });
                break;
            }

            case 'marketSignal': {
                const signal = buildSignal(outcome, opts.day);
                signals.push(signal);
                const pct = Math.round((signal.magnitude - 1) * 100);
                const scope = signal.targets[0].kind === 'global'
                    ? 'the entire market'
                    : signal.targets[0].kind === 'rarity'
                        ? `${signal.targets[0].value} pairs`
                        : (SNEAKERS.find(s => s.id === signal.targets[0].value)?.name ?? 'a model');
                log.push({
                    icon: pct >= 0 ? '🚀' : '🩻',
                    text: `${scope} ${pct >= 0 ? 'surges' : 'sinks'} ${Math.abs(pct)}% until day ${signal.expiresOnDay}.`,
                    tone: pct >= 0 ? 'good' : 'bad',
                });
                loud = true;
                break;
            }

            case 'inventoryMultiplier': {
                const min = outcome.min ?? 2;
                const max = outcome.max ?? 5;
                if (next.inventory.length === 0) {
                    log.push({ icon: '📦', text: `Your bag is empty. The blessing has nothing to multiply. Tragic.`, tone: 'neutral' });
                    break;
                }
                let totalBefore = 0;
                let totalAfter = 0;
                const inventory = next.inventory.map(item => {
                    const base = SNEAKERS.find(s => s.id === item.sneakerId)?.basePrice ?? 0;
                    const current = item.valueMultiplier ?? 1;
                    const mult = rand(min, max);
                    totalBefore += base * current;
                    totalAfter += base * current * mult;
                    return { ...item, valueMultiplier: current * mult };
                });
                next = { ...next, inventory };
                log.push({
                    icon: '🌟',
                    text: `Every pair you own multiplied ${min}x–${max}x. Bag value ~$${Math.round(totalBefore).toLocaleString()} → ~$${Math.round(totalAfter).toLocaleString()}.`,
                    tone: 'good',
                });
                loud = true;
                break;
            }

            case 'freebie': {
                const cash = Math.round(outcome.cash ?? rand(50, 250));
                next = { ...next, cash: next.cash + cash };
                log.push({ icon: '🎁', text: `${outcome.description} (+$${cash})`, tone: 'good' });
                break;
            }

            case 'flag': {
                next = { ...next, flags: { ...next.flags, [outcome.key]: outcome.value ?? true } };
                // Bookkeeping flags carry no description and shouldn't clutter the receipt.
                if (outcome.description) {
                    log.push({ icon: '🔖', text: outcome.description, tone: 'neutral' });
                }
                break;
            }

            case 'quest':
                // The reducer handles quest creation; log only.
                log.push({ icon: '🗺️', text: outcome.description, tone: 'neutral' });
                break;

            case 'combat':
            case 'miniGame':
                // Handled below so the win/lose payloads ride along.
                break;

            default:
                log.push({ icon: '•', text: outcome.description, tone: 'neutral' });
        }
    }

    if (combat) {
        miniGame = {
            game: 'street-brawl',
            title: opts.sourceName ? `Brawl: ${opts.sourceName}` : 'Street Brawl',
            config: { opponent: opts.sourceName ?? 'Some Guy', stake: combat.stake ?? null },
            onWin,
            onLose,
        };
    } else if (requested) {
        miniGame = {
            game: requested.game,
            title: requested.title ?? 'Mini-game',
            config: requested.config ?? {},
            onWin,
            onLose,
        };
    } else if (onWin.length || onLose.length) {
        // Conditional outcomes with nothing to resolve them: flip a coin so the
        // authored text still has consequences rather than silently vanishing.
        const won = Math.random() < 0.5;
        const resolved = applyOutcomes(next, (won ? onWin : onLose).map(o => ({ ...o, condition: undefined })), opts);
        next = resolved.player;
        signals.push(...resolved.signals);
        log.push({ icon: won ? '🎲' : '🎲', text: won ? 'It goes your way.' : 'It does not go your way.', tone: won ? 'good' : 'bad' });
        log.push(...resolved.log);
    }

    return { player: next, signals, log, miniGame, loud };
}

/** Drops buffs whose day has passed. Called on day advance. */
export function expireBuffs(player: Player, day: number): Player {
    const buffs = player.buffs.filter(b => b.expiresOnDay === undefined || b.expiresOnDay > day);
    if (buffs.length === player.buffs.length) return player;
    return { ...player, buffs };
}

/** Convenience accessors used across the UI and pricing. */
export const buffMultiplier = (player: Player, kind: BuffKind, fallback = 1): number => {
    const relevant = player.buffs.filter(b => b.kind === kind);
    if (!relevant.length) return fallback;
    return relevant.reduce((acc, b) => acc * b.magnitude, 1);
};

export const hasBuff = (player: Player, kind: BuffKind): boolean => player.buffs.some(b => b.kind === kind);
