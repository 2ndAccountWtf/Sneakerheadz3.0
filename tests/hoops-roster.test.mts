/**
 * Hoops roster: the character check.
 *
 * `systems/hoops/roster.ts` exists to fix one specific failure — four block
 * humanoids that played identically because nothing distinguished them. This
 * suite asserts the fix actually landed: every attribute is a real number in
 * range, every profile spends a budget instead of sitting flat at 0.5, and
 * the roster genuinely spans best-to-worst on at least one axis, the way an
 * NBA Jam roster does. It also pins every key to a real id, because an
 * invented npcId here is a silent dead end — `profileFor` would never be
 * called with it from anywhere else in the game.
 */
import assert from 'node:assert/strict';
import { OPPONENTS } from '../systems/opponents.ts';
import { ROSTER, profileFor, spread, total, BASELINE, ATTRIBUTE_BUDGET, type Attributes } from '../systems/hoops/roster.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const ATTR_KEYS: (keyof Attributes)[] = ['speed', 'jump', 'dunk', 'range', 'handles', 'defense', 'stamina'];

/** The two seats on the floor that are not opponents: the human and Big Mike. */
const NON_OPPONENT_KEYS = new Set(['player', 'big-mike']);
const REAL_NPC_IDS = new Set(OPPONENTS.map(o => o.npcId));
const SKILL_OF = new Map(OPPONENTS.map(o => [o.npcId, o.skill]));

/** The same line spread() traces, just the anchor a hand-authored total should land near. */
const budgetFor = (skill: number) => 1.75 + Math.max(0, Math.min(1, skill)) * 3.5;

t('roster is non-empty', () => {
    assert.ok(Object.keys(ROSTER).length > 0, 'ROSTER must not be empty');
});

t('every roster key is a real npcId (from opponents.ts) or an allowed non-opponent seat', () => {
    for (const key of Object.keys(ROSTER)) {
        const ok = REAL_NPC_IDS.has(key) || NON_OPPONENT_KEYS.has(key);
        assert.ok(ok, `ROSTER key "${key}" is not a real npcId in systems/opponents.ts and is not player/big-mike`);
    }
});

t('every npcId that plays street-ball has a profile', () => {
    const streetBallers = OPPONENTS.filter(o => o.games.includes('street-ball'));
    for (const o of streetBallers) {
        assert.ok(ROSTER[o.npcId], `${o.name} (${o.npcId}) plays street-ball but has no roster profile`);
    }
});

t('a profile\'s npcId field matches the key it is stored under', () => {
    for (const [key, profile] of Object.entries(ROSTER)) {
        assert.equal(profile.npcId, key, `profile stored at "${key}" claims npcId "${profile.npcId}"`);
    }
});

t('every attribute is a finite number within 0..1', () => {
    for (const [key, profile] of Object.entries(ROSTER)) {
        for (const k of ATTR_KEYS) {
            const v = profile.attributes[k];
            assert.ok(Number.isFinite(v), `${key}.${k} is not a finite number`);
            assert.ok(v >= 0 && v <= 1, `${key}.${k} = ${v} is out of 0..1`);
        }
    }
});

t('every profile has a non-empty style and signature', () => {
    for (const [key, profile] of Object.entries(ROSTER)) {
        assert.ok(profile.style.trim().length > 0, `${key} has no style line`);
        assert.ok(profile.signature.trim().length > 0, `${key} has no signature`);
        assert.notEqual(profile.style, 'Plays like somebody who plays a lot.', `${key} still has the fallback style line`);
        assert.notEqual(profile.signature, 'Nothing special', `${key} still has the fallback signature`);
    }
});

t('no profile is flat: every one has a substantial spread between its best and worst attribute', () => {
    // The baseline (an "ordinary person") is flat by definition. A named
    // character should never be that close to it in every stat at once.
    const MIN_GAP = 0.35;
    for (const [key, profile] of Object.entries(ROSTER)) {
        const values = ATTR_KEYS.map(k => profile.attributes[k]);
        const gap = Math.max(...values) - Math.min(...values);
        assert.ok(gap >= MIN_GAP, `${key} has only a ${gap.toFixed(2)} spread across its attributes — reads as a stat block, not a character`);
    }
});

