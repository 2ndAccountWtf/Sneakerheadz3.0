
import { RUMOR_TEMPLATES } from '../data/rumors';
import { SNEAKERS } from '../data/sneakers';
import type { ActiveRumor, RumorTemplate } from '../types/rumors';
import { rngFor, shuffled } from '../utils/rng';

const MAX_RUMORS_PER_DAY = 5;
const MIN_RUMORS_PER_DAY = 3;

export interface RumorWithContext extends ActiveRumor {
    potentialEffect?: RumorTemplate['potentialEffect'];
    sneakerTargetId?: string;
}

/**
 * Rumours are seeded on city + day, so the same city on the same day tells you
 * the same thing however you got there — the dashboard, the travel screen and
 * the city feed all call this, and intel that disagreed with itself depending
 * on which screen you read it from would be worse than no intel at all.
 *
 * The cache in front of it is now only a cache. It used to be the *only* thing
 * making rumours stable, which meant they survived exactly as long as the page
 * did and a new run inherited the previous run's day-1 gossip. Seeded
 * generation makes it a pure memo, so clearing it is safe and never clearing
 * it is merely wasteful.
 */
const contextCache = new Map<string, RumorWithContext[]>();

/** Call when a new run begins, so day 1 is not the last run's day 1. */
export function clearRumorCache(): void {
    contextCache.clear();
}

export function generateRumorsForCity(cityId: string, day: number): RumorWithContext[] {
    const cacheKey = `${cityId}-day${day}`;
    if (contextCache.has(cacheKey)) {
        return contextCache.get(cacheKey)!;
    }

    const cityRumorTemplates = RUMOR_TEMPLATES.filter(r => r.cityIds.includes(cityId));
    if (cityRumorTemplates.length === 0) {
        contextCache.set(cacheKey, []);
        return [];
    }

    const rng = rngFor(`rumors-${cityId}-day${day}`);
    const numRumors = Math.floor(rng() * (MAX_RUMORS_PER_DAY - MIN_RUMORS_PER_DAY + 1)) + MIN_RUMORS_PER_DAY;
    // Fisher-Yates, not `sort(() => 0.5 - Math.random())`. The sort looks like
    // a shuffle and is not one: measured over twelve templates picking four,
    // the first template came up 1.35x as often as it should and the ninth
    // 0.79x — a 1.7x gap, which in practice meant the rumours written last
    // were the rumours nobody ever read.
    const todaysTemplates = shuffled(cityRumorTemplates, rng).slice(0, numRumors);

    const generatedRumors: RumorWithContext[] = todaysTemplates.map((template, index) => {
        const isTelAviv = cityId === 'tel-aviv';
        const truthChance = isTelAviv ? 0.85 : 0.5;
        const isTrue = rng() < truthChance;

        let populatedText = template.text;
        let sneakerTargetId: string | undefined = undefined;

        if (template.text.includes('{sneaker_name}') || template.text.includes('{sneaker_rarity}')) {
            const randomSneaker = SNEAKERS[Math.floor(rng() * SNEAKERS.length)];
            sneakerTargetId = randomSneaker.id;
            populatedText = populatedText
                .replace('{sneaker_name}', randomSneaker.name)
                .replace('{sneaker_rarity}', randomSneaker.rarity);
        }

        const hour = 8 + index * 2;
        const timestamp = `Day ${day}, ${hour}:00`;

        return {
            id: `rumor-${day}-${template.id}`,
            text: populatedText,
            type: template.type,
            isTrue,
            timestamp,
            potentialEffect: template.potentialEffect,
            sneakerTargetId: sneakerTargetId,
        };
    });

    contextCache.set(cacheKey, generatedRumors);
    return generatedRumors;
}
