/**
 * City ambient events.
 *
 * Travel events fire between cities. This fires *while you are standing in
 * one* — somebody challenges you at the court, a man wants to race you down a
 * hill, a crowd forms. It is what stops a city from being a menu of shops.
 *
 * Events are weighted by who and what is actually present: a hoops challenge
 * needs a court in this city, and the challenger is drawn from that venue's
 * real regulars.
 */
import type { Player } from '../../types';
import type { MiniGameRequest } from '../../types/game';
import type { ScenarioOutcome } from '../../types/interactions';
import { venuesIn, isVenueOpen, type Venue } from '../../data/venues';
import { getOpponent, effectiveSkill, challengeLine, type Opponent } from '../opponents';

export interface CityEvent {
    id: string;
    headline: string;
    body: string;
    icon: string;
    /** The challenge, if this event offers a game. */
    match?: MiniGameRequest;
    /** Applied if the player declines or the event has no game. */
    onDecline?: ScenarioOutcome[];
    acceptLabel: string;
    declineLabel: string;
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const cred = (n: number, text: string): ScenarioOutcome => ({ type: 'streetCred', change: n, description: text });
const money = (n: number, text: string): ScenarioOutcome =>
    n >= 0
        ? { type: 'inventoryChange', add: [{ kind: 'currency', value: 'cash', qty: n }], description: text }
        : { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: -n }], description: text };

/** Builds a challenge from a real venue and a real regular standing in it. */
function challengeAt(venue: Venue, player: Player): CityEvent | null {
    const regulars = venue.regulars.map(getOpponent).filter((o): o is Opponent => !!o);
    if (!regulars.length || !venue.games.length) return null;

    const opponent = pick(regulars);
    const playable = venue.games.filter(g => opponent.games.includes(g));
    if (!playable.length) return null;

    const game = pick(playable);
    const skill = effectiveSkill(opponent, player);
    const stake = opponent.stake;

    return {
        id: `challenge-${venue.id}-${opponent.npcId}-${game}`,
        icon: venue.icon,
        headline: `${opponent.name} wants a game`,
        body: `${venue.name}. ${challengeLine(opponent)}`,
        acceptLabel: stake > 0 ? `Play for $${stake}` : 'Play',
        declineLabel: 'Not today',
        match: {
            game,
            title: `${opponent.name} — ${venue.name}`,
            config: { opponent: opponent.name, opponentNpcId: opponent.npcId, spriteId: opponent.spriteId, skill, thief: opponent.name },
            onWin: [
                ...(stake > 0 ? [money(stake, `${opponent.name} pays up.`)] : []),
                cred(Math.round(5 + skill * 12), `You beat ${opponent.name} on their own turf.`),
            ],
            onLose: [
                ...(stake > 0 ? [money(-stake, `${opponent.name} collects.`)] : []),
                cred(-3, `${opponent.name} will be telling people.`),
            ],
        },
        onDecline: [cred(-1, 'Word gets around that you ducked it.')],
    };
}

/** Events that need no venue — they happen to you in the street. */
function streetEvent(player: Player): CityEvent | null {
    const options: (() => CityEvent)[] = [
        () => ({
            id: 'street-cart',
            icon: '🛒',
            headline: 'Somebody just took a box',
            body: 'You did not see who. You do see a shopping trolley picking up speed down the hill, and a man in it who is not steering so much as hoping.',
            acceptLabel: 'Go after him',
            declineLabel: 'Let it go',
            match: {
                game: 'cart-race',
                title: 'Downhill',
                config: { thief: 'The Game', opponentNpcId: 'the-game', spriteId: 'the-game' },
                onWin: [
                    { type: 'inventoryChange', add: [{ kind: 'item', value: 'random-rare', qty: 1 }], description: 'You get the box back.' },
                    cred(9, 'Half the street watched that.'),
                ],
                onLose: [{ type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'Gone.' }],
            },
            onDecline: [{ type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'You let it go, and it went.' }],
        }),
        () => ({
            id: 'street-table',
            icon: '📦',
            headline: 'A folding table appears',
            body: '"You want mystery box? Is very good. Probably." He has three. He does not know what is in any of them.',
            acceptLabel: 'Look at the boxes',
            declineLabel: 'Keep walking',
            match: { game: 'mystery-box', title: 'Back-Alley Mystery Box' },
        }),
        () => ({
            id: 'street-authenticate',
            icon: '🔍',
            headline: '"You know shoes?"',
            body: 'A man with a UV lamp and a folding table has a pair he cannot call, and twenty dollars that says you cannot either.',
            acceptLabel: 'Take a look',
            declineLabel: 'Decline',
            match: {
                game: 'legit-check',
                title: 'Kerbside Authentication',
                config: { sneakerName: 'his mystery pair' },
                onWin: [money(240, 'He pays for the call.'), cred(5, 'Word gets around that you know.')],
                onLose: [cred(-4, 'You got it wrong in front of a crowd.')],
            },
        }),
        () => ({
            id: 'street-shift',
            icon: '🍕',
            headline: 'A man is holding out a set of keys',
            body: '"You want a shift? Driver quit. Bike is out back. It is a long night and the boxes are already stacked."',
            acceptLabel: 'Take the shift',
            declineLabel: 'Not tonight',
            match: {
                game: 'pizza-run',
                title: 'Night Shift',
                onWin: [money(900, 'You made rent.'), cred(3, 'You are dependable, which nobody finds interesting.')],
                onLose: [money(-60, 'You are paying for the boxes you scattered.')],
            },
        }),
    ];

    return pick(options)();
}

/**
 * Rolled when the player arrives somewhere or pokes around the city.
 * Returns null most of the time — an event that always fires stops being one.
 */
export function rollCityEvent(player: Player, cityId: string, day: number): CityEvent | null {
    if (player.emergency) return null;           // you have other problems
    if (player.energy < 12) return null;         // too tired to be challenged
    if (Math.random() > 0.34) return null;

    const open = venuesIn(cityId).filter(v =>
        isVenueOpen(v, day)
        && (v.minCred === undefined || player.streetCred >= v.minCred));

    // Prefer a venue challenge when somewhere is actually open, because a named
    // opponent on their own turf beats a generic street encounter.
    if (open.length && Math.random() < 0.65) {
        const shuffled = [...open].sort(() => 0.5 - Math.random());
        for (const venue of shuffled) {
            const event = challengeAt(venue, player);
            if (event) return event;
        }
    }

    return streetEvent(player);
}
