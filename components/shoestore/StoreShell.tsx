import React from 'react';
import { useGame } from '../../hooks/useGame';
import { Screen } from '../../types';
import NavButton from '../NavButton';

interface StoreShellProps {
    children: React.ReactNode;
}

const StoreShell: React.FC<StoreShellProps> = ({ children }) => {
    const { changeScreen } = useGame();

    return (
        <div className="relative">
            <div className="absolute top-2 right-2 z-50">
                <NavButton onClick={() => changeScreen(Screen.CityStores)}>Exit</NavButton>
            </div>
            {children}
        </div>
    );
};

export default StoreShell;