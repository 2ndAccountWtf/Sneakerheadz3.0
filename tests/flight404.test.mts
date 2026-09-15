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
    blocksRunning, headroom, moverAt, isRideable,
    PROP_HP, PROP_DROP_CHANCE,
    type PlatformDef, type MoverDef, type PropKind,
} from '../components/minigames/phaser/flight404/terrain.ts';
import { GRAVITY, JUMP_V, FLOOR_Y, BIN_FEET, PLAYER_H } from '../components/minigames/phaser/flight404/content.ts';

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

const plat = (x: number, y: number, w = 40, kind: PlatformDef['kind'] = 'seat'): PlatformDef => ({ x, y, w, kind });

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
        plat(120, TIER.counter), plat(130, TIER.bin, 60, 'bin'),
    ];
    assert.deepEqual(unreachable(ladder), [], 'a complete ladder was called unclimbable');
});

t('a ladder with a rung missing is reported, not silently accepted', () => {
    // The soft lock this whole module exists to prevent.
    const gap = [plat(100, TIER.seat), plat(130, TIER.bin, 60, 'bin')];
    assert.equal(unreachable(gap).length, 1, 'a two-rung jump to the bins passed');
});

t('a rung you cannot run to is not a rung', () => {
    // Right height, wrong end of the cabin.
    const far = plat(9000, TIER.seat);
    assert.deepEqual(unreachable([far]), [], 'the floor runs the whole section, so this one is fine');
    const stranded = [plat(100, TIER.seat), plat(9000, TIER.bin, 40, 'bin')];
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

console.log(`\n${pass} flight-404 checks passed.\n`);
