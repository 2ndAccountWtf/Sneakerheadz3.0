import React from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';

/** Fake a runtime off the price so every "track" has a length. Pure flavour. */
const runtime = (n: number) => `${2 + (n % 4)}:${String(n % 60).padStart(2, '0')}`;

/**
 * TAPE DECK — Venice Beach Beats.
 *
 * The shop is the hi-fi: a plastic deck face with a tape window and two turning
 * reels up top, transport buttons for tabs, and the stock listed as a tracklist
 * — side, track number, dotted leader, runtime — with each entry mounted on a
 * cassette inlay card. Everything is warm, nothing is urgent.
 */
const TapeDeckLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => {
    const shell = skin.surface ?? '#2f3128';
    const inlay = '#e8e2cf';

    return (
        <StoreStage skin={skin} className="pb-8">
            <style>{`
                @keyframes tape-spin { to { transform: rotate(360deg) } }
                @keyframes tape-vu { 0%,100% { width: 28% } 35% { width: 76% } 60% { width: 46% } 80% { width: 88% } }
                .tape-reel { animation: tape-spin 5.5s linear infinite; }
                .tape-vu > i { animation: tape-vu 2.6s ease-in-out infinite; }
            `}</style>

            <StoreShell width="normal" className="relative py-4 sm:py-6">
                {/* ---- DECK FACE ---- */}
                <div
                    className="border-2 rounded-[14px] p-3 sm:p-4"
                    style={{
                        borderColor: '#14170f',
                        background: `linear-gradient(180deg, ${shell}, #191c15)`,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 16px 40px rgba(0,0,0,.55)',
                    }}
                >
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                            <div className="label" style={{ color: skin.accent }}>{skin.motto ?? skin.label}</div>
                            <h1
                                className="uppercase mt-1 leading-tight break-words"
                                style={{ fontFamily: 'var(--skin-title)', fontWeight: 700, fontSize: 'clamp(1.05rem, 5vw, 1.75rem)', color: '#f3f0e2' }}
                            >
                                {store.name}
                            </h1>
                        </div>
                        <ExitButton
                            onExit={onExit}
                            label="⏏ EJECT"
                            className="btn btn-sm !rounded-md"
                            style={{ borderColor: skin.accent2, color: skin.accent2, background: alpha('#000000', 0.4) }}
                        />
                    </div>

                    {/* ---- TAPE WINDOW: two reels and a counter ---- */}
                    <div
                        className="rounded-md border px-3 py-3 flex items-center gap-3 sm:gap-5 mb-3"
                        style={{ borderColor: '#0f120b', background: `linear-gradient(180deg, ${alpha('#000000', 0.55)}, ${alpha('#000000', 0.3)})` }}
                    >
                        {[0, 1].map(reel => (
                            <div
                                key={reel}
                                aria-hidden
                                className="tape-reel flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 grid place-items-center"
                                style={{ borderColor: alpha(skin.accent, 0.7), background: `radial-gradient(circle, #14170f 30%, ${alpha(skin.accent2, 0.25)} 32%, #14170f 70%)`, animationDirection: reel ? 'reverse' : 'normal' }}
                            >
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: alpha(skin.accent, 0.8) }} />
                            </div>
                        ))}
                        <div className="min-w-0 flex-1">
                            <p className="text-xs italic truncate" style={{ color: '#cfd6bd', fontFamily: 'var(--skin-body)' }}>
                                {skin.tagline}
                            </p>
                            <div className="tape-vu meter mt-2" aria-hidden>
                                <i style={{ background: `linear-gradient(90deg, ${skin.accent}, ${skin.accent2})` }} />
                            </div>
                        </div>
                        <span
                            className="numeric text-[11px] px-2 py-1 border flex-shrink-0 hidden sm:inline"
                            style={{ borderColor: alpha(skin.accent, 0.4), color: skin.accent, background: '#0b0d07' }}
                        >
                            {String(items.length).padStart(3, '0')}
                        </span>
                    </div>

                    {/* ---- TRANSPORT BUTTONS = TABS ---- */}
                    {store.tabs.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {store.tabs.map((tab, i) => {
                                const active = activeTab.id === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTabId(tab.id)}
                                        className="flex items-center gap-2 px-3 py-2 border-2 rounded-[3px] text-[10px] uppercase tracking-[0.16em] transition-transform active:translate-y-[1px]"
                                        style={{
                                            fontFamily: 'var(--skin-body)',
                                            borderColor: '#14170f',
                                            background: active
                                                ? `linear-gradient(180deg, ${skin.accent}, ${alpha(skin.accent, 0.7)})`
                                                : 'linear-gradient(180deg, #3c4033, #23271d)',
                                            color: active ? '#10140c' : '#c8cfb6',
                                            boxShadow: active ? 'inset 0 2px 0 rgba(255,255,255,.35)' : '0 2px 0 #14170f',
                                        }}
                                    >
                                        <span aria-hidden>{['▶', '◀◀', '▶▶', '■'][i % 4]}</span>
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">{statusChips}</div>
                </div>

                {/* ---- TRACKLIST ---- */}
                <div className="mt-4">
                    <div className="flex items-baseline gap-3 mb-2">
                        <span className="label" style={{ color: skin.accent }}>TRACKLIST · {activeTab.label}</span>
                        <span className="flex-1 h-px" style={{ background: alpha(skin.accent, 0.3) }} />
                    </div>

                    {usePlainBody ? body : (
                        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {items.map((item, i) => (
                                <div
                                    key={`${item.id}-${item.price}-${item.isFake}`}
                                    className="border"
                                    style={{ borderColor: '#14170f', background: inlay, boxShadow: '0 6px 18px rgba(0,0,0,.45)' }}
                                >
                                    {/* Inlay card: handwritten-ish header on cream stock */}
                                    <div className="flex items-baseline gap-2 px-2.5 pt-2 pb-1.5 min-w-0">
                                        <span
                                            className="text-[11px] font-bold flex-shrink-0"
                                            style={{ color: '#2f3128', fontFamily: 'var(--skin-body)' }}
                                        >
                                            A{i + 1}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: '#2f3128', fontFamily: 'var(--skin-body)' }}>
                                            {item.name}
                                        </span>
                                        <span
                                            aria-hidden
                                            className="flex-1 border-b border-dotted self-end mb-1 min-w-[10px]"
                                            style={{ borderColor: '#8a8a78' }}
                                        />
                                        <span className="text-[11px] flex-shrink-0 numeric" style={{ color: '#57584b' }}>
                                            {runtime(item.basePrice)}
                                        </span>
                                    </div>
                                    <div className="px-1.5 pb-1.5">
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
                </div>

                {/* ---- ON THE COUCH ---- */}
                <div className="mt-5">
                    <div className="label mb-2" style={{ color: skin.accent2 }}>HANGING AROUND</div>
                    {npcRail}
                </div>

                {store.copy?.tips?.length ? (
                    <p className="label mt-4" style={{ color: alpha('#ffffff', 0.55) }}>♪ {store.copy.tips[0]}</p>
                ) : null}
            </StoreShell>
        </StoreStage>
    );
};

export default TapeDeckLayout;
