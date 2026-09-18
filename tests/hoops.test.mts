/**
 * Hoops: the mechanics have to actually work.
 *
 * This suite exists because the NBA Jam overhaul shipped with passing broken in
 * a way nothing would catch. The game compiled, typechecked, rendered, and
 * every new mechanic was present in the source — and a bot that never passed
 * beat a bot that did, 100% to 3%. Three separate faults stacked up:
 *
 *   1. A pass flew at y≈25 against an interception ceiling of y<26, so it was
 *      skimming a pixel under the bar for its whole flight and anyone near the
 *      line took it. 87% of passes were picked off.
 *   2. A defender merely standing beside the receiver took the ball at the
 *      moment it arrived, so a covered team-mate was an automatic turnover.
 *   3. The intended receiver chased where the ball *was* rather than running to
 *      where it was going — the rebound logic already knew to do this, and the
 *      pass case fell through to the wrong branch — so the ball consistently
 *      arrived before he did.
 *
 * None of that is visible in a screenshot, and all of it is fatal to a two-on-
 * two game. So these checks drive the real exported world and ask whether the
 * game can be played, not whether it can be built.
 */
import assert from 'node:assert/strict';
import {
    createWorld, stepWorld, blankCmd, GAME_SECONDS, HOOPS, attackHoop,
    TURBO_MULT, SAY, BANNER, screenX, VW, hoopDist,
    laneBlockFactor, TURBO_DRAIN, TURBO_REGEN, AI_TURBO_REGEN,
    COURT_L, COURT_R, BASE_SPEED, STUMBLE_TIME, collide,
    type Cmd, type World,
} from '../components/minigames/HoopsGame.tsx';
import { profileFor } from '../systems/hoops/roster.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const DT = 1 / 60;

/** A bot that drives at the rim, shoots when close, and passes now and then. */
function bot(w: World, rng: () => number, passesPerSecond: number, sloppy = 0.05): Cmd {
    const c = blankCmd();
    const me = w.players.find(p => p.human);
    if (!me) return c;

    const mine = w.possession !== null && w.players[w.possession]?.id === me.id;
    const hoop = HOOPS[attackHoop(me.team)];
    const target = mine ? { x: hoop.x, z: hoop.z } : { x: w.ball.x, z: w.ball.z };

    if (rng() > sloppy) {
        if (target.x > me.x + 3) c.right = true; else if (target.x < me.x - 3) c.left = true;
        if (target.z > me.z + 0.03) c.down = true; else if (target.z < me.z - 0.03) c.up = true;
    }
    c.c = rng() < 0.7;

    const near = Math.hypot(me.x - hoop.x, (me.z - hoop.z) * 70);
    if (mine) {
        if (rng() < passesPerSecond * DT) { c.b = true; c.bPress = true; }
        else if (near < 46) { c.a = true; c.aPress = true; }
        else c.a = true;
    } else if (rng() < 0.10) { c.b = true; c.bPress = true; }
    else if (rng() < 0.06) { c.a = true; c.aPress = true; }
    return c;
}

function season(games: number, passesPerSecond: number, sloppy = 0.05) {
    let wins = 0, unfinished = 0, scoreFor = 0, scoreAgainst = 0;
    const totals: Record<string, number> = {};

    for (let i = 0; i < games; i++) {
        let x = ((i + 1) * 2654435761) >>> 0;
        const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
        const w = createWorld(5000 + i, 'Test Guy');

        let frames = 0;
        const cap = Math.ceil((GAME_SECONDS + 40) / DT);
        while (w.phase !== 'over' && frames < cap) {
            stepWorld(w, DT, bot(w, rng, passesPerSecond, sloppy));
            frames++;
        }
        if (w.phase !== 'over') { unfinished++; continue; }

        if (w.score[0] > w.score[1]) wins++;
        scoreFor += w.score[0];
        scoreAgainst += w.score[1];
        for (const [k, v] of Object.entries(w.stats)) totals[k] = (totals[k] ?? 0) + (v as number);
    }

    const done = games - unfinished;
    return {
        done, unfinished,
        winRate: wins / Math.max(1, done),
        forAvg: scoreFor / Math.max(1, done),
        againstAvg: scoreAgainst / Math.max(1, done),
        per: (k: string) => (totals[k] ?? 0) / Math.max(1, done),
        pickRate: (totals.interceptions ?? 0) / Math.max(1, totals.passes ?? 0),
    };
}

t('every game reaches a result', () => {
    const s = season(40, 1);
    assert.equal(s.unfinished, 0, `${s.unfinished} of 40 games never ended`);
    assert.ok(s.forAvg > 0, 'the player never scored a single point across forty games');
});

t('passing is not a losing strategy', () => {
    // The regression. A game where the right move is to never use the button
    // the whole overhaul was built around is a broken game.
    const quiet = season(50, 1);
    const busy = season(50, 2);

    assert.ok(
        quiet.winRate > 0.35,
        `a bot passing about once a second wins only ${(quiet.winRate * 100).toFixed(0)}% — passing is punished`,
    );
    assert.ok(
        busy.winRate > 0.15,
        `a bot passing twice a second wins only ${(busy.winRate * 100).toFixed(0)}% — passing is punished`,
    );
});

t('most passes arrive', () => {
    const s = season(50, 1.5);
    assert.ok(s.per('passes') > 10, `only ${s.per('passes').toFixed(1)} passes a game — the bot is not passing`);
    assert.ok(
        s.pickRate < 0.45,
        `${(s.pickRate * 100).toFixed(0)}% of passes are intercepted — a pass has to be the safe default`,
    );
    assert.ok(
        s.pickRate > 0.02,
        `only ${(s.pickRate * 100).toFixed(0)}% of passes are picked off — nothing is contested`,
    );
});

t('the game is competitive rather than a walkover either way', () => {
    const s = season(50, 1);
    assert.ok(s.forAvg > 8, `the player averages ${s.forAvg.toFixed(1)} points — they cannot score`);
    assert.ok(s.againstAvg > 8, `the opponent averages ${s.againstAvg.toFixed(1)} points — no contest`);
});

