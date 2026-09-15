/**
 * The cast, and the fact that none of them are taking this seriously.
 *
 * The rule the whole file is checked against: **every enemy needs a behaviour
 * that is funny on its own, not a reskin.** Three mooks with different hit
 * points is one enemy with three health bars. So each of the six below owns one
 * beat nobody else has, and — this is the part that matters — **the beat is a
 * real state with a real duration, not a flag on the sprite.**
 *
 * A Scalper who photographs a legendary drop *while still shooting at you* is a
 * decoration. A Scalper who genuinely stops, for two and a half seconds, during
 * which you are safe and he is useless, is a mechanic: the drop you were racing
 * him for is also the thing that takes him out of the fight. Same for the
 * Hypebeast eating a storefront, the Security guard narrating into his radio,
 * and the Shop Owner straightening a shelf mid-gunfight. If you can delete the
 * timer and the fight plays the same, the joke was never load-bearing.
 *
 * The Reseller is the odd one and the best one: his threat is *economic*. He
 * does not attack, he cannot kill you, and if you ignore him for eight seconds
 * your loot is gone for real. Shoot him and he drops the bag. That is the whole
 * enemy, and it is the only one in the game you lose something to by winning
 * the fight too slowly.
 *
 * Phaser-free on purpose, exactly like `spawners.ts` and `background.ts`: these
 * are pure step functions over plain data, so a node test can run an enemy for
 * ten simulated minutes and prove it never wedges. The scene owns pixels,
 * bodies and sound; this file owns *when* and *why*. Anything that needs
 * randomness takes `rng` last and defaults to `Math.random`.
 */

import type { DropKind } from './props';

export type CastKind =
    | 'scalper'      // runs at you, throws boxes, and is a sucker for a good pair
    | 'hypebeast'    // no weapon, just shoulder, and no brakes
    | 'reseller'     // does not want to fight you, wants your loot
    | 'security'     // has a radio and an enormous sense of occasion
    | 'shopOwner'    // furious about the merchandise, incidentally about you
    | 'falafelGuy';  // not on anybody's side. Do not knock over his counter.

export interface CastDef {
    kind: CastKind;
    hp: number;
    /** Pixels per second on the ground. */
    speed: number;
    /** Damage dealt by walking into the player. */
    contact: number;
    /** How close the player has to be before it commits to an attack. */
    range: number;
    /** Seconds between attacks. */
    cooldown: number;
    /** What it leaves behind. */
    drop: DropKind;
    /**
     * Will it ever attack the player at all? Two of them will not, for
     * different reasons: the Reseller is busy robbing you, and the Falafel Guy
     * is at work.
     */
    hostile: boolean;
    /** Is it a legitimate target? Only the Falafel Guy is not. */
    enemy: boolean;
}

/**
 * The Reseller is the fastest thing in the level, which is deliberate: a thief
 * you can casually outrun is just a slow enemy, and the panic of watching him
 * leave with your drop is the entire mechanic.
 */
export const CAST: Record<CastKind, CastDef> = {
    scalper: { kind: 'scalper', hp: 26, speed: 62, contact: 6, range: 110, cooldown: 1.6, drop: 'ammo', hostile: true, enemy: true },
    hypebeast: { kind: 'hypebeast', hp: 40, speed: 96, contact: 14, range: 86, cooldown: 2.2, drop: 'health', hostile: true, enemy: true },
    reseller: { kind: 'reseller', hp: 18, speed: 112, contact: 0, range: 0, cooldown: 0, drop: 'speed', hostile: false, enemy: true },
    security: { kind: 'security', hp: 46, speed: 54, contact: 9, range: 96, cooldown: 1.9, drop: 'ammo', hostile: true, enemy: true },
    shopOwner: { kind: 'shopOwner', hp: 34, speed: 40, contact: 8, range: 132, cooldown: 1.4, drop: 'health', hostile: true, enemy: true },
    falafelGuy: { kind: 'falafelGuy', hp: 24, speed: 0, contact: 0, range: 0, cooldown: 0, drop: 'health', hostile: false, enemy: false },
};

