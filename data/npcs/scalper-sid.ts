import type { AmbientNpcProfile } from '../../types/interactions';

export const SCALPER_SID: AmbientNpcProfile = {
    id: 'scalper-sid',
    name: 'Scalper Sid',
    portraitUrl: 'https://picsum.photos/seed/scalper-sid/200',
    scenarios: [
        {
            id: 'rare-map',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Psst. Hey. You look like you know what's up. I got something for you... a map. Leads to an underground drop happening right now in this city. Only $500.",
                    choices: [
                        { playerLine: "For $500? Is it legit?", next: 'question' },
                        { playerLine: "No thanks, man.", next: 'refuse' },
                    ]
                },
                question: {
                    npcLine: "Legit? It's the real deal. High-tier stuff. You'll make your money back tenfold. You in or out?",
                     choices: [
                        { playerLine: "Fine, I'll buy it.", next: 'buy' },
                        { playerLine: "I'm out.", next: 'refuse' },
                    ]
                },
                buy: {
                    npcLine: "Wise choice. Here you go.",
                    outcomes: [
                        { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: 500 }], description: "You lose $500." },
                        { type: 'notification', message: "You bought a 'map'. It's a crayon drawing of a back alley. You've been scammed.", description: "Player gets scammed." }
                    ]
                },
                refuse: {
                    npcLine: "Your loss, pal. Don't come crying to me when you see everyone else rocking the new heat.",
                    outcomes: [
                         { type: 'notification', message: "You walk away, leaving the scalper to find his next mark.", description: "Neutral outcome." }
                    ]
                }
            }
        }
    ]
};