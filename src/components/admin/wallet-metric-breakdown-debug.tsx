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
        netFlow: number;
        chapaWalletNet: number;
        chapaActivationInWallet: number;
        otherChapaInWallet: number;
        chapaAvailableBalance: number | null;
        chapaLedgerBalance: number | null;
        chapaSurplus: number | null;
        chapaNetFlowGap: number | null;
        nonChapaWalletNet: number;
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
                    What each dashboard card is summed from in the selected date range. Amounts come from{' '}
                    <span className="font-medium text-text-primary">wallet_transaction</span> unless noted.
                </p>
                <FormulaLine
                    segments={[
                        { value: formatCurrency(totals.walletCredits) },
                        { value: formatCurrency(totals.walletDebits), operator: '−' },
                        { value: formatCurrency(totals.netFlow), operator: '=' },
                    ]}
                />
                <p className="mt-1 text-xs text-text-secondary">
                    Net Flow = wallet credits − debits. Also{' '}
                    {formatCurrency(totals.chapaWalletNet)} + ({formatSignedCurrency(totals.nonChapaWalletNet)}) ={' '}
                    {formatCurrency(totals.netFlow)} (Chapa rows + non-Chapa rows).
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
                    totalLabel="All top-up-shaped credits (overlaps activation fee — not added to Net Flow separately)"
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
                    title="Net Flow"
                    total={totals.netFlow}
                    totalLabel="Wallet credits − wallet debits"
                    formula={[
                        { value: formatCurrency(totals.walletCredits) },
                        { value: formatCurrency(totals.walletDebits), operator: '−' },
                        { value: formatCurrency(totals.netFlow), operator: '=' },
                    ]}
                />

                <MetricBreakdownCard
                    title="App wallet Chapa"
                    total={totals.chapaWalletNet}
                    totalLabel="Net of rows tagged Chapa (paymentType / note / transactionId)"
                    lines={breakdown.chapaWalletNet}
                    signedAmounts
                    formula={[
                        { value: formatCurrency(totals.chapaActivationInWallet) },
                        { value: formatCurrency(totals.otherChapaInWallet), operator: '+' },
                        { value: formatCurrency(totals.chapaWalletNet), operator: '=' },
                    ]}
                />

                <MetricBreakdownCard
                    title="Non-Chapa net"
                    total={totals.nonChapaWalletNet}
                    totalLabel="Net of rows not tagged Chapa (manual, fees, non-Chapa payouts)"
                    lines={breakdown.nonChapaWalletNet}
                    signedAmounts
                    formula={[
                        { value: formatCurrency(totals.chapaWalletNet) },
                        { value: formatSignedCurrency(totals.nonChapaWalletNet), operator: '+' },
                        { value: formatCurrency(totals.netFlow), operator: '=' },
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
                            ? [
                                  { value: formatCurrency(totals.chapaWalletNet) },
                                  { value: `${formatCurrency(chapaSurplus)} missing wallet rows`, operator: '+' },
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

            {totals.chapaAvailableBalance != null && totals.chapaSurplus != null && totals.chapaNetFlowGap != null && (
                <div className="mt-6 rounded-xl border border-border bg-background p-4">
                    <p className="text-sm font-semibold text-text-primary">Chapa reconciliation</p>
                    <FormulaLine
                        segments={[
                            { value: formatCurrency(totals.chapaAvailableBalance) },
                            { value: formatCurrency(totals.netFlow), operator: '−' },
                            { value: formatCurrency(totals.chapaNetFlowGap), operator: '=' },
                        ]}
                    />
                    <p className="mt-1 text-xs text-text-secondary">
                        Chapa available − Net Flow. Should match Chapa surplus − Non-Chapa net (
                        {formatCurrency(totals.chapaSurplus)} − {formatCurrency(totals.nonChapaWalletNet)} ={' '}
                        {formatCurrency(totals.chapaSurplus - totals.nonChapaWalletNet)}).
                    </p>
                </div>
            )}
        </section>
    );
}
