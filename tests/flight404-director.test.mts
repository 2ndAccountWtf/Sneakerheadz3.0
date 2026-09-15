/**
 * The director, and whether it is quietly undoing the cast.
 *
 * `tests/flight404-cast.test.mts` proves the six machines are honest in
 * isolation. That is the easy half. The half that actually breaks is the layer
 * above, because every one of the cast's rules survives only as long as the
 * thing driving it agrees to respect them — and the ways of not respecting them
 * all look like reasonable code.
 *
 * Subtract damage from `hp` directly and the Hypebeast still winds up, still
 * charges, still crashes, still plays the stun animation, and dodging him is
 * now worth nothing. Read `toPlayer` one more time during a charge and he never
 * misses again. Keep walking the Scalper forward while he photographs and the
 * two and a half seconds are free. None of those show up in a phase name, a
 * screenshot, or the cast tests; all three show up here.
 *
 * So these checks are aimed at the seams rather than at the behaviours: damage
 * routing, movement during a beat, direction during a commitment, and death
 * happening exactly once.
 */
import assert from 'node:assert/strict';
import {
    CAST, STUN_DAMAGE_MULT, HYPE_STUN, HYPE_CHARGE, RESELLER_ESCAPE, RESELLER_BAG, GRAB_RANGE,
    distracted,
    type CastState, type HypebeastState, type HypebeastPhase,
    type ScalperState, type ScalperPhase, type ResellerState, type ResellerPhase,
} from '../components/minigames/phaser/flight404/cast.ts';
import {
    openRoster, stepDirector, castBudget, ROSTER, CHARGE_MULT,
    type Member, type World, type Effect,
} from '../components/minigames/phaser/flight404/castDirector.ts';
import { CREEP_ORDER } from '../components/minigames/phaser/flight404/creep.ts';
import { FLOOR_Y } from '../components/minigames/phaser/flight404/content.ts';
import { rngFor } from '../utils/rng.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const DT = 1 / 60;

const world = (over: Partial<World> = {}): World => ({
    playerX: 0, playerY: FLOOR_Y, loot: [], legendaryDropped: false,
    damage: [], bumps: [], messy: false, ...over,
});

const member = (state: CastState, x: number, hp: number, id = 0): Member =>
    ({ id, state, x, y: FLOOR_Y, hp, facing: -1 });

/** Hand-built states, so a test can start a machine in the phase it is about. */
const hypebeast = (phase: HypebeastPhase, timer: number): HypebeastState =>
    ({ kind: 'hypebeast', phase, timer, cooldown: 99, crashes: 0 });
const scalper = (phase: ScalperPhase, timer: number): ScalperState =>
    ({ kind: 'scalper', phase, timer, cooldown: 99, refractory: 99, greed: 99, photos: 0 });
const reseller = (phase: ResellerPhase = 'seek', timer = 0, held = 0): ResellerState =>
    ({ kind: 'reseller', phase, timer, held, escape: RESELLER_ESCAPE });

console.log('\ndamage, and where it is allowed to be applied');

t('a stunned hypebeast takes exactly double and a standing one exactly normal', () => {
    // The single most deletable rule in the file: `incomingDamage` is the only
    // reason the dodge window is worth using, and a director that reaches for
    // `hp` directly leaves every animation intact while removing the payoff.
    const rng = rngFor('director-stun');
    const down = stepDirector(
        [member(hypebeast('stunned', HYPE_STUN), 400, CAST.hypebeast.hp)],
        DT, world({ damage: [{ id: 0, amount: 10 }] }), rng,
    );
    assert.equal(
        down.members[0].hp, CAST.hypebeast.hp - 10 * STUN_DAMAGE_MULT,
        'the stun multiplier never reached his health bar',
    );

    const up = stepDirector(
        [member(hypebeast('stalk', 0), 400, CAST.hypebeast.hp)],
        DT, world({ damage: [{ id: 0, amount: 10 }] }), rng,
    );
    assert.equal(up.members[0].hp, CAST.hypebeast.hp - 10, 'he is taking bonus damage standing up');
});

t('several hits in one frame are one wound, not several', () => {
    const rng = rngFor('director-salvo');
    const r = stepDirector(
        [member(hypebeast('stunned', HYPE_STUN), 400, 100)],
        DT, world({ damage: [{ id: 0, amount: 3 }, { id: 0, amount: 4 }] }), rng,
    );
    assert.equal(r.members[0].hp, 100 - 7 * STUN_DAMAGE_MULT, 'a shotgun spread got the multiplier applied twice');
});

