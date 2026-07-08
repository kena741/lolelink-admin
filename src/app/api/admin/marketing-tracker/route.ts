import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import type {
    MarketingTrackerColumn,
    MarketingTrackerRow,
    MarketingTrackerSheet,
} from '@/lib/marketing-tracker';

export const runtime = 'nodejs';

export async function GET(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const { searchParams } = new URL(request.url);
    const requestedSheetId = searchParams.get('sheet_id');

    const sheetsResult = await supabaseAdmin
        .from('marketing_tracker_sheet')
        .select('*')
        .order('position', { ascending: true });

    if (sheetsResult.error) {
        return NextResponse.json({ error: sheetsResult.error.message }, { status: 500 });
    }

    const sheets = (sheetsResult.data ?? []) as MarketingTrackerSheet[];
    const activeSheetId =
        requestedSheetId && sheets.some((sheet) => sheet.id === requestedSheetId)
            ? requestedSheetId
            : sheets[0]?.id ?? null;

    if (!activeSheetId) {
        return NextResponse.json({ sheets: [], active_sheet_id: null, columns: [], rows: [] });
    }

    const [columnsResult, rowsResult] = await Promise.all([
        supabaseAdmin
            .from('marketing_tracker_column')
            .select('*')
            .eq('sheet_id', activeSheetId)
            .order('position', { ascending: true }),
        supabaseAdmin
            .from('marketing_tracker_row')
            .select('*')
            .eq('sheet_id', activeSheetId)
            .order('position', { ascending: true }),
    ]);

    if (columnsResult.error) {
        return NextResponse.json({ error: columnsResult.error.message }, { status: 500 });
    }
    if (rowsResult.error) {
        return NextResponse.json({ error: rowsResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
        sheets,
        active_sheet_id: activeSheetId,
        columns: (columnsResult.data ?? []) as MarketingTrackerColumn[],
        rows: (rowsResult.data ?? []) as MarketingTrackerRow[],
    });
}
