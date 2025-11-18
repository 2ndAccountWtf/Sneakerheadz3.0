import type { CelebrityProfile } from '../../../types/npcs';
import { DONALD_DRIP_DIALOGUE } from './dialogue';
import { DONALD_DRIP_INTERACTIONS } from './interactions';

export const DONALD_DRIP_PROFILE: CelebrityProfile = {
    id: 'celeb-donald-drip',
    name: 'Donald Drip',
    bio: 'A real estate mogul turned hypebeast icon, known for his towering golden sneakers and even more towering ego. Claims to have the best collection, the biggest collection. Everyone agrees.',
    portraitUrl: 'https://picsum.photos/seed/donald-drip/200',
    
    // Conditions for his appearance in a store
    spawnConditions: {
        minPlayerNetWorth: 100000,
        storeBrandKeys: ['luxury', 'gallery', 'consignment'],
        cityIds: ['new-york', 'los-angeles'],
    },

    // In-store events he can trigger
    eventTriggers: DONALD_DRIP_INTERACTIONS,

    // Library of his possible dialogue lines
    dialogue: DONALD_DRIP_DIALOGUE,
};