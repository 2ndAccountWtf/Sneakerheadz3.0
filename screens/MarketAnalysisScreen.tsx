import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen, PriceHistoryData, Sneaker } from '../types';
import NavButton from '../components/NavButton';
import { SNEAKERS } from '../data/sneakers';
import { useSneakerHistory } from '../hooks/useSneakerHistory';
import { calculateRSI } from '../utils/technicalAnalysis';

const ChartSVG: React.FC<{
    width: number;
    height: number;
    children: React.ReactNode;
}> = ({ width, height, children }) => (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {children}
    </svg>
);

const CandlestickChart: React.FC<{ data: PriceHistoryData[] }> = ({ data }) => {
    const width = 800;
    const height = 300;
    const padding = { top: 10, bottom: 20, left: 50, right: 10 };

    if (data.length === 0) return null;

    const maxPrice = Math.max(...data.map(d => d.high));
    const minPrice = Math.min(...data.map(d => d.low));
    const maxVolume = Math.max(...data.map(d => d.volume));

    const y = (price: number) => padding.top + (height - padding.top - padding.bottom) * (1 - (price - minPrice) / (maxPrice - minPrice));
    const x = (index: number) => padding.left + index * (width - padding.left - padding.right) / data.length;
    const candleWidth = (width - padding.left - padding.right) / data.length * 0.7;

    const yAxisTicks = Array.from({ length: 5 }, (_, i) => minPrice + i * (maxPrice - minPrice) / 4);

    return (
        <ChartSVG width={width} height={height}>
            {/* Grid lines */}
            {yAxisTicks.map(tick => (
                <line key={`grid-${tick}`} x1={padding.left} y1={y(tick)} x2={width - padding.right} y2={y(tick)} stroke="rgba(0, 255, 247, 0.1)" />
            ))}
            
            {/* Y-Axis */}
            {yAxisTicks.map(tick => (
                <text key={`label-${tick}`} x={padding.left - 10} y={y(tick)} fill="rgba(0, 255, 247, 0.5)" textAnchor="end" dominantBaseline="middle" fontSize="10" fontFamily="'Space Mono', monospace">${Math.round(tick)}</text>
            ))}

            {/* Candles and Wicks */}
            {data.map((d, i) => {
                const isUp = d.close >= d.open;
                const color = isUp ? '#b6ff00' : '#ff00b8';
                const candleX = x(i);
                
                return (
                    <g key={i}>
                        <line x1={candleX + candleWidth / 2} y1={y(d.high)} x2={candleX + candleWidth / 2} y2={y(d.low)} stroke={color} strokeWidth="1" />
                        <rect x={candleX} y={isUp ? y(d.close) : y(d.open)} width={candleWidth} height={Math.abs(y(d.open) - y(d.close))} fill={color} />
                    </g>
                );
            })}
        </ChartSVG>
    );
};

const RsiChart: React.FC<{ data: PriceHistoryData[] }> = ({ data }) => {
    const width = 800;
    const height = 100;
    const padding = { top: 10, bottom: 20, left: 50, right: 10 };

    const rsiData = calculateRSI(data, 14);
    if (rsiData.length === 0) return null;

    const x = (index: number) => padding.left + index * (width - padding.left - padding.right) / rsiData.length;
    const y = (rsi: number) => padding.top + (height - padding.top - padding.bottom) * (1 - rsi / 100);

    const path = rsiData.map((d, i) => (isNaN(d) ? '' : `${i === 0 ? 'M' : 'L'}${x(i)},${y(d)}`)).join(' ');

    return (
        <ChartSVG width={width} height={height}>
            {/* Overbought/Oversold zones */}
            <rect x={padding.left} y={y(70)} width={width - padding.left - padding.right} height={y(30) - y(70)} fill="rgba(255, 0, 184, 0.1)" />
            
            {/* Y-Axis */}
            {[30, 70].map(tick => (
                <g key={`rsi-label-${tick}`}>
                    <line x1={padding.left} y1={y(tick)} x2={width - padding.right} y2={y(tick)} stroke="rgba(0, 255, 247, 0.2)" strokeDasharray="2" />
                    <text x={padding.left - 10} y={y(tick)} fill="rgba(0, 255, 247, 0.5)" textAnchor="end" dominantBaseline="middle" fontSize="10" fontFamily="'Space Mono', monospace">{tick}</text>
                </g>
            ))}

            {/* RSI Line */}
            <path d={path} fill="none" stroke="#60a5fa" strokeWidth="2" />
        </ChartSVG>
    );
};