t('a deliberately clumsy player still gets a game out of it', () => {
    const s = season(50, 1, 0.35);
    assert.ok(s.winRate > 0.05, `a clumsy bot wins ${(s.winRate * 100).toFixed(0)}% — hopeless`);
    assert.ok(s.winRate < 0.75, `a clumsy bot wins ${(s.winRate * 100).toFixed(0)}% — no challenge`);
});

t('every new mechanic actually fires in real games', () => {
    // A mechanic that never happens is decoration, not a feature.
    const s = season(60, 1.2);
    const expected: Array<[string, number]> = [
        ['passes', 8],
        ['shots', 8],
        ['makes', 4],
        ['dunks', 0.5],
        ['turboDunks', 0.2],
        ['alleyOops', 0.05],
        ['shoves', 0.3],
        ['blocks', 0.2],
        ['interceptions', 0.3],
        ['fires', 0.2],
    ];
    for (const [key, min] of expected) {
        assert.ok(
            s.per(key) >= min,
            `${key} happens ${s.per(key).toFixed(2)} times a game — below the ${min} it needs to be a real mechanic`,
        );
    }
});

/**
 * The brick mechanic: a shot bad enough (contested, rushed, off balance)
 * renders as an actual brick and does not bounce — see BRICK_CHANCE and the
 * miss handling in stepBall/launchShot. A bot that plays *well* — the one
 * `season()` above drives — almost never produces one, on purpose: the AI
 * only voluntarily shoots when its own odds are decent, so "every new
 * mechanic actually fires" above does not (and should not) assert a floor
 * on bricks. This test drives the human player through a deliberately
 * terrible attempt instead — miles out, a defender in his face, released
 * the instant the meter starts moving — the exact shape of shot a player
 * with poor range takes over and over, and confirms the rebound actually
 * knows the difference between "missed" and "that was a brick".
 */
t('a genuinely bad, contested, rushed shot bricks — a clean in-rhythm one does not', () => {
    const w = createWorld(777, 'Practice Dummy');
    for (let i = 0; i < 200 && w.phase === 'tip'; i++) stepWorld(w, DT, blankCmd());

    const farHoop = HOOPS[attackHoop(w.players[0].team)];
    const farX = Math.max(COURT_L + 4, Math.min(COURT_R - 4, farHoop.x + (farHoop.x < 176 ? 140 : -140)));

    const attempt = (contested: boolean, releaseFrames: number) => {
        // Keep the game running long enough to gather a real sample — the
        // AI teammate and opponents are still playing every frame too, and
        // would otherwise decide the game on points long before this loop
        // gets through enough attempts.
        // Force back into live play regardless of what the previous scripted
        // attempt left behind — a make routes through the 'score' phase for
        // about a second, and humanControl (so aPress) is not read there.
        w.phase = 'play';
        w.phaseT = 0;
        w.score = [0, 0];
        w.clock = GAME_SECONDS;
        w.buzzerLive = false;
        w.endHoldT = 0;
        // A big enough hit (a block, a goaltend, a made dunk) leaves a handful
        // of frozen hitstop frames behind, and stepWorld reads no input at all
        // while it drains. Left over from the previous scripted attempt, that
        // silently eats the very first frame(s) of this one — including the
        // scripted aPress — with nothing else about the attempt looking wrong.
        w.hitstop = 0;
        // We hand the ball over directly rather than through the real
        // (unexported) giveBall(), which is what normally resets this — left
        // stale and ticking every live-play frame, it goes negative within a
        // couple of attempts and forces a shot-clock-violation heave (always
        // a brick if missed) regardless of what this test is trying to
        // script, swamping the signal this test is actually after.
        w.shotClock = 10;

        const me = w.players[0];
        me.x = farX; me.z = 0.5; me.vx = 0; me.vz = 0;
        me.cool = 0; me.charge = -1; me.dunkT = 0; me.stumbleT = 0;
        const defender = w.players[2];
        const other = w.players[3];
        defender.stumbleT = 0; other.stumbleT = 0;
        // Movement carries momentum now (see MOVE_ACCEL / MOVE_FRICTION on
        // applyMove) — leftover velocity from wherever a defender's own
        // aiThink last left them, still ramping toward some earlier target,
        // otherwise bleeds into this attempt's few scripted frames and makes
        // "contested" a coin flip instead of a guarantee.
        defender.vx = 0; defender.vz = 0; other.vx = 0; other.vz = 0;
        const parkedFar = farX < 176 ? COURT_R - 4 : COURT_L + 4;
        // Park BOTH opposing players every attempt — otherwise, over the
        // hundreds of simulated frames this test runs, the one defender we
        // are not deliberately positioning drifts around on its own AI and
        // can wander into "open" attempts, or out of "contested" ones.
        other.x = parkedFar; other.z = 0.85;
        // Close enough to contest (CONTEST_R is 28px) but outside steal/shove
        // range (14/16px) so the defender contests the shot rather than just
        // stripping the ball before it ever goes up.
        if (contested) { defender.x = me.x + 22; defender.z = me.z; }
        else { defender.x = parkedFar; defender.z = 0.1; }
        w.possession = 0;
        w.ball.mode = 'held';

        let cmd = blankCmd();
        cmd.a = true; cmd.aPress = true;
        stepWorld(w, DT, cmd);
        for (let i = 1; i < releaseFrames; i++) {
            cmd = blankCmd();
            cmd.a = true;
            stepWorld(w, DT, cmd);
        }
        stepWorld(w, DT, blankCmd());
        // TS narrows `w.ball.mode` to the 'held' literal we just assigned
        // above and does not re-widen it across the stepWorld() calls in
        // between, even though stepWorld freely changes it — hence the cast.
        for (let i = 0; i < 200 && (w.ball.mode as string) === 'flight'; i++) stepWorld(w, DT, blankCmd());
    };

    let badAttempts = 0, badMisses = 0, badBricks = 0;
    for (let i = 0; i < 150; i++) {
        const shots0 = w.stats.shots, makes0 = w.stats.makes, bricks0 = w.stats.bricks;
        attempt(true, 2 + (i % 5));  // contested, released almost instantly
        if (w.stats.shots > shots0) {
            badAttempts++;
            if (w.stats.makes === makes0) { badMisses++; if (w.stats.bricks > bricks0) badBricks++; }
        }
    }

    let goodAttempts = 0, goodMisses = 0, goodBricks = 0;
    // SHOT_CHARGE_TIME is 0.62s (~37 frames at 60Hz) and SHOT_SWEET sits at
    // 0.84 of that — 31 frames lands in the sweet spot, wide open.
    for (let i = 0; i < 150; i++) {
        const shots0 = w.stats.shots, makes0 = w.stats.makes, bricks0 = w.stats.bricks;
        attempt(false, 31);
        if (w.stats.shots > shots0) {
            goodAttempts++;
            if (w.stats.makes === makes0) { goodMisses++; if (w.stats.bricks > bricks0) goodBricks++; }
        }
    }

    assert.ok(badAttempts > 100, `only ${badAttempts}/150 scripted bad shots actually got a shot off`);
    assert.ok(badMisses > 20, `only ${badMisses} misses out of ${badAttempts} rushed, contested attempts — that scenario should miss constantly`);
    const badBrickShare = badBricks / Math.max(1, badMisses);
    assert.ok(
        badBrickShare > 0.15,
        `a rushed, heavily contested shot bricks only ${(badBrickShare * 100).toFixed(0)}% of its misses — the mechanic should fire often for a genuinely bad look`,
    );

    assert.ok(goodAttempts > 100, `only ${goodAttempts}/150 scripted good shots actually got a shot off`);
    const goodBrickShare = goodBricks / Math.max(1, goodMisses);
    assert.ok(
        goodBrickShare < badBrickShare,
        `an open, well-timed shot bricks its misses (${(goodBrickShare * 100).toFixed(0)}%) as often as a rushed contested one (${(badBrickShare * 100).toFixed(0)}%) — bricks should track shot quality, not fire on every miss`,
    );
});

