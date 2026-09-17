/**
 * Run grades — the ladder the 30-day run is actually scored on.
 *
 * Street cred (CRED_RANKS in constants.ts) measures who knows your name.
 * This measures whether the month was worth doing, and it is deliberately a
 * *multiple* of the stake rather than an absolute number: $8,000 means
 * something very different to a player who started with $2,000 than it would
 * if the opening cash were ever retuned.
 *
 * The verdicts are the payoff of the whole run, so they are written like the
 * rest of the game talks — flat, specific, and never congratulatory.
 */

export interface RunGrade {
    /** Lowest net-worth-to-stake ratio that earns this grade. */
    min: number;
    title: string;
    /** One line of dry accounting, shown under the title. */
    verdict: string;
    /** Drives the accent colour of the summary panel. */
    tone: 'bad' | 'flat' | 'good' | 'great';
}

export const RUN_GRADES: RunGrade[] = [
    {
        min: 0,
        title: 'Liquidated',
        verdict: 'Thirty days of trading and you finish with less than bus fare. Somebody out there is walking around in your money.',
        tone: 'bad',
    },
    {
        min: 0.3,
        title: 'Underwater',
        verdict: 'You bought high and sold every time you got nervous. The market kept the difference.',
        tone: 'bad',
    },
    {
        min: 0.75,
        title: 'Down, Slightly',
        verdict: 'Not a catastrophe. A slow leak, observed over a month, by you, without intervention.',
        tone: 'bad',
    },
    {
        min: 1,
        title: 'Break-Even Merchant',
        verdict: 'You end roughly where you began, having aged noticeably. Accountants call this neutral.',
        tone: 'flat',
    },
    {
        min: 1.5,
        title: 'Modest Operator',
        verdict: 'A real profit. Small, but it is there, and it will still be there tomorrow.',
        tone: 'good',
    },
    {
        min: 3,
        title: 'Certified Flipper',
        verdict: 'You found the spread and worked it. Two cities recognise you and one of them is annoyed about it.',
        tone: 'good',
    },
    {
        min: 6,
        title: 'Regional Menace',
        verdict: 'Prices moved when you walked into a room. There is a group chat about you and you are not in it.',
        tone: 'great',
    },
    {
        min: 12,
        title: 'Drip Syndicate',
        verdict: 'You stopped trading shoes somewhere around week two and started trading the idea of shoes. It priced better.',
        tone: 'great',
    },
    {
        min: 25,
        title: 'Footwear Oligarch',
        verdict: 'You own the number, and the number owns everybody else. Bibi has your phone number now, which is its own kind of problem.',
        tone: 'great',
    },
];

/** The grade a given net worth earns against the stake it started from. */
export const getRunGrade = (netWorth: number, startingCash: number): RunGrade => {
    const ratio = startingCash > 0 ? netWorth / startingCash : 0;
    let grade = RUN_GRADES[0];
    for (const g of RUN_GRADES) if (ratio >= g.min) grade = g;
    return grade;
};

export interface RunClock {
    /** Days of trading left *after* today. Zero means this is the last one. */
    daysLeft: number;
    /** Short form for chips and buttons. */
    label: string;
    /** Theme token, so the deadline reads the same on every screen. */
    color: string;
    /** True once the deadline is close enough to change how you play. */
    urgent: boolean;
}

/**
 * The deadline, resolved once so the Dashboard, the Departures board and the
 * Dossier cannot drift on what "days left" means. A run can overshoot day 30
 * (naps and hospital stays cost days), hence the clamp at zero.
 */
export const getRunClock = (day: number, totalDays: number): RunClock => {
    const daysLeft = Math.max(0, totalDays - day);
    const label = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
    if (daysLeft <= 0) return { daysLeft: 0, label: 'Final day', color: 'var(--bad)', urgent: true };
    if (daysLeft <= 3) return { daysLeft, label, color: 'var(--bad)', urgent: true };
    if (daysLeft <= 7) return { daysLeft, label, color: 'var(--warn)', urgent: true };
    return { daysLeft, label, color: 'var(--accent)', urgent: false };
};

/**
 * How fast the run is going, and where that lands it on day 30.
 *
 * Both are `null` on day 1, and that is the point of this function existing.
 *
 * The Dossier used to compute the rate inline over `Math.max(1, day - 1)` days.
 * On day 1 that divides by a day that has not happened: a morning's worth of
 * unrealised paper movement became a *daily* rate, got multiplied by the 29 days
 * still to come, and the panel announced a projected $26,000 and the rank of
 * Drip Syndicate before the player had closed a single day of trading. The
 * clamp was there to dodge a division by zero, and it did — by inventing the
 * denominator instead of admitting there wasn't one.
 *
 * No elapsed time is not a rate of zero. It is the absence of a rate, and the
 * only honest thing to report is nothing.
 */
export interface RunRate {
    /** Net change per day *closed*, or null before the first day closes. */
    perDay: number | null;
    /** Net worth on the final day at that rate, or null when there is no rate. */
    projected: number | null;
    /** Days actually behind the player. Zero on day 1. */
    daysTraded: number;
}

export const getRunRate = (
    netWorth: number,
    startingCash: number,
    day: number,
    daysLeft: number,
): RunRate => {
    const daysTraded = Math.max(0, day - 1);
    if (daysTraded === 0) return { perDay: null, projected: null, daysTraded: 0 };
    const perDay = (netWorth - startingCash) / daysTraded;
    return {
        perDay,
        projected: Math.max(0, Math.round(netWorth + perDay * daysLeft)),
        daysTraded,
    };
};

/** Theme token for a grade, so the summary and the projection agree on colour. */
export const gradeColor = (tone: RunGrade['tone']): string => ({
    bad: 'var(--bad)',
    flat: 'var(--ink-dim)',
    good: 'var(--ok)',
    great: 'var(--legend)',
}[tone]);
