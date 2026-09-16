/**
 * There is traffic on the road now.
 *
 * The only car in the obstacle table was a *parked* Camry with no velocity, so
 * a four-lane road through a city had nothing moving on it at all: you descend
 * a hill at 76mph past a street where every single vehicle is nailed down. The
 * fix is two more vehicle kinds with a speed along the hill — one going your
 * way that you overtake, one coming the other way that closes on you.
 *
 * Moving obstacles are the kind of change that quietly breaks a game: a car
 * that outruns the culling window leaks memory, one that spawns on top of you
 * is an unavoidable hit, and one that makes the hill unsurvivable is worse than
 * no traffic at all. So these checks are mostly about those three.
 */
import assert from 'node:assert/strict';
import {
    createRaceState, stepRace, NO_INPUT,
    type RaceState,
} from '../components/minigames/CartRace.tsx';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };
const DT = 1 / 60;

const fresh = (seed: number) =>
    createRaceState({ hasBoard: true, seed, arms: [], fitness: 1 } as never);

/** Run a whole hill and report what happened. */
function hill(seed: number, frames = 5400) {
    const s = fresh(seed);
    let peakObstacles = 0;
    let sawTraffic = false;
    let sawOncoming = false;
    for (let i = 0; i < frames && !s.outcome; i++) {
        stepRace(s, { ...NO_INPUT, right: true, up: i % 150 < 26 }, DT);
        peakObstacles = Math.max(peakObstacles, s.obstacles.length);
        for (const o of s.obstacles) {
            if (o.def.kind === 'traffic') sawTraffic = true;
            if (o.def.kind === 'oncoming') sawOncoming = true;
        }
    }
    return { s, peakObstacles, sawTraffic, sawOncoming };
}

console.log('\nthe street is not a car park');

t('both kinds of moving vehicle actually turn up', () => {
    let traffic = 0;
    let oncoming = 0;
    for (let seed = 1; seed <= 6; seed++) {
        const r = hill(seed, 2400);
        if (r.sawTraffic) traffic++;
        if (r.sawOncoming) oncoming++;
    }
    assert.ok(traffic >= 5, `same-way traffic appeared in only ${traffic}/6 runs`);
    assert.ok(oncoming >= 5, `oncoming traffic appeared in only ${oncoming}/6 runs`);
});

t('a car going your way moves down the hill', () => {
    // The literal complaint: none of them were moving.
    const s = fresh(3);
    for (let i = 0; i < 1800; i++) {
        stepRace(s, { ...NO_INPUT, right: true }, DT);
        const car = s.obstacles.find(o => o.def.kind === 'traffic');
        if (!car) continue;
        const before = car.z;
        for (let k = 0; k < 30; k++) stepRace(s, { ...NO_INPUT, right: true }, DT);
        if (!s.obstacles.includes(car)) break;          // overtaken and culled
        assert.ok(car.z > before, `traffic sat still at z=${before}`);
        return;
    }
    assert.fail('no same-way traffic in 1800 frames');
});

t('an oncoming car comes toward you', () => {
    const s = fresh(5);
    for (let i = 0; i < 1800; i++) {
        stepRace(s, { ...NO_INPUT, right: true }, DT);
        const car = s.obstacles.find(o => o.def.kind === 'oncoming');
        if (!car) continue;
        const before = car.z;
        for (let k = 0; k < 20; k++) stepRace(s, { ...NO_INPUT, right: true }, DT);
        if (!s.obstacles.includes(car)) break;
        assert.ok(car.z < before, `oncoming car drifted the wrong way, ${before} -> ${car.z}`);
        return;
    }
    assert.fail('no oncoming traffic in 1800 frames');
});

t('you are still overtaking, not being overtaken', () => {
    // Traffic slower than the rig is the whole design: you close on it, which
    // makes it a thing to get past rather than a thing that chases you.
    const s = fresh(9);
    for (let i = 0; i < 900; i++) stepRace(s, { ...NO_INPUT, right: true }, DT);
    for (const o of s.obstacles) {
        if (!o.def.vz || o.def.vz < 0) continue;
        assert.ok(o.def.vz < s.speed, `traffic at ${o.def.vz} outruns a rig doing ${s.speed.toFixed(1)}`);
    }
});

t('an oncoming car is seen before it arrives', () => {
    // Spawned beyond the horizon and driven in, rather than appearing at the
    // edge of the visible road with a second to react.
    const s = fresh(4);
    for (let i = 0; i < 2400; i++) {
        stepRace(s, { ...NO_INPUT, right: true }, DT);
        const car = s.obstacles.find(o => o.def.kind === 'oncoming');
        if (!car) continue;
        // 56m of road is visible; anything spawning inside that is a cheap shot.
        assert.ok(car.z - s.z > 70, `oncoming car appeared only ${(car.z - s.z).toFixed(0)}m ahead`);
        return;
    }
    assert.fail('no oncoming traffic in 2400 frames');
});

