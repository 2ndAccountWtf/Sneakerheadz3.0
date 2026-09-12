import React, { useState, useMemo } from 'react';
import { MiniGameShell, MiniGameResult } from './MiniGameShell';

interface Tell {
    text: string;
    /** True if this detail indicates a fake. */
    damning: boolean;
}

const FAKE_TELLS: Tell[] = [
    { text: 'The stitching on the left swoosh wanders by about 2mm.', damning: true },
    { text: 'Size tag font is slightly too round on the 8 and the 5.', damning: true },
    { text: 'Glue residue along the midsole seam, yellowed.', damning: true },
    { text: 'The box label SKU does not match the tongue tag.', damning: true },
    { text: 'Smells like industrial solvent, not shoe.', damning: true },
    { text: 'Insole logo is heat-pressed, not printed.', damning: true },
    { text: 'The toe box crease is already set, on a "deadstock" pair.', damning: true },
];

const REAL_TELLS: Tell[] = [
    { text: 'Stitch density is even all the way around the collar.', damning: false },
    { text: 'Box label, tongue tag and size tag all agree.', damning: false },
    { text: 'Suede nap runs consistently in one direction.', damning: false },
    { text: 'The date code is plausible for this colourway.', damning: false },
    { text: 'Carbon fibre plate flexes with the right stiffness.', damning: false },
    { text: 'UV check comes back clean under the light.', damning: false },
    { text: 'Weight is within 8g of the reference pair.', damning: false },
];

const shuffle = <T,>(a: T[]) => [...a].sort(() => 0.5 - Math.random());

/**
 * Legit Check — a skill test rather than a dice roll. Four tells are laid out;
 * you decide whether the pair is real. The mix is what tells you: any genuine
 * defect means fake, but a plausible-sounding detail proves nothing.
 */
const LegitCheck: React.FC<{
    sneakerName?: string;
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ sneakerName = 'the pair', onFinish, onQuit }) => {
    const [isFake] = useState(() => Math.random() < 0.5);
    const [verdict, setVerdict] = useState<null | boolean>(null);

    const tells = useMemo(() => {
        if (isFake) {
            // One to three real problems hidden among clean details.
            const bad = shuffle(FAKE_TELLS).slice(0, 1 + Math.floor(Math.random() * 2));
            const good = shuffle(REAL_TELLS).slice(0, 4 - bad.length);
            return shuffle([...bad, ...good]);
        }
        return shuffle(REAL_TELLS).slice(0, 4);
    }, [isFake]);

    if (verdict !== null) {
        const correct = verdict === isFake;
        return (
            <MiniGameShell title="Legit Check" subtitle="Verdict">
                <MiniGameResult
                    won={correct}
                    headline={correct ? 'Good Eye' : 'You Called It Wrong'}
                    detail={
                        correct
                            ? isFake
                                ? 'They were fake. You spotted it before money changed hands.'
                                : 'They were genuine, and you knew it. The seller respects that.'
                            : isFake
                                ? 'They were fake. You vouched for them out loud. That follows you around.'
                                : 'They were real, and you called the seller a liar in front of people.'
                    }
                    onClose={() => onFinish(correct, correct ? 'Your call was right.' : 'Your call was wrong.')}
                />
            </MiniGameShell>
        );
    }

    return (
        <MiniGameShell title="Legit Check" subtitle={`Authenticating ${sneakerName}`} onQuit={onQuit} quitLabel="Decline Job">
            <p className="text-[var(--ink-dim)] text-sm mb-4">
                Four things stand out under the lamp. One genuine defect is enough — but a detail that merely
                sounds technical proves nothing either way.
            </p>

            <div className="space-y-2 mb-5">
                {tells.map((t, i) => (
                    <div key={i} className="panel-raised p-3 flex items-start gap-3">
                        <span className="label flex-shrink-0 pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-sm text-[var(--ink)]">{t.text}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-primary" onClick={() => setVerdict(false)}>✓ Authentic</button>
                <button className="btn btn-danger" onClick={() => setVerdict(true)}>✗ Replica</button>
            </div>
        </MiniGameShell>
    );
};

export default LegitCheck;