// ---------------------------------------------------------------------------
// Voice. Same register as YASSER_RANTS and MOOK_BARKS in content.ts: all caps,
// total confidence, no self-awareness anywhere.
// ---------------------------------------------------------------------------
export const SCALPER_BARKS = [
    'I HAVE FOUR PAIRS IN MY SIZE AND NONE IN YOURS!',
    'THIS IS RETAIL, BROTHER! RETAIL!',
    'THE RAFFLE WAS RIGGED AND I RIGGED IT!',
];
/** Said while holding up a phone, having forgotten the gunfight entirely. */
export const SCALPER_PHOTO_BARKS = [
    'HOLD ON. HOLD ON. THAT IS A SAMPLE PAIR.',
    'ONE SECOND, BROTHER, THE LIGHT IS PERFECT!',
    'NOBODY MOVE, I AM POSTING THIS!',
];
export const HYPEBEAST_BARKS = [
    'I DO NOT NEED A WEAPON! I AM WEARING THE WEAPON!',
    'THESE ARE DEADSTOCK AND SO AM I!',
    'MOVE! MOVE! I CANNOT TURN!',
];
/** Said face-down in a storefront, with total dignity. */
export const HYPEBEAST_STUN_BARKS = [
    'THE STORE MOVED! THE STORE MOVED, BROTHER!',
    'THAT WALL WAS NOT THERE WHEN I STARTED RUNNING!',
    'I AM FINE. THE GLASS IS NOT FINE.',
];
export const RESELLER_BARKS = [
    'YEAH BRO I GOT THREE PAIRS. NO, HE DID NOT SEE ME.',
    'I AM NOT WITH THEM! I AM SELF-EMPLOYED!',
    'THAT IS NOT STEALING, THAT IS SOURCING!',
];
/** What he says on his way out with your drop, which you will hear once. */
export const RESELLER_STEAL_BARKS = [
    'LISTED! ALREADY LISTED! GOODBYE!',
    'THANK YOU FOR YOUR BUSINESS, BROTHER!',
    'I WILL SELL THEM BACK TO YOU AT A FAIR MARKUP!',
];
/**
 * Narrated with enormous gravity into a walkie-talkie, to a partner who has
 * never once replied. The comedy is that none of these lines mention the actual
 * livestock walking past him — see `donkey` in `CastCtx`.
 */
export const SECURITY_RADIO_LINES = [
    'CONTROL, WE HAVE A SITUATION. I REPEAT: A SITUATION.',
    'BE ADVISED, THERE IS RUNNING IN THE CORRIDOR.',
    'I AM GOING TO NEED THE OTHER GOLF CART.',
    'CONTROL, DEFINE "REASONABLE FORCE". OVER.',
    'THE FOOD COURT IS SECURE. THE FOOD COURT IS SECURE.',
];
export const OWNER_BARKS = [
    'NOT THE DISPLAY!',
    "THAT'S IMPORTED!",
    'YOU BREAK IT, YOU BUY IT!',
    'THIS IS A BUSINESS, NOT A WAR!',
    'I HAVE A LEASE! A LEASE!',
];
/** Said while facing away from an active firefight, squaring up a shelf. */
export const OWNER_TIDY_BARKS = [
    'ONE MOMENT. THIS WAS STRAIGHT THIS MORNING.',
    'SIZE ORDER. THERE IS A SIZE ORDER.',
    'SOMEBODY TOUCHED THE MANNEQUIN.',
];
export const FALAFEL_BARKS = [
    'MY COUNTER! MY BEAUTIFUL COUNTER!',
    'THAT WAS TWO KILOS OF HUMMUS, BROTHER!',
    'I AM NOT INVOLVED! I AM CATERING!',
];

