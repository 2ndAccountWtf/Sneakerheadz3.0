/**
 * Flight 404's cabin, as a place you can actually climb.
 *
 * The game shipped with a jump button and nothing to land on: a section was
 * `length`, `dark`, and lists of x-positions, with no terrain in the data model
 * at all. It even placed perched throwers at `BIN_FEET` with gravity switched
 * off — floating on overhead bins that did not exist as collision.
 *
 * Terrain is the one thing in a platformer that cannot be eyeballed. One jump
 * is worth 38px; a rung at 36px and a rung at 40px look identical in a level
 * file and are the difference between a game and a soft lock. So every rung is
 * arithmetic, and these checks are the arithmetic.
 */
import assert from 'node:assert/strict';
import {
    JUMP_PEAK, MAX_STEP, HOP_MARGIN, TIER, canHop, unreachable, surfaces,
    blocksRunning, headroom, TILE, SURFACE, has, isFooting, conveyorDir,
    type PlatformDef,
} from '../components/minigames/phaser/flight404/terrain.ts';
import {
    openActor, stepActor, blastNear, BEATS, BEAT_EVERY, DUCK, isInteractive,
    type ActorKind,
} from '../components/minigames/phaser/flight404/background.ts';
import {
    PROP_HP, PROP_DROP_CHANCE, PROP_BLAST, PROP_ART, artFor, isHurt, type PropKind,
} from '../components/minigames/phaser/flight404/props.ts';
import { EXPLOSIONS, caughtInBlast } from '../components/minigames/phaser/flight404/explosions.ts';
import { moverAt, isRideable, cycleTime, type MoverDef } from '../components/minigames/phaser/flight404/movers.ts';
import {
    openSpawner, stepSpawner, spent, inRange, DEFAULT_RANGE, type SpawnerDef,
} from '../components/minigames/phaser/flight404/spawners.ts';
import { GRAVITY, JUMP_V, FLOOR_Y, BIN_FEET, PLAYER_H } from '../components/minigames/phaser/flight404/content.ts';
import { rngFor } from '../utils/rng.ts';
import { SECTIONS } from '../components/minigames/phaser/flight404/content.ts';
import {
    CREEP, CREEP_ORDER, creepRank, admits, actorBudget, neverRetreats, firstTurn,
    type Creep,
} from '../components/minigames/phaser/flight404/creep.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

console.log('\nthe climb');

t('one jump is worth what the physics says it is', () => {
    // v^2 / 2g, and nothing else. If gravity or the jump is ever retuned this
    // recomputes, and every rung below is rechecked against the new number.
    assert.equal(JUMP_PEAK, (JUMP_V * JUMP_V) / (2 * GRAVITY));
    assert.ok(JUMP_PEAK > 30 && JUMP_PEAK < 50, `a jump lifts ${JUMP_PEAK}px — the ladder was built for ~38`);
});

t('we never ask for the whole jump', () => {
    // Landing at the apex arrives with zero vertical speed on the one frame the
    // boxes overlap, which reads as "the jump did not work" about half the time.
    assert.ok(MAX_STEP < JUMP_PEAK, 'no margin at all');
    assert.equal(MAX_STEP, JUMP_PEAK - HOP_MARGIN);
    assert.ok(HOP_MARGIN >= 3, `a ${HOP_MARGIN}px margin is not a margin`);
});

t('every rung of the cabin is inside one jump', () => {
    // The check that caught the first draft of this table, which used three
    // rungs and was 2px a step too greedy.
    const rungs = Object.entries(TIER);
    for (let i = 1; i < rungs.length; i++) {
        const [fromName, fromY] = rungs[i - 1];
        const [toName, toY] = rungs[i];
        assert.ok(canHop(fromY, toY),
            `${fromName} (${fromY}) to ${toName} (${toY}) is ${fromY - toY}px — over the ${MAX_STEP.toFixed(1)} budget`);
    }
});

t('the ladder starts on the floor and ends at the bins', () => {
    // The bins are where the throwers already were. If the top rung stops
    // short of them they are still floating on nothing.
    assert.equal(TIER.floor, FLOOR_Y);
    assert.equal(TIER.bin, BIN_FEET);
});

