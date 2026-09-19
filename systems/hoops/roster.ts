/**
 * Who you are actually playing against.
 *
 * The four players on the blacktop were palette swaps of one body. Same top
 * speed, same vertical, same dunk range, same shooting touch — the only
 * difference between them was the colour of the vest. And the opponent's skill
 * rating, which `systems/opponents.ts` has carried all along (Grandma Laces
 * 0.80, Scalper Sid 0.70, Yasser Abbasfat 0.30), was computed, threaded through
 * the venue screen and the mini-game host, and then dropped on the floor: the
 * component never destructured it. Every challenge in the game played
 * identically.
 *
 * That is the single biggest thing between this and an arcade basketball game
 * you remember. NBA Jam's roster mattered because a 9-dunk 3-speed bruiser
 * played nothing like a 9-three-point 4-dunk shooter, and you could feel which
 * one you had picked within about four seconds.
 *
 * So: seven attributes, each 0..1 with 0.5 meaning "an ordinary person", and a
 * profile per named NPC. The rules for these numbers:
 *
 *   1. **Every attribute must be felt, not read.** If turning `range` up does
 *      not visibly change how somebody plays, it is a stat block, not a
 *      character. Each one is wired to something the player can see happening.
 *   2. **Nobody is good at everything.** A profile's attributes should sum to
 *      roughly the same budget, so a 0.8 somewhere is paid for by a 0.3
 *      elsewhere. The `skill` rating sets the budget; the archetype spends it.
 *   3. **The extremes are the point.** A shooter who genuinely cannot dunk is
 *      more interesting than four people who are all a bit above average.
 */

/** Each 0..1. 0.5 is unremarkable; 0.9 is the best on any blacktop. */
export interface Attributes {
    /** Top running speed, and how much turbo adds on top. */
    speed: number;
    /** Vertical leap — contest height, rebound reach, hang time. */
    jump: number;
    /** Dunk range, and how willing they are to go up rather than pull up. */
    dunk: number;
    /** Shooting touch from distance. Drives the three-point game. */
    range: number;
    /** Ball security: resistance to steals, shoves and pass interception. */
    handles: number;
    /** Block and steal success on defence. */
    defense: number;
    /** Turbo capacity and how fast it comes back. */
    stamina: number;
}

export interface HoopsProfile {
    /** Must be a real id from the NPC roster, or 'generic'. */
    npcId: string;
    name: string;
    attributes: Attributes;
    /** One line on how they play. Shown before tip-off. */
    style: string;
    /**
     * The one thing they do that nobody else does, as a short label — the
     * announcer and the pre-game card both use it.
     */
    signature: string;
}

/** A body with no opinions. Every profile is a deviation from this. */
export const BASELINE: Attributes = {
    speed: 0.5, jump: 0.5, dunk: 0.5, range: 0.5,
    handles: 0.5, defense: 0.5, stamina: 0.5,
};

/** The total any profile is allowed to spend, before the skill adjustment. */
export const ATTRIBUTE_BUDGET = 3.5;

/**
 * A profile for an NPC. Falls back to a competent nobody built from the raw
 * skill rating, so an unknown id still plays sensibly rather than throwing.
 */
export function profileFor(npcId: string | undefined, skill = 0.5): HoopsProfile {
    const known = npcId ? ROSTER[npcId] : undefined;
    if (known) return known;
    return {
        npcId: npcId ?? 'generic',
        name: 'Some Guy',
        attributes: spread(skill),
        style: 'Plays like somebody who plays a lot.',
        signature: 'Nothing special',
    };
}

/**
 * Turns a single skill rating into a flat attribute set. Used for unnamed
 * opponents and as the starting point when authoring a profile.
 */
export function spread(skill: number): Attributes {
    const v = 0.25 + Math.max(0, Math.min(1, skill)) * 0.5;
    return { speed: v, jump: v, dunk: v, range: v, handles: v, defense: v, stamina: v };
}

/** Sums an attribute set, for the budget check the tests enforce. */
export const total = (a: Attributes): number =>
    a.speed + a.jump + a.dunk + a.range + a.handles + a.defense + a.stamina;

/**
 * The named roster. Filled in against the real NPC ids in
 * `systems/opponents.ts` — every key here must be one of them.
 *
 * Two extra keys, `player` and `big-mike`, are not opponents — they are the
 * human and their AI teammate — but they get the same treatment for the same
 * reason: a 2-on-2 game has four bodies on the floor, and only two of them
 * come from `opponents.ts`.
 *
 * Every total below is checked against a budget that scales with `skill`
 * (`1.75 + skill * 3.5` — the same line `spread()` traces, just spent
 * unevenly instead of flatly): a 0.80 skill NPC gets roughly 4.3-4.6 to work
 * with, a 0.30 skill NPC gets roughly 2.6-2.9. Nobody spends it evenly.
 */
