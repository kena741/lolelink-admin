import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import type { MarketingTrackerCellValue, MarketingTrackerRow } from '@/lib/marketing-tracker';

export const runtime = 'nodejs';

interface PatchRowBody {
    values?: Record<string, MarketingTrackerCellValue>;
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminPermission(request, 'catalog:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const body = (await request.json()) as PatchRowBody;
    const patchValues = body.values;

    if (!patchValues || typeof patchValues !== 'object' || Array.isArray(patchValues)) {
        return NextResponse.json({ error: 'values object is required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const { data: existing, error: existingError } = await supabaseAdmin
        .from('marketing_tracker_row')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Row not found' }, { status: 404 });

    const current = existing as MarketingTrackerRow;
    const nextValues = { ...current.values, ...patchValues };

    const { data: updated, error: updateError } = await supabaseAdmin
        .from('marketing_tracker_row')
        .update({
            values: nextValues,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ row: updated as MarketingTrackerRow });
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminPermission(request, 'catalog:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const { data: existing, error: existingError } = await supabaseAdmin
        .from('marketing_tracker_row')
        .select('id, position')
        .eq('id', id)
        .maybeSingle();

    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Row not found' }, { status: 404 });

    const { error: deleteError } = await supabaseAdmin
        .from('marketing_tracker_row')
        .delete()
        .eq('id', id);

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    await logAdminActivity({
        request,
        action: 'delete',
        resource_type: 'marketing_tracker_row',
        resource_id: id,
        summary: 'Deleted marketing tracker row',
        metadata: { position: (existing as { position: number }).position },
    });

    return NextResponse.json({ ok: true });
}
