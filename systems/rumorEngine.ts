
import { RUMOR_TEMPLATES } from '../data/rumors';
import { SNEAKERS } from '../data/sneakers';
import type { ActiveRumor, RumorTemplate } from '../types/rumors';

const MAX_RUMORS_PER_DAY = 5;
const MIN_RUMORS_PER_DAY = 3;

export interface RumorWithContext extends ActiveRumor {
    potentialEffect?: RumorTemplate['potentialEffect'];
    sneakerTargetId?: string;
}

const contextCache = new Map<string, RumorWithContext[]>();

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

    const numRumors = Math.floor(Math.random() * (MAX_RUMORS_PER_DAY - MIN_RUMORS_PER_DAY + 1)) + MIN_RUMORS_PER_DAY;
    const todaysTemplates = [...cityRumorTemplates].sort(() => 0.5 - Math.random()).slice(0, numRumors);

    const generatedRumors: RumorWithContext[] = todaysTemplates.map((template, index) => {
        const isTelAviv = cityId === 'tel-aviv';
        const truthChance = isTelAviv ? 0.85 : 0.5;
        const isTrue = Math.random() < truthChance;

        let populatedText = template.text;
        let sneakerTargetId: string | undefined = undefined;

        if (template.text.includes('{sneaker_name}') || template.text.includes('{sneaker_rarity}')) {
            const randomSneaker = SNEAKERS[Math.floor(Math.random() * SNEAKERS.length)];
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
