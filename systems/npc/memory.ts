/**
 * NPC Memory
 * ==========
 * Every encounter in this world used to be stateless: beat Gutter Gabe at
 * dice on Monday and by Tuesday he had never met you. This module gives each
 * NPC a memory of specific things you did to them, or they did to you, so a
 * conversation can open with "you're the one who—" instead of a fresh
 * greeting every single time. `callback()` is the payoff line; everything
 * else here exists to feed it.
 *
 * `Player.flags` is the only place this can live — `types.ts` is off-limits,
 * and flags is declared as `Record<string, boolean | number>`, not a general
 * bag. So the memory list for one NPC is serialised into a single namespaced
 * flag as JSON, written behind a small `as any` cast. That is not a new
 * pattern: `systems/events/bibiEvents.ts` already stores a bare cutscene-id
 * string in `flags['last-bibi-gift-id']` under the same cast rather than
 * widening `Player` for one field. This module just does it once, in one
 * place, for every NPC instead of ad hoc per feature.
 *
 * This also subsumes `systems/opponents.ts`'s `rivalryKey` flag convention —
 * that system counts *how many times* you've played someone; this one
 * remembers *what happened*. They can coexist (opponents.ts is untouched),
 * but a caller wiring new content should prefer `remember()` going forward.
 */
import type { Player } from '../../types';

export type MemoryKind =
    | 'beat-them' | 'lost-to-them' | 'sold-them-fake' | 'caught-their-fake'
    | 'refused-them' | 'helped-them' | 'robbed-by-them' | 'gifted-by-them'
    | 'farted-near-them' | 'saw-you-fail' | 'did-business';

export interface Memory {
    kind: MemoryKind;
    day: number;
    detail?: string;
}

const memoryKey = (npcId: string) => `npc-memory:${npcId}`;

/**
 * How far a single memory of this kind pushes an NPC's attitude toward you,
 * on the -100..100 scale `attitudeOf` returns. The sign is the whole point —
 * it is what the verification script checks per kind — and it is chosen from
 * the NPC's side of the encounter, not the player's: getting robbed poisons
 * the relationship even though the player didn't do anything wrong, and
 * losing a friendly game to someone tends to warm them up, not cool them off.
 */
const ATTITUDE_DELTA: Record<MemoryKind, number> = {
    'beat-them': -3,          // you embarrassed them, even in a friendly game
    'lost-to-them': 3,        // you gave them a win; people warm up to that
    'sold-them-fake': -20,    // the worst thing you can do in this economy
    'caught-their-fake': -10, // you exposed them; they resent being caught
    'refused-them': -6,       // you turned them down
    'helped-them': 14,        // real help is rare here, and remembered as such
    'robbed-by-them': -8,     // even though THEY did it, it poisons things
    'gifted-by-them': 10,     // an actual gesture, not a transaction
    'farted-near-them': -5,   // gross, and everyone remembers gross
    'saw-you-fail': -2,       // secondhand embarrassment, mildly enjoyed
    'did-business': 4,        // small, clean, ordinary — still a plus
};

/** Used only to decide which memories survive the cap: magnitude, not sign —
 *  a huge betrayal outlives a tiny favour regardless of which way it points. */
const SIGNIFICANCE: Record<MemoryKind, number> = Object.fromEntries(
    Object.entries(ATTITUDE_DELTA).map(([kind, delta]) => [kind, Math.abs(delta)]),
) as Record<MemoryKind, number>;

// Big enough that an NPC feels like they remember a real history; small
// enough that a hundred-day save doesn't drag a thousand-entry flag around.
const CAP = 8;
const KEEP_RECENT = 5;
const KEEP_SIGNIFICANT = 5;

/**
 * Keeps the union of the most recent memories and the most significant ones,
 * trimming further by significance if that union still overflows the cap.
 * This is "keep the most recent and the most significant" from the spec,
 * spelled out: a memory can earn its place either by being new or by being
 * big, and only falls out once it is neither.
 */
function pruneMemories(memories: Memory[]): Memory[] {
    if (memories.length <= CAP) return memories;

    const byRecency = [...memories].sort((a, b) => b.day - a.day).slice(0, KEEP_RECENT);
    const bySignificance = [...memories]
        .sort((a, b) => SIGNIFICANCE[b.kind] - SIGNIFICANCE[a.kind] || b.day - a.day)
        .slice(0, KEEP_SIGNIFICANT);

    const keep = new Set<Memory>([...byRecency, ...bySignificance]);
    let kept = memories.filter(m => keep.has(m));

    if (kept.length > CAP) {
        kept = kept
            .sort((a, b) => SIGNIFICANCE[b.kind] - SIGNIFICANCE[a.kind] || b.day - a.day)
            .slice(0, CAP);
    }
    return kept.sort((a, b) => a.day - b.day);
}

