import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShoeStoreProps, ShoeTabProps } from '../../types/shoestore';
import { useInventory } from '../../hooks/useInventory';
import { useGame } from '../../hooks/useGame';
import { StoreSneakerCard } from '../SneakerCard';
import { InStoreNpcRail } from './InStoreNpcRail';
import { useStoreNPCs } from '../../hooks/useStoreNPCs';
import { useCelebrityCameos } from '../../hooks/useCelebrityCameos';
import { Screen } from '../../types';
import { getStoreSkin } from '../../data/storeSkins';
import { MAX_INVENTORY_SIZE } from '../../constants';
import { CITIES } from '../../data/cities';
import type { AmbientNpcProfile, Scenario } from '../../types/interactions';
import type { CelebrityProfile } from '../../types/npcs';

const SECURITY_COPY = ['No legit check — fakes pass freely', 'Casual legit check', 'Full authentication on every sale'];

const OVERLAY_CLASS: Record<string, string> = {
    scanlines: 'scanlines opacity-50',
    grid: 'grid-bg opacity-50',
    rain: 'opacity-30',
    grain: 'opacity-[0.07]',
};

/**
 * One store layout, many skins.
 *
 * The five bespoke theme components this replaced each rebuilt the header,
 * tabs, grid and footer from scratch — which is why the store never lined up
 * with the rest of the game and why buying was buried. Now the layout is fixed
 * and tested, and `data/storeSkins.ts` supplies the personality.
 */
