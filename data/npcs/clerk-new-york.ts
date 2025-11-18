import type { AmbientNpcProfile } from '../../types/interactions';

export const NEW_YORK_CLERK: AmbientNpcProfile = {
    id: 'clerk-new-york',
    name: 'New York Clerk',
    portraitUrl: 'https://picsum.photos/seed/ny-clerk/200',
    scenarios: [
        {
            id: 'ny-attitude',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Yeah, whatever. Put it on the counter.",
                    outcomes: [
                        { type: 'notification', message: "The clerk looks like he hasn't slept in three days.", description: 'Flavor text.' }
                    ]
                }
            }
        }
    ]
};