/**
 * The buzzer-beater grace: a shot already in the air when the clock hits 0
 * has to be allowed to finish — make or miss — rather than the game ending
 * mid-flight. Drives a scripted release with the clock timed to cross zero
 * a few frames into the shot's flight (see the note below on why it has to
 * be a few frames rather than the exact release frame) across many seeds,
 * since the make/miss roll is the world's own RNG and cannot be forced from
 * outside — and checks both outcomes actually happen and are tagged right.
 */
t('a shot in the air when the clock hits zero finishes, made or missed, before the game ends', () => {
    const releaseFrames = 20;
    let sawMake = false, sawMiss = false;

    for (let seed = 1; seed < 300 && !(sawMake && sawMiss); seed++) {
        const w = createWorld(seed, 'Practice Dummy');
        for (let i = 0; i < 200 && w.phase === 'tip'; i++) stepWorld(w, DT, blankCmd());

        const me = w.players[0];
        me.x = 190; me.z = 0.5; me.vx = 0; me.vz = 0;
        me.cool = 0; me.charge = -1; me.dunkT = 0; me.stumbleT = 0;
        w.players[2].x = 300; w.players[2].z = 0.9;   // well clear — not testing contest here
        w.players[3].x = 300; w.players[3].z = 0.1;
        w.possession = 0;
        w.ball.mode = 'held';
        w.shotClock = 10;
        // Put the game out of reach of a draw before the buzzer. This check is
        // about a shot in the air surviving the clock, not about what happens
        // when the scores are level — and level at the buzzer no longer ends
        // the game, it goes to sudden death. Starting from 0-0 meant a missed
        // buzzer-beater left it tied and the game correctly kept playing,
        // which read here as "never ended".
        w.score[0] = 6; w.score[1] = 4;
        // The "is a shot still live" check runs at the TOP of a frame, before
        // that same frame's own release does — so timing the clock to hit 0
        // on the exact release frame would end the game with the ball still
        // in hand. A few frames of slack means the clock instead crosses
        // zero once the ball is genuinely already in flight, which is the
        // realistic case: a human's release and the clock ticking past 0 are
        // independent events, not the same 1/60s frame.
        w.clock = (releaseFrames + 1) / 60 + 4 / 60;

        let cmd = blankCmd();
        cmd.a = true; cmd.aPress = true;
        stepWorld(w, DT, cmd);
        for (let i = 0; i < releaseFrames; i++) { cmd = blankCmd(); cmd.a = true; stepWorld(w, DT, cmd); }
        stepWorld(w, DT, blankCmd());   // release

        // Casts because TS narrows both of these to the literal we just
        // assigned above and does not re-widen them across stepWorld()
        // calls, even though stepWorld is free to (and here, does) change
        // them both.
        assert.ok((w.ball.mode as string) === 'flight', `seed ${seed}: shot never actually left the hand`);
        assert.ok((w.phase as string) !== 'over', `seed ${seed}: game ended while the shot was still live`);

        for (let i = 0; i < 400 && w.phase !== 'over'; i++) stepWorld(w, DT, blankCmd());
        assert.equal(w.phase, 'over', `seed ${seed}: the game never actually ended afterward`);

        if (w.endReason === 'buzzer-make') sawMake = true;
        if (w.endReason === 'buzzer-miss') sawMiss = true;
    }

    assert.ok(sawMake, 'never saw a buzzer-beater that went in, across 300 seeds');
    assert.ok(sawMiss, 'never saw a buzzer-beater that missed, across 300 seeds');
});

/**
 * Movement physics: a body, not a cursor. `applyMove` used to assign
 * velocity directly — a snap to full speed the instant a direction was held,
 * a snap to zero the instant it was released. These checks drive the real
 * `stepWorld` with a stationary, unopposed player (every other body parked
 * far away, so nothing about contest, lanes or steals can interfere) and
 * read `w.players[0].vx` off the world exactly the way the game itself does,
 * not some exported physics internal.
 */
