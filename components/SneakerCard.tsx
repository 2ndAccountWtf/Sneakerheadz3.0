
import React, { useState } from 'react';
import type { Sneaker } from '../types';
import NavButton from './NavButton';
import { useGame } from '../hooks/useGame';
import { MAX_INVENTORY_SIZE } from '../constants';

interface SneakerCardProps {
    sneaker: Sneaker;
    price?: number;
    quantity?: number;
    actionButton?: React.ReactNode;
    purchasePrice?: number;
    variant?: 'inventory' | 'store';
    isFake?: boolean; // Explicitly pass fake status
}

const getRarityColor = (rarity: Sneaker['rarity']) => {
    switch (rarity) {
        case 'Common': return '#9ca3af'; // gray-400
        case 'Uncommon': return '#4ade80'; // green-400
        case 'Rare': return '#60a5fa'; // blue-400
        case 'Legendary': return '#fbbf24'; // amber-400
        default: return '#ffffff';
    }
};

const StoreSneakerCard: React.FC<Omit<SneakerCardProps, 'variant' | 'actionButton' | 'purchasePrice'>> = ({ sneaker, price, quantity, isFake }) => {
    const { gameState, buySneaker, sellSneaker } = useGame();
    const [buyAmount, setBuyAmount] = useState(1);

    const isSoldOut = quantity !== undefined && quantity <= 0;
    const rarityColor = getRarityColor(sneaker.rarity);
    
    const ownedItems = gameState.player.inventory.filter(item => item.sneakerId === sneaker.id);
    const hasOwned = ownedItems.length > 0;

    const maxCanBuy = Math.min(quantity || 0, MAX_INVENTORY_SIZE - gameState.player.inventory.length);
    const canBuy = price && !isSoldOut && (price * buyAmount <= gameState.player.cash) && buyAmount <= maxCanBuy && maxCanBuy > 0;

    const handleBuy = () => {
        if (price && canBuy) {
            buySneaker(sneaker.id, price, buyAmount, isFake);
            setBuyAmount(1);
        }
    };

    return (
        <div className="group relative w-full bg-gray-900/80 backdrop-blur-sm border border-gray-700 hover:border-gray-500 transition-all duration-300 overflow-hidden flex flex-col h-[24rem] rounded-sm shadow-lg hover:shadow-cyan-500/10">
            {/* Rarity Line */}
            <div className="h-1 w-full" style={{ backgroundColor: rarityColor }} />

            {/* Image Area */}
            <div className="relative h-40 w-full bg-black/50 flex items-center justify-center p-4 overflow-hidden">
                <img 
                    src={sneaker.imageUrl} 
                    alt={sneaker.name} 
                    className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3 filter drop-shadow-xl" 
                />
                {isSoldOut && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
                        <span className="text-3xl font-black text-red-500 -rotate-12 border-4 border-red-500 p-2">SOLD OUT</span>
                    </div>
                )}
                <div className="absolute top-2 right-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-black/80 border border-gray-700 text-gray-300 rounded-full">
                        {sneaker.rarity}
                    </span>
                </div>
            </div>

            {/* Info Area */}
            <div className="flex-grow p-4 flex flex-col justify-between">
                <div>
                    <h3 className="text-lg font-bold font-['Orbitron'] leading-tight text-white mb-1 truncate" title={sneaker.name}>
                        {sneaker.name}
                    </h3>
                    <div className="flex justify-between items-center">
                         <span className={`text-2xl font-bold font-['Space_Mono'] ${price ? 'text-green-400' : 'text-gray-500'}`}>
                            ${price?.toLocaleString() ?? '---'}
                        </span>
                        {hasOwned && <span className="text-xs text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded">Owned: {ownedItems.length}</span>}
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3 mt-4">
                    {!isSoldOut && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-black border border-gray-700 rounded overflow-hidden">
                                <button 
                                    onClick={() => setBuyAmount(Math.max(1, buyAmount - 1))}
                                    className="px-3 py-1 hover:bg-gray-800 text-gray-400 transition-colors"
                                >-</button>
                                <span className="w-8 text-center font-bold text-sm">{buyAmount}</span>
                                <button 
                                    onClick={() => buyAmount < maxCanBuy && setBuyAmount(buyAmount + 1)}
                                    className="px-3 py-1 hover:bg-gray-800 text-gray-400 transition-colors"
                                >+</button>
                            </div>
                            <NavButton onClick={handleBuy} disabled={!canBuy} className="flex-grow text-xs py-2" variant="primary">
                                Buy
                            </NavButton>
                        </div>
                    )}
                    
                    {hasOwned && price && (
                        <NavButton 
                            onClick={() => sellSneaker(ownedItems[0].instanceId, price)} 
                            className="w-full text-xs py-2" 
                            variant="danger"
                        >
                            Sell One
                        </NavButton>
                    )}
                </div>
            </div>
        </div>
    );
};

const InventorySneakerCard: React.FC<Omit<SneakerCardProps, 'variant'>> = ({ sneaker, price, actionButton, purchasePrice, isFake }) => {
    const rarityColor = getRarityColor(sneaker.rarity);
    const profit = price !== undefined && purchasePrice !== undefined ? price - purchasePrice : null;

    return (
        <div className="group relative bg-gray-900/80 backdrop-blur-sm border border-gray-700 hover:border-cyan-500/50 transition-all duration-300 p-4 flex flex-col h-full">
             <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: rarityColor }} />
             
             {isFake && (
                <div className="absolute top-2 right-2 z-20">
                    <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded border border-red-400 animate-pulse">
                        ⚠ REPLICA
                    </span>
                </div>
             )}

             <div className="relative h-32 mb-4 bg-black/30 rounded-lg flex items-center justify-center p-2 overflow-hidden">
                <img src={sneaker.imageUrl} alt={sneaker.name} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-500" />
             </div>

             <h3 className="font-bold text-white truncate mb-2">{sneaker.name}</h3>
             <div className="text-xs space-y-1 mb-4 text-gray-400">
                <div className="flex justify-between">
                    <span>Market:</span>
                    <span className="text-white font-bold">${price?.toLocaleString() ?? '---'}</span>
                </div>
                {purchasePrice !== undefined && (
                    <div className="flex justify-between">
                        <span>Paid:</span>
                        <span>${purchasePrice.toLocaleString()}</span>
                    </div>
                )}
                {profit !== null && (
                    <div className="flex justify-between border-t border-gray-800 pt-1 mt-1">
                        <span>P/L:</span>
                        <span className={`${profit >= 0 ? 'text-green-400' : 'text-red-400'} font-bold`}>
                            {profit >= 0 ? '+' : ''}${profit.toLocaleString()}
                        </span>
                    </div>
                )}
             </div>

             <div className="mt-auto">
                {actionButton}
             </div>
        </div>
    );
};

const SneakerCard: React.FC<SneakerCardProps> = ({ variant = 'inventory', ...props }) => {
    if (variant === 'store') {
        return <StoreSneakerCard {...props} />;
    }
    return <InventorySneakerCard {...props} />;
};

export default SneakerCard;
