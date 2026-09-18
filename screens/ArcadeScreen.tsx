import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import type { MiniGameId, MiniGameRequest } from '../types/game';
import type { ScenarioOutcome } from '../types/interactions';
import { CITIES } from '../data/cities';

interface ArcadeEntry {
    id: MiniGameId;
    name: string;
    tagline: string;
    icon: string;
    /** What the player risks to play. */
    stake: string;
    energyCost: number;
    build: (ctx: { cityName: string }) => MiniGameRequest;
}

const cred = (n: number, text: string): ScenarioOutcome => ({ type: 'streetCred', change: n, description: text });
const money = (n: number, text: string): ScenarioOutcome =>
    n >= 0
        ? { type: 'inventoryChange', add: [{ kind: 'currency', value: 'cash', qty: n }], description: text }
        : { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: -n }], description: text };
const health = (n: number, text: string): ScenarioOutcome => ({ type: 'stat_change', payload: { stat: 'health', value: n }, description: text });

/**
 * The request the Play button actually sends.
 *
 * The energy cost is stamped on here rather than written into each `build()`,
 * so the number on the card and the number charged cannot drift apart — they
 * are the same field read once. Exported because the tests have to go through
 * the same path the button does: the last round of Arcade bugs all lived in the
 * gap between what the reducer did and what the call site handed it.
 */
export const requestFor = (entry: ArcadeEntry, ctx: { cityName: string }): MiniGameRequest =>
    ({ ...entry.build(ctx), energyCost: entry.energyCost });

