/**
 * The street fight: does pressing the button do the thing?
 *
 * This is the only mini-game with real mechanics — startup/active/recovery
 * frames, hitstun, blockstun, cancel windows, hit-stop — and it shipped with no
 * tests at all. It also feels bad to play, and the reason is not the mechanics:
 * it is that the game throws presses away.
 *
 * `onFrame` calls `consume('a')` every single frame, which clears the pressed
 * flag whether or not the fighter could act on it. `stepFighter` then drops the
 * press on the floor whenever the fighter is locked — hitstun, blockstun,
 * knocked down, mid-recovery — and `stepFight` returns early during hit-stop
 * before the fighters step at all. Hit-stop runs on *every hit that lands*, for
 * 3 to 10 frames. So during the exact moments a fighting game is most demanding
 * of your inputs, the game is deleting them.
 *
 * Every real fighting game buffers: a press a few frames early comes out the
 * instant you recover. These checks pin that down, and the rest cover the
 * mechanics that had nothing guarding them.
 */
import assert from 'node:assert/strict';
import {
    createFight, stepFight, startAttack, blankInput, seeded,
    hitbox, hurtbox, movesFor,
    type FightState, type FightInput, type Fighter,
} from '../components/minigames/StreetFighter.tsx';
import { FISTS } from '../systems/weapons.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const DT = 1 / 60;

/** Widens the literal type so `assert` comparisons read as plain state checks. */
const stateOf = (f: Fighter): string => f.state;

/** A fight already past the announce, so the fighters actually act. */
function liveFight(seed = 7): FightState {
    const s = createFight({ opponent: 'Test Foe', weapon: FISTS, rng: seeded(seed) });
    while (s.phase === 'intro') stepFight(s, blankInput(), DT);
    return s;
}

const press = (btn: 'a' | 'b' | 'up'): FightInput => ({
    ...blankInput(),
    [btn]: true,
    [`${btn}Pressed`]: true,
} as FightInput);

/** Steps n frames with nothing held, the way a player who let go would. */
const idleFor = (s: FightState, n: number) => {
    for (let i = 0; i < n; i++) stepFight(s, blankInput(), DT);
};

console.log('\nthe fight starts');

t('the announce ends and both fighters are alive and standing', () => {
    const s = liveFight();
    assert.equal(s.phase, 'fight');
    assert.ok(s.p.hp > 0 && s.f.hp > 0);
    assert.equal(s.p.state, 'idle');
});

t('a jab on an idle fighter comes out immediately', () => {
    const s = liveFight();
    stepFight(s, press('a'), DT);
    assert.equal(s.p.state, 'attack', 'a free jab did not come out');
    assert.equal(s.p.move, 'jab');
});

console.log('\nthe game must not eat your presses');

t('a press during hit-stop is not thrown away', () => {
    // Hit-stop freezes the simulation for a few frames on every landed hit, and
    // `stepFight` returns before the fighters step. A press in that window is
    // the single most common input in a real fight — the follow-up.
    const s = liveFight();
    s.hitstop = 5;
    stepFight(s, press('a'), DT);
    assert.equal(stateOf(s.p), 'idle', 'the fighter moved during hit-stop');

    // Hit-stop passes; the press the player already made should arrive.
    let started = false;
    for (let i = 0; i < 8 && !started; i++) {
        stepFight(s, blankInput(), DT);
        if (s.p.state === 'attack') started = true;
    }
    assert.ok(started, 'the press made during hit-stop was swallowed');
});

t('a press during hitstun comes out the moment you recover', () => {
    const s = liveFight();
    s.p.state = 'hitstun';
    s.p.hitstun = 4;
    stepFight(s, press('a'), DT);
    assert.notEqual(stateOf(s.p), 'attack', 'the fighter attacked out of hitstun');

    let started = false;
    for (let i = 0; i < 10 && !started; i++) {
        stepFight(s, blankInput(), DT);
        if (stateOf(s.p) === 'attack') started = true;
    }
    assert.ok(started, 'the press made during hitstun was swallowed');
});

