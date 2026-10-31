import { NextResponse } from 'next/server';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { requireAdminPermission } from '@/lib/admin-auth';
import { bearerFromAdminRequest, sendSmsUpstream } from '@/lib/broadcast-notify';

export const runtime = 'nodejs';

interface SmsRequestBody {
    recipient?: string;
    message?: string;
    callback?: string;
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'providers:verify');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const body = (await request.json()) as SmsRequestBody;
        const recipient = (body.recipient ?? '').trim();
        const message = (body.message ?? '').trim();

        if (!recipient || !message)
            return NextResponse.json({ error: 'recipient and message are required' }, { status: 400 });

        // ponytail: same shared upstream as create-user / push / booking SMS
        const bearer = await bearerFromAdminRequest(request);
        const result = await sendSmsUpstream(recipient, message, bearer);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 502 });
        }

        await logAdminActivity({
            request,
            action: 'send',
            resource_type: 'sms',
            summary: `Sent SMS to ${recipient}`,
            metadata: {
                recipient,
                message_length: message.length,
                message_preview: message.length > 120 ? `${message.slice(0, 120)}…` : message,
            },
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'SMS proxy failed';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
