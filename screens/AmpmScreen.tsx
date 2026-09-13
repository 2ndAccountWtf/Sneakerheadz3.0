import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen, AmpmItem } from '../types';
import { AMPM_ITEMS } from '../data/ampmItems';
import ScreenHeader from '../components/ScreenHeader';
import Img from '../components/Img';
import { useAmpmWorker } from '../hooks/useAmpmWorker';
import { ampmGreeting, ampmChatter, ampmWeaponsTalk, ampmAfterPurchase } from '../data/ampm/dialogue';
import { isPartyMode, rollAmpmEvent, AMPM_EVENT_CHANCE, AMPM_PARTY_EVENT_CHANCE } from '../systems/events/ampmEvents';
import { priceFor, paymentBlocked, type PaymentMethod } from '../systems/payment';
import { shelfFor, isWeaponItem } from '../systems/ampm/stock';
import { AMPM_AISLE_ORDER, AMPM_AISLE_LABEL } from '../data/ampmItems';
import type { AmpmAisle } from '../types';

/** Filter pills: the nine real aisles, plus Weapons and an All. */
const FILTER_LABEL: Record<string, string> = { all: 'Everything', weapons: 'Weapons', ...AMPM_AISLE_LABEL };
const FILTER_ICON: Record<string, string> = {
    all: '\u{1F6D2}', weapons: '\u{1FA83}', food: '\u{1F957}', drinks: '\u{1F964}',
    bakery: '\u{1F956}', snacks: '\u{1F36B}', frozen: '\u{1F366}', household: '\u{1F9F4}',
    'personal-care': '\u{1F9FB}', specialty: '\u2728', questionable: '\u{1F440}',
};
import { cardUsable } from '../systems/banking';
import { CASH_DISCOUNT, CARD_SURCHARGE } from '../constants';

/**
 * The AM/PM. The clerk now actually talks — a greeting on entry, ambient
 * chatter as you browse, a line after every purchase — and the store can
 * descend into a 3am Tel Aviv rave, which comes with real discounts and real
 * consequences.
 */
const AmpmScreen: React.FC = () => {
    const { gameState, startInteraction, buyStorageItem, dispatch } = useGame();
    const { player, currentCityId, day } = gameState;
    const [selectedFilter, setSelectedFilter] = useState<AmpmAisle | 'all' | 'weapons'>('all');

    const worker = useAmpmWorker();
    const partyMode = useMemo(() => isPartyMode(currentCityId, day), [currentCityId, day]);

    const [line, setLine] = useState(() => ampmGreeting(currentCityId, partyMode));
    const [event, setEvent] = useState<null | { text: string; tone: 'good' | 'bad' | 'neutral' }>(null);
    const [method, setMethod] = useState<PaymentMethod>('cash');
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

    // The shelf, not the catalogue. Each branch carries fifteen-ish items —
    // staples it always has, a few that rotate, whatever is regional here, and
    // a weapon or two — with one to three sold out today. See
    // `systems/ampm/stock.ts` for why a shop that carries everything, every
    // day, is not a shop.
    const shelf = useMemo(() => shelfFor(currentCityId, gameState.day), [currentCityId, gameState.day]);

    // Filters are the real aisles, plus a Weapons pill derived from the weapons
    // registry rather than re-tagged by hand — an item is a weapon if you can
    // swing it at somebody, and `systems/weapons.ts` already knows.
    const filters = useMemo(() => {
        const present = new Set(shelf.map(e => e.item.aisle).filter(Boolean) as AmpmAisle[]);
        const aisles = AMPM_AISLE_ORDER.filter(a => present.has(a));
        const hasWeapons = shelf.some(e => isWeaponItem(e.item.id));
        return ['all' as const, ...(hasWeapons ? ['weapons' as const] : []), ...aisles];
    }, [shelf]);

    const activeFilter = filters.includes(selectedFilter) ? selectedFilter : 'all';

    const shown = useMemo(() => shelf.filter(e => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'weapons') return isWeaponItem(e.item.id);
        return e.item.aisle === activeFilter;
    }), [shelf, activeFilter]);


    const handleBuy = (item: AmpmItem) => {
        buyStorageItem(item.id, item.price, method);
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
                        <Img
                            fallback="🧍"
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

                {/* One till for the whole shop. Forty little cash/card pairs
                    would bury the products; a corner shop has one counter. */}
                <div className="panel p-3 mb-3 flex items-center gap-2">
                    <span className="label flex-shrink-0">Paying with</span>
                    <div className="flex items-center gap-1 flex-1">
                        <button
                            className={`btn btn-sm flex-1 ${method === 'cash' ? 'btn-accent' : 'btn-ghost'}`}
                            onClick={() => setMethod('cash')}
                        >
                            Cash −{Math.round((1 - CASH_DISCOUNT) * 100)}%
                        </button>
                        <button
                            className={`btn btn-sm flex-1 ${method === 'card' ? 'btn-accent' : 'btn-ghost'}`}
                            onClick={() => setMethod('card')}
                            disabled={!cardUsable(player, gameState.day)}
                        >
                            {cardUsable(player, gameState.day) ? `Card +${Math.round((CARD_SURCHARGE - 1) * 100)}%` : 'Card blocked'}
                        </button>
                    </div>
                </div>

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

                {/* Aisles. Only aisles with something on them today are offered,
                    so the filter row never sends you to an empty shelf. */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {filters.map(f => (
                        <button
                            key={f}
                            onClick={() => setSelectedFilter(f)}
                            className={`btn btn-sm ${activeFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            {FILTER_ICON[f] ?? '•'} {FILTER_LABEL[f] ?? f}
                        </button>
                    ))}
                </div>

                {/* Items */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {shown.map(({ item, inStock, reason }) => {
                        const sticker = partyMode ? Math.max(1, Math.round(item.price * 0.75)) : item.price;
                        const price = priceFor(sticker, method);
                        const afford = inStock && !paymentBlocked(player, method, price, gameState.day);
                        return (
                            <div
                                key={item.id}
                                className={`panel p-3 flex items-start justify-between gap-3 ${inStock ? '' : 'opacity-55'}`}
                            >
                                <div className="min-w-0">
                                    <h3 className={`text-sm font-semibold leading-tight ${inStock ? 'text-white' : 'text-[var(--ink-dim)] line-through'}`}>
                                        {item.name}
                                    </h3>
                                    <p className="text-xs text-[var(--ink-dim)] mt-1 leading-snug">{item.description}</p>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {inStock
                                            ? <span className="chip chip-warn">{item.effect}</span>
                                            : <span className="chip chip-bad">Sold out today</span>}
                                        {reason === 'regional' && <span className="chip chip-accent">Only here</span>}
                                        {reason === 'weapon' && <span className="chip">Swingable</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    <div className="text-right">
                                        {partyMode && inStock && <div className="text-[10px] line-through text-[var(--ink-faint)] numeric">${item.price}</div>}
                                        <div className={`numeric text-lg ${inStock ? 'text-[var(--ok)]' : 'text-[var(--ink-faint)] line-through'}`}>${price}</div>
                                    </div>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        disabled={!afford}
                                        onClick={() => handleBuy({ ...item, price: sticker })}
                                    >
                                        {inStock ? 'Buy' : 'Gone'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {shown.length === 0 && (
                    <div className="panel p-8 text-center text-[var(--ink-dim)]">Nothing on this shelf today.</div>
                )}

                <p className="label text-center mt-5">
                    Nothing you eat here has a fixed effect. That is the point.
                </p>
            </div>
        </div>
    );
};

export default AmpmScreen;
