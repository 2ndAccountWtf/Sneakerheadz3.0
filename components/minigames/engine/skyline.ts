/**
 * A skyline assembled from parts, rather than one strip that loops.
 *
 * The street brief asked for three tiling strips — towers, lowrise, hills — and
 * what arrived was better: thirty-nine separate buildings, billboards, water
 * towers, antennas, rooftop clutter and three Los Angeles landmarks. A kit
 * beats a strip for one reason, and it is the reason `band()` in `draw.ts` is
 * not used here: a strip repeats its whole contents every time it scrolls its
 * own width, and a player watching a horizon for two minutes sees that repeat.
 * Dealing a different piece into each slot does not repeat until the pieces do.
 *
 * ## Deterministic, not random
 *
 * The skyline is a function of world position, so scrolling back and forth
 * shows the same city. Nothing is stored and nothing is generated ahead: given
 * an x, the slot index is `floor(x / spacing)` and the piece is a hash of that
 * index. A level is therefore infinite, costs no memory, and is identical on
 * every machine and every replay.
 *
 * This module has no canvas in it and no art. It decides *what goes where*;
 * `drawSkyline` in `streetArt.ts` puts pixels down. That split is here so the
 * "does it visibly repeat" question can be answered by a test rather than by
 * somebody staring at a horizon.
 */

/** A band of the skyline, back to front. */
export type BandName = 'towers' | 'lowrise' | 'rooftop' | 'landmarks';

export interface Piece {
    id: string;
    /** Drawn size in game pixels. The art is authored at 3× these. */
    w: number;
    h: number;
    /**
     * A version of this building drawn for the distance, preferred when it has
     * been delivered.
     *
     * The kit that arrived is close-range art — around fifty colours a building
     * and a luminance spread of 104 to 192 against a sky at 48 to 70 — so on the
     * horizon it reads as a row of cut-outs pasted in a line rather than as a
     * city. The correction in the meantime is to flatten it almost to nothing
     * (see `SKY_SHADE`), which works but throws away the detail somebody drew.
     *
     * The real answer is a second, flatter drawing of each building, and this is
     * where it plugs in: deliver `far-tower-a-wide.png` and the horizon starts
     * using it, with no code change and no manifest. Until then the detailed one
     * is used and dimmed. See `docs/ASSETS-SKYLINE-SILHOUETTE.md`.
     */
    far?: string;
}

export interface BandDef {
    pieces: Piece[];
    /** Game pixels between slot centres. */
    spacing: number;
    /** How fast this band scrolls relative to the world. */
    factor: number;
    /** Ground line for the band, in game pixels from the top of the screen. */
    baseline: number;
    /** 1 in N slots is filled; the rest are sky. 1 means a solid row. */
    density: number;
}

const towers: Piece[] = [
    { id: 'tower-a-wide', w: 28, h: 40, far: 'far-tower-a-wide' },
    { id: 'tower-b-narrow', w: 28, h: 40, far: 'far-tower-b-narrow' },
    { id: 'tower-c-stepped', w: 28, h: 40, far: 'far-tower-c-stepped' },
    { id: 'tower-d-box', w: 28, h: 40, far: 'far-tower-d-box' },
    { id: 'tower-e-crown', w: 28, h: 40, far: 'far-tower-e-crown' },
    { id: 'tower-f-old', w: 28, h: 40, far: 'far-tower-f-old' },
];

const lowrise: Piece[] = [
    { id: 'lowrise-a-strip', w: 36, h: 26, far: 'far-lowrise-a-strip' },
    { id: 'lowrise-b-walkup', w: 36, h: 26, far: 'far-lowrise-b-walkup' },
    { id: 'lowrise-c-industrial', w: 36, h: 26, far: 'far-lowrise-c-industrial' },
    { id: 'lowrise-d-corner', w: 36, h: 26, far: 'far-lowrise-d-corner' },
    { id: 'lowrise-e-mixed', w: 36, h: 26, far: 'far-lowrise-e-mixed' },
    { id: 'lowrise-f-rooftop', w: 36, h: 26, far: 'far-lowrise-f-rooftop' },
];

