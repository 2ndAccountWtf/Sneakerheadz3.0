import type { SpriteDef } from '../../systems/sprites/types';
import type { PaletteSwap } from '../../systems/sprites/palette';

/**
 * Sneaker sprites.
 * ========================================================================
 * The shoes are the product, so they get the most careful grid in the game.
 *
 * Unlike the cast (16x24 portrait) a sneaker is authored **24 wide x 12 tall,
 * side profile, toe on the left, heel on the right**, with the sole occupying
 * the bottom two-to-five rows depending on archetype. Every archetype shares
 * that baseline so a wall of store cards reads as one product line.
 *
 * There are 45 models in data/sneakers.ts and only ten silhouettes here. That
 * is deliberate: hand-drawing 45 shoes at this size would produce 45 blurs that
 * all look the same. Instead each model resolves to an archetype plus a
 * PaletteSwap colourway (see SHOE_LOOKS at the bottom), which is how a real
 * sneaker line works anyway — one last, many colourways.
 *
 * SWAP ROLES — every archetype uses the same characters for the same job, so a
 * colourway written for one silhouette works on all of them:
 *
 *   W  upper, base tone          w  upper, shade / midsole wrap
 *   c  accent overlay (swoosh, stripe, checker, strap), C its shade
 *   g  midsole                   G  outsole
 *   d  collar lining / lace shadow (the dark hole you see into)
 *   o  outline — never swapped, it is what keeps a black shoe legible
 *   t  boot lace column          E  boot welt / box card
 *   y Y l  gold, reserved for Legendary treatments
 *
 * So Panda is { W: 'd', w: 'o', c: 'W', C: 'w' } and Triple White is
 * { W: 'W', w: 'W', c: 'W', C: 'w' }. Nothing else needs to change.
 */

export const SPR_SHOE_LOWTOP: SpriteDef = {
    id: 'shoe-lowtop',
    fps: 0,
    note: 'Low basketball shoe (AF1/Dunk). Tell: collar tops out at row 2 over the heel only, three-row sole (w/g/G), one long swoosh band sweeping up from the toe.',
    frames: [
        [
            '........................',
            '........................',
            '...............oooooo...',
            '.............ooWdddddWo.',
            '.........oooWWWdddddWWo.',
            '.....oooWWWWWWddWWWWWWo.',
            '...ooWWWWWWWWWWWcccWWWo.',
            '..oWWWWWWcccccccWWWWWWo.',
            '.oWWWWcccccccWWWWWWWWWo.',
            '.owwwwwwwwwwwwwwwwwwwwo.',
            '.oggggggggggggggggggggo.',
            '..oGGGGGGGGGGGGGGGGGGo..',
        ],
    ],
};

export const SPR_SHOE_HIGHTOP: SpriteDef = {
    id: 'shoe-hightop',
    fps: 0,
    note: 'High-top (Jordan 1). Tell: the collar is a tall padded column filling rows 0-5 across the back third, so the silhouette is a wedge that is twice as tall at the heel as at the toe.',
    frames: [
        [
            '..............oooooooo..',
            '............ooWWddddWWo.',
            '...........oWWWddddddWo.',
            '...........oWWdddddddWo.',
            '.........oooWWdddddddWo.',
            '.....oooWWWWWWddddWWWWo.',
            '...ooWWWWWWWWWWWcccWWWo.',
            '..oWWWWWWcccccccWWWWWWo.',
            '.oWWWWcccccccWWWWWWWWWo.',
            '.owwwwwwwwwwwwwwwwwwwwo.',
            '.oggggggggggggggggggggo.',
            '..oGGGGGGGGGGGGGGGGGGo..',
        ],
    ],
};

