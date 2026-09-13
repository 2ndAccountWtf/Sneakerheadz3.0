/**
 * Seeded randomness, in one place.
 *
 * Five modules had each copy-pasted the same FNV-1a hash and the same
 * mulberry32 generator — four of them byte-identical, the fifth an
 * algebraically equivalent rewrite (verified stream-for-stream over 30,000
 * draws before they were merged, so no shelf, schedule or calendar changed
 * when they moved here).
 *
 * The reason the recipe keeps getting copied is that it is load-bearing for a
 * design rule this game keeps running into: **a world that re-rolls cannot be
 * learned, and a world that cannot be learned cannot be played well.** If the
 * Tel Aviv branch stocks burekas today it has to stock them tomorrow; if the
 * calendar says the Long Beach expo is on day 14, it has to still say that
 * when you check on day 12. Anything built on `Math.random()` fails that
 * quietly — it looks fine in a screenshot and falls apart the moment a player
 * tries to plan around it, or simply walks off a screen and back.
 *
 * So: derive a seed from the things that should determine the outcome (a city
 * id, a day number, an npc id), and the same inputs always give the same
 * world.
 */

/** FNV-1a. Turns any string key into a 32-bit seed. */
export function hashString(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** mulberry32 — a small, fast PRNG. The same seed always yields the same run. */
export function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Seed straight from a key, for the common `seeded(hashString(k))` case. */
export const rngFor = (key: string): (() => number) => seeded(hashString(key));

/**
 * Fisher-Yates, on a copy.
 *
 * Worth having by name because the thing it replaces — `arr.sort(() => 0.5 -
 * Math.random())` — looks like a shuffle, is one line shorter, and is not
 * uniform. Measured on a twelve-entry list picking four: the first entry came
 * up 1.35x as often as it should and the ninth 0.79x, a 1.7x gap between the
 * commonest and the rarest. For a list of authored content that means the
 * lines written last are the lines players rarely see, which is a content bug
 * wearing a randomness costume.
 */
export function shuffled<T>(arr: readonly T[], rng: () => number): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * `n` distinct entries, fairly chosen. Returns fewer only if the source is
 * smaller than `n` — never the same entry twice, which is the whole point:
 * drawing independently with `getRandom` in a loop guarantees repeats long
 * before it exhausts the pool, and a feed that posts the same joke twice on
 * one screen reads as broken software rather than as randomness.
 */
export const sampleWithout = <T>(arr: readonly T[], n: number, rng: () => number): T[] =>
    shuffled(arr, rng).slice(0, Math.max(0, n));
