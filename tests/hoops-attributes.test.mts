/**
 * The roster has to be playable at both ends.
 *
 * `systems/hoops/roster.ts` authors characters as extremes on purpose — Big
 * Mike has 0.12 speed, Yasser has 0.05 range, Grandma Laces spends 4.30 of a
 * 4.55 budget on four near-maximum numbers. Extremes are the point, and
 * extremes are also exactly how a roster breaks: one number low enough and a
 * player cannot participate, one number high enough and a matchup cannot be
 * won. The `derive()` layer exists to make both impossible, and these checks
 * are what hold it to that.
 *
 * They deliberately test the translation layer rather than the numbers. The
 * attribute values are a design argument and they will move. The guarantee
 * that no design argument can produce an unplayable body is not up for
 * negotiation, so it gets assertions.
 */
import assert from 'node:assert/strict';
import {
    ROSTER, BASELINE, derive, partnerFor, profileFor, spread, total,
    playerProfile, mateProfile,
    MODIFIER_FLOOR, MODIFIER_CEILING,
    type Attributes, type Modifiers,
} from '../systems/hoops/roster.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const mods = (m: Modifiers): [string, number][] =>
    Object.entries(m).filter(([k]) => k !== 'dunkBias');

console.log('\nhoops roster — derived modifiers');

t('an unremarkable player is exactly the tuned baseline', () => {
    const m = derive(BASELINE);
    for (const [k, v] of mods(m)) {
        assert.ok(Math.abs(v - 1) < 0.001, `${k} should be 1.0 at baseline, got ${v}`);
    }
});

t('no profile on the roster produces an out-of-range modifier', () => {
    for (const [id, p] of Object.entries(ROSTER)) {
        for (const [k, v] of mods(derive(p.attributes))) {
            assert.ok(v >= MODIFIER_FLOOR, `${id}.${k} = ${v} is below the floor`);
            assert.ok(v <= MODIFIER_CEILING, `${id}.${k} = ${v} is above the ceiling`);
        }
    }
});

t('even a 0.0 in every attribute leaves a body that can play', () => {
    const zero: Attributes = {
        speed: 0, jump: 0, dunk: 0, range: 0, handles: 0, defense: 0, stamina: 0,
    };
    for (const [k, v] of mods(derive(zero))) {
        assert.ok(v >= MODIFIER_FLOOR, `${k} = ${v} bottoms out below the floor`);
    }
});

t('a 1.0 in every attribute is still beatable', () => {
    const maxed: Attributes = {
        speed: 1, jump: 1, dunk: 1, range: 1, handles: 1, defense: 1, stamina: 1,
    };
    for (const [k, v] of mods(derive(maxed))) {
        assert.ok(v <= MODIFIER_CEILING, `${k} = ${v} tops out above the ceiling`);
    }
});

t('out-of-range attributes are clamped, not extrapolated', () => {
    const wild = { ...BASELINE, speed: 9, range: -4 } as Attributes;
    const m = derive(wild);
    assert.equal(m.speedMult, derive({ ...BASELINE, speed: 1 }).speedMult);
    assert.equal(m.deepMult, derive({ ...BASELINE, range: 0 }).deepMult);
});

t('Big Mike is slow enough to notice and fast enough to matter', () => {
    const m = derive(ROSTER['big-mike'].attributes);
    // The worry this check exists for: 0.12 speed making 2-on-2 a 1-on-2 game.
    // 284px of court at 76px/s baseline — he has to cross it inside a shot clock.
    const crossing = 284 / (76 * m.speedMult);
    assert.ok(crossing < 6, `Big Mike takes ${crossing.toFixed(1)}s to cross the court`);
    assert.ok(m.speedMult < 0.9, 'Big Mike should be visibly the slowest man out there');
});

t('Big Mike dunks from further out than anybody else', () => {
    const his = derive(ROSTER['big-mike'].attributes).dunkRangeMult;
    for (const [id, p] of Object.entries(ROSTER)) {
        if (id === 'big-mike') continue;
        assert.ok(derive(p.attributes).dunkRangeMult <= his, `${id} out-dunks Big Mike`);
    }
});