export const SPR_SHOE_RUNNER: SpriteDef = {
    id: 'shoe-runner',
    fps: 0,
    note: 'Performance runner. Tell: FOUR sole rows with a g/G speckle band (foam midsole) under a very low, thin upper that only reaches row 3 — bottom-heavy, the inverse of the boot.',
    frames: [
        [
            '........................',
            '........................',
            '..................oooo..',
            '.............ooooWWWWo..',
            '.........oooWWWWWWWWWo..',
            '.....oooWWWWWWWWWWWWWo..',
            '..ooWWWWWWWWWWWWWWWWWWo.',
            '.oWWWcccccccccccWWWWWWo.',
            '.owwwwwwwwwwwwwwwwwwwwo.',
            '.oggWggWggWggWggWggWggo.',
            '.oggggggggggggggggggggo.',
            '..oGGGGGGGGGGGGGGGGGGo..',
        ],
    ],
};

export const SPR_SHOE_KNIT: SpriteDef = {
    id: 'shoe-knit',
    fps: 0,
    note: 'Knit sock shoe (Yeezy 350 / Flyknit). Tell: NO midsole band at all — one sole row — and the upper runs unbroken from collar to floor with a w dither for knit grain. Reads as a smooth continuous blob.',
    frames: [
        [
            '........................',
            '.............oooooo.....',
            '...........ooWddddWo....',
            '.........ooWWWddddWWo...',
            '.......ooWWWWWWddWWWWo..',
            '....oooWWWWWWWWWWWWWWo..',
            '..ooWWWWWWWWWWWWWWWWWo..',
            '.oWWWWwwWWWWWWWWwwWWWo..',
            '.oWWWWWWWWWWWWWWWWWWWo..',
            '.oWWWWWWWWWWWWWWWWWWWo..',
            '.oWWwwWWWWWWWWwwWWWWWo..',
            '..oGGGGGGGGGGGGGGGGGGo..',
        ],
    ],
};

export const SPR_SHOE_FOAM: SpriteDef = {
    id: 'shoe-foam',
    fps: 0,
    note: 'One-piece moulded clog (Foam Runner / Croc). Tell: punched holes in the toe, a single colour top to bottom with no sole seam, and a detached thin heel strap standing clear of the body at rows 1-5.',
    frames: [
        [
            '........................',
            '......oooooo............',
            '....ooWWWWWWoo......ooo.',
            '..ooWWoWWWWoWWoo....oco.',
            '..oWWWWWWWWWWWWWo..occo.',
            '.oWWoWWoWWWWWWWWo..occo.',
            '.oWWWWWWWWWWWWWWWo.occo.',
            '.oWWWWWWWWWWWWWWWWoocco.',
            '.oWWWWWWWWWWWWWWWWWWWWo.',
            '.oWWWWWWWWWWWWWWWWWWWWo.',
            '.oWWWWWWWWWWWWWWWWWWWWo.',
            '..oWWWWWWWWWWWWWWWWWWo..',
        ],
    ],
};

export const SPR_SHOE_CHUNKY: SpriteDef = {
    id: 'shoe-chunky',
    fps: 0,
    note: 'Dad shoe / Triple S. Tell: the sole is FIVE rows and overhangs the upper on both sides (it reaches x0 and x23 while the upper does not), so the shoe is mostly sole.',
    frames: [
        [
            '........................',
            '........................',
            '..........ooooooooo.....',
            '.......oooWWWddddWWo....',
            '....oooWWWWWWddddWWWo...',
            '..ooWWWcccWWWWWWWWWWWo..',
            '.oWWWcccWWWWWWWWWWWWWWo.',
            'owwwwwwwwwwwwwwwwwwwwwwo',
            'oggggggggggggggggggggggo',
            'oggggggggggggggggggggggo',
            'oGGGGGGGGGGGGGGGGGGGGGGo',
            '.oGGGGGGGGGGGGGGGGGGGGo.',
        ],
    ],
};

export const SPR_SHOE_SKATE: SpriteDef = {
    id: 'shoe-skate',
    fps: 0,
    note: 'Vulcanised skate shoe. Tell: dead-flat full-width sole with no toe spring, a wide blunt toe that fills x0 from row 7 down, and a long low side stripe at row 8.',
    frames: [
        [
            '........................',
            '........................',
            '................oooo....',
            '...........ooooWddddWo..',
            '.......ooooWWWWddddWWo..',
            '....oooWWWwWWWWWWWWWWo..',
            '..ooWWWWWWwWWWWWWWWWWWo.',
            'oWWWWWWWWWwWWWWWWWWWWWo.',
            'oWWccccccccccccccWWWWWo.',
            'oWWWWWWWWWWWWWWWWWWWWWo.',
            'oggggggggggggggggggggggo',
            'oGGGGGGGGGGGGGGGGGGGGGGo',
        ],
    ],
};

