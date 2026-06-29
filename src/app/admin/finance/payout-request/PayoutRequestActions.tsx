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
            <div className="flex w-[148px] flex-col gap-1.5">
                <ActionButton
                    onClick={onApprove}
                    disabled={isProcessing}
                    aria-label="Approve payout"
                    className="w-full border border-primary bg-primary text-primary-foreground hover:bg-accent focus-visible:ring-ring"
                >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    <span>Approve</span>
                </ActionButton>
                <ActionButton
                    onClick={onReject}
                    disabled={isProcessing}
                    aria-label="Reject payout"
                    className="w-full border border-destructive/40 bg-white text-destructive hover:bg-destructive/5 focus-visible:ring-destructive"
                >
                    <X className="h-3.5 w-3.5" />
                    <span>Reject</span>
                </ActionButton>
            </div>
        );
    }

    if (normalizedStatus === 'approved' && !hasChapaTransferStarted) {
        return (
            <div className="w-[148px]">
                <ActionButton
                    onClick={onSendWithChapa}
                    disabled={isProcessing}
                    aria-label="Send via Chapa"
                    className="w-full bg-primary text-primary-foreground hover:bg-accent focus-visible:ring-ring"
                >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>Send</span>
                </ActionButton>
            </div>
        );
    }

    if (normalizedStatus === 'approved' && hasChapaTransferStarted) {
        return (
            <div className="flex w-[148px] flex-col items-stretch gap-1.5">
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                    Awaiting
                </span>
                <ActionButton
                    onClick={onVerifyTransfer}
                    disabled={isProcessing}
                    aria-label="Verify Chapa transfer"
                    className="w-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-indigo-200"
                >
                    {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    <span>Verify</span>
                </ActionButton>
            </div>
        );
    }

    if (normalizedStatus === 'completed') {
        return (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                Done
            </span>
        );
    }

    if (normalizedStatus === 'rejected') {
        return (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                Rejected
            </span>
        );
    }

    return <span className="text-xs text-gray-400">—</span>;
}
