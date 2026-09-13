
import { ShoeStoreProps } from '../types/shoestore';
import { StoreTheme } from '../types/theme';

type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]>; } : T;

export interface StoreConfig extends Omit<ShoeStoreProps, 'theme'> {
  themeOverrides: DeepPartial<StoreTheme>;
}

export const STORE_CONFIGS: Record<string, StoreConfig> = {
    'outlet-harajuku-overdrive': {
        id: 'outlet-harajuku-overdrive',
        name: 'Harajuku Overdrive Outlet',
        brandKey: 'neon',
        themeOverrides: {},
        scene: {
            backgroundRef: 'harajuku-night',
            camera: 'isometric',
            lighting: 'neon',
        },
        layout: {
            headerVariant: 'bar',
            tabsVariant: 'pills',
            gridColumns: 3,
            density: 'cozy',
            showStaffDock: true,
        },
        tabs: [
            { id: 'new', label: 'New Arrivals', inventoryGroupRef: 'tokyo.outlet.new' },
            { id: 'used', label: 'Pre-Owned', inventoryGroupRef: 'tokyo.outlet.used' },
            { id: 'trade', label: 'Trade-In', inventoryGroupRef: 'trade' },
        ],
        pricing: {
            taxPct: 10,
            buybackDiscountPct: 40,
            roundingMode: 'round',
            dynamicSignals: ['surge', 'shortage'],
        },
        policies: {
            returns: '7d-store-credit',
            legitCheck: { enabled: true, fee: 10 },
        },
        behavior: {
            queueLength: [0, 5],
            securityLevel: 1,
            toutStyle: 'suggestive',
            queueStyle: 'ghost',
        },
        npcs: {
            staff: { managerRef: 'manager-kenji' },
            ambient: { min: 1, max: 4, spawnProfiles: [{ profileRef: 'tokyo-hypebeast', weight: 1 }] },
            interactionWeights: { celebrityCameo: 0.3 }, // Boosted to 30%
        },
        risk: {
            paymentFraudOdds: { cash: 0.01, card: 0.03, app: 0.02 },
            counterfeitOnShelfOdds: 0.05,
            auditOdds: 0.1,
        },
        copy: {
            tips: ['Check the pre-owned section for hidden gems.', 'Ask Kenji about potential back-room stock.'],
        }
    },
    'consign-soho-heat-museum': {
        id: 'consign-soho-heat-museum',
        name: 'SoHo Heat Museum',
        brandKey: 'gallery',
        themeOverrides: {
            colors: {
                accent: '#FBBF24', 
            },
        },
        scene: {
            backgroundRef: 'soho-gallery',
            camera: 'front',
            lighting: 'gallery',
        },
        layout: {
            headerVariant: 'stacked',
            tabsVariant: 'underline',
            gridColumns: 4,
            density: 'spacious',
        },
        tabs: [
            { id: 'grails', label: 'Grails', inventoryGroupRef: 'ny.grails' },
            { id: 'consignment', label: 'Consignment', inventoryGroupRef: 'ny.consignment' },
        ],
        pricing: {
            taxPct: 8.875,
            consignmentFeePct: 20,
            roundingMode: 'ceil',
        },
        policies: {
            returns: 'none',
        },
        behavior: {
            queueLength: [0, 2],
            securityLevel: 2,
            cleanliness: 'gallery',
            toutStyle: 'quiet',
        },
        npcs: {
            staff: { managerRef: 'manager-ava' },
            interactionWeights: { celebrityCameo: 0.4 }, // Boosted to 40% (Luxury/Gallery)
        },
        risk: {
            paymentFraudOdds: { cash: 0.005, card: 0.01, app: 0.005 },
            counterfeitOnShelfOdds: 0.01,
        },
    },
    'plug-bodega-barrio-la': {
        id: 'plug-bodega-barrio-la',
        name: 'Barrio Bodega Plug',
        brandKey: 'retro',
        themeOverrides: {
            colors: {
                accent: '#FF5733',
            },
        },
        scene: { backgroundRef: 'la-bodega', camera: 'counter', lighting: 'moody' },
        layout: { headerVariant: 'bar', tabsVariant: 'pills', gridColumns: 4, density: 'compact' },
        tabs: [
            { id: 'new', label: 'Fresh In', inventoryGroupRef: 'la.plug.new' },
            { id: 'used', label: 'Used Heat', inventoryGroupRef: 'la.plug.used' },
        ],
        pricing: { taxPct: 9.5, buybackDiscountPct: 50, roundingMode: 'floor' },
        policies: { returns: 'none', legitCheck: { enabled: false } },
        behavior: { queueLength: [0, 3], securityLevel: 0, cleanliness: 'grimy', toutStyle: 'pushy', queueStyle: 'invisible' },
        npcs: { 
            staff: { managerRef: 'manager-chico' },
            interactionWeights: { celebrityCameo: 0.35 } // Boosted to 35%
        },
        risk: { paymentFraudOdds: { cash: 0.05, card: 0.1, app: 0.08 }, counterfeitOnShelfOdds: 0.15, backdoorOdds: 0.2 },
    },
    'akihabara-arcade-kicks': {
        id: 'akihabara-arcade-kicks',
        name: 'Akihabara Arcade Kicks',
        brandKey: 'arcade',
        themeOverrides: {},
        scene: { backgroundRef: 'akihabara-arcade', camera: 'front', lighting: 'neon' },
        layout: { headerVariant: 'bar', tabsVariant: 'cards', gridColumns: 3, density: 'cozy' },
        tabs: [
            { id: 'new', label: 'Player 1 Select', inventoryGroupRef: 'tokyo.arcade.new' },
            { id: 'raffle', label: 'High Score Raffle', inventoryGroupRef: 'tokyo.arcade.raffle' },
        ],
        pricing: { taxPct: 10, roundingMode: 'round' },
        policies: { returns: '14d-exchange' },
        behavior: { queueLength: [1, 8], securityLevel: 1, cleanliness: 'standard', toutStyle: 'suggestive', queueStyle: 'avatars' },
        npcs: { 
            staff: { managerRef: 'manager-pixel' },
            interactionWeights: { celebrityCameo: 0.25 } // Boosted to 25%
        },
        risk: { paymentFraudOdds: { cash: 0.02, card: 0.02, app: 0.01 }, counterfeitOnShelfOdds: 0.02 },
        drops: {
            raffle: { open: true, entryLimit: 100, drawAt: new Date(Date.now() + 86400000).toISOString() }
        }
    },
    'shinjuku-shadow-runner': {
        id: 'shinjuku-shadow-runner',
        name: 'Shinjuku Shadow Runner',
        brandKey: 'cyberpunk',
        themeOverrides: {},
        scene: { backgroundRef: 'shinjuku-alley', camera: 'isometric', lighting: 'moody' },
        layout: { headerVariant: 'overhang', tabsVariant: 'underline', gridColumns: 3, density: 'compact' },
        tabs: [
            { id: 'new', label: 'Night Market', inventoryGroupRef: 'tokyo.cyberpunk.new' },
            { id: 'backroom', label: 'Back Room Deals', inventoryGroupRef: 'tokyo.cyberpunk.backroom' },
        ],
        pricing: { taxPct: 10, roundingMode: 'ceil' },
        policies: { returns: 'none' },
        behavior: { queueLength: [0, 2], securityLevel: 2, cleanliness: 'grimy', toutStyle: 'quiet', queueStyle: 'ghost' },
        npcs: { 
            staff: { managerRef: 'manager-kaida' },
            interactionWeights: { celebrityCameo: 0.2 } // Boosted to 20%
        },
        risk: { paymentFraudOdds: { cash: 0.01, card: 0.03, app: 0.02 }, counterfeitOnShelfOdds: 0.1, backdoorOdds: 0.3 },
    },
    'fifth-ave-grails': {
        id: 'fifth-ave-grails',
        name: 'Fifth Ave Grails',
        brandKey: 'luxury',
        themeOverrides: {},
        scene: { backgroundRef: 'fifth-ave-boutique', camera: 'front', lighting: 'gallery' },
        layout: { headerVariant: 'stacked', tabsVariant: 'underline', gridColumns: 2, density: 'spacious' },
        tabs: [
            { id: 'grails', label: 'The Collection', inventoryGroupRef: 'ny.luxury.grails' },
            { id: 'consignment', label: 'Private Consignment', inventoryGroupRef: 'ny.luxury.consignment' },
        ],
        pricing: { taxPct: 8.875, consignmentFeePct: 15, roundingMode: 'ceil' },
        policies: { returns: 'none', appointments: { enableTryOn: true, slotMinutes: 30 } },
        behavior: { queueLength: [0, 1], securityLevel: 2, cleanliness: 'gallery', toutStyle: 'quiet', queueStyle: 'invisible' },
        npcs: { 
            staff: { managerRef: 'manager-isabella' },
            interactionWeights: { celebrityCameo: 0.4 } // Boosted to 40%
        },
        risk: { paymentFraudOdds: { cash: 0.001, card: 0.005, app: 0.002 }, counterfeitOnShelfOdds: 0.005 },
    },
    'venice-beach-beats': {
        id: 'venice-beach-beats',
        name: 'Venice Beach Beats & Sneakers',
        brandKey: 'lofi',
        themeOverrides: {},
        scene: { backgroundRef: 'venice-beach-store', camera: 'front', lighting: 'warm' },
        layout: { headerVariant: 'bar', tabsVariant: 'pills', gridColumns: 3, density: 'cozy' },
        tabs: [
            { id: 'new', label: 'Chill Kicks', inventoryGroupRef: 'la.lofi.new' },
            { id: 'used', label: 'Good Vibes', inventoryGroupRef: 'la.lofi.used' },
            { id: 'trade', label: 'Trade At The Deck', inventoryGroupRef: 'trade' },
        ],
        pricing: { taxPct: 9.5, roundingMode: 'round' },
        policies: { returns: '14d-exchange' },
        behavior: { queueLength: [0, 4], securityLevel: 0, cleanliness: 'standard', toutStyle: 'quiet', queueStyle: 'ghost' },
        npcs: { 
            staff: { managerRef: 'manager-leo' },
            interactionWeights: { celebrityCameo: 0.3 } // Boosted to 30%
        },
        risk: { paymentFraudOdds: { cash: 0.01, card: 0.02, app: 0.01 }, counterfeitOnShelfOdds: 0.03 },
    },
    'jaffa-flea-market': {
        id: 'jaffa-flea-market',
        name: 'Jaffa Flea Market Finds',
        brandKey: 'retro',
        themeOverrides: {},
        scene: { backgroundRef: 'jaffa-market', camera: 'counter', lighting: 'bright-white' },
        layout: { headerVariant: 'bar', tabsVariant: 'pills', gridColumns: 4, density: 'compact' },
        tabs: [
            { id: 'used', label: 'Crate Digs', inventoryGroupRef: 'telaviv.retro.used' },
            { id: 'new', label: 'Just Landed', inventoryGroupRef: 'telaviv.retro.new' },
            { id: 'trade', label: 'Sell To Shimon', inventoryGroupRef: 'trade' },
        ],
        pricing: { taxPct: 17, roundingMode: 'floor' },
        policies: { returns: 'none' },
        behavior: { queueLength: [2, 10], securityLevel: 0, cleanliness: 'standard', toutStyle: 'pushy', queueStyle: 'avatars' },
        npcs: { 
            staff: { managerRef: 'manager-shimon' },
            interactionWeights: { celebrityCameo: 0.35 } // Boosted to 35%
        },
        risk: { paymentFraudOdds: { cash: 0.08, card: 0.12, app: 0.1 }, counterfeitOnShelfOdds: 0.2 },
    },
    'le-marais-archives': {
        id: 'le-marais-archives',
        name: 'Le Marais Archives',
        brandKey: 'gallery',
        themeOverrides: {},
        scene: { backgroundRef: 'paris-boutique', camera: 'front', lighting: 'gallery' },
        layout: { headerVariant: 'stacked', tabsVariant: 'underline', gridColumns: 3, density: 'spacious' },
        tabs: [
            { id: 'grails', label: 'The Archives', inventoryGroupRef: 'paris.gallery.grails' },
            { id: 'used', label: 'Salle 2 · Portés', inventoryGroupRef: 'paris.gallery.used' },
            { id: 'consignment', label: 'Dépôt-Vente', inventoryGroupRef: 'consignment' },
        ],
        pricing: { taxPct: 20, roundingMode: 'ceil' },
        policies: { returns: 'none' },
        behavior: { queueLength: [0, 2], securityLevel: 1, cleanliness: 'gallery', toutStyle: 'quiet' },
        npcs: { 
            staff: { managerRef: 'manager-claire' },
            interactionWeights: { celebrityCameo: 0.3 } // Boosted to 30%
        },
        risk: { paymentFraudOdds: { cash: 0.01, card: 0.01, app: 0.01 }, counterfeitOnShelfOdds: 0.01 },
    },
    'windy-city-soles': {
        id: 'windy-city-soles',
        name: 'Windy City Soles',
        brandKey: 'retro',
        themeOverrides: {},
        scene: { backgroundRef: 'chicago-store', camera: 'isometric', lighting: 'bright-white' },
        layout: { headerVariant: 'bar', tabsVariant: 'pills', gridColumns: 4, density: 'cozy' },
        tabs: [
            { id: 'new', label: 'Fresh Drops', inventoryGroupRef: 'chicago.retro.new' },
            { id: 'used', label: 'Classics', inventoryGroupRef: 'chicago.retro.used' },
            { id: 'grails', label: 'Hardwood Grails', inventoryGroupRef: 'chicago.retro.grails' },
            { id: 'trade', label: 'Counter Offer', inventoryGroupRef: 'trade' },
        ],
        pricing: { taxPct: 10.25, roundingMode: 'round' },
        policies: { returns: '7d-store-credit' },
        behavior: { queueLength: [0, 5], securityLevel: 1, cleanliness: 'standard', toutStyle: 'suggestive' },
        npcs: { 
            staff: { managerRef: 'manager-mike' },
            interactionWeights: { celebrityCameo: 0.25 } // Boosted to 25%
        },
        risk: { paymentFraudOdds: { cash: 0.03, card: 0.05, app: 0.04 }, counterfeitOnShelfOdds: 0.08 },
    },
    // --- NEW SHADY SPOTS ---
    'la-gutter-trunk': {
        id: 'la-gutter-trunk',
        name: 'Gutter Gabe\'s Trunk',
        brandKey: 'shady',
        themeOverrides: { colors: { accent: '#ff3333' } },
        scene: { backgroundRef: 'alley-dark', camera: 'floor-wall', lighting: 'moody' },
        layout: { headerVariant: 'bar', tabsVariant: 'cards', gridColumns: 2, density: 'compact' },
        tabs: [
            { id: 'fakes', label: 'Back of the Truck', inventoryGroupRef: 'la.shady.fakes' },
            { id: 'used', label: 'Whatever Is Loose', inventoryGroupRef: 'la.shady.used' },
            { id: 'trade', label: 'Gabe Buys', inventoryGroupRef: 'trade' },
        ],
        pricing: { taxPct: 0, roundingMode: 'floor' }, // No tax, black market
        policies: { returns: 'none', legitCheck: { enabled: false } },
        behavior: { queueLength: [0, 0], securityLevel: 0, cleanliness: 'grimy', toutStyle: 'pushy' },
        npcs: { 
            staff: { managerRef: 'gutter-gabe' }, 
            interactionWeights: { celebrityCameo: 0.4 } // Boosted to 40% (High risk/reward area)
        },
        risk: { paymentFraudOdds: { cash: 0.5, card: 1, app: 1 }, counterfeitOnShelfOdds: 1.0, securityInterventionOdds: 0.3 },
    },
    'ny-canal-street-tunnel': {
        id: 'ny-canal-street-tunnel',
        name: 'Canal St. Tunnels',
        brandKey: 'shady',
        themeOverrides: { colors: { accent: '#ff3333' } },
        scene: { backgroundRef: 'tunnel-dark', camera: 'counter', lighting: 'moody' },
        layout: { headerVariant: 'bar', tabsVariant: 'cards', gridColumns: 3, density: 'compact' },
        tabs: [
            { id: 'fakes', label: 'Super Perfects', inventoryGroupRef: 'ny.shady.fakes' },
            { id: 'backroom', label: 'Second Table', inventoryGroupRef: 'ny.shady.backroom' },
        ],
        pricing: { taxPct: 0, roundingMode: 'floor' },
        policies: { returns: 'none', legitCheck: { enabled: false } },
        behavior: { queueLength: [0, 10], securityLevel: 0, cleanliness: 'grimy', toutStyle: 'pushy' },
        npcs: { 
            staff: { managerRef: 'manager-vinny' },
            interactionWeights: { celebrityCameo: 0.4 } // Boosted to 40%
        },
        risk: { paymentFraudOdds: { cash: 0.2, card: 0.8, app: 0.5 }, counterfeitOnShelfOdds: 1.0, securityInterventionOdds: 0.25 },
    },
    // --- NEW ROOMS ------------------------------------------------------
    // Each of these exists to give a layout in `components/shoestore/layouts/`
    // a home, and each needs its own `inventoryGroupRef` strings or the market
    // generator in useGame has nothing to stock them with.
    'shibuya-vending-annex': {
        id: 'shibuya-vending-annex',
        name: 'Shibuya Vending Annex',
        brandKey: 'outlet',
        themeOverrides: {},
        scene: { backgroundRef: 'shibuya-underpass', camera: 'front', lighting: 'neon' },
        layout: { headerVariant: 'bar', tabsVariant: 'cards', gridColumns: 3, density: 'compact' },
        tabs: [
            { id: 'new', label: 'Row A · Sealed', inventoryGroupRef: 'tokyo.vending.new' },
            { id: 'grails', label: 'Row B · Rare Slots', inventoryGroupRef: 'tokyo.vending.grails' },
            { id: 'trade', label: 'Buy-Back Machine', inventoryGroupRef: 'trade' },
        ],
        pricing: { taxPct: 10, buybackDiscountPct: 55, roundingMode: 'floor', dynamicSignals: ['shortage'] },
        // No staff means no judgement: the machine takes the note either way.
        policies: { returns: 'none', legitCheck: { enabled: false } },
        behavior: { queueLength: [0, 3], securityLevel: 0, cleanliness: 'standard', toutStyle: 'quiet', queueStyle: 'ghost' },
        npcs: {
            staff: { managerRef: 'clerk-tokyo' },
            ambient: { min: 0, max: 3, spawnProfiles: [{ profileRef: 'clerk-tokyo', weight: 2 }, { profileRef: 'wiz-k', weight: 1 }] },
            interactionWeights: { celebrityCameo: 0.2 },
        },
        risk: { paymentFraudOdds: { cash: 0.01, card: 0.02, app: 0.04 }, counterfeitOnShelfOdds: 0.08, auditOdds: 0.05 },
        trade: { buybackEnabled: true, baseOfferPctOfMarket: 0.45, haggle: { enable: false, sweetSpotRange: [0.4, 0.5], triggerPct: 0 } },
        copy: { tips: ['Row B jams about once a week. It keeps the shoe and the money.'] },
    },
    'bed-stuy-bodega-backroom': {
        id: 'bed-stuy-bodega-backroom',
        name: 'Bed-Stuy Bodega Back Room',
        brandKey: 'plug',
        themeOverrides: {},
        scene: { backgroundRef: 'bodega-backroom', camera: 'counter', lighting: 'bright-white' },
        layout: { headerVariant: 'bar', tabsVariant: 'pills', gridColumns: 3, density: 'compact' },
        tabs: [
            { id: 'new', label: 'On The Shelf', inventoryGroupRef: 'ny.bodega.new' },
            { id: 'used', label: 'Traded In', inventoryGroupRef: 'ny.bodega.used' },
            { id: 'fakes', label: 'Behind The Curtain', inventoryGroupRef: 'ny.bodega.backroom' },
            { id: 'trade', label: 'He Buys Too', inventoryGroupRef: 'trade' },
        ],
        pricing: { taxPct: 8.875, buybackDiscountPct: 45, roundingMode: 'floor' },
        policies: { returns: 'none', legitCheck: { enabled: false } },
        behavior: { queueLength: [1, 6], securityLevel: 0, cleanliness: 'grimy', toutStyle: 'suggestive', queueStyle: 'avatars' },
        npcs: {
            staff: { managerRef: 'clerk-new-york' },
            ambient: { min: 1, max: 3, spawnProfiles: [{ profileRef: 'clerk-new-york', weight: 2 }, { profileRef: 'grandma-laces', weight: 1 }, { profileRef: 'scalper-sid', weight: 1 }] },
            interactionWeights: { backroomWhisper: 0.5, celebrityCameo: 0.3 },
        },
        risk: { paymentFraudOdds: { cash: 0.06, card: 0.15, app: 0.1 }, counterfeitOnShelfOdds: 0.35, backdoorOdds: 0.4 },
        trade: { buybackEnabled: true, baseOfferPctOfMarket: 0.55, haggle: { enable: true, sweetSpotRange: [0.6, 0.8], triggerPct: 0.5 } },
        copy: { tips: ['Buy a sandwich first. The curtain opens faster.'] },
    },
    'florentin-rooftop-souk': {
        id: 'florentin-rooftop-souk',
        name: 'Florentin Rooftop Souk',
        brandKey: 'outlet',
        themeOverrides: {},
        scene: { backgroundRef: 'tlv-rooftop', camera: 'floor-wall', lighting: 'warm' },
        layout: { headerVariant: 'stacked', tabsVariant: 'pills', gridColumns: 3, density: 'cozy' },
        tabs: [
            { id: 'new', label: 'Fresh Off The Van', inventoryGroupRef: 'telaviv.souk.new' },
            { id: 'used', label: 'Sun-Faded', inventoryGroupRef: 'telaviv.souk.used' },
            { id: 'trade', label: 'Swap At The Cooler', inventoryGroupRef: 'trade' },
        ],
        pricing: { taxPct: 17, buybackDiscountPct: 35, roundingMode: 'round', dynamicSignals: ['event-bonus'] },
        policies: { returns: '7d-store-credit', legitCheck: { enabled: true, fee: 0 } },
        behavior: { queueLength: [2, 9], securityLevel: 1, cleanliness: 'standard', toutStyle: 'pushy', queueStyle: 'avatars' },
        npcs: {
            staff: { managerRef: 'clerk-tel-aviv' },
            ambient: { min: 2, max: 4, spawnProfiles: [{ profileRef: 'clerk-tel-aviv', weight: 2 }, { profileRef: 'clerk-israeli', weight: 1 }, { profileRef: 'bibi', weight: 1 }] },
            interactionWeights: { haggleInvite: 0.6, tradePitch: 0.4, celebrityCameo: 0.35 },
        },
        risk: { paymentFraudOdds: { cash: 0.04, card: 0.09, app: 0.06 }, counterfeitOnShelfOdds: 0.18, securityInterventionOdds: 0.05 },
        trade: { buybackEnabled: true, baseOfferPctOfMarket: 0.65, haggle: { enable: true, sweetSpotRange: [0.7, 0.9], triggerPct: 0.6 }, fastCashBonusPct: 5 },
        copy: { tips: ['Everything costs less after the sun is fully down. So does everyone.'] },
    },
    'southside-boiler-room': {
        id: 'southside-boiler-room',
        name: 'South Side Boiler Room',
        brandKey: 'consignment',
        themeOverrides: {},
        scene: { backgroundRef: 'chicago-basement', camera: 'floor-wall', lighting: 'moody' },
        layout: { headerVariant: 'overhang', tabsVariant: 'cards', gridColumns: 3, density: 'compact' },
        tabs: [
            { id: 'grails', label: 'Locker Bank B', inventoryGroupRef: 'chicago.boiler.grails' },
            { id: 'used', label: 'Game-Worn', inventoryGroupRef: 'chicago.boiler.used' },
            { id: 'consignment', label: 'Leave A Pair', inventoryGroupRef: 'consignment' },
        ],
        pricing: { taxPct: 10.25, consignmentFeePct: 12, buybackDiscountPct: 30, roundingMode: 'ceil', dynamicSignals: ['shortage'] },
        policies: { returns: 'none', legitCheck: { enabled: true, fee: 25, accuracyBoost: 0.2 }, holds: { allow: true, maxHours: 24, depositPct: 20 } },
        behavior: { queueLength: [0, 2], securityLevel: 2, cleanliness: 'grimy', toutStyle: 'quiet', queueStyle: 'invisible' },
        npcs: {
            staff: { managerRef: 'clerk-chicago', legitCheckerRef: 'clerk-chicago' },
            ambient: { min: 0, max: 2, spawnProfiles: [{ profileRef: 'clerk-chicago', weight: 2 }, { profileRef: 'scalper-sid', weight: 1 }] },
            interactionWeights: { tradePitch: 0.5, celebrityCameo: 0.3 },
        },
        risk: { paymentFraudOdds: { cash: 0.01, card: 0.03, app: 0.02 }, counterfeitIntakeOdds: 0.05, counterfeitOnShelfOdds: 0.02, auditOdds: 0.15 },
        trade: { buybackEnabled: true, baseOfferPctOfMarket: 0.7, haggle: { enable: true, sweetSpotRange: [0.75, 0.9], triggerPct: 0.5 }, legitCheckOnTrade: true },
        copy: { tips: ['Locker 07 has been locked since 1998 and everyone has a theory.'] },
    },
    'atelier-rue-norvins': {
        id: 'atelier-rue-norvins',
        name: 'Atelier Rue Norvins',
        brandKey: 'boutique',
        themeOverrides: {},
        scene: { backgroundRef: 'paris-atelier', camera: 'counter', lighting: 'gallery' },
        layout: { headerVariant: 'stacked', tabsVariant: 'underline', gridColumns: 2, density: 'spacious' },
        tabs: [
            { id: 'new', label: 'Pièces Neuves', inventoryGroupRef: 'paris.atelier.new' },
            { id: 'grails', label: 'Sur Mesure', inventoryGroupRef: 'paris.atelier.grails' },
            { id: 'trade', label: 'Restauration', inventoryGroupRef: 'trade' },
        ],
        pricing: { taxPct: 20, buybackDiscountPct: 25, roundingMode: 'ceil' },
        // They authenticate because they can tell by the stitching, not a scanner.
        policies: { returns: '14d-exchange', legitCheck: { enabled: true, fee: 0, accuracyBoost: 0.3 }, appointments: { enableTryOn: true, slotMinutes: 45 } },
        behavior: { queueLength: [0, 2], securityLevel: 2, cleanliness: 'gallery', toutStyle: 'quiet', queueStyle: 'invisible' },
        npcs: {
            staff: { managerRef: 'clerk-paris', legitCheckerRef: 'clerk-paris' },
            ambient: { min: 0, max: 2, spawnProfiles: [{ profileRef: 'clerk-paris', weight: 3 }, { profileRef: 'grandma-laces', weight: 1 }] },
            interactionWeights: { tradePitch: 0.3, celebrityCameo: 0.35 },
        },
        risk: { paymentFraudOdds: { cash: 0.005, card: 0.01, app: 0.005 }, counterfeitIntakeOdds: 0.02, counterfeitOnShelfOdds: 0.005 },
        trade: { buybackEnabled: true, baseOfferPctOfMarket: 0.75, haggle: { enable: false, sweetSpotRange: [0.7, 0.8], triggerPct: 0 }, legitCheckOnTrade: true },
        copy: { tips: ['Ask about the last. They will talk for forty minutes and knock nothing off.'] },
    }
};

