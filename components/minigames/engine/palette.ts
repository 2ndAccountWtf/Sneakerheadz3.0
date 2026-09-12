/**
 * The shared console palette.
 *
 * Every canvas mini-game draws from this list so four separately built games
 * read as one machine. Values mirror the CSS tokens in styles/theme.css; they
 * are duplicated here because canvas cannot read CSS custom properties.
 */
export const PAL = {
    // Surfaces
    void: '#04060a',
    bg: '#07090c',
    panel: '#0d1218',
    raised: '#141c25',

    // Ink
    ink: '#e6edf3',
    dim: '#8394a6',
    faint: '#55636f',
    line: '#223040',

    // Accents
    accent: '#00e5c0',
    accent2: '#ff2e88',
    warn: '#ffb400',
    ok: '#46e06a',
    bad: '#ff4747',
    legend: '#ffcc4d',
    violet: '#8C52FF',

    // Figures
    skin: '#e8b88c',
    skinDark: '#9c6b43',
    denim: '#3c5a8a',
    denimDark: '#27395a',
    shadow: 'rgba(0,0,0,0.45)',
    white: '#ffffff',
    black: '#000000',
} as const;

export type PaletteColor = string;

/** Team / character colourways, so the same fighter reads the same everywhere. */
export const KIT = {
    player: { main: PAL.accent, trim: '#04120f', skin: PAL.skin },
    rival: { main: PAL.accent2, trim: '#1a0410', skin: PAL.skinDark },
    thug: { main: '#7a4a2a', trim: '#2a1a0e', skin: PAL.skinDark },
    militant: { main: '#3f5d3a', trim: '#16210f', skin: PAL.skinDark },
    hostage: { main: '#c9c9d4', trim: '#5a5a66', skin: PAL.skin },
} as const;
