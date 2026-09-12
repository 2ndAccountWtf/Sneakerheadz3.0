import React from 'react';
import type { StoreSkin } from '../../../data/storeSkins';
import { skinBodyFont, skinTitleFont } from '../../../data/storeSkins';

/**
 * The small amount of furniture every layout shares.
 *
 * Deliberately tiny: the point of the layouts directory is that the rooms are
 * different, so anything that would flatten them back into one look does not
 * belong here. What lives here is the stuff that has to be identical or the
 * store stops fitting the app — the stage that clips its own decoration, the
 * max-width column, and the exit affordance.
 */

const OVERLAY_CLASS: Record<string, string> = {
    scanlines: 'scanlines opacity-50',
    grid: 'grid-bg opacity-50',
    rain: 'opacity-30',
    grain: 'opacity-[0.07]',
};

/** `rgba()` from a skin's `#rrggbb`, for glows and washes. */
export const alpha = (hex: string, a: number): string => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full.slice(0, 6), 16);
    if (Number.isNaN(n)) return `rgba(255,255,255,${a})`;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Inline CSS custom properties a layout can reference from arbitrary values. */
export const skinVars = (skin: StoreSkin): React.CSSProperties => ({
    ['--skin' as any]: skin.accent,
    ['--skin2' as any]: skin.accent2,
    ['--skin3' as any]: skin.accent3 ?? skin.accent2,
    ['--skin-surface' as any]: skin.surface ?? 'var(--bg-panel)',
    ['--skin-title' as any]: skinTitleFont(skin),
    ['--skin-body' as any]: skinBodyFont(skin),
});

/**
 * Full-bleed backdrop for a store. `overflow-hidden` is load-bearing: layouts
 * rotate, offset and over-hang their decoration, and this is what stops any of
 * that turning into a horizontal scrollbar on a 390px phone.
 */
export const StoreStage: React.FC<{
    skin: StoreSkin;
    className?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
}> = ({ skin, className = '', style, children }) => (
    <div
        className={`relative overflow-hidden ${className}`}
        style={{ background: skin.stage, ...skinVars(skin), ...style }}
    >
        {skin.overlay && skin.overlay !== 'rain' && (
            <div className={`absolute inset-0 pointer-events-none ${OVERLAY_CLASS[skin.overlay]}`} />
        )}
        <div className="relative">{children}</div>
    </div>
);

/** The one content column. Stores render full-bleed, so each owns its gutter. */
export const StoreShell: React.FC<{
    className?: string;
    width?: 'wide' | 'normal' | 'narrow';
    children: React.ReactNode;
}> = ({ className = '', width = 'normal', children }) => (
    <div
        className={`mx-auto w-full px-3 sm:px-5 ${
            width === 'wide' ? 'max-w-7xl' : width === 'narrow' ? 'max-w-3xl' : 'max-w-6xl'
        } ${className}`}
    >
        {children}
    </div>
);

/** Way out. Every layout styles it, none of them may lose it. */
export const ExitButton: React.FC<{
    onExit: () => void;
    label?: string;
    className?: string;
    style?: React.CSSProperties;
}> = ({ onExit, label = '← Exit', className = 'btn btn-ghost btn-sm', style }) => (
    <button type="button" className={`${className} flex-shrink-0`} onClick={onExit} style={style}>
        {label}
    </button>
);

/**
 * A row that scrolls rather than overflows. Used by the layouts whose tabs or
 * shelves are a single line by design (cabinet buttons, crate spines).
 */
export const ScrollRow: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
    <div className={`flex gap-2 overflow-x-auto scrollbar-hide max-w-full ${className}`}>{children}</div>
);
