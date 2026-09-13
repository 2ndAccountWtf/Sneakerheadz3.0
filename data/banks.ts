import { timeOfDayFor } from './venues';

/**
 * Banks.
 *
 * The whole point of the banking layer is a real choice about where your
 * money sits: in your pocket (cheap, fast, robbable) or in an account
 * (safe, slow, gated behind hours and machines). This file is the "gated
 * behind machines" half.
 *
 * Branches are free and generous but keep banker's hours — gated by
 * `timeOfDay` the same way `Venue` is, off `day % 4`. ATMs are everywhere,
 * charge a fee, and cap what they'll hand you in a day. Sketchy ATMs waive
 * none of that and add a real chance of losing the card outright — they
 * exist because the fee is a dollar cheaper and the walk is shorter, which
 * is exactly the kind of trade a broke player will take at 2am.
 */
export interface Bank {
    id: string;
    cityId: string;
    name: string;
    kind: 'branch' | 'atm' | 'sketchy-atm';
    /** Flat fee per withdrawal, charged out of the bank balance. Branches: 0. */
    fee: number;
    /** Most that can be drawn here in a single day, across every visit. */
    dailyLimit: number;
    /** Branches only. Only open at this point in the day cycle (day % 4). */
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    /** Shown instead of the withdraw button when a branch is shut. */
    closedLine?: string;
    blurb: string;
    /**
     * Sketchy ATMs only. 0..1 chance the machine skims the card on a
     * successful withdrawal — you get your cash, and a few days later the
     * bank tells you why the card stopped working.
     */
    skimRisk?: number;
}

