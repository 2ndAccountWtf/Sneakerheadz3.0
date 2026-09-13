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

console.log(`\n${pass} hoops checks passed.`);
