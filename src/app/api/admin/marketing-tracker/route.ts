import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import type { MarketingTrackerColumn, MarketingTrackerRow } from '@/lib/marketing-tracker';

export const runtime = 'nodejs';

export async function GET(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const [columnsResult, rowsResult] = await Promise.all([
        supabaseAdmin
            .from('marketing_tracker_column')
            .select('*')
            .order('position', { ascending: true }),
        supabaseAdmin
            .from('marketing_tracker_row')
            .select('*')
            .order('position', { ascending: true }),
    ]);

    if (columnsResult.error) {
        return NextResponse.json({ error: columnsResult.error.message }, { status: 500 });
    }
    if (rowsResult.error) {
        return NextResponse.json({ error: rowsResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
        columns: (columnsResult.data ?? []) as MarketingTrackerColumn[],
        rows: (rowsResult.data ?? []) as MarketingTrackerRow[],
    });
}
