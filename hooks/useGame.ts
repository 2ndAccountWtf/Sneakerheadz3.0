import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { Screen } from '../types';
import type {
    GameState, Player, CityMarket, MarketSneaker, InventoryItem, StatusEffect, Cutscene,
} from '../types';
import type { ActiveInteractionState, ScenarioOutcome } from '../types/interactions';
import type { NewsItem, MarketSignal } from '../types/news';
import type { MiniGameRequest, OutcomeLogEntry, SideQuest } from '../types/game';
import {
    INITIAL_PLAYER, INITIAL_CITY_ID, INITIAL_DAY, MAX_INVENTORY_SIZE,
    MAX_HEALTH, MAX_ENERGY, TRAVEL_ENERGY_COST,
} from '../constants';
import { CITIES } from '../data/cities';
import { SNEAKERS } from '../data/sneakers';
import { rollTravelEvent, TravelContext } from '../systems/events/travelEngine';
import { resolveEventStub } from '../systems/events/eventResolver';
import { storageMock } from '../data/storage.mock';
import { STORE_CONFIGS } from '../data/storeConfigs';
import { STORES_BY_CITY } from '../data/stores';
import { applyOutcomes, expireBuffs, buffMultiplier } from '../systems/outcomes/outcomeEngine';
import { getSellPrice } from '../systems/pricing';
import { rollBibiEvent } from '../systems/events/bibiEvents';
import { rollNapEvent } from '../systems/events/napEvents';
import { findInteractionData } from '../data/npcs';
import { generateSideQuest, QUEST_OFFER_CHANCE, MAX_ACTIVE_QUESTS } from '../systems/quests/questGenerator';

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
    | { type: 'UPDATE_STAT'; payload: { stat: keyof Player['stats']; value: number; mode: 'add' | 'set' } }
    // --- Overhaul actions ---
    | { type: 'APPLY_OUTCOMES'; payload: { outcomes: ScenarioOutcome[]; sourceName?: string } }
    | { type: 'CLEAR_OUTCOME_LOG' }
    | { type: 'LAUNCH_MINIGAME'; payload: MiniGameRequest }
    | { type: 'RESOLVE_MINIGAME'; payload: { won: boolean; score?: number; note?: string } }
    | { type: 'CLOSE_MINIGAME' }
    | { type: 'SHOW_CUTSCENE'; payload: Cutscene }
    | { type: 'HIDE_CUTSCENE' }
    | { type: 'TAKE_NAP' }
    | { type: 'ADD_QUEST'; payload: SideQuest }
    | { type: 'ADVANCE_QUEST'; payload: { questId: string } }
    | { type: 'ABANDON_QUEST'; payload: { questId: string } };

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
    launchMiniGame: (req: MiniGameRequest) => void;
    takeNap: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const generateInitialMarkets = (): Record<string, CityMarket> => {
    const markets: Record<string, CityMarket> = {};

    CITIES.forEach(city => {
        const cityStores = STORES_BY_CITY[city.id] || [];
        const sneakers: MarketSneaker[] = [];

        cityStores.forEach(storeInfo => {
            const config = STORE_CONFIGS[storeInfo.id];
            if (!config) return;

            config.tabs.forEach(tab => {
                if (tab.id === 'trade' || tab.id === 'consignment') return;

                const isFakeTab = tab.inventoryGroupRef.includes('fakes') || tab.inventoryGroupRef.includes('backroom');

                const numModels = Math.floor(Math.random() * 6) + 3; // 3-8 items per tab
                const tabModels = [...SNEAKERS].sort(() => 0.5 - Math.random()).slice(0, numModels);

                tabModels.forEach(sneaker => {
                    const priceVariance = (Math.random() - 0.5) * sneaker.volatility * sneaker.basePrice;
                    let finalPrice = Math.round(sneaker.basePrice + priceVariance);

                    if (isFakeTab) {
                        finalPrice = Math.round(finalPrice * 0.15); // 15% of real value
                    }

                    const quantity = Math.floor(Math.random() * 5) + 1;

                    sneakers.push({
                        sneakerId: sneaker.id,
                        price: Math.max(1, finalPrice),
                        quantity,
                        group: tab.inventoryGroupRef,
                        isFake: isFakeTab,
                    });
                });
            });
        });

        if (sneakers.length === 0) {
            const storeModels = [...SNEAKERS].sort(() => 0.5 - Math.random()).slice(0, 10);
            storeModels.forEach(s => sneakers.push({
                sneakerId: s.id,
                price: s.basePrice,
                quantity: 5,
                group: 'general',
            }));
        }

        markets[city.id] = { cityId: city.id, sneakers };
    });
    return markets;
};

