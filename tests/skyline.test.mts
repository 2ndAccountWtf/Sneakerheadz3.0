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
    slotRange, clumpAt, sizeAt, slotsPerScreen, type BandName,
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
        const seen = new Set<string>();
        for (let i = 0; i < 4000; i++) {
            const p = pieceAt(BANDS[name], i);
            if (p) seen.add(p.id);
        }
        const kit = BANDS[name].pieces.length;
        assert.equal(seen.size, kit, `${name} used ${seen.size} of its ${kit} pieces`);
    }
});

t('the kit is dealt evenly, with no favourite', () => {
    // A piece that turns up twice as often as its neighbours is the repeat the
    // kit was meant to avoid, wearing a different hat.
    //
    // Measured over far more slots than one drive covers, deliberately. The
    // claim is about the dealer, not about a drive, and the sample has to be
    // big enough that the answer is about the dealer too. This check used 4000
    // slots and broke the day the rooftop band stopped filling every third slot
    // unconditionally: 24 pieces over 4000 slots at 29% fill is 48 expected
    // hits each, and the square-root noise on 48 alone spans 27 to 63 — a 2.3x
    // spread from a dealer that is provably even at 60000 (1.08x). The old
    // number was measuring its own sample size.
    const N = 60000;
    for (const name of BAND_ORDER) {
        const seen = new Map<string, number>();
        for (let i = 0; i < N; i++) {
            const p = pieceAt(BANDS[name], i);
            if (p) seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
        }
        const counts = [...seen.values()];
        const hi = Math.max(...counts), lo = Math.min(...counts);
        assert.ok(hi < lo * 1.5, `${name}: one piece appears ${hi} times and another only ${lo}`);
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
            assert.ok(p.y - p.h > -60, `a ${p.piece.id} reaches ${p.h}px off the top of the screen`);
        }
    }
});

t('the far band moves slower than the near one', () => {
    // Parallax, stated as a fact rather than trusted to the numbers looking
    // about right.
    assert.ok(BANDS.towers.factor < BANDS.lowrise.factor, 'the far towers keep pace with the street');
    // Followed by slot, not by list position. Once the city has gaps in it the
    // first entry of a layout is the first *filled* slot, which moves for
    // reasons that have nothing to do with parallax.
    const moved = (name: BandName, from: number, to: number): number => {
        const before = new Map(layoutBand(name, from, 352).map(p => [p.slot, p.x]));
        for (const p of layoutBand(name, to, 352)) {
            const was = before.get(p.slot);
            if (was !== undefined) return Math.abs(p.x - was);
        }
        throw new Error(`${name}: no building survived the scroll to compare`);
    };
    assert.ok(moved('towers', 0, 600) < moved('lowrise', 0, 600),
        'both bands scrolled by the same amount');
});

