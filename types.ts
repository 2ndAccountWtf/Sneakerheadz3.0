
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

/**
 * AM/PM shelves. A real convenience store spans dairy, bakery, frozen, pantry,
 * household and personal care — mirroring that is what lets the *effects* be
 * completely deranged while the stock stays believable.
 */
export type AmpmAisle =
    | 'food'
    | 'drinks'
    | 'bakery'
    | 'snacks'
    | 'frozen'
    | 'household'
    | 'personal-care'
    | 'specialty'
    | 'questionable';

/** Social and condition stats that consumables move. */
export type SoftStat = 'health' | 'energy' | 'mood' | 'focus' | 'cleanliness';
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

  // --- Consumable systems ---
  /** Which AM/PM shelf this sits on. */
  aisle?: AmpmAisle;
  /** 0..1 chance of triggering a bathroom emergency when consumed. */
  digestiveRisk?: number;
  /** Gas units added on consumption. The meter is hidden from the player. */
  gas?: number;
  /** Flat stat deltas applied on use, before the random effect table runs. */
  deltas?: Partial<Record<SoftStat, number>>;
  /** Shown on the card so joke items read as jokes rather than as bugs. */
  uselessness?: string;
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
    /** 0-100. Deodorant, mouthwash and not sleeping in a doorway. NPCs notice. */
    cleanliness: number;
    /** 0-100. Sugar, croissants and small victories. */
    mood: number;
    /** 0-100. Coffee and gum. Steadies your hand in mini-games. */
    focus: number;
    /**
     * Hidden 0-12+ meter. Hummus goes in, consequences come out, and the
     * player is never shown the number — only the escalating symptoms.
     */
    gas: number;
    /** Reputation on the street. Gates prices, NPC attitude and rank. */
    streetCred: number;
    /** 0-100 police attention. Rises with fakes and shady stores. */
    heat: number;
    /** 0-100. Gates Bibi gift scenes and decides the Drip collab branch. */
    bibiApproval: number;
    /** Named world-state switches set by scenarios (e.g. 'bibi-favored'). */
    flags: Record<string, boolean | number>;
    buffs: Buff[];
    /** Set when the chocolate milk was a mistake. Blocks travel until resolved. */
    emergency: BathroomEmergency | null;

    // --- Money, beyond what is in your pocket ---
    /** Money in the bank. Safe from robbery, useless in a back alley. */
    bank: number;
    /** Your cards and what state they are in. */
    wallet: Wallet;
    /** How each collector and celebrity feels about you, by npc id. */
    connections: Record<string, Connection>;
}

/**
 * The wallet.
 *
 * Carrying cash buys you discounts and gets you robbed; carrying a card keeps
 * the money safe and leaves you helpless the day you leave it in a jacket.
 */
export interface Wallet {
    /** You have a bank card at all. Lose it and you cannot draw cash. */
    hasCard: boolean;
    /** A credit line — buy now, pay interest later. */
    hasCredit: boolean;
    /** Outstanding credit balance. Accrues interest daily. */
    creditOwed: number;
    /** Credit ceiling, raised by a clean repayment record. */
    creditLimit: number;
    /**
     * Day the card becomes usable again. Left it in a jacket, dropped it in a
     * bar, a machine ate it — either way you are cash-only until then.
     */
    cardBlockedUntilDay?: number;
    /** Why the card is unusable, shown to the player. */
    cardBlockedReason?: string;
}

/** Standing with a single collector or celebrity. */
export interface Connection {
    npcId: string;
    /** -100 to 100. Drives price, trust, and whether they will see you at all. */
    standing: number;
    /** Completed deals, which is what earns the better prices. */
    deals: number;
    /** They caught you passing a fake. They do not forget. */
    burnedYou: boolean;
    /** You caught them paying in counterfeits. Neither do you. */
    youBurnedThem: boolean;
    /** Day you last did business, for cooling-off periods. */
    lastDealDay: number;
}

/**
 * A bathroom emergency. Real-time, because the joke only works if the player
 * feels the clock. While one is active the core loop is interrupted: travel is
 * disabled and encounters are compromised.
 */
export interface BathroomEmergency {
    id: string;
    /** What you ate, named and shamed. */
    cause: string;
    startedAt: number;
    /** Wall-clock ms when this becomes a disaster. */
    deadline: number;
    /** 1 = uncomfortable, 3 = do not speak to anyone. */
    severity: 1 | 2 | 3;
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

/**
 * A city's running opinion of one model's price, as a multiplier on the
 * model's base price. Persisted across days — see `systems/market/simulate.ts`
 * for why a market that forgets everything overnight cannot be traded.
 */
export interface PriceIndex {
    /** Today's multiplier against base price. */
    value: number;
    /** Last night's move, carried forward so trends last a few days. */
    momentum: number;
    /** Yesterday's value, so the UI can show a delta without a history array. */
    previous: number;
}

export interface CityMarket {
    cityId: string;
    sneakers: MarketSneaker[];
    /** Per-model price index, keyed by sneaker id. */
    index: Record<string, PriceIndex>;
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
    /** A challenge or happening in the city you are standing in. */
    activeCityEvent: import('./systems/events/cityEvents').CityEvent | null;
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
    Bathrooms = 'BATHROOMS',
    Venues = 'VENUES',
    Bank = 'BANK',
    Collectors = 'COLLECTORS',
    GameOver = 'GAME_OVER',
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
