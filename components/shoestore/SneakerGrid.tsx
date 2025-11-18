
import React, { useEffect, useRef } from 'react';
import { SneakerItem } from '../../types/shoestore';
import SneakerCard from '../SneakerCard';

interface SneakerGridProps {
    items: SneakerItem[];
    onSneakerInView: (item: SneakerItem | null) => void;
}

export const SneakerGrid: React.FC<SneakerGridProps> = ({ items, onSneakerInView }) => {
    const gridRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        itemRefs.current = itemRefs.current.slice(0, items.length);
    }, [items]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visibleEntry = entries.find(entry => entry.isIntersecting && entry.intersectionRatio > 0.5);
                if (visibleEntry) {
                    const index = itemRefs.current.findIndex(ref => ref === visibleEntry.target);
                    if (index !== -1 && items[index]) {
                        onSneakerInView(items[index]);
                    }
                }
            },
            {
                root: gridRef.current,
                threshold: 0.5,
            }
        );

        const currentRefs = itemRefs.current;
        currentRefs.forEach(ref => {
            if (ref) observer.observe(ref);
        });

        if (items.length > 0) {
            onSneakerInView(items[0]);
        } else {
            onSneakerInView(null);
        }

        return () => {
            currentRefs.forEach(ref => {
                if (ref) observer.unobserve(ref);
            });
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, onSneakerInView]);


    if (items.length === 0) {
        return <p className="text-center text-gray-400 mt-8 h-96 flex items-center justify-center font-['Space_Mono']">NO STOCK MATCHING FILTERS.</p>;
    }

    return (
        <div 
            ref={gridRef} 
            className="flex gap-4 sm:gap-6 overflow-x-auto py-4 snap-x snap-mandatory scrollbar-hide 
                       lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:gap-8 lg:overflow-y-auto lg:snap-none"
        >
            {items.map((item, index) => (
                <div 
                    key={item.id} 
                    ref={el => itemRefs.current[index] = el}
                    className="w-60 sm:w-64 flex-shrink-0 lg:w-auto"
                >
                    <SneakerCard
                        sneaker={item}
                        price={item.price}
                        quantity={item.quantity}
                        variant="store"
                        isFake={item.isFake}
                    />
                </div>
            ))}
        </div>
    );
};
