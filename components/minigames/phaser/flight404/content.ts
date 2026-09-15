/**
 * FLIGHT 404 (Phaser pilot) — content and tuning.
 * ==============================================
 * Deliberately Phaser-free. Everything in here is plain data: numbers, strings
 * and level layout. Two reasons that matters for this pilot:
 *
 *  1. It is the half of a mini-game that an engine swap should *not* touch. The
 *     canvas build and this build share the same constants, the same section
 *     layout and the same script, which is what makes the comparison fair —
 *     the only variable is the engine.
 *  2. It is safe to import statically from React, so the shell can show the
 *     section list and the help text without pulling in 380KB of engine.
 *
 * Voice is lifted from data/celebrities/yasser-abbasfat/dialogue.ts so the boss
 * and his brothers sound exactly like they do everywhere else in the game: all
 * caps, BROTHER, Bibi, pigeons, and threats that never once land.
 */

// ---------------------------------------------------------------------------
// Geometry. Matches the canvas build exactly.
// ---------------------------------------------------------------------------
export const VIEW_W = 352;
export const VIEW_H = 198;

/**
 * How many device pixels the canvas actually gets, and the zoom that keeps the
 * world the same size in spite of it.
 *
 * These are two different questions and they were one number for too long. The
 * canvas backing store was `VIEW_W × VIEW_H`, so the finest detail the game
 * could ever show was 352 pixels across — a 960px-wide hand-drawn cabin wall
 * was resampled down to a third of its size before it reached the screen, and
 * every hour spent on it was thrown away in the last step of the pipeline.
 *
 * So the canvas is now 960 × 540 and the world camera is zoomed by exactly the
 * ratio, which means the camera still shows 352 × 198 **world units**. Nothing
 * downstream changes: every coordinate, every platform, every constant in
 * `terrain.ts`, every jump arc and all 641 checks are in world units and are
 * untouched. The only difference is how many device pixels each of those units
 * is allowed to be drawn with.
 *
 * Coded placeholders are unaffected too — they are drawn at world size and
 * upscaled by the zoom with nearest-neighbour filtering, so they stay exactly
 * as chunky as they were. Delivered art is simply allowed to be better.
 */
export const RENDER_W = 960;
export const RENDER_H = 540;
export const ZOOM = RENDER_W / VIEW_W;

/**
 * The factor a delivered PNG should be authored at to land pixel-for-pixel.
 *
 * A sprite the asset list calls 34 × 30 world units renders into 34 × ZOOM ≈ 93
 * device pixels, so art drawn on a 93px grid maps 1:1 and nothing is resampled.
 * This is the number to quote to whoever is drawing.
 */
export const ART_SCALE = ZOOM;

/**
 * How much the delivered parallax plates are shrunk to match the characters.
 *
 * One plate is one screenful, so its scale is fixed by its framing: a thing
 * drawn N pixels tall in a 540px plate is N x 198 / 540 world units in the
 * game. The delivered set is framed about 2.3x too zoomed in, measured against
 * the same artist's own `seat-row.png` — the seat sprite is 30 world units and
 * the seats inside `bg-economy-near.png` are about 70. Same object, two files.
 *
 * That cannot be seen while drawing a plate, because there is no character in
 * it to compare against. Rather than have fifteen plates redrawn, they are
 * shrunk here, which costs nothing: the art is authored at 960px across a
 * 352-unit screen, so there are 2.7 device pixels per world unit to spend and
 * shrinking by 2.3 still leaves more detail than the canvas had before.
 *
 * The cost is vertical: a plate drawn to fill the screen does not fill it once
 * it is smaller. The cabin plates therefore tile upward from the floor line
 * rather than being stretched, which is what `buildScenery` does with this.
 */
export const PLATE_SHRINK = 1;

