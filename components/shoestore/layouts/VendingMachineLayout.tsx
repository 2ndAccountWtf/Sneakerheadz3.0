import React, { useState } from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';

/**
 * VENDING ANNEX — Shibuya.
 *
 * There is no shop assistant: there is a wall of glass, a coil under every pair,
 * and a keypad. Stock sits on lit shelves behind a reflection, each pair tagged
 * with a slot code; the keypad down the right (under the glass on a phone)
 * selects a slot and the seven-segment display reads back what it costs.
 *
 * The selection is presentational — pressing a key highlights the slot and
 * scrolls it into view, and the actual purchase still happens on the shared
 * store card, so nothing about buying changes in here.
 */
const VendingMachineLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => {
    const [slot, setSlot] = useState(0);
    const prefix = skin.knobs?.slotPrefix ?? 'A';
    const index = items.length ? Math.min(slot, items.length - 1) : 0;
    const selected = items[index];
    const code = (i: number) => `${prefix}${i + 1}`;

    return (
        <StoreStage skin={skin} className="pb-8">
            <style>{`
                @keyframes vend-scan { 0%,100% { opacity:.12 } 50% { opacity:.3 } }
                @keyframes vend-led { 0%,100% { opacity:1 } 50% { opacity:.25 } }
                .vend-glass { animation: vend-scan 6s ease-in-out infinite; }
                .vend-led { animation: vend-led 1.4s steps(2,end) infinite; }
            `}</style>

            <StoreShell className="relative py-4 sm:py-6">
                {/* ---- MACHINE HEADER PANEL ---- */}
                <div
                    className="flex items-center justify-between gap-3 px-3 py-2.5 border-2 border-b-0"
                    style={{
                        borderColor: alpha(skin.accent, 0.5),
                        background: `linear-gradient(180deg, ${alpha(skin.accent, 0.22)}, ${alpha('#000000', 0.55)})`,
                    }}
                >
                    <div className="min-w-0">
                        <div className="label" style={{ color: skin.accent }}>
                            <span className="vend-led">▣</span> {skin.motto ?? skin.label}
                        </div>
                        <h1
                            className="uppercase mt-1 leading-tight break-words"
                            style={{ fontFamily: 'var(--skin-title)', fontWeight: 700, fontSize: 'clamp(1rem, 4.6vw, 1.6rem)', color: '#eafcff' }}
                        >
                            {store.name}
                        </h1>
                    </div>
                    <ExitButton
                        onExit={onExit}
                        label="◂ STREET"
                        className="btn btn-sm"
                        style={{ borderColor: skin.accent, color: skin.accent, background: alpha('#000000', 0.45) }}
                    />
                </div>

                {/* ---- SHELF-LEVEL SELECTOR (tabs) ---- */}
                {store.tabs.length > 1 && (
                    <div
                        className="flex gap-2 overflow-x-auto scrollbar-hide max-w-full border-x-2 px-2 py-2"
                        style={{ borderColor: alpha(skin.accent, 0.5), background: alpha('#000000', 0.35) }}
                    >
                        {store.tabs.map((tab, i) => {
                            const active = activeTab.id === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => { setActiveTabId(tab.id); setSlot(0); }}
                                    className="flex-shrink-0 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] border"
                                    style={{
                                        fontFamily: 'var(--skin-body)',
                                        borderColor: active ? skin.accent : alpha('#ffffff', 0.18),
                                        background: active ? alpha(skin.accent, 0.22) : alpha('#000000', 0.4),
                                        color: active ? '#eafcff' : 'var(--ink-dim)',
                                        boxShadow: active ? `0 0 14px ${alpha(skin.accent, 0.5)}` : undefined,
                                    }}
                                >
                                    ROW {i + 1} · {tab.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* ---- MACHINE BODY: glass left, controls right ---- */}
                <div
                    className="border-2 p-2 sm:p-3 grid lg:grid-cols-[1fr_190px] gap-3"
                    style={{
                        borderColor: alpha(skin.accent, 0.5),
                        background: `linear-gradient(180deg, ${skin.surface ?? '#0e1a22'}, #050a0e)`,
                    }}
                >
                    {/* GLASS */}
                    <div
                        className="relative min-w-0 p-2 sm:p-3"
                        style={{
                            background: `linear-gradient(180deg, ${alpha(skin.accent, 0.07)}, ${alpha('#000000', 0.5)})`,
                            border: `1px solid ${alpha(skin.accent, 0.3)}`,
                            boxShadow: `inset 0 0 50px ${alpha(skin.accent, 0.12)}`,
                        }}
                    >
                        {/* reflection across the glass */}
                        <div
                            aria-hidden
                            className="vend-glass absolute inset-0 pointer-events-none"
                            style={{ background: 'linear-gradient(115deg, transparent 20%, rgba(255,255,255,.22) 38%, transparent 52%)' }}
                        />

                        <div className="relative flex flex-wrap gap-1.5 mb-3">{statusChips}</div>

                        {usePlainBody ? body : (
                            <div className="relative grid grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
                                {items.map((item, i) => {
                                    const active = i === index;
                                    return (
                                        <div key={`${item.id}-${item.price}-${item.isFake}`} id={`slot-${code(i)}`} className="flex flex-col">
                                            <div className="flex items-center justify-between px-1 pb-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setSlot(i)}
                                                    className="text-[10px] px-1.5 border"
                                                    style={{
                                                        fontFamily: 'var(--skin-body)',
                                                        borderColor: active ? skin.accent : alpha('#ffffff', 0.2),
                                                        color: active ? skin.accent : 'var(--ink-dim)',
                                                        background: active ? alpha(skin.accent, 0.15) : 'transparent',
                                                    }}
                                                >
                                                    {code(i)}
                                                </button>
                                                {item.quantity <= 0 && (
                                                    <span className="text-[9px] uppercase" style={{ color: 'var(--bad)', fontFamily: 'var(--skin-body)' }}>
                                                        売切
                                                    </span>
                                                )}
                                            </div>
                                            <div
                                                style={{
                                                    outline: active ? `2px solid ${skin.accent}` : 'none',
                                                    boxShadow: active ? `0 0 22px ${alpha(skin.accent, 0.45)}` : undefined,
                                                }}
                                            >
                                                <StoreSneakerCard
                                                    sneaker={item}
                                                    price={item.price}
                                                    quantity={item.quantity}
                                                    isFake={item.isFake}
                                                    onAnalyse={() => onAnalyse(item.id)}
                                                />
                                            </div>
                                            {/* the coil the pair rests on */}
                                            <div
                                                aria-hidden
                                                className="h-2.5 mt-1"
                                                style={{
                                                    backgroundImage: `repeating-linear-gradient(90deg, ${alpha(skin.accent2, 0.55)} 0 2px, transparent 2px 7px)`,
                                                    borderBottom: `2px solid ${alpha('#ffffff', 0.15)}`,
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* CONTROL COLUMN: display, keypad, coin return */}
                    <div className="min-w-0">
                        <div
                            className="border px-2 py-2 mb-2"
                            style={{ borderColor: alpha(skin.accent, 0.4), background: '#02070a' }}
                        >
                            <div className="label" style={{ color: alpha(skin.accent2, 0.8) }}>SLOT</div>
                            <div className="numeric text-lg" style={{ color: skin.accent2 }}>
                                {selected ? code(index) : '--'}
                            </div>
                            <div
                                className="numeric text-xl mt-1"
                                style={{ color: skin.accent, textShadow: `0 0 12px ${alpha(skin.accent, 0.8)}` }}
                            >
                                {selected ? `¥${selected.price.toLocaleString()}` : '----'}
                            </div>
                            <div className="text-[10px] mt-1 truncate" style={{ color: 'var(--ink-dim)', fontFamily: 'var(--skin-body)' }}>
                                {selected?.name ?? 'SELECT A SLOT'}
                            </div>
                        </div>

                        {!usePlainBody && (
                            <div className="grid grid-cols-4 lg:grid-cols-3 gap-1 mb-2">
                                {items.map((item, i) => (
                                    <a
                                        key={`key-${item.id}-${i}`}
                                        href={`#slot-${code(i)}`}
                                        onClick={() => setSlot(i)}
                                        className="text-center py-1.5 text-[10px] border transition-colors"
                                        style={{
                                            fontFamily: 'var(--skin-body)',
                                            borderColor: i === index ? skin.accent : alpha('#ffffff', 0.15),
                                            background: i === index ? alpha(skin.accent, 0.2) : '#0a1118',
                                            color: i === index ? skin.accent : 'var(--ink-dim)',
                                        }}
                                    >
                                        {code(i)}
                                    </a>
                                ))}
                            </div>
                        )}

                        <div
                            className="border px-2 py-2 text-[10px] uppercase tracking-[0.14em]"
                            style={{ borderColor: alpha('#ffffff', 0.15), color: 'var(--ink-faint)', fontFamily: 'var(--skin-body)', background: '#080d12' }}
                        >
                            <div className="flex items-center justify-between">
                                <span>つり銭 / change</span>
                                <span aria-hidden className="inline-block w-6 h-2 border" style={{ borderColor: alpha('#ffffff', 0.3), background: '#000' }} />
                            </div>
                            <p className="mt-2 normal-case tracking-normal text-[11px] italic">{skin.tagline}</p>
                        </div>
                    </div>
                </div>

                {/* ---- QUEUE AT THE MACHINE ---- */}
                <div className="mt-4">
                    <div className="label mb-2" style={{ color: skin.accent2 }}>WAITING FOR THEIR SLOT</div>
                    {npcRail}
                </div>

                {store.copy?.tips?.length ? (
                    <p className="label mt-4" style={{ color: alpha(skin.accent, 0.8) }}>▸ {store.copy.tips[0]}</p>
                ) : null}
            </StoreShell>
        </StoreStage>
    );
};

export default VendingMachineLayout;
