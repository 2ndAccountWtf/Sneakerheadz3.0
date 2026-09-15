/**
 * The cast, and whether the jokes are actually load-bearing.
 *
 * Every enemy in `cast.ts` is sold on a comedy beat, and a comedy beat is only
 * a mechanic if it *costs* something. So these checks are mostly one question
 * asked six ways: during the funny bit, is the enemy genuinely out of the
 * fight? A Scalper who photographs a drop and keeps throwing boxes, a guard who
 * radios Control while still swinging, a Shop Owner who tidies and attacks at
 * the same time — each of those is the joke reduced to an animation, and each
 * of them would pass a test that only looked at the phase name.
 *
 * The other half is the Reseller, who is the only enemy that can take something
 * off the player permanently. A theft timer that is even slightly wrong is a
 * player losing a legendary drop to a bug, so the rule is pinned from both
 * ends: ignored, it goes; shot, it does not.
 */
import assert from 'node:assert/strict';
import {
    CAST, STOCK, GRAB_RANGE, CONTACT_RANGE, STUN_DAMAGE_MULT,
    SCALPER_PHOTO, SCALPER_REFRACTORY, HYPE_STUN, RESELLER_ESCAPE, SECURITY_RADIO,
    OWNER_TIDY, FALAFEL_SPILL, FALAFEL_RECOVER, SCALPER_GREED, OWNER_TIDY_REFRACTORY,
    SCALPER_BARKS, SCALPER_PHOTO_BARKS, HYPEBEAST_BARKS, HYPEBEAST_STUN_BARKS,
    RESELLER_BARKS, RESELLER_STEAL_BARKS, SECURITY_RADIO_LINES, OWNER_BARKS,
    OWNER_TIDY_BARKS, FALAFEL_BARKS,
    openScalper, stepScalper, openHypebeast, stepHypebeast, isVulnerable, incomingDamage,
    openReseller, stepReseller, stolen, openSecurity, stepSecurity,
    openOwner, stepOwner, openFalafelGuy, stepFalafelGuy,
    openCast, stepCast, distracted,
    type CastKind, type CastCtx, type CastAction, type CastState,
} from '../components/minigames/phaser/flight404/cast.ts';
import { rngFor } from '../utils/rng.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const DT = 1 / 60;
const KINDS: CastKind[] = ['scalper', 'hypebeast', 'reseller', 'security', 'shopOwner', 'falafelGuy'];
const near = (dist = 40): CastCtx => ({ dist });

console.log('\nwho they are');

t('every kind has a definition, and its own numbers', () => {
    for (const k of KINDS) {
        assert.equal(CAST[k].kind, k, `${k} is filed under the wrong key`);
        assert.ok(CAST[k].hp > 0, `${k} is born dead`);
    }
    const hps = KINDS.map((k) => CAST[k].hp);
    assert.ok(new Set(hps).size > 4, 'six enemies sharing three health bars is one enemy with three health bars');
});

t('an enemy that attacks has something to attack with', () => {
    for (const k of KINDS) {
        const d = CAST[k];
        if (!d.hostile) continue;
        assert.ok(d.range > 0, `${k} is hostile from zero range`);
        assert.ok(d.cooldown > 0, `${k} attacks every frame`);
        assert.ok(d.contact > 0, `${k} is hostile and harmless`);
    }
});

t('the two who do not fight cannot hurt you by standing there', () => {
    // The Reseller's threat is economic and the Falafel Guy has no side.
    // Contact damage would quietly turn either of them back into a mook.
    assert.equal(CAST.reseller.hostile, false);
    assert.equal(CAST.reseller.contact, 0);
    assert.equal(CAST.falafelGuy.hostile, false);
    assert.equal(CAST.falafelGuy.contact, 0);
});

t('the falafel guy is the only one who is not a target at all', () => {
    assert.equal(CAST.falafelGuy.enemy, false, 'the neutral man became shootable');
    for (const k of KINDS) {
        if (k !== 'falafelGuy') assert.equal(CAST[k].enemy, true, `${k} is not an enemy`);
    }
});

