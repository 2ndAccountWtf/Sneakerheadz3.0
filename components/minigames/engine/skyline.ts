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

/**
 * Where the buildings bunch up.
 *
 * A fixed fill probability spreads buildings evenly, and evenly spaced is the
 * one thing a skyline never is — it reads as a picket fence, which is exactly
 * what the first version of this file shipped (`density: 1`, every 30px slot
 * filled, no gaps at all).
 *
 * So fill probability is itself a function of slot index: two sine waves whose
 * periods do not divide into one another, giving a run of dense slots, then a
 * thin patch, and never quite the same run twice. The periods matter more than
 * the amplitudes — see `slotsPerScreen` and the check that uses it in
 * `tests/skyline.test.mts`. If the wavelength lands near the number of slots a
 * screen shows, every screenful gets one clump in the middle and the fence
 * comes back wearing a hat.
 */
export interface ClumpDef {
    /** Mean fill probability, before the waves. */
    base: number;
    /** Amplitude and angular frequency (radians per slot) of the long wave. */
    a1: number;
    f1: number;
    /** The same for the short wave, which breaks up the long one's regularity. */
    a2: number;
    f2: number;
    /** Offsets the whole pattern, so two bands do not clump in the same places. */
    phase: number;
}

/**
 * How much a band's pieces vary in drawn size, and how that variation moves
 * along the skyline.
 *
 * Presence alone is not enough: a clumped row of buildings that are all exactly
 * 40px tall is still a fence, just a gappy one. The wave makes height swell and
 * fall across a stretch — a downtown cluster, then a low quarter — and the
 * per-slot hash keeps neighbours from matching inside a cluster.
 *
 * The scale is uniform, not vertical-only. Squashing a facade vertically slides
 * its window rows off their own pitch and the art stops looking drawn; scaling
 * both axes reads as a smaller building further back, which is what a skyline
 * is full of.
 */
export interface HeightVary {
    /** Maximum shrink. 0.38 means pieces run from 62% to 100% of drawn size. */
    amp: number;
    /** Radians per slot for the swell. */
    f: number;
    phase: number;
}

export interface BandDef {
    pieces: Piece[];
    /** Game pixels between slot centres. */
    spacing: number;
    /** How fast this band scrolls relative to the world. */
    factor: number;
    /** Ground line for the band, in game pixels from the top of the screen. */
    baseline: number;
    /**
     * 1 in N slots is filled; the rest are sky. 1 means a solid row — and a
     * solid row is a fence, so the two ground bands do not use this. It is
     * ignored entirely when `clump` is set.
     */
    density: number;
    /** Clumping. Replaces `density` outright when present. */
    clump?: ClumpDef;
    /** Drawn-size variation. Absent means every piece is drawn at its full size. */
    vary?: HeightVary;
    /**
     * This band stands on another band's roofs rather than on the ground.
     *
     * Rooftop clutter used to be placed independently of the buildings under
     * it, which was harmless only because the lowrise band had `density: 1` and
     * therefore had no gaps. The moment the city clumps, an independent aerial
     * is an aerial hanging in open sky — and "nothing may float" is the one
     * parallax rule everybody notices being broken without being able to name
     * it. So a slot here is filled only when the slot it sits on is, and its
     * ground line is that building's actual roof rather than a fixed number.
     *
     * Requires the host band to scroll at the same `factor`; otherwise the
     * clutter would slide off the roof it was placed on.
     */
    roofOf?: BandName;
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
    towers: {
        // `density` is dead here; `clump` replaces it. Left at 1 because it is
        // not optional and because 1 is what it used to be.
        pieces: towers, spacing: 30, factor: 0.10, baseline: 62, density: 1,
        // ~30 slots and ~86 slots. A screen shows 320/30 = 10.7 slots, so the
        // long wave is most of three screens and no two screenfuls of horizon
        // have the clump in the same place.
        clump: { base: 0.62, a1: 0.30, f1: 0.21, a2: 0.14, f2: 0.073, phase: 0 },
        vary: { amp: 0.38, f: 0.13, phase: 1.1 },
    },
    lowrise: {
        pieces: lowrise, spacing: 38, factor: 0.20, baseline: 74, density: 1,
        // Deliberately not the towers' periods, and offset in phase: if the two
        // bands thinned out together the horizon would open into a hole.
        clump: { base: 0.58, a1: 0.28, f1: 0.167, a2: 0.13, f2: 0.061, phase: 2.4 },
        // Wider than the towers'. Six lowrise pieces get dealt into the eight
        // slots a screen shows, so the same shopfront turning up twice at once
        // is arithmetic rather than bad luck — a bigger size spread is half of
        // what stops the pair reading as one building repeated. The other half
        // is the per-building depth tint in `drawSkyline`.
        vary: { amp: 0.44, f: 0.097, phase: 3.7 },
    },
    // Density is per *roofed* slot now: the host check below removes the rest,
    // so this is 1 in 2 of the slots that have a building under them.
    rooftop: { pieces: rooftop, spacing: 19, factor: 0.20, baseline: 50, density: 2, roofOf: 'lowrise' },
    landmarks: { pieces: landmarks, spacing: 190, factor: 0.14, baseline: 66, density: 2 },
};

/** Slots a `screenW`-wide screen shows in this band. Used by the clump tests. */
export const slotsPerScreen = (band: BandDef, screenW: number): number =>
    screenW / band.spacing;

