/**
 * The cabin, checked one rung at a time.
 *
 * `terrain.ts` proved the ladder was arithmetically possible. `layout.ts` is
 * the part where somebody sits down and decides that the bin door hangs at
 * x=100 — and that is where the arithmetic stops helping and starts being
 * needed, because a level file is thirty numbers that all look plausible.
 *
 * So every section is climbed twice here, by two checks that do not share code.
 * `unreachable()` walks the level the way the game's own terrain module does.
 * `climb()` below walks it again from scratch and is *stricter*: it also
 * insists that the rung you jump from has standing room clear of the rung you
 * are jumping to, which `unreachable()` has no opinion about and which is the
 * difference between a step and a ceiling. Two checks that agree are worth more
 * than one, and the last test in this file deliberately breaks the geometry to
 * show that both of them notice.
 */
import assert from 'node:assert/strict';
import {
    MAX_STEP, TILE, unreachable, isFooting, has, conveyorDir,
    type PlatformDef,
} from '../components/minigames/phaser/flight404/terrain.ts';
import { layoutFor, LAYOUTS, sectionLength } from '../components/minigames/phaser/flight404/layout.ts';
import { SECTIONS, FLOOR_Y, BIN_FEET, PLAYER_H, RUN_SPEED, VIEW_H } from '../components/minigames/phaser/flight404/content.ts';
import { rngFor } from '../utils/rng.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

/** Seeds to sweep. The layouts only vary their dressing, but say so out loud. */
const SEEDS = Array.from({ length: 240 }, (_, i) => `seed-${i}`);
const forEachSection = (f: (ps: PlatformDef[], i: number, name: string) => void, key = 'fixed') =>
    SECTIONS.forEach((s, i) => f(layoutFor(i, rngFor(`${key}-${i}`)), i, s.name));

// ---------------------------------------------------------------------------
// The independent climb. Deliberately not the one in terrain.ts.
// ---------------------------------------------------------------------------

/** The same horizontal slack `unreachable()` allows: a quarter of a stride. */
const LUNGE = RUN_SPEED / 4;
/**
 * How much of the rung you jump from has to be clear of the rung you are
 * jumping to. Take off from directly underneath a ledge and you hit it from
 * below and land where you started, which the player experiences as the jump
 * button not working.
 */
const CLEAR = 8;

interface Span { y: number; x0: number; x1: number }

/** Can you get from standing on `q` to standing on top of `p`? */
const stepsUpTo = (q: Span, p: PlatformDef): boolean => {
    const rise = q.y - p.y;
    if (rise < 0 || rise > MAX_STEP) return false;                  // too high, or below you
    if (q.x1 < p.x - LUNGE || q.x0 > p.x + p.w + LUNGE) return false; // cannot run at it
    const clearLeft = Math.min(q.x1, p.x) - q.x0;
    const clearRight = q.x1 - Math.max(q.x0, p.x + p.w);
    return Math.max(clearLeft, clearRight) >= CLEAR;                 // room to take off from
};

/** Every footing platform that cannot be climbed to, worked out from nothing. */
function climb(platforms: PlatformDef[], length: number): PlatformDef[] {
    const footings = platforms.filter(isFooting);
    const stood: Span[] = [{ y: FLOOR_Y, x0: -length, x1: length * 2 }];
    const left = new Set(footings);
    for (let pass = 0; pass < footings.length + 1 && left.size; pass++) {
        let moved = false;
        for (const p of [...left]) {
            if (!stood.some(q => stepsUpTo(q, p))) continue;
            stood.push({ y: p.y, x0: p.x, x1: p.x + p.w });
            left.delete(p);
            moved = true;
        }
        if (!moved) break;
    }
    return [...left];
}

const show = (p: PlatformDef) => `(x${p.x} y${p.y} w${p.w})`;

/**
 * Both climbs, on one layout. Throws with the offending platforms named, which
 * is what the last test in this file reads back.
 */
function provePlayable(platforms: PlatformDef[], length: number, where: string): void {
    const byTerrain = unreachable(platforms);
    assert.equal(byTerrain.length, 0,
        `${where}: ${byTerrain.length} unreachable platform(s) — ${byTerrain.map(show).join(' ')}`);
    const byClimb = climb(platforms, length);
    assert.equal(byClimb.length, 0,
        `${where}: ${byClimb.length} unreachable platform(s) with no room to jump from — ${byClimb.map(show).join(' ')}`);
}

