/**
 * The four sections of Flight 404, built out of the rungs terrain.ts defines.
 *
 * The complaint this answers, verbatim: "player is on a plane but can only move
 * forward and back not side to side … that's weird. Look at a classic game like
 * contra or metal slug." That was true, and it was not a rendering problem —
 * `terrain.ts` had the tiers, the flag vocabulary and the reachability proof,
 * and nothing in the game ever built a level out of them. A section was a
 * length and a list of x-positions. This is the level.
 *
 * ## Three rules the geometry below obeys, and why
 *
 * **One hop, one rung.** `MAX_STEP` is 34.3px and every step here is 24-32.
 * Nothing is placed by eye. A rung 36px up and a rung 40px up look identical in
 * a level file and are the difference between a game and a soft lock, which is
 * exactly why `unreachable()` exists and why the tests run it over every
 * section.
 *
 * **A rung steps sideways as well as up.** A ledge sitting wholly underneath
 * the ledge above it is not a route: the player jumps, hits the thing they were
 * aiming for from below, and lands where they started. So every rung here keeps
 * standing room clear of the one above — usually a lot of it, never less than
 * about ten pixels. `unreachable()` does not know about this (it only checks
 * span overlap), so the test file checks it separately.
 *
 * **Nothing destructible is ever the only way up.** A player who shoots their
 * own ladder away and then cannot reach the exit has found a bug, and they
 * found it by doing the thing the game spent the whole level teaching them to
 * do. So load-bearing steps are bolted-down furniture — trolley bays, stall
 * bases, the pilot's jump seat — and the crates are cover. The test strips
 * every `DESTRUCTIBLE` platform out and re-runs the climb.
 *
 * ## What the rng is, and what it is emphatically not
 *
 * The geometry is authored and fixed. Where a lie-flat sits is a joke about
 * business class, not a random number, and a generator cannot write the joke.
 * The rng picks *dressing* only: which way the galley belt drags, which market
 * table took the tahini, which of the two cockpit crates is the one bolted
 * down. Every option is interchangeable with every other where the climb is
 * concerned, so no seed can produce a level the player cannot finish — and the
 * tests sweep hundreds of seeds to say so out loud rather than on trust.
 */

import { SECTIONS } from './content';
import { TIER, SURFACE, TILE, type PlatformDef, type TileFlags } from './terrain';

// ---------------------------------------------------------------------------
// Furniture. A level file should read as things, not as quadruples of numbers.
// ---------------------------------------------------------------------------

const at = (x: number, y: number, w: number, flags: TileFlags): PlatformDef => ({ x, y, w, flags });

/** A galley counter, a bulkhead ledge, a stall table — anything plain and solid. */
const ledge = (x: number, w: number, y: number): PlatformDef => at(x, y, w, SURFACE.counter);
/** A stack of duty-free. Cover, never a rung you cannot do without. */
const crate = (x: number, w: number, y: number = TIER.seat): PlatformDef => at(x, y, w, SURFACE.crate);
/** Where a bowl of hummus went over. You keep going after you stop asking to. */
const spill = (x: number, w: number, y: number = TIER.seat): PlatformDef => at(x, y, w, SURFACE.hummus);
/** Overhead bins — where the perched throwers were already floating. */
const bin = (x: number, w: number): PlatformDef => at(x, TIER.bin, w, SURFACE.bin);
/**
 * An invisible wall at the end of a high run. The player never meets it; the
 * charger who would otherwise stroll off the counter and die does.
 */
const FENCE_W = 4;
const fence = (x: number, y: number): PlatformDef => at(x, y, FENCE_W, SURFACE.fence);
/** Cloth strung across the aisle. Drawn in front of you, holds nobody up. */
const hanging = (x: number, w: number, y: number): PlatformDef => at(x, y, w, SURFACE.cloth);

const SEAT_W = 28;
const BACK_W = 12;
/**
 * One row of seats: the cushion you scramble onto, and the back of it, which is
 * the next rung up and is narrow enough that standing on it is a decision.
 * Rows are placed on `SEAT_PITCH`, so the profile of the cabin repeats and the
 * player learns the spacing without being told it.
 */
const seatRow = (x: number): PlatformDef[] => [
    at(x, TIER.seat, SEAT_W, SURFACE.seat),
    at(x + SEAT_W, TIER.seatback, BACK_W, SURFACE.seat),
];

/** Deterministic choice among authored alternatives. Never geometry. */
const oneOf = <T>(xs: readonly T[], rng: () => number): T =>
    xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];

// ---------------------------------------------------------------------------
// 1. ECONOMY — 760px, `plane`. The tutorial for verticality, with no text in it.
// ---------------------------------------------------------------------------

