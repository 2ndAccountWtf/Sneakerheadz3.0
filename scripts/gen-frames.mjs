#!/usr/bin/env node
/**
 * Regenerate `sheets.ts` from the asset list.
 *
 * The frame counts live in `docs/ASSETS-FLIGHT404.md` because that is the
 * document an artist reads, and they have to reach the loader because a sheet
 * with no `@N` in its filename is otherwise assumed to be one frame — which
 * draws the whole strip at once and looks like a rendering bug rather than a
 * naming one. Generating rather than hand-maintaining means the table cannot
 * drift from the brief it came from.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const doc = readFileSync('docs/ASSETS-FLIGHT404.md', 'utf8');
const found = new Map();
for (const line of doc.split('\n')) {
    const m = line.match(/^\|\s*`([a-z0-9-]+)`\s*\|\s*\d+\s*[×x]\s*\d+\s*\|\s*(\d+)\s*\|/);
    if (m && !found.has(m[1])) found.set(m[1], Number(m[2]));
}
const rows = [...found.entries()].filter(([, n]) => n > 1).sort(([a], [b]) => a.localeCompare(b));
const body = rows.map(([id, n]) => `    '${id}': ${n},`).join('\n');

const head = readFileSync('components/minigames/phaser/flight404/sheets.ts', 'utf8')
    .split('export const SHEET_FRAMES')[0];

writeFileSync('components/minigames/phaser/flight404/sheets.ts',
    `${head}export const SHEET_FRAMES: Record<string, number> = {\n${body}\n};\n\n` +
    `/** Frames for an id: the filename's \`@N\` first, then the asset list, then one. */\n` +
    `export const framesFor = (id: string, fromName?: number): number =>\n` +
    `    fromName ?? SHEET_FRAMES[id] ?? 1;\n`);
console.log(`sheets.ts: ${rows.length} multi-frame ids from the asset list`);
