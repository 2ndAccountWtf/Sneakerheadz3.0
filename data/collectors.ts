import type { Sneaker } from '../types';

/**
 * Private-sale collectors.
 *
 * A shop pays market. A collector pays what the relationship is worth — more
 * on a good day, less (or worse) on a bad one. This is written in the style
 * of `data/venues.ts`: flat data, dry voice, no logic. Everything that turns
 * this into numbers lives in `systems/collectors.ts`.
 *
 * `npcId` doubles as the key into `Player.connections`, so standing earned
 * here is the same standing read everywhere else. Where a collector is
 * already a character in the game (a celebrity, or an ambient NPC like
 * Scalper Sid), the id matches that profile exactly — the guy who scams you
 * with a fake treasure map is the same guy fencing your bag in an alley.
 */
export type CollectorKind = 'anonymous' | 'celebrity';

export interface CollectorLines {
    /** Said when you first show up with something to sell. */
    greeting: string[];
    /** Said alongside their opening number. */
    lowball: string[];
    /** Said when they come back with a counter of their own. */
    counter: string[];
    /** Said if the deal falls apart — you walked, or they did. */
    walkAway: string[];
    /** Said at the exact moment the double-cross lands, whoever is running it. */
    doubleCross: string[];
}

export interface Collector {
    id: string;
    /** Key into `Player.connections`. Shared with the celebrity/NPC roster where applicable. */
    npcId: string;
    name: string;
    kind: CollectorKind;
    /** Cities this collector actually turns up in. */
    cities: string[];
    blurb: string;
    icon: string;
    /** Where the meet actually happens — the sentence that tells you how exposed you are. */
    meetLine: string;
    /** Rarities they're shopping for. A pair outside this list gets a courtesy lowball at best. */
    wantsRarities: Sneaker['rarity'][];
    /** Specific models they chase regardless of rarity — grudges, vanity, brand loyalty. */
    wantsModels?: string[];
    /** 0..1 — how likely they clock a fake before it becomes their problem. */
    eye: number;
    /** 0..1 — how likely the cash they hand over is real. */
    trust: number;
    /** 0..1 — baseline odds this meet was never about buying shoes. Scaled further by deal size and standing. */
    danger: number;
    /** Fraction of market price their opening lowball sits at, at worst standing. */
    openMultiplier: number;
    /** Fraction of market price they'll stretch to at their absolute best, for someone they trust completely. */
    ceilingMultiplier: number;
    /** Street cred needed before they'll even take the meeting. */
    minCred?: number;
    lines: CollectorLines;
}

