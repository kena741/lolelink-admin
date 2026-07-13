import type { SupabaseClient } from '@supabase/supabase-js';
import { fcmErrorMessage, isStaleFcmTokenError, sendFcmMessage } from '@/lib/firebase/fcm';
import { buildFcmData, type PushDeliveryInput } from '@/lib/push/pushDelivery';

export type ProviderPushProfile = {
    fcmToken: string | null;
    firstName: string | null;
    lastName: string | null;
};

export type { PushDeliveryInput };

export function providerPushReadiness(profile: ProviderPushProfile) {
    if (!profile.fcmToken?.trim()) {
        return {
            canSend: false,
            reason:
                'No FCM token on this provider. Ask them to open the app while signed in and allow notifications.',
        } as const;
    }
    return { canSend: true, reason: null } as const;
}

export async function fetchProviderPushProfile(
    serviceClient: SupabaseClient,
    providerId: string
): Promise<{ profile: ProviderPushProfile | null; error: string | null }> {
    const { data, error } = await serviceClient
        .from('provider')
        .select('fcmToken, firstName, lastName')
        .eq('id', providerId)
        .maybeSingle();

    if (error) return { profile: null, error: error.message };
    if (!data) return { profile: null, error: 'Provider not found' };

    return { profile: data as ProviderPushProfile, error: null };
}

async function clearStaleProviderFcmToken(serviceClient: SupabaseClient, providerId: string) {
    await serviceClient.from('provider').update({ fcmToken: null }).eq('id', providerId);
}

export async function sendProviderPush({
    serviceClient,
    providerId,
    input,
}: {
    serviceClient: SupabaseClient;
    providerId: string;
    input: PushDeliveryInput;
}) {
    const { profile, error } = await fetchProviderPushProfile(serviceClient, providerId);
    if (error) return { ok: false as const, error, clearedToken: false };

    const readiness = providerPushReadiness(
        profile ?? { fcmToken: null, firstName: null, lastName: null }
    );
    if (!readiness.canSend) {
        return { ok: true as const, skipped: readiness.reason };
    }

    try {
        const messageId = await sendFcmMessage({
            token: profile!.fcmToken!,
            title: input.title,
            body: input.body,
            data: buildFcmData(input),
        });
        return { ok: true as const, messageId };
    } catch (pushError) {
        if (isStaleFcmTokenError(pushError)) {
            await clearStaleProviderFcmToken(serviceClient, providerId);
            return {
                ok: false as const,
                error: 'The provider device token is no longer valid and was cleared. Ask them to open the app again.',
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
