/**
 * NPC Relations
 * =============
 * Who likes whom. The cast already had this baked into their dialogue —
 * Bibi's `rivals` bank sneers at Yasser by name, ADC's `onYasser` bank
 * gushes over him, `adc-vs-bibi` in data/npcs/adc.ts stages their collision
 * directly — but none of it was ever data. This file is that graph, made
 * explicit and queryable, so systems/npc/reactions.ts can spread standing
 * across it (burn one hustler, cool his ally) and stage encounters between
 * NPCs who happen to be scheduled into the same place at the same time.
 *
 * `a`/`b` order matters for the two directional kinds: for `oblivious-fan`,
 * `a` is the fan and `b` is the (usually oblivious) object of admiration;
 * for `blames`, `a` is the one doing the blaming. `allies`, `rivals` and
 * `feud` are symmetric — order is cosmetic for those three.
 *
 * npcIds here are the bare ids used throughout — and, since the celebrity
 * profiles were reconciled, the same ids `ALL_CELEBRITIES[i].id` reports.
 */

export type RelationKind = 'allies' | 'rivals' | 'feud' | 'oblivious-fan' | 'blames';

export interface Relation {
    a: string;
    b: string;
    kind: RelationKind;
    note: string;
}

export const NPC_RELATIONS: Relation[] = [
    {
        a: 'bibi', b: 'yasser-abbasfat', kind: 'feud',
        note: 'Bibi calls him noise with no leverage; Yasser calls him the architect of literally everything wrong with everything.',
    },
    {
        a: 'adc', b: 'yasser-abbasfat', kind: 'oblivious-fan',
        note: "She agrees with every word he shouts and could not repeat a single one of them under oath.",
    },
    {
        a: 'adc', b: 'bibi', kind: 'feud',
        note: 'She has a forty-page position paper on him and has never spoken to him. He has security for exactly this reason.',
    },
    {
        a: 'grandma-laces', b: 'the-game', kind: 'blames',
        note: 'The chocolate milk, the Pico-coin, the noise outside her window at 2am — as far as she is concerned, it was him.',
    },
    {
        a: 'scalper-sid', b: 'gutter-gabe', kind: 'allies',
        note: 'Different corners of the same racket. Professional courtesy between two different kinds of con.',
    },
    {
        a: 'the-game', b: 'gutter-gabe', kind: 'rivals',
        note: "Two hustlers, one turf. Neither of them will use the word 'turf' out loud.",
    },
    {
        a: 'bibi', b: 'donald-drip', kind: 'allies',
        note: 'A collab neither of them can fully explain the terms of, and both of them take full credit for.',
    },
    {
        a: 'yasser-abbasfat', b: 'donald-drip', kind: 'feud',
        note: 'Neither has ever met the other. Both bring the other up, unprompted, constantly.',
    },
    {
        a: 'wiz-k', b: 'bro-jogan', kind: 'allies',
        note: "Wiz K doesn't understand the elk theory. Wiz K supports the elk theory completely.",
    },
    {
        // "Y Dol" is Bibi's own nickname for Yasser (see data/npcs/bibi.ts's
        // `rivals` dialogue bank) — there is no separate NPC by that name in
        // data/npcs or data/celebrities, so this relation is written against
        // the one real character it can only sensibly refer to. If a
        // distinct "Y Dol" character gets added later, this entry should
        // move to point at them instead.
        a: 'bro-jogan', b: 'yasser-abbasfat', kind: 'rivals',
        note: "Bro Jogan considers him a rival for the same rage-bait attention economy. Yasser considers him an unserious American distraction from the struggle.",
    },
    {
        a: 'clerk-israeli-af', b: 'bibi', kind: 'oblivious-fan',
        note: "He has never met him either, but he'll defend him for a full shift if you let him.",
    },
];

function other(r: Relation, npcId: string): string {
    return r.a === npcId ? r.b : r.a;
}

export function relationsInvolving(npcId: string): Relation[] {
    return NPC_RELATIONS.filter(r => r.a === npcId || r.b === npcId);
}

export function relationBetween(a: string, b: string): Relation | undefined {
    return NPC_RELATIONS.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

/** Symmetric goodwill only — `oblivious-fan` and `blames` are one-directional
 *  and deliberately excluded, since neither implies the other side feels it back. */
export function alliesOf(npcId: string): string[] {
    return relationsInvolving(npcId).filter(r => r.kind === 'allies').map(r => other(r, npcId));
}

/** Everyone with an adversarial stake in this NPC, including the one-directional
 *  `blames` (the blamer resents them even if it isn't mutual). */
export function enemiesOf(npcId: string): string[] {
    return relationsInvolving(npcId)
        .filter(r => r.kind === 'rivals' || r.kind === 'feud' || r.kind === 'blames')
        .map(r => other(r, npcId));
}

/** Display names for the roster this graph covers, used by reactions.ts to
 *  narrate co-presence events without importing the full NPC profiles (which
 *  would pull scenario content this module has no business depending on). */
export const NPC_DISPLAY_NAMES: Record<string, string> = {
    bibi: 'Bibi Neta',
    adc: 'ADC',
    'grandma-laces': 'Grandma Laces',
    'wiz-k': 'Wiz K',
    'gutter-gabe': 'Gutter Gabe',
    'scalper-sid': 'Scalper Sid',
    'clerk-israeli-af': 'The AM/PM Clerk',
    'tsa-agent': 'The TSA Agent',
    'the-game': 'The Game',
    'bro-jogan': 'Bro Jogan',
    'yasser-abbasfat': 'Yasser Abbasfat',
    'donald-drip': 'Donald Drip',
};

export const nameOf = (npcId: string): string => NPC_DISPLAY_NAMES[npcId] ?? npcId;