t('the rungs go strictly upward', () => {
    const ys = Object.values(TIER);
    for (let i = 1; i < ys.length; i++) {
        assert.ok(ys[i] < ys[i - 1], `rung ${i} at ${ys[i]} is not above ${ys[i - 1]}`);
    }
});

console.log('\nreachability, which is not the same as existence');

const plat = (x: number, y: number, w = 40, flags = SURFACE.seat): PlatformDef => ({ x, y, w, flags });

t('a platform within a hop of the floor is reachable', () => {
    assert.deepEqual(unreachable([plat(100, TIER.seat)]), []);
});

t('a platform out of reach with nothing under it is reported', () => {
    const island = plat(100, TIER.bin);
    assert.deepEqual(unreachable([island]), [island], 'an unclimbable bin was called reachable');
});

t('a ladder of platforms is reachable all the way up', () => {
    const ladder = [
        plat(100, TIER.seat), plat(110, TIER.seatback),
        plat(120, TIER.counter), plat(130, TIER.bin, 60, SURFACE.bin),
    ];
    assert.deepEqual(unreachable(ladder), [], 'a complete ladder was called unclimbable');
});

t('a ladder with a rung missing is reported, not silently accepted', () => {
    // The soft lock this whole module exists to prevent.
    const gap = [plat(100, TIER.seat), plat(130, TIER.bin, 60, SURFACE.bin)];
    assert.equal(unreachable(gap).length, 1, 'a two-rung jump to the bins passed');
});

t('a rung you cannot run to is not a rung', () => {
    // Right height, wrong end of the cabin.
    const far = plat(9000, TIER.seat);
    assert.deepEqual(unreachable([far]), [], 'the floor runs the whole section, so this one is fine');
    const stranded = [plat(100, TIER.seat), plat(9000, TIER.bin, 40, SURFACE.bin)];
    assert.equal(unreachable(stranded).length, 1, 'a bin at the far end was reachable from a seat at the near end');
});

t('surfaces always include the floor and are listed top-down', () => {
    const s = surfaces([plat(0, TIER.counter), plat(50, TIER.seat)]);
    assert.ok(s.includes(FLOOR_Y), 'the floor is not a surface');
    for (let i = 1; i < s.length; i++) assert.ok(s[i] < s[i - 1], 'surfaces are not sorted downward-first');
});

t('a low platform is flagged as something you have to crouch under', () => {
    const low = plat(40, FLOOR_Y - (PLAYER_H - 4));
    assert.equal(blocksRunning(low), true, 'a head-height ledge was not flagged');
    assert.equal(blocksRunning(plat(40, TIER.counter)), false, 'a galley counter was called a head-banger');
    assert.ok(headroom(plat(0, TIER.bin)) > PLAYER_H);
});

console.log('\nwhat a surface does, rather than what it is');

t('a surface can do several things at once', () => {
    // The point of the conversion. This was an enum with two behaviours, which
    // forces a new type every time a surface needs to behave slightly
    // differently. A belt that is also solid is one OR, not a subclass.
    const belt = SURFACE.beltFwd;
    assert.equal(has(belt, TILE.SOLID), true);
    assert.equal(has(belt, TILE.CONVEYOR_R), true);
    assert.equal(has(belt, TILE.CONVEYOR_L), false);
});

t('every flag is its own bit, so nothing collides', () => {
    const bits = Object.values(TILE);
    assert.equal(new Set(bits).size, bits.length, 'two flags share a bit');
    for (const b of bits) {
        assert.ok(b > 0 && (b & (b - 1)) === 0, `${b} is not a single bit`);
    }
});

t('an enemy-only wall is invisible to the player', () => {
    // The fix for "the charger ran off the counter and died", authored in the
    // level rather than patched into the AI with raycasts.
    assert.equal(has(SURFACE.fence, TILE.ENEMY_WALL), true);
    assert.equal(has(SURFACE.fence, TILE.SOLID), false, 'the player would walk into an invisible wall');
    assert.equal(isFooting({ x: 0, y: 0, w: 10, flags: SURFACE.fence }), false, 'a fence became a rung');
});

t('a fence is never counted as part of the climb', () => {
    // If it were, a level could "prove" reachable via a wall the player cannot
    // stand on, which is the exact soft lock the ladder maths exists to stop.
    const withFence = [plat(100, TIER.seat, 40, SURFACE.fence), plat(130, TIER.bin, 60, SURFACE.bin)];
    assert.equal(unreachable(withFence).length, 1, 'a bin was reachable by standing on a fence');
});

