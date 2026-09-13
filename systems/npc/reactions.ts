/**
 * NPC Reactions
 * =============
 * What the world does about your reputation. `memory.ts` remembers specific
 * events and `data/npcRelations.ts` knows who likes whom; this module is
 * where those combine into behaviour — a greeting that reflects everything
 * an NPC knows about you, a door that stays shut because of it, and standing
 * that doesn't stay contained to the one NPC you actually dealt with.
 *
 * `reputationSpread` is the piece that turns a cast list into a social graph:
 * burn Scalper Sid and his ally Gutter Gabe cools on you too, without you
 * ever having met Gabe that day; impress Bibi and his rival Yasser sours,
 * for the same reason two friends don't independently decide to like the
 * person who wronged their friend.
 *
 * Pure functions over `Player` plus data, same as everywhere else in
 * systems/ — no React, no dispatch, no reducer writes.
 */
import type { Player, Connection } from '../../types';
import type { ScenarioOutcome } from '../../types/interactions';
import { attitudeOf, callback } from './memory';
import { relationBetween, relationsInvolving, nameOf, type RelationKind } from '../../data/npcRelations';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** FNV-1a + mulberry32, same recipe as data/ampm/shelfSpecials.ts and
 *  systems/npc/schedule.ts — kept local rather than imported so this module
 *  doesn't reach into schedule.ts's internals for a ten-line utility. */
