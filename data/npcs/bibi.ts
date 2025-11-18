
import type { AmbientNpcProfile } from '../../types/interactions';

const BIBI_DIALOGUE = {
    greeting: [
        "In moments of crisis, we do not panic. We do not hesitate. We act. Even in the sneaker market.",
        "Strength brings stability. Weakness invites chaos. This is true of nations and also… of resale prices.",
        "Israel is a lighthouse of reason in a storm of insanity. And you? You’re trying to flip Panda Dunks. I respect the hustle.",
        "History does not remember the timid. Buy with confidence.",
        "We will secure the market. We will discipline the volatility. This I promise you."
    ],
    security: [
        "Mossad has infiltrated the reseller networks. Don’t ask how I know. Just understand: we are already ahead.",
        "When the drop is limited, you must strike quickly, decisively — like Sayeret Matkal on a moonless night.",
        "The IDF has faced tougher enemies than sneaker bots.",
        "Our enemies talk. We act. Even in sneakers.",
        "I’ve launched military operations with less chaos than this StockX chart."
    ],
    history: [
        "Our people survived Babylon, Rome, the Inquisition, pogroms… and now, limited-edition hype shoes.",
        "In every generation someone rises to annihilate the Jewish people — yet here we are, thriving, flipping Noirs and Sambas.",
        "This is not merely a market. This is a chapter in a long story. Stand proudly within it.",
        "Even in ancient times, our ancestors knew quality leather. This is heritage."
    ],
    holidays: [
        "Just as we left Egypt with haste, you must check out immediately when the drop restocks.",
        "Reflect on your sins. Especially buying Yeezys at peak price.",
        "A small supply lasting eight days? You call that a miracle? We used to call that a SNKRS glitch.",
        "When the world feels upside-down, sometimes that is the plan."
    ],
    leadership: [
        "There are moments in history when evil reveals itself plainly. And in those moments, hesitation is not an option.",
        "We saw what happens when vigilance is abandoned. Never again — not in security, not in sovereignty, not in life.",
        "Strength is the duty of leadership. Weakness is the luxury of those who do not face existential threats."
    ],
    market: [
        "Order has been restored. Prices will rise.",
        "Chaos will not prevail — not while I am here.",
        "I have stabilized worse markets than this.",
        "Stay calm. This dip is temporary. The fundamentals remain strong."
    ],
    rivals: [
        "Yasser is noise. Just noise. A clown with no leverage.",
        "He screams, he threatens, and the world laughs. This is not power.",
        "While he throws falafel and tantrums, we build realities.",
        "I do not debate podcasters. I have a country to run.",
        "Let him plunge into cold water. I deal with real storms.",
        "Y Dol says many things. Most of them unserious.",
        "I’ve read intelligence reports more coherent than his tweets."
    ],
    praise: [
        "You show discipline. I appreciate that.",
        "Good. You acted quickly. The market rewards decisiveness.",
        "This is how nations are built — one strong choice at a time."
    ],
    one_liners: [
        "I’ve stood at the gates of war. A price dip does not frighten me.",
        "Where others see volatility, I see opportunity.",
        "Those who threaten us vanish. Those who doubt us learn.",
        "Strength. Stability. Strategy. These are the pillars of profit."
    ],
    exit: [
        "I must return to the real battlefield now.",
        "Your market is safe — for the moment.",
        "Do not falter. The world is watching.",
        "Stay alert. Weakness invites trouble."
    ]
};