export const ROSTER: Record<string, HoopsProfile> = {
    /**
     * Grandma Laces — skill 0.80, the best player on any blacktop, and she
     * proves it without leaving the ground. Two hands, underhand, from
     * between the knees — the Rick Barry granny shot — and it goes in from
     * anywhere. `jump` and `dunk` are as low as they get on this roster: she
     * is not a lob threat and never will be. `handles` and `defense` are
     * just as extreme the other way — decades of reading exactly this game
     * mean the ball does not come loose against her and neither does yours.
     */
    'grandma-laces': {
        npcId: 'grandma-laces',
        name: 'Grandma Laces',
        attributes: {
            speed: 0.40, jump: 0.10, dunk: 0.03, range: 0.97,
            handles: 0.95, defense: 0.95, stamina: 0.90,
        },
        style: 'Never runs, never jumps, never comes off the floor — reads your feet before you move them and buries it anyway.',
        signature: 'The Granny Shot',
    },

    /**
     * Scalper Sid — skill 0.70. A con artist's game: he never plays it
     * straight, so `defense` is close to absent, but `range` and `handles`
     * are both near the top of the roster — the deep bomb is "making it
     * interesting" and the crossover is the same misdirection he sells maps
     * with.
     */
    'scalper-sid': {
        npcId: 'scalper-sid',
        name: 'Scalper Sid',
        attributes: {
            speed: 0.65, jump: 0.45, dunk: 0.20, range: 0.95,
            handles: 0.95, defense: 0.25, stamina: 0.65,
        },
        style: 'Talks a slow game and shoots a fast one — the deep ball is the only honest thing about him.',
        signature: 'The Long Con',
    },

    /**
     * Gutter Gabe — skill 0.62. The shakedown artist: he takes the ball off
     * you the same way he takes your shoes, and `defense` shows it. `range`
     * is the worst on the roster after the two who genuinely cannot shoot —
     * he has never once needed a jumper to take your money.
     */
    'gutter-gabe': {
        npcId: 'gutter-gabe',
        name: 'Gutter Gabe',
        attributes: {
            speed: 0.45, jump: 0.55, dunk: 0.75, range: 0.15,
            handles: 0.40, defense: 0.85, stamina: 0.70,
        },
        style: 'Boxes you out with his whole personality, then takes the rim like it owes him money.',
        signature: 'The Shakedown',
    },

    /**
     * Bro Jogan — skill 0.55. All hype, all highlight: elite `jump` and
     * `dunk` for the clip, and almost nothing on `defense` or `stamina` once
     * the cameras have their footage. He is a two-minute burst of a player.
     */
    'bro-jogan': {
        npcId: 'bro-jogan',
        name: 'Bro Jogan',
        attributes: {
            speed: 0.55, jump: 0.80, dunk: 0.85, range: 0.35,
            handles: 0.55, defense: 0.15, stamina: 0.35,
        },
        style: 'All the hang time in the world for the first two minutes, then the ice bath talk turns out to have been a lie.',
        signature: 'The Elk Effect',
    },

    /**
     * ADC — skill 0.50. Cannot jump, cannot dunk, cannot shoot — `jump` and
     * `dunk` are the two lowest numbers she owns and `range` is not far
     * above them. What she has is `defense` and `stamina` near the top of
     * the entire roster: she gets in your face and she does not stop, ever,
     * for the whole game, the same way she does not stop outside the store.
     */
    adc: {
        npcId: 'adc',
        name: 'ADC',
        attributes: {
            speed: 0.45, jump: 0.15, dunk: 0.05, range: 0.25,
            handles: 0.60, defense: 0.90, stamina: 0.95,
        },
        style: "Can't jump, can't shoot, will not stop getting in your face for a single second of the game.",
        signature: 'The Clipboard Press',
    },

    /**
     * The Game — skill 0.45. Decent `speed` and `handles` get him all the
     * way to the rim; `range` is one of the worst on the roster, on purpose
     * — this is a player who can flat-out get there and flat-out cannot
     * shoot from anywhere else, and the brick mechanic should make sure
     * everyone watching knows it.
     */
    'the-game': {
        npcId: 'the-game',
        name: 'The Game',
        attributes: {
            speed: 0.65, jump: 0.50, dunk: 0.55, range: 0.12,
            handles: 0.65, defense: 0.20, stamina: 0.45,
        },
        style: 'Full speed to the rim every single time, because the jumper clangs off the iron more often than it goes anywhere near it.',
        signature: 'The Brick',
    },

    /**
     * The AM/PM Clerk — skill 0.45. Plays like his shift is ending in five
     * minutes, because to him it always is: quick `speed`, quick `handles`
     * off the register, no patience for a slow possession, and `defense`
     * that treats every play like a store rule nobody is allowed to break.
     */
    'clerk-israeli-af': {
        npcId: 'clerk-israeli-af',
        name: 'The AM/PM Clerk',
        attributes: {
            speed: 0.65, jump: 0.25, dunk: 0.15, range: 0.35,
            handles: 0.55, defense: 0.70, stamina: 0.75,
        },
        style: "Plays like his shift ends in five minutes — quick hands, quicker feet, zero patience for a slow game.",
        signature: 'Yalla, Fast Break',
    },

    /**
     * Wiz K — skill 0.38. Barely moves, barely defends — `defense` and
     * `stamina` are both near the bottom — and then from a standstill the
     * deep ball drops and even he looks surprised. `range` is the one
     * number on him that has no business being that high.
     */
    'wiz-k': {
        npcId: 'wiz-k',
        name: 'Wiz K',
        attributes: {
            speed: 0.35, jump: 0.65, dunk: 0.20, range: 0.85,
            handles: 0.40, defense: 0.15, stamina: 0.40,
        },
        style: 'Barely moves, barely defends, and then from nowhere the deep ball goes in and even he looks surprised.',
        signature: 'Somehow Wet',
    },

    /**
     * Yasser Abbasfat — skill 0.30. Chaos who cannot shoot: `range` is the
     * single worst number on the entire roster. Everything else runs hot —
     * `speed`, `dunk`, `stamina` — a player who is everywhere, finishes
     * recklessly when the chance appears, and turns the ball over doing it,
     * because `handles` is almost as bad as `range`.
     */
    'yasser-abbasfat': {
        npcId: 'yasser-abbasfat',
        name: 'Yasser Abbasfat',
        attributes: {
            speed: 0.60, jump: 0.50, dunk: 0.55, range: 0.05,
            handles: 0.15, defense: 0.45, stamina: 0.55,
        },
        style: 'Full go in every direction all game — he will dunk on you, foul you and lose the ball doing it, often in the same possession.',
        signature: 'Controlled Detonation',
    },

    /**
     * The human. Not an NPC, so not in `opponents.ts` — but a 2-on-2 game
     * has four bodies on the floor and this is one of them. A sneakerhead,
     * not an athlete: `handles` is the best thing about them (the ball does
     * not get taken any more easily than the shoebox does), `range` backs it
     * up, and `dunk` is the trade-off — they are not walking a lob home.
     */
    player: {
        npcId: 'player',
        name: 'You',
        attributes: {
            speed: 0.55, jump: 0.50, dunk: 0.25, range: 0.70,
            handles: 0.80, defense: 0.45, stamina: 0.55,
        },
        style: 'Treats the ball like a pair of grails — nobody is getting it back once it is yours.',
        signature: 'Iron Grip',
    },

    /**
     * Big Mike — your teammate, specified elsewhere as big, heavy, sets
     * screens, and does not run back on defense. Every one of those is a
     * number here: `dunk` is the highest on the entire roster because
     * finishing from three feet out is the whole job; `speed` is the
     * lowest, `range` is next to nothing, and `defense` is poor on purpose
     * — he is not the one getting back down the floor.
     */
    'big-mike': {
        npcId: 'big-mike',
        name: 'Big Mike',
        attributes: {
            speed: 0.12, jump: 0.48, dunk: 0.95, range: 0.05,
            handles: 0.28, defense: 0.30, stamina: 0.45,
        },
        style: 'Sets the pick, throws it down from three feet away, and ambles back on defense whenever he feels like it.',
        signature: 'Human Backboard',
    },
};

