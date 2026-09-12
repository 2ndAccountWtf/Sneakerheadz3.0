
import { useMemo } from 'react';
import { useGame } from './useGame';
import { ShoeStoreNpcProps, BehaviorProps, NPCRef } from '../types/shoestore';
import { AMBIENT_NPCS } from '../data/npcs';
import { random, weightedChoice } from '../utils/odds';
import { AmbientNpcProfile } from '../types/interactions';

// A pool of generic NPCs who can appear as ambient patrons in a store if no specific profiles are set.
const GENERIC_PATRON_POOL = AMBIENT_NPCS.filter(npc => [
    'grandma-laces',
    'wiz-k',
    'gutter-gabe',
    'bibi',
    // ADC turns up wherever commerce is happening, which is the whole map.
    'adc',
].includes(npc.id));

export function useStoreNPCs(storeId: string, npcs: ShoeStoreNpcProps, behavior: BehaviorProps): {
  staff: { manager?: NPCRef; clerks: NPCRef[]; checker?: NPCRef };
  ambient: AmbientNpcProfile[];
  inviteHaggle: boolean;
  tradePitch: boolean;
  backroomWhisper: boolean;
} {
    const { gameState } = useGame();
    const hasBibiShoes = gameState.player.inventory.some(item => item.sneakerId === 'bibi-netas-iron-dome-1s');

    const spawnedNPCs = useMemo(() => {
        // --- Spawn Ambient NPCs ---
        const ambientMin = npcs.ambient?.min ?? 0;
        const ambientMax = npcs.ambient?.max ?? 0;
        const numToSpawn = random(ambientMin, ambientMax);
        
        const spawnedAmbient: AmbientNpcProfile[] = [];
        const spawnedIds = new Set<string>();

        let spawnPool: (AmbientNpcProfile & { weight: number })[] = [];

        // Try to build a pool from store-specific spawn profiles
        if (npcs.ambient?.spawnProfiles && npcs.ambient.spawnProfiles.length > 0) {
            spawnPool = npcs.ambient.spawnProfiles.map(p => {
                const npc = AMBIENT_NPCS.find(n => n.id === p.profileRef);
                return npc ? { ...npc, weight: p.weight } : null;
            }).filter((p): p is (AmbientNpcProfile & { weight: number }) => p !== null);
        }

        // If the specific profiles resulted in an empty pool (e.g., bad refs or no config), fall back to the generic pool.
        if (spawnPool.length === 0) {
            spawnPool = GENERIC_PATRON_POOL.map(p => ({ ...p, weight: 1 }));
        }

        // --- APPLY BIBI SHOE BONUS ---
        // Owning 'bibi-netas-iron-dome-1s' increases the chance of meeting Bibi.
        if (hasBibiShoes) {
            const bibiIndex = spawnPool.findIndex(p => p.id === 'bibi');
            if (bibiIndex !== -1) {
                // Increase his weight significantly to reflect the 15% bonus probability
                spawnPool[bibiIndex].weight += 3; 
            }
        }

        if (spawnPool.length > 0) {
            for (let i = 0; i < numToSpawn; i++) {
                // Filter out already spawned NPCs to ensure uniqueness
                const potentialSpawns = spawnPool.filter(p => !spawnedIds.has(p.id));
                if (potentialSpawns.length === 0) break; // No more unique NPCs to spawn from the pool

                const chosenNpc = weightedChoice(potentialSpawns);
                if (chosenNpc) {
                    spawnedAmbient.push(chosenNpc);
                    spawnedIds.add(chosenNpc.id);
                }
            }
        }

        // --- Find Staff NPCs ---
        const managerRef = npcs.staff?.managerRef;
        const manager = managerRef 
            ? AMBIENT_NPCS.find(npc => npc.id === managerRef) || { 
                id: managerRef, 
                name: managerRef.replace('manager-', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                portraitUrl: `https://picsum.photos/seed/${managerRef}/200`,
                scenarios: [],
             }
            : undefined;
        
        return {
            staff: { manager, clerks: [], checker: undefined },
            ambient: spawnedAmbient,
        };
    // The dependency array ensures this only runs once when the store ID or its config changes,
    // or if the player acquires the key item to trigger the spawn chance change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeId, hasBibiShoes]); 

    return {
        ...spawnedNPCs,
        inviteHaggle: Math.random() < (npcs.interactionWeights?.haggleInvite || 0),
        tradePitch: Math.random() < (npcs.interactionWeights?.tradePitch || 0),
        backroomWhisper: Math.random() < (npcs.interactionWeights?.backroomWhisper || 0),
    };
};
