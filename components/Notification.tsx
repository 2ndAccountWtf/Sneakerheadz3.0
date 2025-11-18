
import React from 'react';
import { useGame } from '../hooks/useGame';

const Notification: React.FC = () => {
    const { gameState } = useGame();
    const { notification } = gameState;

    if (!notification) {
        return null;
    }

    const baseClasses = "fixed bottom-5 right-5 text-white px-6 py-3 rounded-lg shadow-lg text-lg z-50 transition-opacity duration-500";
    const typeClasses = {
        success: "bg-green-600/90 border-2 border-green-400",
        error: "bg-red-600/90 border-2 border-red-400",
        info: "bg-blue-600/90 border-2 border-blue-400",
    };

    return (
        <div className={`${baseClasses} ${typeClasses[notification.type]}`}>
            {notification.message}
        </div>
    );
};

export default Notification;
