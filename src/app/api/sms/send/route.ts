import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SMS_UPSTREAM = 'https://betegna-ai.vercel.app/sms/send';

interface SmsRequestBody {
    recipient?: string;
    message?: string;
    callback?: string;
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as SmsRequestBody;
        const recipient = (body.recipient ?? '').trim();
        const message = (body.message ?? '').trim();

        if (!recipient || !message)
            return NextResponse.json({ error: 'recipient and message are required' }, { status: 400 });

        const upstream = await fetch(SMS_UPSTREAM, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipient,
                message,
                callback: body.callback ?? '',
            }),
        });

        const text = await upstream.text();
        let payload: unknown = null;
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch {
                payload = { raw: text };
            }
        }

        if (!upstream.ok)
            return NextResponse.json(
                { error: 'SMS upstream failed', status: upstream.status, data: payload },
                { status: upstream.status }
            );

        return NextResponse.json(payload ?? { success: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'SMS proxy failed';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
