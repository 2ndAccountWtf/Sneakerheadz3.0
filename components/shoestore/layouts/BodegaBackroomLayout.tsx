import React from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';
import type { SneakerItem } from '../../../types/shoestore';

/** Split the stock into shelf loads, because a shelf has an edge and a grid doesn't. */
const shelves = (items: SneakerItem[], per: number): SneakerItem[][] => {
    const out: SneakerItem[][] = [];
    for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
    return out;
};

/**
 * BODEGA BACK ROOM — Barrio Bodega (LA), Bed-Stuy back room (NY).
 *
 * A strip-lit room with wire shelving. Stock is stacked on actual shelves —
 * three to a shelf, each with a steel edge and a price-gun sticker — rather than
 * floated in a grid, and the only printed thing in the room is the receipt
 * taped to the wall, which is where the shop's own copy goes.
 *
 * The fluorescent tube flickers on a long cycle and the bead curtain is drawn
 * with box-shadows; both are decoration and both go quiet under
 * `prefers-reduced-motion`.
 */
const BodegaBackroomLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => {
    const steel = '#5a6360';

    return (
        <StoreStage skin={skin} className="pb-8">
            <style>{`
                @keyframes bod-tube { 0%,96%,100% { opacity: 1 } 97% { opacity: .35 } 98% { opacity: .85 } 99% { opacity: .5 } }
                .bod-tube { animation: bod-tube 9s linear infinite; }
            `}</style>

            <StoreShell className="relative py-4 sm:py-6">
                {/* ---- STRIP LIGHT ---- */}
                <div className="relative mb-4">
                    <div
                        className="bod-tube h-2 rounded-full"
                        style={{ background: `linear-gradient(90deg, transparent, ${skin.accent}, transparent)`, boxShadow: `0 0 32px ${alpha(skin.accent, 0.8)}` }}
                    />
                    <div
                        aria-hidden
                        className="absolute inset-x-0 top-2 h-24 pointer-events-none"
                        style={{ background: `linear-gradient(180deg, ${alpha(skin.accent, 0.16)}, transparent)` }}
                    />
                </div>

                {/* ---- SIGN + WAY OUT ---- */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                        <div className="label" style={{ color: skin.accent }}>{skin.label}</div>
                        <h1
                            className="uppercase mt-1 leading-none break-words"
                            style={{
                                fontFamily: 'var(--skin-title)',
                                fontSize: 'clamp(1.15rem, 5.4vw, 2.1rem)',
                                color: '#fff',
                                textShadow: `0 0 22px ${alpha(skin.accent, 0.5)}`,
                            }}
                        >
                            {store.name}
                        </h1>
                        {skin.motto && (
                            <p className="text-[11px] uppercase tracking-[0.14em] mt-1.5" style={{ color: skin.accent3 ?? skin.accent2, fontFamily: 'var(--skin-body)' }}>
                                {skin.motto}
                            </p>
                        )}
                    </div>
                    <ExitButton
                        onExit={onExit}
                        label="◂ OUT FRONT"
                        className="btn btn-sm"
                        style={{ borderColor: skin.accent, color: skin.accent, background: alpha('#000000', 0.4) }}
                    />
                </div>

                {/* ---- SHELF TALKERS (tabs) + WALL RECEIPT ---- */}
                <div className="grid lg:grid-cols-[1fr_230px] gap-3 items-start">
                    <div className="min-w-0">
                        {store.tabs.length > 1 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {store.tabs.map(tab => {
                                    const active = activeTab.id === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTabId(tab.id)}
                                            className="px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] border-2 -skew-x-6"
                                            style={{
                                                fontFamily: 'var(--skin-body)',
                                                fontWeight: 700,
                                                background: active ? (skin.accent3 ?? '#ffe066') : '#f4f1e4',
                                                color: '#1d1b16',
                                                borderColor: active ? '#1d1b16' : '#9c988a',
                                                boxShadow: active ? `0 0 14px ${alpha(skin.accent3 ?? skin.accent, 0.6)}` : undefined,
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex flex-wrap gap-1.5 mb-3">{statusChips}</div>

                        {/* ---- THE SHELVING ---- */}
                        {usePlainBody ? body : (
                            <div className="relative">
                                {/* bead curtain over the doorway into the back */}
                                <div aria-hidden className="absolute -top-1 inset-x-0 h-6 overflow-hidden pointer-events-none flex justify-between px-2">
                                    {Array.from({ length: 18 }).map((_, i) => (
                                        <span
                                            key={i}
                                            className="block w-[3px] rounded-full"
                                            style={{
                                                height: 10 + ((i * 7) % 14),
                                                background: i % 3 === 0 ? skin.accent2 : alpha('#ffffff', 0.35),
                                            }}
                                        />
                                    ))}
                                </div>

                                <div className="pt-6 space-y-5">
                                    {shelves(items, 3).map((load, row) => (
                                        <div key={row}>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                                                {load.map((item, i) => (
                                                    <div key={`${item.id}-${item.price}-${item.isFake}`} className="relative">
                                                        {/* price-gun sticker */}
                                                        <span
                                                            className="absolute top-1 left-1 z-20 px-1 text-[9px] -rotate-6"
                                                            style={{
                                                                background: skin.accent3 ?? '#ffe066',
                                                                color: '#1d1b16',
                                                                fontFamily: 'var(--skin-body)',
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {String.fromCharCode(65 + row)}{i + 1} · ${item.price.toLocaleString()}
                                                        </span>
                                                        <StoreSneakerCard
                                                            sneaker={item}
                                                            price={item.price}
                                                            quantity={item.quantity}
                                                            isFake={item.isFake}
                                                            onAnalyse={() => onAnalyse(item.id)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            {/* steel shelf edge with the aisle label stamped into it */}
                                            <div
                                                className="mt-1.5 flex items-center justify-between px-2 h-5"
                                                style={{
                                                    background: `linear-gradient(180deg, ${steel}, #2c3331)`,
                                                    boxShadow: '0 4px 10px rgba(0,0,0,.6)',
                                                    borderTop: `1px solid ${alpha('#ffffff', 0.25)}`,
                                                }}
                                            >
                                                <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: alpha('#ffffff', 0.65), fontFamily: 'var(--skin-body)' }}>
                                                    {skin.knobs?.aisle ?? 'AISLE 3'} · SHELF {row + 1}
                                                </span>
                                                <span className="text-[9px]" style={{ color: alpha('#ffffff', 0.4) }}>▌▌▌</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ---- RECEIPT TAPED TO THE WALL — the only white thing in here ---- */}
                    <aside
                        className="w-full lg:max-w-[230px] px-3 py-3 -rotate-1"
                        style={{
                            background: '#f7f5ec',
                            color: '#1d1b16',
                            fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
                            boxShadow: '0 10px 24px rgba(0,0,0,.5)',
                            clipPath: 'polygon(0 0, 100% 0, 100% 98%, 92% 100%, 78% 97%, 62% 100%, 46% 97%, 30% 100%, 14% 97%, 0 100%)',
                        }}
                    >
                        <div className="text-[10px] uppercase tracking-[0.16em] text-center border-b border-dashed border-black/40 pb-1.5">
                            {store.name}
                        </div>
                        <p className="text-[11px] mt-2 leading-snug italic">{skin.tagline}</p>
                        <div className="mt-2 border-t border-dashed border-black/40 pt-1.5 space-y-1 text-[10px]">
                            <div className="flex justify-between"><span>ITEMS ON SHELF</span><span>{items.length}</span></div>
                            <div className="flex justify-between"><span>SECTION</span><span>{activeTab.label}</span></div>
                            <div className="flex justify-between"><span>RETURNS</span><span>{store.policies.returns ?? 'none'}</span></div>
                        </div>
                        {store.copy?.tips?.length ? (
                            <p className="mt-2 border-t border-dashed border-black/40 pt-1.5 text-[10px] leading-snug">
                                ★ {store.copy.tips[0]}
                            </p>
                        ) : null}
                        <div className="text-center text-[9px] mt-2 tracking-[0.3em]">▌▌│▌║▌│║▌</div>
                    </aside>
                </div>

                {/* ---- AT THE COUNTER ---- */}
                <div className="mt-5">
                    <div className="label mb-2" style={{ color: skin.accent2 }}>AT THE COUNTER</div>
                    {npcRail}
                </div>
            </StoreShell>
        </StoreStage>
    );
};

export default BodegaBackroomLayout;
