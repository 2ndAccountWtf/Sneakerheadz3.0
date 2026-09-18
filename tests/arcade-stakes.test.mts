/**
 * The Arcade's side of the bargain.
 *
 * Two things went wrong here at once, and they pulled in opposite directions:
 * winning some games paid nothing at all, while *declining* to play could cost
 * more than every purse in the building put together.
 *
 *   - Bail Out dispatched `RESOLVE_MINIGAME { won: false }`, which applies the
 *     authored `onLose` payload in full. On the two chase games that payload
 *     removes a uniformly-picked pair from the bag. 44% of the catalogue is
 *     worth $1,000 or more and the top of it is $75,000, so pressing Bail Out
 *     on a game you had not started was an unbounded loss.
 *   - `sneaker-chase` and `cart-race` paid the winner a pair and no money, and
 *     `applyInventoryChange` drops a pair on the floor when the bag is full.
 *     Ten slots, so a stocked player could win outright and receive nothing,
 *     with a log line telling them so.
 *
 * These checks pin both ends: nothing you can win is worth nothing, and nothing
 * you can walk away from costs more than the forfeit.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENTRIES, requestFor } from '../screens/ArcadeScreen.tsx';
import { MINIGAME_QUIT_FORFEIT, MAX_INVENTORY_SIZE, INITIAL_PLAYER, STREET_SALE_RATE } from '../constants.ts';
import { SNEAKERS } from '../data/sneakers.ts';
import { applyOutcomes } from '../systems/outcomes/outcomeEngine.ts';
import type { GameState, Player } from '../types.ts';
import { gameReducer } from '../hooks/useGame.ts';
import type { ScenarioOutcome } from '../types/interactions.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

const built = ENTRIES.map(e => ({ entry: e, req: requestFor(e, { cityName: 'Tokyo' }) }));
/** Games with an authored win payload — the box game writes its own. */
const winnable = built.filter(b => (b.req.onWin ?? []).length > 0);

/**
 * What a payload actually puts in your pocket, measured by running it.
 *
 * Deliberately not by reading the outcome objects: `money()` in the Arcade is
 * an `inventoryChange` carrying a currency entry, prizes are sneaker entries,
 * and a test that pattern-matched those shapes would pass a payload the engine
 * silently drops. Give it a player and see what comes back richer.
 */
const cashIn = (outs: ScenarioOutcome[], p: Player = P()): number =>
    applyOutcomes(p, outs, { day: 3 }).player.cash - p.cash;

const P = (over: Partial<Player> = {}): Player => ({ ...INITIAL_PLAYER, cash: 0, inventory: [], ...over });

t('every arcade game with a win payload has one', () => {
    // Guards against a game being added with onLose only, which is how you end
    // up able to lose a purse you could never have won.
    assert.ok(winnable.length >= 10, `only ${winnable.length} games can be won`);
});

t('winning a mini-game pays money', () => {
    // The complaint, directly. `sneaker-chase` and `cart-race` used to pay a
    // pair and nothing else; a full bag turned that into literally nothing.
    for (const { entry, req } of winnable) {
        assert.ok(cashIn(req.onWin ?? []) > 0, `${entry.id} can be won but pays no money`);
    }
});

t('the purse beats the forfeit for walking out', () => {
    // If quitting cost more than winning paid, the rational move would be to
    // finish every game you start regardless of how it is going.
    for (const { entry, req } of winnable) {
        assert.ok(cashIn(req.onWin ?? []) > MINIGAME_QUIT_FORFEIT,
            `${entry.id} pays less to win than it costs to leave`);
    }
});

t('walking out costs five dollars, not a Legendary', () => {
    // The number the whole change exists for. Stated here so a tuning pass has
    // to look at this line and mean it.
    assert.equal(MINIGAME_QUIT_FORFEIT, 5);
    const dearest = Math.max(...SNEAKERS.map(s => s.basePrice));
    assert.ok(MINIGAME_QUIT_FORFEIT < dearest / 1000,
        'the forfeit has drifted into the same order of magnitude as the loss it replaced');
});

t('a prize you cannot carry is sold, not lost', () => {
    // A full bag used to make the pair evaporate with a line saying so. The
    // player has won; the only question is what form the winnings take.
    const full: Player = {
        ...INITIAL_PLAYER,
        cash: 0,
        inventory: Array.from({ length: MAX_INVENTORY_SIZE }, (_, i) => ({
            instanceId: `x${i}`, sneakerId: SNEAKERS[0].id, purchasePrice: 1, isFake: false,
        })),
    };
    const res = applyOutcomes(full, [
        { type: 'inventoryChange', add: [{ kind: 'item', value: 'random-rare', qty: 1 }], description: 'prize' },
    ] as ScenarioOutcome[], { day: 3 });
    assert.equal(res.player.inventory.length, MAX_INVENTORY_SIZE, 'the bag should not have grown');
    assert.ok(res.player.cash > 0, 'a full bag still swallowed the prize');
    // Below market, because it is a forced sale to whoever is standing there.
    const rares = SNEAKERS.filter(s => s.rarity === 'Rare' || s.rarity === 'Legendary');
    const cheapest = Math.min(...rares.map(s => s.basePrice));
    assert.ok(res.player.cash >= Math.round(cheapest * STREET_SALE_RATE),
        `paid $${res.player.cash}, less than the cheapest rare at the street rate`);
});

/* ------------------------------------------------------------------------- *
 * Bail Out, through the real reducer
 * ------------------------------------------------------------------------- */

