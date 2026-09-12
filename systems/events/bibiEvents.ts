/**
 * Bibi gift scenes and the ultra-rare Bibi + Donald Drip collab.
 *
 * These are the cinematic, once-in-a-while events: the screen dims, a portrait
 * slides in, lines land one at a time, and the payoff panel lists exactly what
 * just happened to your bag. Gifts require real standing with him
 * (approval >= 70); the collab does not care how he feels about you, only
 * which way it decides to go.
 */
import type { Player, Cutscene } from '../../types';
import type { ScenarioOutcome } from '../../types/interactions';

export interface BibiEventRoll {
    cutscene: Cutscene;
    outcomes: ScenarioOutcome[];
}

const BIBI_PORTRAIT = 'https://picsum.photos/seed/bibi/400';
const DRIP_PORTRAIT = 'https://picsum.photos/seed/donalddrip/400';

/** Approval floor for any gift scene to fire. */
export const GIFT_APPROVAL_THRESHOLD = 70;
/** Days that must pass between gift scenes — roughly 1-3 per in-game year. */
const GIFT_COOLDOWN_DAYS = 6;
const GIFT_CHANCE = 0.16;
/** The collab fires at most once per save, or on a sub-1% roll every 60 days. */
const COLLAB_CHANCE = 0.008;
const COLLAB_EARLIEST_DAY = 8;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const round = (n: number) => Math.round(n);

type GiftBuilder = () => BibiEventRoll;

