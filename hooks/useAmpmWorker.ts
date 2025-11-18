import { useMemo } from 'react';
import { useGame } from './useGame';
import { AMBIENT_NPCS } from '../data/npcs';
import type { AmbientNpcProfile } from '../types/interactions';

// The ID of the wildcard worker who can appear anywhere
const WILDCARD_WORKER_ID = 'clerk-israeli-af';
const WILDCARD_SPAWN_CHANCE = 0.20; // 20%

// A map to associate cities with their local clerk IDs
const LOCAL_WORKER_MAP: Record<string, string> = {
    'tel-aviv': 'clerk-tel-aviv',
    'new-york': 'clerk-new-york',
    'los-angeles': 'clerk-los-angeles',
    'paris': 'clerk-paris',
    'chicago': 'clerk-chicago',
    'tokyo': 'clerk-tokyo',
};

export function useAmpmWorker(): AmbientNpcProfile | null {
    const { gameState } = useGame();
    const { currentCityId } = gameState;

    // useMemo ensures the worker is chosen only once per visit/render cycle, not on every re-render.
    const worker = useMemo(() => {
        let workerId: string;

        if (Math.random() < WILDCARD_SPAWN_CHANCE) {
            workerId = WILDCARD_WORKER_ID;
        } else {
            workerId = LOCAL_WORKER_MAP[currentCityId] || WILDCARD_WORKER_ID; // Fallback to wildcard if no local clerk
        }

        const workerProfile = AMBIENT_NPCS.find(npc => npc.id === workerId);
        
        if (!workerProfile) {
            console.error(`Could not find worker profile for ID: ${workerId}`);
            return null;
        }

        return workerProfile;

    }, [currentCityId]);

    return worker;
}