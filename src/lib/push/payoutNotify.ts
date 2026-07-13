import type { SupabaseClient } from '@supabase/supabase-js';
import { sendProviderPush } from '@/lib/push/sendProviderPush';
import type { PushDeliveryInput } from '@/lib/push/pushDelivery';

export type PayoutNotifyEvent =
    | 'approved'
    | 'rejected'
    | 'completed'
    | 'transfer_initiated';

function formatAmount(amount: number): string {
    const normalized = Number.isFinite(amount) ? amount : 0;
    return `ETB ${normalized.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function payoutPushMessage(
    event: PayoutNotifyEvent,
    amount: number,
    rejectionReason?: string
): PushDeliveryInput {
    const formatted = formatAmount(amount);

    switch (event) {
        case 'approved':
            return {
                title: 'Withdrawal approved',
                body: `Your withdrawal of ${formatted} was approved. Payment will be sent soon.`,
                route: '/wallet',
                type: 'payout',
            };
        case 'rejected':
            return {
                title: 'Withdrawal rejected',
                body: rejectionReason?.trim()
                    ? `Your withdrawal of ${formatted} was rejected. Reason: ${rejectionReason.trim()}`
                    : `Your withdrawal of ${formatted} was rejected. Funds remain in your wallet.`,
                route: '/wallet',
                type: 'payout',
            };
        case 'completed':
            return {
                title: 'Withdrawal paid',
                body: `Your withdrawal of ${formatted} has been paid to your bank account.`,
                route: '/wallet',
                type: 'payout',
            };
        case 'transfer_initiated':
            return {
                title: 'Payment processing',
                body: `Your withdrawal of ${formatted} is being sent to your bank account.`,
                route: '/wallet',
                type: 'payout',
            };
    }
}

export async function notifyProviderPayoutStatus(
    serviceClient: SupabaseClient,
    params: {
        providerId: string;
        event: PayoutNotifyEvent;
        amount: number;
        rejectionReason?: string;
    }
): Promise<void> {
    const { providerId, event, amount, rejectionReason } = params;
    if (!providerId.trim()) return;

    await sendProviderPush({
        serviceClient,
        providerId,
        input: payoutPushMessage(event, amount, rejectionReason),
    });
}
