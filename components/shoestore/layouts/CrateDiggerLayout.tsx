import React, { useState } from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';

const SPINE_COLOUR: Record<string, string> = {
    Common: '#8394a6',
    Uncommon: '#46e06a',
    Rare: '#3aa8ff',
    Legendary: '#ffcc4d',
};

/**
 * CRATE DIGGER — Windy City Soles, Jaffa Flea Market.
 *
 * Stock is not a grid, it is a crate you flip through: a horizontal run of
 * spines, each one a shoebox seen end-on with the name printed up the side. You
 * pick one and it goes up on the counter, which is the only place the full
 * listing (and the buy button) appears — the same one-at-a-time rhythm as
 * actually digging.
 *
 * Horizontal scrolling is the design, so the crate owns a scroll container and
 * the page itself never moves sideways, phone included.
 */
const CrateDiggerLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => {
    const [picked, setPicked] = useState(0);
    const index = items.length ? Math.min(picked, items.length - 1) : 0;
    const selected = items[index];
    const wood = skin.surface ?? '#3a2314';

    return (
        <StoreStage skin={skin} className="pb-8">
            {/* Planks. Cheap, and it reads as a market table instantly. */}
            <div
                aria-hidden
                className="absolute inset-0 pointer-events-none opacity-70"
                style={{
                    backgroundImage: `repeating-linear-gradient(180deg, ${alpha('#000000', 0.28)} 0 2px, transparent 2px 26px),
                                      repeating-linear-gradient(90deg, ${alpha('#000000', 0.18)} 0 1px, transparent 1px 140px)`,
                }}
            />

            <StoreShell className="relative py-4 sm:py-6">
                {/* ---- SIGN ABOVE THE TABLE ---- */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        <div className="label" style={{ color: skin.accent }}>{skin.label}</div>
                        <h1
                            className="uppercase leading-none mt-1 break-words"
                            style={{
                                fontFamily: 'var(--skin-title)',
                                fontSize: 'clamp(1.3rem, 6.5vw, 2.6rem)',
                                color: '#fff',
                                textShadow: `3px 3px 0 ${alpha('#000000', 0.6)}, 0 0 30px ${alpha(skin.accent, 0.45)}`,
                            }}
                        >
                            {store.name}
                        </h1>
                        <p className="text-xs mt-1.5" style={{ color: alpha('#ffffff', 0.75), fontFamily: 'var(--skin-body)' }}>
                            {skin.tagline}
                        </p>
                    </div>
                    <ExitButton
                        onExit={onExit}
                        label="◂ PACK UP"
                        className="btn btn-sm"
                        style={{ borderColor: skin.accent, color: skin.accent, background: alpha('#000000', 0.45) }}
                    />
                </div>

                {/* ---- TABS AS CRATE DIVIDERS ---- */}
                {store.tabs.length > 1 && (
                    <div className="flex flex-wrap items-end gap-1.5 mb-0.5">
                        {store.tabs.map((tab, i) => {
                            const active = activeTab.id === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => { setActiveTabId(tab.id); setPicked(0); }}
                                    className="px-3 pt-2 pb-1.5 text-[11px] uppercase tracking-[0.14em] border border-b-0"
                                    style={{
                                        fontFamily: 'var(--skin-body)',
                                        transform: `rotate(${i % 2 ? 0.8 : -0.8}deg)`,
                                        clipPath: 'polygon(6px 0, calc(100% - 6px) 0, 100% 100%, 0 100%)',
                                        background: active ? skin.accent : '#c9ab7d',
                                        color: '#2a1a0c',
                                        borderColor: '#2a1a0c',
                                        fontWeight: 700,
                                    }}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ---- COUNTER + CRATE ---- */}
                <div
                    className="border-2 p-3"
                    style={{ borderColor: '#1d1207', background: `linear-gradient(180deg, ${wood}, #1a1109)` }}
                >
                    <div className="flex flex-wrap gap-1.5 mb-3">{statusChips}</div>

                    {usePlainBody ? body : (
                        <div className="grid lg:grid-cols-[260px_1fr] gap-4">
                            {/* ON THE COUNTER — the pair you pulled out */}
                            <div>
                                <div className="label mb-2" style={{ color: skin.accent }}>ON THE COUNTER</div>
                                <div
                                    className="p-2"
                                    style={{ background: alpha('#000000', 0.4), border: `1px solid ${alpha(skin.accent, 0.4)}` }}
                                >
                                    {selected && (
                                        <StoreSneakerCard
                                            key={`${selected.id}-${selected.price}`}
                                            sneaker={selected}
                                            price={selected.price}
                                            quantity={selected.quantity}
                                            isFake={selected.isFake}
                                            onAnalyse={() => onAnalyse(selected.id)}
                                        />
                                    )}
                                </div>
                                <p
                                    className="text-[11px] mt-2"
                                    style={{ color: alpha('#ffffff', 0.6), fontFamily: 'var(--skin-body)' }}
                                >
                                    {index + 1} of {items.length} in this crate.
                                </p>
                            </div>

                            {/* THE CRATE — spines, flipped through sideways */}
                            <div className="min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="label" style={{ color: skin.accent2 }}>
                                        {skin.knobs?.crateLabel ?? 'DIG HERE'}
                                    </span>
                                    <span className="label" style={{ color: alpha('#ffffff', 0.5) }}>swipe ▸</span>
                                </div>
                                <div
                                    className="flex gap-1.5 overflow-x-auto scrollbar-hide max-w-full pt-2 pb-3 px-2 items-end"
                                    style={{
                                        background: `linear-gradient(180deg, ${alpha('#000000', 0.55)}, ${alpha('#000000', 0.25)})`,
                                        borderTop: `2px solid ${alpha('#000000', 0.6)}`,
                                        borderBottom: `6px solid #1d1207`,
                                    }}
                                >
                                    {items.map((item, i) => {
                                        const active = i === index;
                                        const colour = SPINE_COLOUR[item.rarity] ?? SPINE_COLOUR.Common;
                                        return (
                                            <button
                                                key={`${item.id}-${item.price}-${item.isFake}`}
                                                type="button"
                                                onClick={() => setPicked(i)}
                                                title={item.name}
                                                className="flex-shrink-0 w-[40px] border flex items-center justify-center transition-transform"
                                                style={{
                                                    height: active ? 224 : 208,
                                                    transform: active ? 'translateY(-8px)' : undefined,
                                                    background: active
                                                        ? `linear-gradient(180deg, ${alpha(colour, 0.35)}, ${alpha('#000000', 0.7)})`
                                                        : `linear-gradient(180deg, ${alpha(colour, 0.14)}, ${alpha('#000000', 0.65)})`,
                                                    borderColor: active ? colour : alpha('#000000', 0.7),
                                                    boxShadow: active ? `0 0 18px ${alpha(colour, 0.55)}` : 'inset -3px 0 6px rgba(0,0,0,.5)',
                                                }}
                                            >
                                                <span className="flex flex-col items-center justify-between h-full py-1.5">
                                                    <span
                                                        className="text-[10px] uppercase tracking-[0.1em] whitespace-nowrap overflow-hidden text-ellipsis max-h-[170px]"
                                                        style={{
                                                            writingMode: 'vertical-rl',
                                                            fontFamily: 'var(--skin-body)',
                                                            color: active ? '#fff' : alpha('#ffffff', 0.72),
                                                        }}
                                                    >
                                                        {item.name}
                                                    </span>
                                                    <span
                                                        className="text-[9px] px-1 mt-1 whitespace-nowrap"
                                                        style={{
                                                            fontFamily: 'var(--skin-body)',
                                                            background: active ? colour : alpha('#000000', 0.6),
                                                            color: active ? '#1a1109' : colour,
                                                        }}
                                                    >
                                                        {item.price >= 1000 ? `$${(item.price / 1000).toFixed(1)}k` : `$${item.price}`}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}

                                    {/* Divider cards, so a thin crate still looks like a crate */}
                                    {Array.from({ length: Math.max(0, 6 - items.length) }).map((_, i) => (
                                        <span
                                            key={`divider-${i}`}
                                            aria-hidden
                                            className="flex-shrink-0 w-[26px] h-[200px] border"
                                            style={{
                                                background: `linear-gradient(180deg, #c9ab7d, #8a7350)`,
                                                borderColor: alpha('#000000', 0.6),
                                                clipPath: 'polygon(0 0, 100% 6px, 100% 100%, 0 100%)',
                                                opacity: 0.5,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ---- AROUND THE STALL ---- */}
                <div className="mt-4">
                    <div className="label mb-2" style={{ color: skin.accent2 }}>HAGGLING NEARBY</div>
                    {npcRail}
                </div>

                {store.copy?.tips?.length ? (
                    <p className="label mt-4" style={{ color: alpha('#ffffff', 0.6) }}>↯ {store.copy.tips[0]}</p>
                ) : null}
            </StoreShell>
        </StoreStage>
    );
};

export default CrateDiggerLayout;
