import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import {
    fetchProviderPushProfile,
    providerPushReadiness,
    sendProviderPush,
} from '@/lib/push/sendProviderPush';

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
    const { profile, error } = await fetchProviderPushProfile(serviceClient, id);
    if (error) return NextResponse.json({ error }, { status: 404 });

    const readiness = providerPushReadiness(
        profile ?? { fcmToken: null, firstName: null, lastName: null }
    );

    return NextResponse.json({
        fcmRegistered: Boolean(profile?.fcmToken?.trim()),
        canSend: readiness.canSend,
        reason: readiness.reason,
        name: [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || null,
    });
}

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    let body: { title?: string; body?: string; route?: string };
    try {
        body = (await request.json()) as { title?: string; body?: string; route?: string };
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const title = (body.title ?? '').trim();
    const messageBody = (body.body ?? '').trim();
    if (!title || !messageBody) {
        return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
    }

    const serviceClient = getSupabaseAdminFromRequest(request);
    const result = await sendProviderPush({
        serviceClient,
        providerId: id,
        input: {
            title,
            body: messageBody,
            route: body.route?.trim() || '/',
            type: 'general',
        },
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
