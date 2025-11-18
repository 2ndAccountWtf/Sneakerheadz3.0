
import type { Scenario } from '../../../types/interactions';

// These scenarios, provided by the architect, define the "ironic robbery"
// interactive events for The Game.
export const THE_GAME_INTERACTIONS: Scenario[] = [
    // General Chat Scenario
    {
        id: 'chat-the-game',
        startNode: 'intro',
        nodes: {
            intro: {
                npcLine: "{{random_greeting}}",
                choices: [
                    { playerLine: "What's good in Compton?", next: "compton" },
                    { playerLine: "Seen any fake Jordans?", next: "fakes" },
                    { playerLine: "Just browsing.", next: "leave" }
                ]
            },
            compton: {
                npcLine: "Same as always. Grind or get ground. You know how it is.",
                outcomes: []
            },
            fakes: {
                npcLine: "Everywhere. Even on your feet, maybe. Nah, I'm playing. Maybe.",
                outcomes: []
            },
            leave: {
                npcLine: "Stay dangerous.",
                outcomes: []
            }
        }
    },
    // Existing Scenarios
    {
      "id": "robbery-subway-heist",
      "startNode": "intro",
      "nodes": {
        "intro": {
          "npcLine": "🚨 A beat-up Impala screeches to a stop. The Game jumps out, looking hungry.\n\nThe Game: \"Yo. Hand it over.\"",
          "choices": [
            { "playerLine": "Hand what over?", "next": "explain" },
            { "playerLine": "No. It’s my sandwich.", "next": "refuse" },
            { "playerLine": "Here, take it, man. You need this.", "next": "giveSandwich" }
          ]
        },
        "explain": {
          "npcLine": "The Game: \"That 6-inch Subway. Turkey on wheat. Don’t play with me.\"",
          "choices": [
            { "playerLine": "Bro... it’s half-eaten.", "next": "takeHalf" },
            { "playerLine": "Fine, take the whole thing.", "next": "giveSandwich" }
          ]
        },
        "refuse": {
          "npcLine": "The Game: \"Bet. No sandwich? Bet. See you in the parking lot.\"",
          "outcomes": [
            {
              "type": "combat",
              "result": "fight-roll",
              "description": "Fight over a half-eaten Subway sandwich. Win = +2 street cred. Lose = you lose the sandwich and a little cash."
            },
            {
              "type": "streetCred",
              "condition": "win",
              "change": 2,
              "description": "People respect you slightly for not folding over a sandwich."
            }
          ]
        },
        "giveSandwich": {
          "npcLine": "The Game: \"Smart. Toasted or not, food is food.\"",
          "outcomes": [
            {
              "type": "inventoryChange",
              "remove": [{ "kind": "item", "value": "sandwich", "qty": 1 }],
              "description": "You lose your sandwich."
            },
            // FIX: Added missing 'description' property to conform to the ScenarioOutcome type.
            {
              "type": "notification",
              "message": "The Game takes the sandwich and mumbles something about protein.",
              "description": "Player is notified about The Game's reaction."
            }
          ]
        },
        "takeHalf": {
          "npcLine": "The Game: \"I’ll take the half. Respect the grind.\"",
          "outcomes": [
            {
              "type": "inventoryChange",
              "remove": [{ "kind": "item", "value": "sandwich", "qty": 0.5 }],
              "description": "You lose half your sandwich."
            },
            // FIX: Added missing 'description' property to conform to the ScenarioOutcome type.
            {
              "type": "notification",
              "message": "The Game takes the half sandwich and struts off like he just flipped a grail.",
              "description": "Player is notified about The Game's action."
            }
          ]
        }
      }
    },
    {
      "id": "robbery-lace-snatcher",
      "startNode": "intro",
      "nodes": {
        "intro": {
          "npcLine": "🚨 You feel someone lurking. The Game approaches, sizing up your sneakers.\n\nThe Game: \"Nice kicks. Fire. But I’m gonna need… one lace.\"",
          "choices": [
            { "playerLine": "…One lace?", "next": "explain" },
            { "playerLine": "No, you’re not taking my lace.", "next": "refuse" },
            { "playerLine": "Fine, take the lace.", "next": "giveLace" }
          ]
        },
        "explain": {
          "npcLine": "The Game: \"Yeah, bro. Just one. Left shoe. Respect the hustle.\"",
          "choices": [
            { "playerLine": "Whatever. Take it.", "next": "giveLace" },
            { "playerLine": "This is ridiculous. Back off.", "next": "refuse" }
          ]
        },
        "refuse": {
          "npcLine": "The Game: \"Life don’t make sense. Neither do these laces. Hand it over or square up.\"",
          "outcomes": [
            {
              "type": "combat",
              "result": "fight-roll",
              "description": "Fight over a lace. Win = +3 street cred. Lose = lose the lace and get mocked."
            },
            {
              "type": "streetCred",
              "condition": "win",
              "change": 3,
              "description": "Local respect: you don’t let washed-up rappers punk you."
            }
          ]
        },
        "giveLace": {
          "npcLine": "The Game: \"Life don’t make sense. Gimme the lace.\"",
          "outcomes": [
            {
              "type": "inventoryChange",
              "remove": [{ "kind": "item", "value": "shoe-lace", "qty": 1 }],
              "description": "You lose one lace from a random pair."
            },
            {
              "type": "statusEffect",
              "apply": { "tag": "scuffed", "durationHrs": 6 },
              "description": "Your sneaker gets a temporary 'Scuffed' tag, reducing sale price by 5% until repaired."
            },
            // FIX: Added missing 'description' property to conform to the ScenarioOutcome type.
            {
              "type": "notification",
              "message": "The Game ties the lace around his wrist like a bracelet and disappears.",
              "description": "Player is notified about The Game taking the lace."
            }
          ]
        }
      }
    },
    {
      "id": "robbery-gas-money",
      "startNode": "intro",
      "nodes": {
        "intro": {
          "npcLine": "🚨 You’re walking past a gas station. The Game leans out the window of a rusty Civic.\n\nThe Game: \"Yo, homie. Gas prices crazy right now. Lemme hold… like… five bucks.\"",
          "choices": [
            { "playerLine": "You’re robbing me for $5?", "next": "argue" },
            { "playerLine": "Fine, here’s $5.", "next": "pay" },
            { "playerLine": "No way.", "next": "refuse" }
          ]
        },
        "argue": {
          "npcLine": "The Game: \"Nah, bro. This is an investment. Think of it like… equity.\"",
          "choices": [
            { "playerLine": "This is literally a robbery.", "next": "pay" },
            { "playerLine": "Not happening.", "next": "refuse" }
          ]
        },
        "pay": {
          "npcLine": "The Game: \"Semantics. Hand it over.\"",
          "outcomes": [
            {
              "type": "inventoryChange",
              "remove": [{ "kind": "currency", "value": "cash", "qty": 5 }],
              "description": "You lose $5."
            },
            // FIX: Added missing 'description' property to conform to the ScenarioOutcome type.
            {
              "type": "notification",
              "message": "The Game drives off screaming about dropping a new mixtape called ‘Premium Unleaded.’",
              "description": "Player is notified of The Game's departure."
            }
          ]
        },
        "refuse": {
          "npcLine": "The Game: \"Aight, you wanna play tough?\"",
          "outcomes": [
            {
              "type": "combat",
              "result": "fight-roll",
              "description": "Fight breaks out. Win = keep your cash and +5 street cred. Lose = lose $10 and your pride."
            },
            {
              "type": "streetCred",
              "condition": "win",
              "change": 5,
              "description": "Standing up to him boosts your street cred by +5."
            },
            {
              "type": "reputation",
              "condition": "lose",
              "change": -5,
              "description": "Getting beat over gas money makes you the joke of the block."
            }
          ]
        }
      }
    }
];
