
import { useMemo } from 'react';
import { UseInventoryOpts, SneakerItem } from '../types/shoestore';
import { useGame } from './useGame';
import { SNEAKERS } from '../data/sneakers';
import { MAX_OOS_ITEMS_TO_SHOW } from '../constants';
import { applySignals, getBuyPrice } from '../systems/pricing';

export function useInventory(opts: UseInventoryOpts): {
  items: SneakerItem[];
  total: number;
  loading: boolean;
  reload: () => void;
} {
    const { gameState } = useGame();
    const { currentCityId, markets, activeMarketSignals, day, player } = gameState;

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

                // News, rumours and scenario signals move the sticker price;
                // a store-discount buff then moves what the player actually pays.
                const signalled = applySignals(marketSneaker.price, details, activeMarketSignals, day, player);

                return {
                    ...details,
                    price: getBuyPrice(signalled, player),
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

    }, [currentCityId, markets, opts.groupRef, activeMarketSignals, day, player]);
    
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
