import { useMemo } from 'react';
import { ALL_CELEBRITIES } from '../data/celebrities';
import type { CelebrityProfile } from '../types/npcs';

export interface Tweet {
    id: string;
    authorName: string;
    authorId: string;
    content: string;
    timestamp: number;
}

// Helper to get a random element from an array
const getRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function useSocialFeed(count: number = 20): { tweets: Tweet[] } {
    const tweets = useMemo(() => {
        const generatedTweets: Tweet[] = [];

        if (ALL_CELEBRITIES.length === 0) {
            return [];
        }

        for (let i = 0; i < count; i++) {
            const celebrity = getRandom(ALL_CELEBRITIES);
            
            // Flatten all possible dialogue lines into a single array
            const allLines = Object.values(celebrity.dialogue).flat();

            if (allLines.length > 0) {
                const content = getRandom(allLines);
                generatedTweets.push({
                    id: `tweet-${Date.now()}-${i}`,
                    authorName: celebrity.name,
                    authorId: celebrity.id,
                    content: content,
                    // Simulate slightly different timestamps for sorting
                    timestamp: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 3), // Within last 3 hours
                });
            }
        }
        
        // Sort by most recent first
        return generatedTweets.sort((a, b) => b.timestamp - a.timestamp);

    }, [count]);

    return { tweets };
}