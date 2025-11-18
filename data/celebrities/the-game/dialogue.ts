import type { CelebrityDialogue } from '../../../types/npcs';

export const THE_GAME_DIALOGUE: CelebrityDialogue = {
    greeting: [
        "Yo, you seen Chico? Tell him I got a package for him.",
        "These ain't real Jordans unless they been creased on the concrete of Rosecrans.",
        "Don't stare too long, blood. This ain't a zoo.",
        "Smells like rich tourists in here. Where the real heads at?",
    ],
    onPlayerBuyRare: [
        "Aight, I see you. You got some taste. But can you protect 'em?",
        "Those are clean. For now. Keep your head on a swivel out there.",
    ],
    onPlayerSellCommon: [
        "Man, get that outta here. You tryna get laughed off the block with that?",
        "You might as well give those away for free, nephew.",
    ],
    triggerRobinHood: [
        "This whole store is for the rich! Ayo, run in, grab the most expensive joints and give 'em to the kids outside!",
        "Time to redistribute the wealth. Compton style."
    ],
    triggerLegitCheck: [
        "Hold up... these feel fake. My man on the block gotta verify these. I'm doing you a favor, this is a free legit check.",
        "Y'all pushing fugazi kicks in here? Nah, I'm confiscating these for the culture."
    ],
    triggerPriceSwap: [
        "AYO, WHO YOU CALLIN' A BUSTER?!",
        "Yo, run that beat back! Let's see who got bars in this spot right now!",
    ],
};
