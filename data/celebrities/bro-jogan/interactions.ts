
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
    // Hypecast Roulette — he pulls you onto the live episode.
    {
        id: 'hypecast-roulette',
        startNode: 'intro',
        nodes: {
            intro: {
                npcLine: "Yo — yo, we're live. Sit down, put these on. No, we're LIVE live.\n\nI'm gonna say some things and the chat is gonna watch how you react. That's the whole bit. Don't overthink it. Actually, do overthink it. That's also the bit.",
                choices: [
                    { playerLine: "Put the headphones on.", next: "play" },
                    { playerLine: "\"I have absolutely nothing to say.\"", next: "decline" }
                ]
            },
            play: {
                npcLine: "That's the spirit. Three, two—",
                outcomes: [
                    { type: 'miniGame', game: 'hypecast-roulette', title: 'The Bro Jogan Experience', description: 'The ON AIR light comes on.' },
                    { type: 'marketSignal', condition: 'win', effect: 'surge', magnitude: 1.3, target: { kind: 'rarity', value: 'Rare' }, duration: '24h', description: 'He plugs a model on air and Rare pairs move.' },
                    { type: 'priceMarkup', condition: 'win', multiplier: 0.9, duration: '24h', description: 'Alpha Discount: 10% off everywhere for a day.' },
                    { type: 'statusEffect', condition: 'win', effect: 'guidance', duration: '24h', label: 'Podcast Intel', description: 'You heard which model is next.' },
                    { type: 'streetCred', condition: 'win', change: 10, description: 'The clip does numbers.' },
                    { type: 'streetCred', condition: 'lose', change: -6, description: 'He blocks you on air, with commentary.' },
                    { type: 'stat_change', condition: 'lose', payload: { stat: 'energy', value: -10 }, description: 'He talked about elk for an hour afterwards.' }
                ]
            },
            decline: {
                npcLine: "Respect. Silence is a frequency too, man.",
                outcomes: [
                    { type: 'notification', message: "He nods at you for a genuinely uncomfortable length of time.", description: '' }
                ]
            }
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
