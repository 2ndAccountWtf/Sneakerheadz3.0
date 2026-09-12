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

/**
 * Look up an NPC and one of their scenarios.
 *
 * Callers also use this to *probe* whether a scenario exists before starting an
 * interaction, so a miss is a normal result and is not logged.
 */
export const findInteractionData = (npcId: string, scenarioId: string) => {
    const npc = ALL_GAME_NPCS.find(n => n.id === npcId);
    if (!npc) {
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
    return { npc, scenario };
};
