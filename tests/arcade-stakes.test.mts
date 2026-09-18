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
import { MINIGAME_QUIT_FORFEIT, MAX_INVENTORY_SIZE, INITIAL_PLAYER, INITIAL_PLAYER_CASH, STREET_SALE_RATE } from '../constants.ts';
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

/* ------------------------------------------------------------------------- *
 * What a prize is, and what a loss takes
 *
 * Both of these are distributions, so they are measured over a sample rather
 * than asserted on one draw. The bounds are wide enough that a correct build
 * will not fail them by luck, and narrow enough that the behaviour they
 * replaced — 45% Legendary, and a loss that took your best pair — cannot pass.
 * ------------------------------------------------------------------------- */

const DRAWS = 20000;
const priceOf = (id: string) => SNEAKERS.find(s => s.id === id)!.basePrice;
const drawPrize = (token: string) => {
    const r = applyOutcomes(P(), [
        { type: 'inventoryChange', add: [{ kind: 'item', value: token, qty: 1 }], description: 'prize' },
    ] as ScenarioOutcome[], { day: 3 });
    return SNEAKERS.find(x => x.id === r.player.inventory[0].sneakerId)!;
};

t('a chase win can be a Legendary, but rarely', () => {
    // It used to be 45%: `random-rare` drew uniformly from one flat pool of
    // Rare *and* Legendary, so the expected value of winning a single footrace
    // was $10,950 — 5.5x the whole starting stake, five times a day.
    const drawn = Array.from({ length: DRAWS }, () => drawPrize('random-rare'));
    const legendary = drawn.filter(s => s.rarity === 'Legendary').length / DRAWS;
    assert.ok(legendary > 0, 'a Legendary became unreachable; the tier may as well not exist');
    assert.ok(legendary < 0.12, `${(legendary * 100).toFixed(1)}% of wins are Legendary; it is meant to be a story, not the median`);
    assert.ok(legendary > 0.015, `${(legendary * 100).toFixed(1)}% is rare enough to be a rounding error rather than a jackpot`);
    // And the run stops paying for itself off one win.
    const ev = drawn.reduce((a, s) => a + s.basePrice, 0) / DRAWS;
    assert.ok(ev < INITIAL_PLAYER_CASH, `one win is worth $${Math.round(ev).toLocaleString()}, at or above the entire starting stake`);
});

t('the jackpot sits in the tail, not the middle of the tier', () => {
    // The Legendary tier runs $1,200 to $75,000, a factor of sixty-two. Picked
    // uniformly inside it, the $75,000 pair would be exactly as likely as the
    // cheapest one, which puts the jackpot in the middle of the distribution.
    const legs = SNEAKERS.filter(s => s.rarity === 'Legendary');
    const dearest = legs.reduce((a, b) => (a.basePrice > b.basePrice ? a : b));
    const cheapest = legs.reduce((a, b) => (a.basePrice < b.basePrice ? a : b));
    const drawn = Array.from({ length: DRAWS * 3 }, () => drawPrize('random-rare'))
        .filter(s => s.rarity === 'Legendary');
    const n = (s: { id: string }) => drawn.filter(d => d.id === s.id).length;
    assert.ok(n(cheapest) > n(dearest) * 3,
        `the $${cheapest.basePrice.toLocaleString()} pair should turn up far more often than the $${dearest.basePrice.toLocaleString()} one`);
});

t('every Legendary is still reachable, through the weighted pick', () => {
    // Weighting toward the cheap end must not weight anything to zero — a pair
    // nobody can ever be given is a pair that did not need drawing.
    //
    // Deliberately drawn through `random-rare`. The first version of this check
    // used `random-legendary`, which picks uniformly and never touches the
    // weighting at all, so it sat there green while a weight of zero on
    // everything above $20,000 made five pairs unwinnable. A reachability check
    // has to go through the code path that decides reachability.
    const legs = SNEAKERS.filter(s => s.rarity === 'Legendary');
    const seen = new Set(Array.from({ length: 120000 }, () => drawPrize('random-rare')).map(s => s.id));
    for (const l of legs) {
        assert.ok(seen.has(l.id), `${l.name} ($${l.basePrice.toLocaleString()}) can never be won`);
    }
});

t('a Legendary gift is still a Legendary', () => {
    // Bibi's gift scene asks for `random-legendary` by name. Narrowing
    // `random-rare` must not have narrowed that too.
    for (let i = 0; i < 200; i++) assert.equal(drawPrize('random-legendary').rarity, 'Legendary');
});

t('a loss takes a pair, but not the best one you own', () => {
    // Bag Snatch, the TSA and every mugging reach through the same pick. It was
    // uniform over the whole bag, so one bad footrace could take a $75,000 pair
    // off a player carrying nine cheap ones — the cost decided by the dice
    // rather than by anything they did.
    const grail = SNEAKERS.reduce((a, b) => (a.basePrice > b.basePrice ? a : b));
    const cheap = [...SNEAKERS].sort((a, b) => a.basePrice - b.basePrice).slice(0, 9);
    const bag = [grail, ...cheap].map((s, i) => ({ instanceId: `i${i}`, sneakerId: s.id, purchasePrice: 1, isFake: false }));
    for (let i = 0; i < 2000; i++) {
        const r = applyOutcomes(P({ inventory: [...bag] }), [
            { type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'gone' },
        ] as ScenarioOutcome[], { day: 3 });
        assert.equal(r.player.inventory.length, bag.length - 1, 'nothing was taken at all');
        const gone = bag.find(b => !r.player.inventory.some(x => x.instanceId === b.instanceId))!;
        assert.notEqual(gone.sneakerId, grail.id,
            `a loss took the $${grail.basePrice.toLocaleString()} ${grail.name} out of a bag of nine cheap pairs`);
    }
});

t('a bag of nothing but grails still loses a grail', () => {
    // The stake has to stay real. "Cheaper half" bounds the loss by what you
    // chose to carry; it does not make a rich bag immune.
    const legs = SNEAKERS.filter(s => s.rarity === 'Legendary').slice(0, 6);
    const bag = legs.map((s, i) => ({ instanceId: `g${i}`, sneakerId: s.id, purchasePrice: 1, isFake: false }));
    const r = applyOutcomes(P({ inventory: [...bag] }), [
        { type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'gone' },
    ] as ScenarioOutcome[], { day: 3 });
    assert.equal(r.player.inventory.length, bag.length - 1);
    const gone = bag.find(b => !r.player.inventory.some(x => x.instanceId === b.instanceId))!;
    assert.equal(SNEAKERS.find(s => s.id === gone.sneakerId)!.rarity, 'Legendary');
});

t('a single pair is still takeable', () => {
    // Half of one is zero if you round down, which would make the last pair in
    // the bag permanently safe.
    const only = [{ instanceId: 'o1', sneakerId: SNEAKERS[0].id, purchasePrice: 1, isFake: false }];
    const r = applyOutcomes(P({ inventory: only }), [
        { type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'gone' },
    ] as ScenarioOutcome[], { day: 3 });
    assert.equal(r.player.inventory.length, 0, 'the last pair in the bag was untouchable');
});

console.log(`\n${pass} arcade checks passed.`);
