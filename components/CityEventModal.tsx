import React from 'react';
import { useGame } from '../hooks/useGame';

/**
 * A happening in the city you are standing in.
 *
 * Deliberately lighter than the dialogue modal: one beat, two buttons, and it
 * gets out of the way. Declining is always available and usually costs a
 * little, so turning something down is a real choice rather than a free skip.
 */
const CityEventModal: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const event = gameState.activeCityEvent;

    // A mini-game or cutscene on screen owns the stage.
    if (!event || gameState.activeMiniGame || gameState.activeCutscene) return null;

    return (
        <div className="fixed inset-0 z-[66] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6">
            <div className="crt-panel w-full max-w-md p-5 animate-rise">
                <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl leading-none flex-shrink-0">{event.icon}</span>
                    <div className="min-w-0">
                        <div className="label" style={{ color: 'var(--accent)' }}>Right here, right now</div>
                        <h2 className="font-display text-base sm:text-lg uppercase text-white leading-tight mt-0.5">
                            {event.headline}
                        </h2>
                    </div>
                </div>

                <p className="text-sm text-[var(--ink)] leading-snug mb-5">{event.body}</p>

                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        className="btn btn-primary flex-1"
                        onClick={() => dispatch({ type: 'ACCEPT_CITY_EVENT' })}
                    >
                        {event.acceptLabel}
                    </button>
                    <button
                        className="btn btn-ghost flex-1"
                        onClick={() => dispatch({ type: 'DECLINE_CITY_EVENT' })}
                    >
                        {event.declineLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CityEventModal;
