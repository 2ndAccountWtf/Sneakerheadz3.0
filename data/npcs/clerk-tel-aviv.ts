import type { AmbientNpcProfile } from '../../types/interactions';

export const TEL_AVIV_CLERK: AmbientNpcProfile = {
    id: 'clerk-tel-aviv',
    name: 'Tel Aviv Clerk',
    portraitUrl: 'https://picsum.photos/seed/tlv-clerk/200',
    scenarios: [
        {
            id: 'tlv-flavor-1',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Yalla, chevre, listen — every night, same balagan, same people, same bureka. What to do?',
                    outcomes: [{ type: 'notification', message: 'The clerk sighs, gesturing at the store.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-2',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Achi, you know the hummus is fresh. Fresh! But you come in here, you look, you don’t buy. Why, why you do this?',
                    outcomes: [{ type: 'notification', message: 'He looks at you with genuine confusion.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-3',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Ehh, what, you don’t want the bag? Okay, no bag. But don’t come crying when bureka drip on your shoe.',
                    outcomes: [{ type: 'notification', message: 'He shrugs, already moving on.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-4',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'I tell you, today was crazy. One guy came in, bought chocolate milk, left without the change, came back, screaming — for what? Two shekel.',
                    outcomes: [{ type: 'notification', message: 'He shakes his head in disbelief.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-5',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Listen, I’m not angry, I’m just saying — this register, it’s possessed. I press button, it open by itself. Shaitan inside, I swear.',
                    outcomes: [{ type: 'notification', message: 'He eyes the cash register suspiciously.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-6',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Who is this guy outside, shouting about sneakers? Every night he is here, like clock, balagan with the laces.',
                    outcomes: [{ type: 'notification', message: 'He glances towards the door.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-7',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Ah, you want coffee? No coffee. Machine broken. Same like yesterday. And tomorrow. Don’t look at me like this, I don’t fix machines, achi.',
                    outcomes: [{ type: 'notification', message: 'He points a thumb at a sad-looking coffee machine.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-8',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'What, you want hummus at 3 AM? Take hummus, take laffa, live a little. Yalla.',
                    outcomes: [{ type: 'notification', message: 'He seems to approve of your late-night choice.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-9',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'You think this bag is normal? You think? Every time I open, it rips. Sadist design, mamash.',
                    outcomes: [{ type: 'notification', message: 'He holds up a flimsy plastic bag as evidence.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-10',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Excuse me, where is your ID? No ID, no cigarette. Don’t start with me, it’s the law, ach sheli.',
                    outcomes: [{ type: 'notification', message: 'He crosses his arms, unimpressed.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-11',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Balagan here last night, police, ambulance, some guy with scooter. I just wanted quiet shift. Quiet! Nothing is quiet here.',
                    outcomes: [{ type: 'notification', message: 'He looks exhausted just thinking about it.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-12',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Evan! Evan, look, you came again, ah? With the white shoes, clean clean, like wedding day. Respect.',
                    outcomes: [{ type: 'notification', message: 'He gives your sneakers an appreciative look.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-13',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Yalla, next. Fast, fast. What you want? Chips? Energy drink? Red Bull? Take and go, I have headache.',
                    outcomes: [{ type: 'notification', message: 'He rubs his temples.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-14',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Listen, listen, I don’t care about the politics, okay? You want hummus, buy hummus. No speeches in the store.',
                    outcomes: [{ type: 'notification', message: 'He holds up a hand to stop any potential arguments.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-15',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Why you standing there, like you wait for something magical to happen? It’s AMPM, not Disneyland, achi.',
                    outcomes: [{ type: 'notification', message: 'He gestures impatiently.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-16',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'One guy yesterday tried to pay with falafel coupon. Falafel coupon! What is this life?',
                    outcomes: [{ type: 'notification', message: 'He looks to the heavens for an answer.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-17',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'No bag? Sababa. Carry in your hands. Like real Tel Aviv guy. Minimalist, achla style.',
                    outcomes: [{ type: 'notification', message: 'He gives you a thumbs up.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-18',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'If I tell you the slushie machine story, you won’t sleep at night. Better you don’t ask.',
                    outcomes: [{ type: 'notification', message: 'He shudders slightly.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-19',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Excuse me, you think this is café? You think I have time for chat? Buy and yalla.',
                    outcomes: [{ type: 'notification', message: 'He points towards the exit.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-20',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'My cousin, he say Nike is spying through the apps. Me, I don’t know, maybe true, maybe not, but still — crazy, no?',
                    outcomes: [{ type: 'notification', message: 'He leans in conspiratorially.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-21',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Hoo, hoo, chevre, you see the guy in the corner? Don’t look. He owes money to everybody. Mamash everybody.',
                    outcomes: [{ type: 'notification', message: 'He subtly tilts his head.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-22',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'You want bureka? Take it now, because in five minutes, gone. Tel Aviv is hungry tonight.',
                    outcomes: [{ type: 'notification', message: 'The burekas in the warmer suddenly look very appealing.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-23',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'This bag, ah? Again ripping. Again! What is this design? If I see the guy who made it, I open his head, gently, but still open.',
                    outcomes: [{ type: 'notification', message: 'He demonstrates the bag\'s weakness.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-24',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Card, Bit, whatever. Just don’t bring coins. My brain cannot with the coins at night.',
                    outcomes: [{ type: 'notification', message: 'He waves a dismissive hand.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-25',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Why are you laughing? You think I don’t see? You laugh, I laugh, we all laugh, sababa, but pay first.',
                    outcomes: [{ type: 'notification', message: 'A slight grin appears on his face.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-26',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Listen, every shift someone tells me ‘bro, the hummus changed.’ The hummus never changes, achi. You change.',
                    outcomes: [{ type: 'notification', message: 'He says this with surprising philosophical weight.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-27',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Ohhh, chevre, last week we had dog in the store. Just walk in, take bag of chips, leave. No pay. Tel Aviv dog.',
                    outcomes: [{ type: 'notification', message: 'He sounds almost proud.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-28',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'I don’t understand why you wait in line if you don’t know what you want. Decide, decide, time is running.',
                    outcomes: [{ type: 'notification', message: 'He snaps his fingers for emphasis.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-29',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'You think it’s quiet now? Two minutes — boom, scooter gang, police, screaming, everything. Happens every night.',
                    outcomes: [{ type: 'notification', message: 'He looks at the clock, as if timing it.', description: 'Flavor text.' }]
                }
            }
        },
        {
            id: 'tlv-flavor-30',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'Take your chocolate milk and your lighter, and yalla, drive safe. Or walk. Or whatever you do.',
                    outcomes: [{ type: 'notification', message: 'It\'s the closest he gets to saying "have a nice day".', description: 'Flavor text.' }]
                }
            }
        }
    ]
};