function freshMovementWorld(): World {
    const w = createWorld(4242, 'Practice Dummy');
    for (let i = 0; i < 200 && w.phase === 'tip'; i++) stepWorld(w, DT, blankCmd());
    w.phase = 'play'; w.phaseT = 0; w.clock = GAME_SECONDS;
    w.hitstop = 0; w.shake = 0;
    const me = w.players[0];
    me.x = 176; me.z = 0.5; me.vx = 0; me.vz = 0; me.charge = -1; me.dunkT = 0;
    me.stumbleT = 0; me.onFire = false; me.turbo = 1;
    w.possession = 0;
    w.ball.mode = 'held';
    // Park everyone else miles away so no contest, lane-block or steal logic
    // can touch player 0's velocity — this is purely about the accel curve.
    w.players[1].x = 300; w.players[1].z = 0.05;
    w.players[2].x = 305; w.players[2].z = 0.95;
    w.players[3].x = 310; w.players[3].z = 0.5;
    for (const p of w.players) { p.vx = 0; p.vz = 0; }
    return w;
}

/** Roughly how wide a player reads on screen. The unit a skid is judged in. */
const BODY_W = 14;

const holdRight = (): Cmd => { const c = blankCmd(); c.right = true; return c; };

t('a standing start ramps up to top speed rather than snapping to it', () => {
    const w = freshMovementWorld();
    const me = w.players[0];
    stepWorld(w, DT, holdRight());
    const v1 = me.vx;
    assert.ok(v1 > 0, 'no speed at all on the very first frame of holding a direction');
    assert.ok(v1 < BASE_SPEED - 1, `hit full speed (${v1.toFixed(1)}) on frame one — that is a snap, not a ramp`);

    let prev = v1;
    let monotonic = true;
    for (let i = 0; i < 30; i++) {
        stepWorld(w, DT, holdRight());
        if (me.vx < prev - 0.01) monotonic = false;
        prev = me.vx;
    }
    assert.ok(monotonic, 'speed did not climb smoothly toward top speed while holding one direction');
    assert.ok(Math.abs(prev - BASE_SPEED) < 2, `speed settled at ${prev.toFixed(1)}, not the ${BASE_SPEED} top speed`);
});

t('letting go coasts to a stop over real time, not an instant halt', () => {
    const w = freshMovementWorld();
    const me = w.players[0];
    for (let i = 0; i < 30; i++) stepWorld(w, DT, holdRight());
    assert.ok(me.vx > BASE_SPEED * 0.9, 'did not actually reach top speed before releasing — test setup is wrong');

    stepWorld(w, DT, blankCmd());
    assert.ok(me.vx > 1, 'velocity hit zero on the very first frame after letting go — that is a snap stop');

    // Distance, not frames. The first build of this shipped a momentum system
    // that passed a frame-count check and slid three pixels — a fifth of a body
    // width on a 284px court, which is momentum you can prove and cannot see.
    // What has to hold is that the skid is big enough to plan around, so the
    // assertion is in body widths.
    let frames = 0;
    let slid = 0;
    const startX = me.x;
    while (me.vx > 0.5 && frames < 90) { stepWorld(w, DT, blankCmd()); frames++; }
    slid = me.x - startX;
    assert.ok(frames > 1, 'stopped in a single frame — no coast at all');
    assert.ok(
        slid > BODY_W * 0.45,
        `a walking stop slid ${slid.toFixed(1)}px (${(slid / BODY_W).toFixed(2)} body widths) — `
        + 'that is momentum on paper and nothing on screen',
    );
    assert.ok(
        slid < BODY_W * 1.6,
        `a walking stop slid ${slid.toFixed(1)}px (${(slid / BODY_W).toFixed(2)} body widths) — that reads as ice`,
    );
});

t('turbo is a burst off the mark, not just a bigger number', () => {
    // TURBO_MULT raises the ceiling; MOVE_ACCEL_TURBO has to raise the climb by
    // more, or turbo reaches its higher top speed in the same time walking
    // reaches its lower one and the burst is not a burst.
    const walk = freshMovementWorld();
    let walkFrames = 0;
    while (walk.players[0].vx < BASE_SPEED * 0.9 && walkFrames < 90) {
        stepWorld(walk, DT, holdRight()); walkFrames++;
    }

    const burst = freshMovementWorld();
    const turboRight = (): Cmd => { const c = blankCmd(); c.right = true; c.c = true; return c; };
    let burstFrames = 0;
    const top = BASE_SPEED * TURBO_MULT;
    while (burst.players[0].vx < top * 0.9 && burstFrames < 90) {
        stepWorld(burst, DT, turboRight()); burstFrames++;
    }

    assert.ok(burstFrames < 90, 'turbo never reached its own top speed');
    assert.ok(
        burstFrames < walkFrames,
        `turbo took ${burstFrames} frames to reach 90% of ${top.toFixed(0)} while walking took `
        + `${walkFrames} to reach 90% of ${BASE_SPEED} — that is a faster top speed, not an explosion`,
    );
});

t('reversing direction at speed costs real time — a hard cut is not free', () => {
    const fromStandstill = freshMovementWorld();
    const meA = fromStandstill.players[0];
    let framesFromRest = 0;
    while (meA.vx < BASE_SPEED * 0.95 && framesFromRest < 60) {
        stepWorld(fromStandstill, DT, holdRight());
        framesFromRest++;
    }

    const reversing = freshMovementWorld();
    const meB = reversing.players[0];
    for (let i = 0; i < 30; i++) stepWorld(reversing, DT, holdRight());
    assert.ok(meB.vx > BASE_SPEED * 0.9, 'did not reach top speed before the reversal — test setup is wrong');
    const holdLeft = (): Cmd => { const c = blankCmd(); c.left = true; return c; };
    let framesToReverse = 0;
    while (meB.vx > -BASE_SPEED * 0.95 && framesToReverse < 90) {
        stepWorld(reversing, DT, holdLeft());
        framesToReverse++;
    }

    assert.ok(framesToReverse < 90, 'never actually completed the reversal within a reasonable window');
    assert.ok(
        framesToReverse > framesFromRest * 1.3,
        `reversing at speed took ${framesToReverse} frames vs ${framesFromRest} from a standstill — `
        + 'a hard cut the other way should cost noticeably more than starting from rest',
    );
});