t('a press late in recovery comes out as the next move', () => {
    // The buffer is a forgiveness window, not a queue: pressing near the end of
    // your own jab should chain, pressing at the start of it should not still be
    // pending twenty frames later. This is the chaining half.
    const s = liveFight();
    const jab = movesFor(FISTS).jab;
    stepFight(s, press('a'), DT);
    assert.equal(stateOf(s.p), 'attack');

    // Run to a few frames short of the end of recovery, then press.
    const total = jab.startup + jab.active + jab.recovery;
    while (s.p.state === 'attack' && s.p.frame < total - 3) stepFight(s, blankInput(), DT);
    stepFight(s, press('a'), DT);

    let cameOut = false;
    for (let i = 0; i < 10 && !cameOut; i++) {
        stepFight(s, blankInput(), DT);
        if (s.p.state === 'attack' && s.p.frame < 2) cameOut = true;
    }
    assert.ok(cameOut, 'a press at the end of recovery did not chain into the next move');
});

t('a press at the very start of a move does not fire long afterwards', () => {
    // The forgetting half. Seven frames of forgiveness, not a stored command.
    const s = liveFight();
    stepFight(s, press('a'), DT);
    stepFight(s, press('a'), DT);        // one frame in — far too early to chain
    idleFor(s, 60);
    assert.notEqual(stateOf(s.p), 'attack', 'a press from the start of the last move fired');
});

t('the buffer forgets, so an old press is not a ghost input', () => {
    // A press has to expire. Otherwise being held down for a second and then
    // recovering would fire an attack the player has long stopped wanting.
    const s = liveFight();
    s.p.state = 'hitstun';
    s.p.hitstun = 90;           // a very long lockout
    stepFight(s, press('a'), DT);
    idleFor(s, 120);
    assert.notEqual(stateOf(s.p), 'attack', 'a press from two seconds ago fired');
});

console.log('\nthe mechanics nothing was guarding');

t('a jab that connects takes health off', () => {
    const s = liveFight();
    s.p.x = s.f.x - 22;         // inside jab range
    const before = s.f.hp;
    for (let i = 0; i < 20; i++) stepFight(s, i === 0 ? press('a') : blankInput(), DT);
    assert.ok(s.f.hp < before, `the jab did nothing: ${before} -> ${s.f.hp}`);
});

t('you cannot attack while knocked down', () => {
    const s = liveFight();
    s.p.state = 'down';
    s.p.downTimer = 30;
    assert.equal(startAttack(s, s.p, 'jab'), false);
});

t('the special costs meter and will not fire without it', () => {
    const s = liveFight();
    s.p.hype = 0;
    assert.equal(startAttack(s, s.p, 'special'), false, 'the special fired on an empty meter');
    s.p.hype = 100;
    assert.equal(startAttack(s, s.p, 'special'), true, 'a full meter would not spend');
    assert.ok(s.p.hype < 100, 'the special was free');
});

t('a move has a hitbox only while it is active', () => {
    const s = liveFight();
    const m = movesFor(FISTS).jab;
    startAttack(s, s.p, 'jab');
    s.p.frame = 0;
    assert.equal(hitbox(s.p), null, 'the jab hit during startup');
    s.p.frame = m.startup + 0.5;
    assert.ok(hitbox(s.p), 'the jab has no hitbox while active');
    s.p.frame = m.startup + m.active + 0.5;
    assert.equal(hitbox(s.p), null, 'the jab was still hitting during recovery');
});

t('a fighter always has a hurtbox', () => {
    const s = liveFight();
    for (const f of [s.p, s.f] as Fighter[]) {
        const b = hurtbox(f);
        assert.ok(b.w > 0 && b.h > 0, `${f.name} cannot be hit`);
    }
});

t('a light hit cancels into the heavy instead of jabbing again', () => {
    // The cancel window is the whole combo system, and the buffer used to eat
    // it: the light press was checked first and still had frames left, so the
    // kick a player pressed to cash the window came out as another jab. Over
    // fifty measured matches a jab-then-heavy policy landed exactly zero heavies.
    const s = liveFight();
    s.p.x = s.f.x - 24;                  // inside jab range
    for (let i = 0; i < 40 && s.p.cancel <= 0; i++) {
        stepFight(s, i % 14 === 0 ? press('a') : blankInput(), DT);
    }
    assert.ok(s.p.cancel > 0, 'the jab never connected, so there was no window to cancel');
    for (let i = 0; i < 6 && s.p.move !== 'heavy'; i++) stepFight(s, press('b'), DT);
    assert.equal(s.p.move, 'heavy', 'the kick came out as another jab');
});

