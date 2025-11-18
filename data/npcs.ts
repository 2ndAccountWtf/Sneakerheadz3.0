import { AMBIENT_NPCS } from './npcs/index';
import { ALL_CELEBRITIES } from './celebrities/index';
import type { AmbientNpcProfile, Scenario } from '../types/interactions';
import type { CelebrityProfile } from '../types/npcs';

// FIX: Export AMBIENT_NPCS so it can be imported by other modules like useAmpmWorker.
export { AMBIENT_NPCS };

export type GameNpc = (AmbientNpcProfile | CelebrityProfile) & { portraitUrl?: string };

export const ALL_GAME_NPCS: GameNpc[] = [
    ...AMBIENT_NPCS,
    ...ALL_CELEBRITIES,
];

// Helper to find an NPC and their scenario
export const findInteractionData = (npcId: string, scenarioId: string) => {
    const npc = ALL_GAME_NPCS.find(n => n.id === npcId);
    if (!npc) {
        console.error(`Could not find NPC with ID: ${npcId}`);
        return { npc: null, scenario: null };
    }
    
    let scenarios: any[] = [];
    if ('scenarios' in npc && npc.scenarios) {
        scenarios = npc.scenarios;
    } else if ('eventTriggers' in npc && npc.eventTriggers) {
        // Filter out store-only event triggers that are not interactive scenarios
        scenarios = npc.eventTriggers.filter(t => 'startNode' in t);
    }

    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) {
         console.error(`Could not find Scenario with ID: ${scenarioId} in NPC: ${npcId}`);
    }

    return { npc, scenario };
};
