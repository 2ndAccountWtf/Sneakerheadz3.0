import type { AmbientNpcProfile } from '../../types/interactions';

export const WIZ_K: AmbientNpcProfile = {
    id: 'wiz-k',
    name: 'Wiz K',
    portraitUrl: 'https://picsum.photos/seed/wiz-k/200',
    scenarios: [
        {
            id: 'pizza-philosophy',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Yo… you ever think about how pizza is just flat bread with ambition?",
                    choices: [
                        { playerLine: "What are you smoking, bro?", next: 'smoking' },
                        { playerLine: "Yeah, that’s deep.", next: 'deep' },
                        { playerLine: "[Ignore him]", next: 'ignore' }
                    ]
                },
                smoking: {
                    npcLine: "Heh heh. The good stuff, man. The good stuff.",
                    outcomes: [
                        { type: 'notification', message: "Wiz K laughs to himself.", description: 'No effect.' }
                    ]
                },
                deep: {
                    npcLine: "Right? You get it. You're on the level.",
                    outcomes: [
                        { type: 'reputation', change: 1, target: 'wiz-k', description: 'Tiny rep boost with Wiz.' }
                    ]
                },
                ignore: {
                    npcLine: "...and like, what if the pepperoni is just, like, mapping out a new universe on the cheese, you know?",
                    outcomes: [
                        { type: 'notification', message: "You ignore him, but he keeps talking anyway.", description: 'No effect.' }
                    ]
                }
            }
        }
    ]
};