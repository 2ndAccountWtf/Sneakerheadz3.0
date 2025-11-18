import type { StoreTheme } from '../types/theme';

export const SYNDICATE_THEME: StoreTheme = {
    colors: {
        background: '#0a0f14',
        surface: '#111214',
        surfaceAlt: '#1A1B1E',
        accent: '#00fff7',     // Primary Glow: Electric Cyan
        accentAlt: '#ff00b8',   // Accent A: Magenta
        textPrimary: '#F5F7FA',
        textSecondary: '#A0AEC0',
        textInverse: '#000000',
        success: '#b6ff00',     // Accent B: Acid Lime
        warning: '#ffc700',     // Accent C (Legendary)
        danger: '#F56565',
        info: '#4299E1',
        outline: 'rgba(0, 255, 247, 0.2)',
        highlight: '#ff8a00',   // Accent C (Legendary) Gradient End
        disabled: '#4A5568',
    },
    typography: {
        displayFont: "'Orbitron', sans-serif",
        uiFont: "'Space Mono', monospace",
        numeralFont: "'Space Mono', monospace",
        scale: 1.0,
        capsHeadings: true,
        displayWeight: 900,
        uiWeight: 400,
        emphasisWeight: 700,
    },
    shape: {
        cardRadius: 8,
        chipRadius: 999,
        buttonRadius: 2,
        borderWeight: 1,
        borderStyle: 'solid',
        shadowLevel: 3,
        depth: 'glass',
    },
    components: {
        buttons: { shape: 'square', fill: 'outline', hoverGlow: true },
        chips: { style: 'solid' },
        cards: { variant: 'glass' },
        tabs: { variant: 'underline', badgeStyle: 'pill' },
    },
    motion: {
        durations: { fast: 150, base: 250, slow: 400 },
        easing: { easingIn: 'cubic-bezier(0.4, 0, 1, 1)', easingOut: 'cubic-bezier(0, 0, 0.2, 1)' },
        fx: { hoverLift: true, glow: { color: '#00fff7', radius: 15, intensity: 0.4 } },
    },
    vfx: {
        grain: 0.05,
        bloom: 0.1,
        parallaxDepth: 0.05,
    },
};

// All old presets are removed to enforce the universal Syndicate OS theme.
export const THEME_PRESETS = {
    base: SYNDICATE_THEME,
    gallery: SYNDICATE_THEME,
    neon: SYNDICATE_THEME,
    arcade: SYNDICATE_THEME,
    cyberpunk: SYNDICATE_THEME,
    luxury: SYNDICATE_THEME,
    lofi: SYNDICATE_THEME,
    retro: SYNDICATE_THEME,
};
