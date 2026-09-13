import React, { useMemo } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen, PriceHistoryData } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { CITIES } from '../data/cities';
import { trendFor, localValue, bestAsk, relativeValue, intelConfidence, scarcityFor } from '../systems/market/simulate';
import { SNEAKERS } from '../data/sneakers';
import { useSneakerHistory } from '../hooks/useSneakerHistory';
import { calculateRSI } from '../utils/technicalAnalysis';
import { getCityMarketPrice, activeSignalsFor } from '../systems/pricing';

const UP = '#46e06a';
const DOWN = '#ff4747';
const AXIS = 'rgba(131,148,166,0.55)';
const GRID = 'rgba(34,48,64,0.9)';

const PriceChart: React.FC<{ data: PriceHistoryData[] }> = ({ data }) => {
    const W = 800, H = 260;
    const pad = { top: 12, bottom: 34, left: 48, right: 8 };

    if (data.length === 0) return null;

    const maxPrice = Math.max(...data.map(d => d.high));
    const minPrice = Math.min(...data.map(d => d.low));
    const maxVolume = Math.max(...data.map(d => d.volume));
    const span = maxPrice - minPrice || 1;

    const plotH = H - pad.top - pad.bottom;
    const volH = 26;
    const y = (p: number) => pad.top + (plotH - volH) * (1 - (p - minPrice) / span);
    const x = (i: number) => pad.left + i * (W - pad.left - pad.right) / data.length;
    const cw = Math.max(1.5, (W - pad.left - pad.right) / data.length * 0.66);

    const ticks = Array.from({ length: 5 }, (_, i) => minPrice + i * span / 4);

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Price history candlestick chart">
            {ticks.map(t => (
                <g key={t}>
                    <line x1={pad.left} y1={y(t)} x2={W - pad.right} y2={y(t)} stroke={GRID} />
                    <text x={pad.left - 8} y={y(t)} fill={AXIS} textAnchor="end" dominantBaseline="middle" fontSize="10" fontFamily="IBM Plex Mono, monospace">
                        ${Math.round(t).toLocaleString()}
                    </text>
                </g>
            ))}

            {/* Volume */}
            {data.map((d, i) => (
                <rect
                    key={`v${i}`}
                    x={x(i)}
                    y={H - pad.bottom - (d.volume / maxVolume) * volH}
                    width={cw}
                    height={(d.volume / maxVolume) * volH}
                    fill={d.close >= d.open ? UP : DOWN}
                    opacity="0.22"
                />
            ))}

            {/* Candles */}
            {data.map((d, i) => {
                const up = d.close >= d.open;
                const color = up ? UP : DOWN;
                const cx = x(i) + cw / 2;
                const bodyTop = up ? y(d.close) : y(d.open);
                const bodyH = Math.max(1, Math.abs(y(d.open) - y(d.close)));
                return (
                    <g key={i}>
                        <line x1={cx} y1={y(d.high)} x2={cx} y2={y(d.low)} stroke={color} strokeWidth="1" />
                        <rect x={x(i)} y={bodyTop} width={cw} height={bodyH} fill={color} />
                    </g>
                );
            })}
        </svg>
    );
};

const RsiChart: React.FC<{ data: PriceHistoryData[] }> = ({ data }) => {
    const W = 800, H = 90;
    const pad = { top: 8, bottom: 16, left: 48, right: 8 };

    const rsi = calculateRSI(data, 14);
    if (rsi.length === 0) return null;

    const x = (i: number) => pad.left + i * (W - pad.left - pad.right) / rsi.length;
    const y = (v: number) => pad.top + (H - pad.top - pad.bottom) * (1 - v / 100);

    let path = '';
    let started = false;
    rsi.forEach((v, i) => {
        if (isNaN(v)) return;
        path += `${started ? 'L' : 'M'}${x(i)},${y(v)}`;
        started = true;
    });

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Relative strength index">
            <rect x={pad.left} y={y(70)} width={W - pad.left - pad.right} height={y(30) - y(70)} fill="rgba(0,229,192,0.06)" />
            {[30, 70].map(t => (
                <g key={t}>
                    <line x1={pad.left} y1={y(t)} x2={W - pad.right} y2={y(t)} stroke={GRID} strokeDasharray="3 3" />
                    <text x={pad.left - 8} y={y(t)} fill={AXIS} textAnchor="end" dominantBaseline="middle" fontSize="10" fontFamily="IBM Plex Mono, monospace">{t}</text>
                </g>
            ))}
            <path d={path} fill="none" stroke="#00e5c0" strokeWidth="1.75" />
        </svg>
    );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex justify-between items-baseline py-1.5 border-b border-[var(--line)] text-sm">
        <span className="text-[var(--ink-dim)]">{label}</span>
        <span className="numeric text-[var(--ink)]">{children}</span>
    </div>
);


/**
 * Where to sell it.
 *
 * A persistent market with real city-by-city differences is worth nothing if
 * the player cannot see the differences, and worth too little if they can see
 * all of them at once. So this table shows what the player actually knows: the
 * city they are standing in is live, and every other city is whatever it looked
 * like on the day they last left it, with the age of that number stated
 * plainly.
 *
 * That turns a flight into two purchases — the shoes, and the information — and
 * makes a nine-day-old price a bet the player takes knowingly rather than a
 * number they were quietly misled by.
 */
