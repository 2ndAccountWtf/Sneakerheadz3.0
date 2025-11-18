import { DropSystemProps } from '../types/shoestore';

export function useRaffle(storeId: string, drops?: DropSystemProps): {
  open: boolean;
  entriesLeft: number;
  drawAt?: string;
  enter: (size: string) => Promise<boolean>;
} {
    const raffleDetails = drops?.raffle;

    const enterRaffle = async (size: string): Promise<boolean> => {
        console.log(`Entering raffle for size ${size} at store ${storeId}`);
        // Simulate API call
        return true;
    };
    
    return {
        open: raffleDetails?.open || false,
        entriesLeft: raffleDetails?.entryLimit || 0,
        drawAt: raffleDetails?.drawAt,
        enter: enterRaffle,
    };
};