t('the reseller is the fastest thing on the street', () => {
    // A thief you can casually walk down is just a slow enemy, and the panic of
    // watching him leave is the whole mechanic.
    for (const k of KINDS) {
        if (k === 'reseller') continue;
        assert.ok(CAST.reseller.speed > CAST[k].speed, `the ${k} outruns the reseller`);
    }
});

t('everybody is shouting', () => {
    const lists = [
        SCALPER_BARKS, SCALPER_PHOTO_BARKS, HYPEBEAST_BARKS, HYPEBEAST_STUN_BARKS,
        RESELLER_BARKS, RESELLER_STEAL_BARKS, SECURITY_RADIO_LINES, OWNER_BARKS,
        OWNER_TIDY_BARKS, FALAFEL_BARKS,
    ];
    for (const list of lists) {
        assert.ok(list.length >= 2, 'one line is not a voice');
        for (const line of list) {
            assert.equal(line, line.toUpperCase(), `"${line}" is using its indoor voice`);
        }
    }
});

console.log('\nthe scalper, who cannot help himself');

t('a photographing scalper is genuinely not attacking', () => {
    // The whole enemy. If he can shoot through the beat, the beat is a sticker.
    const rng = rngFor('scalper-photo');
    let s = openScalper(rng);
    let r = stepScalper(s, DT, { dist: 40, legendary: true }, rng);
    s = r.state;
    assert.equal(r.action?.type, 'photograph', 'a legendary hit the floor and he kept fighting');
    assert.equal(s.phase, 'photo');

    for (let i = 0; i < Math.round(SCALPER_PHOTO / DT) - 2; i++) {
        r = stepScalper(s, DT, near(), rng);
        s = r.state;
        assert.equal(r.action, null, `he acted on frame ${i} of his own photo shoot`);
        assert.equal(distracted(s), true, 'he is posing and dangerous at the same time');
    }
});

t('the photo ends, and he remembers he was attacking', () => {
    const rng = rngFor('scalper-remembers');
    let s = openScalper(rng);
    s = stepScalper(s, DT, { dist: 40, legendary: true }, rng).state;
    let threw = false;
    for (let i = 0; i < 60 * 12 && !threw; i++) {
        const r = stepScalper(s, DT, near(), rng);
        s = r.state;
        if (r.action?.type === 'throw') threw = true;
    }
    assert.ok(threw, 'he never went back to work');
    assert.equal(s.photos, 1);
});

t('he only falls for the same pair once', () => {
    // Without the refractory he re-enters the photo every frame the drop is on
    // screen and never fights anybody again — a joke that eats the encounter.
    const rng = rngFor('scalper-refractory');
    let s = openScalper(rng);
    let photos = 0;
    let threw = 0;
    const seconds = SCALPER_REFRACTORY * 2;
    for (let i = 0; i < Math.round(seconds / DT); i++) {
        const r = stepScalper(s, DT, { dist: 40, legendary: true }, rng);  // the drop never leaves
        s = r.state;
        if (r.action?.type === 'photograph') photos++;
        if (r.action?.type === 'throw') threw++;
    }
    assert.ok(photos <= 2, `he took ${photos} photographs of the same shoe in ${seconds}s`);
    assert.ok(threw > 0, 'he spent the entire encounter on his phone');
});

t('he stops to pick up a power-up that is lying there', () => {
    const rng = rngFor('scalper-grab');
    let s = openScalper(rng);
    let grabbed = false;
    for (let i = 0; i < 60 * 3 && !grabbed; i++) {
        const r = stepScalper(s, DT, { dist: 200, loot: 1, lootDist: GRAB_RANGE - 1 }, rng);
        s = r.state;
        if (r.action?.type === 'grab') grabbed = true;
    }
    assert.ok(grabbed, 'he walked over a free pickup');
});

console.log('\nthe hypebeast, who cannot stop');

/** Runs a hypebeast until he commits to a charge. */
const untilCharging = (rng: () => number) => {
    let s = openHypebeast(rng);
    for (let i = 0; i < 60 * 10; i++) {
        s = stepHypebeast(s, DT, near(30), rng).state;
        if (s.phase === 'charge') return s;
    }
    throw new Error('he never charged');
};

