/**
 * How real a pair is, on a scale.
 *
 * `isFake` is a boolean, and that boolean is the reason the counterfeit game
 * has never been a game. A fake costs 15% of real value, so it is not a scam —
 * it is a discount bin. Nobody is deceived. The margin comes from the buyer
 * failing a dice roll rather than from anything the player planned, and the
 * fantasy the whole thing is reaching for is the opposite of that: *you knew,
 * they didn't*.
 *
 * You cannot express that with two values. Deception needs a pair that looks
 * right, costs real money, and might survive a look — so authenticity becomes
 * a ladder:
 *
 *   - **retail** — the real thing.
 *   - **unauthorised** — same factory, off the books. Costs over half of real
 *     money, and almost nobody can tell. This is the rung that makes reps an
 *     investment decision instead of free money: get it wrong and you have
 *     lost serious capital, not pocket change.
 *   - **super** — a good rep. Wrong stitching if you know where to look.
 *   - **street** — what is in the discount bin today. Exactly what the current
 *     game ships; demoted from being the whole ladder to being its bottom rung,
 *     so nothing that exists is lost.
 *
 * The second half is `DIFFICULTY`. Every existing detection roll — the street
 * buyer's `eye`, the collector's `fakeDetectChance`, the shop's
 * `securityLevel` — gets multiplied by it. That single change is what turns
 * "will the dice save me" into **who you choose to sell to**: an unauthorised
 * pair is near-safe with a tourist and a coin toss with a collector who knows
 * that model.
 *
 * Nothing here is shown to the player. This module is the truth; what the
 * player believes is a separate thing, and a later step.
 */

export type AuthGrade = 'retail' | 'unauthorised' | 'super' | 'street';

/** Every grade, worst to best, for iteration and tests. */
export const AUTH_GRADES: AuthGrade[] = ['street', 'super', 'unauthorised', 'retail'];

/**
 * What a pair of this grade costs, against what the real thing is worth.
 * `street` is 0.15 because that is what the game already charges — this table
 * is a superset of current behaviour, not a change to it.
 */
export const GRADE_COST: Record<AuthGrade, number> = {
    retail: 1,
    unauthorised: 0.55,
    super: 0.3,
    street: 0.15,
};

/**
 * How much of an examiner's eye actually lands. 1 means their full skill
 * applies; 0.3 means a very good fake gives even a sharp buyer most of the
 * benefit of the doubt. `retail` is 0 — there is nothing to find.
 */
export const GRADE_DIFFICULTY: Record<AuthGrade, number> = {
    retail: 0,
    unauthorised: 0.3,
    super: 0.55,
    street: 1,
};

/** Shown when a grade is finally forced into the open. */
export const GRADE_LABEL: Record<AuthGrade, string> = {
    retail: 'Retail',
    unauthorised: 'Unauthorised',
    super: 'Super',
    street: 'Obvious rep',
};

export const isCounterfeit = (grade: AuthGrade): boolean => grade !== 'retail';

/**
 * The grade of anything that might predate the ladder.
 *
 * Twenty-nine files read `isFake`, and a save written by yesterday's build has
 * no grade on anything. Both resolve here rather than at every call site: no
 * grade and not fake means retail, no grade and fake means `street`, which is
 * exactly what that pair was worth when it was created.
 */
export function gradeOf(item: { grade?: AuthGrade; isFake?: boolean }): AuthGrade {
    if (item.grade) return item.grade;
    return item.isFake ? 'street' : 'retail';
}

/** Kept in step with `gradeOf`, so the old boolean never disagrees with the ladder. */
export const fakeFlagFor = (grade: AuthGrade): boolean => isCounterfeit(grade);

/**
 * What an examiner of a given sharpness actually notices.
 *
 * The one function every detection roll in the game routes through, so the
 * ladder cannot be applied in three places three different ways. Clamped below
 * 0.97: nobody is ever certain, which keeps a legendary collector from being a
 * wall that ends the strategy outright.
 */
export function spotChance(eye: number, grade: AuthGrade): number {
    if (!isCounterfeit(grade)) return 0;
    return Math.max(0, Math.min(0.97, eye * GRADE_DIFFICULTY[grade]));
}

