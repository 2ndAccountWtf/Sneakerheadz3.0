import React, { useCallback, useRef, useState } from 'react';
import { MiniGameResult } from './MiniGameShell';
import { useGame } from '../../hooks/useGame';
import {
    ArcadeShell,
    useInput,
    PAL,
    KIT,
    clear,
    rect,
    outline,
    circle,
    line,
    text,
    shadow,
    figure,
    shakeOffset,
    banner as drawBanner,
} from './engine';

/**
 * STREET DICE — a push-your-luck craps round in an alley, for in-game cash.
 *
 * There is no real money anywhere in this project and there never will be:
 * the stake is scaled off `player.cash`, the payout is in-game dollars, and
 * nothing here can be topped up. It is the same kind of wager as the blacktop
 * game.
 *
 * Why this is a game and not a coin flip
 * --------------------------------------
 * The dice themselves are just two dice. The decisions are the game:
 *
 *   PRESS  — you and he both double what is on the ground, so the pot doubles
 *            AND your own exposure doubles, AND the set of numbers that pays
 *            him widens by one more number. Three separate knives.
 *   PULL   — you take a shrinking share of the pot and walk. A small, certain
 *            profit, immediately, no roll — worth less the more you pressed.
 *   ROLL   — keep chasing the point at the current stake.
 *
 * Pressing is deliberately NEGATIVE expectation (see the odds table below).
 * Pulling out is the mathematically correct play every single time. The reason
 * you press anyway is the session structure: you have ROUNDS rounds to turn
 * your stack into TARGET_MULT times your stack, and grinding pull-outs at
 * +0.3 of a stake per round does not get you there. That is the whole game —
 * you know pressing is stupid, and you need it.
 *
 * Architecture notes (same shape as HoopsGame / StreetFighter):
 *  - The entire simulation is a plain object (`DiceWorld`) held in a ref and
 *    mutated inside the 60Hz frame callback. React state is ONLY the HUD
 *    mirror and the game-over flag, and those are written only when a
 *    *displayed* value changes. Re-rendering React 60x/sec stalls the frame.
 *  - `stepDice` touches nothing DOM-shaped and all randomness goes through a
 *    seeded RNG on the world, so the whole game runs headless in Node.
 *  - Every phase has a timeout, so a world with no input still terminates.
 */

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const VW = 280;
const VH = 160;

/** The chalk circle everything is thrown into. */
const RING_X = 138;
const RING_Y = 116;
const RING_RX = 74;
const RING_RY = 25;

/** Where the dice come to rest, and where they leave your hand from. */
const REST: [number, number][] = [
    [126, 110],
    [152, 115],
];
const HAND_X = 216;
const HAND_Y = 88;

const DIE_SIZE = 17;

/* ------------------------------------------------------------------ */
/* The odds model — written out so nothing here is a hidden fudge      */
/* ------------------------------------------------------------------ */

/** Ways to roll each total with two dice, out of 36. Index = total. */
const COMBOS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1] as const;

/**
 * Come-out roll:
 *   7 or 11      -> you win on the spot          8/36 = 22.2%
 *   2, 3 or 12   -> craps, he wins on the spot   4/36 = 11.1%
 *   anything else-> that total becomes the point 24/36 = 66.7%
 */
const NATURALS = [7, 11];
const CRAPS = [2, 3, 12];

/**
 * What pays him, by press level. Each press adds one more number to this list,
 * in descending order of how much it hurts. Counting the ways:
 *
 *   press 0: 7                 -> 6/36
 *   press 1: 7 11              -> 8/36
 *   press 2: 7 11 12           -> 9/36
 *   press 3: 7 11 12 3         -> 11/36
 *   press 4: 7 11 12 3 2       -> 12/36
 *
 * None of these can collide with a point, because a point is always one of
 * 4 5 6 8 9 10.
 */
const LOSER_LADDER: readonly number[][] = [
    [7],
    [7, 11],
    [7, 11, 12],
    [7, 11, 12, 3],
    [7, 11, 12, 3, 2],
];
const MAX_PRESS = LOSER_LADDER.length - 1;

export const loserSet = (press: number): readonly number[] =>
    LOSER_LADDER[Math.max(0, Math.min(MAX_PRESS, press))];

/** Ways out of 36 that pay him at this press level. */
export const loserWays = (press: number): number =>
    loserSet(press).reduce((s, n) => s + COMBOS[n], 0);

/**
 * Chance of making the point before he takes it, at a given press level.
 * Neutral rolls do not change the state, so this is just the conditional
 * race between the point's ways and his ways:
 *
 *              point 4/10   point 5/9   point 6/8
 *   press 0      33.3%        40.0%       45.5%
 *   press 1      27.3%        33.3%       38.5%
 *   press 2      25.0%        30.8%       35.7%
 *   press 3      21.4%        26.7%       31.3%
 *   press 4      20.0%        25.0%       29.4%
 *
 * The pot doubles per press (x1, x2, x4, x8, x16) but so does your own money
 * on the ground, so the net expectation of a press, in stakes, is
 * (2p - 1) * 2^press — which gets worse every time. Pressing buys variance,
 * not value. That is the joke and it is an honest one.
 */
export const pointOdds = (point: number, press: number): number => {
    const mine = COMBOS[point] ?? 0;
    if (!mine) return 0;
    return mine / (mine + loserWays(press));
};

/* ------------------------------------------------------------------ */
/* Balance constants                                                   */
/* ------------------------------------------------------------------ */

