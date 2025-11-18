
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { Screen, StatusEffect } from '../types';
import type { GameState, Player, CityMarket, MarketSneaker, Sneaker, InventoryItem, StorageItem } from '../types';
import type { ActiveInteractionState } from '../types/interactions';
import type { NewsItem, MarketSignal } from '../types/news';
import { INITIAL_PLAYER, INITIAL_CITY_ID, INITIAL_DAY, MAX_INVENTORY_SIZE, MIN_STORE_SNEAKER_MODELS, MAX_STORE_SNEAKER_MODELS } from '../constants';
import { CITIES } from '../data/cities';
import { SNEAKERS } from '../data/sneakers';
import { rollTravelEvent, TravelContext } from '../systems/events/travelEngine';
import { resolveEventStub } from '../systems/events/eventResolver';
import { storageMock } from '../data/storage.mock';
import { STORE_CONFIGS } from '../data/storeConfigs';
import { STORES_BY_CITY } from '../data/stores';

// Game Actions
type Action =
    | { type: 'TRAVEL'; payload: { cityId: string; } }
    | { type: 'BUY_SNEAKER'; payload: { sneakerId: string; price: number; quantity: number; isFake?: boolean } }
    | { type: 'SELL_SNEAKER'; payload: { instanceId: string; price: number; securityLevel: number } }
    | { type: 'USE_STORAGE_ITEM'; payload: { itemId: string } }
    | { type: 'BUY_STORAGE_ITEM'; payload: { itemId: string; price: number } }
    | { type: 'CHANGE_SCREEN'; payload: Screen }
    | { type: 'SELECT_STORE'; payload: { storeId: string } }
    | { type: 'VIEW_MARKET_ANALYSIS'; payload: { sneakerId: string } }
    | { type: 'SET_NOTIFICATION'; payload: { message: string, type: 'success' | 'error' | 'info' } | null }
    | { type: 'START_INTERACTION'; payload: { npcId: string; scenarioId: string } }
    | { type: 'PROGRESS_INTERACTION'; payload: { nextNodeId: string } }
    | { type: 'END_INTERACTION' }
    | { type: 'SHOW_NEWS_ITEM'; payload: NewsItem }
    | { type: 'HIDE_NEWS_ITEM' }
    | { type: 'APPLY_MARKET_SIGNAL'; payload: MarketSignal }
    | { type: 'CLEAR_TRAVEL_EVENT' }
    | { type: 'UPDATE_STAT'; payload: { stat: keyof Player['stats']; value: number; mode: 'add' | 'set' } };

