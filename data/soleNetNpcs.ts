import type { SoleNetNpcProfile } from '../types/social';

export const SOLE_NET_NPCS: SoleNetNpcProfile[] = [
    {
        id: 'npc-adc',
        handle: '@ADC_Official',
        avatarUrl: 'https://picsum.photos/seed/adc/100',
        // 'chaos-agent' so her posts land in the Unhinged filter, where they belong.
        type: 'chaos-agent',
        messagePool: {
            chatter: [
                "Thread. 1/47.",
                "Nobody is talking about what {sneaker_name} does to the people who don't have it.",
                "I have been asked to stop posting about {city_name}. Consider who benefits from that request.",
                "Reminder that every price is a decision somebody made. About you. Personally.",
                "Was refused a discount today purely on the basis that I had not bought anything.",
                "If you are not uncomfortable you are not paying attention. If you are uncomfortable, that is also the system.",
                "Have you considered the systemic implications of that?",
                "I'm organising. I don't know what yet. But I'm organising.",
                "Update: the committee has formed a second committee. Progress.",
                "The {sneaker_rarity} designation is itself a hierarchy. I will be raising this.",
                "Someone in {city_name} said 'it's just shoes' to me today and I have not recovered.",
                "Correction to my earlier thread: it was a different war. The point stands.",
            ],
            rumors: [],
            dms: [
                "Hi! Quick one — you've been identified as economically advantaged. I'll send over the paperwork.",
                "Following up on the solidarity contribution. And the follow-up to the follow-up.",
                "I'm putting together a working group. There is catering. There is no agenda.",
                "You were seen entering a store. I'm not accusing you of anything. I'm documenting it.",
            ],
        },
    },
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
