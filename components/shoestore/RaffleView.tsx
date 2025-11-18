import React from 'react';
// FIX: Replaced non-existent ThemeProps with StoreTheme and updated import.
import { StoreTheme } from '../../types/shoestore';
import { useRaffle } from '../../hooks/useRaffle';
import NavButton from '../NavButton';

interface RaffleViewProps {
    raffle: ReturnType<typeof useRaffle>;
    theme: StoreTheme;
}

export const RaffleView: React.FC<RaffleViewProps> = ({ raffle, theme }) => {
    return (
        <div className="p-8 bg-gray-800/50 border border-cyan-500/20 mt-6 text-center">
            <h3 className="text-2xl font-bold text-cyan-400 mb-4">Sneaker Raffle</h3>
            {raffle.open ? (
                <div>
                    <p className="text-gray-300 mb-4">Raffle is now open! Draw at: {new Date(raffle.drawAt || Date.now()).toLocaleTimeString()}</p>
                    <NavButton onClick={() => raffle.enter('10')}>Enter Raffle (Size 10)</NavButton>
                </div>
            ) : (
                <p className="text-gray-400">No active raffle at the moment.</p>
            )}
        </div>
    );
};