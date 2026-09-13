import React from 'react';
import { GameProvider, useGame } from './hooks/useGame';
import DashboardScreen from './screens/DashboardScreen';
import TravelScreen from './screens/TravelScreen';
import CityStoresScreen from './screens/CityStoresScreen';
import ShoeStoreScreen from './screens/ShoeStoreScreen';
import InventoryScreen from './screens/InventoryScreen';
import AmpmScreen from './screens/AmpmScreen';
import SocialScreen from './screens/SocialScreen';
import StorageScreen from './screens/StorageScreen';
import StatsScreen from './screens/StatsScreen';
import CityFeedScreen from './screens/CityFeedScreen';
import MarketAnalysisScreen from './screens/MarketAnalysisScreen';
import ArcadeScreen from './screens/ArcadeScreen';
import QuestsScreen from './screens/QuestsScreen';
import BathroomsScreen from './screens/BathroomsScreen';
import VenuesScreen from './screens/VenuesScreen';
import { Screen } from './types';
import Layout from './components/Layout';
import Notification from './components/Notification';
import { useNewsEngine } from './hooks/useNewsEngine';

// This component ensures the news engine hook is running at the top level.
const NewsEngineRunner: React.FC = () => {
    useNewsEngine();
    return null;
}

const ScreenManager: React.FC = () => {
    const { gameState } = useGame();

    const renderScreen = () => {
        switch (gameState.currentScreen) {
            case Screen.Dashboard:
                return <DashboardScreen />;
            case Screen.Travel:
                return <TravelScreen />;
            case Screen.CityStores:
                return <CityStoresScreen />;
            case Screen.ShoeStore:
                return <ShoeStoreScreen />;
            case Screen.Inventory:
                return <InventoryScreen />;
            case Screen.Ampm:
                return <AmpmScreen />;
            case Screen.Social:
                return <SocialScreen />;
            case Screen.Storage:
                return <StorageScreen />;
            case Screen.Stats:
                return <StatsScreen />;
            case Screen.CityFeed:
                return <CityFeedScreen />;
            case Screen.MarketAnalysis:
                return <MarketAnalysisScreen />;
            case Screen.Arcade:
                return <ArcadeScreen />;
            case Screen.Quests:
                return <QuestsScreen />;
            case Screen.Bathrooms:
                return <BathroomsScreen />;
            case Screen.Venues:
                return <VenuesScreen />;
            default:
                return <DashboardScreen />;
        }
    };

    return (
        <Layout>
            {renderScreen()}
            <Notification />
        </Layout>
    );
};

const App: React.FC = () => {
    return (
        <GameProvider>
            <ScreenManager />
            <NewsEngineRunner />
        </GameProvider>
    );
};

export default App;