export const SPR_SHOE_SLIPON: SpriteDef = {
    id: 'shoe-slipon',
    fps: 0,
    note: 'Laceless slip-on. Tell: checkerboard dither over the whole toe half plus a wide shallow collar opening that runs forward to mid-foot. Same flat sole as the skate shoe, no lace ticks.',
    frames: [
        [
            '........................',
            '........................',
            '...........oooooooo.....',
            '........oooWWddddWWo....',
            '.....oooWWWWWddddWWWo...',
            '..oocWcWcWWWWWWWWWWWWo..',
            '.oWcWcWcWcWWWWWWWWWWWo..',
            'oWcWcWcWcWcWWWWWWWWWWo..',
            'oWcWcWcWcWcWWWWWWWWWWo..',
            'oWWWWWWWWWWWWWWWWWWWWo..',
            'oggggggggggggggggggggggo',
            'oGGGGGGGGGGGGGGGGGGGGGGo',
        ],
    ],
};

export const SPR_SHOE_BOOT: SpriteDef = {
    id: 'shoe-boot',
    fps: 0,
    note: 'Laced boot. Tell: square-topped shaft filling rows 0-5, a vertical lace column of t pixels up the front of the shaft, a stitched welt row (E) and a lugged outsole with gaps chewed out of row 11.',
    frames: [
        [
            '........oooooooooooooo..',
            '.......oWWdddddddddWWo..',
            '.......oWtoWWWWWWWWtWo..',
            '.......oWotWWWWWWWWtWo..',
            '....ooooWtoWWWWWWWWtWo..',
            '..ooWWWWotWWWWWWWWWWWo..',
            '.oWWWWWWWWWWWWWWWWWWWo..',
            '.oWWWWWWWWWWWWWWWWWWWo..',
            '.oWWWWWWWWWWWWWWWWWWWo..',
            '.oEEEEEEEEEEEEEEEEEEEo..',
            '.oGGGGGGGGGGGGGGGGGGGo..',
            '.oGG.GG.GG.GG.GG.GG.Go..',
        ],
    ],
};

export const SPR_SHOE_SLIDE: SpriteDef = {
    id: 'shoe-slide',
    fps: 0,
    note: 'Slide / chancla. Tell: nothing above row 3 except one arched strap with open air under it; the shoe itself is a four-row slab. Mostly empty frame — unmistakable next to anything laced.',
    frames: [
        [
            '........................',
            '........................',
            '........................',
            '.......ooooooooo........',
            '.....ooccccccccco.......',
            '....occco.....occo......',
            '...occo........occo.....',
            '.oWWWWWWWWWWWWWWWWWWWo..',
            '.oWWWWWWWWWWWWWWWWWWWo..',
            '.owwwwwwwwwwwwwwwwwwwo..',
            '.oGGGGGGGGGGGGGGGGGGGo..',
            '..ooooooooooooooooooo...',
        ],
    ],
};

export const SPR_SHOE_BOX: SpriteDef = {
    id: 'shoe-box',
    fps: 3,
    note: 'Shoe box, 20x14, lid ajar. Frame 1 lifts the lid a row further and fills the gap with l (gold) so pickups pulse. Used for cart-race MacGuffins and bag pickups.',
    frames: [
        [
            '....................',
            '..oooooooooooooooo..',
            '.oWWWWWWWWWWWWWWWWo.',
            '.oWccccccccccccWWWo.',
            '.oWWWWWWWWWWWWWWWWo.',
            '.oooooooooooooooooo.',
            '.dddddddddddddddddd.',
            '..oeeeeeeeeeeeeeeo..',
            '..oeeeeeeeeeeeeeeo..',
            '..oeEEEEEEEEEEEEeo..',
            '..oeEcccccccccEEeo..',
            '..oeEEEEEEEEEEEEeo..',
            '..oeeeeeeeeeeeeeeo..',
            '..oooooooooooooooo..',
        ],
        [
            '..oooooooooooooooo..',
            '.oWWWWWWWWWWWWWWWWo.',
            '.oWccccccccccccWWWo.',
            '.oWWWWWWWWWWWWWWWWo.',
            '.oooooooooooooooooo.',
            '.llllllllllllllllll.',
            '.llllllllllllllllll.',
            '..oeeeeeeeeeeeeeeo..',
            '..oeeeeeeeeeeeeeeo..',
            '..oeEEEEEEEEEEEEeo..',
            '..oeEcccccccccEEeo..',
            '..oeEEEEEEEEEEEEeo..',
            '..oeeeeeeeeeeeeeeo..',
            '..oooooooooooooooo..',
        ],
    ],
};