/**
 * Fill probability for a slot, 0..1. Clamped, because the waves are allowed to
 * overshoot — a stretch that wants to be solid should be solid, not 97% solid
 * with one hole in it.
 */
export function clumpAt(c: ClumpDef, index: number): number {
    const v = c.base
        + c.a1 * Math.sin(index * c.f1 + c.phase)
        + c.a2 * Math.sin(index * c.f2 + c.phase * 1.7);
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Drawn size multiplier for a slot, in (0, 1].
 *
 * Two thirds low-frequency wave and one third per-slot hash: the wave gives the
 * skyline a profile, the hash stops a cluster being a staircase.
 */
export function sizeAt(band: BandDef, index: number, salt = 0): number {
    const v = band.vary;
    if (!v) return 1;
    const wave = 0.5 + 0.5 * Math.sin(index * v.f + v.phase);
    return 1 - v.amp * (0.62 * (1 - wave) + 0.38 * slotHash(index, salt + 53));
}

/** Drawn size of a slot's piece in game pixels, after `vary`. */
export function drawnSize(band: BandDef, piece: Piece, index: number, salt = 0): { w: number; h: number } {
    const k = sizeAt(band, index, salt);
    return {
        w: Math.max(1, Math.round(piece.w * k)),
        h: Math.max(1, Math.round(piece.h * k)),
    };
}

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

/**
 * The slot of `band.roofOf` that this slot sits on.
 *
 * Both bands scroll at the same factor, so the two grids are locked together
 * and this is pure arithmetic — no search, no state. Floor, not truncate: slot
 * -1 of a 19px band is at x=-19, which is inside slot -1 of a 38px one.
 */
const hostSlot = (band: BandDef, index: number): number =>
    Math.floor((index * band.spacing) / BANDS[band.roofOf as BandName].spacing);

function filled(band: BandDef, index: number, salt: number): boolean {
    if (band.roofOf && !filled(BANDS[band.roofOf], hostSlot(band, index), salt)) return false;
    if (band.clump) return slotHash(index, salt + 91) < clumpAt(band.clump, index);
    return band.density <= 1 || slotHash(index, salt + 91) < 1 / band.density;
}

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
    /**
     * The slot this came out of.
     *
     * Carried because the slot index is the scene's only stable identity for a
     * building: screen x moves every frame and the piece id repeats. Anything
     * that has to follow one building across two frames — a test measuring
     * parallax, a caller lighting windows — needs this and cannot recover it.
     */
    slot: number;
    /** Screen x of the piece's left edge. */
    x: number;
    /** Screen y of its ground line — the bottom of the art. */
    y: number;
    /**
     * Drawn size in game pixels. Not `piece.w`/`piece.h`: a band with `vary`
     * draws its pieces at a range of sizes so the skyline has a profile rather
     * than one ruled roofline, and the renderer must use these.
     */
    w: number;
    h: number;
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
    const [first, last] = slotRange(band, scroll, screenW);

    const out: Placement[] = [];
    for (let i = first; i <= last; i++) {
        const piece = pieceAt(band, i, salt);
        if (!piece) continue;
        const { w, h } = drawnSize(band, piece, i, salt);
        out.push({
            piece,
            slot: i,
            // Centred in its slot rather than left-aligned, so a piece drawn
            // small opens a gap on both sides instead of shunting the whole
            // band left — the slot grid is what keeps the rhythm readable.
            x: Math.round(i * band.spacing - shift + (piece.w - w) / 2),
            y: groundLine(band, i, salt),
            w,
            h,
            flip: flipAt(band, i, salt),
        });
    }
    return out;
}

/**
 * Where a slot's piece stands.
 *
 * For a ground band that is the baseline, jittered a pixel or two off a hash so
 * a row of roofs is not a ruled line. For a band with `roofOf` it is the actual
 * top of the building underneath — worked out from that building's own jitter
 * and drawn size, so clutter sits on the roof it was dealt onto whatever size
 * that roof came out. One pixel of overlap, because a silhouette resting
 * exactly on an edge shows a seam at some scroll offsets and never the reverse.
 */
function groundLine(band: BandDef, index: number, salt: number): number {
    if (band.roofOf) {
        const host = BANDS[band.roofOf];
        const hi = hostSlot(band, index);
        const piece = pieceAt(host, hi, salt);
        if (piece) return groundLine(host, hi, salt) - drawnSize(host, piece, hi, salt).h + 1;
    }
    return band.baseline - Math.floor(slotHash(index, salt + 17) * 3);
}

/**
 * The slots this band has to consider for a given screen, inclusive.
 *
 * A slot of margin either side, so a piece wider than its spacing slides in
 * from off-screen instead of appearing at the edge. Exported because that is
 * the property worth testing: once the city has gaps in it, "the first
 * building is off-screen left" is no longer true and no longer means anything,
 * while "the range considered brackets the screen" still does.
 */
export function slotRange(band: BandDef, scroll: number, screenW: number): [number, number] {
    const shift = scroll * band.factor;
    return [
        Math.floor(shift / band.spacing) - 1,
        Math.ceil((shift + screenW) / band.spacing) + 1,
    ];
}

/** Every band, back to front, ready to draw in order. */
export function layoutSkyline(
    scroll: number, screenW: number, salt = 0,
): { band: BandName; placements: Placement[] }[] {
    return BAND_ORDER.map((band) => ({ band, placements: layoutBand(band, scroll, screenW, salt) }));
}