t('a conveyor knows which way it drags', () => {
    assert.equal(conveyorDir(SURFACE.beltFwd), 1);
    assert.equal(conveyorDir(SURFACE.beltBack), -1);
    assert.equal(conveyorDir(SURFACE.counter), 0);
});

t('a seat is jumped through and a counter is not', () => {
    assert.equal(has(SURFACE.seat, TILE.ONE_WAY), true);
    assert.equal(has(SURFACE.counter, TILE.ONE_WAY), false);
    // Both still hold you up, which is what makes them rungs.
    assert.equal(isFooting({ x: 0, y: 0, w: 9, flags: SURFACE.seat }), true);
    assert.equal(isFooting({ x: 0, y: 0, w: 9, flags: SURFACE.counter }), true);
});

console.log('\nthe world that refuses to acknowledge the gunfight');

const KINDS: ActorKind[] = ['coffee', 'shawarma', 'sweeper', 'balcony', 'porter', 'argument', 'donkey', 'sheep'];

t('every actor kind has beats and a rhythm', () => {
    for (const k of KINDS) {
        assert.ok(BEATS[k]?.length, `${k} has nothing to do`);
        assert.ok(BEAT_EVERY[k] > 0, `${k} has no rhythm`);
    }
});

t('the rare beats are genuinely rare', () => {
    // Funny once a run, furniture by the fourth time. Anything under about ten
    // seconds is a loop the player will notice and stop finding funny.
    for (const k of KINDS) {
        assert.ok(BEAT_EVERY[k] >= 10, `${k} performs every ${BEAT_EVERY[k]}s — that is a loop, not a gag`);
    }
});

t('nothing in the background can be shot, and nothing blocks', () => {
    // A player who learns the scenery is shootable spends the level shooting
    // scenery. There is deliberately no way to make one interactive.
    assert.equal(isInteractive(), false);
});

t('an actor performs on its own schedule and never sees the player', () => {
    // stepActor takes no player argument at all. That is the enforcement:
    // awareness is impossible rather than merely discouraged.
    let s = openActor({ kind: 'coffee', x: 100 }, rngFor('coffee'));
    let beats = 0;
    for (let i = 0; i < 60 * 300; i++) {
        const r = stepActor(s, 1 / 60, rngFor(`c-${i}`));
        s = r.state;
        if (r.beat) beats++;
    }
    assert.ok(beats > 3, `five minutes produced only ${beats} beats`);
    assert.ok(beats < 60, `${beats} beats in five minutes is a nervous tic`);
});

t('a street full of actors does not perform in unison', () => {
    // Staggered on open, or the whole background moves as one organism.
    const timers = KINDS.map((k, i) => openActor({ kind: k, x: i * 40 }, rngFor(`stagger-${i}`)).timer);
    assert.ok(new Set(timers.map(t => Math.round(t))).size > 1, 'every actor opened on the same beat');
});

t('a blast makes some of them duck, and they go back to it', () => {
    const before = openActor({ kind: 'coffee', x: 0 }, rngFor('duck'));
    const ducked = blastNear({ ...before, ducking: 0 }, () => 0);   // always ducks
    assert.equal(ducked.ducking, DUCK.hold);

    // And two seconds later, coffee.
    let s = ducked;
    for (let i = 0; i < 60 * (DUCK.hold + 1); i++) s = stepActor(s, 1 / 60, rngFor('back')).state;
    assert.equal(s.ducking, 0, 'still ducking long after the blast');
});

t('the shawarma guy never ducks, because that is the joke', () => {
    const s = openActor({ kind: 'shawarma', x: 0 }, rngFor('sh'));
    assert.equal(blastNear(s, () => 0).ducking, 0, 'he flinched');
});

t('a ducking actor performs nothing until it stands up', () => {
    let s = { ...openActor({ kind: 'coffee', x: 0 }, rngFor('q')), timer: 0, ducking: DUCK.hold };
    const r = stepActor(s, 1 / 60, rngFor('q2'));
    assert.equal(r.beat, null, 'it performed its bit while face-down');
});

console.log('\nthe plane slowly stops being a plane');

