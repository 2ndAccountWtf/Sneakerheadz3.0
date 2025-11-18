import { MarketSignal } from './news';

export type RumorEffectType = 'marketSignal'; // Can be expanded later

export interface RumorEffectPayload_MarketSignal {
    effect: 'surge' | 'collapse';
    magnitude: number;
    durationHrs: number;
    target: {
        kind: 'model' | 'rarity';
        value: string;
    }
}

export interface RumorEffect {
    type: RumorEffectType;
    payload: RumorEffectPayload_MarketSignal;
}

export interface RumorTemplate {
    id: string;
    text: string; // e.g., "Heard {sneaker_name} is about to get a surprise restock."
    type: 'News' | 'Gossip' | 'Sighting' | 'Intel Drop';
    cityIds: string[];
    potentialEffect?: RumorEffect;
}

export interface ActiveRumor {
    id: string;
    text: string;
    type: 'News' | 'Gossip' | 'Sighting' | 'Intel Drop';
    isTrue: boolean; // For internal logic, not shown to player
    timestamp: string;
}
