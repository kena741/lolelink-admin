import type { SupabaseClient } from '@supabase/supabase-js';
import { sendProviderPush } from '@/lib/push/sendProviderPush';
import type { PushDeliveryInput } from '@/lib/push/pushDelivery';

export function providerDocumentApprovedPush(
    providerName: string,
    documentName: string
): PushDeliveryInput {
    const name = providerName.trim() || 'Provider';
    return {
        title: 'Document approved',
        body: `Hi ${name}, your ${documentName} has been approved.`,
        route: '/profile',
        type: 'account',
    };
}

export function providerDocumentRejectedPush(
    providerName: string,
    documentName: string,
    reason?: string
): PushDeliveryInput {
    const name = providerName.trim() || 'Provider';
    const reasonText = reason?.trim() ? ` Reason: ${reason.trim()}` : '';
    return {
        title: 'Document rejected',
        body: `Hi ${name}, your ${documentName} was rejected.${reasonText}`,
        route: '/profile',
        type: 'account',
    };
}

export function providerAccountApprovedPush(providerName: string): PushDeliveryInput {
    const name = providerName.trim() || 'Provider';
    return {
        title: 'Account approved',
        body: `Dear ${name}, your Zemen Service account documents have been approved.`,
        route: '/profile',
        type: 'account',
    };
}

export async function notifyProviderAccountPush(
    serviceClient: SupabaseClient,
    providerId: string,
    input: PushDeliveryInput
): Promise<void> {
    if (!providerId.trim()) return;
    await sendProviderPush({ serviceClient, providerId, input });
}
