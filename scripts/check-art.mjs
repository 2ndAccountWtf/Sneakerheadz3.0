#!/usr/bin/env node
/**
 * Does this art drop into the game, or does it need another pass?
 *
 * Art arrives one file at a time from outside the repo, and the two ways it
 * goes wrong are both invisible in a preview: a sheet delivered on a solid
 * white background looks perfect on a white page and paints a white box in a
 * near-black cabin, and a sheet whose width does not divide by its frame count
 * slices off-centre so every frame after the first drifts sideways. Neither
 * throws. Both are found by a person squinting at the game a week later.
 *
 * So this answers the question mechanically. Run it on the folder and it says,
 * per file: the dimensions, whether there is an alpha channel at all, whether
 * the background is actually transparent, whether the frame count divides, and
 * how the size compares with what `docs/ASSETS-FLIGHT404.md` asked for.
 *
 * No dependencies — it decodes the PNG itself, because adding an image library
 * to this project to check image files would be a worse trade than eighty lines
 * of filter arithmetic.
 *
 *   node scripts/check-art.mjs [folder]
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { decodePng } from './lib/png.mjs';

const FOLDER = process.argv[2] ?? 'assets/art/flight404';

// --- PNG, enough of it ------------------------------------------------------

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function readPng(buf) {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
    let pos = 8;
    let ihdr = null;
    const idat = [];
    let palette = null, trns = null;

    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            ihdr = {
                width: data.readUInt32BE(0),
                height: data.readUInt32BE(4),
                depth: data[8],
                colour: data[9],
                interlace: data[12],
            };
        } else if (type === 'PLTE') palette = data;
        else if (type === 'tRNS') trns = data;
        else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        pos += 12 + len;
    }
    if (!ihdr) throw new Error('no IHDR');
    return { ...ihdr, idat: Buffer.concat(idat), palette, trns };
}

const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Returns a width*height array of alpha 0-255, or null if it cannot decode. */
function alphaMap(png) {
    if (png.interlace !== 0 || png.depth !== 8) return null;
    const ch = CHANNELS[png.colour];
    if (!ch) return null;

    const raw = inflateSync(png.idat);
    const bpp = ch;
    const stride = png.width * bpp;
    const out = Buffer.alloc(png.height * stride);

    let ri = 0;
    for (let y = 0; y < png.height; y++) {
        const filter = raw[ri++];
        const line = raw.subarray(ri, ri + stride);
        ri += stride;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? cur[x - bpp] : 0;
            const b = prev ? prev[x] : 0;
            const c = prev && x >= bpp ? prev[x - bpp] : 0;
            const v = line[x];
            cur[x] = (
                filter === 0 ? v :
                filter === 1 ? v + a :
                filter === 2 ? v + b :
                filter === 3 ? v + ((a + b) >> 1) :
                filter === 4 ? v + paeth(a, b, c) : v
            ) & 0xff;
        }
    }

    const alpha = new Uint8Array(png.width * png.height);
    const hasAlpha = png.colour === 4 || png.colour === 6;
    for (let i = 0; i < alpha.length; i++) {
        if (hasAlpha) alpha[i] = out[i * bpp + bpp - 1];
        else if (png.colour === 3 && png.trns) {
            const idx = out[i * bpp];
            alpha[i] = idx < png.trns.length ? png.trns[idx] : 255;
        } else alpha[i] = 255;
    }
    return alpha;
}

/**
 * The scale art should arrive at.
 *
 * The asset list quotes sizes in WORLD UNITS, because that is what the level
 * geometry is authored in. The canvas is 960 device pixels across a 352-unit
 * world, so one world unit is 2.727 device pixels, and a sprite drawn on that
 * grid maps one-for-one with no resampling at all.
 *
 * Read from `content.ts` rather than repeated here: a checker that hard-codes
 * the number it is checking goes stale the first time the canvas changes and
 * then confidently approves the wrong thing.
 */
function artScale(folder) {
    // The two games do not share a number and never did. Flight 404 renders its
    // 352-unit world into a canvas ZOOM times wider, so its art scale is that
    // ratio and moves when the constant does. The canvas games scale to the
    // display instead, so theirs is the cap on that scaling -- MAX_STORE_SCALE,
    // which is the most device pixels one logical pixel can ever be given.
    // Reading both from source keeps this honest when either moves.
    if (/street|characters|rooftop/.test(folder)) {
        const src = readFileSync('components/minigames/engine/GameCanvas.tsx', 'utf8');
        const m = /MAX_STORE_SCALE = (\d+)/.exec(src);
        return m ? +m[1] : 8;
    }
    const src = readFileSync('components/minigames/phaser/flight404/content.ts', 'utf8');
    const w = /RENDER_W = (\d+)/.exec(src);
    const v = /VIEW_W = (\d+)/.exec(src);
    return w && v ? +w[1] / +v[1] : 1;
}
const SCALE = artScale(FOLDER);

