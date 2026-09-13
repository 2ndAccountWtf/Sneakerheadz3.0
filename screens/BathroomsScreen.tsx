import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { bathroomsIn } from '../data/bathrooms';
import { CITIES } from '../data/cities';

const DIGNITY_LABEL = ['', 'Grim', 'Basic', 'Acceptable', 'Good', 'Immaculate'];

/**
 * The facilities directory.
 *
 * Cheap and close means unreliable; clean and certain means far away or paid
 * for. That trade-off under a running clock is the entire strategic layer, so
 * every number the player needs to make the call is shown up front.
 */
const BathroomsScreen: React.FC = () => {
    const { gameState, useBathroom } = useGame();
    const { currentCityId, player, outcomeLog } = gameState;

    const options = bathroomsIn(currentCityId);
    const cityName = CITIES.find(c => c.id === currentCityId)?.name ?? 'here';
    const urgent = !!player.emergency;

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Facilities in <span className="accent">{cityName}</span></>}
                subtitle={urgent ? 'Choose quickly. The cheap ones are cheap for a reason.' : 'Noted for future reference.'}
                back={Screen.Dashboard}
            />

            {!urgent && (
                <div className="panel p-4 mb-4 flex items-start gap-3">
                    <span className="text-xl">🚽</span>
                    <p className="text-sm text-[var(--ink-dim)]">
                        Nothing is wrong right now. Worth knowing where these are before something is.
                    </p>
                </div>
            )}

            {outcomeLog.length > 0 && (
                <div className="panel mb-4 divide-y divide-[var(--line)]">
                    {outcomeLog.map((e, i) => (
                        <div
                            key={i}
                            className="flex items-start gap-2.5 px-3 py-2 text-xs font-mono"
                            style={{ color: e.tone === 'good' ? 'var(--ok)' : e.tone === 'bad' ? 'var(--bad)' : 'var(--ink-dim)' }}
                        >
                            <span>{e.icon}</span><span className="flex-1">{e.text}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {options.map(b => {
                    const afford = player.cash >= b.price;
                    const risk = Math.round(b.unreliability * 100);
                    return (
                        <div key={b.id} className="panel p-4 flex flex-col">
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <h3 className="font-display text-sm uppercase text-white leading-tight">{b.name}</h3>
                                <span className="numeric text-sm flex-shrink-0" style={{ color: b.price ? 'var(--warn)' : 'var(--ok)' }}>
                                    {b.price ? `${b.price}` : 'Free'}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--ink-dim)] leading-snug mb-3">{b.blurb}</p>

                            <div className="flex flex-wrap gap-1.5 mb-3">
                                <span className="chip">🚶 {b.travelSeconds}s away</span>
                                <span className={`chip ${risk > 30 ? 'chip-bad' : risk > 15 ? 'chip-warn' : 'chip-accent'}`}>
                                    {risk}% out of order
                                </span>
                                <span className="chip">{DIGNITY_LABEL[b.dignity]}</span>
                            </div>

                            <button
                                className="btn btn-primary w-full mt-auto"
                                disabled={!urgent || !afford}
                                onClick={() => useBathroom(b.id)}
                            >
                                {!afford ? "Can't afford it" : urgent ? 'Go' : 'Not right now'}
                            </button>
                        </div>
                    );
                })}
            </div>

            <p className="label text-center mt-5">
                A failed attempt still costs you the walk. Choose once, choose well.
            </p>
        </div>
    );
};

export default BathroomsScreen;