t('a dash covers more ground than a walk', () => {
    const walk = liveFight();
    const dash = liveFight();
    const fwd = { ...blankInput(), right: true };
    // A held direction walks; the same direction tapped twice dashes.
    for (let i = 0; i < 12; i++) stepFight(walk, fwd, DT);
    for (let i = 0; i < 12; i++) {
        stepFight(dash, i === 2 || i === 3 ? blankInput() : fwd, DT);
    }
    assert.ok(dash.p.x > walk.p.x + 4, `the dash went nowhere: ${walk.p.x} vs ${dash.p.x}`);
});

t('the same seed fights the same fight twice', () => {
    const run = () => {
        const s = liveFight(99);
        for (let i = 0; i < 300; i++) stepFight(s, i % 17 === 0 ? press('a') : blankInput(), DT);
        return `${s.p.hp}/${s.f.hp}/${s.p.x.toFixed(2)}/${s.f.x.toFixed(2)}`;
    };
    assert.equal(run(), run(), 'the fight is not reproducible');
});

// ---------------------------------------------------------------------------
// Balance
//
// The fight was decided before either fighter moved. Measured over thirty
// seeded matches, 86% of every match was spent at a centre-to-centre distance
// where no move could reach — the average gap was 56px and the longest move
// stopped connecting at 48 — so there was no neutral game, the jab landed 1.3
// times a match, and mashing the one long button won 100% of matches. These
// checks are the instrument that found that, boiled down: they run whole
// matches against the built-in AI and assert on where the fighters stand and
// who wins, because none of that can be seen from a single frame.
// ---------------------------------------------------------------------------

type Policy = (s: FightState, frame: number) => FightInput;

const BODY = 15;
const REACH = movesFor(FISTS);
/** Past this gap nothing either fighter has can touch the other. */
const NO_REACH = Math.max(REACH.heavy.reach, REACH.sweep.reach) + BODY;

const facingFoe = (s: FightState): 'left' | 'right' => (s.f.x >= s.p.x ? 'right' : 'left');
const facingAway = (s: FightState): 'left' | 'right' => (s.f.x >= s.p.x ? 'left' : 'right');
const hold = (btn: 'a' | 'b'): FightInput =>
    ({ ...blankInput(), [btn]: true, [`${btn}Pressed`]: true } as FightInput);
const walking = (s: FightState, dir: 'left' | 'right', rest: Partial<FightInput> = {}): FightInput =>
    ({ ...blankInput(), [dir]: true, ...rest } as FightInput);

const MASH_HEAVY: Policy = () => hold('b');
const MASH_JAB: Policy = () => hold('a');
/** Double-tap forward, then jab: the approach the dash exists for. */
const DASH_IN: Policy = (s, i) => {
    const ph = i % 20;
    const jab = ph >= 14 ? { a: true, aPressed: ph === 14 } : {};
    return ph < 4 || (ph >= 6 && ph < 14)
        ? walking(s, facingFoe(s), jab)
        : ({ ...blankInput(), ...jab } as FightInput);
};
/** Guards only while he is actually swinging, so it never backs into a corner. */
const GUARDING: Policy = s => (s.f.state === 'attack' ? walking(s, facingAway(s)) : blankInput());
const PASSIVE: Policy = () => blankInput();

interface Series {
    matches: number; wins: number;
    frames: number; inReach: number;
    jabs: number; dmgTaken: number;
    gapSum: number;
}

/** Plays whole matches against the AI and reports what happened in them. */
function series(policy: Policy, seeds: number): Series {
    const r: Series = { matches: 0, wins: 0, frames: 0, inReach: 0, jabs: 0, dmgTaken: 0, gapSum: 0 };
    for (let n = 1; n <= seeds; n++) {
        const s = createFight({ opponent: 'Foe', weapon: FISTS, rng: seeded(n * 7919) });
        for (let i = 0; s.matchWon === null && i < 60 * 60 * 6; i++) {
            const live = s.phase === 'fight';
            const foeHp = s.f.hp;
            const ownHp = s.p.hp;
            const landed = s.stats.hitsLanded;
            stepFight(s, live ? policy(s, i) : blankInput(), DT);
            if (!live) continue;
            r.frames++;
            const gap = Math.abs(s.p.x - s.f.x);
            r.gapSum += gap;
            if (gap < NO_REACH) r.inReach++;
            if (s.stats.hitsLanded > landed && s.f.hp < foeHp && s.p.move === 'jab') r.jabs++;
            if (s.p.hp < ownHp) r.dmgTaken += ownHp - s.p.hp;
        }
        r.matches++;
        if (s.matchWon) r.wins++;
    }
    return r;
}

