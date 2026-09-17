/**
 * Cart Race — "DOWNHILL (feat. nobody)"
 * =====================================
 * The Game has your box and he is escaping down a very long hill on a stolen
 * AM/PM shopping trolley. He is not good at this. He is yelling about a mixtape.
 *
 * The whole game is one number: the gap. Close it to zero and you get the box
 * back. Let it stretch out, run out of hill, or wipe out, and he's gone.
 *
 * The heart of the design is the longboard branch. `itm-longboard` is not a
 * hidden +10% stat — it swaps your entire rig:
 *
 *   with the board   : higher top speed, sharp steering, and you can ollie, so
 *                      most street furniture becomes a ramp instead of a wall.
 *   without it       : you grabbed the *other* trolley out of the bay. Slower,
 *                      steers like a fridge, cannot leave the ground. You have
 *                      to weave everything and lean on AM/PM weapons to win.
 *
 * Both are winnable. Only one is comfortable.
 *
 * Everything below the constants is a pure simulation (`createRaceState` +
 * `stepRace`) with no React and no canvas in it, so it can be driven headlessly
 * by a script. The component is a thin shell: refs in, pixels out.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ArcadeShell, useInput, PAL, KIT,
    clear, rect, outline, circle, line, text, glyph, shadow, bar, band,
    shakeOffset, banner, actor, art, anim, addBurst, stepBursts, lerpHex,
    ditherRamp, glow, withAlpha, viewWidth, castAt,
} from './engine';
import type { Ctx, Burst } from './engine';
import { MiniGameResult } from './MiniGameShell';
import { useGame } from '../../hooks/useGame';
import { armsFor, hasWeapon } from '../../systems/weapons';
import type { Weapon } from '../../systems/weapons';
import { bakeSprite, drawSprite, frameAt } from '../../systems/sprites/bake';
import { SPR_SHOE_BOX } from '../../data/sprites/sneakers';
import { spriteForItem } from '../../data/sprites/items';

// ---------------------------------------------------------------------------
// Geometry. 320x180 logical pixels, four lanes of asphalt, a 3/4 side view.
// ---------------------------------------------------------------------------
/**
 * The world the game was designed against, and the world it is drawing now.
 *
 * `DESIGN_W` is the shape every constant below was tuned for. `W` is what the
 * screen actually gave us this frame, and on a phone held sideways in
 * fullscreen that is wider -- a fixed 16:9 picture in an 844x390 viewport
 * spends eighteen per cent of the screen on black bars, and cropping to fill
 * instead would take the HUD off the top.
 *
 * Widening is safe here precisely because **nothing in the simulation reads
 * it**. Obstacles live in metres of hill, the gap is metres, the thief is
 * metres; `W` appears only in draw code, so a wider screen shows more road and
 * changes no outcome. That is load-bearing: the moment a spawn or a collision
 * consults it, the same seed stops meaning the same race on two phones.
 */
const DESIGN_W = 320;
let W: number = DESIGN_W;
const H = 180;
const LANES = 4;
const ROAD_TOP = 100;
const LANE_H = 18;
const LANE_Y0 = 114;
/**
 * Where the player sits along the screen, and how far that can shift.
 *
 * The rider used to be nailed to one x while the world slid past, which made
 * braking invisible: you could squeeze the brakes all the way down a hill and
 * the only evidence was a number. Left and right now mean slow down and drive
 * on, and the rider drifts back and forward between these two marks to show it
 * — so the control that changes your speed also changes the picture, and how
 * much road you can see ahead becomes the reward for committing.
 */
const PLAYER_X_BACK = 40;
const PLAYER_X_FWD = 96;
const PLAYER_X = 62;
/** How quickly the rider slides between those marks. Slow enough to read. */
const DRIFT_RATE = 46;
/** Near-field metres -> pixels, used to place obstacles on the road. */
const PX_PER_M = 5;
/** The gap is drawn on its own, much flatter scale — he's a long way off. */
const GAP_PX = 1.0;

const laneY = (lane: number) => LANE_Y0 + lane * LANE_H;
/** Lanes further up the screen are further away, so their contents are smaller. */
const laneScale = (lane: number) => 0.80 + lane * 0.07;

// ---------------------------------------------------------------------------
// Race tuning. These numbers were settled by running the headless sim, not by
// vibes — see the balance notes on RUBBER_K below.
// ---------------------------------------------------------------------------
const START_GAP = 100;      // metres of hill between you and him at the drop-in
const LOSE_GAP = 220;       // he's over the horizon; chase over
const HILL_LENGTH = 1900;   // the hill flattens out here. Out of hill = out of luck.

/** Constant downhill pull. You are always accelerating unless something stops you. */
const HILL_ACCEL = 9;
/** Tucking leans you into the slope as well as cutting drag. */
const TUCK_GAIN = 1.34;

/** His pace at the drop-in, before the band starts reacting to you. */
const THIEF_BASE = 30;
/**
 * Invulnerability granted by a crash. Also how long the rider spends stumbling,
 * so the trip animation and the window you cannot be hit in are the same thing
 * rather than two numbers that drift apart.
 */
const INV_TIME = 0.75;
/** How long the throw animation runs. Shorter than any weapon's cooldown. */
const THROW_TIME = 0.42;
/** How long the fall itself takes at the end of a wipeout, before the slide. */
const WIPE_FALL = 0.9;
/**
 * The rubber band. He paces *you* rather than holding an absolute speed —
 * a chase where he just drives off at a fixed speed isn't a game, it's a
 * cutscene. His target speed is your rolling average, shifted by how far ahead
 * he is: well clear, he relaxes and gloats; on your wheel, he panics.
 *
 * The two clamps are where the whole design lives:
 *   THIEF_MAX — a hard ceiling. His trolley physically will not go faster than
 *               this, and a Venice Longboard cruises *above* it. That single
 *               number is the longboard payoff: with the board you out-run the
 *               band outright, without it you never can and the gap only closes
 *               when he crashes or you land something on him.
 *   THIEF_MIN — a floor, so a disastrous run is still recoverable.
 */
/**
 * BALANCE FIX — read this before touching any of these four numbers again.
 *
 * The original tune (RUBBER_K 0.045, THIEF_ABS 30.9) was verified against a
 * scripted autopilot that reads every lane perfectly and never fat-fingers a
 * throw. That bot still only caught the trolley ~19-20% of the time — and a
 * real person, on a phone, thumb over the D-pad, plays worse than a script.
 * Against the old numbers that isn't "hard", it's "no-board is basically a
 * loss screen with extra steps", which fails the brief's own "hard but fair"
 * bar.
 *
 * The fix is not "make the trolley faster" — THIEF_MAX staying above the
 * trolley's tuck-top (34) is the entire point: the pure speed race is
 * supposed to be unwinnable without a board, so every no-board win still
 * comes from crashes, weapons, drafting or a clean weave, never from just
 * out-driving him. Three things move together:
 *   - RUBBER_K down (0.045 -> 0.0435): a touch less panic-acceleration per
 *     metre of gap closed, so a good stretch of driving isn't immediately
 *     clawed back the moment you're within range.
 *   - THIEF_ABS down (30.9 -> 30.65): his stubborn floor pace eases slightly
 *     toward the trolley's own cruise speed (29) instead of sitting well
 *     above it.
 *   - Drafting and near-misses (below) are new, real ways to claw back speed
 *     that didn't exist in the old tune at all.
 * These numbers are far more sensitive than they look — an early pass at
 * RUBBER_K 0.032 / THIEF_ABS 29.2 alone (nothing else changed) took the
 * trolley from ~19% to ~93%, because once his floor pace drops under what a
 * clean lap can sustain the gap just monotonically closes. The values above
 * are the walked-back result of re-running the sweep after every step.
 * Re-run the cartrace headless harness after touching any of these four
 * numbers — the longboard's win rate and speed edge must stay basically
 * untouched (it does: THIEF_MAX still caps him well under the board) while
 * the trolley's climbs into a real, still-losable fight. See the report for
 * the full before/after sweep.
 */
const RUBBER_K = 0.0435;
const THIEF_MAX = 38;
const THIEF_MIN = 17;
/**
 * How much of his target speed comes from pacing you versus just riding the
 * hill at his own stubborn pace. Pure pacing would make both rigs win at the
 * same gap and only differ in how long it took; pure absolute made the trolley
 * mathematically unable to finish. The blend is what leaves the board
 * comfortable and the trolley a real fight.
 */
const PACE_W = 0.55;
const THIEF_ABS = 30.65;

const SPAWN_AHEAD = 70;     // metres of street kept populated ahead of you
/** Thrown-weapon speeds are authored in px/s; scale them into gap-metres/s. */
const PROJ_SCALE = 0.4;

/**
 * DRAFTING — the second lever besides the tuck.
 *
 * Tuck trades steering for speed; drafting trades safety for speed. Get onto
 * his back wheel — close behind him, roughly his lane — and his wake pulls
 * you forward for free, on top of anything the tuck is already doing. It's
 * the "drafting behind The Game" mechanic from the brief, made literal: the
 * risk isn't abstract, it's that his lane is exactly where his own thrown
 * junk lands and where his next stagger-crash catches you too (see the
 * `panic` multiplier in stepThief). Good drivers ride the wake right up to
 * the point it gets dangerous; that's the decision.
 */
const DRAFT_ACCEL = 1.6;
/** Metres of gap where the slipstream can be felt at all. */
const DRAFT_REACH = 22;
/** Lanes of separation before the wake stops reaching you. */
const DRAFT_LANES = 1.7;

/**
 * NEAR-MISS — rewards reading the street tight instead of playing it safe.
 * A clean pass close enough that a slightly worse read would have hit the
 * thing is worth a small, real speed bump, and consecutive ones chain into a
 * combo. This is what turns "avoid the furniture" into "thread the
 * furniture" — see `nearMiss()` below for the exact window.
 */
const NEARMISS_LAT = 0.5;   // lane-widths of clearance that still counts as "close"
const NEARMISS_WINDOW = 2.6; // seconds a combo stays alive without a fresh near-miss

// ---------------------------------------------------------------------------
// Rigs — the longboard branch, made of whole numbers you can feel.
// ---------------------------------------------------------------------------
interface Rig {
    id: 'board' | 'trolley';
    label: string;
    glyph: string;
    /** Terminal velocity standing up, and tucked. Drag is derived from these. */
    cruise: number;
    tuckTop: number;
    /** Lanes crossed per second at full lock. */
    steer: number;
    /** m/s of speed scrubbed per second of steering — carving is your only brake. */
    carve: number;
    /** Speed at which the thing starts to shimmy and steer itself. */
    wobbleAt: number;
    canOllie: boolean;
    /** Speed added for a clean ramp landing. */
    rampBoost: number;
    /** Added to the fraction of speed kept through an impact. */
    hitKeep: number;
    /** Damage multiplier on impacts — a trolley folds, a deck pops back up. */
    hitDmg: number;
    /**
     * The trolley's one genuine advantage: it is a steel cage on wheels, so it
     * ploughs through bins, cones and dogs instead of stopping on them. It does
     * nothing against a parked car. This is what keeps the no-board run alive
     * when you cannot ollie anything.
     */
    plough: number;
    ploughDmg: number;
    note: string;
}

const BOARD: Rig = {
    id: 'board', label: 'Venice Longboard', glyph: '🛹',
    cruise: 34, tuckTop: 44, steer: 7.4, carve: 2.2, wobbleAt: 34,
    canOllie: true, rampBoost: 9, hitKeep: 0.12, hitDmg: 0.7, plough: 0, ploughDmg: 1,
    note: 'Board under your feet. You can actually catch him.',
};

const TROLLEY: Rig = {
    id: 'trolley', label: 'The Other Trolley', glyph: '🛒',
    cruise: 29, tuckTop: 34, steer: 3.1, carve: 4.6, wobbleAt: 28,
    canOllie: false, rampBoost: 1.6, hitKeep: -0.06, hitDmg: 1.15, plough: 0.3, ploughDmg: 0.45,
    note: 'No board. You took the other trolley. It steers like a fridge.',
};

// ---------------------------------------------------------------------------
// Street furniture. `clear` is what it takes to get over the thing:
//   'none'  — a wall. Weave or wear it.
//   'ollie' — a real ollie clears it. The trolley cannot.
//   'hop'   — low enough that even a panicked trolley hop clears it.
// ---------------------------------------------------------------------------
type ClearBy = 'none' | 'ollie' | 'hop';

interface ObsDef {
    kind: string;
    glyph: string;
    label: string;
    /** Half-length in metres along the hill, and half-width in lanes. */
    len: number;
    wide: number;
    clear: ClearBy;
    dmg: number;
    /** Fraction of speed kept on impact, before rig modifiers. */
    keep: number;
    weight: number;
    ramp?: boolean;
    oil?: boolean;
    /** Lanes per second of wandering (dogs, pedestrians). */
    drift?: number;
    /**
     * Belongs against a kerb rather than out in the running lanes.
     *
     * A parked car in the middle of a four-lane street is not an obstacle, it
     * is a mistake — and with cars, doors, bins and trolley bays all spawning
     * on a uniform lane roll, that is what the road looked like: everything
     * abandoned down the crown of it. Kerb things now take an outside lane, so
     * the two middle lanes are the racing line and the edges are where the
     * street furniture lives. That is how a real road reads, and it turns
     * "which lane" into a decision instead of a dice roll.
     */
    kerb?: boolean;
    /**
     * Metres per second along the hill. Positive is downhill, the way you are
     * going; negative is traffic coming up at you. Absent means it is street
     * furniture and does not move.
     *
     * Everything on this street used to be nailed down — the only car in the
     * table was a parked one, so a four-lane road through a city had no traffic
     * on it whatsoever, and a hill you are descending at 76mph was completely
     * still apart from you and one man on a BMX.
     */
    vz?: number;
    /**
     * Which side of the road it belongs on. 'kerb' is the outside lanes,
     * 'far' is the other carriageway (where oncoming traffic lives), 'inner'
     * is the running lanes. Absent means anywhere.
     */
    side?: 'kerb' | 'far' | 'inner';
}

const OBS: ObsDef[] = [
    { kind: 'car', glyph: '🚗', label: 'parked Camry', len: 3.2, wide: 0.6, clear: 'none', dmg: 14, keep: 0.55, weight: 10, kerb: true, side: 'kerb' },
    // Traffic. Slower than you, in the running lanes, so you overtake it —
    // which is a different problem from a parked car: it is still there when
    // you have committed to the lane beside it.
    { kind: 'traffic', glyph: '🚙', label: 'a slow Corolla', len: 3.2, wide: 0.6, clear: 'none', dmg: 14, keep: 0.55, weight: 15, vz: 12, side: 'inner' },
    // And traffic the other way, on the far carriageway. Closing at 44m/s
    // against a parked car's 34 it gives you 1.27 seconds of warning instead of
    // 1.65, which is the whole reason it is frightening.
    { kind: 'oncoming', glyph: '🚕', label: 'an oncoming taxi', len: 3.0, wide: 0.6, clear: 'none', dmg: 15, keep: 0.5, weight: 12, vz: -10, side: 'far' },
    { kind: 'door', glyph: '🚪', label: 'car door', len: 1.8, wide: 0.55, clear: 'none', dmg: 12, keep: 0.5, weight: 9, kerb: true },
    { kind: 'bay', glyph: '🛒', label: 'AM/PM trolley bay', len: 3.6, wide: 1.05, clear: 'none', dmg: 13, keep: 0.5, weight: 6, kerb: true },
    { kind: 'ped', glyph: '🚶', label: 'pedestrian', len: 1.4, wide: 0.5, clear: 'none', dmg: 9, keep: 0.62, weight: 9, drift: 0.35 },
    { kind: 'works', glyph: '🚧', label: 'roadworks', len: 2.0, wide: 0.55, clear: 'ollie', dmg: 8, keep: 0.66, weight: 14 },
    { kind: 'bin', glyph: '🗑️', label: 'wheelie bin', len: 1.6, wide: 0.5, clear: 'ollie', dmg: 6, keep: 0.72, weight: 13, kerb: true },
    { kind: 'dog', glyph: '🐕', label: 'loose dog', len: 1.4, wide: 0.5, clear: 'ollie', dmg: 7, keep: 0.7, weight: 10, drift: 0.9 },
    { kind: 'oil', glyph: '🛢️', label: 'oil slick', len: 3.0, wide: 0.7, clear: 'hop', dmg: 0, keep: 0.9, weight: 10, oil: true },
    { kind: 'ramp', glyph: '', label: 'plywood ramp', len: 2.2, wide: 0.6, clear: 'none', dmg: 0, keep: 1, weight: 12, ramp: true },
];
/** Whatever he grabs off his own trolley and lobs back at you. */
const JUNK: ObsDef = { kind: 'junk', glyph: '🥫', label: 'thrown garbage', len: 1.3, wide: 0.5, clear: 'ollie', dmg: 6, keep: 0.74, weight: 0 };

