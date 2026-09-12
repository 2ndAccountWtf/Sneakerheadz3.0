import React from 'react';
import { useGame } from '../hooks/useGame';

const TYPE: Record<string, { color: string; icon: string }> = {
    success: { color: 'var(--ok)', icon: '✓' },
    error: { color: 'var(--bad)', icon: '✕' },
    info: { color: 'var(--accent)', icon: 'ℹ' },
};

/**
 * Transient toast. Anchored above the bottom nav so it never sits under it.
 */
const Notification: React.FC = () => {
    const { gameState } = useGame();
    const { notification } = gameState;

    if (!notification) return null;
    const t = TYPE[notification.type] ?? TYPE.info;

    return (
        <div
            className="fixed left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-md z-[60] panel px-4 py-2.5 flex items-start gap-2.5 animate-rise"
            style={{ bottom: 'calc(var(--nav-h) + 16px + env(safe-area-inset-bottom, 0px))', borderColor: t.color }}
            role="status"
        >
            <span className="font-bold flex-shrink-0" style={{ color: t.color }}>{t.icon}</span>
            <span className="text-sm text-[var(--ink)] leading-snug">{notification.message}</span>
        </div>
    );
};

export default Notification;
