import type { AmbientNpcProfile } from '../../types/interactions';

export const CHICAGO_CLERK: AmbientNpcProfile = {
    id: 'clerk-chicago',
    name: 'Chicago Clerk',
    portraitUrl: 'https://picsum.photos/seed/chi-clerk/200',
    scenarios: [
        {
            id: 'chicago-greeting',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Buddy, that hot dog launcher? Best thing you’ll ever buy. Trust me on this one.",
                    outcomes: [
                        { type: 'notification', message: "The clerk gives you a firm, reassuring nod.", description: 'Flavor text.' }
                    ]
                }
            }
        }
    ]
};