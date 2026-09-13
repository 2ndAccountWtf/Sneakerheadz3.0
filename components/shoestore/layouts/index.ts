import type React from 'react';
import type { StoreLayoutId } from '../../../data/storeSkins';
import type { StoreLayoutProps } from './types';

import ArcadeCabinetLayout from './ArcadeCabinetLayout';
import VaporwaveLayout from './VaporwaveLayout';
import RainNoirLayout from './RainNoirLayout';
import GalleryLayout from './GalleryLayout';
import BlackMarketLayout from './BlackMarketLayout';
import CrateDiggerLayout from './CrateDiggerLayout';
import TapeDeckLayout from './TapeDeckLayout';
import VendingMachineLayout from './VendingMachineLayout';
import BodegaBackroomLayout from './BodegaBackroomLayout';
import RooftopSoukLayout from './RooftopSoukLayout';
import BoilerRoomLayout from './BoilerRoomLayout';
import AtelierLayout from './AtelierLayout';

/**
 * The rooms. `ShoeStore.tsx` owns every hook and every rule; a skin names one of
 * these and that decides what the shop actually looks like.
 */
export const STORE_LAYOUTS: Record<StoreLayoutId, React.FC<StoreLayoutProps>> = {
    arcade: ArcadeCabinetLayout,
    vaporwave: VaporwaveLayout,
    'rain-noir': RainNoirLayout,
    gallery: GalleryLayout,
    blackmarket: BlackMarketLayout,
    crate: CrateDiggerLayout,
    tapedeck: TapeDeckLayout,
    vending: VendingMachineLayout,
    bodega: BodegaBackroomLayout,
    rooftop: RooftopSoukLayout,
    boiler: BoilerRoomLayout,
    atelier: AtelierLayout,
};

export type { StoreLayoutProps } from './types';
