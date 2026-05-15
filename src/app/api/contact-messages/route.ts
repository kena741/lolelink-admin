import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface ContactMessageBody {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
}

function sanitize(value: string | undefined): string {
    return (value ?? '').trim();
}

export async function POST(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as ContactMessageBody;
        const name = sanitize(body.name);
        const email = sanitize(body.email);
        const subject = sanitize(body.subject);
        const message = sanitize(body.message);

        if (!name || !email || !subject || !message)
            return NextResponse.json({ error: 'name, email/phone, subject, and message are required' }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('contact_messages')
            .insert({
                name,
                email,
                subject,
                message,
            });

        if (error)
            return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const { data, error } = await supabaseAdmin
            .from('contact_messages')
            .select('id, name, email, subject, message, created_at')
            .order('created_at', { ascending: false });

        if (error)
            return NextResponse.json({ error: error.message || 'Failed to fetch messages' }, { status: 500 });

        return NextResponse.json({ data: data ?? [] });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
