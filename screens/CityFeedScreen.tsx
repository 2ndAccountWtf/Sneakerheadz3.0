import React, { useState, useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import NavButton from '../components/NavButton';
import { useCityFeed } from '../hooks/useCityFeed';
import { ActiveRumor } from '../types/rumors';

const RumorEntry: React.FC<{ rumor: ActiveRumor, delay: number }> = ({ rumor, delay }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    const typeColor = {
        'News': 'text-cyan-400',
        'Gossip': 'text-fuchsia-400',
        'Sighting': 'text-yellow-400',
        'Intel Drop': 'text-green-400',
    }[rumor.type];

    return (
        <div className={`transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex gap-4">
                <div className="w-24 text-gray-500 font-mono text-sm flex-shrink-0">{rumor.timestamp}</div>
                <div className="flex-grow">
                    <span className={`font-bold uppercase tracking-widest text-xs ${typeColor}`}>
                        [{rumor.type}]
                    </span>
                    <p className="text-gray-200 text-lg leading-tight mt-1">{rumor.text}</p>
                </div>
            </div>
        </div>
    );
};

const CityFeedScreen: React.FC = () => {
    const { changeScreen } = useGame();
    const { feed } = useCityFeed();

    const css = `
        @keyframes scanline {
            0% { background-position: 0 0; }
            100% { background-position: 0 100%; }
        }
        .scanline-overlay::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(to bottom, rgba(18, 18, 18, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
            background-size: 100% 4px;
            animation: scanline 0.1s linear infinite;
            pointer-events: none;
            opacity: 0.4;
        }
        @keyframes text-flicker {
            0%, 100% { text-shadow: 0 0 2px #0ff, 0 0 5px #0ff, 0 0 10px #0ff; }
            50% { text-shadow: 0 0 2px #0ff, 0 0 5px #0ff; }
        }
    `;

    return (
        <div className="relative">
            <style>{css}</style>
            <div className="scanline-overlay">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-4xl font-bold text-cyan-400 uppercase tracking-widest font-['Bungee']" style={{animation: 'text-flicker 2s infinite'}}>
                        Street Intel
                    </h1>
                    <NavButton onClick={() => changeScreen(Screen.Dashboard)}>Back to City</NavButton>
                </div>
                
                <div className="bg-black/50 p-6 border-2 border-cyan-500/20 min-h-[60vh] max-h-[60vh] overflow-y-auto space-y-4">
                    {feed.length === 0 ? (
                        <div className="text-center text-gray-500 font-mono flex items-center justify-center h-full">
                           <p>&gt; NO SIGNIFICANT TRAFFIC DETECTED...<span className="animate-ping">|</span></p>
                        </div>
                    ) : (
                        feed.map((rumor, index) => (
                            <RumorEntry key={rumor.id} rumor={rumor} delay={index * 200} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CityFeedScreen;
