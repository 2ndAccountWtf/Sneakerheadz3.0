
import React from 'react';
import { storageTheme } from './storage.theme';
import type { ItemType } from '../../types';

interface StorageFiltersProps {
    activeFilters: string[];
    setActiveFilters: (filters: string[]) => void;
    sort: string;
    setSort: (sort: string) => void;
    setSearch: (search: string) => void;
}

const filterCategories: { name: string, type: ItemType }[] = [
    { name: 'ALL', type: 'All' },
    { name: 'RATIONS', type: 'food' },
    { name: 'LIQUIDS', type: 'drinks' },
    { name: 'ARMS', type: 'weapons' },
    { name: 'GEAR', type: 'tools' },
    { name: '???', type: 'oddities' },
];

const sortOptions = ['Recently Added', 'Rarity', 'Name A–Z'];

export const StorageFilters: React.FC<StorageFiltersProps> = ({ activeFilters, setActiveFilters, sort, setSort, setSearch }) => {

    const handleFilterClick = (type: ItemType) => {
        if (type === 'All') {
            setActiveFilters(['All']);
        } else {
            const newFilters = activeFilters.includes('All')
                ? [type]
                : activeFilters.includes(type)
                    ? activeFilters.filter(f => f !== type)
                    : [...activeFilters, type];
            
            if (newFilters.length === 0) {
                setActiveFilters(['All']);
            } else {
                setActiveFilters(newFilters);
            }
        }
    };
    
    return (
        <div className="mb-8 flex flex-col lg:flex-row gap-6 items-start lg:items-center border-b border-[#222] pb-6">
            {/* Type Chips */}
            <div className="flex flex-wrap gap-2">
                {filterCategories.map(({ name, type }) => {
                    const isActive = activeFilters.includes(type);
                    return (
                        <button
                            key={type}
                            onClick={() => handleFilterClick(type)}
                            className={`
                                relative px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200
                                ${isActive ? 'text-black' : 'text-gray-500 hover:text-white'}
                            `}
                            style={{
                                fontFamily: storageTheme.fonts.mono,
                                backgroundColor: isActive ? storageTheme.colors.volt : '#111',
                                clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                            }}
                        >
                            {name}
                        </button>
                    );
                })}
            </div>

            <div className="flex-grow"></div>

            {/* Sort & Search */}
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[#333] to-[#111] opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                    <select 
                        value={sort} 
                        onChange={(e) => setSort(e.target.value)}
                        className="relative w-full bg-black border border-[#333] text-gray-300 text-xs uppercase tracking-wider py-2 px-4 focus:outline-none focus:border-[#ccff00]"
                        style={{ fontFamily: storageTheme.fonts.mono }}
                    >
                        {sortOptions.map(opt => <option key={opt}>{opt}</option>)}
                    </select>
                </div>
                
                <div className="relative group flex-grow">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[#333] to-[#111] opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                    <input
                        type="search"
                        placeholder="SEARCH_DB..."
                        onChange={(e) => setSearch(e.target.value)}
                        className="relative w-full bg-black border border-[#333] text-white text-xs uppercase tracking-wider py-2 px-4 placeholder-gray-700 focus:outline-none focus:border-[#ccff00]"
                        style={{ fontFamily: storageTheme.fonts.mono }}
                    />
                </div>
            </div>
        </div>
    );
};