// --- what the asset document asked for --------------------------------------

/**
 * Which briefs describe this folder.
 *
 * Each game's art has its own document and its own rules — Flight 404 is a flat
 * side elevation, the street games are a 3/4 high angle — so checking a street
 * delivery against the aeroplane brief would report every file as unknown and
 * teach whoever is delivering to ignore the output.
 */
const BRIEFS = {
    'assets/art/street': ['docs/ASSETS-STREET.md'],
    'assets/art/characters': ['docs/ASSETS-CHARACTERS.md'],
    'assets/art/flight404': ['docs/ASSETS-FLIGHT404.md', 'docs/ASSETS-FLIGHT404-REMAINING.md'],
};

function briefsFor(folder) {
    const key = Object.keys(BRIEFS).find((k) => folder.replace(/\/+$/, '').endsWith(k.split('/').pop()));
    return (key ? BRIEFS[key] : Object.values(BRIEFS).flat()).filter(existsSync);
}

function specSizes() {
    const out = new Map();
    for (const doc of briefsFor(FOLDER)) {
        for (const line of readFileSync(doc, 'utf8').split('\n')) {
            // Table row:  | `id` | 34 × 30 | 6 | ...
            const row = line.match(/^\|\s*`([a-z0-9-]+)`\s*\|\s*(\d+)\s*[×x]\s*(\d+)\s*\|\s*(\d+)/i);
            if (row && !out.has(row[1])) out.set(row[1], { w: +row[2], h: +row[3], frames: +row[4] });
            // Block heading:  ### `id` — 34 × 30, 6 frames
            const head = line.match(/^###\s+`([a-z0-9-]+)`\s*[—-]\s*(\d+)\s*[×x]\s*(\d+)\s*,\s*(\d+)\s*frames?/i);
            if (head && !out.has(head[1])) out.set(head[1], { w: +head[2], h: +head[3], frames: +head[4] });
        }
    }
    return out;
}

// --- the check --------------------------------------------------------------

/**
 * Ids that are meant to be opaque from edge to edge.
 *
 * A character sprite whose border is fully opaque is on a matte and will paint
 * a box. A tiling road surface whose border is fully opaque is simply a road —
 * the whole job of `road-asphalt` is to be a continuous surface. Flagging those
 * as broken trains whoever is delivering to ignore the checker, which is worse
 * than not having one.
 *
 * Read from the briefs rather than guessed from the name. The first version of
 * this was a regex over id prefixes and it did not know that `road-asphalt`,
 * `wall-breeze` and `drain-grate` are surfaces — so three correct files were
 * reported as blockers. The documents already say which assets tile; that is
 * the same fact, written down once, by the person who decided it.
 */
function fullBleedIds() {
    const out = new Set();
    for (const doc of briefsFor(FOLDER)) {
        for (const line of readFileSync(doc, 'utf8').split('\n')) {
            const m = line.match(/^###\s+`([a-z0-9-]+)`/);
            if (m && /tileable/i.test(line)) out.add(m[1]);
        }
    }
    // Decals that lie flat on the road are solid by nature even when they do
    // not tile: a drain cover is metal all the way to its own edge.
    for (const id of ['drain-grate', 'manhole', 'road-crack', 'skid-mark']) out.add(id);
    return out;
}

const FULL_BLEED = fullBleedIds();

const spec = specSizes();
if (!existsSync(FOLDER)) {
    console.log(`\nNo folder at ${FOLDER} yet — create it and drop PNGs in.\n`);
    process.exit(0);
}
/**
 * Every PNG under the folder, including subfolders.
 *
 * Art arrives organised — a `skyline-kit/towers/` here, a `billboards/` there —
 * and the loader globs recursively, so a checker that only read the top level
 * reported 73 files where the game was loading 112. A checker that sees less
 * than the game does is worse than none, because it says "all ready" about a
 * set it never looked at.
 */
/**
 * How much real drawing is inside this file?
 *
 * A file's dimensions say nothing about its detail. `car-taxi.png` shipped at
 * 102x57 and contained roughly a 21x11 drawing: it had been reduced to a fifth
 * of its delivered size somewhere in the export and enlarged back, so each
 * pixel of the original covered a 5x5 block. Every size check above passed. It
 * looked, in the game, like mush -- and the replacement, the same nominal
 * 102x57, carried ~59x33 and looked like a different asset entirely.
 *
 * Enlarging repeats pixels exactly, so the giveaway is run length: count how
 * often a pixel differs from the one before it, along both axes. A drawing
 * authored at its delivered size changes almost every pixel (runs near 1); one
 * enlarged 3x changes every third (runs near 3). Taking the smaller of the two
 * axes is deliberate -- a run of 3 across and 1 down is a wide-pixel artefact,
 * not a 3x enlargement.
 *
 * Flat regions inflate the number honestly (a clear sky really is one colour),
 * so this only ever warns.
 */
function effectiveGrid(img) {
    const { width: W, height: H, rgba } = img;
    if (!rgba || W < 4 || H < 4) return null;
    const same = (i, j) => rgba[i] === rgba[j] && rgba[i + 1] === rgba[j + 1]
        && rgba[i + 2] === rgba[j + 2] && rgba[i + 3] === rgba[j + 3];
    // Ignore fully transparent pixels: a big empty margin is not detail, and
    // counting it as one long run would condemn every sprite with padding.
    let hCells = 0, hRuns = 0, vCells = 0, vRuns = 0;
    for (let y = 0; y < H; y++) for (let x = 1; x < W; x++) {
        const i = (y * W + x) * 4, j = i - 4;
        if (rgba[i + 3] < 8 && rgba[j + 3] < 8) continue;
        hCells++; if (!same(i, j)) hRuns++;
    }
    for (let x = 0; x < W; x++) for (let y = 1; y < H; y++) {
        const i = (y * W + x) * 4, j = i - W * 4;
        if (rgba[i + 3] < 8 && rgba[j + 3] < 8) continue;
        vCells++; if (!same(i, j)) vRuns++;
    }
    if (!hCells || !vCells) return null;

    // Flat art is flat on purpose. A far-skyline silhouette is two colours by
    // design, so its runs are enormous and mean nothing -- reporting it as lost
    // detail is how a check like this stops being read. Count the palette and
    // bow out when there is barely one.
    const cols = new Set();
    for (let i = 0; i < rgba.length && cols.size <= 24; i += 4)
        if (rgba[i + 3] > 8) cols.add((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
    if (cols.size <= 24) return { flat: true, palette: cols.size };

    const hRun = hCells / Math.max(1, hRuns);
    const vRun = vCells / Math.max(1, vRuns);
    const block = Math.min(hRun, vRun);
    return { block, w: W / block, h: H / block };
}

const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    return statSync(full).isDirectory() ? walk(full) : (/\.png$/i.test(f) ? [full] : []);
});
const files = walk(FOLDER).map(f => f.slice(FOLDER.replace(/\/+$/, '').length + 1));
if (!files.length) {
    console.log(`\n${FOLDER} is empty. Nothing to check.\n`);
    process.exit(0);
}

console.log(`\nChecking ${files.length} file(s) in ${FOLDER}`);
console.log(/street|characters|rooftop/.test(FOLDER)
    ? `A phone held sideways shows ${Math.round(320 * SCALE)}px across a 320-unit grid, so 1 unit = up to ${SCALE.toFixed(0)} device pixels.\n`
    : `Canvas is ${Math.round(352 * SCALE)}px across a 352-unit world, so 1 world unit = ${SCALE.toFixed(3)} device pixels.\n`);
let blockers = 0, warnings = 0;

for (const file of files.sort()) {
    // Subfolders organise a delivery; the id is the filename alone, because
    // that is what the game asks for.
    const base = (file.split('/').pop() ?? file).replace(/\.png$/i, '');
    const m = base.match(/^(.+?)@(\d+)$/);
    const id = m ? m[1] : base;
    const frames = m ? +m[2] : (spec.get(base)?.frames ?? 1);
    const problems = [], notes = [];

    let png;
    try { png = readPng(readFileSync(join(FOLDER, file))); }
    catch (e) { console.log(`✗ ${file}\n    unreadable: ${e.message}\n`); blockers++; continue; }

    const fw = png.width / frames;

    // 1. Transparency, which is the one that silently ruins a dark cabin.
    const alpha = alphaMap(png);
    if (!CHANNELS[png.colour]) notes.push('unusual colour type; could not inspect alpha');
    else if (png.colour === 0 || png.colour === 2) {
        problems.push('NO ALPHA CHANNEL — this is opaque RGB. Re-export as RGBA with a transparent background.');
    } else if (alpha) {
        const edge = [];
        for (let x = 0; x < png.width; x++) { edge.push(alpha[x], alpha[(png.height - 1) * png.width + x]); }
        for (let y = 0; y < png.height; y++) { edge.push(alpha[y * png.width], alpha[y * png.width + png.width - 1]); }
        const opaqueEdge = edge.filter(a => a > 250).length / edge.length;
        const anyClear = alpha.some(a => a < 16);
        const fullBleed = FULL_BLEED.has(id);
        if (opaqueEdge > 0.9 && !fullBleed) {
            problems.push(`background is SOLID (${Math.round(opaqueEdge * 100)}% of the border is opaque) — the cabin is near-black, so this paints a box. \`node scripts/prep-art.mjs <file>\` keys it out.`);
        } else if (opaqueEdge > 0.9) {
            notes.push('opaque edge to edge, which is right for a tiling surface');
        } else if (!anyClear && !fullBleed) {
            problems.push('no transparent pixels anywhere — the background is filled in');
        }
    }

    // 2. Frame slicing.
    if (png.width % frames !== 0) {
        problems.push(`${png.width}px does not divide into ${frames} frames — frames must be equal width with no padding`);
    }

    // 3. Size against the brief.
    const want = spec.get(id);
    if (want) {
        const ratio = fw / want.w;
        const ideal = { w: Math.round(want.w * SCALE), h: Math.round(want.h * SCALE) };
        if (Math.abs(ratio - SCALE) < 0.06) {
            notes.push(`native resolution — ${ideal.w}×${ideal.h} is exactly ${want.w}×${want.h} world units, nothing is resampled`);
        } else if (Math.abs(ratio - 1) < 0.02) {
            notes.push(`drawn at world size (${want.w}×${want.h}). It will work, but it is ${SCALE.toFixed(2)}× softer than the canvas can show — ${ideal.w}×${ideal.h} is the sharp size`);
        } else if (ratio > SCALE + 0.06) {
            notes.push(`${ratio.toFixed(2)}× world size, above the ${SCALE.toFixed(2)}× the canvas can show — it will be downscaled. Fine, just wasted detail; ${ideal.w}×${ideal.h} is exact`);
        } else {
            problems.push(`frame is ${Math.round(fw)}×${png.height}. Deliver ${ideal.w}×${ideal.h} (${want.w}×${want.h} world units × ${SCALE.toFixed(2)}) — this size lands between grids and will resample`);
        }
        if (want.frames !== frames) notes.push(`${frames} frames delivered, ${want.frames} asked for — fine, the @N in the filename wins`);
    } else {
        notes.push(`"${id}" is not in the asset list — it will still load, but nothing in the game draws that id yet`);
    }

    // 4. Real detail, which every other check above is blind to.
    // `readPng` above only parses the header; this needs actual pixels.
    let grid = null;
    try { grid = effectiveGrid(decodePng(readFileSync(join(FOLDER, file)))); }
    catch { /* an exotic PNG; the checks above already said what they could */ }
    if (grid && grid.flat) {
        notes.push(`flat art (${grid.palette} colours) — detail check skipped, which is right for a silhouette`);
    } else if (grid && grid.block >= 2.2) {
        const line = `contains only about ${Math.round(grid.w)}x${Math.round(grid.h)} of real drawing in a `
            + `${png.width}x${png.height} file (pixels repeat in runs of ${grid.block.toFixed(1)}). `
            + `That is a reduction to roughly 1/${Math.round(grid.block)} of this size, enlarged back. `
            + `Re-export once from the master straight to ${png.width}x${png.height}.`;
        // Always a note, never a blocker. The signal is strong but not proof --
        // a deliberately simple drawing reads the same way -- and a check that
        // fails the build on an inference is a check somebody turns off.
        notes.push(line);
    } else if (grid) {
        notes.push(`detail is native to the file (runs of ${grid.block.toFixed(1)})`);
    }

    const ok = problems.length === 0;
    blockers += problems.length ? 1 : 0;
    warnings += notes.length && ok ? 0 : 0;
    console.log(`${ok ? '✓' : '✗'} ${file}`);
    console.log(`    ${png.width}×${png.height}, ${frames} frame(s) of ${Math.round(fw)}×${png.height}`);
    for (const p of problems) console.log(`    BLOCKER  ${p}`);
    for (const n of notes) console.log(`    note     ${n}`);
    console.log('');
}

console.log(blockers
    ? `${blockers} file(s) need another pass.\n`
    : `All ${files.length} ready to drop in.\n`);