/** What the Angry Shop Owner throws, in order, because a wave should be readable. */
export type StockItem = 'shoebox' | 'mannequin' | 'display' | 'basket';
export const STOCK: StockItem[] = ['shoebox', 'mannequin', 'display', 'basket'];

// ---------------------------------------------------------------------------
// Beat durations. These are the jokes; they are numbers so they can be tested.
// ---------------------------------------------------------------------------
/** Seconds the Scalper spends photographing, during which he is not a threat. */
export const SCALPER_PHOTO = 2.4;
/** ...and how long before the same pair can distract him again. He got the shot
 *  already. Without this he re-photographs forever and never fights anybody. */
export const SCALPER_REFRACTORY = 7;
export const SCALPER_GRAB = 0.5;
/** ...and how long before he will stoop again. Same reasoning as the photo
 *  refractory above, for the same failure: a player who stands on a pile of
 *  loot was otherwise facing an enemy who had stopped being one. The greed is
 *  the character; being permanently harmless is not. */
export const SCALPER_GREED = 3.5;

export const HYPE_WIND = 0.45;   // the telegraph — you are supposed to dodge this
export const HYPE_CHARGE = 1.1;  // committed, no steering
export const HYPE_STUN = 2.6;    // face-down in a storefront
/** A stunned Hypebeast takes double. Missing has to cost him, or the charge is free. */
export const STUN_DAMAGE_MULT = 2;
/** How close counts as a body-check connecting. */
export const CONTACT_RANGE = 16;

export const RESELLER_BAG = 0.6;
/** Ignore him this long while he is holding something and it is gone. */
export const RESELLER_ESCAPE = 8;
export const RESELLER_FLEE = 1.4;

export const SECURITY_RADIO_EVERY = 6;
export const SECURITY_RADIO = 1.8;

export const OWNER_TIDY_EVERY = 7;
export const OWNER_TIDY = 2;
/** How long after tidying before disturbed merchandise can stop him again.
 *  `ctx.messy` is set by the scene and a firefight in a shop keeps it set, so
 *  without this the shelf wins permanently and he never throws anything. He
 *  gets to care about the shelf; he does not get to leave the fight. */
export const OWNER_TIDY_REFRACTORY = 5;

export const FALAFEL_SPILL = 1.2;    // the counter going over, food airborne
export const FALAFEL_RECOVER = 3;    // picking it all up, muttering

/** How close loot has to be before anybody bothers bending down. */
export const GRAB_RANGE = 20;

// ---------------------------------------------------------------------------
// What the scene is told
// ---------------------------------------------------------------------------
/**
 * Everything a behaviour is allowed to know. Plain numbers and booleans only —
 * no sprites, no bodies, no scene. If a machine needs something that is not
 * here, it goes here rather than the machine reaching for the world.
 */
export interface CastCtx {
    /** Distance to the player in px, unsigned. */
    dist: number;
    /** Which way the player lies: -1 left, 1 right, 0 on top of you. */
    toPlayer?: -1 | 0 | 1;
    /** Loot lying on the floor nearby. */
    loot?: number;
    /** Distance to the nearest piece of it. */
    lootDist?: number;
    /** A legendary pair just hit the floor in view. The Scalper's whole bit. */
    legendary?: boolean;
    /** Took damage since the last step. */
    hurt?: boolean;
    /** Something crashed into this actor's stand or counter this frame. */
    bumped?: boolean;
    /** Merchandise is visibly out of place. */
    messy?: boolean;
    /**
     * A donkey is walking past. Nothing in this file reads it, deliberately:
     * the scene may pass it every frame and the Mall Security guard will keep
     * reading his radio script over the top of it. The moment he acknowledges
     * the donkey, the joke is a cutscene instead of a character.
     */
    donkey?: boolean;
}

