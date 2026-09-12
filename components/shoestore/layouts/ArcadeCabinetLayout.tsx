import React from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, ScrollRow, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';

/**
 * ARCADE CABINET — Akihabara.
 *
 * The store is a machine you are standing at: lit marquee on top, a bezelled
 * CRT in the middle, a coin door at the bottom. Tabs are the cabinet's row of
 * action buttons, the stock grid is a character-select screen, and hovering a
 * pair blinks a cursor at it.
 *
 * Everything is drawn with borders, gradients and two keyframes so the whole
 * thing still costs nothing and still collapses to one readable column on a
 * phone. The global `prefers-reduced-motion` rule in theme.css flattens the
 * blinking for anyone who asked for that.
 */
const ArcadeCabinetLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => {
    const knobs = skin.knobs ?? {};
    // Cabinet buttons are colour-coded like a real control panel.
    const buttonColours = [skin.accent, skin.accent2, skin.accent3 ?? skin.accent2, '#ffffff'];

    return (
        <StoreStage skin={skin} className="pb-6">
            <style>{`
                @keyframes arc-blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0.08 } }
                @keyframes arc-hum { 0%, 100% { opacity: .55 } 50% { opacity: .9 } }
                .arc-blink { animation: arc-blink 1.1s steps(1, end) infinite; }
                .arc-hum { animation: arc-hum 3.4s ease-in-out infinite; }
            `}</style>

            <StoreShell className="py-4 sm:py-6">
                {/* ---- MARQUEE: the lit sign screwed to the top of the cabinet ---- */}
                <div
                    className="relative rounded-t-[18px] border-2 border-b-0 px-3 py-3 sm:px-5 sm:py-4 overflow-hidden"
                    style={{
                        borderColor: skin.accent,
                        background: `linear-gradient(180deg, ${alpha(skin.accent2, 0.35)}, ${alpha(skin.accent, 0.12)} 60%, rgba(0,0,0,0.6))`,
                        boxShadow: `0 0 40px ${alpha(skin.accent, 0.3)}, inset 0 -14px 30px rgba(0,0,0,.55)`,
                    }}
                >
                    <div className="absolute inset-0 scanlines opacity-30 pointer-events-none" />
                    <div className="relative flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <div
                                className="uppercase leading-tight break-words text-glow"
                                style={{
                                    fontFamily: 'var(--skin-title)',
                                    color: '#fff',
                                    fontSize: 'clamp(11px, 3.4vw, 22px)',
                                    textShadow: `0 0 14px ${skin.accent}, 0 0 34px ${skin.accent2}`,
                                }}
                            >
                                {knobs.marquee ?? store.name}
                            </div>
                            <div className="label mt-1.5" style={{ color: skin.accent3 ?? skin.accent }}>
                                <span className="arc-blink">●</span> 1 CREDIT · {skin.label}
                            </div>
                        </div>
                        <ExitButton
                            onExit={onExit}
                            label="EXIT ▸"
                            className="btn btn-sm !rounded-full"
                            style={{ borderColor: skin.accent2, color: skin.accent2, background: 'rgba(0,0,0,.45)' }}
                        />
                    </div>
                </div>

                {/* ---- CABINET BODY: bezel, side art, CRT ---- */}
                <div
                    className="relative border-2 p-2 sm:p-3"
                    style={{
                        borderColor: skin.accent,
                        background: `linear-gradient(180deg, ${skin.surface ?? '#12172b'}, #05060f)`,
                        boxShadow: `inset 0 0 60px rgba(0,0,0,.8), 0 0 30px ${alpha(skin.accent, 0.18)}`,
                    }}
                >
                    {/* Painted side art — desktop only, it is decoration and nothing else */}
                    {[0, 1].map(side => (
                        <div
                            key={side}
                            aria-hidden
                            className="hidden xl:flex absolute top-0 bottom-0 w-7 flex-col items-center justify-around text-[10px] select-none pointer-events-none"
                            style={{
                                [side === 0 ? 'left' : 'right']: 0,
                                color: alpha(skin.accent2, 0.55),
                                writingMode: 'vertical-rl',
                                letterSpacing: '0.5em',
                            }}
                        >
                            {knobs.sideArt ?? '★▲●■'}
                        </div>
                    ))}

                    <div className="xl:mx-7">
                        {/* The screen itself */}
                        <div
                            className="relative border p-3 sm:p-4"
                            style={{
                                borderColor: alpha(skin.accent, 0.5),
                                background: 'radial-gradient(ellipse at 50% 40%, #0b1320 0%, #04060c 75%)',
                                boxShadow: `inset 0 0 70px rgba(0,0,0,.9), inset 0 0 20px ${alpha(skin.accent, 0.12)}`,
                            }}
                        >
                            {/* CRT artefacts: scanlines plus a cheap chromatic fringe */}
                            <div aria-hidden className="absolute inset-0 pointer-events-none scanlines opacity-40" />
                            <div
                                aria-hidden
                                className="absolute inset-0 pointer-events-none arc-hum mix-blend-screen"
                                style={{
                                    background: `radial-gradient(ellipse at 12% 0%, ${alpha(skin.accent2, 0.18)}, transparent 55%),
                                                 radial-gradient(ellipse at 88% 100%, ${alpha(skin.accent, 0.16)}, transparent 55%)`,
                                }}
                            />

                            <div className="relative">
                                <div
                                    className="uppercase mb-3"
                                    style={{ fontFamily: 'var(--skin-title)', fontSize: 'clamp(9px, 2.6vw, 13px)', color: skin.accent3 ?? skin.accent }}
                                >
                                    {skin.motto ?? 'SELECT YOUR FIGHTER'}
                                </div>
                                <p className="text-xs italic mb-3" style={{ color: 'var(--ink-dim)', fontFamily: 'var(--skin-body)' }}>
                                    {skin.tagline}
                                </p>

                                {/* HUD strip — the chips ShoeStore handed us, read as a score row */}
                                <div className="flex flex-wrap items-center gap-1.5 mb-4">{statusChips}</div>

                                {/* ---- CONTROL PANEL: tabs as cabinet buttons ---- */}
                                {store.tabs.length > 1 && (
                                    <ScrollRow className="mb-4 pb-2">
                                        {store.tabs.map((tab, i) => {
                                            const active = activeTab.id === tab.id;
                                            const colour = buttonColours[i % buttonColours.length];
                                            return (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    onClick={() => setActiveTabId(tab.id)}
                                                    className="flex-shrink-0 flex flex-col items-center gap-1.5 px-1 group"
                                                >
                                                    <span
                                                        className="w-9 h-9 rounded-full border-2 grid place-items-center text-[10px] transition-transform group-active:translate-y-[2px]"
                                                        style={{
                                                            borderColor: colour,
                                                            background: active ? colour : alpha(colour, 0.12),
                                                            color: active ? '#04060c' : colour,
                                                            boxShadow: active ? `0 0 16px ${alpha(colour, 0.75)}` : `inset 0 -3px 0 ${alpha('#000000', 0.45)}`,
                                                        }}
                                                    >
                                                        {i + 1}
                                                    </span>
                                                    <span
                                                        className="uppercase whitespace-nowrap"
                                                        style={{
                                                            fontFamily: 'var(--skin-title)',
                                                            fontSize: '7px',
                                                            letterSpacing: '0.05em',
                                                            color: active ? colour : 'var(--ink-faint)',
                                                        }}
                                                    >
                                                        {tab.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </ScrollRow>
                                )}

                                {/* ---- ROSTER ---- */}
                                {usePlainBody ? body : (
                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                                        {items.map((item, i) => (
                                            <div
                                                key={`${item.id}-${item.price}-${item.isFake}`}
                                                className="relative group focus-within:z-10"
                                            >
                                                {/* Roster slot number, arcade style */}
                                                <span
                                                    className="absolute -top-1.5 left-1.5 z-10 px-1 text-[7px] uppercase"
                                                    style={{
                                                        fontFamily: 'var(--skin-title)',
                                                        background: '#04060c',
                                                        color: alpha(skin.accent, 0.9),
                                                    }}
                                                >
                                                    P{i + 1}
                                                </span>
                                                {/* Blinking selection cursor */}
                                                <span
                                                    aria-hidden
                                                    className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 text-sm opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 arc-blink"
                                                    style={{ color: skin.accent2 }}
                                                >
                                                    ▶
                                                </span>
                                                <div
                                                    className="h-full border transition-shadow"
                                                    style={{
                                                        borderColor: alpha(skin.accent, 0.35),
                                                        boxShadow: `0 0 0 0 ${alpha(skin.accent2, 0)}`,
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
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ---- COIN DOOR ---- */}
                        <div
                            className="mt-3 border flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                            style={{ borderColor: alpha(skin.accent, 0.35), background: 'linear-gradient(180deg, #0a0d18, #05060c)' }}
                        >
                            <div className="flex items-center gap-2">
                                {/* coin slot */}
                                <span
                                    aria-hidden
                                    className="inline-block w-2.5 h-7 border"
                                    style={{ borderColor: alpha(skin.accent2, 0.7), background: '#000' }}
                                />
                                <span
                                    className="uppercase arc-blink"
                                    style={{ fontFamily: 'var(--skin-title)', fontSize: '8px', color: skin.accent3 ?? skin.accent }}
                                >
                                    {knobs.coinPrompt ?? 'INSERT COIN'}
                                </span>
                            </div>
                            <span className="label" style={{ color: 'var(--ink-faint)' }}>
                                HIGH SCORE · {store.name.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ---- SPECTATORS ---- */}
                <div className="mt-4">
                    <div
                        className="uppercase mb-2"
                        style={{ fontFamily: 'var(--skin-title)', fontSize: '9px', color: skin.accent2 }}
                    >
                        ▍ WATCHING YOU PLAY
                    </div>
                    {npcRail}
                </div>

                {store.copy?.tips?.length ? (
                    <p className="label mt-4 text-center" style={{ color: alpha(skin.accent, 0.8) }}>
                        ▸ {store.copy.tips[0]}
                    </p>
                ) : null}
            </StoreShell>
        </StoreStage>
    );
};

export default ArcadeCabinetLayout;
