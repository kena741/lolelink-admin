import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { ensureAdminBookerCustomer } from '@/lib/admin-booker-customer';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/** Resolves designated Zemen Admin customer for admin walk-in bookings. */
export async function GET(request: Request) {
    const auth = await requireAdminPermission(request, 'bookings:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);
        const { id, row } = await ensureAdminBookerCustomer(supabaseAdmin);
        return NextResponse.json({ data: { ...row, id } });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : 'Failed to resolve admin booker customer';
        return NextResponse.json({ error: message }, { status: 404 });
    }
}
