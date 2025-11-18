
import type { AmbientNpcProfile } from '../../types/interactions';

export const SYSTEM_EVENTS: AmbientNpcProfile = {
    id: 'system-events',
    name: 'The Universe',
    portraitUrl: 'https://picsum.photos/seed/universe/200',
    scenarios: [
        {
            id: 'lucky-find-cash',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "While walking through the terminal, you spot a wallet on the floor. It's stuffed with cash!",
                    outcomes: [
                        { type: 'inventoryChange', add: [{ kind: 'currency', value: 'cash', qty: 250 }], description: "You gain $250." },
                        { type: 'notification', message: "You found $250!", description: "Lucky find!" }
                    ]
                }
            }
        },
        {
            id: 'lucky-find-sneaker',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "A box falls off the back of a delivery truck in front of you. You look inside and find a pristine pair of 'Velocity Vipers'!",
                    outcomes: [
                        { type: 'inventoryChange', add: [{ kind: 'item', value: 'velocity-vipers', qty: 1 }], description: "You found some sneakers!" },
                         { type: 'notification', message: "You found a pair of Velocity Vipers!", description: "Lucky find!" }
                    ]
                }
            }
        },
        // --- SHADY STORE EVENTS ---
        {
            id: 'police-raid',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "🚨 POLICE RAID! 🚨\n\n\"NOBODY MOVE! HANDS WHERE I CAN SEE THEM!\"",
                    choices: [
                        { playerLine: "Run for the back exit!", next: 'run' },
                        { playerLine: "Stay calm and bribe them.", next: 'bribe' },
                        { playerLine: "Surrender.", next: 'surrender' }
                    ]
                },
                run: {
                    npcLine: "You scramble through a hole in the fence. You drop something in the chaos.",
                    outcomes: [
                         { type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: "You lost a pair of kicks while running." },
                         { type: 'notification', message: "Escaped! But you dropped a pair of shoes.", description: "Escape penalty." }
                    ]
                },
                bribe: {
                    npcLine: "The officer looks at the cash. He nods and points to the door. \"Get lost.\"",
                    outcomes: [
                         { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: 500 }], description: "Bribe cost $500." },
                         { type: 'notification', message: "Wallet lighter, but you're free.", description: "Bribe successful." }
                    ]
                },
                surrender: {
                    npcLine: "They check your bag. \"Counterfeit goods. Confiscated.\"",
                    outcomes: [
                         { type: 'inventoryChange', remove: [{ kind: 'item', value: 'all-fakes', qty: 10 }], description: "All fakes confiscated." },
                         { type: 'notification', message: "The cops took all your fakes. At least you're not in jail.", description: "Goods confiscated." }
                    ]
                }
            }
        },
        {
            id: 'back-alley-mugging',
            startNode: 'intro',
            nodes: {
                intro: {
                    npcLine: "A figure steps out of the shadows holding a knife. \"Nice kicks. Give 'em here.\"",
                    choices: [
                        { playerLine: "Fight him!", next: 'fight' },
                        { playerLine: "Take the cash, leave the shoes.", next: 'pay' },
                    ]
                },
                fight: {
                    npcLine: "You throw a punch. It connects!",
                    outcomes: [
                         { type: 'stat_change', payload: { stat: 'health', value: -20 }, description: "You took a hit (-20 Health)." },
                         { type: 'streetCred', change: 10, description: "Word gets around you fought back." },
                         { type: 'notification', message: "He runs off. You're bleeding, but you have your pride.", description: "Fight result." }
                    ]
                },
                pay: {
                    npcLine: "\"Smart kid.\" He snatches the cash and vanishes.",
                    outcomes: [
                         { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: 200 }], description: "Lost $200." },
                         { type: 'notification', message: "You lost $200 but kept your shoes.", description: "Safe but costly." }
                    ]
                }
            }
        }
    ]
};
