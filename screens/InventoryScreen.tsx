
import React from 'react';
import { useGame } from '../hooks/useGame';
import { SNEAKERS } from '../data/sneakers';
import { Screen } from '../types';
import SneakerCard from '../components/SneakerCard';
import NavButton from '../components/NavButton';

const InventoryScreen: React.FC = () => {
    const { gameState, changeScreen, sellSneaker } = useGame();
    const { player, markets, currentCityId } = gameState;
    const cityMarket = markets[currentCityId];

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-4xl font-bold text-cyan-400 uppercase tracking-widest">Your Inventory</h1>
                <NavButton onClick={() => changeScreen(Screen.Dashboard)}>Back to City</NavButton>
            </div>

            {player.inventory.length === 0 ? (
                <p className="text-center text-gray-400 text-xl mt-12">Your inventory is empty. Go buy some heat!</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {player.inventory.map(item => {
                        const sneakerDetails = SNEAKERS.find(s => s.id === item.sneakerId);
                        if (!sneakerDetails) return null;

                        const marketPrice = cityMarket.sneakers.find(ms => ms.sneakerId === item.sneakerId)?.price;

                        return (
                            <SneakerCard
                                key={item.instanceId}
                                sneaker={sneakerDetails}
                                price={marketPrice}
                                purchasePrice={item.purchasePrice}
                                isFake={item.isFake}
                                actionButton={
                                    <NavButton 
                                        onClick={() => marketPrice && sellSneaker(item.instanceId, marketPrice)}
                                        disabled={marketPrice === undefined}
                                        className="w-full"
                                    >
                                        Sell
                                    </NavButton>
                                }
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default InventoryScreen;
