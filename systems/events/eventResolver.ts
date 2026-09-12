import type { TravelEventStub, EventCategory } from './categories';
import { THE_GAME_PROFILE } from '../../data/celebrities/the-game/index';
import { YASSER_ABBASFAT_PROFILE } from '../../data/celebrities/yasser-abbasfat/index';
import { BRO_JOGAN_PROFILE } from '../../data/celebrities/bro-jogan/index';
import { ALL_GAME_NPCS, findInteractionData } from '../../data/npcs';
import type { TravelContext } from './travelEngine';

interface ResolvedEvent {
    npcId: string;
    scenarioId: string;
}

/** Concrete scenarios each generic category can resolve to. */
const eventPool: Record<EventCategory, ResolvedEvent[]> = {
    mugging: [
        { npcId: THE_GAME_PROFILE.id, scenarioId: 'robbery-lace-snatcher' },
        { npcId: THE_GAME_PROFILE.id, scenarioId: 'robbery-gas-money' },
        { npcId: THE_GAME_PROFILE.id, scenarioId: 'robbery-subway-heist' },
    ],
    grandma: [
        { npcId: 'grandma-laces', scenarioId: 'the-game-gossip' },
    ],
    customs: [
        { npcId: 'tsa-agent', scenarioId: 'random-bag-check' },
    ],
    scalper: [
        { npcId: 'scalper-sid', scenarioId: 'rare-map' },
        { npcId: 'street-events', scenarioId: 'scalper-sting' },
    ],
    lucky: [
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
    snatch: [
        { npcId: 'street-events', scenarioId: 'snatch-and-run' },
    ],
    hustle: [
        { npcId: 'street-events', scenarioId: 'blacktop-challenge' },
    ],
    boxman: [
        { npcId: 'street-events', scenarioId: 'mystery-box-man' },
    ],
    authenticator: [
        { npcId: 'street-events', scenarioId: 'authentication-booth' },
    ],
    podcast: [
        { npcId: BRO_JOGAN_PROFILE.id, scenarioId: 'hypecast-roulette' },
    ],
};

export function resolveEventStub(stub: TravelEventStub, context: TravelContext): ResolvedEvent | null {
    const possibleEvents = eventPool[stub.category];
    if (!possibleEvents || possibleEvents.length === 0) return null;

    const valid = possibleEvents.filter(event => {
        // Drop anything whose dialogue doesn't exist rather than opening an
        // empty modal, which is what used to happen on a bad reference.
        const { scenario } = findInteractionData(event.npcId, event.scenarioId);
        if (!scenario) return false;

        const npc = ALL_GAME_NPCS.find(n => n.id === event.npcId);
        if (!npc) return false;

        if ('spawnConditions' in npc && npc.spawnConditions?.cityIds?.length) {
            return npc.spawnConditions.cityIds.includes(context.toCity);
        }
        return true;
    });

    if (valid.length === 0) return null;
    return valid[Math.floor(Math.random() * valid.length)];
}