const ShoeStore: React.FC<{ store: ShoeStoreProps }> = ({ store }) => {
    const { gameState, startInteraction, changeScreen, viewMarketAnalysis, launchMiniGame } = useGame();
    const [activeTabId, setActiveTabId] = useState<ShoeTabProps['id']>(store.tabs[0]?.id ?? 'new');
    const previousInventoryCount = useRef(gameState.player.inventory.length);

    const activeTab = store.tabs.find(t => t.id === activeTabId) ?? store.tabs[0];
    const inventory = useInventory({ groupRef: activeTab.inventoryGroupRef });
    const { ambient } = useStoreNPCs(store.id, store.npcs, store.behavior);
    const skin = useMemo(() => getStoreSkin(store.brandKey), [store.brandKey]);

    const { cameoNow } = useCelebrityCameos(
        gameState.currentCityId,
        store.id,
        store.brandKey,
        store.npcs.interactionWeights?.celebrityCameo,
    );

    const cityName = CITIES.find(c => c.id === gameState.currentCityId)?.name;
    const isShady = store.brandKey === 'shady';
    const hasFakes = store.tabs.some(t => t.id === 'fakes' || t.id === 'backroom');

    // --- RISK ENGINE: buying in a shady store can bring the police ---
    useEffect(() => {
        if (isShady && gameState.player.inventory.length > previousInventoryCount.current) {
            // Heat makes a raid meaningfully more likely than the old flat 20%.
            const chance = 0.18 + gameState.player.heat / 500;
            if (Math.random() < chance) {
                startInteraction('system-events', Math.random() > 0.5 ? 'police-raid' : 'back-alley-mugging');
            }
        }
        previousInventoryCount.current = gameState.player.inventory.length;
    }, [gameState.player.inventory.length, gameState.player.heat, isShady, startInteraction]);

    // --- Celebrity cameo can open a conversation on its own ---
    useEffect(() => {
        if (cameoNow && Math.random() < 0.4) {
            const scenarios = cameoNow.eventTriggers?.filter((t): t is Scenario => 'startNode' in t);
            if (scenarios?.length) {
                startInteraction(cameoNow.id, scenarios[Math.floor(Math.random() * scenarios.length)].id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cameoNow]);

    const handleNpcClick = (npc: AmbientNpcProfile | CelebrityProfile) => {
        const scenarios: Scenario[] = 'scenarios' in npc && npc.scenarios
            ? npc.scenarios
            : ('eventTriggers' in npc && npc.eventTriggers
                ? npc.eventTriggers.filter((t): t is Scenario => 'startNode' in t)
                : []);
        if (scenarios.length) {
            startInteraction(npc.id, scenarios[Math.floor(Math.random() * scenarios.length)].id);
        }
    };

    const titleClass = skin.titleFont === 'pixel'
        ? 'font-pixel text-[10px] sm:text-sm'
        : skin.titleFont === 'mono'
            ? 'font-mono text-base sm:text-xl font-bold tracking-wide'
            : 'font-display text-base sm:text-2xl';

    return (
        <div
            className="relative min-h-[70vh]"
            style={{ ['--skin' as any]: skin.accent, ['--skin2' as any]: skin.accent2 }}
        >
            {/* Stage backdrop — sits behind the store only */}
            <div className="absolute inset-0 -z-10" style={{ background: skin.stage }}>
                {skin.overlay && <div className={`absolute inset-0 ${OVERLAY_CLASS[skin.overlay]}`} />}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--bg)]" />
            </div>

            <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6">
                {/* STORE HEADER */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="label" style={{ color: skin.accent }}>{skin.label}</span>
                            <span className="w-1 h-1 rounded-full bg-[var(--ink-faint)]" />
                            <span className="label">{cityName}</span>
                        </div>
                        <h1 className={`${titleClass} uppercase leading-tight`} style={{ color: skin.accent }}>
                            {store.name}
                        </h1>
                        <p className="text-xs text-[var(--ink-dim)] italic mt-1">{skin.tagline}</p>
                    </div>
                    <button className="btn btn-ghost btn-sm flex-shrink-0" onClick={() => changeScreen(Screen.CityStores)}>
                        ← Exit
                    </button>
                </div>

                {/* STATUS STRIP */}
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    <span className="chip chip-accent">💵 ${gameState.player.cash.toLocaleString()}</span>
                    <span className="chip">📦 {gameState.player.inventory.length}/{MAX_INVENTORY_SIZE}</span>
                    <span className={`chip ${store.behavior.securityLevel === 2 ? 'chip-bad' : store.behavior.securityLevel === 0 ? 'chip-accent' : ''}`}>
                        🔍 {SECURITY_COPY[store.behavior.securityLevel]}
                    </span>
                    {hasFakes && <span className="chip chip-warn">⚠ Replicas on shelf</span>}
                    {isShady && <span className="chip chip-bad">🚔 Raid risk {Math.round(18 + gameState.player.heat / 5)}%</span>}
                    {store.brandKey === 'arcade' && (
                        <button
                            className="chip chip-accent hover:text-white"
                            onClick={() => launchMiniGame({
                                game: 'street-ball',
                                title: 'Arcade Hoops Cabinet',
                                config: { opponent: 'The High Score' },
                                onWin: [
                                    { type: 'inventoryChange', add: [{ kind: 'currency', value: 'cash', qty: 220 }], description: 'The cabinet pays out in tokens you sell on.' },
                                    { type: 'streetCred', change: 4, description: 'Your initials are on the machine now.' },
                                ],
                                onLose: [{ type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: 60 }], description: 'You fed the machine everything you had.' }],
                            })}
                        >
                            🕹 Play the cabinet
                        </button>
                    )}
                </div>

                {/* TABS */}
                {store.tabs.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 mb-4 pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
                        {store.tabs.map(tab => {
                            const active = activeTab.id === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTabId(tab.id)}
                                    className="btn btn-sm"
                                    style={active
                                        ? { background: skin.accent, borderColor: skin.accent, color: '#04120f' }
                                        : undefined}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* GRID */}
                {inventory.items.length === 0 ? (
                    <div className="panel p-10 text-center">
                        <div className="text-3xl mb-2">🕸</div>
                        <p className="text-[var(--ink-dim)] font-mono text-sm">
                            {activeTab.id === 'trade' || activeTab.id === 'consignment'
                                ? 'This counter only takes stock in. Nothing on the shelves here.'
                                : 'Shelves are bare. Come back another day.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {inventory.items.map(item => (
                            <StoreSneakerCard
                                key={`${item.id}-${item.price}-${item.isFake}`}
                                sneaker={item}
                                price={item.price}
                                quantity={item.quantity}
                                isFake={item.isFake}
                                onAnalyse={() => viewMarketAnalysis(item.id)}
                            />
                        ))}
                    </div>
                )}

                {/* WHO'S IN HERE */}
                <InStoreNpcRail ambient={ambient} cameo={cameoNow} onNpcClick={handleNpcClick} />

                {store.copy?.tips?.length ? (
                    <p className="label mt-5 text-center">💡 {store.copy.tips[0]}</p>
                ) : null}
            </div>
        </div>
    );
};

export default ShoeStore;
