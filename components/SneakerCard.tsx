import React, { useState } from 'react';
import type { Sneaker, InventoryItem } from '../types';
import { useGame } from '../hooks/useGame';
import { priceFor, paymentBlocked, type PaymentMethod } from '../systems/payment';
import Img from './Img';
import { MAX_INVENTORY_SIZE } from '../constants';
import { getSellPrice } from '../systems/pricing';

const RARITY_CLASS: Record<Sneaker['rarity'], string> = {
    Common: 'rarity-common',
    Uncommon: 'rarity-uncommon',
    Rare: 'rarity-rare',
    Legendary: 'rarity-legendary',
};

/** Store listing: buy with a quantity stepper, sell duplicates you're carrying. */
export const StoreSneakerCard: React.FC<{
    sneaker: Sneaker;
    price?: number;
    quantity?: number;
    isFake?: boolean;
    onAnalyse?: () => void;
}> = ({ sneaker, price, quantity, isFake, onAnalyse }) => {
    const { gameState, buySneaker } = useGame();
    const [amount, setAmount] = useState(1);
    const [method, setMethod] = useState<PaymentMethod>('cash');

    const soldOut = quantity !== undefined && quantity <= 0;
    const owned = gameState.player.inventory.filter(i => i.sneakerId === sneaker.id);
    const room = MAX_INVENTORY_SIZE - gameState.player.inventory.length;
    const maxBuy = Math.max(0, Math.min(quantity ?? 0, room));

    // Cash is a few percent under the sticker and card a few percent over, so
    // the number on the button has to be the number that leaves your pocket —
    // otherwise the till and the bank screen tell the player different stories.
    const unit = price ? priceFor(price, method) : 0;
    const total = unit * amount;
    const blocked = price ? paymentBlocked(gameState.player, method, total, gameState.day) : 'No price.';
    const canBuy = !!price && !soldOut && maxBuy > 0 && amount <= maxBuy && !blocked;

    return (
        <div className={`panel ${RARITY_CLASS[sneaker.rarity]} flex flex-col h-full group`}>
            <div className="h-[3px] w-full" style={{ background: 'var(--rarity)' }} />

            <div className="relative h-32 bg-[var(--bg-sunken)] flex items-center justify-center p-3 overflow-hidden">
                <Img
                    src={sneaker.imageUrl}
                    alt={sneaker.name}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
                />
                {soldOut && (
                    <div className="absolute inset-0 bg-black/85 flex items-center justify-center">
                        <span className="font-display text-sm text-[var(--bad)] border border-[var(--bad)] px-2 py-1 -rotate-6">
                            SOLD OUT
                        </span>
                    </div>
                )}
                <span
                    className="absolute top-2 right-2 chip !text-[9px] !py-0.5"
                    style={{ borderColor: 'var(--rarity)', color: 'var(--rarity)' }}
                >
                    {sneaker.rarity}
                </span>
                {isFake && <span className="absolute top-2 left-2 chip chip-bad !text-[9px] !py-0.5">⚠ REP</span>}
            </div>

            <div className="p-3 flex flex-col flex-grow gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 min-h-[2.2em]" title={sneaker.name}>
                        {sneaker.name}
                    </h3>
                    <div className="flex items-baseline justify-between mt-1">
                        <span className={`numeric text-lg ${price ? 'text-[var(--ok)]' : 'text-[var(--ink-faint)]'}`}>
                            ${price?.toLocaleString() ?? '—'}
                        </span>
                        {owned.length > 0 && <span className="chip chip-accent !text-[9px] !py-0.5">Own {owned.length}</span>}
                    </div>
                </div>

                <div className="mt-auto space-y-2">
                    {!soldOut && price !== undefined && (
                        <>
                            <div className="flex items-center gap-1">
                                <button
                                    className={`btn btn-sm flex-1 ${method === 'cash' ? 'btn-accent' : 'btn-ghost'}`}
                                    onClick={() => setMethod('cash')}
                                >
                                    Cash ${priceFor(price, 'cash').toLocaleString()}
                                </button>
                                <button
                                    className={`btn btn-sm flex-1 ${method === 'card' ? 'btn-accent' : 'btn-ghost'}`}
                                    onClick={() => setMethod('card')}
                                >
                                    Card ${priceFor(price, 'card').toLocaleString()}
                                </button>
                            </div>
                            {/* Say why before the press, not after. A decline the
                                player could have predicted is a bug in the screen. */}
                            {blocked && <p className="label !text-[var(--bad)] leading-snug">{blocked}</p>}
                        </>
                    )}
                    {!soldOut && (
                        <div className="flex items-stretch gap-1.5">
                            <div className="flex items-center border border-[var(--line)] bg-[var(--bg-sunken)]">
                                <button
                                    className="px-2.5 text-[var(--ink-dim)] hover:text-white"
                                    onClick={() => setAmount(a => Math.max(1, a - 1))}
                                    aria-label="Fewer"
                                >−</button>
                                <span className="numeric w-6 text-center text-xs">{amount}</span>
                                <button
                                    className="px-2.5 text-[var(--ink-dim)] hover:text-white"
                                    onClick={() => setAmount(a => Math.min(maxBuy || 1, a + 1))}
                                    aria-label="More"
                                >+</button>
                            </div>
                            <button
                                className="btn btn-primary btn-sm flex-1"
                                disabled={!canBuy}
                                onClick={() => { buySneaker(sneaker.id, price!, amount, isFake, method); setAmount(1); }}
                            >
                                {room <= 0 ? 'Bag Full' : `Buy $${total.toLocaleString()}`}
                            </button>
                        </div>
                    )}
                    {onAnalyse && (
                        <button className="btn btn-ghost btn-sm w-full" onClick={onAnalyse}>Chart</button>
                    )}
                </div>
            </div>
        </div>
    );
};