t('the body check is telegraphed before it is committed', () => {
    // The wind-up is not politeness, it is the dodge window that makes the
    // crash the player's doing rather than the AI's.
    const rng = rngFor('hype-wind');
    let s = openHypebeast(rng);
    const seen: string[] = [];
    for (let i = 0; i < 60 * 10 && !seen.includes('charge'); i++) {
        s = stepHypebeast(s, DT, near(30), rng).state;
        if (seen[seen.length - 1] !== s.phase) seen.push(s.phase);
    }
    assert.ok(seen.indexOf('wind') < seen.indexOf('charge'), `he charged without winding up: ${seen.join('→')}`);
});

t('a dodged charge ends in a storefront', () => {
    const rng = rngFor('hype-miss');
    let s = untilCharging(rng);
    let stunned: CastAction = null;
    for (let i = 0; i < 60 * 3 && !stunned; i++) {
        const r = stepHypebeast(s, DT, near(300), rng);   // the player stepped aside
        s = r.state;
        if (r.action?.type === 'stunned') stunned = r.action;
    }
    assert.ok(stunned, 'he missed and simply carried on');
    assert.equal(s.phase, 'stunned');
    assert.equal(s.crashes, 1);
});

t('a stunned hypebeast is a free target, and then is not', () => {
    const rng = rngFor('hype-vulnerable');
    let s = untilCharging(rng);
    for (let i = 0; i < 60 * 3 && s.phase !== 'stunned'; i++) s = stepHypebeast(s, DT, near(300), rng).state;
    assert.equal(isVulnerable(s), true);
    assert.equal(incomingDamage(s, 10), 10 * STUN_DAMAGE_MULT, 'missing cost him nothing');

    for (let i = 0; i < Math.round(HYPE_STUN / DT) - 2; i++) {
        const r = stepHypebeast(s, DT, near(10), rng);    // stand on him; he is face down
        s = r.state;
        assert.equal(r.action, null, 'he attacked from inside a shop window');
    }
    for (let i = 0; i < 60; i++) s = stepHypebeast(s, DT, near(300), rng).state;
    assert.notEqual(s.phase, 'stunned', 'he never got up');
    assert.equal(incomingDamage(s, 10), 10);
});

t('a body check that connects hurts, and does not stun him', () => {
    const rng = rngFor('hype-hit');
    let s = untilCharging(rng);
    let hit: CastAction = null;
    for (let i = 0; i < 60 * 3 && !hit; i++) {
        const r = stepHypebeast(s, DT, near(CONTACT_RANGE - 1), rng);
        s = r.state;
        if (r.action?.type === 'attack') hit = r.action;
    }
    assert.ok(hit && hit.type === 'attack' && hit.damage === CAST.hypebeast.contact, 'the charge did nothing');
    assert.notEqual(s.phase, 'stunned', 'he was punished for landing it');
    assert.equal(s.crashes, 0);
});

console.log('\nthe reseller, whose threat is economic');

/** Loot is always on the floor at his feet, and the scene removes what he bags. */
const lootCtx = (extra: Partial<CastCtx> = {}): CastCtx => ({ dist: 120, loot: 1, lootDist: 0, ...extra });

t('ignore him and the loot is genuinely gone', () => {
    const rng = rngFor('reseller-steal');
    let s = openReseller();
    let taken = 0;
    for (let i = 0; i < Math.round((RESELLER_ESCAPE + 4) / DT); i++) {
        const r = stepReseller(s, DT, lootCtx(), rng);
        s = r.state;
        if (r.action?.type === 'steal') taken = r.action.taken;
    }
    assert.ok(taken > 0, 'the thief never stole anything');
    assert.equal(stolen(s), true);
    assert.equal(s.held, taken, 'what he left with and what he reported taking disagree');
});

t('he does not leave before the timer he is sold on', () => {
    const rng = rngFor('reseller-early');
    let s = openReseller();
    for (let i = 0; i < Math.round(RESELLER_ESCAPE / DT) - 60; i++) {
        s = stepReseller(s, DT, lootCtx(), rng).state;
        assert.equal(stolen(s), false, `he left after ${(i * DT).toFixed(1)}s — there was no time to react`);
    }
});