export const SPR_SHOE_GRAIL: SpriteDef = {
    id: 'shoe-grail',
    fps: 2,
    note: 'Legendary presentation: a gold shoe on a plinth under a gallery light cone. Frame 1 moves the specular glint across the upper. 24x20.',
    frames: [
        [
            '........oooooooo........',
            '........oGGGGGGo........',
            '.........ollllo.........',
            '........dddddddd........',
            '.......dddddddddd.......',
            '......dddddddddddd......',
            '.....dddddddddddddd.....',
            '....dddddddddoolooooolo.',
            '...ddddddooolllooooollo.',
            '..dddooolllllloollllllo.',
            '.ddoollWWWllllllyyylllo.',
            'ddollWWWlyyyyyyyllllllod',
            'dollllyyyyyyylllllllllod',
            'doyyyyyyyyyyyyyyyyyyyyod',
            'doyyyyyyyyyyyyyyyyyyyyod',
            'ddoYYYYYYYYYYYYYYYYYYodd',
            '.gggggggggggggggggggggg.',
            '.GGGGGGGGGGGGGGGGGGGGGG.',
            '.....GGGGGGGGGGGGGG.....',
            '..GGGGGGGGGGGGGGGGGGGG..',
        ],
        [
            '........oooooooo........',
            '........oGGGGGGo........',
            '.........ollllo.........',
            '........dddddddd........',
            '.......dddddddddd.......',
            '......dddddddddddd......',
            '.....dddddddddddddd.....',
            '....dddddddddoolooooolo.',
            '...ddddddooolllooooollo.',
            '..dddooollllllooWWllllo.',
            '.ddoolllllllllllWWWlllo.',
            'ddollllllyyyyyyyllllllod',
            'dollllyyyyyyylllllllllod',
            'doyyyyyyyyyyyyyyyyyyyyod',
            'doyyyyyyyyyyyyyyyyyyyyod',
            'ddoYYYYYYYYYYYYYYYYYYodd',
            '.gggggggggggggggggggggg.',
            '.GGGGGGGGGGGGGGGGGGGGGG.',
            '.....GGGGGGGGGGGGGG.....',
            '..GGGGGGGGGGGGGGGGGGGG..',
        ],
    ],
};

/** The ten silhouettes, in the order they are documented above. */
export const SHOE_ARCHETYPES: SpriteDef[] = [
    SPR_SHOE_LOWTOP,
    SPR_SHOE_HIGHTOP,
    SPR_SHOE_RUNNER,
    SPR_SHOE_KNIT,
    SPR_SHOE_FOAM,
    SPR_SHOE_CHUNKY,
    SPR_SHOE_SKATE,
    SPR_SHOE_SLIPON,
    SPR_SHOE_BOOT,
    SPR_SHOE_SLIDE,
];

/** Box and plinth — not worn, but they carry shoes. */
export const SHOE_EXTRA_SPRITES: SpriteDef[] = [
    SPR_SHOE_BOX,
    SPR_SHOE_GRAIL,
];

export const SNEAKER_SPRITES: SpriteDef[] = [...SHOE_ARCHETYPES, ...SHOE_EXTRA_SPRITES];

const ARCHETYPE_BY_ID = new Map(SNEAKER_SPRITES.map(s => [s.id, s]));

