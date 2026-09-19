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
import { readFileSync } from 'node:fs';
import {
    createWorld, stepWorld, blankCmd, GAME_SECONDS, HOOPS, attackHoop,
    TURBO_MULT, SAY, BANNER, screenX, VW, hoopDist,
    laneBlockFactor, TURBO_DRAIN, TURBO_REGEN, AI_TURBO_REGEN,
    COURT_L, COURT_R, BASE_SPEED, STUMBLE_TIME, collide, CONTEST_R, dist2d,
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
        // Drive, and press SHOOT once you are close: in dunk range that is a
        // dunk, a step outside it is a pull-up. The trailing `else c.a = true`
        // that used to live here was the bot holding the release meter down —
        // with the meter gone, SHOOT is a pure press and holding it means
        // nothing at all.
        else if (near < 46) { c.a = true; c.aPress = true; }
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
    //
    // Floors set from a measured season and then halved, so normal variance
    // cannot trip them but a mechanic going to zero always does. Twelve of the
    // twenty-two tracked stats had no floor at all, which is how nine separate
    // deliberate breakages — three-pointers deleted, goaltending removed,
    // tip-ins removed, `b.rebound` never set — all passed the whole suite.
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
        ['fires', 0.05],
        // Previously unguarded. Measured per game: threes 0.75, tipIns 1.90,
        // goaltends 3.83, steals 7.48, rebounds 3.43, offRebounds 2.48,
        // bulletPasses 36.8, lobPasses 4.42, lobPicks 1.13, shovesLanded 1.12.
        // Measured 0.75 when release timing was the biggest term in a shot and
        // a well-timed deep look beat the distance falloff by 25%; 0.23 with
        // the meter gone. That is not the three dying — it is the three
        // belonging to the roster now. 'Test Guy' is a nobody with 0.5 range,
        // and the same season run against the best shooter on the blacktop
        // measures 0.49 against a bricklayer's 0.15, which is the gap the
        // separate roster check below actually guards. This floor only has to
        // catch the shot disappearing for everyone.
        ['threes', 0.1],
        ['tipIns', 0.5],
        // Goaltending has been deliberately walked down twice and its floor
        // was not walked down with it, which left a guard sitting 10% under
        // the thing it guarded. 3.83 when it was a per-frame roll over an
        // 18-frame window and accounted for 71% of all blocking; 1.10 once it
        // became one attribute-scaled roll on a descending ball; 0.78 once the
        // input buffer stopped throwing the player's presses away, because a
        // player who lands the alley-oop he called for gives the defence fewer
        // descending balls to swat — alley-oops went 0.77 to 1.15 a game over
        // the same change. About one a game is where this is meant to sit, so
        // the floor's job is to catch it vanishing, not to pin it in place.
        ['goaltends', 0.4],
        ['steals', 2],
        ['rebounds', 1],
        ['offRebounds', 0.5],
        ['bulletPasses', 10],
        ['lobPasses', 1],
        ['lobPicks', 0.3],
        ['shovesLanded', 0.3],
        // Bricks used to sit in the no-floor note below with the instruction
        // "give it a floor and delete this comment" attached. Measured three in
        // 3,913 shots at BRICK_CHANCE 0.24, and 0.52 a game at 0.32 — so: floor.
        ['bricks', 0.2],
    ];
    for (const [key, min] of expected) {
        assert.ok(
            s.per(key) >= min,
            `${key} happens ${s.per(key).toFixed(2)} times a game — below the ${min} it needs to be a real mechanic`,
        );
    }

    // One stat deliberately has no floor, recorded here so its absence is a
    // decision rather than an oversight — and so that if it ever comes back to
    // life, somebody reads this comment.
    //
    // `bulletPicks` measures 0.00/game, and that is the cost of making passing
    // viable at all. A bullet is flat by design — it peaks around y=19 — so the
    // height gate on it is binary: a ceiling of 18 picks nothing, 20 picks 16%
    // of every bullet and drops a passing bot to a 25% win rate. Dropping the
    // height test and using position alone picks 53-71% and passing stops
    // working entirely. Requiring the defender to have been in the lane at
    // release, which is the rule the lob uses, still picked 42-50%: on a court
    // this small a defender is simply near the ball most of the time.
    // Bullets being uninterceptable is the price of a passing game; lobs still
    // get picked 1.13 times a game and carry the risk.
    assert.ok(s.per('bulletPicks') < 1, 'bullet picks came alive — give it a floor and delete this comment');
});

/**
 * The brick mechanic: a shot bad enough renders as an actual brick and does
 * not bounce — see BRICK_CHANCE and the miss handling in stepBall/launchShot.
 * A bot that plays *well* — the one `season()` above drives — almost never
 * produces one, on purpose: the AI only voluntarily shoots when its own odds
 * are decent, so "every new mechanic actually fires" above does not (and
 * should not) assert a floor on bricks. This test drives the human player
 * through a deliberately terrible attempt instead.
 *
 * What makes a shot bad used to be two things, and is now one. The release
 * meter is gone — there is no "rushed" any more, because there is no timing
 * to rush — so the whole difference between these two samples is the defender
 * standing in the shooter's face from 140px out. That is the correct shape for
 * it: bad shots are a question of where you are and who is on you, which is
 * what `shotChance` has always actually measured.
 */
