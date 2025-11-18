
import React from 'react';
import Header from './Header';
import BottomNav from './BottomNav';
import InteractionView from './interactions/InteractionView';
import NewsModal from './news/NewsModal';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <>
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* Moving Grid Background */}
                <div className="absolute inset-0 bg-grid opacity-20 animate-[pan_60s_linear_infinite]" 
                     style={{ backgroundSize: '40px 40px' }} />
                {/* Radial Vignette */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#05080a_90%)]" />
                {/* Subtle vertical scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.1)_50%,transparent_50%)] bg-[length:4px_100%] opacity-20 pointer-events-none" />
            </div>

            <div className="min-h-screen bg-transparent text-cyan-300 font-mono flex flex-col relative z-10 pb-24">
                <Header />
                <main className="flex-grow w-full max-w-7xl mx-auto p-4 sm:p-6 screen-enter">
                    {children}
                </main>
            </div>
            
            <BottomNav />
            <InteractionView />
            <NewsModal />
        </>
    );
};

export default Layout;
    