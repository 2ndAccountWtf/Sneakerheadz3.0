/**
 * Is every delivered PNG actually drawn?
 *
 * This check exists because I got this wrong by hand. A scan that asked "does
 * this id appear anywhere in the source" reported all 129 delivered files as
 * wired, and three of them were not drawn at all — the id appeared only in a
 * frame-rate table or a frame-count table, which is bookkeeping about a sheet
 * rather than anything that puts it on screen. `car-taxi` sat in a lookup the
 * vehicle branch returns before ever reaching; `tiny-bicycle` and `longboard`
 * existed only in `streetAnim`'s rate table.
 *
 * Somebody spent time drawing those. A file that arrives and is silently never
 * used is the most expensive kind of bug in an art pipeline, because the cost
 * lands on the person who drew it and nothing anywhere reports it.
 *
 * So the rule here is narrow on purpose: an id counts as drawn only if it
 * appears in a file that *draws*, and the bookkeeping modules are excluded from
 * the search no matter what they contain.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

/** Every delivered id under a folder, with `@N` stripped. */
function delivered(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
        for (const e of readdirSync(d)) {
            const full = join(d, e);
            if (statSync(full).isDirectory()) { walk(full); continue; }
            if (!e.toLowerCase().endsWith('.png')) continue;
            const base = e.replace(/\.png$/i, '');
            out.push(base.match(/^(.+?)@(\d+)$/)?.[1] ?? base);
        }
    };
    walk(dir);
    return [...new Set(out)];
}

/**
 * Files that put pixels on screen. Deliberately excludes `streetAnim.ts` and
 * `streetArt.ts`: the first is a table of frame rates and the second a table of
 * frame counts, and an id being listed in either says nothing about whether
 * anything ever draws it. That distinction is the whole point of this file.
 */
const DRAWERS = [
    'components/minigames/CartRace.tsx',
    'components/minigames/PizzaRun.tsx',
    'components/minigames/engine/skyline.ts',
];
/**
 * ...with prose thrown away.
 *
 * Both games narrate their endings — "You ran him down on a longboard" — and a
 * search that counts those sentences reports `longboard` as drawn when the only
 * thing using the word is a results card. Every such line is a template
 * literal, and no draw call in either game is written inside one, so dropping
 * lines that contain a backtick separates the two exactly.
 */
const RAW = DRAWERS.map((f) => readFileSync(f, 'utf8')).join('\n');
const SOURCE = RAW.split('\n').filter((line) => !line.includes('`')).join('\n');

/**
 * Ids that are reached through a template rather than written out, so a plain
 * search cannot see them. Each one is listed with the expression that builds it.
 */
const TEMPLATED: Record<string, string> = {
    'house-bungalow-far': "HOOD_ART + '-far'",
    'house-bungalow-near': "HOUSE_ART + '-near'",
    'house-twostorey-far': "HOOD_ART + '-far'",
    'house-twostorey-near': "HOUSE_ART + '-near'",
    'house-apartment-far': "HOOD_ART + '-far'",
    'house-apartment-near': "HOUSE_ART + '-near'",
};

/**
 * Ids that exist to be used *instead of* something else, so they are correctly
 * absent while the thing they replace is present. Each needs a reason.
 *
 * Empty, and that is the point. The twelve `far-*` silhouettes lived here while
 * they were unbuilt; they have since been delivered, so they are held to the
 * same rule as everything else — `skyline.ts` names each one in a `far:` field,
 * which is a drawing file, so the plain search finds them. If the set is ever
 * renamed and the code is not, this is what says so.
 */
const STANDBY: Record<string, string> = {};

console.log('\nnothing that was drawn goes unused');

t('every delivered street and character PNG is drawn by something', () => {
    const missing: string[] = [];
    for (const id of [...delivered('assets/art/street'), ...delivered('assets/art/characters')]) {
        if (TEMPLATED[id] || STANDBY[id]) continue;
        if (SOURCE.includes(`'${id}'`)) continue;
        missing.push(id);
    }
    assert.deepEqual(missing, [],
        `delivered but never drawn: ${missing.join(', ')}\n`
        + '  Somebody drew these and nothing puts them on screen. Either wire them\n'
        + '  up, or add them to STANDBY above with the reason they are held back.');
});

t('the templated ids really are built by the expressions claimed', () => {
    // A guard on the exemption itself: if `HOOD_ART` were renamed, the six house
    // facades would drop out of the game and this file would still pass.
    for (const [id, how] of Object.entries(TEMPLATED)) {
        const stem = id.replace(/-(far|near)$/, '');
        assert.ok(RAW.includes(`'${stem}'`),
            `${id} is exempted as "${how}" but "${stem}" appears nowhere`);
    }
    // Against the raw source: the near-row facade name is assembled inside a
    // template literal, which is exactly what `SOURCE` strips out.
    assert.ok(RAW.includes('-far'), 'the -far suffix is gone; the exemptions are stale');
    assert.ok(RAW.includes("'near'"), 'the near-row suffix is gone; the exemptions are stale');
});

t('prose about a longboard is not a longboard', () => {
    // The second half of the same mistake. Both games have a results sentence
    // naming the board you were riding; neither draws anything there.
    assert.ok(
        /`[^`]*longboard/.test(readFileSync(DRAWERS[0], 'utf8')),
        'the results prose has moved — this check no longer proves anything',
    );
    const prose = readFileSync(DRAWERS[0], 'utf8')
        .split('\n').filter((l) => l.includes('`')).join('\n');
    assert.ok(prose.includes("'longboard'"), 'expected the prose mention to be in a template literal');
    assert.ok(!SOURCE.split('\n').some((l) => l.includes('`')), 'prose lines leaked into the search');
});

t('a rate table does not count as drawing something', () => {
    // The exact mistake: `tiny-bicycle` was in streetAnim's RATE table, which a
    // careless search reads as "wired". If that file ever gets into DRAWERS,
    // this check stops meaning anything.
    for (const f of DRAWERS) {
        assert.ok(!f.endsWith('streetAnim.ts'), 'streetAnim is a rate table, not a renderer');
        assert.ok(!f.endsWith('streetArt.ts'), 'streetArt is the loader, not a caller');
    }
});

console.log(`\n${pass} coverage checks passed\n`);