// Game Context
interface GameContextType {
    gameState: GameState;
    dispatch: React.Dispatch<Action>;
    changeScreen: (screen: Screen) => void;
    buySneaker: (sneakerId: string, price: number, quantity: number, isFake?: boolean) => void;
    sellSneaker: (instanceId: string, price: number) => void;
    useStorageItem: (itemId: string) => void;
    buyStorageItem: (itemId: string, price: number) => void;
    travel: (cityId: string) => void;
    selectStore: (storeId: string) => void;
    viewMarketAnalysis: (sneakerId: string) => void;
    startInteraction: (npcId: string, scenarioId: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const generateInitialMarkets = (): Record<string, CityMarket> => {
    const markets: Record<string, CityMarket> = {};

    CITIES.forEach(city => {
        // Populate stock based on the defined tabs in storeConfigs for this city
        const cityStores = STORES_BY_CITY[city.id] || [];
        const sneakers: MarketSneaker[] = [];

        cityStores.forEach(storeInfo => {
            const config = STORE_CONFIGS[storeInfo.id];
            if (!config) return;

            config.tabs.forEach(tab => {
                // Don't generate stock for non-purchase tabs like 'trade' or 'consign' unless we have logic
                if (tab.id === 'trade' || tab.id === 'consignment') return;

                const isFakeTab = tab.inventoryGroupRef.includes('fakes') || tab.inventoryGroupRef.includes('backroom');
                
                // Number of items to generate for this specific tab
                const numModels = Math.floor(Math.random() * 6) + 3; // 3-8 items per tab
                const tabModels = [...SNEAKERS].sort(() => 0.5 - Math.random()).slice(0, numModels);

                tabModels.forEach(sneaker => {
                    const priceVariance = (Math.random() - 0.5) * sneaker.volatility * sneaker.basePrice;
                    let finalPrice = Math.round(sneaker.basePrice + priceVariance);
                    
                    // Fakes are significantly cheaper
                    if (isFakeTab) {
                        finalPrice = Math.round(finalPrice * 0.15); // 15% of real value
                    }

                    let quantity = Math.floor(Math.random() * 5) + 1;

                    sneakers.push({
                        sneakerId: sneaker.id,
                        price: finalPrice,
                        quantity: quantity,
                        group: tab.inventoryGroupRef,
                        isFake: isFakeTab,
                    });
                });
            });
        });

        // Fallback: If no stores configured, fill generic stock (for safety)
        if (sneakers.length === 0) {
            // ... (Keep original logic as fallback if needed, but empty for now to rely on config)
             const storeModels = [...SNEAKERS].sort(() => 0.5 - Math.random()).slice(0, 10);
             storeModels.forEach(s => sneakers.push({ 
                 sneakerId: s.id, 
                 price: s.basePrice, 
                 quantity: 5, 
                 group: 'general' 
            }));
        }

        markets[city.id] = { cityId: city.id, sneakers };
    });
    return markets;
};

const gameReducer = (state: GameState, action: Action): GameState => {
    switch (action.type) {
        case 'CHANGE_SCREEN':
            const isLeavingStoreFlow = [Screen.Dashboard, Screen.Travel, Screen.Ampm, Screen.Inventory].includes(action.payload);
            const isLeavingAnalysis = action.payload !== Screen.MarketAnalysis;
            return { 
                ...state, 
                currentScreen: action.payload,
                currentStoreId: isLeavingStoreFlow ? null : state.currentStoreId,
                currentAnalysisSneakerId: isLeavingAnalysis ? null : state.currentAnalysisSneakerId,
            };
        
        case 'SELECT_STORE':
            return { ...state, currentStoreId: action.payload.storeId, currentScreen: Screen.ShoeStore };

        case 'VIEW_MARKET_ANALYSIS':
            return { ...state, currentAnalysisSneakerId: action.payload.sneakerId, currentScreen: Screen.MarketAnalysis };

        case 'TRAVEL': {
            // ... (Travel logic mostly same, but needs to refresh markets respecting groups)
            const newDay = state.day + 1;
            const newMarkets = generateInitialMarkets(); // Regenerate markets for now to simulate shifts + stock rotation easier

            // Clear expired signals upon travel
            const now = Date.now();
            const activeSignals = state.activeMarketSignals.filter(signal => signal.expiresAt > now);

            // --- TRAVEL EVENT ENGINE ---
            const timeOfDay = ['morning', 'afternoon', 'evening', 'night'][(state.day) % 4] as "morning" | "afternoon" | "evening" | "night";
            const context: TravelContext = {
                fromCity: state.currentCityId,
                toCity: action.payload.cityId,
                timeOfDay: timeOfDay,
            };
            const eventResult = rollTravelEvent(context);
            
            const baseNextState = {
                 ...state, 
                currentCityId: action.payload.cityId, 
                day: newDay, 
                markets: newMarkets, 
                activeMarketSignals: activeSignals,
                pendingTravelEvent: null, // Reset pending event
            };

            if (eventResult.kind === 'stub') {
                const resolvedEvent = resolveEventStub(eventResult.event, context);
                if (resolvedEvent) {
                    return {
                        ...baseNextState,
                        pendingTravelEvent: eventResult.event, // Flag this as a travel event
                        activeInteraction: {
                            npcId: resolvedEvent.npcId,
                            scenarioId: resolvedEvent.scenarioId,
                            currentNodeId: 'intro'
                        },
                        currentScreen: Screen.Dashboard, // The interaction modal will overlay this
                        notification: { message: `Traveling to ${CITIES.find(c=>c.id === action.payload.cityId)?.name}... An event occurred!`, type: 'info' }
                    };
                }
            }

            return { 
                ...baseNextState, 
                currentScreen: Screen.Dashboard,
                notification: { message: `Arrived in ${CITIES.find(c=>c.id === action.payload.cityId)?.name}. Day ${newDay}.`, type: 'info'},
            };
        }

        case 'BUY_SNEAKER': {
            const { sneakerId, price, quantity, isFake } = action.payload;
            const totalPrice = price * quantity;

            if (state.player.cash < totalPrice) {
                return {...state, notification: { message: "Not enough cash!", type: 'error' }};
            }
            if (state.player.inventory.length + quantity > MAX_INVENTORY_SIZE) {
                return {...state, notification: { message: "Inventory is full!", type: 'error' }};
            }
            
            // Find stock in current market to reduce it
            const currentMarket = state.markets[state.currentCityId];
            // Note: We need to find the *exact* market entry including group/isFake to decrement correctly.
            // This simplifiction finds the first match. In a real DB, we'd pass the specific listing ID.
            const sneakerIndex = currentMarket.sneakers.findIndex(s => s.sneakerId === sneakerId && s.price === price); // Match by price is a proxy for match by group/fake status here
            
            if (sneakerIndex === -1) return state; 
            const sneakerInMarket = currentMarket.sneakers[sneakerIndex];
            
            if (sneakerInMarket.quantity < quantity) {
                 return { ...state, notification: { message: "Not enough in stock!", type: 'error' } };
            }

            // --- STATE UPDATES ---
            const newItems: InventoryItem[] = Array.from({ length: quantity }, (_, i) => ({
                instanceId: `item-${Date.now()}-${Math.random()}-${i}`,
                sneakerId: sneakerId,
                purchasePrice: price,
                isFake: isFake || false,
            }));
            
            const newPlayer: Player = {
                ...state.player,
                cash: state.player.cash - totalPrice,
                inventory: [...state.player.inventory, ...newItems]
            };
            
            // Update stock
            const updatedSneaker = { ...sneakerInMarket, quantity: sneakerInMarket.quantity - quantity };
            const updatedSneakers = [...currentMarket.sneakers];
            updatedSneakers[sneakerIndex] = updatedSneaker;
            
            const updatedMarkets = {
                ...state.markets,
                [state.currentCityId]: {
                    ...currentMarket,
                    sneakers: updatedSneakers,
                },
            };
            
            const sneakerName = SNEAKERS.find(s=>s.id === sneakerId)?.name;
            const purchaseMessage = quantity > 1
                ? `Purchased ${quantity}x ${sneakerName}!`
                : `Purchased ${sneakerName}!`;

            return { 
                ...state, 
                player: newPlayer, 
                markets: updatedMarkets,
                notification: { message: purchaseMessage, type: 'success' } 
            };
        }

        case 'SELL_SNEAKER': {
            const { instanceId, price, securityLevel } = action.payload;
            const itemToSell = state.player.inventory.find(item => item.instanceId === instanceId);
            if (!itemToSell) return state;

            // --- LEGIT CHECK LOGIC ---
            if (itemToSell.isFake) {
                // Chance to catch = security level * 40% (Lvl 0=0%, Lvl 1=40%, Lvl 2=80%)
                const detectionChance = securityLevel * 0.4;
                const detected = Math.random() < detectionChance;

                if (detected) {
                    // BUSTED!
                    const fine = Math.round(price * 0.2); // Fine is 20% of the attempted sell price
                    return {
                        ...state,
                        player: {
                            ...state.player,
                            cash: Math.max(0, state.player.cash - fine), // Can't go negative? Maybe debt later.
                            inventory: state.player.inventory.filter(item => item.instanceId !== instanceId), // Item confiscated
                            stats: {
                                ...state.player.stats,
                                timesRobbed: state.player.stats.timesRobbed + 1, // Abuse this stat for now or add timesBusted
                            }
                        },
                        notification: { 
                            message: `AUTHENTICATION FAILED! The store confiscated your fake ${SNEAKERS.find(s => s.id === itemToSell.sneakerId)?.name} and fined you $${fine}.`, 
                            type: 'error' 
                        }
                    };
                }
            }

            // Successful Sale
            const profit = price - itemToSell.purchasePrice;
            const newPlayer: Player = {
                ...state.player,
                cash: state.player.cash + price,
                inventory: state.player.inventory.filter(item => item.instanceId !== instanceId),
                stats: {
                    ...state.player.stats,
                    totalProfit: state.player.stats.totalProfit + profit,
                    sneakersSold: state.player.stats.sneakersSold + 1,
                }
            };
            
            const sneakerName = SNEAKERS.find(s => s.id === itemToSell.sneakerId)?.name;
            return { 
                ...state, 
                player: newPlayer,
                notification: { message: `Sold ${sneakerName} for $${price}. Profit: $${profit}`, type: 'success' }
            };
        }

        case 'USE_STORAGE_ITEM': {
            const { itemId } = action.payload;
            const itemIndex = state.player.storage.findIndex(i => i.id === itemId && i.qty > 0);
            if (itemIndex === -1) {
                return { ...state, notification: { message: "Item not found!", type: 'error' } };
            }

            const item = state.player.storage[itemIndex];

            // An item must have a defined `effects` array to be usable.
            if (!item.effects || item.effects.length === 0) {
                return { ...state, notification: { message: `${item.name} has no effect.`, type: 'info' } };
            }

            const newStorage = [...state.player.storage];
            const newStatusEffects = [...state.player.statusEffects];
            const notifications: string[] = [];

            // Track statistics for "fun" items
            let newStats = { ...state.player.stats };
            if (item.id.includes('hummus')) {
                newStats.hummusEaten += 1;
            }

            // Determine which effects trigger based on their chance.
            const triggeredEffects = item.effects.filter(effect => Math.random() < effect.chance);

            triggeredEffects.forEach(effect => {
                switch (effect.type) {
                    case 'notification':
                        notifications.push(effect.payload.message!);
                        // Check specifically for gas/fart related messages to increment stat
                        if (effect.payload.message && (effect.payload.message.toLowerCase().includes('gassy') || effect.payload.message.toLowerCase().includes('foul wind'))) {
                            newStats.timesFarted += 1;
                        }
                        break;
                    case 'status_effect': {
                        const { statusId, durationHrs, description } = effect.payload;
                        const newEffect: StatusEffect = {
                            id: `status-${Date.now()}-${Math.random()}`,
                            statusId: statusId!,
                            description: description!,
                            expiresAt: Date.now() + durationHrs! * 60 * 60 * 1000,
                        };
                        newStatusEffects.push(newEffect);
                        notifications.push(`You are afflicted with: ${statusId}!`);
                        // Check for diarrhea status for fart/poop stats
                         if (statusId === 'diarrhea' || statusId === 'gassy') {
                            newStats.timesFarted += 1;
                        }
                        break;
                    }
                    case 'stat_change':
                        const value = effect.payload.value!;
                        notifications.push(`You feel a change... (${effect.payload.stat} ${value > 0 ? '+' : ''}${value})`);
                        break;
                }
            });

            // Update item quantity in storage
            const updatedItem = { ...item, qty: item.qty - 1 };
            if (updatedItem.qty > 0) {
                newStorage[itemIndex] = updatedItem;
            } else {
                newStorage.splice(itemIndex, 1);
            }

            // Determine the final notification message.
            let finalNotification: string;
            if (notifications.length > 0) {
                finalNotification = notifications.join(' ');
            } else {
                finalNotification = `You used ${item.name}, but nothing eventful happened.`;
            }
            
            return {
                ...state,
                player: {
                    ...state.player,
                    storage: newStorage,
                    statusEffects: newStatusEffects,
                    stats: newStats
                },
                notification: { message: finalNotification, type: 'info' }
            };
        }

        case 'BUY_STORAGE_ITEM': {
            const { itemId, price } = action.payload;
            if (state.player.cash < price) {
                return { ...state, notification: { message: "Not enough cash!", type: 'error' } };
            }

            const itemMaster = storageMock.find(i => i.id === itemId);
            if (!itemMaster) {
                return { ...state, notification: { message: "Item not available.", type: 'error' } };
            }

            const existingItemIndex = state.player.storage.findIndex(i => i.id === itemId);
            const newStorage = [...state.player.storage];
            let newStats = { ...state.player.stats };

            if (existingItemIndex > -1) {
                const existingItem = newStorage[existingItemIndex];
                if (existingItem.stackable) {
                    newStorage[existingItemIndex] = { ...existingItem, qty: existingItem.qty + 1 };
                } else {
                    return { ...state, notification: { message: `You can only carry one ${itemMaster.name}.`, type: 'info' } };
                }
            } else {
                newStorage.push({ ...itemMaster, qty: 1, addedAgo: 'Just now' });
            }

            if (itemId === 'itm-burekas') {
                newStats.moneyWastedOnBurekas += price;
            }

            return {
                ...state,
                player: {
                    ...state.player,
                    cash: state.player.cash - price,
                    storage: newStorage,
                    stats: newStats
                },
                notification: { message: `Bought ${itemMaster.name}.`, type: 'success' },
            };
        }
        
        case 'SET_NOTIFICATION':
            return { ...state, notification: action.payload };

        case 'START_INTERACTION':
            return {
                ...state,
                activeInteraction: {
                    npcId: action.payload.npcId,
                    scenarioId: action.payload.scenarioId,
                    currentNodeId: 'intro' 
                }
            };

        case 'PROGRESS_INTERACTION':
            if (!state.activeInteraction) return state;
            return {
                ...state,
                activeInteraction: {
                    ...state.activeInteraction,
                    currentNodeId: action.payload.nextNodeId
                }
            };
        
        case 'END_INTERACTION':
            if (state.pendingTravelEvent) {
                return {
                    ...state,
                    activeInteraction: null,
                    pendingTravelEvent: null,
                    notification: { message: `Arrived in ${CITIES.find(c => c.id === state.currentCityId)?.name}. Day ${state.day}.`, type: 'info' }
                };
            }
            return { ...state, activeInteraction: null };
        
        case 'SHOW_NEWS_ITEM':
            return { ...state, activeNewsItem: action.payload };
        
        case 'HIDE_NEWS_ITEM':
            return { ...state, activeNewsItem: null };

        case 'APPLY_MARKET_SIGNAL':
            if (state.activeMarketSignals.some(s => s.id === action.payload.id)) {
                return state;
            }
            return {
                ...state,
                activeMarketSignals: [...state.activeMarketSignals, action.payload]
            };
        
        case 'CLEAR_TRAVEL_EVENT':
            return {
                ...state,
                pendingTravelEvent: null,
            };

        case 'UPDATE_STAT':
            const { stat, value, mode } = action.payload;
            const currentVal = state.player.stats[stat];
            const newVal = mode === 'add' ? currentVal + value : value;
            return {
                ...state,
                player: {
                    ...state.player,
                    stats: {
                        ...state.player.stats,
                        [stat]: newVal
                    }
                }
            };

        default:
            return state;
    }
};

const initialState: GameState = {
    player: {
        ...INITIAL_PLAYER,
        storage: storageMock, 
    },
    currentCityId: INITIAL_CITY_ID,
    day: INITIAL_DAY,
    currentScreen: Screen.Dashboard,
    markets: generateInitialMarkets(),
    notification: null,
    currentStoreId: null,
    activeInteraction: null,
    activeNewsItem: null,
    activeMarketSignals: [],
    pendingTravelEvent: null,
    currentAnalysisSneakerId: null,
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [gameState, dispatch] = useReducer(gameReducer, initialState);

    const changeScreen = useCallback((screen: Screen) => {
        dispatch({ type: 'CHANGE_SCREEN', payload: screen });
    }, []);

    const buySneaker = useCallback((sneakerId: string, price: number, quantity: number, isFake?: boolean) => {
        dispatch({ type: 'BUY_SNEAKER', payload: { sneakerId, price, quantity, isFake }});
    }, []);

    const sellSneaker = useCallback((instanceId: string, price: number) => {
        // Get the current store's security level if we are in a store
        let securityLevel = 2; // Default to high security (StockX/Online) if not in a specific store
        if (gameState.currentStoreId) {
            const config = STORE_CONFIGS[gameState.currentStoreId];
            if (config) {
                securityLevel = config.behavior.securityLevel;
            }
        }

        dispatch({ type: 'SELL_SNEAKER', payload: { instanceId, price, securityLevel } });
    }, [gameState.currentStoreId]);
    
    const useStorageItem = useCallback((itemId: string) => {
        dispatch({ type: 'USE_STORAGE_ITEM', payload: { itemId } });
    }, []);

    const buyStorageItem = useCallback((itemId: string, price: number) => {
        dispatch({ type: 'BUY_STORAGE_ITEM', payload: { itemId, price } });
    }, []);

    const travel = useCallback((cityId: string) => {
        dispatch({ type: 'TRAVEL', payload: { cityId } });
    }, []);

    const selectStore = useCallback((storeId: string) => {
        dispatch({ type: 'SELECT_STORE', payload: { storeId } });
    }, []);

    const viewMarketAnalysis = useCallback((sneakerId: string) => {
        dispatch({ type: 'VIEW_MARKET_ANALYSIS', payload: { sneakerId }});
    }, []);

    const startInteraction = useCallback((npcId: string, scenarioId: string) => {
        dispatch({ type: 'START_INTERACTION', payload: { npcId, scenarioId }});
    }, []);
    
    useEffect(() => {
        if (gameState.notification) {
            const timer = setTimeout(() => {
                dispatch({ type: 'SET_NOTIFICATION', payload: null });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [gameState.notification]);

    return React.createElement(
        GameContext.Provider,
        {
            value: {
                gameState,
                dispatch,
                changeScreen,
                buySneaker,
                sellSneaker,
                useStorageItem,
                buyStorageItem,
                travel,
                selectStore,
                viewMarketAnalysis,
                startInteraction,
            },
        },
        children
    );
};

export const useGame = (): GameContextType => {
    const context = useContext(GameContext);
    if (context === undefined) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};
