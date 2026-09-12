import React, { useState } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { useGame } from '../../hooks/useGame';
import { SNEAKERS } from '../../data/sneakers';
import { MAX_INVENTORY_SIZE } from '../../constants';
import type { ScenarioOutcome } from '../../types/interactions';

interface Tier {
    id: string;
    label: string;
    price: number;
    blurb: string;
    /** Weighted loot table. */
    table: { weight: number; build: () => { text: string; icon: string; outcomes: ScenarioOutcome[]; good: boolean } }[];
}

const r = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const legendary = () => SNEAKERS.filter(s => s.rarity === 'Legendary');
const rare = () => SNEAKERS.filter(s => s.rarity === 'Rare');
const common = () => SNEAKERS.filter(s => s.rarity === 'Common' || s.rarity === 'Uncommon');
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const junk = (text: string) => ({
    text, icon: '🗑️', good: false,
    outcomes: [{ type: 'notification', message: text, description: text } as ScenarioOutcome],
});

const cash = (min: number, max: number) => {
    const amount = r(min, max);
    return {
        text: `A rubber-banded roll of cash. $${amount}.`,
        icon: '💵',
        good: true,
        outcomes: [{ type: 'inventoryChange', add: [{ kind: 'currency', value: 'cash', qty: amount }], description: `Found $${amount}.` }] as ScenarioOutcome[],
    };
};

const shoe = (pool: () => typeof SNEAKERS, note: string, fake = false) => {
    const s = pick(pool());
    return {
        text: `${note} — ${s.name}${fake ? ' (…the logo is upside down)' : ''}.`,
        icon: fake ? '⚠️' : '👟',
        good: !fake,
        outcomes: [{
            type: 'inventoryChange',
            add: [{ kind: 'item', value: s.id, qty: 1 }],
            description: `A pair of ${s.name} was inside.`,
        }] as ScenarioOutcome[],
    };
};

const TIERS: Tier[] = [
    {
        id: 'cheap', label: 'The $50 Box', price: 50,
        blurb: '"Is very good. Probably."',
        table: [
            { weight: 34, build: () => junk('Three odd socks and a laminated photo of a stranger.') },
            { weight: 20, build: () => junk('A half-eaten bureka. Still warm. Deeply concerning.') },
            { weight: 20, build: () => cash(20, 90) },
            { weight: 16, build: () => shoe(common, 'A genuinely fine pair') },
            { weight: 8,  build: () => shoe(rare, 'Somehow, actual heat') },
            { weight: 2,  build: () => shoe(legendary, 'You open it slowly. It is real') },
        ],
    },
    {
        id: 'mid', label: 'The $250 Box', price: 250,
        blurb: '"This one is heavier. That is good, I think."',
        table: [
            { weight: 24, build: () => junk('A brick. Wrapped in tissue paper. Lovingly.') },
            { weight: 22, build: () => cash(90, 380) },
            { weight: 24, build: () => shoe(common, 'Clean, boxed, unremarkable') },
            { weight: 20, build: () => shoe(rare, 'Deadstock, tags on') },
            { weight: 10, build: () => shoe(legendary, 'Your hands start shaking') },
        ],
    },
    {
        id: 'grail', label: 'The $1,000 Box', price: 1000,
        blurb: '"For this price I look you in the eye. See? Trust."',
        table: [
            { weight: 16, build: () => junk('An empty box. A note inside reads: "thank you for your business".') },
            { weight: 18, build: () => cash(300, 1400) },
            { weight: 24, build: () => shoe(rare, 'Immaculate') },
            { weight: 30, build: () => shoe(legendary, 'A grail. An actual grail') },
            { weight: 12, build: () => ({
                ...shoe(legendary, 'Two boxes stacked inside'),
                text: 'Two boxes stacked inside. Both grails. He has already left.',
                icon: '🌟',
            }) },
        ],
    },
];

/**
 * Back-Alley Mystery Box. The player picks a risk tier and sees the odds
 * implicitly through the price — never the contents.
 */
const MysteryBox: React.FC<{
    onFinish: (won: boolean, note: string, outcomes: ScenarioOutcome[]) => void;
    onQuit: () => void;
}> = ({ onFinish, onQuit }) => {
    const { gameState } = useGame();
    const { player } = gameState;
    const [opening, setOpening] = useState(false);
    const [result, setResult] = useState<null | { text: string; icon: string; good: boolean; outcomes: ScenarioOutcome[]; tier: Tier }>(null);

    const buy = (tier: Tier) => {
        if (player.cash < tier.price || opening) return;
        setOpening(true);

        const total = tier.table.reduce((s, e) => s + e.weight, 0);
        let point = Math.random() * total;
        let chosen = tier.table[0];
        for (const entry of tier.table) {
            if (point < entry.weight) { chosen = entry; break; }
            point -= entry.weight;
        }
        const loot = chosen.build();

        setTimeout(() => {
            setOpening(false);
            setResult({ ...loot, tier });
        }, 1200);
    };

    if (result) {
        const outcomes: ScenarioOutcome[] = [
            { type: 'inventoryChange', remove: [{ kind: 'currency', value: 'cash', qty: result.tier.price }], description: `Paid $${result.tier.price} for the box.` },
            ...result.outcomes,
        ];
        return (
            <MiniGameShell title="Back-Alley Mystery Box" subtitle="Opened">
                <div className="text-center py-6 animate-rise">
                    <div className="text-6xl mb-4">{result.icon}</div>
                    <p className="text-lg text-white mb-6 max-w-sm mx-auto leading-snug">{result.text}</p>
                    <button
                        className={`btn ${result.good ? 'btn-primary' : 'btn-danger'} px-8`}
                        onClick={() => onFinish(result.good, result.good ? 'The box paid off.' : 'The box did not pay off.', outcomes)}
                    >
                        {result.good ? 'Take It' : 'Accept Your Fate'}
                    </button>
                </div>
            </MiniGameShell>
        );
    }

    return (
        <MiniGameShell title="Back-Alley Mystery Box" subtitle="You want mystery box?" onQuit={onQuit} quitLabel="Walk Away">
            {opening ? (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4 animate-pulse">📦</div>
                    <p className="label">Prying it open…</p>
                </div>
            ) : (
                <>
                    <p className="text-[var(--ink-dim)] text-sm mb-4 italic">
                        A folding table. A man. Three boxes. He does not blink at any point during this transaction.
                    </p>
                    {player.inventory.length >= MAX_INVENTORY_SIZE && (
                        <p className="chip chip-warn mb-3">Bag is full — a shoe prize would be left behind.</p>
                    )}
                    <div className="space-y-2">
                        {TIERS.map(tier => {
                            const afford = player.cash >= tier.price;
                            return (
                                <button
                                    key={tier.id}
                                    disabled={!afford}
                                    onClick={() => buy(tier)}
                                    className="w-full panel-raised p-4 text-left hover:border-[var(--accent)] transition-colors disabled:opacity-40 disabled:hover:border-[var(--line)]"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-display text-sm uppercase text-white">{tier.label}</div>
                                            <div className="text-xs text-[var(--ink-dim)] italic mt-0.5 truncate">{tier.blurb}</div>
                                        </div>
                                        <div className="numeric text-lg text-[var(--ok)] flex-shrink-0">${tier.price}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </MiniGameShell>
    );
};

export default MysteryBox;
