/**
 * Hype calendar.
 *
 * Turns the authored templates in `data/hypeEvents.ts` into an actual
 * schedule: which events fire this run, in which city, on which days. This
 * is the one place that decides dates, so it is the one place that has to
 * guarantee the calendar's real design promise — a player who checks in on
 * day 5 can already see "Long Beach Sneakerheadz Expo, day 14" and has nine
 * days to go buy retros for it. An event nobody could have seen coming is
 * worth building nothing around, so the scheduling rules below all exist to
 * protect foresight:
 *
 *   - nothing starts before day 3 (the player needs at least two days of
 *     just playing the game before the first thing to plan around appears);
 *   - no city ever double-books itself;
 *   - at most two events per city, so the per-city collision fix-up below
 *     never has to reason about more than one seam;
 *   - the run always has 5-7 events (never all 13 templates, never a bare
 *     handful), spread across the full 30 days rather than bunched in the
 *     first week; and
 *   - at least one event's window reaches into the final stretch, so a late
 *     push for the endgame is always a real option.
 *
 * Determinism follows the same recipe as `data/ampm/shelfSpecials.ts` and
 * `systems/npc/schedule.ts` (FNV-1a seed → mulberry32): `buildCalendar(seed)`
 * is a pure function and the same seed always produces the same schedule.
 *
 * The wrinkle unique to this module is that `activeHypeEvent(day, cityId)` is
 * a fixed, seed-less contract (`types/hype.ts`), because the street-selling
 * system that consumes it has no reason to know or care about a seed. So this
 * module keeps one module-level "this run's calendar", built once (lazily,
 * from a random seed) and cached — stable across every re-render, exactly
 * like the fixed API promises. What it cannot do, without touching
 * `hooks/useGame.ts` (outside this agent's remit), is notice a `RESET_GAME`
 * and roll a fresh seed for the new run. `reseedHypeCalendar()` is exported
 * for exactly that hand-off: call it once from the `RESET_GAME` case (or
 * anywhere else a new run begins) and every following call to
 * `activeHypeEvent` / `upcomingEvents` / `eventsFor` reflects the new run's
 * calendar immediately. Until that's wired in, the calendar is fixed for the
 * lifetime of the page load, which still satisfies "stable across
 * re-renders" — it just won't reroll on an in-place restart.
 */
import type { HypeEvent } from '../../types/hype';
import { HYPE_EVENT_TEMPLATES, type HypeEventTemplate } from '../../data/hypeEvents';
import { TOTAL_DAYS } from '../../constants';
import { hashString, seeded } from '../../utils/rng';



/** Nothing runs before this day — the player needs time to see the calendar. */
const MIN_START_DAY = 3;
/** How many of the 13-ish templates fire in any given run. */
const MIN_SELECTED = 5;
const MAX_SELECTED = 7;
/** A city that hosted two events this run doesn't need a third. */
const MAX_PER_CITY = 2;
/** At least one event must reach into this many final days, for an endgame push. */
const ENDGAME_WINDOW = 6;

function clampStart(startDay: number, days: number): number {
    return Math.max(MIN_START_DAY, Math.min(startDay, TOTAL_DAYS - days + 1));
}

/**
 * Pure: the whole schedule for a given seed, and nothing else. This is what
 * makes the calendar testable without touching the module's cached "current
 * run" state at all — same seed in, same array of events out, every time.
 */
