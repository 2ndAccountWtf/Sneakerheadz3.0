import React, { useMemo, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { venuesIn, isVenueOpen, timeOfDayFor, type Venue } from '../data/venues';
import { getOpponent, effectiveSkill, challengeLine, rivalryWith, type Opponent } from '../systems/opponents';
import { CITIES } from '../data/cities';
import { whereIs } from '../systems/npc/schedule';
import { coPresenceEvent, refusesYou } from '../systems/npc/reactions';
import type { MiniGameId, MiniGameRequest } from '../types/game';
import type { ScenarioOutcome } from '../types/interactions';

const GAME_LABEL: Record<string, { name: string; icon: string }> = {
    'street-ball': { name: 'Street Ball', icon: '🏀' },
    'street-brawl': { name: 'Brawl', icon: '🥊' },
    'street-dice': { name: 'Dice', icon: '🎲' },
    'drunk-darts': { name: 'Darts', icon: '🎯' },
    'cart-race': { name: 'Downhill', icon: '🛒' },
    'sneaker-chase': { name: 'Chase', icon: '🏃' },
    'mystery-box': { name: 'Mystery Box', icon: '📦' },
    'legit-check': { name: 'Legit Check', icon: '🔍' },
    'hypecast-roulette': { name: 'On Air', icon: '🎙' },
    'pizza-run': { name: 'Night Shift', icon: '🍕' },
    'flight-404': { name: 'Flight 404', icon: '✈️' },
};

const cred = (n: number, text: string): ScenarioOutcome => ({ type: 'streetCred', change: n, description: text });
const money = (n: number, text: string): ScenarioOutcome =>
    n >= 0
        ? { type: 'inventoryChange', add: [{ kind: 'currency', value: 'cash', qty: n }], description: text }
        : { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: -n }], description: text };
const energy = (n: number, text: string): ScenarioOutcome =>
    ({ type: 'stat_change', payload: { stat: 'energy', value: n }, description: text });

/**
 * Builds the request for a match at a venue.
 *
 * The stake and the cred swing both scale with who you are playing: beating
 * Grandma Laces at dice should mean more than beating Wiz K, because she is
 * better and everyone knows it. Rivalry is recorded so repeat opponents get
 * harder — they have been watching you.
 */
function buildMatch(game: MiniGameId, venue: Venue, opponent: Opponent | null, skill: number): MiniGameRequest {
    const name = opponent?.name ?? 'a regular';
    const stake = opponent?.stake ?? 100;
    const credWin = Math.round(4 + skill * 12);

    return {
        game,
        title: `${GAME_LABEL[game]?.name ?? 'Match'} — ${venue.name}`,
        config: {
            opponent: name,
            opponentNpcId: opponent?.npcId,
            spriteId: opponent?.spriteId,
            skill,
            thief: name,
        },
        onWin: [
            ...(stake > 0 ? [money(stake, `${name} pays up.`)] : []),
            cred(credWin, `You beat ${name} in front of people.`),
            energy(-venue.energyCost, 'That took something out of you.'),
            ...(opponent ? [{ type: 'flag', key: `rival-${opponent.npcId}`, value: 0, description: '' } as ScenarioOutcome] : []),
        ],
        onLose: [
            ...(stake > 0 ? [money(-stake, `${name} collects.`)] : []),
            cred(-Math.max(2, Math.round(credWin / 3)), `${name} will mention this.`),
            energy(-venue.energyCost, 'And you lost.'),
        ],
    };
}