t('shoot him and he drops the whole bag', () => {
    const rng = rngFor('reseller-shot');
    let s = openReseller();
    let dropped = 0;
    let stole = false;
    for (let i = 0; i < 60 * 40; i++) {
        // A hit every two seconds: less often than he needs to get clear.
        const hurt = i > 0 && i % 120 === 0;
        const r = stepReseller(s, DT, lootCtx({ hurt }), rng);
        s = r.state;
        if (r.action?.type === 'drop') dropped += r.action.freed;
        if (r.action?.type === 'steal') stole = true;
    }
    assert.ok(dropped > 0, 'shooting him did not shake anything loose');
    assert.equal(stole, false, 'he robbed the player while being shot the whole time');
    assert.equal(stolen(s), false);
});

t('being shot puts the clock back to the beginning', () => {
    const rng = rngFor('reseller-reset');
    let s = openReseller();
    for (let i = 0; i < Math.round((RESELLER_ESCAPE - 1) / DT); i++) s = stepReseller(s, DT, lootCtx(), rng).state;
    assert.ok(s.escape < 2, 'he was nowhere near leaving');
    s = stepReseller(s, DT, lootCtx({ hurt: true }), rng).state;
    assert.equal(s.escape, RESELLER_ESCAPE, 'a hit only nudged the timer');
    assert.equal(s.held, 0);
});

t('gone is gone — shooting the space where he was does nothing', () => {
    const rng = rngFor('reseller-final');
    let s = openReseller();
    for (let i = 0; i < Math.round((RESELLER_ESCAPE + 4) / DT); i++) s = stepReseller(s, DT, lootCtx(), rng).state;
    assert.equal(stolen(s), true);
    for (let i = 0; i < 600; i++) {
        const r = stepReseller(s, DT, lootCtx({ hurt: true }), rng);
        assert.equal(r.action, null, 'the loot came back after he had left with it');
        assert.deepEqual(r.state, s, 'a departed reseller is still ticking');
        s = r.state;
    }
});

t('he never once attacks the player', () => {
    const rng = rngFor('reseller-pacifist');
    let s = openReseller();
    for (let i = 0; i < 60 * 60; i++) {
        const r = stepReseller(s, DT, lootCtx({ dist: 0, hurt: i % 90 === 0 }), rng);
        s = r.state;
        assert.notEqual(r.action?.type, 'attack', 'the pacifist swung at somebody');
        assert.notEqual(r.action?.type, 'throw');
    }
});

console.log('\nmall security, and the donkey he will not acknowledge');

t('a guard on the radio is not a guard who is fighting', () => {
    const rng = rngFor('security-radio');
    let s = openSecurity(rng);
    for (let i = 0; i < 60 * 30; i++) {
        const r = stepSecurity(s, DT, near(10), rng);
        s = r.state;
        if (r.action?.type === 'radio') break;
    }
    assert.equal(s.phase, 'radio', 'he never called it in');
    for (let i = 0; i < Math.round(SECURITY_RADIO / DT) - 2; i++) {
        const r = stepSecurity(s, DT, near(0), rng);
        s = r.state;
        assert.equal(r.action, null, 'he described the situation and handled it simultaneously');
    }
});

t('he works through the script rather than repeating one line', () => {
    const rng = rngFor('security-script');
    let s = openSecurity(rng);
    const heard: string[] = [];
    for (let i = 0; i < 60 * 120 && heard.length < 3; i++) {
        const r = stepSecurity(s, DT, near(200), rng);
        s = r.state;
        if (r.action?.type === 'radio') heard.push(r.action.line);
    }
    assert.equal(heard.length, 3, 'Control stopped hearing from him');
    assert.equal(new Set(heard).size, 3, `he read the same line three times: ${heard[0]}`);
});