/** What a step tells the scene to do this frame. Never more than one thing. */
export type CastAction =
    | { type: 'attack'; damage: number }
    | { type: 'charge' }
    | { type: 'throw'; item: StockItem; bark: string }
    | { type: 'grab' }
    | { type: 'photograph'; bark: string }
    | { type: 'radio'; line: string }
    | { type: 'tidy'; bark: string }
    | { type: 'stunned'; bark: string }
    | { type: 'bag'; held: number }
    | { type: 'steal'; taken: number; bark: string }
    | { type: 'drop'; freed: number }
    | { type: 'spill'; bark: string }
    | null;

/** Same shape as `stepSpawner`'s `{ state, spawn }`, one field renamed. */
export interface CastStep<S> {
    state: S;
    action: CastAction;
}

const pick = (list: readonly string[], rng: () => number): string =>
    list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** Jitter, so six of the same enemy do not act in unison. */
const jitter = (base: number, rng: () => number): number => base * (0.75 + rng() * 0.5);

// ---------------------------------------------------------------------------
// Scalper — the one who cannot help himself
// ---------------------------------------------------------------------------
export type ScalperPhase = 'approach' | 'photo' | 'grab';

export interface ScalperState {
    kind: 'scalper';
    phase: ScalperPhase;
    /** Seconds left in the current beat. */
    timer: number;
    /** Seconds until he may throw again. */
    cooldown: number;
    /** Seconds during which a legendary no longer distracts him. */
    refractory: number;
    /** Seconds during which loot on the floor no longer does either. */
    greed: number;
    /** How many shots he has taken. Pure trivia, and good for a stat screen. */
    photos: number;
}

export const openScalper = (rng: () => number = Math.random): ScalperState => ({
    kind: 'scalper', phase: 'approach', timer: 0,
    cooldown: jitter(CAST.scalper.cooldown, rng), refractory: 0, greed: 0, photos: 0,
});

/**
 * The photograph beat outranks everything, including being shot at, because
 * that is the joke: the drop is more important to him than the gunfight. He
 * leaves the beat with a full cooldown, so there is a further beat of him
 * remembering what he was doing before anything comes at you.
 */
export function stepScalper(
    state: ScalperState, dt: number, ctx: CastCtx, rng: () => number = Math.random,
): CastStep<ScalperState> {
    const next = {
        ...state,
        refractory: Math.max(0, state.refractory - dt),
        greed: Math.max(0, state.greed - dt),
    };

    if (state.phase === 'photo') {
        const timer = state.timer - dt;
        if (timer > 0) return { state: { ...next, timer }, action: null };
        return { state: { ...next, phase: 'approach', timer: 0, cooldown: CAST.scalper.cooldown }, action: null };
    }

    if (state.phase === 'grab') {
        const timer = state.timer - dt;
        if (timer > 0) return { state: { ...next, timer }, action: null };
        return {
            state: { ...next, phase: 'approach', timer: 0, greed: SCALPER_GREED },
            action: { type: 'grab' },
        };
    }

    if (ctx.legendary && next.refractory <= 0) {
        return {
            state: { ...next, phase: 'photo', timer: SCALPER_PHOTO, refractory: SCALPER_REFRACTORY, photos: state.photos + 1 },
            action: { type: 'photograph', bark: pick(SCALPER_PHOTO_BARKS, rng) },
        };
    }

    const cooldown = next.cooldown - dt;
    if ((ctx.loot ?? 0) > 0 && (ctx.lootDist ?? Infinity) <= GRAB_RANGE && next.greed <= 0) {
        return { state: { ...next, phase: 'grab', timer: SCALPER_GRAB, cooldown }, action: null };
    }
    if (ctx.dist <= CAST.scalper.range && cooldown <= 0) {
        return {
            state: { ...next, cooldown: jitter(CAST.scalper.cooldown, rng) },
            action: { type: 'throw', item: 'shoebox', bark: pick(SCALPER_BARKS, rng) },
        };
    }
    return { state: { ...next, cooldown }, action: null };
}

