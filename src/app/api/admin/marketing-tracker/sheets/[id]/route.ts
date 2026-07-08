import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import type { MarketingTrackerSheet } from '@/lib/marketing-tracker';

export const runtime = 'nodejs';

interface PatchSheetBody {
    name?: string;
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const body = (await request.json()) as PatchSheetBody;
    const name = (body.name ?? '').trim();
    if (!name) {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const { data: updated, error } = await supabaseAdmin
        .from('marketing_tracker_sheet')
        .update({ name })
        .eq('id', id)
        .select('*')
        .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });

    return NextResponse.json({ sheet: updated as MarketingTrackerSheet });
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdminFromRequest(request);

    const { count, error: countError } = await supabaseAdmin
        .from('marketing_tracker_sheet')
        .select('*', { count: 'exact', head: true });

    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last sheet' }, { status: 400 });
    }

    const { data: sheet, error: sheetError } = await supabaseAdmin
        .from('marketing_tracker_sheet')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (sheetError) return NextResponse.json({ error: sheetError.message }, { status: 500 });
    if (!sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 });

    const { error: deleteError } = await supabaseAdmin
        .from('marketing_tracker_sheet')
        .delete()
        .eq('id', id);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ ok: true, deleted_sheet_name: (sheet as MarketingTrackerSheet).name });
}
