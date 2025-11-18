import React, { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { useSoleNet } from '../hooks/useSoleNet';
import NavButton from '../components/NavButton';
import { Screen } from '../types';
import type { SoleNetPost, SoleNetDm } from '../types/social';

// --- SUB-COMPONENT: PostCard ---
const PostCard: React.FC<{ post: SoleNetPost }> = ({ post }) => {
    const timeAgo = (timestamp: number): string => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `${Math.floor(seconds)}s`;
        const minutes = seconds / 60;
        if (minutes < 60) return `${Math.floor(minutes)}m`;
        const hours = minutes / 60;
        return `${Math.floor(hours)}h`;
    };

    const typeClasses: Record<SoleNetPost['type'], string> = {
        chatter: 'border-transparent',
        rumor: 'border-fuchsia-500/50',
        ad: 'border-yellow-500/50',
        event: 'border-red-500/50',
        chaos: 'border-gray-600/50',
    };

    return (
        <div className={`bg-black/40 p-4 border-l-4 ${typeClasses[post.type]}`}>
            <div className="flex items-start gap-3">
                <img src={post.author.avatarUrl} alt={post.author.handle} className="w-12 h-12 rounded-full border-2 border-gray-700" />
                <div className="flex-grow">
                    <div className="flex items-baseline gap-2">
                        <span className="font-bold text-white text-lg">{post.author.handle}</span>
                        <span className="text-gray-500 text-sm">· {timeAgo(post.timestamp)}</span>
                    </div>
                    <p className="text-gray-300 mt-1 text-base">{post.content}</p>
                    <div className="flex gap-6 mt-3 text-gray-500 text-sm">
                        <span>🔥 {post.likes}</span>
                        <span>💬 {Math.floor(post.reposts / 2)}</span>
                        <span>↻ {post.reposts}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- SUB-COMPONENT: UndergroundInbox ---
const UndergroundInbox: React.FC<{ dms: SoleNetDm[]; onClose: () => void }> = ({ dms, onClose }) => {
    const DmThreadPreview: React.FC<{ dm: SoleNetDm }> = ({ dm }) => {
        const typeClasses: Record<SoleNetDm['type'], string> = {
            flavor: 'bg-gray-700',
            tip: 'bg-green-600',
            scam: 'bg-red-600',
            mission: 'bg-yellow-500',
        };

        return (
            <div className="flex items-center gap-3 p-3 hover:bg-gray-800/50 cursor-pointer border-b border-gray-800">
                <div className="relative">
                    <img src={dm.sender.avatarUrl} alt={dm.sender.handle} className="w-14 h-14 rounded-full" />
                    {!dm.isRead && <div className={`absolute top-0 right-0 w-3 h-3 rounded-full ${typeClasses[dm.type]} border-2 border-black`}></div>}
                </div>
                <div className="flex-grow overflow-hidden">
                    <h4 className="font-bold text-white truncate">{dm.sender.handle}</h4>
                    <p className="text-gray-400 text-sm truncate">{dm.messages[0].text}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 animate-fade-in" onClick={onClose}>
            <div className="absolute top-0 right-0 h-full w-full max-w-md bg-black border-l-2 border-cyan-500/30 shadow-2xl animate-slide-in-right flex flex-col" onClick={(e) => e.stopPropagation()}>
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-800">
                    <h2 className="text-2xl font-['Bungee'] text-cyan-300">Inbox</h2>
                    <button onClick={onClose} className="text-3xl text-gray-500 hover:text-white">&times;</button>
                </header>
                <div className="flex-grow overflow-y-auto">
                    {dms.map(dm => <DmThreadPreview key={dm.id} dm={dm} />)}
                </div>
            </div>
        </div>
    );
};


// --- MAIN SCREEN ---
const SocialScreen: React.FC = () => {
    const { gameState, changeScreen } = useGame();
    const { posts, dms } = useSoleNet();
    const [showInbox, setShowInbox] = useState(false);

    const unreadDms = dms.filter(dm => !dm.isRead).length;

    const cityTheme: Record<string, React.CSSProperties> = {
        'tokyo': { '--accent-color': '#00FFF7', '--accent-glow': 'rgba(0, 255, 247, 0.3)' },
        'tel-aviv': { '--accent-color': '#FFD45A', '--accent-glow': 'rgba(255, 212, 90, 0.3)' },
        'new-york': { '--accent-color': '#A8FF00', '--accent-glow': 'rgba(168, 255, 0, 0.3)' },
        'los-angeles': { '--accent-color': '#FF2AA1', '--accent-glow': 'rgba(255, 42, 161, 0.3)' },
        'paris': { '--accent-color': '#8C52FF', '--accent-glow': 'rgba(140, 82, 255, 0.3)' },
        'chicago': { '--accent-color': '#FF0033', '--accent-glow': 'rgba(255, 0, 51, 0.3)' },
        'default': { '--accent-color': '#00FFF7', '--accent-glow': 'rgba(0, 255, 247, 0.3)' },
    };
    
    const theme = cityTheme[gameState.currentCityId] || cityTheme['default'];

    const css = `
        :root {
             --accent-color: ${theme['--accent-color']};
             --accent-glow: ${theme['--accent-glow']};
        }
        @keyframes crt-flicker {
            0% { opacity: 0.95; } 50% { opacity: 1; } 100% { opacity: 0.95; }
        }
        @keyframes scanline-scroll {
            0% { background-position: 0 0; } 100% { background-position: 0 100vh; }
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in-right { animation: slide-in-right 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards; }

        .solenet-container {
            position: relative;
            background: #05080a;
            border: 2px solid var(--accent-color);
            box-shadow: 0 0 20px var(--accent-glow), inset 0 0 15px rgba(0,0,0,0.5);
            padding: 1rem;
            animation: crt-flicker 0.15s infinite;
        }
        .solenet-container::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.4) 50%);
            background-size: 100% 4px;
            pointer-events: none;
            opacity: 0.3;
            animation: scanline-scroll 20s linear infinite;
        }
        .solenet-tab {
            font-family: 'Bungee', cursive;
            transition: all 0.2s;
        }
        .solenet-tab.active {
            color: var(--accent-color);
            text-shadow: 0 0 5px var(--accent-color);
        }
    `;

    return (
        <div style={theme}>
            <style>{css}</style>
             <div className="flex justify-between items-center mb-4">
                <h1 className="text-4xl font-bold uppercase tracking-widest font-['Bungee']" style={{color: 'var(--accent-color)'}}>SoleNet</h1>
                <NavButton onClick={() => changeScreen(Screen.Dashboard)}>Back to City</NavButton>
            </div>

            <div className="solenet-container">
                <header className="flex items-center border-b-2" style={{borderColor: 'var(--accent-color)'}}>
                    <button 
                        className={`solenet-tab p-4 text-xl active text-gray-500`}
                    >
                        HypeLine
                    </button>
                    <div className="relative">
                        <button 
                            className={`solenet-tab p-4 text-xl text-gray-500`}
                            onClick={() => setShowInbox(true)}
                        >
                            Messages
                        </button>
                        {unreadDms > 0 && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold animate-pulse">
                                {unreadDms}
                            </div>
                        )}
                    </div>
                </header>

                <main className="mt-4 max-h-[60vh] overflow-y-auto pr-2 space-y-2">
                    {posts.map(post => <PostCard key={post.id} post={post} />)}
                </main>
            </div>
            
            {showInbox && <UndergroundInbox dms={dms} onClose={() => setShowInbox(false)} />}
        </div>
    );
};

export default SocialScreen;