/** Rounds in a session. Each round is ~4 rolls, so this is a ~2 minute game. */
const ROUNDS = 10;
/** Clean him out and you are done early; this is the number you are chasing. */
const TARGET_MULT = 1.65;
/**
 * Pulling out pays this share of the pot, and the share shrinks the harder you
 * have pressed — he is not handing back 65% of a pot you just quadrupled.
 *
 *   press 0: 0.65 of the pot = +0.30 stakes, guaranteed
 *   press 1: 0.61                 +0.22
 *   press 2: 0.57                 +0.14
 *   press 3: 0.53                 +0.06
 *   press 4: 0.49                 -0.02
 *
 * So the safe play is to pull early and small. Pressing up and THEN bailing is
 * the worst of both worlds, which is what stops "press twice, cash out" from
 * being a rote solution to the whole game.
 */
const PULL_BASE = 0.65;
const PULL_DECAY = 0.04;
export const pullFraction = (press: number) =>
    PULL_BASE - PULL_DECAY * Math.max(0, Math.min(MAX_PRESS, press));

/**
 * Slapping a die is not free. He sees you do it and takes a cut of the pot for
 * the disrespect — so the steady hand saves the round but shrinks what the
 * round is worth. How big a cut is the ONLY thing player.focus changes:
 *
 *   focus   0 -> you keep 66% of the pot   (a shaky, obvious slap)
 *   focus  60 -> you keep 82%              (the default player)
 *   focus 100 -> you keep 92%              (coffee, gum, steady hands)
 *
 * Everyone gets exactly one slap per round, so focus never grants an action
 * nobody else has; it only makes the same action cost less. That keeps the
 * edge small, continuous, and printable in the HUD, which is where it is.
 */
const SLAP_TAX_MIN = 0.66;
const SLAP_TAX_MAX = 0.92;
export const slapTax = (focus: number) =>
    SLAP_TAX_MIN + (SLAP_TAX_MAX - SLAP_TAX_MIN) * Math.max(0, Math.min(100, focus)) / 100;

const ROLL_TIME = 0.92;      // dice in the air
const SETTLE_TIME = 0.66;    // they have landed; everyone leans in
const SAVE_WINDOW = 3.0;     // how long you get to slap a die
const DECIDE_TIME = 7.0;     // he gets impatient and the dice go anyway
const ROUND_END_TIME = 1.55;
const INTRO_TIME = 2.2;

/* ------------------------------------------------------------------ */
/* Mouth                                                               */
/* ------------------------------------------------------------------ */

const SAY = {
    open: [
        'Bones is bones. Put it on the ground.',
        'You roll like my aunt. Show me.',
        'Money on the floor or go home.',
    ],
    natural: [
        'Seven. SEVEN. Man got seven first try.',
        'Eleven?! Who taught you that.',
        'Beginner luck. That is all that was.',
    ],
    crapsOut: [
        'Craps. Pay the man. The man is me.',
        'Snake eyes. Poetic, honestly.',
        'Twelve. Twelve! Go home and think.',
    ],
    point: [
        'Point is set. Now we find out about you.',
        'That is your number. Good luck with it.',
        'Okay. Okay. Now do it again, tough guy.',
    ],
    neutral: [
        'Nothing. That was nothing. Roll.',
        'You are just warming the concrete.',
        'My grandmother rolls faster.',
        'Stop talking to the dice. They cannot hear you.',
    ],
    made: [
        'NO. No no no. Re-roll that.',
        'The floor is uneven. Everybody saw it.',
        'Fine. FINE. Take it.',
    ],
    sevenOut: [
        'SEVEN OUT. Thank you for your business.',
        'Seven. Like it was waiting for you.',
        'That is the sound of rent leaving.',
    ],
    pressYes: [
        'Ohhh, he is pressing. Somebody get a chair.',
        'Double it. Double it. Yes. Do that.',
        'Big man wants a big number. Wider net for me.',
    ],
    pressBroke: [
        'With what? You cannot press with vibes.',
        'Show me the paper first, champ.',
    ],
    pull: [
        'Pulling out. Of course. Of course you are.',
        'Take your little money. Take it.',
        'That is a coward number but it is a number.',
    ],
    save: [
        'AY! You SLAPPED it! That is not legal!',
        'He touched the die! Did everybody see that?',
        'That does not count. That absolutely counts, but it should not.',
    ],
    broke: [
        'Pockets out. Let me see. Yeah. Nothing.',
        'You are done. Go and get more paper.',
    ],
    cleaned: [
        'Take it. Take it and never come back here.',
        'You cleaned me. I hate this. Go.',
    ],
};

/* ------------------------------------------------------------------ */
/* World                                                               */
/* ------------------------------------------------------------------ */

type Phase = 'intro' | 'idle' | 'roll' | 'settle' | 'save' | 'decide' | 'roundEnd' | 'over';

interface Die {
    /** The face that will be showing once it stops. Decided when it leaves your hand. */
    value: number;
    /** Animation anchor — set per throw so the tumble is deterministic. */
    sx: number; sy: number;
    tx: number; ty: number;
    spin: number;
    /** 0..1 through the tumble; 1 = at rest. */
    p: number;
    /** A re-rolled die animates alone. */
    live: boolean;
}

export interface DiceWorld {
    seed: number;
    rngState: number;
    opponent: string;
    t: number;

    phase: Phase;
    phaseT: number;

