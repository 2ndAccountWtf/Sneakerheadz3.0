
import React, { useState, useMemo } from 'react';
import { useGame } from '../hooks/useGame';
import { StorageHeader } from '../components/storage/StorageHeader';
import { StorageFilters } from '../components/storage/StorageFilters';
import { StorageGrid } from '../components/storage/StorageGrid';
import { StorageEmpty } from '../components/storage/StorageEmpty';
import { storageTheme } from '../components/storage/storage.theme';

const StorageScreen: React.FC = () => {
    const { gameState, useStorageItem } = useGame();
    const [activeFilters, setActiveFilters] = useState<string[]>(['All']);
    const [sort, setSort] = useState('Recently Added');
    const [search, setSearch] = useState('');
    const [expandedCard, setExpandedCard] = useState<string | null>(null);

    const filteredItems = useMemo(() => {
        let items = [...gameState.player.storage];

        // Filter by type
        if (!activeFilters.includes('All')) {
            items = items.filter(item => activeFilters.includes(item.type));
        }

        // Filter by search term
        if (search.trim()) {
            items = items.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
        }

        // Sort
        if (sort === 'Rarity') {
            const rarityOrder = { 'legendary': 4, 'rare': 3, 'uncommon': 2, 'common': 1 };
            items.sort((a, b) => (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0));
        } else if (sort === 'Name A–Z') {
            items.sort((a, b) => a.name.localeCompare(b.name));
        }
        // 'Recently Added' is the default, no sort needed as mock is static

        return items;
    }, [activeFilters, sort, search, gameState.player.storage]);
    
    const css = `
        .storage-container {
            background-color: #050505;
            background-image: 
                linear-gradient(#111 1px, transparent 1px),
                linear-gradient(90deg, #111 1px, transparent 1px);
            background-size: 40px 40px;
            min-height: calc(100vh - 80px);
            position: relative;
        }
        .storage-container::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; height: 200px;
            background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
            pointer-events: none;
        }
    `;

    return (
        <div className="storage-container p-4 sm:p-8 text-gray-200">
            <style>{css}</style>
            <div className="relative z-10 max-w-7xl mx-auto">
                <StorageHeader />
                <StorageFilters 
                    activeFilters={activeFilters}
                    setActiveFilters={setActiveFilters}
                    sort={sort}
                    setSort={setSort}
                    setSearch={setSearch}
                />
                {filteredItems.length > 0 ? (
                    <StorageGrid 
                        items={filteredItems} 
                        expandedCard={expandedCard}
                        setExpandedCard={setExpandedCard}
                        onUseItem={useStorageItem}
                    />
                ) : (
                    <StorageEmpty />
                )}
            </div>
        </div>
    );
};

export default StorageScreen;
