/**
 * The background of a section, as a population rather than a vibe.
 *
 * Two of the rules this module exists to enforce are invisible in a
 * screenshot. A donkey in Economy looks fine — it only ruins the level three
 * sections later, when the turn it was supposed to set up arrives and the
 * player has already seen a donkey. And a background actor that reacts to the
 * player looks *better* than one that does not, right up until the player
 * works out that the scenery is watching and the joke stops being a joke.
 *
 * Neither of those is something a reviewer catches by playing, so both are
 * caught here: the tier gate is checked against every tier, and the "cannot
 * see the player" rule is pinned by the arity of `stepBackdrop` itself.
 */
import assert from 'node:assert/strict';
import {
    populate, openBackdrop, stepBackdrop, shockwave, tightestGap,
    DEPTH, SHADE, LAYER_Y, GAMEPLAY_DEPTH,
    type Placement,
} from '../components/minigames/phaser/flight404/backdrop.ts';
import {
    CREEP, CREEP_ORDER, admits, actorBudget, creepRank, isAnomaly, anomalyBudget, type Creep,
} from '../components/minigames/phaser/flight404/creep.ts';
import { BEATS, DUCK } from '../components/minigames/phaser/flight404/background.ts';
import { SECTIONS, FLOOR_Y, CABIN_BASE } from '../components/minigames/phaser/flight404/content.ts';
import { rngFor } from '../utils/rng.ts';

const DT = 1 / 60;
let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

console.log('\nwho is allowed to be in the room');

t('every tier places only the kinds it admits', () => {
    // The gate that stops a donkey turning up in row 30 and spending the turn
    // before it is set up. Checked on all four tiers, because the one that
    // matters most is `plane`, where the correct answer is "almost nobody".
    for (const c of CREEP_ORDER) {
        const p = populate(c, 800, rngFor(`admit-${c}`));
        for (const a of p) {
            assert.ok(admits(c, a.def.kind), `a ${a.def.kind} appeared in a ${c} section`);
        }
    }
});

t('a plane section is nearly empty and bedlam is crowded', () => {
    // The gradient is the whole mechanism: if the first section is already a
    // bazaar there is no "wait, what" left to have.
    const len = 760;
    const plane = populate('plane', len, rngFor('dens-plane'));
    const bedlam = populate('bedlam', len, rngFor('dens-bedlam'));
    assert.ok(bedlam.length > plane.length,
        `bedlam produced ${bedlam.length} and plane ${plane.length} over the same ${len}px`);
    assert.ok(plane.length <= 4, `${plane.length} people in an ordinary cabin is already a crowd`);
});

t('density rises with every step along the creep order', () => {
    const len = 800;
    let last = -1;
    for (const c of CREEP_ORDER) {
        const n = populate(c, len, rngFor(`rise-${c}`)).length;
        assert.ok(n > last, `${c} (${n}) is no busier than the tier before it (${last})`);
        last = n;
    }
});

t('the count is the budget creep.ts asked for, not a number this file made up', () => {
    // Density lives in one place. If this drifted, retuning a tier would
    // quietly do nothing.
    for (const c of CREEP_ORDER) {
        for (const len of [200, 640, 760, 820]) {
            assert.equal(populate(c, len, rngFor(`b-${c}-${len}`)).length, actorBudget(c, len),
                `${c} over ${len}px ignored its budget`);
        }
    }
});

t('every authored section gets a background it can actually carry', () => {
    for (const s of SECTIONS) {
        const p = populate(s.creep, s.length, rngFor(`sec-${s.name}`));
        assert.ok(p.length >= 1, `${s.name} has nobody in it`);
        assert.ok(p.every(a => admits(s.creep, a.def.kind)), `${s.name} has a gatecrasher`);
        assert.ok(p.every(a => a.x >= 0 && a.x <= s.length), `${s.name} placed somebody outside the section`);
    }
});

