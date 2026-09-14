/**
 * Getting stopped by the police.
 *
 * The old version was three fixed buttons — run and lose a random pair, bribe
 * and lose exactly $500, surrender and lose your fakes. Every outcome was
 * known before the choice was made, so after one raid you knew the cheapest
 * option and every later raid was paperwork. Worse, `heat` only decided
 * whether the box appeared. The number the HUD had been showing you all game
 * expressed nothing at the single moment it should have mattered most.
 *
 * So the stop is a negotiation now, on the same machinery that makes street
 * selling work (`systems/street/selling.ts`): a hidden ceiling, a patience
 * clock, and an offer far enough below the ask that making it is worse than
 * saying nothing. Inverted, because here he names the number and you offer up.
 *
 * Three things follow from that, and they are the point:
 *
 *   1. **You do not know what he will take.** Maybe he pockets it. Maybe he
 *      wants more. Maybe you just tried to hand a serious officer four hundred
 *      dollars and made a shakedown into a real problem.
 *   2. **Heat sets the terms, not the odds.** A bored officer at low heat is a
 *      toll. One who came looking for you is not negotiating about a toll.
 *   3. **Everything you already own is suddenly load-bearing.** Cash in your
 *      pocket is seizable and cash in the bank is not — a distinction the game
 *      has modelled since banking shipped and never once punished you for
 *      ignoring. Same for how much you are carrying, whether any of it is
 *      counterfeit, and whether he has heard your name.
 */
import type { Player } from '../../types';
import { MAX_HEAT } from '../../constants';

/* ------------------------------------------------------------------ *
 * Tuning
 * ------------------------------------------------------------------ */

/**
 * Losing a day is the most expensive thing that can happen in a thirty-day
 * run, so it is gated three ways rather than one.
 *
 * It is only ever reached by making the stop physical — running, driving off,
 * or swinging on him — and then losing. Refusing to pay is not a route to it:
 * declining a shakedown costs you the cash in your pocket and any counterfeits
 * you are carrying, which is plenty, but jailing somebody for saying no would
 * be the game punishing the one honest option it offers.
 *
 * On top of that it needs real heat — this does not happen to somebody who has
 * been careful — and it cannot happen in the opening stretch at all, because a
 * night in a cell on day 3 is not a lesson, it is a run that ended before the
 * player understood what they did wrong.
 */
export const JAIL_MIN_DAY = 10;
export const JAIL_MIN_HEAT = 70;

/** Above this, he is not here by accident. */
const HUNTING_HEAT = 55;
/** Below this, he is bored and this is a toll booth. */
const BORED_HEAT = 25;

/** How far below his ceiling an offer can land before it reads as an insult. */
const INSULT_FRACTION = 0.45;

/** Rounds of haggling, by temperament. */
const PATIENCE = { bored: 4, business: 3, 'looking-for-you': 2 } as const;

export type Temperament = keyof typeof PATIENCE;

/* ------------------------------------------------------------------ *
 * The officer
 * ------------------------------------------------------------------ */

export interface Officer {
    name: string;
    temperament: Temperament;
    /** His opening number. Always above what he will actually take. */
    demand: number;
    /** What he settles for. Never shown to the player. */
    trueMax: number;
    /** Offers below this are not low, they are insulting. */
    insultBelow: number;
    /** Rounds before he stops entertaining it. */
    maxRounds: number;
    /** He has heard of you. Changes his opening line and his patience. */
    knowsYou: boolean;
    /** Whether a cell is on the table at all tonight. Decided up front. */
    canJail: boolean;
}

export const temperamentFor = (heat: number): Temperament =>
    heat >= HUNTING_HEAT ? 'looking-for-you' : heat <= BORED_HEAT ? 'bored' : 'business';

/** Cash he can actually take off you. What is in the bank is not his. */
export const seizableCash = (player: Player): number => Math.max(0, Math.round(player.cash));

/** Counterfeits on you right now — what makes a stop into a case. */
export const fakesOn = (player: Player): number =>
    player.inventory.filter(i => i.isFake).length;

/**
 * Build the officer you are dealing with.
 *
 * His ceiling scales off what he can see: the cash on you, the size of the bag
 * and whether any of it is counterfeit. It deliberately does NOT scale off
 * your bank balance — he cannot see that, which is the entire reason banking
 * is about to start mattering.
 */
