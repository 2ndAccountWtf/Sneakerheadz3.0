/**
 * Where the seats stop.
 *
 * The foreground row was laid down as one unbroken strip of seat modules from
 * the front of the section to the back, which is not what the inside of an
 * aeroplane looks like. A cabin is even seat pitch interrupted in two specific
 * places, and both of them are the absence of a seat rather than a new object:
 *
 *   - an **overwing exit**, roughly mid-cabin, where two seat positions are
 *     given up so the door has somewhere to swing and people have somewhere to
 *     stand. This is the one everybody recognises without being able to name.
 *   - a **bulkhead** at the front of a block -- the wall a lavatory or galley
 *     backs onto -- where the row simply starts late.
 *
 * Neither needs art. A break in the row reads as a break in the row, and the
 * aisle floor behind it is already drawn. Inventing a door plate to fill the
 * hole would be inventing the one thing the gap is there to imply.
 *
 * Pure geometry, no Phaser: the layout is the part worth testing, and it can be
 * tested without a canvas.
 */

/** Seats in one delivered module. The art is a bank of three. */
export const SEATS_PER_MODULE = 3;

/**
 * Modules between exits, in modules rather than seats, because a gap can only
 * fall where one module ends and the next begins.
 *
 * Four modules is twelve seat positions, which is about a narrowbody's spacing
 * between its forward door and the overwing pair. Three felt like a bus; six
 * put the whole section in one block and the break never arrived.
 */
export const MODULES_PER_BLOCK = 4;

/** Seat positions given up at an exit. Two is the double space. */
export const EXIT_GAP_SEATS = 2;

/** Seat positions the row starts late by, for the wall at the front. */
export const BULKHEAD_GAP_SEATS = 2;

export interface CabinSlot {
    /** Left edge, in world units. */
    x: number;
    /** Index among placed modules, for choosing which variant goes here. */
    i: number;
}

/**
 * Lay out one section's foreground seat row.
 *
 * `len` and `moduleW` are world units. Returns only the slots that get a
 * module; the gaps are what is not in the list.
 *
 * `widthAt` gives the *drawn* width of module `i` when the modules are not all
 * the same. They are not: the delivered set carries between four and twelve
 * pixels of transparent margin on each side, so advancing by the nominal 72
 * units leaves up to eight units of air between every bank of three and the
 * cabin reads as banks rather than as a row. The caller measures the ink and
 * passes it here; without it every module is assumed to be `moduleW` wide.
 */
export function cabinPlan(
    len: number,
    moduleW: number,
    widthAt: (i: number) => number = () => moduleW,
): CabinSlot[] {
    const out: CabinSlot[] = [];
    if (!(len > 0) || !(moduleW > 0)) return out;

    const seatW = moduleW / SEATS_PER_MODULE;
    // The row starts late: this is the bulkhead the front lavatory backs onto.
    let x = BULKHEAD_GAP_SEATS * seatW;
    let inBlock = 0;
    let i = 0;

    // `x < len` and not `x + moduleW < len`: a module that runs past the back
    // of the section is right. The cabin does not stop mid-row because the
    // level does, and the section after it starts its own row at its own
    // bulkhead, so the seam lands in a gap either way.
    while (x < len) {
        const w = widthAt(i);
        out.push({ x, i: i++ });
        // Guard against a zero or negative measurement looping forever.
        x += w > 0 ? w : moduleW;
        if (++inBlock >= MODULES_PER_BLOCK) {
            inBlock = 0;
            x += EXIT_GAP_SEATS * seatW;
        }
    }
    return out;
}
