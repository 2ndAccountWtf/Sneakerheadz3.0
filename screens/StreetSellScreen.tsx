import React, { useMemo, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import type { InventoryItem, Player } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { CITIES } from '../data/cities';
import { SNEAKERS } from '../data/sneakers';
import { getCityMarketPrice } from '../systems/pricing';
import { MAX_HEAT } from '../constants';
import { spotsIn, isSpotOpen, isEventSpot, type SellingSpot } from '../data/sellingSpots';
import { generateBuyer, interestedIn, arrivalChance } from '../systems/street/buyers';
import {
    arriveAtSpot, openingOffer, counterOffer, acceptOffer, walkAway, resolveSale,
    acceptChance, shutdownChance, type StreetNegotiation,
} from '../systems/street/selling';
import type { StreetBuyer, BuyerKind } from '../types/hype';
import { activeHypeEvent } from '../systems/events/hypeCalendar';
import { streetBustChance } from '../systems/police/bust';

/**
 * Street selling.
 *
 * The reducer does not yet own any of this — `hooks/useGame.ts` is another
 * agent's file. `RESOLVE_STREET_SALE` (payload `{ player, log }`, identical
 * shape to the existing `RESOLVE_COLLECTOR_DEAL`) is the one action it needs
 * to add; everything up to that point — which spot, who walks up, the
 * haggling, the risk check — is computed here and in
 * `systems/street/{buyers,selling}.ts` and only touches global state once
 * per resolution, with a fully-formed `Player` already in hand. Until that
 * action exists in the reducer's `Action` union, dispatching it needs a
 * local cast (see the two `dispatch as any` calls below) — the dispatch
 * itself is otherwise a harmless no-op against the reducer's `default` case,
 * so nothing breaks in the meantime; it just doesn't persist yet.
 */
const pct = (n: number) => `${Math.round(n * 100)}%`;
const dots = (n: number, max = 5) => '●'.repeat(n) + '○'.repeat(max - n);

const KIND_LABEL: Record<BuyerKind, string> = { local: 'Local', international: 'Tourist', celebrity: 'Celebrity' };
const KIND_ICON: Record<BuyerKind, string> = { local: '\u{1F9CD}', international: '\u{1F6EB}', celebrity: '⭐' };

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

const StreetSellScreen: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const { currentCityId, day, player, outcomeLog } = gameState;

    const cityName = CITIES.find(c => c.id === currentCityId)?.name ?? 'here';
    const hype = useMemo(() => activeHypeEvent(day, currentCityId), [day, currentCityId]);
    const spots = useMemo(() => spotsIn(currentCityId, day), [currentCityId, day]);

    const [activeSpot, setActiveSpot] = useState<SellingSpot | null>(null);
    const [buyer, setBuyer] = useState<StreetBuyer | null>(null);
    const [checkedForBuyer, setCheckedForBuyer] = useState(false);
    const [negotiation, setNegotiation] = useState<StreetNegotiation | null>(null);
    const [ask, setAsk] = useState(0);
    const [showAllItems, setShowAllItems] = useState(false);

    const marketPriceFor = (item: InventoryItem) =>
        getCityMarketPrice(gameState, item.sneakerId) ?? SNEAKERS.find(s => s.id === item.sneakerId)?.basePrice ?? 0;

    // --- Post up at a spot: spends energy up front, win or lose. ---
    const post = (spot: SellingSpot) => {
        const result = arriveAtSpot(spot, player, day, isSpotOpen(spot, day));
        dispatch({ type: 'RESOLVE_STREET_SALE', payload: { player: result.player, log: result.log } });
        if (result.ok) {
            // The eyes on a spot now belong to somebody. `heatRate` only ever
            // decided how likely you were to be moved along, which is an
            // inconvenience rather than a consequence — so the choice this
            // whole screen is built around, busy-but-watched against
            // quiet-but-rich, never cost anything.
            if (Math.random() < streetBustChance(spot.heatRate, result.player, hype?.heatMultiplier ?? 1)) {
                dispatch({ type: 'START_BUST' });
                return;
            }
            setActiveSpot(spot);
            setBuyer(null);
            setNegotiation(null);
            setCheckedForBuyer(false);
        }
    };

    const leave = () => {
        setActiveSpot(null);
        setBuyer(null);
        setNegotiation(null);
        setCheckedForBuyer(false);
    };

    // --- Look up: either somebody's there, or the corner's quiet a while longer. ---
    const checkForBuyer = () => {
        if (!activeSpot) return;
        setCheckedForBuyer(true);
        if (Math.random() < arrivalChance(activeSpot, hype)) {
            setBuyer(generateBuyer(activeSpot, day, player, hype));
        } else {
            setBuyer(null);
        }
        setNegotiation(null);
    };

    // --- Showing them a pair costs nothing until a price is actually agreed. ---
    const showItem = (item: InventoryItem) => {
        if (!buyer) return;
        const market = marketPriceFor(item);
        const state = openingOffer(buyer, item, market);
        setNegotiation(state);
        setAsk(Math.round(state.currentOffer * 1.15));
    };

    const dismissBuyer = () => {
        setBuyer(null);
        setNegotiation(null);
        setCheckedForBuyer(false);
    };

    const settle = (state: StreetNegotiation) => {
        if (!activeSpot) return;
        const outcome = resolveSale(state, player, activeSpot, day, hype);
        dispatch({ type: 'RESOLVE_STREET_SALE', payload: { player: outcome.player, log: outcome.log } });
        setNegotiation(null);
        setBuyer(null);
        setCheckedForBuyer(false);
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

    const heatPct = Math.round((player.heat / MAX_HEAT) * 100);

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Working the Street in <span className="accent">{cityName}</span></>}
                subtitle="Better money than a trade counter. Nobody's watching your back but you."
                back={Screen.Dashboard}
            />

            {hype && (
                <div className="panel p-3 mb-3 flex items-center gap-2.5">
                    <span className="text-xl leading-none flex-shrink-0">{hype.icon}</span>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm text-white truncate">{hype.name}</div>
                        <div className="label truncate">Everyone's overpaying and everyone's watching. Prices and heat both run hot.</div>
                    </div>
                </div>
            )}

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

            <div className="panel p-3 mb-4 flex items-center gap-3">
                <span className="label flex-shrink-0">Heat</span>
                <div className="meter flex-1">
                    <i style={{ width: `${heatPct}%`, background: heatPct > 60 ? 'var(--bad)' : heatPct > 30 ? 'var(--warn)' : 'var(--ok)' }} />
                </div>
                <span className="numeric text-xs flex-shrink-0" style={{ color: 'var(--ink-dim)' }}>{heatPct}%</span>
            </div>

            {!activeSpot ? (
                <div className="space-y-3">
                    {spots.map(spot => {
                        const open = isSpotOpen(spot, day);
                        const credOk = spot.minCred === undefined || player.streetCred >= spot.minCred;
                        const energyOk = player.energy >= spot.energyCost;
                        const canPost = open && credOk && energyOk;

                        return (
                            <div key={spot.id} className="panel p-4">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="text-xl leading-none flex-shrink-0">{spot.icon}</span>
                                        <div className="min-w-0">
                                            <div className="font-display text-sm uppercase text-white truncate">{spot.name}</div>
                                            <div className="label">Footfall {dots(spot.footfall)}</div>
                                        </div>
                                    </div>
                                    <span className="numeric text-xs flex-shrink-0" style={{ color: 'var(--ink-dim)' }}>-{spot.energyCost} energy</span>
                                </div>

                                <p className="text-sm text-[var(--ink-dim)] leading-snug mb-2.5">{spot.blurb}</p>

                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {/* The event floor is the reason you flew here — say so. */}
                                    {isEventSpot(spot) && <span className="chip chip-accent">★ the event · on now</span>}
                                    <span className="chip">{Math.round(spot.buyerMix.local * 100)}% locals</span>
                                    <span className="chip">{Math.round(spot.buyerMix.international * 100)}% tourists</span>
                                    {spot.buyerMix.celebrity >= 0.15 && <span className="chip chip-accent">chance of ⭐ somebody famous</span>}
                                    <RiskChip label="Heat" value={spot.heatRate / 6} lowIsGood={false} />
                                    {spot.minCred !== undefined && (
                                        <span className={`chip ${credOk ? '' : 'chip-bad'}`}>needs {spot.minCred} cred</span>
                                    )}
                                </div>

                                {!open ? (
                                    <p className="text-sm text-[var(--ink-faint)] italic mb-1">{spot.closedLine ?? 'Closed right now.'}</p>
                                ) : (
                                    <button className="btn btn-primary w-full" disabled={!canPost} onClick={() => post(spot)}>
                                        {!credOk ? 'Not enough street cred' : !energyOk ? 'Too tired' : 'Post Up Here'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div>
                    <div className="crt-panel p-4 mb-3">
                        <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="min-w-0">
                                <div className="font-display text-sm uppercase text-white truncate">{activeSpot.icon} {activeSpot.name}</div>
                                <p className="label mt-1">{activeSpot.blurb}</p>
                            </div>
                            <button className="btn btn-ghost btn-sm flex-shrink-0" onClick={leave}>Leave</button>
                        </div>
                    </div>

                    {negotiation && buyer ? (
                        <NegotiationPanel
                            negotiation={negotiation}
                            buyer={buyer}
                            spot={activeSpot}
                            hype={hype}
                            player={player}
                            ask={ask}
                            setAsk={setAsk}
                            onCounter={onCounter}
                            onAccept={onAccept}
                            onWalk={onWalk}
                        />
                    ) : buyer ? (
                        <div className="panel p-4">
                            <div className="flex items-center gap-2.5 mb-2">
                                <span className="text-xl leading-none">{KIND_ICON[buyer.kind]}</span>
                                <div className="min-w-0">
                                    <div className="font-display text-sm uppercase text-white truncate">{buyer.name}</div>
                                    <div className="label">
                                        {KIND_LABEL[buyer.kind]}
                                        {buyer.homeCityId && ` · in from ${CITIES.find(c => c.id === buyer.homeCityId)?.name ?? buyer.homeCityId}`}
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm italic text-[var(--ink-dim)] mb-3">"{buyer.opener}"</p>

                            {player.inventory.length === 0 ? (
                                <p className="text-sm text-[var(--bad)] mb-2">Your bag is empty. Nothing to show them.</p>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="label">Show them</div>
                                        {player.inventory.some(i => interestedIn(buyer, i)) && (
                                            <button className="label underline" onClick={() => setShowAllItems(s => !s)}>
                                                {showAllItems ? 'show only what they want' : 'show everything'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-1.5 mb-3">
                                        {player.inventory
                                            .filter(i => showAllItems || interestedIn(buyer, i) || !player.inventory.some(x => interestedIn(buyer, x)))
                                            .map(item => {
                                                const sneaker = SNEAKERS.find(s => s.id === item.sneakerId);
                                                if (!sneaker) return null;
                                                const wanted = interestedIn(buyer, item);
                                                return (
                                                    <button
                                                        key={item.instanceId}
                                                        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-[var(--line)] hover:border-[var(--accent)] text-left"
                                                        onClick={() => showItem(item)}
                                                    >
                                                        <span className="text-sm truncate">
                                                            {sneaker.name}
                                                            {item.isFake && <span className="chip chip-bad ml-2">REPLICA</span>}
                                                            {!wanted && <span className="label ml-2">not what they're after</span>}
                                                        </span>
                                                        <span className="numeric text-sm flex-shrink-0" style={{ color: 'var(--ink-dim)' }}>
                                                            ~${marketPriceFor(item).toLocaleString()}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </>
                            )}

                            <button className="btn btn-ghost w-full" onClick={dismissBuyer}>Send them off</button>
                        </div>
                    ) : (
                        <div className="panel p-8 text-center">
                            <div className="text-3xl mb-2">{checkedForBuyer ? '\u{1F440}' : activeSpot.icon}</div>
                            <p className="text-[var(--ink-dim)] mb-4">
                                {checkedForBuyer ? "Nobody's stopped yet. Keep waiting, or try somewhere else." : "You're set up. See who walks by."}
                            </p>
                            <button className="btn btn-primary" onClick={checkForBuyer}>
                                {checkedForBuyer ? 'Keep Waiting' : 'See Who Stops'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            <p className="label text-center mt-5">
                No till, no cameras, no guarantee. Every sale is a stranger and every stranger is a risk.
            </p>
        </div>
    );
};

/** The back-and-forth itself: who's in front of you, what it's worth, what they're offering, and the risk of doing this at all. */
const NegotiationPanel: React.FC<{
    negotiation: StreetNegotiation;
    buyer: StreetBuyer;
    spot: SellingSpot;
    hype: ReturnType<typeof activeHypeEvent>;
    player: Player;
    ask: number;
    setAsk: (n: number) => void;
    onCounter: () => void;
    onAccept: () => void;
    onWalk: () => void;
}> = ({ negotiation, buyer, spot, hype, player, ask, setAsk, onCounter, onAccept, onWalk }) => {
    const { item, localValue, currentOffer, round, history } = negotiation;
    const sneaker = SNEAKERS.find(s => s.id === item.sneakerId);
    const odds = acceptChance(negotiation, ask);
    const shutdown = shutdownChance(spot, player, hype);

    return (
        <div className="crt-panel p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <div className="font-display text-sm uppercase text-white truncate">{buyer.name}</div>
                    <div className="label truncate">{sneaker?.name ?? 'that pair'} · worth here ~${localValue.toLocaleString()} · round {round}</div>
                </div>
                <span className="numeric text-lg flex-shrink-0" style={{ color: 'var(--accent)' }}>${currentOffer.toLocaleString()}</span>
            </div>

            <div className="mb-3 space-y-1 max-h-28 overflow-y-auto">
                {history.map((o, i) => (
                    <div key={i} className="flex items-center justify-between text-xs font-mono">
                        <span className="label">{o.by === 'buyer' ? buyer.name : 'You'}</span>
                        <span className="numeric" style={{ color: o.by === 'buyer' ? 'var(--ink-dim)' : 'var(--accent)' }}>${o.amount.toLocaleString()}</span>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
                <RiskChip label="They're trouble" value={buyer.danger} lowIsGood={false} />
                {item.isFake && <RiskChip label="They spot the fake" value={buyer.eye} lowIsGood={false} />}
                <RiskChip label="Shut down" value={shutdown} lowIsGood={false} />
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
                <button className="btn btn-accent" onClick={onCounter}>Counter ${Math.round(ask).toLocaleString()}</button>
                <button className="btn btn-ghost" onClick={onWalk}>Walk away</button>
            </div>
        </div>
    );
};

export default StreetSellScreen;
