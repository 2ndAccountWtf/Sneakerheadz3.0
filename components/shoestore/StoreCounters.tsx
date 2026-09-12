import React, { useState, useMemo } from 'react';
import { useGame } from '../../hooks/useGame';
import { SNEAKERS } from '../../data/sneakers';
import Img from '../Img';
import { MAX_INVENTORY_SIZE } from '../../constants';
import { getCityMarketPrice, getSellPrice } from '../../systems/pricing';
import type { ShoeStoreProps } from '../../types/shoestore';
import type { InventoryItem } from '../../types';

/**
 * Trade-In counter.
 *
 * The `trade` tab existed in several store configs and resolved to an empty
 * grid, because the tab pointed at an inventory group that is never stocked —
 * it takes stock IN. This is that counter: the store appraises what you're
 * carrying, and you can push for more at the risk of the offer getting worse.
 */
export const TradeInCounter: React.FC<{ store: ShoeStoreProps }> = ({ store }) => {
    const { gameState, sellSneaker } = useGame();
    const { player } = gameState;

    const basePct = store.trade?.baseOfferPctOfMarket ?? (1 - (store.pricing.buybackDiscountPct ?? 40) / 100);
    const haggleEnabled = store.trade?.haggle?.enable ?? true;

    // A pushed offer either improves or sours, per item, for this visit only.
    const [pushed, setPushed] = useState<Record<string, number>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});

    const offers = useMemo(() => player.inventory.map(item => {
        const sneaker = SNEAKERS.find(s => s.id === item.sneakerId);
        const market = getCityMarketPrice(gameState, item.sneakerId);
        const trueValue = market !== undefined ? getSellPrice(market, item, player) : 0;
        const multiplier = pushed[item.instanceId] ?? basePct;
        return { item, sneaker, trueValue, offer: Math.max(1, Math.round(trueValue * multiplier)), multiplier };
    }).filter(o => o.sneaker), [player.inventory, gameState, pushed, basePct, player]);

    const haggle = (item: InventoryItem, currentMultiplier: number) => {
        // Street cred buys you patience from the counter staff.
        const credEdge = Math.min(0.2, player.streetCred / 500);
        const good = Math.random() < 0.45 + credEdge;

        if (good) {
            const bump = 0.08 + Math.random() * 0.12;
            setPushed(p => ({ ...p, [item.instanceId]: Math.min(0.95, currentMultiplier + bump) }));
            setNotes(n => ({ ...n, [item.instanceId]: `They come up to ${Math.round(Math.min(0.95, currentMultiplier + bump) * 100)}% of market. Take it.` }));
        } else {
            const cut = 0.05 + Math.random() * 0.1;
            setPushed(p => ({ ...p, [item.instanceId]: Math.max(0.15, currentMultiplier - cut) }));
            setNotes(n => ({ ...n, [item.instanceId]: `"That's the offer, and now it's worse." They are not bluffing.` }));
        }
    };

    if (player.inventory.length === 0) {
        return (
            <div className="panel p-10 text-center">
                <div className="text-3xl mb-2">🤝</div>
                <p className="text-[var(--ink-dim)]">This counter buys pairs off you. Your bag is empty.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="panel p-3 mb-3 flex flex-wrap items-center gap-2">
                <span className="chip chip-accent">Base offer {Math.round(basePct * 100)}% of market</span>
                {store.trade?.legitCheckOnTrade !== false && store.behavior.securityLevel > 0 && (
                    <span className="chip chip-warn">🔍 They authenticate on intake</span>
                )}
                {haggleEnabled && <span className="chip">Pushing can backfire</span>}
            </div>

            <div className="space-y-2">
                {offers.map(({ item, sneaker, trueValue, offer, multiplier }) => (
                    <div key={item.instanceId} className="panel p-3 flex items-center gap-3">
                        <Img src={sneaker!.imageUrl} alt="" className="w-14 h-14 object-contain bg-[var(--bg-sunken)] flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-white truncate">{sneaker!.name}</h4>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                <span className="chip !text-[9px] !py-0">Market ${trueValue.toLocaleString()}</span>
                                <span className="chip !text-[9px] !py-0">Paid ${item.purchasePrice.toLocaleString()}</span>
                                {item.isFake && <span className="chip chip-bad !text-[9px] !py-0">⚠ REPLICA</span>}
                                {item.condition?.map(c => <span key={c} className="chip chip-warn !text-[9px] !py-0">{c}</span>)}
                            </div>
                            {notes[item.instanceId] && (
                                <p className="text-[11px] text-[var(--ink-dim)] italic mt-1">{notes[item.instanceId]}</p>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <div className="numeric text-lg text-[var(--ok)]">${offer.toLocaleString()}</div>
                            <div className="flex gap-1.5">
                                {haggleEnabled && !(item.instanceId in pushed) && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => haggle(item, multiplier)}>
                                        Push
                                    </button>
                                )}
                                <button className="btn btn-primary btn-sm" onClick={() => sellSneaker(item.instanceId, offer)}>
                                    Sell
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * Raffle counter. The `raffle` tab and the `drops.raffle` config both existed;
 * nothing read either. Entering costs a ticket, the odds are stated plainly,
 * and losing is the normal result.
 */
export const RaffleCounter: React.FC<{ store: ShoeStoreProps; groupRef: string }> = ({ store, groupRef }) => {
    const { gameState, dispatch } = useGame();
    const { player, markets, currentCityId, day } = gameState;

    const raffle = store.drops?.raffle;
    const ticketPrice = raffle?.ticketPrice ?? 25;
    const oddsModifier = raffle?.winOddsModifier ?? 1;

    const [entries, setEntries] = useState(0);
    const [result, setResult] = useState<null | { won: boolean; text: string }>(null);

    const prizePool = useMemo(() => {
        const listings = markets[currentCityId]?.sneakers.filter(s => s.group === groupRef) ?? [];
        return listings
            .map(l => SNEAKERS.find(s => s.id === l.sneakerId))
            .filter((s): s is typeof SNEAKERS[number] => !!s)
            .sort((a, b) => b.basePrice - a.basePrice);
    }, [markets, currentCityId, groupRef]);

    const entryLimit = raffle?.entryLimit ?? 5;
    // More entries, better odds — with diminishing returns, as raffles go.
    const winChance = Math.min(0.6, (0.06 + entries * 0.035) * oddsModifier);

    const enter = () => {
        if (player.cash < ticketPrice || entries >= entryLimit) return;

        const nextEntries = entries + 1;
        setEntries(nextEntries);

        const chance = Math.min(0.6, (0.06 + nextEntries * 0.035) * oddsModifier);
        const won = Math.random() < chance;
        const prize = prizePool[Math.floor(Math.random() * Math.max(1, prizePool.length))];
        const hasRoom = player.inventory.length < MAX_INVENTORY_SIZE;

        if (won && prize && hasRoom) {
            dispatch({
                type: 'APPLY_OUTCOMES',
                payload: {
                    sourceName: store.name,
                    outcomes: [
                        { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: ticketPrice }], description: `Ticket #${nextEntries}.` },
                        { type: 'inventoryChange', add: [{ kind: 'item', value: prize.id, qty: 1 }], description: `YOUR NUMBER CAME UP — ${prize.name}.` },
                        { type: 'streetCred', change: 4, description: 'You won a raffle in public. People saw.' },
                    ],
                },
            });
            setResult({ won: true, text: `Ticket #${nextEntries} hits. ${prize.name} is yours at retail.` });
        } else {
            dispatch({
                type: 'APPLY_OUTCOMES',
                payload: {
                    sourceName: store.name,
                    outcomes: [
                        { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: ticketPrice }], description: `Ticket #${nextEntries}.` },
                    ],
                },
            });
            setResult({
                won: false,
                text: won && !hasRoom
                    ? `You won — and your bag is full, so they give it to the person behind you.`
                    : `Ticket #${nextEntries}: nothing. The machine does not even pause.`,
            });
        }
    };

    if (!raffle?.open) {
        return (
            <div className="panel p-10 text-center">
                <div className="text-3xl mb-2">🎟</div>
                <p className="text-[var(--ink-dim)]">No raffle running right now. Come back another day.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="panel p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <h3 className="font-display text-sm uppercase text-white">Draw Entry</h3>
                        <p className="text-xs text-[var(--ink-dim)] mt-1">
                            Day {day}. Winners are drawn on the spot, which is not how raffles work anywhere else.
                        </p>
                    </div>
                    <span className="numeric text-lg text-[var(--ok)] flex-shrink-0">${ticketPrice}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="chip">Entries {entries}/{entryLimit}</span>
                    <span className="chip chip-accent">Odds {Math.round(winChance * 100)}%</span>
                    {raffle.eligibility?.map(e => <span key={e} className="chip chip-warn">{e}</span>)}
                </div>

                <button
                    className="btn btn-primary w-full"
                    disabled={player.cash < ticketPrice || entries >= entryLimit}
                    onClick={enter}
                >
                    {entries >= entryLimit ? 'Entry Limit Reached' : `Buy Ticket — $${ticketPrice}`}
                </button>
            </div>

            {result && (
                <div
                    className="panel p-3 text-sm animate-rise"
                    style={{ borderColor: result.won ? 'var(--ok)' : 'var(--line-bright)', color: result.won ? 'var(--ok)' : 'var(--ink-dim)' }}
                >
                    {result.won ? '🎉 ' : '— '}{result.text}
                </div>
            )}

            {prizePool.length > 0 && (
                <div className="panel">
                    <div className="panel-head"><span className="label">On the board</span></div>
                    <div className="divide-y divide-[var(--line)]">
                        {prizePool.slice(0, 6).map(s => (
                            <div key={s.id} className="flex items-center gap-3 px-3 py-2">
                                <Img src={s.imageUrl} alt="" className="w-9 h-9 object-contain bg-[var(--bg-sunken)]" />
                                <span className="text-sm text-white flex-1 truncate">{s.name}</span>
                                <span className="numeric text-xs text-[var(--ink-dim)]">${s.basePrice.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