/**
 * What a counterfeit of this grade should be listed at, given the real price.
 * Separate from `spotChance` on purpose: cost and risk are the two axes the
 * player trades against each other, and they should be tunable apart.
 */
export const gradePrice = (realPrice: number, grade: AuthGrade): number =>
    Math.max(1, Math.round(realPrice * GRADE_COST[grade]));

/* ------------------------------------------------------------------ *
 * The leak
 * ------------------------------------------------------------------ */

/**
 * What the seller *says* it is, which is not always what it is.
 *
 * A fakes tab is honest — it says rep, it charges rep money, and nobody is
 * fooled. A pair that has leaked onto the ordinary shelf claims to be retail
 * and is priced like retail, and that is the whole scam: the money you lose
 * buying one is the money somebody else makes selling one.
 *
 * Defaults to the truth, so every listing that predates the leak is honest by
 * construction and nothing already on a shelf changes.
 */
export function claimedGradeOf(item: { claimed?: AuthGrade; grade?: AuthGrade; isFake?: boolean }): AuthGrade {
    return item.claimed ?? gradeOf(item);
}

/** True when a listing is being passed off as better than it is. */
export const isPassedOff = (item: { claimed?: AuthGrade; grade?: AuthGrade; isFake?: boolean }): boolean =>
    GRADE_COST[claimedGradeOf(item)] > GRADE_COST[gradeOf(item)];

/**
 * How often an ordinary tab is holding something that is not what it says,
 * by the store's own rigour.
 *
 * A gallery that authenticates everything is not immune, only careful — 2.5%
 * keeps the paranoia alive without making the expensive shops a trap. A stall
 * that guarantees nothing is holding reps about a fifth of the time, which is
 * roughly what it means to buy from a man with a trunk.
 *
 * This is the dial that decides whether every purchase carries a question, so
 * it is the first number step 3 will tune against the simulation.
 */
export const LEAK_RATE: Record<number, number> = { 0: 0.22, 1: 0.09, 2: 0.025 };

export const leakRateFor = (securityLevel: number): number => LEAK_RATE[securityLevel] ?? LEAK_RATE[1];

/**
 * What grade of fake gets past a shop of a given rigour.
 *
 * The better the shop, the better the paper has to be to be sitting on its
 * shelf at all — an obvious rep does not survive a gallery's intake, so a
 * level-2 leak is always something that nearly passes. The flip side is that
 * the careful shop's rare fake is the dangerous one: it is expensive and it
 * looks right.
 */
export function gradeForLeak(securityLevel: number, rng: () => number): AuthGrade {
    const roll = rng();
    if (securityLevel >= 2) return roll < 0.6 ? 'unauthorised' : 'super';
    if (securityLevel === 1) {
        if (roll < 0.25) return 'unauthorised';
        return roll < 0.75 ? 'super' : 'street';
    }
    if (roll < 0.1) return 'unauthorised';
    return roll < 0.45 ? 'super' : 'street';
}

/**
 * A leak is listed at the price of the thing it claims to be — full retail, no
 * discount, no tell.
 *
 * The first draft gave it a keen sticker, on the theory that price-against-
 * market is the player's first clue. That needed genuine clearance to exist
 * alongside it, or "marked down" would just be the word "fake" in a costume.
 * Measuring it killed it: the economy already runs at a 244% best cross-city
 * margin against a 260% ceiling, so *any* real pair listed below its rate blows
 * the arbitrage guard — a 7% discount is enough. Cheaper real stock is the one
 * thing this economy has no room for.
 *
 * So the mystery rests on the other three signals instead: how rigorous the shop
 * is, how the seller talks about the pair, and paying for a `LegitCheck`. Those
 * cost nothing economically and are the readable ones anyway. If step 3 says the
 * player still cannot form a view, the missing signal is more seller dialogue,
 * not a cheaper sticker.
 */

/* ------------------------------------------------------------------ *
 * Looking, and seeing
 * ------------------------------------------------------------------ */