const overlapsX = (a: PlatformDef, b: PlatformDef) => a.x < b.x + b.w && b.x < a.x + a.w;

console.log('\nevery platform can be stood on');

t('every section is fully climbable, by the game\'s own reachability check', () => {
    // The whole point of the module. A platform the player cannot reach is not
    // a decoration, it is a bug they experience as "the game is broken".
    forEachSection((ps, i, name) => {
        const bad = unreachable(ps);
        assert.equal(bad.length, 0, `${name}: ${bad.map(show).join(' ')}`);
    });
});

t('...and by a second climb that does not share its code', () => {
    forEachSection((ps, i, name) => {
        const bad = climb(ps, sectionLength(i));
        assert.equal(bad.length, 0, `${name}: nothing to jump from to reach ${bad.map(show).join(' ')}`);
    });
});

t('every rung is within one hop of something you can already stand on', () => {
    // Stated as a flat property rather than as a walk, so it fails even if both
    // climbs were wrong in the same way.
    forEachSection((ps, i, name) => {
        const stands = [{ y: FLOOR_Y, x0: -1e6, x1: 1e6 },
            ...ps.filter(isFooting).map(p => ({ y: p.y, x0: p.x, x1: p.x + p.w }))];
        for (const p of ps.filter(isFooting)) {
            const under = stands.filter(q => q.y > p.y && q.y - p.y <= MAX_STEP
                && q.x1 >= p.x - LUNGE && q.x0 <= p.x + p.w + LUNGE);
            assert.ok(under.length > 0,
                `${name}: ${show(p)} has nothing within ${MAX_STEP.toFixed(1)}px below it`);
        }
    });
});

t('no step ever asks for more than the jump is worth', () => {
    // Belt and braces on the number itself: the shortest rise to every rung.
    forEachSection((ps, i, name) => {
        for (const p of ps.filter(isFooting)) {
            const rises = [FLOOR_Y, ...ps.filter(isFooting).map(q => q.y)]
                .filter(y => y > p.y).map(y => y - p.y);
            const best = Math.min(...rises);
            assert.ok(best <= MAX_STEP, `${name}: ${show(p)} is a ${best}px step, budget is ${MAX_STEP.toFixed(1)}`);
        }
    });
});

t('the climb holds for every seed, not just the one in the screenshot', () => {
    for (const seed of SEEDS) {
        SECTIONS.forEach((s, i) => provePlayable(layoutFor(i, rngFor(seed)), s.length, `${s.name} @ ${seed}`));
    }
});

t('shooting the crates away never strands anybody', () => {
    // The soft lock a player finds by doing exactly what the game taught them.
    // Nothing DESTRUCTIBLE may be the only route to anything.
    for (const seed of ['wrecked-a', 'wrecked-b', 'wrecked-c', 'wrecked-d']) {
        SECTIONS.forEach((s, i) => {
            const standing = layoutFor(i, rngFor(seed)).filter(p => !has(p.flags, TILE.DESTRUCTIBLE));
            provePlayable(standing, s.length, `${s.name} after the shooting @ ${seed}`);
        });
    }
});

console.log('\ngeometry that stays inside the cabin');

t('nothing hangs off either end of a section', () => {
    forEachSection((ps, i, name) => {
        const len = sectionLength(i);
        assert.ok(len > 0, `${name} has no length`);
        for (const p of ps) {
            assert.ok(p.x >= 0, `${name}: ${show(p)} starts before the section does`);
            assert.ok(p.x + p.w <= len, `${name}: ${show(p)} runs past the end at ${len}`);
        }
    });
});

t('nothing is below the floor or off the top of the screen', () => {
    forEachSection((ps, i, name) => {
        for (const p of ps) {
            assert.ok(p.y < FLOOR_Y, `${name}: ${show(p)} is at or under the aisle`);
            assert.ok(p.y >= 0 && p.y < VIEW_H, `${name}: ${show(p)} is off screen`);
        }
    });
});

t('every platform is wide enough to be a thing', () => {
    forEachSection((ps, i, name) => {
        for (const p of ps) assert.ok(p.w > 0, `${name}: ${show(p)} has no width`);
    });
});

