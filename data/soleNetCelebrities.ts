import type { SoleNetNpcProfile } from '../types/social';
import { DONALD_DRIP_DIALOGUE } from './celebrities/donald-drip/dialogue';
import { THE_GAME_DIALOGUE } from './celebrities/the-game/dialogue';
import { YASSER_ABBASFAT_DIALOGUE } from './celebrities/yasser-abbasfat/dialogue';
import { BRO_JOGAN_DIALOGUE } from './celebrities/bro-jogan/dialogue';

import { DONALD_DRIP_INTERACTIONS } from './celebrities/donald-drip/interactions';
import { THE_GAME_INTERACTIONS } from './celebrities/the-game/interactions';
import { YASSER_ABBASFAT_INTERACTIONS } from './celebrities/yasser-abbasfat/interactions';
import { BRO_JOGAN_INTERACTIONS } from './celebrities/bro-jogan/interactions';
import { Scenario } from '../types/interactions';

// Helper to flatten the dialogue objects and extract intro lines from scenarios
const compileFullDialoguePool = (
    dialogue: Record<string, string[]>, 
    interactions: any[]
): string[] => {
    const dialogueLines = Object.values(dialogue).flat();
    
    const interactionLines = interactions
        .filter((interaction): interaction is Scenario => 'startNode' in interaction && interaction.startNode === 'intro' && interaction.nodes?.intro?.npcLine)
        .map(scenario => scenario.nodes.intro.npcLine.split('\n')[1] || scenario.nodes.intro.npcLine); // Extract the core line

    return [...dialogueLines, ...interactionLines];
};

export const SOLE_NET_CELEBRITIES: SoleNetNpcProfile[] = [
    {
        id: 'celeb-donald-drip',
        handle: '@TheRealDrip',
        avatarUrl: 'https://picsum.photos/seed/donald-drip/100',
        type: 'influencer',
        messagePool: {
            chatter: compileFullDialoguePool(DONALD_DRIP_DIALOGUE, DONALD_DRIP_INTERACTIONS),
            rumors: [],
            dms: [],
        },
    },
    {
        id: 'celeb-the-game',
        handle: '@TheGame',
        avatarUrl: 'https://picsum.photos/seed/the-game/100',
        type: 'chaos-agent',
        messagePool: {
            chatter: compileFullDialoguePool(THE_GAME_DIALOGUE, THE_GAME_INTERACTIONS),
            rumors: [],
            dms: [
                "Yo, you seen Chico? Tell him I got a package for him.",
                "Don't stare too long, blood. This ain't a zoo.",
            ],
        },
    },
    {
        id: 'celeb-yasser-abbasfat',
        handle: '@FreeFalafelsteen',
        avatarUrl: 'https://picsum.photos/seed/yasser-abbasfat/100',
        type: 'chaos-agent',
        messagePool: {
            chatter: compileFullDialoguePool(YASSER_ABBASFAT_DIALOGUE, YASSER_ABBASFAT_INTERACTIONS),
            rumors: [],
            dms: [
                "THE SNEAKERS ARE A LIE. ONLY HUMMUS IS REAL.",
                "DO NOT TRUST THE PIGEONS. THEY ARE SPIES.",
            ],
        },
    },
    {
        id: 'celeb-bro-jogan',
        handle: '@BroJoganEXP',
        avatarUrl: 'https://picsum.photos/seed/bro-jogan/100',
        type: 'influencer',
        messagePool: {
            chatter: compileFullDialoguePool(BRO_JOGAN_DIALOGUE, BRO_JOGAN_INTERACTIONS),
            rumors: [],
            dms: [
                "Bro, you gotta try this new elk-based pre-workout. Changes the game.",
                "You hitting the sauna later? 200 degrees or you're just playing.",
            ],
        },
    },
];