/**
 * Nothing is wrong here yet and nothing should be, so the teaching has to be
 * done by the furniture. The first thing past the door is a staircase drawn in
 * cabin parts: cushion, seat back, a bin door somebody left swung open, bins.
 * Four rungs climbing aft in a straight diagonal, each one 26-27px above the
 * last, arranged so that at every step the next one is plainly the next one.
 * A player who has never pressed jump in this game will be on the overhead bins
 * within about six seconds, and will have worked out unaided that the thrower
 * perched at x=330 is somewhere they can go.
 *
 * After that the cabin goes back to being a cabin: ordinary rows underneath the
 * bin run, so the lesson has somewhere to be practised. The second staircase at
 * x=400 is the same shape in the same order, because the first one was a lesson
 * and this one is a sentence spoken in the language it taught.
 */
const economy = (_rng: () => number): PlatformDef[] => [
    // The staircase. Read left to right, it is the whole idea of the section.
    ...seatRow(56),                  // cushion 137, seat back 111
    ledge(100, 24, TIER.counter),    // a bin door hanging open — the third rung
    bin(120, 230),                   // ...and the bins, which run over the rows aft
    fence(120, TIER.bin),
    fence(346, TIER.bin),            // the perched thrower patrols and turns here

    // Ordinary rows under the forward bin run. Practice, and cover.
    ...seatRow(144), ...seatRow(188), ...seatRow(232), ...seatRow(276),

    // The same climb again, two-thirds of the way down the cabin, so that the
    // trolley fight at x=560 can be fought from above if the player thinks of it.
    ...seatRow(400),
    ledge(444, 24, TIER.counter),
    bin(464, 210),
    fence(464, TIER.bin),
    fence(670, TIER.bin),

    // The duty-free somebody stacked in the aisle. Pure cover: it leads nowhere,
    // which is what lets it be destructible.
    crate(452, 30),

    ...seatRow(488), ...seatRow(532), ...seatRow(576), ...seatRow(620),
    ...seatRow(692),                 // the back row, past the bins, where the light stops
];

// ---------------------------------------------------------------------------
// 2. THE GALLEY — 640px, `wrong`, and unlit.
// ---------------------------------------------------------------------------

/**
 * The section is dark: `DARK_R_BARE` is 34px, so bare-handed the player can see
 * about one rung in any direction. That is a hard constraint on the geometry
 * and it is the reason this section is built out of few, wide, obvious slabs
 * instead of the fiddly seat-by-seat climbing in Economy. Every rung here is
 * within a couple of pixels of touching the one below it horizontally, so a
 * player feeling their way along the floor finds the next step inside their own
 * light pool rather than guessing across a gap they cannot see.
 *
 * The belt is the joke. A galley has a service belt, a service belt drags, and
 * a belt that drags the wrong way while a charger comes at you is free comedy
 * that costs one flag. Which way it drags is dressing, not difficulty: the step
 * onto it is at the forward end and the bins hang over the aft end either way,
 * so a belt running against you is a nuisance and never a trap.
 *
 * Everything load-bearing here is bolted to the airframe: the trolley bay, the
 * prep counter, the prep island. The crates are cover and can be shot to bits
 * without costing anyone the climb.
 */
const galley = (rng: () => number): PlatformDef[] => {
    // Toward the tail or toward the nose. Either is survivable; neither is kind.
    const belt = oneOf([SURFACE.beltBack, SURFACE.beltFwd], rng);
    return [
        // Forward climb: trolley bay, service ledge, prep counter.
        ledge(70, 34, TIER.seat),
        ledge(108, 40, TIER.seatback),
        ledge(152, 102, TIER.counter),
        fence(152, TIER.counter),
        fence(250, TIER.counter),    // "the charger ran off the counter and died"
        crate(160, 30),              // cases stacked under the counter, beside the trolley

        // The spill. Somebody's mezze went over onto the service ledge, so the
        // one flat run in the middle of the section is the one you cannot stop on.
        spill(258, 42, TIER.seatback),

        // The prep island in the middle of the galley feeds both ledges either
        // side of it — which is why it is a bolted island and not a crate stack.
        ledge(304, 30, TIER.seat),
        ledge(338, 40, TIER.seatback),

        at(382, TIER.counter, 120, belt),
        bin(460, 140),               // the perch the thrower at x=470 was floating on
        fence(460, TIER.bin),
        fence(596, TIER.bin),

        crate(540, 30),              // cover by the aft trolley
        ledge(600, 36, TIER.seat),   // the aft bulkhead ledge, and the way out
    ];
};

// ---------------------------------------------------------------------------
// 3. BUSINESS CLASS — 820px, `shuk`. The most vertical stretch in the game.
// ---------------------------------------------------------------------------