export const ENTRIES: ArcadeEntry[] = [
    {
        id: 'street-ball',
        name: 'Street Ball',
        tagline: 'First to five. Somebody always claims they play overseas.',
        icon: '🏀',
        stake: 'Pride and a $150 side bet',
        energyCost: 10,
        build: ({ cityName }) => ({
            game: 'street-ball',
            title: `${cityName} Blacktop`,
            config: { opponent: 'Guy In Jeans' },
            onWin: [money(150, 'You collect the side bet.'), cred(6, 'The court saw it.')],
            onLose: [money(-150, 'You pay out the side bet.'), cred(-2, 'Word gets around.')],
        }),
    },
    {
        id: 'street-brawl',
        name: 'Cage Night',
        tagline: 'An unlicensed bout behind a laundromat. The purse is real.',
        icon: '🥊',
        stake: 'Your face',
        energyCost: 15,
        build: () => ({
            game: 'street-brawl',
            title: 'Cage Night',
            config: { opponent: 'Big Nadav' },
            onWin: [money(500, 'The purse, in twenties.'), cred(14, 'You won in front of everybody.'), health(-15, 'You are still bleeding a bit.')],
            onLose: [money(-100, 'You owe the promoter his cut regardless.'), health(-35, 'You lose badly.'), cred(-4, 'It was filmed.')],
        }),
    },
    {
        id: 'sneaker-chase',
        name: 'Bag Snatch Response',
        tagline: 'Three lanes of traffic and a man with your box.',
        icon: '🏃',
        stake: 'A pair off your own feet',
        energyCost: 18,
        build: () => ({
            game: 'sneaker-chase',
            title: 'Bag Snatch',
            config: { thief: 'A Very Fast Teenager' },
            onWin: [
                { type: 'inventoryChange', add: [{ kind: 'item', value: 'random-rare', qty: 1 }], description: 'You get the box back — and it was not even yours.' },
                money(240, 'The owner catches up, out of breath, and makes you take something for it.'),
                cred(8, 'People saw you run him down.'),
            ],
            onLose: [
                { type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'He got yours too, somehow.' },
            ],
        }),
    },
    {
        id: 'cart-race',
        name: 'Downhill',
        tagline: 'Somebody took your box and the street goes down a long way.',
        icon: '🛒',
        stake: 'The box, and your knees',
        energyCost: 16,
        build: () => ({
            game: 'cart-race',
            title: 'Downhill',
            config: { thief: 'The Game' },
            onWin: [
                { type: 'inventoryChange', add: [{ kind: 'item', value: 'random-rare', qty: 1 }], description: 'You get it back, plus whatever else was in the cart.' },
                money(300, 'There was a roll of notes in the cart. He is in no position to ask for it.'),
                cred(11, 'The whole street watched you run down a shopping trolley.'),
            ],
            onLose: [money(-220, 'He sells it before you reach the bottom.'), health(-12, 'You went over the handlebars of something.')],
        }),
    },
    {
        id: 'flight-404',
        name: 'Flight 404',
        tagline: 'Yasser has the megaphone and the cockpit. Go forward.',
        icon: '✈️',
        stake: 'Everyone on board, apparently',
        energyCost: 25,
        build: () => ({
            game: 'flight-404',
            title: 'Flight 404',
            onWin: [
                money(2200, 'The airline settles quietly and quickly.'),
                cred(30, 'You personally ended a hijacking. It is on every feed.'),
                { type: 'bibiApproval', change: 18, description: 'Decisive action. He notices decisive action.' },
            ],
            onLose: [health(-30, 'You are subdued with a drinks trolley.'), cred(-4, 'The footage is not flattering.')],
        }),
    },
    {
        id: 'street-dice',
        name: 'Street Dice',
        tagline: 'A chalk circle, two dice, and the option to press your luck.',
        icon: '🎲',
        stake: 'Whatever is on the ground',
        energyCost: 4,
        build: () => ({
            game: 'street-dice',
            title: 'Street Dice',
            config: { opponent: 'Dice Man' },
            onWin: [money(650, 'You pick the whole pot up off the pavement.'), cred(5, 'You knew when to pull out. Rare.')],
            onLose: [money(-400, 'The pot was on the ground and now it is not yours.'), cred(-2, 'You pressed one too many times.')],
        }),
    },
    {
        id: 'drunk-darts',
        name: 'Drunk Darts',
        tagline: 'He keeps buying rounds. Every one of them makes you worse.',
        icon: '🎯',
        stake: 'A bar tab and your dignity',
        energyCost: 6,
        build: () => ({
            game: 'drunk-darts',
            title: 'Drunk Darts',
            config: { opponent: 'Big Nadav' },
            onWin: [money(380, 'He pays the tab, grudgingly.'), cred(7, 'You beat him sober. He will mention it for years.')],
            onLose: [money(-180, 'You are paying the tab.'), health(-8, 'Tomorrow is going to be rough.')],
        }),
    },
    {
        id: 'rooftop-artillery',
        name: 'Rooftop Artillery',
        tagline: 'Two buildings, one crosswind, and a shoe you are never getting back.',
        icon: '\u{1F3D9}',
        stake: 'One pair, thrown off a roof',
        energyCost: 8,
        build: () => ({
            game: 'rooftop-artillery',
            title: 'Rooftop Artillery',
            config: { opponent: 'Some Guy On The Other Roof', skill: 0.5 },
            onWin: [money(520, 'He pays up and climbs down the fire escape.'), cred(6, 'Eleven storeys of witnesses.')],
            onLose: [money(-260, 'You pay up.'), cred(-3, 'You threw a shoe into traffic. Twice.')],
        }),
    },
    {
        id: 'pizza-run',
        name: 'Pizza Run',
        tagline: 'A night shift, a stack of boxes, and doorsteps on both sides.',
        icon: '🍕',
        stake: 'Your one-star average',
        energyCost: 14,
        build: () => ({
            game: 'pizza-run',
            title: 'Night Shift',
            onWin: [money(900, 'You made rent.'), cred(4, 'Somebody tipped you in respect, which does not pay rent.')],
            onLose: [money(-60, 'You are paying for the boxes you scattered.')],
        }),
    },
    {
        id: 'mystery-box',
        name: 'Back-Alley Boxes',
        tagline: '"Is very good. Probably." Three tiers. No refunds, ever.',
        icon: '📦',
        stake: 'Whatever you hand him',
        energyCost: 0,
        build: () => ({
            game: 'mystery-box',
            title: 'Back-Alley Mystery Box',
        }),
    },
    {
        id: 'legit-check',
        name: 'Authentication Booth',
        tagline: 'A folding table and a UV lamp. Call it right, get paid.',
        icon: '🔍',
        stake: 'Your reputation as an eye',
        energyCost: 5,
        build: () => ({
            game: 'legit-check',
            title: 'Authentication Booth',
            config: { sneakerName: 'a stranger\'s "deadstock" pair' },
            onWin: [money(180, 'The seller pays for the call.'), cred(5, 'Word spreads that you know.')],
            onLose: [cred(-6, 'You got it wrong in public.'), money(-60, 'You refund the fee out of shame.')],
        }),
    },
    {
        id: 'hypecast-roulette',
        name: 'Hypecast Roulette',
        tagline: 'Live with Bro Jogan. Agree, disagree, or laugh — fast.',
        icon: '🎙',
        stake: 'Being blocked forever',
        energyCost: 8,
        build: () => ({
            game: 'hypecast-roulette',
            title: 'The Bro Jogan Experience',
            onWin: [
                { type: 'marketSignal', effect: 'surge', magnitude: 1.28, target: { kind: 'rarity', value: 'Rare' }, duration: '24h', description: 'His on-air plug moves Rare pairs.' },
                { type: 'priceMarkup', multiplier: 0.9, duration: '24h', description: 'Alpha Discount: 10% off in every store.' },
                money(260, 'They pay guests. Not well, but they pay them.'),
                cred(9, 'You made the clip.'),
                { type: 'statusEffect', effect: 'guidance', duration: '24h', label: 'Podcast Intel', description: 'You heard which model is next.' },
            ],
            onLose: [cred(-5, 'The chat decided you have low vibrational energy.')],
        }),
    },
];

