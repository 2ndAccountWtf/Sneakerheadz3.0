
import type { ActiveInteractionState } from './types/interactions';
import type { NewsItem, MarketSignal } from './types/news';
import type { TravelEventStub } from './systems/events/categories';
import type { Buff, OutcomeLogEntry, MiniGameRequest, SideQuest } from './types/game';

export interface Sneaker {
    id: string;
    name: string;
    rarity: 'Common' | 'Uncommon' | 'Rare' | 'Legendary';
    basePrice: number;
    volatility: number; // 0.1 = 10% price swing potential
    imageUrl: string;
    isFake?: boolean; // New property for replicas
}

export interface InventoryItem {
    instanceId: string;
    sneakerId: string;
    purchasePrice: number;
    isFake?: boolean; // Persist fake status to inventory
    /**
     * Permanent value scalar on this specific pair. Blessings (and the
     * Bibi/Drip collab) multiply what a pair is worth without touching the
     * wider market.
     */
    valueMultiplier?: number;
    /** Cosmetic damage tags such as 'scuffed', which shave off resale value. */
    condition?: string[];
}

export interface StatusEffect {
    id: string;
    statusId: string;
    description: string;
    expiresAt: number; // Unix timestamp ms
}

export type ItemType = 'food' | 'drinks' | 'weapons' | 'tools' | 'oddities' | 'All';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface ItemEffect {
    type: 'status_effect' | 'stat_change' | 'notification';
    payload: {
        stat?: 'health' | 'energy';
        value?: number;
        statusId?: 'diarrhea' | 'gassy' | 'well-fed' | 'energized';
        durationHrs?: number;
        message?: string;
        description?: string; // for status effects
    };
    chance: number; // from 0.0 to 1.0
}

export interface StorageItem {
  id: string;
  name: string;
  type: ItemType;
  rarity: Rarity;
  qty: number;
  img: string;
  stats: {
    power: number;
    energy: number;
    freshness: number;
    risk: number;
    wackiness: number;
  };
  tags: string[];
  flavor: string;
  addedAgo: string;
  stackable?: boolean;
  effects?: ItemEffect[];
}

export interface PlayerStats {
    totalProfit: number;
    sneakersSold: number;
    hummusEaten: number;
    timesFarted: number;
    moneyWastedOnBurekas: number;
    timesRobbed: number;
    bibiRespect: number;
    fightsWon: number;
    fightsLost: number;
    minigamesPlayed: number;
    questsCompleted: number;
    boxesOpened: number;
    napsTaken: number;
    giftsFromBibi: number;
}

export interface Player {
    cash: number;
    inventory: InventoryItem[]; // Sneakers
    storage: StorageItem[]; // AM/PM items
    statusEffects: StatusEffect[];
    stats: PlayerStats;
    /** 0-100. Hits zero and you wake up in a hospital lighter by a day and a wad of cash. */
    health: number;
    /** 0-100. Spent by travel and mini-games, restored by food and naps. */
    energy: number;
    /** Reputation on the street. Gates prices, NPC attitude and rank. */
    streetCred: number;
    /** 0-100 police attention. Rises with fakes and shady stores. */
    heat: number;
    /** 0-100. Gates Bibi gift scenes and decides the Drip collab branch. */
    bibiApproval: number;
    /** Named world-state switches set by scenarios (e.g. 'bibi-favored'). */
    flags: Record<string, boolean | number>;
    buffs: Buff[];
}

export interface City {
    id:string;
    name: string;
    description: string;
    image: string;
}

export interface MarketSneaker {
    sneakerId: string;
    price: number;
    quantity: number;
    group: string; // Supports separating "New", "Used", "Fakes" within a city
    isFake?: boolean;
}

export interface CityMarket {
    cityId: string;
    sneakers: MarketSneaker[];
}

export interface GameState {
    player: Player;
    currentCityId: string;
    day: number;
    currentScreen: Screen;
    markets: Record<string, CityMarket>;
    notification: { message: string, type: 'success' | 'error' | 'info' } | null;
    currentStoreId: string | null;
    activeInteraction: ActiveInteractionState | null;
    activeNewsItem: NewsItem | null;
    activeMarketSignals: MarketSignal[];
    pendingTravelEvent: TravelEventStub | null;
    currentAnalysisSneakerId: string | null;
    /** Receipt of what the last resolved scenario node actually did. */
    outcomeLog: OutcomeLogEntry[];
    /** Set when a scenario (or the arcade) hands control to a mini-game. */
    activeMiniGame: MiniGameRequest | null;
    quests: SideQuest[];
    /** Cinematic full-screen takeover (Bibi gifts, the Drip collab). */
    activeCutscene: Cutscene | null;
}

export interface Cutscene {
    id: string;
    kind: 'bibi-gift' | 'collab' | 'disaster';
    title: string;
    subtitle?: string;
    portraitUrl?: string;
    /** Lines revealed one at a time. */
    lines: { speaker?: string; text: string }[];
    /** Shown as the payoff panel after the last line. */
    effects: OutcomeLogEntry[];
}

export enum Screen {
    Dashboard = 'DASHBOARD',
    Travel = 'TRAVEL',
    CityStores = 'CITY_STORES',
    ShoeStore = 'SHOE_STORE',
    Inventory = 'INVENTORY',
    Ampm = 'AMPM',
    Social = 'SOCIAL',
    Storage = 'STORAGE',
    Stats = 'STATS',
    CityFeed = 'CITY_FEED',
    MarketAnalysis = 'MARKET_ANALYSIS',
    Arcade = 'ARCADE',
    Quests = 'QUESTS',
}

export interface AmpmItem {
    id: string;
    name: string;
    description: string;
    price: number;
    effect: string;
    category: 'Food & Drinks' | 'Tools & Gear' | 'Local Specialties';
    cities?: string[]; // If undefined, item is global. Otherwise, it's local to the specified cities.
}

export interface PriceHistoryData {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
