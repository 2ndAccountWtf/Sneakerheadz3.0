/**
 * Store art direction.
 *
 * History: every store used to be a hand-built page (its own header, its own
 * tabs, its own grid) which is why none of them fitted the app — `min-h-screen`
 * inside a padded column, an NPC rail pinned over the HUD. The fix-up pass
 * flattened all of that into one layout plus a palette, which fitted but made
 * every shop feel like the same shop with a different hue.
 *
 * So: a skin now names a *layout* as well as a palette. `components/shoestore/
 * layouts/` holds one component per vibe — an arcade cabinet, a vaporwave
 * outlet, a rain-soaked list, a gallery of plinths, a taped-together stall, a
 * record crate, a vending machine, a bodega shelf, a rooftop souk, a boiler
 * room, an atelier drafting board. The skin picks which one a store walks into
 * and supplies the colours, type, backdrop and sign-writing it prints.
 *
 * Skins resolve store id first, brand key second, so two shops sharing a brand
 * key can still be completely different rooms.
 */

export type StoreLayoutId =
    | 'arcade'
    | 'vaporwave'
    | 'rain-noir'
    | 'gallery'
    | 'blackmarket'
    | 'crate'
    | 'tapedeck'
    | 'vending'
    | 'bodega'
    | 'rooftop'
    | 'boiler'
    | 'atelier';

export type StoreFont = 'display' | 'pixel' | 'mono' | 'serif' | 'typewriter' | 'sans';

/** Resolved font stacks. Webfonts come from the one link in index.html. */
export const FONT_STACKS: Record<StoreFont, string> = {
    display: "'Bungee', Impact, Haettenschweiler, 'Arial Narrow Bold', system-ui, sans-serif",
    pixel: "'Press Start 2P', 'Courier New', monospace",
    mono: "'IBM Plex Mono', 'Space Mono', ui-monospace, Menlo, Consolas, monospace",
    serif: "'Playfair Display', Georgia, 'Times New Roman', serif",
    typewriter: "'Special Elite', 'Courier New', Courier, monospace",
    sans: "'Rajdhani', system-ui, sans-serif",
};

/**
 * Layout-specific sign-writing. Every knob is optional and every layout has a
 * sensible default, so a half-filled skin still renders.
 */
export interface StoreSkinKnobs {
    /** Arcade: marquee text and the coin-slot prompt. */
    marquee?: string;
    coinPrompt?: string;
    /** Arcade / vending: the strip of glyphs painted down the side art. */
    sideArt?: string;
    /** Gallery: catalogue number prefix and the plinth material. */
    catalogPrefix?: string;
    plinth?: 'marble' | 'concrete' | 'oak';
    /** Black market: the rubber stamp slapped over the header. */
    stamp?: string;
    lookout?: string;
    /** Crate: what the divider card in the crate says. */
    crateLabel?: string;
    /** Vending: slot code prefix, e.g. "A" gives A1, A2, A3. */
    slotPrefix?: string;
    /** Bodega: what the shelf-edge price rail is labelled. */
    aisle?: string;
    /** Rooftop: awning stripe colour. */
    awning?: string;
    /** Boiler: the stencil painted on the locker bank. */
    stencil?: string;
    /** Atelier: the line printed in the drawing's title block. */
    titleBlock?: string;
}

export interface StoreSkin {
    /** Which room the player walks into. */
    layout: StoreLayoutId;
    label: string;
    accent: string;
    accent2: string;
    /** Optional third colour, used for gradients and underglow. */
    accent3?: string;
    /** Furniture colour — shelves, frames, cabinet bezels, paper. */
    surface?: string;
    /** Ink, for the layouts that invert onto a light ground. */
    ink?: string;
    /** CSS background for the store stage. */
    stage: string;
    /** Extra overlay class applied over the stage. */
    overlay?: 'scanlines' | 'rain' | 'grid' | 'grain';
    titleFont: StoreFont;
    bodyFont?: StoreFont;
    tagline: string;
    /** A second line of copy the louder layouts print on their furniture. */
    motto?: string;
    knobs?: StoreSkinKnobs;
}

/**
 * Brand-key skins. These are the fallback: a store with no id-specific entry
 * (and any future store) still gets a complete, opinionated room.
 */
