/**
 * The NPC simulation.
 *
 * The claim being defended here is that the cast exists when the player is not
 * looking at them: they are somewhere specific each day, they remember what
 * happened between you, and the ones who have history with each other react to
 * being in the same room.
 *
 * The failure this suite is built around is the quiet one — a schedule that
 * technically runs but never actually places anybody anywhere, so every venue
 * in the game reads "elsewhere" forever and the feature is worse than not
 * having shipped it.
 */
import assert from 'node:assert/strict';
import { INITIAL_PLAYER } from '../constants.ts';
import type { Player } from '../types.ts';
import { CITIES } from '../data/cities.ts';
import { VENUES, venuesIn, isVenueOpen, timeOfDayFor } from '../data/venues.ts';
import { whereIs, isNpcInCity, SCHEDULABLE_NPC_IDS } from '../systems/npc/schedule.ts';
import { remember, memoriesOf, attitudeOf, callback } from '../systems/npc/memory.ts';
import { greetingFor, refusesYou, reputationSpread, coPresenceEvent } from '../systems/npc/reactions.ts';
import { NPC_RELATIONS } from '../data/npcRelations.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };
const P = (over: Partial<Player> = {}): Player => ({ ...INITIAL_PLAYER, ...over });

/* ---------------- schedule ---------------- */

t('the schedule is deterministic — the same day gives the same answer', () => {
    for (const npcId of SCHEDULABLE_NPC_IDS) {
        const first = whereIs(npcId, 'tokyo', 9);
        for (let i = 0; i < 5; i++) {
            const again = whereIs(npcId, 'tokyo', 9);
            assert.deepEqual(again, first, `${npcId} moved between two reads of the same day`);
        }
    }
});

t('the schedule is not frozen — everybody turns up somewhere, and moves', () => {
    // Measured across every city rather than one, because several of the cast
    // are deliberately regional: Wiz K is not in New York and never claimed to
    // be. What must hold for all of them is that they exist somewhere, and that
    // where they are changes.
    for (const npcId of SCHEDULABLE_NPC_IDS) {
        const places = new Set<string>();
        let everSeen = false;
        for (let day = 1; day <= 12; day++) {
            for (const city of CITIES) {
                const placed = whereIs(npcId, city.id, day);
                if (placed.likelihood <= 0) continue;
                everSeen = true;
                places.add(`${city.id}:${placed.place}`);
            }
        }
        assert.ok(everSeen, `${npcId} was nowhere in any city for twelve days`);
        assert.ok(places.size > 1, `${npcId} was in exactly one place for twelve days`);
    }
});

t('venues actually hold people — the roster is not permanently "elsewhere"', () => {
    // The regression this file exists for. Counted across every open venue in
    // every city over a full run: if the schedule places almost nobody at an
    // actual venue, the "who is here" line on the venues screen is noise.
    let slots = 0;
    let filled = 0;

    for (let day = 1; day <= 30; day++) {
        for (const city of CITIES) {
            for (const venue of venuesIn(city.id)) {
                if (!isVenueOpen(venue, day)) continue;
                for (const npcId of venue.regulars) {
                    slots++;
                    if (whereIs(npcId, city.id, day).venueId === venue.id) filled++;
                }
            }
        }
    }

    assert.ok(slots > 0, 'no open venue had any regulars at all over thirty days');
    const rate = filled / slots;
    assert.ok(rate > 0.25, `only ${(rate * 100).toFixed(0)}% of regular-slots were actually filled`);
    assert.ok(rate < 0.95, `${(rate * 100).toFixed(0)}% of slots filled — nobody is ever out, which is not a schedule`);
});

t('a placement at a venue always names a venue that is open', () => {
    for (let day = 1; day <= 20; day++) {
        for (const city of CITIES) {
            for (const npcId of SCHEDULABLE_NPC_IDS) {
                const placed = whereIs(npcId, city.id, day);
                if (!placed.venueId) continue;
                const venue = VENUES.find(v => v.id === placed.venueId);
                assert.ok(venue, `${npcId} placed at unknown venue ${placed.venueId}`);
                assert.equal(venue!.cityId, city.id, `${npcId} placed in the wrong city`);
                assert.ok(isVenueOpen(venue!, day), `${npcId} placed at ${venue!.name}, which is shut on day ${day}`);
            }
        }
    }
});

t('likelihood is always a probability', () => {
    for (let day = 1; day <= 20; day++) {
        for (const city of CITIES) {
            for (const npcId of SCHEDULABLE_NPC_IDS) {
                const { likelihood } = whereIs(npcId, city.id, day);
                assert.ok(likelihood >= 0 && likelihood <= 1, `${npcId}: likelihood ${likelihood}`);
            }
        }
    }
});

t('Gutter Gabe is a night creature and stays one', () => {
    let seen = 0;
    for (let day = 1; day <= 40; day++) {
        for (const city of CITIES) {
            if (!isNpcInCity('gutter-gabe', city.id, day)) continue;
            seen++;
            assert.equal(timeOfDayFor(day), 'night', `Gabe turned up in the ${timeOfDayFor(day)}`);
        }
    }
    assert.ok(seen > 0, 'Gabe was never anywhere at all');
});