/**
 * How much bigger a drawn character is than its collision box.
 *
 * The delivered cabins are framed for a more zoomed-in game than this one: a
 * seat back in a plate is about 70 world units and the player's body is 26, so
 * he reads as knee-high. Shrinking the plates to fix that breaks them, because
 * a plate is a composition — ceiling, window band, seats, floor, once — and
 * anything that makes it smaller either crops it or tiles it into a
 * double-decker aeroplane with no identifiable floor.
 *
 * So the drawing grows instead of the cabin shrinking. Only the sprite is
 * scaled; the arcade body, the jump arc, the tier heights and every test stay
 * in world units and are untouched. A sprite larger than its hitbox is the
 * forgiving direction — shots that look like they should miss do miss — and it
 * is what most of this genre does anyway.
 *
 * This is a stopgap for art framed at the wrong zoom, not a permanent feature:
 * re-framed plates want it back at 1.
 */
export const FIGURE_SCALE = 1.7;

/** The aisle carpet — every character's feet line, and the arcade world floor. */
export const FLOOR_Y = 164;
/** Feet line for a mook wedged into an open overhead bin. */
export const BIN_FEET = 58;
/** Distance between seat rows / windows / bin doors. One parallax tile. */
export const SEAT_PITCH = 44;

export const GRAVITY = 620;
export const JUMP_V = -218;
export const RUN_SPEED = 88;
export const PLAYER_H = 26;
/** Short enough to duck a seltzer spray or a megaphone ring. */
export const CROUCH_H = 15;
export const NOTICE_RANGE = 152;

/** Half-width of the light pool in an unpowered section, bare-handed. */
export const DARK_R_BARE = 34;
/** ...and with the Glow-in-the-Dark Lighter out. Same section, different game. */
export const DARK_R_LIT = 96;

/** How wide the baked darkness overlay texture is. Must exceed VIEW_W by a lot
 *  so that an image centred on the player still covers both screen edges. */
export const DARK_TEX_W = 1024;
export const DARK_TEX_H = 640;

/**
 * Most damage Yasser will absorb during any single attack before the falafel
 * vest simply holds. Without this the fight collapses: stand on him with the
 * Dog Launcher and he dies inside one rant and nobody ever sees the pattern.
 */
export const BOSS_WINDOW = 36;
export const BOSS_HP = 280;

// ---------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------
export const MOOK_BARKS = [
    'YESSS BROTHER, EVEN THE WIFI IS ZIONIST!',
    'THE MOON IS A DRONE, BROTHER! A DRONE!',
    'BIBI CONTROLS THE PIGEONS, CONFIRMED!',
    'THE DUNKS ARE CURSED! WE MUST CLEANSE THE DUNKS!',
    'BROTHER, WHICH ONE IS THE TRIGGER?',
    'MY VEST IS ONLY FALAFEL! IT IS FINE!',
    'WHOSE JOB WAS THE DOOR? IT WAS YOUR JOB!',
];
export const TRIP_BARKS = [
    'THE FLOOR IS AN OCCUPIER!',
    'WHO PUT A CARPET THERE?!',
    'I MEANT TO DO THAT, BROTHER!',
];
export const BONK_BARKS = [
    'MY OWN FALAFEL! BETRAYAL!',
    'THE FALAFEL HAS BEEN TURNED!',
];
export const TROLLEY_BARKS = [
    'THE TROLLEY IS ALSO ZIONIST!',
    'I AM SAFE BEHIND THE DRINKS!',
    'IS THERE A TAHINI ONE?',
];
export const PANIC_BARKS = [
    'I DID NOT SIGN UP FOR THE FRONT LINE, BROTHER!',
    'THIS IS A MANAGEMENT PROBLEM!',
];
export const CLANK_BARKS = [
    'THE TROLLEY HOLDS, BROTHER!',
    'THE DRINKS PROTECT ME!',
];
export const YASSER_RANTS = [
    'THE SKY? FAKE. THE CLOUDS? CGI.',
    'JORDAN ONCE ATE A FALAFEL IN 1988 — NEVER FORGET!',
    'THE BALD EAGLE IS A ZIONIST SPY DRONE!',
    'BIBI IS STEALING THE AIR YOU BREATHE!',
    'COFFEE IS A CRIME AGAINST FALAFELSTEEN!',
    'KANYE TEXTED ME. SAID HE IS FROM FALAFELSTEEN TOO.',
    'THIS AIRCRAFT IS PROPERTY OF THE RESISTANCE NOW!',
];
export const YASSER_INTRO = 'YOU! YES, YOU! HAND OVER THE PANDAS! THEY FUND THE OCCUPATION!';
export const YASSER_THROW = 'FALAFELSTEEN THROWS FIRST!';
export const YASSER_SUMMON = 'BROTHERS! TO ME! BRING THE TROLLEY!';
export const YASSER_CHARGE = 'I DETONATE FOR JUSTICE AND FALAFELSTEEN!';
export const YASSER_WALL = 'THE WALL IS ALSO ZIONIST!';
export const YASSER_MEGA = 'FREE FALAFELSTEEN OR I WILL LIBERATE YOUR WALLET!';
export const YASSER_FOOT = 'MY FOOT! THE FALAFEL BETRAYS ME!';
export const YASSER_VEST_HOLDS = 'THE VEST HOLDS!';
export const YASSER_DEFEAT = [
    'THIS IS A SETUP! A ZIONIST TRAP!',
    'THE FALAFEL WILL RISE AGAIN!',
    'FREE… FALAF… AHHHHHH—',
];
export const SUMMON_ARGUMENT: [string, string] = [
    'WHOSE JOB WAS THE DOOR? IT WAS YOUR JOB!',
    'IT WAS NOT MY JOB, BROTHER!',
];
export const THROWER_AIM = 'FALAFEL INCOMING, BROTHER!';
export const THROWER_DISMOUNT = 'I AM COMING DOWN, BROTHER! ON PURPOSE!';

