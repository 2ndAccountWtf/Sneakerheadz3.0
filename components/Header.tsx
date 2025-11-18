
import React from 'react';
import { useGame } from '../hooks/useGame';
import { CITIES } from '../data/cities';
import { MAX_INVENTORY_SIZE, TOTAL_DAYS } from '../constants';

const Stat: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color = "text-white" }) => (
    <div className="flex flex-col items-start md:items-center md:flex-row gap-1 md:gap-2 bg-black/40 border border-white/10 px-3 py-1 rounded-sm clip-corner-br">
        <span className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-wider">{label}</span>
        <span className={`text-sm md:text-lg font-['Share_Tech_Mono'] font-bold ${color}`}>{value}</span>
    </div>
);

const Header: React.FC = () => {
    const { gameState } = useGame();
    const { player, currentCityId, day } = gameState;

    const currentCity = CITIES.find(city => city.id === currentCityId);

    return (
        <header className="sticky top-0 z-40 w-full bg-[#05080a]/80 backdrop-blur-md border-b border-cyan-500/20 shadow-lg shadow-cyan-500/5">
            <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                {/* Left: Branding / Location */}
                <div className="flex items-center gap-4">
                    <div className="hidden sm:block text-2xl font-['Orbitron'] font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
                        SDW
                    </div>
                    <div className="h-8 w-[1px] bg-gray-700 hidden sm:block"></div>
                    <div>
                        <div className="text-[10px] text-cyan-500/80 uppercase tracking-[0.2em]">Current Location</div>
                        <div className="text-lg sm:text-xl font-bold text-white uppercase tracking-wide leading-none">
                            {currentCity?.name}
                        </div>
                    </div>
                </div>

                {/* Right: Stats HUD */}
                <div className="flex items-center gap-2 sm:gap-4">
                    <Stat label="Day" value={`${day}/${TOTAL_DAYS}`} color="text-yellow-400" />
                    <Stat label="Cash" value={`$${player.cash.toLocaleString()}`} color="text-green-400" />
                    <div className="hidden sm:block">
                         <Stat label="Inv" value={`${player.inventory.length}/${MAX_INVENTORY_SIZE}`} color="text-cyan-300" />
                    </div>
                </div>
            </div>
            
            {/* Mobile Inventory Bar */}
            <div className="sm:hidden h-1 w-full bg-gray-800">
                <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500" 
                    style={{ width: `${(player.inventory.length / MAX_INVENTORY_SIZE) * 100}%` }}
                />
            </div>
        </header>
    );
};

export default Header;
    