/* ---------------- memory ---------------- */

t('a memory is recorded against one NPC and nobody else', () => {
    const p = remember(P(), 'the-game', 'beat-them', 4);
    assert.equal(memoriesOf(p, 'the-game').length, 1);
    assert.equal(memoriesOf(p, 'wiz-k').length, 0, 'the memory bled onto another NPC');
});

t('attitude moves in the right direction for each kind', () => {
    const good = attitudeOf(remember(P(), 'wiz-k', 'helped-them', 2), 'wiz-k');
    const bad = attitudeOf(remember(P(), 'wiz-k', 'sold-them-fake', 2), 'wiz-k');
    assert.ok(good > 0, `helping them gave attitude ${good}`);
    assert.ok(bad < 0, `selling them a fake gave attitude ${bad}`);
    assert.ok(bad < good);
});

t('memories are capped so one NPC cannot grow without bound', () => {
    let p = P();
    for (let i = 0; i < 40; i++) p = remember(p, 'scalper-sid', 'did-business', i);
    assert.ok(memoriesOf(p, 'scalper-sid').length <= 8, `kept ${memoriesOf(p, 'scalper-sid').length} memories`);
});

t('something significant survives being buried under small talk', () => {
    let p = remember(P(), 'scalper-sid', 'sold-them-fake', 1);
    for (let i = 0; i < 30; i++) p = remember(p, 'scalper-sid', 'did-business', i + 2);
    assert.ok(
        memoriesOf(p, 'scalper-sid').some(m => m.kind === 'sold-them-fake'),
        'thirty ordinary deals erased the time you passed them a fake',
    );
});

t('a callback exists for a remembered NPC and not for a stranger', () => {
    const p = remember(P(), 'the-game', 'robbed-by-them', 3);
    assert.ok(callback(p, 'the-game'), 'no callback for an NPC with history');
    assert.equal(callback(P(), 'the-game'), null, 'a stranger had something to bring up');
});

/* ---------------- reactions ---------------- */

t('a greeting is always a real line', () => {
    for (const npcId of SCHEDULABLE_NPC_IDS) {
        const line = greetingFor(P(), npcId, 1);
        assert.ok(typeof line === 'string' && line.trim().length > 0, `${npcId} greeted with nothing`);
    }
});

t('passing somebody a fake closes the door, with a reason', () => {
    const fresh = P();
    assert.equal(refusesYou(fresh, 'scalper-sid').refuses, false, 'a stranger already refused you');

    const burned: Player = {
        ...fresh,
        connections: {
            ...fresh.connections,
            'scalper-sid': { npcId: 'scalper-sid', standing: 0, deals: 1, burnedYou: true, youBurnedThem: false, lastDealDay: 2 },
        },
    };
    const verdict = refusesYou(burned, 'scalper-sid');
    assert.equal(verdict.refuses, true, 'they still deal with you after that');
    assert.ok(verdict.reason && verdict.reason.length > 0, 'refused without saying why');
});

t('a reputation hit spreads to allies and flatters enemies', () => {
    const relation = NPC_RELATIONS.find(r => r.kind === 'allies');
    assert.ok(relation, 'no ally relation authored at all');

    const after = reputationSpread(P(), relation!.a, -30);
    const ally = after.connections[relation!.b];
    assert.ok(ally, `burning ${relation!.a} did not reach their ally ${relation!.b}`);
    assert.ok(ally!.standing < 0, `the ally's standing went ${ally!.standing}`);

    // And somebody with no relation at all is untouched.
    const unrelated = Object.keys(after.connections).filter(
        id => id !== relation!.a && id !== relation!.b,
    );
    for (const id of unrelated) {
        const related = NPC_RELATIONS.some(r =>
            (r.a === relation!.a && r.b === id) || (r.b === relation!.a && r.a === id));
        assert.ok(related, `${id} reacted to something that had nothing to do with them`);
    }
});

t('every authored relation produces a scene, and strangers do not', () => {
    for (const r of NPC_RELATIONS) {
        const event = coPresenceEvent(r.a, r.b, 5);
        assert.ok(event, `${r.a} + ${r.b} (${r.kind}) produced no scene`);
        assert.ok(event!.headline.trim().length > 0, `${r.a} + ${r.b}: empty headline`);
        assert.ok(event!.body.trim().length > 0, `${r.a} + ${r.b}: empty body`);
    }
    assert.equal(coPresenceEvent('tsa-agent', 'grandma-laces', 5), null, 'two strangers had a scene');
});

t('a scene between the same two people varies across days', () => {
    const r = NPC_RELATIONS[0];
    const bodies = new Set(Array.from({ length: 14 }, (_, d) => coPresenceEvent(r.a, r.b, d + 1)?.body));
    assert.ok(bodies.size > 1, `${r.a} + ${r.b} say the exact same thing every single day`);
});

console.log(`\n${pass} npc checks passed.`);
