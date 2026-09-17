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
 * So the canvas is a whole-number multiple of the world and the camera is zoomed
 * by exactly that multiple, which means it still shows 352 × 198 **world
 * units**.
 *
 * **The multiple has to be a whole number, and that is not a detail.** The
 * canvas was 960 × 540 for a while, which is 2.727 world units per pixel —
 * and nearest-neighbour cannot draw 2.727 device pixels per source pixel, so
 * it drew some of them 3 wide and some 2. Across any twenty pixels of a sprite,
 * fifteen came out 3 wide and five came out 2: an uneven grid on every
 * character in the game, which reads as mush and looks exactly like art that
 * was drawn too small. At ×3 every source pixel is exactly three device pixels
 * and the whole thing snaps into focus. Nothing
 * downstream changes: every coordinate, every platform, every constant in
 * `terrain.ts`, every jump arc and all 641 checks are in world units and are
 * untouched. The only difference is how many device pixels each of those units
 * is allowed to be drawn with.
 *
 * Coded placeholders are unaffected too — they are drawn at world size and
 * upscaled by the zoom with nearest-neighbour filtering, so they stay exactly
 * as chunky as they were. Delivered art is simply allowed to be better.
 */
/**
 * The whole-number multiple. 6, not 3, because 3 was still short of the screen.
 *
 * At x3 the canvas is 1056 across. A phone held sideways shows the game across
 * 2080 device pixels, so the compositor was stretching that 1056 by 1.97x --
 * a fractional nearest-neighbour magnify, which is the exact defect the comment
 * above warns about, moved one step later in the pipeline where nothing in this
 * file could see it. x6 is 2112, past the phone, so the last step is a shrink
 * and the uneven grid is gone.
 */
const RENDER_SCALE = 6;
export const RENDER_W = VIEW_W * RENDER_SCALE;   // 2112
export const RENDER_H = VIEW_H * RENDER_SCALE;   // 1188
export const ZOOM = RENDER_W / VIEW_W;

/**
 * The factor a delivered PNG is authored at.
 *
 * **Not the same number as `ZOOM`, though it was for a long time.** ZOOM is how
 * many device pixels the game spends on a world unit; ART_SCALE is how many
 * pixels the art *has* per world unit. They were one constant because they
 * happened to both be 3, and the moment the render multiple moved to reach the
 * screen, every place that used ZOOM to read a delivered file's natural size
 * would have halved it — a 93px sprite for a 30-unit figure reads as 30 units
 * against ART_SCALE 3 and as 15 against 6, and the whole cast would have drawn
 * at half height with nothing failing.
 *
 * So: raising ZOOM is free and costs the art nothing; the delivered 3× set is
 * simply doubled by the camera, at a whole-number factor, which nearest
 * neighbour handles exactly. Raising this is what needs new files, and it is
 * what makes them 1:1 — a sprite the asset list calls 34 × 30 world units then
 * arrives on a 34 × ART_SCALE grid and nothing is resampled at all.
 */
export const ART_SCALE = 3;

/**
 * The delivery scales this engine can read, largest first.
 *
 * A two-way guess -- "is this file at world size or at ART_SCALE?" -- was
 * enough while only two existed, and it is why raising ART_SCALE was a trap:
 * with candidates {1, 1/3} a file at 3x reads correctly and one at 6x does not,
 * and with {1, 1/6} it is the other way round. The delivered set is mixed
 * already (the aisle props are at 1x, the side-view seat rows at 3x), and a
 * re-export lands one folder at a time, so the answer cannot be a single
 * number that every file has to agree with at once.
 */
const DELIVERY_SCALES = [8, 6, 4, 3, 2, 1];

/**
 * Work out how much to shrink a delivered texture, from the texture itself.
 *
 * `texH` is the frame height in pixels, `wantH` the height in world units the
 * game expects. The right scale is whichever candidate puts the sprite closest
 * to that, which is a fact about the file rather than about the brief -- so a
 * folder re-exported at 6x drops in beside one still at 1x and both draw at the
 * same size.
 *
 * Returns 1 for anything that matches nothing, which is the coded-placeholder
 * case: it has no natural size and should fill the box it was given.
 */
export function fitScale(texH: number, wantH: number): number {
    if (!(texH > 0) || !(wantH > 0)) return 1;
    let best = 1, bestErr = Infinity;
    for (const n of DELIVERY_SCALES) {
        const err = Math.abs(texH / n - wantH);
        if (err < bestErr - 1e-9) { bestErr = err; best = 1 / n; }
    }
    return best;
}

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
export const PLATE_SHRINK = 1.35;

/**
 * Where the background cabin's own floor sits, in world units.
 *
 * The cabin is scenery the player runs *past*, not a room they are inside. It
 * is one row of seats and windows occupying a band above head height, and
 * everything that can be touched — the player, the mooks, the crates, the
 * livestock, the food — happens on the aisle in front of it, between here and
 * `FLOOR_Y`.
 *
 * That separation is what makes the whole thing legible. A player standing
 * among the drawn seats has to be the same scale as them, which forces the art
 * and the gameplay into one plane and makes every obstacle ambiguous: is that
 * crate scenery or can I trip over it? A player running in front of the cabin
 * has only one rule to learn — if it is on the aisle, it is real.
 */
export const CABIN_BASE = 128;



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
export const FIGURE_SCALE = 1;

/** The aisle carpet — every character's feet line, and the arcade world floor. */
export const FLOOR_Y = 164;

/** The strip the game is actually played on: aisle floor, in world units. */
export const AISLE_DEPTH = FLOOR_Y - CABIN_BASE;
/** Feet line for a mook wedged into an open overhead bin. */
export const BIN_FEET = 58;
/** Distance between seat rows / windows / bin doors. One parallax tile. */
export const SEAT_PITCH = 44;

/**
 * The delivered side-view seat modules, in no particular order.
 *
 * Six variants of the same object: upright, reclined, trays down, stuffed seat
 * pockets, bags, floor junk. They are scenery and not platforms -- the row you
 * stand on is a 28-unit cushion plus a 12-unit back at `TIER.seat` and
 * `TIER.seatback`, and this is what the cabin looks like behind it.
 *
 * Listed here rather than globbed so that an id typo is a compile error instead
 * of a silently missing seat. The ids have to match the filenames exactly; the
 * same pair drifted once before and cost this game a whole texture (see the
 * note on `seat-row` in `platforms.ts`).
 */
export const SEAT_SIDE_ROWS = [
    'seat-side-row-upright',
    'seat-side-row-reclined',
    'seat-side-row-trays',
    'seat-side-row-pockets',
    'seat-side-row-bags',
    'seat-side-row-floor-junk',
] as const;

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
