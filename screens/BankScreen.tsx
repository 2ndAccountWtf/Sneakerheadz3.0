import React, { useMemo, useState } from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import { CITIES } from '../data/cities';
import { banksIn, isBankOpen, type Bank } from '../data/banks';
import { robberyExposure, cardUsable, withdrawnToday } from '../systems/banking';
import { CASH_DISCOUNT, CARD_SURCHARGE, CREDIT_DAILY_INTEREST, ROBBERY_CASH_FLOOR, STARTING_CREDIT_LIMIT } from '../constants';

const KIND_LABEL: Record<Bank['kind'], string> = {
    branch: 'Branch',
    atm: 'ATM',
    'sketchy-atm': 'ATM (looks rough)',
};
const KIND_ICON: Record<Bank['kind'], string> = {
    branch: '🏛',
    atm: '🏧',
    'sketchy-atm': '❔',
};

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

/**
 * The Bank.
 *
 * Cash pays less and gets you robbed; a card is safe and gets left in a
 * jacket. This screen is where that whole trade-off becomes legible: what
 * carrying your current cash is buying you in robbery odds, what sitting in
 * an account is costing you in access, and what the card owes you either
 * way.
 */
const BankScreen: React.FC = () => {
    const { gameState, dispatch } = useGame();
    const { player, currentCityId, day } = gameState;
    const { wallet } = player;

    const [depositAmt, setDepositAmt] = useState('');
    const [withdrawAmt, setWithdrawAmt] = useState('');
    const [repayAmt, setRepayAmt] = useState('');

    const banks = useMemo(() => banksIn(currentCityId), [currentCityId]);
    const cityName = CITIES.find(c => c.id === currentCityId)?.name ?? 'here';

    const exposure = robberyExposure(player);
    const exposurePct = Math.round(exposure * 100);
    const exposureTone = exposure >= 0.4 ? 'var(--bad)' : exposure >= 0.15 ? 'var(--warn)' : 'var(--ok)';

    const cardOk = cardUsable(player, day);
    const daysUntilClear = wallet.cardBlockedUntilDay ? wallet.cardBlockedUntilDay - day : 0;

    const owed = wallet.creditOwed;
    const limit = wallet.creditLimit;
    const utilization = limit > 0 ? Math.min(1, owed / limit) : 0;
    const nightlyInterest = owed * CREDIT_DAILY_INTEREST;

    const depositN = Math.floor(Number(depositAmt) || 0);
    const withdrawN = Math.floor(Number(withdrawAmt) || 0);
    const repayN = Math.floor(Number(repayAmt) || 0);

    return (
        <div className="pb-6">
            <ScreenHeader
                title={<>Bank in <span className="accent">{cityName}</span></>}
                subtitle="Cash is fast and cheap. A card is safe until it isn't."
                back={Screen.Dashboard}
            />

            {!cardOk && (
                <div className="panel p-4 mb-4 border-[var(--bad)]" style={{ borderColor: 'var(--bad)' }}>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">🚫</span>
                        <h3 className="font-display text-sm uppercase" style={{ color: 'var(--bad)' }}>Card Blocked</h3>
                    </div>
                    <p className="text-sm text-[var(--ink-dim)]">
                        {wallet.cardBlockedReason ?? 'The card is not working.'}{' '}
                        {daysUntilClear > 0
                            ? `Clears on day ${wallet.cardBlockedUntilDay} (${daysUntilClear} day${daysUntilClear === 1 ? '' : 's'} from now).`
                            : 'It should clear shortly.'}
                        {' '}ATMs are refusing it — a branch teller will still take your face instead.
                    </p>
                </div>
            )}

            {/* --- Cash vs. bank --- */}
            <div className="panel p-4 mb-4">
                <div className="panel-head -mx-4 -mt-4 mb-3 px-4">
                    <h2 className="font-display text-xs uppercase text-white">On You vs. In The Bank</h2>
                    <span className="chip">Cash pays {Math.round((1 - CASH_DISCOUNT) * 100)}% less · Card costs {Math.round((CARD_SURCHARGE - 1) * 100)}% more</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <p className="label">Cash on hand</p>
                        <p className="numeric text-xl" style={{ color: 'var(--ink)' }}>{fmt(player.cash)}</p>
                    </div>
                    <div>
                        <p className="label">Banked</p>
                        <p className="numeric text-xl" style={{ color: 'var(--accent)' }}>{fmt(player.bank)}</p>
                    </div>
                </div>

                <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                        <p className="label">Robbery exposure — what that cash is buying you</p>
                        <span className="numeric text-xs" style={{ color: exposureTone }}>{exposurePct}%</span>
                    </div>
                    <div className="meter"><i style={{ width: `${exposurePct}%`, background: exposureTone }} /></div>
                    <p className="text-xs text-[var(--ink-dim)] mt-1">
                        {player.cash > ROBBERY_CASH_FLOOR
                            ? `You're carrying over ${fmt(ROBBERY_CASH_FLOOR)} — muggers can see it from across the street.`
                            : `Under ${fmt(ROBBERY_CASH_FLOOR)} on hand. Not worth a mugger's time yet.`}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 flex gap-2">
                        <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder="Amount"
                            value={depositAmt}
                            onChange={e => setDepositAmt(e.target.value)}
                            className="flex-1 min-w-0 bg-[var(--bg-sunken)] border border-[var(--line)] px-3 py-2 text-sm font-mono text-[var(--ink)]"
                        />
                        <button
                            className="btn btn-accent"
                            disabled={depositN <= 0 || depositN > player.cash}
                            onClick={() => { dispatch({ type: 'BANK_DEPOSIT', payload: { amount: depositN } }); setDepositAmt(''); }}
                        >
                            Deposit
                        </button>
                    </div>
                </div>
                <p className="label mt-2">Deposited cash cannot be robbed. It also can't buy anything until you draw it back out.</p>
            </div>

            {/* --- Credit --- */}
            <div className="panel p-4 mb-4">
                <div className="panel-head -mx-4 -mt-4 mb-3 px-4">
                    <h2 className="font-display text-xs uppercase text-white">The Card</h2>
                    {wallet.hasCredit && <span className="chip chip-warn">{Math.round(CREDIT_DAILY_INTEREST * 100)}%/day interest</span>}
                </div>

                {!wallet.hasCredit ? (
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-[var(--ink-dim)]">
                            No credit line yet. One gets you {fmt(STARTING_CREDIT_LIMIT)} to buy now and regret later.
                        </p>
                        <button
                            className="btn btn-primary flex-shrink-0"
                            onClick={() => dispatch({ type: 'BANK_OPEN_CREDIT_LINE' })}
                        >
                            Open Line
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-1">
                            <p className="label">Owed / Limit</p>
                            <span className="numeric text-sm">{fmt(owed)} / {fmt(limit)}</span>
                        </div>
                        <div className="meter mb-2">
                            <i style={{ width: `${Math.round(utilization * 100)}%`, background: utilization >= 0.9 ? 'var(--bad)' : utilization >= 0.6 ? 'var(--warn)' : 'var(--accent)' }} />
                        </div>
                        {owed > 0 && (
                            <p className="text-xs text-[var(--ink-dim)] mb-3">
                                Tonight's interest, untouched: +{fmt(nightlyInterest)}. Compounds every day it's carried.
                                {utilization >= 1 && ' Already over the limit — the next day it grows, an over-limit fee lands too.'}
                            </p>
                        )}
                        <div className="flex gap-2">
                            <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                placeholder="Pay down"
                                value={repayAmt}
                                onChange={e => setRepayAmt(e.target.value)}
                                className="flex-1 min-w-0 bg-[var(--bg-sunken)] border border-[var(--line)] px-3 py-2 text-sm font-mono text-[var(--ink)]"
                            />
                            <button
                                className="btn btn-primary"
                                disabled={owed <= 0 || repayN <= 0 || repayN > player.cash}
                                onClick={() => { dispatch({ type: 'BANK_REPAY_CREDIT', payload: { amount: repayN } }); setRepayAmt(''); }}
                            >
                                Repay
                            </button>
                        </div>
                        <p className="label mt-2">Pay it to exactly zero and the limit goes up. Ride it to the edge and it doesn't.</p>
                    </>
                )}
            </div>

            {/* --- Withdraw amount, used against whichever branch/ATM below --- */}
            <div className="panel p-4 mb-3">
                <p className="label mb-2">Withdraw amount (comes out of the bank, into your pocket)</p>
                <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="Amount"
                    value={withdrawAmt}
                    onChange={e => setWithdrawAmt(e.target.value)}
                    className="w-full bg-[var(--bg-sunken)] border border-[var(--line)] px-3 py-2 text-sm font-mono text-[var(--ink)]"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {banks.map(b => {
                    const open = isBankOpen(b, day);
                    const used = withdrawnToday(player, b.id, day);
                    const remaining = Math.max(0, b.dailyLimit - used);
                    const blockedHere = b.kind !== 'branch' && !cardOk;
                    const disabled = !open || blockedHere || withdrawN <= 0 || (withdrawN + b.fee) > player.bank || remaining <= 0;

                    return (
                        <div key={b.id} className="panel p-4 flex flex-col">
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <h3 className="font-display text-sm uppercase text-white leading-tight">
                                    {KIND_ICON[b.kind]} {b.name}
                                </h3>
                                <span className="numeric text-sm flex-shrink-0" style={{ color: b.fee ? 'var(--warn)' : 'var(--ok)' }}>
                                    {b.fee ? `${fmt(b.fee)} fee` : 'No fee'}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--ink-dim)] leading-snug mb-3">{b.blurb}</p>

                            <div className="flex flex-wrap gap-1.5 mb-3">
                                <span className="chip">{KIND_LABEL[b.kind]}</span>
                                <span className={`chip ${remaining <= 0 ? 'chip-bad' : ''}`}>
                                    {fmt(remaining)} / {fmt(b.dailyLimit)} left today
                                </span>
                                {b.timeOfDay && (
                                    <span className={`chip ${open ? 'chip-accent' : 'chip-bad'}`}>
                                        {open ? `Open (${b.timeOfDay})` : `Shut — opens ${b.timeOfDay}`}
                                    </span>
                                )}
                                {b.kind === 'sketchy-atm' && (
                                    <span className="chip chip-bad">{Math.round((b.skimRisk ?? 0) * 100)}% skim risk</span>
                                )}
                            </div>

                            {!open && b.closedLine && (
                                <p className="text-xs italic text-[var(--ink-faint)] mb-2">{b.closedLine}</p>
                            )}
                            {blockedHere && (
                                <p className="text-xs mb-2" style={{ color: 'var(--bad)' }}>Card declined here — the branch is the only option left.</p>
                            )}

                            <button
                                className="btn btn-accent w-full mt-auto"
                                disabled={disabled}
                                onClick={() => dispatch({ type: 'BANK_WITHDRAW', payload: { bankId: b.id, amount: withdrawN } })}
                            >
                                {!open ? 'Closed' : blockedHere ? "Card won't work here" : remaining <= 0 ? 'Limit reached' : `Withdraw here`}
                            </button>
                        </div>
                    );
                })}
            </div>

            <p className="label text-center mt-5">
                Branches are free, generous, and keep hours. ATMs never close and always take a cut. The cheap machine in the back is cheap for a reason.
            </p>
        </div>
    );
};

export default BankScreen;
