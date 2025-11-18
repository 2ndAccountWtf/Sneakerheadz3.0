import type { AmbientNpcProfile } from '../../types/interactions';

export const TSA_AGENT: AmbientNpcProfile = {
    id: 'tsa-agent',
    name: 'TSA Agent Thompson',
    portraitUrl: 'https://picsum.photos/seed/tsa-agent/200',
    scenarios: [
        {
            id: 'random-bag-check',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Alright, step aside please. Random bag check. What's in the bag?",
                    choices: [
                        { playerLine: "Just my sneakers, officer.", next: 'sneakers' },
                        { playerLine: "It's personal.", next: 'personal' },
                    ]
                },
                sneakers: {
                    npcLine: "Uh-huh. These 'Chrono Glides'... you got a receipt for these? They look... suspicious.",
                    choices: [
                        { playerLine: "Of course. Right here.", next: 'pass' },
                        { playerLine: "I, uh... lost it.", next: 'fail' },
                    ]
                },
                personal: {
                    npcLine: "Personal? That's what they all say. Open it up. Now.",
                    outcomes: [
                       { type: 'notification', message: "He confiscates a half-eaten bag of chips as 'evidence'.", description: "You lose some snacks." }
                    ]
                },
                pass: {
                    npcLine: "Everything seems to be in order. Move along.",
                    outcomes: [
                       { type: 'notification', message: "You passed the inspection without issues.", description: "Neutral outcome." }
                    ]
                },
                fail: {
                    npcLine: "No receipt? I'm going to have to confiscate these pending investigation. National security.",
                    outcomes: [
                        { type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: "You lose a random pair of sneakers." },
                        { type: 'notification', message: "The TSA agent confiscates one of your sneakers!", description: "Notifies player." }
                    ]
                }
            }
        }
    ]
};