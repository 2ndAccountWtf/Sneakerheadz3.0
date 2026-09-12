import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { useCityFeed } from '../hooks/useCityFeed';
import { CITIES } from '../data/cities';
import type { ActiveRumor } from '../types/rumors';

const TYPE_COLOR: Record<ActiveRumor['type'], string> = {
    News: 'var(--accent)',
    Gossip: 'var(--accent-2)',
    Sighting: 'var(--warn)',
    'Intel Drop': 'var(--ok)',
};

/**
 * Street Intel. Rumours here are not decoration — a true one applies a real
 * market signal (see useCityFeed), so this is the closest thing the game has
 * to a tip sheet. Roughly half of what you read is wrong.
 */
const CityFeedScreen: React.FC = () => {
    const { gameState } = useGame();
    const { feed } = useCityFeed();
    const cityName = CITIES.find(c => c.id === gameState.currentCityId)?.name;

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Street <span className="accent">Intel</span></>}
                subtitle={`${cityName} · Day ${gameState.day} · unverified`}
                back={Screen.Dashboard}
            />

            <div className="panel relative overflow-hidden">
                <div className="absolute inset-0 scanlines opacity-30 pointer-events-none" />
                {feed.length === 0 ? (
                    <div className="p-10 text-center font-mono text-sm text-[var(--ink-dim)]">
                        &gt; NO SIGNIFICANT TRAFFIC DETECTED<span className="animate-pulse">_</span>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--line)] relative">
                        {feed.map((rumor, i) => (
                            <div key={rumor.id} className="p-3 sm:p-4 flex gap-3 animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                                <div className="w-20 sm:w-24 flex-shrink-0">
                                    <div className="label leading-tight">{rumor.timestamp}</div>
                                    <div
                                        className="chip !text-[9px] !py-0 mt-1"
                                        style={{ borderColor: TYPE_COLOR[rumor.type], color: TYPE_COLOR[rumor.type] }}
                                    >
                                        {rumor.type}
                                    </div>
                                </div>
                                <p className="text-sm sm:text-base text-[var(--ink)] leading-snug flex-1">{rumor.text}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <p className="label text-center mt-4">
                Tel Aviv chatter is right about 85% of the time. Everywhere else it is a coin flip.
            </p>
        </div>
    );
};

export default CityFeedScreen;
