import React from 'react';
import { useGame } from '../hooks/useGame';
import NavButton from '../components/NavButton';
import { CITIES } from '../data/cities';

const TravelEventScreen: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const { pendingTravelEvent, currentCityId } = gameState;

    if (!pendingTravelEvent) {
        // This shouldn't happen if the screen is rendered correctly, but it's a good safeguard.
        dispatch({ type: 'CLEAR_TRAVEL_EVENT' });
        return <div className="text-center">Loading event...</div>;
    }

    const currentCity = CITIES.find(c => c.id === currentCityId);
    
    const handleContinue = () => {
        dispatch({ type: 'CLEAR_TRAVEL_EVENT' });
    };

    const getEventIcon = (category: string) => {
        switch (category) {
            case 'mugging': return '💰';
            case 'scalper': return '🎟️';
            case 'grandma': return '👵';
            case 'customs': return '🛂';
            case 'lucky': return '🍀';
            case 'rare-chaos': return '✨';
            default: return '✈️';
        }
    };

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-900/50 border-2 border-yellow-500/50 shadow-[0_0_25px_rgba(255,235,59,0.3)]">
            <div className="text-6xl mb-4 animate-pulse">
                {getEventIcon(pendingTravelEvent.category)}
            </div>
            <h1 className="text-4xl font-bold text-yellow-400 mb-2 uppercase tracking-widest">
                An Event Occurred!
            </h1>
            <p className="text-xl text-gray-300 mb-2">
                While traveling to {currentCity?.name}, you encountered a...
            </p>
            <p className="text-3xl font-bold text-white bg-gray-800 px-4 py-2 border border-yellow-500/30">
                {pendingTravelEvent.category.replace(/-/g, ' ')}
            </p>
            <p className="text-sm text-gray-500 mt-4">(Full event details coming in a future update)</p>
            <NavButton onClick={handleContinue} className="mt-8">
                Continue to {currentCity?.name}
            </NavButton>
        </div>
    );
};

export default TravelEventScreen;