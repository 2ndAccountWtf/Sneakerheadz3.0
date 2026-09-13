import React from 'react';
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

    // Bailing out counts as a loss, so running away from The Game still costs
    // you whatever the writers said it should.
    // (see canUseWebGL below for why Flight 404 branches)
    const quit = () => dispatch({ type: 'RESOLVE_MINIGAME', payload: { won: false, note: 'You backed out.' } });
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
            // Flight 404 exists twice: a hand-rolled canvas build and a Phaser
            // one. The Phaser build looks considerably better and costs nothing
            // until it is opened (Phaser is a separate ~380KB chunk fetched on
            // mount, and only +5KB in the main bundle), so it is what players
            // get. The canvas build is the fallback for anything without WebGL
            // — Phaser cannot start at all there, whereas a 2D context is
            // essentially guaranteed — and it is the version `tests/` can drive
            // headlessly, since its world is a pure step function.
            return canUseWebGL()
                ? <Flight404Phaser onFinish={finish} onQuit={quit} />
                : <Flight404 onFinish={finish} onQuit={quit} />;
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