t('moving vehicles do not accumulate', () => {
    // A car that outruns the culling test is never removed, and the list grows
    // for the whole 1900m descent. Invisible until it is a slideshow.
    for (const seed of [2, 7, 11]) {
        const r = hill(seed);
        assert.ok(r.peakObstacles < 40, `obstacle list reached ${r.peakObstacles} on seed ${seed}`);
        assert.ok(r.s.obstacles.length < 40, 'obstacles left over at the end');
    }
});

t('nothing spawns on top of you', () => {
    // An obstacle created inside the hitbox is an unavoidable hit, and with
    // things now moving there are two ways to get one.
    for (const seed of [1, 4, 8]) {
        const s = fresh(seed);
        for (let i = 0; i < 3600 && !s.outcome; i++) {
            stepRace(s, { ...NO_INPUT, right: true }, DT);
            for (const o of s.obstacles) {
                if (!o.done && Math.abs(o.z - s.z) < 0.5 && Math.abs(o.lane - s.laneF) < 0.3) {
                    // Only legitimate if it was already being resolved this frame.
                    assert.ok(o.hit || o.done, `${o.def.kind} materialised on the player`);
                }
            }
        }
    }
});

/**
 * A player who is actually looking where they are going.
 *
 * The first version of the check below drove straight and hopped on a fixed
 * timer, and finished 2 runs in 12 — but measuring the same script with the
 * traffic removed gave 2 in 12 as well, so it was not measuring the traffic at
 * all. It was measuring how a hill treats somebody not steering, which is
 * harshly, and always has.
 *
 * So: a bot that reads the road. It picks the lane whose nearest blocker is
 * furthest away and hops what can be hopped. Not a good player — it has no
 * notion of lines or of speed — but a competent one, which is the standard the
 * descent has to be fair to.
 */
function drive(s: RaceState) {
    const LOOK = 26;
    let best = Math.round(s.laneF);
    let bestGap = -1;
    for (let lane = 0; lane < 4; lane++) {
        let gap = LOOK;
        for (const o of s.obstacles) {
            if (o.done || o.def.ramp) continue;
            const ahead = o.z - s.z;
            if (ahead < 0 || ahead > LOOK) continue;
            if (Math.abs(o.lane - lane) > o.def.wide + 0.6) continue;
            gap = Math.min(gap, ahead);
        }
        // Prefer the clearest lane, breaking ties toward the one you are in so
        // it does not oscillate between two equally good options every frame.
        const bias = lane === Math.round(s.laneF) ? 0.5 : 0;
        if (gap + bias > bestGap) { bestGap = gap + bias; best = lane; }
    }
    // Something ollie-able and close in the lane we are committed to.
    const imminent = s.obstacles.some(o =>
        !o.done && o.def.clear !== 'none'
        && o.z - s.z > 0 && o.z - s.z < 7
        && Math.abs(o.lane - s.laneF) < o.def.wide + 0.4);

    return {
        ...NO_INPUT,
        right: true,
        up: best < s.laneF - 0.25,
        down: best > s.laneF + 0.25,
        ollie: imminent && s.airT <= 0,
    };
}

t('a player who is looking where they are going gets down the hill', () => {
    let finished = 0;
    const runs = 10;
    for (let seed = 1; seed <= runs; seed++) {
        const s = fresh(seed);
        for (let i = 0; i < 9000 && !s.outcome; i++) stepRace(s, drive(s), DT);
        if (s.outcome && s.outcome !== 'wipeout') finished++;
    }
    assert.ok(finished >= 8, `a steering bot only finished ${finished}/${runs} runs`);
});

t('a useful share of what you meet is moving', () => {
    // Without this, everything above could pass on a road that technically has
    // traffic and practically never shows you any — which is how it started.
    //
    // Counted as a share of spawns rather than as frames near the racing line:
    // a bot that dodges well is rarely beside anything, so the frame count
    // measures the bot more than the road. Ten moving vehicles in a descent is
    // roughly one every ten seconds, which reads as a street rather than as a
    // car park with two exceptions in it.
    let moving = 0;
    let total = 0;
    const perRun: number[] = [];
    for (let seed = 1; seed <= 8; seed++) {
        const s = fresh(seed);
        const seen = new Set<number>();
        let mine = 0;
        for (let i = 0; i < 9000 && !s.outcome; i++) {
            stepRace(s, drive(s), DT);
            for (const o of s.obstacles) {
                if (seen.has(o.id)) continue;
                seen.add(o.id);
                total++;
                if (o.def.vz) { moving++; mine++; }
            }
        }
        perRun.push(mine);
    }
    const share = moving / total;
    assert.ok(share > 0.15, `only ${(share * 100).toFixed(0)}% of what spawns is moving`);
    assert.ok(share < 0.45, `${(share * 100).toFixed(0)}% moving — the road is now mostly traffic`);
    assert.ok(Math.min(...perRun) >= 2,
        `a run met only ${Math.min(...perRun)} moving vehicles`);
});

console.log(`\n${pass} traffic checks passed\n`);