/** `flags` only types booleans and numbers; this is the one, documented
 *  place that widens a value through it anyway, matching the existing
 *  `as any` precedent in bibiEvents.ts rather than editing `types.ts`. */
function writeMemories(player: Player, npcId: string, memories: Memory[]): Player {
    return {
        ...player,
        flags: { ...player.flags, [memoryKey(npcId)]: JSON.stringify(memories) as any },
    };
}

export function memoriesOf(player: Player, npcId: string): Memory[] {
    const raw = player.flags[memoryKey(npcId)];
    if (raw === undefined) return [];
    try {
        const parsed = JSON.parse(String(raw));
        return Array.isArray(parsed) ? (parsed as Memory[]) : [];
    } catch {
        // A corrupted or hand-edited save shouldn't crash a conversation —
        // it just means this NPC forgets everything, which is a fine failure mode.
        return [];
    }
}

export function remember(player: Player, npcId: string, kind: MemoryKind, day: number, detail?: string): Player {
    const updated = pruneMemories([...memoriesOf(player, npcId), { kind, day, detail }]);
    return writeMemories(player, npcId, updated);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * -100..100. Combines the slow, mechanical `Connection.standing` (deals,
 * being burned) with the sum of specific memories, so a single dramatic
 * event can move the needle even before enough deals have happened to move
 * `standing` on its own.
 */
export function attitudeOf(player: Player, npcId: string): number {
    const standing = player.connections[npcId]?.standing ?? 0;
    const memoryScore = memoriesOf(player, npcId)
        .reduce((sum, m) => sum + (ATTITUDE_DELTA[m.kind] ?? 0), 0);
    return clamp(Math.round(standing * 0.5 + memoryScore), -100, 100);
}

function bestMemory(memories: Memory[]): Memory {
    // The line an NPC reaches for first is whatever mattered most, and among
    // equally-significant memories, whatever happened most recently.
    return [...memories].sort((a, b) => SIGNIFICANCE[b.kind] - SIGNIFICANCE[a.kind] || b.day - a.day)[0];
}

function formatLine(line: string, detail?: string): string {
    if (!line.includes('{{detail}}')) return line;
    return line.replace(/\{\{detail\}\}/g, detail ?? 'that thing');
}

/**
 * Real, in-voice lines per NPC per memory kind. Not every NPC covers every
 * kind — only the ones that make sense for that character — but every pair
 * listed here really is authored, not templated. `CALLBACK_COVERAGE` below
 * is exactly this table flattened, so a verification script can assert the
 * claim rather than take it on faith.
 *
 * npcIds here are the bare ids used everywhere — `the-game`, not
 * `celeb-the-game`. Two of the four celebrities used to carry that prefix and
 * the other two did not, which meant the same person had two identities and
 * standing earned on the street never met standing earned at a private sale.
 * `tests/npc.test.mts` now asserts no such prefix comes back.
 */
const CALLBACK_LINES: Partial<Record<string, Partial<Record<MemoryKind, string[]>>>> = {
    bibi: {
        'helped-them': [
            '"You volunteered, last time, when I asked. I do not forget volunteers."',
            '"When I called for order, you answered. That is remembered, in this office and others."',
        ],
        'refused-them': [
            '"You sat on the fence when I asked you to choose. Indecision is defeat. I said this once already."',
            '"I offered you a side, once. You offered me nothing. We both remember how that went."',
        ],
        'gifted-by-them': [
            '"I do not give gifts twice to the ungrateful. You, I gave to. Do not make me reconsider."',
            '"You still have what I gave you, I assume. Good. It was not cheap, symbolically."',
        ],
        'farted-near-them': [
            '"There was… an incident, last time. Security adjourned the meeting. We do not speak of it. I am speaking of it."',
            '"I have sat through worse than what you did in that room. I have not forgotten it, however."',
        ],
        'did-business': [
            '"Our last transaction was orderly. I appreciate order."',
            '"We have done business before. I keep a file. Everyone is in the file."',
        ],
    },
    adc: {
        'refused-them': [
            "\"You're the one who refused the contribution. I remember every refusal. I have a list. You're on it.\"",
            '"Last time, you said no. That hurt the collective, not me personally. Mostly the collective."',
        ],
        'did-business': [
            '"You paid, last time. I want to acknowledge that. Grudgingly. It\'s still not enough, structurally."',
            '"I still have your hundred and forty dollars. Not on me. Structurally."',
        ],
        'helped-them': [
            '"You sided with me against Bibi. I have not forgotten. I bring it up constantly, to other people."',
            "\"You're one of the good ones. I say this about several people. You're one of them.\"",
        ],
        'saw-you-fail': [
            '"I watched that debate happen to you, last time. I\'ve written a paper about it."',
            '"You lost an argument to me once. I remember it more fondly than you\'d think."',
        ],
        'farted-near-them': [
            '"The odour, last time — I already have a framework for that. It names you specifically now."',
            "\"You're the systemic failure I mentioned earlier. The one with the smell.\"",
        ],
    },
    'the-game': {
        'beat-them': [
            '"You got me, last time. Aight. AIGHT. That\'s on the mixtape now, unfortunately."',
            '"I remember that L. I think about it. Not often. Sometimes. A normal amount."',
        ],
        'lost-to-them': [
            '"Last time? I ran through you. RESPECT THE GRIND. You remember. I know you remember."',
            '"You still owe me energy from last time. Not money. Energy. It\'s different."',
        ],
        'robbed-by-them': [
            '"That thing with the cart — that wasn\'t a robbery, that was a LOAN. An aggressive loan."',
            '"You still mad about the cart? Let it go, man. I let it go. Mostly."',
        ],
        'did-business': [
            '"You still owe me five dollars. Separately from the OTHER five dollars."',
            '"We handled business, last time. Smooth. I respect a smooth transaction."',
        ],
        'farted-near-them': [
            '"Man, THAT was you. I told people. I still tell people."',
            '"I still catch a whiff of that memory sometimes. Metaphorically. Mostly metaphorically."',
        ],
    },
    'bro-jogan': {
        'beat-them': [
            '"You beat me last time. I\'ve reframed it as a growth experience. On three separate episodes."',
            '"That loss unlocked something in me, bro. Mostly humility. A little bit of humility."',
        ],
        'lost-to-them': [
            '"I ran through you last time, bro. It\'s the elk. It\'s always the elk."',
            '"You remember that L I gave you? I do. I talk about it on the pod sometimes. Respectfully."',
        ],
        'helped-them': [
            '"You came on the pod, last time. Real recognize real, bro."',
            '"You showed up for me, last time. That\'s rare air. That\'s alpha behavior."',
        ],
        'did-business': [
            '"We did business last time, bro. Clean energy. I remember clean energy."',
            '"Last transaction, good vibes. I run a mental ledger. You\'re in the good column."',
        ],
        'saw-you-fail': [
            '"I watched you fold, last time. No judgment. Well — some judgment. On the podcast."',
            '"You had a rough one, last time. I brought it up on three separate episodes. With love."',
        ],
        'farted-near-them': [
            '"That thing that happened last time — I still think there\'s science behind it, bro."',
            '"I asked you to come talk about what happened last time. The offer\'s still open."',
        ],
    },
    'yasser-abbasfat': {
        'beat-them': [
            '"YOU BEAT ME LAST TIME! A SETUP! I HAVE NOT FORGOTTEN THE SETUP!"',
            '"THE HUMMUS REMEMBERS WHAT YOU DID LAST TIME! I REMEMBER TOO!"',
        ],
        'lost-to-them': [
            '"I LIBERATED YOU LAST TIME AND YOU KNOW IT!"',
            '"YOU LOST TO ME ONCE ALREADY! THE STRUGGLE HAS A RECORD OF THIS!"',
        ],
        'robbed-by-them': [
            '"WHAT I TOOK LAST TIME WAS NOT THEFT! IT WAS REDISTRIBUTION, RETROACTIVELY!"',
            '"YOU\'RE STILL MAD ABOUT LAST TIME? THE STRUGGLE DOES NOT APOLOGISE!"',
        ],
        'refused-them': [
            '"YOU REFUSED ME ONCE ALREADY! I REMEMBER EVERY REFUSAL! THE LIST GROWS!"',
            '"LAST TIME YOU SAID NO TO ME! THAT IS ON RECORD, SOMEWHERE, LOUDLY!"',
        ],
        'farted-near-them': [
            '"THEY PUT IT IN THE HUMMUS AGAIN, LIKE LAST TIME! I NEVER FORGET AN ODOUR!"',
            '"THAT SMELL FROM LAST TIME WAS AN ACT OF AGGRESSION AND I FILED A REPORT!"',
        ],
    },
    'donald-drip': {
        'did-business': [
            '"We did business before. Tremendous business. Best business anyone\'s ever seen."',
            '"I remember our last deal. Very smart. Like me."',
        ],
        'saw-you-fail': [
            '"You sold something total loser, last time. I saw it. Everyone saw it. Sad."',
            '"Last time you made a bad trade. I remember bad trades. I remember everything, actually."',
        ],
        'gifted-by-them': [
            '"I gave you something incredible, last time. The best gift. People are still talking about it."',
            '"You still have what I gave you? Good. It\'s tremendous. It appreciates. Like me."',
        ],
        'farted-near-them': [
            '"That smell, last time — people are saying it was the greatest one ever. Very sad, for you."',
            '"I remember what happened last time. Total hoax, probably. I still remember it."',
        ],
        'helped-them': [
            '"You bought the good stuff, last time, in front of me. Smart. Very smart. Like me."',
            '"Last time, you impressed me. Doesn\'t happen much. Remember that."',
        ],
    },
    'grandma-laces': {
        'beat-them': [
            '"You beat me last time, bubbeleh. Beginner\'s luck. Obviously. I still remember it though."',
            '"Last time you won. I let you. I did not let you. I remember which."',
        ],
        'lost-to-them': [
            '"I took your money last time and patted your cheek. You remember. Everybody remembers that."',
            '"I told you so, last time, and I\'ll tell you again now."',
        ],
        'did-business': [
            '"We did business before, sweetheart. You were fair. I remember fair."',
            '"Last time you didn\'t haggle like an animal. I appreciated that."',
        ],
        'gifted-by-them': [
            "\"I told you that gossip about The Game last time. You're welcome. Again.\"",
            '"I gave you something last time. Don\'t tell the others. I tell everybody that."',
        ],
        'helped-them': [
            '"You did right by me last time, sweetheart. An old woman remembers who\'s decent."',
            '"Last time, you helped an old lady. That\'s rarer than you\'d think. I noticed."',
        ],
    },
    'wiz-k': {
        'beat-them': [
            '"Oh. You beat me last time too. That\'s beautiful, man. Genuinely."',
            '"I think about that loss sometimes. Good energy though. No notes."',
        ],
        'lost-to-them': [
            '"I beat you last time, right? Sorry. I\'m still kind of sorry about that, low-key."',
            '"That was a weird game, last time. I don\'t even know how I won. Still don\'t."',
        ],
        'did-business': [
            '"We did a thing, last time. It was chill. I remember chill."',
            '"Last time was smooth, man. I appreciate smooth."',
        ],
        'helped-them': [
            '"You helped me out, last time. I don\'t forget stuff like that. Well — I forget most stuff. Not that."',
            '"That was a good move, last time. I think about it sometimes, between thoughts about pizza."',
        ],
    },
    'gutter-gabe': {
        'beat-them': [
            '"You got me last time. Again. RIGHT NOW. AGAIN."',
            "\"I remember losing to you. I don't like remembering it. I remember it anyway.\"",
        ],
        'lost-to-them': [
            '"Told you, last time. I told you."',
            '"I counted your money slow, last time, in front of you. I remember your face."',
        ],
        'robbed-by-them': [
            '"That thing I took off you, last time? Consider it a loan. With no terms."',
            '"You still sore about last time? Keep your heat. For now. Like I said then."',
        ],
        'sold-them-fake': [
            '"You sold me a fake, last time. I don\'t forget that. Ever. Not once."',
            '"Last time you burned me. That follows you around here. Everywhere."',
        ],
        'caught-their-fake': [
            '"You caught what I was moving, last time. Sharp eye. I respect it and I hate it."',
            '"Last time you clocked my fake. Word got around. I remember who started that."',
        ],
        'refused-them': [
            '"You told me no, last time. I don\'t forget a no."',
            '"Last time you kept your heat. Aight. I remember that too."',
        ],
    },
    'scalper-sid': {
        'sold-them-fake': [
            '"You sold me a fake once. I have not forgotten it. I write things down."',
            '"Last time, you burned me. That\'s a permanent mark, in my book. Literally, a book."',
        ],
        'caught-their-fake': [
            '"You caught my angle, last time. He writes something down. He\'s still writing."',
            '"Last time you saw through me. Don\'t feel bad. Nobody has an eye. You apparently do."',
        ],
        'did-business': [
            '"We\'ve done business before. I remember who pays."',
            '"Last deal went smooth. I keep a mental ledger. You\'re in the good half."',
        ],
        'beat-them': [
            '"You beat me at my own game, last time. I offered you a job. It is still not clear what the job is."',
            '"Last time you had an eye. I noticed. I noted it. I am always noting things."',
        ],
        'lost-to-them': [
            '"I took you, last time. Don\'t feel bad. He\'s gone before you look up. He\'s still gone."',
            '"Last time I made it interesting. I always make it interesting. You remember."',
        ],
        'refused-them': [
            '"You walked away from my map, last time. Your loss, pal. I still say that."',
            '"Last time you were out. I remember who\'s out."',
        ],
    },
    'clerk-israeli-af': {
        'did-business': [
            '"Achi, we did business last time. Sababa. I remember sababa."',
            '"Last time was smooth, achi. I remember smooth."',
        ],
        'helped-them': [
            '"You did me a solid, last time. Take a bureka. Take two. I remember solids."',
            "\"Achi, last time you were good to me. I don't forget that. Take a bureka.\"",
        ],
        'saw-you-fail': [
            '"I saw that happen to you, last time, achi. The whole store heard about it."',
            '"Last time was rough for you, achi. I still bring it up. With love."',
        ],
        'beat-them': [
            '"You beat me last time, achi. I am on break. I decide when I remember that."',
            '"Last time you got me. Sababa. Doesn\'t mean I forgot."',
        ],
        'lost-to-them': [
            '"YALLA! I remember beating you last time. The whole store heard about it then too."',
            '"Last time I won. I remember winning. I always remember winning."',
        ],
    },
    'tsa-agent': {
        'caught-their-fake': [
            '"We\'ve seen your bag before. We remember bags."',
            '"Last time, something in your bag wasn\'t right. It\'s flagged. Everything is flagged eventually."',
        ],
        'refused-them': [
            '"You gave us trouble last time. Noted. Everything gets noted."',
            "\"Last time didn't go smoothly. We remember. That's the job.\"",
        ],
        'saw-you-fail': [
            '"We watched that happen to you, last time. Professionally, that was memorable."',
            '"Last time was a whole thing. We don\'t forget a whole thing."',
        ],
    },
};

/** Last-resort lines for any (npcId, kind) pair not explicitly authored
 *  above, so callback() degrades gracefully instead of going silent for
 *  minor or future NPCs. Not counted in `CALLBACK_COVERAGE` — it isn't a
 *  claim of per-character voice, just a safety net. */
const GENERIC_CALLBACK_LINES: Record<MemoryKind, string[]> = {
    'beat-them': ['They remember losing to you. They haven\'t brought it up. Yet.'],
    'lost-to-them': ['They remember beating you. They\'ve brought it up more than once.'],
    'sold-them-fake': ['They remember exactly what you sold them, and exactly what it turned out to be.'],
    'caught-their-fake': ['They remember you catching them. They have not forgiven the accuracy of it.'],
    'refused-them': ['They remember asking you for something, and you saying no.'],
    'helped-them': ['They remember you helping them. It doesn\'t happen often, around here.'],
    'robbed-by-them': ['They remember what they took from you. They have not offered it back.'],
    'gifted-by-them': ['They remember giving you something. They expect it to be mentioned.'],
    'farted-near-them': ['They remember exactly what happened, and exactly where they were standing.'],
    'saw-you-fail': ['They remember watching that happen to you. Vividly.'],
    'did-business': ['They remember the last time you did business. It went fine, which they also remember.'],
};

/**
 * A specific line referencing a specific past event — an NPC saying "you're
 * the one who sold me the fakes" instead of a generic hello. Picks the
 * single most significant (then most recent) memory and reaches for that
 * NPC's authored line for it, falling back to a generic one so this never
 * silently returns nothing just because a minor NPC wasn't fully scripted.
 */
export function callback(player: Player, npcId: string): string | null {
    const memories = memoriesOf(player, npcId);
    if (!memories.length) return null;

    const memory = bestMemory(memories);
    const bank = CALLBACK_LINES[npcId]?.[memory.kind] ?? GENERIC_CALLBACK_LINES[memory.kind];
    if (!bank || !bank.length) return null;

    const line = bank[Math.floor(Math.random() * bank.length)];
    return formatLine(line, memory.detail);
}

/** `CALLBACK_LINES` flattened to (npcId, kind) pairs, for verification: every
 *  pair listed here is a real, claimed piece of voice, not a template. */
export const CALLBACK_COVERAGE: Array<{ npcId: string; kind: MemoryKind }> =
    Object.entries(CALLBACK_LINES).flatMap(([npcId, byKind]) =>
        Object.keys(byKind ?? {}).map(kind => ({ npcId, kind: kind as MemoryKind })));