t("every profile's total sits within a sensible band of the skill-scaled budget", () => {
    // Budget scales with skill (spread() traces the same line), so a 0.80
    // skill NPC should land well above a 0.30 skill NPC, not at the same
    // total. Tolerance is generous — this is a "did you spend roughly the
    // right amount", not a precision check on hand-authored numbers.
    const TOLERANCE = 0.6;
    for (const [key, profile] of Object.entries(ROSTER)) {
        if (NON_OPPONENT_KEYS.has(key)) continue; // player/big-mike carry no opponents.ts skill to check against
        const skill = SKILL_OF.get(key) ?? 0.5;
        const sum = total(profile.attributes);
        const target = budgetFor(skill);
        assert.ok(
            Math.abs(sum - target) <= TOLERANCE,
            `${key}: total() = ${sum.toFixed(2)}, expected roughly ${target.toFixed(2)} (skill ${skill}) within ${TOLERANCE}`,
        );
        // And never wildly over ATTRIBUTE_BUDGET regardless of skill — nobody
        // is good at everything just because they're good at the game.
        assert.ok(sum <= ATTRIBUTE_BUDGET + 1.2, `${key}: total() = ${sum.toFixed(2)} spends far more than the budget allows`);
    }
});

t('the roster spans a real range: a genuine best and worst shooter, and a genuine best and worst dunker', () => {
    const entries = Object.entries(ROSTER);
    const ranges = entries.map(([, p]) => p.attributes.range);
    const dunks = entries.map(([, p]) => p.attributes.dunk);

    assert.ok(Math.max(...ranges) - Math.min(...ranges) >= 0.7, 'range does not span a wide enough gap across the roster');
    assert.ok(Math.max(...dunks) - Math.min(...dunks) >= 0.7, 'dunk does not span a wide enough gap across the roster');

    // Grandma Laces is specified as the best shooter who cannot leave the
    // floor; Big Mike is specified as the best finisher who cannot shoot.
    const laces = ROSTER['grandma-laces'];
    const mike = ROSTER['big-mike'];
    if (laces) {
        assert.ok(laces.attributes.range === Math.max(...ranges), 'Grandma Laces should be the single best shooter on the roster');
        assert.ok(laces.attributes.dunk <= 0.15, 'Grandma Laces should barely leave the floor');
    }
    if (mike) {
        assert.ok(mike.attributes.dunk === Math.max(...dunks), 'Big Mike should be the single best finisher on the roster');
        assert.ok(mike.attributes.range <= 0.15, 'Big Mike should have essentially no jump shot');
    }
});

t('The Game is specifically a bad shooter who can get to the rim', () => {
    const game = ROSTER['the-game'];
    assert.ok(game, 'the-game must have a profile');
    assert.ok(game.attributes.range <= 0.25, 'The Game should brick from range');
    assert.ok(game.attributes.speed >= 0.5 || game.attributes.handles >= 0.5, 'The Game should still be able to get to the basket');
});

t('profileFor returns the stored profile for a known id', () => {
    const p = profileFor('grandma-laces');
    assert.equal(p, ROSTER['grandma-laces']);
});

t('profileFor falls back sanely for an unknown id, without throwing', () => {
    const p = profileFor('some-npc-that-does-not-exist', 0.9);
    assert.equal(p.npcId, 'some-npc-that-does-not-exist');
    for (const k of ATTR_KEYS) {
        const v = p.attributes[k];
        assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, `fallback attribute ${k} out of range`);
    }
    // A high-skill fallback should still be flat (spread() by design) but
    // clearly above baseline in every attribute.
    for (const k of ATTR_KEYS) {
        assert.ok(p.attributes[k] > BASELINE[k], `fallback with skill 0.9 should exceed baseline on ${k}`);
    }
    assert.ok(p.style.length > 0);
    assert.ok(p.signature.length > 0);
});

t('profileFor falls back for undefined id without throwing', () => {
    const p = profileFor(undefined);
    assert.equal(p.npcId, 'generic');
});

t('spread() and total() still behave as documented', () => {
    const flat = spread(0.5);
    for (const k of ATTR_KEYS) assert.equal(flat[k], 0.5);
    assert.equal(total(flat), 3.5);
    assert.equal(total(BASELINE), ATTRIBUTE_BUDGET);
});

console.log(`\nhoops-roster: ${pass} passed`);