/** Bag listing: shows true resale value, condition tags and blessing multipliers. */
export const InventorySneakerCard: React.FC<{
    sneaker: Sneaker;
    item: InventoryItem;
    marketPrice?: number;
    onSell?: () => void;
    onAnalyse?: () => void;
}> = ({ sneaker, item, marketPrice, onSell, onAnalyse }) => {
    const { gameState } = useGame();
    const sellPrice = marketPrice !== undefined ? getSellPrice(marketPrice, item, gameState.player) : undefined;
    const profit = sellPrice !== undefined ? sellPrice - item.purchasePrice : null;
    const blessed = (item.valueMultiplier ?? 1) > 1.01;

    return (
        <div className={`panel ${RARITY_CLASS[sneaker.rarity]} flex flex-col h-full`}>
            <div className="h-[3px] w-full" style={{ background: 'var(--rarity)' }} />

            <div className="relative h-28 bg-[var(--bg-sunken)] flex items-center justify-center p-3 overflow-hidden">
                <Img src={sneaker.imageUrl} alt={sneaker.name} loading="lazy" className="max-h-full max-w-full object-contain" />
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                    {item.isFake && <span className="chip chip-bad !text-[9px] !py-0.5">⚠ REPLICA</span>}
                    {blessed && (
                        <span className="chip !text-[9px] !py-0.5" style={{ borderColor: 'var(--legend)', color: 'var(--legend)' }}>
                            ✦ ×{(item.valueMultiplier ?? 1).toFixed(1)}
                        </span>
                    )}
                    {item.condition?.map(c => (
                        <span key={c} className="chip chip-warn !text-[9px] !py-0.5">{c}</span>
                    ))}
                </div>
            </div>

            <div className="p-3 flex flex-col flex-grow gap-2">
                <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2 min-h-[2.2em]">{sneaker.name}</h3>

                <dl className="text-[11px] font-mono space-y-0.5 text-[var(--ink-dim)]">
                    <div className="flex justify-between">
                        <dt>Sells for</dt>
                        <dd className="text-white numeric">{sellPrice !== undefined ? `$${sellPrice.toLocaleString()}` : '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                        <dt>Paid</dt>
                        <dd className="numeric">${item.purchasePrice.toLocaleString()}</dd>
                    </div>
                    {profit !== null && (
                        <div className="flex justify-between border-t border-[var(--line)] pt-0.5 mt-0.5">
                            <dt>P/L</dt>
                            <dd className="numeric font-bold" style={{ color: profit >= 0 ? 'var(--ok)' : 'var(--bad)' }}>
                                {profit >= 0 ? '+' : '−'}${Math.abs(profit).toLocaleString()}
                            </dd>
                        </div>
                    )}
                </dl>

                <div className="mt-auto flex gap-1.5">
                    {onAnalyse && <button className="btn btn-ghost btn-sm" onClick={onAnalyse}>Chart</button>}
                    {onSell && (
                        <button className="btn btn-primary btn-sm flex-1" disabled={sellPrice === undefined} onClick={onSell}>
                            Sell
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

/** Legacy default export kept so the store grid keeps working unchanged. */
const SneakerCard: React.FC<{
    sneaker: Sneaker;
    price?: number;
    quantity?: number;
    isFake?: boolean;
    variant?: 'store' | 'inventory';
    onAnalyse?: () => void;
}> = ({ variant = 'store', ...props }) => <StoreSneakerCard {...props} />;

export default SneakerCard;
