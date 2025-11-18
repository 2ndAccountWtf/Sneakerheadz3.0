
import type { CelebrityInteractions } from '../../../types/npcs';

export const BRO_JOGAN_INTERACTIONS: CelebrityInteractions = [
    {
        id: 'event-jogan-podcast-pump',
        eventType: 'MARKET_SURGE',
        weight: 60, // High chance of triggering when he appears
        dialogueRef: 'market-hype', // Use lines from the market-hype category
        payload: {
            rarityTarget: 'Rare', // Pumps the price of Rare sneakers
            multiplier: 1.3, // 30% price increase
            durationMinutes: 10,
        }
    },
    // Interactive Scenario: Chat
    {
        id: 'chat-bro-jogan',
        startNode: 'intro',
        nodes: {
            intro: {
                npcLine: "{{random_greeting}}",
                choices: [
                    { playerLine: "Have you tried DMT?", next: "dmt" },
                    { playerLine: "Thoughts on the sneaker market?", next: "market" },
                    { playerLine: "[Nod silently]", next: "nod" }
                ]
            },
            dmt: {
                npcLine: "Bro. Look into it. It's like de-fragging your hard drive while meeting God.",
                outcomes: [
                    { type: "notification", message: "He talks for 20 minutes about elves.", description: "Flavor." }
                ]
            },
            market: {
                npcLine: "It's all a simulation, man. The prices aren't real. But the gains? The gains are spiritual.",
                outcomes: [
                    { type: "notification", message: "You feel spiritually enriched, or maybe just confused.", description: "Flavor." }
                ]
            },
            nod: {
                npcLine: "Exactly. You get it. Stay primal.",
                outcomes: []
            }
        }
    }
];