/** Passengers are grateful in the least useful way available to them. */
export const FREED_LINES = [
    'THANK YOU! NOW GET MY AIRPODS FROM 14C!',
    'Is the wifi back? I have a raid at nine.',
    'I filmed all of it. You look insane, by the way.',
    'God bless you. Do you have a bureka on you?',
    'Finally. Tell the pilot I asked for the chicken.',
    'My connection is in Larnaca, so, quickly please.',
];
/** ...and withering when you shoot them, which you should not do. */
export const WITHERED_LINES = [
    'I PAID FOR THIS SEAT.',
    'You are the rescue? Genuinely?',
    'That was my knee. My KNEE.',
    'I am writing a review about you specifically.',
    'Sir. SIR. I have a connecting flight.',
];

// ---------------------------------------------------------------------------
// Level data. Authored rather than generated: the comedy depends on the mook
// behind the trolley being exactly where you stop being careful.
// ---------------------------------------------------------------------------
export type MookKind = 'charger' | 'thrower' | 'trolley';

export interface SpawnDef { kind: MookKind; x: number; perch?: boolean }

export interface SectionDef {
    name: string;
    /**
     * Slug for this section's delivered parallax art, as
     * `bg-<art>-far|mid|near`. Separate from `name` because the name is player-
     * facing and gets rewritten for tone, and a filename that changes when
     * somebody improves a section title is a filename that silently stops
     * matching.
     */
    art: string;
    tag: string;
    length: number;
    /** Unpowered stretch — see the darkness model in gameScene.ts. */
    dark: boolean;
    boss?: boolean;
    /**
     * How far this stretch has stopped being a plane. See `creep.ts` — the
     * level is a gradient from "I am on a plane" to "this is a market and I am
     * also still on a plane", and it only ever goes up.
     */
    creep: import('./creep').Creep;
    mooks: SpawnDef[];
    hostages: number[];
    /** Drinks trolleys parked in the aisle; real static bodies, real cover. */
    trolleys: number[];
}