t('Grandma buys her defence as a multiplier, not a guarantee', () => {
    const m = derive(ROSTER['grandma-laces'].attributes);
    assert.ok(m.stealMult <= MODIFIER_CEILING);
    // Her paid-for weakness has to be real: she cannot get off the floor and
    // she cannot keep up, which is the whole reason 0.95 defence is legal.
    assert.ok(m.jumpMult < 0.86, 'Grandma should not be a shot-contest threat');
    assert.ok(m.speedMult < 1.0, 'Grandma should be beatable off the dribble');
});

t('the shooters out-shoot the non-shooters by a felt margin', () => {
    const granny = derive(ROSTER['grandma-laces'].attributes).deepMult;
    const yasser = derive(ROSTER['yasser-abbasfat'].attributes).deepMult;
    assert.ok(granny / yasser > 2, `only a ${(granny / yasser).toFixed(2)}x shooting gap`);
});

console.log('\nhoops roster — the cousin');

t('the cousin is a weaker player than the foe he came with', () => {
    for (const p of Object.values(ROSTER)) {
        const c = partnerFor(p);
        assert.ok(total(c.attributes) < total(p.attributes), `${p.npcId}'s cousin is not weaker`);
    }
});

t('every cousin attribute is a legal 0..1', () => {
    for (const p of Object.values(ROSTER)) {
        const c = partnerFor(p);
        for (const [k, v] of Object.entries(c.attributes)) {
            assert.ok(v >= 0 && v <= 1, `${c.npcId}.${k} = ${v} is out of range`);
        }
    }
});

t('the cousin covers the hole the foe leaves', () => {
    // Grandma cannot jump or dunk; her cousin has to be the one who can.
    const granny = ROSTER['grandma-laces'];
    const c = partnerFor(granny);
    assert.ok(c.attributes.dunk > granny.attributes.dunk, 'nobody on that team can finish');
    assert.ok(c.attributes.jump > granny.attributes.jump, 'nobody on that team can rebound');
    // The Game cannot shoot; his cousin has to be able to.
    const game = ROSTER['the-game'];
    assert.ok(partnerFor(game).attributes.range > game.attributes.range, 'neither of them can shoot');
});

t('the cousin gives up what the foe was best at', () => {
    const sid = ROSTER['scalper-sid'];           // range 0.95, his whole game
    assert.ok(partnerFor(sid).attributes.range < sid.attributes.range);
    const mike = ROSTER['big-mike'];             // dunk 0.95, his whole job
    assert.ok(partnerFor(mike).attributes.dunk < mike.attributes.dunk);
});

t('two different foes bring two different cousins', () => {
    const a = partnerFor(ROSTER['grandma-laces']).attributes;
    const b = partnerFor(ROSTER['yasser-abbasfat']).attributes;
    const spreadOf = Object.keys(a).reduce(
        (s, k) => s + Math.abs(a[k as keyof Attributes] - b[k as keyof Attributes]), 0);
    assert.ok(spreadOf > 0.5, `the two cousins differ by only ${spreadOf.toFixed(2)} total`);
});

t('partnerFor is pure — same foe, same cousin', () => {
    const a = partnerFor(ROSTER.adc);
    const b = partnerFor(ROSTER.adc);
    assert.deepEqual(a, b);
});

t('a generic foe still gets a usable cousin', () => {
    const c = partnerFor(profileFor(undefined, 0.3));
    for (const [k, v] of mods(derive(c.attributes))) {
        assert.ok(v >= MODIFIER_FLOOR && v <= MODIFIER_CEILING, `${k} = ${v}`);
    }
});

console.log('\nhoops roster — the four bodies on the floor');

t('all four players in a match have a real profile', () => {
    const foe = profileFor('grandma-laces', 0.8);
    const four = [playerProfile(), mateProfile(), foe, partnerFor(foe)];
    assert.equal(new Set(four.map(p => p.npcId)).size, 4, 'two players share an id');
    for (const p of four) {
        assert.ok(p.name.length > 0);
        assert.ok(total(p.attributes) > 1, `${p.npcId} is a blank body`);
    }
});

t('a flat skill spread still lands inside the modifier range', () => {
    for (const skill of [0, 0.25, 0.5, 0.75, 1]) {
        for (const [k, v] of mods(derive(spread(skill)))) {
            assert.ok(v >= MODIFIER_FLOOR && v <= MODIFIER_CEILING, `skill ${skill}: ${k} = ${v}`);
        }
    }
});

console.log(`\n${pass} checks passed\n`);
