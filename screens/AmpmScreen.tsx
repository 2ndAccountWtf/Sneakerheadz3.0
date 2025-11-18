import React, { useState, useMemo, useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen, AmpmItem } from '../types';
import { AMPM_ITEMS } from '../data/ampmItems';
import NavButton from '../components/NavButton';
import { useAmpmWorker } from '../hooks/useAmpmWorker';
import { AmbientNpcProfile } from '../types/interactions';

const AmpmItemCard: React.FC<{ item: AmpmItem, onBuy: () => void, disabled: boolean }> = ({ item, onBuy, disabled }) => {
    return (
        <div className="bg-gray-800 border border-cyan-400/30 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-left">
            <div className="flex-grow mb-4 sm:mb-0">
                <h3 className="text-xl font-bold text-white">{item.name}</h3>
                <p className="text-gray-400 text-sm">{item.description}</p>
                <p className="text-xs text-yellow-500 mt-1">{item.effect}</p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-start sm:items-end w-full sm:w-auto">
                <p className="text-2xl font-bold text-green-400 mb-2">${item.price}</p>
                 <NavButton onClick={onBuy} disabled={disabled} className="px-4 py-1 text-sm w-full sm:w-auto">
                    Buy
                </NavButton>
            </div>
        </div>
    );
};

const CATEGORIES: Record<string, string> = {
    'Food & Drinks': '🍔',
    'Tools & Gear': '🛠️',
    'Local Specialties': '✨',
};

const AmpmScreen: React.FC = () => {
    const { gameState, changeScreen, startInteraction, buyStorageItem } = useGame();
    const { player, currentCityId } = gameState;
    const [selectedCategory, setSelectedCategory] = useState<string>('Food & Drinks');
    
    // Get the active worker for this store visit
    const worker = useAmpmWorker();

    // Trigger a random interaction on store entry
    useEffect(() => {
        if (worker && worker.scenarios.length > 0 && Math.random() < 0.3) { // 30% chance on entry
            const scenario = worker.scenarios[Math.floor(Math.random() * worker.scenarios.length)];
            startInteraction(worker.id, scenario.id);
        }
    }, [worker, startInteraction]);

    const availableItems = useMemo(() => {
        return AMPM_ITEMS.filter(item => !item.cities || item.cities.includes(currentCityId));
    }, [currentCityId]);

    const groupedItems = useMemo(() => {
         return availableItems.reduce((acc, item) => {
            const category = item.category;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        }, {} as Record<string, AmpmItem[]>);
    }, [availableItems]);

    const availableCategories = Object.keys(groupedItems);
    
    if (!availableCategories.includes(selectedCategory) && availableCategories.length > 0) {
        setSelectedCategory(availableCategories[0]);
    }

    const handleBuy = (item: AmpmItem) => {
        buyStorageItem(item.id, item.price);
        // Trigger a random interaction after purchase
        if (worker && worker.scenarios.length > 0 && Math.random() < 0.5) { // 50% chance on purchase
            const scenario = worker.scenarios[Math.floor(Math.random() * worker.scenarios.length)];
            startInteraction(worker.id, scenario.id);
        }
    };

    return (
        <div className="bg-gray-900 p-2 sm:p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-4xl font-bold text-cyan-400 uppercase tracking-widest">AM/PM</h1>
                <div className="flex items-center gap-4">
                    <NavButton onClick={() => changeScreen(Screen.Dashboard)}>Back to City</NavButton>
                </div>
            </div>

            {/* Worker Display */}
            {worker && (
                 <div className="flex items-center gap-4 p-4 mb-6 bg-gray-800/50 border border-cyan-500/20">
                    <img src={worker.portraitUrl} alt={worker.name} className="w-16 h-16 object-cover border-2 border-cyan-700" />
                    <div>
                        <p className="text-gray-400 text-sm">On Duty:</p>
                        <p className="text-xl font-bold text-white">{worker.name}</p>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-center flex-wrap gap-2 mb-6 border-b-2 border-cyan-500/20 pb-4">
                {availableCategories.map(category => {
                    const isActive = selectedCategory === category;
                    return (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`
                                px-4 py-2 text-lg font-bold rounded-md transition-all duration-200
                                flex items-center space-x-2
                                ${isActive
                                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30'
                                    : 'bg-gray-800 text-cyan-400 hover:bg-gray-700/50'
                                }
                            `}
                        >
                            <span>{CATEGORIES[category as keyof typeof CATEGORIES]}</span>
                            <span>{category}</span>
                        </button>
                    );
                })}
            </div>

            <div className="space-y-4">
                {(groupedItems[selectedCategory] || []).map(item => (
                    <AmpmItemCard
                        key={item.id}
                        item={item}
                        onBuy={() => handleBuy(item)}
                        disabled={player.cash < item.price}
                    />
                ))}
            </div>

            {(!groupedItems[selectedCategory] || groupedItems[selectedCategory].length === 0) && (
                <div className="text-center text-gray-500 mt-8 p-4">
                    <p>Nothing in this section.</p>
                </div>
            )}
        </div>
    );
};

export default AmpmScreen;