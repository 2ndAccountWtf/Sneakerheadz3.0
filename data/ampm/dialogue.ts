/**
 * AM/PM worker dialogue.
 *
 * Organised by context key. The store screen pulls a line from whichever pool
 * matches what the player is doing — entering, browsing, looking at weapons,
 * checking out — so the same shop never sounds the same twice.
 */

export interface AmpmDialoguePack {
    greetings: string[];
    randomComments: string[];
    weirdCompliments: string[];
    upsells: string[];
    chaoticEnergy: string[];
    weaponsTalk: string[];
    afterPurchase: string[];
    /** Ambient events described in the third person. */
    randomEvents: string[];
    localFlavor: Record<string, string[]>;
    /** Tel Aviv, after 1:30am, when the clerk has decided the store is a club. */
    telAvivNightMode: string[];
}

export const AMPM_DIALOGUE: AmpmDialoguePack = {
    greetings: [
        "Welcome to AM/PM. No, we don't take crypto. Not after last time.",
        "Yo, grab a bureka — they're fresh. By fresh I mean, like, from yesterday.",
        "AM/PM, baby. Open 24/7, except when we randomly close for 'inventory'.",
        'Big drip energy in here. Don’t scuff the tiles.',
        'Welcome to the temple of bad decisions and lukewarm coffee.',
    ],

    randomComments: [
        'I once saw a guy buy chocolate milk and a crowbar at 3 AM. Never saw him again.',
        'Don’t look at the slushie machine. It knows things.',
        'Burekas are two for one. Or one for two. Honestly, I make up the prices.',
        'Every shoe you wear has stepped on cursed ground. Think about that.',
        'These hummus tubs? Expire tomorrow. Or yesterday. Depends on how you feel.',
    ],

    weirdCompliments: [
        'Nice sneakers. They’d look better if you bought a bag of peanuts with them.',
        "Your aura? Screams 'double-chocolate muffin' today.",
        'Those Triple Whites? They’ll glow under the neon here. Try it.',
        'Respect. Only real ones buy chocolate milk in a bag after midnight.',
        'Bro… your laces match the tile grout. That’s rare alignment.',
    ],

    upsells: [
        'Buy two Red Bulls and I’ll throw in a free stare of judgment.',
        'Need a baguette? No? What about a half-charged vape?',
        'Upgrade to the family-size hummus, you coward.',
        'If you’re buying snacks, at least buy ironic snacks.',
        'Bro, you NEED this glow-in-the-dark lighter. Trust me.',
    ],

    chaoticEnergy: [
        'I just saw a pigeon eat a hot dog in the parking lot. This city is cursed.',
        'Someone parked a Lambo in the loading zone and ran in for a single chocolate milk.',
        'Don’t go near aisle 3. Someone spilled aura enhancer all over the floor.',
        'A guy bought every Snickers bar last week. Said he was starting a hedge fund.',
        'At 2 AM, the nacho cheese machine whispers secrets. Loudly.',
    ],

    weaponsTalk: [
        'You want the baguette? Careful — it hits harder than you think.',
        'Chicago dog launcher is out of stock. Someone used it on a scooter gang.',
        "In New York, we only sell the 'Please Don't Hurt Me' sign. Low success rate.",
        'Chanclas? Oh yeah, high accuracy. Moms been using them for decades.',
        'Tel Aviv special? Best weapon in the game. Ask no questions, pay in cash.',
    ],

    afterPurchase: [
        'Enjoy your snacks, king.',
        'Come back when you’re hungrier and poorer.',
        'May your sneakers stay clean and your receipts stay long.',
        'No refunds. No eye contact. Just vibes.',
        'Congrats. You now own something mildly cursed.',
    ],

    randomEvents: [
        "The worker yells 'FREE FALAFELSTEEN!' at nobody and ducks behind the counter.",
        'A raccoon wanders in, grabs a donut, and leaves like it owns the place.',
        'The employee asks if you’ve seen the truth in the slushie machine.',
        'The register glitches. Something ends up in your bag unpaid for.',
        'Someone sprints through screaming about rare Yeezys dropping in the alley.',
    ],

    localFlavor: {
        'tel-aviv': [
            'Welcome to AM/PM, achi. Burekas still hot — careful, burns your tongue but heals your soul.',
            'Bro, the chocolate milk is fresh. Don’t ask how fresh, just trust me.',
            'You want hummus? Sabich? We got everything but peace in the Middle East.',
            'I can sell you a bureka and advice, but the advice is terrible.',
            'Don’t forget — buy three burekas, get one political rant for free.',
        ],
        'los-angeles': [
            'Welcome to AM/PM, home of influencers and sadness.',
            'Careful. Hollywood people been buying all the vegan jerky again.',
            'Bro, those sandals? Peak Venice drip.',
            'Our energy drinks are as fake as the smiles around here.',
            'If you hear screaming in aisle 2, it’s just an acting class.',
        ],
        'new-york': [
            'Yo. Grab what you need. Don’t talk to me.',
            'Don’t stare at the hot dog roller too long. It stares back.',
            'Card declines, you clean the bathroom. House rules.',
            'This AM/PM? Oldest in the city. Probably haunted.',
            'Bagel chips half off. Don’t ask why. Just take ‘em.',
        ],
        chicago: [
            'What’s up? Deep dish in the freezer. It’s… edible.',
            'Wind blew the sign off again. Ignore the missing letters.',
            'If you need hot dogs, we got ‘em — and a launcher if you’re lucky.',
            'Careful leaving. Parking lot’s a hockey rink in winter.',
            'This AM/PM survived three robberies and one raccoon infestation.',
        ],
        tokyo: [
            'Welcome to AM/PM. Buy the matcha kit-kats. Trust me.',
            'Respect the shelves. They are perfectly organized for harmony.',
            'We sell umbrellas, ramen, and dreams. Mostly ramen.',
            'This one? Exclusive Gundam lighter. Only one left.',
            'Don’t open the freezer in the back. It’s… not for customers.',
        ],
        paris: [
            'Bonjour. Baguette? Croissant? Disappointment?',
            'Everything here is overpriced. You knew that when you walked in.',
            'You wear Yeezys? Tragic, monsieur.',
            'Buy a baguette — or don’t. I don’t care.',
            'Try the sparkling water. It’s the only pure thing left in this city.',
        ],
    },

    telAvivNightMode: [
        'Yalla yalla, chevre! Volume up! This is not AM/PM — this is Amnesia, ach sheli!',
        'Whooooo! Oi! You, with the white dress — yes you — you want free Red Bull, ah?',
        'Bro, don’t just stand there, move, dance — hummus is for everyone tonight!',
        'Sababa, achi, sababaaa! I love you, I love everyone — even the cat in the fridge!',
        'Listen, chevre, my cousin DJ Beni, he made this remix, yeah? Tomorrow he’s in Ibiza, but tonight, here, in my heart!',
        'Ahhhh, Tel Aviv! The city that never sleeps! Neither do I! YALLA!',
        'Bro, stop filming me, you think you’re TikTok? No, no, film her — SHE’S the queen tonight!',
        'Listen, you beautiful, take the chocolate milk, free, but you gotta dance for 10 seconds, minimum!',
        'Achi, don’t just grab hummus and leave — stay, stay, dance, sababa vibes!',
        'What do you mean you want bag? No bag! Dance is the bag tonight!',
        'Bro, I love you, I swear. Even though you spilled the slushie, it’s fine. This is family, ah?',
        'Yalla, chevre, I want circle now — circle, circle, we do hora with the Red Bull cans!',
        'Who unplugged the speaker?! I swear on my grandmother’s bureka I will Bit you right now!',
        'Listen, listen, tonight we are kings, tomorrow we clean aisle three, but tonight — KINGS!',
        'Bro, why you looking at me? Join, join, no one leaves AM/PM without dance.',
        'Chevre, chevre, give space — someone is about to crowd-surf over the slushie machine!',
        'I love you, you, all of you, even the scooter guys who parked in the disabled spot!',
        'Wait wait wait — my Bit app froze. Someone send me 10 shekel and I’ll Bit you back double, I promise.',
        'Tonight, everyone drinks chocolate milk from the bag, together. Brotherhood. Zionism. Sababa.',
    ],
};

