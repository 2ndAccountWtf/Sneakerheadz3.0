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
    const quit = () => dispatch({ type: 'RESOLVE_MINIGAME', payload: { won: false, note: 'You backed out.' } });
    // Walking away from a shop-style game costs nothing — there was no wager.
    const walkAway = () => dispatch({ type: 'CLOSE_MINIGAME' });

    switch (req.game) {
        case 'street-brawl':
            return <StreetFighter opponent={req.config?.opponent ?? 'Some Guy'} onFinish={finish} onQuit={quit} />;
        case 'street-ball':
            return <HoopsGame opponent={req.config?.opponent} onFinish={finish} onQuit={quit} />;
        case 'sneaker-chase':
            return <SneakerChase thief={req.config?.thief} onFinish={finish} onQuit={quit} />;
        case 'cart-race':
            return <CartRace thief={req.config?.thief} onFinish={finish} onQuit={quit} />;
        case 'flight-404':
            return <Flight404 onFinish={finish} onQuit={quit} />;
        case 'street-dice':
            return <DiceGame opponent={req.config?.opponent} onFinish={finish} onQuit={quit} />;
        case 'drunk-darts':
            return <DartsGame opponent={req.config?.opponent} onFinish={finish} onQuit={quit} />;
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
