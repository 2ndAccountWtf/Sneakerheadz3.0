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
    tag: string;
    length: number;
    /** Unpowered stretch — see the darkness model in gameScene.ts. */
    dark: boolean;
    boss?: boolean;
    mooks: SpawnDef[];
    hostages: number[];
    /** Drinks trolleys parked in the aisle; real static bodies, real cover. */
    trolleys: number[];
}

export const SECTIONS: SectionDef[] = [
    {
        name: 'ECONOMY',
        tag: 'ROWS 30-44 — THE SMELL IS TAHINI',
        length: 760, dark: false,
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
        tag: 'POWER IS OUT — SOMEONE PULLED A BREAKER',
        length: 640, dark: true,
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
        tag: 'THE LIE-FLATS ARE FULLY OCCUPIED',
        length: 820, dark: false,
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
        tag: 'HE IS SHOUTING AT THE AUTOPILOT',
        length: VIEW_W, dark: false, boss: true,
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
