import React from 'react';

/**
 * Every mini-game renders inside this frame: same chrome, same escape hatch,
 * same result presentation. The games themselves only worry about play.
 */
export const MiniGameShell: React.FC<{
    title: string;
    subtitle?: string;
    hud?: React.ReactNode;
    onQuit?: () => void;
    quitLabel?: string;
    children: React.ReactNode;
}> = ({ title, subtitle, hud, onQuit, quitLabel = 'Bail Out', children }) => (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 backdrop-blur-sm p-3 sm:p-6">
        <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />
        <div className="relative crt-panel w-full max-w-2xl max-h-[94vh] flex flex-col overflow-hidden">
            <div className="panel-head flex-shrink-0">
                <div className="min-w-0">
                    <h2 className="font-display text-sm sm:text-base uppercase text-[var(--accent)] truncate">{title}</h2>
                    {subtitle && <p className="label truncate">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {hud}
                    {onQuit && (
                        <button className="btn btn-ghost btn-sm" onClick={onQuit}>{quitLabel}</button>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
        </div>
    </div>
);

/** Shared end-card so wins and losses read the same everywhere. */
export const MiniGameResult: React.FC<{
    won: boolean;
    headline: string;
    detail?: string;
    onClose: () => void;
    closeLabel?: string;
}> = ({ won, headline, detail, onClose, closeLabel = 'Collect' }) => (
    <div className="text-center py-6 animate-rise">
        <div className="text-5xl mb-3">{won ? '🏆' : '💀'}</div>
        <h3
            className="font-display text-2xl sm:text-3xl uppercase mb-2"
            style={{ color: won ? 'var(--ok)' : 'var(--bad)' }}
        >
            {headline}
        </h3>
        {detail && <p className="text-[var(--ink-dim)] mb-5 text-sm max-w-sm mx-auto">{detail}</p>}
        <button className={`btn ${won ? 'btn-primary' : 'btn-danger'} px-8`} onClick={onClose}>
            {closeLabel}
        </button>
    </div>
);