const pick = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];

/** A greeting, biased toward the local pool when one exists for this city. */
export function ampmGreeting(cityId: string, nightMode: boolean): string {
    if (nightMode) return pick(AMPM_DIALOGUE.telAvivNightMode);
    const local = AMPM_DIALOGUE.localFlavor[cityId];
    if (local && Math.random() < 0.65) return pick(local);
    return pick(AMPM_DIALOGUE.greetings);
}

/** Ambient chatter while the player browses. */
export function ampmChatter(cityId: string, nightMode: boolean): string {
    if (nightMode) return pick(AMPM_DIALOGUE.telAvivNightMode);
    const pools = [
        AMPM_DIALOGUE.randomComments,
        AMPM_DIALOGUE.weirdCompliments,
        AMPM_DIALOGUE.chaoticEnergy,
        AMPM_DIALOGUE.upsells,
        AMPM_DIALOGUE.localFlavor[cityId] ?? AMPM_DIALOGUE.greetings,
    ];
    return pick(pools[Math.floor(Math.random() * pools.length)]);
}

export const ampmWeaponsTalk = () => pick(AMPM_DIALOGUE.weaponsTalk);
export const ampmAfterPurchase = (nightMode: boolean) =>
    nightMode ? pick(AMPM_DIALOGUE.telAvivNightMode) : pick(AMPM_DIALOGUE.afterPurchase);
export const ampmRandomEvent = () => pick(AMPM_DIALOGUE.randomEvents);
