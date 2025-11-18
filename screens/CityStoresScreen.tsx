import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import NavButton from '../components/NavButton';
import { STORES_BY_CITY } from '../data/stores';
import { CITIES } from '../data/cities';

const CityStoresScreen: React.FC = () => {
    const { gameState, changeScreen, selectStore } = useGame();
    const { currentCityId } = gameState;
    const storesInCity = STORES_BY_CITY[currentCityId] || [];
    const currentCityName = CITIES.find(c => c.id === currentCityId)?.name || 'this city';

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-4xl font-bold text-cyan-400 uppercase tracking-widest">Stores in {currentCityName}</h1>
                <NavButton onClick={() => changeScreen(Screen.Dashboard)}>Back to City</NavButton>
            </div>
            {storesInCity.length === 0 ? (
                <p className="text-center text-gray-400 text-xl mt-12">No notable sneaker stores here. Try another city.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {storesInCity.map(store => (
                        <div key={store.id} className="bg-gray-900/70 border border-cyan-500/30 p-6 flex flex-col justify-between transition-all hover:border-cyan-400 hover:shadow-lg">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">{store.name}</h2>
                                <p className="text-gray-400 mb-4">{store.description}</p>
                            </div>
                            <NavButton onClick={() => selectStore(store.id)} className="w-full mt-4">
                                Enter Store
                            </NavButton>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CityStoresScreen;