/** Enough matches that one unlucky seed cannot move a win rate ten points. */
const SEEDS = 40;
const heavy = series(MASH_HEAVY, SEEDS);
const jab = series(MASH_JAB, SEEDS);
const dashing = series(DASH_IN, SEEDS);

console.log('\nthe spacing, which is the whole fight');

t('the fighters spend real time at a distance where a move can reach', () => {
    // It was 4% of frames. A fighting game in which nothing reaches is two
    // people doing a dance forty pixels apart.
    for (const [name, r] of [['mashing the kick', heavy], ['mashing the jab', jab]] as const) {
        const share = r.inReach / r.frames;
        assert.ok(share > 0.4, `${name}: only ${(share * 100).toFixed(1)}% of frames in anyone's range`);
    }
});

t('the neutral gap came in off the old dead zone', () => {
    // The average gap was 56-60px against a longest reach of 48: the fighters
    // idled where neither of them could be punished for it. It now sits on the
    // edge of the longest move rather than well outside it.
    for (const [name, r] of [['mashing the kick', heavy], ['mashing the jab', jab]] as const) {
        const mean = r.gapSum / r.frames;
        assert.ok(mean < 53, `${name}: the fighters averaged ${mean.toFixed(1)}px apart`);
    }
});

console.log('\nno one button is the whole game');

t('mashing the long button is good, not solved', () => {
    const rate = heavy.wins / heavy.matches;
    assert.ok(rate < 0.9, `the kick alone won ${(rate * 100).toFixed(0)}% of matches`);
    assert.ok(rate > 0.3, `the kick is now useless: ${(rate * 100).toFixed(0)}%`);
});

t('the jab is a move that actually lands', () => {
    // 1.3 hits a match, at six damage each, is not a move. It is a decoration.
    const per = jab.jabs / jab.matches;
    assert.ok(per > 8, `the jab landed ${per.toFixed(1)} times a match`);
});

t('walking in beats standing still and mashing', () => {
    // The point of the dash. A policy that closes the gap should out-perform
    // the one that waits at the edge of its own range pressing the long button.
    assert.ok(
        dashing.wins / dashing.matches > heavy.wins / heavy.matches,
        `dashing in won ${dashing.wins}/${dashing.matches}, mashing won ${heavy.wins}/${heavy.matches}`,
    );
});

t('a jab lands close enough to follow up on', () => {
    // Knockback was 46 against a forward walk of 58: every poke threw the
    // fighters further apart than the poking fighter could walk back in.
    const s = liveFight();
    s.p.x = s.f.x - 24;
    for (let i = 0; i < 40 && s.f.hp === s.f.maxHp; i++) {
        stepFight(s, i === 0 ? press('a') : blankInput(), DT);
    }
    assert.ok(s.f.hp < s.f.maxHp, 'the jab never landed');
    idleFor(s, 8);
    const gap = Math.abs(s.p.x - s.f.x);
    assert.ok(gap < REACH.jab.reach + BODY, `a landed jab left them ${gap.toFixed(1)}px apart`);
});

console.log('\nblocking and being passive are different things');

t('holding a guard beats standing there taking it', () => {
    const guard = series(GUARDING, 12);
    const passive = series(PASSIVE, 12);
    const rate = (r: Series) => r.dmgTaken / (r.frames / 60);
    assert.ok(
        rate(guard) < rate(passive),
        `guarding took ${rate(guard).toFixed(1)} dmg/s, doing nothing took ${rate(passive).toFixed(1)}`,
    );
});

t('neither passive fighter ever wins a match', () => {
    // Fine that they lose. They should never fluke a win out of the AI.
    assert.equal(series(PASSIVE, 8).wins, 0, 'doing nothing won a fight');
});

console.log(`\n${pass} fighter checks passed.\n`);
