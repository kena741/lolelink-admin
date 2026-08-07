import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { formatOpsAlertSms, sendOpsAlertSms } from '@/lib/ops-alert-sms';

export const runtime = 'nodejs';

interface OpsAlertBody {
    title?: string;
    body?: string;
    count?: number;
    message?: string;
}

export async function POST(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const raw = (await request.json()) as OpsAlertBody;
        const message =
            (raw.message ?? '').trim() ||
            formatOpsAlertSms({
                title: raw.title ?? 'Ops alert',
                body: raw.body,
                count: raw.count,
            });

        const result = await sendOpsAlertSms(message);
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: 502 });
        }
        if ('skipped' in result) {
            return NextResponse.json({ ok: true, skipped: result.skipped });
        }
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to send ops SMS';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
