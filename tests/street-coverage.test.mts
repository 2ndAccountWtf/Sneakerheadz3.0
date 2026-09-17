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
import { STREET_CAST, STREET_STUFF, NEAR_SWAP, castAt } from '../components/minigames/engine/streetCast.js';

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
 *
 * `streetCast.ts` is also a table of ids, and it is on this list anyway,
 * because of what happens to an id that is in it: `castAt` returns that member
 * and both games draw whatever it returns, unconditionally. Being listed there
 * *is* being drawn, which is exactly what is not true of a frame-rate entry.
 * If that ever stops being true — a member the picker can never return — this
 * file would go quiet about it, so `castAt`'s own coverage is asserted below.
 */
const DRAWERS = [
    'components/minigames/CartRace.tsx',
    'components/minigames/PizzaRun.tsx',
    'components/minigames/engine/skyline.ts',
    'components/minigames/engine/streetCast.ts',
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
    'throw-chancla': "throwState() with 'skateboard-throw-' stripped",
    'throw-slushie': "throwState() with 'skateboard-throw-' stripped",
    'throw-heavy': "throwState() with 'skateboard-throw-' stripped",
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
const STANDBY: Record<string, string> = {
    // The thief off his bike. These are not race animations — he cannot record
    // a podcast while being chased — so they have no slot in any band and no
    // state in `bikeState`. They belong to the moment after the race ends, one
    // pose per outcome: caught and he is under a parked car, gone and he is
    // already doing a segment about it. That is a scene the game does not have
    // yet, so they are held rather than hidden somewhere they would look wrong.
    'gayme-crouch-behind': 'post-race tableau: caught',
    'gayme-hide-under': 'post-race tableau: caught',
    'gayme-podcast': 'post-race tableau: he got away',
    'gayme-kettlebell': 'post-race tableau: he got away',
    'gayme-eat-burger': 'post-race tableau: he got away',
    'gayme-eat-mushroom': 'post-race tableau: you wiped out',
};

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
        // The thrown items are the rider's throw id with its prefix stripped,
        // so what has to exist in the source is the rider's version.
        if (id.startsWith('throw-')) {
            const rider = `skateboard-${id}`;
            assert.ok(SOURCE.includes(`'${rider}'`),
                `${id} is exempted as "${how}" but "${rider}" appears nowhere`);
            continue;
        }
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

t('every member of the shared cast can actually turn up', () => {
    // The debt `streetCast.ts` takes on by being in DRAWERS. Listing an id
    // there only counts as drawing it while the picker can return it, and the
    // picker splits the slots two ways: people from one list, belongings from
    // another. Get that split wrong — the wrong modulo, a list longer than the
    // hash's reach — and some members become unreachable while every scan in
    // this file still reports them wired, which is precisely the silent failure
    // the rest of the file exists to prevent.
    //
    // So: walk a long stretch of street and insist on seeing all of them.
    const seen = new Set<string>();
    for (let slot = 0; slot < 4000; slot++) seen.add(castAt(slot, 0, 1e6).id);
    for (const m of [...STREET_CAST, ...STREET_STUFF]) {
        assert.ok(seen.has(m.id), `${m.id} is in the cast but no slot ever picks it`);
    }
});

t('the near-swap poses are reachable too', () => {
    // These never come out of the lists — only out of a swap when you are
    // alongside — so the walk above cannot see them and DRAWERS counts them
    // purely on the `NEAR_SWAP` entry. That entry is worth nothing if the
    // sprite it names is unreachable.
    for (const [from, to] of Object.entries(NEAR_SWAP)) {
        assert.ok(STREET_CAST.some((m) => m.id === from) || STREET_STUFF.some((m) => m.id === from),
            `${from} is swapped from, but is not in either list`);
        let hit = false;
        for (let slot = 0; slot < 4000 && !hit; slot++) {
            // Same slot, once far and once close: only the distance differs.
            if (castAt(slot, 0, 1e6).id === from && castAt(slot, 0, 0).id === to) hit = true;
        }
        assert.ok(hit, `${to} is never reached by walking past ${from}`);
    }
});

t('the street is the same street every time you ride down it', () => {
    // Both games draw this band from the scroll offset, so a picker that used
    // per-frame randomness would make the neighbourhood reshuffle under you as
    // the slot crosses the screen. It has to be a function of the slot alone.
    for (let slot = -50; slot < 50; slot++) {
        assert.equal(castAt(slot, 0, 1e6).id, castAt(slot, 0, 1e6).id);
    }
});

t('neighbours are not the same person twice', () => {
    // The tiny-bicycle problem again, with seventeen sprites instead of one.
    // Two grannies side by side reads as a bug whatever the art is like, so
    // what matters is the rate of that happening, measured rather than eyeballed
    // over forty slots where any answer is plausible.
    //
    // This check has teeth: it is the one that caught the first hash. Picking
    // the list with `h % 4` and the member with `h % 14` made both depend on
    // bit 1 of the same multiplicative hash, and the street came out at 13.2%
    // side-by-side duplicates against an ideal of 6.1% — more than double, and
    // visible.
    const N = 20000;
    const ids = Array.from({ length: N }, (_, i) => castAt(i, 0, 1e6).id);
    let repeats = 0;
    for (let i = 1; i < N; i++) if (ids[i] === ids[i - 1]) repeats++;
    const rate = repeats / (N - 1);
    // One slot in four is belongings, so an adjacent pair matches either by
    // being the same one of fourteen people or the same one of three piles.
    const ideal = (9 / 16) / STREET_CAST.length + (1 / 16) / STREET_STUFF.length;
    assert.ok(rate < ideal * 1.4, `${(rate * 100).toFixed(1)}% of neighbours match; chance is ${(ideal * 100).toFixed(1)}%`);
    // Far *below* chance is its own bug: it means the picker is marching
    // through the list in order rather than dealing from it, which looks like a
    // rota once you have watched the street for ten seconds.
    assert.ok(rate > ideal * 0.5, `only ${(rate * 100).toFixed(1)}% of neighbours match; the picker is cycling, not hashing`);
});

console.log(`\n${pass} coverage checks passed\n`);
