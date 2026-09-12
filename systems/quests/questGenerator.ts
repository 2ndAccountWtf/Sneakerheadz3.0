/**
 * Side-Quest Generator
 * ====================
 * Rather than hand-writing hundreds of missions, a quest is assembled from
 * parts: WHO wants something, WHAT the absurd thing is, WHERE it dragged you,
 * and WHAT you get for it — which is frequently insulting, except for the
 * small chance that the junk turns out to be a grail.
 */
import type { SideQuest } from '../../types/game';
import { CITIES } from '../../data/cities';

interface Giver {
    npcId: string;
    name: string;
    voice: (thing: string) => string;
}

const GIVERS: Giver[] = [
    { npcId: 'grandma-laces', name: 'Grandma Laces', voice: t => `"I lost my ${t}. In 1974. But I saw it again last week, bubbeleh. Go."` },
    { npcId: 'gutter-gabe', name: 'Gutter Gabe', voice: t => `"Listen. My ${t} walked off. I need it back and I can't be seen looking."` },
    { npcId: 'wiz-k', name: 'Wiz K', voice: t => `"Somebody out there has my ${t}, man. It'll come back to me. Speed it up?"` },
    { npcId: 'scalper-sid', name: 'Scalper Sid', voice: t => `"You want in with me? Find the ${t}. Don't ask what it's for."` },
    { npcId: 'the-game', name: 'The Game', voice: t => `"Yo. My ${t}. Somebody took it. This is bigger than you understand."` },
    { npcId: 'bibi', name: 'Bibi Neta', voice: t => `"A matter of national interest. Locate the ${t}. Discretion is expected."` },
];

const THINGS = [
    'left shoe',
    'lucky shoelace',
    'signed insole',
    "cousin's bureka recipe",
    'limited-edition lighter',
    'first pair of Sambas',
    'folding chair',
    'sealed box of 1998 laces',
    "nephew's retainer",
    'unreleased sample',
    'chanclas',
    'bag of chocolate milk (unopened, sentimental)',
];

const PROMPTS = [
    'Somebody here saw it. Ask around and try not to get robbed.',
    'A guy in a store swears he sold it last week. Follow the lead.',
    'The trail goes cold at an AM/PM. Naturally.',
    'A cousin of a cousin has it. Allegedly. Probably. Maybe.',
    'It was last seen in a back alley, which is not encouraging.',
];

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

/**
 * Builds a 2-3 stop quest across cities the player isn't standing in, so it
 * actually makes them travel.
 */
export function generateSideQuest(day: number, currentCityId: string): SideQuest {
    const giver = pick(GIVERS);
    const thing = pick(THINGS);

    const elsewhere = CITIES.filter(c => c.id !== currentCityId);
    const stopCount = Math.random() < 0.55 ? 2 : 3;
    const stops = [...elsewhere].sort(() => 0.5 - Math.random()).slice(0, stopCount);

    // The payoff is the joke: a cross-continental errand for pocket change,
    // with a small chance the thing is genuinely priceless.
    const insulting = Math.random() < 0.6;
    const rewardCash = insulting ? rand(3, 25) : rand(400, 1400);

    return {
        id: `quest-${day}-${giver.npcId}-${Math.random().toString(36).slice(2, 7)}`,
        title: `Find The ${thing.replace(/^\w/, c => c.toUpperCase())}`,
        blurb: giver.voice(thing),
        giverNpcId: giver.npcId,
        giverName: giver.name,
        steps: stops.map(city => ({ cityId: city.id, prompt: pick(PROMPTS) })),
        stepIndex: 0,
        rewardCash,
        rewardCred: insulting ? rand(1, 4) : rand(8, 18),
        jackpotChance: insulting ? 0.12 : 0.03,
        startedOnDay: day,
    };
}

/** Chance a quest is offered when you arrive somewhere new. */
export const QUEST_OFFER_CHANCE = 0.22;
export const MAX_ACTIVE_QUESTS = 3;
