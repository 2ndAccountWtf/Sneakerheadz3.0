/**
 * The sky and the valley floor, sampled row by row.
 *
 * "Why do you have just a solid bar of colour that doesn't fade out at the top
 * and get darker at the bottom or some shit" is a thing somebody said about
 * this scene, and they were right: the sky was four `fillRect`s of flat colour
 * and the ground under the city was three more. A flat fill across a whole band
 * is the single loudest signal that nobody art-directed a scene, and it is not
 * something the other draw tests can catch — they check that a draw happened,
 * deliberately, not what it looked like.
 *
 * This one does look. It records every full-width fill, works out what colour
 * each scanline of the backdrop ended up, and asserts the shape of the result:
 * many values rather than three, getting lighter toward the horizon, and no one
 * value owning a quarter of the sky.
 *
 * It runs with no `document`, which is not an accident: that is the path where
 * `drawRace` paints the backdrop straight onto the target instead of blitting
 * it from its offscreen cache, and it is the only way to see the fills from
 * out here.
 */
import assert from 'node:assert/strict';

const W = 320;
/** From CartRace: the sky runs to y=58, the valley floor from there to y=92. */
const HAZE_TOP = 58;
const HAZE_BOT = 92;

interface Rec {
    /** Colour of each scanline of the backdrop, last writer wins. */
    row: (string | null)[];
    radials: number;
    ops: string[];
}

const blank = (): Rec => ({ row: Array(180).fill(null), radials: 0, ops: [] });

/**
 * A canvas that writes everything it is told into whichever `Rec` is current.
 *
 * Indirect on purpose. `drawRace` keeps its backdrop in one offscreen canvas
 * for the life of the module and repaints it only when the light changes, so
 * the context handed out here has to outlive any one frame while the recording
 * it feeds does not.
 */
function recorder(get: () => Rec | null): CanvasRenderingContext2D {
    let fill: unknown = '#000';
    const op = (s: string) => { get()?.ops.push(s); };
    const ctx: Record<string, unknown> = {
        canvas: { width: W, height: 180 },
        get fillStyle() { return fill; },
        set fillStyle(v: unknown) { fill = v; },
        save: () => op('save'), restore: () => op('restore'),
        measureText: () => ({ width: 10 }),
        createLinearGradient: () => ({ addColorStop: () => op('lin stop') }),
        createRadialGradient: () => { const r = get(); if (r) r.radials++; return { addColorStop: () => op('rad stop') }; },
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        fillRect: (x: number, y: number, w: number, h: number) => {
            const rec = get();
            if (!rec) return;
            rec.ops.push(`f ${x},${y},${w},${h},${String(fill)}`);
            // A gradient fillStyle is an object here, not a colour.
            if (typeof fill !== 'string') return;
            if (x > 0 || w < W) return;
            for (let r = Math.round(y); r < Math.round(y) + Math.round(h); r++) {
                if (r >= 0 && r < 180) rec.row[r] = fill;
            }
        },
    };
    for (const fn of [
        'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'rect',
        'fill', 'stroke', 'strokeRect', 'clearRect', 'fillText',
        'strokeText', 'clip', 'translate', 'rotate', 'scale', 'setTransform',
        'resetTransform', 'drawImage', 'quadraticCurveTo', 'bezierCurveTo',
        'setLineDash', 'putImageData', 'transform', 'arcTo', 'roundRect',
    ]) ctx[fn] = (...a: unknown[]) => op(`${fn} ${a.join(',')}`);
    return ctx as unknown as CanvasRenderingContext2D;
}

let sink: Rec | null = null;
const shared = recorder(() => sink);
/** The code-defined sprite baker needs a canvas of its own; it gets a silent one. */
const mute = recorder(() => null);
(globalThis as Record<string, unknown>).document = {
    createElement: () => ({
        width: 0,
        height: 0,
        // The backdrop cache is the only canvas made at screen width. Everything
        // else asking for one is the sprite baker, and its thousands of little
        // fills are not what this file is about.
        getContext(this: { width: number }) { return this.width === W ? shared : mute; },
    }),
};

