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
