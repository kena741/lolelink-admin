'use client';

import Link from 'next/link';
import { AlertTriangle, Check, CheckCircle2, Loader2, Send, ShieldAlert, X, XCircle } from 'lucide-react';
import type { ProviderPayoutAnalysis, ProviderWalletTransactionLine } from '@/lib/provider-payout-analysis';
import { formatAdminDateTimeUtc } from '@/lib/admin-datetime';
import { maskAccountNumber } from '@/app/admin/finance/payout-request/payout-request-display';
import { Sheet, SheetBody, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface PayoutBankDetails {
    bankName?: string;
    bankCode?: string;
    accountNumber?: string;
    holderName?: string;
    swiftCode?: string;
    branchCity?: string;
    branchCountry?: string;
}

interface PayoutWalletAnalysisSheetProps {
    open: boolean;
    onClose: () => void;
    loading: boolean;
    error: string | null;
    analysis: ProviderPayoutAnalysis | null;
    withdrawalAmount?: string | number | null;
    requestId?: string | null;
    bankDetails?: PayoutBankDetails | null;
    paymentStatus?: string | null;
    hasChapaTransferStarted?: boolean;
    isProcessing?: boolean;
    onApprove?: () => void;
    onReject?: () => void;
    onSend?: () => void;
    onVerifyTransfer?: () => void;
}

function formatCurrency(value: number): string {
    return `ETB ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
    return formatAdminDateTimeUtc(value);
}

function riskStyles(risk: ProviderPayoutAnalysis['risk']): {
    icon: typeof CheckCircle2;
    className: string;
} {
    if (risk === 'clean') {
        return { icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
    }
    if (risk === 'review') {
        return { icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-900' };
    }
    return { icon: ShieldAlert, className: 'border-rose-200 bg-rose-50 text-rose-900' };
}

function categoryLabel(category: ProviderWalletTransactionLine['category']): string {
    const labels: Record<ProviderWalletTransactionLine['category'], string> = {
        activation: 'Activation',
        legitimate_payout: 'Job payout',
        suspicious_payout: 'Suspicious payout',
        erroneous_payout: 'Erroneous payout',
        withdrawal: 'Withdrawal',
        decline_fee: 'Decline fee',
        other: 'Other',
    };
    return labels[category];
}

function categoryClass(category: ProviderWalletTransactionLine['category']): string {
    if (category === 'legitimate_payout' || category === 'activation') return 'bg-emerald-50 text-emerald-700';
    if (category === 'suspicious_payout') return 'bg-amber-50 text-amber-800';
    if (category === 'erroneous_payout') return 'bg-rose-50 text-rose-800';
    if (category === 'withdrawal' || category === 'decline_fee') return 'bg-slate-100 text-slate-700';
    return 'bg-gray-100 text-gray-700';
}

function severityClass(severity: 'info' | 'warning' | 'error'): string {
    if (severity === 'error') return 'border-rose-200 bg-rose-50 text-rose-900';
    if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
    return 'border-sky-200 bg-sky-50 text-sky-900';
}

function BankSummary({ bankDetails }: { bankDetails: PayoutBankDetails }) {
    const bankName = bankDetails.bankName?.trim() || 'Bank not set';
    const account = bankDetails.accountNumber?.trim()
        ? maskAccountNumber(bankDetails.accountNumber)
        : 'Account missing';
    const holder = bankDetails.holderName?.trim();

    return (
        <p className="text-sm text-text-primary">
            <span className="font-semibold">{bankName}</span>
            <span className="text-text-secondary"> · </span>
            <span className="font-mono">{account}</span>
            {holder ? (
                <>
                    <span className="text-text-secondary"> · </span>
                    <span>{holder}</span>
                </>
            ) : null}
        </p>
    );
}

export function PayoutWalletAnalysisSheet({
    open,
    onClose,
    loading,
    error,
    analysis,
    withdrawalAmount,
    requestId,
    bankDetails,
    paymentStatus,
    hasChapaTransferStarted = false,
    isProcessing = false,
    onApprove,
    onReject,
    onSend,
    onVerifyTransfer,
}: PayoutWalletAnalysisSheetProps) {
    const risk = analysis ? riskStyles(analysis.risk) : null;
    const RiskIcon = risk?.icon ?? Loader2;
    const normalizedStatus = (paymentStatus || '').trim().toLowerCase();
    const showPendingActions = normalizedStatus === 'pending' && onApprove && onReject;
    const showSendAction = normalizedStatus === 'approved' && !hasChapaTransferStarted && onSend;
    const showVerifyAction = normalizedStatus === 'approved' && hasChapaTransferStarted && onVerifyTransfer;

    return (
        <Sheet open={open} onClose={onClose} widthClassName="max-w-2xl lg:max-w-3xl">
            <SheetHeader onClose={onClose}>
                <SheetTitle>Wallet analysis</SheetTitle>
            </SheetHeader>
            <SheetBody className="space-y-6">
                {loading && (
                    <div className="flex items-center gap-3 rounded-xl border border-subtle bg-bg-subtle px-4 py-6 text-text-secondary">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Analyzing provider wallet transactions…
                    </div>
                )}

                {error && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                        {error}
                    </div>
                )}

                {(requestId || bankDetails) && (
                    <Section title="Payout request">
                        {bankDetails ? (
                            <BankSummary bankDetails={bankDetails} />
                        ) : (
                            <p className="text-sm text-rose-700">No bank details on this payout request.</p>
                        )}
                    </Section>
                )}

                {analysis && (
                    <>
                        <div className="space-y-1">
                            <p className="text-[18px] font-bold text-text-primary">{analysis.providerName}</p>
                            <p className="text-sm text-text-secondary">{analysis.providerEmail ?? 'No email'}</p>
                            {withdrawalAmount !== undefined && withdrawalAmount !== null && (
                                <p className="text-sm font-medium text-text-primary">
                                    This request: {formatCurrency(Number(withdrawalAmount))}
                                </p>
                            )}
                            <Link
                                href={`/admin/providers/${analysis.providerId}`}
                                className="text-sm font-medium text-accent-info hover:underline"
                            >
                                Open provider profile
                            </Link>
                        </div>

                        <div className={`rounded-xl border px-4 py-4 ${risk?.className ?? ''}`}>
                            <div className="flex items-start gap-3">
                                <RiskIcon className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-wide">Auto analysis</p>
                                    <p className="mt-1 text-base font-bold">{analysis.riskLabel}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <MetricCard label="Stored wallet" value={formatCurrency(analysis.storedWalletAmount)} />
                            <MetricCard label="Ledger net" value={formatCurrency(analysis.ledgerNet)} />
                            <MetricCard label="Defensible balance" value={formatCurrency(analysis.defensibleBalance)} highlight />
                            <MetricCard
                                label="Requested withdrawal"
                                value={
                                    analysis.requestedWithdrawalAmount !== null
                                        ? formatCurrency(analysis.requestedWithdrawalAmount)
                                        : '—'
                                }
                            />
                        </div>

                        <Section title="Balance breakdown">
                            <div className="grid gap-2 text-sm">
                                <BreakdownRow label="Activation / plan credits" amount={analysis.breakdown.activationCredits} positive />
                                <BreakdownRow label="Legitimate job payouts" amount={analysis.breakdown.legitimateJobPayouts} positive />
                                <BreakdownRow label="Suspicious job payouts" amount={analysis.breakdown.suspiciousJobPayouts} warn />
                                <BreakdownRow label="Erroneous job payouts" amount={analysis.breakdown.erroneousPayouts} warn />
                                <BreakdownRow label="Other credits" amount={analysis.breakdown.otherCredits} positive />
                                <BreakdownRow label="Withdrawals" amount={-analysis.breakdown.withdrawals} />
                                <BreakdownRow label="Decline / gateway fees" amount={-analysis.breakdown.declineFees} />
                                <BreakdownRow label="Other debits" amount={-analysis.breakdown.otherDebits} />
                            </div>
                        </Section>

                        {analysis.findings.length > 0 && (
                            <Section title="Findings">
                                <div className="space-y-2">
                                    {analysis.findings.map((finding) => (
                                        <div
                                            key={finding.id}
                                            className={`rounded-lg border px-3 py-3 text-sm ${severityClass(finding.severity)}`}
                                        >
                                            <p className="font-semibold">{finding.label}</p>
                                            {finding.detail && <p className="mt-1 opacity-90">{finding.detail}</p>}
                                            {finding.amount !== undefined && (
                                                <p className="mt-1 font-medium">{formatCurrency(finding.amount)}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </Section>
                        )}

                        <Section title={`Transactions (${analysis.transactions.length})`}>
                            <div className="space-y-2">
                                {analysis.transactions.map((tx) => (
                                    <div
                                        key={tx.id}
                                        className="rounded-lg border border-subtle bg-bg-base px-3 py-3 text-sm"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${categoryClass(tx.category)}`}
                                                >
                                                    {categoryLabel(tx.category)}
                                                </span>
                                                <span className="font-semibold text-text-primary">
                                                    {tx.isCredit ? '+' : '−'}
                                                    {formatCurrency(tx.amount)}
                                                </span>
                                            </div>
                                            <span className="text-xs text-text-secondary">{formatDate(tx.createdDate)}</span>
                                        </div>
                                        <p className="mt-2 text-text-secondary">{tx.note || '—'}</p>
                                        {tx.bookingId && (
                                            <p className="mt-1 font-mono text-xs text-text-secondary">
                                                Booking #{tx.bookingId.slice(0, 8)}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Section>

                        <div className="rounded-lg border border-subtle bg-bg-subtle px-3 py-3 text-xs text-text-secondary">
                            Completed bookings: {analysis.stats.completedBookings} · Rejected paid without refund:{' '}
                            {analysis.stats.rejectedPaidWithoutRefund}
                        </div>
                    </>
                )}

                {!loading && !error && !analysis && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <XCircle className="h-4 w-4" />
                        No analysis loaded.
                    </div>
                )}
            </SheetBody>
            {showPendingActions ? (
                <SheetFooter className="justify-end gap-2">
                    <button
                        type="button"
                        onClick={onReject}
                        disabled={isProcessing}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-destructive/40 bg-white px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        Reject
                    </button>
                    <button
                        type="button"
                        onClick={onApprove}
                        disabled={isProcessing}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Approve
                    </button>
                </SheetFooter>
            ) : null}
            {showSendAction ? (
                <SheetFooter className="justify-end">
                    <button
                        type="button"
                        onClick={onSend}
                        disabled={isProcessing}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Send via Chapa
                    </button>
                </SheetFooter>
            ) : null}
            {showVerifyAction ? (
                <SheetFooter className="justify-end">
                    <button
                        type="button"
                        onClick={onVerifyTransfer}
                        disabled={isProcessing}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Verify transfer
                    </button>
                </SheetFooter>
            ) : null}
        </Sheet>
    );
}

function MetricCard({
    label,
    value,
    highlight = false,
}: {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div className={`rounded-xl border px-4 py-3 ${highlight ? 'border-accent-info bg-accent-info-bg' : 'border-subtle bg-bg-surface'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
            <p className="mt-1 text-lg font-bold text-text-primary">{value}</p>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h3 className="mb-3 text-[16px] font-bold text-text-primary">{title}</h3>
            {children}
        </section>
    );
}

function BreakdownRow({
    label,
    amount,
    positive = false,
    warn = false,
}: {
    label: string;
    amount: number;
    positive?: boolean;
    warn?: boolean;
}) {
    const className = warn
        ? 'text-amber-800'
        : positive && amount > 0
          ? 'text-emerald-700'
          : amount < 0
            ? 'text-rose-700'
            : 'text-text-primary';

    return (
        <div className="flex items-center justify-between gap-3 border-b border-subtle py-2 last:border-b-0">
            <span className="text-text-secondary">{label}</span>
            <span className={`font-semibold ${className}`}>
                {amount < 0 ? '−' : ''}
                {formatCurrency(Math.abs(amount))}
            </span>
        </div>
    );
}