t('died fires exactly once however much overkill arrives at once', () => {
    // Three simultaneous hits from one burst is the ordinary case, not an edge
    // one, and two `died` effects means two drops on the floor.
    const rng = rngFor('director-overkill');
    const r = stepDirector(
        [member(scalper('approach', 0), 100, CAST.scalper.hp)],
        DT, world({ damage: [{ id: 0, amount: 999 }, { id: 0, amount: 999 }, { id: 0, amount: 999 }] }), rng,
    );
    const deaths = r.effects.filter((e) => e.kind === 'died');
    assert.equal(deaths.length, 1, `he died ${deaths.length} times`);
    assert.equal(deaths[0].drop, CAST.scalper.drop);
    assert.equal(r.members.length, 0, 'a corpse is still on the roster');

    const after = stepDirector(r.members, DT, world({ damage: [{ id: 0, amount: 999 }] }), rng);
    assert.deepEqual(after.effects, [], 'shooting the empty floor killed him again');
});

console.log('\nmovement, and what the comedy beats cost');

t('a distracted member does not advance, and the same one un-distracted does', () => {
    // If the beat does not cost ground it is an animation over an enemy who is
    // still closing, and the window the player was given is not a window.
    const rng = rngFor('director-move');
    const posing = member(scalper('photo', 2), 0, CAST.scalper.hp);
    assert.equal(distracted(posing.state), true);
    const held = stepDirector([posing], DT, world({ playerX: 400 }), rng);
    assert.equal(held.members[0].x, 0, 'he photographed and closed the distance at the same time');

    const working = member(scalper('approach', 0), 0, CAST.scalper.hp);
    assert.equal(distracted(working.state), false);
    const walked = stepDirector([working], DT, world({ playerX: 400 }), rng);
    assert.ok(walked.members[0].x > 0, 'he is not distracted and not moving either');
    assert.equal(walked.members[0].facing, 1, 'he is walking backwards');
});

t('nobody produces an attack out of the middle of their own beat', () => {
    const rng = rngFor('director-beat');
    let members = openRoster('bedlam', 900, rng);
    for (let i = 0; i < 60 * 300; i++) {
        const r = stepDirector(members, DT, world({
            playerX: 450, loot: [{ x: 450, y: FLOOR_Y }],
            legendaryDropped: rng() < 0.01, messy: rng() < 0.01,
            bumps: rng() < 0.01 ? [members[Math.floor(rng() * members.length)]?.id ?? -1] : [],
        }), rng);
        for (const e of r.effects) {
            if (e.kind !== 'hurtPlayer' && e.kind !== 'throw') continue;
            const who = r.members.find((m) => m.id === e.from);
            if (who) assert.equal(distracted(who.state), false, `id ${e.from} attacked from inside its own beat`);
        }
        members = r.members;
    }
});

t('the reseller crosses the room for the loot, and stops dead to pick it up', () => {
    // He is the only enemy who does not want the player, and the only one who
    // can cost you something permanently. Both halves of that are movement
    // rules: he has to be able to reach the loot at all, and the moment he
    // stoops for it he has to stand still long enough to be shot.
    //
    // This test replaced one that asserted he moves *while distracted*, back
    // when `distracted` meant "never a threat to your health" for him and
    // freezing on that flag would have deleted him from the game. `distracted`
    // now means "in a beat", so the workaround is gone and the honest rule is
    // the one pinned here.
    const rng = rngFor('director-thief-moves');
    assert.equal(distracted(reseller()), false, 'a thief looking for loot is not mid-beat');

    let members = [member(reseller(), 0, CAST.reseller.hp)];
    for (let i = 0; i < 30; i++) {
        members = stepDirector(members, DT, world({ playerX: 900, loot: [{ x: 600, y: FLOOR_Y }] }), rng).members;
    }
    assert.ok(members[0].x > 0, 'the fastest thing in the level is a statue');

    // And the stoop costs him ground, exactly like everybody else's bit.
    let bagging = [member(reseller('bag', RESELLER_BAG), 0, CAST.reseller.hp)];
    assert.equal(distracted(bagging[0].state), true, 'the stoop is a beat');
    const startedAt = bagging[0].x;
    for (let i = 0; i < 20; i++) {
        bagging = stepDirector(bagging, DT, world({ playerX: 900, loot: [{ x: 600, y: FLOOR_Y }] }), rng).members;
    }
    assert.equal(bagging[0].x, startedAt,
        'he bagged a pair without breaking stride, which makes him uncatchable');
});

