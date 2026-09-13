import React from 'react';
import type { StoreLayoutProps } from './types';
import { StoreStage, StoreShell, ExitButton, alpha } from './kit';
import { StoreSneakerCard } from '../../SneakerCard';

/**
 * ATELIER — Rue Norvins, Paris.
 *
 * The only room in the game lit from the front: a drafting board in daylight,
 * ink on cream. Stock is presented as pattern pieces on the board — a dashed
 * cutting outline, a numbered annotation bubble, a dimension line whose
 * measurement is the price — with the sample itself pinned inside the outline.
 *
 * Because the ground is light, everything the shared components draw dark (the
 * store card, the chips, the NPC rail) is treated as a pinned object with a
 * shadow rather than fought with. One narrow column, a lot of paper.
 */
const AtelierLayout: React.FC<StoreLayoutProps> = ({
    store, skin, items, activeTab, setActiveTabId, onAnalyse, onExit, body, npcRail, statusChips, usePlainBody,
}) => {
    const ink = skin.ink ?? '#2b2620';
    const rule = alpha(ink, 0.35);

    return (
        <StoreStage skin={skin} className="pb-10">
            {/* Graph paper: fine grid, coarse grid, both in ink at low strength */}
            <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: `repeating-linear-gradient(90deg, ${alpha(ink, 0.07)} 0 1px, transparent 1px 12px),
                                      repeating-linear-gradient(180deg, ${alpha(ink, 0.07)} 0 1px, transparent 1px 12px),
                                      repeating-linear-gradient(90deg, ${alpha(ink, 0.13)} 0 1px, transparent 1px 60px),
                                      repeating-linear-gradient(180deg, ${alpha(ink, 0.13)} 0 1px, transparent 1px 60px)`,
                }}
            />

            <StoreShell width="narrow" className="relative py-5 sm:py-8">
                {/* ---- TITLE BLOCK, bottom-right on a real drawing, top here so it reads first ---- */}
                <div className="border-2 mb-6" style={{ borderColor: ink }}>
                    <div className="flex items-start justify-between gap-3 px-3 py-3 border-b" style={{ borderColor: rule }}>
                        <div className="min-w-0">
                            <div
                                className="text-[10px] uppercase tracking-[0.28em]"
                                style={{ color: alpha(ink, 0.6), fontFamily: 'var(--skin-body)' }}
                            >
                                {skin.label} · {skin.motto ?? 'ÉCHELLE 1:1'}
                            </div>
                            <h1
                                className="mt-1.5 leading-tight break-words"
                                style={{ fontFamily: 'var(--skin-title)', fontSize: 'clamp(1.4rem, 6.4vw, 2.5rem)', color: ink }}
                            >
                                {store.name}
                            </h1>
                            <p className="text-sm italic mt-1.5" style={{ color: alpha(ink, 0.75), fontFamily: 'var(--skin-title)' }}>
                                {skin.tagline}
                            </p>
                        </div>
                        <ExitButton
                            onExit={onExit}
                            label="← Sortie"
                            className="text-[11px] uppercase tracking-[0.22em] border px-2 py-1"
                            style={{ color: ink, borderColor: ink, fontFamily: 'var(--skin-body)' }}
                        />
                    </div>
                    {/* the fields along the bottom of a title block */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 text-[10px] uppercase tracking-[0.14em]" style={{ fontFamily: 'var(--skin-body)' }}>
                        {[
                            ['Planche', activeTab.label],
                            ['Pièces', String(items.length)],
                            ['Taxe', `${store.pricing.taxPct}%`],
                            ['Retours', store.policies.returns ?? 'néant'],
                        ].map(([k, v], i) => (
                            <div
                                key={k}
                                className="px-3 py-2 border-t sm:border-t-0 sm:border-l first:sm:border-l-0"
                                style={{ borderColor: rule, color: alpha(ink, 0.6) }}
                            >
                                <div>{k}</div>
                                <div className="mt-0.5 normal-case tracking-normal text-[12px]" style={{ color: ink }}>{v}</div>
                                <span className="hidden">{i}</span>
                            </div>
                        ))}
                    </div>
                    {skin.knobs?.titleBlock && (
                        <div
                            className="px-3 py-1.5 border-t text-[10px] uppercase tracking-[0.2em]"
                            style={{ borderColor: rule, color: alpha(ink, 0.55), fontFamily: 'var(--skin-body)' }}
                        >
                            {skin.knobs.titleBlock}
                        </div>
                    )}
                </div>

                {/* ---- DRAWER TABS ---- */}
                {store.tabs.length > 1 && (
                    <div className="flex flex-wrap gap-2 mb-5">
                        {store.tabs.map(tab => {
                            const active = activeTab.id === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTabId(tab.id)}
                                    className="px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] border"
                                    style={{
                                        fontFamily: 'var(--skin-body)',
                                        borderColor: ink,
                                        background: active ? ink : 'transparent',
                                        color: active ? (skin.surface ?? '#efe7d6') : ink,
                                    }}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Chips are drawn for dark rooms, so they get a dark strip to live on */}
                <div
                    className="flex flex-wrap gap-1.5 p-2 mb-6"
                    style={{ background: ink, boxShadow: `4px 4px 0 ${alpha(ink, 0.2)}` }}
                >
                    {statusChips}
                </div>

                {/* ---- THE BOARD ---- */}
                {usePlainBody ? (
                    <div style={{ background: ink, padding: 8 }}>{body}</div>
                ) : (
                    <div className="space-y-8">
                        {items.map((item, i) => (
                            <section key={`${item.id}-${item.price}-${item.isFake}`} className="relative">
                                {/* annotation bubble and leader line */}
                                <div className="flex items-start gap-3">
                                    <span
                                        className="flex-shrink-0 w-7 h-7 rounded-full border grid place-items-center text-[11px]"
                                        style={{ borderColor: ink, color: ink, fontFamily: 'var(--skin-body)' }}
                                    >
                                        {i + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <h2
                                            className="leading-snug break-words"
                                            style={{ fontFamily: 'var(--skin-title)', fontSize: 'clamp(1rem, 4.4vw, 1.35rem)', color: ink }}
                                        >
                                            {item.name}
                                        </h2>
                                        <p className="text-[12px] italic" style={{ color: alpha(ink, 0.7), fontFamily: 'var(--skin-title)' }}>
                                            Pièce {String(i + 1).padStart(2, '0')} — {item.rarity.toLowerCase()},
                                            {item.quantity > 0 ? ` ${item.quantity} paire(s) en atelier` : ' hors stock'}
                                            {item.isFake ? ', contrefaçon' : ''}
                                        </p>
                                    </div>
                                </div>

                                {/* cutting outline, with the sample pinned inside it */}
                                <div
                                    className="mt-3 p-3 sm:p-5"
                                    style={{ border: `1px dashed ${alpha(ink, 0.55)}` }}
                                >
                                    <div className="mx-auto max-w-[250px] rotate-[-0.8deg]" style={{ boxShadow: `6px 8px 18px ${alpha(ink, 0.28)}` }}>
                                        <StoreSneakerCard
                                            sneaker={item}
                                            price={item.price}
                                            quantity={item.quantity}
                                            isFake={item.isFake}
                                            onAnalyse={() => onAnalyse(item.id)}
                                        />
                                    </div>

                                    {/* dimension line: the measurement is the price */}
                                    <div className="mt-4 flex items-center gap-2" style={{ color: alpha(ink, 0.8) }}>
                                        <span className="text-[10px]">├</span>
                                        <span className="flex-1 h-px" style={{ background: alpha(ink, 0.45) }} />
                                        <span
                                            className="text-[11px] px-2 whitespace-nowrap"
                                            style={{ fontFamily: 'var(--skin-body)', background: skin.surface ?? '#efe7d6' }}
                                        >
                                            {item.price.toLocaleString()} € net
                                        </span>
                                        <span className="flex-1 h-px" style={{ background: alpha(ink, 0.45) }} />
                                        <span className="text-[10px]">┤</span>
                                    </div>
                                </div>
                            </section>
                        ))}
                    </div>
                )}

                {/* ---- VISITEURS ---- */}
                <div className="mt-9">
                    <div
                        className="text-[10px] uppercase tracking-[0.3em] mb-2"
                        style={{ color: alpha(ink, 0.6), fontFamily: 'var(--skin-body)' }}
                    >
                        Visiteurs de l’atelier
                    </div>
                    <div style={{ boxShadow: `6px 8px 18px ${alpha(ink, 0.25)}` }}>{npcRail}</div>
                </div>

                {store.copy?.tips?.length ? (
                    <p
                        className="mt-6 text-[12px] italic"
                        style={{ color: alpha(ink, 0.7), fontFamily: 'var(--skin-title)' }}
                    >
                        Note de l’atelier — {store.copy.tips[0]}
                    </p>
                ) : null}
            </StoreShell>
        </StoreStage>
    );
};

export default AtelierLayout;
