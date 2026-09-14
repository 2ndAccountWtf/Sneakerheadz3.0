import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShoeStoreProps, ShoeTabProps } from '../../types/shoestore';
import { useInventory } from '../../hooks/useInventory';
import { useGame } from '../../hooks/useGame';
import { StoreSneakerCard } from '../SneakerCard';
import { InStoreNpcRail } from './InStoreNpcRail';
import { TradeInCounter, RaffleCounter } from './StoreCounters';
import { useStoreNPCs } from '../../hooks/useStoreNPCs';
import { useCelebrityCameos } from '../../hooks/useCelebrityCameos';
import { Screen } from '../../types';
import { getStoreSkin } from '../../data/storeSkins';
import { STORE_LAYOUTS } from './layouts';
import GalleryLayout from './layouts/GalleryLayout';
import { MAX_INVENTORY_SIZE } from '../../constants';
import { CITIES } from '../../data/cities';
import type { AmbientNpcProfile, Scenario } from '../../types/interactions';
import type { CelebrityProfile } from '../../types/npcs';

const SECURITY_COPY = ['No legit check — fakes pass freely', 'Casual legit check', 'Full authentication on every sale'];

/**
 * The store, split in two.
 *
 * This file is the machinery: inventory, NPCs, cameos, the shady-store raid
 * roll, which counter a tab routes to, and the chips that describe your standing
 * in the room. It renders none of that itself. It hands the finished data and
 * finished nodes to one of the layouts in `./layouts`, chosen by the store's
 * skin, and the layout decides what kind of room you are standing in — a
 * cabinet, a gallery, a vending wall, a taped-together stall.
 *
 * Why the split: the old bespoke-per-store components each rebuilt the header,
 * tabs and grid and each got the fitting wrong (viewport-pinned rails over the
 * HUD, `min-h-screen` inside a padded column). Collapsing them to one layout
 * fixed the fit and lost the personality. Now the fit lives here and in
 * `layouts/kit.tsx` — one stage that clips its own decoration, one content
 * column — and the personality lives in twelve layouts that cannot break it.
 */
const ShoeStore: React.FC<{ store: ShoeStoreProps }> = ({ store }) => {
    const { gameState, dispatch, startInteraction, changeScreen, viewMarketAnalysis, launchMiniGame } = useGame();
    const [activeTabId, setActiveTabId] = useState<ShoeTabProps['id']>(store.tabs[0]?.id ?? 'new');
    const previousInventoryCount = useRef(gameState.player.inventory.length);

    const activeTab = store.tabs.find(t => t.id === activeTabId) ?? store.tabs[0];
    const inventory = useInventory({ groupRef: activeTab.inventoryGroupRef });
    const { ambient } = useStoreNPCs(store.id, store.npcs, store.behavior);
    // Store id first so two shops on the same brand key can be different rooms.
    const skin = useMemo(() => getStoreSkin(store.brandKey, store.id), [store.brandKey, store.id]);

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
                // The raid is a negotiation now (`systems/police/bust.ts`), not
                // the three-fixed-prices scenario it used to fire. The mugging
                // is still a scenario — it has no bribe to haggle over.
                if (Math.random() > 0.5) dispatch({ type: 'START_BUST' });
                else startInteraction('system-events', 'back-alley-mugging');
            }
        }
        previousInventoryCount.current = gameState.player.inventory.length;
    }, [gameState.player.inventory.length, gameState.player.heat, isShady, startInteraction, dispatch]);

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

    // --- STATUS: your standing in this room, as chips a layout can drop anywhere ---
    const statusChips = (
        <>
            <span className="chip">📍 {cityName}</span>
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
        </>
    );

    // --- BODY: the counters, the empty shelf, or the plain grid a layout may ---
    // choose to ignore in favour of its own presentation of `items`.
    const isCounterTab = activeTab.id === 'trade' || activeTab.id === 'consignment' || activeTab.id === 'raffle';
    const body = activeTab.id === 'trade' || activeTab.id === 'consignment'
        ? <TradeInCounter store={store} />
        : activeTab.id === 'raffle'
            ? <RaffleCounter store={store} groupRef={activeTab.inventoryGroupRef} />
            : inventory.items.length === 0
                ? (
                    <div className="panel p-10 text-center">
                        <div className="text-3xl mb-2">🕸</div>
                        <p className="text-[var(--ink-dim)] font-mono text-sm">Shelves are bare. Come back another day.</p>
                    </div>
                )
                : (
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
                );

    const Layout = STORE_LAYOUTS[skin.layout] ?? GalleryLayout;

    return (
        <Layout
            store={store}
            skin={skin}
            items={inventory.items}
            activeTab={activeTab}
            setActiveTabId={setActiveTabId}
            onAnalyse={viewMarketAnalysis}
            onExit={() => changeScreen(Screen.CityStores)}
            body={body}
            npcRail={<InStoreNpcRail ambient={ambient} cameo={cameoNow} onNpcClick={handleNpcClick} />}
            statusChips={statusChips}
            usePlainBody={isCounterTab || inventory.items.length === 0}
        />
    );
};

export default ShoeStore;