t('no two surfaces are stacked close enough to trap the player', () => {
    // Two footings sharing a stretch of aisle need a player's height between
    // them, or standing on the lower one puts your head inside the upper one.
    // The same PLAYER_H that terrain.ts's `blocksRunning` uses, so a gap this
    // file calls legal is one that module calls runnable.
    forEachSection((ps, i, name) => {
        const f = ps.filter(isFooting);
        for (let a = 0; a < f.length; a++) {
            for (let b = a + 1; b < f.length; b++) {
                if (!overlapsX(f[a], f[b])) continue;
                const gap = Math.abs(f[a].y - f[b].y);
                assert.ok(gap >= PLAYER_H,
                    `${name}: ${show(f[a])} and ${show(f[b])} overlap with only ${gap}px between them`);
            }
        }
    });
});

t('no platform is authored twice', () => {
    forEachSection((ps, i, name) => {
        const keys = ps.map(p => `${p.x}:${p.y}:${p.w}:${p.flags}`);
        assert.equal(new Set(keys).size, keys.length, `${name} has a duplicate platform`);
    });
});

console.log('\nfour places, not one place four times');

const tiersAbove = (ps: PlatformDef[]) =>
    new Set(ps.filter(isFooting).filter(p => p.y < FLOOR_Y).map(p => p.y));

t('every section has somewhere to be other than the floor', () => {
    forEachSection((ps, i, name) => {
        assert.ok(ps.length > 0, `${name} is an empty corridor again`);
        assert.ok(tiersAbove(ps).size >= 2, `${name} has ${tiersAbove(ps).size} height(s) above the aisle`);
    });
});

t('business class is the most vertical stretch in the game', () => {
    // The brief for that section. Three distinct heights is the floor of it;
    // it should also beat every other section, or it is not the vertical one.
    const counts = SECTIONS.map((_, i) => tiersAbove(layoutFor(i, rngFor('vert'))).size);
    const business = SECTIONS.findIndex(s => s.name === 'BUSINESS CLASS');
    assert.ok(business >= 0, 'business class has gone missing from content.ts');
    assert.ok(counts[business] >= 3, `business class has only ${counts[business]} heights above the aisle`);
    for (let i = 0; i < counts.length; i++) {
        if (i === business) continue;
        assert.ok(counts[business] > counts[i],
            `${SECTIONS[i].name} (${counts[i]}) is as vertical as business class (${counts[business]})`);
    }
});

t('economy teaches the full climb, floor to bins', () => {
    // The tutorial, and it has no text in it: the rungs have to be there or the
    // lesson is not taught. Four heights, ending on the overhead bins.
    const ps = layoutFor(0, rngFor('teach'));
    assert.ok(tiersAbove(ps).size >= 4, 'economy does not have a four-rung staircase in it');
    assert.ok(ps.some(p => p.y === BIN_FEET && isFooting(p)), 'economy never reaches the bins');
});

t('the boss arena is mostly open floor', () => {
    // A boss pattern you cannot see coming is not a pattern. Over half the
    // cockpit is bare, with one long clear run to fight in.
    const i = SECTIONS.findIndex(s => s.boss);
    const ps = layoutFor(i, rngFor('arena')).filter(isFooting);
    const len = sectionLength(i);
    const covered = ps.reduce((n, p) => n + p.w, 0);
    assert.ok(covered / len < 0.5, `${(covered / len * 100).toFixed(0)}% of the cockpit is furniture`);

    const edges = [...ps].sort((a, b) => a.x - b.x);
    let longest = 0, cursor = 0;
    for (const p of edges) { longest = Math.max(longest, p.x - cursor); cursor = Math.max(cursor, p.x + p.w); }
    longest = Math.max(longest, len - cursor);
    assert.ok(longest >= 80, `the widest clear run in the arena is ${longest}px`);
});

t('no two sections are the same level', () => {
    const shapes = SECTIONS.map((_, i) =>
        layoutFor(i, rngFor('distinct')).map(p => `${p.x},${p.y},${p.w}`).join('|'));
    assert.equal(new Set(shapes).size, shapes.length, 'two sections were authored identically');
});

console.log('\nthe flag vocabulary, actually used');

const everything = () => SECTIONS.flatMap((_, i) => layoutFor(i, rngFor('vocab')));

t('seats are jumped up through and counters are not', () => {
    const all = everything();
    assert.ok(all.some(p => has(p.flags, TILE.ONE_WAY)), 'nothing in the game is one-way');
    assert.ok(all.some(p => has(p.flags, TILE.SOLID) && !has(p.flags, TILE.ONE_WAY)), 'nothing is plain solid');
});

