import type { CelebrityProfile } from '../../../types/npcs';
import { BRO_JOGAN_DIALOGUE } from './dialogue';
import { BRO_JOGAN_INTERACTIONS } from './interactions';

export const BRO_JOGAN_PROFILE: CelebrityProfile = {
    id: 'bro-jogan',
    name: 'Bro Jogan',
    bio: 'Hype philosopher-podcaster. Conspiracies, elk, ice baths—and sudden market waves when episodes hit.',
    portraitUrl: 'https://picsum.photos/seed/bro-jogan/200',
    
    spawnConditions: {
        // Can spawn in high-traffic, hype-driven cities
        cityIds: ['los-angeles', 'new-york'],
        // Appears in high-end or trendy stores
        storeBrandKeys: ['gallery', 'luxury', 'boutique', 'neon'],
    },

    eventTriggers: BRO_JOGAN_INTERACTIONS,

    dialogue: BRO_JOGAN_DIALOGUE,
};