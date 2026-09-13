import { useMemo } from 'react';
import { useGame } from './useGame';
import { SoleNetPost, SoleNetDm } from '../types/social';
import { SOLE_NET_NPCS } from '../data/soleNetNpcs';
import { SOLE_NET_CELEBRITIES } from '../data/soleNetCelebrities';
import { SNEAKERS } from '../data/sneakers';
import { CITIES } from '../data/cities';

// Helper to get a random element from an array
const getRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Helper to populate template strings, if they are templates
const populateTemplate = (template: string, sneaker: (typeof SNEAKERS)[0], city: (typeof CITIES)[0]): string => {
    if (!template.includes('{')) {
        return template; // It's not a template, return as is
    }
    return template
        .replace('{sneaker_name}', sneaker.name)
        .replace('{sneaker_rarity}', sneaker.rarity)
        .replace('{city_name}', city.name);
};

const ALL_AUTHORS = [...SOLE_NET_NPCS, ...SOLE_NET_CELEBRITIES];

export function useSoleNet(postCount: number = 30, dmCount: number = 10) {
    const { gameState } = useGame();
    const { day, currentCityId } = gameState;
    const currentCity = CITIES.find(c => c.id === currentCityId)!;

    const { posts, dms } = useMemo(() => {
        const generatedPosts: SoleNetPost[] = [];
        const generatedDms: SoleNetDm[] = [];
        
        // --- Generate Posts ---
        for (let i = 0; i < postCount; i++) {
            const author = getRandom(ALL_AUTHORS);
            const sneaker = getRandom(SNEAKERS);
            let contentPool: string[] = [];
            let type: SoleNetPost['type'] = 'chatter';

            const rand = Math.random();
            if (author.type === 'insider' && author.messagePool.rumors.length > 0 && rand < 0.8) {
                contentPool = author.messagePool.rumors;
                type = 'rumor';
            } else if (author.type === 'bot' && rand < 0.9) {
                contentPool = author.messagePool.chatter;
                type = 'ad';
            } else {
                 contentPool = author.messagePool.chatter;
                 if (author.type === 'chaos-agent') type = 'chaos';
                 // Celebrities are often influencers but post chaotic content
                 if (['donald-drip', 'bro-jogan'].includes(author.id)) type = 'chatter';
            }

            if (contentPool.length > 0) {
                 generatedPosts.push({
                    id: `post-${day}-${i}`,
                    author,
                    content: populateTemplate(getRandom(contentPool), sneaker, currentCity),
                    type,
                    likes: Math.floor(Math.random() * 500),
                    reposts: Math.floor(Math.random() * 100),
                    timestamp: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 8), // Within last 8 hours
                });
            }
        }

        // --- Generate DMs ---
        for (let i = 0; i < dmCount; i++) {
            const sender = getRandom(ALL_AUTHORS.filter(npc => npc.messagePool.dms.length > 0));
            const sneaker = getRandom(SNEAKERS);
            let type: SoleNetDm['type'] = 'flavor';
            
            if (sender.type === 'insider') type = 'tip';
            if (sender.type === 'bot') type = 'scam';

            if (sender) {
                generatedDms.push({
                    id: `dm-${day}-${i}`,
                    sender,
                    messages: [{ text: populateTemplate(getRandom(sender.messagePool.dms), sneaker, currentCity), isPlayer: false }],
                    type,
                    isRead: Math.random() > 0.5,
                    timestamp: Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 3), // Within last 3 days
                });
            }
        }


        return { 
            posts: generatedPosts.sort((a, b) => b.timestamp - a.timestamp),
            dms: generatedDms.sort((a, b) => b.timestamp - a.timestamp)
        };

    }, [day, currentCityId, postCount, dmCount, currentCity]);

    return { posts, dms };
}
