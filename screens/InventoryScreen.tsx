import React, { useMemo, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { SNEAKERS } from '../data/sneakers';
import { Screen } from '../types';
import { InventorySneakerCard } from '../components/SneakerCard';
import ScreenHeader from '../components/ScreenHeader';
import { MAX_INVENTORY_SIZE } from '../constants';
import { getCityMarketPrice, getBagValue, getSellPrice } from '../systems/pricing';

type SortKey = 'value' | 'profit' | 'rarity';

const RARITY_ORDER: Record<string, number> = { Legendary: 4, Rare: 3, Uncommon: 2, Common: 1 };

/**
 * The bag. Shows the price a pair will actually fetch here and now — blessings,
 * damage tags and resale buffs included — rather than a raw market number that
 * bore no relation to what the till paid out.
 */
const InventoryScreen: React.FC = () => {
    const { gameState, sellSneaker, viewMarketAnalysis, takeNap, dispatch } = useGame();
    const { player } = gameState;
    const [sort, setSort] = useState<SortKey>('value');

    const bagValue = useMemo(() => getBagValue(gameState), [gameState]);
    const costBasis = player.inventory.reduce((t, i) => t + i.purchasePrice, 0);
    const unrealised = bagValue - costBasis;

    const rows = useMemo(() => {
        const mapped = player.inventory.map(item => {
            const sneaker = SNEAKERS.find(s => s.id === item.sneakerId);
            const marketPrice = getCityMarketPrice(gameState, item.sneakerId);
            const sellPrice = marketPrice !== undefined ? getSellPrice(marketPrice, item, player) : 0;
            return { item, sneaker, marketPrice, sellPrice };
        }).filter(r => r.sneaker);

        return mapped.sort((a, b) => {
            if (sort === 'profit') return (b.sellPrice - b.item.purchasePrice) - (a.sellPrice - a.item.purchasePrice);
            if (sort === 'rarity') return (RARITY_ORDER[b.sneaker!.rarity] ?? 0) - (RARITY_ORDER[a.sneaker!.rarity] ?? 0);
            return b.sellPrice - a.sellPrice;
        });
    }, [player.inventory, gameState, sort, player]);

    const napCost = player.energy >= 95 ? 'Already rested' : 'Sleep it off';

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Your <span className="accent">Bag</span></>}
                subtitle={`${player.inventory.length}/${MAX_INVENTORY_SIZE} slots used`}
                back={Screen.Dashboard}
                actions={
                    <button className="btn btn-sm" onClick={() => dispatch({ type: 'CHANGE_SCREEN', payload: Screen.Storage })}>
                        Storage
                    </button>
                }
            />

            {/* Condition strip — health, energy and the nap gamble */}
            <div className="panel p-3 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                <div>
                    <div className="label">Bag Value</div>
                    <div className="numeric text-lg text-[var(--ok)]">${bagValue.toLocaleString()}</div>
                </div>
                <div>
                    <div className="label">Unrealised</div>
                    <div className="numeric text-lg" style={{ color: unrealised >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                        {unrealised >= 0 ? '+' : '−'}${Math.abs(unrealised).toLocaleString()}
                    </div>
                </div>
                <div>
                    <div className="label mb-1">Energy {Math.round(player.energy)}</div>
                    <div className="meter"><i style={{ width: `${player.energy}%`, background: 'var(--warn)' }} /></div>
                    <div className="label mt-1.5 mb-1">Health {Math.round(player.health)}</div>
                    <div className="meter"><i style={{ width: `${player.health}%`, background: 'var(--bad)' }} /></div>
                </div>
                <button
                    className="btn btn-gold w-full"
                    onClick={takeNap}
                    title="Naps are not deterministic. Something may happen."
                >
                    😴 {napCost}
                </button>
            </div>

            {/* Buffs */}
            {player.buffs.length > 0 && (
                <div className="panel p-3 mb-4">
                    <div className="label mb-2">Active Effects</div>
                    <div className="flex flex-wrap gap-1.5">
                        {player.buffs.map(b => (
                            <span key={b.id} className="chip chip-accent">
                                ✦ {b.label}{b.expiresOnDay ? ` · to day ${b.expiresOnDay}` : ' · permanent'}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Outcome receipt from the last nap / item use */}
            {gameState.outcomeLog.length > 0 && (
                <div className="panel mb-4 divide-y divide-[var(--line)]">
                    <div className="panel-head">
                        <span className="label">What Just Happened</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'CLEAR_OUTCOME_LOG' })}>Dismiss</button>
                    </div>
                    {gameState.outcomeLog.map((e, i) => (
                        <div
                            key={i}
                            className="flex items-start gap-2.5 px-3 py-2 text-xs font-mono"
                            style={{ color: e.tone === 'good' ? 'var(--ok)' : e.tone === 'bad' ? 'var(--bad)' : 'var(--ink-dim)' }}
                        >
                            <span>{e.icon}</span><span className="flex-1">{e.text}</span>
                        </div>
                    ))}
                </div>
            )}

            {player.inventory.length === 0 ? (
                <div className="panel p-10 text-center">
                    <div className="text-4xl mb-3">📦</div>
                    <p className="text-[var(--ink-dim)]">Your bag is empty. Go buy some heat.</p>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="label">Sort</span>
                        {(['value', 'profit', 'rarity'] as SortKey[]).map(key => (
                            <button
                                key={key}
                                onClick={() => setSort(key)}
                                className={`chip capitalize ${sort === key ? 'chip-accent' : ''}`}
                            >
                                {key}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {rows.map(({ item, sneaker, marketPrice }) => (
                            <InventorySneakerCard
                                key={item.instanceId}
                                sneaker={sneaker!}
                                item={item}
                                marketPrice={marketPrice}
                                onAnalyse={() => viewMarketAnalysis(item.sneakerId)}
                                onSell={marketPrice !== undefined ? () => sellSneaker(item.instanceId, marketPrice) : undefined}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default InventoryScreen;
