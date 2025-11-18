
// A1) Color System
export interface ColorTheme {
    background: string;
    surface: string;
    surfaceAlt?: string;
    accent: string;
    accentAlt?: string;
    textPrimary: string;
    textSecondary?: string;
    textInverse?: string;
    success?: string;
    warning?: string;
    danger?: string;
    info?: string;
    outline?: string;
    highlight?: string;
    disabled?: string;
}

// A2) Typography
export interface TypographyTheme {
    displayFont: string;
    uiFont: string;
    numeralFont?: string;
    scale?: number;
    capsHeadings?: boolean;
    displayWeight?: number;
    uiWeight?: number;
    emphasisWeight?: number;
}

// A3) Imagery & Backgrounds
export interface ImageryTheme {
    backgroundImage?: string;
    backgroundBlend?: 'darken' | 'multiply' | 'vignette';
    brandDecals?: string[];
    logoMark?: string;
    logoWordmark?: string;
}

// A4) Shape & Elevation
export interface ShapeTheme {
    cardRadius?: number;
    chipRadius?: number;
    buttonRadius?: number;
    borderWeight?: number;
    borderStyle?: 'solid' | 'dotted' | 'none';
    shadowLevel?: 0 | 1 | 2 | 3;
    depth?: 'flat' | 'elevated' | 'glass';
}

// A5) Component Style Slots
export interface ButtonStyles {
    shape?: 'square' | 'rounded' | 'pill';
    tone?: 'primary' | 'neutral' | 'danger';
    fill?: 'solid' | 'outline' | 'ghost';
    hoverGlow?: boolean;
}

export interface ChipStyles {
    style?: 'solid' | 'outline' | 'ghost';
    badgeDot?: boolean;
}

export interface CardStyles {
    variant?: 'flat' | 'elevated' | 'glass';
    hoverShadow?: 0 | 1 | 2 | 3;
    ring?: { color: string; width: number };
}

export interface TabStyles {
    variant?: 'pills' | 'underline' | 'cards';
    indicatorThickness?: number;
    badgeStyle?: 'dot' | 'pill' | 'counter';
}

export interface ComponentStylesTheme {
    buttons?: ButtonStyles;
    chips?: ChipStyles;
    cards?: CardStyles;
    tabs?: TabStyles;
}

// A6) Motion & Interaction
export interface MotionTheme {
    durations?: { fast: number; base: number; slow: number };
    easing?: { easingIn: string; easingOut: string };
    fx?: { hoverLift?: boolean; focusRing?: boolean; glow?: { color: string; radius: number; intensity: number } };
}

// A7) Density & Layout Feel (already in shoestore.ts LayoutProps, but can be part of theme)

// A8) VFX (Optional)
export interface VfxTheme {
    parallaxDepth?: number;
    grain?: number;
    bloom?: number;
    texture?: string;
}

// The complete theme object
export interface StoreTheme {
    colors: ColorTheme;
    typography: TypographyTheme;
    imagery?: ImageryTheme;
    shape?: ShapeTheme;
    components?: ComponentStylesTheme;
    motion?: MotionTheme;
    vfx?: VfxTheme;
}
