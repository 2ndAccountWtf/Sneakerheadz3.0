/**
 * Camera shake must not change when the render resolution does.
 *
 * Phaser's `shake(duration, intensity)` does not take a fraction of the screen,
 * though it reads like one. `Shake.js` computes the per-frame offset as
 *
 *     offset = (random * intensity * camera.width * 2 - intensity * camera.width) * camera.zoom
 *
 * so the visible displacement, as a share of the canvas, is `intensity * zoom`
 * — the camera's width and the canvas width are the same number, and cancel.
 * Raising the render multiple from 3 to 6 therefore doubled every shake in the
 * game without touching a single intensity. The heavy ones landed at twelve per
 * cent of the screen, re-randomised every frame, which next to the red damage
 * flash does not read as a hit, it reads as a broken screen.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ZOOM } from '../components/minigames/phaser/flight404/content.ts';

let checks = 0;
const ok = (c: unknown, m: string) => { assert.ok(c, m); checks++; };
const eq = (a: unknown, b: unknown, m: string) => { assert.deepEqual(a, b, m); checks++; };

/** Phaser's own arithmetic, at its worst point in the random range. */
const screenShare = (intensity: number, zoom: number) => intensity * zoom;

/** What `quake` passes on, given an amount expressed as a share of the screen. */
const quake = (amount: number, zoom: number) => amount / zoom;

const SRC = readFileSync('components/minigames/phaser/flight404/gameScene.ts', 'utf8');

{
    // The regression, stated as arithmetic: same intensity, two render
    // multiples, twice the shake.
    eq(screenShare(0.02, 6) / screenShare(0.02, 3), 2,
        'a raw intensity doubles when the render multiple doubles');
}
{
    // And the fix: an amount expressed as a share of the screen survives it.
    for (const zoom of [3, 4, 6, 8]) {
        const seen = screenShare(quake(0.06, zoom), zoom);
        ok(Math.abs(seen - 0.06) < 1e-9, `6% of the screen stays 6% at zoom ${zoom}`);
    }
}
{
    // The heaviest shake in the game, at the resolution actually shipping.
    // 6% of the screen is a hit; 12% is the fault this replaced.
    const heaviest = screenShare(quake(0.06, ZOOM), ZOOM);
    ok(heaviest <= 0.07, `the heaviest shake stays at ~6% of the screen (got ${(heaviest * 100).toFixed(1)}%)`);
}
{
    // The helper is only useful if everything goes through it. A raw call is
    // the whole bug, and it is one autocomplete away.
    const raw = SRC.match(/cameras\.main\.shake\(/g) ?? [];
    eq(raw.length, 1, 'exactly one raw shake call — the one inside `quake`');
    ok(/private quake\([\s\S]*?shake\(duration, amount \/ ZOOM\)/.test(SRC),
        'the single raw call is the helper, and it divides by the zoom');

    // Every call site passes a share of the screen, so none should look like a
    // raw Phaser intensity. Anything at or below 2% is a number that was never
    // converted.
    const amounts = [...SRC.matchAll(/this\.quake\(\d+,\s*([0-9.]+)\)/g)].map(m => +m[1]);
    ok(amounts.length >= 9, `every shake site converted (found ${amounts.length})`);
    for (const a of amounts) {
        ok(a > 0.005 && a <= 0.12, `${a} is a plausible share of the screen, not a raw intensity`);
    }
}

console.log(`screen-shake: ${checks} checks OK`);