t('the tiers that admit the whole cast use the whole cast', () => {
    // The bag shuffle exists so that a shuk is a shuk rather than sixteen
    // donkeys. Independent draws would produce runs; a bag cannot.
    const kinds = new Set(populate('bedlam', 820, rngFor('bag')).map(p => p.def.kind));
    assert.equal(kinds.size, CREEP.bedlam.admits.length, `only ${kinds.size} kinds turned up in bedlam`);
});

console.log('\nwhere they stand');

t('nobody is standing exactly where somebody else is', () => {
    // Uniform x over sixteen actors reliably stacks two of them. Slot dealing
    // makes the collision impossible rather than unlikely.
    for (const c of CREEP_ORDER) {
        const p = populate(c, 820, rngFor(`gap-${c}`));
        const xs = p.map(a => a.x);
        assert.equal(new Set(xs).size, xs.length, `two actors share an x in ${c}`);
        if (xs.length > 1) assert.ok(tightestGap(p) > 0, `${c} has a zero gap`);
    }
});

t('a player walking the section meets them spread out, not in a huddle', () => {
    // 820px of shuk is sixteen people. Clustered, that is one wall of noise and
    // then 400px of nothing.
    const p = populate('shuk', 820, rngFor('spread'));
    const xs = p.map(a => a.x).sort((a, b) => a - b);
    const ideal = 820 / xs.length;
    assert.ok(tightestGap(p) > ideal * 0.3, `the two closest are ${tightestGap(p).toFixed(1)}px apart`);
    // And the crowd covers the section rather than the first third of it.
    assert.ok(xs[xs.length - 1] - xs[0] > 820 * 0.7, 'they are all bunched at one end');
});

t('the far plane sits higher and darker than the near one', () => {
    // The only thing selling depth in a flat cabin. If a back actor is drawn at
    // full brightness on the floor line, it is just a person standing there.
    const p = populate('bedlam', 820, rngFor('layers'));
    const back = p.filter(a => a.layer === 'back');
    const mid = p.filter(a => a.layer === 'mid');
    assert.ok(back.length > 0 && mid.length > 0, 'the section only used one plane');
    assert.ok(Math.max(...back.map(a => a.y)) < Math.min(...mid.map(a => a.y)),
        'the two planes interleave, so nobody reads as further away');
    assert.ok(SHADE.back < SHADE.mid, 'distance is not dimmer');
    assert.ok(back.every(a => a.shade === SHADE.back) && mid.every(a => a.shade === SHADE.mid));
    // The rule reversed when the cabin became scenery. Residents used to stand
    // on FLOOR_Y, which is the line the player runs along — so the background
    // cast and the fight shared a floor and every bystander looked like
    // something you ought to be able to shoot. They stand in the cabin now, and
    // the aisle in front of it belongs to the gameplay.
    assert.equal(LAYER_Y.mid, CABIN_BASE, 'the near plane is not standing in the cabin');
    assert.ok(LAYER_Y.mid < FLOOR_Y, 'a resident is standing on the player aisle');
});

t('the whole background sorts under the gameplay', () => {
    // Props are added at depth 12 and the player at 10 in gameScene.ts. A
    // background actor drawn over the player is not a background actor.
    assert.ok(DEPTH.back < DEPTH.mid, 'the far plane draws in front of the near one');
    assert.ok(DEPTH.mid < GAMEPLAY_DEPTH - 4, `mid is at ${DEPTH.mid}, too close to the gameplay at ${GAMEPLAY_DEPTH}`);
    const p = populate('shuk', 820, rngFor('depth'));
    assert.ok(p.every(a => a.depth < GAMEPLAY_DEPTH), 'somebody in the scenery draws over a prop');
});

console.log('\nthe same section twice');

t('the same seed gives the same section, down to the pixel', () => {
    // A world that re-rolls cannot be learned. Walk out of a section and back
    // in and the coffee crew had better still be where you left them.
    const a = populate('shuk', 820, rngFor('same'));
    const b = populate('shuk', 820, rngFor('same'));
    assert.deepEqual(a, b, 'two runs of one seed produced different sections');
});

