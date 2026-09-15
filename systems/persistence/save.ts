/**
 * Saving the run, and remembering the good ones.
 *
 * Nothing in this game has ever persisted. It is a thirty-day run, mostly
 * played on a phone, and closing the tab on day 22 destroyed all of it. That
 * is not a missing feature so much as a hostile one — nobody finishes thirty
 * days in one sitting on a phone, so in practice almost nobody finished at
 * all. And the ending computes a net worth, a multiplier on the stake, a
 * letter grade and a cred rank, and then throws every one of them away, so
 * there has never been anything to beat.
 *
 * Both are fixed here, in the only storage a static site has.
 *
 * Three rules this module holds to:
 *
 *   1. **Storage is allowed to fail.** Private windows, cleared site data,
 *      quota, an iframe with third-party storage blocked — every call is
 *      wrapped, and a failure means the game carries on unsaved rather than
 *      dying. A save system that can crash the game is worse than none.
 *   2. **An old save never breaks a new build.** The shape changes as the game
 *      does. A version mismatch discards rather than migrates, because a
 *      half-migrated save is a bug you get to debug through somebody else's
 *      localStorage.
 *   3. **Reloading is not an escape hatch.** A stop in progress is saved with
 *      everything else, so refreshing the page mid-bust puts you back in front
 *      of the same officer.
 */

const SAVE_KEY = 'sdw:run:v1';
const SCORES_KEY = 'sdw:scores:v1';

/**
 * Bumped whenever the *run* shape changes incompatibly.
 *
 * v2: `mood` and `cleanliness` left the player. Both were write-only — items
 * moved them, the stats screen drew them, and no rule ever read either — so
 * they were cut rather than given a job. A v1 run carries two fields the game
 * no longer has, and per rule 2 above that is a discard, not a migration.
 */
export const SAVE_VERSION = 2;

/**
 * The scoreboard versions separately, because `RunScore` has not changed and a
 * run-shape bump has no business wiping somebody's personal best.
 */
export const SCORES_VERSION = 1;

/** How many finished runs to keep. Enough to see a personal best move. */
export const MAX_SCORES = 25;

interface Envelope<T> {
    v: number;
    at: number;
    data: T;
}

/* ------------------------------------------------------------------ *
 * Storage that is allowed to be missing
 * ------------------------------------------------------------------ */

function store(): Storage | null {
    try {
        const s = globalThis.localStorage;
        // Presence is not availability: Safari's private mode throws on write.
        const probe = '__sdw_probe__';
        s.setItem(probe, '1');
        s.removeItem(probe);
        return s;
    } catch {
        return null;
    }
}

function read<T>(key: string, version: number): T | null {
    const s = store();
    if (!s) return null;
    try {
        const raw = s.getItem(key);
        if (!raw) return null;
        const env = JSON.parse(raw) as Envelope<T>;
        if (!env || typeof env !== 'object' || env.v !== version) return null;
        return env.data ?? null;
    } catch {
        return null;       // corrupt or hand-edited: treat as absent
    }
}

function write<T>(key: string, version: number, data: T): boolean {
    const s = store();
    if (!s) return false;
    try {
        s.setItem(key, JSON.stringify({ v: version, at: Date.now(), data } satisfies Envelope<T>));
        return true;
    } catch {
        return false;      // over quota, or storage went away mid-session
    }
}

/* ------------------------------------------------------------------ *
 * The run in progress
 * ------------------------------------------------------------------ */

/**
 * `unknown` rather than `GameState` on purpose. This module must not import
 * the game's types, or every shape change drags the save layer along with it;
 * the reducer is the one place that knows what a state looks like, and it is
 * the one place that casts.
 */
export const saveRun = (state: unknown): boolean => write(SAVE_KEY, SAVE_VERSION, state);

export const loadRun = <T>(): T | null => read<T>(SAVE_KEY, SAVE_VERSION);

export function clearRun(): void {
    const s = store();
    try { s?.removeItem(SAVE_KEY); } catch { /* nothing to do about it */ }
}

/** Whether there is a run waiting, without paying to deserialize all of it. */
export const hasSavedRun = (): boolean => {
    const s = store();
    try { return !!s?.getItem(SAVE_KEY); } catch { return false; }
};

/* ------------------------------------------------------------------ *
 * The runs that finished
 * ------------------------------------------------------------------ */

export interface RunScore {
    /** Cash plus the bag, at the end. The number the board is sorted on. */
    netWorth: number;
    /** What it was against the stake — 4.2 reads better than a raw total. */
    multiple: number;
    /** Letter grade from `data/ranks.ts`. */
    grade: string;
    /** Days used. A run can overrun 30 via naps and hospital stays. */
    days: number;
    streetCred: number;
    /** Epoch millis, so the board can show "today" versus "last week". */
    endedAt: number;
    /** Optional: what the player called themselves. */
    name?: string;
}

export const loadScores = (): RunScore[] => read<RunScore[]>(SCORES_KEY, SCORES_VERSION) ?? [];

/**
 * File a finished run. Returns the board and whether this run topped it, so
 * the end screen can say "best run yet" without recomputing anything.
 */
export function recordScore(score: RunScore): { scores: RunScore[]; isBest: boolean } {
    const previous = loadScores();
    const previousBest = previous[0]?.netWorth ?? -Infinity;
    const scores = [...previous, score]
        .sort((a, b) => b.netWorth - a.netWorth)
        .slice(0, MAX_SCORES);
    write(SCORES_KEY, SCORES_VERSION, scores);
    return { scores, isBest: score.netWorth > previousBest };
}

export const bestScore = (): RunScore | null => loadScores()[0] ?? null;

export function clearScores(): void {
    const s = store();
    try { s?.removeItem(SCORES_KEY); } catch { /* nothing to do about it */ }
}
