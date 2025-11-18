import React from 'react';
import { useGame } from '../hooks/useGame';
import { useStoreConfig } from '../hooks/useStoreConfig';
import ShoeStore from '../components/shoestore/ShoeStore';
import NavButton from '../components/NavButton';
import { Screen } from '../types';

const ShoeStoreScreen: React.FC = () => {
    const { gameState, changeScreen } = useGame();
    const { currentStoreId, currentCityId } = gameState;

    if (!currentStoreId) {
        return (
            <div className="text-center p-8">
                <p className="text-red-500 text-xl">Error: No store selected.</p>
                <NavButton onClick={() => changeScreen(Screen.Dashboard)} className="mt-4">
                    Go to Dashboard
                </NavButton>
            </div>
        );
    }

    const storeConfig = useStoreConfig(currentCityId, currentStoreId);

    if (!storeConfig) {
        return (
             <div className="text-center p-8">
                <p className="text-red-500 text-xl">Error: Could not load configuration for store ID: {currentStoreId}</p>
                 <NavButton onClick={() => changeScreen(Screen.CityStores)} className="mt-4">
                    Back to Stores
                </NavButton>
            </div>
        );
    }

    return <ShoeStore store={storeConfig} />;
};

export default ShoeStoreScreen;
