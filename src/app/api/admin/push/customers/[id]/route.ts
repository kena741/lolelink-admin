import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import {
    customerPushReadiness,
    fetchCustomerPushProfile,
} from '@/lib/push/sendCustomerPush';
import { resolveBroadcastPhone } from '@/lib/broadcast-notify';

export const runtime = 'nodejs';

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const serviceClient = getSupabaseAdminFromRequest(request);
    const { profile, error } = await fetchCustomerPushProfile(serviceClient, id);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const readiness = customerPushReadiness(
        profile ?? { fcm_token: null, first_name: null, last_name: null }
    );

    const { data: phoneRow } = await serviceClient
        .from('customer')
        .select('phone, mobile_number, countryCode, country_code')
        .eq('id', id)
        .maybeSingle();
    const smsRecipient = phoneRow
        ? resolveBroadcastPhone(phoneRow as Record<string, unknown>)
        : '';

    return NextResponse.json({
        fcmRegistered: Boolean(profile?.fcm_token?.trim()),
        canSend: readiness.canSend,
        reason: readiness.reason,
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null,
        smsReady: Boolean(smsRecipient),
        smsRecipient,
        debug: {
            customerId: id,
            phoneRow: phoneRow ?? null,
        },
    });
}
