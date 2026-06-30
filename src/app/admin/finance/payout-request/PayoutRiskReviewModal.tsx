'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { ProviderPayoutAnalysis } from '@/lib/provider-payout-analysis';
import { getPayoutRiskReviewActionLabel, type PayoutRiskReviewAction } from '@/lib/payout-risk-review';
import { getAdminStatusToneClasses } from '@/lib/admin-status-badge';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PayoutRiskReviewModalProps {
    open: boolean;
    analysis: ProviderPayoutAnalysis;
    providerName: string;
    action: PayoutRiskReviewAction;
    isProcessing?: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

function formatCurrency(value: number): string {
    return `ETB ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function severityClass(severity: 'info' | 'warning' | 'error'): string {
    if (severity === 'error') return cn('border', getAdminStatusToneClasses('danger'));
    if (severity === 'warning') return cn('border', getAdminStatusToneClasses('warning'));
    return cn('border', getAdminStatusToneClasses('wallet'));
}

export function PayoutRiskReviewModal({
    open,
    analysis,
    providerName,
    action,
    isProcessing = false,
    onClose,
    onConfirm,
}: PayoutRiskReviewModalProps) {
    const [acknowledged, setAcknowledged] = useState(false);
    const RiskIcon = analysis.risk === 'high' ? ShieldAlert : AlertTriangle;
    const actionLabel = getPayoutRiskReviewActionLabel(action);

    useEffect(() => {
        if (open) setAcknowledged(false);
    }, [open, analysis.providerId, action]);

    return (
        <Dialog open={open} onClose={onClose} className="max-w-xl p-0" scrollable>
            <DialogHeader className="border-b border-gray-100 px-5 py-4">
                <DialogTitle>Wallet review required</DialogTitle>
                <p className="mt-1 text-sm text-gray-600">
                    {providerName} — review wallet issues before you {action === 'approve' ? 'approve' : 'send'} this payout.
                </p>
            </DialogHeader>

            <DialogBody className="space-y-4 px-5 py-4">
                <div
                    className={cn(
                        'rounded-xl border px-4 py-3',
                        analysis.risk === 'high'
                            ? cn('border', getAdminStatusToneClasses('danger'))
                            : cn('border', getAdminStatusToneClasses('warning'))
                    )}
                >
                    <div className="flex items-start gap-3">
                        <RiskIcon className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-wide text-gray-700">Auto analysis</p>
                            <p className="mt-1 text-base font-bold text-gray-900">{analysis.riskLabel}</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Defensible balance</p>
                        <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(analysis.defensibleBalance)}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Requested amount</p>
                        <p className="mt-1 text-lg font-bold text-gray-900">
                            {analysis.requestedWithdrawalAmount !== null
                                ? formatCurrency(analysis.requestedWithdrawalAmount)
                                : '—'}
                        </p>
                    </div>
                </div>

                <div>
                    <p className="mb-2 text-sm font-semibold text-gray-900">Issues to review</p>
                    <ul className="max-h-56 space-y-2 overflow-y-auto">
                        {analysis.findings.map((finding) => (
                            <li
                                key={finding.id}
                                className={cn('rounded-lg px-3 py-2.5 text-sm', severityClass(finding.severity))}
                            >
                                <p className="font-semibold">{finding.label}</p>
                                {finding.detail ? <p className="mt-1 opacity-90">{finding.detail}</p> : null}
                                {finding.amount !== undefined ? (
                                    <p className="mt-1 font-medium">{formatCurrency(finding.amount)}</p>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700">
                    <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(event) => setAcknowledged(event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    />
                    <span>
                        I have reviewed the wallet issues above and understand this payout may include suspicious or
                        unsupported balance.
                    </span>
                </label>
            </DialogBody>

            <DialogFooter className="border-t border-gray-100 px-5 py-3">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isProcessing}
                    className={cn(secondaryButtonClassName, isProcessing && 'opacity-50')}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={!acknowledged || isProcessing}
                    className={cn(
                        analysis.risk === 'high' ? destructiveButtonClassName : primaryButtonClassName,
                        (!acknowledged || isProcessing) && 'cursor-not-allowed opacity-50'
                    )}
                >
                    {actionLabel}
                </button>
            </DialogFooter>
        </Dialog>
    );
}

const primaryButtonClassName =
    'inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const destructiveButtonClassName =
    'inline-flex h-9 items-center rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const secondaryButtonClassName =
    'inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
