import React from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';

/** Skyline heights — fixed, so the horizon does not reshuffle on every render. */
const SKYLINE = [34, 52, 28, 66, 44, 22, 58, 38, 72, 30, 48, 26, 62, 40, 54, 24];

/**
 * ROOFTOP SOUK — Florentin, Tel Aviv.
 *
 * An outdoor market four flights up at golden hour: string lights across the
 * top, a city skyline along the horizon, and every pair sold from under its own
 * striped awning. The stalls are the structure — a canopy, a cloth back, a
 * chalked stall number — so the page reads as a row of traders rather than a
 * catalogue.
 */
const RooftopSoukLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => {
    const awning = skin.knobs?.awning ?? skin.accent3 ?? '#ee5253';
    const stripes = `repeating-linear-gradient(90deg, ${awning} 0 18px, #f4ead7 18px 36px)`;

    return (
        <StoreStage skin={skin} className="pb-8">
            <style>{`
                @keyframes souk-glow { 0%,100% { opacity: .75 } 50% { opacity: 1 } }
                @keyframes souk-sway { 0%,100% { transform: rotate(-1.2deg) } 50% { transform: rotate(1.2deg) } }
                .souk-bulb { animation: souk-glow 3.2s ease-in-out infinite; }
                .souk-sign { animation: souk-sway 5.5s ease-in-out infinite; transform-origin: top center; }
            `}</style>

            {/* ---- SKYLINE ---- */}
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-[110px] flex items-end pointer-events-none opacity-70">
                {SKYLINE.map((h, i) => (
                    <span key={i} className="flex-1" style={{ height: h, background: '#160f1c', borderLeft: '1px solid rgba(0,0,0,.5)' }} />
                ))}
            </div>

            <StoreShell className="relative py-4 sm:py-6">
                {/* ---- STRING LIGHTS ---- */}
                <div aria-hidden className="relative h-7 mb-1">
                    <div
                        className="absolute inset-x-0 top-1 h-px"
                        style={{ background: alpha('#ffffff', 0.35) }}
                    />
                    <div className="absolute inset-x-0 top-1 flex justify-between px-1">
                        {Array.from({ length: 14 }).map((_, i) => (
                            <span
                                key={i}
                                className="souk-bulb block w-2 h-2.5 rounded-b-full"
                                style={{
                                    marginTop: i % 2 ? 6 : 2,
                                    background: i % 3 === 0 ? skin.accent2 : skin.accent,
                                    boxShadow: `0 0 12px ${alpha(i % 3 === 0 ? skin.accent2 : skin.accent, 0.9)}`,
                                    animationDelay: `${(i * 0.21).toFixed(2)}s`,
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* ---- HEADER ---- */}
                <div className="flex items-end justify-between gap-3 mb-3">
                    <div className="min-w-0">
                        <div className="label" style={{ color: '#fff' }}>{skin.motto ?? skin.label}</div>
                        <h1
                            className="uppercase mt-1 leading-none break-words"
                            style={{
                                fontFamily: 'var(--skin-title)',
                                fontSize: 'clamp(1.4rem, 7vw, 2.8rem)',
                                color: '#fff6e8',
                                textShadow: `2px 3px 0 ${alpha('#3a1020', 0.7)}`,
                            }}
                        >
                            {store.name}
                        </h1>
                        <p className="text-xs mt-1.5" style={{ color: alpha('#fff6e8', 0.85), fontFamily: 'var(--skin-body)' }}>
                            {skin.tagline}
                        </p>
                    </div>
                    <ExitButton
                        onExit={onExit}
                        label="◂ DOWNSTAIRS"
                        className="btn btn-sm !rounded-full"
                        style={{ borderColor: '#fff6e8', color: '#fff6e8', background: alpha('#3a1020', 0.5) }}
                    />
                </div>

                {/* ---- HANGING SIGNS (tabs) ---- */}
                {store.tabs.length > 1 && (
                    <div className="flex flex-wrap gap-3 mb-4 pt-1">
                        {store.tabs.map(tab => {
                            const active = activeTab.id === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTabId(tab.id)}
                                    className={`souk-sign relative px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] border-2 ${active ? '' : 'opacity-80'}`}
                                    style={{
                                        fontFamily: 'var(--skin-body)',
                                        fontWeight: 700,
                                        background: active ? '#fff6e8' : alpha('#3a1020', 0.6),
                                        color: active ? '#3a1020' : '#fff6e8',
                                        borderColor: active ? awning : alpha('#fff6e8', 0.5),
                                        animationDelay: `${tab.id.length * 0.3}s`,
                                    }}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-4">{statusChips}</div>

                {/* ---- THE STALLS ---- */}
                {usePlainBody ? body : (
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {items.map((item, i) => (
                            <div key={`${item.id}-${item.price}-${item.isFake}`} className="relative">
                                {/* canopy */}
                                <div
                                    className="h-4"
                                    style={{ background: stripes, clipPath: 'polygon(0 0, 100% 0, 96% 100%, 4% 100%)', boxShadow: '0 4px 12px rgba(0,0,0,.45)' }}
                                />
                                {/* scalloped edge */}
                                <div
                                    aria-hidden
                                    className="h-2 mx-[4%]"
                                    style={{
                                        background: stripes,
                                        maskImage: 'repeating-radial-gradient(circle at 9px 0, #000 0 7px, transparent 7px 9px)',
                                        WebkitMaskImage: 'repeating-radial-gradient(circle at 9px 0, #000 0 7px, transparent 7px 9px)',
                                    }}
                                />
                                <div
                                    className="mx-[4%] px-2 pb-2 pt-2"
                                    style={{
                                        background: alpha('#2a1a2e', 0.75),
                                        borderLeft: `1px solid ${alpha('#fff6e8', 0.2)}`,
                                        borderRight: `1px solid ${alpha('#fff6e8', 0.2)}`,
                                        borderBottom: `1px solid ${alpha('#fff6e8', 0.2)}`,
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="label" style={{ color: alpha('#fff6e8', 0.8) }}>
                                            STALL {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <span className="label" style={{ color: skin.accent2 }}>
                                            {item.quantity > 0 ? `${item.quantity} PAIR` : 'PACKED UP'}
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

                {/* ---- ON THE ROOF ---- */}
                <div className="mt-6">
                    <div className="label mb-2" style={{ color: '#fff6e8' }}>UP HERE WITH YOU</div>
                    {npcRail}
                </div>

                {store.copy?.tips?.length ? (
                    <p className="label mt-4" style={{ color: alpha('#fff6e8', 0.8) }}>🍺 {store.copy.tips[0]}</p>
                ) : null}
            </StoreShell>
        </StoreStage>
    );
};

export default RooftopSoukLayout;
