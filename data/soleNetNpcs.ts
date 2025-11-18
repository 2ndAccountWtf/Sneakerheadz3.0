import type { SoleNetNpcProfile } from '../types/social';

export const SOLE_NET_NPCS: SoleNetNpcProfile[] = [
    {
        id: 'npc-prophet',
        handle: '@SneakerProphet',
        avatarUrl: 'https://picsum.photos/seed/prophet/100',
        type: 'insider',
        accuracy: 0.75,
        messagePool: {
            chatter: [],
            rumors: [
                "Heard a whisper... {sneaker_name} restock in {city_name} is imminent. Or it's a trap.",
                "Supply chain for {sneaker_rarity} kicks is looking shaky. Prices might jump.",
                "Don't sleep on the {sneaker_name}. Something big is coming.",
            ],
            dms: [
                "I've got a tip for you, but it'll cost you. Seeing a surge on {sneaker_name} in the next 24h.",
                "That last tip was solid, right? Got another one, but be careful. The market's volatile.",
            ],
        },
    },
    {
        id: 'npc-benny',
        handle: '@Boosted_Benny',
        avatarUrl: 'https://picsum.photos/seed/benny/100',
        type: 'influencer',
        messagePool: {
            chatter: [
                "Just unboxed the new {sneaker_name}. Fire or nah? 🔥",
                "Another day, another W. Copped three pairs of the {sneaker_name} drop.",
                "If you're not flipping, you're slipping. Easy money on the {sneaker_name} this week.",
                "Y'all still holding bricks? 💀",
            ],
            rumors: [],
            dms: [
                "Yo, saw your hustle. Keep it up. Respect.",
                "You copping the next drop? I got a link for my followers, might send it your way.",
            ],
        },
    },
    {
        id: 'npc-yoni',
        handle: '@BuyFromYoni',
        avatarUrl: 'https://picsum.photos/seed/yoni/100',
        type: 'bot',
        messagePool: {
            chatter: [
                "⚠️ LIMITED SLOTS for our new resale bot. 100% success rate on all major drops. DM for info.",
                "Stop taking Ls. Start winning. Our members are eating. #cookgroup",
                "FLASH SALE: 24-hour bot access for just $200. Don't miss out.",
            ],
            rumors: [],
            dms: [
                "I see you're serious about the game. For a small fee, I can guarantee you success on the next {sneaker_name} drop. Interested?",
                "Your payment for the bot access failed. Please provide your credit card details again to secure your slot.",
            ],
        },
    },
     {
        id: 'npc-sockgod',
        handle: '@SockGod69',
        avatarUrl: 'https://picsum.photos/seed/sockgod/100',
        type: 'chaos-agent',
        messagePool: {
            chatter: [
                "Bro sold his cat for Off-Whites. Peak capitalism achieved.",
                "BREAKING: Man arrested for trying to trade a baby for Travis Scott 1s.",
                "What if we're all just NPCs in someone else's sneaker flipping game?",
                "My therapist said I need to stop defining my self-worth by my W/L ratio on SNKRS.",
            ],
            rumors: [],
            dms: [
                "I dreamed you dropped a $10K Dunk. Is that a sign?",
                "Yo I'm stuck in customs. Can you wire me .001 BTC?",
            ],
        },
    },
];
