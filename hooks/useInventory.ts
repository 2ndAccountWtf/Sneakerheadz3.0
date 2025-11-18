
import { useMemo } from 'react';
import { UseInventoryOpts, SneakerItem } from '../types/shoestore';
import { useGame } from './useGame';
import { SNEAKERS } from '../data/sneakers';
import { MAX_OOS_ITEMS_TO_SHOW } from '../constants';

export function useInventory(opts: UseInventoryOpts): {
  items: SneakerItem[];
  total: number;
  loading: boolean;
  reload: () => void;
} {
    const { gameState } = useGame();
    const { currentCityId, markets, activeMarketSignals } = gameState;

    const items = useMemo(() => {
        const cityMarket = markets[currentCityId];
        if (!cityMarket) {
            return [];
        }

        const allItemsInMarket = cityMarket.sneakers
            // Filter first by the requested group (e.g. 'la.plug.fakes')
            .filter(marketSneaker => marketSneaker.group === opts.groupRef)
            .map((marketSneaker): SneakerItem | null => {
                const details = SNEAKERS.find(s => s.id === marketSneaker.sneakerId);
                if (!details) {
                    return null;
                }

                // --- APPLY MARKET SIGNALS ---
                let finalPrice = marketSneaker.price;
                const relevantSignals = activeMarketSignals.filter(signal => 
                    signal.targets.some(target => 
                        (target.kind === 'model' && target.value === details.id) ||
                        (target.kind === 'rarity' && target.value === details.rarity)
                    )
                );
                
                relevantSignals.forEach(signal => {
                    finalPrice *= signal.magnitude;
                });

                return {
                    ...details,
                    price: Math.round(finalPrice),
                    quantity: marketSneaker.quantity,
                    // Ensure we pass the fake status to the UI item
                    isFake: marketSneaker.isFake,
                };
            })
            .filter((item): item is SneakerItem => item !== null);
            
        // Filter and limit out-of-stock items
        const inStockItems = allItemsInMarket.filter(item => item.quantity > 0);
        const outOfStockItems = allItemsInMarket.filter(item => item.quantity <= 0);

        // Shuffle OOS items to show a random selection each time
        const visibleOOSItems = outOfStockItems
            .sort(() => 0.5 - Math.random())
            .slice(0, MAX_OOS_ITEMS_TO_SHOW);
        
        // Combine and sort for final display (e.g., by price)
        return [...inStockItems, ...visibleOOSItems].sort((a, b) => b.basePrice - a.basePrice);

    }, [currentCityId, markets, opts.groupRef, activeMarketSignals]);
    
    const loading = false;
    const total = items.length;

    const reload = () => {
        console.log('Reloading inventory...');
    };

    return {
        items,
        total,
        loading,
        reload,
    };
};