/* ------------------------------------------------------------------------- *
 * The partner
 * ------------------------------------------------------------------------- */

/**
 * The fourth body on the floor.
 *
 * A 2-on-2 game needs four players and the roster above only names three of
 * them — you, Big Mike, and whoever you challenged. The opponent's partner has
 * been 'HIS COUSIN' with a colour palette and nothing else since the game
 * shipped, which means half the other team played like the generic fallback no
 * matter who you were up against.
 *
 * Rather than author one cousin, derive him from the foe. Two reasons, and the
 * second is the real one:
 *
 *   1. A single fixed cousin would be the same player in all nine matchups, so
 *      four of the eight attributes on the floor would never change. The whole
 *      point of the roster is that a matchup feels different within seconds.
 *   2. Real pickup pairs cover for each other. The cousin of a shooter who
 *      cannot jump is the guy who gets the rebounds; the cousin of a rim
 *      attacker who cannot shoot is the one who spaces the floor. Inverting
 *      the foe's standout axes means beating a team requires beating a *pair*,
 *      and the hole you find in one of them is the hole the other one plugs.
 *
 * He is deliberately the weaker half — `PARTNER_BUDGET_SHARE` of the foe's
 * spend — because he is a sidekick, not a second boss. Pure function of the
 * foe, so the same challenge always produces the same cousin.
 */
