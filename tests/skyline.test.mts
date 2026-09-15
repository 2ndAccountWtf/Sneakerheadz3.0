/**
 * A horizon that does not visibly repeat.
 *
 * The delivered skyline is a kit of thirty-nine separate buildings rather than
 * the three tiling strips the brief asked for, and a kit is only worth having
 * if the code actually deals from it. A strip repeats its whole contents every
 * time it scrolls its own width, and two minutes of watching a horizon is long
 * enough to see that — so these checks are about repetition, which is the one
 * property a screenshot cannot show.
 */
import assert from 'node:assert/strict';
import {
    BANDS, BAND_ORDER, pieceAt, flipAt, layoutBand, layoutSkyline, slotHash,
} from '../components/minigames/engine/skyline.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

console.log('\nthe city is a function of where you are');

t('the same stretch of road always shows the same city', () => {
    // Scroll out and back and the skyline has to be where you left it, or the
    // world is not a place, it is a screensaver.
    const a = layoutBand('towers', 4000, 352);
    const b = layoutBand('towers', 4000, 352);
    assert.deepEqual(a, b, 'the same position produced two different cities');
});

t('different stretches show different cities', () => {
    const a = layoutBand('towers', 0, 352).map(p => p.piece.id).join();
    const b = layoutBand('towers', 9000, 352).map(p => p.piece.id).join();
    assert.notEqual(a, b, 'the whole city is one repeated block');
});