// ---------------------------------------------------------------------------
// Hypebeast — commitment as a character flaw
// ---------------------------------------------------------------------------
export type HypebeastPhase = 'stalk' | 'wind' | 'charge' | 'stunned';

export interface HypebeastState {
    kind: 'hypebeast';
    phase: HypebeastPhase;
    timer: number;
    cooldown: number;
    /** Storefronts entered head-first. */
    crashes: number;
}

export const openHypebeast = (rng: () => number = Math.random): HypebeastState => ({
    kind: 'hypebeast', phase: 'stalk', timer: 0, cooldown: jitter(CAST.hypebeast.cooldown, rng), crashes: 0,
});

/** A stunned Hypebeast is the reward for dodging, so he is worth double there. */
export const isVulnerable = (s: HypebeastState): boolean => s.phase === 'stunned';
export const incomingDamage = (s: HypebeastState, damage: number): number =>
    damage * (isVulnerable(s) ? STUN_DAMAGE_MULT : 1);

/**
 * Wind up, commit, and then live with it. There is no steering during the
 * charge — the whole enemy is "he cannot stop" — so a dodged body-check ends in
 * a storefront and `HYPE_STUN` seconds of him being a free target.
 */
export function stepHypebeast(
    state: HypebeastState, dt: number, ctx: CastCtx, rng: () => number = Math.random,
): CastStep<HypebeastState> {
    if (state.phase === 'stunned') {
        const timer = state.timer - dt;
        if (timer > 0) return { state: { ...state, timer }, action: null };
        return { state: { ...state, phase: 'stalk', timer: 0, cooldown: CAST.hypebeast.cooldown }, action: null };
    }

    if (state.phase === 'charge') {
        // Contact is checked first: connecting on the last frame still counts.
        if (ctx.dist <= CONTACT_RANGE) {
            return {
                state: { ...state, phase: 'stalk', timer: 0, cooldown: jitter(CAST.hypebeast.cooldown, rng) },
                action: { type: 'attack', damage: CAST.hypebeast.contact },
            };
        }
        const timer = state.timer - dt;
        if (timer > 0) return { state: { ...state, timer }, action: null };
        return {
            state: { ...state, phase: 'stunned', timer: HYPE_STUN, crashes: state.crashes + 1 },
            action: { type: 'stunned', bark: pick(HYPEBEAST_STUN_BARKS, rng) },
        };
    }

    if (state.phase === 'wind') {
        const timer = state.timer - dt;
        if (timer > 0) return { state: { ...state, timer }, action: null };
        return { state: { ...state, phase: 'charge', timer: HYPE_CHARGE }, action: { type: 'charge' } };
    }

    const cooldown = state.cooldown - dt;
    if (ctx.dist <= CAST.hypebeast.range && cooldown <= 0) {
        // The telegraph is not politeness, it is the dodge window.
        return { state: { ...state, phase: 'wind', timer: HYPE_WIND, cooldown }, action: null };
    }
    return { state: { ...state, cooldown }, action: null };
}

// ---------------------------------------------------------------------------
// Reseller — the only enemy who can actually take something off you
// ---------------------------------------------------------------------------
export type ResellerPhase = 'seek' | 'bag' | 'flee' | 'gone';

export interface ResellerState {
    kind: 'reseller';
    phase: ResellerPhase;
    timer: number;
    /** Pairs in the backpack. */
    held: number;
    /** Seconds of being ignored before he walks off with them. */
    escape: number;
}

export const openReseller = (): ResellerState => ({
    kind: 'reseller', phase: 'seek', timer: 0, held: 0, escape: RESELLER_ESCAPE,
});

/** Loot is gone the moment he reaches `gone`, and there is no getting it back. */
export const stolen = (s: ResellerState): boolean => s.phase === 'gone';

