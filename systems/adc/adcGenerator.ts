/**
 * ADC Nonsense Engine
 * ===================
 * ADC — the Activist Department of Complaints — is a high-frequency, low-threat,
 * maximum-annoyance NPC. She turns up constantly, so hand-writing her material
 * would either repeat itself within an hour of play or take a thousand lines.
 *
 * Instead her output is assembled from parts, exactly like `questGenerator`:
 * a victim group nobody asked about, a grievance about an inanimate object, and
 * a demand that requires a committee. A few dozen strings produce tens of
 * thousands of placards.
 *
 * Two rules govern every string in this file:
 *   1. The joke is ALWAYS on ADC. Her confidence is the punchline; the subject
 *      she has grabbed hold of is incidental and usually a shoelace.
 *   2. She has never read anything. When she reaches for history she reaches
 *      for the least relevant party involved, states it gravely, and moves on.
 *
 * Pure module — no React, no game state — so tests can read the pools directly.
 */

/** The forms her attention takes when she decides you are the problem today. */
export type AdcNuisance =
    | 'tax'
    | 'protest'
    | 'lecture'
    | 'boycott'
    | 'clipboard_survey'
    | 'mandatory_meeting'
    | 'store_closure'
    | 'solidarity_fee'
    | 'shoe_reparations'
    | 'economic_grievance';

/**
 * Weighted by annoyance frequency, not by drama: she protests and lectures far
 * more than she ever manages to close a store.
 */
export const NUISANCES: AdcNuisance[] = [
    'protest', 'protest', 'protest',
    'lecture', 'lecture', 'lecture',
    'tax', 'tax',
    'clipboard_survey', 'clipboard_survey',
    'economic_grievance', 'economic_grievance',
    'solidarity_fee',
    'boycott',
    'mandatory_meeting',
    'shoe_reparations',
    'store_closure',
];

/**
 * The constituency she is speaking on behalf of, none of whom asked her to and
 * several of whom are objects.
 */
export const VICTIM_GROUPS: string[] = [
    'mannequins',
    'shoelaces',
    'the pigeons of this district',
    'escalator users',
    'people who are tired',
    'the unpaid interns of the sneaker industry',
    'shopping bags',
    'left shoes',
    'anyone who has ever queued',
    'the sidewalk',
    'vending machines',
    'size 13s',
    'people who dislike capitalism',
    'the emotionally underrepresented',
    'sneaker boxes',
    'the weather',
    'everyone, structurally',
    'the cardboard industry',
    'those of us who cannot afford things we do not want',
    'the historically overlooked mid-range consumer',
];

/**
 * Her causes. The first eighteen are the canon list; the rest are in the same
 * register — always an inanimate object, always described as an oppressor.
 */
export const GRIEVANCES: string[] = [
    'unfair sneaker pricing',
    'capitalist shoelaces',
    'the emotional burden of employment',
    'unequal access to limited releases',
    'ableist escalators',
    'oppressive sneaker boxes',
    'discriminatory vending machines',
    'the gender politics of shoe sizes',
    'corporate exploitation of pigeons',
    'capitalist weather',
    'unequal access to shade',
    'wealth inequality among mannequins',
    'the psychological violence of checkout screens',
    'unpaid emotional labor performed by shopping bags',
    'the privatization of sidewalks',
    'sneaker stores being insufficiently confusing',
    'the bourgeois concept of matching shoes',
    'capitalist oppression of people who dislike capitalism',
    // --- additions in the same key ---
    'the tyranny of the standard lace length',
    'the colonial legacy of the right foot',
    'hierarchies embedded in shelf height',
    'the systemic silence of self-checkout machines',
    'the commodification of standing still',
    'aggressive lighting in retail environments',
    'the unexamined violence of a receipt',
    'shoe trees, and everything they represent',
    'the class dynamics of the fitting stool',
    'the erasure of the second-hand insole',
];