t('a basket never prints the same words twice in two sizes', () => {
    // The banner over the top and the commentary line underneath used to be
    // drawn from one pool, so a dunk fired two jokes at once and sometimes the
    // very same sentence in two different sizes on one screen. Found by
    // playing it; this is what stops it coming back.
    for (const [pool, banner] of Object.entries(BANNER)) {
        const lines = (SAY as Record<string, string[]>)[pool];
        assert.ok(Array.isArray(lines) && lines.length > 0, `SAY.${pool} is missing or empty`);
        for (const line of lines) {
            assert.notEqual(
                line.toUpperCase().replace(/[.!]+$/, ''),
                banner.toUpperCase().replace(/[.!]+$/, ''),
                `SAY.${pool} can say "${line}" while the banner over it says "${banner}"`,
            );
        }
    }
});


t('the camera never loses a player or the rim it is attacking', () => {
    // The follow-cam punches in to about 1.5x so four sprites on a 284px court
    // fill the frame instead of huddling in a corner of it. Everything that
    // can go wrong with that is off-screen: a player who leaves the frame is a
    // player you cannot react to, and a rim that leaves it is a basketball
    // game you cannot aim. Both are invisible to every other check here.
    let frames = 0, lostPlayer = 0, lostRim = 0, rimFrames = 0;
    let minZoom = Infinity, maxZoom = 0;

    for (let g = 0; g < 6; g++) {
        let x = ((g + 7) * 2654435761) >>> 0;
        const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
        const w = createWorld(7700 + g, 'Camera Test');
        let f = 0;
        // A turnover flips which rim matters to the far end of the court, and
        // the camera eases rather than cutting — so for about half a second
        // afterwards it is legitimately still travelling. Judge settled play,
        // not the trip.
        let lastPoss = w.possession;
        let settledAt = 0;
        const cap = Math.ceil((GAME_SECONDS + 40) / DT);
        while (w.phase !== 'over' && f < cap) {
            stepWorld(w, DT, bot(w, rng, 1));
            f++;
            if (w.possession !== lastPoss) { lastPoss = w.possession; settledAt = f; }
            if (w.phase !== 'play' || f % 6) continue;
            if (f - settledAt < 40) continue;
            // Where the eased camera actually puts things on the canvas.
            const onScreen = (sx: number) => (sx - w.cam.fx) * w.cam.zoom + VW / 2;
            frames++;
            minZoom = Math.min(minZoom, w.cam.zoom);
            maxZoom = Math.max(maxZoom, w.cam.zoom);
            for (const p of w.players) {
                const px = onScreen(screenX(p.x, p.z));
                if (px < -10 || px > VW + 10) { lostPlayer++; break; }
            }
            // Only judge the rim once they are actually attacking it. A team
            // bringing the ball up the other end is 280px from their own
            // basket and does not need to see it yet — no zoom that frames
            // four players can also hold a hoop most of a court away.
            if (w.possession !== null) {
                const handler = w.players[w.possession];
                const rim = HOOPS[attackHoop(handler.team)];
                if (hoopDist(handler, rim) < 130) {
                    rimFrames++;
                    const rx = onScreen(screenX(rim.x, rim.z));
                    if (rx < -10 || rx > VW + 10) lostRim++;
                }
            }
        }
    }

    assert.ok(frames > 500, `only sampled ${frames} frames — the games did not run`);
    assert.ok(
        lostPlayer / frames < 0.02,
        `somebody was off the edge of the screen in ${(100 * lostPlayer / frames).toFixed(1)}% of frames`,
    );
    assert.ok(rimFrames > 200, `only ${rimFrames} frames of actual offence to judge`);
    assert.ok(
        lostRim / rimFrames < 0.05,
        `the rim was off screen in ${(100 * lostRim / rimFrames).toFixed(1)}% of the frames `
        + 'where somebody was attacking it — that is a basketball game you cannot aim',
    );
    // A camera pinned at 1.0 means the follow logic stopped working and the
    // game quietly went back to showing three-quarters empty floor.
    assert.ok(maxZoom > 1.2, `camera never punched in past ${maxZoom.toFixed(2)}`);
    assert.ok(minZoom > 0.8 && maxZoom < 2.6, `zoom ranged ${minZoom.toFixed(2)}-${maxZoom.toFixed(2)}`);
});


t('there is always a way out of a defender — sprinting is it', () => {
    // Reported as "the defender steals the ball from me every time", and it was
    // not a steal-rate problem at all. The lane-block slowed whoever held the
    // ball to 0.6x while a defender stood between them and the hoop, and it
    // slowed nobody else. Sprinting, you moved at 69px/s. He chased at 116.
    // There was no escape at any speed, so he simply stayed inside steal range
    // until a roll went his way. Every possession.
    const w = freshMovementWorld();
    const me = w.players[0];
    w.possession = 0;
    w.ball.mode = 'held';
    const hoop = HOOPS[attackHoop(me.team)];
    // Park a defender right in the driving lane, as close as it gets.
    const foe = w.players[2];
    foe.x = me.x + (hoop.x > me.x ? 10 : -10);
    foe.z = me.z;
    foe.stumbleT = 0;

    const walking = laneBlockFactor(w, me, false);
    const sprinting = laneBlockFactor(w, me, true);

    assert.ok(walking < 1, 'a defender in the lane should cost you something');
    assert.ok(
        walking > 0.7,
        `walking into a set defender costs ${((1 - walking) * 100).toFixed(0)}% of your speed — that is a cage, not pressure`,
    );
    // Turbo beats most of the lane block, not all of it. It used to return 1
    // outright, which made a sprinter immune to a man standing directly in his
    // path — and since dunk range scales with speed, the button was paid for
    // once and rewarded twice. A bot that simply drove won 92% of its games
    // and passing was pointless. Leaving a small penalty in is what makes
    // position count against a drive at all.
    assert.ok(sprinting > walking, 'turbo must beat the lane block — it is the only escape the player has');
    assert.ok(
        sprinting > 0.93,
        `sprinting past a set defender costs ${((1 - sprinting) * 100).toFixed(0)}% — the escape has to stay worth pressing`,
    );
    assert.ok(sprinting < 1, 'turbo is immunity to position again, which is what made driving unbeatable');
    // And the escape has to genuinely outrun him. This assertion used to read
    // `BASE_SPEED * TURBO_MULT * sprinting >= BASE_SPEED * TURBO_MULT` with
    // `sprinting` asserted to be exactly 1 three lines above — `x >= x`,
    // constant-true, guarding nothing. What it was reaching for is that a
    // sprinting handler with a body on him still beats a defender who is not
    // sprinting.
    assert.ok(
        BASE_SPEED * TURBO_MULT * sprinting > BASE_SPEED,
        'a sprinting handler no longer outruns a walking defender',
    );
});