    /* --- money. Every field is in in-game dollars and none may go negative --- */
    bank: number;
    startBank: number;
    target: number;
    ante: number;
    /** Your own money currently on the ground this round — what a loss costs. */
    stake: number;
    /** What a win pays. Starts at stake * 2 and is only ever shaved by a slap. */
    pot: number;

    round: number;
    press: number;
    /** 0 while the come-out is pending. */
    point: number;
    /** Rolls made since the point was set; you cannot pull before you have rolled. */
    pointRolls: number;
    /** One press per roll, so you cannot ladder to x16 without exposing yourself. */
    pressedThisWindow: boolean;

    dice: [Die, Die];
    total: number;
    /** Set during 'save' — the roll that is about to cost you the round. */
    doomed: boolean;
    /** Which die the save is pointed at. */
    saveDie: 0 | 1;
    /** Steady-hand re-rolls left this round. */
    saves: number;
    savesPerRound: number;
    /** Share of the pot that survives a slap, from player.focus. */
    slapKeep: number;

    shake: number;
    bannerText: string;
    bannerT: number;
    bannerColor: string;
    say: string;
    sayT: number;
    /** -1 sulking, 0 neutral, 1 gloating. Drives his posture. */
    mood: number;
    /** Last round's verdict, for the round-end card. */
    lastVerdict: 'win' | 'lose' | 'cash' | null;
    lastTake: number;

    result: 'win' | 'lose' | null;

    /** Diagnostics the headless run asserts on. */
    stats: {
        rolls: number;
        presses: number;
        pulls: number;
        roundWins: number;
        roundLosses: number;
        naturals: number;
        crapsOuts: number;
        sevenOuts: number;
        savesUsed: number;
        maxPress: number;
        minBank: number;
        /** Total collected from resolved wins (not pull-outs), for reward checks. */
        winTake: number;
        /** Total forfeited to him, for risk checks. */
        lostStake: number;
    };
}

export interface DiceCmd {
    left: boolean; right: boolean; up: boolean; down: boolean;
    a: boolean; b: boolean;
    aPress: boolean; bPress: boolean;
    leftPress: boolean; rightPress: boolean; downPress: boolean;
}

export const blankDiceCmd = (): DiceCmd => ({
    left: false, right: false, up: false, down: false,
    a: false, b: false, aPress: false, bPress: false,
    leftPress: false, rightPress: false, downPress: false,
});

