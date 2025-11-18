
import React from 'react';
import { storageTheme } from './storage.theme';

export const StorageHeader: React.FC = () => {
    return (
        <header className="mb-8 border-b-2 border-[#333] pb-4 flex flex-col md:flex-row justify-between items-end uppercase tracking-tighter">
            <div>
                <h1 className="text-6xl md:text-7xl leading-none text-white" style={{ fontFamily: storageTheme.fonts.header }}>
                    Supply<span style={{ color: storageTheme.colors.volt }}>Cache</span>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                     <div className="h-2 w-2 bg-[#ccff00] animate-pulse"></div>
                     <p className="text-xs text-[#666] tracking-[0.2em]" style={{ fontFamily: storageTheme.fonts.mono }}>
                        SECURE STORAGE // UNIT-734
                    </p>
                </div>
            </div>
            
            <div className="text-right hidden md:block opacity-50">
                <div className="text-[10px] text-[#666]" style={{ fontFamily: storageTheme.fonts.mono }}>
                    CAPACITY STATUS
                </div>
                <div className="flex gap-1 mt-1">
                    {[...Array(10)].map((_, i) => (
                        <div key={i} className={`w-2 h-4 ${i < 3 ? 'bg-[#ccff00]' : 'bg-[#333]'}`}></div>
                    ))}
                </div>
            </div>
        </header>
    );
};