/**
 * The rule, stated once so the scene and the tests agree on it:
 *
 *  - he picks loot up off the floor into the backpack (`bag` → `held`);
 *  - while `held > 0` and nobody has touched him, `escape` runs down;
 *  - at zero he leaves and the loot is **gone** — a `steal` action, once,
 *    and he never acts again;
 *  - **any** damage before that makes him drop the whole bag and reset the
 *    clock, which is what makes shooting him worth the bullets.
 *
 * Eight seconds is long enough to notice and short enough to punish ignoring
 * him, which is the only tuning this enemy really has.
 */
export function stepReseller(
    state: ResellerState, dt: number, ctx: CastCtx, rng: () => number = Math.random,
): CastStep<ResellerState> {
    if (state.phase === 'gone') return { state, action: null };

    if (ctx.hurt) {
        // Everything on the floor again, and the clock back to full. Note this
        // beats the escape check below: shot on the same frame he would have
        // left means he does not leave.
        const freed = state.held;
        return {
            state: { ...state, phase: 'flee', timer: RESELLER_FLEE, held: 0, escape: RESELLER_ESCAPE },
            action: freed > 0 ? { type: 'drop', freed } : null,
        };
    }

    if (state.held > 0) {
        const escape = state.escape - dt;
        if (escape <= 0) {
            // `held` stays on the state deliberately: it is the record of what
            // he left with, which the results screen wants and the scene has no
            // other way to know once the actor is despawned.
            return {
                state: { ...state, phase: 'gone', timer: 0, escape: 0 },
                action: { type: 'steal', taken: state.held, bark: pick(RESELLER_STEAL_BARKS, rng) },
            };
        }
        state = { ...state, escape };
    }

    if (state.phase === 'flee') {
        const timer = state.timer - dt;
        if (timer > 0) return { state: { ...state, timer }, action: null };
        return { state: { ...state, phase: 'seek', timer: 0 }, action: null };
    }

    if (state.phase === 'bag') {
        const timer = state.timer - dt;
        if (timer > 0) return { state: { ...state, timer }, action: null };
        const held = state.held + 1;
        // The clock starts on the first pair, not on the last.
        const escape = state.held === 0 ? RESELLER_ESCAPE : state.escape;
        return { state: { ...state, phase: 'seek', timer: 0, held, escape }, action: { type: 'bag', held } };
    }

    if ((ctx.loot ?? 0) > 0 && (ctx.lootDist ?? Infinity) <= GRAB_RANGE) {
        return { state: { ...state, phase: 'bag', timer: RESELLER_BAG }, action: null };
    }
    return { state, action: null };
}

// ---------------------------------------------------------------------------
// Mall Security — a man on a radio, in a world he is not looking at
// ---------------------------------------------------------------------------
export type SecurityPhase = 'patrol' | 'radio';

export interface SecurityState {
    kind: 'security';
    phase: SecurityPhase;
    /** Seconds left in the transmission, or until the next one. */
    timer: number;
    cooldown: number;
    /** Index into the radio script, so he works through it rather than looping one line. */
    line: number;
}

export const openSecurity = (rng: () => number = Math.random): SecurityState => ({
    kind: 'security', phase: 'patrol', timer: jitter(SECURITY_RADIO_EVERY, rng),
    cooldown: jitter(CAST.security.cooldown, rng), line: Math.floor(rng() * SECURITY_RADIO_LINES.length),
});

/**
 * He radios on a timer whether or not anything is happening, and while he is
 * radioing he does not attack — the joke costs him real uptime, which is what
 * makes him the enemy you take your time on.
 *
 * `ctx.donkey` is never read anywhere below. That is not an oversight: he is
 * the man describing a "situation" to Control while a donkey goes past his
 * shoulder, and an animal he responded to would be a scripted gag instead of a
 * character trait.
 */
