import type { AmbientNpcProfile } from '../../types/interactions';

/**
 * Street encounters that hand off to a mini-game.
 *
 * These are the "bizarre shit that happens because you exist in this world"
 * events: a snatch-and-run, a folding table with a UV lamp, a man with three
 * boxes, a pickup game you did not agree to. Each one is a normal branching
 * scenario whose terminal node launches a game and carries the win/lose
 * payouts with it.
 */
export const STREET_EVENTS: AmbientNpcProfile = {
    id: 'street-events',
    name: 'The Street',
    portraitUrl: 'https://picsum.photos/seed/streetevents/200',
    scenarios: [
        // --- SNATCH AND RUN ---
        {
            id: 'snatch-and-run',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'A kid on an e-scooter clips your shoulder, and the box is out of your hand before you register the impact.\n\nHe does not look back. He is already three lanes into traffic.',
                    choices: [
                        { playerLine: 'Run him down.', next: 'chase' },
                        { playerLine: 'Shout. Loudly. Achieve nothing.', next: 'shout' },
                        { playerLine: 'Let it go. It was insured. It was not insured.', next: 'concede' },
                    ],
                },
                chase: {
                    npcLine: 'You drop everything and go.',
                    outcomes: [
                        {
                            type: 'miniGame',
                            game: 'sneaker-chase',
                            title: 'Snatch And Run',
                            config: { thief: 'Scooter Kid' },
                            description: 'You give chase.',
                        },
                        { type: 'inventoryChange', condition: 'win', add: [{ kind: 'item', value: 'random-rare', qty: 1 }], description: 'You get the box back. It was not even the one he took.' },
                        { type: 'streetCred', condition: 'win', change: 7, description: 'Half the street watched you catch him.' },
                        { type: 'inventoryChange', condition: 'lose', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'The box is gone.' },
                        { type: 'stat_change', condition: 'lose', payload: { stat: 'energy', value: -20 }, description: 'You are bent double in traffic for nothing.' },
                    ],
                },
                shout: {
                    npcLine: 'You shout. People look at you, not at him. He turns a corner.',
                    outcomes: [
                        { type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'Gone.' },
                        { type: 'streetCred', change: -2, description: 'Standing in the road yelling is not a good look.' },
                    ],
                },
                concede: {
                    npcLine: 'You watch him go. There is a strange peace in it.',
                    outcomes: [
                        { type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'You let it go.' },
                        { type: 'stat_change', payload: { stat: 'health', value: 5 }, description: 'Your blood pressure thanks you.' },
                    ],
                },
            },
        },

        // --- THE FAKE AUTHENTICATION BOOTH ---
        {
            id: 'authentication-booth',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'A folding table. A UV lamp. A laminated sign: "AUTHENTICITY CHECK — $20".\n\nThe man behind it does not blink. "You want to know if they real? I tell you if they real."',
                    choices: [
                        { playerLine: 'Pay him. Test his eye.', next: 'test' },
                        { playerLine: '"How about I check yours instead?"', next: 'challenge' },
                        { playerLine: 'Keep walking.', next: 'leave' },
                    ],
                },
                test: {
                    npcLine: 'He takes the twenty without looking at it and slides a box across the table. "This one. You tell ME."',
                    outcomes: [
                        { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: 20 }], description: 'The fee, paid up front.' },
                        { type: 'miniGame', game: 'legit-check', title: 'Authentication Booth', config: { sneakerName: 'his mystery pair' }, description: 'He lays out what he can see.' },
                        { type: 'inventoryChange', condition: 'win', add: [{ kind: 'currency', value: 'cash', qty: 260 }], description: 'He pays you for the call, then offers you a job.' },
                        { type: 'streetCred', condition: 'win', change: 6, description: 'Word gets around that you know.' },
                        { type: 'streetCred', condition: 'lose', change: -5, description: 'He tells everyone at the table you were wrong.' },
                    ],
                },
                challenge: {
                    npcLine: 'He goes very still. Then he laughs, hard, and hands you a bag. "I like you. Take this. Do not open it here."',
                    outcomes: [
                        { type: 'inventoryChange', add: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'A pair, in a bag, with no explanation.' },
                        { type: 'streetCred', change: 3, description: 'You talked to him like an equal.' },
                    ],
                },
                leave: {
                    npcLine: '"Fine! Walk! Everyone walks! Nobody wants the truth!" He says this to nobody in particular.',
                    outcomes: [],
                },
            },
        },

        // --- THE MYSTERY BOX MAN ---
        {
            id: 'mystery-box-man',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: '"You want mystery box? Is very good. Probably."\n\nThree boxes. Three prices. He has not told you what is in any of them, because he does not know.',
                    choices: [
                        { playerLine: 'Show me the boxes.', next: 'browse' },
                        { playerLine: '"What is in them?"', next: 'ask' },
                        { playerLine: 'Absolutely not.', next: 'leave' },
                    ],
                },
                ask: {
                    npcLine: '"If I know what is inside, is not mystery box. Is just box. Box is cheaper but less exciting."',
                    choices: [
                        { playerLine: 'Fair. Show me.', next: 'browse' },
                        { playerLine: 'Still no.', next: 'leave' },
                    ],
                },
                browse: {
                    npcLine: 'He gestures at the table with enormous confidence.',
                    outcomes: [
                        { type: 'miniGame', game: 'mystery-box', title: 'Back-Alley Mystery Box', description: 'You approach the table.' },
                    ],
                },
                leave: {
                    npcLine: '"Okay. But you will think about it later. Everyone thinks about it later."',
                    outcomes: [],
                },
            },
        },

        // --- STREET BASKETBALL ---
        {
            id: 'blacktop-challenge',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'A man in jeans and the exact shoes you are carrying blocks the sidewalk.\n\n"Those are nice. You actually hoop in those, or you just carry them around?"',
                    choices: [
                        { playerLine: 'Put money on it.', next: 'wager' },
                        { playerLine: 'Play him for nothing.', next: 'friendly' },
                        { playerLine: '"I just carry them around."', next: 'honest' },
                    ],
                },
                wager: {
                    npcLine: '"Two hundred. First to five. Make it take it." He is already stretching.',
                    outcomes: [
                        { type: 'miniGame', game: 'street-ball', title: 'Blacktop Wager', config: { opponent: 'Man In Jeans' }, description: 'The court fills up to watch.' },
                        { type: 'inventoryChange', condition: 'win', add: [{ kind: 'currency', value: 'cash', qty: 200 }], description: 'He pays, slowly, in tens.' },
                        { type: 'streetCred', condition: 'win', change: 9, description: 'You won money on a public court. That travels.' },
                        { type: 'inventoryChange', condition: 'lose', remove: [{ kind: 'currency', value: 'cash', qty: 200 }], description: 'You pay, slowly, in whatever you have.' },
                        { type: 'streetCred', condition: 'lose', change: -3, description: 'They are still talking about it.' },
                    ],
                },
                friendly: {
                    npcLine: '"Respect. Just ball then." He checks it up.',
                    outcomes: [
                        { type: 'miniGame', game: 'street-ball', title: 'Pickup Game', config: { opponent: 'Man In Jeans' }, description: 'No money. Just the game.' },
                        { type: 'streetCred', condition: 'win', change: 6, description: 'You won and did not take his money. That travels further.' },
                        { type: 'stat_change', condition: 'lose', payload: { stat: 'energy', value: -12 }, description: 'You are wrecked and you lost.' },
                    ],
                },
                honest: {
                    npcLine: 'He considers this for a long moment. "…Yeah. Yeah, that\'s fair." He shakes your hand and walks off.',
                    outcomes: [
                        { type: 'streetCred', change: 1, description: 'Honesty is rare enough to be memorable.' },
                    ],
                },
            },
        },

        // --- THE SCALPER STING ---
        {
            id: 'scalper-sting',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: 'A van door slides open. "Ten pairs. Half price. Cash only, and you take all ten."\n\nThe boxes look right. The van does not.',
                    choices: [
                        { playerLine: 'Buy the lot.', next: 'buy' },
                        { playerLine: 'Check one first.', next: 'inspect' },
                        { playerLine: 'Walk away fast.', next: 'walk' },
                        { playerLine: 'Call the police.', next: 'snitch' },
                    ],
                },
                buy: {
                    npcLine: 'He takes the cash, hands you the bag, and the van is moving before the door shuts.',
                    outcomes: [
                        { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: 800 }], description: 'Eight hundred, gone.' },
                        { type: 'inventoryChange', add: [{ kind: 'item', value: 'random-sneaker', qty: 2 }], description: 'Two pairs. The other eight boxes are bricks.' },
                        { type: 'heat', change: 15, description: 'Those boxes were reported stolen this morning.' },
                    ],
                },
                inspect: {
                    npcLine: 'You open a box. He watches you do it, which tells you everything.',
                    outcomes: [
                        { type: 'miniGame', game: 'legit-check', title: 'Van Inspection', config: { sneakerName: 'the pair from the van' }, description: 'You check it properly.' },
                        { type: 'inventoryChange', condition: 'win', add: [{ kind: 'item', value: 'random-rare', qty: 1 }], description: 'You call it, he respects it, and sells you the one good pair at cost.' },
                        { type: 'streetCred', condition: 'win', change: 5, description: 'He takes your number.' },
                        { type: 'inventoryChange', condition: 'lose', remove: [{ kind: 'currency', value: 'cash', qty: 400 }], description: 'You bought the wrong one, confidently.' },
                    ],
                },
                walk: {
                    npcLine: 'You keep moving. Two streets later you hear sirens behind you.',
                    outcomes: [
                        { type: 'heat', change: -5, description: 'Whatever that was, you were not there for it.' },
                    ],
                },
                snitch: {
                    npcLine: 'The van is gone before anyone arrives. Somebody in the crowd saw you make the call.',
                    outcomes: [
                        { type: 'heat', change: -15, description: 'You are on record as one of the good ones.' },
                        { type: 'streetCred', change: -12, description: 'You are also, now, a snitch.' },
                    ],
                },
            },
        },
    ],
};
