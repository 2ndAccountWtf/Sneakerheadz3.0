// Placeholder for PRNG and weighted choice helpers.

/**
 * Returns a random number between min and max (inclusive).
 */
export function random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Takes an array of items with weights and returns a randomly selected item.
 */
export function weightedChoice<T extends { weight: number }>(items: T[]): T | null {
    if (!items.length) {
        return null;
    }
    const totalWeight = items.reduce((acc, item) => acc + item.weight, 0);
    let randomPoint = Math.random() * totalWeight;

    for (const item of items) {
        if (randomPoint < item.weight) {
            return item;
        }
        randomPoint -= item.weight;
    }
    return items[items.length - 1];
}