export function rollOfficer(player: Player, day: number, rng: () => number): Officer {
    const temperament = temperamentFor(player.heat);
    const fakes = fakesOn(player);
    const cash = seizableCash(player);

    // What he thinks you are worth leaning on.
    const visibleWorth = cash * 0.5 + player.inventory.length * 90 + fakes * 140;
    const greed = temperament === 'looking-for-you' ? 0.55 : temperament === 'business' ? 0.34 : 0.2;
    const trueMax = Math.max(60, Math.round(visibleWorth * greed * (0.8 + rng() * 0.4)));

    // He opens high. How high depends on whether he expects an argument.
    const openMult = temperament === 'bored' ? 1.5 : temperament === 'business' ? 1.8 : 2.2;
    const demand = Math.round(trueMax * openMult);

    return {
        name: OFFICER_NAMES[Math.floor(rng() * OFFICER_NAMES.length)],
        temperament,
        demand,
        trueMax,
        insultBelow: Math.round(trueMax * INSULT_FRACTION),
        maxRounds: PATIENCE[temperament] + (player.streetCred > 40 ? 1 : 0),
        knowsYou: player.streetCred > 55 || player.heat > 65,
        canJail: day > JAIL_MIN_DAY && player.heat >= JAIL_MIN_HEAT,
    };
}

const OFFICER_NAMES = [
    'The Tall One', 'Officer Sunglasses', 'The One With The Clipboard',
    'Sergeant Nobody', 'The Quiet One', 'The One Who Keeps Sighing',
];

/* ------------------------------------------------------------------ *
 * The negotiation
 * ------------------------------------------------------------------ */

export type BustStatus = 'negotiating' | 'settled' | 'refused' | 'insulted';

export interface BustState {
    officer: Officer;
    /** What he is asking for, right now. */
    asking: number;
    round: number;
    history: { by: 'officer' | 'you'; amount: number }[];
    status: BustStatus;
    /** Set once settled — what you actually agreed to pay. */
    agreed: number;
}

export const openBust = (officer: Officer): BustState => ({
    officer,
    asking: officer.demand,
    round: 0,
    history: [{ by: 'officer', amount: officer.demand }],
    status: 'negotiating',
    agreed: 0,
});

/**
 * Offer him money.
 *
 * Three ways this goes, and the player cannot tell in advance which one they
 * are about to get — that uncertainty is the whole mechanic:
 *
 *   - at or above his ceiling, he takes it;
 *   - below it but not insultingly, he concedes some ground and asks again,
 *     until his patience runs out and he stops asking;
 *   - far enough below it, he stops treating this as a transaction.
 */
export function offer(state: BustState, amount: number, rng: () => number): BustState {
    if (state.status !== 'negotiating') return state;
    const { officer } = state;
    const history = [...state.history, { by: 'you' as const, amount }];
    const round = state.round + 1;

    if (amount <= officer.insultBelow) {
        return { ...state, history, round, status: 'insulted' };
    }
    if (amount >= officer.trueMax) {
        return { ...state, history, round, status: 'settled', agreed: amount };
    }
    // Close enough that he might just take it rather than stand here.
    const gap = (officer.trueMax - amount) / officer.trueMax;
    if (gap < 0.18 && rng() < 0.5) {
        return { ...state, history, round, status: 'settled', agreed: amount };
    }
    if (round >= officer.maxRounds) {
        return { ...state, history, round, status: 'refused' };
    }
    // He concedes toward his ceiling, never past it.
    const next = Math.max(officer.trueMax, Math.round(state.asking - (state.asking - officer.trueMax) * 0.45));
    return {
        ...state,
        asking: next,
        round,
        history: [...history, { by: 'officer', amount: next }],
    };
}

/* ------------------------------------------------------------------ *
 * What it costs you
 * ------------------------------------------------------------------ */

export type BustChoice = 'pay' | 'refuse' | 'run' | 'drive' | 'swing';

export interface BustOutcome {
    player: Player;
    log: { icon: string; text: string; tone: 'good' | 'bad' | 'neutral' }[];
    /** Days lost. Only ever non-zero when `officer.canJail`. */
    daysLost: number;
    /** A mini-game to hand off to, when the player chose to make it physical. */
    minigame?: 'sneaker-chase' | 'cart-race' | 'street-brawl';
}

/** He searches you: pocket cash goes, counterfeits go, the bank is untouched. */
function searched(player: Player, severity: number): { player: Player; taken: number; fakes: number } {
    const taken = Math.round(seizableCash(player) * severity);
    const kept = player.inventory.filter(i => !i.isFake);
    const fakes = player.inventory.length - kept.length;
    return {
        player: { ...player, cash: player.cash - taken, inventory: kept },
        taken,
        fakes,
    };
}