/* ------------------------------------------------------------------ */
/* Utility                                                             */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** mulberry32 — small, fast, seedable. Determinism makes the sim testable. */
const rng = (w: DiceWorld) => {
    w.rngState = (w.rngState + 0x6d2b79f5) | 0;
    let t = w.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const d6 = (w: DiceWorld) => 1 + Math.floor(rng(w) * 6);
const pick = <T,>(w: DiceWorld, arr: readonly T[]): T => arr[Math.floor(rng(w) * arr.length) % arr.length];

const say = (w: DiceWorld, s: string) => { w.say = s; w.sayT = 3.2; };
const shout = (w: DiceWorld, s: string, color: string, hold = 1.3) => {
    w.bannerText = s; w.bannerT = hold; w.bannerColor = color;
};

/** One slap per round for everybody. Focus decides what it costs, not whether you get it. */
const SAVES_PER_ROUND = 1;

/** What pulling out pays right now. */
export const pullValue = (w: DiceWorld) => Math.round(w.pot * pullFraction(w.press));

/* ------------------------------------------------------------------ */
/* World construction                                                  */
/* ------------------------------------------------------------------ */

const mkDie = (i: number): Die => ({
    value: 1 + i,
    sx: REST[i][0], sy: REST[i][1],
    tx: REST[i][0], ty: REST[i][1],
    spin: 0, p: 1, live: false,
});

export interface DiceOpts {
    opponent?: string;
    /** Session stack, in in-game dollars. */
    bank?: number;
    /** Base wager per round. */
    ante?: number;
    focus?: number;
}

export const createDiceWorld = (seed: number, opts: DiceOpts = {}): DiceWorld => {
    const bank = Math.max(20, Math.round(opts.bank ?? 1000));
    // Ten antes in the stack: you can eat six flat losses before it gets silly,
    // and you can still afford to press twice early on.
    const ante = Math.max(5, Math.round((opts.ante ?? bank / 10) / 5) * 5);
    const w: DiceWorld = {
        seed,
        rngState: seed | 0,
        opponent: (opts.opponent || 'Dice').toUpperCase().slice(0, 12),
        t: 0,
        phase: 'intro',
        phaseT: 0,

        bank,
        startBank: bank,
        target: Math.round(bank * TARGET_MULT),
        ante,
        stake: 0,
        pot: 0,

        round: 0,
        press: 0,
        point: 0,
        pointRolls: 0,
        pressedThisWindow: false,

        dice: [mkDie(0), mkDie(1)],
        total: 0,
        doomed: false,
        saveDie: 0,
        saves: 0,
        savesPerRound: SAVES_PER_ROUND,
        slapKeep: slapTax(opts.focus ?? 60),

        shake: 0,
        bannerText: '',
        bannerT: 0,
        bannerColor: PAL.ink,
        say: '',
        sayT: 0,
        mood: 0,
        lastVerdict: null,
        lastTake: 0,

        result: null,

        stats: {
            rolls: 0, presses: 0, pulls: 0, roundWins: 0, roundLosses: 0,
            naturals: 0, crapsOuts: 0, sevenOuts: 0, savesUsed: 0,
            maxPress: 0, minBank: bank, winTake: 0, lostStake: 0,
        },
    };
    say(w, pick(w, SAY.open));
    return w;
};

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

const bankDelta = (w: DiceWorld, amount: number) => {
    // Single choke point so the stack can never go negative, whatever the
    // arithmetic upstream thinks it is doing.
    w.bank = Math.max(0, Math.round(w.bank + amount));
    if (w.bank < w.stats.minBank) w.stats.minBank = w.bank;
};

const startRound = (w: DiceWorld) => {
    w.round += 1;
    w.press = 0;
    w.point = 0;
    w.pointRolls = 0;
    w.pressedThisWindow = false;
    w.saves = w.savesPerRound;
    w.doomed = false;
    w.saveDie = 0;

    // You can always play, even if all that is left is pocket change.
    const wager = Math.min(w.ante, w.bank);
    bankDelta(w, -wager);
    w.stake = wager;
    w.pot = wager * 2;       // he matches whatever you put down
    w.phase = 'idle';
    w.phaseT = 0;
    w.lastVerdict = null;
};

/** Doubles the pot by doubling both stakes, and widens what pays him. */
const doPress = (w: DiceWorld) => {
    if (w.press >= MAX_PRESS || w.pressedThisWindow) return;
    const add = w.stake;                 // matching the raise doubles your exposure
    if (w.bank < add) {
        say(w, pick(w, SAY.pressBroke));
        return;
    }
    bankDelta(w, -add);
    w.stake += add;
    w.pot *= 2;
    w.press += 1;
    w.pressedThisWindow = true;
    w.stats.presses += 1;
    if (w.press > w.stats.maxPress) w.stats.maxPress = w.press;
    w.mood = 1;
    w.shake = Math.max(w.shake, 2.4);
    shout(w, `PRESS x${1 << w.press}`, PAL.warn, 1.0);
    say(w, pick(w, SAY.pressYes));
};

const endRound = (w: DiceWorld, verdict: 'win' | 'lose' | 'cash') => {
    w.lastVerdict = verdict;
    if (verdict === 'win') {
        w.lastTake = w.pot;
        bankDelta(w, w.pot);
        w.stats.roundWins += 1;
        w.stats.winTake += w.pot;
        w.mood = -1;
    } else if (verdict === 'cash') {
        const take = pullValue(w);
        w.lastTake = take;
        bankDelta(w, take);
        w.stats.pulls += 1;
        w.mood = -1;
    } else {
        w.lastTake = 0;
        w.stats.roundLosses += 1;
        w.stats.lostStake += w.stake;
        w.mood = 1;
    }
    // The pot is gone either way; nothing else may spend it.
    w.stake = 0;
    w.pot = 0;
    w.phase = 'roundEnd';
    w.phaseT = 0;
};

const finishGame = (w: DiceWorld, result: 'win' | 'lose') => {
    w.result = result;
    w.phase = 'over';
    w.phaseT = 0;
    if (result === 'win') {
        shout(w, 'CLEANED HIM OUT', PAL.ok, 4);
        say(w, pick(w, SAY.cleaned));
    } else {
        shout(w, w.bank <= 0 ? 'POCKETS OUT' : 'TIME, GENTLEMEN', PAL.bad, 4);
        say(w, pick(w, SAY.broke));
    }
};

/* ------------------------------------------------------------------ */
/* Rolling                                                            */
/* ------------------------------------------------------------------ */

/**
 * Throws the dice. Faces are decided here, before a single frame of animation,
 * so what happens in the alley is identical to what happens headless.
 * `only` re-throws a single die (the steady-hand slap).
 */
const throwDice = (w: DiceWorld, only: 0 | 1 | null = null) => {
    for (let i = 0; i < 2; i++) {
        const d = w.dice[i];
        d.live = only === null || only === i;
        if (!d.live) { d.p = 1; continue; }
        d.value = d6(w);
        d.sx = only === null ? HAND_X : d.tx;
        d.sy = only === null ? HAND_Y : d.ty - 2;
        d.tx = REST[i][0] + (rng(w) - 0.5) * 10;
        d.ty = REST[i][1] + (rng(w) - 0.5) * 6;
        d.spin = (2 + rng(w) * 4) * (rng(w) < 0.5 ? -1 : 1);
        d.p = 0;
    }
    w.stats.rolls += 1;
    w.phase = 'roll';
    w.phaseT = 0;
    w.shake = Math.max(w.shake, only === null ? 1.4 : 0.8);
};

/** Applies the roll that has just come to rest. */
const resolveRoll = (w: DiceWorld) => {
    const total = w.dice[0].value + w.dice[1].value;
    w.total = total;

    const lose = (label: string) => {
        // A losing roll is not final while you still have a slap in you.
        w.doomed = true;
        if (w.saves > 0) {
            w.phase = 'save';
            w.phaseT = 0;
            w.saveDie = w.dice[0].value >= w.dice[1].value ? 0 : 1;
            shout(w, label, PAL.bad, 1.0);
            return;
        }
        shout(w, label, PAL.bad, 1.4);
        w.shake = Math.max(w.shake, 5);
        endRound(w, 'lose');
    };

    if (w.point === 0) {
        /* --- come-out --- */
        if (NATURALS.includes(total)) {
            w.stats.naturals += 1;
            shout(w, total === 7 ? 'SEVEN — PAID' : 'ELEVEN — PAID', PAL.ok, 1.4);
            say(w, pick(w, SAY.natural));
            w.shake = Math.max(w.shake, 4);
            endRound(w, 'win');
            return;
        }
        if (CRAPS.includes(total)) {
            w.stats.crapsOuts += 1;
            say(w, pick(w, SAY.crapsOut));
            lose('CRAPS');
            return;
        }
        w.point = total;
        w.pointRolls = 0;
        w.pressedThisWindow = false;
        w.phase = 'decide';
        w.phaseT = 0;
        shout(w, `POINT ${total}`, PAL.accent, 1.1);
        say(w, pick(w, SAY.point));
        return;
    }

    /* --- point phase --- */
    w.pointRolls += 1;
    if (total === w.point) {
        shout(w, 'POINT MADE', PAL.ok, 1.5);
        say(w, pick(w, SAY.made));
        w.shake = Math.max(w.shake, 5.5);
        endRound(w, 'win');
        return;
    }
    if (loserSet(w.press).includes(total)) {
        if (total === 7) w.stats.sevenOuts += 1;
        say(w, pick(w, total === 7 ? SAY.sevenOut : SAY.crapsOut));
        lose(total === 7 ? 'SEVEN OUT' : `${total} — HIS NUMBER`);
        return;
    }
    // Nothing happened. The state is unchanged, which is exactly why the
    // conditional odds in pointOdds() are the right way to read this game.
    w.pressedThisWindow = false;
    w.phase = 'decide';
    w.phaseT = 0;
    say(w, pick(w, SAY.neutral));
};

/** Spends a steady-hand token to re-throw one die out of a losing roll. */
const useSave = (w: DiceWorld) => {
    if (w.saves <= 0) return;
    w.saves -= 1;
    w.stats.savesUsed += 1;
    w.doomed = false;
    // Your stake stays on the ground; only the payout gets shaved.
    w.pot = Math.max(1, Math.round(w.pot * w.slapKeep));
    say(w, pick(w, SAY.save));
    shout(w, 'SLAPPED IT', PAL.legend, 0.9);
    throwDice(w, w.saveDie);
};

/* ------------------------------------------------------------------ */
/* Step                                                                */
/* ------------------------------------------------------------------ */

export const stepDice = (w: DiceWorld, dt: number, cmd: DiceCmd) => {
    w.t += dt;
    w.phaseT += dt;
    if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 9);
    if (w.bannerT > 0) w.bannerT -= dt;
    if (w.sayT > 0) w.sayT -= dt;
    // He drifts back to neutral rather than gloating for the whole session.
    if (w.mood !== 0 && w.phase === 'decide') w.mood *= Math.max(0, 1 - dt * 1.2);

    switch (w.phase) {
        case 'intro':
            if (cmd.aPress || w.phaseT >= INTRO_TIME) startRound(w);
            break;

        case 'idle':
            // Come-out, or the next roll at the point.
            if (cmd.aPress || w.phaseT >= DECIDE_TIME) throwDice(w);
            break;

        case 'roll': {
            const p = clamp(w.phaseT / ROLL_TIME, 0, 1);
            for (const d of w.dice) if (d.live) d.p = p;
            if (p >= 1) { w.phase = 'settle'; w.phaseT = 0; }
            break;
        }

        case 'settle':
            if (w.phaseT >= SETTLE_TIME) resolveRoll(w);
            break;

        case 'save':
            if (cmd.leftPress) w.saveDie = 0;
            if (cmd.rightPress) w.saveDie = 1;
            if (cmd.bPress) { useSave(w); break; }
            // Let it stand — either you chose to, or you ran out of window.
            if (cmd.aPress || w.phaseT >= SAVE_WINDOW) {
                w.shake = Math.max(w.shake, 5);
                endRound(w, 'lose');
            }
            break;

        case 'decide': {
            const canPull = w.pointRolls >= 1;
            if (cmd.bPress) { doPress(w); break; }
            if (cmd.downPress && canPull) {
                say(w, pick(w, SAY.pull));
                shout(w, 'CASHED OUT', PAL.legend, 1.3);
                endRound(w, 'cash');
                break;
            }
            if (cmd.aPress || w.phaseT >= DECIDE_TIME) throwDice(w);
            break;
        }

        case 'roundEnd':
            if (w.phaseT >= ROUND_END_TIME) {
                if (w.bank >= w.target) finishGame(w, 'win');
                else if (w.bank <= 0) finishGame(w, 'lose');
                else if (w.round >= ROUNDS) finishGame(w, w.bank >= w.target ? 'win' : 'lose');
                else startRound(w);
            }
            break;

        case 'over':
        default:
            break;
    }
};