t('a different seed gives a different section', () => {
    // Guard the guard: if placement ignored rng entirely the check above would
    // pass and prove nothing.
    const a = populate('shuk', 820, rngFor('seed-a'));
    const b = populate('shuk', 820, rngFor('seed-b'));
    assert.notDeepEqual(a, b, 'every seed builds the same section');
    assert.notEqual(a.map((p: Placement) => p.x.toFixed(3)).join(),
        b.map((p: Placement) => p.x.toFixed(3)).join(), 'the positions are seed-independent');
});

t('opening a backdrop reproduces both the positions and the schedules', () => {
    const a = openBackdrop('shuk', 820, rngFor('open'));
    const b = openBackdrop('shuk', 820, rngFor('open'));
    assert.deepEqual(a, b);
    assert.equal(a.actors.length, a.placements.length, 'the two lists are not parallel');
});

console.log('\nten minutes of a section nobody is watching');

t('a full section runs for ten minutes without producing a bad number', () => {
    // The background is the one thing on screen for the entire level. A NaN
    // that takes four minutes to appear is a NaN that ships.
    let b = openBackdrop('shuk', 820, rngFor('long'));
    const rng = rngFor('long-run');
    const beats = b.actors.map(() => [] as string[]);

    for (let i = 0; i < 60 * 600; i++) {
        const r = stepBackdrop(b, 1 / 60, rng);
        b = r.backdrop;
        for (const f of r.frames) {
            assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y), `frame ${i} actor ${f.index} lost its position`);
            if (f.beat) beats[f.index].push(f.beat);
        }
        for (const a of b.actors) {
            assert.ok(Number.isFinite(a.timer) && Number.isFinite(a.ducking), `frame ${i} produced a bad timer`);
        }
    }

    for (let i = 0; i < beats.length; i++) {
        const kind = b.placements[i].def.kind;
        assert.ok(beats[i].length >= 4,
            `the ${kind} at ${b.placements[i].x.toFixed(0)} performed ${beats[i].length} times in ten minutes`);
        // Nobody is stuck on one beat. Every kind has at least two, and an
        // actor repeating a single line for ten minutes is furniture.
        assert.ok(new Set(beats[i]).size > 1,
            `the ${kind} at ${b.placements[i].x.toFixed(0)} played '${beats[i][0]}' and nothing else, forever`);
        assert.ok(new Set(beats[i]).size <= BEATS[kind].length);
    }
});

t('ten minutes is not a nervous tic either', () => {
    // Funny once a run, furniture by the fourth time.
    let b = openBackdrop('bedlam', 352, rngFor('tic'));
    const rng = rngFor('tic-run');
    let total = 0;
    for (let i = 0; i < 60 * 600; i++) {
        const r = stepBackdrop(b, 1 / 60, rng);
        b = r.backdrop;
        total += r.frames.filter(f => f.beat).length;
    }
    const per = total / b.actors.length;
    assert.ok(per < 90, `each actor performed ${per.toFixed(0)} times in ten minutes — that is a loop`);
});

t('the background cannot be told where the player is', () => {
    // This is the rule, and the enforcement is structural: stepBackdrop takes
    // a backdrop, a dt and an rng, and there is nowhere to put a player. If
    // this arity ever changes, somebody has smuggled awareness in and the
    // whole bit — scenery that carries on through a gunfight — is dead.
    assert.equal(stepBackdrop.length, 2, 'stepBackdrop grew an argument it has no business having');
    assert.equal(populate.length, 2, 'populate grew an argument');
});

console.log('\nthe one sanctioned reaction');

t('a blast makes the people near it duck', () => {
    const before = openBackdrop('shuk', 820, rngFor('blast'));
    const after = shockwave(before, 400, 120, () => 0);      // everyone who can, does
    const near = before.placements.map((p, i) => ({ i, near: Math.abs(p.x - 400) <= 120 }));
    const ducked = after.actors.filter(a => a.ducking > 0);
    assert.ok(ducked.length > 0, 'a grenade went off and nobody moved');
    assert.ok(ducked.every(a => a.ducking === DUCK.hold), 'somebody ducked for the wrong length of time');
    for (const { i, near: isNear } of near) {
        if (!isNear) assert.equal(after.actors[i].ducking, 0, 'somebody across the cabin ducked');
    }
});

