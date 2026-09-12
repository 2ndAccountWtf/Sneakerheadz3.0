import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen, AmpmItem } from '../types';
import { AMPM_ITEMS } from '../data/ampmItems';
import ScreenHeader from '../components/ScreenHeader';
import { useAmpmWorker } from '../hooks/useAmpmWorker';
import { ampmGreeting, ampmChatter, ampmWeaponsTalk, ampmAfterPurchase } from '../data/ampm/dialogue';
import { isPartyMode, rollAmpmEvent, AMPM_EVENT_CHANCE, AMPM_PARTY_EVENT_CHANCE } from '../systems/events/ampmEvents';

const CATEGORY_ICON: Record<string, string> = {
    'Food & Drinks': '🍔',
    'Tools & Gear': '🛠️',
    'Local Specialties': '✨',
};

/**
 * The AM/PM. The clerk now actually talks — a greeting on entry, ambient
 * chatter as you browse, a line after every purchase — and the store can
 * descend into a 3am Tel Aviv rave, which comes with real discounts and real
 * consequences.
 */
const AmpmScreen: React.FC = () => {
    const { gameState, startInteraction, buyStorageItem, dispatch } = useGame();
    const { player, currentCityId, day } = gameState;
    const [selectedCategory, setSelectedCategory] = useState<string>('Food & Drinks');

    const worker = useAmpmWorker();
    const partyMode = useMemo(() => isPartyMode(currentCityId, day), [currentCityId, day]);

    const [line, setLine] = useState(() => ampmGreeting(currentCityId, partyMode));
    const [event, setEvent] = useState<null | { text: string; tone: 'good' | 'bad' | 'neutral' }>(null);
    const enteredRef = useRef('');

    // Greeting + possible event on entry, once per city-day visit.
    useEffect(() => {
        const key = `${currentCityId}-${day}`;
        if (enteredRef.current === key) return;
        enteredRef.current = key;

        setLine(ampmGreeting(currentCityId, partyMode));

        if (Math.random() < (partyMode ? AMPM_PARTY_EVENT_CHANCE : AMPM_EVENT_CHANCE)) {
            const rolled = rollAmpmEvent(partyMode);
            setEvent({ text: rolled.text, tone: rolled.tone });
            if (rolled.outcomes.length) {
                dispatch({ type: 'APPLY_OUTCOMES', payload: { outcomes: rolled.outcomes, sourceName: 'AM/PM' } });
            }
        }

        // A scripted clerk scenario still fires occasionally on top of the banter.
        if (worker && worker.scenarios.length > 0 && Math.random() < 0.22) {
            const scenario = worker.scenarios[Math.floor(Math.random() * worker.scenarios.length)];
            startInteraction(worker.id, scenario.id);
        }
    }, [currentCityId, day, partyMode, worker, startInteraction, dispatch]);

    // Ambient chatter on a slow loop.
    useEffect(() => {
        const t = setInterval(() => setLine(ampmChatter(currentCityId, partyMode)), 9000);
        return () => clearInterval(t);
    }, [currentCityId, partyMode]);

    const availableItems = useMemo(
        () => AMPM_ITEMS.filter(item => !item.cities || item.cities.includes(currentCityId)),
        [currentCityId],
    );

    const groupedItems = useMemo(() => availableItems.reduce((acc, item) => {
        (acc[item.category] ||= []).push(item);
        return acc;
    }, {} as Record<string, AmpmItem[]>), [availableItems]);

    const categories = Object.keys(groupedItems);
    const activeCategory = categories.includes(selectedCategory) ? selectedCategory : categories[0];

    const handleBuy = (item: AmpmItem) => {
        buyStorageItem(item.id, item.price);
        setLine(item.category === 'Tools & Gear' ? ampmWeaponsTalk() : ampmAfterPurchase(partyMode));

        if (Math.random() < (partyMode ? AMPM_PARTY_EVENT_CHANCE : AMPM_EVENT_CHANCE) * 0.6) {
            const rolled = rollAmpmEvent(partyMode);
            setEvent({ text: rolled.text, tone: rolled.tone });
            if (rolled.outcomes.length) {
                dispatch({ type: 'APPLY_OUTCOMES', payload: { outcomes: rolled.outcomes, sourceName: 'AM/PM' } });
            }
        }
    };

    return (
        <div className={`pb-6 ${partyMode ? 'relative' : ''}`}>
            {partyMode && (
                <div
                    className="fixed inset-0 z-0 pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,46,136,0.18), transparent 60%)', animation: 'pulse-glow 1.4s ease-in-out infinite' }}
                />
            )}

            <div className="relative">
                <ScreenHeader
                    title={partyMode ? <>AM/PM <span className="accent">AFTER DARK</span></> : <>AM/<span className="accent">PM</span></>}
                    subtitle={partyMode ? 'The clerk has decided this is a nightclub now' : 'Snacks, gear, and questionably sourced hummus'}
                    back={Screen.Dashboard}
                />

                {/* Clerk */}
                {worker && (
                    <div className={`panel p-3 mb-3 flex items-start gap-3 ${partyMode ? 'border-[var(--accent-2)]' : ''}`}>
                        <img
                            src={worker.portraitUrl}
                            alt={worker.name}
                            className="w-14 h-14 object-cover border border-[var(--line-bright)] flex-shrink-0 saturate-50"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="label">On duty</span>
                                <span className="text-sm font-semibold text-white">{worker.name}</span>
                                {partyMode && <span className="chip chip-bad animate-pulse">🔊 MUSIC AT MAXIMUM</span>}
                            </div>
                            <p className="text-sm text-[var(--ink)] mt-1 leading-snug italic">“{line}”</p>
                        </div>
                        {worker.scenarios.length > 0 && (
                            <button
                                className="btn btn-ghost btn-sm flex-shrink-0"
                                onClick={() => startInteraction(worker.id, worker.scenarios[Math.floor(Math.random() * worker.scenarios.length)].id)}
                            >
                                Talk
                            </button>
                        )}
                    </div>
                )}

                {/* Ambient event */}
                {event && (
                    <div
                        className="panel p-3 mb-3 flex items-start gap-2.5 animate-rise"
                        style={{ borderColor: event.tone === 'good' ? 'var(--ok)' : event.tone === 'bad' ? 'var(--bad)' : 'var(--line-bright)' }}
                    >
                        <span className="flex-shrink-0">{event.tone === 'good' ? '✨' : event.tone === 'bad' ? '⚠️' : '👀'}</span>
                        <p className="text-sm flex-1" style={{ color: event.tone === 'good' ? 'var(--ok)' : event.tone === 'bad' ? 'var(--bad)' : 'var(--ink-dim)' }}>
                            {event.text}
                        </p>
                        <button className="label hover:text-white flex-shrink-0" onClick={() => setEvent(null)}>✕</button>
                    </div>
                )}

                {/* Categories */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`btn btn-sm ${activeCategory === category ? 'btn-primary' : ''}`}
                        >
                            {CATEGORY_ICON[category] ?? '•'} {category}
                        </button>
                    ))}
                </div>

                {/* Items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(groupedItems[activeCategory] ?? []).map(item => {
                        const price = partyMode ? Math.max(1, Math.round(item.price * 0.75)) : item.price;
                        const afford = player.cash >= price;
                        return (
                            <div key={item.id} className="panel p-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-white leading-tight">{item.name}</h3>
                                    <p className="text-xs text-[var(--ink-dim)] mt-1 leading-snug">{item.description}</p>
                                    <span className="chip chip-warn mt-2">{item.effect}</span>
                                </div>
                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    <div className="text-right">
                                        {partyMode && <div className="text-[10px] line-through text-[var(--ink-faint)] numeric">${item.price}</div>}
                                        <div className="numeric text-lg text-[var(--ok)]">${price}</div>
                                    </div>
                                    <button className="btn btn-primary btn-sm" disabled={!afford} onClick={() => handleBuy(item)}>
                                        Buy
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {(groupedItems[activeCategory] ?? []).length === 0 && (
                    <div className="panel p-8 text-center text-[var(--ink-dim)]">Nothing in this section.</div>
                )}

                <p className="label text-center mt-5">
                    Nothing you eat here has a fixed effect. That is the point.
                </p>
            </div>
        </div>
    );
};

export default AmpmScreen;