export const STORE_SKINS: Record<string, StoreSkin> = {
    arcade: {
        layout: 'arcade',
        label: 'Arcade Cabinet',
        accent: '#00e5c0',
        accent2: '#ff2e88',
        accent3: '#ffd400',
        surface: '#12172b',
        stage: 'linear-gradient(180deg, #04101a 0%, #0a0620 100%)',
        overlay: 'scanlines',
        titleFont: 'pixel',
        bodyFont: 'mono',
        tagline: 'Insert coin. Buy shoes. Same thing.',
        motto: 'SELECT YOUR FIGHTER',
        knobs: { marquee: 'ARCADE KICKS', coinPrompt: 'INSERT COIN', sideArt: '★ ▲ ● ■ ★ ▲ ● ■' },
    },
    neon: {
        layout: 'vaporwave',
        label: 'Neon Outlet',
        accent: '#ff2e88',
        accent2: '#00e5c0',
        accent3: '#8C52FF',
        stage: 'linear-gradient(180deg, #1b0733 0%, #45086a 42%, #0a0410 100%)',
        overlay: 'grain',
        titleFont: 'display',
        tagline: 'Last season, half price, twice the lighting.',
        motto: 'ＯＶＥＲＤＲＩＶＥ',
    },
    cyberpunk: {
        layout: 'rain-noir',
        label: 'Night Market',
        accent: '#8C52FF',
        accent2: '#00e5c0',
        surface: '#0b0a16',
        stage: 'linear-gradient(180deg, #070a12 0%, #0d0820 100%)',
        overlay: 'rain',
        titleFont: 'mono',
        bodyFont: 'mono',
        tagline: 'It is always raining and nothing is on the books.',
        motto: 'NO RECEIPTS · NO NAMES',
    },
    shady: {
        layout: 'blackmarket',
        label: 'Illegal Operation',
        accent: '#ff4747',
        accent2: '#ffb400',
        surface: '#d8cfbc',
        stage: 'linear-gradient(180deg, #140404 0%, #0a0202 100%)',
        overlay: 'grain',
        titleFont: 'typewriter',
        bodyFont: 'typewriter',
        tagline: 'Cash only. Do not ask about the boxes.',
        knobs: { stamp: 'CASH ONLY', lookout: 'LOOKOUT POSTED' },
    },
    gallery: {
        layout: 'gallery',
        label: 'Gallery',
        accent: '#ffcc4d',
        accent2: '#e6edf3',
        surface: '#1a1a18',
        stage: 'linear-gradient(180deg, #14140f 0%, #060606 100%)',
        titleFont: 'serif',
        tagline: 'Please do not touch the merchandise.',
        knobs: { catalogPrefix: 'CAT', plinth: 'concrete' },
    },
    luxury: {
        layout: 'gallery',
        label: 'Luxury House',
        accent: '#e8c37a',
        accent2: '#ffffff',
        surface: '#20190f',
        stage: 'linear-gradient(180deg, #1c1710 0%, #070604 100%)',
        titleFont: 'serif',
        tagline: 'If you have to ask, you are in the wrong room.',
        knobs: { catalogPrefix: 'LOT', plinth: 'marble' },
    },
    lofi: {
        layout: 'tapedeck',
        label: 'Lo-Fi Shop',
        accent: '#7bd88f',
        accent2: '#ffb400',
        surface: '#2a2b24',
        stage: 'linear-gradient(180deg, #131a13 0%, #06100c 100%)',
        titleFont: 'mono',
        bodyFont: 'mono',
        tagline: 'Beats to buy sneakers to.',
        motto: 'SIDE A · 45 MIN',
    },
    retro: {
        layout: 'crate',
        label: 'Retro Shop',
        accent: '#ffb400',
        accent2: '#ff6b35',
        surface: '#3a2314',
        stage: 'linear-gradient(180deg, #21160c 0%, #0a0806 100%)',
        titleFont: 'display',
        tagline: 'Everything here is older than you and worth more.',
        knobs: { crateLabel: 'DIG HERE' },
    },
    plug: {
        layout: 'bodega',
        label: 'The Plug',
        accent: '#46e06a',
        accent2: '#ffb400',
        surface: '#1d241c',
        stage: 'linear-gradient(180deg, #0c150d 0%, #050806 100%)',
        titleFont: 'mono',
        bodyFont: 'mono',
        tagline: 'Whatever fell off whatever truck.',
        knobs: { aisle: 'AISLE 3 · SNACKS & SOLES' },
    },
    consignment: {
        layout: 'boiler',
        label: 'Consignment',
        accent: '#3aa8ff',
        accent2: '#ff8c42',
        surface: '#232a31',
        stage: 'linear-gradient(180deg, #0b1218 0%, #04080b 100%)',
        titleFont: 'display',
        tagline: 'Somebody else’s grails, at a markup.',
        knobs: { stencil: 'LOCKER BANK B' },
    },
    boutique: {
        layout: 'gallery',
        label: 'Boutique',
        accent: '#00e5c0',
        accent2: '#ff2e88',
        surface: '#161b1f',
        stage: 'linear-gradient(180deg, #0b1216 0%, #04080b 100%)',
        titleFont: 'serif',
        tagline: 'Curated. Allegedly.',
        knobs: { catalogPrefix: 'REF', plinth: 'oak' },
    },
    outlet: {
        layout: 'vending',
        label: 'Outlet',
        accent: '#00e5c0',
        accent2: '#ffb400',
        surface: '#101a20',
        stage: 'linear-gradient(180deg, #081218 0%, #04080b 100%)',
        titleFont: 'mono',
        bodyFont: 'mono',
        tagline: 'Volume over prestige.',
        knobs: { slotPrefix: 'A' },
    },
    raffle: {
        layout: 'arcade',
        label: 'Raffle House',
        accent: '#ffb400',
        accent2: '#ff2e88',
        surface: '#21182b',
        stage: 'linear-gradient(180deg, #1a1206 0%, #08060a 100%)',
        overlay: 'scanlines',
        titleFont: 'pixel',
        bodyFont: 'mono',
        tagline: 'You will not win. Enter anyway.',
        knobs: { marquee: 'DRAW MACHINE', coinPrompt: 'ONE TICKET PER CREDIT' },
    },
};