t('a screenful is covered, with a slot of margin either side', () => {
    // A piece wider than its spacing has to slide in from off-screen rather
    // than appear at the edge.
    //
    // Stated about the slot range rather than about the placements. This used
    // to assert that the first building sat at or left of x=0, which was only
    // ever true because every slot was filled; a city with gaps in it can
    // legitimately have its first building a third of the way across the
    // screen, and the check would have been failing on correct output. What
    // still has to hold is that the range considered brackets the screen.
    for (const name of BAND_ORDER) {
        const band = BANDS[name];
        for (const scroll of [0, 777, 5000, 123456, -2400]) {
            const [first, last] = slotRange(band, scroll, 352);
            const shift = scroll * band.factor;
            assert.ok(first * band.spacing - shift <= -band.spacing,
                `${name} at ${scroll}: the left margin is inside the screen`);
            assert.ok(last * band.spacing - shift >= 352,
                `${name} at ${scroll}: the city stops short of the right edge`);
        }
    }
    // And the range is actually what gets laid out — every placement inside it.
    const p = layoutBand('lowrise', 777, 352);
    const [first, last] = slotRange(BANDS.lowrise, 777, 352);
    assert.ok(p.every(q => q.slot >= first && q.slot <= last), 'a placement escaped its range');
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

// ---------------------------------------------------------------------------
// Depth
// ---------------------------------------------------------------------------
// Draw order is the only thing saying which band is in front, and parallax
// factor is the only thing saying which is further away. If those two disagree
// the picture contradicts itself — which is exactly what happened: landmarks
// were painted last, over the lowrise band, while scrolling slower than it. A
// 96px Hellaweird sign ended up looking nearer *and* smaller than a 36px
// shopfront, which is the one thing a parallax scene must never do.

t('nothing is drawn in front of a band that scrolls faster than it', () => {
    for (let i = 1; i < BAND_ORDER.length; i++) {
        const behind = BANDS[BAND_ORDER[i - 1]];
        const front = BANDS[BAND_ORDER[i]];
        assert.ok(
            front.factor >= behind.factor,
            `${BAND_ORDER[i]} is drawn in front of ${BAND_ORDER[i - 1]} but scrolls slower `
            + `(${front.factor} vs ${behind.factor}) — it cannot be both nearer and further away`,
        );
    }
});

t('a band further away has a higher ground line', () => {
    // The horizon is up-screen, so a more distant band stands on a line closer
    // to it. Rooftop clutter is exempt: it sits on roofs, not on the ground.
    const ground = BAND_ORDER.filter((b) => b !== 'rooftop');
    for (let i = 1; i < ground.length; i++) {
        const behind = BANDS[ground[i - 1]];
        const front = BANDS[ground[i]];
        assert.ok(
            front.baseline >= behind.baseline,
            `${ground[i]} stands higher than ${ground[i - 1]} yet is nearer`,
        );
    }
});

// ---------------------------------------------------------------------------
// The distance drawings
// ---------------------------------------------------------------------------
// Every tower and lowrise carries the id of a flatter version of itself, so a
// horizon redrawn for the distance can arrive one file at a time. If an id here
// does not match what the brief asks for, the file lands in the folder and
// nothing uses it — which is silent, and exactly the kind of thing that costs
// somebody a day of drawing.

t('every ground-standing building has a distance version to look for', () => {
    for (const band of ['towers', 'lowrise'] as const) {
        for (const p of BANDS[band].pieces) {
            assert.ok(p.far, `${p.id} has no distance id`);
            assert.equal(p.far, `far-${p.id}`,
                `${p.id} asks for "${p.far}" — the brief names far-${p.id}`);
        }
    }
});

t('rooftop clutter and landmarks are deliberately not in that set', () => {
    // Clutter is already a silhouette at 16px, and the three landmarks are
    // supposed to be recognisable — flattening them defeats the point of having
    // them. Asserted rather than assumed so nobody "completes" the set later.
    for (const band of ['rooftop', 'landmarks'] as const) {
        for (const p of BANDS[band].pieces) {
            assert.equal(p.far, undefined, `${p.id} should not have a distance version`);
        }
    }
});

// ---------------------------------------------------------------------------
// Rhythm
// ---------------------------------------------------------------------------
// "Too evenly spaced" was the first thing anybody said about this skyline, and
// they were right: `density: 1` on both ground bands meant every slot filled,
// at a fixed pitch, for ever. A picket fence. These checks are what stops it
// coming back, because it is not a thing a screenshot of one frame shows.

/** Runs of consecutive filled slots, and of consecutive gaps. */
function runs(name: BandName, from: number, to: number): { filled: number[]; gaps: number[] } {
    const out = { filled: [] as number[], gaps: [] as number[] };
    let run = 0;
    let on = pieceAt(BANDS[name], from) !== null;
    for (let i = from; i < to; i++) {
        const now = pieceAt(BANDS[name], i) !== null;
        if (now === on) { run++; continue; }
        (on ? out.filled : out.gaps).push(run);
        on = now; run = 1;
    }
    (on ? out.filled : out.gaps).push(run);
    return out;
}

t('the city clumps — dense stretches, then thin ones', () => {
    // Count filled slots in windows of eight. If every window holds the same
    // number, the band is still a fence however the pieces are dealt.
    for (const name of ['towers', 'lowrise'] as const) {
        const windows: number[] = [];
        for (let w = 0; w < 120; w++) {
            let n = 0;
            for (let i = w * 8; i < w * 8 + 8; i++) if (pieceAt(BANDS[name], i)) n++;
            windows.push(n);
        }
        const hi = Math.max(...windows), lo = Math.min(...windows);
        assert.ok(hi - lo >= 5,
            `${name}: every window of 8 slots holds ${lo}..${hi} buildings — that is a fence`);
        // And the spread is a spread, not one outlier: at least a fifth of
        // windows are near-solid and at least a fifth are near-empty.
        const dense = windows.filter(n => n >= 7).length;
        const thin = windows.filter(n => n <= 3).length;
        assert.ok(dense >= windows.length / 5, `${name}: only ${dense}/${windows.length} windows are dense`);
        assert.ok(thin >= windows.length / 5, `${name}: only ${thin}/${windows.length} windows are thin`);
    }
});

t('runs of one building and runs of four or more both happen', () => {
    for (const name of ['towers', 'lowrise'] as const) {
        const r = runs(name, -400, 400);
        assert.ok(r.filled.includes(1), `${name}: never a lone building`);
        assert.ok(r.filled.some(n => n >= 4), `${name}: never a terrace`);
        assert.ok(r.gaps.some(n => n >= 2), `${name}: never more than one slot of open sky`);
    }
});

t('the clumping does not keep step with the screen', () => {
    // If the clump wavelength lands near the number of slots a screen shows,
    // every screenful gets its clump in the same place and the fence is back
    // with a wobble in it. Both waves have to be several screens long.
    for (const name of ['towers', 'lowrise'] as const) {
        const c = BANDS[name].clump!;
        const perScreen = slotsPerScreen(BANDS[name], 320);
        for (const [label, f] of [['long', c.f1], ['short', c.f2]] as const) {
            const wavelength = (Math.PI * 2) / f;
            assert.ok(wavelength > perScreen * 2.5,
                `${name}: the ${label} wave repeats every ${wavelength.toFixed(1)} slots `
                + `and a screen shows ${perScreen.toFixed(1)}`);
        }
        // ...and the two waves must not be the same wave.
        assert.ok(Math.abs(c.f1 / c.f2 - Math.round(c.f1 / c.f2)) > 0.1,
            `${name}: the two clump waves are harmonics — they will beat as one`);
    }
});

t('the two ground bands do not thin out together', () => {
    // A hole in the towers behind a hole in the lowrise is a hole in the city.
    let bothThin = 0;
    for (let i = 0; i < 600; i++) {
        // Same world x, each band in its own slot units.
        const x = i * 10;
        const a = clumpAt(BANDS.towers.clump!, x / BANDS.towers.spacing);
        const b = clumpAt(BANDS.lowrise.clump!, x / BANDS.lowrise.spacing);
        if (a < 0.35 && b < 0.35) bothThin++;
    }
    assert.ok(bothThin / 600 < 0.1, `${(bothThin / 6).toFixed(0)}% of the horizon is thin in both bands at once`);
});

t('buildings vary in height, not only in presence', () => {
    // A clumped row of identical 40px towers is still a ruled line.
    for (const name of ['towers', 'lowrise'] as const) {
        const sizes = new Set<number>();
        let lo = 1, hi = 0;
        for (let i = 0; i < 400; i++) {
            const p = pieceAt(BANDS[name], i);
            if (!p) continue;
            const k = sizeAt(BANDS[name], i);
            lo = Math.min(lo, k); hi = Math.max(hi, k);
            sizes.add(Math.round(p.h * k));
        }
        assert.ok(sizes.size >= 8, `${name}: only ${sizes.size} distinct drawn heights`);
        assert.ok(hi - lo > 0.25, `${name}: drawn size only spans ${lo.toFixed(2)}..${hi.toFixed(2)}`);
        assert.ok(lo > 0.4, `${name}: something is drawn at ${lo.toFixed(2)} of its size`);
    }
});

// ---------------------------------------------------------------------------
// Nothing floats
// ---------------------------------------------------------------------------

t('rooftop clutter stands on an actual roof', () => {
    // Clutter used to be placed independently of the buildings under it, which
    // was harmless only while the lowrise band had no gaps. Now it has gaps,
    // and an aerial over one of them is an aerial hanging in the sky.
    const roof = BANDS.rooftop;
    const host = BANDS.lowrise;
    assert.equal(roof.roofOf, 'lowrise');
    assert.equal(roof.factor, host.factor, 'the clutter would slide off the roof it was placed on');
    let checked = 0;
    for (let i = -500; i < 500; i++) {
        if (!pieceAt(roof, i)) continue;
        checked++;
        const hostSlot = Math.floor((i * roof.spacing) / host.spacing);
        assert.ok(pieceAt(host, hostSlot), `clutter at slot ${i} is over open sky`);
    }
    assert.ok(checked > 100, `only ${checked} pieces of clutter in a thousand slots`);
});

t('clutter sits on the roof it was dealt onto, whatever size it came out', () => {
    // The host varies in drawn height, so a fixed baseline would bury the
    // clutter on a tall building and float it over a short one.
    const seen = new Set<number>();
    for (const scroll of [0, 900, 4300]) {
        const hosts = new Map(layoutBand('lowrise', scroll, 352).map(p => [p.slot, p]));
        for (const p of layoutBand('rooftop', scroll, 352)) {
            const h = hosts.get(Math.floor((p.slot * BANDS.rooftop.spacing) / BANDS.lowrise.spacing));
            assert.ok(h, `clutter at slot ${p.slot} has no building under it`);
            const roofTop = h!.y - h!.h;
            assert.ok(Math.abs(p.y - (roofTop + 1)) < 0.001,
                `clutter stands at y${p.y} on a roof at y${roofTop}`);
            seen.add(p.y);
        }
    }
    assert.ok(seen.size > 4, 'every roof came out at the same height');
});

console.log(`\n${pass} skyline checks passed.\n`);