/* ------------------------------------------------------------------ */
/* Draw                                                               */
/* ------------------------------------------------------------------ */

/** Pip positions in a [-1, 1] square, per face. */
const PIPS: readonly [number, number][][] = [
    [],
    [[0, 0]],
    [[-0.45, -0.45], [0.45, 0.45]],
    [[-0.45, -0.45], [0, 0], [0.45, 0.45]],
    [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]],
    [[-0.45, -0.45], [0.45, -0.45], [0, 0], [-0.45, 0.45], [0.45, 0.45]],
    [[-0.45, -0.5], [0.45, -0.5], [-0.45, 0], [0.45, 0], [-0.45, 0.5], [0.45, 0.5]],
];

const chalkEllipse = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = PAL.white;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
};

/**
 * A die drawn as a rotating cube-ish block: a dark side face offset behind a
 * white top face, and the top face squashed on one axis as it turns. Real 3D
 * is not worth it at 17 pixels across.
 */
const drawDie = (
    ctx: CanvasRenderingContext2D, x: number, y: number, size: number,
    face: number, rot: number, lift: number, highlight: string | null,
) => {
    const s = size / 2;
    // Squash while tumbling so the block reads as turning over, not spinning flat.
    const squash = 0.72 + 0.28 * Math.abs(Math.cos(rot * 1.7));

    shadow(ctx, x, y + s + lift * 0.35 + 2, s * 1.15 * (1 - lift * 0.004), s * 0.4, 0.45);

    ctx.save();
    ctx.translate(x, y - lift);
    ctx.rotate(rot);
    ctx.scale(1, squash);

    // Side/edge block behind the face gives it thickness.
    rect(ctx, -s + 1.5, -s + 1.5, size, size, '#b9b3a6');
    rect(ctx, -s, -s, size, size, '#f4f1e8');
    outline(ctx, -s, -s, size, size, highlight ?? '#8d8779', 1);
    if (highlight) outline(ctx, -s - 1.5, -s - 1.5, size + 3, size + 3, highlight, 1);

    const f = clamp(Math.round(face), 1, 6);
    for (const [px, py] of PIPS[f]) {
        circle(ctx, px * s * 0.78, py * s * 0.78, Math.max(1.1, size * 0.095), '#16140f');
    }
    ctx.restore();
};

