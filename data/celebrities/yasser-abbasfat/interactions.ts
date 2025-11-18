
import type { Scenario } from '../../../types/interactions';

export const YASSER_ABBASFAT_INTERACTIONS: Scenario[] = [
    // General Chat Scenario
    {
        id: 'chat-yasser',
        startNode: 'intro',
        nodes: {
            intro: {
                npcLine: "{{random_greeting}}",
                choices: [
                    { playerLine: "What about the pigeons?", next: "pigeons" },
                    { playerLine: "Falafel or Shawarma?", next: "food" },
                    { playerLine: "[Back away]", next: "leave" }
                ]
            },
            pigeons: {
                npcLine: "SPIES! ALL OF THEM! THEY RECORD YOUR DREAMS!",
                outcomes: []
            },
            food: {
                npcLine: "FALAFEL IS FREEDOM! SHAWARMA IS COMPLEX!",
                outcomes: []
            },
            leave: {
                npcLine: "YOU CANNOT RUN FROM THE TRUTH!",
                outcomes: []
            }
        }
    },
    // Existing Scenarios
    {
      id: "yasser-robbery",
      startNode: "intro",
      nodes: {
        intro: {
          npcLine: "FREE FALAFELSTEEN! HAND OVER THE SNEAKERS NOW!",
          choices: [
            { playerLine: "Fine, take them.", next: "giveShoes" },
            { playerLine: "Try and take them.", next: "fightBack" },
            { playerLine: "Ignore him and walk away.", next: "walkAway" }
          ]
        },
        giveShoes: {
          npcLine: "THE RESISTANCE THANKS YOU FOR YOUR DONATION!",
          outcomes: [
            { type: "inventoryChange", remove: [{ kind: "item", value: "random-shoe", qty: 1 }], description: "A random sneaker is taken from your inventory." },
            { type: "notification", message: "You lose a random sneaker.", description: "Notifies the player of the lost item." }
          ]
        },
        fightBack: {
          npcLine: "YOU DARE DEFY FALAFELSTEEN?!",
          outcomes: [
            { type: "combat", result: "fight-roll", description: "Win = +5 street cred. Lose = injury debuff for 6 hours." },
            { type: "streetCred", condition: "win", change: 5, description: "Winning the fight earns you +5 street cred." }
          ]
        },
        walkAway: {
          npcLine: "COWARD! EVEN YOUR SLIDES ARE COWARDLY!",
          outcomes: [
            { type: "notification", message: "You avoid conflict but lose some local respect.", description: "Notifies the player of the reputation change." },
            { type: "reputation", change: -2, description: "Walking away results in a -2 reputation hit." }
          ]
        }
      }
    },
    {
        id: "yasser-explosion",
        startNode: "intro",
        nodes: {
            intro: {
                npcLine: "🚨 Yasser Abbasfat appears from a cloud of smoke, wearing a vest made of falafel balls.\n\nThe Game: \"THE MARKET WILL BURN LIKE THE HUMMUS OF THE OCCUPIERS!\"",
                choices: [
                    { playerLine: "What the...?", next: "detonate" },
                    { playerLine: "[Run away]", next: "run" }
                ]
            },
            detonate: {
                npcLine: "BOOM GOES THE ZIONIST ECONOMY!",
                outcomes: [
                    { type: "notification", message: "He detonates. You're hit by high-velocity falafel shrapnel. It's surprisingly delicious.", description: "Player is hit by falafel shrapnel." },
                    { type: "inventoryChange", remove: [{ kind: "currency", value: "cash", qty: 25 }], description: "You lose $25 in the chaos for 'cleaning fees'." }
                ]
            },
            run: {
                npcLine: "YOU CANNOT ESCAPE THE FALAFEL!",
                outcomes: [
                    { type: "notification", message: "You dive behind a kiosk just as he detonates. You are safe, but smell faintly of tahini.", description: "Player avoids damage." }
                ]
            }
        }
    },
    {
        id: "yasser-nonsense-rant",
        startNode: "intro",
        nodes: {
            intro: {
                npcLine: "🚨 A man on a soapbox is screaming at pigeons.\n\n\"BIBI CONTROLS THE PIGEONS, CONFIRMED! THEY ARE ZIONIST SPY DRONES!\"",
                choices: [
                    { playerLine: "Listen closer.", next: "listen" },
                    { playerLine: "Keep walking.", next: "walkAway" }
                ]
            },
            listen: {
                npcLine: "\"KANYE TEXTED ME. SAID HE’S FROM FALAFELSTEEN TOO. THE TRUTH IS OUT THERE!\"",
                outcomes: [
                    { type: "notification", message: "You listen for a moment, then decide you've heard enough.", description: "Flavor text." },
                    { type: "statusEffect", effect: "confused", duration: "1h", description: "You gain the 'Confused' status for 1 hour, slightly increasing prices." }
                ]
            },
            walkAway: {
                npcLine: "\"THE SKY? FAKE. THE CLOUDS? CGI! WAKE UP, SHEEPLE!\"",
                outcomes: [
                    { type: "notification", message: "You wisely decide to not get involved.", description: "Neutral outcome." }
                ]
            }
        }
    }
];
