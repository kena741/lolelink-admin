'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PayoutRejectModalProps {
    open: boolean;
    providerName: string;
    amountLabel: string;
    isProcessing?: boolean;
    onClose: () => void;
    onConfirm: (rejectionReason: string) => void;
}

export function PayoutRejectModal({
    open,
    providerName,
    amountLabel,
    isProcessing = false,
    onClose,
    onConfirm,
}: PayoutRejectModalProps) {
    const [rejectionReason, setRejectionReason] = useState('');
    const trimmedReason = rejectionReason.trim();
    const canSubmit = trimmedReason.length > 0 && !isProcessing;

    useEffect(() => {
        if (open) setRejectionReason('');
    }, [open]);

    function handleSubmit() {
        if (!canSubmit) return;
        onConfirm(trimmedReason);
    }

    return (
        <Dialog open={open} onClose={onClose} className="max-w-lg p-0" scrollable>
            <DialogHeader className="border-b border-gray-100 px-5 py-4">
                <DialogTitle>Reject payout request</DialogTitle>
                <p className="mt-1 text-sm text-gray-600">
                    {providerName} · {amountLabel}
                </p>
            </DialogHeader>

            <DialogBody className="space-y-3 px-5 py-4">
                <label className="block text-sm font-medium text-gray-900" htmlFor="payout-rejection-reason">
                    Rejection reason
                </label>
                <textarea
                    id="payout-rejection-reason"
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    rows={4}
                    placeholder="Explain why this withdrawal is being rejected."
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-text-secondary">
                    Saved to <code className="rounded bg-muted px-1 py-0.5">withdrawal_history.rejectionReason</code> for the provider app.
                </p>
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
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={cn(destructiveButtonClassName, !canSubmit && 'cursor-not-allowed opacity-50')}
                >
                    Reject payout
                </button>
            </DialogFooter>
        </Dialog>
    );
}

const destructiveButtonClassName =
    'inline-flex h-9 items-center rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const secondaryButtonClassName =
    'inline-flex h-9 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