/**
 * Thresholds set against the real spread rather than round numbers. City
 * affinities are compressed so that a model's relative value across the six
 * cities typically spans about 0.92 to 1.09 — so a 1.15 cutoff, which reads as
 * reasonable, labelled literally everything "middling interest" and told the
 * player nothing at all.
 */
const tasteLabel = (taste: number): string =>
    taste >= 1.1 ? 'this is their thing'
        : taste >= 1.04 ? 'pays up for this'
            : taste <= 0.9 ? 'actively unwanted here'
                : taste <= 0.97 ? 'not their thing'
                    : 'middling interest';

const WhereToSell: React.FC<{ sneakerId: string; here: number | undefined }> = ({ sneakerId, here }) => {
    const { gameState } = useGame();
    const { markets, marketIntel, currentCityId, day } = gameState;

    const rows = useMemo(() => CITIES.map(city => {
        const isHere = city.id === currentCityId;
        const intel = marketIntel[city.id];
        const price = isHere ? localValue(markets[city.id], sneakerId) : intel?.prices[sneakerId];
        const age = isHere ? 0 : intel ? day - intel.day : undefined;
        const confidence = isHere ? 1 : intelConfidence(intel, day);
        const margin = price !== undefined && here ? (price - here) / here : undefined;
        const sneaker = SNEAKERS.find(s => s.id === sneakerId);
        return {
            city,
            isHere,
            price,
            age,
            confidence,
            margin,
            // Taste is knowable without having been there — it is what the city
            // is famous for, not a number on a shelf. So this column is never
            // blanked out, and is the only hint a player gets about an unvisited
            // city.
            taste: sneaker ? relativeValue(sneaker, city.id) : 1,
            scarcity: isHere ? scarcityFor(markets[city.id], sneakerId) : undefined,
        };
    }).sort((a, b) => (b.price ?? -1) - (a.price ?? -1)), [markets, marketIntel, currentCityId, day, sneakerId, here]);

    return (
        <div className="panel">
            <div className="panel-head">
                <span className="label">Where to sell it</span>
                <span className="label">Prices you have seen</span>
            </div>
            <div className="divide-y divide-[var(--line)]">
                {rows.map(r => (
                    <div key={r.city.id} className="px-3 py-2 flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm text-[var(--ink)] truncate">{r.city.name}</span>
                                {r.isHere && <span className="chip chip-accent">here</span>}
                            </div>
                            <div className="label mt-0.5">
                                {r.isHere
                                    ? 'live'
                                    : r.age === undefined
                                        ? 'never been'
                                        : r.age === 0
                                            ? 'seen today'
                                            : `${r.age} day${r.age === 1 ? '' : 's'} old`}
                                {' · '}
                                {tasteLabel(r.taste)}
                            </div>
                            {/* Only for the city underfoot: stock is something you
                                can see on a shelf, not something you remember from
                                a trip nine days ago. */}
                            {r.isHere && r.scarcity?.note && (
                                <div
                                    className="label mt-0.5"
                                    style={{ color: r.scarcity.multiplier > 1.02 ? UP : 'var(--ink-faint)' }}
                                >
                                    {r.scarcity.note}
                                </div>
                            )}
                        </div>

                        <div className="text-right flex-shrink-0">
                            {r.price === undefined ? (
                                <span className="numeric text-sm text-[var(--ink-faint)]">—</span>
                            ) : (
                                <>
                                    <div
                                        className="numeric text-sm"
                                        style={{ color: r.confidence < 0.4 ? 'var(--ink-faint)' : 'var(--ink)' }}
                                    >
                                        ${r.price.toLocaleString()}
                                    </div>
                                    {r.margin !== undefined && !r.isHere && (
                                        <div
                                            className="numeric text-[11px]"
                                            style={{ color: r.margin > 0.02 ? UP : r.margin < -0.02 ? DOWN : 'var(--ink-faint)' }}
                                        >
                                            {r.margin > 0 ? '+' : ''}{Math.round(r.margin * 100)}% vs here
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <p className="px-3 py-2 label border-t border-[var(--line)]">
                Nothing here is live except the city you are in. An old number is a guess.
            </p>
        </div>
    );
};

/**
 * Model analysis. Same charts, retinted onto the shared palette, plus the two
 * pieces that were missing: which live market signals are acting on this model,
 * and — the one that makes the market a game rather than a decoration — what it
 * is worth in the other five cities as far as the player actually knows.
 */
const MarketAnalysisScreen: React.FC = () => {
    const { gameState, changeScreen } = useGame();
    const { currentAnalysisSneakerId, markets, currentCityId, activeMarketSignals, day } = gameState;

    const sneaker = SNEAKERS.find(s => s.id === currentAnalysisSneakerId);
    const history = useSneakerHistory(currentAnalysisSneakerId);

    const marketInfo = markets[currentCityId]?.sneakers.find(s => s.sneakerId === currentAnalysisSneakerId && !s.isFake);
    const livePrice = useMemo(
        () => (currentAnalysisSneakerId ? getCityMarketPrice(gameState, currentAnalysisSneakerId) : undefined),
        [gameState, currentAnalysisSneakerId],
    );

    const signals = useMemo(
        () => (sneaker ? activeSignalsFor(sneaker, activeMarketSignals, day) : []),
        [sneaker, activeMarketSignals, day],
    );

    const trend = useMemo(
        () => (currentAnalysisSneakerId ? trendFor(markets[currentCityId], currentAnalysisSneakerId) : undefined),
        [markets, currentCityId, currentAnalysisSneakerId],
    );

    // What it would cost to pick one up here, which is the number a margin has
    // to be measured against — not what a shop would pay you for it.
    const askHere = useMemo(
        () => (currentAnalysisSneakerId ? bestAsk(markets[currentCityId], currentAnalysisSneakerId) : undefined),
        [markets, currentCityId, currentAnalysisSneakerId],
    );

    if (!sneaker) {
        return (
            <div className="panel p-8 text-center">
                <p className="text-[var(--bad)] mb-4">No model selected.</p>
                <button className="btn" onClick={() => changeScreen(Screen.CityStores)}>Back to Shops</button>
            </div>
        );
    }

    const prev = history.length > 1 ? history[history.length - 2].close : undefined;
    const current = livePrice ?? history[history.length - 1]?.close ?? 0;
    const change = prev !== undefined ? current - prev : 0;
    const up = change >= 0;
    const rsiSeries = calculateRSI(history, 14);
    const rsiNow = rsiSeries.filter(v => !isNaN(v)).slice(-1)[0];

    return (
        <div className="pb-6">
            <ScreenHeader
                title={sneaker.name}
                subtitle={`${sneaker.rarity} · ${sneaker.id}`}
                back={Screen.CityStores}
                backLabel="Shops"
            />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
                <div className="space-y-4 min-w-0">
                    <div className="panel p-2 overflow-hidden">
                        <PriceChart data={history} />
                    </div>
                    <div className="panel p-2 overflow-hidden">
                        <div className="label pl-12 pb-1">RSI (14){rsiNow !== undefined ? ` — ${rsiNow.toFixed(0)}` : ''}</div>
                        <RsiChart data={history} />
                    </div>
                </div>

                <aside className="space-y-4">
                    <div className="panel p-3">
                        <div className="label">Here, right now</div>
                        <div className="numeric text-3xl mt-0.5" style={{ color: up ? UP : DOWN }}>
                            ${current.toLocaleString()}
                        </div>
                        <div className="numeric text-sm" style={{ color: up ? UP : DOWN }}>
                            {up ? '▲ +' : '▼ −'}${Math.abs(change).toLocaleString()} vs yesterday
                        </div>
                    </div>

                    {trend && (
                        <div className="panel p-3">
                            <div className="label">Trend here</div>
                            <div className="numeric text-sm mt-0.5" style={{ color: trend.direction === 'up' ? UP : trend.direction === 'down' ? DOWN : 'var(--ink-dim)' }}>
                                {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—'}{' '}
                                {Math.abs(trend.changePct).toFixed(1)}% overnight
                                {trend.running ? ' · still running' : ''}
                            </div>
                            <div className="label mt-1">
                                {trend.vsFairPct > 8
                                    ? `Trading ${Math.round(trend.vsFairPct)}% over what this city normally pays`
                                    : trend.vsFairPct < -8
                                        ? `Trading ${Math.round(-trend.vsFairPct)}% under what this city normally pays`
                                        : 'About what this city normally pays'}
                            </div>
                        </div>
                    )}

                    <WhereToSell sneakerId={sneaker.id} here={askHere ?? current} />

                    {signals.length > 0 && (
                        <div className="panel">
                            <div className="panel-head"><span className="label">Live Signals</span></div>
                            <div className="divide-y divide-[var(--line)]">
                                {signals.map(s => {
                                    const pct = Math.round((s.magnitude - 1) * 100);
                                    return (
                                        <div key={s.id} className="px-3 py-2">
                                            <div className="numeric text-sm" style={{ color: pct >= 0 ? UP : DOWN }}>
                                                {pct >= 0 ? '+' : ''}{pct}% · to day {s.expiresOnDay}
                                            </div>
                                            {s.label && <p className="text-[11px] text-[var(--ink-dim)] leading-snug mt-0.5">{s.label}</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="panel p-3">
                        <div className="label mb-1.5">Fundamentals</div>
                        <Row label="Rarity">{sneaker.rarity}</Row>
                        <Row label="Volatility">{(sneaker.volatility * 100).toFixed(0)}%</Row>
                        <Row label="Base price">${sneaker.basePrice.toLocaleString()}</Row>
                        <Row label="On shelf here">{marketInfo?.quantity ?? 0}</Row>
                        <Row label="You own">{gameState.player.inventory.filter(i => i.sneakerId === sneaker.id).length}</Row>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default MarketAnalysisScreen;