t('the weirdness never retreats', () => {
    // The rule the whole joke rests on. Going back to a normal cabin after a
    // shuk does not read as variety, it reads as the level forgetting itself —
    // and it spends an escalation you cannot get back.
    const order = SECTIONS.map(s => s.creep);
    assert.ok(neverRetreats(order), `the curve goes backwards: ${order.join(' -> ')}`);
});

t('it starts as an ordinary plane, and ends as neither', () => {
    // If section one is already a bazaar there is no "wait, what" to have.
    assert.equal(SECTIONS[0].creep, 'plane', 'the first section spends the joke before it is set up');
    assert.equal(SECTIONS[SECTIONS.length - 1].creep, 'bedlam', 'it never fully arrives anywhere');
});

t('the wait-what lands early enough to matter', () => {
    // A turn that arrives in the last section is a turn nobody sees.
    const turn = firstTurn(SECTIONS.map(s => s.creep));
    assert.ok(turn > 0, 'nothing is ever normal, so nothing is ever strange');
    assert.ok(turn <= 2, `the first strange thing is section ${turn + 1} — too late to be a turn`);
});

t('the curve actually climbs rather than sitting flat', () => {
    const ranks = SECTIONS.map(s => creepRank(s.creep));
    assert.ok(Math.max(...ranks) - Math.min(...ranks) >= 2, 'the level barely changes across its whole length');
});

t('a donkey cannot appear before the joke is set up', () => {
    // One wrong thing at a time. A donkey in Economy spends the turn early.
    assert.equal(admits('plane', 'donkey'), false, 'there is a donkey in row 30');
    assert.equal(admits('plane', 'shawarma'), false, 'somebody is carving in Economy');
    assert.equal(admits('wrong', 'donkey'), true, 'the turn has nothing strange in it');
});

t('the market only opens once the cabin has lost', () => {
    assert.equal(admits('wrong', 'shawarma'), false, 'a full stand appeared during the hint');
    assert.equal(admits('shuk', 'shawarma'), true);
    assert.equal(admits('shuk', 'sheep'), true);
});

t('every tier admits something, and later tiers admit more', () => {
    let last = -1;
    for (const c of CREEP_ORDER) {
        const n = CREEP[c].admits.length;
        assert.ok(n > 0, `${c} has an empty world`);
        assert.ok(n >= last, `${c} admits fewer kinds than the tier before it`);
        last = n;
    }
});

t('the cabin gets more crowded as it gets stranger', () => {
    for (let i = 1; i < CREEP_ORDER.length; i++) {
        assert.ok(CREEP[CREEP_ORDER[i]].density > CREEP[CREEP_ORDER[i - 1]].density,
            `${CREEP_ORDER[i]} is no busier than ${CREEP_ORDER[i - 1]}`);
    }
});

t('every section gets a workable number of actors', () => {
    for (const s of SECTIONS) {
        const n = actorBudget(s.creep, s.length);
        assert.ok(n >= 1, `${s.name} has an empty background`);
        assert.ok(n < 60, `${s.name} wants ${n} actors — that is a crowd, not a background`);
    }
});

t('every tier says what the player should be thinking', () => {
    // The design intent lives with the data, so a later pass cannot quietly
    // dress a tier against the wrong feeling.
    for (const c of CREEP_ORDER) assert.ok(CREEP[c].reads.length > 8, `${c} has no stated intent`);
});

t('every section is dressed with something', () => {
    for (const c of CREEP_ORDER) assert.ok(CREEP[c].dressing.length > 0, `${c} is an empty room`);
});

t('a retreating order is caught, not tolerated', () => {
    // Guard the guard: if neverRetreats always returned true it would prove
    // nothing about the sections above.
    assert.equal(neverRetreats(['plane', 'shuk', 'wrong'] as Creep[]), false);
    assert.equal(neverRetreats(['plane', 'plane', 'shuk'] as Creep[]), true, 'two of the same tier is a longer stretch, not a retreat');
});

console.log('\nthings that break');

t('every prop kind has hit points and a drop chance', () => {
    const kinds: PropKind[] = ['crate', 'cart', 'cooler', 'binDoor', 'monitor'];
    for (const k of kinds) {
        assert.ok(PROP_HP[k] > 0, `${k} cannot be destroyed`);
        assert.ok(PROP_DROP_CHANCE[k] >= 0 && PROP_DROP_CHANCE[k] <= 1, `${k} has a nonsense drop chance`);
    }
});