/** Clutter that sits on top of a lowrise roof. Small, and mostly silhouette. */
const rooftop: Piece[] = [
    { id: 'roof-vent', w: 16, h: 16 },
    { id: 'hvac-box', w: 16, h: 16 },
    { id: 'satellite-dish', w: 16, h: 16 },
    { id: 'water-tank-small', w: 16, h: 16 },
    { id: 'antenna-thin', w: 16, h: 16 },
    { id: 'utility-mast', w: 16, h: 16 },
    { id: 'exhaust-stack', w: 16, h: 16 },
    { id: 'clustered-pipes', w: 16, h: 16 },
    { id: 'access-shed', w: 16, h: 16 },
    { id: 'billboard-frame', w: 16, h: 16 },
    { id: 'antenna-a', w: 12, h: 20 },
    { id: 'antenna-b', w: 12, h: 20 },
    { id: 'antenna-c', w: 12, h: 20 },
    { id: 'antenna-d', w: 12, h: 20 },
    { id: 'antenna-e', w: 12, h: 20 },
    { id: 'antenna-f', w: 12, h: 20 },
    { id: 'billboard-a', w: 26, h: 20 },
    { id: 'billboard-b', w: 26, h: 20 },
    { id: 'billboard-c', w: 26, h: 20 },
    { id: 'billboard-d', w: 26, h: 20 },
    { id: 'billboard-e', w: 26, h: 20 },
    { id: 'watertower-classic', w: 20, h: 26 },
    { id: 'watertower-conical', w: 20, h: 26 },
    { id: 'watertower-squat', w: 20, h: 26 },
];

/**
 * The three that are allowed to be recognisable.
 *
 * Rare on purpose — a landmark you pass every eight seconds is wallpaper, and
 * one you pass twice in a run is a landmark. `density` below is what enforces
 * that, and it is the only number in this file worth being fussy about.
 */
const landmarks: Piece[] = [
    { id: 'landmark-capitol-records', w: 30, h: 48 },
    { id: 'landmark-griffith-observatory', w: 72, h: 32 },
    { id: 'landmark-hellaweird-sign', w: 96, h: 28 },
];

export const BANDS: Record<BandName, BandDef> = {
    towers: { pieces: towers, spacing: 30, factor: 0.10, baseline: 62, density: 1 },
    lowrise: { pieces: lowrise, spacing: 38, factor: 0.20, baseline: 74, density: 1 },
    rooftop: { pieces: rooftop, spacing: 19, factor: 0.20, baseline: 50, density: 3 },
    landmarks: { pieces: landmarks, spacing: 190, factor: 0.14, baseline: 66, density: 2 },
};

/**
 * Back to front, and it must stay sorted by `factor`.
 *
 * Draw order *is* depth. A band that scrolls slower is further away, so it has
 * to be painted first and be overlapped by everything nearer. Landmarks used to
 * be drawn last — in front of the lowrise band — while scrolling slower than
 * it, which is a contradiction the eye reads immediately: the Hellaweird sign
 * sat in front of buildings it was supposed to be behind, so a 96px sign looked
 * smaller and nearer than a 36px shopfront. There is a check on this in
 * `tests/skyline.test.mts`; if you reorder this, fix the factors too.
 */
export const BAND_ORDER: BandName[] = ['towers', 'landmarks', 'lowrise', 'rooftop'];

/**
 * A stable hash of a slot index. Small, fast, and the same everywhere — which
 * is the whole requirement, since the skyline is re-derived every frame rather
 * than stored.
 */
