import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { sendProviderPush, type PushDeliveryInput } from '@/lib/push/sendProviderPush';
import {
    emptyBroadcastCounts,
    formatBroadcastSmsMessage,
    parseBroadcastChannel,
    resolveBroadcastPhone,
    sendSmsUpstream,
    wantsPush,
    wantsSms,
    type BroadcastChannel,
} from '@/lib/broadcast-notify';
import { logAdminActivity } from '@/lib/admin-activity-log';

export const runtime = 'nodejs';

type BroadcastBody = {
    title?: unknown;
    body?: unknown;
    route?: unknown;
    activeOnly?: unknown;
    channel?: unknown;
};

function parseBody(
    body: unknown
): { input: PushDeliveryInput; activeOnly: boolean; channel: BroadcastChannel } | string {
    if (!body || typeof body !== 'object') return 'Invalid request body';
    const data = body as BroadcastBody;
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const messageBody = typeof data.body === 'string' ? data.body.trim() : '';
    const route = typeof data.route === 'string' ? data.route.trim() : undefined;
    if (!title) return 'Title is required';
    if (!messageBody) return 'Message body is required';
    const channel = parseBroadcastChannel(data.channel);
    if (!channel) return 'channel must be push, sms, or both';
    const activeOnly = typeof data.activeOnly === 'boolean' ? data.activeOnly : true;
    return { input: { title, body: messageBody, route, type: 'general' }, activeOnly, channel };
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
    let query = serviceClient
        .from('provider')
        .select('id, fcmToken, phoneNumber, phone, mobile_number, countryCode, country_code');
    if (parsed.activeOnly) query = query.eq('active', true);

    const { data: providers, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (providers ?? []) as Array<Record<string, unknown>>;
    const push = emptyBroadcastCounts();
    const sms = emptyBroadcastCounts();
    const smsMessage = formatBroadcastSmsMessage(parsed.input.title, parsed.input.body);
    const doPush = wantsPush(parsed.channel);
    const doSms = wantsSms(parsed.channel);

    for (const row of rows) {
        const id = typeof row.id === 'string' ? row.id : '';
        if (!id) continue;

        if (doPush) {
            push.attempted += 1;
            const res = await sendProviderPush({
                serviceClient,
                providerId: id,
                input: parsed.input,
            });
            if (!res.ok) push.failed += 1;
            else if ('skipped' in res) push.skipped += 1;
            else push.sent += 1;
        }

        if (doSms) {
            sms.attempted += 1;
            const recipient = resolveBroadcastPhone(row);
            if (!recipient) {
                sms.skipped += 1;
                continue;
            }
            const smsResult = await sendSmsUpstream(recipient, smsMessage);
            if (smsResult.ok) sms.sent += 1;
            else sms.failed += 1;
        }
    }

    await logAdminActivity({
        request,
        action: 'send',
        resource_type: 'broadcast',
        summary: `Broadcast ${parsed.channel} to providers`,
        metadata: {
            audience: 'providers',
            channel: parsed.channel,
            title: parsed.input.title,
            push,
            sms,
        },
    });

    return NextResponse.json({
        ok: true,
        channel: parsed.channel,
        attempted: Math.max(push.attempted, sms.attempted),
        sent: push.sent + sms.sent,
        skipped: push.skipped + sms.skipped,
        failed: push.failed + sms.failed,
        push,
        sms,
    });
}