/**
 * Per-store art direction. This is where the personality actually lives: two
 * Tokyo shops share nothing, and the two shady spots are different kinds of
 * shady.
 */
export const STORE_SKINS_BY_ID: Record<string, StoreSkin> = {
    // --- TOKYO ---------------------------------------------------------
    'akihabara-arcade-kicks': {
        layout: 'arcade',
        label: 'Cabinet Floor',
        accent: '#00e5c0',
        accent2: '#ff2e88',
        accent3: '#ffd400',
        surface: '#151033',
        stage: 'radial-gradient(ellipse at 50% 0%, #2a0a4d 0%, #05081a 60%, #04060f 100%)',
        overlay: 'scanlines',
        titleFont: 'pixel',
        bodyFont: 'mono',
        tagline: '1 CREDIT = 1 PAIR. NO CONTINUES.',
        motto: 'SELECT YOUR FIGHTER',
        knobs: { marquee: 'AKIHABARA ARCADE KICKS', coinPrompt: 'INSERT COIN', sideArt: '★▲●■★▲●■★▲●■' },
    },
    'outlet-harajuku-overdrive': {
        layout: 'vaporwave',
        label: 'Overdrive Outlet',
        accent: '#ff5fbf',
        accent2: '#3ff0e0',
        accent3: '#ffd166',
        stage: 'linear-gradient(180deg, #2b0845 0%, #7a1160 38%, #ff6b9d 66%, #1a0524 100%)',
        overlay: 'grain',
        titleFont: 'display',
        tagline: 'Everything is discounted and nothing is calm.',
        motto: 'ＯＶＥＲＤＲＩＶＥ　ＯＵＴＬＥＴ',
    },
    'shinjuku-shadow-runner': {
        layout: 'rain-noir',
        label: 'Shadow Runner',
        accent: '#a97bff',
        accent2: '#39d7ff',
        surface: '#0a0913',
        stage: 'linear-gradient(180deg, #05060d 0%, #120a26 55%, #05060d 100%)',
        overlay: 'rain',
        titleFont: 'mono',
        bodyFont: 'mono',
        tagline: 'Dossiers, not displays. Ask for a file number.',
        motto: 'NO RECEIPTS · NO NAMES · NO REFUNDS',
    },
    'shibuya-vending-annex': {
        layout: 'vending',
        label: 'Vending Annex',
        accent: '#37e6ff',
        accent2: '#ffe066',
        accent3: '#ff2e88',
        surface: '#0e1a22',
        stage: 'linear-gradient(180deg, #061017 0%, #0b2230 50%, #04080b 100%)',
        titleFont: 'mono',
        bodyFont: 'mono',
        tagline: 'Twenty-four machines. One attendant. He is asleep.',
        motto: '自動販売機 · SOLD BY THE SLOT',
        knobs: { slotPrefix: 'B', sideArt: '¥' },
    },

    // --- NEW YORK ------------------------------------------------------
    'consign-soho-heat-museum': {
        layout: 'gallery',
        label: 'Heat Museum',
        accent: '#ffcc4d',
        accent2: '#f0f0ea',
        surface: '#1b1b18',
        stage: 'linear-gradient(180deg, #17170f 0%, #0a0a08 100%)',
        titleFont: 'serif',
        tagline: 'A museum that sells the exhibits.',
        motto: 'PERMANENT COLLECTION · WING II',
        knobs: { catalogPrefix: 'CAT', plinth: 'concrete' },
    },
    'fifth-ave-grails': {
        layout: 'gallery',
        label: 'Private Salon',
        accent: '#e8c37a',
        accent2: '#ffffff',
        surface: '#241c10',
        stage: 'linear-gradient(180deg, #241c10 0%, #0c0a06 70%, #050403 100%)',
        titleFont: 'serif',
        tagline: 'Champagne is complimentary. Nothing else is.',
        motto: 'BY APPOINTMENT · FIFTH AVENUE',
        knobs: { catalogPrefix: 'LOT', plinth: 'marble' },
    },
    'ny-canal-street-tunnel': {
        layout: 'blackmarket',
        label: 'Tunnel Trade',
        accent: '#ff4747',
        accent2: '#ffd400',
        surface: '#ddd3bd',
        stage: 'linear-gradient(180deg, #120505 0%, #1a0a0a 45%, #070202 100%)',
        overlay: 'grain',
        titleFont: 'typewriter',
        bodyFont: 'typewriter',
        tagline: 'Super perfects. Perfect until you look.',
        knobs: { stamp: 'CASH ONLY', lookout: 'LOOKOUT AT THE STAIRS' },
    },
    'bed-stuy-bodega-backroom': {
        layout: 'bodega',
        label: 'Back Room',
        accent: '#7bff8f',
        accent2: '#ff4747',
        accent3: '#ffe066',
        surface: '#1b2a1c',
        stage: 'linear-gradient(180deg, #0b140c 0%, #101c11 60%, #050806 100%)',
        titleFont: 'mono',
        bodyFont: 'mono',
        tagline: 'Past the cat, past the curtain, mind the crates.',
        motto: 'LOOSE CIGARETTES · SANDWICHES · SIZE 10.5',
        knobs: { aisle: 'AISLE 4 · BEHIND THE CURTAIN' },
    },

    // --- LOS ANGELES ---------------------------------------------------
    'plug-bodega-barrio-la': {
        layout: 'bodega',
        label: 'Barrio Bodega',
        accent: '#ff8c42',
        accent2: '#46e06a',
        accent3: '#ffe066',
        surface: '#2a1d16',
        stage: 'linear-gradient(180deg, #1a0f08 0%, #2a1710 55%, #0a0604 100%)',
        titleFont: 'display',
        bodyFont: 'mono',
        tagline: 'Horchata, lottery tickets, and whatever is in the back.',
        motto: 'ABIERTO · SE VENDE TODO',
        knobs: { aisle: 'PASILLO 2 · TENIS' },
    },
    'venice-beach-beats': {
        layout: 'tapedeck',
        label: 'Tape Deck',
        accent: '#8ce99a',
        accent2: '#ffc266',
        accent3: '#66d9ef',
        surface: '#2f3128',
        stage: 'linear-gradient(180deg, #16211a 0%, #1d2a1f 45%, #070f0a 100%)',
        titleFont: 'mono',
        bodyFont: 'mono',
        tagline: 'Nobody here is in a hurry, including the staff.',
        motto: 'SIDE A · SUNSET MIX · 45 MIN',
    },
    'la-gutter-trunk': {
        layout: 'blackmarket',
        label: 'Trunk Sale',
        accent: '#ff5c3d',
        accent2: '#ffb400',
        surface: '#e2d8c2',
        stage: 'linear-gradient(180deg, #170703 0%, #0f0503 60%, #060201 100%)',
        overlay: 'grain',
        titleFont: 'typewriter',
        bodyFont: 'typewriter',
        tagline: 'The shop is a Corolla. The Corolla is running.',
        knobs: { stamp: 'NO REFUNDS', lookout: 'GABE IS WATCHING THE STREET' },
    },

    // --- PARIS ---------------------------------------------------------
    'le-marais-archives': {
        layout: 'gallery',
        label: 'Les Archives',
        accent: '#d9c89a',
        accent2: '#f2efe6',
        surface: '#1d1c19',
        stage: 'linear-gradient(180deg, #1a1916 0%, #0a0a09 100%)',
        titleFont: 'serif',
        tagline: 'Sous vitrine. Ne touchez pas.',
        motto: 'ARCHIVES · SALLE 3',
        knobs: { catalogPrefix: 'ARCH', plinth: 'oak' },
    },
    'atelier-rue-norvins': {
        layout: 'atelier',
        label: 'Atelier',
        accent: '#8a6a3f',
        accent2: '#b4474f',
        accent3: '#3c6e8f',
        surface: '#efe7d6',
        ink: '#2b2620',
        stage: 'linear-gradient(180deg, #f4ecdb 0%, #e7dcc6 100%)',
        titleFont: 'serif',
        bodyFont: 'serif',
        tagline: 'Made twice: once on paper, once on the last.',
        motto: 'PATRONS · ÉCHELLE 1:1',
        knobs: { titleBlock: 'ATELIER N° 4 — RUE NORVINS, PARIS XVIII' },
    },

    // --- CHICAGO -------------------------------------------------------
    'windy-city-soles': {
        layout: 'crate',
        label: 'Crate Room',
        accent: '#ffb400',
        accent2: '#e03131',
        accent3: '#3aa8ff',
        surface: '#3c2415',
        stage: 'linear-gradient(180deg, #2a1a0e 0%, #3a2413 40%, #0d0906 100%)',
        titleFont: 'display',
        tagline: 'Flip the crate. The good one is always four back.',
        motto: 'CHI-TOWN HARDWOOD CLASSICS',
        knobs: { crateLabel: 'HARDWOOD / 1985—1998' },
    },
    'southside-boiler-room': {
        layout: 'boiler',
        label: 'Boiler Room',
        accent: '#5bb8ff',
        accent2: '#ff7a45',
        surface: '#262e35',
        stage: 'linear-gradient(180deg, #0a1016 0%, #16212a 55%, #05080b 100%)',
        titleFont: 'display',
        bodyFont: 'mono',
        tagline: 'Two floors under the barbershop. Bring a flashlight.',
        motto: 'BOILER ROOM · AUTHORISED PERSONNEL',
        knobs: { stencil: 'LOCKER BANK B — SOUTH SIDE' },
    },

    // --- TEL AVIV ------------------------------------------------------
    'jaffa-flea-market': {
        layout: 'crate',
        label: 'Flea Crates',
        accent: '#ffca3a',
        accent2: '#ff595e',
        accent3: '#8ac926',
        surface: '#4a3218',
        stage: 'linear-gradient(180deg, #3b2a16 0%, #58401f 45%, #120c06 100%)',
        titleFont: 'display',
        tagline: 'The price is a suggestion and he knows it.',
        motto: 'שוק הפשפשים · CRATE 12',
        knobs: { crateLabel: 'UNSORTED / AS-IS' },
    },
    'florentin-rooftop-souk': {
        layout: 'rooftop',
        label: 'Rooftop Souk',
        accent: '#ff9f43',
        accent2: '#48dbfb',
        accent3: '#ee5253',
        surface: '#2a1a2e',
        stage: 'linear-gradient(180deg, #2b1b3a 0%, #7b3f5c 30%, #e9724c 62%, #ffb86b 82%, #241628 100%)',
        titleFont: 'display',
        bodyFont: 'mono',
        tagline: 'Four flights up, string lights, and a cooler of beer.',
        motto: 'FLORENTIN · GOLDEN HOUR ONLY',
        knobs: { awning: '#ee5253' },
    },
};

/**
 * Resolve a store's art direction. Store id wins, brand key is the fallback,
 * and an unknown key still lands on a complete skin.
 */
export const getStoreSkin = (brandKey: string, storeId?: string): StoreSkin =>
    (storeId ? STORE_SKINS_BY_ID[storeId] : undefined)
    ?? STORE_SKINS[brandKey]
    ?? STORE_SKINS.boutique;

/** Font stack for a skin's headings (and for its body copy, when it sets one). */
export const skinTitleFont = (skin: StoreSkin): string => FONT_STACKS[skin.titleFont];
export const skinBodyFont = (skin: StoreSkin): string => FONT_STACKS[skin.bodyFont ?? 'sans'];
