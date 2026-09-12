import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { CITIES } from '../data/cities';
import { generateSideQuest, MAX_ACTIVE_QUESTS } from '../systems/quests/questGenerator';

/**
 * Odd Jobs. Deliberately unglamorous: most of these pay in single digits and
 * the fun is finding out whether the junk you carried across four cities was
 * secretly worth five figures.
 */
const QuestsScreen: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const { quests, currentCityId, day, player } = gameState;

    const cityName = (id: string) => CITIES.find(c => c.id === id)?.name ?? id;

    const askAround = () => {
        if (quests.length >= MAX_ACTIVE_QUESTS) return;
        dispatch({ type: 'ADD_QUEST', payload: generateSideQuest(day, currentCityId) });
    };

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Odd <span className="accent">Jobs</span></>}
                subtitle={`${quests.length}/${MAX_ACTIVE_QUESTS} active · ${player.stats.questsCompleted} completed`}
                back={Screen.Stats}
                backLabel="Dossier"
                actions={
                    <button className="btn btn-sm" onClick={askAround} disabled={quests.length >= MAX_ACTIVE_QUESTS}>
                        Ask Around
                    </button>
                }
            />

            {quests.length === 0 ? (
                <div className="panel p-8 text-center">
                    <div className="text-4xl mb-3">🗺️</div>
                    <p className="text-[var(--ink-dim)] mb-1">Nobody needs anything from you right now.</p>
                    <p className="label mb-5">Which is, statistically, the best outcome.</p>
                    <button className="btn btn-primary" onClick={askAround}>Ask Around Anyway</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {quests.map(quest => {
                        const step = quest.steps[quest.stepIndex];
                        const here = step.cityId === currentCityId;
                        return (
                            <div key={quest.id} className="panel">
                                <div className="panel-head">
                                    <div className="min-w-0">
                                        <h3 className="font-display text-sm uppercase text-white truncate">{quest.title}</h3>
                                        <p className="label truncate">From {quest.giverName} · Day {quest.startedOnDay}</p>
                                    </div>
                                    <span className="chip flex-shrink-0">
                                        {quest.stepIndex + 1}/{quest.steps.length}
                                    </span>
                                </div>
                                <div className="p-4">
                                    <p className="text-sm text-[var(--ink-dim)] italic mb-4">{quest.blurb}</p>

                                    <div className="panel-raised p-3 mb-4">
                                        <div className="label mb-1">Next Lead — {cityName(step.cityId)}</div>
                                        <p className="text-sm text-[var(--ink)]">{step.prompt}</p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 mb-4">
                                        <span className="chip">Pays ${quest.rewardCash.toLocaleString()}</span>
                                        <span className="chip">+{quest.rewardCred} cred</span>
                                        {quest.rewardCash < 30 && <span className="chip chip-warn">Insulting</span>}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            className="btn btn-primary flex-1"
                                            disabled={!here}
                                            onClick={() => dispatch({ type: 'ADVANCE_QUEST', payload: { questId: quest.id } })}
                                        >
                                            {here
                                                ? quest.stepIndex + 1 >= quest.steps.length ? 'Hand It Over' : 'Follow The Lead'
                                                : `Go to ${cityName(step.cityId)}`}
                                        </button>
                                        <button
                                            className="btn btn-ghost"
                                            onClick={() => dispatch({ type: 'ABANDON_QUEST', payload: { questId: quest.id } })}
                                        >
                                            Drop
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default QuestsScreen;