t('the heavy things take longer than the flimsy things', () => {
    assert.ok(PROP_HP.cooler > PROP_HP.cart, 'a cooler is flimsier than a trolley');
    assert.ok(PROP_HP.cart > PROP_HP.crate, 'a trolley is flimsier than a cardboard case');
    assert.ok(PROP_HP.monitor < PROP_HP.crate, 'a seat-back screen is tougher than a crate');
});

t('a seat-back screen is destroyed for pleasure, not for loot', () => {
    assert.equal(PROP_DROP_CHANCE.monitor, 0, 'the screens became a farming strategy');
});

t('a prop looks damaged before it dies', () => {
    // The three-state shape, taken from how the Metal Slug clones model
    // obstacles: idle -> hit -> blast. A thing that vanishes at full health
    // gives the player nothing to read.
    assert.equal(artFor('cart', PROP_HP.cart), PROP_ART.cart.idle, 'an untouched trolley already looks wrecked');
    assert.equal(artFor('cart', 1), PROP_ART.cart.hit, 'a nearly-dead trolley still looks fine');
    assert.equal(isHurt('cart', PROP_HP.cart), false);
    assert.equal(isHurt('cart', 1), true);
});

t('every prop names a blast from the shared library', () => {
    const kinds: PropKind[] = ['crate', 'cart', 'cooler', 'binDoor', 'monitor'];
    for (const k of kinds) {
        assert.ok(EXPLOSIONS[PROP_BLAST[k]], `${k} explodes with something that does not exist`);
    }
});

t('the heavy props go out on the big blast', () => {
    assert.equal(PROP_BLAST.cart, 'big');
    assert.equal(PROP_BLAST.cooler, 'big');
    assert.equal(PROP_BLAST.monitor, 'tiny', 'a seat screen levelled the cabin');
});

console.log('\nblasts');

t('a bigger blast shakes harder, hurts wider and lasts longer', () => {
    const [tiny, small, big] = [EXPLOSIONS.tiny, EXPLOSIONS.small, EXPLOSIONS.big];
    assert.ok(big.shake > small.shake && small.shake > tiny.shake, 'shake is not ordered');
    assert.ok(big.hurtRadius > small.hurtRadius, 'the big one is not more dangerous');
    assert.ok(big.duration > small.duration && small.duration > tiny.duration, 'duration is not ordered');
});

t('a cosmetic blast cannot hurt anybody', () => {
    assert.equal(EXPLOSIONS.tiny.hurtRadius, 0);
    assert.equal(EXPLOSIONS.tiny.damage, 0);
    assert.equal(caughtInBlast('tiny', 0), false, 'breaking a screen injured somebody');
});

t('standing outside the radius is safe, inside is not', () => {
    assert.equal(caughtInBlast('big', EXPLOSIONS.big.hurtRadius - 1), true);
    assert.equal(caughtInBlast('big', EXPLOSIONS.big.hurtRadius + 1), false);
});

console.log('\nthings that move');

const belt: MoverDef = { kind: 'belt', from: 100, to: 300, y: TIER.counter, speed: 50, dwell: 1 };

t('a mover starts where it says it starts', () => {
    assert.equal(moverAt(belt, 0), 100);
});

t('a mover crosses its span and comes back', () => {
    const travel = (belt.to - belt.from) / belt.speed;       // 4s
    assert.equal(moverAt(belt, travel), belt.to);
    assert.ok(moverAt(belt, travel / 2) > belt.from && moverAt(belt, travel / 2) < belt.to);
    // After the far dwell it is on its way home.
    assert.ok(moverAt(belt, travel + belt.dwell! + travel / 2) < belt.to);
});

t('a mover never leaves its own span, at any time', () => {
    const lo = Math.min(belt.from, belt.to);
    const hi = Math.max(belt.from, belt.to);
    for (let time = 0; time < 200; time += 0.13) {
        const x = moverAt(belt, time);
        assert.ok(x >= lo - 0.001 && x <= hi + 0.001, `at t=${time.toFixed(2)} it was at ${x}`);
    }
});

