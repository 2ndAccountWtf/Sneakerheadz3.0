import type { AmbientNpcProfile } from '../../types/interactions';

export const PARIS_CLERK: AmbientNpcProfile = {
    id: 'clerk-paris',
    name: 'Paris Clerk',
    portraitUrl: 'https://picsum.photos/seed/paris-clerk/200',
    scenarios: [
        {
            id: 'sneaker-judgment',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Monsieur, your sneakers… how you say… tragic.",
                    choices: [
                        { playerLine: "At least I’m not French.", next: 'insult' },
                        { playerLine: "Yeah, whatever. Just the coffee.", next: 'neutral' },
                        { playerLine: "These are limited drops.", next: 'defensive' }
                    ]
                },
                insult: {
                    npcLine: "Pah! For that, you will pay the tourist price. An extra ten percent.",
                    outcomes: [
                        { type: 'priceMarkup', multiplier: 1.1, duration: '24h', storeId: 'current', description: '+10% markup for 24 hours.' }
                    ]
                },
                neutral: {
                    npcLine: "Oui, the coffee.",
                    outcomes: [
                        { type: 'notification', message: "The clerk serves you with an air of indifference.", description: 'Neutral outcome.' }
                    ]
                },
                defensive: {
                    npcLine: "Limited, perhaps. But with no taste.",
                    outcomes: [
                        { type: 'notification', message: "The clerk rolls his eyes.", description: 'No change.' }
                    ]
                }
            }
        }
    ]
};