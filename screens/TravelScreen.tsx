
import React, { useState, useMemo } from 'react';
import { useGame } from '../hooks/useGame';
import { CITIES } from '../data/cities';
import { SNEAKERS } from '../data/sneakers';
import { STORES_BY_CITY } from '../data/stores';
import { Screen } from '../types';
import NavButton from '../components/NavButton';
import { generateRumorsForCity, RumorWithContext } from '../systems/rumorEngine';

const TravelScreen: React.FC = () => {
    const { gameState, travel, changeScreen } = useGame();
    const { currentCityId, day } = gameState;
    const [isTravelingTo, setIsTravelingTo] = useState<string | null>(null);

    const marketTrends = useMemo(() => {
        const trends: Record<string, { trend: 'up' | 'down' | 'neutral' }> = {};
        for (const city of CITIES) {
            const market = gameState.markets[city.id];
            if (!market || market.sneakers.length === 0) {
                trends[city.id] = { trend: 'neutral' };
                continue;
            }

            let totalDiff = 0;
            let count = 0;
            for (const marketSneaker of market.sneakers) {
                const sneakerData = SNEAKERS.find(s => s.id === marketSneaker.sneakerId);
                if (sneakerData && sneakerData.basePrice > 0) {
                    totalDiff += (marketSneaker.price - sneakerData.basePrice) / sneakerData.basePrice;
                    count++;
                }
            }

            if (count === 0) {
                trends[city.id] = { trend: 'neutral' };
                continue;
            }
            
            const avgDiff = totalDiff / count;

            if (avgDiff > 0.1) trends[city.id] = { trend: 'up' };
            else if (avgDiff < -0.1) trends[city.id] = { trend: 'down' };
            else trends[city.id] = { trend: 'neutral' };
        }
        return trends;
    }, [gameState.markets]);
    
    const cityStats = useMemo(() => {
        const stats: Record<string, { storeCount: number; avgVolatility: number }> = {};
        for (const city of CITIES) {
            const market = gameState.markets[city.id];
            let totalVolatility = 0;
            let count = 0;
            if (market) {
                for (const ms of market.sneakers) {
                    const sneakerData = SNEAKERS.find(s => s.id === ms.sneakerId);
                    if (sneakerData) {
                        totalVolatility += sneakerData.volatility;
                        count++;
                    }
                }
            }
            stats[city.id] = {
                storeCount: STORES_BY_CITY[city.id]?.length || 0,
                avgVolatility: count > 0 ? totalVolatility / count : 0,
            };
        }
        return stats;
    }, [gameState.markets]);

    const allCityRumors = useMemo(() => {
        const rumors: Record<string, RumorWithContext[]> = {};
        for (const city of CITIES) {
            rumors[city.id] = generateRumorsForCity(city.id, day);
        }
        return rumors;
    }, [day]);

    const handleTravel = (cityId: string) => {
        if (isTravelingTo) return;
        setIsTravelingTo(cityId);
        setTimeout(() => {
            travel(cityId);
        }, 1500);
    };

    const getTrendInfo = (trend: 'up' | 'down' | 'neutral') => {
        switch (trend) {
            case 'up': return { icon: '↑', color: 'text-green-400', label: 'Market Hot' };
            case 'down': return { icon: '↓', color: 'text-red-400', label: 'Market Cold' };
            default: return { icon: '—', color: 'text-yellow-400', label: 'Market Stable' };
        }
    };

    const travelingToCity = CITIES.find(c => c.id === isTravelingTo);

    const css = `
        .flip-card {
            perspective: 1000px;
        }
        .flip-card-inner {
            transition: transform 0.6s;
            transform-style: preserve-3d;
        }
        .flip-card:hover .flip-card-inner {
            transform: rotateY(180deg);
        }
        .flip-card-front, .flip-card-back {
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
        }
        .flip-card-back {
            transform: rotateY(180deg);
        }
        .neon-glow {
            filter: drop-shadow(0 0 5px var(--neon-color)) drop-shadow(0 0 10px var(--neon-color));
        }
        @keyframes travel-zip {
            0% { left: -10%; transform: skewX(-20deg); }
            100% { left: 110%; transform: skewX(-20deg); }
        }
        .travel-overlay::after {
            content: '';
            position: absolute;
            top: 50%;
            width: 10%;
            height: 4px;
            background: linear-gradient(90deg, transparent, #0ff, transparent);
            box-shadow: 0 0 10px #0ff, 0 0 20px #0ff;
            animation: travel-zip 1.5s cubic-bezier(0.5, 0, 0.5, 1) forwards;
        }
    `;

    return (
        <div>
            <style>{css}</style>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-4xl font-bold text-cyan-400 uppercase tracking-widest font-['Bungee']">Neon Ticket Terminal</h1>
                <NavButton onClick={() => changeScreen(Screen.Dashboard)}>Back to City</NavButton>
            </div>
            
            {isTravelingTo && (
                <div className="travel-overlay fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center overflow-hidden">
                    <p className="text-2xl text-gray-400">Departing...</p>
                    <h2 className="text-6xl text-cyan-300 font-['Bungee'] animate-pulse my-4">{travelingToCity?.name}</h2>
                    <p className="text-xl text-gray-400">Estimated Arrival: 1 Day</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {CITIES.map(city => {
                    const trendInfo = getTrendInfo(marketTrends[city.id].trend);
                    const stats = cityStats[city.id];
                    const isCurrent = city.id === currentCityId;

                    const cityRumors = allCityRumors[city.id] || [];
                    const displayRumor = cityRumors.find(r => r.type === 'Intel Drop' || r.type === 'News') || cityRumors[0];

                    return (
                        <div key={city.id} className="flip-card h-[320px] w-full">
                            <div className={`flip-card-inner relative h-full w-full ${isCurrent ? '' : 'group'}`}>
                                {/* FRONT OF CARD */}
                                <div className="flip-card-front absolute w-full h-full bg-gray-900/70 border-2 border-cyan-500/30 flex flex-col justify-between p-4 transition-all duration-300 group-hover:border-cyan-400 group-hover:shadow-[0_0_15px_rgba(0,255,255,0.3)]">
                                    <div className="relative">
                                        <img src={city.image} alt={city.name} className="w-full h-32 object-cover opacity-70" style={{ '--neon-color': trendInfo.color.includes('green') ? '#0f0' : trendInfo.color.includes('red') ? '#f00' : '#ff0' } as React.CSSProperties}/>
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent"></div>
                                        <h2 className="absolute bottom-2 left-2 text-3xl font-bold text-white font-['Bungee'] tracking-wide">{city.name}</h2>
                                    </div>
                                    <p className="text-gray-400 text-sm flex-grow mt-2">{city.description}</p>
                                    <div className={`mt-2 text-lg font-bold flex items-center justify-center p-2 border-t-2 border-cyan-500/20 ${trendInfo.color}`}>
                                        <span className="text-3xl mr-2">{trendInfo.icon}</span> {trendInfo.label}
                                    </div>
                                </div>
                                
                                {/* BACK OF CARD */}
                                <div className="flip-card-back absolute w-full h-full bg-gray-800/90 border-2 border-cyan-400 flex flex-col justify-between p-4 text-center">
                                    <div>
                                        <h2 className="text-3xl font-bold text-cyan-300 font-['Bungee']">{city.name}</h2>
                                        <div className="w-full mt-2">
                                            <div className="flex justify-between items-baseline border-b border-cyan-800 py-1">
                                                <span className="text-gray-400">Stores</span>
                                                <span className="text-xl font-bold text-white">{stats.storeCount}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline border-b border-cyan-800 py-1">
                                                <span className="text-gray-400">Volatility</span>
                                                <span className="text-xl font-bold text-white">{(stats.avgVolatility * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        {displayRumor && (
                                            <div className="mt-3 pt-2 border-t border-cyan-800 text-left">
                                                <h4 className="text-sm font-bold text-yellow-400 uppercase tracking-wider">Latest Intel</h4>
                                                <p className="text-xs text-gray-300 italic mt-1">"{displayRumor.text}"</p>
                                            </div>
                                        )}
                                    </div>
                                    <NavButton onClick={() => handleTravel(city.id)} disabled={isCurrent || !!isTravelingTo} className="w-full mt-2">
                                        {isCurrent ? 'Current Location' : 'Travel (1 Day)'}
                                    </NavButton>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TravelScreen;