const { createRaceState, stepRace, drawRace, NO_INPUT } =
    await import('../components/minigames/CartRace.tsx');

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const lum = (c: string): number => {
    const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    let r: number, g: number, b: number;
    if (m) { [r, g, b] = [+m[1], +m[2], +m[3]]; } else {
        let hex = c.replace(/^#/, '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        const n = parseInt(hex, 16);
        [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Draw one frame `frames` steps into a run.
 *
 * `back` is the offscreen canvas the backdrop is painted into and `main` is the
 * screen. They are kept apart because the HUD panel is a 320x22 fill of one
 * colour across the top of the screen, and on a single recording it flattens
 * the first twenty-two rows of sky that it is in fact translucent over.
 */
function drawOnce(frames: number): { main: Rec; back: Rec } {
    const s = createRaceState({ hasBoard: true, seed: 11, arms: [], fitness: 1 } as never);
    for (let i = 0; i < frames; i++) {
        stepRace(s, { ...NO_INPUT, right: true }, 1 / 60);
        // Kept alive so this is a frame of the scene rather than of an ending
        // card. Nothing here reads back into the simulation.
        s.health = 100; s.gap = 40;
    }
    s.shake = 0;
    const back = blank();
    const main = blank();
    sink = back;
    drawRace(recorder(() => main), s, 'The Game');
    sink = null;
    return { main, back };
}

/**
 * The same, but guaranteed to have repainted the backdrop rather than blitted
 * a cached one — by drawing a frame from the other end of the hill first, which
 * moves the cache off this frame's lighting.
 */
function frameAt(frames: number): { main: Rec; back: Rec } {
    drawOnce(frames > 1600 ? 200 : 3000);
    return drawOnce(frames);
}

/** The longest run of consecutive rows painted the same colour. */
const longestFlat = (rows: (string | null)[], y0: number, y1: number): number => {
    let best = 0, run = 0, prev: string | null = null;
    for (let y = y0; y < y1; y++) {
        if (rows[y] !== null && rows[y] === prev) run++; else { run = 1; prev = rows[y]; }
        if (run > best) best = run;
    }
    return best;
};

const values = (rows: (string | null)[], y0: number, y1: number): string[] =>
    [...new Set(rows.slice(y0, y1).filter((c): c is string => c !== null))];

console.log('\nthe sky is not a bar of flat colour');

for (const [where, frames] of [['at the top of the hill', 200], ['halfway down', 1400], ['at the bottom', 3000]] as const) {
    t(`the sky is graded ${where}`, () => {
        const { back } = frameAt(frames);
        const vals = values(back.row, 0, HAZE_TOP);
        // Twelve steps are asked for and the ends of the ramp can round
        // together, so the floor is set below that rather than at it. It was
        // three, with one of them twenty-six rows tall, when somebody called
        // this a solid bar of colour.
        assert.ok(vals.length >= 9,
            `the sky is ${vals.length} colours from y0 to y${HAZE_TOP}`);
        assert.ok(longestFlat(back.row, 0, HAZE_TOP) <= 8,
            `one colour owns ${longestFlat(back.row, 0, HAZE_TOP)} consecutive rows of sky`);
    });

    t(`the sky is lighter at the horizon than overhead ${where}`, () => {
        // Which is what sky does. The old version put its brightest stop at
        // y=78, underneath the valley floor, where it was never once visible.
        const { back } = frameAt(frames);
        const top = lum(back.row[2]!);
        const horizon = lum(back.row[HAZE_TOP - 2]!);
        assert.ok(horizon > top + 25,
            `the sky is ${top.toFixed(0)} overhead and ${horizon.toFixed(0)} at the horizon`);
    });

    t(`the ground darkens as it comes toward you ${where}`, () => {
        // Air thins with proximity: the valley floor is hazy and pale where it
        // meets the sky and its own colour by the time it reaches the verge.
        const { back } = frameAt(frames);
        const vals = values(back.row, HAZE_TOP, HAZE_BOT);
        assert.ok(vals.length >= 5, `the valley floor is ${vals.length} colours — it was 3 flat steps`);
        const far = lum(back.row[HAZE_TOP + 1]!);
        const near = lum(back.row[HAZE_BOT - 2]!);
        assert.ok(far - near > 15,
            `the floor runs ${far.toFixed(0)} at the horizon to ${near.toFixed(0)} at your feet`);
    });
}

t('the sun wears a radial glow rather than a disc of flat colour', () => {
    // A circle filled with one low-alpha colour is a disc, and the eye reads
    // the disc's edge before it reads the light.
    assert.ok(frameAt(1400).main.radials > 0, 'nothing on screen is a radial gradient');
});

t('the same point on the hill draws the same backdrop', () => {
    // The whole scene is a function of world position. A dither that moved
    // between frames would crawl, and a cache keyed on anything but the sim
    // would show two different skies for the same metre of road.
    const a = frameAt(1400);
    const b = frameAt(1400);
    assert.deepEqual(a.back.row, b.back.row, 'the same metre of hill produced two different skies');
    assert.deepEqual(a.back.ops, b.back.ops, 'the backdrop was dithered differently the second time');
    assert.deepEqual(a.main.ops, b.main.ops, 'the same frame drew two different pictures');
});

t('the sky changes across the descent', () => {
    // The one cue that a 1900m run has been a long way down.
    assert.notDeepEqual(frameAt(200).back.row.slice(0, HAZE_TOP), frameAt(3000).back.row.slice(0, HAZE_TOP),
        'the sky at the bottom of the hill is the sky at the top');
});

t('the grading is dithered, not smoothed', () => {
    // Pixel art: the join between two steps is a one-pixel ordered pattern, not
    // a soft ramp. Those are single-pixel fills, and there have to be a lot of
    // them or the steps are hard edges with nothing between.
    const dots = frameAt(1400).back.ops.filter(o => /^f -?\d+,-?\d+,1,1,/.test(o)).length;
    assert.ok(dots > 600, `only ${dots} dither pixels in the whole backdrop`);
});

console.log(`\n${pass} backdrop checks passed\n`);
