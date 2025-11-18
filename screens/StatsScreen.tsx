
import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import NavButton from '../components/NavButton';

const StatCard: React.FC<{ 
    label: string; 
    value: string | number; 
    icon?: string;
    color?: string;
    subtext?: string;
    isCurrency?: boolean;
}> = ({ label, value, icon, color = "text-white", subtext, isCurrency }) => (
    <div className="relative bg-black/40 border border-gray-700 p-4 flex flex-col gap-1 overflow-hidden group hover:border-cyan-500/50 transition-all">
        <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition-transform">{icon}</div>
        <span className="text-xs text-gray-500 font-bold uppercase tracking-widest z-10">{label}</span>
        <span className={`text-2xl md:text-3xl font-['Space_Mono'] font-bold z-10 ${color}`}>
            {isCurrency ? '$' : ''}{typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {subtext && <span className="text-[10px] text-gray-600 font-mono z-10">{subtext}</span>}
    </div>
);

const StatsScreen: React.FC = () => {
    const { changeScreen, gameState } = useGame();
    const { player, day, currentCityId, markets } = gameState;

    const netWorth = player.cash + player.inventory.reduce((acc, item) => acc + item.purchasePrice, 0);
    
    // Calculate current market value of inventory
    const currentInventoryValue = player.inventory.reduce((total, item) => {
        // Find the price of this sneaker in the *current* city
        const marketPrice = markets[currentCityId]?.sneakers.find(s => s.sneakerId === item.sneakerId)?.price || 0;
        return total + marketPrice;
    }, 0);

    return (
        <div className="flex flex-col gap-6 pb-20">
            <div className="flex justify-between items-center">
                <h1 className="text-4xl font-bold text-cyan-400 uppercase tracking-widest font-['Bungee']">
                    Dossier
                </h1>
                <NavButton onClick={() => changeScreen(Screen.Dashboard)}>Back to City</NavButton>
            </div>

            {/* Financials Section */}
            <section>
                <h2 className="text-sm font-bold text-cyan-500/80 uppercase tracking-widest mb-3 border-b border-cyan-900/50 pb-1">Financials</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard 
                        label="Liquid Cash" 
                        value={player.cash} 
                        icon="💵" 
                        color="text-green-400" 
                        isCurrency 
                    />
                     <StatCard 
                        label="Total Net Worth" 
                        value={netWorth} 
                        icon="🏦" 
                        color="text-cyan-300" 
                        subtext="Cash + Inventory (Cost Basis)"
                        isCurrency 
                    />
                    <StatCard 
                        label="Inventory Value" 
                        value={currentInventoryValue} 
                        icon="👟" 
                        color={currentInventoryValue > 0 ? "text-yellow-400" : "text-gray-500"}
                        subtext={`Based on ${currentCityId} market prices`}
                        isCurrency 
                    />
                    <StatCard 
                        label="Lifetime Profit" 
                        value={player.stats.totalProfit} 
                        icon="📈" 
                        color={player.stats.totalProfit >= 0 ? "text-green-400" : "text-red-400"}
                        subtext={`${player.stats.sneakersSold} pairs sold`}
                        isCurrency 
                    />
                </div>
            </section>

            {/* The "Real" Stats (Ironic) */}
            <section>
                <h2 className="text-sm font-bold text-fuchsia-500/80 uppercase tracking-widest mb-3 border-b border-fuchsia-900/50 pb-1">Street Cred & Biologicals</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                     <StatCard 
                        label="Hummus Eaten" 
                        value={player.stats.hummusEaten} 
                        icon="🥙" 
                        color="text-amber-200"
                        subtext="Too much..."
                    />
                    <StatCard 
                        label="Times Farted" 
                        value={player.stats.timesFarted} 
                        icon="💨" 
                        color="text-green-600"
                        subtext="Silent but deadly"
                    />
                     <StatCard 
                        label="Bureka Waste" 
                        value={player.stats.moneyWastedOnBurekas} 
                        icon="🥐" 
                        color="text-red-400"
                        subtext="Money down the drain"
                        isCurrency
                    />
                    <StatCard 
                        label="Times Robbed" 
                        value={player.stats.timesRobbed} 
                        icon="🔪" 
                        color="text-red-600"
                        subtext="Welcome to the streets"
                    />
                    <StatCard 
                        label="Bibi's Respect" 
                        value={player.stats.bibiRespect} 
                        icon="🤝" 
                        color={player.stats.bibiRespect > 0 ? "text-blue-400" : "text-gray-400"}
                        subtext={player.stats.bibiRespect === 0 ? "He doesn't know you" : "It's complicated"}
                    />
                </div>
            </section>
            
             <section>
                <h2 className="text-sm font-bold text-gray-500/80 uppercase tracking-widest mb-3 border-b border-gray-800 pb-1">Meta</h2>
                <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Current Day" value={day} icon="📅" color="text-gray-300" />
                    <StatCard label="Player Rank" value="Street Urchin" icon="👑" color="text-gray-500" subtext="(Rank system offline)" />
                </div>
            </section>
        </div>
    );
};

export default StatsScreen;