/** The sprite for an archetype id, e.g. 'shoe-hightop'. */
export const archetypeSprite = (id: string): SpriteDef | undefined => ARCHETYPE_BY_ID.get(id);

export interface ShoeLook {
    /** A SpriteDef id from SHOE_ARCHETYPES. */
    archetype: string;
    /** Colourway, in the swap roles documented at the top of this file. */
    swap: PaletteSwap;
}

/**
 * Colourway shorthand. Spelling out six keys 45 times buries the only
 * interesting part, which is the colours.
 */
const cw = (
    upper: [string, string],
    accent: [string, string],
    sole: [string, string],
    extra: PaletteSwap = {},
): PaletteSwap => ({
    W: upper[0], w: upper[1],
    c: accent[0], C: accent[1],
    g: sole[0], G: sole[1],
    ...extra,
});

const look = (archetype: string, swap: PaletteSwap): ShoeLook => ({ archetype, swap });

/**
 * Every model in data/sneakers.ts, keyed by sneaker id.
 *
 * Rarity is meant to be legible without reading the label: Commons are grey,
 * beige and washed navy; Uncommons get one saturated accent; Rares get a real
 * two-tone colourway; Legendaries get gold (l/y/Y) or a colour combination
 * nothing else in the list is allowed to use.
 */