export const SECTIONS: SectionDef[] = [
    {
        name: 'ECONOMY',
        art: 'economy',
        tag: 'ROWS 30-44 — THE SMELL IS TAHINI',
        // A plane. Nothing is wrong yet, and nothing should be: this section
        // exists so the next one can be wrong. The tahini is the only clue.
        length: 760, dark: false, creep: 'plane',
        mooks: [
            { kind: 'charger', x: 210 },
            { kind: 'thrower', x: 330, perch: true },
            { kind: 'charger', x: 455 },
            { kind: 'trolley', x: 560 },
            { kind: 'thrower', x: 660 },
        ],
        hostages: [175, 420, 690],
        trolleys: [560],
    },
    {
        name: 'THE GALLEY',
        art: 'galley',
        tag: 'POWER IS OUT — SOMEONE PULLED A BREAKER',
        // The turn. Still an aircraft galley, except a man is brewing coffee on
        // a fingjan next to his donkey and has not acknowledged the power cut.
        // One wrong thing, not five — one man and a donkey is a question, two
        // men and a donkey is a bazaar and the joke is spent early.
        length: 640, dark: true, creep: 'wrong',
        mooks: [
            { kind: 'trolley', x: 190 },
            { kind: 'charger', x: 300 },
            { kind: 'charger', x: 352 },
            { kind: 'thrower', x: 470, perch: true },
            { kind: 'trolley', x: 560 },
        ],
        hostages: [250, 520],
        trolleys: [190, 560],
    },
    {
        name: 'BUSINESS CLASS',
        art: 'business',
        tag: 'THE LIE-FLATS ARE FULLY OCCUPIED',
        // The cabin has lost. Cloth strung between the lie-flats, a shawarma
        // spit where the bar cart was, stalls in the aisle, everybody talking.
        length: 820, dark: false, creep: 'shuk',
        mooks: [
            { kind: 'charger', x: 200 },
            { kind: 'thrower', x: 290, perch: true },
            { kind: 'trolley', x: 385 },
            { kind: 'charger', x: 510 },
            { kind: 'thrower', x: 600 },
            { kind: 'charger', x: 690 },
            { kind: 'thrower', x: 755, perch: true },
        ],
        hostages: [245, 465, 735],
        trolleys: [385],
    },
    {
        name: 'THE COCKPIT',
        art: 'cockpit',
        tag: 'HE IS SHOUTING AT THE AUTOPILOT',
        // Everyone is here and nobody is helping.
        length: VIEW_W, dark: false, boss: true, creep: 'bedlam',
        mooks: [],
        hostages: [],
        trolleys: [300],
    },
];

export const MOOK_HP: Record<MookKind, number> = { charger: 30, thrower: 24, trolley: 36 };

/** Yasser's attack cycle per phase. See gameScene.ts `bossNext`. */
export const BOSS_CYCLES: Record<number, string[]> = {
    1: ['rant', 'throw', 'summon', 'charge'],
    2: ['rant', 'throw', 'megaphone', 'charge', 'throw'],
    3: ['charge', 'megaphone', 'throw', 'rant', 'charge'],
};

/** Every emoji glyph the game bakes into a texture at boot. */
export const GLYPHS = {
    star: '⭐',
    swirl: '💫',
    boom: '💥',
    falafel: '🧆',
    seltzer: '🥤',
    coffee: '☕',
    cart: '🛒',
    mega: '📢',
    baguette: '🥖',
    bureka: '🥟',
    juice: '🧃',
    bolt: '⚡',
    torch: '🔦',
    scared: '😰',
    cheer: '🙌',
    camera: '📸',
    phone: '📱',
    mask: '😷',
    lock: '🔒',
    door: '🚪',
    fist: '👊',
    person: '🧍',
    sleep: '💤',
    // Weapon glyphs from systems/weapons.ts, so a thrown weapon is drawn as the
    // thing you actually threw.
    chancla: '🩴',
    frisbee: '🥏',
    crowbar: '🔧',
    dog: '🌭',
    milk: '🥛',
} as const;

export type GlyphKey = keyof typeof GLYPHS;

/** Map a weapon glyph string back to a baked texture key. */
export const GLYPH_KEY_BY_CHAR: Record<string, GlyphKey> = Object.fromEntries(
    (Object.entries(GLYPHS) as [GlyphKey, string][]).map(([k, v]) => [v, k]),
) as Record<string, GlyphKey>;

export const HELP_TEXT =
    '◀ ▶ run · ▼ crouch behind a seat · ▲ aim at the overhead bins · Fire · Jump. ' +
    'Stand in front of a strapped-in passenger to unbuckle them. Do not shoot them. ' +
    'The galley has no power — the Glow-in-the-Dark Lighter is the difference between ' +
    'seeing a charge coming and not.';
