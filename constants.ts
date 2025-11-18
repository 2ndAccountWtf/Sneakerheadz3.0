
import type { Player, PlayerStats } from './types';

export const INITIAL_PLAYER_CASH = 2000;
export const MAX_INVENTORY_SIZE = 10;
export const INITIAL_DAY = 1;
export const TOTAL_DAYS = 30;

export const INITIAL_PLAYER_STATS: PlayerStats = {
    totalProfit: 0,
    sneakersSold: 0,
    hummusEaten: 0,
    timesFarted: 0,
    moneyWastedOnBurekas: 0,
    timesRobbed: 0,
    bibiRespect: 0,
};

export const INITIAL_PLAYER: Player = {
    cash: INITIAL_PLAYER_CASH,
    inventory: [],
    storage: [],
    statusEffects: [],
    stats: INITIAL_PLAYER_STATS,
};

export const INITIAL_CITY_ID = 'tokyo';

// Store Inventory Constants
export const MIN_STORE_SNEAKER_MODELS = 15;
export const MAX_STORE_SNEAKER_MODELS = 30;
export const MAX_OOS_ITEMS_TO_SHOW = 5;
