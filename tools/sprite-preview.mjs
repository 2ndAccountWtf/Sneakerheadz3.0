/**
 * Sprite preview harness.
 *
 * Pixel art cannot be reviewed by reading strings — it has to be looked at.
 * This renders every SpriteDef in data/sprites/ to a PNG contact sheet so
 * whoever is authoring can actually see the silhouette, the animation frames
 * and the palette choices.
 *
 *   node tools/sprite-preview.mjs [--out /tmp/sheet.png] [--scale 6] [--anim]
 *
 * --anim renders each sprite's frames overlaid with onion-skinning so you can
 * check a walk cycle actually moves rather than shuffling in place.
 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : fallback;
};
const OUT = argOf('--out', '/tmp/sprite-sheet.png');
const SCALE = Number(argOf('--scale', '6'));
const ONION = args.includes('--anim');

// Parse the palette out of the TS source rather than importing it, so this
// stays a zero-build script.
const paletteSrc = readFileSync(join(ROOT, 'systems/sprites/palette.ts'), 'utf8');
const chars = {};
for (const m of paletteSrc.matchAll(/'(.)':\s*('([^']*)'|null)/g)) chars[m[1]] = m[3] ?? null;

const defs = [];
for (const file of readdirSync(join(ROOT, 'data/sprites')).filter(f => f.endsWith('.ts'))) {
    const src = readFileSync(join(ROOT, 'data/sprites', file), 'utf8');
    for (const block of src.split(/export const SPR_/).slice(1)) {
        const id = block.match(/id:\s*'([^']+)'/)?.[1];
        const frames = [];
        for (const fm of block.matchAll(/\[\n((?:\s*'[^']*',\n)+)\s*\]/g)) {
            frames.push([...fm[1].matchAll(/'([^']*)'/g)].map(r => r[1]));
        }
        if (id && frames.length) defs.push({ id, frames, file });
    }
}

if (!defs.length) {
    console.error('No sprites found in data/sprites/');
    process.exit(1);
}

const perRow = 6;
const rows = Math.ceil(defs.length / perRow);
const maxFrames = Math.max(...defs.map(d => d.frames.length));
const cellW = 40 * SCALE * (ONION ? 1 : Math.min(maxFrames, 4)) + 60;
const cellH = 30 * SCALE + 46;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({
    viewport: { width: Math.min(2200, perRow * cellW + 40), height: rows * cellH + 40 },
});
await page.setContent(`<body style="margin:0;background:#0d1218;font-family:ui-monospace,monospace">
<div id="out" style="display:flex;flex-wrap:wrap;gap:20px;padding:20px;align-items:flex-start"></div></body>`);

const report = await page.evaluate(({ chars, defs, SCALE, ONION }) => {
    const out = document.getElementById('out');
    const notes = [];

    const paint = (ctx, frame, ox, alpha) => {
        const w = frame[0].length, h = frame.length;
        ctx.globalAlpha = alpha;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const col = chars[frame[y][x]];
            if (!col) continue;
            ctx.fillStyle = col;
            ctx.fillRect(ox + x * SCALE, y * SCALE, SCALE, SCALE);
        }
        ctx.globalAlpha = 1;
    };

    for (const def of defs) {
        const w = def.frames[0][0].length, h = def.frames[0].length;

        // Flag frames that are byte-identical to frame 0 — a "walk cycle"
        // where every frame matches is the most common authoring mistake.
        const dupes = def.frames.slice(1)
            .map((f, i) => (f.join('\n') === def.frames[0].join('\n') ? i + 1 : -1))
            .filter(i => i > 0);
        if (dupes.length) notes.push(`${def.id}: frame(s) ${dupes.join(',')} identical to frame 0`);

        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center';
        const strip = document.createElement('div');
        strip.style.cssText = 'display:flex;gap:8px;align-items:flex-end';

        if (ONION) {
            const c = document.createElement('canvas');
            c.width = w * SCALE; c.height = h * SCALE;
            c.style.cssText = 'image-rendering:pixelated;outline:1px solid #223040;background:#04060a';
            const ctx = c.getContext('2d');
            def.frames.forEach((f, i) => paint(ctx, f, 0, i === 0 ? 1 : 0.35));
            strip.appendChild(c);
        } else {
            for (const frame of def.frames.slice(0, 4)) {
                const c = document.createElement('canvas');
                c.width = w * SCALE; c.height = h * SCALE;
                c.style.cssText = 'image-rendering:pixelated;outline:1px solid #223040;background:#04060a';
                paint(c.getContext('2d'), frame, 0, 1);
                strip.appendChild(c);
            }
        }

        const label = document.createElement('div');
        label.textContent = `${def.id}  ${w}x${h}  ${def.frames.length}f`;
        label.style.cssText = 'color:#00e5c0;font-size:11px';
        wrap.appendChild(strip); wrap.appendChild(label);
        out.appendChild(wrap);
    }
    return notes;
}, { chars, defs, SCALE, ONION });

await page.screenshot({ path: OUT, fullPage: true });
await browser.close();

console.log(`Rendered ${defs.length} sprites -> ${OUT}`);
for (const d of defs) console.log(`  ${d.id.padEnd(14)} ${d.frames.length}f  (${d.file})`);
if (report.length) {
    console.log('\nWarnings:');
    for (const n of report) console.log('  ! ' + n);
}