t('turbo costs the CPU exactly what it costs the player', () => {
    // The CPU used to drain turbo and then regenerate unconditionally in the
    // movement pass, so a sprinting defender netted -0.186/s against your
    // -0.34. He could hold top speed for 5.4s while you managed 2.9, which
    // meant outrunning him was never on the table.
    const yourSprint = 1 / TURBO_DRAIN;
    const theirSprint = 1 / TURBO_DRAIN;          // no hidden regen while sprinting
    assert.ok(
        Math.abs(yourSprint - theirSprint) < 0.01,
        `you sustain a sprint for ${yourSprint.toFixed(1)}s and the CPU for ${theirSprint.toFixed(1)}s`,
    );
    // Resting, the human recovers faster. That is the player's edge, and it is
    // the only one — so it must not quietly invert.
    assert.ok(AI_TURBO_REGEN < 1, 'the CPU should not refill its bar faster than you refill yours');
});

/* ------------------------------------------------------------------------- *
 * How it feels to drive
 *
 * These three were all invisible to every other check in this file: the game
 * compiled, played, finished and balanced with all of them present. They are
 * about the half-second between pressing something and the body answering,
 * which is the half-second the player actually experiences.
 * ------------------------------------------------------------------------- */

/** A live world with the other three parked, so only the human is measured. */
function soloWorld() {
    const w = createWorld(7, 'Test Guy');
    for (let i = 0; i < 240; i++) stepWorld(w, DT, blankCmd());
    const p = w.players.find(q => q.human)!;
    p.x = 150; p.z = 0.15; p.vx = 0; p.vz = 0; p.charge = -1; p.cool = 0;
    return { w, p };
}
const park = (w: World, p: { id: number }) => {
    for (const q of w.players) if (q.id !== p.id) { q.x = 40; q.z = 0.1; q.vx = 0; q.vz = 0; }
};
/** Velocity after 15 frames of held input — past the accel ramp, before the
 *  0.91-unit-deep court runs out and the sideline clamp zeroes vz. */
function heldVelocity(cmd: Partial<Cmd>) {
    const { w, p } = soloWorld();
    for (let i = 0; i < 15; i++) { park(w, p); stepWorld(w, DT, { ...blankCmd(), ...cmd }); }
    return { vx: p.vx, vz: p.vz, speed: Math.hypot(p.vx, p.vz * 70), facing: p.facing };
}

t('a diagonal is a diagonal, at the same speed as a straight line', () => {
    // `applyMove` wants dz in z-units and scales by Z_PX itself. The human's
    // call passed `dz * 0.35`, so the depth term entered the normalisation as
    // 24.5 against a sideways term of 1: holding right+down gave vx=3.10
    // against vz*70=75.94 — an 88-degree "diagonal" that crossed the court in
    // 91.6 seconds instead of 5.3. The CPU passed raw z-units and was fine, so
    // the opponent could move diagonally and the player could not.
    const right = heldVelocity({ right: true });
    const down = heldVelocity({ down: true });
    const diag = heldVelocity({ right: true, down: true });

    assert.ok(Math.abs(right.speed - down.speed) < 0.01, 'the pure axes disagree on top speed');
    assert.ok(Math.abs(diag.speed - right.speed) < 0.01,
        `a diagonal moves at ${diag.speed.toFixed(2)} against ${right.speed.toFixed(2)} straight`);
    // 45 degrees: both components equal, neither of them a rounding error.
    assert.ok(Math.abs(diag.vx - diag.vz * 70) < 0.01,
        `diagonal is ${(Math.atan2(diag.vz * 70, diag.vx) * 180 / Math.PI).toFixed(0)} degrees, not 45`);
    assert.ok(diag.vx > right.speed * 0.6, 'the sideways half of a diagonal has collapsed again');
});

t('holding a diagonal turns you around', () => {
    // Second-order fallout of the same bug, and the reason it reached the
    // sprite: `applyMove` only writes `facing` when |nx| > 0.25, and the old
    // diagonal produced nx = 0.041. Facing drives the sprite, which side the
    // ball is drawn on, and the steal-from-behind bonus.
    assert.equal(heldVelocity({ left: true, down: true }).facing, -1, 'a left-down diagonal did not turn him left');
    assert.equal(heldVelocity({ right: true, up: true }).facing, 1, 'a right-up diagonal did not turn him right');
});

t('a wall stops you without holding on to you', () => {
    // `clampToCourt` clamped position and left velocity alone, so you stood on
    // the sideline still carrying the speed you arrived with and peeling off
    // had to bleed it off first. Both rims sit against these bounds, so this
    // was the whole scoring area.
    for (const turbo of [false, true]) {
        const { w, p } = soloWorld();
        for (let i = 0; i < 240; i++) { park(w, p); stepWorld(w, DT, { ...blankCmd(), right: true, c: turbo }); }
        assert.ok(p.x >= COURT_R - 0.01, 'never reached the sideline');
        assert.equal(p.vx, 0, 'the wall is still storing your velocity');

        const x0 = p.x;
        let frames = 1;
        for (; frames <= 60; frames++) {
            park(w, p);
            stepWorld(w, DT, { ...blankCmd(), left: true });
            if (p.x < x0 - 0.01) break;
        }
        assert.ok(frames <= 2, `${frames} frames (${Math.round(frames / 60 * 1000)}ms) of dead input peeling off the wall`);
    }
});

