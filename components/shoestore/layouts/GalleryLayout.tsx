import React from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';

/** Plinth materials, because a marble salon and a concrete museum are not the same room. */
const PLINTH: Record<string, { top: string; face: string }> = {
    marble: {
        top: 'linear-gradient(135deg, #f3efe6, #d8d2c4 45%, #efeae0)',
        face: 'linear-gradient(180deg, #cfc8b8, #8f8878)',
    },
    concrete: {
        top: 'linear-gradient(135deg, #5b5b57, #3e3e3b 50%, #4f4f4b)',
        face: 'linear-gradient(180deg, #3a3a37, #22221f)',
    },
    oak: {
        top: 'linear-gradient(135deg, #6b4c2a, #4a331b 55%, #5d4224)',
        face: 'linear-gradient(180deg, #3d2a15, #23170b)',
    },
};

/** Wall-label prose. Museums never just say "shoe". */
const MEDIUM: Record<string, string> = {
    Common: 'Synthetic upper, rubber cupsole. Edition unlimited.',
    Uncommon: 'Mesh and suede, factory-laced. Regional release.',
    Rare: 'Deadstock, original box, one owner on record.',
    Legendary: 'Provenance documented. Held in private hands since release.',
};

/**
 * GALLERY — SoHo Heat Museum, Le Marais Archives, Fifth Ave Grails.
 *
 * The opposite move to every other room in the game: almost nothing on screen,
 * a hairline rule instead of a border, serif type, and one object at a time.
 * Stock is a single wide column of exhibits — catalogue number and wall label on
 * the left, the pair lit on a plinth to the right — so scrolling feels like
 * walking a wing rather than scanning a grid.
 */
const GalleryLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => {
    const prefix = skin.knobs?.catalogPrefix ?? 'CAT';
    const plinth = PLINTH[skin.knobs?.plinth ?? 'concrete'];
    const hairline = alpha(skin.accent2 ?? '#ffffff', 0.18);

    return (
        <StoreStage skin={skin} className="pb-10">
            {/* A single wash of gallery lighting from above; no motion, this room is quiet */}
            <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-[420px] pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% -10%, ${alpha(skin.accent, 0.16)}, transparent 70%)` }}
            />

            <StoreShell width="narrow" className="relative py-6 sm:py-10">
                {/* ---- WALL TEXT ---- */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <ExitButton
                        onExit={onExit}
                        label="← Leave"
                        className="text-[11px] uppercase tracking-[0.3em] border-b pb-0.5 hover:opacity-70 transition-opacity"
                        style={{ color: skin.accent2, borderColor: hairline, fontFamily: 'var(--skin-body)' }}
                    />
                    <span className="label" style={{ color: alpha(skin.accent, 0.85) }}>{skin.label}</span>
                </div>

                <div className="text-center mb-8">
                    <h1
                        className="leading-tight break-words"
                        style={{
                            fontFamily: 'var(--skin-title)',
                            fontSize: 'clamp(1.6rem, 7vw, 3rem)',
                            color: skin.accent2,
                            letterSpacing: '0.01em',
                        }}
                    >
                        {store.name}
                    </h1>
                    {skin.motto && (
                        <div className="label mt-3" style={{ color: alpha(skin.accent, 0.9), letterSpacing: '0.35em' }}>
                            {skin.motto}
                        </div>
                    )}
                    <p
                        className="mt-4 mx-auto max-w-md text-sm italic"
                        style={{ color: 'var(--ink-dim)', fontFamily: 'var(--skin-title)' }}
                    >
                        {skin.tagline}
                    </p>
                    <div className="mt-6 mx-auto w-16 h-px" style={{ background: skin.accent }} />
                </div>

                {/* ---- ROOM TABS: small caps, hairline underline ---- */}
                {store.tabs.length > 1 && (
                    <div
                        className="flex flex-wrap justify-center gap-x-7 gap-y-2 mb-5 pb-3 border-b"
                        style={{ borderColor: hairline }}
                    >
                        {store.tabs.map(tab => {
                            const active = activeTab.id === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTabId(tab.id)}
                                    className="text-[11px] uppercase tracking-[0.28em] pb-1 transition-colors"
                                    style={{
                                        fontFamily: 'var(--skin-body)',
                                        color: active ? skin.accent : 'var(--ink-dim)',
                                        borderBottom: `1px solid ${active ? skin.accent : 'transparent'}`,
                                    }}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="flex flex-wrap justify-center gap-1.5 mb-8">{statusChips}</div>

                {/* ---- THE WING ---- */}
                {usePlainBody ? body : (
                    <div>
                        {items.map((item, i) => (
                            <article
                                key={`${item.id}-${item.price}-${item.isFake}`}
                                className="grid md:grid-cols-[1fr_240px] gap-6 md:gap-10 items-start py-8 border-t first:border-t-0"
                                style={{ borderColor: hairline }}
                            >
                                {/* Wall label */}
                                <div className="min-w-0">
                                    <div className="label mb-3" style={{ color: alpha(skin.accent, 0.9) }}>
                                        {prefix} {String(i + 1).padStart(3, '0')}
                                    </div>
                                    <h2
                                        className="leading-snug break-words"
                                        style={{ fontFamily: 'var(--skin-title)', fontSize: 'clamp(1.1rem, 4.5vw, 1.6rem)', color: skin.accent2 }}
                                    >
                                        {item.name}
                                    </h2>
                                    <p
                                        className="text-sm mt-2 italic"
                                        style={{ color: 'var(--ink-dim)', fontFamily: 'var(--skin-title)' }}
                                    >
                                        {item.rarity} — retail of record ${item.basePrice.toLocaleString()}, volatility {Math.round(item.volatility * 100)}%
                                    </p>
                                    <p className="text-sm mt-3 max-w-sm" style={{ color: 'var(--ink-dim)', fontFamily: 'var(--skin-body)' }}>
                                        {MEDIUM[item.rarity] ?? MEDIUM.Common}
                                    </p>
                                    <dl className="mt-4 text-xs space-y-1" style={{ fontFamily: 'var(--skin-body)', color: 'var(--ink-faint)' }}>
                                        <div className="flex gap-3">
                                            <dt className="uppercase tracking-[0.2em] w-24">Valuation</dt>
                                            <dd style={{ color: skin.accent }}>${item.price.toLocaleString()}</dd>
                                        </div>
                                        <div className="flex gap-3">
                                            <dt className="uppercase tracking-[0.2em] w-24">On the floor</dt>
                                            <dd>{item.quantity > 0 ? `${item.quantity} pair` : 'withdrawn'}</dd>
                                        </div>
                                        {item.isFake && (
                                            <div className="flex gap-3">
                                                <dt className="uppercase tracking-[0.2em] w-24">Attribution</dt>
                                                <dd style={{ color: 'var(--bad)' }}>disputed</dd>
                                            </div>
                                        )}
                                    </dl>
                                </div>

                                {/* The object, lit, on its plinth */}
                                <div className="relative mx-auto w-full max-w-[240px]">
                                    <div
                                        aria-hidden
                                        className="absolute -inset-6 -z-10"
                                        style={{ background: `radial-gradient(ellipse at 50% 30%, ${alpha(skin.accent, 0.18)}, transparent 72%)` }}
                                    />
                                    <div className="border" style={{ borderColor: hairline }}>
                                        <StoreSneakerCard
                                            sneaker={item}
                                            price={item.price}
                                            quantity={item.quantity}
                                            isFake={item.isFake}
                                            onAnalyse={() => onAnalyse(item.id)}
                                        />
                                    </div>
                                    {/* Plinth: a lid and a tapered face */}
                                    <div className="h-1.5" style={{ background: plinth.top }} />
                                    <div
                                        className="h-5 mx-auto"
                                        style={{ background: plinth.face, width: '88%', clipPath: 'polygon(0 0, 100% 0, 94% 100%, 6% 100%)' }}
                                    />
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {/* ---- VISITORS ---- */}
                <div className="mt-10 pt-6 border-t" style={{ borderColor: hairline }}>
                    <div className="label mb-3" style={{ color: alpha(skin.accent, 0.9), letterSpacing: '0.3em' }}>
                        In the room
                    </div>
                    {npcRail}
                </div>

                {store.copy?.tips?.length ? (
                    <p
                        className="mt-6 text-center text-xs italic"
                        style={{ color: 'var(--ink-faint)', fontFamily: 'var(--skin-title)' }}
                    >
                        {store.copy.tips[0]}
                    </p>
                ) : null}
            </StoreShell>
        </StoreStage>
    );
};

export default GalleryLayout;
