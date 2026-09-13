/**
 * Authored text has to survive the trip to the screen.
 *
 * Dialogue in this game supports exactly one placeholder,
 * `{{random_greeting}}`, resolved in `components/interactions/InteractionView`.
 * Nothing else in the pipeline substitutes anything into an `npcLine` — so any
 * other `{{token}}` an author writes goes to the player as literal braces, and
 * the only way to find out is for somebody to walk up to that NPC in that city
 * on the right day and read it.
 *
 * That is a bad way to find out. The check is cheap and the failure is
 * embarrassing, so it runs every build.
 */
import assert from 'node:assert/strict';
import { ALL_GAME_NPCS } from '../data/npcs.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

/** Must match InteractionView's GREETING_TOKEN. Asserted below. */
const GREETING_TOKEN = '{{random_greeting}}';

/** Every authored line in the game, with enough context to name the culprit. */
const allLines = (): { where: string; text: string }[] => {
    const out: { where: string; text: string }[] = [];
    for (const npc of ALL_GAME_NPCS as any[]) {
        for (const scenario of (npc.scenarios ?? [])) {
            for (const [nodeId, node] of Object.entries<any>(scenario.nodes ?? {})) {
                if (typeof node?.npcLine === 'string') {
                    out.push({ where: `${npc.id}/${scenario.id}/${nodeId}`, text: node.npcLine });
                }
                for (const c of (node?.choices ?? [])) {
                    if (typeof c?.playerLine === 'string') {
                        out.push({ where: `${npc.id}/${scenario.id}/${nodeId}:choice`, text: c.playerLine });
                    }
                }
            }
        }
        for (const pool of Object.values<any>(npc.dialogue ?? {})) {
            for (const line of (Array.isArray(pool) ? pool : [])) {
                if (typeof line === 'string') out.push({ where: `${npc.id}/dialogue`, text: line });
            }
        }
    }
    return out;
};

console.log('\nauthored content');

t('there is authored dialogue to check at all', () => {
    const lines = allLines();
    assert.ok(lines.length > 100, `only found ${lines.length} authored lines — the walk is not reaching the data`);
    console.log(`      (${lines.length} lines across ${ALL_GAME_NPCS.length} npcs)`);
});

t('no line ships a placeholder nothing knows how to resolve', () => {
    const bad: string[] = [];
    for (const { where, text } of allLines()) {
        for (const m of text.matchAll(/\{\{[^}]*\}\}/g)) {
            if (m[0] !== GREETING_TOKEN) bad.push(`${where}: ${m[0]}`);
        }
    }
    assert.deepEqual(bad, [], `unresolvable placeholders would render as literal braces:\n  ${bad.join('\n  ')}`);
});

t('every npc that greets with the token can actually produce a greeting', () => {
    // The token resolves out of `npc.dialogue`. An npc using it without any
    // dialogue pool falls back to a bare "..." — the character says nothing,
    // which is worse than the braces because it looks intentional.
    const mute: string[] = [];
    for (const npc of ALL_GAME_NPCS as any[]) {
        const usesToken = (npc.scenarios ?? []).some((sc: any) =>
            Object.values<any>(sc.nodes ?? {}).some(n => typeof n?.npcLine === 'string' && n.npcLine.includes(GREETING_TOKEN)));
        if (!usesToken) continue;
        const lines = Object.values<any>(npc.dialogue ?? {}).flat().filter((l: any) => typeof l === 'string');
        if (lines.length === 0) mute.push(npc.id);
    }
    assert.deepEqual(mute, [], `greet with {{random_greeting}} but have no dialogue to draw on: ${mute.join(', ')}`);
});

t('no authored line is blank or stray whitespace', () => {
    const blank = allLines().filter(l => l.text.trim().length === 0).map(l => l.where);
    assert.deepEqual(blank, [], `blank lines: ${blank.join(', ')}`);
});

t('no line still carries a single-brace template the dialogue path cannot fill', () => {
    // {sneaker_name} and friends are resolved in the SoleNet feed and the city
    // feed, never in scenario dialogue — one appearing here would render raw.
    const bad: string[] = [];
    for (const { where, text } of allLines()) {
        for (const m of text.matchAll(/\{[a-z_]+\}/g)) bad.push(`${where}: ${m[0]}`);
    }
    assert.deepEqual(bad, [], `unfilled templates in dialogue:\n  ${bad.join('\n  ')}`);
});

console.log(`\n${pass} content checks passed.\n`);
