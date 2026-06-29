import type { ButtonHTMLAttributes } from 'react';
import { Check, Loader2, RefreshCw, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayoutRequestActionsProps {
    paymentStatus: string;
    hasChapaTransferStarted: boolean;
    isProcessing: boolean;
    onApprove: () => void;
    onReject: () => void;
    onSendWithChapa: () => void;
    onVerifyTransfer: () => void;
}

function ActionButton({
    className,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
    return (
        <button
            type="button"
            className={cn(
                'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}

export function PayoutRequestActions({
    paymentStatus,
    hasChapaTransferStarted,
    isProcessing,
    onApprove,
    onReject,
    onSendWithChapa,
    onVerifyTransfer,
}: PayoutRequestActionsProps) {
    const normalizedStatus = paymentStatus.trim().toLowerCase();

    if (normalizedStatus === 'pending') {
        return (
            <div className="flex items-center justify-end gap-1.5">
                <ActionButton
                    onClick={onApprove}
                    disabled={isProcessing}
                    aria-label="Approve payout"
                    className="border border-primary bg-primary text-primary-foreground hover:bg-accent focus-visible:ring-ring"
                >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span>Approve</span>
                </ActionButton>
                <ActionButton
                    onClick={onReject}
                    disabled={isProcessing}
                    aria-label="Reject payout"
                    className="border border-destructive/40 bg-white text-destructive hover:bg-destructive/5 focus-visible:ring-destructive"
                >
                    <X className="h-3.5 w-3.5" />
                    <span>Reject</span>
                </ActionButton>
            </div>
        );
    }

    if (normalizedStatus === 'approved' && !hasChapaTransferStarted) {
        return (
            <div className="flex justify-end">
                <ActionButton
                    onClick={onSendWithChapa}
                    disabled={isProcessing}
                    aria-label="Send via Chapa"
                    className="border border-primary bg-primary text-primary-foreground hover:bg-accent focus-visible:ring-ring"
                >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>Send</span>
                </ActionButton>
            </div>
        );
    }

    if (normalizedStatus === 'approved' && hasChapaTransferStarted) {
        return (
            <div className="flex justify-end">
                <ActionButton
                    onClick={onVerifyTransfer}
                    disabled={isProcessing}
                    aria-label="Verify Chapa transfer"
                    className="border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-indigo-200"
                >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    <span>Verify</span>
                </ActionButton>
            </div>
        );
    }

    return <span className="text-xs text-gray-400">—</span>;
}