t('he radios whether or not anything is happening', () => {
    // He is the man narrating an empty corridor. Gating it on the player would
    // make him a normal enemy with a voice line.
    const rng = rngFor('security-alone');
    let s = openSecurity(rng);
    let radios = 0;
    for (let i = 0; i < 60 * 60; i++) {
        const r = stepSecurity(s, DT, near(5000), rng);
        s = r.state;
        if (r.action?.type === 'radio') radios++;
    }
    assert.ok(radios >= 5, `${radios} transmissions in a minute alone in a corridor`);
});

t('a donkey walking past changes absolutely nothing', () => {
    // The joke is that he does not notice, so the behaviour must not be able to
    // notice: two identical runs, one with livestock, must not diverge by a
    // single field. See `background.ts` — same discipline, other layer.
    const a = rngFor('security-donkey');
    const b = rngFor('security-donkey');
    let withOut = openSecurity(a);
    let withOne = openSecurity(b);
    for (let i = 0; i < 60 * 60; i++) {
        const q = stepSecurity(withOut, DT, { dist: 50 }, a);
        const p = stepSecurity(withOne, DT, { dist: 50, donkey: true }, b);
        assert.deepEqual(p.state, q.state, `he noticed the donkey at ${(i * DT).toFixed(1)}s`);
        assert.deepEqual(p.action, q.action);
        withOut = q.state;
        withOne = p.state;
    }
});

console.log('\nthe shop owner, who has a lease');

t('he throws his own stock, in an order you can learn', () => {
    const rng = rngFor('owner-stock');
    let s = openOwner(rng);
    const thrown: string[] = [];
    for (let i = 0; i < 60 * 120 && thrown.length < STOCK.length + 1; i++) {
        const r = stepOwner(s, DT, near(60), rng);
        s = r.state;
        if (r.action?.type === 'throw') thrown.push(r.action.item);
    }
    assert.deepEqual(thrown, [...STOCK, STOCK[0]], `he threw ${thrown.join(',')}`);
});

t('the shelf wins — tidying stops the attacking', () => {
    const rng = rngFor('owner-tidy');
    let s = openOwner(rng);
    const r = stepOwner(s, DT, { dist: 20, messy: true }, rng);
    s = r.state;
    assert.equal(r.action?.type, 'tidy', 'a mannequin went over and he ignored it');
    assert.equal(s.phase, 'tidy');
    for (let i = 0; i < Math.round(OWNER_TIDY / DT) - 2; i++) {
        const step = stepOwner(s, DT, near(0), rng);
        s = step.state;
        assert.equal(step.action, null, 'he straightened a shelf and threw a basket in the same frame');
        assert.equal(distracted(s), true);
    }
});

t('he goes back to throwing afterwards', () => {
    const rng = rngFor('owner-resume');
    let s = stepOwner(openOwner(rng), DT, { dist: 20, messy: true }, rng).state;
    let threw = false;
    for (let i = 0; i < 60 * 20 && !threw; i++) {
        const r = stepOwner(s, DT, near(60), rng);
        s = r.state;
        if (r.action?.type === 'throw') threw = true;
    }
    assert.ok(threw, 'he tidied for the rest of the level');
});

console.log('\nthe falafel guy, who is not involved');

t('he never attacks anybody, under any provocation', () => {
    const rng = rngFor('falafel-neutral');
    let s = openFalafelGuy();
    for (let i = 0; i < 60 * 120; i++) {
        const r = stepFalafelGuy(s, DT, {
            dist: 0, hurt: true, bumped: i % 37 === 0, legendary: true, messy: true, loot: 3, lootDist: 0,
        }, rng);
        s = r.state;
        const type = r.action?.type ?? null;
        assert.ok(type === null || type === 'spill', `the caterer produced a ${type}`);
    }
});

t('a bump puts the counter over, and the food in the air', () => {
    const rng = rngFor('falafel-spill');
    const r = stepFalafelGuy(openFalafelGuy(), DT, { dist: 300, bumped: true }, rng);
    assert.equal(r.action?.type, 'spill');
    assert.equal(r.state.phase, 'spill');
    assert.equal(r.state.spills, 1);
});