const OBS_TOTAL = OBS.reduce((n, o) => n + o.weight, 0);

/**
 * This game's obstacle kinds, in the shared street vocabulary.
 *
 * The two street games name the same objects differently — one calls it a
 * `bin`, the other a `bin` too but a `trolley` where this one says `bay` — so
 * the art is keyed on the asset id and each game maps its own kinds onto it.
 * That is what lets one delivered `bin-wheelie.png` serve both.
 */
const ART_ID: Record<string, string> = {
    bin: 'bin-wheelie', dog: 'dog-stray', ped: 'pedestrian', works: 'roadworks',
    oil: 'oil-slick', ramp: 'skate-ramp', car: 'car-sedan', door: 'car-door-open',
    bay: 'trolley-bay', junk: 'trash-pile',
};

/**
 * The two riders, drawn from delivered sheets when they exist.
 *
 * `RIDER_H` is rider-plus-vehicle, so it is taller than a standing adult: the
 * board adds a couple of pixels under the feet and the bike rather more. Both
 * are drawn from their own ground contact, which is the bottom of the wheels.
 */
const RIDER_H = 30;

/**
 * Which animation each rider wants, from state the game already tracks.
 *
 * Named rather than picked by frame so there is one notion of what a rider is
 * doing — the same discipline the Phaser scene uses. A sheet that has not been
 * delivered falls back through `art.sprite` to the coded figure, so a partial
 * delivery is a game with one drawn rider and one blocky one.
 */
/**
 * Which throw the rider is playing, from what is in his hand.
 *
 * A sandal goes overhand, a cup of frozen slush goes carefully, and anything
 * with mass is a two-handed heave. Same grouping the thief's reactions use, so
 * a weapon looks the same being thrown as it does landing.
 */
function throwState(id: string): string {
    if (id.includes('chancla') || id.includes('sandal')) return 'skateboard-throw-chancla';
    if (id.includes('slush') || id.includes('drink') || id.includes('soda')) return 'skateboard-throw-slushie';
    // The AM/PM food has its own throws now. A bureka is held and released
    // differently from a frozen drink, and differently again depending on which
    // bureka — the potato one is heavier and he winds up for it.
    if (id.includes('gvinah') || id.includes('cheese')) return 'skateboard-throw-bureka-gvinah';
    if (id.includes('bureka') || id.includes('potato')) return 'skateboard-throw-bureka-potato';
    if (id.includes('falafel')) return 'skateboard-throw-falafel';
    if (id.includes('hummus')) return 'skateboard-throw-hummus';
    return 'skateboard-throw-heavy';
}

export function boardState(s: RaceState): string {
    // A wipeout falls first and then slides: the fall sheet ends on the tarmac
    // and the roll keeps going for as long as the ending cinematic runs, rather
    // than the fall looping and standing you up to knock you down again.
    if (s.outcome === 'wipeout') {
        return s.wipe > WIPE_FALL ? 'skateboard-ground-roll' : 'skateboard-balance-fall';
    }
    // `crashT` is the *thief's* crash timer, not yours — reading it here put
    // your rider on the floor every time he binned it. Your own hit window is
    // the invulnerability the crash handler grants.
    if (s.invT > 0) {
        // A pedestrian is the only obstacle that is a person, and going through
        // one is its own animation — two bodies, both down. It is also the joke.
        if (s.hitBy === 'ped') return 'skateboard-ped-collide';
        // Anything light is a clip, not a crash: the board stays under you and
        // you ride it out. Without this a six-damage wheelie bin and a
        // fourteen-damage Camry played the same full wipeout and the damage
        // table might as well not have existed.
        if (s.hitLight) return 'skateboard-hit-stumble';
        // Two ways to go down, and the way you went down decides how you get
        // back up. Trip over a bin and you land face-first, so you push up off
        // the tarmac. Go into a parked car and you land on your back, so you
        // have to roll and burpee to your feet. Four sheets, one crash window,
        // and no pose that contradicts the one before it.
        if (s.invT < INV_TIME * 0.34) {
            return s.hitKind === 'wall'
                ? 'skateboard-burpee-to-stand'
                : 'skateboard-pushup-recover';
        }
        return s.hitKind === 'wall'
            ? 'skateboard-front-collision-backward'
            : 'skateboard-obstacle-trip-forward';
    }
    // Real air off a ramp gets a kickflip; a hop over a bin does not. This is
    // the only place the game shows off, and it should be the place you earned.
    if (s.airT > 0) return s.airBig ? 'skateboard-kickflip' : 'skateboard-ollie';
    // Mid-throw. `cool` is the weapon's cooldown and the first part of it is
    // the wind-up and release, so the arm is drawn doing what the simulation
    // says it is doing rather than the rig guessing from a flag.
    if (s.throwT > 0) return throwState(s.lastThrown);
    // On the slick. Oil does no damage and takes your steering for 1.1s, and
    // until now nothing on screen said so — the rider kept his normal pose
    // while the controls stopped working, which reads as a bug rather than as
    // a hazard. A loop, because the phase is not fixed.
    if (s.oilT > 0) return 'skateboard-oil-wobble';
    if (s.tucking) return 'skateboard-manual';
    return 'skateboard-ride';
}

/**
 * Which reaction the thief plays for the thing that just hit him.
 *
 * Every weapon used to fold him the same way, which made a sandal and a frozen
 * slushie indistinguishable from the saddle and quietly undid the point of
 * having a kit at all. A sandal snaps his head forward; a slushie blinds him
 * and he rides one-handed wiping his eyes; anything with real mass slews the
 * front wheel and he fights it. `bike-banana-slip` is kept for the banana
 * specifically, which is what it was drawn for.
 */
function weaponHit(id: string): string {
    if (id.includes('banana')) return 'bike-banana-slip';
    if (id.includes('chancla') || id.includes('sandal')) return 'bike-hit-chancla';
    if (id.includes('slush') || id.includes('drink') || id.includes('soda')) return 'bike-hit-slushie';
    return 'bike-hit-heavy';
}

/**
 * The three ways he takes himself out, and how long each takes.
 *
 * He used to hit a bin, once, forever: one sheet, one line, one duration. That
 * is a metronome, not a character -- and it wasted the four sheets the
 * illustrator drew for the other two.
 *
 * `wheelie` is him showing off and paying for it, so it has to *start* as the
 * wheelie or the fall reads as unprovoked. `banana` is the one where he loses
 * the pacifier, so it has to hold long enough after the slip for the tail sheet
 * to land -- the joke is the object hitting the tarmac, and a 5-frame sheet
 * played over 0.3s is a flicker.
 */
const CRASH_KINDS = ['bin', 'wheelie', 'banana'] as const;
export type CrashKind = (typeof CRASH_KINDS)[number];

const CRASH_TIME: Record<CrashKind, number> = { bin: 1.0, wheelie: 1.5, banana: 1.6 };

/**
 * How far through a crash he is: 0 the instant it starts, 1 as it ends.
 *
 * `crashT` counts down, which reads backwards at every call site that wants to
 * know what to draw.
 */
export const crashPhase = (s: RaceState): number =>
    s.crashT <= 0 ? 1 : 1 - s.crashT / CRASH_TIME[s.crashKind];

export function bikeState(s: RaceState): string {
    if (s.crashT > 0) {
        const p = crashPhase(s);
        if (s.crashKind === 'wheelie') {
            // Up, over, along. The sparks are him succeeding for half a second.
            if (p < 0.34) return 'bike-wheelie-sparks';
            if (p < 0.68) return 'bike-fall-off';
            return 'bike-ground-roll';
        }
        if (s.crashKind === 'banana') {
            // The slip, then the pacifier. The second half is the punchline and
            // gets the longer half.
            return p < 0.45 ? 'bike-banana-slip' : 'bike-banana-slip-pacifier-tail';
        }
        return p < 0.6 ? 'bike-fall-off' : 'bike-ground-roll';
    }
    if (s.thiefStun > 0) return weaponHit(s.thiefHitBy);
    // He looks back when you are on his wheel — the drafting tell, and the
    // only moment in the race where he acknowledges you at all.
    if (s.draft > 0.04) return 'bike-look-back';
    // Comfortably clear and cruising: he sucks his thumb at you. It is the most
    // annoying thing in the game and it is only ever earned by falling behind.
    if (s.gap > START_GAP * 1.15 && s.thiefSpeed < 34) return 'bike-thumb-suck';
    if (s.thiefSpeed > 34) return 'bike-wheelie-sparks';
    return 'bike-ride';
}

/**
 * Metres of hill covered by one loop of a rider's rolling cycle.
 *
 * The ride sheets are body cycles — weight shifting over the deck, one turn of
 * the cranks — not wheel rotations, so this is a cadence rather than a
 * circumference. Tuned so a rig at its stated cruise speed reads at about
 * fourteen frames a second: quick enough to look like work, slow enough that
 * you can see the pose. Everything slower scales down from there, which is the
 * whole point — a rider crawling off the line no longer pedals like a lunatic.
 */
const RIDE_CYCLE_M = 28;

/**
 * Drawn height of each vehicle at lane scale 1, in game pixels.
 *
 * One constant used to serve for all of them, set to 14 to match the coded
 * rectangle it replaced. That was the wrong thing to match. The rectangle was a
 * placeholder; the delivered art is authored to `docs/ASSETS-STREET.md`, whose
 * reference is a 23px standing adult, and against that reference a sedan is 19
 * and a van is 23. Drawing every one of them at 14 squashed the sedan to 74%
 * and the van to 61%, which is most of why a parked car looked like a toy
 * beside a rider.
 *
 * The other half is that the rider sheets arrived much smaller than the brief
 * asked — `skateboard-ride` is authored 13x10 where the brief wanted about 26 —
 * so the rider is being drawn at three times its authored size to compensate,
 * while the cars were being drawn at three quarters of theirs. A 4x
 * disagreement between two things standing next to each other.
 *
 * So: each vehicle at its own authored height, scaled by one shared factor.
 * `CAR_SCALE` is above 1 deliberately — with the rider drawn at 30 against a
 * brief that puts him at 26, a car matched to the brief exactly would still
 * look small beside him, and a car is meant to be the bigger object on a road.
 */
const CAR_SCALE = 1.3;
const CAR_BRIEF_H: Record<string, number> = {
    'car-sedan': 19,
    'car-taxi': 19,
    'car-van': 23,
    'car-wreck': 16,
    'car-door-open': 16,
};
const carHeight = (id: string): number => (CAR_BRIEF_H[id] ?? 19) * CAR_SCALE;

/**
 * Far-row house facades for the mid-ground, from the shared street set.
 *
 * The `-far` variants specifically: their ground line is at the bottom, because
 * a house across the valley rises up-screen away from you. The `-near` pair is
 * drawn the other way up and belongs to Pizza Run, where houses stand on the
 * kerb you are riding along. Using the wrong one puts every roof in the dirt.
 */
const HOOD_ART = ['house-bungalow-far', 'house-twostorey-far', 'house-apartment-far'];

/**
 * Skyline-kit buildings, promoted to the mid-ground.
 *
 * These were drawn for the horizon and are far too detailed for it — see the
 * note at the draw site. Here they are the commercial end of the street.
 */
const BLOCK_TALL = ['tower-b-narrow', 'tower-d-box', 'tower-f-old', 'tower-c-stepped'];
const BLOCK_WIDE = ['lowrise-a-strip', 'lowrise-c-industrial', 'lowrise-e-mixed', 'lowrise-b-walkup'];

/**
 * How long a rider's animation has been running, in a clock that does not stop.
 *
 * `stepRace` freezes `s.t` the moment the race ends and advances `s.wipe`
 * instead, so a wipeout animation keyed to `s.t` alone would hold on frame one
 * for the entire end-of-race cinematic. Only one of the two ever moves, so the
 * sum is monotonic.
 */
const clockOf = (s: RaceState): number => s.t + s.wipe;

/** Frame for the player's rider, restarting one-shots when the state changes. */
function boardFrame(s: RaceState): number {
    const id = boardState(s);
    const n = art.frames(id);
    const rate = id === 'skateboard-ride'
        ? anim.cycleRate(n, s.speed, RIDE_CYCLE_M)
        // The hang time of an ollie is decided by the rig and the ramp, so fit
        // the sheet to it: the rider lands on the last frame rather than
        // holding a tucked pose in mid-air or snapping straight at the apex.
        : id === 'skateboard-ollie' ? anim.fitRate(n, s.airDur)
        : id === 'skateboard-balance-fall' ? anim.fitRate(n, WIPE_FALL)
        // The two hit sheets share the crash window with the recovery: the
        // fall owns the first two thirds of it, getting up owns the last third.
        // Fitting each to its own slice is what stops a twelve-frame trip
        // playing halfway and cutting to a rider already back on his feet.
        : id === 'skateboard-obstacle-trip-forward' || id === 'skateboard-front-collision-backward'
            ? anim.fitRate(n, INV_TIME * 0.66)
        : id === 'skateboard-pushup-recover' || id === 'skateboard-burpee-to-stand'
            ? anim.fitRate(n, INV_TIME * 0.34)
        // A clip and a collision both own the whole hit window rather than a
        // slice of it: there is no getting-up phase, because you never went
        // down. Fitted so the last frame lands as control returns.
        : id === 'skateboard-hit-stumble' || id === 'skateboard-ped-collide'
            ? anim.fitRate(n, INV_TIME)
        : id.startsWith('skateboard-throw-') ? anim.fitRate(n, THROW_TIME)
        : undefined;
    return anim.frameFor(s.animYou, id, clockOf(s), n, rate);
}

/** Frame for the thief, same rules. */
function bikeFrame(s: RaceState): number {
    const id = bikeState(s);
    const n = art.frames(id);
    const rolling = id === 'bike-ride' || id === 'bike-wheelie-sparks';
    const rate = rolling ? anim.cycleRate(n, s.thiefSpeed, RIDE_CYCLE_M) : undefined;
    return anim.frameFor(s.animThief, id, clockOf(s), n, rate);
}

/** Drawn height in game pixels, from `docs/ASSETS-STREET.md`. */
const ART_H: Record<string, number> = {
    bin: 12, dog: 9, ped: 23, works: 14, oil: 7, ramp: 10, junk: 8,
};

/** A stand-in so nobody is ever left with nothing to press. */
const POCKET: Weapon = {
    id: 'pocket-litter',
    name: 'Whatever Was In Your Pocket',
    short: 'Pocket',
    glyph: '🪙',
    klass: 'thrown',
    damage: 7,
    cooldown: 0.7,
    speed: 150,
    uses: 9,
    games: ['cart-race'],
    flavor: 'Lint, a lighter, three shekels. It still stings.',
};

// ---------------------------------------------------------------------------
// His voice. Lifted from data/celebrities/the-game — the mixtape, the grind,
// and the fact that he once mugged somebody for half a sandwich.
// ---------------------------------------------------------------------------
const TALK = [
    "Life don't make sense, homie!",
    'These is my streets!',
    "I'm droppin' a mixtape about this!",
    'Respect the grind!',
    'This cart is a RENTAL!',
    'I only took ONE lace before!',
    "Don't stare too long, blood!",
    'Premium Unleaded — out now!',
    'Ayo, the wheels is square!',
    'Stay dangerous!',
    'I used to think Eminem was better than me.',
    'I was in a coma.',
    "So what if I'm from Palmdale?",
    'Stop — that tickles!',
    'I could call Andre RIGHT NOW.',
    'Sooowoo!',
    'LADY KILLERS AND BAD BOYS!',
    'I was in a coma for FIVE YEARS, blood.',
    'I got a verse about this hill already.',
    "That's a Compton left turn!",
    "I don't even LIKE shoes. I like ART.",
    'Ayo somebody film this!',
    'My knees is fine. My knees is FINE.',
    "I invented this. The whole hill. Look it up.",
    'I been humble since Tuesday!',
    'This is cardio, blood!',
    "Wait — is this Palmdale? This look like Palmdale.",
    'I could stop. I choose not to.',
    'Andre gonna hear about this.',
    'Documentary crew is BEHIND me right now!',
    "I'm not even out of breath.",
];
const TALK_CRASH = [
    'MY MIXTAPE!',
    'THAT WAS A BIN!',
    'Aight, that was on purpose.',
    'The cart did that, not me!',
    "Life don't make— OW!",
];
const TALK_HIT = [
    'AYO, WHO YOU CALLIN A BUSTER?!',
    'Not the face, blood!',
    "That's a AM/PM item! I know the clerk!",
    'You wastin good food!',
    'I felt that in my SOUL!',
];
/**
 * Throwing his own rubbish at you.
 *
 * This was one hardcoded string, and it was the only thing left in his mouth
 * that repeated inside four lines once everything else was dealt from a bag --
 * which is the whole complaint in miniature: one line said often enough is what
 * a player remembers, not the twenty-nine said once.
 */
