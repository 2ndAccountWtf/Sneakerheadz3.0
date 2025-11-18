
import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';

interface BottomNavButtonProps {
    label: string;
    screen: Screen;
    currentScreen: Screen;
    onClick: (screen: Screen) => void;
    icon?: string;
}

const BottomNavButton: React.FC<BottomNavButtonProps> = ({ label, screen, currentScreen, onClick, icon }) => {
    const isActive = screen === currentScreen;
    
    return (
        <button
            onClick={() => onClick(screen)}
            className={`
                relative flex-1 flex flex-col items-center justify-center py-3
                transition-all duration-300 group
            `}
        >
            {/* Active Indicator Glow */}
            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-cyan-400 rounded-full blur-[2px] transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
            
            {/* Icon / Text */}
            <span className={`text-sm font-bold uppercase tracking-widest transition-colors duration-200 ${isActive ? 'text-cyan-300 text-glow' : 'text-gray-500 group-hover:text-gray-300'}`}>
                {label}
            </span>
            
            {/* Background Hover Effect */}
            <div className={`absolute inset-0 bg-white/5 rounded-lg scale-90 opacity-0 group-hover:opacity-100 transition-all duration-200 ${isActive ? 'opacity-0' : ''}`} />
        </button>
    );
};

const BottomNav: React.FC = () => {
    const { gameState, changeScreen } = useGame();
    const { currentScreen } = gameState;

    return (
        <div className="fixed bottom-4 left-0 right-0 z-50 px-4 flex justify-center pointer-events-none">
            <nav className="pointer-events-auto w-full max-w-lg bg-[#111]/90 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl shadow-black flex items-center justify-between px-2 overflow-hidden">
                <BottomNavButton label="Social" screen={Screen.Social} currentScreen={currentScreen} onClick={changeScreen} />
                <div className="w-[1px] h-6 bg-gray-800"></div>
                <BottomNavButton label="Storage" screen={Screen.Storage} currentScreen={currentScreen} onClick={changeScreen} />
                <div className="w-[1px] h-6 bg-gray-800"></div>
                <BottomNavButton label="Stats" screen={Screen.Stats} currentScreen={currentScreen} onClick={changeScreen} />
            </nav>
        </div>
    );
};

export default BottomNav;
    