import React, { useState } from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, ScrollRow, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';
import Img from '../../Img';

/** Deterministic pseudo-random so the rain is stable between renders. */
const rand = (seed: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

/**
 * RAIN NOIR — Shinjuku.
 *
 * Not a shop floor: a back office with a wet window. The tabs are a vertical
 * rail down the left edge (a filing cabinet, read bottom-to-top), the stock is
 * a dossier of dense one-line entries rather than cards, and a pair only opens
 * into a full listing when you pull its file.
 *
 * That row-then-expand shape is the point — it keeps the price column scannable
 * for someone comparing thirty pairs — and it reuses the shared store card for
 * the actual purchase, so buying rules stay identical to every other room.
 */
const RainNoirLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => {
    const [openId, setOpenId] = useState<string | null>(null);

    return (
        <StoreStage skin={skin} className="pb-8">
            <style>{`
                @keyframes noir-fall { from { transform: translateY(-120%) } to { transform: translateY(760%) } }
                @keyframes noir-flash {
                    0%, 92%, 100% { opacity: 0 }
                    93% { opacity: .5 } 94% { opacity: .05 } 96% { opacity: .32 } 97% { opacity: 0 }
                }
                .noir-drop { animation-name: noir-fall; animation-timing-function: linear; animation-iteration-count: infinite; }
                .noir-flash { animation: noir-flash 17s linear infinite; }
            `}</style>

            {/* ---- WEATHER ---- */}
            <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
                {Array.from({ length: 26 }).map((_, i) => (
                    <span
                        key={i}
                        className="noir-drop absolute top-0 w-px"
                        style={{
                            left: `${(rand(i + 1) * 100).toFixed(2)}%`,
                            height: `${18 + rand(i + 7) * 34}px`,
                            background: `linear-gradient(180deg, transparent, ${alpha(skin.accent2, 0.55)})`,
                            animationDuration: `${1.1 + rand(i + 3) * 1.6}s`,
                            animationDelay: `${(rand(i + 5) * -3).toFixed(2)}s`,
                            opacity: 0.35 + rand(i + 11) * 0.4,
                        }}
                    />
                ))}
                {/* Fog rolling off the bottom, and the odd strike over the alley */}
                <div
                    className="absolute inset-x-0 bottom-0 h-2/3"
                    style={{ background: `linear-gradient(180deg, transparent, ${alpha(skin.accent, 0.1)} 55%, var(--bg) 100%)` }}
                />
                <div className="noir-flash absolute inset-0" style={{ background: alpha('#cfd8ff', 0.35) }} />
            </div>

            <StoreShell className="relative py-4 sm:py-6">
                {/* ---- CASE HEADER ---- */}
                <div
                    className="border-l-2 pl-3 mb-4 flex items-start justify-between gap-3"
                    style={{ borderColor: skin.accent }}
                >
                    <div className="min-w-0">
                        <div className="label" style={{ color: skin.accent2 }}>
                            CASE FILE · {skin.label.toUpperCase()}
                        </div>
                        <h1
                            className="uppercase mt-1 leading-tight break-words"
                            style={{
                                fontFamily: 'var(--skin-title)',
                                fontWeight: 700,
                                fontSize: 'clamp(1.05rem, 5vw, 1.9rem)',
                                color: '#fff',
                                letterSpacing: '0.04em',
                                textShadow: `0 0 26px ${alpha(skin.accent, 0.8)}`,
                            }}
                        >
                            {store.name}
                        </h1>
                        <p className="text-xs mt-1" style={{ color: 'var(--ink-dim)', fontFamily: 'var(--skin-body)' }}>
                            {skin.tagline}
                        </p>
                        {skin.motto && (
                            <p className="label mt-2" style={{ color: alpha(skin.accent2, 0.8) }}>{skin.motto}</p>
                        )}
                    </div>
                    <ExitButton
                        onExit={onExit}
                        label="↑ STREET"
                        className="btn btn-sm"
                        style={{ borderColor: skin.accent, color: skin.accent, background: alpha('#000000', 0.5) }}
                    />
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">{statusChips}</div>

                <div className="flex gap-3">
                    {/* ---- VERTICAL TAB RAIL (desktop) ---- */}
                    {store.tabs.length > 1 && (
                        <div className="hidden md:flex flex-col gap-2 flex-shrink-0">
                            {store.tabs.map(tab => {
                                const active = activeTab.id === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTabId(tab.id)}
                                        className="w-[38px] py-4 border uppercase text-[10px] tracking-[0.2em] transition-colors"
                                        style={{
                                            writingMode: 'vertical-rl',
                                            transform: 'rotate(180deg)',
                                            fontFamily: 'var(--skin-body)',
                                            borderColor: active ? skin.accent : 'var(--line)',
                                            background: active ? alpha(skin.accent, 0.18) : alpha('#000000', 0.45),
                                            color: active ? '#fff' : 'var(--ink-dim)',
                                            boxShadow: active ? `inset 2px 0 0 ${skin.accent}` : undefined,
                                        }}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="min-w-0 flex-1">
                        {/* ---- TAB RAIL, PHONE VERSION ---- */}
                        {store.tabs.length > 1 && (
                            <ScrollRow className="md:hidden mb-3 pb-1">
                                {store.tabs.map(tab => {
                                    const active = activeTab.id === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTabId(tab.id)}
                                            className="flex-shrink-0 px-3 py-2 border uppercase text-[10px] tracking-[0.16em]"
                                            style={{
                                                fontFamily: 'var(--skin-body)',
                                                borderColor: active ? skin.accent : 'var(--line)',
                                                background: active ? alpha(skin.accent, 0.18) : alpha('#000000', 0.45),
                                                color: active ? '#fff' : 'var(--ink-dim)',
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </ScrollRow>
                        )}

                        {/* ---- DOSSIER ---- */}
                        {usePlainBody ? body : (
                            <div
                                className="border"
                                style={{ borderColor: 'var(--line)', background: alpha('#000000', 0.55), backdropFilter: 'blur(2px)' }}
                            >
                                <div
                                    className="flex items-center justify-between px-3 py-2 border-b"
                                    style={{ borderColor: 'var(--line)' }}
                                >
                                    <span className="label" style={{ color: skin.accent2 }}>ITEM · CONDITION</span>
                                    <span className="label" style={{ color: skin.accent2 }}>ASK</span>
                                </div>

                                {items.map((item, i) => {
                                    const rowKey = `${item.id}-${item.price}-${item.isFake}`;
                                    const open = openId === rowKey;
                                    return (
                                        <div key={rowKey} className="border-b last:border-b-0" style={{ borderColor: 'var(--line)' }}>
                                            <button
                                                type="button"
                                                onClick={() => setOpenId(open ? null : rowKey)}
                                                className="w-full text-left flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 hover:bg-white/[0.04] transition-colors"
                                            >
                                                <span
                                                    className="label flex-shrink-0 w-9 tabular-nums"
                                                    style={{ color: alpha(skin.accent, 0.9) }}
                                                >
                                                    {String(i + 1).padStart(3, '0')}
                                                </span>
                                                <Img
                                                    src={item.imageUrl}
                                                    alt=""
                                                    loading="lazy"
                                                    className="w-9 h-9 object-contain bg-black/60 border flex-shrink-0 saturate-[0.4]"
                                                    style={{ borderColor: 'var(--line)' }}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-[13px] text-white truncate" style={{ fontFamily: 'var(--skin-body)' }}>
                                                        {item.name}
                                                    </span>
                                                    <span className="block text-[10px] uppercase tracking-wider truncate" style={{ color: 'var(--ink-faint)' }}>
                                                        {item.rarity}
                                                        {item.isFake ? ' · REPLICA' : ''}
                                                        {item.quantity <= 0 ? ' · GONE' : ` · ${item.quantity} PAIR`}
                                                    </span>
                                                </span>
                                                <span className="numeric text-sm flex-shrink-0" style={{ color: item.quantity > 0 ? skin.accent2 : 'var(--ink-faint)' }}>
                                                    ${item.price.toLocaleString()}
                                                </span>
                                                <span className="flex-shrink-0 text-xs" style={{ color: skin.accent }}>
                                                    {open ? '▾' : '▸'}
                                                </span>
                                            </button>

                                            {/* Pulling the file reveals the standard listing, buy controls and all */}
                                            {open && (
                                                <div className="px-2 sm:px-3 pb-3 pt-1 animate-rise">
                                                    <div className="max-w-[260px]">
                                                        <StoreSneakerCard
                                                            sneaker={item}
                                                            price={item.price}
                                                            quantity={item.quantity}
                                                            isFake={item.isFake}
                                                            onAnalyse={() => onAnalyse(item.id)}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ---- SURVEILLANCE ---- */}
                        <div className="mt-4">
                            <div className="label mb-2" style={{ color: skin.accent2 }}>SEEN ON THE CAMERAS</div>
                            {npcRail}
                        </div>

                        {store.copy?.tips?.length ? (
                            <p className="label mt-4" style={{ color: 'var(--ink-faint)' }}>NOTE — {store.copy.tips[0]}</p>
                        ) : null}
                    </div>
                </div>
            </StoreShell>
        </StoreStage>
    );
};

export default RainNoirLayout;
