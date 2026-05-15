import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface RequestBody {
    title: string;
    description: string;
    type: string;
    provider_id?: string | null;
    customer_id?: string | null;
    handyman_id?: string | null;
    booking_id?: string | null;
    sender_id?: string | null;
    action_url?: string | null;
    dedupe_key?: string | null;
}

function normalizeText(value: string | null | undefined): string {
    return (value || '').trim();
}

export async function POST(request: Request) {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as RequestBody;
        const title = normalizeText(body.title);
        const description = normalizeText(body.description);
        const type = normalizeText(body.type);
        if (!title || !description || !type)
            return NextResponse.json({ error: 'title, description, and type are required' }, { status: 400 });

        const dedupeKey = normalizeText(body.dedupe_key);
        if (dedupeKey) {
            const { data: existing } = await supabaseAdmin
                .from('notification')
                .select('id')
                .eq('type', type)
                .eq('description', description)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (existing)
                return NextResponse.json({ status: 'ok', deduped: true });
        }

        const { error } = await supabaseAdmin.from('notification').insert({
            title,
            description,
            type,
            provider_id: body.provider_id || null,
            customer_id: body.customer_id || null,
            handyman_id: body.handyman_id || null,
            booking_id: body.booking_id || null,
            sender_id: body.sender_id || null,
            action_url: body.action_url || null,
            is_read: false,
        });

        if (error)
            return NextResponse.json({ error: error.message || 'Failed to create notification' }, { status: 500 });

        return NextResponse.json({ status: 'ok' });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