const GIFT_SCENES: GiftBuilder[] = [
    // 1 — The Blessing of Stability
    () => {
        const volatilityCut = rand(0.10, 0.25);
        const resale = rand(1.12, 1.22);
        const jump = rand(1.5, 3);
        return {
            cutscene: {
                id: 'bibi-gift-stability',
                kind: 'bibi-gift',
                title: 'The Blessing of Stability',
                subtitle: 'A silver-plated Menorah-shaped sneaker charm',
                portraitUrl: BIBI_PORTRAIT,
                lines: [
                    { speaker: 'Bibi Neta', text: 'I have watched your progress. Your discipline. Your resilience.' },
                    { speaker: 'Bibi Neta', text: 'Take this. It will steady your path, even when the markets tremble.' },
                    { text: 'He presses a small, heavy charm into your palm. It is warm.' },
                ],
                effects: [],
            },
            outcomes: [
                { type: 'statusEffect', effect: 'calm-markets', duration: '24h', label: `Steadied Markets (-${round(volatilityCut * 100)}% swing)`, description: 'Volatility reduced.' },
                { type: 'priceMarkup', multiplier: resale, duration: '24h', description: `Resale prices +${round((resale - 1) * 100)}%.` },
                { type: 'statusEffect', effect: 'protection', duration: '24h', label: 'Steady Path (safer travel)', description: 'Travel danger reduced.' },
                { type: 'inventoryMultiplier', min: jump, max: jump, description: 'A pair in your bag appreciates sharply.' },
            ],
        };
    },

    // 2 — The Shield of Prosperity
    () => {
        const cred = round(rand(10, 18));
        return {
            cutscene: {
                id: 'bibi-gift-shield',
                kind: 'bibi-gift',
                title: 'The Shield of Prosperity',
                subtitle: 'A ballistic briefcase, signed by Mossad interns',
                portraitUrl: BIBI_PORTRAIT,
                lines: [
                    { speaker: 'Bibi Neta', text: 'Prosperity must be protected.' },
                    { speaker: 'Bibi Neta', text: 'Carry this with honor.' },
                    { text: 'The signatures are in glitter pen. You decide not to mention it.' },
                ],
                effects: [],
            },
            outcomes: [
                { type: 'statusEffect', effect: 'protection', duration: '72h', label: 'Ballistic Briefcase (blocks 1 robbery)', description: 'Absorbs the next robbery.' },
                { type: 'flag', key: 'robbery-shield', value: 1, description: 'The briefcase will eat one robbery for you.' },
                { type: 'statusEffect', effect: 'lucky', duration: '48h', label: 'Escorted (next 3 travel events skew positive)', description: 'Travel outcomes skew good.' },
                { type: 'streetCred', change: cred, description: `+${cred} Street Cred` },
            ],
        };
    },

    // 3 — The Prime Ministerial Tip
    () => ({
        cutscene: {
            id: 'bibi-gift-tip',
            kind: 'bibi-gift',
            title: 'The Prime Ministerial Tip',
            subtitle: 'Delivered like nuclear intelligence',
            portraitUrl: BIBI_PORTRAIT,
            lines: [
                { speaker: 'Bibi Neta', text: 'Listen carefully. Information is more powerful than force.' },
                { text: 'He leans in and whispers a model name, a date, and a number.' },
                { speaker: 'Bibi Neta', text: 'You did not hear it from me. You did not hear it at all.' },
            ],
            effects: [],
        },
        outcomes: [
            { type: 'marketSignal', effect: 'surge', magnitude: rand(1.8, 3.0), target: { kind: 'model', value: 'random' }, duration: '36h', description: 'A hidden surge, revealed early.' },
            { type: 'statusEffect', effect: 'guidance', duration: '48h', label: 'Classified Intel (market insight)', description: 'You can see what is coming.' },
            { type: 'inventoryChange', add: [{ kind: 'item', value: 'random-rare', qty: 1 }], description: 'A secret stash pair changes hands.' },
        ],
    }),

    // 4 — The Eternal Drip
    () => ({
        cutscene: {
            id: 'bibi-gift-eternal',
            kind: 'bibi-gift',
            title: 'The Eternal Drip',
            subtitle: 'Kevlar. Jerusalem stone dust. Tears of Mossad cadets.',
            portraitUrl: BIBI_PORTRAIT,
            lines: [
                { speaker: 'Bibi Neta', text: 'This pair is not for the weak.' },
                { speaker: 'Bibi Neta', text: 'Wear them only when destiny calls.' },
                { text: 'The box weighs more than it should. Something inside it hums.' },
            ],
            effects: [],
        },
        outcomes: [
            { type: 'inventoryMultiplier', min: 1.2, max: 2.5, description: "Bibi's Blessing settles over your whole bag." },
            { type: 'statusEffect', effect: 'blessed', duration: '48h', label: "Bibi's Blessing (+25% luck)", description: 'Sneaker luck up sharply.' },
            { type: 'flag', key: 'bibi-quests-unlocked', value: true, description: 'Exclusive Bibi business is now open to you.' },
            { type: 'bibiApproval', change: 5, description: 'He considers you one of his own.' },
        ],
    }),

    // 5 — The Iron Wallet
    () => {
        const windfall = round(rand(1800, 5000));
        return {
            cutscene: {
                id: 'bibi-gift-wallet',
                kind: 'bibi-gift',
                title: 'The Iron Wallet',
                subtitle: 'Reinforced titanium, shaped like the Knesset dome',
                portraitUrl: BIBI_PORTRAIT,
                lines: [
                    { speaker: 'Bibi Neta', text: 'In this life, strength is measured not only by courage…' },
                    { speaker: 'Bibi Neta', text: '…but by liquidity.' },
                    { text: 'It does not fit in any pocket you own. It is already full.' },
                ],
                effects: [],
            },
            outcomes: [
                { type: 'inventoryChange', add: [{ kind: 'currency', value: 'cash', qty: windfall }], description: 'The wallet is not empty.' },
                { type: 'priceMarkup', multiplier: 1.2, duration: '24h', description: 'Everything you sell today pays more.' },
                { type: 'stat_change', payload: { stat: 'health', value: 25 }, description: 'One negative status shaken off.' },
                { type: 'heat', change: -20, description: 'Certain files are quietly closed.' },
            ],
        };
    },
];