console.log('\nthe charge, which is a commitment');

t('a charging hypebeast holds his line while the player runs the other way', () => {
    // The entire enemy is "he cannot turn". One extra look at `toPlayer` in the
    // movement code and he never misses, never crashes, and is never the free
    // target that makes dodging him worth doing.
    const rng = rngFor('director-charge');
    let members = [member(hypebeast('wind', DT / 2), 0, CAST.hypebeast.hp)];
    let r = stepDirector(members, DT, world({ playerX: 400 }), rng);
    members = r.members;
    assert.equal(members[0].state.kind === 'hypebeast' && members[0].state.phase, 'charge', 'he never committed');
    assert.equal(members[0].facing, 1, 'he committed in the wrong direction');

    let x = members[0].x;
    for (let i = 0; i < Math.round(HYPE_CHARGE / DT) - 2; i++) {
        r = stepDirector(members, DT, world({ playerX: -5000 }), rng);   // the player is now behind him
        members = r.members;
        assert.ok(members[0].x > x, `he turned around ${(i * DT).toFixed(2)}s into a committed charge`);
        assert.equal(members[0].facing, 1, 'he is facing the way he changed his mind');
        x = members[0].x;
    }
});

t('the charge actually covers ground', () => {
    // A commitment he can be strolled away from is not a commitment.
    const rng = rngFor('director-charge-speed');
    const first = stepDirector([member(hypebeast('wind', DT / 2), 0, CAST.hypebeast.hp)], DT, world({ playerX: 400 }), rng);
    const second = stepDirector(first.members, DT, world({ playerX: 400 }), rng);
    const travelled = second.members[0].x - first.members[0].x;
    assert.ok(
        Math.abs(travelled - CAST.hypebeast.speed * CHARGE_MULT * DT) < 1e-9,
        `he charged at ${(travelled / DT).toFixed(1)}px/s`,
    );
});

console.log('\nthe reseller, whose theft is final');

t('ignored long enough, the loot is gone and stays gone', () => {
    const rng = rngFor('director-steal');
    let members = [member(reseller(), 0, CAST.reseller.hp)];
    let loot = [{ x: 0, y: FLOOR_Y }];
    let stolenCount = 0;
    for (let i = 0; i < Math.round((RESELLER_ESCAPE + 4) / DT); i++) {
        const r = stepDirector(members, DT, world({ playerX: 900, loot }), rng);
        for (const e of r.effects) {
            if (e.kind === 'takeLoot') loot = loot.filter((_, idx) => idx !== e.lootIndex);
            if (e.kind === 'stolen') stolenCount += e.count;
        }
        members = r.members;
    }
    assert.ok(stolenCount > 0, 'the thief never left with anything');
    assert.equal(loot.length, 0, 'the pair he walked off with is still on the floor');

    // Shooting the place he was standing does not undo it — and neither does
    // killing him there, which is the one that nearly got through: `held` stays
    // on a departed reseller as a record, and a death handler that empties the
    // backpack onto the floor hands the player back what he left with.
    const ghostX = members[0].x;
    for (let i = 0; i < 600; i++) {
        const r = stepDirector(members, DT, world({
            playerX: 900, loot: [{ x: ghostX, y: FLOOR_Y }], damage: [{ id: 0, amount: 1 }],
        }), rng);
        for (const e of r.effects) {
            assert.notEqual(e.kind, 'stolen', 'he stole the same bag twice');
            assert.notEqual(e.kind, 'dropLoot', 'the loot came back after he had left with it');
        }
        members = r.members;
    }
    assert.equal(members.length, 0, 'six hundred frames of gunfire and he is still standing there');
});

t('shot before he leaves, the bag goes back on the floor', () => {
    const rng = rngFor('director-shot');
    let members = [member(reseller(), 0, CAST.reseller.hp)];
    let loot = [{ x: 0, y: FLOOR_Y }];
    let dropped = 0;
    for (let i = 0; i < Math.round((RESELLER_ESCAPE - 1) / DT); i++) {
        const r = stepDirector(members, DT, world({ playerX: 900, loot }), rng);
        for (const e of r.effects) if (e.kind === 'takeLoot') loot = loot.filter((_, idx) => idx !== e.lootIndex);
        members = r.members;
    }
    const hit = stepDirector(members, DT, world({ playerX: 900, loot, damage: [{ id: 0, amount: 1 }] }), rng);
    for (const e of hit.effects) if (e.kind === 'dropLoot') dropped += e.count;
    assert.ok(dropped > 0, 'a bullet did not shake the bag loose');
});

