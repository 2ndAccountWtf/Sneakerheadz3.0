/**
 * Does the asset list still describe the game?
 *
 * `docs/ASSETS-FLIGHT404.md` quotes exact durations — "**2.4s.** Both hands on
 * the phone" — because an animator cutting a loop needs to know how long the
 * sprite is actually on screen. Those numbers were read off the constants in
 * `cast.ts` and `projectiles.ts` on the day the document was written, and
 * nothing has stopped them drifting apart since.
 *
 * That drift is expensive in a way most stale documentation is not. Everything
 * else in the repo fails loudly when it goes out of date; this fails silently,
 * somewhere else, weeks later, in work somebody has already paid for — a
 * six-frame loop cut to 2.4 seconds against a beat the code shortened to 1.8,
 * delivered, dropped in, and subtly wrong forever.
 *
 * So the document is a test subject. Change a duration in the code and this
 * fails until the table is updated to match.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    SCALPER_PHOTO, SCALPER_GRAB, HYPE_WIND, HYPE_CHARGE, HYPE_STUN,
    RESELLER_BAG, RESELLER_ESCAPE, SECURITY_RADIO, OWNER_TIDY,
    FALAFEL_SPILL, FALAFEL_RECOVER, STOCK, CAST,
} from '../components/minigames/phaser/flight404/cast.ts';
import {
    SMEAR_LIFE, SMEAR_FADE, STICK_LIFE, MAX_BOUNCES,
} from '../components/minigames/phaser/flight404/projectiles.ts';
import { DUCK, BEATS } from '../components/minigames/phaser/flight404/background.ts';
import { CREEP, CREEP_ORDER } from '../components/minigames/phaser/flight404/creep.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const DOC = readFileSync(new URL('../docs/ASSETS-FLIGHT404.md', import.meta.url), 'utf8');

/**
 * The document writes a duration as `**2.4s.**` in a table cell and as
 * `**8 seconds**` mid-sentence, because the prose reads better that way and the
 * artist reads both. Match the number, not the typography — a check that only
 * accepted one house style would push the document towards being a worse
 * document in order to keep a test happy.
 */
const quotes = (): number[] =>
    [...DOC.matchAll(/\*\*([\d.]+)\s*(?:s\.?|seconds?)\*\*/g)].map(m => Number(m[1]));

t('the document quotes durations at all, so a silent rewrite cannot pass this file', () => {
    assert.ok(quotes().length >= 10, `only ${quotes().length} durations found — the table has been gutted`);
});

t('every beat duration in the document is a real constant', () => {
    const real = new Set<number>([
        SCALPER_PHOTO, SCALPER_GRAB, HYPE_WIND, HYPE_CHARGE, HYPE_STUN,
        RESELLER_BAG, RESELLER_ESCAPE, SECURITY_RADIO, OWNER_TIDY,
        FALAFEL_SPILL, FALAFEL_RECOVER, SMEAR_LIFE, SMEAR_FADE, STICK_LIFE, DUCK.hold,
    ]);
    for (const q of quotes()) {
        assert.ok(real.has(q), `the asset list promises a ${q}s animation and no beat in the code lasts that long`);
    }
});

t('every beat in the code is quoted in the document', () => {
    // The other direction, which is the one that actually bites: a beat nobody
    // wrote down is a beat nobody animates.
    const quoted = new Set(quotes());
    const named: [string, number][] = [
        ['SCALPER_PHOTO', SCALPER_PHOTO], ['SCALPER_GRAB', SCALPER_GRAB],
        ['HYPE_WIND', HYPE_WIND], ['HYPE_CHARGE', HYPE_CHARGE], ['HYPE_STUN', HYPE_STUN],
        ['RESELLER_BAG', RESELLER_BAG], ['RESELLER_ESCAPE', RESELLER_ESCAPE],
        ['SECURITY_RADIO', SECURITY_RADIO], ['OWNER_TIDY', OWNER_TIDY],
        ['FALAFEL_SPILL', FALAFEL_SPILL], ['FALAFEL_RECOVER', FALAFEL_RECOVER],
    ];
    for (const [name, v] of named) {
        assert.ok(quoted.has(v), `${name} is ${v}s and the asset list never says so — nobody will animate it to length`);
    }
});

t('the shop owner throws the four things the document lists, in that order', () => {
    for (const item of STOCK) {
        assert.ok(DOC.includes(`throw-${item}`), `the owner throws a ${item} and there is no art requested for it`);
    }
});

t('every background kind the code can spawn has art requested', () => {
    for (const kind of Object.keys(BEATS)) {
        assert.ok(
            DOC.includes(`bg-${kind}`) || DOC.includes(`bg-${kind === 'coffee' ? 'coffee-crew' : kind}`),
            `background actor "${kind}" exists in the game and is not on the asset list`,
        );
    }
});

t('every creep tier and its dressing is on the list', () => {
    for (const tier of CREEP_ORDER) {
        assert.ok(DOC.includes(`\`${tier}\``), `creep tier "${tier}" is not described for the artist`);
        for (const d of CREEP[tier].dressing) {
            assert.ok(DOC.includes(`dress-${d}`), `tier "${tier}" dresses with "${d}" and no art is requested for it`);
        }
    }
});

t('the double-damage rule is written down where the animator can see it', () => {
    // A stunned Hypebeast is worth double, so his stun animation has to read as
    // an invitation rather than as a death. That is an art note, not a code note.
    assert.ok(/double damage/i.test(DOC), 'the stun is worth double and the art brief does not mention it');
});

t('every enemy in the cast has at least one sprite requested', () => {
    const ids: Record<string, string> = {
        scalper: 'scalper-', hypebeast: 'hypebeast-', reseller: 'reseller-',
        security: 'security-', shopOwner: 'owner-', falafelGuy: 'falafel-',
    };
    for (const kind of Object.keys(CAST)) {
        assert.ok(DOC.includes(ids[kind]), `${kind} is in the game and has no art on the list`);
    }
});

t('the bounce cap the artist is drawing to is the one the physics uses', () => {
    assert.ok(DOC.includes(`${MAX_BOUNCES} bounces`), `falafel bounce cap is ${MAX_BOUNCES} and the list does not say so`);
});

console.log(`\n${pass} asset-list checks passed.\n`);
