import type { TravelEventStub } from './categories';
import { THE_GAME_PROFILE } from '../../data/celebrities/the-game/index';
import { YASSER_ABBASFAT_PROFILE } from '../../data/celebrities/yasser-abbasfat/index';
import { ALL_GAME_NPCS } from '../../data/npcs';
import type { TravelContext } from './travelEngine';

interface ResolvedEvent {
    npcId: string;
    scenarioId: string;
}

// A pool of specific scenarios for each generic event category.
const eventPool: Record<TravelEventStub['category'], ResolvedEvent[]> = {
    'mugging': [
        { npcId: THE_GAME_PROFILE.id, scenarioId: 'robbery-lace-snatcher' },
        { npcId: THE_GAME_PROFILE.id, scenarioId: 'robbery-gas-money' },
        { npcId: THE_GAME_PROFILE.id, scenarioId: 'robbery-subway-heist' },
    ],
    'grandma': [
        { npcId: 'grandma-laces', scenarioId: 'the-game-gossip' },
    ],
    'customs': [
        { npcId: 'tsa-agent', scenarioId: 'random-bag-check' },
    ],
    'scalper': [
        { npcId: 'scalper-sid', scenarioId: 'rare-map' },
    ],
    'lucky': [
        { npcId: 'system-events', scenarioId: 'lucky-find-cash' },
        { npcId: 'system-events', scenarioId: 'lucky-find-sneaker' },
    ],
    'rare-chaos': [
        { npcId: YASSER_ABBASFAT_PROFILE.id, scenarioId: 'yasser-explosion' },
    ],
    'yasser-chaos': [
        { npcId: YASSER_ABBASFAT_PROFILE.id, scenarioId: 'yasser-robbery' },
        { npcId: YASSER_ABBASFAT_PROFILE.id, scenarioId: 'yasser-nonsense-rant' },
    ],
};


export function resolveEventStub(stub: TravelEventStub, context: TravelContext): ResolvedEvent | null {
    const possibleEvents = eventPool[stub.category];
    if (!possibleEvents || possibleEvents.length === 0) {
        console.error(`No events found for category: ${stub.category}`);
        return null;
    }

    // Filter events to only include NPCs that can spawn in the destination city.
    const locationFilteredEvents = possibleEvents.filter(event => {
        const npc = ALL_GAME_NPCS.find(n => n.id === event.npcId);
        if (!npc) {
            console.warn(`Could not find NPC profile for ID: ${event.npcId}`);
            return false;
        }

        // Check if the NPC has city-specific spawn conditions
        if ('spawnConditions' in npc && npc.spawnConditions.cityIds && npc.spawnConditions.cityIds.length > 0) {
            return npc.spawnConditions.cityIds.includes(context.toCity);
        }
        
        // If no city restrictions, the event is valid anywhere.
        return true;
    });

    if (locationFilteredEvents.length === 0) {
        console.warn(`No valid events for category '${stub.category}' in city '${context.toCity}'.`);
        return null;
    }

    // Pick a random event from the filtered pool for that category
    const randomIndex = Math.floor(Math.random() * locationFilteredEvents.length);
    return locationFilteredEvents[randomIndex];
}