t('the shawarma guy does not duck, because that is the joke', () => {
    // background.ts exempts him by name. A man who does not look up when a
    // grenade lands is funnier than one who does, and this is the only place
    // that exemption is visible at section scale.
    const b = openBackdrop('bedlam', 820, rngFor('shawarma'));
    const spits = b.placements.map((p, i) => ({ i, kind: p.def.kind })).filter(a => a.kind === 'shawarma');
    assert.ok(spits.length > 0, 'the section under test has no shawarma stand in it');
    const after = shockwave(b, 410, 10_000, () => 0);        // the whole cabin, guaranteed duck
    for (const { i } of spits) assert.equal(after.actors[i].ducking, 0, 'he flinched');
    assert.ok(after.actors.some(a => a.ducking > 0), 'nobody at all ducked, so this proves nothing');
});

t('they are back on the coffee two seconds later', () => {
    // Brief and scripted is what makes it a gag instead of awareness.
    let b = shockwave(openBackdrop('shuk', 820, rngFor('recover')), 400, 10_000, () => 0);
    assert.ok(b.actors.some(a => a.ducking > 0));
    const rng = rngFor('recover-run');
    for (let i = 0; i < 60 * (DUCK.hold + 1); i++) b = stepBackdrop(b, 1 / 60, rng).backdrop;
    assert.ok(b.actors.every(a => a.ducking === 0), 'still face-down long after the blast');
});

t('a blast nowhere near anybody changes nothing', () => {
    const b = openBackdrop('shuk', 820, rngFor('far'));
    assert.deepEqual(shockwave(b, 5000, 40, () => 0), b, 'a blast in the next county moved somebody');
});

t('a ducking actor performs nothing while it is down', () => {
    const b = shockwave(openBackdrop('shuk', 820, rngFor('quiet')), 400, 10_000, () => 0);
    const down = b.actors.map((a, i) => ({ i, down: a.ducking > 0 })).filter(a => a.down).map(a => a.i);
    const frames = stepBackdrop(b, 1 / 60, rngFor('quiet-step')).frames;
    for (const i of down) assert.equal(frames[i].beat, null, 'somebody did their bit face-down');
    assert.ok(down.every(i => frames[i].ducking), 'the frame did not report the duck to the renderer');
});

console.log('\nthe gradient, end to end');

t('walking the authored level, the background only ever gets busier', () => {
    // Per 100px, so a short boss arena does not read as a retreat.
    let last = -1;
    for (const s of SECTIONS) {
        const per100 = populate(s.creep, s.length, rngFor(`curve-${s.name}`)).length / (s.length / 100);
        if (creepRank(s.creep) > 0) {
            assert.ok(per100 >= last - 0.01, `${s.name} is emptier than the section before it`);
        }
        last = per100;
    }
});

t('the cockpit is the busiest place in the game', () => {
    // The boss fight only works if everybody is there and nobody is helping.
    const cockpit = SECTIONS[SECTIONS.length - 1];
    const economy = SECTIONS[0];
    const dense = (s: typeof cockpit) =>
        populate(s.creep, s.length, rngFor(`d-${s.name}`)).length / (s.length / 100);
    assert.ok(dense(cockpit) > dense(economy) * 4, 'the boss arena is no busier than row 30');
});

t('a section shorter than one actor still gets one', () => {
    // actorBudget floors at 1, and a divide-by-zero slot would put them all on
    // top of each other at the same x.
    for (const c of CREEP_ORDER) {
        const p = populate(c, 10, rngFor(`tiny-${c}`));
        assert.ok(p.length >= 1, `${c} over 10px produced nobody`);
        assert.ok(p.every(a => Number.isFinite(a.x)), `${c} over 10px produced a bad x`);
    }
});