const VenuesScreen: React.FC = () => {
    const { gameState, launchMiniGame, dispatch } = useGame();
    const { currentCityId, day, player } = gameState;

    const venues = useMemo(() => venuesIn(currentCityId), [currentCityId]);
    const cityName = CITIES.find(c => c.id === currentCityId)?.name ?? 'here';
    const [expanded, setExpanded] = useState<string | null>(venues[0]?.id ?? null);

    /**
     * The day's one co-presence scene, if there is one.
     *
     * Scans today's actual placements for a venue holding two NPCs who have
     * authored history, and keeps the first. Deliberately at most one a day:
     * six simultaneous feuds across six venues reads as noise, while one
     * argument happening in a bar you were not going to visit reads as a world
     * that is running whether or not you turn up.
     */
    const scene = useMemo(() => {
        for (const venue of venues) {
            if (!isVenueOpen(venue, day)) continue;
            const present = venue.regulars.filter(id => whereIs(id, currentCityId, day).venueId === venue.id);
            for (let i = 0; i < present.length; i++) {
                for (let j = i + 1; j < present.length; j++) {
                    const event = coPresenceEvent(present[i], present[j], day);
                    if (event) return { venueId: venue.id, event };
                }
            }
        }
        return null;
    }, [venues, currentCityId, day]);

    const start = (venue: Venue, game: MiniGameId) => {
        // Pick a regular who actually plays this game; fall back to any regular.
        const candidates = venue.regulars
            .map(getOpponent)
            .filter((o): o is Opponent => !!o);
        // Somebody who will not deal with you will not play you either. Their
        // memory of what you did has to cost something concrete, or "they
        // remember" is just a line of dialogue.
        const speaking = candidates.filter(o => !refusesYou(player, o.npcId).refuses);
        const willing = speaking.filter(o => o.games.includes(game));
        const opponent = willing[Math.floor(Math.random() * willing.length)]
            ?? speaking[Math.floor(Math.random() * speaking.length)]
            ?? null;

        if (!opponent && candidates.length > 0) {
            // Everyone here has a reason not to. Say whose, and what it is.
            const snubbed = candidates[0];
            dispatch({
                type: 'SET_NOTIFICATION',
                payload: {
                    message: refusesYou(player, snubbed.npcId).reason
                        ?? `${snubbed.name} will not play you.`,
                    type: 'error',
                },
            });
            return;
        }

        const skill = opponent ? effectiveSkill(opponent, player) : 0.5;

        if (opponent) {
            // Record the meeting so the rematch is harder.
            dispatch({
                type: 'APPLY_OUTCOMES',
                payload: {
                    sourceName: opponent.name,
                    outcomes: [{
                        type: 'flag',
                        key: `rival-${opponent.npcId}`,
                        value: rivalryWith(player, opponent.npcId) + 1,
                        description: '',
                    }],
                },
            });
        }

        launchMiniGame(buildMatch(game, venue, opponent, skill));
    };

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Around <span className="accent">{cityName}</span></>}
                subtitle={`${venues.length} places worth knowing · it is ${timeOfDayFor(day)}`}
                back={Screen.Dashboard}
            />

            {venues.length === 0 ? (
                <div className="panel p-10 text-center">
                    <div className="text-4xl mb-3">🚧</div>
                    <p className="text-[var(--ink-dim)]">Nothing going on here. Try another city.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {venues.map(venue => {
                        const open = isVenueOpen(venue, day);
                        const locked = venue.minCred !== undefined && player.streetCred < venue.minCred;
                        const tooTired = player.energy < venue.energyCost;
                        const isOpenCard = expanded === venue.id;

                        const regulars = venue.regulars
                            .map(getOpponent)
                            .filter((o): o is Opponent => !!o);

                        return (
                            <div key={venue.id} className="panel">
                                <button
                                    className="panel-head w-full text-left"
                                    onClick={() => setExpanded(isOpenCard ? null : venue.id)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xl leading-none flex-shrink-0">{venue.icon}</span>
                                        <div className="min-w-0">
                                            <div className="font-display text-sm uppercase text-white truncate">{venue.name}</div>
                                            <div className="label truncate">
                                                {!open ? 'Closed right now' : locked ? `Needs ${venue.minCred} cred` : `${venue.games.length} thing${venue.games.length > 1 ? 's' : ''} to do`}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="label flex-shrink-0">{isOpenCard ? '[ − ]' : '[ + ]'}</span>
                                </button>

                                {isOpenCard && (
                                    <div className="p-4">
                                        <p className="text-sm text-[var(--ink-dim)] leading-snug mb-3">{venue.blurb}</p>

                                        {regulars.length > 0 && (
                                            <div className="mb-3">
                                                <div className="label mb-1.5">{open ? 'Who is here' : 'Regulars'}</div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {regulars.map(o => {
                                                        const met = rivalryWith(player, o.npcId);
                                                        // A roster that always reads the same is a cast
                                                        // list, not a place. `whereIs` puts each regular
                                                        // somewhere specific today, so "usually here"
                                                        // becomes "here, probably" or "not today".
                                                        const placed = whereIs(o.npcId, currentCityId, day);
                                                        const hereNow = placed.venueId === venue.id;
                                                        const likely = hereNow && placed.likelihood >= 0.55;
                                                        // On a shut venue, "elsewhere" is not information —
                                                        // of course they are elsewhere, the door is locked.
                                                        // So a closed card goes back to a plain roster.
                                                        const where = !open
                                                            ? ''
                                                            : hereNow ? (likely ? ' · here' : ' · maybe') : ' · elsewhere';
                                                        return (
                                                            <span
                                                                key={o.npcId}
                                                                className={`chip ${!open ? '' : hereNow ? (likely ? 'chip-accent' : '') : '!opacity-45'}`}
                                                                title={open && !hereNow ? placed.place : challengeLine(o)}
                                                            >
                                                                {o.name}{where}{met > 0 ? ` · ${met}×` : ''}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Two people who have history, in one room. The scene is
                                            between them — the player is a bystander, which is what
                                            makes the world feel like it exists without you. */}
                                        {scene && scene.venueId === venue.id && (
                                            <div className="panel-raised p-3 mb-3 animate-rise" style={{ borderColor: 'var(--accent-2)' }}>
                                                <div className="label mb-1" style={{ color: 'var(--accent-2)' }}>{scene.event.headline}</div>
                                                <p className="text-sm text-[var(--ink-dim)] leading-snug">{scene.event.body}</p>
                                            </div>
                                        )}

                                        {!open ? (
                                            <p className="text-sm text-[var(--warn)] italic">{venue.closedLine ?? 'Not open right now.'}</p>
                                        ) : locked ? (
                                            <p className="text-sm text-[var(--bad)]">
                                                They do not know you yet. Come back with {venue.minCred} street cred.
                                            </p>
                                        ) : (
                                            <>
                                                <div className="flex flex-wrap gap-2">
                                                    {venue.games.map(game => (
                                                        <button
                                                            key={game}
                                                            className="btn btn-accent"
                                                            disabled={tooTired}
                                                            onClick={() => start(venue, game)}
                                                        >
                                                            {GAME_LABEL[game]?.icon} {GAME_LABEL[game]?.name ?? game}
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="label mt-2.5">
                                                    ⚡ {venue.energyCost} energy{tooTired ? ' — you are too tired' : ''}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="label text-center mt-5">
                Regulars remember. Play somebody twice and they will have worked you out.
            </p>
        </div>
    );
};

export default VenuesScreen;
