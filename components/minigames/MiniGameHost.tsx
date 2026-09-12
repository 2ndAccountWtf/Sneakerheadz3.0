import React from 'react';
import { useGame } from '../../hooks/useGame';
import StreetBrawl from './StreetBrawl';
import HypecastRoulette from './HypecastRoulette';
import SneakerChase from './SneakerChase';
import MysteryBox from './MysteryBox';
import LegitCheck from './LegitCheck';
import StreetBall from './StreetBall';
import type { ScenarioOutcome } from '../../types/interactions';

/**
 * Routes the active mini-game request to its component and funnels every
 * result back through one action, so win/lose payloads authored in dialogue
 * are applied identically no matter which game resolved them.
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
    const walkAway = () => dispatch({ type: 'CLOSE_MINIGAME' });

    switch (req.game) {
        case 'street-brawl':
            return <StreetBrawl opponent={req.config?.opponent ?? 'Some Guy'} onFinish={finish} onQuit={quit} />;
        case 'hypecast-roulette':
            return <HypecastRoulette deckId={req.config?.deckId} title={req.title} onFinish={finish} onQuit={quit} />;
        case 'sneaker-chase':
            return <SneakerChase thief={req.config?.thief} onFinish={finish} onQuit={quit} />;
        case 'mystery-box':
            return <MysteryBox onFinish={finishWith} onQuit={walkAway} />;
        case 'legit-check':
            return <LegitCheck sneakerName={req.config?.sneakerName} onFinish={finish} onQuit={walkAway} />;
        case 'street-ball':
            return <StreetBall opponent={req.config?.opponent} onFinish={finish} onQuit={quit} />;
        default:
            return null;
    }
};

export default MiniGameHost;
