'use client';

import {
    type WalletDashboardBreakdown,
    type WalletMetricBreakdownLine,
} from '@/lib/wallet-transaction-metrics';

interface WalletMetricBreakdownDebugProps {
    breakdown: WalletDashboardBreakdown;
    totals: {
        walletRows: number;
        activationFee: number;
        manualActivation: number;
        customerTopUp: number;
        totalTopUp: number;
        walletCredits: number;
        walletDebits: number;
        chapaWalletNet: number;
        nonChapaWalletNet: number;
        directPaymentCredits: number;
        totalLedgerNet: number;
        chapaActivationInWallet: number;
        otherChapaInWallet: number;
        chapaAvailableBalance: number | null;
        chapaLedgerBalance: number | null;
        chapaSurplus: number | null;
        providerCount: number;
        bookingCount: number;
        completedBookings: number;
        inProgressBookings: number;
        rejectedBookings: number;
        customerCount: number;
    };
}

interface FormulaSegment {
    value: string;
    operator?: '+' | '−' | '=';
}

function formatCurrency(value: number): string {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sumBreakdownLines(lines: WalletMetricBreakdownLine[]): number {
    return lines.reduce((sum, line) => sum + line.amount, 0);
}

function formatSignedCurrency(value: number): string {
    const prefix = value < 0 ? '−' : '';
    return `${prefix}${formatCurrency(Math.abs(value))}`;
}

function formatChapaSurplusLabel(surplus: number): string {
    if (surplus > 0.005) {
        return `${formatCurrency(surplus)} in Chapa · not in ledger`;
    }
    if (surplus < -0.005) {
        return `${formatCurrency(Math.abs(surplus))} ledger exceeds Chapa`;
    }
    return 'ledger matches live Chapa';
}

function FormulaLine({ segments }: { segments: FormulaSegment[] }) {
    return (
        <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            {segments.map((segment, index) => (
                <span key={`${segment.value}-${index}`}>
                    {index > 0 && segment.operator && (
                        <span className="text-text-secondary"> {segment.operator} </span>
                    )}
                    <span className="font-medium tabular-nums text-text-primary">{segment.value}</span>
                </span>
            ))}
        </p>
    );
}

function MetricBreakdownCard({
    title,
    total,
    totalLabel,
    lines,
    formula,
    isCurrency = true,
    signedAmounts = false,
    showSum = true,
}: {
    title: string;
    total: number | string;
    totalLabel?: string;
    lines?: WalletMetricBreakdownLine[];
    formula?: FormulaSegment[];
    isCurrency?: boolean;
    signedAmounts?: boolean;
    showSum?: boolean;
}) {
    const lineTotal = lines ? sumBreakdownLines(lines) : null;
    const formattedTotal =
        typeof total === 'number'
            ? isCurrency
                ? signedAmounts
                    ? formatSignedCurrency(total)
                    : formatCurrency(total)
                : total.toLocaleString('en-US')
            : total;

    return (
        <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-text-primary">{title}</p>
                <p className="shrink-0 text-sm font-bold tabular-nums text-text-primary">{formattedTotal}</p>
            </div>
            {totalLabel && (
                <p className="mt-1 text-xs text-text-secondary">{totalLabel}</p>
            )}
            {formula && formula.length > 0 && <FormulaLine segments={formula} />}
            {lines && lines.length > 0 && (
                <dl className="mt-3 space-y-1.5 border-t border-border pt-3">
                    {lines.map((line) => (
                        <div
                            key={`${title}-${line.label}`}
                            className="flex items-start justify-between gap-3 text-xs tabular-nums"
                        >
                            <dt className="min-w-0 text-text-secondary">
                                <span className="font-medium text-text-primary">{line.count}×</span>{' '}
                                {line.label}
                            </dt>
                            <dd className="shrink-0 font-medium text-text-primary">
                                {isCurrency
                                    ? signedAmounts
                                        ? formatSignedCurrency(line.amount)
                                        : formatCurrency(line.amount)
                                    : line.amount.toLocaleString('en-US')}
                            </dd>
                        </div>
                    ))}
                    {showSum && lineTotal != null && lines.length > 1 && (
                        <div className="flex items-center justify-between gap-3 border-t border-border pt-2 text-xs font-semibold tabular-nums">
                            <dt className="text-text-primary">Sum</dt>
                            <dd className="text-text-primary">
                                {isCurrency
                                    ? signedAmounts
                                        ? formatSignedCurrency(lineTotal)
                                        : formatCurrency(lineTotal)
                                    : lineTotal.toLocaleString('en-US')}
                            </dd>
                        </div>
                    )}
                </dl>
            )}
        </div>
    );
}

export function WalletMetricBreakdownDebug({ breakdown, totals }: WalletMetricBreakdownDebugProps) {
    const chapaSurplus = totals.chapaSurplus ?? 0;

    return (
        <section className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:p-6">
            <div className="mb-5">
                <h2 className="admin-section-title">Metric breakdown (debug)</h2>
                <p className="admin-section-desc">
                    Ledger detail for the selected date range. Production{' '}
                    <span className="font-medium text-text-primary">Net Flow</span> is Chapa only;{' '}
                    <span className="font-medium text-text-primary">Direct payments</span> counts offline /
                    non-Chapa inflows only (credits, excluding provider job payouts).
                </p>
                <FormulaLine
                    segments={[
                        { value: formatCurrency(totals.chapaWalletNet) },
                        { value: formatSignedCurrency(totals.nonChapaWalletNet), operator: '+' },
                        { value: formatCurrency(totals.totalLedgerNet), operator: '=' },
                    ]}
                />
                <p className="mt-1 text-xs text-text-secondary">
                    Full ledger net = Chapa net + non-Chapa net (
                    {formatCurrency(totals.walletCredits)} credits − {formatCurrency(totals.walletDebits)} debits).
                    Production Direct payments ({formatCurrency(totals.directPaymentCredits)}) excludes internal
                    debits and provider payouts.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <MetricBreakdownCard
                    title="Wallet rows"
                    total={totals.walletRows}
                    isCurrency={false}
                    totalLabel="Count of ledger rows in range"
                    showSum={false}
                    lines={[
                        {
                            label: 'Credit rows',
                            amount: breakdown.walletRowCounts.creditRows,
                            count: breakdown.walletRowCounts.creditRows,
                        },
                        {
                            label: 'Debit rows',
                            amount: breakdown.walletRowCounts.debitRows,
                            count: breakdown.walletRowCounts.debitRows,
                        },
                    ]}
                    formula={[
                        { value: `${breakdown.walletRowCounts.creditRows} credits` },
                        { value: `${breakdown.walletRowCounts.debitRows} debits`, operator: '+' },
                        { value: `${totals.walletRows} rows`, operator: '=' },
                    ]}
                />

                <MetricBreakdownCard
                    title="Activation fee"
                    total={totals.activationFee}
                    totalLabel="Credits with activation in note or activation_* transaction id"
                    lines={breakdown.activationFee}
                />

                <MetricBreakdownCard
                    title="Manual activation"
                    total={totals.manualActivation}
                    totalLabel="Subset of activation fee · paymentType = manual"
                    lines={breakdown.manualActivation}
                />

                <MetricBreakdownCard
                    title="Customer top up"
                    total={totals.customerTopUp}
                    totalLabel="Customer-type rows with top-up note or wallet_* id"
                    lines={breakdown.customerTopUp}
                />

                <MetricBreakdownCard
                    title="Total top up"
                    total={totals.totalTopUp}
                    totalLabel="All top-up-shaped credits (overlaps activation fee)"
                    lines={breakdown.totalTopUp}
                />

                <MetricBreakdownCard
                    title="Wallet credits"
                    total={totals.walletCredits}
                    totalLabel="Every credit row (adjusted)"
                    lines={breakdown.walletCredits}
                    formula={breakdown.walletCredits.flatMap((line, index) => {
                        const segment: FormulaSegment = {
                            value: `${formatCurrency(line.amount)} (${line.label})`,
                        };
                        if (index === 0) return [segment];
                        return [{ ...segment, operator: '+' }];
                    })}
                />

                <MetricBreakdownCard
                    title="Wallet debits"
                    total={totals.walletDebits}
                    totalLabel="Every debit row"
                    lines={breakdown.walletDebits}
                />

                <MetricBreakdownCard
                    title="Net Flow (Chapa)"
                    total={totals.chapaWalletNet}
                    totalLabel="Production Net Flow · Chapa-tagged rows only"
                    lines={breakdown.chapaWalletNet}
                    signedAmounts
                    formula={[
                        { value: formatCurrency(totals.chapaActivationInWallet) },
                        { value: formatCurrency(totals.otherChapaInWallet), operator: '+' },
                        { value: formatCurrency(totals.chapaWalletNet), operator: '=' },
                    ]}
                />

                <MetricBreakdownCard
                    title="Direct payments"
                    total={totals.directPaymentCredits}
                    totalLabel="Production Direct payments · offline & non-Chapa received"
                    lines={breakdown.directPaymentCredits}
                />

                <MetricBreakdownCard
                    title="Non-Chapa ledger net"
                    total={totals.nonChapaWalletNet}
                    totalLabel="Credits − debits for non-Chapa rows (reconciliation)"
                    lines={breakdown.nonChapaWalletNet}
                    signedAmounts
                />

                <MetricBreakdownCard
                    title="Total ledger"
                    total={totals.totalLedgerNet}
                    totalLabel="Chapa net + non-Chapa net (full wallet_transaction net)"
                    formula={[
                        { value: formatCurrency(totals.chapaWalletNet) },
                        { value: formatSignedCurrency(totals.nonChapaWalletNet), operator: '+' },
                        { value: formatCurrency(totals.totalLedgerNet), operator: '=' },
                    ]}
                />

                <MetricBreakdownCard
                    title="Chapa available"
                    total={totals.chapaAvailableBalance ?? totals.chapaWalletNet}
                    totalLabel={
                        totals.chapaAvailableBalance != null
                            ? `Live Chapa API · ledger ${formatCurrency(totals.chapaLedgerBalance ?? 0)}`
                            : 'Live Chapa unavailable — showing app wallet Chapa'
                    }
                    formula={
                        totals.chapaAvailableBalance != null
                            ? chapaSurplus >= 0
                                ? [
                                      { value: formatCurrency(totals.chapaWalletNet) },
                                      { value: formatChapaSurplusLabel(chapaSurplus), operator: '+' },
                                      { value: formatCurrency(totals.chapaAvailableBalance), operator: '=' },
                                  ]
                                : [
                                      { value: formatCurrency(totals.chapaWalletNet) },
                                      { value: formatChapaSurplusLabel(chapaSurplus), operator: '−' },
                                      { value: formatCurrency(totals.chapaAvailableBalance), operator: '=' },
                                  ]
                            : [{ value: `${formatCurrency(totals.chapaWalletNet)} from wallet rows only` }]
                    }
                />

                <MetricBreakdownCard
                    title="Providers"
                    total={totals.providerCount}
                    isCurrency={false}
                    totalLabel="Providers created in selected range"
                />

                <MetricBreakdownCard
                    title="Bookings"
                    total={totals.bookingCount}
                    isCurrency={false}
                    totalLabel="All booked_service rows in range"
                    showSum={false}
                    lines={[
                        { label: 'Completed', amount: totals.completedBookings, count: totals.completedBookings },
                        { label: 'In progress', amount: totals.inProgressBookings, count: totals.inProgressBookings },
                        { label: 'Rejected / cancelled', amount: totals.rejectedBookings, count: totals.rejectedBookings },
                    ]}
                    formula={[
                        { value: `${totals.completedBookings} completed` },
                        { value: `${totals.inProgressBookings} in progress`, operator: '+' },
                        { value: `${totals.rejectedBookings} rejected`, operator: '+' },
                        { value: `${totals.bookingCount} total`, operator: '=' },
                    ]}
                />

                <MetricBreakdownCard
                    title="Customers"
                    total={totals.customerCount}
                    isCurrency={false}
                    totalLabel="Customers created in selected range"
                />
            </div>

            {totals.chapaAvailableBalance != null && totals.chapaSurplus != null && (
                <div className="mt-6 rounded-xl border border-border bg-background p-4">
                    <p className="text-sm font-semibold text-text-primary">Chapa reconciliation</p>
                    <FormulaLine
                        segments={[
                            { value: formatCurrency(totals.chapaAvailableBalance) },
                            { value: formatCurrency(totals.chapaWalletNet), operator: '−' },
                            { value: formatSignedCurrency(totals.chapaSurplus), operator: '=' },
                        ]}
                    />
                    <p className="mt-1 text-xs text-text-secondary">
                        Live Chapa − app wallet Chapa = {formatSignedCurrency(totals.chapaSurplus)} (
                        {formatChapaSurplusLabel(totals.chapaSurplus)}).
                    </p>
                </div>
            )}
        </section>
    );
}