const TALK_THROW = [
    'CATCH, blood!',
    'You want it? HAVE IT!',
    "That's a gift! From me!",
    'I was gonna eat that!',
    'RECYCLE, homie!',
    'Incoming, and I\'m sorry!',
    'This is litterin and I DON\'T CARE!',
];

/** He tried a wheelie. The wheelie won. */
const TALK_WHEELIE = [
    'WATCH THIS— ',
    'I do this in the VIDEO!',
    'That was the wind, blood.',
    'Ayo the front wheel is DEFECTIVE.',
    'I meant to do a wheelie, not a WHOLE FLIP.',
    'I was in a coma, I get one free flip!',
];
/** A banana. An actual banana. In this economy. */
const TALK_BANANA = [
    'WHO LEAVES A BANANA—',
    'That was placed there. By enemies.',
    'Nah that was a BANANA, that don\'t count!',
    'Somebody is MAD at me!',
    'I slipped on FRUIT. Put that in the documentary.',
];
/** The pacifier hits the tarmac. He has nothing to say. He says it anyway. */
const TALK_PACIFIER = [
    "That ain't mine.",
    'My NEPHEW left that!',
    "Don't pick that up.",
    "That's for the baby. I have a baby.",
    'You saw NOTHING.',
];
const TALK_WIN = ['Aight. Aight. Take it. Respect the grind.', "Blood, I was gonna give it back."];

// ---------------------------------------------------------------------------
// State. One flat mutable object — the loop touches it 60 times a second, so
// nothing in here is ever allowed near React state.
// ---------------------------------------------------------------------------
interface Obs {
    id: number;
    def: ObsDef;
    z: number;
    lane: number;
    /** Wander direction for drifting obstacles. */
    dir: number;
    /** Resolved once, so a long parked car cannot hit you four frames running. */
    done: boolean;
    /** Cosmetic: knocked-over / opened / cleared. */
    hit: boolean;
    phase: number;
    /** Closest lateral clearance seen while this obstacle was nearby (see nearMiss). */
    minLat: number;
    /** Near-miss has already been scored (or ruled out) for this one. */
    evaluated: boolean;
}

interface Shot {
    id: number;
    wid: string;
    /** Metres of gap covered so far. */
    travel: number;
    lane: number;
    /** Where it bonks off a car instead of reaching him, or Infinity. */
    stopAt: number;
    back: boolean;
    spin: number;
}

interface Spark {
    x: number; y: number; vx: number; vy: number; life: number; ch: string;
}

export type RaceOutcome = 'caught' | 'lost' | 'wipeout' | 'flat';

export interface RaceState {
    rig: Rig;
    hasBoard: boolean;
    /** Energy-derived fitness, 0.9..1.0. Tired legs cruise slower and steer later. */
    fitness: number;
    seed: number;

    t: number;
    z: number;
    speed: number;
    topSpeed: number;
    laneF: number;
    /** Where the rider currently sits along the screen. See PLAYER_X_BACK. */
    px: number;
    drag: number;
    dragTuck: number;
    tucking: boolean;
    wob: number;
    health: number;
    gap: number;
    /** Current slipstream strength, 0..1 — see DRAFT_ACCEL. Drawn as feedback. */
    draft: number;
    /** Frozen-frame timer on a hard impact. See the hitstop check in stepRace. */
    hitstop: number;
    /** Total clean dodges this run, for the end-of-run summary. */
    closeCalls: number;
    /** Current near-miss streak; resets to 0 on a crash or when comboT lapses. */
    combo: number;
    comboT: number;

    airT: number;
    airDur: number;
    airH: number;
    /** A real ollie clears 'ollie' obstacles; a trolley hop only clears 'hop'. */
    airBig: boolean;
    airFromRamp: boolean;
    invT: number;
    oilT: number;

    thiefLane: number;
    thiefSpeed: number;
    /** Rolling average of your speed — what the rubber band tracks. */
    pace: number;
    thiefStun: number;
    thiefSlow: number;
    /** Anti-stun-lock window: no new stagger while this is running. */
    thiefGuard: number;
    /** His own crashes — a deeper scrub than anything you can throw. */
    crashT: number;
    /** Which way he went down, which decides the sheets and the line. */
    crashKind: CrashKind;
    /** Set once per banana crash, when the pacifier actually leaves him. */
    dummyOut: boolean;
    rattle: number;
    crashIn: number;
    throwIn: number;
    talk: string;
    talkT: number;
    /** Shuffled indices left in each line pool — see `deal`. */
    bags: Record<string, number[]>;
    /** The last line spoken, so a bag refill cannot immediately repeat it. */
    lastLine: string;

    /**
     * Playback clocks for the two riders. Held on state rather than in the
     * draw function so a one-shot — a fall, an ollie — restarts when the state
     * does instead of picking up wherever the modulo left the last one. See
     * `engine/streetAnim.ts`.
     */
    animYou: anim.AnimClock;
    animThief: anim.AnimClock;
    /** One-shot effect sheets in flight — dust, impact stars, water. */
    bursts: Burst[];
    /**
     * What last hit you: 'wall' for anything you went into head-on (a parked
     * car, a ramp taken wrong), 'trip' for street furniture you caught a wheel
     * on. The two have different fall animations and reading them off the
     * obstacle is the only way the drawing can tell them apart.
     */
    hitKind: 'wall' | 'trip';
    /**
     * The obstacle kind that last hit you, and whether it was a light one.
     *
     * `hitKind` says which way you went down; these say what put you there. A
     * pedestrian is the only obstacle that is a person and gets a collision of
     * its own, and anything doing eight damage or less is a clip you ride out
     * rather than a crash — a wheelie bin and a parked Camry used to play the
     * identical animation, which flattened the whole damage table into one
     * event.
     */
    hitBy: string;
    hitLight: boolean;
    /** Which AM/PM item last connected with the thief, for his reaction. */
    thiefHitBy: string;
    /**
     * The wind-up and release, and what is being thrown.
     *
     * Separate from `cool`, which is the weapon's whole cooldown and is far
     * longer than the arm movement — driving the animation off it would leave
     * the rider frozen mid-throw for most of a second after the item has gone.
     */
    throwT: number;
    lastThrown: string;

    obstacles: Obs[];
    nextZ: number;
    obsId: number;
    shots: Shot[];
    shotId: number;

    weapons: Record<string, Weapon>;
    ammo: Record<string, number>;
    cool: number;

    shake: number;
    sparks: Spark[];
    introT: number;
    flash: string;
    flashT: number;

    outcome: RaceOutcome | null;
    endT: number;
    wipe: number;

    hits: number;
    airs: number;
    cleanLandings: number;
    /** Total m/s handed back by ramp landings — the longboard's other payoff. */
    rampGain: number;
    thiefHits: number;
    thrown: number;
}

export interface RaceInput {
    left: boolean;
    right: boolean;
    /** Held: B or down. */
    tuck: boolean;
    /** Edge-triggered: up. */
    ollie: boolean;
    /** Across the street. Lanes are drawn stacked, so this is the screen's y. */
    up: boolean;
    down: boolean;
    /** Squeeze the brakes. Drops you back toward the left edge of the screen. */
    brake: boolean;
    /** Edge-triggered: A. */
    fire: boolean;
    weapon: string;
}