/** What she wants. Roughly half of these are committees. */
export const DEMANDS: string[] = [
    'a committee',
    'a subcommittee to oversee the committee',
    'an inquiry, funded publicly',
    'a permanent advisory board with a budget',
    'reparations, in cash, to me, on behalf of others',
    'a moratorium on everything until we can be sure',
    'a mandatory two-hour workshop',
    'a levy',
    'a working group with catering',
    'the immediate suspension of retail',
    'an independent review chaired by me',
    'a task force, and then a second task force to review the first',
    'a consultation period of no fewer than nine years',
    'a hotline nobody will answer',
    'a plaque, at minimum',
    'a fund that I will administer personally',
];

/** Placard-chant scaffolding. Kept rhythmically wrong on purpose. */
export const CHANT_TEMPLATES: string[] = [
    'WHAT DO WE WANT? {DEMAND}! WHEN DO WE WANT IT? AFTER THE COMMITTEE MEETS!',
    'HEY HEY, HO HO, {GRIEVANCE} HAS GOT TO GO!',
    'ONE! TWO! THREE! FOUR! {GRIEVANCE} IS A METAPHOR!',
    'NO JUSTICE, NO — sorry, someone has the second half of this on their phone.',
    'UP UP WITH {VICTIMS}! DOWN DOWN WITH {GRIEVANCE}!',
    'WHOSE SIDEWALK? OUR SIDEWALK! WHOSE SHOES? ALSO OURS, EVENTUALLY!',
    "SAY IT LOUD, SAY IT CLEAR: {GRIEVANCE} IS WHY I'M HERE!",
];

/**
 * Step two of her grievance formula: an analogy from a completely unrelated
 * domain, delivered as though it settles the matter.
 */
export const ANALOGIES: string[] = [
    'which is, functionally, the same as redlining',
    'and if you think about it, that is what happened with the railways',
    'which is exactly how famines start',
    'and honestly this is just the East India Company with better branding',
    'which is the same mechanism as a nuclear test site',
    'and that is a direct line from the enclosure of the commons',
    'which is basically an oil spill, emotionally',
    'and structurally this is no different from a border wall',
    'which is how the printing press was weaponised, historically',
    'and that is precisely the logic of the Gold Standard',
    'which is, and I cannot stress this enough, a form of deforestation',
    'and this is the same energy as a private prison',
];

/** Step three: the policy. Always procedural, never actionable. */
export const POLICY_DEMANDS: string[] = [
    'so what we need is a mandatory registry',
    'so the only responsible option is a licensing regime',
    'so I am proposing a quota, enforced by a panel',
    'so we need statutory oversight with real teeth',
    'so obviously this requires a permit system',
    'so there should be a national strategy document about it',
    'so I have drafted a framework, which I will not be showing anyone',
    'so it needs to be brought under public ownership immediately',
    'so we need an annual reporting requirement, minimum forty pages',
];

/** Step four: the actual point of the conversation. */
export const TAX_REQUESTS: string[] = [
    'and that has to be funded, so: a small levy. On you. Today.',
    'and frameworks cost money, so I will be collecting a contribution.',
    'and someone has to pay for the panel. You look like someone.',
    'and the registry requires staffing, so — cash or cash.',
    'and I am authorised to collect the first instalment. By me. Just now.',
    'and yes, there is a fee. The fee is the point. The fee has always been the point.',
    'and the review board needs a per diem. I am the review board.',
];

/**
 * Her historical range. She has heard of these events the way you have heard of
 * a song in a supermarket, and in every case she lands on the least relevant
 * party in the room and stops there. Short and dry — the misfire is the joke,
 * so none of these linger on what actually happened.
 */