/** A stack of bills. Height is the pot; nobody is counting the individual notes. */
const drawPot = (ctx: CanvasRenderingContext2D, x: number, y: number, pot: number, ante: number) => {
    if (pot <= 0) return;
    const notes = clamp(Math.round(pot / Math.max(1, ante / 2)), 1, 14);
    for (let i = 0; i < notes; i++) {
        const off = ((i * 37) % 7) - 3;
        const by = y - i * 2.2;
        rect(ctx, x - 11 + off * 0.4, by, 22, 3, i % 2 ? '#2f7a4a' : '#3a8f58');
        rect(ctx, x - 11 + off * 0.4, by, 22, 1, 'rgba(255,255,255,0.18)');
    }
    text(ctx, `$${pot}`, x, y - notes * 2.2 - 8, { size: 7, color: PAL.ok, align: 'center', bold: true });
};

const drawAsphalt = (ctx: CanvasRenderingContext2D, w: DiceWorld) => {
    clear(ctx, VW, VH, '#0b0d10');
    // Wall behind them, with a sodium glow so the alley reads as night.
    rect(ctx, 0, 0, VW, 62, '#12151b');
    for (let x = 0; x < VW; x += 26) {
        line(ctx, x, 0, x, 62, 'rgba(0,0,0,0.35)', 1);
    }
    for (let y = 8; y < 62; y += 13) {
        line(ctx, 0, y, VW, y, 'rgba(0,0,0,0.28)', 1);
    }
    ctx.save();
    ctx.globalAlpha = 0.1;
    circle(ctx, 232, 4, 46, PAL.warn);
    ctx.restore();

    rect(ctx, 0, 62, VW, VH - 62, '#15171b');
    line(ctx, 0, 62, VW, 62, '#22262d', 1);
    // Speckle. Deterministic from position so the ground does not crawl.
    for (let i = 0; i < 130; i++) {
        const sx = (i * 73) % VW;
        const sy = 64 + ((i * 149) % (VH - 66));
        rect(ctx, sx, sy, 1, 1, i % 3 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.3)');
    }

    chalkEllipse(ctx, RING_X, RING_Y, RING_RX, RING_RY, 0.34);
    chalkEllipse(ctx, RING_X, RING_Y, RING_RX - 5, RING_RY - 3, 0.14);

    // Chalk bookkeeping, scrawled on the concrete where everyone can check it.
    const losers = loserSet(w.press).join(' ');
    ctx.save();
    ctx.globalAlpha = 0.5;
    text(ctx, `HIS: ${losers}`, 8, 132, { size: 7, color: PAL.white });
    if (w.point) {
        text(ctx, `YOURS: ${w.point}`, 8, 141, { size: 7, color: PAL.white });
        text(ctx, `${Math.round(pointOdds(w.point, w.press) * 100)}%`, 8, 150, { size: 7, color: PAL.white });
    } else {
        text(ctx, 'COME OUT', 8, 141, { size: 7, color: PAL.white });
    }
    ctx.restore();
};

