import React from 'react';
import { StorageItem } from '../../types';
import { StorageCard } from './StorageCard';

interface StorageGridProps {
    items: StorageItem[];
    expandedCard: string | null;
    setExpandedCard: (id: string | null) => void;
    onUseItem: (itemId: string) => void;
}

export const StorageGrid: React.FC<StorageGridProps> = ({ items, expandedCard, setExpandedCard, onUseItem }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {items.map(item => (
                <StorageCard 
                    key={item.id} 
                    item={item} 
                    isExpanded={expandedCard === item.id}
                    onToggleExpand={() => setExpandedCard(expandedCard === item.id ? null : item.id)}
                    onUseItem={onUseItem}
                />
            ))}
        </div>
    );
};