/** A state thin enough to quit a mini-game in. */
const inGame = (req: Record<string, unknown>, over: Partial<Player> = {}): GameState => ({
    player: P({ cash: 1000, ...over }),
    activeMiniGame: req,
    day: 3,
    outcomeLog: [],
    markets: {},
    currentCityId: 'tokyo',
    activeMarketSignals: [],
} as unknown as GameState);

/** The chase game's real payload: he takes a pair, picked at random. */
const CHASE = {
    game: 'sneaker-chase',
    title: 'Bag Snatch',
    onWin: [],
    onLose: [{ type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'Gone.' }],
};

t('bailing out takes the forfeit and nothing else', () => {
    const dearest = SNEAKERS.reduce((a, b) => (a.basePrice > b.basePrice ? a : b));
    const before = inGame(CHASE, {
        inventory: [{ instanceId: 'g1', sneakerId: dearest.id, purchasePrice: 1, isFake: false }],
    });
    const after = gameReducer(before, { type: 'QUIT_MINIGAME' } as never);
    assert.equal(after.player.cash, 1000 - MINIGAME_QUIT_FORFEIT);
    assert.equal(after.player.inventory.length, 1,
        `walking out took the ${dearest.name} ($${dearest.basePrice.toLocaleString()}) out of the bag`);
    assert.equal(after.activeMiniGame, null, 'the game should have closed');
});

t('losing still costs what the writers said it should', () => {
    // The forfeit is for leaving, not for playing badly. If this check ever
    // passes with the inventory intact, quitting and losing have been merged
    // again from the other direction.
    const before = inGame(CHASE, {
        inventory: [{ instanceId: 'g1', sneakerId: SNEAKERS[0].id, purchasePrice: 1, isFake: false }],
    });
    const after = gameReducer(before, { type: 'RESOLVE_MINIGAME', payload: { won: false } } as never);
    assert.equal(after.player.inventory.length, 0, 'an actual loss stopped costing anything');
});

t('you cannot walk out of a police stop for five dollars', () => {
    // Otherwise every bust in the game is worth $5. A chase that started as a
    // stop is settled by `resolveEscape` whichever way the player leaves it.
    const before = inGame({ ...CHASE, config: { bust: { officer: { name: 'A Cop', temperament: 'business', ceiling: 500, patience: 2 }, choice: 'run' } } });
    const after = gameReducer(before, { type: 'QUIT_MINIGAME' } as never);
    assert.notEqual(after.player.cash, 1000 - MINIGAME_QUIT_FORFEIT,
        'Bail Out became a $5 escape from every police stop in the game');
});

t('a player with nothing on them can still leave', () => {
    // The forfeit is capped at what is in the pocket, so quitting can never put
    // the player into negative cash.
    const after = gameReducer(inGame(CHASE, { cash: 0 }), { type: 'QUIT_MINIGAME' } as never);
    assert.equal(after.player.cash, 0);
    assert.ok(after.player.cash >= 0);
});

t('the Bail Out button is wired to the quit action, not to a loss', () => {
    // The checks above drive the reducer directly, so they cannot see which
    // action the button sends. That is exactly where this bug lived for its
    // whole life: the reducer was fine, the button dispatched the wrong thing.
    const host = readFileSync('components/minigames/MiniGameHost.tsx', 'utf8');
    const quitLine = host.split('\n').find(l => /const quit\s*=/.test(l));
    assert.ok(quitLine, 'the quit handler has been renamed; this check is stale');
    assert.match(quitLine, /QUIT_MINIGAME/, 'Bail Out is dispatching something other than QUIT_MINIGAME');
    assert.doesNotMatch(quitLine, /RESOLVE_MINIGAME/, 'Bail Out resolves as a loss again');
});

/* ------------------------------------------------------------------------- *
 * Energy: the number on the card
 * ------------------------------------------------------------------------- */

t('the advertised energy cost is the one that gets charged', () => {
    // It used to be decorative. `energyCost` gated the Play button and was then
    // never deducted; only the win/lose payloads charged energy, and only some
    // of them. Measured across the twelve entries: eight charged nothing at all
    // on either branch, Pizza Run charged 14 for losing and nothing for winning,
    // and Cart Race charged 16 for winning and nothing for losing. Flight 404
    // printed a 25 on the card and took none of it.
    for (const { entry, req } of built) {
        const before = { ...inGame(req as never), player: P({ energy: 100 }) } as GameState;
        const after = gameReducer(before, { type: 'LAUNCH_MINIGAME', payload: req } as never);
        assert.equal(100 - after.player.energy, entry.energyCost,
            `${entry.id} advertises ${entry.energyCost} energy and charges ${100 - after.player.energy}`);
    }
});

t('energy is charged for playing, not for the result', () => {
    // Otherwise the same game costs different amounts depending on how it ends,
    // which is how Pizza Run came to be free if you were good at it.
    for (const { entry, req } of built) {
        for (const won of [true, false]) {
            const drained = P({ energy: 100 }).energy
                - applyOutcomes(P({ energy: 100 }), (won ? req.onWin : req.onLose) ?? [], { day: 3 }).player.energy;
            assert.equal(drained, 0,
                `${entry.id} still drains ${drained} energy in its ${won ? 'onWin' : 'onLose'} payload, on top of the launch charge`);
        }
    }
});

t('a game you cannot afford cannot be started into negative energy', () => {
    const { req } = built.find(b => b.entry.energyCost > 0)!;
    const after = gameReducer({ ...inGame(req as never), player: P({ energy: 1 }) } as GameState,
        { type: 'LAUNCH_MINIGAME', payload: req } as never);
    assert.ok(after.player.energy >= 0, 'energy went negative');
});

console.log(`\n${pass} arcade checks passed.`);
