
import React, { useState, useEffect, useRef } from 'react';
import { ShoeStoreProps, ShoeTabProps, SneakerItem } from '../../types/shoestore';
import { useInventory } from '../../hooks/useInventory';
import { useGame } from '../../hooks/useGame';
import { SneakerGrid } from './SneakerGrid';
import { InStoreNpcRail } from './InStoreNpcRail';
import { useStoreNPCs } from '../../hooks/useStoreNPCs';
import { useCelebrityCameos } from '../../hooks/useCelebrityCameos';
import NavButton from '../NavButton';
import { CITIES } from '../../data/cities';
import { MAX_INVENTORY_SIZE } from '../../constants';
import StoreShell from './StoreShell';
import { AmbientNpcProfile, Scenario } from '../../types/interactions';
import { CelebrityProfile } from '../../types/npcs';

// Reusable Action Console component
const ActionConsole: React.FC<{
    selectedSneaker: SneakerItem | null;
}> = ({ selectedSneaker }) => {
    const { gameState, viewMarketAnalysis } = useGame();

    return (
        <div className="action-console flex-shrink-0 h-20 bg-black/50 backdrop-blur-sm border-t-2 border-cyan-500/30 p-2 flex justify-between items-center">
            <div className="player-stats flex gap-4 text-lg">
                <div className="stat-chip">
                    <span className="label text-cyan-400">CASH</span>
                    <span className="value text-green-400 font-bold">${gameState.player.cash.toLocaleString()}</span>
                </div>
                <div className="stat-chip">
                    <span className="label text-cyan-400">DAY</span>
                    <span className="value text-yellow-400 font-bold">{gameState.day}</span>
                </div>
            </div>
            <div className="market-controls flex gap-2">
                <button
                    className="console-button"
                    disabled={!selectedSneaker}
                    onClick={() => {
                        if (selectedSneaker) {
                           viewMarketAnalysis(selectedSneaker.id);
                        }
                    }}
                >
                    Analysis
                </button>
            </div>
        </div>
    );
};

interface ThemedLayoutProps {
    store: ShoeStoreProps;
    inventory: ReturnType<typeof useInventory>;
    activeTab: ShoeTabProps;
    setActiveTabId: (id: ShoeTabProps['id']) => void;
    selectedSneaker: SneakerItem | null;
    setSelectedSneaker: (item: SneakerItem | null) => void;
}

