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
const energy = (n: number, text: string): ScenarioOutcome => ({ type: 'stat_change', payload: { stat: 'energy', value: n }, description: text });
const health = (n: number, text: string): ScenarioOutcome => ({ type: 'stat_change', payload: { stat: 'health', value: n }, description: text });

const ENTRIES: ArcadeEntry[] = [
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
            onWin: [money(150, 'You collect the side bet.'), cred(6, 'The court saw it.'), energy(-10, 'That was a real run.')],
            onLose: [money(-150, 'You pay out the side bet.'), cred(-2, 'Word gets around.'), energy(-10, 'You are gassed.')],
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
                cred(8, 'People saw you run him down.'),
                energy(-18, 'Lungs on fire.'),
            ],
            onLose: [
                { type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'He got yours too, somehow.' },
                energy(-18, 'All that for nothing.'),
            ],
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
                cred(9, 'You made the clip.'),
                { type: 'statusEffect', effect: 'guidance', duration: '24h', label: 'Podcast Intel', description: 'You heard which model is next.' },
            ],
            onLose: [cred(-5, 'The chat decided you have low vibrational energy.'), energy(-8, 'You argued with a man about elk for an hour.')],
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
                                onClick={() => launchMiniGame(entry.build({ cityName }))}
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
