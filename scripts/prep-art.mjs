#!/usr/bin/env node
/**
 * Make a delivered sheet droppable.
 *
 * The loader slices a sheet arithmetically — `frameWidth = width / frames` —
 * because that is the only rule an artist can hold in their head and the only
 * one that needs no metadata. It is also unforgiving: a sheet where the figure
 * drifts inside its cell, or where the frames are separated by a gutter, or
 * where there is 40px of empty canvas on the right, slices off-centre and every
 * frame after the first walks sideways as it animates.
 *
 * Rather than ask for that by hand, this finds the frames and re-emits them on
 * a uniform grid. It also keys a solid background to transparent, which is the
 * other failure that looks perfect in a preview and paints a white box in a
 * near-black cabin.
 *
 *   node scripts/prep-art.mjs in.png --frames 8 --out assets/art/flight404/cross-bicycle@8.png
 *   node scripts/prep-art.mjs in.png --key            # strip a solid background
 *   node scripts/prep-art.mjs in.png --scale 0.5      # integer-ish downscale
 *
 * Nothing here is clever about the art. It only moves rectangles and drops a
 * background colour, because anything more would be a filter applied to
 * somebody else's drawing without asking.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { decodePng, encodePng } from './lib/png.mjs';

const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith('--'));
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const has = n => args.includes(`--${n}`);

if (!input) {
    console.log('usage: node scripts/prep-art.mjs <in.png|folder> [--frames N] [--scale F] [--out path]');
    console.log('       a folder prepares every PNG in it, taking the frame count from the @N in each name');
    process.exit(1);
}

/**
 * A folder prepares everything in it in one go.
 *
 * Art arrives in batches, and asking somebody to run a command per file is
 * asking them to skip the command. The frame count comes from each filename's
 * `@N`, which is the same rule the game itself uses, so a correctly named drop
 * needs no arguments at all.
 */
if (statSync(input).isDirectory()) {
    const dest = flag('out', 'assets/art/flight404');
    mkdirSync(dest, { recursive: true });
    const files = readdirSync(input).filter(f => /\.png$/i.test(f));
    if (!files.length) { console.log(`\nNo PNGs in ${input}.\n`); process.exit(0); }
    console.log(`\nPreparing ${files.length} file(s) from ${input} into ${dest}\n`);
    let ok = 0;
    for (const f of files.sort()) {
        try {
            const m = basename(f).replace(/\.png$/i, '').match(/@(\d+)$/);
            const argv = [process.argv[0], process.argv[1], join(input, f), '--out', join(dest, f)];
            if (m) argv.push('--frames', m[1]);
            const { execFileSync } = await import('node:child_process');
            execFileSync(process.argv[0], argv.slice(1), { stdio: 'inherit' });
            ok++;
        } catch (e) {
            console.log(`  ! ${f}: ${e.message.split('\n')[0]}`);
        }
    }
    console.log(`\n${ok}/${files.length} prepared. Now run: node scripts/check-art.mjs\n`);
    process.exit(0);
}

const img = decodePng(readFileSync(input));
console.log(`\n${input}: ${img.width}×${img.height}, colour type ${img.colour}`);

// --- 1. Key out a solid background -----------------------------------------
//
// The corners agreeing on a colour is the signal. A drawing whose four corners
// are the same opaque colour is a drawing on a matte; one that is already cut
// out has transparent corners and is left alone.
const corner = i => [img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2], img.rgba[i * 4 + 3]];
const corners = [0, img.width - 1, (img.height - 1) * img.width, img.height * img.width - 1].map(corner);
const opaqueCorners = corners.filter(c => c[3] > 250);
const sameColour = opaqueCorners.length === 4 &&
    opaqueCorners.every(c => Math.abs(c[0] - opaqueCorners[0][0]) < 10
        && Math.abs(c[1] - opaqueCorners[0][1]) < 10
        && Math.abs(c[2] - opaqueCorners[0][2]) < 10);

