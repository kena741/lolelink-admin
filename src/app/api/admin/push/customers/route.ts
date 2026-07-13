import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { sendCustomerPush } from '@/lib/push/sendCustomerPush';
import type { PushDeliveryInput } from '@/lib/push/pushDelivery';

export const runtime = 'nodejs';

type BroadcastBody = {
    title?: unknown;
    body?: unknown;
    route?: unknown;
    activeOnly?: unknown;
};

function parseBody(body: unknown): { input: PushDeliveryInput; activeOnly: boolean } | string {
    if (!body || typeof body !== 'object') return 'Invalid request body';
    const data = body as BroadcastBody;
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const messageBody = typeof data.body === 'string' ? data.body.trim() : '';
    const route = typeof data.route === 'string' ? data.route.trim() : undefined;
    if (!title) return 'Title is required';
    if (!messageBody) return 'Message body is required';
    const activeOnly = typeof data.activeOnly === 'boolean' ? data.activeOnly : true;
    return { input: { title, body: messageBody, route, type: 'general' }, activeOnly };
}

export async function POST(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseBody(raw);
    if (typeof parsed === 'string') {
        return NextResponse.json({ error: parsed }, { status: 400 });
    }

    const serviceClient = getSupabaseAdminFromRequest(request);
    let query = serviceClient.from('customer').select('id').not('fcm_token', 'is', null);
    if (parsed.activeOnly) query = query.eq('active', true);

    const { data: customers, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = (customers ?? []).map((row) => row.id as string).filter(Boolean);
    const results = { attempted: ids.length, sent: 0, skipped: 0, failed: 0 };

    for (const id of ids) {
        const res = await sendCustomerPush({
            serviceClient,
            customerId: id,
            input: parsed.input,
        });
        if (!res.ok) {
            results.failed += 1;
            continue;
        }
        if ('skipped' in res) {
            results.skipped += 1;
            continue;
        }
        results.sent += 1;
    }

    return NextResponse.json({ ok: true, ...results });
}
