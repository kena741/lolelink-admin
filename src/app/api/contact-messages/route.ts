import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { requireAdminPermission } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
    const auth = await requireAdminPermission(request, 'contact:read');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

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
