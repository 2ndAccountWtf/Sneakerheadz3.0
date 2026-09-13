import React from 'react';
import Header from './Header';
import BottomNav from './BottomNav';
import InteractionView from './interactions/InteractionView';
import NewsModal from './news/NewsModal';
import CutsceneView from './cutscene/CutsceneView';
import EmergencyBanner from './EmergencyBanner';
import CityEventModal from './CityEventModal';
import MiniGameHost from './minigames/MiniGameHost';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';

/**
 * Store screens paint their own full-bleed environment, so the standard
 * padded content column steps out of the way for them. Everything else sits
 * in one consistent max-width column with room for the fixed nav.
 */
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { gameState } = useGame();
    const isImmersive = gameState.currentScreen === Screen.ShoeStore;

    return (
        <>
            {/* Ambient backdrop */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 grid-bg opacity-60 animate-[pan_90s_linear_infinite]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_10%,var(--bg)_85%)]" />
                <div className="absolute inset-0 scanlines opacity-[0.35]" />
            </div>

            <div className="relative z-10 min-h-screen flex flex-col">
                <Header />
                <main
                    key={gameState.currentScreen}
                    className={
                        isImmersive
                            ? 'flex-grow w-full screen-enter safe-bottom'
                            : 'flex-grow w-full max-w-6xl mx-auto px-3 sm:px-5 pt-4 sm:pt-6 screen-enter safe-bottom'
                    }
                >
                    {children}
                </main>
            </div>

            <BottomNav />
            <InteractionView />
            <MiniGameHost />
            <CutsceneView />
            <NewsModal />
            <CityEventModal />
            <EmergencyBanner />
        </>
    );
};

export default Layout;
