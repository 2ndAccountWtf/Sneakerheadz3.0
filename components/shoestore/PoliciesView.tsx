import React from 'react';
// FIX: Replaced non-existent ThemeProps with StoreTheme and updated import.
import { StoreTheme, PolicyProps } from '../../types/shoestore';

interface PoliciesViewProps {
    policies: PolicyProps;
    theme: StoreTheme;
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({ policies, theme }) => {
    return (
        <div className="mt-8 p-4 bg-gray-800/50 border border-cyan-500/20">
            <h3 className="text-lg font-bold text-cyan-400 mb-2">Store Policies</h3>
            <p className="text-sm text-gray-300">Returns: {policies.returns?.replace(/-/g, ' ')}</p>
        </div>
    );
};