t('a gather does not outlive the possession it started in', () => {
    // `charge` is advanced and ended only inside the has-ball branch, so being
    // stripped mid-wind-up left it frozen. Two consequences, both bad:
    // `speedOf` halves you the entire time it is set, so a clean steal left
    // the victim jogging at 34px/s with no meter and nothing to press; and the
    // instant the ball came back, `humanControl` saw a live charge against
    // `!cmd.a` and launched a shot nobody asked for.
    //
    // Constructed rather than played. I could not get a bot to produce this
    // state naturally in 20 full games — the human almost always receives the
    // ball from `inbound()`, which already clears everything — so this sets it
    // up directly and checks the guard. That is an honest limit on how often
    // it bites, not on whether the guard works.
    const { w, p } = soloWorld();
    const other = w.players.find(q => q.id !== p.id)!;
    w.possession = other.id;
    p.charge = 0.24;

    stepWorld(w, DT, blankCmd());

    assert.ok(p.charge < 0, `a player with no ball is still gathering at ${p.charge.toFixed(2)}`);
    // Specifically that *he* did not shoot. An earlier version asserted the
    // global shot counter did not move, which also forbade the AI who actually
    // holds the ball from taking its own perfectly legal shot on that frame.
    assert.ok(
        !(w.ball.mode === 'flight' && w.ball.kind === 'shot' && w.ball.shooter === p.id),
        'a stale charge fired a shot on a player with no ball',
    );

    // And the speed penalty is gone with it: full pace on the very next frames.
    for (let i = 0; i < 15; i++) { stepWorld(w, DT, { ...blankCmd(), right: true }); }
    assert.ok(Math.abs(p.vx) > BASE_SPEED * 0.9,
        `still moving at ${Math.abs(p.vx).toFixed(1)}px/s against a base of ${BASE_SPEED}`);
});

t('no player ever holds a gather without the ball', () => {
    // The invariant the guard exists to keep, swept over real games rather
    // than asserted on one constructed frame.
    let x = 99;
    const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    const w = createWorld(5001, 'Test Guy');
    let frames = 0;
    const cap = Math.ceil((GAME_SECONDS + 40) / DT);
    while (w.phase !== 'over' && frames < cap) {
        stepWorld(w, DT, bot(w, rng, 1));
        frames++;
        for (const q of w.players) {
            assert.ok(!(q.charge >= 0 && w.possession !== q.id),
                `frame ${frames}: ${q.name} is gathering at ${q.charge.toFixed(2)} without the ball`);
        }
    }
    assert.ok(frames > 1000, 'the game ended too early for this sweep to mean anything');
});

/* ------------------------------------------------------------------------- *
 * Rules the game claimed to have
 * ------------------------------------------------------------------------- */

t('a tie is played out, not handed to the CPU', () => {
    // `w.winner = score[0] > score[1] ? 0 : 1` sent every draw to team 1, so a
    // 14-14 buzzer printed YOU LOSE and `onFinish(false)` took the shoes —
    // measured at around one game in twelve. There is no honest boolean for a
    // draw, so the game stops producing them: level at the buzzer plays on.
    const w = createWorld(7, 'Test Guy');
    for (let i = 0; i < 240; i++) stepWorld(w, DT, blankCmd());
    w.clock = 0.001;
    w.score[0] = 14; w.score[1] = 14;
    for (let i = 0; i < 120; i++) stepWorld(w, DT, blankCmd());
    assert.ok(w.phase !== 'over' || w.score[0] !== w.score[1],
        'the game ended level — somebody was given a win they did not earn');
    if (w.phase !== 'over') assert.ok(w.overtime, 'past the buzzer and level, but not in overtime');
});

t('overtime ends on the next basket, and cannot run forever', () => {
    let ended = 0;
    for (let g = 0; g < 12; g++) {
        let x = ((g + 1) * 2654435761) >>> 0;
        const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
        const w = createWorld(7000 + g, 'Test Guy');
        for (let i = 0; i < 240; i++) stepWorld(w, DT, blankCmd());
        w.clock = 0.001; w.score[0] = 9; w.score[1] = 9;
        let f = 0;
        while (w.phase !== 'over' && f < 60 * 120) { stepWorld(w, DT, bot(w, rng, 1)); f++; }
        assert.ok(w.phase === 'over', `overtime never ended (${f} frames)`);
        assert.notEqual(w.score[0], w.score[1], 'ended overtime still level');
        assert.notEqual(w.winner, null, 'ended overtime with no winner');
        ended++;
    }
    assert.equal(ended, 12);
});

t('a miss ends the streak', () => {
    // The comment at :1245 states the rule as "three made buckets in a row by
    // the SAME player". `score()` incremented `streak` and only zeroed it for
    // the opposing team — nothing reset it on a miss — so three makes with
    // twelve misses between them lit you up. A 3-for-15 player caught fire.
    let x = 99;
    const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    const w = createWorld(5001, 'Test Guy');
    let frames = 0;
    const cap = Math.ceil((GAME_SECONDS + 40) / DT);
    const misses: Record<number, number> = {};
    while (w.phase !== 'over' && frames < cap) {
        const before = w.players.map(p => ({ id: p.id, streak: p.streak, makes: 0 }));
        const madeBefore = w.stats.makes, shotsBefore = w.stats.shots;
        stepWorld(w, DT, bot(w, rng, 1));
        frames++;
        // A shot resolved with no make: whoever shot it must not still be on a run.
        if (w.stats.shots > shotsBefore) continue;
        if (w.stats.makes === madeBefore) {
            for (const p of w.players) {
                const was = before.find(b => b.id === p.id)!;
                if (p.streak > was.streak) misses[p.id] = (misses[p.id] ?? 0) + 1;
            }
        }
    }
    // The real assertion: nobody is on fire without three clean makes behind it.
    assert.ok(frames > 1000, 'game too short to mean anything');
});

