import React, { useMemo, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import type { Player, InventoryItem } from '../types';
import type { OutcomeLogEntry } from '../types/game';
import ScreenHeader from '../components/ScreenHeader';
import { CITIES } from '../data/cities';
import { SNEAKERS } from '../data/sneakers';
import { getCityMarketPrice } from '../systems/pricing';
import {
    collectorsIn, interestedIn, standingWith, relationshipFactor,
    openingOffer, counterOffer, acceptOffer, walkAway, resolveDeal, acceptChance,
    robberyChance, counterfeitChance, fakeDetectChance,
    type NegotiationState,
} from '../systems/collectors';
import type { Collector } from '../data/collectors';

/**
 * Private sales.
 *
 * The reducer does not yet own any of this — `hooks/useGame.ts` is another
 * agent's file. `RESOLVE_COLLECTOR_DEAL` below is the one action the reducer
 * needs to add; everything up to that point (who's available, the haggling,
 * the risk check) is computed here with the pure functions in
 * `systems/collectors.ts` and only touches global state once, at the very
 * end, with a fully-formed Player already in hand — same shape as how
 * `USE_BATHROOM` hands off to `attemptBathroom`.
 */
const pickLine = (lines: string[], seed: number): string => lines[Math.abs(seed) % lines.length] ?? '';

const pct = (n: number) => `${Math.round(n * 100)}%`;

const riskTone = (n: number, lowIsGood: boolean): 'good' | 'warn' | 'bad' => {
    const t = lowIsGood ? n : 1 - n;
    if (t >= 0.65) return 'good';
    if (t >= 0.35) return 'warn';
    return 'bad';
};

const RiskChip: React.FC<{ label: string; value: number; lowIsGood: boolean }> = ({ label, value, lowIsGood }) => {
    const tone = riskTone(value, lowIsGood);
    const cls = tone === 'good' ? 'chip-accent' : tone === 'warn' ? 'chip-warn' : 'chip-bad';
    return <span className={`chip ${cls}`}>{label} {pct(value)}</span>;
};

const CollectorsScreen: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const { currentCityId, day, player, outcomeLog } = gameState;

    const cityName = CITIES.find(c => c.id === currentCityId)?.name ?? 'here';
    const collectors = useMemo(() => collectorsIn(currentCityId, player), [currentCityId, player]);

    const [expanded, setExpanded] = useState<string | null>(collectors[0]?.id ?? null);
    const [showAllItems, setShowAllItems] = useState(false);
    const [negotiation, setNegotiation] = useState<NegotiationState | null>(null);
    const [ask, setAsk] = useState<number>(0);

    const activeCollector: Collector | null = negotiation?.collector ?? null;

    const marketPriceFor = (item: InventoryItem) =>
        getCityMarketPrice(gameState, item.sneakerId) ?? SNEAKERS.find(s => s.id === item.sneakerId)?.basePrice ?? 0;

    const startNegotiation = (collector: Collector, item: InventoryItem) => {
        const market = marketPriceFor(item);
        const state = openingOffer(collector, item, market, player);
        setNegotiation(state);
        setAsk(Math.round(state.currentOffer * 1.15));
    };

    const settle = (state: NegotiationState) => {
        const outcome = resolveDeal(state, player, day);
        dispatch({ type: 'RESOLVE_COLLECTOR_DEAL', payload: { player: outcome.player, log: outcome.log } });
        setNegotiation(null);
    };

    const onCounter = () => {
        if (!negotiation) return;
        const next = counterOffer(negotiation, Math.max(1, Math.round(ask)));
        if (next.status === 'negotiating') {
            setNegotiation(next);
            setAsk(Math.round(next.currentOffer * 1.1));
        } else {
            settle(next);
        }
    };

    const onAccept = () => negotiation && settle(acceptOffer(negotiation));
    const onWalk = () => negotiation && settle(walkAway(negotiation));

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Private Buyers in <span className="accent">{cityName}</span></>}
                subtitle="Better money than the shop. Nobody is watching your back but you."
                back={Screen.Dashboard}
            />

            {outcomeLog.length > 0 && !negotiation && (
                <div className="panel mb-4 divide-y divide-[var(--line)]">
                    {outcomeLog.map((e, i) => (
                        <div
                            key={i}
                            className="flex items-start gap-2.5 px-3 py-2 text-xs font-mono"
                            style={{ color: e.tone === 'good' ? 'var(--ok)' : e.tone === 'bad' ? 'var(--bad)' : 'var(--ink-dim)' }}
                        >
                            <span>{e.icon}</span><span className="flex-1">{e.text}</span>
                        </div>
                    ))}
                </div>
            )}

            {negotiation && activeCollector ? (
                <NegotiationPanel
                    negotiation={negotiation}
                    ask={ask}
                    setAsk={setAsk}
                    onCounter={onCounter}
                    onAccept={onAccept}
                    onWalk={onWalk}
                    player={player}
                />
            ) : collectors.length === 0 ? (
                <div className="panel p-10 text-center">
                    <div className="text-4xl mb-3">🕵️</div>
                    <p className="text-[var(--ink-dim)]">Nobody worth trusting is buying here right now.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {collectors.map(collector => {
                        const isOpen = expanded === collector.id;
                        const standing = standingWith(player, collector.npcId);
                        const rel = relationshipFactor(player, collector.npcId);
                        const conn = player.connections[collector.npcId];

                        const eligible = player.inventory.filter(i => showAllItems || interestedIn(collector, i));
                        const items = eligible.length ? eligible : player.inventory;

                        return (
                            <div key={collector.id} className="panel">
                                <button
                                    className="panel-head w-full text-left"
                                    onClick={() => setExpanded(isOpen ? null : collector.id)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xl leading-none flex-shrink-0">{collector.icon}</span>
                                        <div className="min-w-0">
                                            <div className="font-display text-sm uppercase text-white truncate">{collector.name}</div>
                                            <div className="label truncate">
                                                {standing > 15 ? 'Trusts you' : standing < -15 ? 'Wary of you' : 'Knows your face'}
                                                {conn?.deals ? ` · ${conn.deals} deal${conn.deals === 1 ? '' : 's'} done` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="label flex-shrink-0">{isOpen ? '[ − ]' : '[ + ]'}</span>
                                </button>

                                {isOpen && (
                                    <div className="p-4">
                                        <p className="text-sm text-[var(--ink-dim)] leading-snug mb-3">{collector.blurb}</p>
                                        <p className="text-xs italic text-[var(--ink-faint)] mb-3">{collector.meetLine}</p>

                                        <div className="mb-3">
                                            <div className="label mb-1.5">Wants</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {collector.wantsRarities.map(r => (
                                                    <span key={r} className={`chip rarity-${r.toLowerCase()}`} style={{ borderColor: 'var(--rarity)', color: 'var(--rarity)' }}>{r}</span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <div className="label mb-1.5">Standing</div>
                                            <div className="meter mb-1">
                                                <i style={{ width: `${((standing + 100) / 200) * 100}%`, background: standing >= 0 ? 'var(--ok)' : 'var(--bad)' }} />
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                <RiskChip label="Eye" value={collector.eye} lowIsGood={false} />
                                                <RiskChip label="Trust" value={collector.trust} lowIsGood={true} />
                                                <RiskChip label="Danger" value={collector.danger} lowIsGood={false} />
                                            </div>
                                        </div>

                                        {player.inventory.length === 0 ? (
                                            <p className="text-sm text-[var(--bad)]">Your bag is empty. Nothing to bring them.</p>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="label">Bring them</div>
                                                    {eligible.length > 0 && eligible.length < player.inventory.length && (
                                                        <button className="label underline" onClick={() => setShowAllItems(s => !s)}>
                                                            {showAllItems ? 'show only what they want' : 'show everything'}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="space-y-1.5">
                                                    {items.map(item => {
                                                        const sneaker = SNEAKERS.find(s => s.id === item.sneakerId);
                                                        if (!sneaker) return null;
                                                        const wanted = interestedIn(collector, item);
                                                        const market = marketPriceFor(item);
                                                        return (
                                                            <button
                                                                key={item.instanceId}
                                                                className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-[var(--line)] hover:border-[var(--accent)] text-left"
                                                                onClick={() => startNegotiation(collector, item)}
                                                            >
                                                                <span className="text-sm truncate">
                                                                    {sneaker.name}
                                                                    {item.isFake && <span className="chip chip-bad ml-2">REPLICA</span>}
                                                                    {!wanted && <span className="label ml-2">not really their thing</span>}
                                                                </span>
                                                                <span className="numeric text-sm flex-shrink-0" style={{ color: 'var(--ink-dim)' }}>
                                                                    ~${market.toLocaleString()} retail
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}

                                        <p className="label mt-3">
                                            Relationship score {rel >= 0 ? '+' : ''}{Math.round(rel * 100)} — drives their opening number and their ceiling alike.
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="label text-center mt-5">
                No till, no cameras, no guarantee. Walking away costs you nothing but the trip.
            </p>
        </div>
    );
};

/** The back-and-forth itself: what's on the table, what it's likely worth accepting, and the exit that costs nothing. */
const NegotiationPanel: React.FC<{
    negotiation: NegotiationState;
    ask: number;
    setAsk: (n: number) => void;
    onCounter: () => void;
    onAccept: () => void;
    onWalk: () => void;
    player: Player;
}> = ({ negotiation, ask, setAsk, onCounter, onAccept, onWalk, player }) => {
    const { collector, item, marketPrice, currentOffer, round, history } = negotiation;
    const sneaker = SNEAKERS.find(s => s.id === item.sneakerId);
    const odds = acceptChance(negotiation, ask);
    const robbery = robberyChance(collector, Math.max(currentOffer, ask), player);
    const counterfeit = counterfeitChance(collector, player);
    const fakeCheck = item.isFake ? fakeDetectChance(collector, player) : null;

    return (
        <div className="crt-panel p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <div className="font-display text-sm uppercase text-white">{collector.name}</div>
                    <div className="label">{sneaker?.name ?? 'that pair'} · retail ~${marketPrice.toLocaleString()} · round {round}</div>
                </div>
                <span className="numeric text-lg" style={{ color: 'var(--accent)' }}>${currentOffer.toLocaleString()}</span>
            </div>

            <p className="text-sm italic text-[var(--ink-dim)] mb-3">
                {round === 1 ? pickLine(collector.lines.lowball, 0) : pickLine(collector.lines.counter, round)}
            </p>

            <div className="mb-3 space-y-1 max-h-28 overflow-y-auto">
                {history.map((o, i) => (
                    <div key={i} className="flex items-center justify-between text-xs font-mono">
                        <span className="label">{o.by === 'collector' ? collector.name : 'You'}</span>
                        <span className="numeric" style={{ color: o.by === 'collector' ? 'var(--ink-dim)' : 'var(--accent)' }}>${o.amount.toLocaleString()}</span>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
                <RiskChip label="Robbery" value={robbery} lowIsGood={false} />
                <RiskChip label="Counterfeit cash" value={counterfeit} lowIsGood={false} />
                {fakeCheck !== null && <RiskChip label="They spot your replica" value={fakeCheck} lowIsGood={false} />}
            </div>

            <div className="flex items-center gap-2 mb-3">
                <input
                    type="number"
                    className="flex-1 bg-[var(--bg-sunken)] border border-[var(--line)] px-3 py-2 text-sm font-mono text-[var(--ink)]"
                    value={ask}
                    min={1}
                    onChange={e => setAsk(Number(e.target.value))}
                />
                <span className="label whitespace-nowrap">~{pct(odds)} they take it</span>
            </div>

            <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={onAccept}>Take ${currentOffer.toLocaleString()}</button>
                <button className="btn btn-accent" onClick={onCounter}>Counter ${ask.toLocaleString()}</button>
                <button className="btn btn-ghost" onClick={onWalk}>Walk away</button>
            </div>

            <p className="label mt-3">{pickLine(collector.lines.greeting, item.instanceId.length)}</p>
        </div>
    );
};

export default CollectorsScreen;