export const BANKS: Bank[] = [
    // --- TOKYO ---
    {
        id: 'tokyo-branch',
        cityId: 'tokyo',
        name: 'Shinjuku Trust Window',
        kind: 'branch',
        fee: 0,
        dailyLimit: 5000,
        timeOfDay: 'afternoon',
        closedLine: 'A recorded voice apologises in two languages. The shutter does not move.',
        blurb: 'A teller bows exactly as far as your account balance warrants. No card needed — bring your face.',
    },
    {
        id: 'tokyo-conbini-atm',
        cityId: 'tokyo',
        name: '7-Twelve ATM',
        kind: 'atm',
        fee: 4,
        dailyLimit: 1000,
        blurb: 'Inside a convenience store that never closes. Announces your balance in a cheerful jingle.',
    },
    {
        id: 'tokyo-pachinko-atm',
        cityId: 'tokyo',
        name: 'Machine, Back of the Pachinko Parlor',
        kind: 'sketchy-atm',
        fee: 3,
        dailyLimit: 1200,
        skimRisk: 0.14,
        blurb: 'Wedged between the bathroom and a fire exit. The decal on it is for a bank that no longer exists.',
    },

    // --- TEL AVIV ---
    {
        id: 'tlv-branch',
        cityId: 'tel-aviv',
        name: 'Bank Hapoalim, Dizengoff',
        kind: 'branch',
        fee: 0,
        dailyLimit: 4500,
        timeOfDay: 'morning',
        closedLine: 'A guard at the door explains, not unkindly, that you have missed it by a lot.',
        blurb: 'Take a number. Argue about the number. Eventually someone calls it.',
    },
    {
        id: 'tlv-street-atm',
        cityId: 'tel-aviv',
        name: 'Street Corner ATM',
        kind: 'atm',
        fee: 4,
        dailyLimit: 900,
        blurb: 'Bolted to a wall between a falafel stand and a shuttered kiosk. Reliable, if warm to the touch.',
    },
    {
        id: 'tlv-shawarma-atm',
        cityId: 'tel-aviv',
        name: 'Machine Bolted to the Shawarma Stand',
        kind: 'sketchy-atm',
        fee: 2,
        dailyLimit: 1000,
        skimRisk: 0.16,
        blurb: 'A hand-lettered "CASH ONLY, ATM INSIDE" sign points at a machine older than the stand itself.',
    },

    // --- NEW YORK ---
    {
        id: 'ny-branch',
        cityId: 'new-york',
        name: 'Chase Branch, Canal St',
        kind: 'branch',
        fee: 0,
        dailyLimit: 5000,
        timeOfDay: 'afternoon',
        closedLine: 'A gate is down over the doors. The next-branch sticker lists an address in another borough.',
        blurb: 'Bulletproof glass and a line that moves slower than the subway. Still the safest way to move real money.',
    },
    {
        id: 'ny-bodega-atm',
        cityId: 'new-york',
        name: 'Bodega ATM',
        kind: 'atm',
        fee: 5,
        dailyLimit: 800,
        blurb: 'Between the lottery scratchers and the cat. The fee is a local tax and everyone knows it.',
    },
    {
        id: 'ny-check-cashing-atm',
        cityId: 'new-york',
        name: 'Machine, Check-Cashing Storefront',
        kind: 'sketchy-atm',
        fee: 3,
        dailyLimit: 1200,
        skimRisk: 0.18,
        blurb: 'Fluorescent lights, bulletproof counter, a machine in the corner nobody working there will vouch for.',
    },

    // --- LOS ANGELES ---
    {
        id: 'la-branch',
        cityId: 'los-angeles',
        name: 'Wilshire Private Banking',
        kind: 'branch',
        fee: 0,
        dailyLimit: 6000,
        timeOfDay: 'morning',
        closedLine: 'Appointment only, and yours was for tomorrow. The lobby plant is very well maintained.',
        blurb: 'Valet parking for a bank. The limit is generous because they assume you drove here in something nice.',
    },
    {
        id: 'la-gas-station-atm',
        cityId: 'los-angeles',
        name: 'Gas Station ATM',
        kind: 'atm',
        fee: 4,
        dailyLimit: 800,
        blurb: 'Next to the air pump nobody ever uses. The screen has a crack that eats the last digit of your balance.',
    },
    {
        id: 'la-strip-mall-atm',
        cityId: 'los-angeles',
        name: 'Machine, Strip-Mall Check Cashing',
        kind: 'sketchy-atm',
        fee: 3,
        dailyLimit: 1100,
        skimRisk: 0.15,
        blurb: 'Between a nail salon and a store that only sells phone cases. The receipt paper ran out in March.',
    },

    // --- PARIS ---
    {
        id: 'paris-branch',
        cityId: 'paris',
        name: 'Société Rive Gauche',
        kind: 'branch',
        fee: 0,
        dailyLimit: 4500,
        timeOfDay: 'morning',
        closedLine: 'FERMÉ POUR LE DÉJEUNER. It is a two-hour lunch and nobody will apologise for it.',
        blurb: 'Marble floor, a clerk who will not be rushed. Closes for lunch as a point of principle.',
    },
    {
        id: 'paris-street-atm',
        cityId: 'paris',
        name: 'Distributeur, Rue de Rivoli',
        kind: 'atm',
        fee: 4,
        dailyLimit: 900,
        blurb: 'Under an awning, in front of a shuttered boulangerie. Menu in six languages, all of them curt.',
    },
    {
        id: 'paris-tabac-atm',
        cityId: 'paris',
        name: 'Machine, Back of the Tabac',
        kind: 'sketchy-atm',
        fee: 2,
        dailyLimit: 1000,
        skimRisk: 0.16,
        blurb: 'Past the cigarette rack and the scratch cards. The owner watches you use it and says nothing.',
    },

    // --- CHICAGO ---
    {
        id: 'chi-branch',
        cityId: 'chicago',
        name: 'The Loop National',
        kind: 'branch',
        fee: 0,
        dailyLimit: 5000,
        timeOfDay: 'afternoon',
        closedLine: 'Steel shutters, a paper sign, wind that makes reading the sign a whole activity.',
        blurb: 'Marble lobby, brass everything, a line of regulars who know the tellers by name.',
    },
    {
        id: 'chi-el-atm',
        cityId: 'chicago',
        name: 'ATM, Under the El Tracks',
        kind: 'atm',
        fee: 4,
        dailyLimit: 800,
        blurb: 'Every withdrawal is punctuated by a train passing directly overhead.',
    },
    {
        id: 'chi-currency-exchange-atm',
        cityId: 'chicago',
        name: 'Machine, Currency Exchange Storefront',
        kind: 'sketchy-atm',
        fee: 3,
        dailyLimit: 1200,
        skimRisk: 0.17,
        blurb: 'Bulletproof glass out front, one lonely machine in back, bolted to the floor for reasons unstated.',
    },
];

export const banksIn = (cityId: string): Bank[] => BANKS.filter(b => b.cityId === cityId);

/** Branches keep hours; ATMs of any kind never close. */
export const isBankOpen = (bank: Bank, day: number): boolean =>
    !bank.timeOfDay || bank.timeOfDay === timeOfDayFor(day);