t('a counter already on its side cannot go over again', () => {
    // Otherwise the stand is a food cannon the player farms, and a neutral man
    // becomes a resource.
    const rng = rngFor('falafel-once');
    let s = stepFalafelGuy(openFalafelGuy(), DT, { dist: 300, bumped: true }, rng).state;
    for (let i = 0; i < Math.round((FALAFEL_SPILL + FALAFEL_RECOVER) / DT) - 2; i++) {
        const r = stepFalafelGuy(s, DT, { dist: 300, bumped: true }, rng);
        s = r.state;
        assert.equal(r.action, null, 'the stand fired twice');
    }
    assert.equal(s.spills, 1);
});

t('he cleans up and is open for business again', () => {
    const rng = rngFor('falafel-recover');
    let s = stepFalafelGuy(openFalafelGuy(), DT, { dist: 300, bumped: true }, rng).state;
    for (let i = 0; i < Math.round((FALAFEL_SPILL + FALAFEL_RECOVER) / DT) + 4; i++) {
        s = stepFalafelGuy(s, DT, { dist: 300 }, rng).state;
    }
    assert.equal(s.phase, 'serve', 'he is still on the floor picking up chickpeas');
    const again = stepFalafelGuy(s, DT, { dist: 300, bumped: true }, rng);
    assert.equal(again.action?.type, 'spill', 'the stand can only ever be knocked over once');
});

console.log('\nall six, for a long time, in a bad neighbourhood');

const PHASES: Record<CastKind, string[]> = {
    scalper: ['approach', 'photo', 'grab'],
    hypebeast: ['stalk', 'wind', 'charge', 'stunned'],
    reseller: ['seek', 'bag', 'flee', 'gone'],
    security: ['patrol', 'radio'],
    shopOwner: ['stock', 'tidy'],
    falafelGuy: ['serve', 'spill', 'recover'],
};

/**
 * Ten simulated minutes of everything happening at once. The scene removes a
 * pickup when it sees `grab` or `bag`, so the churn does too — an enemy
 * standing on an infinite pile of loot is not a state the game can produce.
 */
const churn = (kind: CastKind, seed: string): { actions: CastAction[]; state: CastState } => {
    const rng = rngFor(seed);
    let state = openCast(kind, rng);
    let loot = 1;
    const actions: CastAction[] = [];
    for (let i = 0; i < 60 * 600; i++) {
        const ctx: CastCtx = {
            dist: rng() * 300,
            loot,
            lootDist: loot > 0 ? rng() * 40 : Infinity,
            legendary: rng() < 0.004,
            hurt: rng() < 0.003,
            bumped: rng() < 0.002,
            messy: rng() < 0.004,
            donkey: rng() < 0.02,
        };
        const r = stepCast(state, DT, ctx, rng);
        state = r.state;
        if (r.action) actions.push(r.action);
        if (r.action?.type === 'grab' || r.action?.type === 'bag') loot = 0;
        if (rng() < 0.01) loot = 1;   // something else drops
        assert.ok(PHASES[kind].includes(state.phase), `${kind} reached the phase "${state.phase}"`);
        assert.ok(Number.isFinite(state.timer), `${kind} has a ${state.timer} timer`);
    }
    return { actions, state };
};

t('no machine reaches a phase that does not exist, or a timer that is not a number', () => {
    for (const k of KINDS) churn(k, `churn-${k}`);
});

t('no comedy beat ever becomes permanent', () => {
    // The failure this is really guarding: a beat whose exit condition depends
    // on something the scene may never send again, and the enemy stands there
    // for the rest of the level taking photographs.
    for (const k of KINDS) {
        if (!CAST[k].hostile) continue;
        const { actions } = churn(k, `stuck-${k}`);
        const attacks = actions.filter((a) => a?.type === 'attack' || a?.type === 'throw').length;
        assert.ok(attacks > 30, `${k} managed ${attacks} attacks in ten minutes — something is holding it`);
    }
});