const drawCast = (ctx: CanvasRenderingContext2D, w: DiceWorld) => {
    // Him, crouched over the circle, hands on knees, mouth running.
    const bob = Math.sin(w.t * 2.1) * 0.8 + (w.mood > 0.2 ? Math.sin(w.t * 9) * 1.2 : 0);
    figure(ctx, 52, 118 + bob, 46, {
        kit: KIT.rival,
        facing: 1,
        crouch: w.mood <= 0.2,
        armUp: w.mood > 0.2 ? 0.8 : 0.15,
    });
    // You, crouched opposite, dice hand out.
    figure(ctx, 232, 124, 44, {
        kit: KIT.player,
        facing: -1,
        crouch: true,
        armUp: w.phase === 'roll' ? 0.9 : 0.25,
    });

    if (w.sayT > 0) {
        const a = clamp(w.sayT / 0.7, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        rect(ctx, 4, 18, VW - 8, 12, 'rgba(4,6,10,0.82)');
        outline(ctx, 4, 18, VW - 8, 12, PAL.line);
        text(ctx, `"${w.say}"`, VW / 2, 24, { size: 7, color: PAL.accent2, align: 'center', baseline: 'middle' });
        ctx.restore();
    }
};

const PROMPTS: Record<Phase, (w: DiceWorld) => string> = {
    intro: () => 'A — SHAKE THEM UP',
    idle: w => (w.point ? 'A — ROLL FOR THE POINT' : 'A — COME OUT'),
    roll: () => '',
    settle: () => '',
    save: w => `◀ ▶ PICK DIE   B — SLAP IT (${w.saves})   A — LET IT STAND`,
    decide: w => {
        const bits = ['A — ROLL'];
        if (w.press < MAX_PRESS && !w.pressedThisWindow) bits.push(`B — PRESS $${w.stake}`);
        if (w.pointRolls >= 1) bits.push(`▼ — TAKE $${pullValue(w)}`);
        return bits.join('   ');
    },
    roundEnd: () => '',
    over: () => '',
};

export const drawDice = (ctx: CanvasRenderingContext2D, w: DiceWorld) => {
    ctx.save();
    const [sx, sy] = shakeOffset(w.shake);
    ctx.translate(sx, sy);

    drawAsphalt(ctx, w);
    drawCast(ctx, w);
    drawPot(ctx, 196, 145, w.pot, w.ante);   // clear of the prompt strip

    /* --- dice --- */
    for (let i = 0; i < 2; i++) {
        const d = w.dice[i];
        const p = d.p;
        const x = d.sx + (d.tx - d.sx) * p;
        const y = d.sy + (d.ty - d.sy) * p;
        // Two hops: a big throw arc, then a small bounce off the concrete.
        const lift = p < 0.62
            ? Math.sin((p / 0.62) * Math.PI) * 30
            : Math.sin(((p - 0.62) / 0.38) * Math.PI) * 7;
        // Faces blur past while it is in the air; the decided face lands.
        const face = p >= 1 ? d.value : 1 + (Math.floor(w.t * 34 + i * 3) % 6);
        const rot = p >= 1 ? 0 : d.spin * p * (2 - p);
        const hot = w.phase === 'save' && w.saveDie === i ? PAL.legend : null;
        drawDie(ctx, x, y, DIE_SIZE, face, rot, lift, hot);
    }

    if ((w.phase === 'settle' || w.phase === 'decide' || w.phase === 'save') && w.total > 0) {
        text(ctx, String(w.total), RING_X, 92, {
            size: 11, color: w.doomed ? PAL.bad : PAL.ink, align: 'center', bold: true,
        });
    }

    /* --- top strip: the only numbers that matter --- */
    rect(ctx, 0, 0, VW, 13, 'rgba(4,6,10,0.8)');
    text(ctx, `BANK $${w.bank}`, 5, 3, { size: 8, color: w.bank > w.startBank ? PAL.ok : PAL.ink, bold: true });
    text(ctx, `NEED $${w.target}`, VW / 2, 3, { size: 8, color: PAL.warn, align: 'center' });
    text(ctx, `R${Math.max(1, w.round)}/${ROUNDS}`, VW - 5, 3, { size: 8, color: PAL.dim, align: 'right' });

    // Pressed-up multiplier, loud, because it is the thing that will kill you.
    if (w.press > 0) {
        text(ctx, `PRESSED x${1 << w.press}`, VW - 5, 16, { size: 7, color: PAL.warn, align: 'right', bold: true });
    }
    if (w.saves > 0) {
        text(ctx, `✊ ${w.saves} — KEEP ${Math.round(w.slapKeep * 100)}%`, VW - 5, w.press > 0 ? 25 : 16,
            { size: 7, color: PAL.legend, align: 'right' });
    }

    /* --- prompt --- */
    const prompt = PROMPTS[w.phase](w);
    if (prompt) {
        rect(ctx, 0, VH - 11, VW, 11, 'rgba(4,6,10,0.78)');
        text(ctx, prompt, VW / 2, VH - 6, { size: 7, color: PAL.accent, align: 'center', baseline: 'middle' });
    }

    /* --- round card --- */
    if (w.phase === 'roundEnd' && w.lastVerdict) {
        const good = w.lastVerdict !== 'lose';
        text(ctx,
            w.lastVerdict === 'lose' ? 'HE TAKES IT ALL' : `YOU TAKE $${w.lastTake}`,
            VW / 2, 98, { size: 8, color: good ? PAL.ok : PAL.bad, align: 'center', bold: true });
    }

    if (w.bannerT > 0) {
        const size = w.phase === 'over' ? 20 : 15 + Math.sin(w.t * 20) * 1.5;
        drawBanner(ctx, w.bannerText, VW, 72, w.bannerColor, size);
    }
    if (w.phase === 'intro') {
        drawBanner(ctx, 'STREET DICE', VW, 46, PAL.accent, 18);
        text(ctx, `$${w.ante} a throw — get to $${w.target} in ${ROUNDS}`, VW / 2, 60, {
            size: 7, color: PAL.dim, align: 'center',
        });
    }

    ctx.restore();
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const DiceGame: React.FC<{
    opponent?: string;
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ opponent = 'Fat Tony', onFinish, onQuit }) => {
    const { gameState } = useGame();
    const { player } = gameState;

    const [done, setDone] = useState<null | boolean>(null);
    const { input, set, consume } = useInput(done === null);

    // The whole simulation lives here. React never sees it.
    const worldRef = useRef<DiceWorld | null>(null);
    if (!worldRef.current) {
        // Stakes scale off what you are actually carrying, and are in-game
        // dollars only — there is nothing to buy and nothing to top up.
        const bank = clamp(Math.round(player.cash * 0.3), 100, 3000);
        worldRef.current = createDiceWorld((Date.now() ^ 0x51ed270b) | 0, {
            opponent,
            bank,
            focus: player.focus,
        });
    }

    // HUD mirror: written only when a *displayed* value changes, so React
    // renders a few dozen times a session instead of 7,200.
    const hudRef = useRef({ bank: worldRef.current.bank, round: 1, press: 0, saves: 0, pot: 0 });
    const [hud, setHud] = useState(hudRef.current);
    const doneRef = useRef(false);
    const finishedRef = useRef(false);

    const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
        const w = worldRef.current!;
        if (!doneRef.current) {
            const s = input.current;
            stepDice(w, dt, {
                left: s.left, right: s.right, up: s.up, down: s.down,
                a: s.a, b: s.b,
                aPress: consume('a'), bPress: consume('b'),
                leftPress: consume('left'), rightPress: consume('right'),
                downPress: consume('down'),
            });
        }
        drawDice(ctx, w);

        const h = hudRef.current;
        if (h.bank !== w.bank || h.round !== w.round || h.press !== w.press
            || h.saves !== w.saves || h.pot !== w.pot) {
            hudRef.current = { bank: w.bank, round: Math.max(1, w.round), press: w.press, saves: w.saves, pot: w.pot };
            setHud(hudRef.current);
        }
        if (w.result && !doneRef.current) {
            doneRef.current = true;
            setDone(w.result === 'win');
        }
    }, [input, consume]);

    // onFinish must fire exactly once no matter how many times the card is hit.
    const finish = () => {
        if (finishedRef.current || done === null) return;
        finishedRef.current = true;
        const w = worldRef.current!;
        const profit = w.bank - w.startBank;
        onFinish(
            done,
            done
                ? `You cleaned ${opponent} out on the concrete — $${w.startBank} up to $${w.bank}.`
                : `${opponent} took you for $${Math.abs(profit)} in the alley.`,
        );
    };

    const w = worldRef.current;
    // Stated, not hidden: this is the entire mechanical effect of focus here.
    const slapPct = Math.round(w.slapKeep * 100);

    return (
        <ArcadeShell
            title="Street Dice"
            subtitle={`${opponent} — $${w.ante} a throw, in-game cash`}
            width={VW}
            height={VH}
            running={done === null}
            onFrame={onFrame}
            onInput={set}
            actions={['ROLL', 'PRESS']}
            vertical
            onQuit={done === null ? onQuit : undefined}
            quitLabel="Walk Away"
            hud={
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="chip">
                        BANK <b className="numeric text-[var(--accent)] ml-1">${hud.bank}</b>
                    </span>
                    <span className="label flex items-center gap-1">
                        <span className="numeric">R{hud.round}/{ROUNDS}</span>
                        {hud.pot > 0 && <span className="text-[var(--ok)]">POT ${hud.pot}</span>}
                        {hud.press > 0 && <span className="text-[var(--warn)]">x{1 << hud.press}</span>}
                    </span>
                    <span
                        className="chip"
                        title={`Steady hand (focus ${Math.round(player.focus)}) — re-throw one die out of a losing roll; he takes a cut and you keep ${slapPct}% of the pot`}
                    >
                        ✊ <b className="numeric text-[var(--legend)] ml-1">{hud.saves}</b>
                        <span className="opacity-60 ml-1">{slapPct}%</span>
                    </span>
                </div>
            }
            overlay={
                done === null ? undefined : (
                    <MiniGameResult
                        won={done}
                        headline={done ? `Cleaned Him Out — $${hud.bank}` : 'Pockets Out'}
                        detail={
                            done
                                ? `${opponent} checks the concrete twice, says the ground was sloped, and does not offer a rematch.`
                                : `${opponent} counts it in front of you, slowly, and asks if you want to go again tomorrow.`
                        }
                        onClose={finish}
                        closeLabel={done ? 'Collect' : 'Walk Off'}
                    />
                )
            }
            help={
                `Get from $${w.startBank} to $${w.target} in ${ROUNDS} rounds. A rolls. Seven or eleven on the come-out pays; 2, 3 or 12 loses; anything else is your point, and you roll again to hit it before he hits his number. `
                + 'B PRESSES: you both double up, so the pot doubles, your own money on the ground doubles, and one more number starts paying him (7, then 11, then 12, then 3, then 2). Pressing is a bad bet on purpose — you take it because grinding will not get you to the number in time. '
                + '▼ PULLS OUT once you have rolled at the point: take a cut of the pot and keep your legs — 65% of it if you never pressed, less every time you did. '
                + `Steady hand: on a losing roll you get one slap per round — ◀ ▶ pick a die, B re-throws just that one. He sees you do it and takes a cut: with focus ${Math.round(player.focus)} you keep ${slapPct}% of the pot (66% at focus 0, 92% at focus 100). That is the only thing focus changes in here.`
            }
        />
    );
};

export default DiceGame;