export function buildCalendar(seed: number): HypeEvent[] {
    const rng = seeded(hashString(`hype-calendar:${seed}`));

    // Deterministic shuffle (Fisher-Yates) of the template pool, so which
    // events even get a shot at this run's calendar varies by seed.
    const pool = [...HYPE_EVENT_TEMPLATES];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const targetCount = Math.min(
        pool.length,
        MIN_SELECTED + Math.floor(rng() * (MAX_SELECTED - MIN_SELECTED + 1)),
    );

    const perCity: Record<string, number> = {};
    const selected: HypeEventTemplate[] = [];
    for (const tpl of pool) {
        if (selected.length >= targetCount) break;
        const count = perCity[tpl.cityId] ?? 0;
        if (count >= MAX_PER_CITY) continue;
        selected.push(tpl);
        perCity[tpl.cityId] = count + 1;
    }

    // Lay the selected events across the full run: divide the days on which
    // an event is allowed to start (MIN_START_DAY..TOTAL_DAYS) into as many
    // segments as there are events, one per event, then roll a start day
    // inside its own segment. That alone spreads events across the whole 30
    // days instead of letting the RNG clump them by chance.
    const span = TOTAL_DAYS - MIN_START_DAY + 1;
    const n = selected.length;
    const events: HypeEvent[] = selected.map((tpl, i) => {
        const segStart = MIN_START_DAY + Math.floor((i * span) / n);
        const segEnd = MIN_START_DAY + Math.floor(((i + 1) * span) / n) - 1;
        const latestStart = Math.min(segEnd, TOTAL_DAYS - tpl.days + 1);
        const earliestStart = Math.min(segStart, latestStart);
        const roll = earliestStart + Math.floor(rng() * Math.max(1, latestStart - earliestStart + 1));
        return { ...tpl, startDay: clampStart(roll, tpl.days) };
    });

    // Guarantee at least one event reaches into the endgame window. The last
    // segment already lands near the end of the run by construction, so this
    // almost never has to do anything — it's a backstop, not the mechanism.
    const endgameFrom = TOTAL_DAYS - ENDGAME_WINDOW + 1;
    const reachesEndgame = events.some(e => e.startDay + e.days - 1 >= endgameFrom);
    if (!reachesEndgame && events.length > 0) {
        const last = events[events.length - 1];
        last.startDay = clampStart(TOTAL_DAYS - last.days + 1, last.days);
    }

    // Resolve same-city overlaps. With at most two events per city this is
    // never more than one seam: push the later one clear of the earlier one,
    // and if that ran it past day TOTAL_DAYS, give ground on the earlier one
    // instead so both still fit.
    const byCity = new Map<string, HypeEvent[]>();
    for (const e of events) {
        const arr = byCity.get(e.cityId) ?? [];
        arr.push(e);
        byCity.set(e.cityId, arr);
    }
    for (const arr of byCity.values()) {
        if (arr.length < 2) continue;
        arr.sort((a, b) => a.startDay - b.startDay);
        for (let i = 1; i < arr.length; i++) {
            const prev = arr[i - 1];
            const cur = arr[i];
            const prevEnd = prev.startDay + prev.days - 1;
            if (cur.startDay <= prevEnd) {
                cur.startDay = clampStart(prevEnd + 1, cur.days);
            }
        }
        for (let i = arr.length - 2; i >= 0; i--) {
            const cur = arr[i];
            const next = arr[i + 1];
            const curEnd = cur.startDay + cur.days - 1;
            if (curEnd >= next.startDay) {
                cur.startDay = clampStart(next.startDay - cur.days, cur.days);
            }
        }
    }

    return events.sort((a, b) => a.startDay - b.startDay || a.cityId.localeCompare(b.cityId));
}

// --- This run's calendar: built once, cached, reseeded only on request. ---

let currentSeed: number | null = null;
let cachedCalendar: HypeEvent[] | null = null;

function calendar(): HypeEvent[] {
    if (currentSeed === null) {
        // No run identifier is available to a pure module outside React, so
        // the seed is rolled once per page load and cached — stable across
        // every re-render, which is the hard requirement; see the module
        // doc-comment for what would make it vary per in-place restart too.
        currentSeed = Math.floor(Math.random() * 0xffffffff);
    }
    if (!cachedCalendar) cachedCalendar = buildCalendar(currentSeed);
    return cachedCalendar;
}

/**
 * Roll a fresh calendar for a new run (or pin one for tests) and make it the
 * calendar every other export in this module reads from immediately. Safe to
 * call from a `RESET_GAME`-style hand-off once one exists.
 */
export function reseedHypeCalendar(seed?: number): HypeEvent[] {
    currentSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
    cachedCalendar = buildCalendar(currentSeed);
    return cachedCalendar;
}

/** What a city's scene is doing on this exact day, if anything. */
export function activeHypeEvent(day: number, cityId: string): HypeEvent | null {
    return calendar().find(e => e.cityId === cityId && day >= e.startDay && day <= e.startDay + e.days - 1) ?? null;
}

/** Every event happening anywhere right now, city by city. */
export function liveEvents(day: number): HypeEvent[] {
    return calendar().filter(e => day >= e.startDay && day <= e.startDay + e.days - 1);
}

/**
 * Events still worth knowing about from `day` onward: live now, or starting
 * within `within` days. Defaults to the whole rest of the run, which is what
 * a full calendar view wants; a dashboard teaser passes a smaller `within`.
 */
export function upcomingEvents(day: number, within: number = TOTAL_DAYS): HypeEvent[] {
    const horizon = day + Math.max(0, within);
    return calendar()
        .filter(e => e.startDay + e.days - 1 >= day && e.startDay <= horizon)
        .sort((a, b) => a.startDay - b.startDay);
}

/** This run's whole schedule for one city, in order. */
export function eventsFor(cityId: string): HypeEvent[] {
    return calendar()
        .filter(e => e.cityId === cityId)
        .sort((a, b) => a.startDay - b.startDay);
}

/** The full run calendar, every city, in date order. What the panel renders. */
export function allHypeEvents(): HypeEvent[] {
    return [...calendar()].sort((a, b) => a.startDay - b.startDay || a.cityId.localeCompare(b.cityId));
}
