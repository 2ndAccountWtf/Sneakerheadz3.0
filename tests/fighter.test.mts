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
 *
 * The second thing wrong with it was bigger and took a harness to see. The
 * parts of a fighting game were all here — frame data, highs and lows, a cancel
 * window, a launcher — and the loop between them was broken in three places:
 *
 *   - Nothing was punishable on block. The worst outcome for throwing your
 *     slowest move and having it guarded was minus seven frames, which buys the
 *     defender nothing. Blocking correctly was a way to take less damage, never
 *     a way to take the turn, so there was no reason to ever do it.
 *   - One button was the whole game. The jab was plus six on hit against its own
 *     four frames of startup, so mashing it was a true infinite: measured at 77
 *     unanswered hits in ten seconds against a standing opponent.
 *   - There was no third option. Strike and block, and nothing that beat a
 *     guard, so a defending opponent was a coin flip between high and low,
 *     forever.
 *
 * And two dead mechanics: the special launched a body into the air that nothing
 * could reach, and a quarter of a match's running time was announce banners.
 *
 * The checks below are the instrument that found all of that.
 */
import assert from 'node:assert/strict';
import {
    createFight, stepFight, startAttack, blankInput, seeded,
    bufferFramesFor, BUFFER_FRAMES, BUFFER_MIN, BUFFER_MAX, FOCUS_BASELINE,
    hitbox, hurtbox, movesFor, JUGGLE_MAX, INTRO_TIME, KO_TIME,
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

const press = (btn: 'a' | 'b' | 'up' | 'c'): FightInput => ({
    ...blankInput(),
    [btn]: true,
    [`${btn}Pressed`]: true,
} as FightInput);

/** Steps n frames with nothing held, the way a player who let go would. */
const idleFor = (s: FightState, n: number) => {
    for (let i = 0; i < n; i++) stepFight(s, blankInput(), DT);
};

/**
 * A fight with the opponent's brain held off.
 *
 * His decision timers are pushed out of reach every frame, so what a check
 * measures is the rule and not his mood. Without this every one of the checks
 * below reads as a coin flip: the first draft of them had the grab failing to
 * catch a guard, and the reason was that he was jabbing it out of the air —
 * which is correct behaviour, and nothing to do with what was being measured.
 */
function lab(gap = 17, opts: { guard?: boolean; breaks?: boolean } = {}) {
    const s = createFight({ opponent: 'Dummy', weapon: FISTS, rng: seeded(9) });
    const pin = () => {
        s.phase = 'fight'; s.phaseT = 0; s.roundClock = 60;
        s.ai.think = 9999; s.ai.react = 9999; s.ai.queued = null;
        s.ai.plan = opts.guard ? 'block' : 'neutral';
        if (s.f.state !== 'grabbed') s.ai.breakIn = -2;
        else if (s.ai.breakIn === -2) s.ai.breakIn = opts.breaks ? 1 : -1;
    };
    pin();
    s.p.x = 130;
    s.f.x = 130 + gap;
    return { s, step: (cmd: FightInput = blankInput()) => { pin(); stepFight(s, cmd, DT); } };
}

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

console.log('\nstrike, block, grab — the three that beat each other');

t('a grab goes straight through a held guard', () => {
    const L = lab(17, { guard: true });
    const hp0 = L.s.f.hp;
    let caught = false;
    for (let i = 0; i < 60; i++) {
        L.step(i === 0 ? press('c') : blankInput());
        if (stateOf(L.s.f) === 'grabbed') caught = true;
    }
    assert.ok(caught, 'a guard stopped the grab, which leaves nothing that beats a guard');
    assert.ok(L.s.f.hp < hp0, `the throw did no damage (${hp0} → ${L.s.f.hp})`);
});

t('a strike beats a grab, so the grab is not the answer to everything', () => {
    const L = lab(17);
    for (let i = 0; i < 30; i++) {
        // His jab starts a frame LATER and still wins: four frames against five.
        if (i === 1) startAttack(L.s, L.s.f, 'jab');
        L.step(i === 0 ? press('c') : blankInput());
    }
    assert.equal(L.s.stats.grabsLanded, 0, 'the grab caught someone who was already punching it');
});

t('a guard is worth holding: no chip off an ordinary move', () => {
    // Every move used to chip, and blocking twenty-odd swings a round cost more
    // health than the hits it avoided. Correct defence was a slower loss.
    // Asserted per frame rather than per match: a kick that slips past the
    // guard is a clean hit and SHOULD take health, so a running total would be
    // measuring the dummy's footwork instead of the chip rule.
    const L = lab(30, { guard: true });
    let blocked = 0, chip = 0;
    for (let r = 0; r < 10; r++) {
        for (let i = 0; i < 30; i++) {
            const wasBlocked = L.s.stats.hitsBlocked;
            const wasLanded = L.s.stats.hitsLanded;
            const hp = L.s.f.hp;
            L.step(i === 0 ? press('b') : blankInput());
            if (L.s.stats.hitsBlocked > wasBlocked && L.s.stats.hitsLanded === wasLanded) {
                blocked++;
                chip += hp - L.s.f.hp;
            }
        }
    }
    assert.ok(blocked > 0, 'nothing was ever blocked, so this measured nothing');
    assert.equal(chip, 0, `blocking ${blocked} kicks cost ${chip}hp of chip`);
});

t('blocking a kick hands you the turn', () => {
    // Frame advantage on block, read off the table rather than asserted from a
    // constant: this is the number that decides whether defence is a decision.
    const m = movesFor(FISTS);
    const onBlock = (id: keyof typeof m) => m[id].blockstun - m[id].recovery;
    assert.ok(onBlock('heavy') <= -10, `a blocked kick is only ${onBlock('heavy')}`);
    assert.ok(onBlock('sweep') <= -10, `a blocked sweep is only ${onBlock('sweep')}`);
    assert.ok(onBlock('special') <= -8, `a blocked special is only ${onBlock('special')}`);
    // Punishable means punishable BY SOMETHING. The jab is the punish.
    assert.ok(m.jab.startup < -onBlock('heavy'), 'nothing is fast enough to punish a blocked kick');
    // And the jump-in stays plus, or guessing an air attack right pays nothing.
    assert.ok(onBlock('air') > 0, 'a blocked jump-in leaves you minus');
});

t('mashing GRAB gets you out of one; ignoring it does not', () => {
    const outcome = (mash: boolean) => {
        const L = lab(17);
        let hp0 = 0;
        for (let i = 0; i < 80; i++) {
            const c = stateOf(L.s.p) === 'grabbed' && mash ? press('c') : blankInput();
            if (i === 1) { startAttack(L.s, L.s.f, 'grab'); hp0 = L.s.p.hp; }
            L.step(c);
        }
        return { lost: hp0 - L.s.p.hp, broken: L.s.stats.grabsBroken };
    };
    const ignored = outcome(false);
    const mashed = outcome(true);
    assert.ok(ignored.lost > 0, 'eating a grab cost nothing');
    assert.equal(ignored.broken, 0, 'a grab broke itself');
    assert.equal(mashed.broken, 1, 'mashing the button did not break the grab');
    assert.ok(mashed.lost < ignored.lost, `breaking out cost ${mashed.lost}hp, eating it cost ${ignored.lost}hp`);
});

t('a throw into a wall hurts more than one into open air', () => {
    const thrown = (x: number) => {
        const L = lab(17, { breaks: false });
        L.s.p.x = x;
        L.s.f.x = x + 17;
        const hp0 = L.s.f.hp;
        for (let i = 0; i < 70; i++) L.step(i === 0 ? press('c') : blankInput());
        return hp0 - L.s.f.hp;
    };
    const wall = thrown(258);
    const open = thrown(150);
    assert.ok(open > 0, 'a throw in open space did nothing at all');
    assert.ok(wall > open, `into the wall ${wall}hp, mid-stage ${open}hp`);
});

console.log('\nthe combo, and the one that used to be an infinite');

t('a punch chains into a kick', () => {
    const L = lab(22);
    const hp0 = L.s.f.hp;
    let kicked = false;
    for (let i = 0; i < 40; i++) {
        const c = i === 0 ? press('a') : (L.s.p.cancel > 0 && !kicked ? press('b') : blankInput());
        L.step(c);
        if (L.s.p.move === 'heavy') kicked = true;
    }
    assert.ok(kicked, 'the cancel window never produced the kick');
    assert.ok(L.s.combo.count >= 2, `the two hits did not read as a combo (${L.s.combo.count})`);
    assert.ok(hp0 - L.s.f.hp >= 15, `punch into kick only did ${hp0 - L.s.f.hp}hp`);
});

t('a punch does not chain into another punch', () => {
    // It used to, and since the jab was also plus on hit that made mashing one
    // button a true infinite — 77 unanswered hits in ten seconds, measured.
    //
    // Asserted on the cancel window rather than on damage done: proration bleeds
    // an infinite down to roughly the same total either way, so a damage total
    // cannot tell the two builds apart. Whether the second jab COMES OUT can.
    const L = lab(22);
    let hitAt = -1, cancelled = -1, restarted = -1;
    for (let i = 0; i < 80; i++) {
        const hp = L.s.f.hp;
        const wasMove = L.s.p.move;
        const wasFrame = L.s.p.frame;
        L.step(press('a'));
        if (hitAt < 0 && L.s.f.hp < hp) { hitAt = i; continue; }
        if (hitAt < 0) continue;
        // A cancel: still inside a jab, but the frame counter jumped backwards
        // because a NEW jab replaced the one that was recovering.
        if (cancelled < 0 && wasMove === 'jab' && L.s.p.move === 'jab' && L.s.p.frame < wasFrame) cancelled = i;
        // A clean restart: the move ended, then came out again on its own time.
        if (restarted < 0 && wasMove !== 'jab' && L.s.p.move === 'jab') restarted = i;
    }
    assert.ok(hitAt >= 0, 'the first jab never connected, so this measured nothing');
    assert.equal(cancelled, -1, 'a jab cancelled into another jab, which is the infinite');
    // Checked last: in a build where the jab DOES chain it never leaves the move
    // at all, so this would fire first and report the wrong thing.
    assert.ok(restarted >= 0, 'the jab never came out a second time, so this measured nothing');
});

console.log('\nthe launcher launches into something');

t('a punch reaches a body that is genuinely up in the air', () => {
    // Held at a fixed height rather than caught on the way down: a falling body
    // passes through ordinary mid-hitbox range all by itself, so a check that
    // lets it fall passes whether or not the juggle rule exists at all. Above
    // about 30px the rule is the only thing that connects.
    const reaches = (up: number) => {
        const L = lab(20);
        const hold = () => {
            L.s.f.y = 152 - up; L.s.f.vy = 0;
            L.s.f.state = 'hitstun'; L.s.f.hitstun = 60; L.s.f.juggle = 0;
        };
        hold();
        startAttack(L.s, L.s.p, 'jab');
        for (let i = 0; i < 12; i++) { L.step(); if (L.s.stats.juggleHits > 0) return true; hold(); }
        return false;
    };
    assert.ok(reaches(38), 'a body 38px up could not be touched, so the launch is decoration');
    assert.ok(reaches(45), 'a body 45px up could not be touched');
});

t('a juggle ends; it does not carry a body to the floor every time', () => {
    const L = lab(20);
    L.s.p.hype = 100;
    let peak = 152;
    for (let i = 0; i < 90; i++) {
        const c = i === 0
            ? ({ ...press('a'), down: true } as FightInput)
            : (L.s.f.y < 151.5 && stateOf(L.s.f) === 'hitstun' ? press('a') : blankInput());
        L.s.f.x = Math.min(L.s.f.x, L.s.p.x + 24);
        L.step(c);
        peak = Math.min(peak, L.s.f.y);
    }
    assert.ok(152 - peak > 30, `the launch only lifted him ${(152 - peak).toFixed(0)}px`);
    assert.ok(L.s.stats.juggleHits > 0, 'the launcher led to nothing');
    assert.ok(L.s.stats.juggleHits <= JUGGLE_MAX, `a juggle ran to ${L.s.stats.juggleHits} hits`);
});

t('the launcher outlives its own recovery, with room to act', () => {
    // It did not: minus 168 of launch against 22 frames of recovery put the
    // victim back on the floor before the uppercut had put its arm down, and
    // the follow-up window was literally negative. Measured off the sim rather
    // than off the constants, because the constants were what was wrong.
    const L = lab(20);
    L.s.p.hype = 100;
    let free = -1, landed = -1;
    for (let i = 0; i < 120; i++) {
        L.step(i === 0 ? ({ ...press('a'), down: true } as FightInput) : blankInput());
        if (free < 0 && L.s.f.y < 151.5 && stateOf(L.s.p) !== 'attack') free = i;
        if (free >= 0 && landed < 0 && L.s.f.y >= 151.5) landed = i;
    }
    assert.ok(free >= 0, 'the uppercut never launched anybody');
    assert.ok(landed > free, 'he was on the floor before the uppercut finished');
    const window = landed - free;
    assert.ok(
        window > movesFor(FISTS).jab.startup + 6,
        `only ${window} frames between recovering and him landing — no room to follow up`,
    );
});

console.log('\nthe match is a match, not a slideshow');

t('the announce does not eat a quarter of the running time', () => {
    // Measured at 4.7s of round cards and 5.4s of K.O. inside a 41-second match.
    const s = createFight({ opponent: 'D', weapon: FISTS, rng: seeded(11) });
    let live = 0, total = 0;
    for (let i = 0; i < 60 * 400 && s.phase !== 'over'; i++) {
        if (s.phase === 'fight' && s.hitstop <= 0) live++;
        total++;
        stepFight(s, blankInput(), DT);
    }
    assert.ok(live / total > 0.68, `only ${(100 * live / total).toFixed(0)}% of the match was live play`);
    assert.ok(INTRO_TIME <= 1.5 && KO_TIME <= 1.8, 'the banners went back up');
});

t('a press skips the round card', () => {
    const s = createFight({ opponent: 'D', weapon: FISTS, rng: seeded(4) });
    const slow = createFight({ opponent: 'D', weapon: FISTS, rng: seeded(4) });
    let fast = 0, patient = 0;
    while (s.phase === 'intro' && fast < 400) { stepFight(s, press('a'), DT); fast++; }
    while (slow.phase === 'intro' && patient < 400) { stepFight(slow, blankInput(), DT); patient++; }
    assert.ok(fast < patient, `skipping took ${fast} frames, waiting took ${patient}`);
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
const hold = (btn: 'a' | 'b' | 'c'): FightInput =>
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
/** Holds a guard and nothing else. Should lose, and lose to the grab. */
const TURTLE: Policy = s => walking(s, facingAway(s));

/**
 * The game as it is meant to be played: guard what is coming, cash the punish
 * in as the combo rather than a single poke, grab a guard, spend the meter.
 *
 * This policy is the whole point of the harness. A player who does all of this
 * should beat one who mashes by a wide margin, and before this pass they did
 * not — mashing the long button won 85% of matches and playing properly won
 * 100%, which is to say the two were indistinguishable because the opponent
 * could not punish either of them.
 */
let properLastAtk = -99;
const PROPER: Policy = (s, i) => {
    if (i === 0) properLastAtk = -99;
    const gap = Math.abs(s.p.x - s.f.x);
    const fm = s.f.move ? s.f.moves[s.f.move] : null;
    const recovering = s.f.state === 'attack' && !!fm && s.f.frame >= fm.startup + fm.active;
    const mine = s.p.moves;
    const poke = (btn: 'a' | 'b' | 'c') => { properLastAtk = i; return hold(btn); };
    // The combo: cash the cancel window rather than poking again.
    if (s.p.cancel > 0 && s.p.move === 'jab') return hold('b');
    if (gap > mine.heavy.reach + BODY - 3) return walking(s, facingFoe(s));
    if (recovering && gap < mine.heavy.reach + BODY - 5) {
        if (s.p.hype >= 100 && gap < mine.special.reach) return { ...poke('a'), down: true } as FightInput;
        return poke('a');
    }
    // Guard what is actually coming, and guess its height off the move.
    if (fm && s.f.state === 'attack' && !recovering) {
        return walking(s, facingAway(s), fm.height === 'low' ? { down: true } : {});
    }
    if (s.f.blockHeld && gap < mine.grab.reach + BODY) return poke('c');
    if (gap > mine.jab.reach + BODY - 6) return walking(s, facingFoe(s));
    if (i - properLastAtk > 15) return poke('a');
    return walking(s, facingAway(s));
};

interface Series {
    matches: number; wins: number;
    frames: number; inReach: number;
    jabs: number; dmgTaken: number;
    gapSum: number;
    grabbed: number; juggled: number;
    dmgDealt: number;
}

/** Plays whole matches against the AI and reports what happened in them. */
function series(policy: Policy, seeds: number): Series {
    const r: Series = { matches: 0, wins: 0, frames: 0, inReach: 0, jabs: 0, dmgTaken: 0, gapSum: 0,
                        grabbed: 0, juggled: 0, dmgDealt: 0 };
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
            if (s.f.hp < foeHp) r.dmgDealt += foeHp - s.f.hp;
        }
        r.matches++;
        r.grabbed += s.stats.grabsLanded;
        r.juggled += s.stats.juggleHits;
        if (s.matchWon) r.wins++;
    }
    return r;
}

/** Enough matches that one unlucky seed cannot move a win rate ten points. */
const SEEDS = 40;
const heavy = series(MASH_HEAVY, SEEDS);
const jab = series(MASH_JAB, SEEDS);
const dashing = series(DASH_IN, SEEDS);
const proper = series(PROPER, SEEDS);
const turtle = series(TURTLE, SEEDS);
const rate = (r: Series) => r.wins / r.matches;

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

t('playing it properly beats mashing, by a lot', () => {
    // The number this whole pass exists for. Mashing the long button used to win
    // 85% and playing properly 100%, which meant the two were the same game.
    assert.ok(rate(proper) > 0.6, `playing properly won only ${(rate(proper) * 100).toFixed(0)}%`);
    assert.ok(
        rate(proper) - rate(heavy) > 0.35,
        `proper ${(rate(proper) * 100).toFixed(0)}% vs mashing ${(rate(heavy) * 100).toFixed(0)}% — too close to tell apart`,
    );
});

t('no single button is the whole game', () => {
    assert.ok(rate(heavy) < 0.4, `the kick alone won ${(rate(heavy) * 100).toFixed(0)}% of matches`);
    assert.ok(rate(jab) < 0.4, `the jab alone won ${(rate(jab) * 100).toFixed(0)}% of matches`);
});

t('the kick is not useless — it is what the punch chains into', () => {
    // The old guard on this was a win rate for mashing it, which measured the
    // opponent rather than the move. Measure the move.
    const m = movesFor(FISTS);
    assert.ok(m.heavy.damage > m.jab.damage * 1.8, 'the kick stopped being worth the commitment');
    const L = lab(22);
    const hp0 = L.s.f.hp;
    let kicked = false;
    for (let i = 0; i < 40; i++) {
        L.step(i === 0 ? press('a') : (L.s.p.cancel > 0 && !kicked ? press('b') : blankInput()));
        if (L.s.p.move === 'heavy') kicked = true;
    }
    const combo = hp0 - L.s.f.hp;
    assert.ok(combo > m.jab.damage * 2, `punch into kick did ${combo}hp, two jabs would do ${m.jab.damage * 2}`);
});

t('turtling loses, and loses to the grab', () => {
    // A guard that never has to be abandoned is a solved defence. It is the
    // reason the grab exists, so this is the check that says the grab landed.
    assert.ok(rate(turtle) < 0.15, `holding a guard forever won ${(rate(turtle) * 100).toFixed(0)}%`);
    assert.ok(
        turtle.grabbed / turtle.matches > 4,
        `a turtle got grabbed ${(turtle.grabbed / turtle.matches).toFixed(1)} times a match`,
    );
});

t('the jab is a move that actually lands', () => {
    // 1.3 hits a match, at six damage each, is not a move. It is a decoration.
    const per = proper.jabs / proper.matches;
    assert.ok(per > 8, `the jab landed ${per.toFixed(1)} times a match`);
});

t('the opponent can do the things the game is teaching you', () => {
    // He could not, and it showed: with no combo and no juggle of his own he
    // took eight hits a match and lost every one of them to correct play.
    assert.ok(proper.juggled / proper.matches > 0.5, 'nobody ever juggled anybody');
    assert.ok(
        proper.dmgTaken / proper.matches > 25,
        `playing properly took only ${(proper.dmgTaken / proper.matches).toFixed(0)}hp a match — he is a heavy bag`,
    );
});

t('walking in beats standing still and mashing', () => {
    // The point of the dash. Compared on damage rather than on match wins: both
    // of these policies now lose almost every match to an opponent who punishes,
    // and two rates near zero cannot be told apart. What the dash is FOR is
    // getting into range, so measure that.
    const perSecond = (r: Series) => r.dmgDealt / (r.frames / 60);
    assert.ok(
        perSecond(dashing) > perSecond(heavy),
        `dashing in dealt ${perSecond(dashing).toFixed(2)} dmg/s, mashing dealt ${perSecond(heavy).toFixed(2)}`,
    );
    assert.ok(
        dashing.inReach / dashing.frames > heavy.inReach / heavy.frames,
        'dashing in did not actually spend more time in range',
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

console.log('\nfocus steadies your own hands');

t('an ordinary head fights exactly as it did before', () => {
    // The anchor that keeps the spacing pass's balance intact: focus 60 is the
    // baseline, so every measurement in that pass still describes this build.
    assert.equal(bufferFramesFor(FOCUS_BASELINE), BUFFER_FRAMES);
    assert.equal(bufferFramesFor(), BUFFER_FRAMES, 'an unknown focus is not treated as ordinary');
});

t('a sharper player gets a more forgiving window, a duller one less', () => {
    assert.ok(bufferFramesFor(100) > BUFFER_FRAMES, 'coffee bought nothing');
    assert.ok(bufferFramesFor(0) < BUFFER_FRAMES, 'a bad night costs nothing');
    // Monotonic, so the stat always reads in the direction the player expects.
    let prev = 0;
    for (let f = 0; f <= 100; f += 5) {
        const w = bufferFramesFor(f);
        assert.ok(w >= prev, `focus ${f} narrowed the window`);
        prev = w;
    }
});

t('focus can never buy a window that breaks the game', () => {
    for (const f of [-500, -1, 0, 50, 100, 101, 9999, NaN]) {
        const w = bufferFramesFor(f);
        if (Number.isNaN(f)) { assert.ok(w >= BUFFER_MIN && w <= BUFFER_MAX, 'NaN focus escaped the clamp'); continue; }
        assert.ok(w >= BUFFER_MIN && w <= BUFFER_MAX, `focus ${f} gave a ${w}-frame window`);
    }
});

t('the edge is the player\'s alone — the AI keeps the baseline', () => {
    // Sharpening up must not sharpen the opponent, or the stat buys nothing.
    const s = createFight({ opponent: 'Foe', weapon: FISTS, rng: seeded(3), focus: 100 });
    assert.ok(s.p.bufFrames > BUFFER_FRAMES, 'a focused player got the baseline window');
    assert.equal(s.f.bufFrames, BUFFER_FRAMES, 'the AI got the player\'s coffee');
});

t('a focused press survives a longer lockout than a foggy one', () => {
    // The mechanical payoff, measured rather than asserted from the constant:
    // how long a press can wait and still come out.
    const survives = (focus: number, lockFrames: number): boolean => {
        const s = createFight({ opponent: 'Foe', weapon: FISTS, rng: seeded(11), focus });
        while (s.phase === 'intro') stepFight(s, blankInput(), DT);
        s.p.state = 'hitstun';
        s.p.hitstun = lockFrames;
        stepFight(s, press('a'), DT);
        for (let i = 0; i < lockFrames + 12; i++) {
            stepFight(s, blankInput(), DT);
            if (stateOf(s.p) === 'attack') return true;
        }
        return false;
    };
    // A window a foggy player misses and a sharp one catches.
    const gap = BUFFER_FRAMES + 1;
    assert.equal(survives(100, gap), true, 'a sharp player lost a press inside their own window');
    assert.equal(survives(0, gap), false, 'a foggy player kept a press past their window');
});

console.log(`\n${pass} fighter checks passed.\n`);
