import type { AmbientNpcProfile } from '../../types/interactions';

export const GRANDMA_LACES: AmbientNpcProfile = {
    id: 'grandma-laces',
    name: 'Grandma Laces',
    portraitUrl: 'https://picsum.photos/seed/grandma-laces/200',
    scenarios: [
        {
            id: 'the-game-gossip',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Sweetheart, you buying that chocolate milk? Back in my day, The Game drank five of those and cried outside a Foot Locker.",
                    choices: [
                        { playerLine: "Tell me more.", next: 'gossip' },
                        { playerLine: "Yeah okay, Grandma.", next: 'neutral' },
                        { playerLine: "Stop lying, you’re crazy.", next: 'crazy' }
                    ]
                },
                gossip: {
                    npcLine: "He was upset about a bad investment in... I think it was called 'Pico-coin'? He said it was the future. Lost his shirt, poor thing.",
                    outcomes: [
                        { type: 'notification', message: "You've learned some rare gossip about The Game.", description: 'Unlocks rare gossip.' }
                    ]
                },
                neutral: {
                    npcLine: "You kids and your skepticism. Fine, don't believe me.",
                    outcomes: [
                        { type: 'notification', message: "Grandma Laces huffs and turns away.", description: 'No effect.' }
                    ]
                },
                crazy: {
                    npcLine: "CRAZY?! I'LL SHOW YOU CRAZY! BACK IN MY DAY WE USED ONIONS FOR LACES!",
                    outcomes: [
                        { type: 'statusEffect', effect: 'store-frozen', durationSeconds: 10, description: 'Store freezes for 10 seconds due to yelling.' },
                        { type: 'notification', message: "Grandma's screaming causes a scene. Everything stops for a moment.", description: 'Notifies player.' }
                    ]
                }
            }
        }
    ]
};