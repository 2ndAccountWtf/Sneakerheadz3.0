/**
 * Both street games, played and drawn.
 *
 * The art wiring in `CartRace` and `PizzaRun` is nearly all render code, and
 * render code is exactly what a headless test suite normally cannot reach: a
 * typo in a band callback or a missing frame count is a blank patch on screen,
 * not a failing assertion. So this drives real runs and draws every frame onto
 * a recording stub, which catches the whole class of "that call site throws"
 * without anybody opening a browser.
 *
 * It deliberately does not check what was drawn — that is what eyes are for.
 * It checks that the draw happened at all, on every frame of a long run,
 * through crashes, jumps, wipeouts and endings.
 */
import assert from 'node:assert/strict';

/**
 * The code-defined sprite baker draws into an offscreen canvas of its own, so
 * it needs a `document` to exist before either game module is imported. This
 * is the smallest one that satisfies it: an element with a size and a context.
 * Deliberately not jsdom — the point of these tests is that they are fast
 * enough to run on every commit.
 */
function stubCtx(): {
    ctx: CanvasRenderingContext2D;
    readonly ops: number;
    readonly depth: number;
    readonly minDepth: number;
} {
    let depth = 0;
    let minDepth = 0;
    let ops = 0;
    const noop = () => { ops++; };
    const ctx: Record<string, unknown> = {
        canvas: { width: 320, height: 180 },
        save: () => { depth++; },
        restore: () => { depth--; if (depth < minDepth) minDepth = depth; },
        measureText: () => ({ width: 10 }),
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    };
    for (const fn of [
        'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'rect',
        'fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'fillText',
        'strokeText', 'clip', 'translate', 'rotate', 'scale', 'setTransform',
        'resetTransform', 'drawImage', 'quadraticCurveTo', 'bezierCurveTo',
        'setLineDash', 'putImageData', 'transform', 'arcTo', 'roundRect',
    ]) ctx[fn] = noop;
    return {
        ctx: ctx as unknown as CanvasRenderingContext2D,
        get ops() { return ops; },
        get depth() { return depth; },
        get minDepth() { return minDepth; },
    };
}

(globalThis as Record<string, unknown>).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => stubCtx().ctx }),
};

const { createRaceState, stepRace, drawRace, NO_INPUT: RACE_IDLE } =
    await import('../components/minigames/CartRace.tsx');
const { createRunState, stepRun, drawRun, NO_INPUT: RUN_IDLE } =
    await import('../components/minigames/PizzaRun.tsx');

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };
const DT = 1 / 60;

t('a whole downhill run draws every frame', () => {
    const s = createRaceState({ hasBoard: true, seed: 11, arms: [], fitness: 1 } as never);
    const c = stubCtx();
    // Long enough to reach the bottom of the hill and play out an ending, with
    // a steering input so the rider changes lane, crashes and jumps on the way.
    for (let i = 0; i < 3600; i++) {
        stepRace(s, { ...RACE_IDLE, right: true, up: i % 140 < 24, ollie: i % 97 === 0 }, DT);
        const before = c.ops;
        drawRace(c.ctx, s, 'The Game');
        assert.ok(c.ops > before, `frame ${i} drew nothing`);
    }
    assert.equal(c.depth, 0, 'save/restore left unbalanced');
    assert.equal(c.minDepth, 0, 'restored more than was saved');
});

t('the trolley draws too, which takes the other half of every branch', () => {
    // No board means the coded rig rather than the delivered sheets, and a
    // different set of obstacle outcomes. Both paths have to survive.
    const s = createRaceState({ hasBoard: false, seed: 3, arms: [], fitness: 0.9 } as never);
    const c = stubCtx();
    for (let i = 0; i < 1800; i++) {
        stepRace(s, { ...RACE_IDLE, right: true, down: i % 90 < 30 }, DT);
        drawRace(c.ctx, s, 'The Game');
    }
    assert.ok(c.ops > 0);
    assert.equal(c.depth, 0);
});

t('a whole pizza shift draws every frame', () => {
    const s = createRunState({ hasBoard: true, seed: 23, fitness: 1, focus: 1 } as never);
    const c = stubCtx();
    for (let i = 0; i < 3600; i++) {
        stepRun(s, {
            ...RUN_IDLE,
            right: true,
            up: i % 130 < 20,
            hop: i % 83 === 0,
            hold: i % 60 < 22,
        }, DT);
        const before = c.ops;
        drawRun(c.ctx, s);
        assert.ok(c.ops > before, `frame ${i} drew nothing`);
    }
    assert.equal(c.depth, 0, 'save/restore left unbalanced');
    assert.equal(c.minDepth, 0, 'restored more than was saved');
});

t('the shop BMX shift draws too', () => {
    const s = createRunState({ hasBoard: false, seed: 5, fitness: 0.92, focus: 0.5 } as never);
    const c = stubCtx();
    for (let i = 0; i < 1800; i++) {
        stepRun(s, { ...RUN_IDLE, right: true, down: i % 70 < 25 }, DT);
        drawRun(c.ctx, s);
    }
    assert.ok(c.ops > 0);
    assert.equal(c.depth, 0);
});

t('effects are cleaned up rather than accumulating across a run', () => {
    // A burst list that only grows is a leak that shows up as a slideshow after
    // two minutes, which is exactly the length nobody tests by hand.
    const s = createRaceState({ hasBoard: true, seed: 11, arms: [], fitness: 1 } as never);
    let peak = 0;
    for (let i = 0; i < 3600; i++) {
        stepRace(s, { ...RACE_IDLE, right: true, ollie: i % 40 === 0 }, DT);
        peak = Math.max(peak, s.bursts.length);
    }
    assert.ok(peak <= 14, `burst list reached ${peak}`);
});

console.log(`\n${pass} draw checks passed\n`);