export const BIBI: AmbientNpcProfile = {
    id: 'bibi',
    name: 'Bibi Neta',
    portraitUrl: 'https://picsum.photos/seed/bibi/200',
    dialogue: BIBI_DIALOGUE,
    scenarios: [
        // --- RARE SPEECHES (Cinematic, High Impact) ---
        {
            id: 'speech-market-endure',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Throughout our history, we have faced storms that sought to break us… and yet we endured.\nThis market? This volatility? Child’s play.\nStand firm, and the world will rise with you.",
                    outcomes: [
                        { type: 'marketSignal', effect: 'surge', magnitude: 1.35, target: { kind: 'model', value: 'global' }, description: 'Global market surge +35%.' },
                        { type: 'streetCred', change: 10, description: 'Player gets +10 street cred.' },
                        { type: 'statusEffect', effect: 'calm-markets', duration: '24h', description: 'Reduced volatility for 24h.' }
                    ]
                }
            }
        },
        {
            id: 'speech-strength',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "In security, in diplomacy, in the sneaker economy—strength creates stability.\nWeakness invites chaos.\nToday, we choose strength.",
                    outcomes: [
                        { type: 'marketSignal', effect: 'surge', magnitude: 1.20, target: { kind: 'model', value: 'global' }, description: 'Global market surge +20%.' },
                        { type: 'priceMarkup', multiplier: 0.9, duration: '24h', description: '10% discount buff in all stores.' }
                    ]
                }
            }
        },
        {
            id: 'speech-never-again',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "We said ‘Never Again,’ and we meant it.\nNever again will you buy high and sell low.\nNever again will ignorance defeat strategy.",
                    outcomes: [
                        { type: 'marketSignal', effect: 'surge', magnitude: 1.25, target: { kind: 'model', value: 'global' }, description: 'All inventory values increase +25%.' },
                    ]
                }
            }
        },
        {
            id: 'speech-resilience',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "We come from a people who rebuilt themselves from ashes.\nA dip in the market?\nThat is not a threat.\nThat is an opportunity.",
                    outcomes: [
                        { type: 'marketSignal', effect: 'surge', magnitude: 1.15, target: { kind: 'model', value: 'global' }, description: 'Global surge +15%.' },
                        { type: 'notification', message: "Bibi shares classified market intel.", description: 'Unlocks rare insight.' }
                    ]
                }
            }
        },
        {
            id: 'speech-vanish',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "There are forces that seek to undermine us…\nbut those who threaten us vanish.\nAnd the market knows this.",
                    outcomes: [
                        { type: 'statusEffect', effect: 'blessed', duration: '24h', description: "Bibi's Blessing: +15 luck for 24h." },
                        { type: 'marketSignal', effect: 'surge', magnitude: 1.50, target: { kind: 'rarity', value: 'Legendary' }, description: 'Legendary items spike +50%.' }
                    ]
                }
            }
        },

        // --- INTERACTIVE SCENARIOS ---

        // SCENARIO 1: State of the Market
        {
            id: 'bibi-state-market',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "Tell me… how do you approach this market? With fear, or with discipline?",
                    choices: [
                        { playerLine: "I strike quickly and decisively.", next: 'decisive' },
                        { playerLine: "I follow trends and hope for the best.", next: 'neutral' },
                        { playerLine: "It’s all luck anyway.", next: 'careless' },
                        { playerLine: "Teach me your ways, Bibi.", next: 'loyal' }
                    ]
                },
                decisive: {
                    npcLine: "Good. Decisiveness is the beginning of victory.",
                    outcomes: [
                        { type: 'streetCred', change: 8, description: '+8 Street Cred' },
                        { type: 'priceMarkup', multiplier: 0.95, duration: '24h', description: '5% buying discount for 24h.' },
                        { type: 'marketSignal', effect: 'surge', magnitude: 1.08, target: { kind: 'model', value: 'global' }, description: 'Small market surge.' }
                    ]
                },
                neutral: {
                    npcLine: "Hoping is not a strategy. But you can learn.",
                    outcomes: [
                        { type: 'notification', message: "He gives you small intel: 'Check the AF1 market tomorrow.'", description: 'Flavor intel.' }
                    ]
                },
                careless: {
                    npcLine: "No. Luck favors the prepared. Not the careless.",
                    outcomes: [
                        { type: 'streetCred', change: -5, description: '-5 Street Cred' },
                        { type: 'notification', message: "Bibi leaves early, unimpressed.", description: 'Interaction ends.' }
                    ]
                },
                loyal: {
                    npcLine: "I will. Listen carefully, and you will profit.",
                    outcomes: [
                        { type: 'statusEffect', effect: 'guidance', duration: '48h', description: 'Bibi Guidance Buff (Market Insight) for 48h.' }
                    ]
                }
            }
        },

        // SCENARIO 2: Threats to the Market
        {
            id: 'bibi-threats',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "There are clowns shouting in the streets… sowing chaos.\nHow do you respond to such noise?",
                    choices: [
                        { playerLine: "Ignore them. They’re irrelevant.", next: 'ignore' },
                        { playerLine: "Fight chaos with chaos.", next: 'fight' },
                        { playerLine: "I fear they’ll ruin everything…", next: 'fear' },
                        { playerLine: "Give me orders, and I’ll handle them.", next: 'orders' }
                    ]
                },
                ignore: {
                    npcLine: "Correct. Noise evaporates. Strength remains.",
                    outcomes: [
                        { type: 'statusEffect', effect: 'stable', duration: '24h', description: 'Market volatility reduced.' },
                        { type: 'streetCred', change: 6, description: '+6 Street Cred' }
                    ]
                },
                fight: {
                    npcLine: "Reckless… but bold.",
                    outcomes: [
                        { type: 'stat_change', payload: { stat: 'energy', value: 10 }, description: '+10 Energy' },
                        { type: 'notification', message: "Random shoe price fluctuates wildly.", description: 'Chaos increase.' }
                    ]
                },
                fear: {
                    npcLine: "Fear is the enemy of prosperity.",
                    outcomes: [
                        { type: 'streetCred', change: -3, description: '-3 Street Cred' },
                        { type: 'marketSignal', effect: 'collapse', magnitude: 0.95, target: { kind: 'model', value: 'global' }, description: 'Minor market dip (-5%).' }
                    ]
                },
                orders: {
                    npcLine: "Good. That is the attitude of a leader.",
                    outcomes: [
                        { type: 'statusEffect', effect: 'favored', duration: 'permanent', description: 'Player receives "Bibi Favored" status.' },
                        { type: 'marketSignal', effect: 'surge', magnitude: 1.25, target: { kind: 'rarity', value: 'random' }, description: 'Random inventory buff +25%.' }
                    ]
                }
            }
        },

        // SCENARIO 3: A Test of Loyalty
        {
            id: 'bibi-loyalty',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "One question:\nAre you with me… or with the chaos?",
                    choices: [
                        { playerLine: "With you. Always.", next: 'always' },
                        { playerLine: "With whoever profits me most.", next: 'practical' },
                        { playerLine: "I don’t pick sides.", next: 'neutral' },
                        { playerLine: "I’m with the chaos.", next: 'chaos' }
                    ]
                },
                always: {
                    npcLine: "Then prosperity awaits.",
                    outcomes: [
                        { type: 'streetCred', change: 15, description: '+15 Street Cred' },
                        { type: 'marketSignal', effect: 'surge', magnitude: 1.15, target: { kind: 'model', value: 'global' }, description: 'Global market +15%.' },
                        { type: 'statusEffect', effect: 'protection', duration: '72h', description: 'Special Travel Protection (Reduced Robberies).' }
                    ]
                },
                practical: {
                    npcLine: "Practical. I respect that.",
                    outcomes: [
                         { type: 'priceMarkup', multiplier: 1.05, duration: '24h', description: '+5% Resale Value for 24h.' }
                    ]
                },
                neutral: {
                    npcLine: "Indecision is defeat.",
                    outcomes: [
                        { type: 'notification', message: "Bibi turns away to check his phone.", description: 'No benefit.' }
                    ]
                },
                chaos: {
                    npcLine: "…Unwise.",
                    outcomes: [
                        { type: 'notification', message: "Bibi leaves immediately.", description: 'Bibi leaves.' },
                        { type: 'marketSignal', effect: 'collapse', magnitude: 0.75, target: { kind: 'model', value: 'global' }, description: 'Inventory value drops 25% for 48h.' }
                    ]
                }
            }
        }
    ]
};