t('a hostile enemy is not attacking while it is doing its bit', () => {
    // The general form of the per-enemy checks above, across every kind at once.
    for (const k of KINDS) {
        const rng = rngFor(`distracted-${k}`);
        let state = openCast(k, rng);
        for (let i = 0; i < 60 * 300; i++) {
            const r = stepCast(state, DT, {
                dist: 0, loot: 1, lootDist: 0, legendary: rng() < 0.01, messy: rng() < 0.01, bumped: rng() < 0.01,
            }, rng);
            if (distracted(r.state) && (r.action?.type === 'attack' || r.action?.type === 'throw')) {
                assert.fail(`${k} attacked from inside its own comedy beat`);
            }
            state = r.state;
        }
    }
});

t('the same seed plays out exactly the same way twice', () => {
    // Everything random takes rng last, the way stepSpawner and background do,
    // so a failing encounter can be replayed rather than described.
    for (const k of KINDS) {
        const a = churn(k, `replay-${k}`);
        const b = churn(k, `replay-${k}`);
        assert.deepEqual(a.state, b.state, `${k} drifted between two identical runs`);
        assert.deepEqual(a.actions, b.actions);
    }
});

t('nobody who is not hostile ever produces an attack', () => {
    for (const k of KINDS) {
        if (CAST[k].hostile) continue;
        const { actions } = churn(k, `pacifist-${k}`);
        for (const a of actions) {
            assert.notEqual(a?.type, 'attack', `${k} is listed as non-hostile and swung at somebody`);
        }
    }
});


// ---------------------------------------------------------------------------
// Siege conditions
// ---------------------------------------------------------------------------
/**
 * The checks above ask whether a beat costs the enemy something. These ask the
 * opposite question, which is the one that bites: can the *player* hold a beat
 * open and switch an enemy off for good?
 *
 * Two of these machines take their cue from a flag the scene sets rather than
 * from their own clock — the Scalper stoops for loot on the floor, the Owner
 * drops everything for disturbed stock — and a firefight in a shop sets both
 * flags more or less permanently. Found by running each enemy for ten minutes
 * with the flag pinned on: the Scalper threw six things and the Owner eight,
 * against roughly three hundred for everybody else. Neither was a bug you could
 * see in a phase name, and both read perfectly in isolation.
 *
 * So each flag-driven beat now has a refractory, and the siege is the test.
 */
const SIEGE_MINUTES = 10;

t('a Scalper standing in loot still fights back', () => {
    const rng = rngFor('siege-scalper');
    let s = openScalper(rng);
    let throws = 0, grabs = 0;
    for (let i = 0; i < 60 * 60 * SIEGE_MINUTES; i++) {
        // Loot under his feet, every single frame, forever.
        const r = stepScalper(s, DT, { dist: 60, loot: 4, lootDist: 1 }, rng);
        s = r.state;
        if (r.action?.type === 'throw') throws++;
        if (r.action?.type === 'grab') grabs++;
    }
    assert.ok(throws > 60, `besieged Scalper threw ${throws} things in ${SIEGE_MINUTES}min — he has been switched off`);
    assert.ok(grabs > 20, `besieged Scalper grabbed ${grabs} times — the greed is supposed to survive the fix`);
});

t('a Shop Owner in a wrecked shop still fights back', () => {
    const rng = rngFor('siege-owner');
    let s = openOwner(rng);
    let throws = 0, tidies = 0;
    for (let i = 0; i < 60 * 60 * SIEGE_MINUTES; i++) {
        const r = stepOwner(s, DT, { dist: 60, messy: true }, rng);
        s = r.state;
        if (r.action?.type === 'throw') throws++;
        if (r.action?.type === 'tidy') tidies++;
    }
    assert.ok(throws > 60, `besieged Owner threw ${throws} things in ${SIEGE_MINUTES}min — the shelf won permanently`);
    assert.ok(tidies > 20, `besieged Owner tidied ${tidies} times — he is still allowed to care about the shelf`);
});

t('both refractories are long enough to matter and short enough to be a beat', () => {
    for (const [name, v] of [['SCALPER_GREED', SCALPER_GREED], ['OWNER_TIDY_REFRACTORY', OWNER_TIDY_REFRACTORY]] as const) {
        assert.ok(v > 1, `${name} under a second is not a refractory, it is a rounding error`);
        assert.ok(v < 12, `${name} that long and the beat stops reading as a habit`);
    }
});

console.log(`\n${pass} cast checks passed.\n`);