const MarketAnalysisScreen: React.FC = () => {
    const { gameState, changeScreen } = useGame();
    const { currentAnalysisSneakerId, markets, currentCityId } = gameState;

    const sneaker = SNEAKERS.find(s => s.id === currentAnalysisSneakerId);
    const history = useSneakerHistory(currentAnalysisSneakerId);
    
    const marketInfo = markets[currentCityId]?.sneakers.find(s => s.sneakerId === currentAnalysisSneakerId);
    const currentPrice = marketInfo?.price || 0;
    const priceChange = history.length > 1 ? currentPrice - history[history.length-2].close : 0;
    const isUp = priceChange >= 0;

    if (!sneaker) {
        return (
            <div>
                <p>Error: Sneaker not found.</p>
                <NavButton onClick={() => changeScreen(Screen.ShoeStore)}>Back to Store</NavButton>
            </div>
        );
    }
    
    const DataPanelItem: React.FC<{label: string; children: React.ReactNode; className?: string}> = ({ label, children, className }) => (
        <div className={`flex justify-between items-baseline py-2 border-b border-cyan-800/50 ${className}`}>
            <span className="text-gray-400">{label}</span>
            <span>{children}</span>
        </div>
    );

    return (
        <div className="p-1 sm:p-4 bg-[#0a0f14] font-['Space_Mono']">
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-4">
                {/* Header */}
                <header className="lg:col-span-2 flex flex-col sm:flex-row justify-between sm:items-center pb-4 border-b-2 border-cyan-800/50 gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold font-['Orbitron'] text-white">{sneaker.name}</h1>
                        <p className="text-cyan-400 text-sm sm:text-base">{sneaker.rarity} - {sneaker.id}</p>
                    </div>
                    <NavButton onClick={() => changeScreen(Screen.ShoeStore)}>Back to Store</NavButton>
                </header>

                {/* Main Chart */}
                <div className="lg:col-start-1 bg-black/50 p-2 border border-cyan-800/50">
                    <CandlestickChart data={history} />
                </div>
                
                {/* RSI Indicator */}
                <div className="lg:col-start-1 bg-black/50 p-2 border border-cyan-800/50">
                    <h3 className="text-cyan-400 text-sm pl-12 pb-1">RSI (14)</h3>
                    <RsiChart data={history} />
                </div>

                {/* Data Panel */}
                <aside className="lg:col-start-2 lg:row-start-2 lg:row-span-2 bg-black/50 p-4 border border-cyan-800/50 flex flex-col">
                    <DataPanelItem label="Price" className="text-lg">
                        <span className={`text-2xl font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>${currentPrice.toLocaleString()}</span>
                    </DataPanelItem>
                     <DataPanelItem label="Change">
                        <span className={`${isUp ? 'text-green-400' : 'text-red-400'}`}>{isUp ? '+' : ''}${priceChange.toLocaleString()}</span>
                    </DataPanelItem>
                     <DataPanelItem label="Volume">
                        {history[history.length - 1]?.volume.toLocaleString()}
                    </DataPanelItem>

                    <h3 className="text-cyan-400 mt-6 mb-2 text-lg border-b border-cyan-800/50 pb-1">Core Stats</h3>
                    <DataPanelItem label="Rarity">{sneaker.rarity}</DataPanelItem>
                    <DataPanelItem label="Volatility">{(sneaker.volatility * 100).toFixed(0)}%</DataPanelItem>
                    <DataPanelItem label="Base Price">${sneaker.basePrice.toLocaleString()}</DataPanelItem>
                    
                    <h3 className="text-cyan-400 mt-6 mb-2 text-lg border-b border-cyan-800/50 pb-1">Supply</h3>
                    <DataPanelItem label="Pairs in Prod.">{(sneaker.basePrice * 100).toLocaleString()}</DataPanelItem>
                    <DataPanelItem label="Pairs on Market">{marketInfo?.quantity.toLocaleString() || 'N/A'}</DataPanelItem>
                </aside>
            </div>
        </div>
    );
};

export default MarketAnalysisScreen;