/**
 * The Arcade. Mini-games used to exist only as `combat` outcomes nothing
 * resolved; this is the front door, so every game is reachable on purpose
 * rather than only by accident of a travel roll.
 */
const ArcadeScreen: React.FC = () => {
    const { gameState, launchMiniGame } = useGame();
    const { player, currentCityId } = gameState;
    const cityName = CITIES.find(c => c.id === currentCityId)?.name ?? 'the city';

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>The <span className="accent">Arcade</span></>}
                subtitle={`Ways to make money that your accountant would not approve of · ${cityName}`}
                back={Screen.Dashboard}
            />

            <div className="panel p-3 mb-4 flex flex-wrap items-center gap-2">
                <span className="chip">⚡ Energy {Math.round(player.energy)}/100</span>
                <span className="chip">❤️ Health {Math.round(player.health)}/100</span>
                <span className="chip chip-accent">💵 ${player.cash.toLocaleString()}</span>
                {player.energy < 20 && <span className="chip chip-warn">Low energy — sleep it off in your Bag</span>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ENTRIES.map(entry => {
                    const tooTired = player.energy < entry.energyCost;
                    return (
                        <div key={entry.id} className="panel p-4 flex flex-col">
                            <div className="flex items-start gap-3 mb-3">
                                <span className="text-3xl leading-none flex-shrink-0">{entry.icon}</span>
                                <div className="min-w-0">
                                    <h3 className="font-display text-sm uppercase text-white leading-tight">{entry.name}</h3>
                                    <p className="text-xs text-[var(--ink-dim)] mt-1 leading-snug">{entry.tagline}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                <span className="chip">Stake: {entry.stake}</span>
                                {entry.energyCost > 0 && <span className="chip">⚡ {entry.energyCost}</span>}
                            </div>
                            <button
                                className="btn btn-accent w-full mt-auto"
                                disabled={tooTired}
                                onClick={() => launchMiniGame(requestFor(entry, { cityName }))}
                            >
                                {tooTired ? 'Too Tired' : 'Play'}
                            </button>
                        </div>
                    );
                })}
            </div>

            <p className="label mt-5 text-center">
                Games also find you on their own — at travel events, in shady stores, and whenever an NPC decides to square up.
            </p>
        </div>
    );
};

export default ArcadeScreen;
