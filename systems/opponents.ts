/**
 * Mini-game opponents.
 *
 * A game played against "Some Guy" is a menu option. A game played against
 * Gutter Gabe, who you beat at dice last week and who has been telling people
 * it was luck, is a story. This maps the existing NPC roster onto the games
 * they can be challenged at, with the skill, stakes and voice that make each
 * matchup feel different.
 */
import type { MiniGameId } from '../types/game';
import type { Player } from '../types';

export interface Opponent {
    npcId: string;
    name: string;
    /** Sprite id in data/sprites — falls back to a block figure if absent. */
    spriteId: string;
    /** 0..1. Scales the AI's aggression and accuracy where a game supports it. */
    skill: number;
    /** Which games this NPC will actually play. */
    games: MiniGameId[];
    /** Typical wager in cash. 0 means they play for pride only. */
    stake: number;
    /** Said when the challenge is offered. */
    challenge: string[];
    /** Said after they lose. */
    onLoss: string[];
    /** Said after they win. */
    onWin: string[];
    /** Street cred you need before they will take you seriously. */
    minCred?: number;
}

export const OPPONENTS: Opponent[] = [
    {
        npcId: 'the-game',
        name: 'The Game',
        spriteId: 'the-game',
        skill: 0.45,
        games: ['street-brawl', 'street-ball', 'street-dice', 'cart-race'],
        stake: 150,
        challenge: [
            '"Yo. Square up. Not for money. Well — a little for money."',
            '"Run it. I been practising. I have not been practising."',
            '"One game. If I win you owe me five dollars. Separately from the other five dollars."',
        ],
        onLoss: [
            '"Life don\'t make sense." He says this every single time.',
            '"That was a warm-up. That was clearly a warm-up."',
            '"I let you have that one, for the culture."',
        ],
        onWin: [
            '"RESPECT THE GRIND." He is already telling someone.',
            '"That\'s going on the mixtape. The mixtape is about this now."',
        ],
    },
    {
        npcId: 'gutter-gabe',
        name: 'Gutter Gabe',
        spriteId: 'gutter-gabe',
        skill: 0.62,
        games: ['street-dice', 'street-brawl', 'legit-check'],
        stake: 300,
        challenge: [
            '"You play? Course you play. Everybody plays." He is already setting up.',
            '"Small stakes. Friendly." It will not be friendly.',
        ],
        onLoss: ['He pays without a word and watches you leave.', '"Again. Right now. Again."'],
        onWin: ['"Told you." He did not tell you.', 'He counts your money slowly, in front of you.'],
    },
    {
        npcId: 'wiz-k',
        name: 'Wiz K',
        spriteId: 'wiz-k',
        skill: 0.38,
        games: ['street-ball', 'drunk-darts', 'street-dice'],
        stake: 80,
        challenge: [
            '"Yeah, alright. Low stakes though. Everything low stakes."',
            '"I\'m not really competitive." He is extremely competitive.',
        ],
        onLoss: ['"That\'s beautiful, man. Genuinely." He means it.', '"Good energy. No notes."'],
        onWin: ['"Oh. Sorry." He looks genuinely apologetic.', '"I don\'t even know how that happened."'],
    },
    {
        npcId: 'scalper-sid',
        name: 'Scalper Sid',
        spriteId: 'scalper-sid',
        skill: 0.7,
        games: ['legit-check', 'street-dice', 'mystery-box'],
        stake: 500,
        minCred: 20,
        challenge: [
            '"You think you have an eye? Prove it. There is money in it."',
            '"I will make this interesting. I always make this interesting."',
        ],
        onLoss: ['He offers you a job. It is not clear what the job is.', '"Hm." He writes something down.'],
        onWin: ['"Don\'t feel bad. Nobody has an eye." He has an eye.', 'He is gone before you look up.'],
    },
    {
        npcId: 'bro-jogan',
        name: 'Bro Jogan',
        spriteId: 'bro-jogan',
        skill: 0.55,
        games: ['hypecast-roulette', 'street-brawl', 'drunk-darts'],
        stake: 0,
        challenge: [
            '"We should do this on the podcast. We are ON the podcast. It started."',
            '"Cold plunge first? No? Your call, man. Your funeral."',
        ],
        onLoss: ['"That was a learning experience FOR ME." He will discuss it for two hours.'],
        onWin: ['"It\'s the elk." He believes this completely.'],
    },
    {
        npcId: 'adc',
        name: 'ADC',
        spriteId: 'adc',
        skill: 0.5,
        games: ['hypecast-roulette', 'drunk-darts'],
        stake: 0,
        challenge: [
            '"I would like to formally debate you. I have notes. I have forty pages of notes."',
            '"Competition is a capitalist construct. I will still beat you."',
        ],
        onLoss: ['"This outcome is structural and I reject it."', 'She schedules a review of the result.'],
        onWin: ['"Have you considered the systemic implications of that?"'],
    },
    {
        npcId: 'grandma-laces',
        name: 'Grandma Laces',
        spriteId: 'grandma-laces',
        skill: 0.8,
        games: ['street-dice', 'drunk-darts'],
        stake: 200,
        challenge: [
            '"Sit down, bubbeleh. I used to do this for money." She still does this for money.',
            '"I will go easy on you." She will not go easy on you.',
        ],
        onLoss: ['She is genuinely delighted and tells you about 1974.', '"Beginner\'s luck. Obviously."'],
        onWin: ['She takes the money and pats your cheek. Somehow that is worse.', '"I did tell you."'],
    },
    {
        npcId: 'yasser-abbasfat',
        name: 'Yasser Abbasfat',
        spriteId: 'yasser',
        skill: 0.3,
        games: ['street-brawl', 'flight-404'],
        stake: 100,
        challenge: ['"THIS IS A CHALLENGE! IT IS PART OF THE STRUGGLE!"'],
        onLoss: ['"THE RULES WERE RIGGED! THE RULES! WERE! RIGGED!"'],
        onWin: ['He celebrates for an uncomfortably long time.'],
    },
    {
        npcId: 'clerk-israeli-af',
        name: 'The AM/PM Clerk',
        spriteId: 'clerk',
        skill: 0.45,
        games: ['drunk-darts', 'street-dice'],
        stake: 60,
        challenge: ['"Achi. Achi. One game. I am on break. I decide when break is."'],
        onLoss: ['"Sababa. Take a bureka. Take two." He is not upset.'],
        onWin: ['"YALLA!" The whole store hears about it.'],
    },
];

