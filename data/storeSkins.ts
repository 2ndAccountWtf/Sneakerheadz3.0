/**
 * Store skins.
 *
 * Each store used to render a wholly different hand-built layout, which is why
 * none of them lined up with the rest of the game: different headers, different
 * paddings, `min-h-screen` inside a padded column, a fixed NPC rail sitting on
 * top of the HUD. A skin instead changes only the *look* — palette, backdrop,
 * typeface, label — on top of one layout that is known to fit.
 */
export interface StoreSkin {
    label: string;
    accent: string;
    accent2: string;
    /** CSS background for the store stage. */
    stage: string;
    /** Extra overlay class applied over the stage. */
    overlay?: 'scanlines' | 'rain' | 'grid' | 'grain';
    titleFont: 'display' | 'pixel' | 'mono';
    tagline: string;
}

export const STORE_SKINS: Record<string, StoreSkin> = {
    arcade: {
        label: 'Arcade Cabinet',
        accent: '#00e5c0',
        accent2: '#ff2e88',
        stage: 'linear-gradient(180deg, #04101a 0%, #0a0620 100%)',
        overlay: 'scanlines',
        titleFont: 'pixel',
        tagline: 'Insert coin. Buy shoes. Same thing.',
    },
    neon: {
        label: 'Neon Outlet',
        accent: '#ff2e88',
        accent2: '#00e5c0',
        stage: 'radial-gradient(ellipse at 50% 120%, #5a0a4a 0%, #0a0410 70%)',
        overlay: 'grain',
        titleFont: 'display',
        tagline: 'Last season, half price, twice the lighting.',
    },
    cyberpunk: {
        label: 'Night Market',
        accent: '#8C52FF',
        accent2: '#00e5c0',
        stage: 'linear-gradient(180deg, #070a12 0%, #0d0820 100%)',
        overlay: 'rain',
        titleFont: 'mono',
        tagline: 'It is always raining and nothing is on the books.',
    },
    shady: {
        label: 'Illegal Operation',
        accent: '#ff4747',
        accent2: '#ffb400',
        stage: 'linear-gradient(180deg, #140404 0%, #0a0202 100%)',
        overlay: 'grain',
        titleFont: 'display',
        tagline: 'Cash only. Do not ask about the boxes.',
    },
    gallery: {
        label: 'Gallery',
        accent: '#ffcc4d',
        accent2: '#e6edf3',
        stage: 'linear-gradient(180deg, #101010 0%, #060606 100%)',
        titleFont: 'display',
        tagline: 'Please do not touch the merchandise.',
    },
    luxury: {
        label: 'Luxury House',
        accent: '#ffcc4d',
        accent2: '#ffffff',
        stage: 'linear-gradient(180deg, #14110a 0%, #070604 100%)',
        titleFont: 'display',
        tagline: 'If you have to ask, you are in the wrong room.',
    },
    lofi: {
        label: 'Lo-Fi Shop',
        accent: '#7bd88f',
        accent2: '#ffb400',
        stage: 'linear-gradient(180deg, #0a1410 0%, #06100c 100%)',
        titleFont: 'mono',
        tagline: 'Beats to buy sneakers to.',
    },
    retro: {
        label: 'Retro Shop',
        accent: '#ffb400',
        accent2: '#ff2e88',
        stage: 'linear-gradient(180deg, #14100a 0%, #0a0806 100%)',
        overlay: 'grid',
        titleFont: 'display',
        tagline: 'Everything here is older than you and worth more.',
    },
    plug: {
        label: 'The Plug',
        accent: '#46e06a',
        accent2: '#00e5c0',
        stage: 'linear-gradient(180deg, #08120a 0%, #050806 100%)',
        titleFont: 'mono',
        tagline: 'Whatever fell off whatever truck.',
    },
    consignment: {
        label: 'Consignment',
        accent: '#00e5c0',
        accent2: '#3aa8ff',
        stage: 'linear-gradient(180deg, #080f14 0%, #04080b 100%)',
        overlay: 'grid',
        titleFont: 'display',
        tagline: 'Somebody else’s grails, at a markup.',
    },
    boutique: {
        label: 'Boutique',
        accent: '#00e5c0',
        accent2: '#ff2e88',
        stage: 'linear-gradient(180deg, #080f14 0%, #04080b 100%)',
        overlay: 'grid',
        titleFont: 'display',
        tagline: 'Curated. Allegedly.',
    },
    outlet: {
        label: 'Outlet',
        accent: '#00e5c0',
        accent2: '#ffb400',
        stage: 'linear-gradient(180deg, #080f14 0%, #04080b 100%)',
        overlay: 'grid',
        titleFont: 'display',
        tagline: 'Volume over prestige.',
    },
    raffle: {
        label: 'Raffle House',
        accent: '#ffb400',
        accent2: '#ff2e88',
        stage: 'linear-gradient(180deg, #14100a 0%, #08060a 100%)',
        overlay: 'scanlines',
        titleFont: 'pixel',
        tagline: 'You will not win. Enter anyway.',
    },
};

export const getStoreSkin = (brandKey: string): StoreSkin =>
    STORE_SKINS[brandKey] ?? STORE_SKINS.boutique;