if (sameColour && (has('key') || true)) {
    const [r, g, b] = opaqueCorners[0];
    const tol = Number(flag('tolerance', 12));
    let cleared = 0;
    // Flood from the edges rather than keying every matching pixel, so a white
    // highlight inside the drawing survives. A global colour key is how you end
    // up with holes in somebody's artwork.
    const seen = new Uint8Array(img.width * img.height);
    const stack = [];
    for (let x = 0; x < img.width; x++) { stack.push(x, (img.height - 1) * img.width + x); }
    for (let y = 0; y < img.height; y++) { stack.push(y * img.width, y * img.width + img.width - 1); }
    while (stack.length) {
        const i = stack.pop();
        if (i < 0 || i >= seen.length || seen[i]) continue;
        const o = i * 4;
        if (img.rgba[o + 3] < 250) { seen[i] = 1; continue; }
        if (Math.abs(img.rgba[o] - r) > tol || Math.abs(img.rgba[o + 1] - g) > tol || Math.abs(img.rgba[o + 2] - b) > tol) continue;
        seen[i] = 1;
        img.rgba[o + 3] = 0;
        cleared++;
        const x = i % img.width, y = (i / img.width) | 0;
        if (x > 0) stack.push(i - 1);
        if (x < img.width - 1) stack.push(i + 1);
        if (y > 0) stack.push(i - img.width);
        if (y < img.height - 1) stack.push(i + img.width);
    }
    console.log(`  keyed out rgb(${r},${g},${b}) from the edges — ${cleared} pixels now transparent`);
} else {
    console.log('  background already transparent, left alone');
}

// --- 2. Find the frames ------------------------------------------------------
const colHasInk = new Array(img.width).fill(false);
for (let x = 0; x < img.width; x++) {
    for (let y = 0; y < img.height; y++) {
        if (img.rgba[(y * img.width + x) * 4 + 3] > 8) { colHasInk[x] = true; break; }
    }
}
const spans = [];
let start = -1;
for (let x = 0; x <= img.width; x++) {
    if (x < img.width && colHasInk[x]) { if (start < 0) start = x; }
    else if (start >= 0) { spans.push([start, x - 1]); start = -1; }
}
// Spans separated by a hair are one frame with a gap in the drawing, not two.
const GLUE = Number(flag('glue', 3));
const merged = [];
for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] - last[1] <= GLUE) last[1] = s[1];
    else merged.push([...s]);
}
console.log(`  found ${merged.length} ink column-group(s)`);

/**
 * No `--frames` means one frame, not "however many ink groups I found".
 *
 * This is the same rule the game uses: a file without an `@N` in its name is a
 * single sprite. Guessing from the drawing instead would shred a tiling cabin
 * wall into six frames the first time it had six windows in it — which it did,
 * the first time this ran over a folder.
 */
const wanted = args.includes('--frames') ? Number(flag('frames', 1)) : 1;
let frames = wanted === 1 ? [[Math.min(...merged.map(m => m[0])), Math.max(...merged.map(m => m[1]))]] : merged;
if (!merged.length) frames = [[0, img.width - 1]];
else if (wanted > 1 && merged.length !== wanted) {
    console.log(`  ${merged.length} ink groups but --frames ${wanted}: falling back to even division`);
    const cw = img.width / wanted;
    frames = [...Array(wanted)].map((_, i) => [Math.round(i * cw), Math.round((i + 1) * cw) - 1]);
}

// Vertical extent, shared by every frame so feet stay on one line.
let top = img.height, bottom = 0;
for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
        if (img.rgba[(y * img.width + x) * 4 + 3] > 8) { if (y < top) top = y; if (y > bottom) bottom = y; break; }
    }
}
if (top > bottom) { top = 0; bottom = img.height - 1; }

// --- 3. Re-emit on a uniform grid -------------------------------------------
const cellW = Math.max(...frames.map(([a, b]) => b - a + 1));
const cellH = bottom - top + 1;
const scale = Number(flag('scale', 1));
const outW = Math.max(1, Math.round(cellW * scale));
const outH = Math.max(1, Math.round(cellH * scale));

const sheet = new Uint8Array(outW * frames.length * outH * 4);
const sheetW = outW * frames.length;
frames.forEach(([a, b], i) => {
    const fw = b - a + 1;
    // Centre each frame in its cell. A drifting figure is the single most
    // common thing wrong with a delivered sheet and it is invisible until it
    // animates, at which point the character appears to slide.
    const pad = Math.floor((cellW - fw) / 2);
    for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) {
            const sx = a - pad + Math.floor(x / scale);
            const sy = top + Math.floor(y / scale);
            if (sx < a - pad || sx >= img.width || sy >= img.height) continue;
            const src = (sy * img.width + sx) * 4;
            const dst = (y * sheetW + i * outW + x) * 4;
            if (sx < 0) continue;
            sheet.set(img.rgba.subarray(src, src + 4), dst);
        }
    }
});

const out = flag('out', input.replace(/\.png$/i, `@${frames.length}.png`));
writeFileSync(out, encodePng(sheetW, outH, sheet));
console.log(`\n  wrote ${out}`);
console.log(`  ${sheetW}×${outH} — ${frames.length} frames of ${outW}×${outH}, evenly spaced\n`);