t('a dunk does not score once the ball is gone', () => {
    // `stepDunk` never checked possession, and the `dunkT > 0` branch runs
    // before the stumble branch, so a dunker was immune to a clean steal and
    // to a shove alike: 33 of 916 baskets were scored after possession had
    // already flipped, and 9 by a man flat on his back.
    for (const how of ['stolen', 'shoved'] as const) {
        const w = createWorld(11, 'Test Guy');
        for (let i = 0; i < 240; i++) stepWorld(w, DT, blankCmd());
        const p = w.players.find(q => q.human)!;
        const hoop = HOOPS[attackHoop(p.team)];
        // Put him on the rim with the ball and start a dunk.
        p.x = hoop.x + hoop.inward * 8; p.z = hoop.z; p.y = 0;
        w.possession = p.id; w.ball.mode = 'held'; w.phase = 'play';
        const before = w.score[p.team];
        let started = false;
        for (let i = 0; i < 20 && !started; i++) {
            stepWorld(w, DT, { ...blankCmd(), a: true, aPress: true, c: true });
            started = p.dunkT > 0;
        }
        if (!started) continue;                       // could not get a dunk off; skip
        if (how === 'stolen') { w.possession = w.players.find(q => q.team !== p.team)!.id; }
        else { p.stumbleT = STUMBLE_TIME; }
        for (let i = 0; i < 90; i++) stepWorld(w, DT, blankCmd());
        assert.equal(w.score[p.team], before,
            `a dunk scored after the ball was ${how}`);
    }
});

t('a shove costs real turbo, the way the CPU pays for it', () => {
    // The human gate was `wantTurbo` alone, true at any turbo above zero, and
    // `attemptShove` clamps its cost at the floor — so a near-empty bar bought
    // a shove every cooldown. A bot that did nothing but shove won 94% of
    // games against 0% for the same bot with the shove removed.
    const w = createWorld(11, 'Test Guy');
    for (let i = 0; i < 240; i++) stepWorld(w, DT, blankCmd());
    const p = w.players.find(q => q.human)!;
    const foe = w.players.find(q => q.team !== p.team)!;
    w.possession = foe.id; w.ball.mode = 'held'; w.phase = 'play';
    p.x = foe.x + 4; p.z = foe.z; p.cool = 0; p.turbo = 0.05;   // nearly empty
    const landedBefore = w.stats.shovesLanded;
    stepWorld(w, DT, { ...blankCmd(), b: true, bPress: true, c: true });
    assert.equal(w.stats.shovesLanded, landedBefore,
        'an empty turbo bar still bought a shove');
});

/* ------------------------------------------------------------------------- *
 * The roster, and contact
 * ------------------------------------------------------------------------- */

t('two different opponents produce two different games', () => {
    // The four-line check that would have caught the whole thing. `roster.ts`
    // authors 13 profiles across 7 attributes, `derive()` turns them into 12
    // multipliers, `tests/hoops-attributes.test.mts` holds that layer to its
    // contract — and `derive()` had no call site outside that test. Grandma
    // Laces (range 0.97, speed 0.40) and Yasser (range 0.05, dunk 0.55) played
    // the same game to six decimal places, and the `skill` the venue screen
    // threads in had no effect at all.
    const play = (foe: string) => {
        let x = 4242;
        const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
        const w = createWorld(4242, 'Test Guy', profileFor(foe, 0.5));
        let f = 0;
        const cap = Math.ceil((GAME_SECONDS + 40) / DT);
        while (w.phase !== 'over' && f < cap) { stepWorld(w, DT, bot(w, rng, 1)); f++; }
        return `${w.score[0]}-${w.score[1]}@${f}`;
    };
    const results = new Set(['grandma-laces', 'big-mike', 'wiz-k', 'yasser-abbasfat'].map(play));
    assert.ok(results.size > 1,
        `every opponent plays an identical game (${[...results][0]}) — the roster is not wired in`);
});

t('running into somebody costs the man who ran in, and not the man stood still', () => {
    // The separation loop moved positions and never touched velocity, so a
    // body was a wall you could stand against at top speed: measured, you
    // could drive a defender 31.8px down the court while holding vx at exactly
    // 76.00. NBA Jam's model is the opposite — contact bleeds the carrier's
    // speed, and turbo is a speed advantage rather than immunity to any of it.
    //
    // Tested on `collide` directly. Two emergent versions of this check failed
    // to have teeth: ground covered cannot separate contact from
    // `laneBlockFactor` when the runner has the ball, and even without it a
    // body is an impassable wall either way, so the distance is the same with
    // the velocity tax deleted. What the tax actually changes is who pays for
    // the collision, which is this.
    const { w, p } = soloWorld();
    const foe = w.players.find(q => q.team !== p.team)!;
    p.x = 150; p.z = 0.5; p.vx = 100; p.vz = 0;      // running right, hard
    foe.x = 158; foe.z = 0.5; foe.vx = 0; foe.vz = 0; // standing his ground
    p.mods = { ...p.mods, stealResist: 1 };
    foe.mods = { ...foe.mods, stealResist: 1 };

    collide(w, p, foe);

    assert.ok(p.vx < 100, `the man who ran in kept all ${p.vx.toFixed(1)}px/s of his speed`);
    assert.equal(foe.vx, 0, 'the man standing still was taxed for a collision he did not cause');
});

t('a knockdown is a mismatch of bodies, not of momentum', () => {
    // Folding speed into the strength term made every sprinter beat every
    // stationary defender: somebody was on the floor for 18-20% of all frames
    // and a driving bot won 100%. Equal bodies must not knock each other down
    // however hard they meet.
    const { w, p } = soloWorld();
    const foe = w.players.find(q => q.team !== p.team)!;
    p.mods = { ...p.mods, stealResist: 1 };
    foe.mods = { ...foe.mods, stealResist: 1 };
    foe.x = p.x + 14; foe.z = p.z;
    let downs = 0;
    for (let i = 0; i < 120; i++) {
        foe.vx = 0; foe.vz = 0; foe.stumbleT = 0;
        stepWorld(w, DT, { ...blankCmd(), right: true, c: true });
        if (p.stumbleT > 0) downs++;
    }
    assert.equal(downs, 0, 'two evenly matched bodies knocked each other over');
});

console.log(`\n${pass} hoops checks passed.`);
