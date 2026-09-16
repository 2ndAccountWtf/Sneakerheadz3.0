/**
 * Load a code-split chunk so that it always lands somewhere.
 *
 * A dynamic import has three outcomes, not two, and the third is the one that
 * produced "Flight 404 stuck on loading forever" while the rest of the app was
 * fine: it can **never settle**. A `.then` with no `.catch` turns a rejection
 * into the same thing — the state it was going to set is simply never set, no
 * error is rendered, and every fallback downstream is waiting on a flag that
 * will not arrive.
 *
 * On a static host this is not exotic. A page open across a deploy holds an
 * `index.html` naming chunk hashes the CDN has already replaced, so the first
 * lazily-fetched chunk 404s. The app itself keeps working — it is already in
 * memory — and only the part that had not been fetched yet dies, which is
 * exactly the shape of the report. A stalled connection gives the same result
 * without even the 404.
 *
 * So: reject on a timeout as well, and make the caller handle rejection.
 */
export function loadChunk<T>(load: () => Promise<T>, label: string, ms = 20000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error(`${label} did not arrive within ${Math.round(ms / 1000)}s`));
        }, ms);
        const done = (fn: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fn();
        };
        load().then(
            (v) => done(() => resolve(v)),
            (e) => done(() => reject(e instanceof Error ? e : new Error(String(e)))),
        );
    });
}
