/**
 * Nothing may hit you that you were never shown.
 *
 * The thrower fired at anything within 215 world units of the player. The camera
 * shows 352 and keeps the player near the middle, so its visible half-width is
 * about 176 — meaning for roughly forty units either side he was throwing from
 * off the edge of the screen. Food arrived from nowhere, there was nothing to
 * dodge because there was nothing to see, and the only counterplay was to walk
 * backwards until it stopped. That is not difficulty, it is a tax on not knowing.
 *
 * The rule is enforced inside `hostileShot`, which every enemy and the boss go
 * through, rather than at each of the five places that fire — the one that gets
 * forgotten is the one the player notices. This checks the arithmetic of that
 * rule against the real view size.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VIEW_W, VIEW_H, NOTICE_RANGE } from '../components/minigames/phaser/flight404/content.ts';

let checks = 0;
const ok = (c: unknown, m: string) => { assert.ok(c, m); checks++; };
const eq = (a: unknown, b: unknown, m: string) => { assert.deepEqual(a, b, m); checks++; };

/** `onCamera`, isolated. The camera is centred on the player. */
const view = (px: number) => ({ x: px - VIEW_W / 2, right: px + VIEW_W / 2, y: 0, bottom: VIEW_H });
const onCamera = (px: number, x: number, y: number, margin = 18) => {
    const v = view(px);
    return x > v.x + margin && x < v.right - margin && y > v.y - 8 && y < v.bottom + 8;
};

{
    // The regression, as arithmetic: the old range reached past the screen.
    const halfView = VIEW_W / 2;
    ok(215 > halfView, `the old 215-unit range exceeded the ${halfView}-unit half view`);
    ok(215 - halfView > 30, 'and by enough to matter — about forty units of invisible attacker');
}
{
    // A thrower beyond the edge cannot fire, at any height.
    const px = 500;
    for (const y of [40, 100, 164]) {
        ok(!onCamera(px, px + VIEW_W / 2 + 1, y), `off the right edge cannot fire (y=${y})`);
        ok(!onCamera(px, px - VIEW_W / 2 - 1, y), `off the left edge cannot fire (y=${y})`);
        ok(!onCamera(px, px + 200, y), 'the old 200-unit shot is now refused');
    }
}
{
    // Nor from the very edge: the margin buys time to read the wind-up before
    // the throw lands, which is the whole contract.
    const px = 500;
    ok(!onCamera(px, px + VIEW_W / 2 - 4, 120), 'a thrower on the very edge cannot fire');
    ok(onCamera(px, px + VIEW_W / 2 - 40, 120), 'one properly in shot can');
}
{
    // And it does not disarm anybody the player can plainly see. A mook at
    // noticing range is well inside the view, so ordinary fights are untouched.
    const px = 500;
    ok(onCamera(px, px + NOTICE_RANGE - 10, 140), 'a mook at noticing range can still fight');
    ok(onCamera(px, px - NOTICE_RANGE + 10, 140), '...from either side');
    ok(onCamera(px, px, 164), 'point blank is fine');
}
{
    // Vertically the allowance is generous, because a thrower stands in an
    // overhead bin above the top of the world box and is plainly visible there.
    const px = 500;
    ok(onCamera(px, px, -5), 'a thrower perched above the world box still counts as seen');
    ok(!onCamera(px, px, -40), 'something far above the screen does not');
}
{
    // The guard is in the shared path, not sprinkled. If someone adds a sixth
    // way to fire, it is covered by construction.
    const src = readFileSync('components/minigames/phaser/flight404/gameScene.ts', 'utf8');
    const start = src.indexOf('private hostileShot(');
    ok(start > 0, 'hostileShot is where this test thinks it is');
    const head = src.slice(start, start + 1600);
    ok(/onCamera\(x, y, 0\)/.test(head), 'hostileShot itself refuses an off-camera origin');
    // ...and it refuses before taking a sprite from the pool, or a refused shot
    // still costs one and the pool starves under fire.
    ok(head.indexOf('onCamera') < head.indexOf('this.hostiles.get'),
        'the guard runs before a projectile is taken from the pool');
}

console.log(`hostile-fire: ${checks} checks OK`);
