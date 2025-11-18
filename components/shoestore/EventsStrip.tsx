import React from 'react';
import { DropSystemProps } from '../../types/shoestore';

interface EventsStripProps {
    drops?: DropSystemProps;
}

export const EventsStrip: React.FC<EventsStripProps> = ({ drops }) => {
    if (!drops?.upcoming?.length) {
        return null;
    }
    return (
        <div className="absolute top-28 right-4 bg-yellow-500 text-black font-bold p-2 text-sm animate-pulse">
            <p>Upcoming Drop: {drops.upcoming[0].modelId}</p>
        </div>
    );
};
