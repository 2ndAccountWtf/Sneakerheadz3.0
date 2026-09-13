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
    COURT_L, COURT_R,
    type Cmd, type World,
} from '../components/minigames/HoopsGame.tsx';

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

console.log(`\n${pass} hoops checks passed.`);