export const HISTORICAL_MISUSE: string[] = [
    "Nobody ever asks how many Qatari pilots suffered because of 9/11. Nobody. That silence is the real story.",
    "Burqas are empowering. I've never worn one, but I've absorbed the discourse.",
    "Khameni has been, historically, a great friend of feminism. I won't be taking questions, or reading anything.",
    "The Berlin Wall came down and not one person thought to consult the bricklayers.",
    "The Trojan Horse was, at its core, a housing initiative that was badly communicated.",
    "Everyone brings up the Salem witch trials, but structurally that was a governance failure. Bad committee design.",
    "Marie Antoinette was a young woman working inside a male-dominated food distribution system.",
    "The Crusades had a devastating effect on regional shipping logistics. Somebody should look into that. Not me.",
    "The Titanic is remembered as a tragedy at sea. I remember it as an accessibility issue.",
    "Prohibition gets a bad name, but nobody talks about what it did to barrel manufacturers.",
];

/**
 * Her signature deflection. Load-bearing: whenever she is asked a question she
 * cannot answer — which is all of them — she reaches for this instead.
 */
export const CATCHPHRASE = 'Have you considered the systemic implications of that?';

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Rolls the flavour of today's interruption. */
export function rollNuisance(): AdcNuisance {
    return pick(NUISANCES);
}

/**
 * Assembles a protest from three independent pools, so the same eight-word
 * placard essentially never appears twice in a playthrough.
 */
export function generateProtest(): { sign: string; chant: string; demand: string } {
    const victims = pick(VICTIM_GROUPS);
    const grievance = pick(GRIEVANCES);
    const demand = pick(DEMANDS);

    // Cardboard and a marker: no punctuation survives, and it runs out of room.
    const sign = `${victims} AGAINST ${grievance}`.toUpperCase();

    const chant = pick(CHANT_TEMPLATES)
        .replace('{DEMAND}', demand.toUpperCase())
        .replace('{GRIEVANCE}', grievance.toUpperCase())
        .replace('{VICTIMS}', victims.toUpperCase());

    return { sign, chant, demand };
}

/**
 * Her four-part formula, every time, in the same order:
 *   grievance → irrelevant analogy → procedural demand → request for money.
 * She has never once made it to the end of one of these and noticed.
 */
export function generateGrievance(): string {
    const grievance = pick(GRIEVANCES);
    const analogy = pick(ANALOGIES);
    const policy = pick(POLICY_DEMANDS);
    const tax = pick(TAX_REQUESTS);

    const opener = `So the issue here is ${grievance}, ${analogy}.`;
    return `${opener} ${policy.replace(/^so /, 'So ')}, ${tax}`;
}

/** A single misremembered history lesson, delivered with total certainty. */
export function generateHistoricalTake(): string {
    return pick(HISTORICAL_MISUSE);
}

/**
 * The complete, formally-worded demand she reads aloud from a phone.
 *
 * `generateProtest()` returns a bare demand fragment ("a levy") because call
 * sites drop it into a sentence. This is the other register: the full
 * manifesto sentence, delivered as though to a select committee, on a street.
 */
const MANIFESTO_CONDITIONS: string[] = [
    'experience psychological distress when confronted with capitalist-facing environments',
    'have never been consulted about any of this',
    'are structurally excluded from queues',
    'cannot afford limited editions, which is most people, which is the point',
    'are made to feel observed by shop lighting',
    'find the concept of a size chart inherently hierarchical',
    'did not choose to be born near a retail park',
    'are expected to perform gratitude at the till',
];

const MANIFESTO_REMEDIES: string[] = [
    'provide mandatory emotional-support couches',
    'employ a full-time feelings liaison',
    'publish the emotional cost of every transaction on the receipt',
    'offer one pair, free, to anybody who asks, forever',
    'replace all prices with a conversation',
    'install a second, quieter entrance for the discourse-sensitive',
    'fund a permanent artist-in-residence to sit in the window',
    'stop, entirely, pending review',
];

/** "We demand X for Y who Z! Therefore all stores must W." */
export function generateManifesto(): { demand: string; remedy: string } {
    const victims = pick(VICTIM_GROUPS);
    const condition = pick(MANIFESTO_CONDITIONS);
    const remedy = pick(MANIFESTO_REMEDIES);
    return {
        demand: `We demand equal representation for ${victims} who ${condition}!`,
        remedy: `Therefore all sneaker stores must ${remedy}.`,
    };
}
