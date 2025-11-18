import type { AmbientNpcProfile } from '../../types/interactions';

export const GUTTER_GABE: AmbientNpcProfile = {
    id: 'gutter-gabe',
    name: 'Gutter Gabe',
    portraitUrl: 'https://picsum.photos/seed/gutter-gabe/200',
    scenarios: [
        {
            id: 'kick-shakedown',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Yo, those kicks… size 10? I could take those off your hands.",
                    choices: [
                        { playerLine: "Not for sale.", next: 'notForSale' },
                        { playerLine: "What’s your offer?", next: 'haggle' },
                        { playerLine: "Try me, bum.", next: 'robbery' }
                    ]
                },
                notForSale: {
                    npcLine: "Aight, aight. Keep your heat. For now.",
                    outcomes: [
                        { type: 'notification', message: "Gutter Gabe backs off... for now.", description: 'Gabe shrugs.' }
                    ]
                },
                haggle: {
                    npcLine: "Heh. Let's talk business.",
                    outcomes: [
                        { type: 'notification', message: "Haggling mini-game not yet implemented.", description: 'Starts haggle mini-game (NYI).' }
                    ]
                },
                robbery: {
                    npcLine: "Big words. Let's see if you can back 'em up.",
                    outcomes: [
                        { type: 'combat', opponentId: 'gutter-gabe', description: 'Triggers a robbery attempt.' }
                    ]
                }
            }
        }
    ]
};