export function stepSecurity(
    state: SecurityState, dt: number, ctx: CastCtx, rng: () => number = Math.random,
): CastStep<SecurityState> {
    if (state.phase === 'radio') {
        const timer = state.timer - dt;
        if (timer > 0) return { state: { ...state, timer }, action: null };
        return { state: { ...state, phase: 'patrol', timer: jitter(SECURITY_RADIO_EVERY, rng) }, action: null };
    }

    const timer = state.timer - dt;
    if (timer <= 0) {
        const line = SECURITY_RADIO_LINES[state.line % SECURITY_RADIO_LINES.length];
        return {
            state: { ...state, phase: 'radio', timer: SECURITY_RADIO, line: state.line + 1 },
            action: { type: 'radio', line },
        };
    }

    const cooldown = state.cooldown - dt;
    if (ctx.dist <= CAST.security.range && cooldown <= 0) {
        return {
            state: { ...state, timer, cooldown: jitter(CAST.security.cooldown, rng) },
            action: { type: 'attack', damage: CAST.security.contact },
        };
    }
    return { state: { ...state, timer, cooldown }, action: null };
}

// ---------------------------------------------------------------------------
// Angry Shop Owner — the fight is an inconvenience, the shelf is the emergency
// ---------------------------------------------------------------------------
export type OwnerPhase = 'stock' | 'tidy';

export interface OwnerState {
    kind: 'shopOwner';
    phase: OwnerPhase;
    timer: number;
    cooldown: number;
    /** Items thrown, which is also the round-robin cursor into STOCK. */
    thrown: number;
    /** Seconds during which `ctx.messy` will not pull him off the fight again. */
    settled: number;
}

export const openOwner = (rng: () => number = Math.random): OwnerState => ({
    kind: 'shopOwner', phase: 'stock', timer: jitter(OWNER_TIDY_EVERY, rng),
    cooldown: jitter(CAST.shopOwner.cooldown, rng), thrown: 0, settled: 0,
});

/**
 * He throws his own stock at you in a fixed order — boxes, mannequin, display,
 * basket — because a readable wave is funnier than a random one: you learn that
 * the mannequin is coming, and it still lands.
 *
 * Then he stops, turns his back on an active firefight, and straightens a
 * shelf. Two full seconds of not attacking, triggered either by the timer or by
 * the scene telling him the merchandise is disturbed. A man who tidies *and*
 * keeps throwing is not the joke; the joke is that the shelf wins.
 */
export function stepOwner(
    state: OwnerState, dt: number, ctx: CastCtx, rng: () => number = Math.random,
): CastStep<OwnerState> {
    const next = { ...state, settled: Math.max(0, state.settled - dt) };

    if (state.phase === 'tidy') {
        const timer = state.timer - dt;
        if (timer > 0) return { state: { ...next, timer }, action: null };
        return {
            state: {
                ...next, phase: 'stock',
                timer: jitter(OWNER_TIDY_EVERY, rng),
                settled: OWNER_TIDY_REFRACTORY,
            },
            action: null,
        };
    }

    const timer = next.timer - dt;
    // His own timer always gets him eventually; the scene's `messy` flag only
    // does so once the refractory has run out.
    if (timer <= 0 || (ctx.messy && next.settled <= 0)) {
        return {
            state: { ...next, phase: 'tidy', timer: OWNER_TIDY },
            action: { type: 'tidy', bark: pick(OWNER_TIDY_BARKS, rng) },
        };
    }

    const cooldown = next.cooldown - dt;
    if (ctx.dist <= CAST.shopOwner.range && cooldown <= 0) {
        return {
            state: { ...next, timer, cooldown: jitter(CAST.shopOwner.cooldown, rng), thrown: next.thrown + 1 },
            action: { type: 'throw', item: STOCK[next.thrown % STOCK.length], bark: pick(OWNER_BARKS, rng) },
        };
    }
    return { state: { ...next, timer, cooldown }, action: null };
}

// ---------------------------------------------------------------------------
// Falafel Guy — not an enemy, and the code should make that impossible to break
// ---------------------------------------------------------------------------
export type FalafelGuyPhase = 'serve' | 'spill' | 'recover';