export const COLLECTORS: Collector[] = [
    // --- ANONYMOUS, ONE PER CITY ---
    {
        id: 'collector-tokyo-junko',
        npcId: 'collector-tokyo-junko',
        name: 'Junko',
        kind: 'anonymous',
        cities: ['tokyo'],
        blurb: 'Buys quietly, sells quietly, has never once raised her voice.',
        icon: '🎐',
        meetLine: 'A capsule hotel lobby at 2am. She is already there. She is always already there.',
        wantsRarities: ['Rare', 'Legendary'],
        eye: 0.55,
        trust: 0.8,
        danger: 0.08,
        openMultiplier: 0.6,
        ceilingMultiplier: 1.35,
        lines: {
            greeting: ['"Show me." She does not look up from her phone yet.', '"You came alone. Good."'],
            lowball: ['"This is what it is worth to me tonight."', '"I can move it, but not for what you think."'],
            counter: ['"Closer. Not there." She names a new number without blinking.', '"Fine. Meet me here." A slightly better figure.'],
            walkAway: ['She puts her phone away. That is the whole conversation, apparently.', '"Come back when you are serious."'],
            doubleCross: ['The envelope is thinner than it looked. Or thicker, and wrong.', 'She is already three streets away by the time you count it.'],
        },
    },
    {
        id: 'collector-tlv-avi',
        npcId: 'collector-tlv-avi',
        name: 'Avi from the Shuk',
        kind: 'anonymous',
        cities: ['tel-aviv'],
        blurb: 'Runs a produce stall by day. The real inventory is in the back.',
        icon: '🍅',
        meetLine: 'Behind the spice stalls at Carmel Market, past the crate nobody is supposed to move.',
        wantsRarities: ['Uncommon', 'Rare'],
        eye: 0.4,
        trust: 0.6,
        danger: 0.2,
        openMultiplier: 0.58,
        ceilingMultiplier: 1.3,
        lines: {
            greeting: ['"Achi. What did you bring me?" He is already reaching.', '"Quick, quick, before the health inspector."'],
            lowball: ['"For you, a friend price." It is not a friend price.', '"This is generous. You are welcome."'],
            counter: ['"You are killing me here. Fine." He counts out more.', '"One more offer. Last one, wallah."'],
            walkAway: ['He shrugs and goes back to weighing tomatoes.', '"Your loss, achi."'],
            doubleCross: ['Half the bills are newspaper cut to size. He is nowhere near the stall anymore.', 'The "cash" crinkles wrong. He is already gone, tomatoes and all.'],
        },
    },
    {
        id: 'collector-ny-tony',
        npcId: 'collector-ny-tony',
        name: 'Tony off Canal',
        kind: 'anonymous',
        cities: ['new-york'],
        blurb: 'Buys anything, asks nothing, parks somewhere you would rather he did not.',
        icon: '🚐',
        meetLine: 'A parking garage, sub-level, one working light.',
        wantsRarities: ['Common', 'Uncommon', 'Rare', 'Legendary'],
        eye: 0.3,
        trust: 0.45,
        danger: 0.4,
        openMultiplier: 0.55,
        ceilingMultiplier: 1.4,
        minCred: 10,
        lines: {
            greeting: ['"You the guy?" He does not use names.', 'He waves you further into the garage. Great.'],
            lowball: ['"That\'s the number." Flat, final-sounding, not actually final.', '"Take it or don\'t."'],
            counter: ['"You\'re killin\' me." He peels off a few more, visibly annoyed.', '"Last offer. I mean it this time." He does not mean it.'],
            walkAway: ['He is already back in the van before you finish talking.', '"Whatever. Next guy."'],
            doubleCross: ['The van is gone. So, you realize, is the actual value of what is in your hand.', 'Something about the bills feels wrong under the one working light.'],
        },
    },
    {
        id: 'collector-la-becca',
        npcId: 'collector-la-becca',
        name: 'Becca, Brentwood',
        kind: 'anonymous',
        cities: ['los-angeles'],
        blurb: 'Only wants the absolute best. Pays like it too, when she is impressed.',
        icon: '🏛️',
        meetLine: 'Her guesthouse. There is a valet. The valet is not impressed by you.',
        wantsRarities: ['Legendary'],
        eye: 0.6,
        trust: 0.85,
        danger: 0.03,
        openMultiplier: 0.7,
        ceilingMultiplier: 1.55,
        minCred: 20,
        lines: {
            greeting: ['"Let\'s see it, then." She has already decided to be underwhelmed.', 'She inspects the box before the shoe. Priorities.'],
            lowball: ['"I could be persuaded to pay this." She is not persuaded yet.', '"This is what it is worth in this house."'],
            counter: ['"You have my attention. Fine." A better number, delivered like a favor.', '"Don\'t make this ugly." A slightly better number.'],
            walkAway: ['"Have your people call my people." There are no people.', 'She is already looking at her phone.'],
            doubleCross: ['Her business manager "handles all of that." He does not answer.', 'The transfer never actually posts. Nobody in that house has a last name, it turns out.'],
        },
    },
    {
        id: 'collector-paris-monsieur-b',
        npcId: 'collector-paris-monsieur-b',
        name: 'Monsieur B.',
        kind: 'anonymous',
        cities: ['paris'],
        blurb: 'A gallery back room, a loupe, and opinions about stitching.',
        icon: '🖼️',
        meetLine: 'The back room of a gallery that officially sells only paintings.',
        wantsRarities: ['Rare', 'Legendary'],
        eye: 0.8,
        trust: 0.75,
        danger: 0.05,
        openMultiplier: 0.62,
        ceilingMultiplier: 1.4,
        minCred: 15,
        lines: {
            greeting: ['He produces a loupe before you have said a word.', '"Sit. Let us look at it properly."'],
            lowball: ['"This is what the piece is worth. To me." He is precise about the word piece.', '"A fair number, given the condition."'],
            counter: ['"You argue well. Very well." He revises upward, unhappily.', '"One adjustment. Do not ask for a second."'],
            walkAway: ['He returns to the paintings, which he actually likes better.', '"Then we have nothing further to discuss."'],
            doubleCross: ['The gallery is closed the next time you look for it. It may have always been closed.', 'His signature on the receipt does not match the name on the door.'],
        },
    },
    {
        id: 'collector-chi-lupe',
        npcId: 'collector-chi-lupe',
        name: 'Lupe off Halsted',
        kind: 'anonymous',
        cities: ['chicago'],
        blurb: 'Moves whatever comes through the dock, no questions, some elbows.',
        icon: '🏗️',
        meetLine: 'The loading dock. Somebody is always half-watching from a forklift.',
        wantsRarities: ['Common', 'Uncommon', 'Rare'],
        eye: 0.35,
        trust: 0.5,
        danger: 0.3,
        openMultiplier: 0.55,
        ceilingMultiplier: 1.3,
        lines: {
            greeting: ['"Dock\'s open. Let\'s see what you got."', 'She waves off the forklift driver first.'],
            lowball: ['"That\'s dock price. Take it or walk it back out."', '"Fair for around here."'],
            counter: ['"You\'re alright. Here." A bit more, grudgingly.', '"Don\'t push it past this."'],
            walkAway: ['"Door\'s that way." She is already turning back to the pallets.', 'The forklift starts up again. Meeting over.'],
            doubleCross: ['The bills are damp and wrong in a way you notice too late.', 'She is gone before the count is even finished.'],
        },
    },

    // --- EXISTING CHARACTERS, REUSED AS CHANNELS ---
    {
        id: 'collector-scalper-sid',
        npcId: 'scalper-sid',
        name: 'Scalper Sid',
        kind: 'anonymous',
        cities: ['tel-aviv', 'new-york'],
        blurb: 'The same Sid who sold you a crayon "map." He also, occasionally, genuinely buys.',
        icon: '🔍',
        meetLine: 'A folding table in a back alley, lit by one clip-on lamp aimed at your bag.',
        wantsRarities: ['Rare', 'Legendary'],
        eye: 0.85,
        trust: 0.5,
        danger: 0.12,
        openMultiplier: 0.58,
        ceilingMultiplier: 1.45,
        minCred: 15,
        lines: {
            greeting: ['"Let\'s see what you\'re working with." He already has the lamp on it.', '"I have an eye for this. You know I have an eye."'],
            lowball: ['"Here\'s what I can do." He says it like a favor.', '"Market\'s soft. This is fair."'],
            counter: ['"You drive a hard bargain. Fine." He revises, visibly pained.', '"Don\'t tell anyone I went this high."'],
            walkAway: ['"Your loss. I move fast, I don\'t wait around."', 'He is already folding the table.'],
            doubleCross: ['Half his "cash" turns out to be the same paper as his map. Of course it does.', '"Consider it a lesson," he says, from a safe distance.'],
        },
    },
    {
        id: 'collector-gutter-gabe',
        npcId: 'gutter-gabe',
        name: 'Gutter Gabe',
        kind: 'anonymous',
        cities: ['tel-aviv', 'new-york', 'chicago'],
        blurb: 'Fences whatever, wherever. The dice game is a front. Barely.',
        icon: '🎲',
        meetLine: 'Wherever he already is. He does not travel for this.',
        wantsRarities: ['Common', 'Uncommon', 'Rare', 'Legendary'],
        eye: 0.25,
        trust: 0.35,
        danger: 0.45,
        openMultiplier: 0.5,
        ceilingMultiplier: 1.25,
        lines: {
            greeting: ['"Course you play. Everybody plays." He nods at your bag instead of the dice.', '"Small stakes. Friendly." It will not be friendly.'],
            lowball: ['"That\'s the number." He is already counting his own cut, somehow.', '"Take it. Don\'t make me say it twice."'],
            counter: ['"You want to argue with me? Fine." He gives a little more.', '"Again. Right now. Again." — but with more money this time.'],
            walkAway: ['He counts your absence as a loss and mentions it later, incorrectly.', '"Whatever. There\'s always another guy."'],
            doubleCross: ['He counts your money slowly, in front of you. It was never going to be yours.', 'The bag he hands back is not the bag you brought.'],
        },
    },

    // --- CELEBRITIES: THE HIGH-END CHANNEL ---
    {
        id: 'collector-donald-drip',
        npcId: 'donald-drip',
        name: 'Donald Drip',
        kind: 'celebrity',
        cities: ['new-york', 'los-angeles'],
        blurb: 'Buys the biggest, the best, the most tremendous. Overpays for the story, not the shoe.',
        icon: '🥇',
        meetLine: 'The penthouse. Gold everywhere. Somehow more gold than yesterday.',
        wantsRarities: ['Legendary'],
        wantsModels: ['donald-drip-gold-standards'],
        eye: 0.35,
        trust: 0.8,
        danger: 0.02,
        openMultiplier: 0.75,
        ceilingMultiplier: 1.9,
        minCred: 35,
        lines: {
            greeting: ['"This better be tremendous. I only deal in tremendous."', '"Nobody has an eye for this like I do. Nobody."'],
            lowball: ['"This is a very generous number. The best number, honestly."', '"I could get this cheaper anywhere else. I won\'t, but I could."'],
            counter: ['"Fine. Because it\'s you. Because I like you."', '"Nobody negotiates like this with me. I respect it."'],
            walkAway: ['"Sad! Very sad number you wanted."', '"Call me when you have something tremendous."'],
            doubleCross: ['"My people handle the wire." His people do not handle the wire.', 'The certificate of authenticity he hands you for the cash is, itself, a fake.'],
        },
    },
    {
        id: 'collector-the-game',
        npcId: 'the-game',
        name: 'The Game',
        kind: 'celebrity',
        cities: ['los-angeles'],
        blurb: 'Loyalty is fierce. Temper is short. One of those is currently relevant.',
        icon: '🎤',
        meetLine: 'The block he grew up on. He knows every angle of it, which is the problem.',
        wantsRarities: ['Rare', 'Legendary'],
        eye: 0.45,
        trust: 0.55,
        danger: 0.35,
        openMultiplier: 0.6,
        ceilingMultiplier: 1.5,
        minCred: 25,
        lines: {
            greeting: ['"Yo. Let\'s see it." He is already sizing up more than the shoe.', '"Respect the grind that got you here. Now let\'s talk numbers."'],
            lowball: ['"That\'s what it\'s worth out here. Take it."', '"I\'m being generous. Don\'t make me regret it."'],
            counter: ['"A\'ight, a\'ight. Here." More money, and a look that says do not push further.', '"For the culture. Fine."'],
            walkAway: ['"Life don\'t make sense." He says this about the negotiation, not the shoe.', '"We\'re done here."'],
            doubleCross: ['"Yo. Hand it over." This was never a sale.', 'His guys are suddenly a lot closer than they were a second ago.'],
        },
    },
    {
        id: 'collector-bro-jogan',
        npcId: 'bro-jogan',
        name: 'Bro Jogan',
        kind: 'celebrity',
        cities: ['los-angeles', 'new-york'],
        blurb: 'Will overpay if the story is good enough to become forty minutes of a podcast.',
        icon: '🎙',
        meetLine: 'The Garage Studio, mid-recording. The mic may or may not be off.',
        wantsRarities: ['Legendary', 'Rare'],
        wantsModels: ['bro-jogan-af1-alpha-whites', 'bro-jogan-tesla-cyber-forces'],
        eye: 0.3,
        trust: 0.65,
        danger: 0.05,
        openMultiplier: 0.65,
        ceilingMultiplier: 1.6,
        minCred: 20,
        lines: {
            greeting: ['"Dude. Dude. Is that real? We have to talk about this on air."', '"Cold plunge first? No? Your call, man."'],
            lowball: ['"This feels right, energetically. And financially."', '"I\'m being generous because of the vibes."'],
            counter: ['"Okay, the vibes are shifting. Here." More money, offered like a revelation.', '"It\'s the elk talking. Fine, more money."'],
            walkAway: ['"That\'s a learning experience FOR ME." He will discuss it for two hours.', '"We\'ll circle back on this. We will not circle back."'],
            doubleCross: ['"My producer handles the money side." The producer does not exist.', 'The bag he hands you is full of hemp protein samples. This was, somehow, on purpose.'],
        },
    },
    {
        id: 'collector-yasser',
        npcId: 'yasser-abbasfat',
        name: 'Yasser Abbasfat',
        kind: 'celebrity',
        cities: ['new-york', 'los-angeles', 'tel-aviv', 'tokyo'],
        blurb: 'Zero real market value. Pure noise, chaos, and the occasional actual pile of cash.',
        icon: '💣',
        meetLine: 'Wherever he happens to be shouting today. There is always shouting.',
        wantsRarities: ['Common', 'Uncommon', 'Rare', 'Legendary'],
        eye: 0.2,
        trust: 0.3,
        danger: 0.55,
        openMultiplier: 0.5,
        ceilingMultiplier: 1.35,
        lines: {
            greeting: ['"THIS IS A DEAL! IT IS PART OF THE STRUGGLE!"', 'He is already shouting before you have said anything.'],
            lowball: ['"THIS IS A FAIR PRICE! THE FAIREST!"', '"TAKE IT! IT IS A GIFT FROM ME TO YOU!"'],
            counter: ['"FINE! MORE MONEY! BUT I AM ANGRY ABOUT IT!"', '"YOU DRIVE A HARD BARGAIN, MY FRIEND-ENEMY!"'],
            walkAway: ['"THE RULES WERE RIGGED! THE RULES! WERE! RIGGED!"', 'He storms off, still shouting, in the wrong direction.'],
            doubleCross: ['"IT WAS NEVER ABOUT THE SHOE!" Several men appear from nowhere.', 'The "money" turns out to be photocopies. He finds this hilarious.'],
        },
    },
    {
        id: 'collector-bibi',
        npcId: 'bibi',
        name: 'Bibi Neta',
        kind: 'celebrity',
        cities: ['tokyo', 'tel-aviv', 'new-york', 'los-angeles', 'paris', 'chicago'],
        blurb: 'A state visit that happens to include a sneaker acquisition. The security detail is real.',
        icon: '🕴️',
        meetLine: 'A hotel suite with more security than furniture.',
        wantsRarities: ['Rare', 'Legendary'],
        wantsModels: ['bibi-netas-iron-dome-1s'],
        eye: 0.7,
        trust: 1,
        danger: 0,
        openMultiplier: 0.7,
        ceilingMultiplier: 1.5,
        minCred: 30,
        lines: {
            greeting: ['"Show me what you have. I have seen worse markets than this room."', '"Strength, stability, and a fair price. In that order."'],
            lowball: ['"This is the number. It is a strong number."', '"Order has been restored. This is what it pays."'],
            counter: ['"You negotiate like a nation that knows its worth. Fine."', '"A small concession. Do not mistake it for weakness."'],
            walkAway: ['"Then we have no further business today."', '"I have stabilized worse markets than this one. Good day."'],
            doubleCross: ['There is no double-cross here. The state does not deal in counterfeit currency, and the state does not need to rob you.'],
        },
    },
];

export const collectorsById = new Map(COLLECTORS.map(c => [c.id, c]));