t('something in the level comes apart when you shoot it', () => {
    const all = everything();
    const breakable = all.filter(p => has(p.flags, TILE.DESTRUCTIBLE));
    assert.ok(breakable.length > 0, 'nothing in the cabin can be destroyed');
    for (const p of breakable) assert.ok(has(p.flags, TILE.SOLID), `${show(p)} is destructible but not solid`);
});

t('the galley belt drags, and it drags one way or the other', () => {
    const belts = everything().filter(p => conveyorDir(p.flags) !== 0);
    assert.ok(belts.length > 0, 'the service belt does not move');
    for (const p of belts) {
        assert.ok(has(p.flags, TILE.SOLID), 'a belt you fall through is just a joke about a belt');
        assert.notEqual(conveyorDir(p.flags), 0);
        assert.ok(!(has(p.flags, TILE.CONVEYOR_L) && has(p.flags, TILE.CONVEYOR_R)), 'a belt going both ways');
    }
});

t('somewhere is slippery and somewhere is fenced off', () => {
    const all = everything();
    assert.ok(all.some(p => has(p.flags, TILE.SLIPPERY)), 'nobody ever spilled anything');
    assert.ok(all.some(p => has(p.flags, TILE.ENEMY_WALL)), 'the chargers can still walk off the counters');
});

t('a fence stops enemies and nothing else, and is never a rung', () => {
    // If a fence counted as footing a level could "prove" a bin reachable by
    // standing on thin air, which is the exact soft lock this file exists for.
    for (const p of everything().filter(p => has(p.flags, TILE.ENEMY_WALL))) {
        assert.equal(has(p.flags, TILE.SOLID), false, `${show(p)} is an invisible wall the player walks into`);
        assert.equal(isFooting(p), false, `${show(p)} became a rung`);
    }
});

t('the cloth hung over the aisle holds nobody up', () => {
    const cloth = everything().filter(p => has(p.flags, TILE.OCCLUDES));
    assert.ok(cloth.length > 0, 'business class has nothing hanging in it');
    for (const p of cloth) assert.equal(isFooting(p), false, `${show(p)} is cloth you can stand on`);
});

console.log('\nthe level and the cast agree with each other');

t('every perched thrower has a bin under his feet', () => {
    // The bug that started all of this: perched throwers were placed at
    // BIN_FEET with gravity off, floating on collision that did not exist.
    SECTIONS.forEach((s, i) => {
        const bins = layoutFor(i, rngFor('perch')).filter(p => p.y === BIN_FEET && isFooting(p));
        for (const m of s.mooks.filter(m => m.perch)) {
            assert.ok(bins.some(p => m.x >= p.x && m.x <= p.x + p.w),
                `${s.name}: the thrower perched at x=${m.x} is standing on nothing`);
        }
    });
});

t('there is a builder for every section and no spare ones', () => {
    assert.equal(LAYOUTS.length, SECTIONS.length, 'the level and the section list have drifted apart');
    assert.deepEqual(layoutFor(SECTIONS.length, rngFor('oob')), [], 'an index off the end built something');
    assert.deepEqual(layoutFor(-1, rngFor('oob')), [], 'a negative index built something');
});

console.log('\nthe same seed builds the same cabin');

t('a seed reproduces the level exactly', () => {
    SECTIONS.forEach((_, i) => {
        assert.deepEqual(layoutFor(i, rngFor('same')), layoutFor(i, rngFor('same')));
    });
});

t('no seed can move a single piece of geometry', () => {
    // The rule the reachability sweep rests on: seeds dress the level, they do
    // not build it. If this ever fails, the sweep above stops being a proof.
    SECTIONS.forEach((_, i) => {
        const shape = (seed: string) => layoutFor(i, rngFor(seed)).map(p => `${p.x},${p.y},${p.w}`).join('|');
        const first = shape(SEEDS[0]);
        for (const seed of SEEDS) assert.equal(shape(seed), first, `${SECTIONS[i].name} moved on ${seed}`);
    });
});

