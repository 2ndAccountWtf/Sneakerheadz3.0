
import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import { CITIES } from '../data/cities';

const DashboardTile: React.FC<{ 
    label: string; 
    sublabel?: string; 
    icon: string; 
    onClick: () => void; 
    color?: string 
}> = ({ label, sublabel, icon, onClick, color = "border-cyan-500/30 hover:border-cyan-400" }) => (
    <button 
        onClick={onClick}
        className={`
            group relative flex flex-col items-start justify-between p-6 h-40 
            bg-gray-900/40 backdrop-blur-sm border-2 ${color}
            hover:bg-gray-800/60 transition-all duration-300 ease-out
            clip-corner-br text-left overflow-hidden
        `}
    >
        <div className="absolute -right-4 -top-4 text-9xl opacity-5 group-hover:opacity-10 transition-opacity select-none">
            {icon}
        </div>
        <div className="text-4xl mb-2 filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300">{icon}</div>
        <div>
            <h3 className="text-xl font-bold text-white font-['Orbitron'] tracking-wider group-hover:text-cyan-300 transition-colors">{label}</h3>
            {sublabel && <p className="text-xs text-gray-400 font-mono mt-1">{sublabel}</p>}
        </div>
    </button>
);

const DashboardScreen: React.FC = () => {
    const { gameState, changeScreen } = useGame();
    const currentCity = CITIES.find(city => city.id === gameState.currentCityId);

    if (!currentCity) return <div>Loading City...</div>;

    return (
        <div className="flex flex-col gap-8 pb-20">
            {/* Hero Section */}
            <section className="relative rounded-lg overflow-hidden border border-gray-800 h-64 flex items-end p-6 group">
                <div className="absolute inset-0">
                    <img src={currentCity.image} alt={currentCity.name} className="w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity duration-700 grayscale group-hover:grayscale-0" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05080a] via-[#05080a]/60 to-transparent" />
                </div>
                <div className="relative z-10">
                    <p className="text-cyan-400 text-sm font-bold tracking-[0.3em] mb-2 uppercase">Welcome to</p>
                    <h1 className="text-5xl md:text-7xl font-black text-white font-['Bungee'] uppercase tracking-wide leading-none">
                        {currentCity.name}
                    </h1>
                    <p className="text-gray-300 max-w-xl mt-4 text-sm md:text-base line-clamp-2">{currentCity.description}</p>
                </div>
            </section>
            
            {/* App Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <DashboardTile 
                    label="Stores" 
                    sublabel="Buy & Sell Kicks" 
                    icon="👟" 
                    onClick={() => changeScreen(Screen.CityStores)}
                    color="border-green-500/30 hover:border-green-400"
                />
                <DashboardTile 
                    label="Inventory" 
                    sublabel="Manage Stock" 
                    icon="📦" 
                    onClick={() => changeScreen(Screen.Inventory)}
                />
                <DashboardTile 
                    label="Travel" 
                    sublabel="Change City" 
                    icon="✈️" 
                    onClick={() => changeScreen(Screen.Travel)}
                    color="border-purple-500/30 hover:border-purple-400"
                />
                <DashboardTile 
                    label="AM/PM" 
                    sublabel="Items & Gear" 
                    icon="🏪" 
                    onClick={() => changeScreen(Screen.Ampm)}
                    color="border-yellow-500/30 hover:border-yellow-400"
                />
                <DashboardTile 
                    label="Intel" 
                    sublabel="Rumors & News" 
                    icon="📡" 
                    onClick={() => changeScreen(Screen.CityFeed)}
                />
                {/* Placeholder for future features */}
                 <div className="relative flex items-center justify-center p-6 h-40 border-2 border-dashed border-gray-800 rounded-lg opacity-50">
                    <span className="text-gray-600 font-mono text-sm">More Apps Soon...</span>
                </div>
            </div>
        </div>
    );
};

export default DashboardScreen;
    