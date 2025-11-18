import type { CelebrityProfile } from '../../../types/npcs';
import { THE_GAME_DIALOGUE } from './dialogue';
import { THE_GAME_INTERACTIONS } from './interactions';

export const THE_GAME_PROFILE: CelebrityProfile = {
    id: 'celeb-the-game',
    name: 'The Game',
    bio: 'A Compton legend with a complex past. One minute he\'s dropping lyrical science, the next he\'s trying to hustle you for a pair of beat-up Cortez. His loyalty is fierce, but his temper is short. Calls himself the "Bumlord of Compton" as a badge of honor for surviving the streets.',
    portraitUrl: 'https://picsum.photos/seed/the-game/200',
    
    spawnConditions: {
        cityIds: ['los-angeles'],
        storeBrandKeys: ['plug', 'retro'],
    },

    eventTriggers: THE_GAME_INTERACTIONS,

    dialogue: THE_GAME_DIALOGUE,
};