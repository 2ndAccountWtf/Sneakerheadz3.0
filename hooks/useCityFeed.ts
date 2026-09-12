
import { useState, useEffect } from 'react';
import { useGame } from './useGame';
import { generateRumorsForCity } from '../systems/rumorEngine';
import type { ActiveRumor } from '../types/rumors';
import type { MarketSignal } from '../types/news';

export function useCityFeed(): { feed: ActiveRumor[] } {
    const { gameState, dispatch } = useGame();
    const { day, currentCityId } = gameState;
    const [feed, setFeed] = useState<ActiveRumor[]>([]);

    useEffect(() => {
        // 1. Generate or get cached rumors from the central engine
        const rumorsWithContext = generateRumorsForCity(currentCityId, day);

        // 2. Process side-effects for true rumors
        rumorsWithContext.forEach(rumor => {
            if (rumor.isTrue && rumor.potentialEffect) {
                if (rumor.potentialEffect.type === 'marketSignal') {
                    const payload = rumor.potentialEffect.payload;
                    const signalId = `signal-rumor-${day}-${rumor.id}`;

                    const signal: MarketSignal = {
                        id: signalId,
                        effect: payload.effect,
                        magnitude: payload.magnitude,
                        expiresOnDay: day + Math.max(1, Math.ceil(payload.durationHrs / 24)),
                        targets: [{ 
                            kind: payload.target.kind, 
                            value: (payload.target.value === '{sneaker_id}' && rumor.sneakerTargetId) 
                                   ? rumor.sneakerTargetId 
                                   : payload.target.value 
                        }],
                        sourceNewsId: `rumor-${rumor.id}`,
                        label: rumor.text,
                    };
                    
                    if (!gameState.activeMarketSignals.some(s => s.id === signalId)) {
                        dispatch({ type: 'APPLY_MARKET_SIGNAL', payload: signal });
                    }
                }
            }
        });

        // 3. Set the feed for the UI (without the extra context)
        setFeed(rumorsWithContext);

    }, [day, currentCityId, dispatch, gameState.activeMarketSignals]);

    return { feed };
}
