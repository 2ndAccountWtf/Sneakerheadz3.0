import React, { useState, useMemo } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import type { ItemType, StorageItem } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import Img from '../components/Img';

const FILTERS: { label: string; type: ItemType }[] = [
    { label: 'All', type: 'All' },
    { label: 'Rations', type: 'food' },
    { label: 'Liquids', type: 'drinks' },
    { label: 'Arms', type: 'weapons' },
    { label: 'Gear', type: 'tools' },
    { label: '???', type: 'oddities' },
];

const RARITY_CLASS: Record<string, string> = {
    common: 'rarity-common',
    uncommon: 'rarity-uncommon',
    rare: 'rarity-rare',
    legendary: 'rarity-legendary',
};

const STAT_KEYS: { key: keyof StorageItem['stats']; label: string; color: string }[] = [
    { key: 'power', label: 'PWR', color: 'var(--bad)' },
    { key: 'energy', label: 'NRG', color: 'var(--warn)' },
    { key: 'freshness', label: 'FRS', color: 'var(--ok)' },
    { key: 'risk', label: 'RSK', color: 'var(--accent-2)' },
    { key: 'wackiness', label: 'WAK', color: 'var(--accent)' },
];

const RARITY_ORDER: Record<string, number> = { legendary: 4, rare: 3, uncommon: 2, common: 1 };
type SortKey = 'recent' | 'rarity' | 'name';

/**
 * Supply Cache. Rewritten onto the shared design system — it previously ran a
 * completely separate lime-and-black theme with its own fonts, which is a large
 * part of why the game didn't read as one product.
 */
const StorageScreen: React.FC = () => {
    const { gameState, useStorageItem, dispatch } = useGame();
    const { player, outcomeLog } = gameState;

    const [filters, setFilters] = useState<ItemType[]>(['All']);
    const [sort, setSort] = useState<SortKey>('recent');
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    const toggleFilter = (type: ItemType) => {
        if (type === 'All') return setFilters(['All']);
        const next = filters.includes('All')
            ? [type]
            : filters.includes(type) ? filters.filter(f => f !== type) : [...filters, type];
        setFilters(next.length ? next : ['All']);
    };

    const items = useMemo(() => {
        let list = [...player.storage];
        if (!filters.includes('All')) list = list.filter(i => filters.includes(i.type));
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(i => i.name.toLowerCase().includes(q) || i.tags.some(t => t.includes(q)));
        }
        if (sort === 'rarity') list.sort((a, b) => (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0));
        if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
        return list;
    }, [player.storage, filters, search, sort]);

    const totalItems = player.storage.reduce((n, i) => n + i.qty, 0);
    const usable = player.storage.filter(i => i.effects?.length).length;

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Supply <span className="accent">Cache</span></>}
                subtitle={`Unit-734 · ${totalItems} items · ${usable} usable`}
                back={Screen.Inventory}
                backLabel="Bag"
            />

            {/* Receipt from the last thing you ate */}
            {outcomeLog.length > 0 && (
                <div className="panel mb-4 divide-y divide-[var(--line)]">
                    <div className="panel-head">
                        <span className="label">Result</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'CLEAR_OUTCOME_LOG' })}>Dismiss</button>
                    </div>
                    {outcomeLog.map((e, i) => (
                        <div
                            key={i}
                            className="flex items-start gap-2.5 px-3 py-2 text-xs font-mono"
                            style={{ color: e.tone === 'good' ? 'var(--ok)' : e.tone === 'bad' ? 'var(--bad)' : 'var(--ink-dim)' }}
                        >
                            <span>{e.icon}</span><span className="flex-1">{e.text}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 pb-4 border-b border-[var(--line)]">
                <div className="flex flex-wrap gap-1.5">
                    {FILTERS.map(({ label, type }) => (
                        <button
                            key={type}
                            onClick={() => toggleFilter(type)}
                            className={`chip ${filters.includes(type) ? 'chip-accent' : 'hover:text-white'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2 sm:ml-auto">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search…"
                        className="bg-[var(--bg-sunken)] border border-[var(--line)] px-3 py-1.5 text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] min-w-0 flex-1 sm:w-36"
                    />
                    <select
                        value={sort}
                        onChange={e => setSort(e.target.value as SortKey)}
                        className="bg-[var(--bg-sunken)] border border-[var(--line)] px-2 py-1.5 text-xs font-mono uppercase text-[var(--ink-dim)] focus:outline-none focus:border-[var(--accent)]"
                    >
                        <option value="recent">Recent</option>
                        <option value="rarity">Rarity</option>
                        <option value="name">A–Z</option>
                    </select>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="panel p-10 text-center">
                    <div className="text-4xl mb-3">🗄️</div>
                    <p className="text-[var(--ink-dim)] mb-1">Cache empty.</p>
                    <p className="label">Restock at any AM/PM. Regret it later.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {items.map(item => {
                        const isOpen = expanded === item.id;
                        const canUse = !!item.effects?.length;

                        return (
                            <div key={item.id} className={`panel ${RARITY_CLASS[item.rarity]} flex flex-col`}>
                                <div className="h-[3px] w-full" style={{ background: 'var(--rarity)' }} />

                                <button
                                    className="relative h-24 bg-[var(--bg-sunken)] flex items-center justify-center overflow-hidden"
                                    onClick={() => setExpanded(isOpen ? null : item.id)}
                                >
                                    <Img fallback="📦" src={item.img} alt={item.name} loading="lazy" className="w-full h-full object-cover opacity-70" />
                                    {item.qty > 1 && (
                                        <span className="absolute top-1.5 right-1.5 chip !text-[9px] !py-0 bg-black/80">×{item.qty}</span>
                                    )}
                                    <span
                                        className="absolute bottom-1.5 left-1.5 chip !text-[9px] !py-0"
                                        style={{ borderColor: 'var(--rarity)', color: 'var(--rarity)' }}
                                    >
                                        {item.rarity}
                                    </span>
                                </button>

                                <div className="p-2.5 flex flex-col flex-grow gap-2">
                                    <h3 className="text-xs font-semibold text-white leading-tight line-clamp-2 min-h-[2.2em]">{item.name}</h3>

                                    {isOpen ? (
                                        <>
                                            <p className="text-[11px] text-[var(--ink-dim)] italic leading-snug">{item.flavor}</p>
                                            <div className="space-y-1">
                                                {STAT_KEYS.filter(s => item.stats[s.key] > 0).map(s => (
                                                    <div key={s.key} className="flex items-center gap-1.5">
                                                        <span className="label !text-[9px] w-7">{s.label}</span>
                                                        <div className="meter flex-1 !h-1">
                                                            <i style={{ width: `${Math.min(100, item.stats[s.key])}%`, background: s.color }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {item.tags.slice(0, 3).map(t => (
                                                    <span key={t} className="chip !text-[9px] !py-0">{t}</span>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-[11px] text-[var(--ink-faint)] line-clamp-2">{item.flavor}</p>
                                    )}

                                    <button
                                        className={`btn btn-sm w-full mt-auto ${canUse ? 'btn-primary' : ''}`}
                                        disabled={!canUse}
                                        onClick={() => useStorageItem(item.id)}
                                        title={canUse ? 'Effects are rolled, not guaranteed.' : 'Nothing happens when you use this.'}
                                    >
                                        {canUse ? (item.type === 'food' || item.type === 'drinks' ? 'Consume' : 'Use') : 'Inert'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="label text-center mt-5">
                Consumables roll on an effect table. You know the tendency, never the outcome.
            </p>
        </div>
    );
};

export default StorageScreen;
