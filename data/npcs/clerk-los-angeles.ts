import type { AmbientNpcProfile } from '../../types/interactions';

export const LOS_ANGELES_CLERK: AmbientNpcProfile = {
    id: 'clerk-los-angeles',
    name: 'Los Angeles Clerk',
    portraitUrl: 'https://picsum.photos/seed/la-clerk/200',
    scenarios: [
        {
            id: 'la-vibes',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Oh wow, kombucha again? Big detox energy. Love that for you.",
                    outcomes: [
                        { type: 'notification', message: "The clerk offers you a painfully sincere smile.", description: 'Flavor text.' }
                    ]
                }
            }
        }
    ]
};