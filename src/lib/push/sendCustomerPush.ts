import type { SupabaseClient } from '@supabase/supabase-js';
import { fcmErrorMessage, isStaleFcmTokenError, sendFcmMessage } from '@/lib/firebase/fcm';
import { buildFcmData, type PushDeliveryInput } from '@/lib/push/pushDelivery';

export type CustomerPushProfile = {
    fcm_token: string | null;
    first_name: string | null;
    last_name: string | null;
};

export function customerPushReadiness(profile: CustomerPushProfile) {
    if (!profile.fcm_token?.trim()) {
        return {
            canSend: false,
            reason:
                'No FCM token on this customer. Ask them to open the app while signed in and allow notifications.',
        } as const;
    }
    return { canSend: true, reason: null } as const;
}

export async function fetchCustomerPushProfile(
    serviceClient: SupabaseClient,
    customerId: string
): Promise<{ profile: CustomerPushProfile | null; error: string | null }> {
    const { data, error } = await serviceClient
        .from('customer')
        .select('fcm_token, first_name, last_name')
        .eq('id', customerId)
        .maybeSingle();

    if (error) return { profile: null, error: error.message };
    if (!data) return { profile: null, error: 'Customer not found' };

    return { profile: data as CustomerPushProfile, error: null };
}

async function clearStaleCustomerFcmToken(serviceClient: SupabaseClient, customerId: string) {
    await serviceClient.from('customer').update({ fcm_token: null }).eq('id', customerId);
}

export async function sendCustomerPush({
    serviceClient,
    customerId,
    input,
}: {
    serviceClient: SupabaseClient;
    customerId: string;
    input: PushDeliveryInput;
}) {
    const { profile, error } = await fetchCustomerPushProfile(serviceClient, customerId);
    if (error) return { ok: false as const, error, clearedToken: false };

    const readiness = customerPushReadiness(
        profile ?? { fcm_token: null, first_name: null, last_name: null }
    );
    if (!readiness.canSend) {
        return { ok: true as const, skipped: readiness.reason };
    }

    try {
        const messageId = await sendFcmMessage({
            token: profile!.fcm_token!,
            title: input.title,
            body: input.body,
            data: buildFcmData(input),
        });
        return { ok: true as const, messageId };
    } catch (pushError) {
        if (isStaleFcmTokenError(pushError)) {
            await clearStaleCustomerFcmToken(serviceClient, customerId);
            return {
                ok: false as const,
                error: 'The customer device token is no longer valid and was cleared. Ask them to open the app again.',
                clearedToken: true,
            };
        }
        return {
            ok: false as const,
            error: fcmErrorMessage(pushError),
            clearedToken: false,
        };
    }
}