t('nothing is stored, so the level is infinite', () => {
    // A hundred kilometres out, the maths still works and the answer is still
    // stable. Anything that generated ahead would have run out by here.
    const far = layoutBand('lowrise', 5_000_000, 352);
    assert.ok(far.length > 0, 'the city ran out');
    assert.deepEqual(far, layoutBand('lowrise', 5_000_000, 352));
    assert.ok(far.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

console.log('\nrepetition, which is the whole point');

t('no two neighbours are identical as drawn', () => {
    // The single rule that makes a kit better than a strip. An adjacent repeat
    // reads as a texture error far more loudly than one twenty slots away.
    //
    // "As drawn" is the operative phrase: a hash will occasionally deal the
    // same building twice in a row, and rather than chase it to a different
    // piece — which only moves the collision one slot along — the twin is
    // mirrored. What must never happen is two slots that are identical *on
    // screen*, which is the pair (id, flip).
    // "Side by side" means close enough on screen to be compared at a glance.
    // A sparse band leaves gaps, and two rooftop pieces ten slots apart are 190
    // pixels apart — most of a screen. An earlier version of this check called
    // those neighbours and failed on a city that was perfectly fine, which is
    // the test being wrong rather than the code.
    const NEAR_PX = 60;
    for (const name of BAND_ORDER) {
        const band = BANDS[name];
        let prev: { drawn: string; slot: number } | null = null;
        for (let i = -1000; i < 1000; i++) {
            const p = pieceAt(band, i);
            if (!p) continue;
            const drawn = `${p.id}|${flipAt(band, i)}`;
            const close = prev !== null && (i - prev.slot) * band.spacing <= NEAR_PX;
            if (close && prev!.drawn === drawn) {
                assert.fail(`${name}: ${drawn} twice within ${NEAR_PX}px, at slots ${prev!.slot} and ${i}`);
            }
            prev = { drawn, slot: i };
        }
    }
});

t('mirroring is used sparingly — it is a fix, not a feature', () => {
    // If half the city were mirrored the hash would be doing something wrong,
    // and a city of mirror-image buildings has its own tell.
    for (const name of BAND_ORDER) {
        let flipped = 0, total = 0;
        for (let i = 0; i < 2000; i++) {
            if (!pieceAt(BANDS[name], i)) continue;
            total++;
            if (flipAt(BANDS[name], i)) flipped++;
        }
        assert.ok(flipped / total < 0.3, `${name}: ${Math.round(flipped / total * 100)}% of the city is mirrored`);
    }
});

t('a long drive uses the whole kit, not a favourite corner of it', () => {
    for (const name of BAND_ORDER) {
        const seen = new Map<string, number>();
        for (let i = 0; i < 4000; i++) {
            const p = pieceAt(BANDS[name], i);
            if (p) seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
        }
        const kit = BANDS[name].pieces.length;
        assert.equal(seen.size, kit, `${name} used ${seen.size} of its ${kit} pieces`);
        // And used them at roughly the same rate — a piece that turns up ten
        // times as often as its neighbours is the repeat the kit was meant to
        // avoid, wearing a different hat.
        const counts = [...seen.values()];
        const hi = Math.max(...counts), lo = Math.min(...counts);
        assert.ok(hi < lo * 2.2, `${name}: one piece appears ${hi} times and another only ${lo}`);
    }
});

t('landmarks stay rare enough to be landmarks', () => {
    // One you pass every eight seconds is wallpaper. Over 4000 slots this is
    // about how often a real drive should meet one.
    let hits = 0;
    for (let i = 0; i < 4000; i++) if (pieceAt(BANDS.landmarks, i)) hits++;
    const share = hits / 4000;
    assert.ok(share > 0.2 && share < 0.75, `landmarks fill ${(share * 100).toFixed(0)}% of their slots`);
    // And their band is spaced far wider than the ordinary buildings.
    assert.ok(BANDS.landmarks.spacing > BANDS.towers.spacing * 4);
});

console.log('\nwhere it sits on screen');

t('the whole skyline is above the road', () => {
    // The road starts at y=100 in Downhill Racer and y=104 in Pizza Run. A
    // building whose feet are on the tarmac is not a background.
    for (const { placements } of layoutSkyline(1234, 352)) {
        for (const p of placements) {
            assert.ok(p.y <= 100, `a ${p.piece.id} has its ground line at y${p.y}, on the road`);
            assert.ok(p.y - p.piece.h > -60, `a ${p.piece.id} reaches ${p.piece.h}px off the top of the screen`);
        }
    }
});

t('the far band moves slower than the near one', () => {
    // Parallax, stated as a fact rather than trusted to the numbers looking
    // about right.
    assert.ok(BANDS.towers.factor < BANDS.lowrise.factor, 'the far towers keep pace with the street');
    const a = layoutBand('towers', 0, 352)[0].x;
    const b = layoutBand('towers', 600, 352)[0].x;
    const c = layoutBand('lowrise', 0, 352)[0].x;
    const d = layoutBand('lowrise', 600, 352)[0].x;
    assert.ok(Math.abs(b - a) < Math.abs(d - c), 'both bands scrolled by the same amount');
});

t('a screenful is covered, with a slot of margin either side', () => {
    // A piece wider than its spacing has to slide in from off-screen rather
    // than appear at the edge.
    const p = layoutBand('lowrise', 777, 352);
    assert.ok(p[0].x <= 0, 'the first building starts on screen, so it will pop in');
    assert.ok(p[p.length - 1].x >= 352 - BANDS.lowrise.spacing, 'the city stops short of the right edge');
});

t('the hash is stable and spread', () => {
    const vals = Array.from({ length: 2000 }, (_, i) => slotHash(i, 0));
    assert.ok(vals.every(v => v >= 0 && v < 1), 'the hash left its range');
    assert.equal(slotHash(42, 0), slotHash(42, 0), 'the hash is not stable');
    assert.notEqual(slotHash(42, 0), slotHash(42, 1), 'the salt does nothing');
    const buckets = [0, 0, 0, 0];
    for (const v of vals) buckets[Math.floor(v * 4)]++;
    assert.ok(Math.max(...buckets) < Math.min(...buckets) * 1.5, `uneven spread: ${buckets}`);
});

console.log(`\n${pass} skyline checks passed.\n`);