const BY_ID = new Map(OPPONENTS.map(o => [o.npcId, o]));

export const getOpponent = (npcId: string): Opponent | undefined => BY_ID.get(npcId);

/** Who in this roster will play this particular game, given the player's standing. */
export function opponentsFor(game: MiniGameId, player: Player): Opponent[] {
    return OPPONENTS.filter(o =>
        o.games.includes(game) && (o.minCred === undefined || player.streetCred >= o.minCred));
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

/**
 * Rivalry: how many times you have played this NPC, tracked in player flags so
 * it survives without a dedicated slice of state. Repeat opponents get harder,
 * because they have been watching you.
 */
export const rivalryKey = (npcId: string) => `rival-${npcId}`;

export function rivalryWith(player: Player, npcId: string): number {
    return Number(player.flags[rivalryKey(npcId)] ?? 0);
}

/** Skill climbs with familiarity, capped so nobody becomes unbeatable. */
export function effectiveSkill(opponent: Opponent, player: Player): number {
    const meetings = rivalryWith(player, opponent.npcId);
    return Math.min(0.92, opponent.skill + Math.min(0.18, meetings * 0.03));
}

export const challengeLine = (o: Opponent) => pick(o.challenge);
export const lossLine = (o: Opponent) => pick(o.onLoss);
export const winLine = (o: Opponent) => pick(o.onWin);
