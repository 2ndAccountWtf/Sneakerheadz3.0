import type { AmbientNpcProfile } from '../../types/interactions';

export const TOKYO_CLERK: AmbientNpcProfile = {
    id: 'clerk-tokyo',
    name: 'Tokyo Clerk',
    portraitUrl: 'https://picsum.photos/seed/tokyo-clerk/200',
    scenarios: [
        {
            id: 'tokyo-politeness',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Your sneakers are… very unique. Please come again.",
                    outcomes: [
                        { type: 'notification', message: "The clerk gives a perfect, efficient bow.", description: 'Flavor text.' }
                    ]
                }
            }
        }
    ]
};