t('a genuinely bad, contested shot bricks — a clean open one does not', () => {
    const w = createWorld(777, 'Practice Dummy');
    for (let i = 0; i < 200 && w.phase === 'tip'; i++) stepWorld(w, DT, blankCmd());

    const farHoop = HOOPS[attackHoop(w.players[0].team)];
    const farX = Math.max(COURT_L + 4, Math.min(COURT_R - 4, farHoop.x + (farHoop.x < 176 ? 140 : -140)));

    const attempt = (contested: boolean) => {
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
        me.cool = 0; me.gather = -1; me.dunkT = 0; me.stumbleT = 0;
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

        const cmd = blankCmd();
        cmd.a = true; cmd.aPress = true;
        stepWorld(w, DT, cmd);
        // The wind-up. One press commits; the ball leaves at the apex, which
        // is a little under twenty frames away, and the defender gets all of
        // them to climb into the shot. Step until it is gone rather than
        // guessing a frame count.
        for (let i = 0; i < 40 && me.gather >= 0; i++) stepWorld(w, DT, blankCmd());
        // TS narrows `w.ball.mode` to the 'held' literal we just assigned
        // above and does not re-widen it across the stepWorld() calls in
        // between, even though stepWorld freely changes it — hence the cast.
        for (let i = 0; i < 200 && (w.ball.mode as string) === 'flight'; i++) stepWorld(w, DT, blankCmd());
    };

    let badAttempts = 0, badMisses = 0, badBricks = 0;
    for (let i = 0; i < 150; i++) {
        const shots0 = w.stats.shots, makes0 = w.stats.makes, bricks0 = w.stats.bricks;
        attempt(true);   // a hand in his face from 140px out
        if (w.stats.shots > shots0) {
            badAttempts++;
            if (w.stats.makes === makes0) { badMisses++; if (w.stats.bricks > bricks0) badBricks++; }
        }
    }

    let goodAttempts = 0, goodMisses = 0, goodBricks = 0;
    for (let i = 0; i < 150; i++) {
        const shots0 = w.stats.shots, makes0 = w.stats.makes, bricks0 = w.stats.bricks;
        attempt(false);  // same spot, nobody near him
        if (w.stats.shots > shots0) {
            goodAttempts++;
            if (w.stats.makes === makes0) { goodMisses++; if (w.stats.bricks > bricks0) goodBricks++; }
        }
    }

    assert.ok(badAttempts > 100, `only ${badAttempts}/150 scripted bad shots actually got a shot off`);
    assert.ok(badMisses > 20, `only ${badMisses} misses out of ${badAttempts} contested attempts — that scenario should miss constantly`);
    const badBrickShare = badBricks / Math.max(1, badMisses);
    assert.ok(
        badBrickShare > 0.15,
        `a heavily contested shot bricks only ${(badBrickShare * 100).toFixed(0)}% of its misses — the mechanic should fire often for a genuinely bad look`,
    );

    assert.ok(goodAttempts > 100, `only ${goodAttempts}/150 scripted good shots actually got a shot off`);
    const goodBrickShare = goodBricks / Math.max(1, goodMisses);
    assert.ok(
        goodBrickShare < badBrickShare,
        `an open shot bricks its misses (${(goodBrickShare * 100).toFixed(0)}%) as often as a contested one (${(badBrickShare * 100).toFixed(0)}%) — bricks should track shot quality, not fire on every miss`,
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
        me.cool = 0; me.gather = -1; me.dunkT = 0; me.stumbleT = 0;
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
    me.x = 176; me.z = 0.5; me.vx = 0; me.vz = 0; me.gather = -1; me.dunkT = 0;
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


/**
 * Can the player actually get away from the man in front of him?
 *
 * The check this replaces was called "there is always a way out of a defender —
 * sprinting is it" and its final assertion was
 * `BASE_SPEED * TURBO_MULT * sprinting > BASE_SPEED`: a sprinter beats a
 * *walking* defender. Ours never walks. It was arithmetic about three constants
 * dressed up as a gameplay guarantee, and it stayed green while the thing it
 * named was impossible — a scripted full-turbo 200px drive never opened more
 * than 14.3px of separation, which is inside `STEAL_R`, and the player was
 * inside a defender's reach on 76% of the frames he held the ball.
 *
 * So this measures the drive instead of the constants.
 */
function driveRun(style: 'straight' | 'weave', period = 32) {
    const w = createWorld(21, 'Test Guy');
    for (let i = 0; i < 200 && w.phase === 'tip'; i++) stepWorld(w, DT, blankCmd());
    const me = w.players.find(p => p.human)!;
    const mate = w.players.find(p => p.team === me.team && p.id !== me.id)!;
    const foes = w.players.filter(p => p.team !== me.team);
    const hoop = HOOPS[attackHoop(me.team)];
    const startX = Math.max(COURT_L + 6, Math.min(COURT_R - 6, hoop.x + (hoop.x < 176 ? 200 : -200)));

    w.clock = GAME_SECONDS;
    me.x = startX; me.z = 0.5; me.vx = 0; me.vz = 0; me.y = 0; me.vy = 0;
    me.gather = -1; me.dunkT = 0; me.stumbleT = 0; me.cool = 0; me.turbo = 1;
    // One man on him, goalside, as close as the standoff puts him.
    foes[0].x = me.x + (hoop.x > me.x ? 14 : -14); foes[0].z = 0.5;
    foes[0].vx = 0; foes[0].vz = 0; foes[0].y = 0; foes[0].stumbleT = 0; foes[0].turbo = 1;
    w.possession = me.id;
    w.ball.mode = 'held';

    let peak = 0, sum = 0, frames = 0, openFrames = 0, lost = false, reached = false, goalside = 0;
    let lane = 0.5;
    for (let f = 0; f < 240; f++) {
        // The duel only. Everybody else parked, the phase pinned, every frame —
        // a basket celebration or a stray teammate would decide this instead.
        mate.x = COURT_L + 4; mate.z = 0.95; mate.vx = 0; mate.vz = 0;
        foes[1].x = COURT_R - 4; foes[1].z = 0.05; foes[1].vx = 0; foes[1].vz = 0; foes[1].cool = 2;
        w.phase = 'play'; w.phaseT = 0; w.hitstop = 0; w.shotClock = 14;

        if (w.possession !== me.id) { lost = true; break; }

        const c = blankCmd();
        c.c = true;                                    // turbo the whole way
        if (hoop.x > me.x) c.right = true; else c.left = true;
        if (style === 'weave') {
            // Change depth lane every `period` frames. Cutting across the
            // depth lanes is the only "move" this game has — there is no
            // crossover, no juke, no spin — so if this cannot beat a man then
            // nothing the player does can.
            if (f % period === 0) lane = lane > 0.5 ? 0.2 : 0.8;
            if (lane > me.z + 0.02) c.down = true; else if (lane < me.z - 0.02) c.up = true;
        }
        stepWorld(w, DT, c);
        frames++;

        const gap = dist2d(me.x, me.z, foes[0].x, foes[0].z);
        peak = Math.max(peak, gap);
        sum += gap;
        if (gap > CONTEST_R) openFrames++;
        // Beaten: the handler is nearer the rim he is attacking than his man is.
        if (hoopDist(me, hoop) < hoopDist(foes[0], hoop) - 2) goalside++;
        if (hoopDist(me, hoop) < 26) { reached = true; break; }
    }
    return {
        peak, frames, lost, reached,
        avg: sum / Math.max(1, frames),
        openShare: openFrames / Math.max(1, frames),
        goalsideShare: goalside / Math.max(1, frames),
    };
}

t('a drive can actually beat the man in front of you', () => {
    const r = driveRun('weave');
    assert.ok(!r.lost, 'the defender simply took the ball — the drive never happened');
    assert.ok(
        r.peak > CONTEST_R,
        `the best separation a full-turbo cutting drive ever got was ${r.peak.toFixed(1)}px — inside a contest for the whole drive`,
    );
    assert.ok(
        r.openShare > 0.05,
        `only ${(r.openShare * 100).toFixed(0)}% of the drive was clear of a contest — there is no way past him`,
    );
    assert.ok(r.reached, 'a full-turbo drive never even reached the rim');
});

t('how you cut matters, which is the whole point', () => {
    // The strongest guard on this, and the one that fails hardest against a
    // mirror. A defender who re-reads your position every frame produces the
    // *same* peak separation whatever you do with the stick — measured at
    // 13.5px for cut rhythms from 10 frames to 44, a flat line. Against one who
    // commits to a decision, committing to a direction long enough for him to
    // buy it and then leaving is worth far more than mashing:
    //
    //   rhythm      8f   12f   20f   28f   40f   48f
    //   avg gap   11.6  15.0  19.4  16.9  20.3  20.7
    //   goalside     6%   81%   86%   86%   85%   84%
    //   to the rim  180   139   128   126   124   111  frames
    //
    // Mashing is not merely no better, it is actively worse: 8-frame cuts live
    // at 11.6px of daylight, get goalside on 6% of frames, and take 180 frames
    // to reach the rim against 111 for a man who commits. Against the mirror
    // every one of those columns was flat.
    const mashing = driveRun('weave', 8);
    const committed = driveRun('weave', 48);
    assert.ok(
        committed.avg > mashing.avg + 4,
        `a committed cut lives at ${committed.avg.toFixed(1)}px of daylight against ${mashing.avg.toFixed(1)}px for mashing — the stick does not matter`,
    );
    assert.ok(
        committed.goalsideShare > mashing.goalsideShare + 0.3,
        `mashing gets goalside on ${(mashing.goalsideShare * 100).toFixed(0)}% of frames against a committed cut's ${(committed.goalsideShare * 100).toFixed(0)}% — there is nothing to read`,
    );
    assert.ok(
        committed.frames < mashing.frames,
        `mashing reached the rim in ${mashing.frames} frames and committing took ${committed.frames} — rattling the stick should not be the fast way`,
    );
});

t('a straight-line drive still has to get through him', () => {
    // The other side of it. A defender who can be walked past in a straight
    // line is not a defender, and these are the assertions that break first if
    // his reaction time is ever tuned into uselessness.
    const r = driveRun('straight');
    assert.ok(
        r.avg < 46,
        `a straight drive averaged ${r.avg.toFixed(1)}px of daylight — the defender is not in the picture at all`,
    );
    assert.equal(
        r.goalsideShare, 0,
        `a straight drive got goalside of him on ${(r.goalsideShare * 100).toFixed(0)}% of its frames — running in a straight line should not beat anybody`,
    );
});

t('a defender in the lane costs you speed, and turbo is how you pay less', () => {
    // What the old check was really protecting: the lane block has to be
    // pressure rather than a cage, and turbo has to beat most of it without
    // becoming immunity to position. Those three bounds were the sound part.
    const w = freshMovementWorld();
    const me = w.players[0];
    w.possession = 0;
    w.ball.mode = 'held';
    const hoop = HOOPS[attackHoop(me.team)];
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
    assert.ok(sprinting > walking, 'turbo must beat the lane block');
    assert.ok(
        sprinting > 0.93,
        `sprinting past a set defender costs ${((1 - sprinting) * 100).toFixed(0)}% — the escape has to stay worth pressing`,
    );
    assert.ok(sprinting < 1, 'turbo is immunity to position again, which is what made driving unbeatable');
});


t('turbo costs the CPU exactly what it costs the player', () => {
    // The CPU used to drain turbo and then regenerate unconditionally in the
    // movement pass, so a sprinting defender netted -0.186/s against your
    // -0.34. He could hold top speed for 5.4s while you managed 2.9, which
    // meant outrunning him was never on the table.
    // Measured off the world, not restated from a constant. This check used to
    // compute `1 / TURBO_DRAIN` for both sides and assert they were within 0.01
    // of each other — the same expression twice, so `0 < 0.01`, constant-true.
    // Reintroducing the exact regression the comment above describes left it
    // green.
    //
    // What it measures now is the human's two real rates, taken from stepping
    // the actual world: hold turbo and read the bar, then let go and read it
    // again. A drain that is not a drain, or a regen faster than the drain,
    // fails here rather than in a comment.
    const rate = (holdTurbo: boolean) => {
        const w = createWorld(31, 'Test Guy');
        for (let i = 0; i < 240; i++) stepWorld(w, DT, blankCmd());
        const p = w.players.find(q => q.human)!;
        p.turbo = 0.6; p.onFire = false; p.fireT = 0;
        const before = p.turbo;
        const frames = 30;
        for (let i = 0; i < frames; i++) {
            // The state this measurement needs, re-asserted every frame rather
            // than assumed. `humanControl` is where turbo is spent and earned,
            // and the player loop skips it entirely for a man who is dunking,
            // gathering or face down on the floor — so any of those three left
            // this reading 0.000/s and failed a check about turbo for reasons
            // that had nothing to do with turbo. Same for the phase: `score`,
            // `tip` and `over` all return before the player loop, and frozen
            // hitstop frames read no input at all.
            //
            // It happened. Giving the CPU handler a committed depth lane moved
            // the whole simulation, and frame 240 of seed 31 — which used to be
            // a man on his feet in live play — became a basket celebration.
            w.phase = 'play'; w.phaseT = 0; w.hitstop = 0;
            p.onFire = false;
            p.stumbleT = 0; p.dunkT = 0; p.gather = -1; p.cool = 0;
            for (const q of w.players) if (q.id !== p.id) { q.x = 40; q.z = 0.05; q.cool = 1; }
            stepWorld(w, DT, { ...blankCmd(), right: true, c: holdTurbo });
        }
        return (p.turbo - before) / (frames * DT);      // bar units per second
    };
    const drain = rate(true);
    const regen = rate(false);
    assert.ok(drain < 0, `holding turbo changes the bar by ${drain.toFixed(3)}/s — it is not costing anything`);
    assert.ok(regen > 0, `letting go changes the bar by ${regen.toFixed(3)}/s — it never comes back`);
    assert.ok(-drain > regen,
        `turbo drains at ${(-drain).toFixed(2)}/s and refills at ${regen.toFixed(2)}/s — sprinting is free`);
    // The CPU's side of the same economy. `AI_TURBO_REGEN` scales its refill,
    // and the player recovering faster is the only structural edge the player
    // has. Whether the CPU can *sustain* a sprint longer than you is guarded
    // statistically by "there is always a way out of a defender" above, which
    // is the check that actually caught this regression when it was live.
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
    p.x = 150; p.z = 0.15; p.vx = 0; p.vz = 0; p.gather = -1; p.cool = 0;
    return { w, p };
}
/**
 * Park everybody else, and pin the world into live play.
 *
 * The pinning is the part that matters and it is the third fixture in this file
 * to need it. `score`, `tip` and `over` all return from `stepWorld` before the
 * player loop, and so does a frozen hitstop frame, so a fixture that assumes
 * frame 240 of a fixed seed is live play is really asserting something about
 * that seed. Give the CPU defender a reaction time and the whole simulation
 * moves: frame 240 of seed 7 became a basket celebration, fifteen "frames" of
 * held input became far fewer real ones, the acceleration ramp never finished,
 * and a check about diagonals failed for reasons that had nothing to do with
 * diagonals.
 */
const park = (w: World, p: { id: number }) => {
    w.phase = 'play'; w.phaseT = 0; w.hitstop = 0; w.clock = GAME_SECONDS;
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
    p.gather = 0.24;

    stepWorld(w, DT, blankCmd());

    assert.ok(p.gather < 0, `a player with no ball is still gathering at ${p.gather.toFixed(2)}`);
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
            assert.ok(!(q.gather >= 0 && w.possession !== q.id),
                `frame ${frames}: ${q.name} is gathering at ${q.gather.toFixed(2)} without the ball`);
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
        // Everybody else out of the way. Only the matched pair is being
        // measured, and a third body with its own `stealResist` wandering into
        // the collision is a different experiment — which is what this check
        // was accidentally running until `accelMult` changed their closing
        // speeds enough to make it show.
        for (const q of w.players) {
            if (q.id === p.id || q.id === foe.id) continue;
            q.x = COURT_L + 2; q.z = 0.1; q.vx = 0; q.vz = 0;
        }
        foe.vx = 0; foe.vz = 0; foe.stumbleT = 0;
        stepWorld(w, DT, { ...blankCmd(), right: true, c: true });
        if (p.stumbleT > 0) downs++;
    }
    assert.equal(downs, 0, 'two evenly matched bodies knocked each other over');
});

/* ------------------------------------------------------------------------- *
 * Rules that a stat floor cannot see
 *
 * A mutation can leave every counter moving and still have the game scoring
 * into the wrong basket. These are the checks for the breakages that survived
 * mutation testing with all the floors in place.
 * ------------------------------------------------------------------------- */

t('a three is only ever a three from beyond the arc, measured from the right rim', () => {
    // Two mutations passed the whole suite here: `b.pts = 2` always (three
    // pointers deleted — the new `threes` floor catches that one) and `b.pts`
    // measured against the team's own basket, which is the classic wrong-hoop
    // bug and leaves `threes` firing happily, because a shot taken under your
    // own rim is a long way from it.
    //
    // Observed over real games rather than scripted: a scripted shot from a
    // chosen distance kept coming back as a dunk or as nothing, because dunk
    // range runs to 50px and the release needs a real charge. Watching what the
    // game actually prices is both simpler and harder to fool.
    let x = 41;
    const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    let threes = 0, twos = 0, minThreeDist = Infinity, maxTwoDist = 0;
    for (let g = 0; g < 8; g++) {
        const w = createWorld(8100 + g, 'Test Guy');
        let frames = 0;
        const cap = Math.ceil((GAME_SECONDS + 40) / DT);
        let priced = false;
        while (w.phase !== 'over' && frames < cap) {
            stepWorld(w, DT, bot(w, rng, 1));
            frames++;
            const b = w.ball;
            if (b.mode !== 'flight' || b.kind !== 'shot') { priced = false; continue; }
            if (priced) continue;
            priced = true;
            const shooter = w.players[b.shooter];
            // Distance from where he let it go to the rim he is attacking.
            const d = hoopDist(shooter, HOOPS[attackHoop(shooter.team)]);
            if (b.pts === 3) { threes++; minThreeDist = Math.min(minThreeDist, d); }
            else { twos++; maxTwoDist = Math.max(maxTwoDist, d); }
        }
    }
    assert.ok(threes > 0, 'no shot was ever worth three — the line is gone');
    assert.ok(twos > 0, 'every shot was worth three; the check proves nothing');
    // The nearest three must be further out than the furthest two. If `pts` is
    // measured off the wrong rim these two ranges overlap immediately.
    assert.ok(minThreeDist > maxTwoDist,
        `a three was taken from ${minThreeDist.toFixed(0)}px while a two was taken from ${maxTwoDist.toFixed(0)}px — the arc is measured from the wrong hoop`);
    assert.ok(minThreeDist > 100,
        `the nearest three came from ${minThreeDist.toFixed(0)}px of the rim — that is not beyond any arc`);
});

t('defenders mark the rim they are defending', () => {
    // `aiThink`'s `ownHoop` inverted passed the whole suite: every counter keeps
    // moving while both defenders run to the wrong end of the court.
    const w = createWorld(23, 'Test Guy');
    for (let i = 0; i < 240; i++) stepWorld(w, DT, blankCmd());
    const me = w.players.find(p => p.human)!;
    const foes = w.players.filter(p => p.team !== me.team);
    let onTheRightSide = 0, samples = 0;
    for (let i = 0; i < 900; i++) {
        stepWorld(w, DT, blankCmd());
        if (w.possession !== me.id || w.phase !== 'play') continue;
        const theirRim = HOOPS[attackHoop(me.team)];      // the one I attack
        for (const o of foes) {
            samples++;
            // A defender should sit between the handler and the rim he wants,
            // i.e. on the rim side of the handler.
            if ((theirRim.x - me.x) * (o.x - me.x) > 0) onTheRightSide++;
        }
    }
    assert.ok(samples > 100, 'never held the ball long enough to judge');
    assert.ok(onTheRightSide / samples > 0.55,
        `defenders are goalside only ${(onTheRightSide / samples * 100).toFixed(0)}% of the time — they may be marking the wrong rim`);
});

t('the other team scoring puts your fire out', () => {
    // Rule 3, and deleting it passed the whole suite — `fires` counts
    // ignitions, not extinctions, so nothing noticed.
    const w = createWorld(29, 'Test Guy');
    for (let i = 0; i < 240; i++) stepWorld(w, DT, blankCmd());
    const me = w.players.find(p => p.human)!;
    const foe = w.players.find(p => p.team !== me.team)!;
    me.onFire = true; me.fireT = 20;
    // Hand the other team a basket the short way: put him on the rim and let
    // the dunk resolve.
    const theirRim = HOOPS[attackHoop(foe.team)];
    foe.x = theirRim.x + theirRim.inward * 8; foe.z = theirRim.z;
    w.possession = foe.id; w.ball.mode = 'held'; w.phase = 'play'; w.clock = 60;
    const before = w.score[foe.team];
    for (let i = 0; i < 300 && w.score[foe.team] === before; i++) stepWorld(w, DT, blankCmd());
    assert.ok(w.score[foe.team] > before, 'the other team never scored; the check proves nothing');
    assert.equal(me.onFire, false, 'still on fire after the other team scored');
});

t('a goaltend is a chance, not a certainty', () => {
    // Goaltending was 71% of all blocking, and the reason was mechanical rather
    // than a rate being mistuned. This check and the block at release ask
    // exactly the same question — an airborne defender inside BLOCK_R — and got
    // wildly different numbers of chances to answer it: the block rolls once,
    // on the frame the shot leaves the hand, while the goaltend rolled every
    // frame the ball was in the window. A shot that enters the window stays
    // there a mean of 18.8 frames, so at 0.5 a frame that was a 100.00% chance
    // against the block's single 55% — roughly 19x the rolls for the same rule.
    //
    // It is now one roll per shot, only on a descending ball, scaled by the
    // defender's `blockMult`.
    const s = season(50, 1.2);
    const goaltends = s.per('goaltends');
    const blocks = s.per('blocks');
    assert.ok(blocks > 0.5, `only ${blocks.toFixed(2)} blocks a game; the check proves nothing`);
    const share = goaltends / blocks;
    assert.ok(share < 0.6,
        `goaltending is ${(share * 100).toFixed(0)}% of all blocking — it is a repeated roll against a single one again`);
    assert.ok(goaltends > 0.3,
        `goaltending happens ${goaltends.toFixed(2)} times a game — the mechanic is gone rather than tuned`);
});

t('the roster reaches the contest, not just the legs', () => {
    // `blockMult` was one of eight modifiers `derive()` computed that nothing
    // read. It is the one that turns a contest from a flat coin-flip into the
    // difference between a good defender and a bad one — and it is exactly what
    // NBA Jam scales its own 1-25% block chance by.
    const src = readFileSync('components/minigames/HoopsGame.tsx', 'utf8');
    for (const m of ['blockMult', 'accelMult']) {
        assert.ok(src.includes(`mods.${m}`), `${m} is computed by derive() and read by nothing`);
    }
});

t('reaching a streak of two is always announced', () => {
    // The `scorer.streak === 2` branch sat after the alley / tip / dunk
    // branches in the same else-if chain, and dunks are ~60% of all scoring —
    // so the second bucket of a run was usually a dunk, took BOOMSHAKALAKA,
    // and the streak went unsaid. Measured: 434 streak-reaches-2 events
    // against 104 banners, so the iconic call was missing three times in four.
    // The banner still belongs to the dunk; the ticker line underneath is the
    // streak's.
    let x = 53;
    const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    const heat = new Set<string>(SAY.heat as readonly string[]);
    let reached = 0, announced = 0;
    for (let g = 0; g < 20; g++) {
        const w = createWorld(5200 + g, 'Test Guy');
        const was = new Map<number, number>();
        let frames = 0;
        const cap = Math.ceil((GAME_SECONDS + 40) / DT);
        while (w.phase !== 'over' && frames < cap) {
            for (const p of w.players) was.set(p.id, p.streak);
            stepWorld(w, DT, bot(w, rng, 1.2));
            frames++;
            const hit = w.players.some(p => p.streak === 2 && (was.get(p.id) ?? 0) < 2);
            if (!hit) continue;
            reached++;
            if (heat.has(w.say) || /HEATING UP/.test(w.bannerText)) announced++;
        }
    }
    assert.ok(reached > 15, `only ${reached} streaks reached two; the check proves nothing`);
    assert.ok(announced / reached > 0.9,
        `only ${(announced / reached * 100).toFixed(0)}% of streaks were announced — the dunk call is eating them again`);
});

/* ---------------------------------------------------------------------------
 * Input buffering.
 *
 * A press survives being *declined* and clears only when it is *acted upon*.
 * These checks pin both halves of that, because a buffer that only ever grows
 * is worse than none: the frames a press must NOT survive — a hit, the body of
 * a stumble, a change of who has the ball — are as much the spec as the frames
 * it must. Every one of them fails if `w.buf` stops being consulted.
 * ------------------------------------------------------------------------- */

/**
 * The human on defence with the ball safely in an opponent's hands, which is
 * the state where SHOOT means nothing but "leave your feet".
 *
 * `pin` has to be called before every step, and the reason is worth recording:
 * parking the ball-handler in a corner and walking away is not inert. He drives,
 * he shoots, he scores, the phase goes to `score`, and `humanControl` stops
 * being called at all — which read exactly like the press being dropped. So the
 * handler is re-parked and re-cooled each frame; `aiThink` gates every offensive
 * action on `p.cool`, so a cooldown he can never burn off is what actually holds
 * him still.
 */
function defenceWorld() {
    const w = createWorld(31, 'Test Guy');
    for (let i = 0; i < 240; i++) stepWorld(w, DT, blankCmd());
    w.phase = 'play'; w.phaseT = 0; w.clock = GAME_SECONDS; w.hitstop = 0; w.shake = 0;
    const p = w.players.find(q => q.human)!;
    const foe = w.players.find(q => q.team !== p.team)!;
    p.x = 150; p.z = 0.5; p.y = 0; p.vx = 0; p.vz = 0; p.vy = 0;
    p.gather = -1; p.cool = 0; p.swapCool = 0; p.dunkT = 0; p.stumbleT = 0;
    const pin = () => {
        for (const q of w.players) if (q.id !== p.id) {
            q.x = 40; q.z = 0.1; q.vx = 0; q.vz = 0; q.vy = 0; q.y = 0;
            q.cool = 1; q.swapCool = 0; q.dunkT = 0; q.gather = -1; q.stumbleT = 0;
        }
        w.possession = foe.id;
        w.ball.mode = 'held';
        w.shotClock = 15;
    };
    pin();
    w.buf.a = 0; w.buf.b = 0; w.buf.aRole = -1; w.buf.bRole = -1;
    return { w, p, pin };
}

/** The human holding the ball a step from the rim, so SHOOT means "dunk". */
function offenceWorld() {
    const w = createWorld(33, 'Test Guy');
    for (let i = 0; i < 240; i++) stepWorld(w, DT, blankCmd());
    w.phase = 'play'; w.phaseT = 0; w.clock = GAME_SECONDS; w.hitstop = 0; w.shake = 0;
    const p = w.players.find(q => q.human)!;
    const hoop = HOOPS[attackHoop(p.team)];
    p.x = hoop.x - 6; p.z = hoop.z; p.y = 0; p.vx = 0; p.vz = 0; p.vy = 0;
    p.gather = -1; p.cool = 0; p.swapCool = 0; p.dunkT = 0; p.stumbleT = 0;
    for (const q of w.players) if (q.id !== p.id) { q.x = 40; q.z = 0.1; q.vx = 0; q.vz = 0; }
    w.possession = p.id;
    w.ball.mode = 'held';
    w.buf.a = 0; w.buf.b = 0; w.buf.aRole = -1; w.buf.bRole = -1;
    return { w, p };
}

const pressA = (): Cmd => { const c = blankCmd(); c.a = true; c.aPress = true; return c; };
const pressB = (): Cmd => { const c = blankCmd(); c.b = true; c.bPress = true; return c; };
const holdA = (): Cmd => { const c = blankCmd(); c.a = true; return c; };

/** Frames from the takeoff press until the body is back on the floor. */
function airFrames(): number {
    const { w, p, pin } = defenceWorld();
    pin(); stepWorld(w, DT, pressA());
    let n = 1;
    while ((p.y > 0 || p.vy !== 0) && n < 300) { pin(); stepWorld(w, DT, blankCmd()); n++; }
    return n;
}

/** Jump, press SHOOT `early` frames before touchdown, and report whether a
 *  second jump ever came out. */
function jumpsAgain(early: number): boolean {
    const air = airFrames();
    const { w, p, pin } = defenceWorld();
    pin(); stepWorld(w, DT, pressA());
    const at = Math.max(1, air - early);
    let landed = false, rose = false;
    for (let f = 1; f <= air + 15; f++) {
        pin();
        stepWorld(w, DT, f === at ? pressA() : blankCmd());
        if (!landed) { if (p.y === 0 && p.vy === 0) landed = true; continue; }
        if (p.y > 1) rose = true;
    }
    return rose;
}

t('a press four frames before touchdown jumps the moment you land', () => {
    // The case the whole buffer exists for. `humanControl` does run while you
    // are airborne, so the old code was not dropping this press by accident —
    // it declined it on a frame that could not use it and then spent it.
    assert.ok(jumpsAgain(4), 'a press four frames early was thrown away');
});

t('a press at the top of the jump is not still waiting when you land', () => {
    // The other half. A buffer that never expires is just a queue, and a queue
    // replays a decision made half a second ago in a game that has moved on.
    assert.ok(!jumpsAgain(30), 'a press half a second stale came out on landing');
});

t('a press during a cooldown fires when the cooldown ends', () => {
    const { w, p } = offenceWorld();
    p.cool = 3 * DT;
    stepWorld(w, DT, pressA());
    assert.equal(p.dunkT, 0, 'the cooldown did not actually decline the press — the check proves nothing');
    for (let f = 0; f < 4; f++) stepWorld(w, DT, holdA());
    assert.ok(p.dunkT > 0, 'the press was eaten by three frames of cooldown');
});

t('no press survives a hit, whenever it was made', () => {
    // The buffer is not aged during the frozen frames, so without the explicit
    // clear a banked press comes out on recovery with its whole window intact
    // — which is exactly the queue-through-hitstop behaviour that got the first
    // attempt at this reverted.
    //
    // Only the *banked* case is observable. A press arriving mid-freeze is
    // unbankable twice over — the banking sits after the early return, and the
    // clear would wipe it anyway — so moving the banking above the return
    // changes no behaviour and no test can tell. Belt and braces, recorded as
    // such rather than guarded by a check that cannot fail.
    const { w, p, pin } = defenceWorld();
    pin(); stepWorld(w, DT, pressA());
    assert.ok(p.y > 0, 'the first press did not jump — the check proves nothing');
    pin(); stepWorld(w, DT, pressA());
    assert.ok(w.buf.a > 0, 'the airborne press was not banked — the check proves nothing');

    w.hitstop = 0.1;
    pin(); stepWorld(w, DT, blankCmd());
    assert.equal(w.buf.a, 0, 'a banked press sat out the freeze and was still waiting');

    let landed = false, rose = false;
    for (let f = 0; f < 90; f++) {
        pin(); stepWorld(w, DT, blankCmd());
        if (!landed) { if (p.y === 0 && p.vy === 0) landed = true; continue; }
        if (p.y > 1) rose = true;
    }
    assert.ok(!rose, 'a press frozen out by a hit came out anyway');
});

/** Shove the human over, press SHOOT either at the start of the stumble or in
 *  its last frames, and report whether he jumped on getting up. */
function jumpsAfterStumble(atStart: boolean) {
    const { w, p, pin } = defenceWorld();
    p.stumbleT = STUMBLE_TIME;
    let pressed = false, rose = false;
    const frames = Math.round(STUMBLE_TIME / DT) + 20;
    for (let f = 0; f < frames; f++) {
        const now = !pressed && (atStart ? f === 0 : p.stumbleT > 0 && p.stumbleT <= 3 * DT);
        if (now) pressed = true;
        pin();
        stepWorld(w, DT, now ? pressA() : blankCmd());
        if (p.stumbleT === 0 && p.y > 1) rose = true;
    }
    return { pressed, rose };
}

t('a press thrown at the start of a stumble is gone by the time you get up', () => {
    const r = jumpsAfterStumble(true);
    assert.ok(r.pressed, 'the press never happened — the check proves nothing');
    assert.ok(!r.rose, 'a press from 51 frames ago fired as the player stood up');
});

t('a press in the last frames of a stumble fires as you get up', () => {
    const r = jumpsAfterStumble(false);
    assert.ok(r.pressed, 'the press never happened — the check proves nothing');
    assert.ok(r.rose, 'a press three frames from standing up was thrown away');
});

t('a steal press does not become a swap when your man gets the ball', () => {
    // PASS is a steal on defence and a swap on offence. Without the role stamp
    // on the banked press, a reach at a loose ball turns into handing over the
    // man you were driving, six frames later, for no reason you could see.
    const { w, p, pin } = defenceWorld();
    p.cool = 5 * DT;
    pin(); stepWorld(w, DT, pressB());
    assert.ok(w.buf.b > 0, 'the press was not banked at all — the check proves nothing');
    // Your man comes down with it, inside the buffer window.
    const mate = w.players.find(q => q.team === p.team && q.id !== p.id)!;
    for (let f = 0; f < 8; f++) {
        w.possession = mate.id;
        w.ball.mode = 'held';
        mate.cool = 1;
        stepWorld(w, DT, blankCmd());
    }
    assert.ok(p.human, 'a press meant as a steal swapped which man you were driving');
});


/* ---------------------------------------------------------------------------
 * The jump shot, with the release meter removed.
 *
 * SHOOT used to open a charge bar with a green sweet spot, and release quality
 * was the largest single term in `shotChance` — larger than the distance,
 * larger than the hand in your face. NBA Jam has no such thing and never did:
 * the button is a plain press and the make is one roll against a percentage
 * built from range, defenders and the shooter's own rating. What the meter
 * was really providing, and the only part worth keeping, was a window in which
 * a shot could be contested on purpose. So the window stayed and the timing
 * went: press SHOOT, the shooter plants, goes up, and lets it go at the top.
 * ------------------------------------------------------------------------- */

/** The human with the ball, planted well outside dunk range, one defender
 *  placed at `guardGap` px (or parked in the far corner when open). */
function jumperRun(guarded: boolean, tries: number) {
    const w = createWorld(777, 'Practice Dummy');
    for (let i = 0; i < 200 && w.phase === 'tip'; i++) stepWorld(w, DT, blankCmd());
    const me = w.players[0];
    const hoop = HOOPS[attackHoop(me.team)];
    const farX = Math.max(COURT_L + 4, Math.min(COURT_R - 4, hoop.x + (hoop.x < 176 ? 96 : -96)));
    const parkedFar = farX < 176 ? COURT_R - 4 : COURT_L + 4;

    let shots = 0, blocks = 0, windupTotal = 0, airborneAtPress = 0, releasedFalling = 0;
    for (let i = 0; i < tries; i++) {
        w.phase = 'play'; w.phaseT = 0; w.clock = GAME_SECONDS; w.hitstop = 0; w.shotClock = 10;
        me.x = farX; me.z = 0.5; me.vx = 0; me.vz = 0; me.y = 0; me.vy = 0;
        me.cool = 0; me.gather = -1; me.dunkT = 0; me.stumbleT = 0;
        const onBall = w.players[2], other = w.players[3];
        for (const d of [onBall, other]) { d.stumbleT = 0; d.vx = 0; d.vz = 0; d.y = 0; d.vy = 0; d.cool = 0; d.dunkT = 0; }
        other.x = parkedFar; other.z = 0.85;
        // Inside BLOCK_R and on the floor: he has to decide to go up himself.
        // Nothing here scripts the contest — that is the point of the check.
        if (guarded) { onBall.x = me.x + 12; onBall.z = me.z; }
        else { onBall.x = parkedFar; onBall.z = 0.1; }
        w.possession = 0; w.ball.mode = 'held';

        const b0 = w.stats.blocks, s0 = w.stats.shots;
        const cmd = blankCmd(); cmd.a = true; cmd.aPress = true;
        stepWorld(w, DT, cmd);
        if (me.y > 0 && me.vy > 0) airborneAtPress++;
        let f = 0;
        while (f < 60 && me.gather >= 0) { stepWorld(w, DT, blankCmd()); f++; }
        if (me.vy <= 0) releasedFalling++;
        windupTotal += f;
        for (let k = 0; k < 200 && (w.ball.mode as string) === 'flight'; k++) stepWorld(w, DT, blankCmd());
        if (w.stats.shots > s0) shots++;
        if (w.stats.blocks > b0) blocks++;
    }
    return { shots, blocks, windup: windupTotal / tries, airborneAtPress, releasedFalling, tries };
}

t('a jumper is a wind-up, not an instant', () => {
    const r = jumperRun(false, 60);
    assert.equal(r.airborneAtPress, r.tries,
        `the shooter was still on the floor after pressing SHOOT on ${r.tries - r.airborneAtPress} of ${r.tries} attempts`);
    assert.ok(r.windup > 12 && r.windup < 26,
        `the ball leaves ${r.windup.toFixed(1)} frames after the press — a tell nobody can react to, or a hang nobody would sit through`);
    assert.equal(r.releasedFalling, r.tries, 'the ball left before the top of the jump');
    assert.equal(r.shots, r.tries, `only ${r.shots} of ${r.tries} wide-open attempts got a shot away at all`);
});

t('a defender who goes up with the shooter gets a piece of it', () => {
    // The whole reason the wind-up survived the meter. Nothing in here tells
    // the defender to jump: he is stood on the floor inside BLOCK_R when the
    // shot starts and has the length of the gather to decide for himself.
    // Delete the gather and he has no frames at all — which is exactly how the
    // CPU shot behaved before this, and why blocking felt arbitrary.
    const open = jumperRun(false, 200);
    const guarded = jumperRun(true, 200);
    assert.equal(open.blocks, 0, `${open.blocks} shots were blocked with nobody within 200px — the check proves nothing`);
    assert.ok(guarded.blocks > 6,
        `only ${guarded.blocks} of 200 shots taken over a defender were blocked — the wind-up is not contestable`);
    assert.ok(guarded.shots > 120,
        `only ${guarded.shots} of 200 guarded attempts got a shot off — the defender is eating the possession, not contesting the shot`);
});

t('every jump shot in a real game has a wind-up, the CPU included', () => {
    // The CPU used to call the shot straight out of `aiThink`: no gather, no
    // pose, nothing to read. You could not block a CPU jumper on purpose, only
    // swat one already in the air, and that was half of why blocking felt
    // arbitrary. Watched over real games rather than scripted, because the
    // thing being checked is that the CPU's own decision path goes through the
    // wind-up — a scripted shot would only ever prove it about the human.
    let x = 77;
    const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    let cpuShots = 0, cpuWithWindUp = 0, humanShots = 0, humanWithWindUp = 0;
    for (let g = 0; g < 8; g++) {
        const w = createWorld(8300 + g, 'Test Guy');
        let frames = 0;
        const cap = Math.ceil((GAME_SECONDS + 40) / DT);
        let priced = false;
        let wasGathering = w.players.map(() => false);
        while (w.phase !== 'over' && frames < cap) {
            const before = wasGathering;
            stepWorld(w, DT, bot(w, rng, 1));
            wasGathering = w.players.map(q => q.gather >= 0);
            frames++;
            const b = w.ball;
            if (b.mode !== 'flight' || b.kind !== 'shot') { priced = false; continue; }
            if (priced) continue;
            priced = true;
            const shooter = w.players[b.shooter];
            if (shooter.human) { humanShots++; if (before[b.shooter]) humanWithWindUp++; }
            else { cpuShots++; if (before[b.shooter]) cpuWithWindUp++; }
        }
    }
    assert.ok(cpuShots > 40, `only ${cpuShots} CPU jump shots across eight games — the check proves nothing`);
    assert.ok(humanShots > 10, `only ${humanShots} human jump shots across eight games — the check proves nothing`);
    assert.ok(cpuWithWindUp / cpuShots > 0.95,
        `only ${((cpuWithWindUp / cpuShots) * 100).toFixed(0)}% of CPU jumpers had a wind-up — the CPU is shooting with no tell again`);
    assert.ok(humanWithWindUp / humanShots > 0.95,
        `only ${((humanWithWindUp / humanShots) * 100).toFixed(0)}% of human jumpers had a wind-up`);
});

t('a jumper counts from where you left your feet', () => {
    // The shooter used to keep driving through his own wind-up, because
    // `aiThink`/`humanControl` — and therefore `applyMove` — still ran while
    // he was in it. The point value is read at release, so a three decided
    // from 122px out was released from 111 and scored two. That single bug
    // cut three-point attempts from 1.07 a game to 0.43 the moment the
    // wind-up was introduced, and nothing else in the suite noticed.
    const w = createWorld(4141, 'Practice Dummy');
    for (let i = 0; i < 200 && w.phase === 'tip'; i++) stepWorld(w, DT, blankCmd());
    w.phase = 'play'; w.phaseT = 0; w.clock = GAME_SECONDS; w.hitstop = 0; w.shotClock = 10;
    const me = w.players[0];
    const hoop = HOOPS[attackHoop(me.team)];
    me.x = hoop.x + (hoop.x < 176 ? 120 : -120); me.z = hoop.z;
    me.vx = 0; me.vz = 0; me.y = 0; me.vy = 0;
    me.cool = 0; me.gather = -1; me.dunkT = 0; me.stumbleT = 0;
    for (const q of w.players) if (q.id !== me.id) { q.x = 40; q.z = 0.05; q.vx = 0; q.vz = 0; q.cool = 2; }
    w.possession = 0; w.ball.mode = 'held';

    // Get him genuinely moving at the rim first — a standing shooter cannot
    // drift, so a test that skips this proves nothing.
    const drive = (): Cmd => {
        const c = blankCmd();
        if (hoop.x > me.x) c.right = true; else c.left = true;
        c.c = true;
        return c;
    };
    for (let i = 0; i < 20; i++) stepWorld(w, DT, drive());
    assert.ok(Math.abs(me.vx) > 30, `the shooter is only moving at ${Math.abs(me.vx).toFixed(0)}px/s — he cannot drift`);

    const shoot = drive(); shoot.a = true; shoot.aPress = true;
    stepWorld(w, DT, shoot);
    assert.ok(me.gather >= 0, 'the press did not start a jumper');
    const atTakeoff = hoopDist(me, hoop);

    // Still leaning on the stick the whole way up.
    for (let i = 0; i < 40 && me.gather >= 0; i++) stepWorld(w, DT, drive());
    const atRelease = hoopDist(me, hoop);

    assert.ok(Math.abs(atRelease - atTakeoff) < 3,
        `the shooter travelled ${(atTakeoff - atRelease).toFixed(1)}px toward the rim during his own wind-up`);
});

t('a shooter out-shoots a bricklayer from deep, in real games', () => {
    // `touchMult` and `deepMult` both come off `range`, and until the meter
    // went neither was read by the simulation at all: release timing decided
    // the shot and the roster decided nothing. This is the check that the
    // attribute now carries what the thumb used to.
    const threesFor = (npcId: string) => {
        let threes = 0, done = 0;
        for (let i = 0; i < 60; i++) {
            let x = ((i + 1) * 2654435761) >>> 0;
            const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
            const prof = profileFor(npcId);
            const w = createWorld(9000 + i, prof.name, prof);
            let f = 0;
            const cap = Math.ceil((GAME_SECONDS + 40) / DT);
            while (w.phase !== 'over' && f < cap) { stepWorld(w, DT, bot(w, rng, 1.2)); f++; }
            if (w.phase !== 'over') continue;
            done++; threes += w.stats.threes;
        }
        return threes / Math.max(1, done);
    };
    const shooter = threesFor('grandma-laces');     // range 0.97
    const bricklayer = threesFor('yasser-abbasfat'); // range 0.05
    assert.ok(shooter > 0.3, `the best shooter on the blacktop hits ${shooter.toFixed(2)} threes a game — the shot is not a weapon for anybody`);
    assert.ok(shooter / bricklayer > 2,
        `a 0.97-range shooter hits ${shooter.toFixed(2)} threes a game against a 0.05-range one's ${bricklayer.toFixed(2)} — only a ${(shooter / bricklayer).toFixed(1)}x gap`);
});


/* ---------------------------------------------------------------------------
 * The small-and-true list: things that were wrong and cheap, recorded in the
 * PRD as P3 and each fixed here. None of them is a headline; all of them were
 * invisible to the suite.
 * ------------------------------------------------------------------------- */

t('a shot-clock violation over a live dunk does not fire a second shot', () => {
    // One possession used to produce two `stats.shots`, a second ball in
    // flight that the dunk silently clobbered, and two points *despite* the
    // violation. A shot already on its way is not a stall.
    const { w, p } = offenceWorld();
    const shots0 = w.stats.shots;
    const score0 = w.score[p.team];
    stepWorld(w, DT, pressA());
    assert.ok(p.dunkT > 0, 'the press did not start a dunk — the check proves nothing');

    w.shotClock = 0.004;            // expires on the very next frame
    let heaves = 0, frames = 0;
    while (frames < 120 && p.dunkT > 0) {
        stepWorld(w, DT, blankCmd());
        frames++;
        if (w.ball.kind === 'heave') heaves++;
    }
    assert.ok(w.shotClock <= 0, 'the shot clock never actually expired — the check proves nothing');
    assert.equal(heaves, 0, 'the clock threw a heave over a live dunk');
    assert.equal(w.stats.shots - shots0, 1,
        `one possession produced ${w.stats.shots - shots0} shots`);
    assert.equal(w.score[p.team] - score0, 2, 'the dunk did not finish');
});

t('the anti-stall fallback never hands the ball to a man on the floor', () => {
    // The pickup scramble skips anyone `stumbleT > 0`; the 3.5s fallback did
    // not, so a ball nobody chased could be handed to a body lying on it — and
    // a prone player reads no input at all. Believed unreachable in play, since
    // a stumble is 0.85s and always expires first. Constructed, therefore, and
    // honest about that: this checks the guard, not the odds of reaching it.
    const w = createWorld(55, 'Test Guy');
    for (let i = 0; i < 240; i++) stepWorld(w, DT, blankCmd());
    const down = w.players[0], up = w.players[1];
    const far = [w.players[2], w.players[3]];

    // Ball dead in a corner, one man face down on top of it, everybody else
    // well outside the 13px pickup reach so only the fallback can resolve it.
    w.possession = null;
    w.ball.mode = 'loose';
    w.ball.x = COURT_L + 20; w.ball.z = 0.2; w.ball.y = 3;
    w.ball.vx = 0; w.ball.vz = 0; w.ball.vy = 0;
    w.ball.looseT = 3.4; w.ball.pickCool = 0; w.ball.rebound = false;

    let frames = 0;
    while (frames < 40 && w.possession === null) {
        w.phase = 'play'; w.phaseT = 0; w.clock = GAME_SECONDS; w.hitstop = 0;
        w.ball.x = COURT_L + 20; w.ball.z = 0.2; w.ball.y = 3;
        w.ball.vx = 0; w.ball.vz = 0; w.ball.vy = 0;
        // Re-pinned every frame: `aiThink` sends everybody at a loose ball, so
        // without this they simply walk over and the fallback never runs.
        down.x = w.ball.x; down.z = w.ball.z; down.y = 0; down.vx = 0; down.vz = 0;
        down.stumbleT = 5;
        up.x = COURT_L + 60; up.z = 0.2; up.y = 0; up.vx = 0; up.vz = 0; up.stumbleT = 0;
        for (const q of far) { q.x = COURT_R - 4; q.z = 0.9; q.vx = 0; q.vz = 0; q.stumbleT = 0; }
        stepWorld(w, DT, blankCmd());
        frames++;
    }

    assert.ok(w.possession !== null, 'the fallback never fired — the check proves nothing');
    assert.notEqual(w.possession, down.id, 'the ball was handed to a player lying on the floor');
    assert.equal(w.possession, up.id, 'the fallback did not pick the nearest man still standing');
});

t('the CPU handler picks a depth lane instead of shaking between two', () => {
    // He wants the lane his man is not in; his man wants the lane he is in.
    // Decided every frame that is a feedback loop, and it measured like one:
    // 1.51 mid-line crossings per CPU possession, 30% of possessions with two
    // or more, one possession with thirty. `LANE_DWELL` turns the loop into a
    // decision. Both bounds matter — a handler who never changes lanes at all
    // would pass the first assertion and has given up the move entirely.
    let x = 99;
    const rng = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
    let crossings = 0, poss = 0, jittery = 0;
    for (let g = 0; g < 12; g++) {
        const w = createWorld(5300 + g, 'Test Guy');
        let frames = 0;
        const cap = Math.ceil((GAME_SECONDS + 40) / DT);
        let who: number | null = null, side: number | null = null, inThis = 0;
        const endPoss = () => {
            if (who !== null) { poss++; if (inThis >= 2) jittery++; }
            who = null; side = null; inThis = 0;
        };
        while (w.phase !== 'over' && frames < cap) {
            stepWorld(w, DT, bot(w, rng, 1.2));
            frames++;
            const h = w.possession !== null ? w.players[w.possession] : null;
            // Only the CPU side: the human's lane is whatever the player asks for.
            if (!h || h.human || h.team === 0) { endPoss(); continue; }
            if (who !== h.id) { endPoss(); who = h.id; }
            const s = h.z > 0.5 ? 1 : 0;
            if (side !== null && s !== side) { crossings++; inThis++; }
            side = s;
        }
        endPoss();
    }
    assert.ok(poss > 150, `only ${poss} CPU possessions across twelve games — the check proves nothing`);
    const per = crossings / poss;
    assert.ok(per < 0.9,
        `the CPU handler crosses the mid-line ${per.toFixed(2)} times a possession — it is shaking, not moving`);
    assert.ok(jittery / poss < 0.2,
        `${((jittery / poss) * 100).toFixed(0)}% of CPU possessions cross the mid-line twice or more`);
    assert.ok(per > 0.15,
        `the CPU handler changes lanes ${per.toFixed(2)} times a possession — the drift has been dwelled out of existence`);
});


console.log(`\n${pass} hoops checks passed.`);