t('a mover repeats exactly, so timing can be learned', () => {
    // A rung that arrives on a schedule is only a rung if the schedule holds.
    const travel = (belt.to - belt.from) / belt.speed;
    const cycle = (travel + belt.dwell!) * 2;
    for (const time of [0, 0.7, 2.2, 3.9, 6.1]) {
        assert.ok(Math.abs(moverAt(belt, time) - moverAt(belt, time + cycle)) < 0.001,
            `the cycle drifts at t=${time}`);
    }
});

t('a degenerate mover sits still instead of dividing by zero', () => {
    assert.equal(moverAt({ kind: 'belt', from: 50, to: 50, speed: 40 }, 3), 50);
    assert.equal(moverAt({ kind: 'belt', from: 50, to: 90, speed: 0 }, 3), 50);
});

t('a runaway trolley is not something you stand on', () => {
    assert.equal(isRideable({ kind: 'runaway', from: 0, to: 100, speed: 90 }), false);
    assert.equal(isRideable(belt), true);
    assert.equal(isRideable({ kind: 'binSwing', from: 0, to: 20, speed: 10 }), true);
});

console.log('\nwaves, instead of a memorisable gauntlet');

const def: SpawnerDef = { x: 300, roster: ['charger', 'thrower'], interval: 2, total: 4 };

t('a spawner sleeps until the player is near', () => {
    let s = openSpawner(def);
    for (let i = 0; i < 40; i++) {
        const r = stepSpawner(s, 1 / 60, 0);   // player miles away
        s = r.state;
        assert.equal(r.spawn, null, 'it produced from across the cabin');
    }
    assert.equal(s.awake, false);
});

t('it never produces on the frame it wakes', () => {
    // Arriving the instant you cross an invisible line reads as a cheat.
    const r = stepSpawner(openSpawner(def), 1 / 60, def.x);
    assert.equal(r.state.awake, true, 'it did not wake up next to the player');
    assert.equal(r.spawn, null, 'an enemy appeared the moment the trigger tripped');
});

t('once awake it produces on its interval, and then stops', () => {
    let s = openSpawner(def);
    let made = 0;
    for (let i = 0; i < 60 * 60; i++) {
        const r = stepSpawner(s, 1 / 60, def.x);
        s = r.state;
        if (r.spawn) made++;
    }
    assert.equal(made, def.total, `a wave of ${def.total} produced ${made}`);
    assert.equal(spent(s), true, 'the spawner is still hungry');
});

t('a wave is readable — the roster comes round in order', () => {
    let s = openSpawner(def);
    const seen: string[] = [];
    for (let i = 0; i < 60 * 60 && seen.length < 4; i++) {
        const r = stepSpawner(s, 1 / 60, def.x);
        s = r.state;
        if (r.spawn) seen.push(r.spawn);
    }
    assert.deepEqual(seen, ['charger', 'thrower', 'charger', 'thrower'], `got ${seen.join(',')}`);
});

t('two spawners in one section do not fire in lockstep', () => {
    // Staggered on open, so a section does not arrive in one lump.
    assert.ok(openSpawner(def).timer > 0, 'a spawner opens ready to fire');
    assert.ok(openSpawner(def).timer < def.interval, 'a spawner opens a full interval behind');
});

t('range is honoured, and has a default', () => {
    const s = openSpawner({ ...def, range: undefined });
    assert.equal(inRange(s, def.x + DEFAULT_RANGE - 1), true);
    assert.equal(inRange(s, def.x + DEFAULT_RANGE + 1), false);
    // From either side — a spawner behind you is the point.
    assert.equal(inRange(s, def.x - DEFAULT_RANGE + 1), true);
});

t('a spent spawner stays quiet forever', () => {
    let s = { ...openSpawner(def), produced: def.total };
    for (let i = 0; i < 600; i++) {
        const r = stepSpawner(s, 1 / 60, def.x);
        s = r.state;
        assert.equal(r.spawn, null, 'a spent spawner started up again');
    }
});

t('a mover reports its own cycle time', () => {
    const belt2: MoverDef = { kind: 'belt', from: 0, to: 200, speed: 50, dwell: 1 };
    assert.equal(cycleTime(belt2), (200 / 50 + 1) * 2);
    assert.equal(cycleTime({ kind: 'belt', from: 5, to: 5, speed: 10 }), 0);
});

console.log(`\n${pass} flight-404 checks passed.\n`);
