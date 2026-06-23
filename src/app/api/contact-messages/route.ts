import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

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
