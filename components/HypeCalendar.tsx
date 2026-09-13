import React from 'react';
import { CITIES } from '../data/cities';
import { activeHypeEvent, upcomingEvents } from '../systems/events/hypeCalendar';
import type { HypeEvent } from '../types/hype';

export interface HypeCalendarProps {
    /** The current run day. */
    day: number;
    /** The city the player is standing in — decides what counts as "here". */
    cityId: string;
    className?: string;
}

const cityName = (id: string): string => CITIES.find(c => c.id === id)?.name ?? id;

type Tone = 'live' | 'soon' | 'plan';

/** Where an event sits relative to today, in the exact words the panel shows. */
function statusFor(event: HypeEvent, day: number): { label: string; tone: Tone } {
    const endDay = event.startDay + event.days - 1;
    if (day >= event.startDay && day <= endDay) {
        return {
            label: event.days > 1 ? `Live now · day ${day - event.startDay + 1} of ${event.days}` : 'Live today',
            tone: 'live',
        };
    }
    const until = event.startDay - day;
    if (until <= 3) return { label: until === 1 ? 'Starts tomorrow' : `Starts in ${until} days`, tone: 'soon' };
    return { label: `Starts in ${until} days`, tone: 'plan' };
}

const TONE_COLOR: Record<Tone, string> = {
    live: 'var(--accent-2)',
    soon: 'var(--warn)',
    plan: 'var(--ink-dim)',
};

/** "+40%" or "−12%" against the normal street price. */
const pctOffOffers = (m: number): string => `${m >= 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%`;

/** Reference ceiling for the demand meter — the biggest multiplier authored, see data/hypeEvents.ts. */
const MAX_PRICE_MULTIPLIER = 1.5;

const HotTags: React.FC<{ tags: string[] }> = ({ tags }) => (
    <>
        {tags.slice(0, 4).map(t => (
            <span key={t} className="chip chip-accent">{t}</span>
        ))}
    </>
);

/**
 * The one event happening right now in the city the player is standing in.
 * Deliberately the loudest thing in the panel — this is the "buyers are
 * overpaying today, in front of you" moment, not a line item.
 */
const HereNow: React.FC<{ event: HypeEvent; day: number }> = ({ event, day }) => {
    const status = statusFor(event, day);
    const demandPct = Math.max(6, Math.min(100, ((event.priceMultiplier - 1) / (MAX_PRICE_MULTIPLIER - 1)) * 100));
    return (
        <div
            className="panel p-3 sm:p-4"
            style={{ borderColor: 'var(--accent-2)', boxShadow: '0 0 22px rgba(255,46,136,0.22)' }}
        >
            <div className="flex items-start gap-3">
                <span className="text-3xl leading-none flex-shrink-0">{event.icon}</span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="relative flex h-2 w-2 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: 'var(--accent-2)' }} />
                            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--accent-2)' }} />
                        </span>
                        <span className="label" style={{ color: 'var(--accent-2)' }}>Happening here right now</span>
                    </div>
                    <h3 className="font-display text-lg sm:text-xl uppercase text-white leading-tight">{event.name}</h3>
                    <p className="text-xs sm:text-sm text-[var(--ink-dim)] mt-1 leading-snug">{event.blurb}</p>

                    <div className="mt-2.5">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                            <span>Buyers are paying</span>
                            <span className="numeric" style={{ color: 'var(--accent-2)' }}>{pctOffOffers(event.priceMultiplier)} over normal</span>
                        </div>
                        <div className="meter mt-1">
                            <i style={{ width: `${demandPct}%`, background: 'var(--accent-2)' }} />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                        <span className="chip" style={{ borderColor: TONE_COLOR[status.tone], color: TONE_COLOR[status.tone] }}>{status.label}</span>
                        {event.footfallMultiplier >= 1.5 && <span className="chip">👥 {event.footfallMultiplier.toFixed(1)}x crowd</span>}
                        {event.celebrityChance >= 0.08 && <span className="chip chip-warn">🌟 celebrities showing up</span>}
                        <HotTags tags={event.hotTags} />
                    </div>
                </div>
            </div>
        </div>
    );
};

/** One line item on the rest of the calendar — a plan forming, not an alarm. */
const EventRow: React.FC<{ event: HypeEvent; day: number }> = ({ event, day }) => {
    const status = statusFor(event, day);
    return (
        <div className="panel-raised p-2.5">
            <div className="flex items-start gap-2.5">
                <span className="text-xl leading-none flex-shrink-0">{event.icon}</span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-white leading-tight">{event.name}</span>
                        <span className="label">{cityName(event.cityId)}</span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-dim)] mt-0.5 leading-snug line-clamp-2">{event.blurb}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className="chip" style={{ borderColor: TONE_COLOR[status.tone], color: TONE_COLOR[status.tone] }}>{status.label}</span>
                        <span className="chip chip-warn">💰 {pctOffOffers(event.priceMultiplier)}</span>
                        <span className="chip">{event.days > 1 ? `${event.days}-day run` : 'one day'}</span>
                        <HotTags tags={event.hotTags} />
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * The hype calendar panel.
 *
 * Foresight is the entire feature: this renders every event this run's
 * calendar still has ahead of it, not just the next one, so a player passing
 * through on day 6 can already see the expo on day 19 and start buying for
 * it. What's live in the current city gets pulled out and blown up; anything
 * else — live elsewhere, or still to come, anywhere — is a compact list
 * underneath, in date order.
 */
export const HypeCalendar: React.FC<HypeCalendarProps> = ({ day, cityId, className }) => {
    const hereNow = activeHypeEvent(day, cityId);
    const rest = upcomingEvents(day).filter(e => e.id !== hereNow?.id);
    const empty = !hereNow && rest.length === 0;

    return (
        <section className={`panel ${className ?? ''}`}>
            <div className="panel-head">
                <span className="label">📅 Sneaker Calendar</span>
                {rest.length > 0 && <span className="label">{rest.length} more this run</span>}
            </div>
            <div className="p-3 flex flex-col gap-2.5">
                {hereNow && <HereNow event={hereNow} day={day} />}

                {rest.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {!hereNow && <div className="label">On the calendar</div>}
                        {rest.map(e => <EventRow key={e.id} event={e} day={day} />)}
                    </div>
                )}

                {empty && (
                    <p className="text-xs text-[var(--ink-faint)] leading-snug px-0.5">
                        Nothing scheduled anywhere for the rest of the run. The street is just the street today.
                    </p>
                )}
            </div>
        </section>
    );
};

export default HypeCalendar;
