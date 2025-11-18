import { TradeSystemProps, HaggleState } from '../types/shoestore';

export function useTrade(storeId: string, trade?: TradeSystemProps): {
  appraise: (skuId: string) => { baseOffer: number; sweetSpot: [number, number] };
  startHaggle: (skuId: string, ask: number) => HaggleState;
} {
    const appraise = (skuId: string) => {
        // Mock appraisal logic
        const marketValue = 500; // Mock value
        const baseOffer = marketValue * (trade?.baseOfferPctOfMarket || 0.5);
        const sweetSpot = trade?.haggle?.sweetSpotRange || [0, 0];
        return {
            baseOffer,
            // FIX: Explicitly cast the `sweetSpot` array to a tuple `[number, number]` to match the return type signature.
            // TypeScript was inferring `number[]`, which is not assignable to a fixed-length tuple.
            sweetSpot: [baseOffer * sweetSpot[0], baseOffer * sweetSpot[1]] as [number, number],
        };
    };

    const startHaggle = (skuId: string, ask: number): HaggleState => {
        // Mock haggle state
        return { status: 'pending', offer: ask };
    };
    
    return { appraise, startHaggle };
};
