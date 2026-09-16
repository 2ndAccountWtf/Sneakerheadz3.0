/**
 * The art -> screen chain: how many device pixels a source pixel gets.
 *
 * This guards the two settings that decided whether delivered art survives the
 * trip to the screen, both of which were wrong at the same time and neither of
 * which any existing test could see:
 *
 *   1. the canvas backing store was sized `logical * devicePixelRatio`, which
 *      is not the size the canvas occupies, so the compositor magnified the
 *      finished picture by ~2x with nearest neighbour;
 *   2. every art draw was nearest neighbour, including the ones shrinking a
 *      detailed illustration, which drops source rows rather than mixing them.
 *
 * Measured end to end against an ideal single resample, the pair cost 32.5 mean
 * channel error; fixing both brought it to 7.2. Neither alone got below 19.5,
 * which is why both are tested here.
 */
import assert from 'node:assert/strict';

let checks = 0;
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); checks++; };
const eq = (a: unknown, b: unknown, msg: string) => { assert.deepEqual(a, b, msg); checks++; };

// ---------------------------------------------------------------------------
// 1. Backing store sizing.
// ---------------------------------------------------------------------------
/**
 * The sizing rule out of `GameCanvas.resize`, isolated so it can be checked
 * without a DOM. Kept deliberately literal: if the component's arithmetic
 * changes, this stops agreeing with it and someone has to look at both.
 */
const MAX_STORE_SCALE = 8;
function storeFor(logicalW: number, logicalH: number, cssW: number, dpr: number) {
    const scale = Math.min((cssW * dpr) / logicalW, MAX_STORE_SCALE);
    return { scale, w: Math.max(1, Math.round(logicalW * scale)), h: Math.max(1, Math.round(logicalH * scale)) };
}

{
    // iPhone 14/15 held sideways, fullscreen: 844x390 CSS at dpr 3. The canvas
    // is `object-fit: contain` at 16:9, so height binds: 390 tall, 693.3 wide.
    const s = storeFor(320, 180, 390 * (16 / 9), 3);
    eq(s.w, 2080, 'phone fullscreen backing store is the real device width');
    ok(s.scale > 6.4 && s.scale < 6.6, 'phone fullscreen draws at ~6.5 device px per logical px');

    // The old rule produced 320*3 = 960 and left the compositor to stretch it.
    ok(s.w / (320 * 3) > 2, 'the old dpr rule was magnifying by more than 2x here');
}
{
    // A desktop column, dpr 2.
    const s = storeFor(320, 180, 900, 2);
    eq(s.w, 1800, 'desktop backing store is the real device width');
    eq(s.h, Math.round(180 * s.scale), 'height follows the same scale as width');
    // Same aspect ratio as the logical grid, or the picture is stretched.
    ok(Math.abs(s.w / s.h - 320 / 180) < 0.01, 'store keeps the logical aspect ratio');
}
{
    // A 5K monitor would ask for 5120 device px of a 320px game. There is
    // nothing there to show, so the store is capped.
    const s = storeFor(320, 180, 2560, 2);
    eq(s.scale, MAX_STORE_SCALE, 'the store scale is capped');
    eq(s.w, 2560, 'the cap still gives a generous store');
}
{
    // Before layout the box measures zero; the fallback has to be sane, not 1px.
    const s = storeFor(320, 180, 320, 1);
    eq(s.w, 320, 'pre-layout fallback is the logical grid');
    ok(s.w >= 1 && s.h >= 1, 'store is never degenerate');
}

// ---------------------------------------------------------------------------
// 2. Per-draw filtering.
// ---------------------------------------------------------------------------
/** `ctx.getTransform().a` is the only thing `smoothFor` reads off the context. */
const at = (scale: number) => ({ getTransform: () => ({ a: scale }) } as unknown as CanvasRenderingContext2D);

const { smoothFor, ART_SCALE, tileSize } = await import('../components/minigames/engine/streetArt.ts');

