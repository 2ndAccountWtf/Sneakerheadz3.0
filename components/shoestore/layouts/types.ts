import type React from 'react';
import type { ShoeStoreProps, ShoeTabProps, SneakerItem } from '../../../types/shoestore';
import type { StoreSkin } from '../../../data/storeSkins';

/**
 * The contract between `ShoeStore.tsx` (all the logic) and a layout (all the
 * personality). A layout may not fetch, price, buy or route anything: it gets
 * finished data and finished nodes and decides what the room looks like.
 *
 * Every layout must:
 *  - sit in the page flow — no `position: fixed`, no `min-h-screen`, no `100vw`
 *  - survive a 390px viewport with zero horizontal overflow
 *  - keep `onExit`, the tabs, `statusChips`, the stock and `npcRail` reachable
 */
export interface StoreLayoutProps {
    store: ShoeStoreProps;
    skin: StoreSkin;
    /** Already priced and stocked, from `useInventory`. */
    items: SneakerItem[];
    activeTab: ShoeTabProps;
    setActiveTabId: (id: ShoeTabProps['id']) => void;
    onAnalyse: (sneakerId: string) => void;
    onExit: () => void;
    /** Render this where the stock grid goes — it already handles trade/raffle counters. */
    body: React.ReactNode;
    /** Render this somewhere sensible — who's in the store. */
    npcRail: React.ReactNode;
    statusChips: React.ReactNode;
    /**
     * True when the active tab is a counter (trade / consignment / raffle) or
     * the shelves are bare. In that case `body` is the whole story and a layout
     * must render it verbatim instead of its own stock presentation.
     */
    usePlainBody: boolean;
}
