
import type { Sneaker } from '../types';

export const SNEAKERS: Sneaker[] = [
    // --- Original Collection ---
    {
        id: 'chrono-glides',
        name: 'Chrono Glides',
        rarity: 'Common',
        basePrice: 120,
        volatility: 0.15,
        imageUrl: 'https://picsum.photos/seed/chrono/400/300'
    },
    {
        id: 'aether-jumps',
        name: 'Aether Jumps',
        rarity: 'Common',
        basePrice: 150,
        volatility: 0.2,
        imageUrl: 'https://picsum.photos/seed/aether/400/300'
    },
    {
        id: 'velocity-vipers',
        name: 'Velocity Vipers',
        rarity: 'Uncommon',
        basePrice: 250,
        volatility: 0.3,
        imageUrl: 'https://picsum.photos/seed/vipers/400/300'
    },
    {
        id: 'cyber-runners',
        name: 'Cyber Runners',
        rarity: 'Uncommon',
        basePrice: 310,
        volatility: 0.35,
        imageUrl: 'https://picsum.photos/seed/cyber/400/300'
    },
    {
        id: 'y-dol-4-boost',
        name: 'Y-DOL$ Boost 350',
        rarity: 'Rare',
        basePrice: 550,
        volatility: 0.5,
        imageUrl: 'https://picsum.photos/seed/ydol/400/300'
    },
    {
        id: 'jordan-retro-future',
        name: 'Jordan Retro Future',
        rarity: 'Rare',
        basePrice: 700,
        volatility: 0.45,
        imageUrl: 'https://picsum.photos/seed/jordan/400/300'
    },
    {
        id: 'g-unit-g6',
        name: 'G-Unit Reebok G6',
        rarity: 'Rare',
        basePrice: 600,
        volatility: 0.6,
        imageUrl: 'https://picsum.photos/seed/g-unit/400/300'
    },
    {
        id: 'quantico-dream',
        name: 'Quentin Tarantino "Quantico Dream"',
        rarity: 'Legendary',
        basePrice: 1200,
        volatility: 0.8,
        imageUrl: 'https://picsum.photos/seed/quantico/400/300'
    },
    {
        id: 'off-white-ikea-frakta',
        name: "Off-White™ x IKEA 'FRAKTA' Dunks",
        rarity: 'Legendary',
        basePrice: 2500,
        volatility: 1.2, // Extremely volatile
        imageUrl: 'https://picsum.photos/seed/frakta/400/300'
    },
    {
        id: 'balenciaga-crocs-gundam',
        name: "Balenciaga x Crocs 'Gundam' Stompers",
        rarity: 'Legendary',
        basePrice: 1800,
        volatility: 0.9,
        imageUrl: 'https://picsum.photos/seed/gundam/400/300'
    },
    {
        id: 'mschef-satans-skateboard',
        name: "MSCHF 'Satan's Skateboard' Slip-Ons",
        rarity: 'Rare',
        basePrice: 850,
        volatility: 1.5, // Insanely volatile
        imageUrl: 'https://picsum.photos/seed/satan/400/300'
    },
    {
        id: 'ai-neural-net-runners',
        name: "A.I. Generated 'Neural-Net' Runners",
        rarity: 'Rare',
        basePrice: 650,
        volatility: 0.85,
        imageUrl: 'https://picsum.photos/seed/neural/400/300'
    },

    // --- New Additions: Hypebeast & Meme Collection ---

    // 1. Real-Life Grails (True Hype)
    {
        id: 'nike-air-yeezy-2-red-october',
        name: 'Nike Air Yeezy 2 “Red October”',
        rarity: 'Legendary',
        basePrice: 9000,
        volatility: 2.5,
        imageUrl: 'https://picsum.photos/seed/red-october/400/300'
    },
    {
        id: 'nike-sb-dunk-low-pigeon',
        name: 'Nike SB Dunk Low “Pigeon”',
        rarity: 'Legendary',
        basePrice: 15000,
        volatility: 1.8,
        imageUrl: 'https://picsum.photos/seed/pigeon/400/300'
    },
    {
        id: 'jordan-1-retro-high-chicago',
        name: 'Jordan 1 Retro High “Chicago”',
        rarity: 'Rare',
        basePrice: 1500,
        volatility: 0.6,
        imageUrl: 'https://picsum.photos/seed/chicago1/400/300'
    },
    {
        id: 'nike-mag-self-lacing',
        name: 'Nike Mag (Self-Lacing)',
        rarity: 'Legendary',
        basePrice: 50000,
        volatility: 3.0,
        imageUrl: 'https://picsum.photos/seed/nikemag/400/300'
    },
    {
        id: 'travis-scott-jordan-1-reverse-mocha',
        name: 'Travis Scott x Jordan 1 “Reverse Mocha”',
        rarity: 'Rare',
        basePrice: 1800,
        volatility: 0.9,
        imageUrl: 'https://picsum.photos/seed/rev-mocha/400/300'
    },
    {
        id: 'union-jordan-1-black-toe',
        name: 'Union Jordan 1 “Black Toe”',
        rarity: 'Rare',
        basePrice: 2200,
        volatility: 0.8,
        imageUrl: 'https://picsum.photos/seed/union-j1/400/300'
    },
    {
        id: 'off-white-jordan-1-unc',
        name: 'Off-White Jordan 1 “UNC”',
        rarity: 'Rare',
        basePrice: 2500,
        volatility: 1.1,
        imageUrl: 'https://picsum.photos/seed/ow-unc/400/300'
    },
    {
        id: 'lv-nike-af1',
        name: 'Louis Vuitton x Nike Air Force 1',
        rarity: 'Legendary',
        basePrice: 12000,
        volatility: 0.4,
        imageUrl: 'https://picsum.photos/seed/lv-af1/400/300'
    },
    {
        id: 'nike-sb-dunk-low-paris',
        name: 'Nike SB Dunk Low “Paris”',
        rarity: 'Legendary',
        basePrice: 75000,
        volatility: 2.2,
        imageUrl: 'https://picsum.photos/seed/paris-dunk/400/300'
    },
    {
        id: 'nb-2002r-protection-pack',
        name: 'New Balance 2002R “Protection Pack”',
        rarity: 'Uncommon',
        basePrice: 350,
        volatility: 0.4,
        imageUrl: 'https://picsum.photos/seed/nb-2002r/400/300'
    },

    // 2. Fictional Heat (Game-Only Creations)
    {
        id: 'y-dol-4-algorithm-9s',
        name: 'Y Dol 4 “Algorithm 9s”',
        rarity: 'Rare',
        basePrice: 800,
        volatility: 1.5,
        imageUrl: 'https://picsum.photos/seed/algo-9/400/300'
    },
    {
        id: 'bro-jogan-af1-alpha-whites',
        name: 'Bro Jogan AF1 “Alpha Whites”',
        rarity: 'Uncommon',
        basePrice: 220,
        volatility: 0.5,
        imageUrl: 'https://picsum.photos/seed/alpha-white/400/300'
    },
    {
        id: 'rick-rubix-crocs',
        name: 'Rick Rubix x Crocs “Meditation Slides”',
        rarity: 'Common',
        basePrice: 80,
        volatility: 0.2,
        imageUrl: 'https://picsum.photos/seed/rubix-crocs/400/300'
    },
    {
        id: 'union-gundam-rx-78-lows',
        name: 'Union x Gundam “RX-78 Lows”',
        rarity: 'Rare',
        basePrice: 950,
        volatility: 1.2,
        imageUrl: 'https://picsum.photos/seed/gundam-lows/400/300'
    },
    {
        id: 'supreme-lego-air-max',
        name: 'Supreme x Lego Air Max',
        rarity: 'Rare',
        basePrice: 1100,
        volatility: 1.8,
        imageUrl: 'https://picsum.photos/seed/lego-max/400/300'
    },
    {
        id: 'gary-payton-17s-glove-redux',
        name: 'Gary Payton 17s “Glove Redux”',
        rarity: 'Uncommon',
        basePrice: 180,
        volatility: 0.6,
        imageUrl: 'https://picsum.photos/seed/glove-redux/400/300'
    },
    {
        id: 'action-bronson-nb-770',
        name: 'Action Bronson x New Balance 770 “Baklava Special”',
        rarity: 'Rare',
        basePrice: 600,
        volatility: 1.3,
        imageUrl: 'https://picsum.photos/seed/baklava/400/300'
    },
    {
        id: 'bibi-netas-iron-dome-1s',
        name: 'Bibi Netas “Iron Dome 1s”',
        rarity: 'Rare',
        basePrice: 750,
        volatility: 1.6,
        imageUrl: 'https://picsum.photos/seed/iron-dome/400/300'
    },
    {
        id: 'grandmas-triple-s-matkot',
        name: 'Grandma’s Triple S “Matkot Edition”',
        rarity: 'Common',
        basePrice: 50,
        volatility: 0.3,
        imageUrl: 'https://picsum.photos/seed/matkot/400/300'
    },
    {
        id: 'elawn-musk-hyperloop-runners',
        name: 'Elawn Musk Hyperloop Runners',
        rarity: 'Rare',
        basePrice: 1300,
        volatility: 2.0,
        imageUrl: 'https://picsum.photos/seed/hyperloop/400/300'
    },

    // 3. Meme / Parody Pairs
    {
        id: 'crocs-dior-luxury-gardeners',
        name: 'Crocs x Dior “Luxury Gardeners”',
        rarity: 'Rare',
        basePrice: 400,
        volatility: 2.5,
        imageUrl: 'https://picsum.photos/seed/dior-crocs/400/300'
    },
    {
        id: 'heelys-prada-slide-offs',
        name: 'Heelys x Prada “Slide-Offs”',
        rarity: 'Uncommon',
        basePrice: 300,
        volatility: 0.8,
        imageUrl: 'https://picsum.photos/seed/prada-heelys/400/300'
    },
    {
        id: 'shrek-foam-runners',
        name: 'Shrek Foam Runners',
        rarity: 'Common',
        basePrice: 40,
        volatility: 0.9,
        imageUrl: 'https://picsum.photos/seed/shrek-foam/400/300'
    },
    {
        id: 'nb-666-dad-core-max',
        name: 'New Balance 666 “Dad Core Max”',
        rarity: 'Common',
        basePrice: 60,
        volatility: 0.1,
        imageUrl: 'https://picsum.photos/seed/dad-max/400/300'
    },
    {
        id: 'peppa-pig-jordan-3',
        name: 'Peppa Pig x Jordan 3 “Muddy Playground”',
        rarity: 'Common',
        basePrice: 70,
        volatility: 1.5,
        imageUrl: 'https://picsum.photos/seed/peppa-j3/400/300'
    },
    {
        id: 'stockx-verified-fakes',
        name: 'StockX Verified Fakes',
        rarity: 'Uncommon',
        basePrice: 150,
        volatility: 4.0,
        imageUrl: 'https://picsum.photos/seed/stockx-fake/400/300'
    },
    {
        id: 'ai-yeezys-v47',
        name: 'AI-Generated Yeezys “Version 47”',
        rarity: 'Rare',
        basePrice: 500,
        volatility: 2.2,
        imageUrl: 'https://picsum.photos/seed/ai-yeezy/400/300'
    },
    
    // 4. Ultra-Rare, Mythical Tier
    {
        id: 'sb-dunk-what-the-doom',
        name: 'SB Dunk Low “What The Doom”',
        rarity: 'Legendary',
        basePrice: 25000,
        volatility: 3.5,
        imageUrl: 'https://picsum.photos/seed/what-doom/400/300'
    },
    {
        id: 'jordan-1-space-laser',
        name: 'Jordan 1 “Space Laser”',
        rarity: 'Legendary',
        basePrice: 40000,
        volatility: 5.0,
        imageUrl: 'https://picsum.photos/seed/space-laser/400/300'
    },
    {
        id: 'bro-jogan-tesla-cyber-forces',
        name: 'Bro Jogan x Tesla “Cyber Forces”',
        rarity: 'Legendary',
        basePrice: 8000,
        volatility: 4.5,
        imageUrl: 'https://picsum.photos/seed/cyber-force/400/300'
    },
    {
        id: 'donald-drip-gold-standards',
        name: 'Donald Drip “Gold Standards”',
        rarity: 'Legendary',
        basePrice: 18000,
        volatility: 6.0,
        imageUrl: 'https://picsum.photos/seed/gold-drip/400/300'
    },
    {
        id: 'wiz-khalifa-420-slides',
        name: 'Wiz Khalifa 4/20 Slides',
        rarity: 'Legendary',
        basePrice: 4200,
        volatility: 3.0,
        imageUrl: 'https://picsum.photos/seed/wiz-slides/400/300'
    },
    {
        id: 'htm-kobe-god-mode',
        name: 'HTM Kobe “God Mode”',
        rarity: 'Legendary',
        basePrice: 60000,
        volatility: 4.0,
        imageUrl: 'https://picsum.photos/seed/kobe-god/400/300'
    }
];
