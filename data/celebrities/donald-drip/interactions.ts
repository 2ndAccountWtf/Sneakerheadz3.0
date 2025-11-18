
import type { CelebrityInteractions } from '../../../types/npcs';

export const DONALD_DRIP_INTERACTIONS: CelebrityInteractions = [
    {
        id: 'event-drip-market-surge',
        eventType: 'MARKET_SURGE',
        weight: 30,
        dialogueRef: 'triggerSurge',
        // Effect: Prices on 'Legendary' items in the store temporarily increase by 25%
        payload: {
            rarityTarget: 'Legendary',
            multiplier: 1.25,
            durationMinutes: 5,
        }
    },
    {
        id: 'event-drip-paparazzi',
        eventType: 'DISTRACTION',
        weight: 50,
        dialogueRef: 'triggerPaparazzi',
        // Effect: Store security level is temporarily reduced by 1
        payload: {
            securityModifier: -1,
            durationMinutes: 3,
        }
    },
    // Interactive Scenario: Just Chatting
    {
        id: 'chat-donald-drip',
        startNode: 'intro',
        nodes: {
            intro: {
                npcLine: "{{random_greeting}}",
                choices: [
                    { playerLine: "Can I get a selfie?", next: "selfie" },
                    { playerLine: "Any advice on the market?", next: "advice" },
                    { playerLine: "Just looking around.", next: "leave" }
                ]
            },
            selfie: {
                npcLine: "Make it quick. My time is money. A lot of money.",
                outcomes: [
                    { type: "notification", message: "You take a blurry selfie. He wasn't looking.", description: "Flavor." }
                ]
            },
            advice: {
                npcLine: "Buy high, sell higher. And always, always win. That's what I do.",
                outcomes: [
                    { type: "notification", message: "Groundbreaking advice received.", description: "Flavor." }
                ]
            },
            leave: {
                npcLine: "Smart move. Don't touch anything.",
                outcomes: []
            }
        }
    }
];