t('the dressing does vary, so the seed is genuinely wired up', () => {
    const galley = SECTIONS.findIndex(s => s.name === 'THE GALLEY');
    const belts = new Set(SEEDS.map(s =>
        conveyorDir(layoutFor(galley, rngFor(s)).find(p => conveyorDir(p.flags) !== 0)!.flags)));
    assert.equal(belts.size, 2, 'the galley belt always drags the same way');

    const business = SECTIONS.findIndex(s => s.name === 'BUSINESS CLASS');
    const spills = new Set(SEEDS.map(s =>
        layoutFor(business, rngFor(s)).find(p => has(p.flags, TILE.SLIPPERY))!.x));
    assert.ok(spills.size >= 2, 'the same market table takes the hummus every time');

    const boss = SECTIONS.findIndex(s => s.boss);
    const bolted = new Set(SEEDS.map(s => layoutFor(boss, rngFor(s))
        .filter(p => p.y !== 111 && isFooting(p) && !has(p.flags, TILE.DESTRUCTIBLE)).map(p => p.x).join()));
    assert.ok(bolted.size >= 2, 'the same cockpit crate is bolted down every time');
});

t('exactly one of the two crates feeding the console is bolted down', () => {
    // Not dressing. If both were duty-free the boss could destroy his own
    // arena's high ground in phase two; if neither were, nothing breaks.
    const boss = SECTIONS.findIndex(s => s.boss);
    for (const seed of SEEDS.slice(0, 40)) {
        const ps = layoutFor(boss, rngFor(seed)).filter(isFooting);
        const console_ = ps.find(p => p.y === 111)!;
        const feeders = ps.filter(p => stepsUpTo({ y: p.y, x0: p.x, x1: p.x + p.w }, console_));
        assert.equal(feeders.length, 2, `the console has ${feeders.length} routes to it`);
        assert.equal(feeders.filter(p => !has(p.flags, TILE.DESTRUCTIBLE)).length, 1,
            `@ ${seed}: ${feeders.filter(p => !has(p.flags, TILE.DESTRUCTIBLE)).length} of the two crates are bolted`);
    }
});

console.log('\nchecking that the checks have teeth');

t('raising a platform out of reach is caught by both climbs', () => {
    // Guard the guard. If the reachability tests above could not fail there is
    // no reason to believe them, so break the level on purpose and watch.
    const i = SECTIONS.findIndex(s => s.name === 'BUSINESS CLASS');
    const good = layoutFor(i, rngFor('teeth'));
    const victim = good.findIndex(p => isFooting(p) && p.y === BIN_FEET);
    assert.ok(victim >= 0, 'business class has no bins to sabotage');

    const broken = good.map((p, n) => (n === victim ? { ...p, y: p.y - (Math.ceil(MAX_STEP) + 10) } : p));
    assert.equal(unreachable(broken).length, 1, 'terrain.ts called a platform 44px up reachable');
    assert.equal(climb(broken, sectionLength(i)).length, 1, 'the independent climb called it reachable');

    let said = '';
    try { provePlayable(broken, sectionLength(i), 'BUSINESS CLASS (sabotaged)'); }
    catch (e) { said = (e as Error).message.split('\n')[0]; }
    assert.ok(said.includes('unreachable'), `the failure said nothing useful: ${said || '(it passed)'}`);
    console.log('      it said: ' + said);

    // ...and the level is fine again the moment the platform goes back.
    provePlayable(good, sectionLength(i), 'BUSINESS CLASS');
});

t('a rung with no room to take off from is caught, even though terrain.ts allows it', () => {
    // The check the game's own module does not make: a ledge directly under
    // another ledge overlaps its span, so `unreachable()` is happy, but the
    // player jumps into its underside and lands back where they started.
    const ceiling: PlatformDef[] = [
        { x: 100, y: 137, w: 30, flags: TILE.SOLID },
        { x: 90, y: 111, w: 60, flags: TILE.SOLID },   // swallows the rung below it whole
    ];
    assert.deepEqual(unreachable(ceiling), [], 'terrain.ts has grown an opinion about headroom');
    assert.equal(climb(ceiling, 400).length, 1, 'the independent climb did not notice the ceiling');
});

t('a platform hanging off the end of a section would be caught', () => {
    const len = sectionLength(0);
    const stray: PlatformDef = { x: len - 4, y: 137, w: 40, flags: TILE.SOLID };
    assert.ok(stray.x + stray.w > len, 'the bounds check compares the wrong edge');
});

console.log(`\n${pass} layout checks passed.\n`);
