import type { CelebrityDialogue } from '../../../types/npcs';

export const DONALD_DRIP_DIALOGUE: CelebrityDialogue = {
    // Player enters the store and sees him
    greeting: [
        "This place? It's okay. Not as good as my stores. My stores are tremendous.",
        "I'm looking for something... presidential. The best. Anything less is a disaster.",
        "Believe me, nobody knows more about sneakers than I do.",
    ],
    // Player buys a 'Legendary' sneaker while he's there
    onPlayerBuyLegendary: [
        "Good choice. Very good choice. Smart. Like me.",
        "That's a nice shoe. I have ten pairs. The best pairs.",
    ],
     // Player tries to sell a common sneaker
    onPlayerSellCommon: [
        "Sad. You're selling that? Total loser shoe. I wouldn't be caught dead.",
    ],
    // Triggering the Market Surge event
    triggerSurge: [
        "When I walk in, prices go up. It's called the Drip Effect. The best effect.",
    ],
    // Triggering the Paparazzi event
    triggerPaparazzi: [
        "Ugh, the fake news media again. They love me, they just can't admit it.",
    ],
};
