import type { CelebrityProfile } from '../../../types/npcs';
import { YASSER_ABBASFAT_DIALOGUE } from './dialogue';
import { YASSER_ABBASFAT_INTERACTIONS } from './interactions';

export const YASSER_ABBASFAT_PROFILE: CelebrityProfile = {
    id: 'yasser-abbasfat',
    name: 'Yasser Abbasfat',
    bio: 'A chaotic nuisance screaming about Falafelsteen, randomly robbing players, and blowing things up. Zero real market value — pure noise and chaos.',
    portraitUrl: 'https://picsum.photos/seed/yasser-abbasfat/200',
    
    spawnConditions: {
        // Spawns in chaotic, less-policed stores
        storeBrandKeys: ['plug', 'outlet', 'retro'],
        // Can be found in major hubs
        cityIds: ['new-york', 'los-angeles', 'tel-aviv', 'tokyo'],
    },

    eventTriggers: YASSER_ABBASFAT_INTERACTIONS,

    dialogue: YASSER_ABBASFAT_DIALOGUE,
};