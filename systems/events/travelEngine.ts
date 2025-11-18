import { weightsConfig } from './weights.config';
import type { EventCategory, TravelEventStub } from './categories';

export type TravelContext = {
  fromCity: string;
  toCity: string;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  rng?: () => number; // injectable for tests (0..1)
};

export type TravelRollResult =
  | { kind: "none" }
  | { kind: "stub"; event: TravelEventStub };

interface WeightedItem {
    id: EventCategory;
    weight: number;
}

function weightedPick(items: readonly { id: string; weight: number }[], rng: () => number): { id: string; weight: number } {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) {
        // Fallback in case all weights are zeroed out
        return items[Math.floor(rng() * items.length)];
    }

    let randomPoint = rng() * totalWeight;

    for (const item of items) {
        if (randomPoint < item.weight) {
            return item;
        }
        randomPoint -= item.weight;
    }
    
    // This should not be reached if totalWeight > 0, but serves as a fallback
    return items[items.length - 1];
}

export function rollTravelEvent(ctx: TravelContext): TravelRollResult {
    const rng = ctx.rng || Math.random;
    const roll = rng() * 100;

    // 1. Check for no event
    if (roll < weightsConfig.global.noEventChance) {
        return { kind: "none" };
    }

    // 2. Check for rare event
    if (roll > weightsConfig.global.rareEventThreshold) {
        const pickedRare = weightedPick(weightsConfig.rare, rng);
        return {
            kind: "stub",
            event: {
                id: `stub-${pickedRare.id}`,
                category: pickedRare.id as EventCategory,
                rarity: "rare",
            },
        };
    }

    // 3. Standard event with bias calculation
    const cityBias = weightsConfig.bias.byCity[ctx.toCity] || {};
    const timeBias = weightsConfig.bias.byTime[ctx.timeOfDay] || {};

    let biasedCategories = weightsConfig.categories.map(category => {
        const baseWeight = category.weight;
        const cityModifier = cityBias[category.id] || 0;
        const timeModifier = timeBias[category.id] || 0;
        
        const effectiveWeight = Math.max(0, baseWeight + cityModifier + timeModifier);

        return { id: category.id as EventCategory, weight: effectiveWeight };
    });

    const totalEffectiveWeight = biasedCategories.reduce((sum, cat) => sum + cat.weight, 0);

    // Safety check: if all weights are biased to 0, use original weights
    if (totalEffectiveWeight <= 0) {
        biasedCategories = weightsConfig.categories.map(c => ({...c, id: c.id as EventCategory}));
    }

    const pickedCategory = weightedPick(biasedCategories, rng);
    
    return {
        kind: "stub",
        event: {
            id: `stub-${pickedCategory.id}`,
            category: pickedCategory.id as EventCategory,
            rarity: "standard",
        },
    };
}