export const SHOE_LOOKS: Record<string, ShoeLook> = {
    'chrono-glides': look('shoe-runner', cw(['w', 'g'], ['c', 'C'], ['W', 'g'])),
    'aether-jumps': look('shoe-hightop', cw(['W', 'w'], ['c', 'C'], ['W', 'g'])),
    'velocity-vipers': look('shoe-runner', cw(['n', 'N'], ['o', 'd'], ['d', 'o'])),
    'cyber-runners': look('shoe-knit', cw(['b', 'B'], ['c', 'C'], ['d', 'o'])),
    'y-dol-4-boost': look('shoe-knit', cw(['e', 'E'], ['w', 'g'], ['w', 'g'])),
    'jordan-retro-future': look('shoe-hightop', cw(['W', 'w'], ['r', 'R'], ['W', 'g'], { d: 'o' })),
    'g-unit-g6': look('shoe-hightop', cw(['W', 'w'], ['y', 'Y'], ['W', 'g'])),
    'quantico-dream': look('shoe-lowtop', cw(['y', 'Y'], ['o', 'd'], ['W', 'g'], { d: 'o' })),
    'off-white-ikea-frakta': look('shoe-lowtop', cw(['b', 'B'], ['y', 'Y'], ['W', 'g'])),
    'balenciaga-crocs-gundam': look('shoe-foam', cw(['W', 'w'], ['r', 'R'], ['W', 'g'])),
    'mschef-satans-skateboard': look('shoe-slipon', cw(['d', 'o'], ['r', 'R'], ['W', 'g'])),
    'ai-neural-net-runners': look('shoe-runner', cw(['p', 'P'], ['c', 'C'], ['d', 'o'])),
    'nike-air-yeezy-2-red-october': look('shoe-hightop', cw(['r', 'R'], ['R', 'o'], ['r', 'R'], { d: 'R' })),
    'nike-sb-dunk-low-pigeon': look('shoe-skate', cw(['g', 'G'], ['W', 'w'], ['W', 'g'])),
    'jordan-1-retro-high-chicago': look('shoe-hightop', cw(['W', 'w'], ['r', 'R'], ['W', 'g'], { d: 'o' })),
    'nike-mag-self-lacing': look('shoe-hightop', cw(['g', 'G'], ['c', 'C'], ['W', 'c'])),
    'travis-scott-jordan-1-reverse-mocha': look('shoe-hightop', cw(['w', 'g'], ['E', 't'], ['W', 'g'])),
    'union-jordan-1-black-toe': look('shoe-hightop', cw(['W', 'w'], ['o', 'd'], ['W', 'g'], { d: 'R' })),
    'off-white-jordan-1-unc': look('shoe-hightop', cw(['W', 'w'], ['b', 'B'], ['W', 'g'], { d: 'o' })),
    'lv-nike-af1': look('shoe-lowtop', cw(['W', 'w'], ['E', 't'], ['W', 'l'], { d: 'l' })),
    'nike-sb-dunk-low-paris': look('shoe-skate', cw(['m', 'M'], ['p', 'P'], ['W', 'g'])),
    'nb-2002r-protection-pack': look('shoe-runner', cw(['g', 'G'], ['w', 'W'], ['w', 'g'])),
    'y-dol-4-algorithm-9s': look('shoe-knit', cw(['G', 'd'], ['c', 'C'], ['d', 'o'])),
    'bro-jogan-af1-alpha-whites': look('shoe-lowtop', cw(['W', 'w'], ['W', 'w'], ['W', 'w'], { d: 'w' })),
    'rick-rubix-crocs': look('shoe-slide', cw(['e', 'E'], ['t', 'E'], ['E', 't'])),
    'union-gundam-rx-78-lows': look('shoe-lowtop', cw(['W', 'w'], ['b', 'B'], ['r', 'R'], { d: 'y' })),
    'supreme-lego-air-max': look('shoe-runner', cw(['r', 'R'], ['y', 'Y'], ['W', 'g'])),
    'gary-payton-17s-glove-redux': look('shoe-hightop', cw(['N', 'o'], ['y', 'Y'], ['W', 'g'])),
    'action-bronson-nb-770': look('shoe-runner', cw(['e', 'E'], ['n', 'N'], ['w', 'g'])),
    'bibi-netas-iron-dome-1s': look('shoe-boot', cw(['W', 'w'], ['b', 'B'], ['g', 'G'], { t: 'b', E: 'b' })),
    'grandmas-triple-s-matkot': look('shoe-chunky', cw(['w', 'g'], ['m', 'M'], ['e', 'E'])),
    'elawn-musk-hyperloop-runners': look('shoe-runner', cw(['w', 'W'], ['r', 'R'], ['g', 'G'])),
    'crocs-dior-luxury-gardeners': look('shoe-foam', cw(['w', 'g'], ['l', 'y'], ['w', 'g'])),
    'heelys-prada-slide-offs': look('shoe-slipon', cw(['G', 'd'], ['W', 'w'], ['W', 'g'])),
    'shrek-foam-runners': look('shoe-foam', cw(['n', 'N'], ['N', 'o'], ['n', 'N'])),
    'nb-666-dad-core-max': look('shoe-chunky', cw(['w', 'g'], ['b', 'B'], ['W', 'g'])),
    'peppa-pig-jordan-3': look('shoe-hightop', cw(['m', 'M'], ['w', 'g'], ['E', 't'], { d: 'E' })),
    'stockx-verified-fakes': look('shoe-lowtop', cw(['n', 'N'], ['W', 'w'], ['W', 'g'])),
    'ai-yeezys-v47': look('shoe-knit', cw(['m', 'M'], ['p', 'P'], ['m', 'M'])),
    'sb-dunk-what-the-doom': look('shoe-skate', cw(['r', 'R'], ['n', 'N'], ['p', 'P'], { d: 'y' })),
    'jordan-1-space-laser': look('shoe-hightop', cw(['d', 'o'], ['c', 'C'], ['l', 'y'], { d: 'C' })),
    'bro-jogan-tesla-cyber-forces': look('shoe-lowtop', cw(['g', 'G'], ['W', 'w'], ['d', 'o'], { d: 'c' })),
    'donald-drip-gold-standards': look('shoe-lowtop', cw(['l', 'y'], ['W', 'l'], ['y', 'Y'], { d: 'Y' })),
    'wiz-khalifa-420-slides': look('shoe-slide', cw(['n', 'N'], ['l', 'y'], ['N', 'o'])),
    'htm-kobe-god-mode': look('shoe-knit', cw(['W', 'w'], ['l', 'y'], ['l', 'y'], { d: 'l' })),
};

/** Anything unrecognised still gets a shoe rather than a rectangle. */
export const FALLBACK_LOOK: ShoeLook = look('shoe-lowtop', cw(['w', 'g'], ['c', 'C'], ['W', 'g']));

export function lookForSneaker(id: string): ShoeLook {
    return SHOE_LOOKS[id] ?? FALLBACK_LOOK;
}