console.log('\nthe falafel guy, who is not involved');

t('the caterer never once reaches the player health bar', () => {
    // Structural rather than incidental: he is `hostile: false`, and the only
    // route from a machine to the player's health is gated on that flag.
    const rng = rngFor('director-falafel');
    let members = [member({ kind: 'falafelGuy', phase: 'serve', timer: 0, spills: 0 }, 0, CAST.falafelGuy.hp)];
    let revived = 0;
    for (let i = 0; i < 60 * 600; i++) {
        const r = stepDirector(members, DT, world({
            playerX: rng() * 8 - 4,               // standing on him, on both sides, all run
            loot: rng() < 0.5 ? [{ x: 0, y: FLOOR_Y }] : [],
            legendaryDropped: rng() < 0.01,
            messy: rng() < 0.02,
            bumps: rng() < 0.02 ? [0] : [],
            damage: rng() < 0.002 ? [{ id: 0, amount: 30 }] : [],
            donkey: rng() < 0.05,
        }), rng);
        for (const e of r.effects) {
            assert.notEqual(e.kind, 'hurtPlayer', 'the caterer hurt somebody');
            assert.notEqual(e.kind, 'throw', 'the caterer threw a mannequin');
        }
        members = r.members;
        if (members.length === 0) {
            members = [member({ kind: 'falafelGuy', phase: 'serve', timer: 0, spills: 0 }, 0, CAST.falafelGuy.hp)];
            revived++;
        }
    }
    assert.ok(revived > 0, 'he was never actually shot, so the run proved less than it looks');
});

console.log('\nthe roster, and the cabin it is standing in');

t('the cast gets denser as the plane stops being a plane', () => {
    const rng = rngFor('director-density');
    for (let i = 1; i < CREEP_ORDER.length; i++) {
        const before = openRoster(CREEP_ORDER[i - 1], 1000, rng).length;
        const after = openRoster(CREEP_ORDER[i], 1000, rng).length;
        assert.ok(after > before, `${CREEP_ORDER[i]} (${after}) is no busier than ${CREEP_ORDER[i - 1]} (${before})`);
        assert.equal(after, castBudget(CREEP_ORDER[i], 1000));
    }
});

t('and weirder — the odd ones do not turn up in Economy', () => {
    // A falafel stand in row 32 spends the escalation before it is set up, the
    // same mistake `CREEP.admits` exists to prevent one layer down.
    assert.equal(ROSTER.plane.includes('falafelGuy'), false, 'there is a falafel stand on a normal aircraft');
    assert.equal(ROSTER.plane.includes('hypebeast'), false);
    assert.equal(new Set(ROSTER.shuk).size, 6, 'the shuk is missing somebody');
    assert.equal(new Set(ROSTER.bedlam).size, 6);
});

t('a roster stands on the floor, inside its own section', () => {
    const rng = rngFor('director-placement');
    for (const c of CREEP_ORDER) {
        const roster = openRoster(c, 820, rng);
        const ids = roster.map((m) => m.id);
        assert.equal(new Set(ids).size, ids.length, `${c} issued the same id twice`);
        for (const m of roster) {
            assert.ok(m.x >= 0 && m.x <= 820, `${c} put somebody at x=${m.x}`);
            assert.equal(m.y, FLOOR_Y);
            assert.equal(m.hp, CAST[m.state.kind].hp);
        }
    }
});

console.log('\nten minutes in a bad neighbourhood');

/**
 * The whole floor at once, for ten simulated minutes. The world is generated
 * from its own seeded stream so that two runs of the same seed are genuinely
 * the same fight — the point of the replay check is that a bug reported as
 * "he walked through the wall at about four minutes" can be reproduced rather
 * than described.
 */
