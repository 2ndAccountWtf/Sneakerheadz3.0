import type { Player, PlayerStats } from './types';

export const INITIAL_PLAYER_CASH = 2000;
export const MAX_INVENTORY_SIZE = 10;
export const INITIAL_DAY = 1;
export const TOTAL_DAYS = 30;

export const MAX_HEALTH = 100;
export const MAX_ENERGY = 100;
export const MAX_HEAT = 100;
export const MAX_SOFT_STAT = 100;

/**
 * Gas thresholds. The meter itself is never shown — the player learns it
 * through escalating public consequences, which is funnier and more alarming.
 */
export const GAS_THRESHOLDS = {
    /** Below this, nothing happens at all. */
    silent: 3,
    /** A cartoon sound only you hear. */
    audible: 3,
    /** An NPC notices and says something. */
    noticed: 6,
    /** Public incident: reputation hit, bystanders react. */
    incident: 9,
    /** Biological event. The room clears. */
    biological: 11,
} as const;

/** How long the player has to find a toilet, by severity. */
export const EMERGENCY_SECONDS: Record<1 | 2 | 3, number> = { 1: 180, 2: 120, 3: 90 };
/** Energy burned by a single flight. Running out costs you health instead. */
export const TRAVEL_ENERGY_COST = 15;

export const INITIAL_PLAYER_STATS: PlayerStats = {
    totalProfit: 0,
    sneakersSold: 0,
    hummusEaten: 0,
    timesFarted: 0,
    moneyWastedOnBurekas: 0,
    timesRobbed: 0,
    bibiRespect: 0,
    fightsWon: 0,
    fightsLost: 0,
    minigamesPlayed: 0,
    questsCompleted: 0,
    boxesOpened: 0,
    napsTaken: 0,
    giftsFromBibi: 0,
};

export const INITIAL_PLAYER: Player = {
    cash: INITIAL_PLAYER_CASH,
    inventory: [],
    storage: [],
    statusEffects: [],
    stats: INITIAL_PLAYER_STATS,
    health: MAX_HEALTH,
    energy: MAX_ENERGY,
    cleanliness: 80,
    mood: 60,
    focus: 60,
    gas: 0,
    emergency: null,
    streetCred: 0,
    heat: 0,
    bibiApproval: 25,
    flags: {},
    buffs: [],
};

export const INITIAL_CITY_ID = 'tokyo';

// Store Inventory Constants
export const MIN_STORE_SNEAKER_MODELS = 15;
export const MAX_STORE_SNEAKER_MODELS = 30;
export const MAX_OOS_ITEMS_TO_SHOW = 5;

/**
 * Street cred ladder. The old Stats screen hard-coded "Street Urchin
 * (Rank system offline)"; this is the system that was missing.
 */
export const CRED_RANKS: { min: number; title: string; icon: string }[] = [
    { min: 0, title: 'Street Urchin', icon: '🪣' },
    { min: 15, title: 'Corner Hustler', icon: '🧢' },
    { min: 35, title: 'Local Plug', icon: '🔌' },
    { min: 60, title: 'Certified Reseller', icon: '💼' },
    { min: 95, title: 'Heat Merchant', icon: '🔥' },
    { min: 140, title: 'Drip Syndicate Boss', icon: '👑' },
    { min: 200, title: 'Living Legend', icon: '🛐' },
];

export const getCredRank = (cred: number) => {
    let rank = CRED_RANKS[0];
    for (const r of CRED_RANKS) if (cred >= r.min) rank = r;
    return rank;
};
