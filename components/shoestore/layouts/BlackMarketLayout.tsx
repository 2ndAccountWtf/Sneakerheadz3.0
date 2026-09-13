import React from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';

/** A ragged edge, so the paper looks torn rather than cut. */
const TORN = 'polygon(0 0, 100% 0, 100% 92%, 92% 100%, 78% 94%, 64% 100%, 50% 93%, 36% 100%, 22% 94%, 8% 100%, 0 93%)';

/**
 * BLACK MARKET STALL — Canal St. tunnels, Gutter Gabe's trunk.
 *
 * Nothing here is square and nothing here is printed. Hazard tape across the
 * top, a lookout strip that never stops flashing, tabs as taped-on index cards,
 * and the stock crammed two-up on a phone with a biro price stuck over each
 * box. Every rotation lives inside the stage's `overflow-hidden`, so the mess
 * never turns into a scrollbar.
 */
const BlackMarketLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => {
    const paper = skin.surface ?? '#d8cfbc';
    const ink = '#1b1613';
    const knobs = skin.knobs ?? {};

    return (
        <StoreStage skin={skin} className="pb-8">
            <style>{`
                @keyframes bm-flicker { 0%,100% { opacity: 1 } 48% { opacity: .35 } 52% { opacity: 1 } }
                .bm-flicker { animation: bm-flicker 1.6s steps(2, end) infinite; }
            `}</style>

            {/* ---- HAZARD TAPE: deliberately wider than the column, and crooked ---- */}
            <div
                aria-hidden
                className="relative -mx-4 w-[115%] h-7 -rotate-[1.4deg] mb-3"
                style={{
                    backgroundImage: `repeating-linear-gradient(45deg, ${skin.accent2} 0 14px, #16110c 14px 28px)`,
                    boxShadow: '0 6px 18px rgba(0,0,0,.6)',
                }}
            />

            <StoreShell className="relative pb-2">
                {/* ---- LOOKOUT STRIP ---- */}
                <div
                    className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 mb-3 border"
                    style={{ borderColor: skin.accent, background: alpha(skin.accent, 0.14) }}
                >
                    <span className="bm-flicker text-[10px]" style={{ color: skin.accent }}>●</span>
                    <span
                        className="uppercase text-[10px] tracking-[0.2em]"
                        style={{ color: skin.accent, fontFamily: 'var(--skin-body)' }}
                    >
                        {knobs.lookout ?? 'LOOKOUT POSTED'}
                    </span>
                    <span className="flex-1" />
                    <ExitButton
                        onExit={onExit}
                        label="◂ WALK AWAY"
                        className="text-[10px] uppercase tracking-[0.2em] px-2 py-1 border"
                        style={{ borderColor: skin.accent, color: skin.accent, background: 'rgba(0,0,0,.4)', fontFamily: 'var(--skin-body)' }}
                    />
                </div>

                {/* ---- TORN PAPER HEADER, taped to the wall crooked ---- */}
                <div className="relative -rotate-[0.9deg] mb-4">
                    {/* tape */}
                    <span
                        aria-hidden
                        className="absolute -top-2.5 left-6 w-16 h-5 rotate-[7deg]"
                        style={{ background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.18)' }}
                    />
                    <div
                        className="px-3 pt-3 pb-5"
                        style={{ background: paper, clipPath: TORN, boxShadow: '0 10px 26px rgba(0,0,0,.65)' }}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div
                                    className="uppercase text-[10px] tracking-[0.2em]"
                                    style={{ color: '#6b5f52', fontFamily: 'var(--skin-body)' }}
                                >
                                    {skin.label}
                                </div>
                                <h1
                                    className="uppercase leading-none mt-1 break-words"
                                    style={{
                                        fontFamily: 'var(--skin-title)',
                                        fontSize: 'clamp(1.15rem, 5.6vw, 2.1rem)',
                                        color: ink,
                                    }}
                                >
                                    {store.name}
                                </h1>
                                <p className="text-[13px] mt-1.5" style={{ color: '#4b4139', fontFamily: 'var(--skin-body)' }}>
                                    {skin.tagline}
                                </p>
                            </div>
                            {/* rubber stamp */}
                            <span
                                className="flex-shrink-0 -rotate-[11deg] border-[3px] px-2 py-1 text-[10px] uppercase tracking-[0.16em] whitespace-nowrap"
                                style={{ borderColor: alpha(skin.accent, 0.75), color: alpha(skin.accent, 0.85), fontFamily: 'var(--skin-body)' }}
                            >
                                {knobs.stamp ?? 'CASH ONLY'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ---- TABS: index cards, taped on at whatever angle ---- */}
                {store.tabs.length > 1 && (
                    <div className="flex flex-wrap gap-2 mb-4 pt-1">
                        {store.tabs.map((tab, i) => {
                            const active = activeTab.id === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTabId(tab.id)}
                                    className="px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] border-2 transition-transform"
                                    style={{
                                        fontFamily: 'var(--skin-body)',
                                        transform: `rotate(${i % 2 === 0 ? -1.6 : 1.3}deg)`,
                                        background: active ? skin.accent : paper,
                                        color: active ? '#140404' : ink,
                                        borderColor: active ? '#140404' : '#8d8173',
                                        boxShadow: '2px 3px 0 rgba(0,0,0,.55)',
                                    }}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-4">{statusChips}</div>

                {/* ---- THE MERCHANDISE, crammed in ---- */}
                {usePlainBody ? body : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-2">
                        {items.map((item, i) => (
                            <div
                                key={`${item.id}-${item.price}-${item.isFake}`}
                                className="relative"
                                style={{ transform: `rotate(${(i % 3) - 1}deg)` }}
                            >
                                {/* tape at the top corner */}
                                <span
                                    aria-hidden
                                    className="absolute -top-1.5 left-3 z-20 w-10 h-4 -rotate-6"
                                    style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.16)' }}
                                />
                                {/* biro price, stuck on over the box */}
                                <span
                                    className="absolute -top-2 -right-1 z-20 px-1.5 py-0.5 rotate-[7deg] text-[11px] whitespace-nowrap"
                                    style={{
                                        background: paper,
                                        color: skin.accent,
                                        border: `1px solid ${alpha('#000000', 0.5)}`,
                                        fontFamily: 'var(--skin-body)',
                                        boxShadow: '1px 2px 0 rgba(0,0,0,.5)',
                                    }}
                                >
                                    ${item.price.toLocaleString()} cash
                                </span>
                                <div className="h-full" style={{ boxShadow: '3px 4px 0 rgba(0,0,0,.55)' }}>
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

                {/* ---- WHO ELSE IS IN THE ALLEY ---- */}
                <div className="mt-5 rotate-[0.5deg]">
                    <div
                        className="inline-block px-2 py-0.5 mb-2 text-[10px] uppercase tracking-[0.2em] -rotate-1"
                        style={{ background: paper, color: ink, fontFamily: 'var(--skin-body)' }}
                    >
                        who else is down here
                    </div>
                    {npcRail}
                </div>

                {store.copy?.tips?.length ? (
                    <p
                        className="mt-4 text-[12px] -rotate-[0.6deg]"
                        style={{ color: alpha(skin.accent2, 0.9), fontFamily: 'var(--skin-body)' }}
                    >
                        ✗ {store.copy.tips[0]}
                    </p>
                ) : null}
            </StoreShell>

            {/* ---- second run of tape at the bottom, to close the stall off ---- */}
            <div
                aria-hidden
                className="relative -mx-4 w-[115%] h-5 rotate-[1.1deg] mt-5"
                style={{ backgroundImage: `repeating-linear-gradient(45deg, ${skin.accent2} 0 12px, #16110c 12px 24px)` }}
            />
        </StoreStage>
    );
};

export default BlackMarketLayout;