const siege = (seed: string) => {
    const rng = rngFor(seed);
    const stage = rngFor(seed + '-world');
    let members = openRoster('bedlam', 1000, rng);
    const effects: Effect[] = [];
    const died = new Set<number>();
    let loot = [{ x: 300, y: FLOOR_Y }];

    for (let i = 0; i < 60 * 600; i++) {
        const live = members.map((m) => m.id);
        const target = live.length > 0 ? live[Math.floor(stage() * live.length)] : -1;
        const w = world({
            playerX: 500 + Math.sin(i * 0.01) * 480,
            loot,
            legendaryDropped: stage() < 0.004,
            messy: stage() < 0.01,
            bumps: stage() < 0.01 && target >= 0 ? [target] : [],
            damage: target >= 0 && stage() < 0.02
                ? [{ id: target, amount: stage() < 0.005 ? 999 : 1 }]
                : [],
            donkey: stage() < 0.05,
        });
        const r = stepDirector(members, DT, w, rng);

        for (const e of r.effects) {
            if (e.kind === 'died') {
                assert.equal(died.has(e.from), false, `id ${e.from} died twice, at ${(i * DT).toFixed(1)}s`);
                died.add(e.from);
            }
            if (e.kind === 'takeLoot') loot = loot.filter((_, idx) => idx !== e.lootIndex);
            if (e.kind === 'dropLoot') for (let k = 0; k < e.count; k++) loot.push({ x: e.x, y: e.y });
        }
        effects.push(...r.effects);
        members = r.members;

        for (const m of members) {
            assert.ok(Number.isFinite(m.x), `id ${m.id} reached x=${m.x} at ${(i * DT).toFixed(1)}s`);
            assert.ok(Number.isFinite(m.y), `id ${m.id} reached y=${m.y}`);
            assert.ok(Number.isFinite(m.hp), `id ${m.id} has ${m.hp} health`);
            assert.ok(m.hp > 0, `id ${m.id} is on the roster with ${m.hp} health`);
            assert.equal(died.has(m.id), false, `id ${m.id} came back from the dead`);
        }
        if (stage() < 0.004) loot.push({ x: 500 + stage() * 400, y: FLOOR_Y });
        if (loot.length > 12) loot = loot.slice(-12);
    }
    return { members, effects, deaths: died.size };
};

t('a full roster survives ten minutes without producing a number that is not one', () => {
    const run = siege('director-siege');
    assert.ok(run.deaths > 0, 'nobody was ever actually killed, so the removal path went untested');
    assert.ok(run.effects.length > 200, `${run.effects.length} effects in ten minutes — the floor is asleep`);
});

t('the same seed plays out exactly the same way twice', () => {
    const a = siege('director-replay');
    const b = siege('director-replay');
    assert.deepEqual(a.members, b.members, 'the floor drifted between two identical runs');
    assert.deepEqual(a.effects, b.effects);
});

t('a donkey walking past the whole fight changes nothing at all', () => {
    // Same discipline as the guard's own test one layer down: the joke is that
    // nobody acknowledges it, so nothing may be able to. Passing it through and
    // then reading it here would be the same bug wearing a different hat.
    const ra = rngFor('director-donkey');
    const rb = rngFor('director-donkey');
    let without = openRoster('bedlam', 900, ra);
    let with_ = openRoster('bedlam', 900, rb);
    for (let i = 0; i < 60 * 120; i++) {
        const base = { playerX: 450, loot: [{ x: 450, y: FLOOR_Y }], messy: i % 300 === 0 };
        const p = stepDirector(without, DT, world(base), ra);
        const q = stepDirector(with_, DT, world({ ...base, donkey: true }), rb);
        assert.deepEqual(q.members, p.members, `somebody noticed the donkey at ${(i * DT).toFixed(1)}s`);
        assert.deepEqual(q.effects, p.effects);
        without = p.members;
        with_ = q.members;
    }
});

t('a pair on the floor is only ever handed to one person', () => {
    // Two machines can both decide to stoop on the same frame; the scene must
    // not be told to remove the same index twice, because the second removal
    // takes somebody else's loot with it.
    const rng = rngFor('director-claim');
    const crowd: Member[] = [0, 1, 2].map((id) => member(scalper('grab', DT / 2), 0, CAST.scalper.hp, id));
    const r = stepDirector(crowd, DT, world({ playerX: 900, loot: [{ x: GRAB_RANGE / 2, y: FLOOR_Y }] }), rng);
    const taken = r.effects.filter((e) => e.kind === 'takeLoot');
    assert.equal(taken.length, 1, `${taken.length} people picked up the same pair`);
});

console.log(`\n${pass} director checks passed.\n`);
