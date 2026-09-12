import React from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';

/**
 * VAPORWAVE OUTLET — Harajuku.
 *
 * Symmetry, gradients and too much of everything: a setting sun with slats
 * behind a centred wordmark, a perspective grid running to the horizon, pill
 * tabs down the middle, and the stock in a staggered multi-column flow rather
 * than a tidy grid so the eye never lands twice in the same place.
 *
 * The stagger is CSS columns, which means it degrades to one honest column at
 * phone width instead of needing measurement or JS.
 */
const VaporwaveLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => (
    <StoreStage skin={skin} className="pb-8">
        <style>{`
            @keyframes vw-drift { from { background-position: 0 0 } to { background-position: 0 -160px } }
            @keyframes vw-shimmer { 0%,100% { filter: hue-rotate(0deg) } 50% { filter: hue-rotate(18deg) } }
            .vw-grid { animation: vw-drift 9s linear infinite; }
            .vw-shimmer { animation: vw-shimmer 8s ease-in-out infinite; }
        `}</style>

        {/* ---- HORIZON: sun with slats, then a grid floor running away from you ---- */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[340px] pointer-events-none overflow-hidden">
            <div
                className="absolute left-1/2 -translate-x-1/2 top-10 w-[300px] h-[300px] rounded-full opacity-80"
                style={{
                    background: `linear-gradient(180deg, ${skin.accent3 ?? '#ffd166'} 0%, ${skin.accent} 55%, ${alpha(skin.accent2, 0.2)} 100%)`,
                    maskImage: 'repeating-linear-gradient(to bottom, #000 0 14px, transparent 14px 22px)',
                    WebkitMaskImage: 'repeating-linear-gradient(to bottom, #000 0 14px, transparent 14px 22px)',
                    filter: 'blur(0.4px)',
                }}
            />
            <div
                className="vw-grid absolute -inset-x-1/4 bottom-0 h-[130px] opacity-60"
                style={{
                    backgroundImage: `repeating-linear-gradient(to right, ${alpha(skin.accent2, 0.5)} 0 1px, transparent 1px 46px),
                                      repeating-linear-gradient(to bottom, ${alpha(skin.accent2, 0.45)} 0 1px, transparent 1px 26px)`,
                    transform: 'perspective(220px) rotateX(64deg)',
                    transformOrigin: 'bottom',
                }}
            />
        </div>

        <StoreShell className="relative py-4 sm:py-6">
            {/* Exit kept on its own line so the centred stack below stays symmetrical */}
            <div className="flex justify-end mb-2">
                <ExitButton
                    onExit={onExit}
                    label="◂ LEAVE THE MALL"
                    className="btn btn-sm !rounded-full backdrop-blur-sm"
                    style={{ borderColor: skin.accent, color: '#fff', background: alpha(skin.accent2, 0.25) }}
                />
            </div>

            {/* ---- CENTRED STACK ---- */}
            <div className="text-center mb-5">
                <div className="label" style={{ color: '#fff', letterSpacing: '0.6em' }}>
                    {skin.motto ?? skin.label}
                </div>
                <h1
                    className="vw-shimmer uppercase mt-2 leading-[0.95] break-words"
                    style={{
                        fontFamily: 'var(--skin-title)',
                        fontSize: 'clamp(1.7rem, 9vw, 4.2rem)',
                        backgroundImage: `linear-gradient(180deg, #fff 0%, ${skin.accent3 ?? '#ffd166'} 35%, ${skin.accent} 70%, ${skin.accent2} 100%)`,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                        WebkitTextStroke: `1px ${alpha('#ffffff', 0.35)}`,
                        filter: `drop-shadow(0 6px 24px ${alpha(skin.accent2, 0.55)})`,
                    }}
                >
                    {store.name}
                </h1>
                <p className="text-sm italic mt-2 text-white/80" style={{ fontFamily: 'var(--skin-body)' }}>
                    {skin.tagline}
                </p>
            </div>

            {/* ---- PILL TABS, DEAD CENTRE ---- */}
            {store.tabs.length > 1 && (
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {store.tabs.map(tab => {
                        const active = activeTab.id === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTabId(tab.id)}
                                className="px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.18em] border transition-colors"
                                style={active
                                    ? {
                                        borderColor: '#fff',
                                        background: `linear-gradient(90deg, ${skin.accent}, ${skin.accent2})`,
                                        color: '#1a0524',
                                        boxShadow: `0 0 22px ${alpha(skin.accent, 0.6)}`,
                                        fontFamily: 'var(--skin-body)',
                                    }
                                    : {
                                        borderColor: alpha('#ffffff', 0.4),
                                        background: alpha('#000000', 0.28),
                                        color: '#fff',
                                        fontFamily: 'var(--skin-body)',
                                    }}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="flex flex-wrap justify-center gap-1.5 mb-5">{statusChips}</div>

            {/* ---- STAGGERED STOCK FLOW ---- */}
            {usePlainBody ? body : (
                <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 [column-fill:balance]">
                    {items.map((item, i) => (
                        <div
                            key={`${item.id}-${item.price}-${item.isFake}`}
                            className={`break-inside-avoid mb-3 ${i % 3 === 1 ? 'lg:mt-6' : i % 3 === 2 ? 'lg:mt-3' : ''}`}
                        >
                            <div
                                className="p-[3px]"
                                style={{
                                    background: `linear-gradient(135deg, ${skin.accent}, ${skin.accent2} 50%, ${skin.accent3 ?? skin.accent} 100%)`,
                                    boxShadow: `0 10px 30px ${alpha('#000000', 0.5)}`,
                                }}
                            >
                                <div
                                    className="flex items-center justify-between px-2 py-1"
                                    style={{ background: alpha('#000000', 0.55) }}
                                >
                                    <span className="label" style={{ color: '#fff' }}>現品限り</span>
                                    <span className="label" style={{ color: skin.accent3 ?? skin.accent }}>
                                        NO.{String(i + 1).padStart(2, '0')}
                                    </span>
                                </div>
                                <StoreSneakerCard
                                    sneaker={item}
                                    price={item.price}
                                    quantity={item.quantity}
                                    isFake={item.isFake}
                                    onAnalyse={() => onAnalyse(item.id)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ---- WHO ELSE IS IN THE MALL ---- */}
            <div className="mt-6 max-w-3xl mx-auto">
                <div className="text-center label mb-2" style={{ color: '#fff', letterSpacing: '0.4em' }}>
                    ▽ ＳＨＯＰＰＥＲＳ ▽
                </div>
                <div className="p-[2px]" style={{ background: `linear-gradient(90deg, ${skin.accent}, ${skin.accent2})` }}>
                    {npcRail}
                </div>
            </div>

            {store.copy?.tips?.length ? (
                <p className="label mt-5 text-center" style={{ color: '#fff' }}>♡ {store.copy.tips[0]}</p>
            ) : null}
        </StoreShell>
    </StoreStage>
);

export default VaporwaveLayout;