// ---------------------------------------------------------------------------
// One donkey
// ---------------------------------------------------------------------------
/**
 * The `wrong` tier is the hinge of the whole gag, and it is the one place where
 * "busier" and "weirder" pull in opposite directions.
 *
 * It has to be fuller than the cabin before it — that is the escalation, and
 * the check above measures it on density at a fixed length. But it also has to
 * contain exactly one thing that has no business being there, because the
 * second donkey answers the question the first one asked. Before the ration in
 * `creep.ts` existed, a galley shipped with two donkeys, a coffee service and a
 * man sweeping: the bazaar arriving a section early, and the question never
 * asked at all.
 *
 * So the body count and the joke count are separate numbers now, and these are
 * the checks that keep them separate.
 */
t('a rationed tier holds exactly one thing that does not belong', () => {
    for (const seed of ['one', 'two', 'three', 'four', 'five', 'six']) {
        const kinds = populate('wrong', 640, rngFor(`ration-${seed}`)).map(p => p.def.kind);
        const odd = kinds.filter(k => isAnomaly('wrong', k));
        assert.equal(odd.length, anomalyBudget('wrong'),
            `the galley shipped ${odd.length} anomalies (${odd.join(', ')}) — one is the joke, two is a bazaar`);
    }
});

t('spending the ration does not cost the section its body count', () => {
    // The fix for two donkeys must not be four fewer people; that would undo
    // the escalation the tier exists to deliver.
    for (const seed of ['a', 'b', 'c']) {
        const n = populate('wrong', 640, rngFor(`count-${seed}`)).length;
        assert.equal(n, actorBudget('wrong', 640),
            'rationing the joke quietly emptied the cabin');
    }
});

t('the rest of the cabin is passengers, not filler that breaks the tier gate', () => {
    for (const seed of ['a', 'b', 'c']) {
        for (const p of populate('wrong', 640, rngFor(`staple-${seed}`))) {
            assert.ok(admits('wrong', p.def.kind),
                `the ration substituted a ${p.def.kind}, which this tier does not admit`);
        }
    }
});

t('a tier with no ration still uses its whole cast', () => {
    // `shuk` and `bedlam` ration nothing, because by then the weirdness IS the
    // furniture. A ration that leaked into them would flatten the payoff.
    const kinds = new Set(populate('shuk', 820, rngFor('unrationed')).map(p => p.def.kind));
    assert.ok(kinds.size >= 6, `a shuk drew only ${kinds.size} kinds — the ration has leaked upwards`);
    assert.equal(anomalyBudget('shuk'), Infinity, 'shuk should ration nothing');
});


t('the things that get in your way are on your floor, and the scenery is not', () => {
    // The split the whole layout rests on, checked from both sides. A crossing
    // shares the player's aisle because it is meant to be in the way; a
    // resident never does, because it is meant to be looked at.
    const rng = rngFor('aisle-split');
    let b = openBackdrop('shuk', 820, rng);
    for (const p of b.placements) {
        assert.ok(p.y <= CABIN_BASE, `a ${p.def.kind} is standing at y${p.y}, on the aisle`);
    }
    let sawCrossing = false;
    for (let i = 0; i < 60 * 120; i++) {
        const r = stepBackdrop(b, DT, rng);
        b = r.backdrop;
        for (const c of r.crossings) {
            sawCrossing = true;
            assert.equal(c.y, FLOOR_Y, `a ${c.kind} is crossing at y${c.y} instead of the aisle`);
        }
    }
    assert.ok(sawCrossing, 'nothing crossed in two minutes, so this proved nothing');
});

t('residents are not all turned the same way', () => {
    // `facing` was picked when a resident was placed and then thrown away, so
    // every coffee crew in a section faced identically and a crowded cabin read
    // as a wallpaper repeat. It reaches the renderer now.
    const p = populate('bedlam', 820, rngFor('facing'));
    const right = p.filter(a => a.def.facing === 1).length;
    assert.ok(right > 0 && right < p.length, `all ${p.length} residents face the same way`);
});

console.log(`\n${pass} backdrop checks passed.\n`);
