import React from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';

/**
 * BOILER ROOM — South Side, Chicago.
 *
 * Two floors under a barbershop: bare concrete, pipe runs overhead, one work
 * lamp, and stock kept in a bank of steel lockers. Tabs are the breaker panel;
 * each pair is a locker with vent slits, a stencilled number plate and a latch.
 * Cold blue light, orange rust, nothing decorative that isn't also structural.
 */
const BoilerRoomLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => {
    const steel = skin.surface ?? '#262e35';
    const vents = `repeating-linear-gradient(180deg, ${alpha('#000000', 0.55)} 0 2px, ${alpha('#ffffff', 0.07)} 2px 5px)`;

    return (
        <StoreStage skin={skin} className="pb-8">
            <style>{`
                @keyframes boil-lamp { 0%,100% { opacity: .8 } 47% { opacity: .95 } 53% { opacity: .62 } }
                .boil-lamp { animation: boil-lamp 6.5s ease-in-out infinite; }
            `}</style>

            {/* ---- ONE WORK LAMP, HUNG HIGH LEFT ---- */}
            <div
                aria-hidden
                className="boil-lamp absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 18% -5%, ${alpha(skin.accent, 0.22)}, transparent 60%)` }}
            />
            {/* concrete grain */}
            <div
                aria-hidden
                className="absolute inset-0 pointer-events-none opacity-[0.05]"
                style={{ backgroundImage: `repeating-linear-gradient(135deg, ${alpha('#ffffff', 0.5)} 0 1px, transparent 1px 9px)` }}
            />

            <StoreShell className="relative py-4 sm:py-6">
                {/* ---- PIPE RUN ---- */}
                <div aria-hidden className="mb-4 space-y-1.5">
                    {[0, 1].map(pipe => (
                        <div key={pipe} className="relative h-3" style={{ marginLeft: pipe ? 26 : 0 }}>
                            <div
                                className="absolute inset-0 rounded-full"
                                style={{
                                    background: pipe
                                        ? `linear-gradient(180deg, ${alpha(skin.accent2, 0.55)}, #2a1b12 70%)`
                                        : `linear-gradient(180deg, #7b8791, #2b3238 70%)`,
                                    boxShadow: '0 4px 10px rgba(0,0,0,.6)',
                                }}
                            />
                            {[18, 52, 84].map(pos => (
                                <span
                                    key={pos}
                                    className="absolute -top-0.5 h-4 w-2"
                                    style={{ left: `${pos}%`, background: '#151a1e', borderRadius: 2 }}
                                />
                            ))}
                        </div>
                    ))}
                </div>

                {/* ---- RIVETED NAME PLATE ---- */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div
                        className="relative min-w-0 px-3 py-2.5 border"
                        style={{
                            background: `linear-gradient(180deg, ${steel}, #141a1f)`,
                            borderColor: alpha('#ffffff', 0.18),
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.1), 0 10px 24px rgba(0,0,0,.55)',
                        }}
                    >
                        {[['left', 'top'], ['right', 'top'], ['left', 'bottom'], ['right', 'bottom']].map(([x, y]) => (
                            <span
                                key={`${x}${y}`}
                                aria-hidden
                                className="absolute w-1.5 h-1.5 rounded-full"
                                style={{ [x]: 5, [y]: 5, background: '#8e9aa3', boxShadow: 'inset 0 -1px 1px rgba(0,0,0,.6)' } as React.CSSProperties}
                            />
                        ))}
                        <div className="label" style={{ color: skin.accent }}>{skin.knobs?.stencil ?? skin.label}</div>
                        <h1
                            className="uppercase mt-1 leading-none break-words"
                            style={{
                                fontFamily: 'var(--skin-title)',
                                fontSize: 'clamp(1.15rem, 5.4vw, 2.1rem)',
                                color: '#dfe8ee',
                                letterSpacing: '0.04em',
                                textShadow: `0 2px 0 ${alpha('#000000', 0.7)}`,
                            }}
                        >
                            {store.name}
                        </h1>
                        <p className="text-xs mt-1.5" style={{ color: 'var(--ink-dim)', fontFamily: 'var(--skin-body)' }}>
                            {skin.tagline}
                        </p>
                    </div>
                    <ExitButton
                        onExit={onExit}
                        label="▲ STAIRS"
                        className="btn btn-sm"
                        style={{ borderColor: skin.accent, color: skin.accent, background: alpha('#000000', 0.45) }}
                    />
                </div>

                {/* ---- BREAKER PANEL (tabs) ---- */}
                {store.tabs.length > 1 && (
                    <div
                        className="flex flex-wrap gap-2 p-2 mb-4 border"
                        style={{ borderColor: alpha('#ffffff', 0.15), background: alpha('#000000', 0.4) }}
                    >
                        {store.tabs.map(tab => {
                            const active = activeTab.id === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTabId(tab.id)}
                                    className="flex items-center gap-2 px-2 py-1.5 border text-[10px] uppercase tracking-[0.14em]"
                                    style={{
                                        fontFamily: 'var(--skin-body)',
                                        borderColor: active ? skin.accent : alpha('#ffffff', 0.16),
                                        background: `linear-gradient(180deg, ${steel}, #12171b)`,
                                        color: active ? skin.accent : 'var(--ink-dim)',
                                    }}
                                >
                                    {/* the lever itself */}
                                    <span
                                        aria-hidden
                                        className="w-3 h-5 border flex items-end"
                                        style={{ borderColor: alpha('#000000', 0.6), background: '#0a0d10' }}
                                    >
                                        <span
                                            className="block w-full h-2"
                                            style={{
                                                background: active ? skin.accent : '#4b555d',
                                                transform: active ? 'translateY(-6px)' : 'none',
                                                boxShadow: active ? `0 0 8px ${skin.accent}` : undefined,
                                            }}
                                        />
                                    </span>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-4">{statusChips}</div>

                {/* ---- LOCKER BANK ---- */}
                {usePlainBody ? body : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {items.map((item, i) => (
                            <div
                                key={`${item.id}-${item.price}-${item.isFake}`}
                                className="flex border"
                                style={{
                                    borderColor: alpha('#ffffff', 0.16),
                                    background: `linear-gradient(180deg, ${steel}, #10151a)`,
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 8px 20px rgba(0,0,0,.5)',
                                }}
                            >
                                {/* locker door furniture down the left */}
                                <div className="flex flex-col items-center justify-between py-2 px-1.5 flex-shrink-0" style={{ width: 34 }}>
                                    <span aria-hidden className="w-5 h-8" style={{ background: vents, border: `1px solid ${alpha('#000000', 0.5)}` }} />
                                    <span
                                        className="text-[10px] numeric px-1"
                                        style={{ color: skin.accent, border: `1px solid ${alpha(skin.accent, 0.4)}` }}
                                    >
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span
                                        aria-hidden
                                        className="w-2.5 h-6 rounded-sm"
                                        style={{ background: 'linear-gradient(180deg, #8e9aa3, #444d54)' }}
                                    />
                                </div>
                                <div className="min-w-0 flex-1 border-l" style={{ borderColor: alpha('#000000', 0.5) }}>
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

                {/* ---- DOWN HERE WITH YOU ---- */}
                <div className="mt-5">
                    <div className="label mb-2" style={{ color: skin.accent }}>DOWN HERE WITH YOU</div>
                    {npcRail}
                </div>

                {store.copy?.tips?.length ? (
                    <p className="label mt-4" style={{ color: alpha(skin.accent2, 0.85) }}>⚠ {store.copy.tips[0]}</p>
                ) : null}

                {/* ---- CAUTION STRIPE ALONG THE FLOOR ---- */}
                <div
                    aria-hidden
                    className="h-3 mt-5"
                    style={{ backgroundImage: `repeating-linear-gradient(45deg, ${skin.accent2} 0 12px, #14191d 12px 24px)`, opacity: 0.8 }}
                />
            </StoreShell>
        </StoreStage>
    );
};

export default BoilerRoomLayout;