export function slotHash(index: number, salt: number): number {
    let h = (index | 0) * 374761393 + salt * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Which piece fills a slot, or null when the slot is sky.
 *
 * Adjacent slots never get the same piece. That is the single rule that makes a
 * kit worth having: two identical towers side by side read as a texture repeat
 * far more loudly than a repeat twenty slots apart, and the fix costs one
 * comparison.
 */
export function pieceAt(band: BandDef, index: number, salt = 0): Piece | null {
    if (!filled(band, index, salt)) return null;
    return band.pieces[rawPick(band, index, salt)];
}

const filled = (band: BandDef, index: number, salt: number): boolean =>
    band.density <= 1 || slotHash(index, salt + 91) < 1 / band.density;

const rawPick = (band: BandDef, index: number, salt: number): number =>
    Math.floor(slotHash(index, salt) * band.pieces.length) % band.pieces.length;

/** The nearest filled slot behind this one, or null if there is none nearby. */
function prevFilled(band: BandDef, index: number, salt: number): number | null {
    for (let i = index - 1; i > index - 8; i--) if (filled(band, i, salt)) return i;
    return null;
}

/**
 * Should this slot be drawn mirrored?
 *
 * A hash will occasionally deal the same building into two neighbouring slots,
 * and that reads as a texture error far more loudly than a repeat twenty slots
 * away. The obvious fix — nudge the second pick to a different piece — does not
 * work: nudging slot n away from n-1 can land it on what n-1 was itself nudged
 * to, and resolving that properly means walking backwards without a bound. A
 * test over a thousand slots found the collision at index -476, then at 14.
 *
 * So the twin is mirrored instead of replaced. A building flipped
 * horizontally does not read as the same building, the rule is local and
 * closed-form, and there is no chain to resolve. A run of three alternates,
 * which is why this counts the run's parity rather than just looking back one.
 */
export function flipAt(band: BandDef, index: number, salt = 0): boolean {
    if (!filled(band, index, salt)) return false;
    const mine = rawPick(band, index, salt);
    let run = 0;
    let i: number | null = index;
    // Bounded: a run longer than this is not worth the arithmetic, and by then
    // the alternation has already broken up the repeat.
    while (run < 8) {
        i = prevFilled(band, i as number, salt);
        if (i === null || rawPick(band, i, salt) !== mine) break;
        run++;
    }
    return run % 2 === 1;
}

export interface Placement {
    piece: Piece;
    /** Screen x of the piece's left edge. */
    x: number;
    /** Screen y of its ground line — the bottom of the art. */
    y: number;
    /** Drawn mirrored, so an adjacent twin does not read as a repeat. */
    flip: boolean;
}

/**
 * Everything in one band that is visible right now.
 *
 * `scroll` is world position; the band's own `factor` turns it into parallax.
 * One slot of margin either side so a piece wider than its spacing slides in
 * from off-screen instead of appearing at the edge.
 */
export function layoutBand(
    name: BandName, scroll: number, screenW: number, salt = 0,
): Placement[] {
    const band = BANDS[name];
    const shift = scroll * band.factor;
    const first = Math.floor(shift / band.spacing) - 1;
    const last = Math.ceil((shift + screenW) / band.spacing) + 1;

    const out: Placement[] = [];
    for (let i = first; i <= last; i++) {
        const piece = pieceAt(band, i, salt);
        if (!piece) continue;
        // Jitter the baseline by a pixel or two so a row of rooftops is not a
        // ruled line. Derived from the slot, so it never shimmers.
        const lift = Math.floor(slotHash(i, salt + 17) * 3);
        out.push({
            piece,
            x: Math.round(i * band.spacing - shift),
            y: band.baseline - lift,
            flip: flipAt(band, i, salt),
        });
    }
    return out;
}

/** Every band, back to front, ready to draw in order. */
export function layoutSkyline(
    scroll: number, screenW: number, salt = 0,
): { band: BandName; placements: Placement[] }[] {
    return BAND_ORDER.map((band) => ({ band, placements: layoutBand(band, scroll, screenW, salt) }));
}
