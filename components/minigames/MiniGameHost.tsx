import React, { useCallback, useState } from 'react';
import { useGame } from '../../hooks/useGame';
import StreetFighter from './StreetFighter';
import HypecastRoulette from './HypecastRoulette';
import SneakerChase from './SneakerChase';
import MysteryBox from './MysteryBox';
import LegitCheck from './LegitCheck';
import HoopsGame from './HoopsGame';
import CartRace from './CartRace';
import Flight404 from './Flight404';
import RooftopArtillery from './RooftopArtillery';
import Flight404Phaser from './phaser/Flight404Phaser';
import DiceGame from './DiceGame';
import DartsGame from './DartsGame';
import PizzaRun from './PizzaRun';
import type { ScenarioOutcome } from '../../types/interactions';

/**
 * Routes the active mini-game request to its component and funnels every
 * result back through one action, so the win/lose payloads authored in
 * dialogue are applied identically no matter which game resolved them.
 *
 * Two ids are deliberately stable — `street-brawl` and `street-ball` — because
 * hundreds of authored `combat` outcomes reference them. Their implementations
 * were swapped underneath for the 2D fighter and the arcade hoops game without
 * touching a single line of content.
 */
/**
 * Probed once and cached. A failed probe must not be retried per render — and
 * must never throw, because some privacy modes make the call itself hostile.
 */
let webglSupport: boolean | null = null;
function canUseWebGL(): boolean {
    if (webglSupport !== null) return webglSupport;
    try {
        const canvas = document.createElement('canvas');
        webglSupport = Boolean(
            canvas.getContext('webgl2') ?? canvas.getContext('webgl'),
        );
    } catch {
        webglSupport = false;
    }
    return webglSupport;
}

/**
 * Flight 404 exists twice: a hand-rolled canvas build and a Phaser one.
 *
 * The Phaser build looks considerably better and costs nothing until it is
 * opened (Phaser is a separate ~380KB chunk fetched on mount, and only +5KB in
 * the main bundle), so it is what players get. The canvas build is the same
 * game — same sections, same cast, same boss — on a 2D context, and it is the
 * version `tests/` can drive headlessly, since its world is a pure step
 * function.
 *
 * `canUseWebGL` picks between them up front, and that probe is necessary but
 * not sufficient: it answers "can this browser make a context at all", which is
 * a different question from "will Phaser start, with a drawing buffer this
 * size, on this connection, and keep it". A chunk that never arrives, a buffer
 * the browser declines, a phone that drops the context under memory pressure,
 * or a driver blocklisted after the probe all end the same way — and until now
 * they all ended on a red box reading "the engine failed to load", with a
 * complete, working build of the same level sitting unused in the next file.
 *
 * So the probe chooses, and a failure re-chooses. Losing the engine costs the
 * player the nicer renderer, not the game.
 */
export const Flight404Route: React.FC<{
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ onFinish, onQuit }) => {
    const [engineDown, setEngineDown] = useState<string | null>(null);

    // One-way. Re-mounting Phaser after it has failed once would almost always
    // fail the same way, and the second attempt would land on a player who is
    // already looking at a working game.
    const fail = useCallback((reason: string) => {
        console.warn(`[flight 404] falling back to the canvas build: ${reason}`);
        setEngineDown(reason);
    }, []);

    if (engineDown === null && canUseWebGL()) {
        return <Flight404Phaser onFinish={onFinish} onQuit={onQuit} onEngineError={fail} />;
    }
    return <Flight404 onFinish={onFinish} onQuit={onQuit} />;
};

const MiniGameHost: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const req = gameState.activeMiniGame;

    if (!req) return null;

    const finish = (won: boolean, note: string) => {
        dispatch({ type: 'RESOLVE_MINIGAME', payload: { won, note } });
    };

    /** For games that generate their own bespoke outcomes (e.g. box loot). */
    const finishWith = (won: boolean, note: string, outcomes: ScenarioOutcome[]) => {
        dispatch({ type: 'APPLY_OUTCOMES', payload: { outcomes, sourceName: req.title } });
        dispatch({ type: 'RESOLVE_MINIGAME', payload: { won, note } });
    };

    // Bailing out is not losing. It used to dispatch a full loss, which on the
    // chase games meant a uniformly-picked pair out of your bag — up to $75,000
    // for declining to play. `QUIT_MINIGAME` charges the walk-out forfeit and
    // nothing else, except on a police stop, which you cannot leave by closing
    // the window. See the reducer.
    // (see canUseWebGL below for why Flight 404 branches)
    const quit = () => dispatch({ type: 'QUIT_MINIGAME' });
    // Walking away from a shop-style game costs nothing — there was no wager.
    const walkAway = () => dispatch({ type: 'CLOSE_MINIGAME' });

    switch (req.game) {
        case 'street-brawl':
            return <StreetFighter opponent={req.config?.opponent ?? 'Some Guy'} onFinish={finish} onQuit={quit} />;
        case 'street-ball':
            return (
                <HoopsGame
                    opponent={req.config?.opponent}
                    skill={req.config?.skill}
                    opponentNpcId={req.config?.opponentNpcId}
                    onFinish={finish}
                    onQuit={quit}
                />
            );
        case 'sneaker-chase':
            return <SneakerChase thief={req.config?.thief} onFinish={finish} onQuit={quit} />;
        case 'cart-race':
            return <CartRace thief={req.config?.thief} onFinish={finish} onQuit={quit} />;
        case 'flight-404':
            return <Flight404Route onFinish={finish} onQuit={quit} />;
        case 'street-dice':
            return <DiceGame opponent={req.config?.opponent} onFinish={finish} onQuit={quit} />;
        case 'drunk-darts':
            return <DartsGame opponent={req.config?.opponent} onFinish={finish} onQuit={quit} />;
        case 'rooftop-artillery':
            return (
                <RooftopArtillery
                    opponent={req.config?.opponent}
                    skill={req.config?.skill}
                    opponentNpcId={req.config?.opponentNpcId}
                    onFinish={finish}
                    onQuit={quit}
                />
            );
        case 'pizza-run':
            return <PizzaRun onFinish={finish} onQuit={quit} />;
        case 'hypecast-roulette':
            return <HypecastRoulette deckId={req.config?.deckId} title={req.title} onFinish={finish} onQuit={quit} />;
        case 'mystery-box':
            return <MysteryBox onFinish={finishWith} onQuit={walkAway} />;
        case 'legit-check':
            return <LegitCheck sneakerName={req.config?.sneakerName} onFinish={finish} onQuit={walkAway} />;
        default:
            return null;
    }
};

export default MiniGameHost;