export interface FalafelGuyState {
    kind: 'falafelGuy';
    phase: FalafelGuyPhase;
    timer: number;
    /** Counters lost this run. */
    spills: number;
}

export const openFalafelGuy = (): FalafelGuyState => ({ kind: 'falafelGuy', phase: 'serve', timer: 0, spills: 0 });

/**
 * He has no attack, no cooldown and no opinion about the player. The only thing
 * that happens to him is *physics*: somebody is knocked into the stand, the
 * counter goes over, and food is airborne — a `spill` the scene turns into
 * hummus and bouncing falafel on the shared blast path, not an attack.
 *
 * A counter already on its side cannot go over again, so a second bump during
 * the clean-up does nothing. That is not fussiness: a stand that re-spills on
 * every contact becomes a food cannon the player farms, and then he is an
 * enemy after all.
 */
// Named for the man, not the food: `projectiles.ts` exports its own
// `stepFalafel` for the thing that bounces, and the scene imports both.
export function stepFalafelGuy(
    state: FalafelGuyState, dt: number, ctx: CastCtx, rng: () => number = Math.random,
): CastStep<FalafelGuyState> {
    if (state.phase === 'serve') {
        if (!ctx.bumped) return { state, action: null };
        return {
            state: { ...state, phase: 'spill', timer: FALAFEL_SPILL, spills: state.spills + 1 },
            action: { type: 'spill', bark: pick(FALAFEL_BARKS, rng) },
        };
    }

    const timer = state.timer - dt;
    if (timer > 0) return { state: { ...state, timer }, action: null };
    if (state.phase === 'spill') return { state: { ...state, phase: 'recover', timer: FALAFEL_RECOVER }, action: null };
    return { state: { ...state, phase: 'serve', timer: 0 }, action: null };
}

// ---------------------------------------------------------------------------
// One door in, for the scene and for tests that want to drive all six
// ---------------------------------------------------------------------------
export type CastState =
    | ScalperState | HypebeastState | ResellerState | SecurityState | OwnerState | FalafelGuyState;

export function openCast(kind: CastKind, rng: () => number = Math.random): CastState {
    switch (kind) {
        case 'scalper': return openScalper(rng);
        case 'hypebeast': return openHypebeast(rng);
        case 'reseller': return openReseller();
        case 'security': return openSecurity(rng);
        case 'shopOwner': return openOwner(rng);
        case 'falafelGuy': return openFalafelGuy();
    }
}

/** Dispatch, so the scene keeps one list and one loop. */
export function stepCast(
    state: CastState, dt: number, ctx: CastCtx, rng: () => number = Math.random,
): CastStep<CastState> {
    switch (state.kind) {
        case 'scalper': return stepScalper(state, dt, ctx, rng);
        case 'hypebeast': return stepHypebeast(state, dt, ctx, rng);
        case 'reseller': return stepReseller(state, dt, ctx, rng);
        case 'security': return stepSecurity(state, dt, ctx, rng);
        case 'shopOwner': return stepOwner(state, dt, ctx, rng);
        case 'falafelGuy': return stepFalafelGuy(state, dt, ctx, rng);
    }
}

/**
 * Is this actor in the middle of its comedy beat — and therefore harmless?
 * The scene uses it for the "he is not paying attention" pose; the tests use it
 * to prove the beats are real downtime rather than an animation over the top of
 * business as usual.
 */
export function distracted(state: CastState): boolean {
    switch (state.kind) {
        case 'scalper': return state.phase === 'photo' || state.phase === 'grab';
        case 'hypebeast': return state.phase === 'stunned';
        case 'reseller': return true;                     // never a threat to your health
        case 'security': return state.phase === 'radio';
        case 'shopOwner': return state.phase === 'tidy';
        case 'falafelGuy': return true;                   // he is at work
    }
}