function hashString(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const pickWith = <T,>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

// --- greetingFor -----------------------------------------------------------

const GREETING_TIERS: ReadonlyArray<{ min: number; lines: string[] }> = [
    {
        min: 60,
        lines: [
            'They light up when they see you.',
            "\"Oh, it's you.\" They actually mean it.",
            "They wave you over before you've said a word.",
        ],
    },
    {
        min: 20,
        lines: [
            "A decent nod. Not nothing, around here.",
            '"Hey. You\'re alright." High praise, on this street.',
            'They remember your face without having to think about it.',
        ],
    },
    {
        min: -20,
        lines: [
            'A flat, functional greeting. Business as usual.',
            'They look up, register you, look back down.',
            'Neither warm nor cold. Just transactional.',
        ],
    },
    {
        min: -60,
        lines: [
            "They don't quite look at you.",
            '"You again." Not a question.',
            'A greeting with the temperature turned down.',
        ],
    },
    {
        min: -Infinity,
        lines: [
            'They see you and their whole posture changes.',
            '"Oh, GREAT." Loudly. On purpose.',
            "They don't bother pretending to be glad.",
        ],
    },
];

/**
 * How an NPC greets you given everything they know: a tone set by
 * `attitudeOf` (memories plus Connection standing), topped with a specific
 * callback line when one exists — the "you still owe me five dollars"
 * moment — and a refusal note when they genuinely won't deal with you.
 */
export function greetingFor(player: Player, npcId: string, day: number): string {
    const attitude = attitudeOf(player, npcId);
    const rng = seeded(hashString(`greeting:${npcId}:${day}:${attitude}`));
    const tier = GREETING_TIERS.find(t => attitude >= t.min) ?? GREETING_TIERS[GREETING_TIERS.length - 1];
    const base = pickWith(tier.lines, rng);
    const line = callback(player, npcId);
    const refusal = refusesYou(player, npcId);

    let greeting = line ? `${base} ${line}` : base;
    if (refusal.refuses && refusal.reason && refusal.reason !== line) {
        greeting += ` ${refusal.reason}`;
    }
    return greeting;
}

// --- refusesYou --------------------------------------------------------------

/** Below this, an NPC's attitude has curdled enough that they won't deal with
 *  you at all, regardless of what you're offering. */
const REFUSAL_ATTITUDE_THRESHOLD = -50;

/** Does this NPC refuse to deal with you at all? A confirmed fake sale is an
 *  automatic refusal regardless of overall attitude — trust like that isn't
 *  something a few good deals since then buys back. Below that, it's a
 *  straightforward attitude-threshold check. */
export function refusesYou(player: Player, npcId: string): { refuses: boolean; reason?: string } {
    const connection = player.connections[npcId];
    if (connection?.burnedYou) {
        return {
            refuses: true,
            reason: callback(player, npcId) ?? 'They caught you passing a fake, once. They are not doing that again.',
        };
    }

    const attitude = attitudeOf(player, npcId);
    if (attitude <= REFUSAL_ATTITUDE_THRESHOLD) {
        return {
            refuses: true,
            reason: callback(player, npcId) ?? 'They want nothing to do with you right now.',
        };
    }

    return { refuses: false };
}

// --- reputationSpread --------------------------------------------------------

function defaultConnection(npcId: string): Connection {
    return { npcId, standing: 0, deals: 0, burnedYou: false, youBurnedThem: false, lastDealDay: 0 };
}

function applyStanding(player: Player, npcId: string, delta: number): Player {
    if (delta === 0) return player;
    const current = player.connections[npcId] ?? defaultConnection(npcId);
    const standing = clamp(current.standing + delta, -100, 100);
    return { ...player, connections: { ...player.connections, [npcId]: { ...current, standing } } };
}

/**
 * How much of a change to `npcId`'s standing bleeds onto a related NPC, and
 * in which direction. `npcIsSubjectA` is whether `npcId` (the one whose
 * standing just changed) is the `a` side of that relation — it only matters
 * for the two directional kinds.
 */
function spreadFactor(kind: RelationKind, npcIsSubjectA: boolean): number {
    switch (kind) {
        case 'allies': return 0.4;                       // solidarity: same sign
        case 'rivals': return -0.3;                       // your gain is their loss
        case 'feud': return -0.5;                         // same, harder
        case 'oblivious-fan':
            // Only the fan moves with the idol's reputation — the idol never
            // notices the fan exists, let alone tracks their standing.
            return npcIsSubjectA ? 0 : 0.35;
        case 'blames':
            // Only the blamer's opinion moves when the blamed party's
            // reputation shifts; the blamed party was never tracking them.
            return npcIsSubjectA ? 0 : -0.2;
    }
}

/**
 * Standing with one NPC bleeds onto their allies and enemies. This is what
 * makes the cast a social graph instead of a list: burning Scalper Sid also
 * cools his ally Gutter Gabe on you, and impressing Bibi also annoys his
 * rival Yasser — neither of whom you necessarily even spoke to that day.
 */
export function reputationSpread(player: Player, npcId: string, delta: number): Player {
    let next = applyStanding(player, npcId, delta);
    for (const relation of relationsInvolving(npcId)) {
        const npcIsSubjectA = relation.a === npcId;
        const otherId = npcIsSubjectA ? relation.b : relation.a;
        const factor = spreadFactor(relation.kind, npcIsSubjectA);
        if (factor === 0) continue;
        next = applyStanding(next, otherId, Math.round(delta * factor));
    }
    return next;
}

// --- coPresenceEvent ----------------------------------------------------------

export interface CoPresenceEvent {
    headline: string;
    body: string;
    outcomes: ScenarioOutcome[];
}

/**
 * Two NPCs in the same place at the same time — do they kick off? Only for
 * pairs with an authored relation (an arbitrary pair of strangers doesn't
 * have a scene); the specific beat is picked deterministically from `day` so
 * repeated visits get variety without the scene reshuffling mid-render.
 */
export function coPresenceEvent(a: string, b: string, day: number): CoPresenceEvent | null {
    const relation = relationBetween(a, b);
    if (!relation) return null;

    const nameA = nameOf(relation.a);
    const nameB = nameOf(relation.b);
    const rng = seeded(hashString(`copresence:${relation.a}:${relation.b}:${day}`));

    switch (relation.kind) {
        case 'allies': {
            const bodies = [
                `${nameA} and ${nameB} fall into step like they planned this. Maybe they did.`,
                `${nameA} spots ${nameB}, and whatever this street was doing a moment ago speeds up.`,
            ];
            return {
                headline: `${nameA} & ${nameB}, together.`,
                body: pickWith(bodies, rng),
                outcomes: [{ type: 'notification', message: relation.note, description: '' }],
            };
        }
        case 'rivals': {
            const bodies = [
                `${nameA} sees ${nameB} across the street. Neither of them lowers their voice.`,
                `${nameA} and ${nameB} end up on the same corner, and both of them act like they got there first.`,
            ];
            return {
                headline: `${nameA} vs ${nameB}.`,
                body: pickWith(bodies, rng),
                outcomes: [
                    { type: 'heat', change: 3, description: 'Two people arguing in public draws exactly the wrong kind of attention.' },
                    { type: 'notification', message: relation.note, description: '' },
                ],
            };
        }
        case 'feud': {
            const bodies = [
                `${nameA} sees ${nameB} and stops mid-sentence. This is going to take a while.`,
                `${nameA} and ${nameB}, in the same place, at the same time. A small crowd starts forming before either of them says a word.`,
            ];
            return {
                headline: `${nameA} and ${nameB} collide.`,
                body: pickWith(bodies, rng),
                outcomes: [
                    { type: 'heat', change: 6, description: 'This one draws a crowd, and a crowd draws police.' },
                    { type: 'streetCred', change: -1, description: 'You were standing right there for all of it.' },
                    { type: 'notification', message: relation.note, description: '' },
                ],
            };
        }
        case 'oblivious-fan': {
            const fan = nameA;
            const idol = nameB;
            const bodies = [
                `${fan} spots ${idol} and lights up. ${idol} does not reciprocate the recognition.`,
                `${fan} agrees loudly with something ${idol} says. ${idol} did not say it to them, or possibly at all.`,
            ];
            return {
                headline: `${fan}, re: ${idol}.`,
                body: pickWith(bodies, rng),
                outcomes: [{ type: 'notification', message: relation.note, description: '' }],
            };
        }
        case 'blames': {
            const blamer = nameA;
            const blamed = nameB;
            const bodies = [
                `${blamer} spots ${blamed} and immediately explains, at volume, why this is his fault too.`,
                `${blamer} sees ${blamed} across the street and starts talking before either of you is in earshot.`,
            ];
            return {
                headline: `${blamer}, on ${blamed}. Again.`,
                body: pickWith(bodies, rng),
                outcomes: [
                    { type: 'notification', message: relation.note, description: '' },
                    { type: 'streetCred', change: 1, description: 'You witnessed it happen, which counts for something on the street.' },
                ],
            };
        }
    }
}
