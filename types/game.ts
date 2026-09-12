// Core progression / meta types introduced by the overhaul.

/**
 * A timed modifier on the world or the player. Unlike the legacy `StatusEffect`
 * (which expired on a wall-clock timestamp and therefore never mattered in a
 * turn-based game), buffs expire on a *game day*, so a "24h" buff is exactly
 * one travel away from wearing off.
 */
export type BuffKind =
    | 'storeDiscount'      // magnitude 0.9 => pay 90% in stores
    | 'resaleBonus'        // magnitude 1.15 => sell for 115%
    | 'volatilityDamp'     // magnitude 0.8 => 20% less price swing
    | 'luck'               // magnitude 0.25 => +25% good-roll weighting
    | 'travelSafety'       // magnitude 0.5 => halves danger weights
    | 'positiveTravel'     // charges: next N travel events are good only
    | 'robberyShield'      // charges: absorbs N robberies
    | 'marketInsight'      // reveals upcoming surges
    | 'curse';             // magnitude > 1 => danger weights scaled up

export interface Buff {
    id: string;
    kind: BuffKind;
    label: string;
    magnitude: number;
    /** Game day on which this buff stops applying. Omit for permanent. */
    expiresOnDay?: number;
    /** Remaining uses, for charge-based buffs. Omit for duration-based. */
    charges?: number;
    source?: string;
}

/** One line in the post-interaction receipt shown to the player. */
export interface OutcomeLogEntry {
    icon: string;
    text: string;
    tone: 'good' | 'bad' | 'neutral';
}

export type MiniGameId =
    // Ids are stable: `street-brawl` and `street-ball` keep their names so the
    // ~223 already-authored `combat` outcomes keep resolving, even though both
    // are now full 2D canvas games rather than the original text prototypes.
    | 'street-brawl'      // 2D fighter
    | 'street-ball'       // 2D arcade hoops
    | 'hypecast-roulette'
    | 'sneaker-chase'
    | 'mystery-box'
    | 'legit-check'
    | 'flight-404'        // run-and-gun plane rescue
    | 'cart-race';        // downhill shopping cart chase

/** A request to hand control to a mini-game, plus what to do with the result. */
export interface MiniGameRequest {
    game: MiniGameId;
    title: string;
    /** Free-form payload the individual game understands. */
    config?: Record<string, any>;
    /** Applied when the player wins. */
    onWin?: import('./interactions').ScenarioOutcome[];
    /** Applied when the player loses. */
    onLose?: import('./interactions').ScenarioOutcome[];
}

export interface SideQuest {
    id: string;
    title: string;
    blurb: string;
    giverNpcId: string;
    giverName: string;
    /** Cities the player must visit, in order, to progress. */
    steps: { cityId: string; prompt: string }[];
    stepIndex: number;
    rewardCash: number;
    rewardCred: number;
    /** Chance the payoff is secretly a legendary pair instead of pocket change. */
    jackpotChance: number;
    startedOnDay: number;
}