export function resolveBust(
    state: BustState,
    choice: BustChoice,
    player: Player,
    rng: () => number,
): BustOutcome {
    const { officer } = state;
    const log: BustOutcome['log'] = [];

    if (choice === 'pay' && state.status === 'settled') {
        const paid = Math.min(state.agreed, seizableCash(player));
        const short = paid < state.agreed;
        if (short) {
            // Promising money you do not have is its own mistake.
            const s = searched(player, 1);
            log.push({ icon: '🚔', text: `You did not have it. He took the ${fmt(s.taken)} you did have.`, tone: 'bad' });
            return {
                player: { ...s.player, heat: clamp(player.heat + 14) },
                log, daysLost: 0,
            };
        }
        log.push({ icon: '💵', text: `${fmt(paid)} changes hands. He does not count it in front of you.`, tone: 'neutral' });
        return {
            player: { ...player, cash: player.cash - paid, heat: clamp(player.heat - 8) },
            log, daysLost: 0,
        };
    }

    if (choice === 'refuse' || state.status === 'refused' || state.status === 'insulted') {
        const insulted = state.status === 'insulted';
        const s = searched(player, insulted ? 1 : 0.7);
        if (s.taken > 0) log.push({ icon: '🚔', text: `${fmt(s.taken)} gone from your pocket.`, tone: 'bad' });
        if (s.fakes > 0) log.push({ icon: '👟', text: `${s.fakes} counterfeit ${s.fakes === 1 ? 'pair' : 'pairs'} confiscated.`, tone: 'bad' });
        if (player.bank > 0) log.push({ icon: '🏦', text: 'What is in the bank stays in the bank.', tone: 'good' });

        // No cell for refusing. Saying no to a shakedown is expensive — the
        // pocket and the counterfeits go — but it is not a crime, and being
        // jailed for declining to bribe somebody would read as the game
        // punishing the honest option.
        if (insulted) {
            log.push({ icon: '😐', text: 'He looks at what you offered him, then at you, and decides you are not worth the paperwork.', tone: 'bad' });
        }
        return {
            player: { ...s.player, heat: clamp(player.heat + (insulted ? 22 : 12)) },
            log, daysLost: 0,
        };
    }

    // Making it physical. The mini-game decides the rest; this is the cost of
    // trying, and the heat lands whether or not you get away.
    const minigame = choice === 'run' ? 'sneaker-chase' : choice === 'drive' ? 'cart-race' : 'street-brawl';
    log.push({
        icon: choice === 'swing' ? '🥊' : '🏃',
        text: choice === 'swing'
            ? 'You swing first. Whatever happens next is now entirely your fault.'
            : 'You move. So does he.',
        tone: 'neutral',
    });
    return {
        player: { ...player, heat: clamp(player.heat + (choice === 'swing' ? 26 : 16)) },
        log, daysLost: 0, minigame,
    };
}

/* ------------------------------------------------------------------ *
 * How the chase ends
 * ------------------------------------------------------------------ */

/**
 * The cell is only ever reached from here.
 *
 * Refusing to pay costs you money and counterfeits and nothing else — declining
 * a shakedown is not a crime, and jailing somebody for it would have the game
 * punishing the one honest option on the menu. What gets you booked is making
 * it physical and then losing: running, driving off, or swinging on him.
 *
 * Both of the owner's original guards still hold on top of that, so the worst
 * night in the game needs four things at once — you escalated, you lost, it is
 * past day 10, and your heat was already high. Getting away with it costs you
 * nothing but the heat you picked up on the way out.
 */
export function resolveEscape(
    officer: Officer,
    choice: Extract<BustChoice, 'run' | 'drive' | 'swing'>,
    gotAway: boolean,
    player: Player,
): BustOutcome {
    const log: BustOutcome['log'] = [];

    if (gotAway) {
        log.push({
            icon: choice === 'swing' ? '🥊' : '💨',
            text: choice === 'swing'
                ? 'He goes down. You are already three streets away when he gets up.'
                : 'Two corners and a fire escape later, nobody is behind you.',
            tone: 'good',
        });
        return { player, log, daysLost: 0 };
    }

    const s = searched(player, 1);
    log.push({
        icon: '🚔',
        text: choice === 'swing'
            ? 'It turns out he does this for a living and you do not.'
            : 'He was never going to be the one who got tired first.',
        tone: 'bad',
    });
    if (s.taken > 0) log.push({ icon: '💵', text: `${fmt(s.taken)} gone.`, tone: 'bad' });
    if (s.fakes > 0) log.push({ icon: '👟', text: `${s.fakes} counterfeit ${s.fakes === 1 ? 'pair' : 'pairs'} confiscated.`, tone: 'bad' });
    if (player.bank > 0) log.push({ icon: '🏦', text: 'The bank is still the bank.', tone: 'good' });

    const daysLost = officer.canJail ? 1 : 0;
    if (daysLost) {
        log.push({
            icon: '⛓️',
            text: choice === 'swing'
                ? 'You wake up on a bench, behind a door that locks from the outside. A day gone, and they have your name now.'
                : 'A night in a room with a bench and a door that locks from the outside. A day gone.',
            tone: 'bad',
        });
    }

    return {
        player: { ...s.player, heat: clamp(player.heat + (choice === 'swing' ? 18 : 10)) },
        log, daysLost,
    };
}

const clamp = (n: number) => Math.max(0, Math.min(MAX_HEAT, n));
const fmt = (n: number) => `$${n.toLocaleString()}`;
