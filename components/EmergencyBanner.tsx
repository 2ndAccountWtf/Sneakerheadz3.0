import React, { useEffect, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import { secondsLeft } from '../systems/digestion/emergency';

/**
 * The emergency clock.
 *
 * Pinned above the nav and impossible to dismiss, because the whole design of
 * the system is that it interrupts what you were doing. It ticks in real time —
 * the joke only works if the player can feel it.
 */
const EmergencyBanner: React.FC = () => {
    const { gameState, changeScreen } = useGame();
    const emergency = gameState.player.emergency;
    const [left, setLeft] = useState(0);

    useEffect(() => {
        if (!emergency) return;
        setLeft(secondsLeft(emergency));
        const t = setInterval(() => setLeft(secondsLeft(emergency)), 500);
        return () => clearInterval(t);
    }, [emergency]);

    if (!emergency) return null;

    const critical = left <= 30;
    const mins = Math.floor(left / 60);
    const secs = String(left % 60).padStart(2, '0');

    return (
        <div
            className={`fixed left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[26rem] z-[68] panel px-3 py-2.5 ${critical ? 'animate-shake' : ''}`}
            style={{
                bottom: 'calc(var(--nav-h) + 12px + env(safe-area-inset-bottom, 0px))',
                borderColor: critical ? 'var(--bad)' : 'var(--warn)',
                boxShadow: `0 0 24px ${critical ? 'rgba(255,71,71,0.35)' : 'rgba(255,180,0,0.25)'}`,
            }}
            role="alert"
        >
            <div className="flex items-center gap-3">
                <span className="text-xl leading-none flex-shrink-0">🚨</span>
                <div className="min-w-0 flex-1">
                    <div className="label" style={{ color: critical ? 'var(--bad)' : 'var(--warn)' }}>
                        Situation developing · {emergency.cause}
                    </div>
                    <div className="numeric text-lg leading-tight" style={{ color: critical ? 'var(--bad)' : 'var(--ink)' }}>
                        {mins}:{secs}
                    </div>
                </div>
                <button className="btn btn-sm btn-primary flex-shrink-0" onClick={() => changeScreen(Screen.Bathrooms)}>
                    Find One
                </button>
            </div>
            <div className="meter h-1 mt-2">
                <i
                    style={{
                        width: `${Math.max(0, Math.min(100, (left / ((emergency.deadline - emergency.startedAt) / 1000)) * 100))}%`,
                        background: critical ? 'var(--bad)' : 'var(--warn)',
                    }}
                />
            </div>
        </div>
    );
};

export default EmergencyBanner;
