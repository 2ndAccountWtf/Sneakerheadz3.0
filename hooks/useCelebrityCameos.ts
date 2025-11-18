
import { useMemo } from 'react';
import type { CelebrityProfile } from '../types/npcs';
import { ALL_CELEBRITIES } from '../data/celebrities';

export function useCelebrityCameos(cityId: string, storeId: string, storeBrandKey: string, weight: number | undefined): {
  cameoNow: CelebrityProfile | null;
  nextWindowMs: number;
} {
    const cameoNow = useMemo(() => {
        const potentialCameos = ALL_CELEBRITIES.filter(celeb => {
            // Check if the celebrity can spawn in the current city
            const cityMatch = !celeb.spawnConditions.cityIds || celeb.spawnConditions.cityIds.includes(cityId);
            
            // Check if the celebrity fits the store brand
            const brandMatch = !celeb.spawnConditions.storeBrandKeys || celeb.spawnConditions.storeBrandKeys.includes(storeBrandKey);

            return cityMatch && brandMatch;
        });

        if (potentialCameos.length === 0) {
            return null;
        }
        
        // Use the spawn chance weight from the store's config. 
        // Default to 0 if undefined, but we are updating configs to ensure this is set.
        const chance = weight !== undefined ? weight : 0;
        const hasCameo = Math.random() < chance;

        if (hasCameo) {
            // Return a random celebrity from the potential list for this location
            const randomIndex = Math.floor(Math.random() * potentialCameos.length);
            return potentialCameos[randomIndex];
        }

        return null;

    }, [cityId, storeId, storeBrandKey, weight]);
    
    return {
        cameoNow,
        nextWindowMs: 60000, // Cooldown: Check again in 1 minute
    };
};