/** Shared helper: fold an ApplyResult back into game state. */
function withOutcomes(
    state: GameState,
    outcomes: ScenarioOutcome[] | undefined,
    sourceName?: string,
    appendLog = false,
): GameState {
    const result = applyOutcomes(state.player, outcomes, { day: state.day, sourceName });
    return {
        ...state,
        player: result.player,
        activeMarketSignals: [...state.activeMarketSignals, ...result.signals],
        outcomeLog: appendLog ? [...state.outcomeLog, ...result.log] : result.log,
        activeMiniGame: result.miniGame ?? state.activeMiniGame,
    };
}

const gameReducer = (state: GameState, action: Action): GameState => {
    switch (action.type) {
        case 'CHANGE_SCREEN': {
            const isLeavingStoreFlow = [Screen.Dashboard, Screen.Travel, Screen.Ampm, Screen.Inventory].includes(action.payload);
            const isLeavingAnalysis = action.payload !== Screen.MarketAnalysis;
            return {
                ...state,
                currentScreen: action.payload,
                currentStoreId: isLeavingStoreFlow ? null : state.currentStoreId,
                currentAnalysisSneakerId: isLeavingAnalysis ? null : state.currentAnalysisSneakerId,
            };
        }

        case 'SELECT_STORE':
            return { ...state, currentStoreId: action.payload.storeId, currentScreen: Screen.ShoeStore };

        case 'VIEW_MARKET_ANALYSIS':
            return { ...state, currentAnalysisSneakerId: action.payload.sneakerId, currentScreen: Screen.MarketAnalysis };

        case 'TRAVEL': {
            const newDay = state.day + 1;
            const newMarkets = generateInitialMarkets();
            const cityName = CITIES.find(c => c.id === action.payload.cityId)?.name;

            // Signals and buffs age out on the day boundary.
            const activeSignals = state.activeMarketSignals.filter(signal => signal.expiresOnDay > newDay);
            let player = expireBuffs(state.player, newDay);

            // Flying costs energy; with the tank empty it costs health instead.
            const energyCost = TRAVEL_ENERGY_COST;
            let fatigueNote = '';
            if (player.energy >= energyCost) {
                player = { ...player, energy: player.energy - energyCost };
            } else {
                const deficit = energyCost - player.energy;
                player = { ...player, energy: 0, health: Math.max(1, player.health - deficit) };
                fatigueNote = ' You arrive running on fumes.';
            }

            // Heat cools slowly while you're in transit.
            player = { ...player, heat: Math.max(0, player.heat - 5) };

            const timeOfDay = ['morning', 'afternoon', 'evening', 'night'][state.day % 4] as TravelContext['timeOfDay'];
            const context: TravelContext = {
                fromCity: state.currentCityId,
                toCity: action.payload.cityId,
                timeOfDay,
            };

            const baseNextState: GameState = {
                ...state,
                player,
                currentCityId: action.payload.cityId,
                day: newDay,
                markets: newMarkets,
                activeMarketSignals: activeSignals,
                pendingTravelEvent: null,
                outcomeLog: [],
            };

            // Bibi gift scenes and the ultra-rare collab outrank ordinary travel chaos.
            const bibiEvent = rollBibiEvent(player, newDay);
            if (bibiEvent) {
                const withEvent = withOutcomes(baseNextState, bibiEvent.outcomes, 'Bibi Neta');
                return {
                    ...withEvent,
                    currentScreen: Screen.Dashboard,
                    activeCutscene: { ...bibiEvent.cutscene, effects: withEvent.outcomeLog },
                    player: {
                        ...withEvent.player,
                        stats: {
                            ...withEvent.player.stats,
                            giftsFromBibi: withEvent.player.stats.giftsFromBibi + (bibiEvent.cutscene.kind === 'bibi-gift' ? 1 : 0),
                        },
                    },
                };
            }

            // A travel-safety buff can turn danger away entirely.
            const safety = buffMultiplier(player, 'travelSafety');
            const skipDanger = safety < 1 && Math.random() > safety;

            const eventResult = skipDanger ? { kind: 'none' as const } : rollTravelEvent(context);

            if (eventResult.kind === 'stub') {
                const resolvedEvent = resolveEventStub(eventResult.event, context);
                if (resolvedEvent) {
                    return {
                        ...baseNextState,
                        pendingTravelEvent: eventResult.event,
                        activeInteraction: {
                            npcId: resolvedEvent.npcId,
                            scenarioId: resolvedEvent.scenarioId,
                            currentNodeId: 'intro',
                        },
                        currentScreen: Screen.Dashboard,
                        notification: { message: `En route to ${cityName}... something happens.`, type: 'info' },
                    };
                }
            }

            // Nothing dramatic happened — somebody may still want an errand run.
            const offerQuest =
                state.quests.length < MAX_ACTIVE_QUESTS && Math.random() < QUEST_OFFER_CHANCE;

            if (offerQuest) {
                const quest = generateSideQuest(newDay, action.payload.cityId);
                return {
                    ...baseNextState,
                    quests: [...state.quests, quest],
                    currentScreen: Screen.Dashboard,
                    notification: { message: `${quest.giverName} wants a favour: ${quest.title}`, type: 'info' },
                };
            }

            return {
                ...baseNextState,
                currentScreen: Screen.Dashboard,
                notification: { message: `Arrived in ${cityName}. Day ${newDay}.${fatigueNote}`, type: 'info' },
            };
        }

        case 'BUY_SNEAKER': {
            const { sneakerId, price, quantity, isFake } = action.payload;
            const totalPrice = price * quantity;

            if (state.player.cash < totalPrice) {
                return { ...state, notification: { message: "Not enough cash!", type: 'error' } };
            }
            if (state.player.inventory.length + quantity > MAX_INVENTORY_SIZE) {
                return { ...state, notification: { message: "Inventory is full!", type: 'error' } };
            }

            const currentMarket = state.markets[state.currentCityId];
            const sneakerIndex = currentMarket.sneakers.findIndex(
                s => s.sneakerId === sneakerId && (isFake ? s.isFake : !s.isFake) && s.quantity >= quantity,
            );

            if (sneakerIndex === -1) {
                return { ...state, notification: { message: "Not enough in stock!", type: 'error' } };
            }
            const sneakerInMarket = currentMarket.sneakers[sneakerIndex];

            const newItems: InventoryItem[] = Array.from({ length: quantity }, (_, i) => ({
                instanceId: `item-${Date.now()}-${Math.random()}-${i}`,
                sneakerId,
                purchasePrice: price,
                isFake: isFake || false,
            }));

            // Buying counterfeits draws attention.
            const heatGain = isFake ? 8 : 0;

            const newPlayer: Player = {
                ...state.player,
                cash: state.player.cash - totalPrice,
                inventory: [...state.player.inventory, ...newItems],
                heat: Math.min(100, state.player.heat + heatGain * quantity),
            };

            const updatedSneakers = [...currentMarket.sneakers];
            updatedSneakers[sneakerIndex] = { ...sneakerInMarket, quantity: sneakerInMarket.quantity - quantity };

            const sneakerName = SNEAKERS.find(s => s.id === sneakerId)?.name;

            return {
                ...state,
                player: newPlayer,
                markets: {
                    ...state.markets,
                    [state.currentCityId]: { ...currentMarket, sneakers: updatedSneakers },
                },
                notification: {
                    message: quantity > 1 ? `Purchased ${quantity}x ${sneakerName}!` : `Purchased ${sneakerName}!`,
                    type: 'success',
                },
            };
        }

        case 'SELL_SNEAKER': {
            const { instanceId, securityLevel } = action.payload;
            const itemToSell = state.player.inventory.find(item => item.instanceId === instanceId);
            if (!itemToSell) return state;

            const price = getSellPrice(action.payload.price, itemToSell, state.player);
            const sneakerName = SNEAKERS.find(s => s.id === itemToSell.sneakerId)?.name;

            // --- LEGIT CHECK ---
            if (itemToSell.isFake) {
                // Heat makes staff suspicious on top of the store's own rigour.
                const detectionChance = Math.min(0.95, securityLevel * 0.4 + state.player.heat / 400);
                if (Math.random() < detectionChance) {
                    const fine = Math.round(price * 0.2);
                    return {
                        ...state,
                        player: {
                            ...state.player,
                            cash: Math.max(0, state.player.cash - fine),
                            inventory: state.player.inventory.filter(item => item.instanceId !== instanceId),
                            heat: Math.min(100, state.player.heat + 15),
                            streetCred: Math.max(0, state.player.streetCred - 3),
                            stats: { ...state.player.stats, timesRobbed: state.player.stats.timesRobbed + 1 },
                        },
                        notification: {
                            message: `AUTHENTICATION FAILED! They confiscated your fake ${sneakerName} and fined you $${fine}.`,
                            type: 'error',
                        },
                    };
                }
            }

            const profit = price - itemToSell.purchasePrice;
            // Big flips build a name for you.
            const credGain = profit > 500 ? 3 : profit > 150 ? 1 : 0;

            return {
                ...state,
                player: {
                    ...state.player,
                    cash: state.player.cash + price,
                    inventory: state.player.inventory.filter(item => item.instanceId !== instanceId),
                    streetCred: state.player.streetCred + credGain,
                    stats: {
                        ...state.player.stats,
                        totalProfit: state.player.stats.totalProfit + profit,
                        sneakersSold: state.player.stats.sneakersSold + 1,
                    },
                },
                notification: {
                    message: `Sold ${sneakerName} for $${price.toLocaleString()}. Profit: $${profit.toLocaleString()}${credGain ? ` (+${credGain} cred)` : ''}`,
                    type: profit >= 0 ? 'success' : 'error',
                },
            };
        }

        case 'USE_STORAGE_ITEM': {
            const { itemId } = action.payload;
            const itemIndex = state.player.storage.findIndex(i => i.id === itemId && i.qty > 0);
            if (itemIndex === -1) {
                return { ...state, notification: { message: "Item not found!", type: 'error' } };
            }

            const item = state.player.storage[itemIndex];

            if (!item.effects || item.effects.length === 0) {
                return { ...state, notification: { message: `${item.name} has no effect.`, type: 'info' } };
            }

            const newStorage = [...state.player.storage];
            const newStatusEffects = [...state.player.statusEffects];
            const log: OutcomeLogEntry[] = [];

            const newStats = { ...state.player.stats };
            if (item.id.includes('hummus')) newStats.hummusEaten += 1;

            let health = state.player.health;
            let energy = state.player.energy;

            // Luck tilts the odds of the pleasant outcomes landing.
            const luck = buffMultiplier(state.player, 'luck', 1) === 1 ? 0 : 0.15;
            const triggeredEffects = item.effects.filter(effect => Math.random() < effect.chance + (effect.type === 'stat_change' ? luck : 0));

            triggeredEffects.forEach(effect => {
                switch (effect.type) {
                    case 'notification':
                        log.push({ icon: '💬', text: effect.payload.message!, tone: 'neutral' });
                        if (effect.payload.message && /gassy|foul wind/i.test(effect.payload.message)) {
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
                        log.push({ icon: '🤢', text: `Afflicted with ${statusId}: ${description}`, tone: 'bad' });
                        if (statusId === 'diarrhea' || statusId === 'gassy') newStats.timesFarted += 1;
                        break;
                    }
                    case 'stat_change': {
                        const value = effect.payload.value!;
                        if (effect.payload.stat === 'health') {
                            health = Math.max(0, Math.min(MAX_HEALTH, health + value));
                            log.push({ icon: value > 0 ? '❤️' : '🩸', text: `${value > 0 ? '+' : ''}${value} Health`, tone: value > 0 ? 'good' : 'bad' });
                        } else {
                            energy = Math.max(0, Math.min(MAX_ENERGY, energy + value));
                            log.push({ icon: value > 0 ? '⚡' : '🥱', text: `${value > 0 ? '+' : ''}${value} Energy`, tone: value > 0 ? 'good' : 'bad' });
                        }
                        break;
                    }
                }
            });

            const updatedItem = { ...item, qty: item.qty - 1 };
            if (updatedItem.qty > 0) newStorage[itemIndex] = updatedItem;
            else newStorage.splice(itemIndex, 1);

            if (log.length === 0) {
                log.push({ icon: '😐', text: `You used ${item.name}. Nothing eventful happens.`, tone: 'neutral' });
            }

            return {
                ...state,
                player: {
                    ...state.player,
                    storage: newStorage,
                    statusEffects: newStatusEffects,
                    stats: newStats,
                    health,
                    energy,
                },
                outcomeLog: log,
                notification: { message: log.map(l => l.text).join(' '), type: 'info' },
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
            const newStats = { ...state.player.stats };

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

            if (itemId === 'itm-burekas') newStats.moneyWastedOnBurekas += price;

            return {
                ...state,
                player: {
                    ...state.player,
                    cash: state.player.cash - price,
                    storage: newStorage,
                    stats: newStats,
                },
                notification: { message: `Bought ${itemMaster.name}.`, type: 'success' },
            };
        }

        case 'SET_NOTIFICATION':
            return { ...state, notification: action.payload };

        case 'START_INTERACTION':
            return {
                ...state,
                outcomeLog: [],
                activeInteraction: {
                    npcId: action.payload.npcId,
                    scenarioId: action.payload.scenarioId,
                    currentNodeId: 'intro',
                },
            };

        case 'PROGRESS_INTERACTION': {
            if (!state.activeInteraction) return state;
            return {
                ...state,
                outcomeLog: [],
                activeInteraction: {
                    ...state.activeInteraction,
                    currentNodeId: action.payload.nextNodeId,
                },
            };
        }

        case 'APPLY_OUTCOMES':
            return withOutcomes(state, action.payload.outcomes, action.payload.sourceName);

        case 'CLEAR_OUTCOME_LOG':
            return { ...state, outcomeLog: [] };

        case 'END_INTERACTION': {
            // Don't dismiss the conversation out from under a mini-game it launched.
            if (state.activeMiniGame) return { ...state, activeInteraction: null };

            if (state.pendingTravelEvent) {
                return {
                    ...state,
                    activeInteraction: null,
                    pendingTravelEvent: null,
                    notification: {
                        message: `Arrived in ${CITIES.find(c => c.id === state.currentCityId)?.name}. Day ${state.day}.`,
                        type: 'info',
                    },
                };
            }
            return { ...state, activeInteraction: null };
        }

        case 'LAUNCH_MINIGAME':
            return { ...state, activeMiniGame: action.payload, outcomeLog: [] };

        case 'RESOLVE_MINIGAME': {
            const req = state.activeMiniGame;
            if (!req) return state;
            const { won } = action.payload;
            const outcomes = (won ? req.onWin : req.onLose) ?? [];

            const stripped = outcomes.map(o => ({ ...o, condition: undefined }));
            const next = withOutcomes(state, stripped, req.title);

            const stats = {
                ...next.player.stats,
                minigamesPlayed: next.player.stats.minigamesPlayed + 1,
                fightsWon: next.player.stats.fightsWon + (req.game === 'street-brawl' && won ? 1 : 0),
                fightsLost: next.player.stats.fightsLost + (req.game === 'street-brawl' && !won ? 1 : 0),
                boxesOpened: next.player.stats.boxesOpened + (req.game === 'mystery-box' ? 1 : 0),
            };

            return {
                ...next,
                player: { ...next.player, stats },
                activeMiniGame: null,
                notification: {
                    message: action.payload.note ?? (won ? 'You won.' : 'You lost.'),
                    type: won ? 'success' : 'error',
                },
            };
        }

        case 'CLOSE_MINIGAME':
            return { ...state, activeMiniGame: null };

        case 'SHOW_CUTSCENE':
            return { ...state, activeCutscene: action.payload };

        case 'HIDE_CUTSCENE':
            return { ...state, activeCutscene: null, outcomeLog: [] };

        case 'TAKE_NAP': {
            const nap = rollNapEvent(state.player, state.day);
            const rested = {
                ...state.player,
                energy: Math.min(MAX_ENERGY, state.player.energy + nap.energyRestored),
                health: Math.min(MAX_HEALTH, state.player.health + nap.healthRestored),
                stats: { ...state.player.stats, napsTaken: state.player.stats.napsTaken + 1 },
            };
            const withNap = withOutcomes({ ...state, player: rested }, nap.outcomes, 'A Nap');
            return {
                ...withNap,
                day: state.day + nap.daysLost,
                outcomeLog: [
                    { icon: '😴', text: nap.text, tone: nap.daysLost > 0 ? 'bad' : 'good' },
                    ...withNap.outcomeLog,
                ],
                notification: { message: nap.text, type: nap.daysLost > 0 ? 'error' : 'success' },
            };
        }

        case 'ADD_QUEST':
            if (state.quests.some(q => q.id === action.payload.id)) return state;
            return {
                ...state,
                quests: [...state.quests, action.payload],
                notification: { message: `New job: ${action.payload.title}`, type: 'info' },
            };

        case 'ADVANCE_QUEST': {
            const quest = state.quests.find(q => q.id === action.payload.questId);
            if (!quest) return state;

            const nextIndex = quest.stepIndex + 1;
            if (nextIndex < quest.steps.length) {
                return {
                    ...state,
                    quests: state.quests.map(q => q.id === quest.id ? { ...q, stepIndex: nextIndex } : q),
                    notification: { message: `${quest.title}: lead followed. One more stop.`, type: 'info' },
                };
            }

            // Completed. Roll for the joke-jackpot.
            const jackpot = Math.random() < quest.jackpotChance;
            const legendaries = SNEAKERS.filter(s => s.rarity === 'Legendary');
            const prize = legendaries[Math.floor(Math.random() * legendaries.length)];
            const canCarry = state.player.inventory.length < MAX_INVENTORY_SIZE;

            const inventory = jackpot && canCarry
                ? [...state.player.inventory, {
                    instanceId: `item-${Date.now()}-${Math.random()}`,
                    sneakerId: prize.id,
                    purchasePrice: 0,
                }]
                : state.player.inventory;

            return {
                ...state,
                quests: state.quests.filter(q => q.id !== quest.id),
                player: {
                    ...state.player,
                    cash: state.player.cash + quest.rewardCash,
                    streetCred: state.player.streetCred + quest.rewardCred,
                    inventory,
                    stats: { ...state.player.stats, questsCompleted: state.player.stats.questsCompleted + 1 },
                },
                outcomeLog: [
                    { icon: '✅', text: `${quest.title} complete.`, tone: 'good' },
                    { icon: '💵', text: `Reward: $${quest.rewardCash} and ${quest.rewardCred} cred. Yes, that's all.`, tone: quest.rewardCash < 20 ? 'neutral' : 'good' },
                    ...(jackpot && canCarry
                        ? [{ icon: '🌟', text: `Wait — it's an authentic ${prize.name}. Worth $${prize.basePrice.toLocaleString()}.`, tone: 'good' as const }]
                        : []),
                ],
                notification: {
                    message: jackpot && canCarry
                        ? `Quest complete — and the junk was a real ${prize.name}!`
                        : `Quest complete. You earned $${quest.rewardCash}.`,
                    type: 'success',
                },
            };
        }

        case 'ABANDON_QUEST':
            return {
                ...state,
                quests: state.quests.filter(q => q.id !== action.payload.questId),
                notification: { message: 'Job abandoned. Somebody is disappointed in you.', type: 'info' },
            };

        case 'SHOW_NEWS_ITEM':
            return { ...state, activeNewsItem: action.payload };

        case 'HIDE_NEWS_ITEM':
            return { ...state, activeNewsItem: null };

        case 'APPLY_MARKET_SIGNAL':
            if (state.activeMarketSignals.some(s => s.id === action.payload.id)) return state;
            return { ...state, activeMarketSignals: [...state.activeMarketSignals, action.payload] };

        case 'CLEAR_TRAVEL_EVENT':
            return { ...state, pendingTravelEvent: null };

        case 'UPDATE_STAT': {
            const { stat, value, mode } = action.payload;
            const currentVal = state.player.stats[stat];
            const newVal = mode === 'add' ? currentVal + value : value;
            return {
                ...state,
                player: { ...state.player, stats: { ...state.player.stats, [stat]: newVal } },
            };
        }

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
    outcomeLog: [],
    activeMiniGame: null,
    quests: [],
    activeCutscene: null,
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [gameState, dispatch] = useReducer(gameReducer, initialState);

    const changeScreen = useCallback((screen: Screen) => {
        dispatch({ type: 'CHANGE_SCREEN', payload: screen });
    }, []);

    const buySneaker = useCallback((sneakerId: string, price: number, quantity: number, isFake?: boolean) => {
        dispatch({ type: 'BUY_SNEAKER', payload: { sneakerId, price, quantity, isFake } });
    }, []);

    const sellSneaker = useCallback((instanceId: string, price: number) => {
        let securityLevel = 2; // Online/consignment default: rigorous
        if (gameState.currentStoreId) {
            const config = STORE_CONFIGS[gameState.currentStoreId];
            if (config) securityLevel = config.behavior.securityLevel;
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
        dispatch({ type: 'VIEW_MARKET_ANALYSIS', payload: { sneakerId } });
    }, []);

    const startInteraction = useCallback((npcId: string, scenarioId: string) => {
        // Guard against dialogue that doesn't exist — a missing scenario used to
        // open an empty modal and immediately tear it down.
        const { scenario } = findInteractionData(npcId, scenarioId);
        if (!scenario) return;
        dispatch({ type: 'START_INTERACTION', payload: { npcId, scenarioId } });
    }, []);

    const launchMiniGame = useCallback((req: MiniGameRequest) => {
        dispatch({ type: 'LAUNCH_MINIGAME', payload: req });
    }, []);

    const takeNap = useCallback(() => {
        dispatch({ type: 'TAKE_NAP' });
    }, []);

    useEffect(() => {
        if (gameState.notification) {
            const timer = setTimeout(() => {
                dispatch({ type: 'SET_NOTIFICATION', payload: null });
            }, 3600);
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
                launchMiniGame,
                takeNap,
            },
        },
        children,
    );
};

export const useGame = (): GameContextType => {
    const context = useContext(GameContext);
    if (context === undefined) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};