const PARTNER_BUDGET_SHARE = 0.85;

/** How far the cousin leans away from the foe on each axis. 0 = clone. */
const PARTNER_INVERSION = 0.55;

export function partnerFor(foe: HoopsProfile): HoopsProfile {
    const a = foe.attributes;
    const mean = total(a) / 7;

    // Mirror each attribute about the foe's own average: whatever he is
    // unusually good at, the cousin is ordinary at, and vice versa.
    const mirror = (v: number): number => v + (mean - v) * 2 * PARTNER_INVERSION;

    const raw: Attributes = {
        speed: mirror(a.speed), jump: mirror(a.jump), dunk: mirror(a.dunk),
        range: mirror(a.range), handles: mirror(a.handles),
        defense: mirror(a.defense), stamina: mirror(a.stamina),
    };

    // Rescale to the sidekick's budget, then clamp. Clamping can only pull a
    // value down toward the legal range, so the result never exceeds budget.
    const want = total(a) * PARTNER_BUDGET_SHARE;
    const have = total(raw);
    const k = have > 0.001 ? want / have : 1;
    const attributes: Attributes = {
        speed: clamp01(raw.speed * k), jump: clamp01(raw.jump * k),
        dunk: clamp01(raw.dunk * k), range: clamp01(raw.range * k),
        handles: clamp01(raw.handles * k), defense: clamp01(raw.defense * k),
        stamina: clamp01(raw.stamina * k),
    };

    return {
        npcId: `${foe.npcId}-cousin`,
        name: 'His Cousin',
        attributes,
        style: `Covers whatever ${foe.name} doesn't, and not much else.`,
        signature: 'Family Obligation',
    };
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** You. Not an opponent, so it lives here rather than in `opponents.ts`. */
export const playerProfile = (): HoopsProfile => ROSTER.player;

/** Your team-mate. */
export const mateProfile = (): HoopsProfile => ROSTER['big-mike'];

/* ------------------------------------------------------------------------- *
 * Derived modifiers
 * ------------------------------------------------------------------------- */

/**
 * What an attribute set actually *does*.
 *
 * The attributes above are authoring units — 0..1, readable, arguable. The game
 * loop needs multipliers it can apply to the constants it already has, and the
 * translation between the two is the part that decides whether a roster is fun
 * or broken. Keeping it here, as one pure function, buys three things:
 *
 *   1. **Nobody is unplayable.** Every span below is bounded well away from
 *      zero. Big Mike's 0.12 speed is the lowest number on the roster and it
 *      still leaves him at `SPEED_SPAN`'s floor — slow enough that you feel it
 *      every time you wait for him, fast enough that he gets down the floor.
 *      A 2-on-2 game where one of the four is functionally absent is a 1-on-2
 *      game, and that is a bug with a stat block for a cause.
 *   2. **Nobody is unbeatable.** Grandma Laces spends 4.30 of a 4.55 budget on
 *      four near-maximum numbers, and the only reason that is not oppressive is
 *      that `defense` buys a *multiplier on a positional check*, never a free
 *      takeaway. She has to be in front of you, and 0.40 speed means she often
 *      is not. The spans keep the ceiling reachable; the game loop has to keep
 *      the check positional.
 *   3. **One place to tune.** Every span is a named constant. Balancing the
 *      roster means editing this block, not hunting multipliers through 2800
 *      lines of game loop.
 *
 * All spans are linear in the attribute and pass through 1.0 at 0.5, so an
 * unremarkable player is exactly the game's tuned baseline and every profile
 * reads as a deviation from it.
 */
export interface Modifiers {
    /** Multiplies top running speed. */
    speedMult: number;
    /** Multiplies how fast they reach that top speed. */
    accelMult: number;
    /** Multiplies jump velocity — contest height, rebound reach, hang time. */
    jumpMult: number;
    /** Multiplies dunk range, so a big can slam from where a guard cannot. */
    dunkRangeMult: number;
    /** 0..1. How much the AI prefers going up over pulling up. */
    dunkBias: number;
    /**
     * Multiplies make chance on every jump shot. This is shooting touch, and
     * it is the thing that used to be the player's thumb: the game had a
     * charge-and-release meter, the release quality off that meter was the
     * biggest single term in `shotChance`, and this modifier existed to widen
     * the meter's sweet spot. The meter is gone — NBA Jam never had one, shot
     * success there is distance, defenders and the shooter's own rating — so
     * the touch belongs to the shooter instead. Applied at every range;
     * `deepMult` stacks on top of it beyond the arc.
     */
    touchMult: number;
    /** Multiplies make chance on shots beyond the arc. The three-point game. */
    deepMult: number;
    /** Divides an opponent's chance of taking the ball off them. */
    stealResist: number;
    /** Multiplies their own steal chance. Applied *after* a positional check. */
    stealMult: number;
    /** Multiplies their own block chance. Also positional. */
    blockMult: number;
    /** Multiplies turbo capacity. */
    turboCapMult: number;
    /** Multiplies how fast turbo comes back. */
    turboRegenMult: number;
}

/**
 * Each span is [what a 0.0 gets, what a 1.0 gets]. Two rules, both enforced by
 * `tests/hoops-attributes.test.mts`:
 *
 *   - **Symmetric about 1.0.** A span is `[1 - d, 1 + d]`, so an attribute of
 *     0.5 lands exactly on the multiplier of 1.0 and an unremarkable player
 *     is the game's own tuned baseline rather than a slight deviation from it.
 *     Every constant the game loop already balances against stays meaningful.
 *   - **Floors well clear of zero.** The low half is the load-bearing one: it
 *     is what stops an extreme profile from being a player who cannot
 *     participate at all.
 */
const SPEED_SPAN: readonly [number, number] = [0.82, 1.18];
const ACCEL_SPAN: readonly [number, number] = [0.78, 1.22];
const JUMP_SPAN: readonly [number, number] = [0.80, 1.20];
/** Widest span on purpose: dunk range is the most visible attribute there is. */
const DUNK_RANGE_SPAN: readonly [number, number] = [0.58, 1.42];
/**
 * Narrower than DEEP on purpose. Touch applies to every shot, so the same
 * span would make a shooter better than a non-shooter everywhere by the same
 * margin they are better from three — which leaves nothing for the deep game
 * to be the marquee axis of.
 */
const TOUCH_SPAN: readonly [number, number] = [0.84, 1.16];
/** Deep shooting is the other marquee axis, so it swings nearly as hard. */
const DEEP_SPAN: readonly [number, number] = [0.55, 1.45];
const HANDLES_SPAN: readonly [number, number] = [0.60, 1.40];
const DEFENSE_SPAN: readonly [number, number] = [0.60, 1.40];
const STAMINA_CAP_SPAN: readonly [number, number] = [0.80, 1.20];
const STAMINA_REGEN_SPAN: readonly [number, number] = [0.72, 1.28];

/** Linear interpolation across a span, with the attribute clamped to 0..1. */
const across = (span: readonly [number, number], v: number): number =>
    span[0] + (span[1] - span[0]) * clamp01(v);

export function derive(a: Attributes): Modifiers {
    return {
        speedMult: across(SPEED_SPAN, a.speed),
        accelMult: across(ACCEL_SPAN, a.speed),
        jumpMult: across(JUMP_SPAN, a.jump),
        dunkRangeMult: across(DUNK_RANGE_SPAN, a.dunk),
        dunkBias: clamp01(a.dunk),
        touchMult: across(TOUCH_SPAN, a.range),
        deepMult: across(DEEP_SPAN, a.range),
        stealResist: across(HANDLES_SPAN, a.handles),
        stealMult: across(DEFENSE_SPAN, a.defense),
        blockMult: across(DEFENSE_SPAN, a.defense),
        turboCapMult: across(STAMINA_CAP_SPAN, a.stamina),
        turboRegenMult: across(STAMINA_REGEN_SPAN, a.stamina),
    };
}

/** The lowest and highest any modifier is allowed to reach. Tests enforce it. */
export const MODIFIER_FLOOR = 0.55;
export const MODIFIER_CEILING = 1.45;