/**
 * Whether anybody examines the pair at all.
 *
 * This is the half that was missing, and its absence is why running reps does
 * not pay. One roll used to do both jobs: a `securityLevel 0` counter worked out
 * at about `0 × 0.4 + heat/400` ≈ 0.24 even at heat 97, and against an
 * `unauthorised` pair that is a 7% chance of being caught. Simulated over 400
 * runs, a rep-runner dumping over such a counter was searched **0.4 times in
 * thirty days** — so "who do you sell to" collapsed to "always the grimiest shop
 * in town", which is not a decision.
 *
 * Splitting it fixes that without making the grimy clerk sharp-eyed, which would
 * have been the wrong lie: he is not better at spotting fakes, he just can't be
 * bothered most of the time. **Most of the time is not every time.** Even the
 * worst counter in the game gives the pair a look now and then, and that floor
 * is what puts the risk back in the channel.
 *
 * It is also the hook everything else in `docs/TRUST.md` hangs off. Trust,
 * per-shop suspicion and the schmooze all move *this* number — whether you get
 * looked at — and leave `spotChance` alone, because none of them change how good
 * anybody's eyes are.
 */

/** Even the laziest counter in the game looks this often. */
export const CHECK_FLOOR = 0.1;
/** Nobody is a certainty, so a clean pair is always worth trying somewhere. */
export const CHECK_CEILING = 0.95;

/**
 * How often a counter of a given rigour bothers to look.
 *
 * `securityLevel` is authored 0–2 per store. A gallery that authenticates
 * everything checks nearly always; a man with a trunk checks about one time in
 * ten. `suspicion` is that specific shop's memory of you and is the sharpest
 * term here: a counter that has caught you once checks you nearly every time,
 * whatever its posted policy, which is what makes getting caught burn the venue
 * rather than the city.
 *
 * `heat` still leans on it, because a man the police are asking about is a man
 * whose merchandise gets a second look.
 */
export function checkChance(opts: {
    securityLevel: number;
    /** 0..1. This shop's memory of you. */
    suspicion?: number;
    /** 0..100. */
    heat?: number;
    /** 0..1. Beers, a joint, a coffee. Subtracted last. */
    distraction?: number;
}): number {
    const { securityLevel, suspicion = 0, heat = 0, distraction = 0 } = opts;
    const base = CHECK_FLOOR + Math.max(0, Math.min(2, securityLevel)) * 0.38;
    // A shop that has been burned by you stops honouring its own laziness.
    const remembered = base + (1 - base) * Math.max(0, Math.min(1, suspicion));
    const hot = remembered + Math.max(0, Math.min(100, heat)) / 400;
    const looked = hot * (1 - Math.max(0, Math.min(1, distraction)));
    // The floor survives a distraction: somebody always glances. Buying the
    // clerk a beer is an edge, never a cloak.
    return Math.max(CHECK_FLOOR * 0.5, Math.min(CHECK_CEILING, looked));
}

/**
 * The odds of being made: they have to look *and* see.
 *
 * Exported as the number as well as the roll, because anything reasoning about
 * risk — the buy policy in `tests/rep-economy.test.mts`, a future "is this worth
 * it" hint — needs the probability, and a second hand-written copy of
 * `check × spot` is exactly how the old single-roll bug survived three call
 * sites. One definition, used by both.
 */
export function catchChance(
    item: { grade?: AuthGrade; isFake?: boolean },
    look: Parameters<typeof checkChance>[0],
    eye: number,
): number {
    const grade = gradeOf(item);
    if (!isCounterfeit(grade)) return 0;
    return checkChance(look) * spotChance(eye, grade);
}

/**
 * The whole detection sequence, rolled.
 *
 * Two rolls rather than one multiplied probability, so the two halves stay
 * distinguishable in play: "he never even looked" and "he looked and shrugged"
 * are different stories, and a later pass can narrate them differently.
 */
export function caughtWith(
    item: { grade?: AuthGrade; isFake?: boolean },
    look: Parameters<typeof checkChance>[0],
    eye: number,
    rng: () => number = Math.random,
): boolean {
    const grade = gradeOf(item);
    if (!isCounterfeit(grade)) return false;
    if (rng() >= checkChance(look)) return false;   // nobody looked
    return rng() < spotChance(eye, grade);          // they looked, did they see
}