function buildCollab(player: Player): BibiEventRoll {
    const favored = player.bibiApproval >= 60;

    if (favored) {
        const surge = rand(1.35, 1.9);
        const cred = round(rand(40, 70));
        return {
            cutscene: {
                id: 'collab-united-chaos-blessing',
                kind: 'collab',
                title: 'UNITED CHAOS COLLAB',
                subtitle: 'An eagle shrieks. Sirens. Gold confetti.',
                portraitUrl: DRIP_PORTRAIT,
                lines: [
                    { speaker: 'Donald Drip', text: 'Folks… this is HUGE. ME and BIBI — the greatest collab in the history of markets.' },
                    { speaker: 'Bibi Neta', text: 'Together, we bring order and opportunity.' },
                    { speaker: 'Donald Drip', text: "You're loyal. You're smart. You're a WINNER. Watch this!" },
                    { speaker: 'Bibi Neta', text: 'Multiplying assets… stand back.' },
                ],
                effects: [],
            },
            outcomes: [
                { type: 'inventoryMultiplier', min: 5, max: 10, description: 'EVERY item in your bag goes supernova.' },
                { type: 'marketSignal', effect: 'surge', magnitude: surge, target: { kind: 'model', value: 'global' }, duration: '48h', description: 'Global market surge.' },
                { type: 'inventoryChange', add: [{ kind: 'item', value: 'random-legendary', qty: 1 }], description: 'A legendary pair materialises in storage.' },
                { type: 'streetCred', change: cred, description: `+${cred} Street Cred` },
                { type: 'statusEffect', effect: 'protection', duration: '48h', label: 'Two-Nation Escort (no travel danger)', description: 'Travel danger gone.' },
                { type: 'flag', key: 'badge-trusted-by-two-nations', value: true, description: 'Unlocked: "Trusted by Two Nations" badge.' },
                { type: 'bibiApproval', change: 10, description: 'You are now permanently on the good list.' },
            ],
        };
    }

    const cashLoss = rand(0.3, 0.7);
    const crash = rand(0.40, 0.75);
    return {
        cutscene: {
            id: 'collab-united-chaos-smackdown',
            kind: 'disaster',
            title: 'UNITED CHAOS COLLAB',
            subtitle: 'The confetti is not for you.',
            portraitUrl: DRIP_PORTRAIT,
            lines: [
                { speaker: 'Donald Drip', text: 'Folks… this is HUGE. ME and BIBI — the greatest collab in the history of markets.' },
                { speaker: 'Bibi Neta', text: 'Together, we bring order and opportunity.' },
                { speaker: 'Donald Drip', text: 'Loser energy. BAD energy. Very sad.' },
                { speaker: 'Bibi Neta', text: 'You cannot stand against order and expect prosperity.' },
                { speaker: 'Donald Drip', text: "That's what happens when you disrespect the kings of drip!" },
            ],
            effects: [],
        },
        outcomes: [
            { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: 0 }], description: 'placeholder' },
            { type: 'marketSignal', effect: 'collapse', magnitude: crash, target: { kind: 'model', value: 'global' }, duration: '48h', description: 'The shoe market craters.' },
            { type: 'inventoryChange', remove: [{ kind: 'item', value: 'random-sneaker', qty: 1 }], description: 'Something in your bag breaks, or simply is not there anymore.' },
            { type: 'streetCred', change: -20, description: '-20 Street Cred' },
            { type: 'statusEffect', effect: 'hunted', duration: '48h', label: 'Marked (travel is dangerous)', description: 'Travel events spawn more danger.' },
            { type: 'priceMarkup', multiplier: 1.0, duration: '24h', description: 'Stores mark you up on sight.' },
        ],
        // NOTE: the cash hit is injected below, since it depends on the player.
    };
}

/**
 * Rolled once per travel. Returns null on the overwhelming majority of trips.
 */
export function rollBibiEvent(player: Player, day: number): BibiEventRoll | null {
    // --- Ultra-rare collab ---
    const collabFired = player.flags['collab-fired'] === true;
    if (!collabFired && day >= COLLAB_EARLIEST_DAY && Math.random() < COLLAB_CHANCE) {
        const roll = buildCollab(player);
        const outcomes = [...roll.outcomes];

        if (roll.cutscene.kind === 'disaster') {
            // Replace the placeholder with a real, proportional cash hit.
            const pct = 0.3 + Math.random() * 0.4;
            const loss = Math.round(player.cash * pct);
            outcomes[0] = {
                type: 'inventoryChange',
                remove: [{ kind: 'currency', value: 'cash', qty: loss }],
                description: `Your accounts are drained by ${Math.round(pct * 100)}%.`,
            };
        }

        outcomes.push({ type: 'flag', key: 'collab-fired', value: true, description: 'It only happens once.' });
        return { ...roll, outcomes };
    }

    // --- Gift scenes ---
    if (player.bibiApproval < GIFT_APPROVAL_THRESHOLD) return null;

    const lastGiftDay = Number(player.flags['last-bibi-gift-day'] ?? -99);
    if (day - lastGiftDay < GIFT_COOLDOWN_DAYS) return null;
    if (Math.random() > GIFT_CHANCE) return null;

    // Don't repeat the most recent gift back-to-back.
    const lastGiftId = String(player.flags['last-bibi-gift-id'] ?? '');
    let candidates = GIFT_SCENES.map((b, i) => ({ b, i }));
    const built = candidates.map(c => ({ ...c, roll: c.b() }));
    const fresh = built.filter(c => c.roll.cutscene.id !== lastGiftId);
    const chosen = (fresh.length ? fresh : built)[Math.floor(Math.random() * (fresh.length || built.length))];

    return {
        cutscene: chosen.roll.cutscene,
        outcomes: [
            ...chosen.roll.outcomes,
            { type: 'flag', key: 'last-bibi-gift-day', value: day, description: '' },
            { type: 'flag', key: 'last-bibi-gift-id', value: chosen.roll.cutscene.id as any, description: '' },
        ],
    };
}