/**
 * The cabin has lost. Lie-flats at four different reclines because nobody has
 * reset them, stalls built in the aisle, cloth strung overhead, and the whole
 * thing climbable from end to end.
 *
 * This is where the vertical idea is allowed to be the point rather than the
 * lesson. Three towers, each a different shape and each reaching a different
 * height: a five-step diagonal at the front that ends on the bins over the
 * perched thrower at x=290; a market stall in the middle that tops out under
 * the hanging cloth; and a long, shallow scramble at the back up to the bins at
 * x=755. The odd heights — 140, 132, 110, 108, 106, 82 — are lie-flats left at
 * whatever angle their occupant abandoned them at, and they are all still
 * inside one hop of each other because that part is arithmetic, not taste.
 *
 * Two of the three market tables are crates and one has had hummus spilled on
 * it. Which one is dressing: all three sit on the floor, lead nowhere, and are
 * interchangeable as far as the climb is concerned.
 */
const business = (rng: () => number): PlatformDef[] => {
    const TABLES = [252, 340, 760] as const;
    const spilled = oneOf(TABLES, rng);
    const table = (x: number): PlatformDef => (x === spilled ? spill(x, 44) : crate(x, 44));
    return [
        // Tower one: bed, bed, stall, shelf, bins. Five rungs, one direction.
        at(52, 140, 44, SURFACE.seat),
        at(100, 132, 44, SURFACE.seat),
        ledge(150, 40, 108),
        ledge(194, 36, TIER.counter),
        bin(234, 120),
        fence(234, TIER.bin),
        fence(350, TIER.bin),
        hanging(120, 80, 66),        // cloth over the forward stalls

        // A lie-flat under the bins, occupied, which is the joke in the tag.
        at(196, 140, 46, SURFACE.seat),
        table(252),

        table(340),

        // Tower two: the stall. Base is bolted — it is the only way to the awning.
        ledge(400, 40, TIER.seat),
        ledge(444, 52, 110),
        ledge(500, 60, TIER.counter),
        fence(556, TIER.counter),
        hanging(470, 90, 62),        // the awning's cloth, hung across the aisle

        // Tower three: two abandoned lie-flats, a shelf, a ledge, the aft bins.
        at(556, 140, 46, SURFACE.seat),
        at(606, 132, 46, SURFACE.seat),
        ledge(656, 40, 106),
        ledge(700, 36, 82),     // stops where the aft bin starts: standing room, not a ceiling
        bin(736, 76),                // the perch the thrower at x=755 was floating on
        fence(808, TIER.bin),

        table(760),
    ];
};

// ---------------------------------------------------------------------------
// 4. THE COCKPIT — one screen wide, and a boss stands in it.
// ---------------------------------------------------------------------------

/**
 * A boss fight is read, not explored. Yasser's cycle is rant / throw / summon /
 * charge and every one of those is a pattern the player has to see coming, so
 * the arena is deliberately the flattest thing in the game: over half of it is
 * bare floor with nothing in the way of the sightline.
 *
 * What is here is three bits of cover and one step up. The console at 111 is
 * the only high ground, it is small, and it is reachable from either side — so
 * the player can break a charge by getting above it, and cannot camp there,
 * because the megaphone ring reaches. The two crates that feed it are the
 * interesting part: one of them is a duty-free stack Yasser can blow apart and
 * the other is the flight engineer's jump seat, bolted to the floor. Which is
 * which is dressing, but that *one of them is bolted* is not — it is what stops
 * the fight from destroying its own high ground halfway through phase two.
 */
const cockpit = (rng: () => number): PlatformDef[] => {
    // Exactly one of the pair survives a blast, and which one varies.
    const bolted = oneOf([58, 140], rng);
    const step = (x: number): PlatformDef => (x === bolted ? ledge(x, 32, TIER.seat) : crate(x, 32));
    return [
        step(58),
        ledge(96, 42, TIER.seatback),  // the flight engineer's console
        fence(134, TIER.seatback),     // Yasser's charge does not end up on the console
        step(140),
        crate(268, 28),                // the last thing to hide behind, beside the trolley
    ];
};

// ---------------------------------------------------------------------------

/** Per-section builders, in `SECTIONS` order. */
export const LAYOUTS: ((rng: () => number) => PlatformDef[])[] = [economy, galley, business, cockpit];

/**
 * Everything above the floor in section `idx`. The floor itself is the world's
 * and is always there; this is only the furniture standing on it.
 *
 * An index with no section is an empty cabin rather than a throw: the scene
 * loops over `SECTIONS`, and a level file should not be the thing that decides
 * a bad index is fatal.
 */
export function layoutFor(idx: number, rng: () => number = Math.random): PlatformDef[] {
    const build = LAYOUTS[idx];
    return build ? build(rng) : [];
}

/** The horizontal bounds a section's furniture has to stay inside. */
export const sectionLength = (idx: number): number => SECTIONS[idx]?.length ?? 0;
