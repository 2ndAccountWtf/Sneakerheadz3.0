/**
 * A lazily-loaded chunk has three outcomes, and the third is the one that
 * stranded Flight 404 on "Boarding…" forever while the rest of the app worked:
 * it can never settle.
 *
 * The scene module was loaded with a bare `.then` and nothing on the failure
 * side, so a chunk that 404'd left the factory null, PhaserHost was never
 * mounted, and the error handling that does exist lived inside the component
 * that never got to run. A chunk that simply never answers produced the same
 * screen with not even an unhandled rejection to go on.
 *
 * On a static host neither is exotic: a page held open across a deploy is
 * pointing at chunk hashes the CDN has already replaced, so the first thing
 * fetched lazily after that is gone.
 */
import assert from 'node:assert/strict';
import { loadChunk } from '../components/minigames/phaser/chunkLoad.ts';

let checks = 0;
const ok = (c: unknown, m: string) => { assert.ok(c, m); checks++; };
const eq = (a: unknown, b: unknown, m: string) => { assert.deepEqual(a, b, m); checks++; };

{
    // The ordinary case has to stay ordinary.
    const v = await loadChunk(async () => ({ mod: 1 }), 'x');
    eq(v, { mod: 1 }, 'a chunk that arrives resolves with its module');
}
{
    // A rejection has to stay a rejection rather than being swallowed, which is
    // what `void p.then(fn)` did to it.
    let msg = '';
    await loadChunk(() => Promise.reject(new Error('404')), 'the scene module')
        .catch((e: Error) => { msg = e.message; });
    eq(msg, '404', 'a failing chunk rejects with its own error');
}
{
    // A non-Error rejection still arrives as an Error, so callers can read
    // `.message` without guarding. Vite has thrown strings here before.
    let e: unknown = null;
    await loadChunk(() => Promise.reject('gone'), 'the scene module').catch((x) => { e = x; });
    ok(e instanceof Error, 'a string rejection is wrapped in an Error');
    eq((e as Error).message, 'gone', '...keeping the original text');
}
{
    // The one that matters: never settling becomes a rejection.
    const started = Date.now();
    let msg = '';
    await loadChunk(() => new Promise(() => { /* never */ }), 'the Phaser engine', 60)
        .catch((x: Error) => { msg = x.message; });
    ok(/did not arrive/.test(msg), 'a chunk that never answers rejects on the timeout');
    ok(/Phaser engine/.test(msg), '...naming which chunk, because the console is the only clue');
    ok(Date.now() - started < 2000, '...promptly, rather than hanging the caller');
}
// The two blocks below document behaviour rather than guard it: once a promise
// has settled, the spec makes every later resolve and reject a no-op, so they
// pass with the `settled` flag removed. They are here because "does a late
// arrival overturn the fallback the player is already looking at" is the first
// thing anyone reading this will want to know, and the answer should be written
// down rather than re-derived. What the flag does earn is the `clearTimeout`,
// which stops a dangling timer.
{
    // A chunk that lands just inside the window must not then be killed by its
    // own timer.
    let late: unknown = null;
    const v = await loadChunk(
        () => new Promise((res) => setTimeout(() => res('ok'), 20)),
        'x', 300,
    ).catch((e) => { late = e; return 'rejected'; });
    eq(v, 'ok', 'a chunk that lands inside the window resolves');
    eq(late, null, '...and its timer does not fire afterwards');
    // Outlive the original timeout to be sure nothing arrives late.
    await new Promise((r) => setTimeout(r, 400));
    eq(late, null, 'still nothing after the window has passed');
}
{
    // Symmetrically, a timeout must not be overturned by a chunk that finally
    // shows up: the fallback has already rendered by then.
    let second: unknown = null;
    const first = await loadChunk(
        () => new Promise((res) => setTimeout(() => res('late'), 200)),
        'x', 40,
    ).then((v) => v, (e: Error) => e.message);
    ok(/did not arrive/.test(String(first)), 'the timeout wins when it fires first');
    await new Promise((r) => setTimeout(r, 400));
    eq(second, null, 'the late arrival does not settle the promise a second time');
}

console.log(`chunk-load: ${checks} checks OK`);