export const NO_INPUT: RaceInput = {
    left: false, right: false, up: false, down: false,
    tuck: false, ollie: false, brake: false, fire: false, weapon: '',
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Deterministic LCG kept on the state, so a scripted run replays exactly. */
const rnd = (s: RaceState) => {
    s.seed = (s.seed * 1664525 + 1013904223) >>> 0;
    return s.seed / 4294967296;
};
const pick = <T,>(s: RaceState, arr: readonly T[]) => arr[Math.floor(rnd(s) * arr.length) % arr.length];

/**
 * Pick from a list without repeating until the list is used up.
 *
 * `pick` is uniform, which is the right answer for a lane or a spawn and the
 * wrong one for a voice. Thirty lines drawn uniformly across a race still
 * collide constantly -- the chance of no repeat in seventeen draws from thirty
 * is under one per cent -- and a repeat inside ten seconds is what makes a
 * character sound like four lines on a loop however many he actually has.
 * Adding more lines does not fix that; it barely moves it.
 *
 * So: deal from a shuffled bag and refill when it is empty. Every line is heard
 * once before any is heard twice, and the only thing that can repeat across the
 * seam is the last line of one bag followed by the first of the next.
 *
 * Keyed by pool so his crash lines and his chatter do not share a bag, and
 * fed by the same seeded rng as everything else, so a replay is still a replay.
 */
function deal<T>(s: RaceState, key: string, arr: readonly T[]): T {
    if (!arr.length) return undefined as unknown as T;
    let bag = s.bags[key];
    if (!bag || bag.length === 0) {
        bag = arr.map((_, i) => i);
        // Fisher-Yates, backwards, on the seeded stream.
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(rnd(s) * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        // Avoid the one repeat a bag cannot rule out: if the refill would open
        // with the line that just closed the previous bag, swap it back one.
        if (bag.length > 1 && arr[bag[0]] === s.lastLine) [bag[0], bag[1]] = [bag[1], bag[0]];
        s.bags[key] = bag;
    }
    const line = arr[bag.pop()!];
    s.lastLine = line as unknown as string;
    return line;
}

export function createRaceState(opts: {
    hasBoard: boolean;
    energy?: number;
    weapons?: Weapon[];
    seed?: number;
}): RaceState {
    const rig = opts.hasBoard ? BOARD : TROLLEY;
    // Energy is a small tax rather than a wall: dead legs cost you ~10% of your
    // ceiling, which is enough to feel and not enough to make the run pointless.
    const fitness = 0.9 + 0.1 * clamp((opts.energy ?? 100) / 100, 0, 1);
    const weapons: Record<string, Weapon> = {};
    const ammo: Record<string, number> = {};
    const list = opts.weapons && opts.weapons.length ? opts.weapons : [POCKET];
    for (const w of list) {
        weapons[w.id] = w;
        if (w.uses !== undefined) ammo[w.id] = w.uses;
    }

    const s: RaceState = {
        rig, hasBoard: opts.hasBoard, fitness,
        seed: (opts.seed ?? 0x5eed) >>> 0,
        t: 0, z: 0, speed: 17, topSpeed: 17, laneF: 1.5, px: PLAYER_X,
        // Quadratic drag tuned so the rig's stated cruise / tuck speeds are its
        // actual terminal velocities. Tucking raises the ceiling by lowering
        // drag, so the gain is a real physics change and not a bolt-on bonus.
        drag: HILL_ACCEL / Math.pow(rig.cruise * fitness, 2),
        dragTuck: (HILL_ACCEL * TUCK_GAIN) / Math.pow(rig.tuckTop * fitness, 2),
        tucking: false, wob: 0,
        health: 100, gap: START_GAP,
        draft: 0, hitstop: 0, closeCalls: 0, combo: 0, comboT: 0,
        airT: 0, airDur: 0.5, airH: 0, airBig: false, airFromRamp: false,
        invT: 0, oilT: 0,
        thiefLane: 1.5, thiefSpeed: THIEF_BASE, pace: THIEF_BASE, thiefStun: 0, thiefSlow: 0,
        thiefGuard: 0, crashT: 0, crashKind: 'bin', dummyOut: false, rattle: 0, crashIn: 3.2, throwIn: 6,
        talk: opts.hasBoard ? 'Nah, not the skateboard kid!' : 'You on a TROLLEY? Blood, please.',
        talkT: 3.4, bags: {}, lastLine: '',
        animYou: anim.makeClock(), animThief: anim.makeClock(),
        bursts: [], hitKind: 'trip', hitBy: '', hitLight: false, thiefHitBy: '',
        throwT: 0, lastThrown: '',
        obstacles: [], nextZ: 40, obsId: 0, shots: [], shotId: 0,
        weapons, ammo, cool: 0,
        shake: 0, sparks: [], introT: 2.6, flash: '', flashT: 0,
        outcome: null, endT: 0, wipe: 0,
        hits: 0, airs: 0, cleanLandings: 0, rampGain: 0, thiefHits: 0, thrown: 0,
    };
    fillStreet(s);
    return s;
}

/** The first weapon in the rail, so the component and the sim agree on a default. */
export const defaultWeaponId = (s: RaceState) => Object.keys(s.weapons)[0] ?? '';

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
function spawnObstacle(s: RaceState, def: ObsDef, z: number, lane: number) {
    s.obstacles.push({
        id: s.obsId++, def, z, lane,
        dir: rnd(s) < 0.5 ? -1 : 1, done: false, hit: false, phase: rnd(s) * 6.28,
        minLat: Infinity, evaluated: false,
    });
}

/**
 * Which lane a thing spawns in.
 *
 * Kerb furniture takes an outside lane, either side. Anything wide is kept off
 * the very edges so it cannot hang half off the road. Everything else is a
 * uniform roll across all four, which is what the whole table used to be.
 */
function laneFor(s: RaceState, def: ObsDef): number {
    // The far carriageway is the top two lanes, which is also where the
    // oncoming headlights read best against the verge.
    if (def.side === 'far') return rnd(s) < 0.5 ? 0 : 1;
    // Running lanes only, so overtaking something never means squeezing between
    // it and a parked car in the same instant.
    if (def.side === 'inner') return 1 + Math.floor(rnd(s) * Math.max(1, LANES - 2));
    if (def.kerb) return rnd(s) < 0.5 ? 0 : LANES - 1;
    const lane = Math.floor(rnd(s) * LANES);
    return def.wide > 1 ? clamp(lane, 1, LANES - 2) : lane;
}

/**
 * Where a thing is dropped into the world, in metres down the hill.
 *
 * Oncoming traffic is spawned far beyond the normal horizon and drives into
 * view, because a car closing at 44m/s that appeared at the edge of the visible
 * road would be on you in a second with no chance to read which lane it is in.
 * Starting it off-screen means it arrives the way a real one would: as
 * headlights, getting bigger.
 */
function spawnZ(s: RaceState, def: ObsDef): number {
    if ((def.vz ?? 0) >= 0) return s.nextZ;
    const closing = s.speed + Math.abs(def.vz ?? 0);
    return s.nextZ + closing * ONCOMING_LEAD;
}

/** Seconds of approach an oncoming vehicle gets before it reaches the spawn line. */
const ONCOMING_LEAD = 2.2;

function fillStreet(s: RaceState) {
    while (s.nextZ < s.z + SPAWN_AHEAD) {
        let roll = rnd(s) * OBS_TOTAL;
        let def = OBS[0];
        for (const o of OBS) { roll -= o.weight; if (roll <= 0) { def = o; break; } }

        const lane = laneFor(s, def);
        spawnObstacle(s, def, spawnZ(s, def), lane);

        // A second obstacle two lanes away sometimes, so you have to actually
        // pick a line. Never enough to seal the street — one lane is always open.
        if (def.wide <= 1 && rnd(s) < 0.34) {
            const far = lane <= 1 ? lane + 2 + Math.floor(rnd(s) * (LANES - lane - 2)) : lane - 2 - Math.floor(rnd(s) * (lane - 1));
            let roll2 = rnd(s) * OBS_TOTAL;
            let def2 = OBS[0];
            for (const o of OBS) { roll2 -= o.weight; if (roll2 <= 0) { def2 = o; break; } }
            // The second one keeps its own rule about where it belongs: a car
            // dealt into the far slot still parks at a kerb, so this can never
            // put a Camry back in the middle of the road by the side door.
            if (def2.wide <= 1) {
                const lane2 = def2.kerb ? laneFor(s, def2) : clamp(far, 0, LANES - 1);
                spawnObstacle(s, def2, spawnZ(s, def2) + (rnd(s) - 0.5) * 3, lane2);
            }
        }

        // The street tightens as the hill gets steeper.
        const squeeze = Math.min(11, s.t * 0.16);
        s.nextZ += 27 - squeeze + rnd(s) * 26;
    }
}

const overlaps = (s: RaceState, o: Obs) =>
    Math.abs(o.z - s.z) < o.def.len + 1.1 && Math.abs(o.lane - s.laneF) < o.def.wide + 0.22;

/** Anything currently underneath the player, cleared or not. */
function under(s: RaceState): Obs | null {
    for (const o of s.obstacles) if (!o.def.ramp && !o.def.oil && overlaps(s, o)) return o;
    return null;
}

function addSpark(s: RaceState, x: number, y: number, ch: string) {
    if (s.sparks.length > 26) return;
    s.sparks.push({ x, y, vx: -40 - rnd(s) * 70, vy: -30 - rnd(s) * 60, life: 0.5 + rnd(s) * 0.4, ch });
}

/**
 * Start a drawn one-shot effect. Its length comes from the delivered sheet, so
 * an effect whose art has not arrived expires immediately instead of leaving an
 * invisible placeholder ticking away. See `engine/burst.ts`.
 */
function fx(s: RaceState, id: string, x: number, y: number, size: number) {
    addBurst(s.bursts, id, x, y, size, art.frames(id), -s.speed * PX_PER_M * 0.2);
}

/**
 * A clean dodge is worth something. Passing an obstacle close enough that a
 * slightly worse read would have hit it, but with no contact, is what turns
 * "avoid the furniture" into "thread the furniture" — a small, real speed
 * reward, plus a combo counter for a run of them, so confident weaving pays
 * for itself the way it should in a driving game rather than a dodge-'em-up.
 */
function nearMiss(s: RaceState, o: Obs) {
    s.closeCalls++;
    s.combo = s.comboT > 0 ? s.combo + 1 : 1;
    s.comboT = NEARMISS_WINDOW;
    const boost = 1.0 + Math.min(2.2, (s.combo - 1) * 0.4);
    s.speed += boost;
    s.flash = s.combo > 1 ? `CLOSE x${s.combo}` : 'CLOSE CALL';
    s.flashT = 0.7;
    addSpark(s, s.px + 9, laneY(s.laneF) - 6, '✨');
}

function crash(s: RaceState, o: Obs) {
    if (s.invT > 0) return;
    o.hit = true;
    s.invT = INV_TIME;
    s.hits++;
    // A hit ends any near-miss streak on the spot, and freezes the world for
    // a handful of frames — see the hitstop check at the top of stepRace.
    // Bigger hits buy a longer freeze, which is most of what sells "impact"
    // without any of it costing the physics being tested elsewhere.
    s.combo = 0;
    s.comboT = 0;
    s.hitstop = Math.min(0.12, 0.05 + o.def.dmg * 0.004);
    // Low street furniture is a plough job for a trolley and a non-event for a
    // board that ollied it; a parked Camry is a wall for both.
    const low = o.def.clear !== 'none';
    s.speed *= clamp(o.def.keep + s.rig.hitKeep + (low ? s.rig.plough : 0), 0.2, 0.97);
    s.health -= o.def.dmg * s.rig.hitDmg * (low ? s.rig.ploughDmg : 1);
    // An impact also knocks your line out, which is how a bad hit snowballs
    // into a second one.
    s.laneF = clamp(s.laneF + (rnd(s) < 0.5 ? -0.35 : 0.35), 0, LANES - 1);
    s.shake = Math.min(9, 4 + o.def.dmg * 0.3);
    s.flash = o.def.label;
    s.flashT = 0.9;
    s.airT = 0;
    s.airH = 0;
    // A wall you cannot clear throws you backwards over the nose; low street
    // furniture trips you forwards. The drawing needs to know which.
    s.hitKind = low ? 'trip' : 'wall';
    s.hitBy = o.def.kind;
    s.hitLight = o.def.dmg <= 8;
    fx(s, 'impact-star', s.px + 8, laneY(s.laneF) - 8, 12);
    addSpark(s, s.px + 8, laneY(s.laneF) - 8, '💢');
}

function land(s: RaceState) {
    s.airT = 0;
    s.airH = 0;
    // Wheels back on tarmac: a puff of dust at the contact point. Bigger off a
    // ramp, because a ramp landing is a bigger arrival.
    fx(s, 'dust-plume', s.px - 4, laneY(s.laneF) + 1, s.airBig ? 13 : 8);
    const blocker = under(s);
    if (blocker && !blocker.done) {
        blocker.done = true;
        crash(s, blocker);
        return;
    }
    if (s.airFromRamp) {
        // Landing clean off a ramp is the biggest free speed in the game and
        // most of why the longboard wins. Note the wobble check: come into the
        // ramp flat out and you land sketchy and get a third of it, so ramps
        // are a reason to come *out* of the tuck.
        const clean = s.wob < 0.6;
        const gain = s.rig.rampBoost * (clean ? 1 : 0.35);
        s.speed += gain;
        s.rampGain += gain;
        if (clean) s.cleanLandings++;
        // A trolley does not land. It arrives. The axles take it every time.
        if (!s.rig.canOllie) {
            s.health -= 4;
            s.shake = Math.max(s.shake, 4);
            s.flash = 'the trolley bottoms out';
        } else {
            s.flash = clean ? 'CLEAN LANDING' : 'sketchy landing';
        }
        s.flashT = 0.8;
        addSpark(s, s.px, laneY(s.laneF), '💨');
    }
    s.airFromRamp = false;
}

function launch(s: RaceState, dur: number, big: boolean, fromRamp: boolean) {
    s.airT = dur;
    s.airDur = dur;
    s.airBig = big;
    s.airFromRamp = fromRamp;
    s.airs++;
}

function hitThief(s: RaceState, w: Weapon) {
    s.thiefHits++;
    s.thiefHitBy = w.id;
    s.rattle = Math.min(100, s.rattle + w.damage * 0.8);
    // Stun scales with damage: the chancla folds him, a hot bureka just annoys.
    // `thiefGuard` is the anti-stun-lock rule — he is already staggered, so a
    // second hit inside the window adds rattle and slow but no fresh stagger.
    // Without it, a fast weapon simply freezes him and there is no race.
    if (s.thiefGuard <= 0) {
        s.thiefStun = Math.max(s.thiefStun, 0.25 + w.damage * 0.008);
        s.thiefGuard = 2.2;
    }
    if (w.slows) s.thiefSlow = Math.max(s.thiefSlow, 2.6);
    // A rattled driver clips the next bin sooner. Chip damage compounds.
    s.crashIn = Math.min(s.crashIn, 0.9 + rnd(s) * 0.9);
    s.talk = pick(s, TALK_HIT);
    s.talkT = 1.6;
    const tx = clamp(s.px + s.gap * GAP_PX, s.px + 14, 302);
    addSpark(s, tx, laneY(s.thiefLane) - 10, w.glyph);
}

function fire(s: RaceState, id: string) {
    const w = s.weapons[id] ?? s.weapons[defaultWeaponId(s)];
    if (!w) return;
    // You own one chancla and one frisbee. Until it comes back, you are
    // empty-handed — which is the only thing stopping a homing weapon with no
    // ammo count from trivialising the whole chase.
    if (w.returns && s.shots.some(sh => sh.wid === w.id)) {
        s.flash = `${w.short.toLowerCase()} still out there`;
        s.flashT = 0.5;
        return;
    }
    const left = s.ammo[w.id];
    if (left !== undefined && left <= 0) {
        s.flash = `out of ${w.short.toLowerCase()}`;
        s.flashT = 0.8;
        return;
    }
    if (left !== undefined) s.ammo[w.id] = left - 1;
    s.cool = w.cooldown;
    s.throwT = THROW_TIME;
    s.lastThrown = w.id;
    s.thrown++;

    // Non-piercing throws get eaten by whatever is parked between you and him.
    // The frisbee is the whole reason `piercing` exists in the registry.
    let stopAt = Infinity;
    if (!w.piercing) {
        for (const o of s.obstacles) {
            const ahead = o.z - s.z;
            if (ahead > 1 && ahead < 16 && Math.abs(o.lane - s.laneF) < o.def.wide + 0.3 && o.def.clear === 'none') {
                // Converted into gap-metres so the bonk lands on the drawn car.
                stopAt = Math.min(stopAt, (ahead * PX_PER_M) / GAP_PX);
            }
        }
    }
    s.shots.push({ id: s.shotId++, wid: w.id, travel: 0, lane: s.laneF, stopAt, back: false, spin: 0 });
}

function stepShots(s: RaceState, dt: number) {
    for (let i = s.shots.length - 1; i >= 0; i--) {
        const sh = s.shots[i];
        const w = s.weapons[sh.wid];
        if (!w) { s.shots.splice(i, 1); continue; }
        const v = (w.speed ?? 180) * PROJ_SCALE;
        sh.spin += dt * 14;

        if (sh.back) {
            // Returning weapons fly home and hand you the use back — that's what
            // makes the chancla and the frisbee effectively unlimited.
            sh.travel -= v * 1.5 * dt;
            if (sh.travel <= 0) {
                if (s.ammo[w.id] !== undefined) s.ammo[w.id] = (s.ammo[w.id] ?? 0) + 1;
                s.shots.splice(i, 1);
            }
            continue;
        }

        sh.travel += v * dt;

        if (sh.travel >= sh.stopAt) {
            addSpark(s, s.px + sh.travel * GAP_PX, laneY(sh.lane) - 6, '✖');
            if (w.returns) { sh.back = true; sh.travel = sh.stopAt; } else s.shots.splice(i, 1);
            continue;
        }

        if (sh.travel >= s.gap) {
            // `returns && !piercing` is the chancla: ancient guidance system,
            // zero latency, does not need you to pick the right lane.
            const homing = !!w.returns && !w.piercing;
            // A frisbee cuts a line across the street, so it forgives a bad
            // read of his weave; everything else has to be thrown at the lane
            // he'll actually be in by the time it lands.
            const window = w.piercing ? 1.7 : 1.2;
            const onTarget = homing || Math.abs(s.thiefLane - sh.lane) < window;
            if (onTarget) hitThief(s, w);
            if (w.returns) { sh.back = true; sh.travel = s.gap; } else s.shots.splice(i, 1);
        }
    }
}

function stepThief(s: RaceState, dt: number) {
    // He weaves because he cannot steer, not because he's evasive. Two sines of
    // different periods read as "drunk" rather than "patterned".
    s.thiefLane = clamp(1.5 + Math.sin(s.t * 1.2) * 1.35 + Math.sin(s.t * 0.47) * 0.5, 0, LANES - 1);

    // Rolling average rather than instantaneous speed, so he reacts to how the
    // run is going and not to every single carve and pothole.
    s.pace += (s.speed - s.pace) * dt * 0.35;
    const anchor = PACE_W * s.pace + (1 - PACE_W) * THIEF_ABS;
    let ts = clamp(anchor + (START_GAP - s.gap) * RUBBER_K, THIEF_MIN, THIEF_MAX);
    // Rattle is cumulative weapon chip: a battered thief never gets back to pace.
    // Rattle is cumulative chip damage from AM/PM items. It saturates at 100,
    // so twenty chanclas are not twenty times better than five — weapons open
    // the door, they don't win the race on their own.
    ts *= 1 - s.rattle * 0.0004;
    // He is on a hill, so nothing you throw can stop him — it only scrubs him.
    // His own crashes scrub harder than any weapon, which is the joke.
    if (s.crashT > 0) ts *= 0.75;
    if (s.thiefStun > 0) ts *= 0.88;
    else if (s.thiefSlow > 0) ts *= 0.78;
    s.thiefSpeed = Math.max(4, ts);

    s.thiefStun = Math.max(0, s.thiefStun - dt);
    s.thiefSlow = Math.max(0, s.thiefSlow - dt);
    s.thiefGuard = Math.max(0, s.thiefGuard - dt);
    s.crashT = Math.max(0, s.crashT - dt);

    // He hits things. Constantly. It is the only reason he is catchable.
    //
    // Which thing, though, is dealt from a bag rather than rolled: a uniform
    // roll across three kinds will show you the same one three times running
    // often enough to undo the point of having three.
    s.crashIn -= dt;
    if (s.crashIn <= 0 && s.crashT <= 0) {
        const kind = deal(s, 'crash', CRASH_KINDS);
        s.crashKind = kind;
        s.crashT = CRASH_TIME[kind];
        s.dummyOut = false;
        s.talk = kind === 'wheelie' ? deal(s, 'wheelie', TALK_WHEELIE)
            : kind === 'banana' ? deal(s, 'banana', TALK_BANANA)
            : deal(s, 'crash-talk', TALK_CRASH);
        s.talkT = 1.5;
        const tx = clamp(s.px + s.gap * GAP_PX, s.px + 14, 302);
        addSpark(s, tx, laneY(s.thiefLane) - 6,
            kind === 'banana' ? '🍌' : kind === 'wheelie' ? '💥' : '🗑️');
        s.crashIn = (3.6 + rnd(s) * 3.6) * (1 - s.rattle / 400);
    }

    // The pacifier leaves him at the moment the tail sheet starts, not when the
    // crash does — it is the second beat of the gag and lands on its own.
    if (s.crashT > 0 && s.crashKind === 'banana' && !s.dummyOut && crashPhase(s) >= 0.45) {
        s.dummyOut = true;
        const tx = clamp(s.px + s.gap * GAP_PX, s.px + 14, 302);
        addSpark(s, tx - 4, laneY(s.thiefLane) - 4, '🍼');
        s.talk = deal(s, 'pacifier', TALK_PACIFIER);
        s.talkT = 1.8;
    }

    // And he throws his own garbage back at you, which becomes your problem.
    // He panics when you're on his wheel: drafting closes the gap for free
    // (see DRAFT_ACCEL), but the cost is that he starts flinging junk back at
    // you noticeably more often — the risk side of that mechanic.
    const panic = 1 + (1 - clamp(s.gap / 26, 0, 1)) * 0.7;
    s.throwIn -= dt * panic;
    if (s.throwIn <= 0) {
        spawnObstacle(s, JUNK, s.z + 48 + rnd(s) * 14, Math.round(s.thiefLane));
        s.talk = deal(s, 'throw', TALK_THROW);
        s.talkT = 1.2;
        s.throwIn = 5 + rnd(s) * 4.5;
    }

    s.talkT -= dt;
    if (s.talkT <= 0) {
        s.talk = deal(s, 'talk', TALK);
        s.talkT = 2.2 + rnd(s) * 2.4;
    }
}

function finish(s: RaceState, outcome: RaceOutcome) {
    s.outcome = outcome;
    s.endT = 1.7;
    s.shake = outcome === 'wipeout' ? 10 : 6;
    if (outcome === 'caught') { s.talk = pick(s, TALK_WIN); s.talkT = 4; }
}

/**
 * One fixed 1/60s step. Mutates `s`; returns nothing. Pure apart from the LCG
 * it carries, which is the point — a script can drive thousands of these.
 */
export function stepRace(s: RaceState, inp: RaceInput, dt: number): void {
    // Post-race: keep the wipeout / banner animation ticking, freeze the race.
    if (s.outcome) {
        s.endT = Math.max(0, s.endT - dt);
        s.wipe += dt;
        s.shake = Math.max(0, s.shake - dt * 22);
        stepSparks(s, dt);
        stepBursts(s.bursts, dt);
        return;
    }

    // Hitstop: a handful of frozen frames on a hard impact sells the weight of
    // a crash far better than shake alone. Nothing about the world advances
    // while it runs except the cosmetic shake/spark decay, so it costs
    // nothing in the physics anything else depends on.
    if (s.hitstop > 0) {
        s.hitstop = Math.max(0, s.hitstop - dt);
        s.shake = Math.max(0, s.shake - dt * 26);
        stepSparks(s, dt);
        stepBursts(s.bursts, dt);
        return;
    }

    s.t += dt;
    s.introT = Math.max(0, s.introT - dt);
    s.cool = Math.max(0, s.cool - dt);
    s.throwT = Math.max(0, s.throwT - dt);
    s.invT = Math.max(0, s.invT - dt);
    s.oilT = Math.max(0, s.oilT - dt);
    s.flashT = Math.max(0, s.flashT - dt);
    s.comboT = Math.max(0, s.comboT - dt);

    // --- drafting -----------------------------------------------------------
    // Second lever besides the tuck (see DRAFT_ACCEL above): close behind him,
    // roughly his lane, and his wake pulls you forward on top of whatever the
    // tuck is already doing. Reads last frame's gap/lane — both only move a
    // fraction of a metre per frame, so the one-frame lag is imperceptible and
    // it keeps this function's ordering simple (his lane for THIS frame isn't
    // known yet; stepThief runs after the street).
    const laneGapT = Math.abs(s.laneF - s.thiefLane);
    const draftPos = clamp(1 - s.gap / DRAFT_REACH, 0, 1);
    const draftLane = clamp(1 - laneGapT / DRAFT_LANES, 0, 1);
    s.draft = s.airT > 0 ? 0 : draftPos * draftLane;

    // --- momentum ---------------------------------------------------------
    // The hill accelerates you every single frame. Quadratic drag is what sets
    // the ceiling, so the tuck (less drag, more lean) genuinely raises top
    // speed rather than adding a flat bonus. There are no brakes on a stolen
    // trolley: carving, crashing and standing up are the only ways to slow.
    const tuck = inp.tuck && s.oilT <= 0 && s.airT <= 0;
    s.tucking = tuck;
    const pull = HILL_ACCEL * (tuck ? TUCK_GAIN : 1) + DRAFT_ACCEL * s.draft;
    const drag = tuck ? s.dragTuck : s.drag;
    s.speed += (pull - drag * s.speed * s.speed) * dt;
    s.speed = Math.max(3, s.speed);
    if (s.speed > s.topSpeed) s.topSpeed = s.speed;

    // --- handling ---------------------------------------------------------
    // Wobble is the risk side of the tuck: past the rig's threshold the thing
    // shimmies, steering goes soft and the deck starts choosing lanes for you.
    s.wob = clamp((s.speed - s.rig.wobbleAt * s.fitness) / 12, 0, 1);
    let steer = s.rig.steer * s.fitness;
    if (tuck) steer *= 0.42;                 // the trade-off, in one number
    steer *= 1 - s.wob * 0.45;
    if (s.oilT > 0) steer *= 0.18;           // oil = no steering at all
    if (s.airT > 0) steer *= 0.55;

    // Lanes are stacked up the screen, so the stick axis that moves you between
    // them is up/down. Steering a vertical row of lanes with left/right was the
    // original mapping and it fought the picture the whole time: the hand said
    // sideways and the eye said up. `left`/`right` are kept in the input shape
    // and read below as brake and drive, which is what a player reaching for
    // them on a downhill actually means.
    const dir = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (dir !== 0) {
        s.laneF += dir * steer * dt;
        if (s.airT <= 0) s.speed -= s.rig.carve * dt * (tuck ? 1.5 : 1);
    }
    if (s.wob > 0) s.laneF += (rnd(s) - 0.5) * s.wob * 3.6 * dt;
    s.laneF = clamp(s.laneF, 0, LANES - 1);

    // --- brake and drive ----------------------------------------------------
    //
    // Left scrubs speed, right leans on it. Both also move the rider along the
    // screen, and that is the point: the picture has to show what the control
    // did or the control may as well not exist. Driving forward buys you sight
    // of the road — the further up the screen you sit, the more street you can
    // read before it arrives — so committing is paid for in the one currency
    // this game actually trades in, which is reaction time.
    const drive = (inp.right ? 1 : 0) - (inp.left || inp.brake ? 1 : 0);
    if (drive < 0) {
        // Braking on oil does nothing, the same way steering on oil does
        // nothing. A slick should feel like a loss of authority, not a
        // slightly worse version of normal driving.
        s.speed -= (s.oilT > 0 ? 3 : 26) * dt;
    } else if (drive > 0 && s.airT <= 0) {
        s.speed += 5 * dt;
    }
    const wantX = drive > 0 ? PLAYER_X_FWD : drive < 0 ? PLAYER_X_BACK : PLAYER_X;
    const dx = wantX - s.px;
    s.px += clamp(dx, -DRIFT_RATE * dt, DRIFT_RATE * dt);

    // --- ollie ------------------------------------------------------------
    // The loudest half of the longboard branch. With a deck, `up` is a real
    // ollie that clears most street furniture and doubles your ramp airtime.
    // With a trolley, `up` is a man lifting a trolley by the handle: it clears
    // an oil slick, costs you speed, and is mostly there to be funny.
    if (inp.ollie && s.airT <= 0) {
        if (s.rig.canOllie) {
            launch(s, 0.55, true, false);
            s.speed -= 0.7;
            s.flash = 'OLLIE';
            s.flashT = 0.5;
        } else {
            launch(s, 0.2, false, false);
            s.speed -= 2.6;
            s.flash = 'trolleys do not jump';
            s.flashT = 0.9;
        }
    }
    if (s.airT > 0) {
        s.airT -= dt;
        const p = 1 - clamp(s.airT / s.airDur, 0, 1);
        s.airH = Math.sin(p * Math.PI) * (s.airBig ? 15 : 5);
        if (s.airT <= 0) land(s);
    }

    // --- weapons ----------------------------------------------------------
    if (inp.fire && s.cool <= 0) fire(s, inp.weapon || defaultWeaponId(s));
    stepShots(s, dt);

    // --- the street -------------------------------------------------------
    s.z += s.speed * dt;
    fillStreet(s);

    for (let i = s.obstacles.length - 1; i >= 0; i--) {
        const o = s.obstacles[i];
        // Traffic moves down the hill; oncoming traffic moves up it. Applied
        // before the culling test so a vehicle that has just gone past is
        // dropped on the same frame it leaves, and before the collision test so
        // the box you are checked against is the one that is drawn.
        if (o.def.vz) o.z += o.def.vz * dt;
        if (o.z < s.z - 20) { s.obstacles.splice(i, 1); continue; }
        // A vehicle that ran far enough ahead to be pointless is dropped too —
        // only reachable if a crash leaves you slower than the traffic.
        if (o.def.vz && o.z > s.z + SPAWN_AHEAD * 3) { s.obstacles.splice(i, 1); continue; }
        if (o.def.drift) {
            o.lane += o.dir * o.def.drift * dt;
            if (o.lane < 0 || o.lane > LANES - 1) { o.dir *= -1; o.lane = clamp(o.lane, 0, LANES - 1); }
        }

        // Near-miss tracking. Watch a zone a bit wider than the real hitbox
        // (`overlaps()` below) so a tight-but-clean dodge gets its closest
        // approach recorded before the obstacle scrolls off the back of the
        // screen. Ramps and oil aren't "dodged", so they don't count.
        if (!o.def.ramp && !o.def.oil && !o.evaluated) {
            const dz = Math.abs(o.z - s.z);
            if (dz < o.def.len + 2.6) {
                const lat = Math.abs(o.lane - s.laneF) - o.def.wide;
                if (lat < o.minLat) o.minLat = lat;
            } else if (o.z < s.z) {
                o.evaluated = true;
                if (!o.done && o.minLat < NEARMISS_LAT && o.minLat >= 0) nearMiss(s, o);
            }
        }

        if (o.done || !overlaps(s, o)) continue;

        if (o.def.ramp) {
            o.done = true;
            o.hit = true;
            // Everyone gets air off a ramp; only a board gets *useful* air.
            launch(s, s.rig.canOllie ? 0.78 : 0.42, s.rig.canOllie, true);
            s.flash = 'AIR';
            s.flashT = 0.6;
            continue;
        }
        if (o.def.oil) {
            if (s.airT > 0) continue;        // hop it and you're fine
            o.done = true;
            s.oilT = 1.1;
            s.speed *= 0.92;
            s.flash = 'OIL — no steering';
            s.flashT = 1;
            continue;
        }
        // Airborne clears: a hop gets over low stuff, an ollie gets over the
        // rest, and nothing gets you over a parked Camry.
        if (s.airT > 0 && (o.def.clear === 'hop' || (o.def.clear === 'ollie' && s.airBig))) {
            o.done = true;
            o.hit = true;
            continue;
        }
        o.done = true;
        crash(s, o);
    }

    // --- him --------------------------------------------------------------
    stepThief(s, dt);
    s.gap += (s.thiefSpeed - s.speed) * dt;

    stepSparks(s, dt);
    stepBursts(s.bursts, dt);
    s.shake = Math.max(0, s.shake - dt * 26);

    // --- endings ----------------------------------------------------------
    if (s.gap <= 0) finish(s, 'caught');
    else if (s.gap >= LOSE_GAP) finish(s, 'lost');
    else if (s.health <= 0) { s.health = 0; finish(s, 'wipeout'); }
    else if (s.z >= HILL_LENGTH) finish(s, 'flat');
}

function stepSparks(s: RaceState, dt: number) {
    for (let i = s.sparks.length - 1; i >= 0; i--) {
        const p = s.sparks[i];
        p.life -= dt;
        if (p.life <= 0) { s.sparks.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 180 * dt;
    }
}

// ---------------------------------------------------------------------------
// Rendering. Nothing here mutates the simulation.
// ---------------------------------------------------------------------------
/**
 * Two sky palettes, blended by how far down the hill you are (`hillT`). The
 * drop-in is a cool, hazy morning; the bottom of a 1900m descent is a hot,
 * dust-orange dusk. It's a cheap trick — the actual terrain never changes —
 * but a shifting sky sells "you have been riding downhill for a long time"
 * far better than any amount of extra parallax geometry would.
 */
const SKY_DAWN = ['#10203a', '#1b3357', '#2f4a6e', '#4a6483'];
const SKY_DUSK = ['#2a0f1e', '#5a1f2e', '#9a3a3a', '#e08a4a'];
/**
 * The valley floor the city stands on, far to near, dawn and dusk.
 *
 * These are the stops of a ramp, not three slabs. They were three slabs, on the
 * grounds that a smooth gradient would be the only soft thing on screen — true,
 * and the wrong conclusion from it. The answer to "a smooth ramp would look out
 * of place" is a dithered one, not a flat fill; see `ditherRamp`.
 */
const HAZE_DAWN = ['#3b4b63', '#334258', '#2b394d'];
const HAZE_DUSK = ['#5e4554', '#523a49', '#46313e'];
/** Where the sky stops and the valley floor starts, in game pixels. */
const HAZE_TOP = 58;
const HAZE_BOT = ROAD_TOP - 8;
/**
 * Flat steps in the sky and in the haze.
 *
 * Twelve across 58 rows is a step every five pixels, which is coarse enough to
 * read as drawn rather than as a smooth gradient and fine enough that the eye
 * does not count them. Nine across the 34 rows of the valley floor is the same
 * pitch. See `ditherRamp` for why it is stepped at all.
 */
const SKY_LEVELS = 12;
const HAZE_LEVELS = 9;

/**
 * The sky and the valley floor, drawn once and kept.
 *
 * Both are a pure function of `hillT` and both are dithered, which is a few
 * thousand one-pixel fills — fine once, not fine sixty times a second. So the
 * whole backdrop is rendered into an offscreen canvas and blitted, and rebuilt
 * only when `hillT` has moved a sixteenth of the way down the hill. Sixteen
 * steps over 1900m is a colour change roughly every two seconds and about one
 * unit per channel, which is below the point at which anything is visible.
 *
 * Falls back to drawing straight onto the target when there is no `document` —
 * a headless test has no canvas to cache into and does not care about the cost.
 */
const BACKDROP_STEPS = 16;
let bdCanvas: HTMLCanvasElement | null = null;
let bdCtx: Ctx | null = null;
let bdKey = -1;

const skyStops = (hillT: number) => [0, 1, 2, 3].map(i => lerpHex(SKY_DAWN[i], SKY_DUSK[i], hillT));

const paintSky = (c: Ctx, hillT: number) => {
    // Light at the horizon, dark at the top — which is what sky does, and the
    // reverse of nothing in particular, which is what four equal bands of flat
    // colour were doing.
    ditherRamp(c, 0, 0, W, HAZE_TOP, skyStops(hillT), SKY_LEVELS);
};

const paintHaze = (c: Ctx, hillT: number) => {
    // The valley floor: lighter where it meets the sky, darker as it comes
    // toward you, because air thins with proximity. The first stop is half the
    // sky's own horizon colour, so the ground emerges out of the haze instead
    // of starting at a hard line the eye reads as a shelf — which is what three
    // flat steps and a 0.4-alpha wash over the seam used to give.
    const haze = HAZE_DAWN.map((d, i) => lerpHex(d, HAZE_DUSK[i], hillT));
    ditherRamp(c, 0, HAZE_TOP, W, HAZE_BOT - HAZE_TOP + 1, [
        lerpHex(skyStops(hillT)[3], haze[0], 0.5), haze[0], haze[1], haze[2],
    ], HAZE_LEVELS);
};

/**
 * Blit rows `y0..y1` of the cached backdrop.
 *
 * Two calls, not one, because the far ridge and the sun belong between the sky
 * and the valley floor: the ridge's feet have to be buried in the haze or it
 * stands in front of the ground it is supposed to be behind.
 */
const backdrop = (ctx: Ctx, hillT: number, y0: number, y1: number) => {
    const paint = (c: Ctx, t: number) => { if (y0 === 0) paintSky(c, t); else paintHaze(c, t); };
    if (typeof document === 'undefined') { paint(ctx, hillT); return; }
    const key = Math.round(clamp(hillT, 0, 1) * BACKDROP_STEPS);
    // Re-made when the view widens, not only when it is missing: the cache is
    // as wide as the world was when it was built, and entering fullscreen makes
    // the world wider. A stale one tiles a 320px sky across a 389px screen and
    // leaves a bar of clear colour down the right-hand edge.
    if (!bdCanvas || bdCanvas.width < Math.ceil(W)) {
        bdCanvas = document.createElement('canvas');
        bdCanvas.width = Math.ceil(W);
        bdCanvas.height = HAZE_BOT + 1;
        bdCtx = bdCanvas.getContext('2d');
        bdKey = -1;
    }
    if (!bdCtx) { paint(ctx, hillT); return; }
    if (key !== bdKey) {
        bdKey = key;
        bdCtx.imageSmoothingEnabled = false;
        paintSky(bdCtx, key / BACKDROP_STEPS);
        paintHaze(bdCtx, key / BACKDROP_STEPS);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bdCanvas, 0, y0, W, y1 - y0, 0, y0, W, y1 - y0);
};
/** Base road tilt, radians; steepens slightly further down the hill. */
const TILT_BASE = 0.055;

/** Linear-interpolate two '#rrggbb' colours. Used for the sky and nothing
 * performance-sensitive, so a string return is fine. */
const drawTrolley = (ctx: Ctx, x: number, y: number, sc: number, main: string, roll: number, spin = 0) => {
    const w = 18 * sc, h = 10 * sc;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(roll);
    rect(ctx, -w / 2, -h - 3 * sc, w, h, main);
    // Wire mesh, because it's a trolley and that's the only thing that sells it.
    for (let i = 1; i < 4; i++) line(ctx, -w / 2 + (w / 4) * i, -h - 3 * sc, -w / 2 + (w / 4) * i, -3 * sc, PAL.line);
    line(ctx, -w / 2, -h / 2 - 3 * sc, w / 2, -h / 2 - 3 * sc, PAL.line);
    outline(ctx, -w / 2, -h - 3 * sc, w, h, PAL.faint);
    rect(ctx, w / 2 - 1, -h - 9 * sc, 2 * sc, 7 * sc, PAL.faint);   // handle
    // Wheels get a spinning spoke each — `spin` is speed-driven (see callers),
    // so the wheels visibly spin faster as you speed up.
    for (const wx of [-w / 2 + 3 * sc, w / 2 - 3 * sc]) {
        circle(ctx, wx, -1.5 * sc, 2 * sc, PAL.black);
        ctx.save();
        ctx.translate(wx, -1.5 * sc);
        ctx.rotate(spin);
        line(ctx, -1.6 * sc, 0, 1.6 * sc, 0, PAL.faint, 0.8);
        ctx.restore();
    }
    ctx.restore();
};

const drawBoard = (ctx: Ctx, x: number, y: number, sc: number, roll: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(roll);
    rect(ctx, -11 * sc, -3 * sc, 22 * sc, 2.4 * sc, PAL.violet);
    rect(ctx, -11 * sc, -3 * sc, 22 * sc, 0.8 * sc, PAL.accent);
    circle(ctx, -7 * sc, -0.6 * sc, 1.7 * sc, PAL.legend);
    circle(ctx, 7 * sc, -0.6 * sc, 1.7 * sc, PAL.legend);
    ctx.restore();
};

/**
 * Thrown AM/PM items get real pixel art wherever it exists (chancla, frisbee,
 * slushie, bureka, dog launcher — see data/sprites/items.ts). Anything
 * without a mapped sprite — chiefly the pocket-litter placeholder weapon —
 * falls back to its emoji glyph exactly as before, so nothing ever draws
 * blank. `px` is the desired final height in logical pixels; items are
 * authored feet-anchored like the rest of the sprite system, so we nudge the
 * draw point down by half that height to keep them visually centred while
 * they spin end over end.
 */
function drawItemSprite(ctx: Ctx, w: Weapon, x: number, y: number, px: number, elapsed: number, rotation: number, alpha = 1) {
    const def = spriteForItem(w.id);
    if (!def) { glyph(ctx, w.glyph, x, y, px, rotation, alpha); return; }
    const bakeScale = Math.max(1, Math.round(px / 16));
    const baked = bakeSprite(def, { scale: bakeScale });
    const frame = frameAt(baked, elapsed);
    drawSprite(ctx, baked, x, y + px / 2, frame, { alpha, rotation, scale: px / (16 * bakeScale) });
}

/** The stolen goods, as a real sprite instead of a floating emoji. */
function drawShoeBox(ctx: Ctx, x: number, y: number, px: number, elapsed: number, rotation: number) {
    const bakeScale = Math.max(1, Math.round(px / 14));
    const baked = bakeSprite(SPR_SHOE_BOX, { scale: bakeScale });
    const frame = frameAt(baked, elapsed);
    drawSprite(ctx, baked, x, y + px / 2, frame, { rotation, scale: px / (14 * bakeScale) });
}

const drawObstacle = (ctx: Ctx, o: Obs, x: number, y: number, sc: number, t: number) => {
    const d = o.def;
    if (d.ramp) {
        // Plywood wedge, drawn rather than glyphed so it reads as a ramp.
        ctx.fillStyle = o.hit ? PAL.legend : '#8a5a2b';
        ctx.beginPath();
        ctx.moveTo(x - 9 * sc, y);
        ctx.lineTo(x + 9 * sc, y);
        ctx.lineTo(x + 9 * sc, y - 9 * sc);
        ctx.closePath();
        ctx.fill();
        line(ctx, x - 9 * sc, y, x + 9 * sc, y - 9 * sc, PAL.warn);
        return;
    }
    if (d.oil) {
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#1b1024';
        ctx.beginPath();
        ctx.ellipse(x, y - 1, 13 * sc, 4 * sc, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (!art.sprite2(ctx, 'oil-slick', x, y, 7 * sc)) glyph(ctx, '🛢️', x + 10 * sc, y - 5 * sc, 8 * sc);
        return;
    }
    if (d.kind === 'car' || d.kind === 'traffic' || d.kind === 'oncoming') {
        shadow(ctx, x, y, 13 * sc, 4 * sc, 0.4);
        // Three vehicles dealt off the obstacle id, so a hill is lined with a
        // saloon, a van and the odd write-off rather than one Camry cloned four
        // hundred times. A write-off is only ever parked, for obvious reasons.
        const car = d.kind === 'car'
            ? ['car-sedan', 'car-van', 'car-wreck'][o.id % 3]
            // A taxi is only ever a moving one — nobody parks a cab and walks
            // off — and a write-off is only ever a parked one, for the same
            // reason in reverse. So the two lists differ by more than length.
            : ['car-sedan', 'car-taxi', 'car-van'][o.id % 3];
        // Art is drawn nose-right. Oncoming traffic is the same car mirrored,
        // which is also the first thing that tells you it is coming at you.
        const facing = (d.vz ?? 0) < 0;
        const ch = carHeight(car) * sc;
        const drew = art.sprite2(ctx, car, x, y, ch, { height: ch, flip: facing });

        // Lamps, and they are the whole point of this branch.
        //
        // At a glance on a dark road every vehicle is the same rectangle, and
        // the one thing you need to know before committing to a lane is which
        // way it is going. Red on the left edge means you are looking at the
        // back of something heading away; white on the left edge means
        // headlights, and it is about to be in your lap. A parked car gets
        // neither, so "unlit" reads as "not going anywhere".
        if (d.vz) {
            const lamp = facing ? '#fff3c4' : '#ff3b30';
            const lx = x - (facing ? 8 : 9) * sc;
            rect(ctx, lx, y - 7 * sc, 2.5 * sc, 2.5 * sc, lamp);
            if (facing) {
                // Headlight throw, down the road toward you.
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.16;
                ctx.beginPath();
                ctx.moveTo(lx, y - 6 * sc);
                ctx.lineTo(lx - 34 * sc, y - 11 * sc);
                ctx.lineTo(lx - 34 * sc, y + 4 * sc);
                ctx.closePath();
                ctx.fillStyle = lamp;
                ctx.fill();
                ctx.restore();
            }
        }
        if (drew) return;
        const body = d.kind === 'oncoming' ? '#c8a52d' : '#7b2f3a';
        const roof = d.kind === 'oncoming' ? '#e0bd48' : '#9c4250';
        rect(ctx, x - 12 * sc, y - 9 * sc, 24 * sc, 7 * sc, body);
        rect(ctx, x - 7 * sc, y - 13 * sc, 13 * sc, 4.5 * sc, roof);
        rect(ctx, x - 5 * sc, y - 12 * sc, 9 * sc, 3 * sc, '#22303f');
        circle(ctx, x - 7 * sc, y - 1.5 * sc, 2.4 * sc, PAL.black);
        circle(ctx, x + 7 * sc, y - 1.5 * sc, 2.4 * sc, PAL.black);
        return;
    }
    if (d.kind === 'door') {
        // Swings open right as you arrive. Every time.
        rect(ctx, x - 10 * sc, y - 8 * sc, 20 * sc, 6 * sc, '#2f4a6e');
        const swing = o.hit ? 1 : clamp(Math.sin(t * 2 + o.phase) * 0.5 + 0.7, 0, 1);
        ctx.save();
        ctx.translate(x - 8 * sc, y - 8 * sc);
        ctx.rotate(-swing * 0.9);
        rect(ctx, 0, -9 * sc, 3 * sc, 9 * sc, '#d8dde3');
        ctx.restore();
        // A three-frame swing, driven by how far open the door actually is, so
        // the art and the coded panel above it agree about the same moment.
        const doorN = art.frames('car-door-open');
        const doorF = Math.min(doorN - 1, Math.floor(swing * doorN));
        const dh = carHeight('car-door-open') * sc;
        if (!art.sprite2(ctx, 'car-door-open', x + 2 * sc, y, dh, { frame: doorF, height: dh })) {
            glyph(ctx, '🚪', x + 2 * sc, y - 12 * sc, 7 * sc, 0, 0.9);
        }
        return;
    }
    if (d.kind === 'bay') {
        if (art.sprite2(ctx, 'trolley-bay', x, y, 16 * sc)) {
            text(ctx, 'AM/PM', x, y - 18 * sc, { size: 5, color: PAL.warn, align: 'center' });
            return;
        }
        outline(ctx, x - 14 * sc, y - 14 * sc, 28 * sc, 14 * sc, PAL.warn, 1);
        for (let i = 0; i < 3; i++) drawTrolley(ctx, x - 8 * sc + i * 7 * sc, y - 2 * sc, sc * 0.7, PAL.dim, 0);
        text(ctx, 'AM/PM', x, y - 18 * sc, { size: 5, color: PAL.warn, align: 'center' });
        return;
    }
    shadow(ctx, x, y, 6 * sc, 2.4 * sc, 0.35);
    const bob = d.drift ? Math.sin(t * 6 + o.phase) * 1.4 : 0;
    // Delivered art when it exists, the emoji when it does not — the fallback
    // is the whole reason art can arrive one file at a time. `ART_ID` maps this
    // game's obstacle kinds onto the shared street asset ids.
    const id = ART_ID[d.kind] ?? d.kind;
    const n = art.frames(id);
    // Each sheet plays at its own rate — a stray dog does not trot at the same
    // speed a beacon blinks — and each instance is offset by a hash of its id
    // so a run of identical bins does not step in lockstep, which the eye picks
    // up instantly and reads as a rendering fault.
    const frame = anim.frameOf(id, t, n) + (anim.loops(id) ? anim.phaseOf(o.id, n) : 0);
    art.sprite(ctx, id, d.glyph, x, y + bob, 13 * sc, {
        frame,
        rotation: o.hit ? 1.2 : 0,
        height: (ART_H[d.kind] ?? 13) * sc,
    });
};

export function drawRace(ctx: Ctx, s: RaceState, thiefName: string) {
    // What the canvas actually handed us. Fixed inline; wider in fullscreen.
    W = viewWidth(ctx);
    const [sx, sy] = shakeOffset(s.shake);

    // How far down the 1900m hill you are, and how close to redline — both
    // drive the lighting, the camera and the speed FX below.
    const hillT = clamp(s.z / HILL_LENGTH, 0, 1);
    const spdFrac = clamp(s.speed / (s.rig.tuckTop * 1.05), 0, 1);
    // The catch cinematic (see the "him"/"box" sections below): 0 outside a
    // 'caught' ending, easing 0->1 over roughly the first second of it.
    const catchT = s.outcome === 'caught' ? clamp(s.wipe / 1.1, 0, 1) : 0;
    const catchEase = catchT * catchT * (3 - 2 * catchT);

    /**
     * How far the world has scrolled, in screen pixels.
     *
     * Every parallax layer is a fraction of this, and that is the point. The
     * skyline used to be handed `s.z * 26` while the road scrolled at
     * `s.z * PX_PER_M` — five px per metre — so the background moved 5.2x
     * faster than the tarmac under the wheels. Two things followed. The horizon
     * outran the foreground, which is backwards and is most of why a run felt
     * sickening; and the six delivered towers cycled past every two seconds at
     * cruise, which reads as one building on a loop rather than as a city.
     *
     * Deriving every layer from the same number as the road means the depth
     * ordering cannot drift again: a layer is further away exactly when its
     * fraction is smaller.
     */
    const WORLD = s.z * PX_PER_M;

    // --- sky — lighting changes across the descent -------------------------
    // A dithered ramp from the horizon up, not four flat bars. The old version
    // drew 26px slabs from y=0 down, which put the fourth and brightest colour
    // at y=78 — underneath the valley floor, where it was never once visible.
    // So the sky was two flat rectangles and a hard line between them, which is
    // exactly what it looked like.
    clear(ctx, W, H, lerpHex(SKY_DAWN[0], SKY_DUSK[0], hillT));
    backdrop(ctx, hillT, 0, HAZE_TOP);
    // The sun sinks and reddens as the hill goes on — the one cue that this
    // has been a long way down, even though the terrain loop never changes.
    const sunY = 18 + hillT * 44;
    const sunCol = lerpHex('#ffb347', '#ff5b3a', hillT);
    // The halo goes down first: a glow is light in the air, and light in the air
    // is behind the thing emitting it, not smeared over the front of it.
    glow(ctx, 268, sunY, 30 + hillT * 18, sunCol, 0.3);
    if (!art.sprite2(ctx, 'sun-low', 268, sunY + 14 + hillT * 6, 28 + hillT * 12)) {
        circle(ctx, 268, sunY, 12 + hillT * 6, sunCol);
    }

    // Far ridge, then the skyline, then palms: three speeds of parallax,
    // recoloured toward dusk along with the sky so the whole scene commits
    // to the same lighting change instead of just the strip at the top.
    const ridgeCol = lerpHex('#243a55', '#4a2f3f', hillT);
    const ridgeCol2 = lerpHex('#1d3049', '#3a2233', hillT);
    if (!art.tile(ctx, 'sky-hills', 0, 52, W, 24, WORLD * 0.05)) {
        band(ctx, 62, 12, W, WORLD * 0.05, 90, PAL.panel, (c, x, y) => {
            rect(c, x, y, 60, 14, ridgeCol);
            rect(c, x + 44, y - 6, 26, 20, ridgeCol2);
        });
    }

    // Ground for the city to stand on.
    //
    // The skyline bands have ground lines at y=62..74 (see `skyline.ts`) and
    // the verge starts at ROAD_TOP-8, so without this there are eighteen pixels
    // of open sky under the buildings and the whole city hangs in the air. This
    // is the flat of the valley between the hill you are on and the one they
    // are on, drawn as a dithered ramp rather than the three flat steps it used
    // to be, so it reads as ground receding into haze instead of as a wall.
    backdrop(ctx, hillT, HAZE_TOP, HAZE_BOT + 1);

    // The delivered skyline kit assembles a horizon that does not repeat; the
    // coded band below is the fallback for before it arrives. See `skyline.ts`
    // for why a kit beats a tiling strip.
    // `fog` is what turns the atmospheric correction from alpha into a tint:
    // buildings stay opaque and shift toward the air's colour, instead of going
    // see-through and letting the sky's dither show straight through a tower.
    if (!art.drawSkyline(ctx, WORLD, W, { fog: lerpHex(HAZE_DAWN[0], HAZE_DUSK[0], hillT) })) {
        // No kit yet: the flat horizon strips delivered before it, and only
        // then the coded band. Not drawn behind the kit as well — a strip
        // repeats its whole contents every screen width, which is the thing the
        // kit exists to avoid, and having both on screen is worse than either.
        art.tile(ctx, 'sky-towers', 0, 34, W, 40, WORLD * 0.10);
        art.sprite2(ctx, 'sky-watertower', ((80 - WORLD * 0.12) % 440 + 440) % 440 - 60, 74, 26);
        art.sprite2(ctx, 'sky-billboard', ((300 - WORLD * 0.13) % 540 + 540) % 540 - 70, 72, 20);
        if (!art.tile(ctx, 'sky-lowrise', 0, 56, W, 26, WORLD * 0.20)) {
            band(ctx, 62, 40, W, WORLD * 0.20, 54, PAL.panel, (c, x, y) => {
                rect(c, x, y + 6, 20, 36, '#16202e');
                rect(c, x + 24, y - 4, 14, 46, '#101923');
                rect(c, x + 41, y + 12, 11, 30, '#18222f');
                for (let wy = 0; wy < 4; wy++) rect(c, x + 3, y + 10 + wy * 7, 3, 3, wy % 2 ? '#2a3a4d' : PAL.warn);
            });
        }
    }
    // The neighbourhood between the skyline and the kerb.
    //
    // Without this the band from the city's ground line down to the verge is
    // thirty pixels of empty haze, which is what "there's no place with other
    // stuff in the background" meant: you descend a hill through a city and
    // pass nothing but a horizon and some palms. These are the far-row house
    // facades from the shared street set, standing on the middle haze step,
    // scrolling between the skyline and the trees so the depth reads.
    //
    // Three house drawings, mirrored on alternate slots, at two heights, with a
    // gap every fourth slot — six silhouettes and a rhythm, from three files.
    //
    // And every seventh slot, one of the skyline kit's buildings, up close.
    //
    // Those pieces were drawn as close-range art: around fifty colours each and
    // a luminance spread of 104 to 192, against a sky that sits at 48 to 70.
    // Nothing at two kilometres looks like that — air flattens contrast, which
    // is why a real skyline is nearly a silhouette. They were never going to
    // work at the back, and burning them off at twenty percent opacity to force
    // it would waste the only genuinely detailed buildings in the set. Up here,
    // at the depth the detail actually belongs to, they read as the office
    // blocks and walk-ups a residential street backs onto.
    //
    // Every seventh slot, not every second: at cruise this band moves a slot
    // every 0.74s, so a tower comes past about every five seconds.
    const hoodScroll = WORLD * 0.46;
    band(ctx, 88, 0, W, hoodScroll, 58, PAL.panel, (c, x, y) => {
        const slot = Math.floor((x + hoodScroll) / 58);
        const cycle = ((slot % 7) + 7) % 7;
        if (cycle === 3) return;                      // a gap between properties

        if (cycle === 6) {
            // A block among the houses. Drawn from its own ground line so it
            // stands on the same line they do, and taller than all of them,
            // which is what makes it read as a building rather than a big shed.
            const tall = ((slot / 7) | 0) % 2 === 0;
            const id = tall
                ? BLOCK_TALL[Math.abs(slot >> 3) % BLOCK_TALL.length]
                : BLOCK_WIDE[Math.abs(slot >> 3) % BLOCK_WIDE.length];
            const bw = tall ? 34 : 54;
            const bh = tall ? 58 : 40;
            art.panel(c, id, x, y - bh, bw, bh, { flip: slot % 2 === 1, alpha: 0.9 });
            return;
        }

        const id = HOOD_ART[cycle % HOOD_ART.length];
        const w = 46 + (slot % 2) * 8;
        const h = 22 + (((slot * 7) % 3) * 5);
        // Ground line at the bottom for the far row: these are across the
        // valley from you, so the wall rises up-screen away from the camera.
        art.panel(c, id, x, y - h, w, h, { flip: slot % 2 === 1, alpha: 0.82 });
    });
    // A breeze-block wall along the top of the verge, which is what is actually
    // between a Los Angeles street and the yards behind it.
    art.tile(ctx, 'wall-breeze', -50, ROAD_TOP - 20, W + 100, 12, WORLD * 0.8);

    // The neighbourhood, on the far pavement, going about its evening.
    //
    // This band used to be `tiny-bicycle` and nothing else, one sprite every
    // 213 units for the length of the hill; reading that as "the same guy on a
    // bike over and over" was not a misreading, it was a description. So the
    // pitch is halved and it deals from the shared cast instead.
    const bikeScroll = WORLD * 0.93;
    band(ctx, ROAD_TOP - 9, 0, W + 60, bikeScroll, 104, PAL.line, (c, x, y) => {
        const slot = Math.floor((x + bikeScroll) / 104);
        // Who lives in this slot, and whether they react to you being alongside.
        // Shared with Pizza Run — see `engine/streetCast.ts`.
        const who = castAt(slot, s.px, x);
        const n = art.frames(who.id);
        // The cyclist pedals at the speed the ground is passing; everyone else
        // is doing their own thing at their own pace. See `engine/streetAnim.ts`.
        const rate = who.id === 'tiny-bicycle'
            ? anim.cycleRate(n, s.speed * 0.93, 26)
            : undefined;
        if (!art.sprite2(c, who.id, x, y, who.h, {
            frame: anim.frameOf(who.id, s.t, n, rate) + anim.phaseOf(slot, n),
            alpha: 0.9,
        })) {
            glyph(c, who.glyph, x, y - who.h, who.h);
        }
    });

    // Palms. Three kinds dealt off the slot index so a run of them is not one
    // tree repeated — the same reason the skyline deals from a kit. One slot in
    // three gets the sway sheet, and its fronds are offset by the slot so the
    // whole avenue does not breathe in unison.
    const palmScroll = WORLD * 0.88;
    const swayN = art.frames('palm-sway');
    band(ctx, 60, 40, W, palmScroll, 88, PAL.panel, (c, x, y) => {
        const slot = Math.floor((x + palmScroll) / 88);
        const kind = ((slot % 3) + 3) % 3;
        const id = kind === 1 ? 'palm-short' : kind === 2 ? 'palm-sway' : 'palm-tall';
        const h = kind === 1 ? 26 : 44;
        const frame = kind === 2
            ? anim.frameOf('palm-sway', s.t, swayN) + anim.phaseOf(slot, swayN)
            : 0;
        if (!art.sprite2(c, id, x + 7, y + 42, h, { frame })) {
            rect(c, x + 6, y + 8, 2, 34, '#2a3a2a');
            glyph(c, '🌴', x + 7, y + 6, 15);
        }
    });
    // Wildlife on the far verge: a cat that bolts as you come past, a flock
    // that goes up. Keyed to where the player actually is on screen, so it
    // reads as a reaction rather than a loop that happens to be playing.
    band(ctx, 92, 8, W, WORLD * 0.96, 171, PAL.panel, (c, x, y) => {
        const slot = Math.floor((x + WORLD * 0.96) / 171);
        const near = Math.abs(x - s.px) < 52;
        const cat = ((slot % 2) + 2) % 2 === 0;
        const id = cat ? (near ? 'cat-dart' : 'cat-street') : 'pigeon-flock';
        const n = art.frames(id);
        art.sprite2(c, id, x, y + 8, cat ? 8 : 7, {
            frame: anim.frameOf(id, cat || near ? s.t : 0, n) + anim.phaseOf(slot, n),
        });
        if (!cat && near) {
            art.sprite2(c, 'feather-puff', x + 6, y + 6, 6, {
                frame: anim.frameOf('feather-puff', s.t, art.frames('feather-puff')),
            });
        }
    });
    // Weather: a thin scatter of dust/haze drifting across the mid-ground,
    // plus the odd gull riding the thermals. Purely decorative — derived from
    // s.t/s.z each frame, so it costs no sim state at all.
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 10; i++) {
        const wx = (((i * 53.7) - s.z * (0.4 + (i % 4) * 0.2)) % (W + 30) + (W + 30)) % (W + 30) - 15;
        const wy = 34 + ((i * 17) % 50) + Math.sin(s.t * 0.7 + i) * 3;
        rect(ctx, wx, wy, 1.3, 1.3, PAL.dim);
    }
    ctx.restore();
    band(ctx, 44, 14, W, WORLD * 0.26, 150, PAL.panel, (c, x, y) => {
        const gy = y + Math.sin(s.t * 2.4) * 2;
        if (!art.sprite2(c, 'gull', x, gy, 6, { frame: anim.frameOf('gull', s.t, art.frames('gull')), alpha: 0.55 })) {
            glyph(c, '🕊️', x, gy, 6, Math.sin(s.t * 2.4) * 0.1, 0.55);
        }
    });

    // --- the hill -----------------------------------------------------------
    // FOV pull: the world scales up slightly as you approach top speed (and a
    // little more while drafting/at the catch), so the whole frame communicates
    // "faster" instead of just the HUD number. The road also steepens a touch
    // further down the hill so a 1900m descent visibly reads as one.
    const zoom = 1 + spdFrac * 0.06 + s.draft * 0.03 + catchEase * 0.3;
    const tilt = TILT_BASE + hillT * 0.02;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.translate(W / 2, ROAD_TOP);
    ctx.rotate(tilt);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -ROAD_TOP);

    // Verge: grass, then the pavement slabs, then the things standing on them.
    rect(ctx, -50, ROAD_TOP - 8, W + 100, 8, '#3b3f34');                  // verge
    art.tile(ctx, 'grass-verge', -50, ROAD_TOP - 14, W + 100, 6, WORLD);
    art.tile(ctx, 'pavement', -50, ROAD_TOP - 8, W + 100, 8, WORLD);
    band(ctx, ROAD_TOP - 8, 8, W + 60, WORLD, 34, PAL.line, (c, x, y) => {
        rect(c, x - 30, y - 2, 3, 10, PAL.faint);
        if (!art.sprite2(c, 'bin-wheelie', x - 12, y + 5, 12, { alpha: 0.85 })) {
            glyph(c, '🗑️', x - 12, y + 1, 8, 0, 0.85);
        }
    });
    // Roadside dressing at a wider pitch than the bins, dealt off the slot so
    // a descent passes a sequence of things rather than one thing repeatedly.
    band(ctx, ROAD_TOP - 8, 8, W + 60, WORLD, 129, PAL.line, (c, x, y) => {
        const slot = Math.floor((x + WORLD) / 129);
        const kind = ((slot % 5) + 5) % 5;
        if (kind === 0) art.tile(c, 'fence-picket', x - 30, y - 10, 72, 10);
        else if (kind === 1) art.tile(c, 'hedge-low', x - 30, y - 9, 72, 9);
        else if (kind === 2) art.sprite2(c, 'tree-street', x, y + 8, 26);
        else if (kind === 3) art.sprite2(c, 'streetlight', x + 10, y + 8, 32);
        else {
            // One hydrant in three has already been opened by somebody. It is
            // that kind of street, and it is a use for the animated sheet.
            const blown = ((slot / 5) | 0) % 3 === 1;
            const hy = blown ? 'hydrant-blown' : 'hydrant';
            const hn = art.frames(hy);
            art.sprite2(c, hy, x + 6, y + 8, blown ? 11 : 8, {
                frame: anim.frameOf(hy, s.t, hn) + anim.phaseOf(slot, hn),
            });
            art.sprite2(c, 'mailbox', x + 34, y + 8, 8);
        }
    });
    if (art.tile(ctx, 'road-asphalt', -50, ROAD_TOP, W + 100, H + 50 - ROAD_TOP, WORLD)) {
        // The delivered tarmac is lit for daylight and this is a descent into
        // dusk, so it is knocked back toward the sky's own colour, harder the
        // further down the hill you are. Without it the road is the brightest
        // thing on screen and both riders sink into it.
        //
        // Graded, not flat. Light falls off with distance, so the far end of the
        // road takes more of the knock-back than the tarmac under your own
        // wheels — which is the whole of the depth cue a road this shallow can
        // carry. This one is a smooth gradient rather than a dithered ramp
        // because it modulates an already-textured surface: there is no flat
        // field here for it to band across.
        const knock = lerpHex('#141b26', '#2a1420', hillT);
        const a = 0.34 + hillT * 0.16;
        const g = ctx.createLinearGradient(0, ROAD_TOP, 0, H + 50);
        g.addColorStop(0, withAlpha(knock, Math.min(1, a * 1.35)));
        g.addColorStop(1, withAlpha(knock, a * 0.62));
        ctx.save();
        ctx.fillStyle = g;
        ctx.fillRect(-50, ROAD_TOP, W + 100, H + 50 - ROAD_TOP);
        ctx.restore();
    } else {
        rect(ctx, -50, ROAD_TOP, W + 100, H + 50 - ROAD_TOP, '#20242b');  // asphalt
    }
    if (!art.tile(ctx, 'kerb', -50, ROAD_TOP - 1, W + 100, 5, WORLD)) {
        rect(ctx, -50, ROAD_TOP, W + 100, 2, '#2e343d');                  // kerb lip
    }
    // Wear in the tarmac. Sparse, scrolling with the road, behind everything
    // that drives on it.
    band(ctx, ROAD_TOP + 4, 6, W + 60, WORLD, 163, PAL.faint, (c, x, y) => {
        art.sprite2(c, 'road-crack', x - 30, y + 7, 7, { alpha: 0.7 });
        art.sprite2(c, 'manhole', x + 52, y + 7, 5);
        art.sprite2(c, 'drain-grate', x + 108, y + 7, 4);
    });
    band(ctx, H - 22, 6, W + 60, WORLD, 197, PAL.faint, (c, x, y) => {
        art.sprite2(c, 'skid-mark', x - 20, y + 7, 5, { alpha: 0.5 });
    });

    // Lane markings. Scrolling these at the real speed is most of the
    // sensation of speed at low velocity.
    for (let l = 1; l < LANES; l++) {
        const y = laneY(l) - LANE_H / 2;
        if (art.tile(ctx, 'road-centreline', -50, y - 1.5, W + 100, 3, WORLD)) continue;
        band(ctx, y, 2, W + 60, WORLD, 26, PAL.faint, (c, x, yy) => {
            rect(c, x - 30, yy, 12, 1.6, '#4a535e');
        });
    }
    if (!art.tile(ctx, 'road-edgeline', -50, H - 4, W + 100, 2, WORLD)) {
        band(ctx, H - 4, 4, W + 60, WORLD, 40, PAL.faint, (c, x, y) => {
            rect(c, x - 30, y, 20, 3, '#39414b');
        });
    }

    // --- obstacles (far lanes first so nearer things overlap them) --------
    const sorted = s.obstacles.slice().sort((a, b) => a.lane - b.lane);
    for (const o of sorted) {
        const x = s.px + (o.z - s.z) * PX_PER_M;
        if (x < -40 || x > W + 46) continue;
        drawObstacle(ctx, o, x, laneY(o.lane), laneScale(o.lane), s.t);
    }

    // --- him ----------------------------------------------------------------
    // During the catch cinematic he eases in alongside the player instead of
    // sitting at the frozen gap distance — a real "you pull level with him"
    // moment instead of the number just hitting zero off-screen.
    let tx = clamp(s.px + s.gap * GAP_PX, s.px + 14, 302);
    if (catchT > 0) tx = tx + (s.px + 20 - tx) * catchEase;
    const ty = laneY(s.thiefLane);
    const tsc = laneScale(s.thiefLane);
    const rattled = s.thiefStun > 0 || s.crashT > 0;
    const lurch = Math.sin(s.t * 7) * 0.09 + (rattled ? Math.sin(s.t * 30) * 0.22 : 0);
    // Drafting feedback: a faint slipstream trailing off his wheels toward the
    // player whenever the wake is actually reaching you (see DRAFT_ACCEL).
    if (s.draft > 0.04) {
        ctx.save();
        ctx.globalAlpha = s.draft * 0.5;
        for (let i = 0; i < 3; i++) {
            const yy = ty - (3 + i * 2) * tsc;
            line(ctx, tx - 8 * tsc, yy, tx - (18 + i * 6) * tsc, yy, PAL.accent, 1.3);
        }
        ctx.restore();
    }
    if (art.has(bikeState(s))) {
        art.sprite(ctx, bikeState(s), '', tx, ty + 2 * tsc, RIDER_H * tsc, {
            frame: bikeFrame(s),
            height: RIDER_H * tsc,
        });
    } else {
        drawTrolley(ctx, tx, ty, tsc * 1.05, '#6b3340', lurch, s.t * (4 + s.thiefSpeed * 0.5));
        actor(ctx, 'the-game', tx - 2 * tsc, ty - 7 * tsc, {
            height: 25 * tsc, facing: 1,
            stride: s.t * 2,
            armUp: rattled ? 1 : 0.35,
            crouch: s.crashT > 0,
            hurt: s.thiefStun > 0.35 || s.crashT > 0.35,
            kit: KIT.rival,
        });
    }
    // The box: floats above his head normally, and hands off to the player
    // during the second half of the catch cinematic below (see "you").
    const boxBob = Math.sin(s.t * 5) * 0.3;
    const handT = catchT > 0 ? clamp((catchT - 0.35) / 0.65, 0, 1) : 0;
    const handEase = handT * handT * (3 - 2 * handT);

    // --- you ------------------------------------------------------------
    const py = laneY(s.laneF);
    const psc = laneScale(s.laneF);
    const wipe = s.outcome === 'wipeout' ? Math.min(1.6, s.wipe * 2.4) : 0;

    // The board goes one way and you go the other.
    //
    // A wipeout used to leave the rider on the tarmac with his deck apparently
    // still under him, because the fall sheet is a person and the board was
    // only ever drawn by the coded rig. `longboard` is four frames of a loose
    // deck; this sends it skidding off ahead, spinning down to a stop, which is
    // the last thing that actually happens in a crash and the first thing you
    // look for.
    if (s.outcome === 'wipeout' && s.hasBoard) {
        // Ballistic, with drag: quick at first, then it runs out. Purely a
        // function of `s.wipe`, so there is no state to carry and it replays
        // identically.
        const t = Math.min(s.wipe, 2.4);
        const slide = 54 * (1 - Math.exp(-t * 1.6));
        const deckN = art.frames('longboard');
        // Tumbling fast while it is in the air, settling as it loses speed.
        const spin = Math.floor(t * 18 * Math.exp(-t * 0.9));
        art.sprite2(ctx, 'longboard', s.px + slide, laneY(s.laneF) + 1, 5, {
            frame: spin % Math.max(1, deckN),
            rotation: Math.sin(t * 7) * 0.5 * Math.exp(-t * 1.4),
            alpha: 0.95,
        });
    }

    ctx.save();
    if (wipe > 0) {
        ctx.translate(s.px, py);
        ctx.rotate(wipe * 1.5);
        ctx.translate(-s.px, -py);
    }
    if (s.airH > 1) shadow(ctx, s.px, py + 1, 9 * psc, 3 * psc, 0.3);
    const ry = py - s.airH;
    const roll = s.wob * Math.sin(s.t * 26) * 0.07;
    // Delivered rider art when it exists, the coded rig when it does not.
    // `art.has` rather than a try/fail so the two paths stay obviously separate
    // — the coded one still draws its own board and figure, which is not
    // something a fallback inside `sprite` could do.
    const boardArt = s.hasBoard && art.has(boardState(s));
    if (boardArt) {
        art.sprite(ctx, boardState(s), '', s.px, ry + 2 * psc, RIDER_H * psc, {
            frame: boardFrame(s),
            height: RIDER_H * psc,
        });
    } else {
        if (s.hasBoard) drawBoard(ctx, s.px, ry, psc, roll);
        else drawTrolley(ctx, s.px, ry, psc, '#3d4a58', roll, s.t * (4 + s.speed * 0.5));
        actor(ctx, 'player', s.px, ry - (s.hasBoard ? 3 : 7) * psc, {
            height: 26 * psc, facing: 1,
            stride: s.t * 2.4,
            armUp: s.cool > 0.2 || handEase > 0.6 ? 1 : 0,
            crouch: s.tucking,
            hurt: s.invT > 0.45,
            kit: KIT.player,
        });
    }
    ctx.restore();

    // The box hand-off, drawn after both riders so it reads as passing
    // between them. Below handT=0 it just floats over his head as normal.
    {
        const bx = (tx - 8 * tsc) + (PLAYER_X - (tx - 8 * tsc)) * handEase;
        const by = (ty - 26 * tsc) + ((py - (s.hasBoard ? 22 : 26) * psc) - (ty - 26 * tsc)) * handEase;
        drawShoeBox(ctx, bx, by, (11 * tsc) + (9 * psc - 11 * tsc) * handEase, s.t, boxBob * (1 - handEase));
        if (handEase > 0.75) {
            text(ctx, 'GOT IT', (bx + PLAYER_X) / 2, by - 15, { size: 8, color: PAL.legend, align: 'center', bold: true });
        }
    }

    // --- projectiles ------------------------------------------------------
    for (const sh of s.shots) {
        const w = s.weapons[sh.wid];
        if (!w) continue;
        const x = PLAYER_X + sh.travel * GAP_PX;
        const arc = Math.sin(clamp(sh.travel / Math.max(1, s.gap), 0, 1) * Math.PI) * 12;
        // The delivered tumble sheet for this class of item, if there is one;
        // the coded sprite otherwise. Both spin — this one has real frames.
        const flyId = throwState(w.id).replace('skateboard-throw-', 'throw-');
        const flyN = art.frames(flyId);
        const fy = laneY(sh.lane) - 10 - arc;
        if (!art.sprite2(ctx, flyId, x, fy + 6, 13, {
            frame: anim.frameOf(flyId, sh.travel * 0.18, flyN),
        })) {
            drawItemSprite(ctx, w, x, fy, 13, s.t, sh.spin * (sh.back ? -1 : 1));
        }
    }

    // Drawn one-shot effects — dust off a landing, a star of impact. These sit
    // in front of the actors, because they are what just happened to them.
    for (const b of s.bursts) {
        art.sprite2(ctx, b.id, b.x, b.y, b.size, {
            frame: anim.frameOf(b.id, b.t, art.frames(b.id)),
        });
    }
    for (const p of s.sparks) glyph(ctx, p.ch, p.x, p.y, 9, 0, clamp(p.life * 2, 0, 1));
    ctx.restore();

    // --- speed FX -----------------------------------------------------------
    // Motion blur on the tarmac, and nothing else.
    //
    // This used to fan near-white lines out of a vanishing point above the
    // road, sliding sideways at a fixed 240px/s that had no relationship to how
    // fast you were actually going. Over a road already scrolling at its own
    // rate, that is two contradictory motions on one surface: it read as
    // scratches on the screen rather than as speed, which is exactly how it was
    // described — "weird super distracting white lines, no clue what that is".
    //
    // So: streaks that lie along the direction of travel, scroll with the world
    // at the world's own rate, and only appear near the top of the rig's range.
    // The road texture and the lane markings were always doing most of the work
    // of selling speed; this is a garnish on top of them, not a layer of its
    // own. Faint on purpose — if you can pick out an individual line, it is too
    // strong.
    const fxDrive = clamp((spdFrac - 0.72) / 0.28, 0, 1);
    if (fxDrive > 0.02) {
        ctx.save();
        ctx.translate(sx, sy);
        const n = 3 + Math.round(fxDrive * 4);
        for (let i = 0; i < n; i++) {
            // Anchored to world scroll, so a streak sits on the road and runs
            // off the left edge with everything else on it.
            const lane = i % LANES;
            const y = laneY(lane) + ((i * 37) % 9) - 4;
            const x0 = (((i * 113) - WORLD * 1.6) % (W + 120) + (W + 120)) % (W + 120) - 60;
            const len = 14 + fxDrive * 26;
            ctx.globalAlpha = fxDrive * 0.16;
            ctx.strokeStyle = spdFrac > 0.92 ? PAL.accent2 : PAL.ink;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x0, y);
            ctx.lineTo(x0 - len, y);
            ctx.stroke();
        }
        ctx.restore();
    }
    // Chromatic fringe at max velocity: a thin red/cyan glow at the screen
    // edges, 'screen'-blended so it never just looks like a tinted border.
    if (spdFrac > 0.55) {
        const fringe = (spdFrac - 0.55) / 0.45;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = fringe * 0.28;
        rect(ctx, 0, ROAD_TOP, 3, H - ROAD_TOP, '#ff3355');
        rect(ctx, W - 3, ROAD_TOP, 3, H - ROAD_TOP, '#33d9ff');
        ctx.restore();
    }

    // --- his mouth --------------------------------------------------------
    if (s.talkT > 0 && s.talk) {
        // He is not always talking. Some of it is shouted, and it was all
        // drawn at the same 6px whisper — which is why 'MY MIXTAPE!' mid-crash
        // read the same as him musing about Palmdale.
        //
        // The tell is already in the content: the lines written as shouts are
        // the ones written in capitals. So rather than tag each one, read it
        // off the string — a line with no lowercase letters in it is a line
        // being yelled.
        const shout = !/[a-z]/.test(s.talk);
        const size = shout ? 9 : 6;
        const per = shout ? 6.2 : 4.4;
        const h = shout ? 17 : 12;
        const bx = clamp(tx, 46, W - 46);
        const by = ty - (shout ? 42 : 38);
        // Capped against the view rather than against 320: on a widened screen
        // there is more room, and a shout is exactly the line that wants it.
        const tw = Math.min(W * 0.62, s.talk.length * per + 10);
        rect(ctx, bx - tw / 2, by - h / 2, tw, h, 'rgba(4,6,10,0.85)');
        outline(ctx, bx - tw / 2, by - h / 2, tw, h, shout ? PAL.accent : PAL.accent2);
        text(ctx, s.talk, bx, by + (shout ? 3 : 3) - 6, {
            size, color: shout ? PAL.accent : PAL.accent2, align: 'center',
        });
    }

    // --- HUD --------------------------------------------------------------
    rect(ctx, 0, 0, W, 22, 'rgba(4,6,10,0.72)');

    // The gap meter is the whole game, so it gets the width.
    text(ctx, 'GAP', 5, 3, { size: 6, color: PAL.dim });
    const gp = 1 - clamp(s.gap / LOSE_GAP, 0, 1);
    bar(ctx, 25, 3, 120, 6, gp, s.gap < 40 ? PAL.ok : s.gap > 180 ? PAL.bad : PAL.accent);
    line(ctx, 25 + 120 * (1 - START_GAP / LOSE_GAP), 2, 25 + 120 * (1 - START_GAP / LOSE_GAP), 10, PAL.faint);
    text(ctx, `${Math.round(s.gap)}m`, 148, 3, { size: 6, color: PAL.ink });

    text(ctx, 'HILL', 5, 12, { size: 6, color: PAL.dim });
    bar(ctx, 25, 12, 120, 4, clamp(s.z / HILL_LENGTH, 0, 1), PAL.warn);
    text(ctx, `${Math.max(0, Math.round((HILL_LENGTH - s.z)))}m`, 148, 12, { size: 6, color: PAL.dim });

    // Rig readout — you should never have to guess what you're riding.
    glyph(ctx, s.rig.glyph, 188, 7, 10);
    text(ctx, s.rig.label.toUpperCase(), 196, 3, { size: 6, color: s.hasBoard ? PAL.accent : PAL.warn });
    text(ctx, `${Math.round(s.speed * 2.2)} MPH${s.tucking ? '  TUCK' : ''}${s.draft > 0.3 ? '  DRAFT' : ''}`, 196, 12, {
        size: 6, color: s.wob > 0.6 ? PAL.bad : PAL.dim,
    });

    bar(ctx, W - 42, 3, 38, 5, s.health / 100, s.health > 35 ? PAL.ok : PAL.bad);
    text(ctx, `HP ${Math.max(0, Math.round(s.health))}`, W - 42, 12, { size: 6, color: PAL.dim });

    if (s.wob > 0.55) text(ctx, 'SPEED WOBBLE', W / 2, 26, { size: 7, color: PAL.bad, align: 'center' });
    // The near-miss / combo callout and the ordinary flash share one line —
    // whichever is live; nearMiss() and crash() never set flash in the same
    // frame, so there's never a conflict to arbitrate.
    if (s.flashT > 0) {
        const hot = s.flash.startsWith('CLOSE');
        text(ctx, s.flash.toUpperCase(), W / 2, H - 12, { size: hot ? 8 : 7, color: hot ? PAL.accent : PAL.legend, align: 'center' });
    }

    // --- banners ----------------------------------------------------------
    if (s.introT > 0) {
        const a = clamp(s.introT / 0.6, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        banner(ctx, s.hasBoard ? 'LONGBOARD' : 'NO BOARD', W, 62, s.hasBoard ? PAL.accent : PAL.warn, 22);
        text(ctx, s.rig.note, W / 2, 80, { size: 7, color: PAL.ink, align: 'center' });
        text(ctx, `${thiefName} has your box. Get it back.`, W / 2, 90, { size: 6, color: PAL.dim, align: 'center' });
        ctx.restore();
    }
    // Endings hold back their banner text until the cinematic beat (box
    // hand-off / wipeout dust) has had a moment on its own, rather than
    // slapping text over the action the instant the outcome resolves.
    if (s.outcome === 'caught' && catchT > 0.55) banner(ctx, 'CAUGHT HIM!', W, 64, PAL.ok, 26);
    if (s.outcome === 'lost') banner(ctx, "HE'S GONE", W, 64, PAL.bad, 26);
    if (s.outcome === 'flat') banner(ctx, 'OUT OF HILL', W, 64, PAL.bad, 24);
    if (s.outcome === 'wipeout') {
        // A real wipeout instead of a banner over an unchanged frame: a dust
        // cloud punches out from the impact point, the sky goes bloody for a
        // beat, and the banner only lands once that's had a moment to read.
        const p = clamp(s.wipe / 1.2, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.3 * clamp(s.wipe * 1.6, 0, 1) * (1 - p * 0.4);
        rect(ctx, 0, 0, W, H, '#4a0000');
        ctx.restore();
        for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2 + s.wipe * 1.5;
            const r = 6 + p * 30;
            glyph(ctx, '💨', PLAYER_X + Math.cos(ang) * r, laneY(s.laneF) - 10 + Math.sin(ang) * r * 0.4, 10, 0, 1 - p * 0.6);
        }
        if (p > 0.35) banner(ctx, 'WIPEOUT', W, 64, PAL.bad, 26);
        glyph(ctx, '💥', PLAYER_X + 6, laneY(s.laneF) - 10, 18 + Math.min(10, s.wipe * 9));
    }

    // Hitstop punch: a bright single-frame flash right as an impact freezes
    // the world (see the hitstop check in stepRace) is most of what sells the
    // weight of a hit — cheap, and it costs nothing physics-side.
    if (s.hitstop > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(s.hitstop / 0.12, 0, 1) * 0.5;
        rect(ctx, 0, 0, W, H, '#ffffff');
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Result copy
// ---------------------------------------------------------------------------
const RESULTS: Record<RaceOutcome, { headline: string; detail: (t: string, board: boolean) => string }> = {
    caught: {
        headline: 'Box Recovered',
        detail: (t, board) => board
            ? `You carve in front of the trolley at the bottom of the hill. ${t} hands the box over, wheezing, and asks if the longboard is for sale.`
            : `Two trolleys, one hill, and you had the better wheel. ${t} hands the box back and calls it "a collab".`,
    },
    lost: {
        headline: 'He Got Away',
        detail: (t, board) => board
            ? `${t} makes the turn at the bottom and vanishes. You hear "respect the grind" echoing off a parking structure.`
            : `The trolley tops out at a brisk jog. ${t} is a rumour by the third block.`,
    },
    wipeout: {
        headline: 'Wipeout',
        detail: t => `You meet a parked Camry at speed. ${t} does not look back. Somebody films you. Of course they do.`,
    },
    flat: {
        headline: 'Out Of Hill',
        detail: t => `The road flattens out and so does your speed. ${t} keeps rolling, still yelling about a mixtape called DOWNHILL.`,
    },
};

interface Hud {
    gap: number; speed: number; health: number; hill: number; wob: number;
    ammo: Record<string, number>;
}
const readHud = (s: RaceState): Hud => ({
    gap: Math.round(s.gap),
    speed: Math.round(s.speed * 2.2),
    health: Math.max(0, Math.round(s.health)),
    hill: Math.round(clamp(s.z / HILL_LENGTH, 0, 1) * 100),
    wob: s.wob,
    ammo: { ...s.ammo },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const CartRace: React.FC<{
    thief?: string;
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ thief = 'The Game', onFinish, onQuit }) => {
    const { gameState } = useGame();
    const { player } = gameState;

    const hasBoard = useMemo(() => hasWeapon(player, 'itm-longboard'), [player]);
    const arms = useMemo(() => {
        const a = armsFor(player, 'cart-race');
        return a.length ? a : [POCKET];
    }, [player]);

    const [sel, setSel] = useState(arms[0].id);
    const selRef = useRef(sel);
    selRef.current = sel;

    const { input, set, consume } = useInput(true);

    // The entire simulation lives in a ref. Nothing in here may become React
    // state: this object is mutated 60 times a second.
    const raceRef = useRef<RaceState | null>(null);
    if (!raceRef.current) {
        raceRef.current = createRaceState({
            hasBoard,
            energy: player.energy,
            weapons: arms,
            seed: (Date.now() ^ 0x9e3779b9) >>> 0,
        });
    }

    const [hud, setHud] = useState<Hud>(() => readHud(raceRef.current!));
    const [done, setDone] = useState<RaceOutcome | null>(null);
    const doneRef = useRef(false);
    const finishedRef = useRef(false);
    const hudClock = useRef(0);

    // Delivered street art starts decoding as the game mounts. Nothing waits on
    // it: until a file is ready `art.sprite` draws the emoji, so a slow
    // connection is a game that looks like it used to rather than a blank
    // frame. See `engine/streetArt.ts`.
    useMemo(() => art.load(), []);

    const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
        const s = raceRef.current!;
        const i = input.current;

        // Tuck is held (B or down); ollie and throw are edge-triggered so a held
        // finger on a phone doesn't machine-gun the weapon rail.
        // Up/down cross the street because the lanes are drawn stacked;
        // left/right brake and drive because that is what a hand reaches for
        // on a hill. Jump is its own button now rather than doubling up on the
        // d-pad, which is what freed up/down to mean the lane at all.
        stepRace(s, {
            left: i.left,
            right: i.right,
            up: i.up,
            down: i.down,
            tuck: i.b,
            brake: i.left,
            ollie: consume('c'),
            fire: consume('a'),
            weapon: selRef.current,
        }, dt);

        drawRace(ctx, s, thief);

        // HUD is the only thing crossing back into React, at ~7Hz.
        hudClock.current += dt;
        if (hudClock.current >= 0.14) {
            hudClock.current = 0;
            setHud(readHud(s));
        }

        if (s.outcome && s.endT <= 0 && !doneRef.current) {
            doneRef.current = true;
            setDone(s.outcome);
        }
    }, [input, consume, thief]);

    const s = raceRef.current;
    const won = done === 'caught';

    const close = () => {
        if (finishedRef.current) return;   // onFinish fires exactly once
        finishedRef.current = true;
        const bits: string[] = [];
        if (s.thiefHits) bits.push(`${s.thiefHits} hit${s.thiefHits === 1 ? '' : 's'} landed`);
        if (s.cleanLandings) bits.push(`${s.cleanLandings} clean landing${s.cleanLandings === 1 ? '' : 's'}`);
        if (s.closeCalls) bits.push(`${s.closeCalls} close call${s.closeCalls === 1 ? '' : 's'}`);
        if (s.hits) bits.push(`${s.hits} crash${s.hits === 1 ? '' : 'es'}`);
        const tail = bits.length ? ` (${bits.join(', ')})` : '';
        onFinish(
            won,
            won
                ? `You ran ${thief} down on a ${hasBoard ? 'longboard' : 'shopping trolley'}${tail}.`
                : `${thief} escaped downhill with your box${tail}.`,
        );
    };

    const selWeapon = arms.find(w => w.id === sel);
    const ammoLeft = selWeapon && selWeapon.uses !== undefined ? hud.ammo[selWeapon.id] ?? 0 : undefined;

    return (
        <ArcadeShell
            title="Cart Race"
            subtitle={`${thief} · downhill · ${hasBoard ? '🛹 Venice Longboard' : '🛒 the other trolley'}`}
            width={DESIGN_W}
            height={H}
            widen
            running={done === null}
            onFrame={onFrame}
            onInput={set}
            actions={['Throw', 'Tuck', 'Jump']}
            vertical
            onQuit={onQuit}
            quitLabel="Let Him Go"
            loadout={arms}
            selectedWeapon={sel}
            onSelectWeapon={setSel}
            /* Three short columns so the whole strip still fits at 390px. */
            hud={
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="min-w-0">
                        <div className="flex justify-between gap-1 label mb-1">
                            <span className="truncate">Gap</span>
                            <span className="numeric flex-shrink-0">{hud.gap}m</span>
                        </div>
                        <div className="meter h-2">
                            <i style={{
                                width: `${Math.max(0, 100 - (hud.gap / LOSE_GAP) * 100)}%`,
                                background: hud.gap < 40 ? 'var(--ok)' : hud.gap > 180 ? 'var(--bad)' : 'var(--accent)',
                            }} />
                        </div>
                    </div>
                    <div className="min-w-0">
                        <div className="flex justify-between gap-1 label mb-1">
                            <span className="truncate">Hill</span>
                            <span className="numeric flex-shrink-0">{100 - hud.hill}%</span>
                        </div>
                        <div className="meter h-2"><i style={{ width: `${100 - hud.hill}%`, background: 'var(--warn)' }} /></div>
                    </div>
                    <div className="min-w-0">
                        <div className="flex justify-between gap-1 label mb-1">
                            <span className="truncate">{hud.speed}mph</span>
                            <span className="numeric flex-shrink-0">{hud.health}hp</span>
                        </div>
                        <div className="meter h-2">
                            <i style={{ width: `${hud.health}%`, background: hud.health > 35 ? 'var(--ok)' : 'var(--bad)' }} />
                        </div>
                    </div>
                </div>
            }
            overlay={done !== null ? (
                <MiniGameResult
                    won={won}
                    headline={RESULTS[done].headline}
                    detail={RESULTS[done].detail(thief, hasBoard)}
                    onClose={close}
                    closeLabel={won ? 'Take The Box' : 'Walk Home'}
                />
            ) : undefined}
            help={
                `◀ ▶ steer across four lanes (turning scrubs speed — it is your only brake). `
                + `▼ or TUCK to go faster with worse steering. `
                + (hasBoard
                    ? `▲ ollies bins, cones, dogs and roadworks, and doubles your ramp air — clean landings are free speed. `
                    : `▲ is a man lifting a trolley: it clears an oil slick and nothing else. Weave everything. `)
                + `THROW hurls the selected AM/PM item at him${ammoLeft !== undefined ? ` (${ammoLeft} left)` : ''}. `
                + `Slushie slows him, the chancla homes in and comes back, the frisbee cuts through parked cars, the dog launcher is rapid fire. `
                + `Cut it close on a dodge without touching anything for a CLOSE CALL speed bump — chain them for a bigger one. `
                + `Get right on his back wheel and his wake pulls you forward for free (watch for DRAFT on the speedo) — but riding that close means his thrown junk finds you more often too.`
            }
        />
    );
};

export default CartRace;
