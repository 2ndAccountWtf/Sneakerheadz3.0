import React from 'react';
// FIX: Replaced non-existent ThemeProps with StoreTheme and updated import.
import { StoreTheme, NPCRef } from '../../types/shoestore';

interface StaffDockProps {
    staff: { manager?: NPCRef; clerks: NPCRef[]; checker?: NPCRef };
    theme: StoreTheme;
}

export const StaffDock: React.FC<StaffDockProps> = ({ staff, theme }) => {
    return (
        <div className="fixed bottom-20 left-4 bg-gray-900/80 p-2 border-2 border-cyan-500/50 rounded-lg">
            <h4 className="text-sm font-bold text-center border-b border-gray-600 mb-2">Staff</h4>
            {staff.manager && <p className="text-xs text-white">{staff.manager.name} (Manager)</p>}
        </div>
    );
};