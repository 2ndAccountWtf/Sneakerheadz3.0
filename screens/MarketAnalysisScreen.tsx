import React, { useMemo } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen, PriceHistoryData } from '../types';
import ScreenHeader from '../components/ScreenHeader';
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
 * Model analysis. Same charts, retinted onto the shared palette, plus the piece
 * that was missing: which live market signals are acting on this model right
 * now and when they lapse.
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