{
    // The case that was destroying the art: a 272px car (the brief's 8x export)
    // asked for 34 logical px on a phone in fullscreen. 34 * 6.5 = 221 device
    // px, so 272 source pixels have to become 221 -- a downscale, and nearest
    // neighbour would simply discard 19% of the rows.
    ok(smoothFor(at(6.5), 272, 34), 'shrinking a detailed source is filtered');

    // The same draw inline on a phone, where the picture is much smaller and
    // the shrink is far harsher, is filtered too.
    ok(smoothFor(at(2), 272, 34), 'a harsher shrink is filtered');
}
{
    // Magnifying stays nearest: that is the chunky arcade look, and it is what
    // keeps delivered art consistent with the coded sprites beside it, which
    // have no choice.
    ok(!smoothFor(at(6.5), 102, 34), 'today\'s 3x art, magnified, stays nearest');
    ok(!smoothFor(at(8), 102, 34), 'a larger magnify stays nearest');
}
{
    // 1:1 -- what the brief aims for -- must land on the nearest side, or
    // rounding smears a draw that had nothing to gain.
    ok(!smoothFor(at(8), 272, 34), 'an exact 1:1 draw is not filtered');
    // ...and stays there under a hair of floating point noise either way.
    ok(!smoothFor(at(8.0001), 272, 34), '1:1 plus epsilon is not filtered');
    ok(!smoothFor(at(7.9999), 272, 34), '1:1 minus epsilon is not filtered');
}
{
    // The decision is about device pixels, not logical ones. Same source, same
    // logical width, opposite answers -- which is the whole reason it cannot be
    // a constant.
    const src = 272, dest = 34;
    ok(smoothFor(at(4), src, dest) !== smoothFor(at(8), src, dest),
        'the same draw is filtered or not depending on the transform');
}
{
    // A degenerate transform must not throw or flip the default.
    ok(!smoothFor({ getTransform: () => ({ a: 0 }) } as unknown as CanvasRenderingContext2D, 102, 102),
        'a zero transform falls back to 1 and stays nearest');
}
// ---------------------------------------------------------------------------
// 3. Tile sizing survives the re-export.
// ---------------------------------------------------------------------------
{
    // The whole point: the same surface, delivered at either multiple, has to
    // lay down the same amount of road. A global divisor could not do this --
    // it made the brief's export multiple part of the engine, so raising the
    // brief from 3x to 8x would have made every road 2.7x too coarse silently.
    eq(tileSize('road-asphalt', 192, 54), [64, 18], 'asphalt at the old 3x export');
    eq(tileSize('road-asphalt', 512, 144), [64, 18], 'asphalt at the new 8x export');
    eq(tileSize('kerb', 96, 15), [32, 5], 'kerb at 3x');
    eq(tileSize('kerb', 256, 40), [32, 5], 'kerb at 8x');

    // Every tiling id the two games actually call `tile` with must be named, or
    // it silently falls through to the divisor this exists to replace.
    for (const id of ['road-asphalt', 'road-centreline', 'road-edgeline', 'kerb',
                      'pavement', 'grass-verge', 'fence-picket', 'hedge-low', 'wall-breeze']) {
        const a = tileSize(id, 96, 24), b = tileSize(id, 256, 64);
        eq(a, b, `${id} is pinned to a logical size, not to its file size`);
    }

    // An unlisted id still has to produce something sane rather than throw.
    eq(tileSize('not-a-real-tile', 96, 24), [96 / ART_SCALE, 24 / ART_SCALE],
        'an unknown tile falls back to the export multiple');
    ok(ART_SCALE > 0, 'the fallback multiple is set');
}



// ---------------------------------------------------------------------------
// 4. Flight 404: render resolution and art scale are different numbers.
// ---------------------------------------------------------------------------
{
    const f404 = await import('../components/minigames/phaser/flight404/content.ts');
    const { VIEW_W, RENDER_W, ZOOM, ART_SCALE } = f404;

    // The canvas has to reach the screen. A phone held sideways shows the game
    // across 2080 device pixels; at the old x3 the canvas was 1056 and the
    // compositor stretched it 1.97x -- a fractional nearest-neighbour magnify,
    // which is the exact artefact this constant exists to avoid, just moved one
    // step later in the pipeline.
    ok(RENDER_W >= 2080, 'the canvas is at least as wide as a phone in landscape');

    // Whole-number or the pixel grid goes uneven: at 2.727 device pixels per
    // source pixel, some come out 3 wide and some 2.
    eq(ZOOM, Math.round(ZOOM), 'the render multiple is a whole number');
    eq(RENDER_W, VIEW_W * ZOOM, 'the camera zoom is exactly the canvas multiple');

    // The one that would have broken the whole cast silently. These were a
    // single constant; raising the render multiple with them joined makes every
    // delivered file read as half its real size, because the code asks "how many
    // pixels does this file have per world unit" and gets told the render
    // number instead.
    ok(ART_SCALE !== ZOOM, 'art scale and render zoom are separate numbers');
    eq(ART_SCALE, 3, 'the delivered set is authored at 3x');

    // Raising ZOOM is free only while it stays a whole multiple of ART_SCALE --
    // then the delivered art is doubled by an exact integer and nearest
    // neighbour is lossless. 6/3 is 2.
    eq(ZOOM % ART_SCALE, 0, 'the render multiple is a whole multiple of the art scale');

    // `fitScale` is what `skin.ts` and `gameScene.artSize` run. Whatever
    // multiple a file was delivered at, it has to read back at its world size,
    // because the delivered set is mixed -- the aisle props are at 1x, the
    // side-view seat rows at 3x -- and a re-export lands one folder at a time.
    const { fitScale } = f404;
    const H = 30;
    for (const n of [1, 2, 3, 4, 6, 8]) {
        eq(fitScale(H * n, H) * (H * n), H, `art delivered at ${n}x reads back at its world height`);
    }

    // The trap this replaced: a two-way guess against one constant. With
    // candidates {1, 1/3} a 6x file reads as half size; with {1, 1/6} a 3x file
    // does. Both are silent -- the cast just draws small.
    const twoWay = (texH: number, want: number, k: number) =>
        Math.abs(texH - want) <= Math.abs(texH / k - want) ? 1 : 1 / k;
    ok(twoWay(H * 6, H, 3) * (H * 6) !== H, 'the old two-way guess got a 6x file wrong');
    ok(fitScale(H * 6, H) * (H * 6) === H, '...and fitScale gets it right');

    // Degenerate inputs are the coded-placeholder case: no natural size, so
    // fill the box you were given rather than scaling by a guess.
    eq(fitScale(0, H), 1, 'a texture with no height scales by 1');
    eq(fitScale(H, 0), 1, 'a zero expected height scales by 1');

    // An off-grid file still lands on its nearest candidate rather than
    // throwing or returning something wild.
    const odd = fitScale(H * 3.2, H);
    ok(odd > 0 && odd <= 1, 'an off-grid delivery still returns a sane scale');
}

console.log(`render-scale: ${checks} checks OK`);