// --- THEME 1: AKIHABARA ARCADE KICKS ---
const AkihabaraTheme: React.FC<ThemedLayoutProps> = ({ store, inventory, activeTab, setActiveTabId, selectedSneaker, setSelectedSneaker }) => {
    return (
        <div className="theme-akihabara relative w-full h-full overflow-hidden bg-black flex flex-col">
            <div className="binary-rain"></div>
            <header className="p-4 flex-shrink-0 z-10 flex justify-between items-center">
                <h1 className="text-5xl font-['Press_Start_2P'] text-cyan-300 glitch" data-text={store.name}>{store.name}</h1>
                 <div className="flex gap-2">
                    {store.tabs.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`px-4 py-2 border-2 font-['Press_Start_2P'] text-xs ${activeTab.id === tab.id ? 'bg-cyan-500 text-black border-cyan-500' : 'bg-black text-cyan-500 border-cyan-500'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="scanlines"></div>
            </header>
            <div className="flex-grow relative p-4 flex flex-col">
                <SneakerGrid items={inventory.items} onSneakerInView={setSelectedSneaker} />
            </div>
            <ActionConsole selectedSneaker={selectedSneaker} />
        </div>
    );
};

// --- THEME 2: HARAJUKU OVERDRIVE OUTLET ---
const HarajukuTheme: React.FC<ThemedLayoutProps> = ({ store, inventory, activeTab, setActiveTabId, selectedSneaker, setSelectedSneaker }) => {
    return (
        <div className="theme-harajuku relative w-full h-full overflow-hidden bg-black flex flex-col">
            <div className="holo-posters">
                <div></div><div></div><div></div>
            </div>
            <header className="p-4 flex-shrink-0 z-10 flex flex-col items-center gap-4">
                <h1 className="text-6xl font-['Bungee'] text-pink-400 vaporwave-text">{store.name}</h1>
                 <div className="flex gap-4">
                    {store.tabs.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`px-6 py-1 rounded-full font-bold uppercase tracking-widest transition-all ${activeTab.id === tab.id ? 'bg-pink-500 text-white shadow-[0_0_10px_#ec4899]' : 'bg-gray-800 text-pink-300 hover:bg-gray-700'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>
            <div className="flex-grow relative p-4 flex flex-col">
                 <SneakerGrid items={inventory.items} onSneakerInView={setSelectedSneaker} />
            </div>
            <ActionConsole selectedSneaker={selectedSneaker} />
        </div>
    );
};

// --- THEME 3: SHINJUKU SHADOW RUNNER ---
const ShinjukuTheme: React.FC<ThemedLayoutProps> = ({ store, inventory, activeTab, setActiveTabId, selectedSneaker, setSelectedSneaker }) => {
     const [lightning, setLightning] = useState(false);
     useEffect(() => {
        const interval = setInterval(() => {
            if (Math.random() < 0.1) {
                setLightning(true);
                setTimeout(() => setLightning(false), 200);
            }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={`theme-shinjuku relative w-full h-full overflow-hidden bg-black flex flex-col ${lightning ? 'lightning-flash' : ''}`}>
            <div className="rain"></div>
            <div className="fog"></div>
            <header className="p-4 flex-shrink-0 z-10 flex justify-between items-end border-b-2 border-violet-400/50 pb-2">
                 <h1 className="text-4xl font-['Orbitron'] text-violet-400">{store.name}</h1>
                 <div className="flex gap-4">
                    {store.tabs.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`text-sm uppercase tracking-widest pb-1 border-b-2 transition-colors ${activeTab.id === tab.id ? 'text-white border-white' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>
            <div className="flex-grow relative p-4 flex flex-col">
                <SneakerGrid items={inventory.items} onSneakerInView={setSelectedSneaker} />
            </div>
            <ActionConsole selectedSneaker={selectedSneaker} />
        </div>
    );
};

// --- THEME 4: SHADY / BLACK MARKET ---
const ShadyTheme: React.FC<ThemedLayoutProps> = ({ store, inventory, activeTab, setActiveTabId, selectedSneaker, setSelectedSneaker }) => {
    return (
        <div className="theme-shady relative w-full h-full overflow-hidden bg-[#1a0505] flex flex-col">
             {/* Gritty Overlay */}
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_90%)]"></div>
             
             <header className="p-4 flex-shrink-0 z-10 flex justify-between items-center border-b-4 border-red-900/50 bg-black/50">
                 <div>
                     <span className="text-xs text-red-500 font-bold tracking-widest animate-pulse">⚠ ILLEGAL OPERATION</span>
                     <h1 className="text-5xl font-['Bungee'] text-red-600 tracking-tighter" style={{textShadow: '2px 2px 0px #000'}}>{store.name}</h1>
                 </div>
                 <div className="flex gap-2">
                    {store.tabs.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`px-4 py-1 font-bold uppercase skew-x-[-10deg] border-2 ${activeTab.id === tab.id ? 'bg-red-600 text-black border-red-600' : 'bg-transparent text-red-800 border-red-900 hover:text-red-500'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>
            <div className="flex-grow relative p-4 flex flex-col">
                 <SneakerGrid items={inventory.items} onSneakerInView={setSelectedSneaker} />
            </div>
            <div className="absolute bottom-20 right-4 z-10">
                <div className="bg-red-900/80 text-white p-2 text-xs font-mono border border-red-500">
                    RISK LEVEL: CRITICAL<br/>
                    COPS NEARBY: UNKNOWN
                </div>
            </div>
            <ActionConsole selectedSneaker={selectedSneaker} />
        </div>
    );
};


// --- DEFAULT/SYNDICATE THEME (as a fallback) ---
const SyndicateTheme: React.FC<ThemedLayoutProps> = ({ store, inventory, activeTab, setActiveTabId, selectedSneaker, setSelectedSneaker }) => {
    const { gameState } = useGame();
    const city = CITIES.find(c => c.id === gameState.currentCityId);
    
    const MarketTicker: React.FC = () => {
        const mockData = "SNEAKER INDEX ↑12% | HYPE SURGE IN L.A. | JORDAN 1 BAN LIFTED";
        return (
            <div className="w-full bg-black/50 text-cyan-400 text-sm uppercase overflow-hidden whitespace-nowrap py-1 border-y border-cyan-800/50">
                <div className="animate-ticker">{mockData} &nbsp;&nbsp;&nbsp; // &nbsp;&nbsp;&nbsp; {mockData}</div>
            </div>
        );
    };

    return (
        <div className="theme-syndicate relative w-full h-full overflow-hidden bg-[#0a0f14] flex flex-col p-4">
             <div className="grid-overlay"></div>
             <div className="data-rain"></div>
             <header className="mb-4 z-10 flex-shrink-0">
                <div className="flex justify-between items-center mb-2">
                    <h1 className="text-4xl tracking-widest text-shadow-glow font-['Orbitron']" style={{'--glow-color': 'var(--theme-accent, #00fff7)'} as React.CSSProperties}>{store.name}</h1>
                    <div className="flex items-center gap-2">
                        <span className="header-chip">🔹 {city?.name}</span>
                        <span className="header-chip">📦 {gameState.player.inventory.length}/{MAX_INVENTORY_SIZE}</span>
                    </div>
                </div>
                {/* Tabs */}
                <div className="flex gap-1 mb-2">
                    {store.tabs.map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`
                                px-4 py-2 text-sm font-bold uppercase tracking-wider clip-corner-br transition-all
                                ${activeTab.id === tab.id 
                                    ? 'bg-cyan-500 text-black' 
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}
                            `}
                            style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)" }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <MarketTicker />
            </header>
            <div className="flex-grow relative flex flex-col">
                 <SneakerGrid items={inventory.items} onSneakerInView={setSelectedSneaker} />
            </div>
            <ActionConsole selectedSneaker={selectedSneaker} />
        </div>
    );
};


const ShoeStore: React.FC<{ store: ShoeStoreProps }> = ({ store }) => {
    const { gameState, startInteraction } = useGame();
    const [activeTabId, setActiveTabId] = useState<ShoeTabProps['id']>(store.tabs[0]?.id || 'new');
    const [selectedSneaker, setSelectedSneaker] = useState<SneakerItem | null>(null);
    const previousInventoryCount = useRef(gameState.player.inventory.length);

    const activeTab = store.tabs.find(t => t.id === activeTabId) || store.tabs[0];
    
    const inventory = useInventory({ groupRef: activeTab.inventoryGroupRef });
    const { ambient } = useStoreNPCs(store.id, store.npcs, store.behavior);
    
    // Pass the store brand key to the celebrity hook
    const { cameoNow } = useCelebrityCameos(
        gameState.currentCityId, 
        store.id, 
        store.brandKey,
        store.npcs.interactionWeights?.celebrityCameo
    );

    // When inventory loads or changes, default to the first item.
    useEffect(() => {
        if (inventory.items.length > 0 && !selectedSneaker) {
            setSelectedSneaker(inventory.items[0]);
        } else if (inventory.items.length === 0) {
            setSelectedSneaker(null);
        }
    }, [inventory.items, selectedSneaker]);

    // --- RISK ENGINE ---
    // Check if player bought something in a Shady store and trigger event
    useEffect(() => {
        if (store.brandKey === 'shady') {
            if (gameState.player.inventory.length > previousInventoryCount.current) {
                // Player just bought something
                const roll = Math.random();
                // 20% chance of bad event on purchase in shady store
                if (roll < 0.2) {
                    const badEvent = Math.random() > 0.5 ? 'police-raid' : 'back-alley-mugging';
                    startInteraction('system-events', badEvent);
                }
            }
        }
        previousInventoryCount.current = gameState.player.inventory.length;
    }, [gameState.player.inventory.length, store.brandKey, startInteraction]);


    // Proactive event trigger for celebrity cameos
    useEffect(() => {
        if (cameoNow && Math.random() < 0.4) { // 40% chance for a celebrity to start an interaction
            const interactiveScenarios = cameoNow.eventTriggers?.filter(
                (trigger): trigger is Scenario => 'startNode' in trigger
            );
            if (interactiveScenarios && interactiveScenarios.length > 0) {
                const randomScenario = interactiveScenarios[Math.floor(Math.random() * interactiveScenarios.length)];
                startInteraction(cameoNow.id, randomScenario.id);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cameoNow]); // Only run when a new celebrity appears

    const handleNpcClick = (npc: AmbientNpcProfile | CelebrityProfile) => {
        let scenarios: Scenario[] = [];
    
        if ('scenarios' in npc && npc.scenarios) { // AmbientNpcProfile
            scenarios = npc.scenarios;
        } else if ('eventTriggers' in npc && npc.eventTriggers) { // CelebrityProfile
            scenarios = npc.eventTriggers.filter(t => 'startNode' in t) as Scenario[];
        }
    
        if (scenarios.length > 0) {
            const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
            startInteraction(npc.id, randomScenario.id);
        }
    };

    const sharedProps: ThemedLayoutProps = {
        store,
        inventory,
        activeTab,
        setActiveTabId,
        selectedSneaker,
        setSelectedSneaker
    };

    const renderTheme = () => {
        switch(store.brandKey) {
            case 'arcade': return <AkihabaraTheme {...sharedProps} />;
            case 'neon': return <HarajukuTheme {...sharedProps} />;
            case 'cyberpunk': return <ShinjukuTheme {...sharedProps} />;
            case 'shady': return <ShadyTheme {...sharedProps} />;
            default: return <SyndicateTheme {...sharedProps} />;
        }
    };
    
    // Massive CSS block for all themes
    const themeCSS = `
        /* Universal Card Animations */
        @keyframes spawn-scanline { 0% { clip-path: inset(0 100% 0 0); } 100% { clip-path: inset(0 0 0 0); } }
        .spawn-animation { animation: spawn-scanline 0.4s cubic-bezier(0.25, 1, 0.5, 1) both; }
        .card-3d { transform-style: preserve-d; }
        .group:hover .card-3d { transform: translateZ(50px) rotateY(var(--rotateY, 0)) rotateX(var(--rotateX, 0)); }
        .card-image-3d { transform: translateZ(60px); }

        /* --- SYNDICATE THEME --- */
        .theme-syndicate { --theme-accent: #00fff7; }
        .grid-overlay { position: absolute; inset: 0; background-image: linear-gradient(rgba(0,255,247,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,247,0.1) 1px, transparent 1px); background-size: 50px 50px; animation: grid-pan 30s linear infinite; }
        @keyframes grid-pan { from { background-position: 0 0; } to { background-position: 50px 50px; } }
        .data-rain { position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ctext x='0' y='10' font-family='monospace' font-size='10' fill='rgba(0,255,247,0.1)'%3E01010101%3C/text%3E%3C/svg%3E"); animation: data-rain-fall 20s linear infinite; }
        @keyframes data-rain-fall { from { background-position: 0 0; } to { background-position: 0 1000px; } }
        .header-chip { background: rgba(0,255,247,0.1); border: 1px solid rgba(0,255,247,0.3); padding: 4px 8px; font-family: 'Space Mono', monospace; }

        /* --- AKIHABARA THEME --- */
        .theme-akihabara { background: #000 url('https://www.transparenttextures.com/patterns/diagmonds.png'); }
        .binary-rain { position: absolute; inset: 0; background: linear-gradient(rgba(0,255,247, 0.5) 50%, transparent 50%); background-size: 100% 4px; animation: binary-rain-fall 0.2s linear infinite; opacity: 0.3; }
        @keyframes binary-rain-fall { from { transform: translateY(-4px); } to { transform: translateY(0); } }
        .glitch { animation: glitch-anim 3s infinite; }
        @keyframes glitch-anim { /* glitch keyframes */ }
        .scanlines { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.5) 50%); background-size: 100% 4px; pointer-events: none; }

        /* --- HARAJUKU THEME --- */
        .theme-harajuku { background: radial-gradient(ellipse at bottom, #4a004a, #000); }
        .vaporwave-text { text-shadow: 0 0 5px #ff2aa1, 0 0 10px #ff2aa1, 0 0 20px #ff2aa1; }
        .holo-posters { position: absolute; inset: 0; overflow: hidden; }
        .holo-posters > div { position: absolute; width: 200px; height: 300px; background: linear-gradient(45deg, #ff2aa1, #00ffd1); opacity: 0.1; animation: float 15s infinite alternate; }
        .holo-posters > div:nth-child(1) { top: 10%; left: 15%; animation-duration: 12s; }
        .holo-posters > div:nth-child(2) { top: 50%; right: 10%; animation-duration: 18s; }
        .holo-posters > div:nth-child(3) { bottom: 5%; left: 30%; animation-duration: 10s; }
        @keyframes float { from { transform: translateY(0) rotate(0deg); } to { transform: translateY(-50px) rotate(10deg); } }

        /* --- SHINJUKU THEME --- */
        .theme-shinjuku { background: #0a0f14; }
        .rain { position: absolute; inset: 0; background-image: linear-gradient(0deg, transparent, rgba(140, 82, 255, 0.2) 50%, transparent); background-size: 2px 200px; animation: rain-fall 0.5s linear infinite; }
        @keyframes rain-fall { from { background-position: 0% 0%; } to { background-position: 20% 100%; } }
        .fog { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 100%, rgba(140, 82, 255, 0.1), transparent 70%); animation: fog-drift 20s infinite alternate; }
        @keyframes fog-drift { from { opacity: 0.5; transform: translateX(-20%); } to { opacity: 0.8; transform: translateX(20%); } }
        .lightning-flash { animation: lightning-anim 0.2s forwards; }
        @keyframes lightning-anim { 0% { background: #0a0f14; } 50% { background: #8C52FF; } 100% { background: #0a0f14; } }

        /* --- ACTION CONSOLE --- */
        .action-console { font-family: 'Orbitron', sans-serif; }
        .stat-chip { background: #1a1b1e; padding: 8px 12px; border: 1px solid #333; }
        .console-button { background: #222; border: 1px solid #555; color: #eee; padding: 10px 14px; text-transform: uppercase; transition: all 0.2s; font-size: 14px; }
        .console-button:hover:not(:disabled) { background: #00fff7; color: #000; border-color: #00fff7; box-shadow: 0 0 10px #00fff7; cursor: pointer; }
        .console-button:disabled { background: #222; color: #555; border-color: #444; cursor: not-allowed; }
    `;

    // 3D Card Hover Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const card = (e.currentTarget as HTMLElement).querySelector('.card-3d');
            if (!card) return;
            const { left, top, width, height } = card.getBoundingClientRect();
            const x = e.clientX - left;
            const y = e.clientY - top;
            const rotateX = -10 * ((y - height / 2) / height);
            const rotateY = 10 * ((x - width / 2) / width);
            (card as HTMLElement).style.setProperty('--rotateX', `${rotateX}deg`);
            (card as HTMLElement).style.setProperty('--rotateY', `${rotateY}deg`);
        };
        const handleMouseLeave = (e: MouseEvent) => {
            const card = (e.currentTarget as HTMLElement).querySelector('.card-3d');
             if (card) {
                (card as HTMLElement).style.setProperty('--rotateX', '0deg');
                (card as HTMLElement).style.setProperty('--rotateY', '0deg');
             }
        };

        const cards = document.querySelectorAll('.group');
        cards.forEach(card => {
            card.addEventListener('mousemove', handleMouseMove as EventListener);
            card.addEventListener('mouseleave', handleMouseLeave as EventListener);
        });

        return () => {
             cards.forEach(card => {
                card.removeEventListener('mousemove', handleMouseMove as EventListener);
                card.removeEventListener('mouseleave', handleMouseLeave as EventListener);
            });
        };
    }, [inventory.items]); // Rerun when items change

    return (
        <StoreShell>
            <style>{themeCSS}</style>
            <div className="w-full h-full min-h-screen">
                {renderTheme()}
            </div>
             <InStoreNpcRail 
                ambient={ambient} 
                cameo={cameoNow} 
                onNpcClick={handleNpcClick}
             />
        </StoreShell>
    );
};

export default ShoeStore;
